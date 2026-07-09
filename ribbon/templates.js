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

   Tranche B landed in commit 4 (4 templates):
     - FiveOrSixButtons  (with trailingOptional)
     - SixButtons
     - SixButtons-TwoColumns
     - SevenButtons

   Tranche C landed in commit 5 (5 templates + ControlGroup):
     - EightButtons
     - EightButtons-LastThreeSmall  (uses ControlGroup [5,3])
     - NineButtons
     - TenButtons
     - ElevenButtons

   Tranche D landed in commit 6 (3 mixed-family templates):
     - ButtonGroups                       (variable button-family)
     - ButtonGroupsAndInputs              (2 inputs + up to 29 buttons)
     - BigButtonsAndSmallButtonsOrInputs  (big button + small buttons/inputs)

   Tranche E landed this commit (4 specialized templates):
     - OneFontControl                                    (Fluent FontControl composite)
     - OneInRibbonGallery                                (single inline gallery)
     - InRibbonGalleryAndBigButton                       (gallery + big button)
     - InRibbonGalleryAndButtons-GalleryScalesFirst      (gallery + buttons;
                                                          gallery collapses first)

   REGISTRY COMPLETE: 23/23 Microsoft SizeDefinition templates.

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
     family/type constraint? A slot may declare `family` as a single
     string OR an array of strings (in which case any match passes,
     used by tranche D templates that accept mixed families). */
  function slotAccepts(slot, controlType) {
    if (!slot) return false;
    if (slot.type && slot.type === controlType) return true;
    const families = Array.isArray(slot.family) ? slot.family : [slot.family];
    for (const family of families) {
      if (!family) continue;
      if (family === 'button' && NS.isButtonFamily?.(controlType) === true) return true;
      if (family === 'input' && NS.isInputFamily?.(controlType) === true) return true;
      if (family === 'gallery') {
        if (controlType === 'InRibbonGallery'
         || controlType === 'DropDownGallery'
         || controlType === 'SplitButtonGallery') return true;
      }
      if (family === 'CheckBox' && controlType === 'CheckBox') return true;
      if (family === 'fontcontrol' && controlType === 'FontControl') return true;
    }
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
      trailingOptional: !!spec.trailingOptional,
      /* Some templates require the controls to be partitioned into
         explicit ControlGroup sub-containers (e.g.
         EightButtons-LastThreeSmall wants [5, 3]). When set, the
         validator expects that many .rb-control-group children of
         .rb-group-content, with exactly those child counts. */
      controlGroups: Array.isArray(spec.controlGroups) ? spec.controlGroups.slice() : null,
      /* Mixed templates (ButtonGroups, ButtonGroupsAndInputs) may
         accept a variable number of controls trailing after fixed
         leading slots. `flexibleSlots = { min, max, family }`
         declares a suffix: after the fixed `slots` array, allow
         between min and max additional controls that match the
         given family (or family array). */
      flexibleSlots: spec.flexibleSlots && typeof spec.flexibleSlots === 'object'
        ? {
            min: Math.max(0, spec.flexibleSlots.min | 0),
            max: Math.max(spec.flexibleSlots.min | 0, spec.flexibleSlots.max | 0),
            family: spec.flexibleSlots.family || null,
            type: spec.flexibleSlots.type || null
          }
        : null
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

    /* If the template requires ControlGroup partitioning, validate
       that first, then flatten to a single control list. Microsoft's
       schema uses `<ControlGroup>` in the SizeDefinition for
       templates like EightButtons-LastThreeSmall. */
    if (template.controlGroups) {
      const cgEls = Array.from(contentEl.children).filter(el =>
        el.classList.contains('rb-control-group')
      );
      const expected = template.controlGroups;
      if (cgEls.length !== expected.length) {
        console.error(
          `[Ribbon.templates] "${templateName}" — expected ${expected.length} `
          + `<ControlGroup> children (.rb-control-group), got ${cgEls.length}`
        );
        return false;
      }
      for (let g = 0; g < expected.length; g += 1) {
        const cgChildren = Array.from(cgEls[g].children).filter(el =>
          isCountableControl(el)
        );
        if (cgChildren.length !== expected[g]) {
          console.error(
            `[Ribbon.templates] "${templateName}" — ControlGroup ${g} `
            + `expected ${expected[g]} controls, got ${cgChildren.length}`
          );
          return false;
        }
      }
    }

    const controls = Array.from(contentEl.querySelectorAll(
      template.controlGroups
        ? ':scope > .rb-control-group > *'
        : ':scope > *'
    )).filter(isCountableControl);

    const fixedCount = template.slots.length;
    const flex = template.flexibleSlots;
    const min = fixedCount - (template.trailingOptional ? 1 : 0) + (flex?.min || 0);
    const max = fixedCount + (flex ? flex.max : 0);
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
      /* If we're past the fixed slots, use the flexibleSlots slot
         template for the family/type constraint. */
      const slot = i < fixedCount ? template.slots[i] : flex;
      if (!slot) {
        console.error(
          `[Ribbon.templates] "${templateName}" — no slot spec available for control at index ${i}`,
          el
        );
        return false;
      }
      const controlType = el.getAttribute('data-control-type')
        || inferControlType(el);
      if (!slotAccepts(slot, controlType)) {
        console.error(
          `[Ribbon.templates] "${templateName}" — `
          + `${i < fixedCount ? `slot ${i}` : `flex-slot ${i - fixedCount}`} `
          + `expected ${slotLabel(slot)}, got "${controlType || 'unknown'}"`,
          el
        );
        return false;
      }
    }
    return true;
  }

  /* Countable control filter — an element is a "control" slot if it
     carries data-control-type, one of the recognized primitive
     classes, or is a <details> (our SplitButton pattern). Excludes
     labels, mini-labels, decorative wrappers, and .rb-control-group
     containers (those partition their children). */
  function isCountableControl(el) {
    if (el.hasAttribute('data-decorative')) return false;
    if (el.classList.contains('rb-control-group')) return false;
    if (el.hasAttribute('data-control-type')) return true;
    if (el.classList.contains('rb-btn-lg')
     || el.classList.contains('rb-btn-sm')
     || el.classList.contains('rb-select')
     || el.classList.contains('rb-split')
     || el.classList.contains('rb-button-group')
     || el.classList.contains('rb-ribbon-box')
     || el.tagName === 'DETAILS') return true;
    return false;
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

  /* ==============================================================
     Tranche C registrations (commit 5)
     ============================================================== */

  /* EightButtons — 8 button-family, Large + Middle + Small.
     Middle mode packs into 3-row columns (3+3+2 layout). */
  register('EightButtons', {
    supportedSizes: ['Large', 'Middle', 'Small'],
    slots: Array(8).fill({ family: 'button' })
  });

  /* EightButtons-LastThreeSmall — 8 button-family, Large + Middle +
     Small. Per Microsoft's docs this template REQUIRES two
     <ControlGroup> children with exactly 5 then 3 controls each.
     In Large mode: first 5 render as Middle buttons stacked in 3-row
     columns; last 3 render as Small (icon-only) in a single column. */
  register('EightButtons-LastThreeSmall', {
    supportedSizes: ['Large', 'Middle', 'Small'],
    slots: Array(8).fill({ family: 'button' }),
    controlGroups: [5, 3]
  });

  /* NineButtons — 9 button-family, Large + Middle + Small.
     Middle mode packs into 3-row columns (3+3+3 layout). */
  register('NineButtons', {
    supportedSizes: ['Large', 'Middle', 'Small'],
    slots: Array(9).fill({ family: 'button' })
  });

  /* TenButtons — 10 button-family, Large + Middle + Small.
     Middle mode packs into 3-row columns (3+3+3+1 layout). */
  register('TenButtons', {
    supportedSizes: ['Large', 'Middle', 'Small'],
    slots: Array(10).fill({ family: 'button' })
  });

  /* ElevenButtons — 11 button-family, Large + Middle + Small.
     Middle mode packs into 3-row columns (3+3+3+2 layout). */
  register('ElevenButtons', {
    supportedSizes: ['Large', 'Middle', 'Small'],
    slots: Array(11).fill({ family: 'button' })
  });

  /* ==============================================================
     Tranche D registrations (commit 6) — mixed-family templates
     ============================================================== */

  /* ButtonGroups — variable number of button-family controls
     (Microsoft's schema allows up to 32), optionally partitioned
     into required and optional ControlGroups. For simplicity we
     enforce a 2-32 range of button-family controls; the app can
     use .rb-control-group children to visually group them but the
     validator doesn't require a specific partition. */
  register('ButtonGroups', {
    supportedSizes: ['Large', 'Middle', 'Small'],
    slots: [
      { family: 'button' },
      { family: 'button' }
    ],
    flexibleSlots: { min: 0, max: 30, family: 'button' }
  });

  /* ButtonGroupsAndInputs — 2 input-family controls at the start,
     followed by up to 29 button-family controls. Per Microsoft's
     docs, Large + Middle only. */
  register('ButtonGroupsAndInputs', {
    supportedSizes: ['Large', 'Middle'],
    slots: [
      { family: 'input' },
      { family: 'input' }
    ],
    flexibleSlots: { min: 0, max: 29, family: 'button' }
  });

  /* BigButtonsAndSmallButtonsOrInputs — a "big" button in slot 0
     followed by a mix of small buttons OR inputs (each remaining
     slot accepts either family). Large + Middle only. */
  register('BigButtonsAndSmallButtonsOrInputs', {
    supportedSizes: ['Large', 'Middle'],
    slots: [
      { family: 'button' }
    ],
    flexibleSlots: { min: 0, max: 8, family: ['button', 'input'] },
    largeBigSlot: 0
  });

  /* ==============================================================
     Tranche E registrations (commit 7) — specialized templates
     ============================================================== */

  /* OneFontControl — 1 FontControl composite, Large + Middle.
     Per Microsoft's docs, FontControl "cannot appear inside a
     custom template" — OneFontControl is the ONLY slot for it. */
  register('OneFontControl', {
    supportedSizes: ['Large', 'Middle'],
    slots: [{ family: 'fontcontrol' }]
  });

  /* OneInRibbonGallery — 1 gallery, Large + Small. Middle drops
     to Popup automatically. */
  register('OneInRibbonGallery', {
    supportedSizes: ['Large', 'Small'],
    slots: [{ family: 'gallery' }]
  });

  /* InRibbonGalleryAndBigButton — 1 gallery + 1 button, Large + Small.
     Gallery takes the horizontal space; button sits at Large size
     alongside. */
  register('InRibbonGalleryAndBigButton', {
    supportedSizes: ['Large', 'Small'],
    slots: [
      { family: 'gallery' },
      { family: 'button' }
    ],
    largeBigSlot: 1
  });

  /* InRibbonGalleryAndButtons-GalleryScalesFirst — 1 gallery
     followed by variable button-family controls. Per Microsoft's
     docs: "The gallery collapses to Popup representation in Medium
     and Small group sizes." Our CSS handles this via
     data-group-size scoped rules. */
  register('InRibbonGalleryAndButtons-GalleryScalesFirst', {
    supportedSizes: ['Large', 'Middle', 'Small'],
    slots: [
      { family: 'gallery' }
    ],
    flexibleSlots: { min: 0, max: 6, family: 'button' }
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
