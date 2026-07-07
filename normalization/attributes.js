/* =============================================================
   ShopScout — attribute field + enum normalization

   This module handles "attribute chaos": supplier-specific names and
   free-form values that mean the same thing but break filtering and
   comparison until mapped to canonical terms.

   Public API on window.ShopScoutAttributeNormalization:
     normalizeFieldName(field)
     normalizeAttribute(field, value)
     normalizeProductAttributes(product)
   ============================================================= */
(function initShopScoutAttributeNormalization(root) {
  const NS = (root.ShopScoutAttributeNormalization = root.ShopScoutAttributeNormalization || {});

  const FIELD_ALIASES = {
    color: ['colour', 'color name', 'finish color', 'finish colour', 'shade'],
    size: ['size name', 'apparel size', 'fit size', 'item size'],
    material: ['material type', 'materials', 'fabric type', 'fabric'],
    'connector type': ['usb type', 'connection type', 'connector', 'plug type', 'port type'],
    'power source': ['power supply', 'power-source', 'power_source'],
    voltage: ['voltage rating', 'voltage_rating', 'input voltage', 'output voltage', 'rated voltage']
  };

  const CANONICAL_FIELDS = {
    color: 'Color',
    size: 'Size',
    material: 'Material',
    'connector type': 'Connector Type',
    'power source': 'Power Source',
    voltage: 'Voltage'
  };

  const ENUMS = {
    Color: {
      'Navy Blue': ['navy', 'navy blue', 'midnight blue', 'dark navy', 'dark blue'],
      Black: ['black', 'jet black', 'matte black'],
      White: ['white', 'off white', 'off-white', 'ivory'],
      Gray: ['gray', 'grey', 'graphite', 'charcoal', 'space gray', 'space grey'],
      Silver: ['silver', 'metallic silver'],
      Red: ['red', 'crimson', 'burgundy'],
      Green: ['green', 'forest green', 'olive'],
      Blue: ['blue', 'royal blue'],
      Brown: ['brown', 'tan', 'beige']
    },
    Size: {
      XS: ['xs', 'extra small', 'x-small'],
      S: ['s', 'small'],
      M: ['m', 'medium', 'med'],
      L: ['l', 'large'],
      XL: ['xl', 'extra large', 'x-large'],
      XXL: ['xxl', '2xl', '2x large', 'double extra large']
    },
    Material: {
      'Stainless Steel 304': ['ss304', '304 stainless', 'stainless 304', 'stainless steel 304', 'sus304'],
      'Stainless Steel': ['stainless steel', 'inox'],
      Aluminum: ['aluminum', 'aluminium'],
      Plastic: ['plastic', 'abs plastic', 'polycarbonate'],
      Cotton: ['cotton', '100% cotton'],
      Polyester: ['polyester', 'poly']
    },
    'Connector Type': {
      'USB-C': ['usb-c', 'usb c', 'usb type-c', 'usb type c', 'type-c', 'type c'],
      'USB-A': ['usb-a', 'usb a', 'usb type-a', 'usb type a', 'type-a'],
      Lightning: ['lightning', 'apple lightning'],
      MicroUSB: ['micro usb', 'micro-usb', 'microusb'],
      HDMI: ['hdmi'],
      DisplayPort: ['displayport', 'display port', 'dp']
    },
    'Power Source': {
      'Corded Electric': ['corded electric', 'corded', 'wired', 'ac powered', 'plug in', 'plug-in'],
      'Battery Powered': ['battery powered', 'battery', 'rechargeable battery', 'cordless'],
      Solar: ['solar', 'solar powered'],
      USB: ['usb powered', 'usb']
    }
  };
  const EXACT_ALIAS_FIELDS = new Set(['Size', 'Material', 'Connector Type']);

  const FIELD_LOOKUP = Object.create(null);
  for (const key of Object.keys(CANONICAL_FIELDS)) {
    FIELD_LOOKUP[normalizeToken(key)] = CANONICAL_FIELDS[key];
    for (const alias of (FIELD_ALIASES[key] || [])) {
      FIELD_LOOKUP[normalizeToken(alias)] = CANONICAL_FIELDS[key];
    }
  }

  const ENUM_LOOKUPS = Object.create(null);
  for (const field of Object.keys(ENUMS)) {
    const lookup = Object.create(null);
    for (const canonical of Object.keys(ENUMS[field])) {
      const rule = 'enum:' + slug(field) + ':' + slug(canonical);
      lookup[normalizeToken(canonical)] = { normalized: canonical, confidence: 1, rule };
      for (const alias of ENUMS[field][canonical]) {
        lookup[normalizeToken(alias)] = {
          normalized: canonical,
          confidence: alias === canonical || EXACT_ALIAS_FIELDS.has(field) ? 1 : 0.95,
          rule
        };
      }
    }
    ENUM_LOOKUPS[field] = lookup;
  }

  function normalizeToken(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/[^\p{L}\p{N}+#./ ]+/gu, '')
      .replace(/\s+/g, ' ');
  }

  function slug(value) {
    return normalizeToken(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function normalizeFieldName(field) {
    const original = String(field == null ? '' : field).trim();
    if (!original) return '';
    return FIELD_LOOKUP[normalizeToken(original)] || original;
  }

  function taxonomyField(field, context) {
    const taxonomy = root.ShopScoutTaxonomyNormalization;
    if (!taxonomy || typeof taxonomy.normalizeFieldWithTaxonomy !== 'function') return null;
    const mapped = taxonomy.normalizeFieldWithTaxonomy(field, context);
    return mapped && mapped.source === 'shopify-taxonomy' ? mapped : null;
  }

  function normalizeAttribute(field, value, context) {
    const localField = normalizeFieldName(field);
    const mappedField = localField === String(field == null ? '' : field).trim()
      ? taxonomyField(field, context)
      : null;
    const canonicalField = mappedField ? mappedField.field : localField;
    const raw = value == null ? '' : String(value).trim();
    const lookup = ENUM_LOOKUPS[canonicalField];
    if (!raw || !lookup) {
      const out = { field: canonicalField, raw, normalized: raw, confidence: 0, rule: 'unmapped' };
      if (mappedField) {
        out.fieldRule = mappedField.rule;
        out.fieldSource = mappedField.source;
      }
      return out;
    }
    const hit = lookup[normalizeToken(raw)];
    if (!hit) {
      const out = { field: canonicalField, raw, normalized: raw, confidence: 0, rule: 'unmapped' };
      if (mappedField) {
        out.fieldRule = mappedField.rule;
        out.fieldSource = mappedField.source;
      }
      return out;
    }
    const out = {
      field: canonicalField,
      raw,
      normalized: hit.normalized,
      confidence: hit.confidence,
      rule: hit.rule
    };
    if (mappedField) {
      out.fieldRule = mappedField.rule;
      out.fieldSource = mappedField.source;
    }
    return out;
  }

  function normalizeProductAttributes(product) {
    const taxonomy = root.ShopScoutTaxonomyNormalization;
    const context = taxonomy && typeof taxonomy.categoryContextForProduct === 'function'
      ? taxonomy.categoryContextForProduct(product)
      : null;
    const specs = product && Array.isArray(product.specs) ? product.specs
      : product && Array.isArray(product.rawSpecs) ? product.rawSpecs
        : [];
    const out = [];
    for (const spec of specs) {
      if (!spec || spec.key == null) continue;
      const rawField = String(spec.key).trim();
      const normalized = normalizeAttribute(rawField, spec.value, context);
      out.push(Object.assign({ rawField }, normalized));
    }
    return out;
  }

  Object.assign(NS, {
    normalizeFieldName,
    normalizeAttribute,
    normalizeProductAttributes,
    _fieldAliases: FIELD_ALIASES,
    _enums: ENUMS
  });
})(globalThis);
