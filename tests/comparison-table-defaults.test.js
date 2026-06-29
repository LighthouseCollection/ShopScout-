/* The hand-rolled Cards/Table views were retired in favor of the Database view
   (Tabulator + PivotTable.js, backed by SSProductRepo). Task 8 took the final
   step: the legacy renderers and their state vars are GONE (not no-ops).
   This test pins the cleaned-up contract. */
const assert = require('assert');
const { read, pageAndStyles } = require('./_helpers');

const source = read('comparison.js');
const html = pageAndStyles('comparison.html', 'comparison.css');
const dbJs = read('comparison-db.js');
const cmpHtml = read('comparison.html');

/* Legacy view-state vars are GONE -------------------------------- */
assert.ok(!/^\s*let currentView\b/m.test(source),
  'currentView view-toggle flag is removed (Database is the only view)');
assert.ok(!/^\s*let compactMode\b/m.test(source),
  'compactMode toggle is removed (Tabulator owns visual density)');
assert.ok(!/^\s*let gridlinesEnabled\b/m.test(source),
  'gridlinesEnabled toggle is removed');
assert.ok(!/^\s*let tableSortCol\b/m.test(source) && !/^\s*let tableSortAsc\b/m.test(source),
  'tableSortCol/tableSortAsc are removed (Tabulator headers sort)');
assert.ok(!/^\s*let selectedOnlyFilter\b/m.test(source) && !/^\s*let notedOnlyFilter\b/m.test(source),
  'selectedOnlyFilter / notedOnlyFilter are removed (Tabulator header filters)');

/* Legacy renderers are GONE -------------------------------------- */
assert.ok(!/function renderCards\b/.test(source),
  'renderCards is removed (was a guarded no-op in the transitional state)');
assert.ok(!/function renderTable\b/.test(source),
  'renderTable is removed (was a guarded no-op in the transitional state)');

/* The old view-toggle HTML buttons are also gone ----------------- */
assert.ok(!cmpHtml.includes('data-view="cards"'),
  'Cards view-toggle button is removed from the ribbon');
assert.ok(!cmpHtml.includes('data-view="table"'),
  'Table view-toggle button is removed from the ribbon');
assert.ok(!cmpHtml.includes('data-command="toggle-compact"'),
  'Compact toggle is removed from the ribbon');
assert.ok(!cmpHtml.includes('data-command="toggle-gridlines"'),
  'Gridlines toggle is removed from the ribbon');

/* renderAll delegates straight to the Database view -------------- */
assert.ok(
  /async function renderAll[\s\S]{0,400}SSDatabaseView\.render\b/.test(source),
  'renderAll delegates straight to SSDatabaseView.render and returns'
);
assert.ok(
  !/function renderAll[\s\S]{0,600}renderCards|function renderAll[\s\S]{0,600}renderTable/.test(source),
  'renderAll has no path back into the deleted renderers'
);

/* Old compact/gridline product-view CSS is GONE ------------------ */
const css = read('comparison.css');
assert.ok(!/body\.compact-mode\b/.test(css),
  'compact-mode CSS rules are removed (legacy card/table only)');
assert.ok(!/body\.no-gridlines\b/.test(css),
  'no-gridlines CSS rules are removed (legacy table only)');

/* #content stays — info pages, product detail, AI results page,
   and feedback page render into it. The transitional
   "legacy-unused" class is gone now that the container plays an
   active role. */
assert.ok(!cmpHtml.includes('content--legacy-unused'),
  '#content no longer carries the legacy-unused marker');
assert.ok(/<div\s+class="content"\s+id="content"/.test(cmpHtml),
  '#content remains for AI results / detail / info pages');

/* Database section IS visible by default ----------------------- */
assert.ok(/<section[^>]*id="dbView"(?![^>]*\bhidden\b)/.test(cmpHtml),
  '#dbView no longer carries a hidden attribute (it is the only view)');

/* Database view boots on DOMContentLoaded ---------------------- */
assert.ok(dbJs.includes('async function boot') && dbJs.includes('show();'),
  'comparison-db.js boots and shows the Database view on load');

/* View ribbon hosts the actual table controls. */
assert.ok(cmpHtml.includes('id="dbGroupBy"'),       'View ribbon hosts the Group-by select');
assert.ok(cmpHtml.includes('id="dbColumnsBtn"'),    'View ribbon hosts the Columns dropdown trigger');
assert.ok(cmpHtml.includes('id="dbClearFiltersBtn"'),'View ribbon hosts the Clear-filters button');
assert.ok(cmpHtml.includes('id="savedViewSelect"'), 'View ribbon hosts the Saved-view select');

console.log('comparison-table-defaults.test.js: all assertions passed');
