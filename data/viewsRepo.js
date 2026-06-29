/* =============================================================
   ShopScout — viewsRepo
   Saved views: a named config (filters/sort/group/columns/mode)
   that the active product grid renders against productRepo.
   Renderer-agnostic — the shape is consumed by whichever grid is
   mounted on #productGrid (Phase 2 SlickGrid implementation).
   ============================================================= */
(function initViewsRepo(root) {
  const SSDB = root.SSDB;
  if (!SSDB) throw new Error('viewsRepo: data/db.js must load first');
  const { db, uuid, now } = SSDB;

  /* viewConfig:
     {
       id, name, listId, mode: 'grid' | 'pivot' | 'kanban' | 'gallery',
       filters: [{field, op, value, conj}],
       sort:    [{field, dir}],
       group:   string | null,
       columns: [{id, hidden, frozen, order, width}],
       pivot:   { rows: [], cols: [], vals: [], aggregator: 'sum' | 'count' | 'avg' | ... },
       updatedAt
     } */

  async function listViews(listId) {
    return db.views.where('listId').equals(listId).sortBy('name');
  }

  async function getView(id) {
    return db.views.get(id);
  }

  async function createView(view) {
    const rec = Object.assign({}, view, {
      id: view.id || uuid(),
      updatedAt: now()
    });
    await db.views.add(rec);
    return rec;
  }

  async function updateView(id, patch) {
    await db.views.update(id, Object.assign({}, patch, { updatedAt: now() }));
  }

  async function deleteView(id) {
    await db.views.delete(id);
  }

  /* Per-list "last open" view — for restoring the user's last context. */
  async function getActiveViewId(listId) {
    const row = await db.meta.get('activeView:' + listId);
    return row ? row.value : null;
  }

  async function setActiveViewId(listId, viewId) {
    await db.meta.put({ key: 'activeView:' + listId, value: viewId });
  }

  /* A sensible empty grid view to seed the UI with on first run. */
  function defaultGridView(listId) {
    return {
      id: uuid(),
      name: 'All products',
      listId,
      mode: 'grid',
      filters: [],
      sort: [{ field: 'capturedAt', dir: 'desc' }],
      group: null,
      columns: [],
      pivot: null,
      updatedAt: now()
    };
  }

  root.SSViewsRepo = {
    listViews,
    getView,
    createView,
    updateView,
    deleteView,
    getActiveViewId,
    setActiveViewId,
    defaultGridView
  };
})(globalThis);
