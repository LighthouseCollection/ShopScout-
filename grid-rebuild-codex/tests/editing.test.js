const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'grid-rebuild-codex', 'editing.js'), 'utf8');

const ctx = {
  console,
  globalThis: null,
  SSCanonical: {
    canonicalKey(value) {
      return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }
  }
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(source, ctx, { filename: 'grid-rebuild-codex/editing.js' });

const editing = ctx.ShopScoutGridCodexEditing;
assert.ok(editing, 'Codex grid editing namespace is registered');
assert.equal(typeof editing.buildProductPatch, 'function', 'buildProductPatch is exposed');
assert.equal(typeof editing.mirrorProductIntoLegacyBlob, 'function', 'mirrorProductIntoLegacyBlob is exposed');

const product = {
  id: 'p1',
  title: 'Camera',
  brand: 'Old',
  rawSpecs: [
    { key: 'Voltage', value: '12 V' },
    { key: 'Battery Life', value: '2 hours' }
  ]
};
const original = JSON.stringify(product);

assert.deepEqual(
  editing.buildProductPatch(product, { field: 'brand', value: 'New Brand' }),
  { brand: 'New Brand' },
  'plain editable fields produce a simple patch'
);

const voltagePatch = editing.buildProductPatch(product, { field: 'spec:voltage', value: '24 V' });
assert.deepEqual(voltagePatch.rawSpecs, [
  { key: 'Voltage', value: '24 V' },
  { key: 'Battery Life', value: '2 hours' }
], 'spec edits update the matching canonical rawSpec entry');

const addedSpecPatch = editing.buildProductPatch(product, { field: 'spec:water resistance', value: 'IPX7' });
assert.deepEqual(addedSpecPatch.rawSpecs, [
  { key: 'Voltage', value: '12 V' },
  { key: 'Battery Life', value: '2 hours' },
  { key: 'Water Resistance', value: 'IPX7' }
], 'missing spec edits append a friendly-label rawSpec entry');

assert.equal(JSON.stringify(product), original, 'edit patch builder does not mutate product objects');

const legacy = {
  activeList: 'Cameras',
  lists: {
    Cameras: [
      { id: 'p1', title: 'Old title', brand: 'Old' },
      { id: 'p2', title: 'Other' }
    ],
    Chargers: [{ id: 'p3', title: 'Charger' }]
  }
};

const mirrored = editing.mirrorProductIntoLegacyBlob(legacy, {
  id: 'p1',
  title: 'Camera',
  brand: 'New Brand',
  listId: 'repo-list-id',
  _revision: 4
});

assert.equal(mirrored.lists.Cameras[0].brand, 'New Brand', 'matching legacy product is updated');
assert.equal(mirrored.lists.Cameras[0].listId, undefined, 'repo-only listId is not leaked into legacy storage');
assert.equal(legacy.lists.Cameras[0].brand, 'Old', 'legacy blob is cloned before mirroring');

console.log('grid-codex-editing.test.js: all assertions passed');
