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
  URL,
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
vm.runInContext(load('content/imageFilters.js'),     ctx, { filename: 'imageFilters.js' });
vm.runInContext(load('content/keyCanonicalizer.js'), ctx, { filename: 'keyCanonicalizer.js' });
vm.runInContext(load('content/productSchema.js'),    ctx, { filename: 'productSchema.js' });
vm.runInContext(load('content/structuredSignals.js'), ctx, { filename: 'structuredSignals.js' });
vm.runInContext(load('content/adapters/generic.js'), ctx, { filename: 'generic.js' });

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

/* ---- junk spec guards: note tables and connective-only values ---- */
const junkSpec = NS.assemble([
  NS.observation({ type: 'spec', key: '!!Note!!', value: 'Only support USB-C to HDMI cable. To avoid signal degradation, use a short cable.',
                   source: 'adapter:amazon-specs' }),
  NS.observation({ type: 'spec', key: '1', value: 'For Mac: Settings → System Preferences → Sound.',
                   source: 'adapter:amazon-specs' }),
  NS.observation({ type: 'spec', key: '-', value: 'Apple M1 & M2 based device.',
                   source: 'adapter:amazon-specs' }),
  NS.observation({ type: 'spec', key: 'Wi-Fi', value: 'and',
                   source: 'adapter:amazon-specs' }),
  NS.observation({ type: 'item_detail', key: '2', value: 'Not compatible with devices that do not support video output.',
                   source: 'adapter:amazon-details' }),
  NS.observation({ type: 'spec', key: 'Connectivity Technology', value: 'Bluetooth, Wi-Fi',
                   source: 'adapter:amazon-specs' })
], { url: 'https://example.com/junk', marketplace: 'amazon' });

assert.ok(!Object.keys(junkSpec.specs).some(k => /note/i.test(k)),
  'note table heading does not become a spec column');
assert.ok(!Object.prototype.hasOwnProperty.call(junkSpec.specs, '1'),
  'numeric note table row key does not become a spec column');
assert.ok(!Object.prototype.hasOwnProperty.call(junkSpec.specs, '-'),
  'punctuation note table row key does not become a spec column');
assert.ok(!Object.prototype.hasOwnProperty.call(junkSpec.specs, 'Wi-Fi'),
  'connective-only values such as Wi-Fi: and are dropped');
assert.ok(!Object.prototype.hasOwnProperty.call(junkSpec.itemDetails, '2'),
  'numeric note table row key does not become an item detail column');
assert.strictEqual(junkSpec.specs['Connectivity Technology'].value, 'Bluetooth, Wi-Fi',
  'legitimate comma-separated specs survive junk filtering');

/* ---- Review image capture and filtering (#73) ---- */
function fakeImage(attrs, size) {
  const a = attrs || {};
  const s = size || {};
  return {
    src: a.src || '',
    currentSrc: a.currentSrc || '',
    width: s.width || s.naturalWidth || 0,
    height: s.height || s.naturalHeight || 0,
    naturalWidth: s.naturalWidth || s.width || 0,
    naturalHeight: s.naturalHeight || s.height || 0,
    getAttribute(name) { return a[name] || ''; }
  };
}

const shopifyReview = fakeImage({
  src: 'https://cdn.shopify.com/s/files/1/products/review-photo-800x800.jpg'
}, { width: 800, height: 800 });
const shopifyThumb = fakeImage({
  src: 'https://cdn.shopify.com/s/files/1/products/review-photo_thumb.jpg'
}, { width: 120, height: 120 });
const etsyReview = fakeImage({
  src: 'https://etsy.com/reviews/img_640_640.jpg'
}, { width: 640, height: 640 });
const srcsetReview = fakeImage({
  src: 'https://example.com/reviews/small.jpg',
  srcset: 'https://example.com/reviews/photo-320.jpg 320w, https://example.com/reviews/photo-900.jpg 900w'
}, { width: 900, height: 900 });

ctx.document = {
  querySelector: () => null,
  querySelectorAll(selector) {
    if (String(selector).includes('review')) return [shopifyReview, shopifyThumb, etsyReview, srcsetReview];
    return [];
  }
};
const genericReviewSpec = NS.assemble(ctx.SSAdapterGeneric.extract(), {
  url: 'https://example-shop.test/products/keyboard',
  marketplace: 'generic'
});
const genericReviewUrls = genericReviewSpec.media.userImages.map(m => m.url);
assert.ok(genericReviewUrls.includes('https://cdn.shopify.com/s/files/1/products/review-photo-800x800.jpg'),
  'generic adapter accepts large Shopify review photos');
assert.ok(!genericReviewUrls.includes('https://cdn.shopify.com/s/files/1/products/review-photo_thumb.jpg'),
  'generic adapter rejects thumbnail review photos');
assert.ok(genericReviewUrls.includes('https://etsy.com/reviews/img_640_640.jpg'),
  'generic adapter accepts large non-Amazon review images');
assert.ok(genericReviewUrls.includes('https://example.com/reviews/photo-900.jpg'),
  'generic adapter chooses the largest srcset review image candidate');

const productJsonLd = {
  '@type': 'Product',
  name: 'Review Image Product',
  image: 'https://example.com/product/main.jpg',
  review: [
    {
      '@type': 'Review',
      image: 'https://example.com/reviews/customer-photo.jpg',
      associatedMedia: { contentUrl: 'https://example.com/reviews/customer-video-still.jpg' }
    }
  ]
};
ctx.document = {
  querySelector: () => null,
  querySelectorAll(selector) {
    if (selector === 'script[type="application/ld+json"]') {
      return [{ textContent: JSON.stringify(productJsonLd) }];
    }
    if (selector.startsWith('meta[')) return [];
    return [];
  }
};
const structured = NS.structuredSignals.harvest();
const structuredSpec = NS.assemble(structured.observations, {
  url: 'https://example.com/product/reviews',
  marketplace: 'generic',
  rawSignals: structured.raw
});
assert.ok(structuredSpec.media.productImages.map(m => m.url).includes('https://example.com/product/main.jpg'),
  'JSON-LD Product.image remains a product image');
assert.ok(structuredSpec.media.userImages.map(m => m.url).includes('https://example.com/reviews/customer-photo.jpg'),
  'JSON-LD Review.image routes to user review images');
assert.ok(structuredSpec.media.userImages.map(m => m.url).includes('https://example.com/reviews/customer-video-still.jpg'),
  'JSON-LD Review.associatedMedia routes to user review images');

console.log('extraction-pipeline.test.js — all assertions passed');
