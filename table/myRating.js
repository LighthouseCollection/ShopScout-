(function initShopScoutMyRating(root) {
  const NS = (root.ShopScoutTable = root.ShopScoutTable || {});
  const utils = NS.utils || {};
  const escapeHtml = utils.escapeHtml || (value => String(value == null ? '' : value));

  function normalizeRating(value) {
    const number = Number(value || 0);
    if (!isFinite(number)) return 0;
    return Math.max(0, Math.min(5, Math.floor(number)));
  }

  function render(currentValue, productId, productUrl, options) {
    const opts = options || {};
    const value = normalizeRating(currentValue);
    let html = '<span class="db-myrating" ';
    if (opts.role) html += 'role="radiogroup" aria-label="My rating" ';
    html += 'data-myrating-widget '
      + 'data-current="' + value + '" '
      + 'data-product-id="' + escapeHtml(productId || '') + '" '
      + 'data-product-url="' + escapeHtml(productUrl || '') + '">';
    for (let i = 5; i >= 1; i--) {
      const cls = i <= value ? 'db-myrating-on' : 'db-myrating-off';
      html += '<span class="' + cls + '" data-myrating="' + i + '" title="' + i + ' star' + (i > 1 ? 's' : '') + '">&#9733;</span>';
    }
    return html + '</span>';
  }

  function applyWidgetValue(widget, value) {
    if (!widget) return;
    const rating = normalizeRating(value);
    widget.dataset.current = String(rating);
    widget.querySelectorAll('[data-myrating]').forEach(star => {
      const starValue = parseInt(star.dataset.myrating, 10);
      star.classList.toggle('db-myrating-on', starValue <= rating);
      star.classList.toggle('db-myrating-off', starValue > rating);
    });
  }

  async function writeRating(options) {
    const opts = options || {};
    const repo = opts.repo;
    const productId = opts.productId || '';
    if (!repo || !productId || typeof repo.getProduct !== 'function' || typeof repo.updateProduct !== 'function') {
      return { ok: false, reason: 'repo-unavailable' };
    }
    const fresh = await repo.getProduct(productId);
    if (!fresh) return { ok: false, reason: 'missing-product' };
    const result = await repo.updateProduct(productId, { userRating: normalizeRating(opts.value) }, {
      listId: fresh.listId,
      baseRevision: fresh._revision,
      source: 'myrating-edit'
    });
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
      const index = products.findIndex(product => product.id === opts.productId || product.url === opts.productUrl);
      if (index >= 0) products[index] = Object.assign({}, products[index], { userRating: opts.value });
    }
    await chrome.storage.local.set({ shopscout_data: blob });
  }

  function createDelegation(options) {
    const opts = options || {};
    const doc = opts.document || root.document;
    const repo = opts.repo;
    const setStatus = opts.setStatus || (() => {});
    const getChrome = opts.getChrome || (() => root.browser || root.chrome);
    let bound = false;

    async function onClick(event) {
      const star = event.target && event.target.closest && event.target.closest('[data-myrating]');
      if (!star) return;
      const widget = star.closest('[data-myrating-widget]');
      if (!widget) return;
      event.stopPropagation();
      const next = parseInt(star.dataset.myrating, 10);
      const current = Number(widget.dataset.current || 0);
      const value = next === current ? 0 : next;
      applyWidgetValue(widget, value);
      const productId = widget.dataset.productId || '';
      const productUrl = widget.dataset.productUrl || '';
      try {
        const result = await writeRating({ repo, productId, value });
        if (result && result.ok === false) {
          const currentProduct = result.product || result.currentProduct || {};
          applyWidgetValue(widget, currentProduct.userRating || 0);
          setStatus('Rating not saved: this product changed elsewhere.');
          return;
        }
      } catch (err) {
        console.warn('myrating updateProduct failed', err);
        return;
      }
      try {
        await mirrorLegacyStorage({ chrome: getChrome(), productId, productUrl, value });
      } catch (err) {
        console.warn('myrating storage mirror failed', err);
      }
    }

    function bind() {
      if (bound || !doc || !doc.addEventListener) return;
      bound = true;
      doc.addEventListener('click', onClick);
    }

    return { bind, onClick };
  }

  NS.myRating = {
    render,
    applyWidgetValue,
    writeRating,
    mirrorLegacyStorage,
    createDelegation
  };
})(globalThis);
