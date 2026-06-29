var chrome = globalThis.browser || globalThis.chrome;

if (window._shopscoutLoaded) { /* already injected */ } else {
window._shopscoutLoaded = true;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'extract') return;
  Promise.resolve()
    .then(async () => {
      const Pipeline = globalThis.SSExtract;
      if (!Pipeline || !Pipeline.extractProduct) {
        /* Should never happen — the new files are injected before this
           script via background.js. Hard fail so we notice in dev. */
        throw new Error('SSExtract pipeline not loaded');
      }
      const { spec, trace } = await Pipeline.extractProduct({ url: location.href });
      const flat = Pipeline.toLegacyFlatProduct(spec);
      if (!flat || !flat.title) return null;
      /* Identity post-processing the old extractor did at the bottom of
         extractProductData(). Kept intact so listingTitle / productName /
         capture id remain consistent with what consumers already expect. */
      const identity = (window.SS && window.SS.buildProductIdentity)
        ? window.SS.buildProductIdentity(flat)
        : { listingTitle: flat.listingTitle || flat.title,
            productName: flat.title,
            structuredProductName: flat.title,
            productNameConfidence: 'low' };
      flat.listingTitle           = identity.listingTitle;
      flat.productName            = identity.productName;
      flat.structuredProductName  = identity.structuredProductName;
      flat.productNameConfidence  = identity.productNameConfidence;
      flat.title                  = identity.productName || flat.title;
      if (window.SS && window.SS.normalizeReviewCount) {
        flat.reviewCount = window.SS.normalizeReviewCount(flat.reviewCount);
      }
      /* Strip tracking params, affiliate refs, and title slug from the
         captured URL so the stored value matches what the legacy
         extractor used to produce (e.g. amazon /dp/ASIN only). */
      if (window.SS && window.SS.canonicalizeProductUrl) {
        flat.url = window.SS.canonicalizeProductUrl(flat.url);
      }
      flat.addedAt = Date.now();
      flat.id      = flat.url + '|' + flat.addedAt;
      flat._spec          = spec;
      flat._pipelineTrace = trace;
      return flat;
    })
    .then(result => sendResponse(result))
    .catch(err => {
      console.warn('ShopScout extract failed', err);
      sendResponse(null);
    });
  return true; // async sendResponse
});

/* =============================================================
   Floating capture button (FAB) — one-click product capture from
   the page itself, no extension-toolbar trip required.

   Settings key: chrome.storage.local.shopscout_capture_button =
     { enabled: boolean, hiddenHosts: string[] }
   Enabled by default. Per-hostname hide is managed from the
   Settings page; right-clicks on the button do nothing.
   The button lives in a closed Shadow DOM so the host page's
   CSS can't leak in and break it.
   ============================================================= */
const FAB_HOST_ID = 'shopscout-fab-host';
const FAB_SETTINGS_KEY = 'shopscout_capture_button';

async function shopscoutFabShouldRender() {
  /* User config gate */
  try {
    const stored = await chrome.storage.local.get(FAB_SETTINGS_KEY);
    const cfg = stored[FAB_SETTINGS_KEY] || { enabled: true, hiddenHosts: [] };
    if (!cfg.enabled) return false;
    if ((cfg.hiddenHosts || []).includes(location.hostname)) return false;
  } catch { /* fall through, default to showing */ }
  /* Detect product page via the new marketplace router. The named
     adapter says "yes" for known shopping hosts; structured signals
     (JSON-LD / OG) cover the long tail. */
  try {
    const Pipeline = globalThis.SSExtract;
    if (Pipeline && Pipeline.marketplace) {
      const hit = Pipeline.marketplace.detect();
      if (hit && hit.name && hit.name !== 'generic') return true;
    }
  } catch { /* fall through */ }
  /* Generic fallback: a Product node in JSON-LD or schema.org microdata. */
  try {
    if (globalThis.SSExtract && globalThis.SSExtract.dom && globalThis.SSExtract.dom.findProductLd
        && globalThis.SSExtract.dom.findProductLd()) return true;
  } catch {}
  try {
    if (document.querySelector('[itemtype*="schema.org/Product" i]')) return true;
  } catch {}
  return false;
}

