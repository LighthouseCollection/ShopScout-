const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const utilsPath = path.join(__dirname, '..', 'utils.js');
const productSpecAccessPath = path.join(__dirname, '..', 'shared', 'productSpecAccess.js');
const source = fs.readFileSync(utilsPath, 'utf8');
const productSpecAccessSource = fs.readFileSync(productSpecAccessPath, 'utf8');

const context = {
  window: {},
  location: { href: 'https://example.com/product' },
  URL,
  document: {},
  Blob,
  setTimeout,
  clearTimeout,
  requestAnimationFrame: (fn) => fn(),
};

vm.createContext(context);
vm.runInContext(productSpecAccessSource, context, { filename: productSpecAccessPath });
vm.runInContext(source, context, { filename: utilsPath });

const SS = context.window.SS;

assert.strictEqual(
  SS.escAttr('" onerror="alert(1)" <x>'),
  '&quot; onerror=&quot;alert(1)&quot; &lt;x&gt;',
  'escAttr escapes quotes and markup for attribute contexts'
);

assert.strictEqual(
  SS.sanitizeUrl('javascript:alert(1)'),
  '',
  'sanitizeUrl rejects javascript URLs'
);

assert.strictEqual(
  SS.sanitizeUrl('https://shop.example/item?q=1'),
  'https://shop.example/item?q=1',
  'sanitizeUrl preserves http(s) URLs'
);

const junkDescription = SS.sanitizeProductDescription(
  'Product description Swim Suits for Women 2025 KEEP IN FASHION Previous page Next page More Swimsuit From Aidonger Previous page Tankini Push Up Wrap Click Here Lace Up Cut Out Swimsuit Click Here Tummy Control Front Cross Bathing Suit Click Here Next page',
  'Amazon'
);
assert.strictEqual(
  junkDescription,
  '',
  'sanitizeProductDescription drops Amazon carousel/navigation marketing text'
);

assert.strictEqual(
  SS.sanitizeProductDescription('Soft ribbed swimsuit with removable pads and adjustable straps.', 'Amazon'),
  'Soft ribbed swimsuit with removable pads and adjustable straps.',
  'sanitizeProductDescription keeps real product prose'
);

assert.strictEqual(
  SS.normalizeReviewCount('(22)'),
  '22',
  'normalizeReviewCount removes existing parentheses'
);

assert.strictEqual(
  SS.normalizeReviewCount('1,342 ratings'),
  '1,342',
  'normalizeReviewCount preserves comma-separated counts and removes rating words'
);

assert.strictEqual(
  SS.formatRatingDisplay('4.8', '(23)'),
  '4.8 (23)',
  'formatRatingDisplay avoids double parentheses around review counts'
);

const swimwearComparisonKeys = SS.getCategoryComparisonSpecKeys([
  {
    title: 'Women One Piece Swimsuit Tummy Control Ruffle Bathing Suit',
    category: 'Clothing, Shoes & Jewelry > Women > Clothing > Swimsuits & Cover Ups > One-Pieces',
    rawSpecs: [
      { key: 'Material', value: '82% Nylon, 18% Spandex' },
      { key: 'Care instructions', value: 'Hand Wash Only' },
      { key: 'Closure Type', value: 'Pull On' },
      { key: 'Top Style', value: 'One Piece' },
      { key: 'Dimensions', value: '8 x 6 x 1 inches' },
      { key: 'Manufacturer Part Number', value: 'AID-123' }
    ]
  }
]);
assert.deepStrictEqual(
  Array.from(swimwearComparisonKeys),
  ['Material', 'Care instructions', 'Closure Type', 'Top Style'],
  'category comparison keys keep the most useful swimwear specs and skip identifier/noise columns'
);

assert.deepStrictEqual(
  SS.normalizeSpecKeyLabel('Dots per inch'),
  SS.normalizeSpecKeyLabel('DPI'),
  'normalizeSpecKeyLabel treats DPI and Dots per inch as the same comparison spec'
);

assert.strictEqual(
  SS.normalizeSpecValue('12 Volts'),
  SS.normalizeSpecValue('12v'),
  'normalizeSpecValue treats 12v and 12 Volts as the same normalized value'
);

const normalizedSpecs = SS.normalizeProductSpecs({
  rawSpecs: [
    { key: 'DPI', value: '1200 dots per inch' },
    { key: 'Dots per inch', value: '1200 DPI' },
    { key: 'Input Voltage', value: '12Volts' }
  ]
});
assert.strictEqual(
  JSON.stringify(normalizedSpecs.map(spec => [spec.key, spec.value])),
  JSON.stringify([['DPI', '1200 DPI'], ['Input voltage', '12 V']]),
  'normalizeProductSpecs merges duplicate spec labels and normalizes simple units'
);

