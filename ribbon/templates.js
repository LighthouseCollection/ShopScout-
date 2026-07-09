/* =============================================================
   ShopScout — Office 365 ribbon SizeDefinition templates

   Templates are STRICT contracts on control count, order, and
   family. Per Microsoft's Windows Ribbon Framework docs:
     "If the controls declared in markup do not map exactly to
      control type, order, and quantity defined in the associated
      template, a validation error is logged … and compilation is
      terminated."

   In this web port, `validate(groupEl, templateName)` returns
   false + `console.error`s loudly on mismatch. It does NOT throw
   because Chrome extensions don't stop the world; the group
   simply renders whatever the default CSS gives it.

   Tranche A landed in commit 3 (7 templates):
     - OneButton
     - TwoButtons
     - ThreeButtons
     - ThreeButtons-OneBigAndTwoSmall
     - ThreeButtonsAndOneCheckBox
     - FourButtons
     - FiveButtons

   Tranche B landed this commit (4 templates):
     - FiveOrSixButtons  (with trailingOptional)
     - SixButtons
     - SixButtons-TwoColumns
     - SevenButtons

     Commit 5: EightButtons, EightButtons-LastThreeSmall,
               NineButtons, TenButtons, ElevenButtons
     Commit 6: ButtonGroups, ButtonGroupsAndInputs,
               BigButtonsAndSmallButtonsOrInputs
     Commit 7: OneFontControl, OneInRibbonGallery,
               InRibbonGalleryAndBigButton,
               InRibbonGalleryAndButtons-GalleryScalesFirst

   Slot family constraints:
     'button'      — any button-family control (Button,
                     ToggleButton, DropDownButton, SplitButton,
                     DropDownGallery, SplitButtonGallery,
                     DropDownColorPicker)
     'input'       — ComboBox, Spinner, EditBox
     'CheckBox'    — literally a CheckBox
     'gallery'     — InRibbonGallery / DropDownGallery /
                     SplitButtonGallery
     'fontcontrol' — the special FontControl composite
     any exact     — a specific type name matches only itself
   ============================================================= */
