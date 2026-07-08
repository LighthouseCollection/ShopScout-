/* =============================================================
   ShopScout — generated vertical pack runtime

   Loads tiny bundled index files plus optional per-vertical packs from
   GitHub Releases. Packs are cached in IndexedDB meta and are fail-safe:
   missing network/data falls back to bundled deterministic defaults.
   ============================================================= */
(function initShopScoutGeneratedPacks(root) {
  const NS = (root.ShopScoutGeneratedPacks = root.ShopScoutGeneratedPacks || {});

  const INDEX_PATH = 'normalization/libraries/generated/verticals-index.json';
  const CATEGORY_VERTICAL_PATH = 'normalization/libraries/generated/icecat_category_to_vertical.json';
  const CACHE_PREFIX = 'normalizationVerticalPack:';

  let verticalsIndex = null;
  let categoryToVertical = null;
  let bundledLoadPromise = null;
  const memoryPacks = new Map();
  const packLoadPromises = new Map();
  const enumLookupCache = new Map();

  function chromeUrl(path) {
    try {
      if (root.chrome?.runtime?.getURL) return root.chrome.runtime.getURL(path);
    } catch {}
    return path;
  }

  async function fetchJson(pathOrUrl) {
    if (typeof root.fetch !== 'function') throw new Error('fetch unavailable');
    const response = await root.fetch(pathOrUrl && /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : chromeUrl(pathOrUrl));
    if (!response || !response.ok || typeof response.json !== 'function') {
      throw new Error('fetch failed');
    }
    return response.json();
  }

  function normalizeId(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeToken(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/[^\p{L}\p{N}+#./ ]+/gu, '')
      .replace(/\s+/g, ' ');
  }

  function slug(value) {
    return normalizeToken(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function loadBundledData(data) {
    verticalsIndex = data?.verticalsIndex || verticalsIndex || { version: 1, verticals: [] };
    categoryToVertical = data?.categoryToVertical || categoryToVertical || { version: 1, mapping: {} };
    return { verticalsIndex, categoryToVertical };
  }

  async function ensureBundledDataLoaded() {
    if (verticalsIndex && categoryToVertical) return { verticalsIndex, categoryToVertical };
    if (bundledLoadPromise) return bundledLoadPromise;
    bundledLoadPromise = Promise.all([
      fetchJson(INDEX_PATH).catch(err => {
        console.warn('ShopScoutGeneratedPacks: vertical index unavailable', err);
        return { version: 1, verticals: [] };
      }),
      fetchJson(CATEGORY_VERTICAL_PATH).catch(err => {
        console.warn('ShopScoutGeneratedPacks: category vertical map unavailable', err);
        return { version: 1, mapping: {} };
      })
    ]).then(([nextIndex, nextMapping]) => loadBundledData({
      verticalsIndex: nextIndex,
      categoryToVertical: nextMapping
    }));
    return bundledLoadPromise;
  }

  function verticalList() {
    return Array.isArray(verticalsIndex?.verticals) ? verticalsIndex.verticals : [];
  }

  function listVerticals() {
    return verticalList()
      .filter(v => v && v.id)
      .map(v => Object.assign({}, v));
  }

  function getVerticalInfo(verticalId) {
    const id = normalizeId(verticalId);
    return verticalList().find(v => v && v.id === id) || null;
  }

  /* Breadcrumb keyword → Shopify vertical map. Real-world retailer
     breadcrumbs (Amazon, Walmart) rarely name a Shopify vertical
     directly — "Automotive > Tools & Equipment > Air Compressors" needs
     to resolve to "hardware" even though no segment says "hardware".
     Rules are checked from most-specific segment (last) to least; a
     later rule can override an earlier default (Tools+Automotive → hardware
     wins over Automotive → vehicles-parts). Each entry is a case-
     insensitive substring the segment must contain. */
  const KEYWORD_VERTICAL_RULES = [
    /* Hardware — tools & compressors first so Automotive→vehicles-parts
       doesn't hijack a shop-tool breadcrumb. */
    ['hardware',            ['air compressor', 'air inflator', 'tire inflator', 'pneumatic', 'welding', 'welder', 'power tool', 'hand tool', 'tools & home improvement', 'tools & equipment', 'drill bit', 'chainsaw', 'grinder ', 'angle grinder']],
    ['electronics',         ['electronics', 'cell phone', 'cellular phone', 'smartphone', 'computer', 'laptop', 'tablet', 'monitor', 'headphone', 'earbud', 'speaker', 'tv & video', 'television', 'audio', 'video game']],
    ['cameras-optics',      ['camera', 'lens', 'binocular', 'telescope', 'microscope']],
    ['apparel-accessories', ['clothing', 'shoes', 'jewelry', 'watches', 'handbag', 'apparel', 'accessories & jewelry']],
    ['health-beauty',       ['beauty', 'personal care', 'skin care', 'makeup', 'cosmetic', 'health & household', 'vitamin', 'wellness', 'hair care']],
    ['sporting-goods',      ['sports & outdoors', 'sporting goods', 'fitness', 'exercise', 'camping', 'hiking', 'outdoor recreation', 'bicycle', 'cycling', 'fishing', 'golf']],
    ['toys-games',          ['toys & games', 'toy', 'board game', 'puzzle', 'action figure', 'dolls']],
    ['baby-toddler',        ['baby ', 'toddler', 'infant', 'diaper', 'stroller', 'car seat']],
    ['animals-pet-supplies',['pet supplies', 'pet food', 'dog ', 'cat ', 'aquarium']],
    ['office-supplies',     ['office products', 'office supplies', 'writing supplies', 'notebook & paper', 'printer & ink']],
    ['media',               ['books', 'kindle', 'audible', 'movies & tv', 'music, cds']],
    ['food-beverages-tobacco', ['grocery', 'gourmet food', 'beverage']],
    ['furniture',           ['furniture', 'sofa', 'mattress', 'bed frame', 'bookshelf']],
    ['home-garden',         ['home & kitchen', 'home & garden', 'kitchen & dining', 'appliances', 'bedding', 'bath ', 'garden', 'patio, lawn']],
    ['vehicles-parts',      ['automotive', 'motorcycle', 'car & vehicle', 'auto parts', 'vehicle accessories']],
    ['luggage-bags',        ['luggage', 'backpack', 'travel gear']],
    ['arts-entertainment',  ['musical instrument', 'party supplies', 'arts, crafts']],
    ['business-industrial', ['industrial & scientific', 'lab & scientific']]
  ];

  function verticalIdFromName(value) {
    const parts = String(value || '').split('>').map(part => part.trim()).filter(Boolean);
    if (!parts.length) return '';
    const reversed = parts.slice().reverse();

    /* Strategy 1: any segment slug matches a Shopify vertical display name. */
    const idsBySlug = new Map();
    for (const vertical of verticalList()) {
      const id = normalizeId(vertical?.id);
      if (!id) continue;
      idsBySlug.set(slug(vertical.displayName || id), id);
      idsBySlug.set(slug(id), id);
    }
    const slugHit = reversed.map(slug).map(partSlug => idsBySlug.get(partSlug)).find(Boolean);
    if (slugHit) return slugHit;

    /* Strategy 2: keyword substring match against the full breadcrumb.
       Walks all rules; the first vertical whose keyword appears in ANY
       segment wins. Rules are ordered specific → generic. */
    const availableIds = new Set(Array.from(idsBySlug.values()));
    const haystack = parts.join(' > ').toLowerCase();
    for (const [verticalId, keywords] of KEYWORD_VERTICAL_RULES) {
      if (!availableIds.has(verticalId)) continue;
      for (const keyword of keywords) {
        if (haystack.includes(keyword)) return verticalId;
      }
    }
    return '';
  }

  function categoryCandidates(product) {
    const ctxCategory = product?._normalizationContext?.category || {};
    return [
      product?.icecatCategoryId,
      product?.categoryId,
      product?.categoryID,
      ctxCategory.id,
      ctxCategory.gid
    ].map(normalizeId).filter(Boolean);
  }

  function detectVerticalForProducts(products) {
    const rows = Array.isArray(products) ? products : [];
    const mapping = categoryToVertical?.mapping || {};
    for (const product of rows) {
      for (const categoryId of categoryCandidates(product)) {
        const verticalId = mapping[categoryId];
        if (verticalId && getVerticalInfo(verticalId)) {
          return {
            verticalId,
            confidence: 0.95,
            source: categoryId.startsWith('gid://') ? 'taxonomy-category-id' : 'icecat-category-id',
            categoryId
          };
        }
      }
    }
    for (const product of rows) {
      const text = [
        product?._normalizationContext?.category?.fullName,
        product?.category
      ].find(Boolean);
      const verticalId = verticalIdFromName(text);
      if (verticalId) {
        return {
          verticalId,
          confidence: 0.85,
          source: 'category-breadcrumb',
          categoryId: ''
        };
      }
    }
    return { verticalId: '', confidence: 0, source: 'unmapped', categoryId: '' };
  }

  function cacheKey(verticalId) {
    return CACHE_PREFIX + normalizeId(verticalId);
  }

  async function readCachedPack(verticalId, info) {
    const meta = root.SSDB?.db?.meta;
    if (!meta || typeof meta.get !== 'function') return null;
    const row = await meta.get(cacheKey(verticalId));
    const value = row && row.value;
    if (!value || !value.pack) return null;
    if (info?.packSha256 && value.packSha256 && value.packSha256 !== info.packSha256) return null;
    if (info?.packUrl && value.packUrl && value.packUrl !== info.packUrl) return null;
    return value.pack;
  }

  async function writeCachedPack(verticalId, info, pack) {
    const meta = root.SSDB?.db?.meta;
    if (!meta || typeof meta.put !== 'function') return;
    await meta.put({
      key: cacheKey(verticalId),
      value: {
        verticalId,
        packUrl: info?.packUrl || '',
        packSha256: info?.packSha256 || '',
        cachedAt: Date.now(),
        pack
      }
    });
  }

  function isPackForVertical(pack, verticalId) {
    return pack && pack.version === 1 && (!pack.vertical?.id || pack.vertical.id === verticalId);
  }

  async function loadVerticalPack(id) {
    await ensureBundledDataLoaded();
    if (!id) return { ok: false, fallback: true, reason: 'missing-vertical' };
    const info = getVerticalInfo(id);
    if (!info) return { ok: false, fallback: true, reason: 'unknown-vertical', verticalId: id };
    if (memoryPacks.has(id)) {
      return { ok: true, source: 'memory', verticalId: id, info, pack: memoryPacks.get(id) };
    }
    const cached = await readCachedPack(id, info);
    if (cached && isPackForVertical(cached, id)) {
      memoryPacks.set(id, cached);
      return { ok: true, source: 'cache', verticalId: id, info, pack: cached };
    }
    if (!info.packUrl) {
      return { ok: false, fallback: true, reason: 'missing-pack-url', verticalId: id, info };
    }
    try {
      const pack = await fetchJson(info.packUrl);
      if (!isPackForVertical(pack, id)) {
        return { ok: false, fallback: true, reason: 'invalid-pack', verticalId: id, info };
      }
      memoryPacks.set(id, pack);
      await writeCachedPack(id, info, pack);
      return { ok: true, source: 'remote', verticalId: id, info, pack };
    } catch (err) {
      console.warn('ShopScoutGeneratedPacks: pack load failed', id, err);
      return { ok: false, fallback: true, reason: 'fetch-failed', verticalId: id, info };
    }
  }

  async function ensureVerticalPackLoaded(verticalId) {
    const id = normalizeId(verticalId);
    if (!id) return loadVerticalPack(id);
    if (memoryPacks.has(id)) {
      await ensureBundledDataLoaded();
      const info = getVerticalInfo(id);
      return { ok: true, source: 'memory', verticalId: id, info, pack: memoryPacks.get(id) };
    }
    if (packLoadPromises.has(id)) return packLoadPromises.get(id);
    const promise = loadVerticalPack(id).finally(() => {
      packLoadPromises.delete(id);
    });
    packLoadPromises.set(id, promise);
    return promise;
  }

  function getLoadedPack(verticalId) {
    return memoryPacks.get(normalizeId(verticalId)) || null;
  }

  function buildEnumLookup(verticalId) {
    const id = normalizeId(verticalId);
    if (enumLookupCache.has(id)) return enumLookupCache.get(id);
    const pack = getLoadedPack(id);
    const byField = Object.create(null);
    const features = pack?.icecatVocabulary?.features || {};
    for (const feature of Object.values(features)) {
      const field = String(feature?.displayName || feature?.canonicalName || '').trim();
      if (!field || !Array.isArray(feature?.vocabulary)) continue;
      if (!byField[field]) byField[field] = Object.create(null);
      for (const entry of feature.vocabulary) {
        const canonical = String(entry?.canonical || '').trim();
        if (!canonical) continue;
        const rule = 'pack-enum:' + slug(field) + ':' + slug(canonical);
        byField[field][normalizeToken(canonical)] = { normalized: canonical, confidence: 0.92, rule };
        for (const alias of (entry.aliases || [])) {
          byField[field][normalizeToken(alias)] = { normalized: canonical, confidence: 0.9, rule };
        }
      }
    }
    enumLookupCache.set(id, byField);
    return byField;
  }

  function lookupEnum(verticalId, field, rawValue) {
    const lookup = buildEnumLookup(verticalId);
    return lookup?.[field]?.[normalizeToken(rawValue)] || null;
  }

  function _clearMemoryCacheForTest() {
    memoryPacks.clear();
    packLoadPromises.clear();
    enumLookupCache.clear();
  }

  Object.assign(NS, {
    loadBundledData,
    ensureBundledDataLoaded,
    listVerticals,
    detectVerticalForProducts,
    ensureVerticalPackLoaded,
    getLoadedPack,
    lookupEnum,
    getVerticalInfo,
    _clearMemoryCacheForTest
  });
})(globalThis);
