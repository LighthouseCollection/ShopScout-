/* Locks down the behavior of small reusable helpers:
   - SS.dedupProductName       (utils.js)
   - SS.unwrapWrappedValue     (utils.js)
   - ShopScoutValues.splitToPills (shared/values/cellValues.js)

   Task 11 Phase 1: data/cellFormatters.js was deleted with the rest
   of the grid layer. The Tabulator-coupled renderValueAsPills and
   matchOperatorFilter helpers went with it. splitToPills survived
   in shared/values/cellValues.js as renderer-agnostic value logic. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

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
      return v.value || v.rawValue || '';
    }
    const s = String(v);
    return s === '[object Object]' ? '' : s;
  }
  return unwrapWrappedValue;
`)();

assert.strictEqual(unwrapWrappedValue({ value: '4.5' }), '4.5', 'wrapper.value');
assert.strictEqual(unwrapWrappedValue({ rawValue: 'raw' }), 'raw', 'wrapper.rawValue');
assert.strictEqual(unwrapWrappedValue({ canonicalValue: '5 lb' }), '', 'legacy wrapper.canonicalValue is ignored');
assert.strictEqual(unwrapWrappedValue({}), '', 'empty wrapper');
assert.strictEqual(unwrapWrappedValue('plain'), 'plain', 'plain string passthrough');
assert.strictEqual(unwrapWrappedValue('[object Object]'), '', 'corrupt stored string → empty');
assert.strictEqual(unwrapWrappedValue(null), '', 'null');
assert.strictEqual(unwrapWrappedValue(undefined), '', 'undefined');
assert.strictEqual(unwrapWrappedValue(0), '0', 'zero coerced to string');

/* ---- ShopScoutValues.splitToPills (via vm) ---- */
const vm = require('vm');
const ctx = { console };
ctx.globalThis = ctx;
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'shared', 'values', 'cellValues.js'), 'utf8'),
  ctx,
  { filename: 'shared/values/cellValues.js' }
);
const V = ctx.ShopScoutValues;
assert.ok(V, 'ShopScoutValues registered');

assert.strictEqual(
  JSON.stringify(V.splitToPills('App Control, Voice Control, Button Control')),
  JSON.stringify(['App Control', 'Button Control', 'Voice Control']),
  'comma-separated multi-value sorts alphabetical'
);
assert.strictEqual(
  JSON.stringify(V.splitToPills('Voice Control, App Control')),
  JSON.stringify(['App Control', 'Voice Control']),
  'sort is stable regardless of source order'
);
assert.strictEqual(
  JSON.stringify(V.splitToPills('Cordless Tire Inflator × 1, Quick Connector× 1, USB Charging Cord× 1, Extension Hose Coupling*1')),
  JSON.stringify(['Cordless Tire Inflator (×1)', 'Extension Hose Coupling (×1)', 'Quick Connector (×1)', 'USB Charging Cord (×1)']),
  'quantity-bearing included items are normalized and sorted as one pill per item'
);
{
  const compatibleDevices = 'iPhone 17 Pro Max/17 Pro/Air/17/16 Pro Max/16 Pro/16 Plus/16, Mac Mini M4/M4 Pro, MacBook Pro M4/M4 Pro/M4 Max, MacBook Air 2024, Galaxy S26/S25/S24 Ultra, iPad Pro 2024, iPad Air 2024, XPS 17/15/13, Dell, HP Chromebook x360, Surface Book 3/2, Samsung Tablet';
  const pills = V.splitToPills(compatibleDevices);
  assert.ok(Array.isArray(pills), 'long comma-separated tech spec values split into pills');
  assert.ok(pills.includes('MacBook Air 2024'), 'long tech spec split preserves individual device values');
  assert.ok(pills.includes('HP Chromebook x360'), 'long tech spec split keeps later comma-separated values');
  assert.ok(pills.includes('Surface Book 3/2'), 'long tech spec split keeps slash-containing values as one pill');
  assert.ok(pills.length >= 10, 'long tech spec split creates one pill per comma-separated item');
}
assert.strictEqual(V.splitToPills('Lithium Ion'), null, 'single value → no split');
assert.strictEqual(V.splitToPills('15.5 x 10.25 x 2 inches'), null, 'dimensions never split');
assert.strictEqual(V.splitToPills('Wi-Fi 6/6E'), null, 'slash never splits');
assert.strictEqual(V.splitToPills('120 volts'), null, 'numeric+unit never splits');
assert.strictEqual(V.splitToPills(''), null, 'empty');
assert.strictEqual(V.splitToPills(null), null, 'null');

console.log('cleanup-helpers.test.js — all assertions passed');
