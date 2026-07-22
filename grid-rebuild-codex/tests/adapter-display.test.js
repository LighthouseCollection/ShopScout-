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
        const selected = new Set((options.rowData || []).filter(row => row._selected).map(row => String(row.id ?? row._id)));
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
          onFilterChanged() { nativeFilterChanged += 1; },
          forEachNode(callback) {
            (options.rowData || []).forEach(row => callback({
              data: row,
              setSelected(value) {
                if (value) selected.add(String(row.id ?? row._id));
                else selected.delete(String(row.id ?? row._id));
              }
            }));
          },
          getSelectedRows() {
            return (options.rowData || []).filter(row => selected.has(String(row.id ?? row._id)));
          }
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
  vm.runInContext(fs.readFileSync(path.join(rootDir, 'shared/values/cellValues.js'), 'utf8'), ctx, { filename: 'cellValues.js' });
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

function createAdapterHarnessWithThrowingColumnMenu() {
  const harness = createAdapterHarness();
  harness.ctx.agGrid.createGrid = function createGrid(_container, options) {
    let nativeFilterCalls = harness.nativeFilterCalls;
    return {
      setGridOption() {},
      getColumnState() { return []; },
      autoSizeAllColumns() {},
      applyColumnState() {},
      showColumnFilter(field) { nativeFilterCalls.push(field); },
      showColumnMenu() { throw new Error('ColumnMenu module is not registered'); },
      setFilterModel() {},
      onFilterChanged() {}
    };
  };
  return harness;
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
    rows: [{ id: 'p1', newPrice: '$12' }, { id: 'p2', newPrice: '$14' }]
  }, { viewState: { priceDisplayMode: 'nearest5' } });
  const twelve = options.columnDefs[0].cellRenderer({ value: '$12', data: { id: 'p1' }, colDef: options.columnDefs[0], context: options.context });
  const fourteen = options.columnDefs[0].cellRenderer({ value: '$14', data: { id: 'p2' }, colDef: options.columnDefs[0], context: options.context });
  assert.ok(twelve.includes('$10'), 'nearest-5 price mode rounds $12 down to $10');
  assert.ok(fourteen.includes('$15'), 'nearest-5 price mode rounds $14 up to $15');
  assert.ok(twelve.includes('title="$12"'), 'nearest-5 price keeps exact value in the tooltip');
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
    columns: [
      { id: 'title', field: 'title', name: 'Name', type: 'title' },
      { id: 'brand', field: 'brand', name: 'Brand', type: 'text', pinned: true },
      { id: 'source', field: 'source', name: 'Source', type: 'source' }
    ],
    rows: [
      { id: 'p1', title: 'Pinned', brand: 'Qnap', source: 'Amazon' },
      { id: 'p2', title: 'Regular', brand: 'Synology', source: 'Newegg' }
    ]
  }, { viewState: { pinnedTopProductIds: ['p1'] } });
  const brandDef = options.columnDefs.find(col => col.colId === 'brand');
  assert.equal(brandDef.pinned, 'left', 'user-pinned columns map to AG Grid pinned left column defs');
  assert.deepEqual(options.pinnedTopRowData.map(row => row.id), ['p1'],
    'pinned top product ids map to AG Grid pinnedTopRowData');
  assert.deepEqual(options.rowData.map(row => row.id), ['p2'],
    'pinned top rows are removed from normal rowData to avoid duplicate visible rows');
}

{
  const compatibleDevices = 'iPhone 17 Pro Max/17 Pro/Air/17/16 Pro Max/16 Pro/16 Plus/16, Mac Mini M4/M4 Pro, MacBook Pro M4/M4 Pro/M4 Max, MacBook Air 2024, Galaxy S26/S25/S24 Ultra, iPad Pro 2024, iPad Air 2024, XPS 17/15/13, Dell, HP Chromebook x360, Surface Book 3/2, Samsung Tablet';
  const harness = createAdapterHarness();
  const { gridOptions: options } = harness.create({
    mode: 'productsRows',
    columns: [{ id: 'spec:compatible devices', field: 'spec:compatible devices', name: 'Compatible Devices', type: 'spec' }],
    rows: [{ id: 'p1', 'spec:compatible devices': compatibleDevices }]
  });
  const html = options.columnDefs[0].cellRenderer({
    value: compatibleDevices,
    data: { id: 'p1' },
    colDef: options.columnDefs[0],
    context: options.context
  });
  const pillCount = (html.match(/ss-grid-value-pill/g) || []).length;
  assert.ok(pillCount >= 12, 'long comma-separated tech specs preserve every pill value for measured overflow');
  assert.ok(html.includes('MacBook Air 2024'), 'tech spec renderer includes individual comma-separated values');
  assert.ok(html.includes('ss-grid-pill-overflow'), 'long pill lists expose an overflow affordance');
  assert.ok(html.includes('data-pill-index='), 'pill values are index-marked so measured overflow can hide only complete rows');
  assert.ok(html.includes('Samsung Tablet</span>'), 'overflowed values stay in the DOM for the full-list modal');
}

