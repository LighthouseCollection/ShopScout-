/* =============================================================
   ShopScoutUI.render — safe HTML composition
   Provides a tagged template `html` that auto-escapes every
   interpolation. The only way to insert pre-trusted HTML is to
   wrap a value in `raw(value)` so the unsafe surface is grep-able.

   Usage:
     const { html, raw, escapeHtml, escapeAttr } = ShopScoutUI.render;
     const safe = html`<div title="${userValue}">${userName}</div>`;
     // userValue and userName both escaped.

     const safeWithLink = html`<div>${raw(someTrustedHtml)}</div>`;
     // someTrustedHtml inserted verbatim (caller asserts it's safe).
   ============================================================= */
(function initShopScoutUIRender(root) {
  const NS = (root.ShopScoutUI = root.ShopScoutUI || {});

  /* Escape a value for safe insertion into element text content.
     Handles &, <, >, ", ' so the result is safe in attribute values
     too. Coerces non-string input to its string form first. */
  function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* Alias — same escaping is correct for attribute values too. */
  function escapeAttr(value) {
    return escapeHtml(value);
  }

  /* Wrapper that marks a string as pre-trusted. The tagged template
     below skips escaping for these. Use sparingly and only with
     content that's already been through escape (e.g. nested html``
     calls). */
  function raw(value) {
    return new TrustedHtml(value == null ? '' : String(value));
  }

  function TrustedHtml(value) {
    this.value = value;
  }
  TrustedHtml.prototype.toString = function() { return this.value; };

  function isTrusted(value) {
    return value instanceof TrustedHtml;
  }

  /* Tagged template. Every interpolation is escaped unless it's a
     TrustedHtml instance. Arrays are flattened. The output is itself
     a TrustedHtml so it can be safely nested in other `html` calls. */
  function html(strings, ...values) {
    const parts = [];
    for (let i = 0; i < strings.length; i++) {
      parts.push(strings[i]);
      if (i < values.length) parts.push(formatValue(values[i]));
    }
    return new TrustedHtml(parts.join(''));
  }

  function formatValue(value) {
    if (value == null || value === false) return '';
    if (isTrusted(value)) return value.value;
    if (Array.isArray(value)) {
      return value.map(formatValue).join('');
    }
    return escapeHtml(value);
  }

  /* Render a tagged-template result into a target element. Goes
     through ShopScoutUI.dom.setHtml so there is exactly ONE
     grep-able innerHTML sink in this module. If dom.setHtml is not
     available (load-order misuse) we throw — never silently fall
     back to target.innerHTML, which would defeat the contract. */
  function renderInto(target, trustedHtml) {
    if (!target) return;
    const dom = NS.dom;
    if (!dom || typeof dom.setHtml !== 'function') {
      throw new Error('ShopScoutUI.render.renderInto requires ShopScoutUI.dom.setHtml to be loaded.');
    }
    const value = isTrusted(trustedHtml) ? trustedHtml.value : String(trustedHtml || '');
    dom.setHtml(target, value);
  }

  NS.render = {
    html, raw, escapeHtml, escapeAttr, isTrusted, renderInto, TrustedHtml
  };
})(globalThis);
