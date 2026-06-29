const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'comparison.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'comparison.js'), 'utf8');
const gridJs = fs.readFileSync(path.join(__dirname, '..', 'grid-rebuild-codex', 'shopscoutGrid.js'), 'utf8');

assert.ok(html.includes('id="productSearchInput"'), 'product page exposes a product search input');
assert.ok(html.includes('id="productSearchScope"'), 'product page exposes a search scope dropdown');
assert.ok(
  /<option value="current" selected>Current list<\/option>/i.test(html),
  'product search defaults to the current list'
);
assert.ok(/<option value="all">All lists<\/option>/i.test(html), 'product search can search across all lists');

assert.ok(js.includes('function getSearchableProductText'), 'comparison script builds searchable product text');
assert.ok(js.includes('function activateProductListForAction'), 'cross-list product actions switch to the owning list first');
assert.ok(gridJs.includes('function applySearch'), 'Codex grid applies the product search query');
assert.ok(gridJs.includes("scope === 'all'"), 'Codex grid handles all-list search scope');

console.log('product search tests passed');