{
  const manyValues = 'USB-C, USB-A, Bluetooth, Wi-Fi, HDMI, DisplayPort, Thunderbolt, Ethernet, NFC, Zigbee, Matter, Thread, Infrared, RF';
  const harness = createAdapterHarness();
  const { gridOptions: options } = harness.create({
    mode: 'productsRows',
    columns: [{ id: 'spec:connectivity', field: 'spec:connectivity', name: 'Connectivity', type: 'spec' }],
    rows: [{ id: 'p1', 'spec:connectivity': manyValues }]
  });
  const html = options.columnDefs[0].cellRenderer({
    value: manyValues,
    data: { id: 'p1' },
    colDef: options.columnDefs[0],
    context: options.context
  });
  assert.ok(html.includes('data-pill-overflow-values='),
    'overflow affordance keeps the full escaped pill list for the modal');
  assert.ok(html.includes('USB-C') && html.includes('HDMI'),
    'visible pill cap keeps representative values before the overflow marker');
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
  const { gridOptions: options } = harness.create({
    mode: 'productsRows',
    columns: [{ id: 'spec:maximum pressure', field: 'spec:maximum pressure', name: 'Maximum Pressure', type: 'spec' }],
    rows: [{
      id: 'p1',
      'spec:maximum pressure': '150 PSI',
      _manualAiCorrections: [{
        field: 'Maximum Pressure',
        currentValue: '2,176 PSI',
        recommendedValue: '150 PSI'
      }]
    }]
  });
  const html = options.columnDefs[0].cellRenderer({
    value: '150 PSI',
    data: options.rowData[0],
    colDef: options.columnDefs[0],
    context: options.context
  });
  assert.ok(html.includes('ss-grid-manual-corrected'), 'manual AI corrected cells get a glow class');
  assert.ok(html.includes('Corrected from &quot;2,176 PSI&quot; to &quot;150 PSI&quot;'), 'manual AI corrected cells explain the original and corrected value in a tooltip');
}

