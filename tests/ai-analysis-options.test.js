const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const providerPath = path.join(__dirname, '..', 'ai-providers.js');
const providerSource = fs.readFileSync(providerPath, 'utf8');
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
vm.runInContext(providerSource, context, { filename: providerPath });

const AI = context.globalThis.ShopScoutAI;

const defaults = AI.normalizeAnalysisOptions({});
assert.strictEqual(defaults.verifySpecs, true, 'spec verification is selected by default');
assert.strictEqual(defaults.missingSpecs, true, 'missing important specs is selected by default');
assert.strictEqual(defaults.marketingClaims, true, 'marketing-claim checks are selected by default');
assert.strictEqual(defaults.correctConflicts, true, 'correction of conflicting data is selected by default');
assert.strictEqual(defaults.comparisonColumns, true, 'comparison table column generation is selected by default');
assert.strictEqual(defaults.priceValue, true, 'price and value comparison is selected by default');
assert.strictEqual(defaults.reviewsRatings, true, 'review/rating analysis is selected by default');
assert.strictEqual(defaults.compareAll, false, 'one big compare-it-all table is optional by default');
assert.strictEqual(defaults.rebrandDuplicate, false, 'rebrand duplicate check is optional by default');
assert.strictEqual(defaults.riskSummary, false, 'risk summary is optional by default');
assert.strictEqual(defaults.sellerRisk, false, 'seller/store risk is optional by default');
assert.strictEqual(defaults.finalRecommendation, true, 'final recommendation is selected by default');

const products = [{
  title: 'Waterproof 5K Helmet Camera',
  brand: 'Camco',
  newPrice: '$79.99',
  source: 'Amazon',
  url: 'https://example.com/product',
  rawSpecs: [
    { key: 'Video Resolution', value: '5K' },
    { key: 'Battery Capacity', value: '1800 mAh' }
  ]
}];

const retrievalPrompt = AI.buildStagePrompt('retrieval', products, [], defaults);
assert.ok(retrievalPrompt.includes('Internal category and buying-factor preparation'), 'retrieval stage performs hidden category/buy-factor prep');
assert.ok(retrievalPrompt.includes('Use product specifications first'), 'category prep uses specs as the first signal');

const verificationPrompt = AI.buildStagePrompt('verification', products, [], {
  verifySpecs: true,
  missingSpecs: false,
  marketingClaims: true,
  correctConflicts: true
});
assert.ok(verificationPrompt.includes('Verification'), 'verification prompt includes the verification section');
assert.ok(verificationPrompt.includes('Check Marketing Claims'), 'verification prompt includes selected marketing-claim checks');
assert.ok(verificationPrompt.includes('Correct Bad or Conflicting Data'), 'verification prompt includes selected correction checks');
assert.ok(!verificationPrompt.includes('Find Missing Important Specs'), 'verification prompt omits unselected missing-spec checks');

const comparisonPrompt = AI.buildStagePrompt('comparison', products, [], {
  comparisonColumns: true,
  priceValue: true,
  reviewsRatings: true,
  compareAll: false,
  rebrandDuplicate: false,
  riskSummary: false,
  sellerRisk: false,
  finalRecommendation: true
});
assert.ok(comparisonPrompt.includes('Build Comparison Table Columns'), 'comparison prompt includes selected table-column section');
assert.ok(comparisonPrompt.includes('Compare Price & Value'), 'comparison prompt includes selected price/value section');
assert.ok(comparisonPrompt.includes('Analyze Reviews / Ratings'), 'comparison prompt includes selected review section');
assert.ok(comparisonPrompt.includes('Final Recommendation'), 'comparison prompt includes selected final recommendation');
assert.ok(comparisonPrompt.includes('template_report'), 'comparison prompt asks for template-aligned report data');
assert.ok(comparisonPrompt.includes('verdicts'), 'comparison prompt includes verdict bucket for the Verdict tab');
assert.ok(comparisonPrompt.includes('buying_factors'), 'comparison prompt includes buying-factor bucket for the Compare tab');
assert.ok(comparisonPrompt.includes('price_value'), 'comparison prompt includes price/value bucket for the Compare tab');
assert.ok(comparisonPrompt.includes('review_signals'), 'comparison prompt includes review bucket for the Compare tab');
assert.ok(comparisonPrompt.includes('risk_axes'), 'comparison prompt includes risk axes for the Risks tab');
assert.ok(!comparisonPrompt.includes('Check Rebrand / Duplicate Products'), 'comparison prompt omits unselected rebrand check');
assert.ok(!comparisonPrompt.includes('Risk Summary'), 'comparison prompt omits unselected risk summary');

assert.deepStrictEqual(
  Array.from(AI.enabledStagesForAnalysis({ verifySpecs: false, missingSpecs: false, marketingClaims: false, correctConflicts: false, comparisonColumns: false, priceValue: false, reviewsRatings: false, compareAll: false, rebrandDuplicate: false, riskSummary: false, sellerRisk: false, finalRecommendation: true }, false)),
  ['retrieval', 'comparison'],
  'final-only analysis runs internal prep plus comparison'
);

const { read: readFile, pageAndStyles } = require('./_helpers');
const comparisonHtml = pageAndStyles('comparison.html', 'comparison.css');
const comparisonJs = readFile('comparison.js');

assert.ok(comparisonHtml.includes('id="aiOptionsModal"'), 'comparison page includes the AI options modal');
assert.ok(comparisonHtml.includes('data-ai-option="verifySpecs"'), 'AI options modal includes verification checkbox');
assert.ok(comparisonHtml.includes('data-ai-option="finalRecommendation"'), 'AI options modal includes final recommendation checkbox');
assert.ok(/\.ai-options-modal\s*\{[^}]*width:\s*min\(1080px, calc\(100vw - 32px\)\)/.test(comparisonHtml), 'AI options modal is wider so the full checklist is compact');
assert.ok(/\.ai-options-body\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/.test(comparisonHtml), 'AI options modal uses two compact group columns while each group remains single-column');
assert.ok(/\.ai-option-list\s*\{[^}]*grid-template-columns:\s*1fr/.test(comparisonHtml), 'AI options are single column by default');
assert.ok(!/\.ai-option-list\s*\{[^}]*repeat\(2/.test(comparisonHtml), 'AI options no longer use a two-column grid');
assert.ok(comparisonHtml.includes('.ai-option, .ai-option * { text-transform: none; letter-spacing: 0; }'), 'AI option labels override generic modal uppercase styling');
assert.ok(comparisonHtml.includes('background: var(--paper);') && comparisonHtml.includes('border: 1px solid var(--rule-strong);'), 'AI options modal follows the new comparison theme tokens');
assert.ok(comparisonJs.includes('openAiOptionsModal'), 'comparison script opens the AI options modal before running');
assert.ok(comparisonJs.includes('analysisOptions'), 'comparison script sends selected analysis options to the background pipeline');

console.log('ai analysis options tests passed');
