/* Tests for the Phase 2 grid mount.
   Loads all modules into a vm context, then asserts:
     - ShopScoutGrid is registered on globalThis
     - The public surface from README.md is present
     - render() paints the placeholder when Slick is absent
     - HTML wiring loads the modules in the right order */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');

/* ---- HTML script-tag order ----------------------------------- */
const html = fs.readFileSync(path.join(root, 'comparison.html'), 'utf8');
const order = [
  'shared/values/cellValues.js',
  'shared/projections/specProjection.js',
  'shared/edits/ratingWriter.js',
  'grid-rebuild-claude/state/gridState.js',
  'grid-rebuild-claude/projections/matrixModes.js',
  'grid-rebuild-claude/projections/productsAsRows.js',
  'grid-rebuild-claude/projections/productsAsColumns.js',
  'grid-rebuild-claude/edits/productEditor.js',
  'grid-rebuild-claude/renderer/formatters.js',
  'grid-rebuild-claude/renderer/columnDefs.js',
  'grid-rebuild-claude/renderer/slickGridRenderer.js',
  'grid-rebuild-claude/mount.js'
];
let prev = -1;
for (const file of order) {
  const idx = html.indexOf(file);
  assert.ok(idx > 0, `comparison.html references ${file}`);
  assert.ok(idx > prev, `comparison.html loads ${file} after the previous module`);
  prev = idx;
}
const cmpIdx = html.indexOf('src="comparison.js"');
assert.ok(prev < cmpIdx, 'mount.js loads before comparison.js so renderAll finds ShopScoutGrid');

/* ---- Build script ships grid-rebuild-claude/ ----------------- */
const buildScript = fs.readFileSync(path.join(root, 'scripts', 'build-extension.ps1'), 'utf8');
assert.ok(/['"]grid-rebuild-claude['"]/.test(buildScript),
  'build script copies grid-rebuild-claude/ into each dist');

/* ---- vm load + namespace registration ------------------------ */
function loadCtx() {
  const ctx = {
    console,
    setTimeout, clearTimeout,
    /* Minimal browser-shape stub. */
    document: {
      _byId: {},
      getElementById(id) { return this._byId[id] || null; },
      createElement: (tag) => ({ tagName: String(tag).toUpperCase(), children: [], style: {}, innerHTML: '' })
    }
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  ctx.root = ctx;
  vm.createContext(ctx);

  /* Hand-roll a #productGrid mount node with an `innerHTML` setter. */
  const mountEl = {
    children: [],
    _innerHTML: '',
    set innerHTML(v) { this._innerHTML = v; },
    get innerHTML() { return this._innerHTML; }
  };
  ctx.document._byId.productGrid = mountEl;

  for (const file of order) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  }
  return { ctx, mountEl };
}

const { ctx } = loadCtx();
assert.ok(ctx.ShopScoutGrid, 'ShopScoutGrid registered on globalThis');

for (const name of ['render', 'destroy', 'dispatch', 'subscribe', 'getProjection']) {
  assert.strictEqual(typeof ctx.ShopScoutGrid[name], 'function',
    `ShopScoutGrid.${name} is a function`);
}
/* `state` is a getter, not a function. */
const stateProp = Object.getOwnPropertyDescriptor(ctx.ShopScoutGrid, 'state');
assert.ok(stateProp && typeof stateProp.get === 'function',
  'ShopScoutGrid.state is a getter');

/* ---- Dispatch returns a new state and observers see it ------- */
let observed = null;
const unsub = ctx.ShopScoutGrid.subscribe(s => { observed = s; });
ctx.ShopScoutGrid.dispatch({ mode: 'columns' });
assert.strictEqual(observed && observed.mode, 'columns', 'subscriber received updated state');
assert.strictEqual(ctx.ShopScoutGrid.state.mode, 'columns');
unsub();

/* ---- getProjection returns a kind for the current mode ------- */
const proj = ctx.ShopScoutGrid.getProjection();
assert.strictEqual(proj.kind, 'columns', 'projection kind follows state mode');

ctx.ShopScoutGrid.dispatch({ mode: 'rows' });
const rowsProj = ctx.ShopScoutGrid.getProjection();
assert.strictEqual(rowsProj.kind, 'rows');

/* ---- Renderer.create with no Slick paints the placeholder ---- */
{
  const local = loadCtx();
  const Renderer = local.ctx.ShopScoutGridRenderer;
  const inst = Renderer.create({
    mountEl: local.mountEl,
    store: local.ctx.ShopScoutGridState.createStore({}),
    getProjection: () => ({ kind: 'rows', columns: [], rows: [] })
  });
  assert.ok(/SlickGrid not yet vendored/.test(local.mountEl.innerHTML),
    'placeholder rendered when Slick is absent');
  assert.strictEqual(Renderer.hasSlickGrid(), false, 'hasSlickGrid reports false when Slick is absent');
  inst.destroy();
}

console.log('grid-rebuild-claude grid-mount.test.js: all assertions passed');
