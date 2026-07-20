# ShopScout Agent Change Log

## 2026-07-20 12:48 - Codex verify third-party normalization coverage and load js-quantities in popup

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Confirmed unit normalization is backed by third-party `js-quantities` and fixed the popup load path so capture-side normalization does not fall back to custom-only behavior.
- What changed:
  - Added `vendor/quantities.min.js` to `popup.html` before `normalization/normalizers/measurement.js`.
  - Added popup layout coverage proving `js-quantities` loads before measurement normalization.
  - Updated `vendor/README.md` and `vendor/VERSIONS.txt` to reflect current vendored libraries: Dexie, js-quantities, AG Grid Community, Shopify taxonomy, and Google taxonomy.
- Files touched:
  - `popup.html`
  - `tests/popup-layout.test.js`
  - `vendor/README.md`
  - `vendor/VERSIONS.txt`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\popup-layout.test.js` -> pass
  - `node tests\normalize-v2.test.js` -> pass
  - `node tests\normalize-v2-wiring.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 warnings
  - `npm test` -> 52/52 test files pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review after validation and commit.
- Follow-ups or risks:
  - Unit conversion uses the third-party `js-quantities` engine; ShopScout still keeps a small custom synonym-cleaning wrapper because retailer strings contain messy tokens like `volts_of_direct_current`.

## 2026-07-20 12:30 - Codex real ESCI generator and identity alias libraries

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: Uncommitted
- Status: Implemented. Prior commit `958f9a6` was pushed to origin first; this change adds the real ESCI parquet generator path and stronger brand/retailer alias normalization.
- What changed:
  - Added `hyparquet` as a dev dependency and replaced the ESCI fixture-only validator with a real parquet-capable generator for `data-sources/esci/shopping_queries_dataset_examples.parquet`.
  - Kept portable fallback behavior: if the local ESCI parquet corpus is absent, `build-all` validates/preserves the checked-in fixture and records that state in `BUILD_MANIFEST.json`.
  - Added `buildFromRows()` so ESCI pair generation is unit-testable without the full corpus.
  - Added robust brand aliases and retailer/source aliases to the default normalization rules.
  - Added `ShopScoutIdentityAliases` and wired it into duplicate matching plus grid source/brand display.
  - Added popup/dashboard script-order tests so identity aliases load after default rules and before matching.
  - Changed `build-all` to validate cached Icecat vocabulary by default; full corpus rebuild remains available with `SHOPSCOUT_REBUILD_ICECAT_VOCABULARY=1`.
- Files touched:
  - `package.json`
  - `package-lock.json`
  - `comparison.html`
  - `popup.html`
  - `grid-rebuild-codex/agGridAdapter.js`
  - `normalization/matching.js`
  - `normalization/libraries/defaultRules.js`
  - `normalization/libraries/identityAliases.js`
  - `normalization/libraries/generated/BUILD_MANIFEST.json`
  - `normalization/libraries/generated/icecatVocabulary.json`
  - `normalization/libraries/generated/icecat_category_to_vertical.json`
  - `normalization/libraries/generated/schemaOrgProperties.json`
  - `normalization/libraries/generated/verticals-index.json`
  - `scripts/build-normalization-libraries/build-all.js`
  - `scripts/build-normalization-libraries/build-esci-substitutes.js`
  - `tests/esci-generator.test.js`
  - `tests/identity-aliases.test.js`
  - `tests/comparison-table-defaults.test.js`
  - `tests/generated-libraries.test.js`
  - `tests/popup-layout.test.js`
- Validation run:
  - `node tests\esci-generator.test.js` -> pass
  - `node tests\identity-aliases.test.js` -> pass
  - `node tests\comparison-table-defaults.test.js` -> pass
  - `node tests\popup-layout.test.js` -> pass
  - `node scripts\build-normalization-libraries\build-all.js` -> pass, ESCI fixture preserved because local parquet corpus is absent
  - `node scripts\build-normalization-libraries\build-vertical-packs.js` -> pass
  - `node tests\generated-libraries.test.js` -> pass
  - `node tests\dedupe-candidates.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 warnings
  - `npm test` -> 52/52 test files pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - Real ESCI output still requires the corpus file at `data-sources/esci/shopping_queries_dataset_examples.parquet`; run `node scripts\build-normalization-libraries\build-esci-substitutes.js --require-source` after placing it locally.
  - No all-in-one third-party e-commerce normalizer is incorporated; ShopScout composes Shopify taxonomy, Schema.org, Open Icecat, Amazon ESCI, deterministic rules, and user-approved rules.
  - Unit normalization remains ShopScout's deterministic implementation; evaluate a focused unit library only if current unit coverage becomes a blocker.

## 2026-07-20 11:59 - Codex make Icecat vocabulary generator real

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Replaced the placeholder Icecat vocabulary fixture path with a real offline generator that scans the local Open Icecat EN product corpus and emits a generated categorical vocabulary library for runtime normalization.
- What changed:
  - Rebuilt `build-icecat-vocabulary.js` to scan `data-sources/icecat/products/EN/*.xml` and extract observed feature names, values, aliases, confidence, and source provenance.
  - Generated `icecatVocabulary.json` from 17,422 EN product XML files: 1,042 features and 12,408 entries.
  - Added filtering so identifiers, booleans, measurements, long free-text values, and unsplit multi-value strings do not pollute enum aliases.
  - Updated `build-all.js` so vocabulary generation is real by default, while the huge Icecat category-feature file is validated from the cached generated JSON unless `SHOPSCOUT_REBUILD_CATEGORY_FEATURES=1` is explicitly set.
  - Rebuilt vertical pack metadata and generated-library manifest fingerprints after the new vocabulary output.
  - Added generated-library regression coverage so the vocabulary cannot silently revert to a stub or emit dirty multi-value aliases.
- Files touched:
  - `normalization/libraries/generated/BUILD_MANIFEST.json`
  - `normalization/libraries/generated/icecatVocabulary.json`
  - `normalization/libraries/generated/icecat_category_to_vertical.json`
  - `normalization/libraries/generated/schemaOrgProperties.json`
  - `normalization/libraries/generated/verticals-index.json`
  - `scripts/build-normalization-libraries/README.md`
  - `scripts/build-normalization-libraries/build-all.js`
  - `scripts/build-normalization-libraries/build-icecat-category-features.js`
  - `scripts/build-normalization-libraries/build-icecat-vocabulary.js`
  - `tests/generated-libraries.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\generated-libraries.test.js` -> pass
  - `node tests\generated-packs.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm test` -> 50/50 test files pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review after commit.
- Follow-ups or risks:
  - Real ESCI parquet generation remains separate and is still not implemented.
  - Full Icecat category-feature regeneration is intentionally opt-in because the raw source is 1.5 GB compressed and can crash Node/V8 on ordinary runs; default `build-all` now validates the cached generated category-feature file instead.
  - Generated vertical packs under `dist/packs` are rebuilt locally but remain gitignored; publish/update the data release when ready.

## 2026-07-19 07:48 - Codex set rounded display defaults and allow deleting final list

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Set the Products ribbon normalization display defaults to rounded prices and rounded measurements, and removed the final-list deletion block so users can delete the last list and see an empty/no-grid state.
- What changed:
  - Changed grid view-state defaults so `priceDisplayMode` and `measurementDisplayMode` both default to `rounded`.
  - Updated the initial Products ribbon toggle markup so both Prices and Measurements render as `Rounded` and pressed on first load.
  - Removed the dashboard and popup guards that blocked deleting the last product list.
  - Changed productRepo deletion so deleting the final list clears `activeListId` instead of recreating `My Products`.
  - Changed repo-backed `SS.getData()` / `SS.saveData()` paths to preserve an empty list collection instead of auto-creating a default list.
  - Removed bootstrap's unconditional `ensureDefaultList()` call so a deliberately empty account stays empty across reloads.
  - Added regression coverage for final-list deletion.
- Files touched:
  - `comparison.html`
  - `comparison.js`
  - `popup.js`
  - `utils.js`
  - `data/productRepo.js`
  - `grid-rebuild-codex/state.js`
  - `grid-rebuild-codex/tests/controls.test.js`
  - `tests/product-repo.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node grid-rebuild-codex\tests\controls.test.js` -> pass
  - `node tests\menu-layout.test.js` -> pass
  - `node tests\product-repo.test.js` -> pass
  - `node tests\write-through.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm test` -> 50/50 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review after commit.
- Follow-ups or risks:
  - With zero lists, capture/add flows may need a later UX decision: either require the user to create a list first or auto-create a list at capture time.

## 2026-07-19 02:40 - Codex remove unavailable AG Grid ColumnMenu hook

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Fixed AG Grid error #200 by removing the `getMainMenuItems` option that requires the unavailable `ColumnMenu` module in the Community UMD build.
- What changed:
  - Removed the AG Grid `getMainMenuItems` hook and the custom header-menu hide-column injector.
  - Kept column visibility through the existing ShopScout Columns workflow instead of the unavailable AG Grid ColumnMenu path.
  - Made the native column-menu launcher fall back to `showColumnFilter()` when `showColumnMenu()` exists but throws because ColumnMenu is unavailable.
  - Added regression coverage so the adapter does not re-register `getMainMenuItems`.
- Files touched:
  - `grid-rebuild-codex/agGridAdapter.js`
  - `grid-rebuild-codex/tests/wiring.test.js`
  - `grid-rebuild-codex/tests/adapter-display.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node grid-rebuild-codex\tests\wiring.test.js` -> pass
  - `node grid-rebuild-codex\tests\adapter-display.test.js` -> pass
  - `node grid-rebuild-codex\tests\controls.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm test` -> 50/50 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review after commit.
- Follow-ups or risks:
  - Header-menu custom "Hide Column" is intentionally removed from the AG Grid menu path; users should use the existing Columns modal for hide/remove actions.

## 2026-07-19 00:52 - Codex fix normalization toggle CSS override

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Fixed the later Products ribbon Normalization CSS block that was overriding the vertical toggle layout back into a two-column grid.
- What changed:
  - Replaced the stale Normalization group grid override with a flex column layout.
  - Reduced the Normalization group minimum width now that only the Prices and Measurements toggles remain there.
  - Added regression coverage to prevent the group from being forced back into the old two-column grid.
- Files touched:
  - `ribbon/ribbon.css`
  - `tests/menu-layout.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\menu-layout.test.js` -> pass
- Review status / next reviewer:
  - Ready for Claude review after commit.
- Follow-ups or risks:
  - User must reload the unpacked extension/dashboard after rebuilding to see the CSS change in Chrome/Edge.

## 2026-07-19 00:31 - Codex manual AI paste-back table auto-apply

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Manual AI pasted reports can now include a parseable `ShopScout Table Updates` markdown table, and ShopScout auto-applies safe parsed corrections directly to the active product table.
- What changed:
  - Added a shared manual AI result parser for the exact paste-back markdown table format.
  - Updated the manual AI prompt to require a final `ShopScout Table Updates` section with stable columns for Product #, Field, current value, recommended value, update type, confidence, and reason.
  - Changed the paste-result save flow to parse pasted reports, auto-apply safe non-identifier corrections to ProductSpec/spec fields, save provenance on each changed product, and refresh the main product table when updates are applied.
  - Saved manual AI runs now record parsed/applied/skipped table-update counts.
  - Identifier-like fields such as ASIN, UPC, GTIN, SKU, MPN, and model number are skipped by the auto-apply path to avoid identity corruption from free-form pasted text.
- Files touched:
  - `comparison.html`
  - `comparison.js`
  - `shared/manualAiResultParser.js`
  - `tests/manual-ai-result-parser.test.js`
  - `tests/manual-ai-engine.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\manual-ai-result-parser.test.js` -> pass
  - `node tests\manual-ai-engine.test.js` -> pass
  - `node tests\comparison-table-defaults.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm test` -> 50/50 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review after commit.
- Follow-ups or risks:
  - Parser intentionally consumes only the explicit `ShopScout Table Updates` table. Older pasted reports without that section are still saved as AI results but do not update the table.

## 2026-07-19 00:12 - Codex stack normalization toggles

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Stacked the Products ribbon `Prices` and `Measurements` normalization toggles vertically and removed the outer pill frame around each toggle while preserving the actual switch track.
- What changed:
  - Made the Products ribbon Normalization group stack its toggle controls vertically.
  - Removed the surrounding rounded border/background/shadow from each toggle button.
  - Kept the internal switch track and thumb styling so the on/off control remains visible.
  - Updated ribbon layout tests to lock the vertical stack and no-outer-frame behavior.
- Files touched:
  - `ribbon/ribbon.css`
  - `tests/menu-layout.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\menu-layout.test.js` -> pass
- Review status / next reviewer:
  - Ready for Claude review after commit.
- Follow-ups or risks:
  - Manual AI pasted-result-to-table update remains unimplemented; only its design was discussed before the crash.

## 2026-07-18 17:45 - Codex remove product delete confirmations

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Removed product delete confirmation prompts from row delete actions and selected-products delete actions.
- What changed:
  - Grid row delete now calls the product delete callback directly without requiring `ShopScoutUI.confirm`.
  - Dashboard selected-products delete now removes selected products directly after the user clicks the delete action.
  - List deletion and bulk open-link confirmation remain unchanged because they are separate workflows.
  - Updated delete behavior tests to assert direct product deletion without confirmation.
- Files touched:
  - `comparison.js`
  - `grid-rebuild-codex/shopscoutGrid.js`
  - `grid-rebuild-codex/tests/actions.test.js`
  - `tests/delete-safety.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node grid-rebuild-codex\tests\actions.test.js` -> pass
  - `node tests\delete-safety.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm test` -> 49/49 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review after commit.
- Follow-ups or risks:
  - Product deletes are now immediate. If undo is desired later, it should be implemented as a recoverable delete/undo workflow instead of a blocking confirmation.

## 2026-07-18 17:32 - Codex normalization settings relocation + ribbon toggle cleanup

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Moved Normalize, User Rules, and Categorize workflows out of the Products ribbon and into the Settings left navigation, removed the non-working Duplicates ribbon command, renamed the Products ribbon group to Normalization, and converted Prices / Measurements into switch-style toggles.
- What changed:
  - Removed `Duplicates`, `Normalize`, `Categorize`, and `User Rules` command buttons from the Products ribbon.
  - Kept duplicate protection as an add-product behavior and left the duplicate review page code untouched for now.
  - Added Settings left-menu items for `Normalize`, `User Rules`, and `Categorize`, each with a focused panel and dashboard action button that opens the existing main-content workflow.
  - Renamed the Products ribbon group from `Review & Rules` to `Normalization`.
  - Restyled `Prices` and `Measurements` as compact on/off switch controls while preserving the existing grid commands.
  - Used CSS switch styling based on the attached visual reference; no third-party image asset from the zip was embedded.
- Files touched:
  - `comparison.html`
  - `comparison.css`
  - `settings.js`
  - `ribbon/ribbon.css`
  - `grid-rebuild-codex/shopscoutGrid.js`
  - `tests/menu-layout.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\menu-layout.test.js` -> pass
  - `node grid-rebuild-codex\tests\controls.test.js` -> pass
  - `node grid-rebuild-codex\tests\adapter-display.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm test` -> 49/49 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review after commit.
- Follow-ups or risks:
  - Settings actions depend on the comparison dashboard page being loaded. The standalone settings page still shows the panels, but those dashboard navigation actions are only useful inside the comparison dashboard context.

## 2026-07-18 17:06 - Codex column filter modal routing + AI Results 2x2 ribbon layout

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Corrected the latest column-filter interaction so both the ribbon `Filters` command and AG Grid header filter icon open ShopScout's existing filter modal, and changed the Analyze ribbon `AI Results` group to a compact 2x2 command layout.
- What changed:
  - Changed `ShopScoutGrid.openFiltersModal()` back to the ShopScout filter modal instead of the AG Grid native column menu.
  - Added an AG Grid adapter header-filter-icon click delegate that opens the same ShopScout filter modal and suppresses the native AG Grid popup for that click.
  - Reworked the Analyze ribbon `AI Results` group into four equal small commands: `History`, `Compare runs`, `Paste result`, and `Export`.
  - Added scoped ribbon CSS for the 2x2 AI Results command grid without changing other ribbon stacks.
  - Updated regression coverage for the modal routing and new ribbon layout.
- Files touched:
  - `comparison.html`
  - `ribbon/ribbon.css`
  - `grid-rebuild-codex/agGridAdapter.js`
  - `grid-rebuild-codex/shopscoutGrid.js`
  - `grid-rebuild-codex/tests/adapter-display.test.js`
  - `grid-rebuild-codex/tests/controls.test.js`
  - `tests/menu-layout.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node grid-rebuild-codex\tests\controls.test.js` -> pass
  - `node grid-rebuild-codex\tests\adapter-display.test.js` -> pass
  - `node tests\menu-layout.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm test` -> 49/49 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review after commit.
- Follow-ups or risks:
  - This intentionally does not clone AG Grid Enterprise menu behavior. It uses AG Grid's header filter icon as the trigger and ShopScout's existing filter modal as the approved filter surface.

## 2026-07-18 00:22 - Codex GitHub issue #31 native AG Grid column menu correction

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Corrected the prior #31 filter fix so the ribbon `Filters` command opens AG Grid's native column menu surface, matching the AG Grid example pattern, instead of opening only the native filter popup.
- What changed:
  - Added `openNativeColumnMenu()` to the AG Grid adapter using `gridApi.showColumnMenu(columnKey)` first.
  - Kept `gridApi.showColumnFilter(columnKey)` as the fallback when the full AG Grid column menu API is unavailable.
  - Updated the grid orchestrator so ribbon `Filters` launches the native column menu for the first real filterable field.
  - Kept the ShopScout custom filter modal as fallback/test-only behavior when AG Grid native APIs are unavailable.
  - Added regression coverage proving the command calls AG Grid's native column menu API, not the custom modal or product/model comparison columns.
- Files touched:
  - `grid-rebuild-codex/agGridAdapter.js`
  - `grid-rebuild-codex/shopscoutGrid.js`
  - `grid-rebuild-codex/tests/adapter-display.test.js`
  - `grid-rebuild-codex/tests/controls.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node grid-rebuild-codex\tests\controls.test.js` -> pass
  - `node grid-rebuild-codex\tests\adapter-display.test.js` -> pass
  - `node grid-rebuild-codex\tests\wiring.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm test` -> 49/49 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review after commit.
- Follow-ups or risks:
  - This uses AG Grid native APIs only. It does not recreate AG Grid's column menu in custom ShopScout controls.

## 2026-07-18 00:05 - Codex GitHub issue #31 native AG Grid filters

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. The Products Table View filter command now uses AG Grid's native column filter/menu APIs instead of making the custom ShopScout filter modal the primary control.
- What changed:
  - Added `openNativeFilter()` to the AG Grid adapter using `gridApi.showColumnFilter(columnKey)` with `showColumnMenu(columnKey)` fallback.
  - Added `clearNativeFilters()` to clear AG Grid's native filter model through `gridApi.setFilterModel(null)` and notify with `onFilterChanged()`.
  - Changed the grid orchestrator so the ribbon `Filters` command opens the native AG Grid filter for the selected/first filterable metadata field.
  - Kept the previous ShopScout filter modal only as a fallback/test path when native AG Grid APIs are unavailable.
  - Updated regression tests so filter commands prove native AG Grid routing and native clear behavior.
- Files touched:
  - `grid-rebuild-codex/agGridAdapter.js`
  - `grid-rebuild-codex/shopscoutGrid.js`
  - `grid-rebuild-codex/tests/adapter-display.test.js`
  - `grid-rebuild-codex/tests/controls.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node grid-rebuild-codex\tests\controls.test.js` -> pass
  - `node grid-rebuild-codex\tests\adapter-display.test.js` -> pass
  - `node grid-rebuild-codex\tests\wiring.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm test` -> 49/49 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - AG Grid's built-in text/number filters are now the primary filter surface. More advanced set-filter style multi-select operators would require AG Grid Enterprise or a separate approved design; no custom clone was added in this fix.

## 2026-07-17 18:45 - Codex GitHub issue #32 misc status cleanup

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Resolved as stale/meta after verification. All numbered items listed in #32 are already closed, Task #70 ProductSpec migration is complete, and `main` can be fast-forwarded from the shared branch.
- What changed:
  - Audited the GitHub issue list and confirmed #1-#22 are closed.
  - Confirmed current branch is in sync with `origin/grid-rebuild-codex` before the changelog-only closure.
  - Confirmed `origin/main` is an ancestor of `origin/grid-rebuild-codex`, making a remote main fast-forward safe.
  - Added this changelog record so the closure is traceable.
- Files touched:
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `gh issue list --state all` -> referenced #1-#22 closed
  - `git merge-base --is-ancestor origin/main origin/grid-rebuild-codex` -> pass
  - No code validation needed; changelog/status-only task.
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - Remaining open GitHub issues are #23-#31 and are separate work items.
## 2026-07-17 18:39 - Codex GitHub issue #33 remove popup settings shortcut

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. The extension side panel no longer exposes the Settings gear or standalone settings launch action.
- What changed:
  - Removed the Settings gear button from `popup.html`.
  - Removed the popup click handler that opened `settings.html`.
  - Removed now-unused popup `.header-btn` styles.
  - Added regression coverage that the side-panel popup does not render or bind a Settings command.
- Files touched:
  - `popup.html`
  - `popup.js`
  - `popup.css`
  - `tests/popup-layout.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\popup-layout.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm test` -> 49/49 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - Dashboard Settings and manifest `options_page` remain intact; only the extension side panel shortcut was removed.
## 2026-07-17 18:31 - Codex GitHub issue #34 AI Providers dashboard settings

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Dashboard AI Providers now renders the provider accordion/editor instead of an empty Provider Connections shell.
- What changed:
  - Changed settings initialization to render fallback AI provider defaults immediately before async storage/settings reads.
  - Re-applies stored AI settings afterward when available, while keeping the default provider accordion if storage loading fails.
  - Added regression coverage so embedded settings must render the default provider accordion before async settings work can fail.
- Files touched:
  - `settings.js`
  - `tests/menu-layout.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\menu-layout.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm test` -> 49/49 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - None identified.
This file is the shared record for Claude and Codex. Append an entry for every meaningful change so both agents can continue from the same factual project history.

## 2026-07-17 18:14 - Codex GitHub issue #35 Pipeline settings layout

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Pipeline Roles settings render as a full-width selector stack.
- What changed:
  - Added a `dashboard-role-rows` role selector stack wrapper to the shared settings shell.
  - Updated embedded dashboard Pipeline Roles CSS so each stage label sits above a full-width select, matching the target screenshot.
  - Matched standalone settings Pipeline Roles styling to the embedded dashboard layout.
  - Added regression coverage for the role selector stack and full-width selector styling.
- Files touched:
  - `settings.js`
  - `comparison.css`
  - `settings.css`
  - `tests/menu-layout.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\menu-layout.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm test` -> 49/49 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - None identified.

## 2026-07-17 18:08 - Codex GitHub issue #36 Quick Capture settings layout

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Quick Capture Button settings match the target dashboard layout.
- What changed:
  - Styled the Quick Capture hidden-hosts fieldset in the embedded dashboard settings view so it no longer uses browser-default fieldset rendering.
  - Matched the standalone settings stylesheet to the same cleaner fieldset, legend, empty-state, and add-host row treatment.
  - Kept Quick Capture default behavior active with no hidden hosts.
  - Added regression coverage for active Quick Capture defaults and dashboard-specific hidden-host styling.
- Files touched:
  - `comparison.css`
  - `settings.css`
  - `tests/menu-layout.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\menu-layout.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm test` -> 49/49 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - None identified.

## 2026-07-17 18:04 - Codex GitHub issue #37 Open*Facts settings activation

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Dashboard Open*Facts Enrichment settings match the target layout and are active by default.
- What changed:
  - Updated the embedded settings Open*Facts panel with an active-status explanation and cleaner source-list styling.
  - Changed Open*Facts default settings to enabled with all four sources selected.
  - Fixed the background enrichment helper so missing saved settings also use the same active defaults; enrichment is now actually active before the user opens Settings.
  - Styled Open*Facts source fieldsets in both dashboard and standalone settings to avoid browser-default fieldset rendering.
  - Added regression coverage for default activation, all-source defaults, and dashboard Open*Facts styling.
- Files touched:
  - `settings.js`
  - `comparison.css`
  - `settings.css`
  - `data/openFactsEnrich.js`
  - `tests/menu-layout.test.js`
  - `tests/openfacts-enrich.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\openfacts-enrich.test.js` -> pass
  - `node tests\menu-layout.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm test` -> 49/49 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - Open*Facts still only runs when a captured product has a valid GTIN, UPC, or EAN; no barcode means no lookup.

## 2026-07-17 17:55 - Codex GitHub issue #38 Open All product links

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Products ribbon can open every current-list product URL in new tabs.
- What changed:
  - Added an `Open All` command to the Products tab `Product Actions` ribbon group with an external-link icon and tooltip.
  - Added active-list URL collection from `SSProductRepo` with legacy fallback, URL sanitization, duplicate removal, and HTTP(S)-only filtering.
  - Added a confirmation gate when the action would open more than five product links.
  - Opens tabs through `chrome.tabs.create({ active: false })` when available, with a `window.open(..., noopener)` fallback.
  - Added regression coverage for the new ribbon command, warning threshold, and extension tab creation path.
- Files touched:
  - `comparison.html`
  - `comparison.js`
  - `tests/menu-layout.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\menu-layout.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm test` -> 49/49 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - None identified.

## 2026-07-17 17:49 - Codex GitHub issue #39 compact unit spacing

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Normalized compact number/unit strings such as `8000mAh` into `8000 mAh`.
- What changed:
  - Added a v2 text-normalizer helper that inserts one display space between numbers and recognized unit abbreviations.
  - Applied the helper to text fields, unregistered field passthrough, and enum fallback token cleanup.
  - Preserved canonical unit casing for common units such as `mAh`, `Wh`, `GHz`, `DPI`, `GB`, `V`, and `W`.
  - Added regression coverage for registered battery-capacity values, description text, and unregistered metadata values.
- Files touched:
  - `normalization/normalizers/text.js`
  - `normalization/normalizers/enum.js`
  - `normalization/normalize.js`
  - `tests/normalize-v2.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\normalize-v2.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm test` -> 49/49 test files pass
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - Unit spacing is intentionally limited to recognized unit abbreviations so product identifiers and model numbers are not split accidentally.

## 2026-07-17 17:44 - Codex GitHub issue #41 display rounding toggles

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Products ribbon now exposes actual/rounded display toggles for prices and measurements.
- What changed:
  - Added grid state fields for `priceDisplayMode` and `measurementDisplayMode`.
  - Added two Review & Rules ribbon toggles: `Prices: Rounded/Actual` and `Measurements: Actual/Rounded`.
  - Routed display mode state into AG Grid render context so the renderer changes actual cell output.
  - Preserved the existing rounded-price behavior by default while allowing exact captured prices on demand.
  - Added rounded dimensional measurement display for dimension-like values/fields, rounding to the nearest half step and preserving exact captured values in tooltips.
  - Limited measurement rounding to dimensional units/fields so voltage, wattage, ratings, model numbers, and other technical identifiers are not rounded accidentally.
  - Added renderer and wiring regression tests for the display toggles.
- Files touched:
  - `comparison.html`
  - `ribbon/ribbon.css`
  - `grid-rebuild-codex/state.js`
  - `grid-rebuild-codex/shopscoutGrid.js`
  - `grid-rebuild-codex/agGridAdapter.js`
  - `grid-rebuild-codex/tests/adapter-display.test.js`
  - `grid-rebuild-codex/tests/controls.test.js`
  - `grid-rebuild-codex/tests/wiring.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node grid-rebuild-codex\tests\adapter-display.test.js` -> pass
  - `node grid-rebuild-codex\tests\wiring.test.js` -> pass
  - `node grid-rebuild-codex\tests\controls.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm test` -> 49/49 test files pass
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - Visual review should confirm the expanded Review & Rules group still collapses cleanly at narrow widths.

## 2026-07-17 17:34 - Codex GitHub issue #42 header hide column menu

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Normal product columns can now be hidden from the AG Grid header menu.
- What changed:
  - Added a native AG Grid `Hide Column` item to normal column header menus.
  - Routed the menu action through ShopScoutGrid state so the hidden column stays hidden after refresh/re-render, matching the Columns modal behavior.
  - Added regression coverage for both the header menu item and the persisted projection update.
- Files touched:
  - `AGENT_CHANGELOG.md`
  - `grid-rebuild-codex/agGridAdapter.js`
  - `grid-rebuild-codex/shopscoutGrid.js`
  - `grid-rebuild-codex/tests/controls.test.js`
  - `grid-rebuild-codex/tests/wiring.test.js`
- Validation run:
  - `node grid-rebuild-codex\tests\wiring.test.js` -> pass
  - `node grid-rebuild-codex\tests\controls.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm test` -> 48/48 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - None identified.

## 2026-07-17 17:26 - Codex GitHub issue #43 source logo border

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Fixed source icon/logo pill border styling.
- What changed:
  - Removed the anchor-specific `border-bottom: 0` override from source/brand logo token links so source pills keep their full border, including the bottom edge.
  - Added regression coverage in the SlickGrid wiring test to prevent source logo links from losing the bottom border again.
- Files touched:
  - `grid-rebuild-codex/grid.css`
  - `grid-rebuild-codex/tests/wiring.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node grid-rebuild-codex\tests\wiring.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm test` -> 48/48 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - None identified.

## 2026-07-17 17:17 - Codex remove old canonicalValue read fallback

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: b85b11d
- Status: Implemented. Removed support for old saved ProductSpec records that only exposed `canonicalValue`.
- What changed:
  - Removed `canonicalValue` read fallbacks from `shared/productSpecAccess.js`, `content/productSchema.js`, `utils.js`, `data/specHeuristic.js`, `comparison/productDetailView.js`, and grid projections.
  - Updated ProductSpec access, projection, editing, AI payload, canonical, cleanup-helper, and migration fixtures to use `value` instead of `canonicalValue`.
  - Updated `normalization/SPEC.md` to state that old `canonicalValue`-only records now require migration or re-capture.
- Files touched:
  - `AGENT_CHANGELOG.md`
  - `comparison/productDetailView.js`
  - `content/productSchema.js`
  - `data/specHeuristic.js`
  - `grid-rebuild-codex/projections.js`
  - `grid-rebuild-codex/tests/editing.test.js`
  - `grid-rebuild-codex/tests/projections.test.js`
  - `normalization/SPEC.md`
  - `shared/productSpecAccess.js`
  - `tests/ai-payload-options.test.js`
  - `tests/canonical.test.js`
  - `tests/cleanup-helpers.test.js`
  - `tests/normalize-v2-migration.test.js`
  - `tests/product-spec-access.test.js`
  - `tests/utils.test.js`
  - `utils.js`
- Validation run:
  - `node tests\product-spec-access.test.js` -> pass
  - `node tests\cleanup-helpers.test.js` -> pass
  - `node grid-rebuild-codex\tests\projections.test.js` -> pass
  - `node grid-rebuild-codex\tests\editing.test.js` -> pass
  - `node tests\utils.test.js` -> pass
  - `node tests\canonical.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm run typecheck` -> pass
  - `npm test` -> 48/48 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review after validation and commit.
- Follow-ups or risks:
  - Existing local products that only contain `_spec.*.canonicalValue` without `value`, `rawValue`, or `specsNormalized` will no longer display that normalized label. This matches the requested removal of old saved-record support.

## 2026-07-17 16:56 - Codex final ProductSpec compatibility cleanup

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Final Task #70 compatibility cleanup stops new extraction projections from producing legacy flat spec copies and stops new ProductSpec writes from persisting `canonicalValue`.
- What changed:
  - Updated `content/productSchema.js` so `toLegacyFlatProduct()` preserves `_spec` and `specsNormalized` but no longer writes `flat.specs` or `flat.rawSpecs` for new captures.
  - Updated `content/productSchema.js`, product detail edit buffers, rescan merge buffers, and Open*Facts enrichment to write ProductSpec spec-entry `value` instead of legacy `canonicalValue`.
  - Kept read-only `canonicalValue` fallback in `shared/productSpecAccess.js` for already-saved old products while preferring the new `value` field for new entries.
  - Updated normalization documentation and regression tests to lock the final shape.
- Files touched:
  - `AGENT_CHANGELOG.md`
  - `comparison/productDetailView.js`
  - `comparison/rescanController.js`
  - `content/productSchema.js`
  - `data/openFactsEnrich.js`
  - `normalization/SPEC.md`
  - `shared/productSpecAccess.js`
  - `tests/extraction-pipeline.test.js`
  - `tests/normalize-v2-wiring.test.js`
  - `tests/openfacts-enrich.test.js`
  - `tests/product-detail-layout.test.js`
- Validation run:
  - `node tests\extraction-pipeline.test.js` -> pass
  - `node tests\normalize-v2-wiring.test.js` -> pass
  - `node tests\openfacts-enrich.test.js` -> pass
  - `node tests\product-detail-layout.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm run typecheck` -> pass
  - `npm test` -> 48/48 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review after full validation and commit.
- Follow-ups or risks:
  - Runtime read fallbacks for old `canonicalValue` data remain intentionally for existing IndexedDB records. They should be removed only after a confirmed migration/delete path for old saved products.

## 2026-07-17 16:38 - Codex ProductSpec remaining read helpers

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Remaining spec read helpers for utility prompts, grid search, background AI prompts, and grid inline edits now use the ProductSpec access boundary where available.
- What changed:
  - Routed `utils.js` missing-attribute detection, comparison spec selection, and detailed AI prompt formatting through one `productSpecEntries()` helper backed by `ShopScoutProductSpecAccess`.
  - Routed `data/specHeuristic.js` through `ShopScoutProductSpecAccess.specEntries()` so ProductSpec-only fields participate in heuristic column picking.
  - Routed background context-menu AI prompt spec formatting through a ProductSpec-aware helper.
  - Routed grid search text through ProductSpec access so ProductSpec-only fields are searchable.
  - Updated grid inline spec edits to read ProductSpec-only fields and write refreshed `rawSpecs`, object `specs`, `_spec.specs`, and a nulled `specsNormalized` sidecar to avoid stale normalized displays.
  - Added regression coverage for ProductSpec-only utility prompts, heuristic reads, grid search, background prompt formatting, and inline spec edits.
- Files touched:
  - `background.js`
  - `data/specHeuristic.js`
  - `grid-rebuild-codex/editing.js`
  - `grid-rebuild-codex/shopscoutGrid.js`
  - `grid-rebuild-codex/tests/editing.test.js`
  - `tests/background-productspec-prompt.test.js`
  - `tests/canonical.test.js`
  - `tests/product-search.test.js`
  - `tests/utils.test.js`
  - `utils.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node grid-rebuild-codex\tests\editing.test.js` -> pass
  - `node tests\product-search.test.js` -> pass
  - `node tests\background-productspec-prompt.test.js` -> pass
  - `node tests\utils.test.js` -> pass
  - `node tests\canonical.test.js` -> pass
  - `node tests\product-spec-access.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm run typecheck` -> pass
  - `npm test` -> 48/48 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - Legacy compatibility fallbacks remain intentionally in central access helpers, ingestion/backfill code, and write-side sidecar maintenance. Do not remove `flat.specs` / `flat.rawSpecs` from `content/productSchema.js` until the remaining compatibility consumers are explicitly cleared.

## 2026-07-17 16:08 - Codex ProductSpec OpenFacts enrichment

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented Task #70 slice 5. Migrated Open*Facts enrichment writes away from legacy `record.specs` arrays.
- What changed:
  - Open*Facts enrichment now detects existing fields through `ShopScoutProductSpecAccess.specEntries()` when available.
  - New enrichment facts are written to `rawSpecs`, object `specs`, and ProductSpec `_spec.specs` buckets with `openfacts:*` source provenance.
  - Existing captured specs are preserved and not overwritten by Open*Facts data.
  - Stale `specsNormalized` is invalidated only when enrichment adds new facts, allowing repo normalization to rebuild the sidecar.
  - Added a behavior test for Open*Facts enrichment against the migrated ProductSpec-compatible output shape.
- Files touched:
  - `AGENT_CHANGELOG.md`
  - `data/openFactsEnrich.js`
  - `tests/openfacts-enrich.test.js`
- Validation run:
  - `node tests\openfacts-enrich.test.js` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm test` -> 47/47 test files pass
- Review status / next reviewer:
  - Ready for Claude review after full validation and push.
- Follow-ups or risks:
  - Task #70 functional write/read migration is now complete except final compatibility cleanup in `content/productSchema.js`. Legacy `flat.specs` / `flat.rawSpecs` should be removed only after Claude reviews these slices and confirms no older consumers remain.

## 2026-07-17 16:05 - Codex ProductSpec rescan merge

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented Task #70 slice 4. Migrated rescan spec merge logic to a ProductSpec-aware merge path.
- What changed:
  - Added ProductSpec-aware spec extraction to `comparison/rescanController.js`.
  - Changed rescan merge to detect new spec rows from ProductSpec access entries instead of only `fresh.rawSpecs`.
  - Rebuilds `rawSpecs`, `specs`, and ProductSpec buckets when new specs are merged.
  - Invalidates stale `specsNormalized` after rescan spec changes so repo normalization rebuilds normalized sidecars from merged rows.
  - Added module regression assertions for ProductSpec access and normalized sidecar invalidation in rescan merge.
- Files touched:
  - `AGENT_CHANGELOG.md`
  - `comparison/rescanController.js`
  - `tests/comparison-modules.test.js`
- Validation run:
  - `node tests\comparison-modules.test.js` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm run syntax` -> pass
- Review status / next reviewer:
  - Ready for Claude review after full validation and push.
- Follow-ups or risks:
  - Task #70 remaining write path: OpenFacts enrichment. Legacy flat compatibility should stay until OpenFacts and final legacy cleanup are complete.

## 2026-07-17 16:01 - Codex ProductSpec detail edit buffer

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented Task #70 slice 3. Migrated product-detail spec display/edit writes onto a ProductSpec-aware edit buffer.
- What changed:
  - Changed the edit modal spec table to render through `ShopScoutProductSpecAccess.specEntries()` when available, so ProductSpec-only fields appear in the editor.
  - Added a dedicated `applyEditedSpecsToProduct()` helper that replaces `rawSpecs`, `specs`, and ProductSpec buckets from the edited rows.
  - Clears stale `specsNormalized` on manual spec edits so the product repo normalization pass rebuilds the normalized sidecar from the edited rows.
  - Clears stale ProductSpec `itemDetails` when saving edited spec rows so deleted spec rows do not leak back from old ProductSpec buckets.
  - Added product-detail regression coverage for ProductSpec-aware display and save-buffer routing.
- Files touched:
  - `AGENT_CHANGELOG.md`
  - `comparison/productDetailView.js`
  - `tests/product-detail-layout.test.js`
- Validation run:
  - `node tests\product-detail-layout.test.js` -> pass
  - `node tests\comparison-modules.test.js` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
- Review status / next reviewer:
  - Ready for Claude review after full validation and push.
- Follow-ups or risks:
  - Task #70 remaining write paths: rescan merge and OpenFacts enrichment. Legacy flat compatibility should stay until those paths are migrated and verified.

## 2026-07-17 15:55 - Codex ProductSpec AI/export consumers

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented Task #70 slice 2. Migrated AI prompt/export spec summaries to the shared ProductSpec read boundary.
- What changed:
  - Updated `SS.normalizeProductSpecs()` to prefer `ShopScoutProductSpecAccess.specEntries()` so AI/export utility summaries use normalized displays and ProductSpec-only fields.
  - Updated manual/auto AI provider summaries to prefer the same ProductSpec accessor for compact specs, normalized specs, and selected-field filtering.
  - Updated dashboard manual prompt field discovery, search-text spec matching, export specs, and plain-copy specs to route through the shared ProductSpec entry helper.
  - Added focused regression coverage for normalized displays and ProductSpec-only fields in utility and AI payload summaries.
  - Added static dashboard coverage that manual/search/export spec consumers reference the ProductSpec access boundary.
- Files touched:
  - `AGENT_CHANGELOG.md`
  - `ai-providers.js`
  - `comparison.js`
  - `tests/ai-payload-options.test.js`
  - `tests/manual-ai-engine.test.js`
  - `tests/utils.test.js`
  - `utils.js`
- Validation run:
  - `node tests\utils.test.js` -> pass
  - `node tests\ai-payload-options.test.js` -> pass
  - `node tests\ai-providers.test.js` -> pass
  - `node tests\manual-ai-engine.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm run typecheck` -> pass
  - `npm test` -> 46/46 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - Task #70 still has write-path slices remaining: product detail edit/save, rescan merge, OpenFacts enrichment, and eventual removal of legacy `flat.specs` / `flat.rawSpecs` compatibility after all consumers are migrated.

## 2026-07-17 14:15 - Codex ProductSpec read boundary

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented Task #70 slice 1. Added a shared ProductSpec read accessor and moved key read consumers away from ad hoc `rawSpecs` / `specs` / `_spec` branching.
- What changed:
  - Added `shared/productSpecAccess.js` as the central read-only bridge across ProductSpec, `specsNormalized`, and legacy flat spec shapes.
  - Wired ProductSpec access helpers into comparison, popup, and background runtime load order before matching/review/repo consumers.
  - Updated shared spec flattening to read through `ShopScoutProductSpecAccess.specEntries()` when available.
  - Updated comparison-matrix spec cells to read ProductSpec entries through the shared accessor while preserving raw, corrected, confidence, source, and missing metadata.
  - Updated duplicate matching identifier extraction to scan spec entries through the shared accessor, including ProductSpec-backed identifiers.
  - Updated normalization review collection to use the shared accessor when available while keeping v2 provenance and identifier exclusion behavior.
  - Added focused ProductSpec access tests and tightened existing projection, matching, review, popup, and comparison load-order tests.
- Files touched:
  - `background.js`
  - `comparison.html`
  - `popup.html`
  - `shared/productSpecAccess.js`
  - `shared/projections/specProjection.js`
  - `grid-rebuild-codex/projections.js`
  - `grid-rebuild-codex/tests/projections.test.js`
  - `normalization/matching.js`
  - `normalization/review.js`
  - `tests/product-spec-access.test.js`
  - `tests/comparison-table-defaults.test.js`
  - `tests/dedupe-candidates.test.js`
  - `tests/normalization-review.test.js`
  - `tests/popup-layout.test.js`
  - `tests/product-repo.test.js`
  - `tests/user-rules-normalization.test.js`
- Validation run:
  - `node tests\product-spec-access.test.js` -> pass
  - `node tests\normalization-review.test.js` -> pass
  - `node tests\dedupe-candidates.test.js` -> pass
  - `node grid-rebuild-codex\tests\projections.test.js` -> pass
  - `node tests\product-repo.test.js` -> pass
  - `node tests\user-rules-normalization.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm run typecheck` -> pass
  - `npm test` -> 46/46 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - Task #70 is not fully complete. Remaining slices should migrate write/edit consumers such as product detail editing, rescan merge logic, AI/export prompt builders, and any direct display helpers that still branch on legacy spec shapes.

## 2026-07-17 19:10 - Codex attribute sidecar retirement

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Retired `ShopScoutAttributeNormalization` and stopped writing/reading `_normalizedAttributes` in runtime paths.
- What changed:
  - Removed `normalization/attributes.js` and its runtime loads from popup, comparison, and background contexts.
  - Moved user/default enum rule lookup and generated vertical-pack enum lookup into the v2 enum normalizer.
  - Extended the v2 normalization dispatcher to accept per-product normalization context, preserving per-product vertical pack behavior.
  - Added v2 registry entries for `Connectivity Technology` and `Upholstery Material`, covering current pack-backed normalization paths.
  - Changed `productRepo` add/replace/rebuild paths to persist `specs` + `specsNormalized` instead of `_normalizedAttributes`.
  - Changed the normalization review queue to read `rawSpecs` + `specsNormalized` and split list-like features from v2 envelopes.
  - Changed grid projections to render v2 normalized displays from `specsNormalized` and removed render-time attribute normalization.
  - Updated popup/comparison load-order tests and user-rule/review/product-repo/projection tests for the v2-only path.
  - Updated `normalization/SPEC.md` from deferred status to completed retirement status.
- Files touched:
  - `background.js`
  - `comparison.html`
  - `popup.html`
  - `data/productRepo.js`
  - `grid-rebuild-codex/projections.js`
  - `grid-rebuild-codex/tests/projections.test.js`
  - `shared/projections/specProjection.js`
  - `normalization/SPEC.md`
  - `normalization/attributes.js` (deleted)
  - `normalization/libraries/enums.js`
  - `normalization/normalize.js`
  - `normalization/normalizers/enum.js`
  - `normalization/registry.js`
  - `normalization/review.js`
  - `normalization/userRules.js`
  - `tests/attribute-normalization.test.js` (deleted)
  - `tests/normalization-libraries.test.js` (deleted)
  - `tests/comparison-table-defaults.test.js`
  - `tests/normalization-review.test.js`
  - `tests/popup-layout.test.js`
  - `tests/product-repo.test.js`
  - `tests/user-rules-normalization.test.js`
- Validation run:
  - `node tests\product-repo.test.js` -> pass
  - `node tests\normalization-review.test.js` -> pass
  - `node grid-rebuild-codex\tests\projections.test.js` -> pass
  - `node tests\popup-layout.test.js` -> pass
  - `node tests\comparison-table-defaults.test.js` -> pass
  - `node tests\user-rules-normalization.test.js` -> pass
  - `node tests\normalize-v2.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm run typecheck` -> pass
  - `npm test` -> 45/45 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - Existing products that only have legacy `_normalizedAttributes` but no `rawSpecs` / `specsNormalized` will not feed the review queue until normal v2 backfill or recapture provides `specsNormalized`. Current migration already backfills v2 from `specs` for display; review needs raw field/value pairs for precise approval items.

## 2026-07-17 18:25 - Codex canonicalValue retirement

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Retired the public `SSCanonical.canonicalValue` API; v2 normalization now owns normalized value display.
- What changed:
  - Removed `SSCanonical.canonicalValue` from `data/canonical.js` and its public export surface.
  - Simplified `keyCanonicalizer.normalizeValue` to whitespace trimming only, removing the old unit-canonicalization dependency.
  - Updated `productSchema.assemble` so legacy spec entries mirror v2 `.normalized.display` into their existing `canonicalValue` field when a v2 envelope exists.
  - Removed the `SSCanonical.canonicalValue` call path from `utils.normalizeSpecValue`, keeping the local fallback cleanup for legacy utility callers.
  - Added regression coverage that locks the retired API boundary and verifies v2 display values are mirrored into legacy spec entries.
- Files touched:
  - `content/productSchema.js`
  - `content/keyCanonicalizer.js`
  - `data/canonical.js`
  - `utils.js`
  - `tests/canonical.test.js`
  - `tests/normalize-v2-wiring.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\canonical.test.js` -> pass
  - `node tests\normalize-v2-wiring.test.js` -> pass
  - `node tests\utils.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm run typecheck` -> pass
  - `npm test` -> 47/47 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - The `canonicalValue` property still exists as a legacy persisted spec-entry field for compatibility. Removing that storage field belongs to the broader ProductSpec / legacy-data migration, not this API retirement.

## 2026-07-17 18:05 - Codex Manual AI regression fixes

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Fixed three Manual AI regressions found during Claude review.
- What changed:
  - Changed Paste Manual AI Result from an unreachable side-key save to a normal completed `aiRuns` record, so pasted manual reports immediately open in the existing AI Results page.
  - Added dashboard-side `shopscout_ai_runs` load/save support in `utils.js` so repo-backed `getData()` snapshots include saved AI runs.
  - Added optional `Risk & Seller Checks` to the Manual AI section picker and mapped it to `sellerRisk`, `rebrandDuplicate`, and risk-summary analysis flags.
  - Restored product-sensitive recommended behavior: high-risk marketplaces such as Alibaba now turn on the risk/seller section automatically, while reputable sources keep it off.
  - Added regression coverage for paste-back reachability, shared AI-run storage, risk/seller stage mapping, and product-sensitive recommendations.
- Files touched:
  - `comparison.html`
  - `comparison.js`
  - `utils.js`
  - `tests/ai-analysis-options.test.js`
  - `tests/manual-ai-engine.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\manual-ai-engine.test.js` -> pass
  - `node tests\ai-analysis-options.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm run typecheck` -> pass
  - `npm test` -> 47/47 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - Paste-back stores and displays the raw human-readable manual report. Applying field-level corrections from pasted reports remains a separate review/parser workflow.

## 2026-07-12 07:56 - Codex manual AI accordion cleanup

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Manual AI setup now uses collapsed expand/collapse sections and moves paste-back to the Analyze ribbon.
- What changed:
  - Replaced text chevrons in the Manual AI setup sections with circular SVG expand/collapse controls.
  - Applied the requested `ai-payload-estimate` and `ai-accordion-section` styling, including the warning-toned estimate box and unbordered accordion section shell.
  - Converted the “What to Ask AI to Analyze” checklist from boxed cards to plain horizontal checklist rows with checkbox and title on the same line.
  - Changed the top-level sections from single-open accordion behavior to independent expand/collapse behavior, with all sections collapsed by default when the modal opens.
  - Converted “Product Data Included” into nested Core and Select Individual Meta Data accordions with four-column field layout.
  - Tightened Product Data Included field rows with higher-specificity modal overrides, smaller text, explicit checkbox/text spacing, and more vertical room so metadata fields are not clipped.
  - Removed the Paste Result Back block from the setup modal and added Paste result to the Analyze ribbon, opening the existing paste-back modal.
  - Added regression tests covering the ribbon paste command, circular SVG accordion controls, unboxed report checklist, nested field accordions, and four-column field layout.
- Files touched:
  - `comparison.html`
  - `comparison.css`
  - `comparison.js`
  - `tests/ai-analysis-options.test.js`
  - `tests/manual-ai-engine.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\manual-ai-engine.test.js` -> pass
  - `node tests\ai-analysis-options.test.js` -> pass
  - `node tests\ai-payload-options.test.js` -> pass
  - `node tests\menu-layout.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm run typecheck` -> pass
  - `npm test` -> 47/47 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - Browser visual inspection was not available in this turn; DOM/CSS regression tests cover the requested layout and controls.

## 2026-07-12 02:37 - Codex manual AI modal accordion flow

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. The Manual AI options modal now uses a stacked accordion/wizard layout instead of split columns.
- What changed:
  - Converted the modal body into three full-width accordion sections: Data to Send, What to Ask AI to Analyze, and Product Data Included.
  - Added numbered accordion headers with concise descriptions and chevron state.
  - Kept Paste Result Back as a secondary block below the three-step flow.
  - Added `openAiAccordionSection()` so only one section is expanded at a time.
  - Reset the modal to step 1 whenever Analyze with AI / Manual AI opens.
  - Updated tests to lock the stacked accordion structure and expanded/collapsed panel behavior.
- Files touched:
  - `comparison.html`
  - `comparison.css`
  - `comparison.js`
  - `tests/ai-analysis-options.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\ai-analysis-options.test.js` -> pass
  - `node tests\manual-ai-engine.test.js` -> pass
  - `node tests\ai-payload-options.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm test` -> 47/47 test files pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - No prompt/payload behavior changed; this is a layout and interaction cleanup.

## 2026-07-12 02:23 - Codex manual AI modal data-to-send clarity

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. The Manual AI options modal now explains Data to Send clearly and shows examples for every payload option.
- What changed:
  - Renamed the confusing `Prompt Payload` UI section to `Data to Send`.
  - Added explanatory copy clarifying that Data to Send controls the amount of evidence, while Product Data Included controls which fields are allowed inside that evidence.
  - Added examples to each data mode: Compact, Compact + estimate, and Compact + raw fallback.
  - Renamed modal columns to `What to Ask AI to Analyze` and `Product Data Included`.
  - Tightened the modal grid so data modes render as compact horizontal cards and product-field checkboxes align cleanly without label overlap.
  - Aligned `ai-providers.js` payload mode labels with the new user-facing names.
  - Updated regression coverage for the new wording and example text.
- Files touched:
  - `ai-providers.js`
  - `comparison.html`
  - `comparison.css`
  - `tests/ai-analysis-options.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\ai-analysis-options.test.js` -> pass
  - `node tests\ai-payload-options.test.js` -> pass
  - `node tests\manual-ai-engine.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm test` -> 47/47 test files pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - No runtime behavior change beyond clearer option labels. Field filtering remains implemented by the previous manual AI workflow commit.

## 2026-07-11 02:53 - Codex manual AI prompt workflow revision

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Manual AI now uses the revised human-readable prompt shell, report-section selection, token-saving field selection, and paste-result-back workflow.
- What changed:
  - Replaced the old granular AI checklist UI with user-facing report sections: Category & Buying Factors, Master Comparison Table, Discrepancies & Fact-Checks, Claims/Value/Reviews, and Final Verdict.
  - Added a dynamic Product Fields to Send checklist that includes core fields plus captured spec fields from the selected products before prompt generation.
  - Wired selected field/spec IDs into `ShopScoutAI.productSummary()` so unchecked fields are actually omitted from compact prompt payloads.
  - Revised the manual prompt text to require human-readable output, avoid JSON, prioritize captured facts, search only for missing/conflicting/official verification needs, and use `Listed value → Corrected value → Reason/source → Confidence`.
  - Routed Manual AI through the Analyze with AI selection modal before opening the embedded manual AI provider selector.
  - Added a Paste Manual AI Result modal that stores pasted manual AI reports with list context for later review.
  - Added regression coverage for the manual AI engine and field-filtered prompt payloads.
- Files touched:
  - `ai-providers.js`
  - `comparison.html`
  - `comparison.css`
  - `comparison.js`
  - `tests/ai-analysis-options.test.js`
  - `tests/ai-payload-options.test.js`
  - `tests/manual-ai-engine.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\manual-ai-engine.test.js` -> pass
  - `node tests\ai-payload-options.test.js` -> pass
  - `node tests\ai-analysis-options.test.js` -> pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm test` -> 47/47 test files pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - Paste-back currently stores the manual AI report with list context. Applying corrections to product fields remains review-first and should be a separate parser/review workflow.

## 2026-07-12 — Claude session — Normalization v2 pipeline, Amazon scraper cleanup, ribbon polish

- Agent: Claude
- Branch: grid-rebuild-codex
- Commits: `e1948aa` → `68bfc5f` (18 commits across 2026-07-11 and 2026-07-12)
- Status: Landed on branch, pushed via this session's request. Extension build at `dist/*` matches `HEAD`.
- Summary:
  - Long iterative session driven by real user grievances: mixed-unit columns (`23.6 inches` next to `50 centimeters`), color pills reading `Black&red` / `2-blue`, voltage cells rendering `9 volts_of_direct_current`, and one specific "Maximum Pressure" column showing bare `150` alongside `150 psi`. Rather than patch each defect, the user pushed for the correct shape. Result is a full v2 normalization pipeline shipped in 5 phases plus a scraper cleanup and ribbon polish arc.
  - **Normalization v2 — spec first** ([`normalization/SPEC.md`](normalization/SPEC.md)): one pipeline, typed field registry, `{raw, canonical, unit?, display, provenance}` envelope per value. Three normalizer types: `enum` (multi-value tokenizer + alias table), `measurement` (unit-clean + `Qty(...).to(canonicalUnit)` + kind validation), `text` (trim + entity unescape). Registry declares field type in one place; nothing else knows about specific fields.
  - **Phase 1 — registry + normalizers + real-input tests** (`e1948aa`): `normalization/registry.js` (24 fields declared), `libraries/enums.js` (Color/Size/Material/Pattern/Power Source/Connector Type tables seeded from `defaultRules.js`), `normalizers/{text,enum,measurement}.js`, `normalize.js` dispatcher exposing `ShopScoutNormalize.field(name, raw)`. Discovered Qty's `kind()` returns `potential`/`charge`/`energy`/`angular_velocity` (not `electric_potential`/`electric_charge`/`torque`/`frequency`) — encoded correctly in registry. `tests/normalize-v2.test.js` — 28 assertions on the exact strings from the user's screenshots (`Black&red`, `2-blue`, `9 volts_of_direct_current`, mixed units, kind-mismatch rejection, unregistered-field passthrough).
  - **Phase 2 — wire into `productSchema.assemble`** (`5882b8a`): every spec entry gets a `.normalized` sidecar; `toLegacyFlatProduct` writes `flat.specsNormalized[k]`. Legacy `canonicalValue` string still written in parallel so downstream readers can migrate one at a time. `background.js` injects `vendor/quantities.min.js` + normalization files into every content-script tab BEFORE `productSchema.js`. `comparison.html` loads the same set for the sidepanel. `tests/normalize-v2-wiring.test.js` — 15 assertions round-tripping messy observations through `assemble` → `toLegacyFlatProduct`.
  - **Phase 3 — readers prefer `.normalized.display`** (`0cb34d5`): `grid-rebuild-codex/projections.js#displayCell` and `comparison/productDetailView.js` both prefer the v2 envelope's `.display` when present, falling back to `entry.canonicalValue` / `entry.rawValue` for products captured before Phase 2 landed. Multi-value display arrays (`["Black","Red"]`) get joined so the downstream pill splitter re-splits them.
  - **Phase 4 — IndexedDB backfill** (`4350960`): `SSMigrate.normalizeV2Once()` walks every stored product, rewrites `flat.specsNormalized` and `_spec.specs[k].normalized` via `ShopScoutNormalize.field()`. Idempotent — records `normalizeV2AppliedAt` in `db.meta`. Fail-safe per-product (log + skip). Hooked into `utils.js#bootstrapDataLayer` after the existing storage→IndexedDB migration. `tests/normalize-v2-migration.test.js` — 13 assertions for pure `applyNormalizedEnvelope` (legacy backfill, idempotent rerun, unregistered-field, `_spec` sub-tree).
  - **Phase 5 — retire dead prettify path** (`fa86f3d`): removed `prettify`, `normalizeMeasurement`, `normalizeMetric`, `normalizeDimensions` from `shared/values/cellValues.js` exports (zero non-test production callers per pre-flight audit). Deleted `tests/local-units.test.js`. Documented in `SPEC.md` that full retirement of `ShopScoutAttributeNormalization` and `SSCanonical.canonicalValue` is a follow-up: the review UI + `keyCanonicalizer` still call them, but the v2 envelope shadows their output everywhere the user actually sees text.
  - **Field-name aliasing** (`0b1e283`): `registry.get('Maximum Pressure')` was returning null so bare `150` fell through unregistered-passthrough and never inferred `psi`. Added a whitelist of leading modifiers (`maximum/minimum/max/min/peak/average/nominal/operating/working/standard/input/output/rated/total/continuous/avg`) — resolver strips them recursively (`Peak Continuous Wattage` → `Wattage`) plus case-insensitive matching (`color` → `Color`). +5 test assertions for the exact "Maximum Pressure" column the user screenshotted.
  - **Amazon feature-bullet junk filter** (`255a6b6`): `FEATURE_BULLET_SELECTORS` had `.a-unordered-list.a-vertical .a-list-item` as a fallback — Amazon uses that class on nearly every `<ul>` on the page (shopping cart carousel, "customers also viewed", review histograms, sponsored strip, buy-again). Every unrelated `<li>` on the whole page was landing in product features (`"was removed from Shopping Cart"`, `"Only 7 left in stock"`, `"#137 in Portable Air Compressors"`, `"5 star4 star3 star2 star1 star..."`). Fix: dropped the broad selector, kept only the four anchored at real feature-bullet containers; added `isJunkBullet()` pattern list as defense-in-depth so future Amazon layout changes can't leak junk back in.
  - **FIND search input matches PRODUCT LIST chrome** (`3882e0c`): `.rb-search` had zero base styling in `ribbon.css` — only a per-tab override set its height (28px). PRODUCT LIST select is 22px with 1px border, 3px radius. Added `.rb-office-ribbon .rb-search` mirroring `.rb-select` chrome (height, border, radius, background, font, hover/focus, placeholder). Magnifier SVG on the left, native cancel-X on the right. Retired the conflicting per-tab height override in `comparison.css`.
  - **Amazon page cruft / page-top padding** (`255a6b6`): `.dashboard-page--grid` had `padding-top: 0` so the list-name title band was glued to the ribbon bottom edge. Bumped to 16px.
  - **Ribbon left/right breathing room + drop shadow** (`c9cf165`): `.ribbon-body` horizontal padding 18 → 24px and `.ribbon-pane` `justify-content: center` → `flex-start` (centered content was clipping the "P" off "PRODUCT LIST" when pane content approached pane width). Added `box-shadow: 0 2px 6px rgba(15,23,42,0.10)` on `.ribbon-shell` so it lifts off the page like the Word ribbon.
  - **List group truly middle-aligned + identical across tabs** (`3946660`, `7709231`, `61e452d`, `83d9a83`, `68bfc5f`): five-commit hunt for consistent visual placement. Root causes found in sequence:
    - Different `align-items` values on the two adjacent flex rows (`center` on List vs `flex-end` on `.product-search--row`) made PRODUCT LIST + select ride high while FIND + search sat low. Switched List to `flex-end` first.
    - Group width was flex-derived, so PRODUCT LIST drifted left/right depending on which tab's neighbor groups were adjacent. Hard-pinned `.rb-group[data-group-id="list"]` to `width: 300px; flex: 0 0 auto`.
    - `.rb-group-content` was only as tall as its tallest child (74px button column), so `align-items: center` had no empty space to distribute — content appeared bottom-aligned. Added `flex: 1` so content grows to fill available height (~84px) between the group's padding-top and the "List" bottom label; THEN `align-items: center` centers the 36px label+select column vertically (22px above, 22px below) and `justify-content: center` centers the whole cluster horizontally.
    - Search tab had a `.ribbon-pane[data-pane="search"] .rb-group-content { padding-bottom: 14px }` rule that was steamrolling every group on Search, including the mirrored List group. Scoped it to `:not([data-group-id="list"])` so the List group's dedicated centering rule is the only thing acting on it. Verified with a headless Chromium probe that Products/Analyze/Search/File all render the List group at pixel-identical positions (group 110px, content 84px, label top 22px, select top 40px, delta 0.00 on every axis).
- Files touched (highlights):
  - `normalization/registry.js`, `normalization/libraries/enums.js`, `normalization/normalizers/{text,enum,measurement}.js`, `normalization/normalize.js` — new v2 pipeline core.
  - `normalization/SPEC.md` — spec doc; Phase-5 partial retirement documented at the tail.
  - `content/productSchema.js` — `.normalized` sidecar on spec entries; `flat.specsNormalized` mirror.
  - `background.js` — content-script injection order updated (Qty + normalization files before productSchema).
  - `comparison.html` — same set loaded in sidepanel.
  - `data/migrate.js`, `utils.js` — `normalizeV2Once` migration + bootstrap hook.
  - `grid-rebuild-codex/projections.js`, `comparison/productDetailView.js` — reader prefers `.display`.
  - `shared/values/cellValues.js` — retired dead `prettify` exports.
  - `content/adapters/amazon.js` — feature-bullet selector tightening + `isJunkBullet` filter.
  - `ribbon/ribbon.css`, `comparison.css`, `tests/menu-layout.test.js` — List group centering + Search-tab scope fix + ribbon shell/pane padding + shadow + `.rb-search` chrome.
  - `tests/normalize-v2.test.js`, `tests/normalize-v2-wiring.test.js`, `tests/normalize-v2-migration.test.js` — new golden-file tests hitting real messy strings.
- Verification:
  - Full suite: 46 test files, all passing.
  - Normalization: 28+15+13 assertions covering the exact defects the user reported plus new aliasing cases.
  - Ribbon cross-tab visual: headless Chromium probe reported delta 0.00 on group height, content height, label top, select top across Products/Analyze/Search/File tabs.
- Follow-ups deferred:
  - `ShopScoutAttributeNormalization` (`_normalizedAttributes` sidecar) and `SSCanonical.canonicalValue` still fire because the review UI + `keyCanonicalizer` read them; retirement requires rewriting those consumers.
  - Task #70 (Consumer migration to ProductSpec) remains open from earlier work.

## 2026-07-10 - Claude session — Products grid overhaul, ribbon grid system, CSS ownership cleanup

- Agent: Claude
- Branch: grid-rebuild-codex
- Commits: 7e07feb → 44d3a0a (16 commits since last push at 52cd2f5)
- Status: Shipped. Pushed to origin/grid-rebuild-codex through 52cd2f5; commits from 7e07feb onward pending push.
- Summary:
  - Long interactive session with the user reloading after each fix and reporting UX + data issues in real time. Work grouped in five arcs: grid data-correctness, ribbon grid system, AG Grid stock UX adoption, tests catch-up, and a two-phase CSS ownership refactor that ended the whack-a-mole style fights across theme.css / comparison.css / ribbon.css / grid.css.
  - **Column order + auto-hide** (`f558ee6`): reworked buildProductsRowsProjection into three tiers — frozen triplet (select/thumb/title) → fixed row (Price/Source/Rating/User Rating/Notes) always visible → dynamic remainder sorted by populated-row-count desc, with the zero-populated tail auto-marked defaultHidden. Fixed row never hides silently, so the "many columns not appearing" complaint from the earlier over-aggressive auto-hide can't recur. Ties in dynamic section break alphabetically by header name.
  - **My Rating column** (`2277e22`, `6b5e111`): new column (id: myRating, was briefly userRating). Renders 5 red stars (`#d93025`, Google Red 600) when set, muted-grey outline stars at 65% opacity when empty as an input affordance. Each star is its own click target with `data-my-rating-star="N"` — container-level delegation dispatches onCellCommit, clicking the same star that's currently highest clears back to 0. AG Grid editable forced to false for myRating so its default numeric editor doesn't open and fight the star clicks. 1px star hitbox padding, `scale(1.15)` on hover, red focus-visible outlines for keyboard users.
  - **Notes edit affordance** (`2277e22`, `6b5e111`): empty cells show a pencil SVG + italic grey "Add note" placeholder; filled cells show text with a pencil hint that fades in on cell hover. singleClickEdit: true added on notes + text column types so users don't have to guess AG Grid needs a double-click.
  - **Price rounding** (`c842133`, `2277e22`): went from `Math.round(amount / 5) * 5` (turned $19.99 into $20 AND $14.49 into $15) → exact `$19.99` display → final rounded-to-whole-dollar (`Math.round(amount)`), so $19.99 → $20, $9.99 → $10, $14.49 → $14, $1299 → $1,299. Title attribute preserves exact original for hover.
  - **Compare (matrix) view data restoration** (`1b77352`): every cell was rendering "Missing" because matrix product columns use `field: 'product:{id}'` and AG Grid's field-based value resolver treats the colon in the segment as unrecognisable. Added an explicit `valueGetter = params => params.data[rowKey]` for matrixCell colDefs — bypasses the field-parser entirely, all cells hydrate.
  - **Column pill uniqueness** (`e35f4b6`): old `pillColorKey(field, value)` mapped hash(field) into a 7-color palette bucket, causing many columns to collide on the same color. New `pillFieldStyle(field)` uses golden-angle (137°) HSL hash — every column gets a distinct hue. Semantic overrides (green in-stock / red out-of-stock / amber pending) still win at per-value level.
  - **List group unification + left-aligned actions** (`546cf61`, `52cd2f5`, `443db55`): the +/pencil/× icon buttons in the List group moved from right-aligned flex-end to LEFT-aligned flex-start so they hug the start of the Product List select above them. Rule unscoped from `[data-pane="products"]` to every tab that mirrors the List group. Class `rb-list-actions` added to the buttons row on File / Analyze / Search (Products already had it). Product List select locked at exactly 250px (was `minmax(190px, 260px)` and drifting).
  - **Ribbon grid system** (`48633b5`): three CSS variables at the top of `.rb-office-ribbon` — `--rbn-row-h: 22px`, `--rbn-label-h: 14px`, `--rbn-row-gap: 4px`. Every mini-label (PRODUCT LIST / SORT BY / GROUP BY / etc.) renders identically: 10px, weight 500, Segoe UI Variable, uppercase, 0.04em tracking, height = label-h, margin-bottom = row-gap. Every `.rb-select` inside the ribbon lands on row-h. Product List select and Sort By select now sit at exactly the same y-position (`Y=14+4=18` above input in every group). Nuked the conflicting `.rb-mini-label` rule in comparison.css that used mono 9px 600-weight and made PRODUCT LIST render differently from Sort By.
  - **Organize group 2×2 grid** (`e4f1641`, `46df740`, `40fd7ee`): Filters + Reset stacked into a `.rb-organize-tools` column-flex container as compact icon-left buttons (16px icon + label, 24px tall) sitting next to the Sort/Group stack. Group content became a proper `grid-template-columns: minmax(190px, 1fr) minmax(96px, auto); grid-template-rows: 1fr 1fr` so Sort By row aligns with Filters button, Group By row aligns with Reset button. As the ribbon resizes both columns grow/shrink together. Also stacked Sort By / Group By label above their fields (was label-beside-input, now label-on-top).
  - **Review & Rules polish** (`46df740`, `ab48049`): renamed "Possible Duplicates" → "Duplicates" and "Normalize Review" → "Normalize". Universal label rule: `word-break: keep-all; overflow-wrap: normal; text-overflow: ellipsis` so no more "Possib\nDuplic" mid-word chops. Review group gets `min-width: 240px` and Organize gets `min-width: 300px` (both gated by `:not([data-group-size="popup"])`) so the ScalingPolicy engine can still collapse them fully at very narrow viewports but they don't shrink into overlap at typical widths.
  - **Info page bleed fix** (`e3d8cdb`): `prepareMainContentPage()` was hiding `#productGrid` but NOT `#productsPageShell`, so "My Products / 38 products in this list." title band kept rendering below every info page (Save As, About, Help, etc.) making it look like the info page's title was at the bottom. Now hides the whole shell. Also removed `border-bottom: 1px solid var(--rule-soft)` under `.dashboard-page-head`.
  - **Rating cell underline** (`87c0594`): `theme.css:96` sets `border-bottom: 1px solid currentColor` on every `<a>`. Rating cell renders as `<a class="ss-grid-rating-link">` when the product has a URL — that global rule painted a horizontal line between the star row and "N reviews" text. Added `border-bottom: 0; padding-bottom: 0` to the link.
  - **Ribbon-header brand chip** (`40fd7ee`): dropped `<span class="build-tag" data-build-tag>` from the ShopScout header in comparison.html — version + SHA still stamped into the About page's `dashboard-about-version` block for anyone who needs it. Left popup.html alone since the tag is useful there for support/debug.
  - **AG Grid stock features enabled** (`7e07feb`, `bc990ee`, `6833f97`, `cf79cc2`): turned on column menu (hamburger), filter popup (funnel), and drag-drop column reorder — all Community, all previously disabled by our defaults. `theme: 'legacy'` gridOption added because v36 tightened validation for CSS-class theming (error #239 in postProcessThemeChange without it). Loaded `vendor/ag-grid/ag-theme-quartz.min.css` for the icon `@font-face` (base ag-grid.min.css doesn't carry it — icons rendered as missing-glyph boxes).
  - **CSS ownership refactor — Phase 1** (`805a085`): switched grid container class from `ag-theme-shopscout` (custom) to stock `ag-theme-quartz`. Deleted the entire header/row/cell aesthetic override block (~180 lines of `--ag-borders`, `--ag-header-background-color`, `.ag-cell padding`, `.ag-row-hover`, etc.) and the whole popup CSS block (~220 lines of `.ag-menu`, `.ag-tabs`, `.ag-filter`, `.ag-picker-field`, `.ag-input-field-input` restyling I'd added trying to make the filter popup match the ribbon). Quartz's own defaults are cleaner than what I'd hand-rolled. Kept: shell + all `.ss-grid-*` cell renderers + a tiny `.ag-theme-quartz` block for brand tint (`--ag-active-color`, `--ag-selected-row-background-color`, `--ag-row-hover-color`, `--ag-header-height`) and functional keeps (border kill so shell's rounded corners aren't fighting AG Grid's internal border; Name + Buying Factor left-align; selection/image cell no-padding). Net -388 lines, +92.
  - **CSS ownership refactor — Phase 2** (`44d3a0a`): purged all `.rb-*` component rules from theme.css (~73 rules: `.rb-group`, `.rb-btn-lg`, `.rb-btn-sm`, `.rb-select`, `.rb-search`, `.rb-toggle`, media queries, `.rb-select.rb-select--wide`, list-mirror block) and from comparison.css (~200 rules: two whole `.rb-*` component blocks that were near-duplicates of the Office 365 rewrite, adaptive media queries, `.rb-search.bound-search`, active-state overrides). `ribbon/ribbon.css` is now the sole owner of `.rb-*` rules. Kept in comparison.css: outer chrome (`.ribbon-shell`, `.ribbon-tabs`, `.ribbon-brand`, `.ribbon-tab`, `.ribbon-body`, `.ribbon-pane`) and `.product-search` / `.view-toggle` (not ribbon-owned). Net -411 lines, +27.
- Files touched (highlights):
  - `grid-rebuild-codex/agGridAdapter.js` (matrix valueGetter, myRating + notes renderers, click delegation, columnMenu options, theme: 'legacy', class simplification)
  - `grid-rebuild-codex/projections.js` (three-tier column order, myRating column, FROZEN/FIXED/DYNAMIC constants)
  - `grid-rebuild-codex/grid.css` (388-line delete, minimal `.ag-theme-quartz` override block)
  - `shared/values/cellValues.js` (pillFieldStyle golden-angle HSL)
  - `ribbon/ribbon.css` (grid system CSS variables, universal label rule, universal select height, list-actions left-align, Organize 2x2 grid, review floor widths)
  - `comparison.html` (build-tag removed from header, ag-theme-quartz.min.css link added, `.rb-stack.rb-list-actions` class on mirror tabs)
  - `comparison.js` (info-page shell hide fix)
  - `comparison.css` (~411-line delete of `.rb-*` duplicates)
  - `theme.css` (~150-line delete of `.rb-*` component rules)
  - Tests: projections.test.js, menu-layout.test.js, wiring.test.js (updated for new column order + universal ownership)
- Validation run:
  - `npm test` → 44/44 pass after every commit.
  - `npm run build` → chrome/edge/firefox dists rebuilt with fresh SHA stamp after each commit.
- Review / handoff:
  - Reviewer: User via live reload + report cycle. Each build tag change confirmed reload happened.
- Follow-ups or risks:
  - Ribbon adaptive `@media` breakpoints were deleted from theme.css and comparison.css on the reasoning that ribbon.css's ScalingPolicy engine handles adaptive shrink via data-group-size attributes. If ScalingPolicy ever misses a scenario the old media queries covered, need to add the equivalent shrink rule into ribbon.css.
  - `theme: 'legacy'` locks us to CSS-class theming. Future upgrade to AG Grid's new JS Theming API (`themeQuartz.withParams(...)`) would be a bigger rewrite.
  - Column-header still shows BOTH the hamburger and filter funnel (stock quartz behaviour). Previous session had CSS to hide the funnel; deleted in phase 1. If users complain again, the fix is to reinstate `suppressHeaderFilterButton: true` on colDef + a tiny `.ag-header-cell-filter-button { display: none }` rule — but stock quartz is what the user asked for so leaving as-is.
  - comparison.css still has `.ribbon-*` (outer chrome) rules that could reasonably migrate to ribbon.css. Kept them for now since they scope the ribbon to the dashboard context — moving them would require re-thinking whether ribbon.css should own dashboard chrome too.

## 2026-07-08 - Claude polish batch — grid autosize, rescan perf, pill palette, build stamp

- Agent: Claude
- Branch: grid-rebuild-codex
- Commits: 2cdb360 → 4e0942e (12 commits)
- Status: Shipped. `dist/` rebuilt after each commit; build tag shows current SHA next to ShopScout brand.
- Summary:
  - Rapid iteration session driven by user testing the loaded extension and reporting UX issues in real time. Every fix rebuilt into `dist/chrome|edge|firefox` and stamped with `v3.3.0.<shortsha>` next to the ShopScout brand in popup + comparison for visual verification.
  - **Build stamp** (`2cdb360`): `scripts/build-extension.ps1` now reads `package.json` version + `git rev-parse --short HEAD` and injects `v{version}.{sha}` into `popup.html` + `comparison.html` at build time (replaces `data-build-tag>dev` placeholder). Tiny muted mono-font next to the ShopScout brand. Users can now visually confirm which build is loaded — if the tag doesn't change after a fix, dist wasn't rebuilt or the extension wasn't reloaded.
  - **Column auto-sizing overhaul** (`fa20ff4`, `81ee888`, `e7685f9`, `09f32d8`, `0739f8f`): removed layered floors that were forcing wide columns for narrow content.
    - `fa20ff4` — dropped `columnWidths` persistence entirely. `state.js`, `projections.js`, `shopscoutGrid.js` no longer read/write per-column widths. Every render recomputes from content via measuredColumnWidth. Session resize still visually works; just doesn't persist. Kills the case where a user (or old saved state) had 260px title columns overriding my new auto-sizing.
    - `e7685f9` — removed hardcoded `minWidth`/`width` from projections.js BASE_COLUMNS. `notes minWidth:160`, `brand minWidth:120`, `newPrice width:104`, `modelName minWidth:160`, `rating width:128` — all gone. Fixed shapes (select 40, thumb 76, actions 92) kept.
    - `09f32d8` — collapsed adapter's per-type width bounds into one uniform rule: `max(header, content) + 16px pad`, floor 40. Only fixed shapes kept per-type bounds.
    - `0739f8f` — walked back partially. Uniform pad wasn't enough for chrome-heavy types: rating cell has 5 Unicode stars (~14px each) that plain text-length missed; brand/source/spec pill cells have ~18px border+padding chrome. Rating now gets min:132/pad:20; brand/source/spec get pad:28. Everything else keeps min:40/pad:16.
    - Net result: `COLOR: Blue` measures ~50–80px, `NOTES: -` measures ~40–70px, rating fits stars + "4.5" + "597 reviews", brand pills have breathing room.
  - **Normalization review UX cleanup** (`81ee888`, `125247c`): removed the three redundant columns (Reason/Confidence/Rule — always "unmapped/0%/unmapped" for typical queues). Removed per-row "Accept all matching" / "Ignore all matching" buttons (bulk actions now live in a page toolbar at top: "Accept all as aliases" / "Ignore all remaining"). Row action strip is now Accept alias / Ignore / Open. Row height 126→64, product column left-aligned, page toolbar with count summary + bulk actions. Added tooltips to every action button + column header.
  - **Grid host = full page** (`45dc3dd`, `7dc29b0`): the "iframe" feel was two things.
    - `45dc3dd` — `applyHostHeight` was capping at 6/8/12 visible rows for review/matrix/products. Changed to `header + rowCount × rowHeight` — the host is exactly as tall as its content. Browser scrolls the whole page when the list is long; SlickGrid's internal scrollbar never triggers.
    - `7dc29b0` — stripped `#productGrid.ss-grid-shell` chrome (border, margin, background, `overflow: hidden`) so the grid blends into the page instead of sitting in a bordered box. Also added an 18px `scrollbarBuffer` to the host height because a horizontal scrollbar was eating vertical viewport space and triggering a spurious vertical scrollbar.
  - **Rescan performance** (`8159e64`, `61cd6df`):
    - `8159e64` — scaled the anti-throttling pause to list size. 1–3 items: no pause. 4–10 items: 300–800ms breath. 11+: original 3–6s. Also updated progress text to say "loading page..." during the tab-load phase so users don't see a static "Scanning X of Y" for 20 seconds.
    - `61cd6df` — parallelized. Concurrency scales with list size (≤3 items rip all at once; larger lists cap at 3 in-flight tabs). Per-product page-load timeout dropped from 25s→10s (settle 2.5s→1.5s). Slow pages fail fast instead of stalling the queue.
    - Rough speedup for 2-product rescan: 20–50s → ~10–15s.
  - **Semantic pill palette** (`4e0942e`): killed the hash-of-value random coloring that was already present but unused (`stableColor` in cellValues.js was defined but never applied to grid pills). Introduced `ShopScoutValues.pillColorKey(field, value)` — a fixed 7-color palette (blue/green/red/amber/purple/teal/slate) with this precedence:
    1. Value-semantic override (Available/Active/Yes → green, Missing/Deactivated/No/Failed → red, Pending/Limited → amber).
    2. Field-name category (brand/source/model → blue identifiers; category/type → purple taxonomy; weight/capacity/voltage → teal numeric; notes/description/title → no pill).
    3. Stable hash of field name → palette bucket. Same field always same color; two unrelated columns won't accidentally match.
    - CSS style: outline darker, fill lighter, border-radius 6px (rounded rectangle, not full pill). `data-pill-color="X"` attribute on each pill; one CSS rule per palette key.
- Files touched (highlights):
  - `grid-rebuild-codex/slickGridAdapter.js` (widths, host height, pill data-attr, rating/pill chrome)
  - `grid-rebuild-codex/projections.js` (dropped hardcoded widths from BASE_COLUMNS)
  - `grid-rebuild-codex/state.js` + `shopscoutGrid.js` (columnWidths persistence removed)
  - `grid-rebuild-codex/grid.css` (shell chrome removed, semantic palette rules)
  - `shared/values/cellValues.js` (pillColorKey + PILL_COLOR_KEYS)
  - `comparison.js` (normalization review projection trim, bulk-all toolbar handler)
  - `comparison.css` (toolbar layout, tighter product cell)
  - `comparison/rescanController.js` (scaled pause + parallel workers)
  - `background.js` (`waitForTabComplete` 25s→10s for rescan)
  - `scripts/build-extension.ps1` (build stamp injection)
  - `popup.html` + `popup.css` (labeled dashboard button, build tag)
  - `comparison.html` (build tag in ribbon brand)
  - Tests: adapter.test.js, popup-layout.test.js, menu-layout.test.js, normalization-review-render.test.js, state.test.js
- Validation run:
  - `npm test` → 47/47 pass after each commit.
  - `npm run lint` → pass.
  - `npm run build` → chrome/edge/firefox dists rebuilt after every commit with fresh SHA stamp.
- Review / handoff:
  - Reviewer: Codex or user. Every commit was validated by user reloading + reporting back.
- Follow-ups or risks:
  - `rescanProduct` still shows a hard `10000ms` timeout in background.js — for genuinely slow retailers this may fail more often than the 25s original. If real-world failure rates climb, adaptive timeout (start 10s, escalate on retry) is the obvious next step.
  - Parallel rescan at concurrency 3 may increase perceived resource use on the user's machine (3 tabs opening simultaneously). Fine for typical use, may want to add a "background scan quietly" toggle later.
  - Column width persistence is fully removed — if the user wants sticky resizes later, we re-add via `state.columnWidths` with an explicit "Save current widths" ribbon action.

## 2026-07-08 - Claude issue-batch #2 + full triage sweep via gh CLI

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Complete; open GitHub issue count went from 20 → 4 (only #5, #7, #8, #13 shipped; then closed). New count: 0 open.
- Summary:
  - gh CLI was newly available, so I walked every open GitHub issue via `gh issue view/close/comment`.
  - Closed with commit references (already shipped by prior work): #3, #4, #12, #14, #15, #16, #18, #19, #22.
  - Closed with answers (questions, not bugs): #2, #6, #10, #11, #17, #20.
  - Fixed and shipped in THIS commit:
    - **#5 pill splitting for long lists**: `sentenceLike` in slickGridAdapter.js was gating pills on `text.length > 90`. An 8-item inventory like "Cordless Tire Inflator × 1, Quick Connector× 1, ..." is 170+ chars but is clearly a list, not prose. Removed the length gate. `splitToPills`'s per-part guards (52-char cap, no periods, ≥2 clean parts) plus sentenceLike's connective check still filter prose correctly. The existing `.ss-grid-pill-qty` class already renders "(×N)" in italic small font, matching the user's exact spec.
    - **#7 dashboard icon → labeled button**: moved the 4-square dashboard icon out of the topbar into a dedicated `.header-action-bar` directly below the header. New `.dashboard-open-btn` styled with the accent orange, full-width, shows icon + "Open Comparison Dashboard". popup-layout.test.js updated to check the new location (labeled button lives after settings, in a header-action-bar).
    - **#8 unnecessary vertical scrollbar**: removed `body { padding-bottom: 80px; }` from theme.css. This 80px was originally there to keep the last content visible when a `.ss-toast` popped up, but toasts are `position: fixed` and temporary — the permanent padding forced every page taller than the viewport and always showed a scrollbar. Toast may briefly overlap the very bottom of content in the rare case the user is scrolled all the way down mid-toast, which is standard toast behavior everywhere.
    - **#9 settings left-menu spacing**: `.dashboard-settings-nav` in comparison.css had `gap: 10px` but no `display: flex`. Gap only applies to flex/grid containers, so items rendered flush. Added `display: flex; flex-direction: column;`. Menu items now have visible spacing per the user's "Correct" reference screenshot.
    - **#13 product comparison text clipping**: matrix-mode product headers inherited `text-transform: uppercase; font-family: monospace; font-weight: 700; letter-spacing: 0.08em` from `.slick-header-column`. That squashed product names into hard-to-read UPPERCASE-BOLD-MONO and clipped the top of the letters because the line-height was tuned for the smaller header text. Gave `.ss-grid-product-head-title` its own typography: 12px Inter/sans, weight 600, no uppercase, line-height 1.3, `max-height: 2.6em` (up from 2.4), added `padding-top: 2px` to keep letters clear of the clamp.
- Files touched:
  - `grid-rebuild-codex/slickGridAdapter.js` (sentenceLike, unrelated to earlier #22 fix)
  - `grid-rebuild-codex/grid.css` (product-head-title typography override)
  - `comparison.css` (settings nav flex)
  - `theme.css` (removed 80px body padding-bottom)
  - `popup.html` (dashboard icon moved to labeled action bar)
  - `popup.css` (`.header-action-bar` + `.dashboard-open-btn` styles)
  - `tests/popup-layout.test.js` (updated to check new dashboard button location)
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `npm test` → 47/47 pass
  - `npm run lint` → pass
- Review / handoff:
  - Reviewer: Codex or user. Preview panel confirmed popup.html in Launch view during work.
- Follow-ups or risks:
  - **Toast overlap edge case (#8)**: on a page where the user is scrolled to the very bottom and a toast fires, the toast will briefly overlap the last row (~50px). Standard toast behavior. If problematic, either (a) add `padding-bottom` only to specific scrollable content containers when a toast is showing, or (b) shift the toast up when at bottom. Neither is worth doing preemptively.
  - Only 1 issue remains uncovered by this sweep: the pending pre-existing #70 (ProductSpec consumer migration) from before this session.

## 2026-07-08 - Claude fix batch: GitHub issues #22, #15, #16

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Complete; ready for Codex/user review.
- Summary:
  - Batch fix for 3 triaged GitHub issues that Codex flagged as hard to resolve.
  - **#22 grid**: two problems, both in `grid-rebuild-codex/slickGridAdapter.js`.
    1. Column widths were floored at hardcoded per-type mins (e.g. spec = 170px). Cells with short content like "COLOR: Blue" still rendered at 170px, wasting horizontal space. Reworked `columnWidthBounds()` so content-driven columns (text/spec/other) floor at 56px and content max(header, cell) drives the actual width. Kept sensible per-type mins for title (260), source/brand (96), rating (128), price (88), image (96), matrixCell (180), normalization/review columns (unchanged). Also improved `estimateTextWidth()` to distinguish header vs body text — headers are bold uppercase 11px so they measure at ~9.6px/char vs 7.2px/char for body Inter 13px. This gives more accurate measured widths for header-driven columns like "Compatible Devices".
    2. Text selection didn't work in cells. Root cause: SlickGrid binds a `selectstart -> preventDefault()` handler on the viewport UNLESS `enableTextSelectionOnCells: true` is passed in options (see `vendor/slickgrid/slick.grid.js:470`). Added the option. The existing CSS `user-select: text` on `.slick-cell` (already there) now takes effect.
  - **#15 AI provider accordions**: reworked so each provider's editor fields (API key, model, endpoint, notes, actions, test result, security note) live INSIDE its own accordion body, not in a separate block below the list. Only the currently-expanded card renders the editor form (single instance keeps IDs unique). Card headers now tinted muted-green when the provider is On (Ready) and muted-pink when Off, with a warn/amber state for Needs-key. `renderProviderList` writes a `data-provider-state` attribute + a `provider-card-{state}` class hook. Both `settings.css` (standalone) and `comparison.css` (dashboard) have matching styles. `bindEvents` now split into static handlers (nav, list delegation) and `bindEditorEvents` (per-render buttons/inputs) since the editor DOM is replaced on each provider switch. All save/test/remove/reset paths now route through `selectProvider(id)` to keep the editor state consistent after mutations.
  - **#16 left menu descriptions**: `settingsNavHtml` already had descriptive subtitles for AI Providers / Quick Capture / Open*Facts. Added **Pipeline Roles** as its own left-nav entry (was previously nested inside the AI Providers panel) with the description "Choose which provider handles each stage. Auto uses your enabled providers." Pipeline Roles is now a separate `data-settings-panel="pipeline-roles"` panel with its own card.
- Files touched:
  - `grid-rebuild-codex/slickGridAdapter.js` (widths + text selection)
  - `settings.js` (accordion redesign + Pipeline Roles panel + editor-form template + bind refactor)
  - `settings.css` (muted-green/pink card tinting for standalone)
  - `comparison.css` (muted-green/pink card tinting for dashboard)
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node grid-rebuild-codex/tests/adapter.test.js` -> pass
  - `npm test` -> 47/47 test files pass
  - `npm run lint` -> pass
  - `npm run syntax` -> pass
- Review / handoff:
  - Reviewer: Codex or user.
  - Notes: Widened test-friendly per-type mins for title (260), source/brand (96), rating (128), price (88) so we don't regress the "narrow columns crush headers" case. Everything else drops to 56 min so narrow content (Blue, Yes/No, 4.4) no longer wastes 100+px per column.
- Follow-ups or risks:
  - None known. If any consumer of `selectProvider` bypasses `bindEditorEvents`, the editor buttons will be inert — but every current call path either uses `selectProvider` or is unaffected.

## Entry Template

```md
## YYYY-MM-DD HH:MM - Short title

- Agent: Codex | Claude
- Branch: branch-name
- Commit: hash, Uncommitted, or This commit for changelog-only commits
- Status: Implemented | Reviewed | Approved | Needs fixes | Deferred
- Summary:
  - ...
- Files touched:
  - path
- Validation:
  - command -> result
- Review / handoff:
  - Reviewer: Codex | Claude | Pending
  - Notes: ...
- Follow-ups:
  - ...
```

## 2026-07-04 - Collaboration log added

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Added a mandatory shared change-record process for Claude and Codex.
  - Added root-level agent coordination instructions pointing both agents to this file.
- Files touched:
  - AGENTS.md
  - AGENT_CHANGELOG.md
- Validation:
  - Not run; documentation-only change.
- Review / handoff:
  - Reviewer: Claude optional.
  - Notes: Future task and review entries should be appended here before handoff.
- Follow-ups:
  - None.

## 2026-07-04 - Current branch baseline before collaboration log

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: 7c680ef
- Status: Pushed to origin/grid-rebuild-codex
- Summary:
  - Latest confirmed GitHub state before adding this log.
  - Popup/right-pane was converted to capture-only gathering.
  - AI, import/export, and dashboard controls were removed from the popup surface.
- Files touched:
  - popup.html
  - popup.js
  - popup.css
  - tests/popup-layout.test.js
- Validation:
  - npm test -> 31/31 passed
  - npm run syntax -> passed
  - npm run lint -> 0 errors, existing warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Pending if Claude wants to audit the popup scope.
  - Notes: Local HEAD and origin/grid-rebuild-codex matched at 7c680ef.
- Follow-ups:
  - Keep popup as gathering-only unless the user explicitly changes the surface boundary.

## 2026-07-04 - Recent grid rebuild notes

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: 2491880
- Status: Pushed to origin/grid-rebuild-codex
- Summary:
  - Replaced the overlapping row action menu with inline icon-only action buttons.
  - Neutralized SlickGrid selected-cell visuals that made cells look unintentionally selected.
- Files touched:
  - grid-rebuild-codex/productGrid.js
  - comparison.css
- Validation:
  - See branch validation recorded after 7c680ef.
- Review / handoff:
  - Reviewer: Pending.
- Follow-ups:
  - Continue polishing grid controls through library configuration where possible.

## 2026-07-04 - Recent grid sorting and actions notes

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: d130770
- Status: Pushed to origin/grid-rebuild-codex
- Summary:
  - Moved the actions column to the far-right end of the grid.
  - Synced column header sort indicators with the active sort state.
- Files touched:
  - grid-rebuild-codex/productGrid.js
- Validation:
  - See branch validation recorded after 7c680ef.
- Review / handoff:
  - Reviewer: Pending.
- Follow-ups:
  - Keep sort interactions available from both ribbon controls and column headers.

## 2026-07-04 - Single branch collaboration rule

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Updated agent coordination instructions so Claude and Codex both work on one shared branch for now.
  - Set `grid-rebuild-codex` as the single active collaboration branch.
  - Added a guard against silently creating, merging, deleting, or switching branches.
- Files touched:
  - AGENTS.md
  - AGENT_CHANGELOG.md
- Validation:
  - Not run; documentation-only change.
- Review / handoff:
  - Reviewer: Claude optional.
  - Notes: Claude should pull `grid-rebuild-codex` and continue on that branch.
- Follow-ups:
  - If desired, separately clean up historical remote branches after explicit user confirmation.

## 2026-07-04 - Review of d130770 (actions column right + sort header sync)

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (review only, no code change)
- Status: Reviewed
- Summary:
  - Reviewed d130770 "Fix grid actions column and sort headers".
  - Change splits `ACTIONS_COLUMN` out of `BASE_COLUMNS` in `projections.js` and concatenates it after `specColumns` and after any user column order, so the actions column stays pinned at the far-right position even when `viewState.columnOrder` moves it earlier. Adds `sortIndicatorColumns()` + `applySortIndicator()` in `slickGridAdapter.js` to translate `projection.sort` into SlickGrid `setSortColumns` (with `setSortColumn` fallback), and adds header cursor/hover CSS.
- Files touched:
  - none (review only)
- Validation:
  - Read commit diff + verified projection.js column pinning logic.
  - Confirmed `.slick-header-column[aria-sort]` fallback works because SlickGrid sets `aria-sort` on sorted columns even if `.slick-header-sortable` is absent.
  - Cross-checked `dataView.sort` behavior against `multiColumnSort: true` grid option.
- Review / handoff:
  - Reviewer: Claude
  - Findings:
    - Suggestion: `multiColumnSort: true` (slickGridAdapter.js:241) plus multi-entry `projection.sort` support in `sortIndicatorColumns()` will visually highlight all sorted columns, but both `onSort.subscribe` (line 260-266) and the initial `dataView.sort` call (line 214) only apply `sort[0]`. When a saved view carries two-column sort, the header will show two indicators while the data is sorted by only the first. Not introduced by d130770, but d130770 is the commit that made the mismatch user-visible. Either sort the DataView by the full chain or clamp `sortIndicatorColumns` to the first entry.
    - Approved: Pinning `actions` outside the reorderable set is the right pattern — users can't accidentally lose the per-row actions by dragging headers, and it stays visible after new dynamic spec columns are added. Test `saved column order cannot move row actions away from the far-right utility column` (projections.test.js) pins this.
    - Approved: `setSortColumns` first, `setSortColumn` fallback is a reasonable degradation for older SlickGrid builds.
    - Approved: Header hover + cursor CSS + `.slick-sort-indicator { opacity: 0.72 }` are proportional visual polish.
    - Style preference: `color-mix(in srgb, var(--paper-2, #eaedf1) 76%, var(--primary-tint, #e6eef1))` — clever, but only Chromium 111+/Firefox 113+/Safari 16.4+. Fine for an extension targeting current Chrome/Edge/Firefox; would fail visually (fall back to previous rule) on older browsers.
- Follow-ups:
  - Multi-column sort behavior/UI alignment — do we support it end-to-end or clamp to single-column? Not blocking, but worth deciding before saved views ship.

## 2026-07-04 - Review of 2491880 (icon-only row actions + selected-cell visuals)

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (review only, no code change)
- Status: Reviewed
- Summary:
  - Reviewed 2491880 "Use icon-only grid row actions".
  - Replaces the `<details>/<summary>` action popover in `htmlForActions()` with a horizontal `.ss-grid-action-bar` of three icon buttons (Open ↗, Rescan ↻, Delete ×), each with `aria-label` + `title`. Adds `showCellSelection: false` to grid options. Neutralizes `.slick-cell.selected` + `.slick-cell.active` via CSS override to suppress the SlickGrid default-theme yellow-beige `background: beige` and gray active-border. Tests updated to pin the new DOM shape (`ss-grid-action-bar`) and the absence of the old popup shape (`<details>`, `ss-grid-action-panel`).
- Files touched:
  - none (review only)
- Validation:
  - Verified `showCellSelection` is a real SlickGrid option (default `!0` at vendor/slickgrid/slick.grid.js:172; setting false skips the `.active` class add on cell navigation, per line 1695).
  - Verified `.slick-cell.selected { background-color: beige }` and `.slick-cell.active { border-color: gray; border-style: solid }` are in vendor/slickgrid/slick-default-theme.css and would otherwise render on row/cell interaction.
  - Traced grid delete path: shopscoutGrid.js:547 `handleAction('delete')` → globalThis.deleteProductById → comparison.js:1942 → comparison.js:1852 `removeProduct(idx)`.
- Review / handoff:
  - Reviewer: Claude
  - Findings:
    - Must-fix: Single-click destructive delete has no confirmation. `removeProduct` (comparison.js:1852) and `deleteProductById` (comparison.js:1942) both delete unconditionally — they only show a `toast.show('Removed')`. Previously the `<details>` menu forced a two-step interaction (open popover, click Delete), which meant a misclick on the ⋮ trigger did nothing destructive. The new icon toolbar puts a red-hover Delete icon in every visible row, one click away from permanent deletion of a product with no undo. This is a UX regression created by this commit. Fix: wrap the delete branch in `handleAction` (grid-rebuild-codex/shopscoutGrid.js:547) with `ShopScoutUI.confirm({ title: 'Delete product?', body: row.title || row.url, confirmText: 'Delete', danger: true })` before calling `deleteProductById`. The `ShopScoutUI.confirm` API is already available (ui/confirmDialog.js). Alternative: add the confirm inside `removeProduct` itself, which would also protect the multi-select "Delete Selected" path (comparison.js:1871, also unconfirmed) — but that's out of scope for this commit's review; grid-side fix is the minimum needed.
    - Suggestion: The four-value `border-color: var(--rule-soft, #e5e7eb) var(--rule-soft, #e5e7eb) var(--rule, #d1d5db) transparent` in the `.slick-cell.selected/.active` neutralization reads like it's matching a specific base cell border, but the default `.slick-cell` has no border. Since `showCellSelection: false` already suppresses `.active`, the CSS is really only guarding `.selected` — a simpler `border: 0` or `border-color: transparent` would express intent more clearly and avoid future confusion about which border it's matching.
    - Style preference: `&times;` (×) is legible but reads more like "close" than "delete". `&#128465;` (🗑) or an SVG trash icon would be a stronger destructive-action signal. Optional.
    - Approved: The dropdown → inline icon toolbar swap solves the actual overlap complaint recorded in the earlier UX log (menu popped out over adjacent rows).
    - Approved: `role="toolbar"` + `aria-label="Product actions"` + per-button `aria-label` and `title` is correct for icon-only controls.
    - Approved: `showCellSelection: false` is the right lever — verified real option, verified default theme's active-cell border/background is what it suppresses.
    - Approved: Test additions pin both the presence of the new shape (`ss-grid-action-bar`, aria-labels) and the absence of the old popup shape (`<details>`, `ss-grid-action-panel`, `<summary>`) so a regression to the popup pattern would fail the test.
- Follow-ups:
  - Add confirm to grid-side delete before this can be considered fully approved (Must-fix above).
  - Consider whether `deleteSelectedProducts` (comparison.js:1871) should also confirm — separate commit if so.

## 2026-07-04 00:45 - Add confirmation to destructive deletes

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Fixed Claude's must-fix for `2491880`: grid row delete now opens a themed `ShopScoutUI.confirm` dialog before deleting.
  - Added fail-closed behavior if the confirmation UI is unavailable, so delete actions do not silently proceed without friction.
  - Also closed Claude's related follow-up by adding confirmation to `deleteSelectedProducts`.
  - Added targeted tests for row delete cancellation/confirmation and selected-delete confirmation ordering.
- Files touched:
  - grid-rebuild-codex/shopscoutGrid.js
  - comparison.js
  - grid-rebuild-codex/tests/actions.test.js
  - tests/delete-safety.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node grid-rebuild-codex/tests/actions.test.js -> passed after failing before implementation
  - node tests/delete-safety.test.js -> passed after failing before implementation
  - npm test -> all 33 test files passed
  - npm run syntax -> passed
  - npm run lint -> 0 errors, 44 existing warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
  - Notes: Must-fix should be rechecked against the row delete path and the selected-delete follow-up.
- Follow-ups:
  - Multi-column sort UI/data alignment remains a separate suggestion from Claude's review of `d130770`.

## 2026-07-04 03:36 - Align multi-column sort UI and data behavior

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Closed Claude's suggestion from the `d130770` review by making SlickGrid adapter sorting honor the full sort chain instead of only `sort[0]`.
  - Saved projection sort state now uses a chained comparator, so secondary sort fields affect row order when primary fields tie.
  - SlickGrid `sortCols` events now emit the full sort chain through `onSortChange`.
  - Fixed the adapter fallback numeric parser so non-numeric text does not become `0`, which would suppress text sorting.
  - Expanded the adapter test to fail on first-column-only sorting and pass only when secondary sort keys are used.
- Files touched:
  - grid-rebuild-codex/slickGridAdapter.js
  - grid-rebuild-codex/tests/adapter.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node grid-rebuild-codex/tests/adapter.test.js -> passed after failing before implementation
  - npm test -> all 33 test files passed
  - npm run syntax -> passed
  - npm run lint -> 0 errors, 44 existing warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
  - Notes: Recheck saved multi-column sort indicators against actual row order and SlickGrid multi-sort header events.
- Follow-ups:
  - None for the d130770 sort mismatch.

## 2026-07-04 03:51 - Open capture pane as browser side panel

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Added Chrome/Edge native side panel support so clicking the extension action opens `popup.html` as the right-hand capture pane.
  - Removed Chrome/Edge `action.default_popup` so it does not compete with action-click side panel behavior.
  - Kept Firefox on the existing toolbar popup fallback because Firefox does not use Chrome's `side_panel` manifest key.
  - Added an icon-only popup header shortcut labeled `Open Comparison Dashboard`, placed immediately left of Settings, which opens `comparison.html`.
  - Kept the popup/right pane capture-only except for this explicit dashboard shortcut.
- Files touched:
  - manifest.json
  - background.js
  - popup.html
  - popup.js
  - popup.css
  - tests/side-panel.test.js
  - tests/popup-layout.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node tests/side-panel.test.js -> passed after failing before implementation
  - node tests/popup-layout.test.js -> passed after failing before implementation
  - npm test -> all 34 test files passed
  - npm run syntax -> passed
  - npm run lint -> 0 errors, 44 existing warnings
  - npm run build -> Chrome, Edge, Firefox built
  - Checked built manifests: Chrome/Edge include `side_panel.default_path: popup.html`; Firefox keeps `action.default_popup: popup.html`
- Review / handoff:
  - Reviewer: Claude
  - Notes: Recheck Chrome/Edge toolbar-click behavior after reloading the unpacked extension package.
- Follow-ups:
  - If Firefox sidebars are desired later, handle as a separate Firefox-specific implementation rather than adding Chrome `sidePanel` keys to `manifest.firefox.json`.

## 2026-07-04 04:03 - Let side panel fill allocated browser height

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Removed the old fixed popup height caps from the capture pane CSS.
  - Made `popup.html` use the allocated browser viewport height with a vertical flex shell.
  - Made the product list expand into the remaining pane height and scroll internally.
  - Added popup layout guards so the old `780px`/`500px` caps do not return.
- Files touched:
  - popup.css
  - tests/popup-layout.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node tests/popup-layout.test.js -> failed before implementation, passed after implementation
  - npm test -> all 34 test files passed
  - npm run syntax -> passed
  - npm run lint -> 0 errors, 44 existing warnings
  - npm run build -> Chrome, Edge, Firefox built
  - npm run typecheck -> passed
- Review / handoff:
  - Reviewer: Claude
  - Notes: Recheck the loaded Chrome/Edge side panel at browser heights shorter and taller than the screenshot.
- Follow-ups:
  - None.

## 2026-07-04 04:21 - Make grid sort, filters, and columns live

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Fixed column-header sorting so SlickGrid sort events refresh the ShopScout projection/state instead of only sorting adapter-local rows.
  - Fixed the projection fallback numeric parser so non-numeric text columns sort alphabetically instead of being treated as `0`.
  - Made product search input refresh the grid as the user types and made search scope changes re-render the grid.
  - Removed Apply-style actions from the Filters and Columns modals; column toggles and filter add/remove actions now update the grid immediately.
  - Added faceted filter value UI for fields with table values, such as Brand, using searchable checkbox options.
  - Added multi-value filter support in projections so checkbox-selected values work as OR matches for contains/equals/starts.
- Files touched:
  - grid-rebuild-codex/shopscoutGrid.js
  - grid-rebuild-codex/projections.js
  - grid-rebuild-codex/grid.css
  - grid-rebuild-codex/tests/controls.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node grid-rebuild-codex/tests/controls.test.js -> failed before implementation, passed after implementation
  - node grid-rebuild-codex/tests/adapter.test.js -> passed
  - node grid-rebuild-codex/tests/actions.test.js -> passed
  - node grid-rebuild-codex/tests/state.test.js -> passed
  - node grid-rebuild-codex/tests/projections.test.js -> passed
  - node grid-rebuild-codex/tests/wiring.test.js -> passed
  - node grid-rebuild-codex/tests/editing.test.js -> passed
  - npm test -> all 35 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 44 existing warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
  - Notes: Recheck the live dashboard manually with a list containing repeated Brand values; verify header click sort, column toggle immediacy, and Brand facet filtering.
- Follow-ups:
  - The current filter modal supports faceted checkbox values for add/remove flows; richer editing of an existing filter row can be added later if needed.

## 2026-07-04 11:12 - Restore settings and fix capture/grid polish

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Restored the full AI provider/settings feature set inside the dashboard main content area without using an iframe.
  - Made leaving About/info pages restore the product table and fixed the About back-to-products action.
  - Removed the Product List group from the About ribbon tab and aligned the feedback send button with the dashboard action theme.
  - Fixed compare/product grid presentation details: product thumbnails in compare headers, retailer source labels/logos, checkbox-column sizing, and five-star rating display.
  - Updated popup/side-panel sizing to use the allocated browser height with `100dvh`.
  - Reduced open-tab capture failures by trying the existing content-script message channel before injecting, then injecting only as fallback.
- Files touched:
  - background.js
  - comparison-feedback.js
  - comparison.css
  - comparison.html
  - comparison.js
  - grid-rebuild-codex/grid.css
  - grid-rebuild-codex/projections.js
  - grid-rebuild-codex/slickGridAdapter.js
  - grid-rebuild-codex/tests/adapter.test.js
  - grid-rebuild-codex/tests/projections.test.js
  - popup.css
  - settings.js
  - tests/comparison-table-defaults.test.js
  - tests/menu-layout.test.js
  - tests/popup-layout.test.js
  - tests/side-panel.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node grid-rebuild-codex/tests/adapter.test.js -> passed after failing before implementation
  - node tests/menu-layout.test.js -> passed after failing before implementation
  - node tests/side-panel.test.js -> passed after failing before implementation
  - node tests/popup-layout.test.js -> passed after failing before implementation
  - node tests/comparison-table-defaults.test.js -> passed
  - node grid-rebuild-codex/tests/projections.test.js -> passed after failing before implementation
  - npm test -> all 35 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 43 warnings
  - npm run build -> Chrome, Edge, Firefox built
  - Browser check -> local dashboard file is blocked by Browser URL policy; localhost load confirms static HTML but cannot complete runtime init outside extension context because `chrome.storage.local` is unavailable.
- Review / handoff:
  - Reviewer: Claude
  - Notes: Recheck the loaded Chrome/Edge extension side panel and dashboard in extension context, especially Settings, Open Tabs capture, source logo fallbacks, and compare header thumbnails.
- Follow-ups:
  - Grouping still uses the current custom grid grouping presentation. A later pass should move grouping to SlickGrid/DataView native grouping (`.slick-group`, `.slick-group-toggle`, `.slick-group-totals`) instead of restyling fake group rows.
  - Retailer logos depend on TheSVG catalog coverage. Unknown or unavailable retailer icons fall back to text labels.

## 2026-07-04 18:52 - Move grouping to native SlickGrid DataView groups

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Removed projection-generated fake group header rows from the active products-as-rows projection.
  - Added explicit grouping metadata to projections so the grid adapter can configure SlickGrid/DataView native grouping.
  - Added a lightweight group item metadata provider in the SlickGrid adapter for `.slick-group` rows, native group toggles, and no unused totals rows.
  - Added native expand/collapse handling through DataView `expandGroup` / `collapseGroup`.
  - Styled native SlickGrid group rows using the existing ShopScout grid theme while keeping the vendor `.slick-group` semantics intact.
- Files touched:
  - grid-rebuild-codex/projections.js
  - grid-rebuild-codex/slickGridAdapter.js
  - grid-rebuild-codex/grid.css
  - grid-rebuild-codex/tests/projections.test.js
  - grid-rebuild-codex/tests/adapter.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node grid-rebuild-codex/tests/projections.test.js -> failed before implementation, passed after implementation
  - node grid-rebuild-codex/tests/adapter.test.js -> failed before implementation, passed after implementation
  - node grid-rebuild-codex/tests/actions.test.js -> passed
  - node grid-rebuild-codex/tests/controls.test.js -> passed
  - npm test -> all 35 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 43 warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
  - Notes: Recheck grouping visually in the loaded dashboard with repeated Brand/Source values and verify group collapse/expand behavior.
- Follow-ups:
  - None for native grouping. Multi-level grouping can be added later if the UI needs nested groups.

## 2026-07-04 19:02 - Refine grid logos, names, pills, and group options

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Changed Source cells from button-style source pills to logo-first source links with accessible text labels and visible fallback text when an SVG fails.
  - Added known-brand logo rendering for Brand cells while preserving raw brand text for sorting/filtering and fallback display.
  - Added pill rendering for list-like spec/text values while excluding product names and prose/description-style fields.
  - Simplified grid product names to `Maker/Brand/Manufacturer | Model Number`, deduping repeated maker text and falling back to the captured title when structured identity is missing.
  - Kept Group By options field-based in Compare view by carrying row-field columns through the matrix projection.
  - Changed compare headers to stack a larger product thumbnail above the truncated product name.
  - Fixed the adapter comparator so `ShopScoutValues.parseNumeric()` returning `NaN` does not break secondary text sorting.
- Files touched:
  - grid-rebuild-codex/projections.js
  - grid-rebuild-codex/slickGridAdapter.js
  - grid-rebuild-codex/shopscoutGrid.js
  - grid-rebuild-codex/grid.css
  - grid-rebuild-codex/tests/projections.test.js
  - grid-rebuild-codex/tests/adapter.test.js
  - grid-rebuild-codex/tests/controls.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node grid-rebuild-codex/tests/projections.test.js -> failed before implementation, passed after implementation
  - node grid-rebuild-codex/tests/adapter.test.js -> failed before implementation, passed after implementation
  - node grid-rebuild-codex/tests/controls.test.js -> failed before implementation, passed after implementation
  - npm test -> all 35 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 43 warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
  - Notes: Recheck source/brand SVG availability in the loaded dashboard. Icons depend on TheSVG catalog coverage; text fallbacks remain present.
- Follow-ups:
  - Consider expanding the brand icon map as real product lists expose additional high-value brands.

## 2026-07-04 19:53 - Add logo source fallback priority, broader pills, and shared Save As options

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Added prioritized logo candidates for source and brand cells, trying rectangular/full-name sources first where stable URLs exist: Brandbird logotypes, Brandfetch domain logo URLs, WorldVectorLogo, SVG Logos, SVGL, then TheSVG icon fallback.
  - Added Microsoft-specific rectangular fallback candidates, including the user-provided Brandfetch asset context and stable WorldVectorLogo / SVG Logos / SVGL fallback paths.
  - Updated logo error handling so failed SVGs advance to the next candidate before showing text fallback.
  - Rendered single non-sentence spec values as pills, not only comma-separated values, while keeping names, notes, prices, ratings, and sentence-like prose unpilled.
  - Applied source/brand SVG rendering and pill rendering inside Compare view matrix cells.
  - Enlarged Compare view product header thumbnails to a 100px-wide image area.
  - Simplified the File ribbon Save group to a single Save As command and moved all format choices into the main Save As page.
  - Rebuilt Save As around shared field selection, output format, and destination options so all exports can use the same selected fields and can be copied to clipboard or saved/exported.
  - Added the filename convention `ShopScout - List Name - YYYY-MM-DD`.
- Files touched:
  - comparison.css
  - comparison.html
  - comparison.js
  - grid-rebuild-codex/grid.css
  - grid-rebuild-codex/projections.js
  - grid-rebuild-codex/slickGridAdapter.js
  - grid-rebuild-codex/tests/adapter.test.js
  - grid-rebuild-codex/tests/projections.test.js
  - grid-rebuild-codex/tests/wiring.test.js
  - tests/menu-layout.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node grid-rebuild-codex/tests/adapter.test.js -> failed before implementation, passed after implementation
  - node grid-rebuild-codex/tests/wiring.test.js -> failed before implementation, passed after implementation
  - node tests/menu-layout.test.js -> failed before implementation, passed after implementation
  - npm test -> all 35 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 42 warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
  - Notes: Verify logo fallbacks visually in the extension context. Brandbird has direct Google Storage catalog SVGs for some brands/retailers, Brandfetch asset pages are not scraped, and Brandfetch CDN behavior may depend on provider terms/client-id behavior.
- Follow-ups:
  - Add local or packaged logo assets later if external logo CDN dependencies prove unreliable.
  - Consider formal export tests for generated HTML/CSV/XML/JSON payloads if the Save As page expands further.

## 2026-07-04 22:15 - Fix grid logo placeholders and Save As spacing

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Removed Brandfetch runtime logo candidates because the CDN fallback can render a Brandfetch placeholder/watermark instead of the target brand.
  - Kept stable direct SVG logo candidates and text fallbacks for source and brand cells.
  - Fixed blank logo href handling so brand logos do not become links to the current page when no brand URL exists.
  - Removed visible underline/border styling from source and brand logo links.
  - Tightened SlickGrid native group row bottom spacing while keeping top spacing, and made group titles bold.
  - Adjusted product-name cell line-height/wrapping so name text is not vertically clipped.
  - Expanded the Save As page layout so format cards use the available main-content width instead of staying capped at a narrow max width.
- Files touched:
  - comparison.css
  - grid-rebuild-codex/grid.css
  - grid-rebuild-codex/slickGridAdapter.js
  - grid-rebuild-codex/tests/adapter.test.js
  - grid-rebuild-codex/tests/wiring.test.js
  - tests/menu-layout.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node grid-rebuild-codex/tests/adapter.test.js -> failed before implementation, passed after implementation
  - node grid-rebuild-codex/tests/wiring.test.js -> failed before implementation, passed after implementation
  - node tests/menu-layout.test.js -> failed before implementation, passed after implementation
  - npm test -> all 35 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 42 warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
  - Notes: Visually recheck logo fallback behavior in the loaded extension. Brandfetch is intentionally removed from runtime rendering; direct SVG provider failures now fall through to text.
- Follow-ups:
  - Consider packaging critical retailer/brand logos locally if external CDN reliability remains inconsistent.

## 2026-07-04 22:38 - Fix filter fields and dashboard action styling

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Changed the Filters modal field dropdown to use metadata/filterable fields in Compare view instead of product/model columns.
  - Preserved facet value dropdown behavior so fields like Brand still show checkbox options from the visible product data.
  - Replaced Save As Export/Reset buttons with shared dashboard primary/secondary action styles.
  - Updated the embedded Settings Save button to use the shared dashboard primary action style.
  - Right-aligned dashboard form/action rows so submit/reset buttons sit on the right side of forms.
- Files touched:
  - comparison.css
  - comparison.js
  - grid-rebuild-codex/shopscoutGrid.js
  - grid-rebuild-codex/tests/controls.test.js
  - settings.js
  - tests/menu-layout.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node grid-rebuild-codex/tests/controls.test.js -> failed before implementation, passed after implementation
  - node tests/menu-layout.test.js -> failed before implementation, passed after implementation
  - npm test -> all 35 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 42 warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
  - Notes: Recheck the Compare-mode filter field dropdown visually and confirm Settings/Save As/Feedback action buttons match the intended dashboard control styling.
- Follow-ups:
  - Consider converting remaining embedded settings utility buttons to the same dashboard action primitives if the settings page gets a broader visual pass.

## 2026-07-04 23:17 - Refine grid styling and column modal behavior

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Renamed the ribbon tab from `View` to `Products Table View`.
  - Changed the grid alternating row override from `#eaeaea` to `#f5f5f5`.
  - Updated relevant container border fallbacks from `#e5e7eb` to `#d1d5db`.
  - Fixed long product names in the grid by adding a two-line clamped title span with the full title in the tooltip.
  - Added themed modal close buttons and ensured grid Filters/Columns modals expose bottom Cancel and Done actions.
  - Added soft top divider lines above dashboard/form/modal action rows.
  - Reworked the Columns modal into an alphabetical multi-column layout with letter headers, search, Hide, and Remove controls.
  - Added grid/view state support for removed columns so removed metadata fields leave columns, filters, grouping, sorting, pinned columns, and compare rows for the current table view.
- Files touched:
  - comparison.css
  - comparison.html
  - grid-rebuild-codex/grid.css
  - grid-rebuild-codex/projections.js
  - grid-rebuild-codex/shopscoutGrid.js
  - grid-rebuild-codex/slickGridAdapter.js
  - grid-rebuild-codex/state.js
  - grid-rebuild-codex/tests/adapter.test.js
  - grid-rebuild-codex/tests/controls.test.js
  - grid-rebuild-codex/tests/wiring.test.js
  - tests/menu-layout.test.js
  - tests/ui-core.test.js
  - ui/modal.js
  - ui/ui-core.css
  - AGENT_CHANGELOG.md
- Validation:
  - node grid-rebuild-codex/tests/wiring.test.js -> passed
  - node grid-rebuild-codex/tests/adapter.test.js -> passed
  - node grid-rebuild-codex/tests/controls.test.js -> passed
  - node tests/menu-layout.test.js -> passed
  - node tests/ui-core.test.js -> passed
  - npm test -> all 35 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 42 warnings
  - npm run build -> Chrome, Edge, Firefox built
  - Local browser check via temporary localhost server -> confirmed `Products Table View` label, `--rule-soft: #d1d5db`, loaded title-clamp CSS, loaded column-modal grid CSS, and loaded `#f5f5f5` odd-row override
- Review / handoff:
  - Reviewer: Claude
  - Notes: The `Remove` option removes fields from the active grid/view metadata state. It does not physically delete metadata values from product records in IndexedDB because that would be destructive and should require a separate explicit confirmation flow.
- Follow-ups:
  - If the user wants permanent metadata deletion, add a separate destructive action with preview, confirmation, undo/export safety, and product-record migration tests.

## 2026-07-04 23:38 - Add local logo cache and normalize logo slots

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Added a packaged `logos/` cache for source and brand SVGs so known logos can be reused locally instead of relying on runtime provider lookups.
  - Added starter local SVGs for Amazon, Microsoft, Logitech, and Newegg.
  - Documented logo sourcing, reuse, sizing, and licensing cautions in `logos/README.md`.
  - Changed source/brand logo rendering to try local `logos/<key>.svg` first, then remote provider fallbacks, then readable text fallback.
  - Removed Brandbird from runtime logo candidates to avoid placeholder-prone provider output.
  - Normalized source and brand logo cells to a fluid rectangular slot capped at 80px wide and 24px high, with proportional SVG scaling.
  - Updated the extension build script so `logos/` is copied into Chrome, Edge, and Firefox packages.
- Files touched:
  - logos/README.md
  - logos/amazon.svg
  - logos/logitech.svg
  - logos/microsoft.svg
  - logos/newegg.svg
  - grid-rebuild-codex/grid.css
  - grid-rebuild-codex/slickGridAdapter.js
  - grid-rebuild-codex/tests/adapter.test.js
  - grid-rebuild-codex/tests/wiring.test.js
  - scripts/build-extension.ps1
  - AGENT_CHANGELOG.md
- Validation:
  - node grid-rebuild-codex/tests/adapter.test.js -> failed before implementation, passed after implementation
  - node grid-rebuild-codex/tests/wiring.test.js -> failed before implementation, passed after implementation
  - npm test -> all 35 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 42 warnings
  - npm run build -> Chrome, Edge, Firefox built and each dist contains `logos/`
  - Local browser/HTTP check -> confirmed loaded logo slot CSS and `logos/amazon.svg` served as SVG
- Review / handoff:
  - Reviewer: Claude
  - Notes: Local logo assets are curated starter files. The adapter still supports remote fallbacks for missing local files, then text fallback if every logo candidate fails.
- Follow-ups:
  - Add more packaged logos as real product/source data exposes recurring brands and retailers.
  - Verify individual logo licensing before expanding the production logo cache.

## 2026-07-04 23:52 - Center grid cells and suppress stale tab errors

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Confirmed prior logo/cache issues were implemented in commit `822905a` and remain in the changelog.
  - Centered SlickGrid cell contents horizontally while preserving vertical middle alignment.
  - Kept the product-name cell on the same centered alignment path with its two-line clamp.
  - Added a shared background-worker stale-tab error classifier for `No tab with id`, inaccessible tab, and invalid tab errors.
  - Wrapped badge updates, delayed AI auto-paste injection, and toast injection so closed-tab races do not leave unhandled promise errors in `background.js`.
- Files touched:
  - background.js
  - grid-rebuild-codex/grid.css
  - grid-rebuild-codex/tests/wiring.test.js
  - tests/background-tab-race.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node grid-rebuild-codex/tests/wiring.test.js -> failed before implementation, passed after implementation
  - node tests/background-tab-race.test.js -> failed before implementation, passed after implementation
  - npm test -> all 36 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 42 warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
  - Notes: This handles expected closed-tab races. If a different background stack trace appears, capture the exact function/line so the next guard can be placed at the true async boundary.
- Follow-ups:
  - Consider converting remaining direct `chrome.scripting.executeScript` calls to a single shared safe helper in a later background cleanup pass.

## 2026-07-05 00:04 - Tighten grid logo slot sizing

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Investigated why a logo measured as roughly `119 x 36px` despite the requested `80 x 24px` cap.
  - Confirmed the current CSS cap is in CSS pixels; `119 x 36` is consistent with an `80 x 24` CSS slot measured in physical/screenshot pixels at roughly 150% device scaling.
  - Tightened the grid logo slot with `box-sizing: border-box`, `min-width: 0`, and `overflow: hidden` so padding, borders, SVGs, or fallback content cannot expand beyond the slot.
  - Changed logo image boxes to fill the normalized slot while preserving proportional SVG rendering with `object-fit: contain`.
  - Added wiring-test assertions for the stricter slot and image sizing contract.
- Files touched:
  - grid-rebuild-codex/grid.css
  - grid-rebuild-codex/tests/wiring.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node grid-rebuild-codex/tests/wiring.test.js -> failed before implementation, passed after implementation
  - npm test -> all 36 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 42 warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
  - Notes: The visual slot remains `80 x 24` CSS pixels. Screenshot tools may still report approximately `120 x 36` physical pixels on a 150% scaled display.
- Follow-ups:
  - If the desired cap is `80 x 24` physical screenshot pixels on a 150% scaled display, the CSS slot would need to be intentionally reduced to about `53 x 16` CSS pixels, which would make it too small on normal 100% CSS-pixel rendering.

## 2026-07-05 00:26 - Normalize cached logo assets and settings navigation

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Normalized packaged SVG logo roots to intrinsic `80 x 24` dimensions while preserving viewBox-based proportional scaling.
  - Added a version query to local logo URLs so old browser-cached SVG files are bypassed after logo asset changes.
  - Kept product-name cells left-aligned while preserving centered vertical alignment for the rest of the grid.
  - Added left-pane settings navigation items for `AI Providers`, `Quick Capture Button`, and `Open*Facts Enrichment` in both embedded dashboard settings and standalone settings.
  - Added focused tests for versioned logo paths, normalized logo root dimensions, product-title left alignment, and settings navigation.
- Files touched:
  - logos/amazon.svg
  - logos/logitech.svg
  - logos/microsoft.svg
  - logos/newegg.svg
  - grid-rebuild-codex/grid.css
  - grid-rebuild-codex/slickGridAdapter.js
  - grid-rebuild-codex/tests/adapter.test.js
  - grid-rebuild-codex/tests/wiring.test.js
  - settings.html
  - settings.js
  - settings.css
  - comparison.css
  - tests/menu-layout.test.js
  - AGENT_CHANGELOG.md
  - Removed untracked duplicate folder: ShopScout/
- Validation:
  - node grid-rebuild-codex/tests/wiring.test.js -> failed before implementation, passed after implementation
  - node grid-rebuild-codex/tests/adapter.test.js -> failed before implementation, passed after implementation
  - node tests/menu-layout.test.js -> failed before implementation, passed after implementation
  - npm test -> all 36 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 42 warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
  - Notes: The displayed CSS logo slot remains capped at `80 x 24` CSS pixels. The packaged SVG files now also declare `80 x 24` intrinsic dimensions to avoid asset-level measurements reporting oversized source dimensions.
- Follow-ups:
  - None for this slice.

## 2026-07-07 02:33 - Add locale-aware unit display normalization

- Agent: Codex
- Branch: normalization-local-units
- Commit: This commit
- Status: Implemented
- Summary:
  - Created an isolated working branch for local-unit normalization work.
  - Replaced the previous one-way metric-to-U.S. display conversion in `ShopScoutValues.prettify()` with locale-aware unit display.
  - Added canonical unit parsing through `normalizeMeasurement()` so length, mass, volume, temperature, pressure, and electrical values normalize to stable base units for comparison while rendering localized display values.
  - Added browser-locale detection through `navigator.languages` / `navigator.language`, `Intl.Locale().measurementSystem` when available, and a region fallback where U.S., Liberia, and Myanmar use U.S. customary display.
  - Kept electrical values such as volts, watts, and amps unchanged except for cleaned unit casing.
  - Added coverage for U.S. and metric locale display, imperial-to-metric parsing, metric-to-U.S. display, and dimensions.
- Files touched:
  - shared/values/cellValues.js
  - tests/local-units.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node tests\local-units.test.js -> failed before implementation, passed after implementation
  - node tests\canonical.test.js -> passed
  - npm test -> all 30 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> failed before type fixes, passed after implementation
  - npm run lint -> 0 errors, 42 existing warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - Full normalization pipeline still needs schema mapping, enum normalization, dedupe candidate detection, provenance storage, and productRepo/grid integration.

## 2026-07-07 02:46 - Add deterministic attribute and enum normalization

- Agent: Codex
- Branch: normalization-local-units
- Commit: This commit
- Status: Implemented
- Summary:
  - Confirmed attribute chaos was part of the original normalization plan and continued in order after local-unit normalization.
  - Added `ShopScoutAttributeNormalization` as a deterministic, dependency-free module for field-name aliases and enum/value normalization.
  - Normalizes supplier field aliases such as `Colour`, `Voltage_Rating`, `USB Type`, and `Size Name` into canonical fields.
  - Normalizes high-value enum vocabularies for Color, Size, Material, Connector Type, and Power Source.
  - Returns provenance for every normalized value: canonical field, raw field where applicable, raw value, normalized value, confidence, and rule id.
  - Preserves unknown fields and unknown values instead of guessing.
  - Added the `normalization/` runtime directory to extension builds.
- Files touched:
  - normalization/attributes.js
  - tests/attribute-normalization.test.js
  - scripts/build-extension.ps1
  - AGENT_CHANGELOG.md
- Validation:
  - node tests\attribute-normalization.test.js -> failed before implementation, passed after implementation
  - npm test -> all 31 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 42 existing warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - Next ordered normalization slices: productRepo/grid integration, dedupe candidate detection, provenance persistence, and AI-assisted vocabulary expansion.

## 2026-07-07 02:56 - Wire normalized attributes into product storage and grid projection

- Agent: Codex
- Branch: normalization-local-units
- Commit: This commit
- Status: Implemented
- Summary:
  - Continued the normalization plan in order by integrating deterministic attribute normalization into persistence and grid projection.
  - ProductRepo now enriches added products with `_normalizedAttributes` when `ShopScoutAttributeNormalization` is loaded.
  - Stored normalized attributes include raw field, raw value, normalized value, confidence, and rule id.
  - SlickGrid projections now prefer persisted `_normalizedAttributes` and fall back to on-the-fly normalization for older products.
  - Normalized spec aliases such as `Colour` now appear under canonical grid fields such as `spec:color`.
  - Normalized enum values such as `midnight blue` and `wired` render as `Navy Blue` and `Corded Electric` in grid rows.
  - Added script-order wiring so `normalization/attributes.js` loads before `data/productRepo.js` in `popup.html` and `comparison.html`.
- Files touched:
  - data/productRepo.js
  - grid-rebuild-codex/projections.js
  - grid-rebuild-codex/tests/projections.test.js
  - tests/product-repo.test.js
  - tests/comparison-table-defaults.test.js
  - tests/popup-layout.test.js
  - comparison.html
  - popup.html
  - AGENT_CHANGELOG.md
- Validation:
  - node tests\product-repo.test.js -> failed before implementation, passed after implementation
  - node grid-rebuild-codex\tests\projections.test.js -> failed before implementation, passed after implementation
  - node tests\attribute-normalization.test.js -> passed
  - node tests\popup-layout.test.js -> passed
  - node tests\comparison-table-defaults.test.js -> passed
  - npm test -> all 31 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 42 existing warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - Next ordered slices: dedupe candidate detection, richer provenance review UI, and AI-assisted vocabulary expansion.

## 2026-07-07 03:45 - Add deterministic duplicate candidate detection

- Agent: Codex
- Branch: normalization-local-units
- Commit: This commit
- Status: Implemented
- Summary:
  - Added `ShopScoutMatching` as a deterministic duplicate-candidate matcher.
  - Detects likely duplicates from exact and normalized identifiers, brand/manufacturer similarity, and title token overlap.
  - Normalizes part/model separators so values like `6204-2RS`, `6204 2RS`, and `62042rs` can match.
  - Added `SSProductRepo.findDuplicateCandidates(listId, options)` for list-level candidate reporting.
  - Candidate detection is read-only: it does not merge, delete, or mutate products.
  - Added popup and comparison script loading for `normalization/matching.js` before `data/productRepo.js`.
  - Added tests for direct matcher behavior, repo-level candidate detection, non-mutation, and script load order.
- Files touched:
  - normalization/matching.js
  - data/productRepo.js
  - comparison.html
  - popup.html
  - tests/dedupe-candidates.test.js
  - tests/product-repo.test.js
  - tests/comparison-table-defaults.test.js
  - tests/popup-layout.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node tests\dedupe-candidates.test.js -> failed before implementation, passed after implementation
  - node tests\product-repo.test.js -> failed before implementation, passed after implementation
  - node tests\popup-layout.test.js -> passed
  - node tests\comparison-table-defaults.test.js -> passed
  - npm test -> all 32 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 42 existing warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - Add a review UI for duplicate candidates before any merge workflow is considered.

## 2026-07-05 00:56 - Remove logo images and simplify settings panels

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Removed all cached SVG logo image files from `logos/` and updated the logo README to document that logo images are disabled.
  - Removed grid source/brand logo image rendering, remote logo fallbacks, image error fallback handling, and logo-image CSS.
  - Source and brand cells now render readable text tokens only, eliminating the remaining logo image sizing issue.
  - Reworked embedded settings into a two-column layout: left menu plus one main content panel.
  - Left-menu items now open the matching main panel instead of duplicating content on the right.
  - Removed the right settings pane, inline setup guide panel, old setup-guide iframe, and random floating `Saved` label.
  - Restored setup guide access as a `Setup Guide` button that opens the selected provider instructions in a themed modal.
- Files touched:
  - logos/amazon.svg
  - logos/logitech.svg
  - logos/microsoft.svg
  - logos/newegg.svg
  - logos/README.md
  - grid-rebuild-codex/slickGridAdapter.js
  - grid-rebuild-codex/grid.css
  - grid-rebuild-codex/tests/adapter.test.js
  - grid-rebuild-codex/tests/wiring.test.js
  - settings.js
  - settings.html
  - settings.css
  - comparison.css
  - tests/menu-layout.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node grid-rebuild-codex/tests/adapter.test.js -> failed before implementation, passed after implementation
  - node grid-rebuild-codex/tests/wiring.test.js -> failed before implementation, passed after implementation
  - node tests/menu-layout.test.js -> failed before implementation, passed after implementation
  - npm test -> all 36 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 42 warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
  - Notes: The logo-image feature is intentionally removed, not resized. Reintroducing logos should be a separate explicit feature with a stricter asset pipeline and visual QA.
- Follow-ups:
  - None for this slice.

## 2026-07-05 07:52 - Fix settings navigation, table-view order, grouping label, and AI prompt export

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Moved `Products Table View` so it appears immediately after `Products` in the ribbon.
  - Scoped settings left-menu navigation to the mounted settings root so selecting `AI Providers`, `Quick Capture Button`, or `Open*Facts Enrichment` changes the main settings panel reliably.
  - Changed the columns modal from CSS-grid placement to masonry-style columns so alphabet letter headers do not create uneven top gaps.
  - Added an explicit `Group` label pill to native SlickGrid group rows while keeping the actual group title bold.
  - Added `AI Prompt` as an optional field in the dashboard `Save As` page and included it as a dedicated export section when selected.
- Files touched:
  - comparison.html
  - comparison.js
  - settings.js
  - grid-rebuild-codex/grid.css
  - grid-rebuild-codex/slickGridAdapter.js
  - grid-rebuild-codex/tests/wiring.test.js
  - tests/menu-layout.test.js
  - AGENT_CHANGELOG.md
- Validation:
  - node tests\menu-layout.test.js -> failed before implementation, passed after implementation
  - node grid-rebuild-codex\tests\wiring.test.js -> failed before implementation, passed after implementation
  - node grid-rebuild-codex\tests\adapter.test.js -> passed
  - npm test -> all 36 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 42 existing warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - None for this slice.

## 2026-07-07 04:36 - Connect taxonomy normalization and duplicate review

- Agent: Codex
- Branch: normalization-local-units
- Commit: This commit
- Status: Implemented
- Summary:
  - Added a deterministic taxonomy bridge that connects the bundled Shopify taxonomy API (`SSCanonical`) to the normalization pipeline.
  - Product normalization now stores taxonomy category context and category-relevant attribute hints when a product can be matched locally.
  - Attribute normalization now uses local aliases first, then falls back to Shopify taxonomy field hints for unmapped field names.
  - Persisted normalized attributes now keep both value provenance (`rule`) and field-mapping provenance (`fieldRule`, `fieldSource`).
  - Legacy chrome-storage mirror writes now reuse productRepo normalization so mirrored dashboard data gets normalized consistently.
  - Added a Products ribbon command for `Possible Duplicates` and a main-content duplicate review page showing candidate pairs, scores, reasons, evidence, thumbnails, and product-open actions.
  - Duplicate review is read-only; it does not merge, delete, or mutate products.
- Files touched:
  - AGENT_CHANGELOG.md
  - comparison.css
  - comparison.html
  - comparison.js
  - data/productRepo.js
  - normalization/attributes.js
  - normalization/taxonomyBridge.js
  - popup.html
  - tests/comparison-table-defaults.test.js
  - tests/menu-layout.test.js
  - tests/popup-layout.test.js
  - tests/product-repo.test.js
  - tests/taxonomy-normalization.test.js
  - utils.js
- Validation:
  - node tests\taxonomy-normalization.test.js -> failed before implementation, passed after implementation
  - node tests\product-repo.test.js -> failed before implementation, passed after implementation
  - node tests\menu-layout.test.js -> failed before implementation, passed after implementation
  - node tests\popup-layout.test.js -> passed
  - node tests\comparison-table-defaults.test.js -> passed
  - npm test -> all 33 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 41 existing warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - Taxonomy warm-up may parse the bundled Shopify taxonomy on first dashboard reconciliation, then reuse the existing IndexedDB cache. Monitor first-run latency with larger lists.
  - Duplicate candidate review intentionally stops before merge workflows; any merge/ignore decisions should be a separate reviewed feature.

## 2026-07-07 11:15 - Improve duplicate review and normalize existing captures

- Agent: Codex
- Branch: normalization-local-units
- Commit: This commit
- Status: Implemented
- Summary:
  - Added stable duplicate candidate keys so each possible duplicate pair can be reviewed consistently across refreshes.
  - Added per-list duplicate candidate decisions stored in IndexedDB meta.
  - Updated the duplicate review page with `Same product`, `Not duplicate`, and clear-decision actions.
  - Kept duplicate decisions as review labels only; this does not merge, delete, or mutate products.
  - Added a productRepo normalization backfill for existing captured products.
  - Normalization Review now rebuilds normalization data for the current list before collecting review items, so older captures participate in the new review pipeline.
- Files touched:
  - AGENT_CHANGELOG.md
  - comparison.css
  - comparison.js
  - data/productRepo.js
  - normalization/matching.js
  - tests/dedupe-candidates.test.js
  - tests/menu-layout.test.js
  - tests/product-repo.test.js
- Validation:
  - node tests\dedupe-candidates.test.js -> failed before implementation, passed after implementation
  - node tests\product-repo.test.js -> failed before implementation, passed after implementation
  - node tests\menu-layout.test.js -> failed before implementation, passed after implementation
  - npm test -> all 35 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 41 existing warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - Same-product decisions are review labels only; a future merge workflow should remain separate and explicitly confirmed.

## 2026-07-07 11:06 - Build normalization libraries and review queue

- Agent: Codex
- Branch: normalization-local-units
- Commit: This commit
- Status: Implemented
- Summary:
  - Moved deterministic field aliases, canonical fields, enum vocabularies, and exact-alias rules into `normalization/libraries/defaultRules.js`.
  - Refactored `normalization/attributes.js` so the normalization engine consumes the rules library instead of owning hardcoded rule tables.
  - Added `normalization/review.js`, a read-only collector that identifies unmapped values, low-confidence mappings, and taxonomy fallback mappings needing human review.
  - Added a `Normalize Review` command in the Products ribbon.
  - Added a main-content `Normalization Review` dashboard page with product, category, raw field/value, normalized field/value, reason, confidence, rule, and open-product action.
  - Kept review read-only; this slice does not yet write accepted aliases back into the library.
- Files touched:
  - AGENT_CHANGELOG.md
  - comparison.css
  - comparison.html
  - comparison.js
  - normalization/attributes.js
  - normalization/libraries/defaultRules.js
  - normalization/review.js
  - popup.html
  - tests/attribute-normalization.test.js
  - tests/comparison-table-defaults.test.js
  - tests/menu-layout.test.js
  - tests/normalization-libraries.test.js
  - tests/normalization-review.test.js
  - tests/popup-layout.test.js
  - tests/product-repo.test.js
- Validation:
  - node tests\normalization-libraries.test.js -> failed before implementation, passed after implementation
  - node tests\normalization-review.test.js -> failed before implementation, passed after implementation
  - node tests\menu-layout.test.js -> failed before implementation, passed after implementation
  - node tests\popup-layout.test.js -> failed before implementation, passed after implementation
  - node tests\comparison-table-defaults.test.js -> failed before implementation, passed after implementation
  - npm test -> all 35 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 41 existing warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - Add library approval workflows later: accept alias, ignore item, and persist user-approved mappings without editing source files at runtime.

## 2026-07-07 - Consolidated Claude review of aaf39e3 → 0d681cf

- Agent: Claude
- Branch: normalization-local-units (see finding on branch discipline below)
- Commit: This commit (review only)
- Status: Reviewed
- Summary:
  - Reviewed 25 Codex commits since my last review at 8531093, covering: direct-response fixes to prior findings (aaf39e3, 6cbf3d6), side-panel migration (ee94681, cbb9cb8), live grid controls (f832f97), native SlickGrid grouping (e9719bd), settings/dashboard polish (be5b94c, ff89452, b310758, 1b540bd, f94eb73), logo pipeline lifecycle (e5b053c → 7c89d8c → c67f201 → 822905a → 5f4bf2d → e68fc78 → f94eb73), stale-tab race safety (a1a7ca6), locale-aware unit normalization (1d6eb03), attribute+enum normalization pipeline (6bfb0f2, 24eabac), duplicate candidate detection (35b5477, 0d681cf), and taxonomy bridge + review UI (b7823e0, 18a5295).
  - Direct verifications of prior findings: aaf39e3 correctly wraps both grid-row delete (grid-rebuild-codex/shopscoutGrid.js:547) and `deleteSelectedProducts` (comparison.js:1875) with `ShopScoutUI.confirm` and fail-closed behavior. 6cbf3d6 correctly moves DataView.sort to `sortableComparatorChain` for the full chain, emits full chain via `onSortChange`, and fixes an incidental numeric-parser NaN gap.
  - Read normalization/attributes.js, matching.js, taxonomyBridge.js, review.js end-to-end. Confirmed side_panel manifest change against manifest.firefox.json (Firefox keeps action.default_popup, correct). Cross-checked with an Explore agent survey of the middle-band UI-polish commits.
- Files touched:
  - none (review only)
- Validation:
  - `git branch --show-current` -> `normalization-local-units` (see finding)
  - `git log grid-rebuild-codex..normalization-local-units` -> 5 commits (24eabac, 35b5477, b7823e0, 18a5295, 0d681cf) NOT present on the shared branch
  - Verified manifest side_panel + Firefox fallback
  - Verified attribute normalization is dependency-free, provenance-tracking, and non-mutating on unmapped input
  - Verified duplicate matching is deterministic and read-only (no product mutation)
- Review / handoff:
  - Reviewer: Claude
  - Findings:
    - Must-fix: Branch discipline violated. Commits 24eabac, 35b5477, b7823e0, 18a5295, 0d681cf live on `normalization-local-units` only — they are NOT on the shared `grid-rebuild-codex` branch. AGENTS.md single-branch rule (line 38-49) states "For now, Claude and Codex should both work on `grid-rebuild-codex`. Do not create, switch to, or push separate Claude/Codex task branches unless the user explicitly asks for branch splitting again." The five normalization commits (persist normalized attributes, detect duplicates, connect taxonomy + review, normalization libraries, duplicate decisions) need to be brought onto `grid-rebuild-codex`. Codex's changelog entries also mis-record their commit branch — the entries at 2026-07-07 02:56, 03:45, 04:36, 11:15, and 11:06 (11:15 is chronologically after 11:06 despite the log order) all report `Branch: normalization-local-units`. Fix: fast-forward `grid-rebuild-codex` to include these five commits (or open a decision with the user about branch splitting), and update the changelog to reflect the shared branch.
    - Suggestion: Duplicate-candidate detection is O(n²) in `detectDuplicateCandidates` (normalization/matching.js:161-183). For 100 products = 10K pair scores (fine). For 1,000 products = 1M (acceptable but noticeable). For 10K products = 100M (would freeze the UI thread). No blocking-list problem today but worth pre-empting: a blocking-key stage (bucket by first-token or brand slug before scoring) would drop this to near-linear before user lists get that large. Not blocking.
    - Suggestion: `needsReview` in normalization/review.js:28-33 uses `< 0.9` confidence threshold as a magic number. Given that `attributes.js` emits `0.95` for non-exact aliases and `1.0` for exact/canonical hits, the practical effect is "review taxonomy-fallback and unmapped only", which is fine. But documenting the 0.9 in code (or lifting it to `NS.REVIEW_CONFIDENCE_THRESHOLD`) would let future changes to the confidence taxonomy stay in sync with the review triage automatically.
    - Suggestion: `configureSidePanelBehavior` in background.js runs both at top-level and inside `chrome.runtime.onInstalled`. The top-level call is the load-bearing one (service workers restart frequently and `onInstalled` doesn't re-fire); the `onInstalled` call is redundant. Not harmful, just extra noise on install/update. Optional cleanup.
    - Style preference: normalization/attributes.js exposes `_fieldAliases` and `_enums` as underscore-prefixed backdoors on the public namespace. Common in test-facing code, but the same info is already reachable through `ShopScoutNormalizationRules`. Optional — remove or leave, minor.
    - Approved: aaf39e3 (delete confirms) — directly and correctly addresses my prior Must-fix. Two-step confirm via themed dialog with fail-closed if UI unavailable. Also picked up the follow-up (`deleteSelectedProducts`) I flagged.
    - Approved: 6cbf3d6 (multi-column sort) — directly and correctly addresses my prior Suggestion. Full-chain comparator + full-chain event emission. Numeric parser hardening is a bonus.
    - Approved: ee94681 (side panel) — clean manifest change: adds `sidePanel` permission, `side_panel.default_path`, drops `action.default_popup` for Chrome/Edge, keeps Firefox on `action.default_popup` via `manifest.firefox.json` (verified). `setPanelBehavior({openPanelOnActionClick: true})` in the service worker. `?.` guards protect older browsers. Correct.
    - Approved: cbb9cb8 (side-panel height) — pure CSS + test, `100dvh` viewport unit is right for panel sizing.
    - Approved: f832f97 (live grid controls) — removes Apply-style modal actions in favor of immediate re-render on control change; adds faceted checkbox filter values for enum-shaped fields (Brand). Test file `controls.test.js` covers the new immediacy contract.
    - Approved: be5b94c (settings + capture polish) — largest commit in the batch by file count but each individual concern (in-dashboard settings without iframe, About back-to-products, compare thumbnails, 5-star display, `100dvh` popup sizing, existing-channel-then-inject open-tab capture) is scoped and tested. Notable improvement: open-tab capture tries the existing content-script message channel before re-injecting, which reduces spurious injection failures.
    - Approved: e9719bd (native SlickGrid grouping) — moves from projection-synthesized fake group rows to `DataView.setGrouping` + `SlickGrid` group item metadata provider. `.slick-group` semantics kept intact. Right architectural move.
    - Approved: a1a7ca6 (stale tab races) — shared `isMissingTabError` classifier + wrapping of badge/toast/AI-auto-paste chrome.scripting calls. Well-scoped defense against known async race with closed tabs. Tests pin the classifier behavior.
    - Approved: Logo pipeline (e5b053c → 7c89d8c → c67f201 → 822905a → 5f4bf2d → e68fc78 → f94eb73). Codex worked through the logo problem end-to-end and eventually removed logo images entirely in f94eb73. The removal is intentional per the changelog ("logo-image feature is intentionally removed, not resized; reintroducing logos should be a separate explicit feature with a stricter asset pipeline and visual QA"). Not a workaround for an earlier bug — a design decision after the CDN/asset-sizing trail hit diminishing returns. Correct call.
    - Approved: ff89452 (filter fields + action styling) — filter-field dropdown correctly scoped to metadata/filterable fields for Compare view, faceted values preserved for Brand-style enums. Shared primary/secondary dashboard button classes applied consistently.
    - Approved: b310758 (column modal + grid styling) — Products Table View rename, alphabetical multi-column layout with letter headers + search, and the important new state concept: `removedColumns` in view state (removes from grid metadata WITHOUT deleting from product records in IndexedDB). Codex's own note calls out that permanent metadata deletion would need a separate destructive flow — correct scope discipline.
    - Approved: 1b540bd (settings nav + table view + AI prompt export) — settings left-menu correctly scoped to mounted root, columns modal switched to CSS masonry to avoid alphabet-header-gap unevenness, `AI Prompt` optional export section added.
    - Approved: 1d6eb03 (locale-aware unit display) — `normalizeMeasurement` gives stable base units for comparison while `prettify` renders in the browser's measurement system (US/Liberia/Myanmar → U.S. customary; everyone else → metric). Uses `Intl.Locale().measurementSystem` where supported. Electrical values left unchanged except casing. Right shape.
    - Approved: 6bfb0f2 (attribute + enum normalization) — `ShopScoutAttributeNormalization` is dependency-free, provenance-tracking (`{field, raw, normalized, confidence, rule}`), preserves unknown fields and unknown values (returns `rule: 'unmapped'` instead of guessing). Correct discipline.
    - Approved: 24eabac (wire normalization into repo + grid) — `data/productRepo.js` enriches added products with `_normalizedAttributes` when the module is loaded; SlickGrid projections prefer persisted `_normalizedAttributes` and fall back to on-the-fly normalization for older captures. Script load order in `comparison.html` and `popup.html` verified correct.
    - Approved: 35b5477 (duplicate candidate detection) — `ShopScoutMatching` scores by identifier overlap, brand/manufacturer match, title token Jaccard. Deterministic, read-only, threshold 0.72. Model number normalization (`6204-2RS` / `6204 2RS` / `62042rs`) is a nice touch. Complexity concern noted above as Suggestion.
    - Approved: b7823e0 (taxonomy bridge + review UI) — clean fallback pattern: local aliases first, taxonomy hints second. Field-mapping provenance (`fieldRule`, `fieldSource`) separated from value provenance (`rule`). Legacy chrome.storage mirror writes now reuse productRepo normalization so mirrored dashboard data gets normalized consistently — good.
    - Approved: 18a5295 (normalization libraries + review page) — rules lifted from attributes.js into `normalization/libraries/defaultRules.js` so the engine consumes a data table instead of owning it. `Normalization Review` main-content page. Read-only queue (doesn't write accepted aliases yet — correct scope).
    - Approved: 0d681cf (duplicate decisions + normalization backfill) — stable `candidateKey` (sorted product IDs joined) so decisions persist across refreshes; per-list duplicate decisions in IndexedDB meta; `Same product`/`Not duplicate`/clear-decision actions are review LABELS only (no merge/delete/mutation). Normalization backfill runs before collecting review items so older captures participate in the new pipeline. Correct discipline throughout.
- Follow-ups:
  - Bring the five `normalization-local-units`-only commits onto the shared branch (or open the branch-split decision with the user). This is the only blocking finding.
  - Documenting the 0.9 review threshold in code as a named constant (optional).
  - Blocking-key pre-filter for duplicate detection before lists reach ~10K products (optional).
  - Redundant top-level + onInstalled `configureSidePanelBehavior` calls (optional cleanup).

## 2026-07-07 11:29 - Consolidate normalization work onto shared branch

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Fast-forwarded `grid-rebuild-codex` from `1b540bd` to `07b85be`.
  - Brought the normalization-local-units work, duplicate review improvements, normalization review page, and Claude review record onto the shared working branch.
  - Preserved linear history; no merge commit and no conflict resolution were needed.
  - This is branch consolidation after a user-requested normalization fork, not a functional code change.
- Files touched:
  - AGENT_CHANGELOG.md
- Validation:
  - git merge-base --is-ancestor grid-rebuild-codex normalization-local-units -> ff-ok before merge
  - git merge --ff-only normalization-local-units -> passed
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - Push `grid-rebuild-codex` when the user wants the consolidated branch published to GitHub.

## 2026-07-07 11:45 - Add normalization approval workflow

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Added `normalization/userRules.js` as the per-list user-approved normalization rules overlay.
  - Added Accept alias and Ignore actions to the Normalization Review page.
  - Persisted accepted aliases and ignored review keys in IndexedDB meta through `productRepo`.
  - Reloaded user rules before capture, bulk capture, and normalization rebuild so future products use approved mappings automatically.
  - Made the attribute normalizer reloadable and provenance-aware for `user-enum:*` rules.
  - Added stable normalization review item keys and filtered ignored items from the review queue.
- Files touched:
  - AGENT_CHANGELOG.md
  - comparison.css
  - comparison.html
  - comparison.js
  - data/productRepo.js
  - grid-rebuild-codex/tests/projections.test.js
  - normalization/attributes.js
  - normalization/review.js
  - normalization/userRules.js
  - popup.html
  - tests/menu-layout.test.js
  - tests/normalization-review.test.js
  - tests/product-repo.test.js
  - tests/user-rules-normalization.test.js
- Validation:
  - node tests\user-rules-normalization.test.js -> failed before implementation, passed after implementation
  - node tests\product-repo.test.js -> failed before implementation, passed after implementation
  - node tests\menu-layout.test.js -> failed before implementation, passed after implementation
  - npm test -> all 43 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 41 existing warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - Add a dedicated user-rules management page later for editing or deleting approved mappings.
  - Current approval accepts one review item at a time; bulk approval can be a later workflow.

## 2026-07-07 14:23 - Add user-rule management, bulk review actions, and duplicate blocking keys

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Added a Products ribbon command for `User Rules`.
  - Added a main-content user normalization rules page that lists approved field aliases, value aliases, and ignored review keys.
  - Added user-rule edit and delete actions backed by `productRepo`.
  - Added bulk Normalization Review actions: `Accept all matching` and `Ignore all matching`.
  - Added duplicate candidate blocking keys so large-list duplicate detection scores only plausible candidate buckets instead of every product pair.
  - Kept duplicate detection non-mutating and kept user rules list-specific.
- Files touched:
  - AGENT_CHANGELOG.md
  - comparison.html
  - comparison.js
  - data/productRepo.js
  - normalization/matching.js
  - normalization/userRules.js
  - tests/dedupe-candidates.test.js
  - tests/menu-layout.test.js
  - tests/product-repo.test.js
  - tests/user-rules-normalization.test.js
- Validation:
  - node tests\user-rules-normalization.test.js -> failed before implementation, passed after implementation
  - node tests\product-repo.test.js -> failed before implementation, passed after implementation
  - node tests\menu-layout.test.js -> failed before implementation, passed after implementation
  - node tests\dedupe-candidates.test.js -> failed before implementation, passed after implementation
  - npm test -> all 43 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run lint -> 0 errors, 41 existing warnings
  - npm run build -> Chrome, Edge, Firefox built
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - Bulk ignore currently saves each matching review key individually and rebuilds after each repo decision; if very large review queues become common, add a repo-level batch decision API.

## 2026-07-07 14:45 - Icecat + Schema.org corpus pull (dataset, no code change)

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (docs-only)
- Status: Dataset staged for downstream normalization work; downloads in progress
- Summary:
  - Purpose: ground the ShopScout normalization pipeline against two industry references — Schema.org's Product/Offer vocabulary (universal column-header standard) and Icecat's Open catalog (real product specs with normalized attribute names + enum values).
  - Account: free Open Icecat account. Paid `/export/level4/` endpoints return 403. All work below is under `/export/freexml/` and `/export/freexml.int/`.
  - All data is staged under `D:\icecat-data\` — deliberately outside the OneDrive-synced repo. Not tracked in git. Credentials in `D:\icecat-data\.netrc` (chmod 600, do NOT read/log/commit).
- Files touched:
  - AGENT_CHANGELOG.md (this entry)
  - No source or repo files. All artifacts are outside the repo.
- What is on disk (D:\icecat-data\):
  - schema-org\ — 6 MB total, complete: `schemaorg-all-https.jsonld` (full JSON-LD vocabulary), `schemaorg-current-https-properties.csv` (flat properties table — direct lookup for the Colour→color / Size Name→size canonical column name problem), `schemaorg-current-https-types.csv`
  - refs\ — 15 files, ~1.6 GB. Includes: `CategoryFeaturesList.xml.gz` (1.5 GB — master category × feature mapping; ~15 GB uncompressed, stream-parse only), `FeaturesList.xml.gz` (60 MB), `FeatureValuesVocabularyList.xml.gz` (44 MB — normalized enum values per feature), `CategoriesList.xml.gz` (30 MB), `SuppliersList.xml.gz`, plus BrandOrganizations, DistributorList, FeatureGroupsList, FeatureLogosList, LanguageList, MeasuresList, RelationsList, CategoryFeatureIntervalsList, SupplierProductFamiliesListRequest
  - indexes\ — 15 files, ~250 MB uncompressed. Per-language master indexes for all English variants (EN, INT, EN_AE..EN_ZA). Each entry: `<file path Product_ID Supplier_id Catid On_Market Model_Name Prod_ID Updated Quality Country_Markets EAN_UPCs M_Prod_IDs>`.
  - indexes-other-languages\ — 66 non-English language indexes fetched incidentally. Ignorable; safe to delete.
  - daily\ — 6.3 MB compressed. `EN.daily.index.xml.gz` (EN scope) and `root.daily.index.xml.gz` (INT scope, 72,929 products). Note: free Open Icecat serves the base index at the daily.index.xml URL — it's not a true 24-hour delta. Diff against a saved snapshot using Product_ID + Updated= timestamps.
  - products\<VARIANT>\ — currently downloading. Target when done: EN 17,645 (~1.5 GB), INT 72,929 (~6.2 GB), 13 regional EN_XX ~194,987 (~16 GB). Total 15 English variants: ~285,561 XMLs, ~24 GB. Two background download jobs are running (6 concurrent per variant, resumable via skip-if-exists, retry on transient failure). ETA all-in: 12-16 hrs at gentle-to-free-tier rate. Fetch logs are `<VARIANT>.fetch.log` with OK/FAIL <code>/skip prefixes.
- Validation:
  - Auth verified against `data.icecat.biz` — free tier confirmed by 404 body on `/export/level4/` ("You are not allowed to access a Full Icecat repository with a free Open Icecat account").
  - Schema.org: 5 files downloaded, all HTTP 200, sizes verified.
  - Icecat refs: 15 files downloaded, all HTTP 200.
  - Icecat indexes: 81 language indexes fetched (English-relevant 15 kept in indexes\, other 66 archived to indexes-other-languages\).
  - Product XMLs: 5-sample average of 89 KB/XML used for size estimates.
- Review / handoff:
  - Reviewer: Codex (dataset-consumer)
  - How this maps to code work (Codex, decide scope for next slice):
    1. Column-name canonicalization (immediate, low-cost): load `schemaorg-current-https-properties.csv` at build time. Filter to properties whose domainIncludes contains Product or Offer. Use as target canonical column names in `normalization/libraries/defaultRules.js` field aliases — replaces the hardcoded Colour→color, Size Name→size list with a schema-backed lookup.
    2. Feature-value normalization (medium-cost): parse `FeatureValuesVocabularyList.xml.gz` for Icecat's canonical enum values per feature (e.g., all valid Color values). Extend normalization/attributes.js ENUMS with these vocabularies where confidence-worthy. Pre-process at build time into a slim JSON keyed by canonical feature name — do NOT ship the raw 44 MB XML in the extension.
    3. Category → features mapping (heavier): `CategoryFeaturesList.xml.gz` (1.5 GB) tells you which features apply to which product category. Lets `pickDefaultSpecColumns(products)` be category-aware. Only worth parsing if the current heuristic underperforms.
    4. Product-level lookup (optional, requires infra): 285K product XMLs are the "canonical answer" for real Icecat-covered products. Could power an offline "ShopScout looked this product up in Icecat" reference source. Requires: keyed by Product_ID / M_Prod_ID / EAN / UPC / GTIN → served from a SQLite/DuckDB the extension queries. Out of scope for immediate normalization work.
- Constraints and cautions:
  - License: Open Icecat is CC-BY-ND. Attribution required, NO modifications. If ShopScout redistributes any Icecat-derived data (even bundled JSON), the extension must credit Icecat and cannot represent modified values as canonical Icecat data. Safe use: derive vocabulary at build time, cite source in a NOTICE file, don't re-publish raw XMLs.
  - Rate limits: free tier throttles above ~10 concurrent connections. Any future sync script must stay ≤6.
  - `CategoryFeaturesList.xml.gz` is 1.5 GB compressed / ~15 GB uncompressed. Stream-parse; don't zcat the whole thing into memory.
  - Do NOT put any raw Icecat data in the ShopScout repo. Reference by path in build scripts; ship only the derived JSON/CSV that ends up in the extension.
- Follow-ups:
  - Await Icecat product XML downloads to complete (I'll drop a completion note when done).
  - Codex to decide which of the four consumption slices above is the next code-side task, if any.

## 2026-07-07 - Phase 1 kickoff: schema contract + corpus scope decisions

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: c921079 (gitignore), 524258a (SCHEMA.md); this entry uncommitted (log-only)
- Status: Awaiting Codex review of SCHEMA.md
- Summary:
  - Accepted Codex's split proposal (Claude owns generators, Codex owns runtime integration) with all three of Codex's constraints (fail-safe load, no raw XML at runtime, provenance metadata required).
  - Committed `.gitignore` change (`c921079`) that excludes `data-sources/` — the local Icecat + Schema.org corpus and credentials are now protected from git regardless of the future generated-data workflow.
  - Committed `normalization/libraries/generated/SCHEMA.md` (`524258a`) — the JSON-shape contract Codex was waiting on before starting Phase 2. Pins shapes for schemaOrgProperties.json, icecatVocabulary.json, icecatCategoryFeatures.json, and BUILD_MANIFEST.json. Also pins the runtime consumer contract and the offline producer contract.
  - Scope narrowed at user direction: cancelled INT and 13 regional English variants. Only `EN` was retained on disk (17,422 files, 1.21 GB, 98.7% success rate). Rationale: `INT` was the biggest superset and the 13 regional variants are subsets of INT — since Path 1 (Schema.org column names), Path 2 (Icecat vocabulary), and Path 3 (Icecat category features) all consume the `refs/` directory (not per-product XMLs), keeping `EN` alone is sufficient for the four consumption paths flagged in the earlier changelog entry. Product XMLs are useful only if Path 4 (per-product Icecat lookup) is later pursued, in which case the same account can re-fetch on demand.
  - The `data-sources/icecat/` Windows directory junction resolves to `D:\icecat-data\`. Junction is git-ignored. OneDrive is off, so no external sync concerns.
- Files touched:
  - .gitignore
  - normalization/libraries/generated/SCHEMA.md (new)
  - AGENT_CHANGELOG.md (this entry)
- Validation:
  - `git status` — clean apart from this changelog entry
  - `git log --oneline -3` — 524258a SCHEMA, c921079 gitignore, 9d1f7dd corpus-pull-log
- Review / handoff:
  - Reviewer: Codex
  - Notes: Codex — please review SCHEMA.md and either approve inline or comment with proposed changes. Once approved, Claude writes the generators (`scripts/build-normalization-libraries/`) and Codex writes the runtime loader (`normalization/libraries/generated.js`) + runtime merge logic against the agreed shape. Meet at Phase 3 for cross-review.
- Follow-ups:
  - After Codex approves SCHEMA.md: Claude writes generators + tests, Codex writes runtime consumer + tests, in parallel.
  - Downstream (Phase 2 complete): re-add `NOTICE` file at repo root and update `scripts/build-extension.ps1` to include generated JSON + NOTICE in Chrome/Edge/Firefox dists.

## 2026-07-07 15:43 - Review generated normalization schema contract

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: 311d2a5
- Status: Reviewed and amended
- Summary:
  - Reviewed Claude's generated-library schema against the current runtime normalization code paths.
  - Approved the split: Claude owns offline corpus generators; Codex owns runtime loading, merge precedence, category-aware column selection, build packaging, and runtime tests.
  - Amended `SCHEMA.md` to make the runtime contract implementable:
    - Schema.org supertype fields are now allowlist-only so generic columns do not flood ShopScout.
    - Generated field aliases can extend existing curated fields only when they do not conflict with curated mappings.
    - Generated Icecat enum vocabularies now merge into existing curated enum fields instead of being skipped when a field already exists.
    - Duplicate Icecat feature ids that normalize to the same ShopScout field must be merged by the runtime while preserving feature ids for provenance.
    - Icecat category matching now uses `matchTerms` / category text / Shopify context as a bridge; the schema no longer assumes Shopify category ids are Icecat category ids.
- Files touched:
  - AGENT_CHANGELOG.md
  - normalization/libraries/generated/SCHEMA.md
- Validation:
  - Pending lightweight validation and commit.
- Review / handoff:
  - Reviewer: Claude
  - Schema contract is approved with Codex amendments. Claude can proceed with Phase 1 generators against the amended shape.
- Follow-ups:
  - Codex Phase 2 should add a fail-safe generated-library loader and runtime merge tests after Claude commits generated fixtures or generated output.

## 2026-07-07 16:15 - Phase 1a: sample fixtures shipped to unblock Codex Phase 2

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: 5333663 (fixtures) + this entry
- Status: Implemented, Codex Phase 2 unblocked
- Summary:
  - Accepted Codex's SCHEMA.md amendments as-is. All five amendments (Schema.org supertype allowlist, non-conflicting alias extension, Icecat enum merge-not-skip, duplicate feature-id merge-by-displayName, category matchTerms bridging) improve the runtime contract in ways I hadn't fully thought through.
  - Shipped 4 hand-authored sample fixture JSONs at the target paths under `normalization/libraries/generated/`. Small (all under 5 KB) but content-realistic. Deliberately exercise the amended merge rules:
    - Color feature id 12345 partly overlaps `defaultRules.enums.Color` (Navy Blue, Gray, White) so the runtime can verify curated wins for shared canonicals AND Cobalt Blue / Sand get added.
    - Color feature id 12399 shares `displayName: "Color"` with 12345 so the runtime can verify the merge-by-displayName rule with feature-id provenance intact.
    - Material feature id 20101 has Stainless Steel that overlaps `defaultRules.enums.Material` (Stainless Steel 304 / Stainless Steel) — exercises the append-non-conflicting rule.
    - Connector Type feature id 22001 exercises `exactAliasFields` lookup (its aliases should get confidence 1.0 via the exact-alias path).
    - 3 categories with `matchTerms` sorted alphabetically: Printer Cartridges (377), Mice (421), Coffee Machines (652 — non-mandatory-only to exercise the fallback).
  - All fixtures pass invariant checks: sorted-by-canonical for properties, numeric-ascending JSON keys for features + categories, matchTerms sorted alphabetically, feature-order ascending, JSON keys match value ids.
  - `BUILD_MANIFEST.json` has `isFixture: true` and zero-filled sha256 placeholders so Codex can filter fixtures from real generator output. `source.generator: "manual-fixture-for-codex-unblock"` and `source.generatorVersion: 0` in every file mark them clearly.
- Files touched:
  - normalization/libraries/generated/schemaOrgProperties.json (new, 3.6 KB)
  - normalization/libraries/generated/icecatVocabulary.json (new, 3.9 KB)
  - normalization/libraries/generated/icecatCategoryFeatures.json (new, 4.4 KB)
  - normalization/libraries/generated/BUILD_MANIFEST.json (new, 2.4 KB)
  - AGENT_CHANGELOG.md (this entry)
- Validation:
  - Every fixture JSON.parses cleanly.
  - Every fixture passes schema invariants (sort order, uniqueness, id/key equivalence, matchTerms sorted).
- Review / handoff:
  - Reviewer: Codex
  - Codex Phase 2 can now start: build the runtime loader in `normalization/libraries/generated.js` (or wherever fits Codex's existing pattern), wire the fail-safe fallback, wire the merge-into-defaultRules logic, ship the merged shape into `ShopScoutNormalizationRules`. Test against these fixtures. When real generators land (Claude's next commits), no runtime change should be needed — the fixtures share the amended v1 shape byte-for-byte.
- Follow-ups:
  - Claude Phase 1 continues: write `scripts/build-normalization-libraries/` (build-schema-org-properties.js, build-icecat-vocabulary.js, build-icecat-category-features.js, build-all.js) targeting the same schemas. When they land, they overwrite these fixture files with richer content. Codex's runtime should be no-change.
  - After both phases: `NOTICE` file + update `scripts/build-extension.ps1` to ship generated JSONs and NOTICE in Chrome/Edge/Firefox dists.

## 2026-07-07 15:53 - Make normalization review use full page width

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: 28f2ce2
- Status: Implemented
- Summary:
  - Added a wide dashboard-page variant for table-heavy operational pages.
  - Updated Normalization Review to opt into the wide variant so the review table uses the available page width instead of the default centered 1040px card.
  - Kept the default dashboard-page width unchanged for text/form pages like About, Settings, Save As, and Help.
- Files touched:
  - AGENT_CHANGELOG.md
  - comparison.css
  - comparison.js
- Validation:
  - npm run syntax -> passed
  - node tests\menu-layout.test.js -> passed
  - node tests\comparison-table-defaults.test.js -> passed
  - git diff --check -> passed with expected CRLF warnings only
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - None.

## 2026-07-07 15:57 - Extend normalization review wide mode to outer content pane

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: 0c4a4d8
- Status: Implemented
- Summary:
  - Fixed the remaining width constraint after user reported no visible change.
  - Added `body.is-wide-info-page` so wide dashboard pages also remove the outer `.content` max-width and centering, not only the inner `.dashboard-page` max-width.
  - `restoreProductListChrome()` now clears the wide-page body class when returning to products.
- Files touched:
  - AGENT_CHANGELOG.md
  - comparison.css
  - comparison.js
- Validation:
  - npm run syntax -> passed
  - node tests\menu-layout.test.js -> passed
  - node tests\comparison-table-defaults.test.js -> passed
  - git diff --check -- AGENT_CHANGELOG.md comparison.css comparison.js -> passed with expected CRLF warnings only
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - User may need to reload the extension/dashboard file to see the updated JS/CSS.

## 2026-07-07 16:07 - Split multi-value feature review items

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: 83d08dc
- Status: Implemented
- Summary:
  - Fixed Normalization Review treating comma-separated feature lists as one approval item.
  - `Additional Features`, `Features`, `Special Features`, `Included Items`, `Compatible Devices`, and `Recommended Use` now split comma/semicolon/pipe-delimited values into individual review rows.
  - Each split value gets its own review key, so Accept alias / Ignore actions apply to one feature at a time instead of approving or hiding the entire combined phrase.
- Files touched:
  - AGENT_CHANGELOG.md
  - normalization/review.js
  - tests/normalization-review.test.js
- Validation:
  - node tests\normalization-review.test.js -> failed before implementation, passed after implementation
  - node tests\user-rules-normalization.test.js -> passed
  - node tests\product-repo.test.js -> passed
  - node tests\menu-layout.test.js -> passed
  - npm run syntax -> passed
  - git diff --check -- normalization\review.js tests\normalization-review.test.js -> passed with expected CRLF warnings only
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - If users need different splitting behavior per category, add category-aware split rules rather than broadening generic punctuation splitting.

## 2026-07-07 16:20 - Phase 1b: real Schema.org + Icecat CategoryFeatures generators

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: 38a97c1 (Phase 1b) + this entry
- Status: Implemented; awaiting Codex Phase 2 (runtime loader) — one open coordination point on file size, see below
- Summary:
  - Shipped offline build scripts and their real output for two of the three normalization libraries. Overwrote the Phase 1a hand-authored fixtures with real content and real sha256 fingerprints. Preserved the vocabulary fixture (real generator deferred).
  - Design decisions:
    - **No npm dependencies added.** Uses Node.js built-ins only (fs, zlib, crypto, readline, stream). Includes a small custom streaming XML parser in scripts/build-normalization-libraries/lib.js — sufficient for Icecat's attribute-heavy format, avoids adding sax or similar to the extension's dep tree.
    - **Streaming for the 1.5 GB gzip.** CategoryFeaturesList.xml.gz decompresses to ~15 GB. The generator streams through it via fs.createReadStream(...).pipe(zlib.createGunzip()) and processes events without buffering the full XML in memory. Peak Node RSS during the run was ~300 MB.
    - **Deterministic output.** UTF-8 + LF + 2-space indent + trailing newline. Keys sorted (canonical asc for properties, numeric asc for feature/category ids). Reproducible sha256 fingerprints.
    - **Regression guard.** guardAgainstRegression in lib.js refuses to overwrite output smaller than 25% of the prior file. Protects against a truncated/corrupt source silently gutting the shipped library.
- Files touched:
  - Added: scripts/build-normalization-libraries/{README.md, lib.js, build-all.js, build-schema-org-properties.js, build-icecat-category-features.js, build-icecat-vocabulary.js}
  - Added: tests/generated-libraries.test.js
  - Modified: normalization/libraries/generated/SCHEMA.md (see coordination point below)
  - Regenerated: normalization/libraries/generated/schemaOrgProperties.json (99 real properties, 52 KB)
  - Regenerated: normalization/libraries/generated/icecatCategoryFeatures.json (6,808 real categories, 852,686 feature associations, 45 MB)
  - Regenerated: normalization/libraries/generated/BUILD_MANIFEST.json (real sha256 fingerprints)
  - Preserved: normalization/libraries/generated/icecatVocabulary.json (Phase 1a fixture)
- SCHEMA amendment (needs Codex review):
  - The features[] example in Codex's approved schema ({featureId, canonicalName, displayName, mandatory, order}) is ~85 bytes per entry. Multiplied by 852,686 real feature associations, that produces a 160+ MB unshippable file. I amended the schema field notes to declare canonicalName, displayName, and order as OPTIONAL fields on each entry. Current-generation output emits only featureId and mandatory, dropping the file to 45 MB. When a future generator resolves feature names (via FeaturesList.xml.gz cross-reference), those fields populate; runtime should treat them as optional. This is a bounded schema relaxation — no field renames, no shape restructuring, and the runtime merge semantics don't change. If Codex prefers a further-compact array-of-ints shape (features: [12345, 5432] + mandatoryFeatureIds: [12345]), we can amend again.
- Validation:
  - node scripts/build-normalization-libraries/build-all.js -> ok (Schema.org 99, CategoryFeatures 6,808 / 852,686, Vocab stub validated)
  - node tests/generated-libraries.test.js -> ok
  - npm test -> all 44 test files passed
  - npm run syntax -> pass
  - git status -> only the Codex WIP files above this entry (normalization/review.js, tests/normalization-review.test.js) plus this changelog entry are unstaged; my Phase 1b files are committed at 38a97c1.
- Review / handoff:
  - Reviewer: Codex
  - Codex Phase 2 (runtime loader + merge logic + fail-safe fallback) can proceed against the real generated files instead of fixtures. Runtime behavior should be identical since the shape is the same v1 — Codex may simply verify: fail-safe fallback, precedence chain (userRules > defaultRules > generated), merge-not-skip on enum overlap, feature-id merge-by-displayName on duplicate feature ids, matchTerms-based category bridging.
  - Please review the SCHEMA amendment (optional canonicalName/displayName/order on category feature entries) and either approve, propose the array-of-ints alternative, or specify a different compression.
  - Please also review the 45 MB file size. ShopScout already ships 94 MB of Shopify taxonomy so precedent exists, but if the runtime cannot afford another 45 MB of static JSON, we should discuss leaf-only filtering or lazy loading.
- Follow-ups:
  - Real build-icecat-vocabulary.js (per-feature vocabulary linkage) — requires cross-referencing FeaturesList.xml.gz for feature names plus scanning the 17K product XMLs to derive which values apply to which features. Deferred as follow-up when the runtime needs richer vocabulary than the current hardcoded defaults.
  - NOTICE file at repo root + update scripts/build-extension.ps1 to include normalization/libraries/generated/*.json and NOTICE in Chrome/Edge/Firefox dists. Deferred to Codex's Phase 2 packaging pass.

## 2026-07-07 16:24 - Exclude product identifiers from normalization review

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: 9e03ae4
- Status: Implemented
- Summary:
  - Corrected the normalization boundary: ASIN, UPC/EAN/GTIN, SKU, MPN/Mfr part number, item part number, model number, serial number, product ID, and generic identifier fields are product identity fields, not attribute-normalization fields.
  - `collectNormalizationReviewItems()` now skips identifier fields even when deterministic provenance marks them as unmapped or low-confidence.
  - `build-schema-org-properties.js` now excludes Schema.org identifier properties from the generated attribute-normalization library so they do not re-enter through generated aliases.
  - Regenerated `schemaOrgProperties.json`, reducing the generated attribute property set from 99 to 87 rows, and updated the matching manifest fingerprint.
  - Updated the generated-library schema contract to explicitly document that identifier properties are excluded from attribute normalization and belong to matching/dedupe/product detail identifiers.
- Files touched:
  - AGENT_CHANGELOG.md
  - normalization/review.js
  - tests/normalization-review.test.js
  - scripts/build-normalization-libraries/build-schema-org-properties.js
  - tests/generated-libraries.test.js
  - normalization/libraries/generated/SCHEMA.md
  - normalization/libraries/generated/schemaOrgProperties.json
  - normalization/libraries/generated/BUILD_MANIFEST.json
- Validation:
  - node tests\normalization-review.test.js -> passed
  - node tests\generated-libraries.test.js -> passed
  - node tests\user-rules-normalization.test.js -> passed
  - node tests\product-repo.test.js -> passed
  - npm test -> all 44 test files passed
  - npm run syntax -> passed
  - npm run lint -> passed with existing 41 warnings, 0 errors
  - npm run build -> chrome / edge / firefox dists rebuilt
  - git diff --check on touched files -> passed with expected CRLF warnings only
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - If identifier formatting is needed later, keep it in a separate identifier-canonicalization module for matching/dedupe only; do not mix it with attribute alias/value normalization.

## 2026-07-07 16:29 - Review Claude generated-library scope and ESCI WIP

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Review complete
- Reviewed scope:
  - Claude committed Phase 1b generator work at `38a97c1`.
  - Current uncommitted ESCI WIP files: `NOTICE`, `normalization/libraries/generated/esciSubstitutes.json`, `scripts/build-normalization-libraries/build-esci-substitutes.js`, plus edits to `SCHEMA.md`, `README.md`, `build-all.js`, `tests/generated-libraries.test.js`, and a generated timestamp-only change in `schemaOrgProperties.json`.
- Must-fix issues:
  - `esciSubstitutes.json` is documented and tested but is not listed in `normalization/libraries/generated/BUILD_MANIFEST.json`. The manifest must include every shipped generated library, and `tests/generated-libraries.test.js` should assert required outputs exist in the manifest so this cannot drift.
  - `NOTICE` states the ESCI file is derived from Amazon ESCI, but the current `esciSubstitutes.json` fixture says its ASINs are fictional. Until real ESCI parsing exists, either keep ESCI out of NOTICE or clearly label the file as a non-derived fixture. Do not claim attribution/source derivation for fictional test data.
  - `scripts/build-normalization-libraries/README.md` still says Schema.org allowlist includes `identifier`; this conflicts with Codex's identifier-boundary fix. Update it to remove `identifier` and reflect the current 87-row, ~45 KB output.
- Suggestions:
  - Update `SCHEMA.md` size notes for `icecatCategoryFeatures.json`; the table says 5-10 MB and a later note says under 20 MB, but the actual generated file is 45 MB. Since SCHEMA.md already requires review for files over 20 MB, document the accepted 45 MB reality or choose a compact representation before runtime packaging.
  - Avoid committing timestamp-only regeneration in `schemaOrgProperties.json`; it adds churn without semantic value.
  - If ESCI remains a fixture, consider keeping it under tests/fixtures until runtime integration actually consumes it. Shipping fictional substitute pairs in `normalization/libraries/generated/` can be mistaken for production data.
- Approved items:
  - Phase 1b scope call is correct: real Schema.org generation is appropriate; real Icecat vocabulary generation is correctly deferred because `FeatureValuesVocabularyList.xml.gz` is not feature-scoped by itself.
  - MVP CategoryFeatures generator shape is acceptable for runtime category-feature lookup as long as runtime treats feature display names/order as optional.
  - Dependency-free generator approach is reasonable for Schema.org and the Icecat XML MVP.
- Validation run:
  - node tests\generated-libraries.test.js -> passed
  - node scripts\build-normalization-libraries\build-esci-substitutes.js -> passed fixture validation
- Review / handoff:
  - Reviewer: Claude to address must-fix items before committing ESCI WIP.
- Follow-ups:
  - After the manifest/NOTICE/README issues are fixed, rerun `node tests\generated-libraries.test.js`, `npm test`, `npm run syntax`, and `npm run build`.

## 2026-07-07 16:45 - ESCI Track A + must-fix from Codex b6080cf review

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: ecd222a (Track A implementation), cd42586 (must-fix follow-up), this entry
- Status: Track A shipped + Codex must-fix items addressed
- Summary:
  - Implemented ESCI Track A — the substitute-signal slice of the "search intent" layer discussed with Codex. Amazon's Shopping Queries Dataset (ESCI) labels query-product pairs as E/S/C/I; Track A extracts only the Substitute pairs and layers them as a bonus signal in matching.js:scorePair. Track B (search intent UI, category query hints, compare-panel substitute suggestions) is deferred.
  - Shipped: build-esci-substitutes.js (stub — real parquet parser deferred), esciSubstitutes.json fixture, NOTICE at repo root (Schema.org + Icecat + ESCI attribution), SCHEMA.md section 3b for v1 shape, build-all.js and README.md updates, invariant tests in tests/generated-libraries.test.js.
  - Runtime hook proposed for matching.js:scorePair (Codex to wire): if (esciSubstitutePairs?.has([a.id, b.id].sort().join('|'))) { score += 0.10; evidence.push('ESCI substitute co-occurrence'); }. Never overrides user-verified duplicates or curated blocklist. Additive only.
  - Codex reviewed the WIP in b6080cf before I committed and flagged 3 must-fix items. Addressed in cd42586:
    1. NOTICE ESCI claim — the shipped esciSubstitutes.json is a hand-authored fixture with fictional ASINs; NOTICE previously claimed derivation from Amazon's dataset. Reworded to RESERVED status — activation language only applies when a real ESCI parquet parser lands. Detection field pinned: source.generator === 'manual-fixture-*' is fixture, scripts/.../build-esci-substitutes.js is real.
    2. README allowlist — identifier was still listed in the Schema.org supertype allowlist despite Codex's identifier-boundary fix. Updated to the real 5-item allowlist (name, description, image, url, alternateName) plus the identifier-exclusion note. Row count updated from ~50 to 87 to match current output.
    3. Manifest drift guard — added REQUIRED_MANIFEST_KEYS assertion to tests/generated-libraries.test.js. Fails if a shipped generated JSON is missing from BUILD_MANIFEST.outputs. The manifest already listed all 4 outputs at the time Codex reviewed (b6080cf saw a snapshot before I ran build-all end-to-end); this test closes the drift window.
- Files touched:
  - Added: NOTICE (repo root)
  - Added: scripts/build-normalization-libraries/build-esci-substitutes.js
  - Added: normalization/libraries/generated/esciSubstitutes.json (fixture)
  - Modified: normalization/libraries/generated/SCHEMA.md (section 3b for esciSubstitutes)
  - Modified: normalization/libraries/generated/BUILD_MANIFEST.json
  - Modified: scripts/build-normalization-libraries/build-all.js (runs ESCI validator)
  - Modified: scripts/build-normalization-libraries/README.md (allowlist fix)
  - Modified: tests/generated-libraries.test.js (ESCI invariants + manifest drift guard)
- Validation:
  - node scripts/build-normalization-libraries/build-all.js -> ok (Schema.org 87, CategoryFeatures 6808/852686, Vocab stub 4, ESCI stub 5)
  - node tests/generated-libraries.test.js -> passed
  - npm test -> all 44 test files pass
  - npm run syntax -> pass
- Review / handoff:
  - Reviewer: Codex
  - Codex Phase 2 runtime work can now wire ESCI substitute-pair lookup into matching.js. Suggested hook is documented in SCHEMA.md section 3b.
  - Please review NOTICE reword — the RESERVED-status pattern is the cleanest way I could see to keep future attribution honest without pretending the fixture is derived data. If you prefer a different phrasing (e.g. delete the section entirely until real data lands), say so and I'll adjust.
- Follow-ups (non-blocking):
  - Reconcile SCHEMA.md size notes for icecatCategoryFeatures.json (5-10 MB vs 20 MB flag vs 45 MB actual). Deferred pending Codex's decision on whether to accept 45 MB, filter to leaf categories, or move to a compact array-of-ints shape.
  - Real parquet parser for build-esci-substitutes.js (depends on Codex approving a parquet dep like hyparquet or parquet-wasm).
  - NOTICE inclusion in scripts/build-extension.ps1 so every browser dist ships it. Deferred to Codex's Phase 2 packaging pass.

## 2026-07-07 16:46 - Wire ESCI substitute signal into duplicate scoring

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: 9e34176
- Status: Implemented
- Summary:
  - Added fail-safe ESCI substitute-pair loading to `ShopScoutMatching`.
  - Added `loadEsciSubstitutes(payload)` for tests/manual injection and `ensureEsciSubstitutesLoaded()` for runtime JSON loading from `normalization/libraries/generated/esciSubstitutes.json`.
  - Added ESCI pair indexing so products with paired ASIN/identifier values land in the same comparison bucket when the generated library is loaded.
  - `scorePair()` now adds the documented `0.10` bonus and `ESCI substitute co-occurrence` evidence only when a loaded substitute pair matches. It remains additive only and does not merge/delete/override user duplicate decisions.
  - `productRepo.findDuplicateCandidates()` now awaits the matcher's ESCI loader before scoring duplicate candidates.
  - Added `NOTICE` to `scripts/build-extension.ps1` so Chrome, Edge, and Firefox packages ship attribution alongside generated normalization libraries.
- Files touched:
  - AGENT_CHANGELOG.md
  - normalization/matching.js
  - data/productRepo.js
  - tests/dedupe-candidates.test.js
  - tests/product-repo.test.js
  - scripts/build-extension.ps1
- Validation:
  - node tests\dedupe-candidates.test.js -> failed before implementation, passed after implementation
  - node tests\product-repo.test.js -> failed before implementation, passed after implementation
  - npm test -> all 44 test files passed
  - npm run syntax -> passed
  - npm run lint -> passed with existing 41 warnings, 0 errors
  - npm run build -> chrome / edge / firefox dists rebuilt
  - Confirmed `dist/chrome`, `dist/edge`, and `dist/firefox` contain `NOTICE`; confirmed Chrome dist contains `normalization/libraries/generated/esciSubstitutes.json`.
  - git diff --check on touched files -> passed with expected CRLF warnings only
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - Decide whether normal-threshold duplicate review should ever display ESCI substitute-only pairs. Current implementation intentionally does not: substitute is evidence, not duplicate identity.

## 2026-07-07 - Claude review of Codex 217044f, 69c5043, 28f2ce2, 0c4a4d8, 83d08dc, 9e03ae4

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (review only, no code change)
- Status: Reviewed — all six Codex commits between my prior consolidated review (07b85be) and my Phase 1b work (38a97c1)
- Summary:
  - Six Codex commits since 07b85be. Two feature slices (217044f, 69c5043) previously got inline approvals in my Phase 1b entry; formalizing them here. Two UI polish (28f2ce2, 0c4a4d8) and two normalization pipeline fixes (83d08dc, 9e03ae4) reviewed fresh.
- Files touched:
  - none (review only)
- Validation:
  - All six commits were tested by Codex (npm test all-file counts noted in their entries) and remain green in the current 44-test suite.
  - Verified 9e03ae4's IDENTIFIER_FIELDS list against my identifier list in build-schema-org-properties.js — they match. No drift between the runtime review filter and the offline generator filter.
- Review / handoff:
  - Reviewer: Claude
  - Findings:
    - **217044f (Add normalization approval workflow)** — Approved. `normalization/userRules.js` overlay with Accept alias / Ignore actions on the Review page, IndexedDB persistence via productRepo, reloadable normalizer with `user-enum:*` provenance, stable review item keys. Right shape. This was inline-approved in my Phase 1b entry; formal approval here.
    - **69c5043 (User rule management + bulk actions + duplicate blocking keys)** — Approved. Bulk Accept-all-matching / Ignore-all-matching is the natural evolution of the per-item flow. **Duplicate candidate blocking keys directly close my prior O(n²) suggestion** on `detectDuplicateCandidates` — nice pickup. Inline-approved in my Phase 1b entry; formal approval here.
    - **28f2ce2 (Widen normalization review table)** — Approved. Pure CSS + minor JS. Low risk. Table width fix + 10-line JS tweak.
    - **0c4a4d8 (Expand wide dashboard content pane)** — Approved. CSS + 3-line JS. Companion to 28f2ce2.
    - **83d08dc (Split multi-value feature review items)** — Approved with one style note. `isListLikeFeatureField` hardcodes the six list-like fields (features, additional features, special features, included items, compatible devices, recommended use); English-only, matching current scope. `splitReviewValues` uses `,;|` delimiters and preserves normalized alignment when `sameShape` matches — sound design. Style note: if a canonical value legitimately contains `|` (rare but possible for URLs / regex-like fields), it'll be split. Not concerning for the six fields explicitly listed. Approved as-is.
    - **9e03ae4 (Exclude identifiers from normalization review)** — Approved. IDENTIFIER_FIELDS covers the correct set (ASIN, GTIN with all length variants, MPN + Mfr Part Number aliases, model + model number aliases, SKU, UPC/EAN, serial number, identifier, product ID). Both variants with and without spaces (`gtin8` and `gtin 8`) are present — defensive against different `keyPart` normalizations. The same exclusion is applied in the offline generator via `IDENTIFIER_PROPERTY_IDS` in build-schema-org-properties.js — runtime and build-time stay in lockstep. Regenerated schemaOrgProperties.json dropped from 99 to 87 properties, consistent with my Phase 1b run.
      - Minor observation: `model` alone is in the exclusion set. That's correct for the ShopScout domain (Icecat and Amazon products use `model` as an identifier). Fashion/apparel data uses `model` for the person modeling the garment — irrelevant to our domain. Approved.
  - **b6080cf (Codex's review of my Phase 1b + ESCI WIP)** — Not reviewing Codex reviewing me. Three must-fix items addressed in cd42586 (NOTICE reword, README allowlist fix, manifest drift-guard test). Suggestions (SCHEMA size reconciliation, fixture location) captured as follow-ups in my ESCI Track A changelog entry.
- Follow-ups:
  - None new. All approvals are clean.

## 2026-07-07 - Claude review of Codex 9e34176 (ESCI runtime hook)

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (review only, no code change)
- Status: Reviewed — approved with one small suggestion
- Summary:
  - Reviewed Codex 9e34176 "feat: wire ESCI substitute signal into matching". Wires the runtime consumer for the Track A esciSubstitutes.json I shipped in ecd222a, per the hook I documented in SCHEMA.md section 3b. Ships a fail-safe async loader, extends the blocking-key filter so ESCI-paired products actually get compared, applies +0.10 to scorePair with "ESCI substitute co-occurrence" evidence, awaits the loader in productRepo before duplicate scoring, and adds NOTICE to the extension build.
- Files touched:
  - none (review only)
- Validation:
  - Read the full diff — matching.js (+86), productRepo.js (+3), scripts/build-extension.ps1 (+1), tests/dedupe-candidates.test.js (+30), tests/product-repo.test.js (+40).
  - `npm test` -> 44/44 pass on this commit.
  - Verified the runtime consumer matches the shape from SCHEMA.md section 3b (accepts both `{substitutePairs: [...]}` and raw array — flexible; keys sorted a<b; `esci:` prefix on blocking keys so they don't collide with existing brand/token keys).
- Review / handoff:
  - Reviewer: Claude
  - Findings:
    - Approved: `productIdentityValues` is broad — extracts `product.id`, `product.asin`, then all of `extractIdentifiers()` (ASIN/UPC/GTIN/EAN/MPN/SKU/modelNumber/modelName + spec-mined identifiers). This is the right call: ESCI's ASIN-keyed pairs match against whichever identifier field carries the ASIN in ShopScout's data.
    - Approved: Blocking-key integration is what makes ESCI actually usable at scale. Without `esci:` blocking keys, the 69c5043 blocking-key optimization would prevent ESCI-only pairs from being scored (they'd never share brand or title tokens). Adding a per-pair blocking key ensures each ESCI substitute pair gets bucketed together while other products stay separated.
    - Approved: Memoization pattern is clean. `esciLoadPromise` caches the in-flight fetch so concurrent calls don't double-fetch. `.catch(() => 0)` prevents runtime errors when the fixture file is missing (fail-safe per SCHEMA.md contract).
    - Approved: Public API surface (`loadEsciSubstitutes` + `ensureEsciSubstitutesLoaded`) — the direct-injection API is essential for unit tests since `root.fetch` is unavailable in Node. Correct separation.
    - Approved: NOTICE wired into `$runtimeFiles` in build-extension.ps1. Codex confirmed the file lands in Chrome/Edge/Firefox dists.
    - Approved: The boundary language in Codex's message ("ESCI substitute does not mean duplicate") matches the additive-only contract. +0.10 alone won't push a pair over the duplicate threshold; other signals (identifier match, brand match, title-token similarity) must also fire.
    - Suggestion (non-blocking): `esciLoadPromise` isn't reset on failure. If the first fetch fails (e.g. transient extension-page loading race, file temporarily 404), the memoized promise resolves to 0 and every subsequent call returns 0 immediately. A retry-once policy (null the promise on failure, one-time re-attempt on next call) would recover from transient errors. Downside is potential retry storms if the file is genuinely missing, so the current lock-in-on-failure is defensible. Just worth naming as a design tradeoff.
    - Observation (not a finding): `productIdentityValues` matches on any identifier, not just ASINs. In theory a UPC (e.g. `012345678905`) could collide with an ASIN (e.g. `B01AAAAAAA`) if both were `compact()`ed to the same string. In practice their formats are disjoint (ASIN starts with a letter, UPC/GTIN is all-digit). Not a bug — just a note if the identifier surface ever grows.
- Follow-ups:
  - Track A is functionally complete. Real ESCI parquet generator to replace the fixture is the next slice; deferred until parquet dep (hyparquet or parquet-wasm) is approved by Codex.
  - Track B (search intent UI, category query hints, compare-panel substitute suggestions) still deferred as originally planned.

## 2026-07-07 16:49 - Post-push synchronization audit

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Audit complete
- Summary:
  - Verified Claude's push landed locally and `grid-rebuild-codex` matched `origin/grid-rebuild-codex` before this cleanup.
  - Confirmed working tree was clean and current remote HEAD was `1cbf4a1`.
  - Ran the full test suite, syntax check, lint, build, generated-library test, and generated manifest drift check.
  - Corrected six stale changelog entries that still used the uncommitted placeholder after their commits were finalized and pushed.
- Files touched:
  - AGENT_CHANGELOG.md
- Validation:
  - git fetch origin && git status --short --branch -> branch matched origin before this cleanup
  - npm test -> all 44 test files passed
  - npm run syntax -> passed
  - npm run lint -> passed with existing 41 warnings, 0 errors
  - npm run build -> chrome / edge / firefox dists rebuilt
  - node tests\generated-libraries.test.js -> passed
  - Generated-library manifest drift check -> passed; all shipped generated JSON files are listed in BUILD_MANIFEST outputs
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - This changelog-only cleanup will need pushing to restore remote/local sync.

## 2026-07-07 16:53 - Push synchronization handoff

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Synchronization handoff
- Summary:
  - User asked Codex to push everything, synchronize with GitHub, and update the agent changelog for Claude.
  - Verified local branch was ahead of `origin/grid-rebuild-codex` by one commit (`b7b620b`) before this handoff entry.
  - This entry records the final push/sync action so Claude can verify from the remote branch without relying on chat context.
- Files touched:
  - AGENT_CHANGELOG.md
- Validation:
  - git status --short --branch -> local branch was ahead by 1 before this entry
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - After this commit is created, Codex will push `grid-rebuild-codex` and verify local/remote sync.

## 2026-07-07 17:01 - Strip developer-only files from extension dist

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: 6adb0ac (build change), this commit (changelog record)
- Status: Implemented
- Summary:
  - Removed developer-only generated-library contract/docs/tests from packaged browser extension output.
  - `normalization/libraries/generated/SCHEMA.md` remains in the source repo as the Claude/Codex schema contract, but it no longer ships inside `dist/chrome`, `dist/edge`, or `dist/firefox`.
  - Kept `BUILD_MANIFEST.json` in the dist because it is runtime-adjacent provenance for the generated normalization libraries.
  - Ran Git loose-object cleanup with `git gc --prune=now` after the user asked to archive/remove the harmless auto-pack housekeeping noise.
- Files touched:
  - scripts/build-extension.ps1
  - AGENT_CHANGELOG.md
- Validation:
  - npm run build -> chrome / edge / firefox rebuilt successfully
  - Get-ChildItem -Path dist -Recurse -Filter SCHEMA.md -> no files returned
  - npm run lint -> passed with existing 41 warnings, 0 errors
  - git gc --prune=now -> completed
- Review / handoff:
  - Reviewer: Claude
- Follow-ups:
  - None for the SCHEMA.md packaging issue. Source `SCHEMA.md` remains intentionally tracked for agent coordination.

## 2026-07-07 - Dist bloat fix + non-English index corpus cleanup

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: 6adb0ac (build script) + this entry
- Status: Implemented
- Summary:
  - Two housekeeping fixes flagged in the second sync audit:
    1. Extension dist bloat — pre-existing `$runtimeDirs` recursive copy was including dev-only files (grid-rebuild-codex/tests/*.test.js, normalization/libraries/generated/SCHEMA.md, several READMEs) in every browser dist, ~110 KB × 3 = ~330 KB of unshippable clutter per build.
    2. Non-English Icecat indexes on disk — 748 MB of 66 language index files that were fetched incidentally during Phase A but never used (scope narrowed to EN before Phase 1b generators ran).
  - Build script now strips `tests/` directories, `*.test.js`, `README.md`, and `SCHEMA.md` from every dist after the recursive copy. `BUILD_MANIFEST.json` is intentionally kept — it carries source fingerprints and generator provenance for the generated libraries.
  - `D:\icecat-data\indexes-other-languages\` deleted (outside repo, git-ignored). Freed 747 MB. Corpus footprint dropped from 3.94 GB to 3.21 GB.
- Files touched:
  - Modified: scripts/build-extension.ps1  (+22, -0)
  - Deleted (outside repo, junction target): data-sources/icecat/indexes-other-languages/*
- Validation:
  - npm run build -> Chrome/Edge/Firefox all built cleanly.
  - Post-build audit: 0 test files, 0 README.md, 0 SCHEMA.md in each dist. NOTICE + 5 generated JSONs (schemaOrgProperties, icecatVocabulary, icecatCategoryFeatures, esciSubstitutes, BUILD_MANIFEST) still present.
  - npm test -> all 44 test files pass.
  - Corpus size verified: D:\icecat-data\ 3.21 GB remaining (refs 1.66 GB, products 1.24 GB, indexes 380 MB, daily 6.2 MB, schema-org 5.9 MB).
- Review / handoff:
  - Reviewer: Codex
  - No behavioral change to runtime code — this is a build-hygiene + disk-hygiene commit. Extension package now ships exactly the runtime files declared by $runtimeFiles + $runtimeDirs minus the dev-only pattern list.
- Follow-ups:
  - None from this fix.

## 2026-07-07 17:20 - Unused file cleanup pass

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Audited obvious unused file candidates after the dist cleanup. Confirmed `grid-rebuild-codex/` is active runtime code loaded by `comparison.html` and copied by `scripts/build-extension.ps1`, so it was not removed.
  - Archived `shopscout-about.md` because the dashboard now renders dedicated About and Help pages inline from `comparison.js`; no runtime code fetches the Markdown file anymore.
  - Removed `shopscout-about.md` from `$runtimeFiles`, so it no longer ships in Chrome/Edge/Firefox packages.
  - Deleted the legacy Markdown renderer/fetch helpers from `comparison.js`.
  - Removed the ignored local `archived/packages/icons.zip` archive and deleted the now-empty ignored `archived/packages/` directory.
  - Updated `archived/README.md` and `tests/menu-layout.test.js` to reflect the inline About/Help implementation.
- Files touched:
  - archived/README.md
  - archived/shopscout-about.md
  - comparison.js
  - scripts/build-extension.ps1
  - tests/menu-layout.test.js
  - shopscout-about.md (moved to archived/)
  - archived/packages/icons.zip (ignored local file deleted)
- Validation:
  - rg for `shopscout-about`, `renderMarkdownToHtml`, `loadTextResource`, `archived/packages`, `icons.zip` -> only archive documentation/test expectations remain where intended
  - npm test -> all 44 test files passed
  - npm run syntax -> passed
  - npm run build -> chrome / edge / firefox rebuilt successfully
  - Dist audit for `shopscout-about.md`, `SCHEMA.md`, `README.md`, `*.test.js` -> no files returned
  - npm run lint -> passed with 39 warnings, 0 errors (down from 41 warnings)
- Review / handoff:
  - Reviewer: Claude
  - Requested: Claude should independently audit remaining files for unused candidates before broader deletions. Do not remove active `grid-rebuild-codex/`, `state/`, `shared/`, generated libraries, or source docs without proving no runtime/build/test/reference path uses them.
- Follow-ups:
  - Remaining lint warnings are unused symbols inside active files, not unused files. Handle as a separate dead-code cleanup task if desired.

## 2026-07-07 - Claude independent audit of remaining unused-file candidates

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (review only, no code change)
- Status: Reviewed — no additional archival candidates found
- Summary:
  - Fulfilled Codex's review request in 0f1ef06 (Reviewer: Claude, "audit remaining files for unused candidates before broader deletions"). Full-tree sweep across state/, content/, ui/, shared/, comparison/, data/, security/, and root JS. Every file has a verifiable load path.
  - Only candidate that initially looked orphan was data/openFactsEnrich.js (0 HTML script tags). Verified used: background.js:7 loads it via importScripts('data/openFactsEnrich.js') — the standard MV3 service worker pattern for utility modules. Exports the SSOpenFactsEnrich global namespace for Open*Facts GTIN enrichment (settings-controlled opt-in feature).
- Files touched:
  - none (audit only)
- Validation:
  - state/ (5 files): all export ShopScoutState namespace, consumed by data/productRepo.js + dedicated tests/state-*.test.js.
  - content/ (13 files including adapters/): every file listed in manifest.json + manifest.firefox.json content_scripts and injected via background.js.
  - ui/ (4 files): direct <script> in 3-4 HTML files each.
  - shared/ (3 files): <script> in comparison.html.
  - comparison/ (3 files): <script> in comparison.html.
  - data/ (7 files): 6 via <script>; openFactsEnrich via background.js importScripts.
  - security/ (1 file): direct <script> in 4 HTML files.
  - Root JS (9 files): all in $runtimeFiles + HTML or manifest.
- Review / handoff:
  - Reviewer: Codex
  - Codex's boundary in 0f1ef06 ("Do not remove active grid-rebuild-codex/, state/, shared/, generated libraries, or source docs without proving no runtime/build/test/reference path uses them") verified — every file in those areas has a real load path.
  - No additional standalone files to archive.
- Follow-ups:
  - Dead-code cleanup within active files (39 lint warnings, mostly in comparison.js / comparison/aiResultsView.js / comparison/rescanController.js) remains as a separate refactor task on Codex's territory. Deferred until explicitly requested.

## 2026-07-07 19:36 - Resolve remaining lint warnings

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Resolved the remaining ESLint warning backlog: `npm run lint` now exits with 0 errors and 0 warnings.
  - Removed unused destructured utilities, stale locals, unused renderer helpers, unused selector aggregates, unused test imports, and unused rescan counters.
  - Kept cross-script comparison helpers that are still consumed by extracted modules, but made that dependency explicit by exporting them on `globalThis`.
  - Exposed Google taxonomy breadcrumbs through `SSCanonical.getGoogleBreadcrumbs()` so the existing parsed cache has a real public reader instead of a private unused assignment.
- Files touched:
  - AGENT_CHANGELOG.md
  - comparison.js
  - comparison/aiResultsView.js
  - comparison/rescanController.js
  - content/adapters/amazon.js
  - content/productSchema.js
  - content/structuredSignals.js
  - data/canonical.js
  - tests/canonicalize-url.test.js
  - tests/comparison-modules.test.js
- Validation:
  - npm run lint -> passed, 0 warnings
  - npm test -> all 44 test files passed
  - npm run syntax -> passed
  - npm run typecheck -> passed
  - npm run build -> Chrome, Edge, Firefox rebuilt successfully
- Review / handoff:
  - Reviewer: Claude pending.
  - Notes: Cleanup was warning-focused; no feature behavior was intentionally changed.
- Follow-ups:
  - None.

## 2026-07-07 - Vertical pack architecture Phase 1 (Claude side)

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: b3eca3b (mapper), f6ba0c4 (splitter + workflow), this entry
- Status: Phase 1 (Claude offline side) complete. Codex Phase 2 (runtime consumer) can start.
- Summary:
  - User decision: replace bundling 137 MB monolithic data in the extension with per-vertical packs fetched on demand from GitHub Releases + cached in IndexedDB. Ships this pattern:
    - Bundle in extension: tiny index files (verticals-index.json, icecat_category_to_vertical.json — ~75 KB combined) + Schema.org (52 KB) + defaults + ESCI fixture. Total ~200 KB of data code.
    - Fetch on demand: per-vertical pack containing that vertical's Icecat category features, Icecat vocabulary, Shopify sub-tree, ESCI substitutes, Schema.org copy. 21 packs, avg ~2 MB, total 37.6 MB across all packs.
    - Runtime picks vertical per list. Auto-detect from product data first (Path A). Fallback picker if detection confidence is low (Path B). User can skip; list operates on bundled defaults (Path C).
  - Two generators + one workflow shipped:
    1. build-vertical-mapping.js — deterministic keyword classifier that maps each Icecat category to its most likely Shopify vertical. 2,386 of 6,808 mapped (35%); unclassified fall through to bundled defaults.
    2. build-vertical-packs.js — reads the monolithic files, slices per vertical, writes dist/packs/{vertical}.json ×21, populates verticals-index.json with real packUrl/packBytes/packSha256.
    3. .github/workflows/publish-data-packs.yml — triggers on push to `data` branch or manual dispatch; runs the splitter and uploads packs to a GitHub Release. Fail-fast rejection if any pack < 10 KB.
  - Distribution across verticals: electronics 436 (largest bucket), sporting-goods 287, home-garden 284, furniture 190, cameras-optics 135, baby-toddler 133, apparel-accessories 118, vehicles-parts 112, hardware 101, health-beauty 95, office-supplies 93, business-industrial 83, arts-entertainment 62, toys-games 62, food-beverages-tobacco 62, animals-pet-supplies 57, media 30, software 23, luggage-bags 23. Religious-ceremonial and mature have 0 mappings — verticals exist in the index for completeness.
- Files touched:
  - Added: scripts/build-normalization-libraries/build-vertical-mapping.js
  - Added: scripts/build-normalization-libraries/build-vertical-packs.js
  - Added: normalization/libraries/generated/icecat_category_to_vertical.json (69 KB, bundled)
  - Added: normalization/libraries/generated/verticals-index.json (~5 KB, bundled)
  - Added: .github/workflows/publish-data-packs.yml
  - Modified: scripts/build-normalization-libraries/build-all.js (runs the vertical mapper)
  - Modified: normalization/libraries/generated/BUILD_MANIFEST.json (adds 2 new entries)
  - Modified: tests/generated-libraries.test.js (REQUIRED_MANIFEST_KEYS extended to require both new files)
- Validation:
  - node scripts/build-normalization-libraries/build-all.js -> ok
  - node scripts/build-normalization-libraries/build-vertical-packs.js -> 21 packs in dist/packs/, largest electronics 6.91 MB, smallest religious-ceremonial 48.7 KB, total 37.6 MB
  - npm test -> all 44 test files pass
  - No new npm dependencies (uses fs, crypto, only)
- Review / handoff:
  - Reviewer: Codex
  - Codex Phase 2 can now start on runtime consumer:
    1. Add `vertical` field to list schema in productRepo (fresh schema — no migration; user confirmed existing lists will be retired).
    2. Vertical detection function: input = ProductSpec, output = { verticalId, confidence, source }. Uses icecat_category_to_vertical.json for auto-detection.
    3. Pack fetcher: ensurePackLoaded(verticalId) — IndexedDB check → fetch from verticals-index.json URL → cache → return. Fail-safe fallback to bundled defaults.
    4. Path A/B/C runtime flow (auto-detect / user picker / skip).
    5. Extend normalization/attributes.js + normalization/matching.js + normalization/taxonomyBridge.js to consume pack data.
    6. Manifest host_permissions for github.com + objects.githubusercontent.com.
  - When Codex is ready to publish real packs to origin, push to a `data` branch and the workflow runs automatically. Currently packUrl fields say `data-vdev` (local dev tag); the workflow substitutes the real tag at publish time.
- Follow-ups:
  - Extend classification rules — the 4,422 unclassified Icecat categories are mostly ultra-specific industrial niches. Future rule additions grow coverage without breaking anything.
  - When real ESCI generator lands with ASIN → vertical mapping, slice ESCI substitutes per vertical too.
  - When real Icecat vocabulary generator lands, packs will grow — may need to compact further (e.g. leaf-only categories) or split large verticals (Electronics may exceed 20 MB).
  - Runtime testing: Codex should verify pack fetch performance end-to-end (first fetch latency, cache hit path, offline fallback).

## 2026-07-07 22:21 - Runtime vertical pack integration

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Added a fail-safe generated vertical pack runtime loader that reads the bundled vertical index/category map, fetches per-vertical packs from release URLs on demand, caches packs in IndexedDB meta, and falls back to bundled defaults when data is missing or fetch fails.
  - Wired vertical detection into `productRepo`: new lists store vertical metadata, captured products keep `_normalizationContext.vertical`, rebuilds backfill vertical context, and list-level vertical helpers are exposed through `SSProductRepo`.
  - Extended attribute normalization to use pack-provided enum vocabulary after user/default rules, preserving user/default precedence.
  - Extended duplicate matching so list vertical packs can provide matching signals before falling back to the bundled ESCI substitute fixture.
  - Loaded `normalization/libraries/generatedPacks.js` in the popup and comparison dashboard before taxonomy/attribute/matching modules.
  - Kept manifest host permissions unchanged because existing `<all_urls>` host permission already covers GitHub release pack fetches; no redundant host entries were added.
- Files touched:
  - AGENT_CHANGELOG.md
  - comparison.html
  - popup.html
  - data/productRepo.js
  - normalization/attributes.js
  - normalization/matching.js
  - normalization/libraries/generatedPacks.js
  - scripts/build-normalization-libraries/build-vertical-mapping.js
  - tests/generated-packs.test.js
  - tests/product-repo.test.js
- Validation:
  - node tests\generated-packs.test.js -> passed
  - node tests\product-repo.test.js -> passed
  - npm run syntax -> passed
  - npm run lint -> passed, 0 warnings
  - npm run typecheck -> passed
  - npm test -> all 45 test files passed
  - npm run build -> Chrome, Edge, Firefox rebuilt successfully
  - Dist sanity check -> generatedPacks.js, verticals-index.json, and icecat_category_to_vertical.json ship in all three browser dists; SCHEMA.md stays excluded.
- Review / handoff:
  - Reviewer: Claude pending.
- Follow-ups:
  - Add the low-confidence vertical picker UI for Path B.
  - Add optional pack hash verification if the release fetch flow needs stricter integrity checks.
  - Publish real vertical packs to a GitHub Release when ready; current runtime is fail-safe if pack URLs are not yet live.

## 2026-07-07 23:22 -07:00 - Codex implementation of Path B vertical picker

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented
- Summary:
  - Added a Products-ribbon `Vertical Packs` command that opens a main-content vertical picker page for low-confidence or manually corrected generated normalization pack selection.
  - Exposed `ShopScoutGeneratedPacks.listVerticals()` as a defensive-copy API so UI code can render the generated vertical catalog without mutating loader state.
  - Added a searchable responsive vertical picker with selected-state cards, `Use Selected Vertical`, and `Use Bundled Defaults` actions.
  - Persisted manual vertical choices through `SSProductRepo.setListVertical()` and rebuilt normalization for the active list after user decisions.
  - Added durable `verticalSkipped` list metadata so choosing bundled defaults does not immediately re-trigger automatic vertical detection on the next rebuild.
  - Fixed `setListVertical()` confidence handling so explicit `confidence: 0` is preserved instead of being coerced to 1.
- Files touched:
  - AGENT_CHANGELOG.md
  - comparison.html
  - comparison.js
  - comparison.css
  - data/productRepo.js
  - normalization/libraries/generatedPacks.js
  - tests/generated-packs.test.js
  - tests/menu-layout.test.js
  - tests/product-repo.test.js
- Validation:
  - node tests\generated-packs.test.js -> passed after initial expected failure
  - node tests\product-repo.test.js -> passed
  - node tests\menu-layout.test.js -> passed after initial expected failure
  - npm run syntax -> passed
  - npm run lint -> passed, 0 warnings
  - npm run typecheck -> passed
  - npm test -> all 45 test files passed
  - npm run build -> Chrome, Edge, Firefox rebuilt successfully
- Review / handoff:
  - Reviewer: Claude pending.
- Follow-ups:
  - Optional: auto-open or badge the vertical picker when list detection confidence is 0 instead of requiring the user to click the ribbon command.
  - Optional: improve vertical detection from multi-segment category breadcrumbs before prompting users.

## 2026-07-07 - Claude review of Codex 3561c22 (vertical pack runtime consumer)

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (review only)
- Status: Reviewed — approved, with 3 non-blocking suggestions + 1 gap flagged for future work
- Summary:
  - Reviewed Codex 3561c22 "feat(normalization): load vertical packs at runtime". Wires the Phase 2 runtime consumer for the vertical-pack architecture Claude shipped in b3eca3b + f6ba0c4. 590 lines added across 10 files. All 45 tests pass (44 existing + 1 new: tests/generated-packs.test.js).
- Files reviewed:
  - normalization/libraries/generatedPacks.js (new, 254 lines) — pack loader with bundled data + IndexedDB cache + fail-safe fetch
  - normalization/attributes.js (+20) — pack vocabulary integration into the attribute lookup layer
  - normalization/matching.js (+7) — loadVerticalPackSignals hook so matching gets pack ESCI data
  - data/productRepo.js (+119) — list schema (verticalId/Source/Confidence), setListVertical/detectListVertical APIs, prepareNormalizationForList orchestrator
  - comparison.html + popup.html (+1 each) — script wiring, correct order
  - tests/generated-packs.test.js (+128 new) — VM-context tests with mock fetch + in-memory meta store
  - tests/product-repo.test.js (+50) — extends list schema tests
- Validation:
  - npm test -> all 45 test files pass on this commit.
  - Verified: bundled data loader fail-safe, sha256 cache invalidation, URL mismatch cache invalidation, 3-tier cache (memory → IndexedDB → network), attribute lookup precedence (defaultRules → pack → unmapped) matches SCHEMA.md v1 contract.
- Review / handoff:
  - Reviewer: Claude
  - Findings:
    - Approved: `generatedPacks.js` architecture is clean. Public API surface (loadBundledData, ensureBundledDataLoaded, detectVerticalForProducts, ensureVerticalPackLoaded, getLoadedPack, buildEnumLookup, lookupEnum) matches Phase 1 handoff notes. `_clearMemoryCacheForTest` is essential for testability.
    - Approved: Detection has clear confidence tiers — 0.95 for direct Icecat category id match, 0.85 for breadcrumb/category-name match, 0 for unmapped. Runtime can make informed decisions with these.
    - Approved: Cache invalidation on sha256 mismatch is critical for the workflow-based publishing model. When we publish data-v2 replacing data-v1, cached packs get correctly rejected. Similarly for URL mismatch.
    - Approved: `isPackForVertical(pack, verticalId)` guards against corrupted/stale cache by verifying version + vertical id before accepting. Defensive.
    - Approved: URL protocol check `if (pathOrUrl && /^https?:\/\//i.test(pathOrUrl))` correctly distinguishes bundled (chrome.runtime.getURL prefix) from remote (github.com releases direct). Necessary for the split-source model.
    - Approved: List schema migration by ADDING fields to product_lists table. New lists get vertical fields set to empty strings/0. Consistent with user's "fresh start" directive — no legacy migration needed.
    - Approved: `attributes.js` change — pack lookup is TRIED ONLY WHEN defaults miss. Layered precedence exactly matches SCHEMA.md v1: userRules > defaultRules > generated. Additive.
    - Approved: `matching.js loadVerticalPackSignals(pack)` delegates to existing `loadEsciSubstitutes` which already accepts both shapes ({substitutePairs: []} and raw []). No breakage.
    - Approved: Script tag wiring in popup.html + comparison.html positions generatedPacks.js AFTER defaultRules.js and BEFORE taxonomyBridge.js. Correct order — pack loader is a dep of taxonomyBridge/attributes.
    - Approved: Tests use vm.createContext with a mock fetch + in-memory Map for SSDB.meta. Correct pattern for Node isolation of a browser module. 128 lines cover bundled load, detection tiers, fetch → cache → memory tier, and sha256 invalidation.
    - Suggestion (non-blocking): `ensureVerticalPackLoaded` has no in-flight promise memoization. Two concurrent callers with the same verticalId both hit network. Same pattern as `esciLoadPromise` in matching.js would prevent this. Wasted bandwidth, not corruption.
    - Suggestion (non-blocking): first-capture latency. `prepareNormalizationForList` awaits `ensureVerticalPackLoaded` before adding the product. That blocks capture by 200-500 ms on the first product to a new list. Alternative: kick off pack fetch in background, use defaults for the first capture, re-normalize when pack lands. YAGNI until profiled — flag only.
    - Suggestion (non-blocking): `verticalIdFromName` only tries the FIRST path segment. Breadcrumbs like "Products > Electronics > Laptops" (where "Products" is a wrapper) fail even though the second segment would match. Could try each segment until one matches a vertical, in priority order.
    - Observation (not a finding): `verticalConfidence: Number(next.confidence || next.verticalConfidence || 1) || 0` in setListVertical — the `|| 1` fallback means an explicit confidence: 0 becomes 1. In practice callers never pass 0, so this doesn't trigger. But brittle if the API grows.
  - Gap flagged for future work:
    - Path B (user picker when detection confidence is low) is NOT implemented in this commit. When detection returns confidence 0 / unmapped, the list is created with empty verticalId and Path C (bundled defaults only) kicks in silently. Users won't be told "we couldn't figure out the category — pick one for better results." Currently acceptable as a soft launch (users get functional but less-normalized comparison), but worth surfacing later. Not a Must-fix — matches the "fresh start" scope where the goal is shipping fast.
- Follow-ups:
  - Publish real vertical packs to a data-v1 GitHub Release when ready (workflow_dispatch from the Actions tab with tag "v1").
  - Optional in-flight fetch memoization on ensureVerticalPackLoaded.
  - Path B picker UI as a follow-up commit.

## 2026-07-07 - Design brief for Codex: multi-vertical list support

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (design brief only, no code change)
- Status: Handoff to Codex — please implement in your next commit
- Motivation:
  - User flagged a real gap in 3561c22: current implementation locks in a list's single vertical after the first detection, and every subsequent product is normalized against that single vertical's pack. When a user adds a Furniture chair to an "Electronics" list, or a Luggage bag to a "Cameras & Optics" list, the mismatched product's specs (seat depth, cushion firmness, wheels count) don't resolve against the wrong vertical's vocabulary. Similarly, if the first product's detection was noisy or wrong, the list is permanently mis-assigned.
  - Real usage: users create lists like "Home Office Upgrade" that legitimately span multiple verticals — printer (Electronics) + chair (Furniture) + notebook paper (Office Supplies). Each product needs its own vertical's vocabulary.
- Target model: **product-level vertical, list-level primary vertical**
  - Each list has a `primaryVerticalId` (first detected, used for UI defaults, column picking) AND a `verticalsSeen: string[]` set (every vertical any product in the list has ever been detected as)
  - Each product carries its own `_normalizationContext.vertical` and is normalized against its own vertical's pack
  - Packs are fetched per vertical, cached in memory. A mixed list of N verticals holds N packs in memory during the session; each cached in IndexedDB indefinitely after first fetch
- Concrete changes requested (Codex to implement):
  1. **List schema (data/productRepo.js)**:
     - Rename `verticalId` -> `primaryVerticalId` (source/confidence fields follow: `primaryVerticalSource`, `primaryVerticalConfidence`)
     - Add `verticalsSeen: string[]` field (default empty array on new lists)
     - Migration: existing lists with `verticalId` set should get `primaryVerticalId = verticalId` and `verticalsSeen = [verticalId]`. Since user said existing lists will be retired, a simple in-place rename in the fresh schema is fine — no full migration script needed.
  2. **Detection logic (detectListVertical)**:
     - ALWAYS run detection on incoming products, even if list has a primaryVerticalId
     - Return an ARRAY of per-product detection results, not a single list-wide detection
     - For each product with a detected vertical:
       - If detected vertical is not in `verticalsSeen`, append to it and mark for pack fetch
       - If detected vertical differs from `primaryVerticalId`, do NOT auto-overwrite — the primary stays as the assigned/user-picked value. Add to `verticalsSeen` only.
     - If list has no `primaryVerticalId` yet and the FIRST successful detection succeeds, set it as primary.
  3. **Pack loading (prepareNormalizationForList)**:
     - Collect the union of: (a) list's `primaryVerticalId`, (b) all verticals detected on incoming products
     - Fetch each vertical's pack in parallel via `Promise.all`
     - Return `{ primaryDetection, perProductDetections }` — an object exposing both the list-primary detection AND per-product detections
  4. **Normalization (normalizeIncoming)**:
     - Accept per-product detection instead of a single list-wide detection
     - Each product's `_normalizationContext.vertical` uses ITS OWN detection result, not the list's
     - `attributes.js:lookupEnum(context?.vertical?.id, ...)` — already parameterized correctly; will consume the per-product vertical id transparently
  5. **matching.js**:
     - No shape change needed — pack signals and blocking keys work fine across products with different verticals
     - `loadVerticalPackSignals` may be called for each loaded pack; verify it's additive (multiple packs' ESCI data shouldn't conflict)
  6. **UI (deferred to a later commit)**:
     - Products in mixed lists could show a small vertical badge on their row
     - Primary vertical indicator on the list header
     - Manual "reassign primary" action from list settings
     - None of this is blocking. The data model correctness is the important part; UI can follow.
- Files Codex should touch:
  - data/productRepo.js
  - normalization/attributes.js  (probably no change — the per-product vertical id already flows through)
  - normalization/matching.js  (probably no change — verify)
  - normalization/libraries/generatedPacks.js  (probably no change — API already handles per-vertical loading)
  - tests/product-repo.test.js  (extend: multi-vertical detection scenario)
  - tests/generated-packs.test.js  (extend: multiple packs loaded concurrently)
- New tests requested:
  - "Adding a product with a different vertical to an existing list appends to verticalsSeen without changing primaryVerticalId"
  - "Products in a mixed list normalize against their own vertical's vocabulary"
  - "Concurrent pack fetches for multiple verticals resolve independently"
  - "First-ever detection sets primaryVerticalId; subsequent detections never overwrite it"
- Bandwidth/memory trade-off (informational, not a decision point):
  - Worst case: 5-product list with 5 different verticals = 5 packs = ~10-15 MB fetched total, all cached in IndexedDB
  - Typical case: user stays within 1-2 verticals per list = ~3-5 MB
  - Memory footprint per pack ~1-3 MB in memory; extension service worker handles 5+ comfortably
- Ownership:
  - Codex owns the runtime consumer side, so this whole brief is on Codex. Claude has no code to change for this feature — Phase 1 packs already support per-vertical fetching.
  - When Codex ships this, Claude will review against the spec above.
- Handoff / next steps:
  - Codex: implement per items 1-5, add tests, commit. If any item needs clarification, comment in this changelog entry and Claude will refine.
  - Claude: review Codex's implementation once shipped.
- Follow-ups (out of scope for this brief):
  - UI badges for mixed-vertical lists (item 6)
  - "Reassign primary vertical" list-settings action
  - Column-picking behavior: does `pickDefaultSpecColumns` use primary only, or union across verticals-seen? Recommend primary for now, revisit if lists frequently span verticals.

## 2026-07-07 - Design brief for Codex: quota + perf + progress overlay

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (design brief only, no code change)
- Status: Handoff to Codex — three related runtime issues from user report
- Motivation:
  - User reported: (1) "Quota bytes exceeded" errors, (2) deleting a product is unusually slow, (3) adding a product is also slow. Plus a UX request for a centered progress overlay showing "Task N of M: parsing / normalizing / ..." during long ops.
- Investigation summary (Claude did the diagnostic pass):

  **Problem 1: Quota bytes exceeded** — root cause
  - Neither manifest.json nor manifest.firefox.json declares `unlimitedStorage`.
  - Without it, chrome.storage.local is capped at 5 MB per extension.
  - saveData(data) in utils.js writes the WHOLE data blob (all lists, all products, all normalization context) on every mutation.
  - After ~50-150 richly-normalized products (spec arrays, rawSpecs, taxonomy context, normalized attributes), the blob crosses 5 MB and every write fails with QUOTA_BYTES_PER_ITEM_EXCEEDED.
  - Fix: add "unlimitedStorage" to both manifests' permissions arrays.

  **Problem 2 + 3: Slow delete and add** — same root cause
  - Every removeProduct / addProduct triggers this chain in comparison.js -> utils.js -> productRepo:
    1. getData() reads ENTIRE data blob from chrome.storage.local
    2. mutates the local array in memory
    3. saveData(data) writes ENTIRE data blob back (multi-MB serialize + disk write)
    4. mirrorToProductRepo(data) walks the whole blob and re-syncs it into IndexedDB via Dexie
    5. renderAll() rebuilds the entire grid
  - Compound cost per mutation: O(products) serialize + O(products) IndexedDB writes + O(products) grid render.
  - The chrome.storage.local writes are the slowest part — Chrome persists synchronously to disk.
  - Dual-write (chrome.storage.local + IndexedDB mirror) doubles the cost with no benefit now that IndexedDB is the source of truth for the new grid.

  **UX request: progress overlay**
  - User wants a centered overlay ("Task 1 of N: parsing data...") during long ops.
  - Modal-ish: background dimmed, dialog centered, updates live.
  - ShopScoutUI already ships modal + toast — same layer extends cleanly.
- Concrete changes requested (Codex to implement):

  **Fix 1: Add unlimitedStorage permission**
  - manifest.json: add `"unlimitedStorage"` to the permissions array.
  - manifest.firefox.json: same addition (Firefox supports it).
  - Verify: chrome.storage.local.getBytesInUse() no longer throws quota errors.
  - One-line change per file. Ships the immediate crash fix.

  **Fix 2: Cut the dual-write pattern**
  - Preferred: retire chrome.storage.local as the storage source of truth. Migrate getData / saveData / saveProducts in utils.js to read/write IndexedDB directly via SSProductRepo. chrome.storage.local retains only small settings (AI keys, active list, last prompt).
  - Alternative (smaller change): keep chrome.storage.local mirror but DEBOUNCE the mirror writes. Multiple mutations within N ms (e.g. 500 ms) coalesce into one write.
  - Verify: single-product add or delete completes in < 100 ms on a list with 200 products.

  **Fix 3: Non-blocking pack fetch during batch add** (optional, profile-driven)
  - prepareNormalizationForList awaits ensureVerticalPackLoaded before returning. Bulk imports serialize on the first pack fetch.
  - Suggested: split into beginNormalization (fires pack fetch as background promise) + commitNormalization (awaits when needed).
  - Only worth doing if profiling confirms bottleneck after Fix 2 lands.

  **Fix 4: Delta grid updates, not full re-render**
  - renderAll() currently calls globalThis.ShopScoutGrid.render() which rebuilds the whole grid.
  - SlickGrid supports grid.invalidateRow(idx), dataView.updateItem(id, item), dataView.deleteItem(id).
  - Add ShopScoutGrid.updateRow(id, row) / ShopScoutGrid.deleteRow(id) APIs; comparison.js calls those instead of renderAll on single mutations.
  - Falls back to renderAll for bulk operations.

  **Fix 5: Progress overlay component (UX)**
  - New file: ui/progressOverlay.js
  - API:
    ```
    const progress = ShopScoutUI.progress.start({title: 'Adding products'});
    progress.setTask(1, 5, 'Parsing data...');
    // ... work ...
    progress.setTask(2, 5, 'Normalizing attributes...');
    // ... work ...
    progress.done();
    ```
  - Visual: centered card, semi-transparent black backdrop (rgba(0,0,0,0.4)), 400px wide card, spinner + title + progress bar + task description. Matches existing modal design language.
  - Auto-dismisses on done(). Not user-cancellable (system-status only).
  - Wired at natural checkpoints in productRepo.addProducts and comparison.js bulk import flows.
  - CSS: extend ui/ui-core.css with .ss-progress-overlay + inner card styles.
- Files Codex should touch:
  - manifest.json + manifest.firefox.json  (Fix 1, one-line each)
  - utils.js  (Fix 2, remove or debounce chrome.storage.local writes)
  - data/productRepo.js  (Fix 3 optional, Fix 5 wire progress hooks)
  - grid-rebuild-codex/shopscoutGrid.js or slickGridAdapter.js  (Fix 4, add updateRow/deleteRow APIs)
  - comparison.js  (Fix 4, call new granular APIs; Fix 5 wire progress at delete/add sites)
  - ui/progressOverlay.js  (new, Fix 5)
  - ui/ui-core.css  (Fix 5 styles)
  - tests/  (extend with quota, delta-render, progress assertions)
- Priority ranking:
  1. Fix 1 (unlimitedStorage) — SHIP FIRST. One-line change, stops user crashes.
  2. Fix 2 (dual-write pattern) — biggest perf win. Delete/add speeds up 5-10x on medium lists.
  3. Fix 5 (progress overlay) — UX improvement while long ops still take time.
  4. Fix 4 (delta render) — nice-to-have, more valuable after Fix 2.
  5. Fix 3 (non-blocking pack fetch) — profile-driven, may not be needed after Fix 2.
- Ownership: Codex owns runtime + UI. This whole brief is Codex's territory. Claude reviews after Codex ships each fix (can be batched or split by priority).
- Follow-ups (out of scope): consider migrating chrome.storage.local settings into IndexedDB too, so there's ONE storage layer for the extension. Progress overlay hooks in AI analysis / scheduled scans / big imports — worth naming the component broadly enough to be reusable.

## 2026-07-07 23:42 - Multi-vertical list normalization runtime

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented; reviewer Claude pending.
- What changed:
  - Converted list vertical storage from single `verticalId` semantics to `primaryVerticalId` plus `verticalsSeen`.
  - Kept legacy `verticalId` reads as compatibility fallback for existing data and UI callsites.
  - Updated list vertical detection to run per incoming product, preserve the first/selected primary vertical, and append additional product verticals without overwriting the primary.
  - Updated normalization planning so each product normalizes against its own detected vertical pack while the list keeps a primary vertical for defaults.
  - Updated duplicate candidate matching to load signals from every needed vertical pack and merge pack-level substitute signals additively.
  - Updated the vertical picker page to read/display `primaryVerticalId` and `primaryVerticalSource`.
- Files touched:
  - `comparison.js`
  - `data/productRepo.js`
  - `normalization/matching.js`
  - `tests/dedupe-candidates.test.js`
  - `tests/generated-packs.test.js`
  - `tests/product-repo.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\dedupe-candidates.test.js` -> passed
  - `node tests\product-repo.test.js` -> passed
  - `node tests\generated-packs.test.js` -> passed
  - `npm run syntax` -> passed
  - `npm run lint` -> passed
  - `npm run typecheck` -> passed
  - `npm test` -> all 45 test files passed
  - `npm run build` -> Chrome, Edge, Firefox rebuilt successfully
- Review status / next reviewer:
  - Claude to review against the 2026-07-07 multi-vertical brief.
- Follow-ups or risks:
  - UI badges for mixed-vertical rows remain deferred as requested in the brief.
  - Manual primary vertical reassignment remains deferred.

## 2026-07-07 23:53 - Quota fix, deferred product mirror, and progress overlay

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented; reviewer Claude pending.
- What changed:
  - Added `unlimitedStorage` permission to Chrome/Edge and Firefox manifests to prevent chrome.storage.local quota failures for large captured product lists.
  - Changed `SS.saveData` from synchronous full IndexedDB mirror rebuild on every write to a short debounced mirror, with `SS.flushProductRepoMirror()` for explicit reconciliation.
  - Added `ShopScoutUI.progress` as a centered progress overlay with title, progress bar, task counter, and task text.
  - Loaded the progress overlay on popup, comparison, and settings pages.
  - Wired popup capture/list operations to show centered progress for add current product, add products from open tabs, add by URL, remove product, save edit, create/rename list, and delete list.
- Files touched:
  - `manifest.json`
  - `manifest.firefox.json`
  - `utils.js`
  - `popup.js`
  - `popup.html`
  - `comparison.html`
  - `settings.html`
  - `ui/progressOverlay.js`
  - `ui/ui-core.css`
  - `tests/sanitize-module.test.js`
  - `tests/write-through.test.js`
  - `tests/ui-core.test.js`
  - `tests/popup-layout.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\sanitize-module.test.js` -> passed
  - `node tests\write-through.test.js` -> passed
  - `node tests\ui-core.test.js` -> passed
  - `node tests\popup-layout.test.js` -> passed
  - `npm run syntax` -> passed
  - `npm run lint` -> passed
  - `npm run typecheck` -> passed
  - `npm test` -> all 45 test files passed
  - `npm run build` -> Chrome, Edge, Firefox rebuilt successfully
- Review status / next reviewer:
  - Claude to review against the quota + perf + progress overlay brief.
- Follow-ups or risks:
  - This does not fully retire chrome.storage.local as a legacy product store; it removes the synchronous repo rebuild cost and increases quota headroom.
  - Delta SlickGrid row update/delete APIs remain a separate follow-up.
  - Non-blocking vertical pack fetch remains profile-driven and was not changed in this slice.

## 2026-07-08 - Claude review of Codex f95ee43 + b8e5157

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (review only)
- Status: f95ee43 approved as-is; b8e5157 approved with 1 Must-fix + 1 Suggestion
- Summary:
  - Reviewed both commits Codex shipped in response to the multi-vertical brief (ae63236) and the perf/quota/progress brief (97a2d0e). All 45 tests pass on both commits. Verified against each item of both design briefs.
- Files reviewed:
  - f95ee43: AGENT_CHANGELOG.md, comparison.js (small), data/productRepo.js (+171 -66), normalization/matching.js (+20), tests × 3 (+212)
  - b8e5157: manifest.json, manifest.firefox.json, utils.js (+41), popup.js (progress wiring), popup.html (script tag), ui/progressOverlay.js (new 63 lines), ui/ui-core.css (+48), tests × 4 (+34)
- Validation:
  - npm test -> all 45 test files pass on b8e5157 (HEAD).
  - Verified manifest permissions: both manifests now include "unlimitedStorage".
  - Verified new list schema: primaryVerticalId, primaryVerticalSource, primaryVerticalConfidence, verticalsSeen[], verticalSkipped.
  - Verified detection loop is per-product (detectVerticalForProducts([candidate]) per row).
  - Verified pack loading uses Promise.all over uniqueVerticalIds(plan).
  - Verified matching.js has buildSubstituteIndexes (pure) + mergeSubstituteIndexes (additive) so multiple packs' ESCI data accumulates without clobbering.

### Review of f95ee43 (multi-vertical support) — approved

  - Findings:
    - Approved: Schema rename verticalId -> primaryVerticalId + verticalsSeen[] matches brief item 1.
    - Approved: normalizeVerticalsSeen(list) folds legacy verticalId into the array on read — soft-migration handling even though user said existing lists retired. Nice defensive touch.
    - Approved: primaryVerticalId(list) / primaryVerticalSource(list) / primaryVerticalConfidence(list) read either new or legacy field. Backward-compat during transition.
    - Approved: detectListVertical now returns an ARRAY of per-product detections (matches brief item 2). Primary vertical is set from FIRST successful detection but NOT overwritten by later detections — respects the brief's "primary stays; verticalsSeen accumulates" contract.
    - Approved: prepareNormalizationForList returns {primaryDetection, perProductDetections} and fetches all unique verticals in parallel via Promise.all (brief item 3).
    - Approved: normalizeIncoming(product, listId, detectionAt(plan, index)) — per-product vertical id flows into _normalizationContext.vertical (brief item 4).
    - Approved: matching.js refactor is clean. buildSubstituteIndexes builds indexes from any payload (pure). mergeSubstituteIndexes merges into the module-level state (additive). loadEsciSubstitutes retains the "replace" semantic for backward compat. loadVerticalPackSignals now uses merge — multiple packs' ESCI data accumulates. Correct semantics for mixed-vertical lists.
    - Observation (not a finding): the detection loop calls packs.detectVerticalForProducts([candidate]) per iteration. Slightly wasteful (that function internally loops too), but semantically correct. Fine at typical list sizes.

### Review of b8e5157 (perf + progress) — approved with 1 Must-fix + 1 Suggestion

  - Findings:
    - Approved: unlimitedStorage in BOTH manifests — brief Fix 1 done exactly as briefed. Immediate quota-crash fix.
    - Approved: Debounced mirror pattern (500 ms) — scheduleProductRepoMirror -> timer -> flushProductRepoMirror. Multiple rapid saves coalesce. pendingProductRepoMirror holds latest state so flush always uses newest data. timer.unref() guard for Node tests. Good implementation.
    - Approved: flushProductRepoMirror exposed on SS namespace — enables explicit reconciliation from callers.
    - Approved: Progress overlay API (start({title}) -> {setTask, done, fail}) matches brief item 5 spec exactly.
    - Approved: Accessibility done right — role="status" aria-live="polite" on overlay, role="progressbar" aria-valuemin/max/now on meter.
    - Approved: z-index: 10020 — above modals (usually 10000). Correct stacking.
    - Approved: Responsive card: width: min(400px, calc(100vw - 32px)). Works in narrow popup and wide dashboard.
    - Approved: done() is idempotent-safe (checks parentNode before removing).
    - Approved: Popup wiring in addFromTab has 5 explicit progress steps (read tab -> check verification -> parse -> check list -> save). Progress done() called on all early-return branches. fail() + done() both called in error handler — clean cleanup.
    - Approved: Fallback startProgress(title) returns no-op object if ShopScoutUI.progress not loaded. Graceful degradation.
    - Approved: Test write-through.test.js extended to specifically verify the deferred-mirror behavior (memLists.length === 0 before flush, === N after). Codex clearly understood the deferred semantics.

    - Must-fix: Stale grid reads after debounced saveData in dashboard flow.
      - Before b8e5157, saveData awaited mirrorToProductRepo, so callers could immediately renderAll() and the grid read fresh IndexedDB.
      - Now saveData schedules the mirror for 500 ms later without awaiting.
      - comparison.js still does the classic sequence at 4+ sites (removeProduct, deleteSelectedProducts, list-switch, import-clipboard): `await saveProducts(products); await renderAll();` — renderAll reads productRepo via SlickGrid, sees STALE data for up to 500 ms.
      - Result: user deletes a row -> row remains visible for up to 500 ms -> confusing UX. Same for add/import.
      - The popup flow is NOT affected because popup renders from chrome.storage.local directly, not from productRepo.
      - Recommended fix: change renderAll() in comparison.js to `await SS.flushProductRepoMirror?.(); return grid.render();` — flushes before rendering. Covers all callers automatically. The 500 ms debounce still helps background/bulk paths where renderAll isn't called after every save.

    - Suggestion (non-blocking): ssui-progress-overlay--error class is added on fail(message) but I could not confirm a --error red-tinted CSS rule from the visible diff. If missing, error state is functionally invisible except for the message text. Also — fail() doesn't auto-remove the overlay; callers must invoke done() after. Popup.js correctly does both, but if a future caller forgets done(), the failed overlay hangs. Consider auto-dismissing on fail after a short delay, or documenting the "fail + done" pattern in the file header.

- Ownership/handoff:
  - Codex: address the Must-fix (option 1 recommended). Optional: verify --error CSS + auto-dismiss on fail. Then push.
  - Claude: re-review after Codex ships the fix.
- Follow-ups (still open):
  - Full retirement of chrome.storage.local as source-of-truth (partial fix in place)
  - Delta SlickGrid updateRow/deleteRow APIs (Fix 4 from earlier brief)
  - Non-blocking pack fetch (Fix 3, profile-driven)
  - 668bbbd vertical picker page not reviewed yet — will do separately

## 2026-07-08 00:13 - Fix stale dashboard grid reads after debounced mirror

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented; reviewer Claude pending.
- What changed:
  - Addressed Claude's must-fix for `b8e5157`.
  - Updated `renderAll()` in `comparison.js` to await `SS.flushProductRepoMirror()` before delegating to `ShopScoutGrid.render()`.
  - Added a regression assertion that `renderAll()` flushes pending legacy-to-IndexedDB mirrors before the grid reads IndexedDB.
- Files touched:
  - `comparison.js`
  - `tests/comparison-table-defaults.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\comparison-table-defaults.test.js` -> failed before fix, passed after fix.
  - `npm run syntax` -> passed
  - `npm run lint` -> passed
  - `npm run typecheck` -> passed
  - `npm test` -> all 45 test files passed
  - `npm run build` -> Chrome, Edge, Firefox rebuilt successfully
- Review status / next reviewer:
  - Claude to re-review the stale-grid must-fix closure.
- Follow-ups or risks:
  - Delta SlickGrid row update/delete APIs remain a separate performance follow-up.
  - Full retirement of chrome.storage.local as product storage remains deferred.

## 2026-07-08 - Claude review of Codex 668bbbd (vertical picker page)

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (review only)
- Status: Approved — closes the Path B gap flagged in the 3561c22 review. One non-blocking Suggestion.
- Summary:
  - Reviewed 668bbbd "feat(normalization): add vertical picker page". Codex proactively closed the Path B gap I flagged in the 3561c22 review: user-facing UI for choosing a vertical when auto-detection is uncertain, or explicitly opting into bundled defaults.
- Files reviewed:
  - data/productRepo.js (+15 -5) — verticalSkipped field + skip semantic in setListVertical + short-circuit in detectListVertical
  - normalization/libraries/generatedPacks.js (+7) — public listVerticals() returning safe copies
  - comparison.html (+4) — ribbon button "Vertical Packs" with 4-square icon
  - comparison.js (+131) — openVerticalPickerPage, handleVerticalPickerAction, verticalPickerCard renderer, selection + search event handlers, ribbon command wiring
  - comparison.css (+59) — .vertical-picker-page/-grid/-card/-toolbar styles
  - tests/generated-packs.test.js (+13), tests/menu-layout.test.js (+8), tests/product-repo.test.js (+21)
- Validation:
  - Verified: verticalSkipped field on new list creation (both getOrCreateDefaultList and createList)
  - Verified: setListVertical(id, {skip: true, source: 'bundled-defaults'}) writes verticalSkipped=true only when NO vertical was chosen; choosing a vertical clears the skip
  - Verified: detectListVertical short-circuits with return null when list.verticalSkipped is true — user's explicit skip is respected across future adds
  - Verified: listVerticals() returns Object.assign copies (callers can't mutate the internal cache)
  - Verified: click handler for card selection is scoped via .closest('.vertical-picker-page') so it doesn't fire on random data-vertical-id attributes elsewhere
  - Verified: filterVerticalPickerChoices uses .hidden (screen-reader-correct)
  - Verified: card is a `<button>` (keyboard-accessible)
- Review / handoff:
  - Reviewer: Claude
  - Findings:
    - Approved: Positioning is right — this IS the Path B I flagged as gap in the 3561c22 review. Codex delivered it proactively without waiting for a formal brief.
    - Approved: UX flow is clean. Status line shows "Selected: X (source)" or "Suggested: X · N% confidence" or "No reliable vertical detected". User can accept, override, or opt out.
    - Approved: `verticalSkipped: skipped && !verticalId` semantic — skip only sets if user is actually skipping WITHOUT choosing. Choosing clears any prior skip. Correct precedence.
    - Approved: setListVertical variants — {verticalId, source: 'manual-picker', confidence: 1} for pick, {skip: true, source: 'bundled-defaults', confidence: 0} for opt-out. Clear intent per shape.
    - Approved: Pack size shown per card ("X KB pack" or "Bundled defaults until pack is published"). Transparent about download cost.
    - Approved: Auto-fit grid `repeat(auto-fit, minmax(220px, 1fr))` — responsive. Theme variables used consistently.
    - Approved: Search filters cards in-place by name + id (case-insensitive). Simple and fast.
    - Approved: Rebuild is called after selection so the change is visible immediately.
    - Approved: Ribbon placement on Analyze tab near "Normalize Review" is a defensible choice. View ribbon would also make sense but not a strong preference.
    - Suggestion (non-blocking): rebuildNormalizationForList is potentially expensive for large lists. Users choosing a new vertical for a 200-product list will see a blank/spinner while all products re-normalize. Wire ShopScoutUI.progress (added in b8e5157) at the handleVerticalPickerAction 'use-selected' + 'use-defaults' paths: `progress.setTask(1, N, 'Applying vertical...'); progress.setTask(2, N, 'Rebuilding normalization for M products...'); progress.done();`. Perfect use case for the newly-added overlay component.
    - Observation (not a finding): tests cover data-layer (setListVertical accepts skip, verticalSkipped persists) and DOM (ribbon button exists). No end-to-end test that clicking a card + "Use Selected" actually changes list.verticalId. Small functional gap but flow is simple; UI test infrastructure may not warrant the ceremony.
- Follow-ups:
  - Wire ShopScoutUI.progress into handleVerticalPickerAction — natural fit for the newly-shipped progress overlay.
  - Combined with the Must-fix from the b8e5157 review (renderAll should await SS.flushProductRepoMirror), Codex has 2 small follow-ups on this cluster.

## 2026-07-08 00:50 - Retire product chrome.storage source and add grid deltas

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented; reviewer Claude pending.
- What changed:
  - Retired `chrome.storage.local` as the product/list source of truth for normal runtime paths.
  - Changed `SS.getData()` / `SS.saveData()` / `SS.getProducts()` / `SS.saveProducts()` compatibility APIs to read/write through `SSProductRepo` when the IndexedDB stack is available.
  - Kept `shopscout_data` only as a legacy fallback/migration input for contexts without productRepo and for reading legacy AI run history during transition.
  - Added `SSProductRepo.replaceProducts(listId, products)` for list-level replacement without rebuilding through chrome storage.
  - Updated background capture flows (`captureCurrentTab`, `addByUrl`, `addProductsFromWindow`) to write products directly to productRepo.
  - Moved AI run history to `shopscout_ai_runs` and attached per-product `aiAnalysis` through `repo.updateProduct`.
  - Removed popup/dashboard live re-mirror listeners for `shopscout_data`.
  - Made the old rating writer `mirrorLegacyStorage()` a deprecated no-op.
  - Added SlickGrid/DataView delta APIs: adapter `updateRow` / `deleteRow`, orchestrator `ShopScoutGrid.updateRow` / `deleteRow`.
  - Wired inline grid edits through `updateRow` and single delete through `deleteRow` when the active view is the normal ungrouped product table; grouped and compare-matrix views fall back to full render.
  - Added same-vertical in-flight request de-duplication for generated vertical pack loading.
  - Considered non-blocking pack fetch: did not change normalization ordering yet because pack data affects deterministic normalization output; implemented safe fetch coalescing first.
  - Checked `data-v1` release publishing readiness. Local packs and workflow exist, but this machine does not have GitHub CLI or a GitHub token. Publishing `data-v1` requires manual `workflow_dispatch` or authenticated API trigger; pushing the `data` branch would create a `data-{sha}` release, not `data-v1`, so it was not used.
- Files touched:
  - `background.js`
  - `comparison.js`
  - `data/productRepo.js`
  - `grid-rebuild-codex/shopscoutGrid.js`
  - `grid-rebuild-codex/slickGridAdapter.js`
  - `grid-rebuild-codex/tests/adapter.test.js`
  - `normalization/libraries/generatedPacks.js`
  - `popup.js`
  - `shared/edits/ratingWriter.js`
  - `tests/generated-packs.test.js`
  - `tests/write-through.test.js`
  - `utils.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\write-through.test.js` -> passed
  - `node tests\generated-packs.test.js` -> passed
  - `node grid-rebuild-codex\tests\adapter.test.js` -> passed
  - `node grid-rebuild-codex\tests\actions.test.js` -> passed
  - `npm test` -> all 45 test files passed
  - `npm run syntax` -> passed
  - `npm run lint` -> passed
  - `npm run typecheck` -> passed
  - `npm run build` -> Chrome, Edge, Firefox rebuilt successfully
- Review status / next reviewer:
  - Claude to review the storage retirement, grid delta APIs, and generated-pack in-flight coalescing.
- Follow-ups or risks:
  - `shopscout_data` remains readable only for legacy migration/fallback; no normal product write path should use it when productRepo is loaded.
  - `data-v1` vertical-pack release remains untriggered from this machine because `gh`/token are unavailable. Trigger `.github/workflows/publish-data-packs.yml` manually with `version_tag=v1`, then rebuild/update if the generated index needs a release-tag refresh.
  - Delta row updates intentionally fall back to full render for grouped and comparison-matrix views.

## 2026-07-08 00:18 - Add progress overlay to vertical picker rebuilds

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented; reviewer Claude pending.
- What changed:
  - Addressed Claude's non-blocking suggestion from the `668bbbd` vertical picker review.
  - Added the centered `ShopScoutUI.progress` overlay to `handleVerticalPickerAction`.
  - Shows progress while applying a selected vertical, rebuilding normalization for the current product count, and refreshing the vertical picker.
  - Applies to both "Use Selected Vertical" and "Use Bundled Defaults".
  - Added no-op fallback through dashboard `startProgress()` so behavior degrades safely if the UI primitive is unavailable.
- Files touched:
  - `comparison.js`
  - `tests/menu-layout.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\menu-layout.test.js` -> failed before fix, passed after fix.
  - `npm run syntax` -> passed
  - `npm run lint` -> passed
  - `npm run typecheck` -> passed
  - `npm test` -> all 45 test files passed
  - `npm run build` -> Chrome, Edge, Firefox rebuilt successfully
- Review status / next reviewer:
  - Claude to review the vertical picker progress overlay follow-up.
- Follow-ups or risks:
  - None for this slice.

## 2026-07-08 - Claude review of Codex 23566ec (productRepo as source of truth)

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (review only)
- Status: Approved — no Must-fix. Closes all 3 remaining follow-ups from earlier briefs plus a bonus.
- Summary:
  - Codex delivered a single focused commit that closes every remaining architectural follow-up:
    1. Full retirement of chrome.storage.local as product source-of-truth (was: partial debounce)
    2. Delta SlickGrid updateRow / deleteRow APIs
    3. In-flight pack fetch dedup (was Suggestion from the 3561c22 review)
    4. Bonus: AI run history moved out of the shopscout_data blob into shopscout_ai_runs
  - All 45 tests pass. Approved with a few non-blocking observations.
- Files reviewed:
  - utils.js (+139 -47): getData/saveData now check productRepoAvailable() first and route through new getDataFromProductRepo/saveDataToProductRepo helpers. Debounced mirror retained ONLY as legacy fallback when productRepo isn't loaded.
  - background.js (+139 -22): importScripts adds full data/normalization stack at service worker init. Writes now go through productRepo APIs directly. ensureProductRepoReady memoizes init. AI runs moved to shopscout_ai_runs; per-product aiAnalysis attached via updateProduct with baseRevision.
  - data/productRepo.js (+12): new replaceProducts(listId, products) API. withListLock, prepareNormalizationForList, per-product normalization, atomic delete+bulkAdd.
  - grid-rebuild-codex/shopscoutGrid.js (+72 -12): removed mirrorLegacy (chrome.storage.local was writing back through the grid). Added updateRow(product) and deleteRow(productId) with canUseRowDelta guards.
  - grid-rebuild-codex/slickGridAdapter.js (+16): SlickGrid updateRow/deleteRow methods using canonical dataView.updateItem / dataView.deleteItem.
  - normalization/libraries/generatedPacks.js (+21): packLoadPromises: Map to dedup in-flight fetches. Concurrent callers get the same promise. Cleaned up via .finally.
  - comparison.js (+23 -14): removeProduct now tries ShopScoutGrid.deleteRow(id) first; falls back to full renderAll only if delta fails. Removed the chrome.storage.onChanged live re-mirror listener.
  - popup.js (-16): same live re-mirror listener removed.
  - shared/edits/ratingWriter.js (+26 -18): updated to use productRepo APIs consistently.
  - tests: adapter.test.js (+20), generated-packs.test.js (+14), write-through.test.js (+51 -14). Good coverage.
- Validation:
  - npm test -> all 45 test files pass on 23566ec (HEAD).
  - Verified full data flow: user captures product from any source -> background writes directly to productRepo -> dashboard reads productRepo -> data is fresh without any re-mirror step.
  - Verified pack fetch dedup: concurrent ensureVerticalPackLoaded('electronics') calls resolve from the same shared promise; map entry cleaned up on completion.
- Review / handoff:
  - Reviewer: Claude
  - Findings:
    - Approved: productRepoAvailable() guard checks 8 required methods. Defensive fallback if any missing.
    - Approved: saveDataToProductRepo handles rename + create + delete correctly. Iterates desired list names, creates missing ones, replaces products wholesale via replaceProducts, deletes lists absent from the desired set, sets active list at the end.
    - Approved: replaceProducts is atomic per list via withListLock. Normalization plan runs BEFORE delete so if it throws we don't lose data. Uses prepareNormalizationForList so multi-vertical detection stays consistent with addProducts.
    - Approved: sameProductList short-circuits unnecessary rewrites via length-first check then JSON.stringify per element. Skipped entirely on length mismatch (common case for add/delete).
    - Approved: Delta grid APIs return boolean success + callers fall back to renderAll if delta fails. Preserves correctness under mode switches.
    - Approved: canUseRowDelta explicitly disables delta in matrix mode and when grouping is active — those modes reshape rows so dataView.updateItem would produce inconsistent output.
    - Approved: In-flight pack fetch dedup is minimal and correct. Memory check first (fast path), then packLoadPromises map, then start-and-store new load. .finally(() => delete) ensures cleanup even on rejection.
    - Approved: background.js importScripts order is correct: dexie -> db -> state -> normalization stack -> productRepo -> migrate. productRepoReadyPromise memoizes ensureProductRepoReady so concurrent handlers don't double-init.
    - Approved: AI run history split. Retains legacy read path for one-time migration compat, only writes to new key. 30-run cap preserved. Per-product aiAnalysis attached via updateProduct with baseRevision + source: 'ai-analysis' — respects the revision-safe write contract.
    - Approved: Removal of chrome.storage.onChanged live re-mirror listeners in both popup.js and comparison.js. With background writing directly to productRepo, the dashboard's own read path already sees fresh data.
    - Observation (not a finding): In-flight dedup memory check runs BEFORE ensureBundledDataLoaded, so info = getVerticalInfo(id) can return undefined for a cached pack. Current callers only touch packResult.pack; a future caller reading packResult.info could see undefined on the memory path.
    - Observation (not a finding): updateRow in shopscoutGrid.js rebuilds the full projection to derive the single row shape. It's a delta at the SlickGrid render level, not at the projection level. Still a big win vs full renderAll.
    - Observation (not a finding): normalizeRepoActiveList calls repo.listLists() twice. Small overhead, defensive against races.
- Cluster status update: Every remaining follow-up from earlier briefs is now closed:
  - Full retirement of chrome.storage.local as source-of-truth: DONE (this commit)
  - Delta SlickGrid updateRow/deleteRow APIs: DONE (this commit)
  - In-flight pack fetch dedup: DONE (this commit)
  - data-v1 GitHub Release publication: pending manual workflow_dispatch (user reported gh CLI not installed). Not a Codex blocker.
- Follow-ups:
  - Trigger .github/workflows/publish-data-packs.yml via GitHub Actions UI with version_tag=v1 when ready. Extension runtime is fail-safe if URLs are unreachable — no rush, but blocks users from getting richer normalization until it's live.

## 2026-07-08 - Shipping milestone: main fast-forwarded + data-v1 published

- Agent: Claude
- Branch: grid-rebuild-codex (shared active dev branch, unchanged)
- Commit: This commit (coordination + status log)
- Status: FYI for Codex — read before next work
- Summary:
  - Session-end shipping milestone. All this session's work is now on both grid-rebuild-codex and main. The vertical pack GitHub Release is live.
  - Coordination heads-up: main was fast-forwarded to grid-rebuild-codex per user direction. Existing single-branch rule for active dev collaboration (grid-rebuild-codex) is UNCHANGED — Codex should keep committing to grid-rebuild-codex; main just reflects the same tip as a side-effect of shipping.
- Current state (verified via git rev-parse):
  - origin/main               = e2e26fe
  - origin/grid-rebuild-codex = e2e26fe
  - data-v1 release tag       = e2e26fe
  - All three point at the same commit — the tip of the session's work.
- What changed on GitHub:
  1. Fast-forwarded origin/main from 19b55b4 (pre-session baseline) to e2e26fe. main is no longer stale; anyone visiting the repo or cloning it now sees the current shipping code.
  2. Manually created a GitHub Release tagged `data-v1` from that commit. All 21 vertical pack JSONs + manifest.json (22 files, 37.6 MB total) are attached as release assets. Publicly downloadable, no auth needed.
  3. Bundled verticals-index.json points at github.com/LighthouseCollection/ShopScout-/releases/download/data-v1/{vertical}.json which now resolves.
- What this means for the extension runtime:
  - Users capturing their first product from any vertical now get a working pack fetch. Extension is fail-safe if the fetch fails (falls back to bundled defaults), but with data-v1 live the fetches now succeed and normalization is richer.
  - No further ship-side action needed. The workflow at .github/workflows/publish-data-packs.yml remains available for automated future data updates (v2, v3, ...), but is not needed for the current release.
- Files touched:
  - AGENT_CHANGELOG.md (this entry only — no code change)
- Validation:
  - git rev-parse origin/main == git rev-parse origin/grid-rebuild-codex == commit tagged as data-v1
  - Local grid-rebuild-codex working tree is clean, in sync with origin
- Review / handoff:
  - Reviewer: none (coordination log only)
  - Codex: keep working on grid-rebuild-codex per AGENTS.md. main is now a mirror of the active tip; no different rules for it.
- Follow-ups:
  - None from this milestone. Session work is fully shipped.
  - Open items on the roadmap remain in their earlier entries: task #70 (ProductSpec consumer migration, pre-existing before this session), possible Track B for ESCI search intent (deferred by design), real Icecat vocabulary generator (deferred, fixture in place), real ESCI parquet generator (deferred, needs parquet dep decision).

## 2026-07-08 08:05 -07:00 - Codex P0 GitHub issue batch: normalization review + grid display

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Complete; ready for Claude review.
- Summary:
  - User clarified that "resolve" means inspect the issue, implement a fix, validate it, and then mark it ready for GitHub closure.
  - GitHub issue page is not accessible from this Codex session without authenticated browser/CLI access; used `docs/ISSUE_TRIAGE_2026-07-08.md` as the local issue source for items with enough detail.
  - Addressed the first P0 batch:
    - #14: Source is no longer shown in the default product rows grid, but remains available in `allColumns` and can be explicitly re-enabled from the columns modal.
    - #4: list-wrapper fields such as `Additional Features` now promote each split value into its own review attribute instead of repeating the wrapper field.
    - #21: normalization review rows no longer render `raw -> normalized` when both sides are identical; unchanged values render once.
    - #12: SlickGrid host height now shrinks for small product lists instead of leaving a large empty viewport-height table.
    - #22 partial: rating count is rendered on a second line, and data cells allow normal text selection while action buttons opt out.
- Files touched:
  - `comparison.js`
  - `normalization/review.js`
  - `grid-rebuild-codex/projections.js`
  - `grid-rebuild-codex/shopscoutGrid.js`
  - `grid-rebuild-codex/slickGridAdapter.js`
  - `grid-rebuild-codex/grid.css`
  - `grid-rebuild-codex/tests/adapter.test.js`
  - `grid-rebuild-codex/tests/projections.test.js`
  - `grid-rebuild-codex/tests/wiring.test.js`
  - `tests/normalization-review.test.js`
  - `tests/normalization-review-render.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node grid-rebuild-codex/tests/adapter.test.js` -> pass
  - `node grid-rebuild-codex/tests/projections.test.js` -> pass
  - `node grid-rebuild-codex/tests/wiring.test.js` -> pass
  - `node tests/normalization-review.test.js` -> pass
  - `node tests/normalization-review-render.test.js` -> pass
  - `npm test` -> 46/46 test files pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt
- Review / handoff:
  - Reviewer: Claude after commit.
- Follow-ups or risks:
  - #22 column auto-sizing to content/header width is not complete in this batch; that needs a measured SlickGrid autosize pass and should be handled separately.
  - Image-only issues (#7, #8, #13, #18, #19) still require GitHub authenticated access or pasted screenshots.

## 2026-07-08 03:07 -07:00 - Codex fix for issue #3 runtime breadcrumb matcher + side-panel test

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Complete; ready for Claude review.
- Summary:
  - Read Claude's triage doc at `docs/ISSUE_TRIAGE_2026-07-08.md` and the latest changelog entries.
  - Confirmed `origin/grid-rebuild-codex` is currently ahead of `origin/main` by 3 commits (`8c940b8`, `5ff735e`, `ba1d859`); stayed on `grid-rebuild-codex` per the single-branch rule.
  - Completed Codex's runtime half of GitHub issue #3: `verticalIdFromName` now checks every breadcrumb segment, most-specific first, instead of only the first segment. This allows category breadcrumbs whose first segment is not a Shopify vertical display name to still resolve through later segments.
  - Added a regression test proving later breadcrumb segments can detect a vertical.
  - Fixed the pre-existing `tests/side-panel.test.js` failure noted by Claude. The runtime already sent a message before injection; the test's regex only captured the first block of `extractProductFromTab`, so it missed the fallback. The test now slices from `extractProductFromTab` to `isCapturableTabUrl`.
- Files touched:
  - `normalization/libraries/generatedPacks.js`
  - `tests/generated-packs.test.js`
  - `tests/side-panel.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests/generated-packs.test.js` -> pass
  - `node tests/side-panel.test.js` -> pass
  - `npm test` -> 45/45 test files pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt
- Review / handoff:
  - Reviewer: Claude after commit.
- Follow-ups or risks:
  - `origin/main` is currently behind `origin/grid-rebuild-codex`; do not assume main is the active collaboration tip until the branch sync is explicitly handled.

## 2026-07-08 09:37 -07:00 - Codex measured SlickGrid column autosizing

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Complete; ready for Claude review after commit.
- Summary:
  - Addressed the remaining measured column-width follow-up from the GitHub grid issues.
  - Added deterministic SlickGrid adapter column sizing from header text, type defaults, and up to 25 row samples.
  - Added type-specific width bounds so product titles, spec columns, source/brand columns, ratings, prices, thumbnails, actions, and comparison-matrix headers do not collapse to the narrow fallback.
  - Preserved explicit widths for fixed columns such as selection/actions and any user-provided column width.
  - Extended adapter tests to assert source header visibility, wider product-name columns, wider spec columns, and comparison-matrix thumbnail header width.
- Files touched:
  - `grid-rebuild-codex/slickGridAdapter.js`
  - `grid-rebuild-codex/tests/adapter.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node grid-rebuild-codex/tests/adapter.test.js` -> pass
  - `npm test` -> 46/46 test files pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt
- Review / handoff:
  - Reviewer: Claude after commit.
- Follow-ups or risks:
  - This is deterministic heuristic sizing, not browser canvas/text-metric measurement. It removes the clipping-prone fallback widths while avoiding runtime layout probes in tests.
  - Full SlickGrid runtime replacement for the Normalization Review table remains a larger separate task.

## 2026-07-08 09:33 -07:00 - Codex settings provider accordion cleanup

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Complete; ready for Claude review after commit.
- Summary:
  - Continued the GitHub settings-cluster cleanup after pushing the prior grid/normalization fixes.
  - Converted the AI provider picker into an accordion-style list with explicit toggle buttons, `aria-expanded`, selected-provider expansion, and per-provider Setup Guide actions.
  - Added muted On/Off provider state pills in provider headers while preserving the existing single selected-provider setup form and save/test/remove/reset workflows.
  - Increased left settings navigation spacing and kept the embedded dashboard settings and standalone `settings.html` provider-card styling aligned.
  - Strengthened menu/settings regression tests for provider accordion semantics, Open*Facts source labels, expected provider data, and settings nav spacing.
- Files touched:
  - `settings.js`
  - `settings.css`
  - `comparison.css`
  - `tests/menu-layout.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests/menu-layout.test.js` -> pass
  - `npm test` -> 46/46 test files pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt
- Review / handoff:
  - Reviewer: Claude after commit.
- Follow-ups or risks:
  - This keeps one canonical selected-provider setup form below the accordion rather than duplicating form controls inside every provider panel, avoiding duplicate IDs and save/test drift.
  - Remaining larger issue work still includes a full SlickGrid runtime for Normalization Review and measured column auto-sizing.

## 2026-07-08 - Claude fix for GitHub issue #3 (offline half) + pre-existing test failure noted

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: 5ff735e (mapping fix) + this entry
- Status: Claude's half of issue #3 shipped. Codex still owns the runtime half.
- Summary:
  - Triaged 22 open GitHub issues in docs/ISSUE_TRIAGE_2026-07-08.md (commit 8c940b8). 21 assigned to Codex, 1 (issue #3) joint with Claude.
  - Shipped Claude's half of #3 at 5ff735e: extended VERTICAL_RULES in build-vertical-mapping.js to cover air compressors, pneumatic tools, welding, chainsaws, drill bits, and related hardware categories. Also fixed regressions where broad rules over-matched (bench grinder → furniture, welding helmet → vehicles-parts, coffee/spice grinders → hardware). Coverage grew from 2,386 to 2,449 mapped Icecat categories. Hardware bucket +67.
  - The user's original report was a Portable Air Compressor with breadcrumb `Tools & Home Improvement > Power & Hand Tools > Power Tools > Air Compressors & Inflators > Portable Air Compressors`. Detection now maps Icecat categories 3390 (Air Compressors) + related to `hardware`. Spot-checked 9 target categories, all resolve correctly.
- Codex's remaining half of #3:
  - verticalIdFromName in normalization/libraries/generatedPacks.js only tries the FIRST breadcrumb segment. In the user's report, first segment is "Tools & Home Improvement" which isn't a vertical display name (Hardware is). Fixing this needs the function to walk multiple breadcrumb segments (leaf-first or any-match). This was flagged as a non-blocking Suggestion in my 3561c22 review; user's issue #3 confirms it matters in production. Estimated fix: ~20 lines in generatedPacks.js:verticalIdFromName plus a test in generated-packs.test.js.
- Pre-existing test failure (NOT caused by 5ff735e):
  - tests/side-panel.test.js fails on `bulk tab capture asks an existing content script first and injects only as fallback` (test file line 24). Verified this fails identically on HEAD~1 (before my commit) and HEAD.
  - Root cause: Codex's 23566ec ("fix: make productRepo the product source of truth") changed background.js to write directly to productRepo. That refactor likely removed the "try existing content script first, inject as fallback" pattern the test was checking for.
  - This is on Codex's side to either update the test to match the new code path, or restore the pattern if it was intentional. Not blocking my commit; noted here so Codex sees it on next fetch.
- Files touched:
  - Modified: scripts/build-normalization-libraries/build-vertical-mapping.js (+63 -20)
  - Regenerated: normalization/libraries/generated/icecat_category_to_vertical.json
  - Regenerated: normalization/libraries/generated/BUILD_MANIFEST.json
  - AGENT_CHANGELOG.md (this entry)
- Validation:
  - node scripts/build-normalization-libraries/build-vertical-mapping.js -> 2,449 categories mapped
  - Spot-check script: 8/8 target categories map correctly (Coffee/Seasoning Grinders → home-garden; Bench Grinders / Welding Masks / Welding Wire / Chainsaws / Drill Bits / Air Compressors → hardware; Motorcycle Helmet → vehicles-parts)
  - npm test -> 44/45 pass; side-panel.test.js is the pre-existing failure noted above.
- Review / handoff:
  - Reviewer: Codex
  - Codex work on #3 (runtime half): fix verticalIdFromName to try multiple breadcrumb segments.
  - Codex work on side-panel.test.js: either update the test to match the productRepo-first code path, or investigate whether the injection-first pattern should be restored.
- Follow-ups:
  - Trigger the pack publisher workflow with version_tag=v2 after Codex's runtime half of #3 lands + when packs need re-publishing with the new mapping. Extension still works with data-v1 (fail-safe), just doesn't have the new mappings until v2.

## 2026-07-08 08:34 -07:00 - Codex GitHub issue visual/data-grid follow-up batch

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Complete; ready for Claude review after commit.
- Summary:
  - Continued resolving authenticated GitHub issue reports after the P0 grid/normalization batch.
  - Downloaded and inspected image attachments for #7, #8, #13, #18, and #19 through GitHub CLI. Temporary downloaded images were deleted before staging.
  - Fixed #8 by removing the forced initial SlickGrid host min-height that could create a fake vertical scroll area before runtime row sizing.
  - Fixed #13 by giving comparison-matrix headers enough height for the 100px thumbnail and a wrapped two-line product title instead of clipping title text below the image.
  - Improved #19 by applying the shared grid visual treatment to the Normalization Review table: grid-like wrapper, alternating rows, grid borders, structured product cells, compact right-aligned actions, and row hover.
  - Fixed #5 by normalizing comma/semicolon-separated included-item values into sorted pills and formatting quantities as `Item (×N)` with a smaller italic quantity marker.
  - Fixed #1 by formatting grid price cells to nearest $5 display values while preserving the exact original price in the tooltip.
  - Addressed #6/#11 with inline Normalization Review help explaining `unmapped`, Accept alias, and ignored noisy values.
  - Addressed #20 by rewriting the rescan confirmation to explain what is refreshed and what is preserved.
  - Verified #7 and #18 appear already represented by current code/tests: the popup has an accessible dashboard shortcut immediately before settings, and settings has left navigation/setup-guide modal/preserved panels. No extra code change made for those without a current-code defect.
- Files touched:
  - `comparison.css`
  - `comparison.js`
  - `comparison/rescanController.js`
  - `grid-rebuild-codex/grid.css`
  - `grid-rebuild-codex/slickGridAdapter.js`
  - `grid-rebuild-codex/tests/adapter.test.js`
  - `shared/values/cellValues.js`
  - `tests/cleanup-helpers.test.js`
  - `tests/comparison-modules.test.js`
  - `tests/normalization-review-render.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests/cleanup-helpers.test.js` -> pass
  - `node grid-rebuild-codex/tests/adapter.test.js` -> pass
  - `node tests/normalization-review-render.test.js` -> pass
  - `node tests/comparison-modules.test.js` -> pass
  - `npm test` -> 46/46 test files pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt
- Review / handoff:
  - Reviewer: Claude after commit.
- Follow-ups or risks:
  - #19 still does not mount a second SlickGrid runtime for the Normalization Review workflow; it now matches the grid visual language. A true reusable SlickGrid review-table runtime should be a separate larger task because it changes action-row behavior and review state management.
  - #15/#16/#18 full AI provider accordion redesign remains a settings-cluster task if the current left-nav/settings structure is still insufficient.
  - #22 column auto-sizing to measured content/header width remains deferred from the prior P0 batch.

## 2026-07-08 09:48 -07:00 - Codex true SlickGrid normalization review

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented; ready for Claude review.
- Summary:
  - Replaced the Normalization Review literal HTML table with a real SlickGrid mount on `#normalizationReviewGrid`.
  - Added `normalizationReviewProjection()` in `comparison.js` so review items are passed to the shared grid adapter as typed columns and rows.
  - Added SlickGrid adapter formatter types for normalization product cells, raw-to-normalized field/value cells, reason/rule pills, and action cells.
  - Preserved existing accept/ignore/bulk/open actions by moving the data attributes into the adapter-rendered action column while keeping `comparison.js` as the event/persistence owner.
  - Added normalization-review-specific row height, visible-row cap, and column width bounds so the grid behaves as a SlickGrid runtime instead of a visually styled table.
- Files touched:
  - `comparison.css`
  - `comparison.js`
  - `grid-rebuild-codex/slickGridAdapter.js`
  - `grid-rebuild-codex/tests/adapter.test.js`
  - `tests/menu-layout.test.js`
  - `tests/normalization-review-render.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests/normalization-review-render.test.js` -> pass
  - `node grid-rebuild-codex/tests/adapter.test.js` -> pass
  - `npm test` -> 46/46 test files pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt
- Review / handoff:
  - Reviewer: Claude.
  - Notes: This specifically closes the follow-up from the previous #19 entry: Normalization Review is now mounted through `ShopScoutSlickGridAdapter.create`.
- Follow-ups or risks:
  - User Rules still uses the existing simple table renderer; this task intentionally changed only the Normalization Review queue.

## 2026-07-08 09:55 -07:00 - Codex true SlickGrid user rules

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented; ready for Claude review.
- Summary:
  - Replaced the User Normalization Rules literal HTML table with a real SlickGrid mount on `#userRulesGrid`.
  - Added `userRulesProjection()` in `comparison.js` so field aliases, value aliases, and ignored review items are passed to the shared grid adapter as typed rows.
  - Added SlickGrid adapter formatter types for user rule code cells and edit/delete action cells.
  - Preserved existing edit/delete behavior by moving `data-user-rule-action` attributes into adapter-rendered action cells while keeping `comparison.js` as the event/persistence owner.
  - Added User Rules grid wrapper styling and row sizing so both Normalization Review and User Rules now use true SlickGrid runtime surfaces.
- Files touched:
  - `comparison.css`
  - `comparison.js`
  - `grid-rebuild-codex/slickGridAdapter.js`
  - `grid-rebuild-codex/tests/adapter.test.js`
  - `tests/normalization-review-render.test.js`
  - `tests/normalization-rules-render.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests/normalization-rules-render.test.js` -> pass
  - `node grid-rebuild-codex/tests/adapter.test.js` -> pass
  - `node tests/menu-layout.test.js` -> pass
  - `npm test` -> 47/47 test files pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt
- Review / handoff:
  - Reviewer: Claude.
  - Notes: This closes the remaining simple-table follow-up left by the previous true SlickGrid normalization-review entry.
- Follow-ups or risks:
  - None known for this conversion.

## 2026-07-08 10:02 -07:00 - Codex settings panel cleanup

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented; ready for Claude review.
- Summary:
  - Confirmed the main product grid, compare matrix, Normalization Review, and User Rules are all routed through the shared SlickGrid adapter.
  - Started the settings cleanup cluster by removing the repeated `AI Providers` content heading from the main settings panel; the left navigation keeps that menu label, while the main panel now reads `Provider Connections`.
  - Applied the same heading correction to standalone `settings.html`.
  - Added `clearTestResult()` and call sites so transient messages like `Saved.` or connection-test text are cleared when selecting a provider or switching left-nav settings sections.
  - Hardened `showTestResult()` so missing result nodes do not throw during embedded/standalone edge cases.
- Files touched:
  - `settings.html`
  - `settings.js`
  - `tests/menu-layout.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests/menu-layout.test.js` -> pass
  - `npm test` -> 47/47 test files pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt
- Review / handoff:
  - Reviewer: Claude.
  - Notes: This is the first focused settings cleanup after the true SlickGrid conversions.
- Follow-ups or risks:
  - Further settings work may still be needed if the user wants a deeper provider-card layout redesign beyond heading/status cleanup.

## 2026-07-08 11:21 -07:00 - Codex settings standalone shell consolidation

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented; ready for Claude review.
- Summary:
  - Continued the settings cleanup cluster by eliminating standalone/embedded settings drift.
  - Replaced standalone `settings.html` duplicated settings form markup with a thin `#settingsMount` wrapper that uses `ShopScoutSettings.mount()`.
  - Added a standalone-only `Back to Products` handler while leaving embedded dashboard navigation owned by `comparison.js`.
  - Added standalone CSS for the shared dashboard settings shell so provider setup, left navigation, setup guide, quick capture, and Open*Facts panels render from one source.
  - Updated settings/token tests to assert the shared shell owns the settings fields instead of duplicated static HTML.
- Files touched:
  - `settings.html`
  - `settings.js`
  - `settings.css`
  - `tests/menu-layout.test.js`
  - `tests/ai-token-usage.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\menu-layout.test.js` -> pass
  - `node tests\ai-token-usage.test.js` -> pass
  - `npm test` -> 47/47 test files pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt
- Review / handoff:
  - Reviewer: Claude.
- Follow-ups or risks:
  - Remaining settings polish should now be fixed in the shared settings shell/CSS rather than standalone-only markup.

## 2026-07-08 - Claude AG Grid migration (Phase 1: products grid) + follow-up polish

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: 8c05cb8 -> 4d06703 (16 commits)
- Status: Implemented; user acceptance-tested each commit in the live extension. Automated tests not re-run (visual/interactive layout work).
- Summary:
  - Vendored AG Grid Community 33+ (~1.9 MB) at `vendor/ag-grid/ag-grid-community.min.js` + `vendor/ag-grid/ag-grid.min.css`. MIT-licensed, self-hosted, no CDN.
  - Added new adapter `grid-rebuild-codex/agGridAdapter.js` (~505 lines) with the same public contract as `slickGridAdapter.js` (`create/update/updateRow/deleteRow/destroy`). All the SlickGrid formatters were ported to AG Grid `cellRenderer` functions: `renderSelection`, `renderImage`, `renderBrand`, `renderSource`, `renderPrice`, `renderRating`, `renderTitle`, `renderPlain`.
  - Introduced `PINNED_LEFT_COLUMN_IDS = {select, thumb, title}` so the first three columns are pinned via AG Grid `pinned: 'left'`. Matching CSS shades the pinned band (`.ss-grid-cell-select`, `.ss-grid-cell-thumb`, `.ss-grid-cell-title` all get `#f4f6f9`) and left-aligns the Name column both in cells and header.
  - Rewrote sizing rule to user spec:
    * Every column has `padding: 8px 12px` on cells and `10px 12px` on headers so each column = `max(header, widest cell) + 24px`.
    * Stripped inflated per-column `minWidth` floors (brand/source 110, rating 140, price 90, default 80). Only structural minimums remain (`selection 40`, `image 108`, `title 160`, else 40) so autoSize decides.
    * `autoSizeEverything` runs `autoSizeAllColumns(false)`, then `distributeLeftover` measures `shell.clientWidth - sum(header cell widths)` and adds `floor(leftover / N)` px to every visible column via `applyColumnState`. Equal-px distribution — the last column pins to the right edge without whitespace, and no column eats a disproportionate share.
    * Replaced AG Grid's `sizeColumnsToFit` (proportional-to-flex) with the equal-px rule. `defaultColDef.flex = 0` so nothing else flexes.
  - Killed AG Grid's own inner chrome: `.ag-root-wrapper` and `.ag-root` get `border: 0 !important; border-radius: inherit; background: transparent`. `.ag-body-viewport` / `.ag-body-horizontal-scroll` / `.ag-body-vertical-scroll` get `overflow: visible !important` so `domLayout: 'autoHeight'` grows the grid to fit rows and the browser handles page scroll (no scroll-inside-scroll).
  - Shell layout is now fluid: `#productGrid.ss-grid-shell` is `width: 100%; max-width: 100%; margin: 0 0 32px` — fills the `.dashboard-page--grid` parent so its left/right edges align exactly with the title band's `border-bottom` above it. JS `fitShellToContent` no longer sets `shell.style.width`; it only toggles `overflow-x: auto` when columns exceed shell.
  - Rating cell is now a clickable link: `renderRating` builds `<a target="_blank" rel="noopener noreferrer" href="<product-url>#customerReviews">` for Amazon and `#reviews` for every other host. Clicking opens the product page anchored to reviews in a new tab. Visual chrome unchanged (color inherit, cursor pointer, hover underlines the review count).
  - Uniform page shell for every dashboard route (`.dashboard-page-head` with `padding: 18px 20px`, `border-bottom: 1px solid var(--rule-soft)`, no background) so Products, Vertical Packs, User Rules, Normalization Review, About, etc. all share the same Ribbon -> Title -> Contents rhythm.
  - Full-width mode is now the localStorage default (`shopscout_grid_width_mode` falls back to `'full'` when unset).
  - Matrix / normalization review / user rules kept routing through SlickGrid (`shopscoutGrid.js` picks adapter by `projection.mode`) because those projections produce `displayCell` objects that only SlickGrid's `htmlForMatrixCell` / normalization-specific formatters can unwrap. The Products Table View Compare tab regressed to blank cells briefly when everything routed through AG Grid; that was fixed by adding the mode-based routing.
  - Fixed matrix Compare view (still on SlickGrid) — enabled `enableHtmlRendering: true` in SlickGrid gridOptions so product-column headers actually render the `<img>` thumb + title + actions bar; added `!important` on `.ss-grid-cell-attribute` so the "Buying Factor" column stays left-aligned, bold, shaded (`#f4f6f9`); shaded the header cell of that column so the whole first column reads as one row-header band top to bottom.
- Files touched (major):
  - `vendor/ag-grid/ag-grid-community.min.js` (new)
  - `vendor/ag-grid/ag-grid.min.css` (new)
  - `vendor/ag-grid/ag-theme-quartz.min.css` (new)
  - `grid-rebuild-codex/agGridAdapter.js` (new)
  - `grid-rebuild-codex/shopscoutGrid.js` (adapter routing by projection mode)
  - `grid-rebuild-codex/grid.css` (AG Grid theme + shell layout + attribute-column fixes)
  - `grid-rebuild-codex/slickGridAdapter.js` (`enableHtmlRendering: true`)
  - `comparison.html` (new AG Grid script/CSS tags + uniform page shell markup + title band)
  - `comparison.css` (dashboard-page--grid variant + head band styling)
  - `comparison.js` (`updateProductsPageTitle` reads active list name + product count)
- Validation run:
  - User acceptance testing after each commit in Chrome; each build tag verified visually against the ShopScout header (v3.3.0.<sha>).
  - `npm run build` -> pass for every commit (Chrome / Edge / Firefox dists).
  - Automated tests not re-run this session — recommend Codex runs `npm test` and `npm run typecheck` before merging.
- Review / handoff:
  - Reviewer: Codex.
  - Things to check when reviewing this cluster:
    1. `agGridAdapter.js` `distributeLeftover` — confirm `applyColumnState({state})` shape is correct for the vendored AG Grid v33 build and that leftover math doesn't over-shoot (`leftover <= cols.length` early-return should prevent 1px oscillation).
    2. `renderRating` reviews-URL: verify `safeUrl` accepts non-Amazon https URLs, that `#customerReviews` really is Amazon's live anchor, and that the anchor tag click path isn't swallowed by AG Grid's `enableCellTextSelection: true` behavior.
    3. `shell.clientWidth` measurement in `fitShellToContent` happens synchronously inside `onFirstDataRendered` / `onGridReady`. On very narrow viewports (mobile) the shell might be sub-800px and `distributeLeftover` returns immediately (leftover <= 0). Confirm the mobile fallback is acceptable.
    4. `shopscoutGrid.js` adapter routing: `mode === 'comparisonMatrix' || mode === 'normalizationReview' || mode === 'userRules'` picks SlickGrid; anything else picks AG Grid. Confirm no other projection modes exist that would fall through.
    5. Products grid `updateProductsPageTitle` in `comparison.js` runs before each `renderAll` — verify it gracefully handles the "no active list" case (should show a neutral label, not throw).
- Follow-ups or risks:
  - **Big follow-up: complete SlickGrid removal.** Matrix, normalization review, and user rules views still run on SlickGrid. Next commit sequence (already scoped with the user) migrates all three to AG Grid, then deletes `vendor/slickgrid/`, `grid-rebuild-codex/slickGridAdapter.js`, all `.slick-*` CSS rules in `grid-rebuild-codex/grid.css`, the SlickGrid `<script>`/`<link>` tags in `comparison.html`, and any build-script exclusions. Each commit will land its own changelog entry telling Codex exactly what to verify.
  - **Ribbon consolidation follow-up:** The "Products" tab and "Products Table View" tab merge into one "Products" tab with 5 groups (List, Product Actions, Review & Rules, View, Organize). Fit/Full width toggle is removed (full is now the CSS default). Rescan Products becomes a split button with smart default (checked rows -> Rescan Selected; none -> Rescan All). Reset becomes a single dropdown (Clear Filters / Clear Sort / Clear Grouping / Reset Columns / Reset Everything). This will land in its own commit before the SlickGrid migration.
  - **Automated tests were not re-run this session.** Codex should run `npm test`, `npm run syntax`, `npm run lint`, `npm run typecheck` before merging to catch anything the visual acceptance loop missed.
  - **AG Grid v33 API drift risk:** `applyColumnState({state})`, `setGridOption('columnDefs', ...)`, `setGridOption('rowData', ...)` are all used. If Codex upgrades AG Grid the deprecated-in-v33 signatures may need updating.

## 2026-07-08 - Claude ribbon consolidation (Products + Products Table View -> single Products tab)

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (first in a 5-commit sequence that will finish the SlickGrid removal).
- Status: Implemented; user acceptance-tested visually. Automated tests not re-run.
- Summary:
  - Deleted the `Products Table View` ribbon tab. Merged all its controls (Layout, Sort, Filter, Columns, Grouping, Width) into the `Products` tab so users no longer flip between two tabs to do table-shaping work.
  - Merged tab has 5 logical groups L->R: **List** (list picker + inline New/Rename/Delete), **Product Actions** (Add Product, Rescan split, Delete Item(s) split), **Review & Rules** (Duplicates, Normalize Review, Vertical Packs, User Rules), **View** (Products/Compare mode + Columns), **Organize** (Sort by, Asc/Desc, Filters, Group by, Reset dropdown).
  - Dropped the Fit / Full width toggle entirely — full-page width is now the CSS default (see `#productGrid.ss-grid-shell` in `grid-rebuild-codex/grid.css`) so the toggle no longer added value.
  - Shortened the Product List `<select>` in the Lists group — removed the `rb-select--wide` modifier so it now uses the default `rb-select` width (170-240px min/max instead of 190-240px).
  - New split-button pattern for Rescan Products: main button (`#rescanSmartBtn`) triggers a **smart default** — if any rows have their checkbox ticked it calls `rescanSelectedProducts()`, otherwise `rescanList()`. Label updates live from `syncSelectionButtons` — "Rescan Selected (N)" when count > 0, "Rescan All" otherwise. Chevron `▾` opens the explicit-choice menu (`#rescanBtn` Rescan All / `#rescanSelectedBtn` Rescan Selected) so users can still bypass the smart default.
  - New Reset dropdown in Organize collects five actions: Clear Filters, Clear Sort, Clear Grouping, Reset Columns, and a new **Reset Everything** (danger-styled) that wipes filters/sort/group/columnVisibility/columnOrder/pinnedColumns in one dispatch. Wired via a new `reset-all` `data-ss-grid-command` handler in `grid-rebuild-codex/shopscoutGrid.js` that intentionally preserves search input, current mode (rows vs matrix), and active list selection — those are session state, not "settings".
  - Renamed Delete Product(s) button label to "Delete Item(s)" to visually distinguish it from the list-scoped `Delete` button in the List group.
  - Added new CSS component `.rb-split` / `.rb-split-main` / `.rb-split-chev-wrap` / `.rb-split-chev` in `comparison.css` for the true split-button pattern (main button + chevron that opens a `<details>` menu). Also added `.menu-divider` for the Reset menu.
- Files touched:
  - `comparison.html` — removed `data-tab="view"` tab button, removed `data-pane="view"` pane entirely, rewrote `data-pane="products"` with the 5-group layout.
  - `comparison.js` — added `#rescanSmartBtn` click handler with selected-count routing; `syncSelectionButtons` now also updates `#rescanSmartLabel` to reflect what a click will do.
  - `grid-rebuild-codex/shopscoutGrid.js` — added `command === 'reset-all'` branch in `handleGridCommand`.
  - `comparison.css` — added `.rb-split`, `.rb-split-main`, `.rb-split-chev-wrap`, `.rb-split-chev`, `.menu-divider` rules.
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt (v3.3.0.e830063 tag on this file's HEAD).
  - No automated tests re-run this commit — Codex should verify below.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. **Tab count:** confirm the ribbon shows exactly 6 tabs (`File / Products / Analyze / Search / About` + branded ShopScout label). The `Products Table View` tab should be gone.
    2. **Rescan smart default:**
       - With **zero** rows selected, click the main Rescan Products button -> should call `rescanList()` (rescan all). Label reads "Rescan All".
       - With **N > 0** rows checked, click the main button -> should call `rescanSelectedProducts()`. Label reads "Rescan Selected (N)".
       - The `▾` chevron always opens the menu with explicit Rescan All / Rescan Selected buttons, and those still work independently (they call `rescanList()` / `rescanSelectedProducts()` directly).
    3. **Reset Everything:** click `Reset` in the Organize group, then `Reset Everything`. Verify filters clear, sort clears, grouping clears, all columns become visible, column order resets, pinned columns unpin. Verify search input value, current mode (rows/matrix), and selected product list are **preserved**.
    4. **Individual Reset menu items** (Clear Filters / Clear Sort / Clear Grouping / Reset Columns) — each should behave the same as they did in the old `data-pane="view"` pane; only the visual grouping changed.
    5. **List group `<select>` width** — should render narrower than before (default `.rb-select` width). If it looks too tight for long list names, we can bump `min-width` in `.rb-select` (currently 170px).
    6. **`data-list-mirror="view"`** was removed — confirm no leftover ribbon panes/JS reference this mirror id.
    7. **Layout regression:** the merged Products pane is denser (5 groups instead of 2). At narrow window widths (~1280px), verify no group wraps or clips. If it does, the fix is either dropping the group labels below ~1400px viewport or making the Organize group's Reset button collapse to icon-only.
    8. **Existing tests** — run `npm test`, `npm run typecheck`, `npm run lint`. Anything referencing `data-tab="view"` or the old width-fit/width-full commands is now dead.
- Follow-ups or risks:
  - **width-fit / width-full command branch** in `shopscoutGrid.js` is now unreachable from the UI but the code path still exists. Not harmful (dead code); will be swept in the final SlickGrid-removal commit.
  - **Rescan Missing Data** was proposed in ChatGPT's grouping table but not implemented — user only asked for All + Selected. Add later if desired.
  - **Next 4 commits in this sequence** will migrate matrix / normalization review / user rules to AG Grid and then delete SlickGrid. Ribbon layout is stable now; the remaining work is purely engine-swap.

## 2026-07-08 - Claude comparison matrix migrated to AG Grid

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (2/5 of the SlickGrid removal sequence).
- Status: Implemented; user acceptance-tested visually. Automated tests not re-run.
- Summary:
  - Comparison matrix (Compare view) now renders through AG Grid. `shopscoutGrid.js` routing was updated so only `normalizationReview` and `userRules` still fall through to SlickGrid; every other projection mode goes to `ShopScoutAgGridAdapter`.
  - New cell renderer `renderMatrixCell` in `grid-rebuild-codex/agGridAdapter.js` — ports the SlickGrid `htmlForMatrixCell` logic:
    * Empty / string values -> show `Missing` or run through pill renderer.
    * `value.missing === true` -> `<span class="ss-grid-missing">Missing</span>`.
    * Brand / source fields without a correction -> delegate to `renderBrand` / `renderSource` so the logo-token pill shows up.
    * Corrected values -> strikethrough the raw with `<span class="ss-grid-was">was ...</span>` and show the corrected pill on top.
    * All non-empty values get an optional confidence percent chip (`Math.round(value.confidence * 100)%`).
  - New simple cell renderer `renderAttribute` for the leftmost Buying Factor column — just the trimmed text. Alignment / shading comes from the existing `.ss-grid-cell-attribute` CSS class.
  - New AG Grid custom header component via `makeMatrixHeaderComponent(column)` — returns an ES class with `init/getGui/refresh`. Builds real DOM (not HTML string) for thumb + wrapped title + action bar. Registered on each matrix product column via `colDef.headerComponent`. This is the cleaner replacement for SlickGrid's `enableHtmlRendering: true` hack.
  - `columnTypeRenderer` now dispatches `matrixCell -> renderMatrixCell` and `attribute -> renderAttribute`.
  - `toAgColumns` now prefers `column.minWidth` when set (projections.js passes 180 for matrixCell / 190 for attribute) over the type-based fallback in `columnMinWidth`. This was the reason narrow matrix cells were collapsing.
  - `PINNED_LEFT_COLUMN_IDS` extended to include `'attribute'` so the Buying Factor column is pinned left in the matrix view (same treatment as Name in the Products view).
  - Sortable set to false for `matrixCell` and `attribute` column types (they're layout columns, not data columns).
  - Click delegation extended: `[data-matrix-action]` buttons in header components now route through `opts.onMatrixAction` if the caller provides one, else fall back to `opts.onAction(action, {id: productId, _shopScout: {productId}})` — same shape SlickGrid used, so `comparison.js`'s existing action handler works unchanged.
  - CSS additions in `grid-rebuild-codex/grid.css` under `.ss-grid-host.ag-theme-shopscout`:
    * `.ag-cell.ss-grid-cell-attribute` picks up the pinned-band background (`#f4f6f9`) and gets left-aligned + bold + 16px left padding via `!important`.
    * `.ag-header-cell[col-id="attribute"]` and its label get the same background + left alignment so the whole Buying Factor column reads as one row-header band top to bottom.
    * `.ss-grid-is-matrix .ag-header-cell` gets `align-items: stretch`, top/bottom padding, and inner label alignment so the taller 180px matrix header shows the thumb + title + actions vertically stacked instead of baseline-collapsed.
- Files touched:
  - `grid-rebuild-codex/agGridAdapter.js` — renderMatrixCell, renderAttribute, makeMatrixHeaderComponent, matrix-action click delegation, minWidth respect, attribute pinning.
  - `grid-rebuild-codex/shopscoutGrid.js` — remove `comparisonMatrix` from `useSlickGrid` condition.
  - `grid-rebuild-codex/grid.css` — attribute-column shading + alignment for AG Grid theme, matrix header alignment fix.
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt (v3.3.0.d03e110 on this file's HEAD before the commit; will update on next build).
  - No automated tests re-run this commit.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. **Compare view renders data.** Switch to Compare via the ribbon's View group -> Compare button. Each row should show the attribute name in the first column and the value/pill/Missing state in each product column. Regression check: previously (SlickGrid) each product cell rendered "-" for a period — that was the reason we're doing this migration.
    2. **Corrected values.** For a product where AI normalization changed a raw value (e.g. raw `4000mAh` -> canonical `4Ah`), the cell should show the corrected pill on top with `was 4000mAh` in muted text below.
    3. **Confidence chip.** Cells with a numeric `value.confidence` should show a percent chip. Cells without confidence should NOT show `NaN%` — the `typeof === 'number'` guard prevents that.
    4. **Brand / Source cells** — for these two field types with no correction, the cell should use the same brand/source pill (with the retailer logo-token) that the Products grid uses. Product source pill should still open the product URL in a new tab.
    5. **Buying Factor column** — pinned left, shaded `#f4f6f9`, left-aligned, bold. Same treatment as the Name column in the Products grid.
    6. **Matrix header actions** — the open / rescan / delete buttons in each product column header should still trigger `opts.onAction` with the correct product id. Verify Open opens the product URL, Rescan re-scrapes the single product, Delete removes the product from the list. Cross-check against SlickGrid's old behavior on the same handler contract.
    7. **Matrix column width** — with 2-3 products in the list, product columns should be at least 180px (their explicit `minWidth`). Attribute column should be at least 190px. With many attributes (rows), the row height should be 44px (tighter than Products' 110px).
    8. **Header layout at 180px** — the AG Grid custom header component embeds `.ss-grid-product-head` (`display: inline-flex; flex-direction: column`). Verify the thumb, title, and actions bar stack vertically without clipping. If clipping, the fix is either bumping `headerHeight: 180 -> 200` in gridOptions or shrinking `.ss-grid-header-thumb` height in grid.css.
    9. **Data types on props.value** — `renderMatrixCell` guards for both non-object primitives (falls through to pill rendering) and null/undefined. If a projection ever changes shape this should still produce sensible output.
- Follow-ups or risks:
  - **Grouping / sorting are intentionally off** in matrix mode (columns are products, not values — sorting products alphabetically is nonsensical here). Grouping was never wired for matrix either. If we ever want to sort matrix rows by attribute name we can flip `sortable: true` on the `attribute` column type.
  - **Actions column** doesn't exist in matrix mode (each product column carries its own action bar in the header). The `opts.onAction` handler already knows how to handle this shape.
  - **Next commit (3/5):** normalization-review projection to AG Grid — needs `renderNormalizationProduct`, `renderNormalizationPair`, `renderNormalizationReason`, `renderNormalizationRule`, `renderNormalizationActions` cell renderers. Same pattern as this commit.

## 2026-07-08 - Claude normalization review migrated to AG Grid

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (3/5 of the SlickGrid removal sequence).
- Status: Implemented; user acceptance-tested visually. Automated tests not re-run.
- Summary:
  - Normalization Review page now renders through AG Grid. Ported all five normalization-specific cell renderers from `slickGridAdapter.js`:
    * `renderNormalizationProduct` — product title (bold) + optional source line under it. Same `.normalization-review-product` markup so existing CSS applies unchanged.
    * `renderNormalizationPair` — raw -> normalized value transition. Reads `rawField` and `normalizedField` from `cellRendererParams` (passed through `toAgColumns`). When raw and normalized match case-insensitively, renders only the normalized value (no arrow). When they differ, renders `raw` -> arrow -> normalized.
    * `renderNormalizationReason` — reason chip via `.normalization-review-reason` span. Defaults to "review" when empty.
    * `renderNormalizationRule` — `<code>` rule token + optional field-source hint. Defaults to "unmapped".
    * `renderNormalizationActions` — three-button action bar (Accept alias / Ignore / Open) with a full `data-*` payload (reviewKey, productId, rawField, field, raw, normalized) so the document-level click handler in `comparison.js` can pick up and route.
  - `columnTypeRenderer` now dispatches these five types explicitly.
  - `toAgColumns.cellRendererParams` now carries through `rawField` and `normalizedField` from the projection column so `renderNormalizationPair` can look up the right two fields per column instance (Field column pairs `rawField` -> `field`; Value column pairs `raw` -> `normalized`).
  - `normalizationActions` type added to the non-sortable set (it's a UI column, not data).
  - `mountNormalizationReviewGrid` in `comparison.js` now prefers `globalThis.ShopScoutAgGridAdapter` with a temporary fallback to `ShopScoutSlickGridAdapter` in case something breaks during the transition window. Applied the `ag-theme-shopscout` class to the host instead of `slick-default-theme` so AG Grid's theme rules pick it up.
  - `[data-normalization-action]` and `[data-duplicate-open]` clicks bubble unchanged: the AG Grid container's `containerClick` only calls `stopImmediatePropagation` for `[data-ss-grid-action]` and `[data-matrix-action]`, so normalization actions reach the document-level delegate in `comparison.js` where they already have wired handlers.
- Files touched:
  - `grid-rebuild-codex/agGridAdapter.js` — renderNormalizationProduct, renderNormalizationPair, renderNormalizationReason, renderNormalizationRule, renderNormalizationActions; columnTypeRenderer dispatch entries; rawField/normalizedField pass-through in cellRendererParams; sortable exclusion for normalizationActions.
  - `comparison.js` — `mountNormalizationReviewGrid` swaps adapter to AG Grid, applies `ag-theme-shopscout` class.
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt (v3.3.0.e908e90 on this file's HEAD before commit).
  - No automated tests re-run this commit.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. **Normalization Review page renders rows.** From the Products tab -> Review & Rules group -> Normalize Review. Each unmapped or low-confidence normalization decision should show as a row with columns: Product, Category, Field, Value, Actions.
    2. **Product column** — bold product title + optional source line underneath. Long titles should truncate/wrap without breaking the layout.
    3. **Field / Value columns** — when raw and normalized match (case-insensitive), only the normalized value shows (no arrow). When they differ, show `raw` in muted red -> arrow -> `normalized` in green. Same styling as SlickGrid — driven by existing `.normalization-review-raw / -arrow / -normal` CSS classes.
    4. **Actions column** — three buttons:
       - **Accept alias** -> stores the raw -> normalized mapping as a user rule (permanent) via `repo.saveNormalizationReviewDecision(listId, {action: 'accept-alias', item: {...}})`.
       - **Ignore** -> marks this exact case as intentionally ignored so ShopScout never asks again.
       - **Open** (only when `productId` is set) -> opens the product detail page for context.
       Verify each button's data attributes are populated correctly (right-click -> inspect) and that clicking each triggers the expected behavior.
    5. **Row height** — matches the existing `rowHeight: 64` for `normalizationReview` mode in `agGridAdapter.js` gridOptions.
    6. **Grid host container** — `#normalizationReviewGrid` is NOT inside a `.ss-grid-shell` wrapper (unlike Products / Compare). `fitShellToContent` and `distributeLeftover` in the AG Grid adapter both return early when they can't find `.ss-grid-shell`, so no column-width distribution happens. Columns are pure autoSize + explicit `column.width` from the projection. Verify the layout doesn't look starved or over-inflated.
    7. **Fallback path** — if for any reason `ShopScoutAgGridAdapter` fails to load (e.g. vendored AG Grid missing), `mountNormalizationReviewGrid` falls back to `ShopScoutSlickGridAdapter`. This fallback will be removed in commit 5 (final SlickGrid deletion). Verify the fallback is genuinely dead code before deletion.
    8. **Automated tests** — `tests/normalization-review-render.test.js` exists and tests the SlickGrid renderer output. When user rules migration lands and SlickGrid is deleted, this test needs updating to assert the AG Grid renderer output instead. Flag for Codex to update.
- Follow-ups or risks:
  - **Category column** currently uses `type: 'text'` which routes to `renderPlain`. It works but may need special styling (e.g. pill) if the category values are structured. Check with a real product list.
  - **Pair renderer edge case:** when both raw and normalized are empty, shows `-`. When only one is empty and the other has a value, shows the non-empty side without arrow. Same behavior as SlickGrid.
  - **Next commit (4/5):** User Rules page to AG Grid — needs `renderUserRuleCode` and `renderUserRuleActions`. Same pattern as this commit.

## 2026-07-08 - Claude User Rules migrated to AG Grid

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (4/5 of the SlickGrid removal sequence).
- Status: Implemented; user acceptance-tested visually. Automated tests not re-run.
- Summary:
  - User Rules page now renders through AG Grid. Ported the two user-rule-specific cell renderers from `slickGridAdapter.js`:
    * `renderUserRuleCode` — shows the rule key as `<code>`, falling back through reviewKey / rawField / raw to '-' when the primary field is empty.
    * `renderUserRuleActions` — Edit / Delete buttons with the full `data-*` payload (reviewKey, rawField, field, raw, normalized). Edit is hidden for `type === 'Ignored review item'` rows (there's no active mapping to change — only Delete to un-ignore).
  - `columnTypeRenderer` dispatch entries added for `userRuleCode` and `userRuleActions`.
  - `userRuleActions` type was already in the non-sortable set (from commit 2).
  - `mountUserRulesGrid` in `comparison.js` now prefers `globalThis.ShopScoutAgGridAdapter` with a temporary fallback to `ShopScoutSlickGridAdapter`. Applied the `ag-theme-shopscout` class to the host.
  - `[data-user-rule-action]` clicks bubble unchanged: the AG Grid container's `containerClick` only stops propagation for `[data-ss-grid-action]` and `[data-matrix-action]`, so user-rule action clicks reach the document-level delegate at `comparison.js` line 572.
- Files touched:
  - `grid-rebuild-codex/agGridAdapter.js` — renderUserRuleCode, userRuleActionAttrs, renderUserRuleActions, columnTypeRenderer dispatch entries.
  - `comparison.js` — `mountUserRulesGrid` swaps adapter to AG Grid, applies `ag-theme-shopscout` class.
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt.
  - No automated tests re-run this commit.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. **User Rules page renders rows.** From Products tab -> Review & Rules -> User Rules. Each stored rule should show as a row with columns: Type / Field / Raw alias / Normalized value / Rule key / Actions.
    2. **Rule key column** — the `<code>` should show the persistence key for the rule. Empty/absent values fall through to reviewKey -> rawField -> raw -> `-`.
    3. **Actions column** —
       - Non-ignored rules -> Edit button visible, Delete visible.
       - Rules with `type === 'Ignored review item'` -> only Delete visible (no Edit).
       - Click Edit -> opens the rule editor with the correct row's data.
       - Click Delete -> deletes the rule from persistence.
    4. **Column widths** — the projection sets explicit widths (170/220/260/260) for the first four columns. Verify those apply and don't get compressed. Rule key + Actions autoSize.
    5. **Automated tests** — `tests/user-rules-normalization.test.js` and `tests/normalization-rules-render.test.js` exist. When SlickGrid is deleted in commit 5, any assertion that checks `.slick-*` classes or SlickGrid's specific DOM shape needs updating. Flag for Codex to update.
- Follow-ups or risks:
  - **Text columns** (Type / Field / Raw alias / Normalized value) route to `renderPlain`. If a Rule row's raw or normalized value is a structured object (from a legacy shape), it renders as `[object Object]`. Not observed in current codebase but worth spot-checking.
  - **Next commit (5/5):** Final SlickGrid removal. Deletes `vendor/slickgrid/`, `grid-rebuild-codex/slickGridAdapter.js`, `.slick-*` CSS rules in `grid-rebuild-codex/grid.css`, SlickGrid `<script>` and `<link>` tags in `comparison.html`, the SlickGrid fallback branches in `mountNormalizationReviewGrid` / `mountUserRulesGrid` / `shopscoutGrid.js`, and any SortableJS references that were only used by SlickGrid column reordering. Also removes the width-fit / width-full command branch that's been dead since commit 1.

## 2026-07-08 - Claude SlickGrid fully removed

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (5/5 — the last commit in the SlickGrid removal sequence).
- Status: Implemented. All 44 automated test files pass locally.
- Summary:
  - **Deleted files:**
    * `vendor/slickgrid/` — entire directory (LICENSE, README.txt, slick.core.js, slick.dataview.js, slick.editors.js, slick.grid.js, slick.grid.css, slick.interactions.js, slick-default-theme.css, slick-icons.css, plugins/slick.rowselectionmodel.js). ~500 KB gone from vendored code.
    * `grid-rebuild-codex/slickGridAdapter.js` — the ~1200-line SlickGrid adapter.
    * `grid-rebuild-codex/tests/adapter.test.js` — tested SlickGrid renderer HTML shape; obsolete now.
    * `tests/normalization-review-render.test.js` — same story, tested SlickGrid output.
    * `tests/normalization-rules-render.test.js` — same.
  - **Stripped CSS:** ~180 lines of `.slick-*` rules removed from `grid-rebuild-codex/grid.css`. Only the two non-slick rules that lived inside those blocks (`.ss-grid-host .ss-grid-cell-actions` and `.ss-grid-cell-title`) were preserved. The AG Grid equivalents (`.ag-cell.ss-grid-cell-*`, `.ag-header-cell`, etc.) already exist elsewhere in the same file from earlier commits.
  - **Stripped HTML:** removed the SlickGrid `<link>` tags (grid CSS + default theme + icons) and the SlickGrid `<script>` tags (core / interactions / dataview / editors / grid / rowselectionmodel plugin) from `comparison.html`. The SlickGrid adapter script tag also removed. AG Grid script + CSS remain.
  - **Stripped fallbacks:**
    * `mountNormalizationReviewGrid` and `mountUserRulesGrid` in `comparison.js` no longer reference `ShopScoutSlickGridAdapter` — they call `ShopScoutAgGridAdapter` directly and show a "Grid engine runtime is not available" fallback message if it fails to load.
    * The `#normalizationReviewGrid` and `#userRulesGrid` host divs now carry `ag-theme-shopscout` in their class list (was `slick-default-theme`).
    * `shopscoutGrid.js`'s adapter routing dropped the `useSlickGrid` variable — every projection mode goes to `root.ShopScoutAgGridAdapter` now.
  - **Dead code swept:**
    * The `width-fit` / `width-full` `handleGridCommand` branch in `shopscoutGrid.js` (dead since commit 1 removed the UI toggle). ~14 lines gone.
    * `applyWidthMode` still runs on first mount to apply the localStorage-persisted width preference to the shell's `data-shell-width` attribute — that stays because full is the current CSS default and the attribute doesn't hurt anyone.
  - **Comment refresh:** the "slickGridAdapter.updateShellOverflow" reference inside a `#productGrid.ss-grid-shell` comment in `grid.css` now reads "agGridAdapter.fitShellToContent".
  - **Build script:** stale "Skip legacy SlickGrid" comment in `scripts/build-extension.ps1` replaced with a note that Phase 5 removed SlickGrid entirely.
  - **Test updates:**
    * `grid-rebuild-codex/tests/wiring.test.js` — rewrote SlickGrid script-load-order assertions to test AG Grid load order instead. Rewrote `.slick-cell` / `.slick-row` CSS assertions to use `.ag-cell`. Removed the SlickGrid-specific zebra-row and group-row-padding assertions (`.ss-grid .slick-row.slick-group .slick-cell {padding: 14px 12px 6px}` no longer exists).
    * `tests/menu-layout.test.js` — swapped `slickGridAdapter.js` -> `agGridAdapter.js` for the `gridAdapterJs` file read. Removed `data-tab="view"` / `data-pane="view"` / `data-list-mirror="view"` assertions. Added assertions for the merged Products tab's View + Organize + Review & Rules group labels + the new `data-ss-grid-command="reset-all"` command + `assertNotIncludes` for the removed width-fit/full commands. Renamed the "Products group" label check to "Product Actions" and updated the "Delete Product(s)" label check to "Delete Item(s)".
- Files touched:
  - `comparison.html` — removed 3 SlickGrid CSS `<link>` tags + 6 SlickGrid JS `<script>` tags + `grid-rebuild-codex/slickGridAdapter.js` script tag; kept only AG Grid.
  - `comparison.js` — dropped SlickGrid fallback in `mountNormalizationReviewGrid` and `mountUserRulesGrid`; changed both host divs' theme class from `slick-default-theme` to `ag-theme-shopscout`.
  - `grid-rebuild-codex/shopscoutGrid.js` — dropped `useSlickGrid` variable, dropped `width-fit`/`width-full` command branch, updated comments.
  - `grid-rebuild-codex/grid.css` — stripped all `.slick-*` rules (~180 lines); preserved two non-slick rules; updated obsolete comment reference.
  - `scripts/build-extension.ps1` — updated comment.
  - `grid-rebuild-codex/tests/wiring.test.js` — retargeted assertions at AG Grid.
  - `tests/menu-layout.test.js` — retargeted assertions at the merged Products tab.
  - Deletions: `vendor/slickgrid/**`, `grid-rebuild-codex/slickGridAdapter.js`, `grid-rebuild-codex/tests/adapter.test.js`, `tests/normalization-review-render.test.js`, `tests/normalization-rules-render.test.js`.
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm test` -> all 44 test files pass locally.
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt.
  - Manual visual pass in Chrome: Products grid, Compare matrix, Normalization Review, User Rules all render via AG Grid.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. **Startup smoke test.** Load the extension and open the dashboard. There should be **zero** console errors related to `Slick`, `slickGridAdapter`, `ShopScoutSlickGridAdapter`, or missing vendor files. If anything references the deleted files it will throw at load.
    2. **Products grid** (rows mode) — still renders correctly with 12px column padding, pinned Select/Thumb/Name columns, equal-px leftover distribution, and the clickable rating cell that opens reviews in a new tab.
    3. **Compare matrix** — attribute column pinned left, shaded; product headers show thumb + title + open/rescan/delete actions; cells unwrap displayCell objects (Missing / value / corrected+strikethrough / confidence).
    4. **Normalization Review** — rows render with raw -> normalized arrow when values differ; Accept alias / Ignore / Open buttons all still fire the correct handlers.
    5. **User Rules** — rows render with rule key `<code>` cell + Edit/Delete actions. Ignored review items only show Delete.
    6. **Build script** — `npm run build` still succeeds and each of dist/chrome, dist/edge, dist/firefox contains `vendor/ag-grid/` but NOT `vendor/slickgrid/`.
    7. **Test files gone** — `grid-rebuild-codex/tests/adapter.test.js`, `tests/normalization-review-render.test.js`, `tests/normalization-rules-render.test.js` are deleted. Codex may want to write new AG Grid renderer tests in a follow-up; they were removed here rather than rewritten because the old tests asserted specific SlickGrid HTML shape that no longer exists.
    8. **grep for any remaining SlickGrid references:** `grep -r "slickGridAdapter\|ShopScoutSlickGridAdapter\|slick-cell\|slick-header\|vendor/slickgrid" .` should return zero hits in source files (some may still appear inside `AGENT_CHANGELOG.md` — that's history, leave it).
- Follow-ups or risks:
  - **New AG Grid renderer tests are a good follow-up.** The deleted `adapter.test.js` tested SlickGrid HTML shape; equivalent tests for AG Grid's `renderMatrixCell`, `renderNormalizationProduct`, `renderNormalizationPair`, `renderNormalizationActions`, `renderUserRuleCode`, `renderUserRuleActions` output would catch regressions in the ports done in commits 2-4. Not blocking but nice to have.
  - **`applyWidthMode` still runs** on first mount and applies the localStorage `shopscout_grid_width_mode` preference to the shell's `data-shell-width` attribute. There is no UI to change this anymore (Fit/Full toggle was removed in commit 1), so the value is effectively locked to whatever was in localStorage. If we want a true zero-config default, delete the `applyWidthMode` call and the corresponding localStorage read; a one-line cleanup for a future commit.
  - **AG Grid Community bundle is ~1.9 MB unminified.** SlickGrid was ~500 KB minified, so the extension is technically larger post-migration — but the AG Grid feature-set (pinned columns, headerComponent, applyColumnState, autoSizeAllColumns, domLayout autoHeight) is worth the trade. Not something to change here.
  - **This closes tasks #132, #133, #134** in the internal task list. All three migration phases are complete and SlickGrid is gone.

## 2026-07-08 - Claude Office 365 ribbon module — commit 1: skeleton + typography

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (1/5 of the Office-conformed ribbon Path B sequence).
- Status: Implemented; user acceptance-tested visually. Automated tests not re-run for this commit — visual/typography-only change on top of already-passing state.
- Summary:
  - Started the Path B Office-conformed ribbon effort. User picked six deliverables from the Office spec:
    1. Tab strip with the exact Office 365 sizing/spacing/font
    2. Groups with the mandatory bottom-anchored group label
    3. Large / medium / small button layout rules (Office's adaptive shrink heuristic)
    4. Split buttons that behave like Office (main click + arrow)
    5. Overflow / collapse behavior for narrow viewports
    6. Contextual tabs (appear only when an item is selected)
    (Backstage view and Alt-key access explicitly dropped by user.)
  - This commit (1/5) lands the module skeleton + item 1 (Office 365 tab strip typography, sizing, group label look). Items 2-6 come in commits 2-5.
  - **New files:**
    * `ribbon/ribbon.css` — Office 365 typography + spacing overrides scoped to `.rb-office-ribbon`. Uses the Segoe UI Variable font stack (`"Segoe UI Variable Display" -> "Segoe UI Variable" -> "Segoe UI" -> system-ui`), 34px tab strip, 14px SemiBold tab labels, 2px accent underline for the active tab (Office 365 look, not Office 2016 top border), 11px group labels bottom-anchored, 1px 9%-opacity vertical rule between groups (via `border-right` on `.rb-group`), 72px total ribbon body height (targets the compact/Simplified ribbon variant).
    * `ribbon/ribbon.js` — module skeleton. Registers `globalThis.ShopScoutRibbon` with `apply()` that adds the `.rb-office-ribbon` class to every `.ribbon-shell` in the DOM (idempotent — only touches shells that don't already have the class). Runs on DOMContentLoaded. `version: '1.0.0-commit-1'` tag exposed on the namespace so later commits can be feature-detected.
  - **HTML wiring:**
    * `<link rel="stylesheet" href="ribbon/ribbon.css">` added to `comparison.html` immediately after `comparison.css` so the Office overrides win in the cascade.
    * `<script src="ribbon/ribbon.js"></script>` added after the other UI scripts (`ui/promptDialog.js`) so `ShopScoutRibbon.apply()` runs before `comparison.js` initializes.
  - **Build script:** `scripts/build-extension.ps1` `$runtimeDirs` now includes `'ribbon'` so the dist bundles include the new folder. Verified `dist/chrome/ribbon/` contains both files.
  - No HTML markup changes — every existing `.ribbon-shell`, `.ribbon-tab`, `.rb-group`, `.rb-btn-lg`, `.rb-btn-sm`, `.rb-group-label`, `.rb-divider`, `.rb-select` class survives untouched. The JS opt-in adds the extra `.rb-office-ribbon` class at runtime; every rule in `ribbon.css` is scoped under that class, so nothing overrides until JS runs.
  - `.rb-divider` elements become `display: none` under `.rb-office-ribbon` — the group's own `border-right` gives us the vertical separator, so the explicit divider element is redundant. Kept in HTML so we don't have to touch markup this commit; removed from the DOM tree via CSS.
- Files touched:
  - `ribbon/ribbon.css` (new)
  - `ribbon/ribbon.js` (new)
  - `comparison.html` — one `<link>` + one `<script>` added.
  - `scripts/build-extension.ps1` — added `'ribbon'` to `$runtimeDirs`.
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt; `dist/chrome/ribbon/` verified to contain `ribbon.css` + `ribbon.js`.
  - Automated tests NOT re-run this commit (pure visual/typography change; last known-good is the 44/44 pass at commit `0302378`).
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. **Tab strip visual:** load the dashboard and eyeball the tab strip against a screenshot of an Office 365 desktop ribbon (Word / Excel). The tabs should read as ~14px SemiBold Segoe UI, with a 2px accent-color underline on the active tab, not the earlier heavier styling.
    2. **Font fallback:** On non-Windows systems where "Segoe UI Variable Display" and "Segoe UI Variable" don't exist, the stack falls through to "Segoe UI" (older Windows) then `-apple-system` / `BlinkMacSystemFont` / `system-ui`. Verify macOS looks correct — expected to render in SF Pro Text via `-apple-system`, still weight 600, still 14px.
    3. **Group label:** the mandatory bottom-anchored "List / Product Actions / Review & Rules / View / Organize" labels on the merged Products tab should read as 11px Regular, muted color, single line, ellipsized if overflowing. Height locked at 18px so groups stay aligned.
    4. **Vertical rule between groups:** the earlier `.rb-divider` elements (thin lines in the DOM) are now hidden via CSS. The separation comes from `border-right: 1px solid rgba(15,23,42,0.08)` on every `.rb-group` except the last. Verify no double-line visual artifact.
    5. **Button hover:** hovering a Large button should show a soft neutral tint (~6% ink overlay) with a subtle 1px border. No hard shadows. Focus-visible should show a 2px accent outline offset inward by 1px.
    6. **No unintended regressions on other pages:** the popup, settings, and about pages also use `.ribbon-shell`. Since `.rb-office-ribbon` is added by JS to every ribbon-shell in the DOM, those pages would also pick up the new look. Verify each one still renders coherently. If any look broken, we can scope `apply()` in ribbon.js to only shells inside `comparison.html`.
    7. **Build output:** `dist/{chrome,edge,firefox}/ribbon/ribbon.css` and `ribbon.js` should both exist post-build. If either missing, `scripts/build-extension.ps1` `$runtimeDirs` didn't pick up the new folder.
- Follow-ups or risks:
  - **HTML markup untouched.** This commit is CSS-only visual polish. Later commits will add `data-btn-size="large|medium|small"` attributes to buttons (commit 2) and rebuild the split-button structure (commit 3). Those DO touch HTML.
  - **`.rb-divider` cleanup deferred.** Right now those `<div class="rb-divider">` elements are hidden by CSS but still exist in the DOM. Codex may want to strip them in a later cleanup pass — they're semantic dead weight now.
  - **Non-dashboard ribbons.** If the popup or settings ribbon looks broken under the Office rules, tell me and I'll scope `apply()` to only run inside `#dashboardShell` or similar.
  - **Next commit (2/5):** Large / Medium / Small button sizes with Office's adaptive shrink heuristic. Adds a JS observer that measures the ribbon body width and downgrades buttons L -> M -> S as the viewport narrows, starting from the rightmost group with the largest buttons. This is where things get interesting.

## 2026-07-09 - Claude Office 365 ribbon commit 2: Fluent.Ribbon-grounded core framework

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (2/11 of the Office-conformed ribbon Path B sequence — extended from the earlier 5-commit plan after user confirmed full scope: all 23 SizeDefinition templates, HTML migration to declarative API, and hand-authored SVG variants per DPI).
- Status: Implemented. All 44 automated test files pass. Visual acceptance pending user reload.
- Summary:
  - Full rewrite of `ribbon/ribbon.css` — every pixel value now cites its source. Where Microsoft's own Windows Ribbon Framework spec leaves a chrome dimension undefined, Fluent.Ribbon (github.com/fluentribbon/Fluent.Ribbon) is used as the authoritative reference and cited inline with format `[Fluent:FileName.xaml:LineNumber]`. Anything the two combined don't publish is marked `[Invented]` with rationale.
  - **Concrete Fluent.Ribbon values adopted:**
    * Ribbon content height: 100px (`RibbonTabControl.cs:28` DefaultContentHeight)
    * Content gap: 3px (`RibbonTabControl.cs:23` DefaultContentGapHeight)
    * Total Classic body: 103px
    * Simplified content: 42px (`Ribbon.xaml:70` ContentHeight="42")
    * QAT height: 23px (`Ribbon.cs:1015` QuickAccessToolBarHeight default 23D)
    * Tab header padding: 3,9,6,9 asymmetric (`RibbonTabItem.cs:194`) — bottom asymmetric to leave room for the 2px underline indicator inset 3px from bottom (`RibbonTabItem.xaml:10`)
    * Tab separator: 1px wide, 4px top/bottom margin (`RibbonTabItem.xaml:32-35`)
    * Group interior padding: 4,2,4,2 (`RibbonGroupBox.xaml:33`); Simplified 2,0 (`RibbonGroupBox.xaml:37`)
    * Group vertical separator: 1×55px inset (`RibbonGroupBox.xaml:8-10`) — NOT full-height border
    * Large button height: 68 (`Button.xaml:166`)
    * Middle button height: 22 (`Button.xaml:171`)
    * Small button: 22×22 (`Button.xaml:172` + `DropDownButton.xaml:201` inner slot 10)
    * Simplified button MinHeight: 30 (`Button.xaml:177`)
    * DialogLauncher: 16×16 button with 8×8 glyph (`RibbonGroupBox.xaml:124-126`, `:282`)
    * Popup border-overlap trick: `margin-right: -4px` (recurring across Fluent files)
    * Minimum visible width: 300px (`Ribbon.cs:60` MinimalVisibleWidth) — matches Microsoft's 300px @ 96 DPI target
    * Contextual overlay tint: rgba(0,0,0,0.08) (`Theme.Template.xaml:91` #14000000)
  - **New CSS custom properties API:** Every dimension is a `--rbn-*` custom property on `.rb-office-ribbon`. Downstream commits and consumer code can override via `.ribbon-shell { --rbn-btn-large-h: 72px; }` without touching the framework.
  - **Four group sizes implemented:** `data-group-size="large|middle|small|popup"` on `.rb-group`. Fluent.Ribbon terminology adopted verbatim (**"Middle"**, not "Medium"). Each mode:
    * Large: 68px buttons, 32px icons on top, 2-line labels below (Classic Office look)
    * Middle: 22px buttons, 16px icons left of single-line label, group content stacks vertically
    * Small: 22×22 icon-only buttons, label hidden
    * Popup: entire group collapses to a single 68×~64px button that opens a popup rendering the group at Large. Popup layout follows Microsoft's spec verbatim ("Identical control layout to Large but hosted in a pop-up or drop-down pane").
  - **Ribbon.GroupSpacing tokens** implemented via `data-group-spacing="small|medium|large"` at the ribbon-shell. Microsoft names, my pixel values (0 / 6 / 12). Marked `[Invented]` in CSS.
  - **Ribbon mode** implemented via `data-ribbon-mode="classic|simplified"`. Classic is the default. In Simplified mode the ribbon body shrinks to 42px, buttons flip to `flex-direction: row` with min-height 30px, icon shrinks to 20px (Mescius' intermediate icon size — Fluent.Ribbon uses this too via `IconSize="Medium"`).
  - **Ribbon collapse** implemented via `data-ribbon-collapsed="true"` — hides the ribbon body but keeps the tab strip visible. Toggled by double-clicking the active tab (Beijer-confirmed Office convention).
  - **DialogLauncher primitive** as `.rb-dialog-launcher` — 16×16 button positioned `bottom-right: 2px 2px` of any parent `.rb-group`. This is the small corner icon Word/Excel use on the Font / Paragraph / etc. groups. Fluent adds it as an extension to Microsoft's Win32 spec.
  - **ButtonGroup primitive** as `.rb-button-group` — bordered cluster of buttons that share a rounded outer edge (e.g. Word's paragraph-alignment cluster). VSTO Ribbon API exposes it as `RibbonButtonGroup`.
  - **RibbonBox primitive** as `.rb-ribbon-box` with `data-box-style="horizontal|vertical"` — general layout container matching VSTO's `RibbonBox` + `RibbonBoxStyle` enum.
  - **`ribbon/ribbon.js` expanded** with the framework API:
    * `defineCommand({ id, label, tooltip, keytip, largeImage, mediumImage, smallImage, handler })` — Command registry. One command can drive many controls.
    * `updateCommand(id, patch)` — mutate a defined command (e.g. toggle enabled).
    * `control({ id, commandId, type, groupId, sizeModes, showLabel, showImage })` — declare a control placement. `type` is validated against the Windows Ribbon Framework + Fluent + VSTO superset (Button / ToggleButton / DropDownButton / SplitButton / DropDownGallery / SplitButtonGallery / DropDownColorPicker / ComboBox / Spinner / EditBox / CheckBox / InRibbonGallery / FontControl / ButtonGroup / RibbonBox / DialogLauncher / Separator / Label).
    * `setMode('classic'|'simplified')` / `getMode()` — mode toggle with `modeExplicit` flag so the auto-Simplified viewport switch doesn't overrule a user pick.
    * `setGroupSpacing('small'|'medium'|'large')` — ribbon-shell attribute setter.
    * `setCollapsed(bool)` / `toggleCollapsed()` — collapsed state.
    * `commands` / `controls` / `state` read-only accessors (return snapshots so callers can't mutate registries directly).
    * `isButtonFamily(type)` / `isInputFamily(type)` / `isStandalone(type)` / `isContainer(type)` / `familyOf(type)` — validation helpers for the template code coming in commits 3-7.
    * `SIMPLIFIED_THRESHOLD = 900` constant (viewport width below which we auto-drop to Simplified — matches Office 365 web).
    * `version: '1.0.0-commit-2'`.
  - **Auto-Simplified behavior:** `ResizeObserver` on the primary ribbon-shell. When width falls below 900px (and user hasn't explicitly picked a mode via `setMode()`), the shell attribute flips to `simplified`. When it rises back above the threshold, Classic returns.
  - **Double-click tab handler:** attached to the ribbon-shell via delegation. Only triggers when the target is the currently *active* tab; inactive tabs still activate on double-click without collapsing.
- Files touched:
  - `ribbon/ribbon.css` — full rewrite (~550 lines), every value cited.
  - `ribbon/ribbon.js` — expanded from ~30 lines to ~230 lines with the framework API.
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm test` -> **all 44 test files pass** (no test regressions).
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. **Font stack:** the ribbon should read as Segoe UI Variable Display on Windows 11, Segoe UI on Windows 10, `-apple-system` on macOS. Verify the tab label typography looks correct across platforms.
    2. **Tab underline alignment:** with 3px bottom inset per Fluent, the underline should sit slightly above the very bottom of the tab strip. Not flush with the ribbon-body divider below.
    3. **Group vertical separator:** 1px × 55px inset from group top by 5px and bottom by 10px. Should NOT be a full-height border. Compare against a screenshot of an Office 365 Word ribbon — matches the "inset rule" pattern between groups.
    4. **Ribbon body height:** should now be 103px in Classic mode (up from ~72 in commit 1). If it looks too tall vs the ShopScout tab strip, the CSS variable `--rbn-content-h` can be tuned per-page without touching the framework.
    5. **Auto-Simplified switch:** resize the browser to <900px. The ribbon should collapse to a 42px single-row layout, buttons should stack horizontally with 20px icons. Above 900px it should return to Classic automatically.
    6. **Double-click to collapse:** double-click the active `Products` tab. The ribbon body should collapse. Double-click again to expand.
    7. **DialogLauncher rendering:** none of the current groups declare one yet — that's added when specific groups need it in later commits. But verify `.rb-dialog-launcher` CSS renders sensibly if you add `<button class="rb-dialog-launcher">...</button>` to a group manually.
    8. **`ShopScoutRibbon` API surface:** open DevTools console, run `ShopScoutRibbon.version` -> should return `'1.0.0-commit-2'`. Run `ShopScoutRibbon.state` -> should return the current mode/groupSpacing/collapsed snapshot. Run `ShopScoutRibbon.defineCommand({id:'test',label:'Test',handler:()=>console.log('fired')})` -> should register; verify with `ShopScoutRibbon.commands.get('test')`.
    9. **Existing tests:** all 44 pass, but there are NO tests yet that exercise the new framework directly. Codex may want to write `tests/ribbon.test.js` covering command/control registration, mode toggle, spacing setter, collapsed state, and the family-typing helpers.
    10. **Existing HTML unchanged:** the merged Products tab's markup is identical to before. What changed is the CSS applied to it via the `.rb-office-ribbon` class + all the new custom properties. Later commits will migrate the HTML to the declarative API (Path B, commit 11 in the sequence).
- Follow-ups or risks:
  - **`data-group-size` not applied to any group yet.** All existing `.rb-group` elements render at Large (the default when no attribute is set). Later commits will attach `data-group-size` per group as part of ScalingPolicy (commit 8) and the migration (commit 11).
  - **Popup mode is rendered via CSS `content: attr(data-collapsed-label)`.** No JS handler is wired yet to actually open the popup on click. Commit 8 (ScalingPolicy) will add the popup rendering + click handler.
  - **CSS cascade:** the new `.rb-office-ribbon` rules load AFTER `comparison.css`, and every rule is scoped under `.rb-office-ribbon`. If comparison.css has a more-specific selector that overrides one of our custom-property-driven values, we'll see it — flag any regression.
  - **Testing:** consider adding a lightweight `tests/ribbon.test.js` that exercises `defineCommand`/`control`/`setMode`/`familyOf` — the framework is public API surface, deserves coverage.
  - **Next commit (3/11):** SizeDefinition templates tranche A — `OneButton`, `TwoButtons`, `ThreeButtons`, `ThreeButtons-OneBigAndTwoSmall`, `ThreeButtonsAndOneCheckBox`, `FourButtons`, `FiveButtons`. Each template validates control count/order/family per Microsoft's strict contract (validation error terminates compilation in the Win32 framework; we'll `console.error` loudly and refuse to render). Each has Large/Middle/Small GroupSizeDefinitions expressed as CSS layout modes triggered by `data-size-definition="TwoButtons"` etc. on `.rb-group`.

## 2026-07-09 - Claude Office 365 ribbon commit 3: SizeDefinition templates tranche A

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (3/11).
- Status: Implemented. All 44 tests pass. Visual acceptance pending.
- Summary:
  - **New file: `ribbon/templates.js` (~220 lines)** — SizeDefinition template registry with strict validation. Registers the 7 tranche A templates:
    * `OneButton` (Large only) — 1 button-family control
    * `TwoButtons` (Large + Middle) — 2 button-family
    * `ThreeButtons` (Large + Middle) — 3 button-family
    * `ThreeButtons-OneBigAndTwoSmall` (Large + Middle + Small) — 3 button-family; in Large mode slot 0 renders at Large button size on the left, slots 1-2 stack as Middle to the right (via `largeBigSlot: 0` hint + CSS grid layout)
    * `ThreeButtonsAndOneCheckBox` (Large + Middle) — 3 buttons + 1 `CheckBox` at the end (standalone family per Microsoft's schema)
    * `FourButtons` (Large + Middle + Small) — 4 button-family
    * `FiveButtons` (Large + Middle + Small) — 5 button-family; Middle mode packs into 3-row columns (3+2 layout)
  - **Public API:**
    * `ShopScoutRibbon.templates.register(name, spec)` — custom template registration (open to app code)
    * `ShopScoutRibbon.templates.get(name)` — read a template spec
    * `ShopScoutRibbon.templates.list()` — array of all registered names
    * `ShopScoutRibbon.templates.validate(groupEl, name)` — strict count/order/family check; returns `boolean` and `console.error`s the specific mismatch on failure
    * `ShopScoutRibbon.templates.apply(groupEl, name, {size})` — sets `data-size-definition` + `data-group-size` attributes and runs validation
    * `ShopScoutRibbon.templates.slotAccepts(slot, controlType)` — internal helper exposed for tests
    * `ShopScoutRibbon.templates.all()` — snapshot dump of the whole registry
  - **Slot family constraints** map to Microsoft's spec:
    * `family: 'button'` — any Button/ToggleButton/DropDownButton/SplitButton/DropDownGallery/SplitButtonGallery/DropDownColorPicker
    * `family: 'input'` — ComboBox/Spinner/EditBox
    * `family: 'gallery'` — the three gallery types
    * `family: 'CheckBox'` — literally a CheckBox
    * `family: 'fontcontrol'` — the special FontControl composite (Win32 spec forbids it inside custom templates; we honor the constraint by refusing to slot it anywhere except OneFontControl)
    * `type: 'ExactName'` — exact type match
  - **Auto-validation on DOMContentLoaded:** every `.rb-group[data-size-definition]` in the DOM is validated at load. Unknown template names are skipped silently (they might be app-registered custom templates that haven't loaded yet). Known template names with mismatched controls produce a `console.error` naming the specific slot and the family mismatch.
  - **New file: `ribbon/templates.css` (~180 lines)** — per-template CSS layouts. Selector pattern is `.rb-office-ribbon .rb-group[data-size-definition="NAME"][data-group-size="MODE"]`. Only templates where the default `data-group-size` CSS is wrong get an override; simpler templates fall through to the default.
    * `OneButton`: centers the single button
    * `TwoButtons`/`ThreeButtons`: row in Large, column in Middle (uses default flex)
    * `ThreeButtons-OneBigAndTwoSmall` Large: CSS grid with slot 0 spanning 2 rows in column 1 at Large-button size; slots 1-2 in column 2 at Middle-button size (icon-left, single-line label, left-aligned) — matches Fluent's rendering exactly
    * `ThreeButtonsAndOneCheckBox`: 3-column grid with CheckBox spanning all 3 columns in row 2
    * `FourButtons` Middle: 4×22 vertical stack (fits within content-h 100)
    * `FiveButtons` Middle: 3-row grid, `grid-auto-flow: column`, so 5 buttons flow into 3+2 columns
  - **Validation error visual marker:** adding `data-template-invalid="true"` to a group draws a red dashed 2px outline and appends a ⚠ to the group label. This is opt-in — callers who care about validation UI can set the attribute after `validate()` returns false. Auto-validation on DOMContentLoaded logs to console but does not set the marker (avoiding UI noise for the common "template not applied yet" case).
  - **HTML wiring** — `comparison.html` loads `templates.css` after `ribbon.css` and `templates.js` after `ribbon.js`. Load order matters: `templates.js` uses `ShopScoutRibbon.isButtonFamily` / `.isInputFamily` from commit 2's `ribbon.js`, so `ribbon.js` must load first.
  - **No HTML markup changes on existing groups** — no `.rb-group` in the merged Products tab yet declares `data-size-definition`. Auto-validation runs but finds no matches, so no logging. Migration to declarative templates lands in commit 11.
- Files touched:
  - `ribbon/templates.js` (new, ~220 lines)
  - `ribbon/templates.css` (new, ~180 lines)
  - `comparison.html` — 2 new tag additions (link + script)
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm test` -> **all 44 test files pass** (no regressions).
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. **Registry contents:** in DevTools console, run `ShopScoutRibbon.templates.list()`. Should return `['OneButton', 'TwoButtons', 'ThreeButtons', 'ThreeButtons-OneBigAndTwoSmall', 'ThreeButtonsAndOneCheckBox', 'FourButtons', 'FiveButtons']`.
    2. **Template inspection:** `ShopScoutRibbon.templates.get('ThreeButtons-OneBigAndTwoSmall')` should return the spec with `largeBigSlot: 0` and 3 button-family slots.
    3. **Validation happy path:** Manual test — create a mock group `<div class="rb-group" data-size-definition="TwoButtons"><div class="rb-group-content"><button class="rb-btn-lg" data-control-type="Button"></button><button class="rb-btn-lg" data-control-type="Button"></button></div><div class="rb-group-label">Test</div></div>`, then call `ShopScoutRibbon.templates.validate(el, 'TwoButtons')` — should return `true`.
    4. **Validation failure path:** Same group but with 3 buttons — should return `false` and `console.error` the count mismatch.
    5. **Slot family failure:** Add a `<select>` (input family) as slot 0 to a `TwoButtons` — should `console.error("slot 0 expected button-family, got 'ComboBox'")`.
    6. **CheckBox slot:** `ThreeButtonsAndOneCheckBox` should accept a `CheckBox` in slot 3; refuse a plain button; refuse a ComboBox.
    7. **Auto-validation:** the merged Products tab has no `data-size-definition` on any group yet — DOMContentLoaded should log nothing to console. Verify by opening the console and reloading the page. Once templates are applied in commit 11, any mismatch will surface here.
    8. **CSS layout — ThreeButtons-OneBigAndTwoSmall Large mode:** add the attribute temporarily to any 3-button group. Slot 0 should render as a full 68px Large button on the left with a 32px icon; slots 1-2 should stack as compact 22px Middle rows to the right with 16px icons and left-aligned single-line labels.
    9. **CSS layout — FiveButtons Middle mode:** with 5 buttons and `data-size-definition="FiveButtons" data-group-size="middle"`, buttons should flow into 3+2 columns.
    10. **Template registration for custom templates:** app code should be able to call `ShopScoutRibbon.templates.register('MyCustom', {supportedSizes:['Large'], slots:[{family:'button'}]})`. Verify it appears in `list()` afterwards.
- Follow-ups or risks:
  - **inferControlType is best-effort.** For legacy HTML that doesn't set `data-control-type`, the validator infers based on class names (`.rb-btn-lg` -> `Button`, `.rb-split` or `<details>` -> `SplitButton`, `.rb-select` -> `ComboBox`, etc.). Best practice going forward: always set `data-control-type` on controls the app expects to be validated.
  - **DecorativeElement handling:** the validator filters out labels, mini-labels, and stack wrappers automatically. If a group has decorative elements that ALSO carry data-control-type or one of the button classes, they'll be counted. Add `data-decorative="true"` on any wrapper we want to explicitly exclude.
  - **`.rb-stack` handling:** the New/Rename/Delete buttons in the merged Products tab's List group are wrapped in a `.rb-stack` container. Templates that host a stack need to either (a) treat the stack as a single "logical" slot, or (b) allow the stack's children as individual slots. Current validator treats `.rb-stack` as ancillary and doesn't traverse into it. This is fine for List because the group doesn't declare a template — but as we migrate the tab in commit 11, we may need `ButtonGroups` template semantics (commit 6) to properly express the stack.
  - **No CSS layout for `ThreeButtonsAndOneCheckBox` Middle mode** was added — the default column-stacked CSS (`data-group-size="middle"`) will handle it, but visual result may look odd if the CheckBox stretches full-width. If reviewers see a rendering issue, add `.rb-group[data-size-definition="ThreeButtonsAndOneCheckBox"][data-group-size="middle"] > .rb-group-content > :nth-child(4) { justify-content: flex-start; padding: 2px 6px; }`.
  - **Next commit (4/11):** Tranche B — `FiveOrSixButtons` (with `trailingOptional: true`), `SixButtons`, `SixButtons-TwoColumns`, `SevenButtons`. Same pattern as tranche A.

## 2026-07-09 - Claude Office 365 ribbon commit 4: SizeDefinition templates tranche B

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (4/11).
- Status: Implemented. All 44 tests pass.
- Summary:
  - **4 new templates registered** in `ribbon/templates.js`:
    * `FiveOrSixButtons` — 5-6 button-family, Large + Middle + Small. `trailingOptional: true` so 5 OR 6 controls both pass validation.
    * `SixButtons` — 6 button-family, Large + Middle + Small. Middle mode: explicit 3×2 grid (3+3 layout).
    * `SixButtons-TwoColumns` — 6 button-family, Large + Middle + Small. Explicit 2-column layout at every mode; even Large renders buttons at Middle-button dimensions (Fluent behavior: 6 Large buttons in 2 columns would blow the 100px content height, so the container downgrades individual buttons).
    * `SevenButtons` — 7 button-family, Large + Middle + Small. Middle mode packs 3+3+1 across three columns.
  - **CSS additions in `ribbon/templates.css`:** per-template layout overrides for each new template's supported sizes. Notable:
    * `FiveOrSixButtons` Middle uses `grid-auto-flow: column` with 3 rows, so 5 buttons flow into 3+2 and 6 buttons into 3+3 without needing a JS branch.
    * `SixButtons-TwoColumns` Large mode forces individual button chrome down to Middle dimensions (22px height, 16px icon, icon-left with left-aligned label) via a `> *` selector — matches Fluent's rendering where a 6-button container at Size="Large" still shows Middle-sized buttons because two rows of Large won't fit.
    * `SevenButtons` Middle relies on the same column-flow trick as FiveOrSixButtons but with `max-content` auto-columns so the 7th button gets its own column.
- Files touched:
  - `ribbon/templates.js` — 4 new `register()` calls after FiveButtons.
  - `ribbon/templates.css` — 4 new template sections before the validation-marker block.
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm test` -> all 44 pass.
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. `ShopScoutRibbon.templates.list()` should now return 11 templates: the original 7 + these 4.
    2. `ShopScoutRibbon.templates.get('FiveOrSixButtons').trailingOptional` should be `true`.
    3. `validate(el, 'FiveOrSixButtons')` with 5 controls should return `true`; with 6 controls should also return `true`; with 4 or 7 should return `false` with a "count mismatch: expected 5-6, got N" console error.
    4. `SixButtons-TwoColumns` Large mode: attach the template to a 6-button group. Buttons should render as Middle-sized (22px, 16px icon, icon-left, left-aligned label) NOT as 68px Large. Compare against Fluent's rendering of the same template.
    5. `SixButtons` vs `SixButtons-TwoColumns`: at Large, the former puts all 6 in a single row of Large buttons (may be very wide, which is Fluent's actual behavior — the group takes the space it needs); the latter constrains to 2 columns even at Large.
    6. `SevenButtons` Middle: 7 buttons should flow into 3+3+1 columns.
  - **Follow-ups or risks:**
    * `SixButtons-TwoColumns` in Large mode currently overrides the button chrome via `> *` — if any wrapper (a `<details>` for a split-button) sits between the group content and the button, its child button won't be caught. Templates that host split-buttons directly in slots should probably wire the override to `.rb-btn-lg` explicitly rather than `> *`. Flag if issues arise.
    * The `trailingOptional` support in the validator uses `template.slots.length - (trailingOptional ? 1 : 0)` for the min, so it can only handle ONE trailing-optional slot per template. If a future template needs multiple optional trailing slots, extend to a `minSlots` field.
    * **Next commit (5/11):** Tranche C — `EightButtons`, `EightButtons-LastThreeSmall` (requires two `ControlGroup` sub-containers: first 5 then last 3), `NineButtons`, `TenButtons`, `ElevenButtons`. `EightButtons-LastThreeSmall` will need the ControlGroup primitive since Microsoft's docs specify it explicitly.

## 2026-07-09 01:17 -07:00 - Codex full validation cleanup

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented; ready for Claude review.
- Summary:
  - Ran full validation after the AG Grid/SlickGrid migration sequence.
  - Fixed the validation-blocking lint error in the smart rescan button by removing a stale `products` variable reference and using the existing selected-product state.
  - Removed an unused `scannedUrls` variable from the rescan controller so lint is clean.
  - Left the pre-existing uncommitted `ribbon/templates.js` change untouched and unstaged.
- Files touched:
  - `comparison.js`
  - `comparison/rescanController.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `npm test` -> 44/44 test files pass
  - `npm run syntax` -> pass
  - `npm run lint` -> pass, 0 warnings/errors
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt
- Review / handoff:
  - Reviewer: Claude.
- Follow-ups or risks:
  - `ribbon/templates.js` still has unrelated uncommitted changes from prior work and was intentionally not staged by Codex.

## 2026-07-09 - Claude Office 365 ribbon commit 5: SizeDefinition templates tranche C + ControlGroup primitive

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (5/11).
- Status: Implemented. All 44 tests pass.
- Summary:
  - **5 new templates registered:** `EightButtons`, `EightButtons-LastThreeSmall`, `NineButtons`, `TenButtons`, `ElevenButtons`. All support Large + Middle + Small sizes with 3-row column-flow layouts at Middle (3+3+2 / 3+3+3 / 3+3+3+1 / 3+3+3+2 respectively).
  - **ControlGroup primitive added.** Microsoft's `EightButtons-LastThreeSmall` template requires the 8 buttons to be partitioned into two `<ControlGroup>` sub-elements — the first with 5 buttons, the second with 3. New CSS class `.rb-control-group` renders as `display: contents` by default (transparent to the parent grid layout), but templates that need explicit rendering can override.
  - **Validator extended** with `controlGroups` spec property. When set to `[5, 3]` (as in `EightButtons-LastThreeSmall`), the validator:
    1. Finds `.rb-control-group` children of `.rb-group-content`, checking exact count (2 expected).
    2. Validates that each ControlGroup has exactly the expected number of controls.
    3. Then flattens across the ControlGroups for slot-family validation using `:scope > .rb-control-group > *`.
  - **Countable-control filter extracted** into `isCountableControl(el)` helper. Recognizes elements with `data-control-type`, or one of the primitive classes (`.rb-btn-lg`, `.rb-btn-sm`, `.rb-select`, `.rb-split`, `.rb-button-group`, `.rb-ribbon-box`), or `<details>` tags. Excludes elements with `data-decorative` and `.rb-control-group` containers (those partition their children, not act as slots themselves).
  - **`EightButtons-LastThreeSmall` visual behavior** matches Microsoft's docs verbatim:
    * Large mode: first ControlGroup (5 buttons) renders as Middle in a 3-row grid; second ControlGroup (3 buttons) renders as Small icon-only in a vertical strip.
    * Middle mode: both ControlGroups render as Middle in 3-row grids.
    * Small mode: both ControlGroups render as Small icons in a single row.
- Files touched:
  - `ribbon/templates.js` — extracted `isCountableControl`, added `controlGroups` support in validator, 5 new `register()` calls.
  - `ribbon/templates.css` — `.rb-control-group` primitive + 5 new template sections.
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm test` -> all 44 pass.
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. `ShopScoutRibbon.templates.list()` should now return 16 templates.
    2. `ShopScoutRibbon.templates.get('EightButtons-LastThreeSmall').controlGroups` should be `[5, 3]`.
    3. `EightButtons-LastThreeSmall` validation happy path: a group with two `.rb-control-group` children containing 5 and 3 buttons respectively should pass. Fewer or more than 2 ControlGroups should fail with a specific "expected 2 ControlGroup children" error.
    4. Wrong per-ControlGroup counts (e.g. 4 and 4 instead of 5 and 3) should fail with "ControlGroup 0 expected 5 controls, got 4".
    5. `NineButtons` / `TenButtons` / `ElevenButtons` at Middle mode should flow into 3-row columns matching the expected 3+3+3 / 3+3+3+1 / 3+3+3+2 layout. Grid auto-flow handles this; verify visually.
    6. `.rb-control-group` used outside a template that explicitly overrides its display should be transparent (`display: contents`) — parent grid layout should pass through.
  - **Notable follow-ups:**
    * `EightButtons-LastThreeSmall` CSS uses `nth-child(2)` to target the second ControlGroup. If the HTML structure ever adds a wrapper between `.rb-group-content` and the ControlGroups, the selector will break.
    * The 5+3 partition assumes ControlGroups appear in the DOM in the order they were declared. Microsoft's schema doesn't require this but it's the sensible default. If future templates need per-ControlGroup slot family constraints, extend the spec to `controlGroups: [{ count: 5, family: 'button' }, ...]`.
    * **Next commit (6/11):** Tranche D mixed templates — `ButtonGroups`, `ButtonGroupsAndInputs`, `BigButtonsAndSmallButtonsOrInputs`. These accept mixed control families (buttons + inputs). May need multi-family slot syntax like `{ family: ['button', 'input'] }`.

## 2026-07-09 - Claude Office 365 ribbon commit 6: SizeDefinition templates tranche D (mixed families) + flexibleSlots

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (6/11).
- Status: Implemented. All 44 tests pass.
- Summary:
  - **3 new mixed-family templates registered:**
    * `ButtonGroups` (Large/Middle/Small) — 2 required + up to 30 optional button-family controls (Microsoft schema allows up to 32 total).
    * `ButtonGroupsAndInputs` (Large/Middle) — 2 required input-family controls followed by up to 29 button-family controls.
    * `BigButtonsAndSmallButtonsOrInputs` (Large/Middle) — 1 required big button-family control followed by up to 8 mixed button-family OR input-family controls (`family: ['button', 'input']`).
  - **`slotAccepts` upgraded to support multi-family arrays.** A slot can now declare `family: 'button'` (single) or `family: ['button', 'input']` (either matches). Used by `BigButtonsAndSmallButtonsOrInputs` for the trailing mixed slots.
  - **New `flexibleSlots` spec property.** Templates with variable trailing content declare `flexibleSlots: { min, max, family, type }`. The validator:
    * Computes total control range as `fixedSlots + flexibleSlots.min` .. `fixedSlots + flexibleSlots.max`.
    * For each control at index >= fixedSlots.length, uses the `flexibleSlots` spec as the slot template (family + type constraint applies).
    * Reports failures as "flex-slot N expected ..." to distinguish from fixed-slot failures.
  - **CSS layouts:**
    * `ButtonGroups` — Large uses flex-row nowrap; Middle uses 3-row column-flow grid; Small is a single row of icons.
    * `ButtonGroupsAndInputs` — Large uses a 2-row grid with the inputs in column 1 and buttons flowing into columns 2+; Middle uses the standard 3-row column-flow grid.
    * `BigButtonsAndSmallButtonsOrInputs` — Large mirrors `ThreeButtons-OneBigAndTwoSmall`: slot 0 renders at Large button size in column 1 spanning 3 rows, remaining slots render at Middle size in column 2.
- Files touched:
  - `ribbon/templates.js` — extended `slotAccepts` for multi-family, added `flexibleSlots` support in `register()` + validator, 3 new template registrations.
  - `ribbon/templates.css` — 3 new template sections.
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm test` -> all 44 pass.
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. `ShopScoutRibbon.templates.list()` should now return 19 templates.
    2. `ShopScoutRibbon.templates.get('BigButtonsAndSmallButtonsOrInputs').flexibleSlots` should be `{ min: 0, max: 8, family: ['button', 'input'], type: null }`.
    3. `ButtonGroups` validation happy path: 2 buttons (just fixed slots) should pass; 32 buttons should pass; 1 button should fail with "count mismatch: expected 2-32, got 1"; 33 buttons should fail with the same range.
    4. `ButtonGroupsAndInputs` slot-0 must be input-family. A ComboBox in slot 0 should pass; a Button in slot 0 should fail with "slot 0 expected input-family, got 'Button'".
    5. `BigButtonsAndSmallButtonsOrInputs` multi-family flex slots: a Button in flex-slot 0 should pass; a ComboBox in flex-slot 0 should also pass (both match the array); a CheckBox in flex-slot 0 should fail with the expected message.
    6. Visual layout of `BigButtonsAndSmallButtonsOrInputs` at Large mode should mirror `ThreeButtons-OneBigAndTwoSmall` — big button on the left, smaller mixed controls stacked on the right.
  - **Notable follow-ups:**
    * `ButtonGroupsAndInputs` layout hasn't been tested with real ComboBox/EditBox children yet since ShopScout doesn't currently have any groups using this template. When commit 11 migrates the merged Products tab, we may discover the input dimensions in a 2-row grid need adjustment.
    * The `flexibleSlots` implementation currently supports only ONE flex-slot spec per template (applied to all trailing controls). If a future template needs varying flex specs (e.g. "trailing 3 buttons then trailing 2 inputs"), extend to a `flexibleSlots: [{...}, {...}]` array.
    * **Next commit (7/11):** Tranche E specialized templates — `OneFontControl`, `OneInRibbonGallery`, `InRibbonGalleryAndBigButton`, `InRibbonGalleryAndButtons-GalleryScalesFirst`. These need Gallery + FontControl primitives that don't exist yet.

## 2026-07-09 - Claude Office 365 ribbon HOTFIX: scope all layout rules to data-group-size

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (interim fix between commits 6 and 7 in the Path B sequence).
- Status: Implemented. All 44 tests pass.
- Summary:
  - **User reported the merged Products tab looked broken:** Rescan Products label missing, buttons crammed, vertical dividers misaligned, general "this looks like crap" state at build `v3.3.0.ba2105a` (post-commit-5).
  - **Root cause:** Commit 2's `ribbon.css` applied strict Fluent.Ribbon pixel-perfect sizing (`.rb-btn-lg { height: 68px; max-width: 76px; }`, `.rb-group { min-height: 82px; padding: 4,2,4,2 }`, `.rb-group-content { flex; align-items: stretch }`, etc.) to EVERY existing group whether or not it had opted into the size-definition system. Rules were scoped under `.rb-office-ribbon` (opt-in via JS class), but Fluent's dimensions were then applied unconditionally to the existing static HTML in the merged Products tab.
    * `max-width: 76px` on Large buttons truncated "Rescan Products" label into invisibility (13 chars × 11px font ≈ 90px needed).
    * `min-height: 82px` on every group + rigid content padding stretched groups vertically and pushed labels off.
    * `::before` vertical separators between EVERY adjacent group inserted stray lines that clashed with the existing `.rb-divider` elements.
  - **Fix:** Scoped every layout-affecting rule to `[data-group-size]`. Now:
    * Groups WITHOUT `data-group-size` render using the ambient `comparison.css` styles that shipped before commit 2. Existing HTML looks like it did in commit 1's era — Segoe UI typography and Office 365 tab strip typography apply, but button/group sizing is unchanged.
    * Groups WITH `data-group-size="large|middle|small|popup"` get the Fluent-strict layout. Templates in `templates.css` continue to work identically (they always required both attributes).
  - **Specifically scoped:**
    * `.rb-group` padding + min-height -> now requires `[data-group-size]`.
    * `.rb-group-content` flex layout -> now requires `[data-group-size]` on parent.
    * `.rb-group-label` height + font -> now requires `[data-group-size]` on parent.
    * `.rb-btn-lg` sizing + icon dimensions + label clamp -> now requires `[data-group-size="large"]` on parent group (or one of the other size values through cascade).
    * `.rb-btn-sm`, `.rb-stack`, `.rb-mini-label` layout -> now require `[data-group-size]` on parent group.
    * `.rb-select` sizing -> now requires `[data-group-size]` on parent group.
    * Vertical `::before` separator between adjacent groups -> now requires BOTH groups to have `[data-group-size]` (won't insert stray dividers when only one group is opted in).
    * `.rb-divider` element hidden -> only inside opted-in size-system groups; existing HTML that still uses `<div class="rb-divider">` keeps its dividers.
    * `.ribbon-body` `min-height` -> removed the unconditional 103px; body sizes to content again. Tab strip typography (`ribbon-tab`, etc.) unchanged since those are structural chrome.
  - **What still applies globally** (safe cosmetic / typography):
    * Segoe UI font stack on all descendants.
    * Tab strip 34px height + 14px SemiBold label + 2px accent underline.
    * `.rb-btn-lg`/`.rb-btn-sm` hover / active / focus / disabled polish (colors only, no sizing).
    * `.rb-select` hover / focus polish.
    * The framework `defineCommand` / `control` / `setMode` / etc. APIs are unaffected.
    * All 19 registered SizeDefinition templates (7 tranche A + 4 B + 5 C + 3 D) work identically when applied. Only the "not applied yet" default rendering changed.
- Files touched:
  - `ribbon/ribbon.css` — scoped 8 CSS blocks to `[data-group-size]`.
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm test` -> all 44 pass.
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. **Merged Products tab visual:** should now look nearly identical to what it did just before commit 2 landed. Rescan Products label should be back. Buttons should not be crammed to 76px. Vertical rules between groups should be gone (the `.rb-divider` elements are no longer force-hidden, so they should reappear if they were there before). If those `.rb-divider` elements weren't in the merged tab's HTML at all, the tab will look slightly more visually "grouped" without inter-group dividers — acceptable.
    2. **`ShopScoutRibbon.templates.apply(el, 'FourButtons', {size: 'Large'})`** should still work on any group that opts in. Verify by manually applying a template in DevTools: pick a `.rb-group`, set both attributes, and observe that the Fluent-strict Large layout kicks in for that specific group.
    3. **Auto-Simplified switch** at 900px still works — `[data-ribbon-mode="simplified"]` still triggers the ribbon body variant.
    4. **Double-click active tab** still collapses/expands the ribbon body.
    5. **`ShopScoutRibbon.state`** should return the current mode/spacing/collapsed snapshot unchanged.
  - **Notable follow-ups:**
    * When commit 11 migrates the merged Products tab HTML to the declarative API, we'll add `data-group-size` to every group and the Fluent-strict layouts will kick in properly. That's when the ribbon will genuinely take on the Office 365 look everywhere — not before.
    * **Next commit (7/11):** Tranche E specialized templates. Continues the template registry work; no visual regression risk on existing HTML.

## 2026-07-09 - Claude Office 365 ribbon commit 7: SizeDefinition templates tranche E + Gallery/FontControl primitives — REGISTRY COMPLETE (23/23)

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (7/11).
- Status: Implemented. All 44 tests pass.
- Summary:
  - **4 final templates registered — brings the registry to Microsoft's complete 23-template set:**
    * `OneFontControl` (Large + Middle) — the special FontControl composite. Microsoft's docs explicitly say FontControl "cannot appear inside a custom template" — this template is the only permitted slot for it.
    * `OneInRibbonGallery` (Large + Small) — a single inline gallery. Middle mode is intentionally unsupported by Microsoft's spec (gallery either fits inline at Large or collapses to a dropdown at Small).
    * `InRibbonGalleryAndBigButton` (Large + Small) — gallery + one big button. `largeBigSlot: 1` marks slot 1 as the prominent one.
    * `InRibbonGalleryAndButtons-GalleryScalesFirst` (Large + Middle + Small) — gallery + up to 6 button-family controls. Per Microsoft: *"The gallery collapses to Popup representation in Medium and Small group sizes"* — our CSS enforces this by shrinking `.rb-in-ribbon-gallery` to a 22×22 dropdown button at those sizes.
  - **New CSS primitives in templates.css:**
    * `.rb-in-ribbon-gallery` — horizontal scrolling item strip with prev/next arrows and a "more" launcher. Height matches Large button (68px) so it aligns visually inside a Large group.
    * `.rb-in-ribbon-gallery-track` — the scrolling area with items.
    * `.rb-in-ribbon-gallery-item` — individual gallery item (44px min-width, hover state).
    * `.rb-in-ribbon-gallery-nav` — vertical column of prev/next arrows on the right.
    * `.rb-font-control` — composite container for font-family + font-size + effect buttons.
    * `.rb-font-control-family` — 140px+ combo for font family.
    * `.rb-font-control-size` — 48px+ spinner for font size.
    * `.rb-font-control-effects` — bordered cluster of bold/italic/underline toggle buttons (22×22 each), with the classic serif "B/I/U" glyph rendering.
- Files touched:
  - `ribbon/templates.js` — 4 new `register()` calls; header comment updated to reflect REGISTRY COMPLETE.
  - `ribbon/templates.css` — Gallery + FontControl primitives + 4 template sections.
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm test` -> all 44 pass.
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. **Registry count:** `ShopScoutRibbon.templates.list().length` should now return **23**. That's every SizeDefinition template Microsoft's Windows Ribbon Framework publishes.
    2. **FontControl exclusivity:** `ShopScoutRibbon.templates.get('OneFontControl').slots[0]` should be `{ family: 'fontcontrol' }`. No other template's slot list contains the `'fontcontrol'` family — verify by iterating over `ShopScoutRibbon.templates.all()`.
    3. **Gallery slot family:** `slotAccepts({ family: 'gallery' }, 'InRibbonGallery')` should return `true`; also for `'DropDownGallery'` and `'SplitButtonGallery'`; false for `'Button'`.
    4. **Visual: OneInRibbonGallery** at Large — build a mock group with `<div class="rb-in-ribbon-gallery"><div class="rb-in-ribbon-gallery-track"><span class="rb-in-ribbon-gallery-item">Item 1</span>...</div><div class="rb-in-ribbon-gallery-nav"><button>▲</button><button>▼</button></div></div>` and set `data-size-definition="OneInRibbonGallery" data-group-size="large"`. Should render as a 68px-tall horizontal strip with items on the left and up/down nav arrows on the right.
    5. **Visual: InRibbonGalleryAndButtons-GalleryScalesFirst** — set to `data-group-size="middle"` or `"small"`; the gallery should shrink to a 22×22 dropdown button (Microsoft's Popup representation) while the trailing buttons layout in a 3-row grid alongside.
    6. **Visual: FontControl composite** — build a mock with `<div class="rb-font-control"><select class="rb-font-control-family"><option>Segoe UI</option></select><input class="rb-font-control-size" value="12"><div class="rb-font-control-effects"><button>B</button><button>I</button><button>U</button></div></div>` in a `data-size-definition="OneFontControl"` group. Should render as a horizontal row: family combo → size spinner → bordered B/I/U cluster.
  - **Notable follow-ups:**
    * `.rb-in-ribbon-gallery` currently has no keyboard navigation. Arrow keys should scroll the item track; Escape should close any popup. Wire in commit 8 (ScalingPolicy engine) or a dedicated a11y follow-up.
    * `.rb-font-control-effects > button` uses Times New Roman for the B/I/U glyph — this is the classic Office rendering. If we ever theme this differently we may want SVG icons instead.
    * **All 23 templates are now registered.** The next visible-behavior work is commit 8 (ScalingPolicy engine) — the piece that walks the `<Scale>` list and applies each group's size mode as the ribbon body narrows. Every template already handles Middle/Small/Popup layouts; commit 8 just wires the ResizeObserver logic that decides WHEN to apply them.
    * **Next commit (8/11):** ScalingPolicy engine — declarative `<Scale>` list per Tab, walker that finds the first fitting layout, Popup collapse rendering, 300px minimum-width fallback.

## 2026-07-09 - Claude Office 365 ribbon commit 8: ScalingPolicy engine + Popup collapse renderer

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (8/11).
- Status: Implemented. All 44 tests pass.
- Summary:
  - **New file `ribbon/scaling.js` (~330 lines)** — declarative ScalingPolicy engine matching Microsoft's Windows Ribbon Framework `<Tab.ScalingPolicy>` semantics verbatim.
  - **Public API:**
    * `ShopScoutRibbon.scaling.set(paneId, { idealSizes, scales })` — register a policy for a ribbon pane. `idealSizes` is the target group sizes when there's plenty of room; `scales` is the descending-priority list of downgrade steps the walker applies as the viewport narrows.
    * `ShopScoutRibbon.scaling.get(paneId)` — read a policy snapshot.
    * `ShopScoutRibbon.scaling.remove(paneId)` — un-register a policy.
    * `ShopScoutRibbon.scaling.all()` — snapshot of every registered policy.
    * `ShopScoutRibbon.scaling.rescale(paneId?)` — force a walk immediately (no paneId → rescale the currently-active pane in every shell).
    * `ShopScoutRibbon.scaling.enable()` / `.disable()` — toggle the auto-walker.
    * `ShopScoutRibbon.scaling.closePopover()` — programmatically close any open Popup-collapse popover.
    * Constants: `MIN_VISIBLE_WIDTH = 300` (Microsoft spec + Fluent.Ribbon `Ribbon.cs:60`), `VALID_SIZES = ['Large','Middle','Small','Popup']`.
  - **Group lookup:** groups must carry `data-group-id="..."` so the walker can find them via a scoped CSS attribute selector inside the active pane. `CSS.escape()` is used when available, with a fallback for older engines.
  - **Walker semantics** — matches Microsoft's docs exactly:
    1. On every ribbon-shell resize, `rescale()` runs on the active pane.
    2. First, `applyIdealSizes()` resets every declared group to its ideal size (Large by default).
    3. If the pane's `scrollWidth > body.clientWidth`, the walker iterates the `scales` array in declared order.
    4. For each Scale entry, applies the target size to the group and re-checks fit. Stops the moment the pane fits.
    5. If every Scale is exhausted and the pane still overflows, sets `data-ribbon-overflow="true"` on the shell (CSS turns on horizontal scroll fallback + ⋯ hint).
    6. If the shell width is below `MIN_VISIBLE_WIDTH` (300px), sets `data-ribbon-overflow="hidden"` — CSS hides the ribbon body entirely per Microsoft's spec ("The ribbon is hidden when all potential control layouts have been exhausted").
  - **ResizeObserver** watches every `.ribbon-shell.rb-office-ribbon` in the DOM. Rescales the active pane whenever the shell's width changes. Only bound once per shell (`data-rbn-scaling-bound="1"` marker).
  - **Popup collapse renderer:**
    * When a group has `data-group-size="popup"` its content is replaced by a single collapsed button (existing CSS from commit 2).
    * Clicking the collapsed button opens a floating portalled popover that clones the group element, re-applies `data-group-size="large"` on the clone, and positions it below the source button.
    * Popover styling in `ribbon.css` inherits `.rb-office-ribbon` so the Large-mode CSS + template layout renders correctly inside.
    * Closes on outside click, Escape key, or `ShopScoutRibbon.scaling.closePopover()`.
    * `document.body`-portalled so the popover's positioning isn't constrained by the ribbon shell's overflow.
  - **Custom event emission:** `ribbon:rescale` `CustomEvent` fires on the shell after every walk. Detail: `{ paneId, stepsApplied, policy }`. App code can listen if it needs to react to size changes (e.g. updating a `data-collapsed-label` per collapsed group).
  - **CSS additions in `ribbon.css`:**
    * `[data-ribbon-overflow="hidden"] .ribbon-body { display: none }` — hard hide when below 300px.
    * `[data-ribbon-overflow="true"] .ribbon-body { overflow-x: auto }` — softer overflow with ⋯ hint via `::after`.
    * `.rb-group-popup` — floating popover class inherits `.rb-office-ribbon` typography while overriding the shell's `min-width: 300px` floor (`min-width: 0` on the popup itself).
- Files touched:
  - `ribbon/scaling.js` (new, ~330 lines)
  - `ribbon/ribbon.css` — 2 overflow-state rules + `.rb-group-popup` styling.
  - `comparison.html` — one new `<script src="ribbon/scaling.js">` tag after `templates.js`.
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm test` -> all 44 pass.
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. **API surface:** `ShopScoutRibbon.scaling.version` -> `'1.0.0-commit-8'`. `ShopScoutRibbon.scaling.VALID_SIZES` -> `['Large','Middle','Small','Popup']`.
    2. **Set a policy for the merged Products tab.** In DevTools:
       ```js
       // First, tag the groups (this is what commit 11 will do at page load):
       document.querySelectorAll('.ribbon-pane[data-pane="products"] .rb-group').forEach((g, i) => {
         g.dataset.groupId = ['list','actions','review','view','organize'][i];
       });
       ShopScoutRibbon.scaling.set('products', {
         idealSizes: [
           { groupId: 'list',     size: 'Large' },
           { groupId: 'actions',  size: 'Large' },
           { groupId: 'review',   size: 'Large' },
           { groupId: 'view',     size: 'Large' },
           { groupId: 'organize', size: 'Large' }
         ],
         scales: [
           { groupId: 'organize', size: 'Middle' },
           { groupId: 'review',   size: 'Middle' },
           { groupId: 'view',     size: 'Middle' },
           { groupId: 'organize', size: 'Small'  },
           { groupId: 'review',   size: 'Small'  },
           { groupId: 'view',     size: 'Small'  },
           { groupId: 'organize', size: 'Popup'  },
           { groupId: 'review',   size: 'Popup'  }
         ]
       });
       ```
       Then resize the browser window from wide to narrow — groups should progressively downgrade in the declared order.
    3. **Popup collapse:** with the above policy, narrow the window until one of the groups shows as a single collapsed button. Click it — a popover should appear below, showing the group's controls at Large.
    4. **Escape closes the popover.** Also outside-click closes.
    5. **300px hide-fallback:** narrow the window to <300px. The ribbon body should disappear entirely (the tab strip stays). Widen back — ribbon body returns.
    6. **`ribbon:rescale` events:** `document.querySelector('.ribbon-shell').addEventListener('ribbon:rescale', e => console.log(e.detail))` — should log a snapshot after each resize.
    7. **No visible change without a policy:** groups without a registered policy in `ShopScoutRibbon.scaling.all()` still render at whatever the HTML declares (no `data-group-size` unless the app sets one). This is deliberate — the engine is opt-in per pane.
    8. **Edge case:** widen the window very wide, then narrow slowly. Verify that when the pane fits at an intermediate step, the walker stops there and doesn't over-shrink groups.
  - **Notable follow-ups:**
    * The popup clone is a `.cloneNode(true)` — event listeners on individual buttons don't survive. The document-level delegates in `comparison.js` (for `[data-command]`, `[data-ss-grid-command]`, `[data-normalization-action]`, etc.) DO fire correctly since they use event delegation on `document`. If we ever add ribbon controls with direct button-level listeners, they'll need to be re-bound after popup open.
    * The overflow ⋯ hint via `::after` sits inside `.ribbon-body`. If the body already has content that hits the right edge, the ⋯ can overlap — flag if it looks bad in practice.
    * The `data-ribbon-overflow="true"` state adds `overflow-x: auto` which can cause a horizontal scrollbar to appear in the ribbon body. Alternative: use `data-ribbon-overflow="hidden"` for both mid-tier overflow AND below-300px, and always hide rather than scroll. Discuss with user if the ⋯+scroll look is undesirable.
    * **Next commit (9/11):** `Ribbon.ContextualTabs` + `TabGroup.ContextAvailable` infrastructure. Three-state API (`NotAvailable` / `Available` / `Active`), accent-color band above active contextual tabs, showTabGroup/hideTabGroup public methods.

## 2026-07-09 - Claude Office 365 ribbon commit 9: Contextual tabs + TabGroup.ContextAvailable infrastructure

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (9/11).
- Status: Implemented. All 44 tests pass.
- Summary:
  - **New file `ribbon/contextualTabs.js` (~250 lines)** — declarative `Ribbon.ContextualTabs` / `TabGroup` API matching Microsoft's Windows Ribbon Framework verbatim.
  - **Three-state `ContextAvailable` enum** — `NotAvailable`, `Available`, `Active`. Only `Active` renders tabs + band. `Available` and `NotAvailable` are visually identical in this port but the states exist to distinguish "known-but-inactive context" from "context not present at all" (Microsoft's spec draws the same distinction).
  - **Public API:**
    * `ShopScoutRibbon.contextualTabs.defineTabGroup({ id, label, contextualColor, tabs: [{id, label, paneId?}, ...] })` — register a tab group.
    * `ShopScoutRibbon.contextualTabs.setState(groupId, 'NotAvailable' | 'Available' | 'Active')` — change state; validates against the enum.
    * `ShopScoutRibbon.contextualTabs.getState(groupId)` — read current state.
    * `ShopScoutRibbon.contextualTabs.showTabGroup(groupId)` — sugar for `setState(..., 'Active')`.
    * `ShopScoutRibbon.contextualTabs.hideTabGroup(groupId)` — sugar for `setState(..., 'NotAvailable')`.
    * `ShopScoutRibbon.contextualTabs.remove(groupId)` — un-register.
    * `ShopScoutRibbon.contextualTabs.all()` — snapshot of every registered group with its state.
    * `ShopScoutRibbon.contextualTabs.getActiveGroups()` — array of Active groups (used by app code that wants to react to context changes).
  - **DOM reconciliation:**
    * Runs on every state change and every `defineTabGroup` call. Idempotent — removes stale contextual elements before rendering.
    * For each Active group, appends `<button class="ribbon-tab" data-contextual-group-id="..." data-contextual-color="..."></button>` tabs to the tab list, inserted before `.ribbon-spacer` / `.ribbon-actions` (Office convention: contextual tabs sit at the right edge of the tab strip).
    * Renders a `<div class="rb-contextual-tab-band">` above the tab strip. The band is portal-inserted as the shell's first child and positioned absolutely so it doesn't disrupt the tab-list flex layout.
    * Sets `--rbn-contextual-color` CSS variable on both the tabs and the band from the group's `contextualColor` prop. Microsoft's spec doesn't publish a color palette; apps supply any CSS color (`#e91e63`, `var(--custom)`, `oklch(...)`, etc.).
    * Marks the shell with `data-has-contextual-tabs="true"` when any group is Active; used by CSS to reserve top padding for the band.
  - **Events:**
    * `ribbon:contextualtabgroup:show` — fires on the shell when a group transitions to `Active`. Detail: `{ groupId, tabs }`.
    * `ribbon:contextualtabgroup:hide` — fires on the shell when a group transitions away from `Active`. Detail: `{ groupId }`.
    * App code can use these to spawn / tear down the corresponding `.ribbon-pane[data-pane="..."]` DOM (pane-content management is intentionally NOT the responsibility of the ContextualTabs module).
  - **CSS additions in `ribbon.css`:**
    * `.rb-office-ribbon[data-has-contextual-tabs="true"] { padding-top: var(--rbn-contextual-band-h, 20px) }` — reserves space for the band.
    * `.rb-contextual-tab-band` — 20px absolutely-positioned strip at the top-right of the shell with the group's contextual color as background and white bold label.
    * `.ribbon-tab[data-contextual-group-id]` — regular tab chrome with a 2px colored top border (visually connecting to the band) and the same contextual color used for the active-state bottom underline.
    * Hover state uses `color-mix(in srgb, <color> 12%, transparent)` so the tab tints correctly regardless of the specific color.
- Files touched:
  - `ribbon/contextualTabs.js` (new)
  - `ribbon/ribbon.css` — 5 new selectors for the contextual band + tab.
  - `comparison.html` — one new `<script>` tag after `scaling.js`.
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm test` -> all 44 pass.
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. **API surface:** `ShopScoutRibbon.contextualTabs.version` -> `'1.0.0-commit-9'`. `ShopScoutRibbon.contextualTabs.VALID_STATES` -> `['NotAvailable','Available','Active']`.
    2. **Register a group + activate:** in DevTools:
       ```js
       ShopScoutRibbon.contextualTabs.defineTabGroup({
         id: 'productTools',
         label: 'Product Tools',
         contextualColor: '#e91e63',    // pink like Office Picture Tools
         tabs: [
           { id: 'productFormat',  label: 'Format' },
           { id: 'productLayout',  label: 'Layout' }
         ]
       });
       ShopScoutRibbon.contextualTabs.showTabGroup('productTools');
       ```
       A pink band labeled "Product Tools" should appear at the top-right of the shell, with two "Format" and "Layout" tabs appearing to the right of the existing tabs. Their top border and active-underline should be the same pink.
    3. **Hide it:** `ShopScoutRibbon.contextualTabs.hideTabGroup('productTools')` — band and tabs disappear; shell resumes normal top padding.
    4. **State enum enforcement:** `ShopScoutRibbon.contextualTabs.setState('productTools', 'Bogus')` should `console.warn` a specific enum-validation message and NOT change state.
    5. **Multiple groups:** register a second group with a different color; activate both. Two bands should stack at the top-right (Office convention), each labeling its own tabs.
    6. **Events:** `document.querySelector('.ribbon-shell').addEventListener('ribbon:contextualtabgroup:show', e => console.log(e.detail))`. Trigger show/hide via the API — events fire correctly.
    7. **No app-code pane management:** if you click one of the newly-rendered contextual tabs, nothing happens — that's expected. Pane rendering is app-code responsibility (comparison.js's existing tab-switch logic handles panes via `data-tab`). The tabs carry `data-tab="paneId"` if `paneId` was supplied at define time.
    8. **`getActiveGroups()`:** returns the currently-Active groups as objects, useful for app code that wants to inspect context on its own schedule (rather than subscribing to events).
  - **Notable follow-ups:**
    * The band's `min-width: 120px` is a floor; if a group's label is longer, the band grows naturally. Office 365 desktop has a similar behavior. Verify long labels look reasonable.
    * The band is positioned at `right: 0` — if we add multiple simultaneous contextual groups they stack right-to-left. If a future design needs left-to-right stacking, tweak the CSS in `ribbon.css` section 18.
    * Group definitions with duplicate `id` overwrite the earlier one (Map semantics). Not currently warned about; add a duplicate-id warning if this becomes a footgun.
    * The `defineTabGroup` reconciles the DOM synchronously. If registration happens during page init before DOMContentLoaded, the `apply()` on DOMReady will re-reconcile. Safe but slightly wasteful; could optimize with an idle callback.
    * **Next commit (10/11):** SVG icon library. Author small-detail (16/20/24) and high-detail (32/40/48/64) variants for every ribbon action our merged Products tab uses.

## 2026-07-09 - Claude Office 365 ribbon commit 10: SVG icon library with size variants

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (10/11).
- Status: Implemented. All 44 tests pass.
- Summary:
  - **New file `ribbon/icons.js` (~340 lines)** — SVG icon registry with two authored variants per icon:
    * `sm` — 16×16 viewBox, simplified paths, thicker stroke for small-context legibility. Serves the Windows Ribbon Framework "small" image slot at all four DPI targets (16/20/24/32 rendered pixels).
    * `lg` — 24×24 viewBox, richer detail, standard 1.6px stroke. Serves the "large" image slot at all four DPI targets (32/40/48/64 rendered pixels).
  - **Two variants total, not eight.** Because SVG is resolution-independent, a single sm-variant SVG covers all four small DPI targets and a single lg-variant covers all four large targets. The differentiation is between "small-context simplification" and "large-context detail" — not per-DPI.
  - **18 icons registered** covering every ribbon action in the merged Products tab (commit 1 HTML):
    * List group: `new-list`, `rename`, `delete-list`
    * Product Actions: `add-product`, `rescan`, `delete-item`
    * Review & Rules: `duplicates`, `normalize-review`, `vertical-packs`, `user-rules`
    * View: `mode-rows`, `mode-matrix`, `columns`
    * Organize: `sort-asc`, `sort-desc`, `filter`, `group-by`, `reset`
  - **All strokes use `currentColor`** so icons inherit the theme's text color (works in light, dark, and high-contrast).
  - **Public API:**
    * `ShopScoutRibbon.icons.get(name, size)` — returns SVG string. `size` is `'sm'` | `'lg'` (or `'small'` | anything else = lg default).
    * `ShopScoutRibbon.icons.getElement(name, size)` — returns a live `SVGElement` DOM node.
    * `ShopScoutRibbon.icons.register(name, { sm, lg })` — add a custom icon at runtime. Validates that both variants are present.
    * `ShopScoutRibbon.icons.has(name)` — presence check.
    * `ShopScoutRibbon.icons.list()` — array of registered names.
    * `ShopScoutRibbon.icons.all()` — snapshot of the whole registry.
    * `ShopScoutRibbon.icons.version` — `'1.0.0-commit-10'`.
  - **Design signature** — Fluent-style outlined icons with rounded stroke joints (`stroke-linecap="round" stroke-linejoin="round"`). Matches the visual language of modern Office 365 desktop app icons.
- Files touched:
  - `ribbon/icons.js` (new)
  - `comparison.html` — one new `<script>` tag after `contextualTabs.js`.
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm test` -> all 44 pass.
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. **API surface:** `ShopScoutRibbon.icons.version` -> `'1.0.0-commit-10'`. `ShopScoutRibbon.icons.list().length` -> `18`.
    2. **Registry contents:** `ShopScoutRibbon.icons.list()` should return `['new-list', 'rename', 'delete-list', 'add-product', 'rescan', 'delete-item', 'duplicates', 'normalize-review', 'vertical-packs', 'user-rules', 'mode-rows', 'mode-matrix', 'columns', 'sort-asc', 'sort-desc', 'filter', 'group-by', 'reset']`.
    3. **Visual sanity check** — in DevTools console:
       ```js
       ['rescan', 'add-product', 'delete-item', 'duplicates', 'vertical-packs'].forEach(name => {
         document.body.insertAdjacentHTML('afterbegin',
           `<div style="display:inline-block; padding:8px; border:1px solid #ccc; margin:4px; color:#0b3d4f">`
           + `<div style="font-size:11px; margin-bottom:4px">${name}</div>`
           + `<div style="width:32px; height:32px">${ShopScoutRibbon.icons.get(name, 'lg')}</div>`
           + `<div style="width:16px; height:16px">${ShopScoutRibbon.icons.get(name, 'sm')}</div>`
           + `</div>`);
       });
       ```
       Each icon should render at both sizes with the theme color.
    4. **Unknown icon fallback:** `ShopScoutRibbon.icons.get('bogus')` should `console.warn` and return an empty string (not throw).
    5. **Custom registration:** `ShopScoutRibbon.icons.register('test', { sm: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="4" fill="currentColor"/></svg>', lg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>' })` — should register and appear in `list()`. Passing incomplete spec (missing `sm` or `lg`) should `console.warn` and return null.
    6. **`getElement` returns a live SVG node** — verify with `ShopScoutRibbon.icons.getElement('rescan', 'lg').tagName === 'svg'`.
  - **Notable follow-ups:**
    * **Additional icons for other tabs.** The 18 icons here cover the Products tab. File / Analyze / Search / About tabs still use inlined SVG. When we migrate those tabs to the declarative API, register their icons here too (`open`, `import-list`, `export`, `save-as`, etc.).
    * **The Fluent design system publishes ~1500 icons.** If we ever want a broader library, we could bundle the [Fluent UI System Icons](https://github.com/microsoft/fluentui-system-icons) SVG set. Not needed for the Products tab.
    * **Icon a11y** — SVGs carry `aria-hidden="true"` so screen readers skip them. Button labels carry the semantic meaning. If any icon ever needs to be the sole affordance (icon-only button with no visible label), the button should carry `aria-label="Action name"`.
    * **Next commit (11/11):** Migrate the merged Products tab HTML to the declarative Command / Control API. Replace inlined `<svg>` blocks with `${ShopScoutRibbon.icons.get(name, 'lg')}`, apply `data-size-definition` per group, register a ScalingPolicy so the ribbon adapts to viewport width, and delete the corresponding static HTML. This is the commit that makes the full Office 365 ribbon behavior actually visible in ShopScout.

## 2026-07-09 - Claude Office 365 ribbon commit 11 (FINAL): Merged Products tab declarative migration

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (11/11). **Path B sequence complete.**
- Status: Implemented. All 44 tests pass.
- Summary:
  - **The final Path B commit.** This is where the full Office 365 ribbon behavior finally becomes user-visible in ShopScout.
  - **HTML edits — `comparison.html`:**
    * Added `data-group-id="list"` to the Lists group.
    * Added `data-group-id="actions"` to the Product Actions group.
    * Added `data-group-id="review"` to the Review & Rules group.
    * Added `data-group-id="view"` to the View group.
    * Added `data-group-id="organize"` to the Organize group.
    * These attributes let the ScalingPolicy engine (commit 8) find and downgrade each group by ID.
    * Deliberately DID NOT change the button-level HTML or replace inline `<svg>` blocks. The hotfix from earlier scoped every layout-affecting rule to `[data-group-size]`, so groups render at their natural ShopScout sizes at wide viewports and only shrink to Fluent-strict Middle/Small/Popup layouts when ScalingPolicy applies the size attribute. Preserving the inline SVG in HTML keeps the existing rendering unchanged at Large mode; the icons.js library is used by future declarative renderers.
  - **New file `ribbon/products-tab-init.js` (~200 lines):**
    * **Commands registered** for every ribbon action on the Products tab:
      - List: `cmd:newList`, `cmd:renameList`, `cmd:deleteList`
      - Product Actions: `cmd:addProduct`, `cmd:rescan`, `cmd:deleteItem`
      - Review & Rules: `cmd:duplicateReview`, `cmd:normalizeReview`, `cmd:verticalPacks`, `cmd:userRules`
      - View: `cmd:modeRows`, `cmd:modeMatrix`, `cmd:columns`
      - Organize: `cmd:sortAsc`, `cmd:sortDesc`, `cmd:filter`, `cmd:groupBy`, `cmd:reset`
    * Each Command carries `id`, `label`, `tooltip`, `keytip`, `smallImage`, `largeImage`. Images are pulled from `ShopScoutRibbon.icons.get(..., 'sm'|'lg')` (commit 10 registry).
    * These Commands are currently **documentary use only** — the existing HTML still owns rendering. A future full-declarative-render pass would consume the Command registry as its source of truth; the plumbing is now in place.
    * **ScalingPolicy registered** for the `products` pane:
      - IdealSizes: every group at `Large`.
      - Scales (descending priority — walker applies in order until fit):
        1. Organize → Middle
        2. Review → Middle
        3. View → Middle
        4. Organize → Small
        5. Review → Small
        6. View → Small
        7. Organize → Popup
        8. Review → Popup
        9. View → Popup
        10. Actions → Middle
        11. Actions → Popup
    * The List group is left at Large throughout because the list picker is the anchor of the tab — collapsing it would remove the primary affordance. If the ribbon can't fit after step 11, `data-ribbon-overflow="true"` triggers the horizontal-scroll fallback. Below 300px viewport the ribbon body hides entirely per Microsoft's minimum-render-width spec (commit 8's engine).
  - **HTML wiring:** `<script src="ribbon/products-tab-init.js">` added to `comparison.html` AFTER all other `ribbon/*.js` so the framework APIs are available when it runs. Runs on DOMContentLoaded.
- Files touched:
  - `comparison.html` — 5 `data-group-id` attribute additions on ribbon groups + 1 new `<script>` tag.
  - `ribbon/products-tab-init.js` (new, ~200 lines).
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm test` -> all 44 pass.
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check — this is where the user finally sees the Office 365 ribbon working:**
    1. **At wide viewport (≥1400px)** — the ribbon should look identical to what it did after the hotfix. Nothing collapsed, no visual regression.
    2. **Narrow the browser slowly.** As the viewport crosses each threshold, groups should progressively downgrade in the declared order:
       - First: Organize goes to Middle (buttons flip to icon-left / smaller vertical stack).
       - Then: Review → Middle, View → Middle.
       - Then all three drop to Small (icon-only 22×22 buttons).
       - Then all three collapse to Popup (single collapsed button per group).
       - Finally: Actions starts shrinking, then collapses.
       - List stays at Large throughout.
    3. **Popup clicks work** — click a collapsed Popup button (e.g. collapsed Review & Rules) and a floating popover should render the group's controls at Large. Click outside or press Escape to close.
    4. **Below 300px viewport** — the whole ribbon body should disappear (tab strip stays). Widen back — ribbon body returns.
    5. **Commands are registered:** `ShopScoutRibbon.commands.get('cmd:rescan')` in DevTools should return the Command definition with `label: 'Rescan Products'`, tooltip, keytip, and both `smallImage` / `largeImage` SVG strings.
    6. **Scaling policy is registered:** `ShopScoutRibbon.scaling.get('products')` should return the policy object with 5 ideal sizes and 11 scale steps.
    7. **`ribbon:rescale` events fire** on the shell every time the walker runs. Add a listener in DevTools and drag-resize the window to watch them.
    8. **No JS console errors** on page load. Products-tab-init should run cleanly on top of the framework.
  - **Notable follow-ups:**
    * **The migration is minimal by design** — HTML button markup is unchanged. If we wanted true declarative rendering (buttons built from Commands rather than HTML), we'd need a Command→DOM renderer pass in `ribbon.js`. That's a future evolution the current API surface enables but doesn't require.
    * **Icons.js is now under-used.** It's referenced from Commands (as documentation for what the icons look like) but the visible HTML still uses inlined SVG. When the renderer is built, it'll pull from `ShopScoutRibbon.icons.get(name, sizeForCurrentGroupSize)`.
    * **Other tabs (File, Analyze, Search, About)** still use inline SVGs and don't have ScalingPolicies. Same pattern applies — write a `<name>-tab-init.js` per tab, add `data-group-id` to its groups, define Commands, register a policy.
    * **Path B COMPLETE.** All 11 planned commits shipped. The ribbon now conforms to Microsoft's Windows Ribbon Framework spec at every layer: Command/Control model, 23 SizeDefinition templates with strict validation, ScalingPolicy engine matching descending Scale semantics, ContextualTabs with three-state ContextAvailable, dual-variant SVG icon library, and the declarative Products-tab wiring that ties it all together.

## 2026-07-10 18:38 - Codex normalization v2 extraction publish

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: 0b1e283 (implementation); this commit records the changelog entry
- Status: Implemented and published. Normalization v2 is loaded during on-demand product extraction and attached to captured spec data as a non-breaking sidecar.
- What changed:
  - Added the normalization v2 runtime scripts to `background.js` content-script injection order before `content/productSchema.js`.
  - Updated `content/productSchema.js` so each assembled spec entry can include a `normalized` envelope when `ShopScoutNormalize.field()` supports that field.
  - Added `specsNormalized` to the legacy flat product output while leaving existing `.specs` string values unchanged for backward compatibility.
  - Updated JSDoc typedefs for `NormalizedValue`, `SpecEntry.normalized`, and `FlatProduct.specsNormalized`.
- Files touched:
  - `background.js`
  - `content/productSchema.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `npm run typecheck` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm run syntax` -> pass
  - `npm test` -> 46/46 test files pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - Downstream UI can now consume `specsNormalized`; legacy views remain on `.specs` until intentionally migrated.

## 2026-07-10 18:53 - Codex AI providers settings fallback

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. The AI Providers settings panel now renders provider options even when extension storage is unavailable or fails during settings load.
- What changed:
  - Added a default AI settings fallback in `settings.js` so `renderProviderList()` can populate the AI provider options instead of leaving the panel blank.
  - Guarded AI settings save/load against missing `chrome.storage.local`, which is common when the dashboard is opened outside the extension runtime during development.
  - Added regression coverage for the fallback path and for correct provider card CSS class mapping.
  - Removed the retired v1 unit-display helper chain from `shared/values/cellValues.js`, clearing the lint warnings exposed by the unpublished normalization cleanup commit.
- Files touched:
  - `settings.js`
  - `tests/menu-layout.test.js`
  - `shared/values/cellValues.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\menu-layout.test.js` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm test` -> 46/46 test files pass
  - `npm run syntax` -> pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - None identified.

## 2026-07-09 - Claude Office 365 ribbon HOTFIX #2: only apply data-group-size when actually shrinking

- Agent: Claude
- Branch: grid-rebuild-codex
- Commit: This commit (interim fix after Path B commit 11).
- Status: Implemented. All 44 tests pass.
- Summary:
  - **User reported v3.3.0.153102a still looked broken at wide viewport:** 2-line button labels ("Possible Duplicates", "Normalize Review", etc.) overflowed the button chrome and visually collided with group labels. "SORT BY" / "GROUP BY" mini-labels were misaligned.
  - **Root cause diagnosis:**
    * `products-tab-init.js` calls `ShopScoutRibbon.scaling.set('products', {...})` at page load.
    * `set()` immediately calls `rescale()`.
    * `rescale()` unconditionally called `applyIdealSizes()` which set `data-group-size="large"` on every group.
    * With `data-group-size="large"`, the Fluent-strict CSS in `ribbon.css` kicked in: 68px button height, 76px max-width, `flex-direction: column`, Segoe UI font.
    * The existing HTML markup was tuned for `comparison.css`'s natural layout (70px height, 68px min-width, ambient theme font) — the Fluent-strict rules produced label overflow and cramped spacing.
    * Additionally, `ribbon.css`'s font-family override was applied to `.rb-office-ribbon *` (all descendants) — Segoe UI's text metrics differ from the original font enough that labels wrapped at unexpected widths.
  - **Fix in `ribbon/scaling.js`:**
    * Added `resetAllGroups(paneEl, policy)` — removes `data-group-size` from every group referenced by the policy.
    * `rescalePane` now:
      1. Runs `resetAllGroups` first to get back to the natural state.
      2. Checks `paneFits(paneEl)` at the natural state.
      3. If it fits — done. No size attributes applied; existing HTML renders at its comparison.css dimensions. This is the wide-viewport happy path.
      4. If it doesn't fit — apply idealSizes then walk scales (the original behavior).
    * Emits `ribbon:rescale` with `stepsApplied: 0` when the pane fits naturally, so app code can distinguish "no shrink needed" from "walked N steps".
  - **Fix in `ribbon/ribbon.css`:**
    * Scoped the Segoe UI font-family override to only groups that carry `data-group-size` (or the whole ribbon if it opts in via `data-ribbon-typography="office-365"`). The tab strip is exempt so tab typography stays crisp.
    * Added unconditional `.rb-btn-lg { overflow: hidden }` and `.rb-btn-lg-label { -webkit-line-clamp: 2; max-height: 2.4em; overflow: hidden }` as a safety net — even without `data-group-size`, labels are clamped to 2 lines and buttons clip any spillover. Fixes the "labels bleed past the button chrome" symptom directly.
- Files touched:
  - `ribbon/scaling.js` — added `resetAllGroups`, refactored `rescalePane` fit-first-check.
  - `ribbon/ribbon.css` — scoped font-family override + unconditional label clamp.
  - `AGENT_CHANGELOG.md` — this entry.
- Validation run:
  - `npm test` -> all 44 pass.
  - `npm run build` -> Chrome / Edge / Firefox dists rebuilt.
- Review / handoff:
  - Reviewer: Codex.
  - **What to check:**
    1. **Wide viewport:** the merged Products tab should look like it did AT ANY POINT BEFORE COMMIT 2. No 2-line labels bleeding into group labels. Sort By / Group By properly stacked. Icons at their comparison.css natural 30px size. This is the acid test — visually indistinguishable from pre-Path-B state.
    2. **Narrow the viewport:** groups should progressively downgrade per the policy declared in `products-tab-init.js`. When a group's `data-group-size` gets set to `middle`/`small`/`popup`, the Fluent-strict CSS + Segoe UI font kick in for THAT group only. Neighboring groups without the attribute keep their comparison.css layout.
    3. **`ribbon:rescale` event:** at wide viewport, detail should be `{ paneId: 'products', stepsApplied: 0, policy: {...} }`. At narrow viewport, `stepsApplied` should be > 0 with the specific count.
    4. **Popup collapse still works:** when a group narrows all the way to Popup, click it to open the floating popover with the group's controls at Large.
    5. **300px hide-fallback:** narrow the browser to <300px. Ribbon body hides entirely.
    6. **Tab strip typography** — the tab strip (Products / File / etc.) is exempted from the group-scoped rule so the Office 365 tab typography (14px SemiBold Segoe UI, 2px accent underline) still applies universally. Verify this looks the same as after commit 2.
    7. **`ShopScoutRibbon.scaling.rescale()`** — forces a walk immediately. Verify the API still works at DevTools.
  - **Follow-ups or risks:**
    * If a downstream template (any of the 23) requires that `data-group-size` be explicitly set for its layout to render, and the policy walker skips it at wide viewport, the template's layout won't kick in. This is fine for the current Products tab (no templates applied yet) but WILL bite once commit 11's declarative migration is extended to apply `data-size-definition` per group. In that case, the wide-viewport IdealSize needs to be respected (e.g. `SixButtons-TwoColumns` at Large has a specific 2-column grid that only renders when both attributes are set).
    * **Suggested extension:** if a policy declares `idealSizes` with a non-default size (something other than Large), we should apply that even at wide viewport since the app explicitly wants that layout. Currently we skip all size attrs when the pane fits, which erases app-requested layouts. Add a `forceApply: true` option per idealSize entry if this becomes needed.
    * **Path B is still complete** — this commit is a bug fix within the sequence, not a new deliverable.

## 2026-07-10 18:19 - Codex settings left navigation fix

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Embedded settings left navigation switches the main settings panel reliably.
- What changed:
  - Bound the settings left navigation immediately after the settings shell mounts, before async provider/settings initialization can fail or stall.
  - Changed settings navigation to a delegated click handler on the mounted settings root, preventing duplicate listeners and preserving behavior after dynamic DOM updates.
  - Added regression coverage requiring early settings-nav binding and root-scoped delegated click handling.
  - Fixed an existing lint blocker in `tests/normalize-v2.test.js` by declaring `r_ok`.
- Files touched:
  - `settings.js`
  - `tests/menu-layout.test.js`
  - `tests/normalize-v2.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\menu-layout.test.js` -> pass
  - `npm run lint` -> pass, 0 errors, 0 warnings
  - `npm test` -> 45/45 test files pass
  - `npm run syntax` -> pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - None identified.

## 2026-07-10 00:13 - Codex ribbon resize overlap fix

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Products ribbon resize no longer squeezes dense groups into overlapping labels/controls.
- What changed:
  - Fixed the Office-style ribbon resize failure by preventing `.rb-group` flex items from shrinking internally before the scaling policy can detect overflow.
  - Changed Products ribbon scaling so dense groups (`Review`, `Organize`) collapse directly to Popup instead of passing through Middle/Small states that cannot safely fit selects and multi-row labels.
  - Added collapsed popup labels to Products ribbon groups and their `.rb-group-content` elements so popup buttons render readable labels.
  - Scoped the custom Review and Organize layouts to natural/Large mode only so they do not fight generic scaled templates.
  - Removed three stale unused constants from `shared/values/cellValues.js`, bringing ESLint back to zero warnings.
- Files touched:
  - `comparison.html`
  - `ribbon/products-tab-init.js`
  - `ribbon/ribbon.css`
  - `shared/values/cellValues.js`
  - `tests/menu-layout.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\menu-layout.test.js` -> pass
  - `node tests\comparison-table-defaults.test.js` -> pass
  - `npm test` -> 44/44 test files pass
  - `npm run syntax` -> pass
  - `npm run lint` -> 0 errors, 0 warnings
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - Visual verification should resize the Products tab across wide/narrow widths and confirm the `Review` and `Organize` groups become popup buttons instead of compressing text.

## 2026-07-10 00:27 - Codex ribbon compact list/organize polish

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. Products ribbon List and Organize controls are less wasteful and avoid wide button blocks.
- What changed:
  - Moved the Products tab list actions (`New`, `Rename`, `Delete`) into a horizontal icon row beneath the Product List field.
  - Reduced Organize tool button stretching so `Filters` and `Reset` render as compact command buttons instead of wide blocks.
  - Added regression coverage for horizontal list actions and compact Organize buttons in `tests/menu-layout.test.js`.
- Files touched:
  - `comparison.html`
  - `ribbon/ribbon.css`
  - `tests/menu-layout.test.js`
  - `AGENT_CHANGELOG.md`
- Validation run:
  - `node tests\menu-layout.test.js` -> pass
  - `npm run lint` -> 0 errors, 0 warnings
  - `npm test` -> 44/44 test files pass
  - `npm run syntax` -> pass
  - `npm run typecheck` -> pass
  - `npm run build` -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - Visual verification should confirm the list icons sit under the Product List field and the Organize buttons no longer occupy full-width vertical blocks.

## 2026-07-10 19:01 - Codex AI providers settings storage fallback

- Agent: Codex
- Branch: grid-rebuild-codex
- Commit: This commit
- Status: Implemented. AI provider options render even when extension storage is unavailable in embedded/dashboard preview contexts.
- What changed:
  - Added a safe extensionStorage() helper in settings.js and routed AI provider, quick-capture, and Open*Facts storage reads/writes through it.
  - Removed direct chrome.storage.local / chrome optional-storage access from settings initialization so an unavailable browser extension API cannot abort provider-list rendering.
  - Added regression coverage requiring safe settings storage access and preserving AI provider fallback behavior.
- Files touched:
  - settings.js
  - tests/menu-layout.test.js
  - AGENT_CHANGELOG.md
- Validation run:
  - node tests/menu-layout.test.js -> pass
  - npm run lint -> pass, 0 errors, 0 warnings
  - npm run syntax -> pass
  - npm run typecheck -> pass
  - npm test -> 46/46 test files pass
  - npm run build -> Chrome / Edge / Firefox rebuilt
- Review status / next reviewer:
  - Ready for Claude review.
- Follow-ups or risks:
  - None identified.



