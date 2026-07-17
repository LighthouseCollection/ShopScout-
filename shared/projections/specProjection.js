/* =============================================================
   ShopScout — spec projection helpers (renderer-agnostic).
   Extracted from table/productRows.js (Task 11 Phase 1). The
   Tabulator-coupled `flattenForPivot` was deleted along with the
   pivot view; `flattenSpecs` survives because it's pure data
   projection (Products → flat rows with `spec:<canonicalKey>`
   columns).

   Public API on window.ShopScoutProjections:
     flattenSpecs(products, options)  → flat rows with spec:* keys
   ============================================================= */
(function initShopScoutProjections(root) {
  const NS = (root.ShopScoutProjections = root.ShopScoutProjections || {});

  /* Flatten product.specs[] into top-level "spec:<CanonicalKey>"
     fields. Canonicalization runs through SSCanonical when loaded.
     Spec list source runs through SSSpecHeuristic.specListOf when
     loaded (so legacy capture shapes are handled). Duplicate
     canonical keys are dropped (first wins). Pre-computes best-in-
     row ranks for the always-visible numeric columns via
     ShopScoutValues.computeRanks when available. */
  function flattenSpecs(rows, options) {
    const opts = options || {};
    const scope = opts.root || root;
    const canon = scope.SSCanonical || root.SSCanonical;
    const canonKey = canon && canon.canonicalKey
      ? (key) => canon.canonicalKey(key)
      : (key) => String(key || '').trim();
    const specAccess = scope.ShopScoutProductSpecAccess || root.ShopScoutProductSpecAccess;
    const SH = scope.SSSpecHeuristic || root.SSSpecHeuristic;
    const values = scope.ShopScoutValues || root.ShopScoutValues;

    const flattened = (Array.isArray(rows) ? rows : []).map(product => {
      const flat = Object.assign({}, product);
      const list = specAccess && typeof specAccess.specEntries === 'function'
        ? specAccess.specEntries(product, { root: scope })
        : SH && SH.specListOf
          ? SH.specListOf(product)
          : (Array.isArray(product.specs) ? product.specs : []);
      const seen = new Set();
      for (const spec of list) {
        const rawKey = spec?.rawField ?? spec?.key ?? spec?.field;
        if (!spec || rawKey == null) continue;
        const key = spec.field || canonKey(rawKey);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        if (spec.display != null && spec.display !== '') {
          flat['spec:' + key] = String(spec.display);
        } else {
          flat['spec:' + key] = spec.value == null ? '' : String(spec.value);
        }
      }
      return flat;
    });

    if (values && typeof values.computeRanks === 'function') {
      values.computeRanks(flattened, 'newPrice', 'low');
      values.computeRanks(flattened, 'rating',   'high');
    }
    return flattened;
  }

  Object.assign(NS, { flattenSpecs });
})(globalThis);
