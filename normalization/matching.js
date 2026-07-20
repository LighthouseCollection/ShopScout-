/* =============================================================
   ShopScout — duplicate candidate detection

   Deterministic matcher for likely duplicate products. This module only
   reports candidates. It never merges, deletes, or mutates product data.

   Public API on window.ShopScoutMatching:
     extractIdentifiers(product)
     loadVerticalPackSignals(pack)
     scorePair(a, b)
     detectDuplicateCandidates(products, options)
   ============================================================= */
(function initShopScoutMatching(root) {
  const NS = (root.ShopScoutMatching = root.ShopScoutMatching || {});

  const STOP_WORDS = new Set([
    'a', 'an', 'and', 'or', 'the', 'with', 'for', 'to', 'of', 'by', 'in', 'on',
    'new', 'latest', 'generic', 'product', 'item', 'pack', 'pcs', 'piece'
  ]);
  let esciSubstitutePairs = new Set();
  let esciPairKeysById = new Map();
  let esciLoadPromise = null;

  function compact(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function normalizeText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function productId(product, idx) {
    return String(product && (product.id || product.url || product.title) || `product-${idx + 1}`);
  }

  function productIdentityValues(product) {
    const values = [
      product && product.id,
      product && product.asin
    ];
    return values.concat(extractIdentifiers(product || {}))
      .map(compact)
      .filter(Boolean);
  }

  function pairKey(left, right) {
    const sorted = [compact(left), compact(right)].filter(Boolean).sort();
    return sorted.length === 2 ? sorted.join('|') : '';
  }

  function productsHaveEsciSubstitutePair(a, b) {
    if (!esciSubstitutePairs.size) return false;
    const leftValues = productIdentityValues(a);
    const rightValues = productIdentityValues(b);
    for (const left of leftValues) {
      for (const right of rightValues) {
        const key = pairKey(left, right);
        if (key && esciSubstitutePairs.has(key)) return true;
      }
    }
    return false;
  }

  function buildSubstituteIndexes(payload) {
    const pairs = Array.isArray(payload?.substitutePairs)
      ? payload.substitutePairs
      : Array.isArray(payload)
        ? payload
        : [];
    const next = new Set();
    const nextById = new Map();
    for (const pair of pairs) {
      const key = pairKey(pair?.a, pair?.b);
      if (!key) continue;
      next.add(key);
      const [left, right] = key.split('|');
      if (!nextById.has(left)) nextById.set(left, new Set());
      if (!nextById.has(right)) nextById.set(right, new Set());
      nextById.get(left).add(key);
      nextById.get(right).add(key);
    }
    return { pairs: next, byId: nextById };
  }

  function mergeSubstituteIndexes(indexes) {
    for (const key of indexes.pairs) esciSubstitutePairs.add(key);
    for (const [id, pairKeys] of indexes.byId.entries()) {
      if (!esciPairKeysById.has(id)) esciPairKeysById.set(id, new Set());
      for (const key of pairKeys) esciPairKeysById.get(id).add(key);
    }
    return esciSubstitutePairs.size;
  }

  function loadEsciSubstitutes(payload) {
    const indexes = buildSubstituteIndexes(payload);
    const next = indexes.pairs;
    const nextById = indexes.byId;
    esciSubstitutePairs = next;
    esciPairKeysById = nextById;
    return esciSubstitutePairs.size;
  }

  function esciBlockingKeys(product) {
    if (!esciPairKeysById.size) return [];
    const out = new Set();
    for (const value of productIdentityValues(product)) {
      const pairKeys = esciPairKeysById.get(value);
      if (!pairKeys) continue;
      for (const key of pairKeys) out.add('esci:' + key);
    }
    return Array.from(out);
  }

  async function ensureEsciSubstitutesLoaded() {
    if (esciSubstitutePairs.size) return esciSubstitutePairs.size;
    if (esciLoadPromise) return esciLoadPromise;
    if (typeof root.fetch !== 'function') return 0;
    esciLoadPromise = root.fetch('normalization/libraries/generated/esciSubstitutes.json')
      .then(response => {
        if (!response || !response.ok || typeof response.json !== 'function') return 0;
        return response.json();
      })
      .then(data => loadEsciSubstitutes(data))
      .catch(() => 0);
    return esciLoadPromise;
  }

  function loadVerticalPackSignals(pack) {
    if (pack?.esciSubstitutes) return mergeSubstituteIndexes(buildSubstituteIndexes(pack.esciSubstitutes));
    return 0;
  }

  function titleOf(product) {
    return String(product && (product.title || product.productName || product.listingTitle) || '').trim();
  }

  function brandOf(product) {
    const raw = product && (product.brand || product.manufacturer || product.maker);
    const aliases = root.ShopScoutIdentityAliases;
    const canonical = aliases && typeof aliases.canonicalBrand === 'function'
      ? aliases.canonicalBrand(raw)
      : raw;
    return normalizeText(canonical);
  }

  function candidateIdentifierValues(product) {
    const direct = [
      product && product.asin,
      product && product.upc,
      product && product.gtin,
      product && product.ean,
      product && product.mpn,
      product && product.sku,
      product && product.modelNumber,
      product && product.modelName
    ];
    const specAccess = root.ShopScoutProductSpecAccess;
    const specs = specAccess && typeof specAccess.specEntries === 'function'
      ? specAccess.specEntries(product || {})
      : Array.isArray(product && product.specs) ? product.specs
        : Array.isArray(product && product.rawSpecs) ? product.rawSpecs
          : [];
    for (const spec of specs) {
      const key = normalizeText(spec && (spec.rawField || spec.key || spec.field));
      if (/(asin|upc|gtin|ean|mpn|model|part number|sku)/.test(key)) {
        direct.push(spec && (spec.raw || spec.value || spec.display));
      }
    }
    return direct;
  }

  function extractIdentifiers(product) {
    const out = [];
    const seen = new Set();
    for (const value of candidateIdentifierValues(product || {})) {
      const id = compact(value);
      if (!id || id.length < 4 || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }

  function tokenSet(product) {
    const raw = [
      titleOf(product),
      product && product.brand,
      product && product.manufacturer,
      product && product.modelNumber,
      product && product.modelName
    ].join(' ');
    const tokens = normalizeText(raw).split(' ').filter(token => {
      if (!token || STOP_WORDS.has(token)) return false;
      if (token.length < 2 && !/\d/.test(token)) return false;
      return true;
    });
    return new Set(tokens);
  }

  function jaccard(a, b) {
    if (!a.size && !b.size) return 0;
    let intersection = 0;
    for (const value of a) if (b.has(value)) intersection++;
    const union = new Set([...a, ...b]).size;
    return union ? intersection / union : 0;
  }

  function normalizedBrandMatch(a, b) {
    const left = brandOf(a);
    const right = brandOf(b);
    if (!left || !right) return false;
    if (left === right) return true;
    if (compact(left) === compact(right)) return true;
    return left.includes(right) || right.includes(left);
  }

  function modelMatch(a, b) {
    const left = extractIdentifiers(a);
    const right = new Set(extractIdentifiers(b));
    return left.some(value => right.has(value));
  }

  function blockingKeys(product) {
    const keys = [];
    for (const id of extractIdentifiers(product)) {
      if (id) keys.push('id:' + id);
    }
    const brand = compact(brandOf(product));
    const tokens = Array.from(tokenSet(product)).filter(token => token.length >= 3).slice(0, 3);
    if (brand && tokens.length) keys.push('bt:' + brand + ':' + tokens[0]);
    if (brand) keys.push('brand:' + brand);
    keys.push(...esciBlockingKeys(product));
    if (!keys.length && tokens.length) keys.push('tok:' + tokens[0]);
    return Array.from(new Set(keys));
  }

  function blockingKey(product) {
    return blockingKeys(product)[0] || '';
  }

  function scorePair(a, b) {
    const aIds = extractIdentifiers(a);
    const bIds = extractIdentifiers(b);
    const bIdSet = new Set(bIds);
    const sharedIds = aIds.filter(id => bIdSet.has(id));
    const tokenSimilarity = jaccard(tokenSet(a), tokenSet(b));
    const brandMatch = normalizedBrandMatch(a, b);
    const hasModelMatch = sharedIds.length > 0 || modelMatch(a, b);

    let score = 0;
    const evidence = [];
    let reason = 'low-similarity';

    if (sharedIds.length) {
      score += 0.62;
      evidence.push('shared identifier: ' + sharedIds[0]);
    }
    if (brandMatch) {
      score += 0.18;
      evidence.push('brand/manufacturer match');
    }
    if (tokenSimilarity >= 0.35) {
      score += Math.min(0.28, tokenSimilarity * 0.4);
      evidence.push('title token similarity');
    }
    if (productsHaveEsciSubstitutePair(a, b)) {
      score += 0.10;
      evidence.push('ESCI substitute co-occurrence');
    }

    if (sharedIds.length && tokenSimilarity >= 0.25) reason = 'shared-identifier-and-token-match';
    else if (hasModelMatch && brandMatch) reason = 'brand-model-title-match';
    else if (brandMatch && tokenSimilarity >= 0.5) {
      score += 0.14;
      reason = 'brand-model-title-match';
      evidence.push('brand and title similarity');
    }

    return {
      score: Math.round(Math.min(score, 0.99) * 100) / 100,
      reason,
      evidence,
      sharedIdentifiers: sharedIds,
      tokenSimilarity: Math.round(tokenSimilarity * 100) / 100
    };
  }

  function detectDuplicateCandidates(products, options) {
    const input = Array.isArray(products) ? products : [];
    const threshold = Number(options && options.threshold) || 0.72;
    const bucketLimit = Math.max(2, Number(options && options.bucketLimit) || 300);
    const buckets = new Map();
    input.forEach((product, index) => {
      const keys = blockingKeys(product);
      for (const key of keys) {
        if (!buckets.has(key)) buckets.set(key, []);
        const bucket = buckets.get(key);
        if (bucket.length < bucketLimit) bucket.push(index);
      }
    });
    const pairKeys = new Set();
    const out = [];
    for (const indexes of buckets.values()) {
      for (let left = 0; left < indexes.length; left++) {
        for (let right = left + 1; right < indexes.length; right++) {
          const i = indexes[left];
          const j = indexes[right];
          const pairKey = i < j ? `${i}:${j}` : `${j}:${i}`;
          if (pairKeys.has(pairKey)) continue;
          pairKeys.add(pairKey);
        const result = scorePair(input[i], input[j]);
        if (result.score < threshold) continue;
        const productIds = [productId(input[i], i), productId(input[j], j)];
        out.push({
          candidateKey: productIds.slice().sort().join('::'),
          productIds,
          titles: [titleOf(input[i]), titleOf(input[j])],
          score: result.score,
          reason: result.reason,
          evidence: result.evidence,
          sharedIdentifiers: result.sharedIdentifiers
        });
      }
    }
    }
    out.sort((a, b) => b.score - a.score || a.productIds.join('|').localeCompare(b.productIds.join('|')));
    return out;
  }

  Object.assign(NS, {
    extractIdentifiers,
    blockingKey,
    blockingKeys,
    ensureEsciSubstitutesLoaded,
    loadEsciSubstitutes,
    loadVerticalPackSignals,
    scorePair,
    detectDuplicateCandidates
  });
})(globalThis);
