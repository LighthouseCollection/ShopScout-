const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const ctx = {
  console,
  URL,
  globalThis: null,
  location: { href: 'https://example.test/' },
  document: {
    createElement(tag) {
      return {
        tagName: String(tag).toUpperCase(),
        className: '',
        textContent: '',
        children: []
      };
    }
  }
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(root, 'shared/values/cellValues.js'), 'utf8'),
  ctx,
  { filename: 'shared/values/cellValues.js' }
);
vm.runInContext(
  fs.readFileSync(path.join(root, 'grid-rebuild-codex/slickGridAdapter.js'), 'utf8'),
  ctx,
  { filename: 'grid-rebuild-codex/slickGridAdapter.js' }
);

const adapter = ctx.ShopScoutSlickGridAdapter;
assert.ok(adapter, 'adapter namespace is registered');

const host = {
  children: [],
  ownerDocument: ctx.document,
  replaceChildren(...children) {
    this.children = children;
  }
};

const instance = adapter.create(host, { columns: [], rows: [] }, {});
assert.equal(typeof instance.update, 'function', 'missing runtime still returns update no-op');
assert.equal(typeof instance.destroy, 'function', 'missing runtime still returns destroy no-op');
assert.equal(host.children.length, 1, 'missing runtime renders one placeholder');
assert.equal(host.children[0].className, 'ss-grid-empty');
assert.match(host.children[0].textContent, /SlickGrid runtime is not available/i);

let capturedGridOptions = null;
let capturedColumns = null;
let capturedSortColumns = null;
let capturedSortComparator = null;
let capturedOnSort = null;
let capturedGrouping = null;
let groupingCalls = [];
let emittedSort = null;
let destroyed = false;
let capturedLogoErrorHandler = null;
const eventStub = { subscribe() {} };
const sortEventStub = { subscribe(fn) { capturedOnSort = fn; } };
host.addEventListener = function addEventListener(type, fn) {
  if (type === 'error') capturedLogoErrorHandler = fn;
};
host.removeEventListener = function removeEventListener() {};
ctx.Slick = {
  Data: {
    DataView: function DataView() {
      return {
        beginUpdate() {},
        setItems() {},
        setGrouping(grouping) { capturedGrouping = grouping; groupingCalls.push(grouping); },
        endUpdate() {},
        sort(comparator) { capturedSortComparator = comparator; },
        onRowCountChanged: eventStub,
        onRowsChanged: eventStub,
        destroy() { destroyed = true; }
      };
    }
  },
  Grid: function Grid(_container, _dataView, _columns, options) {
    capturedGridOptions = options;
    capturedColumns = _columns;
    return {
      onSort: sortEventStub,
      onColumnsReordered: eventStub,
      onColumnsResized: eventStub,
      onCellChange: eventStub,
      onSelectedRowsChanged: eventStub,
      onClick: eventStub,
      onDblClick: eventStub,
      setSortColumns(columns) { capturedSortColumns = columns; },
      setColumns(columns) { capturedColumns = columns; },
      resizeCanvas() {},
      render() {},
      destroy() {}
    };
  }
};

const liveInstance = adapter.create(host, {
  columns: [
    { id: 'select', name: '', field: '_selected', type: 'selection', width: 40 },
    { id: 'title', name: 'Name', field: 'title' },
    { id: 'brand', name: 'Brand', field: 'brand', type: 'brand' },
    { id: 'source', name: 'Source', field: 'source', type: 'source' },
    { id: 'devices', name: 'Compatible Devices', field: 'devices', type: 'spec' },
    { id: 'notes', name: 'Notes', field: 'notes', type: 'text' },
    { id: 'rating', name: 'Rating', field: 'rating', type: 'rating', width: 128 },
    {
      id: 'product:p1',
      name: 'QNAP TS-464CU Long Product Name',
      field: 'product:p1',
      type: 'matrixCell',
      image: 'https://example.com/qnap.jpg'
    },
    { id: 'actions', name: '', field: '_actions', type: 'actions' }
  ],
  rows: [
    { id: 'p1', title: 'Beta', brand: 'Acme' },
    { id: 'p2', title: 'Alpha', brand: 'Acme' }
  ],
  sort: [
    { field: 'brand', dir: 'asc' },
    { field: 'title', dir: 'asc' }
  ],
  grouping: { field: 'brand', label: 'Brand' }
}, {
  onSortChange(sort) { emittedSort = sort; }
});
assert.equal(capturedGridOptions.enableColumnReorder, false,
  'missing Sortable disables SlickGrid column drag instead of throwing');
