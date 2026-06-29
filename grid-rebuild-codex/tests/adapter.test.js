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
let destroyed = false;
const eventStub = { subscribe() {} };
ctx.Slick = {
  Data: {
    DataView: function DataView() {
      return {
        beginUpdate() {},
        setItems() {},
        endUpdate() {},
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
      onSort: eventStub,
      onColumnsReordered: eventStub,
      onColumnsResized: eventStub,
      onCellChange: eventStub,
      onSelectedRowsChanged: eventStub,
      onClick: eventStub,
      onDblClick: eventStub,
      resizeCanvas() {},
      render() {},
      destroy() {}
    };
  }
};

const liveInstance = adapter.create(host, {
  columns: [
    { id: 'title', name: 'Name', field: 'title' },
    { id: 'actions', name: '', field: '_actions', type: 'actions' }
  ],
  rows: [{ id: 'p1', title: 'Product' }]
}, {});
assert.equal(capturedGridOptions.enableColumnReorder, false,
  'missing Sortable disables SlickGrid column drag instead of throwing');
const actionsColumn = capturedColumns.find(column => column.id === 'actions');
const actionsHtml = actionsColumn.formatter(0, 1, null, actionsColumn, { id: 'p1' });
assert.match(actionsHtml, /ss-grid-action-menu/, 'row actions render as a compact menu');
assert.match(actionsHtml, /data-ss-grid-action="open"/, 'row actions include open');
assert.match(actionsHtml, /data-ss-grid-action="rescan"/, 'row actions include rescan');
assert.match(actionsHtml, /data-ss-grid-action="delete"/, 'row actions include delete');
assert.ok(!actionsHtml.includes('ss-grid-actions'),
  'row actions do not use the old inline action button wrapper');
liveInstance.destroy();
assert.equal(destroyed, true, 'live instance still destroys the DataView');

console.log('grid-codex-adapter.test.js: all assertions passed');
