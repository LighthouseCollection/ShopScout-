/* =============================================================
   ShopScout — Codex grid projections

   Pure data builders for the Phase 2 grid. These functions do not
   render, persist, or mutate products; they only shape captured
   product data into grid-ready products-as-rows and products-as-
   columns projections.
   ============================================================= */
(function initShopScoutGridCodexProjections(root) {
  const NS = (root.ShopScoutGridCodexProjections = root.ShopScoutGridCodexProjections || {});

  const BASE_COLUMNS = [
    { id: 'select', field: '_selected', name: '', type: 'selection', width: 40, minWidth: 40, maxWidth: 40, required: true },
    { id: 'thumb', field: 'image', name: '', type: 'image', width: 76, required: true },
    { id: 'title', field: 'title', name: 'Name', type: 'text', minWidth: 260, editable: true, required: true },
    { id: 'brand', field: 'brand', name: 'Brand', type: 'text', minWidth: 120, editable: true },
    { id: 'newPrice', field: 'newPrice', name: 'Price', type: 'price', width: 104, editable: true },
    { id: 'source', field: 'source', name: 'Source', type: 'source', width: 118 },
    { id: 'modelName', field: 'modelName', name: 'Model', type: 'text', minWidth: 160, editable: true },
    { id: 'rating', field: 'rating', name: 'Rating', type: 'rating', width: 128, editable: true },
    { id: 'notes', field: 'notes', name: 'Notes', type: 'text', minWidth: 160, editable: true }
  ];

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
    reviewCount: 'Reviews',
    notes: 'Notes',
    sellerName: 'Seller',
    category: 'Category',
    availability: 'Availability'
  };

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
    if (text.startsWith('spec:')) return `spec:${canonicalKey(text.slice(5), scope)}`;
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

  function productIdOf(product, idx) {
    return String(product?.id || product?.url || `row-${idx + 1}`);
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
    const widths = state.columnWidths || {};
    const order = Array.isArray(state.columnOrder) ? state.columnOrder : [];
    const pinned = new Set(Array.isArray(state.pinnedColumns) ? state.pinnedColumns : []);
    const prepared = columns
      .map(column => {
        const next = Object.assign({}, column);
        if (widths[next.id] != null && Number(widths[next.id]) > 0) next.width = Number(widths[next.id]);
        if (pinned.has(next.id)) next.pinned = true;
        return next;
      })
      .filter(column => column.required || visibility[column.id] !== false);
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
        .filter(key => key.startsWith('spec:'));
    }
    return discoverSpecFields(rows);
  }

  function makeRow(product, flattened, idx) {
    const id = productIdOf(product, idx);
    const row = Object.assign({}, product, flattened);
    row.id = id;
    row.title = product?.title || product?.productName || product?.listingTitle || '';
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
    const specFields = normalizeVisibleSpecFields(opts.visibleSpecKeys, rows, scope);
    const specColumns = specFields.map(field => ({
      id: field,
      field,
      name: fieldLabel(field),
      type: 'spec',
      minWidth: 132,
      editable: true,
      specKey: field.slice(5)
    }));
    const allColumns = BASE_COLUMNS.concat(specColumns, [ACTIONS_COLUMN]);
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
    const fromEntry = entry && typeof entry === 'object'
      ? (entry.rawValue ?? entry.value ?? entry.canonicalValue)
      : (entry ?? productRow?.[field]);
    const raw = fromEntry == null ? '' : String(fromEntry);
    const correctedValue = entry && typeof entry === 'object' && entry.canonicalValue != null
      ? entry.canonicalValue
      : correctionFor(product, field);
    const corrected = correctedValue != null && String(correctedValue) !== raw
      ? String(correctedValue)
      : null;
    const value = corrected || raw;
    return {
      value,
      raw,
      corrected,
      confidence: entry && typeof entry === 'object' && typeof entry.confidence === 'number' ? entry.confidence : null,
      sources: sourceList(entry),
      missing: value == null || value === '',
      productId: productRow?.id || '',
      revision: productRow?._shopScout?.revision || 0,
      field
    };
  }

  function fieldsForMatrix(rowProjection, opts, scope) {
    if (Array.isArray(opts.fields) && opts.fields.length) {
      return opts.fields.map(field => canonicalField(field, scope)).filter(Boolean);
    }
    const visibleSpecs = normalizeVisibleSpecFields(opts.visibleSpecKeys, rowProjection.rows, scope);
    if (opts.matrixMode === 'detailed') {
      return BASIC_MATRIX_FIELDS.concat(rowProjection.specFields);
    }
    return BASIC_MATRIX_FIELDS.concat(visibleSpecs);
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
      sort: Array.isArray(opts.viewState?.sort) ? opts.viewState.sort.slice() : []
    };
  }

  Object.assign(NS, {
    buildProductsRowsProjection,
    buildComparisonMatrixProjection
  });
})(globalThis);
