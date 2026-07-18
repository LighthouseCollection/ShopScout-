const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.join(__dirname, '..', '..');

function makeElementFactory() {
  let documentRef = null;

  function makeClassList(el) {
    return {
      add(...names) {
        const current = new Set(String(el.className || '').split(/\s+/).filter(Boolean));
        names.flat().filter(Boolean).forEach(name => current.add(String(name)));
        el.className = [...current].join(' ');
      },
      remove(...names) {
        const remove = new Set(names.flat().filter(Boolean).map(String));
        el.className = String(el.className || '').split(/\s+/).filter(name => !remove.has(name)).join(' ');
      },
      toggle(name, force) {
        const current = new Set(String(el.className || '').split(/\s+/).filter(Boolean));
        const shouldAdd = force == null ? !current.has(name) : !!force;
        if (shouldAdd) current.add(name);
        else current.delete(name);
        el.className = [...current].join(' ');
        return shouldAdd;
      },
      contains(name) {
        return String(el.className || '').split(/\s+/).includes(name);
      }
    };
  }

  function makeElement(tag, id) {
    const el = {
      nodeType: 1,
      tagName: String(tag || 'div').toUpperCase(),
      id: id || '',
      className: '',
      textContent: '',
      value: '',
      checked: false,
      disabled: false,
      dataset: {},
      attrs: {},
      children: [],
      listeners: {},
      ownerDocument: documentRef,
      firstChild: null,
      classList: null,
      setAttribute(name, value) {
        this.attrs[name] = String(value ?? '');
        if (name === 'value') this.value = String(value ?? '');
        if (name === 'type') this.type = String(value ?? '');
        if (name.startsWith('data-')) {
          const key = name.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
          this.dataset[key] = String(value ?? '');
        }
      },
      appendChild(child) {
        if (!child) return child;
        this.children.push(child);
        this.firstChild = this.children[0] || null;
        child.parentNode = this;
        return child;
      },
      removeChild(child) {
        this.children = this.children.filter(item => item !== child);
        this.firstChild = this.children[0] || null;
        return child;
      },
      replaceChildren(...children) {
        this.children = [];
        this.firstChild = null;
        children.forEach(child => this.appendChild(child));
      },
      addEventListener(type, handler) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(handler);
      },
      dispatch(type) {
        const event = { target: this, currentTarget: this, preventDefault() {}, stopPropagation() {} };
        return Promise.all((this.listeners[type] || []).map(handler => handler(event)));
      }
    };
    el.classList = makeClassList(el);
    return el;
  }

  const document = {
    elements: new Map(),
    created: [],
    listeners: {},
    createElement(tag) {
      const el = makeElement(tag);
      el.ownerDocument = document;
      this.created.push(el);
      return el;
    },
    createTextNode(text) {
      return { nodeType: 3, textContent: String(text ?? '') };
    },
    getElementById(id) {
      return this.elements.get(id) || null;
    },
    querySelector(selector) {
      if (selector === '[data-ss-grid-sort-field]') return this.elements.get('sortSelect') || null;
      if (selector === '[data-ss-grid-group-field]') return this.elements.get('groupSelect') || null;
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener(type, handler) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(handler);
    }
  };
  documentRef = document;

  ['productGrid', 'ssGridHost', 'ssGridStatus', 'productSearchInput', 'productSearchScope', 'sortSelect', 'groupSelect']
    .forEach(id => {
      const el = makeElement(id === 'sortSelect' || id === 'groupSelect' || id === 'productSearchScope' ? 'select' : 'div', id);
      el.ownerDocument = document;
      document.elements.set(id, el);
    });
  document.elements.get('productSearchScope').value = 'current';
  document.elements.get('productSearchInput').value = '';

  return { document, makeElement };
}

function makeDom(document) {
  function elem(tag, options = {}) {
    const el = document.createElement(tag);
    if (options.class) {
      const classes = Array.isArray(options.class) ? options.class : String(options.class).split(/\s+/);
      el.classList.add(...classes.filter(Boolean));
    }
    if (options.id) el.id = String(options.id);
    if (options.text != null) el.textContent = String(options.text);
    if (options.attrs) {
      for (const [name, value] of Object.entries(options.attrs)) {
        if (value == null || value === false) continue;
        el.setAttribute(name, value === true ? '' : value);
      }
    }
    if (options.on) {
      for (const [type, handler] of Object.entries(options.on)) {
        el.addEventListener(type, handler);
      }
    }
    if (Array.isArray(options.children)) options.children.forEach(child => append(el, child));
    return el;
  }

  function append(parent, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) return child.forEach(item => append(parent, item));
    if (typeof child === 'string' || typeof child === 'number') {
      parent.appendChild(document.createTextNode(child));
      return;
    }
    parent.appendChild(child);
  }

  function empty(el) {
    el.replaceChildren();
  }

  return { elem, append, empty };
}

