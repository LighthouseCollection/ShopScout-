var chrome = globalThis.browser || globalThis.chrome;
if (typeof importScripts === 'function' && !globalThis.ShopScoutAI) {
  importScripts('ai-providers.js');
}
/* Open*Facts GTIN enrichment helper — exposed on globalThis.SSOpenFactsEnrich. */
if (typeof importScripts === 'function' && !globalThis.SSOpenFactsEnrich) {
  try { importScripts('data/openFactsEnrich.js'); }
  catch (err) { console.warn('Open*Facts enrich load failed', err); }
}

const STORAGE_KEY = 'shopscout_data';
let activeAIAnalysisRun = null;

// --- Context menus ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'ss-add', title: 'Add Product to ShopScout', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'ss-copy', title: 'Quick Compare (Copy for AI)', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'ss-deep', title: 'Deep Compare (Copy for AI)', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'ss-open', title: 'Open ShopScout Comparison', contexts: ['page'] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'ss-add') await addProduct(tab);
  if (info.menuItemId === 'ss-copy') await copyForAI(tab, 'quick');
  if (info.menuItemId === 'ss-deep') await copyForAI(tab, 'deep');
  if (info.menuItemId === 'ss-open') chrome.tabs.create({ url: chrome.runtime.getURL('comparison.html') });
});

// --- Badge: auto-detect product pages ---
// The pipeline content scripts are declared in manifest.json's
// content_scripts block (run_at: document_end) so they inject natively
// the moment the DOM is parsed — instant FAB, no background bounce.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) updateBadge(tabId, tab.url);
});
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) updateBadge(tab.id, tab.url);
  } catch {}
});

function updateBadge(tabId, url) {
  const is = isProductUrl(url);
  chrome.action.setBadgeText({ tabId, text: is ? '!' : '' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563eb' });
  if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ tabId, color: '#fff' });
}

function isProductUrl(url) {
  return [
    /amazon\..+\/dp\//i, /amazon\..+\/gp\/product\//i,
    /ebay\..+\/itm\//i,
    /costco\.com\/p\//i, /costco\.com\/.+\.product\./i, /costco\.com\/.*\.html/i,
    /temu\.com\/.*\.html/i,
    /alibaba\.com\/product-detail/i, /aliexpress\..+\/item\//i, /aliexpress\..+\/i\//i,
    /bestbuy\.com\/site\/.+\/\d+\.p/i,
    /walmart\.com\/ip\//i,
    /target\.com\/p\//i,
    /newegg\.com\/p\//i, /newegg\.com\/.+\/p\//i,
    /homedepot\.com\/p\//i,
    /lowes\.com\/pd\//i,
    /shein\..+\/-p-\d+/i, /shein\..+\/p-/i,
  ].some(p => p.test(url));
}

function sanitizeHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function tabUrlMatchesHost(tabUrl, expectedHost) {
  try {
    const host = new URL(tabUrl).hostname.toLowerCase();
    const expected = String(expectedHost || '').toLowerCase();
    return host === expected || host.endsWith('.' + expected);
  } catch {
    return false;
  }
}

function waitForTabComplete(tabId, timeoutMs, settleMs) {
  return new Promise((resolve, reject) => {
    let done = false;
    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timeout);
    };
    const finish = (fn) => {
      if (done) return;
      done = true;
      cleanup();
      fn();
    };
    const timeout = setTimeout(() => finish(() => reject(new Error('Page load timeout'))), timeoutMs);
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        finish(() => setTimeout(resolve, settleMs));
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function safeExecScript(tabId, func, args) {
  try {
    return await chrome.scripting.executeScript({ target: { tabId }, func, ...(args ? { args } : {}) });
  } catch (e) {
    if (e.message?.includes('No tab with id') || e.message?.includes('Cannot access')) return null;
    throw e;
  }
}

async function ensureContentScript(tabId) {
  /* Order matters — productSchema (observation/assemble) is required by
     structuredSignals/adapters; marketplace.detect needs the adapters
     registered; content/content.js is the entry point and must come last. */
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [
      'utils.js',
      /* New pipeline */
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
      /* Legacy script — still active until task #66 hard-cutover */
      'content.js'
    ]
  });
}

async function extractProductFromTab(tabId) {
  await ensureContentScript(tabId);
  /* The new pipeline is async (bot-aware DOM waits etc.), so we go
     through the message bus instead of executeScript({func}). The
     content-script listener handles the async sendResponse via
     `return true`. */
  try {
    const result = await chrome.tabs.sendMessage(tabId, { action: 'extract' });
    return result || null;
  } catch (e) {
    /* Tab closed mid-extract / receiving end gone. */
    if (e && e.message && /Could not establish connection|message channel/i.test(e.message)) {
      return null;
    }
    throw e;
  }
}

function isCapturableTabUrl(url) {
  /* Only known product-page URL shapes are eligible for the bulk
     "Add Products from Open Tabs" scan. Trying to extract from every
     http(s) tab (Gmail, GitHub, news, etc.) only produces "no product"
     misses and wastes time; isProductUrl is the same regex set the
     toolbar-badge uses, so the user sees consistent semantics. */
  const safeUrl = sanitizeHttpUrl(url);
  if (!safeUrl) return false;
  return isProductUrl(safeUrl);
}

function isDuplicateProduct(list, product) {
  return list.find(p => p.url === product.url || (p.source === product.source && p.title === product.title));
}

function displayProductNameBg(p) {
  return p.productName || p.structuredProductName || p.title || 'N/A';
}

async function getShopScoutData() {
  const d = await chrome.storage.local.get(STORAGE_KEY);
  const data = d[STORAGE_KEY] || { lists: { 'My Products': [] }, activeList: 'My Products' };
  if (!data.lists || !Object.keys(data.lists).length) {
    data.lists = { 'My Products': [] };
    data.activeList = 'My Products';
  }
  if (!data.lists[data.activeList]) data.activeList = Object.keys(data.lists)[0];
  return data;
}

// --- Add product (used by context menu) ---
/* Core capture flow — returns a structured result so different callers (context
   menu vs floating button) can present feedback in their own UI. */
async function captureCurrentTab(tab) {
  if (await detectPageFriction(tab.id, safeExecScript)) {
    return { ok: false, error: 'Site verification page detected. Capture stopped.' };
  }
  const product = await extractProductFromTab(tab.id);
  if (!product || !product.title) return { ok: false, error: 'No product found' };
  /* Opt-in Open*Facts enrichment by GTIN — no-op when disabled in Settings. */
  if (globalThis.SSOpenFactsEnrich && globalThis.SSOpenFactsEnrich.enrichByGtin) {
    try { await globalThis.SSOpenFactsEnrich.enrichByGtin(product); }
    catch (err) { console.warn('Open*Facts enrichment failed', err); }
  }
  product.lastScannedAt = Date.now();
  const d = await chrome.storage.local.get(STORAGE_KEY);
  const data = d[STORAGE_KEY] || { lists: { 'My Products': [] }, activeList: 'My Products' };
  const list = data.lists[data.activeList] || [];
  const dup = list.find(p => p.url === product.url || (p.source === product.source && p.title === product.title));
  if (dup && dup.newPrice === product.newPrice) return { ok: false, error: 'Already in list', listName: data.activeList };
  list.push(product);
  data.lists[data.activeList] = list;
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
  return { ok: true, listName: data.activeList };
}

async function addProduct(tab) {
  try {
    const r = await captureCurrentTab(tab);
    if (r.ok) showToast(tab.id, `Added to "${r.listName}"!`);
    else showToast(tab.id, r.error, true);
  } catch (e) { console.error('ShopScout:', e); }
}

