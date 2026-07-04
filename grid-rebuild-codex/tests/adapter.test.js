const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const ctx = {
  console,
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
let emittedSort = null;
let destroyed = false;
const eventStub = { subscribe() {} };
const sortEventStub = { subscribe(fn) { capturedOnSort = fn; } };
ctx.Slick = {
  Data: {
    DataView: function DataView() {
      return {
        beginUpdate() {},
        setItems() {},
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
      resizeCanvas() {},
      render() {},
      destroy() {}
    };
  }
};

const liveInstance = adapter.create(host, {
  columns: [
    { id: 'title', name: 'Name', field: 'title' },
    { id: 'brand', name: 'Brand', field: 'brand' },
    { id: 'actions', name: '', field: '_actions', type: 'actions' }
  ],
  rows: [
    { id: 'p1', title: 'Beta', brand: 'Acme' },
    { id: 'p2', title: 'Alpha', brand: 'Acme' }
  ],
  sort: [
    { field: 'brand', dir: 'asc' },
    { field: 'title', dir: 'asc' }
  ]
}, {
  onSortChange(sort) { emittedSort = sort; }
});
assert.equal(capturedGridOptions.enableColumnReorder, false,
  'missing Sortable disables SlickGrid column drag instead of throwing');
assert.equal(capturedGridOptions.showCellSelection, false,
  'grid does not show a selected-cell border when a cell is clicked');
const titleColumn = capturedColumns.find(column => column.id === 'title');
const brandColumn = capturedColumns.find(column => column.id === 'brand');
const actionsColumn = capturedColumns.find(column => column.id === 'actions');
assert.equal(titleColumn.sortable, true, 'data columns are sortable from their own headers');
assert.equal(brandColumn.sortable, true, 'secondary data columns are sortable from their own headers');
assert.equal(actionsColumn.sortable, false, 'actions column is not sortable');
assert.deepEqual(capturedSortColumns, [
  { columnId: 'brand', sortAsc: true },
  { columnId: 'title', sortAsc: true }
], 'projection sort state is shown on every matching sorted column header');
assert.equal(
  capturedSortComparator({ brand: 'Acme', title: 'Alpha' }, { brand: 'Acme', title: 'Beta' }) < 0,
  true,
  'DataView sort comparator uses secondary sort fields when primary values tie'
);
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
assert.match(actionsHtml, /ss-grid-action-bar/, 'row actions render as a compact icon toolbar');
assert.doesNotMatch(actionsHtml, /<details|ss-grid-action-panel|<summary/,
  'row actions do not render an in-cell popup menu that can overlap nearby rows');
assert.match(actionsHtml, /data-ss-grid-action="open"/, 'row actions include open');
assert.match(actionsHtml, /data-ss-grid-action="rescan"/, 'row actions include rescan');
assert.match(actionsHtml, /data-ss-grid-action="delete"/, 'row actions include delete');
assert.match(actionsHtml, /aria-label="Open product"/, 'open action is icon-only with an accessible label');
assert.match(actionsHtml, /aria-label="Rescan product"/, 'rescan action is icon-only with an accessible label');
assert.match(actionsHtml, /aria-label="Delete product"/, 'delete action is icon-only with an accessible label');
liveInstance.destroy();
assert.equal(destroyed, true, 'live instance still destroys the DataView');

console.log('grid-codex-adapter.test.js: all assertions passed');
