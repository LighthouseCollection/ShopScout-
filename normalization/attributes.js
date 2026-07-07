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
  const RULES = root.ShopScoutNormalizationRules || {};
  const FIELD_ALIASES = RULES.fieldAliases || {};
  const CANONICAL_FIELDS = RULES.canonicalFields || {};
  const ENUMS = RULES.enums || {};
  const EXACT_ALIAS_FIELDS = new Set(RULES.exactAliasFields || []);

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
