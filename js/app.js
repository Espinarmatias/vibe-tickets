// ════════════════════════════════════════════════════════════════
//  VIBE. — APP.JS
//  Public site logic. Depends on config.js (loaded first in <head>).
// ════════════════════════════════════════════════════════════════

// ─── STATE ───────────────────────────────────────────────────────
var USER_TICKETS_KEY = 'vibe_user_tickets';
var userTickets = (function(){
  try {
    var raw = localStorage.getItem(USER_TICKETS_KEY);
    var parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
})();
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
  return authProviderLogin('google');
}

function authAppleLogin() {
  return authProviderLogin('apple');
}

function authProviderLogin(provider) {
  // FAKE: simulates provider OAuth with prompts
  // TODO: FASE 7 — replace with real OAuth via Supabase
  var label = provider === 'apple' ? 'Apple' : 'Google';
  var simEmail = prompt('[Simulated ' + label + ' OAuth]\n\nEnter email to simulate ' + label + ' login:');
  if (!simEmail) return { success: false, error: 'Cancelled' };
  var simName = prompt('[Simulated ' + label + ' OAuth]\n\nEnter full name:');
  if (!simName) return { success: false, error: 'Cancelled' };
  var parts = simName.trim().split(' ');
  var user = {
    id: 'u_' + Date.now(),
    email: simEmail,
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
    fullName: simName.trim(),
    emailVerified: true,
    provider: provider,
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
  localStorage.removeItem(USER_TICKETS_KEY);
  userTickets = [];
  var badge = document.getElementById('menu-ticket-badge');
  if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }
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

  // Sync attendeeData length to qty (preserve existing entries)
  while (attendeeData.length < qty)  { attendeeData.push({ name: '', email: '' }); }
  while (attendeeData.length > qty)  { attendeeData.pop(); }

  // Buyer (attendeeData[0]) is populated by the auth section, not here.
  // If the user is logged in and slot 0 is empty, pre-fill from session.
  var _authUser = authCurrentUser();
  if (_authUser && attendeeData[0] && !attendeeData[0].name) {
    attendeeData[0].name  = _authUser.fullName || ((_authUser.firstName || '') + ' ' + (_authUser.lastName || '')).trim();
    attendeeData[0].email = _authUser.email;
  }

  // Only render "OTHER ATTENDEES" when qty >= 2
  if (qty < 2) { list.innerHTML = ''; validateAttendees(); return; }

  var tierName = currentTier ? currentTier.name : 'GENERAL';
  var html =
    '<div class="attendee-extra-header">' +
      '<div class="attendee-extra-eyebrow">OTHER ATTENDEES</div>' +
      '<div class="attendee-extra-desc">Each ticket needs a name. We\u2019ll send all QRs to your email above.</div>' +
    '</div>';

  for (var i = 1; i < qty; i++) {
    var a = attendeeData[i] || { name: '' };
    var parts = (a.name || '').split(' ');
    var first = parts[0] || '';
    var last  = parts.slice(1).join(' ');
    html +=
      '<div class="attendee-ticket">' +
        '<div class="attendee-ticket-header">' +
          '<div class="attendee-ticket-label">TICKET ' + (i + 1) + ' \u00b7 ' + tierName + '</div>' +
        '</div>' +
        '<div class="attendee-fields attendee-fields--split">' +
          '<div>' +
            '<label class="attendee-field-label" for="att-first-' + i + '">FIRST NAME</label>' +
            '<input type="text" class="attendee-input" id="att-first-' + i + '" ' +
                   'value="' + escapeHtml(first) + '" placeholder="First name" ' +
                   'autocomplete="given-name" ' +
                   'oninput="updateAttendeeName(' + i + ')" ' +
                   'onblur="onAttendeeBlur()"/>' +
          '</div>' +
          '<div>' +
            '<label class="attendee-field-label" for="att-last-' + i + '">LAST NAME</label>' +
            '<input type="text" class="attendee-input" id="att-last-' + i + '" ' +
                   'value="' + escapeHtml(last) + '" placeholder="Last name" ' +
                   'autocomplete="family-name" ' +
                   'oninput="updateAttendeeName(' + i + ')" ' +
                   'onblur="onAttendeeBlur()"/>' +
          '</div>' +
        '</div>' +
      '</div>';
  }
  list.innerHTML = html;
  validateAttendees();
}

function updateAttendeeName(index) {
  var f = document.getElementById('att-first-' + index);
  var l = document.getElementById('att-last-' + index);
  if (!attendeeData[index]) attendeeData[index] = { name: '', email: '' };
  attendeeData[index].name = ((f ? f.value.trim() : '') + ' ' + (l ? l.value.trim() : '')).trim();
  validateAttendees();
}

