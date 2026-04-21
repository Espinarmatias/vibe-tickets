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
var checkoutAuthMode = 'signup'; // 'signup' | 'login'  — state for inline checkout auth


// ════════════════════════════════════════════════════════════════
// AUTH SERVICE (fake / localStorage)
// TODO: FASE 7 — replace with Supabase Auth
// ════════════════════════════════════════════════════════════════

var AUTH_STORAGE_KEY = 'vibe_auth_user';

function authCurrentUser() {
  try {
    var raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function authIsLoggedIn() {
  return authCurrentUser() !== null;
}

function authSignup(data) {
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email)) {
    return { success: false, error: 'Please enter a valid email.' };
  }
  if (!data.password || data.password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters.' };
  }
  var user = {
    id: 'u_' + Date.now(),
    email: data.email,
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    secondLastName: data.secondLastName || '',
    phone: data.phone || '',
    fullName: ((data.firstName || '') + ' ' + (data.lastName || '')).trim(),
    emailVerified: false,
    provider: 'email',
    createdAt: new Date().toISOString()
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  return { success: true, user: user };
}

function authLogin(email, password) {
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email) || !password || password.length < 8) {
    return { success: false, error: 'Invalid email or password.' };
  }
  var user = {
    id: 'u_' + Date.now(),
    email: email,
    firstName: email.split('@')[0],
    lastName: '',
    fullName: email.split('@')[0],
    emailVerified: true,
    provider: 'email',
    createdAt: new Date().toISOString()
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  return { success: true, user: user };
}

function authGoogleLogin() {
  // FAKE: simulates Google OAuth with prompts
  // TODO: FASE 7 — replace with real Google OAuth via Supabase
  var simEmail = prompt('[Simulated Google OAuth]\n\nEnter email to simulate Google login:');
  if (!simEmail) return { success: false, error: 'Cancelled' };
  var simName = prompt('[Simulated Google OAuth]\n\nEnter full name:');
  if (!simName) return { success: false, error: 'Cancelled' };
  var parts = simName.trim().split(' ');
  var user = {
    id: 'u_' + Date.now(),
    email: simEmail,
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
    fullName: simName.trim(),
    emailVerified: true,
    provider: 'google',
    createdAt: new Date().toISOString()
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  return { success: true, user: user };
}

function authVerifyEmail() {
  var user = authCurrentUser();
  if (!user) return { success: false };
  user.emailVerified = true;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  return { success: true };
}

function authLogout(skipRedirect) {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  userTickets = [];
  renderAuthState();
  if (!skipRedirect) goPage('home');
}

function renderAuthState() {
  var user = authCurrentUser();
  // Nav desktop LOG IN link
  var navLoginBtn = document.querySelector('.nav-center-link[onclick*="login"]');
  if (navLoginBtn) {
    navLoginBtn.textContent = user ? (user.firstName || user.email.split('@')[0]).toUpperCase() : 'LOG IN';
  }
  // Drawer auth button
  var menuAuthBtn = document.getElementById('menu-auth-btn');
  if (menuAuthBtn) {
    if (user) {
      menuAuthBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Sign Out';
      menuAuthBtn.onclick = function() { closeMenu(); authLogout(); };
    } else {
      menuAuthBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Log In';
      menuAuthBtn.onclick = function() { closeMenu(); goPage('login'); };
    }
  }
  // Drawer user info
  var menuName   = document.getElementById('menu-username');
  var menuEmail  = document.getElementById('menu-useremail');
  var menuAvatar = document.getElementById('menu-avatar');
  if (user) {
    if (menuName)   menuName.textContent  = user.fullName || user.email;
    if (menuEmail)  menuEmail.textContent = user.email;
    if (menuAvatar) menuAvatar.textContent = (user.firstName.charAt(0) + (user.lastName.charAt(0) || '')).toUpperCase() || 'ME';
  } else {
    if (menuName)   menuName.textContent  = 'Guest';
    if (menuEmail)  menuEmail.textContent = 'Sign in to view your tickets';
    if (menuAvatar) menuAvatar.textContent = 'ME';
  }
}

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

  // Auto-fill Attendee 1 with logged-in user data if slot is still empty
  var _authUser = authCurrentUser();
  if (_authUser && attendeeData[0] && !attendeeData[0].name && !attendeeData[0].email) {
    attendeeData[0].name  = _authUser.fullName || ((_authUser.firstName || '') + ' ' + (_authUser.lastName || '')).trim();
    attendeeData[0].email = _authUser.email;
  }

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
  var targetEl = document.getElementById('pg-' + p);

  document.querySelectorAll('.page').forEach(function(x) { x.classList.remove('active'); });

  if (!targetEl) {
    // Unknown page → 404
    var p404 = document.getElementById('pg-404');
    if (p404) p404.classList.add('active');
    var urlPath = document.getElementById('p404-url-path');
    if (urlPath) urlPath.textContent = '/' + p;
    window.scrollTo(0, 0);
    initFadeIns();
    return;
  }

  targetEl.classList.add('active');
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


// ─── CHECKOUT AUTH (inline signup / login) ───────────────────────

function getGoogleLogoSVG() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>' +
    '<path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>' +
    '<path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>' +
    '<path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>' +
  '</svg>';
}

