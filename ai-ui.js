(function initShopScoutAIUI(root) {
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value || '').replace(/\r\n/g, '\n').trim();
  }

  function sourceNameFromUrl(url) {
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

  function stripStructuredJson(text) {
    let raw = normalizeText(text);
    raw = raw.replace(/```json\s*[\s\S]*?```/gi, '');
    raw = raw.replace(/```\s*\{[\s\S]*?quick_verdict[\s\S]*?\}\s*```/gi, '');
    const quickVerdictIndex = raw.search(/\{\s*"quick_verdict"\s*:/i);
    if (quickVerdictIndex >= 0) raw = raw.slice(0, quickVerdictIndex);
    return raw.trim();
  }

  function inlineFormat(value) {
    let html = esc(value);
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, url) => {
      const safeUrl = esc(url);
      return `<a href="${safeUrl}" target="_blank" rel="noopener">${esc(label)}</a>`;
    });
    html = html.replace(/(?<!["'=])(https?:\/\/[^\s<|)]+)/g, url => {
      const cleanUrl = url.replace(/[.,;]+$/, '');
      const suffix = url.slice(cleanUrl.length);
      const safeUrl = esc(cleanUrl);
      return `<a href="${safeUrl}" target="_blank" rel="noopener">${esc(sourceNameFromUrl(cleanUrl))}</a>${esc(suffix)}`;
    });
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    return html;
  }

  function isTableSeparator(line) {
    return /^\s*\|?[\s:-]+\|[\s|:-]+\|?\s*$/.test(line);
  }

  function isTableRow(line) {
    return line.includes('|') && !isTableSeparator(line);
  }

  function parseTableRow(line) {
    const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    return trimmed.split('|').map(cell => cell.trim());
  }

  function renderTable(lines, startIndex) {
    const rows = [];
    let i = startIndex;
    while (i < lines.length && (isTableRow(lines[i]) || isTableSeparator(lines[i]))) {
      if (!isTableSeparator(lines[i])) rows.push(parseTableRow(lines[i]));
      i++;
    }
    if (!rows.length) return { html: '', nextIndex: i };
    const header = rows[0];
    const body = rows.slice(1);
    const thead = `<thead><tr>${header.map(cell => `<th>${inlineFormat(cell)}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${body.map(row => `<tr>${row.map(cell => `<td>${inlineFormat(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    return { html: `<table class="ai-readable-table">${thead}${tbody}</table>`, nextIndex: i };
  }

  function renderList(lines, startIndex, ordered) {
    const tag = ordered ? 'ol' : 'ul';
    const items = [];
    let i = startIndex;
    const pattern = ordered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-*]\s+(.+)$/;
    while (i < lines.length) {
      const match = lines[i].match(pattern);
      if (!match) break;
      items.push(`<li>${inlineFormat(match[1])}</li>`);
      i++;
    }
    return { html: `<${tag}>${items.join('')}</${tag}>`, nextIndex: i };
  }

  function renderRichText(value) {
    const raw = stripStructuredJson(value);
    if (!raw) return '<div class="ai-empty">No readable AI output returned.</div>';
    const lines = raw.split('\n');
    const parts = [];
    let paragraph = [];

    function flushParagraph() {
      if (!paragraph.length) return;
      parts.push(`<p>${inlineFormat(paragraph.join(' '))}</p>`);
      paragraph = [];
    }

    for (let i = 0; i < lines.length;) {
      const line = lines[i].trim();
      if (!line) {
        flushParagraph();
        i++;
        continue;
      }

      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        const level = heading[1].length <= 2 ? 'h4' : 'h5';
        parts.push(`<${level}>${inlineFormat(heading[2])}</${level}>`);
        i++;
        continue;
      }

      if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        flushParagraph();
        const table = renderTable(lines, i);
        parts.push(table.html);
        i = table.nextIndex;
        continue;
      }

      if (/^\s*[-*]\s+/.test(lines[i])) {
        flushParagraph();
        const list = renderList(lines, i, false);
        parts.push(list.html);
        i = list.nextIndex;
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(lines[i])) {
        flushParagraph();
        const list = renderList(lines, i, true);
        parts.push(list.html);
        i = list.nextIndex;
        continue;
      }

      paragraph.push(line.replace(/^>\s*/, ''));
      i++;
    }

    flushParagraph();
    return `<div class="ai-readable">${parts.join('')}</div>`;
  }

  function firstValue(item, keys) {
    for (const key of keys) {
      const value = item?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
    }
    return '';
  }

  function addCorrection(list, item, defaults = {}) {
    const field = firstValue(item, ['field', 'key', 'attribute', 'specification', 'name', 'label']) || defaults.field || '';
    const original = firstValue(item, ['original', 'old', 'oldValue', 'listing_value', 'listingValue', 'before', 'current']);
    const corrected = firstValue(item, ['corrected', 'new', 'newValue', 'official_or_external_value', 'officialValue', 'verified_value', 'verifiedValue', 'after', 'value']);
    if (!field || !original || !corrected || original === corrected) return;
    list.push({
      field,
      original,
      corrected,
      status: firstValue(item, ['verification_status', 'status']) || defaults.status || 'corrected',
      confidence: firstValue(item, ['confidence']) || defaults.confidence || '',
      note: firstValue(item, ['notes', 'note', 'reason']) || defaults.note || ''
    });
  }

  function collectCorrectionsFromJson(list, json) {
    if (!json || typeof json !== 'object') return;
    const ledger = json.specification_ledger || json.specificationLedger;
    if (Array.isArray(ledger)) {
      ledger.forEach(item => {
        const status = String(item?.verification_status || item?.status || '').toLowerCase();
        const listing = firstValue(item, ['listing_value', 'listingValue']);
        const official = firstValue(item, ['official_or_external_value', 'officialValue', 'verified_value', 'verifiedValue', 'value']);
        if (listing && official && listing !== official && ['contradictory', 'corrected', 'suspicious'].some(word => status.includes(word))) {
          addCorrection(list, item, { status: status || 'corrected' });
        }
      });
    }

    const explicitLists = [
      json.corrections,
      json.corrected_specs,
      json.correctedSpecs,
      json.spec_corrections,
      json.specCorrections,
      json.changes
    ];
    for (const entries of explicitLists) {
      if (Array.isArray(entries)) entries.forEach(item => addCorrection(list, item));
    }
  }

  function extractCorrections(ai) {
    const corrections = [];
    for (const stage of ai?.stages || []) {
      collectCorrectionsFromJson(corrections, stage.parsedJson);
    }
    const seen = new Set();
    return corrections.filter(item => {
      const key = `${item.field}\n${item.original}\n${item.corrected}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function fieldToProductKey(field) {
    const normalized = String(field || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const map = {
      title: 'title',
      name: 'title',
      productname: 'title',
      brand: 'brand',
      manufacturer: 'manufacturer',
      model: 'modelNumber',
      modelnumber: 'modelNumber',
      modelname: 'modelName',
      sku: 'sku',
      asin: 'asin',
      upc: 'upc',
      mpn: 'mpn',
      gtin: 'gtin',
      price: 'newPrice',
      newprice: 'newPrice',
      usedprice: 'usedPrice',
      shipping: 'shippingPrice',
      shippingprice: 'shippingPrice',
      seller: 'sellerName',
      sellername: 'sellerName',
      category: 'category',
      rating: 'rating',
      reviewcount: 'reviewCount',
      availability: 'availability'
    };
    return map[normalized] || '';
  }

  function buildVerifiedValueMap(ai) {
    const map = {};
    for (const correction of extractCorrections(ai)) {
      const key = fieldToProductKey(correction.field);
      if (key) map[key] = correction;
    }
    return map;
  }

  function renderCorrectedValue(original, correction) {
    if (!correction) return esc(original || '');
    return `<span class="ai-correction"><del>${esc(correction.original || original || '')}</del><span class="ai-correction-arrow">-&gt;</span><span class="ai-correction-new">${esc(correction.corrected || '')}</span></span>`;
  }

  function renderCorrectionsHtml(ai) {
    const corrections = extractCorrections(ai);
    if (!corrections.length) return '<div class="ai-empty">No corrected values found from verification.</div>';
    return `<table class="ai-correction-table"><thead><tr><th>Field</th><th>Original</th><th>Corrected</th><th>Reason</th></tr></thead><tbody>${corrections.map(item => `
      <tr>
        <td>${esc(item.field)}</td>
        <td><del>${esc(item.original)}</del></td>
        <td><span class="ai-correction-new">${esc(item.corrected)}</span></td>
        <td>${esc(item.note || item.status || '')}</td>
      </tr>`).join('')}</tbody></table>`;
  }

  root.ShopScoutAIUI = {
    esc,
    stripStructuredJson,
    renderRichText,
    extractCorrections,
    buildVerifiedValueMap,
    renderCorrectedValue,
    renderCorrectionsHtml
  };
})(globalThis);
