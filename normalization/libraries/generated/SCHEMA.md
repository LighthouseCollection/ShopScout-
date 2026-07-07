# Generated Normalization Libraries — JSON Schema Contract

This document pins the JSON shape for every file that
`scripts/build-normalization-libraries/` writes into this directory. It is the
contract between Claude (producer, offline build) and Codex (consumer,
extension runtime).

**Nothing in this directory is hand-edited.** Every file is regenerated from
the raw corpus under `data-sources/icecat/` (a git-ignored Windows directory
junction to `D:\icecat-data\`). Curated hardcoded rules stay in
`normalization/libraries/defaultRules.js`. User-approved rules stay in the
`userRules.js` IndexedDB overlay.

## Consumer contract (Codex runtime)

The runtime MUST behave as follows:

1. **Fail-safe load.** If a generated JSON file is missing, unreadable, or
   fails schema validation, the runtime falls back to `defaultRules.js` and
   `userRules.js` alone. The extension continues to work; a `console.warn`
   is emitted once per file. Never throw during load.
2. **Precedence.** For every canonical field / value lookup:
   `userRules > defaultRules > generated libraries`. Generated data extends
   the vocabulary — it never overrides curated or user-approved rules.
3. **No raw XML at runtime.** The extension only reads JSON. Nothing under
   `data-sources/` ever ships in the extension package.
4. **No mutation.** The runtime treats loaded JSON as read-only. Rebuild the
   file to change it.
5. **Attribution.** The extension ships a `NOTICE` file crediting Icecat
   (CC-BY-ND) and Schema.org. Removing that NOTICE is a license violation.

## Producer contract (Claude build scripts)

Every generator script MUST:

1. Read from `data-sources/icecat/` (relative path from repo root — the
   junction handles the actual location on disk).
2. Stream-parse large `.xml.gz` sources. Never load an uncompressed source
   fully into memory. Use `sax` or a similar SAX/streaming parser through
   `zlib.createGunzip()`.
3. Write output as **UTF-8, LF line endings, 2-space indent, keys sorted by
   canonical id or name**. Reproducible builds — the same source data must
   produce byte-identical output.
4. Compute `sha256` of every source file and record it in `BUILD_MANIFEST.json`.
5. Emit a `source` block with license, source file names, byte counts, and
   generator version at the top of every generated JSON file.
6. Refuse to overwrite output if the source data looks incomplete or
   dramatically smaller than the prior build. Exit non-zero; do not
   silently regress.

## Files in this directory

| File | Purpose | Source | Est. size |
|---|---|---|---|
| `schemaOrgProperties.json` | Path 1 — canonical column names from Schema.org Product + Offer vocabulary | `data-sources/icecat/schema-org/schemaorg-current-https-properties.csv` | 30-100 KB |
| `icecatVocabulary.json` | Path 2 — normalized enum values per Icecat feature (e.g., all valid `Color` values) | `data-sources/icecat/refs/FeatureValuesVocabularyList.xml.gz` | 2-5 MB |
| `icecatCategoryFeatures.json` | Path 3 — which features apply to which Icecat category | `data-sources/icecat/refs/CategoryFeaturesList.xml.gz` | 5-10 MB |
| `BUILD_MANIFEST.json` | Meta — generator versions, source fingerprints, output row counts | (all of the above) | 2-5 KB |

Any file totaling more than **20 MB** MUST be flagged in code review — either the source has grown or the generator is emitting redundant data.

---

## 1. `schemaOrgProperties.json`

**Purpose.** Provide Schema.org's canonical property names for Product and
Offer as the target canonical column names in ShopScout's normalization
pipeline. Solves the "Colour → color, Size Name → size" mapping problem with
an industry-standard vocabulary that survives future Schema.org releases.

**Shape:**

```json
{
  "$schema": "shopscout://normalization-libraries/schemaOrgProperties/v1",
  "version": 1,
  "source": {
    "vocabulary": "Schema.org",
    "release": "27.0",
    "url": "https://schema.org/",
    "license": "CC-BY-SA-3.0",
    "sourceFile": "data-sources/icecat/schema-org/schemaorg-current-https-properties.csv",
    "sourceBytes": 512192,
    "sourceSha256": "...64 hex chars...",
    "generatedAt": "2026-07-07T22:00:00Z",
    "generator": "scripts/build-normalization-libraries/build-schema-org-properties.js",
    "generatorVersion": 1
  },
  "properties": [
    {
      "canonical": "color",
      "displayName": "Color",
      "aliases": [],
      "expectedTypes": ["Text", "URL"],
      "domains": ["Product"],
      "description": "The color of the product.",
      "url": "https://schema.org/color"
    },
    {
      "canonical": "size",
      "displayName": "Size",
      "aliases": [],
      "expectedTypes": ["Text", "QuantitativeValue", "SizeSpecification", "DefinedTerm"],
      "domains": ["Product"],
      "description": "A standardized size of a product or creative work.",
      "url": "https://schema.org/size"
    }
  ]
}
```

**Property inclusion rule.** A Schema.org property is included iff its
`domainIncludes` intersects `{Product, Offer}` OR any of their supertypes
that a product would naturally use (`Thing`, `Intangible`, `PhysicalObject`).
Curated: prefer explicit `Product` / `Offer` domains only, to keep the file
small.

**Field notes:**
- `canonical` — Schema.org exact id (lowercase, no spaces). Used as the
  canonical field key in ShopScout's `fieldAliases`.
- `displayName` — Title Case for UI rendering.
- `aliases` — additional string aliases if Schema.org documents multiple
  names for the same concept (rare — usually empty).
- `expectedTypes` — Schema.org `rangeIncludes`, informational only. Runtime
  may use this later to pick a formatter (Text vs QuantitativeValue).
- `domains` — subset of `{Product, Offer, ...}` for filter/inspection.
- `description` — Schema.org's own definition text.
- `url` — canonical Schema.org URL for the property (attribution + provenance).

**Consumer usage in Codex's runtime.**
- Build an alias-to-canonical map at load time:
  `properties.flatMap(p => [[p.canonical, p.canonical], ...p.aliases.map(a => [a.toLowerCase(), p.canonical])])`.
- Union into `ShopScoutNormalizationRules.fieldAliases` on load, but only
  where the canonical does not already exist in `defaultRules` (precedence
  rule above).

**Invariants:**
- `properties[].canonical` values are unique across the array.
- Array is sorted by `canonical` ascending.
- `version` is a monotonically-increasing integer. Bump on any breaking
  shape change.

---

## 2. `icecatVocabulary.json`

**Purpose.** Provide Icecat's normalized enum vocabularies keyed by feature.
Extends ShopScout's `enums` block (currently ~30 hardcoded values across 5
fields) with thousands of canonical values across hundreds of features.

**Shape:**

```json
{
  "$schema": "shopscout://normalization-libraries/icecatVocabulary/v1",
  "version": 1,
  "source": {
    "vocabulary": "Open Icecat",
    "license": "CC-BY-ND-4.0",
    "url": "https://icecat.biz/",
    "sourceFile": "data-sources/icecat/refs/FeatureValuesVocabularyList.xml.gz",
    "sourceBytes": 46496359,
    "sourceSha256": "...64 hex chars...",
    "generatedAt": "2026-07-07T22:00:00Z",
    "generator": "scripts/build-normalization-libraries/build-icecat-vocabulary.js",
    "generatorVersion": 1
  },
  "features": {
    "12345": {
      "featureId": 12345,
      "canonicalName": "color",
      "displayName": "Color",
      "url": "https://icecat.biz/en/browse/features/12345.html",
      "vocabulary": [
        {
          "canonical": "Navy Blue",
          "aliases": ["navy", "midnight blue", "dark navy", "dark blue"]
        },
        {
          "canonical": "Black",
          "aliases": ["jet black", "matte black"]
        }
      ]
    }
  }
}
```

**Field notes:**
- Top-level `features` is an OBJECT keyed by string-form `featureId` (JSON
  keys are strings; consumers may parse to number if needed). Object shape
  chosen over array so lookups by feature id are O(1) without index building.
- `canonicalName` — lowercased, space-separated. Used to match against
  ShopScout's `fieldAliases` canonical key.
- `displayName` — Title Case for UI + matches `defaultRules.canonicalFields`
  values.
- `vocabulary` is an ARRAY of `{canonical, aliases}` pairs. Order preserved
  from Icecat's source (usually alphabetical or by frequency).
- `canonical` values within a feature's vocabulary are unique
  (case-insensitive).
- `aliases` may include multiple language variants only when the alias is
  clearly English (`navy blue` in an EN-scope catalog). Non-English aliases
  are filtered out.

**Consumer usage in Codex's runtime.**
- Build the merged enum shape at load time:
  ```js
  const enums = { ...defaultRules.enums };
  for (const feature of Object.values(generated.features)) {
    if (!enums[feature.displayName]) {
      enums[feature.displayName] = Object.fromEntries(
        feature.vocabulary.map(entry => [entry.canonical, entry.aliases])
      );
    }
    // Precedence rule: do NOT overwrite curated defaults. Curated defaultRules
    // always wins for the same displayName+canonical pair.
  }
  ```
- Feature id is preserved so downstream category-features lookup
  (`icecatCategoryFeatures.json`) can cross-reference by id.

**Invariants:**
- Every `featureId` (JSON key) equals the `featureId` field inside the value.
- Object keys are sorted numerically (as string) ascending.
- Within `vocabulary`, `canonical` values are unique per feature
  (case-insensitive).
- `aliases` do not include the `canonical` value itself (implicit).

---

## 3. `icecatCategoryFeatures.json`

**Purpose.** For each Icecat category, list which features apply. Powers
category-aware default spec column selection so
`pickDefaultSpecColumns(products)` can prefer "features that Icecat considers
relevant for this category" instead of ranking by observed frequency alone.

**Shape:**

```json
{
  "$schema": "shopscout://normalization-libraries/icecatCategoryFeatures/v1",
  "version": 1,
  "source": {
    "vocabulary": "Open Icecat",
    "license": "CC-BY-ND-4.0",
    "url": "https://icecat.biz/",
    "sourceFile": "data-sources/icecat/refs/CategoryFeaturesList.xml.gz",
    "sourceBytes": 1597854683,
    "sourceSha256": "...64 hex chars...",
    "generatedAt": "2026-07-07T22:00:00Z",
    "generator": "scripts/build-normalization-libraries/build-icecat-category-features.js",
    "generatorVersion": 1
  },
  "categories": {
    "377": {
      "categoryId": 377,
      "path": ["Printer Supplies", "Printer Cartridges"],
      "displayName": "Printer Cartridges",
      "url": "https://icecat.biz/en/browse/categories/377.html",
      "features": [
        { "featureId": 12345, "canonicalName": "color", "displayName": "Color", "mandatory": true, "order": 1 },
        { "featureId": 5432, "canonicalName": "compatible printer", "displayName": "Compatible Printer", "mandatory": false, "order": 5 }
      ]
    }
  }
}
```

**Field notes:**
- Top-level `categories` is an OBJECT keyed by `categoryId` (string).
- `path` — the Icecat taxonomy path as an array of segment names, root
  first. Consumers can join with " > " for display.
- `features` array is sorted by `order` ascending. `order` reflects Icecat's
  display priority for that category. Consumers use it as a tiebreaker
  when picking default spec columns.
- `mandatory` — Icecat's own indicator. Consumers may treat mandatory
  features as always-visible in the products table.

**Consumer usage in Codex's runtime.**
- `pickDefaultSpecColumns(products, listContext)` — for a list where every
  product resolves to the same Icecat categoryId (via
  `taxonomyBridge.categoryContextForProduct`), start the default column
  set with `mandatory: true` features, then add features in `order`
  ascending until the visible column budget is filled.
- Falls back to the current frequency heuristic when: (a) products don't
  share a category, (b) the category isn't in this file, or (c) the file
  fails to load.

**Invariants:**
- Every `categoryId` (JSON key) equals the `categoryId` field.
- Object keys are sorted numerically ascending.
- Within `features`, `featureId` values are unique per category.
- `features` is sorted by `order` ascending; within same `order`, by
  `featureId` ascending.

---

## 4. `BUILD_MANIFEST.json`

**Purpose.** Metadata about the current generated build — generator
versions, source file fingerprints, output row counts, generation timestamp.
Consumers may check this file to detect stale generated data; CI may check
it against the current source data to gate merges.

**Shape:**

```json
{
  "$schema": "shopscout://normalization-libraries/build-manifest/v1",
  "version": 1,
  "buildTool": "shopscout-build-normalization-libraries",
  "buildToolVersion": 1,
  "generatedAt": "2026-07-07T22:15:00Z",
  "sourceCorpus": {
    "root": "data-sources/icecat/",
    "junctionTarget": "D:\\icecat-data\\",
    "note": "Windows directory junction; git-ignored; per-machine local corpus."
  },
  "outputs": {
    "schemaOrgProperties.json": {
      "generator": "build-schema-org-properties.js",
      "generatorVersion": 1,
      "sourceFiles": [
        {
          "path": "data-sources/icecat/schema-org/schemaorg-current-https-properties.csv",
          "bytes": 512192,
          "sha256": "...64 hex chars..."
        }
      ],
      "outputBytes": 12345,
      "outputSha256": "...64 hex chars...",
      "rowCount": 87
    },
    "icecatVocabulary.json": {
      "generator": "build-icecat-vocabulary.js",
      "generatorVersion": 1,
      "sourceFiles": [
        {
          "path": "data-sources/icecat/refs/FeatureValuesVocabularyList.xml.gz",
          "bytes": 46496359,
          "sha256": "...64 hex chars..."
        }
      ],
      "outputBytes": 3145728,
      "outputSha256": "...64 hex chars...",
      "featureCount": 4200,
      "vocabularyEntryCount": 51230
    },
    "icecatCategoryFeatures.json": {
      "generator": "build-icecat-category-features.js",
      "generatorVersion": 1,
      "sourceFiles": [
        {
          "path": "data-sources/icecat/refs/CategoryFeaturesList.xml.gz",
          "bytes": 1597854683,
          "sha256": "...64 hex chars..."
        }
      ],
      "outputBytes": 8388608,
      "outputSha256": "...64 hex chars...",
      "categoryCount": 8931,
      "featureAssociationCount": 143210
    }
  }
}
```

**Consumer usage.** Runtime does NOT read this file — it's build-time
metadata. Use cases:
- `tests/generated-libraries.test.js` verifies each output file's actual
  sha256 matches the manifest, and row counts are within expected ranges.
- CI may compare source fingerprints against a pinned known-good build to
  gate merges when the raw corpus changes.

---

## Fail-safe example — runtime load pattern

```js
// normalization/libraries/generated.js (Codex to write)
(function initShopScoutGeneratedRules(root) {
  const NS = (root.ShopScoutGeneratedRules = root.ShopScoutGeneratedRules || {});
  const files = ['schemaOrgProperties', 'icecatVocabulary', 'icecatCategoryFeatures'];

  const loaded = {};
  for (const name of files) {
    try {
      // XHR / fetch / import — implementation TBD by Codex per extension conventions.
      const data = loadJsonSync(chrome.runtime.getURL(`normalization/libraries/generated/${name}.json`));
      if (validateSchema(name, data)) {
        loaded[name] = data;
      } else {
        console.warn(`ShopScout: generated ${name}.json failed schema validation; falling back to defaults.`);
      }
    } catch (err) {
      console.warn(`ShopScout: generated ${name}.json missing or unreadable; falling back to defaults.`, err?.message);
    }
  }
  Object.assign(NS, loaded);
})(globalThis);
```

The runtime NEVER fails to boot because a generated file is missing. It
degrades to the curated + user rules.

## Reproducibility and licensing

- All output is deterministic: same source bytes → same output bytes. Sort
  order, whitespace, line endings pinned above.
- Icecat data is CC-BY-ND. Generated JSON is a DERIVATIVE — the aliases
  we extract are ours (not modified Icecat data), but the underlying
  canonical values ARE Icecat's vocabulary. The `NOTICE` file in the
  extension package attributes both Icecat and Schema.org.
- Schema.org is CC-BY-SA. Attribution required; sharealike doesn't propagate
  because we're extracting a vocabulary, not redistributing the RDFa/JSON-LD.
- Do NOT publish raw Icecat XML in any downstream artifact. The build
  scripts refuse to run if `data-sources/icecat/` looks like it was copied
  into the repo instead of accessed via junction.

## Change control

- Bumping any file's top-level `version` integer is a breaking change.
  Codex's runtime must handle unknown `version` values by rejecting the
  file (fail-safe path).
- Additive fields inside a versioned shape are non-breaking; Codex ignores
  fields it doesn't recognize.
- Renaming or removing fields is breaking. Bump `version` and coordinate.

---

**Handoff.** When Codex is ready to consume this schema, either approve
in `AGENT_CHANGELOG.md` or comment inline in this file with proposed
changes. Once approved, Claude writes the generators; Codex writes the
consumer loader + runtime merge logic. Meet at Phase 3.
