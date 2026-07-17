# Normalization spec — one pipeline, typed fields, `{raw, canonical}` values

Status: **Implemented in phased slices.** This file now records the v2 normalization architecture and remaining compatibility boundaries.

## Why

The original implementation normalized values in three parallel places (`SSCanonical.canonicalValue`, `ShopScoutAttributeNormalization`, `ShopScoutValues.prettify`) that did not converge. The v2 path replaces that with one dispatcher and persisted `specsNormalized` envelopes so the grid, review queue, and prompts can read the same normalized value source.

Rather than reconciling three tracks, the correct shape is **one pipeline** with three moving parts:

1. A **field registry** that declares, for each field name, its type (enum / measurement / text) and its normalization config.
2. A **value shape** — every field's stored value is `{ raw, canonical, provenance }` — so the review UI can compare and the render path always reads `.canonical`.
3. A **normalizer dispatch** — one function per type, chosen by the registry lookup. No field-specific branching outside the registry.

## The three parts

### 1. Field registry

One file: `normalization/registry.js`. Every canonical field name maps to one config object:

```js
export const FIELD_REGISTRY = {
  // ---- enum fields ----
  Color: {
    type: 'enum',
    multi: true,                              // "Black & Red" produces ["Black", "Red"]
    enum: 'colors',                           // key into normalization/libraries/enums.js
    splitOn: /[,&/·•;]|\s-\s|\s+/,            // tokens broken on any of these
    stripPrefix: /^\d+[-.\s]+/,               // "2-blue" -> "blue"
    stripSuffix: /\s+\d+$/,                   // "Black 2" -> "Black"
    dropTokens: ['color', 'colour'],
  },
  Material:      { type: 'enum', multi: true, enum: 'materials', splitOn: /[,&/·•;]/ },
  Pattern:       { type: 'enum', multi: false, enum: 'patterns' },
  PowerSource:   { type: 'enum', multi: false, enum: 'powerSources' },
  ConnectorType: { type: 'enum', multi: true, enum: 'connectors', splitOn: /[,/]/ },

  // ---- measurement fields ----
  Voltage:        { type: 'measurement', kind: 'electric_potential', canonicalUnit: 'V',   precision: 1 },
  Wattage:        { type: 'measurement', kind: 'power',              canonicalUnit: 'W',   precision: 0 },
  Amperage:       { type: 'measurement', kind: 'current',            canonicalUnit: 'A',   precision: 2 },
  BatteryCapacity:{ type: 'measurement', kind: 'charge',             canonicalUnit: 'mAh', precision: 0 },
  Weight:         { type: 'measurement', kind: 'mass',               canonicalUnit: 'g',   precision: 0 },
  Length:         { type: 'measurement', kind: 'length',             canonicalUnit: 'cm',  precision: 1 },
  ScreenSize:     { type: 'measurement', kind: 'length',             canonicalUnit: 'in',  precision: 1 },
  Volume:         { type: 'measurement', kind: 'volume',             canonicalUnit: 'ml',  precision: 0 },
  Storage:        { type: 'measurement', kind: 'data',               canonicalUnit: 'GB',  precision: 0 },
  Torque:         { type: 'measurement', kind: 'torque',             canonicalUnit: 'Nm',  precision: 1 },
  Pressure:       { type: 'measurement', kind: 'pressure',           canonicalUnit: 'psi', precision: 0 },
  Temperature:    { type: 'measurement', kind: 'temperature',        canonicalUnit: 'C',   precision: 0 },
  Speed:          { type: 'measurement', kind: 'angular_speed',      canonicalUnit: 'rpm', precision: 0 },

  // ---- text / free-form ----
  Model:       { type: 'text', clean: 'trim' },
  Description: { type: 'text', clean: 'trimUnescape' },
  Notes:       { type: 'text', clean: 'trim' },
};
```

**Key point**: the registry is the *only* place a field's normalization behavior is declared. No extractor, no UI component, no cell formatter knows about specific fields.

**`kind` is field-declared, not inferred.** A registry entry that names `kind: 'length'` forces the measurement normalizer to only accept units in the length family — so `"5 kg"` on a Length field is a validation error, not a silent pass-through. This blocks the class of bugs where a scraper accidentally maps Weight into a Length column.

### 2. Value shape

Every field's stored value is:

