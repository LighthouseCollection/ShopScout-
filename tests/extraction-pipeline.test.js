/* Tests for the layered extraction pipeline foundation:
   - confidenceRules: enum ordering + comparison
   - observation() factory: defaults applied
   - keyCanonicalizer: normalizeKey synonym table
   - assemble(): confidence-aware merge produces a valid ProductSpec
   These run in a vm context with minimal browser stubs so the namespace
   scripts can register on globalThis. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

/* Minimal document stub — assemble() doesn't need DOM, but a few helpers
   do feature-detect `document` even though they short-circuit. */
const docStub = {
  querySelectorAll: () => [],
  querySelector: () => null
};

const ctx = {
  console,
  document: docStub,
  location: { href: 'https://example.com/p/42', hostname: 'example.com' }
};
ctx.globalThis = ctx;
ctx.window = ctx;
vm.createContext(ctx);

/* Optional pieces the canonicalizer wants but tolerates missing */
vm.runInContext('var SSCanonical = SSCanonical || null;', ctx);

vm.runInContext(load('content/confidenceRules.js'),  ctx, { filename: 'confidenceRules.js' });
vm.runInContext(load('content/domUtils.js'),         ctx, { filename: 'domUtils.js' });
vm.runInContext(load('content/keyCanonicalizer.js'), ctx, { filename: 'keyCanonicalizer.js' });
vm.runInContext(load('content/productSchema.js'),    ctx, { filename: 'productSchema.js' });

const NS = ctx.SSExtract;
assert.ok(NS, 'SSExtract namespace registered');

/* ---- Confidence enum ---- */
const C = NS.Confidence;
assert.deepStrictEqual(Object.keys(C).sort(), ['HIGH','LOW','MEDIUM','NONE'], 'enum keys');
assert.ok(NS.confidenceGt(C.HIGH, C.MEDIUM),  'HIGH > MEDIUM');
assert.ok(NS.confidenceGt(C.MEDIUM, C.LOW),   'MEDIUM > LOW');
assert.ok(NS.confidenceGt(C.LOW, C.NONE),     'LOW > NONE');
assert.ok(!NS.confidenceGt(C.LOW, C.LOW),     'LOW not > LOW');
assert.ok(NS.confidenceGte(C.MEDIUM, C.MEDIUM), 'MEDIUM >= MEDIUM');

/* ---- Default confidence by source ---- */
assert.strictEqual(NS.defaultConfidenceFor('json-ld'),    C.HIGH,   'json-ld is HIGH');
assert.strictEqual(NS.defaultConfidenceFor('microdata'),  C.HIGH,   'microdata is HIGH');
assert.strictEqual(NS.defaultConfidenceFor('opengraph'),  C.HIGH,   'opengraph is HIGH');
assert.strictEqual(NS.defaultConfidenceFor('adapter:amazon'), C.MEDIUM, 'adapter is MEDIUM');
assert.strictEqual(NS.defaultConfidenceFor('miner:text'), C.LOW,    'miner is LOW');

/* ---- observation() factory defaults ---- */
const o = NS.observation({ type: 'identity', key: 'title', value: 'A', source: 'json-ld' });
assert.strictEqual(o.type, 'identity');
assert.strictEqual(o.confidence, C.HIGH, 'confidence defaulted from source');
assert.strictEqual(o.selector, null, 'selector defaults to null');
assert.strictEqual(o.rawText, null, 'rawText defaults to null');

/* observation() rejects missing type but tolerates empty value — the
   applyObservation pass is where empty values get dropped. */
assert.strictEqual(NS.observation({ key: 'X', value: '', source: 'json-ld' }), null,
  'observation without type is null');

/* ---- keyCanonicalizer ---- */
const K = NS.keyCanonicalizer;
assert.strictEqual(K.normalizeKey('item weight'),       'Weight',     'item weight -> Weight');
assert.strictEqual(K.normalizeKey('Product Dimensions'),'Dimensions', 'Product Dimensions -> Dimensions');
assert.strictEqual(K.normalizeKey('  max torque  '),    'Max torque', 'max torque -> Max torque');
assert.strictEqual(K.normalizeKey(''),                  '',           'empty -> empty');

