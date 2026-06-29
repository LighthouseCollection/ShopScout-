var chrome = globalThis.browser || globalThis.chrome;

const { getData, saveData, getProducts, saveProducts, esc, escAttr, escXml, sanitizeUrl, parsePrice, buildCsv, safeFilename, downloadFile, buildAIText, buildPrompt, buildExportHtml, parseImport, toast } = SS;

let editIndex = -1;
let listModalMode = 'new';
let pendingAiRunOptions = null;
let popupAiRunInProgress = false;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  if (typeof SS.bootstrapDataLayer === 'function') await SS.bootstrapDataLayer();
  await renderListSelector();
  await renderProducts();
  bindEvents();
  /* When the background service worker writes new products to
     chrome.storage.local (single capture, bulk-tabs scan, add-by-URL,
     rescan), re-mirror them into IndexedDB and refresh the popup
     list. Without this, the bulk-tabs count says "added 26" but the
     popup view stays at the old count until the popup is reopened. */
  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(async (changes, areaName) => {
      if (areaName !== 'local' || !changes.shopscout_data) return;
      try {
        const next = changes.shopscout_data.newValue;
        if (next && SS.mirrorToProductRepo) await SS.mirrorToProductRepo(next);
      } catch (err) { console.warn('Popup live re-mirror failed', err); }
      try { await renderProducts(); }
      catch (err) { console.warn('Popup refresh failed', err); }
    });
  }
}

// --- List management ---
async function renderListSelector() {
  const data = await getData();
  const sel = document.getElementById('listSelect');
  sel.innerHTML = Object.keys(data.lists).map(n => `<option value="${esc(n)}"${n === data.activeList ? ' selected' : ''}>${esc(n)}</option>`).join('');
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
  filterSel.innerHTML = '<option value="">All Sources</option>' + sources.map(s => `<option value="${esc(s)}"${s === curFilter ? ' selected' : ''}>${esc(s)}</option>`).join('');

  if (curFilter) products = products.filter(p => p.source === curFilter);

  const sort = document.getElementById('sortBy').value;
  if (sort === 'price-asc') products.sort((a, b) => parsePrice(a.newPrice) - parsePrice(b.newPrice));
  else if (sort === 'price-desc') products.sort((a, b) => parsePrice(b.newPrice) - parsePrice(a.newPrice));
  else if (sort === 'rating') products.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
  else if (sort === 'source') products.sort((a, b) => (a.source || '').localeCompare(b.source || ''));

  const container = document.getElementById('productList');
  if (!products.length) {
    container.innerHTML = `<div class="empty"><div class="icon">&#128722;</div><p>No products yet.<br>Visit a product page and click <strong>Add Current Product</strong>.</p></div>`;
    return;
  }

  container.innerHTML = products.map((p, i) => {
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
  }).join('');
}

// --- Events ---
function bindEvents() {
  document.getElementById('listSelect').addEventListener('change', e => switchList(e.target.value));
  document.getElementById('newListBtn').addEventListener('click', () => openListModal('new'));
  document.getElementById('renameListBtn').addEventListener('click', () => openListModal('rename'));
  document.getElementById('deleteListBtn').addEventListener('click', deleteList);
  document.getElementById('settingsBtn').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') }));

  document.getElementById('addBtn').addEventListener('click', addFromTab);
  document.getElementById('addWindowBtn').addEventListener('click', addFromWindow);
  document.getElementById('urlSubmitBtn').addEventListener('click', addByUrl);
  document.getElementById('urlInput').addEventListener('keydown', e => { if (e.key === 'Enter') addByUrl(); });

  document.getElementById('integratedAnalyze').addEventListener('click', () => openPopupAiOptionsModal(undefined, 'auto', 'integrated'));
  document.getElementById('manualAnalyze').addEventListener('click', () => openPopupAiOptionsModal(undefined, 'auto', 'manual'));
  document.getElementById('openComparison').addEventListener('click', openComparisonDashboard);
  document.getElementById('exportToggle').addEventListener('click', () => document.getElementById('exiModal').classList.add('active'));

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

  document.getElementById('exiClose').addEventListener('click', () => document.getElementById('exiModal').classList.remove('active'));
  document.getElementById('exportJson').addEventListener('click', () => doExport('json'));
  document.getElementById('exportCsv').addEventListener('click', () => doExport('csv'));
  document.getElementById('exportXml').addEventListener('click', () => doExport('xml'));
  document.getElementById('exportHtml').addEventListener('click', () => doExport('html'));
  document.getElementById('exportPdf').addEventListener('click', () => doExport('pdf'));
  document.getElementById('importBtn').addEventListener('click', doImport);

  document.getElementById('listModalSave').addEventListener('click', saveListModal);
  document.getElementById('listModalCancel').addEventListener('click', () => document.getElementById('listModal').classList.remove('active'));
  bindPopupAiOptionsEvents();

  for (const ov of document.querySelectorAll('.modal-overlay')) {
    ov.addEventListener('click', e => {
      if (e.target !== ov) return;
      if (ov.id === 'aiOptionsModal') closePopupAiOptionsModal();
      else ov.classList.remove('active');
    });
  }
}

function openComparisonDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL('comparison.html') });
}

function popupAiOptionInputs() {
  return [...document.querySelectorAll('#aiOptionsModal [data-ai-option]')];
}

function popupPayloadModeInputs() {
  return [...document.querySelectorAll('#aiOptionsModal [data-payload-mode]')];
}

function collectPromptPayloadOptionsFromModal() {
  const selected = popupPayloadModeInputs().find(input => input.checked);
  const payloadMode = selected?.value || selected?.dataset.payloadMode || 'compact';
  return globalThis.ShopScoutAI?.normalizePromptOptions
    ? ShopScoutAI.normalizePromptOptions({ payloadMode })
    : { payloadMode };
}

function collectAiOptionsFromModal() {
  const options = {};
  for (const input of popupAiOptionInputs()) {
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
  for (const input of popupAiOptionInputs()) {
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
  runBtn.disabled = !count || popupAiRunInProgress;
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

function renderPopupAiProviderSelect(providerId = 'auto') {
  const select = document.getElementById('aiProviderSelect');
  if (!select) return;
  const providers = (globalThis.ShopScoutAI?.PROVIDERS || []).filter(provider => provider.adapter !== 'manual');
  const options = [
    { id: 'auto', label: 'Auto pipeline' },
    ...providers.map(provider => ({ id: provider.id, label: provider.shortName || provider.name }))
  ];
  select.innerHTML = options.map(option => `<option value="${escAttr(option.id)}">${esc(option.label)}</option>`).join('');
  select.value = options.some(option => option.id === providerId) ? providerId : 'auto';
}

async function openPopupAiOptionsModal(productIndexes, providerId = 'auto', runMode = 'integrated') {
  if (runMode === 'integrated' && popupAiRunInProgress) {
    toast.show('AI analysis is already running. Wait for this run to finish before starting another one.', 'error');
    return;
  }
  const products = await getAiOptionsProducts(productIndexes);
  if (!products.length) { toast.show('No products selected for AI analysis', 'error'); return; }
  pendingAiRunOptions = { productIndexes, providerId, runMode };
  renderPopupAiProviderSelect(providerId);
  document.getElementById('aiProviderGroup').style.display = runMode === 'manual' ? 'none' : 'block';
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

function closePopupAiOptionsModal() {
  if (popupAiRunInProgress) return;
  document.getElementById('aiOptionsModal')?.classList.remove('active');
  pendingAiRunOptions = null;
}

function bindPopupAiOptionsEvents() {
  const modal = document.getElementById('aiOptionsModal');
  if (!modal) return;
  popupAiOptionInputs().forEach(input => input.addEventListener('change', updateAiOptionsStatus));
  popupPayloadModeInputs().forEach(input => input.addEventListener('change', updatePromptPayloadEstimate));
  document.getElementById('aiOptionsClose')?.addEventListener('click', closePopupAiOptionsModal);
  document.getElementById('aiOptionsCancel')?.addEventListener('click', closePopupAiOptionsModal);
  document.getElementById('aiOptionsRecommended')?.addEventListener('click', async () => {
    setAiOptionsInModal(await getRecommendedAiOptions(pendingAiRunOptions?.productIndexes));
    await updatePromptPayloadEstimate();
  });
  document.getElementById('aiOptionsAll')?.addEventListener('click', () => {
    const all = {};
    popupAiOptionInputs().forEach(input => { all[input.dataset.aiOption] = true; });
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
    const run = pendingAiRunOptions || {};
    const providerId = document.getElementById('aiProviderSelect')?.value || run.providerId || 'auto';
    if (run.runMode === 'manual') {
      closePopupAiOptionsModal();
      await copyPrompt('deep', options, promptOptions);
      return;
    }
    await runPopupConnectedAI(run.productIndexes, providerId, options, promptOptions);
  });
}

function buildManualPromptPayloadInstructions(promptOptions) {
  const options = globalThis.ShopScoutAI?.normalizePromptOptions
    ? ShopScoutAI.normalizePromptOptions(promptOptions)
    : { payloadMode: promptOptions?.payloadMode || 'compact' };
  let text = `Prompt payload mode: ${options.payloadMode}.\n`;
  text += 'Use compact captured facts first. Use product URLs only as source references. Retrieve/search only for missing, contradictory, or official manufacturer verification data.\n';
  if (options.payloadMode === 'fallback') {
    text += 'If capped raw fallback excerpts are present, use them only when compact facts are insufficient and ignore boilerplate.\n';
  }
  return text;
}

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
    'For every selected user-facing section, show a comparison table first, then concise explanatory text and bullet points.\n' +
    "Include each product's cost and source link when relevant. Keep the answer precise and readable, and avoid information overload.\n";
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
      lines.push('- Key specs:');
      product.specs.forEach(spec => {
        const key = formatManualValue(spec.key);
        const value = formatManualValue(spec.value);
        if (key && value) lines.push(`  - ${key}: ${value}`);
      });
    }
    if (product.bullets?.length) {
      lines.push('- Useful bullets:');
      product.bullets.forEach(bullet => {
        const text = formatManualValue(bullet);
        if (text) lines.push(`  - ${text}`);
      });
    }
    if (product.rawFallback) {
      const desc = formatManualValue(product.rawFallback.descriptionExcerpt);
      if (desc) lines.push(`- Capped fallback excerpt: ${desc}`);
      if (product.rawFallback.bullets?.length) {
        lines.push('- Capped fallback bullets:');
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
  const normalizedChecks = globalThis.ShopScoutAI?.normalizeAnalysisOptions
    ? ShopScoutAI.normalizeAnalysisOptions(analysisOptions)
    : analysisOptions;
  const labels = globalThis.ShopScoutAI?.selectedOptionLabels
    ? ShopScoutAI.selectedOptionLabels(normalizedChecks)
    : Object.entries(normalizedChecks || {}).filter(([, selected]) => selected).map(([key]) => key);
  const payload = globalThis.ShopScoutAI?.productSummary
    ? ShopScoutAI.productSummary(products, options)
    : (products || []).map((product, index) => ({ id: index + 1, name: product.title || `Product ${index + 1}`, url: product.url || '', price: product.newPrice || '', source: product.source || '' }));
  return 'You are a product comparison, verification, and buying-decision assistant for ShopScout.\n\n' +
    '# Output rules\n' +
    'Do not return JSON. Do not include a JSON object, JSON schema, code block, or raw structured data block in your answer.\n' +
    'Return a human-readable report only, with clear headings, compact tables, bullets, and short explanations.\n\n' +
    `# Payload policy\n${buildManualPromptPayloadInstructions(options)}\n` +
    `# Selected checks\n${labels.map(label => `- ${label}`).join('\n') || '- None'}\n\n` +
    `# Product facts\n${formatManualProductFacts(payload)}\n\n` +
    'Return a concise, readable report with tables first, explanations after, and confidence/verification status for important claims.';
}

function openDashboardResults(runId) {
  const target = runId ? `comparison.html?aiRun=${encodeURIComponent(runId)}` : 'comparison.html';
  chrome.tabs.create({ url: chrome.runtime.getURL(target) });
}

async function runPopupConnectedAI(productIndexes, providerId = 'auto', analysisOptions, promptOptions) {
  if (popupAiRunInProgress) {
    toast.show('AI analysis is already running. Wait for this run to finish before starting another one.', 'error');
    return;
  }
  const products = await getProducts();
  if (!products.length) { toast.show('No products to analyze', 'error'); return; }
  const status = document.getElementById('aiOptionsStatus');
  const runBtn = document.getElementById('aiOptionsRun');
  popupAiRunInProgress = true;
  if (status) status.textContent = 'Running connected AI. Keep this popup open; results will open in the dashboard.';
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.textContent = 'Running...';
  }
  toast.show('Running AI analysis...', 'loading');
  try {
    const result = await chrome.runtime.sendMessage({ action: 'runAIAnalysis', productIndexes, providerId, analysisOptions, promptOptions, devMonitor: false, openResultsOnComplete: true });
    toast.hide();
    if (!result?.success) {
      const error = result?.error || 'AI analysis failed';
      toast.show(error, 'error');
      if (String(error).includes('No connected AI providers')) {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
      }
      return;
    }
    toast.show('AI analysis complete. Opening dashboard results.');
    document.getElementById('aiOptionsModal')?.classList.remove('active');
    pendingAiRunOptions = null;
    if (!result.openedResults) openDashboardResults(result.run?.id);
  } catch (e) {
    toast.hide();
    toast.show(e.message || 'AI analysis failed', 'error');
  } finally {
    popupAiRunInProgress = false;
    if (runBtn) runBtn.textContent = 'Run Analysis';
    updateAiOptionsStatus();
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
  await chrome.scripting.executeScript({ target: { tabId }, files: ['utils.js', 'content.js'] });
  await new Promise(r => setTimeout(r, 500));
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => typeof extractProductData === 'function' ? extractProductData() : null
  });
  return results?.[0]?.result || null;
}

async function addFromTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (await detectCurrentPageFriction(tab.id)) {
      toast.show('Site verification page detected. Capture stopped.', 'error');
      return;
    }
    const product = await extractProductFromCurrentTab(tab.id);
    if (!product || !product.title) { toast.show('No product found on this page', 'error'); return; }
    product.lastScannedAt = Date.now();
    const products = await getProducts();
    const dup = products.find(p => p.url === product.url || (p.source === product.source && p.title === product.title));
    if (dup && dup.newPrice === product.newPrice) { toast.show('Already in your list', 'error'); return; }
    products.push(product);
    await saveProducts(products);
    toast.show(`Added "${product.title.substring(0, 40)}..."`);
    await renderProducts();
  } catch (e) { toast.show('Could not extract product', 'error'); }
}

