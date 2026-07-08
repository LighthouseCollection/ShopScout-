const assert = require('assert');
const { read } = require('./_helpers');

const source = read('comparison.js');

assert.ok(source.includes('normalizationReviewProjection'),
  'normalization review builds a SlickGrid projection');
assert.ok(source.includes('mountNormalizationReviewGrid'),
  'normalization review mounts through the SlickGrid adapter');
assert.ok(source.includes('globalThis.ShopScoutSlickGridAdapter'),
  'normalization review reads the real SlickGrid adapter runtime');
assert.ok(source.includes('adapter.create(host, normalizationReviewProjection(items)'),
  'normalization review creates the grid through the SlickGrid adapter');

const pageStart = source.indexOf('async function openNormalizationReviewPage');
const pageEnd = source.indexOf('function userRuleRowsHtml', pageStart);
const pageSource = pageStart >= 0 && pageEnd > pageStart ? source.slice(pageStart, pageEnd) : '';

assert.ok(pageSource.includes('id="normalizationReviewGrid"'),
  'normalization review page renders a SlickGrid host');
assert.ok(pageSource.includes('mountNormalizationReviewGrid(items)'),
  'normalization review page mounts the collected items into SlickGrid after rendering');
assert.ok(!pageSource.includes('<table class="normalization-review-table'),
  'normalization review page no longer renders a literal HTML table');
assert.ok(!source.includes('function normalizationReviewRow'),
  'old table-row renderer has been removed');
assert.ok(source.includes('Unmapped means ShopScout did not find a confident library rule yet'),
  'normalization review explains unmapped rule status');
assert.ok(source.includes('Accept alias saves a list-specific user rule'),
  'normalization review explains how accept alias affects user rules');
assert.ok(source.includes('type: \'normalizationProduct\''),
  'normalization review projection uses a structured product cell type');
assert.ok(source.includes('type: \'normalizationPair\''),
  'normalization review projection uses a duplicate-aware raw-to-normalized cell type');
assert.ok(source.includes('type: \'normalizationActions\''),
  'normalization review projection uses a dedicated action cell type');

console.log('normalization-review-render.test.js: assertions passed');
