/* =============================================================
   ShopScout — Extraction confidence enum + arbitration rules
   Every Observation carries a `confidence` value. When two
   observations claim the same field, the higher-confidence one
   wins. JSON-LD beats microdata beats OpenGraph beats adapter
   beats text-miner beats inference.
   ============================================================= */
(function initConfidenceRules(root) {
  const NS = (root.SSExtract = root.SSExtract || {});

  /* Enum — keep these strings stable; the assembler compares them. */
  const Confidence = Object.freeze({
    HIGH:   'high',     // JSON-LD, microdata, OpenGraph
    MEDIUM: 'medium',   // marketplace-adapter direct selector hit
    LOW:    'low',      // free-text mining, fallback inference
    NONE:   'none'      // explicit absence
  });

  /* Numeric weight for comparison. Higher wins. */
  const WEIGHTS = {
    high:   3,
    medium: 2,
    low:    1,
    none:   0
  };

  function weightOf(c) { return WEIGHTS[c] != null ? WEIGHTS[c] : 0; }

  /* `a` is at-least-as-confident as `b`. */
  function gte(a, b) { return weightOf(a) >= weightOf(b); }
  function gt (a, b) { return weightOf(a) >  weightOf(b); }

  /* Standard source-string -> confidence mapping. Sources are
     stable strings ('json-ld', 'microdata', 'opengraph',
     'adapter:amazon-po', 'adapter:amazon-legacy',
     'adapter:generic-table', 'miner:text', 'inference', etc.).
     Adapters can override per-observation by passing an explicit
     confidence on the Observation. */
  function defaultConfidenceFor(source) {
    if (!source) return Confidence.LOW;
    if (source === 'json-ld')   return Confidence.HIGH;
    if (source === 'microdata') return Confidence.HIGH;
    if (source === 'opengraph') return Confidence.HIGH;
    if (source.startsWith('adapter:')) return Confidence.MEDIUM;
    if (source.startsWith('miner:'))   return Confidence.LOW;
    if (source === 'inference') return Confidence.LOW;
    return Confidence.LOW;
  }

  NS.Confidence = Confidence;
  NS.confidenceWeight = weightOf;
  NS.confidenceGte = gte;
  NS.confidenceGt = gt;
  NS.defaultConfidenceFor = defaultConfidenceFor;
})(globalThis);
