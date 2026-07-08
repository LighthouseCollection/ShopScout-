var chrome = globalThis.browser || globalThis.chrome;

let aiSettings = null;
let selectedProviderId = 'openai';
let keyVisible = false;

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('settingsMount');
  if (mountEl) {
    mount(mountEl);
    return;
  }
  if (document.getElementById('providerList')) init();
});

function settingsNavHtml() {
  return `<nav class="dashboard-settings-card dashboard-settings-nav" aria-label="Settings sections">
    <a href="#aiProvidersCard" data-settings-nav="ai-providers" aria-current="page">
      <strong>AI Providers</strong>
      <span>Enable one or more providers and choose the model ShopScout should use.</span>
    </a>
    <a href="#pipelineRolesCard" data-settings-nav="pipeline-roles">
      <strong>Pipeline Roles</strong>
      <span>Choose which provider handles each stage. Auto uses your enabled providers.</span>
    </a>
    <a href="#captureButtonCard" data-settings-nav="quick-capture">
      <strong>Quick Capture Button</strong>
      <span>Show or hide the one-click capture button on product pages.</span>
    </a>
    <a href="#openFactsCard" data-settings-nav="open-facts">
      <strong>Open*Facts Enrichment</strong>
      <span>Use GTIN/UPC/EAN enrichment from open product databases.</span>
    </a>
  </nav>`;
}

/* Editor form for the currently-expanded provider card. Injected inline
   into the accordion body of the selected provider by renderProviderList.
   Only one instance ever exists in the DOM (only one card is expanded at
   a time), so IDs stay unique.                                          */
function providerEditorFormHtml() {
  return `<div class="dashboard-settings-setup" data-provider-editor>
    <div class="setup-head">
      <div>
        <h3 id="providerTitle">Provider</h3>
        <p id="providerHint"></p>
      </div>
      <div class="spacer"></div>
      <span class="status off" id="providerStatus">Off</span>
    </div>

    <label class="toggle">
      <input type="checkbox" id="providerEnabled">
      Enable this provider
    </label>

    <div class="field">
      <label id="apiKeyLabel">API key</label>
      <div class="key-row">
        <input type="password" id="apiKeyInput" autocomplete="off" spellcheck="false">
        <button class="btn" id="toggleKey" type="button">Show</button>
      </div>
    </div>

    <div class="dashboard-settings-two-col">
      <div class="field">
        <label>Recommended Model</label>
        <select id="modelSelect"></select>
        <div class="model-note" id="modelNote"></div>
      </div>
      <div class="field">
        <label>Custom Model Name</label>
        <input type="text" id="modelInput" spellcheck="false">
      </div>
    </div>

    <div class="dashboard-settings-two-col">
      <div class="field" id="baseUrlField">
        <label>Endpoint / Base URL</label>
        <input type="text" id="baseUrlInput" spellcheck="false">
      </div>
      <div class="field">
        <label>Token Budget</label>
        <input type="number" id="tokenBudgetInput" min="0" step="1000" placeholder="Optional monthly/session budget">
      </div>
    </div>

    <div class="usage-card">
      <h4>Tracked ShopScout Usage</h4>
      <div class="usage-summary" id="tokenUsageSummary">No usage tracked yet.</div>
      <div class="usage-detail" id="tokenUsageDetail">Provider-reported tokens are used when available. Otherwise ShopScout stores a local estimate.</div>
    </div>

    <div class="field">
      <label>Notes</label>
      <textarea id="providerNotes" placeholder="Optional internal note, account name, billing reminder..."></textarea>
    </div>

    <div class="actions">
      <button class="dashboard-primary-action" id="saveProvider" type="button">Save Provider</button>
      <button class="btn success" id="testProvider" type="button">Test Connection</button>
      <button class="btn" id="setupGuideBtn" type="button">Setup Guide</button>
      <button class="btn" id="openKeyPage" type="button">Open Key Page</button>
      <button class="btn" id="openDocs" type="button">Docs</button>
      <button class="btn" id="resetTokenUsage" type="button">Reset Usage</button>
      <button class="btn danger" id="removeKey" type="button">Remove Key</button>
    </div>
    <div class="test-result" id="testResult"></div>
    <div class="security-note">
      API keys are stored in browser extension storage on this machine. Browser storage is convenient, not a password vault. Remove keys anytime from this screen.
    </div>
  </div>`;
}

