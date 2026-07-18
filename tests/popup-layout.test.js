const assert = require('assert');
const { read, pageAndStyles } = require('./_helpers');

const html = pageAndStyles('popup.html', 'popup.css');
const js = read('popup.js');

assert.ok(html.includes('id="addBtn"'), 'popup keeps Add Current Product as a gather action');
assert.ok(html.includes('id="addWindowBtn"'), 'popup keeps Add Products from Open Tabs as a gather action');
assert.ok(html.includes('id="urlSubmitBtn"'), 'popup keeps Add URL as a gather action');
assert.ok(html.indexOf('src="normalization/libraries/defaultRules.js"') > -1,
  'popup loads the normalization rule library for captured products');
assert.ok(html.indexOf('src="normalization/libraries/defaultRules.js"') < html.indexOf('src="normalization/registry.js"'),
  'normalization rule library loads before v2 normalization in the popup');
assert.ok(html.indexOf('src="normalization/taxonomyBridge.js"') > -1,
  'popup loads taxonomy bridge for captured products');
assert.ok(html.indexOf('src="normalization/taxonomyBridge.js"') < html.indexOf('src="normalization/registry.js"'),
  'taxonomy bridge loads before v2 normalization in the popup');
assert.ok(!html.includes('src="normalization/attributes.js"'),
  'popup no longer loads retired attribute normalization sidecar');
assert.ok(html.indexOf('src="normalization/normalize.js"') > -1,
  'popup loads v2 normalization dispatcher for captured products');
assert.ok(html.indexOf('src="normalization/normalize.js"') < html.indexOf('src="data/productRepo.js"'),
  'v2 normalization loads before productRepo in the popup');
assert.ok(html.indexOf('src="shared/productSpecAccess.js"') > -1,
  'popup loads ProductSpec access helpers for spec-aware product operations');
assert.ok(html.indexOf('src="shared/productSpecAccess.js"') < html.indexOf('src="normalization/matching.js"'),
  'ProductSpec access helpers load before matching in the popup');
assert.ok(html.indexOf('src="normalization/matching.js"') > -1,
  'popup loads dedupe matching helpers for product lists');
assert.ok(html.indexOf('src="normalization/matching.js"') < html.indexOf('src="data/productRepo.js"'),
  'dedupe matching loads before productRepo in the popup');
assert.ok(html.indexOf('src="ui/progressOverlay.js"') > -1,
  'popup loads the centered progress overlay UI primitive');
assert.ok(html.indexOf('src="ui/toast.js"') < html.indexOf('src="ui/progressOverlay.js"'),
  'popup loads toast before progress overlay in the UI core bundle');
assert.ok(html.indexOf('src="ui/progressOverlay.js"') < html.indexOf('src="utils.js"'),
  'popup loads progress overlay before utils and popup actions');
assert.ok(html.includes('id="dashboardBtn"'), 'popup includes the dashboard shortcut');
assert.ok(html.includes('Open Comparison Dashboard'), 'dashboard shortcut is labeled Open Comparison Dashboard');
assert.ok(html.includes('class="header-action-bar"'),
  'labeled dashboard button lives in a dedicated action bar below the header');
assert.ok(!html.includes('id="settingsBtn"'), 'popup side panel does not include the Settings gear');
assert.ok(!html.includes('title="Settings"'), 'popup side panel does not include a Settings command');
assert.ok(!js.includes("getElementById('settingsBtn')"), 'popup side panel does not bind a Settings command');
assert.ok(!js.includes("chrome.runtime.getURL('settings.html')"), 'popup side panel does not open standalone settings');
assert.ok(html.indexOf('class="dashboard-open-btn"') > html.indexOf('</header>'),
  'dashboard action bar renders immediately below the header');
