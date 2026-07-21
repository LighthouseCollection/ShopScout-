/*
   ShopScout — Manual AI result parser

   Parses the human-readable "ShopScout Table Updates" section from pasted
   manual AI reports and applies safe, product-number-addressed corrections.
*/
(function initShopScoutManualAIResultParser(root) {
  const NS = (root.ShopScoutManualAIResultParser = root.ShopScoutManualAIResultParser || {});

  const IDENTIFIER_FIELD_RE = /\b(asin|upc|gtin|ean|isbn|sku|mpn|manufacturer part number|mfr part number|model number|item model number|part number)\b/i;

  function cleanCell(value) {
    return String(value ?? '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function canonicalHeader(value) {
    return cleanCell(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function splitMarkdownRow(line) {
    const text = String(line || '').trim();
    if (!text.startsWith('|') || !text.endsWith('|')) return null;
    return text.slice(1, -1).split('|').map(cleanCell);
  }

  function isSeparatorRow(cells) {
    return cells && cells.length && cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')));
  }

  function productNumberFrom(value) {
    const match = String(value || '').match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  function normalizeField(value) {
    return cleanCell(value).replace(/^new field:\s*/i, '').trim();
  }

  function isProtectedIdentifierField(field) {
    return IDENTIFIER_FIELD_RE.test(String(field || ''));
  }

  function productName(product) {
    return cleanCell(product?.name || product?.title || product?.productName || product?.listingTitle);
  }

  function significantNameTokens(value) {
    return cleanCell(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter(token => token.length >= 4)
      .slice(0, 8);
  }

  function lineMentionsProduct(line, product, index) {
    const text = cleanCell(line).toLowerCase();
    if (!text) return false;
    const n = index + 1;
    if (new RegExp(`\\b(product|item)\\s*#?\\s*${n}\\b`, 'i').test(text)) return true;
    const name = productName(product).toLowerCase();
    if (name && text.includes(name)) return true;
    const tokens = significantNameTokens(name);
    return tokens.length >= 2 && tokens.slice(0, 4).filter(token => text.includes(token)).length >= 2;
  }

  function toneFromLine(line) {
    const text = cleanCell(line).toLowerCase();
    if (/\b(avoid|avoided|skip|skipped|do not buy|not recommended|worst|pass on)\b/.test(text)) return 'avoid';
    if (/\b(best|recommended|recommend|winner|buy|best value|best overall|lowest risk)\b/.test(text)) return 'recommended';
    if (/\b(caution|mixed|only if|acceptable|middle|average|trade[- ]?off|verify first)\b/.test(text)) return 'caution';
    return '';
  }

  function inferProductVerdicts(products, reportText) {
    const lines = String(reportText || '').split(/\r?\n/).map(cleanCell).filter(Boolean);
    return (products || []).map((product, index) => {
      const match = lines.find(line => lineMentionsProduct(line, product, index) && toneFromLine(line));
      const tone = match ? toneFromLine(match) : '';
      return tone ? { productIndex: index, tone, reason: match } : null;
    }).filter(Boolean);
  }

  function headerIndex(headers) {
    const aliases = {
      productNumber: ['product', 'productno', 'productnumber', 'product#', 'productid'],
      productName: ['productname', 'name'],
      field: ['field', 'column', 'spec', 'specification', 'attribute'],
      currentValue: ['currentvalue', 'currentlistedvalue', 'listedvalue', 'currentlistingvalue'],
      recommendedValue: ['recommendedvalue', 'correctedvalue', 'newvalue', 'aivalue', 'normalizedvalue'],
      updateType: ['updatetype', 'action', 'correctiontype'],
      confidence: ['confidence', 'confidencelevel'],
      reason: ['reason', 'reasonsource', 'source', 'notes']
    };
    const normalized = headers.map(canonicalHeader);
    const out = {};
    for (const [key, keys] of Object.entries(aliases)) {
      const idx = normalized.findIndex(header => keys.includes(header));
      if (idx >= 0) out[key] = idx;
    }
    return out;
  }

  function hasRequiredHeaders(index) {
    return Number.isInteger(index.productNumber)
      && Number.isInteger(index.field)
      && Number.isInteger(index.recommendedValue);
  }

  function parseTableUpdates(reportText) {
    const lines = String(reportText || '').split(/\r?\n/);
    const start = lines.findIndex(line => /^#{1,6}\s*ShopScout Table Updates\s*$/i.test(line.trim()));
    if (start < 0) return [];
    let headers = null;
    let index = null;
    const rows = [];
    for (let i = start + 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (/^#{1,6}\s+\S/.test(line.trim()) && headers) break;
      const cells = splitMarkdownRow(line);
      if (!cells) {
        if (headers && line.trim() === '') continue;
        if (headers && rows.length) break;
        continue;
      }
      if (isSeparatorRow(cells)) continue;
      if (!headers) {
        headers = cells;
        index = headerIndex(headers);
        if (!hasRequiredHeaders(index)) {
          headers = null;
          index = null;
        }
        continue;
      }
      const field = normalizeField(cells[index.field]);
      const recommendedValue = cleanCell(cells[index.recommendedValue]);
      const productNumber = productNumberFrom(cells[index.productNumber]);
      if (!productNumber || !field || !recommendedValue) continue;
      rows.push({
        productNumber,
        productName: Number.isInteger(index.productName) ? cleanCell(cells[index.productName]) : '',
        field,
        currentValue: Number.isInteger(index.currentValue) ? cleanCell(cells[index.currentValue]) : '',
        recommendedValue,
        updateType: Number.isInteger(index.updateType) ? cleanCell(cells[index.updateType]) : '',
        confidence: Number.isInteger(index.confidence) ? cleanCell(cells[index.confidence]) : '',
        reason: Number.isInteger(index.reason) ? cleanCell(cells[index.reason]) : '',
        protectedIdentifier: isProtectedIdentifierField(field)
      });
    }
    return rows;
  }

  function specRows(product) {
    if (Array.isArray(product.rawSpecs)) return product.rawSpecs;
    product.rawSpecs = [];
    return product.rawSpecs;
  }

  function ensureSpecDict(product) {
    if (!product.specs || typeof product.specs !== 'object' || Array.isArray(product.specs)) product.specs = {};
    return product.specs;
  }

  function ensureProductSpec(product) {
    product._spec = Object.assign({}, product._spec || {});
    if (!product._spec.specs || typeof product._spec.specs !== 'object') product._spec.specs = {};
    return product._spec.specs;
  }

  function upsertSpec(product, field, value, meta) {
    const specs = ensureSpecDict(product);
    specs[field] = value;
    const rows = specRows(product);
    const row = rows.find(item => String(item?.key || '').trim().toLowerCase() === field.toLowerCase());
    if (row) {
      row.value = value;
      row.source = meta.source;
    } else {
      rows.push({ key: field, value, source: meta.source });
    }
    const bucket = ensureProductSpec(product);
    bucket[field] = {
      rawKey: field,
      rawValue: value,
      value,
      source: meta.source,
      confidence: meta.confidence
    };
    if (product.specsNormalized) delete product.specsNormalized[field];
  }

  function correctionRecord(update, runId) {
    return {
      field: update.field,
      currentValue: update.currentValue,
      recommendedValue: update.recommendedValue,
      updateType: update.updateType,
      confidence: update.confidence,
      reason: update.reason,
      source: 'manual-ai-paste',
      runId: runId || ''
    };
  }

  function applyTableUpdatesToProducts(products, updates, options = {}) {
    const nextProducts = (products || []).map(product => Object.assign({}, product));
    const applied = [];
    const skipped = [];
    for (const update of updates || []) {
      const index = Number(update?.productNumber) - 1;
      const product = nextProducts[index];
      if (!product) {
        skipped.push(Object.assign({}, update, { reasonSkipped: 'missing-product' }));
        continue;
      }
      if (update.protectedIdentifier) {
        skipped.push(Object.assign({}, update, { reasonSkipped: 'protected-identifier' }));
        continue;
      }
      const record = correctionRecord(update, options.sourceRunId);
      upsertSpec(product, update.field, update.recommendedValue, {
        source: 'manual-ai-paste',
        confidence: String(update.confidence || '').toLowerCase() === 'high' ? 0.95 : 0.8
      });
      product._manualAiCorrections = Array.isArray(product._manualAiCorrections)
        ? product._manualAiCorrections.concat(record)
        : [record];
      applied.push(Object.assign({}, update, { productIndex: index }));
    }
    return { products: nextProducts, applied, skipped };
  }

  NS.parseTableUpdates = parseTableUpdates;
  NS.applyTableUpdatesToProducts = applyTableUpdatesToProducts;
  NS.inferProductVerdicts = inferProductVerdicts;
  NS.isProtectedIdentifierField = isProtectedIdentifierField;
})(typeof globalThis !== 'undefined' ? globalThis : window);
