var chrome = globalThis.browser || globalThis.chrome;

const { getData, saveData, getProducts, saveProducts, esc, escAttr, escXml, sanitizeUrl, sanitizeProductDescription, parsePrice, normalizeReviewCount, formatRatingDisplay, normalizeSpecKeyLabel, normalizeSpecValue, normalizeProductSpecs, getCategoryComparisonSpecKeys, buildCsv, safeFilename, downloadFile, buildAIText, buildPrompt, inferCategory, detectMissingAttributes, CATEGORY_RUBRICS, buildExportHtml, parseImport, toast } = SS;

function setTrustedHtml(target, html) {
  if (globalThis.ShopScoutSanitize?.setTrustedHtml) {
    globalThis.ShopScoutSanitize.setTrustedHtml(target, html);
    return;
  }
  if (target) target.innerHTML = html == null ? '' : String(html);
}

/* Legacy product-view state vars (currentView, tableSortCol/Asc,
   compactMode, gridlinesEnabled, selectedOnlyFilter, notedOnlyFilter,
   groupBySource, groupByField, groupsCollapsed) were retired with the
   hand-rolled cards/table renderers in Task 8. The active grid layer
   now owns sort, filter, group, and visual density from #productGrid. */
/* editIndex / detailIndex are shared with comparison/productDetailView.js
   (the edit modal and detail page live there now). Both stay on
   globalThis so the extracted module can read and assign them without
   a load-order race. */
globalThis.editIndex = -1;
globalThis.detailIndex = -1;
let listModalMode = 'new';
let activeAiMonitorState = null;
let activeAiMonitorClientRunId = '';
let pendingAiRunOptions = null;
let aiRunInProgress = false;
let selectedAiUsageProviderId = 'auto';
let activeInlineEdit = null;
const selectedProductIds = new Set();
let renderedProductLocations = new WeakMap();

const SEARCH_FIELD_DEFINITIONS = [
  { id: 'title', label: 'Titles and names' },
  { id: 'identity', label: 'Identifiers' },
  { id: 'pricing', label: 'Pricing and ratings' },
  { id: 'specs', label: 'Specs and features' },
  { id: 'notes', label: 'Notes and descriptions' }
];
const activeSearchFields = new Set(SEARCH_FIELD_DEFINITIONS.map(field => field.id));

const GROUP_FIELDS = [
  { id: 'listName', label: 'List' },
  { id: 'source', label: 'Source' },
  { id: 'brand', label: 'Brand' },
  { id: 'manufacturer', label: 'Manufacturer' },
  { id: 'category', label: 'Category' },
  { id: 'sellerName', label: 'Seller' },
  { id: 'modelName', label: 'Model name' },
  { id: 'modelNumber', label: 'Model' },
  { id: 'sku', label: 'SKU' },
  { id: 'asin', label: 'ASIN' },
  { id: 'upc', label: 'UPC' },
  { id: 'mpn', label: 'MPN' },
  { id: 'gtin', label: 'GTIN' },
  { id: 'rating', label: 'Rating' },
  { id: 'availability', label: 'Availability' },
  { id: 'newPrice', label: 'Price band' },
  { id: 'shippingPrice', label: 'Shipping' },
  { id: 'notes', label: 'Notes' }
];


function getActiveListName() {
  return document.getElementById('listSelect')?.value || '';
}

function productSelectionKey(product, idx, listName = getActiveListName()) {
  const productKey = product?.id || product?.url || `idx:${idx}`;
  return `${listName || 'list'}::${productKey}`;
}

function getSelectedProductIndexes(products) {
  return products
    .map((product, idx) => selectedProductIds.has(productSelectionKey(product, idx)) ? idx : -1)
    .filter(idx => idx >= 0);
}

function syncSelectionButtons(products) {
  const currentKeys = new Set(products.map((product, idx) => productSelectionKey(product, idx)));
  for (const key of [...selectedProductIds]) {
    if (!currentKeys.has(key)) selectedProductIds.delete(key);
  }
  const selectedCount = getSelectedProductIndexes(products).length;
  const rescanBtn = document.getElementById('rescanSelectedBtn');
  const deleteBtn = document.getElementById('deleteSelectedBtn');
  if (rescanBtn) {
    rescanBtn.disabled = !selectedCount;
    rescanBtn.textContent = selectedCount ? `Rescan Selected Products (${selectedCount})` : 'Rescan Selected Products';
  }
  if (deleteBtn) {
    deleteBtn.disabled = !selectedCount;
    deleteBtn.textContent = selectedCount ? `Delete Selected Products (${selectedCount})` : 'Delete Selected Products';
  }
}


function getAiCorrectionMap(product) {
  if (!globalThis.ShopScoutAIUI || !product?.aiAnalysis) return {};
  return ShopScoutAIUI.buildVerifiedValueMap(product.aiAnalysis);
}

function getCorrectedValue(product, field, fallback = '') {
  const correction = getAiCorrectionMap(product)[field];
  return correction?.corrected || product?.[field] || fallback || '';
}

function renderCorrectedField(product, field, fallback = '') {
  const correction = getAiCorrectionMap(product)[field];
  const value = product?.[field] || fallback || '';
  if (correction && globalThis.ShopScoutAIUI) return ShopScoutAIUI.renderCorrectedValue(value, correction);
  return esc(value || '');
}

