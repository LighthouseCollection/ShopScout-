/* =============================================================
   ShopScout — SlickGrid adapter

   Owns the SlickGrid/DataView runtime only. Product loading,
   persistence, and app actions live in shopscoutGrid.js.
   ============================================================= */
(function initShopScoutSlickGridAdapter(root) {
  const NS = (root.ShopScoutSlickGridAdapter = root.ShopScoutSlickGridAdapter || {});

  function esc(value) {
    const SS = root.SS;
    if (SS && typeof SS.esc === 'function') return SS.esc(value);
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escAttr(value) {
    const SS = root.SS;
    if (SS && typeof SS.escAttr === 'function') return SS.escAttr(value);
    return esc(value);
  }

  function safeUrl(value) {
    const SS = root.SS;
    if (SS && typeof SS.sanitizeUrl === 'function') return SS.sanitizeUrl(value, '');
    if (!String(value || '').trim()) return '';
    try {
      const url = new URL(String(value || ''), root.location?.href || 'https://example.test/');
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function textValue(value) {
    return value == null ? '' : String(value);
  }

  const GENERIC_SOURCE_LABELS = new Set([
    '',
    'generic',
    'source',
    'store',
    'retailer',
    'website',
    'unknown'
  ]);

  const RETAILER_HOSTS = [
    { match: 'amazon.', label: 'Amazon' },
    { match: 'walmart.', label: 'Walmart' },
    { match: 'target.', label: 'Target' },
    { match: 'bestbuy.', label: 'Best Buy' },
    { match: 'newegg.', label: 'Newegg' },
    { match: 'ebay.', label: 'eBay' },
    { match: 'alibaba.', label: 'Alibaba' },
    { match: 'aliexpress.', label: 'AliExpress' },
    { match: 'etsy.', label: 'Etsy' },
    { match: 'costco.', label: 'Costco' },
    { match: 'homedepot.', label: 'The Home Depot' },
    { match: 'lowes.', label: "Lowe's" },
    { match: 'wayfair.', label: 'Wayfair' },
    { match: 'shein.', label: 'SHEIN' },
    { match: 'temu.', label: 'Temu' }
  ];

  const PROSE_FIELDS = new Set([
    'title',
    'productName',
    'listingTitle',
    'description',
    'notes',
    'category',
    'availability',
    'sellerName'
  ]);

  function hostRetailer(urlValue) {
    const url = safeUrl(urlValue);
    if (!url) return null;
    let host = '';
    try {
      host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return null;
    }
    const known = RETAILER_HOSTS.find(retailer => host.includes(retailer.match));
    if (known) return known;
    const parts = host.split('.').filter(Boolean);
    const base = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    if (!base) return null;
    return {
      label: base
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase())
    };
  }

  function usefulSourceLabel(value) {
    const text = textValue(value).trim();
    if (!text || GENERIC_SOURCE_LABELS.has(text.toLowerCase())) return '';
    return text;
  }

  function sourceInfo(value, item) {
    const url = safeUrl(item?.url);
    const retailer = hostRetailer(url);
    const label = retailer?.label || usefulSourceLabel(value || item?.source) || 'Source';
    return {
      label,
      url
    };
  }

  function logoTokenHtml(label, href, className) {
    const text = textValue(label).trim();
    const safeHref = safeUrl(href);
    if (!text) return '<span class="ss-grid-empty">-</span>';
    const attrs = `class="ss-grid-logo-token ${escAttr(className || '')}" title="${escAttr(text)}" aria-label="${escAttr(text)}"`;
    if (safeHref) return `<a ${attrs} href="${escAttr(safeHref)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;
    return `<span ${attrs}>${esc(text)}</span>`;
  }

  function htmlForImage(value, item) {
    const src = safeUrl(value);
    if (!src) return '<span class="ss-grid-no-thumb" aria-label="No image"></span>';
    const label = item?.title || 'Product image';
    return `<img class="ss-grid-thumb" src="${escAttr(src)}" alt="${escAttr(label)}">`;
  }

  function htmlForSource(value, item) {
    const info = sourceInfo(value, item);
    return logoTokenHtml(info.label, info.url, 'ss-grid-source-logo');
  }

  function htmlForBrand(value) {
    const label = textValue(value).trim();
    return logoTokenHtml(label, '', 'ss-grid-brand-logo');
  }

  function htmlForRating(value, item) {
    const rating = textValue(value).trim();
    const reviews = textValue(item?.reviewCount).trim();
    if (!rating && !reviews) return '<span class="ss-grid-empty">-</span>';
    const numeric = Number(String(rating).replace(/[^0-9.]/g, ''));
    const filled = Number.isFinite(numeric) ? Math.max(0, Math.min(5, Math.round(numeric))) : 0;
    const stars = '★'.repeat(filled) + '☆'.repeat(5 - filled);
    const aria = rating ? ` aria-label="${escAttr(`${rating} out of 5`)}"` : '';
    return `<span class="ss-grid-rating"${aria}>`
      + `<span class="ss-grid-rating-main"><span class="ss-grid-stars" aria-hidden="true">${stars}</span> <span>${esc(rating || '-')}</span></span>`
      + `${reviews ? `<span class="ss-grid-rating-count">${esc(reviews)} reviews</span>` : ''}`
      + '</span>';
  }

  function htmlForPrice(value) {
    const text = textValue(value).trim();
    if (!text) return '<span class="ss-grid-empty">-</span>';
    const rounded = roundedPriceText(text);
    if (!rounded) return `<span class="ss-grid-price">${esc(text)}</span>`;
    return `<span class="ss-grid-price" title="${escAttr(text)}">${esc(rounded)}</span>`;
  }

  function roundedPriceText(value) {
    const text = textValue(value).trim();
    if (!text) return '';
    if (/[–—-]\s*\$?\d/.test(text) || /\b(to|from|more options)\b/i.test(text)) return '';
    const match = text.match(/^\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*$/);
    if (!match) return '';
    const amount = Number(match[1].replace(/,/g, ''));
    if (!Number.isFinite(amount)) return '';
    const rounded = Math.round(amount / 5) * 5;
    return `$${rounded.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }

  function shouldRenderPills(column, field) {
    const key = String(field || column?.field || column?.id || '').replace(/^spec:/, '');
    if (PROSE_FIELDS.has(key)) return false;
    return ['spec', 'text', 'matrixCell'].includes(column?.type || 'text');
  }

  function sentenceLike(value) {
    const text = textValue(value).trim();
    if (!text) return true;
    if (text.length > 90) return true;
    if (/[.!?]\s*$/.test(text)) return true;
    if (/[.!?]\s+\w/.test(text)) return true;
    if (/[,;:]\s+(and|or|but|because|with|for|to|from|that|which|when)\b/i.test(text)) return true;
    return false;
  }

  function pillsHtml(value, column, field) {
    if (!shouldRenderPills(column, field)) return '';
    const text = textValue(value).trim();
    if (!text || sentenceLike(text)) return '';
    const splitter = root.ShopScoutValues?.splitToPills;
    const splitParts = typeof splitter === 'function' ? splitter(text) : null;
    const parts = Array.isArray(splitParts) && splitParts.length
      ? splitParts
      : [text];
    return `<span class="ss-grid-pill-list">${parts.map(part => `<span class="ss-grid-value-pill">${pillPartHtml(part)}</span>`).join('')}</span>`;
  }

  function pillPartHtml(part) {
    const text = textValue(part).trim();
    const quantity = text.match(/^(.*?)\s+\((×\d+)\)$/);
    if (!quantity) return esc(text);
    return `${esc(quantity[1])} <span class="ss-grid-pill-qty">${esc(quantity[2])}</span>`;
  }

  function plainCellHtml(value, column) {
    const text = textValue(value).trim();
    if (!text) return '<span class="ss-grid-empty">-</span>';
    return pillsHtml(text, column, column?.field || column?.id) || esc(text);
  }

  function titleCellHtml(value) {
    const text = textValue(value).trim();
    if (!text) return '<span class="ss-grid-empty">-</span>';
    return `<span class="ss-grid-title-text" title="${escAttr(text)}">${esc(text)}</span>`;
  }

  function htmlForSelection(item) {
    const id = escAttr(item?.id || '');
    const checked = item?._selected ? ' checked' : '';
    return `<input class="ss-grid-select" type="checkbox" data-row-id="${id}"${checked} aria-label="Select product">`;
  }

  function htmlForActions() {
    return `<div class="ss-grid-action-bar" role="toolbar" aria-label="Product actions">
      <button class="ss-grid-action-btn" type="button" data-ss-grid-action="open" aria-label="Open product" title="Open"><span aria-hidden="true">&#8599;</span></button>
      <button class="ss-grid-action-btn" type="button" data-ss-grid-action="rescan" aria-label="Rescan product" title="Rescan"><span aria-hidden="true">&#8635;</span></button>
      <button class="ss-grid-action-btn ss-grid-action-danger" type="button" data-ss-grid-action="delete" aria-label="Delete product" title="Delete"><span aria-hidden="true">&times;</span></button>
    </div>`;
  }

  function normalizationValuesMatch(left, right) {
    return textValue(left).trim().toLowerCase() === textValue(right).trim().toLowerCase();
  }

  function htmlForNormalizationProduct(item) {
    const title = textValue(item?.productTitle || item?.title).trim() || 'Product';
    const source = textValue(item?.source).trim();
    return `<div class="normalization-review-product">
      <strong title="${escAttr(title)}">${esc(title)}</strong>
      ${source ? `<span>${esc(source)}</span>` : ''}
    </div>`;
  }

  function htmlForNormalizationPair(value, column, item) {
    const raw = textValue(item?.[column.rawField || 'raw'] ?? value).trim();
    const normalized = textValue(item?.[column.normalizedField || 'normalized']).trim();
    const shown = normalized || raw || '-';
    if (normalizationValuesMatch(raw, normalized)) {
      return `<span class="normalization-review-normal">${esc(shown)}</span>`;
    }
    return `<span class="normalization-review-raw">${esc(raw || '-')}</span>`
      + '<span class="normalization-review-arrow">→</span>'
      + `<span class="normalization-review-normal">${esc(shown)}</span>`;
  }

  function htmlForNormalizationReason(value) {
    return `<span class="normalization-review-reason">${esc(textValue(value).trim() || 'review')}</span>`;
  }

  function htmlForNormalizationRule(value, item) {
    const rule = textValue(value || item?.rule || 'unmapped').trim() || 'unmapped';
    const source = textValue(item?.fieldSource).trim();
    return `<code>${esc(rule)}</code>${source ? `<span>${esc(source)}</span>` : ''}`;
  }

  function normalizationActionAttrs(item) {
    return `data-review-key="${escAttr(item?.reviewKey || '')}" `
      + `data-product-id="${escAttr(item?.productId || '')}" `
      + `data-raw-field="${escAttr(item?.rawField || '')}" `
      + `data-field="${escAttr(item?.field || '')}" `
      + `data-raw-value="${escAttr(item?.raw || '')}" `
      + `data-normalized-value="${escAttr(item?.normalized || '')}"`;
  }

  function htmlForNormalizationActions(item) {
    const attrs = normalizationActionAttrs(item);
    return `<div class="normalization-review-actions ss-grid-review-actions">
      <button class="dashboard-primary-action dashboard-secondary-action--small" type="button" data-normalization-action="accept-alias" ${attrs}>Accept alias</button>
      <button class="dashboard-secondary-action dashboard-secondary-action--small" type="button" data-normalization-bulk-action="accept-alias" ${attrs}>Accept all matching</button>
      <button class="dashboard-secondary-action dashboard-secondary-action--small" type="button" data-normalization-action="ignore" ${attrs}>Ignore</button>
      <button class="dashboard-secondary-action dashboard-secondary-action--small" type="button" data-normalization-bulk-action="ignore" ${attrs}>Ignore all matching</button>
      ${item?.productId ? `<button class="dashboard-secondary-action dashboard-secondary-action--small" type="button" data-duplicate-open="${escAttr(item.productId)}">Open</button>` : ''}
    </div>`;
  }

  function userRuleActionAttrs(item) {
    return `data-review-key="${escAttr(item?.reviewKey || '')}" `
      + `data-raw-field="${escAttr(item?.rawField || '')}" `
      + `data-field="${escAttr(item?.field || '')}" `
      + `data-raw-value="${escAttr(item?.raw || '')}" `
      + `data-normalized-value="${escAttr(item?.normalized || '')}"`;
  }

  function htmlForUserRuleCode(value, item) {
    const ruleKey = textValue(value || item?.reviewKey || item?.rawField || item?.raw || '-').trim() || '-';
    return `<code>${esc(ruleKey)}</code>`;
  }

  function htmlForUserRuleActions(item) {
    const attrs = userRuleActionAttrs(item);
    const canEdit = item?.type !== 'Ignored review item';
    return `<div class="normalization-review-actions ss-grid-review-actions">
      ${canEdit ? `<button class="dashboard-secondary-action dashboard-secondary-action--small" type="button" data-user-rule-action="edit" ${attrs}>Edit</button>` : ''}
      <button class="dashboard-secondary-action dashboard-secondary-action--small" type="button" data-user-rule-action="delete" ${attrs}>Delete</button>
    </div>`;
  }

  function htmlForMatrixCell(value) {
    if (!value || typeof value !== 'object') {
      const text = textValue(value).trim();
      return text ? (pillsHtml(text, { type: 'matrixCell' }, '') || esc(text)) : '<span class="ss-grid-empty">Missing</span>';
    }
    if (value.missing) return '<span class="ss-grid-missing">Missing</span>';
    const shown = textValue(value.value || value.corrected || value.raw).trim();
    const raw = textValue(value.raw).trim();
    const corrected = textValue(value.corrected).trim();
    const field = String(value.field || '').replace(/^spec:/, '');
    if (shown && !corrected && field === 'brand') return htmlForBrand(shown);
    if (shown && !corrected && field === 'source') return htmlForSource(shown, { source: shown, url: value.url });
    const sourceTitle = Array.isArray(value.sources) && value.sources.length
      ? ` title="${escAttr(value.sources.join(', '))}"`
      : '';
    const confidence = typeof value.confidence === 'number'
      ? `<span class="ss-grid-confidence">${Math.round(value.confidence * 100)}%</span>`
      : '';
    const source = Array.isArray(value.sources) && value.sources.length
      ? `<span class="ss-grid-source-dot"${sourceTitle}>source</span>`
      : '';
    if (corrected) {
      const correctedPills = pillsHtml(corrected, { type: 'matrixCell' }, value.field);
      return `<span class="ss-grid-matrix-cell"><span class="ss-grid-corrected">${correctedPills || esc(corrected)}</span>`
        + `${raw ? `<span class="ss-grid-was">was ${esc(raw)}</span>` : ''}${confidence}${source}</span>`;
    }
    const shownHtml = shown
      ? (pillsHtml(shown, { type: 'matrixCell' }, value.field) || esc(shown))
      : '<span class="ss-grid-empty">-</span>';
    return `<span class="ss-grid-matrix-cell"><span>${shownHtml}</span>${confidence}${source}</span>`;
  }

  function cellFormatter(row, cell, value, column, item) {
    if ((column.field || column.id) === 'title') return titleCellHtml(value);
    switch (column.type) {
      case 'selection': return htmlForSelection(item);
      case 'image':     return htmlForImage(value, item);
      case 'brand':     return htmlForBrand(value);
      case 'source':    return htmlForSource(value, item);
      case 'price':     return htmlForPrice(value);
      case 'rating':    return htmlForRating(value, item);
      case 'matrixCell':return htmlForMatrixCell(value);
      case 'actions':   return htmlForActions();
      case 'normalizationProduct': return htmlForNormalizationProduct(item);
      case 'normalizationPair': return htmlForNormalizationPair(value, column, item);
      case 'normalizationReason': return htmlForNormalizationReason(value);
      case 'normalizationRule': return htmlForNormalizationRule(value, item);
      case 'normalizationActions': return htmlForNormalizationActions(item);
      case 'userRuleCode': return htmlForUserRuleCode(value, item);
      case 'userRuleActions': return htmlForUserRuleActions(item);
      default: {
        return plainCellHtml(value, column);
      }
    }
  }

  function sortableComparator(field, direction) {
    const values = root.ShopScoutValues || {};
    const parseNumeric = value => {
      if (typeof values.parseNumeric === 'function') {
        const parsed = values.parseNumeric(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
        const cleaned = String(value ?? '').replace(/[^0-9.-]/g, '');
        if (!cleaned || /^[-.]+$/.test(cleaned)) return null;
        const n = Number(cleaned);
        return isFinite(n) ? n : null;
    };
    return (a, b) => {
      const av = a?.[field];
      const bv = b?.[field];
      const an = parseNumeric(av);
      const bn = parseNumeric(bv);
      let cmp;
      if (an != null || bn != null) cmp = (an ?? Number.NEGATIVE_INFINITY) - (bn ?? Number.NEGATIVE_INFINITY);
      else cmp = textValue(av).localeCompare(textValue(bv));
      return direction === 'desc' ? -cmp : cmp;
    };
  }

  function normalizeSortChain(sort) {
    return (Array.isArray(sort) ? sort : [])
      .map(item => ({
        field: String(item?.field || '').trim(),
        dir: item?.dir === 'desc' ? 'desc' : 'asc'
      }))
      .filter(item => item.field);
  }

  function sortableComparatorChain(sort) {
    const comparators = normalizeSortChain(sort)
      .map(item => sortableComparator(item.field, item.dir));
    return (a, b) => {
      for (const compare of comparators) {
        const result = compare(a, b);
        if (result !== 0) return result;
      }
      return 0;
    };
  }

  function sortChainFromEvent(args) {
    if (Array.isArray(args?.sortCols) && args.sortCols.length) {
      return args.sortCols
        .map(item => ({
          field: item?.sortCol?.field || item?.sortCol?.id || '',
          dir: item?.sortAsc === false ? 'desc' : 'asc'
        }))
        .filter(item => item.field);
    }
    const sortCol = args?.sortCol;
    if (!sortCol) return [];
    return [{
      field: sortCol.field || sortCol.id || '',
      dir: args.sortAsc === false ? 'desc' : 'asc'
    }].filter(item => item.field);
  }

  function sortIndicatorColumns(projection) {
    const sort = Array.isArray(projection?.sort) ? projection.sort : [];
    if (!sort.length) return [];
    const columns = Array.isArray(projection?.columns) ? projection.columns : [];
    return sort
      .map(item => {
        const column = columns.find(candidate => candidate.id === item.field || candidate.field === item.field);
        if (!column || column.type === 'selection' || column.type === 'actions' || column.type === 'image') return null;
        return {
          columnId: column.id,
          sortAsc: item.dir !== 'desc'
        };
      })
      .filter(Boolean);
  }

  function applySortIndicator(grid, projection) {
    const columns = sortIndicatorColumns(projection);
    if (typeof grid.setSortColumns === 'function') {
      grid.setSortColumns(columns);
      return;
    }
    if (columns.length && typeof grid.setSortColumn === 'function') {
      grid.setSortColumn(columns[0].columnId, columns[0].sortAsc);
    }
  }

  function headerNameForColumn(column) {
    const label = textValue(column?.name).trim();
    if (column?.type !== 'matrixCell') return column?.name || '';
    const thumb = safeUrl(column.image);
    if (!thumb) return esc(label || 'Product');
    return `<span class="ss-grid-product-head">`
      + `<img class="ss-grid-header-thumb" src="${escAttr(thumb)}" alt="" aria-hidden="true" loading="lazy">`
      + `<span class="ss-grid-product-head-title-wrap">`
      + `<span class="ss-grid-product-head-title" title="${escAttr(label || 'Product')}">${esc(label || 'Product')}</span>`
      + `</span>`
      + `</span>`;
  }

  function plainHeaderText(column) {
    return textValue(column?.name || column?.id || '').replace(/<[^>]+>/g, '').trim();
  }

  /* Character-width estimate for auto-sizing. Body cells render Inter 13px
     regular (~7.2px/char). Headers render 11px monospace-uppercase-bold —
     the uppercase letters push effective width closer to 9.6px/char. */
  function estimateTextWidth(value, opts) {
    const text = textValue(value).replace(/\s+/g, ' ').trim();
    if (!text) return 0;
    const perChar = opts?.header ? 9.6 : 7.2;
    return Math.ceil(Math.min(text.length, 72) * perChar);
  }

  function clampWidth(value, min, max) {
    return Math.max(min, Math.min(max, Math.ceil(value)));
  }

  /* Column-width bounds.

     Content-driven columns (text, spec, brand, source, rating, title, price)
     size to max(header, widest sampled cell) + pad, floored at 56 so the
     sort-indicator glyph and a one-character header stay legible. The upper
     bound just prevents any single column from running away and swallowing
     the viewport.

     Fixed-shape columns (selection, actions, image, matrixCell, and the
     normalization/userRule review columns) keep tight per-type bounds
     because their DOM contents don't correspond to a text length.        */
  function columnWidthBounds(column) {
    if (column?.type === 'selection') return { min: column.width || 40, max: column.width || 40, pad: 0 };
    if (column?.type === 'actions') return { min: column.width || 112, max: column.width || 112, pad: 0 };
    if (column?.type === 'normalizationActions') return { min: column.width || 500, max: column.width || 560, pad: 0 };
    if (column?.type === 'normalizationProduct') return { min: 240, max: 380, pad: 42 };
    if (column?.type === 'normalizationPair') return { min: 190, max: 340, pad: 38 };
    if (column?.type === 'normalizationRule') return { min: 130, max: 220, pad: 34 };
    if (column?.type === 'normalizationReason') return { min: 130, max: 180, pad: 34 };
    if (column?.type === 'userRuleActions') return { min: column.width || 190, max: column.width || 220, pad: 0 };
    if (column?.type === 'userRuleCode') return { min: 180, max: 360, pad: 34 };
    if (column?.type === 'image') return { min: column.width || 96, max: column.width || 112, pad: 0 };
    if ((column?.field || column?.id) === 'title') return { min: 260, max: 520, pad: 42 };
    if (column?.type === 'matrixCell') return { min: 180, max: 300, pad: 36 };
    if (column?.type === 'source' || column?.type === 'brand') return { min: 96, max: 200, pad: 34 };
    if (column?.type === 'rating') return { min: 128, max: 160, pad: 34 };
    if (column?.type === 'price') return { min: 88, max: 140, pad: 34 };
    return { min: 56, max: 360, pad: 34 };
  }

  function measuredColumnWidth(column, rows) {
    if (column?.width) return column.width;
    const bounds = columnWidthBounds(column);
    const field = column.field || column.id;
    const header = plainHeaderText(column);
    let measured = estimateTextWidth(header, { header: true }) + bounds.pad;
    for (const row of (rows || []).slice(0, 25)) {
      const value = row?.[field];
      if (value && typeof value === 'object') {
        measured = Math.max(measured, estimateTextWidth(value.corrected || value.value || value.raw) + bounds.pad);
      } else {
        measured = Math.max(measured, estimateTextWidth(value) + bounds.pad);
      }
    }
    return clampWidth(measured, bounds.min, bounds.max);
  }

  function toSlickColumns(columns, rows) {
    const Slick = root.Slick || {};
    const TextEditor = Slick.Editors && Slick.Editors.Text;
    return (columns || []).map(column => ({
      id: column.id,
      field: column.field || column.id,
      name: headerNameForColumn(column),
      type: column.type || 'text',
      width: measuredColumnWidth(column, rows),
      minWidth: column.minWidth || measuredColumnWidth(column, rows),
      maxWidth: column.maxWidth || undefined,
      resizable: true,
      sortable: column.type !== 'selection' && column.type !== 'actions' && column.type !== 'normalizationActions' && column.type !== 'userRuleActions' && column.type !== 'image',
      selectable: column.type !== 'selection' && column.type !== 'actions' && column.type !== 'normalizationActions' && column.type !== 'userRuleActions',
      editor: column.editable && TextEditor ? TextEditor : undefined,
      formatter: cellFormatter,
      cssClass: `ss-grid-cell ss-grid-cell-${column.type || 'text'}${column.type === 'actions' || column.type === 'normalizationActions' || column.type === 'userRuleActions' ? ' ss-grid-cell-actions' : ''}`,
      headerCssClass: 'ss-grid-header'
    }));
  }

  function groupCellFormatter(_row, _cell, _value, _columnDef, item) {
    const collapsed = item?.collapsed ? 'collapsed' : 'expanded';
    const title = item?.title || item?.value || 'Group';
    return `<span class="slick-group-toggle ${collapsed}" aria-hidden="true"></span>`
      + '<span class="ss-grid-group-label">Group</span>'
      + `<span class="ss-grid-group-title">${esc(title)}</span>`;
  }

  function createGroupItemMetadataProvider() {
    return {
      getGroupRowMetadata() {
        return {
          selectable: false,
          focusable: true,
          cssClasses: 'slick-group ss-grid-native-group',
          columns: {
            0: {
              colspan: '*',
              formatter: groupCellFormatter,
              editor: null
            }
          }
        };
      },
      getTotalsRowMetadata() {
        return {
          selectable: false,
          focusable: false,
          cssClasses: 'slick-group-totals ss-grid-native-group-totals'
        };
      }
    };
  }

  function nativeGroupValue(item, field) {
    const value = item?.[field];
    const text = typeof value === 'object'
      ? textValue(value?.value ?? value?.corrected ?? value?.raw)
      : textValue(value);
    return text.trim() || 'Not specified';
  }

  function groupingInfo(projection) {
    const grouping = projection?.grouping;
    const field = String(grouping?.field || projection?.group || '').trim();
    if (!field) return null;
    const label = String(grouping?.label || field).trim() || field;
    return {
      getter(item) {
        return nativeGroupValue(item, field);
      },
      formatter(group) {
        const value = textValue(group?.value).trim() || 'Not specified';
        return `${label}: ${value} (${Number(group?.count) || 0})`;
      },
      comparer(a, b) {
        return textValue(a?.value).localeCompare(textValue(b?.value), undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      },
      displayTotalsRow: false,
      aggregateEmpty: false,
      collapsed: false
    };
  }

  function renderMissingRuntime(container) {
    if (!container) return;
    const doc = container.ownerDocument || root.document;
    const message = doc?.createElement ? doc.createElement('div') : null;
    if (!message) return;
    message.className = 'ss-grid-empty';
    message.textContent = 'SlickGrid runtime is not available. Product data is safe; reload the extension package after the grid files are present.';
    container.replaceChildren(message);
  }

  function applyProjection(dataView, grid, projection) {
    grid.getContainerNode?.()?.classList?.toggle?.('ss-grid-is-matrix', projection?.mode === 'comparisonMatrix');
    applyHostHeight(grid.getContainerNode?.(), projection);
    dataView.beginUpdate();
    dataView.setItems(projection.rows || [], 'id');
    dataView.setGrouping(groupingInfo(projection));
    dataView.endUpdate();
    const sort = Array.isArray(projection.sort) ? projection.sort : [];
    if (sort.length) {
      dataView.sort(sortableComparatorChain(sort), true);
    }
    applySortIndicator(grid, projection);
    grid.resizeCanvas();
    grid.render();
  }

  function applyHostHeight(container, projection) {
    if (!container?.style) return;
    const rowCount = Array.isArray(projection?.rows) ? projection.rows.length : 0;
    const isMatrix = projection?.mode === 'comparisonMatrix';
    const isNormalizationReview = projection?.mode === 'normalizationReview';
    const isUserRules = projection?.mode === 'userRules';
    const headerHeight = isMatrix ? 132 : 42;
    const rowHeight = isNormalizationReview ? 126 : (isUserRules ? 78 : 82);
    const padding = 0;
    const minHeight = rowCount ? headerHeight + rowHeight : 140;
    const maxRowsBeforeScroll = isMatrix ? 8 : (isNormalizationReview ? 6 : 12);
    const visibleRows = Math.max(1, Math.min(rowCount || 1, maxRowsBeforeScroll));
    const height = Math.max(minHeight, headerHeight + (visibleRows * rowHeight) + padding);
    container.style.height = `${height}px`;
    container.style.minHeight = '0';
  }

  function create(container, projection, options) {
    const Slick = root.Slick;
    if (!container || !Slick || !Slick.Grid || !Slick.Data || !Slick.Data.DataView) {
      renderMissingRuntime(container);
      return {
        update() {},
        updateRow() { return false; },
        deleteRow() { return false; },
        destroy() {}
      };
    }

    const opts = options || {};
    const groupProvider = createGroupItemMetadataProvider();
    const dataView = new Slick.Data.DataView({
      inlineFilters: true,
      groupItemMetadataProvider: groupProvider
    });
    const columns = toSlickColumns(projection.columns, projection.rows);
    const gridOptions = {
      autoEdit: false,
      editable: true,
      enableCellNavigation: true,
      enableColumnReorder: !!(root.Sortable && typeof root.Sortable.create === 'function'),
      explicitInitialization: false,
      forceFitColumns: false,
      multiColumnSort: true,
      rowHeight: projection?.mode === 'normalizationReview' ? 126 : (projection?.mode === 'userRules' ? 78 : 82),
      showCellSelection: false,
      enableTextSelectionOnCells: true
    };
    const grid = new Slick.Grid(container, dataView, columns, gridOptions);
    if (container?.classList) container.classList.toggle('ss-grid-is-matrix', projection?.mode === 'comparisonMatrix');

    if (Slick.RowSelectionModel) {
      grid.setSelectionModel(new Slick.RowSelectionModel({ selectActiveRow: false }));
    }

    dataView.onRowCountChanged.subscribe(() => {
      grid.updateRowCount();
      grid.render();
    });
    dataView.onRowsChanged.subscribe((_event, args) => {
      grid.invalidateRows(args.rows);
      grid.render();
    });

    grid.onSort.subscribe((_event, args) => {
      const sort = sortChainFromEvent(args);
      if (!sort.length) return;
      dataView.sort(sortableComparatorChain(sort), true);
      if (typeof opts.onSortChange === 'function') opts.onSortChange(sort);
    });

    grid.onColumnsReordered.subscribe(() => {
      if (typeof opts.onColumnOrderChange === 'function') {
        opts.onColumnOrderChange(grid.getColumns().map(column => column.id));
      }
    });

    grid.onColumnsResized.subscribe(() => {
      if (typeof opts.onColumnWidthsChange !== 'function') return;
      const widths = {};
      for (const column of grid.getColumns()) {
        if (column?.id) widths[column.id] = column.width;
      }
      opts.onColumnWidthsChange(widths);
    });

    grid.onCellChange.subscribe((_event, args) => {
      if (typeof opts.onCellCommit !== 'function') return;
      opts.onCellCommit({
        row: args.item,
        field: args.column?.field,
        column: args.column,
        value: args.item?.[args.column?.field]
      });
    });

    grid.onSelectedRowsChanged.subscribe((_event, args) => {
      if (typeof opts.onSelectionChange !== 'function') return;
      const selectedItems = (args.rows || []).map(row => dataView.getItem(row)).filter(Boolean);
      opts.onSelectionChange(selectedItems);
    });

    grid.onClick.subscribe((event, args) => {
      const target = event.target;
      const item = dataView.getItem(args.row);
      const groupToggle = target?.closest?.('.slick-group-toggle');
      if (groupToggle && item?.__group) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (item.collapsed && typeof dataView.expandGroup === 'function') dataView.expandGroup(item.groupingKey);
        else if (!item.collapsed && typeof dataView.collapseGroup === 'function') dataView.collapseGroup(item.groupingKey);
        return;
      }
      const actionButton = target?.closest?.('[data-ss-grid-action]');
      if (actionButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (typeof opts.onAction === 'function') {
          opts.onAction(actionButton.dataset.ssGridAction, dataView.getItem(args.row));
        }
        return;
      }
      const checkbox = target?.closest?.('.ss-grid-select');
      if (checkbox && !item?.__group) {
        event.stopImmediatePropagation();
        const selected = new Set(grid.getSelectedRows ? grid.getSelectedRows() : []);
        if (checkbox.checked) selected.add(args.row);
        else selected.delete(args.row);
        if (grid.setSelectedRows) grid.setSelectedRows([...selected]);
      }
    });

    grid.onDblClick.subscribe((_event, args) => {
      const item = dataView.getItem(args.row);
      if (item?.__group || item?.__groupTotals) return;
      if (typeof opts.onAction === 'function') opts.onAction('open', item);
    });

    applyProjection(dataView, grid, projection);

    return {
      grid,
      dataView,
      update(nextProjection) {
        grid.setColumns(toSlickColumns(nextProjection.columns, nextProjection.rows));
        applyProjection(dataView, grid, nextProjection);
      },
      updateItem(itemId, nextItem) {
        if (!itemId || !nextItem || !dataView.getItemById || !dataView.updateItem) return;
        if (!dataView.getItemById(itemId)) return;
        dataView.updateItem(itemId, nextItem);
      },
      updateRow(itemId, nextItem) {
        if (!itemId || !nextItem || !dataView.getItemById || !dataView.updateItem) return false;
        if (!dataView.getItemById(itemId)) return false;
        dataView.updateItem(itemId, nextItem);
        return true;
      },
      deleteRow(itemId) {
        if (!itemId || !dataView.getItemById || !dataView.deleteItem) return false;
        if (!dataView.getItemById(itemId)) return false;
        dataView.deleteItem(itemId);
        if (typeof grid.updateRowCount === 'function') grid.updateRowCount();
        grid.render();
        return true;
      },
      flashCell(itemId, field) {
        if (!itemId || !field || !grid.getColumns || !dataView.getRowById) return;
      const row = dataView.getRowById(itemId);
      const cell = grid.getColumns().findIndex(column => column.field === field);
        if (row == null || cell < 0) return;
        const node = grid.getCellNode(row, cell);
        if (!node?.classList) return;
        node.classList.add('ss-grid-cell-conflict');
        setTimeout(() => node.classList.remove('ss-grid-cell-conflict'), 1800);
      },
      destroy() {
        if (grid && typeof grid.destroy === 'function') grid.destroy();
        if (dataView && typeof dataView.destroy === 'function') dataView.destroy();
      }
    };
  }

  Object.assign(NS, { create });
})(globalThis);
