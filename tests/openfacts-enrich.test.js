const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const productSpecAccessPath = path.join(__dirname, '..', 'shared', 'productSpecAccess.js');
const openFactsPath = path.join(__dirname, '..', 'data', 'openFactsEnrich.js');

const storage = {
  shopscout_openfacts_enrich: {
    enabled: true,
    products: true,
    food: false,
    beauty: false,
    pet: false
  }
};

const context = {
  console,
  setTimeout,
  clearTimeout,
  AbortController,
  fetch: async () => ({
    ok: true,
    json: async () => ({
      status: 1,
      product: {
        brands: 'Acme Foods',
        ingredients_text: 'Water, sugar',
        quantity: '500 ml',
        nutriments: {
          energy_100g: 120,
          energy_unit: 'kJ',
          proteins_100g: 3
        }
      }
    })
  }),
  chrome: {
    storage: {
      local: {
        get: async key => ({ [key]: storage[key] }),
        set: async patch => Object.assign(storage, patch)
      }
    }
  }
};
context.globalThis = context;
context.window = context;

vm.createContext(context);
vm.runInContext(fs.readFileSync(productSpecAccessPath, 'utf8'), context, { filename: productSpecAccessPath });
vm.runInContext(fs.readFileSync(openFactsPath, 'utf8'), context, { filename: openFactsPath });

(async () => {
  const record = {
    upc: '123456789012',
    rawSpecs: [{ key: 'Quantity', value: '250 ml', source: 'listing' }],
    specs: { Quantity: '250 ml' },
    specsNormalized: {
      Quantity: { display: '250 ml', provenance: { confidence: 0.8 } }
    },
    _spec: {
      specs: {
        Quantity: {
          rawKey: 'Quantity',
          rawValue: '250 ml',
          value: '250 ml',
          source: 'listing',
          confidence: 1
        }
      }
    }
  };

  await context.SSOpenFactsEnrich.enrichByGtin(record);

  assert.ok(Array.isArray(record.rawSpecs), 'OpenFacts keeps rawSpecs as the editable spec list');
  assert.strictEqual(Array.isArray(record.specs), false, 'OpenFacts does not create legacy specs arrays');
  assert.strictEqual(record.specs.Brand, 'Acme Foods', 'OpenFacts writes object specs');
  assert.ok(record._spec.specs.Brand, 'OpenFacts writes ProductSpec spec bucket entries');
  assert.strictEqual(record._spec.specs.Brand.value, 'Acme Foods', 'OpenFacts writes ProductSpec value');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(record._spec.specs.Brand, 'canonicalValue'), false,
    'OpenFacts does not write legacy canonicalValue');
  assert.strictEqual(record._spec.specs.Brand.source, 'openfacts:products', 'OpenFacts keeps source provenance on ProductSpec entries');
  assert.strictEqual(record.specs.Quantity, '250 ml', 'OpenFacts does not overwrite existing captured specs');
  assert.strictEqual(record.specsNormalized, undefined, 'OpenFacts invalidates stale normalized sidecar when specs change');

  console.log('openfacts enrichment tests passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