function truncateText(value, maxLength = 40) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function normalizedCorrectionField(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getSpecCorrection(product, specKey) {
  if (!globalThis.ShopScoutAIUI || !product?.aiAnalysis) return null;
  const wanted = normalizedCorrectionField(specKey);
  return ShopScoutAIUI.extractCorrections(product.aiAnalysis).find(item => normalizedCorrectionField(item.field) === wanted) || null;
}

function renderCorrectedSpecValue(product, specKey, value) {
  const correction = getSpecCorrection(product, specKey);
  if (correction && globalThis.ShopScoutAIUI) return ShopScoutAIUI.renderCorrectedValue(value, correction);
  return esc(value || '');
}

document.addEventListener('DOMContentLoaded', init);

async function init() {
  if (typeof SS.bootstrapDataLayer === 'function') await SS.bootstrapDataLayer();
  document.addEventListener('error', e => {
    if (e.target.tagName === 'IMG') {
      if (e.target.hasAttribute('data-hide-parent-on-error')) {
        e.target.parentElement.style.display = 'none';
      } else if (e.target.hasAttribute('data-hide-on-error')) {
        e.target.style.display = 'none';
      }
    }
  }, true);
  await renderListSelector();
  await renderAll();
  bindEvents();
  await openInitialAiResultsFromUrl();
}

async function renderListSelector() {
  const data = await getData();
  const sel = document.getElementById('listSelect');
  const optionsHtml = Object.keys(data.lists).map(n => `<option value="${esc(n)}"${n === data.activeList ? ' selected' : ''}>${esc(n)}</option>`).join('');
  setTrustedHtml(sel, optionsHtml);
  // Mirror the same options + selection to every [data-list-mirror] in the ribbon panes.
  document.querySelectorAll('[data-list-mirror]').forEach(mirror => { setTrustedHtml(mirror, optionsHtml); });
  renderFileRecentLists(data);
}

/* When the user changes the list from a ribbon-tab mirror, route the change to
   the canonical #listSelect and trigger its existing 'change' handler so all
   downstream renders fire exactly once. */
function bindListMirrors() {
  document.querySelectorAll('[data-list-mirror]').forEach(mirror => {
    mirror.addEventListener('change', () => {
      const canonical = document.getElementById('listSelect');
      if (!canonical || canonical.value === mirror.value) return;
      canonical.value = mirror.value;
      canonical.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}

function renderFileRecentLists(data) {
  const stack = document.getElementById('fileRecentLists');
  if (!stack) return;
  const listNames = Object.keys(data?.lists || {});
  const ordered = listNames
    .sort((a, b) => (a === data.activeList ? -1 : b === data.activeList ? 1 : a.localeCompare(b)))
    .slice(0, 4);
  setTrustedHtml(stack, ordered.length
    ? ordered.map(name => `<button class="rb-btn-sm${name === data.activeList ? ' active' : ''}" data-command="recent-list" data-list-name="${escAttr(name)}"><span class="rb-btn-sm-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span><span class="rb-btn-sm-label">${esc(name)}</span></button>`).join('')
    : '<span class="rb-label">No recent lists</span>');
}

function normalizeSearchFields() {
  if (activeSearchFields.size) return;
  SEARCH_FIELD_DEFINITIONS.forEach(field => activeSearchFields.add(field.id));
}

function searchFieldParts(product, fieldId) {
  if (!product) return [];
  if (fieldId === 'title') {
    return [product.title, product.listingTitle, product.productName];
  }
  if (fieldId === 'identity') {
    return [
      product.brand,
      product.manufacturer,
      product.modelName,
      product.modelNumber,
      product.sku,
      product.asin,
      product.upc,
      product.mpn,
      product.gtin,
      product.source,
      product.sellerName,
      product.category,
      product.availability,
      product.url
    ];
  }
  if (fieldId === 'pricing') {
    return [product.newPrice, product.usedPrice, product.shippingPrice, product.rating, product.reviewCount];
  }
  if (fieldId === 'specs') {
    return [
      ...(product.bullets || []),
      ...(product.rawSpecs || []).flatMap(spec => [spec.key, spec.value])
    ];
  }
  if (fieldId === 'notes') {
    return [product.notes, product.description];
  }
  return [];
}

function getSearchableProductText(product) {
  normalizeSearchFields();
  const parts = SEARCH_FIELD_DEFINITIONS.flatMap(field => (
    activeSearchFields.has(field.id) ? searchFieldParts(product, field.id) : []
  ));
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/* Search-field toggle — called from the Search ribbon checkboxes.
   Not grid-coupled (toggles a Set used by getSearchableProductText). */
function toggleSearchField(fieldId) {
  if (!SEARCH_FIELD_DEFINITIONS.some(field => field.id === fieldId)) return;
  if (activeSearchFields.has(fieldId)) activeSearchFields.delete(fieldId);
  else activeSearchFields.add(fieldId);
  normalizeSearchFields();
  renderAll();
}

function readProductLocation(el) {
  const source = el?.closest?.('[data-idx][data-list]') || el;
  return {
    listName: source?.dataset?.list || getActiveListName(),
    index: parseInt(source?.dataset?.idx, 10)
  };
}

async function activateProductListForAction(listName) {
  if (!listName || listName === getActiveListName()) return false;
  const data = await getData();
  if (!data.lists?.[listName]) return false;
  data.activeList = listName;
  await saveData(data);
  await renderListSelector();
  await renderAll();
  return true;
}

async function renderAll() {
  /* Grid-neutral render hook. Task 11 Phase 2 registers the active grid
     on globalThis.ShopScoutGrid and keeps comparison.js out of renderer
     details. */
  const grid = globalThis.ShopScoutGrid;
  if (grid && typeof grid.render === 'function') return grid.render();
}

// --- View configuration modals ---



// --- Events ---
function bindEvents() {
  bindListMirrors();
  document.getElementById('listSelect')?.addEventListener('change', async e => {
    const data = await getData();
    data.activeList = e.target.value;
    await saveData(data);
    closeAiResultsPage(false);
    closeSettingsPage(false);
    const detailPage = document.getElementById('productDetail');
    detailPage?.classList.remove('active');
    if (detailPage) detailPage.style.display = 'none';
    detailIndex = -1;
    selectedProductIds.clear();
    await renderAll();
  });

  renderTopbarAiProviderMenu();
  renderAiTokenUsageText();
  syncRibbonStageCheckboxes();
  updateSecondOpinionStageVisibility();

  // Toolbar buttons
  document.getElementById('newListBtn')?.addEventListener('click', () => openListModal('new'));
  document.getElementById('renameListBtn')?.addEventListener('click', () => openListModal('rename'));
  document.getElementById('deleteListBtn')?.addEventListener('click', deleteList);
  document.getElementById('clearBtn')?.addEventListener('click', clearProducts);
  document.getElementById('exportToggle')?.addEventListener('click', openExportPage);
  document.getElementById('importBtn')?.addEventListener('click', doImport);
  document.getElementById('openBtn')?.addEventListener('click', doOpen);
  document.getElementById('rescanBtn')?.addEventListener('click', rescanList);
  document.getElementById('rescanSelectedBtn')?.addEventListener('click', rescanSelectedProducts);
  document.getElementById('deleteSelectedBtn')?.addEventListener('click', deleteSelectedProducts);
  document.getElementById('manualAiBtn')?.addEventListener('click', openManualAiModal);
  document.getElementById('aiAnalysisPageBtn').addEventListener('click', openLatestAiResults);
  document.getElementById('settingsBtn').addEventListener('click', openSettingsPage);
  document.getElementById('rescanClose').addEventListener('click', () => document.getElementById('rescanModal').classList.remove('active'));
  document.getElementById('settingsPageClose')?.addEventListener('click', closeSettingsPage);
  document.getElementById('manualAiClose')?.addEventListener('click', () => closeModal('manualAiModal'));
  bindRibbonEvents();
  bindTopbarMenuEvents();
  bindRibbonCommandEvents();
  bindAiOptionsEvents();
  bindAiDevMonitorEvents();
  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(async (changes, areaName) => {
      if (areaName !== 'local') return;
      if (changes[ShopScoutAI.AI_STORAGE_KEY]) {
        renderAiTokenUsageText();
        updateSecondOpinionStageVisibility();
      }
      /* Background-worker captures (single FAB capture, bulk-tabs scan,
         add-by-URL, rescan) write directly to chrome.storage.local but
         can't touch IndexedDB. The dashboard reads from IndexedDB via
         productRepo, so without this listener those new products are
         invisible until a full reload. Re-mirror, then refresh the grid. */
      if (changes.shopscout_data) {
        try {
          const next = changes.shopscout_data.newValue;
          if (next && SS.mirrorToProductRepo) await SS.mirrorToProductRepo(next);
        } catch (err) { console.warn('Live re-mirror failed', err); }
        try {
          await renderAll();
        } catch (err) { console.warn('Dashboard refresh failed', err); }
      }
    });
  }

  // URL bar
  document.getElementById('addUrlToggle').addEventListener('click', () => document.getElementById('urlBar').classList.toggle('active'));
  document.getElementById('urlClose').addEventListener('click', () => document.getElementById('urlBar').classList.remove('active'));
  document.getElementById('urlSubmitBtn').addEventListener('click', addByUrl);
  document.getElementById('urlInput').addEventListener('keydown', e => { if (e.key === 'Enter') addByUrl(); });

  // Filters & sort — all of these are optional because the controls live in
  // different ribbon panes that may have been rewritten. Use optional chaining
  // so a missing element doesn't crash the rest of bindEvents (which silently
  // killed every binding that came after it, including the Filter toggle).
  document.getElementById('productSearchInput')?.addEventListener('input',  renderAll);
  document.getElementById('productSearchScope')?.addEventListener('change', renderAll);
  document.getElementById('filterSource')?.addEventListener('change', renderAll);
  document.getElementById('sortBy')?.addEventListener('change', renderAll);

  /* The legacy data-view (cards / table) toggle was removed in Task 8.
     Database view is now the only product browsing surface. */

  // Utility modals
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });

  // Content delegation — info-page interactions (export, copy picker,
  // feedback, dashboard back). Old table header sort and column-menu
  // triggers were retired in Task 8 (Tabulator owns those now).
  document.getElementById('content').addEventListener('click', async e => {
    const dashboardBack = e.target.closest('[data-dashboard-back]');
    if (dashboardBack) {
      await renderAll();
      document.getElementById('urlBar').style.display = '';
      document.getElementById('filterBar').style.display = '';
      document.querySelector('.controls').style.display = '';
      return;
    }

    const dashboardExport = e.target.closest('[data-dashboard-export]');
    if (dashboardExport) {
      const fmt = dashboardExport.dataset.dashboardExport || 'json';
      if (fmt === 'copy') {
        const picker = document.getElementById('dashCopyPicker');
        if (picker) picker.hidden = false;
      } else {
        await doExport(fmt);
      }
      return;
    }

    /* Copy-picker action buttons (Apply / Cancel). Wired through the same
       delegated click handler so we don't need separate listeners. */
    const copyApply = e.target.closest('[data-copy-apply]');
    if (copyApply) {
      const picker = document.getElementById('dashCopyPicker');
      const get = id => !!picker?.querySelector(`[data-copyopt="${id}"]`)?.checked;
      await doCopyPlain({
        name:  get('name'),  url:   get('url'),
        brand: get('brand'), price: get('price'),
        specs: get('specs')
      });
      if (picker) picker.hidden = true;
      return;
    }
    if (e.target.closest('[data-copy-cancel]')) {
      const picker = document.getElementById('dashCopyPicker');
      if (picker) picker.hidden = true;
      return;
    }

    const feedbackAction = e.target.closest('[data-feedback-action]');
    if (feedbackAction) {
      await handleFeedbackAction(feedbackAction.dataset.feedbackAction);
      return;
    }

    const selector = e.target.closest('.product-select-input');
    if (selector) {
      if (selector.disabled) return;
      e.stopPropagation();
      toggleProductSelection(selector.dataset.key, selector.checked, selector.closest('.product-card, tr'));
      return;
    }

    /* Task 11 Phase 1: row-action menu trigger, inline-cell edit,
       product-card click, and table-row click handlers were the
       old card/table interactions; the underlying renderers and
       their target markup are gone. The new grid will reattach
       its own interactions when it lands. */
  });

  /* Task 11 Phase 1: #content keydown/focusout handlers for the
     inline-edit control are gone with the rest of the inline-edit
     flow. Document-level outside-click handler for the row-action
     menu is also gone. The new grid will own these. */

  // Product detail page
  document.getElementById('detailBack').addEventListener('click', closeProductDetail);
  document.getElementById('detailPrev').addEventListener('click', async () => {
    if (detailIndex > 0) openProductDetail(detailIndex - 1);
  });
  document.getElementById('detailNext').addEventListener('click', async () => {
    const products = await getProducts();
    if (detailIndex < products.length - 1) openProductDetail(detailIndex + 1);
  });
  document.getElementById('detailOpen').addEventListener('click', async () => {
    const products = await getProducts();
    const p = products[detailIndex];
    const url = sanitizeUrl(p?.url || '');
    if (url) window.open(url, '_blank', 'noopener');
  });
  document.getElementById('detailRescan').addEventListener('click', async () => {
    if (detailIndex < 0) return;
    const btn = document.getElementById('detailRescan');
    await rescanSingle(detailIndex, btn);
    openProductDetail(detailIndex);
  });
  document.getElementById('detailAi').addEventListener('click', async () => {
    const providerId = document.getElementById('detailAiProvider')?.value || 'auto';
    if (detailIndex >= 0) await openAiOptionsModal([detailIndex], providerId);
  });
  document.getElementById('detailEdit').addEventListener('click', () => {
    if (detailIndex >= 0) openEditModal(detailIndex);
  });
  document.getElementById('detailDelete').addEventListener('click', async () => {
    if (detailIndex < 0) return;
    await removeProduct(detailIndex);
    closeProductDetail();
  });

  // Edit modal
  document.getElementById('editSave').addEventListener('click', saveEdit);
  document.getElementById('editCancel').addEventListener('click', () => document.getElementById('editModal').classList.remove('active'));
  document.getElementById('editClose').addEventListener('click', () => document.getElementById('editModal').classList.remove('active'));

  // Edit modal tabs
  document.getElementById('editTabs').addEventListener('click', e => {
    const tab = e.target.closest('.edit-tab');
    if (tab && tab.dataset.tab) switchEditTab(tab.dataset.tab);
  });

  // Spec table: delete row & add row
  document.getElementById('editSpecTable').addEventListener('click', e => {
    if (e.target.classList.contains('spec-del')) e.target.closest('.spec-row').remove();
  });
  document.getElementById('specAddBtn').addEventListener('click', addSpecRow);

  // Image preview on URL change
  document.getElementById('editImage').addEventListener('input', updateImagePreview);

  // Image gallery: delete image
  document.getElementById('editImageGallery').addEventListener('click', e => {
    if (e.target.classList.contains('img-del')) {
      e.target.closest('.img-gallery-item').remove();
      if (!document.querySelectorAll('#editImageGallery .img-gallery-item').length) {
        setTrustedHtml(document.getElementById('editImageGallery'), '<span style="font-size:12px;color:var(--muted)">No additional images</span>');
      }
    }
  });

  // Image gallery: add image
  document.getElementById('addImageBtn').addEventListener('click', () => {
    const input = document.getElementById('addImageUrl');
    const url = input.value.trim();
    if (!url) return;
    const empty = document.querySelector('#editImageGallery span');
    if (empty) empty.remove();
    const item = document.createElement('div');
    item.className = 'img-gallery-item';
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) { toast.show('Enter a valid http(s) image URL', 'error'); return; }
    setTrustedHtml(item, `<img src="${escAttr(safeUrl)}" alt="" title="${escAttr(safeUrl)}" data-hide-parent-on-error="1">
      <button class="img-del" data-url="${escAttr(safeUrl)}" title="Remove">&times;</button>`);
    document.getElementById('editImageGallery').appendChild(item);
    input.value = '';
  });

  // Lightbox carousel
  let lbImages = [];
  let lbIndex = 0;

  function openLightbox(images, startIndex) {
    lbImages = images.map(u => sanitizeUrl(u)).filter(Boolean);
    lbIndex = Math.max(0, Math.min(startIndex || 0, lbImages.length - 1));
    updateLightbox();
    document.getElementById('lightbox').classList.add('active');
  }

  function updateLightbox() {
    document.getElementById('lightboxImg').src = lbImages[lbIndex] || '';
    const prev = document.getElementById('lightboxPrev');
    const next = document.getElementById('lightboxNext');
    const counter = document.getElementById('lightboxCounter');
    const thumbs = document.getElementById('lightboxThumbs');

    if (lbImages.length <= 1) {
      prev.classList.add('hidden');
      next.classList.add('hidden');
      counter.textContent = '';
      setTrustedHtml(thumbs, '');
    } else {
      prev.classList.toggle('hidden', lbIndex === 0);
      next.classList.toggle('hidden', lbIndex === lbImages.length - 1);
      counter.textContent = `${lbIndex + 1} / ${lbImages.length}`;
      setTrustedHtml(thumbs, lbImages.map((u, i) =>
        `<img src="${escAttr(sanitizeUrl(u))}" class="${i === lbIndex ? 'active' : ''}" data-lbi="${i}" data-hide-on-error="1">`
      ).join(''));
    }
  }

  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
    document.getElementById('lightboxImg').src = '';
    lbImages = [];
  }

  window._openLightbox = openLightbox;

  document.addEventListener('click', e => {
    if (e.target.closest('.lightbox-nav') || e.target.closest('.lightbox-thumbs') || e.target.closest('.lightbox-close')) return;
    if (e.target.closest('.lightbox')) {
      if (e.target.id !== 'lightboxImg') closeLightbox();
      return;
    }
    if (e.target.closest('.img-del')) return;
    const img = e.target.closest('.img-gallery-item img, .edit-image-preview img, .col-thumb img');
    if (img) {
      const src = img.src || img.dataset?.src;
      if (src && src.startsWith('http')) {
        e.stopPropagation();
        const gallery = img.closest('.detail-gallery, .img-gallery, #editImageGallery, #editReviewImages, #detailReviewGallery');
        if (gallery) {
          const allImgs = [...gallery.querySelectorAll('img')].map(i => i.src).filter(s => s && s.startsWith('http'));
          const idx = allImgs.indexOf(src);
          openLightbox(allImgs, idx >= 0 ? idx : 0);
        } else {
          openLightbox([src], 0);
        }
      }
    }
  });

  document.getElementById('lightboxPrev').addEventListener('click', e => {
    e.stopPropagation();
    if (lbIndex > 0) { lbIndex--; updateLightbox(); }
  });
  document.getElementById('lightboxNext').addEventListener('click', e => {
    e.stopPropagation();
    if (lbIndex < lbImages.length - 1) { lbIndex++; updateLightbox(); }
  });
  document.getElementById('lightboxThumbs').addEventListener('click', e => {
    e.stopPropagation();
    const thumb = e.target.closest('img[data-lbi]');
    if (thumb) { lbIndex = parseInt(thumb.dataset.lbi); updateLightbox(); }
  });
  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target.id !== 'lightboxImg' && !e.target.closest('.lightbox-nav') && !e.target.closest('.lightbox-thumbs')) {
      closeLightbox();
    }
  });
  document.addEventListener('keydown', e => {
    if (!document.getElementById('lightbox').classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft' && lbIndex > 0) { lbIndex--; updateLightbox(); }
    else if (e.key === 'ArrowRight' && lbIndex < lbImages.length - 1) { lbIndex++; updateLightbox(); }
  });

  // Export/Import modal
  document.getElementById('exiClose').addEventListener('click', () => document.getElementById('exiModal').classList.remove('active'));
  /* Compare panel — opens a side-by-side vertical layout of selected
     rows. If nothing is selected, fall back to "first 3 rows" so the
     button always does something useful. */
  document.getElementById('compareClose')?.addEventListener('click', () => closeModal('compareModal'));
  /* Task 11 Phase 1: #dbCompareBtn and #dbInvertBtn were ribbon controls
     for the old Tabulator grid (Selected-only filter + Compare/Invert
     toggle). They were removed with the rest of the grid; the new
     grid (Phase 2) will register its own ribbon UI. */
  document.getElementById('exportJson').addEventListener('click', () => doExport('json'));
  document.getElementById('exportCsv').addEventListener('click', () => doExport('csv'));
  document.getElementById('exportXml').addEventListener('click', () => doExport('xml'));
  document.getElementById('exportHtml').addEventListener('click', () => doExport('html'));
  document.getElementById('exportPdf').addEventListener('click', () => doExport('pdf'));
  /* "Copy" tile — reveal the field picker, defer the actual copy until
     the user clicks Apply. Cancel hides the picker back to the grid. */
  document.getElementById('exportCopy')?.addEventListener('click', () => {
    const picker = document.getElementById('exiCopyPicker');
    if (picker) picker.hidden = false;
  });
  document.getElementById('copyCancelBtn')?.addEventListener('click', () => {
    const picker = document.getElementById('exiCopyPicker');
    if (picker) picker.hidden = true;
  });
  document.getElementById('copyApplyBtn')?.addEventListener('click', doCopyPlain);
  // List modal
  document.getElementById('listModalSave').addEventListener('click', saveListModal);
  document.getElementById('listModalCancel').addEventListener('click', () => document.getElementById('listModal').classList.remove('active'));

  // Close modals on overlay click
  for (const ov of document.querySelectorAll('.modal-overlay')) {
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('active'); });
  }
}

