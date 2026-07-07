const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rulesSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'libraries', 'defaultRules.js'), 'utf8');
const userRulesSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'userRules.js'), 'utf8');
const attrSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'attributes.js'), 'utf8');
const reviewSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'review.js'), 'utf8');

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(rulesSrc, ctx, { filename: 'normalization/libraries/defaultRules.js' });
vm.runInContext(userRulesSrc, ctx, { filename: 'normalization/userRules.js' });

const userRules = ctx.ShopScoutUserNormalizationRules;
assert.ok(userRules, 'user rules module registers global API');

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(userRules.buildUserRulePatch({
    rawField: 'Connectivity Tech',
    field: 'Connectivity Technology',
    raw: 'Bluetooth LE',
    normalized: 'Bluetooth'
  }))),
  {
    fieldAliases: { 'connectivity technology': ['Connectivity Tech'] },
    canonicalFields: { 'connectivity technology': 'Connectivity Technology' },
    enums: { 'Connectivity Technology': { Bluetooth: ['Bluetooth LE'] } },
    ignored: []
  },
  'review item converts to a deterministic user rule patch'
);

userRules.applyUserRulePatch(userRules.buildUserRulePatch({
  rawField: 'Connectivity Tech',
  field: 'Connectivity Technology',
  raw: 'Bluetooth LE',
  normalized: 'Bluetooth'
}));

vm.runInContext(attrSrc, ctx, { filename: 'normalization/attributes.js' });
const A = ctx.ShopScoutAttributeNormalization;

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(A.normalizeAttribute('Connectivity Tech', 'Bluetooth LE'))),
  {
    field: 'Connectivity Technology',
    raw: 'Bluetooth LE',
    normalized: 'Bluetooth',
    confidence: 1,
    rule: 'user-enum:connectivity-technology:bluetooth'
  },
  'accepted user alias applies to future normalization runs'
);

vm.runInContext(reviewSrc, ctx, { filename: 'normalization/review.js' });
const review = ctx.ShopScoutNormalizationReview;
const ignoredKey = review.reviewItemKey({
  productId: 'p1',
  rawField: 'Supplier Shade',
  field: 'Supplier Shade',
  raw: 'marketing gray',
  normalized: 'marketing gray'
});
userRules.applyUserRulePatch({ ignored: [ignoredKey] });

const items = review.collectNormalizationReviewItems([
  {
    id: 'p1',
    title: 'Ignored supplier value',
    _normalizedAttributes: {
      'Supplier Shade': {
        rawField: 'Supplier Shade',
        raw: 'marketing gray',
        normalized: 'marketing gray',
        confidence: 0,
        rule: 'unmapped'
      }
    }
  }
]);

assert.strictEqual(items.length, 0, 'ignored review items are omitted from the review queue');

const managed = userRules.removeUserRulePatch(userRules.normalizeRuleSet({
  fieldAliases: { 'connectivity technology': ['Connectivity Tech', 'Wireless Mode'] },
  canonicalFields: { 'connectivity technology': 'Connectivity Technology' },
  enums: { 'Connectivity Technology': { Bluetooth: ['Bluetooth LE', 'BT 5.0'] } },
  ignored: ['p1|supplier shade|supplier shade|marketing gray|marketing gray']
}), {
  field: 'Connectivity Technology',
  rawField: 'Connectivity Tech',
  raw: 'Bluetooth LE',
  normalized: 'Bluetooth',
  reviewKey: 'p1|supplier shade|supplier shade|marketing gray|marketing gray'
});

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(managed)),
  {
    fieldAliases: { 'connectivity technology': ['Wireless Mode'] },
    canonicalFields: { 'connectivity technology': 'Connectivity Technology' },
    enums: { 'Connectivity Technology': { Bluetooth: ['BT 5.0'] } },
    ignored: []
  },
  'user rule removal deletes the selected alias and ignored review key without removing unrelated mappings'
);

console.log('user-rules-normalization.test.js: assertions passed');
