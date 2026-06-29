const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'comparison.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'comparison.js'), 'utf8');

assert.ok(html.includes('id="productSearchInput"'), 'product page exposes a product search input');
assert.ok(html.includes('id="productSearchScope"'), 'product page exposes a search scope dropdown');
assert.ok(
  /<option value="current" selected>Current list<\/option>/i.test(html),
  'product search defaults to the current list'
);
assert.ok(/<option value="all">All lists<\/option>/i.test(html), 'product search can search across all lists');

assert.ok(js.includes('function getSearchableProductText'), 'comparison script builds searchable product text');
assert.ok(js.includes('function collectProductSearchItems'), 'comparison script can collect products from current or all lists');
assert.ok(js.includes('function productMatchesSearch'), 'comparison script filters products by search terms');
assert.ok(js.includes('function activateProductListForAction'), 'cross-list product actions switch to the owning list first');
assert.ok(js.includes('data-list="${escAttr(location.listName)}"'), 'rendered product rows/cards carry their owning list name');
assert.ok(js.includes('No products match'), 'search has a specific empty state');

console.log('product search tests passed');
