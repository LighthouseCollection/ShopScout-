const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const providerPath = path.join(__dirname, '..', 'ai-providers.js');
const source = fs.readFileSync(providerPath, 'utf8');
const comparisonHtml = fs.readFileSync(path.join(__dirname, '..', 'comparison.html'), 'utf8');
const comparisonJs = fs.readFileSync(path.join(__dirname, '..', 'comparison.js'), 'utf8');
const settingsHtml = fs.readFileSync(path.join(__dirname, '..', 'settings.html'), 'utf8');
const settingsJs = fs.readFileSync(path.join(__dirname, '..', 'settings.js'), 'utf8');
const backgroundJs = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');

const context = {
  console,
  crypto: { randomUUID: () => 'token-test-id' },
  Date,
  JSON,
  URL,
  Math,
  globalThis: {}
};
context.window = context.globalThis;

vm.createContext(context);
vm.runInContext(source, context, { filename: providerPath });

const AI = context.globalThis.ShopScoutAI;

const settings = AI.createDefaultSettings();
assert.strictEqual(settings.providers.openai.tokenBudget, 0, 'providers default to no token budget');
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(settings.providers.openai.tokenUsage)),
  { input: 0, output: 0, total: 0, estimated: 0, reported: 0, requests: 0, lastUpdated: '' },
  'providers default to empty tracked token usage'
);

const merged = AI.mergeSettings({
  providers: {
    openai: {
      tokenBudget: '50000',
      tokenUsage: { input: '1000', output: '250', total: '1250', estimated: '100', reported: '1150', requests: '3', lastUpdated: '2026-06-23T00:00:00.000Z' }
    }
  }
});
assert.strictEqual(merged.providers.openai.tokenBudget, 50000, 'merge normalizes token budgets');
assert.strictEqual(merged.providers.openai.tokenUsage.total, 1250, 'merge normalizes existing token usage');

const openAiUsage = AI.extractProviderTokenUsage('openai-responses', {
  usage: { input_tokens: 120, output_tokens: 30, total_tokens: 150 }
}, 'prompt', 'response');
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(openAiUsage)),
  { input: 120, output: 30, total: 150, estimated: false },
  'OpenAI Responses usage is parsed from provider response'
);

const fallbackUsage = AI.extractProviderTokenUsage('unknown-parser', {}, 'x'.repeat(400), 'y'.repeat(80));
assert.strictEqual(fallbackUsage.input, 100, 'fallback estimates prompt tokens by character count');
assert.strictEqual(fallbackUsage.output, 20, 'fallback estimates output tokens by character count');
assert.strictEqual(fallbackUsage.total, 120, 'fallback combines estimated input and output tokens');
assert.strictEqual(fallbackUsage.estimated, true, 'fallback usage is marked estimated');

AI.addProviderTokenUsage(merged, 'openai', { input: 200, output: 100, total: 300, estimated: false }, '2026-06-23T01:00:00.000Z');
assert.strictEqual(merged.providers.openai.tokenUsage.total, 1550, 'usage updates accumulate total tokens');
assert.strictEqual(merged.providers.openai.tokenUsage.reported, 1450, 'reported token usage is tracked separately');
assert.strictEqual(merged.providers.openai.tokenUsage.requests, 4, 'usage updates increment request count');

const summary = AI.getProviderTokenSummary(merged, 'openai');
assert.strictEqual(summary.remaining, 48450, 'token summary calculates budget remaining');
assert.ok(summary.label.includes('OpenAI'), 'token summary includes provider label');
assert.ok(summary.label.includes('48.5K left'), 'token summary formats remaining tokens compactly');
assert.ok(summary.label.includes('1.6K used'), 'token summary formats used tokens compactly');

assert.ok(settingsHtml.includes('id="tokenBudgetInput"'), 'settings exposes a token budget field');
assert.ok(settingsHtml.includes('id="tokenUsageSummary"'), 'settings exposes a provider usage summary');
assert.ok(settingsHtml.includes('id="resetTokenUsage"'), 'settings exposes reset token usage action');
assert.ok(settingsJs.includes('renderTokenUsageSummary'), 'settings renders token usage');
assert.ok(settingsJs.includes('tokenBudgetInput'), 'settings saves token budget');
assert.ok(settingsJs.includes('resetTokenUsage'), 'settings can reset token usage');

assert.ok(comparisonHtml.includes('id="aiTokenUsage"'), 'comparison topbar includes AI token usage text');
assert.ok(comparisonHtml.includes('class="ai-token-usage"'), 'AI token usage uses plain text styling');
assert.ok(!comparisonHtml.includes('class="ai-token-pill"'), 'AI token usage is not styled as a pill/button');
assert.ok(!/\.ai-token-usage\s*\{[^}]*border:/.test(comparisonHtml), 'AI token usage text has no border styling');
assert.ok(!/\.ai-token-usage\s*\{[^}]*background:/.test(comparisonHtml), 'AI token usage text has no background styling');
assert.ok(comparisonJs.includes('renderAiTokenUsageText'), 'comparison renders AI token usage as status text');
assert.ok(comparisonJs.includes('getProviderTokenSummary'), 'comparison uses provider token summary helper');
assert.ok(backgroundJs.includes('extractProviderTokenUsage'), 'background extracts provider token usage');
assert.ok(backgroundJs.includes('addProviderTokenUsage'), 'background accumulates provider token usage');

console.log('ai token usage tests passed');
