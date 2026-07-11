/* =============================================================
   ShopScout — Universal ProductSpec schema + Observation contract
   Every stage in the extraction pipeline (structured signals,
   marketplace adapter, generic adapter, spec miner) emits a list
   of Observations. The normalizer assembles them into one
   ProductSpec — the single shape that the rest of the extension
   consumes (capture flow, comparison view, AI prompts, exports).
   ============================================================= */
/**
 * @typedef {'high'|'medium'|'low'|'none'} Confidence
 *
 * @typedef {object} Observation
 *   Emitted by each extraction stage (structured-signals, marketplace
 *   adapter, generic adapter, spec miner). Confidence-arbitrated into
 *   the ProductSpec by applyObservation().
 * @property {'identity'|'price'|'rating'|'spec'|'item_detail'|'feature'|'description'|'image'|'seller'|'availability'|'category'|'identifier'|'measurement'|'style'} type
 * @property {string|null} key       sub-key (e.g. 'brand', 'newPrice', 'asin')
 * @property {*}           value     the observed value
 * @property {string}      source    'json-ld' | 'microdata' | 'opengraph' | 'adapter:amazon-po' | 'miner:text' | …
 * @property {Confidence}  confidence
 * @property {string|null} [selector]
 * @property {string|null} [rawText]
 * @property {string|null} [nodePath]
 *
 * @typedef {object} Slot
 *   A confidence-tagged field slot. All identity / pricing / rating /
 *   seller / availability / styles fields are Slots so a higher-
 *   confidence observation can overwrite a lower-confidence one.
 * @property {string}      value
 * @property {string|null} source
 * @property {Confidence}  confidence
 *
 * @typedef {object} NormalizedValue
 *   Normalization v2 sidecar value.
 * @property {*} raw
 * @property {*} canonical
 * @property {string} [unit]
 * @property {string} [display]
 * @property {object} [provenance]
 *
 * @typedef {object} SpecEntry
 *   The canonical-key → value entry in spec.specs / spec.itemDetails.
 * @property {string}      rawKey
 * @property {string}      rawValue
 * @property {string}      canonicalValue
 * @property {NormalizedValue|null} [normalized]
 * @property {string|null} source
 * @property {Confidence}  confidence
 *
 * @typedef {object} ProductSpec
 *   The universal product record assembled from observations.
 * @property {{marketplace:string|null,hostname:string,url:string,capturedAt:number,adapter:string|null,adapterConfidence:Confidence|null,schemaVersion:number,pipeline?:object}} source
 * @property {Slot} title
 * @property {Slot} brand
 * @property {Slot} manufacturer
 * @property {Slot} modelName
 * @property {Slot} modelNumber
 * @property {Array<{kind:string,value:string,source:string|null,confidence:Confidence}>} identifiers
 * @property {{raw:string,shopifyGid:string|null,shopifyBreadcrumb:string|null,knownAttributes:string[]}} category
 * @property {{newPrice:Slot,usedPrice:Slot,shipping:Slot,currency:Slot}} pricing
 * @property {{value:Slot,count:Slot}} rating
 * @property {{name:Slot,link:Slot}} seller
 * @property {Slot} availability
 * @property {string[]} features
 * @property {Object<string,SpecEntry>} specs
 * @property {Object<string,SpecEntry>} itemDetails
 * @property {object} measurements
 * @property {{color:Slot,material:Slot,pattern:Slot,finish:Slot}} styles
 * @property {{raw:string,parsedSpecs:object[],source:string|null,confidence:Confidence}} description
 * @property {{productImages:Array<{url:string,role:string,source:string|null,confidence:Confidence}>,userImages:Array<{url:string,source:string,confidence:Confidence}>}} media
 * @property {{jsonLd:object|null,microdata:object|null,openGraph:object|null,observations:Observation[]}} raw
 *
 * @typedef {object} FlatProduct
 *   The legacy compact record consumed by popup, comparison view, AI
 *   prompts, and exports. Produced by toLegacyFlatProduct(spec).
 * @property {string} url
 * @property {string} title
 * @property {string} brand
 * @property {string} manufacturer
 * @property {string} modelName
 * @property {string} modelNumber
 * @property {string} newPrice
 * @property {string} usedPrice
 * @property {string} shippingPrice
 * @property {string} currency
 * @property {string} rating
 * @property {string} reviewCount
 * @property {string} sellerName
 * @property {string} availability
 * @property {string} description
 * @property {string} listingTitle
 * @property {string[]} bullets
 * @property {string} category
 * @property {string} source
 * @property {string} image
 * @property {string[]} imageUrls
 * @property {string[]} reviewImages
 * @property {Object<string,string>} specs
 * @property {Object<string,NormalizedValue>} specsNormalized
 * @property {Array<{key:string,value:string,source?:string|null}>} rawSpecs
 * @property {string} asin
 * @property {string} sku
 * @property {string} upc
 * @property {string} ean
 * @property {string} gtin
 * @property {string} mpn
 * @property {ProductSpec} [_spec]
 * @property {object} [_pipelineTrace]
 *
 * @typedef {object} SSExtractNamespace
 * @property {Record<string, Confidence>} Confidence
 * @property {(confidence: Confidence) => number} confidenceWeight
 * @property {(left: Confidence, right: Confidence) => boolean} confidenceGt
 * @property {(source?: string) => Confidence} defaultConfidenceFor
 * @property {{normalizeKey: (key: *) => string, normalizeValue: (value: *) => string}} [keyCanonicalizer]
 * @property {(o: Partial<Observation>) => Observation|null} [observation]
 * @property {() => ProductSpec} [emptyProductSpec]
 * @property {(observations: Observation[], options?: object) => ProductSpec} [assemble]
 * @property {(spec: ProductSpec|null) => FlatProduct|null} [toLegacyFlatProduct]
 */