function settingsShellHtml() {
  return `<section class="dashboard-settings" data-settings-root>
    <header class="dashboard-page-head dashboard-settings-head">
      <div>
        <h2>Settings</h2>
        <p>AI providers, pipeline roles, capture options, and enrichment preferences.</p>
      </div>
      <button class="rb-btn-sm" type="button" data-dashboard-back>Back to Products</button>
    </header>

    <div class="dashboard-settings-layout">
      <aside class="dashboard-settings-left">
        ${settingsNavHtml()}
      </aside>

      <main class="dashboard-settings-main">
        <section class="dashboard-settings-panel" id="aiProvidersCard" data-settings-panel="ai-providers">
          <div class="dashboard-settings-card dashboard-settings-providers">
            <div class="dashboard-settings-section-head">
              <h3>Provider Connections</h3>
              <p>Enable one or more providers and choose the model ShopScout should use. Expand a provider to configure its API key and model.</p>
            </div>
            <div id="providerList" class="dashboard-settings-provider-list"></div>
          </div>
        </section>

        <section class="dashboard-settings-card dashboard-settings-panel" id="pipelineRolesCard" data-settings-panel="pipeline-roles" hidden>
          <div class="dashboard-settings-section-head">
            <h3>Pipeline Roles</h3>
            <p>Choose which provider handles each stage. Auto uses your enabled providers.</p>
          </div>
          <div id="roleRows"></div>
        </section>

        <section class="dashboard-settings-card dashboard-settings-panel" id="captureButtonCard" data-settings-panel="quick-capture" hidden>
          <div class="dashboard-settings-section-head">
            <h3>Quick Capture Button</h3>
            <p>Shows a small orange button in the lower-right corner whenever ShopScout detects a product page. One click adds the product to your active list — no need to open the extension popup.</p>
          </div>
          <label class="toggle-row">
            <input type="checkbox" id="captureButtonEnabled">
            <span>Show capture button on product pages</span>
          </label>
          <fieldset class="hidden-hosts" id="hiddenHostsField">
            <legend>Hidden on these sites</legend>
            <div class="hidden-hosts-list" id="hiddenHostsList">
              <span class="hidden-hosts-empty">(none — the button shows everywhere by default)</span>
            </div>
            <div class="hidden-hosts-add">
              <input type="text" id="hiddenHostInput" placeholder="example.com" autocomplete="off">
              <button type="button" id="hiddenHostAdd" class="btn">Add</button>
            </div>
          </fieldset>
        </section>

        <section class="dashboard-settings-card dashboard-settings-panel" id="openFactsCard" data-settings-panel="open-facts" hidden>
          <div class="dashboard-settings-section-head">
            <h3>Open*Facts Enrichment</h3>
            <p>Optional. When a product page has a GTIN/UPC/EAN, ShopScout can ask the open Open*Facts databases for richer structured data and merge missing fields into the captured product. No personal data is sent — only the barcode.</p>
          </div>
          <label class="toggle-row">
            <input type="checkbox" id="openFactsEnabled">
            <span>Enable Open*Facts enrichment</span>
          </label>
          <fieldset class="openfacts-sources" id="openFactsSources" disabled>
            <legend>Sources</legend>
            <label class="toggle-row"><input type="checkbox" id="openFactsFood"> <span>Open Food Facts (groceries)</span></label>
            <label class="toggle-row"><input type="checkbox" id="openFactsBeauty"> <span>Open Beauty Facts (cosmetics)</span></label>
            <label class="toggle-row"><input type="checkbox" id="openFactsPet"> <span>Open Pet Food Facts (pet food)</span></label>
            <label class="toggle-row"><input type="checkbox" id="openFactsProducts"> <span>Open Products Facts (everything else)</span></label>
          </fieldset>
        </section>
      </main>
    </div>
  </section>`;
}

