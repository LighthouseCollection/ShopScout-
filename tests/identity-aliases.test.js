'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);

for (const relPath of [
  'normalization/libraries/defaultRules.js',
  'normalization/libraries/identityAliases.js',
  'shared/productSpecAccess.js',
  'normalization/matching.js'
]) {
  const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
  vm.runInContext(src, ctx, { filename: relPath });
}

const aliases = ctx.ShopScoutIdentityAliases;
assert.ok(aliases, 'identity alias module registers global API');
assert.strictEqual(aliases.canonicalBrand('Hewlett Packard'), 'HP',
  'brand aliases canonicalize legacy vendor names');
assert.strictEqual(aliases.canonicalBrand('Micro-Star International'), 'MSI',
  'brand aliases canonicalize manufacturer legal names');
assert.strictEqual(aliases.canonicalRetailer('AMZN Marketplace'), 'Amazon',
  'retailer aliases canonicalize marketplace labels');
assert.strictEqual(
  aliases.retailerFromUrl('https://www.bestbuy.com/site/example/123.p'),
  'Best Buy',
  'retailer aliases infer retailer from host names'
);

const score = ctx.ShopScoutMatching.scorePair(
  { title: 'HP LaserJet Pro 4001', brand: 'Hewlett Packard', modelNumber: '4001' },
  { title: 'LaserJet Pro 4001 Printer', brand: 'HP', modelNumber: '4001' }
);
assert.ok(score.evidence.includes('brand/manufacturer match'),
  'duplicate matcher uses canonical brand aliases');

console.log('identity-aliases.test.js: all assertions passed');
