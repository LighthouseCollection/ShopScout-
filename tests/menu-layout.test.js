const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'comparison.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'comparison.js'), 'utf8');

function assertIncludes(value, message) {
  assert.ok(html.includes(value), message);
}

function assertNotIncludes(value, message) {
  assert.ok(!html.includes(value), message);
}

assertIncludes('class="ribbon-shell"', 'dashboard uses the redesigned ribbon shell');
assertIncludes('class="ribbon-tabs"', 'dashboard exposes ribbon tabs');
assertIncludes('class="ribbon-pane active" data-pane="products"', 'Products ribbon pane is active by default');
assertIncludes('data-tab="file">File</button>', 'File tab exists');
assertIncludes('data-tab="products">Products</button>', 'Products tab exists');
assertIncludes('data-tab="analyze">Analyze</button>', 'Analyze tab exists');
assertIncludes('data-tab="view">View</button>', 'View tab exists');
assertIncludes('data-tab="search">Search</button>', 'Search tab exists');
assertIncludes('data-tab="about">About</button>', 'About tab replaces Help');
assertNotIncludes('data-tab="home">', 'old Home/Shortcuts tab is removed');
assertNotIncludes('data-tab="help">', 'old Help tab is removed');

assertIncludes('<div class="rb-group-label">Open · Import</div>', 'File tab includes Open · Import group');
assertIncludes('id="openBtn"', 'File tab exposes Open (load as new list)');
assertIncludes('<div class="rb-group-label">Save</div>', 'File tab includes Save group');
assertIncludes('Import List', 'File tab imports a list');
assertIncludes('class="rb-save-grid"', 'File tab save formats are arranged in a compact grid');
assertIncludes('data-export-format="json"', 'File tab exposes JSON export');
assertIncludes('data-export-format="xml"', 'File tab exposes XML export separately');
assertNotIncludes('JSON/XML', 'File tab no longer combines JSON and XML into one command');
assertNotIncludes('<div class="rb-group-label">New</div>', 'File tab no longer owns list creation');
assertNotIncludes('<div class="rb-group-label">Existing Lists</div>', 'File tab no longer shows recent/existing lists');

/* The Lists group moved out of the Products ribbon and into the File ribbon. */
assertIncludes('<div class="rb-group-label">Lists</div>', 'Lists group exists (in File ribbon)');
assertIncludes('id="listSelect"',     'List selector exists');
assertIncludes('id="newListBtn"',     'New-list action exists');
assertIncludes('id="renameListBtn"',  'Rename-list action exists');
assertIncludes('id="deleteListBtn"',  'Delete-list action exists');
assertIncludes('<div class="rb-group-label">Products</div>', 'Products tab includes Products group');
assertIncludes('id="addUrlToggle"', 'Products tab exposes Add Product');
assertIncludes('Delete Product(s)', 'Products tab exposes Delete Product(s)');
assertIncludes('Rescan Products', 'Products tab exposes Rescan Products');
assertNotIncludes('data-command="cancel-run"', 'Cancel Scan is removed from the ribbon (per UX cleanup)');
assertNotIncludes('data-command="keyboard-shortcuts"', 'Keyboard Shortcuts button is removed from the About group');

assertIncludes('<div class="rb-group-label">Auto AI</div>', 'Analyze tab includes Auto AI group');
assertIncludes('id="integratedAiProviderMenu"', 'Auto AI provider menu is dynamic');
assertIncludes('id="integratedAiSideProviders"', 'Auto AI side provider stack is dynamic');
assertIncludes('<div class="rb-group-label">Manual AI</div>', 'Analyze tab includes Manual AI group');
assertIncludes('id="manualAiBtn"', 'Manual AI is a big direct action');
assertNotIncludes('<div class="rb-group-label">Select what to compare and analyze</div>', 'Analyze tab does not duplicate the AI modal checklist in the ribbon');
assertIncludes('<div class="rb-group-label">AI Results</div>', 'Analyze tab keeps AI Results group');
assertIncludes('<div class="rb-group-label">Settings</div>', 'Analyze tab includes Settings group');
assertNotIncludes('data-stage-option="finalRecommendation"', 'Analyze ribbon no longer owns stage option checkboxes');
assertNotIncludes('data-stage-option="secondOpinion"', 'Second opinion stage selection stays inside the AI modal only');