// --- Copy for AI (used by context menu) ---
function formatProductBg(p, i, n, detailed) {
  let t = `────────────────────────────────────────\nProduct ${i + 1} of ${n}\n`;
  const displayName = displayProductNameBg(p);
  t += `Name:           ${displayName}\n`;
  if (p.listingTitle && p.listingTitle !== displayName) t += `Listing Title:  ${p.listingTitle}\n`;
  t += `Brand:          ${p.brand || 'N/A'}\n`;
  if (p.manufacturer && p.manufacturer !== p.brand) t += `Manufacturer:   ${p.manufacturer}\n`;
  t += `Price (New):    ${p.newPrice || 'N/A'}\n`;
  if (p.usedPrice) t += `Price (Used):   ${p.usedPrice}\n`;
  if (p.shippingPrice) t += `Shipping:       ${p.shippingPrice}\n`;
  t += `Source:         ${p.source || 'Unknown'}\n`;
  if (p.sellerName) t += `Seller:         ${p.sellerName}\n`;
  if (p.modelName) t += `Model Name:     ${p.modelName}\n`;
  t += `Model Number:   ${p.modelNumber || 'N/A'}\n`;
  if (p.sku) t += `SKU:            ${p.sku}\n`;
  if (p.asin) t += `ASIN:           ${p.asin}\n`;
  if (p.upc) t += `UPC:            ${p.upc}\n`;
  if (p.mpn) t += `MPN:            ${p.mpn}\n`;
  if (p.rating) t += `Rating:         ${p.rating}/5${p.reviewCount ? ` (${p.reviewCount} reviews)` : ''}\n`;
  t += `URL:            ${p.url}\n`;
  if (p.notes) t += `Notes:          ${p.notes}\n`;
  if (detailed && p.bullets?.length) t += `\nFeature Bullets:\n${p.bullets.map(b => '  • ' + b).join('\n')}\n`;
  if (detailed && p.rawSpecs?.length) { t += `\nSpecifications:\n`; p.rawSpecs.forEach(s => { t += `  ${s.key}: ${s.value}\n`; }); }
  return t + '\n';
}

const BG_CATEGORY_KEYWORDS = [
  ['tv', /\b(tv|television|oled|qled|led tv|smart tv|4k tv|8k|uhd tv)\b/i, 'TV & Display'],
  ['laptop', /\b(laptop|notebook|chromebook|macbook|ultrabook)\b/i, 'Laptop'],
  ['headphone', /\b(headphone|earphone|earbud|headset|over-ear|in-ear|ANC)\b/i, 'Headphones'],
  ['speaker', /\b(speaker|soundbar|subwoofer|sound bar)\b/i, 'Speakers'],
  ['phone', /\b(phone|smartphone|iphone|galaxy s|pixel \d)\b/i, 'Smartphone'],
  ['monitor', /\b(monitor|gaming monitor|ultrawide)\b/i, 'Monitor'],
  ['camera', /\b(camera|dslr|mirrorless|webcam|dash cam)\b/i, 'Camera'],
  ['vacuum', /\b(vacuum|roomba|robot vacuum)\b/i, 'Vacuum'],
  ['refrigerator', /\b(refrigerator|fridge|freezer)\b/i, 'Refrigerator'],
  ['washer', /\b(washer|dryer|washing machine)\b/i, 'Washer/Dryer'],
  ['clothing', /\b(shirt|pants|jeans|jacket|dress|sweater|hoodie)\b/i, 'Clothing'],
  ['shoe', /\b(shoe|sneaker|boot|sandal|running shoe)\b/i, 'Footwear'],
  ['furniture', /\b(sofa|couch|desk|chair|table|bed|mattress|dresser|shelf)\b/i, 'Furniture'],
  ['tool', /\b(drill|saw|sander|grinder|wrench|screwdriver)\b/i, 'Tools'],
  ['baby', /\b(car seat|stroller|crib|high chair|baby)\b/i, 'Baby & Kids'],
  ['pet', /\b(dog|cat|pet food|pet bed|leash|collar)\b/i, 'Pet Supplies'],
  ['automotive', /\b(tire|car|auto|brake pad|floor mat|dash cam|car organizer)\b/i, 'Automotive'],
];

function inferCategoryBg(product) {
  const text = [product.title || '', product.category || '', product.brand || ''].join(' ');
  for (const [, re, label] of BG_CATEGORY_KEYWORDS) {
    if (re.test(text)) return label;
  }
  return '';
}

function getPromptLayoutBg(productCount) {
  if (productCount <= 1) return 'Product verification report';
  if (productCount === 2) return 'Detailed side-by-side comparison';
  if (productCount <= 5) return 'Comparison table + short product cards';
  if (productCount <= 12) return 'Dashboard + grouped rankings + compact matrix';
  return 'Category grouping + shortlist + appendix-only details';
}

function buildPromptInstructionsBg(mode, productCount) {
  const layout = getPromptLayoutBg(productCount);
  let text = `# Presentation Layer\n\n`;
  text += `Output style: ${layout}.\n`;
  text += `Separate the answer into: Decision Layer, Evidence Layer, and Detail Layer.\n`;
  text += `Start with the verdict. Be precise, concise, and relevant; do not skip important details, but move supporting detail to tables or appendix.\n`;
  text += `Use Brand | Model Name | Model Number as the primary display name when available. Keep listing titles as supporting detail.\n`;
  text += `Group products by category, subcategory, and use case before ranking. Do not force one overall winner across products that are not directly comparable.\n`;
  text += `For 6 or more products, use a dashboard layout and move detailed product notes to an appendix.\n`;
  text += `Use status markers consistently: ✅ verified, 🔵 listing-only, 🧩 inferred, ❓ missing, ⚠️ concern, 🚩 contradiction, 🧬 possible rebrand, 💰 best value, 🏆 recommended, ⛔ avoid.\n\n`;
  if (mode !== 'quick') {
    text += `# Verification Rules\n\n`;
    text += `Use marketplace listing data as a starting point only. Verify important claims against official manufacturer pages, spec sheets, manuals, warranty pages, certification/compliance documents, authorized retailers, and reputable technical reviews when possible.\n`;
    text += `Flag missing, contradictory, vague, exaggerated, "up to", software-enhanced, simulated/coated/blended-material, certification-without-proof, and marketplace-only claims.\n`;
    text += `If manufacturer verification is not possible, say: "Manufacturer verification was not available from the provided data."\n\n`;
    text += `# Structured JSON Output for ShopScout\n\n`;
    text += `After the readable report, include a JSON decision object with keys: quick_verdict, products, specification_ledger, missing_attributes, risks, rebrand_checks, final_ranking. Include "quick_verdict" exactly so the app can detect the JSON section.\n\n`;
  }
  return text;
}

async function copyForAI(tab, mode) {
  try {
    const d = await chrome.storage.local.get(STORAGE_KEY);
    const data = d[STORAGE_KEY] || { lists: { 'My Products': [] }, activeList: 'My Products' };
    const products = data.lists[data.activeList] || [];
    if (!products.length) { showToast(tab.id, 'No products to copy', true); return; }
    const n = products.length;
    let text = buildPromptInstructionsBg(mode, n);
    if (mode === 'deep') {
      text += `You are a category-aware product comparison, specification-verification, and buying-decision assistant.\nI am giving you ${n} products. Help me decide what to buy.\n\n`;
      text += `Each product includes an inferred category. Use category-specific quality factors. If the category is wrong, correct it.\n\n`;
      products.forEach((p, i) => {
        const cat = inferCategoryBg(p);
        if (cat) text += `[Category: ${cat}]\n`;
        text += formatProductBg(p, i, n, true);
      });
      text += '\nReturn a decision-first dashboard with product identity table, category grouping, master decision matrix, spec comparison matrix, risk dashboard, rebrand/duplicate check, concise product scorecards, final ranking, and JSON decision object.';
    } else {
      text += `Compare these ${n} products on price, category-relevant features, value, ratings, and obvious risks.\n\n`;
      products.forEach((p, i) => { text += formatProductBg(p, i, n, false); });
      text += '\nCompare and recommend the best value. Use a compact decision-first answer.';
    }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: t => navigator.clipboard.writeText(t), args: [text] });
    await chrome.storage.local.set({ shopscout_last_prompt: text });
    chrome.tabs.create({ url: chrome.runtime.getURL(`ai-select.html?mode=${mode}&count=${n}`) });
  } catch (e) { console.error('ShopScout:', e); }
}

