const assert = require('assert');
const vm = require('vm');
const { read } = require('./_helpers');

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, active) {
    if (active) this.values.add(name);
    else this.values.delete(name);
  }
  contains(name) { return this.values.has(name); }
}

class FakeElement {
  constructor(doc, id = '') {
    this.ownerDocument = doc;
    this.id = id;
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.style = {};
    this.hidden = false;
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.textContent = '';
    this._html = '';
    if (id) this.attributes.set('id', id);
  }

  set innerHTML(value) {
    this._html = String(value || '');
    this.ownerDocument.indexHtml(this._html);
  }

  get innerHTML() { return this._html; }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'hidden') this.hidden = true;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'hidden') this.hidden = false;
  }

  getAttribute(name) { return this.attributes.get(name) || null; }

  addEventListener(type, handler) { this.listeners.set(type, handler); }

  closest(selector) {
    if (selector === '[data-settings-root]' && this.attributes.has('data-settings-root')) return this;
    if (selector === '[data-settings-nav]' && this.attributes.has('data-settings-nav')) return this;
    if (selector === '[data-settings-dashboard-action]' && this.attributes.has('data-settings-dashboard-action')) return this;
    if (selector === '[data-provider-editor]' && this.attributes.has('data-provider-editor')) return this;
    if (selector === 'select[data-role]' && this.attributes.has('data-role')) return this;
    return null;
  }

  contains() { return true; }

  querySelector(selector) { return this.ownerDocument.querySelector(selector); }

  querySelectorAll(selector) { return this.ownerDocument.querySelectorAll(selector); }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.byData = new Map();
    this.listeners = new Map();
  }

  createElement(id = '') {
    const el = new FakeElement(this, id);
    if (id) this.elements.set(id, el);
    return el;
  }

  addEventListener(type, handler) { this.listeners.set(type, handler); }

  getElementById(id) { return this.elements.get(id) || null; }

  querySelector(selector) {
    if (selector.startsWith('#')) return this.getElementById(selector.slice(1));
    if (selector === '[data-settings-root]') return this.byData.get('data-settings-root')?.[0] || null;
    if (selector === '[data-provider-editor]') return this.byData.get('data-provider-editor')?.[0] || null;
    return null;
  }

  querySelectorAll(selector) {
    if (selector === '[data-settings-panel]') return this.byData.get('data-settings-panel') || [];
    if (selector === '[data-settings-nav]') return this.byData.get('data-settings-nav') || [];
    return [];
  }

  indexHtml(html) {
    const idRegex = /id="([^"]+)"/g;
    let match;
    while ((match = idRegex.exec(html))) {
      if (!this.elements.has(match[1])) this.createElement(match[1]);
    }

    this.indexDataAttr(html, 'data-settings-root');
    this.indexDataAttr(html, 'data-provider-editor');
    this.indexDataAttr(html, 'data-settings-panel');
    this.indexDataAttr(html, 'data-settings-nav');
    this.indexDataAttr(html, 'data-settings-dashboard-action');
    this.indexDataAttr(html, 'data-role');
  }

  indexDataAttr(html, attrName) {
    const results = [];
    const regex = new RegExp(`<[^>]*${attrName}(?:="([^"]*)")?[^>]*>`, 'g');
    let match;
    while ((match = regex.exec(html))) {
      const el = new FakeElement(this);
      el.setAttribute(attrName, match[1] || '');
      if (/\shidden(?:\s|>|=)/.test(match[0])) el.hidden = true;
      results.push(el);
    }
    if (results.length) this.byData.set(attrName, results);
  }
}

function makeSettingsContext() {
  const document = new FakeDocument();
  const container = document.createElement('settingsMount');
  container.setAttribute('data-settings-root', '');
  document.byData.set('data-settings-root', [container]);
  const storage = new Map();
  const ctx = {
    console,
    document,
    chrome: {
      storage: {
        local: {
          async get(key) {
            return typeof key === 'string' ? { [key]: storage.get(key) } : {};
          },
          async set(obj) {
            Object.entries(obj || {}).forEach(([key, value]) => storage.set(key, value));
          }
        }
      },
      tabs: { create() {} },
      runtime: { getURL(path) { return path; } }
    }
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('security/sanitize.js'), ctx, { filename: 'security/sanitize.js' });
  vm.runInContext(read('ai-providers.js'), ctx, { filename: 'ai-providers.js' });
  vm.runInContext(read('settings.js'), ctx, { filename: 'settings.js' });
  return { ctx, document, container };
}

(async () => {
  const { ctx, document, container } = makeSettingsContext();
  await ctx.ShopScoutSettings.mount(container);

  const providerList = document.getElementById('providerList');
  const roleRows = document.getElementById('roleRows');
  assert.ok(providerList.innerHTML.includes('class="provider-card'),
    'AI Providers pane renders provider accordion cards');
  assert.ok(providerList.innerHTML.includes('id="apiKeyInput"'),
    'AI Providers pane renders API key input controls');
  assert.ok(providerList.innerHTML.includes('id="modelSelect"'),
    'AI Providers pane renders model selector controls');
  assert.ok(roleRows.innerHTML.includes('select data-role="retrieval"'),
    'Pipeline Roles pane renders stage provider dropdowns');
  assert.ok(roleRows.innerHTML.includes('Auto (Recommended)'),
    'Pipeline Roles pane includes automatic provider fallback');

  const nav = document.querySelectorAll('[data-settings-nav]')
    .find(item => item.getAttribute('data-settings-nav') === 'pipeline-roles');
  const rootClick = container.listeners.get('click');
  assert.ok(typeof rootClick === 'function', 'settings left navigation binds delegated click handler');
  rootClick({
    target: nav,
    preventDefault() { this.prevented = true; }
  });
  const pipelinePanel = document.querySelectorAll('[data-settings-panel]')
    .find(item => item.getAttribute('data-settings-panel') === 'pipeline-roles');
  assert.strictEqual(pipelinePanel.hidden, false,
    'clicking Pipeline Roles left-nav item shows the Pipeline Roles controls pane');

  console.log('settings-render.test.js: assertions passed');
})();
