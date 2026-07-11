const fs = require('fs');
const path = require('path');
const comparisonHtml = fs.readFileSync(path.join(__dirname, '..', 'comparison.html'), 'utf8');
const comparisonJs = fs.readFileSync(path.join(__dirname, '..', 'comparison.js'), 'utf8');
const aiProvidersJs = fs.readFileSync(path.join(__dirname, '..', 'ai-providers.js'), 'utf8');

function mustInclude(source, text, message) {
  if (!source.includes(text)) throw new Error(message + `\nMissing: ${text}`);
}

mustInclude(comparisonHtml, 'data-ai-section="categoryBuyingFactors"', 'AI modal exposes Category & Buying Factors section');
mustInclude(comparisonHtml, 'data-ai-section="masterComparisonTable"', 'AI modal exposes Master Comparison Table section');
mustInclude(comparisonHtml, 'data-ai-section="discrepanciesFactChecks"', 'AI modal exposes Discrepancies & Fact-Checks section');
mustInclude(comparisonHtml, 'data-ai-section="claimsValueReviews"', 'AI modal exposes Claims, Value & Reviews section');
mustInclude(comparisonHtml, 'data-ai-section="finalVerdict"', 'AI modal exposes Final Verdict section');
mustInclude(comparisonHtml, 'id="aiFieldList"', 'AI modal includes dynamic field/spec checklist');
mustInclude(comparisonHtml, 'id="manualResultPasteBtn"', 'Manual AI flow has paste-result-back entry point');

mustInclude(comparisonJs, 'function aiSectionInputs()', 'comparison script reads report section checkboxes');
mustInclude(comparisonJs, 'function renderAiFieldSelection', 'comparison script renders dynamic product fields before prompt generation');
mustInclude(comparisonJs, 'function collectAiFieldSelectionFromModal', 'comparison script collects selected meta/spec fields');
mustInclude(comparisonJs, 'function analysisOptionsFromSections', 'comparison script maps report sections to existing AI analysis flags');
mustInclude(comparisonJs, 'function openManualResultPasteModal', 'comparison script exposes paste-result-back workflow');
mustInclude(comparisonJs, 'includedFields', 'prompt options carry selected field/spec list');
mustInclude(comparisonJs, 'Captured specs [each specification is an individual field (column)]', 'manual prompt tells AI each captured spec is a field');
mustInclude(comparisonJs, 'Listed value → Corrected value → Reason/source → Confidence', 'manual prompt enforces correction arrow syntax');

mustInclude(aiProvidersJs, 'function filterProductSummaryFields', 'provider summary filters product payload fields');
mustInclude(aiProvidersJs, 'includedFields', 'prompt options retain selected fields for token control');

console.log('manual AI engine tests passed');
