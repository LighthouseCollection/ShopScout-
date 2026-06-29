/* The hand-rolled Cards/Table views were retired in favor of the Database view
   (Tabulator + PivotTable.js, backed by SSProductRepo). This test pins the new
   contract: Database is the default and only view, the old view-toggle buttons
   are gone, and the old renderers are guarded no-ops. */
const assert = require('assert');
const { read, pageAndStyles } = require('./_helpers');

const source = read('comparison.js');
const html = pageAndStyles('comparison.html', 'comparison.css');
const dbJs = read('comparison-db.js');

/* Default view ------------------------------------------------- */
assert.ok(
  source.includes("let currentView = 'database';"),
  'dashboard opens directly in Database view (no view selection needed)'
);

/* The old view-toggle buttons are gone from the ribbon ---------- */
assert.ok(!read('comparison.html').includes('data-view="cards"'),
  'Cards view-toggle button is removed from the ribbon');
assert.ok(!read('comparison.html').includes('data-view="table"'),
  'Table view-toggle button is removed from the ribbon');
assert.ok(!read('comparison.html').includes('data-command="toggle-compact"'),
  'Compact toggle is removed from the ribbon');
assert.ok(!read('comparison.html').includes('data-command="toggle-gridlines"'),
  'Gridlines toggle is removed from the ribbon');

/* The legacy modal triggers are gone --------------------------- */
const cmpHtml = read('comparison.html');
assert.ok(!cmpHtml.includes('data-command="add-filter"'),
  'Add-filter ribbon button is removed (Tabulator header filters replace it)');
assert.ok(!cmpHtml.includes('data-command="show-columns"'),
  'Columns ribbon button is removed (Tabulator column menu replaces it)');
assert.ok(!cmpHtml.includes('data-command="open-group-modal"'),
  'Group-by ribbon button is removed (Tabulator native grouping replaces it)');
assert.ok(!cmpHtml.includes('data-command="open-freeze-modal"'),
  'Freeze-columns ribbon button is removed');
assert.ok(!cmpHtml.includes('data-command="open-column-order-modal"'),
  'Column-order ribbon button is removed');

/* renderAll short-circuits to Database view -------------------- */
assert.ok(
  /async function renderAll[\s\S]{0,400}SSDatabaseView/.test(source),
  'renderAll delegates straight to SSDatabaseView.render and returns'
);

/* Old renderers exist but are guarded no-ops ------------------- */
const cardsFn = source.slice(source.indexOf('function renderCards'), source.indexOf('function renderTable'));
assert.ok(/function renderCards[\s\S]{0,300}return;/.test(cardsFn),
  'renderCards is a guarded no-op (LEGACY)');
const tableFn = source.slice(source.indexOf('function renderTable'), source.indexOf('function renderTable') + 400);
assert.ok(/function renderTable[\s\S]{0,300}return;/.test(tableFn),
  'renderTable is a guarded no-op (LEGACY)');

/* Legacy #content container is hidden via CSS, not removed ----- */
assert.ok(cmpHtml.includes('content--legacy-unused'),
  '#content keeps its DOM presence (AI results page hooks) but is marked legacy-unused');
assert.ok(html.includes('.content--legacy-unused { display: none'),
  'CSS hides the legacy content container');

/* Database section IS visible by default ----------------------- */
assert.ok(/<section[^>]*id="dbView"(?![^>]*\bhidden\b)/.test(cmpHtml),
  '#dbView no longer carries a hidden attribute (it is the only view)');

/* Database view boots on DOMContentLoaded ---------------------- */
assert.ok(dbJs.includes('async function boot') && dbJs.includes('show();'),
  'comparison-db.js boots and shows the Database view on load');

/* View ribbon now hosts the actual table controls (no inline-note text). */
assert.ok(cmpHtml.includes('id="dbGroupBy"'),       'View ribbon hosts the Group-by select');
assert.ok(cmpHtml.includes('id="dbColumnsBtn"'),    'View ribbon hosts the Columns dropdown trigger');
assert.ok(cmpHtml.includes('id="dbClearFiltersBtn"'),'View ribbon hosts the Clear-filters button');
assert.ok(cmpHtml.includes('id="savedViewSelect"'), 'View ribbon hosts the Saved-view select');

console.log('comparison-table-defaults.test.js: 17 assertions passed');
