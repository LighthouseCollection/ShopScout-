/* =============================================================
   Translate projection ColumnDef[] into SlickGrid column defs.
   The projection is renderer-agnostic; this file is the SlickGrid
   adaptation layer.

   SlickGrid column def shape:
     {
       id, name, field,
       width?, minWidth?, maxWidth?,
       sortable?, formatter, editor?, cssClass?,
       headerCssClass?, frozen?, focusable?, selectable?,
       resizable?, behavior?
     }

   We deliberately do not patch SlickGrid internals; everything
   below is supported configuration on the column def shape.
   ============================================================= */
(function initColumnDefs(root) {
  const NS = (root.ShopScoutGridColumnDefs = root.ShopScoutGridColumnDefs || {});
  const F = root.ShopScoutGridFormatters || {};

  /* Pick a formatter for a Projection A column based on its field id
     and metadata. Defaults to plain text. */
  function formatterForFieldA(col) {
    switch (col.id) {
      case 'thumb':       return F.thumbnail;
      case 'title':       return F.productTitle;
      case 'brand':       return F.pill;
      case 'source':      return F.pill;
      case 'newPrice':    return F.price;
      case 'usedPrice':   return F.price;
      case 'shippingPrice': return F.price;
      case 'rating':      return F.stars;
      case 'userRating':  return F.userRating;
      case 'availability':return F.statusBadge;
      case 'status':      return F.statusBadge;
      case 'notes':       return F.notes;
      default:
        /* Spec column or anything else → prettified text, with
           multi-pill when split-to-pills sees commas. */
        return col.id && col.id.startsWith('spec:') ? F.multiPill : F.pretty;
    }
  }

  /* Map an editor name onto a SlickGrid Editors constructor when
     present. The renderer attaches editors lazily so this module
     stays vendor-free. */
  function editorRefForField(col) {
    if (!col || col.system) return null;
    /* The renderer knows the SlickGrid namespace and resolves these
       to real Editor classes; we just return a hint string. */
    if (col.id === 'userRating')   return 'rating';
    if (col.id === 'rating')       return null;        /* readonly — comes from extractor */
    if (col.id === 'thumb')        return null;
    if (col.numeric)               return 'integer';
    return 'text';
  }

  /* Translate Projection A columns into SlickGrid column defs. */
  function fromProductsAsRows(projection, options) {
    const opts = options || {};
    const cols = Array.isArray(projection && projection.columns) ? projection.columns : [];
    return cols.filter(c => c.visible !== false).map(col => ({
      id: col.id,
      name: col.label || col.id,
      field: col.field || col.id,
      sortable: col.id !== 'thumb',
      resizable: !col.system,
      focusable: !col.system,
      selectable: !col.system,
      width: col.width || defaultWidthForField(col),
      minWidth: 40,
      maxWidth: 800,
      cssClass: cssForField(col),
      headerCssClass: col.numeric ? 'sg-h-numeric' : null,
      frozen: !!col.pinned,
      formatter: formatterForFieldA(col),
      editorHint: opts.allowEditing ? editorRefForField(col) : null,
      _meta: { kind: 'productField', columnDef: col }
    }));
  }

  /* Translate Projection B columns (attribute row + N product
     columns) into SlickGrid column defs. */
  function fromProductsAsColumns(projection) {
    const cols = Array.isArray(projection && projection.columns) ? projection.columns : [];
    return cols.map(col => {
      if (col.kind === 'attribute') {
        return {
          id: col.id,
          name: col.label,
          field: col.field,
          sortable: false,
          resizable: true,
          focusable: false,
          selectable: false,
          width: col.width || 240,
          minWidth: 160,
          frozen: true,
          cssClass: 'sg-cell-attr',
          headerCssClass: 'sg-h-attr',
          formatter: F.text,
          _meta: { kind: 'attribute', columnDef: col }
        };
      }
      return {
        id: col.id,
        name: col.label || ('Product ' + (col.productIndex + 1)),
        field: col.field,
        sortable: false,
        resizable: true,
        focusable: true,
        selectable: true,
        width: col.width || 220,
        minWidth: 140,
        formatter: F.displayCell,
        _meta: { kind: 'productColumn', product: col.product, columnDef: col }
      };
    });
  }

  function defaultWidthForField(col) {
    if (col.id === 'thumb')      return 64;
    if (col.id === 'title')      return 280;
    if (col.id === 'brand')      return 130;
    if (col.id === 'source')     return 110;
    if (col.id === 'newPrice')   return 90;
    if (col.id === 'rating')     return 110;
    if (col.id === 'userRating') return 110;
    if (col.id === 'notes')      return 220;
    return 140;
  }

  function cssForField(col) {
    const classes = ['sg-cell'];
    if (col.id === 'thumb')     classes.push('sg-cell-thumb');
    if (col.numeric)            classes.push('sg-cell-numeric');
    if (col.id === 'title')     classes.push('sg-cell-title');
    return classes.join(' ');
  }

  /* Build the right adapter for the active projection kind. */
  function build(projection, options) {
    if (!projection) return [];
    return projection.kind === 'columns'
      ? fromProductsAsColumns(projection)
      : fromProductsAsRows(projection, options);
  }

  Object.assign(NS, {
    build,
    fromProductsAsRows,
    fromProductsAsColumns,
    formatterForFieldA,
    editorRefForField
  });
})(globalThis);
