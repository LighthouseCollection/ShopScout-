/* =============================================================
   SlickGrid cell formatters for the Phase 2 grid.
   Signature: function(row, cell, value, columnDef, rowData) → string
   (HTML or text — SlickGrid renders the return as innerHTML, so we
   ALWAYS escape user-controlled content through SS.esc / SS.escAttr
   and route sanitized URLs through ShopScoutSanitize.sanitizeUrl.)

   Formatters are deliberately small and composable. The renderer
   maps a projection column's `kind`/`field` to a formatter; the
   formatter never reaches back into projection or repo internals.
   ============================================================= */
(function initGridFormatters(root) {
  const NS = (root.ShopScoutGridFormatters = root.ShopScoutGridFormatters || {});
  const Values = root.ShopScoutValues || null;
  const Sanitize = root.ShopScoutSanitize || null;
  const SS = root.SS || null;

  function esc(value) {
    if (Sanitize && typeof Sanitize.escapeHtml === 'function') return Sanitize.escapeHtml(value);
    if (SS && typeof SS.esc === 'function') return SS.esc(value);
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escAttr(value) {
    if (Sanitize && typeof Sanitize.escapeAttribute === 'function') return Sanitize.escapeAttribute(value);
    if (SS && typeof SS.escAttr === 'function') return SS.escAttr(value);
    return esc(value).replace(/'/g, '&#39;');
  }
  function safeUrl(value) {
    if (Sanitize && typeof Sanitize.sanitizeUrl === 'function') return Sanitize.sanitizeUrl(value);
    if (SS && typeof SS.sanitizeUrl === 'function') return SS.sanitizeUrl(value);
    return '';
  }

  /* ---- Plain text ---------------------------------------------- */
  function text(_row, _cell, value) {
    if (value == null || value === '') return '<span class="sg-cell-empty">&mdash;</span>';
    return esc(value);
  }

  /* ---- Prettified text (units / time / dimensions) ------------- */
  function pretty(_row, _cell, value) {
    if (value == null || value === '') return '<span class="sg-cell-empty">&mdash;</span>';
    const out = Values && typeof Values.prettify === 'function' ? Values.prettify(value) : String(value);
    return esc(out);
  }

  /* ---- Thumbnail ----------------------------------------------- */
  function thumbnail(_row, _cell, value) {
    const url = safeUrl(value);
    if (!url) return '<span class="sg-thumb sg-thumb--empty"></span>';
    return '<span class="sg-thumb"><img src="' + escAttr(url) + '" alt="" loading="lazy"></span>';
  }

  /* ---- Title with optional product link ------------------------ */
  function productTitle(_row, _cell, value, _col, rowData) {
    const titleHtml = esc(value || 'Untitled product');
    const url = safeUrl(rowData && rowData.url);
    if (!url) return '<div class="sg-title">' + titleHtml + '</div>';
    return '<div class="sg-title"><a href="' + escAttr(url)
      + '" target="_blank" rel="noopener">' + titleHtml + '</a></div>';
  }

  /* ---- Stable-color pill (brand, source) ----------------------- */
  function pill(_row, _cell, value) {
    if (value == null || value === '') return '<span class="sg-cell-empty">&mdash;</span>';
    const s = String(value);
    const color = Values && typeof Values.stableColor === 'function' ? Values.stableColor(s) : null;
    if (!color) return '<span class="sg-pill">' + esc(s) + '</span>';
    const style = 'background:' + color.bg + ';color:' + color.fg + ';border-color:' + color.border;
    return '<span class="sg-pill" style="' + escAttr(style) + '">' + esc(s) + '</span>';
  }

  /* ---- Multi-value pills (split by comma/bullet) --------------- */
  function multiPill(_row, _cell, value) {
    if (value == null || value === '') return '<span class="sg-cell-empty">&mdash;</span>';
    const parts = Values && typeof Values.splitToPills === 'function' ? Values.splitToPills(value) : null;
    if (!parts) return pill(null, null, value);
    const out = parts.map(p => {
      const color = Values && typeof Values.stableColor === 'function' ? Values.stableColor(p) : null;
      const style = color ? ('background:' + color.bg + ';color:' + color.fg + ';border-color:' + color.border) : '';
      return '<span class="sg-pill" style="' + escAttr(style) + '">' + esc(p) + '</span>';
    }).join('');
    return '<span class="sg-pill-row">' + out + '</span>';
  }

  /* ---- Price ($ + 2dp + monospace) ----------------------------- */
  function price(_row, _cell, value) {
    if (value == null || value === '') return '<span class="sg-cell-empty">&mdash;</span>';
    const num = Values && typeof Values.parseNumeric === 'function' ? Values.parseNumeric(value) : Number(String(value).replace(/[^\d.-]/g, ''));
    if (!isFinite(num)) return esc(value);
    return '<span class="sg-price">$' + num.toFixed(2) + '</span>';
  }

  /* ---- Stars (visual 5-star + numeric) ------------------------- */
  function stars(_row, _cell, value, _col, rowData) {
    if (value == null || value === '') return '<span class="sg-cell-empty">&mdash;</span>';
    const num = parseFloat(String(value).replace(/[^\d.]/g, ''));
    if (!isFinite(num)) return '<span class="sg-cell-empty">&mdash;</span>';
    const pct = Math.max(0, Math.min(100, (num / 5) * 100));
    const reviewCount = rowData && rowData.reviewCount;
    const countNum = parseInt(String(reviewCount || '').replace(/[^\d]/g, ''), 10);
    const sub = isFinite(countNum) && countNum > 0
      ? num.toFixed(1) + ' · ' + countNum.toLocaleString()
      : num.toFixed(1);
    return ''
      + '<div class="sg-stars" title="' + escAttr(num.toFixed(1) + ' of 5') + '">'
      +   '<div class="sg-stars-row">'
      +     '<span class="sg-stars-empty">★★★★★</span>'
      +     '<span class="sg-stars-fill" style="width:' + pct + '%">★★★★★</span>'
      +   '</div>'
      +   '<div class="sg-stars-sub">' + esc(sub) + '</div>'
      + '</div>';
  }

  /* ---- User rating (clickable interactive stars) --------------- */
  function userRating(_row, _cell, value, _col, rowData) {
    const num = Math.max(0, Math.min(5, Math.floor(Number(value || 0))));
    const productId = (rowData && rowData.id) || '';
    let html = '<span class="sg-myrating" data-product-id="' + escAttr(productId) + '" data-current="' + num + '">';
    for (let i = 1; i <= 5; i++) {
      html += '<span class="sg-myrating-star ' + (i <= num ? 'is-on' : 'is-off')
        + '" data-rating="' + i + '">★</span>';
    }
    html += '</span>';
    return html;
  }

  /* ---- Risk / status badge ------------------------------------- */
  function statusBadge(_row, _cell, value) {
    if (value == null || value === '') return '<span class="sg-cell-empty">&mdash;</span>';
    const s = String(value).toLowerCase();
    let cls = 'is-neutral';
    if (/good|ok|verified|in stock|safe|low/.test(s))       cls = 'is-good';
    else if (/warn|caution|partial|limited/.test(s))        cls = 'is-warn';
    else if (/bad|conflict|out|fail|high risk|missing/.test(s)) cls = 'is-bad';
    return '<span class="sg-badge ' + cls + '">' + esc(value) + '</span>';
  }

  /* ---- DisplayCell formatter (used by Projection B cells) ------ */
  /* The cell is the {raw, corrected, conflicts, confidence, sources,
     missing} shape from matrixModes. Renders raw + correction strike
     + conflict pill + source/confidence indicators inline. */
  function displayCell(_row, _cell, value) {
    if (!value || typeof value !== 'object') {
      return value == null || value === '' ? '<span class="sg-cell-empty">missing</span>' : esc(value);
    }
    if (value.missing) return '<span class="sg-cell-empty">missing</span>';

    const raw = value.raw != null ? esc(value.raw) : '';
    let html = '<span class="sg-cell-stack">';
    if (value.corrected && value.conflicts) {
      html += '<span class="sg-corrected">' + esc(value.corrected) + '</span>';
      html += '<span class="sg-was">was ' + raw + '</span>';
    } else {
      html += '<span class="sg-cell-value">' + raw + '</span>';
    }
    if (value.confidence != null) {
      const pct = Math.round(value.confidence * 100);
      html += '<span class="sg-confidence" title="Extraction confidence">'
        +    'conf ' + pct + '%</span>';
    }
    if (Array.isArray(value.sources) && value.sources.length) {
      const label = value.sources.length === 1 ? value.sources[0] : value.sources.length + ' sources';
      html += '<span class="sg-source-hint" title="' + escAttr(value.sources.join(', ')) + '">' + esc(label) + '</span>';
    }
    html += '</span>';
    return html;
  }

  /* ---- Notes indicator (icon + truncated text) ----------------- */
  function notes(_row, _cell, value) {
    if (value == null || value === '') return '<span class="sg-cell-empty">&mdash;</span>';
    const s = String(value);
    const short = s.length > 60 ? s.slice(0, 57) + '…' : s;
    return '<span class="sg-notes" title="' + escAttr(s) + '">📝 ' + esc(short) + '</span>';
  }

  Object.assign(NS, {
    text, pretty, thumbnail, productTitle, pill, multiPill,
    price, stars, userRating, statusBadge, displayCell, notes,
    /* Sanitizer surface, exposed for ad-hoc use in column defs. */
    _esc: esc, _escAttr: escAttr, _safeUrl: safeUrl
  });
})(globalThis);
