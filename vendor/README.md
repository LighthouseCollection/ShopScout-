# vendor/

ShopScout is a Manifest V3 browser extension. MV3's default content-security-policy
forbids loading scripts from CDNs at runtime, so every third-party library must be
present on disk and shipped inside the extension package.

Drop the files below into this directory. The build script (`scripts/build-extension.ps1`)
copies the whole `vendor/` folder into each browser-specific dist.

## Required libraries

| Library | File(s) | Purpose | License |
|---|---|---|---|
| **Dexie** | `dexie.min.js` | IndexedDB wrapper. Backs `data/db.js`. | Apache-2.0 / Public Domain |
| **Tabulator** | `tabulator.min.js`, `tabulator.min.css` | Grid view: filters, sort, group, frozen columns, inline edit. | MIT |
| **PivotTable.js** | `pivot.min.js`, `pivot.min.css` | True pivot view (rows x cols x aggregator). | MIT |

PivotTable.js depends on **jQuery AND jQuery UI** at runtime — the UI uses
jQuery UI's `sortable` interaction for the row/col/value drag zones — so also
include both:

| Library | File | Purpose | License |
|---|---|---|---|
| **jQuery** | `jquery.min.js` | Required by jQuery UI and PivotTable.js. Loaded only on the comparison page. | MIT |
| **jQuery UI** | `jquery-ui.min.js` | Required by PivotTable.js for the sortable drag-drop zones. | MIT |

## Where to get them

Pin a specific version. Do NOT just grab "latest" — extension review uses content hashes.

```text
Dexie         https://unpkg.com/dexie@4.0.10/dist/dexie.min.js
Tabulator     https://unpkg.com/tabulator-tables@6.3.1/dist/js/tabulator.min.js
              https://unpkg.com/tabulator-tables@6.3.1/dist/css/tabulator.min.css
PivotTable.js https://unpkg.com/pivottable@2.23.0/dist/pivot.min.js
              https://unpkg.com/pivottable@2.23.0/dist/pivot.min.css
jQuery        https://code.jquery.com/jquery-3.7.1.min.js  (rename to jquery.min.js)
jQuery UI     https://code.jquery.com/ui/1.13.2/jquery-ui.min.js
```

Versions above are the latest stable as of writing. Update VERSIONS.txt below when you bump.

## Verification

After dropping files in, run:

```bash
ls vendor/
# should print:
# dexie.min.js
# jquery.min.js
# pivot.min.css
# pivot.min.js
# README.md
# tabulator.min.css
# tabulator.min.js
# VERSIONS.txt
```

Then load the unpacked extension and open the comparison page. If you see Tabulator
chrome (sticky header, sort arrows, group expanders) but no inline `<style>` left
in HTML — you're set.

## VERSIONS.txt

Record what's actually pinned. Updated by hand on each bump.

```text
dexie         4.0.10
tabulator     6.3.1
pivottable    2.23.0
jquery        3.7.1
```
