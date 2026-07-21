/* =============================================================
   ShopScout — dimensions normalizer (normalization v2)

   Normalizes compound physical dimensions to a consistent
   "L × W × H unit" display. It accepts common shopping-site forms:
   "1.96 x 0.87 x 0.5inches", "6.0\"L x 17.0\"W x 1.5\"H",
   and centimeter/millimeter variants when js-quantities is loaded.
   ============================================================= */
(function initShopScoutDimensionsNormalizer(root) {
  const NS = (root.ShopScoutDimensionsNormalizer = root.ShopScoutDimensionsNormalizer || {});

  const UNIT_ALIASES = {
    '"': 'in',
    '”': 'in',
    'inches': 'in',
    'inch': 'in',
    'in': 'in',
    'centimeters': 'cm',
    'centimeter': 'cm',
    'centimetres': 'cm',
    'centimetre': 'cm',
    'cm': 'cm',
    'millimeters': 'mm',
    'millimeter': 'mm',
    'millimetres': 'mm',
    'millimetre': 'mm',
    'mm': 'mm',
    'meters': 'm',
    'meter': 'm',
    'metres': 'm',
    'metre': 'm',
    'm': 'm',
  };

  function round(value, precision) {
    const p = Math.pow(10, Math.max(0, precision | 0));
    return Math.round(value * p) / p;
  }

  function trimZeros(value) {
    return String(value).replace(/(\.\d*?)0+$/, '$1').replace(/\.0$/, '');
  }

  function unitAlias(rawUnit) {
    const key = String(rawUnit || '').trim().toLowerCase();
    return UNIT_ALIASES[key] || '';
  }

  function parse(raw) {
    let s = String(raw || '')
      .replace(/[×X]/g, 'x')
      .replace(/["“”]/g, ' " ')
      .replace(/\b([lwhd])\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const defaultUnitMatch = s.match(/(?:^|[^a-z])("|inches\b|inch\b|in\b|cm\b|mm\b|meters?\b|metres?\b|m\b)/i);
    const defaultUnit = unitAlias(defaultUnitMatch ? defaultUnitMatch[1] : '');
    const axisPattern = /(-?[\d,]+(?:\.\d+)?)\s*("|inches|inch|in|cm|mm|meters?|metres?|m)?/gi;
    const axes = [];
    let m;
    while ((m = axisPattern.exec(s)) && axes.length < 3) {
      const value = Number(String(m[1]).replace(/,/g, ''));
      if (!isFinite(value)) continue;
      const unit = unitAlias(m[2]) || defaultUnit;
      axes.push({ value, unit });
    }
    if (axes.length < 2 || !axes.every(axis => axis.unit)) return null;
    return axes;
  }

  function convertAxis(axis, targetUnit, precision) {
    if (axis.unit === targetUnit) return round(axis.value, precision);
    if (!root.Qty) return null;
    try {
      return round(root.Qty(`${axis.value} ${axis.unit}`).to(targetUnit).scalar, precision);
    } catch {
      return null;
    }
  }

  function normalize(rawValue, config) {
    if (rawValue == null || rawValue === '') {
      return {
        raw: rawValue == null ? null : '',
        canonical: null,
        unit: null,
        display: '—',
        provenance: { method: 'dimensions.empty', confidence: 0, warnings: ['empty_input'] },
      };
    }
    const raw = String(rawValue);
    const targetUnit = config?.canonicalUnit || 'in';
    const precision = config?.precision ?? 2;
    const axes = parse(raw);
    if (!axes) {
      return {
        raw,
        canonical: null,
        unit: null,
        display: raw.replace(/\s+/g, ' ').trim(),
        provenance: { method: 'dimensions.parse', confidence: 0, warnings: ['unparseable_dimensions'] },
      };
    }
    const converted = axes.slice(0, 3).map(axis => convertAxis(axis, targetUnit, precision));
    if (converted.some(value => value == null || !isFinite(value))) {
      return {
        raw,
        canonical: null,
        unit: null,
        display: raw.replace(/\s+/g, ' ').trim(),
        provenance: { method: 'dimensions.convert-fail', confidence: 0, warnings: ['convert_fail'] },
      };
    }
    return {
      raw,
      canonical: converted,
      unit: targetUnit,
      display: `${converted.map(trimZeros).join(' × ')} ${targetUnit}`,
      provenance: {
        method: 'dimensions.parse-convert',
        confidence: axes.every(axis => axis.unit === targetUnit) ? 1 : 0.85,
        warnings: axes.every(axis => axis.unit === targetUnit) ? [] : ['unit_converted'],
      },
    };
  }

  Object.assign(NS, {
    version: 2,
    normalize,
    _parse: parse,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
