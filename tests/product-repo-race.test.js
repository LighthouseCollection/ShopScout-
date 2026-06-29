const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoSrc = fs.readFileSync(path.join(__dirname, '..', 'data', 'productRepo.js'), 'utf8');

function table(rows) {
  return {
    async add(row) { rows.push(row); },
    async bulkAdd(items) { rows.push(...items); },
    async update(id, patch) {
      const index = rows.findIndex(row => row.id === id);
      if (index >= 0) rows[index] = Object.assign({}, rows[index], patch);
    },
    async delete(id) {
      const index = rows.findIndex(row => row.id === id);
      if (index >= 0) rows.splice(index, 1);
    },
    async bulkDelete(ids) {
      for (const id of ids) {
        const index = rows.findIndex(row => row.id === id);
        if (index >= 0) rows.splice(index, 1);
      }
    },
    async get(id) { return rows.find(row => row.id === id) || null; },
    async count() { return rows.length; },
    where(field) {
      return {
        equals(value) {
          const filtered = rows.filter(row => row[field] === value);
          return {
            async toArray() { return filtered.slice(); },
            async sortBy(sortField) {
              return filtered.slice().sort((a, b) => (a[sortField] || 0) - (b[sortField] || 0));
            },
            async count() { return filtered.length; },
            async delete() {
              for (const row of filtered) {
                const index = rows.indexOf(row);
                if (index >= 0) rows.splice(index, 1);
              }
            }
          };
        }
      };
    },
    orderBy(field) {
      const sorted = rows.slice().sort((a, b) => (a[field] || 0) - (b[field] || 0));
      return {
        async first() { return sorted[0] || null; },
        async toArray() { return sorted; }
      };
    }
  };
}

const products = [];
const lists = [];
const meta = new Map();
const lockCalls = [];

const ctx = {
  console,
  SSDB: {
    db: {
      product_lists: table(lists),
      products: table(products),
      views: table([]),
      meta: {
        async get(key) { return meta.has(key) ? { key, value: meta.get(key) } : null; },
        async put(row) { meta.set(row.key, row.value); }
      },
      async transaction(_mode, ...args) {
        const fn = args[args.length - 1];
        return fn();
      }
    },
    uuid: () => 'id-' + Math.random().toString(36).slice(2, 10),
    now: () => 1700000000000
  },
  ShopScoutState: {
    Actions: {
      listLock: listId => listId ? `list:${listId}` : null
    },
    createLockManager() {
      return {
        async runWithLock(key, task) {
          lockCalls.push(key);
          return task();
        }
      };
    }
  }
};
vm.createContext(ctx);
vm.runInContext(repoSrc, ctx, { filename: 'productRepo.js' });

const repo = ctx.SSProductRepo;

(async () => {
  const listId = await repo.ensureDefaultList();
  const created = await repo.addProduct(listId, { id: 'p1', title: 'Original', newPrice: '$10' });

  assert.strictEqual(created._revision, 1, 'new products start at revision 1');

  lockCalls.length = 0;
  let result = await repo.updateProduct('p1', {
    title: 'Manual edit',
    listId: 'other-list',
    'spec:Voltage': '12V',
    _ssRanks: { newPrice: 'best' },
    rowActions: 'generated'
  }, { listId, baseRevision: 1, source: 'manual-edit' });
  assert.strictEqual(result.ok, true, 'current-revision update succeeds');
  assert.strictEqual(result.product.title, 'Manual edit');
  assert.strictEqual(result.product._revision, 2, 'successful update increments revision');
  assert.strictEqual(result.product['spec:Voltage'], undefined, 'generated spec columns are not persisted');
  assert.strictEqual(result.product._ssRanks, undefined, 'generated rank metadata is not persisted');
  assert.strictEqual(result.product.rowActions, undefined, 'generated action cells are not persisted');
  assert.strictEqual(result.product.listId, listId, 'patches cannot move a product across lists');
  assert.deepStrictEqual(lockCalls, [`list:${listId}`], 'update uses the list-scoped state lock');

  result = await repo.updateProduct('p1', { title: 'Stale rescan' }, { listId, baseRevision: 1, source: 'rescan' });
  assert.strictEqual(result.ok, false, 'stale update is rejected');
  assert.strictEqual(result.reason, 'revision-conflict');
  assert.strictEqual(result.product.title, 'Manual edit', 'stale update does not overwrite current data');
  assert.strictEqual((await repo.getProduct('p1'))._revision, 2, 'rejected update does not bump revision');

  result = await repo.updateProduct('p1', { userRating: 5 });
  assert.strictEqual(result.ok, true, 'legacy update without baseRevision still succeeds');
  assert.strictEqual(result.product.userRating, 5);
  assert.strictEqual(result.product._revision, 3, 'legacy update still bumps revision');

  console.log('product-repo-race.test.js: all assertions passed');
})().catch(err => { console.error(err); process.exit(1); });
