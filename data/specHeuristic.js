/* =============================================================
   ShopScout — Spec-column heuristic
   Picks the default-visible spec columns for a list of products by
   measuring which canonical spec keys are most prevalent. This is the
   data-driven step that makes "TVs in a list -> Screen size / Refresh
   rate / Resolution show by default" actually work.

   Public API on window.SSSpecHeuristic:
     pickDefaultSpecColumns(products, options)
         options = { topN: 5, minCoverage: 0.5 }
         returns string[] of canonical spec keys to show by default.
     allSpecKeys(products)
         returns every distinct canonical spec key across the list.
         Used to populate the Columns dropdown.
     getSpecValueFor(product, canonicalKey)
         returns the raw value for a given product + canonical key,
         used when flattening products into grid-ready row shapes
         (see shared/projections/specProjection.js).
   ============================================================= */
(function initSpecHeuristic(root) {
  /* Mirror of the synonym table used by content/keyCanonicalizer.js at
     extraction time. Duplicated here (not imported) so old captures
     stored with raw Amazon labels ("Brand Name", "Global Trade
     Identification Number", "Maximum Torque", etc.) collapse to the
     same canonical key as fresh captures. Keys are lower-case. */
  const SPEC_KEY_SYNONYMS = {
    /* Identity that shouldn't even be a spec column — see EXCLUDE_FROM_COLUMNS */
    'brand':            'Brand',
    'brand name':       'Brand',
    'manufacturer':     'Manufacturer',
    /* Identifiers */
    'asin':             'ASIN',
    'sku':              'SKU',
    'item sku':         'SKU',
    'upc':              'UPC',
    'ean':              'EAN',
    'gtin':             'GTIN',
    'global trade identification number': 'GTIN',
    'mpn':              'MPN',
    'manufacturer part number': 'MPN',
    'part number':      'MPN',
    'part #':           'MPN',
    /* Model + age */
    'model':            'Model number',
    'model #':          'Model number',
    'model no':         'Model number',
    'model no.':        'Model number',
    'model number':     'Model number',
    'item model number':'Model number',
    'product model number': 'Model number',
    'model name':       'Model name',
    'date first available': 'Date first available',
    'release date':     'Release date',
    'manufacturer recommended age': 'Recommended age',
    /* Listings / category */
    'category':         'Category',
    'department':       'Department',
    'best sellers rank':'Best Sellers Rank',
    'best seller rank': 'Best Sellers Rank',
    'amazon best sellers rank': 'Best Sellers Rank',
    /* Dimensions / weight */
    'item weight':      'Weight',
    'product weight':   'Weight',
    'net weight':       'Weight',
    'shipping weight':  'Weight (shipping)',
    'package weight':   'Weight (package)',
    'item dimensions':  'Dimensions',
    'item dimensions l x w x h': 'Dimensions',
    'product dimensions':'Dimensions',
    'package dimensions':'Dimensions (package)',
    'product size':     'Dimensions',
    'item size':        'Dimensions',
    'size':             'Size',
    /* Power */
    'voltage':          'Voltage',
    'power source':     'Power source',
    'power rating':     'Power rating',
    'wattage':          'Wattage',
    'amperage':         'Amperage',
    'current':          'Current',
    'battery capacity': 'Battery capacity',
    'battery average life': 'Battery life',
    'number of batteries': 'Batteries',
    /* Rotational tools */
    'max torque':       'Max torque',
    'maximum torque':   'Max torque',
    'torque':           'Max torque',
    'maximum rotational speed': 'Max speed',
    'maximum speed':    'Max speed',
    'max speed':        'Max speed',
    'minimum speed':    'Min speed',
    'speed':            'Speed',
    'no load speed':    'Speed (no load)',
    'number of speeds': 'Speed steps',
    'chuck size':       'Chuck size',
    'maximum chuck size': 'Chuck size',
    'bit type':         'Bit type',
    'drilling capacity wood': 'Drilling capacity (wood)',
    'drilling capacity metal':'Drilling capacity (metal)',
    /* Other */
    'color':            'Color',
    'colour':           'Color',
    'material':         'Material',
    'material type':    'Material',
    'style name':       'Style',
    'set name':         'Set name',
    'included':         'Included items',
    'included components':'Included items',
    'included items':   'Included items',
    'in the box':       'Included items',
    'features':         'Features',
    'special feature':  'Special features',
    'special features': 'Special features',
    'additional features':'Special features',
    'other special features of the product':'Special features',
    'recommended uses for product':'Recommended use',
    'unit count':       'Unit count',
    'number of items':  'Item count',
    'item type name':   'Item type',
    'head size':        'Head size',
    'head style':       'Head style',
    'manufacturer warranty description':'Warranty',
    'warranty':         'Warranty',
    'country of origin':'Country of origin',
    'made in':          'Country of origin'
  };

  /* Keys to suppress entirely — every one of these has a dedicated
     top-level column (Brand, Manufacturer, ASIN, …) so showing a second
     spec-column copy would just clutter the dropdown. */
  const EXCLUDE_FROM_COLUMNS = new Set([
    'Brand', 'Manufacturer',
    'ASIN', 'SKU', 'UPC', 'EAN', 'GTIN', 'MPN',
    'Model number', 'Model name',
    'Category'
  ]);

  function canonicalKeyOf(rawKey) {
    if (rawKey == null) return '';
    /* Split camelCase first ("maximumRotationalSpeed" → "maximum Rotational Speed"). */
    const decamel = String(rawKey).replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    const trimmed = decamel.replace(/[\s:]+$/, '').replace(/\s+/g, ' ').trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    /* (1) Spec-key synonym map — handles "Brand Name", "Global Trade
            Identification Number", etc. */
    if (SPEC_KEY_SYNONYMS[lower]) return SPEC_KEY_SYNONYMS[lower];
    /* (2) SSCanonical for unit abbreviations (DPI / RPM / V / W). */
    if (root.SSCanonical && root.SSCanonical.canonicalKey) {
      const c = root.SSCanonical.canonicalKey(trimmed);
      if (c && c !== trimmed) return c;
    }
    /* (3) Identity fallback — preserve original case (so acronyms like
            "HDMI ports", "FPS", "USB ports" stay intact). Case-insensitive
            dedup happens at allSpecKeys / count time. */
    return trimmed;
  }

  /* Return the spec list for a product as a normalized [{key,value}] array,
     accepting every shape ShopScout uses:
       - p.rawSpecs[]            (legacy primary array + new pipeline)
       - p.specs[]               (legacy legacy array)
       - p.specs{}               (new pipeline dict form)
       - p._spec.specs{}         (the raw ProductSpec)
       - p._spec.itemDetails{}   (the raw ProductSpec)
     Always returns an array. */
  function specListOf(product) {
    if (!product) return [];
    if (Array.isArray(product.rawSpecs) && product.rawSpecs.length) return product.rawSpecs;
    if (Array.isArray(product.specs)) return product.specs;
    const out = [];
    if (product.specs && typeof product.specs === 'object') {
      for (const [k, v] of Object.entries(product.specs)) out.push({ key: k, value: v });
    }
    if (product._spec && product._spec.specs) {
      for (const [k, entry] of Object.entries(product._spec.specs)) {
        out.push({ key: entry.rawKey || k, value: entry.canonicalValue || entry.rawValue });
      }
    }
    if (product._spec && product._spec.itemDetails) {
      for (const [k, entry] of Object.entries(product._spec.itemDetails)) {
        out.push({ key: entry.rawKey || k, value: entry.canonicalValue || entry.rawValue });
      }
    }
    return out;
  }

  /* Pull Shopify's "this category has these attributes" signal for each
     product, union it into a single set. Returns the canonical key forms of
     every attribute Shopify declares for any category present in the list. */
  function shopifyDeclaredAttributes(products) {
    const out = new Set();
    const canon = root.SSCanonical;
    if (!canon || !canon.knownAttributesFor || !canon.matchProductToCategory) return out;
    const seenCategories = new Set();
    for (const p of products) {
      if (!p) continue;
      const cat = canon.matchProductToCategory(p);
      if (!cat || seenCategories.has(cat.gid)) continue;
      seenCategories.add(cat.gid);
      const known = canon.knownAttributesFor(cat);
      for (const name of known) {
        const ck = canonicalKeyOf(name);
        if (ck) out.add(ck);
      }
    }
    return out;
  }

  function pickDefaultSpecColumns(products, options) {
    const opts = options || {};
    /* topN caps the result. Pass Infinity to let coverage + Shopify-recommendation
       decide alone — caller usually picks the cap based on viewport space. */
    const topN = (opts.topN != null) ? opts.topN : Infinity;
    const minCoverage = (opts.minCoverage != null) ? opts.minCoverage : 0.5;
    /* Weight Shopify-declared attributes get on top of their data-frequency score.
       Boosts them so a category-recommended attribute can outrank a more-common
       but less-relevant one. */
    const shopifyBoost = (opts.shopifyBoost != null) ? opts.shopifyBoost : products && products.length ? Math.max(1, Math.floor(products.length * 0.4)) : 0;

    if (!Array.isArray(products) || !products.length) return [];

    /* Step 1 — count how often each canonical spec key appears across the list.
       Counting is case-insensitive to match allSpecKeys' dedup behavior. */
    const counts = new Map();
    const displayKey = new Map();   // lower -> canonical (first-seen casing)
    for (const p of products) {
      const list = specListOf(p);
      if (!list.length) continue;
      const seenInRow = new Set();
      for (const spec of list) {
        if (!spec || spec.key == null) continue;
        const canonical = canonicalKeyOf(spec.key);
        if (!canonical) continue;
        if (EXCLUDE_FROM_COLUMNS.has(canonical)) continue;
        const lk = canonical.toLowerCase();
        if (seenInRow.has(lk)) continue;
        seenInRow.add(lk);
        if (!displayKey.has(lk)) displayKey.set(lk, canonical);
        counts.set(lk, (counts.get(lk) || 0) + 1);
      }
    }

    /* Step 2 — figure out which keys Shopify says are relevant for any category
       present in the list. These get a score boost. */
    const declared = shopifyDeclaredAttributes(products);

    const threshold = Math.max(1, Math.ceil(products.length * minCoverage));
    /* Keys that are never default-visible as spec columns. They either
       belong in a dedicated top-level field, or are too noisy/long to be
       useful at a glance. User can still surface them through the
       Columns dropdown. */
    const ranked = [];
    const declaredLower = new Set([...declared].map(k => String(k).toLowerCase()));
    const neverLower = new Set([...NEVER_DEFAULT_VISIBLE].map(k => k.toLowerCase()));
    for (const [lk, count] of counts) {
      if (count < threshold) continue;
      if (neverLower.has(lk)) continue;
      const key = displayKey.get(lk) || lk;
      const score = count + (declaredLower.has(lk) ? shopifyBoost : 0);
      ranked.push({ key, count, score, declared: declaredLower.has(lk) });
    }
    /* Sort by score desc, then count desc, then alphabetical for stability. */
    ranked.sort((a, b) => b.score - a.score || b.count - a.count || a.key.localeCompare(b.key));
    return ranked.slice(0, topN).map(r => r.key);
  }

  /* These keys may exist as columns (reachable via the Columns dropdown)
     but are never picked as default-visible by the heuristic. Match
     against canonical (Brand-style) keys, not lowercased. */
  const NEVER_DEFAULT_VISIBLE = new Set([
    'Best Sellers Rank',
    'Department',
    'Date first available',
    'Release date',
    'Country of origin',
    'Recommended age',
    'Description',
    'About this item'
  ]);

  /* Viewport-aware cap: returns how many extra spec columns fit alongside the
     fixed system + always-visible data columns at the current container width.
     Inputs default to ShopScout's column model — override per caller. */
  function maxSpecColumnsForWidth(containerWidth, options) {
    const o = options || {};
    /* System columns: rowSelect 36 + thumb 72 + rowActions 44 */
    const systemWidth     = o.systemWidth     != null ? o.systemWidth     : (36 + 72 + 44);
    /* Title (min) + always-visible data: brand 160 + source 120 + price 90
       + rating 130 + category 240 */
    const baseDataWidth   = o.baseDataWidth   != null ? o.baseDataWidth   : (240 + 160 + 120 + 90 + 130 + 240);
    const specColumnWidth = o.specColumnWidth != null ? o.specColumnWidth : 140;
    /* Reserve a small gutter for the scrollbar + cell padding. */
    const safety          = o.safety          != null ? o.safety          : 20;
    const available = (Number(containerWidth) || 0) - systemWidth - baseDataWidth - safety;
    if (available <= 0) return 0;
    return Math.max(0, Math.floor(available / specColumnWidth));
  }

  function allSpecKeys(products) {
    if (!Array.isArray(products)) return [];
    /* Case-insensitive dedup so "Battery Capacity" and "Battery capacity"
       collapse to a single column. The first-seen casing wins as the
       display title. */
    const byLower = new Map();
    for (const p of products) {
      for (const spec of specListOf(p)) {
        if (!spec || spec.key == null) continue;
        const canonical = canonicalKeyOf(spec.key);
        if (!canonical) continue;
        /* Don't surface a spec column for keys that already have a
           dedicated top-level column (Brand, Manufacturer, ASIN, UPC,
           etc.). Those values are still present in the dedicated column;
           the spec dropdown shouldn't list them again. */
        if (EXCLUDE_FROM_COLUMNS.has(canonical)) continue;
        const lk = canonical.toLowerCase();
        if (!byLower.has(lk)) byLower.set(lk, canonical);
      }
    }
    return [...byLower.values()].sort();
  }

  function getSpecValueFor(product, canonical) {
    for (const spec of specListOf(product)) {
      if (!spec || spec.key == null) continue;
      if (canonicalKeyOf(spec.key) === canonical) return spec.value == null ? '' : String(spec.value);
    }
    return '';
  }

  root.SSSpecHeuristic = {
    pickDefaultSpecColumns,
    maxSpecColumnsForWidth,
    allSpecKeys,
    getSpecValueFor,
    specListOf
  };
})(globalThis);
