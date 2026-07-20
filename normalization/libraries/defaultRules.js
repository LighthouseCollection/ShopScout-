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

  const brandAliases = {
    HP: ['hp', 'hewlett packard', 'hewlett-packard', 'hewlett packard enterprise'],
    MSI: ['msi', 'micro-star international', 'micro star international'],
    Lenovo: ['lenovo', 'lenovo group'],
    Logitech: ['logitech', 'logi'],
    Microsoft: ['microsoft', 'msft'],
    Apple: ['apple', 'apple computer'],
    Samsung: ['samsung', 'samsung electronics'],
    Sony: ['sony', 'sony corporation'],
    Dell: ['dell', 'dell technologies'],
    Acer: ['acer'],
    ASUS: ['asus', 'asustek', 'asustek computer'],
    Canon: ['canon'],
    Nikon: ['nikon'],
    Brother: ['brother', 'brother industries'],
    QNAP: ['qnap'],
    Synology: ['synology'],
    Dremel: ['dremel'],
    Anker: ['anker', 'anker innovations'],
    Belkin: ['belkin'],
    UGREEN: ['ugreen']
  };

  const retailerAliases = {
    Amazon: ['amazon', 'amzn', 'amzn marketplace', 'amazon marketplace'],
    Walmart: ['walmart', 'wal-mart', 'walmart marketplace'],
    Target: ['target'],
    'Best Buy': ['best buy', 'bestbuy'],
    Newegg: ['newegg', 'new egg'],
    eBay: ['ebay', 'e-bay'],
    Alibaba: ['alibaba', 'alibaba.com'],
    AliExpress: ['aliexpress', 'ali express'],
    Etsy: ['etsy'],
    Costco: ['costco'],
    'The Home Depot': ['home depot', 'the home depot', 'homedepot'],
    "Lowe's": ['lowes', "lowe's", 'lowe s'],
    Wayfair: ['wayfair'],
    SHEIN: ['shein'],
    Temu: ['temu'],
    Nordstrom: ['nordstrom'],
    'B&H Photo': ['b&h', 'b and h', 'bh photo', 'b&h photo'],
    Adorama: ['adorama']
  };

  const retailerHostAliases = {
    'amazon.': 'Amazon',
    'walmart.': 'Walmart',
    'target.': 'Target',
    'bestbuy.': 'Best Buy',
    'newegg.': 'Newegg',
    'ebay.': 'eBay',
    'alibaba.': 'Alibaba',
    'aliexpress.': 'AliExpress',
    'etsy.': 'Etsy',
    'costco.': 'Costco',
    'homedepot.': 'The Home Depot',
    'lowes.': "Lowe's",
    'wayfair.': 'Wayfair',
    'shein.': 'SHEIN',
    'temu.': 'Temu',
    'nordstrom.': 'Nordstrom',
    'bhphotovideo.': 'B&H Photo',
    'adorama.': 'Adorama'
  };

  Object.assign(NS, {
    version: 1,
    fieldAliases,
    canonicalFields,
    enums,
    brandAliases,
    retailerAliases,
    retailerHostAliases,
    exactAliasFields: ['Size', 'Material', 'Connector Type']
  });
})(globalThis);
