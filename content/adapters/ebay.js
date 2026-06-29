/* =============================================================
   ShopScout — eBay adapter
   Targets the modern /itm/ Product Description Page. Selectors
   curated from the current eBay DOM (2024–2026 UX layout) plus
   the legacy IDs still served on some categories. eBay relies
   heavily on the ux-labels-values "Item specifics" grid; we walk
   it as the primary spec source.
   ============================================================= */
(function initEbayAdapter(root) {
  if (!root.SSExtract) return;
  const NS  = root.SSExtract;
  const obs = NS.observation;
  const C   = NS.Confidence;
  const dom = NS.dom;

  /* Item-specifics grid — the canonical spec source on modern eBay
     itm/ pages. Each row is a .ux-labels-values flex with a label cell
     and a value cell. */
  const ITEM_SPECIFICS_SELECTORS = [
    '.ux-layout-section--features .ux-labels-values',
    '.ux-layout-section-evo--features .ux-labels-values',
    '#viTabs_0_is .ux-labels-values',
    '#viTabs_0_pd .ux-labels-values',
    '.itemAttr .ux-labels-values'
  ];

  /* Legacy attribute table (still present on some categories / sellers). */
  const LEGACY_ATTR_SELECTORS = [
    '.itemAttr table tr',
    '#viTabs_0_is table tr',
    '.specifics tr'
  ];

  function test() {
    return /ebay\./i.test(location.hostname) && /\/(itm|i)\//i.test(location.pathname);
  }

  async function ready() {
    /* Only spec-bearing anchors — title is present at first paint and
       would short-circuit the wait before specifics hydrate. */
    const anchors = ITEM_SPECIFICS_SELECTORS.concat(LEGACY_ATTR_SELECTORS);
    await dom.waitForReady(anchors, { maxMs: 2000, quietMs: 400 });
  }

  function extract() {
    const out = [];

    /* ---- Title ---- */
    const title = dom.pickText([
      '.x-item-title__mainTitle .ux-textspans',
      '.x-item-title__mainTitle',
      '#itemTitle',
      'h1.x-item-title'
    ]);
    if (title) emit(out, 'identity', 'title', stripTitleNoise(title), 'adapter:ebay');

    /* ---- Item ID ---- */
    const idMatch = location.pathname.match(/\/(?:itm|i)\/(?:[^/]+\/)?(\d{8,14})/);
    if (idMatch) emit(out, 'identifier', 'ebayItemId', idMatch[1], 'adapter:ebay');

    /* ---- Price ---- */
    const newPrice = dom.pickText([
      '[data-testid="x-price-primary"] .ux-textspans',
      '.x-price-primary .ux-textspans',
      '.x-price-primary',
      '#prcIsum',
      '#mm-saleDscPrc'
    ]);
    if (newPrice) emit(out, 'price', 'newPrice', newPrice, 'adapter:ebay');

    /* Was-price / strikethrough */
    const wasPrice = dom.pickText(['.x-additional-info__textual-display .ux-textspans--STRIKETHROUGH']);
    if (wasPrice) emit(out, 'price', 'wasPrice', wasPrice, 'adapter:ebay');

    /* ---- Shipping ---- */
    const shipping = dom.pickText([
      '.ux-labels-values--shipping .ux-labels-values__values .ux-textspans',
      '#fshippingCost',
      '.shipping-cost'
    ]);
    if (shipping) emit(out, 'price', 'shipping', shipping, 'adapter:ebay');

    /* ---- Condition (eBay-specific identity field — also surfaced as a spec) ---- */
    const condition = dom.pickText([
      '.x-item-condition-text .ux-textspans',
      '.x-item-condition-text',
      '#vi-itm-cond'
    ]);
    if (condition) emit(out, 'spec', 'Condition', condition, 'adapter:ebay', C.MEDIUM);

    /* ---- Seller ---- */
    const sellerName = dom.pickText([
      '.x-sellercard-atf__info__about-seller .ux-textspans--BOLD',
      '.x-sellercard-atf__info__about-seller a',
      '#mbgLink span'
    ]);
    if (sellerName) emit(out, 'seller', 'name', sellerName, 'adapter:ebay');

    const sellerFeedback = dom.pickText([
      '.x-sellercard-atf__data-item .ux-textspans--PSEUDOLINK',
      '#si-fb'
    ]);
    if (sellerFeedback) emit(out, 'seller', 'feedback', sellerFeedback, 'adapter:ebay');

    /* ---- Availability ---- */
    const availability = dom.pickText([
      '.d-quantity__availability .ux-textspans',
      '#qtySubTxt',
      '.qtyAvail'
    ]);
    if (availability) emit(out, 'availability', null, availability, 'adapter:ebay');

    /* ---- Rating ---- */
    const ratingRaw = dom.pickText([
      '.x-product-ratings__average',
      '.ebay-review-start-rating'
    ]);
    const ratingMatch = ratingRaw && ratingRaw.match(/([\d.]+)/);
    if (ratingMatch) emit(out, 'rating', 'value', ratingMatch[1], 'adapter:ebay');
    const reviewCount = dom.pickText([
      '.x-product-ratings__total-reviews',
      '.ebay-review-count'
    ]);
    if (reviewCount) emit(out, 'rating', 'count', reviewCount, 'adapter:ebay');

    /* ---- Images ---- */
    for (const img of document.querySelectorAll('.ux-image-carousel-item img, picture .img img, #icImg')) {
      const u = img.getAttribute('data-zoom-src') || img.getAttribute('src');
      if (u && /^https?:/i.test(u)) emit(out, 'image', 'product', u, 'adapter:ebay');
    }

    /* ---- Item specifics (modern ux-labels-values grid) ---- */
    for (const sel of ITEM_SPECIFICS_SELECTORS) {
      for (const row of document.querySelectorAll(sel)) {
        const label = dom.textOf(row.querySelector('.ux-labels-values__labels, .ux-labels-values__labels-content'));
        const value = dom.textOf(row.querySelector('.ux-labels-values__values, .ux-labels-values__values-content'));
        if (!label || !value || label.length > 60) continue;
        emit(out, 'spec', label.replace(/[:\s]+$/, ''), value, 'adapter:ebay-specifics',
          C.MEDIUM, { selector: sel, nodePath: dom.nodePath(row) });
      }
    }

    /* ---- Legacy attribute table ---- */
    for (const sel of LEGACY_ATTR_SELECTORS) {
      for (const row of document.querySelectorAll(sel)) {
        const cells = row.querySelectorAll('td, th');
        if (cells.length < 2) continue;
        const k = dom.textOf(cells[0]).replace(/[:\s]+$/, '');
        const v = dom.textOf(cells[1]);
        if (k && v && k.length < 60) emit(out, 'spec', k, v, 'adapter:ebay-legacy',
          C.MEDIUM, { selector: sel, nodePath: dom.nodePath(row) });
      }
    }

    /* ---- Description (iframed on many listings; we grab the visible
            top-level summary if present). ---- */
    const desc = dom.pickText([
      '.x-item-description-child',
      '.product-spectification',
      '.d-item-description'
    ]);
    if (desc) emit(out, 'description', null, desc, 'adapter:ebay');

    return out;
  }

  /* eBay frequently prefixes titles with "Details about " — strip that. */
  function stripTitleNoise(t) {
    return String(t || '').replace(/^Details\s+about\s+/i, '').trim();
  }

  function emit(out, type, key, value, source, confidence, extra) {
    if (value == null || value === '') return;
    const o = { type, key, value, source };
    if (confidence) o.confidence = confidence;
    if (extra) Object.assign(o, extra);
    out.push(obs(o));
  }

  root.SSAdapterEbay = { name: 'ebay', test, ready, extract };
})(globalThis);
