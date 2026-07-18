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

  const COMPACT_UNIT_RE = /(\d[\d,]*(?:\.\d+)?)\s*(mAh|Ah|Wh|kHz|MHz|GHz|DPI|PPI|FPS|GB|TB|MB|KB|mm|cm|in|ft|lbs?|kg|oz|psi|Nm|N·m|V|W)\b/gi;
  const UNIT_DISPLAY = {
    mah: 'mAh',
    ah: 'Ah',
    wh: 'Wh',
    khz: 'kHz',
    mhz: 'MHz',
    ghz: 'GHz',
    dpi: 'DPI',
    ppi: 'PPI',
    fps: 'FPS',
    gb: 'GB',
    tb: 'TB',
    mb: 'MB',
    kb: 'KB',
    mm: 'mm',
    cm: 'cm',
    in: 'in',
    ft: 'ft',
    lb: 'lb',
    lbs: 'lb',
    kg: 'kg',
    oz: 'oz',
    psi: 'psi',
    nm: 'Nm',
    'n·m': 'N·m',
    v: 'V',
    w: 'W'
  };

  function normalizeCompactUnitSpacing(s) {
    return String(s).replace(COMPACT_UNIT_RE, (_match, amount, unit) => {
      const displayUnit = UNIT_DISPLAY[String(unit || '').toLowerCase()] || unit;
      return `${amount} ${displayUnit}`;
    });
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
        cleaned = trimClean(normalizeCompactUnitSpacing(unescape(raw)));
        break;
      case 'trim':
      default:
        cleaned = trimClean(normalizeCompactUnitSpacing(raw));
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

  Object.assign(NS, {
    version: 2,
    normalize: normalizeText,
    normalizeCompactUnitSpacing
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
