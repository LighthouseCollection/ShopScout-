(function initShopScoutSelectors(root) {
  const NS = (root.ShopScoutState = root.ShopScoutState || {});

  function activeListId(state) {
    return state && state.activeListId || '';
  }

  function activeList(state) {
    return state && state.lists && state.lists[state.activeListId] || null;
  }

  function productById(state, productId) {
    return state && state.products && state.products[productId] || null;
  }

  function productsForList(state, listId) {
    const list = state && state.lists && state.lists[listId];
    if (!list || !Array.isArray(list.productIds)) return [];
    return list.productIds.map(id => productById(state, id)).filter(Boolean);
  }

  function activeListProducts(state) {
    return productsForList(state, activeListId(state));
  }

  function aiRunById(state, runId) {
    return state && state.aiRuns && state.aiRuns[runId] || null;
  }

  function productRevision(state, productId) {
    const product = productById(state, productId);
    return Number(product && product._revision || 0);
  }

  function viewColumns(state) {
    return state && state.view && state.view.columns || {};
  }

  NS.Selectors = {
    activeListId,
    activeList,
    productById,
    productsForList,
    activeListProducts,
    aiRunById,
    productRevision,
    viewColumns
  };
})(globalThis);
