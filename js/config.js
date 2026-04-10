// ════════════════════════════════════════════════════════════════
//  VIBE. — CONFIG.JS
//  All editable settings in one place.
//  No logic here — just data. Edit freely.
// ════════════════════════════════════════════════════════════════

// ─── PLATFORM ────────────────────────────────────────────────────
var VIBE_CONFIG = {

  // Contact & support
  whatsapp:    "+50670198460",          // WhatsApp Business number
  sinpeNumber: "7019-8460",            // SINPE Móvil recipient number
  supportEmail: "hola@vibeticketscr.com",
  exchangeRate: 525,                   // ₡ per $1 (reference only, adjust manually)

  // VIBE. service fee charged to buyer (USD)
  // Set per tier inside each event's tiers array (field: fee)
  defaultFee: 5,                       // fallback if tier has no fee set

  // Dashboard PINs  ← change before going live
  adminPIN:    "VIBE2026",             // CEO Sales Dashboard  (/admin/)
  orgPIN:      "ORG2026",              // Organizer Dashboard  (/organizer/)

};


// ─── DISCOUNT CODES ──────────────────────────────────────────────
// Format: 'CODE': percentOff
// Example: 'PROMO50': 50  →  50% off
var DISCOUNT_CODES = {
  'VIBE10':   10,   // 10% off — general promo
  'RAWDEO20': 20,   // 20% off — RAWDEO 2 promo
  'VIP15':    15,   // 15% off — VIP upsell
};


// ─── IMAGE PATHS ─────────────────────────────────────────────────
// Relative to the root HTML file that loads this script.
// If you move images, update only here.
var IMAGES = {
  logo:    "public/images/logo.jpg",
  qr:      "public/images/qr.svg",
  rawdeo:  "public/images/rawdeo.jpg",
  mansita: "public/images/mansita.jpg",
  karlo:   "public/images/karlo.jpg",
  retana:  "public/images/retana.jpg",
};

// Legacy aliases used by existing JS — do not remove
var RAWDEO_B64  = IMAGES.rawdeo;
var MANSITA_B64 = IMAGES.mansita;
var KARLO_B64   = IMAGES.karlo;
var RETANA_B64  = IMAGES.retana;
var QR_B64      = IMAGES.qr;


// ─── EVENTS ──────────────────────────────────────────────────────
// Each key is the event slug used throughout the app (e.g. "rawdeo").
// Fields per event:
//   name        — display name (ALL CAPS recommended)
//   sub         — short subtitle shown on cards
//   date        — full date string shown in checkout
//   place       — venue name shown in checkout and ticket
//   price       — base/lowest USD price (used for display on card)
//   priceCRC    — base price in colones
//   active      — true = visible in public listing; false = hidden
//   isMansita   — enables Mansita-specific hero layout
//   isRawdeo    — enables RAWDEO-specific hero layout (DJs, flyer)
//   tiers       — array of ticket types (see tier fields below)
//
// Tier fields:
//   id          — unique string, used as DOM key
//   name        — displayed in the checkout tier selector
//   price       — USD price (0 = complimentary)
//   priceCRC    — colones price (0 = complimentary)
//   capacity    — total seats/tickets for this tier
//   sold        — tickets sold so far (update from backend)
//   color       — accent color for charts and badges
//   soldout     — true forces sold-out state regardless of capacity/sold
//   fee         — VIBE. service fee in USD added on top of price
// ─────────────────────────────────────────────────────────────────