async function renderTopbarAiProviderMenu() {
  const panels = document.querySelectorAll('.integrated-ai-provider-menu, #integratedAiProviderMenu');
  const sideStack = document.getElementById('integratedAiSideProviders');
  const defaultLabel = document.getElementById('defaultAiProviderLabel');
  if (!panels.length && !sideStack && !defaultLabel) return;

  const providers = (globalThis.ShopScoutAI?.PROVIDERS || [])
    .filter(provider => provider.adapter !== 'manual');
  if (!providers.length) return;

  let configuredProviders = [];
  let settings = null;
  try {
    const stored = await chrome.storage.local.get(ShopScoutAI.AI_STORAGE_KEY);
    settings = ShopScoutAI.mergeSettings(stored[ShopScoutAI.AI_STORAGE_KEY]);
    configuredProviders = ShopScoutAI.configuredProviders(settings)
      .filter(provider => provider.adapter !== 'manual');
  } catch {
    configuredProviders = [];
  }
  const menuProviders = configuredProviders.length ? configuredProviders : providers;
  const defaultProvider = configuredProviders.find(provider => provider.id === settings?.defaultProvider) || configuredProviders[0] || null;
  if (defaultLabel) defaultLabel.textContent = defaultProvider ? (defaultProvider.shortName || defaultProvider.name) : 'Auto AI';

  const providerItems = menuProviders.map(provider => {
    const label = provider.shortName || provider.name;
    return `<button class="menu-item ai-provider-run" data-provider-id="${escAttr(provider.id)}">${esc(label)}</button>`;
  }).join('');

  const html = `
    <button class="menu-item ai-provider-run" data-provider-id="auto" title="Use the configured ShopScout AI pipeline">Auto pipeline</button>
    <div class="menu-separator"></div>
    ${providerItems}`;
  panels.forEach(panel => { setTrustedHtml(panel, html); });

  if (sideStack) {
    setTrustedHtml(sideStack, configuredProviders
      .filter(provider => provider.id !== defaultProvider?.id)
      .slice(0, 4)
      .map(provider => {
        const label = provider.shortName || provider.name;
        return `<button class="rb-btn-sm" data-provider-shortcut="${escAttr(provider.id)}" title="Run with ${escAttr(label)}"><span class="rb-btn-sm-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18M3 12h18"/></svg></span><span class="rb-btn-sm-label">${esc(label)}</span></button>`;
      })
      .join(''));
  }
}

function chooseTokenUsageProvider(settings, preferredProviderId = selectedAiUsageProviderId) {
  if (!globalThis.ShopScoutAI) return null;
  const configured = ShopScoutAI.configuredProviders(settings)
    .filter(provider => provider.adapter !== 'manual');
  if (!configured.length) return null;
  if (preferredProviderId && preferredProviderId !== 'auto') {
    const preferred = configured.find(provider => provider.id === preferredProviderId);
    if (preferred) return preferred;
  }
  const defaultProvider = configured.find(provider => provider.id === settings.defaultProvider);
  return defaultProvider || configured[0];
}

async function renderAiTokenUsageText(preferredProviderId = selectedAiUsageProviderId) {
  const pill = document.getElementById('aiTokenUsage');
  if (!pill || !globalThis.ShopScoutAI) return;
  try {
    const stored = await chrome.storage.local.get(ShopScoutAI.AI_STORAGE_KEY);
    const settings = ShopScoutAI.mergeSettings(stored[ShopScoutAI.AI_STORAGE_KEY]);
    const provider = chooseTokenUsageProvider(settings, preferredProviderId);
    if (!provider) {
      pill.classList.remove('active', 'warn');
      pill.textContent = '';
      pill.title = '';
      return;
    }
    const summary = ShopScoutAI.getProviderTokenSummary(settings, provider.id);
    pill.textContent = summary.label;
    pill.title = summary.tooltip;
    pill.classList.toggle('warn', !!summary.budget && summary.remaining <= Math.max(1000, summary.budget * 0.1));
    pill.classList.add('active');
  } catch {
    pill.classList.remove('active', 'warn');
  }
}

function setStageOptionState(btn, active) {
  if (!btn) return;
  btn.classList.toggle('active', !!active);
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  const checkbox = btn.querySelector('.stage-checkbox');
  if (checkbox) checkbox.checked = !!active;
}

function syncRibbonStageCheckboxes() {
  document.querySelectorAll('[data-stage-option]').forEach(btn => {
    setStageOptionState(btn, btn.classList.contains('active'));
  });
}

function hasConfiguredSecondOpinionProvider(settings) {
  if (!globalThis.ShopScoutAI) return false;
  const merged = ShopScoutAI.mergeSettings(settings);
  const configuredProviders = ShopScoutAI.configuredProviders(merged)
    .filter(provider => provider.adapter !== 'manual');
  const role = merged.roles?.secondOpinion || '';
  if (!role) return false;
  if (role === 'auto') return configuredProviders.length >= 2;
  return configuredProviders.some(provider => provider.id === role);
}

async function updateSecondOpinionStageVisibility() {
  const buttons = document.querySelectorAll('[data-stage-option="secondOpinion"]');
  if (!buttons.length || !globalThis.ShopScoutAI) return;
  let available = false;
  try {
    const stored = await chrome.storage.local.get(ShopScoutAI.AI_STORAGE_KEY);
    available = hasConfiguredSecondOpinionProvider(stored[ShopScoutAI.AI_STORAGE_KEY]);
  } catch {}
  buttons.forEach(btn => {
    btn.hidden = !available;
    btn.disabled = !available;
    btn.setAttribute('aria-hidden', available ? 'false' : 'true');
    if (!available) setStageOptionState(btn, false);
  });
}

function closeTopbarMenus(exceptMenu) {
  document.querySelectorAll('.toolbar-menu[open]').forEach(menu => {
    if (menu !== exceptMenu) menu.removeAttribute('open');
  });
}

function bindTopbarMenuEvents() {
  document.querySelectorAll('.toolbar-menu').forEach(menu => {
    menu.addEventListener('toggle', () => {
      if (menu.open) closeTopbarMenus(menu);
    });
  });

  document.querySelector('.ribbon-shell')?.addEventListener('click', e => {
    const item = e.target.closest('.toolbar-menu .menu-item');
    if (item && !item.disabled) setTimeout(() => closeTopbarMenus(), 0);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.toolbar-menu')) closeTopbarMenus();
  });
}

function bindRibbonEvents() {
  const shell = document.querySelector('.ribbon-shell');
  if (!shell) return;
  const tabs = shell.querySelectorAll('.ribbon-tab[data-tab], .ribbon-tab[data-ribbon-tab]');
  const panes = shell.querySelectorAll('.ribbon-pane[data-pane]');
  tabs.forEach(tab => tab.addEventListener('click', () => activateRibbonTab(tab.dataset.tab || tab.dataset.ribbonTab)));
}

function activateRibbonTab(target) {
  const shell = document.querySelector('.ribbon-shell');
  if (!shell || !target) return;
  const tabs = shell.querySelectorAll('.ribbon-tab[data-tab], .ribbon-tab[data-ribbon-tab]');
  const panes = shell.querySelectorAll('.ribbon-pane[data-pane]');
  tabs.forEach(tab => tab.classList.toggle('active', (tab.dataset.tab || tab.dataset.ribbonTab) === target));
  panes.forEach(pane => pane.classList.toggle('active', pane.dataset.pane === target));
}

/* Page-swap helpers — the main viewport hosts EXACTLY ONE of:
   - The product grid (default; mounted at #productGrid by the new
     grid layer in Phase 2)
   - An info page (Settings / About / Help / Suggest / Report)
   - The AI results page
   - The product detail page
   body.is-info-page hides #productGrid and reveals #content via CSS. */