// --- Connected AI providers ---
function extractSourceUrlsFromAI(text, json) {
  const urls = new Set();
  const raw = String(text || '');
  for (const match of raw.matchAll(/https?:\/\/[^\s)\]>"']+/g)) {
    urls.add(match[0].replace(/[.,;]+$/, ''));
  }
  for (const key of ['citations', 'sources', 'search_results', 'web_results']) {
    const list = json?.[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === 'string' && /^https?:\/\//i.test(item)) urls.add(item);
      if (item?.url) urls.add(item.url);
      if (item?.source?.url) urls.add(item.source.url);
    }
  }
  return [...urls];
}

async function getAISettings() {
  const stored = await chrome.storage.local.get(ShopScoutAI.AI_STORAGE_KEY);
  return ShopScoutAI.mergeSettings(stored[ShopScoutAI.AI_STORAGE_KEY]);
}

async function saveAISettings(settings) {
  await chrome.storage.local.set({ [ShopScoutAI.AI_STORAGE_KEY]: ShopScoutAI.mergeSettings(settings) });
}

async function invokeAIProvider(provider, config, prompt) {
  const req = ShopScoutAI.buildRequest(provider, config, prompt);
  const response = await fetch(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(req.body)
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    const detail = json?.error?.message || json?.message || text || response.statusText || 'Request failed';
    throw new Error(`${provider.name} ${response.status}: ${detail}`);
  }
  const responseText = ShopScoutAI.parseProviderResponse(req.parser, json || {});
  return {
    responseText,
    parsedJson: ShopScoutAI.extractJsonFromText(responseText),
    sourceUrls: extractSourceUrlsFromAI(responseText, json),
    tokenUsage: ShopScoutAI.extractProviderTokenUsage(req.parser, json || {}, prompt, responseText),
    raw: json
  };
}

async function testAIProvider(providerId) {
  const settings = await getAISettings();
  const provider = ShopScoutAI.getProvider(providerId);
  if (!provider) return { success: false, error: 'Unknown provider' };
  const config = settings.providers[providerId];
  if (provider.adapter === 'manual') {
    return { success: false, error: `${provider.name} requires enterprise/OAuth/manual setup in this version.` };
  }
  try {
    const result = await invokeAIProvider(provider, config, 'Reply with exactly: ShopScout connected.');
    ShopScoutAI.addProviderTokenUsage(settings, provider.id, result.tokenUsage);
    config.lastTest = { ok: true, at: new Date().toISOString(), message: result.responseText.slice(0, 120) };
    settings.providers[providerId] = config;
    await saveAISettings(settings);
    return { success: true, message: result.responseText.slice(0, 120) || 'Connected' };
  } catch (e) {
    config.lastTest = { ok: false, at: new Date().toISOString(), message: e.message };
    settings.providers[providerId] = config;
    await saveAISettings(settings);
    return { success: false, error: e.message };
  }
}

function getRunProducts(list, productIndexes) {
  if (Array.isArray(productIndexes) && productIndexes.length) {
    return productIndexes
      .map(idx => ({ idx, product: list[idx] }))
      .filter(item => item.product);
  }
  return list.map((product, idx) => ({ idx, product }));
}

function sendAIProgress(message, payload) {
  if (!message?.devMonitor && !message?.clientRunId) return;
  try {
    const sent = chrome.runtime.sendMessage({
      action: 'aiAnalysisProgress',
      clientRunId: message.clientRunId || '',
      timestamp: new Date().toISOString(),
      ...payload
    });
    if (sent?.catch) sent.catch(() => {});
  } catch {}
}

function providerDisplayName(provider) {
  return provider?.shortName || provider?.name || provider?.id || '';
}

