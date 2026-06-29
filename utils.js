var chrome = globalThis.browser || globalThis.chrome;

window.SS = (() => {
  const STORAGE_KEY = 'shopscout_data';

  // --- Storage ---
  // Legacy shape: { lists: { [listName]: Product[] }, activeList: string }
  // chrome.storage.local remains the primary store for backwards compatibility.
  // Every write is mirrored ("write-through") into IndexedDB via SSProductRepo
  // so the new Tabulator/PivotTable views always see fresh data.
  async function getData() {
    const d = await chrome.storage.local.get(STORAGE_KEY);
    const data = d[STORAGE_KEY] || { lists: { 'My Products': [] }, activeList: 'My Products' };
    if (!data.lists || !Object.keys(data.lists).length) return { lists: { 'My Products': [] }, activeList: 'My Products' };
    if (!data.lists[data.activeList]) data.activeList = Object.keys(data.lists)[0];
    return data;
  }
  async function saveData(data) {
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
    try { await mirrorToProductRepo(data); }
    catch (err) { console.warn('SS.saveData: productRepo mirror failed', err); }
  }
  async function getProducts() { const d = await getData(); return d.lists[d.activeList] || []; }
  async function saveProducts(products) { const d = await getData(); d.lists[d.activeList] = products; await saveData(d); }

  /* Mirror the legacy blob into IndexedDB. Replaces lists/products wholesale —
     correct because the legacy code already passes the entire desired state. */
  async function mirrorToProductRepo(legacy) {
    const repo = globalThis.SSProductRepo;
    const ssdb = globalThis.SSDB;
    if (!repo || !ssdb) return; // Dexie not loaded (e.g. background service worker)
    const { db, uuid, now } = ssdb;
    const ts = now();
    /* Track whether we generated any new ids on the chrome.storage side. If we
       did, write the legacy blob back to chrome.storage so subsequent lookups
       against the legacy store match Tabulator's IndexedDB ids. Without this,
       selection / row-actions can't reconcile the two stores. */
    let mutatedLegacy = false;
    await db.transaction('rw', db.product_lists, db.products, db.meta, async () => {
      await db.products.clear();
      await db.product_lists.clear();
      let activeListId = null;
      for (const [name, products] of Object.entries(legacy.lists || {})) {
        const listId = uuid();
        await db.product_lists.add({ id: listId, name, createdAt: ts, updatedAt: ts });
        if (name === legacy.activeList) activeListId = listId;
        if (Array.isArray(products) && products.length) {
          const recs = [];
          for (const p of products) {
            if (!p.id) { p.id = uuid(); mutatedLegacy = true; }
            recs.push(Object.assign({}, p, {
              listId,
              capturedAt: p.capturedAt || ts,
              updatedAt: ts
            }));
          }
          await db.products.bulkAdd(recs);
        }
      }
      if (activeListId) await db.meta.put({ key: 'activeListId', value: activeListId });
    });
    if (mutatedLegacy) {
      try { await chrome.storage.local.set({ [STORAGE_KEY]: legacy }); }
      catch (err) { console.warn('SS.mirrorToProductRepo: legacy write-back failed', err); }
    }
  }

  /* Idempotent bootstrap — call once per page on load.
     Imports any prior chrome.storage.local data into IndexedDB AND
     then RE-MIRRORS the current chrome.storage.local blob so the
     dashboard always shows the latest state. Without the second step,
     captures made by the background service worker (popup → "Add
     Products from Open Tabs", FAB, add-by-URL) never reach IndexedDB
     because migrateOnce is a one-shot — and dashboard reads from
     IndexedDB. */
  async function bootstrapDataLayer() {
    const migrate = globalThis.SSMigrate;
    if (migrate && migrate.migrateOnce) {
      try { await migrate.migrateOnce(); }
      catch (err) { console.warn('SSMigrate failed', err); }
    }
    /* Reconcile current chrome.storage.local → IndexedDB. mirrorToProductRepo
       does a clear-and-rebuild, so it's safe to run on every page load. */
    try {
      const data = await getData();
      if (data) await mirrorToProductRepo(data);
    } catch (err) { console.warn('SS.bootstrapDataLayer: reconcile failed', err); }
  }

  // --- Escaping ---
  function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
  function escAttr(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function sanitizeUrl(value, fallback = '') {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    try {
      const url = new URL(raw, location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : fallback;
    } catch {
      return fallback;
    }
  }

  /* Reduce a marketplace URL to its minimal canonical form. Strips
       - the title slug + /ref= breadcrumb on Amazon (`/dp/{ASIN}` only),
       - the title slug on eBay (`/itm/{ID}`) and Walmart (`/ip/{ID}`),
       - every query parameter on other hosts,
       - the hash everywhere.
     Used both at capture time (so the stored URL is clean) and by the
     Copy export. Returns the input unchanged if it can't be parsed. */
  function canonicalizeProductUrl(href) {
    if (!href) return '';
    try {
      const u = new URL(String(href));
      u.hash = '';
      const host = u.hostname.toLowerCase();
      const path = u.pathname;
      if (/(^|\.)amazon\./.test(host)) {
        const m = path.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
        if (m) return u.protocol + '//' + host + '/dp/' + m[1].toUpperCase();
      }
      if (/(^|\.)ebay\./.test(host)) {
        const m = path.match(/\/(?:itm|i)\/(?:[^/]+\/)?(\d{8,14})/);
        if (m) return u.protocol + '//' + host + '/itm/' + m[1];
      }
      if (/(^|\.)walmart\./.test(host)) {
        const m = path.match(/\/ip\/(?:[^/]+\/)?(\d{6,})/);
        if (m) return u.protocol + '//' + host + '/ip/' + m[1];
      }
      if (/(^|\.)target\.com$/.test(host)) {
        const m = path.match(/\/p\/.*?\/A-(\d+)/);
        if (m) return u.protocol + '//' + host + '/p/A-' + m[1];
      }
      if (/(^|\.)bestbuy\./.test(host)) {
        const m = path.match(/(\d+)\.p$/);
        if (m) return u.protocol + '//' + host + path.replace(/\?.*$/, '');
      }
      for (const k of [...u.searchParams.keys()]) u.searchParams.delete(k);
      return u.toString().replace(/\?$/, '');
    } catch { return href; }
  }

  function sanitizeProductDescription(value, source = '') {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    const lower = text.toLowerCase();
    const clickHereCount = (lower.match(/\bclick here\b/g) || []).length;
    const carouselMarkers = [
      /\bprevious page\b.*\bnext page\b/i,
      /\bnext page\b.*\bprevious page\b/i,
      /\bmore .{0,50} from\b/i,
      /\bkeep in fashion\b/i
    ];
    const isAmazon = /amazon/i.test(source || '');
    if ((isAmazon || lower.includes('product description')) && clickHereCount >= 2) return '';
    if (carouselMarkers.some(pattern => pattern.test(text)) && clickHereCount >= 1) return '';
    const cleaned = text
      .replace(/\bProduct description\b/gi, '')
      .replace(/\bPrevious page\b/gi, '')
      .replace(/\bNext page\b/gi, '')
      .replace(/\bClick Here\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length < 20) return '';
    if ((cleaned.match(/\bClick Here\b/gi) || []).length >= 2) return '';
    return cleaned.substring(0, 2000);
  }

  function isSafeHttpUrl(value) {
    return !!sanitizeUrl(value);
  }

  // --- Price ---
  function parsePrice(s) { const m = String(s || '').replace(/[^\d.]/g, ''); return parseFloat(m) || 99999; }

  // --- Ratings ---
  function normalizeReviewCount(value) {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    const cleaned = text
      .replace(/[()]/g, ' ')
      .replace(/\b(customer|global|verified|ratings?|reviews?|votes?)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const match = cleaned.match(/\d[\d,]*(?:\.\d+)?\s*[kKmM]?\+?/);
    return match ? match[0].replace(/\s+/g, '') : '';
  }

  function normalizeRatingValue(value) {
    const match = String(value ?? '').match(/\d+(?:\.\d+)?/);
    return match ? match[0] : '';
  }

  function formatRatingDisplay(rating, reviewCount) {
    const ratingText = normalizeRatingValue(rating);
    if (!ratingText) return '';
    const countText = normalizeReviewCount(reviewCount);
    return countText ? `${ratingText} (${countText})` : ratingText;
  }

  // --- Specification normalization ---
  const SPEC_KEY_ALIASES = new Map([
    ['dpi', { id: 'dpi', label: 'DPI' }],
    ['dotsperinch', { id: 'dpi', label: 'DPI' }],
    ['dotperinch', { id: 'dpi', label: 'DPI' }],
    ['inputvoltage', { id: 'input_voltage', label: 'Input voltage' }],
    ['voltageinput', { id: 'input_voltage', label: 'Input voltage' }],
    ['outputvoltage', { id: 'output_voltage', label: 'Output voltage' }],
    ['voltageoutput', { id: 'output_voltage', label: 'Output voltage' }],
    ['voltage', { id: 'voltage', label: 'Voltage' }],
    ['wattage', { id: 'wattage', label: 'Wattage' }],
    ['watts', { id: 'wattage', label: 'Wattage' }],
    ['power', { id: 'wattage', label: 'Wattage' }],
    ['amperage', { id: 'amperage', label: 'Amperage' }],
    ['current', { id: 'amperage', label: 'Amperage' }],
    ['outputcurrent', { id: 'output_current', label: 'Output current' }],
    ['inputcurrent', { id: 'input_current', label: 'Input current' }],
    ['batterycapacity', { id: 'battery_capacity', label: 'Battery capacity' }],
    ['capacity', { id: 'capacity', label: 'Capacity' }],
    ['resolution', { id: 'resolution', label: 'Resolution' }],
    ['videoresolution', { id: 'video_resolution', label: 'Video resolution' }],
    ['screensize', { id: 'screen_size', label: 'Screen size' }],
    ['displaysize', { id: 'screen_size', label: 'Screen size' }]
  ]);

  function normalizeSpecKeyToken(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/\bdots?\s*\/?\s*inch\b/g, 'dots per inch')
      .replace(/\bdots?\s+per\s+inch\b/g, 'dots per inch')
      .replace(/[^a-z0-9]+/g, '')
      .trim();
  }

  function readableSpecLabel(value) {
    const raw = String(value || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    const acronym = raw.match(/^[A-Z0-9]{2,8}$/);
    if (acronym) return raw.toUpperCase();
    const lower = raw.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  function normalizeSpecKeyLabel(value) {
    /* Prefer SSCanonical when loaded — it covers Shopify attribute names +
       the abbreviation table. Falls back to the local alias table. */
    if (globalThis.SSCanonical && globalThis.SSCanonical.isReady && globalThis.SSCanonical.isReady()) {
      const canonical = globalThis.SSCanonical.canonicalKey(value);
      if (canonical) {
        const token = normalizeSpecKeyToken(canonical);
        return { id: token || canonical.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''), label: canonical };
      }
    }
    const token = normalizeSpecKeyToken(value);
    if (SPEC_KEY_ALIASES.has(token)) return { ...SPEC_KEY_ALIASES.get(token) };
    return {
      id: token || String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
      label: readableSpecLabel(value)
    };
  }

  function normalizeSpecValue(value) {
    /* If SSCanonical is ready and js-quantities recognizes the value, return
       the unit-normalized short form ("120 watts" -> "120W"). */
    if (globalThis.SSCanonical && globalThis.SSCanonical.isReady && globalThis.SSCanonical.isReady()) {
      const canonical = globalThis.SSCanonical.canonicalValue(value);
      if (canonical) return canonical;
    }
    let text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    text = text
      .replace(/\b(\d+(?:\.\d+)?)\s*(?:dots?\s+per\s+inch|dpi)\b/ig, '$1 DPI')
      .replace(/\b(\d+(?:\.\d+)?)\s*(?:volts?|v)\b/ig, '$1 V')
      .replace(/\b(\d+(?:\.\d+)?)\s*(?:watts?|w)\b/ig, '$1 W')
      .replace(/\b(\d+(?:\.\d+)?)\s*(?:amps?|amperes?|a)\b/ig, '$1 A')
      .replace(/\b(\d+(?:\.\d+)?)\s*(?:milliamps?|ma)\b/ig, '$1 mA')
      .replace(/\b(\d+(?:\.\d+)?)\s*(?:milliamp[- ]?hours?|mah)\b/ig, '$1 mAh')
      .replace(/\s+/g, ' ')
      .trim();
    return text;
  }

  function normalizeProductSpecs(product) {
    const raw = Array.isArray(product?.rawSpecs)
      ? product.rawSpecs
      : Object.entries(product?.specs || {}).map(([key, value]) => ({ key, value }));
    const byId = new Map();
    for (const spec of raw) {
      const normalizedKey = normalizeSpecKeyLabel(spec?.key);
      const value = normalizeSpecValue(spec?.value);
      if (!normalizedKey.id || !normalizedKey.label || !value) continue;
      const existing = byId.get(normalizedKey.id);
      if (!existing) {
        byId.set(normalizedKey.id, { key: normalizedKey.label, value });
      } else if (!existing.value.toLowerCase().split(/\s*\|\s*/).includes(value.toLowerCase())) {
        existing.value = `${existing.value} | ${value}`;
      }
    }
    return [...byId.values()];
  }

  // --- Product identity ---
  function cleanIdentityPart(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function buildProductIdentity(product) {
    const listingTitle = cleanIdentityPart(product.listingTitle || product.title);
    const brand       = cleanIdentityPart(product.brand);
    let   modelName   = cleanIdentityPart(product.modelName);
    let   modelNumber = cleanIdentityPart(product.modelNumber);

    /* If the model name STARTS with the brand ("Shark AV2511AE"), strip
       the brand prefix to avoid "Shark | Shark AV2511AE". */
    if (brand && modelName) {
      const prefix = new RegExp('^' + escRegExp(brand) + '\\s+', 'i');
      modelName = modelName.replace(prefix, '').trim();
    }
    /* If model number duplicates the model name (after the strip above),
       drop the redundant number. Handles "Shark | AV2511AE | AV2511AE",
       "XIEBro | K10BL-2D | K10BL-2D", etc. */
    if (modelNumber && modelName && modelNumber.toLowerCase() === modelName.toLowerCase()) {
      modelNumber = '';
    }
    /* If brand equals model name (rare, but seen in store-brand listings),
       drop the duplicate brand. */
    if (brand && modelName && brand.toLowerCase() === modelName.toLowerCase()) {
      modelName = '';
    }
    /* Final dedup pass — collapse any remaining case-insensitive duplicates
       in the parts list (preserves first occurrence). */
    const rawParts = [brand, modelName, modelNumber].filter(Boolean);
    const parts = [];
    const seen = new Set();
    for (const p of rawParts) {
      const k = p.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      parts.push(p);
    }
    const productName = parts.length >= 2 ? parts.join(' | ') : (parts[0] || listingTitle);
    return {
      listingTitle,
      productName,
      structuredProductName: productName,
      productNameConfidence: parts.length >= 3 ? 'high' : (parts.length >= 2 ? 'medium' : 'low')
    };
  }

  function escRegExp(s) {
    return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* Some legacy product records (and a few quirks in the FIELD_MAP routing
     in content/productSchema.js) store fields as `{value, source, confidence}`
     wrapper objects instead of plain strings — so reading them naively yields
     `[object Object]` in the UI. This helper:
       1. returns '' for null / undefined / empty
       2. pulls `.value` / `.canonicalValue` / `.rawValue` from objects (in order)
       3. coerces the literal string "[object Object]" back to '' so corrupt
          legacy data still renders as an em-dash instead of garbage
     Used by every display formatter and by toLegacyFlatProduct. */
  function unwrapWrappedValue(v) {
    if (v == null) return '';
    if (typeof v === 'object') {
      return v.value || v.canonicalValue || v.rawValue || '';
    }
    const s = String(v);
    return s === '[object Object]' ? '' : s;
  }

  /* Apply the same dedup rules buildProductIdentity uses, but to an
     already-joined product-name string. Handles the legacy data shape
     where products were captured BEFORE buildProductIdentity learned
     to dedup — the rendered title can still be cleaned up at display
     time. Examples:
       "Shark | Shark AV2511AE | AV2511AE" → "Shark | AV2511AE"
       "XIEBro | K10BL-2D | K10BL-2D"      → "XIEBro | K10BL-2D"
       "iRobot | Roomba i7+ | i715020"     → unchanged (all distinct)
     Accepts ' | ' as the canonical separator; also tolerates ' - '. */
  function dedupProductName(input) {
    const s = String(input == null ? '' : input).trim();
    if (!s) return '';
    /* Split on " | " (preferred) or " - " (legacy fallback). */
    const sep = s.includes(' | ') ? ' | ' : (s.includes(' - ') ? ' - ' : null);
    if (!sep) return s;
    let parts = s.split(sep).map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) return s;
    /* Strip the first part as a prefix from every later part — e.g.
       "Shark AV2511AE" → "AV2511AE" once "Shark" is the first part. */
    const head = parts[0];
    const prefixRe = new RegExp('^' + escRegExp(head) + '\\s+', 'i');
    for (let i = 1; i < parts.length; i++) {
      parts[i] = parts[i].replace(prefixRe, '').trim();
    }
    /* Case-insensitive dedup, preserving order of first occurrence. */
    const seen = new Set();
    const out = [];
    for (const p of parts) {
      if (!p) continue;
      const k = p.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
    return out.join(sep);
  }

  // --- CSV ---
  function escapeCsvField(val) {
    let s = String(val || '');
    if (/^[=+\-@]/.test(s.trimStart())) s = "'" + s;
    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function parseCsvLine(line) {
    const result = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') inQ = false; else cur += ch; }
      else { if (ch === '"') inQ = true; else if (ch === ',') { result.push(cur); cur = ''; } else cur += ch; }
    }
    result.push(cur); return result;
  }
  function buildCsv(products) {
    const h = ['Name', 'Listing Title', 'Brand', 'Model Name', 'New Price', 'Used Price', 'Source', 'Model Number', 'Rating', 'Reviews', 'URL', 'Notes'];
    const rows = products.map(p => [
      p.productName || p.structuredProductName || p.title,
      p.listingTitle || '',
      p.brand,
      p.modelName || '',
      p.newPrice,
      p.usedPrice,
      p.source,
      p.modelNumber,
      p.rating,
      p.reviewCount,
      p.url,
      p.notes || ''
    ].map(escapeCsvField).join(','));
    return '\u{FEFF}' + [h.join(','), ...rows].join('\n');
  }

  // --- File ---
  function safeFilename(name) { return name.replace(/[^a-zA-Z0-9]/g, '_'); }
  function downloadFile(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // --- Category rubrics ---
  const CATEGORY_RUBRICS = {
    tv: {
      label: 'TV & Display',
      keywords: /\b(tv|television|oled|qled|led tv|smart tv|4k tv|8k|uhd tv|roku tv|fire tv)\b/i,
      factors: ['panel technology', 'screen size', 'resolution', 'refresh rate', 'HDR formats', 'brightness', 'local dimming', 'contrast ratio', 'viewing angles', 'HDMI version/count', 'gaming features', 'smart TV OS', 'audio quality', 'warranty']
    },
    monitor: {
      label: 'Monitor',
      keywords: /\b(monitor|gaming monitor|ultrawide|curved monitor)\b/i,
      factors: ['panel type', 'resolution', 'refresh rate', 'response time', 'color accuracy', 'brightness', 'HDR support', 'adaptive sync', 'ports', 'ergonomics', 'VESA mount', 'warranty']
    },
    laptop: {
      label: 'Laptop / Notebook',
      keywords: /\b(laptop|notebook|chromebook|macbook|ultrabook|2-in-1)\b/i,
      factors: ['processor', 'RAM', 'storage type/size', 'GPU', 'display size/resolution', 'battery life', 'weight', 'ports', 'keyboard/trackpad quality', 'build quality', 'OS', 'warranty']
    },
    desktop: {
      label: 'Desktop / PC',
      keywords: /\b(desktop|pc|workstation|gaming pc|mini pc|all-in-one)\b/i,
      factors: ['processor', 'RAM', 'storage', 'GPU', 'power supply', 'expansion slots', 'ports', 'form factor', 'cooling', 'OS', 'warranty']
    },
    tablet: {
      label: 'Tablet',
      keywords: /\b(tablet|ipad|galaxy tab|surface pro|kindle fire)\b/i,
      factors: ['processor', 'RAM', 'storage', 'display size/resolution', 'battery life', 'stylus support', 'keyboard compatibility', 'OS', 'weight', 'cameras', 'warranty']
    },
    phone: {
      label: 'Smartphone',
      keywords: /\b(phone|smartphone|iphone|galaxy s|pixel \d)\b/i,
      factors: ['processor', 'RAM', 'storage', 'display', 'camera system', 'battery life', 'charging speed', '5G/connectivity', 'water resistance', 'OS support', 'warranty']
    },
    headphone: {
      label: 'Headphones / Earbuds',
      keywords: /\b(headphone|earphone|earbud|earpiece|headset|over-ear|on-ear|in-ear|ANC|noise cancell)\b/i,
      factors: ['driver size', 'frequency response', 'ANC quality', 'codec support', 'battery life', 'comfort/fit', 'IP rating', 'microphone quality', 'connectivity', 'warranty']
    },
    speaker: {
      label: 'Speakers / Soundbar',
      keywords: /\b(speaker|soundbar|subwoofer|sound bar|home theater|surround|bookshelf speaker|portable speaker)\b/i,
      factors: ['driver configuration', 'wattage', 'frequency response', 'Dolby/DTS support', 'connectivity', 'room size suitability', 'subwoofer', 'build quality', 'app support', 'warranty']
    },
    camera: {
      label: 'Camera',
      keywords: /\b(camera|dslr|mirrorless|camcorder|action cam|gopro|webcam|dash cam|security cam)\b/i,
      factors: ['sensor size', 'resolution', 'lens mount', 'video capability', 'autofocus', 'stabilization', 'battery life', 'weather sealing', 'connectivity', 'warranty']
    },
    networking: {
      label: 'Networking Equipment',
      keywords: /\b(router|mesh|wi-fi|wifi|modem|access point|range extender|switch|ethernet)\b/i,
      factors: ['Wi-Fi standard', 'speed rating', 'coverage area', 'mesh support', 'number of bands', 'Ethernet ports', 'security features', 'processor/RAM', 'firmware updates', 'warranty']
    },
    printer: {
      label: 'Printer / Scanner',
      keywords: /\b(printer|scanner|inkjet|laser|all-in-one printer|multifunction)\b/i,
      factors: ['print technology', 'print speed', 'print quality', 'ink/toner cost per page', 'duplexing', 'connectivity', 'paper capacity', 'scanner resolution', 'duty cycle', 'warranty']
    },
    storage: {
      label: 'Storage Device',
      keywords: /\b(hard drive|hdd|ssd|external drive|flash drive|usb drive|memory card|sd card|nas)\b/i,
      factors: ['capacity', 'read/write speed', 'interface', 'form factor', 'durability', 'encryption', 'endurance rating', 'warranty']
    },
    projector: {
      label: 'Projector',
      keywords: /\b(projector|home cinema|theater projector)\b/i,
      factors: ['brightness (lumens)', 'resolution', 'throw ratio', 'contrast', 'lamp/laser type', 'input lag', 'keystone/lens shift', 'noise level', 'replacement lamp cost', 'warranty']
    },
    refrigerator: {
      label: 'Refrigerator',
      keywords: /\b(refrigerator|fridge|freezer|french door|side-by-side|mini fridge)\b/i,
      factors: ['capacity', 'layout/configuration', 'energy use', 'compressor reliability', 'temperature consistency', 'ice maker', 'dimensions', 'finish durability', 'noise level', 'warranty']
    },
    washer: {
      label: 'Washer / Dryer',
      keywords: /\b(washer|dryer|washing machine|laundry|combo washer)\b/i,
      factors: ['capacity', 'wash/dry cycles', 'energy/water efficiency', 'noise/vibration', 'motor type', 'stackability', 'reliability', 'smart features', 'warranty']
    },
    dishwasher: {
      label: 'Dishwasher',
      keywords: /\b(dishwasher)\b/i,
      factors: ['capacity (place settings)', 'wash cycles', 'noise level', 'drying system', 'energy/water use', 'rack adjustability', 'interior material', 'smart features', 'warranty']
    },
    oven: {
      label: 'Oven / Range / Cooktop',
      keywords: /\b(oven|range|cooktop|stove|induction|convection oven|wall oven)\b/i,
      factors: ['fuel type', 'oven capacity', 'burner count/power', 'convection', 'self-cleaning', 'temperature accuracy', 'dimensions', 'smart features', 'warranty']
    },
    microwave: {
      label: 'Microwave',
      keywords: /\b(microwave|over-the-range)\b/i,
      factors: ['wattage', 'capacity', 'sensor cooking', 'preset programs', 'ventilation CFM', 'dimensions', 'build quality', 'warranty']
    },
    smallAppliance: {
      label: 'Small Kitchen Appliance',
      keywords: /\b(blender|mixer|food processor|air fryer|instant pot|pressure cooker|slow cooker|toaster|coffee maker|espresso|juicer|rice cooker|bread maker|waffle maker|electric kettle)\b/i,
      factors: ['motor power/wattage', 'capacity', 'material', 'ease of cleaning', 'safety features', 'noise level', 'preset programs', 'accessories', 'warranty']
    },
    vacuum: {
      label: 'Vacuum / Floor Care',
      keywords: /\b(vacuum|roomba|robot vacuum|mop|steam cleaner|carpet cleaner|dyson)\b/i,
      factors: ['suction power', 'battery life', 'dustbin capacity', 'filtration', 'navigation', 'noise level', 'brush type', 'mopping capability', 'app support', 'warranty']
    },
    hvac: {
      label: 'HVAC / Climate Control',
      keywords: /\b(air conditioner|ac unit|heater|furnace|thermostat|dehumidifier|humidifier|fan|air purifier|portable ac|window ac|mini split)\b/i,
      factors: ['BTU/cooling capacity', 'energy efficiency', 'coverage area', 'noise level', 'filtration', 'smart features', 'installation requirements', 'dimensions', 'warranty']
    },
    sofa: {
      label: 'Sofa / Seating Furniture',
      keywords: /\b(sofa|couch|sectional|loveseat|recliner|futon|sleeper sofa|ottoman|armchair)\b/i,
      factors: ['frame material', 'upholstery material', 'cushion fill/density', 'dimensions', 'weight capacity', 'construction/joinery', 'comfort', 'assembly difficulty', 'durability', 'warranty', 'return policy']
    },
    desk: {
      label: 'Desk / Office Furniture',
      keywords: /\b(desk|standing desk|sit-stand|computer desk|writing desk|office chair|ergonomic chair|gaming chair)\b/i,
      factors: ['ergonomics', 'adjustability', 'weight capacity', 'surface dimensions', 'material', 'stability', 'cable management', 'assembly quality', 'warranty']
    },
    bed: {
      label: 'Bed / Mattress',
      keywords: /\b(mattress|bed frame|platform bed|adjustable bed|bunk bed|memory foam|hybrid mattress|pillow top)\b/i,
      factors: ['material type', 'firmness', 'thickness', 'support layers', 'cooling', 'motion isolation', 'edge support', 'trial period', 'certifications', 'warranty']
    },
    furniture: {
      label: 'General Furniture',
      keywords: /\b(bookshelf|dresser|nightstand|cabinet|table|dining|shelf|tv stand|entertainment center|storage bench)\b/i,
      factors: ['material', 'dimensions', 'weight capacity', 'construction quality', 'finish', 'assembly difficulty', 'stability', 'durability', 'warranty']
    },
    clothing: {
      label: 'Clothing & Apparel',
      keywords: /\b(shirt|pants|jeans|jacket|coat|dress|blouse|sweater|hoodie|polo|t-shirt|shorts|skirt|suit|blazer|vest|leggings|underwear|socks|activewear|sportswear|romper|jumpsuit|pajama|lingerie|bra|camisole)\b/i,
      factors: ['fabric composition', 'fit type', 'sizing accuracy', 'stitching quality', 'comfort', 'breathability', 'shrink resistance', 'colorfastness', 'care requirements', 'durability', 'return policy']
    },
    outerwear: {
      label: 'Outerwear',
      keywords: /\b(winter coat|parka|rain jacket|ski jacket|down jacket|puffer|windbreaker|trench coat|overcoat)\b/i,
      factors: ['insulation type/fill', 'water resistance', 'wind resistance', 'breathability', 'seam sealing', 'zipper quality', 'hood/cuff design', 'temperature rating', 'weight', 'care requirements']
    },
    athleticShoe: {
      label: 'Athletic Footwear',
      keywords: /\b(running shoe|sneaker|training shoe|basketball shoe|tennis shoe|cross trainer|hiking shoe|trail runner|cleats)\b/i,
      factors: ['upper material', 'midsole foam/cushioning', 'stability/support', 'heel drop', 'traction', 'weight', 'breathability', 'durability', 'fit/width options', 'return policy']
    },
    boot: {
      label: 'Boots',
      keywords: /\b(boot|hiking boot|work boot|combat boot|rain boot|snow boot|chelsea boot|cowboy boot)\b/i,
      factors: ['leather/synthetic quality', 'waterproofing', 'sole construction', 'insulation', 'ankle support', 'toe protection', 'break-in comfort', 'resoleability', 'weight', 'warranty']
    },
    shoe: {
      label: 'Footwear',
      keywords: /\b(shoe|sandal|loafer|oxford|flat|heel|slipper|clog|moccasin)\b/i,
      factors: ['upper material', 'sole material', 'cushioning', 'arch support', 'fit', 'width options', 'traction', 'durability', 'weight', 'return policy']
    },
    hat: {
      label: 'Hats & Headwear',
      keywords: /\b(hat|cap|fitted hat|snapback|beanie|visor|bucket hat|fedora|baseball cap)\b/i,
      factors: ['material', 'fit/sizing accuracy', 'stitching quality', 'crown structure', 'licensed authenticity', 'comfort', 'breathability', 'durability', 'return policy']
    },
    swimwear: {
      label: 'Swimwear',
      keywords: /\b(swimsuit|swimwear|bikini|swim trunk|bathing suit|one-piece|two-piece|rash guard|board short|swim brief|tankini)\b/i,
      factors: ['fabric composition', 'care requirements', 'fit type', 'coverage', 'UV protection', 'chlorine resistance', 'lining quality', 'elasticity', 'colorfastness', 'sizing accuracy', 'drying speed', 'return policy']
    },
    jewelry: {
      label: 'Jewelry',
      keywords: /\b(jewelry|jewellery|necklace|bracelet|earring|pendant|engagement ring|wedding ring|diamond ring|gold ring|silver ring|gold chain|gemstone|carat|14k|18k|925 silver|sterling silver)\b/i,
      factors: ['metal purity/type', 'stone authenticity', 'stone grade (cut/clarity/color/carat)', 'plating thickness', 'craftsmanship', 'clasp quality', 'certification', 'return policy']
    },
    watch: {
      label: 'Watch',
      keywords: /\b(watch|smartwatch|chronograph|analog watch|digital watch|luxury watch|fitness tracker)\b/i,
      factors: ['movement type', 'case material', 'crystal type', 'water resistance', 'accuracy', 'strap/bracelet quality', 'battery life', 'smart features', 'serviceability', 'warranty']
    },
    bag: {
      label: 'Bags & Luggage',
      keywords: /\b(bag|backpack|luggage|suitcase|briefcase|tote|purse|handbag|duffel|carry-on|messenger bag)\b/i,
      factors: ['material', 'zipper quality', 'stitching', 'capacity', 'weight', 'water resistance', 'compartments/organization', 'wheel quality', 'handle/strap quality', 'lock', 'warranty']
    },
    skincare: {
      label: 'Skincare',
      keywords: /\b(moisturizer|serum|sunscreen|cleanser|retinol|vitamin c|hyaluronic|toner|exfoliant|face cream|eye cream|face wash|anti-aging)\b/i,
      factors: ['active ingredients', 'concentration', 'skin type suitability', 'irritation risk', 'SPF', 'fragrance-free', 'dermatologist tested', 'packaging stability', 'certifications', 'shelf life']
    },
    beauty: {
      label: 'Beauty & Personal Care',
      keywords: /\b(shampoo|conditioner|makeup|cosmetic|foundation|lipstick|mascara|perfume|cologne|deodorant|body wash|lotion|hair care|styling|hair dryer|straightener|curling iron)\b/i,
      factors: ['ingredients', 'skin/hair type compatibility', 'allergen risk', 'fragrance', 'certifications', 'shelf life', 'packaging', 'brand reputation', 'customer feedback patterns']
    },
    supplement: {
      label: 'Vitamins & Supplements',
      keywords: /\b(vitamin|supplement|probiotic|protein powder|omega|multivitamin|mineral|collagen|creatine|pre-workout|bcaa|fish oil)\b/i,
      factors: ['active ingredients', 'dosage', 'form (capsule/tablet/powder)', 'third-party testing', 'certifications', 'allergens', 'serving size', 'price per serving', 'brand reputation']
    },
    medicalDevice: {
      label: 'Health / Medical Device',
      keywords: /\b(blood pressure|thermometer|pulse oximeter|glucose|hearing aid|cpap|nebulizer|tens unit|massager|scale)\b/i,
      factors: ['measurement accuracy', 'FDA/medical certification', 'ease of use', 'display/readability', 'memory/connectivity', 'battery life', 'material safety', 'warranty']
    },
    fitnessEquipment: {
      label: 'Fitness Equipment',
      keywords: /\b(treadmill|elliptical|exercise bike|rowing machine|weight bench|dumbbells|kettlebell|resistance band|pull-up bar|home gym|yoga mat)\b/i,
      factors: ['weight capacity', 'frame material', 'stability', 'resistance type', 'adjustability', 'footprint', 'noise level', 'display/tracking', 'assembly', 'warranty']
    },
    powerTool: {
      label: 'Power Tool',
      keywords: /\b(drill|impact driver|circular saw|jigsaw|sander|router|grinder|reciprocating saw|miter saw|table saw|nail gun|rotary tool)\b/i,
      factors: ['voltage/amps', 'torque', 'RPM/speed', 'battery platform', 'motor type (brushless)', 'included batteries/charger', 'ergonomics', 'weight', 'professional vs DIY', 'warranty']
    },
    handTool: {
      label: 'Hand Tool',
      keywords: /\b(wrench|screwdriver|pliers|hammer|level|tape measure|socket set|tool set|hex key|chisel|clamp)\b/i,
      factors: ['material grade', 'grip/ergonomics', 'precision/tolerances', 'corrosion resistance', 'set completeness', 'storage case', 'warranty']
    },
    plumbing: {
      label: 'Plumbing / Electrical',
      keywords: /\b(faucet|toilet|shower head|sink|water heater|light fixture|ceiling fan|outlet|switch|wire|pipe|valve)\b/i,
      factors: ['material', 'code compliance', 'pressure/voltage rating', 'certifications', 'finish durability', 'installation requirements', 'flow rate', 'warranty']
    },
    paint: {
      label: 'Paint / Flooring',
      keywords: /\b(paint|stain|primer|flooring|laminate|vinyl plank|hardwood|tile|carpet|grout|sealant)\b/i,
      factors: ['coverage area', 'VOC level', 'finish type', 'durability rating', 'moisture resistance', 'installation method', 'thickness', 'warranty']
    },
    lawnMower: {
      label: 'Outdoor Power Equipment',
      keywords: /\b(lawn mower|mower|trimmer|leaf blower|chainsaw|pressure washer|snow blower|edger|tiller|hedge trimmer)\b/i,
      factors: ['engine/motor power', 'battery platform', 'runtime', 'cutting width/capacity', 'noise level', 'self-propelled', 'maintenance requirements', 'weight', 'warranty']
    },
    grill: {
      label: 'Grill / Outdoor Cooking',
      keywords: /\b(grill|bbq|barbecue|smoker|griddle|pellet grill|gas grill|charcoal grill|kamado)\b/i,
      factors: ['cooking area', 'BTU rating', 'burner material', 'grate material', 'heat distribution', 'fuel type', 'temperature control', 'build quality', 'warranty']
    },
    garden: {
      label: 'Garden & Patio',
      keywords: /\b(patio|garden hose|planter|raised bed|outdoor furniture|umbrella|gazebo|pergola|compost|sprinkler|outdoor rug)\b/i,
      factors: ['material', 'weather/UV resistance', 'dimensions', 'weight capacity', 'durability', 'maintenance needs', 'assembly', 'storage', 'warranty']
    },
    tire: {
      label: 'Tires',
      keywords: /\b(tire|tyre|all-season|winter tire|summer tire|run-flat)\b/i,
      factors: ['size', 'load index', 'speed rating', 'treadwear rating', 'traction rating', 'temperature rating', 'season type', 'warranty mileage', 'noise', 'wet/dry performance']
    },
    carPart: {
      label: 'Automotive Parts & Accessories',
      keywords: /\b(car|auto|vehicle|motor oil|brake pad|filter|battery|wiper|floor mat|seat cover|car charger|dash cam|car organizer|car mount)\b/i,
      factors: ['vehicle compatibility', 'OEM vs aftermarket', 'material', 'fitment accuracy', 'durability', 'safety certification', 'installation difficulty', 'warranty', 'return policy']
    },
    petFood: {
      label: 'Pet Food',
      keywords: /\b(dog food|cat food|pet food|kibble|wet food|raw diet|puppy food|kitten food|pet treat)\b/i,
      factors: ['protein source', 'ingredients quality', 'AAFCO statement', 'life stage', 'allergens', 'calorie content', 'recall history', 'price per serving']
    },
    pet: {
      label: 'Pet Supplies',
      keywords: /\b(dog bed|cat tree|pet crate|leash|collar|harness|pet toy|aquarium|terrarium|litter box|pet carrier|pet gate)\b/i,
      factors: ['pet size compatibility', 'material safety', 'durability', 'ease of cleaning', 'comfort', 'chew resistance', 'adjustability', 'warranty']
    },
    carSeat: {
      label: 'Car Seat / Safety',
      keywords: /\b(car seat|booster seat|infant seat|convertible car seat)\b/i,
      factors: ['safety rating/certification', 'age/weight/height limits', 'installation system (LATCH)', 'side-impact protection', 'expiration date', 'harness type', 'fabric cleaning', 'vehicle fit', 'crash replacement policy']
    },
    stroller: {
      label: 'Stroller',
      keywords: /\b(stroller|jogger stroller|double stroller|travel system|bassinet stroller)\b/i,
      factors: ['weight capacity', 'stability', 'foldability', 'weight', 'wheel quality', 'brake quality', 'car seat compatibility', 'storage', 'suspension', 'safety harness']
    },
    baby: {
      label: 'Baby & Kids',
      keywords: /\b(crib|high chair|baby monitor|diaper|bottle|pacifier|baby gate|playpen|baby swing|changing table|nursery)\b/i,
      factors: ['safety certification', 'age/weight limits', 'material safety', 'stability', 'ease of cleaning', 'recall history', 'durability', 'adjustability', 'warranty']
    },
    toy: {
      label: 'Toys & Games',
      keywords: /\b(toy|lego|action figure|doll|puzzle|board game|card game|building set|plush|nerf|playset|rc car|drone)\b/i,
      factors: ['age suitability', 'safety certifications', 'material safety', 'durability', 'educational value', 'replay value', 'complexity', 'parts count', 'choking hazard', 'battery requirements']
    },
    videoGame: {
      label: 'Video Games / Console',
      keywords: /\b(playstation|xbox|nintendo|ps5|ps4|switch|console|video game|gaming console|controller|gamepad)\b/i,
      factors: ['platform compatibility', 'storage', 'performance', 'backward compatibility', 'online features', 'controller quality', 'game library', 'accessories', 'warranty']
    },
    instrument: {
      label: 'Musical Instrument',
      keywords: /\b(guitar|piano|keyboard|drum|ukulele|violin|bass|amplifier|microphone|midi|synthesizer)\b/i,
      factors: ['build material', 'sound quality', 'tuning stability', 'playability', 'included accessories', 'beginner vs professional', 'brand reputation', 'warranty']
    },
    grocery: {
      label: 'Grocery / Food',
      keywords: /\b(coffee|tea|snack|cereal|pasta|sauce|oil|spice|chocolate|protein bar|nuts|dried fruit|organic food)\b/i,
      factors: ['ingredients', 'nutrition facts', 'allergens', 'certifications (organic/fair trade)', 'serving size', 'price per unit/oz', 'expiration/freshness', 'origin', 'packaging']
    },
    office: {
      label: 'Office Supplies',
      keywords: /\b(paper|ink|toner|pen|notebook|binder|laminator|shredder|label maker|whiteboard|sticky note|stapler|calculator)\b/i,
      factors: ['quantity', 'price per unit', 'compatibility', 'material quality', 'durability', 'reliability', 'warranty']
    },
    book: {
      label: 'Books & Media',
      keywords: /\b(book|novel|textbook|audiobook|ebook|kindle edition|hardcover|paperback|dvd|blu-ray|vinyl record)\b/i,
      factors: ['edition', 'format', 'author/publisher', 'condition', 'publication date', 'completeness', 'reviews', 'price']
    },
    seasonal: {
      label: 'Seasonal / Holiday',
      keywords: /\b(christmas|halloween|easter|thanksgiving|decoration|ornament|wreath|string lights|inflatable|holiday|patio lights)\b/i,
      factors: ['material', 'durability', 'safety (UL/ETL)', 'indoor/outdoor rating', 'weather resistance', 'power type', 'brightness', 'reusability', 'storage', 'fire resistance']
    }
  };

  function inferCategory(product) {
    const title = product.title || '';
    const category = product.category || '';
    const context = [
      title, category, product.brand || '',
      (product.bullets || []).slice(0, 3).join(' '),
      product.description ? product.description.substring(0, 200) : ''
    ].join(' ');

    let best = null, bestScore = 0;
    for (const [key, rubric] of Object.entries(CATEGORY_RUBRICS)) {
      let score = 0;
      const titleMatch = title.match(new RegExp(rubric.keywords.source, rubric.keywords.flags + 'g'));
      const catMatch = category.match(new RegExp(rubric.keywords.source, rubric.keywords.flags + 'g'));
      const ctxMatch = context.match(new RegExp(rubric.keywords.source, rubric.keywords.flags + 'g'));
      if (titleMatch) score += titleMatch.length * 10;
      if (catMatch) score += catMatch.length * 8;
      if (ctxMatch) score += ctxMatch.length;
      if (score > bestScore) { bestScore = score; best = key; }
    }
    return best;
  }

  function getCategoryRubric(products) {
    const counts = {};
    const assignments = products.map(p => {
      const cat = inferCategory(p);
      if (cat) counts[cat] = (counts[cat] || 0) + 1;
      return { product: p, categoryKey: cat };
    });

    const rubrics = {};
    for (const { product, categoryKey } of assignments) {
      if (categoryKey && CATEGORY_RUBRICS[categoryKey]) {
        const r = CATEGORY_RUBRICS[categoryKey];
        if (!rubrics[categoryKey]) rubrics[categoryKey] = { label: r.label, factors: r.factors, products: [] };
        rubrics[categoryKey].products.push(product.title || 'Untitled');
      }
    }
    return { assignments, rubrics };
  }

  const FACTOR_SPEC_MAP = {
    'panel technology': ['panelType', 'panel type'],
    'panel type': ['panelType', 'panel type'],
    'screen size': ['size', 'display', 'screen size', 'display size'],
    'resolution': ['display', 'resolution'],
    'refresh rate': ['refreshRate', 'refresh rate'],
    'HDR formats': ['hdr', 'HDR'],
    'HDR support': ['hdr', 'HDR'],
    'brightness': ['brightness', 'peak brightness', 'nits'],
    'local dimming': ['localDimming', 'local dimming'],
    'contrast ratio': ['contrast', 'contrast ratio'],
    'viewing angles': ['viewingAngle', 'viewing angle'],
    'HDMI version/count': ['connectivity', 'ports', 'hdmi'],
    'HDMI version': ['connectivity', 'ports', 'hdmi'],
    'gaming features': ['gamingFeatures', 'gaming', 'vrr'],
    'smart TV OS': ['operatingSystem', 'smart tv', 'os'],
    'audio quality': ['audio', 'speaker', 'sound'],
    'response time': ['responseTime', 'response time'],
    'adaptive sync': ['adaptiveSync', 'freesync', 'g-sync'],
    'color accuracy': ['colorGamut', 'color accuracy', 'srgb', 'dci-p3'],
    'VESA mount': ['vesa', 'mount'],
    'processor': ['processor', 'cpu', 'chip', 'chipset'],
    'RAM': ['memory', 'ram'],
    'storage type/size': ['capacity', 'storage', 'ssd', 'hdd'],
    'storage': ['capacity', 'storage', 'ssd', 'hdd'],
    'GPU': ['gpu', 'graphics', 'video card'],
    'display size/resolution': ['display', 'screen size', 'resolution'],
    'display': ['display', 'screen'],
    'battery life': ['battery', 'battery life'],
    'weight': ['weight'],
    'ports': ['connectivity', 'ports'],
    'connectivity': ['connectivity', 'wireless', 'bluetooth', 'wifi'],
    'build quality': ['material', 'build'],
    'OS': ['operatingSystem', 'os'],
    'warranty': ['warranty'],
    'power supply': ['power', 'psu'],
    'form factor': ['formFactor', 'form factor', 'dimensions'],
    'cooling': ['cooling', 'thermal'],
    'driver size': ['driverSize', 'driver'],
    'frequency response': ['frequencyResponse', 'frequency'],
    'ANC quality': ['anc', 'noise cancell'],
    'codec support': ['codec', 'aptx', 'ldac', 'aac'],
    'IP rating': ['ipRating', 'ip rating', 'water resist'],
    'microphone quality': ['microphone', 'mic'],
    'wattage': ['power', 'wattage', 'watts'],
    'driver configuration': ['drivers', 'channels', 'configuration'],
    'Dolby/DTS support': ['dolby', 'dts', 'atmos'],
    'subwoofer': ['subwoofer', 'sub'],
    'room size suitability': ['roomSize', 'coverage'],
    'capacity': ['capacity', 'volume', 'size'],
    'energy efficiency': ['energyRating', 'energy star', 'energy use'],
    'energy use': ['energyRating', 'energy star', 'energy use'],
    'noise level': ['noise', 'decibel', 'dba'],
    'dimensions': ['dimensions', 'size'],
    'installation requirements': ['installation'],
    'reliability': ['reliability'],
    'smart features': ['smart', 'wifi', 'app'],
    'parts availability': ['parts'],
    'motor power/wattage': ['power', 'wattage', 'motor'],
    'motor power': ['power', 'wattage', 'motor'],
    'ease of cleaning': ['cleaning', 'dishwasher safe'],
    'safety features': ['safety'],
    'material': ['material', 'fabric'],
    'fabric composition': ['material', 'fabric', 'composition'],
    'fit type': ['fit', 'fit type', 'closure', 'closure type', 'style', 'top style', 'bottom style'],
    'coverage': ['coverage', 'top style', 'bottom style', 'neckline', 'back style', 'leg style', 'cut'],
    'UV protection': ['uv', 'upf', 'sun protection'],
    'chlorine resistance': ['chlorine', 'chlorine resistant'],
    'lining quality': ['lining', 'lined'],
    'elasticity': ['elasticity', 'stretch', 'spandex', 'elastane'],
    'drying speed': ['quick dry', 'quick-dry', 'drying'],
    'sizing accuracy': ['sizing', 'size'],
    'stitching quality': ['stitching'],
    'comfort': ['comfort'],
    'breathability': ['breathability', 'breathable'],
    'shrink resistance': ['shrink'],
    'colorfastness': ['colorfastness', 'color fast'],
    'care requirements': ['care', 'wash'],
    'durability': ['durability'],
    'return policy': ['returnPolicy', 'return'],
    'upper material': ['upperMaterial', 'upper', 'material'],
    'sole material': ['soleMaterial', 'sole', 'outsole'],
    'cushioning': ['cushioning', 'midsole', 'foam'],
    'arch support': ['archSupport', 'arch', 'support'],
    'traction': ['traction', 'grip', 'outsole'],
    'frame material': ['frameMaterial', 'frame', 'material'],
    'upholstery material': ['upholstery', 'fabric', 'material'],
    'cushion fill/density': ['cushion', 'foam'],
    'weight capacity': ['weightCapacity', 'weight capacity', 'weight limit'],
    'construction/joinery': ['construction', 'joinery'],
    'assembly difficulty': ['assembly'],
    'voltage/amps': ['power', 'voltage', 'amps'],
    'torque': ['torque'],
    'RPM/speed': ['rpm', 'speed'],
    'battery platform': ['battery', 'battery platform', 'voltage'],
    'motor type (brushless)': ['motor', 'brushless'],
    'included batteries/charger': ['includedItems', 'included', 'charger', 'battery'],
    'ergonomics': ['ergonomics', 'ergonomic'],
    'professional vs DIY': ['professional', 'diy'],
    'vehicle compatibility': ['compatibility', 'fitment', 'vehicle'],
    'OEM vs aftermarket': ['oem', 'aftermarket'],
    'fitment accuracy': ['fitment', 'fit'],
    'safety certification': ['certification', 'safety', 'ul', 'etl', 'cpsc'],
    'age/weight/height limits': ['ageRange', 'weight limit', 'height limit'],
    'age/weight limits': ['ageRange', 'weight limit'],
    'installation system (LATCH)': ['latch', 'installation'],
    'side-impact protection': ['sideImpact', 'side impact'],
    'crash replacement policy': ['crashReplacement', 'replacement'],
    'foldability': ['fold', 'compact'],
    'wheel quality': ['wheels'],
    'brake quality': ['brake', 'brakes'],
    'car seat compatibility': ['carSeatCompatibility', 'car seat'],
    'suspension': ['suspension'],
    'safety harness': ['harness'],
    'recall history': ['recall'],
    'adjustability': ['adjustable', 'adjustability'],
    'suction power': ['suction', 'power'],
    'dustbin capacity': ['dustbin', 'bin', 'capacity'],
    'filtration': ['filter', 'filtration', 'hepa'],
    'navigation': ['navigation', 'lidar', 'mapping'],
    'mopping capability': ['mop', 'mopping'],
    'app support': ['app'],
    'ingredients': ['ingredients'],
    'active ingredients': ['activeIngredients', 'active ingredient'],
    'skin type suitability': ['skinType', 'skin type'],
    'SPF': ['spf'],
    'certifications': ['certification', 'certified'],
    'protein source': ['proteinSource', 'protein'],
    'AAFCO statement': ['aafco'],
    'allergens': ['allergen'],
    'calorie content': ['calories', 'calorie'],
    'price per serving': ['pricePerServing'],
    'serving size': ['servingSize', 'serving'],
    'third-party testing': ['thirdParty', 'tested', 'certified'],
    'dosage': ['dosage', 'dose'],
    'measurement accuracy': ['accuracy'],
    'age suitability': ['ageRange', 'age'],
    'choking hazard': ['choking'],
    'educational value': ['educational'],
    'replay value': ['replayability'],
    'weather resistance': ['weatherResistance', 'weather', 'outdoor'],
    'UV resistance': ['uvResistance', 'uv'],
    'BTU rating': ['btu'],
    'grate material': ['grate'],
    'heat distribution': ['heat'],
    'fuel type': ['fuel'],
    'temperature control': ['temperature'],
    'insulation type/fill': ['insulation', 'fill', 'down'],
    'water resistance': ['waterResistance', 'waterproof', 'water resist'],
    'wind resistance': ['windResistance', 'wind'],
    'seam sealing': ['seamSealing', 'seam'],
    'zipper quality': ['zipper'],
    'temperature rating': ['temperatureRating', 'temperature'],
    'metal purity/type': ['metalPurity', 'karat', 'gold', 'silver', 'platinum'],
    'stone authenticity': ['stoneAuthenticity', 'stone'],
    'stone grade (cut/clarity/color/carat)': ['stoneGrade', 'cut', 'clarity', 'carat'],
    'plating thickness': ['plating'],
    'craftsmanship': ['craftsmanship'],
    'clasp quality': ['clasp'],
    'movement type': ['movement'],
    'case material': ['caseMaterial', 'case'],
    'crystal type': ['crystal', 'sapphire'],
    'serviceability': ['serviceability', 'service'],
    'strap/bracelet quality': ['strap', 'bracelet'],
  };

  function detectMissingAttributes(product, categoryKey) {
    if (!categoryKey || !CATEGORY_RUBRICS[categoryKey]) return { found: [], missing: [], factors: [] };
    const rubric = CATEGORY_RUBRICS[categoryKey];
    const factors = rubric.factors;

    const allText = [
      product.title || '',
      product.brand || '',
      product.manufacturer || '',
      (product.bullets || []).join(' '),
      product.description || '',
      (product.rawSpecs || []).map(s => s.key + ' ' + s.value).join(' '),
      Object.entries(product.specs || {}).map(([k, v]) => k + ' ' + v).join(' ')
    ].join(' ').toLowerCase();

    const specKeys = new Set([
      ...Object.keys(product.specs || {}),
      ...(product.rawSpecs || []).map(s => s.key.toLowerCase())
    ].map(k => k.toLowerCase()));

    const found = [];
    const missing = [];

    for (const factor of factors) {
      const mappings = FACTOR_SPEC_MAP[factor] || FACTOR_SPEC_MAP[factor.toLowerCase()] || [];
      let isFound = false;

      for (const mapping of mappings) {
        const ml = mapping.toLowerCase();
        if (specKeys.has(ml)) { isFound = true; break; }
        for (const sk of specKeys) {
          if (sk.includes(ml) || ml.includes(sk)) { isFound = true; break; }
        }
        if (isFound) break;
        if (allText.includes(ml)) { isFound = true; break; }
      }

      if (!isFound && mappings.length === 0) {
        const fl = factor.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const sk of specKeys) {
          if (sk.replace(/[^a-z0-9]/g, '').includes(fl) || fl.includes(sk.replace(/[^a-z0-9]/g, ''))) { isFound = true; break; }
        }
        if (!isFound && allText.includes(factor.toLowerCase())) isFound = true;
      }

      (isFound ? found : missing).push(factor);
    }

    return { found, missing, factors };
  }

  const DEFAULT_COMPARISON_SPEC_LIMIT = 4;
  const COMMON_BUYER_SPEC_TERMS = [
    'material',
    'fabric',
    'care instructions',
    'care',
    'closure type',
    'top style',
    'bottom style',
    'size',
    'dimensions',
    'weight',
    'capacity',
    'warranty',
    'battery',
    'resolution',
    'refresh rate',
    'display',
    'storage',
    'memory',
    'ram',
    'processor',
    'water resistance',
    'spf',
    'upf'
  ];

  function normalizeComparisonSpecKey(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function isNoisyComparisonSpecKey(value) {
    const key = normalizeComparisonSpecKey(value);
    if (!key) return true;
    if (/\b(asin|sku|upc|gtin|ean|isbn|mpn)\b/.test(key)) return true;
    return /\b(manufacturer part number|part number|model number|item model number|product id|item number)\b/.test(key);
  }

  function specKeyMatchesTerm(specKey, term) {
    const spec = normalizeComparisonSpecKey(specKey);
    const candidate = normalizeComparisonSpecKey(term);
    if (!spec || !candidate) return false;
    return spec === candidate || spec.includes(candidate) || candidate.includes(spec);
  }

  function comparisonSpecScore(specKey, categoryKey) {
    if (isNoisyComparisonSpecKey(specKey)) return 0;
    let score = 0;
    const rubric = categoryKey && CATEGORY_RUBRICS[categoryKey] ? CATEGORY_RUBRICS[categoryKey] : null;
    if (rubric) {
      rubric.factors.forEach((factor, index) => {
        const mappings = FACTOR_SPEC_MAP[factor] || FACTOR_SPEC_MAP[factor.toLowerCase()] || [];
        const candidates = [factor, ...mappings];
        if (candidates.some(term => specKeyMatchesTerm(specKey, term))) {
          score = Math.max(score, 1000 - index * 20);
        }
      });
    }
    COMMON_BUYER_SPEC_TERMS.forEach((term, index) => {
      if (specKeyMatchesTerm(specKey, term)) {
        score = Math.max(score, 300 - index);
      }
    });
    return score;
  }

  function getCategoryComparisonSpecKeys(products, maxKeys = DEFAULT_COMPARISON_SPEC_LIMIT) {
    const byKey = new Map();
    products.forEach((product, productIndex) => {
      const categoryKey = inferCategory(product);
      (product.rawSpecs || []).forEach((spec, specIndex) => {
        const label = String(spec?.key || '').replace(/\s+/g, ' ').trim();
        if (!label) return;
        const score = comparisonSpecScore(label, categoryKey);
        if (!score) return;
        const normalized = normalizeComparisonSpecKey(label);
        const existing = byKey.get(normalized);
        const candidate = {
          label,
          score,
          order: productIndex * 1000 + specIndex
        };
        if (!existing || candidate.score > existing.score || (candidate.score === existing.score && candidate.order < existing.order)) {
          byKey.set(normalized, candidate);
        }
      });
    });
    return [...byKey.values()]
      .sort((a, b) => b.score - a.score || a.order - b.order || a.label.localeCompare(b.label))
      .slice(0, maxKeys)
      .map(item => item.label);
  }

  // --- Prompt builder ---
  function formatProduct(p, i, total, detailed, categoryInfo) {
    const div = '────────────────────────────────────────\n';
    let t = `${div}Product ${i + 1} of ${total}\n`;
    const identity = buildProductIdentity(p);
    const displayName = p.productName || identity.productName || p.title || 'N/A';
    t += `Name:           ${displayName}\n`;
    if (identity.listingTitle && identity.listingTitle !== displayName) {
      t += `Listing Title:  ${identity.listingTitle}\n`;
    }
    t += `Brand:          ${p.brand || 'N/A'}\n`;
    if (p.manufacturer && p.manufacturer !== p.brand) t += `Manufacturer:   ${p.manufacturer}\n`;
    t += `Price (New):    ${p.newPrice || 'N/A'}\n`;
    if (p.usedPrice) t += `Price (Used):   ${p.usedPrice}\n`;
    if (p.shippingPrice) t += `Shipping:       ${p.shippingPrice}\n`;
    t += `Source:         ${p.source || 'Unknown'}\n`;
    if (p.sellerName) t += `Seller:         ${p.sellerName}\n`;
    if (p.modelName) t += `Model Name:     ${p.modelName}\n`;
    t += `Model Number:   ${p.modelNumber || 'N/A'}\n`;
    if (p.sku) t += `SKU:            ${p.sku}\n`;
    if (p.asin) t += `ASIN:           ${p.asin}\n`;
    if (p.upc) t += `UPC:            ${p.upc}\n`;
    if (p.gtin) t += `GTIN:           ${p.gtin}\n`;
    if (p.mpn) t += `MPN:            ${p.mpn}\n`;
    if (p.rating) {
      const ratingText = normalizeRatingValue(p.rating) || p.rating;
      const reviewText = normalizeReviewCount(p.reviewCount);
      t += `Rating:         ${ratingText}/5${reviewText ? ` (${reviewText} reviews)` : ''}\n`;
    }
    if (p.availability) t += `Availability:   ${p.availability}\n`;
    t += `URL:            ${p.url}\n`;
    if (p.notes) t += `Notes:          ${p.notes}\n`;

    if (categoryInfo) {
      t += `Category:       ${categoryInfo.label}\n`;
      t += `Quality Factors: ${categoryInfo.factors.join(', ')}\n`;
      if (categoryInfo.missing?.length) {
        t += `Missing Attributes: ${categoryInfo.missing.join(', ')}\n`;
      }
      if (categoryInfo.found?.length) {
        t += `Found Attributes: ${categoryInfo.found.join(', ')}\n`;
      }
    }

    if (detailed) {
      if (p.bullets?.length) t += `\nFeature Bullets:\n${p.bullets.map(b => `  • ${b}`).join('\n')}\n`;
      const cleanDescription = sanitizeProductDescription(p.description, p.source);
      if (cleanDescription) t += `\nDescription:\n  ${cleanDescription.substring(0, 1000)}\n`;
      if (p.rawSpecs?.length) {
        t += `\nSpecifications:\n`;
        p.rawSpecs.forEach(s => { t += `  ${s.key}: ${s.value}\n`; });
      } else if (p.specs && Object.keys(p.specs).length) {
        t += `\nSpecifications:\n`;
        Object.entries(p.specs).forEach(([k, v]) => { t += `  ${k}: ${v}\n`; });
      }
    }
    return t + '\n';
  }

  function getPromptLayout(productCount) {
    if (productCount <= 1) return {
      name: 'Product verification report',
      instruction: 'Use a focused product verification report with decision summary, evidence, risks, and concise supporting detail.'
    };
    if (productCount === 2) return {
      name: 'Detailed side-by-side comparison',
      instruction: 'Use a detailed side-by-side comparison so each important factor can be evaluated directly.'
    };
    if (productCount <= 5) return {
      name: 'Comparison table + short product cards',
      instruction: 'Use a comparison matrix plus short product cards. Keep the main body compact.'
    };
    if (productCount <= 12) return {
      name: 'Dashboard + grouped rankings + compact matrix',
      instruction: 'Use a dashboard layout: group first, shortlist winners, show a compact comparison matrix, and move detailed product notes to an appendix.'
    };
    return {
      name: 'Category grouping + shortlist + appendix-only details',
      instruction: 'Use shortlist mode: group products, show only the best candidates and cautions in the main body, and keep detailed notes in an appendix.'
    };
  }

  function productDisplayName(product) {
    const identity = buildProductIdentity(product);
    return product.productName || product.structuredProductName || identity.productName || product.title || 'Untitled';
  }

  function buildPresentationInstructions(mode, productCount) {
    const layout = getPromptLayout(productCount);
    let t = `# Presentation Layer\n\n`;
    t += `Output style: ${layout.name}.\n`;
    t += `${layout.instruction}\n\n`;
    t += `Separate the answer into three layers:\n`;
    t += `1. Decision Layer - verdict, recommendation, confidence, and value/risk summary.\n`;
    t += `2. Evidence Layer - grouping, comparison tables, verification status, missing data, and risks.\n`;
    t += `3. Detail Layer - complete spec ledger, listing-vs-official checks, and appendix notes when needed.\n\n`;
    t += `Do not overload the main report. Be precise, concise, and relevant. Do not skip important details; move supporting detail to tables or appendix.\n`;
    t += `Start with the verdict, not a long explanation.\n`;
    t += `Group products by category, subcategory, and use case before ranking. Do not force one overall winner across products that are not directly comparable.\n\n`;
    t += `Product identity rule: use Brand | Model Name | Model Number when available. If a part is missing, use Unknown for that part. Do not use the marketplace listing title as the primary product name unless brand, model name, and model number are unavailable.\n\n`;
    t += `Visual status system:\n`;
    t += `- ✅ Verified from official or authoritative source\n`;
    t += `- 🔵 Listing-only claim\n`;
    t += `- 🧩 Inferred from available evidence\n`;
    t += `- ❓ Missing or unverifiable\n`;
    t += `- ⚠️ Concern, exaggeration, vague claim, or possible marketing language\n`;
    t += `- 🚩 Major risk or contradiction\n`;
    t += `- 🧬 Possible rebrand or duplicate product\n`;
    t += `- 💰 Best value\n`;
    t += `- 🏆 Recommended\n`;
    t += `- ⛔ Avoid or not recommended\n\n`;
    t += `Confidence labels: 🟢 High, 🟡 Medium, 🔴 Low, ⚪ Unknown.\n`;
    t += `Value labels: 💰 Excellent value, 👍 Good value, ⚖️ Fair value, 👎 Poor value.\n\n`;
    t += `Scaling rules:\n`;
    t += `- 1 product: Product verification report.\n`;
    t += `- 2 products: Detailed side-by-side comparison.\n`;
    t += `- 3-5 products: Comparison table + short product cards.\n`;
    t += `- 6-12 products: Dashboard + grouped rankings + compact matrix; move detailed product notes to an appendix.\n`;
    t += `- 13+ products: Category grouping + shortlist + appendix-only details.\n`;
    if (mode === 'quick') {
      t += `\nFor Quick mode, keep the response short: verdict table, key comparison, risks, and final recommendation only.\n`;
    }
    return t + '\n';
  }

  function buildVerificationInstructions() {
    let t = `# Verification Rules\n\n`;
    t += `Use listing data as the starting point, but do not treat marketplace claims as fully verified.\n`;
    t += `Verify against sources in this priority order when possible: official manufacturer page, spec sheet, manual, warranty page, packaging/certification/compliance documents, authorized retailers, marketplace listings, reputable technical reviews, then customer reviews only as supporting evidence.\n`;
    t += `If manufacturer verification is not possible from the provided data, say: "Manufacturer verification was not available from the provided data."\n`;
    t += `Do not invent missing specifications.\n`;
    t += `Flag marketing-driven claims, including software enhancement, upscaling, interpolation, simulated/coated/blended materials, "up to" claims, vague words like premium/professional/heavy duty/medical grade/military grade/commercial grade, certification claims without proof, and marketplace-only specs with no manufacturer confirmation.\n`;
    t += `When appropriate, say: "The listing claim may be marketing-driven because the underlying native, material, measured, or certified specification was not verified."\n\n`;
    return t;
  }

  function buildJsonOutputInstructions(mode) {
    if (mode === 'quick') return '';
    return `# Structured JSON Output for ShopScout\n\nAfter the readable report, include a structured JSON decision object for app rendering. The JSON must not replace the readable report.\n\nUse this shape:\n\n\`\`\`json\n{\n  "quick_verdict": {\n    "best_overall": { "product_id": 1, "badge": "🏆 Best Overall", "reason": "", "confidence": "high | medium | low | unknown" },\n    "best_value": { "product_id": 1, "badge": "💰 Best Value", "reason": "", "confidence": "high | medium | low | unknown" },\n    "lowest_risk": { "product_id": 1, "badge": "🛡 Lowest Risk", "reason": "", "confidence": "high | medium | low | unknown" },\n    "highest_risk": { "product_id": 1, "badge": "⚠️ Highest Risk", "reason": "", "confidence": "high | medium | low | unknown" }\n  },\n  "products": [\n    { "id": 1, "short_name": "Product 1", "display_name": "", "listing_title": "", "brand": "", "manufacturer": "", "official_model": "", "category_inferred": "", "category_confirmed": "", "subcategory": "", "price": "", "rating": "", "review_count": 0, "seller": "", "source": "", "spec_completeness": "complete | partial | weak", "verification_confidence": "high | medium | low | unknown", "value_rating": "excellent | good | fair | poor", "risk_level": "low | medium | high | unknown", "verdict": "buy | consider | avoid" }\n  ],\n  "specification_ledger": [\n    { "product_id": 1, "spec_group": "", "specification": "", "listing_value": "", "official_or_external_value": "", "verification_status": "verified | listing_only | inferred | missing | suspicious | contradictory", "glyph": "✅ | 🔵 | 🧩 | ❓ | ⚠️ | 🚩", "notes": "" }\n  ],\n  "missing_attributes": [\n    { "product_id": 1, "attribute": "", "research_result": "found_official | found_external | inferred | missing_unverifiable | conflicting", "value": "", "source_type": "manufacturer | manual | authorized_retailer | marketplace | review | none", "confidence": "high | medium | low | unknown", "risk": "low | medium | high" }\n  ],\n  "risks": [\n    { "product_id": 1, "risk_type": "verification | seller | spec | marketing_gimmick | rebrand | warranty | return_policy", "severity": "low | medium | high", "glyph": "🟢 | 🟡 | 🔴 | ⚪", "note": "" }\n  ],\n  "rebrand_checks": [\n    { "products_compared": [1, 2], "suspicion": "none | possible | strong", "evidence": [], "price_difference": "", "risk": "low | medium | high" }\n  ],\n  "final_ranking": [\n    { "rank": 1, "product_id": 1, "verdict": "buy | consider | avoid", "reason": "", "confidence": "high | medium | low | unknown" }\n  ]\n}\n\`\`\`\n\n`;
  }

  function buildPrompt(products, mode) {
    const n = products.length;
    const { assignments, rubrics } = getCategoryRubric(products);
    let t = '';

    function buildCategoryInfo(product, categoryKey) {
      if (!categoryKey || !CATEGORY_RUBRICS[categoryKey]) return null;
      const r = CATEGORY_RUBRICS[categoryKey];
      const { found, missing } = detectMissingAttributes(product, categoryKey);
      return { label: r.label, factors: r.factors, found, missing };
    }

    const productNames = assignments.map(a => productDisplayName(a.product)).filter(Boolean);
    const catLabels = [...new Set(assignments.map(a => a.categoryKey ? CATEGORY_RUBRICS[a.categoryKey]?.label : null).filter(Boolean))];
    const catSummary = catLabels.length ? catLabels.join(', ') : 'general products';
    const presentationInstructions = buildPresentationInstructions(mode, n);
    const verificationInstructions = buildVerificationInstructions();
    const jsonInstructions = buildJsonOutputInstructions(mode);

    if (mode === 'quick') {
      t = `You are a product comparison and buying-decision assistant for ShopScout.\n\n`;
      t += presentationInstructions;
      t += `I'm shopping for ${catSummary} and need help deciding. Compare these ${n} products:\n`;
      t += productNames.map((name, i) => `  ${i + 1}. ${name}`).join('\n') + '\n\n';
      t += `Compare them on price, category-relevant features, quality, value, ratings, and obvious risks. Give a clear recommendation with concise reasoning.\n\n`;
      assignments.forEach(({ product, categoryKey }, i) => {
        t += formatProduct(product, i, n, false, buildCategoryInfo(product, categoryKey));
      });
      t += `\nReturn a compact decision-first answer with: Quick Verdict, Product Grouping if needed, Compact Comparison Matrix, Risks/Cautions, and Final Recommendation.\n`;
      t += `Based on the above, which is the best buy and why? Be specific about what makes it better than the others.`;
      if (Object.keys(rubrics).length > 1) {
        t += ` These products span different categories (${catLabels.join(', ')}), so give the best pick within each category.`;
      }
    }

    else if (mode === 'deep') {
      t = `You are a category-aware product comparison, specification-verification, and buying-decision assistant for ShopScout.\n\n`;
      t += presentationInstructions;
      t += verificationInstructions;
      t += `I'm comparing ${n} ${catSummary} products and need an expert buying recommendation.\n`;
      t += `Products: ${productNames.join(' vs ')}\n\n`;
      t += `Analyze these as a ${catSummary} expert. I need you to help me decide which one to buy.\n\n`;

      t += `# Category-aware rubric instructions\n\n`;
      t += `Each product includes an inferred category, relevant quality factors, and a list of which defining attributes were found vs missing from the listing.\n`;
      t += `Use those factors as the main quality standard for that product.\n`;
      t += `If products are in different categories, apply a different rubric to each category and do not force a single winner.\n`;
      t += `If the inferred category appears wrong, correct it and explain why.\n`;
      t += `Do not apply irrelevant quality factors from another category. For example:\n`;
      t += `- Do not judge clothing by electronics specs.\n`;
      t += `- Do not judge TVs by fabric quality.\n`;
      t += `- Do not judge groceries by refresh rate or ports.\n`;
      t += `- Do not judge furniture by CPU, RAM, or software support.\n\n`;
      t += `# Missing attribute instructions\n\n`;
      t += `Each product lists which defining attributes for its category were NOT found in the listing.\n`;
      t += `For each missing attribute:\n`;
      t += `- Research or identify it from the manufacturer's official specifications when possible.\n`;
      t += `- If the missing attribute can be inferred from the model number, brand, or other available data, do so and mark it as "inferred."\n`;
      t += `- If it cannot be determined, mark it as "missing — unverifiable."\n`;
      t += `- Do not make a high-confidence recommendation if critical defining attributes are missing or unverifiable.\n\n`;

      assignments.forEach(({ product, categoryKey }, i) => {
        t += formatProduct(product, i, n, true, buildCategoryInfo(product, categoryKey));
      });

      t += `\n${'═'.repeat(50)}\n\nFor each product, analyze:\n`;
      t += `- The category-specific quality factors listed above\n`;
      t += `- Missing attributes identified above — research or verify them\n`;
      t += `- Price (new, used, shipping)\n- Brand and manufacturer\n- Model number, SKU, ASIN, UPC, GTIN, MPN\n`;
      t += `- Store/source and seller reliability\n- Rating and review count\n- Extracted specifications\n- Feature bullets and description\n- Warranty\n- Notes\n\n`;
      t += `Specification rules:\n`;
      t += `- Use the listing specifications first.\n- Then verify against official manufacturer specs when possible.\n`;
      t += `- If manufacturer verification is unavailable, say so.\n- Do not invent missing specifications.\n`;
      t += `- If listing specs conflict with manufacturer specs, flag the conflict.\n\n`;
      t += `Rebrand / duplicate-product rules:\n`;
      t += `- Check whether multiple products appear to be the same underlying item sold under different names.\n`;
      t += `- Look for matching dimensions, weight, material, model number, UPC/GTIN/MPN, photos, feature bullets, manuals, and description wording.\n`;
      t += `- If rebranding or duplicate sourcing is suspected, explain the evidence.\n`;
      t += `- If one version is priced higher than an equivalent product, flag the markup.\n\n`;
      t += `Return the readable answer in this format:\n\n`;
      t += `# Product Verification and Buying Decision Dashboard\n\n`;
      t += `## 1. Quick Verdict\nStart with a compact recommendation table: Best Overall, Best Value, Lowest Risk, Most Risky, Skip/Avoid, and confidence. Then give a 2-4 sentence plain-English summary.\n\n`;
      t += `## 2. Product Identity Table\nUse Product 1, Product 2, etc. as short names in large tables. Include full display name, listing title, brand, manufacturer, identifiers, price, rating, seller/source.\n\n`;
      t += `## 3. Category Confirmation and Grouping\nConfirm or correct each inferred category, identify subcategory/use case, and decide whether products are directly comparable.\n\n`;
      t += `## 4. Category-specific quality rubric used\n`;
      t += `For each product category found, list:\n- Category and subcategory\n- Most important quality factors\n- Why they matter\n- Which products belong to this category\n\n`;
      t += `## 5. Master Decision Matrix\nCreate a compact table with: #, Product, Group, Price, Rating/Reviews, Key Verified Strength, Main Weakness, Spec Completeness, Verification Confidence, Value.\n\n`;
      t += `## 6. Spec Comparison Matrix\nUse only the most important category-specific buying factors in this table. This table is for decisions and does not replace the complete spec ledger.\n\n`;
      t += `## 7. Complete Specification Ledger\nInclude all listing specs and external/official specs found. Columns: Product, Spec Group, Specification, Listing Value, Official/External Value, Verification Status, Notes.\n\n`;
      t += `## 8. Listing vs Official Verification Report\nCompare listing claims against official or authoritative sources. Flag exaggerated, missing, vague, contradictory, or marketing-driven claims.\n\n`;
      t += `## 9. Missing attribute research\nFor each product, list missing defining attributes and what you were able to determine: attribute name, status, value if found/inferred, source, confidence, risk.\n\n`;
      t += `## 10. Risk Dashboard\nCreate a table with: Product, Verification Risk, Seller Risk, Spec Risk, Marketing-Gimmick Risk, Rebrand Risk, Overall Risk.\n\n`;
      t += `## 11. Rebrand / Duplicate Product Check\nIdentify products that may be the same underlying item. Explain evidence and price difference.\n\n`;
      t += `## 12. Suspicious Pattern Check\nCheck identical wording, identical photos, same accessories, same specs under different brands, vague manufacturer identity, and inflated technical claims.\n\n`;
      t += `## 13. Product Scorecards\nUse compact cards. For 6 or more products, keep cards brief and place detailed notes in an appendix.\n\n`;
      t += `## 14. Final Ranking\nIf products are directly comparable, rank them. If not comparable, recommend by group.\n\n`;
      t += `## 15. Final Recommendation\nEnd with: I recommend [Product Name] for [use case] because [main reason]. Include recommendation confidence and what limits confidence.\n\n`;
      t += `Category-aware evaluation details:\nFor each product evaluate: category fit, key quality factors, spec completeness, manufacturer verification, rebrand suspicion, value rating, and quality confidence.\n`;
      t += `If critical defining attributes are missing and unverifiable, state that recommendation confidence is limited.\n\n`;
      t += jsonInstructions;
    }

    else if (mode === 'verify') {
      t = `You are a product specification verification assistant for ShopScout.\n\n`;
      t += presentationInstructions;
      t += verificationInstructions;
      t += `I need you to verify the specifications of ${n === 1 ? 'this' : 'these'} ${catSummary} product${n === 1 ? '' : 's'}:\n`;
      t += productNames.map((name, i) => `  ${i + 1}. ${name}`).join('\n') + '\n\n';
      t += `Check the listing specs against official manufacturer data. Flag anything exaggerated, missing, or contradictory.\n`;
      t += `For missing specs that matter for ${catSummary}, try to find them from the manufacturer.\n\n`;
      assignments.forEach(({ product, categoryKey }, i) => {
        t += formatProduct(product, i, n, true, buildCategoryInfo(product, categoryKey));
      });
      t += `\n${'═'.repeat(50)}\n\nFor each product:\n`;
      t += `1. Confirm or correct the inferred category.\n`;
      t += `2. Identify the manufacturer and official model.\n`;
      t += `3. Compare listing specs against official manufacturer specs, prioritizing the category-specific quality factors.\n`;
      t += `4. For missing defining attributes, research from manufacturer sources and report what was found.\n`;
      t += `5. Flag any specs that appear exaggerated, missing, or contradictory.\n`;
      t += `6. Check if any products appear to be the same underlying item sold under different brand names.\n`;
      t += `7. Check for suspicious patterns: identical photos across brands, same unusual wording, same accessories listed.\n\n`;
      t += `If manufacturer verification is not possible from the provided data, say:\n`;
      t += `"Manufacturer verification was not available from the provided data."\n\n`;
      t += `Do not treat marketplace listing claims as fully verified unless official manufacturer information confirms them.\n\n`;
      t += `Return a verification dashboard with:\n`;
      t += `- Quick verification verdict\n`;
      t += `- Product identity table\n`;
      t += `- Listing vs official verification report\n`;
      t += `- Complete specification ledger\n`;
      t += `- Missing attribute matrix\n`;
      t += `- Risk dashboard\n`;
      t += `- Rebrand / duplicate-product check\n`;
      t += `- Suspicious marketing-gimmick check\n`;
      t += `- Final confidence limits\n\n`;
      t += `For each product include:\n`;
      t += `- Inferred category (confirmed or corrected)\n`;
      t += `- Found attributes and their verification status\n`;
      t += `- Missing attributes and research results\n`;
      t += `- Verified specs\n- Unverified specs\n- Suspicious specs\n`;
      t += `- Spec completeness: Complete / Partial / Weak\n- Confidence: High / Medium / Low\n\n`;
      t += jsonInstructions;
    }

    return t;
  }

  function buildAIText(products) { return buildPrompt(products, 'quick'); }

  // --- Export HTML ---
  function buildExportHtml(products, title) {
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const cards = products.map(p => {
      const imageUrl = sanitizeUrl(p.image);
      const productUrl = sanitizeUrl(p.url, '#');
      return `<div class="card">
      <div class="card-img">${imageUrl ? `<img src="${escAttr(imageUrl)}">` : '<span class="no-img">No Image</span>'}</div>
      <div class="card-body"><h3>${esc(p.title || '')}</h3><table>
        ${p.brand ? `<tr><td class="l">Brand</td><td>${esc(p.brand)}</td></tr>` : ''}
        <tr><td class="l">Price</td><td class="price">${esc(p.newPrice || 'N/A')}</td></tr>
        ${p.usedPrice ? `<tr><td class="l">Used</td><td class="used">${esc(p.usedPrice)}</td></tr>` : ''}
        <tr><td class="l">Source</td><td>${esc(p.source || '')}</td></tr>
        ${p.modelNumber ? `<tr><td class="l">Model</td><td>${esc(p.modelNumber)}</td></tr>` : ''}
        ${p.rating ? `<tr><td class="l">Rating</td><td>${esc(formatRatingDisplay(p.rating, p.reviewCount))}</td></tr>` : ''}
        <tr><td class="l">URL</td><td><a href="${escAttr(productUrl)}">${esc(p.url)}</a></td></tr>
        ${p.notes ? `<tr><td class="l">Notes</td><td>${esc(p.notes)}</td></tr>` : ''}
      </table></div></div>`;
    }).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ShopScout — ${esc(title)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f7f9;padding:40px 20px;color:#111827}
.hdr{text-align:center;margin-bottom:36px}.hdr h1{font-size:26px;color:#1e3a8a}.hdr p{color:#6b7280;font-size:14px;margin-top:4px}
.grid{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:20px}
.card{display:flex;gap:20px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;page-break-inside:avoid}
.card-img{flex-shrink:0;width:120px;height:120px;display:flex;align-items:center;justify-content:center;background:#f9fafb;border-radius:8px;overflow:hidden}
.card-img img{max-width:100%;max-height:100%;object-fit:contain}.no-img{color:#d1d5db;font-size:12px}
.card-body{flex:1;min-width:0}.card-body h3{font-size:15px;font-weight:600;margin-bottom:10px;line-height:1.4}
table{border-collapse:collapse;width:100%}td{padding:3px 8px 3px 0;font-size:13px;vertical-align:top}
.l{font-weight:600;color:#6b7280;width:80px;white-space:nowrap}.price{color:#b45309;font-weight:700;font-size:15px}.used{color:#15803d;font-weight:600}
a{color:#2563eb;word-break:break-all;text-decoration:none}
.ft{text-align:center;margin-top:36px;color:#9ca3af;font-size:12px}
@media print{body{padding:20px;background:#fff}}</style></head>
<body><div class="hdr"><h1>ShopScout</h1><p>${esc(title)} — ${date} — ${products.length} product(s)</p></div>
<div class="grid">${cards}</div><div class="ft">Generated by ShopScout</div></body></html>`;
  }

  // --- Import ---
  function parseImport(text, filename) {
    let imported = [], listName = '';
    if (filename.endsWith('.json')) {
      const d = JSON.parse(text); imported = d.products || d; listName = d.list || '';
      if (!Array.isArray(imported)) throw new Error('Invalid JSON');
    } else if (filename.endsWith('.xml')) {
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      listName = doc.documentElement.getAttribute('list') || '';
      for (const el of doc.querySelectorAll('product')) {
        const g = tag => el.querySelector(tag)?.textContent?.trim() || '';
        imported.push({ title: g('title'), brand: g('brand'), newPrice: g('newPrice'), usedPrice: g('usedPrice'), source: g('source'), modelNumber: g('modelNumber'), rating: g('rating'), reviewCount: g('reviewCount'), url: g('url'), image: g('image'), notes: g('notes'), addedAt: Date.now(), id: g('url') + '|' + Date.now() });
      }
    } else if (filename.endsWith('.csv')) {
      const lines = text.split('\n').filter(l => l.trim()); if (lines.length < 2) throw new Error('Empty CSV');
      const headers = parseCsvLine(lines[0]); const hmap = {};
      headers.forEach((h, i) => { hmap[h.toLowerCase().trim()] = i; });
      for (let i = 1; i < lines.length; i++) {
        const v = parseCsvLine(lines[i]); const g = k => v[hmap[k]] || '';
        imported.push({ title: g('name') || g('title') || g('product'), brand: g('brand'), newPrice: g('new price') || g('price') || g('newprice'), usedPrice: g('used price') || g('usedprice'), source: g('source'), modelNumber: g('model number') || g('modelnumber') || g('model'), rating: g('rating'), reviewCount: g('reviews') || g('reviewcount') || g('review count'), url: g('url') || g('link'), image: g('image') || '', notes: g('notes') || '', addedAt: Date.now(), id: (g('url') || g('link') || '') + '|' + Date.now() });
      }
      imported = imported.filter(p => p.title || p.url);
    } else throw new Error('Unsupported format');
    return { imported, listName };
  }

  // --- Toast ---
  const toast = {
    _el: null,
    _timer: null,
    show(msg, type = 'success') {
      this.hide();
      const el = document.createElement('div');
      el.className = 'ss-toast ss-toast--' + type;
      el.innerHTML = `<span class="ss-toast__icon">${type === 'success' ? '&#10003;' : type === 'error' ? '!' : ''}</span><span>${esc(msg)}</span>`;
      if (type === 'loading') el.innerHTML = `<span class="ss-toast__spinner"></span><span>${esc(msg)}</span>`;
      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.add('ss-toast--visible'));
      this._el = el;
      if (type !== 'loading') this._timer = setTimeout(() => this.hide(), 2500);
    },
    hide() {
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
      if (this._el) { this._el.classList.remove('ss-toast--visible'); setTimeout(() => this._el?.remove(), 200); this._el = null; }
    }
  };

  // --- Decision summary ---
  function buildSummary(products) {
    if (!products.length) return null;
    const withPrice = products.filter(p => parsePrice(p.newPrice) < 99999);
    const withRating = products.filter(p => parseFloat(p.rating) > 0);
    const missingData = products.filter(p => !p.rating || !p.modelNumber).length;
    let cheapest = null, expensive = null, bestRated = null;
    if (withPrice.length) {
      cheapest = withPrice.reduce((a, b) => parsePrice(a.newPrice) <= parsePrice(b.newPrice) ? a : b);
      expensive = withPrice.reduce((a, b) => parsePrice(a.newPrice) >= parsePrice(b.newPrice) ? a : b);
    }
    if (withRating.length) bestRated = withRating.reduce((a, b) => parseFloat(a.rating) >= parseFloat(b.rating) ? a : b);
    return { cheapest, expensive, bestRated, missingData, total: products.length };
  }

  return { STORAGE_KEY, getData, saveData, getProducts, saveProducts, bootstrapDataLayer, mirrorToProductRepo, esc, escAttr, escXml, sanitizeUrl, sanitizeProductDescription, isSafeHttpUrl, parsePrice, normalizeReviewCount, normalizeRatingValue, formatRatingDisplay, normalizeSpecKeyLabel, normalizeSpecValue, normalizeProductSpecs, buildProductIdentity, dedupProductName, escapeCsvField, parseCsvLine, buildCsv, safeFilename, downloadFile, buildAIText, buildPrompt, inferCategory, getCategoryRubric, detectMissingAttributes, getCategoryComparisonSpecKeys, CATEGORY_RUBRICS, buildExportHtml, parseImport, toast, buildSummary, canonicalizeProductUrl, unwrapWrappedValue };
})();
