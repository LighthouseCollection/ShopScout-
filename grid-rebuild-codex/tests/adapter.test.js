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
  columns: [{ id: 'title', name: 'Name', field: 'title' }],
  rows: [{ id: 'p1', title: 'Product' }]
}, {});
assert.equal(capturedGridOptions.enableColumnReorder, false,
  'missing Sortable disables SlickGrid column drag instead of throwing');
liveInstance.destroy();
assert.equal(destroyed, true, 'live instance still destroys the DataView');

console.log('grid-codex-adapter.test.js: all assertions passed');
