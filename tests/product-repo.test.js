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
const rulesSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'libraries', 'defaultRules.js'), 'utf8');
const userRulesSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'userRules.js'), 'utf8');
const attrSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'attributes.js'), 'utf8');
const taxonomySrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'taxonomyBridge.js'), 'utf8');
const matchingSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'matching.js'), 'utf8');
const repoSrc = fs.readFileSync(path.join(__dirname, '..', 'data', 'productRepo.js'), 'utf8');

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

async function createRepoContext() {
  const ctx = {
    Dexie,
    indexedDB,
    IDBKeyRange,
    crypto: { randomUUID: () => 'id-' + Math.random().toString(36).slice(2, 10) },
    Date,
    console,
    SSCanonical: {
      matchProductToCategory(product) {
        if (String(product.category || '').includes('Keyboards')) {
          return {
            gid: 'gid://shopify/TaxonomyCategory/el-3-2',
            name: 'Keyboards',
            full_name: 'Electronics > Computer Accessories > Keyboards',
            parts: ['Electronics', 'Computer Accessories', 'Keyboards']
          };
        }
        return null;
      },
      knownAttributesFor(category) {
        return category && category.name === 'Keyboards'
          ? ['Color', 'Connectivity Technology', 'Keyboard Layout']
          : [];
      },
      canonicalKey(value) {
        const text = String(value || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
        if (text === 'colour') return 'Color';
        if (text === 'connectivity tech') return 'Connectivity Technology';
        return String(value || '').trim();
      }
    }
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  /* Delete before loading data/db.js so every test case gets a clean
     shopscout database with a fresh schema open. */
  await Dexie.delete('shopscout');
  vm.runInContext(dbSrc, ctx, { filename: 'data/db.js' });
  await ctx.SSDB.db.open();
  vm.runInContext(rulesSrc, ctx, { filename: 'normalization/libraries/defaultRules.js' });
  vm.runInContext(userRulesSrc, ctx, { filename: 'normalization/userRules.js' });
  vm.runInContext(taxonomySrc, ctx, { filename: 'normalization/taxonomyBridge.js' });
  vm.runInContext(attrSrc, ctx, { filename: 'normalization/attributes.js' });
  vm.runInContext(matchingSrc, ctx, { filename: 'normalization/matching.js' });
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

  await withRepo(async (repo) => {
    const listId = await repo.ensureDefaultList();
    const added = await repo.addProduct(listId, {
      title: 'Supplier keyboard',
      category: 'Electronics > Computer Accessories > Keyboards',
      rawSpecs: [
        { key: 'Colour', value: 'midnight blue' },
        { key: 'Size Name', value: 'medium' },
        { key: 'Connectivity Tech', value: 'Bluetooth' }
      ]
    });

    assert.strictEqual(added._normalizationContext.category.leaf, 'Keyboards',
      'added product stores Shopify taxonomy category context');
    assert.ok(added._normalizationContext.knownAttributes.includes('Keyboard Layout'),
      'added product stores Shopify taxonomy attribute hints');
    assert.deepStrictEqual(plain(added._normalizedAttributes.Color), {
      rawField: 'Colour',
      raw: 'midnight blue',
      normalized: 'Navy Blue',
      confidence: 0.95,
      rule: 'enum:color:navy-blue'
    }, 'added product carries normalized Color provenance');
    assert.deepStrictEqual(plain(added._normalizedAttributes.Size), {
      rawField: 'Size Name',
      raw: 'medium',
      normalized: 'M',
      confidence: 1,
      rule: 'enum:size:m'
    }, 'added product carries normalized Size provenance');
    assert.deepStrictEqual(plain(added._normalizedAttributes['Connectivity Technology']), {
      rawField: 'Connectivity Tech',
      raw: 'Bluetooth',
      normalized: 'Bluetooth',
      confidence: 0,
      rule: 'unmapped',
      fieldRule: 'taxonomy-field:connectivity-technology',
      fieldSource: 'shopify-taxonomy'
    }, 'added product uses Shopify taxonomy field mapping when local aliases do not know the field');

    const stored = await repo.getProduct(added.id);
    assert.strictEqual(stored._normalizedAttributes.Color.normalized, 'Navy Blue',
      'normalized attributes are persisted in IndexedDB');
    assert.strictEqual(stored._normalizationContext.source, 'shopify-taxonomy',
      'taxonomy context is persisted in IndexedDB');
  });

  await withRepo(async (repo) => {
    const listId = await repo.ensureDefaultList();
    await repo.addProducts(listId, [
      { title: 'Bearing, Ball, 6204-2RS', brand: 'ACME', modelNumber: '6204-2RS' },
      { title: '6204 2RS Ball Bearing', brand: 'Acme Tools', modelNumber: '6204 2RS' },
      { title: '3/4 IN NPT Brass Elbow', brand: 'ACME', modelNumber: 'NPT-ELBOW-075' }
    ]);

    const candidates = await repo.findDuplicateCandidates(listId);
    assert.strictEqual(candidates.length, 1, 'repo reports one duplicate candidate pair');
    assert.deepStrictEqual(plain(candidates[0].titles.slice().sort()), ['6204 2RS Ball Bearing', 'Bearing, Ball, 6204-2RS'],
      'repo duplicate candidate reports the matching product titles');
    assert.strictEqual(await repo.countProducts(listId), 3,
      'duplicate detection does not merge or delete products');
  });

  await withRepo(async (repo, db) => {
    const listId = await repo.ensureDefaultList();
    const now = Date.now();
    await db.products.bulkAdd([
      {
        id: 'old-1',
        listId,
        title: 'Legacy keyboard',
        category: 'Electronics > Computer Accessories > Keyboards',
        rawSpecs: [{ key: 'Colour', value: 'midnight blue' }],
        capturedAt: now,
        updatedAt: now,
        _revision: 1
      },
      {
        id: 'old-2',
        listId,
        title: 'Legacy plain product',
        rawSpecs: [],
        capturedAt: now,
        updatedAt: now,
        _revision: 1
      }
    ]);

    const result = await repo.rebuildNormalizationForList(listId);
    assert.deepStrictEqual(plain(result), { ok: true, checked: 2, updated: 1 },
      'normalization rebuild updates only legacy products with derived normalization data');

    const updated = await repo.getProduct('old-1');
    assert.strictEqual(updated._normalizedAttributes.Color.normalized, 'Navy Blue',
      'normalization rebuild backfills normalized attributes for existing captured products');
    assert.strictEqual(updated._normalizationContext.category.leaf, 'Keyboards',
      'normalization rebuild backfills taxonomy context for existing captured products');
  });

  await withRepo(async (repo) => {
    const listId = await repo.ensureDefaultList();
    await repo.addProducts(listId, [
      { id: 'd1', title: 'Bearing, Ball, 6204-2RS', brand: 'ACME', modelNumber: '6204-2RS' },
      { id: 'd2', title: '6204 2RS Ball Bearing', brand: 'Acme Tools', modelNumber: '6204 2RS' }
    ]);

    let candidates = await repo.findDuplicateCandidates(listId);
    assert.strictEqual(candidates[0].reviewDecision, '', 'new duplicate candidates start undecided');
    assert.strictEqual(candidates[0].candidateKey, 'd1::d2', 'repo candidate exposes stable key');

    await repo.setDuplicateCandidateDecision(listId, candidates[0].candidateKey, 'not-duplicate');
    candidates = await repo.findDuplicateCandidates(listId);
    assert.strictEqual(candidates[0].reviewDecision, 'not-duplicate',
      'repo attaches saved duplicate review decisions to candidate rows');
    assert.strictEqual(await repo.countProducts(listId), 2,
      'duplicate review decisions do not merge or delete products');

    await repo.setDuplicateCandidateDecision(listId, candidates[0].candidateKey, 'same-product');
    candidates = await repo.findDuplicateCandidates(listId);
    assert.strictEqual(candidates[0].reviewDecision, 'same-product',
      'same-product review decision can be saved without mutating products');
  });

  await withRepo(async (repo) => {
    const listId = await repo.ensureDefaultList();

    await repo.saveNormalizationReviewDecision(listId, {
      action: 'accept-alias',
      item: {
        rawField: 'Connectivity Tech',
        field: 'Connectivity Technology',
        raw: 'Bluetooth LE',
        normalized: 'Bluetooth'
      }
    });

    let rules = await repo.getUserNormalizationRules(listId);
    assert.deepStrictEqual(plain(rules.fieldAliases['connectivity technology']), ['Connectivity Tech'],
      'accepted field alias is persisted in the user rules library');
    assert.deepStrictEqual(plain(rules.enums['Connectivity Technology'].Bluetooth), ['Bluetooth LE'],
      'accepted enum alias is persisted in the user rules library');

    const added = await repo.addProduct(listId, {
      title: 'Bluetooth keyboard',
      rawSpecs: [{ key: 'Connectivity Tech', value: 'Bluetooth LE' }]
    });
    assert.strictEqual(added._normalizedAttributes['Connectivity Technology'].normalized, 'Bluetooth',
      'saved user normalization rules apply to future captured products');
    assert.strictEqual(added._normalizedAttributes['Connectivity Technology'].rule, 'user-enum:connectivity-technology:bluetooth',
      'saved user normalization rules mark provenance as user-approved');

    const ignore = await repo.saveNormalizationReviewDecision(listId, {
      action: 'ignore',
      item: {
        productId: 'p-ignore',
        rawField: 'Marketing Name',
        field: 'Marketing Name',
        raw: 'Pro Grade',
        normalized: 'Pro Grade'
      }
    });
    rules = await repo.getUserNormalizationRules(listId);
    assert.ok(rules.ignored.includes(ignore.reviewKey), 'ignored review item key is persisted');

    await repo.deleteUserNormalizationRule(listId, {
      field: 'Connectivity Technology',
      rawField: 'Connectivity Tech',
      raw: 'Bluetooth LE',
      normalized: 'Bluetooth',
      reviewKey: ignore.reviewKey
    });
    rules = await repo.getUserNormalizationRules(listId);
    assert.ok(!rules.fieldAliases['connectivity technology']?.includes('Connectivity Tech'),
      'delete rule removes accepted field alias');
    assert.ok(!rules.enums['Connectivity Technology']?.Bluetooth?.includes('Bluetooth LE'),
      'delete rule removes accepted enum alias');
    assert.ok(!rules.ignored.includes(ignore.reviewKey), 'delete rule removes ignored review key');
  });

  console.log('product-repo.test.js: Dexie/fake-indexeddb assertions passed');
})().catch(err => { console.error(err); process.exit(1); });
