# vendor/

ShopScout is a Manifest V3 browser extension. MV3's default
content-security-policy forbids loading runtime scripts from CDNs, so browser
runtime libraries used by the extension are vendored here and copied into each
browser-specific `dist/` build.

## Shipped runtime libraries

| Library | File(s) | Purpose | License |
|---|---|---|---|
| Dexie | `dexie.min.js` | IndexedDB wrapper used by `data/db.js`. | Apache-2.0 / Public Domain |
| js-quantities | `quantities.min.js` | Third-party unit parsing/conversion engine used by `normalization/normalizers/measurement.js`. | MIT |
| AG Grid Community | `ag-grid/` | Product grid, column menus, sorting, filtering, grouping, resizing, and table rendering. | MIT |
| Shopify Product Taxonomy | `shopify-taxonomy/` | Category/vertical taxonomy source used by normalization and vertical mapping. | MIT |
| Google Product Taxonomy | `google-taxonomy.txt` | Product-category reference corpus for taxonomy matching. | Google taxonomy terms |

## Current pinned versions

See `vendor/VERSIONS.txt`.

## Notes

- Do not reintroduce Tabulator, PivotTable.js, jQuery, or jQuery UI here. The
  current grid is AG Grid Community.
- Keep vendored files pinned to explicit versions. Do not fetch `latest` during
  extension runtime.
- Unit normalization is intentionally backed by `js-quantities`; ShopScout's
  measurement normalizer only cleans messy retailer tokens, chooses canonical
  target units, and records provenance around that third-party conversion.
