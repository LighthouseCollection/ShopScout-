/* =============================================================
   ShopScout — product detail view (edit modal + detail page)
   Extracted from comparison.js as part of Task 7.5 (continued
   monolith split). Owns:
     - The Edit modal: openEditModal, switchEditTab,
       renderSpecTable, addSpecRow, updateImagePreview,
       renderImageGallery, renderReviewImages, collectImageUrls,
       collectSpecsFromEditor, saveEdit.
     - The AI render helpers used by the detail page:
       latestAiStage, renderReadableAiStage, renderAiOverview,
       renderCorrectionSummary, renderVerificationHtml,
       renderRisksComparisonHtml, buildDetailInfoTable,
       buildDetailTabsHtml, renderDetailAiProviderOptions.
     - The detail page: collectAllSpecRows, openProductDetail,
       closeProductDetail.

   Public surface — ShopScoutComparison.productDetailView:
     openEditModal(idx)
     saveEdit()
     openProductDetail(idx)
     closeProductDetail()

   Module state shared with comparison.js:
     editIndex   — exposed on globalThis by comparison.js so that
                   openEditModal and saveEdit can communicate.
     detailIndex — exposed on globalThis by comparison.js so that
                   the detail page can navigate prev/next and the
                   AI run modal can re-open the detail view.
   Cross-module references resolved at runtime via globalThis:
     renderAll, closeRowActionMenu, closeColMenu, getCorrectedValue,
     normalizedCorrectionField, normalizedSpecColumn,
     getCorrectedSpec, openColMenu, openAiOptionsModal, renderTable,
     rescanSingle, removeProduct (comparison.js / table modules /
     other extracted slices — all populated before any detail-view
     callsite fires).
   ============================================================= */