assert.equal(capturedGridOptions.showCellSelection, false,
  'grid does not show a selected-cell border when a cell is clicked');
const titleColumn = capturedColumns.find(column => column.id === 'title');
const brandColumn = capturedColumns.find(column => column.id === 'brand');
const selectColumn = capturedColumns.find(column => column.id === 'select');
const sourceColumn = capturedColumns.find(column => column.id === 'source');
const devicesColumn = capturedColumns.find(column => column.id === 'devices');
const notesColumn = capturedColumns.find(column => column.id === 'notes');
const ratingColumn = capturedColumns.find(column => column.id === 'rating');
const productHeaderColumn = capturedColumns.find(column => column.id === 'product:p1');
const actionsColumn = capturedColumns.find(column => column.id === 'actions');
assert.equal(titleColumn.sortable, true, 'data columns are sortable from their own headers');
assert.equal(brandColumn.sortable, true, 'secondary data columns are sortable from their own headers');
assert.equal(selectColumn.width, 40, 'checkbox column width follows the checkbox-plus-padding size');
assert.equal(selectColumn.minWidth, 40, 'checkbox column minWidth does not expand to the adapter default');
assert.equal(actionsColumn.sortable, false, 'actions column is not sortable');
assert.match(productHeaderColumn.name, /ss-grid-product-head/, 'comparison columns can render product thumbnails in the header');
assert.match(productHeaderColumn.name, /qnap\.jpg/, 'comparison header includes the product thumbnail URL');
assert.ok(
  productHeaderColumn.name.indexOf('ss-grid-header-thumb') < productHeaderColumn.name.indexOf('ss-grid-product-head-title'),
  'comparison header places the product thumbnail before the product title'
);
assert.deepEqual(capturedSortColumns, [
  { columnId: 'brand', sortAsc: true },
  { columnId: 'title', sortAsc: true }
], 'projection sort state is shown on every matching sorted column header');
assert.equal(
  capturedSortComparator({ brand: 'Acme', title: 'Alpha' }, { brand: 'Acme', title: 'Beta' }) < 0,
  true,
  'DataView sort comparator uses secondary sort fields when primary values tie'
);
assert.equal(typeof capturedGrouping.getter, 'function', 'native DataView grouping uses a value-normalizing getter');
assert.equal(capturedGrouping.getter({ brand: 'Acme' }), 'Acme', 'native grouping getter reads the projection grouping field');
assert.equal(capturedGrouping.getter({ brand: '' }), 'Not specified', 'native grouping getter normalizes blank group values');
assert.equal(capturedGrouping.displayTotalsRow, false, 'native grouping does not add unused totals rows');
assert.equal(capturedGrouping.formatter({ value: 'Acme', count: 2 }), 'Brand: Acme (2)',
  'native group formatter shows label, value, and count');
