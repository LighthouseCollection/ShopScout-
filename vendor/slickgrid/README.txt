vendor/slickgrid/
=================

SlickGrid vendor files. Files in this directory are vendored as-is and
loaded by comparison.html for the Codex Phase 2 product grid.

Source: slickgrid npm package / SlickGrid Universal project
(https://github.com/6pac/SlickGrid), pinned in vendor/VERSIONS.txt.
The UMD/standalone build ships the global `Slick` namespace this code
expects: `Slick.Grid`, `Slick.Data.DataView`, `Slick.RowSelectionModel`,
`Slick.Editors.*`, `Slick.Plugins.*`.

Loaded files
--------------
slick.core.js          Core utilities + event system.
slick.interactions.js  Drag/resize interactions used by SlickGrid.
slick.dataview.js      DataView (filter/sort/group/aggregate).
slick.grid.js          The grid widget itself.
slick.grid.css         Default grid skin (theme.css extends this).
slick-default-theme.css  Base default theme.
slick-icons.css        Icon font CSS used by SlickGrid controls.
slick.editors.js       Text / Integer / Float / Date / Checkbox editors.
plugins/slick.rowselectionmodel.js   Row selection plugin.

Optional (recommended)
----------------------
slick.cellrangeselector.js   Cell range selection (multi-cell ops).
slick.cellselectionmodel.js  Cell selection model.
slick.grouping.css           Group-by styles.

Update process
--------------
1. Download the same browser/CSS files from the chosen slickgrid
   package release.
2. Replace the files in this directory.
3. Update vendor/VERSIONS.txt.
4. Run npm test, npm run syntax, and npm run build.
