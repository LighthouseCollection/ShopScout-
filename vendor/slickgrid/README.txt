vendor/slickgrid/
=================

SlickGrid drop point. Files in this directory are vendored as-is and
loaded by comparison.html. Until the files below are present, the
Phase 2 grid renderer mounts a placeholder explaining that SlickGrid
hasn't been vendored yet — the rest of the dashboard keeps working.

Recommended source: SlickGrid Universal (https://github.com/6pac/SlickGrid)
The UMD/standalone build ships the global `Slick` namespace this code
expects: `Slick.Grid`, `Slick.Data.DataView`, `Slick.RowSelectionModel`,
`Slick.Editors.*`, `Slick.Plugins.*`.

Required files
--------------
slick.core.js          Core utilities + event system.
slick.dataview.js      DataView (filter/sort/group/aggregate).
slick.grid.js          The grid widget itself.
slick.grid.css         Default grid skin (theme.css extends this).
slick.editors.js       Text / Integer / Float / Date / Checkbox editors.
slick.rowselectionmodel.js   Row selection plugin.

Optional (recommended)
----------------------
slick.cellrangeselector.js   Cell range selection (multi-cell ops).
slick.cellselectionmodel.js  Cell selection model.
slick.grouping.css           Group-by styles.

Pick versions
-------------
Pin in vendor/VERSIONS.txt (the project convention). Suggested:
  slickgrid              5.6.0 or later
  slickgrid-universal    5.x

How to drop in
--------------
1. Download the files above from the chosen release.
2. Place them in this directory.
3. Add them to vendor/VERSIONS.txt.
4. The renderer will auto-detect `window.Slick` and switch from the
   placeholder to the live grid on the next page reload.

How to remove
-------------
Delete the files. The renderer falls back to the placeholder
automatically.
