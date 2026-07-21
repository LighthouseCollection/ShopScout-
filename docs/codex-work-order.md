# Codex work order

Read this before starting a session. It tells you which open GitHub issues to grab, in what order, and why.

## Ground rules

1. **One issue per PR** unless the issue body says "ship together" — then a coordinated pair is fine.
2. Every PR includes: unit tests where possible, `AGENT_CHANGELOG.md` entry, `npm test` / `npm run lint` / `npm run typecheck` all green.
3. Read the issue body top-to-bottom before starting. Bodies are detailed on purpose — cross-references (`#N`) matter.
4. If you find something out of scope while working an issue, don't sneak it into your PR. File a new issue with the `codex-owned` label and continue.
5. **#75 (fit-and-finish) is gated.** Do not touch it until every other open issue is closed.

## Filters that answer "what's next"

```bash
gh issue list --state open --label P0-blocker         # emergency queue
gh issue list --milestone "v1.0 — Store submission"    # release gate
gh issue list --state open --label P1-high             # high priority
gh issue list --state open --label ai --label modal    # focused cluster
```

Every open issue is stamped with:
- **Priority**: `P0-blocker` / `P1-high` / `P2-medium` / `P3-polish`
- **Topic** (one or more): `ribbon`, `modal`, `normalization`, `grid`, `pill`, `ai`, `settings`, `popup`, `accessibility`, `extractor`, `design-system`
- **Ownership**: `codex-owned`, `claude-owned`, or `joint`

## Ordering principles

- **P0 first.** These are broken production paths.
- **Foundational tokens before modal/pane polish.** Fixing `--color-text-secondary` once beats fixing it in five modals.
- **Cluster by area to minimize context-switching.** Grid pills go as a batch; ribbon polish goes as a batch.
- **Extractor cleanups before AI/results.** Junk data in the grid poisons AI screenshots and prompts.
- **Screenshots for #63 depend on #61 (popup) + #57 (settings AI providers).** Don't take store screenshots until those are landed.
- **#75 (design system) LAST.** Every earlier PR would move the target.

---

## The order

### Phase A — Emergency (P0 blockers, unblock users)

| # | Issue | Why now |
|---|---|---|
| A1 | **#57** Settings AI Providers empty | No one can configure AI. Blocks #51, #63, and every Auto AI screenshot. |
| A2 | **#67** Extractor junk columns (`!!Note!!` / `1`/`2`/`3`) | Every capture ships with garbage columns visible to the user. Poisons #64 (AI Results) and #63 screenshots. |

### Phase B — Universal foundations (do these before touching any modal or grid detail)

| # | Issue | Why now |
|---|---|---|
| B1 | **#58** Universal secondary text (font-size + WCAG contrast tokens) | Every modal / pane / cell reuses these tokens. Fix once. Supersedes #53. |
| B2 | **#74** Button hover / active / selected state tokens | Every button component reuses these. Fix once. |
| B3 | **#50** Pill text WCAG contrast (golden-hash palette floor) | Every pill in every column reuses this. Fix once. |

### Phase C — Extractor cleanup companion

| # | Issue | Why now |
|---|---|---|
| C1 | **#73** User review images (restore + filter SVG/icon/thumb) | Same defensive philosophy as #67. Coordinate the two into one extractor pass. |

### Phase D — Grid pill layer (ship D1+D2 as a coordinated pair)

| # | Issue | Why now |
|---|---|---|
| D1 | **#66** No partial pill rows (whole-row snap + resize handler) | Foundational — sets the max-height math D2 depends on. |
| D2 | **#65** Pill overflow: wrap 3 lines → `+N more` → modal (per #65 comment: **3 lines, not 4**) | Depends on D1's row-height contract. |
| D3 | **#68** Comma pill split recurrence (regression from `3322662`) | Alphabetical sort + sibling coordination with D1/D2 layout rules. |
| D4 | **#69** Pill font consistency across columns | Same source-of-truth cleanup as B3. |

### Phase E — Grid headers + row actions (small independent fixes)

| # | Issue | Why now |
|---|---|---|
| E1 | **#44** Rating column collapse (case-sensitive Set) | Also remove the `SSCanonical.canonicalKey` monkey-patch in `projections.test.js` so the case-mismatch class of bug can't recur. |
| E2 | **#45** Latent `root.open` unbound fallback | Small hygiene fix; ship in the same PR as E1 if convenient. |
| E3 | **#59** Column resize handle + divider overlap | Option A recommended (drop custom separator, use AG Grid built-in). |
| E4 | **#70** Column header `+` icon inconsistency | Option A: no icons on any header. |
| E5 | **#24** Row-action "open link" arrow doesn't open URL | Verify commit `3322662` fix has held; also close #45 if the fix reroutes past the fallback. |
| E6 | **#26** Master check-all / uncheck-all header checkbox | AG Grid built-in via `headerCheckboxSelection: true`. |

### Phase F — Product detail restoration

