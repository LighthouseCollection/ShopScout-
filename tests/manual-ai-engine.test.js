const fs = require('fs');
const path = require('path');
const comparisonHtml = fs.readFileSync(path.join(__dirname, '..', 'comparison.html'), 'utf8');
const comparisonJs = fs.readFileSync(path.join(__dirname, '..', 'comparison.js'), 'utf8');
const aiProvidersJs = fs.readFileSync(path.join(__dirname, '..', 'ai-providers.js'), 'utf8');
const utilsJs = fs.readFileSync(path.join(__dirname, '..', 'utils.js'), 'utf8');

function mustInclude(source, text, message) {
  if (!source.includes(text)) throw new Error(message + `\nMissing: ${text}`);
}

mustInclude(comparisonHtml, 'data-ai-section="categoryBuyingFactors"', 'AI modal exposes Category & Buying Factors section');
mustInclude(comparisonHtml, 'data-ai-section="masterComparisonTable"', 'AI modal exposes Master Comparison Table section');
mustInclude(comparisonHtml, 'data-ai-section="discrepanciesFactChecks"', 'AI modal exposes Discrepancies & Fact-Checks section');
mustInclude(comparisonHtml, 'data-ai-section="claimsValueReviews"', 'AI modal exposes Claims, Value & Reviews section');
mustInclude(comparisonHtml, 'data-ai-section="finalVerdict"', 'AI modal exposes Final Verdict section');
mustInclude(comparisonHtml, 'id="aiFieldList"', 'AI modal includes dynamic field/spec checklist');
mustInclude(comparisonHtml, 'data-command="paste-ai-result"', 'Analyze ribbon has paste-result-back entry point');
mustInclude(comparisonHtml, 'src="shared/manualAiResultParser.js"', 'comparison page loads the manual AI result parser');

mustInclude(comparisonJs, 'function aiSectionInputs()', 'comparison script reads report section checkboxes');
mustInclude(comparisonJs, 'function renderAiFieldSelection', 'comparison script renders dynamic product fields before prompt generation');
mustInclude(comparisonJs, 'function collectAiFieldSelectionFromModal', 'comparison script collects selected meta/spec fields');
mustInclude(comparisonJs, 'function analysisOptionsFromSections', 'comparison script maps report sections to existing AI analysis flags');
mustInclude(comparisonJs, 'ShopScoutProductSpecAccess', 'manual/export/search spec consumers use the ProductSpec access boundary');
mustInclude(comparisonJs, 'productSpecEntries(product).flatMap', 'search text reads specs through ProductSpec entries');
mustInclude(comparisonJs, 'function exportSpecEntries(product)', 'export/copy specs route through a shared spec entry helper');
mustInclude(comparisonJs, 'function openManualResultPasteModal', 'comparison script exposes paste-result-back workflow');
mustInclude(comparisonJs, "command === 'paste-ai-result'", 'comparison script routes ribbon paste-result-back command');
mustInclude(comparisonJs, 'manual AI pasted result', 'paste-result-back creates a normal AI run that can be opened from AI Results');
mustInclude(comparisonJs, 'function applyManualAiTableUpdates', 'paste-result-back has an auto-apply path for ShopScout Table Updates');
mustInclude(comparisonJs, 'ShopScoutManualAIResultParser', 'paste-result-back delegates parsing and table updates to the parser module');
mustInclude(comparisonJs, 'manualTableUpdates', 'saved manual AI runs record parsed/applied/skipped table update counts');
mustInclude(comparisonJs, 'if (updateResult.applied.length) restoreProductListChrome()', 'paste-result-back refreshes the main table after applying AI updates');
mustInclude(comparisonJs, 'data.aiRuns = [run, ...runs]', 'paste-result-back writes into data.aiRuns instead of an unreachable side key');
if (comparisonJs.includes('shopscout_manual_ai_results')) {
  throw new Error('paste-result-back must not write to the unreachable shopscout_manual_ai_results side key');
}
mustInclude(comparisonJs, 'includedFields', 'prompt options carry selected field/spec list');
mustInclude(comparisonJs, 'Captured specs [each specification is an individual field (column)]', 'manual prompt tells AI each captured spec is a field');
mustInclude(comparisonJs, 'Listed value → Corrected value → Reason/source → Confidence', 'manual prompt enforces correction arrow syntax');
mustInclude(comparisonJs, 'ShopScout Table Updates', 'manual prompt requests a parseable paste-back table');
mustInclude(comparisonJs, '| Product # | Product name | Field | Current/listed value | Recommended value | Update type | Confidence | Reason |', 'manual prompt pins the paste-back update table columns');

mustInclude(aiProvidersJs, 'function filterProductSummaryFields', 'provider summary filters product payload fields');
mustInclude(aiProvidersJs, 'includedFields', 'prompt options retain selected fields for token control');
mustInclude(utilsJs, "const AI_RUNS_KEY = 'shopscout_ai_runs'", 'dashboard storage helpers know the shared AI run key');
mustInclude(utilsJs, 'async function loadAIAnalysisRuns', 'dashboard getData can load saved AI runs for results pages');
mustInclude(utilsJs, 'snapshot.aiRuns = await loadAIAnalysisRuns()', 'repo-backed dashboard snapshots include saved AI runs');

console.log('manual AI engine tests passed');
