const assert = require('assert');
const vm = require('vm');
const { read } = require('./_helpers');

const src = read('normalization/libraries/generatedPacks.js');

function makeCtx(fetchImpl) {
  const meta = new Map();
  const ctx = {
    console,
    fetch: fetchImpl,
    SSDB: {
      db: {
        meta: {
          async get(key) {
            return meta.has(key) ? meta.get(key) : undefined;
          },
          async put(row) {
            meta.set(row.key, row);
          },
          async delete(key) {
            meta.delete(key);
          }
        }
      }
    }
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'normalization/libraries/generatedPacks.js' });
  return { ctx, meta };
}

const bundled = {
  verticalsIndex: {
    version: 1,
    verticals: [
      {
        id: 'electronics',
        displayName: 'Electronics',
        packUrl: 'https://github.com/LighthouseCollection/ShopScout-/releases/download/data-v1/electronics.json',
        packBytes: 123,
        packSha256: 'a'.repeat(64)
      },
      {
        id: 'sporting-goods',
        displayName: 'Sporting Goods',
        packUrl: null,
        packBytes: null,
        packSha256: null
      },
      {
        id: 'furniture',
        displayName: 'Furniture',
        packUrl: 'https://github.com/LighthouseCollection/ShopScout-/releases/download/data-v1/furniture.json',
        packBytes: 456,
        packSha256: 'b'.repeat(64)
      }
    ]
  },
  categoryToVertical: {
    version: 1,
    mapping: {
      119: 'electronics',
      287: 'sporting-goods'
    }
  }
};

