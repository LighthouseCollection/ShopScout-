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

console.log('normalization-review-render.test.js: assertions passed');
