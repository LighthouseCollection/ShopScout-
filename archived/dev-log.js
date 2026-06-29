// ShopScout Developer Evaluation Log
// NOT part of the consumer extension. Used during development/testing only.
// Remove from manifest and HTML before shipping.

var chrome = globalThis.browser || globalThis.chrome;

window.SSDevLog = (() => {
  const DEV_LOG_KEY = 'shopscout_dev_log';
  const DEV_MODE_KEY = 'shopscout_dev_mode';

  async function isEnabled() {
    const d = await chrome.storage.local.get(DEV_MODE_KEY);
    return d[DEV_MODE_KEY] === true;
  }

  async function setEnabled(on) {
    await chrome.storage.local.set({ [DEV_MODE_KEY]: on });
  }

  async function getLogs() {
    const d = await chrome.storage.local.get(DEV_LOG_KEY);
    return d[DEV_LOG_KEY] || [];
  }

  async function clearLogs() {
    await chrome.storage.local.set({ [DEV_LOG_KEY]: [] });
  }

  async function log(entry) {
    if (!(await isEnabled())) return;
    const logs = await getLogs();
    logs.push(entry);
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    await chrome.storage.local.set({ [DEV_LOG_KEY]: logs });
  }

  function evaluateProduct(product) {
    if (!window.SS) return null;
    const { inferCategory, CATEGORY_RUBRICS, detectMissingAttributes } = window.SS;

    const categoryKey = inferCategory(product);
    const rubric = categoryKey ? CATEGORY_RUBRICS[categoryKey] : null;
    const { found, missing } = categoryKey ? detectMissingAttributes(product, categoryKey) : { found: [], missing: [] };

    const totalFactors = rubric ? rubric.factors.length : 0;
    const completeness = totalFactors ? Math.round((found.length / totalFactors) * 100) : 0;

    const hasSpecs = (product.rawSpecs?.length > 0) || (product.specs && Object.keys(product.specs).length > 0);
    const hasBullets = product.bullets?.length > 0;
    const hasDescription = !!product.description;
    const hasModelNumber = !!product.modelNumber;
    const hasRating = !!product.rating;
    const hasBrand = !!product.brand;

    const scraperIssues = [];
    if (!hasSpecs) scraperIssues.push('No specification table detected');
    if (!hasBullets) scraperIssues.push('No feature bullets extracted');
    if (!hasDescription) scraperIssues.push('No description extracted');
    if (!hasModelNumber) scraperIssues.push('No model number found');
    if (!hasRating) scraperIssues.push('No rating found');
    if (!hasBrand) scraperIssues.push('No brand detected');

    let confidence = 'high';
    if (completeness < 30 || scraperIssues.length > 3) confidence = 'low';
    else if (completeness < 60 || scraperIssues.length > 1) confidence = 'medium';

    return {
      timestamp: new Date().toISOString(),
      runType: 'developer-test',
      productUrl: product.url || '',
      source: product.source || '',
      productTitle: product.title || '',

      categoryDetection: {
        inferredCategory: rubric ? rubric.label : 'Unknown',
        categoryKey: categoryKey || 'none',
        confidence: categoryKey ? (product.category ? 'high' : 'medium') : 'low',
        scrapedCategory: product.category || '',
        correctionNeeded: false,
        notes: ''
      },

      rubricEvaluation: {
        rubricUsed: rubric ? rubric.label : 'None',
        expectedDefiningAttributes: rubric ? rubric.factors : [],
        attributesFoundInListing: found,
        missingCriticalAttributes: missing,
        completenessPercent: completeness
      },

      researchVerification: {
        manufacturerSearchNeeded: missing.length > 0,
        manufacturerSourceFound: false,
        officialSourceUrl: '',
        verifiedAttributes: [],
        conflictingAttributes: [],
        unverifiedAttributes: missing
      },

      rebrandDetection: {
        checked: false,
        suspectedDuplicateOrRebrand: false,
        matchingSignals: [],
        notes: ''
      },

      scraperQuality: {
        specsExtracted: hasSpecs,
        specCount: (product.rawSpecs || []).length,
        bulletsExtracted: hasBullets,
        bulletCount: (product.bullets || []).length,
        descriptionExtracted: hasDescription,
        modelNumberFound: hasModelNumber,
        brandFound: hasBrand,
        ratingFound: hasRating,
        categoryFound: !!product.category,
        issues: scraperIssues
      },

      qualityOfResult: {
        aiRecommendationConfidence: confidence,
        reason: confidence === 'low'
          ? 'Critical defining attributes are missing and spec extraction was incomplete.'
          : confidence === 'medium'
            ? 'Some defining attributes are missing. Recommendation is partial.'
            : 'Most defining attributes were found. Recommendation should be reliable.',
        promptIssues: [],
        scraperIssues,
        futureImprovements: scraperIssues.map(issue => {
          if (issue.includes('specification table')) return `Add ${product.source}-specific spec table selectors.`;
          if (issue.includes('feature bullets')) return `Add ${product.source}-specific bullet selectors.`;
          if (issue.includes('description')) return `Add ${product.source}-specific description selectors.`;
          if (issue.includes('model number')) return `Improve model number extraction for ${product.source}.`;
          return '';
        }).filter(Boolean)
      }
    };
  }

  async function evaluateAndLog(product) {
    const entry = evaluateProduct(product);
    if (entry) await log(entry);
    return entry;
  }

  async function evaluateComparison(products) {
    if (!(await isEnabled())) return null;
    const entries = [];
    for (const p of products) {
      const entry = evaluateProduct(p);
      if (entry) entries.push(entry);
    }

    const categories = [...new Set(entries.map(e => e.categoryDetection.categoryKey).filter(k => k !== 'none'))];
    const avgCompleteness = entries.length
      ? Math.round(entries.reduce((sum, e) => sum + e.rubricEvaluation.completenessPercent, 0) / entries.length)
      : 0;

    const summary = {
      timestamp: new Date().toISOString(),
      runType: 'comparison-test',
      productCount: products.length,
      categoriesDetected: categories.length,
      categories: categories,
      averageCompleteness: avgCompleteness,
      productsWithLowConfidence: entries.filter(e => e.qualityOfResult.aiRecommendationConfidence === 'low').length,
      productsWithMissingSpecs: entries.filter(e => !e.scraperQuality.specsExtracted).length,
      entries
    };

    await log(summary);
    return summary;
  }

  async function exportLogs() {
    const logs = await getLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopscout-dev-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return { isEnabled, setEnabled, getLogs, clearLogs, log, evaluateProduct, evaluateAndLog, evaluateComparison, exportLogs };
})();
