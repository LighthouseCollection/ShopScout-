/* Normalization v2 — end-to-end tests using the exact messy
   strings the user showed in the wild:

     Color:   "Black&red", "2-blue", "1-gray", "Black 2", "Orange"
     Voltage: "48 V", "7.4 volts", "12 V", "9 volts_of_direct_current", "12"
     Length:  "23.6 inches", "50 centimeters", "30 centimeters"

   Every fixture asserts on the {canonical, display, provenance}
   envelope produced by ShopScoutNormalize.field(). No clean
   synthetic inputs -- these are the strings the pipeline
   actually sees. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);

/* Load order matches production: vendor Qty first, then registry,
   enums, normalizers, dispatcher. */
vm.runInContext(read('vendor/quantities.min.js'),           ctx, { filename: 'quantities.min.js' });
vm.runInContext(read('normalization/registry.js'),           ctx, { filename: 'registry.js' });
vm.runInContext(read('normalization/libraries/enums.js'),    ctx, { filename: 'enums.js' });
vm.runInContext(read('normalization/normalizers/text.js'),   ctx, { filename: 'text.js' });
vm.runInContext(read('normalization/normalizers/enum.js'),   ctx, { filename: 'enum.js' });
vm.runInContext(read('normalization/normalizers/measurement.js'), ctx, { filename: 'measurement.js' });
vm.runInContext(read('normalization/normalize.js'),          ctx, { filename: 'normalize.js' });

const N = ctx.ShopScoutNormalize;
assert.ok(N && typeof N.field === 'function', 'dispatcher loaded');
assert.ok(ctx.Qty, 'Qty loaded — measurement conversions must work');

let passed = 0;
/* Plain-ify to cross the vm context boundary — arrays and objects
   created inside vm.runInContext carry a different prototype
   chain, so deepStrictEqual would false-negative on them. */
function plain(v) { return JSON.parse(JSON.stringify(v)); }
function check(label, got, expected) {
  try {
    assert.deepStrictEqual(plain(got), plain(expected), label);
    passed += 1;
  } catch (err) {
    console.error(`FAIL: ${label}`);
    console.error('  expected:', JSON.stringify(expected));
    console.error('  got     :', JSON.stringify(got));
    throw err;
  }
}

/* ---------------- Color ---------------- */

let r;

r = N.field('Color', 'Black&red');
check('Color "Black&red" splits on &',
  { canonical: r.canonical, display: r.display },
  { canonical: ['Black', 'Red'], display: ['Black', 'Red'] });

r = N.field('Color', '2-blue');
check('Color "2-blue" strips variant prefix',
  { canonical: r.canonical, display: r.display },
  { canonical: ['Blue'], display: ['Blue'] });

r = N.field('Color', '1-gray');
check('Color "1-gray" strips variant prefix',
  { canonical: r.canonical, display: r.display },
  { canonical: ['Gray'], display: ['Gray'] });

r = N.field('Color', 'Black 2');
check('Color "Black 2" strips variant suffix',
  { canonical: r.canonical, display: r.display },
  { canonical: ['Black'], display: ['Black'] });

r = N.field('Color', 'Orange');
check('Color "Orange" maps direct',
  { canonical: r.canonical, display: r.display },
  { canonical: ['Orange'], display: ['Orange'] });

r = N.field('Color', 'Black');
check('Color "Black" maps direct',
  { canonical: r.canonical, display: r.display },
  { canonical: ['Black'], display: ['Black'] });

r = N.field('Color', 'Navy Blue & Red');
check('Color multi with space split',
  { canonical: r.canonical, display: r.display },
  { canonical: ['Navy Blue', 'Red'], display: ['Navy Blue', 'Red'] });

r = N.field('Color', 'midnight blue');
check('Color alias "midnight blue" -> Navy Blue',
  { canonical: r.canonical, display: r.display },
  { canonical: ['Navy Blue'], display: ['Navy Blue'] });

/* ---------------- Voltage ---------------- */

r = N.field('Voltage', '48 V');
check('Voltage "48 V" -> 48 V',
  { canonical: r.canonical, unit: r.unit, display: r.display },
  { canonical: 48, unit: 'V', display: '48 V' });

