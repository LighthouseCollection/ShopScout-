#!/usr/bin/env node
/* =============================================================
   Generator: icecatCategoryFeatures.json

   Streams CategoryFeaturesList.xml.gz (1.5 GB compressed) and
   emits an indexed JSON mapping Icecat category id -> {path,
   displayName, matchTerms, features[]}.

   Stream-parse only. Never loads the uncompressed XML into
   memory in full.

   For each <Category>:
     - Read attribute ID
     - Read <Name langid="1" Value="..."/> to get the English
       display name
     - Descend into <CategoryFeatureGroup> -> <Feature ID> to
       collect the feature ids (with any Mandatory / No / Class
       attributes)
     - Skip everything else

   matchTerms are derived heuristically from the path:
   lowercase(displayName), plural/singular pairs, and joined path
   segment sub-phrases. This matches Codex's amendment that the
   runtime bridges from ShopScout / Shopify category text to
   Icecat category, not from Shopify category ids.

   The path is inferred from category hierarchy. Icecat's export
   does not always emit a nested Category tree in this file, so
   the path is best-effort: we use the current category's English
   Name only, unless a parent hint was present. When path is a
   single element we still emit an array with that one element.

   Feature displayName is NOT available in this file — it lives
   in FeaturesList.xml.gz. The generator emits featureId + a
   placeholder displayName equal to `feature:<id>` for features
   whose name we cannot resolve without cross-referencing another
   file. Codex's runtime can either resolve names via the
   generated vocabulary file when it lands, or leave the numeric
   placeholder as an internal id.
   ============================================================= */
'use strict';

const path = require('path');
const fs = require('fs');
const {
  sourcePath,
  outputPath,
  fileBytes,
  sha256OfFileSync,
  serializeJson,
  sortedObjectKeysNumeric,
  sortedArrayUniqueAscii,
  guardAgainstRegression,
  writeGeneratedFile,
  streamGzipXml,
  parseXmlStream,
  nowIso
} = require('./lib');

const GENERATOR_NAME =
  'scripts/build-normalization-libraries/build-icecat-category-features.js';
const GENERATOR_VERSION = 1;

const SOURCE_REL = 'refs/CategoryFeaturesList.xml.gz';
const OUTPUT_NAME = 'icecatCategoryFeatures.json';

const ENGLISH_LANGID = '1';