(async () => {
  let fetchCalls = 0;
  const pack = {
    version: 1,
    vertical: { id: 'electronics', displayName: 'Electronics' },
    icecatVocabulary: {
      features: {
        1: {
          featureId: 1,
          displayName: 'Connectivity Technology',
          vocabulary: [{ canonical: 'Bluetooth', aliases: ['bt'] }]
        }
      }
    }
  };
  const furniturePack = {
    version: 1,
    vertical: { id: 'furniture', displayName: 'Furniture' },
    icecatVocabulary: {
      features: {
        2: {
          featureId: 2,
          displayName: 'Upholstery Material',
          vocabulary: [{ canonical: 'Faux Leather', aliases: ['pleather'] }]
        }
      }
    }
  };
  const { ctx, meta } = makeCtx(async url => {
    fetchCalls++;
    if (url === bundled.verticalsIndex.verticals[0].packUrl) {
      return { ok: true, json: async () => pack };
    }
    if (url === bundled.verticalsIndex.verticals[2].packUrl) {
      return { ok: true, json: async () => furniturePack };
    }
    throw new Error('unexpected pack URL ' + url);
  });
  const P = ctx.ShopScoutGeneratedPacks;
  P.loadBundledData(bundled);

  assert.deepStrictEqual(
    P.listVerticals().map(v => ({ id: v.id, displayName: v.displayName })),
    [
      { id: 'electronics', displayName: 'Electronics' },
      { id: 'sporting-goods', displayName: 'Sporting Goods' },
      { id: 'furniture', displayName: 'Furniture' }
    ],
    'public vertical list exposes bundled vertical metadata for picker UI'
  );
  const listed = P.listVerticals();
  listed[0].displayName = 'Mutated';
  assert.strictEqual(P.getVerticalInfo('electronics').displayName, 'Electronics',
    'public vertical list returns defensive copies');

  const detected = P.detectVerticalForProducts([{ _normalizationContext: { category: { id: '119' } } }]);
  assert.strictEqual(detected.verticalId, 'electronics', 'detects vertical id from Icecat category id');
  assert.strictEqual(detected.confidence, 0.95, 'preserves detection confidence');
  assert.strictEqual(detected.source, 'icecat-category-id', 'preserves detection source');
  assert.strictEqual(detected.categoryId, '119', 'preserves source category id');

  const breadcrumbDetected = P.detectVerticalForProducts([{
    category: 'Tools & Home Improvement > Power & Hand Tools > Power Tools > Electronics'
  }]);
  assert.strictEqual(breadcrumbDetected.verticalId, 'electronics',
    'detects a vertical from later breadcrumb segments when the first segment is not a vertical');
  assert.strictEqual(breadcrumbDetected.source, 'category-breadcrumb',
    'breadcrumb segment detection preserves the breadcrumb source');

  let result = await P.ensureVerticalPackLoaded('electronics');
  assert.strictEqual(result.ok, true, 'remote pack load succeeds');
  assert.strictEqual(result.source, 'remote', 'first load comes from remote');
  assert.strictEqual(result.pack.vertical.id, 'electronics', 'pack payload returned');
  assert.strictEqual(fetchCalls, 1, 'first load fetches once');
  assert.ok(meta.has('normalizationVerticalPack:electronics'), 'remote pack cached in IndexedDB meta');
  const enumHit = P.lookupEnum('electronics', 'Connectivity Technology', 'bt');
  assert.strictEqual(enumHit.normalized, 'Bluetooth', 'pack enum vocabulary normalizes aliases');
  assert.strictEqual(enumHit.rule, 'pack-enum:connectivity-technology:bluetooth',
    'pack enum hit includes generated-rule provenance');

  P._clearMemoryCacheForTest();
  result = await P.ensureVerticalPackLoaded('electronics');
  assert.strictEqual(result.ok, true, 'cached pack load succeeds');
  assert.strictEqual(result.source, 'cache', 'second load comes from IndexedDB cache');
  assert.strictEqual(fetchCalls, 1, 'cache hit does not fetch again');

  P._clearMemoryCacheForTest();
  await meta.delete('normalizationVerticalPack:electronics');
  fetchCalls = 0;
  const duplicateConcurrent = await Promise.all([
    P.ensureVerticalPackLoaded('electronics'),
    P.ensureVerticalPackLoaded('electronics')
  ]);
  assert.strictEqual(duplicateConcurrent[0].ok, true, 'first same-vertical concurrent pack load succeeds');
  assert.strictEqual(duplicateConcurrent[1].ok, true, 'second same-vertical concurrent pack load succeeds');
  assert.strictEqual(fetchCalls, 1, 'same-vertical concurrent pack loads share one fetch');

  P._clearMemoryCacheForTest();
  await meta.delete('normalizationVerticalPack:electronics');
  await meta.delete('normalizationVerticalPack:furniture');
  fetchCalls = 0;
  const concurrent = await Promise.all([
    P.ensureVerticalPackLoaded('electronics'),
    P.ensureVerticalPackLoaded('furniture')
  ]);
  assert.deepStrictEqual(concurrent.map(item => item.verticalId).sort(), ['electronics', 'furniture'],
    'concurrent pack loads resolve independently for multiple verticals');
  assert.strictEqual(fetchCalls, 2, 'different vertical concurrent pack loads fetch each required pack once');
  assert.strictEqual(P.lookupEnum('furniture', 'Upholstery Material', 'pleather').normalized, 'Faux Leather',
    'second vertical pack vocabulary remains addressable after concurrent load');

  const missing = await P.ensureVerticalPackLoaded('unknown');
  assert.strictEqual(missing.ok, false, 'unknown vertical fails safely');
  assert.strictEqual(missing.fallback, true, 'unknown vertical reports fallback');
  assert.strictEqual(missing.reason, 'unknown-vertical', 'unknown vertical reason preserved');

  const noPack = await P.ensureVerticalPackLoaded('sporting-goods');
  assert.strictEqual(noPack.ok, false, 'placeholder pack URL is skipped');
  assert.strictEqual(noPack.fallback, true, 'placeholder pack URL falls back to bundled defaults');
  assert.strictEqual(noPack.reason, 'missing-pack-url', 'placeholder reason preserved');

  const failing = makeCtx(async () => ({ ok: false, status: 404, json: async () => ({}) }));
  failing.ctx.console.warn = () => {};
  failing.ctx.ShopScoutGeneratedPacks.loadBundledData(bundled);
  const failed = await failing.ctx.ShopScoutGeneratedPacks.ensureVerticalPackLoaded('electronics');
  assert.strictEqual(failed.ok, false, 'fetch failure fails safely');
  assert.strictEqual(failed.fallback, true, 'fetch failure falls back');
  assert.strictEqual(failed.reason, 'fetch-failed', 'fetch failure reason preserved');

  console.log('generated-packs.test.js: assertions passed');
})();
