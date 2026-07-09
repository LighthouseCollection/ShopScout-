/* =============================================================
   ShopScout — Office 365 ribbon SVG icon library (Path B commit 10)

   Two variants per icon:
     sm — 16×16 viewBox, simplified paths, thicker strokes for
          legibility. Serves the Windows Ribbon Framework "small"
          image slot at 96/120/144/192 DPI (renders at 16/20/24/32px
          natively; browser scales via CSS).
     lg — 24×24 viewBox, richer detail, 2px stroke. Serves the
          "large" image slot at 96/120/144/192 DPI (renders at
          32/40/48/64px).

   The Windows Ribbon Framework mandates exact icon-pixel sizes per
   DPI (16/20/24/32 small, 32/40/48/64 large). Because SVG is
   resolution-independent, a single small-variant SVG covers all
   four small DPI targets and a single large-variant covers all
   four large targets. Two authored variants total, not eight —
   the differentiation is between "small-context simplification"
   and "large-context detail", not per-DPI.

   All strokes use `currentColor` so icons inherit the theme's
   text color (works in light + dark + high-contrast). Fills are
   `none` unless a solid shape is intentional.

   API:
     ShopScoutRibbon.icons.get(name, size)      // 'sm' | 'lg'; returns SVG string
     ShopScoutRibbon.icons.getElement(name, size)  // returns DOM SVGElement
     ShopScoutRibbon.icons.list()                // array of registered names
     ShopScoutRibbon.icons.register(name, { sm, lg })  // add a custom icon
     ShopScoutRibbon.icons.has(name)             // boolean

   Icons defined here cover every ribbon action in the merged
   Products tab (commit 1 HTML). Commit 11's HTML migration will
   reference them via ShopScoutRibbon.icons.get(...) instead of
   inlined <svg> blocks.
   ============================================================= */