```js
{
  raw: "23.6 inches",              // exact source text, unmodified
  canonical: 60.0,                 // number (measurement) or string (text) or array (enum multi)
  unit: "cm",                      // measurement only; matches registry.canonicalUnit
  display: "60.0 cm",              // pre-rendered string for the grid; single source of truth for pill text
  provenance: {
    method: "measurement.parse",   // which normalizer produced this
    confidence: 0.95,              // 0..1
    warnings: [],                  // e.g. ["unit_token_cleaned"] when we had to strip "volts_of_direct_current"
  }
}
```

For enum multi-value:

```js
{
  raw: "Black & Red",
  canonical: ["black", "red"],     // lowercase enum keys
  display: ["Black", "Red"],       // display-cased for pills
  provenance: { method: "enum.split-and-map", confidence: 1.0, warnings: [] }
}
```

For unmapped / unparseable:

```js
{
  raw: "?",
  canonical: null,
  display: "—",
  provenance: { method: "measurement.parse", confidence: 0.0, warnings: ["unparseable_scalar"] }
}
```

**Invariant**: if `canonical !== null`, the UI is guaranteed to render `display`. The UI never falls back to `raw`. Raw is only shown in the review tool alongside canonical for auditing.

### 3. Normalizer dispatch

One function, one file (`normalization/normalize.js`):

```js
import { FIELD_REGISTRY } from './registry.js';
import { normalizeEnum }        from './normalizers/enum.js';
import { normalizeMeasurement } from './normalizers/measurement.js';
import { normalizeText }        from './normalizers/text.js';

const NORMALIZERS = {
  enum: normalizeEnum,
  measurement: normalizeMeasurement,
  text: normalizeText,
};

export function normalizeField(fieldName, rawValue) {
  const config = FIELD_REGISTRY[fieldName];
  if (!config) return { raw: rawValue, canonical: null, display: String(rawValue), provenance: { method: 'unregistered', confidence: 0, warnings: ['unknown_field'] } };
  return NORMALIZERS[config.type](rawValue, config);
}
```

Each `normalizers/*.js` file handles one type end-to-end. No cross-referencing.

#### `normalizers/measurement.js` — the fix for voltage/length/weight/etc.

Pseudocode:

```
input: rawValue string, config {kind, canonicalUnit, precision}

1. cleanUnitToken(rawValue):
     - lowercase the tail after the last digit
     - replace "_of_" and "_" and "-" runs with " "
     - strip parenthesized notes: "12 V (DC)" -> "12 V"
     - keep known unit tail intact, drop trailing marketing words
2. parse "<number> <unit>" out of the cleaned string
   - if no unit but rawValue.match(/^\d+(\.\d+)?$/): unit = config.canonicalUnit (bare "12" on a Voltage field means volts)
   - if still no unit: return {canonical: null, warnings: ['no_unit']}
3. qty = Qty(number + unit)
   - if Qty throws: return {canonical: null, warnings: ['unknown_unit', tokenSeen]}
4. if qty.kind() !== config.kind: return {canonical: null, warnings: ['kind_mismatch', qty.kind()]}
   - "5 kg" on a Length field lands here — audit, don't silently pass
5. converted = qty.to(config.canonicalUnit).scalar
6. return {
     raw: rawValue,
     canonical: round(converted, config.precision),
     unit: config.canonicalUnit,
     display: `${canonical} ${unit}`,
     provenance: {method: 'measurement.parse', confidence: 1.0, warnings: []}
   }
```

This one function fixes voltage's `volts_of_direct_current`, length's mixed units, weight's lb/kg mixing, and every other measurement field in the registry. Zero per-field code.

#### `normalizers/enum.js` — the fix for color/material/pattern

Pseudocode:

```
input: rawValue string, config {enum, multi, splitOn, stripPrefix, stripSuffix, dropTokens}

1. tokens = multi ? rawValue.split(splitOn) : [rawValue]
2. for each token:
     - stripPrefix, stripSuffix
     - trim, lowercase
     - drop if in dropTokens
     - lookup in ENUM_TABLES[config.enum]:
         - hit → canonical key + display label
         - miss → keep raw token as-is with a warning, so the review UI can surface it
3. return {
     raw: rawValue,
     canonical: [keys...] or key,
     display: [labels...] or label,
     provenance: {method: 'enum.split-and-map', confidence: hits/tokens, warnings: [misses]}
   }
```

Enum tables live in `normalization/libraries/enums.js`, seeded from the existing `defaultRules.js` for the fields already there and extended for the rest. Adding a new enum value is one line in one file.

### Wire-up

The pipeline meets the extraction path in exactly one place — `content/productSchema.assemble`:

