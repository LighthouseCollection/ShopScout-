const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.dirname(__dirname);

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

const requiredDocs = [
  'docs/submissions/copy.md',
  'docs/submissions/permissions.md',
  'docs/submissions/release-readiness.md',
  'docs/legal/privacy-policy.md',
  'docs/legal/terms.md',
  'docs/legal/third-party-licenses.md',
  'docs/submissions/chrome/setup.md',
  'docs/submissions/edge/setup.md',
  'docs/submissions/firefox/setup.md'
];

for (const doc of requiredDocs) {
  assert.ok(exists(doc), `${doc} should exist`);
}

for (const browser of ['chrome', 'edge', 'firefox']) {
  for (const size of [16, 48, 128]) {
    assert.ok(
      exists(`docs/submissions/assets/${browser}/icon${size}.png`),
      `${browser} icon${size}.png should exist`
    );
  }
}

const copy = read('docs/submissions/copy.md');
assert.match(copy, /ShopScout is a private product comparison workspace/);
assert.match(copy, /not a coupon injector/i);
assert.match(copy, /Manual AI/);

const privacy = read('docs/legal/privacy-policy.md');
assert.match(privacy, /locally on the user's device/i);
assert.match(privacy, /AI provider/i);
assert.match(privacy, /FrRaphaelMaher@gmail\.com/);

const permissions = read('docs/submissions/permissions.md');
for (const permission of ['activeTab', 'storage', 'unlimitedStorage', 'scripting', 'tabs', 'contextMenus']) {
  assert.match(permissions, new RegExp(`\\\`${permission}\\\``), `${permission} should be documented`);
}

const chromeSetup = read('docs/submissions/chrome/setup.md');
assert.match(chromeSetup, /dist\/chrome/);

const edgeSetup = read('docs/submissions/edge/setup.md');
assert.match(edgeSetup, /dist\/edge/);

const firefoxSetup = read('docs/submissions/firefox/setup.md');
assert.match(firefoxSetup, /dist\/firefox/);

console.log('submission docs tests passed');

