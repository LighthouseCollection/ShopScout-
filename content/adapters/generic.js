/* =============================================================
   ShopScout — Generic adapter
   Used for any site without a dedicated marketplace adapter.
   Strategy: scan the DOM for any reasonable "spec table"
   ((tr/td/th), (dl/dt/dd), itemprop-marked microdata), grab the
   page's main image and h1, and emit observations at confidence
   MEDIUM (we don't know exactly where these came from). The
   structured-signals stage will already have provided high-
   confidence values for most fields; this fills the long tail.
   ============================================================= */
(function initGenericAdapter(root) {
  if (!root.SSExtract) return;
  const NS  = root.SSExtract;
  const obs = NS.observation;
  const C   = NS.Confidence;
  const dom = NS.dom;

  /* Common spec-table containers across small/medium e-com sites. */
  const SPEC_TABLE_SELECTORS = [
    'table.product-specs tr',
    'table.specifications tr',
    'table.product-attribute-specs-table tr',
    'table[class*="spec"] tr',
    '.product-specs tr',
    '.product-specs-list dl > div',
    '.product-attributes tr',
    '.product-attributes li',
    '.tech-specs tr',
    '.tech-specs li',
    '.spec-table tr',
    '.specs-list li',
    '.specifications dl',
    '.product-features li',
    'dl.product-properties > div',
    'dl[itemprop="additionalProperty"] > div',
    /* schema.org PropertyValue microdata */
    '[itemtype*="PropertyValue"]'
  ];

  /* Generic image containers — vendor product images.  */
  const PRODUCT_IMAGE_SELECTORS = [
    '[itemprop="image"]',
    '.product-image img',
    '.product-images img',
    '.product-gallery img',
    '.gallery img',
    '#product-image img',
    '.main-image img'
  ];

  /* User-uploaded review photos. Rare on sites without an explicit reviews
     section; we still try the common patterns. */
  const USER_IMAGE_SELECTORS = [
    '.review-image img',
    '.review-photo img',
    '.customer-image img'
  ];

  function test() { return true; }   // generic always matches as a fallback

  async function ready() {
    /* Brief wait for any common spec table to appear. */
    await dom.waitForReady([
      'h1', '[itemtype*="schema.org/Product"]',
      'table tr', 'dl dt'
    ], { maxMs: 1200, quietMs: 300 });
  }

  function extract() {
    const out = [];

    /* ---- Title (h1 is the universal hit) ---- */
    const title = dom.pickText(['h1[itemprop="name"]', 'h1.product-title', 'h1.product-name', 'h1']);
    if (title) emit(out, 'identity', 'title', title, 'adapter:generic');

    /* ---- Price ---- */
    const price = dom.pickText([
      '[itemprop="price"]',
      '.product-price .price',
      '.product-price',
      '.price-now',
      '.current-price',
      '.sale-price',
      '.price'
    ]);
    if (price) emit(out, 'price', 'newPrice', price, 'adapter:generic');

    /* ---- Brand ---- */
    const brand = dom.pickText([
      '[itemprop="brand"]',
      '.product-brand',
      '.brand-name'
    ]);
    if (brand) emit(out, 'identity', 'brand', brand, 'adapter:generic');

    /* ---- Description ---- */
    const desc = dom.pickText([
      '[itemprop="description"]',
      '.product-description',
      '#product-description',
      '.description'
    ]);
    if (desc) emit(out, 'description', null, desc, 'adapter:generic');

    /* ---- Spec tables — dl, tr, etc. ---- */
    extractKeyValueRows(SPEC_TABLE_SELECTORS, 'adapter:generic-table', C.MEDIUM, out);

    /* ---- Feature bullets ---- */
    for (const li of document.querySelectorAll('.product-features li, .features li, .key-features li')) {
      const t = dom.textOf(li);
      if (t && t.length > 4 && t.length < 600) emit(out, 'feature', null, t, 'adapter:generic');
    }

    /* ---- Images ---- */
    for (const sel of PRODUCT_IMAGE_SELECTORS) {
      for (const img of document.querySelectorAll(sel)) {
        const u = img.src || img.getAttribute('data-src');
        if (u && /^https?:/i.test(u)) emit(out, 'image', 'product', u, 'adapter:generic');
      }
    }
    for (const sel of USER_IMAGE_SELECTORS) {
      for (const img of document.querySelectorAll(sel)) {
        const u = img.src || img.getAttribute('data-src');
        if (u && /^https?:/i.test(u)) emit(out, 'image', 'user', u, 'adapter:generic');
      }
    }

    return out;
  }

  function extractKeyValueRows(selectors, source, confidence, out) {
    const seen = new Set();
    for (const sel of selectors) {
      try {
        for (const row of document.querySelectorAll(sel)) {
          const text = dom.textOf(row);
          if (!text || text.length > 600) continue;

          let key = '', value = '';

          /* (1) Named label/value cells. */
          const labelEl = row.querySelector('[itemprop="name"], dt, th, .label, .key, .name');
          const valueEl = row.querySelector('[itemprop="value"], dd, .value');
          if (labelEl && valueEl && labelEl !== valueEl) {
            key = dom.textOf(labelEl).replace(/[\s:]+$/, '');
            value = dom.textOf(valueEl);
          }

          /* (2) Two-cell row fallback. */
          if (!key || !value) {
            const cells = row.querySelectorAll(':scope > td, :scope > th');
            if (cells.length >= 2) {
              const k = dom.textOf(cells[0]).replace(/[\s:]+$/, '');
              const v = dom.textOf(cells[1]);
              if (k && v) { key = k; value = v; }
            }
          }

          /* (3) Colon-split fallback. */
          if ((!key || !value) && text.includes(':')) {
            const idx = text.indexOf(':');
            const k = text.slice(0, idx).trim();
            const v = text.slice(idx + 1).trim();
            if (k && v) { key = k; value = v; }
          }

          if (!key || !value || key.length > 100) continue;
          if (key.toLowerCase() === value.toLowerCase()) continue;

          const dedupKey = key.toLowerCase() + '=' + value.toLowerCase();
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);

          out.push(obs({
            type: 'spec',
            key, value,
            source,
            confidence,
            selector: sel,
            nodePath: dom.nodePath(row)
          }));
        }
      } catch { /* skip invalid */ }
    }
  }

  function emit(out, type, key, value, source) {
    if (value == null || value === '') return;
    out.push(obs({ type, key, value, source }));
  }

  root.SSAdapterGeneric = { name: 'generic', test, ready, extract };
})(globalThis);
