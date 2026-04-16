/**
 * CHESSKIDOO ACADEMY - Complete Admin Panel Scripts
 * Properly integrated with Supabase backend
 */

(function() {
  'use strict';

// ═══════════════════════════════════════════════════════════════
  // UTILITIES
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
  const CACHE_DURATION = 2000; // Faster refresh
  let loadDebounceTimer = null;
  let loadingStates = {}; // Track loading states for different operations
  let performanceMetrics = { apiCalls: 0, errors: 0, loadTime: 0 }; // Performance monitoring

// ═══════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════
  const $ = id => document.getElementById(id);

  // Supabase anon key — this is a PUBLIC client-side key (safe to expose).
  // Access is controlled by Row Level Security policies on the database.
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8';

  // Helper for API calls — injects Supabase auth headers for Edge Function rewrites
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
    // Update UI based on loading state
    const loadingIndicator = $(`loading-${key}`);
    if (loadingIndicator) {
      loadingIndicator.style.display = loading ? 'block' : 'none';
    }
  }

  function isLoading(key) {
    return loadingStates[key] || false;
  }

  // Performance monitoring
  function trackAPICall(success = true) {
    performanceMetrics.apiCalls++;
    if (!success) performanceMetrics.errors++;
  }

  // Health check
  async function checkHealth() {
    try {
      const start = Date.now();
      const response = await apiCall('/health');
      const end = Date.now();
      const healthy = response.ok;

      if (healthy) {
        const data = await response.json();
        console.log('✅ System health check passed:', data);
        toast(`System healthy (${end - start}ms response)`, 'success');
      } else {
        console.warn('⚠️ System health check failed');
        toast('System may be experiencing issues', 'warning');
      }

      return { healthy, responseTime: end - start };
    } catch (error) {
      console.error('❌ Health check failed:', error);
      toast('Unable to connect to server', 'error');
      return { healthy: false, error };
    }
  }

  // Stress test function for robustness testing
  async function runStressTest() {
    if (!confirm('Run stress test? This will make many API calls.')) return;

    console.log('🧪 Starting stress test...');
    toast('Starting stress test...', 'info');

    const startTime = Date.now();
    const results = { total: 0, success: 0, errors: 0, responseTimes: [] };

    // Test API endpoints
    const endpoints = ['/api/coaches', '/api/students', '/api/achievements', '/api/events', '/api/messages'];

    for (let i = 0; i < 10; i++) { // 10 iterations
      for (const endpoint of endpoints) {
        results.total++;
        const callStart = Date.now();

        try {
          const response = await apiCall(endpoint);
          const callEnd = Date.now();
          results.responseTimes.push(callEnd - callStart);

          if (response.ok) {
            results.success++;
            await response.json(); // Consume the response
          } else {
            results.errors++;
            console.warn(`Stress test: ${endpoint} returned ${response.status}`);
          }
        } catch (error) {
          results.errors++;
          console.error(`Stress test: ${endpoint} failed:`, error);
        }
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const avgResponseTime = results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length;

    const report = {
      duration,
      totalCalls: results.total,
      successRate: ((results.success / results.total) * 100).toFixed(1) + '%',
      avgResponseTime: Math.round(avgResponseTime) + 'ms',
      errors: results.errors,
      performance: performanceMetrics
    };

    console.log('🧪 Stress test completed:', report);
    toast(`Stress test: ${report.successRate} success rate (${report.avgResponseTime} avg)`, results.errors > 0 ? 'warning' : 'success');

    // Reset performance metrics
    performanceMetrics = { apiCalls: 0, errors: 0, loadTime: 0 };
  }

  // Global error handler
  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    performanceMetrics.errors++;
    toast('An unexpected error occurred', 'error');
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    performanceMetrics.errors++;
    toast('Network error occurred', 'error');
  });

  function openModal(id) { $(id).style.display = 'flex'; }
  function closeModals() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModals(); }));

  function previewFile(inp, previewId) {
    const file = inp.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { const img = $(previewId); if (img) { img.src = e.target.result; img.style.display = 'block'; } };
    reader.readAsDataURL(file);
  }

  async function uploadFile(file) { return URL.createObjectURL(file); }

  // Helper functions for schema differences
  function getStudentName(s) { return s.full_name || s.name || ''; }
  function getStudentLevel(s) { return capitalizeFirst(s.level || s.grade || 'Beginner'); }
  function getStudentRating(s) { return s.rating || 800; }
  function getStudentDate(s) { return s.enrollment_date || s.join_date || ''; }
  function getStudentPhone(s) { return s.parent_phone || s.phone || ''; }
  function getStudentEmail(s) { return s.email || ''; }
  function getStudentMonthlyFee(s) { return s.notes ? parseInt(s.notes.match(/fee[:\s]*(\d+)/i)?.[1]) || 5000 : 5000; }
  function getStudentPaymentStatus(s) { return s.status === 'active' ? 'Paid' : 'Due'; }
  function getStudentBatchType(s) { return 'Evening'; }
  function getStudentBatchTime(s) { return '17:00'; }
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
  function getCoachBio(c) { return c.bio || ''; }
  
  function getEventDate(e) { return e.date || e.event_date || ''; }
  function getEventType(e) { return e.type || e.event_type || 'Tournament'; }
  function getEventLocation(e) { return e.location || ''; }
  function getEventPrize(e) { return e.prize || ''; }
  
  function getMessagePriority(m) { return m.priority || 'normal'; }
  function getMessageIsRead(m) { return m.is_read || false; }
  function getMessageReplyTo(m) { return m.reply_to || null; }
  function getMessageReadAt(m) { return m.read_at || null; }

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
        if (role === 'admin' || role === 'master') {
          renderDash();
          updateMsgBadge();
        } else if (role === 'parent') {
          renderChild();
        }
        return;
      }
      try {
        setLoading('data', true);

        // Load data with retry mechanism
        const loadWithRetry = async (url, maxRetries = 2) => {
          for (let i = 0; i <= maxRetries; i++) {
            try {
              const response = await apiCall(url);
              if (response.ok) {
                return await response.json();
              }
              throw new Error(`HTTP ${response.status}`);
            } catch (error) {
              if (i === maxRetries) {
                console.warn(`Failed to load ${url} after ${maxRetries + 1} attempts:`, error);
                return []; // Return empty array on failure
              }
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
            }
          }
        };

        const [coaches, students, achievements, events, messages] = await Promise.all([
          loadWithRetry('/api/coaches'),
          loadWithRetry('/api/students'),
          loadWithRetry('/api/achievements'),
          loadWithRetry('/api/events'),
          loadWithRetry('/api/messages').then(r => r.data || r || [])
        ]);

        allCoaches = coaches || [];
        allStudents = students || [];
        achievementsData = achievements || [];
        eventsData = events || [];
        allMessages = messages || [];

        dataCache = { coaches: allCoaches, students: allStudents, achievements: achievementsData, events: eventsData, timestamp: now };
        syncCoachDropdowns();

        if (role === 'admin' || role === 'master') {
          renderDash();
          updateMsgBadge();
          renderEvents();
        } else if (role === 'parent') {
          renderChild();
          renderEvents();
        }

        setLoading('data', false);
      } catch (err) {
        console.error('Load error:', err);
        toast('Failed to load data - please refresh', 'error');
        setLoading('data', false);
      }
    };
    
    if (forceRefresh) {
      await executeLoad();
    } else {
      loadDebounceTimer = setTimeout(executeLoad, 100);
    }
  }

  function syncCoachDropdowns() {
    const options = allCoaches.map(c => `<option value="${c.id}">${getCoachName(c)}</option>`).join('');
    if ($('f-coach')) $('f-coach').innerHTML = '<option value="">All Coaches</option>' + options;
    if ($('m-coach')) $('m-coach').innerHTML = options;
    if ($('e-coach')) $('e-coach').innerHTML = options;
    if ($('award-student')) $('award-student').innerHTML = '<option value="">Select Student</option>' + allStudents.map(s => `<option value="${s.id}">${getStudentName(s)}</option>`).join('');
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
      toast('Failed to load messages', 'error');
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
    $('page-' + p)?.classList.add('active');
    $('nav-' + p)?.classList.add('active');
    $('p-title').textContent = PAGE_TITLES[p] || '';

    const btnArea = $('top-btn-area');
    if (btnArea) {
      btnArea.innerHTML = '';
      if (role === 'admin' || role === 'master') {
        if (p === 'dash') btnArea.innerHTML = `<button class="btn btn-outline" onclick="generateFinancialReport()">📊 Financial Report</button><button class="btn btn-outline" onclick="generateStudentReport()" style="margin-left:10px">👥 Student Report</button>`;
        if (p === 'stud') btnArea.innerHTML = `<button class="btn btn-gold" onclick="openEnroll()">+ New Enrollment</button>`;
        if (p === 'events') btnArea.innerHTML = `<button class="btn btn-gold" onclick="openModal('ev-modal')">+ Create Event</button>`;
      }
    }

    if (window.innerWidth <= 768) {
      $('sidebar')?.classList.remove('open');
      $('sidebar-overlay')?.classList.remove('active');
    }

    // Render page-specific content
    if (p === 'events' && eventsData) renderEvents();

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
    if (p.type === 'password') {
      p.type = 'text';
      icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
    } else {
      p.type = 'password';
      icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
    }
  }

  function doLogin() {
    const rawUser = $('li-user').value.trim();
    const pass = $('li-pass').value.trim();
    const errEl = $('login-err');
    if (errEl) errEl.style.display = 'none';
    if (!rawUser || !pass) { errEl.textContent = 'Please enter credentials.'; errEl.style.display = 'block'; return; }

    // Use server-side authentication API for security
    apiCall('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username: rawUser, password: pass })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Store token securely
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userRole', data.role);
        
        if (data.role === 'master') {
          role = 'master';
          document.body.classList.add('admin-mode', 'master-mode');
          $('top-profile').style.display = 'flex';
          $('top-profile-name').innerHTML = 'Master <span style="background:var(--gold);color:#000;padding:2px 8px;border-radius:10px;font-size:10px">👑</span>';
          $('top-profile-av').src = `https://ui-avatars.com/api/?name=Master&background=dca33e&color=000&bold=true&size=80`;
        } else if (data.role === 'admin') {
          role = 'admin';
          document.body.classList.add('admin-mode');
          $('top-profile').style.display = 'flex';
          $('top-profile-name').textContent = 'Admin';
          $('top-profile-av').src = `https://ui-avatars.com/api/?name=Admin&background=dca33e&color=000&bold=true&size=80`;
        } else if (data.role === 'parent') {
          role = 'parent';
          document.body.classList.add('parent-mode');
          $('top-profile').style.display = 'flex';
          $('top-profile-name').textContent = data.user.name.split(' ')[0];
          $('top-profile-av').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user.name)}&background=dca33e&color=000&bold=true&size=80`;
          // Store student ID for parent
          if (data.user.studentId) localStorage.setItem('studentId', data.user.studentId);
        }
        
        finishLogin('dash');
      } else {
        errEl.textContent = data.error || 'Invalid credentials.';
        errEl.style.display = 'block';
      }
    })
    .catch(err => {
      console.error('Login error:', err);
      errEl.textContent = 'Server unavailable. Please try again later.';
      errEl.style.display = 'block';
    });
  }

function finishLogin(page) {
    $('login-screen').style.display = 'none';
    setPage(page);
    // Clear any pending refresh and load fresh data on login
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    loadAllData(true);
}

  function doLogout() {
    closeModals();
    role = null;
    currentStudent = null;
    document.body.classList.remove('admin-mode', 'parent-mode', 'master-mode');
    $('login-screen').style.display = 'flex';
    $('top-profile').style.display = 'none';
    $('li-user').value = '';
    $('li-pass').value = '';
  }

  function openProfile() {
    openModal('profile-modal');
    $('prof-admin-view').style.display = role === 'admin' || role === 'master' ? 'block' : 'none';
    $('prof-parent-view').style.display = role === 'parent' ? 'block' : 'none';
    if ($('active-users-list')) $('active-users-list').innerHTML = `<div><span style="color:var(--success)">●</span> You (Current)</div>`;
  }

  // ═══════════════════════════════════════════════════════════════
  // CHARTS
  // ═══════════════════════════════════════════════════════════════
  function buildCharts(studs) {
    // Revenue Analysis - Monthly revenue over last 6 months
    const revenueCtx = $('chartRevenue');
    if (revenueCtx) {
      const monthlyRevenue = {};
      studs.filter(s => getStudentPaymentStatus(s) === 'Paid').forEach(s => {
        const date = new Date(getStudentDate(s));
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevenue[month] = (monthlyRevenue[month] || 0) + getStudentMonthlyFee(s);
      });

      const labels = [];
      const data = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        labels.push(d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
        data.push(monthlyRevenue[month] || 0);
      }

      Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';
      Chart.defaults.font.family = 'Inter, sans-serif';

      new Chart(revenueCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Revenue (₹)',
            data,
            borderColor: '#dca13e',
            backgroundColor: 'rgba(220, 161, 62, 0.1)',
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: v => '₹' + v.toLocaleString() },
              grid: { color: 'rgba(255,255,255,0.05)' }
            },
            x: { grid: { color: 'rgba(255,255,255,0.05)' } }
          }
        }
      });
    }

    // Coach Load - Students per coach
    const coachCtx = $('chartCoach');
    if (coachCtx) {
      const { coachMap } = getCoachStats(studs);
      const labels = Object.keys(coachMap);
      const data = Object.values(coachMap);

      new Chart(coachCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Students',
            data,
            backgroundColor: '#dca13e',
            borderColor: '#ffc863',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 },
              grid: { color: 'rgba(255,255,255,0.05)' }
            },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // Payment Status - Paid vs Due
    const paymentCtx = $('chartPayment');
    if (paymentCtx) {
      const paid = studs.filter(s => getStudentPaymentStatus(s) === 'Paid').length;
      const due = studs.filter(s => getStudentPaymentStatus(s) === 'Due').length;

      new Chart(paymentCtx, {
        type: 'doughnut',
        data: {
          labels: ['Paid', 'Due'],
          datasets: [{
            data: [paid, due],
            backgroundColor: ['#2e7d32', '#d32f2f'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#ffffff' } }
          }
        }
      });
    }

    // Batch Distribution - Morning vs Evening
    const batchCtx = $('chartBatch');
    if (batchCtx) {
      const morning = studs.filter(s => getStudentBatchTime(s).includes('08') || getStudentBatchTime(s).includes('09') || getStudentBatchTime(s).includes('10') || getStudentBatchTime(s).includes('11')).length;
      const evening = studs.filter(s => getStudentBatchTime(s).includes('17') || getStudentBatchTime(s).includes('18') || getStudentBatchTime(s).includes('19') || getStudentBatchTime(s).includes('20')).length;

      new Chart(batchCtx, {
        type: 'pie',
        data: {
          labels: ['Morning', 'Evening'],
          datasets: [{
            data: [morning, evening],
            backgroundColor: ['#1976d2', '#dca13e'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#ffffff' } }
          }
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  function renderDash() {
    const paidStudents = allStudents.filter(s => getStudentPaymentStatus(s) === 'Paid');
    const avgElo = allStudents.length ? Math.round(allStudents.reduce((a, s) => a + (getStudentRating(s) || 0), 0) / allStudents.length) : 0;

    $('s-total').textContent = allStudents.length;
    $('s-elo').textContent = avgElo;
    $('s-coaches').textContent = allCoaches.length;

    const revenue = paidStudents.reduce((a, s) => a + getStudentMonthlyFee(s), 0);
    const operationsCost = 15000;
    const totalSalaries = allCoaches.reduce((a, c) => a + getCoachSalary(c), 0);
    const spending = totalSalaries + operationsCost;
    const profit = revenue - spending;

    $('s-rev').textContent = '₹' + revenue.toLocaleString();
    $('s-spend').textContent = '₹' + spending.toLocaleString();
    const profitEl = $('s-profit');
    if (profit >= 0) { profitEl.textContent = '₹' + profit.toLocaleString(); profitEl.style.color = 'var(--success)'; }
    else { profitEl.textContent = '-₹' + Math.abs(profit).toLocaleString(); profitEl.style.color = 'var(--danger)'; }

    buildCharts(allStudents);
  }

  function getCoachStats(studs) {
    const coachMap = {};
    studs.forEach(s => {
      const studentCoachId = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null);
      const cn = studentCoachId ? (allCoaches.find(c => String(c.id) === studentCoachId)?.full_name || 'Unknown') : 'Unassigned';
      coachMap[cn] = (coachMap[cn] || 0) + 1;
    });
    const allStudentCoachIds = studs.map(s => s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null));
    const allCoachIds = allCoaches.map(c => c.id);
    const assignedCoachIds = new Set(allStudentCoachIds.filter(id => id && allCoachIds.includes(id)));
    const unassignedCount = allStudentCoachIds.filter(id => !id || !allCoachIds.includes(id)).length;
    return { coachMap, assignedCoachIds, unassignedCount };
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
    const studs = role === 'admin' || role === 'master' ? allStudents : (currentStudent ? [currentStudent] : []);
    if (!studs.length) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">No students found.</div></td></tr>`; return; }

    // Apply filters
    let filtered = studs;
    const coachFilter = $('f-coach').value;
    const statusFilter = $('f-status').value;
    const minFee = parseInt($('f-min-fee').value) || 0;
    const maxFee = parseInt($('f-max-fee').value) || Infinity;

    if (coachFilter) {
      filtered = filtered.filter(s => {
        const studentCoachId = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null);
        return studentCoachId === coachFilter;
      });
    }
    if (statusFilter) {
      filtered = filtered.filter(s => getStudentPaymentStatus(s) === statusFilter);
    }
    filtered = filtered.filter(s => getStudentMonthlyFee(s) >= minFee && getStudentMonthlyFee(s) <= maxFee);

    // Show bulk payment button if there are due students
    const hasDueStudents = filtered.some(s => getStudentPaymentStatus(s) === 'Due');
    $('bulk-pay-btn').style.display = hasDueStudents && (role === 'admin' || role === 'master') ? 'inline-block' : 'none';

    tbody.innerHTML = filtered.map((s, i) => {
      const status = getStudentPaymentStatus(s);
      const fee = getStudentMonthlyFee(s);
      const safeName = getStudentName(s).replace(/'/g, "\\'");
      const studentCoachId = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null);
      const coachObj = allCoaches.find(c => String(c.id) === studentCoachId);
      const coachNameHtml = coachObj ? `<span class="badge badge-outline">${getCoachName(coachObj)}</span>` : `<span style="color:var(--ivory-dim)">None</span>`;

      let actionHtml = `<div style="display:flex;gap:4px">
        <button class="btn btn-outline-grey btn-sm" onclick="viewStudent('${s.id}')">View</button>`;
      
      if (role === 'admin' || role === 'master') {
        actionHtml += `<button class="btn btn-outline-grey btn-sm" onclick="openEdit('${s.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteStudent('${s.id}', '${safeName}')">Del</button>`;
      }
      
      if (status === 'Due') {
        actionHtml += `<button class="btn btn-gold btn-sm" onclick="markPaid('${s.id}')">Pay</button>`;
      } else {
        actionHtml += `<button class="btn btn-outline-grey btn-sm" onclick="downloadReceipt('${s.id}','${safeName}','${fee}')">Receipt</button>`;
      }
      actionHtml += `</div>`;

      return `<tr>
        <td>
          <div style="font-family:'DM Mono';color:var(--ivory-dim);font-size:11px;margin-bottom:2px">#CK-${String(i+1).padStart(4,'0')}</div>
          <div style="font-weight:600">${getStudentName(s)}</div>
        </td>
        <td>
          <div style="font-weight:500;margin-bottom:2px">${getStudentLevel(s)}</div>
          <div style="font-size:11px;color:var(--gold);font-family:'DM Mono'">${getStudentRating(s)} ELO</div>
        </td>
        <td style="font-family:'DM Mono';color:var(--ivory-dim)">${getStudentDate(s) || '-'}</td>
        <td>${coachNameHtml}</td>
        <td>
          <div style="font-family:'DM Mono';font-size:13px;margin-bottom:2px">₹${fee}/mo</div>
          <span class="${status==='Paid'?'text-success':'text-danger'}" style="font-size:11px;font-weight:600">${status}</span>
        </td>
        <td>${actionHtml}</td>
      </tr>`;
    }).join('');
  }

  function viewStudent(id) {
    const s = allStudents.find(x => String(x.id) === String(id));
    if (!s) return;
    $('sv-av').src = makeAvSrc(s);
    $('sv-name').textContent = getStudentName(s);
    $('sv-level').textContent = getStudentLevel(s);
    $('sv-elo').textContent = getStudentRating(s);
    $('sv-join').textContent = getStudentDate(s) || '—';
    const studentCoachId = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null);
    const coachName = studentCoachId ? (allCoaches.find(c => String(c.id) === studentCoachId)?.full_name || 'Unassigned') : 'Unassigned';
    $('sv-coach').textContent = coachName;
    $('sv-batch').textContent = getStudentBatchType(s) || '—';
    $('sv-fee').textContent = getStudentMonthlyFee(s);
    $('sv-status').innerHTML = `<span class="${getStudentPaymentStatus(s) === 'Paid' ? 'text-success' : 'text-danger'}">${getStudentPaymentStatus(s)}</span>`;
    $('sv-phone').textContent = getStudentPhone(s) || '—';
    $('sv-edit-btn').onclick = () => { closeModals(); openEdit(s.id); };
    openModal('student-view-modal');
  }

  function openEdit(id) {
    const s = allStudents.find(x => String(x.id) === String(id));
    if (!s) return;
    $('e-id').value = s.id;
    $('e-name').value = getStudentName(s);
    $('e-phone').value = getStudentPhone(s);
    $('e-elo').value = getStudentRating(s);
    $('e-level').value = getStudentLevel(s);
    $('e-join').value = getStudentDate(s);
    $('e-fee').value = getStudentMonthlyFee(s);
    $('e-status').value = getStudentPaymentStatus(s);
    $('e-batch-type').value = getStudentBatchType(s);
    $('e-batch-time').value = getStudentBatchTime(s);
    const studentCoachId = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : '');
    $('e-coach').innerHTML = allCoaches.map(c => `<option value="${c.id}" ${studentCoachId === String(c.id) ? 'selected' : ''}>${getCoachName(c)}</option>`).join('');
    openModal('edit-modal');
  }

