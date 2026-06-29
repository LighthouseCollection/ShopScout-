(function initShopScoutRowActionsMenu(root) {
  const NS = (root.ShopScoutTable = root.ShopScoutTable || {});

  function create(options) {
    const opts = options || {};
    const doc = opts.document || root.document;
    const win = opts.window || root.window;
    const repo = opts.repo;
    const getTabulator = opts.getTabulator || (() => null);
    const setStatus = opts.setStatus || (() => {});
    let bound = false;
    let openTarget = null;

    function close() {
      const menu = doc && doc.getElementById && doc.getElementById('dbRowActionsMenu');
      if (menu) menu.remove();
      openTarget = null;
    }

    function open(anchor, row) {
      close();
      if (!doc || !anchor || !row) return;
      const data = row.getData && row.getData();
      if (!data) return;
      const menu = doc.createElement('div');
      menu.id = 'dbRowActionsMenu';
      menu.className = 'db-row-actions-menu';
      menu.innerHTML =
        '<button type="button" data-action="open"   ' + (data.url ? '' : 'disabled') + '><span class="db-row-actions-ico">&#x2197;</span>Open product page</button>' +
        '<button type="button" data-action="edit">  <span class="db-row-actions-ico">&#x270E;</span>Edit details</button>' +
        '<button type="button" data-action="rescan" ' + (data.url ? '' : 'disabled') + '><span class="db-row-actions-ico">&#x21bb;</span>Rescan from page</button>' +
        '<div class="db-row-actions-sep"></div>' +
        '<button type="button" data-action="delete" class="is-danger"><span class="db-row-actions-ico">&times;</span>Delete row</button>';
      doc.body.appendChild(menu);
      const rect = anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      let left = rect.right - menuRect.width;
      if (left < 8) left = 8;
      if (win && left + menuRect.width > win.innerWidth - 8) left = win.innerWidth - menuRect.width - 8;
      menu.style.top = (rect.bottom + 4 + ((win && win.scrollY) || 0)) + 'px';
      menu.style.left = (left + ((win && win.scrollX) || 0)) + 'px';
      openTarget = anchor;
      menu.addEventListener('click', event => onActionClick(event, data, row));
    }

    async function onActionClick(event, data, row) {
      const button = event.target.closest('button[data-action]');
      if (!button || button.disabled) return;
      const action = button.dataset.action;
      close();
      if (action === 'open') {
        if (data.url && win && win.open) win.open(data.url, '_blank', 'noopener');
      } else if (action === 'edit') {
        if (typeof root.openProductDetailById === 'function') root.openProductDetailById({ id: data.id, url: data.url });
      } else if (action === 'rescan') {
        if (typeof root.rescanProductById === 'function') root.rescanProductById({ id: data.id, url: data.url });
      } else if (action === 'delete') {
        if (repo && data.id) await repo.removeProduct(data.id);
        if (row.delete) row.delete();
        const table = getTabulator();
        setStatus(((table && table.getDataCount && table.getDataCount()) || 0) + ' rows');
      }
    }

    function bindGlobal() {
      if (bound || !doc || !doc.addEventListener) return;
      bound = true;
      doc.addEventListener('click', event => {
        const menu = doc.getElementById('dbRowActionsMenu');
        if (!menu) return;
        if (menu.contains(event.target)) return;
        if (event.target.closest && event.target.closest('[data-row-actions]')) return;
        close();
      });
      doc.addEventListener('keydown', event => {
        if (event.key === 'Escape') close();
      });
    }

    return {
      open,
      close,
      bindGlobal,
      getOpenTarget: () => openTarget
    };
  }

  NS.rowActions = { create };
})(globalThis);
