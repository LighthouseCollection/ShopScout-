/* Smoke test for data/productRepo.js using fake-indexeddb.
   We can't actually require fake-indexeddb here (no npm install), so this test
   stubs Dexie's surface just enough to exercise query/filter/sort logic — the
   parts that have to be right regardless of the storage engine.

   When npm dependencies land, swap this for a real Dexie + fake-indexeddb run. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoSrc = fs.readFileSync(path.join(__dirname, '..', 'data', 'productRepo.js'), 'utf8');

/* Minimal Dexie + SSDB shim — only what productRepo touches at module init. */
const memoryProducts = [];
const memoryLists = [];
const memoryMeta = new Map();

function table(rows, indexField) {
  return {
    async add(r)        { rows.push(r); },
    async bulkAdd(rs)   { rows.push(...rs); },
    async update(id, p) {
      const i = rows.findIndex(r => r.id === id);
      if (i >= 0) rows[i] = Object.assign({}, rows[i], p);
    },
    async delete(id)    { const i = rows.findIndex(r => r.id === id); if (i >= 0) rows.splice(i, 1); },
    async bulkDelete(ids) { for (const id of ids) { const i = rows.findIndex(r => r.id === id); if (i >= 0) rows.splice(i, 1); } },
    async get(id)       { return rows.find(r => r.id === id) || null; },
    async count()       { return rows.length; },
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
      return {
        async first()   { return sorted[0] || null; },
        async toArray() { return sorted; }
      };
    }
  };
}

const metaTable = {
  async get(key)  { return memoryMeta.has(key) ? { key, value: memoryMeta.get(key) } : null; },
  async put(row)  { memoryMeta.set(row.key, row.value); }
};

const fakeDb = {
  product_lists: table(memoryLists),
  products:      table(memoryProducts),
  views:         table([]),
  meta:          metaTable,
  async transaction(_mode, ..._args) {
    const fn = _args[_args.length - 1];
    return await fn();
  }
};

const ctx = {
  SSDB: {
    db: fakeDb,
    uuid: () => 'id-' + Math.random().toString(36).slice(2, 10),
    now:  () => 1700000000000
  }
};
vm.createContext(ctx);
vm.runInContext(repoSrc, ctx, { filename: 'productRepo.js' });
const repo = ctx.SSProductRepo;

(async () => {
  /* default list bootstrap */
  const listId = await repo.ensureDefaultList();
  assert.ok(listId, 'ensureDefaultList returns an id');
  const lists = await repo.listLists();
  assert.strictEqual(lists.length, 1, 'exactly one list created');

  /* add + count */
  await repo.addProduct(listId, { title: 'A', source: 'amazon', newPrice: 50, rating: 4.5 });
  await repo.addProduct(listId, { title: 'B', source: 'walmart', newPrice: 30, rating: 4.0 });
  await repo.addProduct(listId, { title: 'C', source: 'amazon', newPrice: 80, rating: 4.7 });
  assert.strictEqual(await repo.countProducts(listId), 3, 'three products added');

  /* filter: source = amazon */
  let res = await repo.query(listId, {
    filters: [{ field: 'source', op: 'eq', value: 'amazon' }]
  });
  assert.strictEqual(res.length, 2, 'two amazon results');

  /* filter: source contains "wal" */
  res = await repo.query(listId, {
    filters: [{ field: 'source', op: 'contains', value: 'wal' }]
  });
  assert.strictEqual(res.length, 1, 'one walmart result');
  assert.strictEqual(res[0].title, 'B');

  /* sort: price asc */
  res = await repo.query(listId, {
    sort: [{ field: 'newPrice', dir: 'asc' }]
  });
  assert.deepStrictEqual(res.map(r => r.title), ['B', 'A', 'C'], 'sorted by price asc');

  /* sort: rating desc */
  res = await repo.query(listId, {
    sort: [{ field: 'rating', dir: 'desc' }]
  });
  assert.deepStrictEqual(res.map(r => r.title), ['C', 'A', 'B'], 'sorted by rating desc');

  /* compound filter (AND): amazon AND price > 60 */
  res = await repo.query(listId, {
    filters: [
      { field: 'source',   op: 'eq', value: 'amazon' },
      { field: 'newPrice', op: 'gt', value: 60, conj: 'and' }
    ]
  });
  assert.strictEqual(res.length, 1, 'one amazon over $60');
  assert.strictEqual(res[0].title, 'C');

  /* compound filter (OR): walmart OR price > 70 */
  res = await repo.query(listId, {
    filters: [
      { field: 'source',   op: 'eq', value: 'walmart' },
      { field: 'newPrice', op: 'gt', value: 70, conj: 'or' }
    ]
  });
  assert.strictEqual(res.length, 2, 'B (walmart) and C (>70)');

  /* free-text search */
  res = await repo.query(listId, { search: 'walmart' });
  assert.strictEqual(res.length, 1, 'search finds walmart row');

  console.log('product-repo.test.js: 8 assertions passed');
})().catch(err => { console.error(err); process.exit(1); });
