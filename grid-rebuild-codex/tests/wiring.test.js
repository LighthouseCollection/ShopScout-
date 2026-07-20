const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { read } = require('../../tests/_helpers');

const html = read('comparison.html');
const gridCss = read('grid-rebuild-codex/grid.css');
const adapterJs = read('grid-rebuild-codex/agGridAdapter.js');
const buildScript = read('scripts/build-extension.ps1');
const root = path.join(__dirname, '..', '..');

function indexOfRequired(value, label) {
  const idx = html.indexOf(value);
  assert.ok(idx >= 0, `${label} is loaded by comparison.html`);
  return idx;
}

assert.ok(html.includes('id="productGrid"'), '#productGrid mount point exists');
assert.ok(!html.includes('Product grid is being rebuilt.'),
  'Phase 2 replaces the rebuild placeholder with the live grid shell');
assert.ok(!html.includes('data-ss-grid-mode'),
  'developer grid mode toggles are not exposed in the dashboard body');
assert.ok(!html.includes('data-ss-grid-matrix'),
  'developer matrix depth toggles are not exposed in the dashboard body');
assert.ok(html.includes('data-ss-grid-command="mode-rows"'),
  'View ribbon exposes products-as-rows layout control');
assert.ok(html.includes('data-ss-grid-command="mode-matrix"'),
  'View ribbon exposes compare matrix layout control');
assert.ok(html.includes('data-ss-grid-sort-field'),
  'View ribbon exposes grid sorting field picker');
assert.ok(html.includes('data-ss-grid-command="open-filters"'),
  'View ribbon exposes filter modal command');
assert.ok(html.includes('data-ss-grid-group-field'),
  'View ribbon exposes grouping field picker');
assert.ok(html.includes('data-ss-grid-command="open-columns"'),
  'View ribbon exposes columns chooser command');
assert.ok(html.includes('data-ss-price-display-mode') && html.includes('Rounded to nearest $5'),
  'Products Normalization group exposes the price display dropdown with nearest-$5 rounding');
assert.ok(html.includes('data-ss-grid-command="toggle-measurement-display"'),
  'Products Review & Rules group exposes the rounded/actual measurement display toggle');
assert.ok(!adapterJs.includes('getMainMenuItems'),
  'AG Grid adapter does not register getMainMenuItems because the UMD Community build does not include ColumnMenu');
assert.ok(adapterJs.includes('openNativeFilter') && read('grid-rebuild-codex/shopscoutGrid.js').includes('openColumnsModal'),
  'filter and column workflows stay outside the unavailable AG Grid ColumnMenu hook');
assert.ok(adapterJs.includes('formatMeasurementText') && adapterJs.includes('measurementDisplayMode'),
  'AG Grid adapter can render rounded measurements from display-mode state');
assert.ok(gridCss.includes('.ss-grid-header-thumb') && gridCss.includes('width: 100px'),
  'compare headers reserve a 100px-wide thumbnail area');
assert.ok(!gridCss.includes('#eaeaea'),
  'grid overrides do not use the darker #eaeaea alternating row color');
assert.ok(!gridCss.includes('#e5e7eb'),
  'grid border fallbacks use #d1d5db instead of #e5e7eb');
/* Cell centering, cell padding, alternating row color, browser
   text selection etc. are all handled by the stock quartz theme
   now (vendor/ag-grid/ag-theme-quartz.min.css). Our override
   layer only asserts that Name and Buying Factor stay
   left-aligned — those are functional keeps for our data model. */
assert.ok(/\.ag-cell\.ss-grid-cell-title[\s\S]{0,180}justify-content:\s*flex-start/.test(gridCss),
  'Name column keeps left-alignment inside quartz');
assert.ok(/\.ag-cell\.ss-grid-cell-title[\s\S]{0,220}text-align:\s*left/.test(gridCss),
  'Name column keeps text-align: left inside quartz');
assert.ok(/\.ag-cell\.ss-grid-cell-attribute[\s\S]{0,220}justify-content:\s*flex-start/.test(gridCss),
  'Buying Factor column keeps left-alignment inside quartz');
assert.ok(/\.ss-grid-logo-token[\s\S]{0,320}text-decoration:\s*none/.test(gridCss),
  'source and brand logo tokens suppress link underlines');
