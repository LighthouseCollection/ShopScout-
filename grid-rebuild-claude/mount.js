/* =============================================================
   ShopScoutGrid mount — Claude's Phase 2 grid entry point.
   Registers globalThis.ShopScoutGrid with the public surface
   documented in grid-rebuild-claude/README.md. `comparison.js`'s
   `renderAll()` calls ShopScoutGrid.render() when this module is
   loaded.

   Composition graph (load-order matters in the host HTML):
     shared/values/cellValues.js
     shared/projections/specProjection.js
     shared/edits/ratingWriter.js
     grid-rebuild-claude/state/gridState.js
     grid-rebuild-claude/projections/matrixModes.js
     grid-rebuild-claude/projections/productsAsRows.js
     grid-rebuild-claude/projections/productsAsColumns.js
     grid-rebuild-claude/edits/productEditor.js
     grid-rebuild-claude/renderer/formatters.js
     grid-rebuild-claude/renderer/columnDefs.js
     grid-rebuild-claude/renderer/slickGridRenderer.js
     grid-rebuild-claude/mount.js                  ← this file
   ============================================================= */
(function initShopScoutGridMount(root) {
  const State      = root.ShopScoutGridState;
  const Projections= root.ShopScoutGridProjections;
  const Renderer   = root.ShopScoutGridRenderer;
  const Editor     = root.ShopScoutGridEdits;

  if (!State || !Projections || !Renderer || !Editor) {
    console.warn('[ShopScoutGrid] missing dependency; mount aborted.', {
      hasState: !!State,
      hasProjections: !!Projections,
      hasRenderer: !!Renderer,
      hasEditor: !!Editor
    });
    return;
  }

  const MOUNT_ID = 'productGrid';

  let store = null;
  let rendererInstance = null;
  let cachedProducts = [];

  function getRepo() {
    return root.SSProductRepo || null;
  }

  function getMountEl() {
    return root.document && root.document.getElementById(MOUNT_ID);
  }

  function ensureStore() {
    if (store) return store;
    store = State.createStore({});
    /* Re-render whenever state changes — cheap because projections
       are pure and SlickGrid's DataView absorbs the diff. */
    store.subscribe(() => {
      if (rendererInstance) rendererInstance.render();
    });
    return store;
  }

  async function loadProducts() {
    const repo = getRepo();
    if (!repo) return [];
    const listId = typeof repo.getActiveListId === 'function'
      ? await repo.getActiveListId()
      : null;
    if (!listId) return [];
    try {
      return await repo.listProducts(listId);
    } catch (err) {
      console.warn('[ShopScoutGrid] listProducts failed', err);
      return [];
    }
  }

  function buildProjection(products, state) {
    if (state.mode === 'columns') {
      return Projections.productsAsColumns
        ? Projections.productsAsColumns.project(products, state)
        : { kind: 'columns', columns: [], rows: [] };
    }
    return Projections.productsAsRows
      ? Projections.productsAsRows.project(products, state)
      : { kind: 'rows', columns: [], rows: [] };
  }

  async function render() {
    const mountEl = getMountEl();
    if (!mountEl) return;
    ensureStore();
    cachedProducts = await loadProducts();
    if (!rendererInstance) {
      /* The placeholder empty state in #productGrid uses two known
         children; clear them on first paint. */
      mountEl.innerHTML = '';
      rendererInstance = Renderer.create({
        mountEl,
        store,
        getProjection: () => buildProjection(cachedProducts, store.getState()),
        onEdit: async (event) => {
          const repo = getRepo();
          if (!repo) return { ok: false, reason: 'repo-unavailable' };
          return Editor.write({
            repo,
            productId: event.productId,
            field: event.field,
            value: event.value,
            source: 'grid-edit'
          });
        }
      });
    } else {
      rendererInstance.render();
    }
  }

  function destroy() {
    if (rendererInstance) {
      rendererInstance.destroy();
      rendererInstance = null;
    }
  }

  /* Public API — see grid-rebuild-claude/README.md. */
  root.ShopScoutGrid = {
    render,
    destroy,
    get state() { return ensureStore().getState(); },
    dispatch(patch) { return ensureStore().dispatch(patch); },
    subscribe(fn)   { return ensureStore().subscribe(fn); },
    getProjection() {
      return buildProjection(cachedProducts, ensureStore().getState());
    },
    /* Re-export the dep namespaces for tests / DevTools poking. */
    _state: State,
    _projections: Projections,
    _renderer: Renderer,
    _editor: Editor
  };
})(globalThis);
