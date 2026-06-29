/* Integration test for data/db.js + data/productRepo.js using Dexie
   against fake-indexeddb. This intentionally drives the real IndexedDB
   schema, indexes, transactions, and repo query code path. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');

const Dexie = require('../vendor/dexie.min.js');
Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const dbSrc = fs.readFileSync(path.join(__dirname, '..', 'data', 'db.js'), 'utf8');
const repoSrc = fs.readFileSync(path.join(__dirname, '..', 'data', 'productRepo.js'), 'utf8');

async function createRepoContext() {
  const ctx = {
    Dexie,
    indexedDB,
    IDBKeyRange,
    crypto: { randomUUID: () => 'id-' + Math.random().toString(36).slice(2, 10) },
    Date,
    console
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  /* Delete before loading data/db.js so every test case gets a clean
     shopscout database with a fresh schema open. */
  await Dexie.delete('shopscout');
  vm.runInContext(dbSrc, ctx, { filename: 'data/db.js' });
  await ctx.SSDB.db.open();
  vm.runInContext(repoSrc, ctx, { filename: 'data/productRepo.js' });
  return ctx;
}

async function closeAndDelete(ctx) {
  if (!ctx?.SSDB?.db) return;
  ctx.SSDB.db.close();
  await Dexie.delete('shopscout');
}

async function withRepo(testFn) {
  const ctx = await createRepoContext();
  try {
    await testFn(ctx.SSProductRepo, ctx.SSDB.db);
  } finally {
    await closeAndDelete(ctx);
  }
}

async function seedProducts(repo, listId) {
  await repo.addProduct(listId, { title: 'A', source: 'amazon',  newPrice: 50, rating: 4.5 });
  await repo.addProduct(listId, { title: 'B', source: 'walmart', newPrice: 30, rating: 4.0 });
  await repo.addProduct(listId, { title: 'C', source: 'amazon',  newPrice: 80, rating: 4.7 });
}

(async () => {
  await withRepo(async (repo, db) => {
    const listId = await repo.ensureDefaultList();
    assert.ok(listId, 'ensureDefaultList returns an id');
    assert.strictEqual(await db.product_lists.count(), 1, 'real Dexie product_lists table has one list');
    assert.strictEqual(await repo.getActiveListId(), listId, 'active list id is stored through real meta table');

    await seedProducts(repo, listId);
    assert.strictEqual(await db.products.where('listId').equals(listId).count(), 3,
      'real Dexie listId index contains three products');
    assert.strictEqual(await repo.countProducts(listId), 3, 'repo count uses the listId index');

    let res = await repo.query(listId, {
      filters: [{ field: 'source', op: 'eq', value: 'amazon' }]
    });
    assert.strictEqual(res.length, 2, 'two amazon results');

    res = await repo.query(listId, {
      filters: [{ field: 'source', op: 'contains', value: 'wal' }]
    });
    assert.strictEqual(res.length, 1, 'one walmart result');
    assert.strictEqual(res[0].title, 'B');

    res = await repo.query(listId, {
      sort: [{ field: 'newPrice', dir: 'asc' }]
    });
    assert.deepStrictEqual(res.map(r => r.title), ['B', 'A', 'C'], 'sorted by price asc');

    res = await repo.query(listId, {
      sort: [{ field: 'rating', dir: 'desc' }]
    });
    assert.deepStrictEqual(res.map(r => r.title), ['C', 'A', 'B'], 'sorted by rating desc');

    res = await repo.query(listId, {
      filters: [
        { field: 'source',   op: 'eq', value: 'amazon' },
        { field: 'newPrice', op: 'gt', value: 60, conj: 'and' }
      ]
    });
    assert.strictEqual(res.length, 1, 'one amazon over $60');
    assert.strictEqual(res[0].title, 'C');

    res = await repo.query(listId, {
      filters: [
        { field: 'source',   op: 'eq', value: 'walmart' },
        { field: 'newPrice', op: 'gt', value: 70, conj: 'or' }
      ]
    });
    assert.deepStrictEqual(res.map(r => r.title).sort(), ['B', 'C'], 'B (walmart) and C (>70)');

    res = await repo.query(listId, { search: 'walmart' });
    assert.strictEqual(res.length, 1, 'search finds walmart row');
  });

  await withRepo(async (repo) => {
    const listId = await repo.ensureDefaultList();
    assert.strictEqual(await repo.countProducts(listId), 0,
      'fresh fake-indexeddb setup starts each case with no products');
  });

  console.log('product-repo.test.js: Dexie/fake-indexeddb assertions passed');
})().catch(err => { console.error(err); process.exit(1); });
