/* =============================================================
   ShopScout — Pipeline orchestrator
   Runs the layered extraction pipeline in the order specified
   by the architecture:
     1. marketplace.detect()        — pick adapter
     2. structuredSignals.harvest() — JSON-LD / microdata / OG
     3. adapter.extract()           — site-specific selectors
     4. generic.extractVisibleTables() — generic <tr>/<dl> sweep
     5. specMiner.mine()            — free-text patterns
     6. productSchema.assemble()    — confidence-aware merge
     7. category.match()            — Shopify taxonomy match (LAST)
   ============================================================= */
(function initExtractor(root) {
  const NS = (root.SSExtract = root.SSExtract || {});

  async function extractProduct(options) {
    options = options || {};
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    const all = [];
    const trace = {};

    /* ---- 1. Detect marketplace ---- */
    const mp = NS.marketplace && NS.marketplace.detect();
    if (!mp) return { spec: NS.emptyProductSpec(), trace: { error: 'no-adapter' } };
    trace.marketplace = mp.name;

    /* ---- 1b. Page hydration wait — DISABLED by default ----
       On a user click the page is already fully loaded; an artificial
       wait only delays the capture and never adds data. The wait is
       still available for batch/background scrapers via
       extractProduct({ wait: true }). */
    if (options.wait) {
      try {
        if (mp.adapter.ready) await mp.adapter.ready();
      } catch { /* bounded by waitForReady's maxMs */ }
    }

    /* ---- 2. Structured signals (JSON-LD / microdata / OG) ---- */
    let signals = { observations: [], raw: {} };
    try {
      if (NS.structuredSignals) signals = NS.structuredSignals.harvest();
    } catch { /* ignore */ }
    trace.structuredSignals = signals.observations.length;
    for (const o of signals.observations) all.push(o);

    /* ---- 3. Marketplace adapter ---- */
    let adapterObs = [];
    try {
      adapterObs = mp.adapter.extract() || [];
    } catch { /* ignore */ }
    trace.adapter = adapterObs.length;
    for (const o of adapterObs) all.push(o);

    /* ---- 4. Generic visible-table sweep (only when the named
            adapter isn't the generic one — otherwise it's already
            been run in stage 3). ---- */
    if (mp.name !== 'generic' && root.SSAdapterGeneric) {
      try {
        const generic = root.SSAdapterGeneric.extract() || [];
        trace.generic = generic.length;
        for (const o of generic) all.push(o);
      } catch { /* ignore */ }
    }

    /* ---- 5. Spec miner over feature bullets + description ---- */
    if (NS.specMiner) {
      const minerText = collectMinerText(all);
      const existingKeysLower = all
        .filter(o => o.type === 'spec' || o.type === 'item_detail')
        .map(o => (o.key || '').toLowerCase());
      try {
        const mined = NS.specMiner.mine(minerText, existingKeysLower) || [];
        trace.miner = mined.length;
        for (const o of mined) all.push(o);
      } catch { /* ignore */ }
    }

    /* ---- 6. Confidence-aware assembly into ProductSpec ---- */
    const spec = NS.assemble(all, {
      marketplace: mp.name,
      adapter: mp.name,
      rawSignals: signals.raw
    });
    if (options.url) spec.source.url = options.url;

    /* ---- 7. Category match (LAST — needs the assembled record) ---- */
    if (root.SSDataCanonical && root.SSDataCanonical.matchProductToCategory) {
      try {
        const cat = await root.SSDataCanonical.matchProductToCategory(spec);
        if (cat) {
          spec.category = spec.category || {};
          spec.category.shopify   = cat.shopify   || spec.category.shopify   || null;
          spec.category.google    = cat.google    || spec.category.google    || null;
          spec.category.gpc       = cat.gpc       || spec.category.gpc       || null;
          spec.category.confidence = cat.confidence || spec.category.confidence || null;
        }
        trace.categoryMatched = !!cat;
      } catch { /* ignore */ }
    }

    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    trace.totalMs = Math.round(t1 - t0);
    trace.observationCount = all.length;
    trace.specCount = Object.keys(spec.specs || {}).length;
    trace.itemDetailCount = Object.keys(spec.itemDetails || {}).length;
    trace.featureCount = (spec.features || []).length;
    spec.source = spec.source || {};
    spec.source.pipeline = trace;

    /* Surface what was captured so the user can see why an expected spec
       is missing. Visible in the page's devtools console — open it and
       look for "[ShopScout]". */
    try {
      console.log('[ShopScout] capture',
        '— marketplace=' + trace.marketplace,
        '| structuredSignals=' + (trace.structuredSignals || 0),
        '| adapter=' + (trace.adapter || 0),
        '| generic=' + (trace.generic || 0),
        '| miner=' + (trace.miner || 0),
        '| specs=' + trace.specCount,
        '| itemDetails=' + trace.itemDetailCount,
        '| features=' + trace.featureCount,
        '| ' + trace.totalMs + 'ms');
      console.log('[ShopScout] spec.specs', spec.specs);
      console.log('[ShopScout] full spec', spec);
    } catch { /* ignore */ }

    return { spec, observations: all, trace };
  }

  /* Aggregate plain-text strings the spec miner should scan: feature
     bullets + description + any 'value' from item_detail observations. */
  function collectMinerText(observations) {
    const parts = [];
    for (const o of observations) {
      if (o.type === 'feature' && o.value)      parts.push(String(o.value));
      if (o.type === 'description' && o.value)  parts.push(String(o.value));
      if (o.type === 'item_detail' && o.value)  parts.push(String(o.value));
    }
    return parts.join('\n');
  }

  NS.extractProduct = extractProduct;
})(globalThis);
