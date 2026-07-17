/* =============================================================
   ShopScout — normalization review collector

   Builds a review queue from deterministic normalization provenance.
   It is intentionally read-only: approval/ignore/library-write workflows
   should be separate explicit features.
   ============================================================= */
(function initShopScoutNormalizationReview(root) {
  const NS = (root.ShopScoutNormalizationReview = root.ShopScoutNormalizationReview || {});
  const REVIEW_CONFIDENCE_THRESHOLD = 0.9;

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function categoryLeaf(product) {
    const ctx = product && product._normalizationContext;
    return text(ctx?.category?.leaf || ctx?.category?.fullName || product?.category);
  }

  function reasonFor(entry) {
    if (!entry) return '';
    if (entry.rule === 'unmapped') return 'unmapped value';
    if (entry.fieldSource === 'shopify-taxonomy') return 'taxonomy field fallback';
    if (Number(entry.confidence) < REVIEW_CONFIDENCE_THRESHOLD) return 'low confidence';
    return '';
  }

  function needsReview(entry) {
    if (!entry) return false;
    if (entry.rule === 'unmapped') return true;
    if (entry.fieldSource === 'shopify-taxonomy') return true;
    return Number(entry.confidence) < REVIEW_CONFIDENCE_THRESHOLD;
  }

  function keyPart(value) {
    return text(value).toLowerCase().replace(/\s+/g, ' ');
  }

  const IDENTIFIER_FIELDS = new Set([
    'asin',
    'sku',
    'upc',
    'ean',
    'gtin',
    'gtin8',
    'gtin 8',
    'gtin12',
    'gtin 12',
    'gtin13',
    'gtin 13',
    'gtin14',
    'gtin 14',
    'global trade identification number',
    'global trade item number',
    'mpn',
    'mfr part number',
    'manufacturer part number',
    'item part number',
    'part number',
    'model',
    'model number',
    'model no',
    'model no.',
    'item model number',
    'product model number',
    'serial number',
    'identifier',
    'product id',
    'product identifier'
  ]);

  function isIdentifierField(field) {
    return IDENTIFIER_FIELDS.has(keyPart(field));
  }

  function reviewItemKey(item) {
    return [
      item?.productId,
      item?.rawField,
      item?.field,
      item?.raw,
      item?.normalized
    ].map(keyPart).join('|');
  }

  function isListLikeFeatureField(field) {
    const key = keyPart(field);
    return key === 'additional features'
      || key === 'features'
      || key === 'special features'
      || key === 'included items'
      || key === 'compatible devices'
      || key === 'recommended use';
  }

  function splitReviewValues(field, raw, normalized) {
    if (!isListLikeFeatureField(field)) {
      return [{ field, rawField: '', raw, normalized }];
    }
    const rawParts = text(raw).split(/\s*(?:[,;|])\s*/).map(text).filter(Boolean);
    if (rawParts.length <= 1) {
      return [{ field, rawField: '', raw, normalized }];
    }
    const normalizedParts = text(normalized).split(/\s*(?:[,;|])\s*/).map(text).filter(Boolean);
    const sameShape = normalizedParts.length === rawParts.length;
    return rawParts.map((part, index) => ({
      field: sameShape ? normalizedParts[index] : part,
      rawField: part,
      raw: part,
      normalized: sameShape ? normalizedParts[index] : part
    }));
  }

  function normalizeSpecField(product, rawField) {
    const raw = text(rawField);
    if (!raw) return { field: '', fieldRule: '', fieldSource: '' };
    const taxonomy = root.ShopScoutTaxonomyNormalization;
    const context = product?._normalizationContext || null;
    if (taxonomy && typeof taxonomy.normalizeFieldWithTaxonomy === 'function') {
      const mapped = taxonomy.normalizeFieldWithTaxonomy(raw, context);
      if (mapped && mapped.field && mapped.source === 'shopify-taxonomy') {
        return { field: mapped.field, fieldRule: mapped.rule || '', fieldSource: mapped.source || '' };
      }
    }
    const canon = root.SSCanonical;
    const canonical = canon && typeof canon.canonicalKey === 'function' ? canon.canonicalKey(raw) : raw;
    return { field: canonical || raw, fieldRule: '', fieldSource: '' };
  }

  function displayFromEnvelope(envelope, raw) {
    if (envelope && envelope.display != null && envelope.display !== '—') {
      return Array.isArray(envelope.display) ? envelope.display.join(', ') : String(envelope.display);
    }
    return text(raw);
  }

  function entryFromV2(product, rawSpec) {
    if (!rawSpec || (rawSpec.key == null && rawSpec.rawField == null && rawSpec.field == null)) return null;
    const rawField = text(rawSpec.rawField || rawSpec.key || rawSpec.field);
    if (!rawField) return null;
    const mapped = normalizeSpecField(product, rawField);
    const field = text(rawSpec.field || mapped.field || rawField);
    const envelope = rawSpec.normalized || product?.specsNormalized?.[field];
    if (!envelope || typeof envelope !== 'object') return null;
    const provenance = envelope.provenance || {};
    const warnings = Array.isArray(provenance.warnings) ? provenance.warnings : [];
    const unmapped = warnings.some(warning => String(warning || '').startsWith('unmapped:'));
    return {
      field,
      rawField,
      raw: rawSpec.raw ?? rawSpec.value,
      normalized: rawSpec.display || displayFromEnvelope(envelope, rawSpec.raw ?? rawSpec.value),
      confidence: Number(provenance.confidence) || 0,
      rule: unmapped ? 'unmapped' : text((provenance.rules || [])[0] || provenance.method || ''),
      fieldRule: text(provenance.fieldRule || mapped.fieldRule || ''),
      fieldSource: text(provenance.fieldSource || mapped.fieldSource || ''),
      _review: unmapped || Number(provenance.confidence) < REVIEW_CONFIDENCE_THRESHOLD
    };
  }

  function v2Entries(product) {
    const specAccess = root.ShopScoutProductSpecAccess;
    const rawSpecs = specAccess && typeof specAccess.specEntries === 'function'
      ? specAccess.specEntries(product || {})
      : Array.isArray(product?.rawSpecs) ? product.rawSpecs : [];
    return rawSpecs.map(rawSpec => entryFromV2(product, rawSpec)).filter(Boolean);
  }

  function collectNormalizationReviewItems(products) {
    const rows = Array.isArray(products) ? products : [];
    const out = [];
    rows.forEach((product, productIndex) => {
      const attrs = v2Entries(product);
      if (!attrs.length) return;
      for (const entry of attrs) {
        const field = entry.field;
        if (isIdentifierField(field) || isIdentifierField(entry?.rawField)) continue;
        if (!entry._review && !needsReview(entry)) continue;
        const rawField = text(entry.rawField || field);
        const splitValues = splitReviewValues(field, entry.raw, entry.normalized);
        for (const value of splitValues) {
          const reviewField = text(value.field || field);
          const reviewRawField = text(value.rawField || rawField);
          const row = {
            productId: text(product.id || product.url || `product-${productIndex + 1}`),
            productIndex,
            productTitle: text(product.title || product.productName || product.listingTitle || 'Untitled product'),
            source: text(product.source || product.retailer || ''),
            category: categoryLeaf(product),
            field: reviewField,
            rawField: reviewRawField,
            raw: value.raw,
            normalized: value.normalized,
            confidence: Number(entry.confidence) || 0,
            rule: text(entry.rule || ''),
            fieldRule: text(entry.fieldRule || ''),
            fieldSource: text(entry.fieldSource || ''),
            reason: reasonFor(entry)
          };
          row.reviewKey = reviewItemKey(row);
          out.push(row);
        }
      }
    });
    const userRules = root.ShopScoutUserNormalizationRules;
    const ignored = userRules && typeof userRules.ignoredSet === 'function'
      ? userRules.ignoredSet()
      : new Set();
    const filtered = ignored.size ? out.filter(item => !ignored.has(item.reviewKey)) : out;
    filtered.sort((a, b) => a.reason.localeCompare(b.reason) || a.field.localeCompare(b.field) || a.productTitle.localeCompare(b.productTitle));
    return filtered;
  }

  Object.assign(NS, {
    REVIEW_CONFIDENCE_THRESHOLD,
    reviewItemKey,
    collectNormalizationReviewItems
  });
})(globalThis);