async function mount(container) {
  if (!container) return;
  setTrustedHtml(container, settingsShellHtml());
  await init();
}

async function init() {
  aiSettings = await loadAISettings();
  bindEvents();
  bindSettingsNav();
  renderProviderList();
  renderRoles();
  showSettingsPanel('ai-providers');
  selectProvider(selectedProviderId);
  await initOpenFactsToggles();
  await initCaptureButtonSettings();
}

function currentSettingsRoot(startNode) {
  return startNode?.closest?.('[data-settings-root]')
    || document.querySelector('[data-settings-root]')
    || document;
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
    setTrustedHtml(list, '<span class="hidden-hosts-empty">(none — the button shows everywhere by default)</span>');
    return;
  }
  setTrustedHtml(list, '');
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

function providerCardState(provider) {
  const cfg = providerConfig(provider.id);
  const enabled = !!cfg.enabled || (provider.adapter === 'manual' && !!cfg.enabled);
  return {
    cls: enabled ? 'provider-state-on' : 'provider-state-off',
    text: enabled ? 'On' : 'Off'
  };
}

function renderProviderList() {
  const list = document.getElementById('providerList');
  if (!list) return;
  setTrustedHtml(list, ShopScoutAI.PROVIDERS.map(provider => {
    const state = providerCardState(provider);
    const expanded = provider.id === selectedProviderId;
    const providerId = ShopScoutSanitize.escapeAttribute(provider.id);
    const guideId = `provider-panel-${providerId}`;
    const model = provider.defaultModel || provider.models?.find(item => item.recommended)?.label || 'User-selected model';
    return `<article class="provider-card ${expanded ? 'active' : ''} provider-card-${state.cls}" data-provider="${providerId}" data-provider-state="${state.cls}">
      <button class="provider-card-toggle" type="button" data-provider-toggle="${providerId}" aria-expanded="${expanded ? 'true' : 'false'}" aria-controls="${guideId}">
        <span>
          <span class="provider-name">${ShopScoutSanitize.escapeHtml(provider.name)}</span>
          <span class="provider-type">${ShopScoutSanitize.escapeHtml(provider.setupType)} · ${ShopScoutSanitize.escapeHtml(model)}</span>
        </span>
        <span class="provider-state ${state.cls}">${ShopScoutSanitize.escapeHtml(state.text)}</span>
      </button>
      <div class="provider-accordion-panel" id="${guideId}" ${expanded ? '' : 'hidden'}>
        ${expanded ? providerEditorFormHtml() : ''}
      </div>
    </article>`;
  }).join(''));
}

function renderRoles() {
  const rows = document.getElementById('roleRows');
  if (!rows) return;
  setTrustedHtml(rows, ShopScoutAI.STAGES.map(stage => {
    const value = aiSettings.roles[stage.id] || (stage.id === 'secondOpinion' ? '' : 'auto');
    const options = ['auto', ''].concat(ShopScoutAI.PROVIDERS.map(p => p.id)).map(id => {
      const provider = id ? ShopScoutAI.getProvider(id) : null;
      let label = id === 'auto' ? 'Auto (Recommended)' : provider ? provider.shortName : 'None';
      if (provider && !providerConfig(provider.id).enabled) label += ' - not enabled';
      return `<option value="${ShopScoutSanitize.escapeAttribute(id)}"${id === value ? ' selected' : ''}>${ShopScoutSanitize.escapeHtml(label)}</option>`;
    }).join('');
    return `<div class="role-row">
      <label>${ShopScoutSanitize.escapeHtml(stage.label)}</label>
      <select data-role="${ShopScoutSanitize.escapeAttribute(stage.id)}">${options}</select>
    </div>`;
  }).join(''));
}

