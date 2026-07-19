var chrome = globalThis.browser || globalThis.chrome;

const { getData, saveData, getProducts, saveProducts, esc, escAttr, sanitizeUrl, parsePrice, toast } = SS;

let editIndex = -1;
let listModalMode = 'new';

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

document.addEventListener('DOMContentLoaded', init);

async function init() {
  if (typeof SS.bootstrapDataLayer === 'function') await SS.bootstrapDataLayer();
  await renderListSelector();
  await renderProducts();
  bindEvents();
}

// --- List management ---
async function renderListSelector() {
  const data = await getData();
  const sel = document.getElementById('listSelect');
  setTrustedHtml(sel, Object.keys(data.lists).map(n => `<option value="${esc(n)}"${n === data.activeList ? ' selected' : ''}>${esc(n)}</option>`).join(''));
}

async function switchList(name) {
  const data = await getData();
  if (data.lists[name]) { data.activeList = name; await saveData(data); }
  await renderProducts();
}

// --- Render products ---
async function renderProducts() {
  const data = await getData();
  let products = data.lists[data.activeList] || [];
  document.getElementById('count').textContent = products.length;

  const sources = [...new Set(products.map(p => p.source).filter(Boolean))];
  const filterSel = document.getElementById('filterSource');
  const curFilter = filterSel.value;
  setTrustedHtml(filterSel, '<option value="">All Sources</option>' + sources.map(s => `<option value="${esc(s)}"${s === curFilter ? ' selected' : ''}>${esc(s)}</option>`).join(''));

  if (curFilter) products = products.filter(p => p.source === curFilter);

  const sort = document.getElementById('sortBy').value;
  if (sort === 'price-asc') products.sort((a, b) => parsePrice(a.newPrice) - parsePrice(b.newPrice));
  else if (sort === 'price-desc') products.sort((a, b) => parsePrice(b.newPrice) - parsePrice(a.newPrice));
  else if (sort === 'rating') products.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
  else if (sort === 'source') products.sort((a, b) => (a.source || '').localeCompare(b.source || ''));

  const container = document.getElementById('productList');
  if (!products.length) {
    setTrustedHtml(container, `<div class="empty"><div class="icon">&#128722;</div><p>No products yet.<br>Visit a product page and click <strong>Add Current Product</strong>.</p></div>`);
    return;
  }

  setTrustedHtml(container, products.map(p => {
    const idx = (data.lists[data.activeList] || []).indexOf(p);
    const imageUrl = sanitizeUrl(p.image);
    const productUrl = sanitizeUrl(p.url);
    const img = imageUrl ? `<img src="${escAttr(imageUrl)}" alt="">` : `<img src="" style="display:none">`;
    let meta = '';
    if (p.newPrice) meta += `<span class="price">${esc(p.newPrice)}</span>`;
    if (p.usedPrice) meta += `<span class="used-price">${esc(p.usedPrice)}</span>`;
    if (p.source) meta += `<span class="source-badge">${esc(p.source)}</span>`;
    if (p.rating) meta += `<span class="rating">&#9733; ${esc(p.rating)}</span>`;
    if (p.brand) meta += `<span>${esc(p.brand)}</span>`;
    const notes = p.notes ? `<div class="product-notes">${esc(p.notes)}</div>` : '';
    return `<div class="product-card" data-idx="${idx}">
      ${img}
      <div class="product-info">
        <div class="product-title">${esc(p.title || 'Untitled')}</div>
        <div class="product-meta">${meta}</div>
        ${notes}
      </div>
      <div class="card-actions">
        <button class="edit-btn" data-idx="${idx}" title="Edit">&#9998;</button>
        <button class="open-btn" data-url="${escAttr(productUrl)}" title="Open">&#8599;</button>
        <button class="remove-btn" data-idx="${idx}" title="Remove">&times;</button>
      </div>
    </div>`;
  }).join(''));
}

