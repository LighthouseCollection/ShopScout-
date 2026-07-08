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

