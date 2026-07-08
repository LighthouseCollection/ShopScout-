/* =============================================================
   ShopScoutUI.progress — centered progress overlay for long tasks
   ============================================================= */
(function initShopScoutUIProgress(root) {
  const NS = (root.ShopScoutUI = root.ShopScoutUI || {});

  function getDom() { return NS.dom; }

  function progressPercent(current, total) {
    const max = Math.max(1, Number(total) || 1);
    const value = Math.min(max, Math.max(0, Number(current) || 0));
    return Math.round((value / max) * 100);
  }

  function start(options) {
    const dom = getDom();
    if (!dom) throw new Error('ShopScoutUI.progress requires ShopScoutUI.dom to be loaded.');
    const title = String(options?.title || 'Working');

    const titleNode = dom.elem('div', { class: 'ssui-progress-title', text: title });
    const fill = dom.elem('div', { class: 'ssui-progress-fill' });
    const meter = dom.elem('div', {
      class: 'ssui-progress-meter',
      attrs: {
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': '0'
      },
      children: [fill]
    });
    const taskNode = dom.elem('div', { class: 'ssui-progress-task', text: 'Preparing...' });
    const card = dom.elem('div', { class: 'ssui-progress-card', children: [titleNode, meter, taskNode] });
    const overlay = dom.elem('div', {
      class: 'ssui-progress-overlay',
      attrs: { role: 'status', 'aria-live': 'polite' },
      children: [card]
    });

    document.body.appendChild(overlay);

    function setTask(current, total, message) {
      const pct = progressPercent(current, total);
      meter.setAttribute('aria-valuenow', String(pct));
      fill.style.width = pct + '%';
      taskNode.textContent = `Task ${Number(current) || 0} of ${Math.max(1, Number(total) || 1)}: ${String(message || 'Working...')}`;
    }

    function done(message) {
      if (message) taskNode.textContent = String(message);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function fail(message) {
      taskNode.textContent = String(message || 'Task failed.');
      overlay.classList.add('ssui-progress-overlay--error');
    }

    return { root: overlay, setTask, done, fail };
  }

  NS.progress = { start };
})(globalThis);
