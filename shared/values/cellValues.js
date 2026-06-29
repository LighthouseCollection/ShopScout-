/* =============================================================
   ShopScout — value normalization, rank computation, color hash.
   Extracted from data/cellFormatters.js (Task 11 Phase 1) as the
   grid-renderer-agnostic core. The previous file mixed these with
   Tabulator cell formatters; the formatters are gone with the rest
   of the grid layer, but the value rules and ranking logic remain
   useful to any future renderer.

   Public API on window.ShopScoutValues:
     prettify(value)           — display-friendly normalized string
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

  /* ---- Metric → U.S. customary --------------------------------- */
  const METRIC_RE = /^(-?\d+(?:\.\d+)?)\s*(mm|cm|m|km|kg|g|mg|°c|c\b|l|ml|kpa|bar)\b/i;

  function normalizeMetric(raw) {
    const s = String(raw).trim();
    const m = s.match(METRIC_RE);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const u = m[2].toLowerCase();
    if (u === 'mm') return round1(n / 25.4) + ' in';
    if (u === 'cm') return round1(n / 2.54) + ' in';
    if (u === 'm') {
      const feet = n * 3.28084;
      if (feet >= 1) return round1(feet) + ' ft';
      return round1(n * 39.3701) + ' in';
    }
    if (u === 'km') return round1(n * 0.621371) + ' mi';
    if (u === 'kg') return round1(n * 2.20462) + ' lb';
    if (u === 'g') {
      const oz = n * 0.035274;
      if (oz >= 1) return round1(oz) + ' oz';
      return round1(n) + ' g';
    }
    if (u === 'mg') return round1(n) + ' mg';
    if (u === 'l')  return round1(n * 0.264172) + ' gal';
    if (u === 'ml') return round1(n * 0.033814) + ' fl oz';
    if (u === '°c' || u === 'c') return round1(n * 9 / 5 + 32) + ' °F';
    if (u === 'kpa') return round1(n * 0.145038) + ' psi';
    if (u === 'bar') return round1(n * 14.5038) + ' psi';
    return null;
  }

  function round1(n) {
    if (!isFinite(n)) return n;
    return n >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  }

  /* ---- Triple "L x W x H" dimensions in metric ----------------- */
  const DIM_RE = /^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/i;

  function normalizeDimensions(raw) {
    const m = String(raw).trim().match(DIM_RE);
    if (!m) return null;
    const a = parseFloat(m[1]), b = parseFloat(m[2]), c = parseFloat(m[3]);
    const u = m[4].toLowerCase();
    const factor = u === 'mm' ? 1 / 25.4 : u === 'cm' ? 1 / 2.54 : 39.3701;
    return [a, b, c].map(v => round1(v * factor)).join(' × ') + ' in';
  }

  /* ---- prettify (the public coercion) -------------------------- */
  function prettify(value) {
    if (value == null) return '';
    const s = String(value).trim();
    if (!s) return '';
    return normalizeDimensions(s)
        || normalizeMetric(s)
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

  /* ---- Multi-value split (one-pill-per-part) ------------------- */
  function splitToPills(text) {
    if (text == null) return null;
    const s = String(text).trim();
    if (!s) return null;
    if (/\d\s*(x|×)\s*\d/i.test(s)) return null;
    if (/^[-+]?\d+(?:[.,]\d+)?\s*[a-z%°"]+/i.test(s)) return null;
    if (s.length > 200) return null;
    const parts = s.split(/\s*(?:,|·|•|;)\s*/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    for (const p of parts) {
      if (p.length === 0 || p.length > 40) return null;
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
    computeRanks, polarityForField,
    /* exposed for parity with the old internals if needed */
    normalizeTime, normalizeMetric, normalizeDimensions
  });
})(globalThis);
