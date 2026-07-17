const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rulesSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'libraries', 'defaultRules.js'), 'utf8');
const userRulesSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'userRules.js'), 'utf8');
const registrySrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'registry.js'), 'utf8');
const enumLibSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'libraries', 'enums.js'), 'utf8');
const textNormalizerSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'normalizers', 'text.js'), 'utf8');
const enumNormalizerSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'normalizers', 'enum.js'), 'utf8');
const measurementNormalizerSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'normalizers', 'measurement.js'), 'utf8');
const normalizeSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'normalize.js'), 'utf8');
const productSpecAccessSrc = fs.readFileSync(path.join(__dirname, '..', 'shared', 'productSpecAccess.js'), 'utf8');
const reviewSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'review.js'), 'utf8');

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(rulesSrc, ctx, { filename: 'normalization/libraries/defaultRules.js' });
vm.runInContext(userRulesSrc, ctx, { filename: 'normalization/userRules.js' });
vm.runInContext(registrySrc, ctx, { filename: 'normalization/registry.js' });
vm.runInContext(enumLibSrc, ctx, { filename: 'normalization/libraries/enums.js' });
vm.runInContext(textNormalizerSrc, ctx, { filename: 'normalization/normalizers/text.js' });
vm.runInContext(enumNormalizerSrc, ctx, { filename: 'normalization/normalizers/enum.js' });
vm.runInContext(measurementNormalizerSrc, ctx, { filename: 'normalization/normalizers/measurement.js' });
vm.runInContext(normalizeSrc, ctx, { filename: 'normalization/normalize.js' });
vm.runInContext(productSpecAccessSrc, ctx, { filename: 'shared/productSpecAccess.js' });

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

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(ctx.ShopScoutNormalize.field('Connectivity Technology', 'Bluetooth LE'))),
  {
    raw: 'Bluetooth LE',
    canonical: ['Bluetooth'],
    display: ['Bluetooth'],
    provenance: {
      method: 'enum.split-and-map',
      confidence: 1,
      rules: ['user-enum:connectivity-technology:bluetooth'],
      warnings: []
    }
  },
  'accepted user enum alias applies to future v2 normalization runs'
);

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(ctx.ShopScoutNormalize.field('Color', 'midnight blue').display)),
  ['Navy Blue'],
  'default rule library feeds v2 enum normalization'
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
    rawSpecs: [{ key: 'Supplier Shade', value: 'marketing gray' }],
    specsNormalized: {
      'Supplier Shade': {
        raw: 'marketing gray',
        canonical: 'marketing gray',
        display: 'marketing gray',
        provenance: { method: 'enum.split-and-map', confidence: 0, warnings: ['unmapped:marketing gray'] }
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