(function initShopScoutRibbonTemplates(root) {
  const NS = (root.ShopScoutRibbon = root.ShopScoutRibbon || {});
  const doc = root.document;

  const TEMPLATES = new Map();

  /* Slot check — does the given control type satisfy the slot's
     family/type constraint? */
  function slotAccepts(slot, controlType) {
    if (!slot) return false;
    if (slot.type && slot.type === controlType) return true;
    if (slot.family === 'button') return NS.isButtonFamily?.(controlType) === true;
    if (slot.family === 'input') return NS.isInputFamily?.(controlType) === true;
    if (slot.family === 'gallery') {
      return controlType === 'InRibbonGallery'
        || controlType === 'DropDownGallery'
        || controlType === 'SplitButtonGallery';
    }
    if (slot.family === 'CheckBox') return controlType === 'CheckBox';
    if (slot.family === 'fontcontrol') return controlType === 'FontControl';
    return false;
  }

  function slotLabel(slot) {
    if (slot?.type) return slot.type;
    if (slot?.family) return `${slot.family}-family`;
    return 'any';
  }

  /* Templates.register — used by this file to seed the built-ins
     and available to app code for custom templates. Custom names
     may be strings or integers 2-59999 per Microsoft's rule (we
     don't enforce the integer range on custom names). */
  function register(name, spec) {
    if (!name || typeof name !== 'string') {
      console.error('[Ribbon.templates] register requires a non-empty string name');
      return null;
    }
    if (!spec || !Array.isArray(spec.slots)) {
      console.error(`[Ribbon.templates] "${name}" needs a slots array`);
      return null;
    }
    if (!Array.isArray(spec.supportedSizes) || spec.supportedSizes.length === 0) {
      console.error(`[Ribbon.templates] "${name}" needs supportedSizes (at least one of Large/Middle/Small/Popup)`);
      return null;
    }
    const template = {
      name,
      supportedSizes: spec.supportedSizes.slice(),
      slots: spec.slots.slice(),
      /* Layout hints — a template may declare that a specific slot
         is the "big" one at Large mode (used by ThreeButtons-
         OneBigAndTwoSmall). Any hint is optional; templates that
         don't set it fall back to CSS defaults. */
      largeBigSlot: typeof spec.largeBigSlot === 'number' ? spec.largeBigSlot : null,
      /* Whether to allow one trailing optional slot (used by
         FiveOrSixButtons). */
      trailingOptional: !!spec.trailingOptional
    };
    TEMPLATES.set(name, template);
    return template;
  }

  function get(name) {
    return TEMPLATES.get(name) || null;
  }

  function list() {
    return Array.from(TEMPLATES.keys());
  }

  /* Validation — returns true if the group's control layout
     matches the template's contract, else logs the specific
     failure and returns false. */
  function validate(groupEl, templateName) {
    if (!groupEl) {
      console.error('[Ribbon.templates] validate called with no group element');
      return false;
    }
    const template = TEMPLATES.get(templateName);
    if (!template) {
      console.error(`[Ribbon.templates] Unknown template "${templateName}". Known: ${list().join(', ')}`);
      return false;
    }
    const contentEl = groupEl.querySelector(':scope > .rb-group-content');
    if (!contentEl) {
      console.error(`[Ribbon.templates] "${templateName}" — group is missing .rb-group-content`);
      return false;
    }
    const controls = Array.from(contentEl.children).filter(el => {
      /* Skip decorative elements (labels, mini-labels, stack
         wrappers). Only count actual controls — anything carrying
         a data-control-type attribute OR one of the recognized
         primitive classes. */
      if (el.hasAttribute('data-control-type')) return true;
      if (el.classList.contains('rb-btn-lg')
       || el.classList.contains('rb-btn-sm')
       || el.classList.contains('rb-select')
       || el.classList.contains('rb-split')
       || el.classList.contains('rb-button-group')
       || el.classList.contains('rb-ribbon-box')
       || el.tagName === 'DETAILS') return true;
      return false;
    });

    const min = template.slots.length - (template.trailingOptional ? 1 : 0);
    const max = template.slots.length;
    if (controls.length < min || controls.length > max) {
      const range = min === max ? `${max}` : `${min}-${max}`;
      console.error(
        `[Ribbon.templates] "${templateName}" — control count mismatch: `
        + `expected ${range}, got ${controls.length}`,
        controls
      );
      return false;
    }

    for (let i = 0; i < controls.length; i += 1) {
      const el = controls[i];
      const slot = template.slots[i];
      const controlType = el.getAttribute('data-control-type')
        || inferControlType(el);
      if (!slotAccepts(slot, controlType)) {
        console.error(
          `[Ribbon.templates] "${templateName}" — slot ${i} expected ${slotLabel(slot)}, `
          + `got "${controlType || 'unknown'}"`,
          el
        );
        return false;
      }
    }
    return true;
  }

  /* Best-effort inference for legacy markup without an explicit
     data-control-type attribute. Templates work best when app
     code sets the attribute explicitly. */
  function inferControlType(el) {
    if (el.classList.contains('rb-split')) return 'SplitButton';
    if (el.tagName === 'DETAILS') return 'SplitButton';
    if (el.classList.contains('rb-btn-lg')) return 'Button';
    if (el.classList.contains('rb-btn-sm')) return 'Button';
    if (el.classList.contains('rb-select')) return 'ComboBox';
    if (el.classList.contains('rb-button-group')) return 'ButtonGroup';
    if (el.classList.contains('rb-ribbon-box')) return 'RibbonBox';
    return null;
  }

  /* Apply a template to a group — sets the data attributes so the
     CSS in ribbon.css and templates.css picks up the layout. Also
     runs validation and returns the validation result so callers
     can decide whether to abort. */
  function apply(groupEl, templateName, opts) {
    const template = TEMPLATES.get(templateName);
    if (!template) {
      console.error(`[Ribbon.templates] apply: unknown template "${templateName}"`);
      return false;
    }
    if (!groupEl) return false;
    groupEl.setAttribute('data-size-definition', templateName);
    const requestedSize = opts?.size || template.supportedSizes[0];
    if (!template.supportedSizes.includes(requestedSize)) {
      console.warn(
        `[Ribbon.templates] "${templateName}" does not support size "${requestedSize}". `
        + `Supported: ${template.supportedSizes.join(', ')}. Falling back to ${template.supportedSizes[0]}.`
      );
      groupEl.setAttribute('data-group-size', template.supportedSizes[0].toLowerCase());
    } else {
      groupEl.setAttribute('data-group-size', requestedSize.toLowerCase());
    }
    return validate(groupEl, templateName);
  }

  /* ==============================================================
     Tranche A registrations — Microsoft names verbatim
     ============================================================== */

  /* OneButton — 1 button-family, Large only.
     Doc: "OneButton" */
  register('OneButton', {
    supportedSizes: ['Large'],
    slots: [{ family: 'button' }]
  });

  /* TwoButtons — 2 button-family, Large + Middle */
  register('TwoButtons', {
    supportedSizes: ['Large', 'Middle'],
    slots: [{ family: 'button' }, { family: 'button' }]
  });

  /* ThreeButtons — 3 button-family, Large + Middle */
  register('ThreeButtons', {
    supportedSizes: ['Large', 'Middle'],
    slots: [
      { family: 'button' },
      { family: 'button' },
      { family: 'button' }
    ]
  });

  /* ThreeButtons-OneBigAndTwoSmall — 3 button-family,
     Large + Middle + Small. In Large mode the first button stays
     prominent (rendered as Large), other two stack as Middle. */
  register('ThreeButtons-OneBigAndTwoSmall', {
    supportedSizes: ['Large', 'Middle', 'Small'],
    slots: [
      { family: 'button' },
      { family: 'button' },
      { family: 'button' }
    ],
    largeBigSlot: 0
  });

  /* ThreeButtonsAndOneCheckBox — 3 buttons + CheckBox at end,
     Large + Middle. CheckBox is a standalone (not button-family)
     per Microsoft's schema. */
  register('ThreeButtonsAndOneCheckBox', {
    supportedSizes: ['Large', 'Middle'],
    slots: [
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'CheckBox' }
    ]
  });

  /* FourButtons — 4 button-family, Large + Middle + Small */
  register('FourButtons', {
    supportedSizes: ['Large', 'Middle', 'Small'],
    slots: [
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'button' }
    ]
  });

  /* FiveButtons — 5 button-family, Large + Middle + Small.
     Middle mode packs into 3-row columns (3 + 2 layout). */
  register('FiveButtons', {
    supportedSizes: ['Large', 'Middle', 'Small'],
    slots: [
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'button' }
    ]
  });

  /* ==============================================================
     Tranche B registrations (commit 4)
     ============================================================== */

  /* FiveOrSixButtons — 5 or 6 button-family, Large + Middle + Small.
     The 6th slot is optional (trailingOptional). Middle mode packs
     into 3-row columns; layout is 3+2 for 5 buttons or 3+3 for 6. */
  register('FiveOrSixButtons', {
    supportedSizes: ['Large', 'Middle', 'Small'],
    slots: [
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'button' }
    ],
    trailingOptional: true
  });

  /* SixButtons — 6 button-family, Large + Middle + Small.
     Middle mode: 3+3 grid (two columns of 3 Middle buttons). */
  register('SixButtons', {
    supportedSizes: ['Large', 'Middle', 'Small'],
    slots: [
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'button' }
    ]
  });

  /* SixButtons-TwoColumns — 6 button-family, Large + Middle + Small.
     Explicit 2-column layout at every mode. Distinguishes itself
     from SixButtons by NOT collapsing to a single row at Large. */
  register('SixButtons-TwoColumns', {
    supportedSizes: ['Large', 'Middle', 'Small'],
    slots: [
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'button' }
    ]
  });

  /* SevenButtons — 7 button-family, Large + Middle + Small.
     Middle mode packs into 3-row columns (3+3+1 layout). */
  register('SevenButtons', {
    supportedSizes: ['Large', 'Middle', 'Small'],
    slots: [
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'button' },
      { family: 'button' }
    ]
  });

  /* --- Public API ------------------------------------------ */
  NS.templates = {
    register,
    get,
    list,
    validate,
    apply,
    slotAccepts,
    /* Read-only snapshot of the registry for tests / introspection */
    all() {
      const out = {};
      for (const [name, tpl] of TEMPLATES) out[name] = tpl;
      return out;
    }
  };

  /* Auto-validate any groups that already have a data-size-definition
     attribute set — helpful catch for HTML authors. */
  function autoValidateExisting() {
    if (!doc) return;
    const groups = doc.querySelectorAll('.rb-group[data-size-definition]');
    groups.forEach(group => {
      const name = group.getAttribute('data-size-definition');
      if (!TEMPLATES.has(name)) return; /* not one of ours — skip */
      validate(group, name);
    });
  }

  if (doc?.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', autoValidateExisting, { once: true });
  } else {
    autoValidateExisting();
  }
})(globalThis);
