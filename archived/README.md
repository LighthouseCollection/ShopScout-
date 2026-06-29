# archived/

Files that are not part of the shipped extension and are not referenced by any
HTML, manifest, content script, or build script — kept around as history but
not loaded. Moving them out of the live tree keeps `scripts/build-extension.ps1`
from copying dead bytes into every browser dist.

## What's in here

### Project root (`./`)

| File | Reason |
|---|---|
| `dev-log.js` | Self-described "NOT part of the consumer extension" developer-only logging helper. No `<script>` reference, no `runtimeFiles` entry, no manifest reference. |

### `archived/icons/`

The shipping extension uses only the rasterized PNG icons declared in
`manifest.json` / `manifest.firefox.json` (`icons/icon16.png`,
`icons/icon48.png`, `icons/icon128.png`). The files moved here are design
sources and marketing assets — useful to keep around, not useful to ship.

| File | Reason |
|---|---|
| `icon-source.svg` | Master design source for the rasterized PNG icons. Not referenced by any code or manifest. |
| `icon16.svg`, `icon48.svg`, `icon128.svg` | SVG twins of the shipped PNG icons. The manifests reference the `.png` files, not these. |
| `shopscout.svg` | Logo SVG. Not loaded by any HTML, CSS, manifest, or build step. |

These design files moved here because `scripts/build-extension.ps1` copies the
`icons/` directory recursively into every dist (chrome / edge / firefox).
With them in `icons/` they were shipping unused bytes into every browser build
for no runtime benefit.

### `archived/packages/`

| File | Reason |
|---|---|
| `icons.zip` | Local icon/source asset package. It is ignored by Git via `*.zip`, not referenced by any manifest, HTML page, script, test, or build step, and is not needed by the shipped extension. |

## How to re-enable

For dev-log style files: move back to project root, add a `<script src="...">`
reference in the host HTML, and add the filename to `$runtimeFiles` in
`scripts/build-extension.ps1`.

For icons: move the file back into `icons/` and declare it in `manifest.json`
(and `manifest.firefox.json`) under `icons` or `action.default_icon`. The
build script already copies the whole directory, so no build-script change is
needed once the manifest references it.

For package archives: unzip or move the archive back only when you need the
source material. If a zip should become part of the repository, update
`.gitignore` intentionally and force-add it with Git.

## What's *not* archived but might look orphaned

- **`state/*.js`** (eventBus / locks / actions / appStore / selectors) — not
  loaded by any HTML page yet, but `data/productRepo.js` looks up
  `globalThis.ShopScoutState.createLockManager` at call time and the build
  script ships the directory. They are real shipped code with test coverage,
  waiting for a future consumer migration. Not archived.
- **`vendor/shopify-taxonomy/taxonomy.json`** (~91 MB) — large but loaded by
  `data/canonical.js`. Not archived.
- **Modal HTML shells** (`#filterModal`, `#groupingModal`, etc. in
  `comparison.html`) — currently have no triggers but `tests/menu-layout.test.js`
  pins them. A dedicated cleanup task should remove the markup and the test
  expectations together.
