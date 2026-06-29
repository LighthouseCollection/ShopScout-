/* =============================================================
   ShopScout — DOM utilities shared across extraction stages
   ============================================================= */
(function initDomUtils(root) {
  const NS = (root.SSExtract = root.SSExtract || {});

  function trimText(s) {
    if (s == null) return '';
    return String(s).replace(/\s+/g, ' ').trim();
  }

  function textOf(el) {
    if (!el) return '';
    return trimText(el.textContent || '');
  }

  function attrOf(el, name) {
    if (!el || !name) return '';
    const v = el.getAttribute(name);
    return v == null ? '' : trimText(v);
  }

  function pickText(selectors, root) {
    const scope = root || document;
    for (const sel of selectors) {
      const el = scope.querySelector(sel);
      if (el) {
        const t = textOf(el);
        if (t) return t;
      }
    }
    return '';
  }

  function pickAttr(selectors, attr, root) {
    const scope = root || document;
    for (const sel of selectors) {
      const el = scope.querySelector(sel);
      if (el) {
        const v = attrOf(el, attr);
        if (v) return v;
      }
    }
    return '';
  }

  function nodePath(el, maxLen) {
    if (!el || !el.tagName) return null;
    const max = maxLen || 80;
    const parts = [];
    let cursor = el;
    while (cursor && cursor.tagName && parts.length < 5) {
      const tag = cursor.tagName.toLowerCase();
      const id  = cursor.id ? '#' + cursor.id : '';
      const cls = cursor.className && typeof cursor.className === 'string'
        ? '.' + cursor.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
      parts.unshift(tag + id + cls);
      cursor = cursor.parentElement;
    }
    const out = parts.join(' > ');
    return out.length > max ? out.slice(0, max) + '…' : out;
  }

  /* Bot-aware wait: many marketplaces lazy-render the spec block after
     first paint. We watch for either:
       a) any of the candidate selectors to appear, OR
       b) the DOM to stop mutating for `quietMs` (default 250 ms), OR
       c) a hard ceiling `maxMs` (default 1500 ms).
     The waits use natural intervals — no mouse moves, no scrolls, no
     synthesized events. We're a user-initiated click, so this looks like
     a person waiting for their own page to render. */
  function waitForReady(candidateSelectors, options) {
    const opts = options || {};
    const maxMs   = opts.maxMs   != null ? opts.maxMs   : 1500;
    const quietMs = opts.quietMs != null ? opts.quietMs : 250;

    const hit = () => {
      for (const sel of (candidateSelectors || [])) {
        try { if (document.querySelector(sel)) return true; }
        catch { /* invalid selector — skip */ }
      }
      return false;
    };

    if (hit()) return Promise.resolve('selector');

    return new Promise(resolve => {
      let settled = false;
      let quietTimer = null;
      const finish = (reason) => {
        if (settled) return;
        settled = true;
        try { observer.disconnect(); } catch {}
        clearTimeout(quietTimer);
        clearTimeout(hardTimer);
        resolve(reason);
      };

      const armQuiet = () => {
        clearTimeout(quietTimer);
        quietTimer = setTimeout(() => finish('quiet'), quietMs);
      };

      const observer = new MutationObserver(() => {
        if (hit()) finish('selector');
        else armQuiet();
      });
      observer.observe(document.documentElement || document.body, {
        childList: true, subtree: true, attributes: false, characterData: false
      });

      armQuiet();
      const hardTimer = setTimeout(() => finish('timeout'), maxMs);
    });
  }

  /* Parse all JSON-LD blocks on the page. Returns an array of plain objects
     (handles `@graph` and array-typed scripts). */
  function readJsonLdBlocks() {
    const out = [];
    for (const tag of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(tag.textContent || '');
        const items = Array.isArray(parsed) ? parsed
          : (parsed && Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed]);
        for (const item of items) {
          if (item && typeof item === 'object') out.push(item);
        }
      } catch { /* malformed, skip */ }
    }
    return out;
  }

  function isProductLdNode(node) {
    if (!node || typeof node !== 'object') return false;
    const t = node['@type'];
    if (t === 'Product') return true;
    if (Array.isArray(t) && t.includes('Product')) return true;
    return false;
  }

  function findProductLd() {
    for (const n of readJsonLdBlocks()) if (isProductLdNode(n)) return n;
    return null;
  }

  NS.dom = {
    trimText, textOf, attrOf, pickText, pickAttr, nodePath,
    waitForReady, readJsonLdBlocks, findProductLd
  };
})(globalThis);