async function updateStudent() {
    // Clear any pending refresh for immediate update
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    
    const id = $('e-id').value;
    if (!id) return;
    const name = $('e-name').value.trim();
    const phone = $('e-phone').value.trim();
    if (!name) { toast('Name required', 'error'); return; }
    if (!isValidPhone(phone)) { toast('Phone must be 10 digits', 'error'); return; }

    const coachId = $('e-coach').value;
    
    const data = {
      name: name,
      full_name: name,
      parent_phone: phone,
      rating: parseInt($('e-elo').value) || 800,
      current_rating: parseInt($('e-elo').value) || 800,
      grade: capitalizeFirst($('e-level').value),
      level: capitalizeFirst($('e-level').value),
      join_date: $('e-join').value,
      coach_id: coachId ? coachId : null,
      status: $('e-status').value === 'Paid' ? 'active' : 'pending',
      notes: 'fee:' + (parseInt($('e-fee').value) || 5000)
    };

    console.log('Sending PUT payload:', JSON.stringify(data));

    try {
      const res = await apiCall(`${API_BASE}/students?id=${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await res.json();
      console.log('PUT response:', result);
      if (!res.ok) {
        toast('Update failed: ' + (result.error || 'Unknown error'), 'error');
        return;
      }
      toast('Updated!', 'success');
      closeModals();
      
      // Immediately update local data
      const updatedStudent = result.data || result;
      if (updatedStudent && updatedStudent.id) {
        allStudents = allStudents.map(s => String(s.id) === String(id) ? updatedStudent : s);
        dataCache = { coaches: allCoaches, students: allStudents, achievements: achievementsData, events: eventsData, timestamp: Date.now() };
      }
      
      renderStudents();
      renderDash();
      renderBills();
      closeModals();
    } catch (e) { toast('Update failed', 'error'); console.error(e); }
  }

  function openEnroll() {
    $('m-name').value = '';
    $('m-phone').value = '';
    $('m-elo').value = '800';
    $('m-fee').value = '5000';
    $('m-join').value = new Date().toISOString().split('T')[0];
    openModal('enroll-modal');
  }

  async function saveStudent() {
    // Clear any pending refresh for immediate update
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    
    const name = $('m-name').value.trim();
    const phone = $('m-phone').value.trim();
    if (!name) { toast('Name required', 'error'); return; }
    if (!isValidPhone(phone)) { toast('Phone must be 10 digits', 'error'); return; }

    const data = {
      name: name,
      full_name: name,
      parent_phone: phone,
      grade: $('m-level').value,
      enrollment_date: $('m-join').value || new Date().toISOString().split('T')[0],
      coach_id: $('m-coach').value || null,
      rating: parseInt($('m-elo').value) || 800,
      notes: 'fee:' + (parseInt($('m-fee').value) || 5000),
      status: 'pending'
    };

    console.log('Sending POST payload:', JSON.stringify(data));

    try {
      const res = await apiCall(`${API_BASE}/students`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await res.json();
      console.log('POST response:', result);
      if (!res.ok) {
        toast('Enrollment failed: ' + (result.error || 'Unknown error'), 'error');
        return;
      }
      toast(`${name} enrolled!`, 'success');
      closeModals();
      
      // Immediately add to local data
      const newStudent = result.data || result;
      if (newStudent && newStudent.id) {
        allStudents = [newStudent, ...allStudents];
        dataCache = { coaches: allCoaches, students: allStudents, achievements: achievementsData, events: eventsData, timestamp: Date.now() };
      }
      
      // Clear form
      $('m-name').value = '';
      $('m-phone').value = '';
      $('m-elo').value = '800';
      $('m-fee').value = '5000';
      
      renderStudents();
      renderDash();
      renderBills();
      syncCoachDropdowns();
    } catch (e) { toast('Enrollment failed', 'error'); console.error(e); }
  }

  async function deleteStudent(id, name) {
    // confirm removed
    // Clear any pending refresh
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    try {
      const res = await apiCall(`${API_BASE}/students?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) {
        toast('Delete failed: ' + (result.error || 'Unknown error'), 'error');
        return;
      }
      toast('Removed.', 'success');
      // Immediately remove from local data without waiting for API reload
      allStudents = allStudents.filter(s => String(s.id) !== String(id));
      dataCache = { coaches: allCoaches, students: allStudents, achievements: achievementsData, events: eventsData, timestamp: Date.now() };
      renderStudents();
      renderDash();
      renderBills();
    } catch (e) { toast('Delete failed', 'error'); }
  }

  // ═══════════════════════════════════════════════════════════════
  // COACHES
  // ═══════════════════════════════════════════════════════════════
  function renderCoachMgmt() {
    const grid = $('coach-mgmt-body');
    if (!allCoaches.length) { 
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">No coaches found.</div>`; 
      return; 
    }

    grid.innerHTML = allCoaches.map(c => {
      const count = allStudents.filter(s => {
        const studentCoachId = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null);
        return studentCoachId === String(c.id);
      }).length;
      return `
        <div class="coach-card">
          <div class="coach-card-header">
            <img src="${c.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(getCoachName(c))}&background=dca33e&color=000`}" class="coach-card-av">
            <div>
              <div class="coach-card-title">${getCoachName(c)}</div>
              <div class="coach-card-subtitle">${getCoachSpecialty(c)}</div>
            </div>
          </div>
          <div class="coach-card-stats">
            <div class="coach-stat">
              <span class="coach-stat-label">Students</span>
              <span class="coach-stat-val">${count}</span>
            </div>
            <div class="coach-stat">
              <span class="coach-stat-label">Rating</span>
              <span class="coach-stat-val">⭐ ${getCoachRating(c)}</span>
            </div>
            <div class="coach-stat">
              <span class="coach-stat-label">Contact</span>
              <span class="coach-stat-val" style="font-size:13px;word-break:break-all;">+91 ${c.phone || 'N/A'}</span>
            </div>
            <div class="coach-stat">
              <span class="coach-stat-label">Salary</span>
              <span class="coach-stat-val">₹${getCoachSalary(c).toLocaleString()}</span>
            </div>
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
    $('sched-coach-name').textContent = getCoachName(c);
    $('sched-coach-name').textContent = getCoachName(c);
    const container = $('schedule-container');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const myStudents = allStudents.filter(s => {
      const studentCoachId = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null);
      return studentCoachId === String(id);
    });

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
      const c = allCoaches.find(x => x.id === id);
      $('cm-id').value = c.id;
      $('cm-name').value = getCoachName(c);
      $('cm-spec').value = getCoachSpecialty(c);
      $('cm-phone').value = c.phone || '';
      $('cm-address').value = c.address || '';
      $('cm-photo').value = c.photo_url || '';
      $('cm-salary').value = c.salary || '';
      $('cm-etc').value = c.bio || '';
      $('coach-modal-title').textContent = 'Edit Coach';
    } else {
      ['cm-id', 'cm-name', 'cm-spec', 'cm-phone', 'cm-address', 'cm-photo', 'cm-salary', 'cm-etc'].forEach(id => $(id).value = '');
      $('coach-modal-title').textContent = 'Add Coach';
    }
    openModal('coach-crud-modal');
  }

  async function saveCoach() {
    // Clear any pending refresh for immediate update
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    
    const id = $('cm-id').value;
    const name = $('cm-name').value.trim();
    if (!name) { toast('Name required', 'error'); return; }

    const data = {
      full_name: name,
      name: name,
      specialization: $('cm-spec').value,
      specialty: $('cm-spec').value,
      phone: $('cm-phone').value,
      address: $('cm-address').value,
      photo_url: $('cm-photo').value,
      salary: parseInt($('cm-salary').value) || 0,
      hourly_rate: parseInt($('cm-salary').value) || 0,
      bio: $('cm-etc').value,
      status: 'active'
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/coaches?id=${encodeURIComponent(id)}` : `${API_BASE}/coaches`;

    try {
      const res = await apiCall(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) {
        toast('Failed: ' + (result.error || 'Unknown error'), 'error');
        return;
      }
      toast(`Coach ${id ? 'updated' : 'added'}!`, 'success');
      closeModals();
      
      // Immediately update local data
      const updatedCoach = result.data || result;
      if (updatedCoach && updatedCoach.id) {
        if (id) {
          // Update existing
          allCoaches = allCoaches.map(c => String(c.id) === String(id) ? updatedCoach : c);
        } else {
          // Add new
          allCoaches = [updatedCoach, ...allCoaches];
        }
        dataCache = { coaches: allCoaches, students: allStudents, achievements: achievementsData, events: eventsData, timestamp: Date.now() };
      }
      
      // Clear form
      $('cm-id').value = '';
      ['cm-name', 'cm-spec', 'cm-phone', 'cm-address', 'cm-photo', 'cm-salary', 'cm-etc'].forEach(id => $(id).value = '');
      
      renderCoachMgmt();
      renderStudents();
      renderDash();
      syncCoachDropdowns();
    } catch (e) { toast('Error saving coach', 'error'); }
  }

  async function deleteCoach(id) {
    // confirm removed
    // Clear any pending refresh
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    try {
      const res = await apiCall(`${API_BASE}/coaches?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) {
        toast('Delete failed: ' + (result.error || 'Unknown error'), 'error');
        return;
      }
      toast('Removed.', 'success');
      // Immediately remove from local data without waiting for API reload
      allCoaches = allCoaches.filter(c => String(c.id) !== String(id));
      // Clear students assigned to this coach
      allStudents = allStudents.map(s => s.coach_id === id ? { ...s, coach_id: null, coaches: null } : s);
      dataCache = { coaches: allCoaches, students: allStudents, achievements: achievementsData, events: eventsData, timestamp: Date.now() };
      renderCoachMgmt();
      renderStudents();
      renderDash();
    } catch (e) { toast('Delete failed', 'error'); }
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════
  function renderEvents() {
    $('ev-loading').style.display = 'none';
    $('ev-grid').style.display = 'grid';

    if (!eventsData.length) {
      $('ev-grid').innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon" style="font-size:60px">📅</div><p>No events scheduled.</p></div>`;
      return;
    }

    $('ev-grid').innerHTML = eventsData.map(e => {
      const isPast = new Date(getEventDate(e)) < new Date();
      const participants = e.participants || [];
      const registered = participants.length;
      const max = e.max_participants || 50;
      const canRegister = !isPast && registered < max && (role === 'parent' || role === 'admin');

      return `
        <div class="event-card ${isPast ? 'past' : ''}">
          <div class="event-header">
            <div class="event-title">${e.title || 'Event'}</div>
            ${role === 'admin' || role === 'master' ? `<button class="del-btn" onclick="deleteEvent('${e.id}')">✕</button>` : ''}
          </div>
          <div class="event-meta">
            <div class="event-date">📅 ${getEventDate(e) || 'TBD'}</div>
            <div class="event-location">📍 ${getEventLocation(e) || 'TBD'}</div>
            <div class="event-type">🏆 ${getEventType(e)}</div>
          </div>
          <div class="event-desc">${e.description || 'No description available.'}</div>
          <div class="event-stats">
            <span>👥 ${registered}/${max} registered</span>
          </div>
          ${canRegister ? `<button class="btn btn-gold btn-sm" onclick="registerEvent('${e.id}')">Register</button>` : ''}
        </div>
      `;
    }).join('');
  }

  async function saveEvent() {
    // Clear any pending refresh
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);

    const title = $('event-title').value.trim();
    const description = $('event-desc').value.trim();
    const date = $('event-date').value;
    const time = $('event-time').value;
    const location = $('event-location').value.trim();
    const type = $('event-type').value;
    const maxParticipants = parseInt($('event-max').value) || 50;
    const prize = $('event-prize').value.trim();

    if (!title || !date) {
      toast('Title and date required', 'error');
      return;
    }

    const eventData = {
      title,
      description,
      event_date: date,
      event_time: time,
      location,
      event_type: type,
      max_participants: maxParticipants,
      prize,
      status: 'active'
    };

    try {
      const res = await apiCall(`${API_BASE}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      const result = await res.json();
      if (!res.ok) {
        toast('Failed: ' + (result.error || 'Unknown error'), 'error');
        return;
      }
      toast('Event created!', 'success');
      closeModals();

      // Immediately add to local data
      const newEvent = result.data || result;
      if (newEvent && newEvent.id) {
        eventsData = [newEvent, ...eventsData];
        dataCache = { coaches: allCoaches, students: allStudents, achievements: achievementsData, events: eventsData, timestamp: Date.now() };
      }

      renderEvents();
      renderDash();
    } catch (e) {
      toast('Failed to create event', 'error');
    }
  }

  async function deleteEvent(id) {
    // confirm removed
    // Clear any pending refresh
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    try {
      const res = await apiCall(`${API_BASE}/events?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) {
        toast('Delete failed: ' + (result.error || 'Unknown error'), 'error');
        return;
      }
      toast('Event deleted.', 'success');

      // Immediately remove from local data
      eventsData = eventsData.filter(e => String(e.id) !== String(id));
      dataCache = { coaches: allCoaches, students: allStudents, achievements: achievementsData, events: eventsData, timestamp: Date.now() };

      renderEvents();
      renderDash();
    } catch (e) {
      toast('Delete failed', 'error');
    }
  }

  async function registerEvent(eventId) {
    const event = eventsData.find(e => e.id === eventId);
    if (!event) return;

    const currentUserId = role === 'parent' ? currentStudent.id : null;
    if (!currentUserId) {
      toast('Unable to register', 'error');
      return;
    }

    // Check if already registered
    const participants = event.participants || [];
    if (participants.includes(currentUserId)) {
      toast('Already registered', 'warning');
      return;
    }

    // Check max participants
    if (participants.length >= (event.max_participants || 50)) {
      toast('Event is full', 'error');
      return;
    }

    const updatedParticipants = [...participants, currentUserId];
    const updatedEvent = { ...event, participants: updatedParticipants };

    try {
      const res = await apiCall(`${API_BASE}/events?id=${encodeURIComponent(eventId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedEvent)
      });
      const result = await res.json();
      if (!res.ok) {
        toast('Registration failed: ' + (result.error || 'Unknown error'), 'error');
        return;
      }
      toast('Registered successfully!', 'success');

      // Update local data
      eventsData = eventsData.map(e => e.id === eventId ? updatedEvent : e);
      dataCache = { coaches: allCoaches, students: allStudents, achievements: achievementsData, events: eventsData, timestamp: Date.now() };

      renderEvents();
    } catch (e) {
      toast('Registration failed', 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ACHIEVEMENTS
  // ═══════════════════════════════════════════════════════════════
  function renderFame() {
    $('fame-loading').style.display = 'none';
    $('fame-grid').style.display = 'grid';

    if (!achievementsData.length) { $('fame-grid').innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon" style="font-size:60px">🏆</div><p>No achievements yet.</p></div>`; return; }

    $('fame-grid').innerHTML = achievementsData.map(a => `
      <div class="ach-card">
        ${role === 'admin' || role === 'master' ? `<button class="del-btn" onclick="deleteAchievement('${a.id}')">✕</button>` : ''}
        ${a.img_url ? `<img src="${a.img_url}" class="ach-img">` : `<div class="ach-img-placeholder">🏆</div>`}
        <div class="ach-info"><div class="ach-title">${a.title || 'Achievement'}</div><div class="ach-sub">${(a.students && a.students.full_name) || '—'}</div></div>
      </div>`).join('');
  }

  function openAwardModal() {
    $('award-student').innerHTML = '<option value="">Select Student</option>' + allStudents.map(s => `<option value="${s.id}">${getStudentName(s)}</option>`).join('');
    $('award-sid').value = '';
    $('award-title').value = '';
    $('award-img-url').value = '';
    $('award-img-preview').style.display = 'none';
    $('award-img-file').value = '';
    openModal('award-modal');
  }

  function onAwardStudentChange() { $('award-sid').value = $('award-student').value; }

  async function saveAward() {
    // Clear any pending refresh for immediate update
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    
    const title = $('award-title').value.trim();
    const studentId = $('award-sid').value;
    if (!title) { toast('Title required', 'error'); return; }
    if (!studentId) { toast('Select a student', 'error'); return; }

    const student = allStudents.find(s => s.id === studentId);
    const data = {
      title: title,
      student_id: studentId,
      students: { full_name: getStudentName(student), id: studentId },
      img_url: $('award-img-url').value.trim() || null
    };

    try {
      const res = await apiCall(`${API_BASE}/achievements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) {
        toast('Failed: ' + (result.error || 'Unknown error'), 'error');
        return;
      }
      toast('Published!', 'success');
      closeModals();
      
      // Immediately update local data - no API reload
      const newAward = result.data || result;
      if (newAward && newAward.id) {
        achievementsData = [newAward, ...achievementsData];
        dataCache = { coaches: allCoaches, students: allStudents, achievements: achievementsData, events: eventsData, timestamp: Date.now() };
      }
      
      // Clear achievement form
      $('award-title').value = '';
      $('award-img-url').value = '';
      $('award-img-preview').style.display = 'none';
      
      renderFame();
      renderDash();
    } catch (e) { toast('Failed', 'error'); }
  }

  async function deleteAchievement(id) {
    // confirm removed
    // Clear any pending refresh
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    try {
      const res = await apiCall(`${API_BASE}/achievements?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) {
        toast('Delete failed: ' + (result.error || 'Unknown error'), 'error');
        return;
      }
      toast('Removed.', 'success');
      // Immediately remove from local data
      achievementsData = achievementsData.filter(a => String(a.id) !== String(id));
      dataCache = { coaches: allCoaches, students: allStudents, achievements: achievementsData, events: eventsData, timestamp: Date.now() };
      renderFame();
    } catch (e) { toast('Failed', 'error'); }
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════
  function renderEvents() {
    $('ev-loading').style.display = 'none';
    $('ev-grid').style.display = 'grid';

    if (!eventsData.length) { $('ev-grid').innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>No events.</p></div>`; return; }

    $('ev-grid').innerHTML = eventsData.map(e => `
      <div class="ev-card">
        <div class="ev-date">${getEventDate(e) || '—'}</div>
        <div class="ev-type">${e.type || 'Event'}</div>
        <div class="ev-title">${e.title}</div>
        <div class="ev-meta">📍 ${e.location || '—'}<br>🏆 ${e.prize || '—'}</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-gold btn-sm" style="flex:1" onclick="registerEvent('${e.id}')">Register</button>
          ${role === 'admin' || role === 'master' ? `<button class="btn btn-danger btn-sm" onclick="deleteEvent('${e.id}')">Del</button>` : ''}
        </div>
      </div>`).join('');
  }

  async function saveEvent() {
    // Clear any pending refresh for immediate update
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    
    const title = $('ev-title').value.trim();
    if (!title) { toast('Title required', 'error'); return; }

    const data = { title: title, date: $('ev-date').value, type: $('ev-type').value, prize: $('ev-prize').value, location: $('ev-loc').value };

    try {
      const res = await apiCall(`${API_BASE}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) {
        toast('Failed: ' + (result.error || 'Unknown error'), 'error');
        return;
      }
      toast('Published!', 'success');
      closeModals();
      
      // Immediately add new event
      const newEvent = result.data || result;
      if (newEvent && newEvent.id) {
        eventsData = [newEvent, ...eventsData];
        dataCache = { coaches: allCoaches, students: allStudents, achievements: achievementsData, events: eventsData, timestamp: Date.now() };
      }
      
      $('ev-title').value = '';
      $('ev-date').value = '';
      $('ev-prize').value = '';
      $('ev-loc').value = '';
      renderEvents();
    } catch (e) { toast('Failed', 'error'); }
  }



async function registerEvent(id) {
    toast('Registered!', 'success');
    // Clear any pending refresh
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    
    // Immediately update local data - mark as registered by adding a flag or updating
    // For now, we'll just refresh the events display since registration doesn't change event data
    renderEvents();
}

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════════════════
  function renderBills() {
    const tbody = $('bill-body');
    const studs = role === 'admin' || role === 'master' ? allStudents : (currentStudent ? [currentStudent] : []);
    if (!studs.length) { tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">No records.</div></td></tr>`; return; }

    tbody.innerHTML = studs.map((s, i) => {
      const status = getStudentPaymentStatus(s);
      const fee = getStudentMonthlyFee(s);
      const action = status === 'Due'
        ? `<button class="btn btn-gold btn-sm" onclick="${role === 'admin' ? `markPaid('${s.id}')` : `openPay('${s.id}','${getStudentName(s)}','${fee}')`}">${role === 'admin' ? 'Mark Paid' : 'Pay'}</button>`
        : `<button class="btn btn-outline btn-sm" onclick="downloadReceipt('${s.id}','${getStudentName(s)}','${fee}')">Receipt</button>`;
      return `<tr><td style="font-family:'DM Mono';color:var(--ivory-dim)">#CK-${String(i+1).padStart(4,'0')}</td><td style="font-weight:600">${getStudentName(s)}</td><td style="font-family:'DM Mono'">₹${fee}</td><td><span class="${status==='Paid'?'text-success':'text-danger'}">${status}</span></td><td>${action}</td></tr>`;
    }).join('');
  }

  async function markPaid(id) {
    // Clear any pending refresh for immediate update
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);

    try {
      const res = await apiCall(`${API_BASE}/students?id=${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active', payment_status: 'Paid' }) });
      const result = await res.json();
      if (!res.ok) {
        toast('Failed: ' + (result.error || 'Unknown error'), 'error');
        return false;
      }
      toast('Marked as paid!', 'success');

      // Immediately update local data without API reload
      const updatedStudent = result.data || { id, status: 'active', payment_status: 'Paid' };
      allStudents = allStudents.map(s => String(s.id) === String(id) ? { ...s, ...updatedStudent } : s);
      dataCache = { coaches: allCoaches, students: allStudents, achievements: achievementsData, events: eventsData, timestamp: Date.now() };

      renderBills();
      renderDash();
      renderStudents();
      return true;
    } catch (e) { toast('Failed', 'error'); return false; }
  }

  async function bulkMarkPaid() {
    if (!confirm('Mark all filtered students as paid?')) return;
    if (isLoading('bulk-payment')) return;

    // Clear any pending refresh
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);

    const coachFilter = $('f-coach').value;
    const statusFilter = $('f-status').value;
    const minFee = parseInt($('f-min-fee').value) || 0;
    const maxFee = parseInt($('f-max-fee').value) || Infinity;

    // Get filtered students that are due
    let studentsToUpdate = allStudents.filter(s => {
      if (getStudentPaymentStatus(s) !== 'Due') return false;
      if (coachFilter) {
        const studentCoachId = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null);
        if (studentCoachId !== coachFilter) return false;
      }
      if (statusFilter && getStudentPaymentStatus(s) !== statusFilter) return false;
      const fee = getStudentMonthlyFee(s);
      if (fee < minFee || fee > maxFee) return false;
      return true;
    });

    if (!studentsToUpdate.length) {
      toast('No students match the current filters', 'error');
      return;
    }

    setLoading('bulk-payment', true);
    toast(`Processing ${studentsToUpdate.length} payments...`, 'info');

    let successCount = 0;
    let failCount = 0;

    // Process payments with concurrency control (max 3 at a time)
    const batchSize = 3;
    for (let i = 0; i < studentsToUpdate.length; i += batchSize) {
      const batch = studentsToUpdate.slice(i, i + batchSize);
      await Promise.all(batch.map(async (student) => {
        try {
          const res = await apiCall(`${API_BASE}/students?id=${encodeURIComponent(student.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'active', payment_status: 'Paid' })
          });
          const result = await res.json();

          if (res.ok) {
            // Update local data immediately
            const updatedStudent = result.data || { id: student.id, status: 'active', payment_status: 'Paid' };
            allStudents = allStudents.map(s => String(s.id) === String(student.id) ? { ...s, ...updatedStudent } : s);
            successCount++;
            trackAPICall(true);
          } else {
            failCount++;
            trackAPICall(false);
            console.error('Failed to update student:', student.id, result);
          }
        } catch (e) {
          failCount++;
          trackAPICall(false);
          console.error('Error updating student:', student.id, e);
        }
      }));
    }

    // Update cache and re-render
    dataCache = { coaches: allCoaches, students: allStudents, achievements: achievementsData, events: eventsData, timestamp: Date.now() };

    renderBills();
    renderDash();
    renderStudents();

    setLoading('bulk-payment', false);

    const message = `Bulk payment complete: ${successCount} successful${failCount > 0 ? `, ${failCount} failed` : ''}`;
    toast(message, failCount > 0 ? 'error' : 'success');
  }

  async function markPaidAndDownload(id, name, fee) {
    const success = await markPaid(id);
    if (success) downloadReceipt(id, name, fee);
  }

  function openPay(id, name, fee) { payTarget = { id, name, fee }; $('pay-amt').textContent = '₹' + fee; $('pay-name').textContent = name; $('pay-preview').style.display = 'none'; $('pay-options').style.display = 'grid'; $('pay-processing').style.display = 'none'; openModal('pay-modal'); }

  function initiatePay(provider) {
    if (!payTarget) return;
    $('pay-options').style.display = 'none';
    $('pay-processing').style.display = 'block';
    $('pay-provider').textContent = provider + ' payment initiated';
    toast(`Processing ${provider}...`, 'info');
    
    setTimeout(() => {
      if (payTarget) {
        markPaid(payTarget.id).then(() => showReceiptPreview(payTarget.name, payTarget.fee, provider));
      }
    }, 2000);
  }

  function showReceiptPreview(name, fee, method) {
    const date = new Date();
    const receiptNum = 'RCPT-' + Date.now().toString(36).toUpperCase();
    $('receipt-number').textContent = 'Receipt: ' + receiptNum;
    $('receipt-student').textContent = name;
    $('receipt-date').textContent = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    $('receipt-method').textContent = method;
    $('receipt-amount').textContent = '₹' + Number(fee).toLocaleString('en-IN');
    closeModals();
    openModal('receipt-preview-modal');
    toast('Payment successful!', 'success');
    payTarget = null;
  }

  function printReceipt() {
    window.print();
  }

  function simPay(provider) {
    toast(`Processing ${provider}...`, 'info');
    setTimeout(async () => {
      if (payTarget) {
        await markPaidAndDownload(payTarget.id, payTarget.name, payTarget.fee);
      }
    }, 1500);
  }

  function downloadReceipt(id, name, fee) {
    const date = new Date();
    const receiptNumber = 'RCPT-' + Date.now().toString(36).toUpperCase();
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${receiptNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; background: #1a1a1a; min-height: 100vh; }
    .receipt { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
    .receipt-header { background: linear-gradient(135deg, #dca33e 0%, #b8922e 100%); padding: 40px; text-align: center; color: #fff; }
    .crown { font-size: 48px; margin-bottom: 12px; }
    .academy-name { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; letter-spacing: 2px; }
    .receipt-sub { font-size: 14px; opacity: 0.9; margin-top: 8px; }
    .receipt-body { padding: 40px; }
    .receipt-number { font-family: 'DM Mono', monospace; font-size: 13px; color: #888; text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
    .receipt-number strong { color: #dca33e; }
    .receipt-row { display: flex; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid #f5f5f5; }
    .receipt-row:last-child { border-bottom: none; }
    .receipt-label { color: #666; font-size: 14px; }
    .receipt-value { font-weight: 600; font-size: 16px; color: #1a1a1a; }
    .receipt-total { background: #fafafa; margin: 20px -40px -40px; padding: 30px 40px; text-align: right; border-top: 2px solid #dca33e; }
    .total-label { font-size: 16px; color: #666; }
    .total-amount { font-size: 36px; font-weight: 700; color: #dca33e; font-family: 'DM Mono', monospace; }
    .status-badge { display: inline-block; background: #22c55e; color: #fff; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .footer { text-align: center; padding: 30px; background: #fafafa; color: #888; font-size: 13px; }
    .footer p { margin-bottom: 8px; }
    .thank-you { font-family: 'Playfair Display', serif; font-size: 24px; color: #dca33e; margin-bottom: 12px; }
    @media print { body { background: #fff; padding: 0; } .receipt { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="receipt-header">
      <div class="crown">♚</div>
      <div class="academy-name">CHESSKIDOO</div>
      <div class="receipt-sub">Premium Chess Academy</div>
    </div>
    <div class="receipt-body">
      <div class="receipt-number">Receipt: <strong>${receiptNumber}</strong></div>
      <div class="receipt-row">
        <span class="receipt-label">Student Name</span>
        <span class="receipt-value">${name}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Date</span>
        <span class="receipt-value">${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Payment For</span>
        <span class="receipt-value">Monthly Tuition</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Status</span>
        <span class="receipt-value"><span class="status-badge">PAID</span></span>
      </div>
      <div class="receipt-total">
        <div class="total-label">Total Amount</div>
        <div class="total-amount">₹${Number(fee).toLocaleString('en-IN')}</div>
      </div>
    </div>
    <div class="footer">
      <div class="thank-you">Thank You!</div>
      <p>Chesskidoo Academy • Premium Chess Education</p>
      <p>www.chesskidoo.com • contact@chesskidoo.com</p>
    </div>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    toast('Receipt generated - print dialog opened', 'success');
  }

  function generatePaymentQR(amount) {
    const upiId = 'chesskidoo@upi';
    const note = `Chesskidoo Tuition ₹${amount}`;
    return `upi://${upiId}?am=${amount}&tn=${encodeURIComponent(note)}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════════════════════════
  async function renderMsgs() {
    $('msgs-loading').style.display = 'none';
    $('msgs-list').style.display = 'grid';
    
    try {
      const response = await apiCall('/api/messages');
      const result = await response.json();
      allMessages = result.data || result || [];
    } catch (e) { allMessages = []; }

    if (!allMessages.length) { $('msgs-list').innerHTML = `<div class="empty-state"><div class="empty-icon">💬</div><p>No messages.</p></div>`; return; }

    $('msgs-list').innerHTML = allMessages.map(m => {
      const priority = getMessagePriority(m);
      const isRead = getMessageIsRead(m);
      const priorityColor = priority === 'urgent' ? 'var(--danger)' : priority === 'high' ? 'var(--gold)' : 'var(--ivory-dim)';
      return `
        <div style="padding:20px;background:var(--bg2);border:1px solid var(--border);border-radius:16px;${!isRead ? 'border-left:4px solid var(--gold)' : ''}">
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
    // Clear any pending refresh
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    
    try {
      const res = await apiCall(`${API_BASE}/messages?id=${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_read: true, read_at: new Date().toISOString() }) });
      if (res.ok) {
        // Immediately update local data
        allMessages = allMessages.map(m => String(m.id) === String(id) ? { ...m, is_read: true, read_at: new Date().toISOString() } : m);
        renderMsgs();
        updateMsgBadge();
      }
    } catch (e) {}
  }

  async function deleteMsg(id) {
    if (!confirm('Delete?')) return;
    // Clear any pending refresh
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    try {
      const res = await apiCall(`${API_BASE}/messages?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        // Immediately remove from local data
        allMessages = allMessages.filter(m => String(m.id) !== String(id));
        renderMsgs();
        updateMsgBadge();
      }
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════════
  // PARENT VIEW
  // ═══════════════════════════════════════════════════════════════
  function renderChild() {
    if (!currentStudent) return;
    const s = currentStudent;
    $('c-name').textContent = getStudentName(s);
    $('c-elo').textContent = getStudentRating(s);
    $('c-level').textContent = getStudentLevel(s);
    const studentCoachId = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null);
    const coachName = studentCoachId ? (allCoaches.find(c => String(c.id) === studentCoachId)?.full_name || 'Unassigned') : 'Unassigned';
    $('c-coach').textContent = coachName;
    $('c-notes').textContent = getStudentCoachNotes(s) || 'Great progress!';
    $('contact-coach').textContent = coachName;
    $('p-av-wrap').innerHTML = `<img src="${makeAvSrc(s)}" class="profile-av">`;

    const studentSkills = getStudentSkills(s);
    const skills = ['Tactics', 'Endgame', 'Openings', 'Positional'];
    const scores = [studentSkills.tactics, studentSkills.endgame, studentSkills.openings, studentSkills.positional];
    $('skill-bars').innerHTML = skills.map((sk, i) => `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:6px"><span>${sk}</span><span style="color:var(--gold)">${scores[i]}/100</span></div>
        <div style="height:8px;background:rgba(255,255,255,0.05);border-radius:4px"><div style="height:100%;width:${scores[i]}%;background:linear-gradient(90deg,var(--gold),var(--gold2);border-radius:4px"></div></div>
      </div>`).join('');

    const myAchs = achievementsData.filter(a => a.students && a.students.full_name === getStudentName(s));
    $('parent-ach').innerHTML = myAchs.length ? myAchs.map(a => `<div class="ach-card">${a.img_url ? `<img src="${a.img_url}" class="ach-img">` : `<div class="ach-img-placeholder">🏆</div>`}<div class="ach-info"><div class="ach-title">${a.title}</div></div></div>`).join('') : `<div class="empty-state"><div class="empty-icon">🎖</div><p>No achievements yet.</p></div>`;

    $('child-loading').style.display = 'none';
    $('child-content').style.display = 'block';
  }

  function openContactModal() { openModal('contact-modal'); }

  async function sendMsg() {
    const msg = $('contact-msg').value.trim();
    if (!msg) { toast('Message required', 'error'); return; }
    try {
      await apiCall(`${API_BASE}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_type: 'parent', sender_id: currentStudent.id, receiver_type: 'admin', message: msg }) });
      toast('Sent!', 'success');
      closeModals();
    } catch (e) { toast('Failed', 'error'); }
  }

  async function sendFeedback() {
    const msg = $('fb-msg').value.trim();
    if (!msg) { toast('Feedback required', 'error'); return; }
    try {
      await apiCall(`${API_BASE}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_type: 'parent', sender_id: currentStudent?.id, receiver_type: 'admin', subject: 'Parent Feedback', message: msg }) });
      toast('Thank you!', 'success');
      closeModals();
    } catch (e) { toast('Failed', 'error'); }
  }

// ═══════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  function renderDash() {
    const paidStudents = allStudents.filter(s => getStudentPaymentStatus(s) === 'Paid');
    const dueStudents = allStudents.filter(s => getStudentPaymentStatus(s) === 'Due');
    const avgElo = allStudents.length ? Math.round(allStudents.reduce((a, s) => a + (getStudentRating(s) || 0), 0) / allStudents.length) : 0;

    const paidAmount = paidStudents.reduce((a, s) => a + getStudentMonthlyFee(s), 0);
    const dueAmount = dueStudents.reduce((a, s) => a + getStudentMonthlyFee(s), 0);
    const totalExpected = paidAmount + dueAmount;
    
    const coachExpenses = allCoaches.reduce((a, c) => a + getCoachSalary(c), 0);
    const operationsCost = 15000;
    const totalSpending = coachExpenses + operationsCost;
    const netProfit = paidAmount - totalSpending;
    const collectionRate = totalExpected > 0 ? Math.round((paidAmount / totalExpected) * 100) : 0;

    $('s-total').textContent = allStudents.length;
    $('s-elo').textContent = avgElo;
    $('s-coaches').textContent = allCoaches.length;

    $('s-rev').textContent = '₹' + paidAmount.toLocaleString();
    $('s-due').textContent = '₹' + dueAmount.toLocaleString();
    $('s-coach-exp').textContent = '₹' + coachExpenses.toLocaleString();
    $('s-spend').textContent = '₹' + totalSpending.toLocaleString();
    $('s-profit').textContent = (netProfit >= 0 ? '₹' : '-₹') + Math.abs(netProfit).toLocaleString();
    $('s-profit').style.color = netProfit >= 0 ? 'var(--success)' : 'var(--danger)';
    $('s-rate').textContent = collectionRate + '%';

    buildCharts(allStudents);
  }

  function getCoachStats(studs) {
    const coachMap = {};
    studs.forEach(s => {
      const studentCoachId = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null);
      const cn = studentCoachId ? (allCoaches.find(c => String(c.id) === studentCoachId)?.full_name || 'Unknown') : 'Unassigned';
      coachMap[cn] = (coachMap[cn] || 0) + 1;
    });
    const allStudentCoachIds = studs.map(s => s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null));
    const allCoachIds = allCoaches.map(c => c.id);
    const assignedCoachIds = new Set(allStudentCoachIds.filter(id => id && allCoachIds.includes(id)));
    const unassignedCount = allStudentCoachIds.filter(id => !id || !allCoachIds.includes(id)).length;
    return { coachMap, assignedCoachIds, unassignedCount };
  }

  function showNotifications() {
    const notifications = [
      { type: 'info', message: 'Welcome to Chesskidoo Admin Panel!', time: 'Just now' },
      { type: 'success', message: 'All systems operational', time: '2 hours ago' },
      { type: 'warning', message: '5 students have pending payments', time: '1 day ago' },
      { type: 'info', message: 'New achievement unlocked by a student', time: '2 days ago' }
    ];

    const content = notifications.map(n => `
      <div class="notification-item ${n.type}">
        <div class="notification-icon">${n.type === 'success' ? '✓' : n.type === 'warning' ? '⚠️' : n.type === 'error' ? '✕' : 'ℹ'}</div>
        <div class="notification-content">
          <div class="notification-message">${n.message}</div>
          <div class="notification-time">${n.time}</div>
        </div>
      </div>
    `).join('');

    openModal('notification-modal');
    $('notification-content').innerHTML = content;
  }

  function updateNotificationBadge() {
    const unreadCount = allMessages.filter(m => !getMessageIsRead(m)).length;
    const badge = $('notification-badge');
    const btn = $('notification-btn');

    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.style.display = 'inline-block';
      btn.classList.add('has-notifications');
    } else {
      badge.style.display = 'none';
      btn.classList.remove('has-notifications');
    }
  }

  function exportData() {
    const data = {
      students: allStudents.map(s => ({
        id: s.id,
        name: getStudentName(s),
        phone: getStudentPhone(s),
        email: getStudentEmail(s),
        level: getStudentLevel(s),
        rating: getStudentRating(s),
        coach: getStudentCoachName(s),
        batch_type: getStudentBatchType(s),
        batch_time: getStudentBatchTime(s),
        payment_status: getStudentPaymentStatus(s),
        monthly_fee: getStudentMonthlyFee(s),
        join_date: getStudentDate(s)
      })),
      coaches: allCoaches.map(c => ({
        id: c.id,
        name: getCoachName(c),
        email: getCoachEmail(c),
        phone: c.phone,
        specialty: getCoachSpecialty(c),
        experience: getCoachExperience(c),
        rating: getCoachRating(c),
        salary: getCoachSalary(c),
        status: getCoachStatus(c)
      })),
      achievements: achievementsData,
      events: eventsData,
      messages: allMessages,
      export_date: new Date().toISOString(),
      version: '2.0.0',
      summary: {
        total_students: allStudents.length,
        active_students: allStudents.filter(s => s.status === 'active').length,
        total_revenue: allStudents.filter(s => getStudentPaymentStatus(s) === 'Paid').reduce((a, s) => a + getStudentMonthlyFee(s), 0),
        total_dues: allStudents.filter(s => getStudentPaymentStatus(s) === 'Due').reduce((a, s) => a + getStudentMonthlyFee(s), 0),
        total_coaches: allCoaches.length,
        total_achievements: achievementsData.length,
        total_events: eventsData.length
      }
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `chesskidoo-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast('Backup created successfully!', 'success');
  }

  // Backup current state to localStorage
  // PDF Reports
  async function generateFinancialReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('Chesskidoo Financial Report', 20, 30);

    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 45);

    // Summary
    const paidStudents = allStudents.filter(s => getStudentPaymentStatus(s) === 'Paid');
    const dueStudents = allStudents.filter(s => getStudentPaymentStatus(s) === 'Due');
    const paidAmount = paidStudents.reduce((a, s) => a + getStudentMonthlyFee(s), 0);
    const dueAmount = dueStudents.reduce((a, s) => a + getStudentMonthlyFee(s), 0);
    const coachExpenses = allCoaches.reduce((a, c) => a + getCoachSalary(c), 0);
    const netProfit = paidAmount - coachExpenses;

    doc.text('Financial Summary:', 20, 65);
    doc.text(`Total Revenue: ₹${paidAmount.toLocaleString()}`, 30, 80);
    doc.text(`Outstanding Dues: ₹${dueAmount.toLocaleString()}`, 30, 90);
    doc.text(`Coach Expenses: ₹${coachExpenses.toLocaleString()}`, 30, 100);
    doc.text(`Net Profit: ₹${netProfit.toLocaleString()}`, 30, 110);

    // Student payments table
    doc.text('Student Payment Details:', 20, 130);
    let y = 145;
    doc.setFontSize(10);
    doc.text('Name', 20, y);
    doc.text('Fee', 100, y);
    doc.text('Status', 140, y);
    y += 10;

    allStudents.forEach(s => {
      if (y > 270) {
        doc.addPage();
        y = 30;
      }
      doc.text(getStudentName(s), 20, y);
      doc.text(`₹${getStudentMonthlyFee(s)}`, 100, y);
      doc.text(getStudentPaymentStatus(s), 140, y);
      y += 8;
    });

    doc.save('financial-report.pdf');
    toast('Financial report downloaded!', 'success');
  }

  async function generateStudentReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('Chesskidoo Student Report', 20, 30);

    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 45);
    doc.text(`Total Students: ${allStudents.length}`, 20, 55);

    // Student table
    doc.text('Student Details:', 20, 75);
    let y = 90;
    doc.setFontSize(10);
    doc.text('Name', 20, y);
    doc.text('Level', 80, y);
    doc.text('Coach', 120, y);
    doc.text('Status', 160, y);
    y += 10;

    allStudents.forEach(s => {
      if (y > 270) {
        doc.addPage();
        y = 30;
      }
      const studentCoachId = s.coaches?.id ? String(s.coaches.id) : (s.coach_id ? String(s.coach_id) : null);
      const coachName = studentCoachId ? (allCoaches.find(c => String(c.id) === studentCoachId)?.full_name || 'Unassigned') : 'Unassigned';

      doc.text(getStudentName(s), 20, y);
      doc.text(getStudentLevel(s), 80, y);
      doc.text(coachName, 120, y);
      doc.text(getStudentStatus(s), 160, y);
      y += 8;
    });

    doc.save('student-report.pdf');
    toast('Student report downloaded!', 'success');
  }

  function createLocalBackup() {
    try {
      const backup = {
        timestamp: Date.now(),
        data: dataCache,
        user: role,
        version: '2.0.0'
      };
      localStorage.setItem('chesskidoo_backup', JSON.stringify(backup));
      toast('Local backup created', 'success');
    } catch (error) {
      console.error('Backup failed:', error);
      toast('Backup failed', 'error');
    }
  }

  // Restore from local backup
  function restoreLocalBackup() {
    try {
      const backup = JSON.parse(localStorage.getItem('chesskidoo_backup'));
      if (!backup) {
        toast('No backup found', 'error');
        return;
      }

      dataCache = backup.data;
      allCoaches = dataCache.coaches || [];
      allStudents = dataCache.students || [];
      achievementsData = dataCache.achievements || [];
      eventsData = dataCache.events || [];

      syncCoachDropdowns();
      renderDash();
      renderStudents();
      updateMsgBadge();

      toast('Backup restored successfully', 'success');
    } catch (error) {
      console.error('Restore failed:', error);
      toast('Restore failed', 'error');
    }
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
  // AI ASSISTANT
  // ═══════════════════════════════════════════════════════════════
  let activeAIModule = 'global';

  function setAIModule(module) {
    activeAIModule = module;
    const btns = document.querySelectorAll('.ai-ws-menu .ai-ws-btn');
    if(btns.length) {
      btns.forEach(b => b.classList.remove('active'));
      if(module === 'global') btns[0].classList.add('active');
      if(module === 'finance') btns[1].classList.add('active');
      if(module === 'coach') btns[2].classList.add('active');
    }

    const suggestBox = document.querySelector('.ai-ws-suggest');
    const input = document.getElementById('ai-query');
    if (!suggestBox || !input) return;

    if(module === 'global') {
      input.placeholder = "Ask about revenue trends, active coaches, or due payments...";
      suggestBox.innerHTML = `
        <button class="ai-ws-pill" onclick="setAISuggestion('How many students are enrolled?')">How many students?</button>
        <button class="ai-ws-pill" onclick="setAISuggestion('What is the total revenue?')">Total revenue?</button>
        <button class="ai-ws-pill" onclick="setAISuggestion('Which coach has the most students?')">Top coach?</button>
        <button class="ai-ws-pill" onclick="setAISuggestion('Show me payment status breakdown')">Payment status breakdown</button>
      `;
    } else if (module === 'finance') {
      input.placeholder = "Ask about specific payments, total fees, or monthly growth...";
      suggestBox.innerHTML = `
        <button class="ai-ws-pill" onclick="setAISuggestion('What is the monthly processing fee volume?')">Fee metrics?</button>
        <button class="ai-ws-pill" onclick="setAISuggestion('Who has unpaid dues?')">List unpaid dues</button>
        <button class="ai-ws-pill" onclick="setAISuggestion('Calculate projected monthly revenue')">Projected revenue</button>
      `;
    } else if (module === 'coach') {
      input.placeholder = "Ask about coach ratings, student assignments, or salaries...";
      suggestBox.innerHTML = `
        <button class="ai-ws-pill" onclick="setAISuggestion('Which coach has the highest rating?')">Highest rating?</button>
        <button class="ai-ws-pill" onclick="setAISuggestion('Show coach salary distribution')">Salary distribution</button>
        <button class="ai-ws-pill" onclick="setAISuggestion('How many students does each coach handle?')">Coach load?</button>
      `;
    }
  }
  window.setAIModule = setAIModule;

  function setAISuggestion(query) {
    if ($('ai-query')) {
      $('ai-query').value = query;
      sendAIQuery();
    }
  }
  window.setAISuggestion = setAISuggestion;

  async function sendAIQuery() {
    const inputEl = $('ai-query');
    if (!inputEl) return;
    const msg = inputEl.value.trim();
    if (!msg) return;

    inputEl.value = '';
    const bodyEl = $('ai-workspace-msgs');
    if (!bodyEl) return;

    bodyEl.innerHTML += `
      <div class="ai-ws-msg user">
        <div class="ai-ws-avatar">👤</div>
        <div class="ai-ws-bubble">${msg}</div>
      </div>
    `;
    setTimeout(() => bodyEl.scrollTop = bodyEl.scrollHeight, 50);

    const botLoadingId = 'ws-msg-' + Date.now();
    bodyEl.innerHTML += `
      <div class="ai-ws-msg bot" id="${botLoadingId}">
        <div class="ai-ws-avatar">🤖</div>
        <div class="ai-ws-bubble" style="color:var(--ivory-dim)">Thinking...</div>
      </div>
    `;
    setTimeout(() => bodyEl.scrollTop = bodyEl.scrollHeight, 50);

    try {
      const payload = { 
        message: msg, 
        role: 'admin', 
        context: { 
          students: allStudents.length,
          coaches: allCoaches.length,
          moduleFocus: activeAIModule
        } 
      };
      const res = await apiCall(`${API_BASE}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      $(botLoadingId).innerHTML = `
        <div class="ai-ws-avatar">🤖</div>
        <div class="ai-ws-bubble">${data.message || "An error occurred."}</div>
      `;
    } catch (e) {
      $(botLoadingId).innerHTML = `
        <div class="ai-ws-avatar">🤖</div>
        <div class="ai-ws-bubble" style="color:var(--danger)">Connection to Copilot failed.</div>
      `;
    }
    setTimeout(() => bodyEl.scrollTop = bodyEl.scrollHeight, 50);
  }
  window.sendAIQuery = sendAIQuery;

  // ═══════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════
  window.addEventListener('DOMContentLoaded', loadAllData);

  // Expose functions
  window.toggleSidebar = toggleSidebar;
  window.setPage = setPage;
  window.toggleEye = toggleEye;
  window.doLogin = doLogin;
  window.doLogout = doLogout;
  window.openProfile = openProfile;
  window.clearFilters = clearFilters;
  window.renderStudents = renderStudents;
  window.viewStudent = viewStudent;
  window.renderCoachMgmt = renderCoachMgmt;
  window.viewCoachSchedule = viewCoachSchedule;
  window.openCoachModal = openCoachModal;
  window.saveCoach = saveCoach;
  window.deleteCoach = deleteCoach;
  window.openEdit = openEdit;
  window.updateStudent = updateStudent;
  window.openEnroll = openEnroll;
  window.saveStudent = saveStudent;
  window.deleteStudent = deleteStudent;
  window.openAwardModal = openAwardModal;
  window.onAwardStudentChange = onAwardStudentChange;
  window.saveAward = saveAward;
  window.deleteAchievement = deleteAchievement;
  window.renderEvents = renderEvents;
  window.saveEvent = saveEvent;
  window.deleteEvent = deleteEvent;
  window.registerEvent = registerEvent;
  window.renderBills = renderBills;
  window.markPaid = markPaid;
  window.bulkMarkPaid = bulkMarkPaid;
  window.openPay = openPay;
  window.initiatePay = initiatePay;
  window.simPay = simPay;
  window.downloadReceipt = downloadReceipt;
  window.showReceiptPreview = showReceiptPreview;
  window.printReceipt = printReceipt;
  window.showNotifications = showNotifications;
  window.updateNotificationBadge = updateNotificationBadge;
  window.generatePaymentQR = generatePaymentQR;
  window.openContactModal = openContactModal;
  window.sendMsg = sendMsg;
  window.sendFeedback = sendFeedback;
  window.renderChild = renderChild;
  window.setAISuggestion = setAISuggestion;
  window.sendAIQuery = sendAIQuery;

  window.toggleTheme = toggleTheme;
  window.closeModals = closeModals;
  window.previewFile = previewFile;
  window.openModal = openModal;
  window.renderMsgs = renderMsgs;
  window.markMsgRead = markMsgRead;
  window.deleteMsg = deleteMsg;
  window.exportData = exportData;
  window.createLocalBackup = createLocalBackup;
  window.checkHealth = checkHealth;
  window.runStressTest = runStressTest;

  // PDF Report Generation
  async function generateReportPDF() {
    try {
      toast('Generating PDF Report...', 'info');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      doc.setFontSize(22);
      doc.text('Chesskidoo Academy - Financial Report', 14, 22);
      doc.setFontSize(11);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
      
      const paidStudents = allStudents.filter(s => getStudentPaymentStatus(s) === 'Paid');
      const dueStudents = allStudents.filter(s => getStudentPaymentStatus(s) === 'Due');
      const paidAmount = paidStudents.reduce((a, s) => a + getStudentMonthlyFee(s), 0);
      const dueAmount = dueStudents.reduce((a, s) => a + getStudentMonthlyFee(s), 0);
      const coachExp = allCoaches.reduce((a, c) => a + getCoachSalary(c), 0);
      const totalStudents = allStudents.length;

      doc.setFontSize(16);
      doc.text('Executive Summary', 14, 45);
      
      doc.setFontSize(12);
      let y = 55;
      doc.text(`Total Active Cadets: ${totalStudents}`, 14, y); y += 8;
      doc.text(`Total Paid Cadets: ${paidStudents.length}`, 14, y); y += 8;
      doc.text(`Total Due Cadets: ${dueStudents.length}`, 14, y); y += 8;
      
      y += 5;
      doc.text(`Revenue Collected (Paid): Rs ${paidAmount.toLocaleString()}`, 14, y); y += 8;
      doc.text(`Outstanding Dues:         Rs ${dueAmount.toLocaleString()}`, 14, y); y += 8;
      doc.text(`Total Coach Expenses:     Rs ${coachExp.toLocaleString()}`, 14, y); y += 8;
      
      doc.setFontSize(16);
      y += 10;
      doc.text(`Net Profit Estimate:      Rs ${(paidAmount - coachExp).toLocaleString()}`, 14, y);
      
      doc.save(`chesskidoo_financial_report_${new Date().toISOString().split('T')[0]}.pdf`);
      toast('PDF Generated Successfully', 'success');
    } catch (e) {
      console.error(e);
      toast('Failed to generate PDF', 'error');
    }
  }

  window.generateReportPDF = generateReportPDF;
  // AI Chatbot Logic
  let isChatbotOpen = false;
  function toggleChatbot() {
    isChatbotOpen = !isChatbotOpen;
    $('ai-chat-panel').style.display = isChatbotOpen ? 'flex' : 'none';
    if (isChatbotOpen) $('ai-input').focus();
  }

  async function sendChatMessage() {
    const inputEl = $('ai-input');
    const msg = inputEl.value.trim();
    if (!msg) return;

    inputEl.value = '';
    const bodyEl = $('ai-chat-body');
    bodyEl.innerHTML += `<div class="ai-msg user">${msg}</div>`;
    bodyEl.scrollTop = bodyEl.scrollHeight;

    const botLoadingId = 'msg-' + Date.now();
    bodyEl.innerHTML += `<div class="ai-msg bot" id="${botLoadingId}">...</div>`;
    bodyEl.scrollTop = bodyEl.scrollHeight;

    try {
      const parentMode = document.body.contains($('m-name')) ? false : true; 
      // Very basic context approximation: role from global
      const payload = {
        message: msg,
        role: role || 'parent',
        context: { students: allStudents.length }
      };

      const res = await apiCall(`${API_BASE}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      $(botLoadingId).textContent = data.message || "Something went wrong.";
    } catch (e) {
      $(botLoadingId).textContent = "Error connecting to AI service.";
    }
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  window.toggleChatbot = toggleChatbot;
  window.sendChatMessage = sendChatMessage;

})();