(function initShopScoutRibbonIcons(root) {
  const NS = (root.ShopScoutRibbon = root.ShopScoutRibbon || {});
  const doc = root.document;

  const icons = new Map();

  /* Shared SVG attributes — kept constant across variants for a
     consistent visual signature (Fluent-style outlined icons). */
  function svg(viewBox, path) {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" `
      + `fill="none" stroke="currentColor" stroke-width="1.6" `
      + `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
      + path
      + '</svg>'
    );
  }

  function sm(path)  { return svg('0 0 16 16', path); }
  function lg(path)  { return svg('0 0 24 24', path); }
  /* Small variants use a slightly thicker stroke — rewritten inline
     since the wrapper defaults to 1.6px. */
  function smThick(path) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" '
      + 'fill="none" stroke="currentColor" stroke-width="2" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + path
      + '</svg>'
    );
  }

  /* ==============================================================
     LIST GROUP
     ============================================================== */

  /* new-list — a "+" plus sign */
  register('new-list', {
    sm: smThick('<path d="M8 3v10M3 8h10"/>'),
    lg: lg('<path d="M12 5v14M5 12h14"/>')
  });

  /* rename — pencil / edit */
  register('rename', {
    sm: smThick('<path d="M8 13h5"/><path d="M10.5 2.5a1.4 1.4 0 0 1 2 2L5 12l-2.5.5.5-2.5Z"/>'),
    lg: lg('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>')
  });

  /* delete-list — X close */
  register('delete-list', {
    sm: smThick('<path d="M12 4 4 12M4 4l8 8"/>'),
    lg: lg('<path d="M18 6 6 18M6 6l12 12"/>')
  });

  /* ==============================================================
     PRODUCT ACTIONS
     ============================================================== */

  /* add-product — shopping bag with download arrow */
  register('add-product', {
    sm: sm('<path d="M4 6 3 5v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5l-1 1"/>'
      + '<path d="M10 4a2 2 0 0 1-4 0"/>'
      + '<path d="M8 8v3"/><path d="M6.5 9.5 8 11l1.5-1.5"/>'),
    lg: lg('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>'
      + '<path d="M3 6h18"/>'
      + '<path d="M16 10a4 4 0 0 1-8 0"/>'
      + '<path d="M12 13v6"/><path d="M9 16h6"/>')
  });

  /* rescan — circular refresh */
  register('rescan', {
    sm: sm('<path d="M2.5 8a5.5 5.5 0 0 1 9-4L13 5.5"/><path d="M13 2v3.5H9.5"/>'
      + '<path d="M13.5 8a5.5 5.5 0 0 1-9 4L3 10.5"/><path d="M3 14v-3.5h3.5"/>'),
    lg: lg('<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/>'
      + '<path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>')
  });

  /* delete-item — trash can */
  register('delete-item', {
    sm: sm('<path d="M2.5 4h11"/><path d="M12 4v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4"/>'
      + '<path d="M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1"/>'),
    lg: lg('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>'
      + '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>')
  });

  /* ==============================================================
     REVIEW & RULES
     ============================================================== */

  /* duplicates — 2 overlapping rectangles */
  register('duplicates', {
    sm: sm('<rect x="2" y="3" width="6" height="6" rx="1"/>'
      + '<rect x="8" y="7" width="6" height="6" rx="1"/>'),
    lg: lg('<rect x="3" y="4" width="8" height="8" rx="1.5"/>'
      + '<rect x="13" y="12" width="8" height="8" rx="1.5"/>'
      + '<path d="M11 8h3a4 4 0 0 1 4 4"/><path d="M13 16h-3a4 4 0 0 1-4-4"/>')
  });

  /* normalize-review — checklist with a checkmark */
  register('normalize-review', {
    sm: sm('<rect x="2.5" y="2.5" width="11" height="11" rx="1"/>'
      + '<path d="M5 5.5h4M5 8h3M5 10.5h4"/>'
      + '<path d="m10 8 1 1 2-2"/>'),
    lg: lg('<path d="M4 4h16v16H4Z"/>'
      + '<path d="M8 8h8"/><path d="M8 12h5"/><path d="M8 16h8"/>'
      + '<path d="m15 11 2 2 4-4"/>')
  });

  /* vertical-packs — 2x2 grid */
  register('vertical-packs', {
    sm: sm('<rect x="2.5" y="2.5" width="4" height="4" rx="0.5"/>'
      + '<rect x="9" y="2.5" width="4" height="4" rx="0.5"/>'
      + '<rect x="2.5" y="9" width="4" height="4" rx="0.5"/>'
      + '<rect x="9" y="9" width="4" height="4" rx="0.5"/>'),
    lg: lg('<path d="M4 4h7v7H4Z"/><path d="M13 4h7v7h-7Z"/>'
      + '<path d="M4 13h7v7H4Z"/><path d="M13 13h7v7h-7Z"/>')
  });

  /* user-rules — list with rule arrow */
  register('user-rules', {
    sm: sm('<path d="M2.5 4.5h11"/><path d="M2.5 8h7"/><path d="M2.5 11.5h5"/>'
      + '<path d="m11 9.5 2 2-2 2"/><path d="M9 11.5h4"/>'),
    lg: lg('<path d="M4 7h16"/><path d="M4 12h10"/><path d="M4 17h7"/>'
      + '<path d="M17 14l3 3-3 3"/><path d="M14 17h6"/>')
  });

  /* ==============================================================
     VIEW GROUP
     ============================================================== */

  /* mode-rows — 3 horizontal rows */
  register('mode-rows', {
    sm: sm('<rect x="2" y="3" width="12" height="2.4" rx="0.5"/>'
      + '<rect x="2" y="6.8" width="12" height="2.4" rx="0.5"/>'
      + '<rect x="2" y="10.6" width="12" height="2.4" rx="0.5"/>'),
    lg: lg('<rect x="3" y="4" width="18" height="4" rx="1"/>'
      + '<rect x="3" y="10" width="18" height="4" rx="1"/>'
      + '<rect x="3" y="16" width="18" height="4" rx="1"/>')
  });

  /* mode-matrix — 2 vertical columns with cross ties */
  register('mode-matrix', {
    sm: sm('<rect x="2" y="3" width="4.5" height="10" rx="0.5"/>'
      + '<rect x="9.5" y="3" width="4.5" height="10" rx="0.5"/>'
      + '<path d="M6.5 6h3M6.5 10h3"/>'),
    lg: lg('<rect x="3" y="4" width="7" height="16" rx="1"/>'
      + '<rect x="14" y="4" width="7" height="16" rx="1"/>'
      + '<path d="M10 8h4M10 16h4"/>')
  });

  /* columns — 3 vertical bars */
  register('columns', {
    sm: sm('<rect x="2.5" y="2.5" width="2.5" height="11"/>'
      + '<rect x="6.75" y="2.5" width="2.5" height="11"/>'
      + '<rect x="11" y="2.5" width="2.5" height="11"/>'),
    lg: lg('<rect x="4" y="4" width="4" height="16"/>'
      + '<rect x="10" y="4" width="4" height="16"/>'
      + '<rect x="16" y="4" width="4" height="16"/>')
  });

  /* ==============================================================
     ORGANIZE GROUP
     ============================================================== */

  /* sort-asc — ↑ up arrow with ascending bars */
  register('sort-asc', {
    sm: sm('<path d="M4 12V4"/><path d="m1.5 6.5 2.5-2.5 2.5 2.5"/>'
      + '<path d="M9 5h4M9 8h5M9 11h6"/>'),
    lg: lg('<path d="M6 20V4"/><path d="m2 8 4-4 4 4"/>'
      + '<path d="M13 6h3M13 10h5M13 14h7M13 18h9"/>')
  });

  /* sort-desc — ↓ down arrow with descending bars */
  register('sort-desc', {
    sm: sm('<path d="M4 4v8"/><path d="m1.5 9.5 2.5 2.5 2.5-2.5"/>'
      + '<path d="M9 5h6M9 8h5M9 11h4"/>'),
    lg: lg('<path d="M6 4v16"/><path d="m2 16 4 4 4-4"/>'
      + '<path d="M13 6h9M13 10h7M13 14h5M13 18h3"/>')
  });

  /* filter — funnel */
  register('filter', {
    sm: sm('<path d="M2 3.5h12l-4.5 5v4l-3-1.5V8.5Z"/>'),
    lg: lg('<path d="M3 5h18"/><path d="M6 12h12"/><path d="M10 19h4"/>')
  });

  /* group-by — nested rectangles for grouping */
  register('group-by', {
    sm: sm('<rect x="2.5" y="2.5" width="11" height="4" rx="0.5"/>'
      + '<rect x="4" y="9" width="8" height="4" rx="0.5"/>'),
    lg: lg('<rect x="3" y="4" width="18" height="6" rx="1"/>'
      + '<rect x="6" y="14" width="12" height="6" rx="1"/>')
  });

  /* reset — circular reset arrow (return to start) */
  register('reset', {
    sm: sm('<path d="M2 8a6 6 0 1 0 2-4.5"/><path d="M2 2v3.5h3.5"/>'),
    lg: lg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>')
  });

  /* ==============================================================
     Registration + lookup helpers
     ============================================================== */
  function register(name, spec) {
    if (!name || typeof name !== 'string') {
      console.warn('[Ribbon.icons] register requires a name string');
      return null;
    }
    if (!spec || typeof spec !== 'object' || !spec.sm || !spec.lg) {
      console.warn(`[Ribbon.icons] "${name}" requires both sm and lg variants`);
      return null;
    }
    icons.set(name, {
      sm: String(spec.sm),
      lg: String(spec.lg)
    });
    return icons.get(name);
  }

  function has(name) { return icons.has(name); }

  function get(name, size) {
    const icon = icons.get(name);
    if (!icon) {
      console.warn(`[Ribbon.icons] Unknown icon "${name}". Known: ${list().join(', ')}`);
      return '';
    }
    const s = size === 'sm' || size === 'small' ? 'sm' : 'lg';
    return icon[s];
  }

  function getElement(name, size) {
    if (!doc) return null;
    const source = get(name, size);
    if (!source) return null;
    const tpl = doc.createElement('template');
    tpl.innerHTML = source.trim();
    return tpl.content.firstElementChild;
  }

  function list() {
    return Array.from(icons.keys());
  }

  NS.icons = {
    register,
    get,
    getElement,
    has,
    list,
    /* Read-only snapshot of the registry (useful in tests / dev tools) */
    all() {
      const out = {};
      for (const [name, spec] of icons) out[name] = { sm: spec.sm, lg: spec.lg };
      return out;
    },
    version: '1.0.0-commit-10'
  };
})(globalThis);
