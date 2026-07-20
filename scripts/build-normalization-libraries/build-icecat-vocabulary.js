#!/usr/bin/env node
/* =============================================================
   Generator: icecatVocabulary.json

   Builds real per-feature enum vocabularies from observed Open
   Icecat EN product XML usage. FeatureValuesVocabularyList.xml.gz
   is a global value dictionary, not a feature-specific mapping, so
   the practical link is the product corpus:

     ProductFeature.Presentation_Value -> Feature.ID + Feature.Name

   The generator intentionally filters identifiers, numeric/unit
   measurements, booleans, and long free-text values. Those are
   handled by other ShopScout normalization paths and should not
   become enum vocabularies.
   ============================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  sourcePath,
  outputPath,
  fileBytes,
  sha256OfFileSync,
  sha256OfString,
  serializeJson,
  sortedObjectKeysNumeric,
  guardAgainstRegression,
  writeGeneratedFile,
  nowIso
} = require('./lib');

const GENERATOR_NAME =
  'scripts/build-normalization-libraries/build-icecat-vocabulary.js';
const GENERATOR_VERSION = 1;

const OUTPUT_NAME = 'icecatVocabulary.json';
const PRODUCTS_REL_DIR = path.join('products', 'EN');
const FEATURE_VALUES_REL = path.join('refs', 'FeatureValuesVocabularyList.xml.gz');
const FEATURES_REL = path.join('refs', 'FeaturesList.xml.gz');

const MIN_VALUES_PER_FEATURE = 2;
const MAX_VALUES_PER_FEATURE = 350;
const MAX_VALUE_LENGTH = 80;
const MAX_ALIASES_PER_VALUE = 10;

const IDENTIFIER_FIELD_RE = /\b(asin|ean|gtin|isbn|mpn|sku|upc|jan|model|serial|barcode|product\s*(id|code|number)|manufacturer\s+part|part\s+number|article\s+number|catalog\s+number)\b/i;
const FREE_TEXT_FIELD_RE = /\b(description|short\s+summary|long\s+summary|marketing|disclaimer|warranty\s+information|manual|url|seo|keywords?)\b/i;
const BOOLEAN_ONLY_VALUES = new Set(['yes', 'no', 'y', 'n', 'true', 'false']);

function decodeXmlAttr(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function parseAttrs(attrString) {
  const attrs = {};
  const re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(attrString || '')) !== null) {
    attrs[m[1]] = decodeXmlAttr(m[2]);
  }
  return attrs;
}

function cleanSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function canonicalFieldName(value) {
  return cleanSpaces(value)
    .replace(/\bcolour\b/ig, 'color')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .toLowerCase();
}

function titleCaseWord(word) {
  if (/^(usb|hdmi|vga|dvi|ips|oled|lcd|led|wi-fi|wifi|bluetooth|pci|pcie|cpu|gpu|nfc|gps)$/i.test(word)) {
    return word.toUpperCase().replace('WIFI', 'Wi-Fi');
  }
  if (/^[A-Z0-9+-]{2,}$/.test(word)) return word;
  return word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase();
}

function canonicalValue(value) {
  let v = cleanSpaces(value)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s*[/|]\s*/g, ' / ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\bgrey\b/ig, 'Gray')
    .replace(/\bcolour\b/ig, 'color');

  if (!v) return '';

  // Keep common technical spellings stable.
  v = v.replace(/\bwi[\s-]?fi\b/ig, 'Wi-Fi');
  v = v.replace(/\busb[\s-]?c\b/ig, 'USB-C');
  v = v.replace(/\busb[\s-]?a\b/ig, 'USB-A');
  v = v.replace(/\btype[\s-]?c\b/ig, 'USB-C');

  if (/^[A-Z0-9 .+\-_/()]+$/.test(v) && /[A-Z]/.test(v)) return v;

  return v.split(/(\s+|-)/).map(part => {
    if (/^\s+$|^-$/.test(part)) return part;
    return titleCaseWord(part);
  }).join('');
}

function normalizedKey(value) {
  return cleanSpaces(value)
    .toLowerCase()
    .replace(/\bgrey\b/g, 'gray')
    .replace(/\bcolour\b/g, 'color')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[\s_.,;:()]+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .trim();
}

