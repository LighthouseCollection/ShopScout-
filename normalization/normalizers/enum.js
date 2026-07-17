/* =============================================================
   ShopScout — enum normalizer (normalization v2)

   Handles registry.type === 'enum' fields (Color, Size, Material,
   Pattern, Power Source, Connector Type, ...).

   Pipeline for each raw value:
     1. Split (multi-valued fields only) into tokens
     2. Per token:
        - strip variant-index prefix ("1-blue" -> "blue")
        - strip trailing variant number ("Black 2" -> "Black")
        - trim punctuation & whitespace
        - drop noise words from config.dropTokens
        - look up in the enum's alias table (via ShopScoutEnums)
     3. Emit {canonical, display, provenance} — canonical is
        lowercase key (multi) or single key (single); display is
        the enum's canonical label (title-cased, human-readable).

   Fixes for the defects the user reported:
     "Black&red"  -> split on &, map both -> ["Black", "Red"]
     "2-blue"     -> stripPrefix drops "2-" -> "blue" -> "Blue"
     "1-gray"     -> stripPrefix drops "1-" -> "gray" -> "Gray"
     "Black 2"    -> stripSuffix drops " 2" -> "Black"

   Unmapped tokens: kept as pass-through with a warning so the
   review UI can surface them (no silent drop, no swallowed data).
   ============================================================= */
(function initShopScoutEnumNormalizer(root) {
  const NS = (root.ShopScoutEnumNormalizer = root.ShopScoutEnumNormalizer || {});

  function titleCase(s) {
    return String(s).replace(/\b\w/g, ch => ch.toUpperCase());
  }

  function cleanToken(raw, config) {
    let t = String(raw).trim();
    if (config.stripPrefix) t = t.replace(config.stripPrefix, '');
    if (config.stripSuffix) t = t.replace(config.stripSuffix, '');
    /* Kill leftover punctuation runs at either end, collapse internal ws */
    t = t.replace(/^[\s\-.:;,]+|[\s\-.:;,]+$/g, '');
    t = t.replace(/\s+/g, ' ');
    return t.trim();
  }

  function isDropped(token, config) {
    if (!config.dropTokens) return false;
    const lower = token.toLowerCase();
    return config.dropTokens.some(dt => dt.toLowerCase() === lower);
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

  function rulesLookup(field, token) {
    const rules = root.ShopScoutNormalizationRules || {};
    const enums = rules.enums || {};
    const table = enums[field];
    if (!table) return null;
    const userRules = root.ShopScoutUserNormalizationRules || {};
    const exactAliasFields = new Set(rules.exactAliasFields || []);
    const tokenKey = normalizeToken(token);
    for (const canonical of Object.keys(table)) {
      const defaultRule = 'enum:' + slug(field) + ':' + slug(canonical);
      if (normalizeToken(canonical) === tokenKey) {
        return { normalized: canonical, confidence: 1, rule: defaultRule };
      }
      for (const alias of table[canonical] || []) {
        if (normalizeToken(alias) !== tokenKey) continue;
        const userAlias = typeof userRules.isUserEnumAlias === 'function'
          && userRules.isUserEnumAlias(field, canonical, alias);
        return {
          normalized: canonical,
          confidence: alias === canonical || exactAliasFields.has(field) || userAlias ? 1 : 0.95,
          rule: userAlias ? 'user-enum:' + slug(field) + ':' + slug(canonical) : defaultRule
        };
      }
    }
    return null;
  }

  function lookupEnumValue(field, token, context) {
    const localHit = rulesLookup(field, token);
    if (localHit) return localHit;
    const packHit = root.ShopScoutGeneratedPacks && typeof root.ShopScoutGeneratedPacks.lookupEnum === 'function'
      ? root.ShopScoutGeneratedPacks.lookupEnum(context?.vertical?.id, field, token)
      : null;
    if (packHit) return packHit;
    const enums = root.ShopScoutEnums;
    if (!enums || typeof enums.lookup !== 'function') return null;
    const builtIn = enums.lookup(field, token);
    return builtIn ? { normalized: builtIn, confidence: 1, rule: 'enum:' + slug(field) + ':' + slug(builtIn) } : null;
  }

  function normalizeEnum(rawValue, config, context) {
    if (rawValue == null || rawValue === '') {
      return {
        raw: rawValue == null ? null : '',
        canonical: config.multi ? [] : null,
        display: config.multi ? [] : '—',
        provenance: { method: 'enum.empty', confidence: 0, warnings: ['empty_input'] },
      };
    }
    const raw = String(rawValue);

    const tokens = config.multi && config.splitOn
      ? raw.split(config.splitOn).map(s => s.trim()).filter(Boolean)
      : [raw.trim()].filter(Boolean);

    const canonical = [];
    const display = [];
    const warnings = [];
    const rules = [];
    let hits = 0;

    for (const t of tokens) {
      const cleaned = cleanToken(t, config);
      if (!cleaned) continue;
      if (isDropped(cleaned, config)) continue;
      const mapped = lookupEnumValue(config.enumKey, cleaned, context || {});
      if (mapped) {
        hits += 1;
        canonical.push(mapped.normalized);
        display.push(mapped.normalized);
        if (mapped.rule) rules.push(mapped.rule);
      } else {
        /* Pass through unmapped with a warning — don't drop data,
           surface it in review so we can decide to add an alias. */
        const pass = titleCase(cleaned);
        canonical.push(pass);
        display.push(pass);
        warnings.push('unmapped:' + cleaned);
      }
    }

    const total = canonical.length;
    if (total === 0) {
      return {
        raw,
        canonical: config.multi ? [] : null,
        display: config.multi ? [] : '—',
        provenance: { method: 'enum.no-tokens', confidence: 0, warnings: ['no_tokens_after_clean', ...warnings] },
      };
    }

    return {
      raw,
      canonical: config.multi ? canonical : canonical[0],
      display: config.multi ? display : display[0],
      provenance: {
        method: 'enum.split-and-map',
        confidence: hits / total,
        rules: [...new Set(rules)],
        warnings,
      },
    };
  }

  Object.assign(NS, {
    version: 2,
    normalize: normalizeEnum,
    _lookupEnumValue: lookupEnumValue,
    _cleanToken: cleanToken,
    _titleCase: titleCase,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
