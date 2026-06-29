const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadUtils() {
  const utilsPath = path.join(__dirname, '..', 'utils.js');
  const context = {
    window: {},
    location: { href: 'https://shopscout.local/dashboard.html' },
    URL,
    document: {
      createElement() {
        return {
          set textContent(value) {
            this._text = String(value ?? '');
            this.innerHTML = this._text
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
          },
          get textContent() { return this._text || ''; },
          innerHTML: ''
        };
      }
    },
    DOMParser: class {
      parseFromString(text) {
        const hasParseError = !/<\/\w+>\s*$/.test(String(text || '').trim());
        return {
          documentElement: { getAttribute: () => '' },
          querySelector(selector) {
            return selector === 'parsererror' && hasParseError ? {} : null;
          },
          querySelectorAll(selector) {
            if (selector === 'product' && !hasParseError) return [];
            return [];
          }
        };
      }
    },
    Blob,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: fn => fn()
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(utilsPath, 'utf8'), context, { filename: utilsPath });
  return context.window.SS;
}

function loadMonitor() {
  const monitorPath = path.join(__dirname, '..', 'ai-dev-monitor.js');
  const context = { globalThis: {}, window: null, Date };
  context.window = context.globalThis;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(monitorPath, 'utf8'), context, { filename: monitorPath });
  return context.globalThis.ShopScoutAIDevMonitor;
}

function renderProviderGuide(provider) {
  const guidePath = path.join(__dirname, '..', 'ai-provider-guide.js');
  function serialize(node) {
    if (node.nodeType === 3) return node.textContent;
    if (node._html != null) return node._html;
    const attrs = Object.entries(node.attributes || {})
      .map(([key, value]) => ` ${key}="${String(value)}"`)
      .join('');
    return `<${node.tagName.toLowerCase()}${attrs}>${(node.children || []).map(serialize).join('')}</${node.tagName.toLowerCase()}>`;
  }
  function createElement(tag) {
    return {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      attributes: {},
      children: [],
      _html: null,
      set innerHTML(value) { this._html = String(value); },
      get innerHTML() { return this._html != null ? this._html : this.children.map(serialize).join(''); },
      set textContent(value) { this.children = [{ nodeType: 3, textContent: String(value ?? '') }]; this._html = null; },
      appendChild(child) { this._html = null; this.children.push(child); return child; },
      replaceChildren(...children) { this._html = null; this.children = children; },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return this.attributes[name]; }
    };
  }
  const guide = createElement('div');
  const context = {
    URLSearchParams,
    location: { search: '?provider=test' },
    URL,
    document: {
      createElement,
      createTextNode(text) { return { nodeType: 3, textContent: String(text ?? '') }; },
      getElementById(id) {
        return id === 'guide' ? guide : null;
      }
    },
    ShopScoutSanitize: loadSanitizeForGuide(),
    ShopScoutAI: {
      PROVIDERS: [provider],
      getProvider() { return provider; }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(guidePath, 'utf8'), context, { filename: guidePath });
  return guide.innerHTML;
}

