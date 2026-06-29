(function initShopScoutColumnsMenu(root) {
  const NS = (root.ShopScoutTable = root.ShopScoutTable || {});
  const utils = NS.utils || {};
  const escapeHtml = utils.escapeHtml || (value => String(value == null ? '' : value));

  function cssEscape(value) {
    if (root.CSS && typeof root.CSS.escape === 'function') return root.CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function create(options) {
    const opts = options || {};
    const doc = opts.document || root.document;
    const getTabulator = opts.getTabulator || (() => null);
    const applyInvertedRowVisibility = opts.applyInvertedRowVisibility || (() => {});

    function build() {
      const menu = doc && doc.getElementById && doc.getElementById('dbColumnsMenu');
      const tabulator = getTabulator();
      if (!menu || !tabulator) return;
      const cols = tabulator.getColumns();
      const entries = cols.map(column => {
        const def = column.getDefinition();
        const id = def.field || '';
        const label = (def.title || id || '').toString().trim() || '(unnamed)';
        const locked = id === 'title' || id === 'thumb';
        const isRowSelect = id === 'rowSelect' || def.formatter === 'rowSelection';
        return { column, def, id, label, locked, isRowSelect };
      });
      entries.sort((a, b) => {
        const ga = a.isRowSelect ? 0 : (a.locked ? 1 : 2);
        const gb = b.isRowSelect ? 0 : (b.locked ? 1 : 2);
        if (ga !== gb) return ga - gb;
        return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
      });
      const header = ''
        + '<div class="db-columns-actions">'
        + '<button type="button" data-col-action="all">Show all</button>'
        + '<button type="button" data-col-action="none">Hide all</button>'
        + '</div>';
      menu.innerHTML = header + entries.map(entry => {
        const checked = entry.column.isVisible() ? ' checked' : '';
        const disabled = entry.locked ? ' disabled' : '';
        return '<label class="db-columns-row' + (entry.locked ? ' is-locked' : '') + '">' +
               '<input type="checkbox" data-col-field="' + escapeHtml(entry.id) + '"' + checked + disabled + '>' +
               '<span>' + escapeHtml(entry.label) + '</span>' +
               (entry.locked ? '<small>pinned</small>' : '') +
               '</label>';
      }).join('');

      menu.querySelectorAll('[data-col-action]').forEach(button => {
        button.addEventListener('click', () => {
          const want = button.dataset.colAction === 'all';
          for (const entry of entries) {
            if (entry.locked) continue;
            if (want) entry.column.show(); else entry.column.hide();
            const checkbox = menu.querySelector('[data-col-field="' + cssEscape(entry.id) + '"]');
            if (checkbox && !checkbox.disabled) checkbox.checked = want;
            const def = entry.column.getDefinition();
            const label = (def.title || '').toString().trim();
            if (label) applyInvertedRowVisibility(label, want);
          }
        });
      });

      menu.querySelectorAll('input[data-col-field]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
          const column = tabulator.getColumn(checkbox.dataset.colField);
          if (!column) return;
          if (checkbox.checked) column.show(); else column.hide();
          const def = column.getDefinition();
          const label = (def.title || '').toString().trim();
          if (label) applyInvertedRowVisibility(label, checkbox.checked);
        });
      });
    }

    function toggle(open) {
      const button = doc && doc.getElementById && doc.getElementById('dbColumnsBtn');
      const menu = doc && doc.getElementById && doc.getElementById('dbColumnsMenu');
      if (!button || !menu) return;
      const shouldOpen = open != null ? open : menu.hidden;
      if (shouldOpen) build();
      menu.hidden = !shouldOpen;
      button.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    }

    return { build, toggle };
  }

  NS.columnsMenu = { create };
})(globalThis);
