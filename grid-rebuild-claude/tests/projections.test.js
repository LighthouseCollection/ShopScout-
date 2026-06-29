/* Tests for grid-rebuild-claude projections.
   Projection A (products-as-rows) and Projection B (products-as-
   columns) are pure functions of {products, state} — no DOM, no
   SlickGrid. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);

/* Load shared deps first so the projections can use them. */
function load(p) {
  vm.runInContext(fs.readFileSync(path.join(root, p), 'utf8'), ctx, { filename: p });
}
load('shared/values/cellValues.js');
load('shared/projections/specProjection.js');
load('grid-rebuild-claude/projections/matrixModes.js');
load('grid-rebuild-claude/projections/productsAsRows.js');
load('grid-rebuild-claude/projections/productsAsColumns.js');

const P = ctx.ShopScoutGridProjections;
assert.ok(P && P.productsAsRows && P.productsAsColumns && P.matrixModes,
  'all three projection modules registered');

const PRODUCTS = [
  {
    id: 'p1', title: 'Anker SoundCore', brand: 'Anker', source: 'Amazon',
    newPrice: '$59.99', rating: '4.6', userRating: 0, availability: 'In stock',
    notes: 'great bass',
    specs: [
      { key: 'Battery life', value: '20 hours' },
      { key: 'Bluetooth', value: '5.3' },
      { key: 'Weight', value: '350 g' }
    ]
  },
  {
    id: 'p2', title: 'JBL Flip 6', brand: 'JBL', source: 'Best Buy',
    newPrice: '$99.95', rating: '4.4', userRating: 3, availability: 'In stock',
    notes: '',
    specs: [
      { key: 'Battery life', value: '12 hours' },
      { key: 'Bluetooth', value: '5.1' },
      { key: 'Weight', value: '550 g' },
      { key: 'Waterproof', value: 'IP67' }
    ]
  },
  {
    id: 'p3', title: 'Bose SoundLink Flex', brand: 'Bose', source: 'Amazon',
    newPrice: '$149.00', rating: '4.7', userRating: 5, availability: 'Out of stock',
    notes: 'wait for sale',
    specs: [
      { key: 'Battery life', value: '12 hours' },
      { key: 'Bluetooth', value: '4.2' }
    ]
  }
];

/* =========================================================
   Projection A — products as rows
   ========================================================= */
{
  const projection = P.productsAsRows.project(PRODUCTS, { mode: 'rows' });
  assert.strictEqual(projection.kind, 'rows');
  assert.strictEqual(projection.rows.length, 3);
  assert.strictEqual(projection.visibleCount, 3);
  assert.strictEqual(projection.totalCount, 3);

  /* Columns include built-in product fields. */
  const colIds = projection.columns.map(c => c.id);
  for (const id of ['thumb', 'title', 'brand', 'source', 'newPrice', 'rating', 'userRating', 'notes']) {
    assert.ok(colIds.includes(id), `built-in column ${id} present`);
  }
  /* Spec columns are hoisted under spec:<key>. */
  assert.ok(colIds.some(id => id.startsWith('spec:Battery life') || id.startsWith('spec:Battery')),
    'a Battery-life spec column appears');

  /* Row values reflect the flattened spec hoist. */
  const row1 = projection.rows.find(r => r.id === 'p2');
  assert.strictEqual(row1.brand, 'JBL');
  assert.ok(row1['spec:Battery life'] === '12 hours' || row1['spec:Battery'] === '12 hours',
    'spec value hoisted onto row');
}

/* ---- Filtering on Projection A reduces rows ------------------ */
{
  const projection = P.productsAsRows.project(PRODUCTS, {
    mode: 'rows',
    filters: [{ field: 'brand', op: 'eq', value: 'JBL' }]
  });
  assert.strictEqual(projection.visibleCount, 1);
  assert.strictEqual(projection.rows[0].brand, 'JBL');
  assert.strictEqual(projection.totalCount, 3, 'totalCount unchanged by filter');
}

/* ---- Compound AND filter ------------------------------------- */
{
  const projection = P.productsAsRows.project(PRODUCTS, {
    mode: 'rows',
    filters: [
      { field: 'source', op: 'eq', value: 'Amazon' },
      { field: 'rating', op: 'gte', value: 4.7, conj: 'and' }
    ]
  });
  assert.strictEqual(projection.visibleCount, 1);
  assert.strictEqual(projection.rows[0].brand, 'Bose');
}

/* ---- Sort asc/desc on numeric ------------------------------- */
{
  const asc = P.productsAsRows.project(PRODUCTS, {
    mode: 'rows', sort: [{ field: 'newPrice', dir: 'asc' }]
  });
  assert.strictEqual(JSON.stringify(asc.rows.map(r => r.brand)),
    JSON.stringify(['Anker', 'JBL', 'Bose']));

  const desc = P.productsAsRows.project(PRODUCTS, {
    mode: 'rows', sort: [{ field: 'rating', dir: 'desc' }]
  });
  assert.strictEqual(JSON.stringify(desc.rows.map(r => r.brand)),
    JSON.stringify(['Bose', 'Anker', 'JBL']));
}

