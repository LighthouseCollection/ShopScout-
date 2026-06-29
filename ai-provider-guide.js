const params = new URLSearchParams(location.search);
const provider = ShopScoutAI.getProvider(params.get('provider')) || ShopScoutAI.PROVIDERS[0];
const Sanitize = globalThis.ShopScoutSanitize;

const guide = document.getElementById('guide');
Sanitize.replaceChildren(guide, [
  el('span', { class: 'badge' }, [provider.setupType]),
  el('h1', {}, [provider.name]),
  el('p', { class: 'hint' }, [provider.roleHint]),
  el('div', { class: 'steps' }, provider.instructions.map(step => el('div', { class: 'step' }, [step]))),
  el('div', { class: 'note' }, noteChildren(provider)),
  el('p', { class: 'role' }, ['Suggested use: ', el('strong', {}, [provider.roleHint])]),
  el('p', { class: 'role' }, ['Default model: ', el('code', {}, [provider.defaultModel || 'user-selected'])]),
  el('div', { class: 'actions' }, [
    el('a', {
      class: 'button primary',
      href: Sanitize.sanitizeUrl(provider.keyUrl, '#'),
      target: '_blank',
      rel: 'noopener'
    }, ['Open Key Page']),
    el('a', {
      class: 'button',
      href: Sanitize.sanitizeUrl(provider.docsUrl, '#'),
      target: '_blank',
      rel: 'noopener'
    }, ['Open Docs'])
  ])
]);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    node.setAttribute(name, String(value));
  }
  Sanitize.replaceChildren(node, children);
  return node;
}

function noteChildren(selectedProvider) {
  const children = [
    'Provider account pages often block iframe embedding. ShopScout shows this local guide here and opens the official setup pages in a normal browser tab.'
  ];
  if (selectedProvider.id === 'copilot') {
    children.push(el('br'), el('br'), 'Copilot is an enterprise/OAuth path in this version, not a simple consumer API-key setup.');
  }
  return children;
}