/* View ribbon was rewritten for the Database view (Tabulator + PivotTable.js).
   The old Sort/Filter/Columns/Grouping groups and their modal triggers are gone:
   sort/filter/group/columns are now native Tabulator interactions on column headers. */
assertIncludes('<div class="rb-group-label">Layout</div>',      'View tab keeps a Layout group (Grid / Pivot toggle)');
assertIncludes('<div class="rb-group-label">Table</div>',       'View tab has a Table group (Group by / Columns / Clear filters)');
assertIncludes('<div class="rb-group-label">Saved views</div>', 'View tab has a Saved views group');
assertIncludes('data-db-mode="grid"',                           'Layout group has a Grid mode button');
assertIncludes('data-db-mode="pivot"',                          'Layout group has a Pivot mode button');
assertIncludes('id="dbGroupBy"',                                'View ribbon hosts the Group-by select');
assertIncludes('id="dbColumnsBtn"',                             'View ribbon hosts the Columns dropdown trigger');
assertIncludes('id="dbClearFiltersBtn"',                        'View ribbon hosts the Clear-filters button');
assertIncludes('id="savedViewSelect"',                          'View ribbon hosts the Saved-view select');
assertNotIncludes('<div class="rb-group-label">Sort</div>',          'Old Sort ribbon group is removed (Tabulator headers sort)');
assertNotIncludes('<div class="rb-group-label">Filter</div>',        'Old Filter ribbon group is removed (Tabulator header filters)');
assertNotIncludes('<div class="rb-group-label">Columns</div>',       'Old Columns ribbon group is removed (Tabulator column menu)');
assertNotIncludes('<div class="rb-group-label">Grouping</div>',      'Old Grouping ribbon group is removed (Tabulator grouping)');
assertNotIncludes('data-command="add-filter"',                       'Old add-filter button is gone');
assertNotIncludes('data-command="show-columns"',                     'Old show-columns button is gone');
assertNotIncludes('data-command="open-freeze-modal"',                'Old freeze-modal button is gone');
assertNotIncludes('data-command="open-column-order-modal"',          'Old column-order button is gone');
assertNotIncludes('data-command="open-group-modal"',                 'Old group-modal button is gone');
assertNotIncludes('data-command="hide-all-columns"',                 'View tab removes Hide all');
assertNotIncludes('<span class="rb-btn-sm-label">Active</span>',     'View tab removes Active filter shortcut');
assertNotIncludes('<span class="rb-btn-sm-label">Saved</span>',      'View tab removes Saved filter shortcut');
assertNotIncludes('id="hiddenBar"',                                  'Hidden fields bar is removed from beneath the ribbon');

assertIncludes('class="ribbon-pane" data-pane="search"', 'Search tab exists as its own ribbon pane');
assertIncludes('id="productSearchInput"', 'Search tab contains product search input');
assertIncludes('data-search-field="title"', 'Search tab exposes title search checkbox');
assertIncludes('data-search-field="identity"', 'Search tab exposes identifier search checkbox');
assertIncludes('data-search-field="specs"', 'Search tab exposes specs search checkbox');
assertIncludes('data-search-field="notes"', 'Search tab exposes notes search checkbox');
assertIncludes('class="search-check active" data-search-field="title"', 'Search tab options use plain checkbox rows');
assertIncludes('class="search-check active" data-search-field="specs"', 'Search tab options visually match the Analyze checklist style');
assertNotIncludes('class="rb-btn-sm menu-item active" data-search-field="title"', 'Search tab options are not styled as command buttons');
assertNotIncludes('Advanced</span>', 'Search tab no longer hides options behind Advanced');

