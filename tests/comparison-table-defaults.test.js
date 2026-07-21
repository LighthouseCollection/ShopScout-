/* Task 11 Phase 2: the Tabulator + PivotTable.js grid layer stays
   removed, and the Codex SlickGrid-backed grid now owns #productGrid.
   This test pins the cleanup boundary plus the new live grid shell. */
const assert = require('assert');
const { read, pageAndStyles } = require('./_helpers');

const source = read('comparison.js');
const html = pageAndStyles('comparison.html', 'comparison.css');
const cmpHtml = read('comparison.html');
const css = read('comparison.css');
const gridSource = read('grid-rebuild-codex/shopscoutGrid.js');

/* ---- Old grid renderer entry point is gone ------------------ */
assert.ok(!/globalThis\.SSDatabaseView/.test(source),
  'comparison.js no longer references SSDatabaseView (the old grid orchestrator)');
assert.ok(!/Tabulator\(/.test(source),
  'comparison.js does not instantiate Tabulator');

/* ---- renderAll is a one-line delegate to the future grid ---- */
assert.ok(
  /async function renderAll[\s\S]{0,500}ShopScoutGrid/.test(source),
  'renderAll delegates to globalThis.ShopScoutGrid (the new-grid mount point)'
);
assert.ok(
  /async function renderAll[\s\S]{0,500}flushProductRepoMirror[\s\S]{0,500}grid\.render/.test(source),
  'renderAll flushes pending productRepo mirrors before the grid reads IndexedDB'
);

/* ---- Old grid HTML is gone ---------------------------------- */
assert.ok(!cmpHtml.includes('id="dbView"'),       '#dbView is removed');
assert.ok(!cmpHtml.includes('id="dbViewGrid"'),   '#dbViewGrid is removed');
assert.ok(!cmpHtml.includes('id="dbViewPivot"'),  '#dbViewPivot is removed');
assert.ok(!cmpHtml.includes('id="dbViewInvert"'), '#dbViewInvert is removed');
assert.ok(!cmpHtml.includes('data-db-mode='),     'data-db-mode toggles are removed');
assert.ok(!cmpHtml.includes('id="dbGroupBy"'),    '#dbGroupBy ribbon select is removed');
assert.ok(!cmpHtml.includes('id="dbColumnsBtn"'), '#dbColumnsBtn ribbon trigger is removed');
assert.ok(!cmpHtml.includes('id="dbClearFiltersBtn"'), '#dbClearFiltersBtn is removed');
assert.ok(!cmpHtml.includes('id="savedViewSelect"'),   '#savedViewSelect is removed');
assert.ok(!cmpHtml.includes('id="saveCurrentViewBtn"'),'#saveCurrentViewBtn is removed');
assert.ok(!cmpHtml.includes('id="deleteCurrentViewBtn"'),'#deleteCurrentViewBtn is removed');

/* ---- Old grid modals (Filter/Columns/ColumnOrder/Freeze/Group) are gone --- */
for (const id of ['filterModal', 'columnsModal', 'columnOrderModal', 'freezeModal', 'groupingModal']) {
  assert.ok(!cmpHtml.includes(`id="${id}"`), `${id} shell is removed`);
}

/* ---- Vendor script tags for the grid stack are gone --------- */
assert.ok(!cmpHtml.includes('vendor/tabulator.min.js'),  'Tabulator vendor JS unloaded');
assert.ok(!cmpHtml.includes('vendor/tabulator.min.css'), 'Tabulator vendor CSS unloaded');
assert.ok(!cmpHtml.includes('vendor/pivot.min.js'),      'PivotTable vendor JS unloaded');
assert.ok(!cmpHtml.includes('vendor/pivot.min.css'),     'PivotTable vendor CSS unloaded');
assert.ok(!cmpHtml.includes('vendor/jquery.min.js'),     'jQuery vendor JS unloaded');
assert.ok(!cmpHtml.includes('vendor/jquery-ui.min.js'),  'jQuery UI vendor JS unloaded');

/* ---- The grid script wiring (comparison-db.js + table/) is gone --- */
assert.ok(!cmpHtml.includes('src="comparison-db.js"'), 'comparison-db.js script tag removed');
assert.ok(!cmpHtml.includes('src="table/'),            'no table/ script tags remain');
assert.ok(!cmpHtml.includes('src="data/cellFormatters.js"'),
  'data/cellFormatters.js script tag removed');

/* ---- The reusable extractions ship as shared/ --------------- */
assert.ok(cmpHtml.includes('src="shared/values/cellValues.js"'),
  'shared/values/cellValues.js is loaded for the new grid');
assert.ok(cmpHtml.indexOf('src="normalization/libraries/defaultRules.js"') > -1,
  'normalization rule library is loaded on comparison page');
assert.ok(cmpHtml.indexOf('src="normalization/libraries/defaultRules.js"') < cmpHtml.indexOf('src="normalization/registry.js"'),
  'normalization rule library loads before v2 normalization on comparison page');
assert.ok(cmpHtml.indexOf('src="normalization/libraries/identityAliases.js"') > -1,
  'identity alias helper is loaded on comparison page');
assert.ok(cmpHtml.indexOf('src="normalization/libraries/defaultRules.js"') < cmpHtml.indexOf('src="normalization/libraries/identityAliases.js"'),
  'identity aliases load after default rules on comparison page');
assert.ok(cmpHtml.indexOf('src="normalization/libraries/identityAliases.js"') < cmpHtml.indexOf('src="normalization/matching.js"'),
  'identity aliases load before duplicate matching on comparison page');
assert.ok(cmpHtml.indexOf('src="normalization/taxonomyBridge.js"') > -1,
  'normalization/taxonomyBridge.js is loaded on comparison page');
assert.ok(cmpHtml.indexOf('src="normalization/taxonomyBridge.js"') < cmpHtml.indexOf('src="normalization/registry.js"'),
  'taxonomy bridge loads before v2 normalization on comparison page');
assert.ok(!cmpHtml.includes('src="normalization/attributes.js"'),
  'comparison page no longer loads retired attribute normalization sidecar');
assert.ok(cmpHtml.indexOf('src="normalization/normalize.js"') > -1,
  'normalization/normalize.js is loaded on comparison page');
assert.ok(cmpHtml.indexOf('src="normalization/normalize.js"') < cmpHtml.indexOf('src="data/productRepo.js"'),
  'v2 normalization loads before productRepo on comparison page');
assert.ok(cmpHtml.indexOf('src="shared/productSpecAccess.js"') > -1,
  'ProductSpec access helpers are loaded on comparison page');
assert.ok(cmpHtml.indexOf('src="shared/productSpecAccess.js"') < cmpHtml.indexOf('src="normalization/matching.js"'),
  'ProductSpec access helpers load before matching on comparison page');
assert.ok(cmpHtml.indexOf('src="normalization/matching.js"') > -1,
  'normalization/matching.js is loaded on comparison page');
assert.ok(cmpHtml.indexOf('src="normalization/matching.js"') < cmpHtml.indexOf('src="data/productRepo.js"'),
  'dedupe matching loads before productRepo on comparison page');
assert.ok(cmpHtml.indexOf('src="normalization/review.js"') > -1,
  'normalization review collector is loaded on comparison page');
assert.ok(cmpHtml.includes('src="shared/projections/specProjection.js"'),
  'shared/projections/specProjection.js is loaded for the new grid');
assert.ok(cmpHtml.includes('src="shared/edits/ratingWriter.js"'),
  'shared/edits/ratingWriter.js is loaded for the new grid');

/* ---- Phase 2 grid mount point exists ------------------------ */
assert.ok(cmpHtml.includes('id="productGrid"'),
  '#productGrid mount point exists for the Phase 2 grid');
assert.ok(cmpHtml.includes('id="ssGridHost"'),
  'Codex grid host exists inside #productGrid');
assert.ok(!cmpHtml.includes('data-ss-grid-mode'),
  'developer mode toggles are not exposed in the dashboard body');
assert.ok(!cmpHtml.includes('data-ss-grid-matrix'),
  'developer matrix depth toggles are not exposed in the dashboard body');
assert.ok(/setMode\(mode\)/.test(gridSource),
  'products-as-rows / matrix mode remains available through the grid API');
assert.ok(/setMatrixMode\(mode\)/.test(gridSource),
  'basic / detailed matrix depth remains available through the grid API');
assert.ok(!/Product grid is being rebuilt/.test(cmpHtml),
  'Phase 1 rebuild placeholder is removed');
assert.ok(cmpHtml.includes('src="grid-rebuild-codex/shopscoutGrid.js"'),
  'Codex grid orchestrator is loaded');
assert.ok(!cmpHtml.includes('grid-rebuild-claude/'),
  'Codex branch does not load Claude fork scripts');

/* ---- Old Tabulator/Pivot CSS rules are gone ----------------- */
assert.ok(!/\.tabulator/.test(css), 'no .tabulator CSS rules remain');
assert.ok(!/\.pvtUi/.test(css),     'no PivotTable.js .pvtUi CSS rules remain');

/* ---- AI results / detail / settings / feedback flows are preserved --- */
assert.ok(cmpHtml.includes('id="content"'),       '#content (info pages + detail + AI results host) preserved');
assert.ok(cmpHtml.includes('src="settings.js"'),  'settings module is loaded for inline dashboard settings');
assert.ok(!cmpHtml.includes('id="settingsFrame"'), 'settings iframe is removed');
assert.ok(cmpHtml.includes('id="aiResultsPage"'), 'AI results page preserved');
assert.ok(cmpHtml.includes('id="productDetail"'), 'product detail page preserved');
assert.ok(!cmpHtml.includes('id="manualAiModal"'), 'old separate manual AI iframe modal is removed');

void html; // pageAndStyles is consumed by the CSS-rule assertions above
console.log('comparison-table-defaults.test.js: all assertions passed');
