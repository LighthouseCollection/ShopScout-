/* Unit tests for data/canonical.js + data/specHeuristic.js.
   We don't load the Shopify/Google txt files here (no fetch in Node), but we
   exercise the synchronous abbreviation table and the spec heuristic. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const canonicalSrc = fs.readFileSync(path.join(__dirname, '..', 'data', 'canonical.js'), 'utf8');
const productSpecAccessSrc = fs.readFileSync(path.join(__dirname, '..', 'shared', 'productSpecAccess.js'), 'utf8');
const heuristicSrc = fs.readFileSync(path.join(__dirname, '..', 'data', 'specHeuristic.js'), 'utf8');

const ctx = {
  console,
  setTimeout, clearTimeout,
  /* No fetch — the ready() path isn't exercised here. canonicalKey works
     without it via the static abbreviation table. */
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(canonicalSrc, ctx, { filename: 'canonical.js' });
vm.runInContext(productSpecAccessSrc, ctx, { filename: 'productSpecAccess.js' });
vm.runInContext(heuristicSrc, ctx, { filename: 'specHeuristic.js' });

const C = ctx.SSCanonical;
const H = ctx.SSSpecHeuristic;

/* ---- canonicalKey ---- */
assert.strictEqual(C.canonicalKey('dots per inch'),  'DPI',  'DPI alias');
assert.strictEqual(C.canonicalKey('Dots Per Inch'),  'DPI',  'DPI alias (mixed case)');
assert.strictEqual(C.canonicalKey('DPI'),            'DPI',  'DPI passthrough');
assert.strictEqual(C.canonicalKey('watts'),          'W',    'watts -> W');
assert.strictEqual(C.canonicalKey('milliamp-hour'),  'mAh',  'milliamp-hour -> mAh');
assert.strictEqual(C.canonicalKey('inches'),         '"',    'inches -> "');
assert.strictEqual(C.canonicalKey('  RPM  '),        'RPM',  'whitespace tolerated');
assert.strictEqual(C.canonicalKey(''),               '',     'empty -> empty');
assert.strictEqual(C.canonicalKey(null),             '',     'null -> empty');
/* Unknown key — passthrough preserved with original casing */
assert.strictEqual(C.canonicalKey('Custom Field'),   'Custom Field', 'unknown key passthrough');
assert.strictEqual(C.canonicalValue, undefined, 'canonicalValue is retired; v2 normalization owns value display');

/* ---- abbreviation table sanity ---- */
const abbr = C._abbreviations;
assert.ok(abbr.DPI && abbr.W && abbr.kg && abbr.GHz, 'core abbreviation entries present');

/* ---- spec heuristic: empty input ----
   The arrays returned cross a vm-context boundary, so their Array prototypes
   differ from the test file's. Compare by length + contents instead of by
   reference-equal prototype (which deepStrictEqual requires). */
function isEmptyArray(v) { return v && typeof v.length === 'number' && v.length === 0; }
assert.ok(isEmptyArray(H.pickDefaultSpecColumns([])),       'empty list -> empty default');
assert.ok(isEmptyArray(H.pickDefaultSpecColumns(null)),     'null list -> empty default');
assert.ok(isEmptyArray(H.allSpecKeys([])),                  'empty allSpecKeys');

/* ---- spec heuristic: TV list, simulated ---- */
const tvs = [
  { specs: [{ key: 'Screen size', value: '65 in' }, { key: 'Refresh rate', value: '120Hz' }, { key: 'Resolution', value: '4K' }, { key: 'HDMI ports', value: '4' }] },
  { specs: [{ key: 'Screen size', value: '55"' },   { key: 'Refresh rate', value: '60Hz' },  { key: 'Resolution', value: '4K' }] },
  { specs: [{ key: 'Screen size', value: '75 in' }, { key: 'Refresh rate', value: '120Hz' }, { key: 'Resolution', value: '8K' }, { key: 'HDMI ports', value: '3' }] },
  { specs: [{ key: 'Screen size', value: '50 in' }, { key: 'Refresh rate', value: '60Hz' },  { key: 'Resolution', value: '4K' }] }
];

