# Issue Triage — 2026-07-08

Triage of the 22 open GitHub issues on `LighthouseCollection/ShopScout-`.
Reviewed by Claude while Codex is offline (until ~02:45 AM PST).
Codex should read this before starting the next work session.

## Distribution

- **21 → Codex** (runtime + UI + settings + grid + normalization review)
- **1 → Claude, joint with Codex** (#3 — vertical mapping + runtime breadcrumb parser)
- 0 that don't fit either

## Priority ranking

**P0 (visible bugs / user confusion, ship first)**
- #3 — vertical detection fails on obvious breadcrumb (real user report)
- #4 — spec attribute pairing wrong (data quality bug in normalize table)
- #21 — normalize table shows `field → field` `value → value` when no transform happened (looks like duplication, is actually a display bug)
- #12 — empty table space when few products (visual regression)
- #14 — Source column serves no clear purpose (grid column config)
- #22 — datagrid multi-issues (column widths, text selection, rating layout)

**P1 (settings + UI polish, ship next)**
- #7 — Dashboard Icon (need to see attached images)
- #8 — wrong horizontal line (visual, need images)
- #9 — Settings Menu Spacing (CSS)
- #15 — Settings AI provider containers redesign (expand/collapse with on/off state)
- #16 — Settings left-menu content (copy/wording)
- #18 — AI API setup from settings.html (need image)
- #13 — text can't be cut off in product comparison (need image)
- #1 — cost rounding to nearest $5 (nice UX polish, well-documented user proposal)
- #5 — list-like feature values → pills with sort + qty format (formatter enhancement)
- #19 — reuse SlickGrid for another table view (consistency)

**P2 (docs / help / questions — can batch)**
- #6 — vertical packs terms explanation ("unmapped", relation to accept/ignore)
- #10 — Shop Scout button on product page — user wants a mockup
- #11 — "What is user rules???" — needs UI help text
- #17 — Open*Facts Enrichment — needs UI explanation
- #20 — Rescan products — needs UI explanation

**P3 (already tracked as follow-up, not new work)**
- #2 — my own earlier review-noted "leftover" observations. Non-blocking optimizations.

## Clusters (fix in batches)

**Settings redesign cluster** — #9, #15, #16, #18
Single work item: rework settings.html + settings.js to match user's spec in #15 (per-provider expandable cards with on/off), consistent between dashboard-embedded settings and standalone. #16 gives copy. #18 = need to see the image; likely current visual bug that goes away with the redesign. #9 = spacing that the redesign fixes.

**Grid / DataGrid cluster** — #1, #12, #13, #14, #19, #22
Grid config + formatters. Includes column-width strategy (#22), no-more-empty-space (#12), Source column removal (#14), rating cell layout (#22), text selection (#22), price rounding (#1), text truncation (#13), reuse in other views (#19). Codex owns the whole grid.

**Normalize table cluster** — #4, #5, #21, #6
The review UI shows `field → field` `value → value` when no transformation actually happened → confusing (#21). Underlying issue in #4: for compound attributes (product has "Additional Features: Cordless, Portable, USB Charging Cord..."), the split gives per-value rows but the FIELD name for each row is still `Additional Features` — user expects the individual feature words to be attributes themselves. #5 wants those list values rendered as sorted pills with `(× N)` italic-smaller qty. #6 asks what "unmapped" means and whether prior Accept/Ignore actions still apply.

**Vertical pack cluster** — #3, #6, #11
#3 is the biggest — detection fails on `Tools & Home Improvement > Power & Hand Tools > Power Tools > Air Compressors & Inflators > Portable Air Compressors`. Two fixes needed:
- Claude: extend keyword rules in `scripts/build-normalization-libraries/build-vertical-mapping.js` to catch `air compressor`, `tools & home improvement`, `power tools` mapping to Hardware
- Codex: `verticalIdFromName` in `generatedPacks.js` should try MULTIPLE breadcrumb segments, not just the first (I flagged this as a Suggestion in the `3561c22` review — user's #3 confirms it matters)
#11 and #6 are UX questions about user rules and vertical packs — need help text.

**Help / tooltip cluster** — #6, #10, #11, #17, #20
Add help text / tooltips / info modals to explain: user rules (#11), Open*Facts enrichment (#17), Rescan products confirm dialog wording (#20), Shop Scout FAB (#10 — needs a mockup / visual for the docs page), vertical pack "unmapped" (#6).

---

## Per-issue triage

### #1 — Cost Rounding in the Data Grid
- **Owner**: Codex
- **Priority**: P1
- **Type**: enhancement
- **Notes**: User has a fully-specified proposal: `Math.round(price / 5) * 5`. Not a straight round-to-integer; snap to nearest 5. Toggle location is up to us — user says "App Extension settings or Product Table View." Recommend Product Table View (View ribbon) → local to the grid, no global config.
- **Files**: `grid-rebuild-codex/formatters` (or wherever the price cell formatter lives), plus a View-ribbon toggle.
- **Tests**: unit test `roundToNearestFive(24.29) === 25`, `roundToNearestFive(692) === 690`, `roundToNearestFive(143) === 145`.

### #2 — Leftover observations
- **Owner**: Codex
- **Priority**: P3
- **Type**: tech debt (non-blocking)
- **Notes**: These came out of my review of `23566ec`. Non-blocking. Can be closed with a WONTFIX or "will address if it hits a real bottleneck." No action required unless someone hits the issue in practice.

### #3 — Error: NO vertical Detected (Portable Air Compressor)
- **Owner**: Claude + Codex (joint)
- **Priority**: P0
- **Type**: bug
- **Notes**: Real user report. Air compressor page has clear Amazon breadcrumb `Tools & Home Improvement > Power & Hand Tools > Power Tools > Air Compressors & Inflators > Portable Air Compressors`. Detection returned "no reliable vertical detected."
- **Root cause split**:
  - **Claude**: `build-vertical-mapping.js` VERTICAL_RULES don't currently match "air compressor" or "tools & home improvement". Add hardware keywords: `/\bair compressor/i`, `/\btools?\b/i` (with careful boundaries), `/\bpneumatic/i`, `/\bhome improvement/i`. Regenerate `icecat_category_to_vertical.json`.
  - **Codex**: `generatedPacks.js:verticalIdFromName` only tries the FIRST breadcrumb segment. On this input `Tools & Home Improvement > ...`, first segment doesn't match a vertical name. Should walk down the breadcrumb, trying each segment in order (leaf-first would actually work better here since "Portable Air Compressors" is more specific). I flagged this as a Suggestion in the 3561c22 review — this issue confirms it's not just theoretical.
- **Both fixes are independent** — either alone would help. Both together are ideal.

### #4 — Additional Features In Normalize table is wrong
- **Owner**: Codex (review UI + attribute extractor rules)
- **Priority**: P0
- **Type**: bug (data quality)
- **Notes**: When Amazon lists specs like `Additional Features: Cordless, Portable, USB Charging Cord`, the extractor is producing per-value review rows with FIELD = "Additional Features" and VALUE = one of the split values. User's insight is that the individual values ARE the attributes, not values OF a wrapper attribute called "Additional Features". Similar for "Special Features".
- **Fix direction**: for well-known wrapper fields (`Additional Features`, `Special Features`, `Included Items`, `Compatible Devices`, `Recommended Use`), don't just split the values (which Codex already did in 83d08dc) — try to promote each split value to be its own attribute if the value looks like a canonical attribute name/enum value. If unmappable, fall back to current behavior. Needs attribute-vs-value classifier; may need a curated list per wrapper field.
- **User's suggestion**: "Always start backwards — every value has to have a field, every field has to have an attribute." Interpret as: don't emit review items whose FIELD is a wrapper category and VALUE is a substring; instead try to resolve the value to a real attribute first.

### #5 — Normalizing Data (pill formatting for list values)
- **Owner**: Codex
- **Priority**: P1
- **Type**: enhancement
- **Notes**: For fields like `Included Items: Cordless Tire Inflator × 1, Quick Connector × 1, USB Charging Cord × 1, ...` — user wants:
  - Split into separate pills
  - Sort alphabetically
  - Format each pill as `Quick Connector (× 1)` where `(× 1)` is italic + smaller font
- **Files**: whichever formatter renders list-like spec values. Probably `grid-rebuild-codex/slickGridAdapter.js` or a shared `shared/values/cellValues.js`.
- **Related**: #4 (the wrapper-split logic that produces these values in the first place).

### #6 — Vertical Packs — "unmapped" and Accept/Ignore
- **Owner**: Codex
- **Priority**: P2
- **Type**: docs / UI help text
- **Notes**: User asking two related questions:
  1. What does "unmapped" mean on a review row's `rule: unmapped`?
  2. Are Accept/Ignore actions from before still relevant?
- **Fix**: add tooltip/info affordance next to `Rule: unmapped` explaining it. Also verify: prior Accept/Ignore actions ARE still applied via `userRules.js` — confirm and document.

### #7 — Dashboard Icon
- **Owner**: Codex
- **Priority**: P1 (visual bug — need to see images to confirm scope)
- **Type**: bug (need visual)
- **Notes**: 2 attached images. Body has no text. Codex needs to open the issue on GitHub to see what's wrong. If it's a missing icon / wrong sizing, small fix.

### #8 — wrong horizontal line
- **Owner**: Codex
- **Priority**: P1 (visual bug — need to see images)
- **Type**: bug (need visual)
- **Notes**: 2 attached images. No body text. Likely a CSS `border-bottom` / `hr` in the wrong place.

### #9 — Settings Menu Spacing
- **Owner**: Codex
- **Priority**: P1
- **Type**: bug (CSS)
- **Notes**: "Incorrect… no spacing between menu items." Attached image shows the issue. CSS fix in `settings.css`.
- **Related**: part of the settings redesign cluster (#15, #16, #18). Might auto-resolve when Codex tackles #15.

### #10 — Shop Scout Button on Product Page
- **Owner**: Codex
- **Priority**: P2
- **Type**: docs (mockup ask)
- **Notes**: User wants a mockup/example illustrating where the FAB (`Floating Capture Button`) appears on a product page. This is documentation / a help modal.
- **Fix**: add a labeled diagram / mockup image to Settings > Quick Capture Button > Preview area, showing dummy product page with FAB highlighted.

### #11 — What is user rules???
- **Owner**: Codex
- **Priority**: P2
- **Type**: docs / UI help
- **Notes**: Add explanation to the User Rules page header/intro (Codex added the page in 69c5043). One-paragraph explanation of what user rules are (per-list overrides for field aliases + ignored review items).

### #12 — Empty Table Space
- **Owner**: Codex
- **Priority**: P0 (visible regression)
- **Type**: bug
- **Notes**: When there are few products, the grid still shows a full-height empty table. User wants the container to shrink to fit content.
- **Fix**: SlickGrid `autoHeight: true` OR wrap the grid in a container with `height: max-content` and let CSS handle it. Careful: `autoHeight: true` disables virtual scrolling — fine for small lists.

### #13 — Text can not be cut off in product comparison
- **Owner**: Codex
- **Priority**: P1
- **Type**: bug (need image)
- **Notes**: Text truncation issue in the product comparison view. Need image to know if it's overflow-hidden that shouldn't be, or wrapping that isn't happening. Body is just image.

### #14 — Unnecessary Source label
- **Owner**: Codex
- **Priority**: P0
- **Type**: enhancement / cleanup
- **Notes**: User doesn't understand purpose of Source column. Options:
  1. Remove it entirely
  2. Explain via tooltip
- **Recommend**: remove the column from default view; keep it available in the columns modal so users who want it can add it back. Source of the product (Amazon, Walmart, eBay) is still visible via the product URL and via the retailer logo/pill in Codex's earlier design.

### #15 — Settings Left Menu: AI Menu Selection
- **Owner**: Codex
- **Priority**: P1
- **Type**: redesign (well-specified)
- **Notes**: User has full spec:
  - Consistent between `settings.html` (standalone) and dashboard-embedded settings
  - Each AI provider = collapsible container
  - Header shows On (muted green) or Off (muted pink) label, or highlight container background
  - Full provider list: OpenAI, Claude/Anthropic, Google Gemini, Perplexity, Grok/xAI, DeepSeek, Mistral AI, Poe, Meta Llama, Microsoft Copilot, Local LLM (Ollama/LM Studio)
- **Files**: `settings.html`, `settings.css`, `settings.js`, plus the corresponding dashboard-embedded views.
- **Related**: #9 (spacing), #18 (screenshot bug that probably goes away).

### #16 — Settings Left Menu
- **Owner**: Codex
- **Priority**: P1
- **Type**: docs (menu copy)
- **Notes**: User has provided the left-menu content copy. Just needs to be inserted. Companion to #15.

### #17 — What is Open Facts Enrichment
- **Owner**: Codex
- **Priority**: P2
- **Type**: docs / UI help
- **Notes**: User has already written the explanation — Codex just needs to insert it into the Open*Facts settings section. Text: "Optional. When a product page has a GTIN/UPC/EAN, ShopScout can ask the open Open*Facts databases for richer structured data and merge missing fields into the captured product. No personal data is sent — only the barcode. Enable Open*Facts enrichment sources: Open Food Facts (groceries), Open Beauty Facts (cosmetics), Open Pet Food Facts (pet food), Open Products Facts (everything else)."

### #18 — AI API setup from settings.html
- **Owner**: Codex
- **Priority**: P1 (need image)
- **Type**: bug (need visual)
- **Notes**: Attached image. Likely visual issue in current settings screen. Cluster with #15.

### #19 — Use the same table datagrid engine as products
- **Owner**: Codex
- **Priority**: P1
- **Type**: enhancement (consistency)
- **Notes**: User wants the SlickGrid engine reused for another table (per attached image). Which table? Need to see the image but it's likely the normalize-review table, the user-rules table, or the duplicate-review table.
- **Fix direction**: extract the current SlickGrid setup into a reusable component that other tables can call with `{columns, rows, options}`. Then replace whatever table view #19 refers to.

### #20 — Rescan products
- **Owner**: Codex
- **Priority**: P2
- **Type**: docs / help text
- **Notes**: User quotes the confirm dialog: `"Rescan 1 product(s)? This will re-visit each URL one at a time with short pauses between pages. This may take a while for large lists."` and asks: "Confirm what this does?" — meaning: they read the dialog but still aren't sure. Improve the wording. Suggestion: "Rescan re-fetches the product page from its original URL, updates price / availability / specs. Original list order + your notes are preserved."

### #21 — Duplication of Field and value in normalize table
- **Owner**: Codex
- **Priority**: P0
- **Type**: bug (display)
- **Notes**: Confirmed from image — the review table shows FIELD `Additional Features → Additional Features` and VALUE `Cordless → Cordless`. When there is no transformation, don't render both sides. Render one side only (or render with a subtle "no change" indicator).
- **Fix direction**: in the review table renderer, compare raw vs normalized. If identical, render single-column. If different, render the arrow layout.
- **Related**: this is the visual expression of #4's data problem. #4 is upstream, #21 is display.

### #22 — Datagrid UI issues
- **Owner**: Codex
- **Priority**: P0
- **Type**: bug / enhancement bundle
- **Sub-issues** (from body):
  1. Column widths: currently causing horizontal scroll. User accepts scroll but wants columns to size to their content (either column header text or column value, whichever is wider) — no wasted column width.
  2. Text selection: cells don't allow text selection. Should behave like typical browser text selection so users can copy/paste values.
  3. Rating cell: currently shows `★★★★★ 4.4(15,129)` inline. User wants number of ratings on a second line beneath the stars.
- **Files**: `grid-rebuild-codex/slickGridAdapter.js`, plus CSS.

---

## Coordination notes

**Codex work order suggestion:**

1. **First session** (P0 bugs, small scope): #14 (remove Source column), #21 (display arrow only when transformation), #4 companion attribute-vs-value classifier (related to #21), #12 (autoHeight for empty tables), #22 (three sub-fixes).
2. **Second session** (settings redesign): #15, #16, #18, #9 — cluster.
3. **Third session** (help/tooltips): #6, #10, #11, #17, #20 — cluster of docs.
4. **Fourth session** (nice-to-haves): #1 price rounding, #5 pill formatter, #19 table engine reuse.
5. **Backlog**: #2 leftovers, #7/#8/#13 pending image review.

**Claude work order** (I do this):

1. Extend `build-vertical-mapping.js` rules for #3 (add air compressor, tools & home improvement, hardware). Small commit, few tests.

**Cross-cutting observation**:
User's #3 issue confirms my earlier Suggestion (verticalIdFromName should try multiple breadcrumb segments) matters in real usage. Codex should treat that as a genuine bug now, not a Suggestion.

## What I'd recommend labeling on GitHub

If you want to add labels, these apply cleanly:
- `bug`: #3, #4, #7, #8, #9, #12, #13, #14, #21, #22
- `enhancement`: #1, #5, #15, #19
- `documentation`: #6, #10, #11, #16, #17, #20
- `settings`: #9, #15, #16, #18
- `grid`: #1, #12, #13, #14, #19, #22
- `normalization`: #3, #4, #5, #6, #21
- `codex` (as assignee): all except #3 (joint)
- `claude` (as assignee): #3

---

*Reviewed: Claude, 2026-07-08. Codex should read this before starting next session.*
