const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'comparison.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'comparison.js'), 'utf8');
const feedbackJs = fs.readFileSync(path.join(__dirname, '..', 'comparison-feedback.js'), 'utf8');
const settingsJs = fs.readFileSync(path.join(__dirname, '..', 'settings.js'), 'utf8');

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

/* Task 11 Phase 2 restores View ribbon grid controls for the new
   SlickGrid-backed product grid. These controls must use the
   data-ss-grid-* command surface, not the retired Tabulator ids. */
assertIncludes('class="ribbon-pane" data-pane="view"',  'View ribbon pane still exists');
assertIncludes('data-list-mirror="view"',               'View pane keeps the Active-list mirror');
assertIncludes('<div class="rb-group-label">Layout</div>',     'View pane exposes the new Layout group');
assertIncludes('<div class="rb-group-label">Sort</div>',       'View pane exposes the new Sort group');
assertIncludes('<div class="rb-group-label">Filter</div>',     'View pane exposes the new Filter group');
assertIncludes('<div class="rb-group-label">Columns</div>',    'View pane exposes the new Columns group');
assertIncludes('<div class="rb-group-label">Grouping</div>',   'View pane exposes the new Grouping group');
assertIncludes('data-ss-grid-command="mode-rows"',             'New products-as-rows command exists');
assertIncludes('data-ss-grid-command="mode-matrix"',           'New compare command exists');
assertIncludes('data-ss-grid-sort-field',                      'New sort field picker exists');
assertIncludes('data-ss-grid-command="open-filters"',          'New filter command exists');
assertIncludes('data-ss-grid-command="open-columns"',          'New columns command exists');
assertIncludes('data-ss-grid-group-field',                     'New grouping field picker exists');
assertNotIncludes('<div class="rb-group-label">Table</div>',   'Old Table group removed');
assertNotIncludes('<div class="rb-group-label">Saved views</div>', 'Old Saved views group removed');
assertNotIncludes('data-db-mode="grid"',                       'Old Grid mode toggle removed');
assertNotIncludes('data-db-mode="pivot"',                      'Old Pivot mode toggle removed');
assertNotIncludes('id="dbGroupBy"',                            'Old Group-by select removed');
assertNotIncludes('id="dbColumnsBtn"',                         'Old Columns trigger removed');
assertNotIncludes('id="dbClearFiltersBtn"',                    'Old Clear-filters button removed');
assertNotIncludes('id="savedViewSelect"',                      'Old Saved-view select removed');
assertNotIncludes('data-command="show-columns"',               'Old show-columns ribbon dispatch still absent');
assertNotIncludes('data-command="open-freeze-modal"',          'Old freeze-modal ribbon dispatch still absent');
assertNotIncludes('data-command="open-column-order-modal"',    'Old column-order ribbon dispatch still absent');
assertNotIncludes('data-command="open-group-modal"',           'Old group-modal ribbon dispatch still absent');
assertNotIncludes('data-command="hide-all-columns"',           'hide-all-columns still absent');
assertNotIncludes('id="hiddenBar"',                            'Hidden fields bar still absent');

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
assertNotIncludes('data-list-mirror="about"', 'About tab does not repeat the Product List group');
assertIncludes('<div class="rb-group-label">About</div>', 'About tab includes About group');
assertIncludes('<div class="rb-group-label">Feedback</div>', 'About tab includes Feedback group');
assertIncludes('data-command="documentation"', 'About tab exposes Help/documentation');
assertNotIncludes('data-command="keyboard-shortcuts"', 'Keyboard shortcuts button removed (folded into Help page)');
assertIncludes('data-command="check-updates"', 'About tab exposes check updates');
assertIncludes('data-command="report-bug"', 'About tab exposes report bug');
assertIncludes('data-command="suggest-feature"', 'About tab exposes suggest feature');
assertNotIncludes('data-command="contact-support"', 'About tab removes Contact Support');
assertNotIncludes('Contact support', 'About tab no longer shows Contact Support');

