/* =============================================================
   ShopScout — Codex grid editing helpers

   Pure helpers for turning inline grid edits into ProductRepo
   patches and mirroring successful repo writes back into the
   legacy chrome.storage.local blob.
   ============================================================= */
(function initShopScoutGridCodexEditing(root) {
  const NS = (root.ShopScoutGridCodexEditing = root.ShopScoutGridCodexEditing || {});

  const NON_EDITABLE_FIELDS = new Set([
    'id',
    'listId',
    '_revision',
    '_shopScout',
    '_selected',
    '_actions',
    'image',
    'source'
  ]);

  function canonicalKey(value) {
    const canon = root.SSCanonical;
    if (canon && typeof canon.canonicalKey === 'function') return canon.canonicalKey(value);
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function friendlyLabel(value) {
    return String(value || '')
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function rawSpecList(product) {
    const access = root.ShopScoutProductSpecAccess;
    if (access && typeof access.specEntries === 'function') {
      return access.specEntries(product || {}).map(spec => {
        const next = {
          key: spec.rawField || spec.key || spec.field,
          value: spec.display ?? spec.value ?? spec.raw
        };
        if (spec.source) next.source = spec.source;
        return next;
      });
    }
    if (Array.isArray(product?.rawSpecs)) {
      return product.rawSpecs.map(spec => Object.assign({}, spec));
    }
    if (Array.isArray(product?.specs)) {
      return product.specs.map(spec => Object.assign({}, spec));
    }
    if (product?.specs && typeof product.specs === 'object') {
      return Object.entries(product.specs).map(([key, value]) => ({ key, value }));
    }
    return [];
  }

  function buildSpecPatch(product, field, value) {
    const specKey = String(field || '').slice(5);
    const wanted = canonicalKey(specKey);
    const list = rawSpecList(product);
    let matched = false;
    const rawSpecs = list.map(spec => {
      if (canonicalKey(spec.key) !== wanted) return spec;
      matched = true;
      return Object.assign({}, spec, { value });
    });
    if (!matched) rawSpecs.push({ key: friendlyLabel(specKey), value });
    const specs = {};
    const productSpecBucket = {};
    rawSpecs.forEach(spec => {
      const key = String(spec?.key || '').trim();
      const specValue = spec?.value == null ? '' : spec.value;
      if (!key) return;
      specs[key] = specValue;
      productSpecBucket[key] = {
        rawKey: key,
        rawValue: specValue,
        value: specValue,
        source: spec.source || 'manual-edit',
        confidence: 1
      };
    });
    return {
      rawSpecs,
      specs,
      specsNormalized: null,
      _spec: { specs: productSpecBucket }
    };
  }

  function buildProductPatch(product, edit) {
    const field = String(edit?.field || '').trim();
    if (!field || NON_EDITABLE_FIELDS.has(field)) return {};
    const value = edit?.value == null ? '' : edit.value;
    if (field.startsWith('spec:')) return buildSpecPatch(product, field, value);
    return { [field]: value };
  }

  function stripRepoOnlyFields(product) {
    const next = Object.assign({}, product || {});
    delete next.listId;
    delete next.updatedAt;
    delete next.capturedAt;
    delete next._lastMutationSource;
    return next;
  }

  function mirrorProductIntoLegacyBlob(blob, product) {
    const next = {
      activeList: blob?.activeList || 'My Products',
      lists: {}
    };
    for (const [name, products] of Object.entries(blob?.lists || {})) {
      next.lists[name] = Array.isArray(products)
        ? products.map(item => {
          const sameId = product?.id && item?.id === product.id;
          const sameUrl = product?.url && item?.url === product.url;
          return sameId || sameUrl ? stripRepoOnlyFields(product) : Object.assign({}, item);
        })
        : [];
    }
    return next;
  }

  Object.assign(NS, {
    buildProductPatch,
    mirrorProductIntoLegacyBlob
  });
})(globalThis);
