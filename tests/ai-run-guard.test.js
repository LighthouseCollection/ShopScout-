const assert = require('assert');
const fs = require('fs');
const path = require('path');

const comparisonJs = fs.readFileSync(path.join(__dirname, '..', 'comparison.js'), 'utf8');
const backgroundJs = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');

assert.ok(
  comparisonJs.includes('let aiRunInProgress = false'),
  'comparison page tracks whether an integrated AI run is already in progress'
);
assert.ok(
  comparisonJs.includes('AI analysis is already running. Wait for this run to finish before starting another one.'),
  'comparison page shows a clear duplicate-run message'
);
assert.ok(
  /document\.getElementById\('aiOptionsRun'\)\?\.addEventListener\('click'[\s\S]*runBtn\.disabled = true[\s\S]*Starting/.test(comparisonJs),
  'AI options submit disables immediately to prevent double-click duplicate runs'
);
assert.ok(
  /async function runConnectedAI[\s\S]*if \(aiRunInProgress\)[\s\S]*return;/.test(comparisonJs),
  'connected AI runner refuses a second client-side run'
);
assert.ok(
  /finally \{[\s\S]*aiRunInProgress = false/.test(comparisonJs),
  'client-side AI run guard resets in finally'
);

assert.ok(
  backgroundJs.includes('let activeAIAnalysisRun = null'),
  'background worker tracks active integrated AI run'
);
assert.ok(
  /async function runAIAnalysis[\s\S]*if \(activeAIAnalysisRun\)[\s\S]*return \{ success: false, error/.test(backgroundJs),
  'background worker refuses duplicate run before provider calls'
);
assert.ok(
  /finally \{[\s\S]*activeAIAnalysisRun = null/.test(backgroundJs),
  'background duplicate-run guard resets in finally'
);
assert.ok(
  backgroundJs.includes('openDashboardRunResults'),
  'background worker can open dashboard results after a completed AI run'
);
assert.ok(
  backgroundJs.includes('message.openResultsOnComplete'),
  'background result-opening handoff is opt-in per AI run request'
);
assert.ok(
  backgroundJs.includes('comparison.html?aiRun='),
  'background opens dashboard directly to the completed run id'
);
assert.ok(
  backgroundJs.includes("run.status = failedStages.length ? (completedStages.length ? 'partial' : 'failed') : 'completed'"),
  'background marks quota/interrupted runs with saved completed stages as partial'
);
assert.ok(
  /catch \(e\) \{[\s\S]*const partialRun = activeAIAnalysisRun\?\.run[\s\S]*return \{ success: false, error: e\.message \|\| 'AI analysis failed', run: partialRun \}/.test(backgroundJs),
  'background returns the saved partial run if an unexpected AI pipeline error occurs'
);
assert.ok(
  /if \(!result\?\.success\) \{[\s\S]*if \(result\?\.run\)[\s\S]*showAiRunResults\(result\.run/.test(comparisonJs),
  'comparison page opens partial AI results returned from a failed/quota-limited run'
);
assert.ok(
  /const result = await chrome\.runtime\.sendMessage[\s\S]*showAiRunResults\(result\.run/.test(comparisonJs),
  'comparison page opens the just-completed AI run instead of leaving the user on the product grid'
);

console.log('ai run guard tests passed');
