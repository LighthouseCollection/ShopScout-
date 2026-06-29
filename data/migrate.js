/* =============================================================
   ShopScout — Migration from chrome.storage.local to IndexedDB
   One-shot. Idempotent (records "migratedFromStorageAt" in meta).
   Called once on extension bootstrap, before any UI renders.
   ============================================================= */
(function initMigrate(root) {
  const SSDB = root.SSDB;
  if (!SSDB) throw new Error('migrate: data/db.js must load first');
  const SSProductRepo = root.SSProductRepo;
  if (!SSProductRepo) throw new Error('migrate: data/productRepo.js must load first');

  const { db, uuid, now } = SSDB;
  const STORAGE_KEY = 'shopscout_data';

  async function migrateOnce() {
    const marker = await db.meta.get('migratedFromStorageAt');
    if (marker) return { migrated: false, reason: 'already-migrated' };

    const chrome = globalThis.browser || globalThis.chrome;
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      await db.meta.put({ key: 'migratedFromStorageAt', value: now() });
      return { migrated: false, reason: 'no-chrome-storage' };
    }

    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const data = stored[STORAGE_KEY];
    if (!data || !data.lists || !Object.keys(data.lists).length) {
      await db.meta.put({ key: 'migratedFromStorageAt', value: now() });
      await SSProductRepo.ensureDefaultList();
      return { migrated: false, reason: 'no-prior-data' };
    }

    let listCount = 0;
    let productCount = 0;
    let activeListId = null;

    await db.transaction('rw', db.product_lists, db.products, db.meta, async () => {
      for (const [name, products] of Object.entries(data.lists)) {
        const listId = uuid();
        const ts = now();
        await db.product_lists.add({ id: listId, name, createdAt: ts, updatedAt: ts });
        listCount++;
        if (name === data.activeList) activeListId = listId;

        if (Array.isArray(products) && products.length) {
          const recs = products.map(p => Object.assign({}, p, {
            id: p.id || uuid(),
            listId,
            capturedAt: p.capturedAt || ts,
            updatedAt: ts
          }));
          await db.products.bulkAdd(recs);
          productCount += recs.length;
        }
      }

      if (!activeListId) {
        const first = await db.product_lists.orderBy('createdAt').first();
        if (first) activeListId = first.id;
      }
      if (activeListId) await db.meta.put({ key: 'activeListId', value: activeListId });
      await db.meta.put({ key: 'migratedFromStorageAt', value: now() });
    });

    return { migrated: true, lists: listCount, products: productCount };
  }

  root.SSMigrate = { migrateOnce };
})(globalThis);
