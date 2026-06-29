/* =============================================================
   ShopScoutUI.confirm — themed confirm() replacement
   Returns a Promise<boolean>. true = user confirmed; false =
   user cancelled (Escape, overlay click, Cancel button).
   Drop-in replacement:
     const ok = await ShopScoutUI.confirm('Delete this list?');
     if (ok) { … }
   ============================================================= */
(function initShopScoutUIConfirm(root) {
  const NS = (root.ShopScoutUI = root.ShopScoutUI || {});

  /**
   * @param {string} message Plain text question.
   * @param {{title?:string, okLabel?:string, cancelLabel?:string, kind?:'danger'|'primary'}} [opts]
   * @returns {Promise<boolean>}
   */
  function confirm(message, opts) {
    const o = opts || {};
    /* Lazy-resolve siblings so file load order doesn't matter. */
    const dom = NS.dom;
    if (!dom || !NS.modal) {
      throw new Error('ShopScoutUI.confirm requires ShopScoutUI.dom and .modal to be loaded.');
    }
    return new Promise(resolve => {
      const body = dom.elem('div', {
        class: 'ssui-confirm-body',
        text: String(message == null ? '' : message)
      });
      NS.modal.open({
        title: o.title || 'Are you sure?',
        body,
        actions: [
          { label: o.cancelLabel || 'Cancel', value: false },
          { label: o.okLabel || 'Confirm', value: true, isDefault: true,
            kind: o.kind === 'danger' ? 'danger' : 'primary' }
        ],
        onClose: (value) => resolve(value === true)
      });
    });
  }

  NS.confirm = confirm;
})(globalThis);
