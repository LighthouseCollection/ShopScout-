/* =============================================================
   Projection B — attributes/specs as rows, products as columns.
   Used for side-by-side comparison (Basic Matrix / Detailed Matrix).

   project(products, state) → { columns, rows, kind, matrixMode }

   Pure function. The "rows" are SpecRow definitions from
   matrixModes.js; the renderer iterates and applies each accessor
   to each product. Cells are DisplayCell shape, so the renderer can
   show raw / corrected / conflict / source / confidence with a
   single formatter.
   ============================================================= */
(function initProductsAsColumns(root) {
  const NS = (root.ShopScoutGridProjections = root.ShopScoutGridProjections || {});
  const MM = NS.matrixModes || (root.ShopScoutGridProjections && root.ShopScoutGridProjections.matrixModes) || null;

  /* Filter the product set BEFORE pivoting. Reuses the same filter
     operators productsAsRows.project applies — that consistency is
     the whole point of "filtering is an operation on the active
     projection". We keep the helper inline rather than importing
     productsAsRows so that loading projections individually still
     works in tests. */
  const OPS = {
    eq:        (v, t) => String(v ?? '') === String(t ?? ''),
    neq:       (v, t) => String(v ?? '') !== String(t ?? ''),
    contains:  (v, t) => String(v ?? '').toLowerCase().includes(String(t ?? '').toLowerCase()),
    empty:     (v)    => v == null || v === '',
    notempty:  (v)    => v != null && v !== '',
    gt:        (v, t) => parseNum(v) >  parseNum(t),
    lt:        (v, t) => parseNum(v) <  parseNum(t),
    gte:       (v, t) => parseNum(v) >= parseNum(t),
    lte:       (v, t) => parseNum(v) <= parseNum(t)
  };

  function parseNum(v) {
    const Values = root.ShopScoutValues;
    if (Values && typeof Values.parseNumeric === 'function') {
      const n = Values.parseNumeric(v);
      if (isFinite(n)) return n;
    }
    const cleaned = String(v ?? '').replace(/[^\d.\-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.') return NaN;
    const n = Number(cleaned);
    return isFinite(n) ? n : NaN;
  }

  function filterProducts(products, filters) {
    if (!Array.isArray(filters) || filters.length === 0) return products;
    return (products || []).filter(p => {
      let acc = true, started = false;
      for (const f of filters) {
        const fn = OPS[f && f.op] || (() => true);
        const match = fn(p[f.field], f.value);
        if (!started) { acc = match; started = true; continue; }
        acc = f.conj === 'or' ? (acc || match) : (acc && match);
      }
      return acc;
    });
  }

  /* Spec-row filter — when state.specRowFilter is a string, drop
     spec rows whose label doesn't contain it (case-insensitive). */
  function filterSpecRows(rows, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.kind !== 'spec' || String(r.key).toLowerCase().includes(q));
  }

  /* Build the product-column definitions. The first column is the
     attribute/spec label (sticky); the rest map to products. */
  function buildColumns(products, state) {
    const fixed = [{
      id: '__attr',
      field: '__attr',
      label: 'Attribute',
      pinned: true,
      width: state && state.attrColumnWidth ? state.attrColumnWidth : 240,
      kind: 'attribute',
      visible: true
    }];

    const productCols = (products || []).map((p, idx) => {
      const id = p.id || ('p' + idx);
      return {
        id: 'product:' + id,
        field: 'product:' + id,
        label: p.title || p.brand || ('Product ' + (idx + 1)),
        product: p,
        productIndex: idx,
        kind: 'product',
        align: 'left',
        visible: true,
        width: (state && state.columnWidths && state.columnWidths['product:' + id]) || null
      };
    });

    return fixed.concat(productCols);
  }

  /* Build SpecRow → DisplayCell map for the SlickGrid data model:
     one record per spec row, with `__attr` (label) + `product:<id>`
     keys. The renderer's cell formatter reads the DisplayCell shape
     directly. */
  function buildRows(products, state, specRows) {
    const out = [];
    for (const spec of specRows) {
      const record = {
        __id: spec.id,
        __attr: spec.key,
        __kind: spec.kind,
        __field: spec.field
      };
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const id = p.id || ('p' + i);
        record['product:' + id] = spec.accessor(p);
      }
      out.push(record);
    }
    return out;
  }

  function project(products, state) {
    const safeState = state || {};
    if (!MM || typeof MM.buildRows !== 'function') {
      return {
        kind: 'columns', matrixMode: 'basic',
        columns: [], rows: [],
        error: 'matrixModes module not loaded — projection unavailable'
      };
    }
    const filteredProducts = filterProducts(products || [], safeState.filters || []);
    const specRowDefs = filterSpecRows(MM.buildRows(filteredProducts, safeState), safeState.specRowSearch);
    const columns = buildColumns(filteredProducts, safeState);
    const rows = buildRows(filteredProducts, safeState, specRowDefs);
    return {
      kind: 'columns',
      matrixMode: safeState.matrix === 'detailed' ? 'detailed' : 'basic',
      columns,
      rows,
      totalProductCount: (products || []).length,
      visibleProductCount: filteredProducts.length,
      specRowCount: rows.length
    };
  }

  NS.productsAsColumns = {
    project,
    buildColumns,
    buildRows,
    filterProducts,
    filterSpecRows
  };
})(globalThis);
