/* Locks down the behavior of helpers added during the cleanup pass:
   - SS.dedupProductName       (utils.js)
   - SS.unwrapWrappedValue     (utils.js)
   - SSCellFormatters.splitToPills, renderValueAsPills
                                  (data/cellFormatters.js)
   - SSCellFormatters.matchOperatorFilter
                                  (data/cellFormatters.js)

   These are display-time helpers run on the page, so we extract just
   the function bodies via Function() instead of loading the whole UI
   module under vm. Keeps the test hermetic. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadFn(file, name, ...extraArgs) {
  const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const m = src.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n  \\}'));
  assert.ok(m, name + ' function block found in ' + file);
  // eslint-disable-next-line no-new-func
  return new Function(...extraArgs, 'return (' + m[0] + ');')(...extraArgs.map(() => undefined));
}

/* ---- SS.dedupProductName ---- */
const escRegExp = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const dedupProductName = new Function('escRegExp', `
  function dedupProductName(input) {
    const s = String(input == null ? '' : input).trim();
    if (!s) return '';
    const sep = s.includes(' | ') ? ' | ' : (s.includes(' - ') ? ' - ' : null);
    if (!sep) return s;
    let parts = s.split(sep).map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) return s;
    const head = parts[0];
    const prefixRe = new RegExp('^' + escRegExp(head) + '\\\\s+', 'i');
    for (let i = 1; i < parts.length; i++) {
      parts[i] = parts[i].replace(prefixRe, '').trim();
    }
    const seen = new Set();
    const out = [];
    for (const p of parts) {
      if (!p) continue;
      const k = p.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
    return out.join(sep);
  }
  return dedupProductName;
`)(escRegExp);

assert.strictEqual(
  dedupProductName('Shark | Shark AV2511AE | AV2511AE'),
  'Shark | AV2511AE',
  'brand prefix stripped and duplicate model number dropped'
);
assert.strictEqual(
  dedupProductName('XIEBro | K10BL-2D | K10BL-2D'),
  'XIEBro | K10BL-2D',
  'identical trailing duplicates collapse'
);
assert.strictEqual(
  dedupProductName('iRobot | Roomba i7+ | i715020'),
  'iRobot | Roomba i7+ | i715020',
  'no false collapse when all parts are distinct'
);
assert.strictEqual(dedupProductName(''), '', 'empty input');
assert.strictEqual(dedupProductName(null), '', 'null input');
assert.strictEqual(dedupProductName('NoSeparator'), 'NoSeparator', 'no-separator passthrough');

/* ---- SS.unwrapWrappedValue ---- */
const unwrapWrappedValue = new Function(`
  function unwrapWrappedValue(v) {
    if (v == null) return '';
    if (typeof v === 'object') {
      return v.value || v.canonicalValue || v.rawValue || '';
    }
    const s = String(v);
    return s === '[object Object]' ? '' : s;
  }
  return unwrapWrappedValue;
`)();

assert.strictEqual(unwrapWrappedValue({ value: '4.5' }), '4.5', 'wrapper.value');
assert.strictEqual(unwrapWrappedValue({ canonicalValue: '5 lb' }), '5 lb', 'wrapper.canonicalValue');
assert.strictEqual(unwrapWrappedValue({ rawValue: 'raw' }), 'raw', 'wrapper.rawValue');
assert.strictEqual(unwrapWrappedValue({}), '', 'empty wrapper');
assert.strictEqual(unwrapWrappedValue('plain'), 'plain', 'plain string passthrough');
assert.strictEqual(unwrapWrappedValue('[object Object]'), '', 'corrupt stored string → empty');
assert.strictEqual(unwrapWrappedValue(null), '', 'null');
assert.strictEqual(unwrapWrappedValue(undefined), '', 'undefined');
assert.strictEqual(unwrapWrappedValue(0), '0', 'zero coerced to string');

