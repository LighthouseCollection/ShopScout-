/* =============================================================
   ShopScout — Codex grid projections

   Pure data builders for the Phase 2 grid. These functions do not
   render, persist, or mutate products; they only shape captured
   product data into grid-ready products-as-rows and products-as-
   columns projections.
   ============================================================= */
(function initShopScoutGridCodexProjections(root) {
  const NS = (root.ShopScoutGridCodexProjections = root.ShopScoutGridCodexProjections || {});

  /* Fixed-shape columns (select, thumb, actions) keep hardcoded widths
     because their content isn't measurable text. Every other column
     lets slickGridAdapter.measuredColumnWidth compute width from actual
     header + cell content — hardcoded minWidths here would override
     that and force columns wider than their content needs. */
  const BASE_COLUMNS = [
    { id: 'select', field: '_selected', name: '', type: 'selection', width: 40, minWidth: 40, maxWidth: 40, required: true },
    /* Thumbnail column also carries the row actions (Open/Rescan/Delete)
       stacked under the image, so it needs to be wide enough for a
       3-icon row at 30px each + gaps + padding. */
    { id: 'thumb', field: 'image', name: '', type: 'image', width: 108, required: true },
    { id: 'title', field: 'title', name: 'Name', type: 'text', editable: true, required: true },
    /* Fixed default-visible row after the frozen 3 (see FIXED_ORDER_IDS
       below). Order: Price / Source / Rating / User Rating / Notes. */
    { id: 'newPrice', field: 'newPrice', name: 'Price', type: 'price', editable: true },
    { id: 'source', field: 'source', name: 'Source', type: 'source' },
    { id: 'rating', field: 'rating', name: 'Rating', type: 'rating', editable: true },
    { id: 'myRating', field: 'myRating', name: 'My Rating', type: 'myRating', editable: true },
    { id: 'notes', field: 'notes', name: 'Notes', type: 'notes', editable: true },
    /* Remaining base columns — sorted alongside spec columns by how
       many products have a value for them. */
    { id: 'brand', field: 'brand', name: 'Brand', type: 'brand', editable: true },
    { id: 'modelName', field: 'modelName', name: 'Model', type: 'text', editable: true }
  ];

  /* Columns that stay in a fixed order after the frozen (select/thumb/
     title) triplet and are always visible by default, even when no
     product has a value yet. */
  const FROZEN_COLUMN_IDS = new Set(['select', 'thumb', 'title']);
  const FIXED_ORDER_IDS = ['newPrice', 'source', 'rating', 'myRating', 'notes'];

  const ACTIONS_COLUMN = { id: 'actions', field: '_actions', name: '', type: 'actions', width: 92, required: true };

  const FIELD_LABELS = {
    title: 'Name',
    brand: 'Brand',
    newPrice: 'Price',
    usedPrice: 'Used Price',
    shippingPrice: 'Shipping',
    source: 'Source',
    modelName: 'Model',
    modelNumber: 'Model Number',
    rating: 'Rating',
    myRating: 'My Rating',
    reviewCount: 'Reviews',
    notes: 'Notes',
    sellerName: 'Seller',
    category: 'Category',
    availability: 'Availability'
  };

  const RATING_REVIEW_SPEC_KEYS = new Set([
    'customer reviews',
    'customer review',
    'customer ratings',
    'customer rating',
    'reviews',
    'review count',
    'ratings',
    'rating count',
    'average rating'
  ]);

  const BASIC_MATRIX_FIELDS = [
    'brand',
    'source',
    'newPrice',
    'rating',
    'availability',
    'notes'
  ];

  function canonicalKey(value, scope) {
    const canon = scope?.SSCanonical || root.SSCanonical;
    if (canon && typeof canon.canonicalKey === 'function') return canon.canonicalKey(value);
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function canonicalField(field, scope) {
    const text = String(field || '').trim();
    if (!text) return '';
    if (text.startsWith('spec:')) {
      const raw = text.slice(5);
      return `spec:${canonicalKey(raw, scope)}`;
    }
    if (FIELD_LABELS[text]) return text;
    return `spec:${canonicalKey(text, scope)}`;
  }

  function titleCase(value) {
    return String(value || '')
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function fieldLabel(field) {
    if (FIELD_LABELS[field]) return FIELD_LABELS[field];
    if (field.startsWith('spec:')) return titleCase(field.slice(5));
    return titleCase(field);
  }

  /* True when a cell has some kind of real content the grid can display.
     Handles plain strings, numbers, and the matrix-cell object shape
     ({ value, corrected, raw, missing }). Treats empty strings, hyphens,
     null/undefined, and { missing: true } as "no value". */
  function hasNonEmptyCellValue(value) {
    if (value == null) return false;
    if (typeof value === 'object' && !Array.isArray(value)) {
      if (value.missing) return false;
      const s = String(value.value ?? value.corrected ?? value.raw ?? '').trim();
      return s.length > 0 && s !== '-';
    }
    if (Array.isArray(value)) return value.length > 0;
    const s = String(value).trim();
    return s.length > 0 && s !== '-';
  }

  function removedColumnSet(viewState) {
    return new Set((Array.isArray(viewState?.removedColumns) ? viewState.removedColumns : [])
      .map(String)
      .filter(Boolean));
  }

  function productIdOf(product, idx) {
    return String(product?.id || product?.url || `row-${idx + 1}`);
  }

  function normalizedIdentityPart(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function firstText(...values) {
    for (const value of values) {
      const text = String(value || '').trim();
      if (text) return text;
    }
    return '';
  }

  function uniqueIdentityParts(parts) {
    const out = [];
    const seen = new Set();
    for (const part of parts) {
      const text = String(part || '').trim();
      const key = normalizedIdentityPart(text);
      if (!text || !key || seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
    return out;
  }

  function stripLeadingIdentity(text, maker) {
    const value = String(text || '').trim();
    const head = String(maker || '').trim();
    if (!value || !head) return value;
    const escaped = head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return value.replace(new RegExp(`^${escaped}\\s*[|:-]?\\s*`, 'i'), '').trim();
  }

  function productDisplayName(product) {
    const fallback = firstText(product?.title, product?.productName, product?.listingTitle);
    const maker = firstText(product?.brand, product?.manufacturer, product?.maker);
    const model = stripLeadingIdentity(firstText(product?.modelNumber, product?.modelName), maker);
    const parts = uniqueIdentityParts([maker, model]);
    if (parts.length >= 2 || (parts.length === 1 && model)) return parts.join(' | ');
    return fallback || parts[0] || '';
  }

  function flattenProducts(products, options) {
    const projector = root.ShopScoutProjections;
    if (projector && typeof projector.flattenSpecs === 'function') {
      return projector.flattenSpecs(products, { root: options?.root || root });
    }
    return (Array.isArray(products) ? products : []).map(product => Object.assign({}, product));
  }

  function discoverSpecFields(rows) {
    const keys = new Set();
    for (const row of rows) {
      for (const key of Object.keys(row || {})) {
        if (key.startsWith('spec:')) keys.add(key);
      }
    }
    return [...keys].sort((a, b) => fieldLabel(a).localeCompare(fieldLabel(b)));
  }

  function parseNumeric(value) {
    const values = root.ShopScoutValues || {};
    if (typeof values.parseNumeric === 'function') {
      const parsed = values.parseNumeric(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    const cleaned = String(value ?? '').replace(/[^0-9.-]/g, '');
    if (!cleaned || /^[-.]+$/.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function cellText(row, field) {
    if (!row || !field) return '';
    const value = row[field];
    if (value == null) return '';
    if (typeof value === 'object') return String(value.value ?? value.raw ?? '');
    return String(value);
  }

  function compareRows(field, dir) {
    const direction = dir === 'desc' ? -1 : 1;
    return (a, b) => {
      const av = cellText(a, field);
      const bv = cellText(b, field);
      const an = parseNumeric(av);
      const bn = parseNumeric(bv);
      let cmp;
      if (an != null || bn != null) cmp = (an ?? Number.NEGATIVE_INFINITY) - (bn ?? Number.NEGATIVE_INFINITY);
      else cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
      return cmp * direction;
    };
  }

  function normalizeFilterValue(value) {
    if (Array.isArray(value)) {
      return [...new Set(value.map(item => String(item ?? '').trim()).filter(Boolean))];
    }
    return String(value ?? '').trim();
  }

  function normalizeFilter(filter, scope) {
    if (!filter || typeof filter !== 'object') return null;
    const field = canonicalField(filter.field, scope);
    if (!field) return null;
    const op = ['equals', 'starts', 'empty', 'notEmpty', 'gt', 'lt'].includes(filter.op)
      ? filter.op
      : 'contains';
    return {
      field,
      op,
      value: normalizeFilterValue(filter.value)
    };
  }

  function filterMatches(row, filter) {
    const text = cellText(row, filter.field).trim();
    const haystack = text.toLowerCase();
    const needles = Array.isArray(filter.value)
      ? filter.value.map(value => String(value || '').toLowerCase()).filter(Boolean)
      : [String(filter.value || '').toLowerCase()];
    const needle = needles[0] || '';
    switch (filter.op) {
      case 'equals': return needles.length ? needles.some(value => haystack === value) : haystack === needle;
      case 'starts': return needles.length ? needles.some(value => haystack.startsWith(value)) : haystack.startsWith(needle);
      case 'empty': return !text;
      case 'notEmpty': return !!text;
      case 'gt': {
        const left = parseNumeric(text);
        const right = parseNumeric(filter.value);
        return left != null && right != null && left > right;
      }
      case 'lt': {
        const left = parseNumeric(text);
        const right = parseNumeric(filter.value);
        return left != null && right != null && left < right;
      }
      default: return needles.length ? needles.some(value => haystack.includes(value)) : haystack.includes(needle);
    }
  }

  function applyFilters(rows, filters, scope) {
    const normalized = (Array.isArray(filters) ? filters : [])
      .map(filter => normalizeFilter(filter, scope))
      .filter(Boolean);
    if (!normalized.length) return rows;
    return rows.filter(row => normalized.every(filter => filterMatches(row, filter)));
  }

  function applySort(rows, sort) {
    const normalized = Array.isArray(sort) ? sort.filter(item => item?.field) : [];
    if (!normalized.length) return rows;
    return rows.slice().sort((a, b) => {
      for (const item of normalized) {
        const cmp = compareRows(item.field, item.dir)(a, b);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }

  function applyColumnState(columns, viewState) {
    const state = viewState || {};
    const visibility = state.columnVisibility || {};
    const order = Array.isArray(state.columnOrder) ? state.columnOrder : [];
    const pinned = new Set(Array.isArray(state.pinnedColumns) ? state.pinnedColumns : []);
    const removed = removedColumnSet(state);
    /* Column widths are intentionally NOT read from state — every render
       recomputes widths from actual header/content via measuredColumnWidth
       in slickGridAdapter.js. Any legacy state.columnWidths blob is
       ignored so it can't override the new auto-sized defaults. */
    const prepared = columns
      .filter(column => column.required || !removed.has(column.id))
      .map(column => {
        const next = Object.assign({}, column);
        if (pinned.has(next.id)) next.pinned = true;
        return next;
      })
      .filter(column => {
        if (column.required) return true;
        if (visibility[column.id] === false) return false;
        if (column.defaultHidden && visibility[column.id] !== true) return false;
        return true;
      });
    const trailingActions = prepared.filter(column => column.type === 'actions');
    const reorderable = prepared.filter(column => column.type !== 'actions');
    if (!order.length) return reorderable.concat(trailingActions);
    const byId = new Map(reorderable.map(column => [column.id, column]));
    const ordered = [];
    for (const id of order) {
      if (!byId.has(id)) continue;
      ordered.push(byId.get(id));
      byId.delete(id);
    }
    for (const column of byId.values()) ordered.push(column);
    return ordered.concat(trailingActions);
  }

  function normalizeVisibleSpecFields(visibleSpecKeys, rows, scope) {
    if (Array.isArray(visibleSpecKeys) && visibleSpecKeys.length) {
      return [...new Set(visibleSpecKeys.map(key => canonicalField(key, scope)).filter(Boolean))]
        .filter(key => key.startsWith('spec:') && !RATING_REVIEW_SPEC_KEYS.has(key.slice(5)));
    }
    return discoverSpecFields(rows)
      .filter(key => !RATING_REVIEW_SPEC_KEYS.has(key.slice(5)));
  }

  function makeRow(product, flattened, idx) {
    const id = productIdOf(product, idx);
    const row = Object.assign({}, product, flattened);
    row.id = id;
    row.title = productDisplayName(product);
    row.image = product?.image || product?.thumb || product?.thumbnail || '';
    row._shopScout = {
      productId: id,
      url: product?.url || '',
      index: idx,
      revision: Number.isFinite(Number(product?._revision)) ? Number(product._revision) : 0,
      product
    };
    return row;
  }

  function buildProductsRowsProjection(products, options) {
    const opts = options || {};
    const viewState = opts.viewState || {};
    const scope = opts.root || root;
    const input = Array.isArray(products) ? products : [];
    const flattened = flattenProducts(input, opts);
    const rows = input.map((product, idx) => makeRow(product, flattened[idx] || product, idx));
    const removed = removedColumnSet(viewState);
    const specFields = normalizeVisibleSpecFields(opts.visibleSpecKeys, rows, scope)
      .filter(field => !removed.has(field));
    const specColumns = specFields.map(field => ({
      id: field,
      field,
      name: fieldLabel(field),
      type: 'spec',
      editable: true,
      specKey: field.slice(5)
    }));
    /* No trailing ACTIONS_COLUMN — row actions now render under the
       thumbnail in the image cell. Keeping ACTIONS_COLUMN in allColumns
       would surface an empty column at the far right that can't be
       hidden. */
    /* Column ordering:
       1) Frozen triplet: select, thumb, title.
       2) Fixed default row in a specific order (Price, Source,
          Rating, User Rating, Notes) — always visible, even if no
          product has a value.
       3) Everything else (base Brand/Model + every spec column)
          sorted by how many products have a value for it,
          descending. If a column has zero populated rows it's
          marked defaultHidden — but only in this dynamic section,
          so the fixed row above never disappears silently. */
    const populatedRowCount = (column) => {
      const field = column.field || column.id;
      let count = 0;
      for (const row of rows) if (hasNonEmptyCellValue(row?.[field])) count += 1;
      return count;
    };
    const frozenCols = BASE_COLUMNS.filter(column => FROZEN_COLUMN_IDS.has(column.id));
    const fixedCols = FIXED_ORDER_IDS
      .map(id => BASE_COLUMNS.find(column => column.id === id))
      .filter(Boolean);
    const staticExtras = BASE_COLUMNS.filter(column =>
      !FROZEN_COLUMN_IDS.has(column.id) && !FIXED_ORDER_IDS.includes(column.id)
    );
    const dynamicCols = staticExtras.concat(specColumns)
      .map(column => ({ column, count: populatedRowCount(column) }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return String(a.column.name).localeCompare(String(b.column.name));
      })
      .map(({ column, count }) => count === 0
        ? Object.assign({}, column, { defaultHidden: true })
        : column);
    const allColumns = frozenCols
      .concat(fixedCols)
      .concat(dynamicCols)
      .filter(column => column.required || !removed.has(column.id));
    const filteredRows = applyFilters(rows, viewState.filters, scope);
    const sortedRows = applySort(filteredRows, viewState.sort);
    const grouping = viewState.group
      ? { field: viewState.group, label: fieldLabel(viewState.group) }
      : null;
    return {
      mode: 'productsRows',
      columns: applyColumnState(allColumns, viewState),
      allColumns,
      allRows: rows,
      rows: sortedRows,
      productRowCount: filteredRows.length,
      totalProductRowCount: rows.length,
      specFields,
      sort: Array.isArray(viewState.sort) ? viewState.sort.slice() : [],
      filters: Array.isArray(viewState.filters) ? viewState.filters.slice() : [],
      group: viewState.group || null,
      grouping
    };
  }

  function specEntryFromProduct(product, field, scope) {
    if (!field.startsWith('spec:')) return null;
    const specAccess = scope?.ShopScoutProductSpecAccess || root.ShopScoutProductSpecAccess;
    if (specAccess && typeof specAccess.specEntry === 'function') {
      return specAccess.specEntry(product, field.slice(5), { root: scope || root });
    }
    const wanted = canonicalKey(field.slice(5), scope);
    const specs = product?._spec?.specs;
    if (specs && typeof specs === 'object') {
      for (const [key, entry] of Object.entries(specs)) {
        if (canonicalKey(key, scope) === wanted) return entry;
      }
    }
    const list = Array.isArray(product?.rawSpecs) ? product.rawSpecs
      : Array.isArray(product?.specs) ? product.specs
        : [];
    for (const spec of list) {
      if (canonicalKey(spec?.key, scope) === wanted) return spec;
    }
    return null;
  }

  function correctionFor(product, field) {
    const corrections = product?.aiCorrections || product?._corrections || {};
    if (Object.prototype.hasOwnProperty.call(corrections, field)) return corrections[field];
    if (field.startsWith('spec:')) {
      const shortKey = field.slice(5);
      if (Object.prototype.hasOwnProperty.call(corrections, shortKey)) return corrections[shortKey];
    }
    const manual = Array.isArray(product?._manualAiCorrections) ? product._manualAiCorrections : [];
    if (manual.length) {
      const wanted = canonicalKey(field.startsWith('spec:') ? field.slice(5) : field, root);
      const match = manual.find(item => canonicalKey(item?.field, root) === wanted);
      if (match) return match.recommendedValue;
    }
    return null;
  }

  function sourceList(entry) {
    if (!entry || typeof entry !== 'object') return [];
    if (Array.isArray(entry.sources)) return entry.sources.filter(Boolean).map(String);
    if (entry.source) return [String(entry.source)];
    return [];
  }

  function displayCell(productRow, field, scope) {
    const product = productRow?._shopScout?.product || productRow || {};
    const entry = specEntryFromProduct(product, field, scope);
    /* v2 normalization envelope wins when present -- .display is
       the already-formatted pill text ("9 V", "60 cm", ["Black","Red"]).
       Only fall through to raw/value when we don't have one. */
    const normalized = entry && typeof entry === 'object' ? entry.normalized : null;
    const fromEntry = entry && typeof entry === 'object'
      ? (entry.raw ?? entry.rawValue ?? entry.value)
      : (entry ?? productRow?.[field]);
    const raw = fromEntry == null ? '' : String(fromEntry);
    const correctedValue = entry && typeof entry === 'object' && entry.display != null && String(entry.display) !== raw
        ? entry.display
        : correctionFor(product, field);
    const corrected = correctedValue != null && String(correctedValue) !== raw
      ? String(correctedValue)
      : null;
    let value;
    if (corrected) {
      value = corrected;
    } else if (entry && typeof entry === 'object' && entry.display != null && entry.display !== '') {
      value = String(entry.display);
    } else if (normalized && normalized.display != null && normalized.display !== '—') {
      value = Array.isArray(normalized.display) ? normalized.display.join(', ') : String(normalized.display);
    } else {
      value = raw;
    }
    return {
      value,
      raw,
      corrected,
      confidence: entry && typeof entry === 'object' && typeof entry.confidence === 'number' ? entry.confidence : null,
      sources: sourceList(entry),
      missing: value == null || value === '',
      productId: productRow?.id || '',
      url: productRow?.url || product?.url || '',
      source: productRow?.source || product?.source || '',
      revision: productRow?._shopScout?.revision || 0,
      field
    };
  }

  function fieldsForMatrix(rowProjection, opts, scope) {
    const removed = removedColumnSet(opts.viewState);
    if (Array.isArray(opts.fields) && opts.fields.length) {
      return opts.fields.map(field => canonicalField(field, scope))
        .filter(field => field && !removed.has(field));
    }
    const visibleSpecs = normalizeVisibleSpecFields(opts.visibleSpecKeys, rowProjection.rows, scope);
    const withoutRemoved = fields => fields.filter(field => !removed.has(field));
    if (opts.matrixMode === 'detailed') {
      return withoutRemoved(BASIC_MATRIX_FIELDS.concat(rowProjection.specFields));
    }
    return withoutRemoved(BASIC_MATRIX_FIELDS.concat(visibleSpecs));
  }

  function buildComparisonMatrixProjection(products, options) {
    const opts = options || {};
    const scope = opts.root || root;
    const rowProjection = buildProductsRowsProjection(products, {
      root: scope,
      visibleSpecKeys: opts.visibleSpecKeys,
      viewState: opts.viewState
    });
    const matrixMode = opts.matrixMode === 'detailed' ? 'detailed' : 'basic';
    const uniqueFields = [...new Set(fieldsForMatrix(rowProjection, Object.assign({}, opts, { matrixMode }), scope))];
    const productColumns = rowProjection.rows.map((row, idx) => ({
      id: `product:${row.id}`,
      field: `product:${row.id}`,
      name: row.title || `Product ${idx + 1}`,
      type: 'matrixCell',
      productId: row.id,
      image: row.image || row.thumb || row.thumbnail || '',
      source: row.source || '',
      url: row.url || row._shopScout?.product?.url || '',
      minWidth: 180
    }));
    const rows = uniqueFields.map(field => {
      const matrixRow = {
        id: field,
        attribute: fieldLabel(field),
        type: field.startsWith('spec:') ? 'spec' : 'field'
      };
      for (const productRow of rowProjection.rows) {
        matrixRow[`product:${productRow.id}`] = displayCell(productRow, field, scope);
      }
      return matrixRow;
    });
    return {
      mode: 'comparisonMatrix',
      matrixMode,
      columns: [{ id: 'attribute', field: 'attribute', name: 'Buying Factor', type: 'attribute', minWidth: 190 }]
        .concat(productColumns),
      rows,
      products: rowProjection.rows,
      groupColumns: rowProjection.allColumns,
      sort: Array.isArray(opts.viewState?.sort) ? opts.viewState.sort.slice() : []
    };
  }

  Object.assign(NS, {
    buildProductsRowsProjection,
    buildComparisonMatrixProjection
  });
})(globalThis);
