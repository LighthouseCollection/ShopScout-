const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const srcPath = path.join(root, 'shared', 'manualAiResultParser.js');
const src = fs.readFileSync(srcPath, 'utf8');
const ctx = { console, globalThis: {} };
ctx.window = ctx.globalThis;
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'shared/manualAiResultParser.js' });

const parser = ctx.globalThis.ShopScoutManualAIResultParser;
assert.ok(parser, 'manual AI result parser namespace is registered');
assert.strictEqual(typeof parser.parseTableUpdates, 'function', 'parseTableUpdates is exported');

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const report = `
# Final Verdict

Buy Product 2 for best value.

# ShopScout Table Updates

| Product # | Product name | Field | Current/listed value | Recommended value | Update type | Confidence | Reason |
|---|---|---|---|---|---|---|---|
| 1 | Ziweo PL01 | Maximum Pressure | 2,176 PSI | approximately 150 PSI | Correct value | High | Physically impossible for this class. |
| 2 | Calmara Y34 | Airflow | 24 microliters/min | Unknown | Mark invalid | High | Unit is impossible and cannot be converted. |
| 3 | Lamicall VHEP02 | New field: Airflow | 35-liter tank | 35 L/min | Move value to better field | Medium | Field mapping error. |
| 4 | Unsafe | ASIN | B000OLD | B000NEW | Correct value | High | Identity field should not auto-apply. |
`;

const parsed = parser.parseTableUpdates(report);
assert.strictEqual(parsed.length, 4, 'all update table rows are parsed');
assert.deepStrictEqual(
  plain(parsed[0]),
  {
    productNumber: 1,
    productName: 'Ziweo PL01',
    field: 'Maximum Pressure',
    currentValue: '2,176 PSI',
    recommendedValue: 'approximately 150 PSI',
    updateType: 'Correct value',
    confidence: 'High',
    reason: 'Physically impossible for this class.',
    protectedIdentifier: false
  },
  'first parsed update is normalized to the expected shape'
);
assert.strictEqual(parsed[2].field, 'Airflow', 'New field prefix is stripped for field matching');
assert.strictEqual(parsed[3].protectedIdentifier, true, 'identifier fields are flagged as protected');

const applied = parser.applyTableUpdatesToProducts([
  { name: 'Ziweo PL01', specs: { 'Maximum Pressure': '2,176 PSI' } },
  { name: 'Calmara Y34', rawSpecs: [{ key: 'Airflow', value: '24 microliters/min' }] },
  { name: 'Lamicall VHEP02', specs: {} },
  { name: 'Unsafe', identifiers: { asin: 'B000OLD' }, specs: { ASIN: 'B000OLD' } }
], parsed, { sourceRunId: 'manual-1' });

assert.strictEqual(applied.applied.length, 3, 'safe parsed rows are auto-applied');
assert.strictEqual(applied.skipped.length, 1, 'protected identifier update is skipped');
assert.strictEqual(applied.products[0].specs['Maximum Pressure'], 'approximately 150 PSI', 'existing spec dict is updated');
assert.strictEqual(applied.products[1].rawSpecs[0].value, 'Unknown', 'raw spec row is updated');
assert.strictEqual(applied.products[2].specs.Airflow, '35 L/min', 'new spec field is added');
assert.ok(applied.products[0]._manualAiCorrections?.length, 'applied correction provenance is recorded');
assert.strictEqual(applied.products[3].specs.ASIN, 'B000OLD', 'protected identifier value is not overwritten');

assert.strictEqual(typeof parser.inferProductVerdicts, 'function', 'manual AI parser exports verdict inference');
const verdicts = parser.inferProductVerdicts([
  { name: 'Alpha Camera' },
  { name: 'Beta Camera' },
  { name: 'Gamma Camera' }
], `
## Final Verdict
- Product 1 Alpha Camera is the best value and recommended.
- Product 2 Beta Camera should be avoided.
- Product 3 Gamma Camera is acceptable only if discounted.
`);
assert.deepStrictEqual(
  verdicts.map(item => ({ productIndex: item.productIndex, tone: item.tone })),
  [
    { productIndex: 0, tone: 'recommended' },
    { productIndex: 1, tone: 'avoid' },
    { productIndex: 2, tone: 'caution' }
  ],
  'manual AI verdict text maps products to recommended / avoid / caution row tones'
);

console.log('manual AI result parser tests passed');
