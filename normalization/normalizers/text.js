/* =============================================================
   ShopScout — text normalizer (normalization v2)

   Handles registry.type === 'text' fields (Brand, Model, SKU,
   Description, ...). No value-set mapping — just cleaning:
   trim whitespace, collapse internal runs, optionally unescape
   HTML entities for long-form Description-style fields.
   ============================================================= */
(function initShopScoutTextNormalizer(root) {
  const NS = (root.ShopScoutTextNormalizer = root.ShopScoutTextNormalizer || {});

  const ENTITY = /&(amp|lt|gt|quot|apos|#39|nbsp);/g;
  const ENTITY_MAP = {
    'amp': '&', 'lt': '<', 'gt': '>', 'quot': '"',
    'apos': "'", '#39': "'", 'nbsp': ' ',
  };

  function trimClean(s) {
    return String(s).replace(/\s+/g, ' ').trim();
  }

  function unescape(s) {
    return String(s).replace(ENTITY, (_, name) => ENTITY_MAP[name] || _);
  }

  function normalizeText(rawValue, config) {
    if (rawValue == null || rawValue === '') {
      return {
        raw: rawValue == null ? null : '',
        canonical: null,
        display: '—',
        provenance: { method: 'text.empty', confidence: 0, warnings: ['empty_input'] },
      };
    }
    const raw = String(rawValue);
    let cleaned;
    switch (config && config.clean) {
      case 'trimUnescape':
        cleaned = trimClean(unescape(raw));
        break;
      case 'trim':
      default:
        cleaned = trimClean(raw);
        break;
    }
    if (!cleaned) {
      return {
        raw,
        canonical: null,
        display: '—',
        provenance: { method: 'text.empty', confidence: 0, warnings: ['whitespace_only'] },
      };
    }
    return {
      raw,
      canonical: cleaned,
      display: cleaned,
      provenance: { method: 'text.clean', confidence: 1, warnings: [] },
    };
  }

  Object.assign(NS, { version: 2, normalize: normalizeText });
})(typeof globalThis !== 'undefined' ? globalThis : this);
