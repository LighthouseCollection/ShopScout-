# shared/

Renderer-agnostic application logic that survives Task 11 grid removal and is
intended to be consumed by both the upcoming Claude grid rebuild and the Codex
grid rebuild (and any future replacement).

These modules touch product data, projections, and revision-safe edits. They
deliberately have **no dependency on the grid renderer**.

## What's here

### `values/cellValues.js`

Value normalization, rank computation, and the stable-color hash used for pill
backgrounds. Extracted from the old `data/cellFormatters.js`; the Tabulator
formatter wrappers (`cellPill`, `cellYesNo`, `cellStarsVisual`, `cellWithRank`)
that wrapped these primitives were grid-specific and were deleted.

Public surface — `window.ShopScoutValues`:

| Method | Purpose |
|---|---|
| `prettify(value)` | Normalize to display-friendly string (units, time, dimensions). |
| `parseNumeric(value)` | Numeric scalar for sort/rank. |
| `stableColor(text)` | `{bg, fg, border}` HSL colors keyed by text hash. |
| `splitToPills(text)` | Multi-value split for pill rendering, or `null`. |
| `computeRanks(rows, field, polarity)` | Annotate `row._ssRanks` with `'best'` per field. |
| `polarityForField(field)` | `'low'` or `'high'` (price-like fields are low-better). |

### `projections/specProjection.js`

Product → flat-row projection that hoists `product.specs[]` into top-level
`spec:<CanonicalKey>` columns. Reusable by any grid that wants a flat row
shape for a Products-as-Rows view. Extracted from the old
`table/productRows.js`; the pivot-specific `flattenForPivot` was deleted along
with the pivot view.

Public surface — `window.ShopScoutProjections`:

| Method | Purpose |
|---|---|
| `flattenSpecs(rows, options?)` | Flat rows with `spec:<key>: value` keys; pre-computes price/rating ranks via `ShopScoutValues`. |

### `edits/ratingWriter.js`

Revision-safe user-rating write. Extracted from the old `table/myRating.js`;
the widget-rendering and DOM-delegation halves of that file were grid-coupled
and were deleted.

Public surface — `window.ShopScoutEdits`:

| Method | Purpose |
|---|---|
| `normalizeRating(value)` | Clamp to integer 0..5. |
| `writeRating({repo, productId, value})` | Reads product → derives baseRevision → calls `repo.updateProduct` with `source: 'myrating-edit'`. Returns the repo result (extended with `currentProduct`). |
| `mirrorLegacyStorage({chrome, productId, productUrl, value})` | Updates the legacy `chrome.storage.local` blob so the popup view stays in sync. |

## How this gets consumed

Phase 2 of Task 11 forks the grid rebuild:

- `grid-rebuild-claude/` will import these via the IIFE globals
  (`ShopScoutValues`, `ShopScoutProjections`, `ShopScoutEdits`).
- `grid-rebuild-codex/` will do the same.

Both rebuilds plug these into their own SlickGrid formatters / editors /
projection wiring. The contract is the public API surface above — internal
helpers are not stable.

## What is NOT here

These are intentionally **not** in `shared/`:

- **`data/`** — Dexie schema, productRepo, viewsRepo, migrate, canonical,
  openFactsEnrich. These are the storage layer; both rebuilds consume them
  directly from `data/`.
- **`state/`** — locks, eventBus, appStore, actions, selectors. These are the
  state contract layer; both rebuilds consume them directly from `state/`.
- **`security/`** — sanitize.js. URL/HTML sanitization is project-wide.
- **`ui/`** — modal/toast/confirm/prompt primitives. Project-wide.
- **`utils.js`** — `SS.esc` / `SS.escAttr` / `SS.sanitizeUrl` / etc. The
  application's universal helpers. Project-wide.

If something belongs in `data/` or `state/` semantically, it stays there. The
`shared/` directory is specifically for **logic that used to live inside the
removed grid layer** but isn't tied to the renderer.
