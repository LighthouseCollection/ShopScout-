/* =============================================================
   ShopScout — brand and retailer alias helpers

   Normalization rules for identity names are separate from product
   attribute enum rules because they are used by duplicate matching,
   source display, and retailer inference rather than spec filtering.
   ============================================================= */
(function initShopScoutIdentityAliases(root) {
  const NS = (root.ShopScoutIdentityAliases = root.ShopScoutIdentityAliases || {});

  function clean(value) {
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function titleCase(value) {
    return String(value || '').replace(/\b\w/g, ch => ch.toUpperCase());
  }

  function rules() {
    return root.ShopScoutNormalizationRules || {};
  }

  function buildLookup(table) {
    const lookup = new Map();
    for (const [canonical, aliases] of Object.entries(table || {})) {
      lookup.set(clean(canonical), canonical);
      for (const alias of aliases || []) lookup.set(clean(alias), canonical);
    }
    return lookup;
  }

  function canonicalBrand(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    const lookup = buildLookup(rules().brandAliases || {});
    return lookup.get(clean(raw)) || raw;
  }

  function canonicalRetailer(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    const lookup = buildLookup(rules().retailerAliases || {});
    return lookup.get(clean(raw)) || raw;
  }

  function retailerFromUrl(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    let host = '';
    try {
      if (typeof root.URL === 'function') {
        host = new root.URL(raw, root.location?.href || 'https://example.test/').hostname;
      } else {
        const match = raw.match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?([^/?#]+)/i);
        host = match ? match[1] : '';
      }
      host = host.toLowerCase().replace(/^www\./, '');
    } catch {
      return '';
    }
    const hostAliases = rules().retailerHostAliases || {};
    for (const [needle, canonical] of Object.entries(hostAliases)) {
      if (host.includes(String(needle).toLowerCase())) return canonical;
    }
    const parts = host.split('.').filter(Boolean);
    const base = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    return base ? titleCase(base.replace(/[-_]+/g, ' ')) : '';
  }

  function canonicalRetailerFromSource(value, url) {
    const byUrl = retailerFromUrl(url);
    if (byUrl) return byUrl;
    return canonicalRetailer(value);
  }

  Object.assign(NS, {
    version: 1,
    canonicalBrand,
    canonicalRetailer,
    canonicalRetailerFromSource,
    retailerFromUrl,
    _clean: clean
  });
})(globalThis);
