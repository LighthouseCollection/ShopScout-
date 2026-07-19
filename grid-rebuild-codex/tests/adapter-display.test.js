const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.join(__dirname, '..', '..');

function createAdapterHarness() {
  let gridOptions = null;
  const nativeFilterCalls = [];
  const nativeMenuCalls = [];
  let clearedNativeFilters = 0;
  let nativeFilterChanged = 0;
  const listeners = {};
  const container = {
    classList: { add() {}, toggle() {} },
    style: {},
    addEventListener(type, handler) { listeners[type] = handler; },
    removeEventListener(type, handler) {
      if (listeners[type] === handler) delete listeners[type];
    },
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
          applyColumnState() {},
          showColumnFilter(field) { nativeFilterCalls.push(field); },
          showColumnMenu(field) { nativeMenuCalls.push(field); },
          setFilterModel(model) {
            if (model == null) clearedNativeFilters += 1;
          },
          onFilterChanged() { nativeFilterChanged += 1; }
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
      const instance = ctx.ShopScoutAgGridAdapter.create(container, projection, options || {});
      return { gridOptions, instance };
    },
    dispatchContainerClick(target) {
      const event = {
        target,
        defaultPrevented: false,
        stopped: false,
        immediateStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.stopped = true; },
        stopImmediatePropagation() { this.immediateStopped = true; this.stopped = true; }
      };
      if (listeners.click) listeners.click(event);
      return event;
    },
    nativeFilterCalls,
    nativeMenuCalls,
    getClearedNativeFilters: () => clearedNativeFilters,
    getNativeFilterChanged: () => nativeFilterChanged
  };
}

{
  const harness = createAdapterHarness();
  const { gridOptions: options } = harness.create({
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
  const { gridOptions: options } = harness.create({
    mode: 'productsRows',
    columns: [{ id: 'newPrice', field: 'newPrice', name: 'Price', type: 'price' }],
    rows: [{ id: 'p1', newPrice: '$19.49' }]
  }, { viewState: { priceDisplayMode: 'actual' } });
  const html = options.columnDefs[0].cellRenderer({ value: '$19.49', data: { id: 'p1' }, colDef: options.columnDefs[0], context: options.context });
  assert.ok(html.includes('$19.49'), 'actual price mode preserves cents');
}

{
  const harness = createAdapterHarness();
  const { gridOptions: options } = harness.create({
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

{
  const harness = createAdapterHarness();
  const { instance } = harness.create({
    mode: 'productsRows',
    columns: [
      { id: 'select', field: '_selected', name: '', type: 'selection' },
      { id: 'brand', field: 'brand', name: 'Brand', type: 'text' },
      { id: 'source', field: 'source', name: 'Source', type: 'source' }
    ],
    rows: [{ id: 'p1', brand: 'Qnap', source: 'Amazon' }]
  });
  assert.equal(typeof instance.openNativeFilter, 'function',
    'adapter exposes a native filter launcher for ribbon commands');
  assert.equal(typeof instance.openNativeColumnMenu, 'function',
    'adapter exposes a native column menu launcher for ribbon commands');
  assert.equal(instance.openNativeColumnMenu('source'), true,
    'native column menu launcher succeeds for a filterable column');
  assert.deepEqual(harness.nativeMenuCalls, ['source'],
    'native column menu launcher delegates to AG Grid showColumnMenu');
  assert.equal(instance.openNativeFilter('source'), true,
    'native filter launcher succeeds for a filterable column');
  assert.deepEqual(harness.nativeFilterCalls, ['source'],
    'native filter launcher delegates to AG Grid showColumnFilter');
  assert.equal(instance.clearNativeFilters(), true,
    'adapter exposes a native filter clearer for ribbon reset commands');
  assert.equal(harness.getClearedNativeFilters(), 1,
    'native filter clearer delegates to AG Grid setFilterModel(null)');
  assert.equal(harness.getNativeFilterChanged(), 1,
    'native filter clearer notifies AG Grid after clearing the model');
}

{
  const harness = createAdapterHarness();
  let openedField = '';
  harness.create({
    mode: 'productsRows',
    columns: [
      { id: 'brand', field: 'brand', name: 'Brand', type: 'text' },
      { id: 'source', field: 'source', name: 'Source', type: 'source' }
    ],
    rows: [{ id: 'p1', brand: 'Qnap', source: 'Amazon' }]
  }, {
    onOpenFiltersModal(field) { openedField = field; }
  });
  const headerCell = {
    getAttribute(name) {
      return name === 'col-id' ? 'brand' : '';
    }
  };
  const filterButton = {
    closest(selector) {
      return String(selector).includes('.ag-header-cell') ? headerCell : null;
    }
  };
  const target = {
    closest(selector) {
      return String(selector).includes('.ag-header-cell-filter-button') ? filterButton : null;
    }
  };
  const event = harness.dispatchContainerClick(target);
  assert.equal(openedField, 'brand',
    'AG Grid header filter icon delegates to the ShopScout filter modal callback for that column');
  assert.equal(event.defaultPrevented, true,
    'ShopScout filter modal routing prevents the native header icon action');
  assert.equal(event.immediateStopped, true,
    'ShopScout filter modal routing stops AG Grid from also opening its native popup');
}

console.log('adapter-display.test.js: all assertions passed');