/* ---- assemble() — confidence-aware merge ---- */
const observations = [
  NS.observation({ type: 'identity', key: 'title', value: 'JSON-LD Title',
                   source: 'json-ld' }),
  NS.observation({ type: 'identity', key: 'title', value: 'Adapter Title',
                   source: 'adapter:amazon' }),   // lower confidence -> ignored
  NS.observation({ type: 'identity', key: 'brand', value: 'Acme',
                   source: 'opengraph' }),
  NS.observation({ type: 'identifier', key: 'sku', value: 'SKU-99',
                   source: 'json-ld' }),
  NS.observation({ type: 'price', key: 'newPrice', value: '$19.99',
                   source: 'json-ld' }),
  NS.observation({ type: 'spec', key: 'item weight', value: '2.5 lb',
                   source: 'adapter:amazon-po' }),
  NS.observation({ type: 'spec', key: 'Max torque', value: '60 N·m',
                   source: 'miner:text' }),
  NS.observation({ type: 'feature', key: null, value: 'Bullet feature 1',
                   source: 'adapter:amazon' }),
  NS.observation({ type: 'feature', key: null, value: 'Bullet feature 2',
                   source: 'adapter:amazon' }),
  NS.observation({ type: 'image', key: 'product', value: 'https://example.com/p1.jpg',
                   source: 'json-ld' }),
  NS.observation({ type: 'image', key: 'user', value: 'https://example.com/u1.jpg',
                   source: 'adapter:amazon' })
];

const spec = NS.assemble(observations, {
  url: 'https://example.com/p/42',
  marketplace: 'amazon'
});

assert.strictEqual(spec.title.value, 'JSON-LD Title', 'HIGH wins over MEDIUM for title');
assert.strictEqual(spec.title.confidence, C.HIGH, 'title confidence preserved');
assert.strictEqual(spec.brand.value, 'Acme', 'brand from OG');
assert.strictEqual(spec.pricing.newPrice.value, '$19.99', 'pricing.newPrice set');

const identifierMatch = (spec.identifiers || []).find(i => i.kind === 'sku');
assert.ok(identifierMatch, 'identifier sku present');
assert.strictEqual(identifierMatch.value, 'SKU-99');

assert.ok(spec.specs, 'specs object exists');
const weightKey = Object.keys(spec.specs).find(k => /weight/i.test(k));
assert.ok(weightKey, 'weight spec normalized into spec.specs');
const torqueKey = Object.keys(spec.specs).find(k => /torque/i.test(k));
assert.ok(torqueKey, 'torque spec from miner included');

assert.strictEqual((spec.features || []).length, 2, 'two feature bullets');
const productImageUrls = (spec.media.productImages || []).map(m => m.url);
const userImageUrls    = (spec.media.userImages    || []).map(m => m.url);
assert.ok(productImageUrls.includes('https://example.com/p1.jpg'), 'product image emitted');
assert.ok(userImageUrls.includes('https://example.com/u1.jpg'), 'user image emitted');

/* ---- toLegacyFlatProduct projection ---- */
const legacy = NS.toLegacyFlatProduct(spec);
assert.strictEqual(legacy.title, 'JSON-LD Title');
assert.strictEqual(legacy.brand, 'Acme');
assert.strictEqual(legacy.sku, 'SKU-99', 'identifier promoted to flat slot');
assert.strictEqual(Object.prototype.hasOwnProperty.call(legacy, 'specs'), false, 'legacy flat specs are not written');
assert.strictEqual(Object.prototype.hasOwnProperty.call(legacy, 'rawSpecs'), false, 'legacy rawSpecs are not written');
assert.ok(legacy._spec && legacy._spec.specs, 'ProductSpec is preserved for spec consumers');
assert.ok(Object.keys(legacy._spec.specs).some(k => /weight/i.test(k)), 'ProductSpec specs include weight');

console.log('extraction-pipeline.test.js — all assertions passed');