function updateBuyerField(field, value) {
  if (!attendeeData[0]) attendeeData[0] = { name: '', email: '' };
  if (field === 'email') {
    attendeeData[0].email = value.trim();
  } else {
    // first / last → recompose full name
    var firstEl = document.getElementById('ca-first');
    var lastEl  = document.getElementById('ca-last');
    attendeeData[0].name = ((firstEl ? firstEl.value.trim() : '') + ' ' + (lastEl ? lastEl.value.trim() : '')).trim();
  }
  validateAttendees();
}

function validateAttendees() {
  var emailRe  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var allValid = true;
  var user = authCurrentUser();

  var buyer = attendeeData[0] || { name: '', email: '' };
  var buyerEmail = user ? user.email : buyer.email;
  var buyerName  = user ? (user.fullName || ((user.firstName || '') + ' ' + (user.lastName || '')).trim()) : buyer.name;
  if (!buyerEmail || !emailRe.test(buyerEmail) || !buyerName) allValid = false;

  // Terms checkbox (only required when not yet logged in)
  if (!user) {
    var terms = document.getElementById('ca-terms-check');
    if (!terms || !terms.checked) allValid = false;
  }

  if (allValid) {
    for (var i = 1; i < qty; i++) {
      var a = attendeeData[i] || { name: '' };
      if (!a.name) { allValid = false; break; }
    }
  }

  var warning = document.getElementById('attendee-warning');
  if (warning) {
    if (attendeeValidationTriggered && !allValid) {
      warning.classList.add('attendee-warning--visible');
    } else {
      warning.classList.remove('attendee-warning--visible');
    }
  }

  return allValid;
}

function onAttendeeBlur() {
  for (var i = 1; i < qty; i++) {
    var a = attendeeData[i] || { name: '' };
    if (!a.name) { attendeeValidationTriggered = true; break; }
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


// ─── NAV SCROLL (hide on down, show on up) ───────────────────────
(function() {
  var nav = document.getElementById("main-nav");
  if (!nav) return;
  // Prevent browser scroll-restoration from triggering hide on reload
  if (history.scrollRestoration) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);
  var lastScrollY = 0;
  var ticking = false;
  var THRESHOLD = 10;

  window.addEventListener("scroll", function() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function() {
      var current = window.scrollY;
      if (current < 50) {
        nav.classList.remove("nav-hidden");
      } else if (current > lastScrollY + THRESHOLD) {
        nav.classList.add("nav-hidden");
      } else if (current < lastScrollY - THRESHOLD) {
        nav.classList.remove("nav-hidden");
      }
      lastScrollY = current;
      ticking = false;
    });
  }, { passive: true });
})();


// ─── EVENT FILTER (home search bar) ──────────────────────────────
// Category filter removed — kept as no-op in case of stale onclick handlers.
// function filterCat(el) {
//   document.querySelectorAll(".cat").forEach(function(c){ c.classList.remove("on"); });
//   el.classList.add("on");
// }

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
    var displayEmail = escapeHtml(user.email);
    section.innerHTML =
      '<div class="ca-buying-as">' +
        '<div class="ca-buying-info">' +
          '<span class="ca-buying-label">Buying as</span>' +
          '<span class="ca-buying-email">' + displayEmail + '</span>' +
        '</div>' +
        '<button type="button" class="ca-buying-edit" onclick="handleCheckoutSwitchUser()">Not you?</button>' +
      '</div>';
    return;
  }

  var buyer = attendeeData[0] || { name: '', email: '' };
  var parts = (buyer.name || '').split(' ');
  var firstVal = escapeHtml(parts[0] || '');
  var lastVal  = escapeHtml(parts.slice(1).join(' '));
  var emailVal = escapeHtml(buyer.email || '');

  var googleSVG = getGoogleLogoSVG();
  var appleSVG  = '<svg class="apple-logo" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.41-1.09-.47-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.41C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>';

  section.innerHTML =
    '<div class="ca-header">' +
      '<div class="ca-eyebrow">YOUR INFORMATION</div>' +
      '<div class="ca-description">We\u2019ll send your ticket QR to this email.</div>' +
    '</div>' +
    '<div class="ca-card">' +
      '<div class="ca-oauth-row">' +
        '<button type="button" class="ca-google-btn" onclick="handleCheckoutGoogleAuth()">' +
          googleSVG +
          '<span class="ca-google-text">Continue with Google</span>' +
        '</button>' +
        '<button type="button" class="ca-apple-btn" onclick="handleCheckoutAppleAuth()" aria-label="Continue with Apple">' +
          appleSVG +
          '<span class="ca-apple-text">Continue with Apple</span>' +
        '</button>' +
      '</div>' +
      '<div class="ca-divider">' +
        '<span class="ca-divider-line"></span>' +
        '<span class="ca-divider-text">OR USE EMAIL</span>' +
        '<span class="ca-divider-line"></span>' +
      '</div>' +
      '<div class="ca-form">' +
        '<div class="ca-field">' +
          '<label class="ca-label" for="ca-email">EMAIL</label>' +
          '<input type="email" class="ca-input" id="ca-email" placeholder="your@email.com" autocomplete="email" ' +
                 'value="' + emailVal + '" ' +
                 'oninput="updateBuyerField(\'email\', this.value)" onblur="onAttendeeBlur()" />' +
        '</div>' +
        '<div class="ca-row">' +
          '<div class="ca-field">' +
            '<label class="ca-label" for="ca-first">FIRST NAME</label>' +
            '<input type="text" class="ca-input" id="ca-first" placeholder="First name" autocomplete="given-name" ' +
                   'value="' + firstVal + '" ' +
                   'oninput="updateBuyerField(\'first\', this.value)" onblur="onAttendeeBlur()" />' +
          '</div>' +
          '<div class="ca-field">' +
            '<label class="ca-label" for="ca-last">LAST NAME</label>' +
            '<input type="text" class="ca-input" id="ca-last" placeholder="Last name" autocomplete="family-name" ' +
                   'value="' + lastVal + '" ' +
                   'oninput="updateBuyerField(\'last\', this.value)" onblur="onAttendeeBlur()" />' +
          '</div>' +
        '</div>' +
        '<label class="ca-terms-check-row">' +
          '<input type="checkbox" id="ca-terms-check" onchange="validateAttendees()"/>' +
          '<span>I agree to the <a href="#" class="ca-link" onclick="return false">Terms</a> and <a href="#" class="ca-link" onclick="return false">Privacy Policy</a>.</span>' +
        '</label>' +
        '<div class="ca-error" id="ca-error"></div>' +
      '</div>' +
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

