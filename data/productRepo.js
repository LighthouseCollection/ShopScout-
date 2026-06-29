/* =============================================================
   ShopScout — productRepo
   Public data API consumed by popup.js, comparison.js, background.js.
   Everything that touches product/list state goes through here.
   Anything reaching past this into raw Dexie is a bug.
   ============================================================= */
(function initProductRepo(root) {
  const SSDB = root.SSDB;
  if (!SSDB) throw new Error('productRepo: data/db.js must load first');
  const { db, uuid, now } = SSDB;

  /* ---------- lists ---------- */
  async function ensureDefaultList() {
    const count = await db.product_lists.count();
    if (count > 0) {
      const active = await getActiveListId();
      if (active && await db.product_lists.get(active)) return active;
      const first = await db.product_lists.orderBy('createdAt').first();
      await setActiveListId(first.id);
      return first.id;
    }
    const id = uuid();
    const ts = now();
    await db.product_lists.add({ id, name: 'My Products', createdAt: ts, updatedAt: ts });
    await setActiveListId(id);
    return id;
  }

  async function listLists() {
    return db.product_lists.orderBy('createdAt').toArray();
  }

  async function createList(name) {
    const id = uuid();
    const ts = now();
    await db.product_lists.add({ id, name: String(name || 'Untitled'), createdAt: ts, updatedAt: ts });
    return id;
  }

  async function renameList(id, name) {
    await db.product_lists.update(id, { name: String(name || '').trim() || 'Untitled', updatedAt: now() });
  }

  async function deleteList(id) {
    await db.transaction('rw', db.product_lists, db.products, db.views, async () => {
      await db.products.where('listId').equals(id).delete();
      await db.views.where('listId').equals(id).delete();
      await db.product_lists.delete(id);
    });
    const remaining = await db.product_lists.orderBy('createdAt').first();
    if (remaining) await setActiveListId(remaining.id);
    else await ensureDefaultList();
  }

  async function getActiveListId() {
    const row = await db.meta.get('activeListId');
    return row ? row.value : null;
  }

  async function setActiveListId(id) {
    await db.meta.put({ key: 'activeListId', value: id });
  }

  /* ---------- products ---------- */
  function normalizeIncoming(p, listId) {
    const ts = now();
    return Object.assign({}, p, {
      id: p.id || uuid(),
      listId,
      capturedAt: p.capturedAt || ts,
      updatedAt: ts
    });
  }

  async function addProduct(listId, product) {
    const rec = normalizeIncoming(product, listId);
    await db.products.add(rec);
    return rec;
  }

  async function addProducts(listId, products) {
    const ts = now();
    const recs = products.map(p => Object.assign({}, p, {
      id: p.id || uuid(),
      listId,
      capturedAt: p.capturedAt || ts,
      updatedAt: ts
    }));
    await db.products.bulkAdd(recs);
    return recs;
  }

  async function updateProduct(id, patch) {
    await db.products.update(id, Object.assign({}, patch, { updatedAt: now() }));
  }

  async function removeProduct(id) {
    await db.products.delete(id);
  }

  async function removeProducts(ids) {
    await db.products.bulkDelete(ids);
  }

  async function getProduct(id) {
    return db.products.get(id);
  }

  async function listProducts(listId) {
    return db.products.where('listId').equals(listId).sortBy('capturedAt');
  }

  async function countProducts(listId) {
    return db.products.where('listId').equals(listId).count();
  }

  /* ---------- query (filter/sort/group config from a saved view) ---------- */
  /* viewConfig = { filters: [{field, op, value, conj}], sort: [{field, dir}], group: field, search: string } */
  async function query(listId, viewConfig) {
    let rows = await listProducts(listId);
    const cfg = viewConfig || {};

    if (cfg.search) {
      const q = String(cfg.search).toLowerCase();
      rows = rows.filter(r => JSON.stringify(r).toLowerCase().includes(q));
    }

    if (Array.isArray(cfg.filters) && cfg.filters.length) {
      rows = rows.filter(r => evalFilters(r, cfg.filters));
    }

    if (Array.isArray(cfg.sort) && cfg.sort.length) {
      rows.sort((a, b) => compareBySort(a, b, cfg.sort));
    }

    return rows;
  }

  function evalFilters(row, filters) {
    /* Conjunctions: first row has no conj; later rows AND/OR with previous accumulator. */
    let acc = true;
    let started = false;
    for (const f of filters) {
      const match = evalSingle(row, f);
      if (!started) { acc = match; started = true; continue; }
      acc = f.conj === 'or' ? (acc || match) : (acc && match);
    }
    return acc;
  }

  function evalSingle(row, f) {
    const v = row[f.field];
    const target = f.value;
    switch (f.op) {
      case 'eq':       return String(v ?? '') === String(target ?? '');
      case 'neq':      return String(v ?? '') !== String(target ?? '');
      case 'contains': return String(v ?? '').toLowerCase().includes(String(target ?? '').toLowerCase());
      case 'empty':    return v == null || v === '';
      case 'notempty': return v != null && v !== '';
      case 'gt':       return Number(v) > Number(target);
      case 'lt':       return Number(v) < Number(target);
      case 'gte':      return Number(v) >= Number(target);
      case 'lte':      return Number(v) <= Number(target);
      default:         return true;
    }
  }

  function compareBySort(a, b, sorts) {
    for (const s of sorts) {
      const av = a[s.field], bv = b[s.field];
      let cmp;
      if (typeof av === 'number' || typeof bv === 'number') {
        cmp = (Number(av) || 0) - (Number(bv) || 0);
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      }
      if (cmp !== 0) return s.dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  }

  /* ---------- bootstrap ---------- */
  async function init() {
    await ensureDefaultList();
  }

  root.SSProductRepo = {
    init,
    ensureDefaultList,
    listLists,
    createList,
    renameList,
    deleteList,
    getActiveListId,
    setActiveListId,
    addProduct,
    addProducts,
    updateProduct,
    removeProduct,
    removeProducts,
    getProduct,
    listProducts,
    countProducts,
    query
  };
})(globalThis);