var EVENTS = {

  // ── MANSITA SUNSET SESSIONS ──────────────────────────────────
  mansita: {
    name:      "MANSITA",
    sub:       "Apr 4 · JW Marriott Guanacaste",
    date:      "April 4, 2026",
    place:     "JW Marriott Guanacaste Beach",
    price:     10,
    priceCRC:  5000,
    active:    true,
    isMansita: true,
    isRawdeo:  false,
    tiers: [
      { id:"mansita-vibes",    name:"Mansita Vibes",  price:10,  priceCRC:5000,  capacity:200, sold:124, color:"#39ff14", fee:3 },
      { id:"mansita-vip",      name:"Mansita VIP",    price:20,  priceCRC:10000, capacity:50,  sold:38,  color:"#ffb800", fee:4 },
      { id:"mansita-cortesia", name:"Complimentary",  price:0,   priceCRC:0,     capacity:30,  sold:8,   color:"#ff6b35", fee:0 },
    ]
  },

  // ── RAWDEO 2 — RAW FITNESS ───────────────────────────────────
  rawdeo: {
    name:      "RAWDEO 2",
    sub:       "Jun 6 · Pedregal · Karlo & Retana",
    date:      "June 6, 2026",
    place:     "Pedregal Event Center",
    price:     20,
    priceCRC:  10000,
    active:    true,
    isMansita: false,
    isRawdeo:  true,
    tiers: [
      { id:"raw-earlybird", name:"Raw Fitness Early Bird", price:20,  priceCRC:10000, capacity:200, sold:200, color:"#4488ff", soldout:true, fee:5 },
      { id:"raw-tier1",     name:"Raw Fitness Tier 1",     price:40,  priceCRC:20000, capacity:400, sold:287, color:"#39ff14",              fee:5 },
      { id:"raw-tier2",     name:"Raw Fitness Tier 2",     price:50,  priceCRC:25000, capacity:400, sold:142, color:"#ffb800",              fee:5 },
      { id:"raw-vip",       name:"Raw Fitness VIP",        price:75,  priceCRC:37500, capacity:100, sold:61,  color:"#ff6b35",              fee:5 },
      { id:"raw-cortesia",  name:"Complimentary",          price:0,   priceCRC:0,     capacity:50,  sold:18,  color:"#888",                 fee:0 },
    ]
  },

  // ── BLUE NIGHT CR ────────────────────────────────────────────
  noche: {
    name:      "BLUE NIGHT CR",
    sub:       "Jul 12 · San José",
    date:      "Jul 12, 2026",
    place:     "San José",
    price:     35,
    priceCRC:  17500,
    active:    true,
    isMansita: false,
    isRawdeo:  false,
    tiers: [
      { id:"noche-general", name:"General", price:35, priceCRC:17500, capacity:300, sold:89,  color:"#39ff14", fee:5 },
      { id:"noche-vip",     name:"VIP",     price:65, priceCRC:32500, capacity:80,  sold:22,  color:"#ffb800", fee:5 },
    ]
  },

  // ── GOLDEN HOUR ──────────────────────────────────────────────
  golden: {
    name:      "GOLDEN HOUR",
    sub:       "Aug 2 · Guanacaste",
    date:      "Aug 2, 2026",
    place:     "Guanacaste",
    price:     80,
    priceCRC:  40000,
    active:    true,
    isMansita: false,
    isRawdeo:  false,
    tiers: [
      { id:"golden-general", name:"General",   price:80,  priceCRC:40000,  capacity:200, sold:44, color:"#39ff14", fee:5 },
      { id:"golden-vip",     name:"VIP Table", price:150, priceCRC:75000,  capacity:30,  sold:12, color:"#ffb800", fee:5 },
    ]
  },

  // ── UNDERGROUND CR ───────────────────────────────────────────
  underground: {
    name:      "UNDERGROUND CR",
    sub:       "Sep 19 · Escazú",
    date:      "Sep 19, 2026",
    place:     "Escazú",
    price:     25,
    priceCRC:  12500,
    active:    true,
    isMansita: false,
    isRawdeo:  false,
    tiers: [
      { id:"ug-general", name:"General", price:25, priceCRC:12500, capacity:400, sold:67, color:"#39ff14", fee:5 },
    ]
  },

  // ── LATIN FEVER ──────────────────────────────────────────────
  salsa: {
    name:      "LATIN FEVER",
    sub:       "Oct 4 · Heredia",
    date:      "Oct 4, 2026",
    place:     "Heredia",
    price:     30,
    priceCRC:  15000,
    active:    true,
    isMansita: false,
    isRawdeo:  false,
    tiers: [
      { id:"salsa-general", name:"General", price:30, priceCRC:15000, capacity:300, sold:38,  color:"#39ff14", fee:5 },
      { id:"salsa-vip",     name:"VIP",     price:55, priceCRC:27500, capacity:50,  sold:11,  color:"#ffb800", fee:5 },
    ]
  },

  // ── RAW OPEN BOX ─────────────────────────────────────────────
  fitness: {
    name:      "RAW OPEN BOX",
    sub:       "Nov 8 · San José",
    date:      "Nov 8, 2026",
    place:     "San José",
    price:     20,
    priceCRC:  10000,
    active:    true,
    isMansita: false,
    isRawdeo:  false,
    tiers: [
      { id:"fit-general", name:"General", price:20, priceCRC:10000, capacity:200, sold:28, color:"#39ff14", fee:5 },
    ]
  },

  // ── NYE GALA 2026 ─────────────────────────────────────────────
  nye: {
    name:      "NYE GALA 2026",
    sub:       "Dec 31 · San José",
    date:      "Dec 31, 2026",
    place:     "San José",
    price:     120,
    priceCRC:  60000,
    active:    true,
    isMansita: false,
    isRawdeo:  false,
    tiers: [
      { id:"nye-general", name:"General",  price:120, priceCRC:60000,  capacity:200, sold:55, color:"#39ff14", fee:5 },
      { id:"nye-vip",     name:"VIP",      price:200, priceCRC:100000, capacity:50,  sold:18, color:"#ffb800", fee:5 },
      { id:"nye-table",   name:"Table x4", price:700, priceCRC:350000, capacity:20,  sold:7,  color:"#ff6b35", fee:5 },
    ]
  },

};
