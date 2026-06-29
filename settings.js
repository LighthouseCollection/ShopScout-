var chrome = globalThis.browser || globalThis.chrome;

let aiSettings = null;
let selectedProviderId = 'openai';
let keyVisible = false;

/* Visible confirmation that an auto-save just landed. settings.js has no
   explicit Save button — every persist call funnels through here so the
   user sees that their change was actually written. */
let savedPillTimer = null;
function flashSavedPill() {
  const el = document.getElementById('savedPill');
  if (!el) return;
  el.classList.add('show');
  clearTimeout(savedPillTimer);
  savedPillTimer = setTimeout(() => el.classList.remove('show'), 1400);
}

document.addEventListener('DOMContentLoaded', init);

async function init() {
  aiSettings = await loadAISettings();
  bindEvents();
  renderProviderList();
  renderRoles();
  selectProvider(selectedProviderId);
  await initOpenFactsToggles();
  await initCaptureButtonSettings();
}

/* =============================================================
   Quick Capture Button (FAB) settings
   Stored at chrome.storage.local.shopscout_capture_button:
     { enabled: boolean, hiddenHosts: string[] }
   ============================================================= */
const CAPTURE_BUTTON_KEY = 'shopscout_capture_button';

async function loadCaptureButtonSettings() {
  const stored = await chrome.storage.local.get(CAPTURE_BUTTON_KEY);
  const def = { enabled: true, hiddenHosts: [] };
  return Object.assign(def, stored[CAPTURE_BUTTON_KEY] || {});
}

async function saveCaptureButtonSettings(next) {
  await chrome.storage.local.set({ [CAPTURE_BUTTON_KEY]: next });
  flashSavedPill();
}

function normalizeHostInput(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '';
  /* Accept "https://example.com/path" → "example.com" */
  try { return new URL(v.includes('://') ? v : 'https://' + v).hostname; }
  catch { return v.replace(/^https?:\/\//, '').split('/')[0]; }
}

function renderHiddenHostsList(hosts, onRemove) {
  const list = document.getElementById('hiddenHostsList');
  if (!list) return;
  if (!hosts.length) {
    list.innerHTML = '<span class="hidden-hosts-empty">(none — the button shows everywhere by default)</span>';
    return;
  }
  list.innerHTML = '';
  for (const h of hosts) {
    const chip = document.createElement('span');
    chip.className = 'host-chip';
    chip.textContent = h;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'host-chip-remove';
    btn.setAttribute('aria-label', 'Remove ' + h);
    btn.textContent = '×';
    btn.addEventListener('click', () => onRemove(h));
    chip.appendChild(btn);
    list.appendChild(chip);
  }
}

async function initCaptureButtonSettings() {
  const settings = await loadCaptureButtonSettings();
  const enabled = document.getElementById('captureButtonEnabled');
  const field = document.getElementById('hiddenHostsField');
  const input = document.getElementById('hiddenHostInput');
  const addBtn = document.getElementById('hiddenHostAdd');
  if (!enabled || !field || !input || !addBtn) return;

  function refreshList() { renderHiddenHostsList(settings.hiddenHosts || [], removeHost); }
  async function removeHost(h) {
    settings.hiddenHosts = (settings.hiddenHosts || []).filter(x => x !== h);
    await saveCaptureButtonSettings(settings);
    refreshList();
  }
  async function addHost() {
    const h = normalizeHostInput(input.value);
    if (!h) return;
    if (!Array.isArray(settings.hiddenHosts)) settings.hiddenHosts = [];
    if (!settings.hiddenHosts.includes(h)) settings.hiddenHosts.push(h);
    await saveCaptureButtonSettings(settings);
    input.value = '';
    refreshList();
  }

  enabled.checked = !!settings.enabled;
  field.disabled = !settings.enabled;
  refreshList();

  enabled.addEventListener('change', async () => {
    settings.enabled = enabled.checked;
    field.disabled = !enabled.checked;
    await saveCaptureButtonSettings(settings);
  });
  addBtn.addEventListener('click', addHost);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addHost(); } });
}

/* =============================================================
   Open*Facts enrichment toggles (opt-in)
   Stored at chrome.storage.local.shopscout_openfacts_enrich:
     { enabled, food, beauty, pet, products }
   ============================================================= */
