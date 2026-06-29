const assert = require('assert');
const { read } = require('../../tests/_helpers');

const html = read('comparison.html');
const buildScript = read('scripts/build-extension.ps1');

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

const cssIndex = indexOfRequired('vendor/slickgrid/slick.grid.css', 'SlickGrid core CSS');
const themeIndex = indexOfRequired('vendor/slickgrid/slick-default-theme.css', 'SlickGrid default theme CSS');
const codexCssIndex = indexOfRequired('grid-rebuild-codex/grid.css', 'Codex grid CSS');
assert.ok(cssIndex < codexCssIndex, 'Codex grid CSS loads after SlickGrid CSS');
assert.ok(themeIndex < codexCssIndex, 'Codex grid CSS can override the SlickGrid theme');

const vendorOrder = [
  'vendor/slickgrid/slick.core.js',
  'vendor/slickgrid/slick.interactions.js',
  'vendor/slickgrid/slick.dataview.js',
  'vendor/slickgrid/slick.editors.js',
  'vendor/slickgrid/slick.grid.js',
  'vendor/slickgrid/plugins/slick.rowselectionmodel.js'
].map((src, idx) => indexOfRequired(`src="${src}"`, `SlickGrid vendor script ${idx + 1}`));

for (let i = 1; i < vendorOrder.length; i += 1) {
  assert.ok(vendorOrder[i - 1] < vendorOrder[i], 'SlickGrid vendor scripts load in dependency order');
}

const stateIndex = indexOfRequired('src="grid-rebuild-codex/state.js"', 'Codex grid state');
const projectionIndex = indexOfRequired('src="grid-rebuild-codex/projections.js"', 'Codex grid projections');
const adapterIndex = indexOfRequired('src="grid-rebuild-codex/slickGridAdapter.js"', 'Codex SlickGrid adapter');
const gridIndex = indexOfRequired('src="grid-rebuild-codex/shopscoutGrid.js"', 'Codex grid orchestrator');
const comparisonIndex = indexOfRequired('src="comparison.js"', 'comparison.js');

assert.ok(vendorOrder[vendorOrder.length - 1] < adapterIndex,
  'Codex SlickGrid adapter loads after SlickGrid vendor scripts');
assert.ok(stateIndex < gridIndex, 'state store loads before the grid orchestrator');
assert.ok(projectionIndex < gridIndex, 'projection helpers load before the grid orchestrator');
assert.ok(adapterIndex < gridIndex, 'SlickGrid adapter loads before the grid orchestrator');
assert.ok(gridIndex < comparisonIndex, 'ShopScoutGrid is registered before comparison.js init runs');

assert.ok(buildScript.includes("'grid-rebuild-codex'"),
  'extension build copies the Codex grid directory into browser dists');

console.log('grid-codex-wiring.test.js: all assertions passed');
