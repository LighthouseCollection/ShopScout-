/* =============================================================
   ShopScout — Stage 5: free-text spec miner
   Many products list important specs only in marketing bullets or
   the description paragraph, never in a structured spec table.
   This stage scans those strings for unit-bearing numeric patterns
   and emits Observations (type 'spec', confidence LOW).
   ============================================================= */
(function initSpecMiner(root) {
  const NS = (root.SSExtract = root.SSExtract || {});
  const obs = NS.observation;
  const C   = NS.Confidence;

  /* Pattern table. Order matters — first match wins for a given key. */
  const PATTERNS = [
    /* Power-tool / rotational */
    { key: 'Max torque',       re: /(\d+(?:\.\d+)?)\s*(N[·.\s]?m|Nm|newton[-\s]?meter)s?\b/i,                    unitTpl: 'N·m' },
    { key: 'Max torque',       re: /(\d+(?:\.\d+)?)\s*(in[-\s]?lbs?|inch[-\s]?pound)s?\b/i,                       unitTpl: 'in-lb' },
    { key: 'Max torque',       re: /(\d+(?:\.\d+)?)\s*(ft[-\s]?lbs?|foot[-\s]?pound)s?\b/i,                       unitTpl: 'ft-lb' },
    { key: 'Speed',            re: /(\d{2,5}(?:\.\d+)?)\s*RPM\b/i,                                                  unitTpl: 'RPM' },
    /* Electrical */
    { key: 'Voltage',          re: /(\d+(?:\.\d+)?)\s*V(?:olt|olts|oltage)?\b(?!\w)/i,                              unitTpl: 'V' },
    { key: 'Wattage',          re: /(\d+(?:\.\d+)?)\s*W(?:att|atts|attage)?\b(?!\w)/i,                              unitTpl: 'W' },
    { key: 'Current',          re: /(\d+(?:\.\d+)?)\s*(mA|A)(?:mp|mps|mpere|mperes)?\b/i,                           unitTpl: '$2' },
    { key: 'Battery capacity', re: /(\d+(?:\.\d+)?)\s*mAh\b/i,                                                      unitTpl: 'mAh' },
    { key: 'Battery energy',   re: /(\d+(?:\.\d+)?)\s*Wh\b/i,                                                       unitTpl: 'Wh' },
    /* Display / frequency */
    { key: 'Refresh rate',     re: /(\d{2,4}(?:\.\d+)?)\s*Hz\b(?!\w)/i,                                             unitTpl: 'Hz' },
    { key: 'Clock speed',      re: /(\d+(?:\.\d+)?)\s*GHz\b/i,                                                      unitTpl: 'GHz' },
    { key: 'Screen size',      re: /(\d{2,3}(?:\.\d+)?)\s*(?:inch(?:es)?|"|”)\s*(?:display|screen|monitor|tv|smart\s*tv)/i, unitTpl: '"' },
    { key: 'Resolution',       re: /\b(\d{3,4}\s*[xX×]\s*\d{3,4})\b/,                                               unitTpl: '' },
    { key: 'Resolution',       re: /\b(4K|8K|UHD|QHD|FHD|Full\s*HD|HD|2K)\b/i,                                      unitTpl: '' },
    { key: 'Pixel density',    re: /(\d+(?:\.\d+)?)\s*PPI\b/i,                                                      unitTpl: 'PPI' },
    { key: 'Print resolution', re: /(\d+(?:\.\d+)?)\s*DPI\b/i,                                                      unitTpl: 'DPI' },
    { key: 'Frame rate',       re: /(\d+(?:\.\d+)?)\s*(?:FPS|frames?\s*per\s*second)\b/i,                           unitTpl: 'FPS' },
    /* Memory / storage */
    { key: 'Storage',          re: /(\d+(?:\.\d+)?)\s*TB\b/i,                                                       unitTpl: 'TB' },
    { key: 'Storage',          re: /(\d+(?:\.\d+)?)\s*GB\b\s*(?:storage|ssd|hdd|memory|drive|emmc|nvme)/i,          unitTpl: 'GB' },
    { key: 'Memory',           re: /(\d+(?:\.\d+)?)\s*GB\b\s*(?:ram|ddr)/i,                                         unitTpl: 'GB' },
    /* Weight */
    { key: 'Weight',           re: /(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/i,                                         unitTpl: 'lb' },
    { key: 'Weight',           re: /(\d+(?:\.\d+)?)\s*(?:kg|kilograms?)\b/i,                                        unitTpl: 'kg' },
    { key: 'Weight',           re: /(\d+(?:\.\d+)?)\s*(?:g|grams?)\b(?!\w)/i,                                       unitTpl: 'g' },
    { key: 'Weight',           re: /(\d+(?:\.\d+)?)\s*(?:oz|ounces?)\b(?!\w)/i,                                     unitTpl: 'oz' },
    /* Dimensions */
    { key: 'Dimensions',       re: /(\d+(?:\.\d+)?\s*[xX×]\s*\d+(?:\.\d+)?\s*[xX×]\s*\d+(?:\.\d+)?\s*(?:in|inch|inches|"|cm|mm|m)\b)/i, unitTpl: '' },
    /* Connectivity */
    { key: 'Bluetooth',        re: /Bluetooth\s*v?(\d+(?:\.\d+)?)\b/i,                                              unitTpl: '' },
    { key: 'Wi-Fi',            re: /Wi[-\s]?Fi\s*(\d+|[a-z]{1,3})\b/i,                                              unitTpl: '' },
    /* Optics */
    { key: 'Megapixels',       re: /(\d+(?:\.\d+)?)\s*(?:MP|megapixels?)\b/i,                                       unitTpl: 'MP' },
    /* Volume */
    { key: 'Volume',           re: /(\d+(?:\.\d+)?)\s*(?:ml|milliliters?)\b/i,                                      unitTpl: 'mL' },
    { key: 'Volume',           re: /(\d+(?:\.\d+)?)\s*(?:l|liters?)\b(?!\w)/i,                                      unitTpl: 'L' },
    { key: 'Volume',           re: /(\d+(?:\.\d+)?)\s*(?:fl\s*oz|fluid\s*ounce)s?\b/i,                              unitTpl: 'fl oz' }
  ];

  function mine(text, existingKeysLower) {
    const observations = [];
    if (!text) return observations;
    /* Collapse whitespace AND strip grouping commas inside numbers so
       "5,000-35,000 RPM" doesn't end up matching as "000 RPM". */
    const haystack = String(text)
      .replace(/(\d),(\d{3})\b/g, '$1$2')
      .replace(/(\d),(\d{3})\b/g, '$1$2')   /* run twice for triplets */
      .replace(/\s+/g, ' ').trim();
    if (!haystack) return observations;

    const seen = new Set(existingKeysLower || []);
    for (const pat of PATTERNS) {
      const kLow = pat.key.toLowerCase();
      if (seen.has(kLow)) continue;
      const m = haystack.match(pat.re);
      if (!m) continue;
      const num = m[1];
      let unit = pat.unitTpl;
      if (unit && unit.startsWith('$')) unit = m[parseInt(unit.slice(1), 10)] || '';
      const value = unit ? (num + ' ' + unit) : num;
      observations.push(obs({
        type: 'spec',
        key: pat.key,
        value: value.replace(/\s+/g, ' ').trim(),
        source: 'miner:text',
        confidence: C.LOW,
        rawText: m[0]
      }));
      seen.add(kLow);
    }
    return observations;
  }

  NS.specMiner = { mine };
})(globalThis);
