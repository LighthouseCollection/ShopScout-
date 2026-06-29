(function initShopScoutAppStore(root) {
  const NS = (root.ShopScoutState = root.ShopScoutState || {});
  const TYPES = NS.Actions && NS.Actions.TYPES || {};

  function shallowRecord(record) {
    return Object.assign({}, record || {});
  }

  function cloneArray(value) {
    return Array.isArray(value) ? value.slice() : [];
  }

  function normalizeState(input) {
    const source = input || {};
    const lists = {};
    const products = {};
    const aiRuns = {};

    for (const [id, list] of Object.entries(source.lists || {})) {
      lists[id] = Object.assign({}, list, {
        id: list.id || id,
        productIds: cloneArray(list.productIds)
      });
    }

    for (const [id, product] of Object.entries(source.products || {})) {
      products[id] = normalizeProduct(product, product.listId, id);
    }

    for (const [id, run] of Object.entries(source.aiRuns || {})) {
      aiRuns[id] = Object.assign({}, run, { stages: cloneArray(run.stages) });
    }

    return {
      revision: Number(source.revision || 0),
      activeListId: source.activeListId || Object.keys(lists)[0] || '',
      lists,
      products,
      aiRuns,
      view: Object.assign({ columns: {}, filters: [], sort: [], groupBy: [] }, source.view || {}),
      conflicts: cloneArray(source.conflicts)
    };
  }

  function normalizeProduct(product, listId, fallbackId) {
    const source = product || {};
    const id = source.id || fallbackId || makeProductId(source);
    return Object.assign({}, source, {
      id,
      listId: source.listId || listId || '',
      _revision: Math.max(1, Number(source._revision || 1))
    });
  }

  function makeProductId(product) {
    const base = product && (product.url || product.title) || Date.now();
    return 'product-' + String(base).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  }

  function bumpState(state, patch) {
    return Object.assign({}, state, patch || {}, { revision: Number(state.revision || 0) + 1 });
  }

  function productConflict(product, baseRevision) {
    /* Legacy callers may dispatch without baseRevision during migration.
       Null means "do not assert a snapshot"; strict callers should pass it. */
    return baseRevision != null && Number(product && product._revision || 0) > Number(baseRevision);
  }

  function updateProduct(state, action, nextFields, source) {
    const current = state.products[action.productId];
    if (!current) return { state, result: { ok: false, reason: 'missing-product' } };
    if (action.listId && current.listId && action.listId !== current.listId) {
      return { state, result: { ok: false, reason: 'list-mismatch' } };
    }
    if (productConflict(current, action.baseRevision)) {
      const conflict = {
        type: source,
        productId: action.productId,
        listId: action.listId || current.listId,
        baseRevision: action.baseRevision,
        currentRevision: current._revision
      };
      return {
        state: bumpState(state, { conflicts: state.conflicts.concat(conflict) }),
        result: { ok: false, reason: 'revision-conflict', conflict }
      };
    }
    const nextRevision = Number(current._revision || 0) + 1;
    const products = shallowRecord(state.products);
    products[action.productId] = Object.assign({}, current, nextFields || {}, {
      _revision: nextRevision,
      _lastMutationSource: source,
      updatedAt: Date.now()
    });
    return {
      state: bumpState(state, { products }),
      result: { ok: true, product: products[action.productId] }
    };
  }

  function importProducts(state, action) {
    const listId = action.listId || 'list-' + Date.now();
    const incoming = Array.isArray(action.products) ? action.products : [];
    const productIds = [];
    const products = shallowRecord(state.products);
    for (const item of incoming) {
      const product = normalizeProduct(item, listId);
      productIds.push(product.id);
      products[product.id] = product;
    }
    const lists = shallowRecord(state.lists);
    lists[listId] = Object.assign({}, lists[listId] || {}, {
      id: listId,
      name: action.listName || lists[listId]?.name || listId,
      productIds
    });
    const activeListId = state.activeListId || listId;
    return {
      state: bumpState(state, { lists, products, activeListId }),
      result: { ok: true, list: lists[listId], products: productIds.map(id => products[id]) }
    };
  }

  function deleteProduct(state, action) {
    const current = state.products[action.productId];
    if (!current) return { state, result: { ok: false, reason: 'missing-product' } };
    const products = shallowRecord(state.products);
    delete products[action.productId];
    const lists = shallowRecord(state.lists);
    const listId = action.listId || current.listId;
    const list = lists[listId];
    if (list) {
      lists[listId] = Object.assign({}, list, {
        productIds: cloneArray(list.productIds).filter(id => id !== action.productId)
      });
    }
    return { state: bumpState(state, { products, lists }), result: { ok: true } };
  }

  function saveAiStage(state, action) {
    const run = state.aiRuns[action.runId];
    if (!run) return { state, result: { ok: false, reason: 'missing-run' } };
    const stage = Object.assign({}, action.stage || {});
    const stages = cloneArray(run.stages);
    const stageId = stage.id || stage.name || stage.role || 'stage-' + stages.length;
    const index = stages.findIndex(item => (item.id || item.name || item.role) === stageId);
    if (index >= 0) stages[index] = Object.assign({}, stages[index], stage, { id: stageId });
    else stages.push(Object.assign({}, stage, { id: stageId }));
    const aiRuns = shallowRecord(state.aiRuns);
    aiRuns[action.runId] = Object.assign({}, run, { stages, status: 'running' });
    return { state: bumpState(state, { aiRuns }), result: { ok: true, run: aiRuns[action.runId] } };
  }

  function reducer(state, action) {
    if (!action || !action.type) return { state, result: { ok: false, reason: 'missing-action' } };
    if (action.type === TYPES.LIST_CHANGED) {
      if (!state.lists[action.listId]) return { state, result: { ok: false, reason: 'missing-list' } };
      return { state: bumpState(state, { activeListId: action.listId }), result: { ok: true } };
    }
    if (action.type === TYPES.PRODUCT_EDITED) {
      return updateProduct(state, action, action.changes || {}, 'manual-edit');
    }
    if (action.type === TYPES.PRODUCT_RESCANNED) {
      return updateProduct(state, action, action.product || {}, 'rescan');
    }
    if (action.type === TYPES.PRODUCT_DELETED) {
      return deleteProduct(state, action);
    }
    if (action.type === TYPES.PRODUCTS_IMPORTED) {
      return importProducts(state, action);
    }
    if (action.type === TYPES.AI_RUN_STARTED) {
      const runId = action.runId || 'run-' + Date.now();
      const aiRuns = shallowRecord(state.aiRuns);
      aiRuns[runId] = {
        id: runId,
        listId: action.listId || state.activeListId,
        status: 'running',
        stages: [],
        startedAt: action.startedAt || Date.now()
      };
      return { state: bumpState(state, { aiRuns }), result: { ok: true, run: aiRuns[runId] } };
    }
    if (action.type === TYPES.AI_RUN_PARTIAL_RESULT_SAVED) {
      return saveAiStage(state, action);
    }
    if (action.type === TYPES.AI_RUN_FAILED || action.type === TYPES.AI_RUN_COMPLETED) {
      const run = state.aiRuns[action.runId];
      if (!run) return { state, result: { ok: false, reason: 'missing-run' } };
      const aiRuns = shallowRecord(state.aiRuns);
      const isFailed = action.type === TYPES.AI_RUN_FAILED;
      const hasStages = cloneArray(run.stages).length > 0;
      aiRuns[action.runId] = Object.assign({}, run, {
        status: isFailed ? (hasStages ? 'partial' : 'failed') : 'completed',
        error: action.error || '',
        completedAt: action.completedAt || Date.now()
      });
      return { state: bumpState(state, { aiRuns }), result: { ok: true, run: aiRuns[action.runId] } };
    }
    if (action.type === TYPES.VIEW_COLUMNS_CHANGED) {
      const view = Object.assign({}, state.view, { columns: Object.assign({}, action.columns || {}) });
      return { state: bumpState(state, { view }), result: { ok: true, view } };
    }
    return { state, result: { ok: false, reason: 'unknown-action' } };
  }

  function createStore(options) {
    const opts = options || {};
    const eventBus = opts.eventBus || NS.createEventBus();
    const lockManager = opts.lockManager || NS.createLockManager();
    let state = normalizeState(opts.initialState);

    function getState() {
      return state;
    }

    function subscribe(listener) {
      return eventBus.subscribe(listener);
    }

    async function dispatch(action) {
      const apply = () => {
        const previous = state;
        const next = reducer(state, action);
        state = next.state;
        if (state !== previous) {
          eventBus.publish({ type: 'change', action, state, previous, result: next.result });
        }
        return next.result;
      };
      const lockKey = action && action.meta && action.meta.lockKey;
      return lockKey ? lockManager.runWithLock(lockKey, apply) : apply();
    }

    function replaceState(nextState) {
      const previous = state;
      state = normalizeState(nextState);
      eventBus.publish({ type: 'replace', state, previous, result: { ok: true } });
      return { ok: true };
    }

    return { getState, dispatch, subscribe, replaceState, locks: lockManager };
  }

  NS.createStore = createStore;
  NS.normalizeState = normalizeState;
})(globalThis);
