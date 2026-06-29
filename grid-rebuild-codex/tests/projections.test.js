const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');

function loadScript(ctx, relPath) {
  const source = fs.readFileSync(path.join(root, relPath), 'utf8');
  vm.runInContext(source, ctx, { filename: relPath });
}

function createContext() {
  const ctx = {
    console,
    globalThis: null,
    SSCanonical: {
      canonicalKey(value) {
        return String(value || '')
          .trim()
          .toLowerCase()
          .replace(/\bdots per inch\b/g, 'dpi')
          .replace(/\bvolts?\b/g, 'v')
          .replace(/\s+/g, ' ');
      }
    },
    SSSpecHeuristic: {
      specListOf(product) {
        return Array.isArray(product.rawSpecs) ? product.rawSpecs : [];
      }
    }
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  loadScript(ctx, 'shared/values/cellValues.js');
  loadScript(ctx, 'shared/projections/specProjection.js');
  loadScript(ctx, 'grid-rebuild-codex/projections.js');
  return ctx;
}

const products = [
  {
    id: 'p1',
    _revision: 7,
    title: 'ACME Precision Camera with Stabilization',
    brand: 'ACME',
    modelName: 'Action One',
    modelNumber: 'A1',
    newPrice: '$99.99',
    source: 'Amazon',
    rating: '4.7',
    reviewCount: '120',
    url: 'https://example.com/p1',
    image: 'https://example.com/p1.jpg',
    _spec: {
      specs: {
        'battery life': {
          rawValue: '2 hrs',
          canonicalValue: '2 hours',
          confidence: 0.82,
          source: 'official'
        }
      }
    },
    rawSpecs: [
      { key: 'Battery Life', value: '2 hours' },
      { key: 'Dots per inch', value: '800 DPI' }
    ]
  },
  {
    id: 'p2',
    _revision: 3,
    title: 'Budget Action Camera',
    brand: 'BudgetCo',
    modelNumber: 'B2',
    newPrice: '$59.00',
    source: 'Walmart',
    rating: '4.1',
    reviewCount: '40',
    url: 'https://example.com/p2',
    rawSpecs: [
      { key: 'battery life', value: '90 minutes' },
      { key: 'Voltage', value: '12 volts' }
    ]
  }
];

const original = JSON.stringify(products);
const ctx = createContext();
const projections = ctx.ShopScoutGridCodexProjections;

assert.ok(projections, 'Codex grid projection namespace is registered');
assert.equal(typeof projections.buildProductsRowsProjection, 'function',
  'products-as-rows projection is exposed');
assert.equal(typeof projections.buildComparisonMatrixProjection, 'function',
  'products-as-columns matrix projection is exposed');

const rowsProjection = projections.buildProductsRowsProjection(products, {
  visibleSpecKeys: ['battery life', 'dpi']
});

assert.equal(rowsProjection.mode, 'productsRows');
assert.deepEqual(
  rowsProjection.columns.map(column => column.id).slice(0, 9),
  ['select', 'thumb', 'title', 'brand', 'newPrice', 'source', 'modelName', 'rating', 'notes'],
  'products-as-rows starts with stable base columns'
);
assert.ok(rowsProjection.columns.some(column => column.id === 'spec:battery life'),
  'requested canonical spec columns are included');
assert.ok(rowsProjection.columns.some(column => column.id === 'spec:dpi'),
  'abbreviation-equivalent spec column is canonicalized');
assert.equal(
  rowsProjection.columns[rowsProjection.columns.length - 1].id,
  'actions',
  'row actions stay in the far-right final column after dynamic specs'
);
const reorderedProjection = projections.buildProductsRowsProjection(products, {
  visibleSpecKeys: ['battery life', 'dpi'],
  viewState: {
    columnOrder: ['actions', 'title', 'brand', 'spec:dpi', 'spec:battery life']
  }
});
assert.equal(
  reorderedProjection.columns[reorderedProjection.columns.length - 1].id,
  'actions',
  'saved column order cannot move row actions away from the far-right utility column'
);
assert.equal(rowsProjection.rows.length, 2);
assert.equal(rowsProjection.rows[0].id, 'p1');
assert.equal(rowsProjection.rows[0]._shopScout.productId, 'p1');
assert.equal(rowsProjection.rows[0]._shopScout.revision, 7);
assert.equal(rowsProjection.rows[0]['spec:battery life'], '2 hours');
assert.equal(rowsProjection.rows[0]['spec:dpi'], '800 DPI');
assert.equal(rowsProjection.rows[1]['spec:battery life'], '90 minutes');

const filteredProjection = projections.buildProductsRowsProjection(products, {
  visibleSpecKeys: ['battery life'],
  viewState: {
    filters: [{ field: 'brand', op: 'contains', value: 'acme' }]
  }
});
assert.deepEqual(
  filteredProjection.rows.map(row => row.id),
  ['p1'],
  'contains filters reduce the product rows before rendering'
);

const sortedProjection = projections.buildProductsRowsProjection(products, {
  visibleSpecKeys: ['battery life'],
  viewState: {
    sort: [{ field: 'newPrice', dir: 'asc' }]
  }
});
assert.deepEqual(
  sortedProjection.rows.map(row => row.id),
  ['p2', 'p1'],
  'numeric-like price fields sort by value, not string order'
);

const groupedProjection = projections.buildProductsRowsProjection(products, {
  visibleSpecKeys: ['battery life'],
  viewState: {
    group: 'source',
    sort: [{ field: 'newPrice', dir: 'asc' }]
  }
});
assert.equal(groupedProjection.rows[0]._isGroup, true, 'grouping inserts visible group header rows');
assert.equal(groupedProjection.rows[0]._group.field, 'source');
assert.equal(groupedProjection.rows[0]._group.value, 'Amazon');
assert.equal(groupedProjection.rows[0].title, 'Source: Amazon (1)');
assert.deepEqual(
  groupedProjection.rows.map(row => row.id),
  ['group:source:Amazon', 'p1', 'group:source:Walmart', 'p2'],
  'group headers wrap the rows for each grouped value'
);

const matrix = projections.buildComparisonMatrixProjection(products, {
  matrixMode: 'detailed',
  fields: ['newPrice', 'rating', 'spec:battery life', 'spec:dpi']
});

assert.equal(matrix.mode, 'comparisonMatrix');
assert.equal(matrix.matrixMode, 'detailed');
assert.deepEqual(
  matrix.columns.map(column => column.id),
  ['attribute', 'product:p1', 'product:p2'],
  'matrix has one attribute column plus one column per product'
);
assert.deepEqual(
  matrix.rows.map(row => row.id),
  ['newPrice', 'rating', 'spec:battery life', 'spec:dpi'],
  'matrix rows follow requested buying-factor fields'
);
assert.deepEqual(
  Object.keys(matrix.rows[2]['product:p1']).sort(),
  ['confidence', 'corrected', 'field', 'missing', 'productId', 'raw', 'revision', 'sources', 'value'].sort(),
  'matrix cells carry raw/corrected/confidence/source/missing metadata'
);
assert.equal(matrix.rows[2]['product:p1'].raw, '2 hrs');
assert.equal(matrix.rows[2]['product:p1'].corrected, '2 hours');
assert.equal(matrix.rows[2]['product:p1'].value, '2 hours');
assert.equal(matrix.rows[2]['product:p1'].confidence, 0.82);
assert.deepEqual(matrix.rows[2]['product:p1'].sources, ['official']);
assert.equal(matrix.rows[2]['product:p1'].missing, false);
assert.equal(matrix.rows[2]['product:p2'].value, '90 minutes');
assert.equal(matrix.rows[3]['product:p1'].value, '800 DPI');
assert.equal(matrix.rows[3]['product:p2'].missing, true);

const basic = projections.buildComparisonMatrixProjection(products, {
  matrixMode: 'basic',
  visibleSpecKeys: ['battery life']
});
assert.equal(basic.matrixMode, 'basic');
assert.ok(basic.rows.some(row => row.id === 'newPrice'), 'basic matrix keeps core price row');
assert.ok(basic.rows.some(row => row.id === 'spec:battery life'), 'basic matrix includes selected buying factor spec');
assert.ok(!basic.rows.some(row => row.id === 'spec:dpi'), 'basic matrix excludes non-selected specs');

assert.equal(JSON.stringify(products), original, 'projection builders do not mutate product objects');

console.log('grid-codex-projections.test.js: all assertions passed');