function loadSanitizeForGuide() {
  const sanitizePath = path.join(__dirname, '..', 'security', 'sanitize.js');
  const context = {
    globalThis: null,
    location: { href: 'https://shopscout.local/ai-provider-guide.html' },
    URL,
    document: {
      createTextNode(text) { return { nodeType: 3, textContent: String(text ?? '') }; }
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(sanitizePath, 'utf8'), context, { filename: sanitizePath });
  return context.ShopScoutSanitize;
}

/* Task 11 Phase 1: table/rowActionsMenu.js was deleted with the rest
   of the grid layer. The Phase 2 grid will re-implement row actions
   and reattach this kind of safe-open test. */

const SS = loadUtils();

assert.strictEqual(
  SS.esc('<script>alert(1)</script>'),
  '&lt;script&gt;alert(1)&lt;/script&gt;',
  'esc escapes script tags in text contexts'
);
assert.strictEqual(
  SS.escAttr('"><script>alert(1)</script>'),
  '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;',
  'escAttr escapes quotes and markup in attribute contexts'
);

for (const badUrl of [
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'blob:https://example.com/secret',
  'file:///C:/Users/AdminMan/secret.txt'
]) {
  assert.strictEqual(SS.sanitizeUrl(badUrl), '', `sanitizeUrl rejects ${badUrl.split(':')[0]} URLs`);
}

for (const formula of ['=1+1', '+cmd', '-2+3', '@SUM(A1:A2)']) {
  assert.ok(
    SS.escapeCsvField(formula).startsWith(`'${formula[0]}`),
    `escapeCsvField hardens ${formula[0]} formula prefixes`
  );
}

const importedJson = SS.parseImport(JSON.stringify({
  list: 'Unsafe',
  products: [
    {
      title: 'Bad URL product',
      url: 'javascript:alert(1)',
      image: 'data:image/svg+xml,<svg onload=alert(1)>'
    },
    {
      title: 'Good URL product',
      url: 'https://example.com/product?x=1',
      image: 'https://example.com/image.jpg'
    }
  ]
}), 'unsafe.json');
assert.strictEqual(importedJson.imported[0].url, '', 'JSON import strips unsafe product URLs');
assert.strictEqual(importedJson.imported[0].image, '', 'JSON import strips unsafe image URLs');
assert.strictEqual(importedJson.imported[1].url, 'https://example.com/product?x=1', 'JSON import keeps safe product URLs');
assert.strictEqual(importedJson.imported[1].image, 'https://example.com/image.jpg', 'JSON import keeps safe image URLs');

const importedCsv = SS.parseImport('Name,URL,Image\nBad,javascript:alert(1),file:///C:/bad.png\nGood,https://example.com/p,https://example.com/p.jpg', 'unsafe.csv');
assert.strictEqual(importedCsv.imported[0].url, '', 'CSV import strips unsafe product URLs');
assert.strictEqual(importedCsv.imported[0].image, '', 'CSV import strips unsafe image URLs');
assert.strictEqual(importedCsv.imported[1].url, 'https://example.com/p', 'CSV import keeps safe product URLs');
assert.throws(() => SS.parseImport('{bad json', 'bad.json'), /JSON/, 'JSON import rejects malformed data');
assert.throws(() => SS.parseImport('Name\n', 'bad.csv'), /Empty CSV/, 'CSV import rejects empty data');
assert.throws(() => SS.parseImport('<shopscout><product>', 'bad.xml'), /Invalid XML/, 'XML import rejects malformed data');

const providerHtml = renderProviderGuide({
  id: 'test',
  name: 'Unsafe Provider',
  setupType: 'API key',
  roleHint: 'Testing',
  instructions: ['Create a key'],
  defaultModel: 'model',
  keyUrl: 'javascript:alert(1)',
  docsUrl: 'data:text/html,<script>alert(1)</script>'
});
assert.ok(!providerHtml.includes('href="javascript:'), 'provider guide never emits javascript: hrefs');
assert.ok(!providerHtml.includes('href="data:'), 'provider guide never emits data: hrefs');
assert.strictEqual((providerHtml.match(/href="#"/g) || []).length, 2, 'unsafe provider links fall back to inert anchors');

/* row-action safe-open assertions removed with the grid (Task 11
   Phase 1). The new grid will reattach equivalent coverage. */

const Monitor = loadMonitor();
const state = Monitor.createMonitorState({ productIndexes: [0], productCount: 1 });
Monitor.applyProgressEvent(state, {
  type: 'stage-started',
  stage: 'retrieval',
  providerName: 'OpenAI',
  promptSnippet: 'Authorization: Bearer sk-proj-1234567890SECRETKEY',
  responseSnippet: 'Gemini call https://generativelanguage.googleapis.com/v1beta/models/x:generateContent?key=AIzaSy1234567890SECRETKEY',
  error: 'x-api-key: claude-secret-1234567890',
  sourceUrls: ['https://example.com/manual?api_key=secret-value&ok=1']
});
const log = Monitor.buildCopyableLog(state);
const serializedState = JSON.stringify(state);
for (const leaked of ['sk-proj-1234567890SECRETKEY', 'AIzaSy1234567890SECRETKEY', 'claude-secret-1234567890', 'secret-value']) {
  assert.ok(!serializedState.includes(leaked), `monitor state redacts ${leaked}`);
  assert.ok(!log.includes(leaked), `copyable monitor log redacts ${leaked}`);
}
assert.ok(serializedState.includes('[REDACTED]'), 'monitor state marks redacted secrets');

console.log('security-audit.test.js: all assertions passed');
