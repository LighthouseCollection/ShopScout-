/* =============================================================
   ShopScoutUI.dom — safe DOM construction primitives
   No innerHTML. Every element is built via createElement,
   text is set via textContent, attributes via setAttribute.
   The only intentional escape hatch is `setHtml` which takes a
   pre-trusted string (e.g. from ShopScoutUI.render.html`...`) so
   grep finds the unsafe surface immediately.
   ============================================================= */
(function initShopScoutUIDom(root) {
  const NS = (root.ShopScoutUI = root.ShopScoutUI || {});

  /**
   * Create an element. Tag may be 'div', 'svg:path', etc.
   * Options:
   *   class  — string or array of class names
   *   text   — textContent (safely set)
   *   attrs  — object of attributes (string values set via setAttribute)
   *   on     — object of event handlers (e.g. {click: fn})
   *   children — array of nodes/strings; strings become text nodes
   */
  function elem(tag, options) {
    const o = options || {};
    const isSvg = tag.startsWith('svg:');
    const realTag = isSvg ? tag.slice(4) : tag;
    const el = isSvg
      ? document.createElementNS('http://www.w3.org/2000/svg', realTag)
      : document.createElement(realTag);
    if (o.class) addClass(el, o.class);
    if (o.id) el.id = String(o.id);
    if (o.text != null) el.textContent = String(o.text);
    if (o.attrs) {
      for (const [k, v] of Object.entries(o.attrs)) {
        if (v == null || v === false) continue;
        if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, String(v));
      }
    }
    if (o.on) {
      for (const [type, handler] of Object.entries(o.on)) {
        if (typeof handler === 'function') el.addEventListener(type, handler);
      }
    }
    if (Array.isArray(o.children)) {
      for (const child of o.children) append(el, child);
    }
    return el;
  }

  /** Append a child. Strings become text nodes. Arrays are flattened. */
  function append(parent, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) {
      for (const c of child) append(parent, c);
      return;
    }
    if (typeof child === 'string' || typeof child === 'number') {
      parent.appendChild(document.createTextNode(String(child)));
      return;
    }
    /* Duck-type instead of `instanceof Node`. Works for real DOM
       nodes, DocumentFragment, jsdom, and our test stubs. Anything
       with a numeric nodeType qualifies. */
    if (child && typeof child === 'object' && typeof child.nodeType === 'number') {
      parent.appendChild(child);
    }
  }

  function addClass(el, name) {
    if (Array.isArray(name)) name.forEach(n => el.classList.add(n));
    else if (typeof name === 'string') {
      for (const n of name.split(/\s+/)) if (n) el.classList.add(n);
    }
  }

  function removeClass(el, name) {
    if (Array.isArray(name)) name.forEach(n => el.classList.remove(n));
    else if (typeof name === 'string') {
      for (const n of name.split(/\s+/)) if (n) el.classList.remove(n);
    }
  }

  function toggleClass(el, name, force) {
    return el.classList.toggle(name, force);
  }

  /** Empty an element's children safely (no innerHTML='' to avoid the
      common pattern of using it as a clear). */
  function empty(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  /** Replace an element's children with a new set. */
  function replace(el, children) {
    empty(el);
    if (children == null) return;
    if (Array.isArray(children)) {
      for (const c of children) append(el, c);
    } else {
      append(el, children);
    }
  }

  /** Set inner HTML from a pre-trusted source. This is the ONE place
      where unsafe HTML enters the DOM via this module, so grep for
      `setHtml` to audit. Callers should only pass values from
      ShopScoutUI.render.html`...` (which escapes interpolations). */
  function setHtml(el, trustedHtml) {
    el.innerHTML = trustedHtml == null ? '' : String(trustedHtml);
  }

  /** Mount a built element into the DOM. Equivalent to parent.appendChild
      but reads more naturally in build code. Returns the child for chaining. */
  function mount(parent, child) {
    if (!parent || !child) return child;
    parent.appendChild(child);
    return child;
  }

  /** Find one descendant by selector. Convenience over scope.querySelector. */
  function find(scope, selector) {
    if (!scope) return null;
    if (typeof scope === 'string') { selector = scope; scope = document; }
    return scope.querySelector(selector);
  }

  /** Find all descendants by selector. Returns a real array. */
  function findAll(scope, selector) {
    if (!scope) return [];
    if (typeof scope === 'string') { selector = scope; scope = document; }
    return Array.from(scope.querySelectorAll(selector));
  }

  NS.dom = {
    elem, append, addClass, removeClass, toggleClass,
    empty, replace, setHtml, mount, find, findAll
  };
})(globalThis);
