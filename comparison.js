var chrome = globalThis.browser || globalThis.chrome;

const { getData, saveData, getProducts, saveProducts, esc, escAttr, escXml, sanitizeUrl, sanitizeProductDescription, parsePrice, normalizeReviewCount, formatRatingDisplay, normalizeSpecKeyLabel, normalizeSpecValue, normalizeProductSpecs, getCategoryComparisonSpecKeys, buildCsv, safeFilename, downloadFile, buildAIText, buildPrompt, inferCategory, detectMissingAttributes, CATEGORY_RUBRICS, buildExportHtml, parseImport, toast } = SS;

let currentView = 'database';
let tableSortCol = null;
let tableSortAsc = true;
let compactMode = false;
let gridlinesEnabled = true;
let selectedOnlyFilter = false;
let notedOnlyFilter = false;
let groupBySource = false;
let groupByField = '';
let groupsCollapsed = false;
let activeScanCancel = null;
let editIndex = -1;
let listModalMode = 'new';
let activeAiMonitorState = null;
let activeAiMonitorClientRunId = '';
let pendingAiRunOptions = null;
let aiRunInProgress = false;
let selectedAiUsageProviderId = 'auto';
let activeInlineEdit = null;
const selectedProductIds = new Set();
const frozenColumnIds = new Set();
let columnOrderIds = [];
let draggedColumnOrderId = '';
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

const COLUMNS = [
  { id: 'thumb',        label: '',              key: null,            sortable: false, hideable: false, filterable: false },
  { id: 'name',         label: 'Name',          key: 'title',         sortable: true,  hideable: false, filterable: true  },
  { id: 'brand',        label: 'Brand',         key: 'brand',         sortable: true,  hideable: true,  filterable: true  },
  { id: 'manufacturer', label: 'Manufacturer',  key: 'manufacturer',  sortable: true,  hideable: true,  filterable: true,  hidden: true },
  { id: 'category',     label: 'Category',      key: 'category',      sortable: true,  hideable: true,  filterable: true,  hidden: true },
  { id: 'price',        label: 'Price',         key: 'newPrice',      sortable: true,  hideable: true,  filterable: false, numeric: true },
  { id: 'used',         label: 'Used Price',    key: 'usedPrice',     sortable: true,  hideable: true,  filterable: false, numeric: true, hidden: true },
  { id: 'shipping',     label: 'Shipping',      key: 'shippingPrice', sortable: true,  hideable: true,  filterable: false, numeric: true, hidden: true },
  { id: 'source',       label: 'Source',        key: 'source',        sortable: true,  hideable: true,  filterable: true  },
  { id: 'seller',       label: 'Seller',        key: 'sellerName',    sortable: true,  hideable: true,  filterable: true,  hidden: true },
  { id: 'model',        label: 'Model',         key: 'modelNumber',   sortable: true,  hideable: true,  filterable: true  },
  { id: 'sku',          label: 'SKU',           key: 'sku',           sortable: true,  hideable: true,  filterable: true,  hidden: true },
  { id: 'asin',         label: 'ASIN',          key: 'asin',          sortable: true,  hideable: true,  filterable: true,  hidden: true },
  { id: 'upc',          label: 'UPC',           key: 'upc',           sortable: true,  hideable: true,  filterable: true,  hidden: true },
  { id: 'mpn',          label: 'MPN',           key: 'mpn',           sortable: true,  hideable: true,  filterable: true,  hidden: true },
  { id: 'gtin',         label: 'GTIN',          key: 'gtin',          sortable: true,  hideable: true,  filterable: true,  hidden: true },
  { id: 'rating',       label: 'Rating',        key: 'rating',        sortable: true,  hideable: true,  filterable: false, numeric: true },
  { id: 'availability', label: 'Availability',  key: 'availability',  sortable: true,  hideable: true,  filterable: true,  hidden: true },
  { id: 'bullets',      label: 'Features',      key: '_bullets',      sortable: false, hideable: true,  filterable: false, hidden: true },
  { id: 'description',  label: 'Description',   key: '_description',  sortable: false, hideable: true,  filterable: false, hidden: true },
  { id: 'specs',        label: 'Specs',         key: '_specCount',    sortable: true,  hideable: true,  filterable: false, numeric: true, hidden: true },
  { id: 'notes',        label: 'Notes',         key: 'notes',         sortable: false, hideable: true,  filterable: false },
  { id: 'actions',      label: '',              key: null,            sortable: false, hideable: false, filterable: false },
];

const hiddenCols = new Set(COLUMNS.filter(c => c.hidden).map(c => c.id));
const colFilters = new Map();
let dynamicSpecCols = [];
const autoHiddenDynamicCols = new Set();

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

function normalizedSpecColumn(key) {
  const normalized = normalizeSpecKeyLabel ? normalizeSpecKeyLabel(key) : null;
  const label = normalized?.label || String(key || '').replace(/\s+/g, ' ').trim();
  const idSource = normalized?.id || label;
  return {
    id: 'spec_' + String(idSource || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
    label
  };
}

function specColumnId(key) {
  return normalizedSpecColumn(key).id;
}

function buildSpecColumns(products) {
  const specKeys = new Map();
  const categoryDefaultSpecIds = new Set(
    (getCategoryComparisonSpecKeys ? getCategoryComparisonSpecKeys(products) : []).map(specColumnId)
  );
  for (const p of products) {
    for (const s of (p.rawSpecs || [])) {
      const column = normalizedSpecColumn(s.key);
      if (!column.id || !column.label) continue;
      if (!specKeys.has(column.id)) specKeys.set(column.id, column.label);
    }
  }
  const oldIds = new Set(dynamicSpecCols.map(c => c.id));
  const activeIds = new Set();
  const newCols = [];
  for (const [id, label] of specKeys) {
    const isCategoryDefault = categoryDefaultSpecIds.has(id);
    activeIds.add(id);
    newCols.push({ id, label, key: null, specKey: label, sortable: true, hideable: true, filterable: true, dynamic: true, hidden: !isCategoryDefault, categoryDefault: isCategoryDefault });
    if (isCategoryDefault) {
      if (autoHiddenDynamicCols.has(id)) hiddenCols.delete(id);
      autoHiddenDynamicCols.delete(id);
    } else if (!oldIds.has(id) && !hiddenCols.has(id)) {
      hiddenCols.add(id);
      autoHiddenDynamicCols.add(id);
    } else if (autoHiddenDynamicCols.has(id)) {
      hiddenCols.add(id);
    }
  }
  for (const id of [...autoHiddenDynamicCols]) {
    if (!activeIds.has(id)) {
      hiddenCols.delete(id);
      autoHiddenDynamicCols.delete(id);
    }
  }
  dynamicSpecCols = newCols;
}

function getAllColumns() {
  const actionsIdx = COLUMNS.findIndex(c => c.id === 'actions');
  const before = COLUMNS.slice(0, actionsIdx);
  const after = COLUMNS.slice(actionsIdx);
  return [...before, ...dynamicSpecCols, ...after];
}

function displayColumnLabel(col) {
  if (!col) return '';
  if (col.label) return col.label;
  if (col.id === 'thumb') return 'Image';
  return col.id || '';
}

function applyColumnOrder(columns) {
  const idToColumn = new Map(columns.map(col => [col.id, col]));
  const ordered = [];
  const used = new Set();
  for (const id of columnOrderIds) {
    const col = idToColumn.get(id);
    if (!col || used.has(id)) continue;
    ordered.push(col);
    used.add(id);
  }
  for (const col of columns) {
    if (used.has(col.id)) continue;
    ordered.push(col);
  }
  return ordered;
}

function getAllColumnsInDisplayOrder() {
  return applyColumnOrder(getAllColumns());
}

function getVisibleColumnsForOrdering() {
  return getAllColumnsInDisplayOrder()
    .filter(col => col.id !== 'actions')
    .filter(col => !hiddenCols.has(col.id) || frozenColumnIds.has(col.id));
}

function getAllGroupFields() {
  const seen = new Set();
  const fields = [];
  for (const field of GROUP_FIELDS) {
    if (seen.has(field.id)) continue;
    seen.add(field.id);
    fields.push(field);
  }
  for (const col of dynamicSpecCols) {
    const id = `spec:${col.specKey}`;
    if (seen.has(id)) continue;
    seen.add(id);
    fields.push({ id, label: col.label, specKey: col.specKey, dynamic: true });
  }
  return fields;
}

function renderGroupFieldMenu() {
  const menu = document.getElementById('groupFieldMenu');
  if (!menu) return;
  const fields = getAllGroupFields();
  menu.innerHTML = fields.map((field, index) => {
    const separator = index === 1 || index === 7 || (field.dynamic && !fields[index - 1]?.dynamic)
      ? '<div class="menu-separator"></div>'
      : '';
    return `${separator}<button class="menu-item${field.id === groupByField ? ' active' : ''}" data-group-field="${escAttr(field.id)}">${esc(field.label)}</button>`;
  }).join('');
}

function getSpecValue(product, specKey) {
  const wanted = specColumnId(specKey);
  const spec = (product.rawSpecs || []).find(s => specColumnId(s.key) === wanted);
  return spec ? normalizeSpecValue(spec.value) : '';
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

function renderTruncatedTitle(value, maxLength = 40) {
  const titleText = String(value || 'Untitled').replace(/\s+/g, ' ').trim() || 'Untitled';
  return `<span class="name-text" title="${escAttr(titleText)}">${esc(truncateText(titleText, maxLength))}</span>`;
}

function editableStaticCell(product, field, displayHtml, fallback = '-', className = '') {
  const editValue = getCorrectedValue(product, field, '');
  const content = displayHtml || (editValue ? renderCorrectedField(product, field) : esc(fallback));
  return `<td${className ? ` class="${className}"` : ''} data-edit-field="${escAttr(field)}" data-edit-value="${escAttr(editValue)}">${content}</td>`;
}

function editableSpecCell(product, specKey, specValue) {
  const editValue = specValue || '';
  const content = specValue ? renderCorrectedSpecValue(product, specKey, specValue) : '-';
  return `<td data-edit-spec-key="${escAttr(specKey)}" data-edit-value="${escAttr(editValue)}">${content}</td>`;
}

function renderRowActionMenu(location, productUrl, idx) {
  return `<button class="row-action-trigger" type="button" data-row-action-menu data-list="${escAttr(location.listName)}" data-idx="${idx}" data-url="${escAttr(productUrl)}" title="Actions" aria-label="Product actions">&#8942;</button>`;
}

function renderRatingHtml(product, fallback = '-') {
  const rating = getCorrectedValue(product, 'rating');
  if (!rating) return fallback;
  const countText = normalizeReviewCount(product.reviewCount);
  return `&#9733; ${renderCorrectedField(product, 'rating')}${countText ? ` (${esc(countText)})` : ''}`;
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
  sel.innerHTML = optionsHtml;
  // Mirror the same options + selection to every [data-list-mirror] in the ribbon panes.
  document.querySelectorAll('[data-list-mirror]').forEach(mirror => { mirror.innerHTML = optionsHtml; });
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
  stack.innerHTML = ordered.length
    ? ordered.map(name => `<button class="rb-btn-sm${name === data.activeList ? ' active' : ''}" data-command="recent-list" data-list-name="${escAttr(name)}"><span class="rb-btn-sm-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span><span class="rb-btn-sm-label">${esc(name)}</span></button>`).join('')
    : '<span class="rb-label">No recent lists</span>';
}

function getProductSearchQuery() {
  return (document.getElementById('productSearchInput')?.value || '').trim();
}

function getProductSearchScope() {
  const value = document.getElementById('productSearchScope')?.value || 'current';
  return value === 'all' ? 'all' : 'current';
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

function productMatchesSearch(product, query) {
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = getSearchableProductText(product);
  return terms.every(term => haystack.includes(term));
}

function collectProductSearchItems(data, scope) {
  const activeList = data.activeList;
  const lists = data.lists || {};
  const listNames = scope === 'all' ? Object.keys(lists).sort((a, b) => a.localeCompare(b)) : [activeList];
  const items = [];
  for (const listName of listNames) {
    const products = lists[listName] || [];
    products.forEach((product, index) => items.push({ product, listName, index }));
  }
  return items;
}

function setRenderedProductLocations(items) {
  renderedProductLocations = new WeakMap();
  for (const item of items) renderedProductLocations.set(item.product, { listName: item.listName, index: item.index });
}

function getRenderedProductLocation(product, fallbackProducts) {
  return renderedProductLocations.get(product) || { listName: getActiveListName(), index: fallbackProducts.indexOf(product) };
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
  // Database view (Tabulator/Pivot) is the only product view now. The old hand-rolled
  // cards/table renderers are kept as no-ops below to avoid breaking legacy callers
  // (AI results page, scan flows) until those are migrated. They never paint to #content.
  if (globalThis.SSDatabaseView && typeof globalThis.SSDatabaseView.render === 'function') {
    return globalThis.SSDatabaseView.render();
  }
  return;
  /* DEAD CODE — preserved temporarily for diff readability; never executes. */
  // eslint-disable-next-line no-unreachable
  const data = await getData();
  const activeProducts = data.lists[data.activeList] || [];
  const searchQuery = getProductSearchQuery();
  const searchScope = getProductSearchScope();
  const scopedItems = collectProductSearchItems(data, searchScope);
  let items = searchQuery ? scopedItems.filter(item => productMatchesSearch(item.product, searchQuery)) : scopedItems.slice();
  let products = items.map(item => item.product);
  document.title = `ShopScout — ${data.activeList} (${activeProducts.length})`;
  syncSelectionButtons(activeProducts);

  buildSpecColumns(scopedItems.map(item => item.product));
  renderGroupFieldMenu();

  // Source filter
  const sources = [...new Set(scopedItems.map(item => item.product.source).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const filterSel = document.getElementById('filterSource');
  const curFilter = filterSel?.value || '';
  const activeSourceFilter = sources.includes(curFilter) ? curFilter : '';
  if (filterSel) {
    filterSel.innerHTML = '<option value="">All Sources</option>' + sources.map(s => `<option value="${esc(s)}"${s === activeSourceFilter ? ' selected' : ''}>${esc(s)}</option>`).join('');
    filterSel.value = activeSourceFilter;
  }
  if (activeSourceFilter) items = items.filter(item => item.product.source === activeSourceFilter);

  // Column filters
  for (const [colId, filterVal] of colFilters) {
    const col = getAllColumns().find(c => c.id === colId);
    if (!col || !filterVal) continue;
    const lf = filterVal.toLowerCase();
    if (col.dynamic) {
      items = items.filter(item => getSpecValue(item.product, col.specKey).toLowerCase().includes(lf));
    } else if (col.key) {
      items = items.filter(item => String(getCorrectedValue(item.product, col.key) || '').toLowerCase().includes(lf));
    }
  }
  if (selectedOnlyFilter) {
    items = items.filter(item => item.listName === data.activeList && selectedProductIds.has(productSelectionKey(item.product, item.index, item.listName)));
  }
  if (notedOnlyFilter) {
    items = items.filter(item => String(item.product.notes || '').trim());
  }

  // Sort
  const sort = document.getElementById('sortBy').value;
  if (sort === 'price-asc') items.sort((a, b) => parsePrice(a.product.newPrice) - parsePrice(b.product.newPrice));
  else if (sort === 'price-desc') items.sort((a, b) => parsePrice(b.product.newPrice) - parsePrice(a.product.newPrice));
  else if (sort === 'rating') items.sort((a, b) => (parseFloat(b.product.rating) || 0) - (parseFloat(a.product.rating) || 0));
  else if (sort === 'source') items.sort((a, b) => (a.product.source || '').localeCompare(b.product.source || ''));
  if (!tableSortAsc && sort !== 'price-desc') items.reverse();
  if (groupByField) items.sort((a, b) => productGroupLabel(a.product, a).localeCompare(productGroupLabel(b.product, b)));

  // Table column sort
  if (currentView === 'table' && tableSortCol) {
    const col = getAllColumns().find(c => c.id === tableSortCol);
    if (col?.key || col?.dynamic) {
      items.sort((a, b) => {
        let va, vb;
        if (col.dynamic) { va = getSpecValue(a.product, col.specKey); vb = getSpecValue(b.product, col.specKey); }
        else if (col.key === '_specCount') { va = (a.product.rawSpecs || []).length; vb = (b.product.rawSpecs || []).length; }
        else { va = getCorrectedValue(a.product, col.key); vb = getCorrectedValue(b.product, col.key); }
        if (col.numeric) { va = parseFloat(String(va).replace(/[^0-9.\-]/g, '')) || 0; vb = parseFloat(String(vb).replace(/[^0-9.\-]/g, '')) || 0; }
        else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
        return tableSortAsc ? (va > vb ? 1 : va < vb ? -1 : 0) : (va < vb ? 1 : va > vb ? -1 : 0);
      });
    }
  }
  products = items.map(item => item.product);
  setRenderedProductLocations(items);

  renderHiddenBar();
  renderFilterBar();
  syncRibbonViewState();

  const content = document.getElementById('content');
  if (!products.length) {
    if (searchQuery) {
      const scopeLabel = searchScope === 'all' ? 'all lists' : 'the current list';
      content.innerHTML = `<div class="empty"><div class="icon">&#128269;</div><p>No products match <strong>${esc(searchQuery)}</strong> in ${esc(scopeLabel)}.</p></div>`;
    } else {
      const emptyText = searchScope === 'all' ? 'No products in any list yet.' : 'No products in this list yet.';
      content.innerHTML = `<div class="empty"><div class="icon">&#128722;</div><p>${emptyText}<br>Click <strong>Add Product</strong> to get started.</p></div>`;
    }
    return;
  }

  const allProducts = activeProducts;
  if (currentView === 'cards') renderCards(products, allProducts);
  else renderTable(products, allProducts);
}

// --- View configuration modals ---
function renderHiddenBar() {
  renderColumnControlList();
  renderFreezeControlList();
  renderColumnOrderList();
  renderFilterModal();
  renderGroupingModal();
}

function filterUtilityList(items, query, labelForItem = item => item.label || item.id || '') {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return items;
  return items.filter(item => String(labelForItem(item) || '').toLowerCase().includes(needle));
}

function renderColumnControlList() {
  const list = document.getElementById('columnToggleList');
  if (!list) return;
  const query = document.getElementById('columnSearchInput')?.value || '';
  const columns = filterUtilityList(getAllColumns()
    .filter(col => col.hideable)
    .filter(col => col.label || col.id)
    .sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id), undefined, { sensitivity: 'base' })),
    query,
    col => col.label || col.id
  );
  list.innerHTML = columns.map(col => {
    const checked = !hiddenCols.has(col.id);
    return `<label class="utility-option" title="${escAttr(col.label || col.id)}">
      <input type="checkbox" data-column-toggle="${escAttr(col.id)}"${checked ? ' checked' : ''}>
      <span>${esc(col.label || col.id)}</span>
    </label>`;
  }).join('') || '<div class="ai-empty">No matching columns.</div>';
}

function renderFreezeControlList() {
  const list = document.getElementById('freezeToggleList');
  if (!list) return;
  const query = document.getElementById('freezeSearchInput')?.value || '';
  const columns = filterUtilityList(
    getAllColumns()
      .filter(col => col.id !== 'actions')
      .filter(col => col.label || col.id)
      .map(col => ({ ...col, label: col.label || (col.id === 'thumb' ? 'Image' : col.id) }))
      .sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id), undefined, { sensitivity: 'base' })),
    query,
    col => col.label || col.id
  );
  list.innerHTML = columns.map(col => `<label class="utility-option" title="${escAttr(col.label || col.id)}">
    <input type="checkbox" data-freeze-column="${escAttr(col.id)}"${frozenColumnIds.has(col.id) ? ' checked' : ''}>
    <span>${esc(col.label || col.id)}</span>
  </label>`).join('') || '<div class="ai-empty">No matching fields.</div>';
}

