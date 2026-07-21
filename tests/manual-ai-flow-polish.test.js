const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { read, pageAndStyles } = require('./_helpers');

const html = pageAndStyles('comparison.html', 'comparison.css');
const comparisonJs = read('comparison.js');
const aiSelectJs = read('ai-select.js');
const aiSelectCss = read('ai-select.css');

assert.ok(html.includes('Step 4: Send Prompt'), 'manual AI modal separates assistant/pipeline send step');
assert.ok(html.includes('Step 5: Paste Result Back'), 'manual AI modal separates paste-back step');
assert.ok(html.includes('data-ai-options-tab="send"'), 'manual AI modal has dedicated send tab');
assert.ok(html.includes('data-ai-options-tab="pasteBack"'), 'manual AI modal has dedicated paste-back tab');
assert.ok(html.includes('data-manual-send-mode="assistant"'), 'manual AI send step offers assistant handoff');
assert.ok(html.includes('data-manual-send-mode="pipeline"'), 'manual AI send step offers connected pipeline option');
assert.ok(!html.includes('Step 4: Send &amp; Paste Back'), 'combined send/paste step is removed');
assert.ok(!html.includes('data-ai-options-tab="sendBack"'), 'old combined sendBack tab id is removed');

assert.ok(/\.ai-options-nav-item\s*\{[^}]*border:\s*1px solid var\(--rule\)/.test(html), 'AI left-nav items have a consistent baseline border');
assert.ok(/\.ai-option--payload\s*\{[^}]*align-items:\s*flex-start/.test(html), 'payload option cards top-align radio buttons and content');
assert.ok(/\.ai-option--payload\s*\{[^}]*min-height:\s*112px/.test(html), 'payload option cards use a consistent compact minimum height');
assert.ok(/\.ai-option--payload > span\s*\{[^}]*justify-content:\s*flex-start/.test(html), 'payload option card text starts at the top');

assert.ok(comparisonJs.includes('function manualSendModeInputs'), 'comparison script reads manual send mode radios');
assert.ok(comparisonJs.includes('selectedManualSendModeFromModal'), 'comparison script collects the manual send mode');
assert.ok(comparisonJs.includes("runConnectedAI(run.productIndexes, run.providerId || 'auto', options, promptOptions)"), 'manual pipeline option can reuse the connected AI runner');
assert.ok(comparisonJs.includes("[data-ai-options-tab=\"send\"]"), 'manual flow toggles the dedicated send tab');
assert.ok(comparisonJs.includes("[data-ai-options-tab=\"pasteBack\"]"), 'manual flow toggles the dedicated paste-back tab');
assert.ok(comparisonJs.includes('manual-ai-service-logo-img'), 'dashboard manual AI service cards render logo images');
assert.ok(!comparisonJs.includes('${esc(service.letter)}</span>`'), 'dashboard manual AI service cards no longer render letter avatars');

assert.ok(aiSelectJs.includes('logoPath'), 'ai-select service data includes local logo paths');
assert.ok(aiSelectJs.includes('document.createElement(\'img\')'), 'ai-select renders provider logo images');
assert.ok(aiSelectJs.includes('icons/ai/chatgpt.svg'), 'ai-select uses local provider logo assets');
assert.ok(!aiSelectJs.includes('logo.textContent = svc.letter'), 'ai-select no longer renders letter avatars');
assert.ok(aiSelectCss.includes('.ai-logo img'), 'ai-select CSS sizes provider logo images');

[
  'chatgpt', 'claude', 'gemini', 'copilot', 'perplexity',
  'grok', 'deepseek', 'metaai', 'mistral', 'poe'
].forEach(id => {
  const icon = path.join(__dirname, '..', 'icons', 'ai', `${id}.svg`);
  assert.ok(fs.existsSync(icon), `provider logo exists for ${id}`);
  const svg = fs.readFileSync(icon, 'utf8');
  assert.ok(svg.includes('<svg'), `${id} logo is SVG`);
});

console.log('manual AI flow polish tests passed');