const OPEN_FACTS_KEY = 'shopscout_openfacts_enrich';
const OPEN_FACTS_SOURCES = ['food', 'beauty', 'pet', 'products'];

async function loadOpenFactsSettings() {
  const stored = await chrome.storage.local.get(OPEN_FACTS_KEY);
  const def = { enabled: false, food: true, beauty: true, pet: true, products: true };
  return Object.assign(def, stored[OPEN_FACTS_KEY] || {});
}

async function saveOpenFactsSettings(next) {
  await chrome.storage.local.set({ [OPEN_FACTS_KEY]: next });
  flashSavedPill();
}

async function initOpenFactsToggles() {
  const settings = await loadOpenFactsSettings();
  const enabled = document.getElementById('openFactsEnabled');
  const sources = document.getElementById('openFactsSources');
  if (!enabled || !sources) return;
  enabled.checked = !!settings.enabled;
  sources.disabled = !settings.enabled;
  for (const s of OPEN_FACTS_SOURCES) {
    const cb = document.getElementById('openFacts' + s.charAt(0).toUpperCase() + s.slice(1));
    if (cb) cb.checked = !!settings[s];
  }
  enabled.addEventListener('change', async () => {
    settings.enabled = enabled.checked;
    sources.disabled = !enabled.checked;
    await saveOpenFactsSettings(settings);
  });
  for (const s of OPEN_FACTS_SOURCES) {
    const cb = document.getElementById('openFacts' + s.charAt(0).toUpperCase() + s.slice(1));
    if (cb) cb.addEventListener('change', async () => {
      settings[s] = cb.checked;
      await saveOpenFactsSettings(settings);
    });
  }
}

async function loadAISettings() {
  const stored = await chrome.storage.local.get(ShopScoutAI.AI_STORAGE_KEY);
  return ShopScoutAI.mergeSettings(stored[ShopScoutAI.AI_STORAGE_KEY]);
}

async function saveAISettings() {
  aiSettings = ShopScoutAI.mergeSettings(aiSettings);
  await chrome.storage.local.set({ [ShopScoutAI.AI_STORAGE_KEY]: aiSettings });
  flashSavedPill();
}

function providerConfig(providerId) {
  aiSettings.providers[providerId] = aiSettings.providers[providerId] || {};
  return aiSettings.providers[providerId];
}

function providerStatus(provider) {
  const cfg = providerConfig(provider.id);
  if (provider.adapter === 'manual') return { cls: 'warn', text: 'Manual' };
  if (cfg.enabled && cfg.apiKey) return { cls: 'on', text: 'Ready' };
  if (cfg.enabled) return { cls: 'warn', text: 'Needs key' };
  return { cls: 'off', text: 'Off' };
}

function renderProviderList() {
  const list = document.getElementById('providerList');
  list.innerHTML = ShopScoutAI.PROVIDERS.map(provider => {
    const status = providerStatus(provider);
    return `<button class="provider-card ${provider.id === selectedProviderId ? 'active' : ''}" data-provider="${provider.id}">
      <div class="row">
        <span class="provider-name">${escapeHtml(provider.name)}</span>
        <span class="status ${status.cls}">${escapeHtml(status.text)}</span>
      </div>
      <div class="provider-type">${escapeHtml(provider.setupType)} · ${escapeHtml(provider.roleHint)}</div>
    </button>`;
  }).join('');
}

