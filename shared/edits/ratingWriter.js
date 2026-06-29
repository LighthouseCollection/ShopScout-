/* =============================================================
   ShopScout — revision-safe user-rating writer (renderer-agnostic).
   Extracted from table/myRating.js (Task 11 Phase 1). The DOM/
   widget/event-delegation pieces of the old module were the
   grid-coupled half; this is the data layer.

   Public API on window.ShopScoutEdits:
     normalizeRating(value)
         clamps to integer 0..5
     writeRating({ repo, productId, value })
         reads the current product, derives baseRevision,
         calls repo.updateProduct with source: 'myrating-edit'.
         Returns the repo result (extended with currentProduct
         for renderer convenience).
     mirrorLegacyStorage({ chrome, productId, productUrl, value })
         updates chrome.storage.local's legacy shopscout_data
         blob so popup-side reads stay consistent.
   ============================================================= */
(function initShopScoutEdits(root) {
  const NS = (root.ShopScoutEdits = root.ShopScoutEdits || {});

  function normalizeRating(value) {
    const number = Number(value || 0);
    if (!isFinite(number)) return 0;
    return Math.max(0, Math.min(5, Math.floor(number)));
  }

  async function writeRating(options) {
    const opts = options || {};
    const repo = opts.repo;
    const productId = opts.productId || '';
    if (!repo || !productId
        || typeof repo.getProduct !== 'function'
        || typeof repo.updateProduct !== 'function') {
      return { ok: false, reason: 'repo-unavailable' };
    }
    const fresh = await repo.getProduct(productId);
    if (!fresh) return { ok: false, reason: 'missing-product' };
    const result = await repo.updateProduct(
      productId,
      { userRating: normalizeRating(opts.value) },
      {
        listId: fresh.listId,
        baseRevision: fresh._revision,
        source: 'myrating-edit'
      }
    );
    return Object.assign({ currentProduct: fresh }, result || {});
  }

  async function mirrorLegacyStorage(options) {
    const opts = options || {};
    const chrome = opts.chrome;
    if (!chrome || !chrome.storage || !chrome.storage.local) return;
    const stored = await chrome.storage.local.get('shopscout_data');
    const blob = stored.shopscout_data;
    if (!blob || !blob.lists) return;
    for (const name of Object.keys(blob.lists)) {
      const products = blob.lists[name];
      if (!Array.isArray(products)) continue;
      const index = products.findIndex(product =>
        product.id === opts.productId || product.url === opts.productUrl
      );
      if (index >= 0) {
        products[index] = Object.assign({}, products[index], { userRating: opts.value });
      }
    }
    await chrome.storage.local.set({ shopscout_data: blob });
  }

  Object.assign(NS, { normalizeRating, writeRating, mirrorLegacyStorage });
})(globalThis);