/* Task 11 Phase 1: the five grid modal shells (filterModal,
   columnsModal, freezeModal, columnOrderModal, groupingModal)
   were removed with the grid. The Phase 2 grid will register its
   own modals if it needs any. */
assertNotIncludes('id="filterModal"',      'Old filterModal removed');
assertNotIncludes('id="columnsModal"',     'Old columnsModal removed');
assertNotIncludes('id="freezeModal"',      'Old freezeModal removed');
assertNotIncludes('id="columnOrderModal"', 'Old columnOrderModal removed');
assertNotIncludes('id="groupingModal"',    'Old groupingModal removed');

/* Manual AI / Settings / detail flows remain intact. */
assertIncludes('id="manualAiModal"', 'Manual AI modal shell preserved');
assertIncludes('src="settings.js"', 'Settings module is loaded for embedded dashboard settings');
assertNotIncludes('id="settingsFrame"', 'Settings no longer opens through an iframe');
assertIncludes('id="productGrid"',   'Phase 2 grid mount point exists');

assert.ok(js.includes('openSettingsPage'), 'comparison script opens settings inside the dashboard');
assert.ok(js.includes('ShopScoutSettings.mount'), 'settings render inside the dashboard content area');
assert.ok(js.includes('openManualAiModal'), 'comparison script opens manual AI in an embedded modal');
assert.ok(js.includes("activateRibbonTab('products')"), 'open-list command routes to the Products tab');
assert.ok(js.includes("activateRibbonTab('about')"), 'help/about commands route to the About tab');
assert.ok(/if\s*\(\s*target\s*!==\s*['"]about['"][\s\S]{0,160}restoreProductListChrome\(\)/.test(js),
  'switching away from About/info pages restores the product grid');
assert.ok(/dashboardBack[\s\S]{0,120}restoreProductListChrome\(\)/.test(js),
  'Back to Products restores the product grid chrome');
assert.ok(js.includes('renderMarkdownToHtml'), 'markdown help/about files render inside the dashboard');
assert.ok(js.includes('openDashboardInfoPage'), 'ribbon informational commands open inside the main content area');
assert.ok(js.includes('openFeedbackPage'), 'suggest feature and report bug open inside the main content area');
assert.ok(feedbackJs.includes('dashboard-primary-action'), 'feedback Send button uses the dashboard themed action style');
assert.ok(settingsJs.includes('mount: mount'), 'settings module exposes an embedded dashboard mount');
assert.ok(settingsJs.includes('One click adds the product to'), 'embedded settings preserves quick-capture guidance');
assert.ok(settingsJs.includes('No personal data is sent'), 'embedded settings preserves Open*Facts privacy guidance');
assert.ok(settingsJs.includes('Open Food Facts (groceries)'), 'embedded settings preserves detailed Open*Facts source labels');
assert.ok(!settingsJs.includes('class="guide-frame"'), 'embedded settings does not restore the old iframe guide');
assert.ok(js.includes('renderTopbarAiProviderMenu'), 'comparison script renders AI provider choices in the analyze ribbon');
assert.ok(!js.includes('modelLabel'), 'AI provider menu shows provider names only, not model names');

/* Task 11 Phase 1: the column/freeze/order/filter/group modal
   wiring (filterUtilityList, renderColumnControlList,
   renderFreezeControlList, renderColumnOrderList, renderFilterModal,
   renderGroupingModal, applyFrozenColumnOffsets,
   saveColumnOrderFromDom, getAllColumns, frozenColumnIds,
   columnOrderIds, hiddenCols, autoHiddenDynamicCols) was deleted
   with the rest of the grid layer. */
for (const removed of [
  'filterUtilityList', 'renderColumnControlList', 'renderFreezeControlList',
  'renderColumnOrderList', 'renderFilterModal', 'renderGroupingModal',
  'applyFrozenColumnOffsets', 'saveColumnOrderFromDom',
  'frozenColumnIds', 'columnOrderIds', 'hiddenCols', 'autoHiddenDynamicCols',
  'data-column-order-id', 'data-freeze-column'
]) {
  assert.ok(!js.includes(removed), `${removed} no longer in comparison.js`);
}

console.log('menu layout tests passed');