/* ---- Search across visible fields --------------------------- */
{
  const projection = P.productsAsRows.project(PRODUCTS, {
    mode: 'rows', search: 'flip'
  });
  assert.strictEqual(projection.visibleCount, 1);
  assert.strictEqual(projection.rows[0].title, 'JBL Flip 6');
}

/* ---- Filtering does NOT mutate the input products ------------ */
{
  const before = JSON.stringify(PRODUCTS);
  P.productsAsRows.project(PRODUCTS, {
    mode: 'rows', filters: [{ field: 'brand', op: 'eq', value: 'JBL' }]
  });
  assert.strictEqual(JSON.stringify(PRODUCTS), before, 'projection did not mutate products');
}

/* =========================================================
   Projection B — products as columns
   ========================================================= */
{
  /* Basic Matrix */
  const projection = P.productsAsColumns.project(PRODUCTS, {
    mode: 'columns', matrix: 'basic'
  });
  assert.strictEqual(projection.kind, 'columns');
  assert.strictEqual(projection.matrixMode, 'basic');
  assert.strictEqual(projection.visibleProductCount, 3);

  /* Columns: 1 attribute + N products. */
  assert.strictEqual(projection.columns[0].id, '__attr', 'first column is attribute');
  assert.strictEqual(projection.columns.length, 4);

  /* Rows are spec rows; each has __attr label + product cells. */
  const brandRow = projection.rows.find(r => r.__id === 'core:brand');
  assert.ok(brandRow, 'brand row exists');
  assert.strictEqual(brandRow.__attr, 'Brand');
  const p1Cell = brandRow['product:p1'];
  assert.ok(p1Cell && typeof p1Cell === 'object', 'cell is DisplayCell shape');
  assert.strictEqual(p1Cell.raw, 'Anker');
  assert.strictEqual(p1Cell.missing, false);
}

/* ---- Basic matrix has fewer rows than detailed --------------- */
{
  const basic    = P.productsAsColumns.project(PRODUCTS, { mode: 'columns', matrix: 'basic' });
  const detailed = P.productsAsColumns.project(PRODUCTS, { mode: 'columns', matrix: 'detailed' });
  assert.strictEqual(basic.matrixMode, 'basic');
  assert.strictEqual(detailed.matrixMode, 'detailed');
  assert.ok(detailed.specRowCount > basic.specRowCount,
    'detailed matrix has more rows than basic (' + detailed.specRowCount + ' > ' + basic.specRowCount + ')');
}

/* ---- Detailed matrix includes union of specs across products - */
{
  const projection = P.productsAsColumns.project(PRODUCTS, {
    mode: 'columns', matrix: 'detailed'
  });
  const attrs = projection.rows.map(r => r.__attr);
  for (const k of ['Battery life', 'Bluetooth', 'Weight', 'Waterproof']) {
    assert.ok(attrs.includes(k), `Detailed matrix includes spec "${k}"`);
  }
  /* "Waterproof" only exists on p2; p1 + p3 should show missing. */
  const wpRow = projection.rows.find(r => r.__attr === 'Waterproof');
  assert.strictEqual(wpRow['product:p1'].missing, true, 'missing flag on absent spec (p1)');
  assert.strictEqual(wpRow['product:p2'].missing, false, 'present on p2');
  assert.strictEqual(wpRow['product:p3'].missing, true, 'missing flag on absent spec (p3)');
}

/* ---- Filtering products in Projection B reduces product cols - */
{
  const projection = P.productsAsColumns.project(PRODUCTS, {
    mode: 'columns', matrix: 'basic',
    filters: [{ field: 'source', op: 'eq', value: 'Amazon' }]
  });
  /* 1 attribute + 2 Amazon products = 3 columns */
  assert.strictEqual(projection.columns.length, 3);
  assert.strictEqual(projection.visibleProductCount, 2);
}

/* ---- Spec-row search filters spec rows ----------------------- */
{
  const projection = P.productsAsColumns.project(PRODUCTS, {
    mode: 'columns', matrix: 'detailed', specRowSearch: 'battery'
  });
  /* All non-spec rows (core + meta) survive; spec rows are filtered. */
  const specRows = projection.rows.filter(r => r.__kind === 'spec');
  assert.strictEqual(specRows.length, 1, 'only the Battery spec row survives');
  assert.strictEqual(specRows[0].__attr, 'Battery life');
}

console.log('grid-rebuild-claude projections.test.js: all assertions passed');
