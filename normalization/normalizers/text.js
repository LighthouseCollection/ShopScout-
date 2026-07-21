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

  const TOKENIZED_UNIT_PHRASES = [
    [/\bvolts?_of_direct_current\b/gi, 'volts of direct current'],
    [/\bvolts?_of_alternating_current\b/gi, 'volts of alternating current'],
    [/\bpounds?_per_square_inch\b/gi, 'pounds per square inch'],
    [/\bdots?_per_inch\b/gi, 'DPI'],
    [/\bpixels?_per_inch\b/gi, 'PPI'],
  ];

  function normalizeTokenizedUnitPhrases(s) {
    let next = String(s);
    for (const [pattern, replacement] of TOKENIZED_UNIT_PHRASES) {
      next = next.replace(pattern, replacement);
    }
    return next;
  }

  function normalizeResolutionSpacing(s) {
    return String(s).replace(/(\d)\s*[x×]\s*(\d)/gi, '$1 x $2');
  }

  function normalizeDpiPhrases(s) {
    return String(s)
      .replace(/\b(\d[\d,]*(?:\.\d+)?)\s*(?:dots?|dot)\s+per\s+inch\b/gi, '$1 DPI')
      .replace(/\b(\d[\d,]*(?:\.\d+)?)\s*(?:pixels?|pixel)\s+per\s+inch\b/gi, '$1 PPI');
  }

  function normalizeLongUnitWords(s) {
    return String(s)
      .replace(/\b(\d[\d,]*(?:\.\d+)?)\s*inches\b/gi, '$1 in')
      .replace(/\b(\d[\d,]*(?:\.\d+)?)\s*inch\b/gi, '$1 in')
      .replace(/\b(\d[\d,]*(?:\.\d+)?)\s*centimeters\b/gi, '$1 cm')
      .replace(/\b(\d[\d,]*(?:\.\d+)?)\s*centimeter\b/gi, '$1 cm')
      .replace(/\b(\d[\d,]*(?:\.\d+)?)\s*millimeters\b/gi, '$1 mm')
      .replace(/\b(\d[\d,]*(?:\.\d+)?)\s*millimeter\b/gi, '$1 mm')
      .replace(/\b(\d[\d,]*(?:\.\d+)?)\s*pounds\b/gi, '$1 lb')
      .replace(/\b(\d[\d,]*(?:\.\d+)?)\s*pound\b/gi, '$1 lb')
      .replace(/\b(\d[\d,]*(?:\.\d+)?)\s*ounces\b/gi, '$1 oz')
      .replace(/\b(\d[\d,]*(?:\.\d+)?)\s*ounce\b/gi, '$1 oz');
  }

  function normalizeDisplayText(s) {
    return trimClean(normalizeLongUnitWords(
      normalizeCompactUnitSpacing(
        normalizeDpiPhrases(
          normalizeResolutionSpacing(
            normalizeTokenizedUnitPhrases(s)
          )
        )
      )
    ));
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
        cleaned = normalizeDisplayText(unescape(raw));
        break;
      case 'trim':
      default:
        cleaned = normalizeDisplayText(raw);
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
    normalizeCompactUnitSpacing,
    normalizeDisplayText,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
