/* Behavioral test for SS.saveData → productRepo write-through.
   We stub chrome.storage.local + the SSDB Dexie surface in memory, then assert
   that saving the legacy blob populates products/lists in productRepo. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const utilsSrc = fs.readFileSync(path.join(__dirname, '..', 'utils.js'), 'utf8');
const repoSrc  = fs.readFileSync(path.join(__dirname, '..', 'data', 'productRepo.js'), 'utf8');

/* In-memory Dexie shim — same shape as productRepo's smoke test. */
const memProducts = [];
const memLists = [];
const memMeta = new Map();

function table(rows) {
  return {
    async add(r) { rows.push(r); },
    async bulkAdd(rs) { rows.push(...rs); },
    async clear() { rows.length = 0; },
    where(field) {
      return {
        equals(val) {
          const filtered = rows.filter(r => r[field] === val);
          return {
            async toArray() { return filtered.slice(); },
            async sortBy(f) { return filtered.slice().sort((a, b) => (a[f] || 0) - (b[f] || 0)); },
            async count() { return filtered.length; },
            async delete() { for (const r of filtered) { const i = rows.indexOf(r); if (i >= 0) rows.splice(i, 1); } }
          };
        }
      };
    },
    orderBy(field) {
      const sorted = rows.slice().sort((a, b) => (a[field] || 0) - (b[field] || 0));
      return { async first() { return sorted[0] || null; }, async toArray() { return sorted; } };
    },
    async get(id)     { return rows.find(r => r.id === id) || null; },
    async update(id, p) { const i = rows.findIndex(r => r.id === id); if (i >= 0) rows[i] = Object.assign({}, rows[i], p); },
    async delete(id)  { const i = rows.findIndex(r => r.id === id); if (i >= 0) rows.splice(i, 1); },
    async bulkDelete(ids) { for (const id of ids) { const i = rows.findIndex(r => r.id === id); if (i >= 0) rows.splice(i, 1); } },
    async count()     { return rows.length; }
  };
}

const fakeDb = {
  product_lists: table(memLists),
  products:      table(memProducts),
  views:         table([]),
  meta: {
    async get(key) { return memMeta.has(key) ? { key, value: memMeta.get(key) } : null; },
    async put(row) { memMeta.set(row.key, row.value); }
  },
  async transaction(_mode, ..._args) {
    const fn = _args[_args.length - 1];
    return await fn();
  }
};

/* Chrome shim */
const storageBackend = {};
const chromeStub = {
  storage: {
    local: {
      async get(key) { return key in storageBackend ? { [key]: storageBackend[key] } : {}; },
      async set(obj) { Object.assign(storageBackend, obj); }
    }
  }
};

/* Document stub for SS.esc() (which uses document.createElement) — basic enough. */
const documentStub = {
  createElement: () => ({
    set textContent(v) { this._t = v; },
    get innerHTML() { return String(this._t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  })
};

const ctx = {
  globalThis: null,           // set below
  chrome:     chromeStub,
  window:     {},
  document:   documentStub,
  location:   { href: 'https://example.test/' },
  URL,
  console,
  Blob,
  setTimeout, clearTimeout,
  requestAnimationFrame: fn => fn()
};
ctx.globalThis = ctx;
vm.createContext(ctx);

/* Wire SSDB shim and productRepo first */
ctx.SSDB = {
  db: fakeDb,
  uuid: () => 'id-' + Math.random().toString(36).slice(2, 10),
  now:  () => 1700000000000
};
vm.runInContext(repoSrc, ctx, { filename: 'productRepo.js' });

/* Then utils — its IIFE assigns window.SS */
vm.runInContext(utilsSrc, ctx, { filename: 'utils.js' });
const SS = ctx.window.SS;
assert.ok(SS, 'utils.js exposes window.SS');
assert.ok(typeof SS.saveData === 'function', 'SS.saveData exists');
assert.ok(typeof SS.bootstrapDataLayer === 'function', 'SS.bootstrapDataLayer exists');
assert.ok(typeof SS.mirrorToProductRepo === 'function', 'SS.mirrorToProductRepo exists');

(async () => {
  /* legacy save with two lists */
  const legacy = {
    activeList: 'Phones',
    lists: {
      'Phones': [
        { title: 'Pixel 9', source: 'google',  newPrice: 799 },
        { title: 'iPhone 15', source: 'apple', newPrice: 899 }
      ],
      'Laptops': [
        { title: 'XPS 13', source: 'dell', newPrice: 1299 }
      ]
    }
  };
  await SS.saveData(legacy);

  /* chrome.storage.local still has it */
  const stored = await chromeStub.storage.local.get('shopscout_data');
  assert.deepStrictEqual(stored.shopscout_data.activeList, 'Phones', 'chrome.storage.local still primary');

  /* productRepo has it too */
  assert.strictEqual(memLists.length, 2, 'two lists mirrored');
  assert.strictEqual(memProducts.length, 3, 'three products mirrored');

  /* active list pointer mirrored */
  const activeListId = memMeta.get('activeListId');
  assert.ok(activeListId, 'activeListId set in meta');
  const phones = memLists.find(l => l.id === activeListId);
  assert.strictEqual(phones && phones.name, 'Phones', 'active list points at Phones');

  /* mirror replaces, doesn't append: save again with one list */
  await SS.saveData({
    activeList: 'Tablets',
    lists: { 'Tablets': [{ title: 'iPad', source: 'apple', newPrice: 499 }] }
  });
  assert.strictEqual(memLists.length, 1,    'mirror replaces lists');
  assert.strictEqual(memProducts.length, 1, 'mirror replaces products');
  assert.strictEqual(memLists[0].name, 'Tablets', 'new list is Tablets');

  console.log('write-through.test.js: 9 assertions passed');
})().catch(err => { console.error(err); process.exit(1); });