function isLikelyMeasurement(value) {
  const v = cleanSpaces(value).toLowerCase();
  if (!v) return true;
  if (/^[+-]?\d+([.,]\d+)?$/.test(v)) return true;
  if (/^[+-]?\d+([.,]\d+)?\s*(mm|cm|m|in|inch|kg|g|lb|lbs|oz|w|kw|v|a|mah|wh|hz|khz|mhz|ghz|l|ml|gb|tb|mb|rpm|psi|bar|pa|db|ms|s|sec|secs|second|seconds|min|mins|minute|minutes|h|hr|hrs|hour|hours|°c|c|°f|f)\b/.test(v)) {
    return true;
  }
  if (/^\d+\s*[x×]\s*\d+/.test(v)) return true;
  return false;
}

function isUsefulValue(value) {
  const v = cleanSpaces(value);
  if (!v || v.length > MAX_VALUE_LENGTH) return false;
  const lc = v.toLowerCase();
  if (BOOLEAN_ONLY_VALUES.has(lc)) return false;
  if (/^https?:\/\//i.test(v)) return false;
  if (isLikelyMeasurement(v)) return false;
  if ((v.match(/\s/g) || []).length > 10) return false;
  return /[\p{L}]/u.test(v);
}

function splitValue(value) {
  const v = cleanSpaces(value);
  if (!v) return [];
  const separator = /[,;|]/;
  if (!separator.test(v)) return [v];
  return v
    .split(separator)
    .map(cleanSpaces)
    .filter(Boolean)
    .filter(part => part.length >= 2);
}

function productFiles() {
  const dir = sourcePath(PRODUCTS_REL_DIR);
  if (!fs.existsSync(dir)) {
    throw new Error(`Icecat product directory not found: ${dir}`);
  }
  return fs.readdirSync(dir)
    .filter(name => /\.xml$/i.test(name))
    .sort()
    .map(name => path.join(dir, name));
}

function featureNameFromBlock(block) {
  const featureNameMatch = block.match(/<Feature\b[\s\S]*?<Name\b([^>]*)\/?>/);
  if (!featureNameMatch) return '';
  return parseAttrs(featureNameMatch[1]).Value || '';
}

function featureIdFromBlock(block) {
  const featureMatch = block.match(/<Feature\b([^>]*)>/);
  if (!featureMatch) return '';
  return parseAttrs(featureMatch[1]).ID || '';
}

function addObservedValue(features, featureId, featureName, value, productId) {
  const displayName = cleanSpaces(featureName);
  if (!featureId || !displayName) return;
  if (IDENTIFIER_FIELD_RE.test(displayName) || FREE_TEXT_FIELD_RE.test(displayName)) return;

  const rawHadListSeparator = /[,;|]/.test(cleanSpaces(value));
  const parts = splitValue(value);
  const isSingleValue = !rawHadListSeparator && parts.length === 1;
  for (const part of parts) {
    if (!isUsefulValue(part)) continue;
    const canonical = canonicalValue(part);
    if (!canonical || !isUsefulValue(canonical)) continue;

    const key = normalizedKey(canonical);
    if (!key) continue;

    let feature = features.get(featureId);
    if (!feature) {
      feature = {
        featureId: Number(featureId),
        displayName,
        canonicalName: canonicalFieldName(displayName),
        values: new Map(),
        productCount: 0,
        products: new Set()
      };
      features.set(featureId, feature);
    }

    feature.products.add(productId);
    let entry = feature.values.get(key);
    if (!entry) {
      entry = { canonical, aliases: new Set(), count: 0 };
      feature.values.set(key, entry);
    }
    entry.count += 1;
    if (part.toLowerCase() !== canonical.toLowerCase()) entry.aliases.add(part);
    if (isSingleValue && value.toLowerCase() !== canonical.toLowerCase() && value.length <= MAX_VALUE_LENGTH) {
      entry.aliases.add(value);
    }
  }
}

function scanProductFile(absPath, features) {
  const xml = fs.readFileSync(absPath, 'utf8');
  const productId = path.basename(absPath, '.xml');
  const re = /<ProductFeature\b([^>]*)>([\s\S]*?)<\/ProductFeature>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = parseAttrs(m[1]);
    const value = attrs.Presentation_Value || attrs.Value || '';
    const body = m[2] || '';
    const featureId = featureIdFromBlock(body);
    const featureName = featureNameFromBlock(body);
    addObservedValue(features, featureId, featureName, value, productId);
  }
}