function selectProvider(providerId) {
  const provider = ShopScoutAI.getProvider(providerId) || ShopScoutAI.PROVIDERS[0];
  selectedProviderId = provider.id;
  keyVisible = false;

  /* Render provider list first — this inflates the editor form inside the
     newly expanded card so we can populate its fields below. */
  renderProviderList();
  populateEditorFields(provider);
  bindEditorEvents();
  clearTestResult();
  renderTokenUsageSummary();
}

function populateEditorFields(provider) {
  const cfg = providerConfig(provider.id);
  const status = providerStatus(provider);
  const editor = document.querySelector('[data-provider-editor]');
  if (!editor) return;
  editor.querySelector('#providerTitle').textContent = provider.name;
  editor.querySelector('#providerHint').textContent = provider.roleHint;
  const statusEl = editor.querySelector('#providerStatus');
  statusEl.className = `status ${status.cls}`;
  statusEl.textContent = status.text;
  editor.querySelector('#providerEnabled').checked = !!cfg.enabled;
  editor.querySelector('#apiKeyLabel').textContent = provider.keyLabel || 'API key';
  const apiKeyInput = editor.querySelector('#apiKeyInput');
  apiKeyInput.type = 'password';
  apiKeyInput.placeholder = provider.keyPlaceholder || '';
  apiKeyInput.value = cfg.apiKey || '';
  editor.querySelector('#toggleKey').textContent = 'Show';
  editor.querySelector('#modelInput').value = cfg.model || provider.defaultModel || '';
  renderModelOptions(provider, cfg.model || provider.defaultModel || '');
  editor.querySelector('#baseUrlInput').value = cfg.baseUrl || provider.defaultBaseUrl || '';
  editor.querySelector('#tokenBudgetInput').value = cfg.tokenBudget || '';
  editor.querySelector('#providerNotes').value = cfg.notes || '';
  editor.querySelector('#baseUrlField').style.display = provider.defaultBaseUrl ? 'block' : 'none';
  editor.querySelector('#testProvider').disabled = provider.adapter === 'manual';
}

function bindEvents() {
  document.getElementById('providerList')?.addEventListener('click', e => {
    /* Ignore clicks inside the editor form itself so its own buttons/inputs
       do not double-fire as accordion toggles. */
    if (e.target.closest('[data-provider-editor]')) return;
    const card = e.target.closest('[data-provider-toggle]');
    if (card) selectProvider(card.dataset.providerToggle);
  });

  document.getElementById('roleRows')?.addEventListener('change', async e => {
    const sel = e.target.closest('select[data-role]');
    if (!sel) return;
    aiSettings.roles[sel.dataset.role] = sel.value;
    await saveAISettings();
  });

  if (document.getElementById('settingsMount')) {
    document.querySelector('[data-dashboard-back]')?.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('comparison.html') });
    });
  }
  document.getElementById('openDashboard')?.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('comparison.html') });
  });
}

/* Editor form is re-rendered on each provider switch, so its buttons and
   inputs need fresh listeners each time. renderProviderList replaces the
   accordion DOM entirely, so the old listeners are garbage-collected. */
function bindEditorEvents() {
  const editor = document.querySelector('[data-provider-editor]');
  if (!editor) return;
  editor.querySelector('#saveProvider')?.addEventListener('click', saveSelectedProvider);
  editor.querySelector('#testProvider')?.addEventListener('click', testSelectedProvider);
  editor.querySelector('#removeKey')?.addEventListener('click', removeSelectedKey);
  editor.querySelector('#resetTokenUsage')?.addEventListener('click', resetTokenUsage);
  editor.querySelector('#toggleKey')?.addEventListener('click', toggleKeyVisibility);
  editor.querySelector('#openKeyPage')?.addEventListener('click', () => openProviderUrl('keyUrl'));
  editor.querySelector('#openDocs')?.addEventListener('click', () => openProviderUrl('docsUrl'));
  editor.querySelector('#setupGuideBtn')?.addEventListener('click', openSetupGuideModal);
  editor.querySelector('#modelSelect')?.addEventListener('change', e => {
    const value = e.target.value;
    if (value) editor.querySelector('#modelInput').value = value;
    updateModelNote();
  });
}

