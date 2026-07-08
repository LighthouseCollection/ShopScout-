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
  let compiled = compileRules();

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

  function compileRules() {
    const fieldAliases = RULES.fieldAliases || {};
    const canonicalFields = RULES.canonicalFields || {};
    const enums = RULES.enums || {};
    const exactAliasFields = new Set(RULES.exactAliasFields || []);
    const userRules = root.ShopScoutUserNormalizationRules || {};
    const fieldLookup = Object.create(null);
    for (const key of Object.keys(canonicalFields)) {
      fieldLookup[normalizeToken(key)] = canonicalFields[key];
      for (const alias of (fieldAliases[key] || [])) {
        fieldLookup[normalizeToken(alias)] = canonicalFields[key];
      }
    }
    const enumLookups = Object.create(null);
    for (const field of Object.keys(enums)) {
      const lookup = Object.create(null);
      for (const canonical of Object.keys(enums[field])) {
        const defaultRule = 'enum:' + slug(field) + ':' + slug(canonical);
        lookup[normalizeToken(canonical)] = { normalized: canonical, confidence: 1, rule: defaultRule };
        for (const alias of enums[field][canonical]) {
          const userAlias = typeof userRules.isUserEnumAlias === 'function'
            && userRules.isUserEnumAlias(field, canonical, alias);
          lookup[normalizeToken(alias)] = {
            normalized: canonical,
            confidence: alias === canonical || exactAliasFields.has(field) || userAlias ? 1 : 0.95,
            rule: userAlias ? 'user-enum:' + slug(field) + ':' + slug(canonical) : defaultRule
          };
        }
      }
      enumLookups[field] = lookup;
    }
    return { fieldAliases, canonicalFields, enums, fieldLookup, enumLookups };
  }

  function reloadRules() {
    compiled = compileRules();
    NS._fieldAliases = compiled.fieldAliases;
    NS._enums = compiled.enums;
  }

  function normalizeFieldName(field) {
    const original = String(field == null ? '' : field).trim();
    if (!original) return '';
    return compiled.fieldLookup[normalizeToken(original)] || original;
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
    const lookup = compiled.enumLookups[canonicalField];
    if (!raw) {
      const out = { field: canonicalField, raw, normalized: raw, confidence: 0, rule: 'unmapped' };
      if (mappedField) {
        out.fieldRule = mappedField.rule;
        out.fieldSource = mappedField.source;
      }
      return out;
    }
    const hit = lookup ? lookup[normalizeToken(raw)] : null;
    const packHit = !hit && root.ShopScoutGeneratedPacks && typeof root.ShopScoutGeneratedPacks.lookupEnum === 'function'
      ? root.ShopScoutGeneratedPacks.lookupEnum(context?.vertical?.id, canonicalField, raw)
      : null;
    if (!hit && !packHit) {
      const out = { field: canonicalField, raw, normalized: raw, confidence: 0, rule: 'unmapped' };
      if (mappedField) {
        out.fieldRule = mappedField.rule;
        out.fieldSource = mappedField.source;
      }
      return out;
    }
    const finalHit = hit || packHit;
    const out = {
      field: canonicalField,
      raw,
      normalized: finalHit.normalized,
      confidence: finalHit.confidence,
      rule: finalHit.rule
    };
    if (mappedField) {
      out.fieldRule = mappedField.rule;
      out.fieldSource = mappedField.source;
    }
    return out;
  }

  function normalizeProductAttributes(product) {
    const taxonomy = root.ShopScoutTaxonomyNormalization;
    const context = product?._normalizationContext || (taxonomy && typeof taxonomy.categoryContextForProduct === 'function'
      ? taxonomy.categoryContextForProduct(product)
      : null);
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
    reloadRules,
    _fieldAliases: compiled.fieldAliases,
    _enums: compiled.enums
  });
})(globalThis);
