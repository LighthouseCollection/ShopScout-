var chrome = globalThis.browser || globalThis.chrome;

const AI_SERVICES = [
  { id: 'chatgpt',    name: 'ChatGPT',          url: 'https://chatgpt.com/',              logoPath: 'icons/ai/chatgpt.svg',    desc: 'OpenAI — GPT-4o, GPT-4',             inputSel: '#prompt-textarea, textarea[data-id="root"], #prompt-textarea p' },
  { id: 'claude',     name: 'Claude',            url: 'https://claude.ai/new',             logoPath: 'icons/ai/claude.svg',     desc: 'Anthropic — Claude 4 Opus, Sonnet',   inputSel: '[contenteditable="true"], .ProseMirror, textarea' },
  { id: 'gemini',     name: 'Gemini',            url: 'https://gemini.google.com/app',     logoPath: 'icons/ai/gemini.svg',     desc: 'Google — Gemini 2.5 Pro',             inputSel: '.ql-editor, [contenteditable="true"], rich-textarea .textarea, textarea' },
  { id: 'copilot',    name: 'Copilot',           url: 'https://copilot.microsoft.com/',    logoPath: 'icons/ai/copilot.svg',    desc: 'Microsoft — GPT-4 powered',           inputSel: '#searchbox, textarea, [contenteditable="true"]' },
  { id: 'perplexity', name: 'Perplexity',        url: 'https://www.perplexity.ai/',        logoPath: 'icons/ai/perplexity.svg', desc: 'Search-powered AI with citations',    inputSel: 'textarea, [contenteditable="true"]' },
  { id: 'grok',       name: 'Grok',              url: 'https://grok.com/',                 logoPath: 'icons/ai/grok.svg',       desc: 'xAI — Grok 3',                       inputSel: 'textarea, [contenteditable="true"]' },
  { id: 'deepseek',   name: 'DeepSeek',          url: 'https://chat.deepseek.com/',        logoPath: 'icons/ai/deepseek.svg',   desc: 'DeepSeek — R1, V3',                   inputSel: 'textarea, [contenteditable="true"]' },
  { id: 'metaai',     name: 'Meta AI',           url: 'https://www.meta.ai/',              logoPath: 'icons/ai/metaai.svg',     desc: 'Meta — Llama',                        inputSel: 'textarea, [contenteditable="true"]' },
  { id: 'mistral',    name: 'Mistral',           url: 'https://chat.mistral.ai/chat',      logoPath: 'icons/ai/mistral.svg',    desc: 'Mistral — Large, Medium',             inputSel: 'textarea, [contenteditable="true"]' },
  { id: 'poe',        name: 'Poe',               url: 'https://poe.com/',                  logoPath: 'icons/ai/poe.svg',        desc: 'Multi-model — GPT, Claude, Gemini',   inputSel: 'textarea, [contenteditable="true"]' },
];

const MODE_INFO = {
  quick: {
    title: 'Quick Compare',
    desc: 'A fast price-and-value comparison across your products.',
    details: [
      'Compares price, brand, rating, and review count',
      'Shows category-aware quality factors per product',
      'Gives a concise best-value recommendation'
    ]
  },
  deep: {
    title: 'Deep Compare',
    desc: 'A comprehensive category-aware analysis with spec verification, rebrand detection, and missing attribute research.',
    details: [
      'Infers product category and applies the correct quality rubric',
      'Identifies missing defining attributes and researches them',
      'Verifies listing specs against manufacturer data',
      'Detects possible rebrands or duplicate products',
      'Checks seller reliability and flags risks',
      'Rates spec completeness, confidence, and value',
      'Gives a ranked recommendation per category'
    ]
  },
  verify: {
    title: 'Verify Specs',
    desc: 'A specification verification report that checks listing claims against official manufacturer data.',
    details: [
      'Confirms or corrects the inferred product category',
      'Compares each spec against official manufacturer specs',
      'Flags exaggerated, missing, or contradictory specs',
      'Reports on missing critical attributes for the category',
      'Detects rebranded or relabeled products',
      'Rates spec completeness and verification confidence'
    ]
  }
};