// --- Events ---
function bindEvents() {
  document.getElementById('listSelect').addEventListener('change', e => switchList(e.target.value));
  document.getElementById('newListBtn').addEventListener('click', () => openListModal('new'));
  document.getElementById('renameListBtn').addEventListener('click', () => openListModal('rename'));
  document.getElementById('deleteListBtn').addEventListener('click', deleteList);
  document.getElementById('dashboardBtn').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('comparison.html') }));

  document.getElementById('addBtn').addEventListener('click', addFromTab);
  document.getElementById('addWindowBtn').addEventListener('click', addFromWindow);
  document.getElementById('urlSubmitBtn').addEventListener('click', addByUrl);
  document.getElementById('urlInput').addEventListener('keydown', e => { if (e.key === 'Enter') addByUrl(); });

  document.getElementById('filterSource').addEventListener('change', renderProducts);
  document.getElementById('sortBy').addEventListener('change', renderProducts);

  document.getElementById('productList').addEventListener('click', async e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.classList.contains('edit-btn')) openEditModal(parseInt(btn.dataset.idx));
    else if (btn.classList.contains('remove-btn')) { await removeProduct(parseInt(btn.dataset.idx)); }
    else if (btn.classList.contains('open-btn') && btn.dataset.url) {
      const url = sanitizeUrl(btn.dataset.url);
      if (url) chrome.tabs.create({ url });
    }
  });

  document.getElementById('editSave').addEventListener('click', saveEdit);
  document.getElementById('editCancel').addEventListener('click', () => document.getElementById('editModal').classList.remove('active'));
  document.getElementById('editClose').addEventListener('click', () => document.getElementById('editModal').classList.remove('active'));

  document.getElementById('listModalSave').addEventListener('click', saveListModal);
  document.getElementById('listModalCancel').addEventListener('click', () => document.getElementById('listModal').classList.remove('active'));

  for (const ov of document.querySelectorAll('.modal-overlay')) {
    ov.addEventListener('click', e => {
      if (e.target !== ov) return;
      ov.classList.remove('active');
    });
  }
}

// --- Add from current tab ---
async function detectCurrentPageFriction(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const bodyText = (document.body?.innerText || '').toLowerCase();
      const title = (document.title || '').toLowerCase();
      const text = `${title}\n${bodyText}`;
      const patterns = [
        /captcha/, /robot check/, /enter the characters/, /automated access/,
        /sorry, we just need to make sure/, /access denied/, /unusual traffic/,
        /temporarily unavailable/, /sign in to continue/
      ];
      return patterns.some(p => p.test(text));
    }
  });
  return !!result?.[0]?.result;
}

async function extractProductFromCurrentTab(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [
      'security/sanitize.js',
      'utils.js',
      'content/confidenceRules.js',
      'content/domUtils.js',
      'content/keyCanonicalizer.js',
      'content/productSchema.js',
      'content/structuredSignals.js',
      'content/specMiner.js',
      'content/adapters/amazon.js',
      'content/adapters/ebay.js',
      'content/adapters/walmart.js',
      'content/adapters/generic.js',
      'content/marketplace.js',
      'content/extractor.js',
      'content/content.js',
      'content.js'
    ]
  });
  await new Promise(r => setTimeout(r, 500));
  return await chrome.tabs.sendMessage(tabId, { action: 'extract' }) || null;
}

async function addFromTab() {
  const progress = startProgress('Adding product');
  try {
    progress.setTask(1, 5, 'Reading active tab...');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    progress.setTask(2, 5, 'Checking for verification pages...');
    if (await detectCurrentPageFriction(tab.id)) {
      progress.done();
      toast.show('Site verification page detected. Capture stopped.', 'error');
      return;
    }
    progress.setTask(3, 5, 'Parsing product page...');
    const product = await extractProductFromCurrentTab(tab.id);
    if (!product || !product.title) { progress.done(); toast.show('No product found on this page', 'error'); return; }
    product.lastScannedAt = Date.now();
    progress.setTask(4, 5, 'Checking current list...');
    const products = await getProducts();
    const dup = products.find(p => p.url === product.url || (p.source === product.source && p.title === product.title));
    if (dup && dup.newPrice === product.newPrice) { progress.done(); toast.show('Already in your list', 'error'); return; }
    products.push(product);
    progress.setTask(5, 5, 'Saving product...');
    await saveProducts(products);
    toast.show(`Added "${product.title.substring(0, 40)}..."`);
    await renderProducts();
    progress.done();
  } catch (e) { progress.fail('Could not extract product'); progress.done(); toast.show('Could not extract product', 'error'); }
}

async function addFromWindow() {
  const progress = startProgress('Adding products from open tabs');
  const btn = document.getElementById('addWindowBtn');
  btn.disabled = true;
  try {
    progress.setTask(1, 3, 'Scanning open tabs...');
    const result = await chrome.runtime.sendMessage({ action: 'addProductsFromWindow' });
    if (!result?.success) {
      progress.done();
      toast.show(result?.error || 'Window scan failed', 'error');
      return;
    }
    progress.setTask(2, 3, 'Saving captured products...');
    const parts = [`Added ${result.added || 0}`];
    if (result.duplicates) parts.push(`${result.duplicates} duplicate`);
    if (result.noProduct) parts.push(`${result.noProduct} no product`);
    if (result.skipped) parts.push(`${result.skipped} skipped`);
    if (result.failed) parts.push(`${result.failed} failed`);
    toast.show(parts.join(', '));
    progress.setTask(3, 3, 'Refreshing list...');
    await renderProducts();
    progress.done();
  } catch (e) {
    progress.fail('Window scan failed');
    progress.done();
    toast.show('Window scan failed', 'error');
  } finally {
    btn.disabled = false;
  }
}

