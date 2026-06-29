/* =============================================================
   Revision-safe product edit adapter for the Phase 2 grid.
   All cell edits in the grid go through write(), which:
     1. Reads the latest product from SSProductRepo.
     2. Captures _revision as baseRevision.
     3. Calls repo.updateProduct(id, patch, { baseRevision, ... }).
     4. On revision-conflict, returns the fresh product so the
        renderer can flash + refresh the cell.

   The grid's editor wiring NEVER calls repo.updateProduct directly.
   ============================================================= */
(function initProductEditor(root) {
  const NS = (root.ShopScoutGridEdits = root.ShopScoutGridEdits || {});

  /* Translate a column field id ('newPrice', 'spec:Voltage', etc.)
     and a new value into a product patch. Spec edits update the
     in-memory `rawSpecs[]` entry; primitive field edits just set
     the top-level key. The repo's cleanPatch strips the metadata
     fields it owns (_revision, listId, etc.) so we don't need to. */
  function buildPatch(field, value, currentProduct) {
    const patch = {};
    if (typeof field !== 'string' || !field) return patch;

    if (field.startsWith('spec:')) {
      const key = field.slice(5);
      const list = Array.isArray(currentProduct && currentProduct.rawSpecs)
        ? currentProduct.rawSpecs.slice()
        : [];
      const norm = s => String(s || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const target = norm(key);
      const idx = list.findIndex(s => s && norm(s.key) === target);
      if (value == null || value === '') {
        if (idx >= 0) list.splice(idx, 1);
      } else if (idx >= 0) {
        list[idx] = Object.assign({}, list[idx], { value: String(value) });
      } else {
        list.push({ key, value: String(value) });
      }
      patch.rawSpecs = list;
      return patch;
    }

    /* Primitive field. Trim strings, coerce numbers when the column
       was marked numeric (handled by the editor itself). */
    patch[field] = value == null ? '' : value;
    return patch;
  }

  /* write({ repo, productId, field, value, source? }) →
       { ok: true, product } on success
       { ok: false, reason, product?, conflict? } otherwise
     The renderer interprets the result. */
  async function write(options) {
    const opts = options || {};
    const repo = opts.repo;
    const productId = opts.productId || '';
    const field = opts.field || '';
    const value = opts.value;
    if (!repo
        || typeof repo.getProduct !== 'function'
        || typeof repo.updateProduct !== 'function') {
      return { ok: false, reason: 'repo-unavailable' };
    }
    if (!productId) return { ok: false, reason: 'missing-product-id' };

    const fresh = await repo.getProduct(productId);
    if (!fresh) return { ok: false, reason: 'missing-product' };

    const patch = buildPatch(field, value, fresh);
    if (!patch || !Object.keys(patch).length) {
      /* Nothing to write — surface a clean noop. */
      return { ok: true, product: fresh, noop: true };
    }

    const result = await repo.updateProduct(productId, patch, {
      listId: fresh.listId,
      baseRevision: fresh._revision,
      source: opts.source || 'grid-edit'
    });

    if (result && result.ok === false) {
      return {
        ok: false,
        reason: result.reason || 'update-failed',
        product: result.product || fresh,
        conflict: result.reason === 'revision-conflict'
          ? {
              productId,
              baseRevision: fresh._revision,
              currentRevision: result.product && result.product._revision,
              field, attemptedValue: value
            }
          : null
      };
    }

    return { ok: true, product: result && result.product ? result.product : fresh };
  }

  Object.assign(NS, { write, buildPatch });
})(globalThis);
