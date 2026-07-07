#!/usr/bin/env node
/* =============================================================
   Generator: icecatVocabulary.json  (STUB)

   Real generation is deferred. The raw source
   FeatureValuesVocabularyList.xml.gz is a global controlled-value
   dictionary (Group_ID + Key_Value + per-langid translations),
   not a per-feature vocabulary. Building the per-feature
   vocabulary requires cross-referencing:
     - FeaturesList.xml.gz  (feature id -> type + measure)
     - CategoryFeaturesList.xml.gz  (category -> feature id)
     - product XMLs under products/EN/  (feature id -> value id
       usage)
   The last cross-reference is what actually links a feature to
   its practical vocabulary. That is a full pipeline (SAX-parse
   17K product XMLs, tally value ids per feature, cluster).

   For now this stub verifies the on-disk file conforms to the
   amended v1 schema. It does NOT rewrite the file, so a
   Codex-consumable fixture stays in place until a real generator
   lands.

   Exits 0 on valid; exits 1 on schema violation with a message
   describing the mismatch so build-all.js can surface it.
   ============================================================= */
'use strict';

const fs = require('fs');
const {
  outputPath
} = require('./lib');

const GENERATOR_NAME =
  'scripts/build-normalization-libraries/build-icecat-vocabulary.js';
const GENERATOR_VERSION = 0; // stub: does not produce content

const OUTPUT_NAME = 'icecatVocabulary.json';

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
  if (!data.features || typeof data.features !== 'object') {
    throw new Error(`${OUTPUT_NAME}: missing features object`);
  }
  const featureIds = Object.keys(data.features);
  const sortedIds = [...featureIds].sort((a, b) => Number(a) - Number(b));
  if (JSON.stringify(featureIds) !== JSON.stringify(sortedIds)) {
    throw new Error(`${OUTPUT_NAME}: feature keys must be sorted numerically`);
  }
  for (const [id, feature] of Object.entries(data.features)) {
    if (String(feature.featureId) !== id) {
      throw new Error(
        `${OUTPUT_NAME}: feature ${id} has mismatched featureId ${feature.featureId}`
      );
    }
    const canonicals = feature.vocabulary.map(v => v.canonical.toLowerCase());
    if (new Set(canonicals).size !== canonicals.length) {
      throw new Error(
        `${OUTPUT_NAME}: feature ${id} has duplicate canonical values`
      );
    }
    for (const entry of feature.vocabulary) {
      if (entry.aliases.some(a => a.toLowerCase() === entry.canonical.toLowerCase())) {
        throw new Error(
          `${OUTPUT_NAME}: feature ${id} has canonical value in its own aliases`
        );
      }
    }
  }

  return {
    outputName: OUTPUT_NAME,
    outputBytes: Buffer.byteLength(raw, 'utf8'),
    featureCount: featureIds.length,
    vocabularyEntryCount: Object.values(data.features).reduce(
      (n, f) => n + f.vocabulary.length,
      0
    ),
    isFixture: data.source.generator !== GENERATOR_NAME
  };
}

if (require.main === module) {
  try {
    const summary = validate();
    if (summary.isFixture) {
      process.stdout.write(
        `${OUTPUT_NAME}: fixture preserved (stub — real generator TBD). ` +
        `Validated: ${summary.featureCount} features, ${summary.vocabularyEntryCount} entries, ${summary.outputBytes} bytes\n`
      );
    } else {
      process.stdout.write(
        `${OUTPUT_NAME}: validated real generator output. ` +
        `${summary.featureCount} features, ${summary.vocabularyEntryCount} entries, ${summary.outputBytes} bytes\n`
      );
    }
  } catch (err) {
    process.stderr.write(`build-icecat-vocabulary failed: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { validate, GENERATOR_NAME, GENERATOR_VERSION };
