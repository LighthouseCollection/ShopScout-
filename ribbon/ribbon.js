/* =============================================================
   ShopScout — Office 365 ribbon component (Path B, commit 2)

   Public API surface:
     ShopScoutRibbon.defineCommand({ id, label, tooltip, keytip,
                                     largeImage, mediumImage,
                                     smallImage, handler })
     ShopScoutRibbon.control({ id, commandId, type, ... })
     ShopScoutRibbon.setMode('classic' | 'simplified')
     ShopScoutRibbon.getMode()
     ShopScoutRibbon.setGroupSpacing('small' | 'medium' | 'large')
     ShopScoutRibbon.setCollapsed(bool)
     ShopScoutRibbon.toggleCollapsed()
     ShopScoutRibbon.commands             (readonly command map)
     ShopScoutRibbon.controls             (readonly control map)
     ShopScoutRibbon.version = '1.0.0-commit-2'

   Behaviors landed this commit:
     - Double-click any tab -> toggles the collapsed state (Beijer
       confirms this Office convention: "Double-click on any of the
       ribbon tab headings to collapse the ribbon area.").
     - ResizeObserver on the ribbon-shell auto-switches to Simplified
       mode below the 900px viewport threshold (matches Office 365
       web behavior; user can override via setMode()).
     - Command/Control registry: layered on top of existing HTML
       markup for now. Templates (commit 3) will consume the registry
       to render declaratively. This lays the plumbing.

   Fluent.Ribbon uses `Middle` (not `Medium`) for the intermediate
   button size. Our data-group-size attribute matches: large / middle
   / small / popup. Same for control types — API names follow the
   Fluent.Ribbon vocabulary.
   ============================================================= */