{
  const harness = createAdapterHarness();
  const { gridOptions: options } = harness.create({
    mode: 'productsRows',
    columns: [{ id: 'title', field: 'title', name: 'Name', type: 'text' }],
    rows: [{ id: 'p1', title: 'Buy', _manualAiVerdictTone: 'recommended' }, { id: 'p2', title: 'Avoid', _manualAiVerdictTone: 'avoid' }]
  });
  assert.equal(options.getRowClass({ data: options.rowData[0] }), 'ss-grid-row-ai-recommended',
    'recommended pasted AI verdict maps to a green row class');
  assert.equal(options.getRowClass({ data: options.rowData[1] }), 'ss-grid-row-ai-avoid',
    'avoid pasted AI verdict maps to a red row class');
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
  const harness = createAdapterHarnessWithThrowingColumnMenu();
  const { instance } = harness.create({
    mode: 'productsRows',
    columns: [
      { id: 'brand', field: 'brand', name: 'Brand', type: 'text' },
      { id: 'source', field: 'source', name: 'Source', type: 'source' }
    ],
    rows: [{ id: 'p1', brand: 'Qnap', source: 'Amazon' }]
  });
  assert.equal(instance.openNativeColumnMenu('source'), true,
    'native column menu launcher falls back to the column filter when ColumnMenu is unavailable');
  assert.deepEqual(harness.nativeFilterCalls, ['source'],
    'ColumnMenu failure falls back to AG Grid showColumnFilter');
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

{
  const harness = createAdapterHarness();
  let toggled = null;
  const { gridOptions: options } = harness.create({
    mode: 'productsRows',
    grouping: { field: 'source', label: 'Source' },
    columns: [
      { id: 'title', field: 'title', name: 'Name', type: 'text' },
      { id: 'source', field: 'source', name: 'Source', type: 'source' }
    ],
    rows: [
      { id: 'p1', title: 'One', source: 'Amazon' },
      { id: 'p2', title: 'Two', source: 'Amazon' },
      { id: 'p3', title: 'Three', source: 'Newegg' }
    ]
  }, {
    viewState: { group: 'source', collapsedGroups: [] },
    onGroupToggle(key) { toggled = key; }
  });
  assert.equal(options.rowGroupPanelShow, undefined,
    'Community adapter does not enable Enterprise RowGroupingPanel');
  assert.equal(options.groupDisplayType, undefined,
    'Community adapter does not enable Enterprise row grouping display modes');
  assert.equal(typeof options.isFullWidthRow, 'function',
    'Community grouping uses AG Grid full-width rows');
  assert.equal(typeof options.fullWidthCellRenderer, 'function',
    'Community grouping renders group rows through AG Grid full-width renderer');
  assert.deepEqual(options.rowData.map(row => row._ssGridRowKind || row.id), ['group', 'p1', 'p2', 'group', 'p3'],
    'grouped rowData includes AG Grid full-width group rows before each product group');
  const groupHtml = options.fullWidthCellRenderer({ data: options.rowData[0] });
  assert.ok(groupHtml.includes('Group'), 'group renderer includes an explicit Group label');
  assert.ok(groupHtml.includes('Source: Amazon'), 'group renderer names the grouped field and value');
  assert.ok(groupHtml.includes('(2)'), 'group renderer includes the product count');
  const groupButton = {
    dataset: { ssGridGroupToggle: options.rowData[0].id },
    closest(selector) {
      return String(selector).includes('[data-ss-grid-group-toggle]') ? this : null;
    }
  };
  const event = harness.dispatchContainerClick(groupButton);
  assert.equal(toggled, options.rowData[0].id,
    'clicking a group row toggle delegates through onGroupToggle');
  assert.equal(event.immediateStopped, true,
    'group toggle stops AG Grid from also selecting the row');
}

{
  const harness = createAdapterHarness();
  const { gridOptions: options } = harness.create({
    mode: 'productsRows',
    grouping: { field: 'source', label: 'Source' },
    columns: [
      { id: 'title', field: 'title', name: 'Name', type: 'text' },
      { id: 'source', field: 'source', name: 'Source', type: 'source' }
    ],
    rows: [
      { id: 'p1', title: 'One', source: 'Amazon' },
      { id: 'p2', title: 'Two', source: 'Amazon' },
      { id: 'p3', title: 'Three', source: 'Newegg' }
    ]
  }, {
    viewState: { group: 'source', collapsedGroups: ['group:source:Amazon'] }
  });
  assert.deepEqual(options.rowData.map(row => row._ssGridRowKind || row.id), ['group', 'group', 'p3'],
    'collapsed Community group rows hide their child products');
}

{
  const harness = createAdapterHarness();
  let selectedRows = null;
  const { gridOptions: options } = harness.create({
    mode: 'productsRows',
    columns: [
      { id: 'select', field: '_selected', name: '', type: 'selection' },
      { id: 'title', field: 'title', name: 'Name', type: 'text' }
    ],
    rows: [{ id: 'p1', title: 'One', _selected: true }, { id: 'p2', title: 'Two', _selected: false }]
  }, {
    onSelectionChange(rows) { selectedRows = rows; }
  });
  const selectColumn = options.columnDefs.find(column => column.colId === 'select');
  assert.equal(selectColumn.checkboxSelection, true,
    'selection column uses AG Grid native row checkboxes');
  assert.equal(selectColumn.headerCheckboxSelection, true,
    'selection column uses AG Grid native header check-all checkbox');
  assert.equal(selectColumn.cellRenderer, undefined,
    'selection column does not render the old custom checkbox cell');
  assert.equal(options.rowSelection, 'multiple',
    'native checkbox selection remains multi-select');
  options.onSelectionChanged({ api: options.api || {
    getSelectedRows() { return [{ id: 'p2', title: 'Two' }]; }
  } });
  assert.deepEqual(selectedRows, [{ id: 'p2', title: 'Two' }],
    'selection change callback still receives selected product rows');
}

{
  const harness = createAdapterHarness();
  let detailRow = null;
  const { gridOptions: options } = harness.create({
    mode: 'productsRows',
    columns: [{ id: 'title', field: 'title', name: 'Name', type: 'text' }],
    rows: [{ id: 'p1', title: 'Pocket Camera', _shopScout: { productId: 'p1' } }]
  }, {
    onProductDetail(row) { detailRow = row; }
  });
  const html = options.columnDefs[0].cellRenderer({
    value: 'Pocket Camera',
    data: options.rowData[0],
    colDef: options.columnDefs[0],
    context: options.context
  });
  assert.ok(html.includes('data-ss-grid-detail="p1"'),
    'product name cell renders an internal-detail trigger');
  assert.ok(html.includes('ss-grid-title-button'),
    'product name trigger uses the title button class, not a row-action button');
  const titleButton = {
    dataset: { ssGridDetail: 'p1' },
    closest(selector) {
      return String(selector).includes('[data-ss-grid-detail]') ? this : null;
    }
  };
  const event = harness.dispatchContainerClick(titleButton);
  assert.equal(event.defaultPrevented, true,
    'product detail trigger prevents default grid click handling');
  assert.equal(detailRow.id, 'p1',
    'product detail trigger passes the matching grid row');
}

console.log('adapter-display.test.js: all assertions passed');
