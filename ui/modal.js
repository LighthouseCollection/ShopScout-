/* =============================================================
   ShopScoutUI.modal — base themed modal primitive
   Opens a centered overlay + dialog. Manages focus trap, Escape
   handler, and overlay click. Returned handle has a close()
   method. The confirm/prompt dialogs build on this.
   ============================================================= */
(function initShopScoutUIModal(root) {
  const NS = (root.ShopScoutUI = root.ShopScoutUI || {});

  /* Lazy resolvers so files can load in any order. Capturing NS.dom
     at module-eval time would freeze it to whatever was registered
     then — typically undefined. */
  function getDom()    { return NS.dom; }
  function getEvents() { return NS.events; }
  function getRender() { return NS.render; }

  /* A stack of open modals so Escape closes only the top one. */
  const openStack = [];

  /**
   * Open a modal.
   * opts:
   *   title       — string (escaped)
   *   body        — string | Node | TrustedHtml | function(api) => Node
   *   actions     — array of {label, kind?, value?, isDefault?, onClick?}
   *   closeOnOverlayClick — default true
   *   closeOnEscape — default true
   *   width       — CSS string, e.g. '420px' (default 'min(420px, 92vw)')
   *   onClose     — fn called with the result value when modal closes
   * Returns {close(value), root, api: {setBody, setActions}}
   */
  function open(opts) {
    const o = opts || {};
    /* Resolve siblings on every call so load order doesn't matter. */
    const dom = getDom();
    const events = getEvents();
    const render = getRender();
    if (!dom || !events || !render) {
      throw new Error('ShopScoutUI.modal requires ShopScoutUI.dom, .events, .render to be loaded.');
    }

    const overlay = dom.elem('div', { class: 'ssui-modal-overlay' });
    const dialog  = dom.elem('div', {
      class: 'ssui-modal',
      attrs: {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'ssui-modal-title-' + uid(),
        tabindex: '-1'
      }
    });
    if (o.className) {
      String(o.className).split(/\s+/).filter(Boolean).forEach(name => dialog.classList.add(name));
    }
    if (o.width) dialog.style.width = o.width;

    const titleEl = dom.elem('div', { class: 'ssui-modal-title' });
    const titleText = dom.elem('span', { class: 'ssui-modal-title-text', text: o.title || '' });
    if (dialog.getAttribute('aria-labelledby')) titleText.id = dialog.getAttribute('aria-labelledby');
    const closeButton = dom.elem('button', {
      class: 'ssui-modal-close',
      text: '×',
      attrs: { type: 'button', 'aria-label': 'Close dialog' },
      on: { click: () => closeWith(undefined) }
    });
    dom.mount(titleEl, titleText);
    dom.mount(titleEl, closeButton);
    const bodyEl   = dom.elem('div', { class: 'ssui-modal-body' });
    const footerEl = dom.elem('div', { class: 'ssui-modal-footer' });

    dom.mount(dialog, titleEl);
    dom.mount(dialog, bodyEl);
    dom.mount(dialog, footerEl);
    dom.mount(overlay, dialog);
    dom.mount(document.body, overlay);

    /* Track who had focus before so we can restore on close. */
    const previouslyFocused = document.activeElement;

    let closed = false;
    let releaseFocus = () => {};
    let releaseEsc = () => {};
    let releaseOverlay = () => {};

    const handle = {
      root: overlay,
      close: closeWith,
      api: { setBody, setActions }
    };

    function closeWith(value) {
      if (closed) return;
      closed = true;
      releaseFocus(); releaseEsc(); releaseOverlay();
      overlay.classList.add('is-closing');
      /* Brief animation window; if no CSS animation hooks in, this
         still removes the node within one frame. */
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        const idx = openStack.indexOf(handle);
        if (idx >= 0) openStack.splice(idx, 1);
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
          try { previouslyFocused.focus(); } catch { /* ignore */ }
        }
        if (typeof o.onClose === 'function') o.onClose(value);
      }, 120);
    }

    function setBody(content) {
      dom.empty(bodyEl);
      if (content == null) return;
      if (typeof content === 'function') {
        const produced = content(handle.api);
        if (produced) dom.append(bodyEl, produced);
      } else if (render.isTrusted(content)) {
        dom.setHtml(bodyEl, content.value);
      } else if (typeof content === 'string') {
        bodyEl.textContent = content;
      } else if (content && typeof content === 'object' && typeof content.nodeType === 'number') {
        /* Duck-type instead of `instanceof Node` so jsdom and vm
           stubs work the same as the real DOM. */
        dom.append(bodyEl, content);
      }
    }

    function setActions(actions) {
      dom.empty(footerEl);
      if (!Array.isArray(actions) || !actions.length) return;
      let defaultButton = null;
      for (const a of actions) {
        const btn = dom.elem('button', {
          class: ['ssui-btn', a.kind ? 'ssui-btn--' + a.kind : null].filter(Boolean),
          text: a.label || '',
          attrs: { type: 'button' },
          on: {
            click: (e) => {
              if (typeof a.onClick === 'function') {
                const stop = a.onClick(e, handle);
                if (stop === false) return;
              }
              closeWith(a.value);
            }
          }
        });
        if (a.isDefault) defaultButton = btn;
        dom.mount(footerEl, btn);
      }
      /* Focus the default action so Enter resolves it. */
      if (defaultButton) requestAnimationFrame(() => defaultButton.focus());
    }

    /* Initial body + actions */
    setBody(o.body);
    setActions(o.actions);

    /* Focus trap (within the dialog). */
    releaseFocus = events.trapFocus(dialog);

    /* Escape closes the TOP modal only. */
    if (o.closeOnEscape !== false) {
      releaseEsc = events.onEscape(() => {
        if (openStack[openStack.length - 1] === handle) closeWith(undefined);
      });
    }

    /* Click outside the dialog closes. */
    if (o.closeOnOverlayClick !== false) {
      releaseOverlay = events.on(overlay, 'mousedown', (e) => {
        if (e.target === overlay) closeWith(undefined);
      });
    }

    openStack.push(handle);
    /* Focus the dialog so Tab cycling has somewhere to start. */
    requestAnimationFrame(() => {
      const firstFocusable = dialog.querySelector(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      (firstFocusable || dialog).focus();
    });

    return handle;
  }

  function uid() {
    /* Lightweight unique id for aria-labelledby. */
    uid._n = (uid._n || 0) + 1;
    return uid._n;
  }

  NS.modal = { open };
})(globalThis);
