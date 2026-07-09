/* =============================================================
   ShopScout — Ribbon.ContextualTabs infrastructure (Path B commit 9)

   Implements the Windows Ribbon Framework `<Ribbon.ContextualTabs>`
   / `<TabGroup>` semantics for a web ribbon:

     <Ribbon.ContextualTabs>
       <TabGroup CommandName="cmdPictureTools">
         <Tab CommandName="cmdPictureFormat"/>
         <Tab CommandName="cmdPictureLayout"/>
       </TabGroup>
     </Ribbon.ContextualTabs>

   Each TabGroup has three runtime states, matching the framework's
   ContextAvailable enum:

     - NotAvailable  — tabs hidden, band hidden
     - Available     — tabs hidden, band hidden (visually identical
                       to NotAvailable in this port; the state exists
                       to distinguish "known-but-inactive context"
                       from "context not present at all")
     - Active        — tabs rendered in the strip alongside standard
                       tabs, with a colored band above them showing
                       the group's label

   Microsoft's spec does NOT publish a color palette for TabGroups
   (see the earlier research pass). Colors are app-defined via
   the `contextualColor` prop when defining a tab group. Office
   convention is a distinct hue per functional group (Table Tools =
   green, Picture Tools = orange, etc.) — this port lets the caller
   supply any CSS color.

   API surface:
     ShopScoutRibbon.contextualTabs.defineTabGroup({
       id, label, contextualColor,
       tabs: [{ id, label, paneId? }, ...]
     })
     ShopScoutRibbon.contextualTabs.setState(groupId, state)
     ShopScoutRibbon.contextualTabs.getState(groupId)
     ShopScoutRibbon.contextualTabs.showTabGroup(groupId)  // sugar for setState('Active')
     ShopScoutRibbon.contextualTabs.hideTabGroup(groupId)  // sugar for setState('NotAvailable')
     ShopScoutRibbon.contextualTabs.remove(groupId)
     ShopScoutRibbon.contextualTabs.all()
     ShopScoutRibbon.contextualTabs.getActiveGroups()

   Emitted events on the shell:
     - ribbon:contextualtabgroup:show   detail = { groupId, tabs }
     - ribbon:contextualtabgroup:hide   detail = { groupId }
   ============================================================= */
