/* =============================================================
   Verifies shape invariants of the shipped generated JSON files
   in normalization/libraries/generated/. These files may be
   real generator output OR the hand-authored fixtures from
   Phase 1a — both share the amended v1 schemas pinned in
   normalization/libraries/generated/SCHEMA.md.
   ============================================================= */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GEN = path.join(ROOT, 'normalization', 'libraries', 'generated');

function loadJson(name) {
  const raw = fs.readFileSync(path.join(GEN, name), 'utf8');
  return JSON.parse(raw);
}

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

/* -------------------- schemaOrgProperties.json -------------------- */

const schemaOrg = loadJson('schemaOrgProperties.json');
assert.strictEqual(schemaOrg.version, 1, 'schemaOrgProperties.version === 1');
assert.ok(Array.isArray(schemaOrg.properties), 'properties array present');
assert.ok(schemaOrg.properties.length >= 8, 'at least 8 properties emitted');

const seen = new Set();
let priorCanonical = '';
const identifierCanonicals = new Set([
  'asin',
  'ean',
  'gtin',
  'gtin 8',
  'gtin 12',
  'gtin 13',
  'gtin 14',
  'identifier',
  'isbn',
  'model',
  'mpn',
  'product id',
  'serial number',
  'sku',
  'upc'
]);
for (const p of schemaOrg.properties) {
  assert.ok(typeof p.canonical === 'string' && p.canonical.length > 0,
    'canonical string present: ' + JSON.stringify(p));
  assert.ok(!seen.has(p.canonical),
    'canonical unique: ' + p.canonical);
  seen.add(p.canonical);
  assert.ok(p.canonical >= priorCanonical,
    'properties sorted by canonical asc: ' + p.canonical + ' vs ' + priorCanonical);
  priorCanonical = p.canonical;
  assert.ok(typeof p.displayName === 'string', 'displayName present');
  assert.ok(Array.isArray(p.aliases), 'aliases array present');
  assert.ok(Array.isArray(p.expectedTypes), 'expectedTypes array present');
  assert.ok(Array.isArray(p.domains), 'domains array present');
  assert.ok(p.domains.length > 0, 'domains non-empty: ' + p.canonical);
  assert.ok(typeof p.description === 'string', 'description present');
  assert.ok(typeof p.url === 'string' && p.url.startsWith('https://schema.org/'),
    'url is a schema.org URL: ' + p.canonical);
  assert.ok(!identifierCanonicals.has(p.canonical),
    'identifier fields stay out of attribute normalization: ' + p.canonical);
}
assert.strictEqual(schemaOrg.source.vocabulary, 'Schema.org',
  'source.vocabulary is Schema.org');

/* -------------------- icecatVocabulary.json -------------------- */

const vocab = loadJson('icecatVocabulary.json');
assert.strictEqual(vocab.version, 1, 'icecatVocabulary.version === 1');
assert.ok(vocab.features && typeof vocab.features === 'object',
  'features object present');
const vocabKeys = Object.keys(vocab.features);
assert.ok(vocabKeys.length >= 1, 'at least 1 feature emitted');
const sortedVocabKeys = [...vocabKeys].sort((a, b) => Number(a) - Number(b));
assert.deepStrictEqual(vocabKeys, sortedVocabKeys,
  'features keyed sorted numerically ascending');
for (const [id, feature] of Object.entries(vocab.features)) {
  assert.strictEqual(String(feature.featureId), id,
    'featureId matches JSON key: ' + id);
  assert.ok(typeof feature.canonicalName === 'string',
    'canonicalName present for feature ' + id);
  assert.ok(typeof feature.displayName === 'string',
    'displayName present for feature ' + id);
  assert.ok(Array.isArray(feature.vocabulary), 'vocabulary array present');
  const canonicals = new Set();
  for (const entry of feature.vocabulary) {
    const lc = entry.canonical.toLowerCase();
    assert.ok(!canonicals.has(lc),
      'vocabulary canonical unique per feature ' + id + ': ' + lc);
    canonicals.add(lc);
    assert.ok(Array.isArray(entry.aliases), 'entry.aliases is array');
    for (const alias of entry.aliases) {
      assert.notStrictEqual(alias.toLowerCase(), lc,
        'alias does not repeat canonical: ' + lc);
    }
  }
}
assert.strictEqual(vocab.source.vocabulary, 'Open Icecat',
  'source.vocabulary is Open Icecat');
