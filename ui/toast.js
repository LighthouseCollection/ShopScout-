/* =============================================================
   ShopScoutUI.toast — themed transient notification
   Replaces ad-hoc toast strings scattered through the codebase
   and the legacy SS.toast in utils.js. Multiple toasts stack
   vertically in a shared container; each disappears after its
   own duration or on click.
   ============================================================= */
(function initShopScoutUIToast(root) {
  const NS = (root.ShopScoutUI = root.ShopScoutUI || {});

  /* Lazy resolver — load order between dom.js and toast.js no longer
     matters because we never capture NS.dom at file-eval time. */
  function getDom() { return NS.dom; }

  const DEFAULT_DURATION = 3000;
  const CONTAINER_ID = 'ssui-toast-container';

  function getContainer() {
    const dom = getDom();
    if (!dom) throw new Error('ShopScoutUI.toast requires ShopScoutUI.dom to be loaded.');
    let host = document.getElementById(CONTAINER_ID);
    if (host) return host;
    host = dom.elem('div', {
      id: CONTAINER_ID,
      class: 'ssui-toast-container',
      attrs: { 'aria-live': 'polite', 'aria-atomic': 'false' }
    });
    document.body.appendChild(host);
    return host;
  }

  /**
   * Show a toast.
   * @param {string} message Plain text. (Auto-escaped via textContent.)
   * @param {{type?:'info'|'success'|'error'|'warn'|'loading', duration?:number}} [opts]
   * @returns {{dismiss():void}} Handle for early dismissal.
   */
  function show(message, opts) {
    const o = opts || {};
    const type = o.type || 'info';
    const duration = type === 'loading'
      ? Infinity  /* loading toasts only go away on dismiss() */
      : (o.duration != null ? o.duration : DEFAULT_DURATION);

    const dom = getDom();
    if (!dom) throw new Error('ShopScoutUI.toast requires ShopScoutUI.dom to be loaded.');
    const el = dom.elem('div', {
      class: ['ssui-toast', 'ssui-toast--' + type],
      attrs: { role: 'status' },
      text: String(message == null ? '' : message)
    });
    const container = getContainer();
    container.appendChild(el);

    let timer = null;
    let dismissed = false;

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      if (timer) clearTimeout(timer);
      el.classList.add('is-closing');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 180);
    }

    /* Click the toast to dismiss early. */
    el.addEventListener('click', dismiss);

    /* Auto-dismiss unless duration is Infinity (loading). */
    if (isFinite(duration)) {
      timer = setTimeout(dismiss, duration);
    }

    return { dismiss };
  }

  /* Convenience methods that mirror common ad-hoc usage. */
  function info(message, opts)    { return show(message, Object.assign({}, opts, { type: 'info' })); }
  function success(message, opts) { return show(message, Object.assign({}, opts, { type: 'success' })); }
  function warn(message, opts)    { return show(message, Object.assign({}, opts, { type: 'warn' })); }
  function error(message, opts)   { return show(message, Object.assign({}, opts, { type: 'error' })); }
  function loading(message, opts) { return show(message, Object.assign({}, opts, { type: 'loading' })); }

  /* Hide all open toasts. Used by the legacy toast.hide() shim. */
  function clear() {
    const host = document.getElementById(CONTAINER_ID);
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
  }

  NS.toast = { show, info, success, warn, error, loading, clear };
})(globalThis);
