const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function loadScript(ctx, relPath) {
  const source = fs.readFileSync(path.join(root, relPath), 'utf8');
  vm.runInContext(source, ctx, { filename: relPath });
}

const ctx = {
  console,
  globalThis: null,
  SSCanonical: {
    canonicalKey(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\bcolour\b/g, 'color')
        .replace(/\s+/g, ' ');
    }
  }
};
ctx.globalThis = ctx;
vm.createContext(ctx);
loadScript(ctx, 'shared/productSpecAccess.js');

const access = ctx.ShopScoutProductSpecAccess;
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}
assert.ok(access, 'ProductSpec access namespace is registered');
assert.equal(typeof access.specEntries, 'function', 'specEntries is exposed');
assert.equal(typeof access.specEntry, 'function', 'specEntry is exposed');
assert.equal(typeof access.specDisplayValue, 'function', 'specDisplayValue is exposed');

const product = {
  rawSpecs: [
    { key: 'Colour', value: 'midnight blue', source: 'listing' },
    { key: 'Battery Life', value: '2 hrs', source: 'listing' }
  ],
  specs: {
    Voltage: '9 volts'
  },
  specsNormalized: {
    Color: {
      raw: 'midnight blue',
      canonical: 'Navy Blue',
      display: 'Navy Blue',
      provenance: { confidence: 0.95, rules: ['enum:color:navy-blue'] }
    },
    Voltage: {
      raw: '9 volts',
      canonical: 9,
      unit: 'V',
      display: '9 V',
      provenance: { confidence: 1, rules: ['measurement:voltage'] }
    }
  },
  _spec: {
    specs: {
      'Battery Life': {
        rawKey: 'Battery Life',
        rawValue: '2 hrs',
        canonicalValue: '2 hours',
        confidence: 0.82,
        source: 'official'
      }
    },
    itemDetails: {
      Material: {
        rawKey: 'Material',
        rawValue: 'SS304',
        canonicalValue: 'Stainless Steel 304',
        confidence: 0.9,
        source: 'manufacturer'
      }
    }
  }
};

const original = JSON.stringify(product);
const entries = access.specEntries(product, { root: ctx });
assert.deepStrictEqual(
  plain(entries.map(entry => entry.field)),
  ['color', 'battery life', 'voltage', 'material'],
  'entries merge rawSpecs, specs object, and ProductSpec-only details in stable order'
);

const color = access.specEntry(product, 'Color', { root: ctx });
assert.strictEqual(color.rawField, 'Colour', 'raw field label is preserved');
assert.strictEqual(color.raw, 'midnight blue', 'raw value is preserved');
assert.strictEqual(color.display, 'Navy Blue', 'normalized display wins for user-facing value');
assert.strictEqual(color.source, 'listing', 'source survives from raw spec');

const battery = access.specEntry(product, 'Battery Life', { root: ctx });
assert.strictEqual(battery.raw, '2 hrs', 'ProductSpec rawValue is available for matched rawSpec');
assert.strictEqual(battery.display, '2 hours', 'ProductSpec canonicalValue is used when no v2 envelope exists');
assert.strictEqual(battery.confidence, 0.82, 'ProductSpec confidence is preserved');
assert.deepStrictEqual(plain(battery.sources), ['official'], 'ProductSpec source is normalized to sources array');

const voltage = access.specEntry(product, 'Voltage', { root: ctx });
assert.strictEqual(voltage.raw, '9 volts', 'legacy specs object contributes entries');
assert.strictEqual(voltage.display, '9 V', 'specsNormalized display is attached to legacy specs object entries');

const material = access.specEntry(product, 'Material', { root: ctx });
assert.strictEqual(material.raw, 'SS304', 'ProductSpec-only itemDetails are exposed');
assert.strictEqual(material.display, 'Stainless Steel 304', 'ProductSpec-only canonicalValue is displayed');

assert.strictEqual(access.specDisplayValue(product, 'Colour', { root: ctx }), 'Navy Blue',
  'specDisplayValue resolves aliases through canonical field keys');
assert.strictEqual(JSON.stringify(product), original, 'accessors do not mutate products');

console.log('product-spec-access.test.js: assertions passed');
