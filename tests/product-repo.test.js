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
const taxonomySrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'taxonomyBridge.js'), 'utf8');
const productSpecAccessSrc = fs.readFileSync(path.join(__dirname, '..', 'shared', 'productSpecAccess.js'), 'utf8');
const matchingSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'matching.js'), 'utf8');
const packsSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'libraries', 'generatedPacks.js'), 'utf8');
const registrySrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'registry.js'), 'utf8');
const enumLibSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'libraries', 'enums.js'), 'utf8');
const textNormalizerSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'normalizers', 'text.js'), 'utf8');
const enumNormalizerSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'normalizers', 'enum.js'), 'utf8');
const measurementNormalizerSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'normalizers', 'measurement.js'), 'utf8');
const normalizeSrc = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'normalize.js'), 'utf8');
const repoSrc = fs.readFileSync(path.join(__dirname, '..', 'data', 'productRepo.js'), 'utf8');
const esciFixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'normalization', 'libraries', 'generated', 'esciSubstitutes.json'),
  'utf8'
));

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
    fetch: async url => {
      if (String(url).endsWith('normalization/libraries/generated/esciSubstitutes.json')) {
        return {
          ok: true,
          json: async () => esciFixture
        };
      }
      if (String(url).endsWith('normalization/libraries/generated/test-electronics.json')) {
        return {
          ok: true,
          json: async () => ({
            version: 1,
            vertical: { id: 'electronics', displayName: 'Electronics' },
            icecatVocabulary: {
              features: {
                connectivity: {
                  displayName: 'Connectivity Technology',
                  vocabulary: [{ canonical: 'Bluetooth', aliases: ['BT Pack'] }]
                }
              }
            },
            icecatCategoryFeatures: { categories: {} },
            shopifyCategoryTree: { categories: {} }
          })
        };
      }
      if (String(url).endsWith('normalization/libraries/generated/test-furniture.json')) {
        return {
          ok: true,
          json: async () => ({
            version: 1,
            vertical: { id: 'furniture', displayName: 'Furniture' },
            icecatVocabulary: {
              features: {
                upholstery: {
                  displayName: 'Upholstery Material',
                  vocabulary: [{ canonical: 'Faux Leather', aliases: ['pleather'] }]
                }
              }
            },
            icecatCategoryFeatures: { categories: {} },
            shopifyCategoryTree: { categories: {} }
          })
        };
      }
      return {
        ok: false,
        json: async () => ({})
      };
    },
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
        if (String(product.category || '').includes('Chairs')) {
          return {
            gid: 'gid://shopify/TaxonomyCategory/fr-1-1',
            name: 'Office Chairs',
            full_name: 'Furniture > Office Furniture > Office Chairs',
            parts: ['Furniture', 'Office Furniture', 'Office Chairs']
          };
        }
        return null;
      },
      knownAttributesFor(category) {
        if (category && category.name === 'Keyboards') {
          return ['Color', 'Connectivity Technology', 'Keyboard Layout'];
        }
        if (category && category.name === 'Office Chairs') {
          return ['Color', 'Upholstery Material', 'Seat Depth'];
        }
        return [];
      },
      canonicalKey(value) {
        const text = String(value || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
        if (text === 'colour') return 'Color';
        if (text === 'connectivity tech') return 'Connectivity Technology';
        if (text === 'upholstery') return 'Upholstery Material';
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
  vm.runInContext(packsSrc, ctx, { filename: 'normalization/libraries/generatedPacks.js' });
  ctx.ShopScoutGeneratedPacks.loadBundledData({
    verticalsIndex: {
      version: 1,
      verticals: [
        {
          id: 'electronics',
          displayName: 'Electronics',
          packUrl: 'normalization/libraries/generated/test-electronics.json',
          packBytes: 100,
          packSha256: 'b'.repeat(64)
        },
        {
          id: 'furniture',
          displayName: 'Furniture',
          packUrl: 'normalization/libraries/generated/test-furniture.json',
          packBytes: 100,
          packSha256: 'c'.repeat(64)
        }
      ]
    },
    categoryToVertical: {
      version: 1,
      mapping: {
        'gid://shopify/TaxonomyCategory/el-3-2': 'electronics',
        'gid://shopify/TaxonomyCategory/fr-1-1': 'furniture'
      }
    }
  });
  vm.runInContext(userRulesSrc, ctx, { filename: 'normalization/userRules.js' });
  vm.runInContext(taxonomySrc, ctx, { filename: 'normalization/taxonomyBridge.js' });
  vm.runInContext(registrySrc, ctx, { filename: 'normalization/registry.js' });
  vm.runInContext(enumLibSrc, ctx, { filename: 'normalization/libraries/enums.js' });
  vm.runInContext(textNormalizerSrc, ctx, { filename: 'normalization/normalizers/text.js' });
  vm.runInContext(enumNormalizerSrc, ctx, { filename: 'normalization/normalizers/enum.js' });
  vm.runInContext(measurementNormalizerSrc, ctx, { filename: 'normalization/normalizers/measurement.js' });
  vm.runInContext(normalizeSrc, ctx, { filename: 'normalization/normalize.js' });
  vm.runInContext(productSpecAccessSrc, ctx, { filename: 'shared/productSpecAccess.js' });
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

  await withRepo(async (repo, db) => {
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
    assert.strictEqual(added._normalizationContext.vertical.id, 'electronics',
      'added product stores detected vertical context');
    const list = await db.product_lists.get(listId);
    assert.strictEqual(list.primaryVerticalId, 'electronics',
      'product list stores first detected vertical id as primary');
    assert.strictEqual(list.primaryVerticalSource, 'taxonomy-category-id',
      'product list stores primary vertical detection provenance');
    assert.deepStrictEqual(list.verticalsSeen, ['electronics'],
      'product list stores detected verticals seen for future pack loading');
    assert.ok(added._normalizationContext.knownAttributes.includes('Keyboard Layout'),
      'added product stores Shopify taxonomy attribute hints');
    assert.strictEqual(added._normalizedAttributes, undefined,
      'added product no longer persists the legacy normalized-attributes sidecar');
    assert.strictEqual(added.specs.Color, 'Navy Blue',
      'added product mirrors v2 Color display into specs');
    assert.strictEqual(added.specs.Size, 'M',
      'added product mirrors v2 Size display into specs');
    assert.strictEqual(added.specs['Connectivity Technology'], 'Bluetooth',
      'added product mirrors v2 pack-normalized connectivity display into specs');
    assert.deepStrictEqual(plain(added.specsNormalized.Color.display), ['Navy Blue'],
      'added product carries v2 Color display provenance');
    assert.strictEqual(added.specsNormalized.Size.display, 'M',
      'added product carries v2 Size display provenance');
    assert.deepStrictEqual(plain(added.specsNormalized['Connectivity Technology'].display), ['Bluetooth'],
      'added product uses Shopify taxonomy field mapping plus vertical pack vocabulary through v2');
    assert.strictEqual(added.specsNormalized['Connectivity Technology'].provenance.rules[0], 'pack-enum:connectivity-technology:bluetooth',
      'v2 pack-normalized connectivity records pack rule provenance');
    assert.strictEqual(added.specsNormalized['Connectivity Technology'].provenance.fieldSource, 'shopify-taxonomy',
      'v2 connectivity records taxonomy field provenance');

    const stored = await repo.getProduct(added.id);
    assert.strictEqual(stored._normalizedAttributes, undefined,
      'legacy normalized attributes are not persisted in IndexedDB');
    assert.deepStrictEqual(plain(stored.specsNormalized.Color.display), ['Navy Blue'],
      'v2 normalized specs are persisted in IndexedDB');
    assert.strictEqual(stored._normalizationContext.source, 'shopify-taxonomy',
      'taxonomy context is persisted in IndexedDB');
  });

  await withRepo(async (repo, db) => {
    const listId = await repo.ensureDefaultList();
    await repo.setListVertical(listId, { skip: true, source: 'bundled-defaults', confidence: 0 });

    const detection = await repo.detectListVertical(listId, [
      { title: 'Keyboard', category: 'Electronics > Computer Accessories > Keyboards' }
    ]);
    assert.strictEqual(Array.isArray(detection), true,
      'bundled-defaults skip returns a detection array');
    assert.strictEqual(detection.length, 0,
      'bundled-defaults skip prevents automatic vertical detection from re-selecting a pack');

    let list = await db.product_lists.get(listId);
    assert.strictEqual(list.primaryVerticalId, '', 'skip stores no primary vertical id');
    assert.strictEqual(list.primaryVerticalSource, 'bundled-defaults', 'skip stores bundled-defaults provenance');
    assert.strictEqual(list.verticalSkipped, true, 'skip stores a durable verticalSkipped flag');
    assert.deepStrictEqual(list.verticalsSeen, [], 'skip does not invent verticals seen');

    await repo.setListVertical(listId, { verticalId: 'electronics', source: 'manual-picker', confidence: 1 });
    list = await db.product_lists.get(listId);
    assert.strictEqual(list.primaryVerticalId, 'electronics', 'manual picker can set a primary vertical after skip');
    assert.strictEqual(list.verticalSkipped, false, 'manual picker clears the skip flag');
    assert.deepStrictEqual(list.verticalsSeen, ['electronics'], 'manual picker records selected vertical in verticalsSeen');
  });

  await withRepo(async (repo, db) => {
    const listId = await repo.ensureDefaultList();
    const added = await repo.addProducts(listId, [
      {
        id: 'keyboard-mixed',
        title: 'Mixed list keyboard',
        category: 'Electronics > Computer Accessories > Keyboards',
        rawSpecs: [
          { key: 'Connectivity Technology', value: 'BT Pack' }
        ]
      },
      {
        id: 'chair-mixed',
        title: 'Mixed list chair',
        category: 'Furniture > Office Furniture > Chairs',
        rawSpecs: [
          { key: 'Upholstery', value: 'pleather' }
        ]
      }
    ]);

    assert.strictEqual(added[0]._normalizationContext.vertical.id, 'electronics',
      'first product stores its own electronics vertical context');
    assert.strictEqual(added[1]._normalizationContext.vertical.id, 'furniture',
      'second product stores its own furniture vertical context');
    assert.deepStrictEqual(plain(added[0].specsNormalized['Connectivity Technology'].display), ['Bluetooth'],
      'electronics product normalizes against electronics pack vocabulary');
    assert.strictEqual(added[1].specsNormalized['Upholstery Material'].display, 'Faux Leather',
      'furniture product normalizes against furniture pack vocabulary');

    let list = await db.product_lists.get(listId);
    assert.strictEqual(list.primaryVerticalId, 'electronics',
      'first successful detection sets the primary vertical');
    assert.deepStrictEqual(list.verticalsSeen, ['electronics', 'furniture'],
      'mixed list records every detected vertical without changing primary');

    await repo.addProduct(listId, {
      id: 'chair-second',
      title: 'Second chair',
      category: 'Furniture > Office Furniture > Chairs',
      rawSpecs: [{ key: 'Upholstery', value: 'pleather' }]
    });
    list = await db.product_lists.get(listId);
    assert.strictEqual(list.primaryVerticalId, 'electronics',
      'subsequent detections never overwrite the primary vertical');
    assert.deepStrictEqual(list.verticalsSeen, ['electronics', 'furniture'],
      'verticalsSeen remains deduplicated and stable');
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

  await withRepo(async (repo) => {
    const listId = await repo.ensureDefaultList();
    await repo.addProducts(listId, [
      {
        title: 'Compact Mac Keyboard',
        brand: 'NorthStar',
        asin: 'B0KEYBOARD',
        modelNumber: 'NS-100'
      },
      {
        title: 'Wireless Keyboard for Office',
        brand: 'DeskPro',
        asin: 'B0KEYBRD02',
        modelNumber: 'DP-200'
      }
    ]);

    const candidates = await repo.findDuplicateCandidates(listId, { threshold: 0.09 });
    assert.strictEqual(candidates.length, 1,
      'repo loads ESCI substitutes before duplicate candidate scoring');
    assert.ok(candidates[0].evidence.includes('ESCI substitute co-occurrence'),
      'repo candidate exposes ESCI substitute evidence');
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
      'normalization rebuild backfills product-level normalization only where the product has detectable context');

    const updated = await repo.getProduct('old-1');
    assert.strictEqual(updated._normalizedAttributes, undefined,
      'normalization rebuild does not recreate the retired normalized-attributes sidecar');
    assert.deepStrictEqual(plain(updated.specsNormalized.Color.display), ['Navy Blue'],
      'normalization rebuild backfills v2 normalized specs for existing captured products');
    assert.strictEqual(updated._normalizationContext.category.leaf, 'Keyboards',
      'normalization rebuild backfills taxonomy context for existing captured products');
    const plainUpdated = await repo.getProduct('old-2');
    assert.strictEqual(plainUpdated._normalizationContext, undefined,
      'normalization rebuild does not apply list-primary vertical context to unrelated plain products');
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
    assert.deepStrictEqual(plain(added.specsNormalized['Connectivity Technology'].display), ['Bluetooth'],
      'saved user normalization rules apply to future captured products');
    assert.strictEqual(added.specsNormalized['Connectivity Technology'].provenance.rules[0], 'user-enum:connectivity-technology:bluetooth',
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

  await withRepo(async (repo, db) => {
    const listId = await repo.ensureDefaultList();
    await repo.addProduct(listId, { title: 'Only product', source: 'amazon' });
    await repo.deleteList(listId);
    assert.strictEqual(await db.product_lists.count(), 0, 'deleting the final list leaves no product lists');
    assert.strictEqual(await db.products.count(), 0, 'deleting the final list removes its products');
    assert.strictEqual(await repo.getActiveListId(), null, 'deleting the final list clears the active list id');
  });

  console.log('product-repo.test.js: Dexie/fake-indexeddb assertions passed');
})().catch(err => { console.error(err); process.exit(1); });
