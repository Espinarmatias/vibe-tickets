/* =====================================================
 * VIBE Admin — Event Manager
 * admin/events/manage.js
 * ===================================================== */

(function() {
  'use strict';

  // ============ CONFIG ============
  const SUPABASE_URL = 'https://smeuthybgzqxohjifgix.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_T5f432DOcZl3eXk4nQpBpg_NQz0TAl3';

  // ============ STATE ============
  const state = {
    sb: null,
    admin: null,
    eventId: null,
    event: null,
    attendees: [],
    parsedImportData: null,
    progressPollInterval: null,
    currentJobId: null,
    table: {
      page: 1,
      perPage: 25,
      search: '',
      filter: 'all',
    },
  };

  // ============ INIT ============
  function init() {
    // Get event_id from URL
    const params = new URLSearchParams(location.search);
    state.eventId = params.get('event');

    if (!state.eventId) {
      document.getElementById('auth-gate-msg').textContent = 'Falta event_id en URL';
      return;
    }

    state.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    checkAuth();
  }

  async function checkAuth() {
    try {
      const { data: { session } } = await state.sb.auth.getSession();
      if (!session) { window.location.href = '/admin/login.html'; return; }

      const { data: admin, error } = await state.sb
        .from('admins')
        .select('id, first_name, last_name, role, is_active, organization_id')
        .eq('auth_user_id', session.user.id)
        .single();

      if (error || !admin || !admin.is_active) {
        await state.sb.auth.signOut();
        window.location.href = '/admin/login.html?reason=not_admin';
        return;
      }

      state.admin = admin;

      const userEl = document.getElementById('admin-bar-user');
      if (userEl) userEl.textContent = (admin.first_name || '') + ' ' + (admin.last_name || '');

      document.getElementById('auth-gate').style.display = 'none';
      document.getElementById('admin-bar').style.display = 'flex';
      document.getElementById('page-content').style.display = 'block';

      await loadEvent();
      await refreshAll();
      wireUpEvents();
      checkRunningJob();
    } catch (e) {
      console.error('[auth]', e);
      document.getElementById('auth-gate-msg').textContent = 'Error: ' + e.message;
    }
  }

  window.logoutAdmin = async function() {
    try { await state.sb.auth.signOut(); } catch (e) {}
    window.location.href = '/admin/login.html';
  };

  // ============ LOAD EVENT ============
  async function loadEvent() {
    const { data, error } = await state.sb
      .from('events')
      .select('*')
      .eq('id', state.eventId)
      .single();

    if (error || !data) {
      document.getElementById('event-name').textContent = 'Evento no encontrado';
      document.getElementById('event-meta').textContent = error ? error.message : '';
      throw new Error('Event not found');
    }

    state.event = data;

    document.getElementById('event-name').textContent = data.name || 'Sin nombre';
    const date = data.event_date ? new Date(data.event_date).toLocaleDateString('es-CR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      timeZone: 'America/Costa_Rica'
    }) : '—';
    const venue = data.venue_name || '—';
    document.getElementById('event-meta').textContent = date + ' · ' + venue;
    document.title = 'VIBE Admin · ' + (data.name || 'Event');
  }

  // ============ STATS + ATTENDEES ============
  async function refreshAll() {
    await Promise.all([loadStats(), loadAttendees()]);
  }
  window.refreshAll = refreshAll;

  async function loadStats() {
    try {
      // Attendees count
      const { count: attCount } = await state.sb
        .from('attendees')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', state.eventId);

      // Tickets count
      const { count: ticketsCount } = await state.sb
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', state.eventId);

      // Tickets used (scanned)
      const { count: scannedCount } = await state.sb
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', state.eventId)
        .eq('status', 'used');

      // Email sent
      const { count: emailsSentCount } = await state.sb
        .from('attendees')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', state.eventId)
        .eq('email_status', 'sent');

      // Email failed
      const { count: emailsFailedCount } = await state.sb
        .from('attendees')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', state.eventId)
        .eq('email_status', 'failed');

      const att = attCount || 0;
      const tix = ticketsCount || 0;
      const sent = emailsSentCount || 0;
      const failed = emailsFailedCount || 0;
      const scanned = scannedCount || 0;

      document.getElementById('stat-attendees').textContent = att;
      document.getElementById('stat-attendees-detail').textContent =
        att === 0 ? 'sin importar' : 'attendees';

      document.getElementById('stat-tickets').textContent = tix;
      document.getElementById('stat-tickets-detail').textContent =
        att > 0 ? Math.round((tix / att) * 100) + '% generados' : '—';

      document.getElementById('stat-emails-sent').textContent = sent;
      const emailsDetailParts = [];
      if (att > 0) emailsDetailParts.push(Math.round((sent / att) * 100) + '%');
      if (failed > 0) emailsDetailParts.push(failed + ' failed');
      document.getElementById('stat-emails-detail').textContent =
        emailsDetailParts.length ? emailsDetailParts.join(' · ') : 'enviados';

      document.getElementById('stat-scanned').textContent = scanned;
      document.getElementById('stat-scanned-detail').textContent =
        tix > 0 ? Math.round((scanned / tix) * 100) + '% ingresaron' : 'ingresaron';

      // Update button states
      document.getElementById('btn-generate').disabled = att === 0;
      document.getElementById('btn-send').disabled = tix === 0;
    } catch (e) {
      console.error('[stats]', e);
    }
  }

  async function loadAttendees() {
    try {
      const { data, error } = await state.sb
        .from('attendees')
        .select(`
          id, first_name, last_name_1, last_name_2, email, department, phone, employee_id,
          email_status, email_sent_at, email_failed_at, email_error,
          tickets:tickets!attendee_id(id, qr_code, status, used_at)
        `)
        .eq('event_id', state.eventId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[attendees]', error);
        document.getElementById('attendees-tbody').innerHTML =
          '<tr><td colspan="5" class="table-empty">Error: ' + escapeHtml(error.message) + '</td></tr>';
        return;
      }

      state.attendees = data || [];
      renderAttendeesTable();
    } catch (e) {
      console.error('[loadAttendees]', e);
    }
  }
  window.loadAttendees = loadAttendees;

  function getFilteredAttendees() {
    let filtered = state.attendees;

    // Filter
    if (state.table.filter !== 'all') {
      filtered = filtered.filter(a => {
        const hasTicket = (a.tickets && a.tickets.length > 0);
        switch (state.table.filter) {
          case 'no_email': return !a.email_status || a.email_status === 'pending';
          case 'sent': return a.email_status === 'sent';
          case 'failed': return a.email_status === 'failed';
          case 'no_ticket': return !hasTicket;
          case 'with_ticket': return hasTicket;
          default: return true;
        }
      });
    }

    // Search
    if (state.table.search) {
      const q = state.table.search.toLowerCase();
      filtered = filtered.filter(a => {
        const fullName = [a.first_name, a.last_name_1, a.last_name_2].filter(Boolean).join(' ').toLowerCase();
        return fullName.includes(q)
          || (a.email || '').toLowerCase().includes(q)
          || (a.department || '').toLowerCase().includes(q)
          || (a.employee_id || '').toLowerCase().includes(q);
      });
    }

    return filtered;
  }

  function renderAttendeesTable() {
    const filtered = getFilteredAttendees();
    const total = filtered.length;
    const start = (state.table.page - 1) * state.table.perPage;
    const end = start + state.table.perPage;
    const page = filtered.slice(start, end);

    const tbody = document.getElementById('attendees-tbody');
    if (!page.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Sin resultados</td></tr>';
    } else {
      tbody.innerHTML = page.map(a => {
        const fullName = [a.first_name, a.last_name_1, a.last_name_2].filter(Boolean).join(' ');
        const hasTicket = a.tickets && a.tickets.length > 0;
        const ticket = hasTicket ? a.tickets[0] : null;

        let ticketBadge;
        if (!hasTicket) {
          ticketBadge = '<span class="badge no-ticket">Sin ticket</span>';
        } else if (ticket.status === 'used') {
          ticketBadge = '<span class="badge has-ticket">✓ Escaneado</span>';
        } else {
          ticketBadge = '<span class="badge has-ticket">✓ Generado</span>';
        }

        let emailBadge;
        if (a.email_status === 'sent') {
          emailBadge = '<span class="badge sent">✓ Sent</span>';
        } else if (a.email_status === 'failed') {
          emailBadge = '<span class="badge failed" title="' + escapeHtml(a.email_error || '') + '">✕ Failed</span>';
        } else if (a.email_status === 'sending') {
          emailBadge = '<span class="badge sending">⏳ Sending</span>';
        } else {
          emailBadge = '<span class="badge pending">— Pending</span>';
        }

        return `
          <tr>
            <td><strong>${escapeHtml(fullName)}</strong></td>
            <td style="font-size:0.8rem;opacity:0.7;">${escapeHtml(a.email)}</td>
            <td style="font-size:0.8rem;opacity:0.6;">${escapeHtml(a.department || '—')}</td>
            <td>${ticketBadge}</td>
            <td>${emailBadge}</td>
          </tr>
        `;
      }).join('');
    }

    // Pagination info
    document.getElementById('table-pag-info').textContent =
      total === 0 ? 'Sin resultados' :
      `Mostrando ${start + 1}–${Math.min(end, total)} de ${total}`;

    // Pagination buttons
    const totalPages = Math.ceil(total / state.table.perPage) || 1;
    let pagsHtml = '';
    const maxBtns = 5;
    let startBtn = Math.max(1, state.table.page - 2);
    let endBtn = Math.min(totalPages, startBtn + maxBtns - 1);
    startBtn = Math.max(1, endBtn - maxBtns + 1);
    for (let p = startBtn; p <= endBtn; p++) {
      pagsHtml += `<button class="table-pag-btn ${p === state.table.page ? 'active' : ''}" onclick="setTablePage(${p})">${p}</button>`;
    }
    document.getElementById('table-pag-btns').innerHTML = pagsHtml;
  }

  window.setTablePage = function(p) {
    state.table.page = p;
    renderAttendeesTable();
  };

  function wireUpEvents() {
    document.getElementById('table-search').addEventListener('input', (e) => {
      state.table.search = e.target.value;
      state.table.page = 1;
      renderAttendeesTable();
    });
    document.getElementById('table-filter').addEventListener('change', (e) => {
      state.table.filter = e.target.value;
      state.table.page = 1;
      renderAttendeesTable();
    });
  }

  // ============ MODAL HELPERS ============
  window.closeModal = function(id) {
    document.getElementById(id).classList.remove('visible');
  };
  function openModal(id) {
    document.getElementById(id).classList.add('visible');
  }

  // ============ IMPORT FLOW ============
  window.openImportModal = function() {
    resetImportModal();
    openModal('modal-import');
  };
  window.resetImportModal = function() {
    document.getElementById('import-step-upload').style.display = 'block';
    document.getElementById('import-step-preview').style.display = 'none';
    document.getElementById('import-step-result').style.display = 'none';
    document.getElementById('import-file').value = '';
    state.parsedImportData = null;
  };

  window.parseImportFile = async function() {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];
    if (!file) {
      showToast('error', 'Seleccioná un archivo primero');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      if (!rows.length) {
        showToast('error', 'El archivo está vacío');
        return;
      }

      // Detect column mappings
      const headers = Object.keys(rows[0]);
      const mapping = detectColumnMapping(headers);

      // Parse rows
      const parsed = rows.map(r => mapRowToAttendee(r, mapping)).filter(a => a !== null);

      // Detect duplicates by email within the file
      const seenEmails = new Set();
      const duplicates = [];
      const unique = [];
      parsed.forEach(a => {
        const em = (a.email || '').toLowerCase();
        if (seenEmails.has(em)) {
          duplicates.push(a);
        } else {
          seenEmails.add(em);
          unique.push(a);
        }
      });

      // Validate
      const valid = [];
      const invalid = [];
      unique.forEach(a => {
        if (!a.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email)) {
          invalid.push({ ...a, _reason: 'Email inválido' });
        } else if (!a.first_name) {
          invalid.push({ ...a, _reason: 'Falta nombre' });
        } else if (!a.last_name_1) {
          invalid.push({ ...a, _reason: 'Falta apellido' });
        } else {
          valid.push(a);
        }
      });

      state.parsedImportData = { valid, invalid, duplicates, mapping, totalRows: rows.length };

      // Render preview
      const summary = `
        <div class="preview-row"><span>Filas detectadas</span><strong>${rows.length}</strong></div>
        <div class="preview-row"><span class="ok">✓ Válidos</span><strong class="ok">${valid.length}</strong></div>
        <div class="preview-row"><span class="warn">⚠ Duplicados (en el archivo)</span><strong class="warn">${duplicates.length}</strong></div>
        <div class="preview-row"><span class="err">✕ Inválidos</span><strong class="err">${invalid.length}</strong></div>
      `;
      document.getElementById('import-preview-summary').innerHTML = summary;

      // Preview table
      const previewTable = document.getElementById('import-preview-table');
      const sample = valid.slice(0, 5);
      previewTable.innerHTML = `
        <thead>
          <tr><th>Nombre</th><th>Apellido</th><th>Email</th><th>Depto</th></tr>
        </thead>
        <tbody>
          ${sample.map(a => `
            <tr>
              <td>${escapeHtml(a.first_name)}</td>
              <td>${escapeHtml((a.last_name_1 || '') + ' ' + (a.last_name_2 || '')).trim()}</td>
              <td>${escapeHtml(a.email)}</td>
              <td>${escapeHtml(a.department || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      `;

      document.getElementById('import-step-upload').style.display = 'none';
      document.getElementById('import-step-preview').style.display = 'block';
    } catch (e) {
      console.error('[parse]', e);
      showToast('error', 'Error al leer archivo: ' + e.message);
    }
  };

  function detectColumnMapping(headers) {
    const map = {};
    const norm = h => h.toLowerCase().trim().replace(/[_\s\-]+/g, '');

    headers.forEach(h => {
      const n = norm(h);
      if (!map.email && (n === 'email' || n === 'correo' || n === 'mail' || n === 'correoelectronico' || n === 'emailaddress')) {
        map.email = h;
      } else if (!map.first_name && (n === 'firstname' || n === 'nombre' || n === 'name' || n === 'nombres')) {
        map.first_name = h;
      } else if (!map.last_name_1 && (n === 'lastname' || n === 'apellido' || n === 'apellido1' || n === 'lastname1' || n === 'primerapellido' || n === 'apellidopaterno' || n === 'surname')) {
        map.last_name_1 = h;
      } else if (!map.last_name_2 && (n === 'lastname2' || n === 'apellido2' || n === 'segundoapellido' || n === 'apellidomaterno')) {
        map.last_name_2 = h;
      } else if (!map.department && (n === 'department' || n === 'departamento' || n === 'depto' || n === 'area' || n === 'puesto' || n === 'cargo' || n === 'role' || n === 'position' || n === 'jobtitle')) {
        map.department = h;
      } else if (!map.employee_id && (n === 'employeeid' || n === 'idempleado' || n === 'codigo' || n === 'cedula' || n === 'id' || n === 'employeenumber')) {
        map.employee_id = h;
      } else if (!map.phone && (n === 'phone' || n === 'telefono' || n === 'celular' || n === 'tel' || n === 'mobile' || n === 'phonenumber' || n === 'numerotelefonico')) {
        map.phone = h;
      } else if (!map.full_name && (n === 'fullname' || n === 'nombrecompleto' || n === 'nombreyapellido' || n === 'nombreapellido')) {
        map.full_name = h;
      }
    });
    return map;
  }

  function mapRowToAttendee(row, mapping) {
    const get = (key) => mapping[key] ? String(row[mapping[key]] || '').trim() : '';

    let first_name = get('first_name');
    let last_name_1 = get('last_name_1');
    let last_name_2 = get('last_name_2');

    // If full_name is present and first_name/last_name not, split
    if (mapping.full_name && !first_name && !last_name_1) {
      const fullName = String(row[mapping.full_name] || '').trim();
      if (fullName) {
        const parts = fullName.split(/\s+/);
        first_name = parts[0] || '';
        last_name_1 = parts[1] || '';
        last_name_2 = parts.slice(2).join(' ') || '';
      }
    }

    return {
      first_name,
      last_name_1,
      last_name_2: last_name_2 || null,
      email: get('email').toLowerCase(),
      department: get('department') || null,
      employee_id: get('employee_id') || null,
      phone: get('phone') || null,
    };
  }

  window.confirmImport = async function() {
    if (!state.parsedImportData || !state.parsedImportData.valid.length) {
      showToast('error', 'No hay datos válidos para importar');
      return;
    }

    const btn = document.getElementById('btn-confirm-import');
    btn.disabled = true;
    btn.textContent = 'Importando...';

    try {
      const { data, error } = await state.sb.rpc('import_attendees_bulk', {
        p_event_id: state.eventId,
        p_attendees: state.parsedImportData.valid,
      });

      if (error) {
        console.error('[import rpc]', error);
        showToast('error', 'Error: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Confirmar e importar';
        return;
      }

      // Show result
      document.getElementById('import-step-preview').style.display = 'none';
      document.getElementById('import-step-result').style.display = 'block';
      document.getElementById('import-result-summary').innerHTML = `
        <div class="preview-row"><span>Total recibidos</span><strong>${data.total_received || 0}</strong></div>
        <div class="preview-row"><span class="ok">✓ Creados</span><strong class="ok">${data.created || 0}</strong></div>
        <div class="preview-row"><span class="warn">⚠ Duplicados (ya existían)</span><strong class="warn">${data.skipped_duplicates || 0}</strong></div>
        <div class="preview-row"><span class="err">✕ Inválidos (rechazados por DB)</span><strong class="err">${data.skipped_invalid || 0}</strong></div>
      `;
      showToast('success', `${data.created || 0} attendees importados`);
    } catch (e) {
      console.error('[import]', e);
      showToast('error', 'Error inesperado');
      btn.disabled = false;
      btn.textContent = 'Confirmar e importar';
    }
  };

  // ============ GENERATE TICKETS FLOW ============
  window.openGenerateModal = async function() {
    openModal('modal-generate');
    const box = document.getElementById('generate-preview-box');

    // Count attendees without tickets
    const { count: attCount } = await state.sb
      .from('attendees')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', state.eventId);

    const { count: ticketsCount } = await state.sb
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', state.eventId);

    const pending = (attCount || 0) - (ticketsCount || 0);

    box.innerHTML = `
      <div class="preview-row"><span>Total attendees</span><strong>${attCount || 0}</strong></div>
      <div class="preview-row"><span>Con ticket</span><strong>${ticketsCount || 0}</strong></div>
      <div class="preview-row"><span class="ok">Pendientes de generar</span><strong class="ok">${pending}</strong></div>
    `;

    document.getElementById('btn-confirm-generate').disabled = pending === 0;
  };

  window.confirmGenerate = async function() {
    const btn = document.getElementById('btn-confirm-generate');
    btn.disabled = true;
    btn.textContent = 'Generando...';

    try {
      const { data, error } = await state.sb.rpc('generate_tickets_for_event', {
        p_event_id: state.eventId,
      });

      if (error) {
        console.error('[generate]', error);
        showToast('error', 'Error: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Generar tickets';
        return;
      }

      showToast('success', `${data.created || 0} tickets generados`);
      closeModal('modal-generate');
      btn.textContent = 'Generar tickets';
      await refreshAll();
    } catch (e) {
      console.error('[generate]', e);
      showToast('error', 'Error inesperado');
      btn.disabled = false;
      btn.textContent = 'Generar tickets';
    }
  };

  // ============ SEND EMAILS FLOW ============
  window.openSendModal = async function() {
    openModal('modal-send');
    const box = document.getElementById('send-preview-box');

    // Count pending emails (no email_status, pending or failed)
    const { count: pendingCount } = await state.sb
      .from('attendees')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', state.eventId)
      .or('email_status.is.null,email_status.in.(pending,failed)');

    const { count: sentCount } = await state.sb
      .from('attendees')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', state.eventId)
      .eq('email_status', 'sent');

    box.innerHTML = `
      <div class="preview-row"><span>Ya enviados</span><strong>${sentCount || 0}</strong></div>
      <div class="preview-row"><span class="ok">Por enviar ahora</span><strong class="ok">${pendingCount || 0}</strong></div>
      <div class="preview-row"><span style="font-size:0.75rem;opacity:0.6;">Tiempo estimado</span><span style="font-size:0.85rem;opacity:0.7;">~${Math.ceil((pendingCount || 0) * 0.15 / 60)} min</span></div>
    `;

    document.getElementById('btn-confirm-send').disabled = (pendingCount || 0) === 0;
  };

  window.confirmSend = async function() {
    const btn = document.getElementById('btn-confirm-send');
    btn.disabled = true;
    btn.textContent = 'Iniciando...';

    const onlyTest = document.getElementById('send-test-only').checked;

    try {
      const { data, error } = await state.sb.functions.invoke('send-event-emails-batch', {
        body: {
          event_id: state.eventId,
          only_test_emails: onlyTest,
        },
      });

      if (error) {
        console.error('[send]', error);
        showToast('error', 'Error: ' + (error.message || 'unknown'));
        btn.disabled = false;
        btn.textContent = 'Confirmar envío';
        return;
      }

      if (!data || !data.success) {
        showToast('error', 'No se pudo iniciar el envío');
        btn.disabled = false;
        btn.textContent = 'Confirmar envío';
        return;
      }

      state.currentJobId = data.job_id;
      closeModal('modal-send');
      btn.textContent = 'Confirmar envío';
      btn.disabled = false;

      showToast('success', `Envío iniciado (${data.total} emails)`);
      startProgressPolling(data.job_id, data.total);
    } catch (e) {
      console.error('[send]', e);
      showToast('error', 'Error inesperado: ' + e.message);
      btn.disabled = false;
      btn.textContent = 'Confirmar envío';
    }
  };

  // ============ PROGRESS POLLING ============
  function startProgressPolling(jobId, total) {
    const card = document.getElementById('progress-card');
    card.classList.add('visible');
    document.getElementById('progress-total').textContent = total;
    document.getElementById('progress-status').textContent = 'RUNNING';
    document.getElementById('progress-status').className = 'progress-status';

    if (state.progressPollInterval) clearInterval(state.progressPollInterval);

    let pollCount = 0;
    const pollFn = async () => {
      pollCount++;
      try {
        const { data, error } = await state.sb
          .from('batch_jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (error || !data) {
          console.error('[poll]', error);
          return;
        }

        const pct = data.total > 0 ? Math.round((data.processed / data.total) * 100) : 0;
        document.getElementById('progress-bar-fill').style.width = pct + '%';
        document.getElementById('progress-processed').textContent = data.processed || 0;
        document.getElementById('progress-succeeded').textContent = data.succeeded || 0;
        document.getElementById('progress-failed').textContent = data.failed || 0;

        if (data.status === 'completed') {
          document.getElementById('progress-status').textContent = 'COMPLETED';
          document.getElementById('progress-status').classList.add('completed');
          document.getElementById('progress-title').textContent = '✓ Envío completado';
          clearInterval(state.progressPollInterval);
          state.progressPollInterval = null;
          state.currentJobId = null;
          showToast('success', `Envío finalizado: ${data.succeeded} sent, ${data.failed} failed`);
          await refreshAll();
        } else {
          // Estimate ETA
          if (data.processed > 0 && data.processed < data.total) {
            const elapsed = (new Date() - new Date(data.started_at)) / 1000;
            const rate = data.processed / elapsed;
            const remaining = (data.total - data.processed) / rate;
            const mins = Math.floor(remaining / 60);
            const secs = Math.round(remaining % 60);
            document.getElementById('progress-eta').textContent =
              mins > 0 ? `~${mins}m ${secs}s restantes` : `~${secs}s restantes`;
          }
          // Refresh stats every 5 polls
          if (pollCount % 5 === 0) {
            loadStats();
          }
        }
      } catch (e) {
        console.error('[poll]', e);
      }
    };

    pollFn();
    state.progressPollInterval = setInterval(pollFn, 2000);
  }

  // Check if there's a running job when page loads
  async function checkRunningJob() {
    try {
      const { data } = await state.sb
        .from('batch_jobs')
        .select('*')
        .eq('event_id', state.eventId)
        .eq('status', 'running')
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const job = data[0];
        state.currentJobId = job.id;
        startProgressPolling(job.id, job.total);
      }
    } catch (e) {
      console.error('[checkRunning]', e);
    }
  }

  // ============ TOAST ============
  function showToast(kind, message) {
    const toast = document.getElementById('toast');
    toast.className = 'toast ' + kind + ' visible';
    toast.textContent = message;
    setTimeout(() => { toast.className = 'toast ' + kind; }, 3500);
  }

  // ============ HELPERS ============
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(s);
    return div.innerHTML;
  }

  // RUN
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