function progressSnippet(value, maxLength = 1200) {
  const text = String(value || '').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function finalizeAIAnalysisRunStatus(run) {
  const completedStages = (run.stages || []).filter(stage => stage.status === 'completed');
  const failedStages = (run.stages || []).filter(stage => stage.status === 'failed');
  run.completedAt = run.completedAt || new Date().toISOString();
  run.status = failedStages.length ? (completedStages.length ? 'partial' : 'failed') : 'completed';
  return { completedStages, failedStages };
}

async function saveAIAnalysisRun(data, listName, list, selected, run) {
  data.aiRuns = Array.isArray(data.aiRuns) ? data.aiRuns : [];
  data.aiRuns = data.aiRuns.filter(item => item.id !== run.id);
  data.aiRuns.unshift(run);
  data.aiRuns = data.aiRuns.slice(0, 30);

  for (const { idx } of selected || []) {
    if (!list[idx]) continue;
    list[idx].aiAnalysis = {
      runId: run.id,
      updatedAt: run.completedAt,
      status: run.status,
      stages: run.stages
    };
  }

  data.lists[listName] = list;
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

async function runAIAnalysis(message = {}) {
  if (activeAIAnalysisRun) {
    const error = 'AI analysis is already running. Wait for this run to finish before starting another one.';
    sendAIProgress(message, {
      type: 'run-failed',
      status: 'failed',
      error,
      activeClientRunId: activeAIAnalysisRun.clientRunId || '',
      activeRunId: activeAIAnalysisRun.runId || ''
    });
    return { success: false, error };
  }
  activeAIAnalysisRun = {
    clientRunId: message.clientRunId || '',
    runId: '',
    startedAt: new Date().toISOString()
  };
  try {
    sendAIProgress(message, {
      type: 'run-info',
      message: 'Checking AI provider settings and saved API keys.'
    });
    const settings = await getAISettings();
    const configured = ShopScoutAI.configuredProviders(settings);
    sendAIProgress(message, {
      type: 'run-info',
      message: `Found ${configured.length} connected AI provider${configured.length === 1 ? '' : 's'}.`
    });
    if (!configured.length) {
      const error = 'No connected AI providers. Open Settings and add at least one API key.';
      sendAIProgress(message, { type: 'run-failed', status: 'failed', error });
      return { success: false, error };
    }
    const forcedProviderId = message.providerId && message.providerId !== 'auto' ? message.providerId : '';
    let forcedProvider = null;
    if (forcedProviderId) {
      forcedProvider = ShopScoutAI.getProvider(forcedProviderId);
      const forcedConfig = forcedProvider ? settings.providers[forcedProvider.id] : null;
      if (!forcedProvider || !forcedConfig?.enabled || !forcedConfig.apiKey || forcedProvider.adapter === 'manual') {
        const error = 'Selected AI provider is not connected or cannot run from ShopScout yet.';
        sendAIProgress(message, { type: 'run-failed', status: 'failed', error });
        return { success: false, error };
      }
      sendAIProgress(message, {
        type: 'run-info',
        message: `Using selected provider: ${providerDisplayName(forcedProvider)}.`
      });
    }

    sendAIProgress(message, {
      type: 'run-info',
      message: 'Loading products from the current ShopScout list.'
    });
    const data = await getShopScoutData();
    const list = data.lists[data.activeList] || [];
    const selected = getRunProducts(list, message.productIndexes);
    if (!selected.length) {
      const error = 'No products selected for AI analysis.';
      sendAIProgress(message, { type: 'run-failed', status: 'failed', error });
      return { success: false, error };
    }

    const products = selected.map(item => item.product);
    const analysisOptions = message.analysisOptions
      ? ShopScoutAI.normalizeAnalysisOptions(message.analysisOptions)
      : ShopScoutAI.recommendedAnalysisOptions(products);
    const promptOptions = ShopScoutAI.normalizePromptOptions(message.promptOptions || {});
    const stages = ShopScoutAI.enabledStagesForAnalysis(analysisOptions, !!settings.roles.secondOpinion);
    sendAIProgress(message, {
      type: 'run-info',
      message: `Loaded products and selected analysis checks. Products: ${products.length}. Checks: ${ShopScoutAI.selectedOptionLabels(analysisOptions).join(', ') || 'recommended defaults'}.`
    });

    const run = {
      id: ShopScoutAI.createEvidenceEvent({ stage: 'run' }).id.replace('evidence-', 'run-'),
      listName: data.activeList,
      productIndexes: selected.map(item => item.idx),
      productUrls: products.map(p => p.url || ''),
      analysisOptions,
      promptOptions,
      startedAt: new Date().toISOString(),
      completedAt: '',
      status: 'running',
      stages: []
    };
    activeAIAnalysisRun.runId = run.id;
    activeAIAnalysisRun.run = run;
    activeAIAnalysisRun.data = data;
    activeAIAnalysisRun.listName = data.activeList;
    activeAIAnalysisRun.list = list;
    activeAIAnalysisRun.selected = selected;

    sendAIProgress(message, {
      type: 'run-started',
      runId: run.id,
      status: run.status,
      listName: run.listName,
      productIndexes: run.productIndexes,
      productCount: products.length,
      productUrls: run.productUrls,
      selectedChecks: ShopScoutAI.selectedOptionLabels(analysisOptions),
      stages
    });

    for (const stage of stages) {
      sendAIProgress(message, {
        type: 'stage-info',
        runId: run.id,
        stage,
        message: `Preparing ${stage} step: selecting provider and building the prompt.`
      });
      const provider = forcedProvider || ShopScoutAI.resolveProviderForStage(settings, stage);
      if (!provider) {
        const event = ShopScoutAI.createEvidenceEvent({
          providerId: '',
          stage,
          status: 'skipped',
          error: 'No configured provider available for this stage.'
        });
        run.stages.push(event);
        sendAIProgress(message, {
          type: 'stage-skipped',
          runId: run.id,
          stage,
          status: event.status,
          error: event.error
        });
        continue;
      }

      const config = settings.providers[provider.id] || {};
      const model = config.model || provider.defaultModel;
      const prompt = ShopScoutAI.buildStagePrompt(stage, products, run.stages, analysisOptions, promptOptions);
      const displayName = providerDisplayName(provider);
      sendAIProgress(message, {
        type: 'stage-info',
        runId: run.id,
        stage,
        providerId: provider.id,
        providerName: displayName,
        model,
        message: `Built prompt and calling ${displayName}${model ? ` (${model})` : ''}.`
      });
      if (provider.adapter === 'manual') {
        const event = ShopScoutAI.createEvidenceEvent({
          providerId: provider.id,
          model,
          stage,
          prompt,
          status: 'skipped',
          error: `${provider.name} is manual/enterprise setup in this version.`
        });
        run.stages.push(event);
        sendAIProgress(message, {
          type: 'stage-skipped',
          runId: run.id,
          stage,
          status: event.status,
          providerId: provider.id,
          providerName: providerDisplayName(provider),
          model,
          promptSnippet: progressSnippet(prompt),
          error: event.error
        });
        continue;
      }

      sendAIProgress(message, {
        type: 'stage-started',
        runId: run.id,
        stage,
        status: 'running',
        providerId: provider.id,
        providerName: displayName,
        model,
        promptSnippet: progressSnippet(prompt)
      });

      try {
        const result = await invokeAIProvider(provider, config, prompt);
        ShopScoutAI.addProviderTokenUsage(settings, provider.id, result.tokenUsage);
        await saveAISettings(settings);
        const event = ShopScoutAI.createEvidenceEvent({
          providerId: provider.id,
          model,
          stage,
          prompt,
          responseText: result.responseText,
          parsedJson: result.parsedJson,
          sourceUrls: result.sourceUrls,
          confidence: result.parsedJson?.confidence || 'unknown',
          status: 'completed',
          verifiesEventIds: run.stages.map(event => event.id)
        });
        run.stages.push(event);
        sendAIProgress(message, {
          type: 'stage-completed',
          runId: run.id,
          stage,
          status: event.status,
          providerId: provider.id,
          providerName: event.providerName || providerDisplayName(provider),
          model,
          responseSnippet: progressSnippet(result.responseText),
          sourceUrls: result.sourceUrls,
          tokenUsage: result.tokenUsage,
          parsedJson: !!result.parsedJson,
          confidence: event.confidence
        });
      } catch (e) {
        const event = ShopScoutAI.createEvidenceEvent({
          providerId: provider.id,
          model,
          stage,
          prompt,
          status: 'failed',
          error: e.message
        });
        run.stages.push(event);
        sendAIProgress(message, {
          type: 'stage-failed',
          runId: run.id,
          stage,
          status: event.status,
          providerId: provider.id,
          providerName: event.providerName || providerDisplayName(provider),
          model,
          promptSnippet: progressSnippet(prompt),
          error: event.error
        });
      }
    }

    const { completedStages, failedStages } = finalizeAIAnalysisRunStatus(run);
    await saveAIAnalysisRun(data, data.activeList, list, selected, run);
    sendAIProgress(message, {
      type: 'run-completed',
      runId: run.id,
      status: run.status,
      completedStages: completedStages.length,
      failedStages: failedStages.length,
      skippedStages: run.stages.filter(stage => stage.status === 'skipped').length
    });
    const openedResults = message.openResultsOnComplete ? await openDashboardRunResults(run.id) : false;
    return { success: run.status !== 'failed', run, openedResults };
  } catch (e) {
    const partialRun = activeAIAnalysisRun?.run;
    if (partialRun) {
      const { completedStages, failedStages } = finalizeAIAnalysisRunStatus(partialRun);
      if (!failedStages.length) {
        partialRun.status = completedStages.length ? 'partial' : 'failed';
      }
      try {
        await saveAIAnalysisRun(
          activeAIAnalysisRun.data,
          activeAIAnalysisRun.listName,
          activeAIAnalysisRun.list,
          activeAIAnalysisRun.selected,
          partialRun
        );
      } catch {}
      sendAIProgress(message, {
        type: 'run-completed',
        runId: partialRun.id,
        status: partialRun.status,
        completedStages: completedStages.length,
        failedStages: failedStages.length || 1,
        skippedStages: partialRun.stages.filter(stage => stage.status === 'skipped').length,
        error: e.message || 'AI analysis failed'
      });
      return { success: false, error: e.message || 'AI analysis failed', run: partialRun };
    }
    sendAIProgress(message, {
      type: 'run-failed',
      status: 'failed',
      error: e.message || 'AI analysis failed'
    });
    throw e;
  } finally {
    activeAIAnalysisRun = null;
  }
}

async function openDashboardRunResults(runId) {
  if (!runId) return false;
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL(`comparison.html?aiRun=${encodeURIComponent(runId)}`) });
    return true;
  } catch {
    return false;
  }
}