function featureToJson(feature) {
  const values = [...feature.values.values()]
    .filter(entry => entry.count >= 1)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.canonical.localeCompare(b.canonical);
    })
    .slice(0, MAX_VALUES_PER_FEATURE)
    .map(entry => ({
      canonical: entry.canonical,
      aliases: [...entry.aliases]
        .filter(alias => normalizedKey(alias) !== normalizedKey(entry.canonical))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, MAX_ALIASES_PER_VALUE)
    }))
    .sort((a, b) => a.canonical.localeCompare(b.canonical));

  return {
    featureId: feature.featureId,
    canonicalName: feature.canonicalName,
    displayName: feature.displayName,
    url: `https://icecat.biz/en/browse/features/${feature.featureId}.html`,
    vocabulary: values
  };
}

function build() {
  const files = productFiles();
  const features = new Map();

  for (const file of files) {
    scanProductFile(file, features);
  }

  const emitted = {};
  for (const [id, feature] of [...features.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const valueCount = feature.values.size;
    if (valueCount < MIN_VALUES_PER_FEATURE) continue;
    if (valueCount > MAX_VALUES_PER_FEATURE) continue;

    const asJson = featureToJson(feature);
    if (asJson.vocabulary.length < MIN_VALUES_PER_FEATURE) continue;
    emitted[id] = asJson;
  }

  const productBytes = files.reduce((n, file) => n + fs.statSync(file).size, 0);
  const sourceFiles = [
    {
      path: PRODUCTS_REL_DIR.replace(/\\/g, '/') + '/*.xml',
      bytes: productBytes,
      count: files.length
    },
    {
      path: FEATURE_VALUES_REL.replace(/\\/g, '/'),
      bytes: fileBytes(sourcePath(FEATURE_VALUES_REL)),
      sha256: sha256OfFileSync(sourcePath(FEATURE_VALUES_REL)),
      note: 'Fingerprint retained for Icecat controlled-value corpus context; product XML usage supplies the feature-to-value link.'
    },
    {
      path: FEATURES_REL.replace(/\\/g, '/'),
      bytes: fileBytes(sourcePath(FEATURES_REL)),
      sha256: sha256OfFileSync(sourcePath(FEATURES_REL)),
      note: 'Fingerprint retained for feature catalog context; product XML embeds English feature names used by this generator.'
    }
  ];
  const sourceSha256 = sha256OfString(JSON.stringify(sourceFiles));

  const output = {
    $schema: 'shopscout://normalization-libraries/icecatVocabulary/v1',
    version: 1,
    source: {
      vocabulary: 'Open Icecat',
      license: 'CC-BY-ND-4.0',
      url: 'https://icecat.biz/',
      sourceFile: PRODUCTS_REL_DIR.replace(/\\/g, '/') + '/*.xml',
      sourceFiles,
      sourceBytes: productBytes,
      sourceSha256,
      generatedAt: nowIso(),
      generator: GENERATOR_NAME,
      generatorVersion: GENERATOR_VERSION,
      note: 'Generated from observed English Open Icecat product XML ProductFeature values linked to Feature IDs. Identifier, numeric/unit, boolean, and long free-text fields are filtered out before emission.'
    },
    features: sortedObjectKeysNumeric(emitted)
  };

  const content = serializeJson(output);
  guardAgainstRegression(OUTPUT_NAME, content, { threshold: 0.25 });
  writeGeneratedFile(OUTPUT_NAME, content);

  return {
    outputName: OUTPUT_NAME,
    outputBytes: Buffer.byteLength(content, 'utf8'),
    sourceFiles,
    sourceSha256,
    productFileCount: files.length,
    scannedFeatureCount: features.size,
    featureCount: Object.keys(output.features).length,
    vocabularyEntryCount: Object.values(output.features).reduce(
      (n, f) => n + f.vocabulary.length,
      0
    )
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
    sourceFiles: data.source.sourceFiles || [],
    featureCount: featureIds.length,
    vocabularyEntryCount: Object.values(data.features).reduce(
      (n, f) => n + f.vocabulary.length,
      0
    ),
    isFixture: false
  };
}

if (require.main === module) {
  try {
    const summary = build();
    process.stdout.write(
      `${OUTPUT_NAME}: generated ${summary.featureCount} features, ` +
      `${summary.vocabularyEntryCount} entries from ${summary.productFileCount} product XML files, ` +
      `${summary.outputBytes} bytes\n`
    );
  } catch (err) {
    process.stderr.write(`build-icecat-vocabulary failed: ${err.message}\n`);
    process.stderr.write((err.stack || '') + '\n');
    process.exit(1);
  }
}

module.exports = { build, validate, GENERATOR_NAME, GENERATOR_VERSION };
