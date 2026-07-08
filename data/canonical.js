/* =============================================================
   ShopScout — Canonical lookup
   Single source of truth for product taxonomy + attribute / value
   normalization, backed by the bundled Shopify product-taxonomy JSON
   (~94 MB), plus js-quantities for unit-bearing values and a small
   hand-curated abbreviation table.

   First load: fetches vendor/shopify-taxonomy/taxonomy.json, parses it,
   builds derived indices, and persists them to IndexedDB so subsequent
   loads come back in milliseconds. The raw JSON is only re-parsed when
   the bundled version differs from the cached one (i.e. on extension
   update with a newer taxonomy release).

   Public API on window.SSCanonical:
     ready()                          — load + build indices (idempotent)
     isReady()                        — true after first ready()
     canonicalKey(variant)            — long form -> short canonical
     canonicalValue(value)            — unit-aware short form
     findCategory(query)              — match a category by name/breadcrumb
     matchProductToCategory(product)  — best-fit category for a product
     knownAttributesFor(category)     — Shopify-declared attribute names
                                        for a category (walks ancestors)
     getAttributesNames()             — every Shopify attribute name
     getCategoryBreadcrumbs()         — every category full_name
   ============================================================= */
(function initCanonical(root) {
  const TAXONOMY_PATH = 'vendor/shopify-taxonomy/taxonomy.json';
  const GOOGLE_PATH   = 'vendor/google-taxonomy.txt';

  /* IndexedDB cache keys (in the existing `meta` store). */
  const CACHE_VERSION_KEY  = 'canonical:cached_version';
  const CACHE_PAYLOAD_KEY  = 'canonical:cached_payload';
  /* Bump this if the derived-index schema changes — invalidates all caches. */
  const SCHEMA_TAG = 'v3';

  /* Hand-curated abbreviation table. Canonical short form -> long variants. */
  const ABBREVIATIONS = {
    'DPI':  ['dots per inch', 'dots-per-inch', 'dot per inch'],
    'PPI':  ['pixels per inch', 'pixels-per-inch', 'pixel per inch'],
    'CPI':  ['characters per inch'],
    'Hz':   ['hertz'],
    'kHz':  ['kilohertz', 'kilo hertz'],
    'MHz':  ['megahertz', 'mega hertz'],
    'GHz':  ['gigahertz', 'giga hertz'],
    'RPM':  ['revolutions per minute', 'rotations per minute', 'rev per min'],
    'FPS':  ['frames per second', 'frame per second'],
    'BPM':  ['beats per minute'],
    'PSI':  ['pounds per square inch'],
    'kPa':  ['kilopascals', 'kilopascal'],
    'W':    ['watts', 'watt', 'wattage'],
    'mW':   ['milliwatts', 'milliwatt'],
    'kW':   ['kilowatts', 'kilowatt'],
    'V':    ['volts', 'volt', 'voltage'],
    'mV':   ['millivolts', 'millivolt'],
    'A':    ['amps', 'amperes', 'ampere'],
    'mA':   ['milliamps', 'milliampere'],
    'mAh':  ['milliamp-hour', 'milliampere-hour', 'milliamp hour'],
    'Ah':   ['amp-hour', 'ampere-hour'],
    '"':    ['inches', 'inch', 'in.'],
    'ft':   ['feet', 'foot'],
    'yd':   ['yards', 'yard'],
    'mm':   ['millimeters', 'millimeter'],
    'cm':   ['centimeters', 'centimeter'],
    'm':    ['meters', 'meter'],
    'km':   ['kilometers', 'kilometer'],
    'g':    ['grams', 'gram'],
    'kg':   ['kilograms', 'kilogram'],
    'mg':   ['milligrams', 'milligram'],
    'lb':   ['pounds', 'pound', 'lbs'],
    'oz':   ['ounces', 'ounce'],
    'B':    ['bytes', 'byte'],
    'KB':   ['kilobyte', 'kilobytes', 'kibibyte'],
    'MB':   ['megabyte', 'megabytes'],
    'GB':   ['gigabyte', 'gigabytes'],
    'TB':   ['terabyte', 'terabytes'],
    'Mbps': ['megabits per second', 'mbit/s'],
    'Gbps': ['gigabits per second', 'gbit/s'],
    'Kbps': ['kilobits per second'],
    's':    ['seconds', 'second', 'sec'],
    'ms':   ['milliseconds', 'millisecond'],
    'min':  ['minutes', 'minute'],
    'h':    ['hours', 'hour'],
    'hr':   ['hour'],
    'lm':   ['lumens', 'lumen'],
    'cd':   ['candelas', 'candela'],
    'nit':  ['nits'],
    'lx':   ['lux'],
    'K':    ['kelvin']
  };

  /* Reverse lookup: lower-cased variant -> canonical short form. */
  const REVERSE = Object.create(null);
  for (const canon of Object.keys(ABBREVIATIONS)) {
    REVERSE[canon.toLowerCase()] = canon;
    for (const variant of ABBREVIATIONS[canon]) REVERSE[variant.toLowerCase()] = canon;
  }

  /* ===== State ===== */
  let taxonomyVersion       = null;
  let categoryByFullNameLC  = null;  // Map<lowerFullName, category>
  let categoryByLeafLC      = null;  // Map<lowerLeafName, category[]>
  let categoriesAll         = null;  // Array<category> (deduped, all verticals)
  let attributesByName      = null;  // Map<lowerName, canonical-cased name>
  let attributesAllNames    = null;  // Array<string> (canonical names)
  let categoryAttrIds       = null;  // Map<gid, [attribute name, ...]>
  let parentByGid           = null;  // Map<gid, parentGid>
  let googleBreadcrumbs     = null;  // Array<{ id, breadcrumb, parts, leaf }>
  let loadingPromise        = null;

  /* ===== Helpers ===== */
  function chromeUrl(path) {
    try {
      if (root.chrome && root.chrome.runtime && root.chrome.runtime.getURL) {
        return root.chrome.runtime.getURL(path);
      }
    } catch {}
    return path;
  }

  async function fetchText(path) {
    const resp = await fetch(chromeUrl(path));
    if (!resp.ok) throw new Error('Failed to load ' + path + ': ' + resp.status);
    return resp.text();
  }
  async function fetchJSON(path) {
    const resp = await fetch(chromeUrl(path));
    if (!resp.ok) throw new Error('Failed to load ' + path + ': ' + resp.status);
    return resp.json();
  }

  /* ===== IndexedDB cache (uses the existing SSDB meta store) ===== */
  function metaGet(key) {
    const db = root.SSDB && root.SSDB.db;
    if (!db) return Promise.resolve(null);
    return db.meta.get(key).then(r => r ? r.value : null).catch(() => null);
  }
  function metaPut(key, value) {
    const db = root.SSDB && root.SSDB.db;
    if (!db) return Promise.resolve();
    return db.meta.put({ key, value }).catch(() => {});
  }

  /* ===== Index builders ===== */
  function buildShopifyIndices(json) {
    taxonomyVersion      = json.version || 'unknown';
    categoryByFullNameLC = new Map();
    categoryByLeafLC     = new Map();
    categoriesAll        = [];
    attributesByName     = new Map();
    attributesAllNames   = [];
    categoryAttrIds      = new Map();
    parentByGid          = new Map();

    const seenAttrNames = new Set();

    for (const vertical of (json.verticals || [])) {
      for (const c of (vertical.categories || [])) {
        if (!c || !c.id || !c.full_name) continue;
        const rec = {
          gid: c.id,
          name: c.name,
          full_name: c.full_name,
          parts: c.full_name.split(' > ').map(s => s.trim()),
          level: c.level || 0
        };
        categoriesAll.push(rec);
        categoryByFullNameLC.set(c.full_name.toLowerCase(), rec);
        const leafLC = (c.name || '').toLowerCase();
        if (!categoryByLeafLC.has(leafLC)) categoryByLeafLC.set(leafLC, []);
        categoryByLeafLC.get(leafLC).push(rec);
        parentByGid.set(c.id, c.parent_id || null);

        /* Each category embeds its attribute list inline with full info. */
        const attrNames = [];
        for (const a of (c.attributes || [])) {
          if (!a || !a.name) continue;
          attrNames.push(a.name);
          if (!seenAttrNames.has(a.name.toLowerCase())) {
            seenAttrNames.add(a.name.toLowerCase());
            attributesAllNames.push(a.name);
            attributesByName.set(a.name.toLowerCase(), a.name);
          }
        }
        if (attrNames.length) categoryAttrIds.set(c.id, attrNames);
      }
    }

    /* Top-level attributes — covers any not embedded in a leaf category. */
    for (const a of (json.attributes || [])) {
      if (!a || !a.name) continue;
      if (!seenAttrNames.has(a.name.toLowerCase())) {
        seenAttrNames.add(a.name.toLowerCase());
        attributesAllNames.push(a.name);
        attributesByName.set(a.name.toLowerCase(), a.name);
      }
    }
  }

  function parseGoogle(text) {
    const out = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf(' - ');
      if (idx < 0) continue;
      const id = line.slice(0, idx).trim();
      const breadcrumb = line.slice(idx + 3).trim();
      const parts = breadcrumb.split(' > ').map(s => s.trim());
      const leaf = parts[parts.length - 1] || '';
      out.push({ id, breadcrumb, parts, leaf, leafLower: leaf.toLowerCase() });
    }
    return out;
  }

  /* Serialize for IndexedDB. Maps -> arrays of pairs. */
  function snapshot() {
    return {
      schema: SCHEMA_TAG,
      version: taxonomyVersion,
      categories: categoriesAll,
      categoryByFullNameLC: [...categoryByFullNameLC],
      categoryByLeafLC: [...categoryByLeafLC],
      attributesByName: [...attributesByName],
      attributesAllNames,
      categoryAttrIds: [...categoryAttrIds],
      parentByGid: [...parentByGid]
    };
  }

  function rehydrate(snap) {
    taxonomyVersion       = snap.version;
    categoriesAll         = snap.categories || [];
    categoryByFullNameLC  = new Map(snap.categoryByFullNameLC || []);
    categoryByLeafLC      = new Map(snap.categoryByLeafLC || []);
    attributesByName      = new Map(snap.attributesByName || []);
    attributesAllNames    = snap.attributesAllNames || [];
    categoryAttrIds       = new Map(snap.categoryAttrIds || []);
    parentByGid           = new Map(snap.parentByGid || []);
  }

  async function loadAll() {
    if (taxonomyVersion) return;
    if (loadingPromise) return loadingPromise;
    loadingPromise = (async () => {
      /* Always grab Google taxonomy — small, parses fast, used for cross-ref. */
      const googleTextPromise = fetchText(GOOGLE_PATH);

      /* Try the IndexedDB cache first. */
      const cachedVersion = await metaGet(CACHE_VERSION_KEY);
      const cachedPayload = await metaGet(CACHE_PAYLOAD_KEY);
      if (cachedVersion && cachedPayload && cachedPayload.schema === SCHEMA_TAG) {
        rehydrate(cachedPayload);
        googleBreadcrumbs = parseGoogle(await googleTextPromise);
        /* Background-check that the bundled version matches; if not, re-parse. */
        try {
          const json = await fetchJSON(TAXONOMY_PATH);
          if (json.version !== cachedVersion) {
            buildShopifyIndices(json);
            await metaPut(CACHE_VERSION_KEY, taxonomyVersion);
            await metaPut(CACHE_PAYLOAD_KEY, snapshot());
          }
        } catch (err) {
          console.warn('SSCanonical: background version check failed', err);
        }
        return;
      }

      /* No cache — fetch + parse + persist. */
      const json = await fetchJSON(TAXONOMY_PATH);
      buildShopifyIndices(json);
      googleBreadcrumbs = parseGoogle(await googleTextPromise);
      await metaPut(CACHE_VERSION_KEY, taxonomyVersion);
      await metaPut(CACHE_PAYLOAD_KEY, snapshot());
    })();
    try { await loadingPromise; }
    finally { loadingPromise = null; }
  }

  /* ===== Public API ===== */
  function canonicalKey(variant) {
    if (variant == null) return '';
    const trimmed = String(variant).trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    const fromAbbr = REVERSE[lower];
    if (fromAbbr) return fromAbbr;
    if (attributesByName) {
      const fromShopify = attributesByName.get(lower);
      if (fromShopify) return fromShopify;
    }
    return trimmed;
  }

  function canonicalValue(value) {
    if (value == null) return '';
    const trimmed = String(value).trim();
    if (!trimmed) return '';
    if (root.Qty) {
      try {
        const qty = root.Qty(trimmed);
        if (qty && typeof qty.scalar === 'number' && qty.units) {
          const unit = qty.units();
          if (unit) {
            const short = canonicalKey(unit) || unit;
            const num = qty.scalar;
            return (num % 1 === 0 ? num.toString() : num.toFixed(2)) + short;
          }
        }
      } catch { /* not a quantity */ }
    }
    return trimmed;
  }

  /* Find a category by name or breadcrumb. Tries:
       1. Exact full_name match (case-insensitive)
       2. Suffix match (the query is the tail of some full_name)
       3. Leaf-name exact match
       4. Substring on full_name */
  function findCategory(query) {
    if (!query || !categoryByFullNameLC) return null;
    const q = String(query).trim();
    if (!q) return null;
    const qLower = q.toLowerCase();

    const exact = categoryByFullNameLC.get(qLower);
    if (exact) return exact;

    /* Suffix match: "Men's > Eau de Parfum" -> "Beauty & Personal Care > … > Men's > Eau de Parfum" */
    let bestSuffix = null, bestSuffixLen = 0;
    for (const [fn, cat] of categoryByFullNameLC) {
      if (fn.endsWith(qLower) && qLower.length > bestSuffixLen) {
        bestSuffix = cat; bestSuffixLen = qLower.length;
      }
    }
    if (bestSuffix) return bestSuffix;

    const leafMatches = categoryByLeafLC.get(qLower);
    if (leafMatches && leafMatches.length === 1) return leafMatches[0];
    if (leafMatches && leafMatches.length > 1) return leafMatches[0]; /* arbitrary tie-break */

    /* Substring fallback. */
    for (const [fn, cat] of categoryByFullNameLC) {
      if (fn.includes(qLower)) return cat;
    }
    return null;
  }

  /* Try to map a ShopScout product to a Shopify category. The product's own
     `category` field (often a breadcrumb captured by the extractor) is the
     strongest signal — fall back to title-keyword search if absent. */
  function matchProductToCategory(product) {
    if (!product) return null;
    const cat = product.category && findCategory(product.category);
    if (cat) return cat;
    /* Fallback: scan the title for leaf-name hits. Cheap, not exhaustive. */
    const title = String(product.title || '').toLowerCase();
    if (!title || !categoryByLeafLC) return null;
    for (const [leafLC, recs] of categoryByLeafLC) {
      if (leafLC.length < 5) continue; /* ignore very short generic leaves */
      if (title.includes(leafLC)) return recs[0];
    }
    return null;
  }

  /* Return the Shopify-declared attribute names for a category. Walks up the
     ancestor chain too (attributes inherit from parents). */
  function knownAttributesFor(categoryOrName) {
    if (!categoryAttrIds || !parentByGid) return [];
    let cat = null;
    if (typeof categoryOrName === 'string') cat = findCategory(categoryOrName);
    else if (categoryOrName && categoryOrName.gid) cat = categoryOrName;
    if (!cat) return [];
    const out = new Set();
    let cursor = cat.gid;
    const guard = new Set();
    while (cursor && !guard.has(cursor)) {
      guard.add(cursor);
      const attrs = categoryAttrIds.get(cursor);
      if (attrs) for (const a of attrs) out.add(a);
      cursor = parentByGid.get(cursor);
    }
    return [...out];
  }

  function getAttributesNames() { return attributesAllNames ? attributesAllNames.slice() : []; }
  function getCategoryBreadcrumbs() {
    return categoriesAll ? categoriesAll.map(c => c.full_name) : [];
  }
  function getGoogleBreadcrumbs() {
    return googleBreadcrumbs ? googleBreadcrumbs.map(item => item.breadcrumb) : [];
  }

  async function ready() { await loadAll(); }
  function isReady() { return !!(taxonomyVersion); }

  root.SSCanonical = {
    ready,
    isReady,
    canonicalKey,
    canonicalValue,
    findCategory,
    matchProductToCategory,
    knownAttributesFor,
    getAttributesNames,
    getCategoryBreadcrumbs,
    getGoogleBreadcrumbs,
    _abbreviations: ABBREVIATIONS,
    _getVersion() { return taxonomyVersion; }
  };
})(globalThis);
