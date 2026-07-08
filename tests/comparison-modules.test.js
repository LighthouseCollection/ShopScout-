/* Tests for the comparison/ module split (Task 7).
   - Asserts the new namespace and surface exist on globalThis after
     the module evaluates.
   - Asserts comparison.html loads the module BEFORE comparison.js so
     the back-compat globals (renderAiResultsPage, buildRunProductList,
     isAiRunIncomplete, etc.) are populated before any callsite in
     comparison.js fires.
   - Exercises the pure VM builder on a minimal run to prove the
     extracted code wires through correctly.
*/
const assert = require('assert');
const vm = require('vm');
const { read } = require('./_helpers');

/* --- script-tag ordering in the HTML — every comparison/ module
   must load BEFORE comparison.js so back-compat globals are populated
   before any callsite in the main file fires. --- */
const html = read('comparison.html');
const comparisonIdx = html.indexOf('src="comparison.js"');
assert.ok(comparisonIdx > 0, 'comparison.html references comparison.js');
const modules = ['comparison/aiResultsView.js', 'comparison/rescanController.js', 'comparison/productDetailView.js'];
for (const mod of modules) {
  const idx = html.indexOf(mod);
  assert.ok(idx > 0, `comparison.html references ${mod}`);
  assert.ok(idx < comparisonIdx,
    `${mod} must load BEFORE comparison.js so back-compat globals are populated first`);
}