async function addFromWindow() {
  toast.show('Scanning open tabs...', 'loading');
  const btn = document.getElementById('addWindowBtn');
  btn.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ action: 'addProductsFromWindow' });
    toast.hide();
    if (!result?.success) {
      toast.show(result?.error || 'Window scan failed', 'error');
      return;
    }
    const parts = [`Added ${result.added || 0}`];
    if (result.duplicates) parts.push(`${result.duplicates} duplicate`);
    if (result.noProduct) parts.push(`${result.noProduct} no product`);
    if (result.skipped) parts.push(`${result.skipped} skipped`);
    if (result.failed) parts.push(`${result.failed} failed`);
    toast.show(parts.join(', '));
    await renderProducts();
  } catch (e) {
    toast.hide();
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
  toast.show('Fetching product...', 'loading');
  try {
    const result = await chrome.runtime.sendMessage({ action: 'addByUrl', url });
    toast.hide();
    if (result?.success) {
      toast.show(`Added from ${result.product?.source || 'URL'}`);
      input.value = '';
      await renderProducts();
    } else toast.show(result?.error || 'Failed', 'error');
  } catch (e) { toast.hide(); toast.show('Failed to fetch', 'error'); }
}

// --- Copy prompt ---
async function copyPrompt(mode, analysisOptions, promptOptions) {
  const products = await getProducts();
  if (!products.length) { toast.show('No products to copy', 'error'); return; }
  const text = buildManualHybridPrompt(products, analysisOptions, promptOptions) + buildManualAnalysisOptionsInstructions(analysisOptions, promptOptions);
  await navigator.clipboard.writeText(text);
  await chrome.storage.local.set({ shopscout_last_prompt: text });
  chrome.tabs.create({ url: chrome.runtime.getURL(`ai-select.html?mode=${mode}&count=${products.length}`) });
}

