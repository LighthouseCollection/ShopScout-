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

  function renderRating(params) {
    const rating = textValue(params.value).trim();
    const reviews = textValue(params.data?.reviewCount).trim();
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

  /* --- Column definition builder -------------------------------- */
  function columnTypeRenderer(column) {
    if (column.type === 'selection') return renderSelection;
    if (column.type === 'image') return renderImage;
    if (column.type === 'brand') return renderBrand;
    if (column.type === 'source') return renderSource;
    if (column.type === 'price') return renderPrice;
    if (column.type === 'rating') return renderRating;
    if ((column.field || column.id) === 'title') return renderTitle;
    return renderPlain;
  }

  function columnMinWidth(column) {
    if (column.type === 'selection') return 40;
    if (column.type === 'image') return 108;
    if ((column.field || column.id) === 'title') return 200;
    if (column.type === 'rating') return 140;
    if (column.type === 'brand' || column.type === 'source') return 110;
    if (column.type === 'price') return 90;
    return 80;
  }

  function toAgColumns(columns) {
    return (columns || []).map(column => {
      const field = column.field || column.id;
      const colDef = {
        colId: column.id,
        field,
        headerName: (column.name || '').replace(/<[^>]+>/g, '').trim(),
        cellRenderer: columnTypeRenderer(column),
        cellRendererParams: { ssType: column.type || 'text' },
        sortable: !['selection','image','actions'].includes(column.type),
        resizable: true,
        suppressMovable: column.type === 'selection' || column.type === 'image',
        minWidth: columnMinWidth(column),
        hide: !!column.defaultHidden,
        editable: !!column.editable,
        cellClass: `ss-grid-cell ss-grid-cell-${column.type || 'text'}`,
        headerClass: 'ss-grid-header'
      };
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
    if (!canvasWidth) return;
    const doc = shell.ownerDocument || root.document;
    const viewportInner = (doc?.documentElement?.clientWidth || root.innerWidth || 1400) - 40;
    const mode = shell.getAttribute('data-shell-width') === 'full' ? 'full' : 'fit';
    /* Content-hug for tight tables; full viewport when the user
       explicitly picks Full. +2 absorbs subpixel rounding. */
    const cap = mode === 'full' ? viewportInner : Math.max(800, Math.round(viewportInner * 0.85));
    const target = Math.min(canvasWidth + 2, cap, viewportInner);
    shell.style.width = target + 'px';
    shell.style.overflowX = canvasWidth > shell.clientWidth + 2 ? 'auto' : 'hidden';
  }

  function autoSizeEverything(api) {
    if (!api) return;
    try {
      if (typeof api.autoSizeAllColumns === 'function') {
        api.autoSizeAllColumns(false);
        return;
      }
      if (typeof api.autoSizeColumns === 'function' && typeof api.getColumnState === 'function') {
        const ids = api.getColumnState().map(c => c.colId).filter(Boolean);
        api.autoSizeColumns(ids, false);
      }
    } catch (err) {
      console.warn('AG Grid auto-size failed', err);
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
          autoSizeEverything(evt.api);
          fitShellToContent(container);
        }, 0);
      },
      onFirstDataRendered(evt) {
        setTimeout(() => {
          autoSizeEverything(evt.api);
          fitShellToContent(container);
        }, 0);
      },
      onColumnResized() { fitShellToContent(container); },
      onColumnVisible() {
        setTimeout(() => {
          autoSizeEverything(gridApi);
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
