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

console.log('grid-codex-adapter.test.js: all assertions passed');
