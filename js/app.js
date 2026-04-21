// ════════════════════════════════════════════════════════════════
//  VIBE. — APP.JS
//  Public site logic. Depends on config.js (loaded first in <head>).
// ════════════════════════════════════════════════════════════════

// ─── STATE ───────────────────────────────────────────────────────
var tickets        = [];
var userTickets = [];
var myTicketsTab = 'upcoming';
var currentEvent   = "rawdeo";
var qty            = 1;
var payM           = "card";
var currentTier    = null;
var discountApplied = false;
var discountPct    = 0;
var loginIsRegister = true;
var attendeeData   = []; // [{ name:'', email:'' }, …] — one entry per ticket
var attendeeValidationTriggered = false; // warning only shows after first pay attempt or blur

var USD_RATE = 540; // colones per dollar — update when rate changes

function formatCRC(amount) {
  return '₡' + amount.toLocaleString('en-US');
}
function formatUSD(amountCRC) {
  return '~$' + Math.round(amountCRC / USD_RATE);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


// ─── ATTENDEE FIELDS ─────────────────────────────────────────────
function renderAttendeeFields() {
  var list = document.getElementById('attendee-list');
  if (!list) return;

  var tierName  = currentTier ? currentTier.name : 'GENERAL';
  var tierPrice = currentTier ? currentTier.priceCRC : 0;

  // Sync attendeeData length to qty (preserve existing entries)
  while (attendeeData.length < qty)  { attendeeData.push({ name: '', email: '' }); }
  while (attendeeData.length > qty)  { attendeeData.pop(); }

  var html = '';
  for (var i = 0; i < qty; i++) {
    var a = attendeeData[i];
    html +=
      '<div class="attendee-ticket">' +
        '<div class="attendee-ticket-header">' +
          '<div class="attendee-ticket-label">TICKET ' + (i + 1) + ' · ' + tierName + '</div>' +
          '<div class="attendee-ticket-price">' + formatCRC(tierPrice) + '</div>' +
        '</div>' +
        '<div class="attendee-fields">' +
          '<div>' +
            '<label class="attendee-field-label" for="att-name-' + i + '">FULL NAME</label>' +
            '<input type="text" class="attendee-input" id="att-name-' + i + '" ' +
                   'value="' + escapeHtml(a.name) + '" placeholder="Full name" ' +
                   'autocomplete="name" ' +
                   'oninput="updateAttendee(' + i + ',\'name\',this.value)" ' +
                   'onchange="updateAttendee(' + i + ',\'name\',this.value)" ' +
                   'onblur="onAttendeeBlur()"/>' +
          '</div>' +
          '<div>' +
            '<label class="attendee-field-label" for="att-email-' + i + '">EMAIL</label>' +
            '<input type="email" class="attendee-input" id="att-email-' + i + '" ' +
                   'value="' + escapeHtml(a.email) + '" placeholder="email@example.com" ' +
                   'autocomplete="email" ' +
                   'oninput="updateAttendee(' + i + ',\'email\',this.value)" ' +
                   'onchange="updateAttendee(' + i + ',\'email\',this.value)" ' +
                   'onblur="onAttendeeBlur()"/>' +
          '</div>' +
        '</div>' +
      '</div>';
  }
  list.innerHTML = html;
  validateAttendees();
}

function updateAttendee(index, field, value) {
  if (!attendeeData[index]) attendeeData[index] = { name: '', email: '' };
  attendeeData[index][field] = value.trim();
  validateAttendees();
}

function validateAttendees() {
  var emailRe  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var allValid = true;

  for (var i = 0; i < qty; i++) {
    var a = attendeeData[i] || { name: '', email: '' };
    if (!a.name || !a.email || !emailRe.test(a.email)) {
      allValid = false;
      break;
    }
  }

  // Warning only shows after user has interacted (blur) or clicked pay
  var warning = document.getElementById('attendee-warning');
  if (warning) {
    if (attendeeValidationTriggered && !allValid) {
      warning.classList.add('attendee-warning--visible');
    } else {
      warning.classList.remove('attendee-warning--visible');
    }
  }

  var btn = document.getElementById('ed-buy-btn');
  if (btn) {
    btn.disabled = !allValid;
    btn.classList.toggle('btn-disabled', !allValid);
  }

  return allValid;
}

function onAttendeeBlur() {
  for (var i = 0; i < qty; i++) {
    var a = attendeeData[i] || { name: '', email: '' };
    // If user typed something but left a field incomplete, trigger warning
    if ((a.name && !a.email) || (!a.name && a.email)) {
      attendeeValidationTriggered = true;
      break;
    }
  }
  validateAttendees();
}


// ─── PAGES ───────────────────────────────────────────────────────
function goPage(p) {
  document.querySelectorAll(".page").forEach(function(x){ x.classList.remove("active"); });
  document.getElementById("pg-" + p).classList.add("active");
  window.scrollTo(0, 0);
  initFadeIns();
  if (p === 'my-tickets') renderMyTickets();
}


// ─── FADE-IN OBSERVER ────────────────────────────────────────────
function initFadeIns() {
  var els = document.querySelectorAll(".fade-in:not(.visible)");
  if ("IntersectionObserver" in window) {
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    els.forEach(function(el) { obs.observe(el); });
  } else {
    els.forEach(function(el) { el.classList.add("visible"); });
  }
}


// ─── NAV SCROLL ──────────────────────────────────────────────────
window.addEventListener("scroll", function() {
  var nav = document.getElementById("main-nav");
  if (!nav) return;
  if (window.scrollY > 20) { nav.classList.add("scrolled"); }
  else { nav.classList.remove("scrolled"); }
});


// ─── EVENT FILTER (home search bar) ──────────────────────────────
function filterCat(el) {
  document.querySelectorAll(".cat").forEach(function(c){ c.classList.remove("on"); });
  el.classList.add("on");
}

function filterEvents(q) {
  var cards = document.querySelectorAll('#events-grid-wrap .ev-card');
  var query = q.toLowerCase().trim();
  cards.forEach(function(card) {
    var name = card.querySelector('.ev-card-name');
    var meta = card.querySelector('.ev-card-meta');
    var text = ((name ? name.textContent : '') + ' ' + (meta ? meta.textContent : '')).toLowerCase();
    card.style.display = (!query || text.indexOf(query) !== -1) ? '' : 'none';
  });
}


// ─── CHECKOUT ────────────────────────────────────────────────────
function openCheckout(evKey) {
  discountApplied = false; discountPct = 0;
  var di = document.getElementById('discount-input');
  var dm = document.getElementById('discount-msg');
  if (di) { di.value = ''; di.disabled = false; }
  if (dm) { dm.style.display = 'none'; dm.textContent = ''; }
  currentEvent = evKey || "rawdeo";
  qty = 1;
  payM = "card";
  currentTier = null;
  attendeeData = [];
  attendeeValidationTriggered = false;
  goPage("event-detail");
  updWidget();
  var firstAvail = EVENTS[currentEvent].tiers.find(function(t){ return !t.soldout && (t.capacity - t.sold) > 0; });
  if (firstAvail) selectTier(firstAvail.id);
  document.querySelectorAll(".pay-panel").forEach(function(p){ p.classList.remove("show"); });
  document.getElementById("pp-card").classList.add("show");
  document.querySelectorAll(".pay-opt").forEach(function(o){ o.classList.remove("on"); });
  document.querySelector(".pay-opt").classList.add("on");
}

function selectTier(tierId) {
  var ev = EVENTS[currentEvent];
  var tier = ev.tiers.find(function(t){ return t.id === tierId; });
  if (!tier || tier.soldout) return;
  currentTier = tier;
  document.querySelectorAll('.tier-selectable').forEach(function(el){
    el.classList.toggle('selected', el.dataset.tierId === tierId);
  });
  updTotals();
  renderAttendeeFields();
}

function updTotals() {
  var ev = EVENTS[currentEvent];
  var tier = currentTier || (ev.tiers ? ev.tiers[0] : ev);
  var price    = tier.price    !== undefined ? tier.price    : ev.price;
  var priceCRC = tier.priceCRC !== undefined ? tier.priceCRC : ev.priceCRC;
  if (discountApplied && discountPct > 0) {
    price    = price    * (1 - discountPct / 100);
    priceCRC = priceCRC * (1 - discountPct / 100);
  }
  var tc   = qty * priceCRC;
  var disp = priceCRC === 0
    ? "Free"
    : formatCRC(Math.round(tc)) + '<span class="price-usd-secondary">' + formatUSD(Math.round(tc)) + ' USD</span>';
  var lbl = qty + " ticket" + (qty > 1 ? "s" : "");
  var sinpeAmt = document.getElementById("sinpe-amt");
  if (sinpeAmt) sinpeAmt.textContent = "📲 " + formatCRC(Math.round(tc)) + " → " + VIBE_CONFIG.sinpeNumber;
  var totalEl = document.getElementById("ed-total");
  if (totalEl) totalEl.innerHTML = disp;
  var lblEl = document.getElementById("ed-qty-label");
  if (lblEl) lblEl.textContent = lbl;
}


// ─── EVENT WIDGET ────────────────────────────────────────────────
function updWidget() {
  var ev = EVENTS[currentEvent];
  var heroImg = document.getElementById("ed-hero-img");
  if (heroImg) {
    heroImg.src = ev.isMansita ? MANSITA_B64 : RAWDEO_B64;
  }
  var heroTitle = document.getElementById("ed-hero-title");
  if (heroTitle) heroTitle.textContent = ev.name;
  var heroSub = document.getElementById("ed-hero-sub");
  if (heroSub) heroSub.textContent = ev.sub;
  var wEvt = document.getElementById("ed-widget-event-name");
  if (wEvt) wEvt.textContent = ev.name;
  var wSub = document.getElementById("ed-widget-sub-text");
  if (wSub) wSub.textContent = ev.sub.toUpperCase();
  var wDate = document.getElementById("ed-info-date");
  if (wDate) wDate.textContent = ev.date;
  var wPlace = document.getElementById("ed-info-place");
  if (wPlace) wPlace.textContent = ev.place;
  renderTiers();
  updTotals();
  updateLineup(ev);
}

function updateLineup(ev) {
  var lineupSection = document.getElementById("ed-lineup-section");
  if (!lineupSection) return;
  var html = '<div class="section-eyebrow">Confirmed artists</div>';
  if (ev.isMansita) {
    html += '<div class="ed-dj-card fade-in visible">';
    html += '<div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#ff6b35,#f7931e);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;">🎤</div>';
    html += '<div><div class="ed-dj-role">DJ &middot; MAIN ACT</div><div class="ed-dj-name">JESSI G.</div>';
    html += '<div class="ed-dj-desc">One of Costa Rica&#39;s most sought-after DJs, known for her infectious energy and sets that keep dance floors moving all night.</div></div>';
    html += '</div>';
    html += '<div class="ed-dj-card fade-in visible">';
    html += '<div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#c0392b,#e74c3c);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;">🎧</div>';
    html += '<div><div class="ed-dj-role">DJ &middot; SPECIAL SET</div><div class="ed-dj-name">CELE ARABAL</div>';
    html += '<div class="ed-dj-desc">With a signature style blending deep house and Latin rhythms, Cele Arabal delivers unforgettable sunset sessions on the Guanacaste coast.</div></div>';
    html += '</div>';
  } else if (ev.isRawdeo) {
    html += '<div class="ed-dj-card fade-in visible">';
    html += '<img class="ed-dj-img" src="' + KARLO_B64 + '" alt="Karlo"/>';
    html += '<div><div class="ed-dj-role">DJ &middot; Main Set</div><div class="ed-dj-name">KARLO</div>';
    html += '<div class="ed-dj-desc">One of the most recognized DJs in the Costa Rican electronic scene, known for his high-energy sets blending tech house and minimal.</div></div>';
    html += '</div>';
    html += '<div class="ed-dj-card fade-in visible">';
    html += '<img class="ed-dj-img" src="' + RETANA_B64 + '" alt="Retana"/>';
    html += '<div><div class="ed-dj-role">DJ &middot; Special Set</div><div class="ed-dj-name">RETANA</div>';
    html += '<div class="ed-dj-desc">With a unique style mixing deep grooves and hypnotic melodies, RETANA has conquered dance floors across Costa Rica.</div></div>';
    html += '</div>';
  } else {
    html += '<p style="color:var(--gray);font-size:14px;margin-top:8px;">Lineup to be announced.</p>';
  }
  lineupSection.innerHTML = html;
}


// ─── QUANTITY ─────────────────────────────────────────────────────
function chQ(d) {
  qty = Math.max(1, Math.min(10, qty + d));
  var qEl = document.getElementById("ed-q");
  if (qEl) qEl.textContent = qty;
  updTotals();
  renderAttendeeFields();
}


// ─── PAYMENT METHOD ───────────────────────────────────────────────
function selPay(m) {
  payM = m;
  document.querySelectorAll(".pay-opt").forEach(function(o){ o.classList.remove("on"); });
  var target = document.querySelector('.pay-opt[data-pay="' + m + '"]');
  if (target) target.classList.add("on");
  document.querySelectorAll(".pay-panel").forEach(function(p){ p.classList.remove("show"); });
  document.getElementById("pp-" + m).classList.add("show");
  updTotals();
}


// ─── CARD BRAND DETECTION ─────────────────────────────────────────
function detectCardBrand(number) {
  var clean = number.replace(/\s+/g, '');
  if (!clean) return null;
  if (/^3[47]/.test(clean)) return 'amex';
  if (/^4/.test(clean)) return 'visa';
  if (/^5[1-5]/.test(clean)) return 'mc';
  if (/^2(2(2[1-9]|[3-9]\d)|[3-6]\d{2}|7([01]\d|20))/.test(clean)) return 'mc';
  return null;
}

var BRAND_SVG = {
  visa: '<svg width="36" height="24" viewBox="0 0 48 32"><rect width="48" height="32" rx="4" fill="#1a1f71"/><text x="24" y="21" font-family="Arial Black,sans-serif" font-weight="900" font-size="13" fill="#ffffff" text-anchor="middle" font-style="italic">VISA</text></svg>',
  mc:   '<svg width="36" height="24" viewBox="0 0 48 32"><rect width="48" height="32" rx="4" fill="#1a1a1a"/><circle cx="19" cy="16" r="10" fill="#eb001b"/><circle cx="29" cy="16" r="10" fill="#f79e1b" fill-opacity="0.85"/></svg>',
  amex: '<svg width="36" height="24" viewBox="0 0 48 32"><rect width="48" height="32" rx="4" fill="#006fcf"/><text x="24" y="21" font-family="Arial Black,sans-serif" font-weight="900" font-size="10" fill="#ffffff" text-anchor="middle">AMEX</text></svg>'
};

var BRAND_MULTI_SVG =
  '<div class="card-brand-multi">' +
  '<div class="card-brand-mini-item"><svg width="24" height="16" viewBox="0 0 48 32"><rect width="48" height="32" rx="4" fill="#1a1f71"/><text x="24" y="21" font-family="Arial Black,sans-serif" font-weight="900" font-size="13" fill="#ffffff" text-anchor="middle" font-style="italic">VISA</text></svg></div>' +
  '<div class="card-brand-mini-item"><svg width="24" height="16" viewBox="0 0 48 32"><rect width="48" height="32" rx="4" fill="#1a1a1a"/><circle cx="19" cy="16" r="9" fill="#eb001b"/><circle cx="29" cy="16" r="9" fill="#f79e1b" fill-opacity="0.85"/></svg></div>' +
  '<div class="card-brand-mini-item"><svg width="24" height="16" viewBox="0 0 48 32"><rect width="48" height="32" rx="4" fill="#006fcf"/><text x="24" y="21" font-family="Arial Black,sans-serif" font-weight="900" font-size="10" fill="#ffffff" text-anchor="middle">AMEX</text></svg></div>' +
  '</div>';

function formatCardNumber(value) {
  var clean = value.replace(/\D/g, '');
  var brand = detectCardBrand(clean);
  if (brand === 'amex') {
    // 4-6-5 format
    var p1 = clean.substring(0, 4);
    var p2 = clean.substring(4, 10);
    var p3 = clean.substring(10, 15);
    return [p1, p2, p3].filter(Boolean).join(' ');
  }
  // 4-4-4-4
  return clean.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function handleCardNumberInput(input) {
  var cursor = input.selectionStart;
  var prevLen = input.value.length;
  input.value = formatCardNumber(input.value);
  // Adjust cursor for inserted spaces
  var newLen = input.value.length;
  input.setSelectionRange(cursor + (newLen - prevLen), cursor + (newLen - prevLen));

  var brand = detectCardBrand(input.value);
  var display = document.getElementById('card-brand-display');
  if (!display) return;
  if (brand) {
    display.innerHTML = '<div class="card-brand-detected">' + BRAND_SVG[brand] + '</div>';
  } else {
    display.innerHTML = BRAND_MULTI_SVG;
  }
}

function handleExpiryInput(input) {
  var clean = input.value.replace(/\D/g, '');
  if (clean.length >= 2) {
    input.value = clean.substring(0, 2) + ' / ' + clean.substring(2, 4);
  } else {
    input.value = clean;
  }
}


// ─── PAY ──────────────────────────────────────────────────────────
function doPay() {
  attendeeValidationTriggered = true;
  if (!validateAttendees()) {
    var warning = document.getElementById('attendee-warning');
    if (warning) warning.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  var btn = document.getElementById("ed-buy-btn");
  if (!btn) return;
  btn.textContent = "⏳ Processing...";
  btn.disabled = true;
  setTimeout(function() {
    var ev   = EVENTS[currentEvent];
    var tier = currentTier || (ev.tiers ? ev.tiers.find(function(t){ return !t.soldout && (t.capacity - t.sold) > 0; }) || ev.tiers[0] : ev);
    var price    = tier.price    !== undefined ? tier.price    : ev.price;
    var priceCRC = tier.priceCRC !== undefined ? tier.priceCRC : ev.priceCRC;
    var t        = qty * price;
    var tc       = qty * priceCRC;
    var code     = "VB-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    var totalStr = price === 0 ? "Complimentary" : (payM === "sinpe" ? "₡" + tc.toLocaleString() : "$" + t);
    var tierName = tier.name || "General";

    tickets.push({
      ev: ev.name, date: ev.date, place: ev.place,
      qty: qty + " ticket" + (qty > 1 ? "s" : ""),
      total: totalStr, code: code, tier: tierName,
      isRawdeo: ev.isRawdeo, isMansita: ev.isMansita
    });

    // Update My Tickets list and nav badge immediately
    renderTickets();
    var badge = document.getElementById("menu-ticket-badge");
    if (badge) {
      badge.textContent = tickets.length;
      badge.style.display = "inline-flex";
    }

    btn.textContent = "🔒 Complete purchase";
    btn.disabled = false;

    addPurchaseToUserTickets();
    showConfirmation({
      id: currentEvent,
      name: ev.name,
      date: ev.date,
      venue: ev.place,
      image: ev.isMansita ? MANSITA_B64 : RAWDEO_B64,
      tier: tierName,
      qty: qty,
      total: qty * priceCRC,
      ticketId: code
    });
  }, 1800);
}

function closeConfirm() {
  var screen = document.getElementById('confirm-screen');
  if (screen) screen.classList.remove('open');
  goPage('home');
}

function addPurchaseToUserTickets() {
  var ev = EVENTS[currentEvent];
  var eventImage = ev.isMansita ? MANSITA_B64 : RAWDEO_B64;
  for (var i = 0; i < qty; i++) {
    var a = attendeeData[i] || { name: 'Guest', email: '' };
    userTickets.push({
      ticketId: 'TKT-' + Date.now() + '-' + i,
      eventId: currentEvent,
      eventName: ev.name,
      eventDate: ev.date,
      eventDateISO: ev.dateISO || '2026-06-06T20:00:00-06:00',
      eventVenue: ev.place,
      eventImage: eventImage,
      tierId: currentTier ? currentTier.id : 'general',
      tierName: currentTier ? currentTier.name : 'GENERAL',
      attendeeName: a.name || 'Guest',
      attendeeEmail: a.email || '',
      priceCRC: currentTier ? currentTier.priceCRC : 0,
      purchasedAt: new Date().toISOString()
    });
  }
  attendeeData = [];
}

function renderMyTickets() {
  var container = document.getElementById('my-tickets-list');
  if (!container) return;

  var now = new Date();
  var upcomingCount = 0, pastCount = 0;
  userTickets.forEach(function(t) {
    var d = new Date(t.eventDateISO);
    if (d >= now) upcomingCount++; else pastCount++;
  });
  var upEl = document.getElementById('mt-tab-upcoming-count');
  var pastEl = document.getElementById('mt-tab-past-count');
  if (upEl) upEl.textContent = upcomingCount;
  if (pastEl) pastEl.textContent = pastCount;

  var filtered = userTickets.filter(function(t) {
    var d = new Date(t.eventDateISO);
    return myTicketsTab === 'upcoming' ? d >= now : d < now;
  });

  if (filtered.length === 0) {
    container.innerHTML =
      '<div class="mt-empty">' +
        '<div class="mt-empty-icon">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none">' +
            '<path d="M9 11l3 3 7-7M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="#666" stroke-width="1.5" stroke-linecap="round"/>' +
          '</svg>' +
        '</div>' +
        '<div class="mt-empty-title">No tickets yet</div>' +
        '<div class="mt-empty-desc">Your purchased tickets will show up here.</div>' +
        '<button class="mt-empty-btn" onclick="goPage(\'home\')">BROWSE EVENTS →</button>' +
      '</div>';
    return;
  }

  container.innerHTML = filtered.map(function(t) {
    var pastCls = myTicketsTab === 'past' ? ' mt-card--past' : '';
    var btnLabel = myTicketsTab === 'past' ? 'VIEW TICKET →' : 'VIEW QR →';
    var attendee = (t.attendeeName || 'Guest').toUpperCase();
    return '<div class="mt-card' + pastCls + '" data-ticket-id="' + t.ticketId + '">' +
      '<div class="mt-card-img"><img src="' + (t.eventImage || '') + '" alt="' + t.eventName + '" loading="lazy"/></div>' +
      '<div class="mt-card-info">' +
        '<div class="mt-card-date">' + t.eventDate.toUpperCase() + '</div>' +
        '<div class="mt-card-name">' + t.eventName + '</div>' +
        '<div class="mt-card-venue">' + t.eventVenue + '</div>' +
        '<div class="mt-card-bottom">' +
          '<span class="mt-card-meta">' + t.tierName + ' · ' + attendee + '</span>' +
          '<button class="mt-card-qr-btn" onclick="viewTicketQR(\'' + t.ticketId + '\')">' + btnLabel + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function switchMyTicketsTab(tab) {
  myTicketsTab = tab;
  document.querySelectorAll('.mt-tab').forEach(function(el) {
    el.classList.toggle('mt-tab--active', el.dataset.tab === tab);
  });
  renderMyTickets();
}

function viewTicketQR(ticketId) {
  var t = userTickets.find(function(x) { return x.ticketId === ticketId; });
  if (!t) return;
  showConfirmation({
    id: t.eventId,
    name: t.eventName,
    date: t.eventDate,
    venue: t.eventVenue,
    image: t.eventImage,
    tier: t.tierName,
    qty: 1,
    total: t.priceCRC,
    ticketId: t.ticketId
  });
}

function addToWallet() {
  alert('Wallet integration available after backend setup. For now, save a screenshot of your QR code.');
}

function showConfirmation(data) {
  var screen = document.getElementById('confirm-screen');
  if (!screen) return;

  document.getElementById('confirm-event-name').textContent = data.name;
  document.getElementById('confirm-event-date').textContent = data.date;
  document.getElementById('confirm-event-venue').textContent = data.venue;
  document.getElementById('confirm-subtitle-event').textContent = data.name;

  var imgEl = document.getElementById('confirm-event-img');
  if (imgEl && data.image) {
    imgEl.src = data.image;
    imgEl.alt = data.name;
  }

  document.getElementById('confirm-details').textContent =
    data.qty + ' ticket' + (data.qty > 1 ? 's' : '') +
    ' · ' + data.tier +
    ' · ' + formatCRC(data.total);

  var qrData = JSON.stringify({
    ticketId: data.ticketId,
    event: data.id,
    tier: data.tier,
    qty: data.qty,
    ts: Date.now()
  });
  generateQR(qrData);

  setWalletButton();

  screen.classList.add('open');
  window.scrollTo(0, 0);
}

function generateQR(data) {
  var container = document.getElementById('confirm-qr');
  if (!container) return;
  container.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    new QRCode(container, {
      text: data,
      width: 160,
      height: 160,
      colorDark: '#0a0a0a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  } else {
    container.innerHTML = '<div style="color:#666;padding:12px;text-align:center;font-family:\'Barlow\',sans-serif;font-size:9px;word-break:break-all;">' + data + '</div>';
  }
}

function setWalletButton() {
  var btn = document.getElementById('confirm-wallet-btn');
  var text = document.getElementById('confirm-wallet-text');
  if (!btn || !text) return;
  var ua = navigator.userAgent;
  var iconSVG;

  if (/iPhone|iPad|iPod|Mac/.test(ua)) {
    btn.className = 'wallet-btn-apple';
    text.textContent = 'Add to Apple Wallet';
    iconSVG = '<svg class="wallet-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5,12.5c0-2.5,2-3.7,2.1-3.8c-1.1-1.7-2.9-1.9-3.5-1.9c-1.5-0.2-2.9,0.9-3.6,0.9c-0.7,0-1.9-0.9-3.1-0.8c-1.6,0-3.1,0.9-3.9,2.4c-1.7,2.9-0.4,7.2,1.2,9.5c0.8,1.1,1.7,2.4,2.9,2.4c1.2,0,1.6-0.8,3.1-0.8c1.4,0,1.8,0.8,3.1,0.7c1.3,0,2.1-1.2,2.9-2.3c0.9-1.3,1.3-2.6,1.3-2.6C19.9,16.1,17.5,15.2,17.5,12.5z M15.2,5.1c0.6-0.8,1.1-1.9,1-2.9c-0.9,0-2,0.6-2.7,1.4c-0.6,0.7-1.1,1.8-1,2.8C13.5,6.5,14.6,5.9,15.2,5.1z"/></svg>';
  } else if (/Android/.test(ua)) {
    btn.className = 'wallet-btn-google';
    text.textContent = 'Add to Google Wallet';
    iconSVG = '<svg class="wallet-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2" stroke="#fff" stroke-width="1.5"/><path d="M3 10h18" stroke="#fff" stroke-width="1.5"/></svg>';
  } else {
    btn.className = 'wallet-btn-download';
    text.textContent = 'DOWNLOAD TICKET';
    iconSVG = '<svg class="wallet-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v13m0 0l-5-5m5 5l5-5M4 21h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  var currentIcon = btn.querySelector('.wallet-icon');
  if (currentIcon) currentIcon.outerHTML = iconSVG;
  else btn.insertAdjacentHTML('afterbegin', iconSVG);
}


// ─── MY TICKETS ───────────────────────────────────────────────────
function renderTickets() {
  var c = document.getElementById("mt-content");
  if (!c) return;
  if (!tickets.length) {
    c.innerHTML = '<div class="mt-empty"><div class="mt-empty-icon">🎟</div><div class="mt-empty-title">No tickets yet</div><div class="mt-empty-sub">Buy your first ticket and it will show up here</div></div>';
    var btn = document.createElement("button");
    btn.className = "btn-primary";
    btn.style = "margin: 0 auto; display: block;";
    btn.textContent = "View events";
    btn.onclick = function() { goPage("home"); };
    c.querySelector(".mt-empty").appendChild(btn);
    return;
  }
  var html = '<div class="mt-grid">';
  tickets.forEach(function(t) {
    var imgHtml = t.isRawdeo
      ? '<img src="' + RAWDEO_B64 + '" alt="event" style="width:100%;height:100%;object-fit:cover;"/>'
      : t.isMansita
      ? '<img src="' + MANSITA_B64 + '" alt="event" style="width:100%;height:100%;object-fit:cover;"/>'
      : '<div style="width:100%;height:100%;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-size:36px;">🎟</div>';
    html += '<div class="mt-card">';
    html += '<div class="mt-card-banner">' + imgHtml + '</div>';
    html += '<div class="mt-card-body">';
    html += '<div class="mt-card-name">' + t.ev + '</div>';
    html += '<div class="mt-card-sub">' + t.date + ' · ' + t.place + '</div>';
    html += '<div class="mt-card-divider"></div>';
    html += '<div class="mt-card-qr-row">';
    html += '<div class="mt-card-qr"><img src="' + QR_B64 + '" alt="QR"/></div>';
    html += '<div class="mt-card-info">';
    html += '<div class="mt-info-row"><span class="mt-info-k">Tickets</span><span class="mt-info-v">' + t.qty + '</span></div>';
    html += '<div class="mt-info-row"><span class="mt-info-k">Total</span><span class="mt-info-v">' + t.total + '</span></div>';
    html += '<div class="mt-code">' + t.code + '</div>';
    html += '<button onclick="addToWallet()" style="margin-top:12px;width:100%;background:#000;border:none;border-radius:10px;padding:11px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;"><svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg><span style="color:white;font-family:\'Barlow\',sans-serif;font-size:13px;font-weight:500;">Add to Apple Wallet</span></button>';
    html += '</div></div></div></div>';
  });
  html += '</div>';
  c.innerHTML = html;
}


// ─── DISCOUNT CODE ────────────────────────────────────────────────
function applyDiscount() {
  var code = document.getElementById('discount-input').value.trim().toUpperCase();
  var msg  = document.getElementById('discount-msg');
  msg.style.display = 'block';
  if (!code) { msg.style.color = '#ff4444'; msg.textContent = 'Enter a discount code.'; return; }
  if (discountApplied) { msg.style.color = '#ffb800'; msg.textContent = 'A discount is already applied.'; return; }
  if (DISCOUNT_CODES[code]) {
    discountPct     = DISCOUNT_CODES[code];
    discountApplied = true;
    msg.style.color = 'var(--green)';
    msg.textContent = '✓ ' + discountPct + '% discount applied!';
    document.getElementById('discount-input').disabled = true;
    updTotals();
  } else {
    msg.style.color = '#ff4444';
    msg.textContent = 'Invalid code. Try again.';
  }
}


// ─── CURRENCY SELECTOR (organizer form) ───────────────────────────
function selectCurrency(type) {
  document.querySelectorAll('.currency-opt').forEach(function(el){ el.classList.remove('on'); });
  var curr = document.getElementById('curr-' + type);
  if (curr) curr.classList.add('on');
  var detail = document.getElementById('currency-both-detail');
  if (!detail) return;
  if (type === 'both') { detail.classList.add('show'); }
  else { detail.classList.remove('show'); }
}


// ─── MENU ─────────────────────────────────────────────────────────
function toggleMenu() {
  var d = document.getElementById('menu-drawer');
  var o = document.getElementById('menu-overlay');
  if (d) d.classList.toggle('open');
  if (o) o.classList.toggle('show');
}

function closeMenu() {
  var d = document.getElementById('menu-drawer');
  var o = document.getElementById('menu-overlay');
  if (d) d.classList.remove('open');
  if (o) o.classList.remove('show');
}


// ─── LOGIN ────────────────────────────────────────────────────────
function toggleLoginMode() {
  loginIsRegister = !loginIsRegister;
  document.getElementById('login-register-fields').style.display = loginIsRegister ? 'block' : 'none';
  document.getElementById('login-mode-title').textContent  = loginIsRegister ? 'Create account' : 'Sign in';
  document.getElementById('login-mode-sub').textContent    = loginIsRegister ? 'JOIN THE VIBE. COMMUNITY' : 'WELCOME BACK';
  document.getElementById('login-submit-btn').textContent  = loginIsRegister ? 'CREATE ACCOUNT' : 'SIGN IN';
  document.getElementById('login-divider-text').textContent = loginIsRegister ? 'already have an account' : 'don\'t have an account';
  document.getElementById('login-toggle-btn').textContent  = loginIsRegister ? 'Sign in' : 'Create new account';
}

function submitLogin() {
  var email = document.getElementById('login-email').value;
  if (!email) { alert('Please enter your email address'); return; }
  if (loginIsRegister) {
    var name = document.getElementById('reg-firstname').value;
    if (!name) { alert('Please enter your name'); return; }
    document.getElementById('menu-username').textContent  = (name + ' ' + (document.getElementById('reg-lastname1').value || '')).trim();
    document.getElementById('menu-useremail').textContent = email;
    document.getElementById('menu-avatar').textContent    = name.charAt(0).toUpperCase() + (document.getElementById('reg-lastname1').value || '').charAt(0).toUpperCase();
    document.getElementById('menu-auth-btn').innerHTML    = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Sign out';
    document.getElementById('menu-auth-btn').onclick      = function(){ closeMenu(); };
  }
  goPage('home');
}


// ─── SUPPORT WIDGET ───────────────────────────────────────────────
function openSupportChat() {
  var p = document.getElementById('support-panel');
  if (p) p.classList.add('show');
}

function toggleSupportPanel() {
  var p = document.getElementById('support-panel');
  if (p) p.classList.toggle('show');
}

function supportSelect(msg) {
  addSupportMsg(msg, true);
  document.getElementById('support-options').style.display    = 'none';
  document.getElementById('support-input-row').style.display  = 'flex';
  setTimeout(function() {
    var replies = {
      'I didn\'t receive my QR by email': 'Check your spam folder first. If it\'s not there, send us your order code (e.g. VB-XXXXXX) and we\'ll resend it right away.',
      'Payment issue': 'Was the payment deducted from your account but you didn\'t receive the ticket? Send us the transaction code and we\'ll look into it.',
      'I want to cancel my purchase': 'All sales are final per our T&C. If the event was cancelled by the organizer, we process the refund automatically. Can you tell us more about your case?'
    };
    var reply = replies[msg] || 'Got it! Leave us your question and we\'ll help you.';
    addSupportMsg(reply, false);
  }, 800);
}

function addSupportMsg(text, isUser) {
  var msgs = document.getElementById('support-messages');
  var div  = document.createElement('div');
  div.className = isUser ? 'support-user-msg' : 'support-msg';
  div.innerHTML = '<div class="support-msg-text">' + text + '</div>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function sendSupportMsg() {
  var input = document.getElementById('support-input');
  var text  = input.value.trim();
  if (!text) return;
  addSupportMsg(text, true);
  input.value = '';
  setTimeout(function() {
    addSupportMsg('Thanks for your message. A VIBE. agent will get back to you soon. You can also reach us directly on WhatsApp at +506 ' + VIBE_CONFIG.sinpeNumber + '.', false);
  }, 1000);
}

function showEscalation() {
  document.getElementById('support-options').style.display      = 'none';
  document.getElementById('support-escalate').style.display     = 'flex';
  document.getElementById('support-escalate').style.flexDirection = 'column';
  document.getElementById('support-escalate').style.gap         = '8px';
}


// ─── ORGANIZER REQUEST FORM ───────────────────────────────────────
function submitOrgRequest() {
  alert('Request sent! The VIBE. team will contact you within 24 hours.');
}


// ─── FLYER CAROUSEL ───────────────────────────────────────────────
function initFlyerCarousel() {
  var track = document.getElementById('flyer-track');
  if (!track) return;
  var cs = { name:'COMING SOON', date:'', bg:'#0d0d0d', color:'#6ab04c', useImg:'', comingSoon:true };
  var slides = [
    { evKey:'rawdeo', name:'RAWDEO 2', date:'JUN 6 2026', bg:'#0a110a', color:'#6ab04c', useImg:'rawdeo' },
    cs, cs, cs, cs, cs, cs
  ];
  var all  = slides.concat(slides);
  var frag = document.createDocumentFragment();
  all.forEach(function(s) {
    var div = document.createElement('div');
    div.className = 'flyer-slide';
    if (s.evKey) div.setAttribute('data-ev', s.evKey);
    if (s.useImg === 'rawdeo' && typeof RAWDEO_B64 !== 'undefined') {
      var img = document.createElement('img');
      img.src = RAWDEO_B64; img.alt = s.name;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      div.appendChild(img);
    } else {
      div.style.background     = s.bg;
      div.style.display        = 'flex';
      div.style.flexDirection  = 'column';
      div.style.alignItems     = 'center';
      div.style.justifyContent = 'center';
      div.style.gap            = '8px';
      var nm = document.createElement('div');
      nm.className = 'fp-name'; nm.style.color = s.color; nm.textContent = s.name;
      div.appendChild(nm);
      if (s.date) {
        var dt = document.createElement('div');
        dt.className = 'fp-date'; dt.textContent = s.date;
        div.appendChild(dt);
      }
    }
    frag.appendChild(div);
  });
  track.appendChild(frag);
  track.addEventListener('click', function(e) {
    var slide = e.target.closest('.flyer-slide');
    var evKey = slide && slide.getAttribute('data-ev');
    if (evKey) openCheckout(evKey);
  });
}


// ─── EVENT CARD COUNTDOWNS ────────────────────────────────────────
var eventDates = {
  rawdeo:      new Date('June 6, 2026 20:00:00'),
};

function updateCardCountdowns() {
  var now = new Date().getTime();
  Object.keys(eventDates).forEach(function(key) {
    var diff = eventDates[key].getTime() - now;
    var dEls = document.querySelectorAll('[data-cd="' + key + '-d"]');
    var hEls = document.querySelectorAll('[data-cd="' + key + '-h"]');
    var mEls = document.querySelectorAll('[data-cd="' + key + '-m"]');
    var sEls = document.querySelectorAll('[data-cd="' + key + '-s"]');
    if (!dEls.length) return;
    var dVal, hVal, mVal, sVal;
    if (diff <= 0) {
      dVal = hVal = mVal = sVal = '00';
    } else {
      var d = Math.floor(diff / (1000 * 60 * 60 * 24));
      var h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      var m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      var s = Math.floor((diff % (1000 * 60)) / 1000);
      dVal = String(d).padStart(2, '0');
      hVal = String(h).padStart(2, '0');
      mVal = String(m).padStart(2, '0');
      sVal = String(s).padStart(2, '0');
    }
    dEls.forEach(function(el){ el.textContent = dVal; });
    hEls.forEach(function(el){ el.textContent = hVal; });
    mEls.forEach(function(el){ el.textContent = mVal; });
    sEls.forEach(function(el){ el.textContent = sVal; });
  });
}
setInterval(updateCardCountdowns, 1000);




// TODO: wire to backend newsletter endpoint
function joinNewsletter() {
  var input = document.getElementById('nl-email');
  var msg   = document.getElementById('nl-msg');
  var val   = input ? input.value.trim() : '';
  if (!msg) return;
  if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    msg.textContent = 'Enter a valid email address.';
    msg.className   = 'nl-msg nl-msg--error';
    setTimeout(function(){ msg.textContent = ''; msg.className = 'nl-msg'; }, 4000);
    return;
  }
  msg.textContent = "You're in — first to know.";
  msg.className   = 'nl-msg nl-msg--success';
  if (input) input.value = '';
  setTimeout(function(){ msg.textContent = ''; msg.className = 'nl-msg'; }, 4000);
}


// ─── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  initFadeIns();
  initFlyerCarousel();
  updateCardCountdowns();
  // Trigger fade for elements already in viewport
  setTimeout(function() {
    document.querySelectorAll(".fade-in").forEach(function(el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight) { el.classList.add("visible"); }
    });
  }, 100);
});