r = N.field('Voltage', '7.4 volts');
check('Voltage "7.4 volts" -> 7.4 V',
  { canonical: r.canonical, unit: r.unit, display: r.display },
  { canonical: 7.4, unit: 'V', display: '7.4 V' });

r = N.field('Voltage', '9 volts_of_direct_current');
check('Voltage "9 volts_of_direct_current" -> 9 V (cleaned)',
  { canonical: r.canonical, unit: r.unit, display: r.display },
  { canonical: 9, unit: 'V', display: '9 V' });

r = N.field('Voltage', '12');
r_ok = r.canonical === 12 && r.unit === 'V' && r.provenance.warnings.includes('inferred_unit_from_field');
assert.ok(r_ok, 'Voltage bare "12" infers V and flags it in provenance');
passed += 1;

r = N.field('Voltage', '12 V');
check('Voltage "12 V" -> 12 V',
  { canonical: r.canonical, unit: r.unit, display: r.display },
  { canonical: 12, unit: 'V', display: '12 V' });

/* ---------------- Length ---------------- */

r = N.field('Length', '50 centimeters');
check('Length "50 centimeters" -> 50 cm',
  { canonical: r.canonical, unit: r.unit, display: r.display },
  { canonical: 50, unit: 'cm', display: '50 cm' });

r = N.field('Length', '30 centimeters');
check('Length "30 centimeters" -> 30 cm',
  { canonical: r.canonical, unit: r.unit, display: r.display },
  { canonical: 30, unit: 'cm', display: '30 cm' });

r = N.field('Length', '23.6 inches');
check('Length "23.6 inches" -> 59.9 cm (converted)',
  { canonical: r.canonical, unit: r.unit, display: r.display },
  { canonical: 59.9, unit: 'cm', display: '59.9 cm' });

r = N.field('Length', '5 kg');
assert.strictEqual(r.canonical, null, 'Length "5 kg" -> null (kind_mismatch, do not silently store)');
assert.ok(r.provenance.warnings.some(w => w.startsWith('kind_mismatch')),
  'Length kind_mismatch is flagged in provenance');
passed += 2;

/* ---------------- Weight ---------------- */

r = N.field('Weight', '2 lb');
check('Weight "2 lb" -> 907 g',
  { canonical: r.canonical, unit: r.unit },
  { canonical: 907, unit: 'g' });

r = N.field('Weight', '1 kg');
check('Weight "1 kg" -> 1000 g',
  { canonical: r.canonical, unit: r.unit },
  { canonical: 1000, unit: 'g' });

/* ---------------- Battery Capacity ---------------- */

r = N.field('Battery Capacity', '10000 mAh');
check('Battery Capacity "10000 mAh" -> 10000 mAh',
  { canonical: r.canonical, unit: r.unit },
  { canonical: 10000, unit: 'mAh' });

r = N.field('Battery Capacity', '1 Ah');
check('Battery Capacity "1 Ah" -> 1000 mAh',
  { canonical: r.canonical, unit: r.unit },
  { canonical: 1000, unit: 'mAh' });

/* ---------------- Text ---------------- */

r = N.field('Brand', '  Lamicall  ');
check('Brand text is trimmed',
  { canonical: r.canonical, display: r.display },
  { canonical: 'Lamicall', display: 'Lamicall' });

r = N.field('Description', 'A &amp; B &lt; C');
check('Description text unescapes HTML entities',
  { canonical: r.canonical },
  { canonical: 'A & B < C' });

/* ---------------- Unregistered field ---------------- */

r = N.field('SomeUnknownField', 'whatever');
assert.strictEqual(r.canonical, 'whatever', 'Unregistered field passes through raw');
assert.ok(r.provenance.warnings.some(w => w.startsWith('unknown_field:')),
  'Unregistered field flags itself in provenance');
passed += 2;

/* ---------------- Empty / null inputs ---------------- */

r = N.field('Color', '');
check('Color empty -> [] canonical',
  { canonical: r.canonical, display: r.display },
  { canonical: [], display: [] });

r = N.field('Voltage', null);
check('Voltage null -> null canonical',
  { canonical: r.canonical, display: r.display },
  { canonical: null, display: '—' });

console.log(`normalize-v2.test.js: ${passed} assertions passed`);