function renderColumnOrderList() {
  const list = document.getElementById('columnOrderList');
  if (!list) return;
  const columns = getVisibleColumnsForOrdering();
  list.innerHTML = columns.map((col, index) => {
    const label = displayColumnLabel(col);
    return `<div class="column-order-item" draggable="true" data-column-order-id="${escAttr(col.id)}" title="${escAttr(label)}">
      <span class="column-order-handle" aria-hidden="true">::</span>
      <span class="column-order-rank">${String(index + 1).padStart(2, '0')}</span>
      <span class="column-order-label">${esc(label)}</span>
    </div>`;
  }).join('') || '<div class="ai-empty">No visible fields selected.</div>';
}

function getColumnOrderDropTarget(list, y) {
  const items = [...list.querySelectorAll('.column-order-item:not(.dragging)')];
  return items.reduce((closest, item) => {
    const box = item.getBoundingClientRect();
    const offset = y - box.top - (box.height / 2);
    if (offset < 0 && offset > closest.offset) return { offset, item };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, item: null }).item;
}

function saveColumnOrderFromDom() {
  const list = document.getElementById('columnOrderList');
  if (!list) return;
  const visibleOrder = [...list.querySelectorAll('[data-column-order-id]')]
    .map(item => item.dataset.columnOrderId)
    .filter(Boolean);
  const allColumnIds = getAllColumns().map(col => col.id);
  const allColumnIdSet = new Set(allColumnIds);
  const visibleOrderSet = new Set(visibleOrder);
  const carriedHiddenOrder = columnOrderIds.filter(id => allColumnIdSet.has(id) && !visibleOrderSet.has(id));
  const carriedHiddenSet = new Set(carriedHiddenOrder);
  const defaultRemainder = allColumnIds.filter(id => !visibleOrderSet.has(id) && !carriedHiddenSet.has(id));
  columnOrderIds = [...visibleOrder, ...carriedHiddenOrder, ...defaultRemainder];
  renderAll();
}

function renderFilterModal() {
  const selectedToggle = document.getElementById('filterSelectedToggle');
  const notedToggle = document.getElementById('filterNotedToggle');
  if (selectedToggle) selectedToggle.checked = selectedOnlyFilter;
  if (notedToggle) notedToggle.checked = notedOnlyFilter;
}

function renderGroupingModal() {
  const list = document.getElementById('groupingFieldList');
  if (!list) return;
  const query = document.getElementById('groupSearchInput')?.value || '';
  const fields = filterUtilityList(getAllGroupFields(), query, field => field.label || field.id);
  list.innerHTML = fields.map(field => `<label class="utility-option" title="${escAttr(field.label)}">
    <input type="radio" name="groupByField" data-group-field="${escAttr(field.id)}"${field.id === groupByField ? ' checked' : ''}>
    <span>${esc(field.label)}</span>
  </label>`).join('') || '<div class="ai-empty">No matching fields.</div>';
}

// --- Filter bar ---
function renderFilterBar() {
  const bar = document.getElementById('filterBar');
  if (!colFilters.size && !selectedOnlyFilter && !notedOnlyFilter) { bar.classList.remove('active'); return; }
  let html = '<span class="filter-bar-label">Filters:</span>';
  if (selectedOnlyFilter) {
    html += `<span class="filter-chip" data-filter="selected"><span class="chip-col">Active:</span> <span class="chip-val">Selected products</span> <span class="chip-x">&times;</span></span>`;
  }
  if (notedOnlyFilter) {
    html += `<span class="filter-chip" data-filter="noted"><span class="chip-col">Saved:</span> <span class="chip-val">Products with notes</span> <span class="chip-x">&times;</span></span>`;
  }
  for (const [colId, val] of colFilters) {
    const col = getAllColumns().find(c => c.id === colId);
    if (col) html += `<span class="filter-chip" data-col="${colId}"><span class="chip-col">${esc(col.label)}:</span> <span class="chip-val">${esc(val)}</span> <span class="chip-x">&times;</span></span>`;
  }
  bar.innerHTML = html;
  bar.classList.add('active');
}

function syncRibbonViewState() {
  document.body.classList.toggle('compact-mode', compactMode);
  document.body.classList.toggle('no-gridlines', !gridlinesEnabled);
  document.body.classList.toggle('has-frozen-cols', frozenColumnIds.size > 0);
  document.querySelectorAll('[data-command="toggle-compact"]').forEach(btn => btn.classList.toggle('active', compactMode));
  document.querySelectorAll('[data-command="toggle-gridlines"]').forEach(btn => btn.classList.toggle('active', gridlinesEnabled));
  document.querySelectorAll('[data-command="open-freeze-modal"]').forEach(btn => btn.classList.toggle('active', frozenColumnIds.size > 0));
  document.querySelectorAll('[data-command="open-column-order-modal"]').forEach(btn => btn.classList.toggle('active', columnOrderIds.length > 0));
  document.querySelectorAll('[data-command="filter-selected"]').forEach(btn => btn.classList.toggle('active', selectedOnlyFilter));
  document.querySelectorAll('[data-command="filter-noted"]').forEach(btn => btn.classList.toggle('active', notedOnlyFilter));
  document.querySelectorAll('[data-command="group-by-source"]').forEach(btn => btn.classList.toggle('active', groupBySource));
  document.querySelectorAll('[data-group-field]').forEach(btn => btn.classList.toggle('active', btn.dataset.groupField === (groupByField || (groupBySource ? 'source' : ''))));
  document.querySelectorAll('[data-search-field]').forEach(btn => {
    const active = activeSearchFields.has(btn.dataset.searchField);
    btn.classList.toggle('active', active);
    const checkbox = btn.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = active;
  });
  document.querySelectorAll('[data-command="sort-ascending"]').forEach(btn => btn.classList.toggle('active', tableSortAsc));
  document.querySelectorAll('[data-command="sort-descending"]').forEach(btn => btn.classList.toggle('active', !tableSortAsc));
  renderFilterModal();
  renderFreezeControlList();
  renderColumnOrderList();
  applyFrozenColumnOffsets();
}

function toggleSearchField(fieldId) {
  if (!SEARCH_FIELD_DEFINITIONS.some(field => field.id === fieldId)) return;
  if (activeSearchFields.has(fieldId)) activeSearchFields.delete(fieldId);
  else activeSearchFields.add(fieldId);
  normalizeSearchFields();
  renderAll();
}

function setGroupByField(fieldId) {
  if (!getAllGroupFields().some(field => field.id === fieldId)) return;
  groupByField = fieldId;
  groupBySource = fieldId === 'source';
  groupsCollapsed = false;
  renderAll();
  const field = groupFieldDefinition(fieldId);
  toast.show(`Grouped by ${field?.label || 'field'}`);
}

function groupFieldDefinition(fieldId = groupByField) {
  return getAllGroupFields().find(field => field.id === fieldId) || GROUP_FIELDS.find(field => field.id === fieldId) || null;
}

function priceBandLabel(price) {
  const value = parsePrice(price);
  if (!Number.isFinite(value) || value <= 0 || value >= 99999) return 'Not specified';
  if (value < 25) return 'Under $25';
  if (value < 50) return '$25 to $49';
  if (value < 100) return '$50 to $99';
  if (value < 200) return '$100 to $199';
  return '$200 and up';
}

