/* =============================================================
   ShopScout — Stage 1: marketplace detection + adapter routing
   Determines which adapter to run based on hostname / URL patterns.
   ============================================================= */
(function initMarketplace(root) {
  const NS = (root.SSExtract = root.SSExtract || {});

  /* Order matters — the first match wins. Generic is the final
     fallback for any site that doesn't match a named marketplace. */
  const RULES = [
    { name: 'amazon',     adapterRef: 'SSAdapterAmazon',     test: () => /amazon\./i.test(location.hostname) && /\/dp\/|\/gp\/product\//i.test(location.pathname) },
    { name: 'amazon',     adapterRef: 'SSAdapterAmazon',     test: () => /amazon\./i.test(location.hostname) },
    { name: 'ebay',       adapterRef: 'SSAdapterEbay',       test: () => /ebay\./i.test(location.hostname) && /\/itm\//i.test(location.pathname) },
    { name: 'walmart',    adapterRef: 'SSAdapterWalmart',    test: () => /walmart\.com/i.test(location.hostname) && /\/ip\//i.test(location.pathname) },
    { name: 'bestbuy',    adapterRef: 'SSAdapterBestbuy',    test: () => /bestbuy\.com/i.test(location.hostname) && /\/site\/.+\/\d+\.p/i.test(location.pathname) },
    { name: 'costco',     adapterRef: 'SSAdapterCostco',     test: () => /costco\.com/i.test(location.hostname) },
    { name: 'target',     adapterRef: 'SSAdapterTarget',     test: () => /target\.com/i.test(location.hostname) && /\/p\//i.test(location.pathname) },
    { name: 'newegg',     adapterRef: 'SSAdapterNewegg',     test: () => /newegg\.com/i.test(location.hostname) && /\/p\//i.test(location.pathname) },
    { name: 'homedepot',  adapterRef: 'SSAdapterHomeDepot',  test: () => /homedepot\.com/i.test(location.hostname) && /\/p\//i.test(location.pathname) },
    { name: 'lowes',      adapterRef: 'SSAdapterLowes',      test: () => /lowes\.com/i.test(location.hostname) && /\/pd\//i.test(location.pathname) },
    { name: 'aliexpress', adapterRef: 'SSAdapterAliexpress', test: () => /aliexpress\./i.test(location.hostname) && /\/(item|i)\//i.test(location.pathname) },
    { name: 'alibaba',    adapterRef: 'SSAdapterAlibaba',    test: () => /alibaba\.com/i.test(location.hostname) },
    { name: 'temu',       adapterRef: 'SSAdapterTemu',       test: () => /temu\.com/i.test(location.hostname) },
    { name: 'shein',      adapterRef: 'SSAdapterShein',      test: () => /shein\./i.test(location.hostname) }
  ];

  /* Returns { name, adapter } for the first matching rule whose adapter is
     actually loaded. Falls back to the generic adapter if nothing matches
     or the named adapter hasn't been registered yet (e.g. we haven't built
     it in this turn). */
  function detect() {
    for (const r of RULES) {
      try {
        if (r.test() && root[r.adapterRef]) {
          return { name: r.name, adapter: root[r.adapterRef] };
        }
      } catch { /* continue */ }
    }
    /* Fallback to generic (always registered as SSAdapterGeneric). */
    if (root.SSAdapterGeneric) return { name: 'generic', adapter: root.SSAdapterGeneric };
    return null;
  }

  NS.marketplace = { detect, RULES };
})(globalThis);
