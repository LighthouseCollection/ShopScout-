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

  async function ensureNormalizationReady() {
    const canon = root.SSCanonical;
    if (!canon || typeof canon.ready !== 'function') return;
    if (typeof canon.isReady === 'function' && canon.isReady()) return;
    try { await canon.ready(); }
    catch (err) { console.warn('productRepo: taxonomy normalization unavailable', err); }
  }

  async function ensureGeneratedPacksReady() {
    const packs = root.ShopScoutGeneratedPacks;
    if (!packs || typeof packs.ensureBundledDataLoaded !== 'function') return;
    try { await packs.ensureBundledDataLoaded(); }
    catch (err) { console.warn('productRepo: generated normalization packs unavailable', err); }
  }

  function userRulesKey(listId) {
    return 'normalizationUserRules:' + String(listId || '');
  }

  async function getUserNormalizationRules(listId) {
    const userRules = root.ShopScoutUserNormalizationRules;
    const empty = userRules && typeof userRules.emptyRuleSet === 'function'
      ? userRules.emptyRuleSet()
      : { fieldAliases: {}, canonicalFields: {}, enums: {}, ignored: [] };
    if (!listId) return empty;
    const row = await db.meta.get(userRulesKey(listId));
    const rules = row && row.value && typeof row.value === 'object' ? row.value : empty;
    return userRules && typeof userRules.normalizeRuleSet === 'function'
      ? userRules.normalizeRuleSet(rules)
      : rules;
  }

  async function loadUserNormalizationRules(listId) {
    const userRules = root.ShopScoutUserNormalizationRules;
    if (!userRules || typeof userRules.loadUserRules !== 'function') return;
    userRules.loadUserRules(await getUserNormalizationRules(listId));
  }

  async function saveUserNormalizationRules(listId, rules) {
    const userRules = root.ShopScoutUserNormalizationRules;
    const value = userRules && typeof userRules.normalizeRuleSet === 'function'
      ? userRules.normalizeRuleSet(rules)
      : rules;
    await db.meta.put({ key: userRulesKey(listId), value });
    await loadUserNormalizationRules(listId);
    return value;
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
    await db.product_lists.add({
      id,
      name: 'My Products',
      createdAt: ts,
      updatedAt: ts,
      primaryVerticalId: '',
      primaryVerticalSource: '',
      primaryVerticalConfidence: 0,
      verticalsSeen: [],
      verticalSkipped: false
    });
    await setActiveListId(id);
    return id;
  }

  async function listLists() {
    return db.product_lists.orderBy('createdAt').toArray();
  }

  async function createList(name) {
    const id = uuid();
    const ts = now();
    await db.product_lists.add({
      id,
      name: String(name || 'Untitled'),
      createdAt: ts,
      updatedAt: ts,
      primaryVerticalId: '',
      primaryVerticalSource: '',
      primaryVerticalConfidence: 0,
      verticalsSeen: [],
      verticalSkipped: false
    });
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

  function primaryVerticalId(list) {
    return String(list?.primaryVerticalId || list?.verticalId || '').trim();
  }

  function primaryVerticalSource(list) {
    return String(list?.primaryVerticalSource || list?.verticalSource || '').trim();
  }

  function primaryVerticalConfidence(list) {
    return Number(list?.primaryVerticalConfidence ?? list?.verticalConfidence ?? 0) || 0;
  }

  function normalizeVerticalsSeen(list) {
    const values = Array.isArray(list?.verticalsSeen) ? list.verticalsSeen : [];
    const legacy = primaryVerticalId(list);
    return Array.from(new Set([...values, legacy].map(value => String(value || '').trim()).filter(Boolean)));
  }

  function addUnique(values, value) {
    const next = Array.isArray(values) ? values.slice() : [];
    const id = String(value || '').trim();
    if (id && !next.includes(id)) next.push(id);
    return next;
  }

  async function setListVertical(id, vertical) {
    const next = vertical || {};
    const list = id ? await db.product_lists.get(id) : null;
    const existingSeen = normalizeVerticalsSeen(list);
    const verticalId = String(next.primaryVerticalId || next.verticalId || next.id || '').trim();
    const source = String(next.source || next.primaryVerticalSource || next.verticalSource || (verticalId ? 'manual' : 'bundled-defaults')).trim();
    const skipped = Boolean(next.skip || next.verticalSkipped || (!verticalId && source === 'bundled-defaults'));
    const seen = verticalId ? addUnique(existingSeen, verticalId) : existingSeen;
    const patch = {
      primaryVerticalId: verticalId,
      primaryVerticalSource: source,
      primaryVerticalConfidence: Number(next.confidence ?? next.primaryVerticalConfidence ?? next.verticalConfidence ?? (verticalId ? 1 : 0)) || 0,
      verticalsSeen: skipped && !verticalId ? [] : seen,
      verticalSkipped: skipped && !verticalId,
      updatedAt: now()
    };
    await db.product_lists.update(id, patch);
    return patch;
  }

  /* ---------- products ---------- */
  function normalizeRevision(value) {
    const n = Number(value);
    return isFinite(n) && n > 0 ? Math.floor(n) : 1;
  }

  function verticalContext(detection) {
    if (!detection || !detection.verticalId) return null;
    const info = root.ShopScoutGeneratedPacks && typeof root.ShopScoutGeneratedPacks.getVerticalInfo === 'function'
      ? root.ShopScoutGeneratedPacks.getVerticalInfo(detection.verticalId)
      : null;
    return {
      id: detection.verticalId,
      displayName: info?.displayName || detection.verticalId,
      confidence: Number(detection.confidence) || 0,
      source: detection.source || 'unknown',
      categoryId: detection.categoryId || ''
    };
  }

  function taxonomyContextPatch(product, detection) {
    const taxonomy = root.ShopScoutTaxonomyNormalization;
    const patch = taxonomy && typeof taxonomy.taxonomyPatchForProduct === 'function'
      ? taxonomy.taxonomyPatchForProduct(product)
      : {};
    const vertical = verticalContext(detection);
    if (!vertical) return patch;
    const context = Object.assign({}, patch._normalizationContext || {}, { vertical });
    return Object.assign({}, patch, { _normalizationContext: context });
  }

  function normalizeIncoming(p, listId, detection) {
    const ts = now();
    const contextPatch = taxonomyContextPatch(p, detection);
    const productWithContext = Object.assign({}, p, contextPatch);
    return Object.assign({}, p, contextPatch, normalizedAttributePatch(productWithContext), {
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
      const record = {
        rawField: entry.rawField,
        raw: entry.raw,
        normalized: entry.normalized,
        confidence: entry.confidence,
        rule: entry.rule
      };
      if (entry.fieldRule) record.fieldRule = entry.fieldRule;
      if (entry.fieldSource) record.fieldSource = entry.fieldSource;
      byField[entry.field] = record;
    }
    return { _normalizedAttributes: byField };
  }

  function detectionVerticalId(detection) {
    return String(detection?.verticalId || '').trim();
  }

  function detectionAt(plan, index) {
    return plan?.perProductDetections?.[index] || null;
  }

  function uniqueVerticalIds(plan) {
    const ids = new Set();
    if (plan?.primaryDetection?.verticalId) ids.add(plan.primaryDetection.verticalId);
    for (const detection of (plan?.perProductDetections || [])) {
      if (detection?.verticalId) ids.add(detection.verticalId);
    }
    return Array.from(ids);
  }

  async function detectListVertical(listId, incomingProducts) {
    await ensureGeneratedPacksReady();
    const packs = root.ShopScoutGeneratedPacks;
    if (!packs || typeof packs.detectVerticalForProducts !== 'function') return [];
    const list = listId ? await db.product_lists.get(listId) : null;
    if (list?.verticalSkipped) return [];
    const rows = Array.isArray(incomingProducts) ? incomingProducts : [];
    const detections = rows.map(product => {
      const candidate = Object.assign({}, product, taxonomyContextPatch(product));
      const detection = packs.detectVerticalForProducts([candidate]);
      return detection && detection.verticalId ? detection : null;
    });
    if (listId && list) {
      const currentPrimary = primaryVerticalId(list);
      let nextPrimary = currentPrimary;
      let nextSource = primaryVerticalSource(list);
      let nextConfidence = primaryVerticalConfidence(list);
      let seen = normalizeVerticalsSeen(list);
      for (const detection of detections) {
        const id = detectionVerticalId(detection);
        if (!id) continue;
        seen = addUnique(seen, id);
        if (!nextPrimary) {
          nextPrimary = id;
          nextSource = detection.source || 'auto-detected';
          nextConfidence = Number(detection.confidence) || 0;
        }
      }
      await db.product_lists.update(listId, {
        primaryVerticalId: nextPrimary,
        primaryVerticalSource: nextSource,
        primaryVerticalConfidence: nextConfidence,
        verticalsSeen: seen,
        verticalSkipped: false,
        updatedAt: now()
      });
    }
    return detections;
  }

  async function prepareNormalizationForList(listId, incomingProducts) {
    await ensureNormalizationReady();
    await loadUserNormalizationRules(listId);
    const perProductDetections = await detectListVertical(listId, incomingProducts);
    const list = listId ? await db.product_lists.get(listId) : null;
    const primaryId = primaryVerticalId(list);
    const primaryDetection = primaryId ? {
      verticalId: primaryId,
      confidence: primaryVerticalConfidence(list) || 1,
      source: primaryVerticalSource(list) || 'list-setting',
      categoryId: ''
    } : null;
    const plan = { primaryDetection, perProductDetections };
    if (root.ShopScoutGeneratedPacks?.ensureVerticalPackLoaded) {
      await Promise.all(uniqueVerticalIds(plan).map(id => root.ShopScoutGeneratedPacks.ensureVerticalPackLoaded(id)));
    }
    return plan;
  }

  async function addProduct(listId, product) {
    return withListLock(listId, async () => {
      const plan = await prepareNormalizationForList(listId, [product]);
      const rec = normalizeIncoming(product, listId, detectionAt(plan, 0));
      await db.products.add(rec);
      return rec;
    });
  }

  async function addProducts(listId, products) {
    return withListLock(listId, async () => {
      const plan = await prepareNormalizationForList(listId, products);
      const recs = products.map((p, index) => normalizeIncoming(p, listId, detectionAt(plan, index)));
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

  async function findDuplicateCandidates(listId, options) {
    const matcher = root.ShopScoutMatching;
    if (!matcher || typeof matcher.detectDuplicateCandidates !== 'function') return [];
    const rows = await listProducts(listId);
    const plan = await prepareNormalizationForList(listId, rows);
    let packSignals = 0;
    if (root.ShopScoutGeneratedPacks?.ensureVerticalPackLoaded
        && typeof matcher.loadVerticalPackSignals === 'function') {
      for (const verticalId of uniqueVerticalIds(plan)) {
        const packResult = await root.ShopScoutGeneratedPacks.ensureVerticalPackLoaded(verticalId);
        if (packResult?.ok && packResult.pack) {
          packSignals += matcher.loadVerticalPackSignals(packResult.pack) || 0;
        }
      }
    }
    if (!packSignals && typeof matcher.ensureEsciSubstitutesLoaded === 'function') {
      await matcher.ensureEsciSubstitutesLoaded();
    }
    const decisions = await getDuplicateCandidateDecisions(listId);
    return matcher.detectDuplicateCandidates(rows, options).map(candidate => Object.assign({}, candidate, {
      reviewDecision: decisions[candidate.candidateKey] || ''
    }));
  }

  function duplicateDecisionsKey(listId) {
    return 'duplicateDecisions:' + String(listId || '');
  }

  async function getDuplicateCandidateDecisions(listId) {
    const row = await db.meta.get(duplicateDecisionsKey(listId));
    return row && row.value && typeof row.value === 'object' ? Object.assign({}, row.value) : {};
  }

  async function setDuplicateCandidateDecision(listId, candidateKey, decision) {
    const key = String(candidateKey || '').trim();
    const allowed = new Set(['', 'same-product', 'not-duplicate']);
    const value = allowed.has(decision) ? decision : '';
    if (!listId || !key) return { ok: false, reason: 'missing-key' };
    return withListLock(listId, async () => {
      const current = await getDuplicateCandidateDecisions(listId);
      if (value) current[key] = value;
      else delete current[key];
      await db.meta.put({ key: duplicateDecisionsKey(listId), value: current });
      return { ok: true, candidateKey: key, decision: value };
    });
  }

  async function rebuildNormalizationForList(listId) {
    const rows = await listProducts(listId);
    const plan = await prepareNormalizationForList(listId, rows);
    let updated = 0;
    await withListLock(listId, async () => {
      for (let index = 0; index < rows.length; index++) {
        const product = rows[index];
        const contextPatch = taxonomyContextPatch(product, detectionAt(plan, index));
        const patch = Object.assign({}, contextPatch, normalizedAttributePatch(Object.assign({}, product, contextPatch)));
        if (!Object.keys(patch).length) continue;
        const currentAttrs = JSON.stringify(product._normalizedAttributes || null);
        const nextAttrs = JSON.stringify(patch._normalizedAttributes || null);
        const currentCtx = JSON.stringify(product._normalizationContext || null);
        const nextCtx = JSON.stringify(patch._normalizationContext || null);
        if (currentAttrs === nextAttrs && currentCtx === nextCtx) continue;
        await db.products.update(product.id, Object.assign({}, patch, { updatedAt: now() }));
        updated++;
      }
    });
    return { ok: true, checked: rows.length, updated };
  }

  function reviewItemKey(item) {
    const reviewer = root.ShopScoutNormalizationReview;
    if (reviewer && typeof reviewer.reviewItemKey === 'function') return reviewer.reviewItemKey(item);
    return [
      item && item.productId || '',
      item && item.rawField || '',
      item && item.field || '',
      item && item.raw || '',
      item && item.normalized || ''
    ].map(value => String(value || '').trim().toLowerCase()).join('|');
  }

  async function saveNormalizationReviewDecision(listId, request) {
    const action = String(request && request.action || '').trim();
    const item = request && request.item || {};
    if (!listId) return { ok: false, reason: 'missing-list' };
    const userRules = root.ShopScoutUserNormalizationRules;
    if (!userRules || typeof userRules.mergeRuleSets !== 'function') {
      return { ok: false, reason: 'missing-user-rules' };
    }
    const result = await withListLock(listId, async () => {
      const current = await getUserNormalizationRules(listId);
      let next = current;
      let reviewKey = reviewItemKey(item);
      if (action === 'accept-alias') {
        if (typeof userRules.buildUserRulePatch !== 'function') {
          return { ok: false, reason: 'missing-rule-builder' };
        }
        next = userRules.mergeRuleSets(current, userRules.buildUserRulePatch(item));
      } else if (action === 'ignore') {
        next = userRules.mergeRuleSets(current, { ignored: [reviewKey] });
      } else {
        return { ok: false, reason: 'unsupported-action' };
      }
      const saved = await saveUserNormalizationRules(listId, next);
      return { ok: true, action, reviewKey, rules: saved };
    });
    if (result?.ok) await rebuildNormalizationForList(listId);
    return result;
  }

  async function deleteUserNormalizationRule(listId, item) {
    if (!listId) return { ok: false, reason: 'missing-list' };
    const userRules = root.ShopScoutUserNormalizationRules;
    if (!userRules || typeof userRules.removeUserRulePatch !== 'function') {
      return { ok: false, reason: 'missing-user-rules' };
    }
    const result = await withListLock(listId, async () => {
      const current = await getUserNormalizationRules(listId);
      const saved = await saveUserNormalizationRules(listId, userRules.removeUserRulePatch(current, item || {}));
      return { ok: true, rules: saved };
    });
    if (result?.ok) await rebuildNormalizationForList(listId);
    return result;
  }

  async function updateUserNormalizationRule(listId, fromItem, toItem) {
    if (!listId) return { ok: false, reason: 'missing-list' };
    const userRules = root.ShopScoutUserNormalizationRules;
    if (!userRules || typeof userRules.replaceUserRulePatch !== 'function') {
      return { ok: false, reason: 'missing-user-rules' };
    }
    const result = await withListLock(listId, async () => {
      const current = await getUserNormalizationRules(listId);
      const saved = await saveUserNormalizationRules(listId, userRules.replaceUserRulePatch(current, fromItem || {}, toItem || {}));
      return { ok: true, rules: saved };
    });
    if (result?.ok) await rebuildNormalizationForList(listId);
    return result;
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
    setListVertical,
    detectListVertical,
    addProduct,
    addProducts,
    updateProduct,
    removeProduct,
    removeProducts,
    getProduct,
    listProducts,
    countProducts,
    query,
    findDuplicateCandidates,
    getDuplicateCandidateDecisions,
    setDuplicateCandidateDecision,
    getUserNormalizationRules,
    saveUserNormalizationRules,
    loadUserNormalizationRules,
    saveNormalizationReviewDecision,
    deleteUserNormalizationRule,
    updateUserNormalizationRule,
    rebuildNormalizationForList,
    ensureNormalizationReady,
    normalizeProductForStorage: normalizeIncoming
  };
})(globalThis);