(function initProductSchema(root) {
  const NS = /** @type {SSExtractNamespace} */ (root.SSExtract = root.SSExtract || {});
  const C  = NS.Confidence;
  const gt   = NS.confidenceGt;

  /* ---- Observation contract ----
     Every observation must be:
       {
         type:       'identity' | 'price' | 'rating' | 'spec' | 'feature'
                   | 'description' | 'image' | 'seller' | 'availability'
                   | 'category' | 'identifier' | 'measurement' | 'style',
         key:        string | null,    // sub-key e.g. 'brand', 'newPrice',
                                       // 'Refresh rate', 'asin', etc.
         value:      any,
         source:     string,           // 'json-ld' | 'microdata' | 'opengraph'
                                       // | 'adapter:amazon-po'
                                       // | 'adapter:amazon-legacy'
                                       // | 'adapter:generic-table'
                                       // | 'miner:text' | 'inference'
         confidence: Confidence,       // (defaults from source if absent)
         selector:   string | null,    // CSS selector that hit (debugging)
         rawText:    string | null,    // the raw page text (debugging)
         nodePath:   string | null     // a few-level DOM trail (debugging)
       }
     Adapter authors call NS.observation({...}) which fills defaults.
  */
  /**
   * Factory for an Observation. Fills defaults from defaultConfidenceFor()
   * and rejects observations without a type.
   * @param {Partial<Observation>} o
   * @returns {Observation|null}
   */
  function observation(o) {
    if (!o || !o.type) return null;
    return {
      type:       o.type,
      key:        o.key  != null ? o.key  : null,
      value:      o.value,
      source:     o.source || 'unknown',
      confidence: o.confidence || NS.defaultConfidenceFor(o.source) || C.LOW,
      selector:   o.selector || null,
      rawText:    o.rawText  || null,
      nodePath:   o.nodePath || null
    };
  }

  /**
   * Initial ProductSpec shape — every field is a Slot or matching
   * sub-structure so applyObservation can write into them without
   * special-casing.
   * @returns {ProductSpec}
   */
  function emptyProductSpec() {
    return {
      source: {
        marketplace:      null,
        hostname:         (typeof location !== 'undefined') ? location.hostname : '',
        url:              (typeof location !== 'undefined') ? location.href     : '',
        capturedAt:       (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0,
        adapter:          null,
        adapterConfidence:null,
        schemaVersion:    1
      },
      title:        { value: '', source: null, confidence: C.NONE },
      brand:        { value: '', source: null, confidence: C.NONE },
      manufacturer: { value: '', source: null, confidence: C.NONE },
      modelName:    { value: '', source: null, confidence: C.NONE },
      modelNumber:  { value: '', source: null, confidence: C.NONE },
      identifiers:  [],   // [{ kind, value, source, confidence }]

      category: {
        raw:               '',
        shopifyGid:        null,
        shopifyBreadcrumb: null,
        knownAttributes:   []
      },

      pricing: {
        newPrice:      { value: '', source: null, confidence: C.NONE },
        usedPrice:     { value: '', source: null, confidence: C.NONE },
        shipping:      { value: '', source: null, confidence: C.NONE },
        currency:      { value: '', source: null, confidence: C.NONE }
      },
      /* rating.value / rating.count and seller.name / seller.link used
         to be plain strings on the rating/seller slot. That collided
         with the FIELD_MAP routing — mergeField saw the empty-string
         slot, treated it as falsy, and replaced it with a full
         {value,source,confidence} wrapper, leaving flat.rating as the
         wrapper object instead of the string. Now each nested string
         field is its own slot, matching the pricing.newPrice convention. */
      rating: {
        value: { value: '', source: null, confidence: C.NONE },
        count: { value: '', source: null, confidence: C.NONE }
      },
      seller: {
        name: { value: '', source: null, confidence: C.NONE },
        link: { value: '', source: null, confidence: C.NONE }
      },
      availability: { value: '', source: null, confidence: C.NONE },

      features:     [],   // strings
      specs:        {},   // { canonicalKey: { rawKey, rawValue, canonicalValue, source, confidence } }
      itemDetails:  {},   // { canonicalKey: { rawKey, rawValue, source, confidence } }
      measurements: {     // typed dimensions, all canonicalized via js-quantities
        length: null, width: null, height: null, weight: null, volume: null, raw: ''
      },
      styles: {
        color:   { value: '', source: null, confidence: C.NONE },
        material:{ value: '', source: null, confidence: C.NONE },
        pattern: { value: '', source: null, confidence: C.NONE },
        finish:  { value: '', source: null, confidence: C.NONE }
      },
      description:  { raw: '', parsedSpecs: [], source: null, confidence: C.NONE },
      media: {
        productImages: [], // [{ url, role, source, confidence }]
        userImages:    []  // [{ url, source: 'review-photo' }]
      },

      /* Raw signals — preserved so a smarter canonicalizer can re-mine later
         without re-scraping the page. */
      raw: {
        jsonLd: null, microdata: null, openGraph: null,
        observations: []
      }
    };
  }

  /* ---- Field-level merge: only overwrite if incoming confidence > existing ---- */
  function mergeField(dst, src, source, confidence) {
    if (!src) return dst;
    if (!dst || gt(confidence, dst.confidence)) {
      return { value: src, source, confidence };
    }
    return dst;
  }

  /* ---- Map of which (type, key) lands in which slot of ProductSpec ---- */
  const FIELD_MAP = {
    'identity:title':        'title',
    'identity:brand':        'brand',
    'identity:manufacturer': 'manufacturer',
    'identity:modelName':    'modelName',
    'identity:modelNumber':  'modelNumber',
    'price:newPrice':        'pricing.newPrice',
    'price:usedPrice':       'pricing.usedPrice',
    'price:shipping':        'pricing.shipping',
    'price:currency':        'pricing.currency',
    'rating:value':          'rating.value',
    'rating:count':          'rating.count',
    'seller:name':           'seller.name',
    'seller:link':           'seller.link',
    'availability':          'availability',
    'description':           'description.raw',
    'category':              'category.raw',
    'style:color':           'styles.color',
    'style:material':        'styles.material',
    'style:pattern':         'styles.pattern',
    'style:finish':          'styles.finish'
  };

  function setPath(obj, path, ref) {
    const parts = path.split('.');
    let cursor = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      cursor = cursor[parts[i]];
      if (!cursor) return;
    }
    const last = parts[parts.length - 1];
    cursor[last] = ref;
  }
  function getPath(obj, path) {
    const parts = path.split('.');
    let cursor = obj;
    for (const p of parts) {
      if (!cursor || cursor[p] == null) return null;
      cursor = cursor[p];
    }
    return cursor;
  }

  /* ---- Apply one observation to a ProductSpec ---- */
  function applyObservation(spec, obs) {
    if (!spec || !obs) return spec;
    spec.raw.observations.push(obs);

    const tag = obs.type + (obs.key ? ':' + obs.key : '');
    const fieldPath = FIELD_MAP[tag] || FIELD_MAP[obs.type];

    if (fieldPath) {
      const existing = getPath(spec, fieldPath);
      const next = mergeField(existing, obs.value, obs.source, obs.confidence);
      setPath(spec, fieldPath, next);
      return spec;
    }

    if (obs.type === 'identifier') {
      const kind = obs.key;
      if (!kind || obs.value == null || obs.value === '') return spec;
      const existing = spec.identifiers.find(i => i.kind === kind);
      if (!existing) spec.identifiers.push({ kind, value: String(obs.value), source: obs.source, confidence: obs.confidence });
      else if (gt(obs.confidence, existing.confidence)) { existing.value = String(obs.value); existing.source = obs.source; existing.confidence = obs.confidence; }
      return spec;
    }

    if (obs.type === 'feature') {
      const t = String(obs.value || '').trim();
      if (t && !spec.features.includes(t)) spec.features.push(t);
      return spec;
    }

    if (obs.type === 'spec' || obs.type === 'item_detail') {
      const rawKey = obs.key;
      const rawValue = obs.value;
      if (!rawKey || rawValue == null || rawValue === '') return spec;
      const canonKey = NS.keyCanonicalizer ? NS.keyCanonicalizer.normalizeKey(rawKey) : String(rawKey).trim();
      /* Redirect identifier-equivalent spec rows to their proper home so
         we don't end up with both `flat.asin = 'B01M...'` AND
         `flat.specs.ASIN = 'B01M...'` (the latter polluting the
         Specifications view and the grid's auto-generated columns).
         Same for Brand / Manufacturer — those are top-level identity
         fields, not specs. */
      const redirect = IDENTIFIER_REDIRECTS[canonKey.toLowerCase()];
      if (redirect) {
        if (redirect.kind === 'identifier') {
          const kind = redirect.field;
          const existing = spec.identifiers.find(i => i.kind === kind);
          if (!existing) {
            spec.identifiers.push({ kind, value: String(rawValue).trim(), source: obs.source, confidence: obs.confidence });
          } else if (gt(obs.confidence, existing.confidence)) {
            existing.value = String(rawValue).trim();
            existing.source = obs.source;
            existing.confidence = obs.confidence;
          }
        } else if (redirect.kind === 'identity') {
          const slot = spec[redirect.field];
          if (!slot || gt(obs.confidence, slot.confidence)) {
            spec[redirect.field] = { value: String(rawValue).trim(), source: obs.source, confidence: obs.confidence };
          }
        }
        return spec;
      }
      const canonVal = NS.keyCanonicalizer ? NS.keyCanonicalizer.normalizeValue(rawValue) : String(rawValue);
      const bucket = (obs.type === 'item_detail') ? spec.itemDetails : spec.specs;
      const existing = bucket[canonKey];
      if (!existing || gt(obs.confidence, existing.confidence)) {
        /* v2 normalization envelope (per normalization/SPEC.md).
           Attached as a sidecar so legacy readers can keep reading
           canonicalValue while the new UI reads .normalized.display
           and filters on .normalized.canonical. Null if the field
           isn't in the registry or the v2 script isn't loaded. */
        let normalized = null;
        if (root.ShopScoutNormalize && typeof root.ShopScoutNormalize.field === 'function') {
          try { normalized = root.ShopScoutNormalize.field(canonKey, rawValue); }
          catch (err) { /* leave normalized null; legacy path still works */ }
        }
        bucket[canonKey] = {
          rawKey: String(rawKey),
          rawValue: String(rawValue),
          canonicalValue: canonVal,
          normalized,
          source: obs.source,
          confidence: obs.confidence
        };
      }
      return spec;
    }

    if (obs.type === 'image') {
      const url = String(obs.value || '');
      if (!url) return spec;
      const collection = obs.key === 'user' ? spec.media.userImages : spec.media.productImages;
      if (!collection.find(m => m.url === url)) {
        collection.push({
          url,
          role: obs.key === 'user' ? 'review-photo' : (obs.key || 'product'),
          source: obs.source,
          confidence: obs.confidence
        });
      }
      return spec;
    }

    if (obs.type === 'measurement') {
      /* obs.key in {length,width,height,weight,volume}; obs.value already
         normalized by adapter (usually). */
      if (obs.key && obs.value != null && obs.value !== '') {
        spec.measurements[obs.key] = obs.value;
      }
      return spec;
    }

    return spec;
  }

  /**
   * Apply observations into a fresh ProductSpec in arrival order.
   * @param {Observation[]} observations
   * @param {{adapter?:string,adapterConfidence?:Confidence,marketplace?:string,rawSignals?:{jsonLd?:object,microdata?:object,openGraph?:object}}} [options]
   * @returns {ProductSpec}
   */
  function assemble(observations, options) {
    const spec = emptyProductSpec();
    const opts = options || {};
    if (opts.adapter)           spec.source.adapter           = opts.adapter;
    if (opts.adapterConfidence) spec.source.adapterConfidence = opts.adapterConfidence;
    if (opts.marketplace)       spec.source.marketplace       = opts.marketplace;
    if (opts.rawSignals) {
      spec.raw.jsonLd    = opts.rawSignals.jsonLd    || null;
      spec.raw.microdata = opts.rawSignals.microdata || null;
      spec.raw.openGraph = opts.rawSignals.openGraph || null;
    }
    for (const obs of (observations || [])) {
      try { applyObservation(spec, obs); }
      catch (err) { console.warn('Observation apply failed', obs, err); }
    }
    return spec;
  }

  /* ---- Backward-compat: produce the legacy flat product object
          from a ProductSpec. Old consumers (popup, comparison.js,
          AI prompt builders, exports) keep working until they're
          migrated. ---- */
  /* Unwrap a slot value that *might* be wrapped in the
     {value, source, confidence} shape (the FIELD_MAP routing
     accidentally wraps nested slots like spec.rating.value and
     spec.seller.name). Returns just the underlying string so the
     legacy flat product stores clean primitives. Safe for plain
     strings (returns them unchanged) and for the literal stored
     "[object Object]" string from corrupt legacy captures. */
  function unwrap(v) {
    if (v == null) return '';
    if (typeof v === 'object') return v.value || v.canonicalValue || v.rawValue || '';
    const s = String(v);
    if (s === '[object Object]') return '';
    return s;
  }

  /**
   * Project a ProductSpec down to the legacy flat shape consumed by
   * popup, comparison view, AI prompts, and exports. Defensive against
   * the wrapper-object bug — see unwrap().
   * @param {ProductSpec|null} spec
   * @returns {FlatProduct|null}
   */
  function toLegacyFlatProduct(spec) {
    if (!spec) return null;
    /** @type {FlatProduct} */
    const flat = {
      url:          spec.source.url || '',
      title:        unwrap(spec.title.value),
      listingTitle: unwrap(spec.title.value),
      brand:        unwrap(spec.brand.value),
      manufacturer: unwrap(spec.manufacturer.value),
      modelName:    unwrap(spec.modelName.value),
      modelNumber:  unwrap(spec.modelNumber.value),
      newPrice:     unwrap(spec.pricing.newPrice.value),
      usedPrice:    unwrap(spec.pricing.usedPrice.value),
      shippingPrice:unwrap(spec.pricing.shipping.value),
      currency:     unwrap(spec.pricing.currency.value),
      /* After the wrapper-bug fix in emptyProductSpec, these slots are
         now {value,source,confidence} wrappers themselves; unwrap pulls
         the inner string. Older spec dictionaries that were captured
         before the fix may still have plain strings here — unwrap is
         a no-op on those, so the same call covers both shapes. */
      rating:       unwrap(spec.rating.value),
      reviewCount:  unwrap(spec.rating.count),
      sellerName:   unwrap(spec.seller.name),
      availability: unwrap(spec.availability.value),
      description:  spec.description.raw,
      bullets:      spec.features.slice(),
      category:     spec.category.raw,
      source:       spec.source.marketplace || '',
      image:        (spec.media.productImages[0] && spec.media.productImages[0].url) || '',
      imageUrls:    spec.media.productImages.map(m => m.url),
      reviewImages: spec.media.userImages.map(m => m.url),
      specs:            {},
      /* v2 sidecar: same keys as .specs, values are the full
         normalization envelope {raw, canonical, unit?, display,
         provenance}. Phase 3 readers switch to this; Phase 2
         keeps .specs strings unchanged so nothing breaks yet. */
      specsNormalized:  {},
      rawSpecs:     [],
      asin: '', sku: '', upc: '', ean: '', gtin: '', mpn: ''
    };
    for (const id of spec.identifiers) {
      const slot = id.kind && flat[id.kind] !== undefined ? id.kind : null;
      if (slot) flat[slot] = id.value;
    }
    for (const [canonKey, entry] of Object.entries(spec.specs)) {
      flat.specs[canonKey] = entry.canonicalValue || entry.rawValue;
      if (entry.normalized) flat.specsNormalized[canonKey] = entry.normalized;
      flat.rawSpecs.push({ key: entry.rawKey || canonKey, value: entry.rawValue, source: entry.source });
    }
    /* itemDetails (the "About this item" left-rail "Brand : Acme" rows)
       must ALSO land in rawSpecs — the detail UI iterates rawSpecs only.
       Previously they only went into flat.specs and were invisible. */
    for (const [canonKey, entry] of Object.entries(spec.itemDetails)) {
      if (!flat.specs[canonKey]) flat.specs[canonKey] = entry.canonicalValue || entry.rawValue;
      if (entry.normalized && !flat.specsNormalized[canonKey]) flat.specsNormalized[canonKey] = entry.normalized;
      flat.rawSpecs.push({ key: entry.rawKey || canonKey, value: entry.rawValue, source: entry.source });
    }
    return flat;
  }

  /* Canonical-key → dedicated-slot table. When a spec observation's
     normalized key matches one of these, it's redirected away from the
     specs/itemDetails bucket and into the proper identifier or identity
     slot — preventing the duplicate "Brand: Dremel" / "spec.Brand: Dremel"
     pattern in captured products. */
  const IDENTIFIER_REDIRECTS = {
    'asin':            { kind: 'identifier', field: 'asin' },
    'sku':             { kind: 'identifier', field: 'sku' },
    'upc':             { kind: 'identifier', field: 'upc' },
    'ean':             { kind: 'identifier', field: 'ean' },
    'gtin':            { kind: 'identifier', field: 'gtin' },
    'global trade identification number': { kind: 'identifier', field: 'gtin' },
    'mpn':             { kind: 'identifier', field: 'mpn' },
    'manufacturer part number': { kind: 'identifier', field: 'mpn' },
    'part number':     { kind: 'identifier', field: 'mpn' },
    'model number':    { kind: 'identity',   field: 'modelNumber' },
    'item model number': { kind: 'identity', field: 'modelNumber' },
    'model name':      { kind: 'identity',   field: 'modelName' },
    'brand':           { kind: 'identity',   field: 'brand' },
    'brand name':      { kind: 'identity',   field: 'brand' },
    'manufacturer':    { kind: 'identity',   field: 'manufacturer' }
  };

  NS.observation = observation;
  NS.emptyProductSpec = emptyProductSpec;
  NS.assemble = assemble;
  NS.toLegacyFlatProduct = toLegacyFlatProduct;
})(globalThis);
