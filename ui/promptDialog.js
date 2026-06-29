/* =============================================================
   ShopScoutUI.prompt — themed prompt() replacement
   Returns a Promise<string|null>. The string is the value the
   user typed (possibly empty); null means cancellation (Escape,
   overlay click, Cancel button).
   Drop-in replacement:
     const name = await ShopScoutUI.prompt('New list name?', { defaultValue: '' });
     if (name == null) return;  // cancelled
   ============================================================= */
(function initShopScoutUIPrompt(root) {
  const NS = (root.ShopScoutUI = root.ShopScoutUI || {});

  /**
   * @param {string} message Plain text prompt.
   * @param {{title?:string, defaultValue?:string, placeholder?:string, okLabel?:string, cancelLabel?:string, inputType?:string, validate?:(value:string)=>string|null}} [opts]
   *   validate receives the typed value; return a non-empty string to
   *   block the OK action and show it as an inline error.
   * @returns {Promise<string|null>}
   */
  function prompt(message, opts) {
    const o = opts || {};
    /* Lazy-resolve siblings so file load order doesn't matter. */
    const dom = NS.dom;
    if (!dom || !NS.modal) {
      throw new Error('ShopScoutUI.prompt requires ShopScoutUI.dom and .modal to be loaded.');
    }
    return new Promise(resolve => {
      const messageEl = dom.elem('div', {
        class: 'ssui-prompt-message',
        text: String(message == null ? '' : message)
      });
      const input = dom.elem('input', {
        class: 'ssui-prompt-input',
        attrs: {
          type: o.inputType || 'text',
          placeholder: o.placeholder || '',
          'aria-label': String(message || '')
        }
      });
      input.value = o.defaultValue != null ? String(o.defaultValue) : '';

      const errorEl = dom.elem('div', { class: 'ssui-prompt-error', attrs: { 'aria-live': 'polite' } });

      const body = dom.elem('div', {
        class: 'ssui-prompt-body',
        children: [messageEl, input, errorEl]
      });

      let handle;

      function trySubmit() {
        const value = input.value;
        if (typeof o.validate === 'function') {
          const err = o.validate(value);
          if (typeof err === 'string' && err) {
            errorEl.textContent = err;
            return false;
          }
        }
        errorEl.textContent = '';
        if (handle) handle.close(value);
        return true;
      }

      /* Enter submits when focus is inside the input. */
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          trySubmit();
        }
      });

      handle = NS.modal.open({
        title: o.title || '',
        body,
        actions: [
          { label: o.cancelLabel || 'Cancel', value: null },
          { label: o.okLabel || 'OK', isDefault: true, kind: 'primary',
            onClick: () => {
              const ok = trySubmit();
              /* Returning false from onClick keeps the modal open
                 (so validate-blocked submissions stay visible). */
              return ok ? undefined : false;
            }
          }
        ],
        onClose: (value) => resolve(value == null ? null : String(value))
      });

      /* Focus input on next frame so the modal's autofocus on default
         button doesn't steal it. */
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    });
  }

  NS.prompt = prompt;
})(globalThis);
