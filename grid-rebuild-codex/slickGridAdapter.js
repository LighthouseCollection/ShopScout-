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

  function htmlForImage(value, item) {
    const src = safeUrl(value);
    if (!src) return '<span class="ss-grid-no-thumb" aria-label="No image"></span>';
    const label = item?.title || 'Product image';
    return `<img class="ss-grid-thumb" src="${escAttr(src)}" alt="${escAttr(label)}">`;
  }

  function htmlForSource(value, item) {
    const text = textValue(value || item?.source || 'Source');
    const url = safeUrl(item?.url);
    if (!url) return `<span class="ss-grid-source-pill">${esc(text)}</span>`;
    return `<a class="ss-grid-source-pill" href="${escAttr(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;
  }

  function htmlForRating(value, item) {
    const rating = textValue(value).trim();
    const reviews = textValue(item?.reviewCount).trim();
    if (!rating && !reviews) return '<span class="ss-grid-empty">-</span>';
    return `<span class="ss-grid-rating">★ ${esc(rating || '-')}</span>${reviews ? ` <span class="ss-grid-sub">(${esc(reviews)})</span>` : ''}`;
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
    return `<details class="ss-grid-action-menu">
      <summary aria-label="Actions" title="Actions">⋮</summary>
      <div class="ss-grid-action-panel">
        <button type="button" data-ss-grid-action="open">Open</button>
        <button type="button" data-ss-grid-action="rescan">Rescan</button>
        <button type="button" data-ss-grid-action="delete">Delete</button>
      </div>
    </details>`;
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
        const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
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

  function toSlickColumns(columns) {
    const Slick = root.Slick || {};
    const TextEditor = Slick.Editors && Slick.Editors.Text;
    return (columns || []).map(column => ({
      id: column.id,
      field: column.field || column.id,
      name: column.name || '',
      type: column.type || 'text',
      width: column.width || undefined,
      minWidth: column.minWidth || 80,
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
      const first = sort[0];
      dataView.sort(sortableComparator(first.field, first.dir), true);
    }
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
      rowHeight: 82
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
      const sortCol = args.sortCol || (args.sortCols && args.sortCols[0]?.sortCol);
      if (!sortCol) return;
      const direction = (args.sortAsc || args.sortCols?.[0]?.sortAsc) ? 'asc' : 'desc';
      dataView.sort(sortableComparator(sortCol.field, direction), true);
      if (typeof opts.onSortChange === 'function') opts.onSortChange([{ field: sortCol.field, dir: direction }]);
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
