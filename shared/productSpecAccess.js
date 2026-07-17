/* =============================================================
   ShopScout — ProductSpec read access helpers

   Centralizes read-only access across ProductSpec, v2 normalized
   sidecars, and legacy flat spec shapes. This is the Task #70
   migration boundary: consumers should ask this module for spec
   entries instead of branching over rawSpecs/specs/_spec directly.
   ============================================================= */
(function initShopScoutProductSpecAccess(root) {
  const NS = (root.ShopScoutProductSpecAccess = root.ShopScoutProductSpecAccess || {});

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function canonicalKey(value, scope) {
    const env = scope || root;
    const canon = env.SSCanonical || root.SSCanonical;
    if (canon && typeof canon.canonicalKey === 'function') return canon.canonicalKey(value);
    return text(value).replace(/\s+/g, ' ');
  }

  function normalizedLookup(product, scope) {
    const out = Object.create(null);
    const normalized = product?.specsNormalized;
    if (!normalized || typeof normalized !== 'object') return out;
    for (const [fieldName, envelope] of Object.entries(normalized)) {
      const key = canonicalKey(fieldName, scope);
      if (!key || !envelope || typeof envelope !== 'object') continue;
      out[key] = envelope;
    }
    return out;
  }

  function displayFromEnvelope(envelope) {
    if (!envelope || envelope.display == null || envelope.display === '—') return '';
    return Array.isArray(envelope.display) ? envelope.display.join(', ') : String(envelope.display);
  }

  function sourcesFrom(entry, fallbackSource) {
    const out = [];
    if (Array.isArray(entry?.sources)) {
      for (const source of entry.sources) {
        const value = text(source);
        if (value) out.push(value);
      }
    }
    const single = text(entry?.source || fallbackSource);
    if (single) out.push(single);
    return [...new Set(out)];
  }

  function entryValue(entry) {
    if (entry && typeof entry === 'object') {
      return entry.rawValue ?? entry.value ?? entry.canonicalValue ?? '';
    }
    return entry;
  }

  function entryDisplay(entry, envelope, raw) {
    const fromEnvelope = displayFromEnvelope(envelope);
    if (fromEnvelope) return fromEnvelope;
    if (entry && typeof entry === 'object' && entry.value != null) return String(entry.value);
    if (entry && typeof entry === 'object' && entry.canonicalValue != null) return String(entry.canonicalValue);
    return text(raw);
  }

  function makeEntry(product, fieldName, rawValue, sourceEntry, envelope, scope) {
    const field = canonicalKey(fieldName, scope);
    if (!field) return null;
    const raw = text(rawValue);
    const sources = sourcesFrom(sourceEntry, sourceEntry?.source);
    return {
      field,
      rawField: text(sourceEntry?.rawKey || sourceEntry?.key || fieldName),
      raw,
      value: entryDisplay(sourceEntry, envelope, raw),
      display: entryDisplay(sourceEntry, envelope, raw),
      normalized: envelope || null,
      confidence: typeof sourceEntry?.confidence === 'number'
        ? sourceEntry.confidence
        : typeof envelope?.provenance?.confidence === 'number'
          ? envelope.provenance.confidence
          : null,
      source: sources[0] || '',
      sources,
      entry: sourceEntry && typeof sourceEntry === 'object' ? sourceEntry : null
    };
  }

  function addEntry(out, seen, product, fieldName, rawValue, sourceEntry, envelopes, scope) {
    const field = canonicalKey(fieldName, scope);
    if (!field || seen.has(field)) return;
    const entry = makeEntry(product, fieldName, rawValue, sourceEntry, envelopes[field], scope);
    if (!entry) return;
    seen.add(field);
    out.push(entry);
  }

  function addProductSpecBucket(out, seen, product, bucket, envelopes, scope) {
    if (!bucket || typeof bucket !== 'object') return;
    for (const [fieldName, sourceEntry] of Object.entries(bucket)) {
      const rawValue = entryValue(sourceEntry);
      addEntry(out, seen, product, fieldName, rawValue, sourceEntry, envelopes, scope);
    }
  }

  function productSpecEntryForRaw(product, rawKey, scope) {
    const wanted = canonicalKey(rawKey, scope);
    for (const bucket of [product?._spec?.specs, product?._spec?.itemDetails]) {
      if (!bucket || typeof bucket !== 'object') continue;
      for (const [fieldName, sourceEntry] of Object.entries(bucket)) {
        const entryKey = sourceEntry?.rawKey || fieldName;
        if (canonicalKey(entryKey, scope) === wanted) return sourceEntry;
      }
    }
    return null;
  }

  function specEntries(product, options) {
    const opts = options || {};
    const scope = opts.root || root;
    const out = [];
    const seen = new Set();
    const envelopes = normalizedLookup(product, scope);

    if (Array.isArray(product?.rawSpecs)) {
      for (const rawSpec of product.rawSpecs) {
        if (!rawSpec || rawSpec.key == null) continue;
        const field = canonicalKey(rawSpec.key, scope);
        const specEntry = productSpecEntryForRaw(product, rawSpec.key, scope)
          || rawSpec;
        const rawValue = specEntry && typeof specEntry === 'object' && specEntry.rawValue != null
          ? specEntry.rawValue
          : rawSpec.value;
        addEntry(out, seen, product, rawSpec.key, rawValue, specEntry, envelopes, scope);
        if (field && out[out.length - 1]?.field === field) {
          out[out.length - 1].rawField = text(rawSpec.key);
          if (!out[out.length - 1].source && rawSpec.source) {
            out[out.length - 1].source = text(rawSpec.source);
            out[out.length - 1].sources = [text(rawSpec.source)].filter(Boolean);
          }
        }
      }
    }

    if (product?.specs && typeof product.specs === 'object' && !Array.isArray(product.specs)) {
      for (const [fieldName, value] of Object.entries(product.specs)) {
        addEntry(out, seen, product, fieldName, value, { key: fieldName, value }, envelopes, scope);
      }
    } else if (Array.isArray(product?.specs)) {
      for (const spec of product.specs) {
        if (!spec || spec.key == null) continue;
        addEntry(out, seen, product, spec.key, spec.value, spec, envelopes, scope);
      }
    }

    addProductSpecBucket(out, seen, product, product?._spec?.specs, envelopes, scope);
    addProductSpecBucket(out, seen, product, product?._spec?.itemDetails, envelopes, scope);

    return out;
  }

  function specEntry(product, fieldName, options) {
    const scope = options?.root || root;
    const wanted = canonicalKey(fieldName, scope);
    if (!wanted) return null;
    return specEntries(product, options).find(entry => entry.field === wanted) || null;
  }

  function specDisplayValue(product, fieldName, options) {
    const entry = specEntry(product, fieldName, options);
    return entry ? entry.display : '';
  }

  Object.assign(NS, {
    canonicalKey,
    specEntries,
    specEntry,
    specDisplayValue
  });
})(globalThis);