assert.ok(!html.includes('AI Analyze'), 'popup gatherer does not render AI analysis controls');
assert.ok(!html.includes('Auto AI'), 'popup gatherer does not render Auto AI');
assert.ok(!html.includes('Manual AI'), 'popup gatherer does not render Manual AI');
assert.ok(!html.includes('id="aiOptionsModal"'), 'popup gatherer does not render the AI options modal');
assert.ok(!html.includes('data-ai-option='), 'popup gatherer does not include AI option checkboxes');
assert.ok(!html.includes('data-payload-mode='), 'popup gatherer does not include AI payload choices');
assert.ok(!html.includes('id="aiProviderSelect"'), 'popup gatherer does not include AI provider selection');
assert.ok(!html.includes('ai-providers.js'), 'popup gatherer does not load AI provider helpers');
assert.ok(html.includes('--primary: #0b3d4f'), 'popup uses the comparison page primary color token');
assert.ok(html.includes('--accent: #ecd496'), 'popup uses the comparison page accent color token');
assert.ok(html.includes('--menu-bg: #1e2937'), 'popup uses the comparison page ribbon background token');
assert.ok(html.includes('--radius: 4px'), 'popup uses the comparison page compact radius token');
assert.ok(html.includes('Comparison theme alignment'), 'popup includes the comparison theme alignment layer');
assert.ok(html.includes('background: var(--menu-bg);'), 'popup header is styled like the comparison ribbon');
assert.ok(html.includes('background: var(--card);'), 'popup standard buttons use the neutral comparison card treatment');
assert.ok(html.includes('--button-shade:'), 'popup defines a shaded standard button surface');
assert.ok(html.includes('font-weight: 400;'), 'popup standard button text is not bold');
assert.ok(/html,\s*body\s*\{[\s\S]*height:\s*100vh/.test(html),
  'side-panel popup uses the allocated browser viewport height');
assert.ok(/100dvh/.test(html),
  'side-panel popup also uses the dynamic browser viewport height');
assert.ok(/body\s*\{[\s\S]*display:\s*flex[\s\S]*flex-direction:\s*column/.test(html),
  'side-panel popup stacks fixed controls above a flexible product list');
assert.ok(!/body\s*\{[^}]*max-height:\s*780px/.test(html),
  'side-panel popup does not keep the old fixed popup max-height');
assert.ok(/\.product-list\s*\{[\s\S]*flex:\s*1\s+1\s+auto/.test(html),
  'product list grows to fill remaining side-panel height');
assert.ok(!/\.product-list\s*\{[^}]*max-height:\s*500px/.test(html),
  'product list does not keep the old fixed popup max-height');
assert.ok(html.includes('class="button-icon"'), 'popup action buttons include inline icons');
assert.ok(html.includes('<span>Add Products from Open Tabs</span>'), 'open-tabs capture button uses the shorter label with an icon');
assert.ok(!html.includes('id="exportToggle"'), 'popup gatherer does not render save/export controls');
assert.ok(!html.includes('id="importBtn"'), 'popup gatherer does not render import controls');
assert.ok(!html.includes('id="openComparison"'), 'popup gatherer does not render the old dashboard launch control');
assert.ok(!html.includes('id="exiModal"'), 'popup gatherer does not render the save/export modal');

assert.ok(!html.includes('id="quickCompare"'), 'old Quick compare button is removed');
assert.ok(!html.includes('id="deepCompare"'), 'old Deep compare button is removed');
assert.ok(!html.includes('id="verifySpecs"'), 'old Verify button is removed');
assert.ok(!html.includes('btn-ai'), 'popup secondary action buttons do not use separate AI color styling');
assert.ok(!html.includes('btn-open'), 'popup dashboard button does not use separate open color styling');
assert.ok(!html.includes('Open<br>ShopScout'), 'Open ShopScout is a single standard button label');

assert.ok(!js.includes("integratedAnalyze"), 'popup no longer binds integrated AI controls');
assert.ok(!js.includes("manualAnalyze"), 'popup no longer binds manual AI controls');
assert.ok(!js.includes("action: 'runAIAnalysis'"), 'popup no longer starts the background AI pipeline');
assert.ok(!js.includes('openDashboardResults'), 'popup no longer opens AI dashboard results');
assert.ok(js.includes("getElementById('dashboardBtn')"), 'popup binds the dashboard header shortcut');
assert.ok(js.includes("chrome.runtime.getURL('comparison.html')"), 'dashboard shortcut opens comparison.html');
assert.ok(js.includes('ShopScoutUI.progress.start'), 'popup actions use the centered progress overlay for long operations');
assert.ok(!js.includes('buildManualHybridPrompt'), 'popup no longer builds manual AI prompts');
assert.ok(!js.includes("quickCompare"), 'popup no longer binds the old Quick compare button');
assert.ok(!js.includes("deepCompare"), 'popup no longer binds the old Deep compare button');
assert.ok(!js.includes("verifySpecs"), 'popup no longer binds the old Verify specs button');
assert.ok(!js.includes("exportToggle"), 'popup no longer binds export controls');
assert.ok(!js.includes("importBtn"), 'popup no longer binds import controls');
assert.ok(!js.includes("doImport"), 'popup no longer carries import handling');

console.log('popup layout tests passed');
