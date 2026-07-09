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
const gridCss = fs.readFileSync(path.join(root, 'grid-rebuild-codex/grid.css'), 'utf8');
assert.match(gridCss, /\.ss-grid-host\s*\{[\s\S]*min-height:\s*0;/,
  'grid host CSS does not force a viewport-sized blank area before runtime sizing');
assert.match(gridCss, /\.ss-grid-host\.ss-grid-is-matrix \.slick-header-column[\s\S]*min-height:\s*172px;/,
  'comparison matrix header reserves enough height for thumbnail + wrapped title + action buttons');

const host = {
  children: [],
  ownerDocument: ctx.document,
  style: {},
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
const dataViewItems = new Map();
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
        setItems(items) {
          dataViewItems.clear();
          for (const item of items || []) dataViewItems.set(item.id, item);
        },
        setGrouping(grouping) { capturedGrouping = grouping; groupingCalls.push(grouping); },
        endUpdate() {},
        sort(comparator) { capturedSortComparator = comparator; },
        getItemById(id) { return dataViewItems.get(id); },
        updateItem(id, item) { dataViewItems.set(id, item); },
        deleteItem(id) { dataViewItems.delete(id); },
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
      getContainerNode() { return _container; },
      updateRowCount() {},
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
    { id: 'newPrice', name: 'Price', field: 'newPrice', type: 'price' },
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
assert.equal(host.style.height, '262px',
  'small product lists shrink the grid host height to exactly header + rowCount*rowHeight (no phantom scrollbar buffer below the last row)');
const titleColumn = capturedColumns.find(column => column.id === 'title');
const brandColumn = capturedColumns.find(column => column.id === 'brand');
const priceColumn = capturedColumns.find(column => column.id === 'newPrice');
const selectColumn = capturedColumns.find(column => column.id === 'select');
const sourceColumn = capturedColumns.find(column => column.id === 'source');
const devicesColumn = capturedColumns.find(column => column.id === 'devices');
const notesColumn = capturedColumns.find(column => column.id === 'notes');
const ratingColumn = capturedColumns.find(column => column.id === 'rating');
const productHeaderColumn = capturedColumns.find(column => column.id === 'product:p1');
const actionsColumn = capturedColumns.find(column => column.id === 'actions');
assert.equal(titleColumn.sortable, true, 'data columns are sortable from their own headers');
assert.equal(brandColumn.sortable, true, 'secondary data columns are sortable from their own headers');
assert.ok(titleColumn.width >= 40, 'title column measures from actual content — short names get tight widths');
assert.ok(titleColumn.width <= 200, 'short-title fixture does not blow the title column up to a hardcoded floor');
assert.ok(sourceColumn.width >= 40, 'source column measures from actual header/content only');
assert.ok(devicesColumn.width >= 160, 'spec columns whose HEADER is long ("Compatible Devices") measure the header width');
assert.ok(productHeaderColumn.width >= 180, 'comparison matrix product columns reserve enough width for thumbnail headers');
assert.equal(selectColumn.width, 40, 'checkbox column width follows the checkbox-plus-padding size');
assert.equal(selectColumn.minWidth, 40, 'checkbox column minWidth does not expand to the adapter default');
assert.equal(actionsColumn.sortable, false, 'actions column is not sortable');
assert.match(productHeaderColumn.name, /ss-grid-product-head/, 'comparison columns can render product thumbnails in the header');
assert.match(productHeaderColumn.name, /qnap\.jpg/, 'comparison header includes the product thumbnail URL');
assert.match(productHeaderColumn.name, /ss-grid-product-head-title-wrap/,
  'comparison header title has a wrapping container so long names are not cut off under thumbnails');
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
const normalizationProductColumn = { id: 'reviewProduct', field: 'productTitle', type: 'normalizationProduct' };
const normalizationPairColumn = { id: 'reviewValue', field: 'raw', type: 'normalizationPair', rawField: 'raw', normalizedField: 'normalized' };
const normalizationActionsColumn = { id: 'reviewActions', field: '_actions', type: 'normalizationActions' };
const userRuleCodeColumn = { id: 'ruleKey', field: 'ruleKey', type: 'userRuleCode' };
const userRuleActionsColumn = { id: 'ruleActions', field: '_actions', type: 'userRuleActions' };
const normalizationProductHtml = normalizationProductColumn.formatter
  ? ''
  : capturedColumns[0].formatter(0, 1, 'unused', normalizationProductColumn, {
    productTitle: 'Logitech MX Keys Mini for Mac',
    source: 'Amazon'
  });
const normalizationPairHtml = capturedColumns[0].formatter(0, 1, 'midnight blue', normalizationPairColumn, {
  raw: 'midnight blue',
  normalized: 'Navy Blue'
});
const normalizationActionsHtml = capturedColumns[0].formatter(0, 1, null, normalizationActionsColumn, {
  reviewKey: 'p1|colour|color|midnight blue|navy blue',
  productId: 'p1',
  rawField: 'Colour',
  field: 'Color',
  raw: 'midnight blue',
  normalized: 'Navy Blue'
});
assert.match(normalizationProductHtml, /normalization-review-product/, 'normalization review product cell renders structured product markup');
assert.match(normalizationPairHtml, /normalization-review-raw/, 'normalization pair cell renders the raw value when it differs');
assert.match(normalizationPairHtml, /normalization-review-arrow/, 'normalization pair cell renders the raw-to-normalized arrow');
assert.match(normalizationPairHtml, /Navy Blue/, 'normalization pair cell renders the normalized value');
assert.match(normalizationActionsHtml, /data-normalization-action="accept-alias"/, 'normalization action cell preserves accept alias action');
assert.match(normalizationActionsHtml, /data-normalization-action="ignore"/, 'normalization action cell preserves ignore action');
assert.doesNotMatch(normalizationActionsHtml, /data-normalization-bulk-action/,
  'per-row bulk-matching buttons removed; bulk actions live in the page toolbar instead');
assert.match(normalizationActionsHtml, /data-review-key="p1\|colour\|color\|midnight blue\|navy blue"/,
  'normalization action cell carries review identity data');
const userRuleCodeHtml = capturedColumns[0].formatter(0, 1, 'Colour', userRuleCodeColumn, {
  ruleKey: 'Colour'
});
const userRuleActionsHtml = capturedColumns[0].formatter(0, 1, null, userRuleActionsColumn, {
  type: 'Value alias',
  rawField: 'Color',
  field: 'Color',
  raw: 'midnight blue',
  normalized: 'Navy Blue'
});
const ignoredUserRuleActionsHtml = capturedColumns[0].formatter(0, 1, null, userRuleActionsColumn, {
  type: 'Ignored review item',
  reviewKey: 'p1|Color|Color|noise|noise'
});
assert.match(userRuleCodeHtml, /<code>Colour<\/code>/, 'user rule key cell renders rule key as code');
assert.match(userRuleActionsHtml, /data-user-rule-action="edit"/, 'user rule action cell exposes edit action');
assert.match(userRuleActionsHtml, /data-user-rule-action="delete"/, 'user rule action cell exposes delete action');
assert.match(userRuleActionsHtml, /data-normalized-value="Navy Blue"/, 'user rule action cell carries normalized value');
assert.doesNotMatch(ignoredUserRuleActionsHtml, /data-user-rule-action="edit"/,
  'ignored user rule rows do not expose edit action');
assert.match(ignoredUserRuleActionsHtml, /data-user-rule-action="delete"/,
  'ignored user rule rows still expose delete action');
const sourceHtml = sourceColumn.formatter(0, 2, 'generic', sourceColumn, {
  source: 'generic',
  url: 'https://www.amazon.com/dp/B0TEST'
});
const roundedPriceHtml = priceColumn.formatter(0, 2, '$24.29', priceColumn, {});
assert.match(roundedPriceHtml, />\$25</, 'price formatter rounds display price to the nearest 0/5 dollar');
assert.match(roundedPriceHtml, /title="\$24\.29"/, 'price formatter preserves the original price in a tooltip');
assert.doesNotMatch(sourceHtml, /ss-grid-logo-img/, 'source does not render a logo image');
assert.match(sourceHtml, /title="Amazon"/, 'source logo keeps the retailer label as a tooltip');
assert.match(sourceHtml, /aria-label="Amazon"/, 'source logo keeps the retailer label for assistive tech');
assert.match(sourceHtml, />Amazon</, 'source renders the retailer as text');
assert.doesNotMatch(sourceHtml, /src="logos\/amazon\.svg/, 'source does not use the packaged SVG cache');
assert.doesNotMatch(sourceHtml, /data-logo-fallback-srcs=/, 'source does not carry image fallback candidates');
assert.doesNotMatch(sourceHtml, /public\/icons\/amazon\/default\.svg/, 'source does not use remote logo providers');
assert.doesNotMatch(sourceHtml, /brandbird/i, 'runtime source logo candidates do not use Brandbird placeholder-prone URLs');
assert.doesNotMatch(sourceHtml, />generic</i, 'generic source text is not shown when a retailer can be inferred');
assert.doesNotMatch(sourceHtml, /ss-grid-source-pill/, 'source is not rendered as a pill/button');
const brandHtml = brandColumn.formatter(0, 3, 'Microsoft', brandColumn, { brand: 'Microsoft' });
assert.doesNotMatch(brandHtml, /brandfetch/i, 'runtime brand logo candidates do not use Brandfetch placeholder URLs');
assert.doesNotMatch(brandHtml, /ss-grid-logo-img/, 'brand does not render a logo image');
assert.doesNotMatch(brandHtml, /src="logos\/microsoft\.svg/, 'brand does not use the packaged SVG cache');
assert.doesNotMatch(brandHtml, /cdn\.worldvectorlogo\.com\/logos\/microsoft-2\.svg/, 'brand does not use remote logo providers');
assert.doesNotMatch(brandHtml, /cdn\.svglogos\.dev\/logos\/microsoft\.svg/, 'brand does not use SVG Logos providers');
assert.doesNotMatch(brandHtml, /svgl\.app\/library\/microsoft\.svg/, 'brand does not use SVGL providers');
assert.doesNotMatch(brandHtml, /public\/icons\/microsoft\/default\.svg/, 'brand does not use theSVG providers');
assert.doesNotMatch(brandHtml, /brandbird/i, 'runtime brand logo candidates do not use Brandbird placeholder-prone URLs');
assert.match(brandHtml, /title="Microsoft"/, 'brand logo keeps the brand name as a tooltip');
assert.match(brandHtml, />Microsoft</, 'brand renders the brand as text');
assert.doesNotMatch(brandHtml, /\shref=/, 'brand logos do not link to the current page when no brand URL exists');
assert.equal(capturedLogoErrorHandler, null, 'adapter does not register an image-error fallback handler when logos are text-only');
const unknownBrandHtml = brandColumn.formatter(0, 3, 'Small Unknown Brand', brandColumn, { brand: 'Small Unknown Brand' });
assert.match(unknownBrandHtml, />Small Unknown Brand</, 'unknown brands render readable text when no SVG mapping exists');
const devicesHtml = devicesColumn.formatter(0, 4, 'Laptop, PC, Smartphone, Tablet', devicesColumn, {});
assert.match(devicesHtml, /ss-grid-pill-list/, 'list-like spec values render as pills');
for (const label of ['Laptop', 'PC', 'Smartphone', 'Tablet']) {
  assert.match(devicesHtml, new RegExp(`>${label}<`), `${label} appears as a pill`);
}
const includedItemsHtml = devicesColumn.formatter(0, 4, 'Quick Connector× 1, USB Charging Cord× 1', devicesColumn, {});
assert.match(includedItemsHtml, /Quick Connector/, 'quantity-bearing included items render as separated pills');
assert.match(includedItemsHtml, /ss-grid-pill-qty/, 'quantity marker renders with a dedicated class for smaller italic styling');
const notesHtml = notesColumn.formatter(0, 5, 'Fast, quiet, and easy to use.', notesColumn, {});
assert.doesNotMatch(notesHtml, /ss-grid-pill-list/, 'description-like text fields keep sentence commas as prose');
const singleSpecHtml = devicesColumn.formatter(0, 4, 'Bluetooth', devicesColumn, {});
assert.match(singleSpecHtml, /ss-grid-pill-list/, 'single non-sentence spec values render as pills');
assert.match(singleSpecHtml, />Bluetooth</, 'single non-sentence spec value text appears inside its pill');
const ratingHtml = ratingColumn.formatter(0, 3, '4.7', ratingColumn, { rating: '4.7', reviewCount: '704' });
assert.match(ratingHtml, /★★★★★/, 'ratings render a five-star display based on the numeric rating');
assert.match(ratingHtml, />4\.7</, 'ratings still show the numeric value');
assert.match(ratingHtml, /ss-grid-rating-count/, 'rating count renders as its own second-line element');
assert.ok(ratingHtml.indexOf('ss-grid-rating-main') < ratingHtml.indexOf('ss-grid-rating-count'),
  'rating count appears below the star/value row');
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
assert.doesNotMatch(matrixBrandHtml, /ss-grid-logo-img/, 'compare matrix Brand rows do not render logo images');
assert.doesNotMatch(matrixBrandHtml, /src="logos\/microsoft\.svg/, 'compare matrix Brand rows do not use packaged SVGs');
const matrixSourceHtml = productHeaderColumn.formatter(0, 7, {
  field: 'source',
  value: 'generic',
  url: 'https://www.amazon.com/dp/B0TEST'
}, productHeaderColumn, {});
assert.match(matrixSourceHtml, /ss-grid-source-logo/, 'compare matrix Source rows use the same retailer SVG renderer');
assert.doesNotMatch(matrixSourceHtml, /ss-grid-logo-img/, 'compare matrix Source rows do not render logo images');
assert.doesNotMatch(matrixSourceHtml, /src="logos\/amazon\.svg/, 'compare matrix Source rows do not use packaged retailer SVGs');
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
assert.equal(liveInstance.updateRow('p1', { id: 'p1', title: 'Gamma' }), true,
  'adapter can update one SlickGrid DataView row by id');
assert.equal(dataViewItems.get('p1').title, 'Gamma',
  'adapter row update writes the next item into the DataView');
assert.equal(liveInstance.deleteRow('p1'), true,
  'adapter can delete one SlickGrid DataView row by id');
assert.equal(dataViewItems.has('p1'), false,
  'adapter row delete removes the item from the DataView');
assert.equal(liveInstance.deleteRow('missing'), false,
  'adapter row delete reports false when the row is not present');
liveInstance.destroy();
assert.equal(destroyed, true, 'live instance still destroys the DataView');

console.log('grid-codex-adapter.test.js: all assertions passed');
