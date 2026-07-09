/* =============================================================
   ShopScout — Ribbon ScalingPolicy engine (Path B commit 8)

   Implements the Windows Ribbon Framework <ScalingPolicy> semantics
   verbatim:

     <Ribbon.Tabs>
       <Tab>
         <Tab.ScalingPolicy>
           <ScalingPolicy>
             <ScalingPolicy.IdealSizes>
               <Scale Group="A" Size="Large"/>
               <Scale Group="B" Size="Large"/>
             </ScalingPolicy.IdealSizes>
             <!-- Descending list of downgrade steps -->
             <Scale Group="B" Size="Middle"/>
             <Scale Group="B" Size="Small"/>
             <Scale Group="A" Size="Middle"/>
             <Scale Group="A" Size="Popup"/>
           </ScalingPolicy>
         </Tab.ScalingPolicy>
         ...
       </Tab>
     </Ribbon.Tabs>

   The framework walks the Scale list in the declared order until
   the ribbon fits its viewport, applying the target group's size
   mode at each step. The first entry in the list downgrades first;
   the last entry is the "smallest form possible" step.

   API surface:
     ShopScoutRibbon.scaling.set(paneId, {
       idealSizes: [{ groupId, size }, ...],
       scales:     [{ groupId, size }, ...]   // descending priority
     })
     ShopScoutRibbon.scaling.get(paneId)
     ShopScoutRibbon.scaling.remove(paneId)
     ShopScoutRibbon.scaling.enable()          (default on when ready)
     ShopScoutRibbon.scaling.disable()
     ShopScoutRibbon.scaling.rescale(paneId?)  // force a walk now

   Behaviors:
     - Groups referenced by `groupId` must carry `data-group-id="..."`
       so the walker can find them via
       `pane.querySelector('.rb-group[data-group-id="..."]')`.
     - When Scale.size === "Popup" the group's data-group-size gets
       set to "popup". Existing CSS in ribbon.css collapses the group
       content and paints a single collapsed button. Clicking that
       button opens a popover rendering the group at Large.
     - If every Scale is exhausted and the pane still overflows,
       `data-ribbon-overflow="true"` is set on the ribbon shell.
       Fluent.Ribbon's last-resort behavior is to hide the ribbon
       entirely — we match that when the viewport falls below the
       300px minimum documented in Microsoft's spec + Fluent's
       MinimalVisibleWidth constant.
     - The `Size="Large" | "Middle" | "Small" | "Popup"` tokens are
       normalized case-insensitively; Microsoft's spec uses PascalCase
       for XML but our data attributes are lowercase.
   ============================================================= */