assertIncludes('class="ribbon-pane" data-pane="about"', 'About tab exists as its own ribbon pane');
assertIncludes('<div class="rb-group-label">About</div>', 'About tab includes About group');
assertIncludes('<div class="rb-group-label">Feedback</div>', 'About tab includes Feedback group');
assertIncludes('data-command="documentation"', 'About tab exposes Help/documentation');
assertNotIncludes('data-command="keyboard-shortcuts"', 'Keyboard shortcuts button removed (folded into Help page)');
assertIncludes('data-command="check-updates"', 'About tab exposes check updates');
assertIncludes('data-command="report-bug"', 'About tab exposes report bug');
assertIncludes('data-command="suggest-feature"', 'About tab exposes suggest feature');
assertNotIncludes('data-command="contact-support"', 'About tab removes Contact Support');
assertNotIncludes('Contact support', 'About tab no longer shows Contact Support');

assertIncludes('id="filterModal"', 'Filter modal shell exists');
assertIncludes('id="columnsModal"', 'Columns modal shell exists');
assertIncludes('id="freezeModal"', 'Freeze modal shell exists');
assertIncludes('id="columnOrderModal"', 'Column order modal shell exists');
assertIncludes('id="groupingModal"', 'Grouping modal shell exists');
assertIncludes('id="columnSearchInput"', 'Columns modal includes live search');
assertIncludes('id="freezeSearchInput"', 'Freeze modal includes live search');
assertIncludes('id="columnOrderList"', 'Column order modal includes a draggable selected-field list');
assertIncludes('id="groupSearchInput"', 'Grouping modal includes live search');
assertIncludes('id="manualAiModal"', 'Manual AI modal shell exists');
assertIncludes('id="settingsPage"', 'Settings can open inside the dashboard content area');
assertIncludes('id="settingsFrame"', 'Settings page is embedded in the dashboard content area');

assert.ok(js.includes('openSettingsPage'), 'comparison script opens settings inside the dashboard');
assert.ok(js.includes('openManualAiModal'), 'comparison script opens manual AI in an embedded modal');
assert.ok(js.includes('filterUtilityList'), 'column and grouping modals filter as the user types');
assert.ok(js.includes('renderColumnControlList'), 'comparison script renders column visibility controls in a modal');
assert.ok(js.includes('autoHiddenDynamicCols.delete(input.dataset.columnToggle)'), 'turning on an auto-hidden dynamic spec column keeps it visible');
assert.ok(js.includes('renderFreezeControlList'), 'comparison script renders freeze controls in a modal');
assert.ok(js.includes('frozenColumnIds') && js.includes('data-freeze-column'), 'Freeze modal allows selecting specific fields to freeze');
assert.ok(js.includes('applyFrozenColumnOffsets'), 'selected frozen fields are applied to table columns');
assert.ok(js.includes('columnOrderIds') && js.includes('renderColumnOrderList'), 'Column order modal tracks selected visible fields');
assert.ok(js.includes('data-column-order-id') && js.includes('saveColumnOrderFromDom'), 'Column order modal persists drag order back to the table');
assert.ok(js.includes('renderFilterModal'), 'comparison script renders filter controls in a modal');
assert.ok(js.includes('renderGroupingModal'), 'comparison script renders grouping controls in a modal');
assert.ok(/getAllColumns\(\)[\s\S]*?\.filter\(col => col\.hideable\)/.test(js), 'Columns modal hides non-hideable system columns such as thumbnail and actions');
assert.ok(!js.includes(' (required)'), 'Columns modal no longer labels thumbnail/actions as required');
assert.ok(js.includes("activateRibbonTab('products')"), 'open-list command routes to the Products tab');
assert.ok(js.includes("activateRibbonTab('about')"), 'help/about commands route to the About tab');
assert.ok(js.includes('renderMarkdownToHtml'), 'markdown help/about files render inside the dashboard');
assert.ok(js.includes('openDashboardInfoPage'), 'ribbon informational commands open inside the main content area');
assert.ok(js.includes('openFeedbackPage'), 'suggest feature and report bug open inside the main content area');
assert.ok(js.includes('renderTopbarAiProviderMenu'), 'comparison script renders AI provider choices in the analyze ribbon');
assert.ok(!js.includes('modelLabel'), 'AI provider menu shows provider names only, not model names');

console.log('menu layout tests passed');
