var chrome = globalThis.browser || globalThis.chrome;

const { getData, saveData, getProducts, saveProducts, esc, escAttr, escXml, sanitizeUrl, formatRatingDisplay, escapeCsvField, downloadFile, parseImport, toast } = SS;

function setTrustedHtml(target, html) {
  if (globalThis.ShopScoutSanitize?.setTrustedHtml) {
    globalThis.ShopScoutSanitize.setTrustedHtml(target, html);
    return;
  }
  if (target) target.innerHTML = html == null ? '' : String(html);
}

function startProgress(title) {
  if (!globalThis.ShopScoutUI?.progress?.start) {
    return {
      setTask() {},
      done() {},
      fail() {}
    };
  }
  return globalThis.ShopScoutUI.progress.start({ title });
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
const selectedProductIds = new Set();

const SEARCH_FIELD_DEFINITIONS = [
  { id: 'title', label: 'Titles and names' },
  { id: 'identity', label: 'Identifiers' },
  { id: 'pricing', label: 'Pricing and ratings' },
  { id: 'specs', label: 'Specs and features' },
  { id: 'notes', label: 'Notes and descriptions' }
];
const activeSearchFields = new Set(SEARCH_FIELD_DEFINITIONS.map(field => field.id));

const AI_REPORT_SECTION_DEFINITIONS = [
  { id: 'categoryBuyingFactors', label: 'Category & Buying Factors', defaultChecked: true },
  { id: 'masterComparisonTable', label: 'Master Comparison Table', defaultChecked: true },
  { id: 'discrepanciesFactChecks', label: 'Discrepancies & Fact-Checks', defaultChecked: true },
  { id: 'claimsValueReviews', label: 'Claims, Value & Reviews', defaultChecked: true },
  { id: 'riskSellerChecks', label: 'Risk & Seller Checks', defaultChecked: false },
  { id: 'finalVerdict', label: 'Final Verdict', defaultChecked: true }
];

const AI_CORE_FIELD_DEFINITIONS = [
  { id: 'core:name', label: 'Name' },
  { id: 'core:brand', label: 'Brand' },
  { id: 'core:model', label: 'Model' },
  { id: 'core:price', label: 'Price' },
  { id: 'core:rating', label: 'Rating' },
  { id: 'core:reviewCount', label: 'Review count' },
  { id: 'core:source', label: 'Source' },
  { id: 'core:url', label: 'URL' },
  { id: 'core:identifiers', label: 'Identifiers' },
  { id: 'core:category', label: 'Category' },
  { id: 'core:seller', label: 'Seller' }
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

Object.assign(globalThis, {
  getCorrectedValue,
  renderCorrectedField,
  renderCorrectedSpecValue
});

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
      ...productSpecEntries(product).flatMap(spec => [spec.key, spec.value])
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

Object.assign(globalThis, {
  getSearchableProductText,
  activateProductListForAction
});

async function renderAll() {
  /* Grid-neutral render hook. Task 11 Phase 2 registers the active grid
     on globalThis.ShopScoutGrid and keeps comparison.js out of renderer
     details. */
  const grid = globalThis.ShopScoutGrid;
  if (SS && typeof SS.flushProductRepoMirror === 'function') {
    await SS.flushProductRepoMirror();
  }
  updateProductsPageTitle();
  if (grid && typeof grid.render === 'function') return grid.render();
}

/* Keep the products page title in sync with the currently-selected list
   so the header band always names what you're looking at — same shape
   info pages use ('Vertical Packs · list name' etc.). */
async function updateProductsPageTitle() {
  const titleEl = document.getElementById('productsPageTitle');
  const subEl = document.getElementById('productsPageSubtitle');
  if (!titleEl && !subEl) return;
  try {
    const data = await getData();
    const listName = data?.activeList || 'Products';
    const products = Array.isArray(data?.lists?.[listName]) ? data.lists[listName] : [];
    if (titleEl) titleEl.textContent = listName;
    if (subEl) {
      subEl.textContent = products.length
        ? `${products.length} product${products.length === 1 ? '' : 's'} in this list.`
        : 'No products yet — add one to get started.';
    }
  } catch { /* best-effort, non-critical */ }
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

  // Toolbar buttons — list actions are mirrored across every ribbon
  // tab (File / Products / Analyze / Search), so wire by
  // data-list-action selector to catch all copies in one pass.
  document.querySelectorAll('[data-list-action="new"]').forEach(el =>
    el.addEventListener('click', () => openListModal('new')));
  document.querySelectorAll('[data-list-action="rename"]').forEach(el =>
    el.addEventListener('click', () => openListModal('rename')));
  document.querySelectorAll('[data-list-action="delete"]').forEach(el =>
    el.addEventListener('click', deleteList));
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
  document.getElementById('manualResultPasteClose')?.addEventListener('click', closeManualResultPasteModal);
  document.getElementById('manualResultPasteCancel')?.addEventListener('click', closeManualResultPasteModal);
  document.getElementById('manualResultPasteSave')?.addEventListener('click', saveManualResultPasteResult);
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

  // Content delegation — info-page interactions (export, feedback,
  // dashboard back). Old table header sort and column-menu
  // triggers were retired in Task 8 (Tabulator owns those now).
  document.getElementById('content').addEventListener('click', async e => {
    const dashboardBack = e.target.closest('[data-dashboard-back]');
    if (dashboardBack) {
      restoreProductListChrome();
      activateRibbonTab('products');
      return;
    }

    const exportFormat = e.target.closest('[data-export-format]');
    if (exportFormat && exportFormat.closest('.dashboard-export-panel')) {
      exportFormat.closest('.dashboard-format-grid')?.querySelectorAll('[data-export-format]').forEach(btn => {
        btn.classList.toggle('active', btn === exportFormat);
      });
      return;
    }

    const exportApply = e.target.closest('[data-export-apply]');
    if (exportApply) {
      await runDashboardExport();
      return;
    }
    if (e.target.closest('[data-export-reset]')) {
      openExportPage();
      return;
    }

    const verticalChoice = e.target.closest('[data-vertical-id]');
    if (verticalChoice && verticalChoice.closest('.vertical-picker-page')) {
      setVerticalPickerSelection(verticalChoice.dataset.verticalId || '');
      return;
    }

    const verticalAction = e.target.closest('[data-vertical-action]');
    if (verticalAction) {
      await handleVerticalPickerAction(verticalAction.dataset.verticalAction || '');
      return;
    }

    const feedbackAction = e.target.closest('[data-feedback-action]');
    if (feedbackAction) {
      await handleFeedbackAction(feedbackAction.dataset.feedbackAction);
      return;
    }

    const duplicateOpen = e.target.closest('[data-duplicate-open]');
    if (duplicateOpen) {
      await globalThis.openProductDetailById?.(duplicateOpen.dataset.duplicateOpen);
      return;
    }

    const duplicateDecision = e.target.closest('[data-duplicate-decision]');
    if (duplicateDecision) {
      const repo = globalThis.SSProductRepo;
      const key = duplicateDecision.dataset.candidateKey || '';
      const decision = duplicateDecision.dataset.duplicateDecision || '';
      if (!repo || typeof repo.getActiveListId !== 'function' || typeof repo.setDuplicateCandidateDecision !== 'function') {
        toast.show('Duplicate review storage is not available.', 'error');
        return;
      }
      const listId = await repo.getActiveListId();
      const result = await repo.setDuplicateCandidateDecision(listId, key, decision);
      if (!result?.ok) {
        toast.show('Could not save duplicate decision.', 'error');
        return;
      }
      toast.show(decision ? 'Duplicate decision saved.' : 'Duplicate decision cleared.');
      await openDuplicateReviewPage();
      return;
    }

    const normalizationAction = e.target.closest('[data-normalization-action]');
    if (normalizationAction) {
      const repo = globalThis.SSProductRepo;
      const action = normalizationAction.dataset.normalizationAction || '';
      if (!repo || typeof repo.getActiveListId !== 'function' || typeof repo.saveNormalizationReviewDecision !== 'function') {
        toast.show('Normalization rule storage is not available.', 'error');
        return;
      }
      const listId = await repo.getActiveListId();
      const result = await repo.saveNormalizationReviewDecision(listId, {
        action,
        item: {
          reviewKey: normalizationAction.dataset.reviewKey || '',
          productId: normalizationAction.dataset.productId || '',
          rawField: normalizationAction.dataset.rawField || '',
          field: normalizationAction.dataset.field || '',
          raw: normalizationAction.dataset.rawValue || '',
          normalized: normalizationAction.dataset.normalizedValue || ''
        }
      });
      if (!result?.ok) {
        toast.show('Could not save normalization decision.', 'error');
        return;
      }
      toast.show(action === 'ignore' ? 'Normalization item ignored.' : 'Alias saved to user rules.');
      await openNormalizationReviewPage();
      return;
    }

    const normalizationBulkAll = e.target.closest('[data-normalization-bulk-all]');
    if (normalizationBulkAll) {
      const repo = globalThis.SSProductRepo;
      const action = normalizationBulkAll.dataset.normalizationBulkAll || '';
      if (!repo || typeof repo.getActiveListId !== 'function' || typeof repo.saveNormalizationReviewDecision !== 'function') {
        toast.show('Normalization rule storage is not available.', 'error');
        return;
      }
      const items = await collectCurrentNormalizationReviewItems();
      if (!items.length) {
        toast.show('Nothing left in the review queue.');
        return;
      }
      const confirmLabel = action === 'ignore' ? 'Ignore all' : 'Accept all';
      const confirmMessage = action === 'ignore'
        ? `Ignore all ${items.length} remaining item${items.length === 1 ? '' : 's'}? They will not return to the review queue for this list.`
        : `Save every remaining item's mapping as a user rule (${items.length} item${items.length === 1 ? '' : 's'})? You can edit or delete them later from User Rules.`;
      const ok = await ShopScoutUI.confirm(confirmMessage, { title: `${confirmLabel} remaining items?`, okLabel: confirmLabel });
      if (!ok) return;
      const listId = await repo.getActiveListId();
      let saved = 0;
      for (const item of items) {
        const result = await repo.saveNormalizationReviewDecision(listId, { action, item });
        if (result?.ok) saved++;
      }
      toast.show(action === 'ignore'
        ? `Ignored ${saved} item${saved === 1 ? '' : 's'}.`
        : `Saved ${saved} alias${saved === 1 ? '' : 'es'} to user rules.`);
      await openNormalizationReviewPage();
      return;
    }

    const normalizationBulkAction = e.target.closest('[data-normalization-bulk-action]');
    if (normalizationBulkAction) {
      const repo = globalThis.SSProductRepo;
      const action = normalizationBulkAction.dataset.normalizationBulkAction || '';
      if (!repo || typeof repo.getActiveListId !== 'function' || typeof repo.saveNormalizationReviewDecision !== 'function') {
        toast.show('Normalization rule storage is not available.', 'error');
        return;
      }
      const listId = await repo.getActiveListId();
      const seed = normalizationItemFromDataset(normalizationBulkAction.dataset);
      const items = (await collectCurrentNormalizationReviewItems()).filter(item => sameNormalizationSignature(item, seed));
      if (!items.length) {
        toast.show('No matching review items found.', 'error');
        return;
      }
      if (action === 'accept-alias') {
        const result = await repo.saveNormalizationReviewDecision(listId, { action, item: seed });
        if (!result?.ok) {
          toast.show('Could not save normalization decision.', 'error');
          return;
        }
        toast.show(`Alias saved for ${items.length} matching item${items.length === 1 ? '' : 's'}.`);
      } else if (action === 'ignore') {
        let saved = 0;
        for (const item of items) {
          const result = await repo.saveNormalizationReviewDecision(listId, { action, item });
          if (result?.ok) saved++;
        }
        toast.show(`Ignored ${saved} matching item${saved === 1 ? '' : 's'}.`);
      }
      await openNormalizationReviewPage();
      return;
    }

    const userRuleNew = e.target.closest('[data-user-rule-new]');
    if (userRuleNew) {
      await openNewUserRuleDialog(userRuleNew.dataset.userRuleNew || '');
      return;
    }

    const userRuleAction = e.target.closest('[data-user-rule-action]');
    if (userRuleAction) {
      const repo = globalThis.SSProductRepo;
      const action = userRuleAction.dataset.userRuleAction || '';
      if (!repo || typeof repo.getActiveListId !== 'function') {
        toast.show('User rule storage is not available.', 'error');
        return;
      }
      const listId = await repo.getActiveListId();
      const item = normalizationItemFromDataset(userRuleAction.dataset);
      let result;
      if (action === 'delete' && typeof repo.deleteUserNormalizationRule === 'function') {
        result = await repo.deleteUserNormalizationRule(listId, item);
      } else if (action === 'edit' && typeof repo.updateUserNormalizationRule === 'function') {
        const nextAlias = await globalThis.ShopScoutUI?.prompt?.('Replacement raw alias/value', {
          title: 'Edit user rule',
          defaultValue: item.raw || item.rawField || '',
          okLabel: 'Save'
        });
        if (nextAlias == null) return;
        const next = Object.assign({}, item, item.raw ? { raw: nextAlias } : { rawField: nextAlias });
        result = await repo.updateUserNormalizationRule(listId, item, next);
      }
      if (!result?.ok) {
        toast.show('Could not update user rule.', 'error');
        return;
      }
      toast.show(action === 'delete' ? 'User rule deleted.' : 'User rule updated.');
      await openNormalizationRulesPage();
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

  document.getElementById('content').addEventListener('input', e => {
    if (e.target && e.target.id === 'verticalPickerSearch') filterVerticalPickerChoices(e.target.value);
  });

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
  tabs.forEach(tab => tab.addEventListener('click', () => activateRibbonTab(tab.dataset.tab || tab.dataset.ribbonTab)));
}

function activateRibbonTab(target) {
  const shell = document.querySelector('.ribbon-shell');
  if (!shell || !target) return;
  if (target !== 'about' && document.body.classList.contains('is-info-page')) {
    restoreProductListChrome();
  }
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
  document.body.classList.remove('is-info-page', 'is-wide-info-page');
  const productsShell = document.getElementById('productsPageShell');
  if (productsShell) productsShell.hidden = false;
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
  /* Hide the WHOLE product-list page shell — not just #productGrid.
     Otherwise the "My Products / 38 products in this list." title
     band bleeds through under every info page (Save As, About,
     Help, Suggest, Report) making it look like the info page's
     title is at the bottom. */
  const productsShell = document.getElementById('productsPageShell');
  if (productsShell) productsShell.hidden = true;
  const productGrid = document.getElementById('productGrid');
  if (productGrid) productGrid.hidden = true;
  const content = document.getElementById('content');
  /* body.is-info-page (set above) lets .content show as the
     padded info pane; nothing more is needed here. */
  window.scrollTo(0, 0);
  return content;
}

function openDashboardInfoPage(title, subtitle, bodyHtml, options) {
  const content = prepareMainContentPage();
  const opts = options || {};
  document.body.classList.toggle('is-wide-info-page', Boolean(opts.wide));
  const classes = ['dashboard-page'];
  if (opts.wide) classes.push('dashboard-page--wide');
  setTrustedHtml(content, `<section class="${classes.join(' ')}">
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
        <li>File ribbon → Save As → choose fields, format, and destination.</li>
        <li>Exports can be copied to the clipboard or saved as a file.</li>
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
  openDashboardInfoPage('Save As', 'Choose what to include, then copy it or save it as a file.', `
  <div class="dashboard-export-panel">
    <section class="dashboard-export-section">
      <h3>What to include</h3>
      <div class="dashboard-copy-picker-options">
        <label><input type="checkbox" data-export-field="name" checked> Product name</label>
        <label><input type="checkbox" data-export-field="url" checked> URL</label>
        <label><input type="checkbox" data-export-field="brand" checked> Brand</label>
        <label><input type="checkbox" data-export-field="price" checked> Price</label>
        <label><input type="checkbox" data-export-field="source"> Source</label>
        <label><input type="checkbox" data-export-field="rating"> Rating</label>
        <label><input type="checkbox" data-export-field="notes"> Notes</label>
        <label><input type="checkbox" data-export-field="specs"> Specs</label>
        <label><input type="checkbox" data-export-field="aiPrompt"> AI Prompt</label>
      </div>
    </section>

    <section class="dashboard-export-section">
      <h3>Format</h3>
      <div class="dashboard-format-grid">
        <button type="button" class="active" data-export-format="txt"><strong>Plain text</strong><span>Simple product list.</span></button>
        <button type="button" data-export-format="html"><strong>HTML</strong><span>Self-contained browser page.</span></button>
        <button type="button" data-export-format="csv"><strong>CSV</strong><span>Spreadsheet-friendly table.</span></button>
        <button type="button" data-export-format="json"><strong>JSON</strong><span>Structured ShopScout data.</span></button>
        <button type="button" data-export-format="xml"><strong>XML</strong><span>Structured data export.</span></button>
        <button type="button" data-export-format="pdf"><strong>PDF</strong><span>Printable report.</span></button>
      </div>
    </section>

    <section class="dashboard-export-section">
      <h3>Destination</h3>
      <div class="dashboard-destination-grid">
        <label><input type="radio" name="dashboardExportDestination" data-export-destination="clipboard" checked> Copy to clipboard</label>
        <label><input type="radio" name="dashboardExportDestination" data-export-destination="file"> Save as file</label>
      </div>
    </section>

    <div class="dashboard-copy-picker-actions">
      <button type="button" class="dashboard-primary-action" data-export-apply>Export</button>
      <button type="button" class="dashboard-secondary-action" data-export-reset>Reset</button>
    </div>
  </div>`);
}

function showModal(id) {
  document.getElementById(id)?.classList.add('active');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

function openManualResultPasteModal() {
  const textarea = document.getElementById('manualResultPasteText');
  if (textarea) textarea.value = '';
  showModal('manualResultPasteModal');
  setTimeout(() => textarea?.focus(), 0);
}

function closeManualResultPasteModal() {
  closeModal('manualResultPasteModal');
}

function applyManualAiTableUpdates(products, text, runId) {
  const parser = globalThis.ShopScoutManualAIResultParser;
  if (!parser || typeof parser.parseTableUpdates !== 'function' || typeof parser.applyTableUpdatesToProducts !== 'function') {
    return { products, updates: [], applied: [], skipped: [] };
  }
  const updates = parser.parseTableUpdates(text);
  if (!updates.length) return { products, updates, applied: [], skipped: [] };
  const result = parser.applyTableUpdatesToProducts(products, updates, { sourceRunId: runId });
  return Object.assign({ updates }, result);
}

async function saveManualResultPasteResult() {
  const textarea = document.getElementById('manualResultPasteText');
  const text = String(textarea?.value || '').trim();
  if (!text) {
    toast.show('Paste an AI result before saving', 'error');
    return;
  }
  const data = await getData();
  const activeList = data?.activeList || document.getElementById('listSelect')?.value || 'My Products';
  const products = Array.isArray(data?.lists?.[activeList]) ? data.lists[activeList] : [];
  const createdAt = new Date().toISOString();
  const runId = `manual-${Date.now()}`;
  const updateResult = applyManualAiTableUpdates(products, text, runId);
  const stage = globalThis.ShopScoutAI?.createEvidenceEvent
    ? ShopScoutAI.createEvidenceEvent({
      providerId: 'manual-ai',
      model: 'manual paste',
      stage: 'comparison',
      status: 'completed',
      responseText: text,
      confidence: 'manual'
    })
    : {
      id: `evidence-${Date.now()}`,
      providerId: 'manual-ai',
      providerName: 'Manual AI',
      model: 'manual paste',
      stage: 'comparison',
      status: 'completed',
      timestamp: createdAt,
      prompt: '',
      responseText: text,
      parsedJson: null,
      sourceUrls: [],
      verifiesEventIds: [],
      confidence: 'manual',
      error: ''
    };
  const run = {
    id: runId,
    listName: activeList,
    productIndexes: updateResult.products.map((_, index) => index),
    productUrls: updateResult.products.map(product => product?.url || ''),
    analysisOptions: collectAiOptionsFromSectionsForProducts(normalizeAiSections(), products),
    promptOptions: { payloadMode: 'manual-paste' },
    startedAt: createdAt,
    completedAt: createdAt,
    status: 'completed',
    source: 'manual-ai',
    note: 'manual AI pasted result',
    manualTableUpdates: {
      parsed: updateResult.updates.length,
      applied: updateResult.applied.length,
      skipped: updateResult.skipped.length,
      skippedProtected: updateResult.skipped.filter(item => item.reasonSkipped === 'protected-identifier').length
    },
    stages: [stage]
  };
  if (updateResult.applied.length || updateResult.skipped.length) {
    data.lists[activeList] = updateResult.products;
  }
  const runs = Array.isArray(data.aiRuns) ? data.aiRuns.filter(item => item?.id !== run.id) : [];
  data.aiRuns = [run, ...runs].slice(0, 30);
  await saveData(data);
  closeManualResultPasteModal();
  const appliedText = updateResult.applied.length
    ? ` and applied ${updateResult.applied.length} table update${updateResult.applied.length === 1 ? '' : 's'}`
    : '';
  const skippedText = updateResult.skipped.length
    ? ` (${updateResult.skipped.length} protected/skipped)`
    : '';
  toast.show(`Manual AI result saved${appliedText}${skippedText}`);
  if (updateResult.applied.length) restoreProductListChrome();
  else renderAiResultsPage(run, buildRunProductList(data, run));
}

async function openManualAiModal() {
  await openAiOptionsModal(null, 'manual', 'manual');
}

async function openManualAiSelectorModal(mode = 'deep', count = 0) {
  const frame = document.getElementById('manualAiFrame');
  if (frame) {
    /* Re-set the src each time so the iframe re-reads storage even when
       the modal was opened before. (Setting the same URL still triggers a
       reload because we add a cache-busting param.) */
    const params = new URLSearchParams({ mode, count: String(count || 0), t: String(Date.now()) });
    frame.setAttribute('src', chrome.runtime.getURL(`ai-select.html?${params.toString()}`));
  }
  showModal('manualAiModal');
}

async function openSettingsPage() {
  const content = prepareMainContentPage();
  if (globalThis.ShopScoutSettings && typeof globalThis.ShopScoutSettings.mount === 'function') {
    await globalThis.ShopScoutSettings.mount(content);
    return;
  }
  setTrustedHtml(content, `<section class="dashboard-page">
    <header class="dashboard-page-head">
      <div>
        <h2>Settings</h2>
        <p>Settings could not load in this dashboard session.</p>
      </div>
      <button class="rb-btn-sm" type="button" data-dashboard-back>Back to Products</button>
    </header>
    <div class="dashboard-page-body"><p>Reload the extension package and open Settings again.</p></div>
  </section>`);
}

function duplicateCandidateProductCard(product, fallbackTitle) {
  const title = product?.title || product?.productName || fallbackTitle || 'Untitled product';
  const image = sanitizeUrl(product?.image || product?.mainImage || '');
  const source = product?.source || product?.retailer || 'Unknown source';
  const price = product?.newPrice || product?.price || '';
  return `<article class="duplicate-product-card">
    <div class="duplicate-product-thumb">${image ? `<img src="${escAttr(image)}" alt="">` : '<span>No image</span>'}</div>
    <div class="duplicate-product-main">
      <h4 title="${escAttr(title)}">${esc(truncateText(title, 76))}</h4>
      <p>${esc(source)}${price ? ` · ${esc(price)}` : ''}</p>
      ${product?.id ? `<button class="dashboard-secondary-action dashboard-secondary-action--small" type="button" data-duplicate-open="${escAttr(product.id)}">Open product</button>` : ''}
    </div>
  </article>`;
}

function duplicateEvidenceHtml(candidate) {
  const evidence = Array.isArray(candidate.evidence) ? candidate.evidence : [];
  const shared = Array.isArray(candidate.sharedIdentifiers) ? candidate.sharedIdentifiers : [];
  const items = [
    ...evidence,
    ...shared.map(value => `shared normalized identifier: ${value}`)
  ].filter(Boolean);
  if (!items.length) return '<p class="dashboard-muted">No detailed evidence recorded.</p>';
  return `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
}

async function loadDuplicateCandidateRows() {
  const repo = globalThis.SSProductRepo;
  if (repo && typeof repo.getActiveListId === 'function' && typeof repo.findDuplicateCandidates === 'function') {
    const listId = await repo.getActiveListId();
    const products = listId && typeof repo.listProducts === 'function' ? await repo.listProducts(listId) : [];
    const candidates = listId ? await repo.findDuplicateCandidates(listId) : [];
    return { products, candidates };
  }
  const products = await getProducts();
  const matcher = globalThis.ShopScoutMatching;
  const candidates = matcher && typeof matcher.detectDuplicateCandidates === 'function'
    ? matcher.detectDuplicateCandidates(products)
    : [];
  return { products, candidates };
}

async function openDuplicateReviewPage() {
  const data = await getData();
  const { products, candidates } = await loadDuplicateCandidateRows();
  const byId = new Map();
  (products || []).forEach((product, idx) => {
    if (product?.id) byId.set(String(product.id), product);
    if (product?.url) byId.set(String(product.url), product);
    byId.set(`product-${idx + 1}`, product);
  });

  const body = !candidates.length
    ? `<div class="dashboard-empty">
        <h3>No likely duplicates found</h3>
        <p>ShopScout checked normalized identifiers, model numbers, brand/manufacturer similarity, and title token overlap. Nothing crossed the review threshold.</p>
      </div>`
    : `<div class="duplicate-review-list">
        ${candidates.map((candidate, index) => {
          const ids = candidate.productIds || [];
          const left = byId.get(String(ids[0])) || null;
          const right = byId.get(String(ids[1])) || null;
          return `<section class="duplicate-review-group">
            <header>
              <div>
                <h3>Possible duplicate ${index + 1}</h3>
                <p>${esc(candidate.reason || 'candidate-match')}</p>
              </div>
              <div class="duplicate-review-status">
                ${candidate.reviewDecision ? `<span class="duplicate-decision">${esc(candidate.reviewDecision.replace(/-/g, ' '))}</span>` : ''}
                <span class="duplicate-score">${Math.round(Number(candidate.score || 0) * 100)}%</span>
              </div>
            </header>
            <div class="duplicate-review-products">
              ${duplicateCandidateProductCard(left, candidate.titles?.[0])}
              ${duplicateCandidateProductCard(right, candidate.titles?.[1])}
            </div>
            <div class="duplicate-evidence">
              <h4>Evidence</h4>
              ${duplicateEvidenceHtml(candidate)}
            </div>
            <div class="duplicate-review-actions">
              <button class="dashboard-secondary-action dashboard-secondary-action--small" type="button" data-duplicate-decision="not-duplicate" data-candidate-key="${escAttr(candidate.candidateKey || '')}">Not duplicate</button>
              <button class="dashboard-primary-action dashboard-secondary-action--small" type="button" data-duplicate-decision="same-product" data-candidate-key="${escAttr(candidate.candidateKey || '')}">Same product</button>
              ${candidate.reviewDecision ? `<button class="dashboard-secondary-action dashboard-secondary-action--small" type="button" data-duplicate-decision="" data-candidate-key="${escAttr(candidate.candidateKey || '')}">Clear decision</button>` : ''}
            </div>
          </section>`;
        }).join('')}
      </div>`;

  openDashboardInfoPage(
    'Possible Duplicates',
    `${data.activeList || 'Current list'} · ${candidates.length} candidate group${candidates.length === 1 ? '' : 's'} · review only`,
    body
  );
}

function normalizationItemFromDataset(dataset) {
  return {
    reviewKey: dataset.reviewKey || '',
    productId: dataset.productId || '',
    rawField: dataset.rawField || '',
    field: dataset.field || '',
    raw: dataset.rawValue || '',
    normalized: dataset.normalizedValue || ''
  };
}

function normalizationReviewProjection(items) {
  const rows = (items || []).map((item, index) => {
    const confidence = Math.round(Number(item.confidence || 0) * 100);
    return Object.assign({}, item, {
      id: item.reviewKey ? `${item.reviewKey}|${index}` : `normalization-review-${index}`,
      productTitle: item.productTitle || 'Product',
      category: item.category || '-',
      reason: item.reason || 'review',
      confidenceLabel: `${confidence}%`,
      rule: item.rule || 'unmapped'
    });
  });
  return {
    mode: 'normalizationReview',
    columns: [
      { id: 'product', name: 'Product', field: 'productTitle', type: 'normalizationProduct',
        toolTip: 'The product this normalization decision belongs to.' },
      { id: 'category', name: 'Category', field: 'category', type: 'text',
        toolTip: 'The vertical/category detected for this product.' },
      { id: 'fieldPair', name: 'Field', field: 'rawField', type: 'normalizationPair', rawField: 'rawField', normalizedField: 'field',
        toolTip: 'Raw attribute name from the source page → what ShopScout would normalize it to.' },
      { id: 'valuePair', name: 'Value', field: 'raw', type: 'normalizationPair', rawField: 'raw', normalizedField: 'normalized',
        toolTip: 'Raw value from the source page → normalized value ShopScout would use.' },
      { id: 'actions', name: '', field: '_actions', type: 'normalizationActions' }
    ],
    rows
  };
}

function mountNormalizationReviewGrid(items) {
  const host = document.getElementById('normalizationReviewGrid');
  if (!host) return null;
  const adapter = globalThis.ShopScoutAgGridAdapter;
  if (!adapter || typeof adapter.create !== 'function') {
    const message = document.createElement('div');
    message.className = 'ss-grid-empty';
    message.textContent = 'Grid engine runtime is not available.';
    host.replaceChildren(message);
    return null;
  }
  host.classList.add('ss-grid-host', 'ag-theme-shopscout', 'normalization-review-grid');
  return adapter.create(host, normalizationReviewProjection(items), {});
}

function sameNormalizationSignature(a, b) {
  const fields = ['rawField', 'field', 'raw', 'normalized'];
  return fields.every(field => String(a?.[field] || '').trim().toLowerCase() === String(b?.[field] || '').trim().toLowerCase());
}

async function collectCurrentNormalizationReviewItems() {
  const repo = globalThis.SSProductRepo;
  const listId = repo && typeof repo.getActiveListId === 'function' ? await repo.getActiveListId() : '';
  const products = listId && repo && typeof repo.listProducts === 'function'
    ? await repo.listProducts(listId)
    : await getProducts();
  const reviewer = globalThis.ShopScoutNormalizationReview;
  return reviewer && typeof reviewer.collectNormalizationReviewItems === 'function'
    ? reviewer.collectNormalizationReviewItems(products)
    : [];
}

async function getActiveRepoListContext() {
  const repo = globalThis.SSProductRepo;
  const listId = repo && typeof repo.getActiveListId === 'function' ? await repo.getActiveListId() : '';
  const lists = listId && repo && typeof repo.listLists === 'function' ? await repo.listLists() : [];
  const list = lists.find(item => item.id === listId) || null;
  const products = listId && repo && typeof repo.listProducts === 'function' ? await repo.listProducts(listId) : [];
  return { repo, listId, list, products };
}

function verticalPickerCard(vertical, selectedId) {
  const id = String(vertical?.id || '');
  const active = id && id === selectedId;
  const size = Number(vertical?.packBytes || 0);
  const sizeLabel = size > 0 ? `${Math.max(1, Math.round(size / 1024))} KB pack` : 'Bundled defaults until pack is published';
  return `<button class="vertical-picker-card${active ? ' active' : ''}" type="button"
      data-vertical-id="${escAttr(id)}"
      data-vertical-name="${escAttr(vertical?.displayName || id)}">
      <span class="vertical-picker-card-title">${esc(vertical?.displayName || id)}</span>
      <span class="vertical-picker-card-meta">${esc(sizeLabel)}</span>
    </button>`;
}

function setVerticalPickerSelection(verticalId) {
  const selected = String(verticalId || '');
  const input = document.getElementById('verticalPickerSelected');
  if (input) input.value = selected;
  document.querySelectorAll('.vertical-picker-card').forEach(card => {
    card.classList.toggle('active', card.dataset.verticalId === selected);
  });
}

function filterVerticalPickerChoices(query) {
  const needle = String(query || '').trim().toLowerCase();
  document.querySelectorAll('.vertical-picker-card').forEach(card => {
    const text = `${card.dataset.verticalName || ''} ${card.dataset.verticalId || ''}`.toLowerCase();
    card.hidden = Boolean(needle && !text.includes(needle));
  });
}

async function handleVerticalPickerAction(action) {
  const { repo, listId, products } = await getActiveRepoListContext();
  if (!repo || !listId || typeof repo.setListVertical !== 'function') {
    toast.show('Vertical settings are not available.', 'error');
    return;
  }
  const selectedId = document.getElementById('verticalPickerSelected')?.value || '';
  if (action === 'use-selected') {
    if (!selectedId) {
      toast.show('Choose a vertical first.', 'error');
      return;
    }
    const progress = startProgress('Updating vertical pack');
    try {
      progress.setTask(1, 3, 'Applying selected vertical...');
      await repo.setListVertical(listId, { verticalId: selectedId, source: 'manual-picker', confidence: 1 });
      if (typeof repo.rebuildNormalizationForList === 'function') {
        progress.setTask(2, 3, `Rebuilding normalization for ${products.length} products...`);
        await repo.rebuildNormalizationForList(listId);
      }
      progress.setTask(3, 3, 'Refreshing vertical picker...');
      toast.show('Vertical pack selected and normalization rebuilt.');
      await openVerticalPickerPage();
      progress.done();
    } catch (err) {
      progress.fail('Could not update vertical pack.');
      progress.done();
      console.warn('Vertical picker update failed', err);
      toast.show('Could not update vertical pack.', 'error');
    }
  } else if (action === 'use-defaults') {
    const progress = startProgress('Updating vertical pack');
    try {
      progress.setTask(1, 3, 'Switching to bundled defaults...');
      await repo.setListVertical(listId, { skip: true, source: 'bundled-defaults', confidence: 0 });
      if (typeof repo.rebuildNormalizationForList === 'function') {
        progress.setTask(2, 3, `Rebuilding normalization for ${products.length} products...`);
        await repo.rebuildNormalizationForList(listId);
      }
      progress.setTask(3, 3, 'Refreshing vertical picker...');
      toast.show('Using bundled normalization defaults for this list.');
      await openVerticalPickerPage();
      progress.done();
    } catch (err) {
      progress.fail('Could not update vertical pack.');
      progress.done();
      console.warn('Vertical picker defaults update failed', err);
      toast.show('Could not update vertical pack.', 'error');
    }
  }
}

async function openVerticalPickerPage() {
  const data = await getData();
  const { repo, listId, list, products } = await getActiveRepoListContext();
  const packs = globalThis.ShopScoutGeneratedPacks;
  if (!repo || !listId || !packs || typeof packs.ensureBundledDataLoaded !== 'function'
      || typeof globalThis.ShopScoutGeneratedPacks.listVerticals !== 'function') {
    openDashboardInfoPage('Vertical Packs', data.activeList || 'Current list',
      '<div class="dashboard-empty"><h3>Vertical pack metadata is unavailable</h3><p>ShopScout will continue using bundled normalization defaults.</p></div>');
    return;
  }

  await packs.ensureBundledDataLoaded();
  const verticals = globalThis.ShopScoutGeneratedPacks.listVerticals().sort((a, b) =>
    String(a.displayName || a.id).localeCompare(String(b.displayName || b.id)));
  const suggested = typeof packs.detectVerticalForProducts === 'function'
    ? packs.detectVerticalForProducts(products)
    : null;
  const selectedId = list?.primaryVerticalId || list?.verticalId || suggested?.verticalId || '';
  const selectedInfo = selectedId && typeof packs.getVerticalInfo === 'function' ? packs.getVerticalInfo(selectedId) : null;
  const status = list?.verticalSkipped
    ? 'Bundled defaults selected for this list.'
    : (list?.primaryVerticalId || list?.verticalId)
      ? `Selected: ${selectedInfo?.displayName || selectedId} (${list.primaryVerticalSource || list.verticalSource || 'manual'})`
      : suggested?.verticalId
        ? `Suggested: ${selectedInfo?.displayName || suggested.verticalId} · ${Math.round(Number(suggested.confidence || 0) * 100)}% confidence`
        : 'No reliable vertical detected. Choose one for richer generated normalization.';

  openDashboardInfoPage(
    'Vertical Packs',
    `${data.activeList || list?.name || 'Current list'} · generated normalization library`,
    `<div class="vertical-picker-page">
      <div class="normalization-review-note">
        <strong>${esc(status)}</strong>
        <span>Vertical packs add category-specific attribute vocabulary, comparison signals, and normalization hints. If the category is unclear, choose the closest shopping vertical or keep bundled defaults.</span>
      </div>
      <div class="vertical-picker-toolbar">
        <input id="verticalPickerSearch" class="dashboard-input" type="search" placeholder="Search verticals..." autocomplete="off">
        <input id="verticalPickerSelected" type="hidden" value="${escAttr(selectedId)}">
      </div>
      <div class="vertical-picker-grid">
        ${verticals.length ? verticals.map(vertical => verticalPickerCard(vertical, selectedId)).join('') : '<div class="dashboard-empty"><h3>No verticals available</h3></div>'}
      </div>
      <div class="dashboard-page-actions">
        <button class="dashboard-secondary-action" type="button" data-vertical-action="use-defaults">Use Bundled Defaults</button>
        <button class="dashboard-primary-action" type="button" data-vertical-action="use-selected">Use Selected Vertical</button>
      </div>
    </div>`,
    { wide: true }
  );
}

async function openNormalizationReviewPage() {
  const data = await getData();
  const repo = globalThis.SSProductRepo;
  const listId = repo && typeof repo.getActiveListId === 'function' ? await repo.getActiveListId() : '';
  if (listId && repo && typeof repo.rebuildNormalizationForList === 'function') {
    await repo.rebuildNormalizationForList(listId);
  }
  const items = await collectCurrentNormalizationReviewItems();
  const body = !items.length
    ? `<div class="dashboard-empty">
        <h3>No normalization items need review</h3>
        <p>All currently normalized attributes are either exact library matches or high-confidence deterministic mappings.</p>
      </div>`
    : `<div class="normalization-review-page">
        <div class="normalization-review-toolbar">
          <div class="normalization-review-toolbar-summary">
            <strong>${items.length} item${items.length === 1 ? '' : 's'} need review.</strong>
            Accept aliases individually below, or use the bulk actions on the right to work the whole queue in one shot.
          </div>
          <div class="normalization-review-toolbar-actions">
            <button class="dashboard-primary-action" type="button" data-normalization-bulk-all="accept-alias"
              title="Save every remaining item's raw → normalized mapping as a user rule.">Accept all as aliases</button>
            <button class="dashboard-secondary-action" type="button" data-normalization-bulk-all="ignore"
              title="Ignore every remaining item so it never returns to the queue.">Ignore all remaining</button>
          </div>
        </div>
        <div class="normalization-review-grid-wrap ss-grid-review-wrap">
          <div id="normalizationReviewGrid" class="ss-grid-host ag-theme-shopscout normalization-review-grid" aria-label="Normalization review grid"></div>
        </div>
      </div>`;

  openDashboardInfoPage(
    'Normalization Review',
    `${data.activeList || 'Current list'} · deterministic review queue`,
    body,
    { wide: true }
  );
  if (items.length) mountNormalizationReviewGrid(items);
}

function userRuleRows(rules) {
  const rows = [];
  for (const [key, aliases] of Object.entries(rules.fieldAliases || {})) {
    const canonical = rules.canonicalFields?.[key] || key;
    for (const alias of aliases || []) {
      rows.push({
        type: 'Field alias',
        field: canonical,
        rawField: alias,
        raw: '',
        normalized: '',
        reviewKey: ''
      });
    }
  }
  for (const [field, values] of Object.entries(rules.enums || {})) {
    for (const [normalized, aliases] of Object.entries(values || {})) {
      for (const alias of aliases || []) {
        rows.push({
          type: 'Value alias',
          field,
          rawField: field,
          raw: alias,
          normalized,
          reviewKey: ''
        });
      }
    }
  }
  for (const reviewKey of rules.ignored || []) {
    rows.push({
      type: 'Ignored review item',
      field: '',
      rawField: '',
      raw: '',
      normalized: '',
      reviewKey
    });
  }
  return rows;
}

function userRulesProjection(rules) {
  const rows = userRuleRows(rules).map((row, index) => Object.assign({}, row, {
    id: row.reviewKey
      ? `ignored-rule-${row.reviewKey}-${index}`
      : `user-rule-${row.type}-${row.field}-${row.rawField}-${row.raw}-${row.normalized}-${index}`,
    ruleKey: row.reviewKey || row.rawField || row.raw || '-',
    fieldLabel: row.field || '-',
    rawLabel: row.raw || row.rawField || '-',
    normalizedLabel: row.normalized || '-'
  }));
  return {
    mode: 'userRules',
    columns: [
      { id: 'type', name: 'Type', field: 'type', type: 'text', width: 170 },
      { id: 'field', name: 'Field', field: 'fieldLabel', type: 'text', width: 220 },
      { id: 'raw', name: 'Raw alias', field: 'rawLabel', type: 'text', width: 260 },
      { id: 'normalized', name: 'Normalized value', field: 'normalizedLabel', type: 'text', width: 260 },
      { id: 'ruleKey', name: 'Rule key', field: 'ruleKey', type: 'userRuleCode' },
      { id: 'actions', name: '', field: '_actions', type: 'userRuleActions' }
    ],
    rows
  };
}

function mountUserRulesGrid(rules) {
  const host = document.getElementById('userRulesGrid');
  if (!host) return null;
  const adapter = globalThis.ShopScoutAgGridAdapter;
  if (!adapter || typeof adapter.create !== 'function') {
    const message = document.createElement('div');
    message.className = 'ss-grid-empty';
    message.textContent = 'Grid engine runtime is not available.';
    host.replaceChildren(message);
    return null;
  }
  host.classList.add('ss-grid-host', 'ag-theme-shopscout', 'user-rules-grid');
  return adapter.create(host, userRulesProjection(rules), {});
}

async function openNormalizationRulesPage() {
  const repo = globalThis.SSProductRepo;
  const data = await getData();
  if (!repo || typeof repo.getActiveListId !== 'function' || typeof repo.getUserNormalizationRules !== 'function') {
    openDashboardInfoPage('User Normalization Rules', data.activeList || 'Current list', '<div class="dashboard-empty"><h3>User rules are unavailable</h3></div>');
    return;
  }
  const listId = await repo.getActiveListId();
  const rules = await repo.getUserNormalizationRules(listId);
  const hasRules = userRuleRows(rules).length > 0;
  openDashboardInfoPage(
    'User Normalization Rules',
    `${data.activeList || 'Current list'} · list-specific approved mappings`,
    `<div class="normalization-review-page">
      <div class="normalization-review-toolbar">
        <div class="normalization-review-toolbar-summary">
          <strong>${userRuleRows(rules).length} rule${userRuleRows(rules).length === 1 ? '' : 's'}.</strong>
          Add a field or value alias directly, or accept mappings from Normalization Review as you review products.
        </div>
        <div class="normalization-review-toolbar-actions">
          <button class="dashboard-primary-action" type="button" data-user-rule-new="field-alias"
            title="Map one raw attribute name (e.g. Battery Life) to another canonical name (e.g. Battery Runtime).">New field alias</button>
          <button class="dashboard-secondary-action" type="button" data-user-rule-new="value-alias"
            title="Map one raw value (e.g. 4000mAh) to a canonical value (e.g. 4Ah) for a specific attribute.">New value alias</button>
        </div>
      </div>
      ${hasRules
        ? `<div class="user-rules-grid-wrap ss-grid-review-wrap">
            <div id="userRulesGrid" class="ss-grid-host ag-theme-shopscout user-rules-grid" aria-label="User normalization rules grid"></div>
          </div>`
        : `<div class="dashboard-empty">
            <h3>No user rules yet</h3>
            <p>Use "New field alias" / "New value alias" above, or accept mappings from Normalization Review as you review products.</p>
          </div>`}
    </div>`
  );
  if (hasRules) mountUserRulesGrid(rules);
}

async function openNewUserRuleDialog(kind) {
  const repo = globalThis.SSProductRepo;
  const ui = globalThis.ShopScoutUI;
  if (!repo || typeof repo.getActiveListId !== 'function' || typeof repo.saveNormalizationReviewDecision !== 'function') {
    toast.show('User rule storage is not available.', 'error');
    return;
  }
  if (!ui || typeof ui.modal?.open !== 'function') {
    toast.show('UI modal is not available.', 'error');
    return;
  }
  const isField = kind === 'field-alias';
  const bodyHtml = isField
    ? `<div class="user-rule-form">
        <label class="user-rule-form-label" for="userRuleRawField">Raw field name (as it appears on the product page)</label>
        <input class="user-rule-form-input" id="userRuleRawField" type="text" placeholder="e.g. Battery Life" autocomplete="off">
        <label class="user-rule-form-label" for="userRuleCanonicalField">Canonical field name (what ShopScout should use)</label>
        <input class="user-rule-form-input" id="userRuleCanonicalField" type="text" placeholder="e.g. Battery Runtime" autocomplete="off">
        <p class="user-rule-form-hint">All products with the raw field will roll into the canonical field going forward.</p>
      </div>`
    : `<div class="user-rule-form">
        <label class="user-rule-form-label" for="userRuleValueField">Attribute this value belongs to</label>
        <input class="user-rule-form-input" id="userRuleValueField" type="text" placeholder="e.g. Battery Capacity" autocomplete="off">
        <label class="user-rule-form-label" for="userRuleRawValue">Raw value</label>
        <input class="user-rule-form-input" id="userRuleRawValue" type="text" placeholder="e.g. 4000mAh" autocomplete="off">
        <label class="user-rule-form-label" for="userRuleNormalizedValue">Normalized value</label>
        <input class="user-rule-form-input" id="userRuleNormalizedValue" type="text" placeholder="e.g. 4 Ah" autocomplete="off">
        <p class="user-rule-form-hint">Every occurrence of the raw value on this attribute will be rewritten to the normalized value.</p>
      </div>`;
  const trusted = ui.render.html`${ui.render.raw(bodyHtml)}`;
  const outcome = await ui.modal.open({
    title: isField ? 'New field alias' : 'New value alias',
    body: trusted,
    width: 'min(520px, 92vw)',
    actions: [
      { label: 'Cancel', value: 'cancel' },
      { label: 'Save rule', value: 'save', isDefault: true, isPrimary: true }
    ]
  });
  if (outcome !== 'save') return;
  const readVal = id => (document.getElementById(id)?.value || '').trim();
  const item = isField
    ? { rawField: readVal('userRuleRawField'), field: readVal('userRuleCanonicalField'), raw: '', normalized: '' }
    : { rawField: readVal('userRuleValueField'), field: readVal('userRuleValueField'), raw: readVal('userRuleRawValue'), normalized: readVal('userRuleNormalizedValue') };
  if (isField && (!item.rawField || !item.field)) {
    toast.show('Both raw field name and canonical field name are required.', 'error');
    return;
  }
  if (!isField && (!item.field || !item.raw || !item.normalized)) {
    toast.show('Attribute, raw value, and normalized value are all required.', 'error');
    return;
  }
  const listId = await repo.getActiveListId();
  const result = await repo.saveNormalizationReviewDecision(listId, { action: 'accept-alias', item });
  if (!result?.ok) {
    toast.show('Could not save user rule.', 'error');
    return;
  }
  toast.show(isField ? 'Field alias saved.' : 'Value alias saved.');
  await openNormalizationRulesPage();
}

function closeSettingsPage(shouldRender = true) {
  const content = document.getElementById('content');
  if (content?.querySelector('[data-settings-root]')) setTrustedHtml(content, '');
  if (shouldRender) restoreProductListChrome();
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

async function listActiveProductsForBulkLinkOpen() {
  const repo = globalThis.SSProductRepo;
  if (repo && typeof repo.getActiveListId === 'function' && typeof repo.listProducts === 'function') {
    const listId = await repo.getActiveListId();
    if (listId) return repo.listProducts(listId);
  }
  return getProducts();
}

function safeProductLink(product) {
  const url = sanitizeUrl(product?.url || product?.link || '', '');
  if (!url || !/^https?:\/\//i.test(url)) return '';
  return url;
}

async function openProductLinkInNewTab(url) {
  if (chrome?.tabs && typeof chrome.tabs.create === 'function') {
    const created = chrome.tabs.create({ url, active: false });
    if (created && typeof created.then === 'function') await created;
    return true;
  }
  const opened = window.open(url, '_blank', 'noopener');
  return Boolean(opened);
}

async function confirmOpenManyProductLinks(count) {
  const message = `This will open ${count} product link${count === 1 ? '' : 's'} in new tabs. Continue?`;
  if (typeof globalThis.ShopScoutUI?.confirm === 'function') {
    return globalThis.ShopScoutUI.confirm(message, {
      title: `Open ${count} product links?`,
      okLabel: 'Open Links'
    });
  }
  toast.show('Open confirmation is unavailable. Product links were not opened.', 'error');
  return false;
}

async function openAllProductLinks() {
  const products = await listActiveProductsForBulkLinkOpen();
  const links = Array.from(new Set((products || []).map(safeProductLink).filter(Boolean)));
  if (!links.length) {
    toast.show('No product links to open.', 'error');
    return;
  }

  if (links.length > 5) {
    const ok = await confirmOpenManyProductLinks(links.length);
    if (!ok) return;
  }

  let opened = 0;
  let failed = 0;
  for (const url of links) {
    try {
      const ok = await openProductLinkInNewTab(url);
      if (ok) opened++;
      else failed++;
    } catch (err) {
      failed++;
      console.warn('Could not open product link', err);
    }
  }

  if (opened) toast.show(`Opened ${opened} product link${opened === 1 ? '' : 's'}.`);
  if (failed) toast.show(`Could not open ${failed} product link${failed === 1 ? '' : 's'}.`, 'error');
}

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
    else if (command === 'paste-ai-result') openManualResultPasteModal();
    else if (command === 'ai-results') openLatestAiResults();
    else if (command === 'settings') openSettingsPage();
    else if (command === 'duplicate-review') openDuplicateReviewPage();
    else if (command === 'normalization-review') openNormalizationReviewPage();
    else if (command === 'vertical-picker') openVerticalPickerPage();
    else if (command === 'normalization-rules') openNormalizationRulesPage();
    else if (command === 'open-all-links') openAllProductLinks();
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

function aiSectionInputs() {
  return [...document.querySelectorAll('#aiOptionsModal [data-ai-section]')];
}

function collectAiSectionsFromModal() {
  const sections = {};
  for (const input of aiSectionInputs()) {
    sections[input.dataset.aiSection] = !!input.checked;
  }
  return sections;
}

function normalizeAiSections(input = {}) {
  const normalized = {};
  for (const section of AI_REPORT_SECTION_DEFINITIONS) {
    normalized[section.id] = Object.prototype.hasOwnProperty.call(input || {}, section.id)
      ? !!input[section.id]
      : !!section.defaultChecked;
  }
  return normalized;
}

function selectedReportSectionLabels(sections = {}) {
  const normalized = normalizeAiSections(sections);
  return AI_REPORT_SECTION_DEFINITIONS
    .filter(section => normalized[section.id])
    .map(section => section.label);
}

function collectAiOptionsFromSectionsForProducts(sections = {}, products = []) {
  const normalized = normalizeAiSections(sections);
  const recommended = globalThis.ShopScoutAI?.recommendedAnalysisOptions
    ? ShopScoutAI.recommendedAnalysisOptions(products)
    : {};
  if (recommended.sellerRisk) normalized.riskSellerChecks = true;
  return {
    verifySpecs: !!normalized.discrepanciesFactChecks,
    missingSpecs: !!normalized.discrepanciesFactChecks,
    marketingClaims: !!normalized.claimsValueReviews,
    correctConflicts: !!normalized.discrepanciesFactChecks,
    comparisonColumns: !!normalized.masterComparisonTable,
    priceValue: !!normalized.claimsValueReviews,
    reviewsRatings: !!normalized.claimsValueReviews,
    compareAll: !!normalized.masterComparisonTable,
    rebrandDuplicate: !!normalized.riskSellerChecks,
    riskSummary: !!normalized.claimsValueReviews || !!normalized.riskSellerChecks,
    sellerRisk: !!normalized.riskSellerChecks,
    finalRecommendation: !!normalized.finalVerdict
  };
}

function analysisOptionsFromSections(sections = {}) {
  return collectAiOptionsFromSectionsForProducts(sections);
}

function promptFieldId(label) {
  return String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'field';
}

function specFieldId(label) {
  return `spec:${promptFieldId(label)}`;
}

function productSpecEntries(product) {
  const access = globalThis.ShopScoutProductSpecAccess || (typeof window !== 'undefined' ? window.ShopScoutProductSpecAccess : null);
  const specs = access && typeof access.specEntries === 'function'
    ? access.specEntries(product || {})
    : Array.isArray(product?.rawSpecs)
      ? product.rawSpecs
      : Array.isArray(product?.specs)
        ? product.specs
        : [];
  return specs
    .map(spec => ({
      key: formatManualValue(spec?.rawField || spec?.key || spec?.field),
      value: formatManualValue(spec?.display ?? spec?.value ?? spec?.raw)
    }))
    .filter(spec => spec.key && spec.value);
}

function aiFieldInputs() {
  return [...document.querySelectorAll('#aiOptionsModal [data-ai-field]')];
}

function aiSelectedFieldIds() {
  return aiFieldInputs().filter(input => input.checked).map(input => input.dataset.aiField);
}

function aiAccordionChevronSvg() {
  return `<span class="ai-accordion-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>`;
}

function aiFieldAccordionHtml({ title, description, bodyHtml, active = false }) {
  return `<section class="ai-field-accordion${active ? ' active' : ''}" data-ai-field-accordion>` +
    `<button type="button" class="ai-field-accordion-trigger" data-ai-field-accordion-trigger aria-expanded="${active ? 'true' : 'false'}">` +
      `<span class="ai-field-accordion-title"><strong>${esc(title)}</strong><span>${esc(description)}</span></span>` +
      aiAccordionChevronSvg() +
    `</button>` +
    bodyHtml +
  `</section>`;
}

function bindAiFieldAccordionEvents() {
  document.querySelectorAll('#aiFieldList [data-ai-field-accordion-trigger]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const section = trigger.closest('[data-ai-field-accordion]');
      if (!section) return;
      const active = !section.classList.contains('active');
      section.classList.toggle('active', active);
      trigger.setAttribute('aria-expanded', active ? 'true' : 'false');
    });
  });
}

function renderAiFieldSelection(products) {
  const list = document.getElementById('aiFieldList');
  if (!list) return;
  const specNames = new Map();
  (products || []).forEach(product => {
    productSpecEntries(product).forEach(spec => {
      const id = specFieldId(spec.key);
      if (!specNames.has(id)) specNames.set(id, spec.key);
    });
  });
  const coreHtml = AI_CORE_FIELD_DEFINITIONS.map(field =>
    `<label class="ai-field-item" title="${escAttr(field.label)}"><input type="checkbox" data-ai-field="${escAttr(field.id)}" checked><span>${esc(field.label)}</span></label>`
  ).join('');
  const specHtml = [...specNames.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, label]) =>
    `<label class="ai-field-item" title="${escAttr(label)}"><input type="checkbox" data-ai-field="${escAttr(id)}" checked><span>${esc(label)}</span></label>`
  ).join('');
  const coreSection = aiFieldAccordionHtml({
    title: 'Core',
    description: 'Recommended identity, pricing, source, and review fields.',
    bodyHtml: `<div class="ai-field-grid">${coreHtml}</div>`,
    active: true
  });
  const specBody = specHtml
    ? `<div class="ai-field-grid">${specHtml}</div>`
    : '<p class="ai-option-hint ai-field-empty">No captured spec fields found for the selected products.</p>';
  const specSection = aiFieldAccordionHtml({
    title: 'Select Individual Meta Data',
    description: 'Captured metadata and specification columns available for this prompt.',
    bodyHtml: specBody,
    active: true
  });
  setTrustedHtml(list, coreSection + specSection);
  bindAiFieldAccordionEvents();
  aiFieldInputs().forEach(input => input.addEventListener('change', updatePromptPayloadEstimate));
}

function setAiFieldSelection(mode) {
  aiFieldInputs().forEach(input => {
    input.checked = mode === 'all' || String(input.dataset.aiField || '').startsWith('core:');
  });
  updatePromptPayloadEstimate();
}

function collectAiFieldSelectionFromModal() {
  return aiSelectedFieldIds();
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
      lines.push(`- Captured specs [each specification is an individual field (column)]:`);
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
  const options = globalThis.ShopScoutAI?.normalizePromptOptions
    ? ShopScoutAI.normalizePromptOptions(promptOptions)
    : { payloadMode: promptOptions?.payloadMode || 'compact' };
  const labels = selectedReportSectionLabels(options.reportSections);
  const payload = globalThis.ShopScoutAI?.productSummary
    ? ShopScoutAI.productSummary(products, options)
    : (products || []).map((product, index) => ({ id: index + 1, name: product.title || `Product ${index + 1}`, url: product.url || '', price: product.newPrice || '', source: product.source || '' }));
  return `You are a product comparison, verification, and buying-decision analyst for ShopScout.\n\n` +
    `# Output rules\n` +
    `Do not return JSON. Do not include a JSON object, JSON schema, code block, or raw structured data block in your answer.\n` +
    `Return a human-readable report only, with clear headings, compact tables, bullets, and short explanations.\n\n` +
    `# Payload policy & Search Directives\n` +
    `1. Prioritize the provided "Captured facts" and extract hard data, ignoring marketing fluff.\n` +
    `2. Only initiate a web search if a primary buying factor (e.g., core specs, materials, compatibility) is missing, or if the provided data contains contradictions. Do not search for minor details.\n` +
    `3. Use product URLs only as source references.\n` +
    `4. If browsing/retrieval is unavailable or fails, state it clearly and mark those items as "not independently verified."\n` +
    `${buildManualPromptPayloadInstructions(options)}\n` +
    `# Selected report sections\n${labels.map(label => `- ${label}`).join('\n') || '- None'}\n\n` +
    `# Analysis rules\n` +
    `1. First, identify the product category/subcategory and product line.\n` +
    `2. Determine the most important buying factors for that product line and use them to dynamically build comparison columns.\n` +
    `3. For missing or corrected data, you MUST use this exact format: Listed value → Corrected value → Reason/source → Confidence.\n` +
    `4. Mark important marketing claims as: Verified, Listing-only, Contradictory, Missing, or Unverifiable.\n` +
    `5. Use strict confidence levels: High = official/manufacturer site or strong authoritative match; Medium = consistent reliable secondary sources; Low = listing-only, unclear, or weak evidence.\n\n` +
    `# Report format\n` +
    `1. Category & Buying Factors: Briefly define the category and the criteria used for comparison.\n` +
    `2. Master Comparison Table: The dynamic table comparing the products across key factors.\n` +
    `3. Discrepancies & Fact-Checks: Consolidate all missing specs, corrected data, and verification checks here using the required arrow syntax.\n` +
    `4. Claims, Value & Reviews: Analyze major marketing claims, price-to-value ratio, and overall user review consensus.\n` +
    `5. Final Verdict: Clear, use-case driven recommendations (e.g., "Best for X", "Best Value").\n\n` +
    `# ShopScout paste-back update table\n` +
    `At the end of the report, include a section titled exactly: ShopScout Table Updates.\n` +
    `Only include rows where ShopScout should update the main product table.\n` +
    `Use this exact markdown table:\n` +
    `| Product # | Product name | Field | Current/listed value | Recommended value | Update type | Confidence | Reason |\n` +
    `|---|---|---|---|---|---|---|---|\n` +
    `Rules for ShopScout Table Updates:\n` +
    `- Product # must match the Product # from the provided facts.\n` +
    `- Field must match one of the provided captured fields/spec names when possible.\n` +
    `- If the field is missing from ShopScout, write Field as: New field: [field name].\n` +
    `- Update type must be one of: Correct value, Normalize value, Mark invalid, Add missing field, Move value to better field.\n` +
    `- Confidence must be High, Medium, or Low.\n` +
    `- Include table rows for values that should directly correct or normalize ShopScout's main table.\n` +
    `- Do not include identifiers such as ASIN, UPC, GTIN, EAN, SKU, MPN, or model number unless the provided data is clearly contradictory.\n` +
    `- Do not put commentary inside this table; put commentary in the readable report sections above.\n\n` +
    `# Product facts\n${formatManualProductFacts(payload)}\n\n` +
    `Return a concise, readable report with tables first, explanations after, and confidence/verification status for important claims.`;
}

async function copyPrompt(mode, analysisOptions, promptOptions) {
  const products = await getProducts();
  if (!products.length) { toast.show('No products to copy', 'error'); return; }
  const promptText = buildManualHybridPrompt(products, analysisOptions, promptOptions) + buildManualAnalysisOptionsInstructions(analysisOptions, promptOptions);
  await navigator.clipboard.writeText(promptText);
  await chrome.storage.local.set({ shopscout_last_prompt: promptText });
  await openManualAiSelectorModal(mode, products.length);
}

function aiOptionInputs() {
  return aiSectionInputs();
}

function payloadModeInputs() {
  return [...document.querySelectorAll('#aiOptionsModal [data-payload-mode]')];
}

function collectPromptPayloadOptionsFromModal() {
  const selected = payloadModeInputs().find(input => input.checked);
  const payloadMode = selected?.value || selected?.dataset.payloadMode || 'compact';
  const includedFields = collectAiFieldSelectionFromModal();
  const reportSections = collectAiSectionsFromModal();
  return globalThis.ShopScoutAI?.normalizePromptOptions
    ? ShopScoutAI.normalizePromptOptions({ payloadMode, includedFields, reportSections })
    : { payloadMode, includedFields, reportSections };
}

function collectAiOptionsFromModal(products = []) {
  const sections = collectAiSectionsFromModal();
  const options = products.length
    ? collectAiOptionsFromSectionsForProducts(sections, products)
    : analysisOptionsFromSections(sections);
  return globalThis.ShopScoutAI?.normalizeAnalysisOptions
    ? ShopScoutAI.normalizeAnalysisOptions(options)
    : options;
}

function selectedAiOptionCount() {
  return Object.values(collectAiSectionsFromModal()).filter(Boolean).length;
}

function setAiOptionsInModal(options) {
  const normalized = normalizeAiSections(options);
  for (const input of aiOptionInputs()) {
    input.checked = !!normalized[input.dataset.aiSection];
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
  const sections = normalizeAiSections();
  const recommended = globalThis.ShopScoutAI?.recommendedAnalysisOptions
    ? ShopScoutAI.recommendedAnalysisOptions(products)
    : {};
  if (recommended.sellerRisk || recommended.rebrandDuplicate || recommended.riskSummary) sections.riskSellerChecks = true;
  return sections;
}

function updateAiOptionsStatus() {
  const status = document.getElementById('aiOptionsStatus');
  const runBtn = document.getElementById('aiOptionsRun');
  if (!status || !runBtn) return;
  const count = selectedAiOptionCount();
  const fieldCount = collectAiFieldSelectionFromModal().length;
  status.textContent = count ? `${count} section${count === 1 ? '' : 's'}, ${fieldCount} field${fieldCount === 1 ? '' : 's'} selected` : 'Select at least one report section';
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
    const fieldCount = collectAiFieldSelectionFromModal().length;
    el.textContent = `${modeText}: ${fieldCount} selected field${fieldCount === 1 ? '' : 's'}, about ${estimate.estimatedTokens.toLocaleString()} input tokens (${estimate.charCount.toLocaleString()} characters) before stage instructions.`;
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
  renderAiFieldSelection(products);
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
  collapseAiAccordionSections();
  document.getElementById('aiOptionsModal')?.classList.add('active');
}

function closeAiOptionsModal() {
  document.getElementById('aiOptionsModal')?.classList.remove('active');
  pendingAiRunOptions = null;
}

function setAiAccordionSectionExpanded(section, active) {
  const target = section?.closest?.('[data-ai-accordion-section]') || section;
  if (!target) return;
  target.classList.toggle('active', active);
  target.querySelector('[data-ai-accordion-trigger]')?.setAttribute('aria-expanded', active ? 'true' : 'false');
}

function toggleAiAccordionSection(section) {
  const target = section?.closest?.('[data-ai-accordion-section]') || section;
  if (!target) return;
  setAiAccordionSectionExpanded(target, !target.classList.contains('active'));
}

function collapseAiAccordionSections() {
  document.querySelectorAll('#aiOptionsModal [data-ai-accordion-section]').forEach(item => {
    setAiAccordionSectionExpanded(item, false);
  });
}

function bindAiOptionsEvents() {
  const modal = document.getElementById('aiOptionsModal');
  if (!modal) return;
  modal.querySelectorAll('[data-ai-accordion-trigger]').forEach(trigger => {
    trigger.addEventListener('click', () => toggleAiAccordionSection(trigger));
  });
  aiOptionInputs().forEach(input => input.addEventListener('change', () => {
    updateAiOptionsStatus();
    updatePromptPayloadEstimate();
  }));
  payloadModeInputs().forEach(input => input.addEventListener('change', updatePromptPayloadEstimate));
  document.getElementById('aiFieldsCore')?.addEventListener('click', () => setAiFieldSelection('core'));
  document.getElementById('aiFieldsAll')?.addEventListener('click', () => setAiFieldSelection('all'));
  document.getElementById('aiOptionsClose')?.addEventListener('click', closeAiOptionsModal);
  document.getElementById('aiOptionsCancel')?.addEventListener('click', closeAiOptionsModal);
  document.getElementById('aiOptionsRecommended')?.addEventListener('click', async () => {
    setAiOptionsInModal(await getRecommendedAiOptions(pendingAiRunOptions?.productIndexes));
  });
  document.getElementById('aiOptionsAll')?.addEventListener('click', () => {
    const all = {};
    aiOptionInputs().forEach(input => { all[input.dataset.aiSection] = true; });
    setAiOptionsInModal(all);
  });
  document.getElementById('aiOptionsRun')?.addEventListener('click', async () => {
    const runBtn = document.getElementById('aiOptionsRun');
    if (runBtn?.disabled) return;
    const run = pendingAiRunOptions || {};
    const products = await getAiOptionsProducts(run.productIndexes);
    const options = collectAiOptionsFromModal(products);
    if (!selectedAiOptionCount()) {
      toast.show('Select at least one report section', 'error');
      return;
    }
    if (!collectAiFieldSelectionFromModal().length) {
      toast.show('Select at least one product field', 'error');
      return;
    }
    const promptOptions = collectPromptPayloadOptionsFromModal();
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.textContent = 'Starting...';
    }
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
    const removed = products[idx];
    selectedProductIds.delete(productSelectionKey(removed, idx));
    products.splice(idx, 1);
    await saveProducts(products);
    if (!removed?.id || !await globalThis.ShopScoutGrid?.deleteRow?.(removed.id)) {
      await renderAll();
    } else {
      syncSelectionButtons(products);
    }
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
const EXPORT_FIELDS = [
  { id: 'name', label: 'Product name' },
  { id: 'url', label: 'URL' },
  { id: 'brand', label: 'Brand' },
  { id: 'price', label: 'Price' },
  { id: 'source', label: 'Source' },
  { id: 'rating', label: 'Rating' },
  { id: 'notes', label: 'Notes' },
  { id: 'specs', label: 'Specs' },
  { id: 'aiPrompt', label: 'AI Prompt', exportSection: true }
];

function localDateStamp(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function safeExportFileStem(listName) {
  const safeList = String(listName || 'List')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'List';
  return `ShopScout - ${safeList} - ${localDateStamp()}`;
}

function selectedExportFields(rootNode) {
  const container = rootNode || document;
  const selected = EXPORT_FIELDS
    .filter(field => !!container.querySelector(`[data-export-field="${field.id}"]`)?.checked)
    .map(field => field.id);
  return selected.length ? selected : ['name', 'url'];
}

function productDisplayName(product) {
  const raw = String(product?.productName || product?.structuredProductName || product?.title || '(untitled)');
  return SS.dedupProductName ? SS.dedupProductName(raw) : raw;
}

function exportSpecEntries(product) {
  const SH = globalThis.SSSpecHeuristic;
  const access = globalThis.ShopScoutProductSpecAccess || (typeof window !== 'undefined' ? window.ShopScoutProductSpecAccess : null);
  const list = access && typeof access.specEntries === 'function'
    ? access.specEntries(product || {})
    : SH && SH.specListOf
      ? SH.specListOf(product)
      : Array.isArray(product?.rawSpecs)
        ? product.rawSpecs
        : [];
  return (Array.isArray(list) ? list : [])
    .filter(spec => spec && (spec.rawField || spec.key || spec.field) != null && (spec.display ?? spec.value ?? spec.raw) != null && (spec.display ?? spec.value ?? spec.raw) !== '')
    .map(spec => ({
      key: String(spec.rawField || spec.key || spec.field),
      value: String(spec.display ?? spec.value ?? spec.raw)
    }));
}

function exportRecord(product, fields) {
  const record = {};
  if (fields.includes('name')) record.name = productDisplayName(product);
  if (fields.includes('url')) record.url = product?.url && SS.canonicalizeProductUrl ? SS.canonicalizeProductUrl(product.url) : (product?.url || '');
  if (fields.includes('brand')) record.brand = product?.brand || '';
  if (fields.includes('price')) {
    record.price = product?.newPrice || '';
    if (product?.usedPrice) record.usedPrice = product.usedPrice;
  }
  if (fields.includes('source')) record.source = product?.source || '';
  if (fields.includes('rating')) record.rating = formatRatingDisplay(product?.rating || '', product?.reviewCount || '');
  if (fields.includes('notes')) record.notes = product?.notes || '';
  if (fields.includes('specs')) record.specs = exportSpecEntries(product);
  return record;
}

function exportRecords(products, fields) {
  return products.map(product => exportRecord(product, fields));
}

function buildExportAiPrompt(products) {
  try {
    const promptText = buildManualHybridPrompt(products, null, null)
      + buildManualAnalysisOptionsInstructions(null, null);
    return String(promptText || '').trim();
  } catch (err) {
    console.warn('Could not build export AI prompt', err);
    return '';
  }
}

function exportRecordLines(record) {
  const lines = [];
  for (const field of EXPORT_FIELDS) {
    const value = record[field.id];
    if (field.id === 'specs') {
      if (Array.isArray(record.specs) && record.specs.length) {
        lines.push('Specs:');
        record.specs.forEach(spec => lines.push(`  ${spec.key}: ${spec.value}`));
      }
      continue;
    }
    if (value == null || value === '') continue;
    lines.push(`${field.label}: ${value}`);
  }
  if (record.usedPrice) lines.push(`Used price: ${record.usedPrice}`);
  return lines;
}

function buildExportText(records) {
  return records.map(record => exportRecordLines(record).join('\n')).filter(Boolean).join('\n\n');
}

function appendAiPromptText(content, aiPrompt) {
  if (!aiPrompt) return content;
  return [content, `AI Prompt:\n${aiPrompt}`].filter(Boolean).join('\n\n');
}

function buildSelectedCsv(records, fields) {
  const headers = EXPORT_FIELDS.filter(field => fields.includes(field.id) && field.id !== 'specs');
  if (fields.includes('specs')) headers.push({ id: 'specs', label: 'Specs' });
  const csvEscape = typeof escapeCsvField === 'function' ? escapeCsvField : value => String(value ?? '');
  const rows = records.map(record => headers.map(field => {
    if (field.id === 'specs') {
      return csvEscape((record.specs || []).map(spec => `${spec.key}: ${spec.value}`).join('; '));
    }
    return csvEscape(record[field.id] || '');
  }).join(','));
  return '\u{FEFF}' + [headers.map(field => csvEscape(field.label)).join(','), ...rows].join('\n');
}

function buildSelectedXml(records, listName, aiPrompt = '') {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<shopscout list="${escXml(listName)}" exported="${new Date().toISOString()}">\n`;
  if (aiPrompt) xml += `  <aiPrompt>${escXml(aiPrompt)}</aiPrompt>\n`;
  for (const record of records) {
    xml += '  <product>\n';
    for (const [key, value] of Object.entries(record)) {
      if (key === 'specs') {
        if (Array.isArray(value) && value.length) {
          xml += '    <specs>\n';
          for (const spec of value) {
            xml += `      <spec key="${escXml(spec.key)}">${escXml(spec.value)}</spec>\n`;
          }
          xml += '    </specs>\n';
        }
      } else if (value != null && value !== '') {
        xml += `    <${key}>${escXml(value)}</${key}>\n`;
      }
    }
    xml += '  </product>\n';
  }
  return xml + '</shopscout>';
}

function buildSelectedHtml(records, listName, aiPrompt = '') {
  const date = localDateStamp();
  const cards = records.map(record => {
    const rows = exportRecordLines(record)
      .map(line => {
        const idx = line.indexOf(':');
        if (idx < 0) return `<tr><td colspan="2">${esc(line)}</td></tr>`;
        const key = line.slice(0, idx);
        const value = line.slice(idx + 1).trim();
        return `<tr><td class="l">${esc(key)}</td><td>${esc(value)}</td></tr>`;
      })
      .join('');
    const title = record.name || 'Product';
    return `<section class="card"><h3>${esc(title)}</h3><table>${rows}</table></section>`;
  }).join('');
  const promptSection = aiPrompt
    ? `<section class="card"><h2>AI Prompt</h2><pre>${esc(aiPrompt)}</pre></section>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(safeExportFileStem(listName))}</title>
<style>*{box-sizing:border-box}body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#f6f7f9;color:#111827;padding:32px}.hdr{margin-bottom:24px}.hdr h1{font-size:24px;margin:0 0 4px}.hdr p{margin:0;color:#667085}.grid{display:grid;gap:14px;max-width:980px}.card{background:#fff;border:1px solid #d9dee7;border-radius:8px;padding:16px}.card h2{margin:0 0 10px;font-size:18px}.card h3{margin:0 0 10px;font-size:15px}pre{white-space:pre-wrap;font:12px/1.5 Consolas,monospace;background:#f1f5f9;border:1px solid #d9dee7;border-radius:6px;padding:12px}table{width:100%;border-collapse:collapse}td{padding:4px 8px;border-top:1px solid #edf0f4;vertical-align:top}.l{width:120px;color:#667085;font-weight:600}@media print{body{background:#fff;padding:18px}.card{break-inside:avoid}}</style></head>
<body><div class="hdr"><h1>ShopScout</h1><p>${esc(listName)} — ${date} — ${records.length} product(s)</p></div><div class="grid">${promptSection}${cards}</div></body></html>`;
}

function buildExportContent(format, products, listName, fields) {
  const includeAiPrompt = fields.includes('aiPrompt');
  const recordFields = fields.filter(field => field !== 'aiPrompt');
  const records = exportRecords(products, recordFields);
  const aiPrompt = includeAiPrompt ? buildExportAiPrompt(products) : '';
  if (format === 'json') {
    return {
      content: JSON.stringify(Object.assign(
        { list: listName, exported: new Date().toISOString(), products: records },
        aiPrompt ? { aiPrompt } : {}
      ), null, 2),
      mime: 'application/json',
      extension: 'json'
    };
  }
  if (format === 'csv') return { content: appendAiPromptText(buildSelectedCsv(records, recordFields), aiPrompt), mime: 'text/csv', extension: 'csv' };
  if (format === 'xml') return { content: buildSelectedXml(records, listName, aiPrompt), mime: 'application/xml', extension: 'xml' };
  if (format === 'html' || format === 'pdf') {
    return { content: buildSelectedHtml(records, listName, aiPrompt), mime: 'text/html', extension: format === 'pdf' ? 'html' : 'html' };
  }
  return { content: appendAiPromptText(buildExportText(records), aiPrompt), mime: 'text/plain', extension: 'txt' };
}

async function runDashboardExport() {
  const panel = document.querySelector('.dashboard-export-panel');
  const format = panel?.querySelector('[data-export-format].active')?.dataset.exportFormat || 'txt';
  const destination = panel?.querySelector('[data-export-destination]:checked')?.dataset.exportDestination || 'clipboard';
  await doExport(format, {
    destination,
    fields: selectedExportFields(panel)
  });
}

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
      const list = exportSpecEntries(p);
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

async function doExport(format, opts = {}) {
  const data = await getData();
  const products = data.lists[data.activeList] || [];
  const name = data.activeList;
  if (!products.length) { toast.show('No products to export', 'error'); return; }
  const fields = Array.isArray(opts.fields) && opts.fields.length
    ? opts.fields
    : EXPORT_FIELDS.filter(field => !field.exportSection).map(field => field.id);
  const destination = opts.destination || 'file';
  const normalizedFormat = ['json', 'csv', 'xml', 'html', 'pdf', 'txt'].includes(format) ? format : 'json';
  const payload = buildExportContent(normalizedFormat, products, name, fields);
  const stem = safeExportFileStem(name);

  if (destination === 'clipboard') {
    const clipboardText = normalizedFormat === 'pdf' ? payload.content : payload.content;
    try {
      await navigator.clipboard.writeText(clipboardText);
      toast.show(`Copied ${normalizedFormat.toUpperCase()} export to clipboard`);
    } catch (err) {
      console.warn('Clipboard export failed', err);
      toast.show('Could not copy export', 'error');
    }
    return;
  }

  if (normalizedFormat === 'pdf') {
    const w = window.open('');
    if (!w) {
      toast.show('Could not open print window', 'error');
      return;
    }
    w.document.write(payload.content);
    w.document.close();
    setTimeout(() => w.print(), 400);
  } else {
    downloadFile(payload.content, `${stem}.${payload.extension}`, payload.mime);
    toast.show(`Exported as ${normalizedFormat.toUpperCase()}`);
  }
  document.getElementById('exiModal')?.classList.remove('active');
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
