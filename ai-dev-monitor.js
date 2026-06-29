(function initShopScoutAIDevMonitor(root) {
  const STAGES = [
    { id: 'retrieval', label: 'Search / Retrieval' },
    { id: 'verification', label: 'Listing-vs-official verification' },
    { id: 'enrichment', label: 'Spec correction / enrichment' },
    { id: 'comparison', label: 'Deep comparison' },
    { id: 'secondOpinion', label: 'Second opinion' }
  ];

  function stageTemplate(stage) {
    return {
      id: stage.id,
      label: stage.label,
      status: 'pending',
      providerId: '',
      providerName: '',
      model: '',
      startedAt: '',
      completedAt: '',
      promptSnippet: '',
      responseSnippet: '',
      sourceUrls: [],
      error: ''
    };
  }

  function toProductIndexesText(productIndexes) {
    if (!Array.isArray(productIndexes) || !productIndexes.length) return 'All products';
    return productIndexes.map(index => Number(index) + 1).join(', ');
  }

  function createMonitorState(options = {}) {
    const productIndexes = Array.isArray(options.productIndexes) ? options.productIndexes.slice() : [];
    return {
      clientRunId: options.clientRunId || '',
      runId: options.runId || '',
      status: 'waiting',
      listName: options.listName || '',
      productIndexes,
      productIndexesText: toProductIndexesText(productIndexes),
      productCount: Number.isFinite(options.productCount) ? options.productCount : productIndexes.length,
      productUrls: Array.isArray(options.productUrls) ? options.productUrls.slice() : [],
      startedAt: options.startedAt || new Date().toISOString(),
      completedAt: '',
      stages: STAGES.map(stageTemplate),
      events: []
    };
  }

  function truncate(value, maxLength = 900) {
    const text = String(value || '').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1)}...`;
  }

  function getStage(state, stageId) {
    if (!state || !stageId) return null;
    return state.stages.find(stage => stage.id === stageId) || null;
  }

  function eventSummary(event) {
    if (event.message) return event.message;
    const stage = event.stage ? `${event.stage}: ` : '';
    if (event.type === 'run-started') return `Run started with ${event.productCount || 0} product(s).`;
    if (event.type === 'run-completed' && event.status === 'partial') return 'Run stopped before all stages completed. Partial results are available.';
    if (event.type === 'run-completed') return `Run completed with status: ${event.status || 'completed'}.`;
    if (event.type === 'run-failed') return `Run failed: ${event.error || 'Unknown error'}.`;
    if (event.type === 'stage-started') {
      const provider = event.providerName || event.providerId || 'provider';
      return `${stage}started ${provider}${event.model ? ` / ${event.model}` : ''}.`;
    }
    if (event.type === 'stage-completed') {
      const sources = Array.isArray(event.sourceUrls) ? event.sourceUrls.length : 0;
      return `${stage}completed${sources ? ` with ${sources} source(s)` : ''}.`;
    }
    if (event.type === 'stage-skipped') return `${stage}skipped: ${event.error || 'Not needed'}.`;
    if (event.type === 'stage-failed') return `${stage}failed: ${event.error || 'Unknown error'}.`;
    return `${stage}${event.type || 'event'}`;
  }

  function normalizeEvent(event) {
    const normalized = {
      type: event.type || 'event',
      runId: event.runId || '',
      clientRunId: event.clientRunId || '',
      stage: event.stage || '',
      status: event.status || '',
      providerId: event.providerId || '',
      providerName: event.providerName || '',
      model: event.model || '',
      message: event.message || '',
      timestamp: event.timestamp || new Date().toISOString(),
      promptSnippet: truncate(event.promptSnippet, 1200),
      responseSnippet: truncate(event.responseSnippet, 1200),
      sourceUrls: Array.isArray(event.sourceUrls) ? event.sourceUrls.slice(0, 20) : [],
      error: event.error || '',
      productCount: Number.isFinite(event.productCount) ? event.productCount : undefined,
      productIndexes: Array.isArray(event.productIndexes) ? event.productIndexes.slice() : undefined,
      productUrls: Array.isArray(event.productUrls) ? event.productUrls.slice(0, 50) : undefined,
      stages: Array.isArray(event.stages) ? event.stages.slice() : undefined,
      listName: event.listName || ''
    };
    normalized.summary = eventSummary(normalized);
    return normalized;
  }

  function applyRunStarted(state, event) {
    state.status = 'running';
    state.runId = event.runId || state.runId;
    state.listName = event.listName || state.listName;
    state.productCount = Number.isFinite(event.productCount) ? event.productCount : state.productCount;
    if (Array.isArray(event.productIndexes)) {
      state.productIndexes = event.productIndexes.slice();
      state.productIndexesText = toProductIndexesText(state.productIndexes);
    }
    if (Array.isArray(event.productUrls)) state.productUrls = event.productUrls.slice();

    if (Array.isArray(event.stages) && event.stages.length) {
      const included = new Set(event.stages);
      state.stages.forEach(stage => {
        stage.status = included.has(stage.id) ? 'pending' : 'not-needed';
      });
    }
  }

  function applyStageEvent(state, event) {
    const stage = getStage(state, event.stage);
    if (!stage) return;

    if (event.providerId) stage.providerId = event.providerId;
    if (event.providerName) stage.providerName = event.providerName;
    if (event.model) stage.model = event.model;
    if (event.promptSnippet) stage.promptSnippet = event.promptSnippet;
    if (event.responseSnippet) stage.responseSnippet = event.responseSnippet;
    if (Array.isArray(event.sourceUrls) && event.sourceUrls.length) stage.sourceUrls = event.sourceUrls.slice();
    if (event.error) stage.error = event.error;

    if (event.type === 'stage-started') {
      stage.status = 'running';
      stage.startedAt = event.timestamp;
    } else if (event.type === 'stage-completed') {
      stage.status = event.status || 'completed';
      stage.completedAt = event.timestamp;
    } else if (event.type === 'stage-skipped') {
      stage.status = 'skipped';
      stage.completedAt = event.timestamp;
    } else if (event.type === 'stage-failed') {
      stage.status = 'failed';
      stage.completedAt = event.timestamp;
    }
  }

  function applyProgressEvent(state, event) {
    if (!state || !event) return state;
    const normalized = normalizeEvent(event);
    state.events.push(normalized);
    if (normalized.runId) state.runId = normalized.runId;

    if (normalized.type === 'run-started') {
      applyRunStarted(state, normalized);
    } else if (normalized.type === 'run-completed') {
      state.status = normalized.status || 'completed';
      state.completedAt = normalized.timestamp;
    } else if (normalized.type === 'run-failed') {
      state.status = 'failed';
      state.completedAt = normalized.timestamp;
    } else if (normalized.stage) {
      applyStageEvent(state, normalized);
    }
    return state;
  }

  function getActiveStages(state) {
    if (!state?.stages?.length) return [];
    return state.stages.filter(stage => stage.status !== 'not-needed');
  }

  function getProgressPercent(state) {
    if (!state) return 0;
    if (state.status === 'completed') return 100;
    const activeStages = getActiveStages(state);
    if (!activeStages.length) return state.status === 'waiting' ? 0 : 100;
    const progress = activeStages.reduce((total, stage) => {
      if (['completed', 'skipped'].includes(stage.status)) return total + 1;
      if (stage.status === 'running') return total + 0.5;
      if (stage.status === 'failed') return total + 1;
      return total;
    }, 0);
    return Math.max(0, Math.min(100, Math.round((progress / activeStages.length) * 100)));
  }

  function getCurrentStatusText(state) {
    if (!state) return 'Preparing AI request...';
    if (state.status === 'failed') {
      const failedEvent = [...(state.events || [])].reverse().find(event => event.error);
      return `AI analysis failed${failedEvent?.error ? `: ${failedEvent.error}` : '.'}`;
    }
    if (state.status === 'partial') return 'AI analysis stopped before all stages completed. Partial results are available.';
    if (state.status === 'completed') return 'AI analysis complete.';

    const activeStages = getActiveStages(state);
    const running = activeStages.find(stage => stage.status === 'running');
    if (running) {
      const provider = running.providerName || running.providerId || '';
      return `Running ${running.label}${provider ? ` with ${provider}` : ''}...`;
    }

    const nextPending = activeStages.find(stage => stage.status === 'pending');
    if (state.status === 'running' && nextPending) {
      const completedCount = activeStages.filter(stage => ['completed', 'skipped'].includes(stage.status)).length;
      return completedCount
        ? `Preparing next step: ${nextPending.label}...`
        : `Preparing ${nextPending.label}...`;
    }

    const lastEvent = state.events?.[state.events.length - 1];
    if (lastEvent?.summary) return lastEvent.summary;
    return 'Preparing AI request...';
  }

  function buildCopyableLog(state) {
    if (!state) return '';
    const lines = [
      'ShopScout AI Developer Monitor',
      `Run: ${state.runId || state.clientRunId || 'pending'}`,
      `Status: ${state.status}`,
      `List: ${state.listName || 'Current list'}`,
      `Products: ${state.productIndexesText || 'All products'} (${state.productCount || 0})`,
      ''
    ];

    lines.push('Stages:');
    for (const stage of state.stages) {
      lines.push(`- ${stage.id}: ${stage.status}${stage.providerName ? ` | ${stage.providerName}` : ''}${stage.model ? ` | ${stage.model}` : ''}`);
      if (stage.error) lines.push(`  Error: ${stage.error}`);
      if (stage.sourceUrls.length) lines.push(`  Sources: ${stage.sourceUrls.join(', ')}`);
      if (stage.responseSnippet) lines.push(`  Response: ${stage.responseSnippet}`);
    }

    lines.push('', 'Events:');
    for (const event of state.events) {
      lines.push(`[${event.timestamp}] ${event.summary}`);
      if (event.promptSnippet) lines.push(`Prompt: ${event.promptSnippet}`);
      if (event.responseSnippet) lines.push(`Response: ${event.responseSnippet}`);
      if (event.error) lines.push(`Error: ${event.error}`);
      if (event.sourceUrls.length) lines.push(`Sources: ${event.sourceUrls.join(', ')}`);
    }

    return lines.join('\n');
  }

  root.ShopScoutAIDevMonitor = {
    STAGES,
    createMonitorState,
    applyProgressEvent,
    getProgressPercent,
    getCurrentStatusText,
    buildCopyableLog
  };
})(globalThis);