function bindSettingsNav() {
  const rootEl = currentSettingsRoot();
  rootEl.querySelectorAll('[data-settings-nav]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      showSettingsPanel(link.getAttribute('data-settings-nav'), rootEl);
    });
  });
}

function showSettingsPanel(panelId, rootEl = currentSettingsRoot()) {
  const id = panelId || 'ai-providers';
  clearTestResult(rootEl);
  rootEl.querySelectorAll('[data-settings-panel]').forEach(panel => {
    panel.hidden = panel.getAttribute('data-settings-panel') !== id;
  });
  rootEl.querySelectorAll('[data-settings-nav]').forEach(link => {
    const active = link.getAttribute('data-settings-nav') === id;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function providerGuideHtml(provider) {
  const instructions = Array.isArray(provider?.instructions) ? provider.instructions : [];
  const links = [
    provider?.keyUrl ? `<a href="${ShopScoutSanitize.escapeAttribute(ShopScoutSanitize.sanitizeUrl(provider.keyUrl))}" target="_blank" rel="noopener noreferrer">Key page</a>` : '',
    provider?.docsUrl ? `<a href="${ShopScoutSanitize.escapeAttribute(ShopScoutSanitize.sanitizeUrl(provider.docsUrl))}" target="_blank" rel="noopener noreferrer">Docs</a>` : ''
  ].filter(Boolean).join(' · ');
  return `<div class="provider-guide-inline"><ol>${instructions.map(step => `<li>${ShopScoutSanitize.escapeHtml(step)}</li>`).join('')}</ol>${links ? `<div class="provider-guide-links">${links}</div>` : ''}</div>`;
}

function openSetupGuideModal() {
  const provider = ShopScoutAI.getProvider(selectedProviderId);
  const trusted = ShopScoutUI.render.html`${ShopScoutUI.render.raw(providerGuideHtml(provider))}`;
  ShopScoutUI.modal.open({
    title: `${provider?.name || 'Provider'} setup guide`,
    body: trusted,
    width: 'min(720px, 92vw)',
    actions: [{ label: 'Close', value: 'close', isDefault: true }]
  });
}

function renderModelOptions(provider, currentModel) {
  const select = document.getElementById('modelSelect');
  const models = provider.models || [];
  const hasCurrent = models.some(model => model.id === currentModel);
  setTrustedHtml(select, [
    ...models.map(model => {
      const suffix = model.recommended ? ' (Recommended)' : model.tier ? ` (${model.tier})` : '';
      return `<option value="${ShopScoutSanitize.escapeAttribute(model.id)}"${model.id === currentModel ? ' selected' : ''}>${ShopScoutSanitize.escapeHtml(model.label + suffix)}</option>`;
    }),
    `<option value=""${hasCurrent ? '' : ' selected'}>Custom / account-specific model</option>`
  ].join(''));
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
    selectProvider(selectedProviderId);
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
  selectProvider(selectedProviderId);
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
  const url = ShopScoutSanitize.sanitizeUrl(provider?.[key]);
  if (url) chrome.tabs.create({ url });
}

function showTestResult(type, message) {
  const result = document.getElementById('testResult');
  if (!result) return;
  result.className = `test-result ${type}`;
  result.textContent = message;
}

function clearTestResult(rootEl = currentSettingsRoot()) {
  const result = rootEl.querySelector?.('#testResult') || document.getElementById('testResult');
  if (!result) return;
  result.className = 'test-result';
  result.textContent = '';
}

function setTrustedHtml(target, html) {
  if (globalThis.ShopScoutSanitize?.setTrustedHtml) {
    globalThis.ShopScoutSanitize.setTrustedHtml(target, html);
    return;
  }
  if (target) target.innerHTML = html == null ? '' : String(html);
}

globalThis.ShopScoutSettings = Object.assign(globalThis.ShopScoutSettings || {}, {
  mount: mount,
  init: init,
  settingsShellHtml: settingsShellHtml
});