function ratingBandLabel(rating) {
  const value = parseFloat(String(rating || '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(value) || value <= 0) return 'Not specified';
  if (value >= 4.5) return '4.5 stars and up';
  if (value >= 4) return '4.0 to 4.4 stars';
  if (value >= 3) return '3.0 to 3.9 stars';
  return 'Under 3 stars';
}

function groupFieldValue(product, location = {}) {
  const fieldId = groupByField || (groupBySource ? 'source' : '');
  if (!fieldId) return '';
  if (fieldId.startsWith('spec:')) return getSpecValue(product || {}, fieldId.slice(5)) || 'Not specified';
  if (fieldId === 'listName') return location.listName || getActiveListName() || 'Current list';
  if (fieldId === 'newPrice') return priceBandLabel(product?.newPrice);
  if (fieldId === 'rating') return ratingBandLabel(product?.rating);
  return String(product?.[fieldId] || '').trim() || 'Not specified';
}

function productGroupLabel(product, location = {}) {
  const field = groupFieldDefinition(groupByField || (groupBySource ? 'source' : ''));
  if (!field) return '';
  return `${field.label}: ${groupFieldValue(product, location)}`;
}

// --- Cards ---
function renderCards(products, allProducts) {
  // LEGACY — retired in favor of Database view (Tabulator). See comparison-db.js.
  // Guarded no-op so any orphan caller exits cleanly instead of painting the old UI.
  return;
  // eslint-disable-next-line no-unreachable
  const cheapestPrice = Math.min(...products.map(p => parsePrice(getCorrectedValue(p, 'newPrice'))).filter(v => v < 99999));
  const bestRating = Math.max(...products.map(p => parseFloat(getCorrectedValue(p, 'rating')) || 0));

  let lastGroup = null;
  const cardsHtml = products.map(p => {
    const location = getRenderedProductLocation(p, allProducts);
    const idx = location.index;
    const isActiveListProduct = location.listName === getActiveListName();
    const selectionKey = productSelectionKey(p, idx, location.listName);
    const isSelected = isActiveListProduct && selectedProductIds.has(selectionKey);
    const isCheapest = products.length > 1 && parsePrice(getCorrectedValue(p, 'newPrice')) === cheapestPrice && cheapestPrice < 99999;
    const isBestRated = products.length > 1 && (parseFloat(getCorrectedValue(p, 'rating')) || 0) === bestRating && bestRating > 0;

    const imageUrl = sanitizeUrl(p.image);
    const productUrl = sanitizeUrl(p.url);
    const title = getCorrectedValue(p, 'title', 'Untitled');
    const newPrice = getCorrectedValue(p, 'newPrice');
    const usedPrice = getCorrectedValue(p, 'usedPrice');
    const brand = getCorrectedValue(p, 'brand');
    const rating = getCorrectedValue(p, 'rating');
    const modelNumber = getCorrectedValue(p, 'modelNumber');
    const img = imageUrl ? `<img src="${escAttr(imageUrl)}" alt="">` : '<span class="no-img">No Image</span>';
    let meta = '';
    if (p.source) meta += productUrl ? `<a class="source-link" href="${escAttr(productUrl)}" target="_blank" rel="noopener">${esc(p.source)}</a>` : `<span>${esc(p.source)}</span>`;
    if (getProductSearchScope() === 'all') meta += `<span class="list-badge">List: ${esc(location.listName)}</span>`;
    if (brand) meta += `<span>${esc(brand)}</span>`;
    const ratingText = formatRatingDisplay(rating, p.reviewCount);
    if (ratingText) meta += `<span class="rating-badge">&#9733; ${esc(ratingText)}</span>`;
    if (modelNumber) meta += `<span>${esc(modelNumber)}</span>`;

    let badges = '';
    if (isCheapest) badges += '<span class="source-badge" style="background:#fef9c3;color:#92400e">Best Price</span> ';
    if (isBestRated) badges += '<span class="source-badge" style="background:#fef3c7;color:#92400e">Top Rated</span> ';

    const group = productGroupLabel(p, location);
    const groupingEnabled = !!groupByField || groupBySource;
    const groupHeader = groupingEnabled && group !== lastGroup
      ? `<div class="group-header">${esc(group)}${groupsCollapsed ? '' : ''}</div>`
      : '';
    if (groupingEnabled && group !== lastGroup) lastGroup = group;
    if (groupingEnabled && groupsCollapsed) return groupHeader;

    return `${groupHeader}<div class="product-card${isSelected ? ' selected' : ''}" data-list="${escAttr(location.listName)}" data-idx="${idx}" style="cursor:pointer">
      <label class="product-select" title="${isActiveListProduct ? 'Select product' : 'Switch to this list to select'}"><input type="checkbox" class="product-select-input" data-list="${escAttr(location.listName)}" data-idx="${idx}" data-key="${escAttr(selectionKey)}"${isSelected ? ' checked' : ''}${isActiveListProduct ? '' : ' disabled'}><span>Select product</span></label>
      <div class="card-img">${img}</div>
      <div class="card-body">
        <div class="card-title" title="${escAttr(title)}">${esc(truncateText(title, 40))}</div>
        ${badges ? `<div style="margin-bottom:4px">${badges}</div>` : ''}
        ${newPrice ? `<div class="card-price">${esc(newPrice)}</div>` : ''}
        ${usedPrice ? `<div class="card-used">Used: ${esc(usedPrice)}</div>` : ''}
        <div class="card-meta">${meta}</div>
        ${p.notes ? `<div class="card-notes">${esc(p.notes)}</div>` : ''}
        <div class="card-actions">
          <button class="icon-btn rescan-btn" data-list="${escAttr(location.listName)}" data-idx="${idx}" title="Rescan product">&#8635;</button>
          <button class="icon-btn open-btn" data-url="${escAttr(productUrl)}" title="Open product page">&#8599;</button>
          <button class="icon-btn edit-btn" data-list="${escAttr(location.listName)}" data-idx="${idx}" title="Edit">&#9998;</button>
          <button class="icon-btn remove-btn" data-list="${escAttr(location.listName)}" data-idx="${idx}" title="Remove">&times;</button>
        </div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('content').innerHTML = `<div class="card-grid${groupByField || groupBySource ? ' grouped' : ''}">${cardsHtml}</div>`;
}

// --- Table (LEGACY) — retired in favor of Database view (Tabulator). See comparison-db.js. ---
function renderTable(products, allProducts) {
  // Guarded no-op so any orphan caller exits cleanly instead of painting the old table.
  return;
  // eslint-disable-next-line no-unreachable
  const cheapestPrice = Math.min(...products.map(p => parsePrice(getCorrectedValue(p, 'newPrice'))).filter(v => v < 99999));
  const bestRating = Math.max(...products.map(p => parseFloat(getCorrectedValue(p, 'rating')) || 0));

  const visibleCols = getAllColumnsInDisplayOrder().filter(c => !hiddenCols.has(c.id) || frozenColumnIds.has(c.id));

  let html = '<div class="table-wrap"><table><thead><tr>';
  for (const col of visibleCols) {
    const cls = [
      col.id === 'thumb' ? 'col-thumb' : '',
      col.id === 'actions' ? 'col-actions' : '',
      frozenColumnIds.has(col.id) ? 'frozen-col' : ''
    ].filter(Boolean).join(' ');
    const classAttr = cls ? ` class="${cls}"` : '';
    if (!col.sortable && !col.filterable) {
      html += `<th${classAttr} data-col-id="${escAttr(col.id)}"><div class="th-inner">${esc(col.label)}</div></th>`;
    } else {
      const arrow = tableSortCol === col.id ? `<span class="sort-arrow">${tableSortAsc ? '&#9650;' : '&#9660;'}</span>` : '';
      const hasFilter = colFilters.has(col.id) ? ' has-filter' : '';
      html += `<th${classAttr} data-col-id="${escAttr(col.id)}"><div class="th-inner${hasFilter}" data-col="${col.id}">${esc(col.label)} ${arrow}<span class="th-menu-trigger" data-col="${col.id}">&#9662;</span></div></th>`;
    }
  }
  html += '</tr></thead><tbody>';

  let lastGroup = null;
  products.forEach(p => {
    const location = getRenderedProductLocation(p, allProducts);
    const idx = location.index;
    const isActiveListProduct = location.listName === getActiveListName();
    const selectionKey = productSelectionKey(p, idx, location.listName);
    const isSelected = isActiveListProduct && selectedProductIds.has(selectionKey);
    const isCheapest = products.length > 1 && parsePrice(getCorrectedValue(p, 'newPrice')) === cheapestPrice && cheapestPrice < 99999;
    const isBestRated = products.length > 1 && (parseFloat(getCorrectedValue(p, 'rating')) || 0) === bestRating && bestRating > 0;

    const imageUrl = sanitizeUrl(p.image);
    const productUrl = sanitizeUrl(p.url);
    const group = productGroupLabel(p, location);
    const groupingEnabled = !!groupByField || groupBySource;
    if (groupingEnabled && group !== lastGroup) {
      html += `<tr class="group-row"><td colspan="${visibleCols.length}">${esc(group)}</td></tr>`;
      lastGroup = group;
    }
    if (groupingEnabled && groupsCollapsed) return;
    html += `<tr data-list="${escAttr(location.listName)}" data-idx="${idx}" class="${isSelected ? 'selected' : ''}" style="cursor:pointer">`;
    for (const col of visibleCols) {
      switch (col.id) {
        case 'thumb':
          html += `<td class="col-thumb${frozenColumnIds.has(col.id) ? ' frozen-col' : ''}" data-col-id="${escAttr(col.id)}"><label class="product-select" title="${isActiveListProduct ? 'Select product' : 'Switch to this list to select'}"><input type="checkbox" class="product-select-input" data-list="${escAttr(location.listName)}" data-idx="${idx}" data-key="${escAttr(selectionKey)}"${isSelected ? ' checked' : ''}${isActiveListProduct ? '' : ' disabled'}><span>Select product</span></label>${imageUrl ? `<img src="${escAttr(imageUrl)}" alt="">` : '<div class="no-thumb">&#128247;</div>'}</td>`;
          break;
        case 'name':
          html += `<td class="col-name${frozenColumnIds.has(col.id) ? ' frozen-col' : ''}" data-col-id="${escAttr(col.id)}" data-edit-field="title" data-edit-value="${escAttr(getCorrectedValue(p, 'title', 'Untitled'))}">${renderTruncatedTitle(getCorrectedValue(p, 'title', 'Untitled'))}${getProductSearchScope() === 'all' ? `<div style="margin-top:4px"><span class="list-badge">List: ${esc(location.listName)}</span></div>` : ''}</td>`;
          break;
        case 'price':
          html += editableStaticCell(p, 'newPrice', renderCorrectedField(p, 'newPrice', '-'), '-', `col-price${isCheapest ? ' best-price' : ''}`);
          break;
        case 'source':
          html += editableStaticCell(p, 'source', p.source ? (productUrl ? `<a class="source-link" href="${escAttr(productUrl)}" target="_blank" rel="noopener">${esc(p.source)}</a>` : esc(p.source)) : '-', '-');
          break;
        case 'rating':
          html += editableStaticCell(p, 'rating', renderRatingHtml(p), '-', `col-rating${isBestRated ? ' best-rating' : ''}`);
          break;
        case 'bullets': {
          const bl = p.bullets || [];
          const value = bl.join('\n');
          const display = bl.length ? esc(truncateText(bl[0], 60)) + (bl.length > 1 ? ` (+${bl.length - 1})` : '') : '-';
          html += `<td class="col-trunc" title="${escAttr(value)}" data-edit-field="bullets" data-edit-value="${escAttr(value)}">${display}</td>`;
          break;
        }
        case 'description': {
          const desc = p.description || '';
          html += `<td class="col-trunc" title="${escAttr(desc)}" data-edit-field="description" data-edit-value="${escAttr(desc)}">${desc ? esc(truncateText(desc, 80)) : '-'}</td>`;
          break;
        }
        case 'specs':
          html += `<td>${(p.rawSpecs || []).length || '-'}</td>`;
          break;
        case 'actions':
          html += `<td class="col-actions">${renderRowActionMenu(location, productUrl, idx)}</td>`;
          break;
        default:
          if (col.dynamic) {
            const specValue = getSpecValue(p, col.specKey);
            html += editableSpecCell(p, col.specKey, specValue);
          } else {
            const field = col.key || '';
            html += field ? editableStaticCell(p, field, col.key && getCorrectedValue(p, col.key) ? renderCorrectedField(p, col.key) : '-', '-') : '<td>-</td>';
          }
          break;
      }
    }
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  document.getElementById('content').innerHTML = html;
  applyFrozenColumnOffsets();
}

function applyFrozenColumnOffsets() {
  const table = document.querySelector('.table-wrap table');
  if (!table) return;
  const headers = [...table.querySelectorAll('thead th')];
  let left = 0;
  headers.forEach((th, index) => {
    const isFrozen = frozenColumnIds.has(th.dataset.colId);
    th.classList.toggle('frozen-col', isFrozen);
    const cells = [...table.querySelectorAll(`tbody tr:not(.group-row) td:nth-child(${index + 1})`)];
    cells.forEach(cell => cell.classList.toggle('frozen-col', isFrozen));
    if (!isFrozen) {
      th.style.left = '';
      cells.forEach(cell => { cell.style.left = ''; });
      return;
    }
    const offset = `${left}px`;
    th.style.left = offset;
    cells.forEach(cell => { cell.style.left = offset; });
    left += th.getBoundingClientRect().width || th.offsetWidth || 0;
  });
}

function fieldLabelForInlineEdit(field, specKey) {
  if (specKey) return specKey;
  const col = getAllColumns().find(item => item.key === field || item.id === field);
  if (col?.label) return col.label;
  if (field === 'title') return 'Name';
  if (field === 'newPrice') return 'Price';
  if (field === 'modelNumber') return 'Model';
  return String(field || 'Field').replace(/([A-Z])/g, ' $1').replace(/^./, ch => ch.toUpperCase());
}

function restoreInlineCellEdit() {
  if (!activeInlineEdit?.cell) {
    activeInlineEdit = null;
    return;
  }
  activeInlineEdit.cell.innerHTML = activeInlineEdit.originalHtml;
  activeInlineEdit.cell.classList.remove('inline-editing');
  activeInlineEdit = null;
}

function startInlineCellEdit(cell) {
  if (!cell || cell.classList.contains('inline-editing')) return;
  if (cell.closest('tr.group-row') || cell.closest('.col-actions') || cell.closest('.col-thumb')) return;
  const field = cell.dataset.editField || '';
  const specKey = cell.dataset.editSpecKey || '';
  if (!field && !specKey) return;
  if (activeInlineEdit?.cell && activeInlineEdit.cell !== cell) restoreInlineCellEdit();

  const value = cell.dataset.editValue || '';
  const originalHtml = cell.innerHTML;
  const row = cell.closest('tr[data-list][data-idx]');
  if (!row) return;
  activeInlineEdit = {
    cell,
    originalHtml,
    listName: row.dataset.list || getActiveListName(),
    index: parseInt(row.dataset.idx, 10),
    field,
    specKey,
    saving: false
  };

  cell.classList.add('inline-editing');
  const useTextarea = field === 'description' || field === 'notes' || field === 'bullets';
  cell.innerHTML = useTextarea
    ? `<textarea class="inline-edit-control" rows="3">${esc(value)}</textarea>`
    : `<input class="inline-edit-control" type="text" value="${escAttr(value)}">`;
  const control = cell.querySelector('.inline-edit-control');
  control?.focus();
  control?.select?.();
}

function updateProductInlineValue(product, edit, value) {
  if (edit.specKey) {
    if (!Array.isArray(product.rawSpecs)) product.rawSpecs = [];
    const wanted = specColumnId(edit.specKey);
    let spec = product.rawSpecs.find(item => specColumnId(item.key) === wanted);
    if (!value) {
      product.rawSpecs = product.rawSpecs.filter(item => specColumnId(item.key) !== wanted);
      return;
    }
    if (!spec) {
      spec = { key: edit.specKey, value: '' };
      product.rawSpecs.push(spec);
    }
    spec.value = value;
    return;
  }

  if (edit.field === 'bullets') {
    product.bullets = value.split(/\r?\n|;/).map(item => item.trim()).filter(Boolean);
    return;
  }
  if (edit.field) product[edit.field] = value;
}

async function saveInlineCellEdit(control) {
  const edit = activeInlineEdit;
  if (!edit || edit.saving) return;
  edit.saving = true;
  const value = (control?.value || '').trim();
  try {
    const data = await getData();
    const products = data.lists?.[edit.listName] || [];
    const product = products[edit.index];
    if (!product) {
      restoreInlineCellEdit();
      toast.show('Could not find that product to update', 'error');
      return;
    }
    updateProductInlineValue(product, edit, value);
    await saveData(data);
    activeInlineEdit = null;
    await renderListSelector();
    await renderAll();
    toast.show(`${fieldLabelForInlineEdit(edit.field, edit.specKey)} updated`);
  } catch (err) {
    edit.saving = false;
    toast.show(err?.message || 'Inline edit failed', 'error');
    restoreInlineCellEdit();
  }
}

// --- Column menu ---
let activeColMenu = null;
let activeRowActionMenu = null;

function closeRowActionMenu() {
  if (activeRowActionMenu?.trigger) activeRowActionMenu.trigger.classList.remove('active');
  const menu = document.getElementById('activeRowActionMenu');
  if (menu) menu.remove();
  activeRowActionMenu = null;
}

function openRowActionMenu(trigger) {
  if (!trigger) return;
  if (activeRowActionMenu?.trigger === trigger) {
    closeRowActionMenu();
    return;
  }
  closeRowActionMenu();
  const listName = trigger.dataset.list || getActiveListName();
  const idx = trigger.dataset.idx || '';
  const productUrl = sanitizeUrl(trigger.dataset.url || '');
  const menu = document.createElement('div');
  menu.className = 'row-action-panel';
  menu.id = 'activeRowActionMenu';
  menu.innerHTML = `
    <button class="icon-btn rescan-btn" data-list="${escAttr(listName)}" data-idx="${escAttr(idx)}" title="Rescan product"><span>&#8635;</span><span>Rescan</span></button>
    <button class="icon-btn open-btn" data-url="${escAttr(productUrl)}" title="Open product page"><span>&#8599;</span><span>Open</span></button>
    <button class="icon-btn edit-btn" data-list="${escAttr(listName)}" data-idx="${escAttr(idx)}" title="Edit product"><span>&#9998;</span><span>Edit</span></button>
    <button class="icon-btn remove-btn" data-list="${escAttr(listName)}" data-idx="${escAttr(idx)}" title="Delete product"><span>&times;</span><span>Delete</span></button>`;
  document.body.appendChild(menu);
  const rect = trigger.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - menuRect.width - 8, rect.right - menuRect.width));
  const top = Math.max(8, Math.min(window.innerHeight - menuRect.height - 8, rect.bottom + 4));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  trigger.classList.add('active');
  activeRowActionMenu = { el: menu, trigger };
}

async function handleProductActionButton(btn) {
  const location = readProductLocation(btn);
  if (btn.classList.contains('rescan-btn')) {
    const switched = await activateProductListForAction(location.listName);
    await rescanSingle(location.index, switched ? null : btn);
    return true;
  }
  if (btn.classList.contains('edit-btn')) {
    await activateProductListForAction(location.listName);
    openEditModal(location.index);
    return true;
  }
  if (btn.classList.contains('remove-btn')) {
    await activateProductListForAction(location.listName);
    await removeProduct(location.index);
    return true;
  }
  if (btn.classList.contains('open-btn') && btn.dataset.url) {
    const url = sanitizeUrl(btn.dataset.url);
    if (url) window.open(url, '_blank');
    return true;
  }
  return false;
}

function openColMenu(colId, anchorEl) {
  closeColMenu();
  const col = getAllColumns().find(c => c.id === colId);
  if (!col) return;

  const menu = document.createElement('div');
  menu.className = 'col-menu active';
  menu.id = 'activeColMenu';

  const isNumeric = col.numeric;
  const ascLabel = isNumeric ? 'Sort Low &rarr; High' : 'Sort A &rarr; Z';
  const descLabel = isNumeric ? 'Sort High &rarr; Low' : 'Sort Z &rarr; A';

  let menuHtml = `
    <button data-action="sort-asc"><span class="cm-icon">&#9650;</span> ${ascLabel}</button>
    <button data-action="sort-desc"><span class="cm-icon">&#9660;</span> ${descLabel}</button>`;

  if (col.hideable) {
    menuHtml += `<div class="cm-divider"></div><button data-action="hide"><span class="cm-icon">&#10005;</span> Hide Column</button>`;
  }

  if (col.filterable) {
    const curVal = colFilters.get(colId) || '';
    menuHtml += `<div class="cm-divider"></div>
      <div class="cm-filter">
        <label>Filter</label>
        <input type="text" id="cmFilterInput" placeholder="Type to filter..." value="${esc(curVal)}">
      </div>`;
  }

  menu.innerHTML = menuHtml;

  // Position relative to th
  const rect = anchorEl.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = rect.bottom + 2 + 'px';
  menu.style.left = rect.left + 'px';
  menu.style.zIndex = '300';
  document.body.appendChild(menu);
  activeColMenu = { el: menu, colId };

  // Focus filter input if present
  const filterInput = menu.querySelector('#cmFilterInput');
  if (filterInput) setTimeout(() => filterInput.focus(), 50);

  // Handlers
  menu.addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'sort-asc') { tableSortCol = colId; tableSortAsc = true; }
    else if (action === 'sort-desc') { tableSortCol = colId; tableSortAsc = false; }
    else if (action === 'hide') { hiddenCols.add(colId); }
    closeColMenu();
    renderAll();
  });

  if (filterInput) {
    filterInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const val = filterInput.value.trim();
        if (val) colFilters.set(colId, val);
        else colFilters.delete(colId);
        closeColMenu();
        renderAll();
      }
      if (e.key === 'Escape') closeColMenu();
    });
  }
}

