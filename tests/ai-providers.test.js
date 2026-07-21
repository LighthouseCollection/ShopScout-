const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const providerPath = path.join(__dirname, '..', 'ai-providers.js');
const source = fs.readFileSync(providerPath, 'utf8');

const context = {
  console,
  crypto: { randomUUID: () => 'test-run-id' },
  Date,
  JSON,
  URL,
  setTimeout,
  clearTimeout,
  globalThis: {}
};
context.window = context.globalThis;

vm.createContext(context);
vm.runInContext(source, context, { filename: providerPath });

const AI = context.globalThis.ShopScoutAI;

const expectedProviders = [
  'openai', 'anthropic', 'gemini', 'perplexity', 'xai',
  'deepseek', 'mistral', 'poe', 'meta', 'copilot'
];

assert.deepStrictEqual(
  expectedProviders.every(id => !!AI.getProvider(id)),
  true,
  'provider registry includes all requested AI providers'
);
assert.ok(
  AI.getProvider('openai').models.some(model => model.recommended),
  'OpenAI provider exposes a recommended model catalog'
);
assert.strictEqual(
  AI.getProvider('openai').defaultModel,
  'gpt-5.4-mini',
  'OpenAI default uses a current cost-balanced model for product comparison'
);
assert.ok(
  AI.getProvider('anthropic').models.some(model => model.tier === 'balanced'),
  'Claude provider exposes balanced model choices'
);
assert.ok(
  AI.getProvider('perplexity').models.some(model => model.stage === 'retrieval'),
  'Perplexity provider marks retrieval models'
);

const settings = AI.createDefaultSettings();
assert.strictEqual(settings.roles.retrieval, 'auto', 'retrieval defaults to automatic provider selection');
assert.strictEqual(settings.roles.verification, 'auto', 'verification defaults to automatic provider selection');
assert.strictEqual(settings.roles.enrichment, 'auto', 'enrichment defaults to automatic provider selection');
assert.strictEqual(settings.roles.comparison, 'auto', 'comparison defaults to automatic provider selection');

settings.providers.openai.enabled = true;
settings.providers.openai.apiKey = 'sk-test';
assert.strictEqual(AI.hasConfiguredProvider(settings), true, 'hasConfiguredProvider detects an enabled API-key provider');
const noKeySettings = AI.createDefaultSettings();
noKeySettings.providers.openai.enabled = true;
assert.strictEqual(AI.hasConfiguredProvider(noKeySettings), false, 'hasConfiguredProvider requires an API key');
assert.strictEqual(
  AI.resolveProviderForStage(settings, 'verification').id,
  'openai',
  'auto roles fall back to the connected default provider'
);

const event = AI.createEvidenceEvent({
  providerId: 'perplexity',
  model: 'sonar-pro',
  stage: 'retrieval',
  prompt: 'find official specs',
  responseText: '{"claim":"Model found"}',
  sourceUrls: ['https://example.com/specs']
});
assert.strictEqual(event.providerId, 'perplexity', 'evidence event keeps provider id');
assert.strictEqual(event.stage, 'retrieval', 'evidence event keeps stage');
assert.strictEqual(event.sourceUrls[0], 'https://example.com/specs', 'evidence event keeps source URLs');
assert.ok(event.id, 'evidence event has id');

const parsed = AI.extractJsonFromText('Report first\n```json\n{"quick_verdict":{"best_overall":{"product_id":1}}}\n```');
assert.strictEqual(parsed.quick_verdict.best_overall.product_id, 1, 'extractJsonFromText parses fenced JSON');

const customSettings = AI.mergeSettings({
  version: 2,
  roles: { retrieval: 'perplexity', verification: 'anthropic', enrichment: 'openai', comparison: 'openai' }
});
assert.strictEqual(customSettings.roles.retrieval, 'perplexity', 'version 2 saved role selections are preserved');

const migratedModelSettings = AI.mergeSettings({
  version: 2,
  providers: { openai: { model: 'gpt-5.1' } }
});
assert.strictEqual(
  migratedModelSettings.providers.openai.model,
  'gpt-5.4-mini',
  'retired OpenAI model choices migrate to the recommended model'
);

const prompt = AI.buildStagePrompt('verification', [{ title: 'Test Product', brand: 'Brand' }], [event]);
assert.ok(prompt.includes('listing-vs-official verification'), 'verification prompt names the stage goal');
assert.ok(prompt.includes('Perplexity'), 'stage prompt includes prior provider evidence');

const openaiRequest = AI.buildRequest(AI.getProvider('openai'), settings.providers.openai, 'test');
assert.ok(
  !Object.prototype.hasOwnProperty.call(openaiRequest.body, 'temperature'),
  'OpenAI Responses requests omit temperature for model compatibility'
);

console.log('ai provider tests passed');
