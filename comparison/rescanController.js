/* =============================================================
   ShopScout — rescan controller
   Extracted from comparison.js as part of Task 7.5 (continued
   monolith split). Owns: rescanSingle, rescanSelectedProducts,
   rescanList (the multi-product orchestrator + cancel handle),
   plus the merge-and-report helpers that paint the rescan
   results modal.

   Public surface — ShopScoutComparison.rescanController:
     rescanSingle(idx, btnEl)        — rescan one product
     rescanSelectedProducts()        — rescan current selection
     rescanList(productIndexes)      — rescan many (or all)
     cancelActive()                  — fire the cancel handle if a
                                       run is active

   Module-local state:
     activeScanCancel — previously a top-level let in comparison.js.
     Moved here because only setScanActive (this module) writes it,
     and only the ribbon's "cancel-run" dispatcher reads it (now via
     cancelActive()).

   Cross-module references resolved at runtime via the global
   object: getSelectedProductIndexes, renderAll (comparison.js
   helpers — populated before any rescan callsite fires).
   ============================================================= */
(function initShopScoutRescanController(root) {
  const NS = (root.ShopScoutComparison = root.ShopScoutComparison || {});
  const SS = root.SS || {};
  const { esc, getProducts, saveProducts, toast, inferCategory,
          detectMissingAttributes, CATEGORY_RUBRICS } = SS;
  const chrome = root.browser || root.chrome;

  let activeScanCancel = null;

  function setTrustedHtml(target, html) {
    if (root.ShopScoutSanitize && typeof root.ShopScoutSanitize.setTrustedHtml === 'function') {
      root.ShopScoutSanitize.setTrustedHtml(target, html);
      return;
    }
    if (target) target.innerHTML = html == null ? '' : String(html);
  }

  /* === Begin extracted block (was comparison.js:3968-4307) === */

// --- Rescan single product ---
async function rescanSingle(idx, btnEl) {
  const products = await getProducts();
  const p = products[idx];
  if (!p) return;
  if (!p.url) { toast.show('No URL to rescan', 'error'); return; }

  if (btnEl) btnEl.classList.add('scanning');
  toast.show(`Rescanning "${(p.title || '').substring(0, 35)}..."`, 'loading');

  try {
    const resp = await chrome.runtime.sendMessage({ action: 'rescanProduct', url: p.url });
    toast.hide();

    if (!resp?.success || !resp.product) {
      toast.show(resp?.error || 'Rescan failed', 'error');
      if (btnEl) btnEl.classList.remove('scanning');
      return;
    }

    const changes = mergeProduct(p, resp.product);
    await saveProducts(products);
    await renderAll();

    // Show single-product result in the rescan modal
    const catKey = inferCategory(p);
    const rubric = catKey ? CATEGORY_RUBRICS[catKey] : null;
    const detection = catKey ? detectMissingAttributes(p, catKey) : null;
    const ca = { category: rubric?.label || catKey || 'Unknown', found: detection?.found || [], missing: detection?.missing || [] };

    const modal = document.getElementById('rescanModal');
    const resultsDiv = document.getElementById('rescanResults');

    let html = `<div class="rescan-summary">
      <div class="rescan-stat"><div class="stat-val stat-val--good">${changes.length}</div><div class="stat-label">Changes</div></div>
      <div class="rescan-stat"><div class="stat-val">${(p.rawSpecs || []).length}</div><div class="stat-label">Specs</div></div>
      <div class="rescan-stat"><div class="stat-val stat-val--good">${ca.found.length}</div><div class="stat-label">Attrs Found</div></div>
      <div class="rescan-stat"><div class="stat-val${ca.missing.length ? ' stat-val--warn' : ''}">${ca.missing.length}</div><div class="stat-label">Attrs Missing</div></div>
    </div>`;

    html += `<div style="font-weight:600;font-size:14px;margin-bottom:12px">${esc((p.title || 'Untitled').substring(0, 80))}</div>`;

    if (changes.length) {
      html += '<div class="rp-section-title">Changes Detected</div><div class="rp-changes">';
      for (const c of changes) {
        html += `<div class="rp-change">
          <span class="rp-change-label">${esc(c.label)}</span>
          ${c.oldVal ? `<span class="rp-change-old">${esc(c.oldVal)}</span> <span>&rarr;</span>` : ''}
          <span class="rp-change-new">${esc(c.newVal)}</span>
        </div>`;
      }
      html += '</div>';
    } else {
      html += '<div style="font-size:12px;color:var(--muted);margin-bottom:12px">No changes detected — data is up to date.</div>';
    }

    html += `<div class="rp-section-title">Category: ${esc(ca.category)}</div>`;
    if (ca.found.length || ca.missing.length) {
      html += '<div class="rp-factors">';
      for (const f of ca.found) html += `<span class="rp-factor rp-factor--found">${esc(f)}</span>`;
      for (const f of ca.missing) html += `<span class="rp-factor rp-factor--missing">${esc(f)}</span>`;
      html += '</div>';
      const pct = Math.round((ca.found.length / (ca.found.length + ca.missing.length)) * 100);
      html += `<div style="font-size:11px;color:var(--muted);margin-top:8px">Spec completeness: ${pct}% (${ca.found.length} found, ${ca.missing.length} missing)</div>`;
    }

    setTrustedHtml(resultsDiv, html);
    modal.classList.add('active');
    toast.show(changes.length ? `Updated ${changes.length} field(s)` : 'No changes found');
  } catch (e) {
    toast.hide();
    toast.show('Rescan failed: ' + e.message, 'error');
  }
  if (btnEl) btnEl.classList.remove('scanning');
}

// --- Rescan all ---
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function randomDelay(minMs, maxMs) {
  const span = Math.max(0, maxMs - minMs);
  return sleep(minMs + Math.floor(Math.random() * (span + 1)));
}

async function rescanSelectedProducts() {
  const products = await getProducts();
  const indexes = getSelectedProductIndexes(products);
  if (!indexes.length) { toast.show('No selected products', 'error'); return; }
  await rescanList(indexes);
}

function setScanActive(active, cancelFn = null) {
  activeScanCancel = active ? cancelFn : null;
  document.querySelectorAll('[data-command="cancel-run"]').forEach(btn => {
    btn.disabled = !active;
    btn.setAttribute('aria-disabled', active ? 'false' : 'true');
  });
}

async function rescanList(productIndexes) {
  const products = await getProducts();
  if (!products.length) { toast.show('No products to rescan', 'error'); return; }
  const targetIndexes = Array.isArray(productIndexes) && productIndexes.length
    ? productIndexes.filter(idx => products[idx])
    : products.map((_, idx) => idx);
  const withUrl = targetIndexes.filter(idx => products[idx]?.url);
  if (!withUrl.length) { toast.show('No products have URLs', 'error'); return; }
  const proceed = await ShopScoutUI.confirm(
    `Rescan ${withUrl.length} product(s)? This will re-visit each URL one at a time with short pauses between pages.\n\nThis may take a while for large lists.`,
    { title: 'Rescan products', okLabel: 'Rescan' }
  );
  if (!proceed) return;

  const modal = document.getElementById('rescanModal');
  const resultsDiv = document.getElementById('rescanResults');
  modal.classList.add('active');

  setTrustedHtml(resultsDiv, `<div class="rescan-progress">
    <div class="spinner"></div>
    <div class="progress-text" id="rescanProgressText">Preparing to scan...</div>
    <div class="progress-bar"><div class="progress-fill" id="rescanProgressFill" style="width:0%"></div></div>
    <button class="tb tb--danger" id="rescanCancelBtn" style="margin-top:12px">Cancel Rescan</button>
  </div>`);

  const results = [];
  const progressText = document.getElementById('rescanProgressText');
  const progressFill = document.getElementById('rescanProgressFill');
  const cancelBtn = document.getElementById('rescanCancelBtn');
  let cancelled = false;
  let scannedUrls = 0;
  const cancelCurrentScan = () => {
    cancelled = true;
    cancelBtn.disabled = true;
    progressText.textContent = 'Cancelling after the current product finishes...';
  };
  cancelBtn.addEventListener('click', cancelCurrentScan);
  setScanActive(true, cancelCurrentScan);

  try {
    for (let i = 0; i < targetIndexes.length; i++) {
      const productIndex = targetIndexes[i];
      if (cancelled) {
        results.push({ idx: productIndex, status: 'skipped', reason: 'Cancelled' });
        continue;
      }

      const p = products[productIndex];
      const shortName = (p.title || 'Untitled').substring(0, 40);
      const pct = Math.round(((i + 1) / targetIndexes.length) * 100);
      progressText.textContent = `Scanning ${i + 1} of ${targetIndexes.length}: ${shortName}...`;
      progressFill.style.width = pct + '%';

      if (!p.url) {
        results.push({ idx: productIndex, status: 'skipped', reason: 'No URL' });
        continue;
      }

      try {
        if (scannedUrls > 0) {
          progressText.textContent = `Pausing before ${i + 1} of ${targetIndexes.length}: ${shortName}...`;
          await randomDelay(3000, 6000);
        }
        scannedUrls++;
        progressText.textContent = `Scanning ${i + 1} of ${targetIndexes.length}: ${shortName}...`;
        const resp = await chrome.runtime.sendMessage({ action: 'rescanProduct', url: p.url });
        if (resp?.success && resp.product) {
          const changes = mergeProduct(p, resp.product);
          results.push({ idx: productIndex, status: changes.length ? 'updated' : 'nochange', changes, product: p });
        } else {
          results.push({ idx: productIndex, status: 'failed', reason: resp?.error || 'No data returned' });
        }
      } catch (e) {
        results.push({ idx: productIndex, status: 'failed', reason: e.message || 'Request failed' });
      }
    }

    await saveProducts(products);
    await renderAll();
    showRescanResults(products, results);
  } finally {
    setScanActive(false);
  }
}

function mergeProduct(existing, fresh) {
  const changes = [];
  existing.lastScannedAt = fresh.lastScannedAt || Date.now();
  if (fresh.reviewCount) fresh.reviewCount = normalizeReviewCount(fresh.reviewCount);
  const track = (field, label) => {
    const oldVal = existing[field] || '';
    const newVal = fresh[field] || '';
    if (newVal && newVal !== oldVal) {
      changes.push({ field, label, oldVal, newVal });
      existing[field] = newVal;
    }
  };

  track('newPrice', 'Price');
  track('usedPrice', 'Used Price');
  track('rating', 'Rating');
  track('reviewCount', 'Reviews');
  track('availability', 'Availability');
  track('shippingPrice', 'Shipping');
  track('sellerName', 'Seller');

  if (fresh.brand && !existing.brand) { track('brand', 'Brand'); }
  if (fresh.modelNumber && !existing.modelNumber) { track('modelNumber', 'Model'); }
  if (fresh.manufacturer && !existing.manufacturer) { track('manufacturer', 'Manufacturer'); }
  if (fresh.category && !existing.category) { existing.category = fresh.category; changes.push({ field: 'category', label: 'Category', oldVal: '', newVal: fresh.category }); }

  if (fresh.image && !existing.image) { existing.image = fresh.image; }
  if (fresh.imageUrls?.length && (!existing.imageUrls || fresh.imageUrls.length > existing.imageUrls.length)) { existing.imageUrls = fresh.imageUrls; }

  // Specs: accumulate — keep existing, add new
  const oldSpecCount = (existing.rawSpecs || []).length;
  if (fresh.rawSpecs?.length) {
    const existingKeys = new Set((existing.rawSpecs || []).map(s => s.key.toLowerCase()));
    const newSpecs = fresh.rawSpecs.filter(s => !existingKeys.has(s.key.toLowerCase()));
    if (newSpecs.length) {
      existing.rawSpecs = [...(existing.rawSpecs || []), ...newSpecs];
      changes.push({ field: 'rawSpecs', label: 'Specs', oldVal: `${oldSpecCount} specs`, newVal: `${existing.rawSpecs.length} specs (+${newSpecs.length} new)` });
    }
  }
  if (fresh.specs) {
    existing.specs = { ...(existing.specs || {}), ...fresh.specs };
  }

  // Bullets: take longer list
  if (fresh.bullets?.length && fresh.bullets.length > (existing.bullets || []).length) {
    const oldLen = (existing.bullets || []).length;
    existing.bullets = fresh.bullets;
    if (fresh.bullets.length > oldLen) {
      changes.push({ field: 'bullets', label: 'Bullets', oldVal: `${oldLen} items`, newVal: `${fresh.bullets.length} items` });
    }
  }

  // Description: take longer
  if (fresh.description && fresh.description.length > (existing.description || '').length) {
    existing.description = fresh.description;
  }

  existing.lastRescan = Date.now();
  return changes;
}

function showRescanResults(products, results) {
  const updated = results.filter(r => r.status === 'updated');
  const nochange = results.filter(r => r.status === 'nochange');
  const failed = results.filter(r => r.status === 'failed');
  const skipped = results.filter(r => r.status === 'skipped');

  // Category analysis for all products
  const catAnalysis = products.map(p => {
    const catKey = inferCategory(p);
    const rubric = catKey ? CATEGORY_RUBRICS[catKey] : null;
    const detection = catKey ? detectMissingAttributes(p, catKey) : null;
    return { category: rubric?.label || catKey || 'Unknown', categoryKey: catKey, found: detection?.found || [], missing: detection?.missing || [] };
  });

  const totalMissing = catAnalysis.reduce((sum, a) => sum + a.missing.length, 0);
  const totalFound = catAnalysis.reduce((sum, a) => sum + a.found.length, 0);

  let html = `<div class="rescan-summary">
    <div class="rescan-stat"><div class="stat-val">${products.length}</div><div class="stat-label">Scanned</div></div>
    <div class="rescan-stat"><div class="stat-val stat-val--good">${updated.length}</div><div class="stat-label">Updated</div></div>
    <div class="rescan-stat"><div class="stat-val${failed.length ? ' stat-val--warn' : ''}">${failed.length}</div><div class="stat-label">Failed</div></div>
    <div class="rescan-stat"><div class="stat-val${totalMissing ? ' stat-val--warn' : ' stat-val--good'}">${totalMissing}</div><div class="stat-label">Missing Attrs</div></div>
  </div>`;

  html += '<div style="max-height:50vh;overflow-y:auto">';

  for (const r of results) {
    const i = r.idx;
    const p = products[i];
    if (!p) continue;
    const ca = catAnalysis[i];
    const shortName = (p.title || 'Untitled').substring(0, 55);

    let badgeClass, badgeText;
    if (r.status === 'updated') { badgeClass = 'rp-badge--updated'; badgeText = `${r.changes.length} change(s)`; }
    else if (r.status === 'failed') { badgeClass = 'rp-badge--failed'; badgeText = 'Failed'; }
    else if (r.status === 'skipped') { badgeClass = 'rp-badge--failed'; badgeText = 'Skipped'; }
    else { badgeClass = 'rp-badge--nochange'; badgeText = 'No change'; }

    html += `<div class="rescan-product">
      <div class="rescan-product-header" data-idx="${i}">
        <span class="rp-arrow" id="rpArrow${i}">&#9654;</span>
        <span class="rp-name">${esc(shortName)}</span>
        <span class="rp-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="rescan-product-body" id="rpBody${i}">`;

    // Changes
    if (r.status === 'updated' && r.changes?.length) {
      html += '<div class="rp-changes">';
      html += '<div class="rp-section-title">Changes Detected</div>';
      for (const c of r.changes) {
        html += `<div class="rp-change">
          <span class="rp-change-label">${esc(c.label)}</span>
          ${c.oldVal ? `<span class="rp-change-old">${esc(c.oldVal)}</span> <span>&rarr;</span>` : ''}
          <span class="rp-change-new">${esc(c.newVal)}</span>
        </div>`;
      }
      html += '</div>';
    } else if (r.status === 'failed') {
      html += `<div style="color:var(--danger);font-size:12px;margin-bottom:8px">${esc(r.reason || 'Unknown error')}</div>`;
    }

    // Category & quality factors
    html += `<div class="rp-section-title">Category: ${esc(ca.category)}</div>`;
    if (ca.found.length || ca.missing.length) {
      html += '<div class="rp-factors">';
      for (const f of ca.found) html += `<span class="rp-factor rp-factor--found">${esc(f)}</span>`;
      for (const f of ca.missing) html += `<span class="rp-factor rp-factor--missing">${esc(f)}</span>`;
      html += '</div>';
      if (ca.found.length && ca.missing.length) {
        const pct = Math.round((ca.found.length / (ca.found.length + ca.missing.length)) * 100);
        html += `<div style="font-size:11px;color:var(--muted);margin-top:6px">Spec completeness: ${pct}% (${ca.found.length} found, ${ca.missing.length} missing)</div>`;
      }
    }

    html += '</div></div>';
  }

  html += '</div>';

  setTrustedHtml(document.getElementById('rescanResults'), html);

  // Accordion toggle
  document.getElementById('rescanResults').addEventListener('click', e => {
    const header = e.target.closest('.rescan-product-header');
    if (!header) return;
    const idx = header.dataset.idx;
    const body = document.getElementById('rpBody' + idx);
    const arrow = document.getElementById('rpArrow' + idx);
    if (body) {
      body.classList.toggle('open');
      arrow.classList.toggle('open');
    }
  });
}

  /* === End extracted block === */

  /* Returns true if a scan was running (and was cancelled), false
     otherwise. The ribbon's "cancel-run" dispatcher uses the boolean
     to decide whether to surface a "no scan running" toast. */
  function cancelActive() {
    if (!activeScanCancel) return false;
    activeScanCancel();
    return true;
  }

  NS.rescanController = {
    rescanSingle,
    rescanSelectedProducts,
    rescanList,
    cancelActive
  };

  /* Back-compat globals — comparison.js bindings still attach
     these as event handlers by bare name. */
  root.rescanSingle           = rescanSingle;
  root.rescanList             = rescanList;
  root.rescanSelectedProducts = rescanSelectedProducts;
})(globalThis);
