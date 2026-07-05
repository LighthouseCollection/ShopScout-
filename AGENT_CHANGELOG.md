# ShopScout Agent Change Log

This file is the shared record for Claude and Codex. Append an entry for every meaningful change so both agents can continue from the same factual project history.

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
