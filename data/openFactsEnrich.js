/* =============================================================
   ShopScout — Open*Facts GTIN enrichment
   Opt-in lookup against the Open Food / Beauty / Pet / Products Facts
   public APIs. Only runs when:
     - the user has the corresponding toggle on in Settings
     - the captured product has a GTIN/UPC/EAN
   Per-call timeout, returns extra spec entries that get merged into the
   record without overwriting anything the extractor already found.
   ============================================================= */
(function initOpenFactsEnrich(root) {
  const TIMEOUT_MS = 6000;
  const SETTINGS_KEY = 'shopscout_openfacts_enrich';

  /* Map of preference key -> API base URL. */
  const APIS = {
    food:     'https://world.openfoodfacts.org/api/v3/product/',
    beauty:   'https://world.openbeautyfacts.org/api/v3/product/',
    pet:      'https://world.openpetfoodfacts.org/api/v3/product/',
    products: 'https://world.openproductsfacts.org/api/v3/product/'
  };

  async function getSettings() {
    const chrome = root.chrome || root.browser;
    if (!chrome || !chrome.storage || !chrome.storage.local) return null;
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    return stored[SETTINGS_KEY] || null;
  }

  async function setSettings(next) {
    const chrome = root.chrome || root.browser;
    if (!chrome || !chrome.storage || !chrome.storage.local) return;
    await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  }

  function isEnabled(settings, which) {
    return !!(settings && settings.enabled && settings[which]);
  }

  function pickBarcode(product) {
    if (!product) return '';
    const raw = product.gtin || product.upc || product.ean;
    if (!raw) return '';
    const digits = String(raw).replace(/[^\d]/g, '');
    if (digits.length < 8 || digits.length > 14) return '';
    return digits;
  }

  /* Each API returns shape:
       { status: 1 | 0, product: { product_name, brands, ingredients_text,
         nutriments, allergens_tags, labels_tags, ... } } */
  async function fetchOne(apiKey, barcode) {
    const base = APIS[apiKey];
    if (!base) return null;
    const url = base + encodeURIComponent(barcode) + '.json';
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const resp = await fetch(url, { signal: ctrl.signal });
      if (!resp.ok) return null;
      const json = await resp.json();
      if (!json || json.status !== 1 || !json.product) return null;
      return json.product;
    } catch { return null; }
    finally { clearTimeout(t); }
  }

  /* Turn an Open*Facts product blob into ShopScout spec entries, only adding
     keys that aren't already present on the record. */
  function mergeIntoRecord(record, blob, sourceLabel) {
    if (!record || !blob) return record;
    const access = root.ShopScoutProductSpecAccess;
    const specKey = key => access && typeof access.canonicalKey === 'function'
      ? access.canonicalKey(key).toLowerCase()
      : String(key || '').trim().toLowerCase();
    const existingEntries = access && typeof access.specEntries === 'function'
      ? access.specEntries(record)
      : [
          ...(Array.isArray(record.rawSpecs) ? record.rawSpecs : []),
          ...(!Array.isArray(record.specs) && record.specs && typeof record.specs === 'object'
            ? Object.entries(record.specs).map(([key, value]) => ({ key, value }))
            : [])
        ];
    const seen = new Set(existingEntries.map(s => specKey(s.rawField || s.key || s.field)).filter(Boolean));
    if (!Array.isArray(record.rawSpecs)) record.rawSpecs = [];
    if (Array.isArray(record.specs) || !record.specs || typeof record.specs !== 'object') {
      record.specs = {};
      for (const spec of record.rawSpecs) {
        const key = String(spec?.key || '').trim();
        const value = String(spec?.value ?? '').trim();
        if (key && value) record.specs[key] = value;
      }
    }
    record._spec = Object.assign({}, record._spec || {}, { specs: Object.assign({}, record._spec?.specs || {}) });
    let changed = false;
    function addSpec(key, value) {
      if (!key || value == null || value === '') return;
      const cleanKey = String(key).trim();
      const cleanValue = String(value).trim();
      const id = specKey(cleanKey);
      if (!id || seen.has(id)) return;
      record.rawSpecs.push({ key: cleanKey, value: cleanValue, source: sourceLabel });
      record.specs[cleanKey] = cleanValue;
      record._spec.specs[cleanKey] = {
        rawKey: cleanKey,
        rawValue: cleanValue,
        value: cleanValue,
        source: sourceLabel,
        confidence: 1
      };
      seen.add(id);
      changed = true;
    }
    addSpec('Brand',          blob.brands);
    addSpec('Ingredients',    blob.ingredients_text);
    addSpec('Allergens',      Array.isArray(blob.allergens_tags) ? blob.allergens_tags.join(', ') : blob.allergens);
    addSpec('Categories',     Array.isArray(blob.categories_tags) ? blob.categories_tags.join(', ') : blob.categories);
    addSpec('Labels',         Array.isArray(blob.labels_tags) ? blob.labels_tags.join(', ') : blob.labels);
    addSpec('Country',        Array.isArray(blob.countries_tags) ? blob.countries_tags.join(', ') : blob.countries);
    addSpec('Quantity',       blob.quantity);
    addSpec('Serving size',   blob.serving_size);
    if (blob.nutriments && typeof blob.nutriments === 'object') {
      const n = blob.nutriments;
      addSpec('Energy',  n['energy_100g'] != null ? n['energy_100g'] + ' ' + (n['energy_unit'] || 'kJ') + '/100g' : '');
      addSpec('Protein', n['proteins_100g'] != null ? n['proteins_100g'] + ' g/100g' : '');
      addSpec('Carbs',   n['carbohydrates_100g'] != null ? n['carbohydrates_100g'] + ' g/100g' : '');
      addSpec('Fat',     n['fat_100g'] != null ? n['fat_100g'] + ' g/100g' : '');
      addSpec('Sugar',   n['sugars_100g'] != null ? n['sugars_100g'] + ' g/100g' : '');
      addSpec('Salt',    n['salt_100g'] != null ? n['salt_100g'] + ' g/100g' : '');
    }
    if (changed) delete record.specsNormalized;
    return record;
  }

  /* Public entry — try every enabled source for the given barcode. */
  async function enrichByGtin(record) {
    const settings = await getSettings();
    if (!settings || !settings.enabled) return record;
    const barcode = pickBarcode(record);
    if (!barcode) return record;
    const tries = Object.keys(APIS).filter(k => isEnabled(settings, k));
    for (const which of tries) {
      const blob = await fetchOne(which, barcode);
      if (blob) {
        mergeIntoRecord(record, blob, 'openfacts:' + which);
        break;
      }
    }
    return record;
  }

  root.SSOpenFactsEnrich = {
    getSettings,
    setSettings,
    enrichByGtin,
    SETTINGS_KEY,
    APIS
  };
})(globalThis);
