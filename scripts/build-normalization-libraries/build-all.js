#!/usr/bin/env node
/* =============================================================
   Orchestrator for all normalization-library generators.

   Runs each generator in sequence. Each real-output generator returns
   row counts + source fingerprints. Stub-only generators still validate
   their on-disk fixture. The final BUILD_MANIFEST.json is assembled
   from those summaries.

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
const esciSubstitutes = require('./build-esci-substitutes');
const verticalMapping = require('./build-vertical-mapping');

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
  const forceCategoryRebuild = process.env.SHOPSCOUT_REBUILD_CATEGORY_FEATURES === '1';
  const c = forceCategoryRebuild
    ? await icecatCategoryFeatures.build()
    : icecatCategoryFeatures.validate();
  process.stdout.write(
    `  ${forceCategoryRebuild ? 'wrote' : 'validated cached'} ${c.outputName}: ${c.categoryCount} categories, ` +
    `${c.featureAssociationCount} feature associations, ${c.outputBytes} bytes\n`
  );

  process.stdout.write('=== icecatVocabulary.json ===\n');
  const forceVocabularyRebuild = process.env.SHOPSCOUT_REBUILD_ICECAT_VOCABULARY === '1';
  const v = forceVocabularyRebuild
    ? icecatVocabulary.build()
    : icecatVocabulary.validate();
  process.stdout.write(
    `  ${forceVocabularyRebuild ? 'wrote' : 'validated cached'} ${v.outputName}: ${v.featureCount} features, ` +
    `${v.vocabularyEntryCount} entries` +
    `${forceVocabularyRebuild ? ' from ' + v.productFileCount + ' product XML files' : ''}, ` +
    `${v.outputBytes} bytes\n`
  );

  process.stdout.write('=== esciSubstitutes.json ===\n');
  const e = await esciSubstitutes.build();
  process.stdout.write(
    `  ${e.isFixture ? 'fixture preserved' : 'generated'}: ${e.substitutePairCount} pairs, ` +
    `${e.outputBytes} bytes\n`
  );

  process.stdout.write('=== icecat_category_to_vertical.json + verticals-index.json ===\n');
  const vm = verticalMapping.build();
  process.stdout.write(
    `  wrote icecat_category_to_vertical.json: ${vm.totalMapped}/${vm.totalCategories} categories mapped across ${vm.verticals} verticals\n`
  );
  process.stdout.write(
    `  wrote verticals-index.json: ${vm.indexBytes} bytes (packUrl/packBytes/packSha256 will be filled by pack splitter)\n`
  );

  const schemaOrgFp = readGeneratedFingerprint(s.outputName);
  const catFeatFp = readGeneratedFingerprint(c.outputName);
  const vocabFp = readGeneratedFingerprint(v.outputName);
  const esciFp = readGeneratedFingerprint(e.outputName);
  const mappingFp = readGeneratedFingerprint('icecat_category_to_vertical.json');
  const indexFp = readGeneratedFingerprint('verticals-index.json');

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
        sourceFiles: v.sourceFiles,
        outputBytes: vocabFp.outputBytes,
        outputSha256: vocabFp.outputSha256,
        featureCount: v.featureCount,
        vocabularyEntryCount: v.vocabularyEntryCount,
        scannedProductFileCount: v.productFileCount,
        scannedFeatureCount: v.scannedFeatureCount,
        note: 'Generated from observed Open Icecat EN product feature values. Product XML usage supplies the practical feature-to-value link; identifiers, numeric/unit measurements, booleans, and long free-text fields are filtered out.'
      },
      'icecatCategoryFeatures.json': {
        generator: icecatCategoryFeatures.GENERATOR_NAME,
        generatorVersion: icecatCategoryFeatures.GENERATOR_VERSION,
        sourceFiles: c.sourceFiles,
        outputBytes: catFeatFp.outputBytes,
        outputSha256: catFeatFp.outputSha256,
        categoryCount: c.categoryCount,
        featureAssociationCount: c.featureAssociationCount
      },
      'esciSubstitutes.json': {
        generator: esciSubstitutes.GENERATOR_NAME,
        generatorVersion: esciSubstitutes.GENERATOR_VERSION,
        isStub: Boolean(e.isFixture),
        sourceFiles: e.sourceFiles,
        outputBytes: esciFp.outputBytes,
        outputSha256: esciFp.outputSha256,
        substitutePairCount: e.substitutePairCount,
        inputRowCount: e.inputRowCount,
        queryCount: e.queryCount,
        note: e.isFixture
          ? 'Fixture preserved because data-sources/esci/shopping_queries_dataset_examples.parquet is not present. Place the Amazon ESCI parquet corpus locally and rerun this generator with --require-source to force real output.'
          : 'Generated from Amazon ESCI parquet. Substitute pairs are additive duplicate/comparison signals only; they are not automatic merge authority.'
      },
      'icecat_category_to_vertical.json': {
        generator: verticalMapping.GENERATOR_NAME,
        generatorVersion: verticalMapping.GENERATOR_VERSION,
        outputBytes: mappingFp.outputBytes,
        outputSha256: mappingFp.outputSha256,
        totalCategories: vm.totalCategories,
        totalMapped: vm.totalMapped,
        unclassified: vm.unclassified,
        verticals: vm.verticals,
        note: 'Bundled — enables runtime auto-detection of a product\'s vertical without fetching any pack. Unmapped Icecat category ids fall through to bundled defaults (fail-safe).'
      },
      'verticals-index.json': {
        generator: verticalMapping.GENERATOR_NAME,
        generatorVersion: verticalMapping.GENERATOR_VERSION,
        outputBytes: indexFp.outputBytes,
        outputSha256: indexFp.outputSha256,
        note: 'Bundled — lists all vertical packs by id + display name + pack URL/sha256/size. packUrl/packBytes/packSha256 are placeholder-null until the pack splitter (future commit) runs.'
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