assert.strictEqual(vocab.source.license, 'CC-BY-ND-4.0',
  'source.license is CC-BY-ND-4.0');

/* -------------------- icecatCategoryFeatures.json -------------------- */

const catFeat = loadJson('icecatCategoryFeatures.json');
assert.strictEqual(catFeat.version, 1, 'icecatCategoryFeatures.version === 1');
assert.ok(catFeat.categories && typeof catFeat.categories === 'object',
  'categories object present');
const catKeys = Object.keys(catFeat.categories);
assert.ok(catKeys.length >= 1, 'at least 1 category emitted');
const sortedCatKeys = [...catKeys].sort((a, b) => Number(a) - Number(b));
assert.deepStrictEqual(catKeys, sortedCatKeys,
  'categories keyed sorted numerically ascending');
for (const [id, cat] of Object.entries(catFeat.categories)) {
  assert.strictEqual(String(cat.categoryId), id,
    'categoryId matches JSON key: ' + id);
  assert.ok(Array.isArray(cat.path) && cat.path.length >= 1,
    'path present with at least one segment for category ' + id);
  assert.ok(typeof cat.displayName === 'string' && cat.displayName.length > 0,
    'displayName present for category ' + id);
  assert.ok(Array.isArray(cat.matchTerms) && cat.matchTerms.length >= 1,
    'matchTerms array non-empty for category ' + id);
  const sortedMatchTerms = [...cat.matchTerms].sort();
  assert.deepStrictEqual(cat.matchTerms, sortedMatchTerms,
    'matchTerms sorted for category ' + id);
  const uniqueMatchTerms = new Set(cat.matchTerms);
  assert.strictEqual(uniqueMatchTerms.size, cat.matchTerms.length,
    'matchTerms unique for category ' + id);
  assert.ok(Array.isArray(cat.features),
    'features array present for category ' + id);
  const featureIds = new Set();
  for (const f of cat.features) {
    assert.ok(typeof f.featureId === 'number',
      'featureId is number in category ' + id);
    assert.ok(!featureIds.has(f.featureId),
      'featureId unique in category ' + id + ': ' + f.featureId);
    featureIds.add(f.featureId);
    // canonicalName, displayName, order are OPTIONAL in current-generation
    // output; verify only when present.
    if (f.canonicalName != null) {
      assert.ok(typeof f.canonicalName === 'string',
        'canonicalName when present is string');
    }
    if (f.displayName != null) {
      assert.ok(typeof f.displayName === 'string',
        'displayName when present is string');
    }
    if (f.order != null) {
      assert.ok(typeof f.order === 'number',
        'order when present is number');
    }
  }
}
assert.strictEqual(catFeat.source.vocabulary, 'Open Icecat',
  'source.vocabulary is Open Icecat');

/* -------------------- BUILD_MANIFEST.json -------------------- */

const manifest = loadJson('BUILD_MANIFEST.json');
assert.strictEqual(manifest.version, 1, 'BUILD_MANIFEST.version === 1');
assert.ok(manifest.outputs && typeof manifest.outputs === 'object',
  'outputs object present');
for (const [name, meta] of Object.entries(manifest.outputs)) {
  assert.ok(fs.existsSync(path.join(GEN, name)),
    'manifest output exists on disk: ' + name);
  assert.ok(typeof meta.generator === 'string',
    'generator field present for ' + name);
  assert.ok(typeof meta.outputBytes === 'number' && meta.outputBytes > 0,
    'outputBytes numeric for ' + name);
  // outputSha256 may be zero-filled for the vocab stub / fixture entries.
  assert.ok(isSha256(meta.outputSha256),
    'outputSha256 is 64 hex chars for ' + name);
}

console.log('generated-libraries.test.js: all assertions passed');
