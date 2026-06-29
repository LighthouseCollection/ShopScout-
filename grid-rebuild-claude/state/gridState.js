/* =============================================================
   Phase 2 grid — view state.
   Pure JSON, serializable, plays nicely with SSViewsRepo.
   Mutations go through update(state, patch); the function returns a
   new state object so subscribers see a clean before/after.
   ============================================================= */
(function initShopScoutGridState(root) {
  const NS = (root.ShopScoutGridState = root.ShopScoutGridState || {});

  function freshState() {
    return {
      mode: 'rows',              /* 'rows' | 'columns' */
      matrix: 'basic',           /* 'basic' | 'detailed'  (mode='columns') */
      filters: [],               /* [{ field, op, value, conj? }] */
      sort: [],                  /* [{ field, dir }] multi-column */
      group: null,               /* field id, or null */
      selectedProductIds: [],    /* string[] — array for JSON portability */
      columnVisibility: {},      /* { fieldId: boolean } */
      columnOrder: [],           /* string[] field ids */
      columnWidths: {},          /* { fieldId: number } */
      pinnedColumns: [],         /* string[] field ids pinned left */
      savedViewId: null,
      search: ''                 /* free-text search across visible fields */
    };
  }

  /* update(state, patch) → new state.
     Top-level keys are replaced or shallow-merged. Arrays and objects
     in `patch` replace the previous value (no deep merge) — explicit
     is friendlier than magic for a state with this much shape. */
  function update(state, patch) {
    if (!patch || typeof patch !== 'object') return state;
    return Object.assign({}, state, patch);
  }

  /* serialize / deserialize for SSViewsRepo round-trip.
     Sets get coerced through the array round-trip already; this is
     a courtesy guard against accidental Set leakage in `patch`. */
  function serialize(state) {
    const out = Object.assign({}, state);
    if (out.selectedProductIds instanceof Set) {
      out.selectedProductIds = [...out.selectedProductIds];
    }
    return JSON.parse(JSON.stringify(out));
  }

  function deserialize(blob) {
    const base = freshState();
    if (!blob || typeof blob !== 'object') return base;
    const merged = Object.assign({}, base, blob);
    /* Coerce selectedProductIds back to array. Use duck-typing
       (Symbol.iterator) so cross-realm Sets — e.g. from a saved-view
       blob round-tripped through a different context — still
       deserialize correctly. */
    const ids = merged.selectedProductIds;
    if (Array.isArray(ids)) {
      /* already in shape */
    } else if (ids && typeof ids === 'object' && typeof ids[Symbol.iterator] === 'function') {
      merged.selectedProductIds = [...ids];
    } else {
      merged.selectedProductIds = [];
    }
    return merged;
  }

  /* createStore({initialState, onChange?}) — minimal observable store.
     Returns {getState, dispatch, subscribe}. dispatch(patch) merges and
     fires every subscriber with the new state. */
  function createStore(opts) {
    const o = opts || {};
    let state = deserialize(o.initialState || freshState());
    const listeners = new Set();

    function getState() { return state; }

    function dispatch(patch) {
      const next = update(state, patch);
      if (next === state) return state;
      state = next;
      for (const fn of [...listeners]) {
        try { fn(state); } catch (err) { console.warn('GridState listener threw', err); }
      }
      return state;
    }

    function subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    }

    return { getState, dispatch, subscribe };
  }

  /* --- Action helpers ------------------------------------------ */
  /* These build the patch objects so callsites read clearly. None of
     them mutate state; the store applies the patch via update(). */

  function setMode(mode) {
    return { mode: mode === 'columns' ? 'columns' : 'rows' };
  }

  function setMatrix(matrix) {
    return { matrix: matrix === 'detailed' ? 'detailed' : 'basic' };
  }

  function addFilter(filter) {
    return { __addFilter: filter };
  }

  function clearFilters() {
    return { filters: [] };
  }

  function setSort(field, dir) {
    return { __setSort: { field, dir: dir === 'desc' ? 'desc' : 'asc' } };
  }

  function toggleSelection(productId) {
    return { __toggleSelection: productId };
  }

  function clearSelection() {
    return { selectedProductIds: [] };
  }

  /* applyAction(state, action) — translates the helper output into
     a real patch. Splits filter add / sort toggle / selection toggle
     into proper array semantics. */
  function applyAction(state, action) {
    if (!action || typeof action !== 'object') return state;

    if (action.__addFilter) {
      const filters = (state.filters || []).concat(action.__addFilter);
      return update(state, { filters });
    }
    if (action.__setSort) {
      const { field, dir } = action.__setSort;
      const existing = (state.sort || []).filter(s => s.field !== field);
      const next = [...existing, { field, dir }];
      return update(state, { sort: next });
    }
    if (action.__toggleSelection != null) {
      const id = String(action.__toggleSelection);
      const set = new Set(state.selectedProductIds || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return update(state, { selectedProductIds: [...set] });
    }
    return update(state, action);
  }

  Object.assign(NS, {
    freshState,
    update,
    serialize,
    deserialize,
    createStore,
    applyAction,
    /* Action builders — return patches consumable by applyAction */
    setMode, setMatrix, addFilter, clearFilters, setSort,
    toggleSelection, clearSelection
  });
})(globalThis);
