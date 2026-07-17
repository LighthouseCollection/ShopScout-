/* Normalization wiring test: prove that when normalization/*.js is loaded
   before content/productSchema.js, assemble() attaches a
   .normalized envelope to each spec entry AND toLegacyFlatProduct keeps
   the normalized sidecar without restoring legacy flat spec copies. Uses the exact defect strings
   the user showed on screen so a regression here immediately shouts. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

const docStub = {
  querySelectorAll: () => [],
  querySelector: () => null,
};
const ctx = {
  console,
  document: docStub,
  location: { href: 'https://example.com/p/42', hostname: 'example.com' },
};
ctx.globalThis = ctx;
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext('var SSCanonical = SSCanonical || null;', ctx);

/* Load order MUST match background.js:
     Qty -> registry -> enums -> normalizers -> normalize
     -> productSchema (assemble reads root.ShopScoutNormalize). */
vm.runInContext(read('vendor/quantities.min.js'),                  ctx, { filename: 'quantities.min.js' });
vm.runInContext(read('normalization/registry.js'),                 ctx, { filename: 'registry.js' });
vm.runInContext(read('normalization/libraries/enums.js'),          ctx, { filename: 'enums.js' });
vm.runInContext(read('normalization/normalizers/text.js'),         ctx, { filename: 'text.js' });
vm.runInContext(read('normalization/normalizers/enum.js'),         ctx, { filename: 'enum.js' });
vm.runInContext(read('normalization/normalizers/measurement.js'),  ctx, { filename: 'measurement.js' });
vm.runInContext(read('normalization/normalize.js'),                ctx, { filename: 'normalize.js' });
vm.runInContext(read('content/confidenceRules.js'),                ctx, { filename: 'confidenceRules.js' });
vm.runInContext(read('content/domUtils.js'),                       ctx, { filename: 'domUtils.js' });
vm.runInContext(read('content/keyCanonicalizer.js'),               ctx, { filename: 'keyCanonicalizer.js' });
vm.runInContext(read('content/productSchema.js'),                  ctx, { filename: 'productSchema.js' });

const NS = ctx.SSExtract;
assert.ok(NS && typeof NS.assemble === 'function',        'SSExtract.assemble loaded');
assert.ok(typeof NS.observation === 'function',           'SSExtract.observation loaded');
assert.ok(typeof NS.toLegacyFlatProduct === 'function',   'SSExtract.toLegacyFlatProduct loaded');
assert.ok(ctx.ShopScoutNormalize && typeof ctx.ShopScoutNormalize.field === 'function',
  'ShopScoutNormalize.field loaded');

function obs(key, value) {
  return NS.observation({
    type: 'spec',
    key,
    value,
    source: 'html',
    confidence: 'high',
  });
}

/* Feed the exact messy strings the user's screenshots showed. */
const observations = [
  obs('Color',            'Black&red'),
  obs('Voltage',          '9 volts_of_direct_current'),
  obs('Length',           '23.6 inches'),
  obs('Battery Capacity', '10000 mAh'),
  obs('Brand',            '  Lamicall  '),
];

const spec = NS.assemble(observations, {
  adapter: 'test',
  adapterConfidence: 'high',
  marketplace: 'test',
});

/* Each spec entry should carry a .normalized envelope. */
function plain(v) { return JSON.parse(JSON.stringify(v)); }

const colorEntry = spec.specs.Color || spec.itemDetails.Color;
assert.ok(colorEntry && colorEntry.normalized,
  'Color spec entry has a .normalized sidecar');
assert.deepStrictEqual(plain(colorEntry.normalized.canonical), ['Black', 'Red'],
  'Color .normalized.canonical splits Black&red into [Black, Red]');

const voltEntry = spec.specs.Voltage || spec.itemDetails.Voltage;
assert.ok(voltEntry && voltEntry.normalized,                             'Voltage entry has .normalized');
assert.strictEqual(voltEntry.normalized.canonical, 9,                    'Voltage volts_of_direct_current cleaned to 9');
assert.strictEqual(voltEntry.normalized.unit,      'V',                  'Voltage canonical unit is V');
assert.strictEqual(voltEntry.normalized.display,   '9 V',                'Voltage display is "9 V"');
assert.strictEqual(Object.prototype.hasOwnProperty.call(voltEntry, 'canonicalValue'), false,
  'new ProductSpec entries do not persist legacy canonicalValue');

const lenEntry = spec.specs.Length || spec.itemDetails.Length;
assert.ok(lenEntry && lenEntry.normalized,                                'Length entry has .normalized');
assert.strictEqual(lenEntry.normalized.canonical,  59.9,                  'Length 23.6 inches converted to 59.9 cm');
assert.strictEqual(lenEntry.normalized.unit,       'cm',                  'Length canonical unit is cm');

/* toLegacyFlatProduct mirrors the envelope onto flat.specsNormalized and
   no longer writes legacy flat specs/rawSpecs copies. */
const flat = NS.toLegacyFlatProduct(spec);
assert.ok(flat,                                          'toLegacyFlatProduct returned a value');
assert.ok(flat.specsNormalized,                          'flat.specsNormalized sidecar exists');

const flatColor = flat.specsNormalized.Color;
assert.ok(flatColor, 'flat.specsNormalized.Color exists');
assert.deepStrictEqual(plain(flatColor.canonical), ['Black', 'Red'],
  'flat.specsNormalized.Color.canonical is [Black, Red]');

const flatVolt = flat.specsNormalized.Voltage;
assert.ok(flatVolt,                                       'flat.specsNormalized.Voltage exists');
assert.strictEqual(flatVolt.canonical, 9,                 'flat.specsNormalized.Voltage.canonical == 9');
assert.strictEqual(flatVolt.display,   '9 V',             'flat.specsNormalized.Voltage.display == "9 V"');

assert.strictEqual(Object.prototype.hasOwnProperty.call(flat, 'specs'), false,
  'flat.specs is not written for new captures');
assert.strictEqual(Object.prototype.hasOwnProperty.call(flat, 'rawSpecs'), false,
  'flat.rawSpecs is not written for new captures');
assert.ok(flat._spec && flat._spec.specs && flat._spec.specs.Color,
  'ProductSpec remains attached for spec readers');

console.log('normalize-v2-wiring.test.js: 15 assertions passed');
