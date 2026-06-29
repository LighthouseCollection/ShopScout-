# ShopScout Security Review

Date: 2026-06-29
Branch: `refactor/shopscout-stabilization`
Scope: Task 10 focused security hardening pass. This review covers extension
permissions, URL opening/rendering, import/export handling, AI key leakage risk,
and script injection surfaces. It intentionally excludes UI redesign, datagrid
replacement, and feature work.

## Fixed in Task 10

### URL handling

- `utils.js:1452` now sanitizes imported product `url` and `image` fields with
  `SS.sanitizeUrl`.
- `utils.js:1473` now rejects XML parser errors instead of silently accepting
  malformed XML imports.
- `ai-provider-guide.js:3` and `ai-provider-guide.js:4` now sanitize provider
  setup/documentation links before rendering them. `ai-provider-guide.js:26`
  allows only `http:` and `https:` links; unsafe URLs fall back to `#`.
- `table/rowActionsMenu.js:14` and `table/rowActionsMenu.js:66` now sanitize
  product URLs before opening row-action links.
- `comparison-db.js:25`, `comparison-db.js:39`, `comparison-db.js:620`, and
  `comparison-db.js:1283` now route grid/inverted-view product opens through a
  safe `http:`/`https:` URL boundary.
- `comparison.js:641` and `comparison.js:965` now open sanitized product URLs
  with `noopener`.

### AI monitor secret redaction

- `ai-dev-monitor.js:56` adds `redactSecrets`.
- `ai-dev-monitor.js:107` through `ai-dev-monitor.js:115` apply redaction to
  monitor messages, prompt snippets, response snippets, source URLs, errors, and
  product URLs before they enter monitor state.
- `ai-dev-monitor.js:237` builds the copyable log from already-redacted monitor
  state, so copied development logs do not expose API-key-looking strings.

### Tests

- `tests/security-audit.test.js` exercises:
  - `SS.sanitizeUrl` rejection for `javascript:`, `data:`, `vbscript:`, `blob:`,
    and `file:` URLs.
  - `SS.esc` and `SS.escAttr` escaping for text and attribute contexts.
  - `SS.escapeCsvField` hardening for spreadsheet formula prefixes.
  - JSON, CSV, and XML import safety.
  - Provider guide link sanitization.
  - Row-action product URL safe-open behavior.
  - AI monitor redaction in state and copyable logs.

## Follow-up Cleanup

### Shared sanitizer module

- Added `security/sanitize.js` as the shared lightweight sanitizer for browser
  pages, content scripts, and UI helpers.
- `SS.esc`, `SS.escAttr`, and `SS.sanitizeUrl` now delegate to the shared
  sanitizer when it is loaded, while keeping their legacy fallback path for
  older contexts.
- Provider guide, settings, popup, dashboard, product detail, rescan, table
  menus, content-script FAB, and AI selector paths now use the shared sanitizer
  boundary where they previously carried local URL/HTML sanitizer logic.
- The extension build script and Chrome/Edge/Firefox manifests now ship and
  inject the `security/` directory before the scripts that depend on it.

### Named trusted HTML sinks

- Manual HTML assignments in active UI renderers were moved behind named
  `setTrustedHtml(...)` calls. The reviewed templates still escape or sanitize
  user-controlled fields before render, but raw assignment is now grep-visible
  as an intentional sink instead of scattered `element.innerHTML = ...` writes.
- `ai-provider-guide.js`, `ai-select.js`, background auto-paste fallback, and
  legacy toast fallback were converted to DOM/text rendering where full HTML
  templates were not needed.
- `tests/sanitize-module.test.js` covers sanitizer behavior, load order,
  manifest injection order, and build packaging.

## Manifest Permission Review

Current permissions are unchanged in this task.

- `storage`: required for product/list data, AI provider settings, capture
  button settings, review-photo cache, and migration/backward-compat mirrors.
  Representative callsites: `utils.js:12`, `background.js:184`,
  `settings.js:162`.
- `activeTab`: required for user-triggered current-tab capture from popup and
  context menu flows.
- `scripting`: required for user-triggered product extraction and helper
  injection. Representative callsites: `background.js:111`,
  `background.js:122`, `popup.js:490`, `popup.js:508`.
- `tabs`: required for current-window product capture, hidden-tab add-by-URL /
  rescan flows, and opening extension pages. Representative callsites:
  `background.js:809`, `background.js:872`, `background.js:1082`,
  `popup.js:534`.
- `contextMenus`: required for the right-click capture/compare actions created
  in `background.js:16` through `background.js:19`.
- `<all_urls>` host permission is retained because add-by-URL, hidden-tab
  rescan, and "all open tabs in current window" capture can operate on user
  supplied or already-open product pages beyond the static marketplace match
  list. Revisit this if the extension moves to explicit per-site permission
  requests or an allowlist-only capture model.

The static `content_scripts.matches` lists known shopping domains in
`manifest.json:19` and `manifest.firefox.json:19`; this task did not broaden
the match patterns.

## Deferred Risks

### API keys in browser extension storage

Risk: AI provider keys are stored in `chrome.storage.local` through
`settings.js:168` and used by provider request builders in
`ai-providers.js:1097`, `ai-providers.js:1122`, `ai-providers.js:1134`, and
`ai-providers.js:1151`.

Why deferred: this is the current user-owned BYO-key model and the settings UI
already warns that browser extension storage is convenient, not a password
vault. Task 10 reduced log/display leakage but did not redesign credential
storage.

Revisit trigger: before extension-store publication, shared-machine use, or
syncing keys across devices. Preferred next step is encrypted local storage or
provider OAuth/account flows where supported.

### `<all_urls>` host permission

Risk: broad host permission increases extension review and user-trust surface.

Why deferred: current capture features include user-supplied URL capture,
hidden-tab rescan, and current-window tab capture. Those flows are intentionally
not limited to only the static shopping-domain list.

Revisit trigger: if product capture becomes allowlist-only, if per-site
permission onboarding is added, or if store review requires narrower host
permissions.

### Direct browser-to-provider AI calls

Risk: provider request builders send API calls directly from the extension
runtime. Some providers require keys in headers; Gemini currently uses a
key-bearing query parameter in `ai-providers.js:1151`.

Why deferred: ShopScout currently has no server/proxy by design, and this task
avoided architecture changes. Monitor/log redaction now reduces accidental UI
leakage from key-like strings.

Revisit trigger: if a backend service is introduced, if provider CORS behavior
changes, or if users need centralized organization credentials.

### Component-renderer migration

Risk: the app still uses template-string renderers in legacy areas. The active
manual assignments now go through named trusted sinks and reviewed fields are
escaped/sanitized, but the app is not yet on a component framework with a
single render abstraction.

Why deferred: replacing the remaining template renderers with componentized UI
is a broader framework/refactor task. This follow-up reduced the sink surface
without changing the dashboard/product behavior.

Revisit trigger: before adding new rich text/markdown rendering, AI-generated
HTML rendering, or a broader component framework migration.