function renderRoles() {
  const rows = document.getElementById('roleRows');
  rows.innerHTML = ShopScoutAI.STAGES.map(stage => {
    const value = aiSettings.roles[stage.id] || (stage.id === 'secondOpinion' ? '' : 'auto');
    const options = ['auto', ''].concat(ShopScoutAI.PROVIDERS.map(p => p.id)).map(id => {
      const provider = id ? ShopScoutAI.getProvider(id) : null;
      let label = id === 'auto' ? 'Auto (Recommended)' : provider ? provider.shortName : 'None';
      if (provider && !providerConfig(provider.id).enabled) label += ' - not enabled';
      return `<option value="${escapeAttr(id)}"${id === value ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
    return `<div class="role-row">
      <label>${escapeHtml(stage.label)}</label>
      <select data-role="${escapeAttr(stage.id)}">${options}</select>
    </div>`;
  }).join('');
}

function selectProvider(providerId) {
  const provider = ShopScoutAI.getProvider(providerId) || ShopScoutAI.PROVIDERS[0];
  selectedProviderId = provider.id;
  const cfg = providerConfig(provider.id);
  const status = providerStatus(provider);
  keyVisible = false;

  document.getElementById('providerTitle').textContent = provider.name;
  document.getElementById('providerHint').textContent = provider.roleHint;
  document.getElementById('providerStatus').className = `status ${status.cls}`;
  document.getElementById('providerStatus').textContent = status.text;
  document.getElementById('providerEnabled').checked = !!cfg.enabled;
  document.getElementById('apiKeyLabel').textContent = provider.keyLabel || 'API key';
  document.getElementById('apiKeyInput').type = 'password';
  document.getElementById('apiKeyInput').placeholder = provider.keyPlaceholder || '';
  document.getElementById('apiKeyInput').value = cfg.apiKey || '';
  document.getElementById('toggleKey').textContent = 'Show';
  document.getElementById('modelInput').value = cfg.model || provider.defaultModel || '';
  renderModelOptions(provider, cfg.model || provider.defaultModel || '');
  document.getElementById('baseUrlInput').value = cfg.baseUrl || provider.defaultBaseUrl || '';
  document.getElementById('tokenBudgetInput').value = cfg.tokenBudget || '';
  document.getElementById('providerNotes').value = cfg.notes || '';
  document.getElementById('baseUrlField').style.display = provider.defaultBaseUrl ? 'block' : 'none';
  document.getElementById('testProvider').disabled = provider.adapter === 'manual';
  document.getElementById('testResult').className = 'test-result';
  document.getElementById('testResult').textContent = '';
  document.getElementById('guideFrame').src = `ai-provider-guide.html?provider=${encodeURIComponent(provider.id)}`;
  renderTokenUsageSummary();
  renderProviderList();
}

function bindEvents() {
  document.getElementById('providerList').addEventListener('click', e => {
    const card = e.target.closest('[data-provider]');
    if (card) selectProvider(card.dataset.provider);
  });

  document.getElementById('roleRows').addEventListener('change', async e => {
    const sel = e.target.closest('select[data-role]');
    if (!sel) return;
    aiSettings.roles[sel.dataset.role] = sel.value;
    await saveAISettings();
  });

  document.getElementById('saveProvider').addEventListener('click', saveSelectedProvider);
  document.getElementById('testProvider').addEventListener('click', testSelectedProvider);
  document.getElementById('removeKey').addEventListener('click', removeSelectedKey);
  document.getElementById('resetTokenUsage').addEventListener('click', resetTokenUsage);
  document.getElementById('toggleKey').addEventListener('click', toggleKeyVisibility);
  document.getElementById('openKeyPage').addEventListener('click', () => openProviderUrl('keyUrl'));
  document.getElementById('openDocs').addEventListener('click', () => openProviderUrl('docsUrl'));
  document.getElementById('refreshGuide').addEventListener('click', () => selectProvider(selectedProviderId));
  document.getElementById('openDashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('comparison.html') });
  });
  document.getElementById('modelSelect').addEventListener('change', e => {
    const value = e.target.value;
    if (value) document.getElementById('modelInput').value = value;
    updateModelNote();
  });
}

function renderModelOptions(provider, currentModel) {
  const select = document.getElementById('modelSelect');
  const models = provider.models || [];
  const hasCurrent = models.some(model => model.id === currentModel);
  select.innerHTML = [
    ...models.map(model => {
      const suffix = model.recommended ? ' (Recommended)' : model.tier ? ` (${model.tier})` : '';
      return `<option value="${escapeAttr(model.id)}"${model.id === currentModel ? ' selected' : ''}>${escapeHtml(model.label + suffix)}</option>`;
    }),
    `<option value=""${hasCurrent ? '' : ' selected'}>Custom / account-specific model</option>`
  ].join('');
  updateModelNote();
}

function updateModelNote() {
  const provider = ShopScoutAI.getProvider(selectedProviderId);
  const selected = document.getElementById('modelSelect').value;
  const model = (provider?.models || []).find(item => item.id === selected);
  const note = document.getElementById('modelNote');
  if (model) {
    note.textContent = `${model.note || ''} Tier: ${model.tier || 'standard'}.`;
  } else {
    note.textContent = 'Use this when your provider account exposes a newer or custom model name. For most product comparisons, choose the recommended balanced model above.';
  }
}

async function saveSelectedProvider() {
  const provider = ShopScoutAI.getProvider(selectedProviderId);
  const cfg = providerConfig(selectedProviderId);
  cfg.enabled = document.getElementById('providerEnabled').checked;
  cfg.apiKey = document.getElementById('apiKeyInput').value.trim();
  cfg.model = document.getElementById('modelInput').value.trim() || document.getElementById('modelSelect').value || provider.defaultModel || '';
  cfg.baseUrl = document.getElementById('baseUrlInput').value.trim() || provider.defaultBaseUrl || '';
  cfg.tokenBudget = Number(document.getElementById('tokenBudgetInput').value || 0);
  cfg.notes = document.getElementById('providerNotes').value.trim();
  aiSettings.providers[selectedProviderId] = cfg;
  if (cfg.enabled && !aiSettings.defaultProvider) aiSettings.defaultProvider = selectedProviderId;
  await saveAISettings();
  renderProviderList();
  selectProvider(selectedProviderId);
  showTestResult('ok', 'Saved.');
}

async function testSelectedProvider() {
  await saveSelectedProvider();
  const btn = document.getElementById('testProvider');
  btn.disabled = true;
  showTestResult('ok', 'Testing connection...');
  try {
    const result = await chrome.runtime.sendMessage({ action: 'testAIProvider', providerId: selectedProviderId });
    if (result?.success) showTestResult('ok', result.message || 'Connected.');
    else showTestResult('err', result?.error || 'Connection failed.');
  } catch (e) {
    showTestResult('err', e.message || 'Connection failed.');
  } finally {
    btn.disabled = false;
    aiSettings = await loadAISettings();
    renderProviderList();
    renderTokenUsageSummary();
  }
}

async function removeSelectedKey() {
  const cfg = providerConfig(selectedProviderId);
  cfg.apiKey = '';
  cfg.enabled = false;
  cfg.lastTest = null;
  aiSettings.providers[selectedProviderId] = cfg;
  await saveAISettings();
  selectProvider(selectedProviderId);
  showTestResult('ok', 'Key removed.');
}

async function resetTokenUsage() {
  const cfg = providerConfig(selectedProviderId);
  const ok = await ShopScoutUI.confirm(
    'Reset tracked ShopScout token usage for this provider?',
    { title: 'Reset token usage', okLabel: 'Reset' }
  );
  if (!ok) return;
  cfg.tokenUsage = ShopScoutAI.createEmptyTokenUsage();
  aiSettings.providers[selectedProviderId] = cfg;
  await saveAISettings();
  renderTokenUsageSummary();
  renderProviderList();
  showTestResult('ok', 'Token usage reset.');
}

function renderTokenUsageSummary() {
  const summaryEl = document.getElementById('tokenUsageSummary');
  const detailEl = document.getElementById('tokenUsageDetail');
  if (!summaryEl || !detailEl) return;
  const summary = ShopScoutAI.getProviderTokenSummary(aiSettings, selectedProviderId);
  const usage = summary.usage;
  summaryEl.textContent = summary.label;
  detailEl.textContent = `Input ${ShopScoutAI.formatTokenCount(usage.input)} · Output ${ShopScoutAI.formatTokenCount(usage.output)} · Reported ${ShopScoutAI.formatTokenCount(usage.reported)} · Estimated ${ShopScoutAI.formatTokenCount(usage.estimated)} · Requests ${usage.requests}${usage.lastUpdated ? ` · Updated ${new Date(usage.lastUpdated).toLocaleString()}` : ''}`;
}

function toggleKeyVisibility() {
  keyVisible = !keyVisible;
  document.getElementById('apiKeyInput').type = keyVisible ? 'text' : 'password';
  document.getElementById('toggleKey').textContent = keyVisible ? 'Hide' : 'Show';
}

function openProviderUrl(key) {
  const provider = ShopScoutAI.getProvider(selectedProviderId);
  const url = provider?.[key];
  if (url) chrome.tabs.create({ url });
}

function showTestResult(type, message) {
  const result = document.getElementById('testResult');
  result.className = `test-result ${type}`;
  result.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