const tvDefaults = H.pickDefaultSpecColumns(tvs, { topN: 5, minCoverage: 0.5 });
assert.ok(tvDefaults.includes('Screen size'),  'TV defaults include Screen size');
assert.ok(tvDefaults.includes('Refresh rate'), 'TV defaults include Refresh rate');
assert.ok(tvDefaults.includes('Resolution'),   'TV defaults include Resolution');
/* HDMI ports is in 2 of 4 (50% coverage) — included at the boundary */
assert.ok(tvDefaults.includes('HDMI ports'),   'TV defaults include HDMI ports at boundary');

/* allSpecKeys returns every distinct canonical key */
const allKeys = H.allSpecKeys(tvs);
assert.ok(allKeys.includes('Screen size'),  'allSpecKeys includes Screen size');
assert.ok(allKeys.includes('HDMI ports'),   'allSpecKeys includes HDMI ports');
assert.strictEqual(new Set(allKeys).size, allKeys.length, 'allSpecKeys returns distinct values');

/* getSpecValueFor pulls the raw value */
assert.strictEqual(H.getSpecValueFor(tvs[0], 'Screen size'),  '65 in', 'getSpecValueFor row 0 Screen size');
assert.strictEqual(H.getSpecValueFor(tvs[1], 'HDMI ports'),   '',      'getSpecValueFor row 1 missing key -> empty');

const productSpecOnly = [{
  _spec: {
    itemDetails: {
      Material: {
        rawKey: 'Material',
        rawValue: 'SS304',
        canonicalValue: 'Stainless Steel 304',
        source: 'manufacturer',
        confidence: 0.9
      }
    }
  }
}];
assert.ok(H.allSpecKeys(productSpecOnly).includes('Material'), 'spec heuristic reads ProductSpec-only fields');
assert.strictEqual(H.getSpecValueFor(productSpecOnly[0], 'Material'), 'Stainless Steel 304', 'ProductSpec-only values use ProductSpec display');

/* ---- spec heuristic: respects coverage threshold ---- */
const mixed = [
  { specs: [{ key: 'A', value: '1' }, { key: 'B', value: '1' }] },
  { specs: [{ key: 'A', value: '2' }] },
  { specs: [{ key: 'A', value: '3' }] },
  { specs: [{ key: 'A', value: '4' }, { key: 'C', value: 'X' }] }
];
const mixedDefaults = H.pickDefaultSpecColumns(mixed, { topN: 5, minCoverage: 0.5 });
assert.ok(mixedDefaults.includes('A'),  'A covers 100% -> included');
assert.ok(!mixedDefaults.includes('B'), 'B covers 25% -> excluded under 50%');
assert.ok(!mixedDefaults.includes('C'), 'C covers 25% -> excluded under 50%');

/* ---- spec heuristic: respects topN ---- */
const many = [{
  specs: 'abcdefghij'.split('').map(k => ({ key: 'Key' + k, value: 'v' }))
}];
const top3 = H.pickDefaultSpecColumns(many, { topN: 3, minCoverage: 0.5 });
assert.strictEqual(top3.length, 3, 'topN caps the result');

/* ---- viewport-aware spec column cap ---- */
const M = H.maxSpecColumnsForWidth;
assert.strictEqual(M(0),    0,  'zero width -> zero columns');
assert.strictEqual(M(500),  0,  'too-narrow viewport -> zero spec columns');
/* Defaults: system 152 + baseData 980 + safety 20 = 1152 baseline.
   At 1280px we have 128 left, /140 -> 0 spec columns. */
assert.strictEqual(M(1280), 0,  '1280px viewport: defaults consumed, no spec columns');
assert.strictEqual(M(1440), 2,  '1440px: 2 spec columns fit');
assert.strictEqual(M(1920), 5,  '1920px: 5 spec columns fit (matches the old fixed top-5)');
assert.ok(M(2560) >= 9,         '2560px: 9+ spec columns fit on a wide screen');
assert.ok(M(3840) >= 19,        '3840px (4K): many spec columns fit');

/* Overrides accepted */
assert.strictEqual(M(1920, { specColumnWidth: 80 }), 9, 'narrower spec columns -> more fit');

console.log('canonical.test.js: 30 assertions passed');
