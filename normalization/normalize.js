/* =============================================================
   ShopScout — normalization dispatcher (v2)

   One entry point: normalizeField(fieldName, rawValue).
   Looks the field up in the registry, dispatches to the matching
   type normalizer, returns a uniform {raw, canonical, display,
   provenance} envelope.

   Load order in browser:
     1. vendor/quantities.min.js               (Qty global — for measurement)
     2. normalization/registry.js              (ShopScoutRegistry)
     3. normalization/libraries/enums.js       (ShopScoutEnums)
     4. normalization/normalizers/text.js
     5. normalization/normalizers/enum.js
     6. normalization/normalizers/measurement.js
     7. normalization/normalize.js             (this file — exposes ShopScoutNormalize.field)
   ============================================================= */
(function initShopScoutNormalize(root) {
  const NS = (root.ShopScoutNormalize = root.ShopScoutNormalize || {});

  function normalizerFor(type) {
    if (type === 'enum') return root.ShopScoutEnumNormalizer;
    if (type === 'measurement') return root.ShopScoutMeasurementNormalizer;
    if (type === 'text') return root.ShopScoutTextNormalizer;
    return null;
  }

  function normalizeField(fieldName, rawValue) {
    const registry = root.ShopScoutRegistry;
    if (!registry || typeof registry.get !== 'function') {
      return {
        raw: rawValue,
        canonical: null,
        display: String(rawValue == null ? '' : rawValue),
        provenance: { method: 'no-registry', confidence: 0, warnings: ['registry_missing'] },
      };
    }
    const config = registry.get(fieldName);
    if (!config) {
      /* Unregistered field: treat as text passthrough, but flag
         so we can decide to add it to the registry. */
      const raw = rawValue == null ? null : String(rawValue);
      const cleaned = raw == null ? null : raw.trim();
      return {
        raw,
        canonical: cleaned || null,
        display: cleaned || '—',
        provenance: { method: 'unregistered-passthrough', confidence: 0.5, warnings: ['unknown_field:' + fieldName] },
      };
    }
    const impl = normalizerFor(config.type);
    if (!impl || typeof impl.normalize !== 'function') {
      return {
        raw: rawValue,
        canonical: null,
        display: String(rawValue == null ? '' : rawValue),
        provenance: { method: 'no-normalizer', confidence: 0, warnings: ['missing_normalizer:' + config.type] },
      };
    }
    return impl.normalize(rawValue, config);
  }

  Object.assign(NS, {
    version: 2,
    field: normalizeField,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
