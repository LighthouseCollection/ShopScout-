const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'comparison.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'comparison.js'), 'utf8');
const gridAdapterJs = fs.readFileSync(path.join(__dirname, '..', 'grid-rebuild-codex', 'agGridAdapter.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'comparison.css'), 'utf8');
const ribbonCss = fs.readFileSync(path.join(__dirname, '..', 'ribbon', 'ribbon.css'), 'utf8');
const productsTabInitJs = fs.readFileSync(path.join(__dirname, '..', 'ribbon', 'products-tab-init.js'), 'utf8');
const feedbackJs = fs.readFileSync(path.join(__dirname, '..', 'comparison-feedback.js'), 'utf8');
const settingsJs = fs.readFileSync(path.join(__dirname, '..', 'settings.js'), 'utf8');
const settingsHtml = fs.readFileSync(path.join(__dirname, '..', 'settings.html'), 'utf8');
const aiProvidersJs = fs.readFileSync(path.join(__dirname, '..', 'ai-providers.js'), 'utf8');

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
assertNotIncludes('data-tab="view">', 'Products Table View tab is folded into the merged Products tab');
assertNotIncludes('data-tab="view">View</button>', 'old View tab label is replaced');
assert.ok(
  html.indexOf('data-tab="products"') < html.indexOf('data-tab="analyze"'),
  'Products tab appears before Analyze'
);
assertIncludes('data-tab="search">Search</button>', 'Search tab exists');
assertIncludes('data-tab="about">About</button>', 'About tab replaces Help');
assertNotIncludes('data-tab="home">', 'old Home/Shortcuts tab is removed');
assertNotIncludes('data-tab="help">', 'old Help tab is removed');

assertIncludes('<div class="rb-group-label">Open · Import</div>', 'File tab includes Open · Import group');
assertIncludes('id="openBtn"', 'File tab exposes Open (load as new list)');
assertIncludes('<div class="rb-group-label">Save</div>', 'File tab includes Save group');
assertIncludes('Import List', 'File tab imports a list');
assertIncludes('id="exportToggle"', 'File tab exposes a single Save As command');
assertNotIncludes('class="rb-save-grid"', 'File tab does not expose individual export formats in the ribbon');
assertNotIncludes('data-export-format=', 'File tab no longer exports directly from ribbon format buttons');
assert.ok(js.includes('data-export-destination="clipboard"'), 'Save As page offers copy-to-clipboard destination');
assert.ok(js.includes('data-export-destination="file"'), 'Save As page offers save-as-file destination');
assert.ok(js.includes('data-export-format="txt"'), 'Save As page offers plain-text output as a format');
assert.ok(js.includes('data-export-field="aiPrompt"'), 'Save As page can include the AI Prompt payload');
assert.ok(js.includes("id: 'aiPrompt', label: 'AI Prompt'"), 'export field registry includes AI Prompt');
assert.ok(js.includes('function buildExportAiPrompt'), 'exports can build the AI Prompt payload');
assert.ok(js.includes('ShopScout - '), 'exports use the ShopScout list-name date filename convention');
assert.ok(js.includes('class="dashboard-primary-action" data-export-apply'),
  'Save As Export uses the dashboard primary action style');
assert.ok(js.includes('class="dashboard-secondary-action" data-export-reset'),
  'Save As Reset uses the dashboard secondary action style');
assert.ok(/\.dashboard-export-panel[\s\S]{0,160}max-width:\s*none/.test(css),
  'Save As content panel fills the available main-content width');
assert.ok(/\.dashboard-format-grid[\s\S]{0,180}grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(180px,\s*1fr\)\)/.test(css),
  'Save As format cards distribute across the available content width');
assert.ok(/\.dashboard-page-actions[\s\S]{0,160}justify-content:\s*flex-end/.test(css),
  'dashboard form actions align to the right side');
assert.ok(/\.dashboard-page-actions[\s\S]{0,220}border-top:\s*1px solid var\(--rule,\s*#d1d5db\)/.test(css),
  'dashboard page action rows have a soft top rule above form buttons');
assert.ok(/\.dashboard-copy-picker-actions[\s\S]{0,220}border-top:\s*1px solid var\(--rule,\s*#d1d5db\)/.test(css),
  'Save As copy/action rows have a soft top rule above buttons');
assert.ok(/\.dashboard-secondary-action[\s\S]{0,360}background:\s*var\(--surface\)/.test(css),
  'dashboard secondary action style exists for reset/cancel-style buttons');
assert.ok(/--rule-soft:\s*#d1d5db/.test(css),
  'page soft border token uses #d1d5db');
assert.ok(!/border[^;{]*#[eE]5[eE]7[eE][bB]/.test(css),
  'container border fallbacks do not use #e5e7eb');
assertNotIncludes('<div class="rb-group-label">New</div>', 'File tab no longer owns list creation');
assertNotIncludes('<div class="rb-group-label">Existing Lists</div>', 'File tab no longer shows recent/existing lists');

/* The List group is mirrored across every ribbon tab (File / Products
   / Analyze / Search) using data-group-id="list" and shared
   data-list-action attributes so all copies drive the same handlers. */
assertIncludes('<div class="rb-group-label">List</div>', 'List group label present');
assertIncludes('data-group-id="list"', 'List group uses data-group-id="list"');
assertIncludes('data-list-action="new"', 'New-list action wired via data attribute');
assertIncludes('data-list-action="rename"', 'Rename-list action wired via data attribute');
assertIncludes('data-list-action="delete"', 'Delete-list action wired via data attribute');
assertIncludes('id="listSelect"',     'List selector exists');
assertIncludes('id="newListBtn"',     'New-list action exists');
assertIncludes('id="renameListBtn"',  'Rename-list action exists');
assertIncludes('id="deleteListBtn"',  'Delete-list action exists');
assertIncludes('<div class="rb-group-label">Product Actions</div>', 'Products tab includes Product Actions group');
assertIncludes('id="addUrlToggle"', 'Products tab exposes Add Product');
assertIncludes('Delete Item(s)', 'Products tab exposes Delete Item(s) (formerly Delete Product(s))');
assertIncludes('Rescan Products', 'Products tab exposes Rescan Products');
assertIncludes('data-command="duplicate-review"', 'Products tab exposes possible-duplicate review');
assertIncludes('data-command="normalization-review"', 'Products tab exposes normalization review');
assertIncludes('data-command="normalization-rules"', 'Products tab exposes user normalization rules');
assertIncludes('data-command="vertical-picker"', 'Products tab exposes vertical pack picker');
assert.ok(js.includes('openDuplicateReviewPage'), 'comparison script renders possible duplicate candidates in main content');
assert.ok(js.includes('findDuplicateCandidates'), 'duplicate review uses the repo candidate detector');
assert.ok(js.includes('data-duplicate-decision="not-duplicate"'), 'duplicate review can mark candidate groups as not duplicate');
assert.ok(js.includes('data-duplicate-decision="same-product"'), 'duplicate review can mark candidate groups as same product');
assert.ok(js.includes('setDuplicateCandidateDecision'), 'duplicate review saves candidate decisions through productRepo');
assert.ok(js.includes('openNormalizationReviewPage'), 'comparison script renders normalization review in main content');
assert.ok(js.includes('collectNormalizationReviewItems'), 'normalization review uses the shared review collector');
assert.ok(js.includes('rebuildNormalizationForList'), 'normalization review backfills existing captured products before rendering');
assert.ok(gridAdapterJs.includes('data-normalization-action="accept-alias"'), 'normalization review exposes accept-alias workflow');
assert.ok(gridAdapterJs.includes('data-normalization-action="ignore"'), 'normalization review exposes ignore workflow');
assert.ok(js.includes('data-normalization-bulk-all="accept-alias"'),
  'normalization review page has an accept-all bulk toolbar action');
assert.ok(js.includes('data-normalization-bulk-all="ignore"'),
  'normalization review page has an ignore-all bulk toolbar action');
assert.ok(js.includes('saveNormalizationReviewDecision'), 'normalization review persists decisions through productRepo');
assert.ok(js.includes('openNormalizationRulesPage'), 'comparison script renders user normalization rules page');
assert.ok(js.includes('deleteUserNormalizationRule'), 'user rules page deletes approved mappings through productRepo');
assert.ok(js.includes('openVerticalPickerPage'), 'comparison script renders vertical picker in main content');
assert.ok(js.includes('ShopScoutGeneratedPacks.listVerticals'), 'vertical picker reads generated vertical pack metadata');
assert.ok(js.includes('setListVertical'), 'vertical picker saves selected vertical through productRepo');
assert.ok(js.includes('data-vertical-action="use-selected"'), 'vertical picker exposes selected-vertical save action');
assert.ok(js.includes('data-vertical-action="use-defaults"'), 'vertical picker exposes bundled-defaults skip action');
assert.ok(js.includes("startProgress('Updating vertical pack')"),
  'vertical picker uses the centered progress overlay while rebuilding normalization');
assert.ok(/\.vertical-picker-grid[\s\S]{0,220}grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(220px,\s*1fr\)\)/.test(css),
  'vertical picker uses a responsive grid of vertical choices');
assertNotIncludes('data-command="cancel-run"', 'Cancel Scan is removed from the ribbon (per UX cleanup)');
assertNotIncludes('data-command="keyboard-shortcuts"', 'Keyboard Shortcuts button is removed from the About group');

/* Auto AI + Manual AI merged into a single "AI" group per user
   preference — both controls still exist inside the same group. */
assertIncludes('<div class="rb-group-label">AI</div>', 'Analyze tab includes merged AI group label');
assertNotIncludes('<div class="rb-group-label">Auto AI</div>', 'Auto AI is no longer a standalone group');
assertNotIncludes('<div class="rb-group-label">Manual AI</div>', 'Manual AI is no longer a standalone group');
assertIncludes('id="integratedAiProviderMenu"', 'AI group still contains provider menu');
assertIncludes('id="integratedAiSideProviders"', 'AI group still contains side provider stack');
assertIncludes('id="manualAiBtn"', 'AI group still contains Manual AI action button');
assertNotIncludes('<div class="rb-group-label">Select what to compare and analyze</div>', 'Analyze tab does not duplicate the AI modal checklist in the ribbon');
assertIncludes('<div class="rb-group-label">AI Results</div>', 'Analyze tab keeps AI Results group');
assertIncludes('<div class="rb-group-label">Settings</div>', 'Analyze tab includes Settings group');
assertNotIncludes('data-stage-option="finalRecommendation"', 'Analyze ribbon no longer owns stage option checkboxes');
assertNotIncludes('data-stage-option="secondOpinion"', 'Second opinion stage selection stays inside the AI modal only');

/* Products Table View tab was merged into Products in the Phase 5
   cleanup — every grid control now lives in the single Products tab
   under the View + Organize groups. */
assertNotIncludes('class="ribbon-pane" data-pane="view"', 'old View ribbon pane is gone');
assertNotIncludes('data-list-mirror="view"',              'old View list-mirror is gone');
assertIncludes('<div class="rb-group-label">View</div>',      'merged Products tab exposes View group');
assertIncludes('<div class="rb-group-label">Organize</div>',  'merged Products tab exposes Organize group');
assertIncludes('<div class="rb-group-label">Review &amp; Rules</div>', 'merged Products tab exposes Review & Rules group');
assertIncludes('data-group-id="list" data-collapsed-label="List"', 'Products List group has a collapsed popup label');
assertIncludes('class="rb-stack rb-list-actions"', 'Products List actions render in a dedicated horizontal action row');
assertIncludes('data-group-id="actions" data-collapsed-label="Products"', 'Products Actions group has a collapsed popup label');
assertIncludes('data-group-id="view" data-collapsed-label="View"', 'Products View group has a collapsed popup label');
assertIncludes('data-group-id="organize" data-collapsed-label="Organize"', 'Products Organize group has a collapsed popup label');
assertIncludes('data-group-id="review" data-collapsed-label="Review"', 'Products Review group has a collapsed popup label');
assertIncludes('class="rb-group-content" data-collapsed-label="Organize"', 'Organize popup button label is readable from group content');
assertIncludes('class="rb-group-content" data-collapsed-label="Review"', 'Review popup button label is readable from group content');
assert.ok(/\.rb-office-ribbon\s+\.rb-group\s*{[\s\S]{0,180}flex:\s*0 0 auto;/.test(ribbonCss),
  'Office ribbon groups do not flex-shrink into internal overlap');
assert.ok(/\.rb-office-ribbon\s+\.rb-group\[data-group-id="list"\]\s+>\s+\.rb-group-content\s*{[\s\S]{0,320}grid-template-rows:\s*auto auto;/.test(ribbonCss),
  'List group stacks the Product List select on top of the +/pencil/× action row');
assert.ok(/\.rb-list-actions\s*{[\s\S]{0,220}justify-content:\s*flex-start;/.test(ribbonCss),
  'List actions are LEFT-aligned in a horizontal row (buttons hug the start of the select, not the right edge)');
assert.ok(/\.rb-organize-tools\s+\.rb-btn-lg,[\s\S]{0,260}width:\s*auto;/.test(ribbonCss),
  'Organize Filters/Reset buttons do not stretch into wide blocks');
assert.ok(/\{\s*groupId:\s*'review',\s*size:\s*'Popup'\s*\}/.test(productsTabInitJs),
  'Review group collapses as a whole before it can overlap');
assert.ok(/\{\s*groupId:\s*'organize',\s*size:\s*'Popup'\s*\}/.test(productsTabInitJs),
  'Organize group collapses as a whole before controls can overlap');
assert.ok(!/\{\s*groupId:\s*'review',\s*size:\s*'(Middle|Small)'\s*\}/.test(productsTabInitJs),
  'Review group does not use squeeze-prone Middle/Small states');
assert.ok(!/\{\s*groupId:\s*'organize',\s*size:\s*'(Middle|Small)'\s*\}/.test(productsTabInitJs),
  'Organize group does not use squeeze-prone Middle/Small states');
assertIncludes('data-ss-grid-command="mode-rows"',             'products-as-rows command exists');
assertIncludes('data-ss-grid-command="mode-matrix"',           'compare command exists');
assertIncludes('data-ss-grid-sort-field',                      'sort field picker exists');
assertIncludes('data-ss-grid-command="open-filters"',          'filter command exists');
assertIncludes('data-ss-grid-command="open-columns"',          'columns command exists');
assertIncludes('data-ss-grid-group-field',                     'grouping field picker exists');
assertIncludes('data-ss-grid-command="reset-all"',             'Reset dropdown includes reset-all wipes-everything action');
assertNotIncludes('data-ss-grid-command="width-fit"',          'width-fit toggle removed (full is CSS default)');
assertNotIncludes('data-ss-grid-command="width-full"',         'width-full toggle removed (full is CSS default)');
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
assert.ok(js.includes('openAboutPage'), 'About renders from the dashboard content page');
assert.ok(js.includes('openHelpPage'), 'Help renders from the dashboard content page');
assert.ok(!js.includes('renderMarkdownToHtml'), 'legacy markdown help/about renderer is removed');
assert.ok(js.includes('openDashboardInfoPage'), 'ribbon informational commands open inside the main content area');
assert.ok(js.includes('openFeedbackPage'), 'suggest feature and report bug open inside the main content area');
assert.ok(feedbackJs.includes('dashboard-primary-action'), 'feedback Send button uses the dashboard themed action style');
assert.ok(settingsJs.includes('class="dashboard-primary-action" id="saveProvider"'),
  'embedded settings Save button uses the dashboard primary action style');
assert.ok(settingsJs.includes('mount: mount'), 'settings module exposes an embedded dashboard mount');
assert.ok(settingsJs.includes('data-settings-nav="ai-providers"'), 'embedded settings has a left-pane AI Providers navigation item');
assert.ok(settingsJs.includes('data-settings-nav="quick-capture"'), 'embedded settings has a left-pane Quick Capture Button navigation item');
assert.ok(settingsJs.includes('data-settings-nav="open-facts"'), 'embedded settings has a left-pane Open*Facts Enrichment navigation item');
assert.ok(settingsJs.includes('AI Providers</strong>'), 'settings left nav names AI Providers');
assert.ok(!settingsJs.includes('<h3>AI Providers</h3>'), 'settings main panel does not repeat the left-nav AI Providers label as its content heading');
assert.ok(settingsJs.includes('<h3>Provider Connections</h3>'), 'settings main AI panel uses a distinct content heading');
assert.ok(settingsJs.includes('Quick Capture Button</strong>'), 'settings left nav names Quick Capture Button');
assert.ok(settingsJs.includes('Open*Facts Enrichment</strong>'), 'settings left nav names Open*Facts Enrichment');
assert.ok(settingsJs.includes('data-settings-panel="ai-providers"'), 'embedded settings has a main AI Providers panel');
assert.ok(settingsJs.includes('data-settings-panel="quick-capture"'), 'embedded settings has a main Quick Capture panel');
assert.ok(settingsJs.includes('data-settings-panel="open-facts"'), 'embedded settings has a main Open*Facts panel');
assert.ok(settingsJs.includes('openSetupGuideModal'), 'embedded settings opens the setup guide in a modal');
assert.ok(settingsJs.includes('bindSettingsNav'), 'embedded settings binds left navigation to main content panels');
assert.ok(settingsJs.includes('function currentSettingsRoot'), 'settings panel switching is scoped to the mounted settings root');
assert.ok(settingsJs.includes('showSettingsPanel(link.getAttribute(\'data-settings-nav\'), rootEl)'), 'settings nav click updates the local settings main panel');
assert.ok(settingsJs.includes('clearTestResult()'), 'settings nav switching clears transient Saved/test messages');
assert.ok(!settingsJs.includes('dashboard-settings-side'), 'embedded settings does not render a duplicate right-side settings pane');
assert.ok(!settingsJs.includes('id="savedPill"'), 'embedded settings does not render the floating Saved label');
assert.ok(!settingsJs.includes('id="guideInstructions"'), 'embedded settings does not render an inline setup guide panel');
assert.ok(settingsJs.includes('data-settings-nav="ai-providers"'), 'shared settings shell has a left-pane AI Providers navigation item');
assert.ok(settingsJs.includes('data-settings-nav="quick-capture"'), 'shared settings shell has a left-pane Quick Capture Button navigation item');
assert.ok(settingsJs.includes('data-settings-nav="open-facts"'), 'shared settings shell has a left-pane Open*Facts Enrichment navigation item');
assert.ok(settingsJs.includes('data-settings-panel="ai-providers"'), 'shared settings shell has a main AI Providers panel');
assert.ok(settingsHtml.includes('id="settingsMount"'), 'standalone settings uses the shared settings mount point');
assert.ok(!settingsHtml.includes('id="providerList"'), 'standalone settings does not duplicate the provider list markup outside the shared shell');
assert.ok(!settingsHtml.includes('id="roleRows"'), 'standalone settings does not duplicate pipeline role markup outside the shared shell');
assert.ok(!settingsHtml.includes('id="savedPill"'), 'standalone settings does not render the floating Saved label');
assert.ok(!settingsHtml.includes('guide-frame'), 'standalone settings does not render the old setup-guide iframe');
assert.ok(settingsJs.includes("document.getElementById('settingsMount')"), 'settings module mounts the shared shell on standalone settings.html');
assert.ok(settingsJs.includes('One click adds the product to'), 'embedded settings preserves quick-capture guidance');
assert.ok(settingsJs.includes('No personal data is sent'), 'embedded settings preserves Open*Facts privacy guidance');
assert.ok(settingsJs.includes('Open Food Facts (groceries)'), 'embedded settings preserves detailed Open*Facts source labels');
assert.ok(settingsJs.includes('Open Beauty Facts (cosmetics)'), 'embedded settings preserves Open Beauty Facts source label');
assert.ok(settingsJs.includes('Open Pet Food Facts (pet food)'), 'embedded settings preserves Open Pet Facts source label');
assert.ok(settingsJs.includes('Open Products Facts (everything else)'), 'embedded settings preserves Open Products Facts source label');
assert.ok(settingsJs.includes('aria-expanded="${expanded ? \'true\' : \'false\'}"'), 'provider list uses accordion expanded state');
assert.ok(settingsJs.includes('data-provider-toggle'), 'provider list has explicit accordion toggle buttons');
assert.ok(settingsJs.includes('provider-state-on'), 'provider cards render muted enabled state');
assert.ok(settingsJs.includes('provider-state-off'), 'provider cards render muted disabled state');
assert.ok(aiProvidersJs.includes('Microsoft Copilot'), 'settings provider data includes Microsoft Copilot');
assert.ok(aiProvidersJs.includes('Local LLM (Ollama / LM Studio)'), 'settings provider data includes local LLM setup');
assert.ok(css.includes('.dashboard-settings-nav {') && css.includes('gap: 10px;'), 'embedded settings left nav has visible spacing between menu items');
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
