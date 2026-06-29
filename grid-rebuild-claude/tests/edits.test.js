/* Tests for grid-rebuild-claude/edits/productEditor.js.
   The write() adapter must:
     - read the latest product before deriving baseRevision
     - pass {listId, baseRevision, source: 'grid-edit'} to repo.updateProduct
     - return { ok: true, product } on success
     - return { ok: false, reason: 'revision-conflict', conflict, product }
       on stale-write conflict
     - build patches correctly for both top-level fields and spec:* fields */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Promise };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'edits', 'productEditor.js'), 'utf8'),
  ctx,
  { filename: 'edits/productEditor.js' }
);
const E = ctx.ShopScoutGridEdits;
assert.ok(E && typeof E.write === 'function', 'ShopScoutGridEdits.write exposed');
assert.ok(typeof E.buildPatch === 'function', 'buildPatch exposed');

/* ---- buildPatch for primitive field -------------------------- */
{
  const patch = E.buildPatch('brand', 'Anker', { id: 'p1', brand: 'Old' });
  assert.strictEqual(JSON.stringify(patch), JSON.stringify({ brand: 'Anker' }));
}

/* ---- buildPatch for spec — set new --------------------------- */
{
  const product = { id: 'p1', rawSpecs: [{ key: 'Bluetooth', value: '4.2' }] };
  const patch = E.buildPatch('spec:Battery life', '20 hours', product);
  assert.ok(Array.isArray(patch.rawSpecs));
  /* Existing Bluetooth preserved, new Battery-life appended. */
  assert.strictEqual(patch.rawSpecs.length, 2);
  const added = patch.rawSpecs.find(s => s.key === 'Battery life');
  assert.strictEqual(added.value, '20 hours');
}

/* ---- buildPatch for spec — update existing ------------------- */
{
  const product = { id: 'p1', rawSpecs: [{ key: 'Bluetooth', value: '4.2' }] };
  const patch = E.buildPatch('spec:Bluetooth', '5.3', product);
  assert.strictEqual(patch.rawSpecs.length, 1);
  assert.strictEqual(patch.rawSpecs[0].value, '5.3');
}

/* ---- buildPatch for spec — remove on empty value ------------- */
{
  const product = { id: 'p1', rawSpecs: [
    { key: 'Bluetooth', value: '4.2' },
    { key: 'Waterproof', value: 'IP67' }
  ]};
  const patch = E.buildPatch('spec:Waterproof', '', product);
  assert.strictEqual(patch.rawSpecs.length, 1);
  assert.strictEqual(patch.rawSpecs[0].key, 'Bluetooth');
}

/* ---- buildPatch — spec key normalization (case-insensitive) -- */
{
  const product = { id: 'p1', rawSpecs: [{ key: 'Battery Life', value: '12 hours' }] };
  const patch = E.buildPatch('spec:battery life', '20 hours', product);
  /* Should update the existing entry rather than append. */
  assert.strictEqual(patch.rawSpecs.length, 1);
  assert.strictEqual(patch.rawSpecs[0].value, '20 hours');
}

/* ---- write: happy path passes baseRevision + source ---------- */
(async () => {
  const calls = [];
  const repo = {
    async getProduct(id) {
      assert.strictEqual(id, 'p1');
      return { id: 'p1', listId: 'list-a', _revision: 7, brand: 'Old' };
    },
    async updateProduct(...args) {
      calls.push(args);
      return { ok: true, product: { id: 'p1', listId: 'list-a', _revision: 8, brand: 'Anker' } };
    }
  };
  const result = await E.write({ repo, productId: 'p1', field: 'brand', value: 'Anker' });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.product.brand, 'Anker');
  assert.strictEqual(calls.length, 1, 'updateProduct called once');
  const [productId, patch, opts] = calls[0];
  assert.strictEqual(productId, 'p1');
  assert.strictEqual(JSON.stringify(patch), JSON.stringify({ brand: 'Anker' }));
  assert.strictEqual(opts.listId, 'list-a');
  assert.strictEqual(opts.baseRevision, 7);
  assert.strictEqual(opts.source, 'grid-edit');

  /* ---- write: missing product returns missing-product -------- */
  const missingRepo = {
    async getProduct() { return null; },
    async updateProduct() { throw new Error('should not be called when product missing'); }
  };
  const missing = await E.write({ repo: missingRepo, productId: 'gone', field: 'brand', value: 'X' });
  assert.strictEqual(missing.ok, false);
  assert.strictEqual(missing.reason, 'missing-product');

  /* ---- write: revision-conflict surfaces fresh product + flag */
  const conflictRepo = {
    async getProduct() { return { id: 'p1', listId: 'list-a', _revision: 5, brand: 'Old' }; },
    async updateProduct() {
      return {
        ok: false,
        reason: 'revision-conflict',
        product: { id: 'p1', listId: 'list-a', _revision: 8, brand: 'Stronger' }
      };
    }
  };
  const conflict = await E.write({ repo: conflictRepo, productId: 'p1', field: 'brand', value: 'Anker' });
  assert.strictEqual(conflict.ok, false);
  assert.strictEqual(conflict.reason, 'revision-conflict');
  assert.ok(conflict.conflict, 'conflict descriptor populated');
  assert.strictEqual(conflict.conflict.baseRevision, 5);
  assert.strictEqual(conflict.conflict.currentRevision, 8);
  assert.strictEqual(conflict.conflict.field, 'brand');
  assert.strictEqual(conflict.conflict.attemptedValue, 'Anker');
  assert.strictEqual(conflict.product.brand, 'Stronger', 'returns the canonical product');

  /* ---- write: bare repo without methods returns repo-unavailable */
  const noop = await E.write({ repo: {}, productId: 'p1', field: 'brand', value: 'X' });
  assert.strictEqual(noop.ok, false);
  assert.strictEqual(noop.reason, 'repo-unavailable');

  /* ---- write: spec patch is shaped as rawSpecs[] ------------- */
  const specCalls = [];
  const specRepo = {
    async getProduct() {
      return {
        id: 'p1', listId: 'list-a', _revision: 1,
        rawSpecs: [{ key: 'Bluetooth', value: '4.2' }]
      };
    },
    async updateProduct(...args) {
      specCalls.push(args);
      return { ok: true, product: { id: 'p1', listId: 'list-a', _revision: 2 } };
    }
  };
  await E.write({ repo: specRepo, productId: 'p1', field: 'spec:Battery life', value: '20 hours' });
  const [, specPatch] = specCalls[0];
  assert.ok(Array.isArray(specPatch.rawSpecs));
  const newEntry = specPatch.rawSpecs.find(s => s.key === 'Battery life');
  assert.strictEqual(newEntry.value, '20 hours');

  console.log('grid-rebuild-claude edits.test.js: all assertions passed');
})().catch(err => { console.error(err); process.exit(1); });
