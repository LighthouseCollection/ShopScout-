/* =============================================================
   ShopScout — Local database (IndexedDB via Dexie)
   This is the single source of truth for product data.
   No server. No cloud. No chrome.storage.local for products.
   chrome.storage.local is still used for settings/AI config only.

   Loaded as classic <script> after vendor/dexie.min.js.
   Exposes window.SSDB.
   ============================================================= */
(function initShopScoutDB(root) {
  if (!root.Dexie) {
    throw new Error('SSDB: vendor/dexie.min.js must load before data/db.js');
  }

  const Dexie = root.Dexie;
  const db = new Dexie('shopscout');

  /* ===== Schema v1 =====
     product_lists: a named collection. id is a uuid.
     products:      a captured listing, linked to a list by listId.
     views:         a saved view config (filters/sort/grouping/columns/mode).
     meta:          singleton rows for migration state, settings flags, etc. */
  db.version(1).stores({
    product_lists: 'id, name, createdAt, updatedAt',
    products:      'id, listId, source, brand, manufacturer, category, [listId+capturedAt], capturedAt, updatedAt, url',
    views:         'id, name, listId, mode, updatedAt',
    meta:          'key'
  });

  /* Lightweight uuid — IndexedDB key only, not a security primitive. */
  function uuid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    const r = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
    return `${r()}${r()}-${r()}-${r()}-${r()}-${r()}${r()}${r()}`;
  }

  function now() { return Date.now(); }

  root.SSDB = { db, uuid, now, Dexie };
})(globalThis);
