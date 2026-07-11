/* =============================================================
   ShopScout — measurement normalizer (normalization v2)

   Handles registry.type === 'measurement' fields (Voltage,
   Wattage, Weight, Length, Battery Capacity, Volume, Storage,
   Torque, Pressure, Temperature, Frequency, ...).

   Uses js-quantities (root.Qty) to parse the number+unit tuple
   AND convert to the field's canonical unit. Every value in a
   given column comes out in the same unit, so "23.6 inches" and
   "50 centimeters" both become "60.0 cm" side by side in the
   Length column.

   Pipeline for each raw value:
     1. cleanUnitToken — strip parenthesized notes ("(DC)"),
        collapse underscore/hyphen runs, replace "_of_" phrases
        that come from tokenized source strings
        ("volts_of_direct_current" -> "volts"), lowercase the unit tail
     2. Parse "<number> <unit>" out of the cleaned string
        - if no unit but rawValue is a bare number and the field
          has a canonical unit, infer the unit from the field
          ("12" on Voltage -> "12 V")
     3. Qty(number + unit)
        - if Qty throws (unknown unit), record warning + null canonical
     4. Kind check: qty.kind() must match config.kind
        ("5 kg" on Length is kind_mismatch — do not silently
        write to the wrong column)
     5. Convert to config.canonicalUnit via qty.to(target)
     6. Round to config.precision
     7. Emit {raw, canonical, unit, display, provenance}
   ============================================================= */