function renderCheckoutAuth() {
  var section = document.getElementById('checkout-auth-section');
  if (!section) return;

  var user = authCurrentUser();

  if (user) {
    // Estado 2: logged in — green badge
    var displayName = escapeHtml(user.fullName || user.firstName || user.email.split('@')[0]);
    var displayEmail = escapeHtml(user.email);
    section.innerHTML =
      '<div class="ca-logged-badge">' +
        '<svg class="ca-logged-check" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<circle cx="12" cy="12" r="10" stroke="#6ab04c" stroke-width="1.5"/>' +
          '<path d="M8 12l3 3 6-6" stroke="#6ab04c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>' +
        '<div class="ca-logged-info">' +
          '<div class="ca-logged-eyebrow">LOGGED IN</div>' +
          '<div class="ca-logged-user">Continue as <strong>' + displayName + '</strong><span class="ca-logged-email"> · ' + displayEmail + '</span></div>' +
        '</div>' +
        '<button type="button" class="ca-logged-switch" onclick="handleCheckoutSwitchUser()">NOT YOU?</button>' +
      '</div>';
    return;
  }

  // Estado 1 (signup) o 3 (login)
  var isSignup = (checkoutAuthMode === 'signup');
  var googleSVG   = getGoogleLogoSVG();
  var googleText  = isSignup ? 'Continue with Google' : 'Sign in with Google';
  var googleBadge = isSignup ? '<span class="ca-google-badge">30 sec</span>' : '';
  var dividerText = isSignup ? 'OR USE EMAIL' : 'OR';

  var headerHTML = isSignup
    ? '<div class="ca-header">' +
        '<div class="ca-eyebrow">CREATE ACCOUNT TO CONTINUE</div>' +
        '<div class="ca-description">Required to send your ticket and access My Tickets. Takes 30 seconds.</div>' +
      '</div>'
    : '<div class="ca-header">' +
        '<div class="ca-eyebrow">LOG IN TO CONTINUE</div>' +
        '<div class="ca-description">Sign in with your existing VIBE account.</div>' +
      '</div>';

  var formFields = isSignup
    ? '<div class="ca-row">' +
        '<div class="ca-field">' +
          '<label class="ca-label" for="ca-first">FIRST NAME</label>' +
          '<input type="text" class="ca-input" id="ca-first" autocomplete="given-name" required />' +
        '</div>' +
        '<div class="ca-field">' +
          '<label class="ca-label" for="ca-last">LAST NAME</label>' +
          '<input type="text" class="ca-input" id="ca-last" autocomplete="family-name" required />' +
        '</div>' +
      '</div>' +
      '<div class="ca-field">' +
        '<label class="ca-label" for="ca-email">EMAIL</label>' +
        '<input type="email" class="ca-input" id="ca-email" placeholder="you@gmail.com" autocomplete="email" required />' +
      '</div>' +
      '<div class="ca-field">' +
        '<label class="ca-label" for="ca-password">PASSWORD</label>' +
        '<input type="password" class="ca-input" id="ca-password" placeholder="At least 8 characters" minlength="8" autocomplete="new-password" required />' +
      '</div>'
    : '<div class="ca-field">' +
        '<label class="ca-label" for="ca-email">EMAIL</label>' +
        '<input type="email" class="ca-input" id="ca-email" placeholder="you@gmail.com" autocomplete="email" required />' +
      '</div>' +
      '<div class="ca-field">' +
        '<label class="ca-label" for="ca-password">PASSWORD</label>' +
        '<input type="password" class="ca-input" id="ca-password" placeholder="Your password" autocomplete="current-password" required />' +
      '</div>';

  var submitHandler = isSignup ? 'handleCheckoutSignup(event)' : 'handleCheckoutLogin(event)';

  var termsHTML = isSignup
    ? 'By creating an account you agree to our <a href="#" class="ca-link" onclick="return false">Terms</a> and <a href="#" class="ca-link" onclick="return false">Privacy Policy</a>. Already have an account? <a href="#" onclick="switchCheckoutAuthMode(\'login\'); return false;" class="ca-link ca-link-strong">Log in</a>'
    : 'Don\'t have an account? <a href="#" onclick="switchCheckoutAuthMode(\'signup\'); return false;" class="ca-link ca-link-strong">Sign up</a>';

  section.innerHTML =
    headerHTML +
    '<div class="ca-card">' +
      '<button type="button" class="ca-google-btn" onclick="handleCheckoutGoogleAuth()">' +
        googleSVG +
        '<span class="ca-google-text">' + googleText + '</span>' +
        googleBadge +
      '</button>' +
      '<div class="ca-divider">' +
        '<span class="ca-divider-line"></span>' +
        '<span class="ca-divider-text">' + dividerText + '</span>' +
        '<span class="ca-divider-line"></span>' +
      '</div>' +
      '<form class="ca-form" onsubmit="' + submitHandler + '">' +
        formFields +
        '<div class="ca-error" id="ca-error"></div>' +
        '<button type="submit" class="ca-submit-btn" style="display:none"></button>' +
      '</form>' +
      '<div class="ca-terms">' + termsHTML + '</div>' +
    '</div>';
}

