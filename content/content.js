/* =============================================================
   ShopScout — Content script extraction entry point
   Wires the layered extraction pipeline to the runtime message
   bus. Handles `action: 'extractV2'` for callers that need the
   structured extraction pipeline and legacy-flat compatibility shape.
   ============================================================= */
(function initContentEntry(root) {
  /* Guard against double injection. */
  if (root.__SSExtractEntryLoaded) return;
  root.__SSExtractEntryLoaded = true;

  const chrome = root.browser || root.chrome;
  if (!chrome || !chrome.runtime || !chrome.runtime.onMessage) return;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.action !== 'extractV2') return;
    Promise.resolve()
      .then(() => root.SSExtract && root.SSExtract.extractProduct
        ? root.SSExtract.extractProduct({ url: location.href })
        : null)
      .then(result => {
        if (!result) { sendResponse({ ok: false, error: 'pipeline-unavailable' }); return; }
        const legacy = root.SSExtract && root.SSExtract.toLegacyFlatProduct
          ? root.SSExtract.toLegacyFlatProduct(result.spec)
          : null;
        sendResponse({
          ok: true,
          spec: result.spec,
          legacy,
          trace: result.trace
        });
      })
      .catch(err => sendResponse({ ok: false, error: String(err && err.message || err) }));
    return true; // async response
  });

  /* Expose the pipeline on the page for the FAB and for ad-hoc
     debugging from the devtools console. */
  if (root.SSExtract && root.SSExtract.extractProduct) {
    root.shopscoutExtractV2 = () => root.SSExtract.extractProduct({ url: location.href });
  }
})(globalThis);
