/* =============================================================
   ShopScout — Amazon adapter
   Selector lists curated from the existing ShopScout extractor +
   oxylabs/amazon-scraper + awesome-amazon-seller-tools open
   source. Emits Observations against the productSchema contract.
   ============================================================= */
(function initAmazonAdapter(root) {
  if (!root.SSExtract) return;
  const NS  = root.SSExtract;
  const obs = NS.observation;
  const C   = NS.Confidence;
  const dom = NS.dom;

  /* Modern Product Overview widget — the .po-* table at the top of newer
     ASINs. The single most important container we used to miss. */
  const MODERN_PO_SELECTORS = [
    '#productOverview_feature_div tr[class^="po-"]',
    '#productOverview_feature_div tr[class*=" po-"]',
    '#productOverview_feature_div table tr'
  ];

  /* "Product information" / "Technical details" / "Additional information"
     — Amazon ships these as several variants depending on category and A/B
     test. We scan them all. */
  const LEGACY_TABLE_SELECTORS = [
    '#productDetails_techSpec_section_1 tr',
    '#productDetails_techSpec_section_2 tr',
    '#productDetails_detailBullets_sections1 tr',
    '#productDetails_db_sections tr',
    '#productDetails_feature_div table tr',
    '#productInformation_feature_div table tr',
    '#productInformation_techSpec_section_1 tr',
    '#productInformation_techSpec_section_2 tr',
    '#technicalSpecifications_section_1 tr',
    '#technicalSpecifications_section_2 tr',
    '#poExpander .a-expander-content table tr',
    '#productDetailsWithModules_feature_div table tr',
    '#tech table tr',
    '.prodDetTable tr',
    '.a-keyvalue tr',
    /* Used in some categories where details land in a section we'd
       otherwise miss. */
    '[id^="productDetails_"] table tr',
    '[data-feature-name="productDetails"] table tr'
  ];

  /* "Product facts" panel (2024+ replacement for the old Technical Details). */
  const PRODUCT_FACTS_SELECTORS = [
    '#productFactsDesktopExpander tr',
    '#productFactsDesktop_feature_div tr',
    '#productFactsDesktop_feature_div .a-fixed-left-grid',
    '[data-feature-name="productFactsDesktop"] tr',
    '[data-feature-name="productFactsDesktop"] .a-fixed-left-grid',
    '[data-csa-c-content-id="productFactsDesktop"] tr'
  ];

  /* A+ content (rich product description) frequently embeds the best
     spec breakdown — especially for tools, electronics, appliances.
     Common Amazon authoring templates: apm-tablemodule, aplus-tech-spec. */
  const APLUS_TABLE_SELECTORS = [
    '#aplus .apm-tablemodule-table tr',
    '#aplus_feature_div .apm-tablemodule-table tr',
    '#aplus-v2 .apm-tablemodule-table tr',
    '.aplus-v2 .apm-tablemodule-table tr',
    '.aplus-tech-spec-table tr',
    '#aplus3p_feature_div .apm-tablemodule-table tr',
    '#aplusBrandStory_feature_div table tr',
    '#dpx-aplus-product-description_feature_div table tr'
  ];

  /* Comparison widget — sometimes the only place a spec appears. */
  const COMPARISON_TABLE_SELECTORS = [
    '#HLCXComparisonTable tr',
    '#HLCXComparisonJumboVisualWidget_feature_div table tr',
    '#comparison_table_feature_div table tr'
  ];

  /* Detail bullets ("About this item" left-rail list — usually identifiers
     and dimensions written as "Brand : <value>" pairs). */
  const DETAIL_BULLET_SELECTORS = [
    '#detailBullets_feature_div .a-list-item',
    '#detailBulletsWrapper_feature_div .a-list-item'
  ];

  /* "About this item" feature bullets — usually marketing copy with embedded
     numeric specs that the miner picks up. */
  const FEATURE_BULLET_SELECTORS = [
    '#feature-bullets li',
    '#feature-bullets .a-list-item',
    '.a-unordered-list.a-vertical .a-list-item'
  ];

  function test() {
    return /amazon\./i.test(location.hostname);
  }

  /* Bot-aware wait. Only spec-bearing containers are candidates — we
     deliberately exclude #productTitle/#dp-container because they're
     present at first paint, and including them would cause the wait to
     resolve before the spec tables hydrate. If no spec container shows
     up before the cap, we proceed anyway and let structured signals +
     adapter selectors fill what they can. */
  async function ready() {
    const anchors = []
      .concat(MODERN_PO_SELECTORS)
      .concat(LEGACY_TABLE_SELECTORS.slice(0, 4))
      .concat(PRODUCT_FACTS_SELECTORS.slice(0, 4))
      .concat(DETAIL_BULLET_SELECTORS);
    await dom.waitForReady(anchors, { maxMs: 2000, quietMs: 400 });
  }

  function extract() {
    const out = [];

    /* ---- Title ---- */
    const title = dom.pickText(['#productTitle', '#title', 'h1#title']);
    if (title) emit(out, 'identity', 'title', title, 'adapter:amazon');

    /* ---- ASIN ---- */
    const asin = (document.querySelector('[data-asin][data-csa-c-asin]') && document.querySelector('[data-asin][data-csa-c-asin]').dataset.csaCAsin)
      || (location.pathname.match(/\/dp\/([A-Z0-9]{10})/) || [])[1]
      || (document.querySelector('input[name="ASIN"]') && document.querySelector('input[name="ASIN"]').value)
      || '';
    if (asin) emit(out, 'identifier', 'asin', asin, 'adapter:amazon');

    /* ---- Brand (byline) ---- */
    const bylineRaw = dom.textOf(document.querySelector('#bylineInfo'));
    if (bylineRaw) {
      const brand = bylineRaw.replace(/^(Visit the |Brand:\s*)/i, '').replace(/\s*Store$/, '').trim();
      if (brand) emit(out, 'identity', 'brand', brand, 'adapter:amazon', { selector: '#bylineInfo' });
    }

    /* ---- New price ---- */
    const newPrice = dom.pickText([
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '#corePrice_feature_div .a-offscreen',
      '#apex_desktop .a-offscreen',
      '#tp_price_block_total_price_ww .a-offscreen'
    ]);
    if (newPrice) emit(out, 'price', 'newPrice', newPrice, 'adapter:amazon');

    /* ---- Used / refurbished ---- */
    const usedPrice = dom.pickText([
      '#usedBuySection .a-price .a-offscreen',
      '#renewedBuySection .a-price .a-offscreen',
      '[data-action="show-all-offers-display"] .a-price .a-offscreen',
      '#olp-sl-new-used .a-color-price'
    ]);
    if (usedPrice) emit(out, 'price', 'usedPrice', usedPrice, 'adapter:amazon');

    /* ---- Rating + review count ---- */
    const ratingRaw = dom.pickText(['#acrPopover .a-icon-alt', '[data-hook="rating-out-of-text"]']);
    const ratingMatch = ratingRaw && ratingRaw.match(/([\d.]+)/);
    if (ratingMatch) emit(out, 'rating', 'value', ratingMatch[1], 'adapter:amazon');
    const reviewCount = dom.textOf(document.querySelector('#acrCustomerReviewText')).replace(/\s*ratings?/i, '');
    if (reviewCount) emit(out, 'rating', 'count', reviewCount, 'adapter:amazon');

    /* ---- Seller ---- */
    const sellerName = dom.pickText([
      '#merchant-info a',
      '#tabular-buybox .tabular-buybox-text a',
      '#sellerProfileTriggerId'
    ]);
    if (sellerName) emit(out, 'seller', 'name', sellerName, 'adapter:amazon');

    /* ---- Availability ---- */
    const availability = dom.textOf(document.querySelector('#availability span'));
    if (availability) emit(out, 'availability', null, availability, 'adapter:amazon');

    /* ---- Main image + thumbnails ---- */
    const mainImage = (document.querySelector('#landingImage, #imgBlkFront') || {}).src || '';
    if (mainImage) emit(out, 'image', 'product', mainImage, 'adapter:amazon');
    for (const img of document.querySelectorAll('#altImages img, #imageBlock_feature_div img, [data-action="main-image-click"] img')) {
      const u = img.getAttribute('data-old-hires') || img.src;
      if (u && u.startsWith('http')) emit(out, 'image', 'product', u, 'adapter:amazon');
    }

    /* ---- User-submitted review photos ---- */
    for (const img of document.querySelectorAll('#cm-cr-dp-review-list img.review-image-tile, [data-hook="review-image-tile"] img')) {
      if (img.src) emit(out, 'image', 'user', img.src, 'adapter:amazon');
    }

    /* ---- Modern Product Overview (.po-*) — highest-priority adapter source. */
    extractKeyValueRows(MODERN_PO_SELECTORS, 'adapter:amazon-po', C.MEDIUM, out);

    /* ---- Legacy spec tables + Product Facts ---- */
    extractKeyValueRows(LEGACY_TABLE_SELECTORS, 'adapter:amazon-legacy', C.MEDIUM, out);
    extractKeyValueRows(PRODUCT_FACTS_SELECTORS, 'adapter:amazon-facts', C.MEDIUM, out);

    /* ---- A+ content tables — heavy spec source for tools / electronics. ---- */
    extractKeyValueRows(APLUS_TABLE_SELECTORS, 'adapter:amazon-aplus', C.MEDIUM, out);

    /* ---- Comparison widget. ---- */
    extractKeyValueRows(COMPARISON_TABLE_SELECTORS, 'adapter:amazon-compare', C.MEDIUM, out);

    /* ---- Detail bullets — usually identifier-bearing "About this item"
            left-rail entries written as "Manufacturer ‏ : ‎ HOTO". Amazon
            wraps the colon with U+200F (RLM) AND U+200E (LRM) marks, so we
            strip those before regex-matching. */
    for (const sel of DETAIL_BULLET_SELECTORS) {
      for (const li of document.querySelectorAll(sel)) {
        const raw = dom.textOf(li);
        const t = raw.replace(/[‎‏‪-‮]/g, '');
        const m = t && t.match(/^(.{2,60}?)\s*:\s*(.+)$/);
        if (m) {
          const key = m[1].trim();
          const value = m[2].trim();
          if (key && value && value.length < 300) {
            emit(out, 'item_detail', key, value, 'adapter:amazon-detail-bullet', { selector: sel });
          }
        }
      }
    }

    /* ---- Feature bullets ("About this item" — marketing strings) ---- */
    for (const sel of FEATURE_BULLET_SELECTORS) {
      for (const li of document.querySelectorAll(sel)) {
        const t = dom.textOf(li);
        if (t && t.length > 4 && t.length < 600) {
          emit(out, 'feature', null, t, 'adapter:amazon');
        }
      }
    }

    /* ---- Description paragraph ---- */
    const desc = dom.pickText(['#productDescription p', '#productDescription', '#aplus', '#dpx-aplus-product-description_feature_div']);
    if (desc) emit(out, 'description', null, desc, 'adapter:amazon');

    return out;
  }

  /* ---- Generic key/value table extractor.
          Layered fallback: (1) explicit label/value selectors,
          (2) first-cell / second-cell (works for any 2-cell row),
          (3) colon-split on the row text. We almost never want a
          fully populated 2-cell row to drop silently. ---- */
  function extractKeyValueRows(selectors, source, confidence, out) {
    const seen = new Set();
    for (const sel of selectors) {
      try {
        for (const row of document.querySelectorAll(sel)) {
          const text = dom.textOf(row);
          if (!text || text.length > 600) continue;

          let key = '', value = '';

          /* (1) Try named label/value selectors first. */
          const labelEl = row.querySelector(
            '.a-text-bold, th.a-color-secondary, th, ' +
            '.a-span3 span, .a-col-left span, ' +
            '.a-fixed-left-grid-col:first-child, ' +
            '.apm-tablemodule-keyhead, .aplus-tech-spec-table-col1');
          const valueEl = row.querySelector(
            '.a-span9 .po-break-word, .a-span9 span, ' +
            '.a-col-right span, ' +
            '.a-fixed-left-grid-col:nth-child(2), ' +
            '.apm-tablemodule-valuecell, .aplus-tech-spec-table-col2, dd');
          if (labelEl && valueEl && labelEl !== valueEl) {
            key = dom.textOf(labelEl).replace(/[\s:]+$/, '');
            value = dom.textOf(valueEl);
          }

          /* (2) Two-cell row fallback. Works for any plain <tr><td>K</td><td>V</td></tr>
                 even when no class/span guard matches. */
          if (!key || !value) {
            const cells = row.querySelectorAll(':scope > td, :scope > th');
            if (cells.length >= 2) {
              const k = dom.textOf(cells[0]).replace(/[\s:]+$/, '');
              const v = dom.textOf(cells[cells.length === 2 ? 1 : 1]);
              if (k && v) { key = k; value = v; }
            }
          }

          /* (3) Colon-split fallback for one-cell rows or list items. */
          if ((!key || !value) && text.includes(':')) {
            const idx = text.indexOf(':');
            const k = text.slice(0, idx).trim();
            const v = text.slice(idx + 1).trim();
            if (k && v) { key = k; value = v; }
          }

          if (!key || !value || key.length > 100) continue;
          /* Skip rows where label and value collapsed to the same text — an
             A+ image table sometimes does this. */
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
      } catch { /* invalid selector, skip */ }
    }
  }

  function emit(out, type, key, value, source, extra) {
    if (value == null || value === '') return;
    const base = { type, key, value, source };
    if (extra) Object.assign(base, extra);
    out.push(obs(base));
  }

  /* Public adapter contract */
  root.SSAdapterAmazon = {
    name: 'amazon',
    test,
    ready,        // async — call before extract() if dynamic content matters
    extract       // sync — returns Observation[]
  };
})(globalThis);
