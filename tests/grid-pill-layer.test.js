const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const adapter = fs.readFileSync(path.join(root, 'grid-rebuild-codex', 'agGridAdapter.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'grid-rebuild-codex', 'grid.css'), 'utf8');

assert.ok(
  /const\s+PILL_ROW_LIMIT\s*=\s*3/.test(adapter),
  'AG Grid adapter pins pill overflow to a three-row contract'
);
assert.ok(
  /getRowHeight\s*\(/.test(adapter),
  'AG Grid adapter uses getRowHeight for pill-row-safe height instead of relying on autoHeight cells'
);
assert.ok(
  /resetRowHeights/.test(adapter),
  'AG Grid adapter recomputes row heights after layout-sensitive events'
);
assert.ok(
  /onColumnResized\(\)/.test(adapter) && /syncPillOverflow/.test(adapter),
  'column resize path resynchronizes pill overflow'
);
assert.ok(
  /ResizeObserver/.test(adapter),
  'host resize path resynchronizes pill overflow'
);
assert.ok(
  /document\?\.fonts\?\.ready/.test(adapter),
  'font-ready path resynchronizes pill overflow'
);
assert.ok(
  /data-pill-index/.test(adapter) && /data-pill-overflow-values/.test(adapter),
  'overflow modal keeps full pill values while hiding only overflowed visible pills'
);

assert.ok(
  /--ss-grid-pill-lines:\s*3;/.test(css),
  'pill CSS cap is three visible rows'
);
assert.ok(
  /--ss-grid-pill-gap:\s*4px;/.test(css),
  'pill CSS has explicit row gap for max-height math'
);
assert.ok(
  /font-family:\s*var\(--font-sans/.test(css),
  'pill typography is owned by one shared CSS rule'
);
assert.ok(
  /letter-spacing:\s*0;/.test(css),
  'pill typography keeps normal letter spacing'
);
assert.ok(
  /\[data-pill-hidden="true"\]/.test(css),
  'hidden overflow pills are removed from layout'
);

console.log('grid-pill-layer.test.js — all assertions passed');