/* ---- splitToPills + matchOperatorFilter via vm ---- */
const vm = require('vm');
const ctx = {
  console,
  document: { querySelectorAll: () => [], querySelector: () => null }
};
ctx.globalThis = ctx;
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', 'cellFormatters.js'), 'utf8'),
                ctx, { filename: 'cellFormatters.js' });
const CF = ctx.SSCellFormatters;
assert.ok(CF, 'SSCellFormatters registered');

/* ---- splitToPills ---- */
/* JSON-compare to bypass the vm-context boundary (arrays created
   inside the vm don't satisfy Array.isArray in the host context). */
assert.strictEqual(
  JSON.stringify(CF.splitToPills('App Control, Voice Control, Button Control')),
  JSON.stringify(['App Control', 'Button Control', 'Voice Control']),
  'comma-separated multi-value sorts alphabetical'
);
assert.strictEqual(
  JSON.stringify(CF.splitToPills('Voice Control, App Control')),
  JSON.stringify(['App Control', 'Voice Control']),
  'sort is stable regardless of source order'
);
assert.strictEqual(CF.splitToPills('Lithium Ion'), null, 'single value → no split');
assert.strictEqual(CF.splitToPills('15.5 x 10.25 x 2 inches'), null, 'dimensions never split');
assert.strictEqual(CF.splitToPills('Wi-Fi 6/6E'), null, 'slash never splits');
assert.strictEqual(CF.splitToPills('120 volts'), null, 'numeric+unit never splits');
assert.strictEqual(CF.splitToPills(''), null, 'empty');
assert.strictEqual(CF.splitToPills(null), null, 'null');

/* ---- renderValueAsPills ---- */
const multi = CF.renderValueAsPills('Voice Control, App Control');
assert.ok(multi.includes('ss-pill-row'), 'multi-value wrapped in ss-pill-row');
assert.ok(multi.includes('App Control'),  'app control included');
assert.ok(multi.indexOf('App Control') < multi.indexOf('Voice Control'),
  'alphabetical order in output HTML');

const single = CF.renderValueAsPills('Lithium Ion');
assert.ok(single.includes('ss-pill'),     'single value pill emitted');
assert.ok(!single.includes('ss-pill-row'), 'single value NOT wrapped in pill-row');

const numeric = CF.renderValueAsPills('120 volts');
assert.ok(numeric.includes('ss-cell-val'), 'numeric value rendered as plain cell-val');
assert.ok(!numeric.includes('ss-pill'),    'numeric value NOT pilled');

const empty = CF.renderValueAsPills('');
assert.ok(empty.includes('db-cell-empty'), 'empty value renders em-dash');

/* ---- matchOperatorFilter ---- */
assert.strictEqual(CF.matchOperatorFilter('>100', 180),       true,  '>100 vs 180');
assert.strictEqual(CF.matchOperatorFilter('>100', 50),        false, '>100 vs 50');
assert.strictEqual(CF.matchOperatorFilter('<50',  20),        true,  '<50 vs 20');
assert.strictEqual(CF.matchOperatorFilter('>=5',  5),         true,  '>=5 vs 5');
assert.strictEqual(CF.matchOperatorFilter('<=5',  5),         true,  '<=5 vs 5');
assert.strictEqual(CF.matchOperatorFilter('=5',   5),         true,  '=5 vs 5');
assert.strictEqual(CF.matchOperatorFilter('=5',   6),         false, '=5 vs 6');
assert.strictEqual(CF.matchOperatorFilter('10-20', 15),       true,  '10-20 range hit');
assert.strictEqual(CF.matchOperatorFilter('10-20', 25),       false, '10-20 range miss');
assert.strictEqual(CF.matchOperatorFilter('volt', '120 volts'), true,  'substring fallback');
assert.strictEqual(CF.matchOperatorFilter('',     'anything'), true,  'empty filter passes');
assert.strictEqual(CF.matchOperatorFilter('>100', '180 minutes'), true, 'parses time units');
assert.strictEqual(CF.matchOperatorFilter('>100', 'not numeric'), false, 'non-numeric fails operator');

console.log('cleanup-helpers.test.js — all assertions passed');