function restoreProductListChrome() {
  document.getElementById('productDetail')?.classList.remove('active');
  if (document.getElementById('productDetail')) document.getElementById('productDetail').style.display = 'none';
  closeAiResultsPage(false);
  closeSettingsPage(false);
  document.querySelector('.ribbon-shell').style.display = '';
  document.getElementById('urlBar').style.display = '';
  document.getElementById('filterBar').style.display = '';
  document.querySelector('.controls').style.display = '';
  document.body.classList.remove('is-info-page');
  const productGrid = document.getElementById('productGrid');
  if (productGrid) productGrid.hidden = false;
  renderAll();
}

function prepareMainContentPage() {
  document.getElementById('productDetail')?.classList.remove('active');
  if (document.getElementById('productDetail')) document.getElementById('productDetail').style.display = 'none';
  closeAiResultsPage(false);
  closeSettingsPage(false);
  document.getElementById('urlBar').style.display = 'none';
  document.getElementById('filterBar').style.display = 'none';
  document.querySelector('.controls').style.display = 'none';
  document.body.classList.add('is-info-page');
  const productGrid = document.getElementById('productGrid');
  if (productGrid) productGrid.hidden = true;
  const content = document.getElementById('content');
  /* body.is-info-page (set above) lets .content show as the
     padded info pane; nothing more is needed here. */
  window.scrollTo(0, 0);
  return content;
}

