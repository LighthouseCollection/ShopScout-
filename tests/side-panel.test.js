const assert = require('assert');
const { read } = require('./_helpers');

const chromeManifest = JSON.parse(read('manifest.json'));
const firefoxManifest = JSON.parse(read('manifest.firefox.json'));
const backgroundJs = read('background.js');

assert.ok(chromeManifest.permissions.includes('sidePanel'),
  'Chrome/Edge manifest requests the sidePanel permission');
assert.deepEqual(chromeManifest.side_panel, { default_path: 'popup.html' },
  'Chrome/Edge manifest opens the capture pane as the side panel');
assert.ok(!chromeManifest.action.default_popup,
  'Chrome/Edge action does not keep a default popup that would compete with side-panel opening');
assert.ok(chromeManifest.action.default_title,
  'Chrome/Edge action has an accessible toolbar title');

assert.ok(backgroundJs.includes('setPanelBehavior'),
  'background worker configures side panel action-click behavior');
assert.ok(backgroundJs.includes('openPanelOnActionClick: true'),
  'clicking the extension action opens the side panel');
assert.ok(/chrome\.sidePanel\?\.setPanelBehavior/.test(backgroundJs),
  'side panel setup is guarded for browsers without the API');
const extractStart = backgroundJs.indexOf('async function extractProductFromTab');
const extractEnd = backgroundJs.indexOf('function isCapturableTabUrl', extractStart);
const extractProductFromTab = extractStart >= 0 && extractEnd > extractStart
  ? backgroundJs.slice(extractStart, extractEnd)
  : '';
assert.ok(
  extractProductFromTab.indexOf('chrome.tabs.sendMessage') > -1
    && extractProductFromTab.indexOf('chrome.tabs.sendMessage') < extractProductFromTab.indexOf('ensureContentScript'),
  'bulk tab capture asks an existing content script first and injects only as fallback'
);

assert.ok(!firefoxManifest.permissions.includes('sidePanel'),
  'Firefox manifest does not request unsupported sidePanel permission');
assert.ok(!firefoxManifest.side_panel,
  'Firefox manifest does not include unsupported Chrome side_panel key');
assert.equal(firefoxManifest.action.default_popup, 'popup.html',
  'Firefox keeps popup.html as the toolbar popup fallback');

console.log('side-panel.test.js: all assertions passed');