assert.ok(!/a\.ss-grid-logo-token[\s\S]{0,180}border-bottom:\s*0/.test(gridCss),
  'source link logo tokens keep their full pill border including the bottom edge');
assert.ok(/\.ss-grid-logo-token[\s\S]{0,360}max-width:\s*100%/.test(gridCss),
  'source and brand text tokens honor their auto-sized column width without a hardcoded pixel cap');
assert.ok(!gridCss.includes('.ss-grid-logo-img'),
  'grid CSS does not define logo image rules');
assert.ok(/\.ss-grid-title-text[\s\S]{0,260}-webkit-line-clamp:\s*2/.test(gridCss),
  'product-name text uses a dedicated two-line title wrapper instead of being clipped by the cell');
assert.ok(/\.ss-grid-column-list[\s\S]{0,220}column-count:\s*3/.test(gridCss),
  'columns modal uses masonry-style columns so alphabet headers do not leave uneven top gaps');
assert.ok(/\.ss-grid-column-group[\s\S]{0,220}break-inside:\s*avoid/.test(gridCss),
  'columns modal keeps each alphabet group intact inside a masonry column');
assert.ok(/\.ss-grid-column-letter[\s\S]{0,180}letter-spacing:\s*0\.08em/.test(gridCss),
  'columns modal has alphabet letter headers for grouped fields');
assert.ok(/\.ss-grid-group-title[\s\S]{0,160}font-weight:\s*700/.test(gridCss),
  'native grouping titles are bold');
assert.ok(gridCss.includes('.ss-grid-group-label'),
  'native grouping title includes an explicit Group label element');
assert.ok(/\.ss-grid-action-btn[\s\S]{0,360}user-select:\s*none/.test(gridCss),
  'icon action buttons opt out of text selection while data cells remain selectable');

for (const logoName of ['amazon.svg', 'logitech.svg', 'microsoft.svg', 'newegg.svg']) {
  assert.ok(!fs.existsSync(path.join(root, 'logos', logoName)), `${logoName} is removed from the local logo cache`);
}

const codexCssIndex = indexOfRequired('grid-rebuild-codex/grid.css', 'Codex grid CSS');
const agGridCssIndex = indexOfRequired('vendor/ag-grid/ag-grid.min.css', 'AG Grid core CSS');
assert.ok(agGridCssIndex < codexCssIndex, 'Codex grid CSS loads after AG Grid CSS so shopscout theme overrides win');

const agGridScriptIndex = indexOfRequired('src="vendor/ag-grid/ag-grid-community.min.js"', 'AG Grid vendor bundle');

const stateIndex = indexOfRequired('src="grid-rebuild-codex/state.js"', 'Codex grid state');
const projectionIndex = indexOfRequired('src="grid-rebuild-codex/projections.js"', 'Codex grid projections');
const adapterIndex = indexOfRequired('src="grid-rebuild-codex/agGridAdapter.js"', 'Codex AG Grid adapter');
const gridIndex = indexOfRequired('src="grid-rebuild-codex/shopscoutGrid.js"', 'Codex grid orchestrator');
const comparisonIndex = indexOfRequired('src="comparison.js"', 'comparison.js');

assert.ok(agGridScriptIndex < adapterIndex,
  'Codex AG Grid adapter loads after the AG Grid vendor bundle');
assert.ok(stateIndex < gridIndex, 'state store loads before the grid orchestrator');
assert.ok(projectionIndex < gridIndex, 'projection helpers load before the grid orchestrator');
assert.ok(adapterIndex < gridIndex, 'AG Grid adapter loads before the grid orchestrator');
assert.ok(gridIndex < comparisonIndex, 'ShopScoutGrid is registered before comparison.js init runs');

assert.ok(buildScript.includes("'grid-rebuild-codex'"),
  'extension build copies the Codex grid directory into browser dists');
assert.ok(buildScript.includes("'logos'"),
  'extension build copies the reserved logos directory into browser dists');
assert.ok(fs.existsSync(path.join(root, 'logos', 'README.md')),
  'logos directory documents that image cache is disabled');
assert.ok(!fs.readdirSync(path.join(root, 'logos')).some(name => name.toLowerCase().endsWith('.svg')),
  'logos directory has no cached SVG image files');

console.log('grid-codex-wiring.test.js: all assertions passed');
