(function initShopScoutActions(root) {
  const NS = (root.ShopScoutState = root.ShopScoutState || {});

  const TYPES = {
    LIST_CHANGED: 'LIST_CHANGED',
    PRODUCT_EDITED: 'PRODUCT_EDITED',
    PRODUCT_RESCANNED: 'PRODUCT_RESCANNED',
    PRODUCT_DELETED: 'PRODUCT_DELETED',
    PRODUCTS_IMPORTED: 'PRODUCTS_IMPORTED',
    AI_RUN_STARTED: 'AI_RUN_STARTED',
    AI_RUN_PARTIAL_RESULT_SAVED: 'AI_RUN_PARTIAL_RESULT_SAVED',
    AI_RUN_FAILED: 'AI_RUN_FAILED',
    AI_RUN_COMPLETED: 'AI_RUN_COMPLETED',
    VIEW_COLUMNS_CHANGED: 'VIEW_COLUMNS_CHANGED'
  };

  function listLock(listId) {
    return listId ? `list:${listId}` : null;
  }

  function withMeta(action, meta) {
    return Object.assign({}, action, { meta: Object.assign({}, action.meta || {}, meta || {}) });
  }

  function withListLock(action, listId) {
    const lockKey = listLock(listId);
    return lockKey ? withMeta(action, { lockKey }) : action;
  }

  function listChanged(listId) {
    return { type: TYPES.LIST_CHANGED, listId };
  }

  function productEdited(payload) {
    return withListLock(Object.assign({ type: TYPES.PRODUCT_EDITED }, payload || {}), payload && payload.listId);
  }

  function productRescanned(payload) {
    return withListLock(Object.assign({ type: TYPES.PRODUCT_RESCANNED }, payload || {}), payload && payload.listId);
  }

  function productDeleted(payload) {
    return withListLock(Object.assign({ type: TYPES.PRODUCT_DELETED }, payload || {}), payload && payload.listId);
  }

  function productsImported(payload) {
    return withListLock(Object.assign({ type: TYPES.PRODUCTS_IMPORTED }, payload || {}), payload && payload.listId);
  }

  function aiRunStarted(payload) {
    return Object.assign({ type: TYPES.AI_RUN_STARTED }, payload || {});
  }

  function aiRunPartialResultSaved(payload) {
    return Object.assign({ type: TYPES.AI_RUN_PARTIAL_RESULT_SAVED }, payload || {});
  }

  function aiRunFailed(payload) {
    return Object.assign({ type: TYPES.AI_RUN_FAILED }, payload || {});
  }

  function aiRunCompleted(payload) {
    return Object.assign({ type: TYPES.AI_RUN_COMPLETED }, payload || {});
  }

  function viewColumnsChanged(payload) {
    return Object.assign({ type: TYPES.VIEW_COLUMNS_CHANGED }, payload || {});
  }

  NS.Actions = {
    TYPES,
    listLock,
    listChanged,
    productEdited,
    productRescanned,
    productDeleted,
    productsImported,
    aiRunStarted,
    aiRunPartialResultSaved,
    aiRunFailed,
    aiRunCompleted,
    viewColumnsChanged
  };
})(globalThis);
