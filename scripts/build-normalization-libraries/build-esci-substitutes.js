#!/usr/bin/env node
/* =============================================================
   Generator: esciSubstitutes.json

   Source:
     data-sources/esci/shopping_queries_dataset_examples.parquet

   Purpose:
     Extract product-id pairs labeled Substitute (S) in Amazon's
     Shopping Queries Dataset (ESCI). Runtime uses these as additive
     duplicate/comparison signals, never as automatic merge authority.

   Default behavior:
     - If the parquet source exists, build real output.
     - If it does not exist, validate the current fixture so ordinary
       build-all runs remain portable on machines without the corpus.
   ============================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  outputPath,
  serializeJson,
  sourcePath,
  fileBytes,
  sha256OfFileSync,
  writeGeneratedFile,
  nowIso
} = require('./lib');

const GENERATOR_NAME =
  'scripts/build-normalization-libraries/build-esci-substitutes.js';
const GENERATOR_VERSION = 1;
const OUTPUT_NAME = 'esciSubstitutes.json';
const SOURCE_REL = '..\\esci\\shopping_queries_dataset_examples.parquet';
const SOURCE_DISPLAY = 'data-sources/esci/shopping_queries_dataset_examples.parquet';

function sourceAbsPath() {
  return path.resolve(sourcePath(SOURCE_REL));
}

function normalizeLabel(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase();
  if (text === 's' || text === 'substitute') return 'S';
  return text.toUpperCase();
}

function normalizeLocale(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function normalizeId(value) {
  return String(value == null ? '' : value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function rowValue(row, names) {
  for (const name of names) {
    if (row && row[name] != null && row[name] !== '') return row[name];
  }
  return '';
}

function buildFromRows(rows, options) {
  const opts = options || {};
  const locale = normalizeLocale(opts.locale || 'us');
  const queryProducts = new Map();
  let inputRowCount = 0;

  for (const row of rows || []) {
    inputRowCount += 1;
    if (normalizeLocale(rowValue(row, ['product_locale', 'locale'])) !== locale) continue;
    if (normalizeLabel(rowValue(row, ['esci_label', 'label'])) !== 'S') continue;
    const queryId = String(rowValue(row, ['query_id', 'queryId', 'query'])).trim();
    const productId = normalizeId(rowValue(row, ['product_id', 'productId', 'asin']));
    if (!queryId || !productId) continue;
    if (!queryProducts.has(queryId)) queryProducts.set(queryId, new Set());
    queryProducts.get(queryId).add(productId);
  }

  const pairCounts = new Map();
  for (const products of queryProducts.values()) {
    const ids = Array.from(products).sort();
    if (ids.length < 2) continue;
    for (let i = 0; i < ids.length - 1; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const key = ids[i] + '|' + ids[j];
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }

  const substitutePairs = Array.from(pairCounts.entries())
    .map(([key, queryCount]) => {
      const [a, b] = key.split('|');
      return { a, b, queryCount };
    })
    .sort((left, right) => left.a.localeCompare(right.a) || left.b.localeCompare(right.b));

  return {
    inputRowCount,
    queryCount: Array.from(queryProducts.values()).filter(set => set.size >= 2).length,
    substitutePairs
  };
}

async function readParquetRows(absPath) {
  const { asyncBufferFromFile, parquetReadObjects } = await import('hyparquet');
  const file = await asyncBufferFromFile(absPath);
  return parquetReadObjects({
    file,
    columns: ['query_id', 'product_id', 'product_locale', 'esci_label']
  });
}

function validatePayload(data, fileName) {
  const name = fileName || OUTPUT_NAME;
  if (data.version !== 1) throw new Error(`${name}: unsupported version ${data.version}`);
  if (!data.source || typeof data.source !== 'object') throw new Error(`${name}: missing source block`);
  if (data.source.license !== 'Apache-2.0') {
    throw new Error(`${name}: source.license must be Apache-2.0 (got ${data.source.license})`);
  }
  if (!Array.isArray(data.substitutePairs)) throw new Error(`${name}: substitutePairs must be an array`);

  const seen = new Set();
  let priorA = '';
  let priorB = '';
  for (const pair of data.substitutePairs) {
    if (typeof pair.a !== 'string' || typeof pair.b !== 'string') {
      throw new Error(`${name}: pair.a and pair.b must be strings`);
    }
    if (pair.a >= pair.b) throw new Error(`${name}: pair not canonicalized: ${pair.a}, ${pair.b}`);
    const key = pair.a + '|' + pair.b;
    if (seen.has(key)) throw new Error(`${name}: duplicate pair ${key}`);
    seen.add(key);
    if (pair.a < priorA || (pair.a === priorA && pair.b < priorB)) {
      throw new Error(`${name}: pairs not sorted by (a, b)`);
    }
    priorA = pair.a;
    priorB = pair.b;
    if (typeof pair.queryCount !== 'number' || pair.queryCount < 1) {
      throw new Error(`${name}: queryCount must be >= 1 for ${key}`);
    }
  }
}

async function build(options) {
  const opts = options || {};
  const abs = opts.source || sourceAbsPath();
  if (!fs.existsSync(abs)) {
    if (opts.requireSource) {
      throw new Error(`${SOURCE_DISPLAY} is missing. Download Amazon ESCI parquet corpus before rebuilding.`);
    }
    return validate();
  }

  const rows = opts.rows || await readParquetRows(abs);
  const result = buildFromRows(rows, { locale: opts.locale || 'us' });
  const sourceBytes = fileBytes(abs);
  const payload = {
    $schema: 'shopscout://normalization-libraries/esciSubstitutes/v1',
    version: 1,
    source: {
      vocabulary: 'Amazon Shopping Queries Dataset (ESCI)',
      release: '2022-12',
      url: 'https://github.com/amazon-science/esci-data',
      license: 'Apache-2.0',
      sourceFile: SOURCE_DISPLAY,
      sourceBytes,
      sourceSha256: sha256OfFileSync(abs),
      generatedAt: nowIso(),
      generator: GENERATOR_NAME,
      generatorVersion: GENERATOR_VERSION,
      locale: opts.locale || 'us',
      inputRowCount: result.inputRowCount,
      queryCount: result.queryCount
    },
    substitutePairs: result.substitutePairs
  };

  validatePayload(payload);
  const content = serializeJson(payload);
  writeGeneratedFile(OUTPUT_NAME, content);
  return {
    outputName: OUTPUT_NAME,
    outputBytes: Buffer.byteLength(content, 'utf8'),
    substitutePairCount: payload.substitutePairs.length,
    sourceFiles: [{
      path: SOURCE_DISPLAY,
      bytes: sourceBytes,
      sha256: payload.source.sourceSha256
    }],
    inputRowCount: result.inputRowCount,
    queryCount: result.queryCount,
    isFixture: false
  };
}

function validate() {
  const abs = outputPath(OUTPUT_NAME);
  if (!fs.existsSync(abs)) {
    throw new Error(`${OUTPUT_NAME} does not exist. Run this generator after placing ${SOURCE_DISPLAY}.`);
  }
  const raw = fs.readFileSync(abs, 'utf8');
  const data = JSON.parse(raw);
  validatePayload(data);
  return {
    outputName: OUTPUT_NAME,
    outputBytes: Buffer.byteLength(raw, 'utf8'),
    substitutePairCount: data.substitutePairs.length,
    sourceFiles: data.source.sourceSha256 ? [{
      path: data.source.sourceFile || SOURCE_DISPLAY,
      bytes: data.source.sourceBytes || 0,
      sha256: data.source.sourceSha256
    }] : [],
    inputRowCount: data.source.inputRowCount || 0,
    queryCount: data.source.queryCount || 0,
    isFixture: data.source.generator !== GENERATOR_NAME
  };
}

if (require.main === module) {
  build({ requireSource: process.argv.includes('--require-source') }).then(summary => {
    if (summary.isFixture) {
      process.stdout.write(
        `${OUTPUT_NAME}: fixture preserved because ${SOURCE_DISPLAY} is missing. ` +
        `Validated: ${summary.substitutePairCount} pairs, ${summary.outputBytes} bytes\n`
      );
    } else {
      process.stdout.write(
        `${OUTPUT_NAME}: generated ${summary.substitutePairCount} pairs from ` +
        `${summary.inputRowCount} rows and ${summary.queryCount} substitute query groups\n`
      );
    }
  }).catch(err => {
    process.stderr.write(`build-esci-substitutes failed: ${err.message}\n`);
    process.exit(1);
  });
}

module.exports = {
  build,
  buildFromRows,
  validate,
  GENERATOR_NAME,
  GENERATOR_VERSION
};
