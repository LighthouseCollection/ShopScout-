# Normalization Library Generators

Offline build scripts that read the raw Icecat + Schema.org corpus under
`data-sources/icecat/` (a git-ignored Windows directory junction to
`D:\icecat-data\`) and produce compact JSON lookup files in
`normalization/libraries/generated/`. Consumers of the generated files are
described in
[`normalization/libraries/generated/SCHEMA.md`](../../normalization/libraries/generated/SCHEMA.md).

## Prerequisites

- Node.js 20+ (uses built-ins only: `fs`, `zlib`, `crypto`, `readline`,
  `stream`).
- The corpus mounted at `data-sources/icecat/`:
  - `data-sources/icecat/schema-org/schemaorg-current-https-properties.csv`
  - `data-sources/icecat/refs/CategoryFeaturesList.xml.gz`
  - `data-sources/icecat/refs/FeatureValuesVocabularyList.xml.gz` (deferred)

## Usage

```bash
# From repo root
node scripts/build-normalization-libraries/build-all.js
```

Individual generators:

```bash
node scripts/build-normalization-libraries/build-schema-org-properties.js
node scripts/build-normalization-libraries/build-icecat-category-features.js
node scripts/build-normalization-libraries/build-icecat-vocabulary.js   # currently a stub
```

Each generator:

- Reads `data-sources/icecat/*` (throws if missing).
- Streams large `.xml.gz` inputs — never loads uncompressed data into
  memory in full.
- Emits deterministic UTF-8 + LF + 2-space JSON.
- Refuses to overwrite the output if the row count drops sharply vs the
  prior build (guards against source-file damage).
- Updates `BUILD_MANIFEST.json` with sha256s + row counts.

## Current status

| Generator | Real / stub | Output | Notes |
|---|---|---|---|
| `build-schema-org-properties.js` | Real | 87 properties, ~45 KB | Filter: `domainIncludes` ⊇ {Product, Offer} plus a small supertype allowlist (`name`, `description`, `image`, `url`, `alternateName`). Identifier properties (ASIN, GTIN, SKU, MPN, model, serialNumber, productID, UPC/EAN/ISBN) are explicitly excluded — they belong in the identifier/matching model, not attribute normalization. |
| `build-icecat-category-features.js` | Real (MVP) | ~thousands of categories | Streams the 1.5 GB gzip. Emits path, displayName, matchTerms (heuristic from path), and feature id list per category. |
| `build-icecat-vocabulary.js` | Stub | Preserves fixture | Real generation requires cross-referencing FeaturesList + FeatureValuesVocabularyList + product XMLs to link vocabulary values to specific features. Deferred as follow-up. |
| `build-esci-substitutes.js` | Stub (Track A) | Preserves fixture | Real generation requires parsing the 700 MB Amazon ESCI dataset (parquet). Adds a substitute-pair scoring signal to `normalization/matching.js`. Fixture is a small illustrative set; runtime is fail-safe. |

## Fail-safe

Consumers of the generated JSON in `normalization/libraries/generated/*.json`
implement fail-safe fallback: if a file is missing, unreadable, or fails
schema validation, the ShopScout runtime falls back to `defaultRules.js` +
`userRules.js`. See the runtime consumer contract in
`normalization/libraries/generated/SCHEMA.md`.

## License

The generated data is derived from:

- **Icecat Open Icecat** — CC-BY-ND-4.0. Attribution required. The extension
  ships a `NOTICE` file crediting Icecat as a data source.
- **Schema.org** — CC-BY-SA-3.0. Attribution required.

Raw corpus files (under `data-sources/icecat/`) are NOT redistributed. Only
derived, compact JSON is included in the extension package.
