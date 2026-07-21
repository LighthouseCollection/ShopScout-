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

const recommendedHighRisk = AI.recommendedAnalysisOptions([{ source: 'Alibaba', seller: 'Marketplace seller' }]);
assert.strictEqual(recommendedHighRisk.sellerRisk, true, 'recommended analysis enables seller risk for higher-risk marketplaces');
const recommendedAmazon = AI.recommendedAnalysisOptions([{ source: 'Amazon', seller: 'Amazon.com' }]);
assert.strictEqual(recommendedAmazon.sellerRisk, false, 'recommended analysis keeps seller risk off for reputable sources');

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
assert.ok(comparisonHtml.includes('Data to Send'), 'AI options modal uses clearer Data to Send wording');
assert.ok(comparisonHtml.includes('class="ai-options-layout"'), 'AI options modal uses a settings-style left navigation layout');
assert.ok(comparisonHtml.includes('Step 1: Data to Send'), 'AI options modal numbers the Data to Send step');
assert.ok(comparisonHtml.includes('Step 2: What to Ask AI to Analyze'), 'AI options modal numbers the analysis step');
assert.ok(comparisonHtml.includes('Step 3: Product Data Included'), 'AI options modal numbers the product data step');
assert.ok(comparisonHtml.includes('Step 4: Send &amp; Paste Back'), 'AI options modal numbers the final send/paste-back step');
assert.ok(comparisonHtml.includes('data-ai-options-tab="payload"'), 'AI options modal includes Data to Send left-nav item');
assert.ok(comparisonHtml.includes('data-ai-options-tab="analysis"'), 'AI options modal includes What to Ask AI to Analyze left-nav item');
assert.ok(comparisonHtml.includes('data-ai-options-tab="fields"'), 'AI options modal includes Product Data Included left-nav item');
assert.ok(comparisonHtml.includes('data-ai-options-tab="sendBack"'), 'AI options modal includes Send & Paste Back left-nav item');
assert.ok(comparisonHtml.includes('Example: name, brand, price'), 'compact data option includes an example');
assert.ok(comparisonHtml.includes('Example: full captured description'), 'full data option includes an example');
assert.ok(!comparisonHtml.includes('data-payload-mode="estimate"'), 'Data to Send no longer exposes compact+estimate as a payload choice');
assert.ok(!comparisonHtml.includes('data-payload-mode="fallback"'), 'Data to Send no longer exposes compact+raw-fallback as a payload choice');
assert.ok(comparisonHtml.includes('ai-option-list ai-option-list--plain'), 'report section checklist uses unboxed plain rows');
assert.ok(comparisonHtml.includes('data-ai-section="discrepanciesFactChecks"'), 'AI options modal includes fact-check section checkbox');
assert.ok(comparisonHtml.includes('data-ai-section="riskSellerChecks"'), 'AI options modal includes optional risk and seller checks');
assert.ok(comparisonHtml.includes('data-ai-section="finalVerdict"'), 'AI options modal includes final verdict section checkbox');
assert.ok(comparisonHtml.includes('id="aiFieldList"'), 'AI options modal includes field/spec token-control list');
assert.ok(!comparisonHtml.includes('class="ai-paste-back-block"'), 'paste-result-back is not embedded inside the AI options modal');
assert.ok(comparisonHtml.includes('data-command="paste-ai-result"'), 'paste-result-back is exposed from the Analyze ribbon');
assert.ok(comparisonHtml.includes('data-ai-paste-back-option="yes"'), 'AI modal asks whether paste-back table-update instructions should be included');
assert.ok(comparisonHtml.includes('id="manualResultInlinePasteText"'), 'AI modal includes paste-back instruction textbox for the yes option');
assert.ok(comparisonHtml.includes('id="manualAiServiceGrid"'), 'manual AI assistant choices are embedded in the AI options modal');
assert.ok(/\.ai-options-modal\s*\{[^}]*width:\s*min\(1080px, calc\(100vw - 32px\)\)/.test(comparisonHtml), 'AI options modal is wider so the full checklist is compact');
assert.ok(/\.ai-options-layout\s*\{[^}]*grid-template-columns:\s*260px minmax\(0, 1fr\)/.test(comparisonHtml), 'AI options modal uses a left nav and main pane layout');
assert.ok(/\.ai-options-pane\s*\{[^}]*display:\s*none/.test(comparisonHtml), 'inactive AI options panes are hidden');
assert.ok(/\.ai-options-pane\.active\s*\{[^}]*display:\s*block/.test(comparisonHtml), 'active AI options pane is visible');
assert.ok(/\.ai-options-pane\.active\s*\{[^}]*border:\s*1px solid var\(--rule\)/.test(comparisonHtml), 'active AI options pane has a soft bordered content surface');
assert.ok(/\.ai-payload-list\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/.test(comparisonHtml), 'data-to-send options render as two equal choices');
assert.ok(/\.ai-payload-list\s*\{[^}]*grid-auto-rows:\s*1fr/.test(comparisonHtml), 'data-to-send cards use equal-height grid rows');
assert.ok(/\.ai-option--payload\s*\{[^}]*min-height:\s*118px/.test(comparisonHtml), 'data-to-send option cards use equal height');
assert.ok(/\.ai-option-list\s*\{[^}]*grid-template-columns:\s*1fr/.test(comparisonHtml), 'AI options are single column by default');
assert.ok(/\.ai-option-list--plain \.ai-option\s*\{[^}]*border:\s*0/.test(comparisonHtml), 'report section rows are not boxed cards');
assert.ok(/\.ai-option-list--plain \.ai-option\s*\{[^}]*display:\s*flex/.test(comparisonHtml), 'report section rows place the checkbox on the same line as the item title');
assert.ok(comparisonJs.includes('function setAiOptionsTab'), 'comparison script switches AI options left-nav panes');
assert.ok(comparisonJs.includes('function isPromptFieldLabelAllowed'), 'comparison script filters junk spec labels from prompt field choices');
assert.ok(comparisonJs.includes('function renderManualAiServiceSelection'), 'comparison script renders manual AI choices inside the options modal');
assert.ok(comparisonJs.includes('openSelectedManualAiService(promptText)'), 'manual prompt flow opens the selected AI service directly');
assert.ok(!comparisonJs.includes('function toggleAiAccordionSection'), 'old accordion toggling was removed from the AI modal');
assert.ok(/\.ai-field-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(120px, 1fr\)\)/.test(comparisonHtml), 'field selection renders in four columns');
assert.ok(/\.ai-options-modal \.ai-field-item,\s*\.ai-options-modal \.ai-field-item:first-of-type\s*\{[^}]*display:\s*inline-flex/.test(comparisonHtml), 'field rows override generic modal label styling so checkbox and text do not overlap');
assert.ok(/\.ai-payload-estimate\s*\{[^}]*background:\s*var\(--bad-rule\)/.test(comparisonHtml), 'payload estimate uses the requested warning background');
assert.ok(!/\.ai-option-list\s*\{[^}]*repeat\(2/.test(comparisonHtml), 'AI options no longer use a two-column grid');
assert.ok(comparisonHtml.includes('.ai-option, .ai-option * { text-transform: none; letter-spacing: 0; }'), 'AI option labels override generic modal uppercase styling');
assert.ok(comparisonHtml.includes('background: var(--paper);') && comparisonHtml.includes('border: 1px solid var(--rule-strong);'), 'AI options modal follows the new comparison theme tokens');
assert.ok(comparisonJs.includes('openAiOptionsModal'), 'comparison script opens the AI options modal before running');
assert.ok(comparisonJs.includes('openAutoAiOnboardingModal'), 'connected AI path shows onboarding when no provider is configured');
assert.ok(comparisonJs.includes('Auto AI needs an AI account first'), 'Auto AI onboarding explains the missing account setup');
assert.ok(comparisonJs.includes('Set up Auto AI'), 'Auto AI onboarding can open AI provider settings');
assert.ok(comparisonJs.includes('Use Manual AI instead'), 'Auto AI onboarding can fall back to Manual AI');
assert.ok(comparisonJs.includes('hasConnectedAiProvider(settings)'), 'integrated AI checks provider configuration before opening run options');
assert.ok(comparisonJs.includes("setAiOptionsTab('payload')"), 'AI options modal opens on Data to Send');
assert.ok(comparisonJs.includes('analysisOptions'), 'comparison script sends selected analysis options to the background pipeline');
assert.ok(/function collectAiOptionsFromSectionsForProducts\([\s\S]*sellerRisk:\s*!!normalized\.riskSellerChecks/.test(comparisonJs), 'risk/seller section maps to seller risk analysis');
assert.ok(/function collectAiOptionsFromSectionsForProducts\([\s\S]*rebrandDuplicate:\s*!!normalized\.riskSellerChecks/.test(comparisonJs), 'risk/seller section maps to rebrand duplicate analysis');
assert.ok(/function getRecommendedAiOptions[\s\S]*recommendedAnalysisOptions\(products\)/.test(comparisonJs), 'recommended modal state remains product-sensitive');

console.log('ai analysis options tests passed');
