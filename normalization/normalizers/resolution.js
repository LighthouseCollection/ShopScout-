/* =============================================================
   ShopScout — resolution normalizer (normalization v2)

   Normalizes display/video resolution strings. Standard pixel
   dimensions get a user-facing shortcut; unknown dimensions keep
   a clean "W × H" shape.
   ============================================================= */
(function initShopScoutResolutionNormalizer(root) {
  const NS = (root.ShopScoutResolutionNormalizer = root.ShopScoutResolutionNormalizer || {});

  const STANDARD_BY_DIMENSIONS = {
    '640x480': 'VGA',
    '1280x720': 'HD (720p)',
    '1920x1080': 'Full HD (1080p)',
    '2560x1440': 'QHD (1440p)',
    '3840x2160': '4K UHD',
    '7680x4320': '8K UHD',
  };

  const DIMENSIONS_BY_SHORTCUT = {
    'vga': '640 × 480',
    'hd': '1280 × 720',
    '720p': '1280 × 720',
    'fhd': '1920 × 1080',
    'full hd': '1920 × 1080',
    '1080p': '1920 × 1080',
    'qhd': '2560 × 1440',
    '1440p': '2560 × 1440',
    '4k': '3840 × 2160',
    '4k uhd': '3840 × 2160',
    'uhd': '3840 × 2160',
    '8k': '7680 × 4320',
    '8k uhd': '7680 × 4320',
  };

  function normalizeDimensionKey(width, height) {
    return `${Number(width)}x${Number(height)}`;
  }

  function displayDimensions(width, height) {
    return `${Number(width)} × ${Number(height)}`;
  }

  function shortcutFromRaw(raw) {
    return String(raw || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function normalize(rawValue) {
    if (rawValue == null || rawValue === '') {
      return {
        raw: rawValue == null ? null : '',
        canonical: null,
        display: '—',
        provenance: { method: 'resolution.empty', confidence: 0, warnings: ['empty_input'] },
      };
    }
    const raw = String(rawValue);
    const dimensionMatch = raw.match(/\b(\d{3,5})\s*[x×]\s*(\d{3,5})\b/i);
    if (dimensionMatch) {
      const key = normalizeDimensionKey(dimensionMatch[1], dimensionMatch[2]);
      const canonical = displayDimensions(dimensionMatch[1], dimensionMatch[2]);
      return {
        raw,
        canonical,
        display: STANDARD_BY_DIMENSIONS[key] || canonical,
        provenance: {
          method: STANDARD_BY_DIMENSIONS[key] ? 'resolution.standard-dimensions' : 'resolution.dimensions',
          confidence: 1,
          warnings: [],
        },
      };
    }

    const shortcut = shortcutFromRaw(raw);
    if (DIMENSIONS_BY_SHORTCUT[shortcut]) {
      const canonical = DIMENSIONS_BY_SHORTCUT[shortcut];
      const standard = STANDARD_BY_DIMENSIONS[canonical.replace(/\s*×\s*/g, 'x')];
      return {
        raw,
        canonical,
        display: standard || raw.trim(),
        provenance: { method: 'resolution.shortcut', confidence: 0.9, warnings: [] },
      };
    }

    const cleaned = raw.replace(/\s+/g, ' ').trim();
    return {
      raw,
      canonical: cleaned || null,
      display: cleaned || '—',
      provenance: { method: 'resolution.passthrough', confidence: 0.5, warnings: ['unknown_resolution'] },
    };
  }

  Object.assign(NS, {
    version: 2,
    normalize,
    _standards: STANDARD_BY_DIMENSIONS,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