function shopscoutFabBuild() {
  if (document.getElementById(FAB_HOST_ID)) return;
  const host = document.createElement('div');
  host.id = FAB_HOST_ID;
  /* Inline style with `all: initial` guards against host-page selectors that
     could otherwise pull the host out of position. */
  host.setAttribute('style',
    'all:initial;position:fixed;bottom:24px;right:24px;z-index:2147483647;' +
    'pointer-events:auto;');
  const shadow = host.attachShadow({ mode: 'closed' });
  ShopScoutSanitize.setTrustedHtml(shadow, [
    '<style>',
    ':host { all: initial; }',
    '.fab {',
    '  height:44px;',
    '  padding:0 18px;',
    '  border-radius:22px;',
    '  background:#c4661a;',
    '  color:#fff;',
    '  border:none;',
    '  cursor:pointer;',
    '  display:inline-flex; align-items:center; justify-content:center;',
    '  box-shadow:0 6px 16px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15);',
    '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
    '  font-size:14px; font-weight:600; letter-spacing:0.2px;',
    '  transition:transform 0.15s, box-shadow 0.15s, background 0.15s;',
    '  position:relative; white-space:nowrap;',
    '}',
    '.fab:hover { background:#a85614; transform:translateY(-2px); box-shadow:0 10px 24px rgba(0,0,0,0.30), 0 4px 8px rgba(0,0,0,0.18); }',
    '.fab:active { transform:translateY(0); }',
    '.fab.busy { background:#888; cursor:wait; }',
    '.fab.success { background:#0f6e3d; }',
    '.fab.error { background:#a3201c; }',
    '.toast {',
    '  position:absolute;',
    '  right:68px;',
    '  bottom:14px;',
    '  background:#1e2937;',
    '  color:#fff;',
    '  padding:8px 14px;',
    '  border-radius:6px;',
    '  font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
    '  font-size:13px;',
    '  font-weight:500;',
    '  white-space:nowrap;',
    '  opacity:0;',
    '  pointer-events:none;',
    '  transition:opacity 0.2s;',
    '  box-shadow:0 4px 12px rgba(0,0,0,0.2);',
    '}',
    '.toast.show { opacity:1; }',
    '</style>',
    '<button class="fab" id="fab" title="Add to ShopScout" aria-label="Add to ShopScout">ShopScout</button>',
    '<div class="toast" id="toast" role="status"></div>'
  ].join(''));

  (document.body || document.documentElement).appendChild(host);

  const fab   = shadow.getElementById('fab');
  const toast = shadow.getElementById('toast');

  function flashToast(text, kind /* 'success' | 'error' */) {
    toast.textContent = text;
    toast.className = 'toast show';
    fab.className = 'fab ' + kind;
    setTimeout(() => { toast.className = 'toast'; }, 1800);
    setTimeout(() => { fab.className = 'fab'; }, 1500);
  }

  fab.addEventListener('click', async () => {
    if (fab.classList.contains('busy')) return;
    fab.className = 'fab busy';
    try {
      const result = await chrome.runtime.sendMessage({ action: 'captureFromFab' });
      if (result && result.ok) {
        flashToast(result.listName ? 'Added to "' + result.listName + '"' : 'Added', 'success');
      } else {
        flashToast((result && result.error) || 'Could not capture', 'error');
      }
    } catch (err) {
      flashToast('Capture failed', 'error');
    }
  });

  /* React to live config changes (toggle off / per-host hide added) by
     removing the FAB without requiring a page reload. */
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[FAB_SETTINGS_KEY]) return;
    const cfg = changes[FAB_SETTINGS_KEY].newValue || { enabled: true, hiddenHosts: [] };
    if (!cfg.enabled || (cfg.hiddenHosts || []).includes(location.hostname)) {
      const el = document.getElementById(FAB_HOST_ID);
      if (el) el.remove();
    }
  });
}

(async function shopscoutFabMaybeRender() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', shopscoutFabMaybeRender);
    return;
  }
  try {
    if (await shopscoutFabShouldRender()) shopscoutFabBuild();
  } catch (err) { console.warn('ShopScout FAB init failed', err); }
})();

} // end guard
