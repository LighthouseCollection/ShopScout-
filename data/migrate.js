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

  /* -------------------------------------------------------------
     Normalization v2 backfill (per normalization/SPEC.md).
     One-shot pass over every stored product: if it's missing
     flat.specsNormalized OR any spec entry lacks a .normalized
     envelope, compute one from the bare string via
     ShopScoutNormalize.field() and write it back. Idempotent --
     records "normalizeV2AppliedAt" in meta so subsequent bootstraps
     are a no-op. Failing safely: any single product's error is
     logged and skipped; the marker still gets written so the pass
     doesn't run every load.
     ------------------------------------------------------------- */
  async function normalizeV2Once() {
    const marker = await db.meta.get('normalizeV2AppliedAt');
    if (marker) return { migrated: false, reason: 'already-normalized' };
    const N = root.ShopScoutNormalize;
    if (!N || typeof N.field !== 'function') {
      /* Normalization scripts didn't load. Don't set the marker --
         next bootstrap can try again. */
      return { migrated: false, reason: 'normalizer-unavailable' };
    }

    let scanned = 0;
    let updated = 0;
    let errors = 0;

    await db.transaction('rw', db.products, db.meta, async () => {
      const products = await db.products.toArray();
      for (const product of products) {
        scanned += 1;
        try {
          const needsUpdate = applyNormalizedEnvelope(product, N);
          if (needsUpdate) {
            await db.products.put(product);
            updated += 1;
          }
        } catch (err) {
          errors += 1;
          console.warn('normalizeV2Once: product failed', product && product.id, err);
        }
      }
      await db.meta.put({ key: 'normalizeV2AppliedAt', value: now() });
    });

    return { migrated: true, scanned, updated, errors };
  }

  /* Return true if `product` was mutated in place (needs a write-back).
     Fills flat.specsNormalized from flat.specs, and _spec.specs[key].normalized
     inside _spec if present. Skips fields already carrying an envelope. */
  function applyNormalizedEnvelope(product, N) {
    let mutated = false;
    if (product.specs && typeof product.specs === 'object') {
      if (!product.specsNormalized || typeof product.specsNormalized !== 'object') {
        product.specsNormalized = {};
        mutated = true;
      }
      for (const [fieldName, rawValue] of Object.entries(product.specs)) {
        if (product.specsNormalized[fieldName]) continue;
        const rawString = typeof rawValue === 'string' ? rawValue : (rawValue != null ? String(rawValue) : '');
        if (!rawString) continue;
        const envelope = N.field(fieldName, rawString);
        if (envelope && envelope.canonical != null) {
          product.specsNormalized[fieldName] = envelope;
          mutated = true;
        }
      }
    }
    if (product._spec && product._spec.specs && typeof product._spec.specs === 'object') {
      for (const [fieldName, entry] of Object.entries(product._spec.specs)) {
        if (!entry || typeof entry !== 'object') continue;
        if (entry.normalized) continue;
        const rawString = entry.rawValue != null ? String(entry.rawValue) : '';
        if (!rawString) continue;
        const envelope = N.field(fieldName, rawString);
        if (envelope && envelope.canonical != null) {
          entry.normalized = envelope;
          mutated = true;
        }
      }
    }
    return mutated;
  }

  root.SSMigrate = { migrateOnce, normalizeV2Once, _applyNormalizedEnvelope: applyNormalizedEnvelope };
})(globalThis);
