/* =============================================================
   ShopScout — Walmart adapter
   Walmart.com PDP — heavy React app with rich JSON-LD; the
   structured-signals stage already harvests the bulk of the
   product record. This adapter fills the gaps:
     - "About this item" feature bullets
     - "Specifications" / "Product Highlights" tables
     - Brand / model / dimensions from the visible spec list
   ============================================================= */
(function initWalmartAdapter(root) {
  if (!root.SSExtract) return;
  const NS  = root.SSExtract;
  const obs = NS.observation;
  const C   = NS.Confidence;
  const dom = NS.dom;

  /* Specifications block — Walmart renders this several ways depending
     on category. We try each. */
  const SPEC_ROW_SELECTORS = [
    '[data-testid="product-specifications"] tr',
    '[data-testid="product-specifications"] [role="row"]',
    'section[aria-label="Specifications"] tr',
    'section[aria-label="Specifications"] [role="row"]',
    '.specification-table tr',
    '[data-automation-id="product-highlights"] li',
    /* React-only "key/value pair" rows used in newer pages. */
    '.nl5 .h2 + .pa3-l .flex',
    '[data-testid="product-detail-page"] dl > div'
  ];

  /* "About this item" feature bullets. */
  const ABOUT_BULLET_SELECTORS = [
    '[data-testid="about-this-item"] li',
    '[data-testid="product-description-content"] li',
    'section[aria-labelledby="about-this-item-heading"] li',
    '.product-description-content li',
    '#product-overview li'
  ];

  function test() {
    return /walmart\.com/i.test(location.hostname) && /\/ip\//i.test(location.pathname);
  }

  async function ready() {
    /* Spec-bearing anchors only — Walmart's title renders at first paint
       and would short-circuit the wait. */
    const anchors = SPEC_ROW_SELECTORS.concat(ABOUT_BULLET_SELECTORS);
    await dom.waitForReady(anchors, { maxMs: 2000, quietMs: 400 });
  }

  function extract() {
    const out = [];

    /* ---- Title ---- */
    const title = dom.pickText([
      'h1[itemprop="name"]',
      '[data-testid="product-title"]',
      '#main-title',
      'h1'
    ]);
    if (title) emit(out, 'identity', 'title', title, 'adapter:walmart');

    /* ---- Walmart item ID from URL ---- */
    const idMatch = location.pathname.match(/\/ip\/[^/]+\/(\d{6,})/);
    if (idMatch) emit(out, 'identifier', 'walmartItemId', idMatch[1], 'adapter:walmart');

    /* ---- Price ---- */
    const newPrice = dom.pickText([
      '[itemprop="price"]',
      '[data-testid="price-now"]',
      '[data-automation-id="product-price"]',
      'span[data-fs-element="price"]'
    ]);
    if (newPrice) emit(out, 'price', 'newPrice', newPrice, 'adapter:walmart');

    const wasPrice = dom.pickText([
      '[data-testid="price-was"]',
      '.was-price'
    ]);
    if (wasPrice) emit(out, 'price', 'wasPrice', wasPrice, 'adapter:walmart');

    /* ---- Brand ---- */
    const brand = dom.pickText([
      '[itemprop="brand"]',
      '[data-testid="product-brand"]',
      '.prod-brandName'
    ]);
    if (brand) emit(out, 'identity', 'brand', brand, 'adapter:walmart');

    /* ---- Rating ---- */
    const ratingRaw = dom.pickText([
      '[data-testid="reviews-and-ratings"] span[itemprop="ratingValue"]',
      '.average-rating',
      'span[itemprop="ratingValue"]'
    ]);
    const ratingMatch = ratingRaw && ratingRaw.match(/([\d.]+)/);
    if (ratingMatch) emit(out, 'rating', 'value', ratingMatch[1], 'adapter:walmart');

    const reviewCount = dom.pickText([
      '[itemprop="reviewCount"]',
      '[data-testid="reviews-count"]'
    ]);
    if (reviewCount) emit(out, 'rating', 'count', reviewCount, 'adapter:walmart');

    /* ---- Seller ---- */
    const sellerName = dom.pickText([
      '[data-testid="seller-name"] a',
      '[data-testid="seller-name"]',
      '[data-automation-id="seller-name"]'
    ]);
    if (sellerName) emit(out, 'seller', 'name', sellerName, 'adapter:walmart');

    /* ---- Availability ---- */
    const availability = dom.pickText([
      '[data-testid="fulfillment-shipping-text"]',
      '[data-testid="fulfillment-pickup-text"]',
      '.fulfillment-availability'
    ]);
    if (availability) emit(out, 'availability', null, availability, 'adapter:walmart');

    /* ---- Images ---- */
    for (const img of document.querySelectorAll(
      '[data-testid="hero-image-container"] img, .hover-zoom-hero-image, .pip-header-image img, picture img[data-fs-element="image"]')) {
      const u = img.src || img.getAttribute('data-src');
      if (u && /^https?:/i.test(u)) emit(out, 'image', 'product', u, 'adapter:walmart');
    }

    /* ---- About this item feature bullets ---- */
    for (const sel of ABOUT_BULLET_SELECTORS) {
      for (const li of document.querySelectorAll(sel)) {
        const t = dom.textOf(li);
        if (t && t.length > 4 && t.length < 600) emit(out, 'feature', null, t, 'adapter:walmart');
      }
    }

    /* ---- Specifications table ---- */
    for (const sel of SPEC_ROW_SELECTORS) {
      for (const row of document.querySelectorAll(sel)) {
        const text = dom.textOf(row);
        if (!text || text.length > 320) continue;
        let key = '', value = '';
        const labelEl = row.querySelector('th, dt, [data-testid="product-spec-name"], .h6, .b, .pr1, td:first-child');
        const valueEl = row.querySelector('td:not(:first-child), dd, [data-testid="product-spec-value"], .ml2, .gray, td:nth-child(2)');
        if (labelEl && valueEl && labelEl !== valueEl) {
          key = dom.textOf(labelEl).replace(/[:\s]+$/, '');
          value = dom.textOf(valueEl);
        } else if (text.includes(':')) {
          const [k, ...rest] = text.split(':');
          key = k.trim();
          value = rest.join(':').trim();
        }
        if (!key || !value || key.length > 60) continue;
        emit(out, 'spec', key, value, 'adapter:walmart-specs', C.MEDIUM,
          { selector: sel, nodePath: dom.nodePath(row) });
      }
    }

    /* ---- Description paragraph ---- */
    const desc = dom.pickText([
      '[data-testid="product-description-content"]',
      '.product-short-description-content',
      'section[aria-labelledby="about-this-item-heading"] p'
    ]);
    if (desc) emit(out, 'description', null, desc, 'adapter:walmart');

    return out;
  }

  function emit(out, type, key, value, source, confidence, extra) {
    if (value == null || value === '') return;
    const o = { type, key, value, source };
    if (confidence) o.confidence = confidence;
    if (extra) Object.assign(o, extra);
    out.push(obs(o));
  }

  root.SSAdapterWalmart = { name: 'walmart', test, ready, extract };
})(globalThis);
