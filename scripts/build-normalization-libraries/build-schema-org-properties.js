#!/usr/bin/env node
/* =============================================================
   Generator: schemaOrgProperties.json

   Reads Schema.org's flat properties CSV and emits the subset
   relevant to a product/offer context per the amended
   SCHEMA.md v1 shape.

   Inclusion rule:
   - Property is included if domainIncludes intersects
     {Product, Offer} OR the property is in the SUPERTYPE_ALLOWLIST
     (a small curated set from Thing/Intangible/PhysicalObject that
     is genuinely useful in a product grid).
   ============================================================= */
'use strict';

const path = require('path');
const {
  sourcePath,
  fileBytes,
  sha256OfFileSync,
  serializeJson,
  sortedByCanonical,
  guardAgainstRegression,
  writeGeneratedFile,
  readCsv,
  nowIso,
  GENERATED_DIR
} = require('./lib');

const GENERATOR_NAME =
  'scripts/build-normalization-libraries/build-schema-org-properties.js';
const GENERATOR_VERSION = 1;

const SOURCE_REL = 'schema-org/schemaorg-current-https-properties.csv';
const OUTPUT_NAME = 'schemaOrgProperties.json';

const TARGET_DOMAINS = new Set([
  'https://schema.org/Product',
  'https://schema.org/Offer'
]);

/* Supertype allowlist (Codex's amendment). Only these Thing/
   Intangible/PhysicalObject properties are added even when their
   domainIncludes does not explicitly name Product or Offer. */
const SUPERTYPE_ALLOWLIST = new Set([
  'https://schema.org/name',
  'https://schema.org/description',
  'https://schema.org/image',
  'https://schema.org/url',
  'https://schema.org/identifier',
  'https://schema.org/alternateName'
]);

function splitList(value) {
  if (!value) return [];
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/* Acronyms that should stay all-caps in display names + get folded to a
   single lowercase token in canonical form. */
const ACRONYMS = new Set([
  'asin', 'gtin', 'gtin8', 'gtin12', 'gtin13', 'gtin14',
  'sku', 'mpn', 'isbn', 'iswc', 'issn', 'ismn',
  'url', 'id', 'faq', 'dob', 'nsn'
]);

/* Split Schema.org's camelCase / PascalCase labels into whitespace-separated
   tokens. Preserves runs of uppercase (`GTIN13` -> `GTIN13`, `URL` -> `URL`),
   preserves digits attached to a token (`gtin13` -> `gtin13`). */
function splitCamelCase(input) {
  if (!input) return [];
  // Insert a boundary before an uppercase letter that follows a lowercase
  // letter or a digit; and before an uppercase letter that starts an ALL-CAPS
  // run followed by a lowercase letter (e.g. XMLReader -> XML Reader).
  const spaced = input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
  return spaced.split(/\s+/).filter(Boolean);
}

function labelToCanonical(label) {
  const tokens = splitCamelCase(label).map(t => t.toLowerCase());
  return tokens.join(' ');
}

function labelToDisplayName(label) {
  const tokens = splitCamelCase(label);
  return tokens
    .map(tok => {
      if (ACRONYMS.has(tok.toLowerCase())) return tok.toUpperCase();
      if (/^[A-Z]{2,}$/.test(tok)) return tok; // already an acronym like DHS
      return tok.charAt(0).toUpperCase() + tok.slice(1);
    })
    .join(' ');
}

function urlToShortType(url) {
  return url.replace(/^https:\/\/schema\.org\//, '');
}

function collectDomainsForGridFilter(domainIncludes) {
  const kept = new Set();
  for (const dom of domainIncludes) {
    if (TARGET_DOMAINS.has(dom)) kept.add(urlToShortType(dom));
  }
  return [...kept].sort();
}

async function build() {
  const csvAbs = sourcePath(SOURCE_REL);
  const sourceBytes = fileBytes(csvAbs);
  const sourceSha256 = sha256OfFileSync(csvAbs);

  const properties = [];
  const seen = new Set();

  await readCsv(csvAbs, row => {
    const id = row.id;
    if (!id || seen.has(id)) return;
    const domainIncludes = splitList(row.domainIncludes);
    const rangeIncludes = splitList(row.rangeIncludes);
    const label = row.label;

    const hasTargetDomain = domainIncludes.some(d => TARGET_DOMAINS.has(d));
    const isSupertypeAllowed = SUPERTYPE_ALLOWLIST.has(id);
    if (!hasTargetDomain && !isSupertypeAllowed) return;

    const canonical = labelToCanonical(label);
    if (!canonical) return;
    if (seen.has(canonical)) return;
    seen.add(canonical);
    seen.add(id);

    const domains = collectDomainsForGridFilter(domainIncludes);
    if (isSupertypeAllowed && domains.length === 0) {
      domains.push('Thing');
    }

    properties.push({
      canonical,
      displayName: labelToDisplayName(label),
      aliases: [],
      expectedTypes: rangeIncludes.map(urlToShortType).sort(),
      domains,
      description: (row.comment || '').replace(/\s+/g, ' ').trim(),
      url: id
    });
  });

  const sorted = sortedByCanonical(properties);

  const payload = {
    $schema:
      'shopscout://normalization-libraries/schemaOrgProperties/v1',
    version: 1,
    source: {
      vocabulary: 'Schema.org',
      release: 'unpinned',
      url: 'https://schema.org/',
      license: 'CC-BY-SA-3.0',
      sourceFile: path.join('data-sources', 'icecat', SOURCE_REL).replace(/\\/g, '/'),
      sourceBytes,
      sourceSha256,
      generatedAt: nowIso(),
      generator: GENERATOR_NAME,
      generatorVersion: GENERATOR_VERSION,
      note: 'Filtered to Schema.org properties whose domainIncludes intersects {Product, Offer}, plus a small allowlisted subset of Thing/Intangible/PhysicalObject properties (name, description, image, url, identifier, alternateName) that are genuinely useful in a product grid per SCHEMA.md v1 amended by Codex.'
    },
    properties: sorted
  };

  const content = serializeJson(payload);
  guardAgainstRegression(OUTPUT_NAME, content);
  writeGeneratedFile(OUTPUT_NAME, content);

  return {
    outputName: OUTPUT_NAME,
    outputBytes: Buffer.byteLength(content, 'utf8'),
    rowCount: sorted.length,
    sourceFiles: [
      {
        path: path.join('data-sources', 'icecat', SOURCE_REL).replace(/\\/g, '/'),
        bytes: sourceBytes,
        sha256: sourceSha256
      }
    ]
  };
}

if (require.main === module) {
  build()
    .then(summary => {
      process.stdout.write(
        `wrote ${summary.outputName}: ${summary.rowCount} properties, ${summary.outputBytes} bytes\n`
      );
    })
    .catch(err => {
      process.stderr.write(`build-schema-org-properties failed: ${err.message}\n`);
      process.stderr.write((err.stack || '') + '\n');
      process.exit(1);
    });
}

module.exports = { build, GENERATOR_NAME, GENERATOR_VERSION };

// Ensure GENERATED_DIR is treated as referenced (used indirectly by writeGeneratedFile).
void GENERATED_DIR;
