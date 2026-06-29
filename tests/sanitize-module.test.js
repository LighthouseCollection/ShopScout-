const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sanitizePath = path.join(root, 'security', 'sanitize.js');

function loadSanitize(extra = {}) {
  const context = {
    globalThis: null,
    location: { href: 'https://shopscout.local/page.html' },
    URL,
    document: {
      createElement(tag) {
        return {
          tagName: String(tag || '').toUpperCase(),
          children: [],
          attributes: {},
          textContent: '',
          appendChild(child) { this.children.push(child); return child; },
          replaceChildren(...children) { this.children = children; },
          setAttribute(name, value) { this.attributes[name] = String(value); },
          getAttribute(name) { return this.attributes[name]; }
        };
      }
    },
    ...extra
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(sanitizePath, 'utf8'), context, { filename: sanitizePath });
  return context.globalThis.ShopScoutSanitize;
}

const S = loadSanitize();

assert.ok(S, 'ShopScoutSanitize namespace is exposed');
assert.strictEqual(
  S.escapeHtml('<script>alert("x")</script>'),
  '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
  'escapeHtml escapes text contexts'
);
assert.strictEqual(
  S.escapeAttribute('"><img src=x onerror=alert(1)>'),
  '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;',
  'escapeAttribute escapes attribute-breaking payloads'
);

assert.strictEqual(S.sanitizeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
assert.strictEqual(S.sanitizeUrl('/relative/path'), 'https://shopscout.local/relative/path');
for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:msgbox(1)', 'blob:https://example.com/id', 'file:///C:/x']) {
  assert.strictEqual(S.sanitizeUrl(bad), '', `sanitizeUrl rejects ${bad.split(':')[0]} URLs`);
}
assert.deepStrictEqual(
  Array.from(S.sanitizeUrlList(['https://one.example', 'javascript:alert(1)', 'https://two.example']), url => new URL(url).hostname),
  ['one.example', 'two.example'],
  'sanitizeUrlList drops unsafe entries'
);

const el = { children: [], replaceChildren(...children) { this.children = children; } };
const child = { nodeType: 1 };
S.replaceChildren(el, ['Hello ', child, '<bad>']);
assert.strictEqual(el.children.length, 3, 'replaceChildren inserts text and node values without innerHTML');
assert.strictEqual(el.children[0].textContent, 'Hello ', 'string children become text nodes');
assert.strictEqual(el.children[1], child, 'node children pass through unchanged');
assert.strictEqual(el.children[2].textContent, '<bad>', 'markup-like strings stay text nodes');

const htmlSink = {};
S.setTrustedHtml(htmlSink, '<strong>trusted</strong>');
assert.strictEqual(htmlSink.innerHTML, '<strong>trusted</strong>', 'setTrustedHtml is the named raw HTML sink');
S.setTrustedHtml(htmlSink, null);
assert.strictEqual(htmlSink.innerHTML, '', 'setTrustedHtml clears nullish values');

const comparisonHtml = fs.readFileSync(path.join(root, 'comparison.html'), 'utf8');
const popupHtml = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
const settingsHtml = fs.readFileSync(path.join(root, 'settings.html'), 'utf8');
const guideHtml = fs.readFileSync(path.join(root, 'ai-provider-guide.html'), 'utf8');
const aiSelectHtml = fs.readFileSync(path.join(root, 'ai-select.html'), 'utf8');
for (const [name, html, before] of [
  ['comparison.html', comparisonHtml, 'utils.js'],
  ['popup.html', popupHtml, 'utils.js'],
  ['settings.html', settingsHtml, 'settings.js'],
  ['ai-provider-guide.html', guideHtml, 'ai-provider-guide.js'],
  ['ai-select.html', aiSelectHtml, 'ai-select.js']
]) {
  const sanitizeIndex = html.indexOf('security/sanitize.js');
  const beforeIndex = html.indexOf(`src="${before}"`);
  assert.ok(sanitizeIndex >= 0, `${name} loads security/sanitize.js`);
  assert.ok(beforeIndex >= 0 && sanitizeIndex < beforeIndex, `${name} loads sanitizer before ${before}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const firefoxManifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.firefox.json'), 'utf8'));
for (const [name, mf] of [['manifest.json', manifest], ['manifest.firefox.json', firefoxManifest]]) {
  const scripts = mf.content_scripts[0].js;
  assert.ok(scripts.includes('security/sanitize.js'), `${name} injects sanitizer into content pages`);
  assert.ok(scripts.indexOf('security/sanitize.js') < scripts.indexOf('utils.js'), `${name} injects sanitizer before utils.js`);
}

const buildScript = fs.readFileSync(path.join(root, 'scripts', 'build-extension.ps1'), 'utf8');
assert.ok(buildScript.includes("'security'"), 'build script ships the security directory');

for (const file of ['background.js', 'popup.js']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const sanitizer = source.indexOf("'security/sanitize.js'");
  const utils = source.indexOf("'utils.js'", sanitizer);
  assert.ok(sanitizer >= 0, `${file} includes sanitizer in on-demand injection`);
  assert.ok(utils > sanitizer, `${file} injects sanitizer before utils.js on demand`);
}

console.log('sanitize-module.test.js: all assertions passed');