function handleCheckoutAppleAuth() {
  var result = authAppleLogin();
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
  if (typeof updateDrawerCTA === 'function') updateDrawerCTA();
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
  var btn = document.getElementById("cd-cta") || document.getElementById("ed-buy-btn");
  if (!btn) return;
  var originalLabel = btn.textContent;
  btn.textContent = "PROCESSING…";
  btn.disabled = true;
  btn.classList.add("cd-cta--processing");
  setTimeout(function() {
    var ev   = EVENTS[currentEvent];
    var tier = currentTier || (ev.tiers ? ev.tiers.find(function(t){ return !t.soldout && (t.capacity - t.sold) > 0; }) || ev.tiers[0] : ev);
    var priceCRC = tier.priceCRC !== undefined ? tier.priceCRC : ev.priceCRC;
    var code     = "VB-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    var tierName = tier.name || "General";

    addPurchaseToUserTickets();

    var badge = document.getElementById("menu-ticket-badge");
    if (badge) {
      badge.textContent = userTickets.length;
      badge.style.display = userTickets.length ? "inline-flex" : "none";
    }

    btn.textContent = originalLabel;
    btn.disabled = false;
    btn.classList.remove("cd-cta--processing");

    closeCheckoutDrawer(true);
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
  }, 1400);
}

function closeConfirm() {
  var screen = document.getElementById('confirm-screen');
  if (screen) screen.classList.remove('open');
  document.body.classList.remove('drawer-open');
  document.documentElement.style.removeProperty('--drawer-scroll-top');
  if (typeof _cdSavedScrollY === 'number') {
    window.scrollTo(0, _cdSavedScrollY);
    _cdSavedScrollY = null;
  }
  goPage('home');
}

