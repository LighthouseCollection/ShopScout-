const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'taxonomyBridge.js'), 'utf8');

const ctx = {
  console,
  SSCanonical: {
    matchProductToCategory(product) {
      if (String(product.category || '').includes('Keyboards')) {
        return {
          gid: 'gid://shopify/TaxonomyCategory/el-3-2',
          name: 'Keyboards',
          full_name: 'Electronics > Computer Accessories > Keyboards',
          parts: ['Electronics', 'Computer Accessories', 'Keyboards']
        };
      }
      return null;
    },
    knownAttributesFor(category) {
      if (category && category.name === 'Keyboards') {
        return ['Color', 'Compatible Devices', 'Connectivity Technology', 'Keyboard Layout'];
      }
      return [];
    },
    canonicalKey(value) {
      const text = String(value || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
      if (text === 'colour') return 'Color';
      if (text === 'connectivity tech') return 'Connectivity Technology';
      return String(value || '').trim();
    }
  }
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'normalization/taxonomyBridge.js' });

const bridge = ctx.ShopScoutTaxonomyNormalization;
assert.ok(bridge, 'taxonomy bridge registers global API');

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const product = {
  title: 'Logitech Wireless Keyboard',
  category: 'Electronics > Computer Accessories > Keyboards',
  rawSpecs: [
    { key: 'Colour', value: 'midnight blue' },
    { key: 'Connectivity Tech', value: 'Bluetooth' }
  ]
};

const context = bridge.categoryContextForProduct(product);
assert.strictEqual(context.category.leaf, 'Keyboards', 'category context keeps the taxonomy leaf');
assert.strictEqual(context.category.fullName, 'Electronics > Computer Accessories > Keyboards',
  'category context keeps the full taxonomy breadcrumb');
assert.deepStrictEqual(plain(context.knownAttributes.slice(0, 2)), ['Color', 'Compatible Devices'],
  'category context includes Shopify-declared attributes');

const field = bridge.normalizeFieldWithTaxonomy('Connectivity Tech', context);
assert.deepStrictEqual(plain(field), {
  rawField: 'Connectivity Tech',
  field: 'Connectivity Technology',
  confidence: 0.92,
  rule: 'taxonomy-field:connectivity-technology',
  source: 'shopify-taxonomy'
}, 'field aliases can resolve through taxonomy attributes');

const patch = bridge.taxonomyPatchForProduct(product);
assert.strictEqual(patch._normalizationContext.category.leaf, 'Keyboards',
  'product patch stores category leaf context');
assert.ok(patch._normalizationContext.knownAttributes.includes('Keyboard Layout'),
  'product patch stores category-relevant attribute hints');

console.log('taxonomy-normalization.test.js: assertions passed');
