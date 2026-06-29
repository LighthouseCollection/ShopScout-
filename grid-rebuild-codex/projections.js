/* =============================================================
   ShopScout — Codex grid projections

   Pure data builders for the Phase 2 grid. These functions do not
   render, persist, or mutate products; they only shape captured
   product data into grid-ready products-as-rows and products-as-
   columns projections.
   ============================================================= */
(function initShopScoutGridCodexProjections(root) {
  const NS = (root.ShopScoutGridCodexProjections = root.ShopScoutGridCodexProjections || {});

  const BASE_COLUMNS = [
    { id: 'select', field: '_selected', name: '', type: 'selection', width: 44, required: true },
    { id: 'thumb', field: 'image', name: '', type: 'image', width: 76, required: true },
    { id: 'title', field: 'title', name: 'Name', type: 'text', minWidth: 260, editable: true, required: true },
    { id: 'brand', field: 'brand', name: 'Brand', type: 'text', minWidth: 120, editable: true },
    { id: 'newPrice', field: 'newPrice', name: 'Price', type: 'price', width: 104, editable: true },
    { id: 'source', field: 'source', name: 'Source', type: 'source', width: 118 },
    { id: 'modelName', field: 'modelName', name: 'Model', type: 'text', minWidth: 160, editable: true },
    { id: 'rating', field: 'rating', name: 'Rating', type: 'rating', width: 128, editable: true },
    { id: 'notes', field: 'notes', name: 'Notes', type: 'text', minWidth: 160, editable: true },
    { id: 'actions', field: '_actions', name: '', type: 'actions', width: 92, required: true }
  ];

  const FIELD_LABELS = {
    title: 'Name',
    brand: 'Brand',
    newPrice: 'Price',
    usedPrice: 'Used Price',
    shippingPrice: 'Shipping',
    source: 'Source',
    modelName: 'Model',
    modelNumber: 'Model Number',
    rating: 'Rating',
    reviewCount: 'Reviews',
    notes: 'Notes',
    sellerName: 'Seller',
    category: 'Category',
    availability: 'Availability'
  };

  function canonicalKey(value, scope) {
    const canon = scope?.SSCanonical || root.SSCanonical;
    if (canon && typeof canon.canonicalKey === 'function') return canon.canonicalKey(value);
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function canonicalField(field, scope) {
    const text = String(field || '').trim();
    if (!text) return '';
    if (text.startsWith('spec:')) return `spec:${canonicalKey(text.slice(5), scope)}`;
    if (FIELD_LABELS[text]) return text;
    return `spec:${canonicalKey(text, scope)}`;
  }

  function titleCase(value) {
    return String(value || '')
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function fieldLabel(field) {
    if (FIELD_LABELS[field]) return FIELD_LABELS[field];
    if (field.startsWith('spec:')) return titleCase(field.slice(5));
    return titleCase(field);
  }

  function productIdOf(product, idx) {
    return String(product?.id || product?.url || `row-${idx + 1}`);
  }

  function flattenProducts(products, options) {
    const projector = root.ShopScoutProjections;
    if (projector && typeof projector.flattenSpecs === 'function') {
      return projector.flattenSpecs(products, { root: options?.root || root });
    }
    return (Array.isArray(products) ? products : []).map(product => Object.assign({}, product));
  }

  function discoverSpecFields(rows) {
    const keys = new Set();
    for (const row of rows) {
      for (const key of Object.keys(row || {})) {
        if (key.startsWith('spec:')) keys.add(key);
      }
    }
    return [...keys].sort((a, b) => fieldLabel(a).localeCompare(fieldLabel(b)));
  }

  function normalizeVisibleSpecFields(visibleSpecKeys, rows, scope) {
    if (Array.isArray(visibleSpecKeys) && visibleSpecKeys.length) {
      return [...new Set(visibleSpecKeys.map(key => canonicalField(key, scope)).filter(Boolean))]
        .filter(key => key.startsWith('spec:'));
    }
    return discoverSpecFields(rows);
  }

  function makeRow(product, flattened, idx) {
    const id = productIdOf(product, idx);
    const row = Object.assign({}, flattened);
    row.id = id;
    row.title = product?.title || product?.productName || product?.listingTitle || '';
    row.image = product?.image || product?.thumb || product?.thumbnail || '';
    row._shopScout = {
      productId: id,
      url: product?.url || '',
      index: idx,
      revision: Number.isFinite(Number(product?._revision)) ? Number(product._revision) : 0,
      product
    };
    return row;
  }

  function buildProductsRowsProjection(products, options) {
    const opts = options || {};
    const scope = opts.root || root;
    const input = Array.isArray(products) ? products : [];
    const flattened = flattenProducts(input, opts);
    const rows = input.map((product, idx) => makeRow(product, flattened[idx] || product, idx));
    const specFields = normalizeVisibleSpecFields(opts.visibleSpecKeys, rows, scope);
    const specColumns = specFields.map(field => ({
      id: field,
      field,
      name: fieldLabel(field),
      type: 'spec',
      minWidth: 132,
      editable: true,
      specKey: field.slice(5)
    }));
    return {
      mode: 'productsRows',
      columns: BASE_COLUMNS.concat(specColumns),
      rows,
      specFields
    };
  }

  function buildComparisonMatrixProjection(products, options) {
    const opts = options || {};
    const scope = opts.root || root;
    const rowProjection = buildProductsRowsProjection(products, {
      root: scope,
      visibleSpecKeys: opts.visibleSpecKeys
    });
    const fields = Array.isArray(opts.fields) && opts.fields.length
      ? opts.fields.map(field => canonicalField(field, scope)).filter(Boolean)
      : ['newPrice', 'rating'].concat(rowProjection.specFields);
    const uniqueFields = [...new Set(fields)];
    const productColumns = rowProjection.rows.map((row, idx) => ({
      id: `product:${row.id}`,
      field: `product:${row.id}`,
      name: row.title || `Product ${idx + 1}`,
      type: 'product',
      productId: row.id,
      minWidth: 180
    }));
    const rows = uniqueFields.map(field => {
      const matrixRow = {
        id: field,
        attribute: fieldLabel(field),
        type: field.startsWith('spec:') ? 'spec' : 'field'
      };
      for (const productRow of rowProjection.rows) {
        matrixRow[`product:${productRow.id}`] = {
          value: productRow[field] == null ? '' : productRow[field],
          productId: productRow.id,
          revision: productRow._shopScout.revision,
          field
        };
      }
      return matrixRow;
    });
    return {
      mode: 'comparisonMatrix',
      columns: [{ id: 'attribute', field: 'attribute', name: 'Buying Factor', type: 'attribute', minWidth: 190 }]
        .concat(productColumns),
      rows,
      products: rowProjection.rows
    };
  }

  Object.assign(NS, {
    buildProductsRowsProjection,
    buildComparisonMatrixProjection
  });
})(globalThis);
