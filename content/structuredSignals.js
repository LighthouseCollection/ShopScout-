/* =============================================================
   ShopScout — Stage 2: Structured-data harvester
   The single richest source of product data on most modern e-com
   pages: schema.org Product as JSON-LD, microdata, or RDFa, plus
   OpenGraph product:* meta tags.

   Emits a list of Observations (productSchema.js contract).
   Most sites give us 80–90% of the product record from this stage
   alone — adapters and the miner just fill the gaps.
   ============================================================= */
(function initStructuredSignals(root) {
  const NS = (root.SSExtract = root.SSExtract || {});
  const obs = NS.observation;
  const dom = NS.dom;

  function harvest() {
    const out = [];
    const jsonLd = dom.findProductLd();
    const og     = harvestOpenGraph();
    const microdata = harvestMicrodata();

    if (jsonLd) emitFromJsonLd(jsonLd, out);
    if (microdata) emitFromMicrodata(microdata, out);
    emitFromOpenGraph(og, out);

    return {
      observations: out,
      raw: { jsonLd, openGraph: og, microdata }
    };
  }

  /* ---------- JSON-LD ---------- */
  function emitFromJsonLd(p, out) {
    const src = 'json-ld';
    push(out, 'identity', 'title',        p.name, src);
    push(out, 'identity', 'brand',
      typeof p.brand === 'string' ? p.brand : (p.brand && (p.brand.name || p.brand['@id'])), src);
    push(out, 'identity', 'manufacturer',
      typeof p.manufacturer === 'string' ? p.manufacturer : (p.manufacturer && p.manufacturer.name), src);
    push(out, 'identity', 'modelName',    p.model, src);
    push(out, 'identity', 'modelNumber',  p.productID || p.modelNumber, src);

    push(out, 'identifier', 'sku',  p.sku,  src);
    push(out, 'identifier', 'mpn',  p.mpn,  src);
    push(out, 'identifier', 'gtin', p.gtin13 || p.gtin12 || p.gtin || p.gtin14 || p.gtin8, src);
    push(out, 'identifier', 'upc',  p.gtin12 || p.upc, src);
    push(out, 'identifier', 'ean',  p.gtin13 || p.ean, src);

    push(out, 'description', null, typeof p.description === 'string' ? p.description : '', src);
    push(out, 'category',    null, typeof p.category === 'string' ? p.category : (p.category && p.category.name), src);

    /* Offers */
    const offers = Array.isArray(p.offers) ? p.offers : (p.offers ? [p.offers] : []);
    if (offers[0]) {
      const o = offers[0];
      push(out, 'price', 'newPrice', o.price || (o.priceSpecification && o.priceSpecification.price), src);
      push(out, 'price', 'currency', o.priceCurrency || (o.priceSpecification && o.priceSpecification.priceCurrency), src);
      const av = typeof o.availability === 'string'
        ? o.availability.replace(/^https?:\/\/schema\.org\//, '')
        : '';
      push(out, 'availability', null, av, src);
      if (o.seller) push(out, 'seller', 'name', typeof o.seller === 'string' ? o.seller : o.seller.name, src);
    }

    if (p.aggregateRating) {
      push(out, 'rating', 'value', p.aggregateRating.ratingValue, src);
      push(out, 'rating', 'count', p.aggregateRating.reviewCount || p.aggregateRating.ratingCount, src);
    }

    /* Images */
    const images = []
      .concat(typeof p.image === 'string' ? [p.image] : [])
      .concat(Array.isArray(p.image) ? p.image : [])
      .concat(p.image && p.image.url ? [p.image.url] : []);
    for (const url of images) push(out, 'image', 'product', url, src);
    emitReviewImagesFromJsonLd(p.review, out, src);

    /* additionalProperty[] → specs */
    if (Array.isArray(p.additionalProperty)) {
      for (const pp of p.additionalProperty) {
        if (!pp || !pp.name) continue;
        const value = (pp.value == null ? '' : String(pp.value).trim())
          + (pp.unitText ? ' ' + String(pp.unitText).trim() : '');
        push(out, 'spec', String(pp.name).trim(), value.trim(), src);
      }
    }
  }

  function emitReviewImagesFromJsonLd(reviewValue, out, source) {
    const reviews = Array.isArray(reviewValue) ? reviewValue : (reviewValue ? [reviewValue] : []);
    for (const review of reviews) {
      if (!review || typeof review !== 'object') continue;
      for (const url of extractReviewImageUrls(review)) push(out, 'image', 'user', url, source);
    }
  }

  function extractReviewImageUrls(review) {
    const out = [];
    collectMediaUrls(review.image, out);
    collectMediaUrls(review.associatedMedia, out);
    collectMediaUrls(review.reviewBody && review.reviewBody.image, out);
    return out;
  }

  function collectMediaUrls(value, out) {
    if (!value) return;
    if (typeof value === 'string') {
      out.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) collectMediaUrls(item, out);
      return;
    }
    if (typeof value === 'object') {
      if (value.url) out.push(value.url);
      if (value.contentUrl) out.push(value.contentUrl);
      if (value.thumbnailUrl) out.push(value.thumbnailUrl);
      if (value.image) collectMediaUrls(value.image, out);
    }
  }

  /* ---------- Microdata (itemtype=…/Product) ---------- */
  function harvestMicrodata() {
    const roots = document.querySelectorAll('[itemscope][itemtype*="schema.org/Product" i]');
    if (!roots.length) return null;
    const r = roots[0];
    function txt(prop) {
      const el = r.querySelector('[itemprop="' + prop + '"]');
      if (!el) return '';
      return (el.getAttribute('content') || el.textContent || '').trim();
    }
    return {
      name:         txt('name'),
      brand:        txt('brand'),
      sku:          txt('sku'),
      mpn:          txt('mpn'),
      gtin13:       txt('gtin13'),
      price:        txt('price'),
      priceCurrency:txt('priceCurrency'),
      availability: txt('availability'),
      ratingValue:  txt('ratingValue'),
      reviewCount:  txt('reviewCount'),
      image:        (r.querySelector('[itemprop="image"]') || {}).src || ''
    };
  }
  function emitFromMicrodata(md, out) {
    const src = 'microdata';
    push(out, 'identity', 'title', md.name, src);
    push(out, 'identity', 'brand', md.brand, src);
    push(out, 'identifier', 'sku',  md.sku, src);
    push(out, 'identifier', 'mpn',  md.mpn, src);
    push(out, 'identifier', 'gtin', md.gtin13, src);
    push(out, 'price', 'newPrice', md.price, src);
    push(out, 'price', 'currency', md.priceCurrency, src);
    push(out, 'availability', null, md.availability, src);
    push(out, 'rating', 'value', md.ratingValue, src);
    push(out, 'rating', 'count', md.reviewCount, src);
    push(out, 'image', 'product', md.image, src);
  }

  /* ---------- OpenGraph ---------- */
  function harvestOpenGraph() {
    const out = {};
    for (const m of document.querySelectorAll('meta[property^="og:"], meta[property^="product:"], meta[name^="twitter:"]')) {
      const k = m.getAttribute('property') || m.getAttribute('name');
      const v = m.getAttribute('content');
      if (k && v) out[k] = v;
    }
    return out;
  }
  function emitFromOpenGraph(og, out) {
    if (!og) return;
    const src = 'opengraph';
    push(out, 'identity', 'title',    og['og:title'], src);
    push(out, 'identity', 'brand',    og['product:brand'], src);
    push(out, 'description', null,    og['og:description'] || og['twitter:description'], src);
    push(out, 'image', 'product',     og['og:image'] || og['twitter:image'], src);
    push(out, 'price', 'newPrice',    og['product:price:amount'], src);
    push(out, 'price', 'currency',    og['product:price:currency'], src);
    push(out, 'identifier', 'sku',    og['product:retailer_item_id'] || og['product:retailer_sku'], src);
    push(out, 'availability', null,   og['product:availability'], src);
  }

  /* ---- Helper: only push if value is non-empty ---- */
  function push(arr, type, key, value, source) {
    if (value == null) return;
    const v = String(value).trim();
    if (!v) return;
    const o = obs({ type, key, value: v, source });
    if (o) arr.push(o);
  }

  NS.structuredSignals = { harvest };
})(globalThis);