function addPurchaseToUserTickets() {
  var ev = EVENTS[currentEvent];
  var eventImage = ev.isMansita ? MANSITA_B64 : RAWDEO_B64;
  var buyer = attendeeData[0] || { name: 'Guest', email: '' };
  var buyerEmail = buyer.email || (authCurrentUser() && authCurrentUser().email) || '';
  for (var i = 0; i < qty; i++) {
    var a = attendeeData[i] || { name: '' };
    var name = (i === 0) ? (buyer.name || 'Guest') : (a.name || buyer.name || 'Guest');
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
      attendeeName: name,
      attendeeEmail: buyerEmail,
      priceCRC: currentTier ? currentTier.priceCRC : 0,
      purchasedAt: new Date().toISOString()
    });
  }
  attendeeData = [];
  try { localStorage.setItem(USER_TICKETS_KEY, JSON.stringify(userTickets)); } catch (e) {}
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

  var setText = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
  setText('confirm-event-name', data.name);
  setText('confirm-event-date', data.date);
  setText('confirm-event-venue', data.venue);
  setText('confirm-subtitle-event', data.name);
  setText('confirm-qr-order', 'Order ' + (data.ticketId || ''));

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
  if (typeof _cdSavedScrollY !== 'number') {
    _cdSavedScrollY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.style.setProperty('--drawer-scroll-top', '-' + _cdSavedScrollY + 'px');
  }
  document.body.classList.add('drawer-open');
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
    // DISCOVER
    '<div class="md-section">' +
      '<div class="md-section-eyebrow">DISCOVER</div>' +
      '<button class="md-link" onclick="closeMenu(); goPage(\'home\');">' +
        '<span class="md-link-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>' +
        '<span class="md-link-text">Browse Events</span>' +
      '</button>' +
      '<button class="md-link" onclick="closeMenu(); goPage(\'home\');">' +
        '<span class="md-link-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg></span>' +
        '<span class="md-link-text">Upcoming</span>' +
      '</button>' +
      '<button class="md-link" onclick="closeMenu(); goPage(\'memberships\');">' +
        '<span class="md-link-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>' +
        '<span class="md-link-text">Memberships</span>' +
      '</button>' +
    '</div>' +

    // YOUR ACCOUNT (only if logged in)
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

    // ORGANIZERS
    '<div class="md-section">' +
      '<div class="md-section-eyebrow">ORGANIZERS</div>' +
      '<button class="md-link" onclick="closeMenu(); goPage(\'organizer\');">' +
        '<span class="md-link-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14M5 12h14"/></svg></span>' +
        '<span class="md-link-text">List Your Event</span>' +
      '</button>' +
    '</div>' +

    // SUPPORT
    '<div class="md-section">' +
      '<div class="md-section-eyebrow">SUPPORT</div>' +
      '<button class="md-link" onclick="closeMenu(); openSupportWidget();">' +
        '<span class="md-link-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 14v-3a9 9 0 0118 0v3"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z"/></svg></span>' +
        '<span class="md-link-text">Customer Support</span>' +
      '</button>' +
      '<button class="md-link" onclick="closeMenu(); goPage(\'faq\');">' +
        '<span class="md-link-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01"/></svg></span>' +
        '<span class="md-link-text">FAQ</span>' +
      '</button>' +
    '</div>' +

    // LEGAL
    '<div class="md-section">' +
      '<div class="md-section-eyebrow">LEGAL</div>' +
      '<button class="md-link" onclick="closeMenu(); goPage(\'terms\');">' +
        '<span class="md-link-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>' +
        '<span class="md-link-text">Terms &amp; Conditions</span>' +
      '</button>' +
      '<button class="md-link" onclick="closeMenu(); goPage(\'privacy\');">' +
        '<span class="md-link-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></span>' +
        '<span class="md-link-text">Privacy Policy</span>' +
      '</button>' +
    '</div>';

  // Footer — only show if logged in (log out button); no BUY TICKETS
  var logoutBtn = user
    ? '<button class="md-logout" onclick="handleMobileLogout()">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 17l5-5-5-5M21 12H9M12 21H5a2 2 0 01-2-2V5a2 2 0 012-2h7"/></svg>' +
        '<span>Log out</span>' +
      '</button>'
    : '';

  if (logoutBtn) {
    footer.style.display = '';
    footer.innerHTML = logoutBtn;
  } else {
    footer.style.display = 'none';
  }
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

function handleAppleAuth() {
  var result = authAppleLogin();
  if (result.success) { renderAuthState(); goPage('home'); }
}

function handleForgotPassword(event) {
  event.preventDefault();
  alert('[Simulated] Password reset flow — FASE 7 integrates real email reset via Supabase.');
}

document.addEventListener('DOMContentLoaded', renderAuthState);


// ─── SUPPORT WIDGET ───────────────────────────────────────────────
var supportWidgetView = 'ai'; // 'ai' | 'human'

function openSupportWidget() {
  var w = document.getElementById('support-widget');
  if (!w) return;
  renderSupportWidget();
  requestAnimationFrame(function() { w.classList.add('open'); });
  document.addEventListener('keydown', _swEscHandler);
}

function closeSupportWidget() {
  var w = document.getElementById('support-widget');
  if (!w) return;
  w.classList.remove('open');
  document.removeEventListener('keydown', _swEscHandler);
}

function _swEscHandler(e) {
  if (e.key === 'Escape') closeSupportWidget();
}

function switchSupportView(view) {
  supportWidgetView = view;
  renderSupportWidget();
}

function renderSupportWidget() {
  var inner = document.getElementById('sw-inner');
  if (!inner) return;
  var html =
    '<div class="sw-header">' +
      '<div class="sw-header-left">' +
        '<div class="sw-status-dot"></div>' +
        '<span class="sw-header-title">VIBE. Support</span>' +
      '</div>' +
      '<div class="sw-header-tabs">' +
        '<button class="sw-tab' + (supportWidgetView === 'ai' ? ' active' : '') + '" onclick="switchSupportView(\'ai\')">AI Chat</button>' +
        '<button class="sw-tab' + (supportWidgetView === 'human' ? ' active' : '') + '" onclick="switchSupportView(\'human\')">Human</button>' +
      '</div>' +
      '<button class="sw-close-btn" onclick="closeSupportWidget()" aria-label="Close">✕</button>' +
    '</div>' +
    '<div class="sw-body">' +
      (supportWidgetView === 'ai' ? renderSupportAIView() : renderSupportHumanView()) +
    '</div>';
  inner.innerHTML = html;
  // auto-focus input in AI view
  if (supportWidgetView === 'ai') {
    var inp = document.getElementById('sw-input');
    if (inp) setTimeout(function() { inp.focus(); }, 80);
  }
}

