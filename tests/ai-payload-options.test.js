const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const providerPath = path.join(__dirname, '..', 'ai-providers.js');
const source = fs.readFileSync(providerPath, 'utf8');

const context = {
  console,
  crypto: { randomUUID: () => 'test-run-id' },
  Date,
  JSON,
  URL,
  setTimeout,
  clearTimeout,
  globalThis: {}
};
context.window = context.globalThis;

vm.createContext(context);
vm.runInContext(source, context, { filename: providerPath });

const AI = context.globalThis.ShopScoutAI;

const junkProduct = {
  title: 'Pocket Camera 5K with lots of marketplace text',
  listingTitle: 'Pocket Camera 5K with Face Detection Automatic Rotating Lens',
  brand: 'YONDENE',
  manufacturer: 'YONDENE',
  modelName: '1080 Fire Helmet Camera FC1080',
  modelNumber: 'MZXJ-1088',
  newPrice: '$79.99',
  usedPrice: '$69.99',
  source: 'Amazon',
  sellerName: 'Marketplace Seller',
  url: 'https://www.amazon.com/dp/example',
  category: 'Camera',
  rating: '4.3',
  reviewCount: '42',
  asin: 'B0TEST1234',
  sku: 'B0TEST1234',
  rawSpecs: [
    { key: 'Input Voltage', value: '12Volts' },
    { key: 'Dots per inch', value: '1200 dots per inch' },
    ...Array.from({ length: 40 }, (_, index) => ({
      key: index % 2 ? `Spec ${index}` : 'Product Description',
      value: index % 2 ? `Useful value ${index}` : 'Previous page Next page Click Here Click Here'
    }))
  ],
  bullets: [
    '5K professional ultra premium military grade camera with marketing words',
    'Face detection and rotating lens',
    'Previous page Next page Click Here',
    'Includes external microphone and 64GB card',
    'Another very long bullet '.repeat(60)
  ],
  description: 'Product description Swim Suits for Women 2025 KEEP IN FASHION Previous page Next page Click Here Click Here '.repeat(30)
};

const compactSummary = AI.productSummary([junkProduct], { payloadMode: 'compact' })[0];
assert.strictEqual(compactSummary.payloadMode, 'compact', 'compact summary records payload mode');
assert.ok(compactSummary.url, 'compact summary keeps source URL');
assert.ok(!Object.prototype.hasOwnProperty.call(compactSummary, 'description'), 'compact summary does not send raw description');
assert.ok(compactSummary.specs.length <= 18, 'compact summary caps specs');
assert.ok(compactSummary.bullets.length <= 3, 'compact summary caps bullets');
assert.ok(Array.isArray(compactSummary.normalizedSpecs), 'compact summary includes a locally normalized spec ledger');
assert.ok(
  compactSummary.normalizedSpecs.some(spec => spec.key === 'Input voltage' && spec.value === '12 V'),
  'compact summary sends normalized equivalent units for AI cleanup and verification'
);
assert.ok(
  !JSON.stringify(compactSummary).includes('Previous page Next page Click Here'),
  'compact summary removes obvious marketplace junk'
);

const fallbackSummary = AI.productSummary([junkProduct], { payloadMode: 'fallback' })[0];
assert.ok(fallbackSummary.rawFallback, 'fallback summary includes raw fallback container');
assert.ok(fallbackSummary.rawFallback.descriptionExcerpt.length <= 700, 'fallback description is capped');
assert.ok(fallbackSummary.rawFallback.bullets.length <= 5, 'fallback bullets are capped');

const estimate = AI.estimatePromptPayload([junkProduct], { payloadMode: 'compact' });
assert.ok(estimate.charCount > 0, 'payload estimate returns character count');
assert.ok(estimate.estimatedTokens > 0, 'payload estimate returns estimated token count');
assert.ok(estimate.estimatedTokens < 1200, 'compact payload estimate stays bounded for junk-heavy product');

const prompt = AI.buildStagePrompt('retrieval', [junkProduct], [], {}, { payloadMode: 'compact' });
assert.ok(prompt.includes('Use the compact captured facts first'), 'prompt tells AI to use compact captured facts first');
assert.ok(prompt.includes('locally normalized spec ledger'), 'prompt asks AI to verify and clean the local normalized spec ledger');
assert.ok(prompt.includes('Retrieve/search only for missing'), 'prompt limits retrieval to missing/conflicting/official verification needs');
assert.ok(!prompt.includes(junkProduct.description.slice(0, 80)), 'prompt omits full raw description');

const comparisonHtml = fs.readFileSync(path.join(__dirname, '..', 'comparison.html'), 'utf8');
const comparisonJs = fs.readFileSync(path.join(__dirname, '..', 'comparison.js'), 'utf8');
assert.ok(comparisonHtml.includes('data-payload-mode="compact"'), 'UI exposes compact hybrid payload mode');
assert.ok(comparisonHtml.includes('data-payload-mode="estimate"'), 'UI exposes hybrid with token estimate mode');
assert.ok(comparisonHtml.includes('data-payload-mode="fallback"'), 'UI exposes compact plus raw fallback mode');
assert.ok(comparisonJs.includes('collectPromptPayloadOptionsFromModal'), 'comparison script collects prompt payload options');
assert.ok(comparisonJs.includes('updatePromptPayloadEstimate'), 'comparison script updates prompt payload estimate');
assert.ok(comparisonJs.includes('promptOptions'), 'comparison script sends prompt options to the AI pipeline');
assert.ok(comparisonJs.includes('function formatManualProductFacts'), 'manual prompt formats product facts as readable text');
assert.ok(comparisonJs.includes('Do not return JSON'), 'manual prompt explicitly forbids JSON output');
assert.ok(!/function buildManualHybridPrompt[\s\S]*JSON\.stringify\(payload/.test(comparisonJs), 'manual prompt does not present product facts as JSON');

console.log('ai payload option tests passed');
