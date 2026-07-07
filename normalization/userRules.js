/* =============================================================
   ShopScout — user-approved normalization rules

   Runtime overlay for user-approved aliases and ignored review items.
   Default rules remain bundled/read-only; user rules are loaded from
   IndexedDB per product list and merged before normalization runs.
   ============================================================= */
(function initShopScoutUserNormalizationRules(root) {
  const NS = (root.ShopScoutUserNormalizationRules = root.ShopScoutUserNormalizationRules || {});
  const BASE = root.ShopScoutNormalizationRules || {};
  const baseSnapshot = cloneRules(BASE);

  function cloneRules(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function normalizeToken(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/[^\p{L}\p{N}+#./ ]+/gu, '')
      .replace(/\s+/g, ' ');
  }

  function slug(value) {
    return normalizeToken(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function emptyRuleSet() {
    return { fieldAliases: {}, canonicalFields: {}, enums: {}, ignored: [] };
  }

  function normalizeRuleSet(rules) {
    const out = emptyRuleSet();
    const input = rules && typeof rules === 'object' ? rules : {};
    for (const [key, aliases] of Object.entries(input.fieldAliases || {})) {
      const canonicalKey = normalizeToken(key);
      if (!canonicalKey) continue;
      out.fieldAliases[canonicalKey] = uniqueArray(aliases);
    }
    for (const [key, value] of Object.entries(input.canonicalFields || {})) {
      const canonicalKey = normalizeToken(key);
      const canonical = String(value || '').trim();
      if (canonicalKey && canonical) out.canonicalFields[canonicalKey] = canonical;
    }
    for (const [field, values] of Object.entries(input.enums || {})) {
      const canonicalField = String(field || '').trim();
      if (!canonicalField || !values || typeof values !== 'object') continue;
      out.enums[canonicalField] = out.enums[canonicalField] || {};
      for (const [canonical, aliases] of Object.entries(values)) {
        const canonicalValue = String(canonical || '').trim();
        if (!canonicalValue) continue;
        out.enums[canonicalField][canonicalValue] = uniqueArray(aliases);
      }
    }
    out.ignored = uniqueArray(input.ignored || []);
    return out;
  }

  function uniqueArray(values) {
    const out = [];
    const seen = new Set();
    for (const value of Array.isArray(values) ? values : [values]) {
      const text = String(value == null ? '' : value).trim();
      if (!text) continue;
      const key = normalizeToken(text);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
    return out;
  }

  function mergeArray(target, values) {
    const existing = new Set((target || []).map(normalizeToken));
    const out = Array.isArray(target) ? target.slice() : [];
    for (const value of uniqueArray(values)) {
      const key = normalizeToken(value);
      if (existing.has(key)) continue;
      existing.add(key);
      out.push(value);
    }
    return out;
  }

  function resetToBase() {
    const fresh = cloneRules(baseSnapshot);
    for (const key of Object.keys(BASE)) delete BASE[key];
    Object.assign(BASE, fresh);
  }

  function applyUserRulePatch(patch) {
    const normalized = normalizeRuleSet(patch);
    BASE.userFieldAliases = BASE.userFieldAliases || {};
    BASE.userCanonicalFields = BASE.userCanonicalFields || {};
    BASE.userEnums = BASE.userEnums || {};
    BASE.userIgnored = BASE.userIgnored || [];

    for (const [key, aliases] of Object.entries(normalized.fieldAliases)) {
      BASE.fieldAliases = BASE.fieldAliases || {};
      BASE.userFieldAliases[key] = mergeArray(BASE.userFieldAliases[key], aliases);
      BASE.fieldAliases[key] = mergeArray(BASE.fieldAliases[key], aliases);
    }
    for (const [key, canonical] of Object.entries(normalized.canonicalFields)) {
      BASE.canonicalFields = BASE.canonicalFields || {};
      BASE.userCanonicalFields[key] = canonical;
      BASE.canonicalFields[key] = canonical;
    }
    for (const [field, values] of Object.entries(normalized.enums)) {
      BASE.enums = BASE.enums || {};
      BASE.userEnums[field] = BASE.userEnums[field] || {};
      BASE.enums[field] = BASE.enums[field] || {};
      for (const [canonical, aliases] of Object.entries(values)) {
        BASE.userEnums[field][canonical] = mergeArray(BASE.userEnums[field][canonical], aliases);
        BASE.enums[field][canonical] = mergeArray(BASE.enums[field][canonical], aliases);
      }
    }
    BASE.userIgnored = mergeArray(BASE.userIgnored, normalized.ignored);
    if (root.ShopScoutAttributeNormalization?.reloadRules) {
      root.ShopScoutAttributeNormalization.reloadRules();
    }
    return normalizeRuleSet(BASE);
  }

  function loadUserRules(rules) {
    resetToBase();
    return applyUserRulePatch(rules || emptyRuleSet());
  }

  function buildUserRulePatch(item) {
    const rawField = String(item?.rawField || '').trim();
    const field = String(item?.field || rawField).trim();
    const raw = String(item?.raw || '').trim();
    const normalized = String(item?.normalized || raw).trim();
    const fieldKey = normalizeToken(field);
    const patch = emptyRuleSet();
    if (rawField && field && normalizeToken(rawField) !== fieldKey) {
      patch.fieldAliases[fieldKey] = [rawField];
      patch.canonicalFields[fieldKey] = field;
    }
    if (field && raw && normalized) {
      patch.enums[field] = {};
      patch.enums[field][normalized] = [raw];
    }
    return patch;
  }

  function mergeRuleSets(base, patch) {
    const out = normalizeRuleSet(base);
    const next = normalizeRuleSet(patch);
    for (const [key, aliases] of Object.entries(next.fieldAliases)) {
      out.fieldAliases[key] = mergeArray(out.fieldAliases[key], aliases);
    }
    for (const [key, canonical] of Object.entries(next.canonicalFields)) {
      out.canonicalFields[key] = canonical;
    }
    for (const [field, values] of Object.entries(next.enums)) {
      out.enums[field] = out.enums[field] || {};
      for (const [canonical, aliases] of Object.entries(values)) {
        out.enums[field][canonical] = mergeArray(out.enums[field][canonical], aliases);
      }
    }
    out.ignored = mergeArray(out.ignored, next.ignored);
    return out;
  }

  function ignoredSet() {
    return new Set(uniqueArray(BASE.userIgnored || []));
  }

  function isUserEnumAlias(field, canonical, alias) {
    const values = BASE.userEnums?.[field]?.[canonical];
    if (!values) return false;
    return values.map(normalizeToken).includes(normalizeToken(alias));
  }

  function isUserFieldAlias(fieldKey, alias) {
    const values = BASE.userFieldAliases?.[normalizeToken(fieldKey)];
    if (!values) return false;
    return values.map(normalizeToken).includes(normalizeToken(alias));
  }

  Object.assign(NS, {
    normalizeToken,
    slug,
    emptyRuleSet,
    normalizeRuleSet,
    buildUserRulePatch,
    mergeRuleSets,
    applyUserRulePatch,
    loadUserRules,
    ignoredSet,
    isUserEnumAlias,
    isUserFieldAlias
  });
})(globalThis);
