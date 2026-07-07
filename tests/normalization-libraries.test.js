const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rulesSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'libraries', 'defaultRules.js'), 'utf8');
const attrsSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'attributes.js'), 'utf8');

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(rulesSrc, ctx, { filename: 'normalization/libraries/defaultRules.js' });
vm.runInContext(attrsSrc, ctx, { filename: 'normalization/attributes.js' });

assert.ok(ctx.ShopScoutNormalizationRules, 'normalization rules library registers a global API');
assert.ok(ctx.ShopScoutNormalizationRules.fieldAliases.color.includes('colour'),
  'field aliases live in the normalization rules library');
assert.ok(ctx.ShopScoutNormalizationRules.enums.Color['Navy Blue'].includes('midnight blue'),
  'enum vocabulary lives in the normalization rules library');

const A = ctx.ShopScoutAttributeNormalization;
assert.strictEqual(A.normalizeFieldName('Voltage_Rating'), 'Voltage',
  'attribute normalizer reads field aliases from the library');
assert.strictEqual(A.normalizeAttribute('Colour', 'midnight blue').normalized, 'Navy Blue',
  'attribute normalizer reads enum vocab from the library');
assert.strictEqual(A.normalizeAttribute('USB Type', 'usb type c').normalized, 'USB-C',
  'connector vocab remains available through the library');

assert.ok(!attrsSrc.includes('const FIELD_ALIASES = {'),
  'attributes.js no longer owns the field-alias library');
assert.ok(!attrsSrc.includes('const ENUMS = {'),
  'attributes.js no longer owns the enum vocabulary library');

console.log('normalization-libraries.test.js: assertions passed');
