const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const monitorPath = path.join(__dirname, '..', 'ai-dev-monitor.js');
const source = fs.readFileSync(monitorPath, 'utf8');

const context = {
  window: {},
  globalThis: {},
  Date,
  console
};
context.window = context.globalThis;

vm.createContext(context);
vm.runInContext(source, context, { filename: monitorPath });

const Monitor = context.globalThis.ShopScoutAIDevMonitor;

const state = Monitor.createMonitorState({
  productIndexes: [0, 2],
  productCount: 2
});

assert.deepStrictEqual(
  Array.from(state.stages, stage => stage.id),
  ['retrieval', 'verification', 'enrichment', 'comparison', 'secondOpinion'],
  'monitor initializes all possible pipeline stages'
);
assert.strictEqual(state.productCount, 2, 'monitor keeps selected product count');
assert.strictEqual(state.productIndexesText, '1, 3', 'monitor displays user-facing product numbers');
assert.strictEqual(Monitor.getProgressPercent(state), 0, 'waiting monitor starts at zero progress');
assert.ok(Monitor.getCurrentStatusText(state).includes('Preparing AI request'), 'waiting monitor gives a human-readable status');
assert.ok(
  !Monitor.getCurrentStatusText(state).includes('background AI pipeline'),
  'waiting monitor does not expose internal background-pipeline wording'
);

Monitor.applyProgressEvent(state, {
  type: 'run-started',
  runId: 'run-123',
  stages: ['retrieval', 'verification'],
  timestamp: '2026-06-22T20:00:00.000Z'
});

assert.strictEqual(state.runId, 'run-123', 'run-started sets the real run id');
assert.strictEqual(
  state.stages.find(stage => stage.id === 'comparison').status,
  'not-needed',
  'stages outside this run are marked not needed'
);
assert.strictEqual(Monitor.getProgressPercent(state), 0, 'run-started keeps progress at zero until a stage starts');

Monitor.applyProgressEvent(state, {
  type: 'stage-started',
  stage: 'retrieval',
  providerName: 'Perplexity',
  model: 'sonar-pro',
  promptSnippet: 'Find official manufacturer pages',
  timestamp: '2026-06-22T20:00:01.000Z'
});

assert.ok(
  Monitor.getCurrentStatusText(state).includes('Search / Retrieval') && Monitor.getCurrentStatusText(state).includes('Perplexity'),
  'running status explains the active stage and provider'
);
assert.ok(
  Monitor.getProgressPercent(state) > 0 && Monitor.getProgressPercent(state) < 100,
  'running stage shows partial progress'
);

Monitor.applyProgressEvent(state, {
  type: 'stage-completed',
  stage: 'retrieval',
  status: 'completed',
  responseSnippet: 'Found official specs and manual.',
  sourceUrls: ['https://example.com/specs'],
  timestamp: '2026-06-22T20:00:04.000Z'
});

const retrieval = state.stages.find(stage => stage.id === 'retrieval');
assert.strictEqual(retrieval.status, 'completed', 'completed events update stage status');
assert.strictEqual(retrieval.providerName, 'Perplexity', 'stage keeps provider name');
assert.strictEqual(retrieval.model, 'sonar-pro', 'stage keeps provider model');
assert.strictEqual(retrieval.sourceUrls[0], 'https://example.com/specs', 'stage keeps source URLs');
assert.ok(state.events.some(event => event.responseSnippet.includes('official specs')), 'monitor keeps event snippets');
assert.strictEqual(Monitor.getProgressPercent(state), 50, 'one of two active stages completed is half progress');

Monitor.applyProgressEvent(state, {
  type: 'run-completed',
  runId: 'run-123',
  status: 'completed',
  timestamp: '2026-06-22T20:00:07.000Z'
});

assert.strictEqual(Monitor.getProgressPercent(state), 100, 'completed run shows full progress');
assert.ok(Monitor.getCurrentStatusText(state).includes('complete'), 'completed run gives a completion status');

const log = Monitor.buildCopyableLog(state);
assert.ok(log.includes('Run: run-123'), 'copyable log includes run id');
assert.ok(log.includes('retrieval: completed'), 'copyable log includes stage status');
assert.ok(log.includes('https://example.com/specs'), 'copyable log includes source URLs');

const comparisonHtml = fs.readFileSync(path.join(__dirname, '..', 'comparison.html'), 'utf8');
const comparisonJs = fs.readFileSync(path.join(__dirname, '..', 'comparison.js'), 'utf8');
const backgroundJs = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
assert.ok(comparisonHtml.includes('id="aiDevProgressText"'), 'AI monitor includes dynamic progress text');
assert.ok(comparisonHtml.includes('id="aiDevProgressFill"'), 'AI monitor includes a progress fill bar');
assert.ok(comparisonJs.includes('getCurrentStatusText(activeAiMonitorState)'), 'comparison UI renders dynamic monitor status text');
assert.ok(comparisonJs.includes('getProgressPercent(activeAiMonitorState)'), 'comparison UI renders monitor progress percent');
assert.ok(comparisonJs.includes('recordAiDevLocalEvent'), 'comparison UI records local AI monitor events');
assert.ok(comparisonJs.includes('AI request prepared in the browser'), 'live events show the browser-side run preparation');
assert.ok(!comparisonJs.includes('showAiRunStatusToast();'), 'AI progress does not create a bottom-page loading toast');
assert.ok(!comparisonJs.includes('Waiting for the background AI pipeline to start'), 'comparison UI avoids vague background-pipeline waiting text');
assert.ok(!source.includes('Waiting for the background AI pipeline to start'), 'monitor model avoids vague background-pipeline waiting text');
assert.ok(backgroundJs.includes('Checking AI provider settings'), 'background run reports settings checks to live events');
assert.ok(backgroundJs.includes('Loaded products and selected analysis checks'), 'background run reports product/check loading to live events');
assert.ok(backgroundJs.includes('Built prompt and calling'), 'background run reports provider calls to live events');

console.log('ai dev monitor tests passed');