function renderMarkdownToHtml(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inList = false;
  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (line.startsWith('### ')) {
      closeList();
      html += `<h3>${esc(line.slice(4))}</h3>`;
    } else if (line.startsWith('## ')) {
      closeList();
      html += `<h2>${esc(line.slice(3))}</h2>`;
    } else if (line.startsWith('# ')) {
      closeList();
      html += `<h1>${esc(line.slice(2))}</h1>`;
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${esc(line.replace(/^[-*]\s+/, ''))}</li>`;
    } else {
      closeList();
      html += `<p>${esc(line)}</p>`;
    }
  }
  closeList();
  return html || '<p>No content available.</p>';
}

async function loadTextResource(path) {
  const urls = [];
  try {
    if (chrome.runtime?.getURL) urls.push(chrome.runtime.getURL(path));
  } catch {}
  urls.push(path);
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.text();
    } catch {}
  }
  return '';
}

function openDashboardInfoPage(title, subtitle, bodyHtml) {
  const content = prepareMainContentPage();
  setTrustedHtml(content, `<section class="dashboard-page">
    <header class="dashboard-page-head">
      <div>
        <h2>${esc(title)}</h2>
        ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
      </div>
      <button class="rb-btn-sm" type="button" data-dashboard-back>Back to Products</button>
    </header>
    <div class="dashboard-page-body">${bodyHtml}</div>
  </section>`);
}

/* Two distinct pages now: "About" describes what ShopScout IS, "Help"
   describes HOW TO USE it. Previously both routed to the same long-form
   markdown which made the menu items indistinguishable. */
function openAboutPage() {
  const version = chrome.runtime.getManifest?.().version || 'unknown';
  openDashboardInfoPage('About ShopScout', 'What ShopScout is and why it exists.',
    `<div class="dashboard-about">
      <p><strong>ShopScout</strong> is a browser extension that captures product
      information from major shopping sites, organizes it into your own private
      database, and helps you decide what to buy — either by side-by-side
      comparison or by handing the data to an AI assistant for verification and
      analysis.</p>
      <p>It runs entirely in your browser. Captured products, lists, notes, and
      saved views live in local storage on this machine. Nothing is uploaded to
      ShopScout servers because there are no ShopScout servers — when you ask an
      AI for a verdict, you choose the provider and your data goes directly to
      that provider's API (or to a local LLM if you set one up in Settings).</p>
      <h3>What it does well</h3>
      <ul>
        <li>One-click capture from Amazon, eBay, Walmart, and 30+ other shopping hosts.</li>
        <li>Layered extraction pipeline pulls structured data (JSON-LD, microdata) <em>plus</em> visible spec tables, plus a text-pattern miner for marketing-copy specs (torque, RPM, capacity, etc.).</li>
        <li>Auto-built comparison columns: every captured spec becomes a sortable, filterable column with best-in-row highlighting and unit unification (metric → U.S. customary, minutes → hours, etc.).</li>
        <li>A side-by-side Compare panel for 2–4 selected products.</li>
        <li>Export to PDF, HTML, CSV, JSON, XML, or plain-text clipboard.</li>
        <li>Optional GTIN-based enrichment from Open Food / Beauty / Pet / Products Facts.</li>
      </ul>
      <p class="dashboard-about-version">Version ${esc(version)}</p>
    </div>`);
}

async function openHelpPage() {
  /* Help is the practical how-to: where to click, what the buttons do,
     and the keyboard shortcuts that survived the cleanup. */
  openDashboardInfoPage('Help', 'How to use ShopScout day to day.',
    `<div class="dashboard-help">
      <h3>Capturing products</h3>
      <ul>
        <li><strong>From a product page:</strong> click the floating <em>ShopScout</em> button in the lower-right corner.</li>
        <li><strong>From the toolbar:</strong> open the ShopScout popup and click "Add current product".</li>
        <li><strong>From open tabs:</strong> "Add Products from Open Tabs" scans every tab in the current window.</li>
        <li><strong>By URL:</strong> paste a product URL into the URL bar at the top of the dashboard.</li>
      </ul>
      <h3>Organizing</h3>
      <ul>
        <li><strong>Lists:</strong> use the Products ribbon to create / rename / delete lists. The active list is what you see in the grid.</li>
        <li><strong>Open vs Import:</strong> <em>Open</em> loads a saved file as a NEW list. <em>Import</em> merges the file into your CURRENT list.</li>
        <li><strong>Saved Views:</strong> save the current filters / sort / column visibility as a named view in the View ribbon.</li>
      </ul>
      <h3>Comparing</h3>
      <ul>
        <li><strong>Best-in-row:</strong> the cheapest Price, longest Battery Life, highest Rating, etc. are tinted gold automatically.</li>
        <li><strong>Two views:</strong> the View ribbon's Layout group has <em>List</em> (products as rows — good for browsing/sorting) and <em>Compare</em> (products as columns, specs as rows — good for spec-by-spec head-to-head). Compare is the default.</li>
        <li><strong>Narrow to a few:</strong> check 2+ products, then click <em>Selected only</em> in the View ribbon → table filters to just those rows. Click again to show everything.</li>
        <li><strong>Group by:</strong> the View ribbon's Group By dropdown collapses rows under any column.</li>
      </ul>
      <h3>Exporting</h3>
      <ul>
        <li>File ribbon → Save As → pick PDF / HTML / CSV / JSON / XML / Copy.</li>
        <li>"Copy" is plain text — no AI prompt wrapper — with a field picker.</li>
      </ul>
      <h3>AI analysis</h3>
      <ul>
        <li><strong>Manual AI:</strong> File ribbon → Manual AI → pick an assistant; ShopScout opens it and auto-pastes the comparison prompt.</li>
        <li><strong>Connected AI:</strong> Settings → AI Providers → add an API key for any supported provider (or point at a Local LLM running on your machine).</li>
      </ul>
      <h3>Keyboard</h3>
      <ul>
        <li><kbd>Enter</kbd> in the URL field — add product by URL.</li>
        <li><kbd>Esc</kbd> — close the image lightbox / cancel inline cell editing.</li>
        <li>Click a column header to sort; <kbd>Shift</kbd>+click to add a secondary sort.</li>
        <li>Drag column headers to reorder.</li>
      </ul>
    </div>`);
}

async function openShopScoutDocumentation(title = 'Help') {
  /* Legacy shim: existing call sites still pass through this name.
     Route About vs Help to the dedicated pages above. */
  if (title === 'About') return openAboutPage();
  return openHelpPage();
}

function openExportPage() {
  openDashboardInfoPage('Save As', 'Export the current product list.', `<div class="dashboard-format-grid">
    <button type="button" data-dashboard-export="pdf"><strong>PDF</strong><span>Printable product report.</span></button>
    <button type="button" data-dashboard-export="html"><strong>HTML</strong><span>Self-contained browser page.</span></button>
    <button type="button" data-dashboard-export="csv"><strong>CSV</strong><span>Spreadsheet-friendly table.</span></button>
    <button type="button" data-dashboard-export="json"><strong>JSON</strong><span>Full ShopScout data backup.</span></button>
    <button type="button" data-dashboard-export="xml"><strong>XML</strong><span>Structured data export.</span></button>
    <button type="button" data-dashboard-export="copy"><strong>Copy</strong><span>Plain text to clipboard — no AI prompt wrapper.</span></button>
  </div>
  <!-- Inline picker for the Copy tile. Hidden until the user clicks
       Copy. Matches the user's stated minimum (name + url + optional specs);
       brand and price added because they're cheap to include and useful. -->
  <div id="dashCopyPicker" class="dashboard-copy-picker" hidden>
    <div class="dashboard-copy-picker-title">What to copy</div>
    <div class="dashboard-copy-picker-options">
      <label><input type="checkbox" data-copyopt="name"  checked> Product name</label>
      <label><input type="checkbox" data-copyopt="url"   checked> URL</label>
      <label><input type="checkbox" data-copyopt="brand">         Brand</label>
      <label><input type="checkbox" data-copyopt="price">         Price</label>
      <label><input type="checkbox" data-copyopt="specs">         Include specs</label>
    </div>
    <div class="dashboard-copy-picker-actions">
      <button type="button" class="btn primary" data-copy-apply>Copy to clipboard</button>
      <button type="button" class="btn" data-copy-cancel>Cancel</button>
    </div>
  </div>`);
}

function showModal(id) {
  document.getElementById(id)?.classList.add('active');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

/* Task 11 Phase 1: openComparePanel previously delegated to
   SSDatabaseView.getSelectedRows / applyCompareFilter /
   clearCompareFilter on the Tabulator grid. All three are gone with
   the grid layer. The Phase 2 grid will re-implement selection +
   compare-filter on its own data view and reattach this entry point.
   Until then, fall back to the instructions modal so the action is
   not silently broken. */
async function openComparePanel() {
  openCompareInstructions();
}

function openCompareInstructions() {
  const body = document.getElementById('compareBody');
  if (body) setTrustedHtml(body, `
    <div class="ss-compare-help">
      <h3>How to compare products</h3>
      <ol>
        <li><strong>Check the boxes</strong> next to the products you want to compare — pick 2 to 4.</li>
        <li><strong>Click "Selected only"</strong> again. The table filters down to just those products so you can scan them side-by-side.</li>
        <li><strong>Click "Selected only" once more</strong> to clear the filter and show every product again.</li>
      </ol>
      <p class="ai-muted">Tip: the default <strong>Compare</strong> view (in the Layout group) lays the products out as columns and specs as rows — perfect for spec-by-spec head-to-head. Switch to <strong>List</strong> if you'd rather see products as rows.</p>
    </div>`);
  showModal('compareModal');
}


async function openManualAiModal() {
  /* The ai-select iframe expects shopscout_last_prompt to already be in
     storage when the user clicks an AI card; otherwise it alerts
     "No ShopScout prompt found". The flow that triggers this modal
     skips the regular copyPrompt() step, so build the prompt now. */
  try {
    const products = await getProducts();
    if (!products.length) { toast.show('No products to send', 'error'); return; }
    const promptText = buildManualHybridPrompt(products, null, null)
      + buildManualAnalysisOptionsInstructions(null, null);
    await chrome.storage.local.set({ shopscout_last_prompt: promptText });
  } catch (err) {
    console.warn('Could not prepare Manual AI prompt', err);
  }
  const frame = document.getElementById('manualAiFrame');
  if (frame) {
    /* Re-set the src each time so the iframe re-reads storage even when
       the modal was opened before. (Setting the same URL still triggers a
       reload because we add a cache-busting param.) */
    frame.setAttribute('src', chrome.runtime.getURL('ai-select.html?t=' + Date.now()));
  }
  showModal('manualAiModal');
}

function openSettingsPage() {
  closeAiResultsPage(false);
  const detailPage = document.getElementById('productDetail');
  detailPage?.classList.remove('active');
  if (detailPage) detailPage.style.display = 'none';
  const frame = document.getElementById('settingsFrame');
  if (frame && !frame.getAttribute('src')) frame.setAttribute('src', chrome.runtime.getURL('settings.html'));
  document.getElementById('urlBar').style.display = 'none';
  document.getElementById('filterBar').style.display = 'none';
  document.querySelector('.controls').style.display = 'none';
  document.getElementById('content').style.display = 'none';
  const settingsPage = document.getElementById('settingsPage');
  settingsPage?.classList.add('active');
  settingsPage?.setAttribute('aria-hidden', 'false');
  window.scrollTo(0, 0);
}

function closeSettingsPage(shouldRender = true) {
  const settingsPage = document.getElementById('settingsPage');
  settingsPage?.classList.remove('active');
  settingsPage?.setAttribute('aria-hidden', 'true');
  document.getElementById('urlBar').style.display = '';
  document.getElementById('filterBar').style.display = '';
  document.querySelector('.controls').style.display = '';
  document.getElementById('content').style.display = '';
  if (shouldRender) renderAll();
}

function showKeyboardShortcuts() {
  openDashboardInfoPage('Keyboard Shortcuts', 'Common dashboard shortcuts.', `<ul>
    <li>Enter in the URL field: add product by URL.</li>
    <li>Escape: close image lightbox or cancel inline cell editing.</li>
    <li>Enter in a table cell editor: save the edit.</li>
    <li>Left / Right arrows: move through lightbox images.</li>
    <li>Click table headers: sort table columns.</li>
  </ul>`);
}

/* openFeedbackPage / handleFeedbackAction moved to comparison-feedback.js
   (loaded by comparison.html before this file). The ribbon-command
   dispatcher calls them via globalThis, so they're available by name. */

/* applySortDirection was retired in Task 8 with the rest of the
   legacy sort plumbing. Tabulator column headers handle sort now. */

function bindRibbonCommandEvents() {
  const shell = document.querySelector('.ribbon-shell');
  if (!shell) return;
  shell.addEventListener('click', async e => {
    const exportBtn = e.target.closest('[data-export-format]');
    if (exportBtn && !exportBtn.disabled) {
      await doExport(exportBtn.dataset.exportFormat || 'json');
      return;
    }

    const providerBtn = e.target.closest('.ai-provider-run, [data-provider-shortcut]');
    if (providerBtn && !providerBtn.disabled) {
      const providerId = providerBtn.dataset.providerId || providerBtn.dataset.providerShortcut || 'auto';
      selectedAiUsageProviderId = providerId;
      await renderAiTokenUsageText(providerId);
      await openAiOptionsModal(undefined, providerId, 'integrated');
      return;
    }

    const searchFieldBtn = e.target.closest('[data-search-field]');
    if (searchFieldBtn && !searchFieldBtn.disabled) {
      toggleSearchField(searchFieldBtn.dataset.searchField);
      return;
    }

    /* Task 8: [data-group-field] menu item handler removed —
       the legacy group-by menu is gone. */

    const stageBtn = e.target.closest('[data-stage-option]');
    if (stageBtn) {
      if (stageBtn.disabled || stageBtn.hidden) return;
      setStageOptionState(stageBtn, !stageBtn.classList.contains('active'));
      return;
    }

    const commandBtn = e.target.closest('[data-command]');
    if (!commandBtn || commandBtn.disabled) return;
    const command = commandBtn.dataset.command;
    if (command === 'new-list') openListModal('new');
    else if (command === 'add-product' || command === 'import-url') {
      const bar = document.getElementById('urlBar');
      bar?.classList.add('active');
      document.getElementById('urlInput')?.focus();
    } else if (command === 'open-list') {
      activateRibbonTab('products');
      document.getElementById('listSelect')?.focus();
    } else if (command === 'show-recent-lists') {
      activateRibbonTab('file');
      document.getElementById('fileRecentLists')?.querySelector('button')?.focus();
    } else if (command === 'recent-list') {
      const listName = commandBtn.dataset.listName;
      if (!listName) return;
      const data = await getData();
      if (!data.lists?.[listName]) return;
      data.activeList = listName;
      await saveData(data);
      await renderListSelector();
      await renderAll();
    } else if (command === 'import-clipboard') {
      try {
        const text = (await navigator.clipboard.readText()).trim();
        const url = text.split(/\s+/).find(part => /^https?:\/\//i.test(part));
        if (!url) {
          toast.show('Clipboard does not contain a product URL', 'error');
          return;
        }
        const input = document.getElementById('urlInput');
        if (input) input.value = url;
        document.getElementById('urlBar')?.classList.add('active');
        await addByUrl();
      } catch {
        toast.show('Could not read clipboard', 'error');
      }
    } else if (command === 'manual-ai') openManualAiModal();
    else if (command === 'ai-results') openLatestAiResults();
    else if (command === 'settings') openSettingsPage();
    else if (command === 'show-view-tab') activateRibbonTab('view');
    else if (command === 'show-help-tab') activateRibbonTab('about');
    else if (command === 'export') openExportPage();
    else if (command === 'rescan-all') rescanList();
    else if (command === 'rescan-selected') rescanSelectedProducts();
    else if (command === 'delete-selected') deleteSelectedProducts();
    else if (command === 'delete-all') clearProducts();
    /* Task 8 retired the toggle-compact, toggle-gridlines,
       sort-ascending / sort-descending, add-filter, filter-selected,
       filter-noted, open-group-modal, group-by-source, ungroup,
       expand-groups, collapse-groups ribbon commands. Their backing
       state vars are gone; Tabulator owns sort, filter, group, and
       visual density for the Database view. */
    /* Task 11 Phase 1: show-columns / open-column-order-modal /
       open-freeze-modal dispatch removed along with the Tabulator
       grid. The new grid (Phase 2) owns these. */
    else if (command === 'documentation' || command === 'about') {
      await openShopScoutDocumentation(command === 'about' ? 'About' : 'Help');
    } else if (command === 'keyboard-shortcuts') {
      showKeyboardShortcuts();
    } else if (command === 'report-bug') {
      openFeedbackPage('bug');
    } else if (command === 'suggest-feature') {
      openFeedbackPage('feature');
    } else if (command === 'rate-extension') {
      openDashboardInfoPage('Rate Extension', 'Development build', '<p>Store rating is not configured for this unpacked development build.</p>');
    } else if (command === 'check-updates') {
      const version = chrome.runtime.getManifest?.().version || 'unknown';
      openDashboardInfoPage('Check Updates', 'Extension package status', `<p>ShopScout ${esc(version)} is installed. Browser extension store update checks are handled by the browser when the packaged extension is installed from a store.</p>`);
    }
    /* Task 8: reset-sort and clear-filters dispatch is gone — Tabulator
       headers manage sort and filter state directly. */
    else if (command === 'clear-search') {
      const input = document.getElementById('productSearchInput');
      if (input) input.value = '';
      renderAll();
    }
    /* Task 11 Phase 1: reset-columns / hide-all-columns are gone with
       the legacy column-visibility state. The new grid will own these. */
    else if (command === 'stage-select-all' || command === 'stage-clear-all') {
      const active = command === 'stage-select-all';
      document.querySelectorAll('[data-stage-option]').forEach(btn => {
        if (btn.disabled || btn.hidden) return;
        setStageOptionState(btn, active);
      });
    } else if (command === 'cancel-run') {
      if (ShopScoutComparison.rescanController.cancelActive()) return;
      toast.show('No scan is running.', 'error');
    }
  });
}

// --- Add by URL ---
async function addByUrl() {
  const input = document.getElementById('urlInput');
  const url = input.value.trim();
  if (!url) return;
  toast.show('Fetching product...', 'loading');
  try {
    const result = await chrome.runtime.sendMessage({ action: 'addByUrl', url });
    toast.hide();
    if (result?.success) {
      toast.show(`Added from ${result.product?.source || 'URL'}`);
      input.value = '';
      await renderAll();
    } else toast.show(result?.error || 'Failed', 'error');
  } catch (e) { toast.hide(); toast.show('Failed to fetch', 'error'); }
}

// --- Copy for AI ---
function buildManualAnalysisOptionsInstructions(analysisOptions, promptOptions) {
  if (!analysisOptions) return '';
  const normalized = globalThis.ShopScoutAI?.normalizeAnalysisOptions
    ? ShopScoutAI.normalizeAnalysisOptions(analysisOptions)
    : analysisOptions;
  const labels = globalThis.ShopScoutAI?.selectedOptionLabels
    ? ShopScoutAI.selectedOptionLabels(normalized)
    : Object.entries(normalized).filter(([, selected]) => selected).map(([key]) => key);
  const stages = globalThis.ShopScoutAI?.enabledStagesForAnalysis
    ? ShopScoutAI.enabledStagesForAnalysis(normalized, false)
    : [];
  return `\n\n# User-selected analysis scope\n\n` +
    `Run only these selected checks: ${labels.join(', ') || 'none'}.\n` +
    (stages.length ? `Use these logical stages: ${stages.join(', ')}.\n` : '') +
    buildManualPromptPayloadInstructions(promptOptions) +
    `For every selected user-facing section, show a comparison table first, then concise explanatory text and bullet points.\n` +
    `Include each product's cost and source link when relevant. Keep the answer precise and readable, and avoid information overload.\n`;
}

function buildManualPromptPayloadInstructions(promptOptions) {
  const options = globalThis.ShopScoutAI?.normalizePromptOptions
    ? ShopScoutAI.normalizePromptOptions(promptOptions)
    : { payloadMode: promptOptions?.payloadMode || 'compact' };
  let text = `Prompt payload mode: ${options.payloadMode}.\n`;
  text += `Use compact captured facts first. Use product URLs only as source references. Retrieve/search only for missing, contradictory, or official manufacturer verification data.\n`;
  if (options.payloadMode === 'fallback') {
    text += `If capped raw fallback excerpts are present, use them only when compact facts are insufficient and ignore boilerplate.\n`;
  }
  return text;
}

function formatManualValue(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function formatManualProductFacts(products) {
  return (products || []).map(product => {
    const lines = [];
    const name = formatManualValue(product.name || product.listingTitle || `Product ${product.id || ''}`);
    lines.push(`## Product ${product.id || ''}: ${name}`);
    [
      ['URL', product.url],
      ['Listing title', product.listingTitle],
      ['Brand', product.brand],
      ['Manufacturer', product.manufacturer],
      ['Model name', product.modelName],
      ['Model number', product.modelNumber],
      ['Price', product.price],
      ['Used price', product.usedPrice],
      ['Source', product.source],
      ['Seller', product.seller],
      ['Category', product.category],
      ['Rating', product.rating],
      ['Review count', product.reviewCount]
    ].forEach(([label, value]) => {
      const text = formatManualValue(value);
      if (text) lines.push(`- ${label}: ${text}`);
    });
    if (product.identifiers && Object.keys(product.identifiers).length) {
      const ids = Object.entries(product.identifiers)
        .map(([key, value]) => `${key.toUpperCase()}: ${formatManualValue(value)}`)
        .filter(item => !item.endsWith(':'));
      if (ids.length) lines.push(`- Identifiers: ${ids.join('; ')}`);
    }
    if (product.specs?.length) {
      lines.push(`- Key specs:`);
      product.specs.forEach(spec => {
        const key = formatManualValue(spec.key);
        const value = formatManualValue(spec.value);
        if (key && value) lines.push(`  - ${key}: ${value}`);
      });
    }
    if (product.bullets?.length) {
      lines.push(`- Useful bullets:`);
      product.bullets.forEach(bullet => {
        const text = formatManualValue(bullet);
        if (text) lines.push(`  - ${text}`);
      });
    }
    if (product.rawFallback) {
      const desc = formatManualValue(product.rawFallback.descriptionExcerpt);
      if (desc) lines.push(`- Capped fallback excerpt: ${desc}`);
      if (product.rawFallback.bullets?.length) {
        lines.push(`- Capped fallback bullets:`);
        product.rawFallback.bullets.forEach(bullet => {
          const text = formatManualValue(bullet);
          if (text) lines.push(`  - ${text}`);
        });
      }
    }
    return lines.join('\n');
  }).join('\n\n');
}

function buildManualHybridPrompt(products, analysisOptions, promptOptions) {
  const options = globalThis.ShopScoutAI.normalizePromptOptions
    ? ShopScoutAI.normalizePromptOptions(promptOptions)
    : { payloadMode: promptOptions?.payloadMode || 'compact' };
  const normalizedChecks = globalThis.ShopScoutAI.normalizeAnalysisOptions
    ? ShopScoutAI.normalizeAnalysisOptions(analysisOptions)
    : analysisOptions;
  const labels = globalThis.ShopScoutAI.selectedOptionLabels
    ? ShopScoutAI.selectedOptionLabels(normalizedChecks)
    : Object.entries(normalizedChecks || {}).filter(([, selected]) => selected).map(([key]) => key);
  const payload = globalThis.ShopScoutAI?.productSummary
    ? ShopScoutAI.productSummary(products, options)
    : (products || []).map((product, index) => ({ id: index + 1, name: product.title || `Product ${index + 1}`, url: product.url || '', price: product.newPrice || '', source: product.source || '' }));
  return `You are a product comparison, verification, and buying-decision assistant for ShopScout.\n\n` +
    `# Output rules\n` +
    `Do not return JSON. Do not include a JSON object, JSON schema, code block, or raw structured data block in your answer.\n` +
    `Return a human-readable report only, with clear headings, compact tables, bullets, and short explanations.\n\n` +
    `# Payload policy\n${buildManualPromptPayloadInstructions(options)}\n` +
    `# Selected checks\n${labels.map(label => `- ${label}`).join('\n') || '- None'}\n\n` +
    `# Product facts\n${formatManualProductFacts(payload)}\n\n` +
    `Return a concise, readable report with tables first, explanations after, and confidence/verification status for important claims.`;
}

async function copyPrompt(mode, analysisOptions, promptOptions) {
  const products = await getProducts();
  if (!products.length) { toast.show('No products to copy', 'error'); return; }
  const promptText = buildManualHybridPrompt(products, analysisOptions, promptOptions) + buildManualAnalysisOptionsInstructions(analysisOptions, promptOptions);
  await navigator.clipboard.writeText(promptText);
  await chrome.storage.local.set({ shopscout_last_prompt: promptText });
  chrome.tabs.create({ url: chrome.runtime.getURL(`ai-select.html?mode=${mode}&count=${products.length}`) });
}

function aiOptionInputs() {
  return [...document.querySelectorAll('#aiOptionsModal [data-ai-option]')];
}

function payloadModeInputs() {
  return [...document.querySelectorAll('#aiOptionsModal [data-payload-mode]')];
}

function collectPromptPayloadOptionsFromModal() {
  const selected = payloadModeInputs().find(input => input.checked);
  const payloadMode = selected?.value || selected?.dataset.payloadMode || 'compact';
  return globalThis.ShopScoutAI?.normalizePromptOptions
    ? ShopScoutAI.normalizePromptOptions({ payloadMode })
    : { payloadMode };
}

function collectAiOptionsFromModal() {
  const options = {};
  for (const input of aiOptionInputs()) {
    options[input.dataset.aiOption] = !!input.checked;
  }
  return globalThis.ShopScoutAI?.normalizeAnalysisOptions
    ? ShopScoutAI.normalizeAnalysisOptions(options)
    : options;
}

function selectedAiOptionCount(options = collectAiOptionsFromModal()) {
  return Object.values(options).filter(Boolean).length;
}

function setAiOptionsInModal(options) {
  const normalized = globalThis.ShopScoutAI?.normalizeAnalysisOptions
    ? ShopScoutAI.normalizeAnalysisOptions(options)
    : options;
  for (const input of aiOptionInputs()) {
    input.checked = !!normalized[input.dataset.aiOption];
  }
  updateAiOptionsStatus();
}

async function getAiOptionsProducts(productIndexes) {
  const products = await getProducts();
  if (Array.isArray(productIndexes) && productIndexes.length) {
    return productIndexes.map(idx => products[idx]).filter(Boolean);
  }
  return products;
}

async function getRecommendedAiOptions(productIndexes) {
  const products = await getAiOptionsProducts(productIndexes);
  if (globalThis.ShopScoutAI?.recommendedAnalysisOptions) return ShopScoutAI.recommendedAnalysisOptions(products);
  return collectAiOptionsFromModal();
}

function updateAiOptionsStatus() {
  const status = document.getElementById('aiOptionsStatus');
  const runBtn = document.getElementById('aiOptionsRun');
  if (!status || !runBtn) return;
  const count = selectedAiOptionCount();
  status.textContent = count ? `${count} check${count === 1 ? '' : 's'} selected` : 'Select at least one check';
  runBtn.disabled = !count;
}

async function updatePromptPayloadEstimate() {
  const el = document.getElementById('aiPayloadEstimate');
  if (!el) return;
  const options = collectPromptPayloadOptionsFromModal();
  const products = await getAiOptionsProducts(pendingAiRunOptions?.productIndexes);
  if (!products.length) {
    el.textContent = 'No products selected for payload estimate.';
    return;
  }
  if (globalThis.ShopScoutAI?.estimatePromptPayload) {
    const estimate = ShopScoutAI.estimatePromptPayload(products, options);
    const modeText = options.payloadMode === 'fallback'
      ? 'Compact facts plus capped fallback excerpts'
      : 'Compact facts plus product URLs';
    el.textContent = `${modeText}: about ${estimate.estimatedTokens.toLocaleString()} input tokens (${estimate.charCount.toLocaleString()} characters) before stage instructions.`;
    return;
  }
  el.textContent = 'Payload estimate is unavailable in this browser context.';
}

async function openAiOptionsModal(productIndexes, providerId = 'auto', runMode = 'integrated') {
  if (runMode === 'integrated' && aiRunInProgress) {
    toast.show('AI analysis is already running. Wait for this run to finish before starting another one.', 'error');
    return;
  }
  const products = await getAiOptionsProducts(productIndexes);
  if (!products.length) { toast.show('No products selected for AI analysis', 'error'); return; }
  pendingAiRunOptions = { productIndexes, providerId, runMode };
  setAiOptionsInModal(await getRecommendedAiOptions(productIndexes));
  const title = document.querySelector('#aiOptionsModal .ai-options-title h2');
  const help = document.querySelector('#aiOptionsModal .ai-options-title p');
  const runBtn = document.getElementById('aiOptionsRun');
  if (title) title.textContent = runMode === 'manual' ? 'Create Manual AI Prompt' : 'Analyze with AI';
  if (help) {
    help.textContent = runMode === 'manual'
      ? 'Choose what the manual prompt should ask for before ShopScout opens the manual AI page.'
      : 'Choose what ShopScout should check before the connected AI run starts.';
  }
  if (runBtn) runBtn.textContent = runMode === 'manual' ? 'Create Prompt' : 'Run Analysis';
  updateAiOptionsStatus();
  await updatePromptPayloadEstimate();
  document.getElementById('aiOptionsModal')?.classList.add('active');
}

function closeAiOptionsModal() {
  document.getElementById('aiOptionsModal')?.classList.remove('active');
  pendingAiRunOptions = null;
}

function bindAiOptionsEvents() {
  const modal = document.getElementById('aiOptionsModal');
  if (!modal) return;
  aiOptionInputs().forEach(input => input.addEventListener('change', updateAiOptionsStatus));
  payloadModeInputs().forEach(input => input.addEventListener('change', updatePromptPayloadEstimate));
  document.getElementById('aiOptionsClose')?.addEventListener('click', closeAiOptionsModal);
  document.getElementById('aiOptionsCancel')?.addEventListener('click', closeAiOptionsModal);
  document.getElementById('aiOptionsRecommended')?.addEventListener('click', async () => {
    setAiOptionsInModal(await getRecommendedAiOptions(pendingAiRunOptions?.productIndexes));
  });
  document.getElementById('aiOptionsAll')?.addEventListener('click', () => {
    const all = {};
    aiOptionInputs().forEach(input => { all[input.dataset.aiOption] = true; });
    setAiOptionsInModal(all);
  });
  document.getElementById('aiOptionsRun')?.addEventListener('click', async () => {
    const runBtn = document.getElementById('aiOptionsRun');
    if (runBtn?.disabled) return;
    const options = collectAiOptionsFromModal();
    if (!selectedAiOptionCount(options)) {
      toast.show('Select at least one AI check', 'error');
      return;
    }
    const promptOptions = collectPromptPayloadOptionsFromModal();
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.textContent = 'Starting...';
    }
    const run = pendingAiRunOptions || {};
    document.getElementById('aiOptionsModal')?.classList.remove('active');
    pendingAiRunOptions = null;
    try {
      if (run.runMode === 'manual') {
        await copyPrompt('deep', options, promptOptions);
        return;
      }
      await runConnectedAI(run.productIndexes, run.providerId || 'auto', options, promptOptions);
    } finally {
      updateAiOptionsStatus();
    }
  });
}

function bindAiDevMonitorEvents() {
  const closeBtn = document.getElementById('aiDevClose');
  const copyBtn = document.getElementById('aiDevCopy');
  const viewResultsBtn = document.getElementById('aiDevViewResults');
  const modal = document.getElementById('aiDevModal');

  if (closeBtn) closeBtn.addEventListener('click', () => modal?.classList.remove('active'));
  if (viewResultsBtn) viewResultsBtn.addEventListener('click', () => openAiResultsForRunId(activeAiMonitorState?.runId));
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      if (!activeAiMonitorState || !globalThis.ShopScoutAIDevMonitor) return;
      await navigator.clipboard.writeText(ShopScoutAIDevMonitor.buildCopyableLog(activeAiMonitorState));
      toast.show('AI monitor log copied');
    });
  }
  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(msg => {
      if (msg?.action === 'aiAnalysisProgress') handleAiProgressMessage(msg);
    });
  }
  document.getElementById('aiResultsBack')?.addEventListener('click', closeAiResultsPage);
}

