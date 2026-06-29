/* =============================================================
   ShopScout — Spec-key canonicalizer
   Maps the wild variety of spec key strings ("Item Weight",
   "Product Weight", "Net Weight", "Weight") to a single
   canonical form. Layered:
     1) The abbreviation + SHOPIFY attribute table in SSCanonical
        (when loaded — page-side; not available in service worker)
     2) A local synonym table for the common e-commerce keys
        the wild taxonomy doesn't quite cover.
     3) Identity passthrough for unknown keys, trimmed + normalized.
   ============================================================= */
(function initKeyCanonicalizer(root) {
  const NS = (root.SSExtract = root.SSExtract || {});

  /* Local synonym table — common e-commerce spec keys mapped to a
     canonical short label. Keep keys lower-case. */
  const SYNONYMS = {
    /* Identity-ish */
    'item weight':      'Weight',
    'product weight':   'Weight',
    'net weight':       'Weight',
    'shipping weight':  'Weight (shipping)',
    'package weight':   'Weight (package)',
    'item dimensions':  'Dimensions',
    'product dimensions':'Dimensions',
    'package dimensions':'Dimensions (package)',
    'item dimensions lxwxh':'Dimensions',
    'product size':     'Dimensions',
    'item size':        'Dimensions',
    'size':             'Size',
    'item model number':'Model number',
    'product model number':'Model number',
    'model':            'Model number',
    'model #':          'Model number',
    'model no':         'Model number',
    'model no.':        'Model number',
    'model name':       'Model name',
    'part number':      'MPN',
    'part #':           'MPN',
    'manufacturer part number':'MPN',
    'mfg part number':  'MPN',
    'asin':             'ASIN',
    'upc':              'UPC',
    'ean':              'EAN',
    'gtin':             'GTIN',
    'sku':              'SKU',
    'item sku':         'SKU',

    /* Brand / origin */
    'brand':            'Brand',
    'brand name':       'Brand',
    'manufacturer':     'Manufacturer',
    'country of origin':'Country of origin',
    'made in':          'Country of origin',

    /* Color / material / pattern */
    'color':            'Color',
    'colour':           'Color',
    'color name':       'Color',
    'material':         'Material',
    'fabric':           'Material',
    'pattern':          'Pattern',
    'finish':           'Finish',
    'style':            'Style',

    /* Capacity / volume */
    'capacity':         'Capacity',
    'volume':           'Volume',
    'storage':          'Storage',
    'memory':           'Memory',
    'ram':              'Memory',

    /* Power / battery */
    'wattage':          'Wattage',
    'voltage':          'Voltage',
    'amperage':         'Current',
    'battery':          'Battery',
    'battery type':     'Battery type',
    'battery capacity': 'Battery capacity',
    'battery life':     'Battery life',
    'power source':     'Power source',
    'power':            'Power',

    /* Display */
    'display':          'Display',
    'screen size':      'Screen size',
    'display size':     'Screen size',
    'resolution':       'Resolution',
    'refresh rate':     'Refresh rate',

    /* Connectivity */
    'connectivity':     'Connectivity',
    'wireless':         'Connectivity',
    'connector type':   'Connector',

    /* Warranty / availability */
    'warranty':         'Warranty',
    'warranty period':  'Warranty',
    'availability':     'Availability',
    'in stock':         'Availability',

    /* Audio */
    'audio output':     'Audio output',
    'noise cancellation':'Noise cancellation',

    /* Power tools */
    'max torque':       'Max torque',
    'torque':           'Max torque',
    'speed':            'Speed',
    'max speed':        'Speed',
    'no load speed':    'Speed (no load)',
    'chuck size':       'Chuck size',
    'bit type':         'Bit type',

    /* Cosmetics / fragrance */
    'scent':            'Scent',
    'fragrance family': 'Fragrance family',
    'concentration':    'Concentration',
    'volume (fl oz)':   'Volume',
    'volume (ml)':      'Volume',

    /* Apparel */
    'fit':              'Fit',
    'sleeve':           'Sleeve',
    'sleeve length':    'Sleeve length',
    'neck style':       'Neck style',
    'closure':          'Closure',

    /* Generic */
    'features':         'Features',
    'special features': 'Special features',
    'included':         'Included items',
    'included components':'Included items',
    'in the box':       'Included items',
    'what\'s in the box':'Included items'
  };

  function normalizeKey(rawKey) {
    if (rawKey == null) return '';
    /* Split camelCase ("maximumRotationalSpeed" → "maximum Rotational Speed")
       before trimming so JSON-LD additionalProperty entries (which Amazon
       writes as camelCase) collapse onto the same key as the table row. */
    const decamel = String(rawKey).replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    const trimmed = decamel.trim().replace(/[\s:]+$/, '').replace(/\s+/g, ' ');
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();

    /* 1. Synonym table */
    if (SYNONYMS[lower]) return SYNONYMS[lower];

    /* 2. SSCanonical (Shopify + abbreviation table) when loaded.
          Only available in page context, not service worker. */
    try {
      if (root.SSCanonical && root.SSCanonical.canonicalKey) {
        const c = root.SSCanonical.canonicalKey(trimmed);
        if (c && c !== trimmed) return c;
      }
    } catch { /* tolerate */ }

    /* 3. Title-case the trimmed key as a fallback. */
    return trimmed.replace(/\b\w/g, c => c.toUpperCase());
  }

  function normalizeValue(rawValue) {
    if (rawValue == null) return '';
    const trimmed = String(rawValue).replace(/\s+/g, ' ').trim();
    if (!trimmed) return '';
    try {
      if (root.SSCanonical && root.SSCanonical.canonicalValue) {
        const c = root.SSCanonical.canonicalValue(trimmed);
        if (c) return c;
      }
    } catch { /* tolerate */ }
    return trimmed;
  }

  NS.keyCanonicalizer = {
    normalizeKey,
    normalizeValue,
    _synonyms: SYNONYMS
  };
})(globalThis);
