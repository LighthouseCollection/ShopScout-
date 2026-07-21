/* =============================================================
   ShopScout — value normalization, rank computation, color hash.
   Extracted from data/cellFormatters.js (Task 11 Phase 1) as the
   grid-renderer-agnostic core. The previous file mixed these with
   Tabulator cell formatters; the formatters are gone with the rest
   of the grid layer, but the value rules and ranking logic remain
   useful to any future renderer.

   Public API on window.ShopScoutValues:
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
    return ensureReadableStyle({
      bg: `hsl(${hue} 65% 93%)`,
      fg: `hsl(${hue} 60% 28%)`,
      border: `hsl(${hue} 50% 70%)`
    });
  }

  function hslToRgb(color) {
    const m = String(color || '').match(/^hsl\(([-\d.]+)\s+([-\d.]+)%\s+([-\d.]+)%\)$/);
    if (!m) return null;
    let h = Number(m[1]) % 360;
    if (h < 0) h += 360;
    const s = Number(m[2]) / 100;
    const l = Number(m[3]) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const z = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [r + z, g + z, b + z].map(v => Math.round(v * 255));
  }

  function relativeLuminance(rgb) {
    return rgb.map(v => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  }

  function contrastRatio(a, b) {
    const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  }

  function ensureReadableStyle(style) {
    const bg = hslToRgb(style && style.bg);
    const fg = hslToRgb(style && style.fg);
    if (!bg || !fg || contrastRatio(bg, fg) >= 4.5) return style;
    return Object.assign({}, style, { fg: 'hsl(210 35% 18%)' });
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
    const quantity = text.match(/^(.*?)(?:\s+x\s+|(?:×|\*)\s*)(\d+)\s*$/i);
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
    if (s.length > 2000) return null;
    const parts = s.split(/\s*(?:,|·|•|;)\s*/).map(normalizePillPart).filter(Boolean);
    if (parts.length < 2) return null;
    for (const p of parts) {
      if (p.length === 0 || p.length > 120) return null;
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

  /* prettify / normalizeMeasurement / normalizeMetric / normalizeDimensions
     were the v1 unit-conversion path. Superseded by
     ShopScoutNormalize.field() (normalization/normalize.js) which reads a
     typed field registry and returns a {raw, canonical, unit, display,
     provenance} envelope per value. No production code called these
     functions; the only test was tests/local-units.test.js which has
     been retired. Not re-exported so nothing new can pick them up. */
  Object.assign(NS, {
    parseNumeric, stableColor, splitToPills,
    pillColorKey, pillFieldStyle, PILL_COLOR_KEYS,
    computeRanks, polarityForField,
    /* Still exposed -- used by cell renderers for time/duration display: */
    normalizeTime,
  });
})(globalThis);
