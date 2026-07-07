#!/usr/bin/env node
/* =============================================================
   Generator: esciSubstitutes.json  (STUB, real parquet parse deferred)

   Target source:
     data-sources/esci/shopping_queries_dataset_examples.parquet

   Purpose:
     Extract product-id pairs labeled Substitute (esci_label = 'S')
     in Amazon's ESCI dataset. Each pair goes to the output with
     canonical ordering (a < b) and a queryCount aggregating how
     many distinct queries share that substitute label.

   Why stub:
     Node has no built-in parquet reader. Adding a parquet-wasm or
     hyparquet dependency for a Track A minimum-viable slice
     doubles the extension's dev-dep surface for one file. The
     real generator will land when Codex's Track A runtime
     integration is proven against the fixture and we validate
     the shape end-to-end.

   Implementation sketch for the real generator (follow-up):
     1. Read shopping_queries_dataset_examples.parquet
        (~700 MB in parquet; use hyparquet or parquet-wasm; stream row groups).
     2. Filter to rows where esci_label === 'S' AND product_locale === 'us'.
     3. Group by query_id -> Set of product_id. For each pair (a, b)
        within a query's substitute set, canonicalize (a < b) and
        aggregate queryCount.
     4. Emit `substitutePairs` sorted by (a, b).
     5. Cap the emitted pairs (top N by queryCount) if size exceeds
        the SCHEMA.md 20 MB flag.

   For now this stub verifies the fixture on disk conforms to
   SCHEMA.md v1. Exits 0 on valid; exits 1 on schema violation.
   ============================================================= */
'use strict';

const fs = require('fs');
const {
  outputPath
} = require('./lib');

const GENERATOR_NAME =
  'scripts/build-normalization-libraries/build-esci-substitutes.js';
const GENERATOR_VERSION = 0; // stub

const OUTPUT_NAME = 'esciSubstitutes.json';

function validate() {
  const abs = outputPath(OUTPUT_NAME);
  if (!fs.existsSync(abs)) {
    throw new Error(
      `${OUTPUT_NAME} does not exist. Ship a fixture at ${abs} matching ` +
      'SCHEMA.md v1 or run a real generator (not implemented yet).'
    );
  }
  const raw = fs.readFileSync(abs, 'utf8');
  const data = JSON.parse(raw);

  if (data.version !== 1) {
    throw new Error(`${OUTPUT_NAME}: unsupported version ${data.version}`);
  }
  if (!data.source || typeof data.source !== 'object') {
    throw new Error(`${OUTPUT_NAME}: missing source block`);
  }
  if (data.source.license !== 'Apache-2.0') {
    throw new Error(
      `${OUTPUT_NAME}: source.license must be Apache-2.0 (got ${data.source.license})`
    );
  }
  if (!Array.isArray(data.substitutePairs)) {
    throw new Error(`${OUTPUT_NAME}: substitutePairs must be an array`);
  }

  // Invariant checks per SCHEMA.md.
  const seen = new Set();
  let priorA = '';
  let priorB = '';
  for (const pair of data.substitutePairs) {
    if (typeof pair.a !== 'string' || typeof pair.b !== 'string') {
      throw new Error(`${OUTPUT_NAME}: pair.a and pair.b must be strings`);
    }
    if (pair.a >= pair.b) {
      throw new Error(
        `${OUTPUT_NAME}: pair not canonicalized (a < b required): ${pair.a}, ${pair.b}`
      );
    }
    const key = pair.a + '|' + pair.b;
    if (seen.has(key)) {
      throw new Error(`${OUTPUT_NAME}: duplicate pair ${key}`);
    }
    seen.add(key);
    if (pair.a < priorA || (pair.a === priorA && pair.b < priorB)) {
      throw new Error(`${OUTPUT_NAME}: pairs not sorted by (a, b)`);
    }
    priorA = pair.a;
    priorB = pair.b;
    if (typeof pair.queryCount !== 'number' || pair.queryCount < 1) {
      throw new Error(`${OUTPUT_NAME}: queryCount must be >= 1 for ${key}`);
    }
  }

  return {
    outputName: OUTPUT_NAME,
    outputBytes: Buffer.byteLength(raw, 'utf8'),
    substitutePairCount: data.substitutePairs.length,
    isFixture: data.source.generator !== GENERATOR_NAME
  };
}

if (require.main === module) {
  try {
    const summary = validate();
    if (summary.isFixture) {
      process.stdout.write(
        `${OUTPUT_NAME}: fixture preserved (stub — real parquet parser TBD). ` +
        `Validated: ${summary.substitutePairCount} pairs, ${summary.outputBytes} bytes\n`
      );
    } else {
      process.stdout.write(
        `${OUTPUT_NAME}: validated real generator output. ` +
        `${summary.substitutePairCount} pairs, ${summary.outputBytes} bytes\n`
      );
    }
  } catch (err) {
    process.stderr.write(`build-esci-substitutes failed: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { validate, GENERATOR_NAME, GENERATOR_VERSION };