function findAll(node, predicate, out = []) {
  if (!node) return out;
  if (predicate(node)) out.push(node);
  (node.children || []).forEach(child => findAll(child, predicate, out));
  return out;
}

function createHarness() {
  const { document } = makeElementFactory();
  let capturedOptions = null;
  let createdProjection = null;
  let latestProjection = null;
  let updateCount = 0;
  let modalConfig = null;

  const ctx = {
    console,
    globalThis: null,
    document,
    location: { href: 'https://example.test/' },
    SSProductRepo: {
      async listLists() { return [{ id: 'list-1', name: 'NAS' }]; },
      async getActiveListId() { return 'list-1'; },
      async listProducts() {
        return [
          { id: 'p1', title: 'Beta NAS', brand: 'Qnap', source: 'Amazon', newPrice: '$200', url: 'https://example.test/beta' },
          { id: 'p2', title: 'Alpha NAS', brand: 'Synology', source: 'Amazon', newPrice: '$300', url: 'https://example.test/alpha' },
          { id: 'p3', title: 'Gamma NAS', brand: 'Qnap', source: 'Newegg', newPrice: '$250', url: 'https://example.test/gamma' }
        ];
      }
    },
    ShopScoutAgGridAdapter: {
      create(_host, projection, options) {
        capturedOptions = options;
        createdProjection = projection;
        latestProjection = projection;
        return {
          update(nextProjection) {
            updateCount += 1;
            latestProjection = nextProjection;
          },
          destroy() {}
        };
      }
    },
    ShopScoutUI: {
      dom: makeDom(document),
      modal: {
        open(config) {
          modalConfig = config;
          return { close() {} };
        }
      }
    }
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const file of ['grid-rebuild-codex/state.js', 'grid-rebuild-codex/projections.js', 'grid-rebuild-codex/shopscoutGrid.js']) {
    vm.runInContext(fs.readFileSync(path.join(rootDir, file), 'utf8'), ctx, { filename: file });
  }
  return {
    ctx,
    document,
    getOptions: () => capturedOptions,
    getCreatedProjection: () => createdProjection,
    getLatestProjection: () => latestProjection,
    getUpdateCount: () => updateCount,
    getModalConfig: () => modalConfig
  };
}

