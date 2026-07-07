const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'normalization', 'matching.js'), 'utf8');

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'normalization/matching.js' });

const M = ctx.ShopScoutMatching;

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const products = [
  {
    id: 'p1',
    title: 'Bearing, Ball, 6204-2RS',
    brand: 'ACME',
    modelNumber: '6204-2RS',
    newPrice: '$11.49'
  },
  {
    id: 'p2',
    title: '6204 2RS Ball Bearing',
    brand: 'Acme Tools',
    modelNumber: '6204 2RS',
    newPrice: '$12.00'
  },
  {
    id: 'p3',
    title: '3/4 IN NPT Brass Elbow',
    brand: 'ACME',
    modelNumber: 'NPT-ELBOW-075'
  },
  {
    id: 'p4',
    title: 'Generic Bluetooth Keyboard',
    brand: 'KeyboardCo',
    modelNumber: 'KB-100'
  },
  {
    id: 'p5',
    title: 'Bluetooth Keyboard KB100',
    brand: 'Keyboard Co.',
    modelNumber: 'KB100'
  }
];

assert.deepStrictEqual(
  plain(M.extractIdentifiers(products[0])),
  ['62042rs'],
  'part-number identifiers collapse separators'
);

assert.ok(M.scorePair(products[0], products[1]).score >= 0.8,
  'same part number with reordered words scores as duplicate candidate');
assert.ok(M.scorePair(products[0], products[2]).score < 0.5,
  'different product type does not score as duplicate candidate');

const esciOnlyLeft = {
  id: 'B0KEYBOARD',
  title: 'Compact Mac Keyboard',
  brand: 'NorthStar',
  modelNumber: 'NS-100'
};
const esciOnlyRight = {
  id: 'B0KEYBRD02',
  title: 'Wireless Keyboard for Office',
  brand: 'DeskPro',
  modelNumber: 'DP-200'
};
const beforeEsci = M.scorePair(esciOnlyLeft, esciOnlyRight);
assert.strictEqual(beforeEsci.evidence.includes('ESCI substitute co-occurrence'), false,
  'ESCI evidence is absent until the generated substitute library is loaded');

M.loadEsciSubstitutes({
  substitutePairs: [
    { a: 'B0KEYBOARD', b: 'B0KEYBRD02', queryCount: 5 }
  ]
});
const afterEsci = M.scorePair(esciOnlyLeft, esciOnlyRight);
assert.strictEqual(
  Math.round((afterEsci.score - beforeEsci.score) * 100) / 100,
  0.1,
  'loaded ESCI substitute pairs add the documented 0.10 bonus'
);
assert.ok(afterEsci.evidence.includes('ESCI substitute co-occurrence'),
  'ESCI substitute evidence is surfaced for review');

const candidates = plain(M.detectDuplicateCandidates(products));
assert.deepStrictEqual(
  candidates.map(candidate => candidate.productIds),
  [['p1', 'p2'], ['p4', 'p5']],
  'detects duplicate candidate pairs without merging products'
);
assert.strictEqual(candidates[0].candidateKey, 'p1::p2',
  'candidate pairs expose a stable review key');
assert.strictEqual(candidates[0].reason, 'shared-identifier-and-token-match',
  'identifier-backed duplicate has explicit reason');
assert.strictEqual(candidates[1].reason, 'shared-identifier-and-token-match',
  'separator-normalized model duplicates have explicit reason');

assert.deepStrictEqual(
  products.map(product => product.id),
  ['p1', 'p2', 'p3', 'p4', 'p5'],
  'dedupe detection does not mutate or remove products'
);

const bigList = [];
for (let i = 0; i < 80; i++) {
  bigList.push({
    id: 'large-' + i,
    title: i < 2 ? `Canon Camera Model X100 ${i}` : `Unrelated Product ${i}`,
    brand: i < 2 ? 'Canon' : 'Brand' + i,
    modelNumber: i < 2 ? 'X100' : 'MODEL-' + i
  });
}
const largeCandidates = plain(M.detectDuplicateCandidates(bigList));
assert.deepStrictEqual(
  largeCandidates.map(candidate => candidate.productIds),
  [['large-0', 'large-1']],
  'blocking keys keep duplicate detection focused without losing real same-bucket candidates'
);
assert.ok(M.blockingKey(bigList[0]), 'matcher exposes blocking keys for large-list candidate bucketing');

console.log('dedupe-candidates.test.js: assertions passed');