// --- Message handlers ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  /* FAB: capture the sender's current tab and respond with status. */
  if (msg.action === 'captureFromFab') {
    (async () => {
      try {
        if (!sender.tab) { sendResponse({ ok: false, error: 'No tab context' }); return; }
        const r = await captureCurrentTab(sender.tab);
        sendResponse(r);
      } catch (e) {
        sendResponse({ ok: false, error: String((e && e.message) || e) });
      }
    })();
    return true;
  }
  if (msg.action === 'addByUrl') {
    addByUrl(msg.url).then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (msg.action === 'rescanProduct') {
    rescanProduct(msg.url).then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (msg.action === 'fetchReviewPhotos') {
    fetchReviewPhotos(msg.url).then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (msg.action === 'addProductsFromWindow') {
    addProductsFromWindow(sender.tab?.windowId).then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (msg.action === 'testAIProvider') {
    testAIProvider(msg.providerId).then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (msg.action === 'runAIAnalysis') {
    runAIAnalysis(msg).then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
});

async function addProductsFromWindow(windowId) {
  const tabs = await chrome.tabs.query(windowId != null ? { windowId } : { currentWindow: true });
  const data = await getShopScoutData();
  const list = data.lists[data.activeList] || [];
  const seenUrls = new Set();
  const summary = {
    success: true,
    scanned: 0,
    added: 0,
    duplicates: 0,
    noProduct: 0,
    skipped: 0,
    failed: 0,
    friction: 0,
    products: []
  };

  for (const tab of tabs) {
    const url = sanitizeHttpUrl(tab.url);
    if (!url || !isCapturableTabUrl(url) || seenUrls.has(url)) {
      summary.skipped++;
      continue;
    }
    seenUrls.add(url);
    summary.scanned++;

    try {
      if (await detectPageFriction(tab.id, safeExecScript)) {
        summary.friction++;
        continue;
      }
      const product = await extractProductFromTab(tab.id);
      if (!product || !product.title) {
        console.warn('[ShopScout] addProductsFromWindow: no product extracted from', url);
        summary.noProduct++;
        continue;
      }
      product.lastScannedAt = Date.now();
      const duplicate = isDuplicateProduct(list, product);
      if (duplicate && duplicate.newPrice === product.newPrice) {
        summary.duplicates++;
        continue;
      }
      list.push(product);
      summary.added++;
      summary.products.push({ title: product.title, source: product.source, url: product.url });
      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      console.warn('[ShopScout] addProductsFromWindow: failed on', url, err && err.message ? err.message : err);
      summary.failed++;
    }
  }

  data.lists[data.activeList] = list;
  if (summary.added) await chrome.storage.local.set({ [STORAGE_KEY]: data });
  return summary;
}

async function addByUrl(url) {
  url = sanitizeHttpUrl(url);
  if (!url) return { success: false, error: 'Enter a valid http(s) URL' };
  let tab;
  try {
    // Open the URL in a hidden-ish tab
    tab = await chrome.tabs.create({ url, active: false });

    // Wait for the page to fully load (up to 20 seconds)
    await waitForTabComplete(tab.id, 20000, 2000);

    if (await detectPageFriction(tab.id, safeExecScript)) {
      await chrome.tabs.remove(tab.id);
      return { success: false, error: 'Stopped because the site showed a verification or access page' };
    }

    const product = await extractProductFromTab(tab.id);
    if (!product || !product.title) {
      await chrome.tabs.remove(tab.id);
      return { success: false, error: 'No product found at this URL' };
    }
    product.lastScannedAt = Date.now();

    // Save to storage
    const d = await chrome.storage.local.get(STORAGE_KEY);
    const data = d[STORAGE_KEY] || { lists: { 'My Products': [] }, activeList: 'My Products' };
    const list = data.lists[data.activeList] || [];
    const dup = list.find(p => p.url === product.url || (p.source === product.source && p.title === product.title));
    if (dup && dup.newPrice === product.newPrice) {
      await chrome.tabs.remove(tab.id);
      return { success: false, error: 'Same product & price already in list' };
    }
    list.push(product);
    data.lists[data.activeList] = list;
    await chrome.storage.local.set({ [STORAGE_KEY]: data });

    // Close the background tab
    await chrome.tabs.remove(tab.id);
    return { success: true, product: { title: product.title, source: product.source } };
  } catch (e) {
    try { if (tab) await chrome.tabs.remove(tab.id); } catch {}
    return { success: false, error: e.message || 'Failed to fetch product' };
  }
}

// --- Rescan: re-extract product data from URL without saving ---
async function rescanProduct(url) {
  url = sanitizeHttpUrl(url);
  if (!url) return { success: false, error: 'Enter a valid http(s) URL' };
  let tab;
  try {
    tab = await chrome.tabs.create({ url, active: false });
    await waitForTabComplete(tab.id, 25000, 2500);

    if (await detectPageFriction(tab.id, safeExecScript)) {
      await chrome.tabs.remove(tab.id);
      return { success: false, error: 'Stopped because the site showed a verification or access page' };
    }

    const product = await extractProductFromTab(tab.id);
    await chrome.tabs.remove(tab.id);

    if (!product || !product.title) return { success: false, error: 'No product data found' };
    product.lastScannedAt = Date.now();
    return { success: true, product };
  } catch (e) {
    try { if (tab) await chrome.tabs.remove(tab.id); } catch {}
    return { success: false, error: e.message || 'Rescan failed' };
  }
}

// --- Fetch review photos by navigating interactive modals ---
// Uses sequential executeScript calls (no async) to avoid CSP/Promise issues

function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function _delayRange(minMs, maxMs) {
  const span = Math.max(0, maxMs - minMs);
  return _delay(minMs + Math.floor(Math.random() * (span + 1)));
}

const REVIEW_PHOTO_CACHE_KEY = 'shopscout_review_photo_cache';
const REVIEW_PHOTO_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REVIEW_PHOTO_LIMIT = 20;
const REVIEW_GALLERY_CLICK_LIMIT = 20;
const SHEIN_LOAD_MORE_LIMIT = 4;
const BLOCKED_IMAGE_URLS = new Set([
  'https://m.media-amazon.com/images/i/01gk70bg4ul.svg',
  'https://m.media-amazon.com/images/s/sash//23pid5mp1wta-31.svg',
  'https://m.media-amazon.com/images/s/sash//7d8irtq0drkaf4o.svg'
]);

function isBlockedImageUrl(src) {
  if (!src) return true;
  const lower = String(src).trim().toLowerCase();
  const normalized = lower.replace(/\/+/g, '/').replace('https:/', 'https://').replace('http:/', 'http://');
  if (BLOCKED_IMAGE_URLS.has(lower) || BLOCKED_IMAGE_URLS.has(normalized)) return true;
  if (lower.startsWith('data:') || lower.startsWith('blob:')) return true;
  if (lower.endsWith('.svg') || lower.includes('/s/sash/')) return true;
  return false;
}

function filterReviewPhotosForSite(photos, productUrl) {
  const isAmazon = /amazon\./i.test(productUrl);
  return [...new Set(photos || [])]
    .filter(src => isAmazon ? _isReviewPhotoUrl(src) : (src && src.startsWith('http') && !_isUIElement(src)))
    .slice(0, REVIEW_PHOTO_LIMIT);
}

async function getCachedReviewPhotos(productUrl) {
  const d = await chrome.storage.local.get(REVIEW_PHOTO_CACHE_KEY);
  const cache = d[REVIEW_PHOTO_CACHE_KEY] || {};
  const hit = cache[productUrl];
  if (!hit || !Array.isArray(hit.photos)) return null;
  if (Date.now() - hit.timestamp > REVIEW_PHOTO_CACHE_MAX_AGE_MS) return null;
  return filterReviewPhotosForSite(hit.photos, productUrl);
}

async function cacheReviewPhotos(productUrl, photos) {
  const d = await chrome.storage.local.get(REVIEW_PHOTO_CACHE_KEY);
  const cache = d[REVIEW_PHOTO_CACHE_KEY] || {};
  cache[productUrl] = {
    timestamp: Date.now(),
    photos: filterReviewPhotosForSite(photos, productUrl)
  };
  const entries = Object.entries(cache)
    .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0))
    .slice(0, 100);
  await chrome.storage.local.set({ [REVIEW_PHOTO_CACHE_KEY]: Object.fromEntries(entries) });
}

async function detectPageFriction(tabId, safeExec) {
  const result = await safeExec(tabId, () => {
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const title = (document.title || '').toLowerCase();
    const text = `${title}\n${bodyText}`;
    const patterns = [
      /captcha/, /robot check/, /enter the characters/, /automated access/,
      /sorry, we just need to make sure/, /access denied/, /unusual traffic/,
      /temporarily unavailable/, /sign in to continue/
    ];
    return patterns.some(p => p.test(text));
  });
  return !!result?.[0]?.result;
}

function _isUIElement(src) {
  if (!src) return true;
  const lower = src.toLowerCase();
  // Block SVGs and Amazon sash/UI assets
  if (isBlockedImageUrl(src)) return true;
  // SHEIN CDN paths that are always UI/promo assets
  if (lower.includes('she_dist/') || lower.includes('images3_srm/') ||
      lower.includes('/psrm/') || lower.includes('/srm/') ||
      lower.includes('/ccc/') || lower.includes('all-color') || lower.includes('she_icon') ||
      lower.includes('sui_icon') || lower.includes('romwe') || lower.includes('aesthetic')) return true;
  return (lower.includes('sprite') || lower.includes('icon') || lower.includes('play-icon') ||
    lower.includes('transparent-pixel') || lower.includes('grey-pixel') ||
    lower.includes('logo') || lower.includes('badge') || lower.includes('cert') ||
    lower.includes('arrow') || lower.includes('button') || lower.includes('chevron') ||
    lower.includes('nav-') || lower.includes('close') || lower.includes('x-mark') ||
    lower.includes('loading') || lower.includes('placeholder') || lower.includes('spinner') ||
    lower.includes('best-books') || lower.includes('editorial') || lower.includes('promo') ||
    lower.includes('banner') || lower.includes('ad-feedback') || lower.includes('avatar') ||
    lower.includes('star-icon') || lower.includes('rating') || lower.includes('checkbox') ||
    lower.includes('radio') || lower.includes('caret') || lower.includes('dropdown') ||
    lower.includes('search') || lower.includes('cart') || lower.includes('wishlist') ||
    lower.includes('share') || lower.includes('flag') || lower.includes('truck') ||
    lower.includes('delivery') || lower.includes('shipping'));
}

function _isReviewPhotoUrl(src) {
  if (!src || !src.startsWith('http')) return false;
  const lower = src.toLowerCase();
  if (isBlockedImageUrl(src)) return false;
  if (!src.includes('/images/I/')) return false;
  return !(lower.includes('sprite') || lower.includes('icon') || lower.includes('play-icon') ||
    lower.includes('transparent-pixel') || lower.includes('grey-pixel') ||
    lower.includes('logo') || lower.includes('badge') || lower.includes('cert') ||
    lower.includes('arrow') || lower.includes('button') || lower.includes('chevron') ||
    lower.includes('nav-') || lower.includes('close') || lower.includes('x-mark') ||
    lower.includes('loading') || lower.includes('placeholder') || lower.includes('spinner') ||
    lower.includes('best-books') || lower.includes('editorial') || lower.includes('promo') ||
    lower.includes('banner') || lower.includes('ad-feedback'));
}

function _amazonFullSize(src) {
  if (!src) return '';
  return src.replace(/\._[A-Za-z0-9_,]+_\./, '.');
}

async function fetchReviewPhotos(productUrl) {
  productUrl = sanitizeHttpUrl(productUrl);
  if (!productUrl) return { success: false, error: 'Enter a valid http(s) URL' };
  const isAmazon = /amazon\./i.test(productUrl);
  const isShein = /shein\./i.test(productUrl);
  if (!isAmazon && !isShein) return { success: false, error: 'Only supported for Amazon and SHEIN' };

  const cachedPhotos = await getCachedReviewPhotos(productUrl);
  if (cachedPhotos?.length) {
    return { success: true, photos: cachedPhotos, cached: true, error: null };
  }

  let tab;
  async function safeExec(tabId, func, args) {
    try {
      const r = await chrome.scripting.executeScript({ target: { tabId }, func, ...(args ? { args } : {}) });
      return r;
    } catch (e) {
      if (e.message?.includes('No tab with id') || e.message?.includes('Cannot access')) return null;
      throw e;
    }
  }
  async function safeRemoveTab(t) {
    try { if (t?.id) await chrome.tabs.remove(t.id); } catch {}
  }
  try {
    tab = await chrome.tabs.create({ url: productUrl, active: false });

    await waitForTabComplete(tab.id, 25000, 3000);
    await _delayRange(2500, 4000);

    if (await detectPageFriction(tab.id, safeExec)) {
      await safeRemoveTab(tab);
      return { success: false, error: 'Stopped because the site showed a verification or access page' };
    }

    // --- SHEIN branch ---
    if (isShein) {
      for (let round = 0; round < SHEIN_LOAD_MORE_LIMIT; round++) {
        const clicked = await safeExec(tab.id, () => {
            const btns = document.querySelectorAll('button, a, span, div');
            for (const b of btns) {
              const txt = (b.textContent || '').trim().toLowerCase();
              if ((txt.includes('view more') && txt.includes('review')) || txt === 'view more' || txt === 'load more' ||
                  (txt.includes('more') && b.closest('[class*="review"], [class*="comment"]'))) {
                b.scrollIntoView({ behavior: 'instant', block: 'center' });
                b.click();
                return true;
              }
            }
            return false;
          });
        if (!clicked?.[0]?.result) break;
        await _delayRange(2500, 4500);
        if (await detectPageFriction(tab.id, safeExec)) break;
      }

      await _delayRange(1500, 2500);

      const sheinResult = await safeExec(tab.id, () => {
          function isRealPhoto(src, img) {
            if (!src || !src.startsWith('http') || src.startsWith('data:')) return false;
            const l = src.toLowerCase();
            if (l.endsWith('.svg') || l.includes('/s/sash/')) return false;
            if (l.includes('she_dist/') || l.includes('images3_srm/') ||
              l.includes('/psrm/') || l.includes('/srm/') || l.includes('/ccc/') ||
              l.includes('all-color') || l.includes('she_icon') ||
              l.includes('sui_icon') || l.includes('romwe') || l.includes('aesthetic')) return false;
            if (l.includes('icon') || l.includes('logo') || l.includes('avatar') ||
              l.includes('star') || l.includes('arrow') || l.includes('badge') ||
              l.includes('button') || l.includes('chevron') || l.includes('sprite') ||
              l.includes('flag') || l.includes('cart') || l.includes('wishlist') ||
              l.includes('share') || l.includes('search') || l.includes('nav') ||
              l.includes('caret') || l.includes('dropdown') || l.includes('checkbox') ||
              l.includes('placeholder') || l.includes('loading') || l.includes('spinner') ||
              l.includes('banner') || l.includes('coupon') || l.includes('promo') ||
              l.includes('sale') || l.includes('social') || l.includes('twitter') ||
              l.includes('facebook') || l.includes('pinterest') || l.includes('instagram') ||
              l.includes('tiktok') || l.includes('youtube') || l.includes('club') ||
              l.includes('truck') || l.includes('delivery') || l.includes('shipping') ||
              l.includes('return')) return false;
            if (img) {
              const w = img.naturalWidth || img.width || 0;
              const h = img.naturalHeight || img.height || 0;
              if ((w > 0 && w < 50) || (h > 0 && h < 50)) return false;
              if (w > 0 && h > 0 && (w / h > 3 || h / w > 3)) return false;
            }
            return true;
          }

          const productImgs = new Set();
          const intro = document.querySelector('.product-intro, [class*="product-intro"]');
          if (intro) {
            intro.querySelectorAll('img').forEach(img => {
              const src = img.src || img.dataset?.src || '';
              if (src) productImgs.add(src);
            });
          }

          const photos = [];
          const seen = new Set();
          const reviewContainers = document.querySelectorAll('[class*="review-con"], [class*="comment-con"], [class*="review-item"], [class*="j-expose__common-reviews"]');
          const scope = reviewContainers.length > 0 ? reviewContainers : document.querySelectorAll('[class*="review"], [class*="comment"]');
          scope.forEach(container => {
            container.querySelectorAll('img').forEach(img => {
              const src = img.src || img.dataset?.src || '';
              if (!isRealPhoto(src, img)) return;
              if (productImgs.has(src)) return;
              if (seen.has(src)) return;
              seen.add(src);
              photos.push(src);
            });
          });
          return photos;
      });

      await safeRemoveTab(tab);
      const photos = filterReviewPhotosForSite(sheinResult?.[0]?.result || [], productUrl);
      if (photos.length) await cacheReviewPhotos(productUrl, photos);
      return { success: photos.length > 0, photos, error: photos.length ? null : 'No review photos found on SHEIN' };
    }

    // --- Amazon branch ---
    // Step 1: Find and click "See all" link
    const step1 = await safeExec(tab.id, () => {
        const sectionPatterns = [
          /customer\s*(photos|images)\s*(and|&)?\s*videos?/i,
          /reviews?\s*with\s*(images|photos)/i,
          /images?\s*in\s*this\s*review/i,
          /customer\s*(images|photos)/i,
          /photo\s*gallery/i
        ];
        const headings = document.querySelectorAll('h2, h3, h4, span, div, p');
        for (const h of headings) {
          const txt = (h.textContent || '').trim();
          if (txt.length > 150) continue;
          if (!sectionPatterns.some(p => p.test(txt))) continue;
          let container = h.parentElement;
          for (let i = 0; i < 10 && container; i++) {
            for (const a of container.querySelectorAll('a, button, [role="button"]')) {
              const atxt = (a.textContent || '').trim().toLowerCase();
              if (atxt.includes('see all') || atxt.includes('see more') || atxt.includes('view all')) {
                a.scrollIntoView({ behavior: 'instant', block: 'center' });
                a.click();
                return { clicked: true };
              }
            }
            container = container.parentElement;
          }
          break;
        }
        for (const a of document.querySelectorAll('a, button, [role="button"]')) {
          const atxt = (a.textContent || '').trim();
          if (atxt.length < 80 && /see\s+(all|more)\s*(customer\s*)?(photos|images|reviews)/i.test(atxt)) {
            a.scrollIntoView({ behavior: 'instant', block: 'center' });
            a.click();
            return { clicked: true };
          }
        }
        const reviewImgTile = document.querySelector(
          '[data-hook="review-image-tile"] img, .cr-media-gallery img, ' +
          '#cm-cr-dp_d_media_gallery img, .reviews-content img[src*="/images/I/"], ' +
          '#customerImageGallery img, .review-image-tile-section img'
        );
        if (reviewImgTile) {
          const clickTarget = reviewImgTile.closest('a, button, [role="button"]') || reviewImgTile;
          clickTarget.scrollIntoView({ behavior: 'instant', block: 'center' });
          clickTarget.click();
          return { clicked: true };
        }
        return { clicked: false };
    });

    if (!step1?.[0]?.result?.clicked) {
      const fallback = await safeExec(tab.id, () => {
          const photos = [];
          const seen = new Set();
          function addPhoto(src) {
            if (!src || !src.startsWith('http')) return;
            const l = src.toLowerCase();
            if (l.endsWith('.svg') || l.includes('/s/sash/') || l.includes('sprite') ||
                l.includes('icon') || l.includes('logo') || l.includes('badge') ||
                l.includes('arrow') || l.includes('button') || l.includes('placeholder') ||
                l.includes('loading') || l.includes('transparent-pixel') || l.includes('grey-pixel')) return;
            const full = src.replace(/\._[A-Za-z0-9_,]+_\./, '.');
            if (seen.has(full)) return;
            seen.add(full);
            photos.push(full);
          }
          const selectors = [
            '[data-hook="review-image-tile"] img', '[data-hook="review-body"] img',
            '.cr-media-gallery img', '#cm-cr-dp_d_media_gallery img',
            '#customerImageGallery img', '.review-image-tile-section img',
            '.reviews-content img', '[data-hook="cr-media-gallery-images"] img',
            '.a-section .review img[src*="/images/I/"]',
            '#cm_cr-review_list img[src*="/images/I/"]',
            '.review img[src*="/images/I/"]'
          ];
          for (const sel of selectors) {
            document.querySelectorAll(sel).forEach(img => {
              addPhoto(img.src);
              if (img.dataset?.src) addPhoto(img.dataset.src);
            });
          }
          return photos;
      });
      await safeRemoveTab(tab);
      const photos = filterReviewPhotosForSite(fallback?.[0]?.result || [], productUrl);
      return { success: photos.length > 0, photos, error: photos.length ? null : 'No review photos found on this page' };
    }

    if (await detectPageFriction(tab.id, safeExec)) {
      await safeRemoveTab(tab);
      return { success: false, error: 'Stopped because the site showed a verification or access page' };
    }

    // Step 2: Wait for gallery modal to load
    await _delayRange(3500, 5000);

    // Step 3: Collect all thumbnail images from the gallery
    const step3 = await safeExec(tab.id, () => {
        function isOk(src) {
          if (!src || !src.startsWith('http') || !src.includes('/images/I/')) return false;
          const l = src.toLowerCase();
          if (l.endsWith('.svg') || l.includes('/s/sash/')) return false;
          return !(l.includes('sprite') || l.includes('icon') || l.includes('play-icon') ||
            l.includes('transparent-pixel') || l.includes('grey-pixel') ||
            l.includes('logo') || l.includes('badge') || l.includes('cert') ||
            l.includes('arrow') || l.includes('button') || l.includes('chevron') ||
            l.includes('nav-') || l.includes('close') || l.includes('x-mark') ||
            l.includes('loading') || l.includes('placeholder') || l.includes('spinner') ||
            l.includes('best-books') || l.includes('editorial') || l.includes('promo') ||
            l.includes('banner') || l.includes('ad-feedback'));
        }
        function fullSize(src) { return (src || '').replace(/\._[A-Za-z0-9_,]+_\./, '.'); }

        const gallery = document.querySelector(
          '.a-popover-modal, .a-popover-wrapper, .cr-lightbox-container, ' +
          '[data-cel-widget*="image-gallery"], #reviews-image-gallery-container'
        ) || document.body;

        const seen = new Set();
        const thumbs = [];
        gallery.querySelectorAll('img').forEach(img => {
          if (!isOk(img.src)) return;
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          if ((w > 0 && w < 30) || (h > 0 && h < 30)) return;
          if (w > 0 && h > 0 && (w / h > 4 || h / w > 4)) return;
          const base = fullSize(img.src);
          if (seen.has(base)) return;
          seen.add(base);
          thumbs.push(base);
        });
        return thumbs;
    });

    const thumbUrls = (step3?.[0]?.result || []).slice(0, REVIEW_PHOTO_LIMIT);

    // Step 4: Click through gallery to get full-size versions
    const allPhotos = new Set();

    if (thumbUrls.length > 0) {
      const clickTest = await safeExec(tab.id, (thumbIdx) => {
          const gallery = document.querySelector(
            '.a-popover-modal, .a-popover-wrapper, .cr-lightbox-container, ' +
            '[data-cel-widget*="image-gallery"]'
          ) || document.body;
          const imgs = [...gallery.querySelectorAll('img')].filter(img => {
            const src = img.src || '';
            if (!src.includes('/images/I/') || src.toLowerCase().endsWith('.svg')) return false;
            return (img.naturalWidth || img.width || 0) >= 30;
          });
          if (imgs[thumbIdx]) {
            const target = imgs[thumbIdx].closest('a, button, [role="button"]') || imgs[thumbIdx];
            target.click();
            return true;
          }
          return false;
      }, [0]);

      if (clickTest?.[0]?.result) {
        await _delayRange(2500, 4000);

        const fullImg = await safeExec(tab.id, () => {
            function isOk(src) {
              if (!src || !src.startsWith('http') || !src.includes('/images/I/')) return false;
              const l = src.toLowerCase();
              if (l.endsWith('.svg') || l.includes('/s/sash/')) return false;
              return !(l.includes('sprite') || l.includes('icon') || l.includes('arrow') ||
                l.includes('button') || l.includes('chevron') || l.includes('logo') ||
                l.includes('badge') || l.includes('nav-') || l.includes('close') ||
                l.includes('banner') || l.includes('best-books') || l.includes('editorial'));
            }
            const selectors = [
              '.cr-lightbox-image-view img', '.a-image-viewer img',
              '.image-viewer img', '.review-image-overlay img', '.a-popover-content img',
            ];
            for (const sel of selectors) {
              const img = document.querySelector(sel);
              if (img && isOk(img.src) && (img.naturalWidth || img.width || 0) > 150) {
                return { found: true, src: img.src.replace(/\._[A-Za-z0-9_,]+_\./, '.') };
              }
            }
            for (const img of document.querySelectorAll('.a-popover-modal img, .a-popover-wrapper img')) {
              if (isOk(img.src) && (img.naturalWidth || img.width || 0) > 200) {
                return { found: true, src: img.src.replace(/\._[A-Za-z0-9_,]+_\./, '.') };
              }
            }
            return { found: false };
        });

        if (fullImg?.[0]?.result?.found) {
          allPhotos.add(fullImg[0].result.src);

          const clickLimit = Math.min(thumbUrls.length, REVIEW_GALLERY_CLICK_LIMIT);
          for (let i = 1; i < clickLimit; i++) {
            const nextResult = await safeExec(tab.id, () => {
                const nextBtn = document.querySelector(
                  '.cr-lightbox-next-button, [class*="next"], [aria-label="Next image"], ' +
                  '[data-action="cr-lightbox-navigate-next"], .a-carousel-goto-nextpage'
                );
                if (nextBtn) { nextBtn.click(); return true; }
                return false;
            });
            if (!nextResult?.[0]?.result) break;
            await _delayRange(2500, 4500);
            if (await detectPageFriction(tab.id, safeExec)) break;

            const nextImg = await safeExec(tab.id, () => {
                function isOk(src) {
                  if (!src || !src.startsWith('http') || !src.includes('/images/I/')) return false;
                  const l = src.toLowerCase();
                  if (l.endsWith('.svg') || l.includes('/s/sash/')) return false;
                  return !(l.includes('sprite') || l.includes('icon') || l.includes('arrow') ||
                    l.includes('button') || l.includes('chevron') || l.includes('logo') ||
                    l.includes('badge') || l.includes('nav-') || l.includes('close') ||
                    l.includes('banner') || l.includes('best-books') || l.includes('editorial'));
                }
                const selectors = ['.cr-lightbox-image-view img', '.a-image-viewer img', '.image-viewer img', '.a-popover-content img'];
                for (const sel of selectors) {
                  const img = document.querySelector(sel);
                  if (img && isOk(img.src) && (img.naturalWidth || img.width || 0) > 150) {
                    return img.src.replace(/\._[A-Za-z0-9_,]+_\./, '.');
                  }
                }
                for (const img of document.querySelectorAll('.a-popover-modal img, .a-popover-wrapper img')) {
                  if (isOk(img.src) && (img.naturalWidth || img.width || 0) > 200) {
                    return img.src.replace(/\._[A-Za-z0-9_,]+_\./, '.');
                  }
                }
                return null;
            });

            if (nextImg?.[0]?.result) {
              const prevSize = allPhotos.size;
              allPhotos.add(nextImg[0].result);
              if (allPhotos.size === prevSize) break;
            }
          }
        }
      }
    }

    if (allPhotos.size === 0) {
      for (const url of thumbUrls) {
        if (allPhotos.size >= REVIEW_PHOTO_LIMIT) break;
        if (_isReviewPhotoUrl(url)) allPhotos.add(_amazonFullSize(url));
      }
    }

    await safeRemoveTab(tab);
    const photos = filterReviewPhotosForSite([...allPhotos], productUrl);
    if (photos.length) await cacheReviewPhotos(productUrl, photos);
    return { success: photos.length > 0, photos, error: photos.length ? null : 'No review photos found' };
  } catch (e) {
    await safeRemoveTab(tab);
    return { success: false, error: e.message || 'Failed to fetch review photos' };
  }
}

// --- Auto-paste prompt into AI service after page loads ---
const AI_DOMAINS = {
  chatgpt: 'chatgpt.com',
  claude: 'claude.ai',
  gemini: 'gemini.google.com',
  copilot: 'copilot.microsoft.com',
  perplexity: 'perplexity.ai',
  grok: 'grok.com',
  deepseek: 'chat.deepseek.com',
  metaai: 'meta.ai',
  mistral: 'chat.mistral.ai',
  poe: 'poe.com',
};

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  try {
    const data = await chrome.storage.local.get('shopscout_paste_pending');
    const job = data.shopscout_paste_pending;
    if (!job || !job.prompt) return;

    // Expire stale jobs (older than 60 seconds)
    if (Date.now() - job.timestamp > 60000) {
      await chrome.storage.local.remove('shopscout_paste_pending');
      return;
    }

    // Check if this tab's URL matches the expected AI service domain
    const expectedDomain = AI_DOMAINS[job.serviceId];
    if (!expectedDomain || !tabUrlMatchesHost(tab.url, expectedDomain)) return;

    // Clear the job immediately so it doesn't fire again
    await chrome.storage.local.remove('shopscout_paste_pending');

    // Wait for the page's JS to finish rendering input fields
    await new Promise(r => setTimeout(r, 2500));

    // Inject the paste script
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (prompt, inputSel) => {
        function tryPaste(attempts) {
          if (attempts <= 0) return;

          const selectors = inputSel.split(',').map(s => s.trim());
          let input = null;
          for (const sel of selectors) {
            input = document.querySelector(sel);
            if (input) break;
          }

          if (!input) {
            setTimeout(() => tryPaste(attempts - 1), 1500);
            return;
          }

          if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
            // Standard text input
            const nativeSet = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
              || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            if (nativeSet) {
              nativeSet.call(input, prompt);
            } else {
              input.value = prompt;
            }
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.focus();
          } else if (input.getAttribute('contenteditable') !== null || input.isContentEditable) {
            // ContentEditable (Claude, Gemini, some others)
            input.focus();
            input.innerHTML = '';

            // Use execCommand for better compatibility with React/ProseMirror
            document.execCommand('insertText', false, prompt);

            // Fallback if execCommand didn't work
            if (!input.textContent.trim()) {
              const lines = prompt.split('\n');
              input.innerHTML = lines.map(l => '<p>' + l.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>').join('');
              input.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }

          // Show a brief toast confirming the paste
          const toast = document.createElement('div');
          toast.textContent = '✓ ShopScout prompt pasted';
          Object.assign(toast.style, {
            position: 'fixed', top: '16px', right: '16px', zIndex: '2147483647',
            padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
            fontFamily: '-apple-system, sans-serif', color: '#fff', background: '#15803d',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', transition: 'opacity 0.3s'
          });
          document.body.appendChild(toast);
          setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
        }

        tryPaste(8);
      },
      args: [job.prompt, job.inputSel]
    });
  } catch (e) {
    console.error('ShopScout auto-paste error:', e);
  }
});

function showToast(tabId, msg, isError = false) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (m, e) => {
      const old = document.getElementById('shopscout-toast'); if (old) old.remove();
      const t = document.createElement('div'); t.id = 'shopscout-toast'; t.textContent = m;
      Object.assign(t.style, { position:'fixed',top:'20px',right:'20px',zIndex:'2147483647',padding:'12px 20px',borderRadius:'8px',fontSize:'14px',fontWeight:'600',fontFamily:'-apple-system,sans-serif',color:'#fff',background:e?'#dc2626':'#1e3a8a',boxShadow:'0 4px 12px rgba(0,0,0,0.3)',transition:'opacity 0.3s' });
      document.body.appendChild(t);
      setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
    },
    args: [msg, isError]
  });
}