// --- Remove product ---
async function removeProduct(idx) {
  const products = await getProducts();
  if (idx >= 0 && idx < products.length) {
    products.splice(idx, 1);
    await saveProducts(products);
    await renderProducts();
    toast.show('Removed');
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
  await saveProducts(products);
  document.getElementById('editModal').classList.remove('active');
  toast.show('Product updated');
  await renderProducts();
}

// --- Export ---
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

// --- Import ---
function doImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.xml,.csv';
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    try {
      const text = await file.text();
      const { imported, listName } = parseImport(text, file.name.toLowerCase());
      if (!imported.length) { toast.show('No products found in file', 'error'); return; }
      const data = await getData();
      const target = listName || data.activeList;
      if (!data.lists[target]) data.lists[target] = [];
      data.lists[target].push(...imported);
      if (listName) data.activeList = target;
      await saveData(data);
      await renderListSelector();
      await renderProducts();
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
  await renderProducts();
}

async function deleteList() {
  const data = await getData();
  const keys = Object.keys(data.lists);
  if (keys.length <= 1) { toast.show('Cannot delete the last list', 'error'); return; }
  if (!confirm(`Delete "${data.activeList}" and all its products?`)) return;
  delete data.lists[data.activeList];
  data.activeList = Object.keys(data.lists)[0];
  await saveData(data);
  await renderListSelector();
  await renderProducts();
  toast.show('List deleted');
}