| # | Issue | Why now |
|---|---|---|
| F1 | **#72** Product detail modal via clicking product name | Restore lost feature. Reuse `comparison/productDetailView.js` which still exists. |

### Phase G — Normalization output polish

| # | Issue | Why now |
|---|---|---|
| G1 | **#71** Normalization output polish (underscores, weight units, dimensions, resolution) | Umbrella — 4 defects in one coordinated pass. |

### Phase H — Ribbon polish (H1 first, H5 last as validation)

| # | Issue | Why now |
|---|---|---|
| H1 | **#56** Measurements button too big → rename to "Units" | Small isolated fix. |
| H2 | **#47** Match MS Word ribbon icon style (1.5px stroke, monochrome outline) | Foundational — every subsequent ribbon fix inherits the new icons. |
| H3 | **#48** Match MS Word ribbon group separators | Depends on H2 rendering being final. |
| H4 | **#49** Match MS Word ribbon typography | Depends on H2/H3 being final. |
| H5 | **#60** Full ribbon resize/reflow testing (all 5 tabs at 6 widths) | Ship LAST in the ribbon cluster; validates H1-H4 hold up under resize. |

### Phase I — Popup + About + Store submission (v1.0 release gate)

| # | Issue | Why now |
|---|---|---|
| I1 | **#61** Popup redesign (remove version tag, corner button, count row + clear-all) | v1.0 milestone. Blocks store screenshots. |
| I2 | **#62** About writeup — **Claude drafts, Codex places** | Joint. v1.0 milestone. Blocks #63. |
| I3 | **#51** Auto AI onboarding modal (when no provider configured) | Depends on #57 (Phase A) being fixed. Improves first-run UX before submission. |
| I4 | **#63** Store submission prep (Chrome / Edge / Firefox copy, assets, legal) | v1.0 milestone. **Do not start until I1, I2, and Phase A are all landed.** Screenshots taken here must reflect polished UI. |

### Phase J — Manual AI + AI Results view (biggest UI arc)

| # | Issue | Why now |
|---|---|---|
| J1 | **#52** Compact/Full radio card top-align (pin with test) | Recurring — pin it this time. |
| J2 | **#46** Accordion nav item border consistency | Small alignment fix. |
| J3 | **#54** Provider logo regression (replace letter avatars with real logos) | Grep history for the old SVGs; fall back to Simple Icons. |
| J4 | **#55** Split "Step 4: Send & Paste Back" into two steps + add Pipeline option | Structural — do before J5 so its scaffold is ready. |
| J5 | **#64** AI Results view tab + subtab structure (adopt reference design) | **Joint (Codex + Claude).** Big piece — needs #62 copy for content alignment. Palette adapted to current ShopScout tokens. |

### Phase K — Grid feature additions (from earlier user backlog)

Sequenced smallest → largest so wins land quickly.

| # | Issue | Why now |
|---|---|---|
| K1 | **#25** Columns Select modal redesign (toggles, 2-column, bigger) | Small self-contained. |
| K2 | **#28** Pinned (frozen) columns / rows | AG Grid built-in — quick win. |
| K3 | **#27** Draggable grouping (SlickGrid Example 03 pattern → AG Grid Row Grouping) | AG Grid Community supports drag-drop row grouping. |
| K4 | **#30** Row detail view + grouping | Master/detail pattern. |
| K5 | **#29** Composite editor modal (edit every field of a row at once via edit icon) | Larger effort — builds on K1 modal patterns. |

### Phase L — LAST (gated — do not start until 0 other open issues)

| # | Issue | Why now |
|---|---|---|
| L1 | **#75** Fit-and-finish design-system audit + consolidation | **Joint (Codex + Claude).** Gate check via `gh issue list --state open --repo LighthouseCollection/ShopScout-` returning only this issue. |

---

## Per-session checklist

Before you start any session:

```bash
gh issue list --state open --label P0-blocker
```

If any P0 shows up, that's your session. Otherwise pull from the current phase in this document.

At the end of every PR:

- [ ] `npm test` green
- [ ] `npm run lint` clean
- [ ] `npm run typecheck` clean
- [ ] `AGENT_CHANGELOG.md` entry appended
- [ ] Related issues linked in the PR description (`Closes #N`, `Related to #M`)
- [ ] Any out-of-scope observations filed as new issues (not smuggled into the PR)

## Coordination with Claude

Joint issues (labeled `joint`) — **#62, #63, #64, #75**:

- Claude drafts long-form copy and cross-reviews UI-heavy PRs.
- Codex leads implementation, wires markup/CSS/JS, adds tests.
- Both cross-review before merge.
- For #64 specifically: expect Claude to flag any AI prompt/parser data gaps as follow-up issues while you're implementing the tab shell.

## Rewording / interpretation guidance

The 7 issues authored by the user (#24, #25, #26, #27, #28, #29, #30) were reworded to canonical titles and have follow-up notes as GitHub comments mapping SlickGrid Universal references to AG Grid equivalents. Read the comments — they save you research time.

If an issue body is ambiguous, ask in a comment on the issue before starting. Don't guess and ship.
