const assert = require('assert');
const { read } = require('./_helpers');

const source = read('comparison.js');

assert.ok(source.includes('userRulesProjection'),
  'user rules builds a SlickGrid projection');
assert.ok(source.includes('mountUserRulesGrid'),
  'user rules mounts through the SlickGrid adapter');
assert.ok(source.includes('adapter.create(host, userRulesProjection(rules)'),
  'user rules creates the grid through the SlickGrid adapter');

const pageStart = source.indexOf('async function openNormalizationRulesPage');
const pageEnd = source.indexOf('function closeSettingsPage', pageStart);
const pageSource = pageStart >= 0 && pageEnd > pageStart ? source.slice(pageStart, pageEnd) : '';

assert.ok(pageSource.includes('id="userRulesGrid"'),
  'user rules page renders a SlickGrid host');
assert.ok(pageSource.includes('mountUserRulesGrid(rules)'),
  'user rules page mounts approved mappings into SlickGrid after rendering');
assert.ok(!pageSource.includes('<table class="normalization-review-table'),
  'user rules page no longer renders a literal HTML table');
assert.ok(!source.includes('function userRuleRowsHtml'),
  'old user-rule table renderer has been removed');
assert.ok(source.includes('type: \'userRuleActions\''),
  'user rules projection uses a dedicated action cell type');
assert.ok(source.includes('type: \'userRuleCode\''),
  'user rules projection uses a dedicated rule-key cell type');

console.log('normalization-rules-render.test.js: assertions passed');
