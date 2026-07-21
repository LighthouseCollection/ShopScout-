const assert = require('assert');
const { read } = require('./_helpers');

const themeCss = read('theme.css');
const comparisonCss = read('comparison.css');
const ribbonCss = read('ribbon/ribbon.css');
const gridCss = read('grid-rebuild-codex/grid.css');

assert.ok(/--text-secondary:\s*#2a3441/.test(themeCss),
  'theme exposes a high-contrast secondary text token');
assert.ok(/--text-tertiary:\s*#3f4a57/.test(themeCss),
  'theme exposes a WCAG-safe tertiary text token');
assert.ok(/--font-size-secondary:\s*13px/.test(themeCss),
  'theme exposes a minimum readable secondary text size');
assert.ok(/--font-size-hint:\s*12px/.test(themeCss),
  'theme exposes a minimum readable hint text size');

assert.ok(/--button-hover-bg:\s*#e1e8ef/.test(themeCss),
  'theme exposes a visible neutral button hover background');
assert.ok(/--button-active-bg:\s*#cfdae5/.test(themeCss),
  'theme exposes a visible neutral button active background');
assert.ok(/--button-selected-bg:\s*#d9eaf4/.test(themeCss),
  'theme exposes a visible selected button background');

assert.ok(/\.dashboard-secondary-action:hover[\s\S]{0,120}var\(--button-hover-bg\)/.test(comparisonCss),
  'dashboard secondary buttons use the shared hover token');
assert.ok(/\.dashboard-secondary-action:active[\s\S]{0,120}var\(--button-active-bg\)/.test(comparisonCss),
  'dashboard secondary buttons use the shared active token');
assert.ok(/--rbn-hover-bg:\s*var\(--button-hover-bg,\s*#e1e8ef\)/.test(ribbonCss),
  'ribbon buttons inherit the shared hover token');

for (const color of ['blue', 'green', 'red', 'amber', 'purple', 'teal', 'slate']) {
  const rule = new RegExp(`\\.ss-grid-value-pill\\[data-pill-color="${color}"\\][\\s\\S]{0,180}color:\\s*hsl\\([^)]*\\)`);
  assert.ok(rule.test(gridCss), `pill palette ${color} declares an explicit dark text color`);
}

const valuePillRule = gridCss.match(/\.ss-grid-value-pill\s*\{[\s\S]*?\}/);
assert.ok(valuePillRule, 'shared grid pill rule exists');
assert.ok(/font-weight:\s*600/.test(valuePillRule[0]),
  'shared grid pills use a consistent readable font weight');

console.log('design-token-baseline.test.js: all assertions passed');
