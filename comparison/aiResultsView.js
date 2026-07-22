/* =============================================================
   ShopScout — AI results report view
   Extracted from comparison.js as part of Task 7 (monolith split).
   Owns: helpers, view-model builders, template renderers, tab
   renderers, and page-level render/show entry points for the
   completed AI run report.

   Public surface — ShopScoutComparison.aiResultsView:
     renderPage(run, products)        — full render + show
     showPage()                       — DOM toggle into view
     buildViewModel(run, products)    — pure VM (used by tests)
     isRunIncomplete(run)
     buildRunProductList(data, run)
     aiStageLabel(stageId)

   Cross-module references resolved at runtime via the global
   object (comparison.js loads after this module but populates
   them before any callsite fires): closeSettingsPage,
   getCorrectedValue.
   ============================================================= */
(function initShopScoutAiResultsView(root) {
  const NS = (root.ShopScoutComparison = root.ShopScoutComparison || {});
  const SS = root.SS || {};
  const { esc, escAttr, sanitizeUrl, parsePrice, normalizeReviewCount,
          formatRatingDisplay, normalizeSpecValue, normalizeProductSpecs,
          getCategoryComparisonSpecKeys, inferCategory, CATEGORY_RUBRICS } = SS;

  function setTrustedHtml(target, html) {
    if (root.ShopScoutSanitize && typeof root.ShopScoutSanitize.setTrustedHtml === 'function') {
      root.ShopScoutSanitize.setTrustedHtml(target, html);
      return;
    }
    if (target) target.innerHTML = html == null ? '' : String(html);
  }

  /* === Begin extracted block (was comparison.js:2958-4522) === */

function aiStageLabel(stageId) {
  return globalThis.ShopScoutAI?.STAGES?.find(stage => stage.id === stageId)?.label || stageId || 'Stage';
}

function stageParsedJson(stage) {
  if (stage?.parsedJson && typeof stage.parsedJson === 'object') return stage.parsedJson;
  if (stage?.responseText && globalThis.ShopScoutAI?.extractJsonFromText) {
    return ShopScoutAI.extractJsonFromText(stage.responseText);
  }
  return null;
}

function reportSourceNameFromUrl(url) {
  try {
    const host = new URL(String(url || '')).hostname.replace(/^www\./, '').toLowerCase();
    const parts = host.split('.');
    const base = parts.length > 1 ? parts[parts.length - 2] : host;
    const names = {
      amazon: 'Amazon',
      anker: 'Anker',
      walmart: 'Walmart',
      target: 'Target',
      bestbuy: 'Best Buy',
      costco: 'Costco',
      ebay: 'eBay',
      aliexpress: 'AliExpress',
      alibaba: 'Alibaba',
      shein: 'SHEIN',
      temu: 'Temu',
      homedepot: 'Home Depot',
      lowes: 'Lowe\'s',
      newegg: 'Newegg'
    };
    return names[base] || base.replace(/(^|-)([a-z])/g, (_, dash, ch) => `${dash ? ' ' : ''}${ch.toUpperCase()}`);
  } catch {
    return 'Source';
  }
}

function renderReportSourceLink(url, label) {
  const safeUrl = sanitizeUrl(url, '');
  const text = label || (safeUrl ? reportSourceNameFromUrl(safeUrl) : 'Source');
  return safeUrl ? `<a class="source-pill src-pill" href="${escAttr(safeUrl)}" target="_blank" rel="noopener">${esc(text)} ↗</a>` : esc(text);
}

function normalizeReportJson(json) {
  if (Array.isArray(json)) return { products: json };
  return json && typeof json === 'object' ? json : {};
}

function reportPriceNumber(row) {
  const n = parsePrice(row?.price);
  return Number.isFinite(n) && n < 99999 ? n : 0;
}

function reportRatingNumber(row) {
  const n = parseFloat(String(row?.rating || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function reportReviewCountNumber(row) {
  const n = parseInt(String(row?.reviewCount || '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function reportToneClass(tone) {
  if (tone === 'buy' || tone === 'ok' || tone === 'low') return 'is-good';
  if (tone === 'avoid' || tone === 'bad' || tone === 'high') return 'is-bad';
  return 'is-caution';
}

function reportRiskLevelClass(level) {
  const text = String(level || '').toLowerCase();
  if (/low|verified|ok|good|safe/.test(text)) return 'low';
  if (/high|avoid|bad|suspicious|contradict|poor/.test(text)) return 'high';
  return 'med';
}

function reportBadgeClass(status) {
  const text = String(status || '').toLowerCase();
  if (/verified|confirmed|official|correct|low risk|good|ok|best/.test(text)) return 'ok';
  if (/high|avoid|bad|suspicious|contradict|conflict|wrong|missing|error|poor/.test(text)) return 'bad';
  if (/not needed|none|unknown/.test(text)) return 'muted';
  return 'warn';
}

function reportTagTone(status) {
  const badge = reportBadgeClass(status);
  if (badge === 'ok') return 'buy';
  if (badge === 'bad') return 'avoid';
  return 'care';
}

function sortArrowSvg() {
  return `<svg class="sort-arrow" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7l3-3 3 3"/></svg>`;
}

function sortableHeader(label, key, extraClass = '') {
  if (!extraClass) return `<th class="sortable" data-sort-key="${escAttr(key)}">${esc(label)}${sortArrowSvg()}</th>`;
  return `<th class="sortable ${escAttr(extraClass)}" data-sort-key="${escAttr(key)}">${esc(label)}${sortArrowSvg()}</th>`;
}

function plainCellText(value) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.map(plainCellText).filter(Boolean).join('; ');
  if (typeof value === 'object') {
    const pairs = Object.entries(value)
      .filter(([, item]) => item != null && item !== '')
      .slice(0, 4)
      .map(([key, item]) => `${key}: ${plainCellText(item)}`);
    return pairs.join('; ');
  }
  return String(value);
}

function productSpecMap(product) {
  const map = new Map();
  const specs = normalizeProductSpecs ? normalizeProductSpecs(product) : (product?.rawSpecs || []);
  specs.forEach(spec => {
    const key = String(spec?.key || '').replace(/\s+/g, ' ').trim();
    if (!key) return;
    map.set(key.toLowerCase(), normalizeSpecValue ? normalizeSpecValue(spec?.value) : (spec?.value || ''));
  });
  return map;
}

function specValueForProduct(product, key) {
  const map = productSpecMap(product);
  const direct = map.get(String(key || '').toLowerCase());
  if (direct) return direct;
  const normalized = String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [specKey, value] of map.entries()) {
    if (specKey.replace(/[^a-z0-9]/g, '') === normalized) return value;
  }
  return '';
}

function reportProductName(product) {
  const parts = [
    getCorrectedValue(product, 'brand'),
    getCorrectedValue(product, 'modelName'),
    getCorrectedValue(product, 'modelNumber')
  ].map(value => String(value || '').trim()).filter(Boolean);
  const uniqueParts = parts.filter((value, index) => parts.findIndex(other => other.toLowerCase() === value.toLowerCase()) === index);
  if (uniqueParts.length >= 2) return uniqueParts.join(' | ');
  return getCorrectedValue(product, 'productName') || getCorrectedValue(product, 'title') || 'Untitled product';
}

function reportShortName(product) {
  const name = reportProductName(product);
  return name.length > 92 ? `${name.slice(0, 89)}...` : name;
}

function buildRunProductList(data, run) {
  const lists = data?.lists || {};
  const list = lists[run?.listName] || lists[data?.activeList] || [];
  if (!Array.isArray(list)) return [];
  if (Array.isArray(run?.productIndexes) && run.productIndexes.length) {
    return run.productIndexes.map(index => list[Number(index)]).filter(Boolean);
  }
  if (Array.isArray(run?.productUrls) && run.productUrls.length) {
    const byUrl = new Map(list.filter(product => product?.url).map(product => [product.url, product]));
    const matched = run.productUrls.map(url => byUrl.get(url)).filter(Boolean);
    if (matched.length) return matched;
  }
  return list;
}

function reportProductRows(products) {
  return (products || []).map((product, index) => {
    const url = sanitizeUrl(product?.url, '');
    const image = sanitizeUrl(product?.image, '');
    const rating = getCorrectedValue(product, 'rating');
    const reviewCount = normalizeReviewCount(product?.reviewCount);
    return {
      index,
      id: index + 1,
      rank: String(index + 1).padStart(2, '0'),
      product,
      name: reportProductName(product),
      shortName: reportShortName(product),
      title: getCorrectedValue(product, 'title'),
      price: getCorrectedValue(product, 'newPrice') || '-',
      usedPrice: getCorrectedValue(product, 'usedPrice'),
      source: product?.source || reportSourceNameFromUrl(url),
      url,
      image,
      seller: getCorrectedValue(product, 'sellerName') || '-',
      brand: getCorrectedValue(product, 'brand') || '-',
      model: getCorrectedValue(product, 'modelNumber') || getCorrectedValue(product, 'modelName') || '-',
      rating,
      reviewCount,
      ratingText: formatRatingDisplay(rating, product?.reviewCount) || '-',
      category: getCorrectedValue(product, 'category') || ''
    };
  });
}

function buildReportSpecKeys(products, comparisonJson) {
  const productEntries = Array.isArray(comparisonJson?.products) ? comparisonJson.products : [];
  const fromJson = [
    comparisonJson?.important_spec_keys,
    comparisonJson?.importantSpecKeys,
    comparisonJson?.buyingFactors,
    comparisonJson?.buying_factors,
    comparisonJson?.category_buying_factors,
    productEntries.flatMap(item => [
      item?.important_spec_keys,
      item?.importantSpecKeys,
      item?.buyingFactors,
      item?.buying_factors
    ].filter(Array.isArray).flat())
  ].find(value => Array.isArray(value) && value.length);
  const keys = fromJson?.map(plainCellText).filter(Boolean) || [];
  const localKeys = getCategoryComparisonSpecKeys(products, 5);
  const merged = [...keys, ...localKeys].filter(Boolean);
  const seen = new Set();
  return merged.filter(key => {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).slice(0, 5);
}

function findJsonProductEntry(json, row) {
  const lists = [
    Array.isArray(json) ? json : null,
    json?.products,
    json?.final_ranking,
    json?.finalRanking,
    json?.quick_verdict?.products,
    json?.quickVerdict?.products
  ].filter(Array.isArray);
  const needles = [row.name, row.title, row.brand, row.model].filter(Boolean).map(value => String(value).toLowerCase());
  for (const list of lists) {
    const direct = list.find(item => Number(item?.id || item?.rank || item?.product_id || item?.productIndex) === row.id);
    if (direct) return direct;
    const byName = list.find(item => {
      const hay = plainCellText(item).toLowerCase();
      return needles.some(needle => needle && hay.includes(needle.slice(0, 30)));
    });
    if (byName) return byName;
  }
  return null;
}

function textMentionsProduct(text, row) {
  const hay = String(text || '').toLowerCase();
  return [row.name, row.title, row.brand, row.model]
    .filter(Boolean)
    .some(value => hay.includes(String(value).toLowerCase().slice(0, 28)));
}

function buildProductVerdict(row, comparisonJson, comparisonText) {
  const entry = findJsonProductEntry(comparisonJson, row) || {};
  const summary = plainCellText(entry.recommendation || entry.verdict || entry.summary || entry.reason || entry.why || entry.notes);
  const rawStatus = plainCellText(entry.status || entry.recommendation_type || entry.decision || entry.rank_label || summary).toLowerCase();
  let tone = 'care';
  let label = 'AI reviewed';
  if (/(best|winner|recommended|buy|value|lowest risk)/.test(rawStatus)) {
    tone = 'buy';
    label = /value/.test(rawStatus) ? 'Best value' : 'Recommended';
  } else if (/(avoid|skip|do not|high risk|mismatch|suspicious)/.test(rawStatus)) {
    tone = 'avoid';
    label = 'Caution';
  } else if (textMentionsProduct(comparisonText, row)) {
    label = 'Discussed by AI';
  }
  return {
    tone,
    label,
    reason: summary || 'Reviewed in the AI analysis. Open the comparison and risk tabs for the detailed reasoning.'
  };
}

function reportObjectValue(item, keys, fallback = '') {
  if (!item || typeof item !== 'object') return fallback;
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && String(item[key]).trim() !== '') {
      return item[key];
    }
  }
  const normalizedKeys = keys.map(key => String(key).toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const [key, value] of Object.entries(item)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedKeys.includes(normalized) && value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return fallback;
}

function reportObjectArray(item, keys) {
  for (const key of keys) {
    const value = item?.[key];
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
}

function reportObjectList(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return value;
    if (value && typeof value === 'object') {
      const nested = reportObjectArray(value, ['products', 'items', 'rows', 'cards', 'findings']);
      if (nested.length) return nested;
    }
  }
  return [];
}

function reportTemplateRoot(json) {
  return json?.template_report || json?.templateReport || json || {};
}

function reportItemMatchesRow(item, row) {
  if (!item || !row) return false;
  const directId = reportObjectValue(item, ['id', 'rank', 'product_id', 'productId', 'productIndex', 'index']);
  if (directId !== '') {
    const numeric = Number(directId);
    if (Number.isFinite(numeric) && (numeric === row.id || numeric === row.index)) return true;
    if (String(directId).padStart(2, '0') === row.rank) return true;
  }
  const hay = plainCellText(item).toLowerCase();
  return [row.name, row.shortName, row.title, row.brand, row.model]
    .filter(value => value && value !== '-')
    .some(value => hay.includes(String(value).toLowerCase().slice(0, 28)));
}

function findReportItemForRow(row, ...lists) {
  for (const list of lists.filter(Array.isArray)) {
    const direct = list.find(item => reportItemMatchesRow(item, row));
    if (direct) return direct;
  }
  return null;
}

function productKeyCandidates(row) {
  return [
    row.id,
    row.rank,
    row.index,
    `product_${row.id}`,
    `product${row.id}`,
    row.name,
    row.shortName,
    row.title,
    row.brand,
    row.model
  ].map(value => String(value || '').trim()).filter(Boolean);
}

function valueForRowFromMap(map, row) {
  if (!map || typeof map !== 'object') return '';
  const candidates = productKeyCandidates(row);
  for (const candidate of candidates) {
    if (map[candidate] !== undefined && map[candidate] !== null && String(map[candidate]).trim() !== '') return map[candidate];
  }
  const normalizedCandidates = candidates.map(value => value.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const [key, value] of Object.entries(map)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedCandidates.includes(normalized) && value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function valueForFactorProduct(item, row, factorName) {
  if (!item || typeof item !== 'object') return specValueForProduct(row.product, factorName);
  const maps = [
    item.values,
    item.product_values,
    item.productValues,
    item.by_product,
    item.byProduct
  ].filter(value => value && typeof value === 'object' && !Array.isArray(value));
  for (const map of maps) {
    const value = valueForRowFromMap(map, row);
    if (value) return plainCellText(value);
  }
  const productLists = [
    item.products,
    item.items,
    item.rows,
    item.values
  ].filter(Array.isArray);
  for (const list of productLists) {
    const found = findReportItemForRow(row, list);
    if (found) {
      return plainCellText(reportObjectValue(found, ['value', 'finding', 'assessment', 'text', 'note', 'summary', factorName], plainCellText(found)));
    }
  }
  return plainCellText(reportObjectValue(item, productKeyCandidates(row), specValueForProduct(row.product, factorName)));
}

function factorCellClass(item, row) {
  const best = reportObjectValue(item, ['best', 'winner', 'bestProduct', 'best_product']);
  const worst = reportObjectValue(item, ['worst', 'loser', 'weakestProduct', 'weakest_product']);
  const candidates = productKeyCandidates(row).map(value => value.toLowerCase());
  if (best && candidates.some(value => String(best).toLowerCase().includes(value))) return 'best';
  if (worst && candidates.some(value => String(worst).toLowerCase().includes(value))) return 'worst';
  return '';
}

function reportNotesFromJson(...values) {
  return values.flatMap(value => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(plainCellText).filter(Boolean);
    if (typeof value === 'object') return Object.values(value).map(plainCellText).filter(Boolean);
    return [plainCellText(value)].filter(Boolean);
  }).filter(Boolean).slice(0, 6);
}

function templateVerdicts(ctx) {
  const { products, comparisonJson } = ctx;
  const template = reportTemplateRoot(comparisonJson);
  const verdictLists = [
    template?.verdicts,
    template?.final_ranking,
    template?.finalRanking,
    comparisonJson?.quick_verdict?.products,
    comparisonJson?.quickVerdict?.products,
    comparisonJson?.final_ranking,
    comparisonJson?.finalRanking,
    comparisonJson?.recommendations,
    comparisonJson?.verdicts,
    comparisonJson?.products
  ].filter(Array.isArray);
  return products.map(row => {
    const entry = findReportItemForRow(row, ...verdictLists) || {};
    const fallback = buildProductVerdict(row, comparisonJson || {}, '');
    const status = plainCellText(reportObjectValue(entry, ['status', 'decision', 'recommendation_type', 'recommendationType', 'rank_label', 'rankLabel', 'verdict'], fallback.label));
    const reason = plainCellText(reportObjectValue(entry, ['reason', 'why', 'summary', 'notes', 'key_reason', 'keyReason', 'finding'], fallback.reason));
    return {
      row,
      tone: reportTagTone(`${status} ${reason}`) || fallback.tone,
      label: status || fallback.label,
      reason: reason || fallback.reason
    };
  }).sort((a, b) => ({ buy: 0, care: 1, avoid: 2 }[a.tone] ?? 1) - ({ buy: 0, care: 1, avoid: 2 }[b.tone] ?? 1));
}

function templateComparisonRows(ctx) {
  const { products, comparisonJson, specKeys } = ctx;
  const template = reportTemplateRoot(comparisonJson);
  const comparisonLists = [
    template?.comparison_rows,
    template?.comparisonRows,
    template?.comparison_table,
    template?.comparisonTable,
    comparisonJson?.comparison_table,
    comparisonJson?.comparisonTable,
    comparisonJson?.decision_table,
    comparisonJson?.decisionTable,
    comparisonJson?.compare_table,
    comparisonJson?.compareTable,
    comparisonJson?.products
  ].filter(Array.isArray);
  return products.map(row => {
    const entry = findReportItemForRow(row, ...comparisonLists) || {};
    const specs = specKeys.map(key => ({
      key,
      value: plainCellText(reportObjectValue(entry, [key, key.toLowerCase(), key.replace(/\s+/g, '_')], specValueForProduct(row.product, key) || '-'))
    }));
    const confidence = plainCellText(reportObjectValue(entry, ['confidence', 'verification_status', 'verificationStatus', 'status'], ''));
    return { row, entry, specs, confidence };
  });
}

function templateBuyingFactors(ctx) {
  const { products, comparisonJson, specKeys } = ctx;
  const template = reportTemplateRoot(comparisonJson);
  const factorSource = reportObjectList(
    template?.buying_factors,
    template?.buyingFactors,
    template?.buying_factor_matrix,
    template?.buyingFactorMatrix,
    comparisonJson?.buying_factor_matrix,
    comparisonJson?.buyingFactorMatrix,
    comparisonJson?.buying_factors_matrix,
    comparisonJson?.buyingFactorsMatrix,
    comparisonJson?.buying_factor_comparison,
    comparisonJson?.buyingFactorComparison,
    comparisonJson?.buying_factors,
    comparisonJson?.buyingFactors,
    comparisonJson?.important_spec_keys,
    comparisonJson?.importantSpecKeys,
    specKeys
  );
  const factorNames = factorSource.length ? factorSource : specKeys;
  return factorNames.slice(0, 14).map(item => {
    const name = plainCellText(typeof item === 'object'
      ? reportObjectValue(item, ['factor', 'name', 'key', 'label', 'criterion', 'buying_factor', 'buyingFactor'], '')
      : item);
    const factorName = name || 'Buying factor';
    return {
      name: factorName,
      note: plainCellText(typeof item === 'object' ? reportObjectValue(item, ['note', 'summary', 'reason'], '') : ''),
      cells: products.slice(0, 8).map(row => ({
        row,
        value: valueForFactorProduct(item, row, factorName) || '<span class="empty">not stated</span>',
        tone: factorCellClass(item, row)
      }))
    };
  });
}

function templatePriceValue(ctx) {
  const { products, comparisonJson } = ctx;
  const template = reportTemplateRoot(comparisonJson);
  const valueLists = [
    reportObjectList(template?.price_value, template?.priceValue),
    reportObjectList(template?.value_analysis, template?.valueAnalysis),
    reportObjectList(comparisonJson?.price_value, comparisonJson?.priceValue),
    reportObjectList(comparisonJson?.value_analysis, comparisonJson?.valueAnalysis),
    reportObjectList(comparisonJson?.value_cards, comparisonJson?.valueCards),
    comparisonJson?.products
  ].filter(Array.isArray);
  const cheapest = Math.min(...products.map(reportPriceNumber).filter(Boolean));
  return products.map(row => {
    const entry = findReportItemForRow(row, ...valueLists) || {};
    const price = reportPriceNumber(row);
    const judgement = plainCellText(reportObjectValue(entry, ['judgement', 'judgment', 'value', 'verdict', 'status', 'recommendation'], price && cheapest && price === cheapest ? 'Best saved price' : 'Compare against specs'));
    const reason = plainCellText(reportObjectValue(entry, ['reason', 'why', 'summary', 'notes', 'assessment'], row.usedPrice ? `Used price: ${row.usedPrice}.` : 'Value depends on verified specs and seller reliability.'));
    const tone = reportTagTone(`${judgement} ${reason}`) || (price && cheapest && price === cheapest ? 'buy' : 'care');
    return { row, judgement, reason, tone };
  });
}

function templateReviewSignals(ctx) {
  const { products, comparisonJson } = ctx;
  const template = reportTemplateRoot(comparisonJson);
  const reviewLists = [
    reportObjectList(template?.review_signals, template?.reviewSignals),
    reportObjectList(template?.review_analysis, template?.reviewAnalysis),
    reportObjectList(comparisonJson?.review_analysis, comparisonJson?.reviewAnalysis),
    reportObjectList(comparisonJson?.review_signals, comparisonJson?.reviewSignals),
    reportObjectList(comparisonJson?.reviews),
    comparisonJson?.products
  ].filter(Array.isArray);
  return products.map(row => {
    const entry = findReportItemForRow(row, ...reviewLists) || {};
    const rating = reportRatingNumber(row);
    const count = reportReviewCountNumber(row);
    const strength = plainCellText(reportObjectValue(entry, ['strength', 'rating_quality', 'ratingQuality', 'quality', 'confidence'], count >= 100 ? 'Stronger' : count ? 'Small sample' : 'Not stated'));
    const note = plainCellText(reportObjectValue(entry, ['note', 'summary', 'reason', 'complaints', 'common_complaints', 'commonComplaints'], count < 25 ? 'Small review sample; treat rating carefully.' : 'Review sample is visible in captured listing data.'));
    const tone = rating >= 4.4 && count >= 50 ? 'buy' : rating < 4 || count < 25 ? 'avoid' : 'care';
    return { row, rating, count, strength, note, tone };
  });
}

function templateVerificationAudits(ctx) {
  const { products, verificationJson, enrichmentJson, comparisonJson, specKeys } = ctx;
  const verificationTemplate = reportTemplateRoot(verificationJson);
  const enrichmentTemplate = reportTemplateRoot(enrichmentJson);
  const comparisonTemplate = reportTemplateRoot(comparisonJson);
  const verificationLists = [
    verificationTemplate?.verification_audits,
    verificationTemplate?.verificationAudits,
    verificationTemplate?.products,
    verificationJson?.products,
    verificationJson?.claim_audits,
    verificationJson?.claimAudits,
    verificationJson?.verification_summary,
    verificationJson?.verificationSummary
  ].filter(Array.isArray);
  return products.map(row => {
    const entry = findReportItemForRow(row, ...verificationLists) || findJsonProductEntry(verificationJson, row) || {};
    const status = plainCellText(reportObjectValue(entry, ['overall_status', 'overallStatus', 'status', 'verification_status', 'verificationStatus', 'listing_status', 'listingStatus', 'confidence'], 'Reviewed'));
    const note = plainCellText(reportObjectValue(entry, ['key_result', 'keyResult', 'notes', 'summary', 'finding', 'reason', 'verdict'], 'See the claim audit for this product.'));
    const claims = reportObjectList(
      entry.claims,
      entry.claim_audit,
      entry.claimAudit,
      entry.findings,
      entry.checks,
      entry.verifications,
      entry.specs
    ).slice(0, 14).map(claim => ({
      claim: plainCellText(reportObjectValue(claim, ['claim', 'field', 'spec', 'key', 'title', 'name'], plainCellText(claim))),
      status: plainCellText(reportObjectValue(claim, ['status', 'result', 'verification_status', 'verificationStatus', 'confidence'], status)),
      evidence: plainCellText(reportObjectValue(claim, ['evidence', 'source', 'reason', 'notes', 'summary'], note))
    }));
    const fallbackClaims = claims.length ? claims : claimRowsForProduct({ verificationJson, specKeys }, row, { entry, status, note });
    const missingSpecs = reportObjectList(
      entry.missing_specs,
      entry.missingSpecs,
      entry.missing_important_specs,
      entry.missingImportantSpecs,
      verificationTemplate?.missing_important_specs,
      verificationTemplate?.missingImportantSpecs,
      enrichmentTemplate?.missing_important_specs,
      enrichmentTemplate?.missingImportantSpecs,
      comparisonTemplate?.missing_attributes,
      comparisonTemplate?.missingAttributes,
      enrichmentJson?.missing_important_specs,
      enrichmentJson?.missingImportantSpecs,
      comparisonJson?.missing_attributes,
      comparisonJson?.missingAttributes
    ).map(plainCellText).filter(Boolean).slice(0, 8);
    const marketingClaims = reportObjectList(
      entry.marketing_claims,
      entry.marketingClaims,
      entry.suspicious_claims,
      entry.suspiciousClaims
    ).map(plainCellText).filter(Boolean).slice(0, 8);
    return {
      row,
      entry,
      status,
      note,
      tone: reportTagTone(`${status} ${note}`),
      claims: fallbackClaims,
      missingSpecs,
      marketingClaims
    };
  });
}

function templateSpecCorrections(ctx) {
  const { products, corrections, enrichmentJson, verificationJson } = ctx;
  const enrichmentTemplate = reportTemplateRoot(enrichmentJson);
  const verificationTemplate = reportTemplateRoot(verificationJson);
  const correctionRows = corrections.length
    ? corrections
    : reportObjectList(enrichmentTemplate?.corrections, verificationTemplate?.corrections, enrichmentJson?.corrections, verificationJson?.corrections, enrichmentJson?.specification_ledger, verificationJson?.specification_ledger);
  const rows = correctionRows.map((item, index) => ({
    id: String(index + 1).padStart(2, '0'),
    product: plainCellText(reportObjectValue(item, ['product', 'product_name', 'productName', 'name'], '')),
    field: plainCellText(reportObjectValue(item, ['field', 'specification', 'key', 'attribute', 'spec'], 'Spec')),
    original: plainCellText(reportObjectValue(item, ['original', 'old', 'oldValue', 'listing', 'listing_value', 'listingValue', 'before', 'current'], '')),
    corrected: plainCellText(reportObjectValue(item, ['corrected', 'new', 'newValue', 'official', 'officialValue', 'official_or_external_value', 'verified_value', 'verifiedValue', 'after', 'value'], '')),
    status: plainCellText(reportObjectValue(item, ['status', 'verification_status', 'verificationStatus', 'confidence', 'result'], 'AI finding')),
    source: reportObjectValue(item, ['source', 'source_url', 'sourceUrl', 'url'], '')
  }));
  const summary = products.slice(0, 8).map(row => {
    const hay = `${row.name} ${row.title} ${row.brand} ${row.model}`.toLowerCase();
    const matched = rows.filter(item => {
      const text = `${item.product} ${item.field} ${item.original} ${item.corrected}`.toLowerCase();
      return text.split(/\s+/).some(token => token.length > 4 && hay.includes(token));
    });
    return {
      row,
      status: matched.length ? 'Corrected / flagged' : 'Listing-only / unverified',
      tone: matched.length ? 'avoid' : 'care',
      reason: matched[0] ? `${matched[0].field}: ${matched[0].original || 'listing value'} → ${matched[0].corrected || matched[0].status}` : 'No field-level correction was returned. Treat important claims as listing-only until verified.'
    };
  });
  return { rows, summary };
}

function templateRiskAxes(ctx) {
  const { products, comparisonJson, verificationJson } = ctx;
  const template = reportTemplateRoot(comparisonJson);
  const riskLists = [
    reportObjectList(template?.risk_axes, template?.riskAxes),
    reportObjectList(template?.risk_profile, template?.riskProfile),
    reportObjectList(comparisonJson?.risk_profile, comparisonJson?.riskProfile),
    reportObjectList(comparisonJson?.risk_axes, comparisonJson?.riskAxes),
    reportObjectList(comparisonJson?.risk_summary, comparisonJson?.riskSummary),
    comparisonJson?.risks,
    verificationJson?.risks,
    comparisonJson?.products
  ].filter(Array.isArray);
  const productRisks = products.map(row => {
    const entry = findReportItemForRow(row, ...riskLists) || findJsonProductEntry(comparisonJson, row) || findJsonProductEntry(verificationJson, row) || {};
    const overall = plainCellText(reportObjectValue(entry, ['overall_risk', 'overallRisk', 'risk_level', 'riskLevel', 'risk', 'level', 'status'], 'Review'));
    const spec = plainCellText(reportObjectValue(entry, ['spec_risk', 'specRisk', 'specification_risk', 'specificationRisk'], /listing-only|unverified|suspicious/i.test(plainCellText(entry)) ? 'High' : overall));
    const seller = plainCellText(reportObjectValue(entry, ['seller_risk', 'sellerRisk', 'store_risk', 'storeRisk'], row.seller && row.seller !== '-' ? 'Medium' : 'Review'));
    const warranty = plainCellText(reportObjectValue(entry, ['warranty_risk', 'warrantyRisk'], 'Review'));
    const rebrand = plainCellText(reportObjectValue(entry, ['rebrand_risk', 'rebrandRisk', 'duplicate_risk', 'duplicateRisk'], /duplicate|rebrand|mismatch/i.test(plainCellText(entry)) ? 'High' : 'Review'));
    const returns = plainCellText(reportObjectValue(entry, ['return_risk', 'returnRisk', 'returns_risk', 'returnsRisk'], 'Review'));
    const note = plainCellText(reportObjectValue(entry, ['note', 'reason', 'summary', 'description', 'finding'], plainCellText(entry) || `${row.seller !== '-' ? row.seller : 'Seller'} · ${row.source || 'Unknown source'}`));
    return { row, overall, spec, seller, warranty, rebrand, returns, note };
  });
  const axisNotes = reportNotesFromJson(
    template?.risk_axis_notes,
    template?.riskAxisNotes,
    template?.risk_notes,
    template?.riskNotes,
    comparisonJson?.risk_axis_notes,
    comparisonJson?.riskAxisNotes,
    comparisonJson?.risk_notes,
    comparisonJson?.riskNotes,
    comparisonJson?.risk_summary,
    verificationJson?.risk_notes,
    verificationJson?.riskNotes
  );
  return { products: productRisks, axisNotes };
}

function templateSellerReliability(ctx) {
  const { products, comparisonJson } = ctx;
  const template = reportTemplateRoot(comparisonJson);
  const sellerLists = [
    reportObjectList(template?.seller_reliability, template?.sellerReliability),
    reportObjectList(template?.seller_risk, template?.sellerRisk),
    reportObjectList(comparisonJson?.seller_reliability, comparisonJson?.sellerReliability),
    reportObjectList(comparisonJson?.seller_risk, comparisonJson?.sellerRisk),
    reportObjectList(comparisonJson?.store_reliability, comparisonJson?.storeReliability),
    comparisonJson?.products
  ].filter(Array.isArray);
  return products.map(row => {
    const entry = findReportItemForRow(row, ...sellerLists) || {};
    const signal = plainCellText(reportObjectValue(entry, ['signal', 'seller_signal', 'sellerSignal', 'source_signal', 'sourceSignal'], `${row.source || 'Source'} · ${row.seller || 'seller not captured'}`));
    const assessment = plainCellText(reportObjectValue(entry, ['assessment', 'status', 'risk', 'seller_risk', 'sellerRisk', 'verdict'], row.seller && row.seller !== '-' ? 'Review' : 'Unknown'));
    return { row, signal, assessment };
  });
}

function buildAiTemplateReportModel(ctx) {
  return {
    verdicts: templateVerdicts(ctx),
    comparisonRows: templateComparisonRows(ctx),
    buyingFactors: templateBuyingFactors(ctx),
    priceValue: templatePriceValue(ctx),
    reviewSignals: templateReviewSignals(ctx),
    verificationAudits: templateVerificationAudits(ctx),
    specCorrections: templateSpecCorrections(ctx),
    riskAxes: templateRiskAxes(ctx),
    sellerReliability: templateSellerReliability(ctx)
  };
}

function renderProductThumbSize(row, size = 'md') {
  const cls = `prod-thumb ${size} p${((row.index % 8) + 1)}`;
  return `<span class="${escAttr(cls)}">${row.image ? `<img src="${escAttr(row.image)}" alt="">` : ''}</span>`;
}

function renderProductVerdictImage(row) {
  const cls = `pv-image p${((row.index % 8) + 1)}`;
  return `<div class="${escAttr(cls)}">${row.image ? `<img src="${escAttr(row.image)}" alt="">` : ''}</div>`;
}

function renderStars(row) {
  const rating = reportRatingNumber(row);
  const count = reportReviewCountNumber(row);
  if (!rating && !count) return '<span class="empty">not stated</span>';
  return `<span class="stars">★ ${esc(rating ? rating.toFixed(1).replace(/\.0$/, '.0') : '-')} <span class="count">${count ? `· ${esc(String(count.toLocaleString()))}` : ''}</span></span>`;
}

function renderReportAssessment(items) {
  const bullets = (items || []).map(item => plainCellText(item)).filter(Boolean).slice(0, 5);
  if (!bullets.length) return '';
  return `<div class="assessment">
    <div class="assessment-label">Concise assessment</div>
    <ul>${bullets.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
  </div>`;
}

function aiResultsGridApi() {
  return root.__shopScoutAiResultsGridApi || null;
}

function clearAiResultsGrid() {
  const api = aiResultsGridApi();
  if (api && typeof api.destroy === 'function') api.destroy();
  root.__shopScoutAiResultsGridApi = null;
  root.__shopScoutAiResultsGridKey = '';
}

function aiResultsGridCellText(value) {
  const text = plainCellText(value).trim();
  return text || '-';
}

function aiResultsProductCell(params) {
  const row = params?.data || {};
  const wrap = document.createElement('div');
  wrap.className = 'ai-results-grid-product';
  if (row.image) {
    const img = document.createElement('img');
    img.className = 'ai-results-grid-thumb';
    img.src = row.image;
    img.alt = '';
    wrap.appendChild(img);
  }
  const text = document.createElement('div');
  text.className = 'ai-results-grid-product-text';
  const name = document.createElement('strong');
  name.textContent = row.product || 'Untitled product';
  text.appendChild(name);
  if (row.model && row.model !== '-') {
    const model = document.createElement('span');
    model.textContent = row.model;
    text.appendChild(model);
  }
  wrap.appendChild(text);
  return wrap;
}

function aiResultsSourceCell(params) {
  const row = params?.data || {};
  const label = row.source || 'Source';
  if (!row.url) return label;
  const link = document.createElement('a');
  link.className = 'source-pill src-pill';
  link.href = row.url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = `${label} ↗`;
  return link;
}

function buildAiResultsComparisonGridRows(vm) {
  return (vm.reportModel?.comparisonRows || []).map(item => {
    const { row } = item;
    const gridRow = {
      id: row.id,
      rank: row.rank,
      product: row.shortName,
      model: row.model,
      image: row.image,
      price: row.price,
      source: row.source,
      url: row.url,
      reviews: `${row.rating || '-'}${row.reviewCount ? ` (${row.reviewCount})` : ''}`,
      confidence: item.confidence || 'not stated'
    };
    item.specs.forEach(spec => {
      gridRow[`spec:${spec.key}`] = aiResultsGridCellText(spec.value);
    });
    return gridRow;
  });
}

function buildAiResultsComparisonGridColumns(vm) {
  const columns = [
    { field: 'rank', headerName: '#', width: 70, pinned: 'left', sortable: true, filter: false },
    { field: 'product', headerName: 'Product', minWidth: 260, flex: 1, pinned: 'left', sortable: true, filter: 'agTextColumnFilter', cellRenderer: aiResultsProductCell },
    { field: 'price', headerName: 'Price', width: 120, sortable: true, filter: 'agNumberColumnFilter' },
    { field: 'source', headerName: 'Source', width: 130, sortable: true, filter: 'agTextColumnFilter', cellRenderer: aiResultsSourceCell },
    { field: 'reviews', headerName: 'Reviews', width: 150, sortable: true, filter: 'agTextColumnFilter' }
  ];
  (vm.specKeys || []).forEach(key => {
    columns.push({
      field: `spec:${key}`,
      headerName: key,
      minWidth: 150,
      sortable: true,
      filter: 'agTextColumnFilter',
      wrapText: true,
      autoHeight: true
    });
  });
  columns.push({
    field: 'confidence',
    headerName: 'Confidence',
    width: 150,
    sortable: true,
    filter: 'agTextColumnFilter'
  });
  return columns;
}

function renderAiResultsComparisonGrid() {
  const vm = root.__shopScoutAiResultsVm;
  const mount = document.getElementById('aiResultsComparisonGrid');
  if (!mount || !vm) return;
  const ag = root.agGrid;
  if (!ag || typeof ag.createGrid !== 'function') {
    mount.textContent = 'Comparison grid is unavailable.';
    return;
  }
  const gridKey = String(vm.run?.id || 'latest-run');
  if (root.__shopScoutAiResultsGridKey === gridKey && aiResultsGridApi()) return;
  clearAiResultsGrid();
  mount.textContent = '';
  mount.classList.add('ag-theme-quartz');
  const gridOptions = {
    theme: 'legacy',
    rowData: buildAiResultsComparisonGridRows(vm),
    columnDefs: buildAiResultsComparisonGridColumns(vm),
    domLayout: 'autoHeight',
    defaultColDef: {
      sortable: true,
      resizable: true,
      filter: 'agTextColumnFilter',
      suppressHeaderMenuButton: false,
      wrapHeaderText: true,
      autoHeaderHeight: true,
      minWidth: 110
    },
    suppressCellFocus: true,
    enableCellTextSelection: true,
    ensureDomOrder: true,
    animateRows: false,
    getRowId(params) {
      return String(params.data?.id || params.data?.rank || params.data?.product || Math.random());
    }
  };
  root.__shopScoutAiResultsGridApi = ag.createGrid(mount, gridOptions);
  root.__shopScoutAiResultsGridKey = gridKey;
}

function renderAiVerdictTab(vm) {
  const cards = (vm.reportModel?.verdicts || []).map(({ row, tone, label, reason }) => {
    const tagIcon = tone === 'buy' ? '●' : tone === 'avoid' ? '✕' : '⚠';
    return `<div class="product-verdict" data-tone="${escAttr(tone)}" data-p="${row.id}">
      <span class="pv-tag ${escAttr(tone)}">${tagIcon} ${esc(label)}</span>
      <div class="pv-body">
        ${renderProductVerdictImage(row)}
        <div class="pv-body-info">
          <div class="pv-name"><span class="pv-rank-num">${esc(row.rank)}</span>${esc(row.shortName)}</div>
          <div class="pv-stats">
            <div class="stat"><span class="k">price</span><span class="v price">${esc(row.price)}</span></div>
            <div class="stat"><span class="k">rating</span>${renderStars(row)}</div>
          </div>
        </div>
      </div>
      <div class="pv-why">${esc(reason)}</div>
    </div>`;
  }).join('');

  return `<div class="verdict-row">${cards || '<div class="empty-state"><div class="es-title">No products available</div><div class="es-body">This AI run did not include product rows.</div></div>'}</div>
    ${renderReportAssessment(vm.verdictNotes)}
  `;
}

function renderAiCompareTab(vm) {
  return `<nav class="subtab-bar" aria-label="Overall sub-sections">
    <button class="subtab-btn active" data-sub="compare"><span class="sub-num">01</span>Comparison</button>
    <button class="subtab-btn" data-sub="factors"><span class="sub-num">02</span>Buying factors</button>
    <button class="subtab-btn" data-sub="price"><span class="sub-num">03</span>Price &amp; value</button>
    <button class="subtab-btn" data-sub="reviews"><span class="sub-num">04</span>Reviews</button>
    <button class="subtab-btn" data-sub="risk"><span class="sub-num">05</span>Risk profile</button>
  </nav>

  <div class="subtab-pane active" data-sub-pane="compare">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Side by side</div>
        <h2 class="section-title">Comparison table</h2>
        <p class="section-deck">Category-specific columns are selected from saved product specs first, then supplemented by AI buying factors.</p>
      </div>
      <div class="ai-results-grid-shell">
        <div id="aiResultsComparisonGrid" class="ai-results-ag-grid ag-theme-quartz" data-ai-results-grid="comparison"></div>
      </div>
      <div class="notes">
        <div class="note ok"><span class="note-label">Verified</span>Saved listing facts, source, price, brand, and model are displayed from captured product data.</div>
        <div class="note warn"><span class="note-label">Listing-only</span>Performance claims remain listing-only unless the verification stage confirms them.</div>
        <div class="note bad"><span class="note-label">Suspicious</span>Contradictions and identity mismatches are highlighted in verification and risk sections.</div>
      </div>
      ${renderReportAssessment(vm.comparisonNotes)}
    </section>
  </div>

  <div class="subtab-pane" data-sub-pane="factors">
    ${renderAiFactorsSection(vm)}
  </div>

  <div class="subtab-pane" data-sub-pane="price">
    ${renderAiValueCards(vm)}
  </div>

  <div class="subtab-pane" data-sub-pane="reviews">
    ${renderAiReviewCards(vm)}
  </div>

  <div class="subtab-pane" data-sub-pane="risk">
    ${renderAiRiskProfileSection(vm)}
  </div>`;
}

function renderAiFactorsSection(vm) {
  const products = vm.products.slice(0, 6);
  const header = products.map(row => `<div data-p="${row.id}">${renderProductThumbSize(row, 'xl')}<span class="fh-label">${esc(row.shortName)}</span><span class="fh-rank">${esc(row.rank)} · ${esc(row.model)}</span></div>`).join('');
  const factorRows = (vm.reportModel?.buyingFactors || []).map(factor => {
    const cells = factor.cells.slice(0, products.length).map(cell => {
      const cls = cell.tone ? ` class="${escAttr(cell.tone)}"` : '';
      const value = String(cell.value || '').startsWith('<span') ? cell.value : esc(cell.value || '');
      return `<div${cls}>${value || '<span class="empty">not stated</span>'}</div>`;
    }).join('');
    return `<div class="factors-row"><div>${esc(factor.name)}</div>${cells}</div>`;
  }).join('');
  return `<section class="section">
    <div class="section-head">
      <div class="section-eyebrow">Buying criteria</div>
      <h2 class="section-title">Buying factors</h2>
      <p class="section-deck">Same fields, each product to a column, using the important specs for this product category.</p>
    </div>
    <div class="factors" style="--factor-cols:${products.length || 1}">
      <div class="factors-head"><div>Factor</div>${header}</div>
      ${factorRows || '<div class="factors-row"><div>Important specs</div><div><span class="empty">No buying-factor columns were identified.</span></div></div>'}
    </div>
    ${renderReportAssessment((vm.reportModel?.buyingFactors || []).map(factor => factor.note).filter(Boolean))}
  </section>`;
}

function renderAiValueCards(vm) {
  const cards = (vm.reportModel?.priceValue || []).map(({ row, judgement, reason, tone }) => {
    return `<div class="value-card ${escAttr(reportToneClass(tone))}" data-p="${row.id}" data-tone="${escAttr(tone)}">
      <div class="vc-body">
        ${renderProductThumbSize(row, 'md')}
        <div class="vc-info">
          <div class="vc-head"><div class="vc-name"><span class="pv-rank-num">${esc(row.rank)}</span>${esc(row.shortName)}</div><div class="vc-price">${esc(row.price)}</div></div>
          <div class="vc-judgement">${esc(judgement)}</div>
        </div>
      </div>
      <div class="vc-why">${esc(reason)} ${renderReportSourceLink(row.url, row.source)}</div>
    </div>`;
  }).join('');
  return `<section class="section">
    <div class="section-head">
      <div class="section-eyebrow">Price &amp; value</div>
      <h2 class="section-title">Price &amp; value</h2>
      <p class="section-deck">Price cards keep value signals compact and comparable.</p>
    </div>
    <div class="value-strip">${cards || '<div class="empty-state"><div class="es-title">No prices available</div></div>'}</div>
  </section>`;
}

function renderAiReviewCards(vm) {
  const cards = (vm.reportModel?.reviewSignals || []).map(({ row, rating, count, strength, note, tone }) => {
    const pct = Math.max(0, Math.min(100, rating ? (rating / 5) * 100 : 0));
    return `<div class="review-card ${escAttr(reportToneClass(tone))}" data-p="${row.id}" data-tone="${escAttr(tone)}">
      <div class="rc-body">
        ${renderProductThumbSize(row, 'md')}
        <div class="rc-info">
          <div class="rc-name"><span class="pv-rank-num">${esc(row.rank)}</span>${esc(row.shortName)}</div>
          <div class="rc-score"><span class="num">${esc(rating ? rating.toFixed(1) : '-')}</span><span class="denom">/ 5</span></div>
          <div class="rc-meter"><span style="width:${pct}%"></span></div>
          <div class="rc-meta"><span>Reviews <span class="count">${esc(count ? count.toLocaleString() : 'not stated')}</span></span><span>Strength <span class="count">${esc(strength)}</span></span></div>
        </div>
      </div>
      <div class="rc-note">${esc(note)}</div>
    </div>`;
  }).join('');
  return `<section class="section">
    <div class="section-head">
      <div class="section-eyebrow">Review signals</div>
      <h2 class="section-title">Reviews</h2>
      <p class="section-deck">Rating strength and review count are separated so a high score with a tiny sample does not look stronger than it is.</p>
    </div>
    <div class="reviews-grid">${cards || '<div class="empty-state"><div class="es-title">No review data available</div></div>'}</div>
  </section>`;
}

function renderAiRiskProfileSection(vm) {
  const cards = (vm.reportModel?.riskAxes?.products || []).slice(0, 3).map(risk => {
    const level = reportRiskLevelClass(risk.overall);
    return `<div class="risk-card ${escAttr(reportToneClass(level))}" data-p="${risk.row.id}">
      <div class="rk-name">${renderProductThumbSize(risk.row, 'md')}${esc(risk.row.rank)} · ${esc(risk.row.shortName)}</div>
      <div class="rk-level ${escAttr(level)}">${esc(risk.overall || 'Review')}</div>
      <div class="rk-why">${esc(risk.note || 'No detailed risk note returned.')}</div>
    </div>`;
  }).join('');
  return `<section class="section">
    <div class="section-head">
      <div class="section-eyebrow">Risk profile</div>
      <h2 class="section-title">Risk profile</h2>
      <p class="section-deck">Verification, seller, warranty, rebrand, return, and spec risks summarized as product cards.</p>
    </div>
    <div class="risk-summary-row">${cards || '<div class="empty-state"><div class="es-title">No risk findings returned</div></div>'}</div>
  </section>`;
}

function claimRowsForProduct(vm, row, finding) {
  const entry = finding.entry || {};
  const claims = [
    entry.claims,
    entry.claim_audit,
    entry.claimAudit,
    entry.findings,
    entry.checks,
    entry.verifications,
    entry.specs
  ].find(value => Array.isArray(value) && value.length) || [];
  if (claims.length) {
    return claims.slice(0, 12).map(claim => ({
      claim: plainCellText(claim.claim || claim.field || claim.spec || claim.key || claim.title || claim.name || claim),
      status: plainCellText(claim.status || claim.result || claim.verification_status || claim.confidence || finding.status),
      evidence: plainCellText(claim.evidence || claim.source || claim.reason || claim.notes || claim.summary || finding.note)
    }));
  }
  const fallback = [
    { claim: `Brand · ${row.brand}`, status: 'Captured listing fact', evidence: 'Saved product data' },
    { claim: `Model · ${row.model}`, status: row.model && row.model !== '-' ? 'Captured listing fact' : 'Missing', evidence: row.model && row.model !== '-' ? 'Saved product data' : 'Model was not captured.' },
    { claim: `Price · ${row.price}`, status: 'Captured listing fact', evidenceHtml: renderReportSourceLink(row.url, row.source) },
    { claim: `Product title`, status: finding.status, evidence: row.title || finding.note }
  ];
  vm.specKeys.slice(0, 6).forEach(key => {
    const value = specValueForProduct(row.product, key);
    fallback.push({
      claim: key,
      status: value ? 'Listing-only' : 'Missing',
      evidence: value || 'Important spec was not captured in the listing data.'
    });
  });
  return fallback;
}

function renderClaimAuditTable(rows) {
  return `<div class="table-scroll">
    <table class="ai-report-table">
      <thead><tr>${sortableHeader('Claim', 'claim')}${sortableHeader('Status', 'status')}${sortableHeader('Evidence', 'evidence')}</tr></thead>
      <tbody>${rows.map(row => `<tr>
        <td>${esc(row.claim || 'Claim')}</td>
        <td><span class="badge ${escAttr(reportBadgeClass(row.status))}">${esc(row.status || 'Reviewed')}</span></td>
        <td>${row.evidenceHtml || esc(row.evidence || 'No evidence note returned.')}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}

function renderAiVerificationTab(vm) {
  const audits = (vm.reportModel?.verificationAudits || []).slice(0, 8);
  const summaryCards = audits.map(audit => {
    const { row } = audit;
    return `<div class="product-verdict" data-tone="${escAttr(audit.tone)}" data-p="${row.id}">
      <span class="pv-tag ${escAttr(audit.tone)}">${esc(audit.status || 'Reviewed')}</span>
      <div class="pv-body">
        ${renderProductVerdictImage(row)}
        <div class="pv-body-info">
          <div class="pv-name"><span class="pv-rank-num">${esc(row.rank)}</span>${esc(row.shortName)}</div>
          <div class="pv-stats">
            <div class="stat"><span class="k">source</span><span class="v">${renderReportSourceLink(row.url, row.source)}</span></div>
          </div>
        </div>
      </div>
      <div class="pv-why">${esc(audit.note)}</div>
    </div>`;
  }).join('');
  const productTabs = audits.map(({ row }) => `<button class="subtab-btn" data-sub="ver-p${row.id}"><span class="sub-num">${esc(row.rank)}</span>${esc(row.shortName)}</button>`).join('');
  const productPanes = audits.map(audit => {
    const { row } = audit;
    const missing = audit.missingSpecs.length
      ? `<section class="section">
        <div class="section-head"><div class="section-eyebrow">Gaps</div><h2 class="section-title">Missing specs</h2></div>
        <div class="notes">${audit.missingSpecs.map(item => `<div class="note warn"><span class="note-label">Missing</span>${esc(item)}</div>`).join('')}</div>
      </section>`
      : '';
    const marketing = audit.marketingClaims.length
      ? `<section class="section">
        <div class="section-head"><div class="section-eyebrow">Inflation check</div><h2 class="section-title">Marketing claims</h2></div>
        <div class="notes">${audit.marketingClaims.map(item => `<div class="note bad"><span class="note-label">Claim</span>${esc(item)}</div>`).join('')}</div>
      </section>`
      : '';
    return `<div class="subtab-pane" data-sub-pane="ver-p${row.id}">
      <section class="section">
        <div class="section-head">
          <div class="section-eyebrow">${esc(row.shortName)}</div>
          <h2 class="section-title">Claim audit</h2>
          <p class="section-deck">${esc(audit.note)}</p>
        </div>
        ${renderClaimAuditTable(audit.claims)}
      </section>
      ${missing}
      ${marketing}
    </div>`;
  }).join('');
  return `<nav class="subtab-bar" aria-label="Verification sub-sections">
    <button class="subtab-btn active" data-sub="ver-summary"><span class="sub-num">·</span>Summary</button>
    ${productTabs}
  </nav>
  <div class="subtab-pane active" data-sub-pane="ver-summary">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Per-product audit</div>
        <h2 class="section-title">Verification summary</h2>
        <p class="section-deck">Each listing's claims are classified as verified, listing-only, missing, contradictory, or suspicious.</p>
      </div>
      <div class="verdict-row">${summaryCards || '<div class="empty-state"><div class="es-title">No verification products</div><div class="es-body">This run did not include product rows.</div></div>'}</div>
      ${renderReportAssessment(vm.verificationNotes)}
    </section>
  </div>
  ${productPanes}`;
}

function renderAiSpecsTab(vm) {
  const correctionModel = vm.reportModel?.specCorrections || { rows: [], summary: [] };
  const correctionRows = correctionModel.rows.map(item => {
    const status = item.status || 'AI finding';
    const source = item.source || '';
    return `<tr>
      <td class="col-id">${esc(item.id)}</td>
      <td>${esc(item.field || 'Spec')}</td>
      <td>${item.original ? `<del>${esc(item.original)}</del>` : '<span class="empty">not captured</span>'}</td>
      <td>${item.corrected ? `<ins>${esc(item.corrected)}</ins>` : '<span class="empty">unverified</span>'}</td>
      <td><span class="badge ${escAttr(reportBadgeClass(status))}">${esc(status)}</span></td>
      <td>${source ? renderReportSourceLink(source, reportSourceNameFromUrl(source)) : '<span class="empty">not stated</span>'}</td>
    </tr>`;
  }).join('');
  const missing = [
    vm.enrichmentJson?.missing_important_specs,
    vm.enrichmentJson?.missingImportantSpecs,
    vm.comparisonJson?.missing_attributes,
    vm.comparisonJson?.missingAttributes,
    vm.comparisonJson?.missingImportantSpecs
  ].find(value => Array.isArray(value) && value.length) || [];
  const summaryCards = correctionModel.summary.map(({ row, status, tone, reason }) => {
    return `<div class="product-verdict" data-tone="${escAttr(tone)}" data-p="${row.id}">
      <span class="pv-tag ${escAttr(tone)}">${esc(status)}</span>
      <div class="pv-body">
        ${renderProductVerdictImage(row)}
        <div class="pv-body-info"><div class="pv-name"><span class="pv-rank-num">${esc(row.rank)}</span>${esc(row.shortName)}</div></div>
      </div>
      <div class="pv-why">${esc(reason)}</div>
    </div>`;
  }).join('');
  const missingNotes = missing.length
    ? `<div class="notes">${missing.slice(0, 12).map(item => `<div class="note warn"><span class="note-label">Missing</span>${esc(plainCellText(item))}</div>`).join('')}</div>`
    : '<div class="empty-state"><div class="es-icon">✓</div><div class="es-title">No missing-spec list returned</div><div class="es-body">The AI run did not provide a separate missing-important-specs list.</div></div>';

  return `<nav class="subtab-bar" aria-label="Specs sub-sections">
    <button class="subtab-btn active" data-sub="spec-summary"><span class="sub-num">·</span>Summary</button>
    <button class="subtab-btn" data-sub="spec-corrections"><span class="sub-num">01</span>Corrections</button>
    <button class="subtab-btn" data-sub="spec-missing"><span class="sub-num">02</span>Missing specs</button>
  </nav>
  <div class="subtab-pane active" data-sub-pane="spec-summary">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Per-product status</div>
        <h2 class="section-title">Corrections summary</h2>
      <p class="section-deck">Original listing values remain visible when corrected; unreliable claims are kept separate from confirmed specs.</p>
      </div>
      <div class="verdict-row">${summaryCards || '<div class="empty-state"><div class="es-title">No products available</div></div>'}</div>
    </section>
  </div>
  <div class="subtab-pane" data-sub-pane="spec-corrections">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Field-by-field</div>
        <h2 class="section-title">Correction table</h2>
        <p class="section-deck">Struck values are the original listing values; inserted values are corrected or verified values from the AI audit.</p>
      </div>
      <div class="table-scroll">
        <table class="ai-report-table">
          <thead><tr><th class="col-id-h">#</th>${sortableHeader('Spec', 'spec')}${sortableHeader('Original', 'original')}${sortableHeader('Corrected', 'corrected')}${sortableHeader('Status', 'status')}${sortableHeader('Source', 'source')}</tr></thead>
          <tbody>${correctionRows || '<tr><td colspan="6">No corrected values were found in this AI run.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  </div>
  <div class="subtab-pane" data-sub-pane="spec-missing">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Gaps</div>
        <h2 class="section-title">Missing important specs</h2>
        <p class="section-deck">These are category-relevant specs that should exist before a confident purchase decision.</p>
      </div>
      ${missingNotes}
    </section>
  </div>`;
}

function renderAiRisksTab(vm) {
  const risks = vm.reportModel?.riskAxes?.products || [];
  const sellerReliability = vm.reportModel?.sellerReliability || [];
  const cards = risks.map(({ row, overall, note }) => {
    const level = reportRiskLevelClass(overall);
    return `<div class="risk-card ${escAttr(reportToneClass(level))}" data-p="${row.id}">
      <div class="rk-name">${renderProductThumbSize(row, 'md')}${esc(row.rank)} · ${esc(row.shortName)}</div>
      <span class="rk-level ${escAttr(level)}">${esc(overall || 'Review')}</span>
      <div class="rk-why">${esc(note || 'No detailed risk note returned.')}</div>
    </div>`;
  }).join('');
  const axisCell = value => {
    const level = reportRiskLevelClass(value);
    const cls = level === 'high' ? 'risk-cell-high' : level === 'low' ? 'risk-cell-low' : 'risk-cell-medium';
    return `<div class="${cls}">${esc(value || 'Review')}</div>`;
  };
  const heatRows = risks.map(({ row, spec, seller, warranty, rebrand, returns, overall }) => `<div class="risk-row" data-p="${row.id}">
    <div>${renderProductThumbSize(row, 'sm')}${esc(row.rank)} · ${esc(row.shortName)}</div>
    ${axisCell(spec)}
    ${axisCell(seller)}
    ${axisCell(warranty)}
    ${axisCell(rebrand)}
    ${axisCell(returns)}
    ${axisCell(overall)}
  </div>`).join('');
  const axisNotes = (vm.reportModel?.riskAxes?.axisNotes || []).length
    ? vm.reportModel.riskAxes.axisNotes
    : [
      'Spec risk: review listing-only and unverifiable claims before purchase.',
      'Seller risk: compare seller identity, marketplace role, warranty, and return path.',
      'Warranty risk: look for official warranty pages or manufacturer support.'
    ];
  const sellerRows = sellerReliability.map(({ row, signal, assessment }) => `<tr data-p="${row.id}">
    <td class="col-id">${esc(row.rank)}</td>
    <td>${esc(row.seller || '-')}</td>
    <td>${esc(signal)}</td>
    <td><span class="badge ${escAttr(reportBadgeClass(assessment))}">${esc(assessment || 'Review')}</span></td>
  </tr>`).join('');
  return `<nav class="subtab-bar" aria-label="Risks sub-sections">
    <button class="subtab-btn active" data-sub="risk-verdict"><span class="sub-num">·</span>Verdict</button>
    <button class="subtab-btn" data-sub="risk-heatmap"><span class="sub-num">01</span>Heat map</button>
    <button class="subtab-btn" data-sub="risk-axes"><span class="sub-num">02</span>By axis</button>
    <button class="subtab-btn" data-sub="risk-sellers"><span class="sub-num">03</span>Sellers</button>
  </nav>
  <div class="subtab-pane active" data-sub-pane="risk-verdict">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Aggregated risk</div>
        <h2 class="section-title">Risk verdict per product</h2>
        <p class="section-deck">Final risk level after spec, seller, warranty, rebrand, and return assessment.</p>
      </div>
      <div class="risk-summary-row">${cards || '<div class="empty-state"><div class="es-title">No risk findings returned</div></div>'}</div>
      ${renderReportAssessment(vm.riskNotes)}
    </section>
  </div>
  <div class="subtab-pane" data-sub-pane="risk-heatmap">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Risk axes</div>
        <h2 class="section-title">Risk heat map</h2>
        <p class="section-deck">Spec, seller, warranty, rebrand, and return risk graded side by side.</p>
      </div>
      <div class="risk-grid">
        <div class="risk-row head"><div>Product</div><div>Spec</div><div>Seller</div><div>Warranty</div><div>Rebrand</div><div>Return</div><div>Overall</div></div>
        ${heatRows}
      </div>
    </section>
  </div>
  <div class="subtab-pane" data-sub-pane="risk-axes">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Axis notes</div>
        <h2 class="section-title">Risk by type</h2>
      </div>
      <div class="notes">${axisNotes.map(note => {
        const [label, ...rest] = String(note).split(':');
        const body = rest.length ? rest.join(':').trim() : note;
        return `<div class="note ${escAttr(reportBadgeClass(note))}"><span class="note-label">${esc(rest.length ? label.trim() : 'Risk')}</span>${esc(body)}</div>`;
      }).join('')}</div>
    </section>
  </div>
  <div class="subtab-pane" data-sub-pane="risk-sellers">
    <section class="section">
      <div class="section-head">
        <div class="section-eyebrow">Storefront signal</div>
        <h2 class="section-title">Store reliability</h2>
      </div>
      <div class="table-scroll">
        <table class="ai-report-table">
          <thead><tr><th class="col-id-h">#</th>${sortableHeader('Seller', 'seller')}${sortableHeader('Signal', 'signal')}${sortableHeader('Assessment', 'assessment')}</tr></thead>
          <tbody>${sellerRows || '<tr><td colspan="4">No seller rows available.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

function categoryLeafLabel(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const parts = text.split(/\s*>\s*/).map(part => part.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : text;
}

function buildAiResultsViewModel(run, products = []) {
  const stages = Object.fromEntries((run?.stages || []).map(stage => [stage.stage, stage]));
  const comparisonJson = normalizeReportJson(stageParsedJson(stages.comparison));
  const verificationJson = normalizeReportJson(stageParsedJson(stages.verification));
  const enrichmentJson = normalizeReportJson(stageParsedJson(stages.enrichment));
  const rows = reportProductRows(products);
  const completedStages = (run?.stages || []).filter(stage => stage.status === 'completed').length;
  const categoryProduct = (comparisonJson.products || []).find(item => item?.category || item?.subcategory) || {};
  const category = comparisonJson.category || comparisonJson.subcategory || categoryProduct.category || categoryProduct.subcategory || rows.find(row => row.category)?.category || (products[0] ? (CATEGORY_RUBRICS[inferCategory(products[0])]?.label || '') : '');
  const displayCategory = categoryLeafLabel(category);
  const selectedChecks = globalThis.ShopScoutAI?.selectedOptionLabels
    ? ShopScoutAI.selectedOptionLabels(run?.analysisOptions || {})
    : [];
  const productText = rows.length
    ? `${Array.isArray(run?.productIndexes) && run.productIndexes.length ? run.productIndexes.map(index => Number(index) + 1).join(', ') : 'All products'} (${rows.length})`
    : 'No products';
  const corrections = globalThis.ShopScoutAIUI?.extractCorrections
    ? ShopScoutAIUI.extractCorrections({ stages: run?.stages || [] })
    : [];
  const specKeys = buildReportSpecKeys(products, comparisonJson);
  const reportModel = buildAiTemplateReportModel({
    products: rows,
    comparisonJson,
    verificationJson,
    enrichmentJson,
    corrections,
    specKeys
  });
  const finalRecommendation = comparisonJson.final_recommendation || comparisonJson.finalRecommendation || comparisonJson.recommendation || {};
  const nonEmptyArray = (...values) => values.find(value => Array.isArray(value) && value.length) || [];
  const completedStageLabels = (run?.stages || []).filter(stage => stage.status === 'completed').map(stage => aiStageLabel(stage.stage));
  const completedAt = run?.completedAt ? new Date(run.completedAt).toLocaleString() : 'Latest saved run';
  const shortRunId = String(run?.id || 'latest-run').replace(/^run-/, '').slice(0, 8);
  const failedStages = (run?.stages || []).filter(stage => stage.status === 'failed');
  const skippedStages = (run?.stages || []).filter(stage => stage.status === 'skipped');
  const incomplete = isAiRunIncomplete(run);

  return {
    run: run || {},
    stages,
    comparisonJson,
    verificationJson,
    enrichmentJson,
    products: rows,
    completedStages,
    failedStages,
    skippedStages,
    incomplete,
    category,
    displayCategory,
    productText,
    selectedChecks,
    specKeys,
    corrections,
    reportModel,
    completedStageLabels,
    completedAt,
    shortRunId,
    verdictNotes: nonEmptyArray(
      finalRecommendation.reasons,
      finalRecommendation.reasoning,
      comparisonJson.summaryBullets,
      comparisonJson.summary_bullets,
      comparisonJson.key_findings,
      comparisonJson.findings,
      comparisonJson.recommendations
    ),
    comparisonNotes: nonEmptyArray(
      comparisonJson.summaryBullets,
      comparisonJson.summary_bullets,
      comparisonJson.key_findings,
      comparisonJson.findings,
      comparisonJson.recommendations
    ),
    verificationNotes: nonEmptyArray(
      verificationJson.summaryBullets,
      verificationJson.summary_bullets,
      verificationJson.key_findings,
      verificationJson.findings,
      verificationJson.recommendations
    ),
    riskNotes: nonEmptyArray(
      comparisonJson.riskNotes,
      comparisonJson.risk_notes,
      comparisonJson.risk_summary,
      comparisonJson.riskSummary,
      verificationJson.riskNotes,
      verificationJson.risks
    ),
    title: displayCategory || run?.listName || 'AI Analysis Results',
    subtitle: selectedChecks.length
      ? selectedChecks.join(', ')
      : `${rows.length} product${rows.length === 1 ? '' : 's'} analyzed`
  };
}

function isAiRunIncomplete(run) {
  if (!run) return false;
  if (['partial', 'failed'].includes(String(run.status || '').toLowerCase())) return true;
  return (run.stages || []).some(stage => stage.status === 'failed');
}

function renderRedesignedAiResultsPage(vm) {
  const stageText = vm.completedStageLabels.length ? vm.completedStageLabels.join(' · ') : 'No completed stages';
  const incompleteWarning = vm.incomplete
    ? `<div class="ai-results-warning">
        <strong>AI analysis did not complete.</strong>
        <span>Showing the ${esc(String(vm.completedStages))} completed stage${vm.completedStages === 1 ? '' : 's'} saved before the run stopped${vm.failedStages.length ? `; ${esc(String(vm.failedStages.length))} stage${vm.failedStages.length === 1 ? '' : 's'} failed` : ''}.</span>
      </div>`
    : '';
  return `<div id="aiResultsTabs" class="page ai-results-page-inner">
    <section class="report-head">
      <div class="eyebrow"><span class="dot"></span>${esc(vm.run.listName || 'ShopScout AI analysis')}</div>
      <h1 class="report-title">${esc(vm.title)}</h1>
      <p class="report-sub">${esc(vm.subtitle)}</p>
      <div class="meta-bottom">
        <span><span class="mb-label">Completed</span>${esc(vm.completedAt)}</span>
        <span class="mb-sep">•</span>
        <span><span class="mb-label">Products</span>${esc(vm.productText)}</span>
        <span class="mb-sep">•</span>
        <span><span class="mb-label">Stages</span>${esc(stageText)}</span>
        <span class="mb-sep">•</span>
        <span><span class="mb-label">Run</span>${esc(vm.shortRunId)}</span>
      </div>
    </section>
    ${incompleteWarning}
    <nav class="tab-bar" aria-label="AI analysis results">
      <button class="tab-btn active" data-ai-results-tab="verdict" data-tab="verdict"><span class="tab-num">01</span>Verdict</button>
      <button class="tab-btn" data-ai-results-tab="compare" data-tab="compare"><span class="tab-num">02</span>Compare</button>
      <button class="tab-btn" data-ai-results-tab="verification" data-tab="verification"><span class="tab-num">03</span>Verification</button>
      <button class="tab-btn" data-ai-results-tab="specs" data-tab="specs"><span class="tab-num">04</span>Specs &amp; corrections</button>
      <button class="tab-btn" data-ai-results-tab="risks" data-tab="risks"><span class="tab-num">05</span>Risks</button>
    </nav>
    <div class="tab-pane active" data-ai-results-pane="verdict" data-pane="verdict">${renderAiVerdictTab(vm)}</div>
    <div class="tab-pane" data-ai-results-pane="compare" data-pane="compare">${renderAiCompareTab(vm)}</div>
    <div class="tab-pane" data-ai-results-pane="verification" data-pane="verification">${renderAiVerificationTab(vm)}</div>
    <div class="tab-pane" data-ai-results-pane="specs" data-pane="specs">${renderAiSpecsTab(vm)}</div>
    <div class="tab-pane" data-ai-results-pane="risks" data-pane="risks">${renderAiRisksTab(vm)}</div>
    <footer class="report-foot">
      <div class="meta-bottom">
        <span><span class="mb-label">Completed</span>${esc(vm.completedAt)}</span>
        <span class="mb-sep">•</span>
        <span><span class="mb-label">Stages</span>${esc(stageText)}</span>
        <span class="mb-sep">•</span>
        <span><span class="mb-label">Status</span>${esc(stageStatusText(vm.run.status))}</span>
        <span class="mb-sep">•</span>
        <span><span class="mb-label">Run</span>${esc(vm.shortRunId)}</span>
      </div>
    </footer>
  </div>`;
}

function bindAiResultsTabs() {
  const tabs = document.getElementById('aiResultsTabs');
  if (!tabs) return;
  tabs.addEventListener('click', e => {
    const sortHeader = e.target.closest('th.sortable');
    if (sortHeader && tabs.contains(sortHeader)) {
      sortComparisonTable(sortHeader.closest('table'), sortHeader);
      return;
    }
    const tab = e.target.closest('.tab-btn[data-ai-results-tab], .tab-btn[data-tab]');
    if (tab) {
      const target = tab.dataset.aiResultsTab || tab.dataset.tab;
      tabs.querySelectorAll('.tab-btn[data-ai-results-tab], .tab-btn[data-tab]').forEach(btn => btn.classList.toggle('active', btn === tab));
      tabs.querySelectorAll('.tab-pane[data-ai-results-pane], .tab-pane[data-pane]').forEach(pane => pane.classList.toggle('active', (pane.dataset.aiResultsPane || pane.dataset.pane) === target));
      if (target === 'compare') renderAiResultsComparisonGrid();
      return;
    }
    const subtab = e.target.closest('.subtab-btn[data-sub]');
    if (!subtab) return;
    const panel = subtab.closest('.tab-pane');
    subtab.closest('.subtab-bar')?.querySelectorAll('.subtab-btn').forEach(btn => btn.classList.toggle('active', btn === subtab));
    panel?.querySelectorAll('.subtab-pane[data-sub-pane]').forEach(pane => pane.classList.toggle('active', pane.dataset.subPane === subtab.dataset.sub));
    if (subtab.dataset.sub === 'compare') renderAiResultsComparisonGrid();
  });
}

function sortableCellValue(td) {
  if (!td) return { num: null, text: '' };
  const text = (td.textContent || '').trim();
  const numMatch = text.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (numMatch && /\d/.test(text)) return { num: parseFloat(numMatch[0]), text: text.toLowerCase() };
  return { num: null, text: text.toLowerCase() };
}

function sortComparisonTable(table, header) {
  if (!table || !header || !table.tBodies?.[0]) return;
  const headRow = header.parentElement;
  const colIndex = Array.from(headRow?.cells || []).indexOf(header);
  if (colIndex < 0) return;
  const next = header.getAttribute('data-dir') === 'asc' ? 'desc' : 'asc';
  Array.from(headRow.cells).forEach(cell => cell.removeAttribute('data-dir'));
  header.setAttribute('data-dir', next);
  const multiplier = next === 'asc' ? 1 : -1;
  const rows = Array.from(table.tBodies[0].rows);
  rows.sort((a, b) => {
    const av = sortableCellValue(a.cells[colIndex]);
    const bv = sortableCellValue(b.cells[colIndex]);
    if (!av.text && bv.text) return 1;
    if (av.text && !bv.text) return -1;
    if (av.num !== null && bv.num !== null) return (av.num - bv.num) * multiplier;
    return av.text.localeCompare(bv.text) * multiplier;
  });
  rows.forEach(row => table.tBodies[0].appendChild(row));
}

function renderAiResultsPage(run, products = []) {
  const page = document.getElementById('aiResultsPage');
  const subtitle = document.getElementById('aiResultsSubtitle');
  const body = document.getElementById('aiResultsBody');
  if (!page || !body || !run) return;
  if (subtitle) subtitle.textContent = `${run.listName || 'Current list'} · ${run.completedAt ? new Date(run.completedAt).toLocaleString() : 'Latest saved AI run'}`;
  const vm = buildAiResultsViewModel(run, products);
  root.__shopScoutAiResultsVm = vm;
  clearAiResultsGrid();
  setTrustedHtml(body, renderRedesignedAiResultsPage(vm));
  bindAiResultsTabs();
  showAiResultsPage();
}

function showAiResultsPage() {
  closeSettingsPage(false);
  document.getElementById('productDetail')?.classList.remove('active');
  if (document.getElementById('productDetail')) document.getElementById('productDetail').style.display = 'none';
  document.querySelector('.ribbon-shell').style.display = '';
  document.getElementById('urlBar').style.display = 'none';
  document.getElementById('filterBar').style.display = 'none';
  document.querySelector('.controls').style.display = 'none';
  document.getElementById('content').style.display = 'none';
  document.getElementById('aiResultsPage')?.classList.add('active');
  window.scrollTo(0, 0);
}

  /* === End extracted block === */

  NS.aiResultsView = {
    renderPage:      renderAiResultsPage,
    showPage:        showAiResultsPage,
    buildViewModel:  buildAiResultsViewModel,
    isRunIncomplete: isAiRunIncomplete,
    buildRunProductList,
    aiStageLabel
  };

  /* Back-compat globals — comparison.js still references these by
     bare name (the extracted region is large and we'd rather not
     churn every callsite). Once consumers migrate to the namespace
     these can be removed. */
  root.aiStageLabel        = aiStageLabel;
  root.buildRunProductList = buildRunProductList;
  root.isAiRunIncomplete   = isAiRunIncomplete;
  root.renderAiResultsPage = renderAiResultsPage;
  root.showAiResultsPage   = showAiResultsPage;
})(globalThis);
