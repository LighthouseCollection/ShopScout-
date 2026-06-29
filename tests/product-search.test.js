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
assert.ok(js.includes('function activateProductListForAction'), 'cross-list product actions switch to the owning list first');
/* productMatchesSearch / collectProductSearchItems were the legacy
   client-side filter and cross-list collector for the hand-rolled
   cards/table renderers. Task 8 deleted those renderers and the
   helpers that fed them; cross-list search will be re-wired to the
   Database view (Tabulator) in a follow-up task. The DOM controls
   (#productSearchInput, #productSearchScope, the scope options)
   stay so the UI remains in place for that follow-up. */

console.log('product search tests passed');