capturedOnSort(null, {
  sortCols: [
    { sortCol: brandColumn, sortAsc: false },
    { sortCol: titleColumn, sortAsc: true }
  ]
});
assert.deepEqual(emittedSort, [
  { field: 'brand', dir: 'desc' },
  { field: 'title', dir: 'asc' }
], 'SlickGrid multi-sort events emit the full sort chain');
const actionsHtml = actionsColumn.formatter(0, 1, null, actionsColumn, { id: 'p1' });
const sourceHtml = sourceColumn.formatter(0, 2, 'generic', sourceColumn, {
  source: 'generic',
  url: 'https://www.amazon.com/dp/B0TEST'
});
assert.match(sourceHtml, /ss-grid-logo-img/, 'source renders as a logo image, not a button-style pill');
assert.match(sourceHtml, /title="Amazon"/, 'source logo keeps the retailer label as a tooltip');
assert.match(sourceHtml, /aria-label="Amazon"/, 'source logo keeps the retailer label for assistive tech');
assert.match(sourceHtml, /ss-grid-logo-fallback/, 'source logo includes text fallback for missing SVGs');
assert.match(sourceHtml, /src="logos\/amazon\.svg\?v=/, 'known retailers try the packaged local SVG before remote providers and clear stale image cache');
assert.match(sourceHtml, /data-logo-fallback-srcs=/, 'source logos carry fallback candidates when the first provider misses');
assert.match(sourceHtml, /public\/icons\/amazon\/default\.svg/, 'known retailers keep the valid theSVG CDN path as a fallback');
assert.doesNotMatch(sourceHtml, /brandbird/i, 'runtime source logo candidates do not use Brandbird placeholder-prone URLs');
assert.doesNotMatch(sourceHtml, />generic</i, 'generic source text is not shown when a retailer can be inferred');
assert.doesNotMatch(sourceHtml, /ss-grid-source-pill/, 'source is not rendered as a pill/button');
const brandHtml = brandColumn.formatter(0, 3, 'Microsoft', brandColumn, { brand: 'Microsoft' });
assert.doesNotMatch(brandHtml, /brandfetch/i, 'runtime brand logo candidates do not use Brandfetch placeholder URLs');
assert.match(brandHtml, /src="logos\/microsoft\.svg\?v=/, 'known brands try the packaged local SVG before remote providers and clear stale image cache');
assert.match(brandHtml, /cdn\.worldvectorlogo\.com\/logos\/microsoft-2\.svg/, 'Microsoft includes a rectangular wordmark fallback');
assert.match(brandHtml, /cdn\.svglogos\.dev\/logos\/microsoft\.svg/, 'Microsoft includes the SVG Logos fallback');
assert.match(brandHtml, /svgl\.app\/library\/microsoft\.svg/, 'Microsoft includes the SVGL catalog fallback');
assert.match(brandHtml, /public\/icons\/microsoft\/default\.svg/, 'known brands keep theSVG CDN path as a final fallback');
assert.doesNotMatch(brandHtml, /brandbird/i, 'runtime brand logo candidates do not use Brandbird placeholder-prone URLs');
assert.match(brandHtml, /title="Microsoft"/, 'brand logo keeps the brand name as a tooltip');
assert.match(brandHtml, /ss-grid-logo-fallback/, 'brand logo includes text fallback for missing SVGs');
assert.doesNotMatch(brandHtml, /\shref=/, 'brand logos do not link to the current page when no brand URL exists');
assert.equal(typeof capturedLogoErrorHandler, 'function', 'adapter registers an image-error fallback handler');
let missingLogoFallbackShown = false;
const fakeLogoAttributes = new Map([
  ['data-logo-fallback-srcs', 'https://example.test/next-logo.svg|https://example.test/final-logo.svg']
]);
const fakeLogoImg = {
  src: 'https://example.test/missing-logo.svg',
  classList: { contains(name) { return name === 'ss-grid-logo-img'; } },
  getAttribute(name) { return fakeLogoAttributes.get(name) || ''; },
  setAttribute(name, value) { fakeLogoAttributes.set(name, value); },
  closest() {
    return {
      classList: {
        add(name) {
          if (name === 'is-logo-missing') missingLogoFallbackShown = true;
        }
      }
    };
  }
};
capturedLogoErrorHandler({ target: fakeLogoImg });
assert.equal(fakeLogoImg.src, 'https://example.test/next-logo.svg',
  'logo image errors advance to the next provider before falling back to text');
assert.equal(fakeLogoAttributes.get('data-logo-fallback-srcs'), 'https://example.test/final-logo.svg',
  'used logo fallback candidates are removed after each retry');
capturedLogoErrorHandler({ target: fakeLogoImg });
capturedLogoErrorHandler({ target: fakeLogoImg });
assert.equal(missingLogoFallbackShown, true,
  'logo text fallback is shown only after every provider candidate fails');
const unknownBrandHtml = brandColumn.formatter(0, 3, 'Small Unknown Brand', brandColumn, { brand: 'Small Unknown Brand' });
assert.match(unknownBrandHtml, />Small Unknown Brand</, 'unknown brands render readable text when no SVG mapping exists');
const devicesHtml = devicesColumn.formatter(0, 4, 'Laptop, PC, Smartphone, Tablet', devicesColumn, {});
assert.match(devicesHtml, /ss-grid-pill-list/, 'list-like spec values render as pills');
for (const label of ['Laptop', 'PC', 'Smartphone', 'Tablet']) {
  assert.match(devicesHtml, new RegExp(`>${label}<`), `${label} appears as a pill`);
}
const notesHtml = notesColumn.formatter(0, 5, 'Fast, quiet, and easy to use.', notesColumn, {});
assert.doesNotMatch(notesHtml, /ss-grid-pill-list/, 'description-like text fields keep sentence commas as prose');
const singleSpecHtml = devicesColumn.formatter(0, 4, 'Bluetooth', devicesColumn, {});
assert.match(singleSpecHtml, /ss-grid-pill-list/, 'single non-sentence spec values render as pills');
assert.match(singleSpecHtml, />Bluetooth</, 'single non-sentence spec value text appears inside its pill');
const ratingHtml = ratingColumn.formatter(0, 3, '4.7', ratingColumn, { rating: '4.7', reviewCount: '704' });
assert.match(ratingHtml, /★★★★★/, 'ratings render a five-star display based on the numeric rating');
assert.match(ratingHtml, />4\.7</, 'ratings still show the numeric value');
const longTitleHtml = titleColumn.formatter(0, 1,
  'Dremel 4300-5/40 High-Performance Rotary Tool Kit with LED Light and Flex Shaft',
  titleColumn,
  {});
assert.match(longTitleHtml, /ss-grid-title-text/,
  'product titles render through a dedicated title wrapper');
assert.match(longTitleHtml, /title="Dremel 4300-5\/40 High-Performance Rotary Tool Kit with LED Light and Flex Shaft"/,
  'product title wrapper keeps the full title available as a tooltip');
const matrixBrandHtml = productHeaderColumn.formatter(0, 7, { field: 'brand', value: 'Microsoft' }, productHeaderColumn, {});
assert.match(matrixBrandHtml, /ss-grid-brand-logo/, 'compare matrix Brand rows use the same SVG logo renderer');
assert.match(matrixBrandHtml, /src="logos\/microsoft\.svg\?v=/, 'compare matrix Brand rows try packaged SVGs before remote providers and clear stale image cache');
assert.match(matrixBrandHtml, /cdn\.worldvectorlogo\.com\/logos\/microsoft-2\.svg/, 'compare matrix Brand rows include rectangular logo candidates');
const matrixSourceHtml = productHeaderColumn.formatter(0, 7, {
  field: 'source',
  value: 'generic',
  url: 'https://www.amazon.com/dp/B0TEST'
}, productHeaderColumn, {});
assert.match(matrixSourceHtml, /ss-grid-source-logo/, 'compare matrix Source rows use the same retailer SVG renderer');
assert.match(matrixSourceHtml, /src="logos\/amazon\.svg\?v=/, 'compare matrix Source rows try packaged retailer SVGs before remote providers and clear stale image cache');
assert.match(actionsHtml, /ss-grid-action-bar/, 'row actions render as a compact icon toolbar');
assert.doesNotMatch(actionsHtml, /<details|ss-grid-action-panel|<summary/,
  'row actions do not render an in-cell popup menu that can overlap nearby rows');
assert.match(actionsHtml, /data-ss-grid-action="open"/, 'row actions include open');
assert.match(actionsHtml, /data-ss-grid-action="rescan"/, 'row actions include rescan');
assert.match(actionsHtml, /data-ss-grid-action="delete"/, 'row actions include delete');
assert.match(actionsHtml, /aria-label="Open product"/, 'open action is icon-only with an accessible label');
assert.match(actionsHtml, /aria-label="Rescan product"/, 'rescan action is icon-only with an accessible label');
assert.match(actionsHtml, /aria-label="Delete product"/, 'delete action is icon-only with an accessible label');
liveInstance.update({
  columns: [
    { id: 'title', name: 'Name', field: 'title' }
  ],
  rows: [
    { id: 'p1', title: 'Beta' }
  ],
  sort: [],
  grouping: null
});
assert.equal(groupingCalls[groupingCalls.length - 1], null,
  'adapter clears native DataView grouping when the projection is ungrouped');
liveInstance.destroy();
assert.equal(destroyed, true, 'live instance still destroys the DataView');

console.log('grid-codex-adapter.test.js: all assertions passed');
