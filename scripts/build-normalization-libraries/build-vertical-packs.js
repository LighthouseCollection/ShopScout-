#!/usr/bin/env node
/* =============================================================
   Generator: dist/packs/{vertical}.json × 21

   Slices the monolithic generated libraries into per-vertical
   packs. Each pack contains only the Icecat categories, Icecat
   vocabularies, Shopify sub-tree, and ESCI substitute pairs that
   belong to that vertical.

   Output directory: dist/packs/  (NOT the extension dist)
   - dist/packs/{vertical}.json for each of 21 verticals
   - dist/packs/manifest.json  (self-describing bundle summary)

   Also updates normalization/libraries/generated/verticals-index.json
   with real packUrl / packBytes / packSha256 for every pack. The
   URLs assume packs are published to:
     https://github.com/LighthouseCollection/ShopScout-/releases/
       download/data-v{versionTag}/{vertical}.json

   The version tag defaults to the current git short SHA when
   run in CI, or "dev" locally.

   These packs are NOT bundled in the extension dist. They are
   uploaded to a GitHub Release by the .github workflow. The
   extension fetches them on-demand at runtime.
   ============================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  outputPath,
  serializeJson,
  nowIso,
  REPO_ROOT
} = require('./lib');
const verticalMapping = require('./build-vertical-mapping');

const GENERATOR_NAME =
  'scripts/build-normalization-libraries/build-vertical-packs.js';
const GENERATOR_VERSION = 1;

const PACKS_OUT_DIR = path.join(REPO_ROOT, 'dist', 'packs');
const RELEASE_URL_TEMPLATE = process.env.SHOPSCOUT_PACK_URL_TEMPLATE ||
  'https://github.com/LighthouseCollection/ShopScout-/releases/download/data-v{version}/{vertical}.json';
const RELEASE_VERSION_TAG = process.env.SHOPSCOUT_DATA_VERSION || 'dev';

function loadGenerated(name) {
  const abs = outputPath(name);
  if (!fs.existsSync(abs)) {
    throw new Error(
      `${name} not found under normalization/libraries/generated/. ` +
      'Run build-all.js (which runs the other generators) before this splitter.'
    );
  }
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function loadShopifyTaxonomy() {
  const abs = path.join(REPO_ROOT, 'vendor', 'shopify-taxonomy', 'taxonomy.json');
  if (!fs.existsSync(abs)) {
    throw new Error(`Shopify taxonomy not found at ${abs}`);
  }
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function sha256OfString(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function urlForPack(vertical) {
  return RELEASE_URL_TEMPLATE
    .replace('{version}', RELEASE_VERSION_TAG)
    .replace('{vertical}', vertical);
}

/* Given the Icecat category ids assigned to a vertical, pull only
   the corresponding categoryFeatures entries. */
function sliceCategoryFeatures(catFeatData, categoryIds) {
  const idSet = new Set(categoryIds.map(String));
  const out = {};
  for (const id of Object.keys(catFeatData.categories).sort((a, b) => Number(a) - Number(b))) {
    if (idSet.has(id)) out[id] = catFeatData.categories[id];
  }
  return out;
}

/* Collect the set of feature ids referenced by the categories in this
   vertical, then filter the vocabulary to only those features. */
function sliceVocabulary(vocabData, verticalCategoryFeatures) {
  const featureIds = new Set();
  for (const cat of Object.values(verticalCategoryFeatures)) {
    for (const f of (cat.features || [])) featureIds.add(String(f.featureId));
  }
  const out = {};
  for (const id of Object.keys(vocabData.features).sort((a, b) => Number(a) - Number(b))) {
    if (featureIds.has(id)) out[id] = vocabData.features[id];
  }
  return out;
}

/* Get the Shopify subtree for this vertical by top-level prefix.
   Vertical id -> Shopify prefix map lives on the rule objects. */
const VERTICAL_TO_SHOPIFY_PREFIX = {
  'animals-pet-supplies': 'ap',
  'apparel-accessories': 'aa',
  'arts-entertainment': 'ae',
  'baby-toddler': 'bt',
  'business-industrial': 'bi',
  'cameras-optics': 'co',
  'electronics': 'el',
  'food-beverages-tobacco': 'fb',
  'furniture': 'fr',
  'hardware': 'ha',
  'health-beauty': 'hb',
  'home-garden': 'hg',
  'luggage-bags': 'lb',
  'mature': 'ma',
  'media': 'me',
  'office-supplies': 'os',
  'religious-ceremonial': 'rc',
  'software': 'so',
  'sporting-goods': 'sg',
  'toys-games': 'tg',
  'vehicles-parts': 'vp'
};

/* Take just the Shopify vertical + its categories. Strip the very
   verbose return_reasons + attribute descriptions to keep pack size
   down; the categories tree itself is what runtime needs. */
function sliceShopifyTree(shopifyData, verticalId) {
  const prefix = VERTICAL_TO_SHOPIFY_PREFIX[verticalId];
  if (!prefix) return null;
  const vertical = shopifyData.verticals.find(v => v.prefix === prefix);
  if (!vertical) return null;
  return {
    prefix: vertical.prefix,
    name: vertical.name,
    categories: (vertical.categories || []).map(c => ({
      id: c.id,
      level: c.level,
      name: c.name,
      full_name: c.full_name,
      parent_id: c.parent_id,
      attributes: (c.attributes || []).map(a => ({
        id: a.id,
        name: a.name,
        handle: a.handle
      }))
    }))
  };
}