/* --- build script copies the new directory into each dist --- */
const buildScript = read('scripts/build-extension.ps1');
assert.ok(/['"]comparison['"]/.test(buildScript),
  "scripts/build-extension.ps1 must include 'comparison' in runtimeDirs so the dir ships");

/* --- module loads under a vm context and exposes its public surface --- */
function makeCtx() {
  const ctx = {
    console,
    /* minimal SS surface — every name the module destructures off SS */
    SS: {
      esc: (s) => String(s == null ? '' : s),
      escAttr: (s) => String(s == null ? '' : s),
      sanitizeUrl: (u) => String(u || ''),
      parsePrice: (p) => Number(String(p || '').replace(/[^0-9.]/g, '')) || 0,
      normalizeReviewCount: (c) => Number(c) || 0,
      formatRatingDisplay: (r) => String(r || ''),
      normalizeSpecValue: (v) => String(v == null ? '' : v),
      normalizeProductSpecs: (p) => Array.isArray(p && p.specs) ? p.specs : [],
      getCategoryComparisonSpecKeys: () => [],
      inferCategory: () => 'general',
      CATEGORY_RUBRICS: {}
    },
    /* comparison.js exposes these at runtime; the module references
       them as free identifiers and resolves via the global object. */
    getCorrectedValue: (product, field, fallback = '') => {
      if (!product) return fallback;
      const v = product[field];
      return v == null || v === '' ? fallback : v;
    },
    stageStatusText: (status) => String(status || ''),
    closeSettingsPage: () => {},
    /* The module only inspects ShopScoutAI for the optional STAGES
       lookup — supply a tiny stub so aiStageLabel works. */
    ShopScoutAI: {
      STAGES: [{ id: 'comparison', label: 'Compare' }]
    }
  };
  ctx.globalThis = ctx;
  ctx.root = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  return ctx;
}

const ctx = makeCtx();
const src = read('comparison/aiResultsView.js');
vm.runInContext(src, ctx, { filename: 'comparison/aiResultsView.js' });

assert.ok(ctx.ShopScoutComparison, 'ShopScoutComparison namespace registered');
const view = ctx.ShopScoutComparison.aiResultsView;
assert.ok(view, 'ShopScoutComparison.aiResultsView namespace registered');

const expectedSurface = [
  'renderPage',
  'showPage',
  'buildViewModel',
  'isRunIncomplete',
  'buildRunProductList',
  'aiStageLabel'
];
for (const name of expectedSurface) {
  assert.strictEqual(typeof view[name], 'function',
    `aiResultsView.${name} is a function on the namespace`);
}

/* --- back-compat globals — comparison.js still calls these by bare
   name; the module must re-export them onto globalThis. --- */
const expectedGlobals = [
  'aiStageLabel',
  'buildRunProductList',
  'isAiRunIncomplete',
  'renderAiResultsPage',
  'showAiResultsPage'
];
for (const name of expectedGlobals) {
  assert.strictEqual(typeof ctx[name], 'function',
    `back-compat global ${name} is set on globalThis by the module`);
}

/* --- aiStageLabel: returns label when known, falls back to id. --- */
assert.strictEqual(view.aiStageLabel('comparison'), 'Compare',
  'aiStageLabel resolves a known stage via ShopScoutAI.STAGES');
assert.strictEqual(view.aiStageLabel('unknown'), 'unknown',
  'aiStageLabel falls back to the id when not in STAGES');
assert.strictEqual(view.aiStageLabel(), 'Stage',
  'aiStageLabel falls back to "Stage" when no id is given');

/* --- isRunIncomplete recognizes failed / partial / completed runs. --- */
assert.strictEqual(view.isRunIncomplete({ status: 'completed', stages: [{ status: 'completed' }] }), false,
  'a completed run with completed stages is not incomplete');
assert.strictEqual(view.isRunIncomplete({ status: 'failed', stages: [] }), true,
  'a failed run is flagged incomplete');
assert.strictEqual(view.isRunIncomplete({ status: 'completed', stages: [{ status: 'failed' }] }), true,
  'a "completed" run with a failed stage is flagged incomplete');
assert.strictEqual(view.isRunIncomplete(null), false,
  'a missing run is not flagged — early-out matches the original implementation');

/* --- buildRunProductList resolves a list by name with index filter. --- */
const data = {
  activeList: 'A',
  lists: {
    A: [
      { id: 'p1', url: 'https://example.test/p1', title: 'Item 1' },
      { id: 'p2', url: 'https://example.test/p2', title: 'Item 2' }
    ]
  }
};
const sliced = view.buildRunProductList(data, { listName: 'A', productIndexes: [1] });
assert.strictEqual(sliced.length, 1, 'productIndexes filters the list');
assert.strictEqual(sliced[0].id, 'p2', 'productIndexes preserves order');

const byUrl = view.buildRunProductList(data, { listName: 'A', productUrls: ['https://example.test/p1'] });
assert.strictEqual(byUrl.length, 1, 'productUrls falls back when indexes absent');
assert.strictEqual(byUrl[0].id, 'p1');

const full = view.buildRunProductList(data, { listName: 'A' });
assert.strictEqual(full.length, 2, 'with no filters the whole list comes through');

/* --- buildViewModel runs end-to-end on a minimal run shape --- */
const vmResult = view.buildViewModel({
  id: 'r1',
  listName: 'A',
  status: 'completed',
  completedAt: 1700000000000,
  stages: [
    { stage: 'comparison',   status: 'completed' },
    { stage: 'verification', status: 'completed' },
    { stage: 'enrichment',   status: 'completed' }
  ]
}, data.lists.A);
assert.ok(vmResult, 'buildViewModel returns an object');
assert.ok(Array.isArray(vmResult.products), 'view-model exposes products array');
assert.strictEqual(vmResult.products.length, 2, 'view-model carries each product');

/* === rescanController surface === */
const rescanCtx = makeCtx();
const rescanSource = read('comparison/rescanController.js');
assert.ok(rescanSource.includes('updates price, availability, images, and captured specs'),
  'rescan confirmation explains what data gets refreshed');
assert.ok(rescanSource.includes('Your list, notes, and saved AI results stay in place'),
  'rescan confirmation explains what data is preserved');
vm.runInContext(rescanSource, rescanCtx, { filename: 'comparison/rescanController.js' });
const rc = rescanCtx.ShopScoutComparison && rescanCtx.ShopScoutComparison.rescanController;
assert.ok(rc, 'ShopScoutComparison.rescanController namespace registered');
for (const name of ['rescanSingle', 'rescanSelectedProducts', 'rescanList', 'cancelActive']) {
  assert.strictEqual(typeof rc[name], 'function',
    `rescanController.${name} is a function on the namespace`);
}
/* Back-compat globals — comparison.js still binds these as event handlers. */
for (const name of ['rescanSingle', 'rescanList', 'rescanSelectedProducts']) {
  assert.strictEqual(typeof rescanCtx[name], 'function',
    `back-compat global ${name} is set on globalThis by rescanController`);
}
/* cancelActive returns false when no scan is running (the ribbon dispatcher
   reads the boolean to decide whether to surface a "no scan running" toast). */
assert.strictEqual(rc.cancelActive(), false,
  'cancelActive returns false when no scan is active');

/* === productDetailView surface === */
const detailCtx = makeCtx();
/* productDetailView reads editIndex/detailIndex off globalThis. */
detailCtx.editIndex = -1;
detailCtx.detailIndex = -1;
vm.runInContext(read('comparison/productDetailView.js'), detailCtx, { filename: 'comparison/productDetailView.js' });
const pd = detailCtx.ShopScoutComparison && detailCtx.ShopScoutComparison.productDetailView;
assert.ok(pd, 'ShopScoutComparison.productDetailView namespace registered');
for (const name of ['openEditModal', 'saveEdit', 'openProductDetail', 'closeProductDetail']) {
  assert.strictEqual(typeof pd[name], 'function',
    `productDetailView.${name} is a function on the namespace`);
}
/* Back-compat globals for the row-action menu and ribbon bindings. */
for (const name of ['openEditModal', 'saveEdit', 'openProductDetail', 'closeProductDetail']) {
  assert.strictEqual(typeof detailCtx[name], 'function',
    `back-compat global ${name} is set on globalThis by productDetailView`);
}

console.log('comparison-modules.test.js: all assertions passed');
