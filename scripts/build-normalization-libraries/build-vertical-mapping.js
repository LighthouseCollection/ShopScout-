#!/usr/bin/env node
/* =============================================================
   Generator: icecat_category_to_vertical.json + verticals-index.json

   Maps every Icecat category (~6,800) to its most likely Shopify
   top-level vertical (21 shipping verticals). Uses keyword-based
   rules against the Icecat category displayName + matchTerms.

   Shopify taxonomy has 26 verticals but 5 are meta (Bundles,
   Gift Cards, Product Add-Ons, Services, Uncategorized) and are
   not shipped as ShopScout packs. This script only emits mappings
   for the 21 real product verticals.

   Output:
     normalization/libraries/generated/icecat_category_to_vertical.json
       { categoryId (string) -> verticalId (string) }
     normalization/libraries/generated/verticals-index.json
       { verticals: [{ id, displayName, packUrl, packBytes, packSha256 }] }
       (packUrl/packBytes/packSha256 populated later by the pack
       splitter — this generator emits placeholders.)
   ============================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  outputPath,
  fileBytes,
  sha256OfFileSync,
  serializeJson,
  writeGeneratedFile,
  nowIso
} = require('./lib');

const GENERATOR_NAME =
  'scripts/build-normalization-libraries/build-vertical-mapping.js';
const GENERATOR_VERSION = 1;

const MAPPING_OUT = 'icecat_category_to_vertical.json';
const INDEX_OUT = 'verticals-index.json';

/* Ordered by specificity — earlier verticals win when a category matches
   multiple. Broadest verticals (Home & Garden) are last so they only
   catch what more specific ones miss. */