function build() {
  const mapping = loadGenerated('icecat_category_to_vertical.json');
  const catFeatData = loadGenerated('icecatCategoryFeatures.json');
  const vocabData = loadGenerated('icecatVocabulary.json');
  const schemaOrgData = loadGenerated('schemaOrgProperties.json');
  const esciData = loadGenerated('esciSubstitutes.json');
  const shopifyData = loadShopifyTaxonomy();
  const verticalsIndex = loadGenerated('verticals-index.json');

  // Group Icecat category ids by vertical.
  const categoryIdsByVertical = {};
  for (const [catId, verticalId] of Object.entries(mapping.mapping)) {
    if (!categoryIdsByVertical[verticalId]) categoryIdsByVertical[verticalId] = [];
    categoryIdsByVertical[verticalId].push(catId);
  }

  fs.mkdirSync(PACKS_OUT_DIR, { recursive: true });

  const verticals = verticalMapping.VERTICAL_RULES.map(r => ({ id: r.id, displayName: r.displayName }));
  const summary = [];

  for (const v of verticals) {
    const categoryIds = categoryIdsByVertical[v.id] || [];
    const verticalCategoryFeatures = sliceCategoryFeatures(catFeatData, categoryIds);
    const verticalVocabulary = sliceVocabulary(vocabData, verticalCategoryFeatures);
    const shopifyTree = sliceShopifyTree(shopifyData, v.id);

    const pack = {
      $schema: 'shopscout://normalization-libraries/vertical-pack/v1',
      version: 1,
      vertical: {
        id: v.id,
        displayName: v.displayName
      },
      source: {
        generatedAt: nowIso(),
        generator: GENERATOR_NAME,
        generatorVersion: GENERATOR_VERSION,
        dataVersion: RELEASE_VERSION_TAG,
        note: 'On-demand pack for a Shopify top-level vertical. Runtime fetches this from GitHub Releases, caches in IndexedDB, refreshes when versions-index.json flags a newer dataVersion.'
      },
      icecatCategoryFeatures: verticalCategoryFeatures,
      icecatVocabulary: verticalVocabulary,
      shopifyCategoryTree: shopifyTree,
      // Full ESCI substitutes ship in every pack (small + no vertical info in the fixture).
      // When real ESCI generator lands and includes ASIN→category, this will slice per-vertical too.
      esciSubstitutes: esciData.substitutePairs || [],
      // Schema.org is bundled in the extension too, but include a copy in every pack
      // so a fully-loaded pack is self-sufficient for offline use after first fetch.
      schemaOrgProperties: schemaOrgData.properties || []
    };

    const packContent = serializeJson(pack);
    const packAbs = path.join(PACKS_OUT_DIR, `${v.id}.json`);
    fs.writeFileSync(packAbs, packContent, { encoding: 'utf8' });
    const packBytes = Buffer.byteLength(packContent, 'utf8');
    const packSha256 = sha256OfString(packContent);

    summary.push({
      id: v.id,
      displayName: v.displayName,
      icecatCategoryCount: categoryIds.length,
      icecatVocabularyCount: Object.keys(verticalVocabulary).length,
      shopifySubtreeSize: shopifyTree ? shopifyTree.categories.length : 0,
      packBytes,
      packSha256,
      packUrl: urlForPack(v.id)
    });
  }

  // Update verticals-index.json with real packUrl / packBytes / packSha256.
  const indexOut = {
    ...verticalsIndex,
    source: {
      ...verticalsIndex.source,
      packSplitterGenerator: GENERATOR_NAME,
      packSplitterGeneratorVersion: GENERATOR_VERSION,
      dataVersion: RELEASE_VERSION_TAG,
      updatedAt: nowIso()
    },
    verticals: verticals.map(v => {
      const s = summary.find(x => x.id === v.id);
      return {
        id: v.id,
        displayName: v.displayName,
        icecatCategoryCount: s.icecatCategoryCount,
        packUrl: s.packUrl,
        packBytes: s.packBytes,
        packSha256: s.packSha256
      };
    })
  };
  const indexContent = serializeJson(indexOut);
  fs.writeFileSync(outputPath('verticals-index.json'), indexContent, { encoding: 'utf8' });

  // Emit a self-describing manifest inside the packs directory.
  const manifest = {
    $schema: 'shopscout://normalization-libraries/vertical-packs-manifest/v1',
    version: 1,
    dataVersion: RELEASE_VERSION_TAG,
    generatedAt: nowIso(),
    generator: GENERATOR_NAME,
    generatorVersion: GENERATOR_VERSION,
    packs: summary
  };
  fs.writeFileSync(
    path.join(PACKS_OUT_DIR, 'manifest.json'),
    serializeJson(manifest),
    { encoding: 'utf8' }
  );

  return {
    packDir: PACKS_OUT_DIR,
    packCount: summary.length,
    totalBytes: summary.reduce((n, s) => n + s.packBytes, 0),
    largestPack: summary.slice().sort((a, b) => b.packBytes - a.packBytes)[0],
    smallestPack: summary.slice().sort((a, b) => a.packBytes - b.packBytes)[0]
  };
}

if (require.main === module) {
  try {
    const s = build();
    process.stdout.write(`wrote ${s.packCount} packs to ${s.packDir}\n`);
    process.stdout.write(`total: ${(s.totalBytes / (1024 * 1024)).toFixed(1)} MB\n`);
    process.stdout.write(`largest: ${s.largestPack.id} (${(s.largestPack.packBytes / (1024 * 1024)).toFixed(2)} MB)\n`);
    process.stdout.write(`smallest: ${s.smallestPack.id} (${(s.smallestPack.packBytes / 1024).toFixed(1)} KB)\n`);
  } catch (err) {
    process.stderr.write(`build-vertical-packs failed: ${err.message}\n`);
    process.stderr.write((err.stack || '') + '\n');
    process.exit(1);
  }
}

module.exports = { build, GENERATOR_NAME, GENERATOR_VERSION };
