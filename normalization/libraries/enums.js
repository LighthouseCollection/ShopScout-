/* =============================================================
   ShopScout — enum vocabulary tables (normalization v2)

   One table per enum-typed field. Each maps a canonical display
   label to an array of aliases (all lowercase). The enum
   normalizer looks up incoming tokens (already lowercased,
   variant-prefix-stripped, unpunctuated) in these tables.

   Seeded from libraries/defaultRules.js and extended for the fields
   Color / Material / Pattern the raw feeds commonly produce.

   Adding an alias: append one string to the array. Adding a new
   canonical value: add one entry. Zero other code changes.
   ============================================================= */
(function initShopScoutEnums(root) {
  const NS = (root.ShopScoutEnums = root.ShopScoutEnums || {});

  const ENUMS = {
    Color: {
      Black:   ['black', 'jet black', 'matte black', 'onyx', 'noir'],
      White:   ['white', 'off white', 'off-white', 'ivory', 'cream', 'pearl'],
      Gray:    ['gray', 'grey', 'graphite', 'charcoal', 'space gray', 'space grey', 'slate'],
      Silver:  ['silver', 'metallic silver', 'chrome'],
      Gold:    ['gold', 'rose gold', 'champagne'],
      Red:     ['red', 'crimson', 'burgundy', 'maroon', 'scarlet', 'wine'],
      Orange:  ['orange', 'coral', 'tangerine', 'amber'],
      Yellow:  ['yellow', 'mustard', 'gold yellow', 'canary'],
      Green:   ['green', 'forest green', 'olive', 'sage', 'mint', 'lime', 'emerald'],
      Blue:    ['blue', 'royal blue', 'sky blue', 'light blue', 'cyan', 'teal', 'aqua', 'turquoise'],
      'Navy Blue': ['navy', 'navy blue', 'midnight blue', 'dark navy', 'dark blue'],
      Purple:  ['purple', 'violet', 'lavender', 'lilac', 'plum', 'magenta'],
      Pink:    ['pink', 'hot pink', 'rose', 'blush', 'salmon'],
      Brown:   ['brown', 'tan', 'beige', 'khaki', 'coffee', 'chocolate', 'sand'],
      Multicolor: ['multicolor', 'multi color', 'multi-color', 'multicolour', 'rainbow', 'assorted'],
      Clear:   ['clear', 'transparent'],
    },
    Size: {
      XS:  ['xs', 'extra small', 'x-small', 'xsmall'],
      S:   ['s', 'small', 'sm'],
      M:   ['m', 'medium', 'med', 'md'],
      L:   ['l', 'large', 'lg'],
      XL:  ['xl', 'extra large', 'x-large', 'xlarge'],
      XXL: ['xxl', '2xl', '2x large', 'double extra large'],
      XXXL:['xxxl', '3xl', '3x large'],
    },
    Material: {
      'Stainless Steel 304': ['ss304', '304 stainless', 'stainless 304', 'stainless steel 304', 'sus304'],
      'Stainless Steel':     ['stainless steel', 'inox', 'ss'],
      Aluminum:      ['aluminum', 'aluminium', 'alu'],
      Steel:         ['steel', 'carbon steel'],
      Iron:          ['iron', 'cast iron'],
      Copper:        ['copper'],
      Brass:         ['brass'],
      Titanium:      ['titanium'],
      Plastic:       ['plastic', 'abs plastic', 'abs', 'polycarbonate', 'pc'],
      Silicone:      ['silicone', 'silicon rubber'],
      Rubber:        ['rubber', 'neoprene'],
      Glass:         ['glass', 'tempered glass'],
      Ceramic:       ['ceramic', 'porcelain'],
      Wood:          ['wood', 'bamboo', 'oak', 'walnut', 'pine', 'birch'],
      Leather:       ['leather', 'genuine leather'],
      'Faux Leather':['faux leather', 'pu leather', 'synthetic leather', 'pleather'],
      Cotton:        ['cotton', '100% cotton', 'organic cotton'],
      Polyester:     ['polyester', 'poly'],
      Nylon:         ['nylon'],
      Wool:          ['wool', 'merino wool', 'merino'],
      Silk:          ['silk'],
      Linen:         ['linen'],
      Fiberglass:    ['fiberglass', 'fibreglass', 'glass fiber'],
      Carbon:        ['carbon', 'carbon fiber', 'carbon fibre'],
    },
    Pattern: {
      Solid:     ['solid', 'plain', 'solid color'],
      Striped:   ['striped', 'stripes', 'stripe'],
      Plaid:     ['plaid', 'checkered', 'checked', 'check'],
      Floral:    ['floral', 'flower', 'flowers'],
      Geometric: ['geometric', 'geo', 'chevron', 'triangle'],
      Polka:     ['polka dot', 'polka dots', 'dotted', 'dots'],
      Camo:      ['camo', 'camouflage'],
      Animal:    ['animal print', 'leopard', 'zebra', 'cheetah'],
      Abstract:  ['abstract'],
    },
    'Power Source': {
      'Corded Electric':  ['corded electric', 'corded', 'wired', 'ac powered', 'ac', 'plug in', 'plug-in'],
      'Battery Powered':  ['battery powered', 'battery', 'rechargeable battery', 'cordless', 'wireless'],
      Solar:              ['solar', 'solar powered'],
      USB:                ['usb powered', 'usb'],
      Manual:             ['manual', 'hand powered', 'hand crank'],
      Gas:                ['gas', 'gas powered', 'gasoline', 'propane'],
    },
    'Connector Type': {
      'USB-C':      ['usb-c', 'usb c', 'usb type-c', 'usb type c', 'type-c', 'type c'],
      'USB-A':      ['usb-a', 'usb a', 'usb type-a', 'usb type a', 'type-a', 'type a', 'usb'],
      'USB Micro':  ['micro usb', 'micro-usb', 'microusb', 'usb micro'],
      'USB Mini':   ['mini usb', 'mini-usb', 'miniusb'],
      Lightning:    ['lightning', 'apple lightning'],
      HDMI:         ['hdmi'],
      'Mini HDMI':  ['mini hdmi', 'mini-hdmi'],
      'Micro HDMI': ['micro hdmi', 'micro-hdmi'],
      DisplayPort:  ['displayport', 'display port', 'dp'],
      VGA:          ['vga'],
      DVI:          ['dvi'],
      'RJ-45':      ['rj-45', 'rj45', 'ethernet'],
      'RCA':        ['rca'],
      '3.5mm':      ['3.5mm', '3.5 mm', 'headphone jack', 'aux'],
    },
  };

  /* Build a fast reverse lookup: lowercased alias -> {enumKey, canonical}.
     Populated on demand and cached. */
  const REVERSE_CACHE = {};
  function reverseTableFor(enumKey) {
    if (REVERSE_CACHE[enumKey]) return REVERSE_CACHE[enumKey];
    const table = ENUMS[enumKey];
    if (!table) return null;
    const rev = Object.create(null);
    for (const canonical of Object.keys(table)) {
      rev[canonical.toLowerCase()] = canonical;
      for (const alias of table[canonical]) {
        rev[alias.toLowerCase()] = canonical;
      }
    }
    REVERSE_CACHE[enumKey] = rev;
    return rev;
  }

  function lookup(enumKey, token) {
    if (!token) return null;
    const rev = reverseTableFor(enumKey);
    if (!rev) return null;
    return rev[String(token).toLowerCase().trim()] || null;
  }

  function keys() {
    return Object.keys(ENUMS);
  }

  Object.assign(NS, {
    version: 2,
    ENUMS,
    lookup,
    reverseTableFor,
    keys,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
