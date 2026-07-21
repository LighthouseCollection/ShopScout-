/* Phase 4 migration test: prove that applyNormalizedEnvelope
   backfills flat.specsNormalized on pre-v2 products with only
   flat.specs bare strings, without touching entries that already
   carry an envelope (idempotent). */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

/* Stub Dexie enough that migrate.js can require SSDB + SSProductRepo
   without actually touching the database. applyNormalizedEnvelope
   is a pure function on a plain product object so we can test it
   in isolation. */
const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(read('vendor/quantities.min.js'),                 ctx, { filename: 'quantities.min.js' });
vm.runInContext(read('normalization/registry.js'),                ctx, { filename: 'registry.js' });
vm.runInContext(read('normalization/libraries/enums.js'),         ctx, { filename: 'enums.js' });
vm.runInContext(read('normalization/normalizers/text.js'),        ctx, { filename: 'text.js' });
vm.runInContext(read('normalization/normalizers/enum.js'),        ctx, { filename: 'enum.js' });
vm.runInContext(read('normalization/normalizers/measurement.js'), ctx, { filename: 'measurement.js' });
vm.runInContext(read('normalization/normalizers/dataRate.js'),    ctx, { filename: 'dataRate.js' });
vm.runInContext(read('normalization/normalizers/dimensions.js'),  ctx, { filename: 'dimensions.js' });
vm.runInContext(read('normalization/normalizers/resolution.js'),  ctx, { filename: 'resolution.js' });
vm.runInContext(read('normalization/normalize.js'),               ctx, { filename: 'normalize.js' });

/* Minimal stubs so migrate.js's guards pass. */
vm.runInContext(`
  globalThis.SSDB = { db: {}, uuid: () => 'uuid', now: () => 0 };
  globalThis.SSProductRepo = {};
`, ctx);
vm.runInContext(read('data/migrate.js'), ctx, { filename: 'migrate.js' });

const M = ctx.SSMigrate;
const N = ctx.ShopScoutNormalize;
assert.ok(M && typeof M._applyNormalizedEnvelope === 'function', 'SSMigrate._applyNormalizedEnvelope exposed');
assert.ok(N && typeof N.field === 'function',                    'normalizer available');

function plain(v) { return JSON.parse(JSON.stringify(v)); }

/* Case 1: legacy product -- bare string specs, no envelope. */
let product = {
  id: 'p1',
  specs: {
    Color: 'Black&red',
    Voltage: '9 volts_of_direct_current',
    Length: '23.6 inches',
  },
};
let mutated = M._applyNormalizedEnvelope(product, N);
assert.strictEqual(mutated, true, 'legacy product needs backfill');
assert.ok(product.specsNormalized, 'flat.specsNormalized created');
assert.deepStrictEqual(
  plain(product.specsNormalized.Color.canonical),
  ['Black', 'Red'],
  'Color migrated to [Black, Red]');
assert.strictEqual(product.specsNormalized.Voltage.canonical, 9,       'Voltage backfilled to 9');
assert.strictEqual(product.specsNormalized.Voltage.display,   '9 V',    'Voltage display "9 V"');
assert.strictEqual(product.specsNormalized.Length.canonical,  59.9,     'Length backfilled to 59.9');
assert.strictEqual(product.specsNormalized.Length.unit,       'cm',     'Length unit cm');

/* Case 2: rerun on the same product -- envelope already present,
   should be a no-op. */
const beforeSecond = plain(product);
mutated = M._applyNormalizedEnvelope(product, N);
assert.strictEqual(mutated, false, 'idempotent: no changes when envelope already present');
assert.deepStrictEqual(plain(product), beforeSecond, 'no mutation on rerun');

/* Case 3: product with unknown field -- passes through, no envelope
   is written (canonical is null-ish for unregistered fields). */
const unknownProduct = {
  id: 'p2',
  specs: { WhatIsThis: 'foo' },
};
mutated = M._applyNormalizedEnvelope(unknownProduct, N);
/* Envelope IS added because unregistered-passthrough returns
   canonical: 'foo'. That's fine -- migrator writes what the
   dispatcher returns; the review UI can decide whether to add
   the field to the registry. */
assert.strictEqual(mutated, true, 'unknown field still gets an envelope (unregistered-passthrough)');
assert.ok(unknownProduct.specsNormalized.WhatIsThis,                                            'unknown field envelope written');
assert.strictEqual(unknownProduct.specsNormalized.WhatIsThis.provenance.warnings[0].indexOf('unknown_field:'), 0,
  'unknown-field warning recorded');

/* Case 4: _spec.specs entries also get backfilled. */
const withSpec = {
  id: 'p3',
  specs: { Color: 'Blue' },
  _spec: {
    specs: {
      Voltage: { rawKey: 'Voltage', rawValue: '48 volts', value: '48V' },
    },
  },
};
mutated = M._applyNormalizedEnvelope(withSpec, N);
assert.strictEqual(mutated, true, '_spec.specs.Voltage backfilled');
assert.ok(withSpec._spec.specs.Voltage.normalized,                          '_spec.Voltage.normalized attached');
assert.strictEqual(withSpec._spec.specs.Voltage.normalized.canonical, 48,   '_spec.Voltage.canonical == 48');
assert.strictEqual(withSpec._spec.specs.Voltage.normalized.unit,      'V',  '_spec.Voltage.unit == V');

console.log('normalize-v2-migration.test.js: 13 assertions passed');