(function initShopScoutRibbon(root) {
  const NS = (root.ShopScoutRibbon = root.ShopScoutRibbon || {});
  const doc = root.document;

  /* --- Constants ------------------------------------------------- */
  const SIMPLIFIED_THRESHOLD = 900;         /* auto-switch viewport width */
  const MODES = new Set(['classic', 'simplified']);
  const GROUP_SPACINGS = new Set(['small', 'medium', 'large']);

  /* Control types — Windows Ribbon Framework + Fluent.Ribbon +
     VSTO Ribbon API superset. Family typing informs template
     validation (commits 3-7). */
  const BUTTON_FAMILY = new Set([
    'Button',
    'ToggleButton',
    'DropDownButton',
    'SplitButton',
    'DropDownGallery',
    'SplitButtonGallery',
    'DropDownColorPicker'
  ]);
  const INPUT_FAMILY = new Set(['ComboBox', 'Spinner', 'EditBox']);
  const STANDALONE = new Set(['CheckBox', 'InRibbonGallery', 'FontControl']);
  const CONTAINER = new Set(['ButtonGroup', 'RibbonBox']);
  const ANCILLARY = new Set(['DialogLauncher', 'Separator', 'Label']);
  const VALID_TYPES = new Set([
    ...BUTTON_FAMILY,
    ...INPUT_FAMILY,
    ...STANDALONE,
    ...CONTAINER,
    ...ANCILLARY
  ]);

  /* --- Registries ------------------------------------------------ */
  const commands = new Map();
  const controls = new Map();

  /* --- State ---------------------------------------------------- */
  const state = {
    mode: 'classic',                        /* current ribbon mode */
    modeExplicit: false,                    /* did user override auto-switch? */
    groupSpacing: 'small',                  /* Microsoft default */
    collapsed: false,
    shell: null,                            /* the active .ribbon-shell */
    resizeObserver: null
  };

  /* --- Utilities ------------------------------------------------ */
  function warn(message, detail) {
    console.warn(`[ShopScoutRibbon] ${message}`, detail || '');
  }

  function familyOf(type) {
    if (BUTTON_FAMILY.has(type)) return 'button';
    if (INPUT_FAMILY.has(type)) return 'input';
    if (STANDALONE.has(type)) return type.toLowerCase();
    if (CONTAINER.has(type)) return 'container';
    if (ANCILLARY.has(type)) return 'ancillary';
    return null;
  }

  /* --- Command registry ----------------------------------------- */
  /* A Command is a definition — label, tooltip, keytip, images,
     handler. One Command can drive multiple Controls at different
     sizes / locations (QAT, ribbon Large, ribbon Small, menu item).
     See [Microsoft WindowsRibbon]: "intent-based UI model". */
  function defineCommand(spec) {
    if (!spec || typeof spec !== 'object') {
      warn('defineCommand called with non-object', spec);
      return null;
    }
    const id = String(spec.id || '').trim();
    if (!id) {
      warn('defineCommand requires an id', spec);
      return null;
    }
    const cmd = {
      id,
      label: String(spec.label || ''),
      tooltip: String(spec.tooltip || spec.label || ''),
      keytip: String(spec.keytip || ''),
      largeImage: spec.largeImage || null,  /* 32px at 96 DPI */
      mediumImage: spec.mediumImage || null,/* 20px, used in Simplified */
      smallImage: spec.smallImage || null,  /* 16px at 96 DPI */
      handler: typeof spec.handler === 'function' ? spec.handler : null,
      enabled: spec.enabled !== false,
      checked: !!spec.checked
    };
    commands.set(id, cmd);
    return cmd;
  }

  function updateCommand(id, patch) {
    const cmd = commands.get(id);
    if (!cmd) {
      warn(`updateCommand: unknown command "${id}"`);
      return null;
    }
    Object.assign(cmd, patch || {});
    return cmd;
  }

  /* --- Control registry ----------------------------------------- */
  /* A Control is a placement of a Command in a specific spot (a
     ribbon group, the QAT, a menu). Multiple Controls can share
     one Command. */
  function control(spec) {
    if (!spec || typeof spec !== 'object') {
      warn('control called with non-object', spec);
      return null;
    }
    const id = String(spec.id || '').trim();
    if (!id) {
      warn('control requires an id', spec);
      return null;
    }
    const type = String(spec.type || 'Button');
    if (!VALID_TYPES.has(type)) {
      warn(`control type "${type}" is not a recognized Ribbon control`, spec);
      return null;
    }
    const commandId = String(spec.commandId || '').trim();
    if (commandId && !commands.has(commandId)) {
      warn(`control "${id}" references unknown commandId "${commandId}" — define the Command first`);
    }
    const ctrl = {
      id,
      commandId,
      type,
      family: familyOf(type),
      /* Location — which group + which size mode(s) this Control
         appears in. Used by templates in commits 3-7. */
      groupId: spec.groupId || null,
      sizeModes: Array.isArray(spec.sizeModes) ? spec.sizeModes : ['Large', 'Middle', 'Small'],
      /* Visual overrides — control can override the Command's
         label / images (e.g. QAT typically hides label). */
      showLabel: spec.showLabel !== false,
      showImage: spec.showImage !== false,
      /* SplitButton main-click behavior — smart default matches
         behavior added in the ribbon-consolidation commit. */
      smartDefault: !!spec.smartDefault
    };
    controls.set(id, ctrl);
    return ctrl;
  }

  /* --- Ribbon mode --------------------------------------------- */
  function setMode(mode, opts) {
    if (!MODES.has(mode)) {
      warn(`setMode: "${mode}" is not a valid mode (classic | simplified)`);
      return;
    }
    state.mode = mode;
    if (opts?.explicit !== false) state.modeExplicit = true;
    if (state.shell) state.shell.setAttribute('data-ribbon-mode', mode);
  }

  function getMode() {
    return state.mode;
  }

  function setGroupSpacing(spacing) {
    if (!GROUP_SPACINGS.has(spacing)) {
      warn(`setGroupSpacing: "${spacing}" is not valid (small | medium | large)`);
      return;
    }
    state.groupSpacing = spacing;
    if (state.shell) state.shell.setAttribute('data-group-spacing', spacing);
  }

  function setCollapsed(collapsed) {
    state.collapsed = !!collapsed;
    if (state.shell) {
      state.shell.setAttribute('data-ribbon-collapsed', state.collapsed ? 'true' : 'false');
    }
  }

  function toggleCollapsed() {
    setCollapsed(!state.collapsed);
  }

  /* --- Auto-Simplified viewport switch ------------------------- */
  /* Watches the ribbon-shell's own width. Below the threshold we
     drop to Simplified unless the user has explicitly picked a mode
     via setMode(). Above the threshold, Classic returns automatically.
     Fluent.Ribbon leaves this policy to the app; we implement it
     because Office 365 web itself uses viewport-driven Simplified. */
  function attachAutoMode(shell) {
    if (state.resizeObserver) state.resizeObserver.disconnect();
    if (typeof root.ResizeObserver !== 'function') return;
    const ro = new root.ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.contentRect?.width || 0;
        if (state.modeExplicit) continue;   /* user picked a mode; don't overrule */
        const shouldBeSimplified = width > 0 && width < SIMPLIFIED_THRESHOLD;
        const nextMode = shouldBeSimplified ? 'simplified' : 'classic';
        if (nextMode !== state.mode) {
          state.mode = nextMode;
          shell.setAttribute('data-ribbon-mode', nextMode);
        }
      }
    });
    ro.observe(shell);
    state.resizeObserver = ro;
  }

  /* --- Double-click tab -> collapse ---------------------------- */
  /* Beijer confirmed this Office convention on their iX-251 docs.
     Only counts as "collapse" when the target is the currently
     active tab; double-clicking an inactive tab just switches to it. */
  function attachCollapseOnDblClick(shell) {
    shell.addEventListener('dblclick', event => {
      const tab = event.target?.closest?.('.ribbon-tab');
      if (!tab) return;
      if (!tab.classList.contains('active')) return;
      event.preventDefault();
      toggleCollapsed();
    });
  }

  /* --- Bootstrap ----------------------------------------------- */
  function apply() {
    if (!doc) return;
    const shells = doc.querySelectorAll('.ribbon-shell');
    shells.forEach(shell => {
      shell.classList.add('rb-office-ribbon');
      shell.setAttribute('data-ribbon-mode', state.mode);
      shell.setAttribute('data-group-spacing', state.groupSpacing);
      shell.setAttribute('data-ribbon-collapsed', state.collapsed ? 'true' : 'false');
    });
    /* Track the first shell for behaviors — a page never renders
       more than one primary ribbon-shell. */
    const primary = shells[0];
    if (primary && state.shell !== primary) {
      state.shell = primary;
      attachAutoMode(primary);
      attachCollapseOnDblClick(primary);
    }
  }

  if (doc?.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  /* --- Public API ---------------------------------------------- */
  Object.assign(NS, {
    apply,
    defineCommand,
    updateCommand,
    control,
    setMode,
    getMode,
    setGroupSpacing,
    setCollapsed,
    toggleCollapsed,
    /* Read-only accessors — return a snapshot so callers can't
       mutate our registries directly. */
    get commands() { return new Map(commands); },
    get controls() { return new Map(controls); },
    get state() {
      return {
        mode: state.mode,
        modeExplicit: state.modeExplicit,
        groupSpacing: state.groupSpacing,
        collapsed: state.collapsed
      };
    },
    /* Type validation helpers exposed for tests / template code */
    isButtonFamily: type => BUTTON_FAMILY.has(type),
    isInputFamily: type => INPUT_FAMILY.has(type),
    isStandalone: type => STANDALONE.has(type),
    isContainer: type => CONTAINER.has(type),
    familyOf,
    /* Constants callers can pin to */
    SIMPLIFIED_THRESHOLD,
    version: '1.0.0-commit-2'
  });
})(globalThis);