(function initShopScoutMeasurementNormalizer(root) {
  const NS = (root.ShopScoutMeasurementNormalizer = root.ShopScoutMeasurementNormalizer || {});

  /* Unit tokens the raw feeds emit that Qty won't recognize.
     Map each to a Qty-parseable synonym before we try to parse. */
  const UNIT_SYNONYMS = {
    'volts of direct current':   'V',
    'volts of alternating current': 'V',
    'volt of direct current':    'V',
    'volts dc':                  'V',
    'volts ac':                  'V',
    'v dc':                      'V',
    'v ac':                      'V',
    'volts':                     'V',
    'volt':                      'V',
    'watts':                     'W',
    'watt':                      'W',
    'kilowatts':                 'kW',
    'amps':                      'A',
    'amp':                       'A',
    'ampere':                    'A',
    'amperes':                   'A',
    'milliamp hours':            'mAh',
    'milliamp hour':             'mAh',
    'milliampere hours':         'mAh',
    'milliampere hour':          'mAh',
    'milliamp-hour':             'mAh',
    'amp hours':                 'Ah',
    'amp hour':                  'Ah',
    'ampere hours':              'Ah',
    'grams':                     'g',
    'gram':                      'g',
    'kilograms':                 'kg',
    'kilogram':                  'kg',
    'pounds':                    'lb',
    'pound':                     'lb',
    'lbs':                       'lb',
    'ounces':                    'oz',
    'ounce':                     'oz',
    'inches':                    'in',
    'inch':                      'in',
    'feet':                      'ft',
    'foot':                      'ft',
    'centimeters':               'cm',
    'centimeter':                'cm',
    'centimetres':               'cm',
    'centimetre':                'cm',
    'millimeters':               'mm',
    'millimeter':                'mm',
    'meters':                    'm',
    'meter':                     'm',
    'metres':                    'm',
    'metre':                     'm',
    'liters':                    'l',
    'liter':                     'l',
    'litres':                    'l',
    'litre':                     'l',
    'milliliters':               'ml',
    'milliliter':                'ml',
    'fluid ounces':              'floz',
    'fluid ounce':               'floz',
    'fl oz':                     'floz',
    'gallons':                   'gal',
    'gallon':                    'gal',
    'gigabytes':                 'GB',
    'gigabyte':                  'GB',
    'megabytes':                 'MB',
    'megabyte':                  'MB',
    'terabytes':                 'TB',
    'terabyte':                  'TB',
    'kilobytes':                 'KB',
    'kilobyte':                  'KB',
    'newton meters':             'N*m',
    'newton meter':              'N*m',
    'newton-meter':              'N*m',
    'nm':                        'N*m',
    'foot pounds':               'ft*lb',
    'foot-pounds':               'ft*lb',
    'ft lb':                     'ft*lb',
    'psi':                       'psi',
    'pounds per square inch':    'psi',
    'bar':                       'bar',
    'pascals':                   'Pa',
    'pascal':                    'Pa',
    'hertz':                     'Hz',
    'kilohertz':                 'kHz',
    'megahertz':                 'MHz',
    'gigahertz':                 'GHz',
    'celsius':                   'tempC',
    'fahrenheit':                'tempF',
    'degrees celsius':           'tempC',
    'degrees fahrenheit':        'tempF',
    'rpm':                       'rpm',
    'revolutions per minute':    'rpm',
  };

  function cleanUnitToken(raw) {
    let s = String(raw);
    /* Strip parenthesized notes: "12 V (DC)" -> "12 V " */
    s = s.replace(/\s*\([^)]*\)\s*/g, ' ');
    /* Underscore/hyphen runs come from tokenized source strings
       ("volts_of_direct_current") -- flatten to spaces. Do NOT
       flatten a single hyphen between digits and letters like
       "3-cell" or the sign in "-5". */
    s = s.replace(/_+/g, ' ');
    s = s.replace(/([a-zA-Z])-([a-zA-Z])/g, '$1 $2');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  /* Split "<number> <unit-tail>" out of a cleaned string.
     Accepts commas as thousands ("1,000 mAh"). Returns
     { value, unit } or null. */
  function splitNumberAndUnit(cleaned) {
    const m = cleaned.match(/^\s*(-?[\d,]+(?:\.\d+)?)\s*(.*)$/);
    if (!m) return null;
    const raw = m[1].replace(/,/g, '');
    const value = Number(raw);
    if (!isFinite(value)) return null;
    const unit = (m[2] || '').trim();
    return { value, unit };
  }

  function mapSynonym(unit) {
    if (!unit) return '';
    const lower = unit.toLowerCase();
    if (UNIT_SYNONYMS[lower]) return UNIT_SYNONYMS[lower];
    return unit;
  }

  function round(n, precision) {
    const p = Math.pow(10, Math.max(0, precision | 0));
    return Math.round(n * p) / p;
  }

  function formatDisplay(canonical, unit) {
    /* Temperatures print as "60 °C" -- Qty spells them tempC/tempF. */
    if (unit === 'tempC') return `${canonical} °C`;
    if (unit === 'tempF') return `${canonical} °F`;
    if (unit === 'N*m')  return `${canonical} Nm`;
    if (unit === 'ft*lb') return `${canonical} ft·lb`;
    return `${canonical} ${unit}`;
  }

  function normalizeMeasurement(rawValue, config) {
    if (rawValue == null || rawValue === '') {
      return {
        raw: rawValue == null ? null : '',
        canonical: null,
        unit: null,
        display: '—',
        provenance: { method: 'measurement.empty', confidence: 0, warnings: ['empty_input'] },
      };
    }
    const raw = String(rawValue);
    const cleaned = cleanUnitToken(raw);
    const parts = splitNumberAndUnit(cleaned);
    if (!parts) {
      return {
        raw,
        canonical: null,
        unit: null,
        display: raw,
        provenance: { method: 'measurement.parse', confidence: 0, warnings: ['unparseable_scalar'] },
      };
    }

    let { value, unit } = parts;
    const warnings = [];

    /* Bare number on a field with a canonical unit -> infer.
       "12" on Voltage -> "12 V". Confidence drops so review can
       flag these for verification. */
    if (!unit) {
      if (!config.canonicalUnit) {
        return {
          raw,
          canonical: null,
          unit: null,
          display: raw,
          provenance: { method: 'measurement.parse', confidence: 0, warnings: ['no_unit'] },
        };
      }
      unit = config.canonicalUnit;
      warnings.push('inferred_unit_from_field');
    } else {
      const mapped = mapSynonym(unit);
      if (mapped !== unit) warnings.push('unit_token_synonymed');
      unit = mapped;
    }

    if (!root.Qty) {
      /* Qty isn't loaded (Node test without vendor script). Do a
         best-effort passthrough: if the parsed unit equals the
         canonical unit, take the scalar as canonical; otherwise
         we can't convert. */
      if (unit === config.canonicalUnit) {
        return {
          raw,
          canonical: round(value, config.precision),
          unit: config.canonicalUnit,
          display: formatDisplay(round(value, config.precision), config.canonicalUnit),
          provenance: { method: 'measurement.no-qty', confidence: 0.5, warnings: [...warnings, 'qty_unavailable'] },
        };
      }
      return {
        raw,
        canonical: null,
        unit: null,
        display: raw,
        provenance: { method: 'measurement.no-qty', confidence: 0, warnings: [...warnings, 'qty_unavailable', 'unit_not_canonical'] },
      };
    }

    let qty;
    try {
      qty = root.Qty(`${value} ${unit}`);
    } catch (err) {
      return {
        raw,
        canonical: null,
        unit: null,
        display: raw,
        provenance: { method: 'measurement.qty-throw', confidence: 0, warnings: [...warnings, 'unknown_unit:' + unit] },
      };
    }

    if (config.kind && typeof qty.kind === 'function') {
      const parsedKind = qty.kind();
      if (parsedKind && parsedKind !== config.kind) {
        /* "5 kg" on a Length field lands here. Do not write it. */
        return {
          raw,
          canonical: null,
          unit: null,
          display: raw,
          provenance: { method: 'measurement.kind-mismatch', confidence: 0, warnings: [...warnings, `kind_mismatch:expected=${config.kind},got=${parsedKind}`] },
        };
      }
    }

    let converted;
    try {
      converted = qty.to(config.canonicalUnit);
    } catch (err) {
      return {
        raw,
        canonical: null,
        unit: null,
        display: raw,
        provenance: { method: 'measurement.convert-fail', confidence: 0, warnings: [...warnings, `convert_fail:${unit}->${config.canonicalUnit}`] },
      };
    }

    const scalar = round(converted.scalar, config.precision);
    return {
      raw,
      canonical: scalar,
      unit: config.canonicalUnit,
      display: formatDisplay(scalar, config.canonicalUnit),
      provenance: {
        method: 'measurement.parse-convert',
        confidence: warnings.length === 0 ? 1 : 0.8,
        warnings,
      },
    };
  }

  Object.assign(NS, {
    version: 2,
    normalize: normalizeMeasurement,
    _cleanUnitToken: cleanUnitToken,
    _splitNumberAndUnit: splitNumberAndUnit,
    _mapSynonym: mapSynonym,
    _synonyms: UNIT_SYNONYMS,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