```
for each observation from an adapter:
  fieldName = keyCanonicalizer(observation.key)       // "Battery Capacity" -> "BatteryCapacity"
  entry = normalizeField(fieldName, observation.value)
  flat.specs[fieldName] = entry                        // full {raw, canonical, display, provenance}
```

`flat.specs.Voltage` is no longer a bare string — it's the entry object. Every downstream reader (grid, comparison view, export, AI prompt builder) reads `.display` or `.canonical`. `_normalizedAttributes` goes away — it was just a sidecar for what should have been the primary value.

## Migration

- **New products**: extraction writes the new entry shape from day one.
- **Existing products in IndexedDB**: on load, if `flat.specs.<field>` is a bare string, run it through `normalizeField` and rewrite the row. One-shot migration, versioned via `productRepo.schemaVersion` bump.
- **AG-Grid readers**: change every `product.specs.Color` → `product.specs.Color?.display ?? '—'` at exactly the display sites. Filter/sort keys use `.canonical`.
- **Legacy files retire**: `SSCanonical.canonicalValue`, `ShopScoutAttributeNormalization`, `ShopScoutValues.prettify` all delete after migration lands. Their tests move to `normalization/` and get rewritten around real messy inputs.

## Tests

Golden-file style: `tests/normalization/fixtures/{field}/*.json` where each fixture is `{ raw, expected }` for a real messy string. New adapter seen doing something dumb → add a fixture, red test, fix the normalizer, green. No more clean-input synthetic assertions.

## Out of scope for v1

- User rules (user-editable overrides). The registry entry gains a `userOverride` hook later; day-one ships without.
- Cross-field inference (e.g. "no unit on Voltage but a sibling field says '9V battery'"). Nice future feature, not a launch blocker.
- Currency (Price). Its own thing; stays where it is.

## What lands, in what order

If you approve:

1. **Registry + value shape + normalizers** — pure additions, no callers changed. Green on new tests. (One PR.)
2. **Wire into `productSchema.assemble`** — new products get the new shape. Old readers still work because we also write a legacy string. (One PR, safe rollout.)
3. **Switch readers** — grid, comparison, export, AI prompt builder all read `.display` / `.canonical`. Legacy string stops being written. (One PR per reader, or bundled.)
4. **Migration** — one-shot pass over IndexedDB on version bump. (One PR.)
5. **Delete the three old tracks + retire their tests.** (One PR.)

Total: ~5 focused commits. Each is revertible without touching the others.

## Phase 5 as shipped

Phase 5 landed in follow-up slices:

- ✅ **`ShopScoutValues.prettify` and friends** (`normalizeMeasurement`, `normalizeMetric`, `normalizeDimensions`) — removed from `shared/values/cellValues.js` exports; test file `tests/local-units.test.js` deleted. These had zero non-test callers so retirement is complete.
- ✅ **`SSCanonical.canonicalValue`** — removed from the public `SSCanonical` API. `productSchema.assemble` now writes ProductSpec entries with `value` plus the v2 `.normalized` envelope; it no longer persists the legacy `canonicalValue` field for new captures.
- ✅ **`ShopScoutAttributeNormalization` / `_normalizedAttributes`** — retired from runtime. ProductRepo writes v2 `specsNormalized`, the grid projects from v2 display values, and the normalization review queue reads `rawSpecs` + `specsNormalized` instead of the old sidecar.
- ✅ **`content/productSchema.js` flat spec compatibility writes** — retired. `toLegacyFlatProduct()` now projects identity, price, media, identifiers, `_spec`, and `specsNormalized`; it no longer writes `flat.specs` or `flat.rawSpecs` for new captures.

Read-only fallback support for already-saved old records remains in central access helpers so existing IndexedDB products can still render during migration. New writes should not create `canonicalValue` entries or `flat.specs` / `flat.rawSpecs` from the extraction projection.

---

**Open questions for you before I write any code:**

1. Canonical units — I picked V / W / A / mAh / g / cm / in (screens) / ml / GB / Nm / psi / C / rpm. Any you'd override? (e.g. Length in inches instead of cm because you're primarily US-market?)
2. Enum unmapped tokens — for `"Black&Neon-Punk"` where "Black" maps but "Neon-Punk" doesn't, do you want the pill to render `["Black", "Neon-Punk"]` (pass-through unmapped) or just `["Black"]` (drop unmapped)? Review UI surfaces the miss either way.
3. Migration path — okay to bump `productRepo.schemaVersion` and run a one-shot migration on next load, or should we support reading both shapes indefinitely?
