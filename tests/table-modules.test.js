const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = [
  'table/tableUtils.js',
  'table/productRows.js'
];

const ctx = {
  globalThis: null,
  console,
  SSCanonical: {
    canonicalKey(key) {
      return String(key || '')
        .replace(/dots per inch/i, 'DPI')
        .replace(/\s+/g, ' ')
        .trim();
    }
  },
  SSSpecHeuristic: {
    specListOf(product) { return Array.isArray(product.specs) ? product.specs : []; }
  },
  SSCellFormatters: {
    computeRanks(rows, field, polarity) {
      rows.forEach((row, index) => {
        row._rankCalls = row._rankCalls || [];
        row._rankCalls.push(`${field}:${polarity}:${index}`);
      });
    }
  }
};
ctx.globalThis = ctx;
vm.createContext(ctx);

for (const file of files) {
  const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInContext(src, ctx, { filename: file });
}

const table = ctx.ShopScoutTable;
assert.ok(table, 'ShopScoutTable namespace is exposed');
assert.ok(table.utils, 'table utils module is exposed');
assert.ok(table.productRows, 'product row module is exposed');

assert.strictEqual(table.utils.escapeHtml('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
assert.strictEqual(table.utils.parseNumeric('$1,234.50'), 1234.5);
assert.strictEqual(table.utils.numericSorter('$10', '$2'), 8);
assert.strictEqual(table.utils.truncate('abcdefghijklmnopqrstuvwxyz', 8), 'abcdefg…');

const rows = table.productRows.flattenSpecs([
  {
    id: 'p1',
    title: 'Camera',
    newPrice: '$50',
    rating: '4.5',
    specs: [
      { key: 'Dots per inch', value: '1200' },
      { key: 'dots per inch', value: 'duplicate should be ignored' },
      { key: 'Voltage', value: '12V' }
    ]
  }
]);

assert.strictEqual(rows[0]['spec:DPI'], '1200', 'spec keys are canonicalized');
assert.strictEqual(rows[0]['spec:Voltage'], '12V', 'spec values are flattened');
assert.strictEqual(rows[0]['spec:dots per inch'], undefined, 'duplicate canonical spec is ignored');
assert.ok(rows[0]._rankCalls.includes('newPrice:low:0'), 'visible price ranks are precomputed');
assert.ok(rows[0]._rankCalls.includes('rating:high:0'), 'visible rating ranks are precomputed');

const pivot = table.productRows.flattenForPivot([
  { source: 'Amazon', category: { value: 'Bad object' }, newPrice: '$12.50', rating: '4.8', specs: [{ key: 'A', value: 'B' }], bullets: ['x'], capturedAt: Date.UTC(2026, 0, 1) }
]);

assert.deepStrictEqual(
  { source: pivot[0].source, category: pivot[0].category, newPrice: pivot[0].newPrice, rating: pivot[0].rating, specsCount: pivot[0].specsCount, bulletsCount: pivot[0].bulletsCount, capturedYear: pivot[0].capturedYear },
  { source: 'Amazon', category: '', newPrice: 12.5, rating: 4.8, specsCount: 1, bulletsCount: 1, capturedYear: 2026 },
  'pivot rows are scalar-only and numeric fields are parsed'
);

console.log('table-modules.test.js: all assertions passed');