(function initShopScoutRibbonContextualTabs(root) {
  const NS = (root.ShopScoutRibbon = root.ShopScoutRibbon || {});
  const doc = root.document;

  /* Registry: groupId -> definition */
  const groups = new Map();
  /* State: groupId -> ContextAvailable enum */
  const states = new Map();

  const VALID_STATES = new Set(['NotAvailable', 'Available', 'Active']);

  function warn(message, detail) {
    console.warn(`[Ribbon.contextualTabs] ${message}`, detail || '');
  }

  function normalizeState(state) {
    if (!state) return null;
    const s = String(state).trim();
    /* Accept both PascalCase (Microsoft) and lowercase */
    const upper = s.charAt(0).toUpperCase() + s.slice(1);
    /* Special-case "notavailable" -> "NotAvailable" */
    if (upper.toLowerCase() === 'notavailable') return 'NotAvailable';
    return VALID_STATES.has(upper) ? upper : null;
  }

  function cloneGroup(group) {
    if (!group) return null;
    return {
      id: group.id,
      label: group.label,
      contextualColor: group.contextualColor,
      tabs: group.tabs.map(t => ({ ...t }))
    };
  }

  /* --- Registry ------------------------------------------------ */
  function defineTabGroup(spec) {
    if (!spec || typeof spec !== 'object') {
      warn('defineTabGroup requires an object');
      return null;
    }
    const id = String(spec.id || '').trim();
    if (!id) {
      warn('defineTabGroup requires an id');
      return null;
    }
    if (!Array.isArray(spec.tabs) || spec.tabs.length === 0) {
      warn(`defineTabGroup "${id}" requires a non-empty tabs array`);
      return null;
    }
    const tabs = [];
    for (const tab of spec.tabs) {
      if (!tab?.id) {
        warn(`defineTabGroup "${id}" — tab missing id, skipping`);
        continue;
      }
      tabs.push({
        id: String(tab.id),
        label: String(tab.label || tab.id),
        paneId: tab.paneId ? String(tab.paneId) : null
      });
    }
    if (tabs.length === 0) {
      warn(`defineTabGroup "${id}" — no valid tabs after filtering`);
      return null;
    }
    const group = {
      id,
      label: String(spec.label || id),
      contextualColor: String(spec.contextualColor || 'var(--accent, #ecd496)'),
      tabs
    };
    groups.set(id, group);
    /* Default state = NotAvailable */
    if (!states.has(id)) states.set(id, 'NotAvailable');
    /* Immediately reconcile the DOM */
    reconcile();
    return cloneGroup(group);
  }

  function remove(groupId) {
    if (!groupId) return;
    setState(groupId, 'NotAvailable');
    groups.delete(groupId);
    states.delete(groupId);
    reconcile();
  }

  function all() {
    const out = {};
    for (const [id, group] of groups) {
      out[id] = { ...cloneGroup(group), state: states.get(id) };
    }
    return out;
  }

  function getActiveGroups() {
    const out = [];
    for (const [id, state] of states) {
      if (state === 'Active') out.push(cloneGroup(groups.get(id)));
    }
    return out;
  }

  /* --- State setter -------------------------------------------- */
  function setState(groupId, state) {
    if (!groups.has(groupId)) {
      warn(`setState: unknown groupId "${groupId}". Define it first via defineTabGroup().`);
      return;
    }
    const normalized = normalizeState(state);
    if (!normalized) {
      warn(`setState: "${state}" is not a valid ContextAvailable state. `
        + `Use NotAvailable | Available | Active.`);
      return;
    }
    const previous = states.get(groupId);
    states.set(groupId, normalized);
    reconcile();
    /* Fire show/hide events on the primary shell when the effective
       visibility changes (Active vs any other). */
    const shell = doc?.querySelector('.ribbon-shell.rb-office-ribbon');
    if (shell) {
      const wasActive = previous === 'Active';
      const isActive = normalized === 'Active';
      if (!wasActive && isActive) {
        shell.dispatchEvent(new root.CustomEvent('ribbon:contextualtabgroup:show', {
          detail: { groupId, tabs: groups.get(groupId).tabs.map(t => ({ ...t })) }
        }));
      } else if (wasActive && !isActive) {
        shell.dispatchEvent(new root.CustomEvent('ribbon:contextualtabgroup:hide', {
          detail: { groupId }
        }));
      }
    }
  }

  function getState(groupId) {
    return states.get(groupId) || null;
  }

  function showTabGroup(groupId) {
    setState(groupId, 'Active');
  }

  function hideTabGroup(groupId) {
    setState(groupId, 'NotAvailable');
  }

  /* --- DOM reconcile ------------------------------------------ */
  /* Renders the contextual tab band + tab buttons for every Active
     group into every `.ribbon-shell.rb-office-ribbon`'s tab strip.
     Idempotent: removes stale contextual elements before rendering,
     so setState/defineTabGroup can be called freely. */
  function reconcile() {
    if (!doc) return;
    const shells = doc.querySelectorAll('.ribbon-shell.rb-office-ribbon');
    shells.forEach(shell => reconcileShell(shell));
  }

  function reconcileShell(shell) {
    /* Remove any existing contextual rendering */
    shell.querySelectorAll('.rb-contextual-tab-band').forEach(el => el.remove());
    shell.querySelectorAll('.ribbon-tab[data-contextual-group-id]').forEach(el => el.remove());

    const tabList = shell.querySelector('.ribbon-tab-list, .ribbon-tabs');
    if (!tabList) return;

    /* Collect Active groups in registration order */
    const activeGroups = [];
    for (const [id, group] of groups) {
      if (states.get(id) === 'Active') activeGroups.push(group);
    }
    if (activeGroups.length === 0) {
      shell.removeAttribute('data-has-contextual-tabs');
      return;
    }
    shell.setAttribute('data-has-contextual-tabs', 'true');

    /* Render each Active group */
    for (const group of activeGroups) {
      /* Render tab buttons appended to the tab list */
      const insertionRef = findContextualInsertionPoint(tabList);
      for (const tab of group.tabs) {
        const btn = doc.createElement('button');
        btn.className = 'ribbon-tab';
        btn.type = 'button';
        btn.setAttribute('data-tab', tab.paneId || tab.id);
        btn.setAttribute('data-contextual-group-id', group.id);
        btn.setAttribute('data-contextual-color', group.contextualColor);
        btn.style.setProperty('--rbn-contextual-color', group.contextualColor);
        btn.textContent = tab.label;
        if (insertionRef) {
          insertionRef.parentNode.insertBefore(btn, insertionRef);
        } else {
          tabList.appendChild(btn);
        }
      }

      /* Render the label band above the tab strip. Portal it into
         the shell so it can position absolutely without affecting
         layout. */
      const band = doc.createElement('div');
      band.className = 'rb-contextual-tab-band';
      band.setAttribute('data-contextual-group-id', group.id);
      band.style.setProperty('--rbn-contextual-color', group.contextualColor);
      const label = doc.createElement('span');
      label.className = 'rb-contextual-tab-band-label';
      label.textContent = group.label;
      band.appendChild(label);
      shell.insertBefore(band, shell.firstChild);
    }
  }

  /* Find where to insert contextual tabs. Office convention:
     contextual tabs live at the right edge of the tab list, before
     any `.ribbon-spacer` / `.ribbon-actions` element. */
  function findContextualInsertionPoint(tabList) {
    const spacer = tabList.querySelector('.ribbon-spacer, .ribbon-actions');
    return spacer || null;
  }

  /* --- Bootstrap ----------------------------------------------- */
  function apply() {
    if (!doc) return;
    reconcile();
  }

  if (doc?.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  /* --- Public API --------------------------------------------- */
  NS.contextualTabs = {
    defineTabGroup,
    setState,
    getState,
    showTabGroup,
    hideTabGroup,
    remove,
    all,
    getActiveGroups,
    apply,
    VALID_STATES: Array.from(VALID_STATES),
    version: '1.0.0-commit-9'
  };
})(globalThis);
