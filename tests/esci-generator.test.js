/* Verifies the real ESCI generator transforms row data into canonical
   substitute pairs. This test uses injected rows so it does not require
   the large Amazon parquet corpus on every developer machine. */
'use strict';

const assert = require('assert');
const esci = require('../scripts/build-normalization-libraries/build-esci-substitutes');

assert.strictEqual(esci.GENERATOR_VERSION >= 1, true,
  'ESCI generator is no longer a fixture-only stub');
assert.strictEqual(typeof esci.buildFromRows, 'function',
  'ESCI generator exposes buildFromRows for deterministic tests');

const result = esci.buildFromRows([
  { query_id: 'q1', product_id: 'B002222222', product_locale: 'us', esci_label: 'S' },
  { query_id: 'q1', product_id: 'B001111111', product_locale: 'us', esci_label: 'S' },
  { query_id: 'q1', product_id: 'B003333333', product_locale: 'us', esci_label: 'E' },
  { query_id: 'q2', product_id: 'B001111111', product_locale: 'us', esci_label: 'Substitute' },
  { query_id: 'q2', product_id: 'B002222222', product_locale: 'us', esci_label: 'substitute' },
  { query_id: 'q3', product_id: 'B001111111', product_locale: 'jp', esci_label: 'S' },
  { query_id: 'q3', product_id: 'B004444444', product_locale: 'jp', esci_label: 'S' },
  { query_id: 'q4', product_id: 'B005555555', product_locale: 'us', esci_label: 'S' }
]);

assert.deepStrictEqual(result.substitutePairs, [
  { a: 'B001111111', b: 'B002222222', queryCount: 2 }
], 'US substitute rows aggregate into canonical sorted pairs only');
assert.strictEqual(result.queryCount, 2, 'counts distinct US queries with substitute groups');
assert.strictEqual(result.inputRowCount, 8, 'tracks scanned row count');

console.log('esci-generator.test.js: all assertions passed');
