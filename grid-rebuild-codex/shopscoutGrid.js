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
    lastProducts: []
  };

  function ensureStore() {
    if (state.store) return state.store;
    const State = root.ShopScoutGridCodexState;
    state.store = State && typeof State.createStore === 'function'
      ? State.createStore({})
      : {
        _state: { mode: 'rows', matrixMode: 'basic', search: '', sort: [], columnOrder: [], columnWidths: {} },
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
    const searchInput = root.document?.getElementById('productSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        ensureStore().dispatch({ search: searchInput.value || '' });
      });
    }
  }

  async function mirrorLegacy(product) {
    const chrome = root.browser || root.chrome;
    const editing = root.ShopScoutGridCodexEditing;
    if (!chrome?.storage?.local || !editing?.mirrorProductIntoLegacyBlob) return;
    const stored = await chrome.storage.local.get('shopscout_data');
    const blob = stored.shopscout_data;
    if (!blob?.lists) return;
    const next = editing.mirrorProductIntoLegacyBlob(blob, product);
    await chrome.storage.local.set({ shopscout_data: next });
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
    await mirrorLegacy(result.product);
    await refreshGridData();
  }

  async function refreshGridData() {
    const viewState = ensureStore().getState();
    const products = applySearch(await loadProducts(), viewState);
    state.lastProducts = products;
    const projection = buildProjection(products);
    if (state.adapter?.update) state.adapter.update(projection);
    setStatus(`${products.length} product${products.length === 1 ? '' : 's'} loaded`);
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
      if (!products.length) {
        setHostMessage(host, 'No products in this view.');
        setStatus('No products');
        state.adapter?.destroy?.();
        state.adapter = null;
        return;
      }
      const adapterFactory = root.ShopScoutSlickGridAdapter;
      if (!adapterFactory || typeof adapterFactory.create !== 'function') {
        setHostMessage(host, 'Grid engine failed to load.');
        setStatus('Grid engine unavailable');
        return;
      }
      state.adapter?.destroy?.();
      state.adapter = adapterFactory.create(host, projection, {
        onSortChange(sort) {
          ensureStore().dispatch({ sort });
        },
        onColumnOrderChange(columnOrder) {
          ensureStore().dispatch({ columnOrder });
        },
        onColumnWidthsChange(columnWidths) {
          ensureStore().dispatch({ columnWidths });
        },
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
      setStatus(`${products.length} product${products.length === 1 ? '' : 's'} loaded`);
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
    }
  });
})(globalThis);