const productSpecNormalizedSpecs = SS.normalizeProductSpecs({
  rawSpecs: [{ key: 'Colour', value: 'midnight blue' }],
  specsNormalized: {
    Colour: {
      raw: 'midnight blue',
      canonical: 'Navy Blue',
      display: 'Navy Blue',
      provenance: { confidence: 0.95, rules: ['enum:color:navy-blue'] }
    }
  },
  _spec: {
    itemDetails: {
      Material: {
        rawKey: 'Material',
        rawValue: 'SS304',
        value: 'Stainless Steel 304',
        confidence: 0.9,
        source: 'manufacturer'
      }
    }
  }
});
assert.strictEqual(
  JSON.stringify(productSpecNormalizedSpecs.map(spec => [spec.key, spec.value])),
  JSON.stringify([['Colour', 'Navy Blue'], ['Material', 'Stainless Steel 304']]),
  'normalizeProductSpecs uses ProductSpec access helpers for normalized displays and ProductSpec-only fields'
);

const productSpecOnlyProduct = {
  title: 'Steel Bottle',
  brand: 'Acme',
  newPrice: '$12.99',
  url: 'https://example.com/steel-bottle',
  _spec: {
    itemDetails: {
      Material: {
        rawKey: 'Material',
        rawValue: 'SS304',
        value: 'Stainless Steel 304',
        source: 'manufacturer',
        confidence: 0.9
      }
    }
  }
};
assert.ok(
  SS.getCategoryComparisonSpecKeys([productSpecOnlyProduct], 4).includes('Material'),
  'getCategoryComparisonSpecKeys reads ProductSpec-only fields'
);

const productSpecDeepPrompt = SS.buildPrompt([productSpecOnlyProduct], 'verify');
assert.ok(
  productSpecDeepPrompt.includes('Material: Stainless Steel 304'),
  'detailed AI prompts include ProductSpec-only specification fields'
);

const formulaField = SS.escapeCsvField('=IMPORTXML("https://example.com")');
assert.ok(
  formulaField.startsWith('"\'=IMPORTXML('),
  'escapeCsvField prefixes spreadsheet formulas before CSV quoting'
);

const csv = SS.buildCsv([{ title: '=cmd', url: '+http://bad.example' }]);
assert.ok(csv.includes("'=cmd"), 'buildCsv hardens formula-like titles');
assert.ok(csv.includes("'+http://bad.example"), 'buildCsv hardens formula-like URLs');

const identity = SS.buildProductIdentity({
  title: 'Pocket Camera 5K with Face Detection Automatic Rotating Lens, Vlogging Camera Body Cam with Rotatable Touch Screen, External Mic, Remote Control, 64GB Card',
  brand: 'YONDENE',
  modelName: '1080 Fire Helmet Camera FC1080',
  modelNumber: 'MZXJ-1088'
});
assert.strictEqual(
  identity.productName,
  'YONDENE | 1080 Fire Helmet Camera FC1080 | MZXJ-1088',
  'buildProductIdentity formats Brand | model name | model number'
);
assert.strictEqual(
  identity.listingTitle,
  'Pocket Camera 5K with Face Detection Automatic Rotating Lens, Vlogging Camera Body Cam with Rotatable Touch Screen, External Mic, Remote Control, 64GB Card',
  'buildProductIdentity keeps the marketplace listing title separately'
);
assert.strictEqual(identity.productNameConfidence, 'high', 'structured identity has high confidence');

const oneProductVerifyPrompt = SS.buildPrompt([
  { title: 'YONDENE | 1080 Fire Helmet Camera FC1080 | MZXJ-1088', listingTitle: 'Pocket Camera 5K with Face Detection Automatic Rotating Lens', brand: 'YONDENE', modelName: '1080 Fire Helmet Camera FC1080', modelNumber: 'MZXJ-1088' }
], 'verify');
assert.ok(
  oneProductVerifyPrompt.includes('Product verification report'),
  'one-product verify prompts request a focused verification report'
);
assert.ok(
  oneProductVerifyPrompt.includes('Brand | Model Name | Model Number'),
  'prompts enforce structured product identity display'
);

const twoProductDeepPrompt = SS.buildPrompt([
  { title: 'Camera A', brand: 'BrandA', modelName: 'Alpha', modelNumber: 'A1', newPrice: '$100' },
  { title: 'Camera B', brand: 'BrandB', modelName: 'Beta', modelNumber: 'B1', newPrice: '$120' }
], 'deep');
assert.ok(
  twoProductDeepPrompt.includes('Detailed side-by-side comparison'),
  'two-product deep prompts request side-by-side output'
);
assert.ok(
  twoProductDeepPrompt.includes('"quick_verdict"'),
  'deep prompts request structured JSON output for app rendering'
);
assert.ok(
  twoProductDeepPrompt.includes('Decision Layer'),
  'deep prompts separate analysis and presentation layers'
);

const sevenProductDeepPrompt = SS.buildPrompt(Array.from({ length: 7 }, (_, i) => ({
  title: `Swimwear Product ${i + 1}`,
  brand: `Brand${i + 1}`,
  newPrice: `$${20 + i}`
})), 'deep');
assert.ok(
  sevenProductDeepPrompt.includes('Dashboard + grouped rankings + compact matrix'),
  'many-product deep prompts request dashboard output'
);
assert.ok(
  sevenProductDeepPrompt.includes('move detailed product notes to an appendix'),
  'many-product deep prompts move long per-product notes to appendix'
);
assert.ok(
  sevenProductDeepPrompt.includes('Do not force one overall winner across products that are not directly comparable'),
  'many-product prompts require grouping before ranking'
);

console.log('utils tests passed');
