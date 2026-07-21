const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const ctx = { console, globalThis: null };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(root, 'grid-rebuild-codex/state.js'), 'utf8'),
  ctx,
  { filename: 'grid-rebuild-codex/state.js' }
);

const state = ctx.ShopScoutGridCodexState;
assert.ok(state, 'state namespace is registered');
assert.equal(typeof state.createStore, 'function', 'createStore is exposed');

const store = state.createStore({
  mode: 'matrix',
  matrixMode: 'detailed',
  search: 'camera'
});

assert.equal(store.getState().mode, 'matrix');
assert.equal(store.getState().matrixMode, 'detailed');
assert.equal(store.getState().search, 'camera');

let observed = null;
const unsubscribe = store.subscribe(next => { observed = next; });
store.dispatch({
  sort: [{ field: 'newPrice', dir: 'desc' }],
  columnOrder: ['title', 'newPrice'],
  selectedProductIds: new Set(['p1', 'p2'])
});
unsubscribe();

assert.equal(observed.sort[0].field, 'newPrice', 'subscribers receive sort updates');
assert.deepEqual(store.getState().selectedProductIds, ['p1', 'p2'],
  'sets are serialized to arrays inside state');

const wire = state.serialize(store.getState());
assert.deepEqual(wire.columnOrder, ['title', 'newPrice']);
assert.equal(wire.columnWidths, undefined,
  'columnWidths is not persisted — every load auto-sizes from content');
assert.deepEqual(wire.selectedProductIds, ['p1', 'p2']);

const restored = state.deserialize({
  mode: 'garbage',
  matrixMode: 'garbage',
  sort: [{ field: 'rating', dir: 'up' }],
  columnVisibility: { source: false },
  pinnedColumns: ['title'],
  pinnedTopProductIds: new Set(['p1', 'p2'])
});

assert.equal(restored.mode, 'rows', 'invalid mode falls back safely');
assert.equal(restored.matrixMode, 'basic', 'invalid matrix mode falls back safely');
assert.equal(restored.sort[0].dir, 'asc', 'invalid sort direction normalizes');
assert.equal(restored.columnVisibility.source, false);
assert.deepEqual(restored.pinnedColumns, ['title']);
assert.deepEqual(restored.pinnedTopProductIds, ['p1', 'p2']);

console.log('grid-codex-state.test.js: all assertions passed');
