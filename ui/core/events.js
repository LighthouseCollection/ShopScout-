/* =============================================================
   ShopScoutUI.events — event helpers
   Thin sugar over addEventListener. All registration functions
   return a disposer so consumers don't need to track listener
   references just to remove them.
   ============================================================= */
(function initShopScoutUIEvents(root) {
  const NS = (root.ShopScoutUI = root.ShopScoutUI || {});

  /** Add a listener; returns a disposer. */
  function on(target, type, handler, options) {
    if (!target || typeof handler !== 'function') return () => {};
    target.addEventListener(type, handler, options);
    return () => target.removeEventListener(type, handler, options);
  }

  /** Delegated event helper. Listens on `root`, fires `handler` only
      when the original event target matches `selector`. The handler
      receives (event, matchedElement). Returns a disposer. */
  function delegate(rootEl, type, selector, handler, options) {
    if (!rootEl || typeof handler !== 'function') return () => {};
    function inner(event) {
      const matched = event.target && event.target.closest && event.target.closest(selector);
      if (!matched || !rootEl.contains(matched)) return;
      handler(event, matched);
    }
    rootEl.addEventListener(type, inner, options);
    return () => rootEl.removeEventListener(type, inner, options);
  }

  /** Register a one-shot Escape key listener at document level.
      Returns a disposer. Used by modal/dialog primitives to close on Escape. */
  function onEscape(handler) {
    function inner(event) {
      if (event.key === 'Escape' || event.keyCode === 27) handler(event);
    }
    document.addEventListener('keydown', inner);
    return () => document.removeEventListener('keydown', inner);
  }

  /** Trap focus inside `container`. Tab and Shift+Tab cycle between
      the first and last focusable descendants. Returns a disposer. */
  function trapFocus(container) {
    if (!container) return () => {};
    function focusables() {
      return Array.from(container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
    }
    function inner(event) {
      if (event.key !== 'Tab') return;
      const els = focusables();
      if (!els.length) return;
      const first = els[0];
      const last  = els[els.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    container.addEventListener('keydown', inner);
    return () => container.removeEventListener('keydown', inner);
  }

  NS.events = { on, delegate, onEscape, trapFocus };
})(globalThis);
