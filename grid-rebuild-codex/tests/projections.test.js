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
  loadScript(ctx, 'normalization/libraries/defaultRules.js');
  loadScript(ctx, 'normalization/userRules.js');
  loadScript(ctx, 'normalization/attributes.js');
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
      { key: 'Dots per inch', value: '800 DPI' },
      { key: 'Colour', value: 'midnight blue' }
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
      { key: 'Voltage', value: '12 volts' },
      { key: 'Power Source', value: 'wired' }
    ]
  }
];

const identityProducts = [
  {
    id: 'p3',
    title: 'Microsoft Microsoft ANB-00001 Full Marketplace Title',
    brand: 'Microsoft',
    manufacturer: 'Microsoft',
    maker: 'Microsoft',
    modelNumber: 'ANB-00001'
  },
  {
    id: 'p4',
    title: 'Generic fallback title with no structured identity'
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
  visibleSpecKeys: ['battery life', 'dpi', 'Color', 'Power Source']
});

assert.equal(rowsProjection.mode, 'productsRows');
assert.deepEqual(
  rowsProjection.columns.map(column => column.id).slice(0, 8),
  ['select', 'thumb', 'title', 'brand', 'newPrice', 'modelName', 'rating', 'spec:battery life'],
  'products-as-rows hides Source AND any all-empty column (fixtures have no notes value) from the default view'
);
assert.ok(rowsProjection.allColumns.some(column => column.id === 'notes'),
  'Notes remains available in the columns modal even when hidden because no product currently has a value');
assert.ok(rowsProjection.allColumns.some(column => column.id === 'source'),
  'Source remains available in the columns modal even when hidden by default');
assert.ok(!rowsProjection.columns.some(column => column.id === 'source'),
  'Source is not visible until the user explicitly enables it');
const sourceEnabledProjection = projections.buildProductsRowsProjection(products, {
  visibleSpecKeys: ['battery life'],
  viewState: { columnVisibility: { source: true } }
});
assert.ok(sourceEnabledProjection.columns.some(column => column.id === 'source'),
  'Source can be explicitly re-enabled from column visibility state');
assert.ok(rowsProjection.columns.some(column => column.id === 'spec:battery life'),
  'requested canonical spec columns are included');
assert.ok(rowsProjection.columns.some(column => column.id === 'spec:dpi'),
  'abbreviation-equivalent spec column is canonicalized');
assert.ok(rowsProjection.columns.some(column => column.id === 'spec:color'),
  'attribute-normalized spec field aliases are exposed under canonical field names');
assert.ok(
  !rowsProjection.columns.some(column => column.id === 'actions'),
  'standalone actions column has been removed — actions render under the thumbnail in the image cell'
);
assert.ok(
  !rowsProjection.allColumns.some(column => column.id === 'actions'),
  'standalone actions column no longer appears in allColumns either'
);
const reorderedProjection = projections.buildProductsRowsProjection(products, {
  visibleSpecKeys: ['battery life', 'dpi'],
  viewState: {
    columnOrder: ['title', 'brand', 'spec:dpi', 'spec:battery life']
  }
});
assert.ok(
  !reorderedProjection.columns.some(column => column.id === 'actions'),
  'a saved column order that used to reference actions is honored, and the column simply isn\'t there'
);
assert.equal(rowsProjection.rows.length, 2);
assert.equal(rowsProjection.rows[0].id, 'p1');
assert.equal(rowsProjection.rows[0]._shopScout.productId, 'p1');
assert.equal(rowsProjection.rows[0]._shopScout.revision, 7);
assert.equal(rowsProjection.rows[0]['spec:battery life'], '2 hours');
assert.equal(rowsProjection.rows[0]['spec:dpi'], '800 DPI');
assert.equal(rowsProjection.rows[0]['spec:color'], 'Navy Blue');
assert.deepEqual(rowsProjection.rows[0]._shopScout.normalizedAttributes['Color'], {
  rawField: 'Colour',
  raw: 'midnight blue',
  normalized: 'Navy Blue',
  confidence: 0.95,
  rule: 'enum:color:navy-blue'
});
assert.equal(rowsProjection.rows[1]['spec:battery life'], '90 minutes');
assert.equal(rowsProjection.rows[1]['spec:power source'], 'Corded Electric');

const identityProjection = projections.buildProductsRowsProjection(identityProducts, {});
assert.equal(identityProjection.rows[0].title, 'Microsoft | ANB-00001',
  'name field uses one maker/brand/manufacturer value plus model number without duplicate maker text');
assert.equal(identityProjection.rows[1].title, 'Generic fallback title with no structured identity',
  'name field falls back to captured title when structured maker/model fields are unavailable');

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
assert.deepEqual(
  groupedProjection.rows.map(row => row.id),
  ['p2', 'p1'],
  'projection leaves grouped rows as product rows so SlickGrid DataView can render native groups'
);
assert.deepEqual(groupedProjection.sort, [{ field: 'newPrice', dir: 'asc' }],
  'grouped projections keep active sort metadata for the grid header');
assert.deepEqual(groupedProjection.grouping, {
  field: 'source',
  label: 'Source'
}, 'grouped projections expose native grouping metadata instead of fake rows');

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
assert.equal(matrix.columns[1].image, 'https://example.com/p1.jpg',
  'matrix product columns carry the product thumbnail for header rendering');
assert.equal(matrix.columns[1].url, 'https://example.com/p1',
  'matrix product columns carry the product URL for header/source interactions');
assert.equal(matrix.columns[1].source, 'Amazon',
  'matrix product columns carry the product source metadata');
assert.ok(Array.isArray(matrix.groupColumns), 'matrix projection carries field columns for group-by controls');
assert.ok(matrix.groupColumns.some(column => column.id === 'brand'), 'matrix group columns include Brand');
assert.ok(!matrix.groupColumns.some(column => column.id.startsWith('product:')),
  'matrix group columns are fields, not product columns');
assert.deepEqual(
  matrix.rows.map(row => row.id),
  ['newPrice', 'rating', 'spec:battery life', 'spec:dpi'],
  'matrix rows follow requested buying-factor fields'
);
assert.deepEqual(
  Object.keys(matrix.rows[2]['product:p1']).sort(),
  ['confidence', 'corrected', 'field', 'missing', 'productId', 'raw', 'revision', 'source', 'sources', 'url', 'value'].sort(),
  'matrix cells carry raw/corrected/confidence/source/url/missing metadata'
);
assert.equal(matrix.rows[2]['product:p1'].raw, '2 hrs');
assert.equal(matrix.rows[2]['product:p1'].corrected, '2 hours');
assert.equal(matrix.rows[2]['product:p1'].value, '2 hours');
assert.equal(matrix.rows[2]['product:p1'].confidence, 0.82);
assert.deepEqual(matrix.rows[2]['product:p1'].sources, ['official']);
assert.equal(matrix.rows[2]['product:p1'].source, 'Amazon');
assert.equal(matrix.rows[2]['product:p1'].url, 'https://example.com/p1');
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
