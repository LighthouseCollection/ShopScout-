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
    { match: 'amazon.', label: 'Amazon', icon: 'amazon' },
    { match: 'walmart.', label: 'Walmart', icon: 'walmart' },
    { match: 'target.', label: 'Target', icon: 'target' },
    { match: 'bestbuy.', label: 'Best Buy', icon: 'bestbuy' },
    { match: 'newegg.', label: 'Newegg', icon: 'newegg' },
    { match: 'ebay.', label: 'eBay', icon: 'ebay' },
    { match: 'alibaba.', label: 'Alibaba', icon: 'alibaba' },
    { match: 'aliexpress.', label: 'AliExpress', icon: 'aliexpress' },
    { match: 'etsy.', label: 'Etsy', icon: 'etsy' },
    { match: 'costco.', label: 'Costco', icon: 'costco' },
    { match: 'homedepot.', label: 'The Home Depot' },
    { match: 'lowes.', label: "Lowe's" },
    { match: 'wayfair.', label: 'Wayfair' },
    { match: 'shein.', label: 'SHEIN' },
    { match: 'temu.', label: 'Temu' }
  ];

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
      url,
      icon: retailer?.icon || ''
    };
  }

  function retailerIconHtml(icon) {
    if (!icon) return '';
    const src = `https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/${icon}/default.svg`;
    return `<img class="ss-grid-retailer-logo" src="${escAttr(src)}" alt="" aria-hidden="true" loading="lazy">`;
  }

  function htmlForImage(value, item) {
    const src = safeUrl(value);
    if (!src) return '<span class="ss-grid-no-thumb" aria-label="No image"></span>';
    const label = item?.title || 'Product image';
    return `<img class="ss-grid-thumb" src="${escAttr(src)}" alt="${escAttr(label)}">`;
  }

  function htmlForSource(value, item) {
    const info = sourceInfo(value, item);
    const content = `${retailerIconHtml(info.icon)}<span>${esc(info.label)}</span>`;
    if (!info.url) return `<span class="ss-grid-source-pill">${content}</span>`;
    return `<a class="ss-grid-source-pill" href="${escAttr(info.url)}" target="_blank" rel="noopener noreferrer">${content}</a>`;
  }

  function htmlForRating(value, item) {
    const rating = textValue(value).trim();
    const reviews = textValue(item?.reviewCount).trim();
    if (!rating && !reviews) return '<span class="ss-grid-empty">-</span>';
    const numeric = Number(String(rating).replace(/[^0-9.]/g, ''));
    const filled = Number.isFinite(numeric) ? Math.max(0, Math.min(5, Math.round(numeric))) : 0;
    const stars = '★'.repeat(filled) + '☆'.repeat(5 - filled);
    const aria = rating ? ` aria-label="${escAttr(`${rating} out of 5`)}"` : '';
    return `<span class="ss-grid-rating"${aria}><span class="ss-grid-stars" aria-hidden="true">${stars}</span> <span>${esc(rating || '-')}</span></span>${reviews ? ` <span class="ss-grid-sub">(${esc(reviews)})</span>` : ''}`;
  }

  function htmlForPrice(value) {
    const text = textValue(value).trim();
    return text ? `<span class="ss-grid-price">${esc(text)}</span>` : '<span class="ss-grid-empty">-</span>';
  }

  function htmlForSelection(item) {
    if (item?._isGroup) return '';
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

  function htmlForMatrixCell(value) {
    if (!value || typeof value !== 'object') {
      const text = textValue(value).trim();
      return text ? esc(text) : '<span class="ss-grid-empty">Missing</span>';
    }
    if (value.missing) return '<span class="ss-grid-missing">Missing</span>';
    const shown = textValue(value.value || value.corrected || value.raw).trim();
    const raw = textValue(value.raw).trim();
    const corrected = textValue(value.corrected).trim();
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
      return `<span class="ss-grid-matrix-cell"><span class="ss-grid-corrected">${esc(corrected)}</span>`
        + `${raw ? `<span class="ss-grid-was">was ${esc(raw)}</span>` : ''}${confidence}${source}</span>`;
    }
    return `<span class="ss-grid-matrix-cell"><span>${shown ? esc(shown) : '<span class="ss-grid-empty">-</span>'}</span>${confidence}${source}</span>`;
  }

  function cellFormatter(row, cell, value, column, item) {
    if (item?._isGroup) {
      if (column.id === 'title' || column.id === 'attribute') {
        return `<span class="ss-grid-group-label">${esc(item.title || item._group?.value || 'Group')}</span>`;
      }
      return '';
    }
    switch (column.type) {
      case 'selection': return htmlForSelection(item);
      case 'image':     return htmlForImage(value, item);
      case 'source':    return htmlForSource(value, item);
      case 'price':     return htmlForPrice(value);
      case 'rating':    return htmlForRating(value, item);
      case 'matrixCell':return htmlForMatrixCell(value);
      case 'actions':   return htmlForActions();
      default: {
        const text = textValue(value).trim();
        return text ? esc(text) : '<span class="ss-grid-empty">-</span>';
      }
    }
  }

  function sortableComparator(field, direction) {
    const values = root.ShopScoutValues || {};
    const parseNumeric = typeof values.parseNumeric === 'function'
      ? values.parseNumeric
      : value => {
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
      + `<span class="ss-grid-product-head-title" title="${escAttr(label || 'Product')}">${esc(label || 'Product')}</span>`
      + `</span>`;
  }

  function toSlickColumns(columns) {
    const Slick = root.Slick || {};
    const TextEditor = Slick.Editors && Slick.Editors.Text;
    return (columns || []).map(column => ({
      id: column.id,
      field: column.field || column.id,
      name: headerNameForColumn(column),
      type: column.type || 'text',
      width: column.width || undefined,
      minWidth: column.minWidth || column.width || 80,
      maxWidth: column.maxWidth || undefined,
      resizable: true,
      sortable: column.type !== 'selection' && column.type !== 'actions' && column.type !== 'image',
      selectable: column.type !== 'selection' && column.type !== 'actions',
      editor: column.editable && TextEditor ? TextEditor : undefined,
      formatter: cellFormatter,
      cssClass: `ss-grid-cell ss-grid-cell-${column.type || 'text'}${column.type === 'actions' ? ' ss-grid-cell-actions' : ''}`,
      headerCssClass: 'ss-grid-header'
    }));
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
    dataView.beginUpdate();
    dataView.setItems(projection.rows || [], 'id');
    dataView.endUpdate();
    const sort = Array.isArray(projection.sort) ? projection.sort : [];
    if (sort.length) {
      dataView.sort(sortableComparatorChain(sort), true);
    }
    applySortIndicator(grid, projection);
    grid.resizeCanvas();
    grid.render();
  }

  function create(container, projection, options) {
    const Slick = root.Slick;
    if (!container || !Slick || !Slick.Grid || !Slick.Data || !Slick.Data.DataView) {
      renderMissingRuntime(container);
      return {
        update() {},
        destroy() {}
      };
    }

    const opts = options || {};
    const dataView = new Slick.Data.DataView({ inlineFilters: true });
    const columns = toSlickColumns(projection.columns);
    const gridOptions = {
      autoEdit: false,
      editable: true,
      enableCellNavigation: true,
      enableColumnReorder: !!(root.Sortable && typeof root.Sortable.create === 'function'),
      explicitInitialization: false,
      forceFitColumns: false,
      multiColumnSort: true,
      rowHeight: 82,
      showCellSelection: false
    };
    const grid = new Slick.Grid(container, dataView, columns, gridOptions);

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
      if (checkbox && !dataView.getItem(args.row)?._isGroup) {
        event.stopImmediatePropagation();
        const selected = new Set(grid.getSelectedRows ? grid.getSelectedRows() : []);
        if (checkbox.checked) selected.add(args.row);
        else selected.delete(args.row);
        if (grid.setSelectedRows) grid.setSelectedRows([...selected]);
      }
    });

    grid.onDblClick.subscribe((_event, args) => {
      if (typeof opts.onAction === 'function') opts.onAction('open', dataView.getItem(args.row));
    });

    applyProjection(dataView, grid, projection);

    return {
      grid,
      dataView,
      update(nextProjection) {
        grid.setColumns(toSlickColumns(nextProjection.columns));
        applyProjection(dataView, grid, nextProjection);
      },
      updateItem(itemId, nextItem) {
        if (!itemId || !nextItem || !dataView.getItemById || !dataView.updateItem) return;
        if (!dataView.getItemById(itemId)) return;
        dataView.updateItem(itemId, nextItem);
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
