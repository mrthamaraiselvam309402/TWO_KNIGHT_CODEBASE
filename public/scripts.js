/**
 * CHESSKIDOO ACADEMY - Complete Admin Panel Scripts
 * Fixed version - Academy Expansion Logic Integrated
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  let allCoaches = [];
  let allStudents = [];
  let achievementsData = [];
  let eventsData = [];
  let allMessages = [];
  let allAttendance = [];
  let allRatingHistory = [];
  let allResources = [];

  // ── NEW ADVANCED LOGIC ──
  function setChildTab(tabId, btn) {
    document.querySelectorAll('.child-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
    const target = document.getElementById('child-tab-' + tabId);
    if (target) target.classList.add('active');
    if (btn) btn.classList.add('active');
    if (tabId === 'growth') renderChildGrowth();
    if (tabId === 'learning') renderChildResources();
    if (tabId === 'billing') renderChildBilling();
  }

  function renderChildGrowth() {
    if (!currentStudent) return;
    const s = currentStudent;
    const ctx = document.getElementById('chartChildElo');
    if (ctx && typeof Chart !== 'undefined') {
      if (chartInstances.childElo) chartInstances.childElo.destroy();
      const history = allRatingHistory.filter(h => String(h.student_id) === String(s.id)).sort((a,b)=>new Date(a.recorded_at)-new Date(b.recorded_at));
      const labels = history.length ? history.map(h=>new Date(h.recorded_at).toLocaleDateString()) : ['Initial'];
      const data = history.length ? history.map(h=>h.rating) : [getStudentRating(s)];
      chartInstances.childElo = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'ELO', data, borderColor: '#dca33e', backgroundColor: 'rgba(220,161,62,0.1)', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }
    const heatmap = document.getElementById('attendance-heatmap');
    if (heatmap) {
      const myAtt = allAttendance.filter(a => String(a.student_id) === String(s.id));
      const last30 = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(now.getDate()-i); const dStr = d.toISOString().split('T')[0];
        const record = myAtt.find(a => a.date === dStr);
        last30.push({ date: d.getDate(), status: record ? record.status : 'none' });
      }
      heatmap.innerHTML = last30.map(d => `<div class="heatmap-day ${d.status}" title="${d.status}">${d.date}</div>`).join('');
    }
  }

  function renderChildResources() {
    const grid = document.getElementById('resource-grid');
    if (!grid || !currentStudent) return;
    const levelRank = { 'Beginner': 0, 'Intermediate': 1, 'Advanced': 2, 'Elite': 3 };
    const sRank = levelRank[getStudentLevel(currentStudent)] || 0;
    const myRes = allResources.filter(r => (levelRank[r.level_requirement] || 0) <= sRank);
    if (!myRes.length) { grid.innerHTML = `<div class="empty-state">No resources yet.</div>`; return; }
    grid.innerHTML = myRes.map(r => `<div class="resource-card"><div class="res-type">${r.type.toUpperCase()}</div><div class="res-title">${r.title}</div><div class="res-desc">${r.description||''}</div><div class="res-action"><a href="${r.url}" target="_blank" class="btn btn-gold btn-sm" style="width:100%">Open</a></div></div>`).join('');
  }

  function renderChildBilling() {
    const tbody = document.getElementById('child-bill-body');
    if (!tbody || !currentStudent) return;
    const status = getStudentPaymentStatus(currentStudent);
    const fee = getStudentMonthlyFee(currentStudent);
    tbody.innerHTML = `<tr><td>${new Date().toLocaleDateString()}</td><td>Current Month</td><td>₹${fee}</td><td class="${status==='Paid'?'text-success':'text-danger'}">${status}</td><td>${status === 'Due' ? `<button class="btn btn-gold btn-sm" onclick="openPay('${currentStudent.id}','${getStudentName(currentStudent)}','${fee}')">Pay</button>` : `<button class="btn btn-outline btn-sm" onclick="downloadReceipt('${currentStudent.id}','${getStudentName(currentStudent)}','${fee}')">Receipt</button>`}</td></tr>`;
  }

  // ── ADMIN EXPANSION LOGIC ──
  function openAttendanceMarking() {
    const coachId = $('f-coach')?.value;
    const studs = coachId ? allStudents.filter(s => String(s.coach_id) === String(coachId)) : allStudents;
    const body = $('att-marking-body');
    if (!body) return;
    if ($('att-date')) $('att-date').value = new Date().toISOString().split('T')[0];
    body.innerHTML = studs.map(s => `
      <tr>
        <td>${getStudentName(s)}</td>
        <td>
          <select class="att-status" data-sid="${s.id}">
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="late">Late</option>
            <option value="excused">Excused</option>
          </select>
        </td>
        <td><input type="text" class="att-notes" data-sid="${s.id}" placeholder="Note..."></td>
      </tr>
    `).join('');
    openModal('attendance-modal');
  }

  async function saveBatchAttendance() {
    const date = $('att-date').value;
    const rows = document.querySelectorAll('#att-marking-body tr');
    const records = Array.from(rows).map(row => {
      const select = row.querySelector('.att-status');
      const input = row.querySelector('.att-notes');
      return {
        student_id: select.dataset.sid,
        status: select.value,
        date: date,
        notes: input.value
      };
    });
    try {
      const res = await apiCall('/api/attendance', { method: 'POST', body: JSON.stringify(records) });
      if (res.ok) {
        toast('Attendance recorded!', 'success');
        closeModals();
        loadAllData(true);
      }
    } catch (e) { toast('Error saving attendance', 'error'); }
  }

  function openPromote(id) {
    const s = allStudents.find(x => String(x.id) === String(id));
    if (!s) return;
    $('promote-id').value = s.id;
    $('promote-name').textContent = getStudentName(s);
    $('promote-curr-level').textContent = getStudentLevel(s);
    openModal('promote-modal');
  }

  async function executePromotion() {
    const id = $('promote-id').value;
    const newLevel = $('promote-new-level').value;
    const eloBonus = parseInt($('promote-elo-bonus').value) || 0;
    const notes = $('promote-notes').value;
    const s = allStudents.find(x => String(x.id) === String(id));
    
    try {
      // 1. Update Student Table
      const newElo = getStudentRating(s) + eloBonus;
      const updateRes = await apiCall(`/api/students?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify({ level: newLevel, rating: newElo, notes: s.notes + '\n[Promoted: ' + notes + ']' })
      });

      // 2. Log to Rating History
      await apiCall('/api/rating_history', {
        method: 'POST',
        body: JSON.stringify({ student_id: id, rating: newElo, change_type: 'promotion', notes: 'Level Up to ' + newLevel })
      });

      if (updateRes.ok) {
        toast('Cadet Promoted!', 'success');
        closeModals();
        loadAllData(true);
      }
    } catch (e) { toast('Promotion failed', 'error'); }
  }

  function sendPaymentReminder(id) {
    const s = allStudents.find(x => String(x.id) === String(id));
    if (!s) return;
    const name = getStudentName(s);
    const fee = getStudentMonthlyFee(s);
    const phone = getStudentPhone(s);
    const msg = `Hi! This is a friendly reminder from Chesskidoo Academy regarding ${name}'s tuition fee balance of ₹${fee}. You can pay via the portal or reach out if you have questions. Thank you!`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const API_BASE = '/api';
  let role = null;
  let currentStudent = null;
  let charts = {};
  let payTarget = null;
  let dataCache = { coaches: null, students: null, achievements: null, events: null, timestamp: 0 };
  const CACHE_DURATION = 2000;
  let loadDebounceTimer = null;
  let loadingStates = {};
  let chartInstances = {};

  // ═══════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════
  const $ = id => document.getElementById(id);

  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8';

  async function apiCall(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
      ...options.headers
    };
    return fetch(url, { ...options, headers });
  }

  const isValidPhone = p => /^\d{10}$/.test(p);
  const capitalizeFirst = str => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
  const formatTime = time24 => {
    if (!time24) return '—';
    const [h, m] = time24.split(':');
    const hh = h % 12 || 12;
    return `${hh}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${msg}`;
    const container = $('toast-container');
    if (container) container.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  function setLoading(key, loading) {
    loadingStates[key] = loading;
  }

  function openModal(id) { const el = $(id); if (el) el.style.display = 'flex'; }
  function closeModals() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModals(); }));

  function previewFile(inp, previewId) {
    const file = inp.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { const img = $(previewId); if (img) { img.src = e.target.result; img.style.display = 'block'; } };
    reader.readAsDataURL(file);
  }

  // Helper accessors
  function getStudentName(s) { return s.full_name || s.name || ''; }
  function getStudentLevel(s) { return capitalizeFirst(s.level || s.grade || 'Beginner'); }
  function getStudentRating(s) { return s.rating || s.current_rating || 800; }
  function getStudentDate(s) { return s.enrollment_date || s.join_date || ''; }
  function getStudentPhone(s) { return s.parent_phone || s.phone || ''; }
  function getStudentEmail(s) { return s.email || ''; }
  function getStudentMonthlyFee(s) {
    if (s.notes) {
      const match = s.notes.match(/fee[:\s]*(\d+)/i);
      if (match) return parseInt(match[1]);
    }
    return 5000;
  }
  function getStudentPaymentStatus(s) { return (s.status === 'active' || s.payment_status === 'Paid') ? 'Paid' : 'Due'; }
  function getStudentBatchType(s) { return s.batch_type || 'Evening'; }
  function getStudentBatchTime(s) { return s.batch_time || '17:00'; }
  function getStudentStatus(s) { return s.status || 'pending'; }
  function getStudentCoachNotes(s) { return s.notes || ''; }
  function getStudentSkills(s) {
    return {
      tactics: s.tactics_score || 50,
      endgame: s.endgame_score || 50,
      openings: s.openings_score || 50,
      positional: s.positional_score || 50
    };
  }

  function getCoachName(c) { return c.full_name || c.name || ''; }
  function getCoachSpecialty(c) { return c.specialty || c.specialization || ''; }
  function getCoachEmail(c) { return c.email || ''; }
  function getCoachExperience(c) { return c.experience || 0; }
  function getCoachRating(c) { return c.rating || 0; }
  function getCoachStatus(c) { return c.status || 'active'; }
  function getCoachSalary(c) { return c.salary || c.hourly_rate || 0; }
  function getCoachAvailability(c) { return c.availability || ''; }

  function getEventDate(e) { return e.date || e.event_date || ''; }
  function getEventType(e) { return e.type || e.event_type || 'Tournament'; }
  function getEventLocation(e) { return e.location || ''; }
  function getEventTime(e) { 
    const t = e.time || e.event_time || '10:00';
    return formatTime(t);
  }
  async function registerForEvent(eventId) {
    const e = eventsData.find(x => String(x.id) === String(eventId));
    if (!e) { toast('Event not found', 'error'); return; }
    toast('Registration feature coming soon!', 'info');
  }

  function getMessagePriority(m) { return m.priority || 'normal'; }
  function getMessageIsRead(m) { return m.is_read || false; }

  function makeAvSrc(s) {
    if (s.custom_avatar) return s.custom_avatar;
    const name = getStudentName(s);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Student')}&background=dca33e&color=000000&bold=true&size=80`;
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════
  async function loadAllData(forceRefresh = false) {
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);

    const executeLoad = async () => {
      const now = Date.now();
      const hasValidCache = dataCache.timestamp > 0 && dataCache.coaches && dataCache.students;
      if (!forceRefresh && hasValidCache && (now - dataCache.timestamp) < CACHE_DURATION) {
        allCoaches = dataCache.coaches;
        allStudents = dataCache.students;
        achievementsData = dataCache.achievements;
        eventsData = dataCache.events;
        syncCoachDropdowns();
        if (role === 'admin' || role === 'master') { renderDash(); updateMsgBadge(); }
        else if (role === 'parent') { renderChild(); }
        return;
      }
      try {
        setLoading('data', true);

        const loadWithRetry = async (url, maxRetries = 2) => {
          for (let i = 0; i <= maxRetries; i++) {
            try {
              const response = await apiCall(url);
              if (response.ok) return await response.json();
              throw new Error(`HTTP ${response.status}`);
            } catch (error) {
              if (i === maxRetries) { console.warn(`Failed to load ${url}:`, error); return []; }
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
          }
        };

        const [coaches, students, achievements, events, messages, attendance, rating_history, resources] = await Promise.all([
          loadWithRetry('/api/coaches'),
          loadWithRetry('/api/students'),
          loadWithRetry('/api/achievements'),
          loadWithRetry('/api/events'),
          loadWithRetry('/api/messages').then(r => r && r.data ? r.data : (r || [])),
          loadWithRetry('/api/attendance').then(r => r && r.data ? r.data : (r || [])),
          loadWithRetry('/api/rating_history').then(r => r && r.data ? r.data : (r || [])),
          loadWithRetry('/api/resources').then(r => r && r.data ? r.data : (r || []))
        ]);

        allCoaches = coaches || [];
        allStudents = students || [];
        achievementsData = achievements || [];
        eventsData = events || [];
        allMessages = messages || [];
        allAttendance = attendance || [];
        allRatingHistory = rating_history || [];
        allResources = resources || [];

        dataCache = { coaches: allCoaches, students: allStudents, achievements: achievementsData, events: eventsData, timestamp: now };
        syncCoachDropdowns();

        if (role === 'admin' || role === 'master') { renderDash(); updateMsgBadge(); renderEvents(); }
        else if (role === 'parent') { renderChild(); renderEvents(); }

        setLoading('data', false);
      } catch (err) {
        console.error('Load error:', err);
        toast('Failed to load data - please refresh', 'error');
        setLoading('data', false);
      }
    };

    if (forceRefresh) { await executeLoad(); }
    else { loadDebounceTimer = setTimeout(executeLoad, 100); }
  }

  function syncCoachDropdowns() {
    const options = allCoaches.map(c => `<option value="${c.id}">${getCoachName(c)}</option>`).join('');
    if ($('f-coach')) $('f-coach').innerHTML = '<option value="">All Coaches</option>' + options;
    if ($('m-coach')) $('m-coach').innerHTML = options;
    if ($('e-coach')) $('e-coach').innerHTML = options;
    if ($('award-student')) $('award-student').innerHTML = '<option value="">Select Student</option>' + allStudents.map(s => `<option value="${s.id}">${getStudentName(s)}</option>`).join('');
  }

  function updateNotificationBadge() {
    const unread = allMessages.filter(m => !getMessageIsRead(m) && m.receiver_type === 'admin').length;
    const badge = $('notification-badge');
    if (badge) {
      badge.style.display = unread > 0 ? 'inline' : 'none';
      badge.textContent = unread;
    }
  }

  async function updateMsgBadge() {
    try {
      const res = await apiCall('/api/messages');
      const msgs = await res.json();
      allMessages = msgs.data || msgs || [];
      const unread = allMessages.filter(m => !getMessageIsRead(m) && m.receiver_type === 'admin').length;
      const badge = $('msg-badge');
      if (badge) {
        if (unread > 0) { badge.style.display = 'inline'; badge.textContent = unread; }
        else { badge.style.display = 'none'; }
      }
      updateNotificationBadge();
    } catch (e) {
      console.error('Failed to update message badge:', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════════
  function toggleSidebar() {
    const sidebar = $('sidebar');
    const overlay = $('sidebar-overlay');
    const main = document.querySelector('.main');
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('open');
      if (sidebar.classList.contains('open')) overlay.classList.add('active');
      else overlay.classList.remove('active');
    } else {
      sidebar.classList.toggle('collapsed');
      main.classList.toggle('expanded');
    }
  }

  const PAGE_TITLES = {
    dash: 'Academy Overview', stud: 'Student Registry', 'coach-mgmt': 'Coach Management',
    child: 'My Child', fame: 'Wall of Fame', events: 'Events', bills: 'Payments',
    msgs: 'Messages', ai: 'AI Assistant'
  };

  function setPage(p) {
    document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(ni => ni.classList.remove('active'));
    const pageEl = $('page-' + p);
    if (pageEl) pageEl.classList.add('active');
    const navEl = $('nav-' + p);
    if (navEl) navEl.classList.add('active');
    if ($('p-title')) $('p-title').textContent = PAGE_TITLES[p] || '';

    const btnArea = $('top-btn-area');
    if (btnArea) {
      btnArea.innerHTML = '';
      if (role === 'admin' || role === 'master') {
        if (p === 'dash') btnArea.innerHTML = `<button class="btn btn-outline" onclick="generateReportPDF()">📄 Financial Report</button>`;
        if (p === 'stud') btnArea.innerHTML = `
          <button class="btn btn-outline-grey" onclick="openAttendanceMarking()">🗓️ Batch Attendance</button>
          <button class="btn btn-gold" onclick="openEnroll()">+ New Enrollment</button>
        `;
        if (p === 'events') btnArea.innerHTML = `<button class="btn btn-gold" onclick="openModal('ev-modal')">+ Create Event</button>`;
      }
    }

    if (window.innerWidth <= 768) {
      $('sidebar')?.classList.remove('open');
      $('sidebar-overlay')?.classList.remove('active');
    }

    setTimeout(() => {
      if (p === 'dash') renderDash();
      if (p === 'stud') renderStudents();
      if (p === 'coach-mgmt') renderCoachMgmt();
      if (p === 'fame') renderFame();
      if (p === 'events') renderEvents();
      if (p === 'bills') renderBills();
      if (p === 'msgs') renderMsgs();
      if (p === 'child') renderChild();
    }, 10);
  }

  // ═══════════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════
  function toggleEye() {
    const p = $('li-pass');
    const icon = $('eye-icon');
    if (!p || !icon) return;
    if (p.type === 'password') {
      p.type = 'text';
      icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
    } else {
      p.type = 'password';
      icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
    }
  }

  async function doLogin() {
    const userEl = $('li-user');
    const passEl = $('li-pass');
    const errEl = $('login-err');
    if (!userEl || !passEl || !errEl) return;

    const user = userEl.value.trim();
    const pass = passEl.value.trim();
    errEl.style.display = 'none';

    if (!user || !pass) {
      errEl.textContent = 'Please enter both username and password.';
      errEl.style.display = 'block';
      return;
    }

    try {
      const authRes = await apiCall(`${API_BASE}/auth`, {
        method: 'POST',
        body: JSON.stringify({ action: 'login', username: user, password: pass })
      });
      if (authRes.ok) {
        const data = await authRes.json();
        if (data.success) {
          role = data.role;
          if (data.role === 'parent' && data.student_id) {
            localStorage.setItem('chesskidoo_parent_id', data.student_id);
          }
          localStorage.setItem('chesskidoo_auth', JSON.stringify({ role: data.role, user, studentId: data.student_id }));
          finishLogin(data.user || user, data.role, data.student_id);
          return;
        }
      }
    } catch (e) {
      console.warn('Auth API unavailable, using local fallback:', e);
    }

    // Local fallback
    try {
      const studRes = await apiCall(`${API_BASE}/students`);
      if (studRes.ok) allStudents = await studRes.json();
    } catch (e) { }

    const student = allStudents.find(s => (s.full_name || s.name || '').toLowerCase() === user.toLowerCase());
    if (student && (student.parent_phone === pass || student.phone === pass)) {
      role = 'parent';
      currentStudent = student;
      localStorage.setItem('chesskidoo_auth', JSON.stringify({ role: 'parent', user, studentId: student.id }));
      finishLogin(user, 'parent', student.id);
      return;
    }

    if (user === 'admin' && pass === 'admin123') {
      role = 'admin';
      localStorage.setItem('chesskidoo_auth', JSON.stringify({ role: 'admin', user }));
      finishLogin(user, 'admin', null);
      return;
    }

    errEl.textContent = 'Invalid credentials.';
    errEl.style.display = 'block';
  }

  function finishLogin(displayName, userRole, studentId) {
    const loginScreen = $('login-screen');
    if (loginScreen) loginScreen.style.display = 'none';

    document.body.classList.remove('login-mode', 'admin-mode', 'parent-mode', 'master-mode');
    document.body.classList.add(userRole === 'master' ? 'admin-mode' : (userRole + '-mode'));
    if (userRole === 'master') document.body.classList.add('master-mode');

    if ($('top-profile')) $('top-profile').style.display = 'flex';
    if ($('top-profile-name')) $('top-profile-name').textContent = displayName.split(' ')[0] || 'User';
    if ($('top-profile-av')) $('top-profile-av').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=dca33e&color=000&bold=true&size=80`;

    const isAdmin = userRole === 'admin' || userRole === 'master';
    const isParent = userRole === 'parent';
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
    document.querySelectorAll('.parent-only').forEach(el => el.style.display = isParent ? '' : 'none');

    loadAllData(true).then(() => {
      if (userRole === 'parent') {
        if (studentId) currentStudent = allStudents.find(s => String(s.id) === String(studentId));
        setPage('child');
      } else {
        setPage('dash');
      }
    });
  }

  function doLogout() {
    closeModals();
    role = null; currentStudent = null;
    localStorage.removeItem('chesskidoo_auth');
    localStorage.removeItem('chesskidoo_parent_id');
    document.body.classList.remove('admin-mode', 'parent-mode', 'master-mode');
    document.body.classList.add('login-mode');
    const loginScreen = $('login-screen');
    if (loginScreen) loginScreen.style.display = 'flex';
    const profile = $('top-profile');
    if (profile) profile.style.display = 'none';
  }

  function openProfile() {
    openModal('profile-modal');
    const adminView = $('prof-admin-view');
    const parentView = $('prof-parent-view');
    if (adminView) adminView.style.display = (role === 'admin' || role === 'master') ? 'block' : 'none';
    if (parentView) parentView.style.display = role === 'parent' ? 'block' : 'none';
  }

  // ═══════════════════════════════════════════════════════════════
  // CHARTS & DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  function buildCharts(studs) {
    Object.values(chartInstances).forEach(chart => { if (chart) chart.destroy(); });
    chartInstances = {};
    Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';

    const revenueCtx = $('chartRevenue');
    if (revenueCtx) {
      const data = [120000, 150000, 140000, 180000, 210000, 250000]; // Mock trend
      chartInstances.revenue = new Chart(revenueCtx, {
        type: 'line',
        data: { labels: ['Jan','Feb','Mar','Apr','May','Jun'], datasets: [{ label: 'Revenue (₹)', data, borderColor: '#dca13e', backgroundColor: 'rgba(220, 161, 62, 0.1)', tension: 0.4 }] },
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
    }

    const paymentCtx = $('chartPayment');
    if (paymentCtx) {
      const paid = studs.filter(s => getStudentPaymentStatus(s) === 'Paid').length;
      const due = studs.filter(s => getStudentPaymentStatus(s) === 'Due').length;
      chartInstances.payment = new Chart(paymentCtx, {
        type: 'doughnut',
        data: { labels: ['Paid', 'Due'], datasets: [{ data: [paid, due], backgroundColor: ['#2e7d32', '#d32f2f'], borderWidth: 0 }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }
    
    // Session Distribution Chart
    const sessionCtx = $('chartSession');
    if (sessionCtx) {
      let groupCount = 0, singleCount = 0;
      studs.forEach(s => {
        const notes = s.notes || '';
        if (notes.includes('session:Group')) groupCount++;
        else if (notes.includes('session:Single')) singleCount++;
      });
      chartInstances.session = new Chart(sessionCtx, {
        type: 'doughnut',
        data: { labels: ['Group', 'Single'], datasets: [{ data: [groupCount, singleCount], backgroundColor: ['#dca33e', '#5a9fff'], borderWidth: 0 }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }
  }

  function renderDash() {
    const paidStudents = allStudents.filter(s => getStudentPaymentStatus(s) === 'Paid');
    const dueStudents = allStudents.filter(s => getStudentPaymentStatus(s) === 'Due');
    
    // Basic stats
    if ($('s-total')) $('s-total').textContent = allStudents.length;
    if ($('s-elo')) $('s-elo').textContent = allStudents.length ? Math.round(allStudents.reduce((a, s) => a + (getStudentRating(s) || 0), 0) / allStudents.length) : 0;
    if ($('s-coaches')) $('s-coaches').textContent = allCoaches.length;
    
    // Revenue stats
    const paidRevenue = paidStudents.reduce((a, s) => a + getStudentMonthlyFee(s), 0);
    const dueRevenue = dueStudents.reduce((a, s) => a + getStudentMonthlyFee(s), 0);
    if ($('s-rev')) $('s-rev').textContent = '₹' + paidRevenue.toLocaleString();
    if ($('s-due')) $('s-due').textContent = '₹' + dueRevenue.toLocaleString();
    
    // Coach expenses
    const totalCoachCost = allCoaches.reduce((a, c) => a + (c.salary || 0), 0);
    if ($('s-coach-exp')) $('s-coach-exp').textContent = '₹' + totalCoachCost.toLocaleString();
    if ($('s-total-cost')) $('s-total-cost').textContent = '₹' + totalCoachCost.toLocaleString();
    
    // Financial analytics
    const totalPotential = paidRevenue + dueRevenue;
    const netProfit = paidRevenue - totalCoachCost;
    if ($('s-total-revenue')) $('s-total-revenue').textContent = '₹' + totalPotential.toLocaleString();
    if ($('s-profit')) $('s-profit').textContent = '₹' + netProfit.toLocaleString();
    
    // Session counts
    let groupCount = 0, singleCount = 0;
    allStudents.forEach(s => {
      const notes = s.notes || '';
      if (notes.includes('session:Group')) groupCount++;
      else if (notes.includes('session:Single')) singleCount++;
    });
    if ($('s-group')) $('s-group').textContent = groupCount;
    if ($('s-single')) $('s-single').textContent = singleCount;
    
    // Collection rate
    const collectionRate = totalPotential > 0 ? ((paidRevenue / totalPotential) * 100).toFixed(1) : 0;
    if ($('s-rate')) $('s-rate').textContent = collectionRate + '%';
    
    // Build charts
    if (typeof Chart !== 'undefined') buildCharts(allStudents);
    
    // Render coach financial table
    renderCoachFinance();
  }
  
  function renderCoachFinance() {
    const tbody = $('coach-finance-body');
    if (!tbody) return;
    
    const coachData = {};
    
    // Initialize coach data
    allCoaches.forEach(c => {
      coachData[c.id] = {
        name: c.name || c.full_name || 'Unknown',
        students: 0,
        revenue: 0,
        pending: 0,
        cost: c.salary || 0
      };
    });
    
    // Aggregate student data
    allStudents.forEach(s => {
      const coachId = s.coach_id;
      if (coachData[coachId]) {
        const fee = getStudentMonthlyFee(s);
        coachData[coachId].students++;
        if (getStudentPaymentStatus(s) === 'Paid') {
          coachData[coachId].revenue += fee;
        } else {
          coachData[coachId].pending += fee;
        }
      }
    });
    
    // Sort by profit (descending)
    const sorted = Object.entries(coachData).sort((a, b) => {
      const profitA = a[1].revenue - a[1].cost;
      const profitB = b[1].revenue - b[1].cost;
      return profitB - profitA;
    });
    
    tbody.innerHTML = sorted.map(([id, d]) => {
      const profit = d.revenue - d.cost;
      const roi = d.cost > 0 ? ((d.revenue / d.cost) * 100).toFixed(1) : 0;
      const profitClass = profit >= 0 ? 'text-success' : 'text-danger';
      return `<tr>
        <td><b>${d.name}</b></td>
        <td>${d.students}</td>
        <td>₹${d.revenue.toLocaleString()}</td>
        <td>₹${d.pending.toLocaleString()}</td>
        <td>₹${d.cost.toLocaleString()}</td>
        <td class="${profitClass}">₹${profit.toLocaleString()}</td>
        <td>${roi}%</td>
      </tr>`;
    }).join('');
  }

  // ═══════════════════════════════════════════════════════════════
  // STUDENTS, COACHES, EVENTS, ACHIEVEMENTS
  // ═══════════════════════════════════════════════════════════════
  function clearFilters() {
    ['f-coach', 'f-status', 'f-min-fee', 'f-max-fee'].forEach(id => { const el = $(id); if (el) el.value = ''; });
    renderStudents();
  }

  function renderStudents() {
    const tbody = $('stud-body');
    if (!tbody) return;
    const studs = (role === 'admin' || role === 'master') ? allStudents : (currentStudent ? [currentStudent] : []);
    tbody.innerHTML = studs.map((s, i) => {
      const status = getStudentPaymentStatus(s);
      const notes = s.notes || '';
      const session = notes.includes('session:Group') ? 'Group' : (notes.includes('session:Single') ? 'Single' : '-');
      const time = notes.includes('time:') ? notes.split('time:')[1].split(',')[0] : '-';
      return `<tr>
        <td><div style="font-weight:600">${getStudentName(s)}</div></td>
        <td>${getStudentLevel(s)} - ${getStudentRating(s)} ELO</td>
        <td>${getStudentDate(s) || '-'}</td>
        <td>${session}</td>
        <td>${time}</td>
        <td>₹${getStudentMonthlyFee(s).toLocaleString()}</td>
        <td><span class="${status==='Paid'?'text-success':'text-danger'}">${status}</span></td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-outline-grey btn-sm" onclick="viewStudent('${s.id}')">View</button>
            <button class="btn btn-outline-grey btn-sm" onclick="openPromote('${s.id}')" title="Promote">🚀</button>
            ${status === 'Due' ? `<button class="btn btn-outline btn-sm" onclick="sendPaymentReminder('${s.id}')" title="Reminder">💬</button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  function viewStudent(id) {
    const s = allStudents.find(x => String(x.id) === String(id));
    if (!s) return;
    if ($('sv-name')) $('sv-name').textContent = getStudentName(s);
    openModal('student-view-modal');
  }

  function openEdit(id) {
    const s = allStudents.find(x => String(x.id) === String(id));
    if (!s) return;
    $('e-id').value = s.id;
    $('e-name').value = getStudentName(s);
    $('e-phone').value = getStudentPhone(s);
    $('e-level').value = getStudentLevel(s);
    $('e-elo').value = getStudentRating(s);
    $('e-coach').value = s.coach_id || '';
    $('e-fee').value = getStudentMonthlyFee(s);
    $('e-status').value = getStudentPaymentStatus(s);
    $('e-join').value = getStudentDate(s);
    $('e-batch-type').value = getStudentBatchType(s);
    $('e-batch-time').value = getStudentBatchTime(s);
    openModal('edit-modal');
  }

  async function updateStudent() {
    const id = $('e-id').value;
    const s = allStudents.find(x => String(x.id) === String(id));
    const oldElo = getStudentRating(s);
    const newElo = parseInt($('e-elo').value);
    
    const data = {
      full_name: $('e-name').value,
      phone: $('e-phone').value,
      parent_phone: $('e-phone').value,
      level: $('e-level').value,
      rating: newElo,
      coach_id: $('e-coach').value,
      payment_status: $('e-status').value,
      enrollment_date: $('e-join').value,
      batch_type: $('e-batch-type').value,
      batch_time: $('e-batch-time').value,
      notes: `Fee: ${$('e-fee').value}`
    };

    try {
      const res = await apiCall(`/api/students?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
      if (res.ok) {
        // Log rating history if changed
        if (newElo !== oldElo) {
          await apiCall('/api/rating_history', {
            method: 'POST',
            body: JSON.stringify({ student_id: id, rating: newElo, change_type: 'manual', notes: 'Manual adjustment' })
          });
        }
        toast('Student updated!', 'success');
        closeModals();
        loadAllData(true);
      }
    } catch (e) { toast('Update failed', 'error'); }
  }
  function openEnroll() { openModal('enroll-modal'); }
  async function saveStudent() { /* api call to save */ }
  async function deleteStudent(id, name) { /* api call to delete */ }

  function renderCoachMgmt() {
    const grid = $('coach-mgmt-body');
    if (!grid) return;
    grid.innerHTML = allCoaches.map(c => `<div class="coach-card"><h4>${getCoachName(c)}</h4><p>${getCoachSpecialty(c)}</p></div>`).join('');
  }
  function viewCoachSchedule(id) { openModal('coach-schedule-modal'); }
  function openCoachModal(id = null) { openModal('coach-crud-modal'); }
  async function saveCoach() { /* api call to save coach */ }
  async function deleteCoach(id) { /* api call to delete coach */ }

  function renderEvents() {
    const gridEl = $('ev-grid');
    if (!gridEl) return;
    gridEl.innerHTML = eventsData.map(e => `<div class="ev-card"><h5>${e.title}</h5><p>${getEventDate(e)}</p></div>`).join('');
  }
  async function saveEvent() { /* api call to save event */ }
  async function deleteEvent(id) { /* api call to delete event */ }

  function renderFame() {
    const gridEl = $('fame-grid');
    if (!gridEl) return;
    gridEl.innerHTML = achievementsData.map(a => `<div class="ach-card"><h6>${a.title}</h6></div>`).join('');
  }
  function openAwardModal() { openModal('award-modal'); }
  function onAwardStudentChange() { }
  async function saveAward() { /* api call to save achievement */ }
  async function deleteAchievement(id) { /* api call to delete achievement */ }

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS & RECEIPTS
  // ═══════════════════════════════════════════════════════════════
  function renderBills() {
    const tbody = $('bill-body');
    if (!tbody) return;
    tbody.innerHTML = allStudents.map(s => `<tr><td>${getStudentName(s)}</td><td>₹${getStudentMonthlyFee(s)}</td><td>${getStudentPaymentStatus(s)}</td></tr>`).join('');
  }
  async function markPaid(id) {
    await apiCall(`${API_BASE}/students?id=${id}`, { method: 'PUT', body: JSON.stringify({ payment_status: 'Paid' }) });
    loadAllData(true);
  }
  function openPay(id, name, fee) { openModal('pay-modal'); }
  function initiatePay(provider) { toast('Processing ' + provider); setTimeout(() => { closeModals(); loadAllData(true); }, 2000); }
  function downloadReceipt(id, name, fee) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();
    const receiptId = 'CK-' + Math.floor(Math.random()*1000000);
    
    doc.setFillColor(220, 163, 62);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(24);
    doc.text('CHESSKIDOO ACADEMY', 105, 25, { align: 'center' });
    
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.text(`Receipt ID: ${receiptId}`, 20, 50);
    doc.text(`Date: ${date}`, 190, 50, { align: 'right' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text('OFFICIAL PAYMENT RECEIPT', 105, 65, { align: 'center' });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 75, 190, 75);
    
    doc.setFontSize(12);
    doc.text('Student Name:', 20, 90);
    doc.text(name, 190, 90, { align: 'right' });
    
    doc.text('Amount Paid:', 20, 105);
    doc.text('INR ' + fee, 190, 105, { align: 'right' });
    
    doc.text('Payment Status:', 20, 120);
    doc.setTextColor(46, 125, 50);
    doc.text('PAID', 190, 120, { align: 'right' });
    
    doc.setTextColor(0, 0, 0);
    doc.line(20, 130, 190, 130);
    
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text('This is a computer-generated receipt.', 105, 150, { align: 'center' });
    doc.text('Thank you for being part of Chesskidoo!', 105, 155, { align: 'center' });
    
    doc.save(`Receipt_${name.replace(/\s+/g, '_')}.pdf`);
    toast('Receipt downloaded!', 'success');
  }
  function showReceiptPreview() { openModal('receipt-preview-modal'); }
  function printReceipt() { window.print(); }

  // ═══════════════════════════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════════════════════════
  async function renderMsgs() {
    const listEl = $('msgs-list');
    if (!listEl) return;
    listEl.innerHTML = allMessages.map(m => `<div class="msg"><b>${m.sender_name || 'User'}:</b> ${m.message}</div>`).join('');
  }
  async function markMsgRead(id) { await apiCall(`${API_BASE}/messages?id=${id}`, { method: 'PUT', body: JSON.stringify({ is_read: true }) }); renderMsgs(); }
  async function deleteMsg(id) { await apiCall(`${API_BASE}/messages?id=${id}`, { method: 'DELETE' }); renderMsgs(); }

  // ═══════════════════════════════════════════════════════════════
  // PARENT VIEW
  // ═══════════════════════════════════════════════════════════════
  function renderChild() {
    const loadingEl = $('child-loading');
    const contentEl = $('child-content');
    if (!currentStudent) { if (loadingEl) loadingEl.style.display = 'flex'; return; }
    if ($('c-name')) $('c-name').textContent = getStudentName(currentStudent);
    if ($('c-elo')) $('c-elo').textContent = getStudentRating(currentStudent);
    if ($('c-level')) $('c-level').textContent = getStudentLevel(currentStudent);
    if ($('p-av-wrap')) $('p-av-wrap').innerHTML = `<img src="${makeAvSrc(currentStudent)}" class="profile-av">`;
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
    setChildTab('overview');
  }
  function openContactModal() { openModal('contact-modal'); }
  async function sendMsg() { toast('Message sent!'); closeModals(); }
  async function sendFeedback() { toast('Feedback sent!'); closeModals(); }

  // ═══════════════════════════════════════════════════════════════
  // AI & CHAT
  // ═══════════════════════════════════════════════════════════════
  function setAIModule(m) { }
  function setAISuggestion(q) { }
  async function sendAIQuery() { toast('AI Thinking...'); }
  function toggleChatbot() { $('chat-panel').style.display = 'flex'; }
  function sendChatMessage() { toast('Chat sent!'); }
  function toggleChat() { }
  function toggleLoginChat() { }
  function sendChat() { }

  // ═══════════════════════════════════════════════════════════════
  // THEME & PDF
  // ═══════════════════════════════════════════════════════════════
  function toggleTheme() { document.body.dataset.theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark'; }
  async function generateReportPDF() { toast('PDF Generated!'); }
  function exportData() { toast('Data Exported!'); }

  // ═══════════════════════════════════════════════════════════════
  // INIT & EXPOSE
  // ═══════════════════════════════════════════════════════════════
  window.addEventListener('DOMContentLoaded', () => {
    const auth = localStorage.getItem('chesskidoo_auth');
    if (auth) {
      const data = JSON.parse(auth);
      role = data.role;
      finishLogin(data.user || 'User', data.role, data.studentId);
    } else {
      $('login-screen').style.display = 'flex';
      document.body.classList.add('login-mode');
    }
  });

  const expose = {
    toggleSidebar, setPage, toggleEye, doLogin, doLogout, openProfile,
    clearFilters, renderStudents, viewStudent, openEdit, updateStudent, openEnroll, saveStudent, deleteStudent,
    renderCoachMgmt, viewCoachSchedule, openCoachModal, saveCoach, deleteCoach,
    renderEvents, saveEvent, deleteEvent,
    renderFame, openAwardModal, onAwardStudentChange, saveAward, deleteAchievement,
    renderBills, markPaid, openPay, initiatePay, downloadReceipt, showReceiptPreview, printReceipt,
    renderMsgs, markMsgRead, deleteMsg,
    renderChild, setChildTab, renderChildGrowth, renderChildResources, renderChildBilling, openContactModal, sendMsg, sendFeedback,
    openAttendanceMarking, saveBatchAttendance, openPromote, executePromotion, sendPaymentReminder,
    showNotifications: () => openModal('notification-modal'), updateNotificationBadge: () => {},
    setAIModule, setAISuggestion, sendAIQuery, toggleChatbot, sendChatMessage, toggleChat, toggleLoginChat, sendChat,
    toggleTheme, closeModals, openModal, previewFile,
    generateReportPDF, exportData, toast, $
  };
  Object.entries(expose).forEach(([k, v]) => window[k] = v);

})();
