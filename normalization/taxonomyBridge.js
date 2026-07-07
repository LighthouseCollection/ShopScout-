/* =============================================================
   ShopScout — taxonomy-aware normalization bridge

   Connects the bundled Shopify taxonomy lookup (SSCanonical) to the
   deterministic normalization pipeline. This module does not fetch remote
   data and does not call AI. It only reads the local canonical API when it is
   already available.

   Public API on window.ShopScoutTaxonomyNormalization:
     categoryContextForProduct(product)
     normalizeFieldWithTaxonomy(field, context)
     taxonomyPatchForProduct(product)
   ============================================================= */
(function initShopScoutTaxonomyNormalization(root) {
  const NS = (root.ShopScoutTaxonomyNormalization = root.ShopScoutTaxonomyNormalization || {});

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

  function categoryShape(category) {
    if (!category) return null;
    const parts = Array.isArray(category.parts)
      ? category.parts.map(part => String(part || '').trim()).filter(Boolean)
      : String(category.full_name || category.name || '').split(' > ').map(part => part.trim()).filter(Boolean);
    return {
      id: category.gid || category.id || '',
      leaf: category.name || parts[parts.length - 1] || '',
      fullName: category.full_name || parts.join(' > ') || category.name || '',
      path: parts
    };
  }

  function canonicalApi() {
    const canon = root.SSCanonical;
    return canon && typeof canon === 'object' ? canon : null;
  }

  function categoryContextForProduct(product) {
    const canon = canonicalApi();
    if (!canon || typeof canon.matchProductToCategory !== 'function') {
      return {
        source: 'unavailable',
        confidence: 0,
        category: null,
        knownAttributes: []
      };
    }
    const category = canon.matchProductToCategory(product);
    if (!category) {
      return {
        source: 'unmapped',
        confidence: 0,
        category: null,
        knownAttributes: []
      };
    }
    const knownAttributes = typeof canon.knownAttributesFor === 'function'
      ? canon.knownAttributesFor(category)
      : [];
    return {
      source: 'shopify-taxonomy',
      confidence: 0.9,
      category: categoryShape(category),
      knownAttributes: [...new Set((knownAttributes || []).map(String).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
    };
  }

  function normalizedKnownAttributes(context) {
    const out = new Map();
    const canon = canonicalApi();
    for (const attr of (context && context.knownAttributes || [])) {
      const normalized = canon && typeof canon.canonicalKey === 'function'
        ? canon.canonicalKey(attr)
        : attr;
      out.set(normalizeToken(attr), normalized || attr);
      out.set(normalizeToken(normalized), normalized || attr);
    }
    return out;
  }

  function normalizeFieldWithTaxonomy(field, context) {
    const rawField = String(field == null ? '' : field).trim();
    if (!rawField) {
      return { rawField, field: '', confidence: 0, rule: 'taxonomy-field:empty', source: 'unmapped' };
    }
    const known = normalizedKnownAttributes(context);
    const key = normalizeToken(rawField);
    const exact = known.get(key);
    if (exact) {
      return {
        rawField,
        field: exact,
        confidence: 0.98,
        rule: 'taxonomy-field:' + slug(exact),
        source: 'shopify-taxonomy'
      };
    }
    const canon = canonicalApi();
    const canonical = canon && typeof canon.canonicalKey === 'function' ? canon.canonicalKey(rawField) : rawField;
    const canonicalHit = known.get(normalizeToken(canonical));
    if (canonicalHit) {
      return {
        rawField,
        field: canonicalHit,
        confidence: 0.92,
        rule: 'taxonomy-field:' + slug(canonicalHit),
        source: 'shopify-taxonomy'
      };
    }
    return {
      rawField,
      field: canonical || rawField,
      confidence: 0,
      rule: 'taxonomy-field:unmapped',
      source: 'unmapped'
    };
  }

  function taxonomyPatchForProduct(product) {
    const context = categoryContextForProduct(product);
    if (!context.category) return {};
    return { _normalizationContext: context };
  }

  Object.assign(NS, {
    categoryContextForProduct,
    normalizeFieldWithTaxonomy,
    taxonomyPatchForProduct
  });
})(globalThis);
