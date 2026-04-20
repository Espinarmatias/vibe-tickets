// ════════════════════════════════════════════════════════════════
//  VIBE. — APP.JS
//  Public site logic. Depends on config.js (loaded first in <head>).
// ════════════════════════════════════════════════════════════════

// ─── STATE ───────────────────────────────────────────────────────
var tickets        = [];
var currentEvent   = "rawdeo";
var qty            = 1;
var payM           = "card";
var currentTier    = null;
var discountApplied = false;
var discountPct    = 0;
var loginIsRegister = true;


// ─── PAGES ───────────────────────────────────────────────────────
function goPage(p) {
  document.querySelectorAll(".page").forEach(function(x){ x.classList.remove("active"); });
  document.getElementById("pg-" + p).classList.add("active");
  window.scrollTo(0, 0);
  initFadeIns();
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
  goPage("event-detail");
  renderTiers();
  updWidget();
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
  document.querySelectorAll(".tier-option").forEach(function(el){
    el.classList.toggle("selected", el.dataset.tierId === tierId);
  });
  var priceEl = document.getElementById("ed-price");
  var noteEl  = document.getElementById("ed-price-note");
  if (priceEl) priceEl.textContent = tier.price === 0 ? "Free" : "$" + tier.price;
  if (noteEl)  noteEl.textContent  = tier.price === 0 ? "Complimentary" : "per ticket · incl. service fee";
  updTotals();
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
  var t    = qty * price;
  var tc   = qty * priceCRC;
  var disp = payM === "sinpe"
    ? "₡" + Math.round(tc).toLocaleString()
    : (price === 0 ? "Free" : "$" + t.toFixed(2).replace(/\.00$/, ''));
  var lbl = qty + " ticket" + (qty > 1 ? "s" : "");
  var sinpeAmt = document.getElementById("sinpe-amt");
  if (sinpeAmt) sinpeAmt.textContent = "📲 ₡" + tc.toLocaleString() + " → " + VIBE_CONFIG.sinpeNumber;
  var totalEl = document.getElementById("ed-total");
  if (totalEl) totalEl.textContent = disp;
  var lblEl = document.getElementById("ed-qty-label");
  if (lblEl) lblEl.textContent = lbl;
}

function renderTiers() {
  var ev = EVENTS[currentEvent];
  var container = document.getElementById("tier-selector");
  if (!container) return;
  if (!ev.tiers || ev.tiers.length === 0) { container.innerHTML = ""; return; }
  container.innerHTML = ev.tiers
    .filter(function(t){ return !(t.price === 0 && t.id && t.id.indexOf('cortesia') !== -1); })
    .map(function(t) {
      var avail      = t.capacity - t.sold;
      var availText  = t.soldout || avail <= 0 ? "Sold out" : "Available";
      var availColor = t.soldout || avail <= 0 ? "#ff4444" : (avail <= 20 ? "#ffb800" : "var(--gray)");
      var priceText  = t.price === 0
        ? "<span style='color:var(--gray);font-size:14px'>Gratis</span>"
        : "<span style='color:var(--green)'>" + (t.soldout || avail <= 0 ? "<span style='color:#ff4444'>$" + t.price + "</span>" : "$" + t.price) + "</span>";
      return '<div class="tier-option' + (t.soldout || avail <= 0 ? " soldout" : "") + '" data-tier-id="' + t.id + '" onclick="selectTier(\'' + t.id + '\')">'
        + '<div class="tier-left">'
        + '<div class="tier-dot" style="background:' + t.color + '"></div>'
        + '<div><div class="tier-name">' + t.name + '</div>'
        + '<div class="tier-cap" style="color:' + availColor + '">' + availText + '</div></div>'
        + '</div>'
        + (t.soldout || avail <= 0 ? '<span class="tier-soldout-badge">SOLD OUT</span>' : '<div class="tier-price">' + priceText + '</div>')
        + '</div>';
    }).join("");
  var firstAvail = ev.tiers.find(function(t){ return !t.soldout && (t.capacity - t.sold) > 0; });
  if (firstAvail) selectTier(firstAvail.id);
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
}


// ─── PAYMENT METHOD ───────────────────────────────────────────────
function selPay(m, el) {
  payM = m;
  document.querySelectorAll(".pay-opt").forEach(function(o){ o.classList.remove("on"); });
  el.classList.add("on");
  document.querySelectorAll(".pay-panel").forEach(function(p){ p.classList.remove("show"); });
  document.getElementById("pp-" + m).classList.add("show");
  updTotals();
}


// ─── PAY ──────────────────────────────────────────────────────────
function doPay() {
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

    document.getElementById("suc-event-name").textContent = ev.name;
    document.getElementById("suc-ev-name").textContent    = ev.name;
    document.getElementById("suc-date").textContent       = ev.date;
    document.getElementById("suc-place").textContent      = ev.place;
    document.getElementById("suc-qty").textContent        = qty + " ticket" + (qty > 1 ? "s" : "") + " · " + tierName;
    document.getElementById("suc-total").textContent      = totalStr;
    document.getElementById("suc-code").textContent       = code;

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

    var walletSection = document.getElementById("apple-wallet-section");
    if (walletSection) walletSection.style.display = "block";

    btn.textContent = "🔒 Complete purchase";
    btn.disabled = false;
    document.getElementById("success-overlay").classList.add("show");
  }, 1800);
}

function closeSuccess() {
  var ov = document.getElementById("success-overlay");
  if (ov) ov.classList.remove("show");
}

function addToAppleWallet() {
  alert("Apple Wallet\n\nIn the production version with Onvo Tix, your ticket downloads as a .pkpass file that is automatically added to your Apple Wallet.\n\nFor now, your ticket arrives by email with the QR code.");
}


// ─── MY TICKETS ───────────────────────────────────────────────────
function renderTickets() {
  var c = document.getElementById("mt-content");
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
    html += '<button onclick="addToAppleWallet()" style="margin-top:12px;width:100%;background:#000;border:none;border-radius:10px;padding:11px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;"><svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg><span style="color:white;font-family:\'Barlow\',sans-serif;font-size:13px;font-weight:500;">Add to Apple Wallet</span></button>';
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