function switchCheckoutAuthMode(mode) {
  checkoutAuthMode = mode;
  renderCheckoutAuth();
}

function _caShowError(msg) {
  var err = document.getElementById('ca-error');
  if (!err) return;
  err.textContent = msg;
  err.classList.add('ca-error--visible');
}

function _caClearError() {
  var err = document.getElementById('ca-error');
  if (err) err.classList.remove('ca-error--visible');
}

function handleCheckoutSignup(event) {
  event.preventDefault();
  _caClearError();
  var first = document.getElementById('ca-first');
  var last  = document.getElementById('ca-last');
  var email = document.getElementById('ca-email');
  var pass  = document.getElementById('ca-password');
  if (!first || !email || !pass) return;
  var result = authSignup({
    firstName: first.value.trim(),
    lastName:  last ? last.value.trim() : '',
    email:     email.value.trim(),
    password:  pass.value
  });
  if (result.success) { onCheckoutAuthSuccess(); }
  else { _caShowError(result.error); }
}

function handleCheckoutLogin(event) {
  event.preventDefault();
  _caClearError();
  var email = document.getElementById('ca-email');
  var pass  = document.getElementById('ca-password');
  if (!email || !pass) return;
  var result = authLogin(email.value.trim(), pass.value);
  if (result.success) { onCheckoutAuthSuccess(); }
  else { _caShowError(result.error); }
}

function handleCheckoutGoogleAuth() {
  var result = authGoogleLogin();
  if (result.success) { onCheckoutAuthSuccess(); }
}

