/* =============================================================
   comparison-db.js — Database view (Tabulator) + Pivot view (PivotTable.js)
   Bound to the IndexedDB-backed SSProductRepo + SSViewsRepo.
   Hidden until the user clicks data-view="database".
   Loaded AFTER comparison.js so the existing view-toggle handler runs first
   and sets currentView; we react to the click and toggle visibility.
   ============================================================= */
(function initDatabaseView(root) {
  const repo  = root.SSProductRepo;
  const views = root.SSViewsRepo;
  const Tabulator = root.Tabulator;
  const $ = root.jQuery || root.$;
  const Table = root.ShopScoutTable || {};
  const tableUtils = Table.utils;
  const productRows = Table.productRows;
  if (!tableUtils || !productRows || !Table.rowActions || !Table.columnsMenu) {
    throw new Error('comparison-db: table modules must load before comparison-db.js');
  }
  const esc = tableUtils.escapeHtml;
  const escapeHtml = tableUtils.escapeHtml;
  const numericSorter = tableUtils.numericSorter;
  const truncate = tableUtils.truncate;

  let tabulator   = null;
  let currentMode = 'grid';            // 'grid' | 'pivot'
  let currentViewId = null;
  let rowActionsMenu = null;
  let columnsMenu = null;
  const STATUS = () => document.getElementById('dbViewStatus');

  /* ===== Column model for Tabulator =====
     Mirrors the legacy COLUMNS array but expressed in Tabulator's language. */
  /* Header context menu — Tabulator's native column visibility / freeze / hide UI.
     Replaces the modals we ripped out of the View ribbon. */
  function headerMenu() {
    const menu = [];
    const cols = (tabulator && tabulator.getColumns()) || [];
    for (const c of cols) {
      const def = c.getDefinition();
      if (def.field === 'thumb' || def.field === 'title') continue; // never hide these
      menu.push({
        label: (c.isVisible() ? '☑  ' : '☐  ') + (def.title || def.field),
        action(e) { e.stopPropagation(); c.toggle(); }
      });
    }
    return menu;
  }

  /* Default visible columns are the ones a shopper actually reads on first glance:
     selection, thumb, title, brand, source, price, rating, category, actions.
     Everything else (identifiers, manufacturer, seller, used/shipping price,
     reviews count, captured date) is hidden by default and reachable through
     the Columns dropdown in the View ribbon. This keeps the grid inside the
     viewport (no horizontal scroll) until the user explicitly adds columns. */
  /* Column widths follow Tabulator's documented widthGrow pattern: every data
     column has an explicit width and widthGrow:0; only the Title column grows
     to absorb extra space on wide screens. This stops the layout from
     stretching narrow columns (Brand, Price, Rating) across the screen. */
  /* BASE columns split into three slots:
       - LEFT_FROZEN: selection, thumb, title (always visible, frozen left)
       - DATA_VISIBLE: brand, source, price, rating, category — the always-visible
         data columns (mirroring the prior default).
       - DATA_HIDDEN: every legacy field that exists on a product but isn't
         frequently consulted. Off by default, surfaced through the Columns
         dropdown in the View ribbon.
     Spec columns derived from product.specs[] are appended at runtime in
     buildSpecColumns(rows). Row actions stay LAST and frozen for right-pin.
  */
  /* System columns keep fixed pixel widths so the checkbox / thumbnail / actions
     button always look identical. Data columns use minWidth only — Tabulator's
     fitDataFill layout sizes them to their longest content. */
  const LEFT_FROZEN = [
    { title: '',         field: 'rowSelect',    formatter: 'rowSelection', titleFormatter: 'rowSelection', headerSort: false, hozAlign: 'center', headerHozAlign: 'center', width: 36, minWidth: 36, frozen: true, resizable: false, cssClass: 'col-row-select' },
    { title: '',         field: 'thumb',        formatter: cellThumb, width: 72, minWidth: 72, headerSort: false, frozen: true, headerHozAlign: 'center', hozAlign: 'center', resizable: false, cssClass: 'col-thumb' },
    { title: 'Title',    field: 'title',        sorter: 'string', headerFilter: 'input', headerFilterPlaceholder: 'Filter title...', frozen: true, minWidth: 240, formatter: cellTitle, headerMenu }
  ];

  /* Editable cells: My Rating + Notes. Values persist back to the
     product object on edit via cellEdited → saveRowData(). Both sit
     immediately after the Title column per UX. */
  const EDITABLE_COLS = [
    { title: 'My Rating',
      field: 'userRating',
      sorter: numericSorter,
      hozAlign: 'left',
      headerHozAlign: 'left',
      headerFilter: 'input',
      headerFilterFunc: numericOperatorFilter,
      headerFilterPlaceholder: '>=4, =5…',
      minWidth: 110,
      headerMenu,
      formatter: cellMyRating,
      cellClick(e, cell) { onMyRatingClick(e, cell); }
    },
    { title: 'Notes',
      field: 'notes',
      sorter: 'string',
      editor: 'input',
      headerFilter: 'input',
      headerFilterPlaceholder: 'contains…',
      minWidth: 160,
      width: 180,
      headerMenu,
      formatter: cellNotes,
      cellEdited: saveRowData
    }
  ];

  const DATA_VISIBLE = [
    { title: 'Brand',    field: 'brand',        sorter: 'string', headerFilter: 'input', headerFilterPlaceholder: 'brand', minWidth: 100, headerMenu,
      formatter(cell) {
        const CF = globalThis.SSCellFormatters;
        return CF ? CF.cellPill(cell) : esc(String(cell.getValue() || ''));
      }
    },
    { title: 'Source',   field: 'source',       sorter: 'string', headerFilter: 'list', headerFilterParams: { valuesLookup: true, clearable: true }, formatter: cellSourcePill, minWidth: 90, headerMenu,
      cellClick(e) {
        if (e.target && e.target.closest && e.target.closest('a.src-pill')) e.stopPropagation();
      }
    },
    { title: 'Price',    field: 'newPrice',     sorter: numericSorter, hozAlign: 'right', headerHozAlign: 'right',
      headerFilter: 'input', headerFilterFunc: numericOperatorFilter, headerFilterPlaceholder: '>100, <50, 10-20…',
      formatter(cell) {
        const v = cell.getValue();
        if (v == null || v === '') return '<span class="db-cell-empty">&mdash;</span>';
        const n = Number(String(v).replace(/[^\d.-]/g, ''));
        const text = isFinite(n) ? '$' + n.toFixed(2) : esc(v);
        const row = cell.getRow().getData();
        const rank = row._ssRanks && row._ssRanks.newPrice;
        const cls = rank === 'best' ? ' ss-best-in-row' : '';
        return '<span class="ss-cell-val' + cls + '">' + text + '</span>';
      }, minWidth: 80, headerMenu },
    { title: 'Rating',   field: 'rating',       sorter: numericSorter, hozAlign: 'right', headerHozAlign: 'right',
      headerFilter: 'input', headerFilterFunc: numericOperatorFilter, headerFilterPlaceholder: '>=4, =5…',
      formatter(cell) {
        const CF = globalThis.SSCellFormatters;
        if (CF) {
          /* cellStarsVisual returns the markup; if this row has the best
             rating, wrap it in the ss-best-in-row tint. */
          const inner = CF.cellStarsVisual(cell);
          const row = cell.getRow().getData();
          const rank = row._ssRanks && row._ssRanks.rating;
          return rank === 'best' ? '<span class="ss-best-in-row">' + inner + '</span>' : inner;
        }
        return cellStars(cell);
      }, minWidth: 130, headerMenu }
  ];

  /* Every legacy field — kept as hidden columns so the Columns dropdown can
     reveal them. Mirrors the pre-strip column set. */
  const DATA_HIDDEN = [
    { title: 'Category',     field: 'category',      sorter: 'string', headerFilter: 'input', headerMenu, visible: false, widthGrow: 0, width: 140 },
    { title: 'Manufacturer', field: 'manufacturer',  sorter: 'string', headerFilter: 'input', headerMenu, visible: false, widthGrow: 0, width: 160 },
    { title: 'Seller',       field: 'sellerName',    sorter: 'string', headerFilter: 'input', headerMenu, visible: false, widthGrow: 0, width: 160 },
    { title: 'Used price',   field: 'usedPrice',     sorter: numericSorter, hozAlign: 'right', headerHozAlign: 'right', formatter: cellMoney, headerMenu, visible: false, widthGrow: 0, width: 100 },
    { title: 'Shipping',     field: 'shippingPrice', sorter: numericSorter, hozAlign: 'right', headerHozAlign: 'right', formatter: cellMoney, headerMenu, visible: false, widthGrow: 0, width: 100 },
    { title: 'Reviews',      field: 'reviewCount',   sorter: numericSorter, hozAlign: 'right', headerHozAlign: 'right', formatter: cellNumber, headerMenu, visible: false, widthGrow: 0, width: 100 },
    { title: 'Model name',   field: 'modelName',     sorter: 'string', headerFilter: 'input', headerMenu, visible: false, widthGrow: 0, width: 160 },
    { title: 'Model number', field: 'modelNumber',   sorter: 'string', headerFilter: 'input', headerMenu, visible: false, widthGrow: 0, width: 140 },
    { title: 'SKU',          field: 'sku',           sorter: 'string', headerFilter: 'input', headerMenu, visible: false, widthGrow: 0, width: 140 },
    { title: 'ASIN',         field: 'asin',          sorter: 'string', headerFilter: 'input', headerMenu, visible: false, widthGrow: 0, width: 120 },
    { title: 'UPC',          field: 'upc',           sorter: 'string', headerFilter: 'input', headerMenu, visible: false, widthGrow: 0, width: 140 },
    { title: 'MPN',          field: 'mpn',           sorter: 'string', headerFilter: 'input', headerMenu, visible: false, widthGrow: 0, width: 140 },
    { title: 'GTIN',         field: 'gtin',          sorter: 'string', headerFilter: 'input', headerMenu, visible: false, widthGrow: 0, width: 140 },
    { title: 'Availability', field: 'availability',  sorter: 'string', headerFilter: 'input', headerMenu, visible: false, widthGrow: 0, width: 140 },
    { title: 'Notes',        field: 'notes',         sorter: 'string', headerFilter: 'input', headerMenu, visible: false, widthGrow: 0, width: 200 },
    { title: 'URL',          field: 'url',           sorter: 'string', headerFilter: 'input', headerMenu, visible: false, widthGrow: 0, width: 240 },
    { title: 'Captured',     field: 'capturedAt',    sorter: numericSorter, hozAlign: 'right', headerHozAlign: 'right', formatter: cellDate, headerMenu, visible: false, widthGrow: 0, width: 130 }
  ];

  const ROW_ACTIONS_COL = { title: '', field: 'rowActions', formatter: cellRowActions, headerSort: false, hozAlign: 'center', headerHozAlign: 'center', width: 44, minWidth: 44, frozen: true, resizable: false, widthGrow: 0,
    cellClick(e, cell) { e.stopPropagation(); openRowActionsMenu(e.target.closest('button'), cell.getRow()); }
  };

  /* Build column definitions for every canonical spec key found in the rows.
     Visible-by-default keys are picked by the heuristic; the rest are hidden
     and reachable through the Columns dropdown. The field name is prefixed
     with "spec:" so it never collides with a top-level product field. */
  function buildSpecColumns(rows) {
    const SH = globalThis.SSSpecHeuristic;
    const CF = globalThis.SSCellFormatters;
    if (!SH) return [];
    const allKeys = SH.allSpecKeys(rows);
    if (!allKeys.length) return [];
    const container = document.getElementById('dbViewGrid');
    const containerWidth = (container && container.clientWidth) || 1280;
    const maxFit = SH.maxSpecColumnsForWidth(containerWidth);
    const visibleSet = new Set(SH.pickDefaultSpecColumns(rows, { topN: maxFit, minCoverage: 0.5 }));
    return allKeys.map(key => {
      const field = 'spec:' + key;
      /* Detect cell flavor across the rows. Yes/No → green/pink pill;
         numeric → right-aligned + best-in-row rank; otherwise → stable-
         color pill via cellWithRank's automatic fallback. */
      const isYesNo   = CF && CF.isYesNoField(rows, field);
      const isNumeric = !isYesNo && CF && CF.isNumericField(rows, field);
      if (isNumeric && CF) {
        CF.computeRanks(rows, field, CF.polarityForField(field));
      }
      let formatter;
      if (isYesNo && CF) formatter = CF.cellYesNo;
      else if (CF)       formatter = CF.cellWithRank({ field });
      else               formatter = (cell) => {
        const v = cell.getValue();
        if (v == null || v === '') return '<span class="db-cell-empty">&mdash;</span>';
        return esc(String(v));
      };
      const sorter = isNumeric && CF
        ? function(a, b) {
            const an = CF.parseNumeric(a), bn = CF.parseNumeric(b);
            if (an === bn) return 0;
            if (!isFinite(an)) return -1;
            if (!isFinite(bn)) return 1;
            return an - bn;
          }
        : 'string';
      /* Filter behavior:
         - Numeric columns: parse operator syntax (>, <, >=, <=, =, range
           "10-20"). Plain numbers do substring contains for compatibility.
         - String columns: standard substring (Tabulator's default "like"). */
      const headerFilterFunc = isNumeric && CF ? numericOperatorFilter : 'like';
      const headerFilterPlaceholder = isNumeric ? '>100, <50, 10-20…' : 'contains…';
      return {
        title: key,
        field,
        sorter,
        headerFilter: 'input',
        headerFilterFunc,
        headerFilterPlaceholder,
        headerMenu,
        visible: visibleSet.has(key),
        minWidth: 90,
        hozAlign: isNumeric ? 'right' : 'left',
        headerHozAlign: isNumeric ? 'right' : 'left',
        formatter
      };
    });
  }

  /* Tabulator's headerFilterFunc — delegates to the canonical operator
     parser in SSCellFormatters so the grid and the inverted-view
     row-filter share identical semantics. */
  function numericOperatorFilter(headerValue, rowValue) {
    const CF = globalThis.SSCellFormatters;
    return CF && CF.matchOperatorFilter
      ? CF.matchOperatorFilter(headerValue, rowValue)
      : true;
  }

  /* ===== Row actions popover ===== */
  function getRowActionsMenu() {
    if (!rowActionsMenu) {
      rowActionsMenu = Table.rowActions.create({
        document,
        window,
        repo,
        getTabulator: () => tabulator,
        setStatus
      });
    }
    return rowActionsMenu;
  }
  function openRowActionsMenu(anchor, row) {
    getRowActionsMenu().open(anchor, row);
  }

  function cellMoney(cell) {
    const v = cell.getValue();
    if (v == null || v === '') return '<span class="db-cell-empty">&mdash;</span>';
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    return isFinite(n) ? '$' + n.toFixed(2) : esc(v);
  }

  function cellNumber(cell) {
    const v = cell.getValue();
    if (v == null || v === '') return '<span class="db-cell-empty">&mdash;</span>';
    const n = Number(v);
    return isFinite(n) ? n.toLocaleString() : esc(v);
  }

  function cellDate(cell) {
    const v = cell.getValue();
    if (!v) return '<span class="db-cell-empty">&mdash;</span>';
    const d = new Date(Number(v));
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }

  /* Title + model subline. Titles longer than 40 chars are truncated with
     an ellipsis; the full title is preserved in the title attribute so the
     browser native tooltip shows it on hover. */
  const TITLE_MAX = 40;
  function cellTitle(cell) {
    const row = cell.getRow().getData();
    /* Apply the dedup heuristic to the raw stored title so legacy
       captures rendered before the extractor learned to dedup still
       display cleanly ("Shark | Shark AV2511AE | AV2511AE" →
       "Shark | AV2511AE", etc.). */
    const SS = globalThis.SS;
    const raw = String(row.title || '(untitled)');
    const full = SS && SS.dedupProductName ? SS.dedupProductName(raw) : raw;
    const short = truncate(full, TITLE_MAX);
    /* Suppress the sub-line model when it's already inside the title
       so we don't repeat the same number above + below. */
    let sub = row.modelNumber || row.modelName || '';
    if (sub && full.toLowerCase().includes(String(sub).toLowerCase())) sub = '';
    return '<div class="db-cell-title" title="' + esc(full) + '">' + esc(short) +
           (sub ? '<div class="db-cell-sub">' + esc(sub) + '</div>' : '') + '</div>';
  }

  /* Thumbnail — 56x56, falls back to the canonical .prod-thumb placeholder. */
  function cellThumb(cell) {
    const row = cell.getRow().getData();
    const src = row.image || row.imageUrl || '';
    if (!src) return '<span class="prod-thumb db-thumb"></span>';
    return '<span class="prod-thumb db-thumb"><img src="' + esc(src) + '" alt="" referrerpolicy="no-referrer"></span>';
  }

  /* Source as a text pill with stable per-source color so Amazon is
     always one color, eBay another, etc. — but no monogram badge.
     If the row has a URL, the pill is wrapped in an anchor that opens
     in a new tab (rowClick already skips anchor targets). */
  function cellSourcePill(cell) {
    const v = cell.getValue();
    if (!v) return '<span class="db-cell-empty">&mdash;</span>';
    const row = cell.getRow().getData();
    const sanitize = (globalThis.SS && globalThis.SS.sanitizeUrl) ? globalThis.SS.sanitizeUrl : (u => /^https?:\/\//i.test(u) ? u : '');
    const safe = sanitize(row.url);
    const CF = globalThis.SSCellFormatters;
    const text = String(v);
    const c = CF && CF.stableColor ? CF.stableColor(text) : null;
    const style = c ? ' style="background:' + c.bg + ';color:' + c.fg + ';border-color:' + c.border + '"' : '';
    const inner = '<span class="src-pill ss-pill"' + style + '>' + esc(text) + '</span>';
    if (safe) {
      return '<a class="src-pill-link" href="' + esc(safe) + '" target="_blank" rel="noopener noreferrer" title="Open ' + esc(text) + ' product page">' + inner + '</a>';
    }
    return inner;
  }

  /* Row actions cell — three-dot menu. Click opens a popover with
     Edit, Open link, Rescan, Delete. Built lazily in onRowActionsClick. */
  function cellRowActions(_cell) {
    return '<button type="button" class="db-row-actions-btn" data-row-actions title="Row actions">' +
           '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg>' +
           '</button>';
  }

  /* My Rating — five-star clickable rating stored per product as
     product.userRating (0-5). Click a star to set; click the same star
     again to clear. */
  function cellMyRating(cell) {
    const v = Number(cell.getValue() || 0);
    const row = cell.getRow().getData();
    /* Reverse DOM order so the CSS `:hover ~ span` trick works (see
       theme.css ▸ .db-myrating). data-current carries the persisted
       value so mouseleave can restore the display. */
    let html = '<span class="db-myrating" role="radiogroup" aria-label="My rating" '
      + 'data-myrating-widget data-current="' + v + '" '
      + 'data-product-id="' + esc(row.id || '') + '" '
      + 'data-product-url="' + esc(row.url || '') + '">';
    for (let i = 5; i >= 1; i--) {
      const cls = i <= v ? 'db-myrating-on' : 'db-myrating-off';
      html += '<span class="' + cls + '" data-myrating="' + i + '" title="' + i + ' star' + (i > 1 ? 's' : '') + '">&#9733;</span>';
    }
    html += '</span>';
    return html;
  }
  async function onMyRatingClick(e, cell) {
    const star = e.target && e.target.closest && e.target.closest('[data-myrating]');
    if (!star) return;
    e.stopPropagation();
    const next = parseInt(star.dataset.myrating, 10);
    const current = Number(cell.getValue() || 0);
    /* Click the same star twice to clear back to 0. */
    const newVal = next === current ? 0 : next;
    cell.setValue(newVal);
    const row = cell.getRow().getData();
    row.userRating = newVal;
    await saveRowData(cell);
  }

  /* Notes — truncated display, full text editable on click via Tabulator's
     built-in editor (input). 20 visible characters before ellipsis as
     spec'd. Full text shown on hover via title attribute. */
  function cellNotes(cell) {
    const v = cell.getValue();
    if (v == null || v === '') return '<span class="db-cell-empty">add note…</span>';
    const text = String(v);
    const display = text.length > 20 ? text.slice(0, 20).trimEnd() + '…' : text;
    return '<span class="db-notes" title="' + esc(text) + '">' + esc(display) + '</span>';
  }

  /* Persist the row's current data back to the productRepo and to
     chrome.storage.local so popup + dashboard stay in sync. Called by
     Tabulator after any inline edit. */
  async function saveRowData(cell) {
    const data = cell.getRow().getData();
    if (!data || !data.id) return;
    try {
      if (repo && repo.updateProduct) {
        const result = await repo.updateProduct(data.id, data, {
          listId: data.listId,
          baseRevision: data._revision,
          source: 'table-edit'
        });
        if (result && result.ok === false) {
          if (result.reason === 'revision-conflict') {
            setStatus('Edit not saved: this product changed elsewhere. Row refreshed.');
            if (result.product && cell.getRow && cell.getRow().update) {
              const refreshed = productRows.flattenSpecs([result.product], { root })[0];
              cell.getRow().update(refreshed);
            }
            return;
          }
          setStatus('Edit not saved: ' + (result.reason || 'update failed') + '.');
          return;
        }
        if (result && result.product && cell.getRow && cell.getRow().update) {
          const refreshed = productRows.flattenSpecs([result.product], { root })[0];
          cell.getRow().update(refreshed);
        }
      }
    } catch (err) { console.warn('updateProduct failed', err); }
    /* Mirror back into chrome.storage.local so the legacy popup view
       picks up the edit too. */
    try {
      const chrome = globalThis.browser || globalThis.chrome;
      if (!chrome || !chrome.storage) return;
      const stored = await chrome.storage.local.get('shopscout_data');
      const blob = stored.shopscout_data;
      if (!blob || !blob.lists) return;
      for (const name of Object.keys(blob.lists)) {
        const arr = blob.lists[name];
        if (!Array.isArray(arr)) continue;
        const idx = arr.findIndex(p => p.id === data.id || p.url === data.url);
        if (idx >= 0) {
          arr[idx] = Object.assign({}, arr[idx], { userRating: data.userRating, notes: data.notes });
        }
      }
      await chrome.storage.local.set({ shopscout_data: blob });
    } catch (err) { console.warn('saveRowData chrome.storage mirror failed', err); }
  }

  /* Local alias for the canonical helper in utils.js. Kept as a tiny
     wrapper so existing call sites read clearly and we tolerate
     SS not being loaded yet (defensive). */
  function unwrapStored(v) {
    const SS = root.SS;
    return SS && SS.unwrapWrappedValue ? SS.unwrapWrappedValue(v) : (v == null ? '' : String(v));
  }

  /* Rating with star, count tucked beneath. The review-count field often comes
     in as "1,234 ratings" or similar — strip non-digits before parsing so the
     cell shows "(1,234)" instead of "(NaN)". */
  function cellStars(cell) {
    const row = cell.getRow().getData();
    const raw = cell.getValue();
    const v = unwrapStored(raw);
    if (!v) return '<span class="db-cell-empty">&mdash;</span>';
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    if (!isFinite(n)) return '<span class="db-cell-empty">&mdash;</span>';
    const stars = n.toFixed(1);
    const cntRaw = unwrapStored(row.reviewCount);
    const cntNum = Number(String(cntRaw || '').replace(/[^\d]/g, ''));
    const cntStr = (isFinite(cntNum) && cntNum > 0)
      ? ' <span class="db-cell-sub">(' + cntNum.toLocaleString() + ')</span>'
      : '';
    return '<span class="db-cell-stars">&#9733; ' + stars + cntStr + '</span>';
  }

  function setStatus(text) {
    const el = STATUS();
    if (el) el.textContent = text || '';
  }

  /* ===== Visibility / mode swap =====
     Database view is the ONLY product view now. show()/hide() are kept for
     symmetry but in practice the view is always shown after init. */
  function show() {
    const dbView = document.getElementById('dbView');
    if (dbView) dbView.hidden = false;
  }
  function hide() {
    const dbView = document.getElementById('dbView');
    if (dbView) dbView.hidden = true;
  }
  function showMode(mode) {
    currentMode = mode;
    const grid  = document.getElementById('dbViewGrid');
    const pivot = document.getElementById('dbViewPivot');
    if (grid)  grid.hidden  = (mode !== 'grid');
    if (pivot) pivot.hidden = (mode !== 'pivot');
    /* Grid / Invert / Pivot are mutually exclusive — only one
       layout button is active at a time. While the inverted view is
       on, neither Grid nor Pivot show as selected; only Invert does. */
    document.querySelectorAll('[data-db-mode]').forEach(b => {
      const isCurrent = (b.dataset.dbMode === mode) && !inverted;
      b.classList.toggle('active', isCurrent);
    });
    const invBtn = document.getElementById('dbInvertBtn');
    if (invBtn) {
      invBtn.classList.toggle('active', inverted);
      invBtn.setAttribute('aria-pressed', inverted ? 'true' : 'false');
    }
  }

  /* ===== Data ===== */
  async function loadRows() {
    if (!repo) throw new Error('SSProductRepo not loaded — check data/ script order');
    const listId = await repo.getActiveListId();
    if (!listId) return [];
    const view = currentViewId ? await views.getView(currentViewId) : null;
    const raw = await repo.query(listId, view || {});
    return productRows.flattenSpecs(raw, { root });
  }

  /* ===== Grid (Tabulator) ===== */
  async function renderGrid() {
    if (!Tabulator) {
      document.getElementById('dbViewGrid').innerHTML =
        '<div class="empty-state"><div class="es-icon">!</div>' +
        '<div class="es-title">Tabulator not loaded</div>' +
        '<div class="es-body">Drop vendor/tabulator.min.js and vendor/tabulator.min.css per vendor/README.md.</div></div>';
      return;
    }
    /* Wait for the canonical lookup tables before first render so spec-key
       canonicalization (DPI / Dots per inch / dpi → DPI) is consistent. */
    if (globalThis.SSCanonical && !globalThis.SSCanonical.isReady()) {
      try { await globalThis.SSCanonical.ready(); }
      catch (err) { console.warn('SSCanonical load failed; proceeding with raw keys', err); }
    }
    const rows = await loadRows();
    setStatus(rows.length + ' rows');
    if (tabulator) {
      tabulator.replaceData(rows);
      return;
    }
    /* Compose final columns: left-frozen + visible-data + hidden-data
       + derived spec columns + right-frozen row-actions. */
    const specColumns = buildSpecColumns(rows);
    const allColumns = [].concat(LEFT_FROZEN, EDITABLE_COLS, DATA_VISIBLE, DATA_HIDDEN, specColumns, [ROW_ACTIONS_COL]);
    /* When the table re-renders (new list loaded, columns added/hidden),
       refresh the Group By dropdown so it always shows every field the
       table currently has — not just the hardcoded 8 from the HTML. */
    queueMicrotask(refreshGroupBySelect);
    tabulator = new Tabulator('#dbViewGrid', {
      data: rows,
      columns: allColumns,
      /* fitData = every column sizes to its natural content width. The table
         can be narrower than the container (empty gutter on the right when
         the list is small) or wider (horizontal scroll when many spec columns
         are shown). System columns (rowSelect, thumb, rowActions) keep their
         fixed pixel widths; data and spec columns auto-size. */
      layout: 'fitDataFill',
      responsiveLayout: false,
      resizableColumns: true,   /* allow user-resize on data columns */
      resizableColumnFit: true,
      height: '72vh',
      headerVisible: true,             // make absolutely sure the header strip renders
      reactiveData: false,
      movableColumns: true,
      movableRows: false,
      selectable: true,
      selectableRangeMode: 'click',
      headerSort:             true,    // sortable by default for every column
      headerSortClickElement: 'header', // entire header (minus menu icon) sorts
      /* Live header-filter: re-filter on every keystroke, not just on
         Enter/blur. Makes the operator-aware numeric filter feel
         instant (">100" → "0 rows" → ">10" → results appear). */
      headerFilterLiveFilter: true,
      headerSortTristate:     true,    // asc → desc → none cycle
      headerSortMultiTarget:  true,    // shift-click to add secondary sort
      headerFilterLiveFilterDelay: 200,
      placeholder: 'No products in this list yet. Capture one from a product page, then they appear here.',
      placeholderHeaderFilter: 'No matching products. Clear filters to see all rows.',
      rowHeight: undefined,           // let CSS govern
      tooltips: true,                  // show full title on hover
      tooltipsHeader: true,
      rowSelectionChanged(data /* selected rows */) {
        /* Sync Tabulator's selection back into comparison.js's selectedProductIds
           so the legacy "Rescan Selected" / "Delete Selected" buttons work.
           Pass {id, url} pairs — legacy chrome.storage products may not have an
           id yet, so the lookup needs URL as a fallback. */
        if (typeof globalThis.setSelectedProductsFromIds === 'function') {
          const items = (data || []).map(r => ({ id: r.id, url: r.url })).filter(it => it.id || it.url);
          globalThis.setSelectedProductsFromIds(items);
        }
      },
      rowClick(e, row) {
        /* Open the existing product-detail view from a row click.
           Skip clicks on the selection checkbox or other interactive cells. */
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'A' || tag === 'SELECT') return;
        if (e.target.closest && e.target.closest('input, button, a, select')) return;
        const d = row.getData();
        if (!d || !d.id) return;
        if (typeof globalThis.openProductDetailById === 'function') {
          globalThis.openProductDetailById({ id: d.id, url: d.url });
        }
      },
      dataFiltered() {
        /* Mark columns that currently have a header filter value so CSS pins
           their filter row open and tints the title. */
        try {
          const filters = (tabulator && tabulator.getHeaderFilters && tabulator.getHeaderFilters()) || [];
          const active = new Set(filters.filter(f => f.value !== '' && f.value != null).map(f => f.field));
          document.querySelectorAll('.tabulator-col').forEach(el => {
            const field = el.getAttribute('tabulator-field');
            el.classList.toggle('has-filter', active.has(field));
          });
        } catch {}
      },
      rowContextMenu: [
        { label: 'Open product page', action: (e, row) => { const u = row.getData().url; if (u) window.open(u, '_blank', 'noopener'); } },
        { separator: true },
        { label: 'Delete row',        action: async (e, row) => {
            const id = row.getData().id;
            if (id) await repo.removeProduct(id);
            row.delete();
            setStatus(((tabulator && tabulator.getDataCount()) || 0) + ' rows');
        } }
      ],
      persistence: false
    });
  }

  /* ===== Pivot (PivotTable.js) =====
     PivotTable.js crashes if any cell value is a non-primitive (object / array),
     so we flatten product records to scalar-only fields here. Nested specs and
     bullets are summarized into a count column instead. */
  async function renderPivot() {
    const container = document.getElementById('dbViewPivot');
    if (!container) return;
    if (!$ || !$.fn || !$.fn.pivotUI) {
      container.innerHTML =
        '<div class="empty-state"><div class="es-icon">!</div>' +
        '<div class="es-title">PivotTable.js not loaded</div>' +
        '<div class="es-body">Drop vendor/jquery.min.js, vendor/pivot.min.js and vendor/pivot.min.css per vendor/README.md.</div></div>';
      return;
    }
    const rows = await loadRows();
    setStatus(rows.length + ' rows');
    if (!rows.length) {
      container.innerHTML =
        '<div class="empty-state"><div class="es-icon">&#x2261;</div>' +
        '<div class="es-title">Nothing to pivot yet</div>' +
        '<div class="es-body">Capture products from a product page, then come back here to slice them by source, category, brand, etc.</div></div>';
      return;
    }
    const data = productRows.flattenForPivot(rows);
    try {
      $(container).empty().pivotUI(data, {
        rows: ['source'],
        cols: ['category'],
        vals: ['newPrice'],
        aggregatorName: 'Average',
        rendererName: 'Heatmap'
      }, true /* overwrite */);
    } catch (err) {
      console.error('Pivot render failed', err);
      container.innerHTML =
        '<div class="empty-state"><div class="es-icon">!</div>' +
        '<div class="es-title">Pivot view error</div>' +
        '<div class="es-body">' + escapeHtml(err && err.message ? err.message : String(err)) + '</div></div>';
    }
  }

  /* ===== Saved views ===== */
  async function refreshSavedViewSelect() {
    if (!views) return;
    const listId = await repo.getActiveListId();
    if (!listId) return;
    const sel = document.getElementById('savedViewSelect');
    if (!sel) return;
    const all = await views.listViews(listId);
    const active = await views.getActiveViewId(listId);
    currentViewId = active || null;
    sel.innerHTML = '<option value="">(All products)</option>' + all.map(v =>
      `<option value="${v.id}"${v.id === currentViewId ? ' selected' : ''}>${escapeHtml(v.name)} · ${v.mode}</option>`
    ).join('');
  }

  async function onSaveView() {
    const raw = await ShopScoutUI.prompt('Name this view:', {
      title: 'Save view',
      okLabel: 'Save',
      validate: (v) => (v && v.trim()) ? null : 'Please enter a name.'
    });
    if (raw == null) return;
    const name = raw.trim();
    if (!name) return;
    const listId = await repo.getActiveListId();
    const cfg = currentCaptureCfg();
    const rec = await views.createView(Object.assign({ name, listId, mode: currentMode }, cfg));
    await views.setActiveViewId(listId, rec.id);
    currentViewId = rec.id;
    await refreshSavedViewSelect();
    setStatus('Saved: ' + name);
  }

  async function onDeleteView() {
    if (!currentViewId) { setStatus('No saved view selected.'); return; }
    const v = await views.getView(currentViewId);
    if (!v) return;
    const ok = await ShopScoutUI.confirm(
      `Delete view "${v.name}"?`,
      { title: 'Delete view', okLabel: 'Delete', kind: 'danger' }
    );
    if (!ok) return;
    await views.deleteView(currentViewId);
    const listId = await repo.getActiveListId();
    await views.setActiveViewId(listId, null);
    currentViewId = null;
    await refreshSavedViewSelect();
    await render();
    setStatus('Deleted.');
  }

  async function onSwitchView(viewId) {
    const listId = await repo.getActiveListId();
    currentViewId = viewId || null;
    await views.setActiveViewId(listId, currentViewId);
    if (currentViewId) {
      const v = await views.getView(currentViewId);
      if (v && v.mode && v.mode !== currentMode) showMode(v.mode);
    }
    await render();
  }

  /* Capture Tabulator's current sort/filter/group state so a saved view round-trips. */
  function currentCaptureCfg() {
    const cfg = { filters: [], sort: [], group: null, columns: [], pivot: null };
    if (!tabulator) return cfg;
    try {
      const sorters = tabulator.getSorters() || [];
      cfg.sort = sorters.map(s => ({ field: s.field, dir: s.dir }));
      const headerFilters = tabulator.getHeaderFilters() || [];
      cfg.filters = headerFilters.map(f => ({ field: f.field, op: 'contains', value: f.value }));
    } catch {}
    return cfg;
  }

  /* ===== Public render entry — called from comparison.js renderAll() ===== */
  async function render() {
    show();
    await refreshSavedViewSelect();
    if (currentMode === 'grid') await renderGrid();
    else await renderPivot();
    /* Default view = Inverted (products as columns, specs as rows).
       The Tabulator grid still gets initialized in renderGrid() above
       — it's the source of truth for data + columns — but we flip
       straight into the inverted layout for display. */
    if (currentMode === 'grid' && inverted) {
      await toggleInvert(true);
    }
  }

  /* ===== Toolbar action handlers ===== */
  function onGroupByChange(field) {
    if (!tabulator) return;
    if (!field) {
      tabulator.setGroupBy(false);
    } else {
      /* Use a function form so spec: fields (with colons) and any
         odd characters in field names work reliably. Pretty-print
         the value through SSCellFormatters so the group header
         shows "3 hr" instead of "180 minutes". */
      const CF = globalThis.SSCellFormatters;
      tabulator.setGroupBy(function(rowData) {
        let v = rowData[field];
        if (v == null || v === '') return '(empty)';
        if (typeof v === 'object') v = v.canonicalValue || v.value || v.rawValue || '';
        return CF && CF.prettify ? CF.prettify(v) : String(v);
      });
    }
    setStatus(((tabulator && tabulator.getDataCount('active')) || 0) + ' rows' + (field ? ' · grouped by ' + field : ''));
  }

  /* Populate the Group By dropdown dynamically from every column the
     table actually has (base + dynamically-built spec columns). This is
     the parallel of the Columns dropdown — same pool of fields, so
     anything you can show as a column you can group by. Pinned/system
     fields (rowSelect, thumb, rowActions, Title) are excluded; they
     don't make sense as group keys. */
  function refreshGroupBySelect() {
    const sel = document.getElementById('dbGroupBy');
    if (!sel || !tabulator) return;
    const current = sel.value || '';
    const entries = [{ value: '', label: 'None' }];
    const cols = tabulator.getColumns() || [];
    const SKIP = new Set(['', 'rowSelect', 'thumb', 'rowActions', 'title']);
    const buckets = [];
    for (const c of cols) {
      const def = c.getDefinition();
      const field = def.field || '';
      if (SKIP.has(field)) continue;
      const label = (def.title || field || '').toString().trim() || '(unnamed)';
      buckets.push({ value: field, label });
    }
    buckets.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    entries.push(...buckets);
    sel.innerHTML = entries.map(e =>
      '<option value="' + escapeHtml(e.value) + '"' + (e.value === current ? ' selected' : '') + '>' + escapeHtml(e.label) + '</option>'
    ).join('');
  }

  function onClearFilters() {
    if (!tabulator) return;
    tabulator.clearHeaderFilter();
    setStatus(((tabulator && tabulator.getDataCount('active')) || 0) + ' rows');
  }

  /* Toggle the per-column filter row. Tabulator adds .tabulator to #dbViewGrid
     itself (NOT a child div), so we toggle on that element directly.
     Tabulator pre-calculates the header strip height during init; if we just
     swap display:none -> block in CSS the row overflows the locked header.
     Calling tabulator.redraw(true) forces Tabulator to re-measure and the
     header grows / shrinks to fit. */
  function onToggleFilters(force) {
    const el = document.getElementById('dbViewGrid');
    const btn = document.getElementById('dbToggleFiltersBtn');
    if (!el || !el.classList.contains('tabulator')) return;
    const want = (force != null) ? !!force : !el.classList.contains('ss-filters-on');
    el.classList.toggle('ss-filters-on', want);
    /* Mirror the toggle into the inverted view container so the
       row-filter inputs appear/hide under each spec key. */
    const invView = document.getElementById('dbViewInvert');
    if (invView) invView.classList.toggle('ss-filters-on', want);
    if (btn) {
      btn.classList.toggle('active', want);
      btn.setAttribute('aria-pressed', want ? 'true' : 'false');
    }
    if (tabulator) {
      try { tabulator.redraw(true); } catch (err) { console.warn('Tabulator redraw on filter toggle failed', err); }
    }
  }

  /* ===== Columns popover — list every column with a visibility checkbox ===== */
  function getColumnsMenu() {
    if (!columnsMenu) {
      columnsMenu = Table.columnsMenu.create({
        document,
        getTabulator: () => tabulator,
        applyInvertedRowVisibility
      });
    }
    return columnsMenu;
  }

  function toggleColumnsMenu(open) {
    getColumnsMenu().toggle(open);
  }

  /* ===== Event wiring ===== */
  function bind() {
    getRowActionsMenu().bindGlobal();

    /* Mode toggle (Grid / Pivot) — in both the dbView toolbar AND the ribbon Layout group.
       Clicking Grid or Pivot explicitly turns OFF the inverted layout
       because the user is asking for the standard view. */
    document.querySelectorAll('[data-db-mode]').forEach(btn => {
      btn.addEventListener('click', async () => {
        inverted = false;
        await toggleInvert(false);
        showMode(btn.dataset.dbMode);
        await render();
      });
    });

    /* Group by */
    const grp = document.getElementById('dbGroupBy');
    if (grp) grp.addEventListener('change', () => onGroupByChange(grp.value));

    /* Clear filters */
    const clr = document.getElementById('dbClearFiltersBtn');
    if (clr) clr.addEventListener('click', onClearFilters);

    /* Filter toggle — show/hide the per-column filter inputs in the header row. */
    const tog = document.getElementById('dbToggleFiltersBtn');
    if (tog) tog.addEventListener('click', () => onToggleFilters());

    /* Columns dropdown */
    const colsBtn = document.getElementById('dbColumnsBtn');
    if (colsBtn) colsBtn.addEventListener('click', e => {
      e.stopPropagation();
      toggleColumnsMenu();
    });
    document.addEventListener('click', e => {
      const menu = document.getElementById('dbColumnsMenu');
      const btn  = document.getElementById('dbColumnsBtn');
      if (!menu || menu.hidden) return;
      if (e.target === btn || btn.contains(e.target) || menu.contains(e.target)) return;
      toggleColumnsMenu(false);
    });

    /* Saved views */
    const sel = document.getElementById('savedViewSelect');
    if (sel) sel.addEventListener('change', () => onSwitchView(sel.value));
    const saveBtn = document.getElementById('saveCurrentViewBtn');
    if (saveBtn) saveBtn.addEventListener('click', onSaveView);
    const delBtn = document.getElementById('deleteCurrentViewBtn');
    if (delBtn) delBtn.addEventListener('click', onDeleteView);
  }

  /* Boot on DOMContentLoaded — bind handlers, show the view, then render once the
     data layer + active list are ready. comparison.js's init() also calls render()
     after bootstrapDataLayer; this initial call is best-effort and idempotent. */
  async function boot() {
    bind();
    show();
    try { await render(); } catch (err) { console.warn('SSDatabaseView initial render deferred', err); }
    /* Document-level my-rating delegation — single listener catches
       clicks in the Tabulator grid, the inverted view, and any future
       my-rating widget. Hover behavior is CSS-only via row-reverse. */
    bindMyRatingDelegation();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Returns the row data for the currently selected rows. */
  function getSelectedRows() {
    if (!tabulator || !tabulator.getSelectedData) return [];
    return tabulator.getSelectedData();
  }

  /* Compare filter — when the user picks 2+ rows and clicks Compare,
     hide every other row. Uses Tabulator's setFilter so sorting + the
     spec heuristic + best-in-row ranks still work over the visible
     subset. The filter is a closure over the selected ids. */
  function applyCompareFilter(selected) {
    if (!tabulator || !selected || !selected.length) return;
    const ids = new Set(selected.map(r => r.id || r.url).filter(Boolean));
    tabulator.setFilter(function(row) { return ids.has(row.id) || ids.has(row.url); });
  }
  function clearCompareFilter() {
    if (!tabulator) return;
    tabulator.clearFilter(true);
  }

  /* Invert / Standard layout. Invert = products as columns + spec
     keys as rows (custom transposed table) — this is now the
     DEFAULT view per UX preference. Standard = products as rows
     (Tabulator grid). Toggling the Grid mode button switches back. */
  let inverted = true;
  async function toggleInvert(force) {
    inverted = force != null ? !!force : !inverted;
    const grid    = document.getElementById('dbViewGrid');
    const invView = document.getElementById('dbViewInvert');
    if (inverted) {
      if (grid) grid.style.display = 'none';
      if (invView) invView.style.display = '';
      await renderInverted();
    } else {
      if (grid) grid.style.display = '';
      if (invView) invView.style.display = 'none';
    }
    /* Re-run showMode so the Grid/Pivot/Invert button states reflect
       the new mutual-exclusion: only ONE layout button is active. */
    showMode(currentMode);
  }

  /* Build the transposed table. Uses whatever rows are currently
     loaded — if a Compare filter is active, only those rows show
     because Tabulator's getData() respects the filter. */
  async function renderInverted() {
    const container = document.getElementById('dbViewInvert');
    if (!container) return;
    /* Always read VISIBLE rows so Compare-filter + header filters are
       respected. getData('active') returns post-filter data. */
    const visible = tabulator ? (tabulator.getData('active') || []) : [];
    if (!visible.length) {
      container.innerHTML = '<div class="empty-state"><div class="es-title">No products to invert.</div></div>';
      return;
    }
    const SH = globalThis.SSSpecHeuristic;
    const CF = globalThis.SSCellFormatters;
    /* Collect every key the visible rows have a spec value for. */
    const keys = SH ? SH.allSpecKeys(visible) : [];
    keys.sort((a, b) => a.localeCompare(b));

    const baseRows = [
      { label: 'Brand',        getter: p => p.brand },
      { label: 'Source',       getter: p => p.source },
      { label: 'Price',        getter: p => p.newPrice },
      { label: 'Used Price',   getter: p => p.usedPrice },
      { label: 'Rating',       getter: p => p.rating,        kind: 'stars' },
      { label: 'My Rating',    getter: p => p.userRating,    kind: 'myrating' },
      { label: 'Manufacturer', getter: p => p.manufacturer },
      { label: 'Model name',   getter: p => p.modelName },
      { label: 'Model number', getter: p => p.modelNumber },
      { label: 'Seller',       getter: p => p.sellerName },
      { label: 'Availability', getter: p => p.availability },
      { label: 'Notes',        getter: p => p.notes }
    ];
    const head = '<thead><tr><th class="ss-compare-keycol">&nbsp;</th>'
      + visible.map(p => {
          const img = p.image || (p.imageUrls && p.imageUrls[0]) || '';
          const rawTitle = String(p.title || p.productName || '(untitled)');
          const cleaned  = (root.SS && root.SS.dedupProductName) ? root.SS.dedupProductName(rawTitle) : rawTitle;
          /* Truncate to 25 characters with ellipsis. Full title kept in
             the link's title attribute for tooltip hover. */
          const TITLE_MAX = 25;
          const shortTitle = cleaned.length > TITLE_MAX
            ? cleaned.slice(0, TITLE_MAX - 1).trimEnd() + '…'
            : cleaned;
          const titleEsc = esc(shortTitle);
          const fullTitleAttr = esc(cleaned);
          const url = p.url;
          /* Underline-free product link — explicit class so the
             global <a> styling doesn't add the default underline.
             title attribute carries the full (untruncated) name as
             the browser-native tooltip. */
          const titleHtml = url
            ? '<a class="ss-compare-titlelink" href="' + esc(url) + '" target="_blank" rel="noopener" title="' + fullTitleAttr + '">' + titleEsc + '</a>'
            : '<span title="' + fullTitleAttr + '">' + titleEsc + '</span>';
          /* Actions row — Open / Edit / Rescan / Delete. Each button
             dispatches through a delegated handler attached after
             render (see bindInvertedActions below). */
          const actions = '<div class="ss-compare-prodactions" '
            + 'data-product-id="' + esc(p.id || '') + '" '
            + 'data-product-url="' + esc(p.url || '') + '">'
            + '  <button type="button" data-invert-action="open"   title="Open product page"' + (url ? '' : ' disabled') + '><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h7v7"/><path d="M21 3 11 13"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg></button>'
            + '  <button type="button" data-invert-action="edit"   title="Edit details"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>'
            + '  <button type="button" data-invert-action="rescan" title="Rescan from page"' + (url ? '' : ' disabled') + '><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg></button>'
            + '  <button type="button" data-invert-action="hide"   title="Hide this product column (use Show all to bring it back)"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="M2 2l20 20"/></svg></button>'
            + '  <button type="button" data-invert-action="delete" title="Delete row" class="is-danger"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'
            + '</div>';
          /* Selection checkbox — top-of-column. Mirrors the Tabulator
             row's selected state so the Compare button (which filters
             on selected rows) works identically in both views. */
          const checkbox = '<label class="ss-compare-select" title="Select for Compare">'
            + '<input type="checkbox" data-row-select '
            + 'data-product-id="' + esc(p.id || '') + '" '
            + 'data-product-url="' + esc(p.url || '') + '">'
            + '</label>';
          return '<th class="ss-compare-prodcol">'
            + '<div class="ss-compare-prodhead">'
            +   checkbox
            +   (img ? '<img src="' + esc(img) + '" alt="">' : '<div class="ss-compare-noimg"></div>')
            +   '<div class="ss-compare-prodtitle">' + titleHtml + '</div>'
            +   actions
            + '</div></th>';
        }).join('')
      + '</tr></thead>';

    /* Header-cell rendering. Most spec values just go through
       SSCellFormatters.prettify; rating + my-rating get special
       formatters; brand/source render as pills. */
    function renderBaseCell(row, p) {
      let v = row.getter(p);
      /* Defensive coerce — the new pipeline writes flat.rating /
         flat.sellerName etc. as `{value, source, confidence}` wrapper
         objects when its FIELD_MAP routing hits an initial-string slot.
         Legacy captures already have those wrappers in storage; the
         literal string "[object Object]" appears if a previous render
         called String({}). Either way: unwrap to a clean string. */
      v = unwrapStored(v);
      if (!v) return '<span class="db-cell-empty">&mdash;</span>';
      if (row.kind === 'stars') {
        const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
        if (!isFinite(n)) return esc(String(v));
        const pct = Math.max(0, Math.min(100, (n / 5) * 100));
        return '<div class="ss-stars"><div class="ss-stars-row">'
          + '<span class="ss-stars-empty">★★★★★</span>'
          + '<span class="ss-stars-fill" style="width:' + pct + '%">★★★★★</span>'
          + '</div><div class="ss-stars-meta">' + n.toFixed(1) + '</div></div>';
      }
      if (row.kind === 'myrating') {
        return renderMyRatingMarkup(Number(v || 0), p.id || '', p.url || '');
      }
      /* Route every non-numeric, non-special cell through the unified
         pill renderer. Multi-value strings ("App Control, Voice Control")
         split into one pill per part automatically. */
      if (CF && CF.renderValueAsPills) return CF.renderValueAsPills(v);
      return esc(String(v));
    }

    /* Shared interactive my-rating widget — used by the grid's
       cellMyRating formatter and by the inverted view. Stars are
       rendered in REVERSE DOM order so the CSS-only hover trick
       (`:hover ~ span`) can light up the hovered star plus all stars
       before it visually. Uses data-* attributes so a single delegated
       click handler can find the product and apply the new rating. */
    function renderMyRatingMarkup(currentValue, productId, productUrl) {
      let h = '<span class="db-myrating" data-myrating-widget '
            + 'data-current="' + currentValue + '" '
            + 'data-product-id="' + esc(productId) + '" '
            + 'data-product-url="' + esc(productUrl) + '">';
      /* DOM order 5,4,3,2,1; visual order 1,2,3,4,5 via row-reverse. */
      for (let i = 5; i >= 1; i--) {
        const cls = i <= currentValue ? 'db-myrating-on' : 'db-myrating-off';
        h += '<span class="' + cls + '" data-myrating="' + i + '" title="' + i + ' star' + (i > 1 ? 's' : '') + '">&#9733;</span>';
      }
      return h + '</span>';
    }

    function specVal(p, key) {
      const list = SH && SH.specListOf ? SH.specListOf(p) : (Array.isArray(p.rawSpecs) ? p.rawSpecs : []);
      const SC = globalThis.SSCanonical;
      for (const s of list) {
        if (!s || s.key == null) continue;
        const k = SC && SC.canonicalKey ? SC.canonicalKey(String(s.key)) : String(s.key);
        if (k.toLowerCase() === key.toLowerCase()) return s.value;
      }
      return '';
    }

    /* Each row's `<th>` carries a small filter input beneath the
       label. CSS shows/hides it based on the .ss-filters-on class
       toggled by the same Filter button the grid uses, so the user's
       mental model is consistent across views. */
    function rowHeader(label, key) {
      return '<th class="ss-compare-keycol">'
        + '<div class="ss-compare-keylabel">' + esc(label) + '</div>'
        + '<input class="ss-compare-rowfilter" type="text" '
        +   'data-row-key="' + esc(key) + '" '
        +   'placeholder="filter…" '
        +   'aria-label="Filter ' + esc(label) + '">'
        + '</th>';
    }
    /* Map of row labels in the inverted view → boolean visibility,
       written by the Columns-dropdown bridge so toggling a column in
       the grid hides/shows the corresponding row here. */
    function rowFor(label) { return 'data-row-label="' + esc(label) + '"'; }

    let bodyHtml = '<tbody>';
    for (const row of baseRows) {
      const cells = visible.map(p => row.getter(p));
      bodyHtml += '<tr ' + rowFor(row.label) + '>' + rowHeader(row.label, '_base:' + row.label);
      for (let i = 0; i < cells.length; i++) {
        bodyHtml += '<td>' + renderBaseCell(row, visible[i]) + '</td>';
      }
      bodyHtml += '</tr>';
    }
    for (const key of keys) {
      bodyHtml += '<tr ' + rowFor(key) + '>' + rowHeader(key, '_spec:' + key);
      const vals = visible.map(p => specVal(p, key));
      for (let i = 0; i < vals.length; i++) {
        const raw = vals[i];
        if (raw == null || raw === '') {
          bodyHtml += '<td><span class="db-cell-empty">&mdash;</span></td>';
          continue;
        }
        /* Prettify (metric→imperial, time unification) then pill it.
           Multi-value strings ("App Control, Voice Control") split
           into one pill per part automatically. */
        const pretty = CF ? CF.prettify(raw) : String(raw);
        const display = CF && CF.renderValueAsPills ? CF.renderValueAsPills(pretty) : esc(pretty);
        bodyHtml += '<td>' + display + '</td>';
      }
      bodyHtml += '</tr>';
    }
    bodyHtml += '</tbody>';
    container.innerHTML = '<table class="ss-compare-table">' + head + bodyHtml + '</table>';

    /* ---- Mirror the global filter-toggle state into this view. ---- */
    const gridEl = document.getElementById('dbViewGrid');
    if (gridEl && gridEl.classList.contains('ss-filters-on')) {
      container.classList.add('ss-filters-on');
    } else {
      container.classList.remove('ss-filters-on');
    }

    /* ---- Delegated handlers — bound once per render. ---- */
    bindInvertedActions(container, visible);
    bindInvertedRowFilters(container);
    bindMyRatingDelegation(container);
    bindInvertedRowSelection(container);

    /* Replay any pending visibility decisions from the Columns popover
       so toggling a column → switching views → switching back still
       hides the row the user expected. */
    if (tabulator) {
      for (const col of tabulator.getColumns()) {
        const def = col.getDefinition();
        const label = (def.title || '').toString().trim();
        if (label) applyInvertedRowVisibility(label, col.isVisible());
      }
    }

    /* Reflect Tabulator's current selection into the new checkboxes
       so a row selected in Grid view stays selected after flipping
       into Inverted view. */
    if (tabulator) {
      const sel = tabulator.getSelectedData() || [];
      const selIds  = new Set(sel.map(r => r.id).filter(Boolean));
      const selUrls = new Set(sel.map(r => r.url).filter(Boolean));
      container.querySelectorAll('[data-row-select]').forEach(cb => {
        if (selIds.has(cb.dataset.productId) || selUrls.has(cb.dataset.productUrl)) {
          cb.checked = true;
        }
      });
    }
  }

  /* Per-product checkbox in the inverted view header. Toggles the
     matching Tabulator row's selection so the Compare button (which
     reads tabulator.getSelectedData) behaves identically across
     both views. */
  function bindInvertedRowSelection(container) {
    container.addEventListener('change', (e) => {
      const cb = e.target;
      if (!cb || !cb.matches || !cb.matches('[data-row-select]')) return;
      if (!tabulator) return;
      const id  = cb.dataset.productId || '';
      const url = cb.dataset.productUrl || '';
      const row = tabulator.getRows().find(r => {
        const d = r.getData();
        return (id && d.id === id) || (url && d.url === url);
      });
      if (!row) return;
      if (cb.checked) row.select(); else row.deselect();
    });
  }

  /* Toggle the row whose label matches `label` in the inverted view.
     A column may correspond to a base row (Brand/Source/...) OR to a
     spec row (the canonical key string from the heuristic). Either
     way the row's <tr> carries the same data-row-label. */
  function applyInvertedRowVisibility(label, visible) {
    const container = document.getElementById('dbViewInvert');
    if (!container) return;
    const wanted = label.toLowerCase();
    container.querySelectorAll('tr[data-row-label]').forEach(tr => {
      const got = (tr.getAttribute('data-row-label') || '').toLowerCase();
      if (got === wanted) tr.style.display = visible ? '' : 'none';
    });
  }

  /* Filter behavior in the inverted view. Walks each row filter, and
     for every product column computes "does it pass ALL active row
     filters?". Columns that fail get .ss-col-hidden which CSS turns
     into display:none on every cell in that column. */
  function bindInvertedRowFilters(container) {
    const table = container.querySelector('.ss-compare-table');
    if (!table) return;
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;
    const productHeaders = Array.from(headerRow.children).slice(1);   // skip keycol

    function applyAll() {
      const inputs = table.querySelectorAll('.ss-compare-rowfilter');
      const active = [];
      inputs.forEach(input => {
        const v = String(input.value || '').trim();
        if (!v) return;
        const tr = input.closest('tr');
        const tds = Array.from(tr.children).slice(1);
        active.push({ filt: v, tds });
      });
      const hide = new Set();
      for (let i = 0; i < productHeaders.length; i++) {
        for (const f of active) {
          const td = f.tds[i];
          const text = td ? (td.textContent || '') : '';
          if (!matchFilter(text, f.filt)) { hide.add(i); break; }
        }
      }
      table.querySelectorAll('tr').forEach(tr => {
        const cells = Array.from(tr.children).slice(1);
        for (let i = 0; i < cells.length; i++) {
          cells[i].classList.toggle('ss-col-hidden', hide.has(i));
        }
      });
    }
    table.querySelectorAll('.ss-compare-rowfilter').forEach(input => {
      input.addEventListener('input', applyAll);
    });
  }

  /* Inverted-view row-filter — same operator semantics as the grid
     header filter; just routes through the shared helper. */
  function matchFilter(cellText, filt) {
    const CF = globalThis.SSCellFormatters;
    if (CF && CF.matchOperatorFilter) return CF.matchOperatorFilter(filt, cellText);
    return String(cellText || '').toLowerCase().includes(String(filt || '').toLowerCase());
  }

  /* Product-actions delegation in the inverted view. Each button
     carries data-invert-action; the containing div carries the
     product id/url. We route to the same handlers the grid's row
     menu uses. */
  function bindInvertedActions(container, _visibleRows) {
    container.addEventListener('click', async (e) => {
      const btn = e.target && e.target.closest && e.target.closest('[data-invert-action]');
      if (!btn || btn.disabled) return;
      const action = btn.dataset.invertAction;
      const wrap = btn.closest('.ss-compare-prodactions');
      if (!wrap) return;
      const id = wrap.dataset.productId || '';
      const url = wrap.dataset.productUrl || '';
      if (action === 'open' && url) {
        window.open(url, '_blank', 'noopener');
      } else if (action === 'edit') {
        if (typeof globalThis.openProductDetailById === 'function') {
          globalThis.openProductDetailById({ id, url });
        }
      } else if (action === 'rescan') {
        if (typeof globalThis.rescanProductById === 'function') {
          globalThis.rescanProductById({ id, url });
        }
      } else if (action === 'hide') {
        /* Hide this product column. Walks every <tr> in the table and
           marks the cell at this column's index with .ss-col-hidden,
           which CSS already turns into display:none. Show all (in the
           Columns dropdown later — for now, re-render to bring it back) */
        const th = btn.closest('th');
        if (!th) return;
        const headerRow = th.parentElement;
        const colIdx = Array.from(headerRow.children).indexOf(th);
        if (colIdx < 0) return;
        const table = th.closest('table');
        if (!table) return;
        table.querySelectorAll('tr').forEach(tr => {
          const cell = tr.children[colIdx];
          if (cell) cell.classList.add('ss-col-hidden');
        });
      } else if (action === 'delete') {
        if (repo && id) {
          try { await repo.removeProduct(id); } catch (err) { console.warn('removeProduct failed', err); }
          await renderInverted();   // re-render to drop the deleted column
        }
      }
    });
  }

  /* My-rating delegation — supports BOTH the grid and the inverted
     view. A single listener on the document handles clicks on any
     [data-myrating] inside a [data-myrating-widget]. */
  function bindMyRatingDelegation(_scope) {
    /* Mounted once globally — every call here is a no-op after the
       first because we set a flag on the document. */
    if (root.__ssMyRatingBound) return;
    root.__ssMyRatingBound = true;
    document.addEventListener('click', async (e) => {
      const star = e.target && e.target.closest && e.target.closest('[data-myrating]');
      if (!star) return;
      const widget = star.closest('[data-myrating-widget]');
      if (!widget) return;
      e.stopPropagation();
      const newVal = parseInt(star.dataset.myrating, 10);
      const current = Number(widget.dataset.current || 0);
      const v = newVal === current ? 0 : newVal;       // click same star → clear
      widget.dataset.current = String(v);
      widget.querySelectorAll('[data-myrating]').forEach(s => {
        const i = parseInt(s.dataset.myrating, 10);
        s.classList.toggle('db-myrating-on',  i <= v);
        s.classList.toggle('db-myrating-off', i >  v);
      });
      const id = widget.dataset.productId || '';
      const url = widget.dataset.productUrl || '';
      try {
        if (repo && id && repo.updateProduct) await repo.updateProduct(id, { userRating: v });
      } catch (err) { console.warn('myrating updateProduct failed', err); }
      try {
        const chrome = globalThis.browser || globalThis.chrome;
        if (chrome && chrome.storage) {
          const stored = await chrome.storage.local.get('shopscout_data');
          const blob = stored.shopscout_data;
          if (blob && blob.lists) {
            for (const name of Object.keys(blob.lists)) {
              const arr = blob.lists[name];
              if (!Array.isArray(arr)) continue;
              const idx = arr.findIndex(p => p.id === id || p.url === url);
              if (idx >= 0) arr[idx] = Object.assign({}, arr[idx], { userRating: v });
            }
            await chrome.storage.local.set({ shopscout_data: blob });
          }
        }
      } catch (err) { console.warn('myrating storage mirror failed', err); }
    });
  }

  root.SSDatabaseView = {
    render, show, hide, showMode, getSelectedRows,
    applyCompareFilter, clearCompareFilter,
    toggleInvert, renderInverted
  };
})(globalThis);
