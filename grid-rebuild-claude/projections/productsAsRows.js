/* =============================================================
   Projection A — products as rows, attributes/specs as columns.
   Used for browsing, filtering, sorting, grouping, bulk actions,
   and inline edits.

   project(products, state) → { columns, rows, group, sortBy, filters }

   Pure function. No DOM, no SlickGrid reference. Filtering and
   sorting are applied here as state operations on the active
   projection — they do NOT mutate the input products array.
   ============================================================= */
(function initProductsAsRows(root) {
  const NS = (root.ShopScoutGridProjections = root.ShopScoutGridProjections || {});
  const Values = root.ShopScoutValues || null;
  const Projections = root.ShopScoutProjections || null;

  /* Built-in product fields that are always candidates for columns,
     in the canonical display order. Spec columns are appended after
     these (sorted by frequency via shared/specHeuristic). */
  const PRODUCT_FIELDS = [
    { id: 'thumb',         label: '',             accessor: row => row.image || '',          system: true,  width: 64 },
    { id: 'title',         label: 'Product',      accessor: row => row.title || '',          pinned: true },
    { id: 'brand',         label: 'Brand',        accessor: row => row.brand || '' },
    { id: 'source',        label: 'Source',       accessor: row => row.source || '' },
    { id: 'newPrice',      label: 'Price',        accessor: row => row.newPrice || '',       numeric: true, align: 'right' },
    { id: 'rating',        label: 'Rating',       accessor: row => row.rating || '',         numeric: true, align: 'right' },
    { id: 'userRating',    label: 'My rating',    accessor: row => row.userRating || 0,      numeric: true, align: 'right' },
    { id: 'availability',  label: 'Availability', accessor: row => row.availability || '' },
    { id: 'status',        label: 'Status',       accessor: row => row._status || row.status || '' },
    { id: 'notes',         label: 'Notes',        accessor: row => row.notes || '' }
  ];

  /* Filter operators. Map each one to a predicate (value, target). */
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
    /* Try shared parseNumeric first for time/unit-aware parsing,
       then fall back to a strip-non-numeric pass so currency-prefixed
       values like "$59.99" sort correctly. */
    if (Values && typeof Values.parseNumeric === 'function') {
      const n = Values.parseNumeric(v);
      if (isFinite(n)) return n;
    }
    const cleaned = String(v ?? '').replace(/[^\d.\-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.') return NaN;
    const n = Number(cleaned);
    return isFinite(n) ? n : NaN;
  }

  /* Build the column list for a given set of products + state.
     Returns ColumnDef[]:
       { id, field, label, system?, numeric?, align?, pinned?,
         width?, visible }
     The renderer translates these into SlickGrid column defs. */
  function buildColumns(products, state) {
    const visibility = state.columnVisibility || {};
    const widths = state.columnWidths || {};
    const pinned = new Set(state.pinnedColumns || []);

    const fields = PRODUCT_FIELDS.map(f => ({
      id: f.id,
      field: f.id,
      label: f.label,
      system: !!f.system,
      numeric: !!f.numeric,
      align: f.align || null,
      pinned: pinned.has(f.id) || !!f.pinned,
      width: widths[f.id] || f.width || null,
      visible: visibility[f.id] !== false
    }));

    /* Spec columns: pull canonical keys via SSSpecHeuristic if loaded
       so default-visible specs match the rest of the app's choice. */
    const heuristic = root.SSSpecHeuristic;
    const specKeys = heuristic && heuristic.allSpecKeys
      ? heuristic.allSpecKeys(products)
      : collectSpecKeysFallback(products);

    const defaultVisible = new Set(
      heuristic && heuristic.pickDefaultSpecColumns
        ? heuristic.pickDefaultSpecColumns(products, { topN: 6, minCoverage: 0.4 })
        : []
    );

    for (const key of specKeys) {
      const fieldId = 'spec:' + key;
      fields.push({
        id: fieldId,
        field: fieldId,
        label: key,
        system: false,
        numeric: false,
        align: null,
        pinned: pinned.has(fieldId),
        width: widths[fieldId] || null,
        visible: visibility[fieldId] != null
          ? visibility[fieldId]
          : defaultVisible.has(key)
      });
    }

    return applyColumnOrder(fields, state.columnOrder || []);
  }

  /* Apply user-saved column order, with new/unordered columns kept
     in their natural order at the tail. */
  function applyColumnOrder(columns, order) {
    if (!Array.isArray(order) || order.length === 0) return columns;
    const byId = new Map(columns.map(c => [c.id, c]));
    const out = [];
    for (const id of order) {
      if (byId.has(id)) {
        out.push(byId.get(id));
        byId.delete(id);
      }
    }
    for (const remaining of byId.values()) out.push(remaining);
    return out;
  }

  function collectSpecKeysFallback(products) {
    const seen = new Set();
    for (const p of (products || [])) {
      const specs = Array.isArray(p && p.specs) ? p.specs
                  : Array.isArray(p && p.rawSpecs) ? p.rawSpecs
                  : [];
      for (const s of specs) {
        if (s && s.key) seen.add(String(s.key));
      }
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  }

  /* Flatten products into row records: spec:<key> hoisted to the top,
     plus all PRODUCT_FIELDS. Uses ShopScoutProjections.flattenSpecs
     when available (preferred — it canonicalizes spec keys). */
  function flattenRows(products) {
    if (Projections && typeof Projections.flattenSpecs === 'function') {
      return Projections.flattenSpecs(products);
    }
    return (products || []).map(p => {
      const flat = Object.assign({}, p);
      const specs = Array.isArray(p && p.specs) ? p.specs
                  : Array.isArray(p && p.rawSpecs) ? p.rawSpecs
                  : [];
      for (const s of specs) {
        if (!s || !s.key) continue;
        flat['spec:' + s.key] = s.value == null ? '' : String(s.value);
      }
      return flat;
    });
  }

  /* Apply state.filters / state.sort / state.search to the rows.
     Filtering: AND by default; rows that pass every filter survive.
     `conj: 'or'` on a filter chains it disjunctively with the
     accumulator since the previous filter. */
  function applyFiltersSort(rows, state) {
    const filters = Array.isArray(state.filters) ? state.filters : [];
    const sort = Array.isArray(state.sort) ? state.sort : [];
    const search = String(state.search || '').trim().toLowerCase();

    let out = rows;

    if (filters.length) {
      out = out.filter(row => evalFilters(row, filters));
    }
    if (search) {
      out = out.filter(row => rowMatchesSearch(row, search));
    }
    if (sort.length) {
      out = out.slice().sort((a, b) => compareBySort(a, b, sort));
    }
    return out;
  }

  function evalFilters(row, filters) {
    let acc = true;
    let started = false;
    for (const f of filters) {
      const fn = OPS[f && f.op] || (() => true);
      const match = fn(row[f.field], f.value);
      if (!started) { acc = match; started = true; continue; }
      acc = f.conj === 'or' ? (acc || match) : (acc && match);
    }
    return acc;
  }

  function rowMatchesSearch(row, query) {
    /* Cheap text-haystack: stringify every primitive value once. */
    if (!row) return false;
    if (!row.__searchText) {
      const parts = [];
      for (const key of Object.keys(row)) {
        const v = row[key];
        if (v == null) continue;
        if (typeof v === 'object') continue;
        parts.push(String(v));
      }
      Object.defineProperty(row, '__searchText', {
        value: parts.join(' ').toLowerCase(),
        enumerable: false
      });
    }
    return row.__searchText.includes(query);
  }

  function compareBySort(a, b, sortList) {
    for (const s of sortList) {
      const av = a[s.field], bv = b[s.field];
      const cmp = compareValues(av, bv);
      if (cmp !== 0) return s.dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  }

  function compareValues(av, bv) {
    const an = parseNum(av), bn = parseNum(bv);
    if (!isNaN(an) && !isNaN(bn)) return an - bn;
    return String(av ?? '').localeCompare(String(bv ?? ''));
  }

  /* The public projection function. */
  function project(products, state) {
    const safeState = state || {};
    const columns = buildColumns(products, safeState);
    const flat = flattenRows(products);
    const rows = applyFiltersSort(flat, safeState);
    return {
      kind: 'rows',
      columns,
      rows,
      group: safeState.group || null,
      sortBy: Array.isArray(safeState.sort) ? safeState.sort.slice() : [],
      filters: Array.isArray(safeState.filters) ? safeState.filters.slice() : [],
      totalCount: flat.length,
      visibleCount: rows.length
    };
  }

  NS.productsAsRows = {
    project,
    /* Exposed for tests + grid renderer that wants to rebuild
       column defs after a saved view loads. */
    buildColumns,
    flattenRows,
    applyFiltersSort,
    PRODUCT_FIELDS: PRODUCT_FIELDS.slice()
  };
})(globalThis);
