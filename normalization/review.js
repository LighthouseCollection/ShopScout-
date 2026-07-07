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

  function reviewItemKey(item) {
    return [
      item?.productId,
      item?.rawField,
      item?.field,
      item?.raw,
      item?.normalized
    ].map(keyPart).join('|');
  }

  function collectNormalizationReviewItems(products) {
    const rows = Array.isArray(products) ? products : [];
    const out = [];
    rows.forEach((product, productIndex) => {
      const attrs = product && product._normalizedAttributes;
      if (!attrs || typeof attrs !== 'object') return;
      for (const [field, entry] of Object.entries(attrs)) {
        if (!needsReview(entry)) continue;
        const row = {
          productId: text(product.id || product.url || `product-${productIndex + 1}`),
          productIndex,
          productTitle: text(product.title || product.productName || product.listingTitle || 'Untitled product'),
          source: text(product.source || product.retailer || ''),
          category: categoryLeaf(product),
          field,
          rawField: text(entry.rawField || field),
          raw: text(entry.raw),
          normalized: text(entry.normalized),
          confidence: Number(entry.confidence) || 0,
          rule: text(entry.rule || ''),
          fieldRule: text(entry.fieldRule || ''),
          fieldSource: text(entry.fieldSource || ''),
          reason: reasonFor(entry)
        };
        row.reviewKey = reviewItemKey(row);
        out.push(row);
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
