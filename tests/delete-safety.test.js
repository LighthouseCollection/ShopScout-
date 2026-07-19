const assert = require('assert');
const { read } = require('./_helpers');

const source = read('comparison.js');
const match = source.match(/async function deleteSelectedProducts\(\) \{([\s\S]*?)\n\}/);

assert.ok(match, 'deleteSelectedProducts function exists');

const body = match[1];
const confirmIndex = body.indexOf('ShopScoutUI.confirm');
const spliceIndex = body.indexOf('products.splice');

assert.equal(confirmIndex, -1, 'deleteSelectedProducts does not ask for confirmation');
assert.ok(spliceIndex >= 0, 'deleteSelectedProducts still removes selected products');
assert.ok(!/if\s*\(!proceed\)\s*return/.test(body),
  'deleteSelectedProducts does not include a canceled-confirmation branch');

console.log('delete-safety.test.js: all assertions passed');