function createAiClientRunId() {
  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openAiDevMonitor({ clientRunId, productIndexes, productCount }) {
  if (!globalThis.ShopScoutAIDevMonitor) return;
  activeAiMonitorClientRunId = clientRunId;
  activeAiMonitorState = ShopScoutAIDevMonitor.createMonitorState({
    clientRunId,
    productIndexes,
    productCount
  });
  document.getElementById('aiDevModal')?.classList.add('active');
  renderAiDevMonitor();
}

function aiProgressMatchesActive(msg) {
  if (!activeAiMonitorState) return false;
  if (msg.clientRunId && msg.clientRunId === activeAiMonitorClientRunId) return true;
  return !!(msg.runId && msg.runId === activeAiMonitorState.runId);
}

function handleAiProgressMessage(msg) {
  if (!globalThis.ShopScoutAIDevMonitor || !aiProgressMatchesActive(msg)) return;
  ShopScoutAIDevMonitor.applyProgressEvent(activeAiMonitorState, msg);
  renderAiDevMonitor();
}

function stageStatusText(status) {
  const labels = {
    pending: 'Pending',
    running: 'Running',
    completed: 'Completed',
    partial: 'Partial',
    failed: 'Failed',
    skipped: 'Skipped',
    'not-needed': 'Not needed'
  };
  return labels[status] || status || 'Pending';
}

function renderAiDevStage(stage) {
  const sources = (stage.sourceUrls || []).slice(0, 3)
    .map(url => `<a href="${escAttr(sanitizeUrl(url, '#'))}" target="_blank" rel="noopener">${esc(url)}</a>`)
    .join('<br>');
  const details = [
    stage.promptSnippet ? `<details><summary>Prompt snippet</summary><pre>${esc(stage.promptSnippet)}</pre></details>` : '',
    stage.responseSnippet ? `<details><summary>Response snippet</summary><pre>${esc(stage.responseSnippet)}</pre></details>` : '',
    stage.error ? `<div class="ai-dev-error">${esc(stage.error)}</div>` : '',
    sources ? `<div class="ai-dev-sources">${sources}</div>` : ''
  ].filter(Boolean).join('');

  return `<div class="ai-dev-stage ai-dev-stage--${escAttr(stage.status || 'pending')}">
    <div class="ai-dev-stage-head">
      <span class="ai-dev-stage-name">${esc(stage.label)}</span>
      <span class="ai-dev-status">${esc(stageStatusText(stage.status))}</span>
    </div>
    <div class="ai-dev-provider">${esc(stage.providerName || 'Provider not selected yet')}${stage.model ? ` / ${esc(stage.model)}` : ''}</div>
    ${details ? `<div class="ai-dev-stage-detail">${details}</div>` : ''}
  </div>`;
}

function renderAiDevEvent(event) {
  const extras = [
    event.error ? `<div class="ai-dev-event-error">${esc(event.error)}</div>` : '',
    event.sourceUrls?.length ? `<div class="ai-dev-event-sources">${event.sourceUrls.slice(0, 5).map(url => esc(url)).join('<br>')}</div>` : ''
  ].filter(Boolean).join('');
  return `<div class="ai-dev-event">
    <div class="ai-dev-event-time">${esc(event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '')}</div>
    <div class="ai-dev-event-body">
      <div>${esc(event.summary || event.type || '')}</div>
      ${extras}
    </div>
  </div>`;
}

function buildAiDevEventLogText(state) {
  if (!state?.events?.length) return 'Preparing AI request...';
  return state.events.slice().reverse().map(event => {
    const time = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '';
    const lines = [`[${time}] ${event.summary || event.type || ''}`];
    if (event.error) lines.push(`ERROR: ${event.error}`);
    if (event.sourceUrls?.length) {
      lines.push('Sources:');
      event.sourceUrls.slice(0, 8).forEach(url => lines.push(`  ${url}`));
    }
    return lines.join('\n');
  }).join('\n\n');
}

function renderAiDevMonitor() {
  const state = activeAiMonitorState;
  if (!state) return;
  const modal = document.getElementById('aiDevModal');
  const meta = document.getElementById('aiDevMeta');
  const progressText = document.getElementById('aiDevProgressText');
  const progressPercent = document.getElementById('aiDevProgressPercent');
  const progressFill = document.getElementById('aiDevProgressFill');
  const progressTrack = progressFill?.closest('.ai-dev-progress-track');
  const stages = document.getElementById('aiDevStages');
  const log = document.getElementById('aiDevLog');
  const viewResultsBtn = document.getElementById('aiDevViewResults');
  if (!modal || !meta || !stages || !log) return;

  const runId = state.runId || state.clientRunId || 'Preparing...';
  const percent = globalThis.ShopScoutAIDevMonitor?.getProgressPercent(activeAiMonitorState) ?? 0;
  const statusText = globalThis.ShopScoutAIDevMonitor?.getCurrentStatusText(activeAiMonitorState) || 'Waiting for AI analysis to start...';
  setTrustedHtml(meta, `
    <div><span>Run</span><strong>${esc(runId)}</strong></div>
    <div><span>Status</span><strong>${esc(stageStatusText(state.status))}</strong></div>
    <div><span>Products</span><strong>${esc(state.productIndexesText)} (${esc(String(state.productCount || 0))})</strong></div>
    <div><span>List</span><strong>${esc(state.listName || 'Current list')}</strong></div>`);
  if (progressText) progressText.textContent = statusText;
  if (progressPercent) progressPercent.textContent = `${percent}%`;
  if (progressFill) progressFill.style.width = `${percent}%`;
  if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(percent));
  setTrustedHtml(stages, state.stages.map(renderAiDevStage).join(''));
  if ('value' in log) log.value = buildAiDevEventLogText(state);
  else log.textContent = buildAiDevEventLogText(state);
  if (viewResultsBtn) {
    viewResultsBtn.hidden = !(['completed', 'partial', 'failed'].includes(state.status) && state.runId);
  }
}


