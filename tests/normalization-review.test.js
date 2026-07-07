const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'review.js'), 'utf8');

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'normalization/review.js' });

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
    _normalizedAttributes: {
      Color: {
        rawField: 'Colour',
        raw: 'midnight blue',
        normalized: 'Navy Blue',
        confidence: 0.95,
        rule: 'enum:color:navy-blue'
      },
      'Connectivity Technology': {
        rawField: 'Connectivity Tech',
        raw: 'Bluetooth',
        normalized: 'Bluetooth',
        confidence: 0,
        rule: 'unmapped',
        fieldRule: 'taxonomy-field:connectivity-technology',
        fieldSource: 'shopify-taxonomy'
      }
    }
  },
  {
    id: 'p2',
    title: 'Known exact product',
    _normalizedAttributes: {
      Size: {
        rawField: 'Size Name',
        raw: 'medium',
        normalized: 'M',
        confidence: 1,
        rule: 'enum:size:m'
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
  rawField: 'Connectivity Tech',
  raw: 'Bluetooth',
  normalized: 'Bluetooth',
  confidence: 0,
  rule: 'unmapped',
  fieldRule: 'taxonomy-field:connectivity-technology',
  fieldSource: 'shopify-taxonomy',
  reason: 'unmapped value',
  reviewKey: 'p1|connectivity tech|connectivity technology|bluetooth|bluetooth'
}, 'review item includes provenance and product context');

console.log('normalization-review.test.js: assertions passed');
