/* =============================================================
   ShopScout — Merged Products tab declarative init (Path B commit 11)

   This is the final Path B commit. Wires the merged Products tab
   to the ribbon framework built across commits 1-10:

     - Command registrations (defineCommand) for every action.
       Documentary use only right now — the existing HTML markup
       still owns rendering; the Commands become the source of
       truth for a future full-declarative-render pass.

     - ScalingPolicy registration for the 'products' pane so the
       ribbon adaptively shrinks its groups as the viewport narrows.
       This is the commit where the full Office 365 ribbon behavior
       finally becomes user-visible in ShopScout.

     - Runs after DOMContentLoaded so it can rely on the ribbon
       framework (ribbon.js -> templates.js -> scaling.js ->
       contextualTabs.js -> icons.js) already being loaded.
   ============================================================= */
(function initShopScoutProductsTab(root) {
  const doc = root.document;
  const RB = root.ShopScoutRibbon;
  if (!RB) {
    /* Ribbon framework not loaded — nothing to do */
    return;
  }

  function ready(fn) {
    if (doc?.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  /* --- Command registrations ---------------------------------- */
  function registerCommands() {
    if (typeof RB.defineCommand !== 'function') return;

    /* List group commands */
    RB.defineCommand({
      id: 'cmd:newList',
      label: 'New list',
      tooltip: 'Create a new product list',
      keytip: 'N',
      smallImage: RB.icons?.get?.('new-list', 'sm'),
      largeImage: RB.icons?.get?.('new-list', 'lg')
    });
    RB.defineCommand({
      id: 'cmd:renameList',
      label: 'Rename',
      tooltip: 'Rename the current list',
      keytip: 'R',
      smallImage: RB.icons?.get?.('rename', 'sm'),
      largeImage: RB.icons?.get?.('rename', 'lg')
    });
    RB.defineCommand({
      id: 'cmd:deleteList',
      label: 'Delete',
      tooltip: 'Delete the current list',
      keytip: 'D',
      smallImage: RB.icons?.get?.('delete-list', 'sm'),
      largeImage: RB.icons?.get?.('delete-list', 'lg')
    });

    /* Product Actions commands */
    RB.defineCommand({
      id: 'cmd:addProduct',
      label: 'Add Product',
      tooltip: 'Add a product by URL',
      keytip: 'A',
      largeImage: RB.icons?.get?.('add-product', 'lg'),
      smallImage: RB.icons?.get?.('add-product', 'sm')
    });
    RB.defineCommand({
      id: 'cmd:rescan',
      label: 'Rescan Products',
      tooltip: 'Rescan checked rows if any are selected; otherwise rescan every product',
      keytip: 'S',
      largeImage: RB.icons?.get?.('rescan', 'lg'),
      smallImage: RB.icons?.get?.('rescan', 'sm')
    });
    RB.defineCommand({
      id: 'cmd:deleteItem',
      label: 'Delete Item(s)',
      tooltip: 'Delete products',
      keytip: 'X',
      largeImage: RB.icons?.get?.('delete-item', 'lg'),
      smallImage: RB.icons?.get?.('delete-item', 'sm')
    });

    /* Review & Rules commands */
    RB.defineCommand({
      id: 'cmd:duplicateReview',
      label: 'Possible Duplicates',
      tooltip: 'Review possible duplicate products',
      keytip: 'PD',
      largeImage: RB.icons?.get?.('duplicates', 'lg'),
      smallImage: RB.icons?.get?.('duplicates', 'sm')
    });
    RB.defineCommand({
      id: 'cmd:normalizeReview',
      label: 'Normalize Review',
      tooltip: 'Review unmapped or low-confidence normalized attributes',
      keytip: 'NR',
      largeImage: RB.icons?.get?.('normalize-review', 'lg'),
      smallImage: RB.icons?.get?.('normalize-review', 'sm')
    });
    RB.defineCommand({
      id: 'cmd:verticalPacks',
      label: 'Vertical Packs',
      tooltip: 'Choose the product vertical for generated normalization packs',
      keytip: 'VP',
      largeImage: RB.icons?.get?.('vertical-packs', 'lg'),
      smallImage: RB.icons?.get?.('vertical-packs', 'sm')
    });
    RB.defineCommand({
      id: 'cmd:userRules',
      label: 'User Rules',
      tooltip: 'Edit or delete user-approved normalization rules',
      keytip: 'UR',
      largeImage: RB.icons?.get?.('user-rules', 'lg'),
      smallImage: RB.icons?.get?.('user-rules', 'sm')
    });

    /* View commands */
    RB.defineCommand({
      id: 'cmd:modeRows',
      label: 'Products',
      tooltip: 'Show products as rows',
      keytip: 'MR',
      largeImage: RB.icons?.get?.('mode-rows', 'lg'),
      smallImage: RB.icons?.get?.('mode-rows', 'sm')
    });
    RB.defineCommand({
      id: 'cmd:modeMatrix',
      label: 'Compare',
      tooltip: 'Compare products as columns',
      keytip: 'MC',
      largeImage: RB.icons?.get?.('mode-matrix', 'lg'),
      smallImage: RB.icons?.get?.('mode-matrix', 'sm')
    });
    RB.defineCommand({
      id: 'cmd:columns',
      label: 'Columns',
      tooltip: 'Show or hide columns',
      keytip: 'C',
      largeImage: RB.icons?.get?.('columns', 'lg'),
      smallImage: RB.icons?.get?.('columns', 'sm')
    });

    /* Organize commands */
    RB.defineCommand({
      id: 'cmd:sortAsc',
      label: 'Asc',
      tooltip: 'Sort ascending',
      keytip: 'SA',
      largeImage: RB.icons?.get?.('sort-asc', 'lg'),
      smallImage: RB.icons?.get?.('sort-asc', 'sm')
    });
    RB.defineCommand({
      id: 'cmd:sortDesc',
      label: 'Desc',
      tooltip: 'Sort descending',
      keytip: 'SD',
      largeImage: RB.icons?.get?.('sort-desc', 'lg'),
      smallImage: RB.icons?.get?.('sort-desc', 'sm')
    });
    RB.defineCommand({
      id: 'cmd:filter',
      label: 'Filters',
      tooltip: 'Add or edit filters',
      keytip: 'F',
      largeImage: RB.icons?.get?.('filter', 'lg'),
      smallImage: RB.icons?.get?.('filter', 'sm')
    });
    RB.defineCommand({
      id: 'cmd:groupBy',
      label: 'Group by',
      tooltip: 'Group rows by field',
      keytip: 'G',
      largeImage: RB.icons?.get?.('group-by', 'lg'),
      smallImage: RB.icons?.get?.('group-by', 'sm')
    });
    RB.defineCommand({
      id: 'cmd:reset',
      label: 'Reset',
      tooltip: 'Reset filters / sort / grouping / columns',
      keytip: 'R',
      largeImage: RB.icons?.get?.('reset', 'lg'),
      smallImage: RB.icons?.get?.('reset', 'sm')
    });
  }

  /* --- ScalingPolicy for the Products pane ------------------- */
  /* When the viewport narrows, downgrade in this order (each entry
     is a step the engine tries in sequence). The two dense groups
     collapse first because they contain multi-row controls and long
     labels; shrinking them through Middle/Small creates internal
     collisions instead of a real Office-style ribbon response:

       1. Review     -> Popup
       2. Organize   -> Popup
       3. View       -> Middle
       4. View       -> Small
       5. View       -> Popup
       6. Actions    -> Middle
       7. Actions    -> Popup

     The List group is left at Large throughout because the list
     picker is the anchor of the tab — collapsing it would remove
     the primary affordance. If the ribbon still can't fit after
     step 11 the scaling engine sets data-ribbon-overflow=true
     which triggers a horizontal-scroll fallback (see ribbon.css
     section 16). Below 300px viewport the ribbon body is hidden
     entirely per Microsoft's minimum-render-width spec. */
  function registerScalingPolicy() {
    if (!RB.scaling?.set) return;
    RB.scaling.set('products', {
      idealSizes: [
        { groupId: 'list',     size: 'Large' },
        { groupId: 'actions',  size: 'Large' },
        { groupId: 'review',   size: 'Large' },
        { groupId: 'view',     size: 'Large' },
        { groupId: 'organize', size: 'Large' }
      ],
      scales: [
        /* Tier 1 — dense groups collapse as whole groups, Office-style */
        { groupId: 'review',   size: 'Popup'  },
        { groupId: 'organize', size: 'Popup'  },
        /* Tier 2 — compact the simple View group */
        { groupId: 'view',     size: 'Middle' },
        { groupId: 'view',     size: 'Small'  },
        { groupId: 'view',     size: 'Popup'  },
        /* Tier 3 — only List and Actions remain; start shrinking Actions */
        { groupId: 'actions',  size: 'Middle' },
        { groupId: 'actions',  size: 'Popup'  }
      ]
    });
  }

  /* --- Sort direction toggle ---------------------------------- */
  /* The Sort By dropdown has an integrated ↑ / ↓ toggle button.
     Clicking cycles the direction and fires the corresponding
     data-ss-grid-command so shopscoutGrid's existing sort-asc /
     sort-desc handlers pick it up unchanged. */
  function wireSortDirToggle() {
    const btn = doc?.getElementById?.('sortDirToggle');
    const select = doc?.getElementById?.('gridSortField');
    if (!btn) return;
    btn.addEventListener('click', event => {
      event.preventDefault();
      /* Refuse to sort if no field is chosen — same guard as the
         old Asc/Desc buttons. */
      if (select && !select.value) {
        if (typeof root.SS?.toast?.show === 'function') {
          root.SS.toast.show('Choose a field to sort by first.', 'error');
        }
        return;
      }
      const current = btn.getAttribute('data-sort-dir') === 'desc' ? 'desc' : 'asc';
      const next = current === 'asc' ? 'desc' : 'asc';
      btn.setAttribute('data-sort-dir', next);
      const glyph = btn.querySelector('.rb-sort-dir-glyph');
      if (glyph) glyph.textContent = next === 'desc' ? '↓' : '↑';
      btn.setAttribute(
        'aria-label',
        `Toggle sort direction — currently ${next === 'desc' ? 'descending' : 'ascending'}`
      );
      /* Dispatch a synthetic click on a data-ss-grid-command anchor
         so shopscoutGrid's existing command dispatcher picks it up. */
      const synthetic = doc.createElement('button');
      synthetic.setAttribute('data-ss-grid-command', next === 'desc' ? 'sort-desc' : 'sort-asc');
      synthetic.style.display = 'none';
      doc.body.appendChild(synthetic);
      synthetic.click();
      synthetic.remove();
    });
  }

  /* --- Bootstrap ---------------------------------------------- */
  ready(() => {
    registerCommands();
    registerScalingPolicy();
    wireSortDirToggle();
  });
})(globalThis);
