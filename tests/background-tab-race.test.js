const assert = require('assert');
const fs = require('fs');
const path = require('path');

const backgroundJs = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');

assert.ok(/function isMissingTabError\(error\)[\s\S]*No tab with id/.test(backgroundJs),
  'background has a shared missing-tab error classifier');
assert.ok(/async function safeSetBadge[\s\S]*isMissingTabError/.test(backgroundJs),
  'badge updates ignore stale closed-tab errors');
assert.ok(/function showToast\(tabId, msg, isError = false\)[\s\S]*\.catch\([\s\S]*isMissingTabError/.test(backgroundJs),
  'toast injection catches stale closed-tab errors instead of leaving an unhandled promise rejection');
assert.ok(/ShopScout auto-paste error:[\s\S]*isMissingTabError/.test(backgroundJs),
  'AI auto-paste path suppresses stale closed-tab errors after delayed injection');

console.log('background-tab-race.test.js: all assertions passed');
