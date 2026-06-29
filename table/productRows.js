(function initShopScoutProductRows(root) {
  const NS = (root.ShopScoutTable = root.ShopScoutTable || {});
  const utils = NS.utils || {};

  const PIVOT_FIELDS = [
    'source', 'brand', 'manufacturer', 'category', 'sellerName', 'availability',
    'modelName', 'modelNumber', 'sku', 'asin', 'upc', 'mpn', 'gtin'
  ];
  const PIVOT_NUMERIC = ['newPrice', 'usedPrice', 'shippingPrice', 'rating', 'reviewCount'];

  function flattenSpecs(rows, options) {
    const scope = options && options.root || root;
    const canon = scope.SSCanonical || root.SSCanonical;
    const canonKey = canon && canon.canonicalKey
      ? (key) => canon.canonicalKey(key)
      : (key) => String(key || '').trim();
    const SH = scope.SSSpecHeuristic || root.SSSpecHeuristic;
    const CF = scope.SSCellFormatters || root.SSCellFormatters;
    const flattened = (Array.isArray(rows) ? rows : []).map(product => {
      const flat = Object.assign({}, product);
      const list = SH && SH.specListOf ? SH.specListOf(product) : (Array.isArray(product.specs) ? product.specs : []);
      const seen = new Set();
      for (const spec of list) {
        if (!spec || spec.key == null) continue;
        const key = canonKey(spec.key);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        flat['spec:' + key] = spec.value == null ? '' : String(spec.value);
      }
      return flat;
    });
    if (CF && CF.computeRanks) {
      CF.computeRanks(flattened, 'newPrice', 'low');
      CF.computeRanks(flattened, 'rating', 'high');
    }
    return flattened;
  }

  function flattenForPivot(rows) {
    const scalarOrBlank = utils.scalarOrBlank || (value => {
      if (value == null) return '';
      if (typeof value === 'object') return '';
      return String(value);
    });
    return (Array.isArray(rows) ? rows : []).map(row => {
      const out = {};
      for (const field of PIVOT_FIELDS) out[field] = scalarOrBlank(row[field]);
      for (const field of PIVOT_NUMERIC) {
        const number = Number(String(row[field] || '').replace(/[^\d.-]/g, ''));
        out[field] = isFinite(number) ? number : 0;
      }
      out.specsCount = Array.isArray(row.specs) ? row.specs.length : 0;
      out.bulletsCount = Array.isArray(row.bullets) ? row.bullets.length : 0;
      out.capturedYear = row.capturedAt ? new Date(Number(row.capturedAt)).getUTCFullYear() : '';
      return out;
    });
  }

  NS.productRows = {
    PIVOT_FIELDS: PIVOT_FIELDS.slice(),
    PIVOT_NUMERIC: PIVOT_NUMERIC.slice(),
    flattenSpecs,
    flattenForPivot
  };
})(globalThis);
