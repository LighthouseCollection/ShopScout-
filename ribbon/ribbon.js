/* =============================================================
   ShopScout — Office 365-conformed ribbon (JS behaviors)

   Commit 1 lands just the module skeleton + the `.rb-office-ribbon`
   opt-in class on the existing .ribbon-shell. Real behaviors land
   in later commits:
     Commit 2: Adaptive button size shrink (L -> M -> S)
     Commit 3: Split-button primitive
     Commit 4: Overflow / group-collapse for narrow viewports
     Commit 5: Contextual tabs infrastructure
   ============================================================= */
(function initShopScoutRibbon(root) {
  const NS = (root.ShopScoutRibbon = root.ShopScoutRibbon || {});

  /* Opt every existing ribbon-shell into the Office-conformed
     styles by adding the .rb-office-ribbon class. Runs on DOM
     ready — no cost after that. */
  function apply() {
    const doc = root.document;
    if (!doc) return;
    const shells = doc.querySelectorAll('.ribbon-shell:not(.rb-office-ribbon)');
    shells.forEach(shell => shell.classList.add('rb-office-ribbon'));
  }

  if (root.document?.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  Object.assign(NS, {
    apply,
    /* Version tag — bumped each commit so consumers can detect
       feature availability if they need to. */
    version: '1.0.0-commit-1'
  });
})(globalThis);
