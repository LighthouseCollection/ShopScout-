const assert = require('assert');
const { read, pageAndStyles } = require('./_helpers');

const html = pageAndStyles('popup.html', 'popup.css');
const js = read('popup.js');

assert.ok(html.includes('AI Analyze'), 'popup secondary actions rename AI Compare to AI Analyze');
assert.ok(html.includes('Auto AI'), 'popup uses a short integrated AI label');
assert.ok(html.includes('Manual AI'), 'popup uses a short manual AI label');
assert.ok(html.includes('id="aiOptionsModal"'), 'popup includes the AI options modal instead of navigating away immediately');
assert.ok(html.includes('data-ai-option="verifySpecs"'), 'popup AI options include verification checks');
assert.ok(html.includes('data-payload-mode="compact"'), 'popup AI options include prompt payload choices');
assert.ok(html.includes('id="aiProviderSelect"'), 'popup integrated AI flow can choose a provider');
assert.ok(html.includes('ai-providers.js'), 'popup loads the shared AI provider helpers');
assert.ok(html.includes('--primary: #0b3d4f'), 'popup uses the comparison page primary color token');
assert.ok(html.includes('--accent: #c4661a'), 'popup uses the comparison page accent color token');
assert.ok(html.includes('--menu-bg: #1e2937'), 'popup uses the comparison page ribbon background token');
assert.ok(html.includes('--radius: 4px'), 'popup uses the comparison page compact radius token');
assert.ok(html.includes('Comparison theme alignment'), 'popup includes the comparison theme alignment layer');
assert.ok(html.includes('background: var(--menu-bg);'), 'popup header is styled like the comparison ribbon');
assert.ok(html.includes('background: var(--card);'), 'popup standard buttons use the neutral comparison card treatment');
assert.ok(html.includes('--button-shade:'), 'popup defines a shaded standard button surface');
assert.ok(html.includes('font-weight: 400;'), 'popup standard button text is not bold');
assert.ok(html.includes('gap: 8px;'), 'popup button icons and labels have consistent spacing');
assert.ok(html.includes('class="button-icon"'), 'popup action buttons include inline icons');
assert.ok(html.includes('<span>Add Products from Open Tabs</span>'), 'open-tabs capture button uses the shorter label with an icon');
assert.ok(html.includes('class="action-group group-data icon-only-group"'), 'file actions are icon-only to prevent overlap');
assert.ok(!html.includes('<span>Save</span>'), 'Save action does not render visible text in the popup toolbar');
assert.ok(!html.includes('<span>Import</span>'), 'Import action does not render visible text in the popup toolbar');

assert.ok(!html.includes('id="quickCompare"'), 'old Quick compare button is removed');
assert.ok(!html.includes('id="deepCompare"'), 'old Deep compare button is removed');
assert.ok(!html.includes('id="verifySpecs"'), 'old Verify button is removed');
assert.ok(!html.includes('btn-ai'), 'popup secondary action buttons do not use separate AI color styling');
assert.ok(!html.includes('btn-open'), 'popup dashboard button does not use separate open color styling');
assert.ok(!html.includes('Open<br>ShopScout'), 'Open ShopScout is a single standard button label');

assert.ok(js.includes("integratedAnalyze"), 'popup binds the integrated AI analysis button');
assert.ok(js.includes("manualAnalyze"), 'popup binds the manual AI analysis button');
assert.ok(js.includes("openPopupAiOptionsModal(undefined, 'auto', 'integrated')"), 'integrated AI opens the popup options modal');
assert.ok(js.includes("openPopupAiOptionsModal(undefined, 'auto', 'manual')"), 'manual AI opens the popup options modal');
assert.ok(js.includes("action: 'runAIAnalysis'"), 'popup integrated AI starts the background AI pipeline');
assert.ok(js.includes('openResultsOnComplete: true'), 'popup asks the background worker to open dashboard results on completion');
assert.ok(js.includes('openDashboardResults'), 'popup opens dashboard results after a completed integrated AI run');
assert.ok(js.includes('comparison.html?aiRun='), 'popup passes the completed run id to the dashboard results page');
assert.ok(js.includes('buildManualHybridPrompt'), 'popup manual AI uses the readable non-JSON manual prompt builder');
assert.ok(js.includes('Do not return JSON'), 'popup manual prompt forbids JSON output');
assert.ok(!js.includes("quickCompare"), 'popup no longer binds the old Quick compare button');
assert.ok(!js.includes("deepCompare"), 'popup no longer binds the old Deep compare button');
assert.ok(!js.includes("verifySpecs"), 'popup no longer binds the old Verify specs button');

console.log('popup layout tests passed');
