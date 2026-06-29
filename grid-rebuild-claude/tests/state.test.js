/* Tests for grid-rebuild-claude/state/gridState.js.
   Pure JSON state model — no DOM, no SlickGrid. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'state', 'gridState.js'), 'utf8'),
  ctx,
  { filename: 'state/gridState.js' }
);
const S = ctx.ShopScoutGridState;
assert.ok(S, 'ShopScoutGridState registered');

/* ---- freshState ---------------------------------------------- */
/* Note: arrays/objects created in the vm context don't share their
   constructor with the host realm, so deepStrictEqual against host
   `[]` / `{}` fails on prototype identity. We compare via JSON
   round-trip or via `.length` / `Object.keys()` instead. */
const base = S.freshState();
assert.strictEqual(base.mode, 'rows');
assert.strictEqual(base.matrix, 'basic');
assert.strictEqual(base.filters.length, 0);
assert.strictEqual(base.sort.length, 0);
assert.strictEqual(base.selectedProductIds.length, 0);
assert.strictEqual(base.savedViewId, null);

/* ---- update returns new object, never mutates ---------------- */
const next = S.update(base, { mode: 'columns' });
assert.notStrictEqual(next, base, 'update returns a new object');
assert.strictEqual(base.mode, 'rows', 'original state untouched');
assert.strictEqual(next.mode, 'columns');

/* ---- serialize / deserialize round-trip ---------------------- */
const stateful = S.update(base, {
  mode: 'columns',
  matrix: 'detailed',
  filters: [{ field: 'brand', op: 'eq', value: 'Shark' }],
  sort: [{ field: 'newPrice', dir: 'asc' }],
  selectedProductIds: ['p1', 'p2']
});
const wire = S.serialize(stateful);
assert.strictEqual(JSON.stringify(wire.filters), JSON.stringify(stateful.filters),
  'filters survive serialize');
const back = S.deserialize(wire);
assert.strictEqual(back.mode, 'columns');
assert.strictEqual(back.matrix, 'detailed');
assert.strictEqual(JSON.stringify(back.filters), JSON.stringify(stateful.filters));
assert.strictEqual(JSON.stringify(back.selectedProductIds), JSON.stringify(['p1', 'p2']));

/* ---- deserialize coerces Set → array if present -------------- */
const withSet = S.deserialize({ selectedProductIds: new Set(['a', 'b']) });
assert.strictEqual(withSet.selectedProductIds.length, 2, 'Set coerced to array');
const sorted = [...withSet.selectedProductIds].sort();
assert.strictEqual(sorted[0], 'a');
assert.strictEqual(sorted[1], 'b');

/* ---- applyAction: filter add --------------------------------- */
let s = S.freshState();
s = S.applyAction(s, S.addFilter({ field: 'rating', op: 'gte', value: 4 }));
assert.strictEqual(s.filters.length, 1);
assert.strictEqual(s.filters[0].field, 'rating');

/* ---- applyAction: sort replaces same-field, adds new --------- */
s = S.applyAction(s, S.setSort('newPrice', 'asc'));
s = S.applyAction(s, S.setSort('rating', 'desc'));
s = S.applyAction(s, S.setSort('newPrice', 'desc')); // replaces existing newPrice asc
assert.strictEqual(s.sort.length, 2, 'two sort fields (no dup)');
const priceSort = s.sort.find(x => x.field === 'newPrice');
assert.strictEqual(priceSort.dir, 'desc', 'second setSort(newPrice) replaces dir');

/* ---- applyAction: selection toggle --------------------------- */
s = S.freshState();
s = S.applyAction(s, S.toggleSelection('p1'));
s = S.applyAction(s, S.toggleSelection('p2'));
assert.strictEqual(JSON.stringify([...s.selectedProductIds].sort()), JSON.stringify(['p1', 'p2']));
s = S.applyAction(s, S.toggleSelection('p1'));   // off
assert.strictEqual(JSON.stringify(s.selectedProductIds), JSON.stringify(['p2']));

/* ---- applyAction: clear selection / filters ------------------ */
s = S.applyAction(s, S.clearSelection());
assert.strictEqual(s.selectedProductIds.length, 0);
s = S.applyAction(s, S.addFilter({ field: 'a', op: 'eq', value: 'b' }));
s = S.applyAction(s, S.clearFilters());
assert.strictEqual(s.filters.length, 0);

/* ---- mode/matrix setters validate ---------------------------- */
assert.strictEqual(S.applyAction(base, S.setMode('garbage')).mode, 'rows', 'invalid mode falls back to rows');
assert.strictEqual(S.applyAction(base, S.setMode('columns')).mode, 'columns');
assert.strictEqual(S.applyAction(base, S.setMatrix('detailed')).matrix, 'detailed');
assert.strictEqual(S.applyAction(base, S.setMatrix('garbage')).matrix, 'basic');

/* ---- createStore: dispatch + subscribe ----------------------- */
const store = S.createStore({});
let observed = null;
const unsub = store.subscribe(state => { observed = state; });
store.dispatch({ mode: 'columns' });
assert.strictEqual(observed && observed.mode, 'columns', 'subscriber received new state');
assert.strictEqual(store.getState().mode, 'columns');
unsub();
store.dispatch({ matrix: 'detailed' });
assert.strictEqual(observed.mode, 'columns', 'unsubscribed listener not called again');

console.log('grid-rebuild-claude state.test.js: all assertions passed');