function closeAiResultsPage(shouldRender = true) {
  document.getElementById('aiResultsPage')?.classList.remove('active');
  document.getElementById('urlBar').style.display = '';
  document.getElementById('filterBar').style.display = '';
  document.querySelector('.controls').style.display = '';
  document.getElementById('content').style.display = '';
  detailIndex = -1;
  if (shouldRender) renderAll();
}

async function openAiResultsForRunId(runId) {
  const data = await getData();
  const run = (data.aiRuns || []).find(item => item.id === runId);
  if (!run) {
    toast.show('AI results are not saved yet. Wait for the run to finish.', 'error');
    return;
  }
  renderAiResultsPage(run, buildRunProductList(data, run));
}

function latestAiRunForActiveList(data) {
  const runs = Array.isArray(data?.aiRuns) ? data.aiRuns : [];
  return runs.find(run => run.listName === data.activeList) || null;
}

async function openLatestAiResults() {
  const data = await getData();
  const run = latestAiRunForActiveList(data);
  if (!run) {
    toast.show(`No AI analysis results saved for ${data.activeList || 'this list'} yet`, 'error');
    return;
  }
  renderAiResultsPage(run, buildRunProductList(data, run));
}

async function openInitialAiResultsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const runId = params.get('aiRun');
  if (!runId) return;
  await openAiResultsForRunId(runId);
  try {
    window.history.replaceState(null, '', window.location.pathname);
  } catch {}
}

function recordAiDevLocalFailure(error) {
  if (!activeAiMonitorState || !globalThis.ShopScoutAIDevMonitor) return;
  ShopScoutAIDevMonitor.applyProgressEvent(activeAiMonitorState, {
    type: 'run-failed',
    clientRunId: activeAiMonitorClientRunId,
    status: 'failed',
    error: error || 'AI analysis failed'
  });
  renderAiDevMonitor();
}

function recordAiDevLocalEvent(message, type = 'local-info') {
  if (!activeAiMonitorState || !globalThis.ShopScoutAIDevMonitor) return;
  ShopScoutAIDevMonitor.applyProgressEvent(activeAiMonitorState, {
    type,
    clientRunId: activeAiMonitorClientRunId,
    message
  });
  renderAiDevMonitor();
}

async function showAiRunResults(run) {
  document.getElementById('aiDevModal')?.classList.remove('active');
  if (!run) return;
  const data = await getData();
  renderAiResultsPage(run, buildRunProductList(data, run));
  await renderAiTokenUsageText();
}

async function runConnectedAI(productIndexes, providerId = 'auto', analysisOptions, promptOptions) {
  if (aiRunInProgress) {
    toast.show('AI analysis is already running. Wait for this run to finish before starting another one.', 'error');
    return;
  }
  const products = await getProducts();
  if (!products.length) { toast.show('No products to analyze', 'error'); return; }
  aiRunInProgress = true;
  const clientRunId = createAiClientRunId();
  const selectedCount = productIndexes?.length ? productIndexes.length : products.length;
  openAiDevMonitor({ clientRunId, productIndexes, productCount: selectedCount });
  recordAiDevLocalEvent('AI request prepared in the browser. Opening the run monitor and sending the selected products/checks to the extension background worker.');
  const btn = productIndexes?.length ? document.getElementById('detailAi') : document.getElementById('aiIntegratedTrigger');
  const original = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    btn.textContent = 'Analyzing...';
  }
  try {
    recordAiDevLocalEvent('Request sent. Waiting for the extension background worker to confirm the run started.');
    const result = await chrome.runtime.sendMessage({ action: 'runAIAnalysis', productIndexes, providerId, analysisOptions, promptOptions, devMonitor: true, clientRunId });
    toast.hide();
    if (!result?.success) {
      if (result?.run) {
        const completed = (result.run.stages || []).filter(stage => stage.status === 'completed').length;
        toast.show(`AI analysis did not complete. Showing ${completed} saved stage${completed === 1 ? '' : 's'}.`, 'error');
        recordAiDevLocalFailure(result?.error || 'AI analysis did not complete');
        await showAiRunResults(result.run);
        return;
      }
      toast.show(result?.error || 'AI analysis failed', 'error');
      recordAiDevLocalFailure(result?.error || 'AI analysis failed');
      if (String(result?.error || '').includes('No connected AI providers')) {
        openSettingsPage();
      }
      return;
    }
    const completed = (result.run?.stages || []).filter(stage => stage.status === 'completed').length;
    if (isAiRunIncomplete(result.run)) {
      toast.show(`AI analysis did not complete. Showing ${completed} saved stage${completed === 1 ? '' : 's'}.`, 'error');
    } else {
      toast.show(`AI analysis complete (${completed} stage${completed === 1 ? '' : 's'})`);
    }
    await showAiRunResults(result.run);
    await renderAiTokenUsageText();
  } catch (e) {
    toast.hide();
    recordAiDevLocalFailure(e.message || 'AI analysis failed');
    toast.show(e.message || 'AI analysis failed', 'error');
  } finally {
    aiRunInProgress = false;
    renderAiTokenUsageText();
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-disabled');
      btn.textContent = original;
    }
  }
}

// --- Copy URLs ---
async function removeProduct(idx) {
  const products = await getProducts();
  if (idx >= 0 && idx < products.length) {
    selectedProductIds.delete(productSelectionKey(products[idx], idx));
    products.splice(idx, 1);
    await saveProducts(products);
    await renderAll();
    toast.show('Removed');
  }
}

function toggleProductSelection(key, checked, container) {
  if (!key) return;
  if (checked) selectedProductIds.add(key);
  else selectedProductIds.delete(key);
  if (container) container.classList.toggle('selected', checked);
  getProducts().then(syncSelectionButtons).catch(() => {});
}