function normalizeMatchTerm(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveMatchTerms(displayName) {
  const terms = new Set();
  const base = normalizeMatchTerm(displayName);
  if (!base) return [];
  terms.add(base);
  const tokens = base.split(' ').filter(Boolean);
  if (tokens.length > 1) {
    // Trailing token variant (mice / mouse -> mice), leading token variant (wireless mice -> mice)
    terms.add(tokens[tokens.length - 1]);
    terms.add(tokens.slice(1).join(' '));
  }
  // Heuristic singular/plural pairs.
  const plural = base.endsWith('s') ? base.slice(0, -1) : base + 's';
  terms.add(plural);
  return [...terms].filter(Boolean);
}

async function build() {
  const xmlAbs = sourcePath(SOURCE_REL);
  const sourceBytes = fileBytes(xmlAbs);
  const sourceSha256 = sha256OfFileSync(xmlAbs);

  const categories = Object.create(null);

  // Streaming state.
  let curCategory = null;
  let seenNameForCurCategory = false;
  const path_ = []; // element name stack

  const stream = streamGzipXml(xmlAbs);
  await parseXmlStream(stream, {
    onOpen(name, attrs) {
      path_.push(name);
      if (name === 'Category' && attrs.ID) {
        curCategory = {
          categoryId: Number(attrs.ID),
          path: [],
          displayName: '',
          matchTerms: [],
          url: 'https://icecat.biz/en/browse/categories/' + attrs.ID + '.html',
          features: [],
          _featureIds: new Set()
        };
        seenNameForCurCategory = false;
        return;
      }

      if (!curCategory) return;

      // Category display name: <Name langid="1" Value="..."/> at the Category
      // level, NOT inside a FeatureGroup. Depth check: only Category > Name.
      if (name === 'Name' && attrs.langid === ENGLISH_LANGID) {
        // Determine if we're a direct child of Category vs nested deeper.
        // The immediate parent is path_[path_.length - 2] and the enclosing
        // frame that opened last (before this Name) is at index -2.
        // Since we push before matching, path_[-2] is the parent element.
        const parent = path_[path_.length - 2];
        if (parent === 'Category' && !seenNameForCurCategory && attrs.Value) {
          curCategory.displayName = attrs.Value;
          curCategory.path = [attrs.Value];
          seenNameForCurCategory = true;
        }
        return;
      }

      if (name === 'Feature' && attrs.ID) {
        const fid = Number(attrs.ID);
        if (!curCategory._featureIds.has(fid)) {
          curCategory._featureIds.add(fid);
          // Compact features: featureId only, mandatory only when true.
          // canonicalName/displayName/order are OPTIONAL fields in the
          // amended v1 schema — they populate when a future generator
          // resolves feature names by cross-referencing FeaturesList.xml.gz.
          const isMandatory = attrs.Mandatory === '1' || attrs.Mandatory === 'true';
          const entry = { featureId: fid };
          if (isMandatory) entry.mandatory = true;
          curCategory.features.push(entry);
        }
      }
    },
    onClose(name) {
      // Pop matching element.
      while (path_.length && path_[path_.length - 1] !== name) path_.pop();
      if (path_.length) path_.pop();

      if (name === 'Category' && curCategory) {
        if (curCategory.displayName) {
          curCategory.matchTerms = sortedArrayUniqueAscii(
            deriveMatchTerms(curCategory.displayName)
          );
          delete curCategory._featureIds;
          categories[String(curCategory.categoryId)] = curCategory;
        }
        curCategory = null;
        seenNameForCurCategory = false;
      }
    }
  });

  // Sort features within each category by featureId ascending (deterministic
   // order since we don't have Icecat's display-order attribute here).
  for (const cat of Object.values(categories)) {
    cat.features.sort((a, b) => a.featureId - b.featureId);
  }

  const sorted = sortedObjectKeysNumeric(categories);

  const payload = {
    $schema:
      'shopscout://normalization-libraries/icecatCategoryFeatures/v1',
    version: 1,
    source: {
      vocabulary: 'Open Icecat',
      license: 'CC-BY-ND-4.0',
      url: 'https://icecat.biz/',
      sourceFile: path.join('data-sources', 'icecat', SOURCE_REL).replace(/\\/g, '/'),
      sourceBytes,
      sourceSha256,
      generatedAt: nowIso(),
      generator: GENERATOR_NAME,
      generatorVersion: GENERATOR_VERSION,
      note: 'Streams CategoryFeaturesList.xml.gz. Emits category id -> {path, displayName, matchTerms (heuristic), features[]}. Feature displayName is a placeholder (feature:<id>) because feature name lookup lives in a separate Icecat file. Codex runtime may resolve names via a future icecatVocabulary generator run.'
    },
    categories: sorted
  };

  const content = serializeJson(payload);
  guardAgainstRegression(OUTPUT_NAME, content);
  writeGeneratedFile(OUTPUT_NAME, content);

  const categoryCount = Object.keys(sorted).length;
  let featureAssociationCount = 0;
  for (const cat of Object.values(sorted)) {
    featureAssociationCount += cat.features.length;
  }

  return {
    outputName: OUTPUT_NAME,
    outputBytes: Buffer.byteLength(content, 'utf8'),
    categoryCount,
    featureAssociationCount,
    sourceFiles: [
      {
        path: path.join('data-sources', 'icecat', SOURCE_REL).replace(/\\/g, '/'),
        bytes: sourceBytes,
        sha256: sourceSha256
      }
    ]
  };
}

function validate() {
  const abs = outputPath(OUTPUT_NAME);
  if (!fs.existsSync(abs)) {
    throw new Error(`${OUTPUT_NAME} does not exist. Run this generator first.`);
  }
  const raw = fs.readFileSync(abs, 'utf8');
  const data = JSON.parse(raw);
  if (data.version !== 1) {
    throw new Error(`${OUTPUT_NAME}: unsupported version ${data.version}`);
  }
  if (!data.source || data.source.generator !== GENERATOR_NAME) {
    throw new Error(`${OUTPUT_NAME}: not generated by ${GENERATOR_NAME}`);
  }
  if (!data.categories || typeof data.categories !== 'object') {
    throw new Error(`${OUTPUT_NAME}: missing categories object`);
  }
  const categoryCount = Object.keys(data.categories).length;
  let featureAssociationCount = 0;
  for (const cat of Object.values(data.categories)) {
    featureAssociationCount += (cat.features || []).length;
  }
  return {
    outputName: OUTPUT_NAME,
    outputBytes: Buffer.byteLength(raw, 'utf8'),
    categoryCount,
    featureAssociationCount,
    sourceFiles: [
      {
        path: path.join('data-sources', 'icecat', SOURCE_REL).replace(/\\/g, '/'),
        bytes: data.source.sourceBytes,
        sha256: data.source.sourceSha256
      }
    ]
  };
}

if (require.main === module) {
  build()
    .then(summary => {
      process.stdout.write(
        `wrote ${summary.outputName}: ${summary.categoryCount} categories, ` +
        `${summary.featureAssociationCount} feature associations, ${summary.outputBytes} bytes\n`
      );
    })
    .catch(err => {
      process.stderr.write(`build-icecat-category-features failed: ${err.message}\n`);
      process.stderr.write((err.stack || '') + '\n');
      process.exit(1);
    });
}

module.exports = { build, validate, GENERATOR_NAME, GENERATOR_VERSION };
