/* =============================================================
   ShopScout — Codex grid orchestrator

   Registers globalThis.ShopScoutGrid for comparison.js renderAll().
   The orchestrator owns data loading and app callbacks; SlickGrid is
   contained inside slickGridAdapter.js.
   ============================================================= */
(function initShopScoutGrid(root) {
  const NS = (root.ShopScoutGrid = root.ShopScoutGrid || {});

  const state = {
    adapter: null,
    store: null,
    bound: false,
    lastProducts: [],
    lastProjection: null
  };

  function ensureStore() {
    if (state.store) return state.store;
    const State = root.ShopScoutGridCodexState;
    state.store = State && typeof State.createStore === 'function'
      ? State.createStore({})
      : {
        _state: {
          mode: 'rows',
          matrixMode: 'basic',
          search: '',
          filters: [],
          sort: [],
          group: null,
          columnVisibility: {},
          columnOrder: []
        },
        getState() { return this._state; },
        dispatch(patch) { this._state = Object.assign({}, this._state, patch || {}); return this._state; }
      };
    return state.store;
  }

  function getMount() {
    return root.document?.getElementById('productGrid') || null;
  }

  function getHost() {
    return root.document?.getElementById('ssGridHost') || null;
  }

  function getStatus() {
    return root.document?.getElementById('ssGridStatus') || null;
  }

  function setStatus(text) {
    const status = getStatus();
    if (status) status.textContent = text || '';
  }

  function setHostMessage(host, message) {
    if (!host) return;
    const doc = host.ownerDocument || root.document;
    const messageEl = doc.createElement('div');
    messageEl.className = 'ss-grid-empty';
    messageEl.textContent = message;
    host.replaceChildren(messageEl);
  }

  function isRepoReady(repo) {
    return repo
      && typeof repo.listLists === 'function'
      && typeof repo.getActiveListId === 'function'
      && typeof repo.listProducts === 'function';
  }

  async function loadFromRepo(scope) {
    const repo = root.SSProductRepo;
    const lists = await repo.listLists();
    const activeListId = await repo.getActiveListId();
    const wanted = scope === 'all' ? lists : lists.filter(list => list.id === activeListId);
    const products = [];
    for (const list of wanted) {
      const rows = await repo.listProducts(list.id);
      for (const product of rows) {
        products.push(Object.assign({}, product, {
          _listId: list.id,
          _listName: list.name
        }));
      }
    }
    return products;
  }

  async function loadFromLegacy(scope) {
    const SS = root.SS;
    if (!SS || typeof SS.getData !== 'function') return [];
    const data = await SS.getData();
    if (scope === 'all') {
      return Object.entries(data.lists || {}).flatMap(([listName, products]) => (
        Array.isArray(products) ? products.map(product => Object.assign({}, product, { _listName: listName })) : []
      ));
    }
    const listName = data.activeList;
    return (data.lists?.[listName] || []).map(product => Object.assign({}, product, { _listName: listName }));
  }

  async function loadProducts() {
    const scope = root.document?.getElementById('productSearchScope')?.value || 'current';
    const repo = root.SSProductRepo;
    if (isRepoReady(repo)) return loadFromRepo(scope);
    return loadFromLegacy(scope);
  }

  function searchableText(product) {
    const specs = (Array.isArray(product?.rawSpecs) ? product.rawSpecs : [])
      .flatMap(spec => [spec?.key, spec?.value]);
    return [
      product?.title,
      product?.listingTitle,
      product?.productName,
      product?.brand,
      product?.manufacturer,
      product?.modelName,
      product?.modelNumber,
      product?.sku,
      product?.asin,
      product?.upc,
      product?.mpn,
      product?.gtin,
      product?.source,
      product?.sellerName,
      product?.category,
      product?.availability,
      product?.notes,
      product?.description,
      product?.newPrice,
      product?.usedPrice,
      product?.shippingPrice,
      product?.rating,
      product?.reviewCount,
      ...specs
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function applySearch(products, viewState) {
    const query = String(viewState?.search || '').trim().toLowerCase();
    if (!query) return products;
    const parts = query.split(/\s+/).filter(Boolean);
    return products.filter(product => {
      const haystack = searchableText(product);
      return parts.every(part => haystack.includes(part));
    });
  }

  function selectedSpecKeys(products) {
    const heuristic = root.SSSpecHeuristic;
    if (heuristic && typeof heuristic.pickDefaultSpecColumns === 'function') {
      try {
        const picked = heuristic.pickDefaultSpecColumns(products, { max: 8 });
        if (Array.isArray(picked) && picked.length) return picked;
      } catch {
        /* fall through to projection discovery */
      }
    }
    return [];
  }

  function buildProjection(products) {
    const projections = root.ShopScoutGridCodexProjections;
    if (!projections) throw new Error('ShopScout grid projections are not loaded.');
    const viewState = ensureStore().getState();
    const specKeys = selectedSpecKeys(products);
    if (viewState.mode === 'matrix') {
      return projections.buildComparisonMatrixProjection(products, {
        visibleSpecKeys: specKeys,
        matrixMode: viewState.matrixMode,
        viewState
      });
    }
    return projections.buildProductsRowsProjection(products, { visibleSpecKeys: specKeys, viewState });
  }

  function usableColumns(projection) {
    const columns = projection?.allColumns || projection?.columns || state.lastProjection?.allColumns || [];
    return columns.filter(column => column && !['selection', 'image', 'actions'].includes(column.type));
  }

  function groupableColumns(projection) {
    const columns = projection?.groupColumns || projection?.allColumns || projection?.columns || state.lastProjection?.groupColumns || [];
    return columns.filter(column => column
      && !['selection', 'image', 'actions', 'matrixCell', 'attribute'].includes(column.type)
      && !(String(column.id || '').startsWith('product:')));
  }

  function filterableColumns(projection) {
    return groupableColumns(projection);
  }

  function optionSignature(columns, placeholder) {
    return JSON.stringify({
      placeholder: placeholder || 'None',
      options: columns.map(column => [column.field || column.id, column.name || column.id])
    });
  }

  function appendOption(select, value, label) {
    const option = (select.ownerDocument || root.document).createElement('option');
    option.value = String(value ?? '');
    option.textContent = String(label ?? '');
    select.appendChild(option);
  }

  function setSelectOptions(select, columns, placeholder, value) {
    if (!select) return;
    const signature = optionSignature(columns, placeholder);
    if (select.dataset.optionsSignature !== signature) {
      select.replaceChildren();
      appendOption(select, '', placeholder || 'None');
      columns.forEach(column => appendOption(select, column.field || column.id, column.name || column.id));
      select.dataset.optionsSignature = signature;
    }
    select.value = value || '';
  }

  function updateRibbonControls(projection) {
    const viewState = ensureStore().getState();
    const columns = usableColumns(projection);
    const groupColumns = groupableColumns(projection);
    setSelectOptions(root.document?.querySelector('[data-ss-grid-sort-field]'), columns, 'No sort', viewState.sort?.[0]?.field || '');
    setSelectOptions(root.document?.querySelector('[data-ss-grid-group-field]'), groupColumns, 'No grouping', viewState.group || '');
    root.document?.querySelectorAll('[data-ss-grid-command="mode-rows"]').forEach(button => {
      button.classList.toggle('active', viewState.mode !== 'matrix');
      button.setAttribute('aria-pressed', viewState.mode !== 'matrix' ? 'true' : 'false');
    });
    root.document?.querySelectorAll('[data-ss-grid-command="mode-matrix"]').forEach(button => {
      button.classList.toggle('active', viewState.mode === 'matrix');
      button.setAttribute('aria-pressed', viewState.mode === 'matrix' ? 'true' : 'false');
    });
    /* Restore the persisted width mode + reflect it in the toolbar. */
    let widthMode = 'fit';
    try {
      /* Default to Full mode — users have consistently asked for the
         table to fill the page. Fit is opt-in via the ribbon toggle. */
      const stored = root.localStorage?.getItem('shopscout_grid_width_mode');
      widthMode = stored === 'fit' ? 'fit' : 'full';
    } catch {}
    const shell = root.document?.querySelector('.ss-grid-shell');
    if (shell && shell.getAttribute('data-shell-width') !== widthMode) {
      shell.setAttribute('data-shell-width', widthMode);
    }
    root.document?.querySelectorAll('[data-ss-grid-command="width-fit"]').forEach(btn => {
      btn.classList.toggle('active', widthMode === 'fit');
      btn.setAttribute('aria-pressed', widthMode === 'fit' ? 'true' : 'false');
    });
    root.document?.querySelectorAll('[data-ss-grid-command="width-full"]').forEach(btn => {
      btn.classList.toggle('active', widthMode === 'full');
      btn.setAttribute('aria-pressed', widthMode === 'full' ? 'true' : 'false');
    });
  }

  function updateModeButtons() {
    const viewState = ensureStore().getState();
    root.document?.querySelectorAll('[data-ss-grid-mode]').forEach(button => {
      const active = button.dataset.ssGridMode === viewState.mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    root.document?.querySelectorAll('[data-ss-grid-matrix]').forEach(button => {
      const active = button.dataset.ssGridMatrix === viewState.matrixMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function ensureBound() {
    if (state.bound) return;
    state.bound = true;
    root.document?.addEventListener('click', event => {
      const modeButton = event.target?.closest?.('[data-ss-grid-mode]');
      if (modeButton) {
        ensureStore().dispatch({ mode: modeButton.dataset.ssGridMode === 'matrix' ? 'matrix' : 'rows' });
        updateModeButtons();
        render();
        return;
      }
      const matrixButton = event.target?.closest?.('[data-ss-grid-matrix]');
      if (matrixButton) {
        ensureStore().dispatch({
          mode: 'matrix',
          matrixMode: matrixButton.dataset.ssGridMatrix === 'detailed' ? 'detailed' : 'basic'
        });
        updateModeButtons();
        render();
      }
    });
    root.document?.addEventListener('click', event => {
      const commandButton = event.target?.closest?.('[data-ss-grid-command]');
      if (!commandButton || commandButton.disabled) return;
      const command = commandButton.dataset.ssGridCommand;
      if (!command) return;
      event.preventDefault();
      handleGridCommand(command);
    });
    root.document?.addEventListener('change', event => {
      const sortSelect = event.target?.closest?.('[data-ss-grid-sort-field]');
      if (sortSelect) {
        const field = sortSelect.value || '';
        const current = ensureStore().getState().sort?.[0];
        ensureStore().dispatch({ sort: field ? [{ field, dir: current?.dir || 'asc' }] : [] });
        render();
        return;
      }
      const groupSelect = event.target?.closest?.('[data-ss-grid-group-field]');
      if (groupSelect) {
        ensureStore().dispatch({ group: groupSelect.value || null });
        render();
      }
    });
    const searchInput = root.document?.getElementById('productSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        ensureStore().dispatch({ search: searchInput.value || '' });
        return refreshGridData();
      });
    }
    const searchScope = root.document?.getElementById('productSearchScope');
    if (searchScope) {
      searchScope.addEventListener('change', () => render());
    }
  }

  function currentSortField() {
    return root.document?.querySelector('[data-ss-grid-sort-field]')?.value
      || ensureStore().getState().sort?.[0]?.field
      || '';
  }

  function handleGridCommand(command) {
    if (command === 'mode-rows') {
      ensureStore().dispatch({ mode: 'rows' });
      render();
    } else if (command === 'mode-matrix') {
      ensureStore().dispatch({ mode: 'matrix' });
      render();
    } else if (command === 'sort-asc' || command === 'sort-desc') {
      const field = currentSortField();
      if (!field) {
        root.SS?.toast?.show?.('Choose a field to sort by first.', 'error');
        return;
      }
      ensureStore().dispatch({ sort: [{ field, dir: command === 'sort-desc' ? 'desc' : 'asc' }] });
      render();
    } else if (command === 'clear-sort') {
      ensureStore().dispatch({ sort: [] });
      render();
    } else if (command === 'open-filters') {
      openFiltersModal();
    } else if (command === 'clear-filters') {
      ensureStore().dispatch({ filters: [] });
      render();
    } else if (command === 'open-columns') {
      openColumnsModal();
    } else if (command === 'reset-columns') {
      ensureStore().dispatch({ columnVisibility: {}, columnOrder: [], pinnedColumns: [] });
      render();
    } else if (command === 'clear-group') {
      ensureStore().dispatch({ group: null });
      render();
    } else if (command === 'reset-all') {
      /* Reset Everything — the big red button. Wipes every user-facing
         table configuration in one shot: filters, sort, grouping,
         column visibility/order/pinning. Preserves search input,
         current mode (rows vs matrix), and active list selection —
         those are intentional session state, not "settings". */
      ensureStore().dispatch({
        filters: [],
        sort: [],
        group: null,
        columnVisibility: {},
        columnOrder: [],
        pinnedColumns: []
      });
      render();
    } else if (command === 'width-fit' || command === 'width-full') {
      /* Persist to localStorage — shell width is a personal preference,
         not per-list state. Read on next mount + applied via CSS data
         attribute on the shell. */
      const mode = command === 'width-full' ? 'full' : 'fit';
      try { root.localStorage?.setItem('shopscout_grid_width_mode', mode); } catch {}
      const shell = root.document?.querySelector('.ss-grid-shell');
      if (shell) shell.setAttribute('data-shell-width', mode);
      /* Re-run overflow/width calculation for the new mode. */
      root.document?.querySelectorAll('[data-ss-grid-command="width-fit"],[data-ss-grid-command="width-full"]').forEach(btn => {
        btn.classList.toggle('rb-btn-lg--active', btn.dataset.ssGridCommand === `width-${mode}`);
      });
      render();
    }
  }

  function fieldLabel(field) {
    const columns = filterableColumns(state.lastProjection);
    const match = columns.find(column => (column.field || column.id) === field);
    return match?.name || field;
  }

  function cellText(row, field) {
    const value = row?.[field];
    if (value == null) return '';
    if (typeof value === 'object') return String(value.value ?? value.corrected ?? value.raw ?? '');
    return String(value);
  }

  function facetValuesForField(field) {
    if (!field) return [];
    const rows = state.lastProjection?.allRows
      || state.lastProjection?.products
      || state.lastProjection?.rows
      || [];
    const values = new Set();
    for (const row of rows) {
      if (!row || row._isGroup) continue;
      const text = cellText(row, field).trim();
      if (text) values.add(text);
    }
    return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }

  function supportsFacetEditor(op) {
    return ['contains', 'equals', 'starts'].includes(op || 'contains');
  }

  function renderFilterValueEditor(slot, filter, onChange) {
    const ui = root.ShopScoutUI;
    const dom = ui?.dom;
    if (!dom || !slot) return;
    dom.empty(slot);
    const op = filter.op || 'contains';
    if (op === 'empty' || op === 'notEmpty') {
      onChange('');
      dom.append(slot, dom.elem('span', { class: 'ss-grid-modal-muted', text: 'No value needed' }));
      return;
    }
    const choices = supportsFacetEditor(op) ? facetValuesForField(filter.field) : [];
    if (choices.length) {
      const selected = new Set(Array.isArray(filter.value)
        ? filter.value.map(String)
        : String(filter.value || '').split('\u0000').filter(Boolean));
      const search = dom.elem('input', {
        class: 'ss-grid-modal-input ss-grid-facet-search',
        attrs: { type: 'search', placeholder: `Search ${fieldLabel(filter.field)} values` }
      });
      const options = dom.elem('div', { class: 'ss-grid-facet-options' });
      const sync = () => onChange([...selected]);
      function renderOptions() {
        const q = search.value.trim().toLowerCase();
        dom.empty(options);
        choices
          .filter(choice => !q || choice.toLowerCase().includes(q))
          .forEach(choice => {
            const input = dom.elem('input', { attrs: { type: 'checkbox', value: choice } });
            input.checked = selected.has(choice);
            input.addEventListener('change', () => {
              if (input.checked) selected.add(choice);
              else selected.delete(choice);
              sync();
            });
            dom.append(options, dom.elem('label', {
              class: 'ss-grid-facet-option',
              children: [
                input,
                dom.elem('span', { text: choice })
              ]
            }));
          });
      }
      search.addEventListener('input', renderOptions);
      dom.append(slot, search);
      dom.append(slot, options);
      renderOptions();
      return;
    }
    const input = dom.elem('input', {
      class: 'ss-grid-modal-input',
      attrs: { type: ['gt', 'lt'].includes(op) ? 'number' : 'text', placeholder: 'Value' }
    });
    input.value = Array.isArray(filter.value) ? filter.value.join(', ') : String(filter.value || '');
    input.addEventListener('input', () => onChange(input.value || ''));
    dom.append(slot, input);
  }

  function openFallbackModal(title, text) {
    root.alert?.(`${title}\n\n${text}`);
  }

  function openFiltersModal() {
    const ui = root.ShopScoutUI;
    const dom = ui?.dom;
    if (!ui?.modal || !dom) {
      openFallbackModal('Filters', 'The themed modal system is not available.');
      return;
    }
    const viewState = ensureStore().getState();
    let localFilters = Array.isArray(viewState.filters) ? viewState.filters.slice() : [];
    const columns = filterableColumns(state.lastProjection);
    const body = dom.elem('div', { class: 'ss-grid-modal-body' });
    const list = dom.elem('div', { class: 'ss-grid-filter-list' });
    const field = dom.elem('select', { class: 'ss-grid-modal-select' });
    setSelectOptions(field, columns, 'Choose field', '');
    const op = dom.elem('select', { class: 'ss-grid-modal-select' });
    [
      ['contains', 'contains'],
      ['equals', 'equals'],
      ['starts', 'starts with'],
      ['notEmpty', 'is not empty'],
      ['empty', 'is empty'],
      ['gt', 'greater than'],
      ['lt', 'less than']
    ].forEach(([optionValue, label]) => appendOption(op, optionValue, label));
    const pending = { field: '', op: 'contains', value: '' };
    const valueSlot = dom.elem('div', { class: 'ss-grid-value-editor' });
    function commitFilters() {
      ensureStore().dispatch({ filters: localFilters });
      return refreshGridData();
    }
    function updatePendingEditor() {
      pending.field = field.value || '';
      pending.op = op.value || 'contains';
      renderFilterValueEditor(valueSlot, pending, nextValue => {
        pending.value = nextValue;
      });
    }
    field.addEventListener('change', updatePendingEditor);
    op.addEventListener('change', updatePendingEditor);
    const add = dom.elem('button', {
      class: 'ssui-btn ssui-btn--primary',
      text: 'Add Filter',
      attrs: { type: 'button' },
      on: {
        click() {
          if (!field.value) return;
          localFilters.push({ field: field.value, op: op.value, value: pending.value || '' });
          pending.value = '';
          renderFilterList();
          commitFilters();
        }
      }
    });
    const row = dom.elem('div', { class: 'ss-grid-modal-row', children: [field, op, valueSlot, add] });
    dom.append(body, row);
    dom.append(body, list);
    function renderFilterList() {
      dom.empty(list);
      if (!localFilters.length) {
        dom.append(list, dom.elem('p', { class: 'ss-grid-modal-muted', text: 'No active filters.' }));
        return;
      }
      localFilters.forEach((filter, index) => {
        const item = dom.elem('div', {
          class: 'ss-grid-filter-item',
          children: [
            dom.elem('span', { text: `${fieldLabel(filter.field)} ${filter.op || 'contains'} ${filter.value || ''}` }),
            dom.elem('button', {
              text: 'Remove',
              attrs: { type: 'button' },
              on: { click() { localFilters.splice(index, 1); renderFilterList(); commitFilters(); } }
            })
          ]
        });
        dom.append(list, item);
      });
    }
    updatePendingEditor();
    renderFilterList();
    ui.modal.open({
      title: 'Filters',
      body,
      width: 'min(760px, 94vw)',
      actions: [
        { label: 'Cancel', value: false },
        { label: 'Done', kind: 'primary', value: true, isDefault: true }
      ]
    });
  }

  function openColumnsModal() {
    const ui = root.ShopScoutUI;
    const dom = ui?.dom;
    if (!ui?.modal || !dom) {
      openFallbackModal('Columns', 'The themed modal system is not available.');
      return;
    }
    const viewState = ensureStore().getState();
    const body = dom.elem('div', { class: 'ss-grid-modal-body' });
    const help = dom.elem('div', {
      class: 'ss-grid-column-help',
      children: [
        dom.elem('p', { text: 'Hide hides the column in the current view only. Metadata remains available.' }),
        dom.elem('p', { text: 'Remove removes the metadata field from this table view, including columns, filters, grouping, and compare rows.' })
      ]
    });
    const search = dom.elem('input', {
      class: 'ss-grid-modal-input',
      attrs: { type: 'search', placeholder: 'Search columns' }
    });
    const list = dom.elem('div', { class: 'ss-grid-column-list' });
    const localVisibility = Object.assign({}, viewState.columnVisibility || {});
    dom.append(body, help);
    dom.append(body, search);
    dom.append(body, list);

    function availableColumns() {
      return filterableColumns(state.lastProjection)
        .slice()
        .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), undefined, {
          numeric: true,
          sensitivity: 'base'
        }));
    }

    function columnLetter(column) {
      const label = String(column.name || column.id || '').trim();
      const first = label.charAt(0).toUpperCase();
      return /^[A-Z]$/.test(first) ? first : '#';
    }

    function renderColumnList() {
      const q = search.value.trim().toLowerCase();
      dom.empty(list);
      const groups = new Map();
      availableColumns()
        .filter(column => !q || String(column.name || column.id).toLowerCase().includes(q))
        .forEach(column => {
          const letter = columnLetter(column);
          if (!groups.has(letter)) groups.set(letter, []);
          groups.get(letter).push(column);
        });
      if (!groups.size) {
        dom.append(list, dom.elem('p', { class: 'ss-grid-modal-muted', text: 'No matching columns.' }));
        return;
      }
      for (const [letter, groupColumns] of groups.entries()) {
        const group = dom.elem('div', { class: 'ss-grid-column-group' });
        dom.append(group, dom.elem('div', { class: 'ss-grid-column-letter', text: letter }));
        groupColumns.forEach(column => {
          const field = column.id;
          const required = !!column.required;
          const hidden = !required && (localVisibility[field] === false
            || (column.defaultHidden && localVisibility[field] !== true));
          const hideInput = dom.elem('input', {
            attrs: { type: 'checkbox', value: field }
          });
          hideInput.checked = hidden;
          hideInput.disabled = required;
          hideInput.addEventListener('change', () => {
            if (hideInput.checked) localVisibility[field] = false;
            else if (column.defaultHidden) localVisibility[field] = true;
            else delete localVisibility[field];
            ensureStore().dispatch({ columnVisibility: Object.assign({}, localVisibility) });
            return refreshGridData();
          });
          const remove = dom.elem('button', {
            class: 'ss-grid-column-remove',
            text: 'Remove',
            attrs: { type: 'button', 'data-column-remove': field },
            on: {
              click() {
                if (required) return;
                const current = ensureStore().getState();
                const removed = new Set(Array.isArray(current.removedColumns) ? current.removedColumns : []);
                removed.add(field);
                delete localVisibility[field];
                ensureStore().dispatch({
                  removedColumns: [...removed],
                  columnVisibility: Object.assign({}, localVisibility),
                  columnOrder: (current.columnOrder || []).filter(id => id !== field),
                  pinnedColumns: (current.pinnedColumns || []).filter(id => id !== field),
                  sort: (current.sort || []).filter(item => item.field !== field),
                  filters: (current.filters || []).filter(item => item.field !== field),
                  group: current.group === field ? null : current.group
                });
                return refreshGridData().then(renderColumnList);
              }
            }
          });
          remove.disabled = required;
          dom.append(group, dom.elem('div', {
            class: 'ss-grid-column-option',
            children: [
              dom.elem('span', { class: 'ss-grid-column-name', text: `${column.name || column.id}${required ? ' (required)' : ''}` }),
              dom.elem('label', {
                class: 'ss-grid-column-toggle',
                children: [hideInput, dom.elem('span', { text: 'Hide' })]
              }),
              remove
            ]
          }));
        });
        dom.append(list, group);
      }
    }
    search.addEventListener('input', renderColumnList);
    renderColumnList();
    ui.modal.open({
      title: 'Columns',
      body,
      width: 'min(760px, 94vw)',
      actions: [
        { label: 'Cancel', value: false },
        { label: 'Done', kind: 'primary', value: true, isDefault: true }
      ]
    });
  }

  async function commitCellEdit(edit) {
    const repo = root.SSProductRepo;
    const editing = root.ShopScoutGridCodexEditing;
    if (!repo?.getProduct || !repo?.updateProduct || !editing?.buildProductPatch) return;
    const productId = edit?.row?._shopScout?.productId || edit?.row?.id;
    if (!productId || !edit?.field) return;
    const fresh = await repo.getProduct(productId);
    if (!fresh) return;
    const patch = editing.buildProductPatch(fresh, {
      field: edit.field,
      value: edit.value
    });
    if (!Object.keys(patch).length) return;
    const result = await repo.updateProduct(productId, patch, {
      listId: fresh.listId,
      baseRevision: edit.row?._shopScout?.revision,
      source: 'grid-inline-edit'
    });
    if (!result?.ok) {
      const toast = root.SS?.toast || root.toast;
      toast?.show?.('This product changed during editing. Reloaded the latest value.', 'error');
      state.adapter?.flashCell?.(productId, edit.field);
      await refreshGridData();
      return;
    }
    if (!await updateRow(result.product)) await refreshGridData();
  }

  async function refreshGridData() {
    const viewState = ensureStore().getState();
    const products = applySearch(await loadProducts(), viewState);
    state.lastProducts = products;
    const projection = buildProjection(products);
    state.lastProjection = projection;
    updateRibbonControls(projection);
    if (state.adapter?.update) state.adapter.update(projection);
    const count = projection.productRowCount ?? products.length;
    setStatus(`${count} product${count === 1 ? '' : 's'} loaded`);
  }

  function canUseRowDelta() {
    const viewState = ensureStore().getState();
    return state.adapter
      && viewState.mode !== 'matrix'
      && !viewState.group;
  }

  function rowIdForProduct(product) {
    return product?._shopScout?.productId || product?.id || '';
  }

  function rowForProduct(product, products) {
    const projection = buildProjection(products);
    const id = product?.id || product?._shopScout?.productId || '';
    const row = (projection.rows || []).find(candidate => rowIdForProduct(candidate) === id || candidate.id === id);
    return { projection, row };
  }

  async function updateRow(product) {
    if (!product?.id || !canUseRowDelta() || !state.adapter?.updateRow) return false;
    const index = state.lastProducts.findIndex(item => item.id === product.id);
    if (index < 0) return false;
    const nextProducts = state.lastProducts.slice();
    nextProducts[index] = Object.assign({}, nextProducts[index], product);
    const { projection, row } = rowForProduct(nextProducts[index], nextProducts);
    if (!row) return false;
    const ok = state.adapter.updateRow(row.id, row);
    if (!ok) return false;
    state.lastProducts = nextProducts;
    state.lastProjection = projection;
    updateRibbonControls(projection);
    const count = projection.productRowCount ?? nextProducts.length;
    setStatus(`${count} product${count === 1 ? '' : 's'} loaded`);
    return true;
  }

  async function deleteRow(productId) {
    const id = String(productId || '').trim();
    if (!id || !canUseRowDelta() || !state.adapter?.deleteRow) return false;
    const index = state.lastProducts.findIndex(item => item.id === id);
    if (index < 0) return false;
    const ok = state.adapter.deleteRow(id);
    if (!ok) return false;
    const nextProducts = state.lastProducts.slice();
    nextProducts.splice(index, 1);
    const projection = buildProjection(nextProducts);
    state.lastProducts = nextProducts;
    state.lastProjection = projection;
    updateRibbonControls(projection);
    const count = projection.productRowCount ?? nextProducts.length;
    setStatus(`${count} product${count === 1 ? '' : 's'} loaded`);
    return true;
  }

  async function handleAction(action, row) {
    if (!row) return;
    const id = row._shopScout?.productId || row.id;
    if (action === 'open' && typeof root.openProductDetailById === 'function') {
      await root.openProductDetailById({ id, url: row._shopScout?.url || row.url });
    }
    if (action === 'rescan' && typeof root.rescanProductById === 'function') {
      await root.rescanProductById({ id, url: row._shopScout?.url || row.url });
    }
    if (action === 'delete' && typeof root.deleteProductById === 'function') {
      const confirm = root.ShopScoutUI?.confirm;
      if (typeof confirm !== 'function') {
        const toast = root.SS?.toast || root.toast;
        toast?.show?.('Delete confirmation is unavailable. Product was not deleted.', 'error');
        return;
      }
      const label = row.title || row._shopScout?.url || row.url || 'this product';
      const proceed = await confirm(`Delete product?\n\n${label}`, {
        title: 'Delete product?',
        okLabel: 'Delete',
        kind: 'danger'
      });
      if (!proceed) return;
      await root.deleteProductById({ id, url: row._shopScout?.url || row.url });
    }
  }

  async function render() {
    const mount = getMount();
    const host = getHost();
    if (!mount || !host) return;
    ensureBound();
    const store = ensureStore();
    const searchInput = root.document?.getElementById('productSearchInput');
    if (searchInput && searchInput.value !== store.getState().search) {
      store.dispatch({ search: searchInput.value || '' });
    }
    updateModeButtons();
    try {
      setStatus('Loading products...');
      const products = applySearch(await loadProducts(), store.getState());
      state.lastProducts = products;
      const projection = buildProjection(products);
      state.lastProjection = projection;
      updateRibbonControls(projection);
      if (!products.length) {
        setHostMessage(host, 'No products in this view.');
        setStatus('No products');
        state.adapter?.destroy?.();
        state.adapter = null;
        return;
      }
      /* Products grid + comparisonMatrix → AG Grid (Phase 1 + 2 done).
         normalizationReview / userRules → SlickGrid until their
         renderers are wired (Phase 3). AG Grid's renderMatrixCell
         now unwraps the displayCell {value, raw, corrected, ...}
         objects that comparison matrix rows produce. */
      const mode = projection?.mode;
      const useSlickGrid = mode === 'normalizationReview'
        || mode === 'userRules';
      const adapterFactory = useSlickGrid
        ? root.ShopScoutSlickGridAdapter
        : root.ShopScoutAgGridAdapter;
      if (!adapterFactory || typeof adapterFactory.create !== 'function') {
        setHostMessage(host, 'Grid engine failed to load.');
        setStatus('Grid engine unavailable');
        return;
      }
      state.adapter?.destroy?.();
      state.adapter = adapterFactory.create(host, projection, {
        onSortChange(sort) {
          ensureStore().dispatch({ sort });
          return refreshGridData();
        },
        onColumnOrderChange(columnOrder) {
          ensureStore().dispatch({ columnOrder });
        },
        /* Column widths are not persisted — every load auto-sizes columns
           from content via columnWidthBounds. Resize handles still work
           for the current session; the change is just no longer written
           to the store, so reload restores auto-sized widths. */
        onSelectionChange(items) {
          const rows = (items || []).map(item => ({
            id: item?._shopScout?.productId || item?.id,
            url: item?._shopScout?.url || item?.url
          }));
          ensureStore().dispatch({ selectedProductIds: rows.map(row => row.id).filter(Boolean) });
          if (typeof root.setSelectedProductsFromIds === 'function') root.setSelectedProductsFromIds(rows);
        },
        onCellCommit: commitCellEdit,
        onAction: handleAction
      });
      const count = projection.productRowCount ?? products.length;
      const total = projection.totalProductRowCount ?? products.length;
      setStatus(count === total
        ? `${count} product${count === 1 ? '' : 's'} loaded`
        : `${count} of ${total} products shown`);
    } catch (err) {
      console.error('ShopScoutGrid render failed', err);
      setHostMessage(host, 'Could not render product grid.');
      setStatus(err?.message || 'Grid render failed');
    }
  }

  Object.assign(NS, {
    render,
    setMode(mode) {
      ensureStore().dispatch({ mode: mode === 'matrix' ? 'matrix' : 'rows' });
      return render();
    },
    setMatrixMode(mode) {
      ensureStore().dispatch({ mode: 'matrix', matrixMode: mode === 'detailed' ? 'detailed' : 'basic' });
      return render();
    },
    getMode() {
      return ensureStore().getState().mode;
    },
    getState() {
      return ensureStore().getState();
    },
    setSort(field, dir) {
      ensureStore().dispatch({ sort: field ? [{ field, dir: dir === 'desc' ? 'desc' : 'asc' }] : [] });
      return render();
    },
    setFilters(filters) {
      ensureStore().dispatch({ filters: Array.isArray(filters) ? filters : [] });
      return render();
    },
    setGroup(field) {
      ensureStore().dispatch({ group: field || null });
      return render();
    },
    openFiltersModal,
    openColumnsModal,
    updateRow,
    deleteRow
  });
})(globalThis);