function renderSupportAIView() {
  return (
    '<div class="sw-chat-body" id="sw-chat-body">' +
      '<div class="sw-msg sw-msg-bot">' +
        '<div class="sw-msg-bubble">Hi! I\'m VIBE. Assistant. How can I help you today?</div>' +
      '</div>' +
    '</div>' +
    '<div class="sw-quick-actions">' +
      '<button class="sw-quick-btn" onclick="handleQuickAction(\'qr\')">Didn\'t get my QR</button>' +
      '<button class="sw-quick-btn" onclick="handleQuickAction(\'payment\')">Payment issue</button>' +
      '<button class="sw-quick-btn" onclick="handleQuickAction(\'cancel\')">Cancel purchase</button>' +
      '<button class="sw-quick-btn" onclick="handleQuickAction(\'event\')">Event info</button>' +
    '</div>' +
    '<div class="sw-input-bar">' +
      '<input id="sw-input" class="sw-input" type="text" placeholder="Type your question…" onkeydown="if(event.key===\'Enter\')sendSupportMessage()">' +
      '<button class="sw-send-btn" onclick="sendSupportMessage()" aria-label="Send">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
      '</button>' +
    '</div>'
  );
}

function renderSupportHumanView() {
  return (
    '<div class="sw-human-body">' +
      '<p class="sw-human-intro">Reach a real person on your preferred channel. Average response time: <strong>under 2 hours</strong>.</p>' +
      '<div class="sw-contact-card" onclick="window.open(\'https://wa.me/50688888888\',\'_blank\')">' +
        '<div class="sw-contact-icon sw-contact-icon--whatsapp">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.558 4.116 1.535 5.845L.057 23.522a.75.75 0 0 0 .92.92l5.733-1.498A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.96 0-3.797-.527-5.375-1.441l-.385-.229-3.993 1.043 1.066-3.9-.252-.4A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>' +
        '</div>' +
        '<div class="sw-contact-info">' +
          '<div class="sw-contact-name">WhatsApp</div>' +
          '<div class="sw-contact-sub">+506 8888-8888 · Mon–Sat 9am–7pm</div>' +
        '</div>' +
        '<svg class="sw-contact-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
      '</div>' +
      '<div class="sw-contact-card" onclick="window.location.href=\'mailto:support@vibetickets.com\'">' +
        '<div class="sw-contact-icon sw-contact-icon--email">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>' +
        '</div>' +
        '<div class="sw-contact-info">' +
          '<div class="sw-contact-name">Email</div>' +
          '<div class="sw-contact-sub">support@vibetickets.com</div>' +
        '</div>' +
        '<svg class="sw-contact-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
      '</div>' +
      '<div class="sw-contact-card" onclick="goPage(\'faq\');closeSupportWidget()">' +
        '<div class="sw-contact-icon sw-contact-icon--faq">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
        '</div>' +
        '<div class="sw-contact-info">' +
          '<div class="sw-contact-name">FAQ</div>' +
          '<div class="sw-contact-sub">Browse common questions</div>' +
        '</div>' +
        '<svg class="sw-contact-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
      '</div>' +
    '</div>'
  );
}

function handleQuickAction(action) {
  var chat = document.getElementById('sw-chat-body');
  if (!chat) return;
  var questions = {
    qr:      'I didn\'t receive my QR code by email.',
    payment: 'I have a payment issue.',
    cancel:  'I want to cancel my purchase.',
    event:   'I need information about an event.'
  };
  var answers = {
    qr:      'Check your spam folder first. If it\'s not there, reply here with your order code (VB-XXXXXX) and we\'ll resend it right away.',
    payment: 'Was the charge made but you didn\'t receive the ticket? Please share the transaction reference and we\'ll investigate.',
    cancel:  'All sales are final per our T&C. If the event was cancelled by the organizer, refunds are processed automatically. Tell us more about your case.',
    event:   'Which event are you asking about? Drop the name or date and I\'ll pull up the details for you.'
  };
  // append user bubble
  var userDiv = document.createElement('div');
  userDiv.className = 'sw-msg sw-msg-user';
  userDiv.innerHTML = '<div class="sw-msg-bubble">' + questions[action] + '</div>';
  chat.appendChild(userDiv);
  chat.scrollTop = chat.scrollHeight;
  // typing indicator
  var typing = document.createElement('div');
  typing.className = 'sw-msg sw-msg-bot sw-typing';
  typing.innerHTML = '<div class="sw-msg-bubble sw-msg-typing-bubble"><span></span><span></span><span></span></div>';
  chat.appendChild(typing);
  chat.scrollTop = chat.scrollHeight;
  setTimeout(function() {
    chat.removeChild(typing);
    var botDiv = document.createElement('div');
    botDiv.className = 'sw-msg sw-msg-bot';
    botDiv.innerHTML = '<div class="sw-msg-bubble">' + (answers[action] || 'Let me look into that for you.') + '</div>';
    chat.appendChild(botDiv);
    chat.scrollTop = chat.scrollHeight;
  }, 900);
}