function closeColMenu() {
  const el = document.getElementById('activeColMenu');
  if (el) el.remove();
  activeColMenu = null;
}

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
          if (globalThis.SSDatabaseView && typeof globalThis.SSDatabaseView.render === 'function') {
            await globalThis.SSDatabaseView.render();
          } else {
            await renderAll();
          }
        } catch (err) { console.warn('Dashboard refresh failed', err); }
      }
    });
  }
  window.addEventListener('resize', () => applyFrozenColumnOffsets());

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

  // View toggle
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentView = btn.dataset.view;
      document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === currentView));
      renderAll();
    });
  });

  // Utility modals
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
  document.getElementById('columnToggleList')?.addEventListener('change', e => {
    const input = e.target.closest('[data-column-toggle]');
    if (!input || input.disabled) return;
    if (input.checked) {
      hiddenCols.delete(input.dataset.columnToggle);
      autoHiddenDynamicCols.delete(input.dataset.columnToggle);
    } else {
      hiddenCols.add(input.dataset.columnToggle);
    }
    renderAll();
  });
  document.getElementById('columnSearchInput')?.addEventListener('input', renderColumnControlList);
  document.getElementById('groupSearchInput')?.addEventListener('input', renderGroupingModal);
  document.getElementById('filterSelectedToggle')?.addEventListener('change', e => {
    selectedOnlyFilter = !!e.target.checked;
    renderAll();
  });
  document.getElementById('filterNotedToggle')?.addEventListener('change', e => {
    notedOnlyFilter = !!e.target.checked;
    renderAll();
  });
  document.getElementById('freezeToggleList')?.addEventListener('change', e => {
    const input = e.target.closest('[data-freeze-column]');
    if (!input) return;
    if (input.checked) {
      frozenColumnIds.add(input.dataset.freezeColumn);
      hiddenCols.delete(input.dataset.freezeColumn);
      autoHiddenDynamicCols.delete(input.dataset.freezeColumn);
    } else {
      frozenColumnIds.delete(input.dataset.freezeColumn);
    }
    renderAll();
  });
  document.getElementById('freezeSearchInput')?.addEventListener('input', renderFreezeControlList);
  const columnOrderList = document.getElementById('columnOrderList');
  columnOrderList?.addEventListener('dragstart', e => {
    const item = e.target.closest('[data-column-order-id]');
    if (!item) return;
    draggedColumnOrderId = item.dataset.columnOrderId || '';
    item.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedColumnOrderId);
    }
  });
  columnOrderList?.addEventListener('dragover', e => {
    const dragging = columnOrderList.querySelector('.column-order-item.dragging');
    if (!dragging) return;
    e.preventDefault();
    const target = getColumnOrderDropTarget(columnOrderList, e.clientY);
    if (target) columnOrderList.insertBefore(dragging, target);
    else columnOrderList.appendChild(dragging);
  });
  columnOrderList?.addEventListener('drop', e => {
    if (!draggedColumnOrderId) return;
    e.preventDefault();
    saveColumnOrderFromDom();
  });
  columnOrderList?.addEventListener('dragend', e => {
    e.target.closest('[data-column-order-id]')?.classList.remove('dragging');
    draggedColumnOrderId = '';
    renderColumnOrderList();
  });
  document.getElementById('groupingFieldList')?.addEventListener('change', e => {
    const input = e.target.closest('[data-group-field]');
    if (input) setGroupByField(input.dataset.groupField);
  });
  document.getElementById('filterModal')?.addEventListener('click', e => {
    if (!e.target.closest('[data-command="clear-filters"]')) return;
    selectedOnlyFilter = false;
    notedOnlyFilter = false;
    colFilters.clear();
    const filter = document.getElementById('filterSource');
    if (filter) filter.value = '';
    renderAll();
  });
  document.getElementById('columnsModal')?.addEventListener('click', e => {
    if (!e.target.closest('[data-command="reset-columns"]')) return;
    hiddenCols.clear();
    getAllColumns().forEach(col => { if (col.hidden) hiddenCols.add(col.id); });
    columnOrderIds = [];
    renderAll();
  });
  document.getElementById('freezeModal')?.addEventListener('click', e => {
    if (!e.target.closest('[data-command="clear-frozen-columns"]')) return;
    frozenColumnIds.clear();
    renderAll();
  });
  document.getElementById('columnOrderModal')?.addEventListener('click', e => {
    if (!e.target.closest('[data-command="reset-column-order"]')) return;
    columnOrderIds = [];
    renderAll();
  });
  document.getElementById('groupingModal')?.addEventListener('click', e => {
    if (!e.target.closest('[data-command="ungroup"]')) return;
    groupBySource = false;
    groupByField = '';
    groupsCollapsed = false;
    renderAll();
  });

  // Filter bar - click to remove filter
  document.getElementById('filterBar').addEventListener('click', e => {
    const chip = e.target.closest('.filter-chip');
    if (chip) {
      if (chip.dataset.filter === 'selected') selectedOnlyFilter = false;
      else if (chip.dataset.filter === 'noted') notedOnlyFilter = false;
      else colFilters.delete(chip.dataset.col);
      renderAll();
    }
  });

  // Content delegation
  document.getElementById('content').addEventListener('click', async e => {
    // Column menu trigger
    const menuTrigger = e.target.closest('.th-menu-trigger');
    if (menuTrigger) {
      e.stopPropagation();
      const colId = menuTrigger.dataset.col;
      const thInner = menuTrigger.closest('.th-inner');
      openColMenu(colId, thInner);
      return;
    }

    // Column header click for quick sort (not on menu trigger)
    const thInner = e.target.closest('.th-inner[data-col]');
    if (thInner && !e.target.closest('.th-menu-trigger')) {
      const col = thInner.dataset.col;
      if (tableSortCol === col) tableSortAsc = !tableSortAsc;
      else { tableSortCol = col; tableSortAsc = true; }
      await renderAll();
      return;
    }

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

    const rowActionTrigger = e.target.closest('[data-row-action-menu]');
    if (rowActionTrigger) {
      e.stopPropagation();
      openRowActionMenu(rowActionTrigger);
      return;
    }

    const editableCell = e.target.closest('td[data-edit-field], td[data-edit-spec-key]');
    if (editableCell && !e.target.closest('a, button, input, textarea, select, label')) {
      e.stopPropagation();
      startInlineCellEdit(editableCell);
      return;
    }

    const btn = e.target.closest('button');
    if (btn) {
      if (await handleProductActionButton(btn)) closeRowActionMenu();
      return;
    }

    const card = e.target.closest('.product-card[data-idx]');
    if (card && !e.target.closest('a')) {
      const location = readProductLocation(card);
      await activateProductListForAction(location.listName);
      openProductDetail(location.index);
      return;
    }

    const row = e.target.closest('tr[data-idx]');
    if (row && !e.target.closest('a, [data-row-action-menu]')) {
      const location = readProductLocation(row);
      await activateProductListForAction(location.listName);
      openProductDetail(location.index);
      return;
    }
  });

  document.getElementById('content').addEventListener('keydown', async e => {
    const control = e.target.closest('.inline-edit-control');
    if (!control) return;
    e.stopPropagation();
    if (e.key === 'Enter' && control.tagName !== 'TEXTAREA') {
      e.preventDefault();
      await saveInlineCellEdit(control);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      restoreInlineCellEdit();
    }
  });

  document.getElementById('content').addEventListener('focusout', async e => {
    const control = e.target.closest('.inline-edit-control');
    if (!control || !activeInlineEdit) return;
    await saveInlineCellEdit(control);
  });

  // Close column menu on outside click
  document.addEventListener('click', async e => {
    const rowActionButton = e.target.closest('#activeRowActionMenu button');
    if (rowActionButton) {
      e.stopPropagation();
      if (await handleProductActionButton(rowActionButton)) closeRowActionMenu();
      return;
    }
    if (activeRowActionMenu && !e.target.closest('#activeRowActionMenu') && !e.target.closest('[data-row-action-menu]')) {
      closeRowActionMenu();
    }
    if (activeColMenu && !e.target.closest('#activeColMenu') && !e.target.closest('.th-menu-trigger')) {
      closeColMenu();
    }
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
    if (p && p.url) window.open(p.url, '_blank');
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
        document.getElementById('editImageGallery').innerHTML = '<span style="font-size:12px;color:var(--muted)">No additional images</span>';
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
    item.innerHTML = `<img src="${escAttr(safeUrl)}" alt="" title="${escAttr(safeUrl)}" data-hide-parent-on-error="1">
      <button class="img-del" data-url="${escAttr(safeUrl)}" title="Remove">&times;</button>`;
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
      thumbs.innerHTML = '';
    } else {
      prev.classList.toggle('hidden', lbIndex === 0);
      next.classList.toggle('hidden', lbIndex === lbImages.length - 1);
      counter.textContent = `${lbIndex + 1} / ${lbImages.length}`;
      thumbs.innerHTML = lbImages.map((u, i) =>
        `<img src="${escAttr(sanitizeUrl(u))}" class="${i === lbIndex ? 'active' : ''}" data-lbi="${i}" data-hide-on-error="1">`
      ).join('');
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
  document.getElementById('dbCompareBtn')?.addEventListener('click', openComparePanel);
  document.getElementById('compareClose')?.addEventListener('click', () => closeModal('compareModal'));
  /* Invert button: flips the dashboard between standard grid (products
     as rows) and matrix layout (products as columns). */
  document.getElementById('dbInvertBtn')?.addEventListener('click', async () => {
    const SDV = globalThis.SSDatabaseView;
    if (SDV && SDV.toggleInvert) await SDV.toggleInvert();
  });
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
  panels.forEach(panel => { panel.innerHTML = html; });

  if (sideStack) {
    sideStack.innerHTML = configuredProviders
      .filter(provider => provider.id !== defaultProvider?.id)
      .slice(0, 4)
      .map(provider => {
        const label = provider.shortName || provider.name;
        return `<button class="rb-btn-sm" data-provider-shortcut="${escAttr(provider.id)}" title="Run with ${escAttr(label)}"><span class="rb-btn-sm-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18M3 12h18"/></svg></span><span class="rb-btn-sm-label">${esc(label)}</span></button>`;
      })
      .join('');
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
   - The Database view (default, when browsing products)
   - An info page (Settings / About / Help / Suggest / Report)
   - The AI results page
   - The product detail page
   The body class is-info-page hides #dbView and reveals #content via CSS. */
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
  const dbView = document.getElementById('dbView');
  if (dbView) dbView.hidden = false;
  // Tell the Database view to re-render in case the active list changed
  // while the info page was open.
  if (globalThis.SSDatabaseView && typeof globalThis.SSDatabaseView.render === 'function') {
    globalThis.SSDatabaseView.render();
  }
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
  const dbView = document.getElementById('dbView');
  if (dbView) dbView.hidden = true;
  const content = document.getElementById('content');
  content.classList.remove('content--legacy-unused');
  content.classList.add('content--legacy-unused'); // ensure the class is present so CSS rules apply
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
  content.innerHTML = `<section class="dashboard-page">
    <header class="dashboard-page-head">
      <div>
        <h2>${esc(title)}</h2>
        ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
      </div>
      <button class="rb-btn-sm" type="button" data-dashboard-back>Back to Products</button>
    </header>
    <div class="dashboard-page-body">${bodyHtml}</div>
  </section>`;
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

/* Compare = filter mode. Click Compare with 2+ rows selected and the
   grid filters down to only those rows. Click Compare again to clear
   the filter. With 0 or 1 selected, show an instructions modal so
   the user knows what to do. The modal is the simplest "side-by-side"
   layout when they want it AS WELL — invoked via the Invert button. */
let compareFilterActive = false;
async function openComparePanel() {
  /* If the filter is already on, treat the click as "clear filter". */
  const SDV = globalThis.SSDatabaseView;
  if (compareFilterActive) {
    if (SDV && SDV.clearCompareFilter) SDV.clearCompareFilter();
    compareFilterActive = false;
    const btn = document.getElementById('dbCompareBtn');
    if (btn) btn.classList.remove('active');
    toast.show('Showing all products');
    return;
  }
  const selected = (SDV && SDV.getSelectedRows) ? SDV.getSelectedRows() : [];
  if (!selected || selected.length < 2) {
    /* Less than 2 selected — show instructions. */
    openCompareInstructions();
    return;
  }
  if (SDV && SDV.applyCompareFilter) {
    SDV.applyCompareFilter(selected);
    compareFilterActive = true;
    const btn = document.getElementById('dbCompareBtn');
    if (btn) btn.classList.add('active');
    toast.show('Showing only ' + selected.length + ' selected products. Click "Selected only" again to show everything.');
  }
}

function openCompareInstructions() {
  const body = document.getElementById('compareBody');
  if (body) body.innerHTML = `
    <div class="ss-compare-help">
      <h3>How to compare products</h3>
      <ol>
        <li><strong>Check the boxes</strong> next to the products you want to compare — pick 2 to 4.</li>
        <li><strong>Click "Selected only"</strong> again. The table filters down to just those products so you can scan them side-by-side.</li>
        <li><strong>Click "Selected only" once more</strong> to clear the filter and show every product again.</li>
      </ol>
      <p class="ai-muted">Tip: the default <strong>Compare</strong> view (in the Layout group) lays the products out as columns and specs as rows — perfect for spec-by-spec head-to-head. Switch to <strong>List</strong> if you'd rather see products as rows.</p>
    </div>`;
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

function applySortDirection(ascending) {
  tableSortAsc = ascending;
  const sort = document.getElementById('sortBy');
  if (sort?.value === 'price-asc' || sort?.value === 'price-desc') sort.value = ascending ? 'price-asc' : 'price-desc';
  renderAll();
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

    const groupFieldBtn = e.target.closest('[data-group-field]');
    if (groupFieldBtn && !groupFieldBtn.disabled) {
      setGroupByField(groupFieldBtn.dataset.groupField);
      return;
    }

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
    else if (command === 'toggle-compact') {
      compactMode = !compactMode;
      syncRibbonViewState();
      toast.show(compactMode ? 'Compact view enabled' : 'Compact view disabled');
    } else if (command === 'toggle-gridlines') {
      gridlinesEnabled = !gridlinesEnabled;
      syncRibbonViewState();
      toast.show(gridlinesEnabled ? 'Gridlines enabled' : 'Gridlines hidden');
    } else if (command === 'sort-ascending') {
      applySortDirection(true);
    } else if (command === 'sort-descending') {
      applySortDirection(false);
    } else if (command === 'add-filter') {
      renderFilterModal();
      showModal('filterModal');
      document.getElementById('filterSource')?.focus();
    } else if (command === 'filter-selected') {
      selectedOnlyFilter = !selectedOnlyFilter;
      renderAll();
    } else if (command === 'filter-noted') {
      notedOnlyFilter = !notedOnlyFilter;
      renderAll();
    } else if (command === 'show-columns') {
      renderColumnControlList();
      showModal('columnsModal');
      document.getElementById('columnSearchInput')?.focus();
    } else if (command === 'open-column-order-modal') {
      renderColumnOrderList();
      showModal('columnOrderModal');
    } else if (command === 'open-freeze-modal') {
      renderFreezeControlList();
      showModal('freezeModal');
      document.getElementById('freezeSearchInput')?.focus();
    } else if (command === 'open-group-modal') {
      renderGroupingModal();
      showModal('groupingModal');
      document.getElementById('groupSearchInput')?.focus();
    } else if (command === 'group-by-source') {
      setGroupByField('source');
    } else if (command === 'ungroup') {
      groupBySource = false;
      groupByField = '';
      groupsCollapsed = false;
      renderAll();
    } else if (command === 'expand-groups') {
      if (!groupByField) groupByField = 'source';
      groupBySource = groupByField === 'source';
      groupsCollapsed = false;
      renderAll();
    } else if (command === 'collapse-groups') {
      if (!groupByField) groupByField = 'source';
      groupBySource = groupByField === 'source';
      groupsCollapsed = true;
      renderAll();
    } else if (command === 'documentation' || command === 'about') {
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
    else if (command === 'reset-sort') {
      const sort = document.getElementById('sortBy');
      if (sort) sort.value = 'added';
      tableSortCol = null;
      tableSortAsc = true;
      renderAll();
    } else if (command === 'clear-search') {
      const input = document.getElementById('productSearchInput');
      if (input) input.value = '';
      renderAll();
    } else if (command === 'clear-filters') {
      selectedOnlyFilter = false;
      notedOnlyFilter = false;
      colFilters.clear();
      const filter = document.getElementById('filterSource');
      if (filter) filter.value = '';
      renderAll();
    } else if (command === 'reset-columns') {
      hiddenCols.clear();
      getAllColumns().forEach(col => { if (col.hidden) hiddenCols.add(col.id); });
      columnOrderIds = [];
      renderAll();
    } else if (command === 'hide-all-columns') {
      getAllColumns().forEach(col => { if (col.hideable) hiddenCols.add(col.id); });
      renderAll();
    } else if (command === 'stage-select-all' || command === 'stage-clear-all') {
      const active = command === 'stage-select-all';
      document.querySelectorAll('[data-stage-option]').forEach(btn => {
        if (btn.disabled || btn.hidden) return;
        setStageOptionState(btn, active);
      });
    } else if (command === 'cancel-run') {
      if (activeScanCancel) activeScanCancel();
      else toast.show('No scan is running.', 'error');
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
  meta.innerHTML = `
    <div><span>Run</span><strong>${esc(runId)}</strong></div>
    <div><span>Status</span><strong>${esc(stageStatusText(state.status))}</strong></div>
    <div><span>Products</span><strong>${esc(state.productIndexesText)} (${esc(String(state.productCount || 0))})</strong></div>
    <div><span>List</span><strong>${esc(state.listName || 'Current list')}</strong></div>`;
  if (progressText) progressText.textContent = statusText;
  if (progressPercent) progressPercent.textContent = `${percent}%`;
  if (progressFill) progressFill.style.width = `${percent}%`;
  if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(percent));
  stages.innerHTML = state.stages.map(renderAiDevStage).join('');
  if ('value' in log) log.value = buildAiDevEventLogText(state);
  else log.textContent = buildAiDevEventLogText(state);
  if (viewResultsBtn) {
    viewResultsBtn.hidden = !(['completed', 'partial', 'failed'].includes(state.status) && state.runId);
  }
}

function aiStageLabel(stageId) {
  return globalThis.ShopScoutAI?.STAGES?.find(stage => stage.id === stageId)?.label || stageId || 'Stage';
}

function renderAiOutputHtml(text) {
  if (globalThis.ShopScoutAIUI) return ShopScoutAIUI.renderRichText(text || '');
  return `<div class="ai-text">${esc(text || 'No readable AI output returned.')}</div>`;
}

function latestRunStage(run, stageId) {
  return (run?.stages || []).find(stage => stage.stage === stageId) || null;
}

function stageParsedJson(stage) {
  if (stage?.parsedJson && typeof stage.parsedJson === 'object') return stage.parsedJson;
  if (stage?.responseText && globalThis.ShopScoutAI?.extractJsonFromText) {
    return ShopScoutAI.extractJsonFromText(stage.responseText);
  }
  return null;
}

function reportSourceNameFromUrl(url) {
  try {
    const host = new URL(String(url || '')).hostname.replace(/^www\./, '').toLowerCase();
    const parts = host.split('.');
    const base = parts.length > 1 ? parts[parts.length - 2] : host;
    const names = {
      amazon: 'Amazon',
      anker: 'Anker',
      walmart: 'Walmart',
      target: 'Target',
      bestbuy: 'Best Buy',
      costco: 'Costco',
      ebay: 'eBay',
      aliexpress: 'AliExpress',
      alibaba: 'Alibaba',
      shein: 'SHEIN',
      temu: 'Temu',
      homedepot: 'Home Depot',
      lowes: 'Lowe\'s',
      newegg: 'Newegg'
    };
    return names[base] || base.replace(/(^|-)([a-z])/g, (_, dash, ch) => `${dash ? ' ' : ''}${ch.toUpperCase()}`);
  } catch {
    return 'Source';
  }
}

function renderReportSourceLink(url, label) {
  const safeUrl = sanitizeUrl(url, '');
  const text = label || (safeUrl ? reportSourceNameFromUrl(safeUrl) : 'Source');
  return safeUrl ? `<a class="source-pill src-pill" href="${escAttr(safeUrl)}" target="_blank" rel="noopener">${esc(text)} ↗</a>` : esc(text);
}

function normalizeReportJson(json) {
  if (Array.isArray(json)) return { products: json };
  return json && typeof json === 'object' ? json : {};
}

function firstReportArray(...values) {
  return values.find(Array.isArray) || [];
}

function reportPriceNumber(row) {
  const n = parsePrice(row?.price);
  return Number.isFinite(n) && n < 99999 ? n : 0;
}

function reportRatingNumber(row) {
  const n = parseFloat(String(row?.rating || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function reportReviewCountNumber(row) {
  const n = parseInt(String(row?.reviewCount || '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function reportToneClass(tone) {
  if (tone === 'buy' || tone === 'ok' || tone === 'low') return 'is-good';
  if (tone === 'avoid' || tone === 'bad' || tone === 'high') return 'is-bad';
  return 'is-caution';
}

function reportRiskLevelClass(level) {
  const text = String(level || '').toLowerCase();
  if (/low|verified|ok|good|safe/.test(text)) return 'low';
  if (/high|avoid|bad|suspicious|contradict|poor/.test(text)) return 'high';
  return 'med';
}

function reportBadgeClass(status) {
  const text = String(status || '').toLowerCase();
  if (/verified|confirmed|official|correct|low risk|good|ok|best/.test(text)) return 'ok';
  if (/high|avoid|bad|suspicious|contradict|conflict|wrong|missing|error|poor/.test(text)) return 'bad';
  if (/not needed|none|unknown/.test(text)) return 'muted';
  return 'warn';
}

function reportTagTone(status) {
  const badge = reportBadgeClass(status);
  if (badge === 'ok') return 'buy';
  if (badge === 'bad') return 'avoid';
  return 'care';
}

function sortArrowSvg() {
  return `<svg class="sort-arrow" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7l3-3 3 3"/></svg>`;
}

function sortableHeader(label, key, extraClass = '') {
  if (!extraClass) return `<th class="sortable" data-sort-key="${escAttr(key)}">${esc(label)}${sortArrowSvg()}</th>`;
  return `<th class="sortable ${escAttr(extraClass)}" data-sort-key="${escAttr(key)}">${esc(label)}${sortArrowSvg()}</th>`;
}

function plainCellText(value) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.map(plainCellText).filter(Boolean).join('; ');
  if (typeof value === 'object') {
    const pairs = Object.entries(value)
      .filter(([, item]) => item != null && item !== '')
      .slice(0, 4)
      .map(([key, item]) => `${key}: ${plainCellText(item)}`);
    return pairs.join('; ');
  }
  return String(value);
}

function productSpecMap(product) {
  const map = new Map();
  const specs = normalizeProductSpecs ? normalizeProductSpecs(product) : (product?.rawSpecs || []);
  specs.forEach(spec => {
    const key = String(spec?.key || '').replace(/\s+/g, ' ').trim();
    if (!key) return;
    map.set(key.toLowerCase(), normalizeSpecValue ? normalizeSpecValue(spec?.value) : (spec?.value || ''));
  });
  return map;
}

function specValueForProduct(product, key) {
  const map = productSpecMap(product);
  const direct = map.get(String(key || '').toLowerCase());
  if (direct) return direct;
  const normalized = String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [specKey, value] of map.entries()) {
    if (specKey.replace(/[^a-z0-9]/g, '') === normalized) return value;
  }
  return '';
}

function reportProductName(product) {
  const parts = [
    getCorrectedValue(product, 'brand'),
    getCorrectedValue(product, 'modelName'),
    getCorrectedValue(product, 'modelNumber')
  ].map(value => String(value || '').trim()).filter(Boolean);
  const uniqueParts = parts.filter((value, index) => parts.findIndex(other => other.toLowerCase() === value.toLowerCase()) === index);
  if (uniqueParts.length >= 2) return uniqueParts.join(' | ');
  return getCorrectedValue(product, 'productName') || getCorrectedValue(product, 'title') || 'Untitled product';
}

function reportShortName(product) {
  const name = reportProductName(product);
  return name.length > 92 ? `${name.slice(0, 89)}...` : name;
}

function buildRunProductList(data, run) {
  const lists = data?.lists || {};
  const list = lists[run?.listName] || lists[data?.activeList] || [];
  if (!Array.isArray(list)) return [];
  if (Array.isArray(run?.productIndexes) && run.productIndexes.length) {
    return run.productIndexes.map(index => list[Number(index)]).filter(Boolean);
  }
  if (Array.isArray(run?.productUrls) && run.productUrls.length) {
    const byUrl = new Map(list.filter(product => product?.url).map(product => [product.url, product]));
    const matched = run.productUrls.map(url => byUrl.get(url)).filter(Boolean);
    if (matched.length) return matched;
  }
  return list;
}

function reportProductRows(products) {
  return (products || []).map((product, index) => {
    const url = sanitizeUrl(product?.url, '');
    const image = sanitizeUrl(product?.image, '');
    const rating = getCorrectedValue(product, 'rating');
    const reviewCount = normalizeReviewCount(product?.reviewCount);
    return {
      index,
      id: index + 1,
      rank: String(index + 1).padStart(2, '0'),
      product,
      name: reportProductName(product),
      shortName: reportShortName(product),
      title: getCorrectedValue(product, 'title'),
      price: getCorrectedValue(product, 'newPrice') || '-',
      usedPrice: getCorrectedValue(product, 'usedPrice'),
      source: product?.source || reportSourceNameFromUrl(url),
      url,
      image,
      seller: getCorrectedValue(product, 'sellerName') || '-',
      brand: getCorrectedValue(product, 'brand') || '-',
      model: getCorrectedValue(product, 'modelNumber') || getCorrectedValue(product, 'modelName') || '-',
      rating,
      reviewCount,
      ratingText: formatRatingDisplay(rating, product?.reviewCount) || '-',
      category: getCorrectedValue(product, 'category') || ''
    };
  });
}

function buildReportSpecKeys(products, comparisonJson) {
  const productEntries = Array.isArray(comparisonJson?.products) ? comparisonJson.products : [];
  const fromJson = [
    comparisonJson?.important_spec_keys,
    comparisonJson?.importantSpecKeys,
    comparisonJson?.buyingFactors,
    comparisonJson?.buying_factors,
    comparisonJson?.category_buying_factors,
    productEntries.flatMap(item => [
      item?.important_spec_keys,
      item?.importantSpecKeys,
      item?.buyingFactors,
      item?.buying_factors
    ].filter(Array.isArray).flat())
  ].find(value => Array.isArray(value) && value.length);
  const keys = fromJson?.map(plainCellText).filter(Boolean) || [];
  const localKeys = getCategoryComparisonSpecKeys(products, 5);
  const merged = [...keys, ...localKeys].filter(Boolean);
  const seen = new Set();
  return merged.filter(key => {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).slice(0, 5);
}

function findJsonProductEntry(json, row) {
  const lists = [
    Array.isArray(json) ? json : null,
    json?.products,
    json?.final_ranking,
    json?.finalRanking,
    json?.quick_verdict?.products,
    json?.quickVerdict?.products
  ].filter(Array.isArray);
  const needles = [row.name, row.title, row.brand, row.model].filter(Boolean).map(value => String(value).toLowerCase());
  for (const list of lists) {
    const direct = list.find(item => Number(item?.id || item?.rank || item?.product_id || item?.productIndex) === row.id);
    if (direct) return direct;
    const byName = list.find(item => {
      const hay = plainCellText(item).toLowerCase();
      return needles.some(needle => needle && hay.includes(needle.slice(0, 30)));
    });
    if (byName) return byName;
  }
  return null;
}

function textMentionsProduct(text, row) {
  const hay = String(text || '').toLowerCase();
  return [row.name, row.title, row.brand, row.model]
    .filter(Boolean)
    .some(value => hay.includes(String(value).toLowerCase().slice(0, 28)));
}

function buildProductVerdict(row, comparisonJson, comparisonText) {
  const entry = findJsonProductEntry(comparisonJson, row) || {};
  const summary = plainCellText(entry.recommendation || entry.verdict || entry.summary || entry.reason || entry.why || entry.notes);
  const rawStatus = plainCellText(entry.status || entry.recommendation_type || entry.decision || entry.rank_label || summary).toLowerCase();
  let tone = 'care';
  let label = 'AI reviewed';
  if (/(best|winner|recommended|buy|value|lowest risk)/.test(rawStatus)) {
    tone = 'buy';
    label = /value/.test(rawStatus) ? 'Best value' : 'Recommended';
  } else if (/(avoid|skip|do not|high risk|mismatch|suspicious)/.test(rawStatus)) {
    tone = 'avoid';
    label = 'Caution';
  } else if (textMentionsProduct(comparisonText, row)) {
    label = 'Discussed by AI';
  }
  return {
    tone,
    label,
    reason: summary || 'Reviewed in the AI analysis. Open the comparison and risk tabs for the detailed reasoning.'
  };
}

function reportObjectValue(item, keys, fallback = '') {
  if (!item || typeof item !== 'object') return fallback;
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && String(item[key]).trim() !== '') {
      return item[key];
    }
  }
  const normalizedKeys = keys.map(key => String(key).toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const [key, value] of Object.entries(item)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedKeys.includes(normalized) && value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return fallback;
}

function reportObjectArray(item, keys) {
  for (const key of keys) {
    const value = item?.[key];
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
}

function reportObjectList(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return value;
    if (value && typeof value === 'object') {
      const nested = reportObjectArray(value, ['products', 'items', 'rows', 'cards', 'findings']);
      if (nested.length) return nested;
    }
  }
  return [];
}

function reportTemplateRoot(json) {
  return json?.template_report || json?.templateReport || json || {};
}

function reportItemMatchesRow(item, row) {
  if (!item || !row) return false;
  const directId = reportObjectValue(item, ['id', 'rank', 'product_id', 'productId', 'productIndex', 'index']);
  if (directId !== '') {
    const numeric = Number(directId);
    if (Number.isFinite(numeric) && (numeric === row.id || numeric === row.index)) return true;
    if (String(directId).padStart(2, '0') === row.rank) return true;
  }
  const hay = plainCellText(item).toLowerCase();
  return [row.name, row.shortName, row.title, row.brand, row.model]
    .filter(value => value && value !== '-')
    .some(value => hay.includes(String(value).toLowerCase().slice(0, 28)));
}

function findReportItemForRow(row, ...lists) {
  for (const list of lists.filter(Array.isArray)) {
    const direct = list.find(item => reportItemMatchesRow(item, row));
    if (direct) return direct;
  }
  return null;
}

function productKeyCandidates(row) {
  return [
    row.id,
    row.rank,
    row.index,
    `product_${row.id}`,
    `product${row.id}`,
    row.name,
    row.shortName,
    row.title,
    row.brand,
    row.model
  ].map(value => String(value || '').trim()).filter(Boolean);
}

function valueForRowFromMap(map, row) {
  if (!map || typeof map !== 'object') return '';
  const candidates = productKeyCandidates(row);
  for (const candidate of candidates) {
    if (map[candidate] !== undefined && map[candidate] !== null && String(map[candidate]).trim() !== '') return map[candidate];
  }
  const normalizedCandidates = candidates.map(value => value.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const [key, value] of Object.entries(map)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedCandidates.includes(normalized) && value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function valueForFactorProduct(item, row, factorName) {
  if (!item || typeof item !== 'object') return specValueForProduct(row.product, factorName);
  const maps = [
    item.values,
    item.product_values,
    item.productValues,
    item.by_product,
    item.byProduct
  ].filter(value => value && typeof value === 'object' && !Array.isArray(value));
  for (const map of maps) {
    const value = valueForRowFromMap(map, row);
    if (value) return plainCellText(value);
  }
  const productLists = [
    item.products,
    item.items,
    item.rows,
    item.values
  ].filter(Array.isArray);
  for (const list of productLists) {
    const found = findReportItemForRow(row, list);
    if (found) {
      return plainCellText(reportObjectValue(found, ['value', 'finding', 'assessment', 'text', 'note', 'summary', factorName], plainCellText(found)));
    }
  }
  return plainCellText(reportObjectValue(item, productKeyCandidates(row), specValueForProduct(row.product, factorName)));
}

function factorCellClass(item, row) {
  const best = reportObjectValue(item, ['best', 'winner', 'bestProduct', 'best_product']);
  const worst = reportObjectValue(item, ['worst', 'loser', 'weakestProduct', 'weakest_product']);
  const candidates = productKeyCandidates(row).map(value => value.toLowerCase());
  if (best && candidates.some(value => String(best).toLowerCase().includes(value))) return 'best';
  if (worst && candidates.some(value => String(worst).toLowerCase().includes(value))) return 'worst';
  return '';
}

function reportNotesFromJson(...values) {
  return values.flatMap(value => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(plainCellText).filter(Boolean);
    if (typeof value === 'object') return Object.values(value).map(plainCellText).filter(Boolean);
    return [plainCellText(value)].filter(Boolean);
  }).filter(Boolean).slice(0, 6);
}

function templateVerdicts(ctx) {
  const { products, comparisonJson } = ctx;
  const template = reportTemplateRoot(comparisonJson);
  const verdictLists = [
    template?.verdicts,
    template?.final_ranking,
    template?.finalRanking,
    comparisonJson?.quick_verdict?.products,
    comparisonJson?.quickVerdict?.products,
    comparisonJson?.final_ranking,
    comparisonJson?.finalRanking,
    comparisonJson?.recommendations,
    comparisonJson?.verdicts,
    comparisonJson?.products
  ].filter(Array.isArray);
  return products.map(row => {
    const entry = findReportItemForRow(row, ...verdictLists) || {};
    const fallback = buildProductVerdict(row, comparisonJson || {}, '');
    const status = plainCellText(reportObjectValue(entry, ['status', 'decision', 'recommendation_type', 'recommendationType', 'rank_label', 'rankLabel', 'verdict'], fallback.label));
    const reason = plainCellText(reportObjectValue(entry, ['reason', 'why', 'summary', 'notes', 'key_reason', 'keyReason', 'finding'], fallback.reason));
    return {
      row,
      tone: reportTagTone(`${status} ${reason}`) || fallback.tone,
      label: status || fallback.label,
      reason: reason || fallback.reason
    };
  }).sort((a, b) => ({ buy: 0, care: 1, avoid: 2 }[a.tone] ?? 1) - ({ buy: 0, care: 1, avoid: 2 }[b.tone] ?? 1));
}

function templateComparisonRows(ctx) {
  const { products, comparisonJson, specKeys } = ctx;
  const template = reportTemplateRoot(comparisonJson);
  const comparisonLists = [
    template?.comparison_rows,
    template?.comparisonRows,
    template?.comparison_table,
    template?.comparisonTable,
    comparisonJson?.comparison_table,
    comparisonJson?.comparisonTable,
    comparisonJson?.decision_table,
    comparisonJson?.decisionTable,
    comparisonJson?.compare_table,
    comparisonJson?.compareTable,
    comparisonJson?.products
  ].filter(Array.isArray);
  return products.map(row => {
    const entry = findReportItemForRow(row, ...comparisonLists) || {};
    const specs = specKeys.map(key => ({
      key,
      value: plainCellText(reportObjectValue(entry, [key, key.toLowerCase(), key.replace(/\s+/g, '_')], specValueForProduct(row.product, key) || '-'))
    }));
    const confidence = plainCellText(reportObjectValue(entry, ['confidence', 'verification_status', 'verificationStatus', 'status'], ''));
    return { row, entry, specs, confidence };
  });
}

function templateBuyingFactors(ctx) {
  const { products, comparisonJson, specKeys } = ctx;
  const template = reportTemplateRoot(comparisonJson);
  const factorSource = reportObjectList(
    template?.buying_factors,
    template?.buyingFactors,
    template?.buying_factor_matrix,
    template?.buyingFactorMatrix,
    comparisonJson?.buying_factor_matrix,
    comparisonJson?.buyingFactorMatrix,
    comparisonJson?.buying_factors_matrix,
    comparisonJson?.buyingFactorsMatrix,
    comparisonJson?.buying_factor_comparison,
    comparisonJson?.buyingFactorComparison,
    comparisonJson?.buying_factors,
    comparisonJson?.buyingFactors,
    comparisonJson?.important_spec_keys,
    comparisonJson?.importantSpecKeys,
    specKeys
  );
  const factorNames = factorSource.length ? factorSource : specKeys;
  return factorNames.slice(0, 14).map(item => {
    const name = plainCellText(typeof item === 'object'
      ? reportObjectValue(item, ['factor', 'name', 'key', 'label', 'criterion', 'buying_factor', 'buyingFactor'], '')
      : item);
    const factorName = name || 'Buying factor';
    return {
      name: factorName,
      note: plainCellText(typeof item === 'object' ? reportObjectValue(item, ['note', 'summary', 'reason'], '') : ''),
      cells: products.slice(0, 8).map(row => ({
        row,
        value: valueForFactorProduct(item, row, factorName) || '<span class="empty">not stated</span>',
        tone: factorCellClass(item, row)
      }))
    };
  });
}

function templatePriceValue(ctx) {
  const { products, comparisonJson } = ctx;
  const template = reportTemplateRoot(comparisonJson);
  const valueLists = [
    reportObjectList(template?.price_value, template?.priceValue),
    reportObjectList(template?.value_analysis, template?.valueAnalysis),
    reportObjectList(comparisonJson?.price_value, comparisonJson?.priceValue),
    reportObjectList(comparisonJson?.value_analysis, comparisonJson?.valueAnalysis),
    reportObjectList(comparisonJson?.value_cards, comparisonJson?.valueCards),
    comparisonJson?.products
  ].filter(Array.isArray);
  const cheapest = Math.min(...products.map(reportPriceNumber).filter(Boolean));
  return products.map(row => {
    const entry = findReportItemForRow(row, ...valueLists) || {};
    const price = reportPriceNumber(row);
    const judgement = plainCellText(reportObjectValue(entry, ['judgement', 'judgment', 'value', 'verdict', 'status', 'recommendation'], price && cheapest && price === cheapest ? 'Best saved price' : 'Compare against specs'));
    const reason = plainCellText(reportObjectValue(entry, ['reason', 'why', 'summary', 'notes', 'assessment'], row.usedPrice ? `Used price: ${row.usedPrice}.` : 'Value depends on verified specs and seller reliability.'));
    const tone = reportTagTone(`${judgement} ${reason}`) || (price && cheapest && price === cheapest ? 'buy' : 'care');
    return { row, judgement, reason, tone };
  });
}

function templateReviewSignals(ctx) {
  const { products, comparisonJson } = ctx;
  const template = reportTemplateRoot(comparisonJson);
  const reviewLists = [
    reportObjectList(template?.review_signals, template?.reviewSignals),
    reportObjectList(template?.review_analysis, template?.reviewAnalysis),
    reportObjectList(comparisonJson?.review_analysis, comparisonJson?.reviewAnalysis),
    reportObjectList(comparisonJson?.review_signals, comparisonJson?.reviewSignals),
    reportObjectList(comparisonJson?.reviews),
    comparisonJson?.products
  ].filter(Array.isArray);
  return products.map(row => {
    const entry = findReportItemForRow(row, ...reviewLists) || {};
    const rating = reportRatingNumber(row);
    const count = reportReviewCountNumber(row);
    const strength = plainCellText(reportObjectValue(entry, ['strength', 'rating_quality', 'ratingQuality', 'quality', 'confidence'], count >= 100 ? 'Stronger' : count ? 'Small sample' : 'Not stated'));
    const note = plainCellText(reportObjectValue(entry, ['note', 'summary', 'reason', 'complaints', 'common_complaints', 'commonComplaints'], count < 25 ? 'Small review sample; treat rating carefully.' : 'Review sample is visible in captured listing data.'));
    const tone = rating >= 4.4 && count >= 50 ? 'buy' : rating < 4 || count < 25 ? 'avoid' : 'care';
    return { row, rating, count, strength, note, tone };
  });
}

function templateVerificationAudits(ctx) {
  const { products, verificationJson, enrichmentJson, comparisonJson, specKeys } = ctx;
  const verificationTemplate = reportTemplateRoot(verificationJson);
  const enrichmentTemplate = reportTemplateRoot(enrichmentJson);
  const comparisonTemplate = reportTemplateRoot(comparisonJson);
  const verificationLists = [
    verificationTemplate?.verification_audits,
    verificationTemplate?.verificationAudits,
    verificationTemplate?.products,
    verificationJson?.products,
    verificationJson?.claim_audits,
    verificationJson?.claimAudits,
    verificationJson?.verification_summary,
    verificationJson?.verificationSummary
  ].filter(Array.isArray);
  return products.map(row => {
    const entry = findReportItemForRow(row, ...verificationLists) || findJsonProductEntry(verificationJson, row) || {};
    const status = plainCellText(reportObjectValue(entry, ['overall_status', 'overallStatus', 'status', 'verification_status', 'verificationStatus', 'listing_status', 'listingStatus', 'confidence'], 'Reviewed'));
    const note = plainCellText(reportObjectValue(entry, ['key_result', 'keyResult', 'notes', 'summary', 'finding', 'reason', 'verdict'], 'See the claim audit for this product.'));
    const claims = reportObjectList(
      entry.claims,
      entry.claim_audit,
      entry.claimAudit,
      entry.findings,
      entry.checks,
      entry.verifications,
      entry.specs
    ).slice(0, 14).map(claim => ({
      claim: plainCellText(reportObjectValue(claim, ['claim', 'field', 'spec', 'key', 'title', 'name'], plainCellText(claim))),
      status: plainCellText(reportObjectValue(claim, ['status', 'result', 'verification_status', 'verificationStatus', 'confidence'], status)),
      evidence: plainCellText(reportObjectValue(claim, ['evidence', 'source', 'reason', 'notes', 'summary'], note))
    }));
    const fallbackClaims = claims.length ? claims : claimRowsForProduct({ verificationJson, specKeys }, row, { entry, status, note });
    const missingSpecs = reportObjectList(
      entry.missing_specs,
      entry.missingSpecs,
      entry.missing_important_specs,
      entry.missingImportantSpecs,
      verificationTemplate?.missing_important_specs,
      verificationTemplate?.missingImportantSpecs,
      enrichmentTemplate?.missing_important_specs,
      enrichmentTemplate?.missingImportantSpecs,
      comparisonTemplate?.missing_attributes,
      comparisonTemplate?.missingAttributes,
      enrichmentJson?.missing_important_specs,
      enrichmentJson?.missingImportantSpecs,
      comparisonJson?.missing_attributes,
      comparisonJson?.missingAttributes
    ).map(plainCellText).filter(Boolean).slice(0, 8);
    const marketingClaims = reportObjectList(
      entry.marketing_claims,
      entry.marketingClaims,
      entry.suspicious_claims,
      entry.suspiciousClaims
    ).map(plainCellText).filter(Boolean).slice(0, 8);
    return {
      row,
      entry,
      status,
      note,
      tone: reportTagTone(`${status} ${note}`),
      claims: fallbackClaims,
      missingSpecs,
      marketingClaims
    };
  });
}

function templateSpecCorrections(ctx) {
  const { products, corrections, enrichmentJson, verificationJson } = ctx;
  const enrichmentTemplate = reportTemplateRoot(enrichmentJson);
  const verificationTemplate = reportTemplateRoot(verificationJson);
  const correctionRows = corrections.length
    ? corrections
    : reportObjectList(enrichmentTemplate?.corrections, verificationTemplate?.corrections, enrichmentJson?.corrections, verificationJson?.corrections, enrichmentJson?.specification_ledger, verificationJson?.specification_ledger);
  const rows = correctionRows.map((item, index) => ({
    id: String(index + 1).padStart(2, '0'),
    product: plainCellText(reportObjectValue(item, ['product', 'product_name', 'productName', 'name'], '')),
    field: plainCellText(reportObjectValue(item, ['field', 'specification', 'key', 'attribute', 'spec'], 'Spec')),
    original: plainCellText(reportObjectValue(item, ['original', 'old', 'oldValue', 'listing', 'listing_value', 'listingValue', 'before', 'current'], '')),
    corrected: plainCellText(reportObjectValue(item, ['corrected', 'new', 'newValue', 'official', 'officialValue', 'official_or_external_value', 'verified_value', 'verifiedValue', 'after', 'value'], '')),
    status: plainCellText(reportObjectValue(item, ['status', 'verification_status', 'verificationStatus', 'confidence', 'result'], 'AI finding')),
    source: reportObjectValue(item, ['source', 'source_url', 'sourceUrl', 'url'], '')
  }));
  const summary = products.slice(0, 8).map(row => {
    const hay = `${row.name} ${row.title} ${row.brand} ${row.model}`.toLowerCase();
    const matched = rows.filter(item => {
      const text = `${item.product} ${item.field} ${item.original} ${item.corrected}`.toLowerCase();
      return text.split(/\s+/).some(token => token.length > 4 && hay.includes(token));
    });
    return {
      row,
      status: matched.length ? 'Corrected / flagged' : 'Listing-only / unverified',
      tone: matched.length ? 'avoid' : 'care',
      reason: matched[0] ? `${matched[0].field}: ${matched[0].original || 'listing value'} → ${matched[0].corrected || matched[0].status}` : 'No field-level correction was returned. Treat important claims as listing-only until verified.'
    };
  });
  return { rows, summary };
}

function templateRiskAxes(ctx) {
  const { products, comparisonJson, verificationJson } = ctx;
  const template = reportTemplateRoot(comparisonJson);
  const riskLists = [
    reportObjectList(template?.risk_axes, template?.riskAxes),
    reportObjectList(template?.risk_profile, template?.riskProfile),
    reportObjectList(comparisonJson?.risk_profile, comparisonJson?.riskProfile),
    reportObjectList(comparisonJson?.risk_axes, comparisonJson?.riskAxes),
    reportObjectList(comparisonJson?.risk_summary, comparisonJson?.riskSummary),
    comparisonJson?.risks,
    verificationJson?.risks,
    comparisonJson?.products
  ].filter(Array.isArray);
  const productRisks = products.map(row => {
    const entry = findReportItemForRow(row, ...riskLists) || findJsonProductEntry(comparisonJson, row) || findJsonProductEntry(verificationJson, row) || {};
    const overall = plainCellText(reportObjectValue(entry, ['overall_risk', 'overallRisk', 'risk_level', 'riskLevel', 'risk', 'level', 'status'], 'Review'));
    const spec = plainCellText(reportObjectValue(entry, ['spec_risk', 'specRisk', 'specification_risk', 'specificationRisk'], /listing-only|unverified|suspicious/i.test(plainCellText(entry)) ? 'High' : overall));
    const seller = plainCellText(reportObjectValue(entry, ['seller_risk', 'sellerRisk', 'store_risk', 'storeRisk'], row.seller && row.seller !== '-' ? 'Medium' : 'Review'));
    const warranty = plainCellText(reportObjectValue(entry, ['warranty_risk', 'warrantyRisk'], 'Review'));
    const rebrand = plainCellText(reportObjectValue(entry, ['rebrand_risk', 'rebrandRisk', 'duplicate_risk', 'duplicateRisk'], /duplicate|rebrand|mismatch/i.test(plainCellText(entry)) ? 'High' : 'Review'));
    const returns = plainCellText(reportObjectValue(entry, ['return_risk', 'returnRisk', 'returns_risk', 'returnsRisk'], 'Review'));
    const note = plainCellText(reportObjectValue(entry, ['note', 'reason', 'summary', 'description', 'finding'], plainCellText(entry) || `${row.seller !== '-' ? row.seller : 'Seller'} · ${row.source || 'Unknown source'}`));
    return { row, overall, spec, seller, warranty, rebrand, returns, note };
  });
  const axisNotes = reportNotesFromJson(
    template?.risk_axis_notes,
    template?.riskAxisNotes,
    template?.risk_notes,
    template?.riskNotes,
    comparisonJson?.risk_axis_notes,
    comparisonJson?.riskAxisNotes,
    comparisonJson?.risk_notes,
    comparisonJson?.riskNotes,
    comparisonJson?.risk_summary,
    verificationJson?.risk_notes,
    verificationJson?.riskNotes
  );
  return { products: productRisks, axisNotes };
}

function templateSellerReliability(ctx) {
  const { products, comparisonJson } = ctx;
  const template = reportTemplateRoot(comparisonJson);
  const sellerLists = [
    reportObjectList(template?.seller_reliability, template?.sellerReliability),
    reportObjectList(template?.seller_risk, template?.sellerRisk),
    reportObjectList(comparisonJson?.seller_reliability, comparisonJson?.sellerReliability),
    reportObjectList(comparisonJson?.seller_risk, comparisonJson?.sellerRisk),
    reportObjectList(comparisonJson?.store_reliability, comparisonJson?.storeReliability),
    comparisonJson?.products
  ].filter(Array.isArray);
  return products.map(row => {
    const entry = findReportItemForRow(row, ...sellerLists) || {};
    const signal = plainCellText(reportObjectValue(entry, ['signal', 'seller_signal', 'sellerSignal', 'source_signal', 'sourceSignal'], `${row.source || 'Source'} · ${row.seller || 'seller not captured'}`));
    const assessment = plainCellText(reportObjectValue(entry, ['assessment', 'status', 'risk', 'seller_risk', 'sellerRisk', 'verdict'], row.seller && row.seller !== '-' ? 'Review' : 'Unknown'));
    return { row, signal, assessment };
  });
}

function buildAiTemplateReportModel(ctx) {
  return {
    verdicts: templateVerdicts(ctx),
    comparisonRows: templateComparisonRows(ctx),
    buyingFactors: templateBuyingFactors(ctx),
    priceValue: templatePriceValue(ctx),
    reviewSignals: templateReviewSignals(ctx),
    verificationAudits: templateVerificationAudits(ctx),
    specCorrections: templateSpecCorrections(ctx),
    riskAxes: templateRiskAxes(ctx),
    sellerReliability: templateSellerReliability(ctx)
  };
}

function readableStageHtml(stage, emptyMessage = 'No readable AI output is available for this section.') {
  if (!stage) return `<div class="empty-state">${esc(emptyMessage)}</div>`;
  if (stage.status === 'failed' || stage.status === 'skipped') {
    return `<div class="empty-state">${esc(stage.error || 'This stage did not return output.')}</div>`;
  }
  let text = String(stage.responseText || '').trim();
  if (globalThis.ShopScoutAIUI?.stripStructuredJson) text = ShopScoutAIUI.stripStructuredJson(text);
  if (!text || /^[\[{]/.test(text.trim())) return `<div class="empty-state">${esc(emptyMessage)}</div>`;
  return `<div class="ai-readable">${renderAiOutputHtml(text)}</div>`;
}

function renderReportMeta(vm) {
  return `<div class="ai-results-meta">
    <div><span>Run</span><strong>${esc(vm.run.id || 'Latest run')}</strong></div>
    <div><span>Status</span><strong>${esc(stageStatusText(vm.run.status))}</strong></div>
    <div><span>Products</span><strong>${esc(vm.productText)}</strong></div>
    <div><span>Completed</span><strong>${esc(String(vm.completedStages))} stage${vm.completedStages === 1 ? '' : 's'}</strong></div>
  </div>`;
}

function renderProductThumb(row, extraClass = '') {
  const cls = `prod-thumb p${((row.index % 8) + 1)}${extraClass ? ` ${extraClass}` : ''}`;
  return `<span class="${escAttr(cls)}">${row.image ? `<img src="${escAttr(row.image)}" alt="">` : esc(row.rank)}</span>`;
}

function renderProductThumbSize(row, size = 'md') {
  const cls = `prod-thumb ${size} p${((row.index % 8) + 1)}`;
  return `<span class="${escAttr(cls)}">${row.image ? `<img src="${escAttr(row.image)}" alt="">` : ''}</span>`;
}

function renderProductVerdictImage(row) {
  const cls = `pv-image p${((row.index % 8) + 1)}`;
  return `<div class="${escAttr(cls)}">${row.image ? `<img src="${escAttr(row.image)}" alt="">` : ''}</div>`;
}

function renderStars(row) {
  const rating = reportRatingNumber(row);
  const count = reportReviewCountNumber(row);
  if (!rating && !count) return '<span class="empty">not stated</span>';
  return `<span class="stars">★ ${esc(rating ? rating.toFixed(1).replace(/\.0$/, '.0') : '-')} <span class="count">${count ? `· ${esc(String(count.toLocaleString()))}` : ''}</span></span>`;
}

function renderReportAssessment(items) {
  const bullets = (items || []).map(item => plainCellText(item)).filter(Boolean).slice(0, 5);
  if (!bullets.length) return '';
  return `<div class="assessment">
    <div class="assessment-label">Concise assessment</div>
    <ul>${bullets.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
  </div>`;
}

function renderAiVerdictTab(vm) {
  const cards = (vm.reportModel?.verdicts || []).map(({ row, tone, label, reason }) => {
    const tagIcon = tone === 'buy' ? '●' : tone === 'avoid' ? '✕' : '⚠';
    return `<div class="product-verdict" data-tone="${escAttr(tone)}" data-p="${row.id}">
      <span class="pv-tag ${escAttr(tone)}">${tagIcon} ${esc(label)}</span>
      <div class="pv-body">
        ${renderProductVerdictImage(row)}
        <div class="pv-body-info">
          <div class="pv-name"><span class="pv-rank-num">${esc(row.rank)}</span>${esc(row.shortName)}</div>
          <div class="pv-stats">
            <div class="stat"><span class="k">price</span><span class="v price">${esc(row.price)}</span></div>
            <div class="stat"><span class="k">rating</span>${renderStars(row)}</div>
          </div>
        </div>
      </div>
      <div class="pv-why">${esc(reason)}</div>
    </div>`;
  }).join('');

  return `<div class="verdict-row">${cards || '<div class="empty-state"><div class="es-title">No products available</div><div class="es-body">This AI run did not include product rows.</div></div>'}</div>
    ${renderReportAssessment(vm.verdictNotes)}
  `;
}

function renderAiCompareTab(vm) {
  const specHeaders = vm.specKeys.map(key => sortableHeader(key, `spec:${key}`)).join('');
  const rows = (vm.reportModel?.comparisonRows || []).map(item => {
    const { row } = item;
    const specCells = item.specs.map(spec => `<td>${esc(spec.value || '-')}</td>`).join('');
    const confidence = item.confidence
      ? `<span class="badge ${escAttr(reportBadgeClass(item.confidence))} confidence">${esc(item.confidence)}</span>`
      : '<span class="empty">not stated</span>';
    return `<tr data-p="${row.id}">
      <td class="col-id">${esc(row.rank)}</td>
      <td class="col-thumb">${renderProductThumbSize(row, 'lg')}</td>
      <td class="col-product"><strong>${esc(row.shortName)}</strong><span class="model">${esc(row.model)}</span></td>
      <td class="col-price">${esc(row.price)}</td>
      <td class="col-source">${renderReportSourceLink(row.url, row.source)}</td>
      <td class="col-reviews">${renderStars(row)}</td>
      ${specCells}
      <td>${confidence}</td>
    </tr>`;
  }).join('');

  return `<nav class="subtab-bar" aria-label="Overall sub-sections">
    <button class="subtab-btn active" data-sub="compare"><span class="sub-num">01</span>Comparison</button>
    <button class="subtab-btn" data-sub="factors"><span class="sub-num">02</span>Buying factors</button>
    <button class="subtab-btn" data-sub="price"><span class="sub-num">03</span>Price &amp; value</button>
    <button class="subtab-btn" data-sub="reviews"><span class="sub-num">04</span>Reviews</button>
    <button class="subtab-btn" data-sub="risk"><span class="sub-num">05</span>Risk profile</button>
  </nav>

  <div class="subtab-pane active" data-sub-pane="compare">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Side by side</div>
        <h2 class="section-title">Comparison table</h2>
        <p class="section-deck">Category-specific columns are selected from saved product specs first, then supplemented by AI buying factors.</p>
      </div>
      <div class="table-scroll">
        <table class="cmp-table">
          <thead><tr><th class="col-id-h">#</th><th></th>${sortableHeader('Product', 'product')}${sortableHeader('Price', 'price')}${sortableHeader('Source', 'source')}${sortableHeader('Reviews', 'reviews')}${specHeaders}${sortableHeader('Confidence', 'confidence')}</tr></thead>
          <tbody>${rows || '<tr><td colspan="6">No product rows available.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="notes">
        <div class="note ok"><span class="note-label">Verified</span>Saved listing facts, source, price, brand, and model are displayed from captured product data.</div>
        <div class="note warn"><span class="note-label">Listing-only</span>Performance claims remain listing-only unless the verification stage confirms them.</div>
        <div class="note bad"><span class="note-label">Suspicious</span>Contradictions and identity mismatches are highlighted in verification and risk sections.</div>
      </div>
      ${renderReportAssessment(vm.comparisonNotes)}
    </section>
  </div>

  <div class="subtab-pane" data-sub-pane="factors">
    ${renderAiFactorsSection(vm)}
  </div>

  <div class="subtab-pane" data-sub-pane="price">
    ${renderAiValueCards(vm)}
  </div>

  <div class="subtab-pane" data-sub-pane="reviews">
    ${renderAiReviewCards(vm)}
  </div>

  <div class="subtab-pane" data-sub-pane="risk">
    ${renderAiRiskProfileSection(vm)}
  </div>`;
}

function renderAiFactorsSection(vm) {
  const products = vm.products.slice(0, 6);
  const header = products.map(row => `<div data-p="${row.id}">${renderProductThumbSize(row, 'xl')}<span class="fh-label">${esc(row.shortName)}</span><span class="fh-rank">${esc(row.rank)} · ${esc(row.model)}</span></div>`).join('');
  const factorRows = (vm.reportModel?.buyingFactors || []).map(factor => {
    const cells = factor.cells.slice(0, products.length).map(cell => {
      const cls = cell.tone ? ` class="${escAttr(cell.tone)}"` : '';
      const value = String(cell.value || '').startsWith('<span') ? cell.value : esc(cell.value || '');
      return `<div${cls}>${value || '<span class="empty">not stated</span>'}</div>`;
    }).join('');
    return `<div class="factors-row"><div>${esc(factor.name)}</div>${cells}</div>`;
  }).join('');
  return `<section class="section">
    <div class="section-head">
      <div class="section-eyebrow">Buying criteria</div>
      <h2 class="section-title">Buying factors</h2>
      <p class="section-deck">Same fields, each product to a column, using the important specs for this product category.</p>
    </div>
    <div class="factors" style="--factor-cols:${products.length || 1}">
      <div class="factors-head"><div>Factor</div>${header}</div>
      ${factorRows || '<div class="factors-row"><div>Important specs</div><div><span class="empty">No buying-factor columns were identified.</span></div></div>'}
    </div>
    ${renderReportAssessment((vm.reportModel?.buyingFactors || []).map(factor => factor.note).filter(Boolean))}
  </section>`;
}

function renderAiValueCards(vm) {
  const cards = (vm.reportModel?.priceValue || []).map(({ row, judgement, reason, tone }) => {
    return `<div class="value-card ${escAttr(reportToneClass(tone))}" data-p="${row.id}" data-tone="${escAttr(tone)}">
      <div class="vc-body">
        ${renderProductThumbSize(row, 'md')}
        <div class="vc-info">
          <div class="vc-head"><div class="vc-name"><span class="pv-rank-num">${esc(row.rank)}</span>${esc(row.shortName)}</div><div class="vc-price">${esc(row.price)}</div></div>
          <div class="vc-judgement">${esc(judgement)}</div>
        </div>
      </div>
      <div class="vc-why">${esc(reason)} ${renderReportSourceLink(row.url, row.source)}</div>
    </div>`;
  }).join('');
  return `<section class="section">
    <div class="section-head">
      <div class="section-eyebrow">Price &amp; value</div>
      <h2 class="section-title">Price &amp; value</h2>
      <p class="section-deck">Price cards keep value signals compact and comparable.</p>
    </div>
    <div class="value-strip">${cards || '<div class="empty-state"><div class="es-title">No prices available</div></div>'}</div>
  </section>`;
}

function renderAiReviewCards(vm) {
  const cards = (vm.reportModel?.reviewSignals || []).map(({ row, rating, count, strength, note, tone }) => {
    const pct = Math.max(0, Math.min(100, rating ? (rating / 5) * 100 : 0));
    return `<div class="review-card ${escAttr(reportToneClass(tone))}" data-p="${row.id}" data-tone="${escAttr(tone)}">
      <div class="rc-body">
        ${renderProductThumbSize(row, 'md')}
        <div class="rc-info">
          <div class="rc-name"><span class="pv-rank-num">${esc(row.rank)}</span>${esc(row.shortName)}</div>
          <div class="rc-score"><span class="num">${esc(rating ? rating.toFixed(1) : '-')}</span><span class="denom">/ 5</span></div>
          <div class="rc-meter"><span style="width:${pct}%"></span></div>
          <div class="rc-meta"><span>Reviews <span class="count">${esc(count ? count.toLocaleString() : 'not stated')}</span></span><span>Strength <span class="count">${esc(strength)}</span></span></div>
        </div>
      </div>
      <div class="rc-note">${esc(note)}</div>
    </div>`;
  }).join('');
  return `<section class="section">
    <div class="section-head">
      <div class="section-eyebrow">Review signals</div>
      <h2 class="section-title">Reviews</h2>
      <p class="section-deck">Rating strength and review count are separated so a high score with a tiny sample does not look stronger than it is.</p>
    </div>
    <div class="reviews-grid">${cards || '<div class="empty-state"><div class="es-title">No review data available</div></div>'}</div>
  </section>`;
}

function renderAiRiskProfileSection(vm) {
  const cards = (vm.reportModel?.riskAxes?.products || []).slice(0, 3).map(risk => {
    const level = reportRiskLevelClass(risk.overall);
    return `<div class="risk-card ${escAttr(reportToneClass(level))}" data-p="${risk.row.id}">
      <div class="rk-name">${renderProductThumbSize(risk.row, 'md')}${esc(risk.row.rank)} · ${esc(risk.row.shortName)}</div>
      <div class="rk-level ${escAttr(level)}">${esc(risk.overall || 'Review')}</div>
      <div class="rk-why">${esc(risk.note || 'No detailed risk note returned.')}</div>
    </div>`;
  }).join('');
  return `<section class="section">
    <div class="section-head">
      <div class="section-eyebrow">Risk profile</div>
      <h2 class="section-title">Risk profile</h2>
      <p class="section-deck">Verification, seller, warranty, rebrand, return, and spec risks summarized as product cards.</p>
    </div>
    <div class="risk-summary-row">${cards || '<div class="empty-state"><div class="es-title">No risk findings returned</div></div>'}</div>
  </section>`;
}

function verificationFindingForProduct(vm, row) {
  const audit = vm.reportModel?.verificationAudits?.find(item => item.row.id === row.id);
  if (audit) return {
    entry: audit.entry || {},
    status: audit.status,
    note: audit.note,
    source: row.url,
    tone: audit.tone
  };
  const entry = findJsonProductEntry(vm.verificationJson, row) || {};
  const status = plainCellText(entry.overall_status || entry.status || entry.verification_status || entry.result || entry.listing_status || 'Reviewed');
  const note = plainCellText(entry.key_result || entry.notes || entry.summary || entry.finding || entry.reason || entry.verdict || 'See the verification details for this product.');
  const source = entry.source_url || entry.source || entry.sourceLink || row.url;
  return {
    entry,
    status,
    note,
    source,
    tone: reportTagTone(`${status} ${note}`)
  };
}

function claimRowsForProduct(vm, row, finding) {
  const entry = finding.entry || {};
  const claims = [
    entry.claims,
    entry.claim_audit,
    entry.claimAudit,
    entry.findings,
    entry.checks,
    entry.verifications,
    entry.specs
  ].find(value => Array.isArray(value) && value.length) || [];
  if (claims.length) {
    return claims.slice(0, 12).map(claim => ({
      claim: plainCellText(claim.claim || claim.field || claim.spec || claim.key || claim.title || claim.name || claim),
      status: plainCellText(claim.status || claim.result || claim.verification_status || claim.confidence || finding.status),
      evidence: plainCellText(claim.evidence || claim.source || claim.reason || claim.notes || claim.summary || finding.note)
    }));
  }
  const fallback = [
    { claim: `Brand · ${row.brand}`, status: 'Captured listing fact', evidence: 'Saved product data' },
    { claim: `Model · ${row.model}`, status: row.model && row.model !== '-' ? 'Captured listing fact' : 'Missing', evidence: row.model && row.model !== '-' ? 'Saved product data' : 'Model was not captured.' },
    { claim: `Price · ${row.price}`, status: 'Captured listing fact', evidenceHtml: renderReportSourceLink(row.url, row.source) },
    { claim: `Product title`, status: finding.status, evidence: row.title || finding.note }
  ];
  vm.specKeys.slice(0, 6).forEach(key => {
    const value = specValueForProduct(row.product, key);
    fallback.push({
      claim: key,
      status: value ? 'Listing-only' : 'Missing',
      evidence: value || 'Important spec was not captured in the listing data.'
    });
  });
  return fallback;
}

function renderClaimAuditTable(rows) {
  return `<div class="table-scroll">
    <table class="cmp-table">
      <thead><tr>${sortableHeader('Claim', 'claim')}${sortableHeader('Status', 'status')}${sortableHeader('Evidence', 'evidence')}</tr></thead>
      <tbody>${rows.map(row => `<tr>
        <td>${esc(row.claim || 'Claim')}</td>
        <td><span class="badge ${escAttr(reportBadgeClass(row.status))}">${esc(row.status || 'Reviewed')}</span></td>
        <td>${row.evidenceHtml || esc(row.evidence || 'No evidence note returned.')}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}

function renderAiVerificationTab(vm) {
  const audits = (vm.reportModel?.verificationAudits || []).slice(0, 8);
  const summaryCards = audits.map(audit => {
    const { row } = audit;
    return `<div class="product-verdict" data-tone="${escAttr(audit.tone)}" data-p="${row.id}">
      <span class="pv-tag ${escAttr(audit.tone)}">${esc(audit.status || 'Reviewed')}</span>
      <div class="pv-body">
        ${renderProductVerdictImage(row)}
        <div class="pv-body-info">
          <div class="pv-name"><span class="pv-rank-num">${esc(row.rank)}</span>${esc(row.shortName)}</div>
          <div class="pv-stats">
            <div class="stat"><span class="k">source</span><span class="v">${renderReportSourceLink(row.url, row.source)}</span></div>
          </div>
        </div>
      </div>
      <div class="pv-why">${esc(audit.note)}</div>
    </div>`;
  }).join('');
  const productTabs = audits.map(({ row }) => `<button class="subtab-btn" data-sub="ver-p${row.id}"><span class="sub-num">${esc(row.rank)}</span>${esc(row.shortName)}</button>`).join('');
  const productPanes = audits.map(audit => {
    const { row } = audit;
    const missing = audit.missingSpecs.length
      ? `<section class="section">
        <div class="section-head"><div class="section-eyebrow">Gaps</div><h2 class="section-title">Missing specs</h2></div>
        <div class="notes">${audit.missingSpecs.map(item => `<div class="note warn"><span class="note-label">Missing</span>${esc(item)}</div>`).join('')}</div>
      </section>`
      : '';
    const marketing = audit.marketingClaims.length
      ? `<section class="section">
        <div class="section-head"><div class="section-eyebrow">Inflation check</div><h2 class="section-title">Marketing claims</h2></div>
        <div class="notes">${audit.marketingClaims.map(item => `<div class="note bad"><span class="note-label">Claim</span>${esc(item)}</div>`).join('')}</div>
      </section>`
      : '';
    return `<div class="subtab-pane" data-sub-pane="ver-p${row.id}">
      <section class="section">
        <div class="section-head">
          <div class="section-eyebrow">${esc(row.shortName)}</div>
          <h2 class="section-title">Claim audit</h2>
          <p class="section-deck">${esc(audit.note)}</p>
        </div>
        ${renderClaimAuditTable(audit.claims)}
      </section>
      ${missing}
      ${marketing}
    </div>`;
  }).join('');
  return `<nav class="subtab-bar" aria-label="Verification sub-sections">
    <button class="subtab-btn active" data-sub="ver-summary"><span class="sub-num">·</span>Summary</button>
    ${productTabs}
  </nav>
  <div class="subtab-pane active" data-sub-pane="ver-summary">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Per-product audit</div>
        <h2 class="section-title">Verification summary</h2>
        <p class="section-deck">Each listing's claims are classified as verified, listing-only, missing, contradictory, or suspicious.</p>
      </div>
      <div class="verdict-row">${summaryCards || '<div class="empty-state"><div class="es-title">No verification products</div><div class="es-body">This run did not include product rows.</div></div>'}</div>
      ${renderReportAssessment(vm.verificationNotes)}
    </section>
  </div>
  ${productPanes}`;
}

function renderAiSpecsTab(vm) {
  const correctionModel = vm.reportModel?.specCorrections || { rows: [], summary: [] };
  const correctionRows = correctionModel.rows.map(item => {
    const status = item.status || 'AI finding';
    const source = item.source || '';
    return `<tr>
      <td class="col-id">${esc(item.id)}</td>
      <td>${esc(item.field || 'Spec')}</td>
      <td>${item.original ? `<del>${esc(item.original)}</del>` : '<span class="empty">not captured</span>'}</td>
      <td>${item.corrected ? `<ins>${esc(item.corrected)}</ins>` : '<span class="empty">unverified</span>'}</td>
      <td><span class="badge ${escAttr(reportBadgeClass(status))}">${esc(status)}</span></td>
      <td>${source ? renderReportSourceLink(source, reportSourceNameFromUrl(source)) : '<span class="empty">not stated</span>'}</td>
    </tr>`;
  }).join('');
  const missing = [
    vm.enrichmentJson?.missing_important_specs,
    vm.enrichmentJson?.missingImportantSpecs,
    vm.comparisonJson?.missing_attributes,
    vm.comparisonJson?.missingAttributes,
    vm.comparisonJson?.missingImportantSpecs
  ].find(value => Array.isArray(value) && value.length) || [];
  const summaryCards = correctionModel.summary.map(({ row, status, tone, reason }) => {
    return `<div class="product-verdict" data-tone="${escAttr(tone)}" data-p="${row.id}">
      <span class="pv-tag ${escAttr(tone)}">${esc(status)}</span>
      <div class="pv-body">
        ${renderProductVerdictImage(row)}
        <div class="pv-body-info"><div class="pv-name"><span class="pv-rank-num">${esc(row.rank)}</span>${esc(row.shortName)}</div></div>
      </div>
      <div class="pv-why">${esc(reason)}</div>
    </div>`;
  }).join('');
  const missingNotes = missing.length
    ? `<div class="notes">${missing.slice(0, 12).map(item => `<div class="note warn"><span class="note-label">Missing</span>${esc(plainCellText(item))}</div>`).join('')}</div>`
    : '<div class="empty-state"><div class="es-icon">✓</div><div class="es-title">No missing-spec list returned</div><div class="es-body">The AI run did not provide a separate missing-important-specs list.</div></div>';

  return `<nav class="subtab-bar" aria-label="Specs sub-sections">
    <button class="subtab-btn active" data-sub="spec-summary"><span class="sub-num">·</span>Summary</button>
    <button class="subtab-btn" data-sub="spec-corrections"><span class="sub-num">01</span>Corrections</button>
    <button class="subtab-btn" data-sub="spec-missing"><span class="sub-num">02</span>Missing specs</button>
  </nav>
  <div class="subtab-pane active" data-sub-pane="spec-summary">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Per-product status</div>
        <h2 class="section-title">Corrections summary</h2>
      <p class="section-deck">Original listing values remain visible when corrected; unreliable claims are kept separate from confirmed specs.</p>
      </div>
      <div class="verdict-row">${summaryCards || '<div class="empty-state"><div class="es-title">No products available</div></div>'}</div>
    </section>
  </div>
  <div class="subtab-pane" data-sub-pane="spec-corrections">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Field-by-field</div>
        <h2 class="section-title">Correction table</h2>
        <p class="section-deck">Struck values are the original listing values; inserted values are corrected or verified values from the AI audit.</p>
      </div>
      <div class="table-scroll">
        <table class="cmp-table">
          <thead><tr><th class="col-id-h">#</th>${sortableHeader('Spec', 'spec')}${sortableHeader('Original', 'original')}${sortableHeader('Corrected', 'corrected')}${sortableHeader('Status', 'status')}${sortableHeader('Source', 'source')}</tr></thead>
          <tbody>${correctionRows || '<tr><td colspan="6">No corrected values were found in this AI run.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  </div>
  <div class="subtab-pane" data-sub-pane="spec-missing">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Gaps</div>
        <h2 class="section-title">Missing important specs</h2>
        <p class="section-deck">These are category-relevant specs that should exist before a confident purchase decision.</p>
      </div>
      ${missingNotes}
    </section>
  </div>`;
}

function buildRiskRows(vm) {
  const risks = [
    vm.comparisonJson?.risks,
    vm.comparisonJson?.risk_summary,
    vm.comparisonJson?.riskSummary,
    vm.verificationJson?.risks
  ].find(Array.isArray);
  if (risks?.length) {
    return risks.slice(0, 12).map((risk, index) => ({
      rank: String(index + 1).padStart(2, '0'),
      title: plainCellText(risk.product || risk.product_name || risk.name || risk.axis || risk.type || 'Risk'),
      level: plainCellText(risk.level || risk.severity || risk.status || 'Review'),
      note: plainCellText(risk.reason || risk.summary || risk.description || risk.finding || risk)
    }));
  }
  return vm.products.map(row => ({
    rank: row.rank,
    title: row.shortName,
    level: row.source && /amazon|best buy|target|walmart|costco/i.test(row.source) ? 'Marketplace review' : 'Seller review',
    note: `${row.seller !== '-' ? row.seller : 'Seller'} · ${row.source || 'Unknown source'}`
  }));
}

function renderAiRisksTab(vm) {
  const risks = vm.reportModel?.riskAxes?.products || [];
  const sellerReliability = vm.reportModel?.sellerReliability || [];
  const cards = risks.map(({ row, overall, note }) => {
    const level = reportRiskLevelClass(overall);
    return `<div class="risk-card ${escAttr(reportToneClass(level))}" data-p="${row.id}">
      <div class="rk-name">${renderProductThumbSize(row, 'md')}${esc(row.rank)} · ${esc(row.shortName)}</div>
      <span class="rk-level ${escAttr(level)}">${esc(overall || 'Review')}</span>
      <div class="rk-why">${esc(note || 'No detailed risk note returned.')}</div>
    </div>`;
  }).join('');
  const axisCell = value => {
    const level = reportRiskLevelClass(value);
    const cls = level === 'high' ? 'risk-cell-high' : level === 'low' ? 'risk-cell-low' : 'risk-cell-medium';
    return `<div class="${cls}">${esc(value || 'Review')}</div>`;
  };
  const heatRows = risks.map(({ row, spec, seller, warranty, rebrand, returns, overall }) => `<div class="risk-row" data-p="${row.id}">
    <div>${renderProductThumbSize(row, 'sm')}${esc(row.rank)} · ${esc(row.shortName)}</div>
    ${axisCell(spec)}
    ${axisCell(seller)}
    ${axisCell(warranty)}
    ${axisCell(rebrand)}
    ${axisCell(returns)}
    ${axisCell(overall)}
  </div>`).join('');
  const axisNotes = (vm.reportModel?.riskAxes?.axisNotes || []).length
    ? vm.reportModel.riskAxes.axisNotes
    : [
      'Spec risk: review listing-only and unverifiable claims before purchase.',
      'Seller risk: compare seller identity, marketplace role, warranty, and return path.',
      'Warranty risk: look for official warranty pages or manufacturer support.'
    ];
  const sellerRows = sellerReliability.map(({ row, signal, assessment }) => `<tr data-p="${row.id}">
    <td class="col-id">${esc(row.rank)}</td>
    <td>${esc(row.seller || '-')}</td>
    <td>${esc(signal)}</td>
    <td><span class="badge ${escAttr(reportBadgeClass(assessment))}">${esc(assessment || 'Review')}</span></td>
  </tr>`).join('');
  return `<nav class="subtab-bar" aria-label="Risks sub-sections">
    <button class="subtab-btn active" data-sub="risk-verdict"><span class="sub-num">·</span>Verdict</button>
    <button class="subtab-btn" data-sub="risk-heatmap"><span class="sub-num">01</span>Heat map</button>
    <button class="subtab-btn" data-sub="risk-axes"><span class="sub-num">02</span>By axis</button>
    <button class="subtab-btn" data-sub="risk-sellers"><span class="sub-num">03</span>Sellers</button>
  </nav>
  <div class="subtab-pane active" data-sub-pane="risk-verdict">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Aggregated risk</div>
        <h2 class="section-title">Risk verdict per product</h2>
        <p class="section-deck">Final risk level after spec, seller, warranty, rebrand, and return assessment.</p>
      </div>
      <div class="risk-summary-row">${cards || '<div class="empty-state"><div class="es-title">No risk findings returned</div></div>'}</div>
      ${renderReportAssessment(vm.riskNotes)}
    </section>
  </div>
  <div class="subtab-pane" data-sub-pane="risk-heatmap">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Risk axes</div>
        <h2 class="section-title">Risk heat map</h2>
        <p class="section-deck">Spec, seller, warranty, rebrand, and return risk graded side by side.</p>
      </div>
      <div class="risk-grid">
        <div class="risk-row head"><div>Product</div><div>Spec</div><div>Seller</div><div>Warranty</div><div>Rebrand</div><div>Return</div><div>Overall</div></div>
        ${heatRows}
      </div>
    </section>
  </div>
  <div class="subtab-pane" data-sub-pane="risk-axes">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Axis notes</div>
        <h2 class="section-title">Risk by type</h2>
      </div>
      <div class="notes">${axisNotes.map(note => {
        const [label, ...rest] = String(note).split(':');
        const body = rest.length ? rest.join(':').trim() : note;
        return `<div class="note ${escAttr(reportBadgeClass(note))}"><span class="note-label">${esc(rest.length ? label.trim() : 'Risk')}</span>${esc(body)}</div>`;
      }).join('')}</div>
    </section>
  </div>
  <div class="subtab-pane" data-sub-pane="risk-sellers">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Storefront signal</div>
        <h2 class="section-title">Store reliability</h2>
      </div>
      <div class="table-scroll">
        <table class="cmp-table">
          <thead><tr><th class="col-id-h">#</th>${sortableHeader('Seller', 'seller')}${sortableHeader('Signal', 'signal')}${sortableHeader('Assessment', 'assessment')}</tr></thead>
          <tbody>${sellerRows || '<tr><td colspan="4">No seller rows available.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

function renderAiSecondOpinionTab(vm) {
  if (!vm.stages.secondOpinion) {
    return `<div class="empty-state">
      <div class="es-icon">⊘</div>
      <div class="es-title">No second opinion in this run</div>
      <div class="es-body">This analysis run did not include a second-opinion cross-check stage. Re-run with the Second Opinion stage enabled to compare two providers side by side.</div>
    </div>`;
  }
  return `<section class="section">
    <div class="section-head">
      <div class="section-eyebrow">Cross-check</div>
      <h2 class="section-title">Second opinion</h2>
      <p class="section-deck">A separate provider response used to confirm, challenge, or add to the first analysis.</p>
    </div>
    ${readableStageHtml(vm.stages.secondOpinion, 'The second opinion stage completed, but did not return a readable narrative.')}
  </section>`;
}

function categoryLeafLabel(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const parts = text.split(/\s*>\s*/).map(part => part.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : text;
}

function buildAiResultsViewModel(run, products = []) {
  const stages = Object.fromEntries((run?.stages || []).map(stage => [stage.stage, stage]));
  const comparisonJson = normalizeReportJson(stageParsedJson(stages.comparison));
  const verificationJson = normalizeReportJson(stageParsedJson(stages.verification));
  const enrichmentJson = normalizeReportJson(stageParsedJson(stages.enrichment));
  const rows = reportProductRows(products);
  const completedStages = (run?.stages || []).filter(stage => stage.status === 'completed').length;
  const categoryProduct = (comparisonJson.products || []).find(item => item?.category || item?.subcategory) || {};
  const category = comparisonJson.category || comparisonJson.subcategory || categoryProduct.category || categoryProduct.subcategory || rows.find(row => row.category)?.category || (products[0] ? (CATEGORY_RUBRICS[inferCategory(products[0])]?.label || '') : '');
  const displayCategory = categoryLeafLabel(category);
  const selectedChecks = globalThis.ShopScoutAI?.selectedOptionLabels
    ? ShopScoutAI.selectedOptionLabels(run?.analysisOptions || {})
    : [];
  const productText = rows.length
    ? `${Array.isArray(run?.productIndexes) && run.productIndexes.length ? run.productIndexes.map(index => Number(index) + 1).join(', ') : 'All products'} (${rows.length})`
    : 'No products';
  const corrections = globalThis.ShopScoutAIUI?.extractCorrections
    ? ShopScoutAIUI.extractCorrections({ stages: run?.stages || [] })
    : [];
  const specKeys = buildReportSpecKeys(products, comparisonJson);
  const reportModel = buildAiTemplateReportModel({
    products: rows,
    comparisonJson,
    verificationJson,
    enrichmentJson,
    corrections,
    specKeys
  });
  const finalRecommendation = comparisonJson.final_recommendation || comparisonJson.finalRecommendation || comparisonJson.recommendation || {};
  const nonEmptyArray = (...values) => values.find(value => Array.isArray(value) && value.length) || [];
  const completedStageLabels = (run?.stages || []).filter(stage => stage.status === 'completed').map(stage => aiStageLabel(stage.stage));
  const completedAt = run?.completedAt ? new Date(run.completedAt).toLocaleString() : 'Latest saved run';
  const shortRunId = String(run?.id || 'latest-run').replace(/^run-/, '').slice(0, 8);
  const failedStages = (run?.stages || []).filter(stage => stage.status === 'failed');
  const skippedStages = (run?.stages || []).filter(stage => stage.status === 'skipped');
  const incomplete = isAiRunIncomplete(run);

  return {
    run: run || {},
    stages,
    comparisonJson,
    verificationJson,
    enrichmentJson,
    products: rows,
    completedStages,
    failedStages,
    skippedStages,
    incomplete,
    category,
    displayCategory,
    productText,
    selectedChecks,
    specKeys,
    corrections,
    reportModel,
    completedStageLabels,
    completedAt,
    shortRunId,
    verdictNotes: nonEmptyArray(
      finalRecommendation.reasons,
      finalRecommendation.reasoning,
      comparisonJson.summaryBullets,
      comparisonJson.summary_bullets,
      comparisonJson.key_findings,
      comparisonJson.findings,
      comparisonJson.recommendations
    ),
    comparisonNotes: nonEmptyArray(
      comparisonJson.summaryBullets,
      comparisonJson.summary_bullets,
      comparisonJson.key_findings,
      comparisonJson.findings,
      comparisonJson.recommendations
    ),
    verificationNotes: nonEmptyArray(
      verificationJson.summaryBullets,
      verificationJson.summary_bullets,
      verificationJson.key_findings,
      verificationJson.findings,
      verificationJson.recommendations
    ),
    riskNotes: nonEmptyArray(
      comparisonJson.riskNotes,
      comparisonJson.risk_notes,
      comparisonJson.risk_summary,
      comparisonJson.riskSummary,
      verificationJson.riskNotes,
      verificationJson.risks
    ),
    title: displayCategory || run?.listName || 'AI Analysis Results',
    subtitle: selectedChecks.length
      ? selectedChecks.join(', ')
      : `${rows.length} product${rows.length === 1 ? '' : 's'} analyzed`
  };
}

function isAiRunIncomplete(run) {
  if (!run) return false;
  if (['partial', 'failed'].includes(String(run.status || '').toLowerCase())) return true;
  return (run.stages || []).some(stage => stage.status === 'failed');
}

function renderRedesignedAiResultsPage(vm) {
  const stageText = vm.completedStageLabels.length ? vm.completedStageLabels.join(' · ') : 'No completed stages';
  const incompleteWarning = vm.incomplete
    ? `<div class="ai-results-warning">
        <strong>AI analysis did not complete.</strong>
        <span>Showing the ${esc(String(vm.completedStages))} completed stage${vm.completedStages === 1 ? '' : 's'} saved before the run stopped${vm.failedStages.length ? `; ${esc(String(vm.failedStages.length))} stage${vm.failedStages.length === 1 ? '' : 's'} failed` : ''}.</span>
      </div>`
    : '';
  const secondOpinionTab = vm.stages.secondOpinion
    ? `<button class="tab-btn" data-ai-results-tab="second" data-tab="second"><span class="tab-num">06</span>Second opinion</button>`
    : '';
  const secondOpinionPane = vm.stages.secondOpinion
    ? `<div class="tab-pane" data-ai-results-pane="second" data-pane="second">${renderAiSecondOpinionTab(vm)}</div>`
    : '';
  return `<div id="aiResultsTabs" class="page ai-results-page-inner">
    <section class="report-head">
      <div class="eyebrow"><span class="dot"></span>${esc(vm.run.listName || 'ShopScout AI analysis')}</div>
      <h1 class="report-title">${esc(vm.title)}</h1>
      <p class="report-sub">${esc(vm.subtitle)}</p>
      <div class="meta-bottom">
        <span><span class="mb-label">Completed</span>${esc(vm.completedAt)}</span>
        <span class="mb-sep">•</span>
        <span><span class="mb-label">Products</span>${esc(vm.productText)}</span>
        <span class="mb-sep">•</span>
        <span><span class="mb-label">Stages</span>${esc(stageText)}</span>
        <span class="mb-sep">•</span>
        <span><span class="mb-label">Run</span>${esc(vm.shortRunId)}</span>
      </div>
    </section>
    ${incompleteWarning}
    <nav class="tab-bar" aria-label="AI analysis results">
      <button class="tab-btn active" data-ai-results-tab="verdict" data-tab="verdict"><span class="tab-num">01</span>Verdict</button>
      <button class="tab-btn" data-ai-results-tab="compare" data-tab="compare"><span class="tab-num">02</span>Compare</button>
      <button class="tab-btn" data-ai-results-tab="verification" data-tab="verification"><span class="tab-num">03</span>Verification</button>
      <button class="tab-btn" data-ai-results-tab="specs" data-tab="specs"><span class="tab-num">04</span>Specs &amp; corrections</button>
      <button class="tab-btn" data-ai-results-tab="risks" data-tab="risks"><span class="tab-num">05</span>Risks</button>
      ${secondOpinionTab}
    </nav>
    <div class="tab-pane active" data-ai-results-pane="verdict" data-pane="verdict">${renderAiVerdictTab(vm)}</div>
    <div class="tab-pane" data-ai-results-pane="compare" data-pane="compare">${renderAiCompareTab(vm)}</div>
    <div class="tab-pane" data-ai-results-pane="verification" data-pane="verification">${renderAiVerificationTab(vm)}</div>
    <div class="tab-pane" data-ai-results-pane="specs" data-pane="specs">${renderAiSpecsTab(vm)}</div>
    <div class="tab-pane" data-ai-results-pane="risks" data-pane="risks">${renderAiRisksTab(vm)}</div>
    ${secondOpinionPane}
    <footer class="report-foot">
      <div class="meta-bottom">
        <span><span class="mb-label">Completed</span>${esc(vm.completedAt)}</span>
        <span class="mb-sep">•</span>
        <span><span class="mb-label">Stages</span>${esc(stageText)}</span>
        <span class="mb-sep">•</span>
        <span><span class="mb-label">Status</span>${esc(stageStatusText(vm.run.status))}</span>
        <span class="mb-sep">•</span>
        <span><span class="mb-label">Run</span>${esc(vm.shortRunId)}</span>
      </div>
    </footer>
  </div>`;
}

function bindAiResultsTabs() {
  const tabs = document.getElementById('aiResultsTabs');
  if (!tabs) return;
  tabs.addEventListener('click', e => {
    const sortHeader = e.target.closest('th.sortable');
    if (sortHeader && tabs.contains(sortHeader)) {
      sortComparisonTable(sortHeader.closest('table'), sortHeader);
      return;
    }
    const tab = e.target.closest('.tab-btn[data-ai-results-tab], .tab-btn[data-tab]');
    if (tab) {
      const target = tab.dataset.aiResultsTab || tab.dataset.tab;
      tabs.querySelectorAll('.tab-btn[data-ai-results-tab], .tab-btn[data-tab]').forEach(btn => btn.classList.toggle('active', btn === tab));
      tabs.querySelectorAll('.tab-pane[data-ai-results-pane], .tab-pane[data-pane]').forEach(pane => pane.classList.toggle('active', (pane.dataset.aiResultsPane || pane.dataset.pane) === target));
      return;
    }
    const subtab = e.target.closest('.subtab-btn[data-sub]');
    if (!subtab) return;
    const panel = subtab.closest('.tab-pane');
    subtab.closest('.subtab-bar')?.querySelectorAll('.subtab-btn').forEach(btn => btn.classList.toggle('active', btn === subtab));
    panel?.querySelectorAll('.subtab-pane[data-sub-pane]').forEach(pane => pane.classList.toggle('active', pane.dataset.subPane === subtab.dataset.sub));
  });
}

function sortableCellValue(td) {
  if (!td) return { num: null, text: '' };
  const text = (td.textContent || '').trim();
  const numMatch = text.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (numMatch && /\d/.test(text)) return { num: parseFloat(numMatch[0]), text: text.toLowerCase() };
  return { num: null, text: text.toLowerCase() };
}

function sortComparisonTable(table, header) {
  if (!table || !header || !table.tBodies?.[0]) return;
  const headRow = header.parentElement;
  const colIndex = Array.from(headRow?.cells || []).indexOf(header);
  if (colIndex < 0) return;
  const next = header.getAttribute('data-dir') === 'asc' ? 'desc' : 'asc';
  Array.from(headRow.cells).forEach(cell => cell.removeAttribute('data-dir'));
  header.setAttribute('data-dir', next);
  const multiplier = next === 'asc' ? 1 : -1;
  const rows = Array.from(table.tBodies[0].rows);
  rows.sort((a, b) => {
    const av = sortableCellValue(a.cells[colIndex]);
    const bv = sortableCellValue(b.cells[colIndex]);
    if (!av.text && bv.text) return 1;
    if (av.text && !bv.text) return -1;
    if (av.num !== null && bv.num !== null) return (av.num - bv.num) * multiplier;
    return av.text.localeCompare(bv.text) * multiplier;
  });
  rows.forEach(row => table.tBodies[0].appendChild(row));
}

function renderAiResultsPage(run, products = []) {
  const page = document.getElementById('aiResultsPage');
  const subtitle = document.getElementById('aiResultsSubtitle');
  const body = document.getElementById('aiResultsBody');
  if (!page || !body || !run) return;
  if (subtitle) subtitle.textContent = `${run.listName || 'Current list'} · ${run.completedAt ? new Date(run.completedAt).toLocaleString() : 'Latest saved AI run'}`;
  const vm = buildAiResultsViewModel(run, products);
  body.innerHTML = renderRedesignedAiResultsPage(vm);
  bindAiResultsTabs();
  showAiResultsPage();
}

function showAiResultsPage() {
  closeSettingsPage(false);
  document.getElementById('productDetail')?.classList.remove('active');
  if (document.getElementById('productDetail')) document.getElementById('productDetail').style.display = 'none';
  document.querySelector('.ribbon-shell').style.display = '';
  document.getElementById('urlBar').style.display = 'none';
  document.getElementById('filterBar').style.display = 'none';
  document.querySelector('.controls').style.display = 'none';
  document.getElementById('content').style.display = 'none';
  document.getElementById('aiResultsPage')?.classList.add('active');
  window.scrollTo(0, 0);
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
async function copyUrls() {
  const products = await getProducts();
  if (!products.length) { toast.show('No products', 'error'); return; }
  await navigator.clipboard.writeText(products.map(p => p.url).filter(Boolean).join('\n'));
  toast.show('URLs copied');
}

// --- Remove ---
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
    container.innerHTML = '<div class="spec-empty">No specifications captured. Click "+ Add Spec" to add one.</div>';
    return;
  }
  container.innerHTML = specs.map((s, i) =>
    `<div class="spec-row" data-si="${i}">
      <input class="spec-key" value="${esc(s.key)}" placeholder="Key" data-field="key">
      <input class="spec-val" value="${esc(s.value)}" placeholder="Value" data-field="value">
      <button class="spec-del" title="Remove">&times;</button>
    </div>`
  ).join('');
}

function addSpecRow() {
  const container = document.getElementById('editSpecTable');
  const empty = container.querySelector('.spec-empty');
  if (empty) empty.remove();
  const idx = container.querySelectorAll('.spec-row').length;
  const row = document.createElement('div');
  row.className = 'spec-row';
  row.dataset.si = idx;
  row.innerHTML = `<input class="spec-key" value="" placeholder="Key" data-field="key">
    <input class="spec-val" value="" placeholder="Value" data-field="value">
    <button class="spec-del" title="Remove">&times;</button>`;
  container.appendChild(row);
  row.querySelector('.spec-key').focus();
}

function updateImagePreview() {
  const url = document.getElementById('editImage').value.trim();
  const container = document.getElementById('editImagePreview');
  const safeUrl = sanitizeUrl(url);
  container.innerHTML = safeUrl ? `<img src="${escAttr(safeUrl)}" alt="Preview" data-hide-on-error="1">` : '';
}

function renderImageGallery(urls) {
  const container = document.getElementById('editImageGallery');
  const safeUrls = urls.map(u => sanitizeUrl(u)).filter(Boolean);
  if (!safeUrls.length) { container.innerHTML = '<span style="font-size:12px;color:var(--muted)">No additional images</span>'; return; }
  container.innerHTML = safeUrls.map(u =>
    `<div class="img-gallery-item">
      <img src="${escAttr(u)}" alt="" title="${escAttr(u)}" data-hide-parent-on-error="1">
      <button class="img-del" data-url="${escAttr(u)}" title="Remove">&times;</button>
    </div>`
  ).join('');
}

function renderReviewImages(urls) {
  const container = document.getElementById('editReviewImages');
  const safeUrls = urls.map(u => sanitizeUrl(u)).filter(Boolean);
  if (!safeUrls.length) { container.innerHTML = '<span style="font-size:12px;color:var(--muted)">No review photos found</span>'; return; }
  container.innerHTML = safeUrls.map(u =>
    `<div class="img-gallery-item">
      <img src="${escAttr(u)}" alt="" title="${escAttr(u)}" data-hide-parent-on-error="1">
    </div>`
  ).join('');
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
let detailIndex = -1;

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
  select.innerHTML = options.map(option => `<option value="${escAttr(option.id)}">${esc(option.label)}</option>`).join('');
  select.value = options.some(option => option.id === current) ? current : 'auto';
}

/* Lookup helper used by comparison-db.js (Tabulator row click) — open the
   detail page for a product by its IndexedDB id, not by its position in the
   current legacy list ordering. */
/* Match by id when present, fall back to URL for legacy chrome.storage products
   that pre-date the id-on-save migration. */
function findLegacyProductIndex(products, idOrItem) {
  const it = (idOrItem && typeof idOrItem === 'object') ? idOrItem : { id: idOrItem };
  return products.findIndex(p => p && (
    (it.id  && (p.id === it.id || p.id === String(it.id))) ||
    (it.url && p.url === it.url)
  ));
}

globalThis.openProductDetailById = async function openProductDetailById(idOrItem) {
  const products = await getProducts();
  const idx = findLegacyProductIndex(products, idOrItem);
  if (idx >= 0) return openProductDetail(idx);
};

/* Rescan a single product by IndexedDB id — bridge from Tabulator row actions
   to the legacy single-product rescan flow. */
globalThis.rescanProductById = async function rescanProductById(idOrItem) {
  const products = await getProducts();
  const idx = findLegacyProductIndex(products, idOrItem);
  if (idx >= 0) return rescanList([idx]);
};

/* Sync the legacy selectedProductIds Set from Tabulator's row selection. Called
   by comparison-db.js after the user toggles row checkboxes so that the
   existing "Rescan Selected" / "Delete Selected" buttons see a populated set. */
globalThis.setSelectedProductsFromIds = async function setSelectedProductsFromIds(items) {
  selectedProductIds.clear();
  const products = await getProducts();
  /* Accept three shapes for backwards compatibility:
       - {id, url} object pairs (preferred)
       - plain id strings
       - undefined / null entries (skipped) */
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

  content.innerHTML = `${productHeaderHtml}${buildDetailTabsHtml([
    { id: 'general', label: 'General', html: overviewHtml },
    { id: 'pricing', label: 'Pricing & Seller', html: pricingHtml },
    { id: 'identifiers', label: 'Identifiers', html: identifiersHtml },
    { id: 'specs', label: 'Specs & Features', html: specsFeaturesHtml },
    { id: 'media', label: 'Media', html: imagesHtml },
    { id: 'verification', label: 'Verification', html: renderVerificationHtml(p) },
    { id: 'risks', label: 'Risks & Comparison', html: renderRisksComparisonHtml(p) }
  ])}`;

  document.querySelector('.ribbon-shell').style.display = '';
  document.querySelector('.url-bar')?.style && (document.getElementById('urlBar').style.display = 'none');
  document.getElementById('filterBar').style.display = 'none';
  document.querySelector('.controls').style.display = 'none';
  document.getElementById('content').innerHTML = '';
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
            gallery.innerHTML = reviewHtml;
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

    resultsDiv.innerHTML = html;
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

  resultsDiv.innerHTML = `<div class="rescan-progress">
    <div class="spinner"></div>
    <div class="progress-text" id="rescanProgressText">Preparing to scan...</div>
    <div class="progress-bar"><div class="progress-fill" id="rescanProgressFill" style="width:0%"></div></div>
    <button class="tb tb--danger" id="rescanCancelBtn" style="margin-top:12px">Cancel Rescan</button>
  </div>`;

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

  document.getElementById('rescanResults').innerHTML = html;

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
