const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.join(__dirname, '..', '..');

function createAdapterHarness() {
  let gridOptions = null;
  const container = {
    classList: { add() {}, toggle() {} },
    style: {},
    addEventListener() {},
    closest() { return { clientWidth: 1000, style: {} }; },
    querySelectorAll() { return []; }
  };
  const ctx = {
    console,
    globalThis: null,
    location: { href: 'https://example.test/' },
    document: {
      createElement(tag) {
        return {
          tagName: String(tag).toUpperCase(),
          className: '',
          style: {},
          children: [],
          appendChild(child) { this.children.push(child); return child; },
          setAttribute() {},
          querySelectorAll() { return []; }
        };
      }
    },
    agGrid: {
      createGrid(_container, options) {
        gridOptions = options;
        return {
          setGridOption() {},
          getColumnState() { return []; },
          autoSizeAllColumns() {},
          applyColumnState() {}
        };
      }
    },
    SS: {
      esc(value) {
        return String(value ?? '')
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      },
      escAttr(value) { return this.esc(value); },
      sanitizeUrl(value) { return String(value || '').startsWith('http') ? String(value) : ''; }
    }
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(rootDir, 'grid-rebuild-codex/agGridAdapter.js'), 'utf8'), ctx, { filename: 'agGridAdapter.js' });
  return {
    ctx,
    container,
    create(projection, options) {
      ctx.ShopScoutAgGridAdapter.create(container, projection, options || {});
      return gridOptions;
    }
  };
}

{
  const harness = createAdapterHarness();
  const options = harness.create({
    mode: 'productsRows',
    columns: [{ id: 'newPrice', field: 'newPrice', name: 'Price', type: 'price' }],
    rows: [{ id: 'p1', newPrice: '$19.49' }]
  }, { viewState: { priceDisplayMode: 'rounded' } });
  const html = options.columnDefs[0].cellRenderer({ value: '$19.49', data: { id: 'p1' }, colDef: options.columnDefs[0], context: options.context });
  assert.ok(html.includes('$19'), 'rounded price mode drops cents');
  assert.ok(html.includes('title="$19.49"'), 'rounded price keeps exact value in the tooltip');
}

{
  const harness = createAdapterHarness();
  const options = harness.create({
    mode: 'productsRows',
    columns: [{ id: 'newPrice', field: 'newPrice', name: 'Price', type: 'price' }],
    rows: [{ id: 'p1', newPrice: '$19.49' }]
  }, { viewState: { priceDisplayMode: 'actual' } });
  const html = options.columnDefs[0].cellRenderer({ value: '$19.49', data: { id: 'p1' }, colDef: options.columnDefs[0], context: options.context });
  assert.ok(html.includes('$19.49'), 'actual price mode preserves cents');
}

{
  const harness = createAdapterHarness();
  const options = harness.create({
    mode: 'productsRows',
    columns: [{ id: 'spec:dimensions', field: 'spec:dimensions', name: 'Dimensions', type: 'spec' }],
    rows: [{ id: 'p1', 'spec:dimensions': '2.8"L x 2.4"W x 6.8"H' }]
  }, { viewState: { measurementDisplayMode: 'rounded' } });
  const html = options.columnDefs[0].cellRenderer({
    value: '2.8"L x 2.4"W x 6.8"H',
    data: { id: 'p1' },
    colDef: options.columnDefs[0],
    context: options.context
  });
  assert.ok(html.includes('3.0&quot;L x 2.5&quot;W x 7.0&quot;H'),
    'rounded measurement mode rounds inch dimensions to nearest half step');
  assert.ok(html.includes('title="2.8&quot;L x 2.4&quot;W x 6.8&quot;H"'),
    'rounded measurement keeps exact dimensions in the tooltip');
}

console.log('adapter-display.test.js: all assertions passed');
