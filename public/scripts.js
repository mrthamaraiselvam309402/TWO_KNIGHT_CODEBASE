/**
 * CHESSKIDOO ACADEMY - Complete Admin Panel Scripts
 * Fixed version - all critical bugs patched
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

        const [coaches, students, achievements, events, messages] = await Promise.all([
          loadWithRetry('/api/coaches'),
          loadWithRetry('/api/students'),
          loadWithRetry('/api/achievements'),
          loadWithRetry('/api/events'),
          loadWithRetry('/api/messages').then(r => r && r.data ? r.data : (r || []))
        ]);

        allCoaches = coaches || [];
        allStudents = students || [];
        achievementsData = achievements || [];
        eventsData = events || [];
        allMessages = messages || [];

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

  // FIX: updateNotificationBadge defined as a real function
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
      updateNotificationBadge(); // Now properly defined above
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
        if (p === 'stud') btnArea.innerHTML = `<button class="btn btn-gold" onclick="openEnroll()">+ New Enrollment</button>`;
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
  // AUTHENTICATION — FIXED: single doLogin, proper body classes
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

  // FIXED: single consolidated doLogin function
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

    // Try the auth API endpoint first
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
            // Will be set after student load in finishLogin
            localStorage.setItem('chesskidoo_parent_id', data.student_id);
          }
          localStorage.setItem('chesskidoo_auth', JSON.stringify({ role: data.role, user, studentId: data.student_id }));
          finishLogin(data.user || user, data.role, data.student_id);
          return;
        } else {
          // API returned error — fall through to local fallback
        }
      }
    } catch (e) {
      console.warn('Auth API unavailable, using local fallback:', e);
    }

    // Local fallback: load students for parent login check
    try {
      const studRes = await apiCall(`${API_BASE}/students`);
      if (studRes.ok) allStudents = await studRes.json();
    } catch (e) { /* continue */ }

    // Check parent credentials
    const student = allStudents.find(s =>
      (s.full_name || s.name || '').toLowerCase() === user.toLowerCase()
    );
    if (student && (student.parent_phone === pass || student.phone === pass)) {
      role = 'parent';
      currentStudent = student;
      localStorage.setItem('chesskidoo_auth', JSON.stringify({ role: 'parent', user, studentId: student.id }));
      finishLogin(user, 'parent', student.id);
      return;
    }

    // Admin fallback — you should set real credentials via env vars
    if ((user === 'admin' && pass === 'admin123') ||
        (user === (window.__ADMIN_USER || '') && pass === (window.__ADMIN_PASS || ''))) {
      role = 'admin';
      localStorage.setItem('chesskidoo_auth', JSON.stringify({ role: 'admin', user }));
      finishLogin(user, 'admin', null);
      return;
    }

    errEl.textContent = 'Invalid credentials. For parent access: use student name + parent phone number.';
    errEl.style.display = 'block';
  }

  // FIXED: finishLogin adds proper CSS classes to body
  function finishLogin(displayName, userRole, studentId) {
    const loginScreen = $('login-screen');
    if (loginScreen) loginScreen.style.display = 'none';

    // Remove old classes
    document.body.classList.remove('login-mode', 'admin-mode', 'parent-mode', 'master-mode');

    // Add correct class
    if (userRole === 'master') {
      document.body.classList.add('admin-mode', 'master-mode');
      if ($('top-profile')) $('top-profile').style.display = 'flex';
      if ($('top-profile-name')) $('top-profile-name').innerHTML = 'Master <span style="background:var(--gold);color:#000;padding:2px 8px;border-radius:10px;font-size:10px">👑</span>';
      if ($('top-profile-av')) $('top-profile-av').src = `https://ui-avatars.com/api/?name=Master&background=dca33e&color=000&bold=true&size=80`;
    } else if (userRole === 'admin') {
      document.body.classList.add('admin-mode');
      if ($('top-profile')) $('top-profile').style.display = 'flex';
      if ($('top-profile-name')) $('top-profile-name').textContent = displayName.split(' ')[0] || 'Admin';
      if ($('top-profile-av')) $('top-profile-av').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=dca33e&color=000&bold=true&size=80`;
    } else if (userRole === 'parent') {
      document.body.classList.add('parent-mode');
      if ($('top-profile')) $('top-profile').style.display = 'flex';
      if ($('top-profile-name')) $('top-profile-name').textContent = displayName.split(' ')[0];
      if ($('top-profile-av')) $('top-profile-av').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=dca33e&color=000&bold=true&size=80`;
    }

    // Apply visibility rules for role
    const isAdmin = userRole === 'admin' || userRole === 'master';
    const isParent = userRole === 'parent';
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
    document.querySelectorAll('.parent-only').forEach(el => el.style.display = isParent ? '' : 'none');

    // Load data then go to correct page
    loadAllData(true).then(() => {
      if (userRole === 'parent') {
        if (studentId) {
          currentStudent = allStudents.find(s => String(s.id) === String(studentId));
        }
        setPage('child');
      } else {
        setPage('dash');
      }
    });
  }

  function doLogout() {
    closeModals();
    role = null;
    currentStudent = null;
    localStorage.removeItem('chesskidoo_auth');
    localStorage.removeItem('chesskidoo_parent_id');
    document.body.classList.remove('admin-mode', 'parent-mode', 'master-mode');
    document.body.classList.add('login-mode');
    const loginScreen = $('login-screen');
    if (loginScreen) loginScreen.style.display = 'flex';
    const profile = $('top-profile');
    if (profile) profile.style.display = 'none';
    if ($('li-user')) $('li-user').value = '';
    if ($('li-pass')) $('li-pass').value = '';
  }

  function openProfile() {
    openModal('profile-modal');
    const adminView = $('prof-admin-view');
    const parentView = $('prof-parent-view');
    if (adminView) adminView.style.display = (role === 'admin' || role === 'master') ? 'block' : 'none';
    if (parentView) parentView.style.display = role === 'parent' ? 'block' : 'none';
    if ($('active-users-list')) $('active-users-list').innerHTML = `<div><span style="color:var(--success)">●</span> You (Current)</div>`;
  }

  // Check for existing session on load
  function checkAuth() {
    const auth = localStorage.getItem('chesskidoo_auth');
    if (auth) {
      try {
        const data = JSON.parse(auth);
        role = data.role;
        // Don't render yet — loadAllData will handle it
        finishLogin(data.user || 'User', data.role, data.studentId);
        return true;
      } catch (e) {
        localStorage.removeItem('chesskidoo_auth');
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // CHARTS
  // ═══════════════════════════════════════════════════════════════
  function buildCharts(studs) {
    Object.values(chartInstances).forEach(chart => { if (chart) chart.destroy(); });
    chartInstances = {};

    Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';

    const revenueCtx = $('chartRevenue');
    if (revenueCtx) {
      const monthlyRevenue = {};
      studs.filter(s => getStudentPaymentStatus(s) === 'Paid').forEach(s => {
        const date = new Date(getStudentDate(s) || Date.now());
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevenue[month] = (monthlyRevenue[month] || 0) + getStudentMonthlyFee(s);
      });
      const labels = [], data = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        labels.push(d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
        data.push(monthlyRevenue[month] || 0);
      }
      chartInstances.revenue = new Chart(revenueCtx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Revenue (₹)', data, borderColor: '#dca13e', backgroundColor: 'rgba(220, 161, 62, 0.1)', tension: 0.4 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => '₹' + v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { color: 'rgba(255,255,255,0.05)' } } } }
      });
    }

    const coachCtx = $('chartCoach');
    if (coachCtx) {
      const coachMap = {};
      studs.forEach(s => {
        const cid = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null);
        const cn = cid ? (allCoaches.find(c => String(c.id) === cid)?.full_name || allCoaches.find(c => String(c.id) === cid)?.name || 'Unknown') : 'Unassigned';
        coachMap[cn] = (coachMap[cn] || 0) + 1;
      });
      chartInstances.coach = new Chart(coachCtx, {
        type: 'bar',
        data: { labels: Object.keys(coachMap), datasets: [{ label: 'Students', data: Object.values(coachMap), backgroundColor: '#dca13e', borderColor: '#ffc863', borderWidth: 1 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } } }
      });
    }

    const paymentCtx = $('chartPayment');
    if (paymentCtx) {
      const paid = studs.filter(s => getStudentPaymentStatus(s) === 'Paid').length;
      const due = studs.filter(s => getStudentPaymentStatus(s) === 'Due').length;
      chartInstances.payment = new Chart(paymentCtx, {
        type: 'doughnut',
        data: { labels: ['Paid', 'Due'], datasets: [{ data: [paid, due], backgroundColor: ['#2e7d32', '#d32f2f'], borderWidth: 0 }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#ffffff' } } } }
      });
    }

    const batchCtx = $('chartBatch');
    if (batchCtx) {
      const morning = studs.filter(s => { const t = getStudentBatchTime(s); return t && (t.startsWith('08') || t.startsWith('09') || t.startsWith('10') || t.startsWith('11')); }).length;
      const evening = studs.length - morning;
      chartInstances.batch = new Chart(batchCtx, {
        type: 'pie',
        data: { labels: ['Morning', 'Evening'], datasets: [{ data: [morning, evening], backgroundColor: ['#1976d2', '#dca13e'], borderWidth: 0 }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#ffffff' } } } }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD — FIXED: all 6 stat cards now update properly
  // ═══════════════════════════════════════════════════════════════
  function renderDash() {
    const paidStudents = allStudents.filter(s => getStudentPaymentStatus(s) === 'Paid');
    const dueStudents = allStudents.filter(s => getStudentPaymentStatus(s) === 'Due');
    const avgElo = allStudents.length ? Math.round(allStudents.reduce((a, s) => a + (getStudentRating(s) || 0), 0) / allStudents.length) : 0;

    if ($('s-total')) $('s-total').textContent = allStudents.length;
    if ($('s-elo')) $('s-elo').textContent = avgElo;
    if ($('s-coaches')) $('s-coaches').textContent = allCoaches.length;

    const revenue = paidStudents.reduce((a, s) => a + getStudentMonthlyFee(s), 0);
    const dueAmount = dueStudents.reduce((a, s) => a + getStudentMonthlyFee(s), 0);
    const operationsCost = 15000;
    const totalSalaries = allCoaches.reduce((a, c) => a + getCoachSalary(c), 0);
    const spending = totalSalaries + operationsCost;
    const profit = revenue - spending;
    const collectionRate = (paidStudents.length + dueStudents.length) > 0
      ? Math.round((paidStudents.length / (paidStudents.length + dueStudents.length)) * 100)
      : 0;

    // FIX: Set all stat card values
    if ($('s-rev')) $('s-rev').textContent = '₹' + revenue.toLocaleString();
    if ($('s-due')) $('s-due').textContent = '₹' + dueAmount.toLocaleString();
    if ($('s-coach-exp')) $('s-coach-exp').textContent = '₹' + totalSalaries.toLocaleString();
    if ($('s-spend')) $('s-spend').textContent = '₹' + spending.toLocaleString();
    if ($('s-rate')) $('s-rate').textContent = collectionRate + '%';

    const profitEl = $('s-profit');
    if (profitEl) {
      if (profit >= 0) { profitEl.textContent = '₹' + profit.toLocaleString(); profitEl.style.color = 'var(--success)'; }
      else { profitEl.textContent = '-₹' + Math.abs(profit).toLocaleString(); profitEl.style.color = 'var(--danger)'; }
    }

    if (typeof Chart !== 'undefined') buildCharts(allStudents);
  }

  // ═══════════════════════════════════════════════════════════════
  // STUDENTS
  // ═══════════════════════════════════════════════════════════════
  function clearFilters() {
    ['f-coach', 'f-status', 'f-min-fee', 'f-max-fee'].forEach(id => { const el = $(id); if (el) el.value = ''; });
    renderStudents();
  }

  function renderStudents() {
    const tbody = $('stud-body');
    if (!tbody) return;
    const studs = (role === 'admin' || role === 'master') ? allStudents : (currentStudent ? [currentStudent] : []);
    if (!studs.length) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No students found.</div></td></tr>`; return; }

    let filtered = studs;
    const coachFilter = $('f-coach') ? $('f-coach').value : '';
    const statusFilter = $('f-status') ? $('f-status').value : '';
    const minFee = $('f-min-fee') ? parseInt($('f-min-fee').value) || 0 : 0;
    const maxFee = $('f-max-fee') ? parseInt($('f-max-fee').value) || Infinity : Infinity;

    if (coachFilter) filtered = filtered.filter(s => { const cid = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null); return cid === coachFilter; });
    if (statusFilter) filtered = filtered.filter(s => getStudentPaymentStatus(s) === statusFilter);
    filtered = filtered.filter(s => getStudentMonthlyFee(s) >= minFee && getStudentMonthlyFee(s) <= maxFee);

    const bulkBtn = $('bulk-pay-btn');
    if (bulkBtn) bulkBtn.style.display = (filtered.some(s => getStudentPaymentStatus(s) === 'Due') && (role === 'admin' || role === 'master')) ? 'inline-block' : 'none';

    tbody.innerHTML = filtered.map((s, i) => {
      const status = getStudentPaymentStatus(s);
      const fee = getStudentMonthlyFee(s);
      const safeName = getStudentName(s).replace(/'/g, "\\'");
      const cid = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null);
      const coachObj = allCoaches.find(c => String(c.id) === cid);
      const coachNameHtml = coachObj ? `<span class="badge badge-outline">${getCoachName(coachObj)}</span>` : `<span style="color:var(--ivory-dim)">None</span>`;

      let actionHtml = `<div style="display:flex;gap:4px"><button class="btn btn-outline-grey btn-sm" onclick="viewStudent('${s.id}')">View</button>`;
      if (role === 'admin' || role === 'master') {
        actionHtml += `<button class="btn btn-outline-grey btn-sm" onclick="openEdit('${s.id}')">Edit</button><button class="btn btn-danger btn-sm" onclick="deleteStudent('${s.id}','${safeName}')">Del</button>`;
      }
      if (status === 'Due') actionHtml += `<button class="btn btn-gold btn-sm" onclick="markPaid('${s.id}')">Pay</button>`;
      else actionHtml += `<button class="btn btn-outline-grey btn-sm" onclick="downloadReceipt('${s.id}','${safeName}','${fee}')">Receipt</button>`;
      actionHtml += `</div>`;

      return `<tr>
        <td><div style="font-family:'DM Mono';color:var(--ivory-dim);font-size:11px;margin-bottom:2px">#CK-${String(i+1).padStart(4,'0')}</div><div style="font-weight:600">${getStudentName(s)}</div></td>
        <td><div style="font-weight:500;margin-bottom:2px">${getStudentLevel(s)}</div><div style="font-size:11px;color:var(--gold);font-family:'DM Mono'">${getStudentRating(s)} ELO</div></td>
        <td style="font-family:'DM Mono';color:var(--ivory-dim)">${getStudentDate(s) || '-'}</td>
        <td>${coachNameHtml}</td>
        <td><div style="font-family:'DM Mono';font-size:13px;margin-bottom:2px">₹${fee}/mo</div><span class="${status==='Paid'?'text-success':'text-danger'}" style="font-size:11px;font-weight:600">${status}</span></td>
        <td>${actionHtml}</td>
      </tr>`;
    }).join('');
  }

  function viewStudent(id) {
    const s = allStudents.find(x => String(x.id) === String(id));
    if (!s) return;
    if ($('sv-av')) $('sv-av').src = makeAvSrc(s);
    if ($('sv-name')) $('sv-name').textContent = getStudentName(s);
    if ($('sv-level')) $('sv-level').textContent = getStudentLevel(s);
    if ($('sv-elo')) $('sv-elo').textContent = getStudentRating(s);
    if ($('sv-join')) $('sv-join').textContent = getStudentDate(s) || '—';
    const cid = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null);
    const coachName = cid ? (allCoaches.find(c => String(c.id) === cid)?.full_name || allCoaches.find(c => String(c.id) === cid)?.name || 'Unassigned') : 'Unassigned';
    if ($('sv-coach')) $('sv-coach').textContent = coachName;
    if ($('sv-batch')) $('sv-batch').textContent = getStudentBatchType(s) || '—';
    if ($('sv-fee')) $('sv-fee').textContent = getStudentMonthlyFee(s);
    if ($('sv-status')) $('sv-status').innerHTML = `<span class="${getStudentPaymentStatus(s) === 'Paid' ? 'text-success' : 'text-danger'}">${getStudentPaymentStatus(s)}</span>`;
    if ($('sv-phone')) $('sv-phone').textContent = getStudentPhone(s) || '—';
    if ($('sv-edit-btn')) $('sv-edit-btn').onclick = () => { closeModals(); openEdit(s.id); };
    openModal('student-view-modal');
  }

  function openEdit(id) {
    const s = allStudents.find(x => String(x.id) === String(id));
    if (!s) return;
    if ($('e-id')) $('e-id').value = s.id;
    if ($('e-name')) $('e-name').value = getStudentName(s);
    if ($('e-phone')) $('e-phone').value = getStudentPhone(s);
    if ($('e-elo')) $('e-elo').value = getStudentRating(s);
    if ($('e-level')) $('e-level').value = getStudentLevel(s);
    if ($('e-join')) $('e-join').value = getStudentDate(s);
    if ($('e-fee')) $('e-fee').value = getStudentMonthlyFee(s);
    if ($('e-status')) $('e-status').value = getStudentPaymentStatus(s);
    if ($('e-batch-type')) $('e-batch-type').value = getStudentBatchType(s);
    if ($('e-batch-time')) $('e-batch-time').value = getStudentBatchTime(s);
    const cid = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : '');
    if ($('e-coach')) $('e-coach').innerHTML = allCoaches.map(c => `<option value="${c.id}" ${cid === String(c.id) ? 'selected' : ''}>${getCoachName(c)}</option>`).join('');
    openModal('edit-modal');
  }

  async function updateStudent() {
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    const id = $('e-id') ? $('e-id').value : null;
    if (!id) return;
    const name = $('e-name') ? $('e-name').value.trim() : '';
    const phone = $('e-phone') ? $('e-phone').value.trim() : '';
    if (!name) { toast('Name required', 'error'); return; }
    if (!isValidPhone(phone)) { toast('Phone must be 10 digits', 'error'); return; }
    const data = {
      name, full_name: name, parent_phone: phone,
      rating: parseInt($('e-elo')?.value) || 800,
      grade: capitalizeFirst($('e-level')?.value || ''),
      level: capitalizeFirst($('e-level')?.value || ''),
      join_date: $('e-join')?.value || '',
      enrollment_date: $('e-join')?.value || '',
      coach_id: $('e-coach')?.value || null,
      status: $('e-status')?.value === 'Paid' ? 'active' : 'pending',
      notes: 'fee:' + (parseInt($('e-fee')?.value) || 5000)
    };
    try {
      const res = await apiCall(`${API_BASE}/students?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) { toast('Update failed: ' + (result.error || 'Unknown'), 'error'); return; }
      toast('Updated!', 'success');
      const updated = result.data || result;
      if (updated && updated.id) { allStudents = allStudents.map(s => String(s.id) === String(id) ? updated : s); dataCache.timestamp = Date.now(); }
      closeModals(); renderStudents(); renderDash(); renderBills();
    } catch (e) { toast('Update failed', 'error'); }
  }

  function openEnroll() {
    ['m-name','m-phone','m-elo','m-fee'].forEach(id => { const el = $(id); if (el) el.value = id === 'm-elo' ? '800' : id === 'm-fee' ? '5000' : ''; });
    if ($('m-join')) $('m-join').value = new Date().toISOString().split('T')[0];
    openModal('enroll-modal');
  }

  async function saveStudent() {
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    const name = $('m-name') ? $('m-name').value.trim() : '';
    const phone = $('m-phone') ? $('m-phone').value.trim() : '';
    if (!name) { toast('Name required', 'error'); return; }
    if (!isValidPhone(phone)) { toast('Phone must be 10 digits', 'error'); return; }
    const data = {
      name, full_name: name, parent_phone: phone,
      grade: $('m-level')?.value || 'Beginner',
      enrollment_date: $('m-join')?.value || new Date().toISOString().split('T')[0],
      coach_id: $('m-coach')?.value || null,
      rating: parseInt($('m-elo')?.value) || 800,
      notes: 'fee:' + (parseInt($('m-fee')?.value) || 5000),
      status: 'pending'
    };
    try {
      const res = await apiCall(`${API_BASE}/students`, { method: 'POST', body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) { toast('Failed: ' + (result.error || 'Unknown'), 'error'); return; }
      toast(`${name} enrolled!`, 'success');
      const newS = result.data || result;
      if (newS && newS.id) { allStudents = [newS, ...allStudents]; dataCache.timestamp = Date.now(); }
      closeModals(); renderStudents(); renderDash(); renderBills(); syncCoachDropdowns();
    } catch (e) { toast('Enrollment failed', 'error'); }
  }

  async function deleteStudent(id, name) {
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    try {
      const res = await apiCall(`${API_BASE}/students?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) { toast('Delete failed: ' + (result.error || 'Unknown'), 'error'); return; }
      toast('Removed.', 'success');
      allStudents = allStudents.filter(s => String(s.id) !== String(id));
      dataCache.timestamp = Date.now();
      renderStudents(); renderDash(); renderBills();
    } catch (e) { toast('Delete failed', 'error'); }
  }

  // ═══════════════════════════════════════════════════════════════
  // COACHES
  // ═══════════════════════════════════════════════════════════════
  function renderCoachMgmt() {
    const grid = $('coach-mgmt-body');
    if (!grid) return;
    if (!allCoaches.length) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No coaches found.</div>`; return; }
    grid.innerHTML = allCoaches.map(c => {
      const count = allStudents.filter(s => { const cid = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null); return cid === String(c.id); }).length;
      return `<div class="coach-card">
        <div class="coach-card-header">
          <img src="${c.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(getCoachName(c))}&background=dca33e&color=000`}" class="coach-card-av">
          <div><div class="coach-card-title">${getCoachName(c)}</div><div class="coach-card-subtitle">${getCoachSpecialty(c)}</div></div>
        </div>
        <div class="coach-card-stats">
          <div class="coach-stat"><span class="coach-stat-label">Students</span><span class="coach-stat-val">${count}</span></div>
          <div class="coach-stat"><span class="coach-stat-label">Rating</span><span class="coach-stat-val">⭐ ${getCoachRating(c)}</span></div>
          <div class="coach-stat"><span class="coach-stat-label">Contact</span><span class="coach-stat-val" style="font-size:13px">+91 ${c.phone || 'N/A'}</span></div>
          <div class="coach-stat"><span class="coach-stat-label">Salary</span><span class="coach-stat-val">₹${getCoachSalary(c).toLocaleString()}</span></div>
        </div>
        <div class="coach-card-actions">
          <button class="btn btn-outline-blue" onclick="viewCoachSchedule('${c.id}')">Schedule</button>
          <button class="btn btn-outline-grey" onclick="openCoachModal('${c.id}')">Edit</button>
          <button class="btn btn-danger" onclick="deleteCoach('${c.id}')">Del</button>
        </div>
      </div>`;
    }).join('');
  }

  function viewCoachSchedule(id) {
    const c = allCoaches.find(x => String(x.id) === String(id));
    if (!c) return;
    if ($('sched-coach-name')) $('sched-coach-name').textContent = getCoachName(c);
    const container = $('schedule-container');
    if (!container) return;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const myStudents = allStudents.filter(s => { const cid = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null); return cid === String(id); });
    if (!myStudents.length) { container.innerHTML = '<div class="empty-state">No batches.</div>'; }
    else {
      container.innerHTML = days.map(day => {
        const batches = myStudents.filter(s => (s.batch_type === 'Weekend' && (day === 'Saturday' || day === 'Sunday')) || (s.batch_type !== 'Weekend' && day !== 'Saturday' && day !== 'Sunday'));
        if (!batches.length) return `<div class="schedule-day"><span style="color:var(--ivory-dim)">${day}</span><span class="schedule-time" style="color:var(--ivory-dim)">OFF</span></div>`;
        return `<div class="schedule-day"><b>${day}</b><span class="schedule-time">${[...new Set(batches.map(s => formatTime(s.batch_time)))].join(', ')}</span></div>`;
      }).join('');
    }
    openModal('coach-schedule-modal');
  }

  function openCoachModal(id = null) {
    if (id) {
      const c = allCoaches.find(x => String(x.id) === String(id));
      if (!c) return;
      if ($('cm-id')) $('cm-id').value = c.id;
      if ($('cm-name')) $('cm-name').value = getCoachName(c);
      if ($('cm-spec')) $('cm-spec').value = getCoachSpecialty(c);
      if ($('cm-phone')) $('cm-phone').value = c.phone || '';
      if ($('cm-address')) $('cm-address').value = c.address || '';
      if ($('cm-photo')) $('cm-photo').value = c.photo_url || '';
      if ($('cm-salary')) $('cm-salary').value = c.salary || c.hourly_rate || '';
      if ($('cm-etc')) $('cm-etc').value = c.bio || '';
      if ($('coach-modal-title')) $('coach-modal-title').textContent = 'Edit Coach';
    } else {
      ['cm-id','cm-name','cm-spec','cm-phone','cm-address','cm-photo','cm-salary','cm-etc'].forEach(id => { const el = $(id); if (el) el.value = ''; });
      if ($('coach-modal-title')) $('coach-modal-title').textContent = 'Add Coach';
    }
    openModal('coach-crud-modal');
  }

  async function saveCoach() {
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    const id = $('cm-id') ? $('cm-id').value : '';
    const name = $('cm-name') ? $('cm-name').value.trim() : '';
    if (!name) { toast('Name required', 'error'); return; }
    const data = {
      full_name: name, name,
      specialization: $('cm-spec')?.value || '', specialty: $('cm-spec')?.value || '',
      phone: $('cm-phone')?.value || '', address: $('cm-address')?.value || '',
      photo_url: $('cm-photo')?.value || '',
      salary: parseInt($('cm-salary')?.value) || 0, hourly_rate: parseInt($('cm-salary')?.value) || 0,
      bio: $('cm-etc')?.value || '', status: 'active'
    };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/coaches?id=${encodeURIComponent(id)}` : `${API_BASE}/coaches`;
    try {
      const res = await apiCall(url, { method, body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) { toast('Failed: ' + (result.error || 'Unknown'), 'error'); return; }
      toast(`Coach ${id ? 'updated' : 'added'}!`, 'success');
      const updated = result.data || result;
      if (updated && updated.id) {
        if (id) allCoaches = allCoaches.map(c => String(c.id) === String(id) ? updated : c);
        else allCoaches = [updated, ...allCoaches];
        dataCache.timestamp = Date.now();
      }
      closeModals(); renderCoachMgmt(); renderStudents(); renderDash(); syncCoachDropdowns();
    } catch (e) { toast('Error saving coach', 'error'); }
  }

  async function deleteCoach(id) {
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    try {
      const res = await apiCall(`${API_BASE}/coaches?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) { toast('Delete failed: ' + (result.error || 'Unknown'), 'error'); return; }
      toast('Removed.', 'success');
      allCoaches = allCoaches.filter(c => String(c.id) !== String(id));
      dataCache.timestamp = Date.now();
      renderCoachMgmt(); renderStudents(); renderDash();
    } catch (e) { toast('Delete failed', 'error'); }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════════════
  function renderEvents() {
    const loadingEl = $('ev-loading');
    const gridEl = $('ev-grid');
    if (!loadingEl || !gridEl) return;
    loadingEl.style.display = 'none';
    gridEl.style.display = 'grid';

    if (!eventsData.length) {
      gridEl.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon" style="font-size:60px">📅</div><p>No events scheduled.</p></div>`;
      return;
    }

    gridEl.innerHTML = eventsData.map(e => {
      const dateStr = getEventDate(e);
      const isPast = dateStr && new Date(dateStr) < new Date();
      const eventTime = getEventTime(e);
      const registered = (e.participants || []).length || e.current_participants || 0;
      const max = e.max_participants || 50;
      const progress = Math.min(100, Math.round((registered / max) * 100));
      const location = getEventLocation(e);
      const type = getEventType(e);
      const prize = e.prize || 'Free';

      return `<div class="ev-card">
        <div class="ev-header">
          <span class="ev-type-badge">${type}</span>
          <span class="ev-date-badge">${dateStr || 'TBD'}</span>
        </div>
        <div class="ev-body">
          <div class="ev-title">${e.title || 'Chess Tournament'}</div>
          <div class="ev-meta">
            <span class="ev-meta-item ev-time">${eventTime}</span>
            <span class="ev-meta-item ev-loc">${location || 'TBD'}</span>
            <span class="ev-meta-item ev-prize">${prize}</span>
          </div>
          <div class="ev-desc">${e.description || 'Join us for an exciting chess event!'}</div>
        </div>
        <div class="ev-progress-wrap">
          <div class="ev-progress-label">
            <span>Registrations</span>
            <span>${registered}/${max}</span>
          </div>
          <div class="ev-progress-track">
            <div class="ev-progress-bar" style="width:${progress}%"></div>
          </div>
        </div>
        <div class="ev-footer">
          <div class="ev-spots"><strong>${max - registered}</strong> spots left</div>
          ${isPast ? 
            '<button class="btn-register registered" disabled>Event Completed</button>' : 
            role === 'parent' || role === null ? 
              `<button class="btn-register" onclick="registerForEvent('${e.id}')">Register Now</button>` :
              `<button class="btn-register" style="background:var(--surface2);color:var(--ivory3);border:1px solid var(--border)" disabled>View Only</button>`
          }
        </div>
        ${role === 'admin' || role === 'master' ? `
        <div class="ev-admin-actions" style="display:flex;gap:8px;padding:12px 22px;border-top:1px solid rgba(232,168,48,0.08);background:rgba(0,0,0,0.15)">
          <button class="btn-xs edit" onclick="editEvent('${e.id}')" style="flex:1">Edit</button>
          <button class="btn-xs del" onclick="deleteEvent('${e.id}')" style="flex:1;background:rgba(232,64,64,0.1);border-color:rgba(232,64,64,0.3);color:var(--ruby)">Delete</button>
        </div>
        ` : ''}
      </div>
      </div>`;
    }).join('');
  }

  function openEventModal() {
    ['ev-title','ev-desc','ev-date','ev-time','ev-loc','ev-type','ev-max','ev-prize'].forEach(id => { const el = $(id); if (el) el.value = ''; });
    if ($('ev-date')) $('ev-date').value = '';
    if ($('ev-time')) $('ev-time').value = '10:00';
    if ($('ev-max')) $('ev-max').value = '50';
    openModal('ev-modal');
  }

  function editEvent(id) {
    const event = eventsData.find(e => String(e.id) === String(id));
    if (!event) return;
    if ($('ev-title')) $('ev-title').value = event.title || '';
    if ($('ev-desc')) $('ev-desc').value = event.description || '';
    if ($('ev-date')) $('ev-date').value = event.date || event.event_date || '';
    if ($('ev-time')) $('ev-time').value = event.time || event.event_time || '10:00';
    if ($('ev-loc')) $('ev-loc').value = event.location || '';
    if ($('ev-type')) $('ev-type').value = event.type || 'Tournament';
    if ($('ev-max')) $('ev-max').value = event.max_participants || 50;
    if ($('ev-prize')) $('ev-prize').value = event.prize || '';
    if ($('ev-id')) $('ev-id').value = event.id;
    openModal('ev-modal');
  }

  // FIX: single saveEvent function — no duplicate
  async function saveEvent() {
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);

    const eventId = $('ev-id') ? $('ev-id').value : '';
    const title = $('ev-title') ? $('ev-title').value.trim() : '';
    const description = $('ev-desc') ? $('ev-desc').value.trim() : '';
    const date = $('ev-date') ? $('ev-date').value : '';
    const time = $('ev-time') ? $('ev-time').value : '';
    const location = $('ev-loc') ? $('ev-loc').value.trim() : '';
    const type = $('ev-type') ? $('ev-type').value : 'Tournament';
    const maxParticipants = parseInt($('ev-max')?.value) || 50;
    const prize = $('ev-prize') ? $('ev-prize').value.trim() : '';

    if (!title || !date) { toast('Title and date required', 'error'); return; }

    const eventData = {
      title, description, event_date: date, event_time: time,
      location, event_type: type, max_participants: maxParticipants, prize, status: 'active'
    };

    try {
      const isEdit = eventId && eventId.length > 0;
      if (isEdit) {
        if ($('ev-modal-title')) $('ev-modal-title').textContent = 'Update Event';
      } else {
        if ($('ev-modal-title')) $('ev-modal-title').textContent = 'Create Event';
      }
      
      let res;
      if (isEdit) {
        res = await apiCall(`${API_BASE}/events?id=${encodeURIComponent(eventId)}`, {
          method: 'PUT',
          body: JSON.stringify(eventData)
        });
      } else {
        res = await apiCall(`${API_BASE}/events`, {
          method: 'POST',
          body: JSON.stringify(eventData)
        });
      }
      const result = await res.json().catch(() => ({ error: 'Invalid JSON response' }));
      if (!res.ok) { toast('Failed: ' + (result.error || 'Unknown'), 'error'); return; }
      toast(isEdit ? 'Event updated!' : 'Event created!', 'success');
      closeModals();
      const newEvent = result.data || result;
      if (newEvent && newEvent.id) {
        if (isEdit) {
          eventsData = eventsData.map(e => String(e.id) === String(eventId) ? newEvent : e);
        } else {
          eventsData = [newEvent, ...eventsData];
        }
        dataCache.timestamp = Date.now();
      }
      renderEvents(); renderDash();
    } catch (e) {
      console.error('Event save error:', e);
      toast('Network error while saving event', 'error');
    }
  }

  async function deleteEvent(id) {
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    try {
      const res = await apiCall(`${API_BASE}/events?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) { toast('Delete failed: ' + (result.error || 'Unknown'), 'error'); return; }
      toast('Event deleted.', 'success');
      eventsData = eventsData.filter(e => String(e.id) !== String(id));
      dataCache.timestamp = Date.now();
      renderEvents(); renderDash();
    } catch (e) { toast('Delete failed', 'error'); }
  }

  // ═══════════════════════════════════════════════════════════════
  // ACHIEVEMENTS
  // ═══════════════════════════════════════════════════════════════
  function renderFame() {
    const loadingEl = $('fame-loading');
    const gridEl = $('fame-grid');
    if (loadingEl) loadingEl.style.display = 'none';
    if (gridEl) gridEl.style.display = 'grid';
    if (!achievementsData.length) {
      if (gridEl) gridEl.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon" style="font-size:60px">🏆</div><p>No achievements yet.</p></div>`;
      return;
    }
    if (gridEl) gridEl.innerHTML = achievementsData.map(a => `
      <div class="ach-card">
        ${role === 'admin' || role === 'master' ? `<button class="del-btn" onclick="deleteAchievement('${a.id}')">✕</button>` : ''}
        ${a.img_url ? `<img src="${a.img_url}" class="ach-img">` : `<div class="ach-img-placeholder">🏆</div>`}
        <div class="ach-info"><div class="ach-title">${a.title || 'Achievement'}</div><div class="ach-sub">${(a.students && a.students.full_name) || '—'}</div></div>
      </div>`).join('');
  }

  function openAwardModal() {
    if ($('award-student')) $('award-student').innerHTML = '<option value="">Select Student</option>' + allStudents.map(s => `<option value="${s.id}">${getStudentName(s)}</option>`).join('');
    if ($('award-sid')) $('award-sid').value = '';
    if ($('award-title')) $('award-title').value = '';
    if ($('award-img-url')) $('award-img-url').value = '';
    const prev = $('award-img-preview');
    if (prev) prev.style.display = 'none';
    if ($('award-img-file')) $('award-img-file').value = '';
    openModal('award-modal');
  }

  function onAwardStudentChange() { if ($('award-sid') && $('award-student')) $('award-sid').value = $('award-student').value; }

  async function saveAward() {
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    const title = $('award-title') ? $('award-title').value.trim() : '';
    const studentId = $('award-sid') ? $('award-sid').value : '';
    if (!title) { toast('Title required', 'error'); return; }
    if (!studentId) { toast('Select a student', 'error'); return; }
    const student = allStudents.find(s => String(s.id) === String(studentId));
    const data = {
      title, student_id: studentId,
      students: { full_name: getStudentName(student), id: studentId },
      img_url: $('award-img-url')?.value.trim() || null
    };
    try {
      const res = await apiCall(`${API_BASE}/achievements`, { method: 'POST', body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) { toast('Failed: ' + (result.error || 'Unknown'), 'error'); return; }
      toast('Published!', 'success');
      closeModals();
      const newAward = result.data || result;
      if (newAward && newAward.id) { achievementsData = [newAward, ...achievementsData]; dataCache.timestamp = Date.now(); }
      renderFame(); renderDash();
    } catch (e) { toast('Failed', 'error'); }
  }

  async function deleteAchievement(id) {
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    try {
      const res = await apiCall(`${API_BASE}/achievements?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) { toast('Delete failed: ' + (result.error || 'Unknown'), 'error'); return; }
      toast('Removed.', 'success');
      achievementsData = achievementsData.filter(a => String(a.id) !== String(id));
      dataCache.timestamp = Date.now();
      renderFame();
    } catch (e) { toast('Failed', 'error'); }
  }

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════════════════
  function renderBills() {
    const tbody = $('bill-body');
    if (!tbody) return;
    const studs = (role === 'admin' || role === 'master') ? allStudents : (currentStudent ? [currentStudent] : []);
    if (!studs.length) { tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">No records.</div></td></tr>`; return; }
    tbody.innerHTML = studs.map((s, i) => {
      const status = getStudentPaymentStatus(s);
      const fee = getStudentMonthlyFee(s);
      const action = status === 'Due'
        ? `<button class="btn btn-gold btn-sm" onclick="${role === 'admin' || role === 'master' ? `markPaid('${s.id}')` : `openPay('${s.id}','${getStudentName(s)}','${fee}')`}">${role === 'admin' || role === 'master' ? 'Mark Paid' : 'Pay'}</button>`
        : `<button class="btn btn-outline btn-sm" onclick="downloadReceipt('${s.id}','${getStudentName(s)}','${fee}')">Receipt</button>`;
      return `<tr><td style="font-family:'DM Mono';color:var(--ivory-dim)">#CK-${String(i+1).padStart(4,'0')}</td><td style="font-weight:600">${getStudentName(s)}</td><td style="font-family:'DM Mono'">₹${fee}</td><td><span class="${status==='Paid'?'text-success':'text-danger'}">${status}</span></td><td>${action}</td></tr>`;
    }).join('');
  }

  async function markPaid(id) {
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    try {
      const res = await apiCall(`${API_BASE}/students?id=${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ status: 'active', payment_status: 'Paid' }) });
      const result = await res.json();
      if (!res.ok) { toast('Failed: ' + (result.error || 'Unknown'), 'error'); return false; }
      toast('Marked as paid!', 'success');
      const updated = result.data || { id, status: 'active' };
      allStudents = allStudents.map(s => String(s.id) === String(id) ? { ...s, ...updated } : s);
      dataCache.timestamp = Date.now();
      renderBills(); renderDash(); renderStudents();
      return true;
    } catch (e) { toast('Failed', 'error'); return false; }
  }

  async function bulkMarkPaid() {
    if (!confirm('Mark all filtered due students as paid?')) return;
    const dueStudents = allStudents.filter(s => getStudentPaymentStatus(s) === 'Due');
    if (!dueStudents.length) { toast('No due students found', 'error'); return; }
    toast(`Processing ${dueStudents.length} payments...`, 'info');
    let success = 0, fail = 0;
    for (const s of dueStudents) {
      const ok = await markPaid(s.id);
      ok ? success++ : fail++;
    }
    toast(`Done: ${success} paid${fail > 0 ? `, ${fail} failed` : ''}`, fail > 0 ? 'error' : 'success');
  }

  function openPay(id, name, fee) {
    payTarget = { id, name, fee };
    if ($('pay-amt')) $('pay-amt').textContent = '₹' + fee;
    if ($('pay-name')) $('pay-name').textContent = name;
    if ($('pay-preview')) $('pay-preview').style.display = 'none';
    if ($('pay-options')) $('pay-options').style.display = 'grid';
    if ($('pay-processing')) $('pay-processing').style.display = 'none';
    openModal('pay-modal');
  }

  function initiatePay(provider) {
    if (!payTarget) return;
    if ($('pay-options')) $('pay-options').style.display = 'none';
    if ($('pay-processing')) $('pay-processing').style.display = 'block';
    if ($('pay-provider')) $('pay-provider').textContent = provider + ' payment initiated';
    toast(`Processing ${provider}...`, 'info');
    setTimeout(() => {
      if (payTarget) markPaid(payTarget.id).then(ok => { if (ok) showReceiptPreview(payTarget.name, payTarget.fee, provider); });
    }, 2000);
  }

  function showReceiptPreview(name, fee, method) {
    const date = new Date();
    const receiptNum = 'RCPT-' + Date.now().toString(36).toUpperCase();
    if ($('receipt-number')) $('receipt-number').textContent = 'Receipt: ' + receiptNum;
    if ($('receipt-student')) $('receipt-student').textContent = name;
    if ($('receipt-date')) $('receipt-date').textContent = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    if ($('receipt-method')) $('receipt-method').textContent = method;
    if ($('receipt-amount')) $('receipt-amount').textContent = '₹' + Number(fee).toLocaleString('en-IN');
    closeModals();
    openModal('receipt-preview-modal');
    toast('Payment successful!', 'success');
    payTarget = null;
  }

  function printReceipt() { window.print(); }

  function downloadReceipt(id, name, fee) {
    const date = new Date();
    const receiptNumber = 'RCPT-' + Date.now().toString(36).toUpperCase();
    const win = window.open('', '_blank');
    if (!win) { toast('Please allow popups', 'error'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt</title><style>body{font-family:sans-serif;padding:40px;background:#fff;color:#000}.header{background:#dca33e;padding:30px;text-align:center;color:#000;border-radius:8px 8px 0 0}.crown{font-size:40px}.title{font-size:26px;font-weight:700}.row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee}.label{color:#666}.value{font-weight:600}.total{text-align:right;margin-top:16px;font-size:28px;font-weight:700;color:#dca33e}@media print{button{display:none}}</style></head><body>
    <div class="header"><div class="crown">♚</div><div class="title">CHESSKIDOO</div><div>Premium Chess Academy</div></div>
    <div style="padding:30px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
      <div style="text-align:center;color:#888;margin-bottom:20px">${receiptNumber}</div>
      <div class="row"><span class="label">Student</span><span class="value">${name}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
      <div class="row"><span class="label">For</span><span class="value">Monthly Tuition</span></div>
      <div class="row"><span class="label">Status</span><span class="value" style="color:green">PAID</span></div>
      <div class="total">₹${Number(fee).toLocaleString('en-IN')}</div>
      <div style="text-align:center;margin-top:30px;color:#888;font-size:13px">Chesskidoo Academy • www.chesskidoo.com</div>
      <div style="text-align:center;margin-top:12px"><button onclick="window.print()" style="background:#dca33e;border:none;padding:10px 24px;font-size:14px;border-radius:6px;cursor:pointer">🖨️ Print</button></div>
    </div></body></html>`);
    win.document.close();
    toast('Receipt ready', 'success');
  }

  // ═══════════════════════════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════════════════════════
  async function renderMsgs() {
    const loadingEl = $('msgs-loading');
    const listEl = $('msgs-list');
    if (!loadingEl || !listEl) return;
    loadingEl.style.display = 'none';
    listEl.style.display = 'grid';
    try {
      const response = await apiCall('/api/messages');
      const result = await response.json();
      allMessages = result.data || result || [];
    } catch (e) { allMessages = []; }
    if (!allMessages.length) { listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">💬</div><p>No messages.</p></div>`; return; }
    listEl.innerHTML = allMessages.map(m => {
      const priority = getMessagePriority(m);
      const isRead = getMessageIsRead(m);
      const priorityColor = priority === 'urgent' ? 'var(--danger)' : priority === 'high' ? 'var(--gold)' : 'var(--ivory-dim)';
      return `<div style="padding:20px;background:var(--bg2);border:1px solid var(--border);border-radius:16px;${!isRead ? 'border-left:4px solid var(--gold)' : ''}">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px">
          <span style="color:var(--gold);font-weight:600">${m.sender_type === 'admin' ? '👑 Admin' : '👤 ' + (m.sender_name || 'Parent')}</span>
          <span style="display:flex;gap:8px">
            ${priority !== 'normal' ? `<span style="background:${priorityColor};color:#000;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">${priority.toUpperCase()}</span>` : ''}
            <span style="color:var(--ivory-dim);font-size:12px">${new Date(m.created_at).toLocaleDateString()}</span>
          </span>
        </div>
        ${m.subject ? `<div style="color:var(--gold);font-weight:600;margin-bottom:8px">${m.subject}</div>` : ''}
        <div style="color:var(--ivory);margin-bottom:12px">${m.message}</div>
        <div style="display:flex;gap:10px">
          ${!isRead ? `<button class="btn btn-outline-blue btn-sm" onclick="markMsgRead('${m.id}')">Mark Read</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="deleteMsg('${m.id}')">Delete</button>
        </div>
      </div>`;
    }).join('');
  }

  async function markMsgRead(id) {
    try {
      const res = await apiCall(`${API_BASE}/messages?id=${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ is_read: true, read_at: new Date().toISOString() }) });
      if (res.ok) { allMessages = allMessages.map(m => String(m.id) === String(id) ? { ...m, is_read: true } : m); renderMsgs(); updateMsgBadge(); }
    } catch (e) {}
  }

  async function deleteMsg(id) {
    try {
      const res = await apiCall(`${API_BASE}/messages?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) { allMessages = allMessages.filter(m => String(m.id) !== String(id)); renderMsgs(); updateMsgBadge(); }
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════════
  // PARENT VIEW
  // ═══════════════════════════════════════════════════════════════
  function renderChild() {
    const loadingEl = $('child-loading');
    const contentEl = $('child-content');
    if (!currentStudent) {
      if (loadingEl) loadingEl.style.display = 'flex';
      if (contentEl) contentEl.style.display = 'none';
      return;
    }
    const s = currentStudent;
    if ($('c-name')) $('c-name').textContent = getStudentName(s);
    if ($('c-elo')) $('c-elo').textContent = getStudentRating(s);
    if ($('c-level')) $('c-level').textContent = getStudentLevel(s);
    const cid = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null);
    const coachName = cid ? (allCoaches.find(c => String(c.id) === cid)?.full_name || allCoaches.find(c => String(c.id) === cid)?.name || 'Unassigned') : 'Unassigned';
    if ($('c-coach')) $('c-coach').textContent = coachName;
    if ($('c-notes')) $('c-notes').textContent = getStudentCoachNotes(s) || 'Great progress!';
    if ($('contact-coach')) $('contact-coach').textContent = coachName;
    if ($('p-av-wrap')) $('p-av-wrap').innerHTML = `<img src="${makeAvSrc(s)}" class="profile-av">`;

    const skills = getStudentSkills(s);
    const skillNames = ['Tactics', 'Endgame', 'Openings', 'Positional'];
    const skillScores = [skills.tactics, skills.endgame, skills.openings, skills.positional];
    const skillBars = $('skill-bars');
    if (skillBars) skillBars.innerHTML = skillNames.map((sk, i) => `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:6px"><span>${sk}</span><span style="color:var(--gold)">${skillScores[i]}/100</span></div>
        <div style="height:8px;background:rgba(255,255,255,0.05);border-radius:4px"><div style="height:100%;width:${skillScores[i]}%;background:var(--gold);border-radius:4px"></div></div>
      </div>`).join('');

    const myAchs = achievementsData.filter(a => a.students && a.students.full_name === getStudentName(s));
    const parentAch = $('parent-ach');
    if (parentAch) parentAch.innerHTML = myAchs.length ? myAchs.map(a => `<div class="ach-card">${a.img_url ? `<img src="${a.img_url}" class="ach-img">` : `<div class="ach-img-placeholder">🏆</div>`}<div class="ach-info"><div class="ach-title">${a.title}</div></div></div>`).join('') : `<div class="empty-state"><div class="empty-icon">🎖</div><p>No achievements yet.</p></div>`;

    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
  }

  function openContactModal() { openModal('contact-modal'); }

  async function sendMsg() {
    const msg = $('contact-msg') ? $('contact-msg').value.trim() : '';
    if (!msg) { toast('Message required', 'error'); return; }
    try {
      await apiCall(`${API_BASE}/messages`, { method: 'POST', body: JSON.stringify({ sender_type: 'parent', sender_id: currentStudent?.id, receiver_type: 'admin', message: msg }) });
      toast('Sent!', 'success'); closeModals();
    } catch (e) { toast('Failed', 'error'); }
  }

  async function sendFeedback() {
    const msg = $('fb-msg') ? $('fb-msg').value.trim() : '';
    if (!msg) { toast('Feedback required', 'error'); return; }
    try {
      await apiCall(`${API_BASE}/messages`, { method: 'POST', body: JSON.stringify({ sender_type: 'parent', sender_id: currentStudent?.id, receiver_type: 'admin', subject: 'Parent Feedback', message: msg }) });
      toast('Thank you!', 'success'); closeModals();
    } catch (e) { toast('Failed', 'error'); }
  }

  // ═══════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════
  async function showNotifications() {
    const notifications = [];
    const dueCount = allStudents.filter(s => getStudentPaymentStatus(s) === 'Due').length;
    if (dueCount > 0) notifications.push({ type: 'warning', message: `${dueCount} student${dueCount > 1 ? 's have' : ' has'} pending payments`, time: 'Recent' });
    const upcoming = eventsData.filter(e => new Date(getEventDate(e)) > new Date()).length;
    if (upcoming > 0) notifications.push({ type: 'info', message: `${upcoming} upcoming event${upcoming > 1 ? 's' : ''} scheduled`, time: 'Recent' });
    const unread = allMessages.filter(m => !getMessageIsRead(m)).length;
    if (unread > 0) notifications.push({ type: 'info', message: `${unread} unread message${unread > 1 ? 's' : ''}`, time: 'Recent' });
    if (!notifications.length) notifications.push({ type: 'success', message: 'All caught up — no pending items!', time: 'Now' });

    openModal('notification-modal');
    const content = $('notification-content') || $('notification-list');
    if (content) content.innerHTML = notifications.map(n => `
      <div class="notification-item ${n.type}" style="display:flex;align-items:flex-start;gap:12px;padding:14px;margin-bottom:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;border-left:3px solid ${n.type==='success'?'var(--success)':n.type==='warning'?'var(--gold)':'var(--accent)'}">
        <span style="font-size:18px">${n.type==='success'?'✓':n.type==='warning'?'⚠️':'ℹ'}</span>
        <div><div style="font-weight:500;color:var(--ivory)">${n.message}</div><div style="font-size:12px;color:var(--ivory-dim);margin-top:3px">${n.time}</div></div>
      </div>`).join('');
  }

  // ═══════════════════════════════════════════════════════════════
  // AI ASSISTANT
  // ═══════════════════════════════════════════════════════════════
  let activeAIModule = 'global';

  function setAIModule(module) {
    activeAIModule = module;
    const btns = document.querySelectorAll('.ai-ws-menu .ai-ws-btn');
    btns.forEach((b, i) => b.classList.toggle('active', (module === 'global' && i === 0) || (module === 'finance' && i === 1) || (module === 'coach' && i === 2)));
  }

  function setAISuggestion(query) {
    const input = $('ai-query');
    if (input) { input.value = query; sendAIQuery(); }
  }

  async function sendAIQuery() {
    const inputEl = $('ai-query');
    if (!inputEl) return;
    const msg = inputEl.value.trim();
    if (!msg) return;
    inputEl.value = '';
    const bodyEl = $('ai-workspace-msgs');
    if (!bodyEl) return;

    bodyEl.innerHTML += `<div class="ai-ws-msg user"><div class="ai-ws-avatar">👤</div><div class="ai-ws-bubble">${msg}</div></div>`;
    setTimeout(() => bodyEl.scrollTop = bodyEl.scrollHeight, 50);

    const botId = 'ws-msg-' + Date.now();
    bodyEl.innerHTML += `<div class="ai-ws-msg bot" id="${botId}"><div class="ai-ws-avatar">🤖</div><div class="ai-ws-bubble" style="color:var(--ivory-dim)">Thinking...</div></div>`;
    setTimeout(() => bodyEl.scrollTop = bodyEl.scrollHeight, 50);

    try {
      const res = await apiCall(`${API_BASE}/ai`, {
        method: 'POST',
        body: JSON.stringify({ message: msg, role: role || 'admin', context: { students: allStudents.length, coaches: allCoaches.length, moduleFocus: activeAIModule, childName: role === 'parent' ? getStudentName(currentStudent) : null, rating: role === 'parent' ? getStudentRating(currentStudent) : null } })
      });
      const data = await res.json();
      const el = $(botId);
      if (el) el.innerHTML = `<div class="ai-ws-avatar">🤖</div><div class="ai-ws-bubble">${data.message || 'No response.'}</div>`;
    } catch (e) {
      const el = $(botId);
      if (el) el.innerHTML = `<div class="ai-ws-avatar">🤖</div><div class="ai-ws-bubble" style="color:var(--danger)">Connection to AI failed. Check if GEMINI_API_KEY is set in Supabase.</div>`;
    }
    setTimeout(() => bodyEl.scrollTop = bodyEl.scrollHeight, 50);
  }

  // ═══════════════════════════════════════════════════════════════
  // CHATBOT WIDGET
  // ═══════════════════════════════════════════════════════════════
  function toggleChat() {
    const panel = $('chat-panel');
    if (panel) panel.style.display = panel.style.display === 'none' || !panel.style.display ? 'flex' : 'none';
  }
  function toggleChatbot() { toggleChat(); }

  async function sendChat() {
    const input = $('chat-input');
    const body = $('ai-chat-body');
    if (!input || !body) return;
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    
    const uMsg = document.createElement('div');
    uMsg.className = 'chat-msg user';
    uMsg.textContent = msg;
    body.appendChild(uMsg);
    body.scrollTop = body.scrollHeight;

    setTimeout(() => {
      const bMsg = document.createElement('div');
      bMsg.className = 'chat-msg bot';
      bMsg.textContent = generateChatReply(msg);
      body.appendChild(bMsg);
      body.scrollTop = body.scrollHeight;
    }, 600);
  }
  function sendChatMessage() { sendChat(); }

  function generateChatReply(q) {
    const lq = q.toLowerCase();
    if (lq.includes('student') || lq.includes('enroll')) return "You have " + allStudents.length + " active students. " + (allStudents.filter(s => getStudentPaymentStatus(s) === 'Paid').length) + " paid this month.";
    if (lq.includes('revenue') || lq.includes('money') || lq.includes('income')) {
      const revenue = allStudents.filter(s => getStudentPaymentStatus(s) === 'Paid').reduce((a, s) => a + getStudentMonthlyFee(s), 0);
      return "Revenue: ₹" + revenue.toLocaleString() + ". Outstanding: ₹" + (allStudents.filter(s => getStudentPaymentStatus(s) === 'Due').reduce((a, s) => a + getStudentMonthlyFee(s), 0)).toLocaleString();
    }
    if (lq.includes('elo') || lq.includes('top') || lq.includes('best') || lq.includes('rating')) {
      const top = [...allStudents].sort((a, b) => getStudentRating(b) - getStudentRating(a)).slice(0, 3);
      return "Top by ELO:\n" + top.map((s, i) => (i+1) + ". " + getStudentName(s) + " — " + getStudentRating(s)).join('\n');
    }
    if (lq.includes('due') || lq.includes('pending') || lq.includes('pay') || lq.includes('unpaid')) return "Due: " + allStudents.filter(s => getStudentPaymentStatus(s) === 'Due').map(s => getStudentName(s)).join(', ') || "All paid!";
    if (lq.includes('coach') || lq.includes('teacher')) return allCoaches.map(c => getCoachName(c) + " (" + allStudents.filter(s => { const cid = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null); return cid === String(c.id); }).length + " students)").join('\n') || "No coaches";
    return "Ask about students, revenue, ELO ratings, due fees, or coaches!";
  }

  // ═══════════════════════════════════════════════════════════════
  // THEME
  // ═══════════════════════════════════════════════════════════════
  function toggleTheme() {
    const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    if (document.querySelector('.page.active')?.id === 'page-dash') renderDash();
  }

  // ═══════════════════════════════════════════════════════════════
  // PDF REPORT
  // ═══════════════════════════════════════════════════════════════
  async function generateReportPDF() {
    if (typeof window.jspdf === 'undefined') { toast('PDF library not loaded', 'error'); return; }
    try {
      toast('Generating PDF...', 'info');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.text('Chesskidoo Academy — Financial Report', 14, 22);
      doc.setFontSize(11);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
      const paid = allStudents.filter(s => getStudentPaymentStatus(s) === 'Paid');
      const due = allStudents.filter(s => getStudentPaymentStatus(s) === 'Due');
      const revenue = paid.reduce((a, s) => a + getStudentMonthlyFee(s), 0);
      const dueAmt = due.reduce((a, s) => a + getStudentMonthlyFee(s), 0);
      const coachExp = allCoaches.reduce((a, c) => a + getCoachSalary(c), 0);
      doc.setFontSize(16); doc.text('Executive Summary', 14, 45);
      doc.setFontSize(12);
      let y = 55;
      [`Total Cadets: ${allStudents.length}`, `Paid: ${paid.length}`, `Due: ${due.length}`, `Revenue: Rs ${revenue.toLocaleString()}`, `Outstanding: Rs ${dueAmt.toLocaleString()}`, `Coach Expenses: Rs ${coachExp.toLocaleString()}`, `Net Profit: Rs ${(revenue - coachExp).toLocaleString()}`].forEach(line => { doc.text(line, 14, y); y += 8; });
      doc.save(`chesskidoo_report_${new Date().toISOString().split('T')[0]}.pdf`);
      toast('PDF downloaded!', 'success');
    } catch (e) { console.error(e); toast('PDF generation failed', 'error'); }
  }

  // FIX: exportData with proper coach name lookup (no undefined getStudentCoachName)
  function exportData() {
    const data = {
      students: allStudents.map(s => {
        const cid = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null);
        const coachName = cid ? (allCoaches.find(c => String(c.id) === cid)?.full_name || allCoaches.find(c => String(c.id) === cid)?.name || 'Unassigned') : 'Unassigned';
        return { id: s.id, name: getStudentName(s), phone: getStudentPhone(s), level: getStudentLevel(s), rating: getStudentRating(s), coach: coachName, payment_status: getStudentPaymentStatus(s), monthly_fee: getStudentMonthlyFee(s) };
      }),
      coaches: allCoaches.map(c => ({ id: c.id, name: getCoachName(c), phone: c.phone, specialty: getCoachSpecialty(c), salary: getCoachSalary(c) })),
      export_date: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `chesskidoo-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast('Backup created!', 'success');
  }

  // ═══════════════════════════════════════════════════════════════
// INIT
  // ═══════════════════════════════════════════════════════════════════════
  function checkAuth() {
    try {
      const saved = localStorage.getItem('chesskidoo_auth');
      if (!saved) return false;
      const auth = JSON.parse(saved);
      if (!auth.role) return false;
      role = auth.role;
      if (auth.role === 'parent' && auth.studentId) {
        currentStudent = allStudents.find(s => s.id === auth.studentId) || null;
      }
      const name = auth.user || (auth.role === 'admin' ? 'Admin' : 'User');
      finishLogin(name, auth.role, auth.studentId || null);
      return true;
    } catch (e) {
      return false;
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) {
      const loginScreen = $('login-screen');
      if (loginScreen) loginScreen.style.display = 'flex';
      document.body.classList.add('login-mode');
    }
  });

  // Expose all functions globally
  const expose = {
    toggleSidebar, setPage, toggleEye, doLogin, doLogout, openProfile,
    clearFilters, renderStudents, viewStudent, openEdit, updateStudent, openEnroll, saveStudent, deleteStudent,
    renderCoachMgmt, viewCoachSchedule, openCoachModal, saveCoach, deleteCoach,
    renderEvents, saveEvent, deleteEvent,
    renderFame, openAwardModal, onAwardStudentChange, saveAward, deleteAchievement,
    renderBills, markPaid, bulkMarkPaid, openPay, initiatePay, downloadReceipt, showReceiptPreview, printReceipt,
    renderMsgs, markMsgRead, deleteMsg,
    renderChild, openContactModal, sendMsg, sendFeedback,
    showNotifications, updateNotificationBadge,
    setAIModule, setAISuggestion, sendAIQuery, toggleChatbot, sendChatMessage, toggleChat, sendChat,
    toggleTheme, closeModals, openModal, previewFile,
    generateReportPDF, exportData, toast, $
  };
  Object.entries(expose).forEach(([k, v]) => window[k] = v);

})();
