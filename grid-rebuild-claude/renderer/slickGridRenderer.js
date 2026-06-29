/* =============================================================
   SlickGrid renderer.
   Detects window.Slick (or window.SlickGrid) once SlickGrid is
   vendored, then instantiates the grid via supported APIs:
   Slick.Grid, Slick.Data.DataView, Slick.Editors, Slick.Plugins.
   No internals are patched.

   When SlickGrid is not yet vendored, render() paints a friendly
   "drop vendor/slickgrid/* per vendor/slickgrid/README.txt"
   placeholder. This lets the rest of the dashboard keep working
   while the library is being added to the package.

   Public API:
     create({ mountEl, repo, store, getProjection, onEdit })
         → { render, destroy, getInstance }

   The renderer never reaches past the projection into repo for
   reads — only edits go through `productEditor.write` via the
   `onEdit` callback the mount supplies.
   ============================================================= */
(function initSlickGridRenderer(root) {
  const NS = (root.ShopScoutGridRenderer = root.ShopScoutGridRenderer || {});
  const ColumnDefs = root.ShopScoutGridColumnDefs;
  const Editor = root.ShopScoutGridEdits;

  function hasSlickGrid() {
    return !!(root.Slick && root.Slick.Grid);
  }

  function placeholder(mountEl) {
    if (!mountEl) return;
    mountEl.innerHTML = ''
      + '<div class="sg-empty">'
      +   '<h2>SlickGrid not yet vendored.</h2>'
      +   '<p>Drop the SlickGrid Universal UMD build into '
      +     '<code>vendor/slickgrid/</code> and reload. See '
      +     '<code>vendor/slickgrid/README.txt</code> for the file list.</p>'
      +   '<p>Product capture, detail page, AI analysis, settings, and '
      +     'all other dashboard flows continue to work normally.</p>'
      + '</div>';
  }

  function create(options) {
    const opts = options || {};
    const mountEl = opts.mountEl;
    const store = opts.store;
    const onEdit = typeof opts.onEdit === 'function' ? opts.onEdit : (() => {});
    let grid = null;
    let dataView = null;
    let destroyed = false;

    function render() {
      if (destroyed) return;
      if (!hasSlickGrid()) { placeholder(mountEl); return; }
      ensureGridInstance();
      const projection = typeof opts.getProjection === 'function' ? opts.getProjection() : null;
      if (!projection) return;
      const columns = ColumnDefs.build(projection, { allowEditing: projection.kind === 'rows' });
      grid.setColumns(columns.map(toSlickColumn));
      dataView.beginUpdate();
      dataView.setItems(projection.rows || [], idForProjection(projection));
      applyFilterAndSort(projection);
      dataView.endUpdate();
      grid.invalidate();
      grid.render();
    }

    function ensureGridInstance() {
      if (grid || !hasSlickGrid()) return;
      const Slick = root.Slick;
      dataView = new Slick.Data.DataView({ inlineFilters: true });
      grid = new Slick.Grid(mountEl, dataView, [], {
        enableColumnReorder: true,
        forceFitColumns: false,
        editable: true,
        autoEdit: false,
        enableCellNavigation: true,
        rowHeight: 36,
        headerRowHeight: 32,
        explicitInitialization: false,
        multiColumnSort: true
      });
      grid.setSelectionModel(new Slick.RowSelectionModel({ selectActiveRow: false }));

      /* Wire the DataView ↔ Grid binding using public Slick events. */
      dataView.onRowCountChanged.subscribe(() => { grid.updateRowCount(); grid.render(); });
      dataView.onRowsChanged.subscribe((_e, args) => { grid.invalidateRows(args.rows); grid.render(); });

      /* Sort + column reorder + resize → dispatch back to the store
         so saved-view state stays in sync. */
      grid.onSort.subscribe((_e, args) => {
        const sortCols = Array.isArray(args.sortCols) ? args.sortCols : [args];
        const sort = sortCols.map(s => ({
          field: s.sortCol && s.sortCol.field,
          dir: s.sortAsc ? 'asc' : 'desc'
        })).filter(s => s.field);
        if (store) store.dispatch({ sort });
      });
      grid.onColumnsReordered.subscribe(() => {
        const order = grid.getColumns().map(c => c.id);
        if (store) store.dispatch({ columnOrder: order });
      });
      grid.onColumnsResized.subscribe(() => {
        const widths = {};
        for (const c of grid.getColumns()) widths[c.id] = c.width;
        if (store) store.dispatch({ columnWidths: widths });
      });

      /* Cell edit commit → revision-safe write through productEditor. */
      grid.onCellChange.subscribe(async (_e, args) => {
        const col = grid.getColumns()[args.cell];
        const item = args.item || dataView.getItem(args.row);
        if (!col || !item) return;
        const field = col.field;
        const value = item[field];
        try {
          const result = await onEdit({ productId: item.id, field, value });
          if (!result || result.ok === false) {
            /* Refresh the row from the latest stored product so the
               visual reverts to the canonical value. */
            if (result && result.product) {
              dataView.updateItem(item.id, Object.assign({}, item, result.product));
            }
            highlightConflict(args.row, args.cell);
          }
        } catch (err) {
          console.warn('Grid edit failed', err);
        }
      });
    }

    function applyFilterAndSort(projection) {
      if (!dataView) return;
      const filters = Array.isArray(projection.filters) ? projection.filters : [];
      const sort = Array.isArray(projection.sortBy) ? projection.sortBy : [];
      dataView.setFilter(item => evalFilters(item, filters));
      if (sort.length) {
        dataView.sort((a, b) => compareBySort(a, b, sort));
      }
    }

    function highlightConflict(rowIdx, cellIdx) {
      if (!grid) return;
      const node = grid.getCellNode(rowIdx, cellIdx);
      if (!node) return;
      node.classList.add('sg-cell-conflict');
      setTimeout(() => node.classList.remove('sg-cell-conflict'), 1800);
    }

    function destroy() {
      destroyed = true;
      if (grid && typeof grid.destroy === 'function') {
        try { grid.destroy(); } catch (_) {}
      }
      grid = null;
      dataView = null;
      if (mountEl) mountEl.innerHTML = '';
    }

    function getInstance() { return { grid, dataView }; }

    /* Initial paint. */
    render();

    return { render, destroy, getInstance };
  }

  function toSlickColumn(col) {
    /* Strip non-Slick metadata before handing to grid. */
    const out = Object.assign({}, col);
    delete out._meta;
    delete out.editorHint;
    return out;
  }

  function idForProjection(projection) {
    if (!projection) return 'id';
    if (projection.kind === 'rows') return 'id';
    /* Projection B uses synthesized __id on each SpecRow record. */
    return '__id';
  }

  function evalFilters(row, filters) {
    if (!filters.length) return true;
    let acc = true, started = false;
    for (const f of filters) {
      let match = true;
      const v = row[f.field];
      switch (f.op) {
        case 'eq':       match = String(v ?? '') === String(f.value ?? ''); break;
        case 'neq':      match = String(v ?? '') !== String(f.value ?? ''); break;
        case 'contains': match = String(v ?? '').toLowerCase().includes(String(f.value ?? '').toLowerCase()); break;
        case 'empty':    match = v == null || v === ''; break;
        case 'notempty': match = v != null && v !== ''; break;
        case 'gt':       match = parseFloat(v) >  parseFloat(f.value); break;
        case 'lt':       match = parseFloat(v) <  parseFloat(f.value); break;
        case 'gte':      match = parseFloat(v) >= parseFloat(f.value); break;
        case 'lte':      match = parseFloat(v) <= parseFloat(f.value); break;
        default:         match = true;
      }
      if (!started) { acc = match; started = true; continue; }
      acc = f.conj === 'or' ? (acc || match) : (acc && match);
    }
    return acc;
  }

  function compareBySort(a, b, sortList) {
    for (const s of sortList) {
      const av = a[s.field], bv = b[s.field];
      const an = Number(String(av ?? '').replace(/[^\d.-]/g, ''));
      const bn = Number(String(bv ?? '').replace(/[^\d.-]/g, ''));
      let cmp;
      if (!isNaN(an) && !isNaN(bn)) cmp = an - bn;
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      if (cmp !== 0) return s.dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  }

  /* Silence unused-import warning when Editor isn't wired into the
     onCellChange path yet. The mount.js layer composes Editor +
     renderer; this file just routes the event. */
  void Editor;

  Object.assign(NS, { create, hasSlickGrid });
})(globalThis);
