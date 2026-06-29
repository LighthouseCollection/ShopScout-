/* =============================================================
   ShopScout — Tabulator cell formatters + value normalization
   Shared between the Grid view (comparison-db.js) and the
   Compare panel (vertical side-by-side). Exposed on
   window.SSCellFormatters.

   What's here:
   - prettify(value, keyHint)
       Returns a display-friendly string. Time durations are
       normalized to minutes (under an hour) or hours (>= 1 hour).
       Metric measurements (mm/cm/m/km/g/kg/L/mL/°C) are converted
       to U.S. customary (in/ft/mi/oz/lb/gal/fl oz/°F).
       Returns the original string if no rule fires.
   - parseNumeric(value)
       Returns a Number for sort/rank purposes, or NaN.
   - stableColor(text)
       Deterministic HSL pill color for repeated string values.
       Same input → same color across reloads.
   - cellPill(cell), cellYesNo(cell), cellStarsVisual(cell)
       Tabulator-ready formatters.
   - computeRanks(rows, fieldName, polarity)
       Adds a Map of best/worst ranks per row to the rows
       array for use by cellWithRank.
   - cellWithRank({polarity}) factory
       Returns a formatter that prettifies the value and
       tints the cell when it's the best in the column.
   ============================================================= */
(function initCellFormatters(root) {
  /* ---- Value normalization ---------------------------------- */

  /* Time normalization. Inputs we expect from spec values:
       "180 minutes", "3.5 Hours", "24 months", "500 days",
       "1.5 hr", "90 min", "2h 30m"
     Rule: any value parsed as < 60 minutes shows "X min";
     >= 60 minutes shows "X.X hr" (one decimal, trimmed).
     Day/week/month/year values pass through with a short unit. */
  const TIME_RE = /^(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|wks?|months?|mos?|years?|yrs?|y)\b/i;
  function normalizeTime(raw) {
    const m = String(raw).trim().match(TIME_RE);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const u = m[2].toLowerCase();
    let minutes = NaN;
    if (/^(second|sec|s)/.test(u))   minutes = n / 60;
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

  /* Metric → U.S. customary. We don't bring in the full js-quantities
     library here — these conversions are simple and we want zero
     extra runtime cost on cell formatting. */
  const METRIC_RE = /^(-?\d+(?:\.\d+)?)\s*(mm|cm|m|km|kg|g|mg|°c|c\b|l|ml|kpa|bar)\b/i;
  function normalizeMetric(raw) {
    const s = String(raw).trim();
    const m = s.match(METRIC_RE);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const u = m[2].toLowerCase();
    /* Length */
    if (u === 'mm') {
      const inches = n / 25.4;
      return round1(inches) + ' in';
    }
    if (u === 'cm') {
      const inches = n / 2.54;
      return round1(inches) + ' in';
    }
    if (u === 'm') {
      const feet = n * 3.28084;
      if (feet >= 1) return round1(feet) + ' ft';
      return round1(n * 39.3701) + ' in';
    }
    if (u === 'km') return round1(n * 0.621371) + ' mi';
    /* Mass */
    if (u === 'kg') {
      const lb = n * 2.20462;
      return round1(lb) + ' lb';
    }
    if (u === 'g') {
      const oz = n * 0.035274;
      if (oz >= 1)  return round1(oz) + ' oz';
      return round1(n) + ' g';      /* sub-gram weirdness: stay metric */
    }
    if (u === 'mg') return round1(n) + ' mg';
    /* Volume */
    if (u === 'l')  return round1(n * 0.264172) + ' gal';
    if (u === 'ml') return round1(n * 0.033814) + ' fl oz';
    /* Temperature */
    if (u === '°c' || u === 'c') return round1(n * 9 / 5 + 32) + ' °F';
    /* Pressure (rarely shown but easy to do) */
    if (u === 'kpa') return round1(n * 0.145038) + ' psi';
    if (u === 'bar') return round1(n * 14.5038) + ' psi';
    return null;
  }

  function round1(n) {
    if (!isFinite(n)) return n;
    return n >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  }

  /* Triple "L x W x H" dimensions in cm or mm get each side converted. */
  const DIM_RE = /^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/i;
  function normalizeDimensions(raw) {
    const m = String(raw).trim().match(DIM_RE);
    if (!m) return null;
    const a = parseFloat(m[1]), b = parseFloat(m[2]), c = parseFloat(m[3]);
    const u = m[4].toLowerCase();
    const factor = u === 'mm' ? 1 / 25.4 : u === 'cm' ? 1 / 2.54 : 39.3701;
    return [a, b, c].map(v => round1(v * factor)).join(' × ') + ' in';
  }

  function prettify(value /*, keyHint */) {
    if (value == null) return '';
    const s = String(value).trim();
    if (!s) return '';
    return normalizeDimensions(s)
        || normalizeMetric(s)
        || normalizeTime(s)
        || s;
  }

  /* Parse leading numeric portion for sort/rank. */
  function parseNumeric(value) {
    if (value == null || value === '') return NaN;
    if (typeof value === 'number') return value;
    const s = String(value).trim();
    /* Time — convert to minutes for comparable scale */
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
    /* Plain numeric prefix */
    const m = s.match(/^[-+]?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
  }

  /* ---- Stable color hash for pills -------------------------- */

  /* djb2 hash → mapped onto a fixed 24-step hue wheel so the same
     value always gets the same color across reloads, and the wheel
     is wide enough that two visually-distinct values (e.g. Black vs
     Brown) get visually-distinct pills. */
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

  /* ---- Tabulator formatters --------------------------------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* (Removed: brand-monogram source badge experiment. Source is now
     rendered as a stable-color text pill via cellSourcePill in
     comparison-db.js, which uses stableColor() above.) */

  /* Split a string into individual pill candidates. We split on comma
     (most common multi-value separator: "App Control, Voice Control")
     and on the bullet glyph used in some Amazon detail bullets. We
     intentionally do NOT split on " / " or " | " or " x " because those
     appear in single-concept strings (Wi-Fi 6/6E, AC/DC, dimensions
     "15 x 10 x 2 in").

     Returns null if the value should render as a single pill /
     plain text (no useful split). */
  function splitToPills(text) {
    if (text == null) return null;
    const s = String(text).trim();
    if (!s) return null;
    /* Numbers / units / dimensions / model numbers — never split. */
    if (/\d\s*(x|×)\s*\d/i.test(s)) return null;             /* "15 x 10 x 2 in" */
    if (/^[-+]?\d+(?:[.,]\d+)?\s*[a-z%°"]+/i.test(s)) return null; /* "120 volts" */
    if (s.length > 200) return null;                          /* paragraph */
    /* Split on comma OR " · " bullet OR " • " bullet. */
    const parts = s.split(/\s*(?:,|·|•|;)\s*/)
      .map(p => p.trim())
      .filter(Boolean);
    if (parts.length < 2) return null;
    /* Every part has to be a reasonable pill label. If any part looks
       like a sentence (>40 chars or contains a period mid-string), bail. */
    for (const p of parts) {
      if (p.length === 0 || p.length > 40) return null;
      if (/\.\S/.test(p)) return null;   /* "Hello.World" → likely sentence */
    }
    /* Alphabetical so the same set of values reads identically across
       rows ("App Control, Voice Control" and "Voice Control, App Control"
       both render as "App Control · Voice Control"). Case-insensitive
       + locale-aware so "iPad" and "iPhone" sort sensibly. */
    parts.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return parts;
  }

  /* Render a value as one or more colored pills. Multi-part values
     get one pill per part; single values get one pill. Numeric-looking
     values fall through to plain text (callers right-align them). */
  function renderValueAsPills(text, opts) {
    const o = opts || {};
    if (text == null || text === '') return '<span class="db-cell-empty">&mdash;</span>';
    const s = String(text).trim();
    if (!s) return '<span class="db-cell-empty">&mdash;</span>';
    /* Don't pill obvious numerics — leaves room for the right-aligned
       monospace styling and best-in-row tint to read cleanly. */
    if (isFinite(parseNumeric(s)) && /^[-+]?\d+(?:[.,]\d+)?\s*[a-z%°"]*\s*$/i.test(s)) {
      return '<span class="ss-cell-val">' + esc(s) + '</span>';
    }
    const parts = splitToPills(s);
    function pillHtml(p) {
      const c = stableColor(p);
      const style = c ? ' style="background:' + c.bg + ';color:' + c.fg + ';border-color:' + c.border + '"' : '';
      return '<span class="ss-pill"' + style + '>' + esc(p) + '</span>';
    }
    if (parts) {
      return '<span class="ss-pill-row">' + parts.map(pillHtml).join('') + '</span>';
    }
    /* Single value: pill it if reasonably short, otherwise plain. */
    if (s.length <= 40) return pillHtml(s);
    return esc(s);
  }

  /* Generic pill — routes through renderValueAsPills so multi-value
     cells split into one pill per part. */
  function cellPill(cell) {
    const v = cell.getValue();
    return renderValueAsPills(v);
  }

  /* Yes/No / true/false → green or pink soft pill. Any other text
     falls through to plain rendering so we don't accidentally pill
     unrelated values. */
  const YES_RE = /^(yes|true|y|1|included|on|available)$/i;
  const NO_RE  = /^(no|false|n|0|not\s*included|none|off|unavailable)$/i;
  function cellYesNo(cell) {
    const v = cell.getValue();
    if (v == null || v === '') return '<span class="db-cell-empty">&mdash;</span>';
    const s = String(v).trim();
    if (YES_RE.test(s)) return '<span class="ss-pill ss-pill-yes">' + esc(s) + '</span>';
    if (NO_RE.test(s))  return '<span class="ss-pill ss-pill-no">'  + esc(s) + '</span>';
    return esc(s);
  }

  /* Defensive unwrap — delegates to SS.unwrapWrappedValue when
     utils.js is loaded; falls back to a minimal local version when
     not (e.g. ai-providers context). */
  function _unwrap(v) {
    if (root.SS && root.SS.unwrapWrappedValue) return root.SS.unwrapWrappedValue(v);
    if (v == null) return '';
    if (typeof v === 'object') return v.value || v.canonicalValue || v.rawValue || '';
    const s = String(v);
    return s === '[object Object]' ? '' : s;
  }

  /* Visual five-star rating. A filled half-row sits over the
     empty row and is clipped to the fractional width. */
  function cellStarsVisual(cell) {
    const raw = cell.getValue();
    const v = _unwrap(raw);
    if (!v) return '<span class="db-cell-empty">&mdash;</span>';
    const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
    if (!isFinite(n)) return '<span class="db-cell-empty">&mdash;</span>';
    const pct = Math.max(0, Math.min(100, (n / 5) * 100));
    const row = cell.getRow().getData();
    const cntRaw = _unwrap(row.reviewCount);
    const cntNum = parseInt(String(cntRaw || '').replace(/[^\d]/g, ''), 10);
    const cntStr = (isFinite(cntNum) && cntNum > 0)
      ? '<div class="ss-stars-meta">' + n.toFixed(1) + ' &middot; ' + cntNum.toLocaleString() + '</div>'
      : '<div class="ss-stars-meta">' + n.toFixed(1) + '</div>';
    return ''
      + '<div class="ss-stars" title="' + esc(n.toFixed(1) + ' of 5') + '">'
      +   '<div class="ss-stars-row">'
      +     '<span class="ss-stars-empty">★★★★★</span>'
      +     '<span class="ss-stars-fill" style="width:' + pct + '%">★★★★★</span>'
      +   '</div>'
      +   cntStr
      + '</div>';
  }

  /* ---- Best-in-row ranking ---------------------------------- */

  /* Compute the best (and worst) numeric value across `rows[].field`,
     attach a Map `_ssRanks` to each row mapping field → 'best' | 'worst' | ''.
     `polarity` is 'high' (higher is better) or 'low' (lower is better).
     Skips ties — if two rows share the best value, neither gets the
     highlight (avoids meaningless ties on yes/no specs). */
  function computeRanks(rows, field, polarity) {
    const want = polarity === 'low' ? 'low' : 'high';
    const numericValues = [];
    for (const r of rows) {
      const v = r[field];
      const n = parseNumeric(v);
      if (isFinite(n)) numericValues.push({ r, n });
    }
    if (numericValues.length < 2) return;
    let best = want === 'high'
      ? numericValues.reduce((a, b) => b.n > a.n ? b : a)
      : numericValues.reduce((a, b) => b.n < a.n ? b : a);
    /* Skip if best is tied with another row */
    const ties = numericValues.filter(x => x.n === best.n);
    if (ties.length > 1) return;
    for (const r of rows) {
      r._ssRanks = r._ssRanks || {};
      if (r === best.r) r._ssRanks[field] = 'best';
    }
  }

  /* Direction hint by canonical key. Anything not listed defaults
     to 'high' (e.g. battery life, speed, capacity) which is the
     right call for the majority of product specs. */
  const LOW_IS_BEST = new Set([
    'newPrice', 'usedPrice', 'shippingPrice', 'price',
    'Weight', 'Weight (shipping)', 'Weight (package)'
  ]);

  function polarityForField(field) {
    /* Strip the "spec:" prefix used in the grid. */
    const k = String(field || '').replace(/^spec:/, '');
    return LOW_IS_BEST.has(k) ? 'low' : 'high';
  }

  /* Factory: returns a formatter that prettifies the value AND
     reads _ssRanks to tint the cell when best. Pass opts.align
     to right-align numeric columns. */
  function cellWithRank(opts) {
    const o = opts || {};
    const field = o.field || '';
    return function(cell) {
      let v = cell.getValue();
      if (v == null || v === '') return '<span class="db-cell-empty">&mdash;</span>';
      if (typeof v === 'object') v = v.canonicalValue || v.value || v.rawValue || '';
      const s = String(v);
      if (!v || s === '[object Object]') return '<span class="db-cell-empty">&mdash;</span>';
      const text = prettify(v);
      const row  = cell.getRow().getData();
      const rank = row._ssRanks && row._ssRanks[field];
      const cls  = rank === 'best' ? ' ss-best-in-row' : '';
      /* Route through the unified pill renderer:
           - Numeric value  → plain right-aligned text
           - Comma-separated multi-value → one pill per part
           - Single short string → one pill */
      const inner = renderValueAsPills(text);
      /* Wrap in the rank tint when applicable. */
      return cls ? '<span class="' + cls.trim() + '">' + inner + '</span>' : inner;
    };
  }

  /* Detect whether a spec key looks like a Yes/No column based on
     the values we see in the rows. Used at column-build time. */
  function isYesNoField(rows, field) {
    let hits = 0, total = 0;
    for (const r of rows) {
      const v = r[field];
      if (v == null || v === '') continue;
      total++;
      const s = String(v).trim();
      if (YES_RE.test(s) || NO_RE.test(s)) hits++;
    }
    return total >= 2 && hits / total >= 0.8;
  }

  /* Detect numeric spec — for right-align and rank polarity. */
  function isNumericField(rows, field) {
    let hits = 0, total = 0;
    for (const r of rows) {
      const v = r[field];
      if (v == null || v === '') continue;
      total++;
      if (isFinite(parseNumeric(v))) hits++;
    }
    return total >= 2 && hits / total >= 0.7;
  }

  /* Match a filter expression against a cell's raw text. Supports
     operators (`>100`, `<50`, `>=10`, `<=20`, `=15`), ranges
     (`10-20`), and falls back to a case-insensitive substring match.
     Shared by the Tabulator grid filter and the inverted-view
     row-filter so the operator semantics are identical. */
  function matchOperatorFilter(filt, value) {
    const f = String(filt || '').trim();
    if (!f) return true;
    const num = parseNumeric(value);
    /* Range A-B (whitespace tolerated) */
    const range = f.match(/^\s*(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (range) {
      if (!isFinite(num)) return false;
      const lo = Math.min(+range[1], +range[2]);
      const hi = Math.max(+range[1], +range[2]);
      return num >= lo && num <= hi;
    }
    /* Comparison operators */
    const op = f.match(/^\s*(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (op) {
      if (!isFinite(num)) return false;
      const n = +op[2];
      switch (op[1]) {
        case '>=': return num >= n;
        case '<=': return num <= n;
        case '>':  return num >  n;
        case '<':  return num <  n;
        case '=':  return num === n;
      }
    }
    /* Plain number — exact match if cell parses numerically; otherwise
       fall through to substring. */
    if (/^-?\d+(?:\.\d+)?$/.test(f) && isFinite(num)) {
      return num === Number(f);
    }
    return String(value == null ? '' : value).toLowerCase().includes(f.toLowerCase());
  }

  root.SSCellFormatters = {
    prettify, parseNumeric, stableColor,
    cellPill, cellYesNo, cellStarsVisual,
    computeRanks, cellWithRank,
    polarityForField,
    isYesNoField, isNumericField,
    renderValueAsPills, splitToPills,
    matchOperatorFilter
  };
})(globalThis);
