(function initShopScoutAI(root) {
  const AI_STORAGE_KEY = 'shopscout_ai_settings';

  const PROVIDERS = [
    {
      id: 'openai',
      name: 'OpenAI',
      shortName: 'OpenAI',
      setupType: 'api-key',
      adapter: 'openai-responses',
      defaultModel: 'gpt-5.4-mini',
      models: [
        { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', tier: 'balanced', recommended: true, stage: 'comparison', note: 'Recommended for ShopScout: strong reasoning without using the heaviest model.' },
        { id: 'gpt-5.5', label: 'GPT-5.5', tier: 'premium', note: 'Use for very complex comparisons, many products, or messy contradictory specs.' },
        { id: 'gpt-5.4', label: 'GPT-5.4', tier: 'premium', note: 'More capable than mini, but often more than product comparison needs.' },
        { id: 'gpt-5.4-nano', label: 'GPT-5.4 nano', tier: 'economy', note: 'Cheap triage and simple extraction; weaker for nuanced verification.' }
      ],
      keyUrl: 'https://platform.openai.com/api-keys',
      docsUrl: 'https://platform.openai.com/docs',
      roleHint: 'Best for final reasoning, comparison, and structured JSON.',
      keyLabel: 'OpenAI API key',
      keyPlaceholder: 'sk-...',
      instructions: [
        'Open the API keys page.',
        'Create a new secret key.',
        'Paste it into ShopScout and choose a model.',
        'Click Test Connection, then Save.'
      ]
    },
    {
      id: 'anthropic',
      name: 'Claude / Anthropic',
      shortName: 'Claude',
      setupType: 'api-key',
      adapter: 'anthropic-messages',
      defaultModel: 'claude-sonnet-4-6',
      models: [
        { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', tier: 'balanced', recommended: true, stage: 'verification', note: 'Recommended for careful verification and contradiction review.' },
        { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', tier: 'economy', note: 'Good for fast second-pass checks and lighter enrichment.' },
        { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', tier: 'premium', note: 'Overkill for most shopping comparisons; use for very complex research.' }
      ],
      keyUrl: 'https://console.anthropic.com/settings/keys',
      docsUrl: 'https://docs.anthropic.com/',
      roleHint: 'Best for verification, cautious reasoning, and contradiction review.',
      keyLabel: 'Anthropic API key',
      keyPlaceholder: 'sk-ant-...',
      instructions: [
        'Open the Anthropic Console API keys page.',
        'Create or copy an API key.',
        'Paste it into ShopScout.',
        'Click Test Connection, then Save.'
      ]
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      shortName: 'Gemini',
      setupType: 'api-key',
      adapter: 'gemini-generate-content',
      defaultModel: 'gemini-3.5-flash',
      models: [
        { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', tier: 'balanced', recommended: true, stage: 'secondOpinion', note: 'Recommended as a fast second opinion and broad cross-check.' },
        { id: 'gemini-3.5-pro', label: 'Gemini 3.5 Pro', tier: 'premium', note: 'Use for complex product groups or deeper reasoning.' },
        { id: 'gemini-3.0-flash', label: 'Gemini 3.0 Flash', tier: 'economy', note: 'Use when cost/speed matters more than depth.' }
      ],
      keyUrl: 'https://aistudio.google.com/app/apikey',
      docsUrl: 'https://ai.google.dev/gemini-api/docs',
      roleHint: 'Good second opinion and broad verification provider.',
      keyLabel: 'Gemini API key',
      keyPlaceholder: 'AIza...',
      instructions: [
        'Open Google AI Studio API keys.',
        'Create an API key for your project.',
        'Paste it into ShopScout and keep the model editable.',
        'Click Test Connection, then Save.'
      ]
    },
    {
      id: 'perplexity',
      name: 'Perplexity',
      shortName: 'Perplexity',
      setupType: 'api-key',
      adapter: 'openai-chat',
      defaultModel: 'sonar-pro',
      models: [
        { id: 'sonar-pro', label: 'Sonar Pro', tier: 'balanced', recommended: true, stage: 'retrieval', note: 'Recommended for retrieval/search-grounded product verification.' },
        { id: 'sonar', label: 'Sonar', tier: 'economy', stage: 'retrieval', note: 'Good for cheaper source finding.' },
        { id: 'sonar-deep-research', label: 'Sonar Deep Research', tier: 'premium', stage: 'retrieval', note: 'Overkill unless you need long-form research across many products.' }
      ],
      defaultBaseUrl: 'https://api.perplexity.ai/chat/completions',
      keyUrl: 'https://www.perplexity.ai/settings/api',
      docsUrl: 'https://docs.perplexity.ai/docs/getting-started/overview',
      roleHint: 'Best for web/search-grounded retrieval before verification.',
      keyLabel: 'Perplexity API key',
      keyPlaceholder: 'pplx-...',
      instructions: [
        'Open the Perplexity API settings page.',
        'Generate an API key.',
        'Paste it into ShopScout.',
        'Use Perplexity as the Search / Retrieval provider.'
      ]
    },
    {
      id: 'xai',
      name: 'Grok / xAI',
      shortName: 'Grok',
      setupType: 'api-key',
      adapter: 'openai-chat',
      defaultModel: 'grok-4.3',
      models: [
        { id: 'grok-4.3', label: 'Grok 4.3', tier: 'balanced', recommended: true, stage: 'secondOpinion', note: 'Recommended xAI model for second opinion and pattern checks.' }
      ],
      defaultBaseUrl: 'https://api.x.ai/v1/chat/completions',
      keyUrl: 'https://console.x.ai/',
      docsUrl: 'https://docs.x.ai/developers/quickstart',
      roleHint: 'Useful for second opinions, search-assisted checks, and rebrand pattern review.',
      keyLabel: 'xAI API key',
      keyPlaceholder: 'xai-...',
      instructions: [
        'Open the xAI Console.',
        'Create an API key.',
        'Paste it into ShopScout.',
        'Choose a Grok model and test the connection.'
      ]
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      shortName: 'DeepSeek',
      setupType: 'api-key',
      adapter: 'openai-chat',
      defaultModel: 'deepseek-v4-flash',
      models: [
        { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', tier: 'balanced', recommended: true, stage: 'enrichment', note: 'Recommended economical reasoning and spec cleanup.' },
        { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', tier: 'premium', note: 'Use when comparison requires deeper reasoning.' },
        { id: 'deepseek-chat', label: 'DeepSeek Chat (legacy)', tier: 'legacy', note: 'Legacy compatibility name; use V4 Flash when possible.' },
        { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner (legacy)', tier: 'legacy', note: 'Legacy compatibility name; use V4 Pro when possible.' }
      ],
      defaultBaseUrl: 'https://api.deepseek.com/chat/completions',
      keyUrl: 'https://platform.deepseek.com/api_keys',
      docsUrl: 'https://api-docs.deepseek.com/',
      roleHint: 'OpenAI-compatible provider for economical reasoning and second-pass checks.',
      keyLabel: 'DeepSeek API key',
      keyPlaceholder: 'sk-...',
      instructions: [
        'Open the DeepSeek API keys page.',
        'Create a key.',
        'Paste it into ShopScout.',
        'Use deepseek-chat or another model shown in your account.'
      ]
    },
    {
      id: 'mistral',
      name: 'Mistral AI',
      shortName: 'Mistral',
      setupType: 'api-key',
      adapter: 'openai-chat',
      defaultModel: 'mistral-medium-latest',
      models: [
        { id: 'mistral-small-latest', label: 'Mistral Small latest', tier: 'economy', note: 'Fast economical classification and cleanup.' },
        { id: 'mistral-medium-latest', label: 'Mistral Medium latest', tier: 'balanced', recommended: true, stage: 'verification', note: 'Recommended if available: good balance for verification and comparison.' },
        { id: 'mistral-large-latest', label: 'Mistral Large latest', tier: 'premium', note: 'Use for more complex analysis; often more than needed.' }
      ],
      defaultBaseUrl: 'https://api.mistral.ai/v1/chat/completions',
      keyUrl: 'https://console.mistral.ai/api-keys',
      docsUrl: 'https://docs.mistral.ai/',
      roleHint: 'Good independent reasoning provider for verification and final review.',
      keyLabel: 'Mistral API key',
      keyPlaceholder: '...',
      instructions: [
        'Open Mistral Console API keys.',
        'Create a new key.',
        'Paste it into ShopScout.',
        'Test and save.'
      ]
    },
    {
      id: 'poe',
      name: 'Poe',
      shortName: 'Poe',
      setupType: 'api-key-or-oauth',
      adapter: 'openai-chat',
      defaultModel: 'GPT-5.4-mini',
      models: [
        { id: 'GPT-5.4-mini', label: 'GPT-5.4 mini via Poe', tier: 'balanced', recommended: true, stage: 'comparison', note: 'Recommended when using Poe as the multi-model bridge.' },
        { id: 'Claude-Sonnet-4.6', label: 'Claude Sonnet 4.6 via Poe', tier: 'balanced', note: 'Good for verification through Poe.' },
        { id: 'Gemini-3.5-Flash', label: 'Gemini 3.5 Flash via Poe', tier: 'economy', note: 'Good fast second opinion through Poe.' },
        { id: 'GPT-5.5', label: 'GPT-5.5 via Poe', tier: 'premium', note: 'Use only if your Poe account supports it and you need maximum reasoning.' }
      ],
      defaultBaseUrl: 'https://api.poe.com/v1/chat/completions',
      keyUrl: 'https://poe.com/api/keys',
      docsUrl: 'https://creator.poe.com/docs/external-applications/openai-compatible-api',
      roleHint: 'One Poe API key can route to many models/bots. Model names are user-editable.',
      keyLabel: 'Poe API key',
      keyPlaceholder: 'pk-...',
      instructions: [
        'Open Poe API keys.',
        'Create a key for external applications.',
        'Paste it into ShopScout.',
        'Enter the Poe model or bot name you want to use.'
      ]
    },
    {
      id: 'meta',
      name: 'Meta Llama API',
      shortName: 'Meta Llama',
      setupType: 'api-key',
      adapter: 'openai-chat',
      defaultModel: 'Llama-3.3-70B-Instruct',
      models: [
        { id: 'Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B Instruct', tier: 'balanced', recommended: true, stage: 'secondOpinion', note: 'Recommended Llama option for independent checks.' },
        { id: 'Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B Instruct', tier: 'economy', note: 'Fast/light checks; weaker for complex product verification.' }
      ],
      defaultBaseUrl: 'https://api.llama.com/v1/chat/completions',
      keyUrl: 'https://llama.developer.meta.com/',
      docsUrl: 'https://llama.developer.meta.com/docs/api-keys/',
      roleHint: 'Use the official Meta-hosted Llama API, not consumer Meta AI chat automation.',
      keyLabel: 'Llama API key',
      keyPlaceholder: '...',
      instructions: [
        'Open Meta Llama API.',
        'Create or copy an API key from the dashboard.',
        'Paste it into ShopScout.',
        'Confirm the model name available in your account.'
      ]
    },
    {
      id: 'copilot',
      name: 'Microsoft Copilot',
      shortName: 'Copilot',
      setupType: 'enterprise-oauth',
      adapter: 'manual',
      defaultModel: 'Microsoft 365 Copilot Chat API',
      models: [
        { id: 'Microsoft 365 Copilot Chat API', label: 'Microsoft 365 Copilot Chat API', tier: 'enterprise', recommended: true, note: 'Enterprise/OAuth only; not a consumer API-key model.' }
      ],
      keyUrl: 'https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/copilot-apis-overview',
      docsUrl: 'https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/copilot-apis-overview',
      roleHint: 'Enterprise/OAuth provider. Consumer Copilot does not behave like a simple API-key provider.',
      keyLabel: 'Enterprise token or note',
      keyPlaceholder: 'Configured outside ShopScout',
      instructions: [
        'Use this only if you have Microsoft 365 Copilot API access.',
        'Your tenant admin may need to approve delegated permissions.',
        'For now, ShopScout marks Copilot as manual/enterprise until OAuth is configured.',
        'Manual copy/paste mode remains available.'
      ]
    },
    {
      /* Local LLM running on the user's own machine. Both Ollama
         (default :11434) and LM Studio (default :1234) expose an
         OpenAI-compatible /v1/chat/completions endpoint, so we reuse
         the openai-chat adapter and let the user point baseUrl at
         whichever runtime they have installed. No API key needed —
         the apiKey field is shown as optional. */
      id: 'local',
      name: 'Local LLM (Ollama / LM Studio)',
      shortName: 'Local',
      setupType: 'endpoint',
      adapter: 'openai-chat',
      defaultModel: 'llama3.1:8b',
      models: [
        { id: 'llama3.1:8b',  label: 'Llama 3.1 8B (Ollama default)',  tier: 'balanced', recommended: true, note: 'Good general default for Ollama installs.' },
        { id: 'llama3.1:70b', label: 'Llama 3.1 70B (Ollama)',          tier: 'premium',                  note: 'Strong, but needs a beefy GPU/CPU.' },
        { id: 'qwen2.5:7b',   label: 'Qwen 2.5 7B (Ollama)',            tier: 'economy',                  note: 'Fast, light verification.' },
        { id: 'phi-3-mini',   label: 'Phi-3 mini (LM Studio)',          tier: 'economy',                  note: 'Useful for triage on a CPU-only machine.' },
        { id: 'custom',       label: 'Custom (type a model id below)',  tier: 'balanced',                 note: 'Use any model your runtime has pulled.' }
      ],
      /* Ollama default. For LM Studio, the user changes this to
         http://localhost:1234/v1/chat/completions. */
      defaultBaseUrl: 'http://localhost:11434/v1/chat/completions',
      keyUrl: 'https://ollama.com/download',
      docsUrl: 'https://github.com/ollama/ollama/blob/main/docs/openai.md',
      roleHint: 'Runs entirely on your machine — nothing leaves your network. Great for private verification work.',
      keyLabel: 'API key (optional — most local runtimes ignore it)',
      keyPlaceholder: 'leave blank, or anything for LM Studio',
      instructions: [
        'Install Ollama (https://ollama.com) or LM Studio.',
        'Start the runtime and pull a model (e.g. `ollama pull llama3.1:8b`).',
        'Confirm the base URL — Ollama: http://localhost:11434/v1/chat/completions · LM Studio: http://localhost:1234/v1/chat/completions.',
        'Pick or type the model id you have installed locally, then Test Connection.'
      ]
    }
  ];

  const STAGES = [
    { id: 'retrieval', label: 'Search / Retrieval' },
    { id: 'verification', label: 'Listing-vs-official verification' },
    { id: 'enrichment', label: 'Spec correction / enrichment' },
    { id: 'comparison', label: 'Deep comparison' },
    { id: 'secondOpinion', label: 'Second opinion' }
  ];

  const ANALYSIS_OPTION_DEFINITIONS = [
    {
      id: 'verifySpecs',
      group: 'Verification',
      label: 'Confirm listing specs',
      description: 'Verify listing specs against official, manufacturer, or authoritative sources.',
      defaultChecked: true
    },
    {
      id: 'missingSpecs',
      group: 'Verification',
      label: 'Find missing important specs',
      description: 'Identify important missing category specs and try to fill them from reliable sources.',
      defaultChecked: true
    },
    {
      id: 'marketingClaims',
      group: 'Verification',
      label: 'Check marketing claims',
      description: 'Flag vague or exaggerated claims unless they are supported by real specs.',
      defaultChecked: true
    },
    {
      id: 'correctConflicts',
      group: 'Verification',
      label: 'Correct conflicting data',
      description: 'Show original values and corrected values when reliable sources disagree with the listing.',
      defaultChecked: true
    },
    {
      id: 'comparisonColumns',
      group: 'Comparison',
      label: 'Build comparison table columns',
      description: 'Convert category buying factors into useful comparison columns.',
      defaultChecked: true
    },
    {
      id: 'priceValue',
      group: 'Comparison',
      label: 'Compare price and value',
      description: 'Analyze new price, used price, shipping, and value for specs.',
      defaultChecked: true
    },
    {
      id: 'reviewsRatings',
      group: 'Comparison',
      label: 'Analyze reviews and ratings',
      description: 'Use rating count, rating quality, complaints, and review-photo evidence when available.',
      defaultChecked: true
    },
    {
      id: 'compareAll',
      group: 'Comparison',
      label: 'Compare it all',
      description: 'Create one combined table for buying factors, price and value, and reviews.',
      defaultChecked: false
    },
    {
      id: 'rebrandDuplicate',
      group: 'Risk Checks',
      label: 'Check rebrand / duplicate products',
      description: 'Detect likely same underlying products sold under different brands.',
      defaultChecked: false
    },
    {
      id: 'riskSummary',
      group: 'Risk Checks',
      label: 'Risk summary',
      description: 'Summarize verification, spec, seller, warranty, rebrand, and return risk.',
      defaultChecked: false
    },
    {
      id: 'sellerRisk',
      group: 'Risk Checks',
      label: 'Seller / store reliability',
      description: 'Review marketplace-only listings, questionable brands, return policy, warranty, and shipping risk.',
      defaultChecked: false,
      smartDefault: true
    },
    {
      id: 'finalRecommendation',
      group: 'Final',
      label: 'Final recommendation',
      description: 'Return best overall, best value, lowest risk, avoid/skip, and confidence level.',
      defaultChecked: true
    }
  ];

  const DEFAULT_ANALYSIS_OPTIONS = Object.fromEntries(
    ANALYSIS_OPTION_DEFINITIONS.map(option => [option.id, !!option.defaultChecked])
  );

  const PROMPT_PAYLOAD_MODES = [
    {
      id: 'compact',
      label: 'Compact',
      description: 'Send compact captured facts plus product URLs. Do not send raw page text.'
    },
    {
      id: 'full',
      label: 'Full',
      description: 'Send full captured product data, including raw captured descriptions, bullets, and expanded specs.'
    }
  ];

  const DEFAULT_PROMPT_OPTIONS = {
    payloadMode: 'compact'
  };

  const HIGHER_RISK_SOURCES = /\b(alibaba|aliexpress|shein|ebay|temu|dhgate|wish)\b/i;
  const REPUTABLE_SOURCES = /\b(best buy|bestbuy|nordstrom|costco|walmart|target|amazon)\b/i;

  function normalizeAnalysisOptions(input = {}) {
    const normalized = { ...DEFAULT_ANALYSIS_OPTIONS };
    if (input && typeof input === 'object') {
      for (const option of ANALYSIS_OPTION_DEFINITIONS) {
        if (Object.prototype.hasOwnProperty.call(input, option.id)) normalized[option.id] = !!input[option.id];
      }
    }
    return normalized;
  }

  function normalizePromptOptions(input = {}) {
    const mode = typeof input?.payloadMode === 'string' ? input.payloadMode : DEFAULT_PROMPT_OPTIONS.payloadMode;
    const validMode = PROMPT_PAYLOAD_MODES.some(option => option.id === mode) ? mode : DEFAULT_PROMPT_OPTIONS.payloadMode;
    return {
      payloadMode: validMode,
      includedFields: normalizeIncludedFields(input?.includedFields),
      reportSections: input?.reportSections && typeof input.reportSections === 'object' ? { ...input.reportSections } : {},
      pasteBackInstructions: input?.pasteBackInstructions !== false
    };
  }

  function normalizeIncludedFields(input) {
    if (!Array.isArray(input)) return null;
    return [...new Set(input.map(value => String(value || '').trim()).filter(Boolean))];
  }

  function promptFieldId(label) {
    return String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'field';
  }

  function specFieldId(label) {
    return `spec:${promptFieldId(label)}`;
  }

  function fieldSet(includedFields) {
    return Array.isArray(includedFields) ? new Set(includedFields) : null;
  }

  function wantsField(wanted, id) {
    return !wanted || wanted.has(id);
  }

  function recommendedAnalysisOptions(products = []) {
    const options = normalizeAnalysisOptions();
    const sources = (products || []).map(product => `${product.source || ''} ${product.seller || product.sellerName || ''}`).join(' ');
    if (HIGHER_RISK_SOURCES.test(sources)) options.sellerRisk = true;
    else if (REPUTABLE_SOURCES.test(sources)) options.sellerRisk = false;
    return options;
  }

  function selectedOptionLabels(input) {
    const options = normalizeAnalysisOptions(input);
    return ANALYSIS_OPTION_DEFINITIONS
      .filter(option => options[option.id])
      .map(option => option.label);
  }

  function hasAnySelected(options, ids) {
    return ids.some(id => !!options[id]);
  }

  function enabledStagesForAnalysis(input = {}, includeSecondOpinion = false) {
    const options = normalizeAnalysisOptions(input);
    const stages = ['retrieval'];
    if (hasAnySelected(options, ['verifySpecs', 'missingSpecs', 'marketingClaims', 'correctConflicts'])) {
      stages.push('verification');
    }
    if (hasAnySelected(options, ['missingSpecs', 'correctConflicts'])) {
      stages.push('enrichment');
    }
    if (hasAnySelected(options, ['comparisonColumns', 'priceValue', 'reviewsRatings', 'compareAll', 'rebrandDuplicate', 'riskSummary', 'sellerRisk', 'finalRecommendation'])) {
      stages.push('comparison');
    }
    if (includeSecondOpinion) stages.push('secondOpinion');
    return stages;
  }

  function sectionPrompt(title, instructions) {
    return `## ${title}\n${instructions.trim()}\n\n`;
  }

  function outputFormatInstruction() {
    return [
      'For every selected user-facing section:',
      '- Start with a clear Markdown H1 or H2 heading.',
      '- Show a table first.',
      '- Follow the table with concise explanatory text and bullet points.',
      '- Include each product cost and source link when relevant.',
      '- Keep the main answer precise and readable; move supporting detail into compact tables.'
    ].join('\n');
  }

  function buildSelectedSectionInstructions(stage, input) {
    const options = normalizeAnalysisOptions(input);
    let t = `Selected user-facing checks: ${selectedOptionLabels(options).join(', ') || 'none'}.\n\n`;

    if (stage === 'retrieval') {
      t += `# Internal category and buying-factor preparation\n`;
      t += `This stage is a background process and should not be presented as a user-facing report.\n`;
      t += `Use product specifications first, then title, marketplace category, bullets, description, images, brand, and model identifiers.\n`;
      t += `Infer category and subcategory for each product. Decide which products are directly comparable and which should be grouped separately.\n`;
      t += `Identify the category-specific buying factors that actually matter for these products.\n`;
      t += `Identify important missing specs for each category/subcategory and list likely official or authoritative sources to check later.\n`;
      t += `Return compact structured notes for later stages: category, subcategory, comparable group, buying factors, important spec keys, missing important specs, and suggested source URLs.\n`;
      return t;
    }

    t += outputFormatInstruction() + '\n\n';

    if (stage === 'verification') {
      if (options.verifySpecs) {
        t += sectionPrompt('Verification', 'Confirm listing specs against official, manufacturer, or authoritative sources. Flag each claim as verified, listing-only, missing, contradictory, suspicious, or unverifiable.');
      }
      if (options.missingSpecs) {
        t += sectionPrompt('Find Missing Important Specs', 'Based on the detected category and subcategory, identify important missing specs and try to fill them from official or reliable sources. Do not invent values.');
      }
      if (options.marketingClaims) {
        t += sectionPrompt('Check Marketing Claims', 'Flag vague or exaggerated claims such as "professional", "military grade", "5K", "medical grade", "premium", "commercial grade", or "up to" unless supported by native, measured, material, certified, or official specs.');
      }
      if (options.correctConflicts) {
        t += sectionPrompt('Correct Bad or Conflicting Data', 'When listing data conflicts with reliable evidence, show the original listing value and the corrected value. Include field/specification, original value, corrected value, source, confidence, and explanation.');
      }
      return t;
    }

    if (stage === 'enrichment') {
      if (options.missingSpecs) {
        t += sectionPrompt('Missing Spec Enrichment', 'Fill missing category-important specs only when supported by official or reliable evidence. Mark source type and confidence for every filled value.');
      }
      if (options.correctConflicts) {
        t += sectionPrompt('Corrected Specs', 'Return a corrections array and a readable table for bad or conflicting data. Preserve original values and corrected values so ShopScout can display crossed-out originals.');
      }
      return t;
    }

    if (stage === 'comparison') {
      t += sectionPrompt('Template JSON schema', 'Return a compact JSON object named template_report alongside the readable report. Use these buckets so ShopScout can fill the HTML template accurately: verdicts, comparison_rows, buying_factors, price_value, review_signals, risk_axes, seller_reliability, and final_recommendation. Each product-level item should include product id or name, source URL when relevant, status/confidence, and a short reason. Do not put unrelated narrative inside these buckets.');
      if (options.comparisonColumns) {
        t += sectionPrompt('Build Comparison Table Columns', 'Convert category and subcategory buying factors into comparison-table columns. Examples: swimsuits use material/care/coverage/lining; cameras use sensor/video/battery/storage/stabilization. Include cost and source link for each product.');
      }
      if (options.priceValue) {
        t += sectionPrompt('Compare Price & Value', 'Analyze new price, used price, shipping, value for specs, and whether any product is overpriced for what it offers. Include cost and source link for each product.');
      }
      if (options.reviewsRatings) {
        t += sectionPrompt('Analyze Reviews / Ratings', 'Use rating count, rating quality, common complaints, and review-photo evidence when available. Include cost and source link for each product.');
      }
      if (options.compareAll) {
        t += sectionPrompt('Compare It All', 'Create one big table that combines buying factors, price and value, and reviews. Use it as a decision table, not a raw spec dump.');
      }
      if (options.rebrandDuplicate) {
        t += sectionPrompt('Check Rebrand / Duplicate Products', 'Detect whether multiple products are likely the same underlying item under different brands using specs, dimensions, photos, wording, model numbers, manuals, and identifiers. Include cost and source link for each product.');
      }
      if (options.riskSummary) {
        t += sectionPrompt('Risk Summary', 'Summarize verification risk, spec risk, seller risk, warranty risk, rebrand risk, and return risk. Include cost and source link for each product.');
      }
      if (options.sellerRisk) {
        t += sectionPrompt('Seller / Store Reliability', 'Analyze marketplace-only listings, questionable brands, return policy, warranty, shipping risk, and seller reliability. This is more important for Alibaba, AliExpress, SHEIN, eBay, Temu, and unknown stores than reputable first-party retailers.');
      }
      if (options.finalRecommendation) {
        t += sectionPrompt('Final Recommendation', 'Return best overall, best value, lowest risk, avoid/skip, and confidence level. Include key reasons and confidence limits. Include cost and source link for each product.');
      }
      return t;
    }

    if (stage === 'secondOpinion') {
      t += sectionPrompt('Second Opinion', 'Review prior provider results only for the selected checks. Confirm, contradict, or expand their findings and explain disagreements.');
      return t;
    }

    return t;
  }

  function getProvider(id) {
    return PROVIDERS.find(provider => provider.id === id) || null;
  }

  function createDefaultSettings() {
    const providers = {};
    for (const provider of PROVIDERS) {
      providers[provider.id] = {
        enabled: false,
        apiKey: '',
        model: provider.defaultModel || '',
        baseUrl: provider.defaultBaseUrl || '',
        lastTest: null,
        notes: '',
        tokenBudget: 0,
        tokenUsage: createEmptyTokenUsage()
      };
    }
    return {
      version: 4,
      defaultProvider: 'openai',
      roles: {
        retrieval: 'auto',
        verification: 'auto',
        enrichment: 'auto',
        comparison: 'auto',
        secondOpinion: ''
      },
      providers
    };
  }

  function mergeSettings(saved) {
    const base = createDefaultSettings();
    if (!saved || typeof saved !== 'object') return base;
    const merged = {
      ...base,
      ...saved,
      roles: { ...base.roles, ...(saved.roles || {}) },
      providers: Object.fromEntries(PROVIDERS.map(provider => [
        provider.id,
        { ...base.providers[provider.id], ...((saved.providers || {})[provider.id] || {}) }
      ]))
    };
    if ((saved.version || 1) < 2) {
      merged.roles.retrieval = 'auto';
      merged.roles.verification = 'auto';
      merged.roles.enrichment = 'auto';
      merged.roles.comparison = 'auto';
    }
    if ((saved.version || 1) < 3) {
      const migrations = {
        openai: {
          'gpt-5.1': 'gpt-5.4-mini',
          'gpt-5.1-mini': 'gpt-5.4-mini',
          'gpt-5.1-nano': 'gpt-5.4-nano'
        },
        anthropic: {
          'claude-sonnet-4-5': 'claude-sonnet-4-6',
          'claude-opus-4-1': 'claude-opus-4-8'
        },
        poe: {
          'GPT-5.1-mini': 'GPT-5.4-mini',
          'Claude-Sonnet-4.5': 'Claude-Sonnet-4.6'
        },
        deepseek: {
          'deepseek-chat': 'deepseek-v4-flash',
          'deepseek-reasoner': 'deepseek-v4-pro'
        }
      };
      for (const [providerId, map] of Object.entries(migrations)) {
        const current = merged.providers[providerId]?.model;
        if (current && map[current]) merged.providers[providerId].model = map[current];
      }
    }
    for (const provider of PROVIDERS) {
      const cfg = merged.providers[provider.id];
      cfg.tokenBudget = normalizeTokenCount(cfg.tokenBudget);
      cfg.tokenUsage = normalizeTokenUsage(cfg.tokenUsage);
    }
    merged.version = 4;
    return merged;
  }

  function createEmptyTokenUsage() {
    return {
      input: 0,
      output: 0,
      total: 0,
      estimated: 0,
      reported: 0,
      requests: 0,
      lastUpdated: ''
    };
  }

  function normalizeTokenCount(value) {
    const number = Number(String(value ?? '').replace(/,/g, ''));
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.round(number);
  }

  function normalizeTokenUsage(usage = {}) {
    const input = normalizeTokenCount(usage.input);
    const output = normalizeTokenCount(usage.output);
    const total = normalizeTokenCount(usage.total || input + output);
    return {
      input,
      output,
      total,
      estimated: normalizeTokenCount(usage.estimated),
      reported: normalizeTokenCount(usage.reported),
      requests: normalizeTokenCount(usage.requests),
      lastUpdated: typeof usage.lastUpdated === 'string' ? usage.lastUpdated : ''
    };
  }

  function estimateTextTokens(value) {
    const text = String(value || '');
    if (!text) return 0;
    return Math.max(1, Math.ceil(text.length / 4));
  }

  function tokenUsageResult(input, output, total, estimated) {
    const normalizedInput = normalizeTokenCount(input);
    const normalizedOutput = normalizeTokenCount(output);
    const normalizedTotal = normalizeTokenCount(total || normalizedInput + normalizedOutput);
    return {
      input: normalizedInput,
      output: normalizedOutput,
      total: normalizedTotal,
      estimated: !!estimated
    };
  }

  function extractProviderTokenUsage(parser, json = {}, prompt = '', responseText = '') {
    let input = 0;
    let output = 0;
    let total = 0;
    const usage = json?.usage || {};

    if (parser === 'openai-responses') {
      input = usage.input_tokens;
      output = usage.output_tokens;
      total = usage.total_tokens;
    } else if (parser === 'anthropic-messages') {
      input = json?.usage?.input_tokens;
      output = json?.usage?.output_tokens;
      total = normalizeTokenCount(input) + normalizeTokenCount(output);
    } else if (parser === 'gemini-generate-content') {
      const metadata = json?.usageMetadata || {};
      input = metadata.promptTokenCount;
      output = metadata.candidatesTokenCount;
      total = metadata.totalTokenCount;
    } else {
      input = usage.prompt_tokens || usage.input_tokens;
      output = usage.completion_tokens || usage.output_tokens;
      total = usage.total_tokens;
    }

    const parsed = tokenUsageResult(input, output, total, false);
    if (parsed.total > 0) return parsed;
    return tokenUsageResult(estimateTextTokens(prompt), estimateTextTokens(responseText), 0, true);
  }

  function addProviderTokenUsage(settings, providerId, usage, timestamp) {
    const provider = getProvider(providerId);
    if (!provider || !settings?.providers?.[provider.id]) return settings;
    const cfg = settings.providers[provider.id];
    const current = normalizeTokenUsage(cfg.tokenUsage);
    const update = tokenUsageResult(usage?.input, usage?.output, usage?.total, usage?.estimated);
    cfg.tokenUsage = {
      input: current.input + update.input,
      output: current.output + update.output,
      total: current.total + update.total,
      estimated: current.estimated + (update.estimated ? update.total : 0),
      reported: current.reported + (update.estimated ? 0 : update.total),
      requests: current.requests + 1,
      lastUpdated: timestamp || new Date().toISOString()
    };
    settings.providers[provider.id] = cfg;
    return settings;
  }

  function formatTokenCount(value) {
    const number = normalizeTokenCount(value);
    if (number >= 1000000) {
      const millions = number / 1000000;
      return `${millions.toFixed(millions >= 10 ? 0 : 1).replace(/\.0$/, '')}M`;
    }
    if (number >= 1000) {
      const thousands = number / 1000;
      return `${thousands.toFixed(thousands >= 100 ? 0 : 1).replace(/\.0$/, '')}K`;
    }
    return String(number);
  }

  function getProviderTokenSummary(settings, providerId) {
    const merged = mergeSettings(settings);
    const provider = getProvider(providerId) || getProvider(merged.defaultProvider) || PROVIDERS[0];
    const cfg = merged.providers[provider.id];
    const usage = normalizeTokenUsage(cfg.tokenUsage);
    const budget = normalizeTokenCount(cfg.tokenBudget);
    const remaining = budget ? Math.max(0, budget - usage.total) : null;
    const providerLabel = provider.shortName || provider.name;
    const label = remaining === null
      ? `${providerLabel}: ${formatTokenCount(usage.total)} used`
      : `${providerLabel}: ${formatTokenCount(remaining)} left / ${formatTokenCount(budget)} · ${formatTokenCount(usage.total)} used`;
    return {
      providerId: provider.id,
      providerName: providerLabel,
      budget,
      remaining,
      usage,
      label,
      tooltip: `${provider.name}\nInput: ${formatTokenCount(usage.input)}\nOutput: ${formatTokenCount(usage.output)}\nTotal used: ${formatTokenCount(usage.total)}\nReported: ${formatTokenCount(usage.reported)}\nEstimated: ${formatTokenCount(usage.estimated)}\nRequests: ${usage.requests}${budget ? `\nBudget: ${formatTokenCount(budget)}\nRemaining: ${formatTokenCount(remaining)}` : ''}`
    };
  }

  function maskKey(value) {
    const key = String(value || '');
    if (!key) return '';
    if (key.length <= 8) return '*'.repeat(key.length);
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }

  function configuredProviders(settings) {
    const merged = mergeSettings(settings);
    return PROVIDERS.filter(provider => {
      const cfg = merged.providers[provider.id];
      return cfg?.enabled && (cfg.apiKey || provider.adapter === 'manual');
    });
  }

  function hasConfiguredProvider(settings) {
    return configuredProviders(settings).some(provider => provider.adapter !== 'manual');
  }

  function resolveProviderForStage(settings, stage) {
    const merged = mergeSettings(settings);
    const roleProviderId = merged.roles?.[stage];
    const isConfigured = provider => {
      const cfg = provider ? merged.providers[provider.id] : null;
      return !!(cfg?.enabled && (cfg.apiKey || provider.adapter === 'manual'));
    };
    const stagePreferences = {
      retrieval: ['perplexity', 'xai', 'gemini', 'openai', 'anthropic', 'deepseek', 'mistral', 'poe', 'meta'],
      verification: ['anthropic', 'openai', 'gemini', 'perplexity', 'mistral', 'deepseek', 'xai', 'poe', 'meta'],
      enrichment: ['openai', 'anthropic', 'gemini', 'mistral', 'deepseek', 'xai', 'poe', 'meta'],
      comparison: ['openai', 'anthropic', 'gemini', 'mistral', 'deepseek', 'xai', 'poe', 'meta'],
      secondOpinion: ['gemini', 'anthropic', 'openai', 'xai', 'mistral', 'deepseek', 'perplexity', 'poe', 'meta']
    };
    if (roleProviderId && roleProviderId !== 'auto') {
      const preferred = getProvider(roleProviderId);
      if (isConfigured(preferred)) return preferred;
    }
    const preferredIds = stagePreferences[stage] || [];
    for (const id of preferredIds) {
      const provider = getProvider(id);
      if (isConfigured(provider)) return provider;
    }
    const fallback = getProvider(merged.defaultProvider);
    if (isConfigured(fallback)) return fallback;
    return configuredProviders(merged)[0] || null;
  }

  function makeId(prefix) {
    const uuid = root.crypto?.randomUUID ? root.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix || 'ai'}-${uuid}`;
  }

  function createEvidenceEvent(input) {
    const provider = getProvider(input.providerId);
    return {
      id: input.id || makeId('evidence'),
      providerId: input.providerId || '',
      providerName: provider?.shortName || provider?.name || input.providerId || 'Unknown provider',
      model: input.model || '',
      stage: input.stage || '',
      status: input.status || 'completed',
      timestamp: input.timestamp || new Date().toISOString(),
      prompt: input.prompt || '',
      responseText: input.responseText || '',
      parsedJson: input.parsedJson || null,
      sourceUrls: Array.isArray(input.sourceUrls) ? input.sourceUrls : [],
      verifiesEventIds: Array.isArray(input.verifiesEventIds) ? input.verifiesEventIds : [],
      confidence: input.confidence || 'unknown',
      error: input.error || ''
    };
  }

  function extractJsonFromText(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1].trim() : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    if (!candidate || candidate === raw.slice(0, 0)) return null;
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  function compactText(value, maxLength = 240) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\b(Product description|Previous page|Next page|Click Here)\b/gi, ' ')
      .trim()
      .slice(0, maxLength)
      .trim();
  }

  function isJunkText(value) {
    const text = String(value || '').toLowerCase();
    if (!text.trim()) return true;
    const clickCount = (text.match(/\bclick here\b/g) || []).length;
    if (clickCount >= 2) return true;
    return /\bprevious page\b/.test(text) && /\bnext page\b/.test(text);
  }

  const SPEC_KEY_ALIASES = new Map([
    ['dpi', { id: 'dpi', label: 'DPI' }],
    ['dotsperinch', { id: 'dpi', label: 'DPI' }],
    ['dotperinch', { id: 'dpi', label: 'DPI' }],
    ['inputvoltage', { id: 'input_voltage', label: 'Input voltage' }],
    ['voltageinput', { id: 'input_voltage', label: 'Input voltage' }],
    ['outputvoltage', { id: 'output_voltage', label: 'Output voltage' }],
    ['voltageoutput', { id: 'output_voltage', label: 'Output voltage' }],
    ['voltage', { id: 'voltage', label: 'Voltage' }],
    ['wattage', { id: 'wattage', label: 'Wattage' }],
    ['watts', { id: 'wattage', label: 'Wattage' }],
    ['power', { id: 'wattage', label: 'Wattage' }],
    ['amperage', { id: 'amperage', label: 'Amperage' }],
    ['current', { id: 'amperage', label: 'Amperage' }],
    ['batterycapacity', { id: 'battery_capacity', label: 'Battery capacity' }],
    ['capacity', { id: 'capacity', label: 'Capacity' }],
    ['resolution', { id: 'resolution', label: 'Resolution' }],
    ['videoresolution', { id: 'video_resolution', label: 'Video resolution' }],
    ['screensize', { id: 'screen_size', label: 'Screen size' }],
    ['displaysize', { id: 'screen_size', label: 'Screen size' }]
  ]);

  function normalizeSpecKeyToken(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/\bdots?\s*\/?\s*inch\b/g, 'dots per inch')
      .replace(/\bdots?\s+per\s+inch\b/g, 'dots per inch')
      .replace(/[^a-z0-9]+/g, '')
      .trim();
  }

  function readableSpecLabel(value) {
    const raw = String(value || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    if (/^[A-Z0-9]{2,8}$/.test(raw)) return raw.toUpperCase();
    const lower = raw.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  function normalizeSpecKeyLabel(value) {
    const token = normalizeSpecKeyToken(value);
    if (SPEC_KEY_ALIASES.has(token)) return { ...SPEC_KEY_ALIASES.get(token) };
    return {
      id: token || String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
      label: readableSpecLabel(value)
    };
  }

  function normalizeSpecValue(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b(\d+(?:\.\d+)?)\s*(?:dots?\s+per\s+inch|dpi)\b/ig, '$1 DPI')
      .replace(/\b(\d+(?:\.\d+)?)\s*(?:volts?|v)\b/ig, '$1 V')
      .replace(/\b(\d+(?:\.\d+)?)\s*(?:watts?|w)\b/ig, '$1 W')
      .replace(/\b(\d+(?:\.\d+)?)\s*(?:amps?|amperes?|a)\b/ig, '$1 A')
      .replace(/\b(\d+(?:\.\d+)?)\s*(?:milliamps?|ma)\b/ig, '$1 mA')
      .replace(/\b(\d+(?:\.\d+)?)\s*(?:milliamp[- ]?hours?|mah)\b/ig, '$1 mAh')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeProductSpecs(product, limit = 30) {
    const specAccess = root.ShopScoutProductSpecAccess;
    const raw = specAccess && typeof specAccess.specEntries === 'function'
      ? specAccess.specEntries(product || {})
      : Array.isArray(product?.rawSpecs)
        ? product.rawSpecs
        : Object.entries(product?.specs || {}).map(([key, value]) => ({ key, value }));
    const byId = new Map();
    for (const spec of raw) {
      const normalizedKey = normalizeSpecKeyLabel(spec?.rawField || spec?.key || spec?.field);
      const value = normalizeSpecValue(compactText(spec?.display ?? spec?.value ?? spec?.raw, 180));
      if (!normalizedKey.id || !normalizedKey.label || !value || isJunkText(`${normalizedKey.label} ${value}`)) continue;
      const existing = byId.get(normalizedKey.id);
      if (!existing) byId.set(normalizedKey.id, { key: normalizedKey.label, value });
      else if (!existing.value.toLowerCase().split(/\s*\|\s*/).includes(value.toLowerCase())) existing.value = `${existing.value} | ${value}`;
      if (byId.size >= limit) break;
    }
    return [...byId.values()];
  }

  function compactSpecs(product, limit = 18, includedFields = null) {
    const specAccess = root.ShopScoutProductSpecAccess;
    const raw = specAccess && typeof specAccess.specEntries === 'function'
      ? specAccess.specEntries(product || {})
      : Array.isArray(product.rawSpecs)
        ? product.rawSpecs
        : Object.entries(product.specs || {}).map(([key, value]) => ({ key, value }));
    const seen = new Set();
    const specs = [];
    const wanted = fieldSet(includedFields);
    for (const spec of raw) {
      const key = compactText(spec?.rawField || spec?.key || spec?.field, 80);
      const value = compactText(spec?.display ?? spec?.value ?? spec?.raw, 180);
      const normalizedKey = key.toLowerCase();
      if (!key || !value || isJunkText(`${key} ${value}`) || seen.has(normalizedKey)) continue;
      if (!wantsField(wanted, specFieldId(key))) continue;
      seen.add(normalizedKey);
      specs.push({ key, value });
      if (specs.length >= limit) break;
    }
    return specs;
  }

  function compactBullets(product, limit = 3) {
    const bullets = Array.isArray(product.bullets) ? product.bullets : [];
    return bullets
      .map(value => compactText(value, 180))
      .filter(value => value && !isJunkText(value))
      .slice(0, limit);
  }

  function fallbackExcerpt(product, includedFields = null) {
    const description = compactText(product.description, 700);
    return {
      descriptionExcerpt: isJunkText(description) ? '' : description,
      bullets: compactBullets(product, 5),
      extraSpecs: compactSpecs(product, 30, includedFields).slice(18)
    };
  }

  function filterProductSummaryFields(summary, includedFields) {
    const wanted = fieldSet(includedFields);
    if (!wanted) return summary;
    const filtered = {
      id: summary.id,
      payloadMode: summary.payloadMode
    };
    if (wantsField(wanted, 'core:name')) {
      filtered.name = summary.name;
      filtered.listingTitle = summary.listingTitle;
    }
    if (wantsField(wanted, 'core:brand')) {
      filtered.brand = summary.brand;
      filtered.manufacturer = summary.manufacturer;
    }
    if (wantsField(wanted, 'core:model')) {
      filtered.modelName = summary.modelName;
      filtered.modelNumber = summary.modelNumber;
    }
    if (wantsField(wanted, 'core:price')) {
      filtered.price = summary.price;
      filtered.usedPrice = summary.usedPrice;
    }
    if (wantsField(wanted, 'core:source')) filtered.source = summary.source;
    if (wantsField(wanted, 'core:seller')) filtered.seller = summary.seller;
    if (wantsField(wanted, 'core:url')) filtered.url = summary.url;
    if (wantsField(wanted, 'core:category')) filtered.category = summary.category;
    if (wantsField(wanted, 'core:rating')) filtered.rating = summary.rating;
    if (wantsField(wanted, 'core:reviewCount')) filtered.reviewCount = summary.reviewCount;
    if (wantsField(wanted, 'core:identifiers') && summary.identifiers) filtered.identifiers = summary.identifiers;
    if (Array.isArray(summary.specs)) {
      filtered.specs = summary.specs.filter(spec => wantsField(wanted, specFieldId(spec.key)));
    }
    if (Array.isArray(summary.normalizedSpecs)) {
      filtered.normalizedSpecs = summary.normalizedSpecs.filter(spec => wantsField(wanted, specFieldId(spec.key)));
    }
    if (Array.isArray(summary.bullets) && summary.bullets.length && wantsField(wanted, 'core:bullets')) {
      filtered.bullets = summary.bullets;
    }
    if (summary.description && wantsField(wanted, 'core:description')) filtered.description = summary.description;
    if (summary.rawFallback) filtered.rawFallback = summary.rawFallback;
    Object.keys(filtered).forEach(key => {
      const value = filtered[key];
      if (value === '' || value == null) delete filtered[key];
      else if (Array.isArray(value) && !value.length) delete filtered[key];
      else if (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length) delete filtered[key];
    });
    return filtered;
  }

  function productSummary(products, promptOptions = {}) {
    const options = normalizePromptOptions(promptOptions);
    const full = options.payloadMode === 'full';
    return (products || []).map((product, index) => {
      const summary = {
        id: index + 1,
        payloadMode: options.payloadMode,
        name: compactText(product.productName || product.structuredProductName || product.title || `Product ${index + 1}`, full ? 500 : 220),
        listingTitle: compactText(product.listingTitle || product.title || '', full ? 800 : 260),
        brand: compactText(product.brand, 100),
        manufacturer: compactText(product.manufacturer, 100),
        modelName: compactText(product.modelName, 120),
        modelNumber: compactText(product.modelNumber, 100),
        price: compactText(product.newPrice, 50),
        usedPrice: compactText(product.usedPrice, 50),
        source: compactText(product.source, 80),
        seller: compactText(product.sellerName || product.seller, 120),
        url: product.url || '',
        category: compactText(product.category, 180),
        rating: compactText(product.rating, 40),
        reviewCount: compactText(product.reviewCount, 40),
        description: full ? compactText(product.description, 2200) : '',
        identifiers: {
          asin: compactText(product.asin, 50),
          sku: compactText(product.sku, 80),
          upc: compactText(product.upc, 50),
          mpn: compactText(product.mpn, 80),
          gtin: compactText(product.gtin, 80)
        },
        specs: compactSpecs(product, full ? 120 : 18, options.includedFields),
        normalizedSpecs: normalizeProductSpecs(product, full ? 120 : 18),
        bullets: compactBullets(product, full ? 30 : 3)
      };
      Object.keys(summary.identifiers).forEach(key => {
        if (!summary.identifiers[key]) delete summary.identifiers[key];
      });
      if (!Object.keys(summary.identifiers).length) delete summary.identifiers;
      if (full) {
        summary.rawFallback = fallbackExcerpt(product, options.includedFields);
      }
      Object.keys(summary).forEach(key => {
        const value = summary[key];
        if (value === '' || value == null) delete summary[key];
        else if (Array.isArray(value) && !value.length) delete summary[key];
        else if (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length) delete summary[key];
      });
      return filterProductSummaryFields(summary, options.includedFields);
    });
  }

  function estimatePromptPayload(products, promptOptions = {}) {
    const payload = productSummary(products, promptOptions);
    const json = JSON.stringify(payload);
    return {
      productCount: Array.isArray(products) ? products.length : 0,
      payloadMode: normalizePromptOptions(promptOptions).payloadMode,
      charCount: json.length,
      estimatedTokens: Math.max(1, Math.ceil(json.length / 4)),
      payload
    };
  }

  function summarizePriorEvents(events) {
    if (!events?.length) return 'No prior AI provider evidence yet.';
    return events.map(event => {
      const label = `${event.providerName || event.providerId} / ${event.model || 'model unknown'} / ${event.stage}`;
      const text = String(event.responseText || event.error || '').slice(0, 1800);
      return `Provider evidence: ${label}\nStatus: ${event.status}\n${text}`;
    }).join('\n\n---\n\n');
  }

  function buildPayloadInstructions(promptOptions) {
    const options = normalizePromptOptions(promptOptions);
    let text = `# Prompt payload policy\n`;
    text += `Use the compact captured facts first. Treat product URLs as source references, not as permission to ingest entire marketplace pages.\n`;
    text += `Use the locally normalized spec ledger as the starting point for equivalent specification names and simple units; verify it, correct it, and add missing category-important specs only when reliable evidence supports the change.\n`;
    text += `Retrieve/search only for missing, contradictory, or official manufacturer verification data. Prefer official manufacturer pages, manuals, spec sheets, warranty pages, certification pages, and authoritative retailers.\n`;
    text += `Do not scrape or summarize marketplace page boilerplate unless compact facts are insufficient for the selected checks.\n`;
    if (options.payloadMode === 'full') {
      text += `This run uses the full captured payload. Extract hard facts from raw descriptions and bullets, but ignore boilerplate, ads, navigation text, review widgets, and repeated marketing copy.\n`;
    }
    return `${text}\n`;
  }

  function buildStagePrompt(stage, products, priorEvents, analysisOptions, promptOptions = {}) {
    const summaries = productSummary(products, promptOptions);
    const prior = summarizePriorEvents(priorEvents);
    const data = JSON.stringify(summaries, null, 2);
    const sectionInstructions = buildSelectedSectionInstructions(stage, analysisOptions);
    const payloadInstructions = buildPayloadInstructions(promptOptions);
    const common = `You are ShopScout's AI analysis engine. Return concise but precise results. Mark every claim as verified, listing-only, inferred, missing, suspicious, or contradictory. Keep provider provenance in mind and do not hide uncertainty.\n\n${payloadInstructions}Products:\n${data}\n\nPrior provider evidence:\n${prior}\n\n${sectionInstructions}\n`;
    if (stage === 'retrieval') {
      return `${common}Stage: retrieval/search and hidden preparation.\nFind official manufacturer pages, manuals, spec sheets, warranty pages, certification pages, and authoritative retailer pages that can verify these products. Return source URLs, category/subcategory, buying factors, missing important specs, claims found, and confidence.`;
    }
    if (stage === 'verification') {
      return `${common}Stage: listing-vs-official verification.\nCompare listing claims against official or authoritative evidence for the selected verification checks. Return a readable verification report plus JSON evidence. If a listing value is wrong, include a corrections array with field or specification, original, corrected, reason, confidence, and source.`;
    }
    if (stage === 'enrichment') {
      return `${common}Stage: spec correction / enrichment.\nFill missing specs only when supported by evidence and only for selected checks. Correct listing specs when official evidence differs. Preserve each field's source, status, confidence, and provider trail. Include corrected values in a corrections array with field or specification, original, corrected, reason, confidence, and source.`;
    }
    if (stage === 'comparison') {
      return `${common}Stage: deep comparison and buying decision.\nGroup products by category/use case, avoid forcing winners across unlike items, and complete only the selected comparison/risk/recommendation sections. Return a readable report plus a JSON object with quick_verdict, products, specification_ledger, missing_attributes, risks, rebrand_checks, and final_ranking when those fields are relevant to the selected checks.`;
    }
    if (stage === 'secondOpinion') {
      return `${common}Stage: second-opinion verification.\nReview prior provider results for the selected checks. Confirm, contradict, or expand their findings. Mark which provider results you are validating and explain any disagreements.`;
    }
    return `${common}Analyze the products and return structured evidence.`;
  }

  function buildOpenAIChatRequest(provider, config, prompt) {
    return {
      url: config.baseUrl || provider.defaultBaseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: {
        model: config.model || provider.defaultModel,
        messages: [
          { role: 'system', content: 'You are a precise product verification and buying-decision assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      },
      parser: 'openai-chat'
    };
  }

  function buildRequest(provider, config, prompt) {
    if (!provider) throw new Error('Unknown AI provider');
    if (provider.adapter === 'manual') throw new Error(`${provider.name} is configured as manual/enterprise setup for now.`);
    if (!config?.apiKey) throw new Error(`${provider.name} API key is missing.`);
    const model = config.model || provider.defaultModel;

    if (provider.adapter === 'openai-responses') {
      return {
        url: 'https://api.openai.com/v1/responses',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: { model, input: prompt },
        parser: 'openai-responses'
      };
    }

    if (provider.adapter === 'anthropic-messages') {
      return {
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'Content-Type': 'application/json'
        },
        body: {
          model,
          max_tokens: 4096,
          temperature: 0.2,
          messages: [{ role: 'user', content: prompt }]
        },
        parser: 'anthropic-messages'
      };
    }

    if (provider.adapter === 'gemini-generate-content') {
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        },
        parser: 'gemini-generate-content'
      };
    }

    return buildOpenAIChatRequest(provider, config, prompt);
  }

  function parseProviderResponse(parser, json) {
    if (parser === 'openai-responses') {
      if (json.output_text) return json.output_text;
      const parts = [];
      for (const item of json.output || []) {
        for (const content of item.content || []) {
          if (content.text) parts.push(content.text);
        }
      }
      return parts.join('\n').trim();
    }
    if (parser === 'anthropic-messages') {
      return (json.content || []).map(part => part.text || '').join('\n').trim();
    }
    if (parser === 'gemini-generate-content') {
      return (json.candidates || [])
        .flatMap(candidate => candidate.content?.parts || [])
        .map(part => part.text || '')
        .join('\n')
        .trim();
    }
    return json.choices?.[0]?.message?.content || json.choices?.[0]?.text || '';
  }

  root.ShopScoutAI = {
    AI_STORAGE_KEY,
    PROVIDERS,
    STAGES,
    getProvider,
    createDefaultSettings,
    mergeSettings,
    maskKey,
    configuredProviders,
    hasConfiguredProvider,
    resolveProviderForStage,
    createEvidenceEvent,
    extractJsonFromText,
    productSummary,
    ANALYSIS_OPTION_DEFINITIONS,
    DEFAULT_ANALYSIS_OPTIONS,
    PROMPT_PAYLOAD_MODES,
    DEFAULT_PROMPT_OPTIONS,
    normalizeAnalysisOptions,
    normalizePromptOptions,
    recommendedAnalysisOptions,
    selectedOptionLabels,
    enabledStagesForAnalysis,
    buildStagePrompt,
    estimatePromptPayload,
    filterProductSummaryFields,
    buildRequest,
    parseProviderResponse,
    createEmptyTokenUsage,
    normalizeTokenUsage,
    extractProviderTokenUsage,
    addProviderTokenUsage,
    formatTokenCount,
    getProviderTokenSummary
  };
})(globalThis);
