const params = new URLSearchParams(location.search);
const provider = ShopScoutAI.getProvider(params.get('provider')) || ShopScoutAI.PROVIDERS[0];
const keyUrl = sanitizeExternalUrl(provider.keyUrl, '#');
const docsUrl = sanitizeExternalUrl(provider.docsUrl, '#');

const guide = document.getElementById('guide');
guide.innerHTML = `
  <span class="badge">${escapeHtml(provider.setupType)}</span>
  <h1>${escapeHtml(provider.name)}</h1>
  <p class="hint">${escapeHtml(provider.roleHint)}</p>
  <div class="steps">
    ${provider.instructions.map(step => `<div class="step">${escapeHtml(step)}</div>`).join('')}
  </div>
  <div class="note">
    Provider account pages often block iframe embedding. ShopScout shows this local guide here and opens the official setup pages in a normal browser tab.
    ${provider.id === 'copilot' ? '<br><br>Copilot is an enterprise/OAuth path in this version, not a simple consumer API-key setup.' : ''}
  </div>
  <p class="role">Suggested use: <strong>${escapeHtml(provider.roleHint)}</strong></p>
  <p class="role">Default model: <code>${escapeHtml(provider.defaultModel || 'user-selected')}</code></p>
  <div class="actions">
    <a class="button primary" href="${escapeAttr(keyUrl)}" target="_blank" rel="noopener">Open Key Page</a>
    <a class="button" href="${escapeAttr(docsUrl)}" target="_blank" rel="noopener">Open Docs</a>
  </div>
`;

function sanitizeExternalUrl(value, fallback = '') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw, location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
