/* =============================================================
   ShopScout — value normalization, rank computation, color hash.
   Extracted from data/cellFormatters.js (Task 11 Phase 1) as the
   grid-renderer-agnostic core. The previous file mixed these with
   Tabulator cell formatters; the formatters are gone with the rest
   of the grid layer, but the value rules and ranking logic remain
   useful to any future renderer.

   Public API on window.ShopScoutValues:
     prettify(value, options)  — display-friendly normalized string
     normalizeMeasurement(value) — canonical base value for unit-bearing values
     measurementSystemForLocale(locale) — 'us' | 'metric'
     parseNumeric(value)       — numeric sort/rank value or NaN
     stableColor(text)         — { bg, fg, border } HSL pill colors
     splitToPills(text)        — multi-value split (or null)
     computeRanks(rows, field, polarity) — annotate row._ssRanks
     polarityForField(field)   — 'low' | 'high' (LOW_IS_BEST table)
   ============================================================= */
(function initShopScoutValues(root) {
  const NS = (root.ShopScoutValues = root.ShopScoutValues || {});

  /* ---- Time ---------------------------------------------------- */
  const TIME_RE = /^(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|wks?|months?|mos?|years?|yrs?|y)\b/i;

  function normalizeTime(raw) {
    const m = String(raw).trim().match(TIME_RE);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const u = m[2].toLowerCase();
    let minutes = NaN;
    if (/^(second|sec|s)/.test(u))      minutes = n / 60;
    else if (/^(minute|min|m)/.test(u)) minutes = n;
    else if (/^(hour|hr|h)/.test(u))    minutes = n * 60;
    else if (/^(day|d)/.test(u))        return n + ' day' + (n === 1 ? '' : 's');
    else if (/^(week|wk)/.test(u))      return n + ' week' + (n === 1 ? '' : 's');
    else if (/^(month|mo)/.test(u))     return n + ' mo';
    else if (/^(year|yr|y)/.test(u))    return n + ' yr';
    if (!isFinite(minutes)) return null;
    if (minutes < 60) return Math.round(minutes) + ' min';
    const hours = minutes / 60;
    const rounded = hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10;
    return rounded + ' hr';
  }

  /* ---- Unit normalization + locale display --------------------- */
  const NUMBER = '(-?\\d+(?:[.,]\\d+)?)';
  const UNIT_RE = new RegExp('^' + NUMBER + '\\s*(mm|cm|m|km|inches|inch|in\\.?|"|ft|feet|foot|yd|yard|yards|kg|g|mg|lb|lbs|pounds?|oz|ounces?|l|liter|liters|litre|litres|ml|milliliter|milliliters|millilitre|millilitres|gal|gallon|gallons|fl\\s*oz|fluid\\s*ounces?|°c|c\\b|°f|f\\b|kpa|bar|psi|v|volt|volts|w|watt|watts|a|amp|amps|amperes?)\\b', 'i');
  const LOCAL_US_REGIONS = new Set(['US', 'LR', 'MM']);

  function decimalNumber(raw) {
    const s = String(raw || '').trim();
    const comma = s.lastIndexOf(',');
    const dot = s.lastIndexOf('.');
    if (comma > dot) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return parseFloat(s.replace(/,/g, ''));
  }

  function canonicalUnit(unit) {
    const u = String(unit || '').trim().toLowerCase().replace(/\.$/, '');
    if (u === '"' || u === 'inch' || u === 'inches') return 'in';
    if (u === 'feet' || u === 'foot') return 'ft';
    if (u === 'yard' || u === 'yards') return 'yd';
    if (u === 'lbs' || u === 'pound' || u === 'pounds') return 'lb';
    if (u === 'ounces' || u === 'ounce') return 'oz';
    if (u === 'liter' || u === 'liters' || u === 'litre' || u === 'litres') return 'l';
    if (u === 'milliliter' || u === 'milliliters' || u === 'millilitre' || u === 'millilitres') return 'ml';
    if (u === 'gallon' || u === 'gallons') return 'gal';
    if (/^(fl\s*oz|fluid\s*ounce)/.test(u)) return 'fl oz';
    if (u === 'c') return '°c';
    if (u === 'f') return '°f';
    if (u === 'volt' || u === 'volts') return 'v';
    if (u === 'watt' || u === 'watts') return 'w';
    if (u === 'amp' || u === 'amps' || u === 'ampere' || u === 'amperes') return 'a';
    return u;
  }

  function roundBase(n) {
    if (!isFinite(n)) return n;
    return Math.round(n * 100) / 100;
  }

  function normalizeMeasurement(raw) {
    const m = String(raw || '').trim().match(UNIT_RE);
    if (!m) return null;
    const n = decimalNumber(m[1]);
    const u = canonicalUnit(m[2]);
    if (!isFinite(n)) return null;

    if (u === 'mm') return { kind: 'length', baseValue: roundBase(n), baseUnit: 'mm' };
    if (u === 'cm') return { kind: 'length', baseValue: roundBase(n * 10), baseUnit: 'mm' };
    if (u === 'm')  return { kind: 'length', baseValue: roundBase(n * 1000), baseUnit: 'mm' };
    if (u === 'km') return { kind: 'length', baseValue: roundBase(n * 1000000), baseUnit: 'mm' };
    if (u === 'in') return { kind: 'length', baseValue: roundBase(n * 25.4), baseUnit: 'mm' };
    if (u === 'ft') return { kind: 'length', baseValue: roundBase(n * 304.8), baseUnit: 'mm' };
    if (u === 'yd') return { kind: 'length', baseValue: roundBase(n * 914.4), baseUnit: 'mm' };

    if (u === 'mg') return { kind: 'mass', baseValue: roundBase(n / 1000), baseUnit: 'g' };
    if (u === 'g')  return { kind: 'mass', baseValue: roundBase(n), baseUnit: 'g' };
    if (u === 'kg') return { kind: 'mass', baseValue: roundBase(n * 1000), baseUnit: 'g' };
    if (u === 'oz') return { kind: 'mass', baseValue: roundBase(n * 28.349523125), baseUnit: 'g' };
    if (u === 'lb') return { kind: 'mass', baseValue: roundBase(n * 453.59237), baseUnit: 'g' };

    if (u === 'ml')    return { kind: 'volume', baseValue: roundBase(n), baseUnit: 'ml' };
    if (u === 'l')     return { kind: 'volume', baseValue: roundBase(n * 1000), baseUnit: 'ml' };
    if (u === 'fl oz') return { kind: 'volume', baseValue: roundBase(n * 29.5735295625), baseUnit: 'ml' };
    if (u === 'gal')   return { kind: 'volume', baseValue: roundBase(n * 3785.411784), baseUnit: 'ml' };

    if (u === '°c') return { kind: 'temperature', baseValue: roundBase(n), baseUnit: '°C' };
    if (u === '°f') return { kind: 'temperature', baseValue: roundBase((n - 32) * 5 / 9), baseUnit: '°C' };

    if (u === 'kpa') return { kind: 'pressure', baseValue: roundBase(n), baseUnit: 'kPa' };
    if (u === 'bar') return { kind: 'pressure', baseValue: roundBase(n * 100), baseUnit: 'kPa' };
    if (u === 'psi') return { kind: 'pressure', baseValue: roundBase(n * 6.8947572932), baseUnit: 'kPa' };

    if (u === 'v') return { kind: 'electrical', baseValue: roundBase(n), baseUnit: 'V' };
    if (u === 'w') return { kind: 'electrical', baseValue: roundBase(n), baseUnit: 'W' };
    if (u === 'a') return { kind: 'electrical', baseValue: roundBase(n), baseUnit: 'A' };
    return null;
  }

  function localeFromOptions(options) {
    if (options && options.locale) return options.locale;
    try {
      const nav = root.navigator;
      if (nav && Array.isArray(nav.languages) && nav.languages.length) return nav.languages[0];
      if (nav && nav.language) return nav.language;
    } catch {}
    return 'en-US';
  }

  function regionFromLocale(locale) {
    const tag = String(locale || '').trim();
    if (!tag) return '';
    try {
      if (root.Intl && root.Intl.Locale) {
        const loc = new root.Intl.Locale(tag);
        if (loc.region) return String(loc.region).toUpperCase();
        if (loc.maximize) {
          const max = loc.maximize();
          if (max.region) return String(max.region).toUpperCase();
        }
      }
    } catch {}
    const parts = tag.split('-');
    return parts.length > 1 ? String(parts[parts.length - 1]).toUpperCase() : '';
  }

  function measurementSystemForLocale(locale) {
    try {
      if (root.Intl && root.Intl.Locale) {
        const loc = new root.Intl.Locale(locale || 'en-US');
        const measured = loc && /** @type {any} */ (loc).measurementSystem;
        if (measured === 'ussystem') return 'us';
        if (measured === 'metric') return 'metric';
      }
    } catch {}
    return LOCAL_US_REGIONS.has(regionFromLocale(locale)) ? 'us' : 'metric';
  }

  function formatNumber(n, digits) {
    if (!isFinite(n)) return '';
    const decimals = typeof digits === 'number' ? digits : (Math.abs(n) < 10 ? 1 : 0);
    const rounded = Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
    return String(rounded).replace(/\.0$/, '');
  }

  function formatMeasurementBase(measurement, options) {
    if (!measurement) return null;
    if (measurement.kind === 'electrical') {
      return formatNumber(measurement.baseValue, measurement.baseValue % 1 ? 1 : 0) + ' ' + measurement.baseUnit;
    }
    const system = measurementSystemForLocale(localeFromOptions(options));
    const v = measurement.baseValue;
    if (system === 'us') {
      if (measurement.kind === 'length') {
        if (v >= 1609344) return formatNumber(v / 1609344, 1) + ' mi';
        if (v >= 1828.8) return formatNumber(v / 304.8, 1) + ' ft';
        return formatNumber(v / 25.4, 1) + ' in';
      }
      if (measurement.kind === 'mass') {
        if (v >= 907.18474) return formatNumber(v / 453.59237, 1) + ' lb';
        return formatNumber(v / 28.349523125, 1) + ' oz';
      }
      if (measurement.kind === 'volume') {
        if (v >= 3785.411784) return formatNumber(v / 3785.411784, 1) + ' gal';
        return formatNumber(v / 29.5735295625, 1) + ' fl oz';
      }
      if (measurement.kind === 'temperature') return formatNumber(v * 9 / 5 + 32, 1) + ' °F';
      if (measurement.kind === 'pressure') return formatNumber(v / 6.8947572932, 1) + ' psi';
    }

    if (measurement.kind === 'length') {
      if (v >= 1000000) return formatNumber(v / 1000000, 1) + ' km';
      if (v >= 1000) return formatNumber(v / 1000, 1) + ' m';
      if (v >= 100) return formatNumber(v / 10, 1) + ' cm';
      return formatNumber(v, v % 1 ? 1 : 0) + ' mm';
    }
    if (measurement.kind === 'mass') {
      if (v >= 1000) return formatNumber(v / 1000, 1) + ' kg';
      return formatNumber(v, Math.abs(v) < 10 && v % 1 ? 1 : 0) + ' g';
    }
    if (measurement.kind === 'volume') {
      if (v >= 1000) return formatNumber(v / 1000, 1) + ' L';
      return formatNumber(v, v % 1 ? 1 : 0) + ' ml';
    }
    if (measurement.kind === 'temperature') return formatNumber(v, 1) + ' °C';
    if (measurement.kind === 'pressure') return formatNumber(v, 1) + ' kPa';
    return null;
  }

  function normalizeMetric(raw) {
    return formatMeasurementBase(normalizeMeasurement(raw), { locale: 'en-US' });
  }

  /* ---- Triple "L x W x H" dimensions in metric ----------------- */
  const DIM_RE = new RegExp('^' + NUMBER + '\\s*[x×]\\s*' + NUMBER + '\\s*[x×]\\s*' + NUMBER + '\\s*(mm|cm|m|inches|inch|in\\.?|")\\b', 'i');

  function normalizeDimensions(raw, options) {
    const m = String(raw).trim().match(DIM_RE);
    if (!m) return null;
    const u = canonicalUnit(m[4]);
    const values = [];
    for (const part of [m[1], m[2], m[3]]) {
      const parsed = normalizeMeasurement(part + ' ' + u);
      if (!parsed || parsed.kind !== 'length') return null;
      values.push(parsed);
    }
    const system = measurementSystemForLocale(localeFromOptions(options));
    if (system === 'us') {
      return values.map(v => formatNumber(v.baseValue / 25.4, 1)).join(' × ') + ' in';
    }
    return values.map(v => formatNumber(v.baseValue / 10, 1)).join(' × ') + ' cm';
  }

  /* ---- prettify (the public coercion) -------------------------- */
  function prettify(value, options) {
    if (value == null) return '';
    const s = String(value).trim();
    if (!s) return '';
    return normalizeDimensions(s, options)
        || formatMeasurementBase(normalizeMeasurement(s), options)
        || normalizeTime(s)
        || s;
  }

  /* ---- parseNumeric (sort/rank scalar) ------------------------- */
  function parseNumeric(value) {
    if (value == null || value === '') return NaN;
    if (typeof value === 'number') return value;
    const s = String(value).trim();
    const tm = s.match(TIME_RE);
    if (tm) {
      const n = parseFloat(tm[1]);
      const u = tm[2].toLowerCase();
      if (/^(second|sec|s)/.test(u)) return n / 60;
      if (/^(minute|min|m)/.test(u)) return n;
      if (/^(hour|hr|h)/.test(u))    return n * 60;
      if (/^(day|d)/.test(u))        return n * 1440;
      if (/^(week|wk)/.test(u))      return n * 10080;
      if (/^(month|mo)/.test(u))     return n * 43200;
      if (/^(year|yr|y)/.test(u))    return n * 525600;
    }
    const m = s.match(/^[-+]?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
  }

  /* ---- Stable color hash --------------------------------------- */
  function hashString(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function stableColor(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const hue = (hashString(t.toLowerCase()) * 137) % 360;
    return {
      bg: `hsl(${hue} 65% 93%)`,
      fg: `hsl(${hue} 60% 28%)`,
      border: `hsl(${hue} 50% 70%)`
    };
  }

  /* ---- Pill color palette + semantic assignment ---------------
     Pills use a fixed 7-color palette rather than hash-of-value HSL,
     so two rows never accidentally get the same color for unrelated
     values. Precedence:
       1. Value-semantic overrides (Available/Missing/Yes/No/etc.)
       2. Field-name semantic mapping (brand → blue, category → purple)
       3. Hash of field name → palette bucket (stable per column)
     A returned key of '' means no color pill (muted gray default).  */
  const PILL_COLOR_KEYS = ['blue', 'green', 'red', 'amber', 'purple', 'teal', 'slate'];

  const POSITIVE_STATUS = new Set([
    'active', 'available', 'yes', 'in stock', 'enabled', 'on', 'visible',
    'ready', 'valid', 'included', 'supported', 'passed'
  ]);
  const NEGATIVE_STATUS = new Set([
    'deactivated', 'disabled', 'missing', 'no', 'off', 'unavailable',
    'out of stock', 'failed', 'invalid', 'not included', 'not supported',
    'error', 'blocked', 'removed', 'expired'
  ]);
  const WARNING_STATUS = new Set([
    'low stock', 'limited', 'pending', 'expiring soon', 'partial',
    'warning', 'review', 'unmapped'
  ]);
  function normalizeKey(str) {
    return String(str || '').toLowerCase().replace(/^spec:/, '').replace(/[\s_-]/g, '');
  }

  function pillColorKey(field, value) {
    /* Semantic overrides — value-driven, universal across columns. */
    const val = String(value || '').trim().toLowerCase();
    if (val && POSITIVE_STATUS.has(val)) return 'green';
    if (val && NEGATIVE_STATUS.has(val)) return 'red';
    if (val && WARNING_STATUS.has(val)) return 'amber';
    /* Otherwise, no semantic key — caller falls back to
       pillFieldStyle(field) for a unique per-column HSL. Old
       behavior returned one of 7 palette buckets keyed by field
       hash which meant many columns collided on the same color. */
    return '';
  }

  /* Return a unique background/foreground/border color per FIELD so
     no two columns share a pill color. Uses the golden-angle hue
     rotation (137°) already in stableColor — different fields land
     on distinct hues. notes/description/title/name intentionally
     get null so those long-text columns stay uncolored. */
  function pillFieldStyle(field) {
    const key = normalizeKey(field);
    if (!key) return null;
    if (key === 'notes' || key === 'description' || key === 'title' || key === 'name') return null;
    return stableColor(key);
  }

  /* ---- Multi-value split (one-pill-per-part) ------------------- */
  function normalizePillPart(raw) {
    const text = String(raw || '').trim();
    if (!text) return '';
    const quantity = text.match(/^(.*?)\s*(?:x|×|\*)\s*(\d+)\s*$/i);
    if (!quantity) return text;
    const item = quantity[1].trim();
    const count = quantity[2].trim();
    if (!item || !count) return text;
    return `${item} (×${count})`;
  }

  function splitToPills(text) {
    if (text == null) return null;
    const s = String(text).trim();
    if (!s) return null;
    if (/\d\s*(x|×)\s*\d/i.test(s)) return null;
    if (/^[-+]?\d+(?:[.,]\d+)?\s*[a-z%°"]+/i.test(s)) return null;
    if (s.length > 200) return null;
    const parts = s.split(/\s*(?:,|·|•|;)\s*/).map(normalizePillPart).filter(Boolean);
    if (parts.length < 2) return null;
    for (const p of parts) {
      if (p.length === 0 || p.length > 52) return null;
      if (/\.\S/.test(p)) return null;
    }
    parts.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return parts;
  }

  /* ---- Best-in-row rank annotation ----------------------------- */
  function computeRanks(rows, field, polarity) {
    const want = polarity === 'low' ? 'low' : 'high';
    const numericValues = [];
    for (const r of (Array.isArray(rows) ? rows : [])) {
      const v = r[field];
      const n = parseNumeric(v);
      if (isFinite(n)) numericValues.push({ r, n });
    }
    if (numericValues.length < 2) return;
    const best = want === 'high'
      ? numericValues.reduce((a, b) => b.n > a.n ? b : a)
      : numericValues.reduce((a, b) => b.n < a.n ? b : a);
    const ties = numericValues.filter(x => x.n === best.n);
    if (ties.length > 1) return;
    for (const r of rows) {
      r._ssRanks = r._ssRanks || {};
      if (r === best.r) r._ssRanks[field] = 'best';
    }
  }

  const LOW_IS_BEST = new Set([
    'newPrice', 'usedPrice', 'shippingPrice', 'price',
    'Weight', 'Weight (shipping)', 'Weight (package)'
  ]);

  function polarityForField(field) {
    const k = String(field || '').replace(/^spec:/, '');
    return LOW_IS_BEST.has(k) ? 'low' : 'high';
  }

  Object.assign(NS, {
    prettify, parseNumeric, stableColor, splitToPills,
    pillColorKey, pillFieldStyle, PILL_COLOR_KEYS,
    computeRanks, polarityForField,
    /* exposed for parity with the old internals if needed */
    normalizeTime, normalizeMetric, normalizeDimensions,
    normalizeMeasurement, measurementSystemForLocale
  });
})(globalThis);