const VERTICAL_RULES = [
  // Cameras & Optics — specific optical devices, must match before Electronics
  { id: 'cameras-optics', displayName: 'Cameras & Optics', patterns: [
    /\bcamera\b/i, /\bcamcorder\b/i, /\blens\b/i, /\btripod\b/i,
    /\bbinocular/i, /\btelescope\b/i, /\bmicroscope\b/i, /\bnight vision\b/i,
    /\boptical\b/i, /\bmagnifier/i, /\bviewfinder/i, /\bphoto\b/i,
    /\bfilter (?:cpl|nd|uv)/i
  ] },
  // Software — pure software before Electronics catches "system"
  { id: 'software', displayName: 'Software', patterns: [
    /\bsoftware\b/i, /\boperating system/i, /\banti(?:virus|malware|spam)/i,
    /\blicens/i, /\bfirmware\b/i
  ] },
  // Media — physical media, books, prerecorded content
  { id: 'media', displayName: 'Media', patterns: [
    /\bbook\b/i, /\be-?book\b/i, /\bmagazine/i, /\baudiobook/i,
    /\bcd (?:album|music|audio)/i, /\bdvd movie/i, /\bmusic (?:cd|album|vinyl)/i,
    /\bvinyl\b/i, /\brecords?\b(?! management| player| store| system)/i
  ] },
  // Vehicles & Parts
  { id: 'vehicles-parts', displayName: 'Vehicles & Parts', patterns: [
    /\bvehicle/i, /\bmotorcycle/i, /\bautomobile/i, /\bcar (?:battery|charger|kit)/i,
    /\btire\b/i, /\btyre\b/i, /\bwheel (?:rim|hub|nut|bolt|axle)/i,
    /\bbrake\b/i, /\bexhaust/i, /\bmuffler/i, /\bspark plug/i, /\bradiator\b/i,
    /\balternator/i, /\bstarter motor/i, /\bignition (?:coil|switch)/i,
    /\bwiper (?:blade|arm)/i, /\bcar seat/i, /\btrailer\b/i, /\bboat\b/i,
    /\brv\b/i, /\bscooter\b/i, /\bwheelchair/i,
    // helmet: only vehicular helmets — welding/construction/hard hat/hockey/football/etc.
    // helmets belong elsewhere. Match specific context words instead of blanket \bhelmet\b.
    /\b(?:motorcycle|motorbike|bike|bicycle|cycling|racing|scooter|snowmobile|atv) helmets?/i
  ] },
  // Sporting Goods
  { id: 'sporting-goods', displayName: 'Sporting Goods', patterns: [
    /\bsport/i, /\bfitness\b/i, /\bexercise\b/i, /\btreadmill/i,
    /\bbicycle\b/i, /\bbike\b/i, /\brunning\b/i, /\bathletic/i,
    /\bcamping\b/i, /\btent\b/i, /\bsleeping bag/i, /\bfishing\b/i,
    /\bhunting\b/i, /\bgolf\b/i, /\btennis\b/i, /\byoga\b/i,
    /\bhiking\b/i, /\bskate/i, /\bski/i, /\bsnowboard/i,
    /\bball\b(?! bearing| valve)/i, /\bracquet/i, /\bdumbbell/i,
    /\bweightlifting/i, /\bboxing\b/i, /\bmartial arts/i
  ] },
  // Toys & Games
  { id: 'toys-games', displayName: 'Toys & Games', patterns: [
    /\btoy\b/i, /\bdoll\b/i, /\bboard game/i, /\bpuzzle\b/i,
    /\bplayset/i, /\baction figure/i, /\bstuff(?:ed|ing)/i,
    /\brubik/i, /\bslot car/i, /\bmodel (?:kit|train|car)\b/i,
    /\bplaying cards/i, /\bchess (?:board|set)/i, /\btrain set/i
  ] },
  // Baby & Toddler
  { id: 'baby-toddler', displayName: 'Baby & Toddler', patterns: [
    /\bbaby\b/i, /\binfant\b/i, /\btoddler\b/i, /\bnewborn\b/i,
    /\bdiaper/i, /\bnappy/i, /\bstroller/i, /\bpushchair/i,
    /\bcrib\b/i, /\bcot\b(?!ton)/i, /\bhigh ?chair/i, /\bbottle warmer/i,
    /\bbaby monitor/i, /\bbaby carrier/i, /\bcar seat (?:baby|infant|child)/i,
    /\bpacifier/i
  ] },
  // Apparel & Accessories — clothing, shoes, jewelry, watches
  { id: 'apparel-accessories', displayName: 'Apparel & Accessories', patterns: [
    /\bclothing\b/i, /\bshirt\b/i, /\bt-?shirt/i, /\bdress\b/i,
    /\bpant/i, /\btrouser/i, /\bjean\b/i, /\bskirt\b/i,
    /\bjacket\b/i, /\bcoat\b/i, /\bsweater/i, /\bhoodie/i,
    /\bshoe\b/i, /\bboots?\b/i, /\bsneaker/i, /\bsandal/i,
    /\bhat\b/i, /\bcap\b(?!(?:acit)| lock)/i, /\bglove\b/i, /\bsock\b/i, /\bbelt\b(?! sander| grinder| conveyor)/i,
    /\bnecklace/i, /\bbracelet/i, /\bring\b(?!er|tone|-?tone)/i, /\bearring/i,
    /\bwatch\b(?! dog| tower)/i, /\bsunglasses/i, /\bumbrella\b/i,
    /\bscarf\b/i, /\bswimwear/i, /\bswimsuit/i, /\blingerie/i,
    /\bunderwear/i, /\bpaja(?:ma|jama)/i
  ] },
  // Luggage & Bags
  { id: 'luggage-bags', displayName: 'Luggage & Bags', patterns: [
    /\bluggage\b/i, /\bsuitcase/i, /\bbriefcase/i, /\bbackpack/i,
    /\btote bag/i, /\bhandbag/i, /\bwallet\b/i, /\bpurse\b/i,
    /\bmessenger bag/i, /\btravel bag/i, /\bduffel/i
  ] },
  // Furniture
  { id: 'furniture', displayName: 'Furniture', patterns: [
    /\bfurniture\b/i, /\bchair\b/i, /\bsofa\b/i, /\bcouch\b/i,
    /\btable\b(?!t| top |top display)/i, /\bdesk\b(?! (?:accessor|calendar|clock|lamp|pad))/i,
    /\bbed\b(?! sheet|ding)/i, /\bmattress/i, /\bwardrobe/i, /\bdresser\b/i,
    /\bcabinet\b(?! (?:power|fuse|breaker|control))/i, /\bshelv/i, /\bbookshelf/i, /\bbookcase/i,
    /\bstool\b/i, /\bottoman\b/i, /\brecliner/i, /\bbench\b(?! (?:grinder|vise|top))/i,
    /\barmoire/i, /\bnight ?stand/i, /\bfuton/i
  ] },
  // Cars are covered by Vehicles & Parts.
  // Business & Industrial — professional/lab/medical equipment
  { id: 'business-industrial', displayName: 'Business & Industrial', patterns: [
    /\blaborator/i, /\bindustrial\b/i, /\bmedical (?:device|equipment|imaging|imaging system)/i,
    /\bdental (?:chair|drill|equipment)/i, /\bx-?ray\b/i, /\bultrasound\b/i,
    /\bmri\b/i, /\bctscan/i, /\bcentrifuge/i, /\bautoclave/i,
    /\banalyzer/i, /\bspectromet/i, /\bchromatograph/i, /\btelescope\b(?! toy)/i,
    /\bpos (?:system|terminal|register)/i, /\bcash register/i, /\bbar ?code (?:scanner|reader|printer|label)/i,
    /\bconveyor/i, /\bforklift/i, /\bpallet jack/i, /\bwarehouse\b/i,
    /\bshipping (?:label|scale)/i, /\bcommercial\b/i, /\bmanufacturing\b/i,
    /\bhospital (?:bed|equipment)/i, /\bstethoscope/i, /\bdefibrillator/i,
    /\btelephone switching/i, /\bswitchboard equipment/i, /\bpbx\b/i
  ] },
  // Hardware — tools, fasteners, DIY, air/pneumatic tools, welding
  { id: 'hardware', displayName: 'Hardware', patterns: [
    /\bhammer\b/i, /\bdrill\b(?! bit(?! set))/i, /\bsaw\b(?! blade)/i,
    /\bwrench\b/i, /\bscrewdriver\b/i, /\bpliers/i, /\bplyer/i,
    /\bhand tool/i, /\bpower tool/i, /\bcordless drill/i,
    /\bnail gun/i, /\bsander\b/i, /\brouter (?:tool| bit)/i,
    /\bimpact driver/i, /\bwork(?:bench|shop)/i, /\btoolbox/i,
    /\bfastener/i, /\bscrew\b(?! driver)/i, /\bbolt\b/i, /\bnut\b(?! (?:milk|butter|ella|meg))/i,
    /\bhinge\b/i, /\block (?:cylinder|body|set)/i, /\bpad ?lock/i,
    /\bmeasuring tape/i, /\blevel (?:tool| gauge)/i, /\bstud finder/i,
    // Issue #3: air compressor + related pneumatic tools + Amazon
    // "Tools & Home Improvement" wrapper category. The Icecat category
    // set includes "Air Compressors", "Pneumatic Tools", "Nail Guns",
    // etc. which previously fell through unclassified even though they
    // are clearly Hardware. Also welding, chainsaws, drill bits.
    /\bair compressor/i, /\bair inflator/i, /\btire inflator/i,
    /\bpneumatic\b/i, /\bair (?:nailer|stapler|ratchet|impact)/i,
    /\bcompressor\b(?! (?:refrigerator|freezer|ac unit|hvac|air conditioner))/i,
    /\btools? (?:&|and) home improvement/i, /\btool set\b/i, /\btool kit\b/i,
    /\bdrill press\b/i, /\bdrill bit/i, /\bchainsaw/i, /\bchain saw/i,
    // Grinders — hardware only for specific types; coffee/spice/seasoning
    // grinders fall through to Home & Garden.
    /\bangle grinder/i, /\bbench grinder/i, /\bdie grinder/i, /\bstraight grinder/i,
    /\bmiter (?:saw|box)/i, /\bband saw/i, /\bcircular saw/i, /\bjigsaw/i,
    /\breciprocating saw/i, /\btable saw/i, /\bscroll saw/i,
    /\bwelder\b/i, /\bwelding\b/i, /\bsoldering (?:iron|station)/i,
    /\bplaner\b/i, /\blathe\b/i, /\bjointer\b/i, /\bair hose\b/i,
    /\bhex key/i, /\ballen (?:wrench|key)/i, /\bratchet\b/i, /\btorque wrench/i,
    /\butility knife/i, /\bcaulk (?:gun|ing)/i, /\bhardware (?:kit| set)/i,
    /\bsafety (?:glasses|goggles|gloves)/i, /\bwork (?:gloves|boots)/i,
    /\bventilation fan/i, /\bshop vac/i, /\bwet[- ]?dry vacuum/i
  ] },
  // Cameras & Optics is above.
  // Health & Beauty
  { id: 'health-beauty', displayName: 'Health & Beauty', patterns: [
    /\bcosmetic/i, /\bmake-?up\b/i, /\bskincare\b/i, /\bshampoo\b/i,
    /\bconditioner\b(?! mode| air)/i, /\btoothbrush\b/i, /\btoothpaste/i,
    /\bdental floss/i, /\bmouthwash/i, /\bthermometer (?:body|oral|ear|forehead|digital human)/i,
    /\bblood pressure/i, /\bglucose meter/i, /\binhaler/i, /\bnebulizer/i,
    /\bheating pad/i, /\bmassager?/i, /\bhair (?:dryer|straightener|curler|clipper)/i,
    /\belectric shaver/i, /\bepilator/i, /\bnail (?:file|polish|clipper|dryer)/i,
    /\bperfume/i, /\bcologne/i, /\bdeodorant/i, /\bhand cream/i
  ] },
  // Office Supplies
  { id: 'office-supplies', displayName: 'Office Supplies', patterns: [
    /\boffice\b(?! (?:chair|desk|furniture))/i, /\bpen\b(?!(?:cil case|drive|holder|test))/i,
    /\bpencil\b/i, /\bmarker\b(?! light)/i, /\bhighlighter/i,
    /\bstapler\b/i, /\bpaper clip/i, /\bfolder\b(?!(?:ing bike|ing chair))/i, /\bbinder\b/i,
    /\bcalculator\b/i, /\benvelope/i, /\bnotebook (?:paper|refill|spiral|composition)/i,
    /\bindex card/i, /\bpost-?it/i, /\bsticky note/i,
    /\btrash can\b/i, /\bwaste ?basket/i, /\bshredder/i, /\bwhiteboard/i,
    /\bpaper (?:towel|shredder|roll|puncher|towl|clip|towels)/i,
    /\brubber band/i, /\btape dispenser/i, /\bcalendar\b/i, /\bplanner\b/i
  ] },
  // Home & Garden — appliances, kitchen, decor
  { id: 'home-garden', displayName: 'Home & Garden', patterns: [
    /\brefrigerator/i, /\bfreezer\b/i, /\bdishwasher/i, /\bwashing machine/i,
    /\bdryer\b(?! (?:sheet|hair))/i, /\boven\b/i, /\bmicrowave\b/i,
    /\bcoffee (?:machine|maker|grinder)/i, /\bespresso/i, /\bblender\b/i,
    /\bmixer (?:hand|stand|kitchen)/i, /\bfood processor/i, /\bkettle\b/i,
    /\bcoffee grinder/i, /\bseasoning (?:grinder|mill)/i, /\bspice (?:grinder|mill|rack)/i,
    /\bpepper (?:mill|grinder)/i, /\bsalt (?:mill|grinder)/i, /\bmeat grinder/i,
    /\btoaster\b/i, /\bwaffle iron/i, /\brice cooker/i, /\bslow cooker/i,
    /\binstant pot/i, /\bair fryer/i, /\bpressure cooker/i,
    /\bvacuum cleaner/i, /\brobot vacuum/i, /\biron\b(?!(?:y|ic|ing (?:board| plate)))/i,
    /\bsteamer\b/i, /\bair (?:conditioner|purifier|freshener)/i, /\bhumidifier\b/i,
    /\bdehumidifier/i, /\bfan\b(?! belt| speed| control)/i, /\bheater\b/i,
    /\bmattress topper/i, /\bpillow\b/i, /\bbedding\b/i, /\bbed sheet/i,
    /\bduvet\b/i, /\bcomforter\b/i, /\bcurtain\b/i, /\bblind\b(?!(?:s? spot))/i,
    /\brug\b/i, /\bcarpet\b/i, /\btable ?cloth/i, /\bcookware/i,
    /\bpots? and pans/i, /\bfrying pan/i, /\bskillet/i, /\bcasserole dish/i,
    /\bglassware/i, /\bmug\b/i, /\bceramic dish/i, /\bdinnerware/i,
    /\bcutlery/i, /\bsilverware/i, /\bknife\b(?! sharpener| block| set)/i,
    /\bgarden\b/i, /\blawn (?:mower|care|tool)/i, /\btrimmer\b/i,
    /\bplant (?:pot|holder|stand)/i, /\bwater(?:ing)? can/i, /\bhose\b/i,
    /\bsprinkler/i, /\bpool\b(?! table)/i, /\bpatio/i, /\bbarbecue/i,
    /\bbbq\b/i, /\bgrill\b/i, /\bpicture frame/i, /\bwall clock/i,
    /\bcandle\b/i, /\bvase\b/i, /\bmirror\b/i, /\bshower curtain/i,
    /\btowel\b(?! rack| bar| holder| ring| paper)/i, /\bsoap dispenser/i
  ] },
  // Food, Beverages & Tobacco
  { id: 'food-beverages-tobacco', displayName: 'Food, Beverages & Tobacco', patterns: [
    /\bfood (?:supplement|coloring|packaging|storage container)/i,
    /\bcoffee (?:bean|ground|pod|capsule|filter)/i, /\btea (?:bag|leaf|infuser)/i,
    /\bwine\b(?! opener| rack| cooler)/i, /\bbeer\b(?! mug)/i,
    /\bspirits?\b(?! level)/i, /\bwhisky/i, /\bvodka/i, /\brum\b/i,
    /\bnutrition/i, /\bvitamin\b/i, /\bsnack\b/i, /\bcandy\b/i,
    /\bcigarette\b/i, /\bcigar\b(?!ette)/i, /\btobacco\b/i, /\bvape\b/i,
    /\be-?cigarette/i
  ] },
  // Animals & Pet Supplies
  { id: 'animals-pet-supplies', displayName: 'Animals & Pet Supplies', patterns: [
    /\bpet (?:food|carrier|bed|collar|leash|toy)/i, /\bdog (?:food|bed|leash|collar|toy)/i,
    /\bcat (?:food|litter|tree|toy)/i, /\bfish tank/i, /\baquarium/i,
    /\bbird (?:cage|feeder|seed)/i, /\bhamster/i, /\brabbit (?:cage|hutch)/i,
    /\bhorse (?:saddle|bridle|riding)/i, /\breptile (?:cage|terrarium)/i,
    /\bvet(?:erinary)?/i, /\bpet grooming/i
  ] },
  // Arts & Entertainment
  { id: 'arts-entertainment', displayName: 'Arts & Entertainment', patterns: [
    /\bart (?:supplies|kit|canvas|easel)/i, /\bcanvas\b/i, /\beasel\b/i,
    /\bpaint (?:brush|palette|set)/i, /\bacrylic paint/i, /\bwatercolor/i,
    /\bmusical instrument/i, /\bguitar\b/i, /\bpiano\b/i, /\bviolin\b/i,
    /\bdrum (?:kit|stick|pad)/i, /\bkeyboard music/i, /\bmicrophone\b(?! amp)/i,
    /\bsheet music/i, /\bkaraoke/i, /\bmagic (?:trick|kit)/i,
    /\bcraft (?:kit|supplies)/i, /\bsculpting/i, /\bpottery/i
  ] },
  // Religious & Ceremonial
  { id: 'religious-ceremonial', displayName: 'Religious & Ceremonial', patterns: [
    /\breligious\b/i, /\bchurch\b/i, /\btemple\b(?! bar)/i, /\bmosque/i,
    /\bcrucifix/i, /\brosary/i, /\bmenorah/i, /\bincense burner/i,
    /\bmenora/i, /\bcandelabra/i, /\bceremonial\b/i
  ] },
  // Mature
  { id: 'mature', displayName: 'Mature', patterns: [
    /\badult (?:toy|content|magazine)/i, /\bsex (?:toy| product)/i, /\bfetish\b/i
  ] },
  // Electronics — catch-all for the massive remainder of Icecat's technology tree
  { id: 'electronics', displayName: 'Electronics', patterns: [
    /\bprinter\b/i, /\bscanner\b/i, /\bcopier\b/i, /\bfax\b/i,
    /\bcomputer\b/i, /\blaptop\b/i, /\bdesktop pc/i, /\bworkstation/i,
    /\bserver\b(?! room)/i, /\btablet\b(?!(?:tsp|top))/i, /\bsmartphone\b/i, /\bmobile phone/i,
    /\bcell phone/i, /\bfeature phone/i, /\bkeyboard\b/i, /\bmouse\b(?!(?:pad| trap| oil))/i,
    /\bmonitor\b(?! (?:baby|blood|heart|glucose|humidity))/i, /\btelevision\b/i, /\btv\b/i,
    /\bspeaker\b/i, /\bheadphone/i, /\bearphone/i, /\bearbud/i,
    /\bheadset\b/i, /\bmicrophone\b/i, /\bamplifier\b/i, /\bstereo\b/i,
    /\breceiver\b/i, /\bturntable/i, /\bdvd (?:player|drive)/i, /\bblu-?ray/i,
    /\bmp3 player/i, /\bportable media player/i, /\bprojector\b/i,
    /\brouter\b/i, /\bmodem\b/i, /\bswitch\b(?! (?:box| plate))/i, /\bhub\b(?!cap)/i,
    /\bnetwork\b/i, /\bwireless (?:access point|router|adapter)/i, /\baccess point/i,
    /\bfirewall\b/i, /\bnas\b/i, /\bsan\b/i, /\bstorage (?:server|array|enclosure)/i,
    /\bhard drive/i, /\bhdd\b/i, /\bssd\b/i, /\busb (?:drive|stick|memory)/i,
    /\bflash drive/i, /\bmemory card/i, /\bsd card/i, /\bram\b(?! rod)/i,
    /\bmotherboard/i, /\bgpu\b/i, /\bgraphics card/i, /\bcpu\b/i, /\bprocessor\b/i,
    /\bpower supply unit/i, /\bpsu\b/i, /\bups\b/i, /\bups (?:battery| unit)/i,
    /\bups\b/i, /\bbattery (?:pack|charger|holder)\b/i, /\bcharger\b/i, /\bcable\b/i,
    /\badapter\b/i, /\bconverter\b/i, /\bhdmi\b/i, /\busb\b/i, /\bethernet\b/i,
    /\bsatellite dish/i, /\bset-?top box/i, /\bgame console/i, /\bgaming (?:console|controller|pad)/i,
    /\bvr (?:headset|glasses)/i, /\bar (?:headset|glasses)/i, /\bsmart(?:watch|glasses|home|speaker)/i,
    /\bthermostat\b/i, /\bdoorbell (?:camera|smart)/i, /\bhome (?:automation|security)/i,
    /\balarm system/i, /\bsecurity camera/i, /\bcctv/i, /\bdrone\b/i,
    /\bcalculator (?:scientific|graphing)/i, /\becg\b(?! chair)/i, /\bnetbook/i,
    /\bwireless (?:earbuds|headphones|speaker|charger|keyboard|mouse)/i,
    /\bpower bank/i, /\bportable charger/i, /\bsurge protector/i,
    /\bpower strip/i, /\bmemory (?:module|stick|card)/i,
    /\bmedia player/i, /\bhome theater/i, /\bsoundbar/i, /\bsubwoofer/i,
    /\btuner\b/i, /\breceiver\b/i, /\bantenna\b/i, /\bwebcam/i,
    /\bcable modem/i, /\bpoe\b/i, /\brack (?:cabinet|mount|shelf|unit)/i
  ] }
];

