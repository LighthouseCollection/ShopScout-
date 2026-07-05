/* Tests for ShopScoutUI primitives.
   Focus area #1: render escaping — the security-critical surface.
   Focus area #2: dom / events / modal / toast / confirm / prompt
     smoke-tested using jsdom-style DOM stubs constructed manually.
   The full DOM-driven dialogs are only verified for plumbing (the
   handle contract); rendering is locked down by the escaping tests.
*/
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---- Minimal browser-shape stub for vm-context loading ---- */
function makeDomCtx() {
  const ctx = {
    console,
    setTimeout, clearTimeout,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    document: {
      body: makeNode('body'),
      createElement: (tag) => makeNode(tag),
      createElementNS: (ns, tag) => makeNode(tag, { ns }),
      createTextNode: (text) => ({ nodeType: 3, textContent: String(text) }),
      addEventListener: () => {},
      removeEventListener: () => {},
      getElementById: () => null,
      activeElement: null,
      querySelector: () => null,
      querySelectorAll: () => []
    }
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  ctx.Node = function Node() {};
  vm.createContext(ctx);
  return ctx;
}

function makeNode(tag, extra) {
  const node = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    children: [],
    childNodes: [],
    style: {},
    classList: makeClassList(),
    attributes: {},
    listeners: {},
    parentNode: null,
    firstChild: null,
    innerHTML: '',
    textContent: '',
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      this.childNodes.push(child);
      this.firstChild = this.childNodes[0];
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter(c => c !== child);
      this.childNodes = this.childNodes.filter(c => c !== child);
      this.firstChild = this.childNodes[0] || null;
      child.parentNode = null;
      return child;
    },
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k] || null; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    contains() { return true; },
    focus() {}
  };
  Object.assign(node, extra || {});
  return node;
}

function makeClassList() {
  const set = new Set();
  return {
    add(...names) { names.forEach(n => set.add(n)); },
    remove(...names) { names.forEach(n => set.delete(n)); },
    toggle(name, force) {
      if (force === true) { set.add(name); return true; }
      if (force === false) { set.delete(name); return false; }
      if (set.has(name)) { set.delete(name); return false; }
      set.add(name); return true;
    },
    contains(name) { return set.has(name); },
    has(name) { return set.has(name); }
  };
}

const ctx = makeDomCtx();
const files = [
  'ui/core/dom.js',
  'ui/core/render.js',
  'ui/core/events.js',
  'ui/modal.js',
  'ui/toast.js',
  'ui/confirmDialog.js',
  'ui/promptDialog.js'
];
for (const file of files) {
  const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInContext(src, ctx, { filename: file });
}

const UI = ctx.ShopScoutUI;
assert.ok(UI, 'ShopScoutUI namespace registered');
assert.ok(UI.dom && UI.dom.elem, 'UI.dom.elem present');
assert.ok(UI.render && UI.render.html, 'UI.render.html present');
assert.ok(UI.render.raw, 'UI.render.raw present');
assert.ok(UI.render.escapeHtml, 'UI.render.escapeHtml present');
assert.ok(UI.events && UI.events.on, 'UI.events.on present');
assert.ok(UI.modal && UI.modal.open, 'UI.modal.open present');
assert.ok(UI.toast && UI.toast.show, 'UI.toast.show present');
assert.ok(typeof UI.confirm === 'function', 'UI.confirm present');
assert.ok(typeof UI.prompt === 'function', 'UI.prompt present');

/* ---- Critical: escaping ----
   The `html` tagged template MUST escape every interpolation by default
   AND must allow opt-in pass-through via raw(). This is the central
   security claim of the UI core. */
const { html, raw, escapeHtml, isTrusted } = UI.render;

const userInput = '<img src=x onerror=alert(1)>';
const userAttr = '"><script>alert(2)</script>';

const out = String(html`<div title="${userAttr}">${userInput}</div>`);
assert.ok(out.includes('&lt;img'),                                'angle bracket escaped in body');
assert.ok(!out.includes('<img src=x'),                            'tag literal does NOT appear unescaped');
assert.ok(out.includes('&quot;'),                                 'attribute quote escaped');
assert.ok(!out.includes('<script>'),                              'embedded script does NOT appear unescaped');
assert.strictEqual(out, '<div title="&quot;&gt;&lt;script&gt;alert(2)&lt;/script&gt;">&lt;img src=x onerror=alert(1)&gt;</div>',
  'full escaped output matches');

/* raw() must opt-out of escaping, and the result of html`` must itself
   be trusted (so nested html`` does not re-escape). */
