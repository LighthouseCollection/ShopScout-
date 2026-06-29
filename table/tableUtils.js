(function initShopScoutTableUtils(root) {
  const NS = (root.ShopScoutTable = root.ShopScoutTable || {});

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseNumeric(value) {
    if (value == null || value === '') return -Infinity;
    if (typeof value === 'number' && isFinite(value)) return value;
    const cleaned = String(value).replace(/[^\d.-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.') return -Infinity;
    const number = Number(cleaned);
    return isFinite(number) ? number : -Infinity;
  }

  function numericSorter(a, b) {
    const an = parseNumeric(a);
    const bn = parseNumeric(b);
    if (an === bn) return 0;
    if (an === -Infinity) return -1;
    if (bn === -Infinity) return 1;
    return an - bn;
  }

  function scalarOrBlank(value) {
    if (value == null) return '';
    if (typeof value === 'object') return '';
    return String(value);
  }

  function truncate(value, maxLength) {
    const text = String(value || '');
    const limit = Math.max(1, Number(maxLength) || text.length);
    return text.length > limit ? text.slice(0, limit - 1).trimEnd() + '…' : text;
  }

  NS.utils = {
    escapeHtml,
    esc: escapeHtml,
    parseNumeric,
    numericSorter,
    scalarOrBlank,
    truncate
  };
})(globalThis);