function sendSupportMessage() {
  var inp  = document.getElementById('sw-input');
  var chat = document.getElementById('sw-chat-body');
  if (!inp || !chat) return;
  var text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  // user bubble
  var userDiv = document.createElement('div');
  userDiv.className = 'sw-msg sw-msg-user';
  userDiv.innerHTML = '<div class="sw-msg-bubble">' + text + '</div>';
  chat.appendChild(userDiv);
  chat.scrollTop = chat.scrollHeight;
  // typing indicator
  var typing = document.createElement('div');
  typing.className = 'sw-msg sw-msg-bot sw-typing';
  typing.innerHTML = '<div class="sw-msg-bubble sw-msg-typing-bubble"><span></span><span></span><span></span></div>';
  chat.appendChild(typing);
  chat.scrollTop = chat.scrollHeight;
  setTimeout(function() {
    chat.removeChild(typing);
    var botDiv = document.createElement('div');
    botDiv.className = 'sw-msg sw-msg-bot';
    botDiv.innerHTML = '<div class="sw-msg-bubble">Thanks for reaching out! Our team will follow up shortly. For faster help, switch to the <strong>Human</strong> tab.</div>';
    chat.appendChild(botDiv);
    chat.scrollTop = chat.scrollHeight;
  }, 1000);
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


// ─── ALL EVENTS / BUY-IN-2MIN — entrance observer ────────────────
function initAllEventsEntrance() {
  var sel = '.all-events, .buy-in-2min';
  if (!window.IntersectionObserver) {
    document.querySelectorAll(sel).forEach(function(el){ el.classList.add('in-view'); });
    return;
  }
  var io = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll(sel).forEach(function(el){ io.observe(el); });
}

// ─── HOME PARALLAX (JS fallback when animation-timeline:view() unsupported)
function initHomeParallax() {
  var sections = document.querySelectorAll('.home-section');
  if (!sections.length) return;
  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;
  var supportsViewTimeline = CSS && CSS.supports && CSS.supports('animation-timeline: view()');
  if (supportsViewTimeline) return;
  var mobile = window.matchMedia && window.matchMedia('(max-width:900px)').matches;
  var maxOffset = mobile ? 15 : 30;
  var ticking = false;
  function update() {
    var vh = window.innerHeight;
    sections.forEach(function(sec) {
      var rect = sec.getBoundingClientRect();
      if (rect.top > vh || rect.bottom < 0) return;
      var progress = Math.max(0, Math.min(1, (vh - rect.top) / vh));
      sec.style.transform = 'translateY(' + ((1 - progress) * maxOffset).toFixed(2) + 'px)';
    });
    ticking = false;
  }
  window.addEventListener('scroll', function() {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
}

// ─── CAROUSEL AUTO-SCROLL (RAF-driven, seamless pause/resume) ───
function initCarouselAutoScroll() {
  var scroller = document.querySelector('.flyer-scroll');
  var track    = document.getElementById('flyer-track');
  if (!scroller || !track) return;

  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SPEED = 70; // px/s — ~20s per original set (track half ~ 1372px)
  var paused = prefersReduced;
  var pauseTimer = null;
  var lastTs = 0;

  function step(ts) {
    if (!lastTs) lastTs = ts;
    var dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (!paused) {
      var half = track.scrollWidth / 2;
      if (half > 0) {
        var next = scroller.scrollLeft + SPEED * dt;
        if (next >= half) next -= half;
        else if (next < 0) next += half;
        scroller.scrollLeft = next;
      }
    }
    requestAnimationFrame(step);
  }

  function scheduleResume(ms) {
    if (pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = setTimeout(function() {
      pauseTimer = null;
      lastTs = 0;
      paused = false;
    }, ms);
  }

  // Pause on hover (desktop) — instant resume when leaving, unless timer active
  scroller.addEventListener('mouseenter', function() { paused = true; });
  scroller.addEventListener('mouseleave', function() {
    if (!pauseTimer) { lastTs = 0; paused = false; }
  });

  // Pause on touch drag (mobile) — resume after 5s of no interaction
  scroller.addEventListener('touchstart', function() {
    paused = true;
    if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
  }, { passive: true });
  scroller.addEventListener('touchend', function() { scheduleResume(5000); }, { passive: true });

  // Arrow handler (global — onclick=carouselArrow(±1))
  window.carouselArrow = function(dir) {
    paused = true;
    var first = track.querySelector('.flyer-slide');
    var step = first ? (first.offsetWidth + 16) : 196;
    scroller.scrollBy({ left: dir * step, behavior: 'smooth' });
    scheduleResume(5000);
  };

  // React to reduced-motion preference changes
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var handler = function(e) {
      prefersReduced = e.matches;
      if (prefersReduced) paused = true;
      else if (!pauseTimer) { lastTs = 0; paused = false; }
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
  }

  // Small delay so slides have measured width before we start
  setTimeout(function() { requestAnimationFrame(step); }, 120);
}

// ─── CHECKOUT DRAWER ──────────────────────────────────────────────
var cdCurrentStep = 1;
var _cdLastFocus = null;
var _cdKeyHandler = null;
var _cdSavedScrollY = null;

function cdFocusables(root) {
  if (!root) return [];
  var sel = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.prototype.slice.call(root.querySelectorAll(sel)).filter(function(el) {
    return el.offsetParent !== null || el.getClientRects().length > 0;
  });
}

function openCheckoutDrawer() {
  var drawer = document.getElementById('checkout-drawer');
  if (!drawer) return;

  // Reset checkout state (mirrors openCheckout body)
  discountApplied = false; discountPct = 0;
  var di = document.getElementById('discount-input');
  var dm = document.getElementById('discount-msg');
  if (di) { di.value = ''; di.disabled = false; }
  if (dm) { dm.style.display = 'none'; dm.textContent = ''; }
  qty = 1;
  payM = 'card';
  currentTier = null;
  attendeeData = [];
  attendeeValidationTriggered = false;

  if (!currentEvent) currentEvent = 'rawdeo';
  var ev = EVENTS[currentEvent];

  // Sync drawer event strip
  var stripImg = document.getElementById('cd-event-img');
  var stripName = document.getElementById('cd-event-name');
  var stripMeta = document.getElementById('cd-event-meta');
  if (stripImg) stripImg.src = ev.isMansita ? MANSITA_B64 : RAWDEO_B64;
  if (stripName) stripName.textContent = ev.name;
  if (stripMeta) stripMeta.textContent = ev.date + ' · ' + ev.place;

  // Sync quantity widget
  var qEl = document.getElementById('ed-q');
  if (qEl) qEl.textContent = qty;

  // Default tier + totals
  var firstAvail = (ev.tiers || []).find(function(t){ return !t.soldout && (t.capacity - t.sold) > 0; });
  if (firstAvail) selectTier(firstAvail.id);
  else updTotals();

  // Default payment panel
  document.querySelectorAll('.pay-panel').forEach(function(p){ p.classList.remove('show'); });
  var cardPanel = document.getElementById('pp-card');
  if (cardPanel) cardPanel.classList.add('show');
  document.querySelectorAll('.pay-opt').forEach(function(o){ o.classList.remove('on'); });
  var firstOpt = document.querySelector('.pay-opt[data-pay="card"]') || document.querySelector('.pay-opt');
  if (firstOpt) firstOpt.classList.add('on');

  checkoutAuthMode = 'signup';
  renderCheckoutAuth();

  goToStep(1);

  _cdLastFocus = document.activeElement;
  _cdSavedScrollY = window.scrollY || window.pageYOffset || 0;
  document.documentElement.style.setProperty('--drawer-scroll-top', '-' + _cdSavedScrollY + 'px');
  document.body.classList.add('drawer-open');
  drawer.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(function() { drawer.classList.add('is-open'); });

  _cdKeyHandler = function(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeCheckoutDrawer(); return; }
    if (e.key === 'Tab') {
      var panel = drawer.querySelector('.checkout-drawer__panel');
      var focusables = cdFocusables(panel);
      if (!focusables.length) return;
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', _cdKeyHandler);

  setTimeout(function() {
    var closeBtn = drawer.querySelector('.cd-close-btn');
    if (closeBtn) closeBtn.focus();
  }, 240);
}

function closeCheckoutDrawer(silent) {
  var drawer = document.getElementById('checkout-drawer');
  if (!drawer) return;
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('drawer-open');
  document.documentElement.style.removeProperty('--drawer-scroll-top');
  if (typeof _cdSavedScrollY === 'number') {
    window.scrollTo(0, _cdSavedScrollY);
    _cdSavedScrollY = null;
  }
  if (_cdKeyHandler) { document.removeEventListener('keydown', _cdKeyHandler); _cdKeyHandler = null; }
  if (!silent && _cdLastFocus && _cdLastFocus.focus) {
    try { _cdLastFocus.focus(); } catch (e) {}
  }
  _cdLastFocus = null;
}

function goToStep(n) {
  cdCurrentStep = Math.max(1, Math.min(3, n));
  var drawer = document.getElementById('checkout-drawer');
  if (!drawer) return;
  // Progress indicator
  drawer.querySelectorAll('.cd-progress .cd-step').forEach(function(el) {
    var s = parseInt(el.getAttribute('data-step'), 10);
    el.classList.toggle('cd-step--active', s === cdCurrentStep);
    el.classList.toggle('cd-step--done', s < cdCurrentStep);
  });
  var bar = drawer.querySelector('.cd-progress');
  if (bar) bar.setAttribute('aria-valuenow', String(cdCurrentStep));
  // Step panels
  drawer.querySelectorAll('.cd-step-content').forEach(function(el) {
    el.classList.remove('cd-step-content--active');
  });
  var active = document.getElementById('cd-step-' + cdCurrentStep);
  if (active) active.classList.add('cd-step-content--active');
  // Back btn visibility
  var back = drawer.querySelector('.cd-back-btn');
  if (back) back.style.visibility = cdCurrentStep > 1 ? 'visible' : 'hidden';
  // Scroll body to top
  var body = drawer.querySelector('.cd-body');
  if (body) body.scrollTop = 0;

  if (cdCurrentStep === 2) {
    renderCheckoutAuth();
    renderAttendeeFields();
  }
  updateDrawerCTA();
}

function updateDrawerCTA() {
  var btn = document.getElementById('cd-cta');
  if (!btn) return;
  var ev = EVENTS[currentEvent] || EVENTS.rawdeo;
  var tier = currentTier || (ev.tiers ? ev.tiers[0] : ev);
  var priceCRC = tier.priceCRC !== undefined ? tier.priceCRC : ev.priceCRC;
  if (discountApplied && discountPct > 0) priceCRC = priceCRC * (1 - discountPct / 100);
  var total = Math.round(priceCRC * qty);
  var totalStr = priceCRC === 0 ? 'Free' : formatCRC(total);
  var summaryAmt = document.getElementById('cd-summary-total-amt');
  if (summaryAmt) summaryAmt.innerHTML = priceCRC === 0 ? 'Free' : formatCRC(total);
  if (cdCurrentStep === 1) {
    btn.textContent = priceCRC === 0 ? 'CONTINUE →' : 'CHECKOUT · ' + totalStr;
  } else if (cdCurrentStep === 2) {
    btn.textContent = 'CONTINUE TO PAYMENT →';
  } else {
    btn.textContent = priceCRC === 0 ? 'CONFIRM · FREE' : 'COMPLETE PURCHASE · ' + totalStr;
  }
}

function cdNext() {
  if (cdCurrentStep === 1) {
    if (!currentTier) { return; }
    goToStep(2);
    return;
  }
  if (cdCurrentStep === 2) {
    attendeeValidationTriggered = true;
    if (!validateAttendees()) {
      var w = document.getElementById('attendee-warning');
      if (w) w.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // If not logged in, create a simulated session from the buyer form
    if (!authIsLoggedIn()) {
      var buyer = attendeeData[0] || { name: '', email: '' };
      var bp = (buyer.name || '').split(' ');
      var sessionUser = {
        id: 'u_' + Date.now(),
        email: buyer.email,
        firstName: bp[0] || '',
        lastName: bp.slice(1).join(' ') || '',
        fullName: buyer.name,
        emailVerified: false,
        provider: 'email',
        createdAt: new Date().toISOString()
      };
      try { localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser)); } catch (e) {}
      renderAuthState();
    }
    goToStep(3);
    return;
  }
  // Step 3 → pay
  doPay();
}

function cdBack() {
  if (cdCurrentStep > 1) goToStep(cdCurrentStep - 1);
  else closeCheckoutDrawer();
}

// PDF placeholder: browser print of confirmation screen
function downloadTicketPDF() {
  try {
    window.print();
  } catch (e) {
    alert('Ticket PDF will be emailed to you. Check your inbox.');
  }
}

// ─── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  initFadeIns();
  initFlyerCarousel();
  initAllEventsEntrance();
  initHomeParallax();
  initCarouselAutoScroll();
  updateCardCountdowns();
  // Sync ticket badge from persisted userTickets
  var badge = document.getElementById('menu-ticket-badge');
  if (badge) {
    badge.textContent = userTickets.length;
    badge.style.display = userTickets.length ? 'inline-flex' : 'none';
  }
  // Trigger fade for elements already in viewport
  setTimeout(function() {
    document.querySelectorAll(".fade-in").forEach(function(el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight) { el.classList.add("visible"); }
    });
  }, 100);
});
