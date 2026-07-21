/* =============================================================
   ShopScout — data-rate normalizer (normalization v2)

   Handles fields such as Data Transfer Rate where source pages
   serialize units as "gigabits_per_second" or "megabits per second".
   js-quantities intentionally does not own information/time units
   in this app, so this normalizer standardizes rate labels without
   forcing every value into one display scale.
   ============================================================= */
(function initShopScoutDataRateNormalizer(root) {
  const NS = (root.ShopScoutDataRateNormalizer = root.ShopScoutDataRateNormalizer || {});

  const UNIT_ALIASES = {
    'bits per second': 'bps',
    'bit per second': 'bps',
    'bps': 'bps',
    'kilobits per second': 'Kbps',
    'kilobit per second': 'Kbps',
    'kbps': 'Kbps',
    'kbit/s': 'Kbps',
    'megabits per second': 'Mbps',
    'megabit per second': 'Mbps',
    'mbps': 'Mbps',
    'mbit/s': 'Mbps',
    'mb/s': 'Mbps',
    'gigabits per second': 'Gbps',
    'gigabit per second': 'Gbps',
    'gbps': 'Gbps',
    'gbit/s': 'Gbps',
    'gb/s': 'Gbps',
    'terabits per second': 'Tbps',
    'terabit per second': 'Tbps',
    'tbps': 'Tbps',
    'tbit/s': 'Tbps',
    'bytes per second': 'Bps',
    'byte per second': 'Bps',
    'b/s': 'Bps',
    'kilobytes per second': 'KBps',
    'kilobyte per second': 'KBps',
    'kb/s': 'KBps',
    'megabytes per second': 'MBps',
    'megabyte per second': 'MBps',
    'mb/sec': 'MBps',
    'gigabytes per second': 'GBps',
    'gigabyte per second': 'GBps',
    'gb/sec': 'GBps',
  };

  function cleanRateUnit(unit) {
    return String(unit || '')
      .replace(/_+/g, ' ')
      .replace(/\s*\/\s*/g, '/')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function round(value, precision) {
    const p = Math.pow(10, Math.max(0, precision | 0));
    return Math.round(value * p) / p;
  }

  function normalize(rawValue, config) {
    if (rawValue == null || rawValue === '') {
      return {
        raw: rawValue == null ? null : '',
        canonical: null,
        unit: null,
        display: '—',
        provenance: { method: 'data-rate.empty', confidence: 0, warnings: ['empty_input'] },
      };
    }
    const raw = String(rawValue);
    const cleaned = raw.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
    const match = cleaned.match(/^\s*(-?[\d,]+(?:\.\d+)?)\s*(.+?)\s*$/);
    if (!match) {
      return {
        raw,
        canonical: null,
        unit: null,
        display: cleaned || raw,
        provenance: { method: 'data-rate.parse', confidence: 0, warnings: ['unparseable_rate'] },
      };
    }
    const value = Number(match[1].replace(/,/g, ''));
    const unitKey = cleanRateUnit(match[2]);
    const unit = UNIT_ALIASES[unitKey];
    if (!isFinite(value) || !unit) {
      return {
        raw,
        canonical: null,
        unit: null,
        display: cleaned,
        provenance: { method: 'data-rate.parse', confidence: 0, warnings: ['unknown_rate_unit:' + unitKey] },
      };
    }
    const scalar = round(value, config?.precision ?? 2);
    return {
      raw,
      canonical: scalar,
      unit,
      display: `${scalar} ${unit}`,
      provenance: {
        method: 'data-rate.parse',
        confidence: unitKey === match[2] ? 1 : 0.9,
        warnings: unitKey === match[2] ? [] : ['unit_token_cleaned'],
      },
    };
  }

  Object.assign(NS, {
    version: 2,
    normalize,
    _cleanRateUnit: cleanRateUnit,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