// --- Add by URL ---
async function addByUrl() {
  const input = document.getElementById('urlInput');
  const url = input.value.trim();
  if (!url) return;
  const progress = startProgress('Adding product from URL');
  try {
    progress.setTask(1, 3, 'Fetching product page...');
    const result = await chrome.runtime.sendMessage({ action: 'addByUrl', url });
    if (result?.success) {
      progress.setTask(2, 3, 'Saving product...');
      toast.show(`Added from ${result.product?.source || 'URL'}`);
      input.value = '';
      progress.setTask(3, 3, 'Refreshing list...');
      await renderProducts();
      progress.done();
    } else { progress.done(); toast.show(result?.error || 'Failed', 'error'); }
  } catch (e) { progress.fail('Failed to fetch'); progress.done(); toast.show('Failed to fetch', 'error'); }
}

// --- Remove product ---
async function removeProduct(idx) {
  const progress = startProgress('Removing product');
  const products = await getProducts();
  if (idx >= 0 && idx < products.length) {
    progress.setTask(1, 3, 'Removing item...');
    products.splice(idx, 1);
    progress.setTask(2, 3, 'Saving list...');
    await saveProducts(products);
    progress.setTask(3, 3, 'Refreshing list...');
    await renderProducts();
    progress.done();
    toast.show('Removed');
  } else {
    progress.done();
  }
}

// --- Edit modal ---
async function openEditModal(idx) {
  const products = await getProducts();
  const p = products[idx];
  if (!p) return;
  editIndex = idx;
  document.getElementById('editTitle').value = p.title || '';
  document.getElementById('editBrand').value = p.brand || '';
  document.getElementById('editNewPrice').value = p.newPrice || '';
  document.getElementById('editUsedPrice').value = p.usedPrice || '';
  document.getElementById('editRating').value = p.rating || '';
  document.getElementById('editReviewCount').value = p.reviewCount || '';
  document.getElementById('editModel').value = p.modelNumber || '';
  document.getElementById('editUrl').value = p.url || '';
  document.getElementById('editNotes').value = p.notes || '';
  document.getElementById('editModal').classList.add('active');
}

async function saveEdit() {
  const products = await getProducts();
  if (editIndex < 0 || editIndex >= products.length) return;
  const p = products[editIndex];
  p.title = document.getElementById('editTitle').value.trim();
  p.brand = document.getElementById('editBrand').value.trim();
  p.newPrice = document.getElementById('editNewPrice').value.trim();
  p.usedPrice = document.getElementById('editUsedPrice').value.trim();
  p.rating = document.getElementById('editRating').value.trim();
  p.reviewCount = document.getElementById('editReviewCount').value.trim();
  p.modelNumber = document.getElementById('editModel').value.trim();
  p.url = document.getElementById('editUrl').value.trim();
  p.notes = document.getElementById('editNotes').value.trim();
  const progress = startProgress('Saving product');
  progress.setTask(1, 2, 'Saving changes...');
  await saveProducts(products);
  document.getElementById('editModal').classList.remove('active');
  toast.show('Product updated');
  progress.setTask(2, 2, 'Refreshing list...');
  await renderProducts();
  progress.done();
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
  const progress = startProgress(listModalMode === 'new' ? 'Creating list' : 'Renaming list');
  const data = await getData();
  if (listModalMode === 'new') {
    if (data.lists[name]) { progress.done(); toast.show('List already exists', 'error'); return; }
    progress.setTask(1, 3, 'Creating list...');
    data.lists[name] = [];
    data.activeList = name;
  } else {
    const old = data.activeList;
    if (name !== old) {
      if (data.lists[name]) { progress.done(); toast.show('Name already taken', 'error'); return; }
      progress.setTask(1, 3, 'Renaming list...');
      data.lists[name] = data.lists[old];
      delete data.lists[old];
      data.activeList = name;
    }
  }
  progress.setTask(2, 3, 'Saving list...');
  await saveData(data);
  document.getElementById('listModal').classList.remove('active');
  progress.setTask(3, 3, 'Refreshing lists...');
  await renderListSelector();
  await renderProducts();
  progress.done();
}

async function deleteList() {
  const data = await getData();
  if (!data.activeList || !data.lists?.[data.activeList]) {
    toast.show('No list selected', 'error');
    return;
  }
  const ok = await ShopScoutUI.confirm(
    `Delete "${data.activeList}" and all its products?`,
    { title: 'Delete list', okLabel: 'Delete', kind: 'danger' }
  );
  if (!ok) return;
  const progress = startProgress('Deleting list');
  progress.setTask(1, 3, 'Deleting list...');
  delete data.lists[data.activeList];
  data.activeList = Object.keys(data.lists)[0] || '';
  progress.setTask(2, 3, 'Saving changes...');
  await saveData(data);
  progress.setTask(3, 3, 'Refreshing lists...');
  await renderListSelector();
  await renderProducts();
  progress.done();
  toast.show('List deleted');
}