const LAST_AI_KEY = 'shopscout_last_ai';

function init() {
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') || 'quick';
  const count = params.get('count') || '0';

  document.getElementById('statusDetail').textContent = count + ' product(s) — ' + (MODE_INFO[mode]?.title || 'Compare');

  const info = MODE_INFO[mode] || MODE_INFO.quick;
  document.getElementById('modeTitle').textContent = info.title;
  document.getElementById('modeDesc').textContent = info.desc;
  var ul = document.createElement('ul');
  info.details.forEach(function(d) { var li = document.createElement('li'); li.textContent = d; ul.appendChild(li); });
  document.getElementById('modeCard').appendChild(ul);

  var grid = document.getElementById('aiGrid');
  var lastAi = localStorage.getItem(LAST_AI_KEY);

  var sorted = AI_SERVICES.slice();
  if (lastAi) {
    var idx = sorted.findIndex(function(s) { return s.id === lastAi; });
    if (idx > 0) { var item = sorted.splice(idx, 1)[0]; sorted.unshift(item); }
  }

  sorted.forEach(function(svc) {
    var card = document.createElement('a');
    card.className = 'ai-card';
    card.href = globalThis.ShopScoutSanitize.sanitizeUrl(svc.url, '#');
    card.target = '_blank';
    card.rel = 'noopener';
    card.dataset.id = svc.id;

    var isLast = svc.id === lastAi;
    var logo = document.createElement('div');
    logo.className = 'ai-logo';
    var logoImg = document.createElement('img');
    logoImg.src = svc.logoPath;
    logoImg.alt = '';
    logoImg.loading = 'lazy';
    logoImg.addEventListener('error', function() {
      logo.textContent = svc.name.slice(0, 1);
    });
    logo.appendChild(logoImg);

    var infoWrap = document.createElement('div');
    infoWrap.className = 'ai-info';
    var name = document.createElement('div');
    name.className = 'ai-name';
    name.appendChild(document.createTextNode(svc.name));
    if (isLast) {
      name.appendChild(document.createTextNode(' '));
      var last = document.createElement('span');
      last.className = 'ai-auto';
      last.textContent = 'last';
      name.appendChild(last);
    }
    var desc = document.createElement('div');
    desc.className = 'ai-desc';
    desc.textContent = svc.desc;
    infoWrap.appendChild(name);
    infoWrap.appendChild(desc);
    card.appendChild(logo);
    card.appendChild(infoWrap);

    card.addEventListener('click', async function(e) {
      e.preventDefault();
      localStorage.setItem(LAST_AI_KEY, svc.id);

      try {
        var data = await chrome.storage.local.get('shopscout_last_prompt');
        var prompt = data.shopscout_last_prompt || '';
        if (!prompt.trim()) {
          ShopScoutUI.toast.error(
            'No ShopScout prompt found. Go back to ShopScout and choose a comparison option again.',
            { duration: 6000 }
          );
          return;
        }

        // Store the paste job for background.js to handle after page loads
        await chrome.storage.local.set({
          shopscout_paste_pending: {
            serviceId: svc.id,
            inputSel: svc.inputSel,
            prompt: prompt,
            timestamp: Date.now()
          }
        });
        // Open the AI service — background.js will inject the paste script
        await chrome.tabs.create({ url: svc.url });
      } catch (err) {
        ShopScoutUI.toast.error(
          'Could not prepare the AI prompt. Please try again from ShopScout.',
          { duration: 6000 }
        );
      }
    });

    grid.appendChild(card);
  });

  document.getElementById('previewToggle').addEventListener('click', function() {
    var box = document.getElementById('previewBox');
    if (box.classList.contains('visible')) {
      box.classList.remove('visible');
      document.getElementById('previewToggle').textContent = '▼ Preview what was copied';
    } else {
      chrome.storage.local.get('shopscout_last_prompt').then(function(data) {
        box.textContent = data.shopscout_last_prompt || '(No prompt found)';
        box.classList.add('visible');
        document.getElementById('previewToggle').textContent = '▲ Hide preview';
      });
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
