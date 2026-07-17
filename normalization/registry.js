/* =============================================================
   ShopScout — field registry (normalization v2)

   Per normalization/SPEC.md, the registry is the ONLY place a
   field's normalization behavior is declared. Extractors,
   adapters, cell renderers, and export builders all read the
   registry rather than embed field-specific logic.

   Every registry entry chooses one type:
     enum        — finite set of allowed values, optionally multi-valued
     measurement — numeric scalar + unit, converts to a canonical unit
     text        — free-form, cleaned but preserved

   Adding a field is one entry here + (for enum) one enum table
   in normalization/libraries/enums.js. Zero other code changes.
   ============================================================= */
(function initShopScoutRegistry(root) {
  const NS = (root.ShopScoutRegistry = root.ShopScoutRegistry || {});

  /* Splitter used by every multi-valued enum field. Broken on:
       ,   ampersand    · • ;                          — obvious list separators
       /                                                — either/or slashes ("red/blue")
       "space dash space"                               — natural "Black - Red" pairs
     NOT broken on hyphens inside a single token ("light-blue" stays one). */
  const MULTI_SPLIT = /\s*(?:,|&|\/|·|•|;|\s-\s)\s*/;

  /* Variant-index prefix ("1-blue", "2. red", "3) green"). Strip
     leading digits + separator so the token becomes just the value. */
  const VARIANT_PREFIX = /^\d+\s*[-.):\s]+\s*/;

  /* Trailing variant number ("Black 2", "Red 3"). Strip. */
  const VARIANT_SUFFIX = /\s+\d+$/;

  const FIELD_REGISTRY = {
    /* ---- enum fields ---- */
    Color: {
      type: 'enum',
      multi: true,
      enumKey: 'Color',
      splitOn: MULTI_SPLIT,
      stripPrefix: VARIANT_PREFIX,
      stripSuffix: VARIANT_SUFFIX,
      dropTokens: ['color', 'colour', 'primary', 'secondary'],
    },
    Size: {
      type: 'enum',
      multi: false,
      enumKey: 'Size',
      dropTokens: ['size'],
    },
    Material: {
      type: 'enum',
      multi: true,
      enumKey: 'Material',
      splitOn: MULTI_SPLIT,
      dropTokens: ['material'],
    },
    Pattern: {
      type: 'enum',
      multi: false,
      enumKey: 'Pattern',
    },
    'Power Source': {
      type: 'enum',
      multi: false,
      enumKey: 'Power Source',
      dropTokens: ['power source', 'power'],
    },
    'Connector Type': {
      type: 'enum',
      multi: true,
      enumKey: 'Connector Type',
      splitOn: /\s*[,/]\s*/,
    },
    'Connectivity Technology': {
      type: 'enum',
      multi: true,
      enumKey: 'Connectivity Technology',
      splitOn: MULTI_SPLIT,
    },
    'Upholstery Material': {
      type: 'enum',
      multi: false,
      enumKey: 'Upholstery Material',
    },

    /* ---- measurement fields ----
       kind is the js-quantities family name. If the parsed unit
       doesn't belong to that family we flag kind_mismatch rather
       than silently store a wrong-column value. */
    /* kind values MUST match qty.kind() output from js-quantities.
       Discovered by probe: V/potential, W/power, A/current,
       mAh/charge, g/mass, cm/length, ml/volume, GB/information,
       N*m/energy (Qty treats torque as energy dimensionally),
       psi/pressure, tempC/temperature, Hz/frequency,
       rpm/angular_velocity. */
    Voltage:            { type: 'measurement', kind: 'potential',          canonicalUnit: 'V',   precision: 1 },
    Wattage:            { type: 'measurement', kind: 'power',              canonicalUnit: 'W',   precision: 0 },
    Amperage:           { type: 'measurement', kind: 'current',            canonicalUnit: 'A',   precision: 2 },
    'Battery Capacity': { type: 'measurement', kind: 'charge',             canonicalUnit: 'mAh', precision: 0 },
    Weight:             { type: 'measurement', kind: 'mass',               canonicalUnit: 'g',   precision: 0 },
    Length:             { type: 'measurement', kind: 'length',             canonicalUnit: 'cm',  precision: 1 },
    Width:              { type: 'measurement', kind: 'length',             canonicalUnit: 'cm',  precision: 1 },
    Height:             { type: 'measurement', kind: 'length',             canonicalUnit: 'cm',  precision: 1 },
    Depth:              { type: 'measurement', kind: 'length',             canonicalUnit: 'cm',  precision: 1 },
    'Screen Size':      { type: 'measurement', kind: 'length',             canonicalUnit: 'in',  precision: 1 },
    Volume:             { type: 'measurement', kind: 'volume',             canonicalUnit: 'ml',  precision: 0 },
    Storage:            { type: 'measurement', kind: 'information',        canonicalUnit: 'GB',  precision: 0 },
    Memory:             { type: 'measurement', kind: 'information',        canonicalUnit: 'GB',  precision: 0 },
    RAM:                { type: 'measurement', kind: 'information',        canonicalUnit: 'GB',  precision: 0 },
    Torque:             { type: 'measurement', kind: 'energy',             canonicalUnit: 'N*m', precision: 1 },
    Pressure:           { type: 'measurement', kind: 'pressure',           canonicalUnit: 'psi', precision: 0 },
    Temperature:        { type: 'measurement', kind: 'temperature',        canonicalUnit: 'tempC', precision: 0 },
    Speed:              { type: 'measurement', kind: 'angular_velocity',   canonicalUnit: 'rpm', precision: 0 },
    Frequency:          { type: 'measurement', kind: 'frequency',          canonicalUnit: 'Hz',  precision: 0 },

    /* ---- text / free-form ---- */
    Model:        { type: 'text', clean: 'trim' },
    Brand:        { type: 'text', clean: 'trim' },
    Manufacturer: { type: 'text', clean: 'trim' },
    Description:  { type: 'text', clean: 'trimUnescape' },
    Notes:        { type: 'text', clean: 'trim' },
    SKU:          { type: 'text', clean: 'trim' },
    GTIN:         { type: 'text', clean: 'trim' },
    UPC:          { type: 'text', clean: 'trim' },
    EAN:          { type: 'text', clean: 'trim' },
    ASIN:         { type: 'text', clean: 'trim' },
  };

  /* Leading modifiers commonly attached to a base spec field name.
     Amazon / Icecat feeds emit "Maximum Pressure", "Min Voltage",
     "Peak Wattage", "Rated Current", "Continuous Power", etc. The
     underlying kind is identical to the base field (Pressure,
     Voltage, ...), so strip the modifier before looking up.
     Ordered longest-first so "Maximum" wins over "Max". */
  const LEADING_MODIFIERS = [
    'maximum', 'minimum', 'continuous', 'average',
    'nominal', 'operating', 'working', 'standard',
    'input', 'output', 'rated', 'total', 'peak',
    'max', 'min', 'avg',
  ];

  /* Case-insensitive index built once from FIELD_REGISTRY so
     lookups by any casing land on the canonical entry. */
  const LOWER_INDEX = Object.create(null);
  for (const key of Object.keys(FIELD_REGISTRY)) {
    LOWER_INDEX[key.toLowerCase()] = key;
  }

  function stripLeadingModifier(name) {
    const lower = String(name).toLowerCase().trim();
    for (const mod of LEADING_MODIFIERS) {
      /* Match "modifier<sep>rest" where sep is space, hyphen, or underscore. */
      if (lower.startsWith(mod + ' ') || lower.startsWith(mod + '-') || lower.startsWith(mod + '_')) {
        return name.slice(mod.length + 1).trim();
      }
    }
    return null;
  }

  function get(fieldName) {
    if (!fieldName) return null;
    /* 1. Exact match */
    if (FIELD_REGISTRY[fieldName]) return FIELD_REGISTRY[fieldName];
    /* 2. Case-insensitive match */
    const canonicalKey = LOWER_INDEX[String(fieldName).toLowerCase().trim()];
    if (canonicalKey) return FIELD_REGISTRY[canonicalKey];
    /* 3. Strip a leading modifier and try again. Recursive so
       "Peak Continuous Wattage" collapses to "Wattage". Bounded
       by the finite modifier list so it terminates. */
    const stripped = stripLeadingModifier(fieldName);
    if (stripped && stripped !== fieldName) return get(stripped);
    return null;
  }

  function has(fieldName) {
    return get(fieldName) !== null;
  }

  function list() {
    return Object.keys(FIELD_REGISTRY);
  }

  Object.assign(NS, {
    version: 2,
    FIELD_REGISTRY,
    get,
    has,
    list,
    MULTI_SPLIT,
    VARIANT_PREFIX,
    VARIANT_SUFFIX,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
