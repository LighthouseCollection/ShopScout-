/* =============================================================
   ShopScout — AG Grid Community adapter

   Same public contract as the previous SlickGrid adapter so
   shopscoutGrid.js and the review pages can swap engines by
   changing one reference. Reimplements the cell formatters,
   dynamic sizing, and click delegation on top of AG Grid.

   AG Grid handles the annoying stuff natively:
   - `domLayout: 'autoHeight'` → no internal vertical scrollbar,
     grid grows to fit rows, browser scrolls the page.
   - Column auto-sizing to content via `autoSizeAllColumns()`.
   - Sort, resize, reorder built-in.
   ============================================================= */
(function initShopScoutAgGridAdapter(root) {
  const NS = (root.ShopScoutAgGridAdapter = root.ShopScoutAgGridAdapter || {});

  function esc(value) {
    const SS = root.SS;
    if (SS && typeof SS.esc === 'function') return SS.esc(value);
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
    } catch { return ''; }
  }
  function textValue(value) { return value == null ? '' : String(value); }

  const GENERIC_SOURCE_LABELS = new Set(['','generic','source','store','retailer','website','unknown']);
  const RETAILER_HOSTS = [
    { match: 'amazon.',    label: 'Amazon' },
    { match: 'walmart.',   label: 'Walmart' },
    { match: 'target.',    label: 'Target' },
    { match: 'bestbuy.',   label: 'Best Buy' },
    { match: 'newegg.',    label: 'Newegg' },
    { match: 'ebay.',      label: 'eBay' },
    { match: 'alibaba.',   label: 'Alibaba' },
    { match: 'aliexpress.',label: 'AliExpress' },
    { match: 'etsy.',      label: 'Etsy' },
    { match: 'costco.',    label: 'Costco' },
    { match: 'homedepot.', label: 'The Home Depot' },
    { match: 'lowes.',     label: "Lowe's" },
    { match: 'wayfair.',   label: 'Wayfair' },
    { match: 'shein.',     label: 'SHEIN' },
    { match: 'temu.',      label: 'Temu' }
  ];
  function hostRetailer(urlValue) {
    const url = safeUrl(urlValue);
    if (!url) return null;
    let host = '';
    try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); }
    catch { return null; }
    const known = RETAILER_HOSTS.find(r => host.includes(r.match));
    if (known) return known;
    const parts = host.split('.').filter(Boolean);
    const base = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    if (!base) return null;
    return { label: base.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) };
  }
  function usefulSourceLabel(value) {
    const t = textValue(value).trim();
    if (!t || GENERIC_SOURCE_LABELS.has(t.toLowerCase())) return '';
    return t;
  }
  function sourceInfo(value, row) {
    const url = safeUrl(row?.url);
    const retailer = hostRetailer(url);
    const label = retailer?.label || usefulSourceLabel(value || row?.source) || 'Source';
    return { label, url };
  }

  /* --- Pill rendering (same semantic palette as before) --------- */
  function pillPartHtml(part) {
    const text = textValue(part).trim();
    const quantity = text.match(/^(.*?)\s+\((×\d+)\)$/);
    if (!quantity) return esc(text);
    return `${esc(quantity[1])} <span class="ss-grid-pill-qty">${esc(quantity[2])}</span>`;
  }
  const PROSE_FIELDS = new Set(['title','productName','listingTitle','description','notes','category','availability','sellerName']);
  function shouldRenderPills(type, field) {
    const key = String(field || '').replace(/^spec:/, '');
    if (PROSE_FIELDS.has(key)) return false;
    return ['spec','text','matrixCell'].includes(type || 'text');
  }
  function sentenceLike(value) {
    const t = textValue(value).trim();
    if (!t) return true;
    if (/[.!?]\s*$/.test(t)) return true;
    if (/[.!?]\s+\w/.test(t)) return true;
    if (/[,;:]\s+(and|or|but|because|with|for|to|from|that|which|when)\b/i.test(t)) return true;
    return false;
  }
  function pillsHtml(value, type, field) {
    if (!shouldRenderPills(type, field)) return '';
    const text = textValue(value).trim();
    if (!text || sentenceLike(text)) return '';
    const splitter = root.ShopScoutValues?.splitToPills;
    const splitParts = typeof splitter === 'function' ? splitter(text) : null;
    const parts = Array.isArray(splitParts) && splitParts.length ? splitParts : [text];
    const keyFn = root.ShopScoutValues?.pillColorKey;
    return `<span class="ss-grid-pill-list">${parts.map(part => {
      const colorKey = typeof keyFn === 'function' ? keyFn(field, part) : '';
      const attr = colorKey ? ` data-pill-color="${escAttr(colorKey)}"` : '';
      return `<span class="ss-grid-value-pill"${attr}>${pillPartHtml(part)}</span>`;
    }).join('')}</span>`;
  }

  /* --- Cell renderers per column type --------------------------- */
  function renderSelection(params) {
    const id = escAttr(params.data?.id || '');
    const checked = params.data?._selected ? ' checked' : '';
    return `<input class="ss-grid-select" type="checkbox" data-row-id="${id}"${checked} aria-label="Select product">`;
  }

  function renderActionsBar() {
    return `<div class="ss-grid-action-bar" role="toolbar" aria-label="Product actions">
      <button class="ss-grid-action-btn" type="button" data-ss-grid-action="open" aria-label="Open product" title="Open"><span aria-hidden="true">&#8599;</span></button>
      <button class="ss-grid-action-btn" type="button" data-ss-grid-action="rescan" aria-label="Rescan product" title="Rescan"><span aria-hidden="true">&#8635;</span></button>
      <button class="ss-grid-action-btn ss-grid-action-danger" type="button" data-ss-grid-action="delete" aria-label="Delete product" title="Delete"><span aria-hidden="true">&times;</span></button>
    </div>`;
  }

  function renderImage(params) {
    const src = safeUrl(params.value);
    const label = params.data?.title || 'Product image';
    const thumb = src
      ? `<img class="ss-grid-thumb" src="${escAttr(src)}" alt="${escAttr(label)}">`
      : '<span class="ss-grid-no-thumb" aria-label="No image"></span>';
    return `<div class="ss-grid-thumb-stack">${thumb}${renderActionsBar()}</div>`;
  }

  function renderBrand(params) {
    const label = textValue(params.value).trim();
    if (!label) return '<span class="ss-grid-empty">-</span>';
    return `<span class="ss-grid-logo-token ss-grid-brand-logo" title="${escAttr(label)}">${esc(label)}</span>`;
  }

  function renderSource(params) {
    const info = sourceInfo(params.value, params.data);
    if (!info.label) return '<span class="ss-grid-empty">-</span>';
    if (info.url) {
      return `<a class="ss-grid-logo-token ss-grid-source-logo" title="${escAttr(info.label)}" href="${escAttr(info.url)}" target="_blank" rel="noopener noreferrer">${esc(info.label)}</a>`;
    }
    return `<span class="ss-grid-logo-token ss-grid-source-logo" title="${escAttr(info.label)}">${esc(info.label)}</span>`;
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
  function renderPrice(params) {
    const text = textValue(params.value).trim();
    if (!text) return '<span class="ss-grid-empty">-</span>';
    const rounded = roundedPriceText(text);
    if (!rounded) return `<span class="ss-grid-price">${esc(text)}</span>`;
    return `<span class="ss-grid-price" title="${escAttr(text)}">${esc(rounded)}</span>`;
  }

  /* Build a URL that jumps directly to the reviews section of the
     product page. Amazon uses #customerReviews as its in-page anchor;
     most other retailers (Walmart, Target, Best Buy, eBay, Etsy...)
     use #reviews. Falls back to #reviews for unknown hosts — even
     when the anchor doesn't exist the product page still loads,
     which is strictly better than nothing. */
  function reviewsUrlFor(rawUrl) {
    const url = safeUrl(rawUrl);
    if (!url) return '';
    let host = '';
    try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); }
    catch { return url; }
    const base = url.split('#')[0];
    if (host.includes('amazon.')) return base + '#customerReviews';
    return base + '#reviews';
  }

  function renderRating(params) {
    const rating = textValue(params.value).trim();
    const reviews = textValue(params.data?.reviewCount).trim();
    if (!rating && !reviews) return '<span class="ss-grid-empty">-</span>';
    const numeric = Number(String(rating).replace(/[^0-9.]/g, ''));
    const filled = Number.isFinite(numeric) ? Math.max(0, Math.min(5, Math.round(numeric))) : 0;
    const stars = '★'.repeat(filled) + '☆'.repeat(5 - filled);
    const url = reviewsUrlFor(params.data?.url);
    const label = rating
      ? `${rating} out of 5${reviews ? ` — see ${reviews} reviews` : ''}`
      : (reviews ? `See ${reviews} reviews` : 'See reviews');
    const inner = `<span class="ss-grid-rating-main"><span class="ss-grid-stars" aria-hidden="true">${stars}</span> <span>${esc(rating || '-')}</span></span>`
      + `${reviews ? `<span class="ss-grid-rating-count">${esc(reviews)} reviews</span>` : ''}`;
    if (url) {
      return `<a class="ss-grid-rating ss-grid-rating-link" href="${escAttr(url)}" target="_blank" rel="noopener noreferrer" title="${escAttr(label)}" aria-label="${escAttr(label)}">${inner}</a>`;
    }
    return `<span class="ss-grid-rating" aria-label="${escAttr(label)}">${inner}</span>`;
  }

  function renderTitle(params) {
    const text = textValue(params.value).trim();
    if (!text) return '<span class="ss-grid-empty">-</span>';
    return `<span class="ss-grid-title-text" title="${escAttr(text)}">${esc(text)}</span>`;
  }

  function renderPlain(params) {
    const type = params.colDef?.cellRendererParams?.ssType || 'text';
    const field = params.colDef?.field || params.colDef?.colId || '';
    const value = params.value;
    if (value == null || (typeof value === 'string' && !value.trim())) return '<span class="ss-grid-empty">-</span>';
    const text = textValue(value).trim();
    const pills = pillsHtml(text, type, field);
    return pills || esc(text);
  }

  /* Matrix cell — Compare view. `params.value` is a displayCell object
     produced by buildComparisonMatrixProjection in projections.js:
        { value, raw, corrected, confidence, sources, missing,
          productId, url, source, field, ... }
     Ports the SlickGrid htmlForMatrixCell logic: shows "Missing" for
     empty rows, strikes through the raw value when a correction has
     been applied, shows a confidence percent chip, and delegates to
     renderBrand / renderSource for those two special fields when
     there's no correction. */
  function renderMatrixCell(params) {
    const value = params.value;
    if (!value || typeof value !== 'object') {
      const text = textValue(value).trim();
      if (!text) return '<span class="ss-grid-empty">Missing</span>';
      const pills = pillsHtml(text, 'matrixCell', '');
      return pills || esc(text);
    }
    if (value.missing) return '<span class="ss-grid-missing">Missing</span>';
    const shown = textValue(value.value || value.corrected || value.raw).trim();
    const raw = textValue(value.raw).trim();
    const corrected = textValue(value.corrected).trim();
    const field = String(value.field || '').replace(/^spec:/, '');
    if (shown && !corrected && field === 'brand') {
      return renderBrand({ value: shown });
    }
    if (shown && !corrected && field === 'source') {
      return renderSource({ value: shown, data: { source: shown, url: value.url } });
    }
    const confidence = typeof value.confidence === 'number'
      ? `<span class="ss-grid-confidence">${Math.round(value.confidence * 100)}%</span>`
      : '';
    if (corrected) {
      const correctedPills = pillsHtml(corrected, 'matrixCell', value.field);
      return `<span class="ss-grid-matrix-cell"><span class="ss-grid-corrected">${correctedPills || esc(corrected)}</span>`
        + `${raw ? `<span class="ss-grid-was">was ${esc(raw)}</span>` : ''}${confidence}</span>`;
    }
    const shownHtml = shown
      ? (pillsHtml(shown, 'matrixCell', value.field) || esc(shown))
      : '<span class="ss-grid-empty">-</span>';
    return `<span class="ss-grid-matrix-cell"><span>${shownHtml}</span>${confidence}</span>`;
  }

  /* Attribute column cell — the leftmost column in Compare view, whose
     values are attribute names ("Brand", "Price", "Rating", ...). Just
     the trimmed text; alignment/shading comes from the .ss-grid-cell-
     attribute CSS class we add in cellClassForColumn. */
  function renderAttribute(params) {
    const text = textValue(params.value).trim();
    return text ? esc(text) : '<span class="ss-grid-empty">-</span>';
  }

  /* AG Grid custom header component for matrix product columns.
     Renders the same thumb + wrapped title + action bar SlickGrid
     used, but as real DOM (not the HTML-string hack). AG Grid picks
     it up via headerComponent in the colDef. */
  function makeMatrixHeaderComponent(column) {
    class MatrixHeader {
      init() {
        const doc = root.document;
        this.eGui = doc.createElement('div');
        this.eGui.className = 'ss-grid-product-head';
        const label = textValue(column.name).trim() || 'Product';
        const thumb = safeUrl(column.image);
        if (thumb) {
          const img = doc.createElement('img');
          img.className = 'ss-grid-header-thumb';
          img.src = thumb;
          img.alt = '';
          img.loading = 'lazy';
          this.eGui.appendChild(img);
        }
        const titleWrap = doc.createElement('span');
        titleWrap.className = 'ss-grid-product-head-title-wrap';
        const title = doc.createElement('span');
        title.className = 'ss-grid-product-head-title';
        title.title = label;
        title.textContent = label;
        titleWrap.appendChild(title);
        this.eGui.appendChild(titleWrap);
        if (column.productId) {
          const bar = doc.createElement('div');
          bar.className = 'ss-grid-action-bar ss-grid-matrix-actions';
          bar.setAttribute('role', 'toolbar');
          bar.setAttribute('aria-label', 'Product actions');
          bar.innerHTML = `
            <button class="ss-grid-action-btn" type="button" data-matrix-action="open" data-matrix-product-id="${escAttr(column.productId)}" aria-label="Open product" title="Open"><span aria-hidden="true">&#8599;</span></button>
            <button class="ss-grid-action-btn" type="button" data-matrix-action="rescan" data-matrix-product-id="${escAttr(column.productId)}" aria-label="Rescan product" title="Rescan"><span aria-hidden="true">&#8635;</span></button>
            <button class="ss-grid-action-btn ss-grid-action-danger" type="button" data-matrix-action="delete" data-matrix-product-id="${escAttr(column.productId)}" aria-label="Delete product" title="Delete"><span aria-hidden="true">&times;</span></button>
          `;
          this.eGui.appendChild(bar);
        }
      }
      getGui() { return this.eGui; }
      refresh() { return false; }
    }
    return MatrixHeader;
  }

  /* --- Column definition builder -------------------------------- */
  function columnTypeRenderer(column) {
    if (column.type === 'selection') return renderSelection;
    if (column.type === 'image') return renderImage;
    if (column.type === 'brand') return renderBrand;
    if (column.type === 'source') return renderSource;
    if (column.type === 'price') return renderPrice;
    if (column.type === 'rating') return renderRating;
    if (column.type === 'matrixCell') return renderMatrixCell;
    if (column.type === 'attribute') return renderAttribute;
    if ((column.field || column.id) === 'title') return renderTitle;
    return renderPlain;
  }

  /* Structural minimums only. Everything else lets autoSize decide:
     column = max(header, widest cell content) + 24px (12px each side
     from the .ag-cell CSS padding). Setting an artificial floor here
     just inflates narrow columns past their content — the user rule
     is 12px each side, period. */
  function columnMinWidth(column) {
    if (column.type === 'selection') return 40;
    if (column.type === 'image') return 108;
    if ((column.field || column.id) === 'title') return 160;
    return 40;
  }

  /* Products-grid pinned columns: select / thumb / Name. Compare view
     adds 'attribute' (the Buying Factor column). */
  const PINNED_LEFT_COLUMN_IDS = new Set(['select', 'thumb', 'title', 'attribute']);

  function cellClassForColumn(column) {
    const parts = ['ss-grid-cell', `ss-grid-cell-${column.type || 'text'}`];
    /* Anchor the row-labels styling to the column id so specific rules
       ('.ss-grid-cell-title' for left-alignment) fire regardless of the
       column type. */
    if (column.id) parts.push(`ss-grid-cell-${column.id}`);
    return parts.join(' ');
  }

  function toAgColumns(columns) {
    return (columns || []).map(column => {
      const field = column.field || column.id;
      const isPinnedLeft = PINNED_LEFT_COLUMN_IDS.has(column.id);
      const isMatrixCell = column.type === 'matrixCell';
      /* Prefer explicit column.minWidth from projections.js over the
         type-based fallback in columnMinWidth. Matrix product columns
         pass minWidth: 180; attribute column passes 190. Ignoring
         those was the reason Compare view collapsed narrow cells. */
      const minWidth = typeof column.minWidth === 'number' && column.minWidth > 0
        ? column.minWidth
        : columnMinWidth(column);
      const colDef = {
        colId: column.id,
        field,
        headerName: (column.name || '').replace(/<[^>]+>/g, '').trim(),
        cellRenderer: columnTypeRenderer(column),
        cellRendererParams: { ssType: column.type || 'text' },
        sortable: !['selection','image','actions','matrixCell','attribute'].includes(column.type),
        resizable: true,
        suppressMovable: column.type === 'selection' || column.type === 'image' || isPinnedLeft,
        minWidth,
        hide: !!column.defaultHidden,
        editable: !!column.editable,
        cellClass: cellClassForColumn(column),
        headerClass: 'ss-grid-header',
        pinned: isPinnedLeft ? 'left' : undefined,
        lockPinned: isPinnedLeft || undefined
      };
      /* Matrix product columns get a real header component so the
         thumb + title + action bar render as DOM (not HTML string). */
      if (isMatrixCell) {
        colDef.headerComponent = makeMatrixHeaderComponent(column);
      }
      if (column.width) colDef.width = column.width;
      return colDef;
    });
  }

  /* Auto-size every column to fit MAX(header text, widest cell content).
     v33 API is autoSizeAllColumns(skipHeader); pass false so header
     width is honored — a column whose header is wider than its values
     grows to the header width. Old API name (autoSizeColumns) is used
     as a fallback in case the runtime is a slightly older bundle. */
  /* Match the shell's outer width to the actual canvas width so the
     grid doesn't leave a whitespace band to the right of the last
     column. Mirrors the SlickGrid adapter's updateShellOverflow. */
  function fitShellToContent(host) {
    if (!host) return;
    const shell = host.closest?.('.ss-grid-shell');
    if (!shell) return;
    const headerCells = host.querySelectorAll?.('.ag-header-cell');
    let canvasWidth = 0;
    if (headerCells && headerCells.length) {
      for (const cell of headerCells) canvasWidth += cell.offsetWidth || 0;
    }
    if (!canvasWidth) {
      const container = host.querySelector?.('.ag-center-cols-container');
      canvasWidth = container?.offsetWidth || container?.scrollWidth || 0;
    }
    /* Shell width is now driven by CSS (100% of dashboard-page--grid
       parent) so it always aligns with the title band's underline
       above it. Here we only manage overflow-x: turn scroll on if
       the columns are wider than the shell, otherwise off. */
    shell.style.width = '';
    shell.style.maxWidth = '';
    if (!canvasWidth) return;
    shell.style.overflowX = canvasWidth > shell.clientWidth + 2 ? 'auto' : 'hidden';
  }

  /* Auto-size then distribute leftover shell width equally across
     every visible column. Rule:
       1. autoSizeAllColumns → each column = MAX(header, widest cell)
          + 24px total (12px each side, from the CSS ag-cell padding).
       2. Measure sum of column widths vs shell.clientWidth.
       3. If shell has leftover space, split it evenly across all
          visible columns (equal px each — NOT proportional). If 10
          extra px and 10 columns, each column gets +1px. Ignores
          columns not currently rendered (hidden/collapsed).
     Reason we do NOT use AG Grid's sizeColumnsToFit: it distributes
     proportionally to column flex, so wide columns eat more of the
     leftover than narrow ones. User wants uniform px. */
  function autoSizeEverything(api, container) {
    if (!api) return;
    try {
      if (typeof api.autoSizeAllColumns === 'function') {
        api.autoSizeAllColumns(false);
      } else if (typeof api.autoSizeColumns === 'function' && typeof api.getColumnState === 'function') {
        const ids = api.getColumnState().map(c => c.colId).filter(Boolean);
        api.autoSizeColumns(ids, false);
      }
      setTimeout(() => distributeLeftover(api, container), 0);
    } catch (err) {
      console.warn('AG Grid auto-size failed', err);
    }
  }

  function distributeLeftover(api, container) {
    if (!api || !container) return;
    const shell = container.closest?.('.ss-grid-shell');
    if (!shell) return;
    const headerCells = container.querySelectorAll?.('.ag-header-cell');
    if (!headerCells || !headerCells.length) return;
    const cols = [];
    let sum = 0;
    for (const cell of headerCells) {
      const colId = cell.getAttribute?.('col-id');
      const w = cell.offsetWidth || 0;
      if (!colId || !w) continue;
      cols.push({ colId, width: w });
      sum += w;
    }
    if (!cols.length) return;
    const shellWidth = shell.clientWidth || 0;
    const leftover = shellWidth - sum;
    if (leftover <= cols.length) return;
    const perColumn = Math.floor(leftover / cols.length);
    if (perColumn <= 0) return;
    const state = cols.map(c => ({ colId: c.colId, width: c.width + perColumn }));
    if (typeof api.applyColumnState === 'function') {
      api.applyColumnState({ state });
    } else if (typeof api.setColumnWidths === 'function') {
      api.setColumnWidths(state.map(s => ({ key: s.colId, newWidth: s.width })));
    }
  }

  /* --- Main factory --------------------------------------------- */
  function create(container, projection, options) {
    const ag = root.agGrid;
    if (!container || !ag || typeof ag.createGrid !== 'function') {
      if (container?.replaceChildren) {
        const doc = container.ownerDocument || root.document;
        const msg = doc?.createElement?.('div');
        if (msg) {
          msg.className = 'ss-grid-empty';
          msg.textContent = 'Grid engine is not available. Reload the extension after the grid files are present.';
          container.replaceChildren(msg);
        }
      }
      return { update() {}, updateRow() { return false; }, deleteRow() { return false; }, destroy() {} };
    }

    const opts = options || {};
    container.classList.add('ss-grid-host', 'ag-theme-shopscout');
    container.classList.toggle('ss-grid-is-matrix', projection?.mode === 'comparisonMatrix');
    container.style.width = '100%';

    const rowData = (projection.rows || []).map(row => Object.assign({}, row));
    const columnDefs = toAgColumns(projection.columns);

    const gridOptions = {
      columnDefs,
      rowData,
      domLayout: 'autoHeight',
      rowHeight: projection?.mode === 'normalizationReview' ? 64
        : projection?.mode === 'userRules' ? 60
        : projection?.mode === 'comparisonMatrix' ? 44
        : 110,
      headerHeight: projection?.mode === 'comparisonMatrix' ? 180 : 42,
      suppressCellFocus: true,
      suppressRowClickSelection: true,
      rowSelection: 'multiple',
      animateRows: false,
      enableCellTextSelection: true,
      ensureDomOrder: true,
      getRowId(params) { return params.data?.id ?? params.data?._id; },
      defaultColDef: {
        sortable: true,
        resizable: true,
        filter: false,
        suppressHeaderMenuButton: true,
        wrapText: false,
        /* Don't let columns flex to fill remaining space — each column
           should be exactly the width needed by its widest cell. */
        flex: 0
      },
      onGridReady(evt) {
        setTimeout(() => {
          autoSizeEverything(evt.api, container);
          fitShellToContent(container);
        }, 0);
      },
      onFirstDataRendered(evt) {
        setTimeout(() => {
          autoSizeEverything(evt.api, container);
          fitShellToContent(container);
        }, 0);
      },
      onColumnResized() { fitShellToContent(container); },
      onColumnVisible() {
        setTimeout(() => {
          autoSizeEverything(gridApi, container);
          fitShellToContent(container);
        }, 0);
      },
      onSortChanged(evt) {
        if (typeof opts.onSortChange !== 'function') return;
        const sort = [];
        evt.api.getColumnState().forEach(col => {
          if (col.sort) sort.push({ field: col.colId, dir: col.sort });
        });
        opts.onSortChange(sort);
      },
      onColumnMoved(evt) {
        if (typeof opts.onColumnOrderChange !== 'function') return;
        opts.onColumnOrderChange(evt.api.getColumnState().map(c => c.colId));
      },
      onCellEditingStopped(evt) {
        if (typeof opts.onCellCommit !== 'function') return;
        opts.onCellCommit({
          row: evt.data,
          field: evt.colDef.field,
          column: evt.colDef,
          value: evt.newValue
        });
      },
      onSelectionChanged(evt) {
        if (typeof opts.onSelectionChange !== 'function') return;
        opts.onSelectionChange(evt.api.getSelectedRows());
      }
    };

    const gridApi = ag.createGrid(container, gridOptions);

    /* Click delegation for [data-ss-grid-action] and .ss-grid-select
       inside the grid. AG Grid's onCellClicked would work but this
       preserves the exact contract shopscoutGrid.js expects. */
    const containerClick = event => {
      const target = event.target;
      const actionBtn = target?.closest?.('[data-ss-grid-action]');
      if (actionBtn) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const cellEl = actionBtn.closest('[row-id]') || actionBtn.closest('.ag-row');
        const rowId = cellEl?.getAttribute?.('row-id');
        const row = rowId != null
          ? rowData.find(r => String(r.id ?? r._id) === String(rowId))
          : null;
        if (typeof opts.onAction === 'function') opts.onAction(actionBtn.dataset.ssGridAction, row);
        return;
      }
      /* Matrix product-header action bar (open/rescan/delete). The
         header component embeds [data-matrix-action] buttons with a
         [data-matrix-product-id] attribute. Route through onAction
         with the productId so comparison.js's existing handler picks
         it up (same shape SlickGrid used). */
      const matrixBtn = target?.closest?.('[data-matrix-action]');
      if (matrixBtn) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const action = matrixBtn.dataset.matrixAction;
        const productId = matrixBtn.dataset.matrixProductId;
        if (typeof opts.onMatrixAction === 'function') {
          opts.onMatrixAction(action, productId);
        } else if (typeof opts.onAction === 'function') {
          opts.onAction(action, { id: productId, _shopScout: { productId } });
        }
        return;
      }
      const checkbox = target?.closest?.('.ss-grid-select');
      if (checkbox) {
        event.stopImmediatePropagation();
        const rowId = checkbox.dataset.rowId;
        const row = rowData.find(r => String(r.id ?? r._id) === String(rowId));
        if (row) row._selected = checkbox.checked;
        if (typeof opts.onSelectionChange === 'function') {
          opts.onSelectionChange(rowData.filter(r => r._selected));
        }
      }
    };
    container.addEventListener('click', containerClick);

    return {
      grid: gridApi,
      update(nextProjection) {
        const nextColumnDefs = toAgColumns(nextProjection.columns);
        gridApi.setGridOption('columnDefs', nextColumnDefs);
        const nextRows = (nextProjection.rows || []).map(r => Object.assign({}, r));
        gridApi.setGridOption('rowData', nextRows);
        rowData.length = 0;
        Array.prototype.push.apply(rowData, nextRows);
        container.classList.toggle('ss-grid-is-matrix', nextProjection?.mode === 'comparisonMatrix');
      },
      updateItem(itemId, nextItem) {
        if (!itemId || !nextItem) return;
        const idx = rowData.findIndex(r => String(r.id) === String(itemId));
        if (idx < 0) return;
        Object.assign(rowData[idx], nextItem);
        gridApi.applyTransaction({ update: [rowData[idx]] });
      },
      updateRow(itemId, nextItem) {
        if (!itemId || !nextItem) return false;
        const idx = rowData.findIndex(r => String(r.id) === String(itemId));
        if (idx < 0) return false;
        Object.assign(rowData[idx], nextItem);
        gridApi.applyTransaction({ update: [rowData[idx]] });
        return true;
      },
      deleteRow(itemId) {
        if (!itemId) return false;
        const idx = rowData.findIndex(r => String(r.id) === String(itemId));
        if (idx < 0) return false;
        const removed = rowData.splice(idx, 1);
        gridApi.applyTransaction({ remove: removed });
        return true;
      },
      flashCell(itemId, field) {
        if (!itemId || !field) return;
        const node = gridApi.getRowNode?.(itemId);
        if (!node) return;
        gridApi.flashCells?.({ rowNodes: [node], columns: [field] });
      },
      destroy() {
        container.removeEventListener('click', containerClick);
        gridApi.destroy?.();
      }
    };
  }

  Object.assign(NS, { create });
})(globalThis);
