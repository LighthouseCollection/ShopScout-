/* ShopScout shared sanitization helpers.
   This module has no dependency on SS or ShopScoutUI so it can load in
   extension pages, content scripts, and isolated tests before either exists. */
(function initShopScoutSanitize(root) {
  const NS = (root.ShopScoutSanitize = root.ShopScoutSanitize || {});

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
  }

  function baseHref() {
    return (root.location && root.location.href) || 'https://shopscout.local/';
  }

  function sanitizeUrl(value, fallback = '') {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    try {
      const URLCtor = root.URL || URL;
      const url = new URLCtor(raw, baseHref());
      return ['http:', 'https:'].includes(url.protocol) ? url.href : fallback;
    } catch {
      return fallback;
    }
  }

  function isSafeHttpUrl(value) {
    return !!sanitizeUrl(value);
  }

  function sanitizeUrlList(values, maxItems = Infinity) {
    const out = [];
    for (const value of Array.isArray(values) ? values : []) {
      const safe = sanitizeUrl(value);
      if (safe) out.push(safe);
      if (out.length >= maxItems) break;
    }
    return out;
  }

  function textNode(doc, value) {
    if (doc && typeof doc.createTextNode === 'function') return doc.createTextNode(String(value ?? ''));
    return { nodeType: 3, textContent: String(value ?? '') };
  }

  function normalizeChild(doc, child) {
    if (child && typeof child === 'object' && typeof child.nodeType === 'number') return child;
    return textNode(doc, child);
  }

  function replaceChildren(target, children) {
    if (!target) return;
    const doc = (target.ownerDocument || root.document || {});
    const normalized = (Array.isArray(children) ? children : [children]).map(child => normalizeChild(doc, child));
    if (typeof target.replaceChildren === 'function') {
      target.replaceChildren(...normalized);
      return;
    }
    while (target.firstChild) target.removeChild(target.firstChild);
    for (const child of normalized) target.appendChild(child);
  }

  function setTrustedHtml(target, trustedHtml) {
    if (!target) return;
    target.innerHTML = trustedHtml == null ? '' : String(trustedHtml);
  }

  Object.assign(NS, {
    escapeHtml,
    escapeAttribute,
    sanitizeUrl,
    isSafeHttpUrl,
    sanitizeUrlList,
    replaceChildren,
    setTrustedHtml
  });
})(globalThis);
