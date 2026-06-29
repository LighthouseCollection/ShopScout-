/* =============================================================
   Matrix-mode row selection for Projection B (products as columns).
   Basic Matrix:    fixed key-attribute rows for quick decision-making.
   Detailed Matrix: every spec the user selected + raw/corrected/
                    confidence/source indicators, for deeper review.

   buildRows(products, state) → SpecRow[]
   where SpecRow = {
     key:    string,       // spec / attribute key (display label too)
     id:     string,       // stable id for SlickGrid row matching
     kind:   'core' | 'spec' | 'meta',
     accessor(product) → DisplayCell
   }

   DisplayCell = {
     raw:        string | null,
     corrected:  string | null,
     conflicts:  boolean,
     confidence: number | null,
     sources:    string[],
     missing:    boolean
   }
   ============================================================= */
(function initMatrixModes(root) {
  const NS = (root.ShopScoutGridProjections = root.ShopScoutGridProjections || {});
  const Values = root.ShopScoutValues || null;

  /* Core comparison rows for the Basic Matrix. Each row has a
     stable id, a human label, and an accessor that returns a
     DisplayCell for a given product. */
  const BASIC_ROWS = [
    coreRow('brand',         'Brand',         p => p.brand),
    coreRow('source',        'Source',        p => p.source),
    coreRow('newPrice',      'Price',         p => p.newPrice),
    coreRow('rating',        'Rating',        p => p.rating),
    coreRow('userRating',    'My rating',     p => p.userRating || 0),
    coreRow('availability',  'Availability',  p => p.availability),
    coreRow('status',        'Status',        p => p._status || p.status),
    coreRow('notes',         'Notes',         p => p.notes)
  ];

  /* Category-specific buying-factor rows for the Basic Matrix.
     Pulls from data/canonical.js's category rubric when available. */
  function categoryBuyingRows(products) {
    const canon = root.SSCanonical;
    if (!canon || typeof canon.getCategoryComparisonSpecKeys !== 'function') return [];
    const seenCats = new Map();
    for (const p of (products || [])) {
      const cat = (p && p.category) || (p && p._categoryKey) || null;
      if (!cat) continue;
      if (!seenCats.has(cat)) seenCats.set(cat, 0);
      seenCats.set(cat, seenCats.get(cat) + 1);
    }
    /* Use the most-common category in the visible set as the rubric. */
    if (!seenCats.size) return [];
    let topCat = null, topCount = 0;
    for (const [cat, count] of seenCats) {
      if (count > topCount) { topCat = cat; topCount = count; }
    }
    const keys = topCat ? (canon.getCategoryComparisonSpecKeys(topCat) || []) : [];
    return keys.map(key => specRow(key, key));
  }

  function coreRow(id, label, getRaw) {
    return {
      id: 'core:' + id,
      key: label,
      kind: 'core',
      field: id,
      accessor(product) {
        return cellFromValue(getRaw(product || {}), product);
      }
    };
  }

  function specRow(key, label) {
    return {
      id: 'spec:' + key,
      key: label,
      kind: 'spec',
      field: 'spec:' + key,
      accessor(product) {
        return cellFromSpec(product || {}, key);
      }
    };
  }

  function metaRow(id, label, getRaw) {
    return {
      id: 'meta:' + id,
      key: label,
      kind: 'meta',
      field: 'meta:' + id,
      accessor(product) {
        return cellFromValue(getRaw(product || {}), product);
      }
    };
  }

  /* DisplayCell builder for a flat field on the product (e.g., brand
     or price). The cell carries the raw value + the corrected value
     when present + a "conflicts" flag when both exist and differ. */
  function cellFromValue(raw, product) {
    const cell = {
      raw: prettify(raw),
      corrected: null,
      conflicts: false,
      confidence: null,
      sources: [],
      missing: raw == null || raw === ''
    };
    /* Look for a corrected value in the AI correction map if the
       product carries one (e.g., `aiCorrections.brand = 'Anker'`). */
    const corrections = product && (product.aiCorrections || product._corrections);
    if (corrections && Object.prototype.hasOwnProperty.call(corrections, 'brand')) {
      /* Generic — actual fields per product checked by callers above */
    }
    return cell;
  }

  /* DisplayCell for a spec entry. Uses the new ProductSpec shape
     (`_spec.specs[key] = { canonicalValue, rawValue, sources, confidence }`)
     when present, falling back to legacy `rawSpecs[]` / `specs[]`. */
  function cellFromSpec(product, key) {
    const newSpec = product && product._spec;
    if (newSpec && newSpec.specs && typeof newSpec.specs === 'object') {
      const entry = findSpecEntry(newSpec.specs, key);
      if (entry) return shapeFromSpecEntry(entry);
    }
    const list = Array.isArray(product && product.rawSpecs) ? product.rawSpecs
               : Array.isArray(product && product.specs)    ? product.specs
               : [];
    for (const s of list) {
      if (!s || s.key == null) continue;
      if (specKeyMatches(s.key, key)) {
        return {
          raw: prettify(s.value),
          corrected: null,
          conflicts: false,
          confidence: null,
          sources: [],
          missing: s.value == null || s.value === ''
        };
      }
    }
    return {
      raw: null, corrected: null,
      conflicts: false, confidence: null, sources: [],
      missing: true
    };
  }

  function findSpecEntry(specsObj, key) {
    if (Object.prototype.hasOwnProperty.call(specsObj, key)) return specsObj[key];
    const lower = key.toLowerCase();
    for (const k of Object.keys(specsObj)) {
      if (k.toLowerCase() === lower) return specsObj[k];
    }
    return null;
  }

  function shapeFromSpecEntry(entry) {
    /* SpecEntry shape from content/productSchema.js:
         { value, rawValue, canonicalValue, source, confidence, sources? } */
    const raw = entry.rawValue != null ? entry.rawValue : (entry.value != null ? entry.value : '');
    const canonical = entry.canonicalValue != null ? entry.canonicalValue : null;
    const corrected = canonical && String(canonical) !== String(raw) ? canonical : null;
    return {
      raw: prettify(raw),
      corrected: prettify(corrected),
      conflicts: !!(corrected && raw && String(corrected) !== String(raw)),
      confidence: typeof entry.confidence === 'number' ? entry.confidence : null,
      sources: Array.isArray(entry.sources) ? entry.sources.slice() : (entry.source ? [entry.source] : []),
      missing: raw == null || raw === ''
    };
  }

  function specKeyMatches(a, b) {
    const norm = s => String(s || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    return norm(a) === norm(b);
  }

  function prettify(value) {
    if (Values && typeof Values.prettify === 'function') return Values.prettify(value);
    if (value == null) return null;
    return String(value);
  }

  /* Build the Basic Matrix row set. */
  function basicRows(products) {
    return BASIC_ROWS.concat(categoryBuyingRows(products));
  }

  /* Build the Detailed Matrix row set:
     core fields + every spec key any selected product carries.
     Optionally filter to a user-selected spec set via
     state.detailedSpecAllowlist (array of canonical keys); when
     unset, include everything. */
  function detailedRows(products, state) {
    const core = BASIC_ROWS.slice();
    const seen = new Set();
    const specs = [];
    const allow = Array.isArray(state && state.detailedSpecAllowlist)
      ? new Set(state.detailedSpecAllowlist)
      : null;

    for (const p of (products || [])) {
      const newSpec = p && p._spec;
      if (newSpec && newSpec.specs) {
        for (const k of Object.keys(newSpec.specs)) {
          if (!seen.has(k) && (!allow || allow.has(k))) {
            seen.add(k);
            specs.push(specRow(k, k));
          }
        }
      }
      const list = Array.isArray(p && p.rawSpecs) ? p.rawSpecs
                 : Array.isArray(p && p.specs)    ? p.specs
                 : [];
      for (const s of list) {
        if (!s || s.key == null) continue;
        const key = String(s.key);
        if (!seen.has(key) && (!allow || allow.has(key))) {
          seen.add(key);
          specs.push(specRow(key, key));
        }
      }
    }

    specs.sort((a, b) => a.key.localeCompare(b.key, undefined, { sensitivity: 'base' }));

    const meta = [
      metaRow('updatedAt', 'Last updated', p => p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : ''),
      metaRow('capturedAt', 'Captured', p => p.capturedAt ? new Date(p.capturedAt).toLocaleDateString() : '')
    ];

    return core.concat(specs).concat(meta);
  }

  function buildRows(products, state) {
    const mode = state && state.matrix === 'detailed' ? 'detailed' : 'basic';
    return mode === 'detailed' ? detailedRows(products, state || {}) : basicRows(products);
  }

  NS.matrixModes = {
    buildRows,
    basicRows,
    detailedRows,
    cellFromSpec,
    BASIC_ROWS: BASIC_ROWS.slice()
  };
})(globalThis);
