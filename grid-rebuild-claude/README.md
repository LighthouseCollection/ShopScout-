# grid-rebuild-claude/

Claude's Phase 2 SlickGrid rebuild for the ShopScout product grid.
Runs in parallel with `grid-rebuild-codex/`. Both consume the same
`shared/`, `data/`, `state/`, `security/`, `ui/` surfaces and mount on
`#productGrid` via `globalThis.ShopScoutGrid.render()`.

## Three-layer architecture

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1 — Product Data Model                           │
│  data/productRepo.js (Dexie) + data/viewsRepo.js        │
│  state/locks.js for revision-safe writes                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 2 — View Projection Layer (THIS FOLDER)          │
│  projections/productsAsRows.js    (Projection A)        │
│  projections/productsAsColumns.js (Projection B)        │
│  projections/matrixModes.js       (Basic / Detailed)    │
│  state/gridState.js               (filters, sort, etc.) │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 3 — SlickGrid Renderer (THIS FOLDER)             │
│  renderer/slickGridRenderer.js  (SlickGrid wiring)      │
│  renderer/columnDefs.js         (column definitions)    │
│  renderer/formatters.js         (cells: pills, stars…)  │
│  renderer/editors.js            (inline edits)          │
│  edits/productEditor.js         (_revision-safe writes) │
└─────────────────────────────────────────────────────────┘
                          ↓
                    SlickGrid DOM
```

The data layer never imports the renderer. The projection layer never
imports the renderer. The renderer never reaches past projections into
the data layer. Replacing SlickGrid means replacing only `renderer/` +
some of `mount.js`; everything else stays.

## Views

**Products-as-Rows (Projection A)** — products are rows, spec/field
columns. Used for browsing, filtering, sorting, grouping, bulk actions,
inline edits. Default view.

**Products-as-Columns (Projection B)** — specs are rows, products are
columns. Used for side-by-side comparison. Two matrix modes:

- **Basic Matrix** — Brand, Source, Price, Rating, User rating,
  Availability, key buying factors per category, Notes
- **Detailed Matrix** — every selected spec, raw vs corrected values,
  conflict flags, source/evidence indicators, confidence

Both matrix modes are projections of the same product data; switching
modes does not mutate anything.

## State model

`state/gridState.js` carries:

| Key | Meaning |
|---|---|
| `mode` | `'rows'` or `'columns'` |
| `matrix` | `'basic'` or `'detailed'` (when mode is `'columns'`) |
| `filters` | `[{ field, op, value, conj? }]` |
| `sort` | `[{ field, dir }]` (multi-column) |
| `group` | field id or `null` |
| `selectedProductIds` | `Set<string>` |
| `columnVisibility` | `{ field: boolean }` |
| `columnOrder` | `string[]` |
| `columnWidths` | `{ field: number }` |
| `pinnedColumns` | `string[]` |
| `savedViewId` | string or `null` |

State is plain serializable JSON so saved views round-trip through
`SSViewsRepo` without surprises. Mutations go through `update(patch)`
which returns a new state object — never in-place edits.

## Edits + revision conflict

Every cell edit goes through `edits/productEditor.js`, which:

1. Reads the latest product from `SSProductRepo`.
2. Captures `_revision` as `baseRevision`.
3. Calls `repo.updateProduct(id, patch, { listId, baseRevision, source: 'grid-edit' })`.
4. On `revision-conflict`, surfaces the conflict to the renderer so
   the cell flashes and the row refreshes to the latest stored value.

No edit path skips this — the renderer's editor adapter calls
`productEditor.write(...)` and never `repo.updateProduct(...)` directly.

## SlickGrid integration

SlickGrid Universal must be vendored before this code activates. See
`vendor/slickgrid/README.txt` for the file list and source. Until
vendored, `renderer/slickGridRenderer.js` mounts a clear "drop these
files" placeholder and the rest of the dashboard (capture, detail
page, AI, settings, feedback) continues to work normally.

Once vendored:

- `renderer/columnDefs.js` builds SlickGrid column defs from the
  active projection.
- SlickGrid's DataView handles filtering, grouping, aggregation,
  multi-column sort.
- Editors come from SlickGrid's Editors module; `editors.js` wires
  them to `productEditor.write`.
- Formatters in `formatters.js` are SlickGrid-shaped (`function(row,
  cell, value, columnDef, rowData)`) and use `ShopScoutValues`
  primitives (`prettify`, `stableColor`, `splitToPills`).

No DOM patching, no SlickGrid-internal monkey-patches. Customization
is done via configuration, column defs, formatters, editors, plugins,
and grid events.

## Tests

`tests/projections.test.js` — Projection A and B are pure functions of
`{products, state}`. Tested without any DOM or SlickGrid dependency.

`tests/state.test.js` — `update(state, patch)` returns immutable
copies; serialize / deserialize round-trips cleanly.

`tests/edits.test.js` — `productEditor.write` calls
`repo.updateProduct` with `baseRevision`; conflict path returns the
fresh product and a conflict flag.

`tests/grid-mount.test.js` — asserts the mount registers
`globalThis.ShopScoutGrid.render` and the renderer detects the
vendored library presence/absence correctly.

## Public surface

`globalThis.ShopScoutGrid` after load:

- `render()` — paint the active projection into `#productGrid`
- `state` — current `GridState` (read-only; use `dispatch` to mutate)
- `dispatch(action)` — apply state changes
- `subscribe(listener)` — observe state changes
- `getProjection()` — current projected `{columns, rows, ...}`

`comparison.js`'s `renderAll()` already delegates to
`globalThis.ShopScoutGrid.render()` when present.

## What's NOT here

- The data layer (Dexie, repo, views, migration, canonical, openFacts)
  stays under `data/`. Both grid forks consume from it.
- Renderer-agnostic value/projection/edit logic stays under `shared/`.
  Both forks consume `ShopScoutValues`, `ShopScoutProjections`,
  `ShopScoutEdits`.
- Modal/toast/confirm/prompt primitives stay under `ui/`.
- URL/HTML sanitizers stay under `security/`.

This folder owns ONLY the projection layer, the SlickGrid renderer,
the edit adapter, and the mount glue.
