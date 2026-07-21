/* =============================================================
   ShopScout — Codex grid state

   Serializable view state for the SlickGrid rebuild. The grid engine
   owns pixels; this module owns what should survive a re-render or a
   saved-view round trip: mode, matrix depth, search, sorting, columns,
   grouping, filters, and selection.
   ============================================================= */
(function initShopScoutGridCodexState(root) {
  const NS = (root.ShopScoutGridCodexState = root.ShopScoutGridCodexState || {});

  function freshState() {
    return {
      mode: 'rows',
      matrixMode: 'basic',
      search: '',
      filters: [],
      sort: [],
      group: null,
      selectedProductIds: [],
      priceDisplayMode: 'nearest5',
      measurementDisplayMode: 'rounded',
      columnVisibility: {},
      removedColumns: [],
      columnOrder: [],
      pinnedColumns: [],
      pinnedTopProductIds: [],
      savedViewId: null
    };
  }

  function asArray(value) {
    if (Array.isArray(value)) return value.slice();
    if (value && typeof value === 'object' && typeof value[Symbol.iterator] === 'function') return [...value];
    return [];
  }

  function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? Object.assign({}, value) : {};
  }

  function normalizeSort(value) {
    return asArray(value)
      .map(item => ({
        field: String(item?.field || '').trim(),
        dir: item?.dir === 'desc' ? 'desc' : 'asc'
      }))
      .filter(item => item.field);
  }

  function deserialize(blob) {
    const base = freshState();
    const input = blob && typeof blob === 'object' ? blob : {};
    return {
      mode: input.mode === 'matrix' ? 'matrix' : 'rows',
      matrixMode: input.matrixMode === 'detailed' ? 'detailed' : 'basic',
      search: String(input.search || ''),
      filters: asArray(input.filters),
      sort: normalizeSort(input.sort),
      group: input.group ? String(input.group) : null,
      selectedProductIds: asArray(input.selectedProductIds).map(String),
      priceDisplayMode: ['actual', 'rounded', 'nearest5'].includes(input.priceDisplayMode) ? input.priceDisplayMode : 'nearest5',
      measurementDisplayMode: input.measurementDisplayMode === 'actual' ? 'actual' : 'rounded',
      columnVisibility: asObject(input.columnVisibility),
      removedColumns: asArray(input.removedColumns).map(String).filter(Boolean),
      columnOrder: asArray(input.columnOrder).map(String).filter(Boolean),
      pinnedColumns: asArray(input.pinnedColumns).map(String).filter(Boolean),
      pinnedTopProductIds: asArray(input.pinnedTopProductIds).map(String).filter(Boolean),
      savedViewId: input.savedViewId ? String(input.savedViewId) : base.savedViewId
    };
  }

  function serialize(state) {
    return JSON.parse(JSON.stringify(deserialize(state)));
  }

  function createStore(initialState) {
    let state = deserialize(initialState || freshState());
    const listeners = new Set();

    function getState() {
      return state;
    }

    function dispatch(patch) {
      if (!patch || typeof patch !== 'object') return state;
      state = deserialize(Object.assign({}, state, patch));
      for (const listener of [...listeners]) {
        try { listener(state); } catch (err) { console.warn('ShopScout grid state listener failed', err); }
      }
      return state;
    }

    function subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    return { getState, dispatch, subscribe };
  }

  Object.assign(NS, {
    freshState,
    deserialize,
    serialize,
    createStore
  });
})(globalThis);