const VERTICAL_ORDER = VERTICAL_RULES.map(v => v.id);

function classifyCategory(cat) {
  const haystack = [
    String(cat.displayName || ''),
    ...(Array.isArray(cat.path) ? cat.path : []),
    ...(Array.isArray(cat.matchTerms) ? cat.matchTerms : [])
  ].join(' | ');
  for (const rule of VERTICAL_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(haystack)) return rule.id;
    }
  }
  return null;
}

function build() {
  const catFeatPath = outputPath('icecatCategoryFeatures.json');
  if (!fs.existsSync(catFeatPath)) {
    throw new Error(
      'icecatCategoryFeatures.json not found. Run build-icecat-category-features.js first.'
    );
  }
  const raw = fs.readFileSync(catFeatPath, 'utf8');
  const catFeatData = JSON.parse(raw);
  const sourceBytes = fileBytes(catFeatPath);
  const sourceSha256 = sha256OfFileSync(catFeatPath);

  const mapping = {};
  const perVerticalCounts = Object.create(null);
  let unclassified = 0;

  const sortedIds = Object.keys(catFeatData.categories).sort(
    (a, b) => Number(a) - Number(b)
  );
  for (const id of sortedIds) {
    const cat = catFeatData.categories[id];
    const verticalId = classifyCategory(cat);
    if (verticalId) {
      mapping[id] = verticalId;
      perVerticalCounts[verticalId] = (perVerticalCounts[verticalId] || 0) + 1;
    } else {
      unclassified += 1;
    }
  }

  const mappingPayload = {
    $schema: 'shopscout://normalization-libraries/icecatCategoryToVertical/v1',
    version: 1,
    source: {
      vocabulary: 'Open Icecat (categories) ↔ Shopify Product Taxonomy (verticals)',
      icecatSourceFile: 'normalization/libraries/generated/icecatCategoryFeatures.json',
      icecatSourceSha256: sourceSha256,
      icecatSourceBytes: sourceBytes,
      shopifySourceFile: 'vendor/shopify-taxonomy/taxonomy.json',
      shopifyVersion: '2026-05',
      generatedAt: nowIso(),
      generator: GENERATOR_NAME,
      generatorVersion: GENERATOR_VERSION,
      note: 'Deterministic keyword-based mapping. Rules ordered by specificity in VERTICAL_RULES; earlier matches win. Categories that match no rule are omitted. Runtime should fall back to bundled defaults when an Icecat category id is not present in this mapping.'
    },
    mapping
  };

  const mappingContent = serializeJson(mappingPayload);
  writeGeneratedFile(MAPPING_OUT, mappingContent);

  const totalMapped = Object.keys(mapping).length;

  // Emit verticals-index.json (packUrl/packBytes/packSha256 placeholders —
  // pack splitter will overwrite when it runs).
  const indexPayload = {
    $schema: 'shopscout://normalization-libraries/verticalsIndex/v1',
    version: 1,
    source: {
      shopifyVersion: '2026-05',
      generatedAt: nowIso(),
      generator: GENERATOR_NAME,
      generatorVersion: GENERATOR_VERSION,
      note: 'packUrl / packBytes / packSha256 fields are placeholders. The vertical pack splitter overwrites these with real values when packs are built. When those fields are placeholder-null, runtime should skip fetching and fall back to bundled defaults.'
    },
    verticals: VERTICAL_RULES.map(v => ({
      id: v.id,
      displayName: v.displayName,
      icecatCategoryCount: perVerticalCounts[v.id] || 0,
      packUrl: null,
      packBytes: null,
      packSha256: null
    }))
  };

  const indexContent = serializeJson(indexPayload);
  writeGeneratedFile(INDEX_OUT, indexContent);

  return {
    totalCategories: sortedIds.length,
    totalMapped,
    unclassified,
    perVerticalCounts,
    verticals: VERTICAL_ORDER.length,
    mappingBytes: Buffer.byteLength(mappingContent, 'utf8'),
    indexBytes: Buffer.byteLength(indexContent, 'utf8')
  };
}

if (require.main === module) {
  try {
    const summary = build();
    process.stdout.write(
      `wrote ${MAPPING_OUT}: ${summary.totalMapped}/${summary.totalCategories} categories mapped ` +
      `across ${summary.verticals} verticals, ${summary.mappingBytes} bytes\n`
    );
    process.stdout.write(
      `wrote ${INDEX_OUT}: ${summary.indexBytes} bytes\n`
    );
    process.stdout.write(`unclassified: ${summary.unclassified}\n`);
    process.stdout.write('per-vertical counts:\n');
    const sortedCounts = Object.entries(summary.perVerticalCounts)
      .sort((a, b) => b[1] - a[1]);
    for (const [k, v] of sortedCounts) {
      process.stdout.write('  ' + String(v).padStart(5) + '  ' + k + '\n');
    }
  } catch (err) {
    process.stderr.write(`build-vertical-mapping failed: ${err.message}\n`);
    process.stderr.write((err.stack || '') + '\n');
    process.exit(1);
  }
}

module.exports = { build, VERTICAL_RULES, GENERATOR_NAME, GENERATOR_VERSION };

void path;
