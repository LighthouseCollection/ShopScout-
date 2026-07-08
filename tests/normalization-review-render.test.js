const assert = require('assert');
const { read } = require('./_helpers');

const source = read('comparison.js');

assert.ok(source.includes('normalizationPairHtml'),
  'normalization review renderer uses a helper for raw-versus-normalized pairs');
assert.ok(source.includes('normalizationValuesMatch'),
  'normalization review renderer checks whether raw and normalized values are identical');

const rowStart = source.indexOf('function normalizationReviewRow');
const rowEnd = source.indexOf('function openNormalizationReviewPage', rowStart);
const rowSource = rowStart >= 0 && rowEnd > rowStart ? source.slice(rowStart, rowEnd) : '';

assert.ok(rowSource.includes('normalizationPairHtml(item.rawField'),
  'field column uses duplicate-aware pair rendering');
assert.ok(rowSource.includes('normalizationPairHtml(item.raw'),
  'value column uses duplicate-aware pair rendering');
assert.ok(!/normalization-review-raw[^`]+normalization-review-arrow[^`]+normalization-review-normal/.test(rowSource),
  'normalization review row no longer hard-codes raw arrow normalized markup for every value');
assert.ok(source.includes('normalization-review-table ss-grid-review-table'),
  'normalization review table opts into the shared grid visual treatment');
assert.ok(source.includes('Unmapped means ShopScout did not find a confident library rule yet'),
  'normalization review explains unmapped rule status');
assert.ok(source.includes('Accept alias saves a list-specific user rule'),
  'normalization review explains how accept alias affects user rules');
assert.ok(source.includes('normalization-review-table-wrap ss-grid-review-wrap'),
  'normalization review wrapper opts into the shared grid wrapper treatment');
assert.ok(rowSource.includes('class="normalization-review-product"'),
  'normalization review product cells use a structured product block');
assert.ok(rowSource.includes('class="normalization-review-actions ss-grid-review-actions"'),
  'normalization review action cells use the compact grid action layout');

console.log('normalization-review-render.test.js: assertions passed');