function onCheckoutAuthSuccess() {
  var user = authCurrentUser();
  if (!user) return;

  // Auto-fill Attendee 1 if still empty
  if (attendeeData[0] && !attendeeData[0].name && !attendeeData[0].email) {
    attendeeData[0].name  = user.fullName || ((user.firstName || '') + ' ' + (user.lastName || '')).trim();
    attendeeData[0].email = user.email;
  }

  renderAttendeeFields();      // re-render with pre-filled data
  renderCheckoutAuth();        // swap to green badge (Estado 2)
  renderAuthState();           // sync nav link text

  if (typeof validateAttendees === 'function') validateAttendees();

  // Smooth scroll to payment method after short delay
  setTimeout(function() {
    var paySection = document.querySelector('.pay-opts-list') || document.querySelector('.edv2-section-hdr');
    if (paySection) paySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 400);
}

function handleCheckoutSwitchUser() {
  if (!confirm('Log out and switch to a different account?')) return;
  authLogout(true);        // skipRedirect — stay on checkout page
  checkoutAuthMode = 'signup';
  renderCheckoutAuth();
  renderAuthState();
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
  checkoutAuthMode = 'signup';
  renderCheckoutAuth();
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
  if (!authIsLoggedIn()) {
    // Scroll to inline auth section + pulse — don't abandon checkout
    var authSec = document.getElementById('checkout-auth-section');
    if (authSec) {
      authSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
      authSec.style.animation = 'none';
      setTimeout(function() { authSec.style.animation = 'ca-pulse .6s ease'; }, 10);
    }
    return;
  }
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

// ─── EMAIL VERIFICATION BANNER ───────────────────────────────────
function renderVerifyBanner() {
  var banner = document.getElementById('verify-banner');
  if (!banner) return;
  var user = authCurrentUser();
  if (!user || user.emailVerified) {
    banner.classList.remove('verify-banner--visible');
    return;
  }
  // Unverified — show yellow banner
  var emailSpan = document.getElementById('verify-banner-email');
  if (emailSpan) emailSpan.textContent = user.email;
  var title   = document.getElementById('verify-banner-title');
  var desc    = document.getElementById('verify-banner-desc');
  var actions = document.getElementById('verify-banner-actions');
  if (title)   title.textContent = 'Verify your email to unlock full access';
  if (desc)    desc.innerHTML    = 'We sent a confirmation link to <span id="verify-banner-email">' + escapeHtml(user.email) + '</span>';
  if (actions) actions.style.display = 'flex';
  banner.classList.remove('verify-banner--success', 'verify-banner--fading');
  banner.classList.add('verify-banner--visible');
}

function handleResendVerification() {
  alert('[Simulated] Verification email resent. FASE 7 will integrate real email flow via Resend.');
}

function handleMarkVerified() {
  var result = authVerifyEmail();
  if (!result.success) return;
  var banner = document.getElementById('verify-banner');
  if (!banner) return;
  // Swap icon to checkmark
  var icon = banner.querySelector('.verify-banner-icon');
  if (icon) {
    icon.innerHTML = '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M8 12l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
  }
  // Change to success state
  banner.classList.add('verify-banner--success');
  var title   = document.getElementById('verify-banner-title');
  var desc    = document.getElementById('verify-banner-desc');
  var actions = document.getElementById('verify-banner-actions');
  if (title)   title.textContent = 'Email verified';
  if (desc)    desc.textContent  = 'You now have full access to My Tickets and future purchases';
  if (actions) actions.style.display = 'none';
  // Fade out after 3s
  setTimeout(function() {
    banner.classList.add('verify-banner--fading');
    setTimeout(function() {
      banner.classList.remove('verify-banner--visible', 'verify-banner--success', 'verify-banner--fading');
    }, 300);
  }, 3000);
  renderAuthState();
}


function renderMyTickets() {
  renderVerifyBanner();
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
function openMenu() {
  if (window.innerWidth > 960) return; // desktop: drawer is hidden, do nothing
  var drawer   = document.getElementById('mobile-drawer');
  var backdrop = document.getElementById('mobile-drawer-backdrop');
  if (drawer)   { drawer.classList.add('open');   drawer.removeAttribute('aria-hidden'); }
  if (backdrop) backdrop.classList.add('open');
  document.body.classList.add('drawer-open');
  renderMobileDrawer();
}

function closeMenu() {
  var drawer   = document.getElementById('mobile-drawer');
  var backdrop = document.getElementById('mobile-drawer-backdrop');
  if (drawer)   { drawer.classList.remove('open');  drawer.setAttribute('aria-hidden', 'true'); }
  if (backdrop) backdrop.classList.remove('open');
  document.body.classList.remove('drawer-open');
}

function renderMobileDrawer() {
  var user        = authCurrentUser();
  var userSection = document.getElementById('md-user-section');
  var nav         = document.getElementById('md-nav');
  var footer      = document.getElementById('md-footer');
  if (!userSection || !nav || !footer) return;

  // User section
  if (user) {
    var initial = (user.firstName || user.email || 'U').charAt(0).toUpperCase();
    userSection.innerHTML =
      '<div class="md-user-card">' +
        '<div class="md-user-avatar">' + initial + '</div>' +
        '<div class="md-user-info">' +
          '<div class="md-user-name">' + escapeHtml(user.fullName || user.firstName || 'User') + '</div>' +
          '<div class="md-user-email">' + escapeHtml(user.email) + '</div>' +
        '</div>' +
      '</div>';
  } else {
    userSection.innerHTML =
      '<div class="md-auth-prompt">' +
        '<button class="md-auth-prompt-btn" onclick="closeMenu(); goPage(\'login\');">LOG IN</button>' +
        '<button class="md-auth-prompt-btn md-auth-prompt-btn-secondary" onclick="closeMenu(); goPage(\'login\');">CREATE ACCOUNT</button>' +
      '</div>';
  }

  // Nav sections
  var ticketCount = userTickets.length;
  var ticketBadge = ticketCount > 0 ? '<span class="md-link-badge">' + ticketCount + '</span>' : '';

  nav.innerHTML =
    '<div class="md-section">' +
      '<div class="md-section-eyebrow">DISCOVER</div>' +
      '<button class="md-link" onclick="closeMenu(); goPage(\'home\');">' +
        '<span class="md-link-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg></span>' +
        '<span class="md-link-text">Browse Events</span>' +
      '</button>' +
      '<button class="md-link" onclick="closeMenu(); goPage(\'home\');">' +
        '<span class="md-link-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg></span>' +
        '<span class="md-link-text">Upcoming</span>' +
      '</button>' +
    '</div>' +

    (user ?
    '<div class="md-section">' +
      '<div class="md-section-eyebrow">YOUR ACCOUNT</div>' +
      '<button class="md-link" onclick="closeMenu(); goPage(\'my-tickets\');">' +
        '<span class="md-link-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><circle cx="12" cy="14" r="2"/></svg></span>' +
        '<span class="md-link-text">My Tickets</span>' +
        ticketBadge +
      '</button>' +
      '<button class="md-link" onclick="closeMenu(); goPage(\'account\');">' +
        '<span class="md-link-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 22c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg></span>' +
        '<span class="md-link-text">Account</span>' +
      '</button>' +
    '</div>'
    : '') +

    '<div class="md-section">' +
      '<div class="md-section-eyebrow">ORGANIZERS</div>' +
      '<button class="md-link" onclick="closeMenu(); goPage(\'organizer\');">' +
        '<span class="md-link-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14M5 12h14"/></svg></span>' +
        '<span class="md-link-text">List Your Event</span>' +
      '</button>' +
    '</div>';

  // Footer
  var logoutBtn = user
    ? '<button class="md-logout" onclick="handleMobileLogout()">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 17l5-5-5-5M21 12H9M12 21H5a2 2 0 01-2-2V5a2 2 0 012-2h7"/></svg>' +
        '<span>Log out</span>' +
      '</button>'
    : '';

  footer.innerHTML =
    '<button class="md-cta-btn" onclick="closeMenu(); goPage(\'home\');">BUY TICKETS</button>' +
    logoutBtn;
}

function handleMobileLogout() {
  closeMenu();
  authLogout();
}


// ─── LOGIN / AUTH HANDLERS ────────────────────────────────────────
function toggleLoginMode() {
  loginIsRegister = !loginIsRegister;
  var regFields = document.getElementById('login-register-fields');
  if (regFields) regFields.style.display = loginIsRegister ? 'block' : 'none';
  var el = function(id) { return document.getElementById(id); };
  if (el('login-mode-title'))   el('login-mode-title').textContent   = loginIsRegister ? 'Create account' : 'Sign in';
  if (el('login-mode-sub'))     el('login-mode-sub').textContent     = loginIsRegister ? 'JOIN THE VIBE. COMMUNITY' : 'WELCOME BACK';
  if (el('login-submit-btn'))   el('login-submit-btn').textContent   = loginIsRegister ? 'CREATE ACCOUNT' : 'SIGN IN';
  if (el('login-divider-text')) el('login-divider-text').textContent = loginIsRegister ? 'already have an account' : 'don\'t have an account';
  if (el('login-toggle-btn'))   el('login-toggle-btn').textContent   = loginIsRegister ? 'Sign in' : 'Create new account';
  var errDiv = el('login-error-msg');
  if (errDiv) { errDiv.textContent = ''; errDiv.style.display = 'none'; }
  var forgot = el('login-forgot-wrap');
  if (forgot) forgot.style.display = loginIsRegister ? 'none' : 'block';
}

function submitLogin() {
  var email = (document.getElementById('login-email').value || '').trim();
  var password = document.getElementById('login-password').value || '';
  var errDiv = document.getElementById('login-error-msg');
  function showErr(msg) {
    if (errDiv) { errDiv.textContent = msg; errDiv.style.display = 'block'; }
    else { alert(msg); }
  }
  if (errDiv) errDiv.style.display = 'none';

  if (loginIsRegister) {
    var result = authSignup({
      email: email,
      password: password,
      firstName: (document.getElementById('reg-firstname').value || '').trim(),
      lastName:  (document.getElementById('reg-lastname1').value || '').trim(),
      secondLastName: (document.getElementById('reg-lastname2').value || '').trim(),
      phone:     (document.getElementById('reg-phone').value || '').trim()
    });
    if (!result.success) { showErr(result.error); return; }
  } else {
    var result = authLogin(email, password);
    if (!result.success) { showErr(result.error); return; }
  }
  renderAuthState();
  goPage('home');
}

function handleGoogleAuth() {
  var result = authGoogleLogin();
  if (result.success) { renderAuthState(); goPage('home'); }
}

function handleForgotPassword(event) {
  event.preventDefault();
  alert('[Simulated] Password reset flow — FASE 7 integrates real email reset via Supabase.');
}

document.addEventListener('DOMContentLoaded', renderAuthState);


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
