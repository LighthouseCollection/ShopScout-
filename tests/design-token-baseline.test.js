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
assert.ok(/--color-text-secondary:\s*#4a5568/.test(themeCss),
  'theme exposes the work-order secondary text color token');
assert.ok(/--color-text-tertiary:\s*#6b7280/.test(themeCss),
  'theme exposes the work-order tertiary text color token');
assert.ok(/--font-size-secondary:\s*13px/.test(themeCss),
  'theme exposes a minimum readable secondary text size');
assert.ok(/--font-weight-secondary:\s*400/.test(themeCss),
  'theme exposes a readable secondary text weight');
assert.ok(/--font-size-hint:\s*12px/.test(themeCss),
  'theme exposes a minimum readable hint text size');

assert.ok(/--btn-hover-bg:\s*#e1e8ef/.test(themeCss),
  'theme exposes the canonical button hover token');
assert.ok(/--btn-active-bg:\s*#cfdae5/.test(themeCss),
  'theme exposes the canonical button active token');
assert.ok(/--btn-selected-bg:\s*#d9eaf4/.test(themeCss),
  'theme exposes the canonical button selected token');
assert.ok(/--btn-hover-border:\s*#8faac1/.test(themeCss),
  'theme exposes the canonical button hover border token');
assert.ok(/--btn-active-border:\s*#6f8fa6/.test(themeCss),
  'theme exposes the canonical button active border token');
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
assert.ok(/--rbn-hover-border:\s*var\(--btn-hover-border,\s*#8faac1\)/.test(ribbonCss),
  'ribbon buttons inherit the shared hover border token');

for (const color of ['blue', 'green', 'red', 'amber', 'purple', 'teal', 'slate']) {
  const rule = new RegExp(`\\.ss-grid-value-pill\\[data-pill-color="${color}"\\][\\s\\S]{0,180}color:\\s*hsl\\([^)]*\\)`);
  assert.ok(rule.test(gridCss), `pill palette ${color} declares an explicit dark text color`);
}

const valuePillRule = gridCss.match(/\.ss-grid-value-pill\s*\{[\s\S]*?\}/);
assert.ok(valuePillRule, 'shared grid pill rule exists');
assert.ok(/font-weight:\s*600/.test(valuePillRule[0]),
  'shared grid pills use a consistent readable font weight');

assert.ok(/prefers-contrast:\s*more/.test(gridCss),
  'grid pills expose a high-contrast media override');

function parseHsl(color) {
  const m = String(color || '').match(/^hsl\(([-\d.]+)\s+([-\d.]+)%\s+([-\d.]+)%\)$/);
  if (!m) throw new Error(`Unsupported HSL color: ${color}`);
  let h = Number(m[1]) % 360;
  if (h < 0) h += 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m0 = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m0, g + m0, b + m0].map(v => Math.round(v * 255));
}

function luminance([r, g, b]) {
  return [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const vm = require('vm');
const cellValuesJs = read('shared/values/cellValues.js');
const ctx = { console, globalThis: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(cellValuesJs, ctx, { filename: 'shared/values/cellValues.js' });
for (const field of ['Category', 'Type', 'Power Source', 'Connectivity Technology', 'Compatible Devices']) {
  const style = ctx.ShopScoutValues.pillFieldStyle(field);
  assert.ok(style, `${field} produces a pill style`);
  assert.ok(contrast(parseHsl(style.bg), parseHsl(style.fg)) >= 4.5,
    `${field} pill foreground meets WCAG AA contrast`);
}

console.log('design-token-baseline.test.js: all assertions passed');
