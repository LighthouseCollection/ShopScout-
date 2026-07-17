const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const relPath of [
  'shared/productSpecAccess.js',
  'normalization/review.js'
]) {
  const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
  vm.runInContext(src, ctx, { filename: relPath });
}

const review = ctx.ShopScoutNormalizationReview;
assert.ok(review, 'normalization review module registers global API');

const products = [
  {
    id: 'p1',
    title: 'Supplier keyboard',
    source: 'Amazon',
    _normalizationContext: {
      category: { leaf: 'Keyboards', fullName: 'Electronics > Computer Accessories > Keyboards' }
    },
    rawSpecs: [
      { key: 'Color', value: 'midnight blue' },
      { key: 'Connectivity Technology', value: 'Bluetooth' }
    ],
    specsNormalized: {
      Color: {
        raw: 'midnight blue',
        canonical: 'Navy Blue',
        display: 'Navy Blue',
        provenance: { method: 'enum.split-and-map', confidence: 0.95, rules: ['enum:color:navy-blue'], warnings: [] }
      },
      'Connectivity Technology': {
        raw: 'Bluetooth',
        canonical: 'Bluetooth',
        display: 'Bluetooth',
        provenance: { method: 'enum.split-and-map', confidence: 0, rules: [], warnings: ['unmapped:Bluetooth'] }
      }
    }
  },
  {
    id: 'p2',
    title: 'Known exact product',
    rawSpecs: [{ key: 'Size', value: 'medium' }],
    specsNormalized: {
      Size: {
        raw: 'medium',
        canonical: 'M',
        display: 'M',
        provenance: { method: 'enum.split-and-map', confidence: 1, rules: ['enum:size:m'], warnings: [] }
      }
    }
  }
];

const items = review.collectNormalizationReviewItems(products);
assert.strictEqual(items.length, 1, 'only low-confidence or taxonomy-fallback items need review');
assert.deepStrictEqual(JSON.parse(JSON.stringify(items[0])), {
  productId: 'p1',
  productIndex: 0,
  productTitle: 'Supplier keyboard',
  source: 'Amazon',
  category: 'Keyboards',
  field: 'Connectivity Technology',
  rawField: 'Connectivity Technology',
  raw: 'Bluetooth',
  normalized: 'Bluetooth',
  confidence: 0,
  rule: 'unmapped',
  fieldRule: '',
  fieldSource: '',
  reason: 'unmapped value',
  reviewKey: 'p1|connectivity technology|connectivity technology|bluetooth|bluetooth'
}, 'review item includes provenance and product context');

const featureItems = review.collectNormalizationReviewItems([
  {
    id: 'p3',
    title: 'Keyboard with feature list',
    source: 'Amazon',
    _normalizationContext: {
      category: { leaf: 'Keyboards' }
    },
    rawSpecs: [{ key: 'Additional Features', value: 'Backlit, Low-Profile Key, Rechargeable' }],
    specsNormalized: {
      'Additional Features': {
        raw: 'Backlit, Low-Profile Key, Rechargeable',
        canonical: ['Backlit', 'Low-Profile Key', 'Rechargeable'],
        display: ['Backlit', 'Low-Profile Key', 'Rechargeable'],
        provenance: { method: 'enum.split-and-map', confidence: 0, rules: [], warnings: ['unmapped:Backlit'] }
      }
    }
  }
]);

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(featureItems.map(item => item.raw))),
  ['Backlit', 'Low-Profile Key', 'Rechargeable'],
  'comma-separated additional features are reviewed as individual line items'
);

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(featureItems.map(item => item.field))),
  ['Backlit', 'Low-Profile Key', 'Rechargeable'],
  'wrapper feature values are promoted to individual review attributes instead of repeating Additional Features'
);

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(featureItems.map(item => item.normalized))),
  ['Backlit', 'Low-Profile Key', 'Rechargeable'],
  'split feature review items keep raw and normalized values aligned'
);

const identifierItems = review.collectNormalizationReviewItems([
  {
    id: 'p4',
    title: 'Identifier-heavy product',
    source: 'Amazon',
    rawSpecs: [
      { key: 'ASIN', value: 'B0056BYSWY' },
      { key: 'Global Trade Identification Number', value: '00012345678905' },
      { key: 'Mfr Part Number', value: 'MXK-MINI-MAC' },
      { key: 'Model Number', value: '920-012644' },
      { key: 'UPC', value: '123456789012' }
    ],
    specsNormalized: {
      ASIN: {
        raw: 'B0056BYSWY',
        canonical: 'B0056BYSWY',
        display: 'B0056BYSWY',
        provenance: { method: 'text.trim', confidence: 0, warnings: ['unmapped:B0056BYSWY'] }
      },
      'Global Trade Identification Number': {
        raw: '00012345678905',
        canonical: '00012345678905',
        display: '00012345678905',
        provenance: { method: 'text.trim', confidence: 0, warnings: ['unmapped:00012345678905'] }
      },
      'Mfr Part Number': {
        raw: 'MXK-MINI-MAC',
        canonical: 'MXK-MINI-MAC',
        display: 'MXK-MINI-MAC',
        provenance: { method: 'text.trim', confidence: 0, warnings: ['unmapped:MXK-MINI-MAC'] }
      },
      'Model Number': {
        raw: '920-012644',
        canonical: '920-012644',
        display: '920-012644',
        provenance: { method: 'text.trim', confidence: 0, warnings: ['unmapped:920-012644'] }
      },
      UPC: {
        raw: '123456789012',
        canonical: '123456789012',
        display: '123456789012',
        provenance: { method: 'text.trim', confidence: 0, warnings: ['unmapped:123456789012'] }
      }
    }
  }
]);

assert.strictEqual(
  identifierItems.length,
  0,
  'product identifiers are identity fields and are excluded from normalization review'
);

console.log('normalization-review.test.js: assertions passed');
