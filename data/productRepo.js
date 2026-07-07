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
  const State = root.ShopScoutState || {};
  const lockManager = State.createLockManager ? State.createLockManager() : null;

  function listLock(listId) {
    if (State.Actions && typeof State.Actions.listLock === 'function') return State.Actions.listLock(listId);
    return listId ? 'list:' + listId : null;
  }

  async function withListLock(listId, task) {
    const lockKey = listLock(listId);
    if (lockKey && lockManager && typeof lockManager.runWithLock === 'function') {
      return lockManager.runWithLock(lockKey, task);
    }
    return task();
  }

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
  function normalizeRevision(value) {
    const n = Number(value);
    return isFinite(n) && n > 0 ? Math.floor(n) : 1;
  }

  function normalizeIncoming(p, listId) {
    const ts = now();
    return Object.assign({}, p, normalizedAttributePatch(p), {
      id: p.id || uuid(),
      listId,
      capturedAt: p.capturedAt || ts,
      updatedAt: ts,
      _revision: normalizeRevision(p._revision)
    });
  }

  function normalizedAttributePatch(product) {
    const normalizer = root.ShopScoutAttributeNormalization;
    if (!normalizer || typeof normalizer.normalizeProductAttributes !== 'function') return {};
    const entries = normalizer.normalizeProductAttributes(product);
    if (!entries.length) return {};
    const byField = Object.create(null);
    for (const entry of entries) {
      if (!entry || !entry.field) continue;
      byField[entry.field] = {
        rawField: entry.rawField,
        raw: entry.raw,
        normalized: entry.normalized,
        confidence: entry.confidence,
        rule: entry.rule
      };
    }
    return { _normalizedAttributes: byField };
  }

  async function addProduct(listId, product) {
    return withListLock(listId, async () => {
      const rec = normalizeIncoming(product, listId);
      await db.products.add(rec);
      return rec;
    });
  }

  async function addProducts(listId, products) {
    return withListLock(listId, async () => {
      const recs = products.map(p => normalizeIncoming(p, listId));
      await db.products.bulkAdd(recs);
      return recs;
    });
  }

  function cleanPatch(patch) {
    const next = Object.assign({}, patch || {});
    delete next.id;
    delete next.listId;
    delete next._revision;
    delete next.updatedAt;
    delete next.rowSelect;
    delete next.rowActions;
    delete next._ssRanks;
    delete next._rankCalls;
    for (const key of Object.keys(next)) {
      if (key.startsWith('spec:')) delete next[key];
    }
    return next;
  }

  function revisionConflict(product, baseRevision) {
    return baseRevision != null && normalizeRevision(product && product._revision) > Number(baseRevision);
  }

  async function updateProduct(id, patch, options) {
    const opts = options || {};
    const current = await db.products.get(id);
    if (!current) return { ok: false, reason: 'missing-product' };
    const listId = opts.listId || current.listId || patch && patch.listId || '';
    return withListLock(listId, async () => {
      const fresh = await db.products.get(id);
      if (!fresh) return { ok: false, reason: 'missing-product' };
      if (opts.listId && fresh.listId && opts.listId !== fresh.listId) {
        return { ok: false, reason: 'list-mismatch', product: fresh };
      }
      if (revisionConflict(fresh, opts.baseRevision)) {
        return {
          ok: false,
          reason: 'revision-conflict',
          product: fresh,
          conflict: {
            productId: id,
            listId: fresh.listId || listId,
            baseRevision: opts.baseRevision,
            currentRevision: normalizeRevision(fresh._revision),
            source: opts.source || 'update'
          }
        };
      }
      const revision = normalizeRevision(fresh._revision) + 1;
      const next = Object.assign({}, cleanPatch(patch), {
        updatedAt: now(),
        _revision: revision,
        _lastMutationSource: opts.source || 'update'
      });
      await db.products.update(id, next);
      return { ok: true, product: Object.assign({}, fresh, next) };
    });
  }

  async function removeProduct(id, options) {
    const current = await db.products.get(id);
    const listId = options && options.listId || current && current.listId || '';
    return withListLock(listId, async () => {
      await db.products.delete(id);
      return { ok: true, product: current || null };
    });
  }

  async function removeProducts(ids, options) {
    const input = Array.isArray(ids) ? ids : [];
    const opts = options || {};
    if (opts.listId) {
      return withListLock(opts.listId, async () => {
        await db.products.bulkDelete(input);
        return { ok: true, removed: input.length };
      });
    }
    const byList = new Map();
    for (const id of input) {
      const product = await db.products.get(id);
      const listId = product && product.listId || '';
      if (!byList.has(listId)) byList.set(listId, []);
      byList.get(listId).push(id);
    }
    let removed = 0;
    for (const [listId, groupIds] of byList.entries()) {
      await withListLock(listId, async () => {
        await db.products.bulkDelete(groupIds);
        removed += groupIds.length;
      });
    }
    return { ok: true, removed };
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
