const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { read } = require('../../tests/_helpers');

const html = read('comparison.html');
const gridCss = read('grid-rebuild-codex/grid.css');
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
assert.ok(gridCss.includes('.ss-grid-header-thumb') && gridCss.includes('width: 100px'),
  'compare headers reserve a 100px-wide thumbnail area');
assert.ok(!gridCss.includes('#eaeaea'),
  'grid overrides do not use the darker #eaeaea alternating row color');
assert.ok(/\.ss-grid-host \.slick-row\.odd[\s\S]{0,80}background:\s*#f5f5f5/.test(gridCss),
  'odd alternating grid rows use the requested #f5f5f5 background');
assert.ok(!gridCss.includes('#e5e7eb'),
  'grid border fallbacks use #d1d5db instead of #e5e7eb');
assert.ok(/\.ss-grid-host \.slick-cell[\s\S]{0,180}align-items:\s*center/.test(gridCss),
  'grid cells vertically center their contents');
assert.ok(/\.ss-grid-host \.slick-cell[\s\S]{0,220}justify-content:\s*center/.test(gridCss),
  'grid cells horizontally center their contents by default');
assert.ok(/\.ss-grid-host \.slick-cell\.ss-grid-cell-title[\s\S]{0,180}justify-content:\s*flex-start/.test(gridCss),
  'product-name cells keep the title wrapper left aligned');
assert.ok(/\.ss-grid-host \.slick-cell\.ss-grid-cell-title[\s\S]{0,220}text-align:\s*left/.test(gridCss),
  'product-name cells keep product names left aligned');
assert.ok(/\.ss-grid-logo-token[\s\S]{0,320}text-decoration:\s*none/.test(gridCss),
  'source and brand logo tokens suppress link underlines');
assert.ok(/\.ss-grid-logo-token[\s\S]{0,360}max-width:\s*80px/.test(gridCss),
  'source and brand text tokens are capped without image sizing');
assert.ok(!gridCss.includes('.ss-grid-logo-img'),
  'grid CSS does not define logo image rules');
assert.ok(/\.ss-grid-title-text[\s\S]{0,260}-webkit-line-clamp:\s*2/.test(gridCss),
  'product-name text uses a dedicated two-line title wrapper instead of being clipped by the cell');
assert.ok(/\.ss-grid-column-list[\s\S]{0,220}grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(240px,\s*1fr\)\)/.test(gridCss),
  'columns modal lays field groups out across multiple columns');
assert.ok(/\.ss-grid-column-letter[\s\S]{0,180}letter-spacing:\s*0\.08em/.test(gridCss),
  'columns modal has alphabet letter headers for grouped fields');
assert.ok(/\.ss-grid \.slick-row\.slick-group \.slick-cell[\s\S]{0,180}padding:\s*14px 12px 6px/.test(gridCss),
  'native grouping rows keep top spacing while reducing bottom padding');
assert.ok(/\.ss-grid-group-title[\s\S]{0,160}font-weight:\s*700/.test(gridCss),
  'native grouping titles are bold');

for (const logoName of ['amazon.svg', 'logitech.svg', 'microsoft.svg', 'newegg.svg']) {
  assert.ok(!fs.existsSync(path.join(root, 'logos', logoName)), `${logoName} is removed from the local logo cache`);
}

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
assert.ok(buildScript.includes("'logos'"),
  'extension build copies the reserved logos directory into browser dists');
assert.ok(fs.existsSync(path.join(root, 'logos', 'README.md')),
  'logos directory documents that image cache is disabled');
assert.ok(!fs.readdirSync(path.join(root, 'logos')).some(name => name.toLowerCase().endsWith('.svg')),
  'logos directory has no cached SVG image files');

console.log('grid-codex-wiring.test.js: all assertions passed');
