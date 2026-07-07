/* =============================================================
   ShopScout — default deterministic normalization libraries

   These are local, editable rule libraries. They are deliberately kept
   separate from the engine so ShopScout can grow field aliases and enum
   vocabularies without changing normalization code.
   ============================================================= */
(function initShopScoutNormalizationRules(root) {
  const NS = (root.ShopScoutNormalizationRules = root.ShopScoutNormalizationRules || {});

  const fieldAliases = {
    color: ['colour', 'color name', 'finish color', 'finish colour', 'shade'],
    size: ['size name', 'apparel size', 'fit size', 'item size'],
    material: ['material type', 'materials', 'fabric type', 'fabric'],
    'connector type': ['usb type', 'connection type', 'connector', 'plug type', 'port type'],
    'power source': ['power supply', 'power-source', 'power_source'],
    voltage: ['voltage rating', 'voltage_rating', 'input voltage', 'output voltage', 'rated voltage']
  };

  const canonicalFields = {
    color: 'Color',
    size: 'Size',
    material: 'Material',
    'connector type': 'Connector Type',
    'power source': 'Power Source',
    voltage: 'Voltage'
  };

  const enums = {
    Color: {
      'Navy Blue': ['navy', 'navy blue', 'midnight blue', 'dark navy', 'dark blue'],
      Black: ['black', 'jet black', 'matte black'],
      White: ['white', 'off white', 'off-white', 'ivory'],
      Gray: ['gray', 'grey', 'graphite', 'charcoal', 'space gray', 'space grey'],
      Silver: ['silver', 'metallic silver'],
      Red: ['red', 'crimson', 'burgundy'],
      Green: ['green', 'forest green', 'olive'],
      Blue: ['blue', 'royal blue'],
      Brown: ['brown', 'tan', 'beige']
    },
    Size: {
      XS: ['xs', 'extra small', 'x-small'],
      S: ['s', 'small'],
      M: ['m', 'medium', 'med'],
      L: ['l', 'large'],
      XL: ['xl', 'extra large', 'x-large'],
      XXL: ['xxl', '2xl', '2x large', 'double extra large']
    },
    Material: {
      'Stainless Steel 304': ['ss304', '304 stainless', 'stainless 304', 'stainless steel 304', 'sus304'],
      'Stainless Steel': ['stainless steel', 'inox'],
      Aluminum: ['aluminum', 'aluminium'],
      Plastic: ['plastic', 'abs plastic', 'polycarbonate'],
      Cotton: ['cotton', '100% cotton'],
      Polyester: ['polyester', 'poly']
    },
    'Connector Type': {
      'USB-C': ['usb-c', 'usb c', 'usb type-c', 'usb type c', 'type-c', 'type c'],
      'USB-A': ['usb-a', 'usb a', 'usb type-a', 'usb type a', 'type-a'],
      Lightning: ['lightning', 'apple lightning'],
      MicroUSB: ['micro usb', 'micro-usb', 'microusb'],
      HDMI: ['hdmi'],
      DisplayPort: ['displayport', 'display port', 'dp']
    },
    'Power Source': {
      'Corded Electric': ['corded electric', 'corded', 'wired', 'ac powered', 'plug in', 'plug-in'],
      'Battery Powered': ['battery powered', 'battery', 'rechargeable battery', 'cordless'],
      Solar: ['solar', 'solar powered'],
      USB: ['usb powered', 'usb']
    }
  };

  Object.assign(NS, {
    version: 1,
    fieldAliases,
    canonicalFields,
    enums,
    exactAliasFields: ['Size', 'Material', 'Connector Type']
  });
})(globalThis);
