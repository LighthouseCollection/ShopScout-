#!/usr/bin/env node
/* =============================================================
   Orchestrator for all normalization-library generators.

   Runs each generator in sequence. When a generator writes real
   output it returns row counts + source fingerprints; when the
   vocabulary stub runs it only validates the on-disk file. The
   final BUILD_MANIFEST.json is assembled from those summaries.

   Exits non-zero if any individual generator throws.
   ============================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  outputPath,
  sha256OfString,
  serializeJson,
  writeGeneratedFile,
  nowIso
} = require('./lib');

const schemaOrg = require('./build-schema-org-properties');
const icecatCategoryFeatures = require('./build-icecat-category-features');
const icecatVocabulary = require('./build-icecat-vocabulary');

const MANIFEST_NAME = 'BUILD_MANIFEST.json';

function readGeneratedFingerprint(fileName) {
  const abs = outputPath(fileName);
  const raw = fs.readFileSync(abs, 'utf8');
  return {
    outputBytes: Buffer.byteLength(raw, 'utf8'),
    outputSha256: sha256OfString(raw)
  };
}

async function main() {
  process.stdout.write('=== schemaOrgProperties.json ===\n');
  const s = await schemaOrg.build();
  process.stdout.write(
    `  wrote ${s.outputName}: ${s.rowCount} properties, ${s.outputBytes} bytes\n`
  );

  process.stdout.write('=== icecatCategoryFeatures.json ===\n');
  const c = await icecatCategoryFeatures.build();
  process.stdout.write(
    `  wrote ${c.outputName}: ${c.categoryCount} categories, ` +
    `${c.featureAssociationCount} feature associations, ${c.outputBytes} bytes\n`
  );

  process.stdout.write('=== icecatVocabulary.json (stub) ===\n');
  const v = icecatVocabulary.validate();
  process.stdout.write(
    `  ${v.isFixture ? 'fixture preserved' : 'validated'}: ${v.featureCount} features, ` +
    `${v.vocabularyEntryCount} entries, ${v.outputBytes} bytes\n`
  );

  const schemaOrgFp = readGeneratedFingerprint(s.outputName);
  const catFeatFp = readGeneratedFingerprint(c.outputName);
  const vocabFp = readGeneratedFingerprint(v.outputName);

  const manifest = {
    $schema: 'shopscout://normalization-libraries/build-manifest/v1',
    version: 1,
    buildTool: 'shopscout-build-normalization-libraries',
    buildToolVersion: 1,
    generatedAt: nowIso(),
    sourceCorpus: {
      root: 'data-sources/icecat/',
      junctionTarget: 'D:\\icecat-data\\',
      note: 'Windows directory junction; git-ignored; per-machine local corpus.'
    },
    outputs: {
      'schemaOrgProperties.json': {
        generator: schemaOrg.GENERATOR_NAME,
        generatorVersion: schemaOrg.GENERATOR_VERSION,
        sourceFiles: s.sourceFiles,
        outputBytes: schemaOrgFp.outputBytes,
        outputSha256: schemaOrgFp.outputSha256,
        rowCount: s.rowCount
      },
      'icecatVocabulary.json': {
        generator: icecatVocabulary.GENERATOR_NAME,
        generatorVersion: icecatVocabulary.GENERATOR_VERSION,
        isStub: true,
        outputBytes: vocabFp.outputBytes,
        outputSha256: vocabFp.outputSha256,
        featureCount: v.featureCount,
        vocabularyEntryCount: v.vocabularyEntryCount,
        note: 'Stub — real generation deferred until per-feature vocabulary linkage is implemented. Current output is the hand-authored fixture from Phase 1a (source.generator = manual-fixture-for-codex-unblock).'
      },
      'icecatCategoryFeatures.json': {
        generator: icecatCategoryFeatures.GENERATOR_NAME,
        generatorVersion: icecatCategoryFeatures.GENERATOR_VERSION,
        sourceFiles: c.sourceFiles,
        outputBytes: catFeatFp.outputBytes,
        outputSha256: catFeatFp.outputSha256,
        categoryCount: c.categoryCount,
        featureAssociationCount: c.featureAssociationCount
      }
    }
  };

  const content = serializeJson(manifest);
  writeGeneratedFile(MANIFEST_NAME, content);
  process.stdout.write(`=== ${MANIFEST_NAME} ===\n  wrote ${Buffer.byteLength(content, 'utf8')} bytes\n`);
}

if (require.main === module) {
  main().catch(err => {
    process.stderr.write(`build-all failed: ${err.message}\n`);
    process.stderr.write((err.stack || '') + '\n');
    process.exit(1);
  });
}

void path;