(function initShopScoutRibbonScaling(root) {
  const NS = (root.ShopScoutRibbon = root.ShopScoutRibbon || {});
  const doc = root.document;

  /* Fluent.Ribbon Ribbon.cs:60 MinimalVisibleWidth = 300 */
  const MIN_VISIBLE_WIDTH = 300;

  /* Valid Size tokens per Microsoft's schema */
  const VALID_SIZES = new Set(['Large', 'Middle', 'Small', 'Popup']);

  /* Registry: paneId -> policy */
  const policies = new Map();

  /* Runtime state */
  const state = {
    enabled: true,
    resizeObserver: null,
    /* activePane is the shell's active .ribbon-pane at the time
       of the last walk; used so we don't re-walk while the user
       is switching tabs. */
    activePane: null
  };

  /* --- Utilities ------------------------------------------------ */
  function warn(message, detail) {
    console.warn(`[Ribbon.scaling] ${message}`, detail || '');
  }

  function normalizeSize(size) {
    if (!size) return null;
    const s = String(size).trim();
    /* Support lowercased inputs too */
    const pascal = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    return VALID_SIZES.has(pascal) ? pascal : null;
  }

  function clonePolicy(policy) {
    if (!policy) return null;
    return {
      idealSizes: policy.idealSizes.map(s => ({ ...s })),
      scales: policy.scales.map(s => ({ ...s }))
    };
  }

  /* --- Policy registration -------------------------------------- */
  /* `paneId` is a stable string identifier for the ribbon pane the
     policy applies to. Usually the pane's `data-pane` attribute
     (e.g. 'products'). */
  function set(paneId, spec) {
    if (!paneId || typeof paneId !== 'string') {
      warn('set requires a paneId string');
      return null;
    }
    if (!spec || typeof spec !== 'object') {
      warn(`set: policy for "${paneId}" must be an object`);
      return null;
    }
    const idealRaw = Array.isArray(spec.idealSizes) ? spec.idealSizes : [];
    const scalesRaw = Array.isArray(spec.scales) ? spec.scales : [];
    const idealSizes = [];
    const scales = [];
    for (const item of idealRaw) {
      if (!item?.groupId) continue;
      const size = normalizeSize(item.size);
      if (!size) {
        warn(`Ignoring ideal size for "${item.groupId}": bad Size "${item.size}"`);
        continue;
      }
      idealSizes.push({ groupId: String(item.groupId), size });
    }
    for (const item of scalesRaw) {
      if (!item?.groupId) continue;
      const size = normalizeSize(item.size);
      if (!size) {
        warn(`Ignoring scale for "${item.groupId}": bad Size "${item.size}"`);
        continue;
      }
      scales.push({ groupId: String(item.groupId), size });
    }
    const policy = { idealSizes, scales };
    policies.set(paneId, policy);
    /* Immediately re-walk to reflect the new policy */
    rescale(paneId);
    return clonePolicy(policy);
  }

  function get(paneId) {
    return clonePolicy(policies.get(paneId));
  }

  function remove(paneId) {
    policies.delete(paneId);
  }

  function all() {
    const out = {};
    for (const [id, p] of policies) out[id] = clonePolicy(p);
    return out;
  }

  /* --- Group size application ---------------------------------- */
  function findGroup(paneEl, groupId) {
    return paneEl.querySelector(`.rb-group[data-group-id="${cssEscape(groupId)}"]`);
  }

  function cssEscape(s) {
    /* Minimal escaper for attribute selector values. Chrome supports
       CSS.escape() natively; fall back for older engines. */
    return typeof root.CSS?.escape === 'function'
      ? root.CSS.escape(String(s))
      : String(s).replace(/["\\]/g, '\\$&');
  }

  function applySize(groupEl, size) {
    if (!groupEl) return;
    groupEl.setAttribute('data-group-size', String(size).toLowerCase());
  }

  function applyIdealSizes(paneEl, policy) {
    for (const { groupId, size } of policy.idealSizes) {
      const el = findGroup(paneEl, groupId);
      if (el) applySize(el, size);
    }
  }

  /* --- Fit check ----------------------------------------------- */
  /* The pane "fits" when its rendered scrollWidth is not greater
     than the ribbon-body clientWidth (with a 1px slack for sub-pixel
     rounding). */
  function paneFits(paneEl) {
    if (!paneEl) return true;
    const body = paneEl.closest('.ribbon-body') || paneEl.parentElement;
    if (!body) return true;
    const paneWidth = paneEl.scrollWidth || 0;
    const bodyWidth = body.clientWidth || 0;
    return paneWidth <= bodyWidth + 1;
  }

  /* --- The walker ---------------------------------------------- */
  /* Walks the Scale list in order, applying each downgrade until
     the pane fits its container. Returns the number of Scale steps
     applied. */
  function walkScales(paneEl, policy) {
    let applied = 0;
    if (paneFits(paneEl)) return applied;
    for (const { groupId, size } of policy.scales) {
      const el = findGroup(paneEl, groupId);
      if (!el) continue;
      applySize(el, size);
      applied += 1;
      if (paneFits(paneEl)) return applied;
    }
    /* All scales exhausted — pane still overflows */
    return applied;
  }

  /* --- Rescale one pane ---------------------------------------- */
  function rescale(paneId) {
    if (!doc || !state.enabled) return;
    const shells = doc.querySelectorAll('.ribbon-shell.rb-office-ribbon');
    shells.forEach(shell => {
      if (paneId) {
        const pane = shell.querySelector(`.ribbon-pane[data-pane="${cssEscape(paneId)}"]`);
        if (!pane) return;
        rescalePane(shell, pane);
      } else {
        const activePane = shell.querySelector('.ribbon-pane.active');
        if (activePane) rescalePane(shell, activePane);
      }
    });
  }

  function rescalePane(shellEl, paneEl) {
    const paneId = paneEl.getAttribute('data-pane');
    const policy = policies.get(paneId);
    if (!policy) return;
    const shellWidth = shellEl.clientWidth || 0;
    /* Below the 300px hard floor, hide the ribbon body entirely per
       Microsoft's spec ("The ribbon is hidden when all potential
       control layouts have been exhausted and the ribbon cannot be
       rendered with a usable application workspace") + Fluent's
       MinimalVisibleWidth. */
    if (shellWidth > 0 && shellWidth < MIN_VISIBLE_WIDTH) {
      shellEl.setAttribute('data-ribbon-overflow', 'hidden');
      return;
    }
    /* Reset every declared group to its natural state (no
       data-group-size attribute). This lets us test whether the
       pane already fits at the ambient comparison.css layout
       before we start applying Fluent-strict sizing. */
    resetAllGroups(paneEl, policy);
    if (paneFits(paneEl)) {
      /* Wide viewport — pane fits naturally. Don't apply any
         size attributes; existing HTML renders at its native
         dimensions. This is the wide-viewport happy path. */
      shellEl.removeAttribute('data-ribbon-overflow');
      shellEl.dispatchEvent(new root.CustomEvent('ribbon:rescale', {
        detail: { paneId, stepsApplied: 0, policy: clonePolicy(policy) }
      }));
      return;
    }
    /* Doesn't fit natively — apply ideal sizes then walk the
       scales. Only now do the Fluent-strict layouts kick in. */
    applyIdealSizes(paneEl, policy);
    const stepsApplied = walkScales(paneEl, policy);
    /* If we still overflow after exhausting every Scale, mark it */
    if (!paneFits(paneEl)) {
      shellEl.setAttribute('data-ribbon-overflow', 'true');
    } else {
      shellEl.removeAttribute('data-ribbon-overflow');
    }
    /* Emit event so app code can react to size changes (e.g.
       update Popup-mode collapsed-label attributes). */
    shellEl.dispatchEvent(new root.CustomEvent('ribbon:rescale', {
      detail: { paneId, stepsApplied, policy: clonePolicy(policy) }
    }));
  }

  /* Remove data-group-size from every group referenced by the
     policy so we can test the natural fit. */
  function resetAllGroups(paneEl, policy) {
    const ids = new Set();
    for (const { groupId } of policy.idealSizes) ids.add(groupId);
    for (const { groupId } of policy.scales) ids.add(groupId);
    for (const groupId of ids) {
      const el = findGroup(paneEl, groupId);
      if (el) el.removeAttribute('data-group-size');
    }
  }

  /* --- Popup collapse click handler ---------------------------- */
  /* When a group has data-group-size="popup", clicking anywhere
     inside its collapsed button opens a floating popover that
     renders the group's original controls at Large. */
  let openPopover = null;

  function closePopover() {
    if (!openPopover) return;
    openPopover.container.remove();
    doc.removeEventListener('click', onDocClickForPopover, true);
    doc.removeEventListener('keydown', onDocKeyForPopover, true);
    openPopover = null;
  }

  function onDocClickForPopover(event) {
    if (!openPopover) return;
    if (openPopover.container.contains(event.target)) return;
    if (openPopover.sourceEl.contains(event.target)) return;
    closePopover();
  }

  function onDocKeyForPopover(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePopover();
    }
  }

  function openGroupPopup(groupEl) {
    closePopover();
    const rect = groupEl.getBoundingClientRect();
    const container = doc.createElement('div');
    container.className = 'rb-office-ribbon rb-group-popup';
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-label', groupEl.getAttribute('data-collapsed-label') || 'Group');
    /* Position below the collapsed button, aligned to its left edge */
    container.style.position = 'fixed';
    container.style.top = `${Math.round(rect.bottom + 4)}px`;
    container.style.left = `${Math.round(rect.left)}px`;
    container.style.zIndex = '9999';
    container.style.background = '#fff';
    container.style.border = '1px solid var(--rule, #d1d5db)';
    container.style.borderRadius = '3px';
    container.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.18)';
    container.style.padding = '4px';
    /* Clone the group's content at Large mode. We deep-clone the
       group element itself so any command handlers wired via data-*
       attributes fire through the document-level delegate. */
    const clone = groupEl.cloneNode(true);
    clone.setAttribute('data-group-size', 'large');
    clone.style.minWidth = '0';
    container.appendChild(clone);
    doc.body.appendChild(container);
    openPopover = { container, sourceEl: groupEl };
    /* Register close listeners on the NEXT frame so the click that
       opened us doesn't immediately close us. */
    setTimeout(() => {
      doc.addEventListener('click', onDocClickForPopover, true);
      doc.addEventListener('keydown', onDocKeyForPopover, true);
    }, 0);
  }

  function attachPopupClickHandler(shell) {
    shell.addEventListener('click', event => {
      /* Only intercept clicks on the collapsed-button rendered by
         .rb-group[data-group-size="popup"] > .rb-group-content::before.
         Since the ::before is not a real element, we check whether
         the target is inside a popup-mode group's content. */
      const group = event.target?.closest?.('.rb-group[data-group-size="popup"]');
      if (!group) return;
      const content = event.target.closest('.rb-group-content');
      if (!content || content.parentElement !== group) return;
      event.preventDefault();
      event.stopPropagation();
      openGroupPopup(group);
    });
  }

  /* --- ResizeObserver bootstrap -------------------------------- */
  function attachResizeObserver(shell) {
    if (state.resizeObserver) state.resizeObserver.disconnect();
    if (typeof root.ResizeObserver !== 'function') return;
    const ro = new root.ResizeObserver(() => {
      if (!state.enabled) return;
      rescale(); /* rescale all shells' active panes */
    });
    ro.observe(shell);
    state.resizeObserver = ro;
  }

  function apply() {
    if (!doc) return;
    const shells = doc.querySelectorAll('.ribbon-shell.rb-office-ribbon');
    shells.forEach(shell => {
      if (shell.dataset.rbnScalingBound === '1') return;
      shell.dataset.rbnScalingBound = '1';
      attachResizeObserver(shell);
      attachPopupClickHandler(shell);
    });
  }

  function enable() {
    state.enabled = true;
    rescale();
  }

  function disable() {
    state.enabled = false;
  }

  if (doc?.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  /* --- Public API --------------------------------------------- */
  NS.scaling = {
    set,
    get,
    remove,
    all,
    rescale,
    enable,
    disable,
    apply,
    closePopover,
    /* Constants callers can pin to */
    MIN_VISIBLE_WIDTH,
    VALID_SIZES: Array.from(VALID_SIZES),
    version: '1.0.0-commit-8'
  };
})(globalThis);
