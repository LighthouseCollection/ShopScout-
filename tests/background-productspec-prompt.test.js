const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');

assert.ok(
  source.includes('function backgroundSpecEntries'),
  'background prompt builder owns a ProductSpec-aware spec entry helper'
);
assert.ok(
  source.includes('ShopScoutProductSpecAccess'),
  'background prompt builder reads specs through ProductSpec access when available'
);
assert.ok(
  !source.includes('detailed && p.rawSpecs?.length'),
  'background detailed prompt formatting does not read rawSpecs directly'
);

console.log('background-productspec-prompt tests passed');