(function initShopScoutProductDetailView(root) {
  const NS = (root.ShopScoutComparison = root.ShopScoutComparison || {});
  const SS = root.SS || {};
  const { esc, escAttr, sanitizeUrl, sanitizeProductDescription,
          normalizeReviewCount, getProducts, saveProducts,
          toast } = SS;
  const chrome = root.browser || root.chrome;

  function setTrustedHtml(target, html) {
    if (root.ShopScoutSanitize && typeof root.ShopScoutSanitize.setTrustedHtml === 'function') {
      root.ShopScoutSanitize.setTrustedHtml(target, html);
      return;
    }
    if (target) target.innerHTML = html == null ? '' : String(html);
  }

  /* === Begin extracted block (was comparison.js:3145-3405) === */

// --- Edit modal ---
async function openEditModal(idx) {
  const products = await getProducts();
  const p = products[idx];
  if (!p) return;
  editIndex = idx;

  // General
  document.getElementById('editTitle').value = p.title || '';
  document.getElementById('editBrand').value = p.brand || '';
  document.getElementById('editManufacturer').value = p.manufacturer || '';
  document.getElementById('editSource').value = p.source || '';
  document.getElementById('editCategory').value = p.category || '';
  document.getElementById('editRating').value = p.rating || '';
  document.getElementById('editReviewCount').value = p.reviewCount || '';
  document.getElementById('editUrl').value = p.url || '';
  document.getElementById('editAvailability').value = p.availability || '';
  document.getElementById('editNotes').value = p.notes || '';

  // Pricing & Seller
  document.getElementById('editNewPrice').value = p.newPrice || '';
  document.getElementById('editUsedPrice').value = p.usedPrice || '';
  document.getElementById('editShippingPrice').value = p.shippingPrice || '';
  document.getElementById('editSellerName').value = p.sellerName || '';

  // Identifiers
  document.getElementById('editModel').value = p.modelNumber || '';
  document.getElementById('editSku').value = p.sku || '';
  document.getElementById('editAsin').value = p.asin || '';
  document.getElementById('editUpc').value = p.upc || '';
  document.getElementById('editMpn').value = p.mpn || '';
  document.getElementById('editGtin').value = p.gtin || '';

  // Specs & Features
  document.getElementById('editBullets').value = (p.bullets || []).join('\n');
  document.getElementById('editDescription').value = p.description || '';
  renderSpecTable(p.rawSpecs || []);

  // Media
  document.getElementById('editImage').value = p.image || '';
  updateImagePreview();
  renderImageGallery(p.imageUrls || []);
  renderReviewImages(p.reviewImages || []);

  // Reset to first tab
  switchEditTab('general');
  document.getElementById('editModal').classList.add('active');
}

function switchEditTab(tabName) {
  document.querySelectorAll('.edit-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  document.querySelectorAll('.edit-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === tabName));
}

function renderSpecTable(specs) {
  const container = document.getElementById('editSpecTable');
  if (!specs.length) {
    setTrustedHtml(container, '<div class="spec-empty">No specifications captured. Click "+ Add Spec" to add one.</div>');
    return;
  }
  setTrustedHtml(container, specs.map((s, i) =>
    `<div class="spec-row" data-si="${i}">
      <input class="spec-key" value="${esc(s.key)}" placeholder="Key" data-field="key">
      <input class="spec-val" value="${esc(s.value)}" placeholder="Value" data-field="value">
      <button class="spec-del" title="Remove">&times;</button>
    </div>`
  ).join(''));
}

function addSpecRow() {
  const container = document.getElementById('editSpecTable');
  const empty = container.querySelector('.spec-empty');
  if (empty) empty.remove();
  const idx = container.querySelectorAll('.spec-row').length;
  const row = document.createElement('div');
  row.className = 'spec-row';
  row.dataset.si = idx;
  setTrustedHtml(row, `<input class="spec-key" value="" placeholder="Key" data-field="key">
    <input class="spec-val" value="" placeholder="Value" data-field="value">
    <button class="spec-del" title="Remove">&times;</button>`);
  container.appendChild(row);
  row.querySelector('.spec-key').focus();
}

function updateImagePreview() {
  const url = document.getElementById('editImage').value.trim();
  const container = document.getElementById('editImagePreview');
  const safeUrl = sanitizeUrl(url);
  setTrustedHtml(container, safeUrl ? `<img src="${escAttr(safeUrl)}" alt="Preview" data-hide-on-error="1">` : '');
}

function renderImageGallery(urls) {
  const container = document.getElementById('editImageGallery');
  const safeUrls = urls.map(u => sanitizeUrl(u)).filter(Boolean);
  if (!safeUrls.length) { setTrustedHtml(container, '<span style="font-size:12px;color:var(--muted)">No additional images</span>'); return; }
  setTrustedHtml(container, safeUrls.map(u =>
    `<div class="img-gallery-item">
      <img src="${escAttr(u)}" alt="" title="${escAttr(u)}" data-hide-parent-on-error="1">
      <button class="img-del" data-url="${escAttr(u)}" title="Remove">&times;</button>
    </div>`
  ).join(''));
}

function renderReviewImages(urls) {
  const container = document.getElementById('editReviewImages');
  const safeUrls = urls.map(u => sanitizeUrl(u)).filter(Boolean);
  if (!safeUrls.length) { setTrustedHtml(container, '<span style="font-size:12px;color:var(--muted)">No review photos found</span>'); return; }
  setTrustedHtml(container, safeUrls.map(u =>
    `<div class="img-gallery-item">
      <img src="${escAttr(u)}" alt="" title="${escAttr(u)}" data-hide-parent-on-error="1">
    </div>`
  ).join(''));
}

function collectImageUrls() {
  return [...document.querySelectorAll('#editImageGallery .img-gallery-item img')]
    .map(img => img.getAttribute('title')).filter(Boolean);
}

function collectSpecsFromEditor() {
  const rows = document.querySelectorAll('#editSpecTable .spec-row');
  const specs = [];
  rows.forEach(row => {
    const key = row.querySelector('.spec-key').value.trim();
    const value = row.querySelector('.spec-val').value.trim();
    if (key && value) specs.push({ key, value });
  });
  return specs;
}

async function saveEdit() {
  const products = await getProducts();
  if (editIndex < 0 || editIndex >= products.length) return;
  const p = products[editIndex];

  // General
  p.title = document.getElementById('editTitle').value.trim();
  p.brand = document.getElementById('editBrand').value.trim();
  p.manufacturer = document.getElementById('editManufacturer').value.trim();
  p.category = document.getElementById('editCategory').value.trim();
  p.rating = document.getElementById('editRating').value.trim();
  p.reviewCount = document.getElementById('editReviewCount').value.trim();
  p.url = document.getElementById('editUrl').value.trim();
  p.availability = document.getElementById('editAvailability').value.trim();
  p.notes = document.getElementById('editNotes').value.trim();

  // Pricing & Seller
  p.newPrice = document.getElementById('editNewPrice').value.trim();
  p.usedPrice = document.getElementById('editUsedPrice').value.trim();
  p.shippingPrice = document.getElementById('editShippingPrice').value.trim();
  p.sellerName = document.getElementById('editSellerName').value.trim();

  // Identifiers
  p.modelNumber = document.getElementById('editModel').value.trim();
  p.sku = document.getElementById('editSku').value.trim();
  p.asin = document.getElementById('editAsin').value.trim();
  p.upc = document.getElementById('editUpc').value.trim();
  p.mpn = document.getElementById('editMpn').value.trim();
  p.gtin = document.getElementById('editGtin').value.trim();

  // Specs & Features
  const bulletsText = document.getElementById('editBullets').value.trim();
  p.bullets = bulletsText ? bulletsText.split('\n').map(b => b.trim()).filter(Boolean) : [];
  p.description = document.getElementById('editDescription').value.trim();
  p.rawSpecs = collectSpecsFromEditor();

  // Media
  p.image = document.getElementById('editImage').value.trim();
  p.imageUrls = collectImageUrls();

  await saveProducts(products);
  document.getElementById('editModal').classList.remove('active');
  toast.show('Product updated');
  if (detailIndex >= 0 && document.getElementById('productDetail').classList.contains('active')) {
    openProductDetail(detailIndex);
  } else {
    await renderAll();
  }
}

// --- Product Detail Page ---

function latestAiStage(ai, stageName) {
  return (ai?.stages || []).find(stage => stage.stage === stageName) || null;
}

function renderReadableAiStage(ai, stageName, fallback) {
  const stage = latestAiStage(ai, stageName);
  if (!stage) return `<div class="ai-empty">${esc(fallback || 'No AI output for this stage yet.')}</div>`;
  if (stage.status === 'failed' || stage.status === 'skipped') {
    return `<div class="ai-empty">${esc(stage.status.toUpperCase())}: ${esc(stage.error || 'No output')}</div>`;
  }
  if (globalThis.ShopScoutAIUI) return ShopScoutAIUI.renderRichText(stage.responseText || 'No text returned');
  return `<div class="ai-text">${esc(stage.responseText || 'No text returned')}</div>`;
}

function renderAiOverview(ai) {
  if (!ai) return '<div class="ai-empty">No connected-AI analysis has been run for this product yet.</div>';
  const finalStage = latestAiStage(ai, 'comparison') || ai.stages?.find(stage => stage.parsedJson?.quick_verdict);
  const verdict = finalStage?.parsedJson?.quick_verdict;
  if (verdict) {
    const rows = Object.entries(verdict).map(([key, value]) => `<tr><td>${esc(key.replace(/_/g, ' '))}</td><td>${esc(value?.badge || '')}</td><td>${esc(value?.reason || '')}</td><td>${esc(value?.confidence || '')}</td></tr>`).join('');
    return `<table class="ai-event-table"><thead><tr><th>Verdict</th><th>Badge</th><th>Reason</th><th>Confidence</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  return renderReadableAiStage(ai, 'comparison', 'AI run completed. Run comparison to see a decision summary.');
}

function renderCorrectionSummary(ai) {
  return globalThis.ShopScoutAIUI
    ? ShopScoutAIUI.renderCorrectionsHtml(ai)
    : '<div class="ai-empty">Correction display is unavailable.</div>';
}

function renderVerificationHtml(product) {
  const ai = product.aiAnalysis;
  return `<div class="detail-section"><h3>Corrections</h3>${renderCorrectionSummary(ai)}</div>
    <div class="detail-section"><h3>Verification</h3>${renderReadableAiStage(ai, 'verification', 'Run Analyze to verify listing claims against official or authoritative sources.')}</div>
    <div class="detail-section"><h3>Corrected Specs</h3>${renderReadableAiStage(ai, 'enrichment', 'Run Analyze to fill or correct missing specs.')}</div>`;
}

function renderRisksComparisonHtml(product) {
  const ai = product.aiAnalysis;
  return `<div class="detail-section"><h3>Decision Summary</h3>${renderAiOverview(ai)}</div>
    <div class="detail-section"><h3>Risks &amp; Comparison</h3>${renderReadableAiStage(ai, 'comparison', 'Run Analyze to build risks, rankings, and recommendations.')}</div>`;
}

function buildDetailInfoTable(items) {
  return `<table class="detail-info-table"><tbody>${items.map(item => `
    <tr>
      <th>${esc(item.label)}</th>
      <td>${item.html || esc(item.value || '-')}</td>
    </tr>`).join('')}</tbody></table>`;
}

function buildDetailTabsHtml(tabs) {
  return `<div class="detail-tabs" id="detailTabs">
    <div class="detail-tab-bar">${tabs.map((tab, i) => `<button class="detail-tab${i === 0 ? ' active' : ''}" data-detail-tab="${escAttr(tab.id)}">${esc(tab.label)}</button>`).join('')}</div>
    ${tabs.map((tab, i) => `<div class="detail-pane${i === 0 ? ' active' : ''}" data-detail-pane="${escAttr(tab.id)}">${tab.html}</div>`).join('')}
  </div>`;
}

async function renderDetailAiProviderOptions() {
  const select = document.getElementById('detailAiProvider');
  if (!select) return;
  let options = [{ id: 'auto', label: 'Auto pipeline' }];
  try {
    if (globalThis.ShopScoutAI) {
      const stored = await chrome.storage.local.get(ShopScoutAI.AI_STORAGE_KEY);
      const settings = ShopScoutAI.mergeSettings(stored[ShopScoutAI.AI_STORAGE_KEY]);
      options = options.concat(
        ShopScoutAI.configuredProviders(settings)
          .filter(provider => provider.adapter !== 'manual')
          .map(provider => ({ id: provider.id, label: provider.shortName || provider.name }))
      );
    }
  } catch {}
  const current = select.value || 'auto';
  setTrustedHtml(select, options.map(option => `<option value="${escAttr(option.id)}">${esc(option.label)}</option>`).join(''));
  select.value = options.some(option => option.id === current) ? current : 'auto';
}

  /* === Begin extracted block (was comparison.js:3460-3794) === */

function collectAllSpecRows(p) {
  const out = [];
  const seen = new Map();
  function push(key, value, source) {
    const k = String(key || '').trim();
    const v = String(value == null ? '' : value).trim();
    if (!k || !v) return;
    const lk = k.toLowerCase();
    const prev = seen.get(lk);
    if (prev != null) {
      /* Replace previous only if it had no source and this one does. */
      if (!out[prev].source && source) out[prev].source = source;
      return;
    }
    seen.set(lk, out.length);
    out.push({ key: k, value: v, source: source || '' });
  }
  if (Array.isArray(p.rawSpecs)) {
    for (const s of p.rawSpecs) push(s.key, s.value, s.source);
  }
  if (p.specs && typeof p.specs === 'object') {
    for (const [k, v] of Object.entries(p.specs)) push(k, v);
  }
  if (p._spec && p._spec.specs) {
    for (const [k, entry] of Object.entries(p._spec.specs)) {
      push(entry.rawKey || k, entry.canonicalValue || entry.rawValue, entry.source);
    }
  }
  if (p._spec && p._spec.itemDetails) {
    for (const [k, entry] of Object.entries(p._spec.itemDetails)) {
      push(entry.rawKey || k, entry.canonicalValue || entry.rawValue, entry.source);
    }
  }
  return out;
}

async function openProductDetail(idx) {
  const products = await getProducts();
  const p = products[idx];
  if (!p) return;
  detailIndex = idx;
  await renderDetailAiProviderOptions();

  // Update nav position indicator and button states
  const totalProducts = products.length;
  document.getElementById('detailPos').textContent = `${idx + 1} of ${totalProducts}`;
  document.getElementById('detailPrev').disabled = (idx <= 0);
  document.getElementById('detailNext').disabled = (idx >= totalProducts - 1);

  const detailPage = document.getElementById('productDetail');
  const content = document.getElementById('detailContent');

  const allProductImgs = [p.image, ...(p.imageUrls || [])].map(u => sanitizeUrl(u)).filter(Boolean);
  const heroUrl = sanitizeUrl(p.image);
  const heroImg = heroUrl ? `<img src="${escAttr(heroUrl)}" alt="" id="detailHeroImg" style="cursor:pointer">` : '<div class="no-img">No Image</div>';
  const reviewCountText = normalizeReviewCount(p.reviewCount);

  let metaItems = '';
  const metaFields = [
    { label: 'Brand', field: 'brand' },
    { label: 'Manufacturer', field: 'manufacturer' },
    { label: 'Listing Title', value: p.listingTitle && p.listingTitle !== p.title ? p.listingTitle : '' },
    { label: 'Source', value: p.source, link: p.url },
    { label: 'Category', field: 'category' },
    { label: 'Rating', field: 'rating', suffix: reviewCountText ? ` (${reviewCountText} reviews)` : '' },
    { label: 'Availability', field: 'availability' },
    { label: 'Model Name', field: 'modelName' },
    { label: 'Model', field: 'modelNumber' },
    { label: 'SKU', field: 'sku' },
    { label: 'ASIN', field: 'asin' },
    { label: 'UPC', field: 'upc' },
    { label: 'MPN', field: 'mpn' },
    { label: 'GTIN', field: 'gtin' },
    { label: 'Seller', field: 'sellerName' },
    { label: 'Shipping', field: 'shippingPrice' },
  ];
  for (const m of metaFields) {
    const value = m.field ? getCorrectedValue(p, m.field) : m.value;
    if (!value) continue;
    const link = sanitizeUrl(m.link);
    const val = link
      ? `<a href="${escAttr(link)}" target="_blank" rel="noopener">${esc(value)}</a>`
      : (m.field ? renderCorrectedField(p, m.field) : esc(value));
    const suffix = m.suffix ? esc(m.suffix) : '';
    metaItems += `<div class="detail-meta-item"><div class="dm-label">${esc(m.label)}</div><div class="dm-value">${val}${suffix}</div></div>`;
  }

  let bulletsHtml = '';
  if (p.bullets && p.bullets.length) {
    bulletsHtml = `<div class="detail-section"><h3>Features</h3><ul class="detail-bullets">${p.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>`;
  }

  let descHtml = '';
  const cleanDescription = sanitizeProductDescription ? sanitizeProductDescription(p.description, p.source) : (p.description || '');
  if (cleanDescription) {
    descHtml = `<div class="detail-section"><h3>Description</h3><div class="detail-desc">${esc(cleanDescription)}</div></div>`;
  }

  /* Build a unified spec list from every available source:
     (a) p.rawSpecs[] — the legacy [{key,value,source?}] list
     (b) p.specs{}   — the legacy canonicalKey → value dict (fills gaps)
     (c) p._spec.specs / _spec.itemDetails — the new ProductSpec dicts
         (preserves rawKey + rawValue so what's shown matches the page)
     We dedup by lowercased key. */
  let specsHtml = '';
  const specRows = collectAllSpecRows(p);
  if (specRows.length) {
    specsHtml = `<div class="detail-section"><h3>Specifications <span class="ai-muted" style="font-weight:400;font-size:12px">(${specRows.length})</span></h3>`
      + `<table class="detail-spec-table">`
      + specRows.map(s => {
          const sourcePill = s.source ? `<span class="ai-muted" style="font-size:11px;margin-left:8px">${esc(String(s.source))}</span>` : '';
          return `<tr><td>${esc(s.key)}${sourcePill}</td><td>${renderCorrectedSpecValue(p, s.key, s.value)}</td></tr>`;
        }).join('')
      + `</table></div>`;
  }

  /* Capture diagnostics — only shown when the new pipeline ran (the trace
     is attached as p._pipelineTrace). Lets the user see WHY a missing
     spec wasn't picked up (selector matched nothing, miner found nothing,
     etc.) instead of guessing. */
  let traceHtml = '';
  const tr = p._pipelineTrace || (p._spec && p._spec.source && p._spec.source.pipeline);
  if (tr) {
    traceHtml = `<div class="detail-section"><h3>Capture trace</h3>`
      + `<div class="ai-muted" style="font-size:12px;line-height:1.7">`
      + `marketplace=<b>${esc(tr.marketplace || '?')}</b> · `
      + `structuredSignals=${tr.structuredSignals || 0} · `
      + `adapter=${tr.adapter || 0} · `
      + `generic=${tr.generic || 0} · `
      + `miner=${tr.miner || 0} · `
      + `specs=${tr.specCount || 0} · `
      + `itemDetails=${tr.itemDetailCount || 0} · `
      + `features=${tr.featureCount || 0} · `
      + `${tr.totalMs || 0}ms`
      + `</div></div>`;
  }

  const isAmazon = /amazon\./i.test(p.url || '');
  const isShein = /shein\./i.test(p.url || '');
  const productImgList = (p.imageUrls || []).map(u => sanitizeUrl(u)).filter(Boolean);
  const reviewImgList = (p.reviewImages || []).map(u => sanitizeUrl(u)).filter(Boolean);
  const hasAnyImages = productImgList.length > 0 || reviewImgList.length > 0;

  let imagesHtml = `<div class="detail-section"><h3>Images</h3>`;
  if (productImgList.length) {
    imagesHtml += `<div class="image-group">
      <div class="image-group-title">Product listing images <span class="product-pill">${productImgList.length}</span></div>
      <div class="detail-gallery" id="detailProductGallery">`;
    imagesHtml += productImgList.map(u =>
      `<div class="img-gallery-item"><img src="${escAttr(u)}" alt="" title="${escAttr(u)}" data-hide-parent-on-error="1" style="cursor:pointer"><span class="img-label img-label-product">Product</span></div>`
    ).join('');
    imagesHtml += `</div></div>`;
  }
  imagesHtml += `<div class="image-group">
    <div class="image-group-title">User review photos <span class="review-pill">${reviewImgList.length}</span></div>
    <div class="detail-gallery" id="detailReviewGallery">`;
  if (reviewImgList.length) {
    imagesHtml += reviewImgList.map(u =>
      `<div class="img-gallery-item"><img src="${escAttr(u)}" alt="" title="${escAttr(u)}" data-hide-parent-on-error="1" style="cursor:pointer"><span class="img-label img-label-review">Review</span></div>`
    ).join('');
  } else {
    imagesHtml += `<span style="font-size:12px;color:var(--muted)">No user review photos saved</span>`;
  }
  imagesHtml += `</div></div>`;
  if (!hasAnyImages) {
    imagesHtml += `<div style="font-size:12px;color:var(--muted);margin-top:10px">No product listing images saved</div>`;
  }
  if (isAmazon || isShein) {
    const siteName = isAmazon ? 'Amazon' : 'SHEIN';
    imagesHtml += `<button id="fetchReviewPhotosBtn" style="margin-top:10px;padding:8px 16px;border:1px solid var(--primary);border-radius:var(--radius-sm);background:var(--primary-light);color:var(--primary);font-size:12px;font-weight:600;cursor:pointer">Fetch Review Photos from ${siteName}</button>`;
  }
  imagesHtml += `</div>`;

  const productHeaderHtml = `
    <div class="detail-hero">
      <div class="detail-hero-img">${heroImg}</div>
      <div class="detail-hero-info">
        <h1>${renderCorrectedField(p, 'title', 'Untitled')}</h1>
        ${getCorrectedValue(p, 'newPrice') ? `<div class="detail-price">${renderCorrectedField(p, 'newPrice')}</div>` : ''}
        ${getCorrectedValue(p, 'usedPrice') ? `<div class="detail-used">Used: ${renderCorrectedField(p, 'usedPrice')}</div>` : ''}
        <div class="detail-meta-grid">${metaItems}</div>
      </div>
    </div>`;

  const overviewHtml = `
    <div class="detail-notes">
      <label>Notes</label>
      <textarea id="detailNotesInput" placeholder="Add your personal notes about this product...">${esc(p.notes || '')}</textarea>
      <button class="note-save" id="detailNoteSave">Save Note</button>
    </div>`;

  const pricingHtml = buildDetailInfoTable([
    { label: 'New Price', html: renderCorrectedField(p, 'newPrice', '-') },
    { label: 'Used Price', html: renderCorrectedField(p, 'usedPrice', '-') },
    { label: 'Shipping', html: renderCorrectedField(p, 'shippingPrice', '-') },
    { label: 'Availability', html: renderCorrectedField(p, 'availability', '-') },
    { label: 'Seller', html: renderCorrectedField(p, 'sellerName', '-') },
    { label: 'Source', html: p.source ? (sanitizeUrl(p.url) ? `<a href="${escAttr(sanitizeUrl(p.url))}" target="_blank" rel="noopener">${esc(p.source)}</a>` : esc(p.source)) : '-' }
  ]);

  /* Brand and Manufacturer are usually the same for consumer products
     (Dremel/Dremel, Sony/Sony). When they match, show only Brand —
     that's the label shoppers recognize. Show Manufacturer separately
     only when they actually differ (private-label, white-label cases). */
  const brandVal = String(getCorrectedValue(p, 'brand') || '').trim();
  const mfrVal   = String(getCorrectedValue(p, 'manufacturer') || '').trim();
  const showMfr  = mfrVal && mfrVal.toLowerCase() !== brandVal.toLowerCase();
  const identifierRows = [
    { label: 'Brand', html: renderCorrectedField(p, 'brand', '-') }
  ];
  if (showMfr) identifierRows.push({ label: 'Manufacturer', html: renderCorrectedField(p, 'manufacturer', '-') });
  identifierRows.push(
    { label: 'Category', html: renderCorrectedField(p, 'category', '-') },
    { label: 'Model Name', html: renderCorrectedField(p, 'modelName', '-') },
    { label: 'Model Number', html: renderCorrectedField(p, 'modelNumber', '-') },
    { label: 'SKU', html: renderCorrectedField(p, 'sku', '-') },
    { label: 'ASIN', html: renderCorrectedField(p, 'asin', '-') },
    { label: 'UPC', html: renderCorrectedField(p, 'upc', '-') },
    { label: 'MPN', html: renderCorrectedField(p, 'mpn', '-') },
    { label: 'GTIN', html: renderCorrectedField(p, 'gtin', '-') }
  );
  const identifiersHtml = buildDetailInfoTable(identifierRows);

  const specsFeaturesHtml = `${bulletsHtml || '<div class="ai-empty">No feature bullets captured.</div>'}
    ${descHtml || '<div class="ai-empty">No description captured.</div>'}
    ${specsHtml || '<div class="ai-empty">No specifications captured.</div>'}
    ${traceHtml}`;

  setTrustedHtml(content, `${productHeaderHtml}${buildDetailTabsHtml([
    { id: 'general', label: 'General', html: overviewHtml },
    { id: 'pricing', label: 'Pricing & Seller', html: pricingHtml },
    { id: 'identifiers', label: 'Identifiers', html: identifiersHtml },
    { id: 'specs', label: 'Specs & Features', html: specsFeaturesHtml },
    { id: 'media', label: 'Media', html: imagesHtml },
    { id: 'verification', label: 'Verification', html: renderVerificationHtml(p) },
    { id: 'risks', label: 'Risks & Comparison', html: renderRisksComparisonHtml(p) }
  ])}`);

  document.querySelector('.ribbon-shell').style.display = '';
  document.querySelector('.url-bar')?.style && (document.getElementById('urlBar').style.display = 'none');
  document.getElementById('filterBar').style.display = 'none';
  document.querySelector('.controls').style.display = 'none';
  setTrustedHtml(document.getElementById('content'), '');
  document.getElementById('content').style.display = '';
  detailPage.classList.add('active');
  detailPage.style.display = 'block';
  window.scrollTo(0, 0);

  const heroImgEl = document.getElementById('detailHeroImg');
  if (heroImgEl && allProductImgs.length > 0) {
    heroImgEl.addEventListener('click', () => {
      window._openLightbox(allProductImgs, 0);
    });
  }

  const detailTabs = document.getElementById('detailTabs');
  if (detailTabs) {
    detailTabs.addEventListener('click', e => {
      const tab = e.target.closest('.detail-tab');
      if (!tab) return;
      detailTabs.querySelectorAll('.detail-tab').forEach(btn => btn.classList.toggle('active', btn === tab));
      detailTabs.querySelectorAll('.detail-pane').forEach(pane => pane.classList.toggle('active', pane.dataset.detailPane === tab.dataset.detailTab));
    });
  }

  document.getElementById('detailNoteSave').addEventListener('click', async () => {
    const prods = await getProducts();
    if (detailIndex >= 0 && detailIndex < prods.length) {
      prods[detailIndex].notes = document.getElementById('detailNotesInput').value.trim();
      await saveProducts(prods);
      toast.show('Note saved');
    }
  });

  const fetchBtn = document.getElementById('fetchReviewPhotosBtn');
  if (fetchBtn) {
    fetchBtn.addEventListener('click', async () => {
      fetchBtn.disabled = true;
      fetchBtn.textContent = 'Fetching review photos...';
      let disclaimer = document.getElementById('fetchDisclaimer');
      if (!disclaimer) {
        disclaimer = document.createElement('p');
        disclaimer.id = 'fetchDisclaimer';
        disclaimer.style.cssText = 'font-style:italic;font-size:11px;color:var(--muted);margin-top:6px';
        fetchBtn.parentElement.insertBefore(disclaimer, fetchBtn.nextSibling);
      }
      disclaimer.textContent = 'Scanning the page for review photos — all processing happens locally in your browser.';
      try {
        const result = await chrome.runtime.sendMessage({ action: 'fetchReviewPhotos', url: p.url });
        if (result && result.success && result.photos && result.photos.length > 0) {
          const prods = await getProducts();
          if (detailIndex >= 0 && detailIndex < prods.length) {
            prods[detailIndex].reviewImages = result.photos;
            await saveProducts(prods);
            const gallery = document.getElementById('detailReviewGallery');
            const reviewHtml = result.photos.map(u => sanitizeUrl(u)).filter(Boolean).map(u =>
              `<div class="img-gallery-item"><img src="${escAttr(u)}" alt="" title="${escAttr(u)}" data-hide-parent-on-error="1" style="cursor:pointer"><span class="img-label img-label-review">Review</span></div>`
            ).join('');
            setTrustedHtml(gallery, reviewHtml);
            const reviewCountPill = gallery.closest('.image-group')?.querySelector('.review-pill');
            if (reviewCountPill) reviewCountPill.textContent = String(result.photos.length);
            fetchBtn.textContent = `Done! ${result.photos.length} photos fetched`;
            fetchBtn.style.borderColor = 'var(--success)';
            fetchBtn.style.color = 'var(--success)';
            fetchBtn.style.background = 'var(--success-light)';
            if (disclaimer) disclaimer.textContent = '';
            toast.show(`${result.photos.length} review photos fetched`);
          }
        } else {
          fetchBtn.textContent = 'No photos found — ' + (result?.error || 'try again');
          fetchBtn.style.borderColor = 'var(--danger)';
          fetchBtn.style.color = 'var(--danger)';
          fetchBtn.disabled = false;
          if (disclaimer) disclaimer.textContent = '';
        }
      } catch (e) {
        fetchBtn.textContent = 'Error: ' + e.message;
        fetchBtn.disabled = false;
        if (disclaimer) disclaimer.textContent = '';
      }
    });
  }
}

function closeProductDetail() {
  document.getElementById('productDetail').classList.remove('active');
  document.getElementById('productDetail').style.display = 'none';
  document.querySelector('.ribbon-shell').style.display = '';
  document.getElementById('urlBar').style.display = '';
  document.getElementById('filterBar').style.display = '';
  document.querySelector('.controls').style.display = '';
  document.getElementById('content').style.display = '';
  detailIndex = -1;
  renderAll();
}

  /* === End extracted blocks === */

  NS.productDetailView = {
    openEditModal,
    saveEdit,
    openProductDetail,
    closeProductDetail
  };

  /* Back-compat globals — comparison.js bindings, the detail page's
     prev/next nav, and the row-action menu in table/rowActionsMenu.js
     all call these by bare name. switchEditTab / addSpecRow /
     updateImagePreview are wired as event handlers in
     comparison.js's bindEvents and must be reachable when those
     addEventListener calls run. */
  root.openEditModal     = openEditModal;
  root.saveEdit          = saveEdit;
  root.openProductDetail = openProductDetail;
  root.closeProductDetail = closeProductDetail;
  root.switchEditTab     = switchEditTab;
  root.addSpecRow        = addSpecRow;
  root.updateImagePreview = updateImagePreview;
})(globalThis);