const trusted = html`<span>nested</span>`;
const nested = String(html`<div>${trusted}</div>`);
assert.strictEqual(nested, '<div><span>nested</span></div>', 'nested html`` passes through unescaped');

const rawOut = String(html`<div>${raw('<i>x</i>')}</div>`);
assert.strictEqual(rawOut, '<div><i>x</i></div>', 'raw() inserts verbatim');

/* Arrays flatten and each item is escaped. */
const items = ['<a>', '<b>'];
const list = String(html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>`);
assert.strictEqual(list, '<ul><li>&lt;a&gt;</li><li>&lt;b&gt;</li></ul>', 'arrays flatten with per-item escaping');

/* null/undefined/false render as empty (not "undefined"). */
assert.strictEqual(String(html`a${null}b${undefined}c${false}d`), 'abcd', 'null/undefined/false → empty');

/* escapeHtml standalone covers the same surface. */
assert.strictEqual(escapeHtml('<&>"\''), '&lt;&amp;&gt;&quot;&#39;', 'escapeHtml covers all 5 chars');
assert.strictEqual(escapeHtml(null), '', 'escapeHtml(null) → empty');
assert.strictEqual(escapeHtml(undefined), '', 'escapeHtml(undefined) → empty');
assert.strictEqual(escapeHtml(0), '0', 'escapeHtml(0) → "0"');

/* isTrusted recognizes raw() and html`` output. */
assert.ok(isTrusted(raw('x')), 'raw() produces trusted');
assert.ok(isTrusted(html`x`),  'html`` produces trusted');
assert.ok(!isTrusted('plain'), 'plain string not trusted');

/* ---- dom.elem builds nodes; attrs and text are safe by construction. ---- */
const node = UI.dom.elem('div', {
  class: 'foo bar',
  text: '<unescaped>',
  attrs: { 'data-x': '"y"' }
});
assert.strictEqual(node.tagName, 'DIV', 'tagName correct');
assert.ok(node.classList.has('foo'), 'class added');
assert.ok(node.classList.has('bar'), 'second class added');
assert.strictEqual(node.textContent, '<unescaped>', 'textContent set directly (browser will not parse as HTML)');
assert.strictEqual(node.getAttribute('data-x'), '"y"', 'attribute set via setAttribute');

/* dom.empty clears children. */
const parent = UI.dom.elem('div');
parent.appendChild(UI.dom.elem('span'));
parent.appendChild(UI.dom.elem('span'));
assert.strictEqual(parent.children.length, 2, 'two children appended');
UI.dom.empty(parent);
assert.strictEqual(parent.children.length, 0, 'empty cleared children');

/* dom.append handles string → text node, arrays flatten. */
const mix = UI.dom.elem('div');
UI.dom.append(mix, ['text', UI.dom.elem('span'), null, false, undefined]);
assert.strictEqual(mix.childNodes.length, 2, 'string + node appended; null/false/undefined skipped');

/* ---- Codex review must-fix: modal.open accepts a Node body via duck
   typing, not `instanceof Node`. Locked down so the contract holds in
   real DOM, jsdom, and vm stubs. ---- */
{
  const bodyNode = UI.dom.elem('p');
  bodyNode.textContent = 'hello';
  const handle = UI.modal.open({
    title: 'T',
    body: bodyNode,
    actions: [{ label: 'OK', value: true, isDefault: true }]
  });
  /* The modal mounts overlay → dialog → [title, body, footer]; the
     body container is the 2nd child of dialog. The bodyNode should
     be inside it. */
  const overlay = handle.root;
  const dialog = overlay.children[0];
  const titleContainer = dialog.children[0];
  assert.ok(titleContainer.children.some(child => child.classList && child.classList.has('ssui-modal-close')),
    'modal title bar includes a top-right close button');
  const bodyContainer = dialog.children[1];
  assert.strictEqual(bodyContainer.children.length, 1, 'modal body mounted exactly one child');
  assert.strictEqual(bodyContainer.children[0], bodyNode, 'modal body uses the passed Node directly');
  handle.close();
}

/* renderInto must NOT silently fall back to target.innerHTML when
   ShopScoutUI.dom is missing — it must throw, keeping setHtml as the
   single grep-able innerHTML sink. */
{
  const savedDom = UI.dom;
  ctx.ShopScoutUI.dom = undefined;
  try {
    UI.render.renderInto({}, UI.render.html`<x>`);
    assert.fail('renderInto without dom should throw');
  } catch (err) {
    assert.ok(/renderInto requires/.test(err.message), 'renderInto throws helpful error when dom missing');
  } finally {
    ctx.ShopScoutUI.dom = savedDom;
  }
}

console.log('ui-core.test.js — all assertions passed');
