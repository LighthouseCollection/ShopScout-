/* Wiring/structural tests for the Tabulator + PivotTable database view.
   We can't actually instantiate Tabulator without a DOM, so this test asserts
   the integration points exist where comparison.js / comparison-db.js expect. */
const assert = require('assert');
const { read, pageAndStyles } = require('./_helpers');

const html = pageAndStyles('comparison.html', 'comparison.css');
const dbJs = read('comparison-db.js');
const cmpJs = read('comparison.js');

/* HTML wiring */
/* The Database view is the default + only product view now, so it no longer
   needs a data-view toggle button — the View ribbon's Grid/Pivot buttons
   only switch mode within the already-active Database view. */
assert.ok(!html.includes('data-view="database"'),    'No data-view="database" — Database is the only product view');
assert.ok(html.includes('id="dbView"'),              'Database section container exists');
assert.ok(html.includes('id="dbViewGrid"'),          'Tabulator grid container exists');
assert.ok(html.includes('id="dbViewPivot"'),         'PivotTable.js container exists');
assert.ok(html.includes('data-db-mode="grid"'),      'Grid mode toggle exists');
assert.ok(html.includes('data-db-mode="pivot"'),     'Pivot mode toggle exists');
assert.ok(html.includes('id="savedViewSelect"'),     'Saved view dropdown exists');
assert.ok(html.includes('id="saveCurrentViewBtn"'),  'Save-current-view button exists');
assert.ok(html.includes('id="deleteCurrentViewBtn"'),'Delete-saved-view button exists');

/* Vendor script loading order */
const htmlOnly = read('comparison.html');
const dexieIdx     = htmlOnly.indexOf('vendor/dexie.min.js');
const dataIdx      = htmlOnly.indexOf('data/productRepo.js');
const tableIdx     = htmlOnly.indexOf('table/myRating.js');
const utilsIdx     = htmlOnly.indexOf('utils.js');
const cmpIdx       = htmlOnly.indexOf('comparison.js');
const dbViewIdx    = htmlOnly.indexOf('comparison-db.js');
assert.ok(dexieIdx > 0 && dexieIdx < dataIdx,  'Dexie loads before data/');
assert.ok(dataIdx  < utilsIdx,                  'data/ layer loads before utils.js');
assert.ok(tableIdx > dataIdx && tableIdx < cmpIdx, 'table modules load before comparison.js');
assert.ok(utilsIdx < cmpIdx,                    'utils.js loads before comparison.js');
assert.ok(cmpIdx   < dbViewIdx,                 'comparison.js loads before comparison-db.js');

/* JS wiring */
assert.ok(cmpJs.includes("let currentView = 'database'"), 'Database view is the default and only view');
assert.ok(cmpJs.includes('SSDatabaseView.render'),         'renderAll delegates to SSDatabaseView.render');
assert.ok(cmpJs.includes('SS.bootstrapDataLayer'),         'comparison.js calls bootstrapDataLayer on init');

assert.ok(dbJs.includes('SSProductRepo'),               'comparison-db.js uses SSProductRepo');
assert.ok(dbJs.includes('SSViewsRepo'),                 'comparison-db.js uses SSViewsRepo');
assert.ok(dbJs.includes('root.SSDatabaseView'),         'comparison-db.js exposes SSDatabaseView');
assert.ok(dbJs.includes('Tabulator'),                   'comparison-db.js wires Tabulator');
assert.ok(dbJs.includes('pivotUI'),                     'comparison-db.js wires PivotTable.js');
assert.ok(dbJs.includes('repo.query'),                  'comparison-db.js reads via repo.query');
assert.ok(dbJs.includes('Table.myRating'),              'comparison-db.js delegates my-rating work to table/myRating.js');
assert.ok(!dbJs.includes('repo.updateProduct(id, { userRating: v });'), 'my-rating quick edit does not use the legacy no-revision write path');

console.log('db-view-wiring.test.js: 25 assertions passed');