async function deleteSelectedProducts() {
  const products = await getProducts();
  const indexes = getSelectedProductIndexes(products);
  if (!indexes.length) { toast.show('No selected products', 'error'); return; }
  if (typeof globalThis.ShopScoutUI?.confirm !== 'function') {
    toast.show('Delete confirmation is unavailable. Products were not deleted.', 'error');
    return;
  }
  const proceed = await globalThis.ShopScoutUI.confirm(
    `Delete ${indexes.length} selected product(s)? This cannot be undone.`,
    { title: 'Delete selected products?', okLabel: 'Delete', kind: 'danger' }
  );
  if (!proceed) return;
  for (const idx of indexes.slice().sort((a, b) => b - a)) {
    selectedProductIds.delete(productSelectionKey(products[idx], idx));
    products.splice(idx, 1);
  }
  await saveProducts(products);
  await renderAll();
  toast.show(`Deleted ${indexes.length} selected product(s)`);
}

// --- Clear ---
async function clearProducts() {
  const products = await getProducts();
  if (!products.length) return;
  const count = products.length;
  selectedProductIds.clear();
  await saveProducts([]);
  await renderAll();
  toast.show(`Cleared ${count} product(s)`);
}


/* =============================================================
   Grid-neutral product action API (consumed by whichever grid layer
   is mounted on #productGrid). These globals let the grid trigger
   product-detail navigation, rescan, and selection-sync without
   importing comparison.js internals.

   API surface (all exposed on globalThis for the Phase 2 grid):
     openProductDetailById(idOrItem)
         Open the detail page for a product looked up by id or URL.
     rescanProductById(idOrItem)
         Rescan a single product looked up by id or URL.
     deleteProductById(idOrItem)
         Delete a single product looked up by id or URL.
     setSelectedProductsFromIds(items)
         Sync the in-memory selection set from the grid's row
         selection so the "Rescan Selected" / "Delete Selected"
         ribbon actions see the right rows. `items` accepts
         {id,url} objects, plain id strings, or a mix.

   These previously bridged Tabulator → legacy list-index code; the
   Tabulator grid is gone (Task 11 Phase 1) but the contract is
   intentionally grid-renderer-agnostic. The Phase 2 grid should
   consume the same surface.

   Match-by-id with URL fallback handles legacy chrome.storage
   products that pre-date the id-on-save migration. */
function findProductIndexByIdOrUrl(products, idOrItem) {
  const it = (idOrItem && typeof idOrItem === 'object') ? idOrItem : { id: idOrItem };
  return products.findIndex(p => p && (
    (it.id  && (p.id === it.id || p.id === String(it.id))) ||
    (it.url && p.url === it.url)
  ));
}

globalThis.openProductDetailById = async function openProductDetailById(idOrItem) {
  const products = await getProducts();
  const idx = findProductIndexByIdOrUrl(products, idOrItem);
  if (idx >= 0) return openProductDetail(idx);
};

globalThis.rescanProductById = async function rescanProductById(idOrItem) {
  const products = await getProducts();
  const idx = findProductIndexByIdOrUrl(products, idOrItem);
  if (idx >= 0) return rescanList([idx]);
};

globalThis.deleteProductById = async function deleteProductById(idOrItem) {
  const products = await getProducts();
  const idx = findProductIndexByIdOrUrl(products, idOrItem);
  if (idx >= 0) return removeProduct(idx);
};

globalThis.setSelectedProductsFromIds = async function setSelectedProductsFromIds(items) {
  selectedProductIds.clear();
  const products = await getProducts();
  for (const raw of items || []) {
    const it = (raw && typeof raw === 'object') ? raw : { id: raw };
    const idx = products.findIndex(p => p && (
      (it.id  && (p.id === it.id || p.id === String(it.id))) ||
      (it.url && p.url === it.url)
    ));
    if (idx >= 0) selectedProductIds.add(productSelectionKey(products[idx], idx));
  }
  syncSelectionButtons(products);
};

/* Merge spec data from every shape ShopScout might hold on a product:
   p.rawSpecs[] (legacy primary), p.specs{} (legacy dict), and
   p._spec.specs / p._spec.itemDetails (new ProductSpec). Dedup by
   lowercased key, preferring entries that include a value. Returns
   [{key, value, source?}] ready for the detail table. */

// --- Export ---
/* Copy a plain-text product list to the clipboard. Unlike the AI Manual
   modal, NO prompt wrapper is added — just the fields the user picked.
   One product per block, blocks separated by a blank line.
   Options object overrides the legacy modal's DOM-driven checkboxes so the
   dashboard "Save As" page can drive this with its own picker. */
async function doCopyPlain(opts) {
  const products = await getProducts();
  if (!products.length) { toast.show('No products to copy', 'error'); return; }
  const o = opts || {};
  const includeName  = opts ? !!o.name  : !!document.getElementById('copyOptName')?.checked;
  const includeUrl   = opts ? !!o.url   : !!document.getElementById('copyOptUrl')?.checked;
  const includeBrand = opts ? !!o.brand : !!document.getElementById('copyOptBrand')?.checked;
  const includePrice = opts ? !!o.price : !!document.getElementById('copyOptPrice')?.checked;
  const includeSpecs = opts ? !!o.specs : !!document.getElementById('copyOptSpecs')?.checked;
  if (!includeName && !includeUrl && !includeBrand && !includePrice && !includeSpecs) {
    toast.show('Pick at least one field to copy', 'error');
    return;
  }
  const SH = globalThis.SSSpecHeuristic;
  const blocks = [];
  for (const p of products) {
    const lines = [];
    if (includeName) {
      const raw = String(p.title || p.productName || '(untitled)');
      lines.push(SS.dedupProductName ? SS.dedupProductName(raw) : raw);
    }
    if (includeBrand && p.brand) lines.push('Brand: ' + p.brand);
    if (includePrice && p.newPrice) lines.push('Price: ' + p.newPrice);
    if (includeUrl   && p.url)   lines.push(SS.canonicalizeProductUrl ? SS.canonicalizeProductUrl(p.url) : p.url);
    if (includeSpecs) {
      const list = SH && SH.specListOf ? SH.specListOf(p) : (Array.isArray(p.rawSpecs) ? p.rawSpecs : []);
      for (const s of list) {
        if (!s || s.key == null || s.value == null || s.value === '') continue;
        lines.push(s.key + ': ' + s.value);
      }
    }
    if (lines.length) blocks.push(lines.join('\n'));
  }
  const text = blocks.join('\n\n');
  try {
    await navigator.clipboard.writeText(text);
    toast.show('Copied ' + products.length + (products.length === 1 ? ' product' : ' products'));
    document.getElementById('exiModal')?.classList.remove('active');
    const picker = document.getElementById('exiCopyPicker');
    if (picker) picker.hidden = true;
  } catch (err) {
    console.warn('Clipboard write failed', err);
    toast.show('Could not copy', 'error');
  }
}

async function doExport(format) {
  const data = await getData();
  const products = data.lists[data.activeList] || [];
  const name = data.activeList;
  if (!products.length) { toast.show('No products to export', 'error'); return; }
  const fn = safeFilename(name);

  if (format === 'json') {
    downloadFile(JSON.stringify({ list: name, exported: new Date().toISOString(), products }, null, 2), `${fn}.json`, 'application/json');
  } else if (format === 'csv') {
    downloadFile(buildCsv(products), `${fn}.csv`, 'text/csv');
  } else if (format === 'xml') {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<shopscout list="${escXml(name)}" exported="${new Date().toISOString()}">\n`;
    products.forEach(p => {
      xml += '  <product>\n';
      for (const k of ['title','brand','newPrice','usedPrice','source','modelNumber','rating','reviewCount','url','image','notes']) {
        if (p[k]) xml += `    <${k}>${escXml(p[k])}</${k}>\n`;
      }
      xml += '  </product>\n';
    });
    xml += '</shopscout>';
    downloadFile(xml, `${fn}.xml`, 'application/xml');
  } else if (format === 'html') {
    downloadFile(buildExportHtml(products, name), `${fn}.html`, 'text/html');
  } else if (format === 'pdf') {
    const w = window.open(''); w.document.write(buildExportHtml(products, name)); w.document.close();
    setTimeout(() => w.print(), 400);
  }
  document.getElementById('exiModal').classList.remove('active');
  if (format !== 'pdf') toast.show(`Exported as ${format.toUpperCase()}`);
}

// --- Open: load a saved file as a NEW list (does not touch the active list) ---
function doOpen() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.xml,.csv';
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    try {
      const text = await file.text();
      const { imported, listName } = parseImport(text, file.name.toLowerCase());
      if (!imported.length) { toast.show('No products found', 'error'); return; }
      const data = await getData();
      /* Build a unique list name. Prefer the embedded listName from the
         file; fall back to the file basename. Append " (2)", " (3)" if
         needed to avoid clobbering an existing list. */
      const base = listName || file.name.replace(/\.[^.]+$/, '');
      let target = base, n = 2;
      while (data.lists[target]) target = base + ' (' + (n++) + ')';
      data.lists[target] = imported.slice();
      data.activeList = target;
      await saveData(data);
      await renderListSelector();
      await renderAll();
      toast.show('Opened "' + target + '" — ' + imported.length + ' product(s)');
    } catch (e) { toast.show('Open failed: ' + e.message, 'error'); }
  };
  input.click();
}

// --- Import: MERGE products into the current active list ---
function doImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.xml,.csv';
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    try {
      const text = await file.text();
      const { imported, listName } = parseImport(text, file.name.toLowerCase());
      if (!imported.length) { toast.show('No products found', 'error'); return; }
      const data = await getData();
      const target = listName || data.activeList;
      if (!data.lists[target]) data.lists[target] = [];
      data.lists[target].push(...imported);
      if (listName) data.activeList = target;
      await saveData(data);
      await renderListSelector();
      await renderAll();
      document.getElementById('exiModal').classList.remove('active');
      toast.show(`Imported ${imported.length} product(s)`);
    } catch (e) { toast.show('Import failed: ' + e.message, 'error'); }
  };
  input.click();
}

// --- List modals ---
function openListModal(mode) {
  listModalMode = mode;
  document.getElementById('listModalTitle').textContent = mode === 'rename' ? 'Rename List' : 'New List';
  document.getElementById('listNameInput').value = mode === 'rename' ? document.getElementById('listSelect').value : '';
  document.getElementById('listModal').classList.add('active');
  document.getElementById('listNameInput').focus();
}

async function saveListModal() {
  const name = document.getElementById('listNameInput').value.trim();
  if (!name) return;
  const data = await getData();
  if (listModalMode === 'new') {
    if (data.lists[name]) { toast.show('List already exists', 'error'); return; }
    data.lists[name] = [];
    data.activeList = name;
  } else {
    const old = data.activeList;
    if (name !== old) {
      if (data.lists[name]) { toast.show('Name already taken', 'error'); return; }
      data.lists[name] = data.lists[old];
      delete data.lists[old];
      data.activeList = name;
    }
  }
  await saveData(data);
  document.getElementById('listModal').classList.remove('active');
  await renderListSelector();
  await renderAll();
}


async function deleteList() {
  const data = await getData();
  if (Object.keys(data.lists).length <= 1) { toast.show('Cannot delete the last list', 'error'); return; }
  const removedName = data.activeList;
  delete data.lists[data.activeList];
  data.activeList = Object.keys(data.lists)[0];
  await saveData(data);
  await renderListSelector();
  await renderAll();
  toast.show(`Deleted "${removedName}"`);
}
