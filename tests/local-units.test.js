const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'shared', 'values', 'cellValues.js'), 'utf8');

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'cellValues.js' });

const V = ctx.ShopScoutValues;
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

assert.strictEqual(V.measurementSystemForLocale('en-US'), 'us', 'US locale uses US customary display');
assert.strictEqual(V.measurementSystemForLocale('fr-FR'), 'metric', 'French locale uses metric display');

assert.deepStrictEqual(
  plain(V.normalizeMeasurement('19.685 in')),
  { kind: 'length', baseValue: 500, baseUnit: 'mm' },
  'imperial length normalizes to metric base'
);

assert.deepStrictEqual(
  plain(V.normalizeMeasurement('1.5 lb')),
  { kind: 'mass', baseValue: 680.39, baseUnit: 'g' },
  'imperial weight normalizes to metric base'
);

assert.strictEqual(V.prettify('500 mm', { locale: 'en-US' }), '19.7 in', 'US locale displays metric length as inches');
assert.strictEqual(V.prettify('19.685 in', { locale: 'fr-FR' }), '50 cm', 'metric locale displays inches as centimeters');
assert.strictEqual(V.prettify('1.5 lb', { locale: 'fr-FR' }), '680 g', 'metric locale displays pounds as grams');
assert.strictEqual(V.prettify('500 g', { locale: 'en-US' }), '17.6 oz', 'US locale displays grams as ounces');
assert.strictEqual(V.prettify('120 V', { locale: 'fr-FR' }), '120 V', 'electrical units stay unchanged');
assert.strictEqual(V.prettify('50 x 40 x 30 cm', { locale: 'en-US' }), '19.7 × 15.7 × 11.8 in', 'US locale displays metric dimensions as inches');
assert.strictEqual(V.prettify('20 x 10 x 5 in', { locale: 'fr-FR' }), '50.8 × 25.4 × 12.7 cm', 'metric locale displays imperial dimensions as centimeters');

console.log('local-units.test.js: 11 assertions passed');
