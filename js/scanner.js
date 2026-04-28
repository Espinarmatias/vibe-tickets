/* =====================================================
 * VIBE SCANNER — js/scanner.js
 * Pfizer Corporate 2026
 * ===================================================== */

(function () {
  'use strict';

  // ============ CONFIG ============
  const SUPABASE_URL = 'https://smeuthybgzqxohjifgix.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_T5f432DOcZl3eXk4nQpBpg_NQz0TAl3';

  const RESULT_DISPLAY_MS = 2200;
  const SCAN_COOLDOWN_MS = 800;
  const QR_BOX_SIZE = 280;
  const QR_FPS = 10;

  const state = {
    supabase: null,
    staffToken: null,
    staff: null,
    event: null,
    scanner: null,
    isProcessing: false,
    lastScanTime: 0,
    lastScanCode: null,
    scanCount: 0,
    audioCtx: null,
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    loading: () => $('screen-loading'),
    error: () => $('screen-error'),
    errorTitle: () => $('error-title'),
    errorMessage: () => $('error-message'),
    scanner: () => $('screen-scanner'),
    eventName: () => $('event-name'),
    staffName: () => $('staff-name'),
    scanCounter: () => $('scan-counter'),
    scanHint: () => $('scan-hint'),
    statusPulse: () => $('status-pulse'),
    banner: () => $('result-banner'),
    resultIcon: () => $('result-icon'),
    resultTitle: () => $('result-title'),
    resultAttendee: () => $('result-attendee'),
    resultMeta: () => $('result-meta'),
    resultCountdown: () => $('result-countdown'),
  };

  function showScreen(name) {
    ['loading', 'error', 'scanner'].forEach((s) => {
      const el = els[s]();
      if (!el) return;
      if (s === name) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
  }

  function showError(title, message) {
    els.errorTitle().textContent = title;
    els.errorMessage().textContent = message;
    showScreen('error');
  }

  function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  }

  function ensureAudio() {
    try {
      if (!state.audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) state.audioCtx = new Ctx();
      }
      if (state.audioCtx && state.audioCtx.state === 'suspended') {
        state.audioCtx.resume();
      }
    } catch (e) {}
  }

  function beep(frequency, duration, volume) {
    try {
      ensureAudio();
      if (!state.audioCtx) return;
      const osc = state.audioCtx.createOscillator();
      const gain = state.audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = frequency;
      gain.gain.value = volume || 0.15;
      osc.connect(gain);
      gain.connect(state.audioCtx.destination);
      const now = state.audioCtx.currentTime;
      osc.start(now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);
      osc.stop(now + duration / 1000);
    } catch (e) {}
  }

  function feedbackSuccess() { vibrate([60]); beep(880, 120, 0.18); }
  function feedbackWarning() {
    vibrate([40, 60, 40]);
    beep(440, 100, 0.18);
    setTimeout(() => beep(330, 150, 0.18), 130);
  }
  function feedbackError() { vibrate([200]); beep(220, 250, 0.20); }

  function pulseFrame(kind) {
    const pulse = els.statusPulse();
    pulse.className = 'status-pulse ' + kind;
    setTimeout(() => { pulse.className = 'status-pulse'; }, 500);
  }

  function showResult(kind, data) {
    const banner = els.banner();
    banner.className = 'result-banner ' + kind + ' visible';

    if (kind === 'success') {
      els.resultIcon().textContent = '✓';
      els.resultTitle().textContent = 'AUTORIZADO';
      const attName = data.attendee
        ? [data.attendee.first_name, data.attendee.last_name_1, data.attendee.last_name_2].filter(Boolean).join(' ')
        : '';
      els.resultAttendee().textContent = attName;
      const meta = [];
      if (data.attendee && data.attendee.department) meta.push(data.attendee.department);
      if (data.attendee && data.attendee.email) meta.push(data.attendee.email);
      els.resultMeta().textContent = meta.join(' · ');
      feedbackSuccess();
      pulseFrame('success');
    } else if (kind === 'warning') {
      els.resultIcon().textContent = '⚠';
      els.resultTitle().textContent = 'YA USADO';
      const attName = data.attendee
        ? [data.attendee.first_name, data.attendee.last_name_1].filter(Boolean).join(' ')
        : '';
      els.resultAttendee().textContent = attName;
      els.resultMeta().textContent = data.message || '';
      feedbackWarning();
      pulseFrame('warning');
    } else {
      els.resultIcon().textContent = '✕';
      els.resultTitle().textContent = data.title || 'INVÁLIDO';
      els.resultAttendee().textContent = '';
      els.resultMeta().textContent = data.message || '';
      feedbackError();
      pulseFrame('error');
    }

    let remaining = Math.ceil(RESULT_DISPLAY_MS / 1000);
    els.resultCountdown().textContent = remaining + 's';
    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) { clearInterval(interval); return; }
      els.resultCountdown().textContent = remaining + 's';
    }, 1000);

    setTimeout(() => {
      banner.className = 'result-banner';
      els.scanHint().textContent = 'Apuntá al QR';
      state.isProcessing = false;
    }, RESULT_DISPLAY_MS);
  }

  function bumpCounter() {
    state.scanCount++;
    els.scanCounter().textContent = state.scanCount + ' scan' + (state.scanCount === 1 ? '' : 's');
  }

  function getDeviceInfo() {
    return {
      ua: navigator.userAgent,
      platform: navigator.platform,
      lang: navigator.language,
      screen: { w: window.screen.width, h: window.screen.height },
      ts: new Date().toISOString(),
    };
  }

  async function processScan(qrCode) {
    const now = Date.now();
    if (state.isProcessing) return;
    if (now - state.lastScanTime < SCAN_COOLDOWN_MS) return;
    if (qrCode === state.lastScanCode && now - state.lastScanTime < 3000) return;

    state.isProcessing = true;
    state.lastScanTime = now;
    state.lastScanCode = qrCode;

    els.scanHint().textContent = 'Validando...';

    try {
      const { data, error } = await state.supabase.rpc('scan_ticket_by_qr', {
        p_qr_code: qrCode,
        p_staff_token: state.staffToken,
        p_device_info: getDeviceInfo(),
      });

      if (error) {
        console.error('[scan] RPC error:', error);
        showResult('error', { title: 'ERROR', message: 'Error de red. Reintentá.' });
        return;
      }

      bumpCounter();

      if (data.success && data.result === 'success') {
        showResult('success', data);
      } else if (data.result === 'already_used') {
        showResult('warning', data);
      } else if (data.result === 'wrong_event') {
        showResult('error', { title: 'OTRO EVENTO', message: 'Ese ticket no es de este evento.' });
      } else if (data.error === 'unauthorized') {
        showError('Sesión expirada', 'Refrescá la página o pedí un link nuevo.');
        if (state.scanner) state.scanner.stop().catch(() => {});
      } else {
        showResult('error', { title: 'INVÁLIDO', message: data.message || 'QR no reconocido.' });
      }
    } catch (e) {
      console.error('[scan] exception:', e);
      showResult('error', { title: 'ERROR', message: 'Sin conexión. Reintentá.' });
    }
  }

  async function initCamera() {
    state.scanner = new Html5Qrcode('qr-reader', { verbose: false });
    const config = {
      fps: QR_FPS,
      qrbox: { width: QR_BOX_SIZE, height: QR_BOX_SIZE },
      aspectRatio: window.innerHeight / window.innerWidth,
      disableFlip: false,
    };

    try {
      await state.scanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => { processScan(decodedText); },
        () => {}
      );
      document.body.addEventListener('click', ensureAudio, { once: false });
      document.body.addEventListener('touchstart', ensureAudio, { once: false });
    } catch (err) {
      console.error('[camera] error:', err);
      let msg = 'No se pudo abrir la cámara.';
      if (err && err.toString().includes('Permission')) {
        msg = 'Permitile a tu navegador usar la cámara y refrescá.';
      } else if (err && err.toString().includes('NotFoundError')) {
        msg = 'No se detectó cámara en este dispositivo.';
      }
      showError('Cámara bloqueada', msg);
    }
  }

  async function init() {
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      showError('Conexión insegura', 'El scanner requiere HTTPS para acceder a la cámara.');
      return;
    }

    const params = new URLSearchParams(location.search);
    const token = params.get('token') || params.get('t');
    if (!token) {
      showError('Link inválido', 'Falta el token de acceso. Pedile al organizador tu link personal.');
      return;
    }
    state.staffToken = token;

    try {
      state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) {
      console.error('[init] supabase error:', e);
      showError('Error de conexión', 'No se pudo conectar al servidor.');
      return;
    }

    try {
      const { data, error } = await state.supabase.rpc('validate_staff_token', { p_token: token });

      if (error) {
        console.error('[validate] error:', error);
        showError('Error de servidor', 'Reintentá en unos segundos.');
        return;
      }

      if (!data || !data.valid) {
        const errMap = {
          invalid_token: ['Link inválido', 'Tu link no es válido. Pedile uno nuevo al organizador.'],
          revoked: ['Acceso revocado', 'Tu acceso fue revocado.'],
          status_invalid: ['No autorizado', data.message || 'Tu acceso no está activo.'],
          token_expired: ['Link expirado', 'Tu link ya expiró.'],
          too_early: ['Aún no podés escanear', data.message],
          access_ended: ['Acceso finalizado', 'El evento ya cerró.'],
          wrong_role: ['Rol incorrecto', 'Tu rol no permite escanear.'],
        };
        const [t, m] = errMap[data.error] || ['No autorizado', data.message || 'Acceso denegado.'];
        showError(t, m);
        return;
      }

      state.staff = data.staff;
      state.event = data.event;
      els.eventName().textContent = data.event.name || 'Evento';
      els.staffName().textContent = data.staff.first_name + ' ' + (data.staff.last_name || '');
      showScreen('scanner');
      await initCamera();
    } catch (e) {
      console.error('[init] exception:', e);
      showError('Error', 'Algo falló. Refrescá la página.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
