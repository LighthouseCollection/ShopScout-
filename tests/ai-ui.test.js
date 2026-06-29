const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const uiPath = path.join(__dirname, '..', 'ai-ui.js');
const source = fs.readFileSync(uiPath, 'utf8');

const context = {
  window: {},
  globalThis: {},
  Date,
  URL,
  console
};
context.window = context.globalThis;

vm.createContext(context);
vm.runInContext(source, context, { filename: uiPath });

const UI = context.globalThis.ShopScoutAIUI;

const rendered = UI.renderRichText(`# Risks & Comparison

| Factor | Result |
| --- | --- |
| Warranty | Unknown |

- Seller warranty needs verification
- Model number differs from listing

\`\`\`json
{"quick_verdict":{"best_overall":{"reason":"hidden raw json"}}}
\`\`\``);

assert.ok(rendered.includes('<h4>Risks &amp; Comparison</h4>'), 'headings render as HTML headings');
assert.ok(rendered.includes('<table'), 'markdown tables render as HTML tables');
assert.ok(rendered.includes('<li>Seller warranty needs verification</li>'), 'bullets render as HTML lists');
assert.ok(!rendered.includes('```'), 'raw fenced blocks are not shown');
assert.ok(!rendered.includes('quick_verdict'), 'structured JSON is stripped from readable output');

const sourceRendered = UI.renderRichText(`| Source |
| --- |
| [Amazon](https://www.amazon.com/dp/B0DYTYMBBP) |
| https://www.anker.com/products/example |
| https://www.amazon.com/dp/B0C1FZWT8M |`);

assert.ok(sourceRendered.includes('>Amazon</a>'), 'markdown source links show the source name');
assert.ok(sourceRendered.includes('href="https://www.amazon.com/dp/B0DYTYMBBP"'), 'markdown source links remain clickable');
assert.ok(sourceRendered.includes('>Anker</a>'), 'raw source URLs render as readable source names');
assert.ok(!sourceRendered.includes('(https://www.amazon.com/dp/B0DYTYMBBP)'), 'source URLs are not exposed beside source names');

const ai = {
  stages: [
    {
      stage: 'verification',
      parsedJson: {
        specification_ledger: [
          {
            specification: 'Material',
            listing_value: 'Aluminum',
            official_or_external_value: 'Stainless steel',
            verification_status: 'contradictory',
            notes: 'Official spec sheet lists stainless steel.'
          },
          {
            specification: 'Battery',
            listing_value: '2000 mAh',
            official_or_external_value: '2000 mAh',
            verification_status: 'verified'
          }
        ],
        corrections: [
          {
            field: 'modelNumber',
            original: 'ABC-1',
            corrected: 'ABC-100',
            reason: 'Manual uses ABC-100.'
          }
        ]
      }
    }
  ]
};

const corrections = Array.from(UI.extractCorrections(ai));
assert.strictEqual(corrections.length, 2, 'extractCorrections keeps only changed values');
assert.strictEqual(corrections[0].field, 'Material', 'ledger corrections use the specification name');
assert.strictEqual(corrections[1].field, 'modelNumber', 'explicit corrections keep the field name');

const correctionHtml = UI.renderCorrectionsHtml(ai);
assert.ok(correctionHtml.includes('<del>Aluminum</del>'), 'original value is crossed out');
assert.ok(correctionHtml.includes('Stainless steel'), 'corrected value is shown');
assert.ok(correctionHtml.includes('ai-correction-new'), 'corrected value has the expected CSS hook');

console.log('ai ui tests passed');
