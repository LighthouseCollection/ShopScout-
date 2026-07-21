const assert = require('assert');
const { read, pageAndStyles } = require('./_helpers');

const html = pageAndStyles('comparison.html', 'comparison.css');
/* Task 7: AI results rendering moved into comparison/aiResultsView.js.
   Read both so the legacy content assertions still find their targets
   regardless of which file currently owns the snippet. */
const js = read('comparison.js') + '\n' + read('comparison/aiResultsView.js');

function functionBlock(name) {
  const start = js.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} exists`);
  const next = js.indexOf('\nfunction ', start + 1);
  return js.slice(start, next >= 0 ? next : js.length);
}

assert.ok(html.includes('id="aiAnalysisPageBtn"'), 'Analyze menu exposes an AI Analysis Page button');
assert.ok(html.includes('id="aiResultsPage"'), 'comparison page includes an AI analysis results page view');
assert.ok(!html.includes('id="aiResultsModal"'), 'AI analysis results are not rendered inside a modal overlay');
assert.ok(html.includes('id="aiResultsBack"'), 'AI analysis results page has a Back to Products action');
assert.ok(html.includes('class="ai-results-report"'), 'AI analysis results use the redesigned report shell');
assert.ok(html.includes('id="aiDevViewResults"'), 'AI run monitor includes a View Results action');
assert.ok(/<textarea[^>]+id="aiDevLog"/.test(html), 'Live Events uses a textarea-style log surface');

assert.ok(!/stage\.responseSnippet[\s\S]{0,140}<details open>/.test(js), 'response snippet details do not use the open attribute');
assert.ok(js.includes('buildAiDevEventLogText'), 'monitor renders live events as textarea text');
assert.ok(js.includes('buildAiResultsViewModel'), 'AI results build a view model from run and products');
assert.ok(js.includes('renderRedesignedAiResultsPage'), 'AI results render the redesigned template');
assert.ok(js.includes('renderAiVerdictTab'), 'redesigned results include a verdict tab renderer');
assert.ok(js.includes('renderAiCompareTab'), 'redesigned results include a compare tab renderer');
assert.ok(js.includes('renderAiVerificationTab'), 'redesigned results include a verification tab renderer');
assert.ok(js.includes('renderAiSpecsTab'), 'redesigned results include a specs/corrections tab renderer');
assert.ok(js.includes('renderAiRisksTab'), 'redesigned results include a risks tab renderer');
assert.ok(!js.includes('renderAiSecondOpinionTab'), 'Second opinion renderer is removed from AI results');
assert.ok(!js.includes('Second opinion'), 'Second opinion tab text is removed from AI results');
assert.ok(js.includes('buildAiTemplateReportModel'), 'AI results build a template-aligned report model');
assert.ok(js.includes('templateVerdicts'), 'AI results map verdict data into product verdict cards');
assert.ok(js.includes('templateComparisonRows'), 'AI results map side-by-side comparison rows');
assert.ok(js.includes('templateBuyingFactors'), 'AI results map buying factors into the factors matrix');
assert.ok(js.includes('templatePriceValue'), 'AI results map price/value findings into value cards');
assert.ok(js.includes('templateReviewSignals'), 'AI results map reviews into review cards');
assert.ok(js.includes('templateVerificationAudits'), 'AI results map verification claims into product subtabs');
assert.ok(js.includes('templateSpecCorrections'), 'AI results map corrections into the correction table');
assert.ok(js.includes('templateRiskAxes'), 'AI results map risk axes into the heat map and risk subtabs');
assert.ok(js.includes('templateSellerReliability'), 'AI results map seller reliability into the seller table');
assert.ok(js.includes('renderAiResultsPage'), 'comparison script renders AI analysis results as a page');
assert.ok(!js.includes('renderAiResultsModal'), 'comparison script no longer renders AI analysis results as a modal');
assert.ok(js.includes('closeAiResultsPage'), 'AI analysis results page can return to products');
assert.ok(js.includes('class="page ai-results-page-inner"'), 'results renderer uses the redesign page wrapper');
assert.ok(js.includes('class="meta-bottom"'), 'results renderer uses the redesign compact metadata row');
assert.ok(js.includes("data-ai-results-tab=\"verdict\""), 'results view starts with the redesign Verdict tab');
assert.ok(js.includes('class="verdict-row"'), 'results view uses the redesign verdict row');
assert.ok(js.includes('class="product-verdict"'), 'results view renders redesigned product verdict cards');
assert.ok(js.includes('class="pv-stats"'), 'verdict cards include compact product stats');
assert.ok(js.includes('id="aiResultsComparisonGrid"'), 'Compare > Comparison subtab has an AG Grid mount');
assert.ok(js.includes('data-ai-results-grid="comparison"'), 'comparison grid mount is identifiable');
assert.ok(js.includes('createGrid'), 'AI results comparison uses AG Grid instead of a static HTML table');
assert.ok(!js.includes('class="cmp-table"'), 'AI results renderer does not emit the rejected cmp-table class');
assert.ok(js.includes('class="source-pill'), 'sources render as clickable named pills, not raw URLs');
assert.ok(js.includes('class="value-card '), 'compare tab includes redesigned price/value cards');
assert.ok(js.includes('class="review-card '), 'compare tab includes redesigned review cards');
assert.ok(js.includes('class="subtab-bar"'), 'compare tab uses redesign subtabs instead of one long dump');
assert.ok(js.includes('class="ai-report-table"'), 'non-grid report tables use a scoped AI report-table class');
assert.ok(!js.includes("label: 'Search / Retrieval'"), 'results view does not expose search/retrieval as a main tab');
assert.ok(js.includes('openLatestAiResults'), 'AI Analysis Page opens the latest saved run');
assert.ok(js.includes('latestAiRunForActiveList'), 'AI Analysis Page chooses the latest run for the active product list');
assert.ok(/function latestAiRunForActiveList[\s\S]*run\.listName === data\.activeList/.test(js), 'latest saved AI result is scoped to the selected list');
assert.ok(js.includes('function showAiRunResults'), 'completed or partial AI runs use one shared results handoff');
assert.ok(js.includes('document.getElementById(\'aiDevModal\')?.classList.remove(\'active\')'), 'results handoff closes the AI run monitor before showing the results page');
assert.ok(js.includes('openAiResultsForRunId'), 'completed monitor can open the just-finished run results');
assert.ok(js.includes('openInitialAiResultsFromUrl'), 'dashboard can open a saved run result from the URL');
assert.ok(js.includes("new URLSearchParams(window.location.search)"), 'dashboard reads the aiRun URL parameter');
assert.ok(js.includes("params.get('aiRun')"), 'dashboard uses aiRun to choose the saved results run');
assert.ok(js.includes('categoryLeafLabel'), 'results title collapses category hierarchies to the final category layer');
assert.ok(html.includes('.ai-results-page .tab-bar') && html.includes('overflow: visible;'), 'AI results tabs wrap without internal scrollbars');
assert.ok(html.includes('max-width: 100%;') && html.includes('max-height: 100%;'), 'AI result product images fit inside their allocated placeholders');
assert.ok(js.includes('isAiRunIncomplete'), 'AI results detect partial or failed runs');
assert.ok(js.includes('class="ai-results-warning"'), 'AI results show a warning banner when analysis did not fully complete');
assert.ok(js.includes('AI analysis did not complete'), 'partial results page clearly says the analysis did not complete');

[
  'renderAiVerdictTab',
  'renderAiFactorsSection',
  'renderAiValueCards',
  'renderAiReviewCards',
  'renderAiVerificationTab',
  'renderAiSpecsTab',
  'renderAiRisksTab'
].forEach(name => {
  assert.ok(
    !functionBlock(name).includes('readableStageHtml'),
    `${name} renders template slots from mapped report data instead of dumping raw AI narrative`
  );
});

console.log('ai results page tests passed');
