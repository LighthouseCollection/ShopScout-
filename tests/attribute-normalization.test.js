const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'attributes.js'), 'utf8');

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'attributes.js' });

const A = ctx.ShopScoutAttributeNormalization;

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

assert.strictEqual(A.normalizeFieldName('Colour'), 'Color', 'Colour aliases Color');
assert.strictEqual(A.normalizeFieldName('Voltage_Rating'), 'Voltage', 'Voltage_Rating aliases Voltage');
assert.strictEqual(A.normalizeFieldName('USB Type'), 'Connector Type', 'USB Type aliases Connector Type');
assert.strictEqual(A.normalizeFieldName('Custom Supplier Field'), 'Custom Supplier Field', 'unknown field is preserved');

assert.deepStrictEqual(
  plain(A.normalizeAttribute('Color', 'midnight blue')),
  { field: 'Color', raw: 'midnight blue', normalized: 'Navy Blue', confidence: 0.95, rule: 'enum:color:navy-blue' },
  'midnight blue normalizes to Navy Blue'
);

assert.deepStrictEqual(
  plain(A.normalizeAttribute('Size Name', 'medium')),
  { field: 'Size', raw: 'medium', normalized: 'M', confidence: 1, rule: 'enum:size:m' },
  'medium normalizes to M'
);

assert.deepStrictEqual(
  plain(A.normalizeAttribute('Material', 'SS304')),
  { field: 'Material', raw: 'SS304', normalized: 'Stainless Steel 304', confidence: 1, rule: 'enum:material:stainless-steel-304' },
  'SS304 normalizes to Stainless Steel 304'
);

assert.deepStrictEqual(
  plain(A.normalizeAttribute('Connector Type', 'usb type-c')),
  { field: 'Connector Type', raw: 'usb type-c', normalized: 'USB-C', confidence: 1, rule: 'enum:connector-type:usb-c' },
  'USB Type-C normalizes to USB-C'
);

assert.deepStrictEqual(
  plain(A.normalizeAttribute('Power Source', 'wired')),
  { field: 'Power Source', raw: 'wired', normalized: 'Corded Electric', confidence: 0.95, rule: 'enum:power-source:corded-electric' },
  'wired normalizes to Corded Electric'
);

assert.deepStrictEqual(
  plain(A.normalizeAttribute('Color', 'mediun')),
  { field: 'Color', raw: 'mediun', normalized: 'mediun', confidence: 0, rule: 'unmapped' },
  'unknown value in wrong vocabulary stays unmapped'
);

assert.deepStrictEqual(
  plain(A.normalizeProductAttributes({
    specs: [
      { key: 'Colour', value: 'midnight blue' },
      { key: 'Voltage_Rating', value: '120 volts' },
      { key: 'Material', value: 'stainless 304' }
    ]
  })),
  [
    { field: 'Color', rawField: 'Colour', raw: 'midnight blue', normalized: 'Navy Blue', confidence: 0.95, rule: 'enum:color:navy-blue' },
    { field: 'Voltage', rawField: 'Voltage_Rating', raw: '120 volts', normalized: '120 volts', confidence: 0, rule: 'unmapped' },
    { field: 'Material', rawField: 'Material', raw: 'stainless 304', normalized: 'Stainless Steel 304', confidence: 1, rule: 'enum:material:stainless-steel-304' }
  ],
  'product specs normalize field names and known enum values'
);

console.log('attribute-normalization.test.js: 11 assertions passed');
