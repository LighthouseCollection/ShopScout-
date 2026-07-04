const assert = require('assert');
const { read } = require('./_helpers');

const source = read('comparison.js');
const match = source.match(/async function deleteSelectedProducts\(\) \{([\s\S]*?)\n\}/);

assert.ok(match, 'deleteSelectedProducts function exists');

const body = match[1];
const confirmIndex = body.indexOf('ShopScoutUI.confirm');
const spliceIndex = body.indexOf('products.splice');

assert.ok(confirmIndex >= 0, 'deleteSelectedProducts asks for confirmation');
assert.ok(spliceIndex >= 0, 'deleteSelectedProducts still removes products after confirmation');
assert.ok(confirmIndex < spliceIndex, 'deleteSelectedProducts confirms before removing products');
assert.ok(/if\s*\(!proceed\)\s*return/.test(body),
  'deleteSelectedProducts exits without deleting when confirmation is cancelled');

console.log('delete-safety.test.js: all assertions passed');