(async () => {
  {
    const harness = createHarness();
    await harness.ctx.ShopScoutGrid.render();
    assert.deepEqual(
      harness.getCreatedProjection().rows.map(row => row.title),
      ['Beta NAS', 'Alpha NAS', 'Gamma NAS'],
      'initial rows preserve repository order'
    );
    await Promise.resolve(harness.getOptions().onSortChange([{ field: 'title', dir: 'asc' }]));
    assert.ok(harness.getUpdateCount() > 0,
      'header sort refreshes the grid projection instead of only mutating adapter-local state');
    assert.deepEqual(
      harness.getLatestProjection().rows.map(row => row.title),
      ['Alpha NAS', 'Beta NAS', 'Gamma NAS'],
      'header sort state is reflected in the visible projection'
    );
    assert.deepEqual(harness.ctx.ShopScoutGrid.getState().sort, [{ field: 'title', dir: 'asc' }],
      'header sort persists to grid state');
  }

  {
    const harness = createHarness();
    await harness.ctx.ShopScoutGrid.render();
    await harness.ctx.ShopScoutGrid.setMode('matrix');
    const groupSelect = harness.document.elements.get('groupSelect');
    const groupValues = (groupSelect.children || []).map(option => option.value);
    assert.ok(groupValues.includes('brand'), 'group-by options include Brand in Compare view');
    assert.ok(groupValues.includes('source'), 'group-by options include Source in Compare view');
    assert.equal(groupValues.some(value => String(value).startsWith('product:')), false,
      'group-by options list fields, not product columns, in Compare view');
  }

  {
    const harness = createHarness();
    await harness.ctx.ShopScoutGrid.render();
    await harness.ctx.ShopScoutGrid.setMode('matrix');
    harness.ctx.ShopScoutGrid.openFiltersModal();
    const body = harness.getModalConfig().body;
    const fieldSelect = findAll(body, node => node.tagName === 'SELECT')[0];
    const filterValues = (fieldSelect.children || []).map(option => option.value);
    assert.ok(filterValues.includes('brand'), 'filter field options include Brand in Compare view');
    assert.ok(filterValues.includes('source'), 'filter field options include Source in Compare view');
    assert.equal(filterValues.some(value => String(value).startsWith('product:')), false,
      'filter field options list metadata fields, not product/model columns, in Compare view');
  }

  {
    const harness = createHarness();
    await harness.ctx.ShopScoutGrid.render();
    harness.ctx.ShopScoutGrid.openColumnsModal();
    const body = harness.getModalConfig().body;
    const modalActions = harness.getModalConfig().actions || [];
    assert.ok(modalActions.some(action => action.label === 'Cancel'),
      'columns modal exposes a bottom Cancel action');
    assert.ok(modalActions.some(action => action.label === 'Done'),
      'columns modal exposes a bottom Done action');
    const helpText = findAll(body, node => /Hide hides the column/.test(node.textContent || ''))[0];
    assert.ok(helpText, 'columns modal explains Hide versus Remove');
    const letters = findAll(body, node => String(node.className || '').includes('ss-grid-column-letter'))
      .map(node => node.textContent);
    assert.deepEqual(letters, [...letters].sort(),
      'columns modal alphabet headers are sorted alphabetically');
    assert.ok(letters.includes('B'), 'columns modal includes a B group for Brand');
    assert.ok(letters.includes('S'), 'columns modal includes an S group for Source');
    const brandHide = findAll(body, node => node.tagName === 'INPUT' && node.value === 'brand')[0];
    assert.ok(brandHide, 'columns modal renders a Brand hide checkbox');
    brandHide.checked = true;
    await brandHide.dispatch('change');
    assert.equal(harness.ctx.ShopScoutGrid.getState().columnVisibility.brand, false,
      'Hide marks the column hidden in current view state');
    assert.ok(harness.getUpdateCount() > 0,
      'column checkbox changes refresh the grid immediately');
    assert.equal(
      harness.getLatestProjection().columns.some(column => column.id === 'brand'),
      false,
      'hidden column leaves the visible projection without waiting for Apply'
    );
    const sourceRemove = findAll(body, node => node.tagName === 'BUTTON' && node.dataset.columnRemove === 'source')[0];
    assert.ok(sourceRemove, 'columns modal renders a Remove action for removable fields');
    await sourceRemove.dispatch('click');
    assert.ok(harness.ctx.ShopScoutGrid.getState().removedColumns.includes('source'),
      'Remove stores the field in removedColumns');
    assert.equal(
      harness.getLatestProjection().allColumns.some(column => column.id === 'source'),
      false,
      'removed columns leave the full projection model, not only the visible columns'
    );
    assert.equal(
      (harness.getModalConfig().actions || []).some(action => /apply/i.test(action.label || '')),
      false,
      'columns modal does not expose an Apply action'
    );
  }

  {
    const harness = createHarness();
    await harness.ctx.ShopScoutGrid.render();
    assert.ok(harness.getLatestProjection().columns.some(column => column.id === 'brand'),
      'Brand column is initially visible');
    await harness.getOptions().onColumnVisibilityChange({ field: 'brand', visible: false });
    assert.equal(harness.ctx.ShopScoutGrid.getState().columnVisibility.brand, false,
      'header menu Hide Column marks the selected column hidden in grid state');
    assert.equal(
      harness.getLatestProjection().columns.some(column => column.id === 'brand'),
      false,
      'header menu Hide Column refreshes the visible projection'
    );
  }

  {
    const harness = createHarness();
    await harness.ctx.ShopScoutGrid.render();
    harness.ctx.ShopScoutGrid.openFiltersModal();
    const body = harness.getModalConfig().body;
    const modalActions = harness.getModalConfig().actions || [];
    assert.ok(modalActions.some(action => action.label === 'Cancel'),
      'filters modal exposes a bottom Cancel action');
    assert.ok(modalActions.some(action => action.label === 'Done'),
      'filters modal exposes a bottom Done action');
    const fieldSelect = findAll(body, node => node.tagName === 'SELECT')[0];
    assert.ok(fieldSelect, 'filters modal renders a field selector');
    fieldSelect.value = 'brand';
    await fieldSelect.dispatch('change');
    const facetValues = findAll(body, node => node.tagName === 'INPUT' && node.type === 'checkbox')
      .map(node => node.value)
      .sort();
    assert.deepEqual(facetValues, ['Qnap', 'Synology'],
      'Brand filter value editor renders unique table values as checkbox options');
    assert.equal(
      (harness.getModalConfig().actions || []).some(action => /apply/i.test(action.label || '')),
      false,
      'filters modal does not expose an Apply action'
    );
  }

  {
    const { document } = makeElementFactory();
    const ctx = { console, globalThis: null, document, location: { href: 'https://example.test/' } };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(
      fs.readFileSync(path.join(rootDir, 'grid-rebuild-codex/projections.js'), 'utf8'),
      ctx,
      { filename: 'grid-rebuild-codex/projections.js' }
    );
    const projection = ctx.ShopScoutGridCodexProjections.buildProductsRowsProjection([
      { id: 'p1', title: 'Qnap 1', brand: 'Qnap' },
      { id: 'p2', title: 'Synology 1', brand: 'Synology' },
      { id: 'p3', title: 'Qnap 2', brand: 'Qnap' }
    ], {
      viewState: {
        filters: [{ field: 'brand', op: 'contains', value: ['Qnap'] }]
      }
    });
    assert.deepEqual(projection.rows.map(row => row.title), ['Qnap 1', 'Qnap 2'],
      'projection filters accept checkbox-style multi-value filter values');
  }

  console.log('grid-codex-controls.test.js: all assertions passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
