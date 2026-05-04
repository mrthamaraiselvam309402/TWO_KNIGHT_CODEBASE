/**
 * CHESSKIDOO ACADEMY - Complete Admin Panel Scripts
 * Fixed version - Academy Expansion Logic Integrated
 */

(function () {
  'use strict';

  // Core Utility - Hoisted for early access
  const capitalizeFirst = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };
  window.capitalizeFirst = capitalizeFirst;


  // ═══════════════════════════════════════════════════════════════
  // CONFIG & CONSTANTS
  // ═══════════════════════════════════════════════════════════════
  // SECURITY: Use environment variables via global config
  // For Vercel/Netlify: Set these in project settings → Environment Variables
  // For local development: Use .env file (add to .gitignore!)
  const SUPABASE_URL = APP_CONFIG.SUPABASE_URL || window.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = APP_CONFIG.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || '';
  const API_BASE = '/api';
  const $ = id => document.getElementById(id);

  // Security validation
  if (!SUPABASE_ANON_KEY) {
    console.error('❌ CRITICAL: Supabase Anon Key is missing!');
    console.error('Please set VITE_SUPABASE_ANON_KEY in your environment variables.');
    // Show user-friendly error in production
    if (window.location.hostname !== 'localhost') {
      document.body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px">
          <h1 style="color:var(--danger);margin-bottom:20px">Configuration Error</h1>
          <p style="color:var(--ivory-dim);max-width:500px;margin-bottom:30px">
            The application is not configured properly. Please contact the administrator.
          </p>
          <p style="font-size:12px;color:var(--ivory3)">Error: Missing Supabase configuration</p>
        </div>
      `;
    }
  }

// ═══════════════════════════════════════════════════════════════
   // STATE
   // ═══════════════════════════════════════════════════════════════
   let allCoaches = [];
   let allStudents = [];
   let allPayments = [];
   let allAttendance = [];

   // Expose to window for external modules (like reporting.js)
   window.allCoaches = allCoaches;
   window.allStudents = allStudents;
   window.allPayments = allPayments;
   window.allAttendance = allAttendance;

   let achievementsData = [];
   let eventsData = [];
   let allMessages = [];
   let allRatingHistory = [];
   let allResources = [];

   window.allRatingHistory = allRatingHistory; // Also needed for ELO gainers in report

   window.reportMonth = new Date().getUTCMonth(); // 0-11 (UTC)
   window.reportYear = new Date().getUTCFullYear();
   window.isEditing = false;

   let currentStudent = null;
   let role = null;
   let chartInstances = {};
   let dataCache = { timestamp: 0 };
   let loadDebounceTimer = null;
   let loadingStates = {};
   // Optimized cache for faster dashboard loading
   const CACHE_DURATION = 30000; // 30 seconds cache for better performance
  // ── CORE UTILITIES ──
  async function apiCall(endpoint, options = {}) {
    const url = (endpoint.startsWith('http') || endpoint.startsWith(API_BASE)) 
      ? endpoint 
      : `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${localStorage.getItem('sb-access-token') || SUPABASE_ANON_KEY}`,
      ...options.headers
    };

    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) {
        console.warn(`[Auth] 401 Unauthorized for ${endpoint}. Possible token expiry.`);
      }
      return res;
    } catch (e) {
      console.error(`[API] Connection Error (${endpoint}):`, e);
      throw e;
    }
  }

  function toast(msg, type = 'info') {
    const container = $('toast-container') || createToastContainer();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️')}</span>
        <span class="toast-msg">${msg}</span>
      </div>
    `;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('show'); }, 10);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 4000);
  }

  function createToastContainer() {
    const div = document.createElement('div');
    div.id = 'toast-container';
    document.body.appendChild(div);
    return div;
  }

   function escapeHtml(text) {
     if (!text) return '';
     const div = document.createElement('div');
     div.textContent = String(text);
     return div.innerHTML;
   }

   // Escape string for safe embedding in JavaScript string literal inside HTML attribute
   function jsAttrEncode(value) {
     if (value == null) return '';
     return String(value)
       .replace(/\\/g, '\\\\')
       .replace(/'/g, "\\'")
       .replace(/"/g, '\\"')
       .replace(/\n/g, '\\n')
       .replace(/\r/g, '\\r');
   }

   function dedupeArray(arr, keyField = 'id') {
     if (!Array.isArray(arr)) return [];
     const seen = new Set();
     return arr.filter(item => {
       const key = item && item[keyField] ? String(item[keyField]) : '';
       if (!key || seen.has(key)) return false;
       seen.add(key);
       return true;
     });
   }



  // Sync local currentStudent with window.currentStudent for external modules
  function setCurrentStudent(student) {
    currentStudent = student;
    window.currentStudent = student;
  }

  // ── Notification Management ──
  let shownNotificationIds = JSON.parse(localStorage.getItem('shown_notifications') || '[]');
  let dismissedNotifications = JSON.parse(localStorage.getItem('dismissed_notifications') || '{"messages":[], "payments":[]}');

  function saveNotificationState() {
    localStorage.setItem('shown_notifications', JSON.stringify(shownNotificationIds.slice(-100)));
    localStorage.setItem('dismissed_notifications', JSON.stringify(dismissedNotifications));
  }

  function shouldShowNotification(id) {
    if (shownNotificationIds.includes(id)) return false;
    shownNotificationIds.push(id);
    saveNotificationState();
    return true;
  }

  function clearNotifications() {
    const unreadMsgs = allMessages.filter(m => !getMessageIsRead(m) && m.receiver_type === 'admin');
    unreadMsgs.forEach(m => { if (!dismissedNotifications.messages.includes(m.id)) dismissedNotifications.messages.push(m.id); });
    const dueStudents = allStudents.filter(s => getStudentPaymentStatus(s) === 'Due');
    dueStudents.forEach(s => { if (!dismissedNotifications.payments.includes(s.id)) dismissedNotifications.payments.push(s.id); });
    localStorage.removeItem('audit_logs');
    saveNotificationState();
    updateNotificationBadge();
    const content = $('notification-content');
    if (content) content.innerHTML = '<div style="text-align:center;padding:30px;color:var(--ivory-dim)">Notifications cleared</div>';
    toast('Notifications cleared', 'info');
  }

  function updateNotificationBadge() {
    const unread = allMessages.filter(m => !getMessageIsRead(m) && m.receiver_type === 'admin' && !dismissedNotifications.messages.includes(m.id)).length;
    const dueCount = allStudents.filter(s => getStudentPaymentStatus(s) === 'Due' && !dismissedNotifications.payments.includes(s.id)).length;
    const total = unread + dueCount;
    const badge = $('notification-badge');
    if (badge) { badge.textContent = total; badge.style.display = total > 0 ? 'inline' : 'none'; }
  }


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
    if (tabId === 'events') renderChildEvents();
  }

  function renderChildEvents() {
    const grid = document.getElementById('child-events-grid');
    if (!grid) return;

    const now = new Date();
    const upcoming = eventsData.filter(e => new Date(e.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date));
    const myRegistrations = eventsData.filter(e => e.registered_students?.includes(currentStudent?.id));

    if (upcoming.length === 0) {
      grid.innerHTML = '<div class="empty-state"><span class="empty-icon">📅</span><p>No upcoming events scheduled</p></div>';
      return;
    }

     grid.innerHTML = upcoming.slice(0, 10).map(e => {
       const isRegistered = myRegistrations.some(r => r.id === e.id);
       const eventDate = e.date ? new Date(e.date).toLocaleDateString() : 'TBD';
       const eventTime = e.event_time || e.time || 'TBD';
       return `
         <div class="ev-card">
           ${e.img_url ? `<img src="${escapeHtml(e.img_url)}" class="ev-poster" alt="${escapeHtml(e.title)}">` : ''}
           <div class="ev-header">
             <span class="ev-type-badge">${escapeHtml(e.type || 'Event')}</span>
             <span class="ev-date-badge">${escapeHtml(eventDate)}</span>
           </div>
           <div class="ev-body">
             <div class="ev-title">${escapeHtml(e.title)}</div>
             <div class="ev-meta">
               <span class="ev-meta-item ev-time">⏰ ${escapeHtml(eventTime)}</span>
               <span class="ev-meta-item ev-loc">${escapeHtml(e.location || 'TBD')}</span>
               ${e.prize_pool ? `<span class="ev-meta-item ev-prize">${escapeHtml(e.prize_pool)}</span>` : ''}
             </div>

             ${e.description ? `<div class="ev-desc">${escapeHtml(e.description)}</div>` : ''}
           </div>
           <div class="ev-footer">
             ${isRegistered ?
           `<span class="badge badge-success" style="padding:6px 12px">✅ Registered</span>` :
           `<button class="btn-register" onclick="registerForEvent('${e.id}')">Register</button>`
         }
           </div>
         </div>
       `;
     }).join('');
  }

  function renderChildGrowth() {
    if (!currentStudent) return;
    const s = currentStudent;
    const ctx = document.getElementById('chartChildElo');
    if (ctx && typeof Chart !== 'undefined') {
      if (chartInstances.childElo) chartInstances.childElo.destroy();
      const history = allRatingHistory.filter(h => String(h.student_id) === String(s.id)).sort((a, b) => new Date(h.recorded_at) - new Date(b.recorded_at));
      const labels = history.length ? history.map(h => new Date(h.recorded_at).toLocaleDateString()) : ['Initial'];
      const data = history.length ? history.map(h => h.rating) : [getStudentRating(s)];
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
      const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(now.getDate() - i); const dStr = d.toISOString().split('T')[0];
        const record = myAtt.find(a => a.date === dStr);
        last30.push({ date: d.getDate(), day: days[d.getDay()], status: record ? record.status : 'none' });
      }
      heatmap.innerHTML = '<div class="heatmap-day-label" style="grid-column:1/-1;display:flex;justify-content:space-between;margin-bottom:4px;font-size:10px;color:var(--ivory3)">' +
        '<span>30 days ago</span><span>Today</span></div>' +
        last30.map(d => `<div class="heatmap-day ${d.status}" title="${d.status || 'No class'} - Day ${d.date}">${d.date}<span class="day-label">${d.day}</span></div>`).join('');
    }
  }

  function renderChildResources() {
    const grid = document.getElementById('resource-grid');
    if (!grid || !currentStudent) return;
    const levelRank = { 'Beginner': 0, 'Intermediate': 1, 'Advanced': 2, 'Elite': 3 };
    const sRank = levelRank[getStudentLevel(currentStudent)] || 0;
    const myRes = allResources.filter(r => (levelRank[r.level_requirement] || 0) <= sRank);
    if (!myRes.length) { grid.innerHTML = `<div class="empty-state">No resources yet.</div>`; return; }
     grid.innerHTML = myRes.map(r => `<div class="resource-card"><div class="res-type">${escapeHtml(r.type.toUpperCase())}</div><div class="res-title">${escapeHtml(r.title)}</div><div class="res-desc">${escapeHtml(r.description || '')}</div><div class="res-action"><a href="${escapeHtml(r.url)}" target="_blank" class="btn btn-gold btn-sm" style="width:100%">Open</a></div></div>`).join('');
  }

  function renderChildBilling() {
    const tbody = document.getElementById('child-bill-body');
    if (!tbody || !currentStudent) return;

    const s = currentStudent;
    const status = getStudentPaymentStatus(s);
    const fee = getStudentMonthlyFee(s) || 0;
    const dueDate = s.due_date ? new Date(s.due_date).toLocaleDateString() : 'Not set';
    const myPayments = allPayments.filter(p => String(p.student_id) === String(s.id)).slice(0, 10);

     // Current month row
     let rows = `
       <tr>
         <td>${new Date().toLocaleDateString()}</td>
         <td>Current Month</td>
         <td>₹${fee}</td>
         <td class="${status === 'Paid' ? 'text-success' : 'text-danger'}" style="font-weight:600">${status}</td>
         <td>
           ${status === 'Due' || status === 'Pending' ?
         `<button class="btn btn-gold btn-sm" onclick="openPay('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${fee}')">Pay Now</button>` :
         `<button class="btn btn-outline btn-sm" onclick="downloadReceipt('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${fee}', '${jsAttrEncode(getStudentLevel(s))}', '${getStudentRating(s)}', 'N/A', 'Online')">Receipt</button>`
       }
         </td>
       </tr>
     `;

     // Due date info
     rows += `
       <tr style="background:var(--surface2)">
         <td colspan="2"><strong>Due Date:</strong></td>
         <td>${dueDate}</td>
         <td colspan="2" style="font-size:12px;color:var(--ivory-dim)">Monthly tuition fee</td>
       </tr>
     `;

     // Payment history
     if (myPayments.length > 0) {
       myPayments.forEach(p => {
         const pDate = p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '-';
         const pAmount = p.amount || fee;
         const pStatus = p.status === 'completed' ? 'Paid' : (p.status || 'Pending');
         rows += `
           <tr>
             <td>${pDate}</td>
             <td>Payment</td>
             <td>₹${pAmount}</td>
             <td class="${pStatus === 'Paid' ? 'text-success' : 'text-danger'}">${pStatus}</td>
             <td>
               ${pStatus === 'Paid' ?
             `<button class="btn btn-outline-grey btn-sm" onclick="downloadReceipt('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${pAmount}', '${jsAttrEncode(getStudentLevel(s))}', '${getStudentRating(s)}', 'N/A', '${p.payment_method || 'Online'}')">Receipt</button>` :
             `<span style="color:var(--ivory-dim);font-size:12px">Pending</span>`
           }
             </td>
           </tr>
         `;
       });
     }

    tbody.innerHTML = rows;
  }

  // ── ADMIN EXPANSION LOGIC ──
  function openAttendanceMarking() {
    const dateEl = $('att-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    const coachFilter = $('att-coach-filter');
    const pageCoach = $('f-coach');
    if (coachFilter && pageCoach) coachFilter.value = pageCoach.value;
    renderAttendanceList();
    openModal('attendance-modal');
  }

  window.renderAttendanceList = function() {
    const tbody = $('att-marking-body');
    if (!tbody) return;

    const date = $('att-date')?.value || new Date().toISOString().split('T')[0];
    const coachId = $('att-coach-filter')?.value;
    
    let filteredStudents = allStudents.filter(s => s.status === 'active');
    if (coachId) {
      filteredStudents = filteredStudents.filter(s => String(s.coach_id) === String(coachId));
    }

    const dayRecords = allAttendance.filter(a => a.date === date);

    tbody.innerHTML = filteredStudents.map(s => {
      const existing = dayRecords.find(a => String(a.student_id) === String(s.id));
      const status = existing?.status || '';
      const notes = existing?.notes || '';
      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <img src="${makeAvSrc(s)}" style="width:32px;height:32px;border-radius:50%;border:2px solid var(--gold)">
              <div>
                <div style="font-weight:600">${getStudentName(s)}</div>
                <small style="color:var(--ivory3)">${getStudentLevel(s)} - ${getStudentRating(s)} ELO</small>
              </div>
            </div>
          </td>
          <td>
            <select class="att-status" data-sid="${s.id}" onchange="updateAttStats()">
              <option value="" ${!status ? 'selected' : ''}>-- Select --</option>
              <option value="present" ${status === 'present' ? 'selected' : ''}>✅ Present</option>
              <option value="absent" ${status === 'absent' ? 'selected' : ''}>❌ Absent</option>
              <option value="late" ${status === 'late' ? 'selected' : ''}>⏰ Late</option>
              <option value="excused" ${status === 'excused' ? 'selected' : ''}>📋 Excused</option>
            </select>
          </td>
          <td><input type="text" class="att-notes" data-sid="${s.id}" placeholder="Add note..." value="${notes}"></td>
        </tr>
      `;
    }).join('');

    updateAttStats();
  };

  window.updateAttStats = function () {
    const rows = document.querySelectorAll('#att-marking-body tr');
    let present = 0, absent = 0, late = 0, excused = 0, unmarked = 0;
    rows.forEach(row => {
      const status = row.querySelector('.att-status').value;
      if (status === 'present') present++;
      else if (status === 'absent') absent++;
      else if (status === 'late') late++;
      else if (status === 'excused') excused++;
      else unmarked++;
    });
    const statsEl = document.getElementById('att-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <span style="color:var(--success)">✅ ${present}</span> |
        <span style="color:var(--danger)">❌ ${absent}</span> |
        <span style="color:var(--gold)">⏰ ${late}</span> |
        <span style="color:var(--ivory3)">📋 ${excused}</span> |
        <span style="color:var(--ivory3)"> unmarked: ${unmarked}</span>
      `;
    }
  };

  window.markAllPresent = function () {
    document.querySelectorAll('.att-status').forEach(s => s.value = 'present');
    updateAttStats();
  };

  window.markAllAbsent = function () {
    document.querySelectorAll('.att-status').forEach(s => s.value = 'absent');
    updateAttStats();
  };

  async function saveBatchAttendance() {
    const date = $('att-date').value;
    if (!date) { toast('Please select a date', 'error'); return; }

    const rows = document.querySelectorAll('#att-marking-body tr');
    const records = Array.from(rows).map(row => {
      const select = row.querySelector('.att-status');
      const input = row.querySelector('.att-notes');
      if (!select.value) return null; // Skip unmarked
      return {
        student_id: select.dataset.sid,
        status: select.value,
        date: date,
        notes: input.value
      };
    }).filter(r => r !== null);

    if (records.length === 0) { toast('No attendance marked', 'error'); return; }

    try {
      const res = await apiCall('/api/attendance', { method: 'POST', body: JSON.stringify(records) });
      if (res.ok) {
        toast(`Attendance recorded for ${records.length} students!`, 'success');
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
        toast('Student Promoted!', 'success');
        closeModals();
        loadAllData(true);
      }
    } catch (e) { toast('Promotion failed', 'error'); }
  }

  function sendPaymentReminder(id) {
    const s = allStudents.find(x => String(x.id) === String(id));
    if (!s) return;

    const name = getStudentName(s);
    const monthlyFee = getStudentMonthlyFee(s);
    const phone = getStudentPhone(s);

    // Calculate pending amount based on reporting period
    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;
    const enrollDateStr = getStudentDate(s);
    const enrollDate = enrollDateStr ? new Date(enrollDateStr) : new Date(2026, 2, 1); // Fallback to March 1, 2026
    const baselineDate = new Date(2026, 3, 1); // Global System Baseline (April 1st, 2026)
    const effectiveEnroll = enrollDate < baselineDate ? baselineDate : enrollDate;

    // FIX #5: Always rebuild — never trust a cached map for financial calculations
    const freshPaymentsMap = {};
    (allPayments || []).forEach(p => {
      if (p.status === 'paid') {
        const sid = String(p.student_id || '').trim().toLowerCase();
        if (sid) freshPaymentsMap[sid] = (freshPaymentsMap[sid] || 0) + 1;
      }
    });

    const s_id_key = String(s.id || '').trim().toLowerCase();
    const totalCredits = freshPaymentsMap[s_id_key] || 0;
     const monthsRequired = ((targetYear - effectiveEnroll.getUTCFullYear()) * 12) + (targetMonth - effectiveEnroll.getUTCMonth()) + 1;

    const pendingMonths = Math.max(1, monthsRequired - totalCredits);
    const totalPending = pendingMonths * monthlyFee;

    // Format Due Date
    let dueDateStr = "";
    if (s.due_date) {
      const d = new Date(s.due_date);
      const day = d.getDate();
      const month = d.toLocaleString('en-IN', { month: 'long' });
      const year = d.getFullYear();
      const getOrdinal = (n) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };
      dueDateStr = `${getOrdinal(day)} ${month} ${year}`;
    } else {
      const monthName = new Date(targetYear, targetMonth).toLocaleString('en-IN', { month: 'long' });
      dueDateStr = `5th ${monthName} ${targetYear}`;
    }

    const msg = `Hello Sir/Madam,

This is a gentle reminder regarding the pending chess class fee of INR ${totalPending.toLocaleString()} for your child ${cleanText(name)}. We kindly request you to please settle this on or before ${cleanText(dueDateStr)}.

You may make the payment to: 9025846663 (Ranjith).

Thank you for your cooperation.
- Chesskidoo Academy`;

    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  window.informCoachFees = function (id, silent = false) {
    const c = allCoaches.find(x => String(x.id) === String(id));
    if (!c) return;

    const studs = allStudents.filter(s => String(s.coach_id) === String(id));
    const pending = studs.filter(s => {
      const status = getStudentPaymentStatus(s);
      return status === 'Due' || status === 'Pending';
    });

    if (pending.length === 0) {
      if (!silent) toast(`No pending fees for students under ${getCoachName(c)}`, 'info');
      return;
    }

    const dateStr = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    let msg = `✅ *CHESSKIDOO ACADEMY - FEE AUDIT REPORT*

`;
    msg += `Hello Coach ${cleanText(getCoachName(c))},

`;
    msg += `📢 The following students under your mentorship have an outstanding balance for the *${dateStr}* billing cycle:

`;

    pending.forEach((s) => {
      const status = getStudentPaymentStatus(s);
      const label = status === 'Due' ? 'ARREARS' : 'PENDING';
      const sName = cleanText(getStudentName(s).toUpperCase());
      msg += `*${sName}* (${label})
`;
    });

    msg += `
Please coordinate with the guardians to ensure these balances are settled. 'ARREARS' indicates unpaid fees from previous months, while 'PENDING' is for the current cycle.

`;
    msg += `Regards,
`;
    msg += `*Administrative Team* | Chesskidoo Academy`;


    const phone = c.phone || c.contact || '0000000000';
    const waUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`;

    if (!silent) window.open(waUrl, '_blank');
    else return waUrl;
  };

  window.informAllCoaches = function () {
     const pendingCoaches = (allCoaches || []).filter(coach => {
       const myStudents = (allStudents || []).filter(s => String(s.coach_id) === String(coach.id));
       return myStudents.some(s => {
         const st = getStudentPaymentStatus(s);
         return st === 'Due' || st === 'Pending';
       });
     });

     if (pendingCoaches.length === 0) {
       toast('All coaches are up to date!', 'success');
       return;
     }

     if (!confirm(`Found ${pendingCoaches.length} coaches with arrears. Open all WhatsApp tabs at once? (Note: Your browser may block popups)`)) return;

     pendingCoaches.forEach((coach, idx) => {
        const url = informCoachFees(coach.id, true);
        if (url) {
          setTimeout(() => {
            window.open(url, '_blank');
          }, idx * 1000);
        }
     });

     toast(`Initiated ${pendingCoaches.length} notifications.`, 'success');
   };

   window.informAllDueStudents = function () {
     const dueStudents = (allStudents || []).filter(s => {
       const st = getStudentPaymentStatus(s);
       return st === 'Due';
     });

     if (dueStudents.length === 0) {
       toast('No students with due payments!', 'success');
       return;
     }

     if (!confirm(`Notify parents of ${dueStudents.length} students with due payments? This will open multiple WhatsApp tabs.`)) return;

     const now = new Date();
     const monthName = now.toLocaleString('en-IN', { month: 'long' });
     const year = now.getFullYear();
     let sent = 0;

     dueStudents.forEach((s, idx) => {
       const phone = (s.parent_phone || '').replace(/\D/g, '');
       if (!phone || phone.length < 10) return;

       const name = getStudentName(s);
       const fee = getStudentMonthlyFee(s);
       const dueDateStr = s.due_date
         ? new Date(s.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
         : `5th ${monthName} ${year}`;

       const msg = `Hello Sir/Madam,

This is a gentle reminder regarding the pending chess class fee of INR ${fee.toLocaleString()} for your child ${name}. The due date is ${dueDateStr}.

Please settle the payment at your earliest convenience.

Thank you for your cooperation.
- Chesskidoo Academy`;

       setTimeout(() => {
         window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
         sent++;
         if (sent === dueStudents.length) toast(`Sent ${sent} payment reminders`, 'success');
       }, idx * 800);
     });
   };


  function setLoading(key, loading) {
    loadingStates[key] = loading;
    const loader = $('global-loader');
    const bar = loader ? loader.querySelector('.loader-bar') : null;
    
    const anyLoading = Object.values(loadingStates).some(v => v);
    if (anyLoading) {
      if (loader) loader.classList.add('active');
      if (bar) bar.style.width = '40%';
    } else {
      if (bar) bar.style.width = '100%';
      setTimeout(() => {
        if (loader) loader.classList.remove('active');
        if (bar) bar.style.width = '0%';
      }, 4000);
    }
  }

  function openModal(id) { const el = $(id); if (el) el.style.display = 'flex'; }
   function closeModals() {
     document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
     const hardDeleteCheckbox = $('hard-delete');
     if (hardDeleteCheckbox) hardDeleteCheckbox.checked = false;
   }

   // Setup global UI event handlers once DOM is ready
   function initUI() {
     // Close modals when clicking outside modal content
     document.querySelectorAll('.modal').forEach(m => {
       m.addEventListener('click', e => {
         if (e.target === m) closeModals();
       });
     });
   }

  window.executeDelete = async function () {
    const id = $('delete-item-id').value;
    const type = $('delete-type').value;
    const isHardDelete = $('hard-delete').checked;

    if (!isHardDelete && type === 'event') {
      await archiveEvent(id);
      closeModals();
      return;
    }

    try {
      let endpoint = '';
      let auditTarget = '';
      let successMsg = '';

      if (type === 'event') {
        endpoint = '/api/events?id=' + id;
        auditTarget = 'events';
        successMsg = 'Event permanently deleted!';
      } else if (type === 'achievement') {
        endpoint = '/api/achievements?id=' + id;
        auditTarget = 'achievements';
        successMsg = 'Achievement permanently deleted!';
      } else if (type === 'coach') {
        endpoint = '/api/coaches?id=' + id;
        auditTarget = 'coaches';
        successMsg = 'Coach removed from academy!';
      } else if (type === 'student') {
        endpoint = '/api/students?id=' + id;
        auditTarget = 'students';
        successMsg = 'Student enrollment deleted!';
      }

      if (endpoint) {
        const res = await apiCall(endpoint, { method: 'DELETE' });
        if (res.ok) {
          logAudit(auditTarget, id, 'delete', { id }, null);
          toast(successMsg, 'success');
        } else {
          const err = await res.json().catch(() => ({}));
          toast('Delete failed: ' + (err.error || 'Server error'), 'error');
        }
      }
      closeModals();
      loadAllData(true);
    } catch (e) {
      console.error('Delete failed:', e);
      toast('Technical error: ' + e.message, 'error');
    }
  };


  function previewFile(inp, previewId) {
    const file = inp.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { const img = $(previewId); if (img) { img.src = e.target.result; img.style.display = 'block'; } };
    reader.readAsDataURL(file);
  }

  // Helper accessors
  function cleanText(t) {
    if (!t) return '';
    // Strip HTML tags but preserve all Unicode characters (Tamil, Arabic, etc.)
    return t.toString().replace(/<[^>]*>?/gm, '').trim();
  }
  function getStudentName(s) { 
    const raw = s.full_name || s.name || '';
    return cleanText(raw);
  }
  function getStudentLevel(s) { return capitalizeFirst(s.level || s.grade || 'Beginner'); }
  function getStudentRating(s) { return s.rating || s.current_rating || 800; }
  function getStudentDate(s) {
    const d = s.enrollment_date || s.join_date || s.created_at;
    if (!d) return '';
    try {
      // Return simple YYYY-MM-DD format which Excel handles best
      return new Date(d).toISOString().split('T')[0];
    } catch (e) {
      return String(d).split('T')[0]; // Fallback to raw string before 'T'
    }
  }
  function getStudentPhone(s) { return s.parent_phone || s.phone || ''; }
  function getStudentEmail(s) { return s.email || ''; }
    const DEFAULT_MONTHLY_FEE = 1500; // Configurable default for display

  function getStudentMonthlyFee(s) {
    if (!s) return DEFAULT_MONTHLY_FEE;
    return parseInt(s.monthly_fee || s.fee || s.fees || 0) || DEFAULT_MONTHLY_FEE;
  }
  
  function getStudentPaymentStatus(s, monthOverride = null, yearOverride = null) {
    if (!s) return 'Due';

    // Time-Machine Context (Use override if provided, otherwise default to global)
    const targetMonth = monthOverride !== null ? monthOverride : window.reportMonth;
    const targetYear = yearOverride !== null ? yearOverride : window.reportYear;
    const targetMonthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59));
    const baselineDate = new Date(Date.UTC(2026, 3, 1, 0, 0, 0)); // April 1st, 2026 baseline (UTC)

    // 1. Enrollment Check
    const enrollDateStr = getStudentDate(s);
    const enrollDate = enrollDateStr ? new Date(enrollDateStr) : null;
    if (!enrollDate || enrollDate > targetMonthEnd) return 'Not Enrolled';

    const effectiveEnroll = enrollDate < baselineDate ? baselineDate : enrollDate;

// 2. Credit-Based Reconciliation (Slot Check)
// Build a monthly payment map (only count payments within target month/year)
const paymentsMap = {};
(allPayments || []).forEach(p => {
  if (p.status === 'paid') {
    const pDate = new Date(p.payment_date || p.created_at);
    if (pDate.getUTCFullYear() === targetYear && pDate.getUTCMonth() === targetMonth) {
      const sid = String(p.student_id || '').trim().toLowerCase();
      if (!sid) return;
      if (!paymentsMap[sid]) paymentsMap[sid] = 0;
      paymentsMap[sid]++;
    }
  }
});

const s_id_key = String(s.id || '').trim().toLowerCase();
const totalCredits = paymentsMap[s_id_key] || 0;
const monthsRequired = ((targetYear - effectiveEnroll.getUTCFullYear()) * 12) + (targetMonth - effectiveEnroll.getUTCMonth()) + 1;

const hasDirect = (window.allPayments || []).some(p => {
  const pDate = new Date(p.payment_date || p.created_at);
  const psid = String(p.student_id || '').trim().toLowerCase();
  return psid === s_id_key && pDate.getUTCMonth() === targetMonth && pDate.getUTCFullYear() === targetYear && p.status === 'paid';
});

    const isCurrentMonth = targetMonth === new Date().getUTCMonth() && targetYear === new Date().getUTCFullYear();
    const isAuditPaid = (totalCredits >= monthsRequired) || hasDirect;

    // Determination Logic: 
    // 1. For PAST months: Audit is the ONLY absolute truth.
    // 2. For CURRENT month: Manual override > Audit (allows instant marking).
    // Note: Manual override feature requires additional implementation - audit-based status used for now
    
    return isAuditPaid ? 'Paid' : (totalCredits === monthsRequired - 1 ? 'Pending' : 'Due');
  }

  function getStudentBatchType(s) {
    if (!s) return 'Group';
    const mode = (s.session_mode || s.batch_type || s.session_type || '').toLowerCase();
    if (mode.includes('group')) return 'Group';
    if (mode.includes('single') || mode.includes('one_to_one')) return 'Single';

    // Fallback to notes parsing for legacy data
    const notes = (s.notes || '').toLowerCase();
    if (notes.includes('session:group')) return 'Group';
    if (notes.includes('session:single')) return 'Single';

    return 'Group'; // Default
  }
  function getStudentSessionTime(s) {
    if (s.session_time) return s.session_time;
    const match = (s.notes || '').match(/time[:\s]*([^,]+)/i);
    return match ? match[1].trim() : 'WEEKEND';
  }
  function isStudentScheduledToday(s) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();
    const today = days[now.getDay()];
    const isWeekend = (now.getDay() === 0 || now.getDay() === 6);

    // 1. Check explicit Day columns (Highest Priority)
    const scheduledDay = (s.batch_day || s.session_day || '').toLowerCase();
    if (scheduledDay && scheduledDay.includes(today.toLowerCase())) return true;

    // 2. Fallback to session time pattern matching
    const time = getStudentSessionTime(s).toUpperCase();
    if (time.includes('MORNING & EVENING')) return true; // Daily
    if (time.includes('ANYTIME')) return true;
    if (isWeekend && time.includes('WEEKEND')) return true;
    if (!isWeekend && (time.includes('WEEKDAY') || time.includes('DAILY'))) return true;
    
    // Pattern matches for specific combinations
    if ((now.getDay() === 5 || now.getDay() === 6) && time.includes('FRI & SAT')) return true;
    if ((now.getDay() === 0 || now.getDay() === 1) && time.includes('SUN & MON')) return true;

    return false;
  }
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

  function getCoachName(c) { return c.name || ''; }
  function getCoachSpecialty(c) { return c.specialization || ''; }
  function getCoachSalary(c) { return c.salary || c.hourly_rate || 0; }
  function getCoachAvailability(c) { return c.availability || ''; }
  function getCoachStatus(c) { return c.status || c.account_status || 'active'; }
  function getCoachEmail(c) { return c.email || ''; }
  function getCoachExperience(c) { return c.experience || 0; }
  function getCoachRating(c) { return c.rating || 0; }

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

    if (!currentStudent) { toast('Please login as a parent first', 'error'); return; }
    if (!confirm('Register ' + getStudentName(currentStudent) + ' for "' + e.title + '" on ' + (e.date ? new Date(e.date).toLocaleDateString() : 'TBD') + '?')) return;

    // Optimistic update - add student to registered list locally first
    const registeredStudents = e.registered_students || [];
    if (registeredStudents.includes(currentStudent.id)) {
      toast('Already registered!', 'info');
      return;
    }

    // Add student locally (optimistic)
    registeredStudents.push(currentStudent.id);
    e.registered_students = registeredStudents;
    e.registrations_count = (e.registrations_count || 0) + 1;

    // Also update in eventsData
    const idx = eventsData.findIndex(ev => String(ev.id) === String(eventId));
    if (idx >= 0) {
      eventsData[idx].registered_students = registeredStudents;
      eventsData[idx].registrations_count = (eventsData[idx].registrations_count || 0) + 1;
    }

    // Re-render to show registered
    renderEvents();

    // Try to save to backend (fire and forget)
    try {
      fetch(`${SUPABASE_URL}/functions/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          action: 'register',
          event_id: eventId,
          student_id: currentStudent.id,
          student_name: getStudentName(currentStudent)
        })
      }).catch(() => { });
    } catch (err) {
    }

    toast(`Successfully registered for "${e.title}"!`, 'success');
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
  let isLoadingData = false;
  async function loadAllData(forceRefresh = false) {
    if (loadDebounceTimer) clearTimeout(loadDebounceTimer);
    if (isLoadingData) return;

    const executeLoad = async () => {
      if (isLoadingData) return;
      isLoadingData = true;
      const now = Date.now();
      const hasValidCache = dataCache.timestamp > 0 && dataCache.coaches && dataCache.students;
      if (!forceRefresh && hasValidCache && (now - dataCache.timestamp) < CACHE_DURATION) {
        allCoaches = dataCache.coaches;
        allStudents = dataCache.students;
        achievementsData = dataCache.achievements;
        eventsData = dataCache.events;
        allMessages = dataCache.messages || [];

        // Sync to window for modules
        window.allStudents = allStudents;
        window.allCoaches = allCoaches;
        window.allMessages = allMessages;

        syncCoachDropdowns();
        if (role === 'admin' || role === 'master') {
          renderDash();
          updateMsgBadge();
          renderEvents();
          renderFame();
          renderBills();
          renderMsgs();
          renderCoachMgmt();
          renderStudents();
        }
        else if (role === 'parent') { renderChild(); renderEvents(); }
        isLoadingData = false;
        return;
      }
      try {
        setLoading('data', true);

         const loadWithRetry = async (url, maxRetries = 1) => {
          for (let i = 0; i <= maxRetries; i++) {
            try {
              const response = await apiCall(url, { cache: 'no-store' })
              if (response.ok) {
                const result = await response.json()
                if (result && result.error) throw new Error(result.error);
                // Handle paginated responses
                if (result && result.data !== undefined) {
                  return result.data
                }
                return result
              }
              if (response.status === 404) return null
              throw new Error(`HTTP ${response.status}`)
            } catch (error) {
              if (i === maxRetries) { console.warn(`Failed to load ${url}:`, error); return null }
              await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)))
            }
          }
        }

        console.log('[Sync] Starting parallel data fetch...');
        const fetchWithLog = async (url, key) => {
          console.time(`Fetch:${key}`);
          const res = await loadWithRetry(url);
          console.timeEnd(`Fetch:${key}`);
          return res;
        };

        const [coaches, students, achievements, events, messages, attendance, payments, ratingHistory, resources] = await Promise.all([
          fetchWithLog('/api/coaches', 'coaches'),
          fetchWithLog('/api/students?limit=1000', 'students'),
          fetchWithLog('/api/achievements', 'achievements'),
          fetchWithLog('/api/events', 'events'),
          fetchWithLog('/api/messages', 'messages'),
          fetchWithLog('/api/attendance', 'attendance'),
          fetchWithLog('/api/payments?order=payment_date.desc&limit=1000', 'payments'),
          fetchWithLog('/api/rating_history', 'ratingHistory'),
          fetchWithLog('/api/resources', 'resources')
        ]);

        const extractData = (res) => {
          if (!res) return [];
          if (Array.isArray(res)) return res;
          if (res.data && Array.isArray(res.data)) return res.data;
          return [];
        };

        allCoaches = extractData(coaches);
        allResources = extractData(resources);

        // --- Golden State Deduplication ---
        const rawStudents = extractData(students);
         const seenId = new Set();
         allStudents = rawStudents.filter(s => {
           if (!s || !s.id) return false;
           if (seenId.has(s.id)) return false;
           seenId.add(s.id);
           return true;
         });

         achievementsData = dedupeArray(extractData(achievements), 'id');
         eventsData = dedupeArray(extractData(events), 'id');
         allMessages = dedupeArray(extractData(messages), 'id');
                   allAttendance = extractData(attendance);

         // Deduplicate payments by transaction_id (or id if no transaction_id)
         const seenPayKeys = new Set();
         const dedupedPayments = extractData(payments).filter(p => {
           const key = (p.transaction_id || p.id || '').toString().trim();
           if (!key || seenPayKeys.has(key)) return false;
           seenPayKeys.add(key);
           return true;
         });

         allPayments = dedupedPayments.map(p => ({
           ...p,
           amount: parseFloat(p.amount) || 0
         }));
         allRatingHistory = extractData(ratingHistory);

        // Build totalPaymentsMap atomically during load (count only 'paid' payments)
        const pMap = {};
        allPayments.forEach(p => {
          if (p.status === 'paid') {
            const sid = String(p.student_id || '').trim().toLowerCase();
            if (sid) pMap[sid] = (pMap[sid] || 0) + 1;
          }
        });
        window.totalPaymentsMap = pMap;

        // Sync to window for modules
        window.allStudents = allStudents;
        window.allCoaches = allCoaches;
        window.allPayments = allPayments;
        window.allMessages = allMessages;
        window.allAttendance = allAttendance;
        window.allRatingHistory = allRatingHistory;

        if ($('sync-text')) $('sync-text').textContent = 'Database Connected';
        if ($('sync-status')) $('sync-status').classList.add('connected');
        console.log(`[Sync] Loaded: ${allStudents.length} students, ${allCoaches.length} coaches, ${allPayments.length} payments`);

        if (allStudents.length === 0 && role !== 'parent') {
          console.warn('[Sync] Warning: No students found in database.');
        }

        dataCache = { coaches: allCoaches, students: allStudents, achievements: achievementsData, events: eventsData, messages: allMessages, timestamp: now };
        syncCoachDropdowns();

        if (role === 'admin' || role === 'master') {
          console.log('[Sync] Rendering active page for role:', role);
          const active = document.querySelector('.page.active')?.id;
          if (active === 'page-dash') renderDash();
          else if (active === 'page-stud') renderStudents();
          else if (active === 'page-coach-mgmt') renderCoachMgmt();
          else if (active === 'page-bills') renderBills();
          else if (active === 'page-msgs') renderMsgs();
          else if (active === 'page-fame') renderFame();
          else if (active === 'page-events') renderEvents();
          else renderDash(); // Default fallback
          
          updateMsgBadge();
          checkMonthlyRollover();
        }
        else if (role === 'parent') { renderChild(); renderEvents(); }

        setLoading('data', false);
        isLoadingData = false;
      } catch (err) {
        console.error('[Sync] Critical Error:', err);
        setLoading('data', false);
        isLoadingData = false;
        toast('Database sync failed. Check connection.', 'error');
      }
    };

    if (forceRefresh) { await executeLoad(); }
    else { loadDebounceTimer = setTimeout(executeLoad, 50); }
  }

  function checkMonthlyRollover() {
    if ($('rollover-notification')) return; // Idempotency check
    const today = new Date();
    const monthKey = `${today.getUTCFullYear()}-${today.getUTCMonth()}`;
    const lastNotified = localStorage.getItem('last_rollover_notified');

    // Only show between 1st and 5th of the month
    if (today.getDate() <= 5 && lastNotified !== monthKey) {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'rollover-notification';
      modal.style.display = 'flex';
      modal.style.zIndex = '9999';
      modal.innerHTML = `
        <div class="modal-box" style="max-width:400px; text-align:center; border:2px solid var(--gold); background:var(--bg2)">
          <h2 style="color:var(--gold); margin-bottom:15px; font-family:var(--font-head)">🆕 New Billing Month!</h2>
          <p style="color:var(--ivory-dim); margin-bottom:25px; font-size:14px">It's a new month. The system has automatically updated student statuses. Would you like to inform all coaches about their student due lists now?</p>
          <div style="display:flex; gap:10px">
            <button class="btn btn-outline" style="flex:1" onclick="this.closest('.modal').remove()">Later</button>
            <button class="btn btn-gold" style="flex:1" onclick="informAllCoaches(); localStorage.setItem('last_rollover_notified', '${monthKey}'); this.closest('.modal').remove()">📢 Inform Coaches</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
  }

  function syncCoachDropdowns() {
    const dropdowns = ['m-coach', 'ev-coach', 'f-coach', 'att-coach-filter'];
    const options = allCoaches.map(c => `<option value="${c.id}">${getCoachName(c)}</option>`).join('');
    
    if ($('f-coach')) $('f-coach').innerHTML = '<option value="">All Coaches</option>' + options;
    if ($('m-coach')) $('m-coach').innerHTML = options;
    if ($('e-coach')) $('e-coach').innerHTML = options;
    if ($('att-coach-filter')) $('att-coach-filter').innerHTML = '<option value="">All Coaches</option>' + options;
    
     if ($('award-student')) $('award-student').innerHTML = '<option value="">Select Student</option>' + allStudents.map(s => `<option value="${s.id}">${escapeHtml(getStudentName(s))}</option>`).join('');
  }



  let notificationPolling = null;
  let lastMsgCount = 0;
  let lastStudCount = 0;
  let lastDueCount = 0;
  let lastSessionCount = 0;
  let supabaseClient = null;

  let rtDebounceTimer = null;
  function initRealtimeNotifications() {
    if (role !== 'admin' && role !== 'master') return;
    if (typeof supabase === 'undefined') {
      console.warn('[Realtime] Supabase library not loaded. Falling back to polling.');
      startNotificationPolling();
      return;
    }

    try {
      if (window.supabaseClient) {
        supabaseClient = window.supabaseClient;
        return;
      }
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      window.supabaseClient = supabaseClient;
      console.log('[Realtime] "Instant Synchronicity" Active.');

      const debouncedRefresh = () => {
        if (window.isEditing) return;
        clearTimeout(rtDebounceTimer);
        rtDebounceTimer = setTimeout(() => {
          loadAllData(true);
        }, 5000); // Optimized 5s sync frequency
      };

      supabaseClient
        .channel('academy-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
          console.log('[Realtime] Payment detected. Syncing...');
          debouncedRefresh(); 
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
          console.log('[Realtime] Student update detected. Syncing...');
          debouncedRefresh();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const msg = payload.new;
          if (msg.receiver_type === 'admin' && shouldShowNotification('msg_' + msg.id)) {
             toast(`📬 New Message from ${msg.sender_name || 'User'}!`, 'info');
             debouncedRefresh();
          }
        })
        .subscribe();
    } catch (e) {
      console.error('[Realtime] Initialization failed:', e);
      startNotificationPolling();
    }
  }

  function setupNotificationCounts() {
    // Call this AFTER data is loaded to set initial counts
    lastMsgCount = allMessages ? allMessages.length : 0;
    lastStudCount = allStudents ? allStudents.length : 0;
    const dueStudents = allStudents ? allStudents.filter(s => getStudentPaymentStatus(s) === 'Due') : [];
    lastDueCount = dueStudents.length;
  }

  function startNotificationPolling() {
    if (notificationPolling) return;

    notificationPolling = setInterval(async () => {
      try {
        // 1. New messages
        const res = await apiCall('/api/messages');
        const msgs = await res.json();
        const newMsgs = msgs.data || msgs || [];
        if (newMsgs.length > lastMsgCount) {
          const newCount = newMsgs.length - lastMsgCount;
          const latest = newMsgs[0];
          if (latest && shouldShowNotification('msg_' + latest.id)) {
            toast(`📬 ${newCount} new message${newCount > 1 ? 's' : ''}!`, 'info');
          }
          lastMsgCount = newMsgs.length;
          allMessages = newMsgs;
          updateNotificationBadge();
        }

        // 2. New student enrolled check
        const studsRes = await apiCall('/api/students');
        const studs = await studsRes.json();
        const rawStuds = studs.data || studs || [];

        const currentRaw = Array.isArray(rawStuds) ? rawStuds : [];
        const seenId = new Set();
        const dedupedStuds = currentRaw.filter(s => {
          if (!s || !s.id) return false;
          if (seenId.has(s.id)) return false;
          seenId.add(s.id);
          return true;
        });

        if (dedupedStuds.length > lastStudCount) {
          if (shouldShowNotification('new_student_' + dedupedStuds.length)) {
            toast('🎓 New student enrolled!', 'success');
          }
          logAudit('students', 'new', null, { count: dedupedStuds.length });
          lastStudCount = dedupedStuds.length;
          loadAllData(true);
        }

        // 3. Failed login from Supabase
        try {
          const auditRes = await apiCall('/api/audit?limit=10');
          const auditData = await auditRes.json();
          const failedLogins = (auditData.data || auditData || []).filter(l => l.action === 'login_failed');
          if (failedLogins.length > 0) {
            const latest = failedLogins[0];
            if (latest && shouldShowNotification('fail_' + (latest.id || latest.timestamp || latest.created_at))) {
              const time = new Date(latest.created_at || latest.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              toast(`🚫 Failed login attempt: ${latest.user_name || 'Unknown'} at ${time}`, 'error');
            }
          }
        } catch (e) {
          // Local fallback
          const localLogs = JSON.parse(localStorage.getItem('audit_logs') || '[]');
          const localFailed = localLogs.filter(l => l.action === 'login_failed');
          if (localFailed.length > 0) {
            const latest = localFailed[localFailed.length - 1];
            if (latest && shouldShowNotification('fail_local_' + latest.timestamp)) {
              const time = new Date(latest.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              toast(`🚫 Failed login: ${latest.user || 'Unknown'} at ${time}`, 'error');
            }
          }
        }

        // 4. Due payments & Notifications (Slot-Based)
        const now = new Date();
        const due = dedupedStuds.filter(s => {
          const status = getStudentPaymentStatus(s);
          return status === 'Due';
        });

        if (due.length > lastDueCount && lastDueCount > 0) {
          const newDue = due.length - lastDueCount;
          toast(`💰 ${newDue} new payment${newDue > 1 ? 's' : ''} now Due!`, 'warning');
        }
        lastDueCount = due.length;

      } catch (e) {
        console.error('Notification polling error:', e);
      }
    }, 15000);
  }



  async function updateMsgBadge() {
    const unread = allMessages.filter(m => !getMessageIsRead(m) && m.receiver_type === 'admin').length;
    const badge = $('msg-badge');
    if (badge) {
      if (unread > 0) { badge.style.display = 'inline'; badge.textContent = unread; }
      else { badge.style.display = 'none'; }
    }
    updateNotificationBadge();
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
    const adminPages = ['dash', 'stud', 'coach-mgmt', 'bills', 'msgs'];
    if (adminPages.includes(p) && role !== 'admin' && role !== 'master') {
      toast('Access denied', 'error');
      setPage(role === 'parent' ? 'child' : 'dash');
      return;
    }

    document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(ni => ni.classList.remove('active'));
    const pageEl = $('page-' + p);
    if (pageEl) pageEl.classList.add('active');
    const navEl = $('nav-' + p);
    if (navEl) navEl.classList.add('active');
    if ($('p-title')) $('p-title').textContent = PAGE_TITLES[p] || '';

    // Mobile auto-close sidebar
    if (window.innerWidth <= 768) {
      const sidebar = $('sidebar');
      const overlay = $('sidebar-overlay');
      if (sidebar) sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
    }

    const btnArea = $('top-btn-area');
    if (btnArea) {
      btnArea.innerHTML = '';
      if (role === 'admin' || role === 'master') {
        if (p === 'dash') {
          const periodValue = `${reportYear}-${String(reportMonth + 1).padStart(2, '0')}`;
          btnArea.innerHTML = `
          <div style="display:flex;gap:6px;align-items:center;background:var(--surface2);padding:3px 8px;border-radius:8px;border:1px solid var(--border);box-shadow:var(--shadow-amber)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <input type="month" id="report-period" class="selector-minimal" onchange="updateReportContext()" value="${periodValue}">
          </div>
          <button class="btn btn-outline" onclick="if(window.generateReportPDF)window.generateReportPDF()">📄 Financial Report</button>
          <button class="btn btn-gold" onclick="exportAcademyData()">📥 Export Academy Data</button>
        `;
        }
        if (p === 'stud') btnArea.innerHTML = `
          <button class="btn btn-outline-grey" onclick="openAttendanceMarking()">🗓️ Batch Attendance</button>
          <button class="btn btn-gold" onclick="openEnroll()">+ New Enrollment</button>
        `;
        if (p === 'events') btnArea.innerHTML = `<button class="btn btn-gold" onclick="openEventModal()">+ Create Event</button>`;
      }
    }

    if (window.innerWidth <= 768) {
      var sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('open');
      var overlay = document.getElementById('sidebar-overlay');
      if (overlay) overlay.classList.remove('active');
    }

    setTimeout(function () {
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
  window.setPage = setPage;

  window.setReportPeriod = function(year, month) {
    window.reportYear = parseInt(year);
    window.reportMonth = parseInt(month);
    const val = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    const dashEl = document.getElementById('report-period');
    const billEl = document.getElementById('f-bill-month');
    
    if (dashEl) dashEl.value = val;
    if (billEl) billEl.value = val;
    
    renderDash();
    renderBills();
  };

  window.updateReportContext = function (valOverride = null) {
    const el = document.getElementById('report-period');
    const billEl = document.getElementById('f-bill-month');
    const val = valOverride || (el ? el.value : (billEl ? billEl.value : null));
    if (!val) return;
    
    const parts = val.split('-');
    if (parts.length < 2) return;
    window.setReportPeriod(parts[0], parseInt(parts[1]) - 1);
  };

  // ═══════════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════
  function toggleEye() {
    const p = $('li-pass');
    const btn = $('eye-btn');
    if (!p || !btn) return;

    if (p.type === 'password') {
      p.type = 'text';
      btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
      btn.setAttribute('aria-label', 'Hide password');
    } else {
      p.type = 'password';
      btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      btn.setAttribute('aria-label', 'Show password');
    }
  }

  // AUTH LOGIC MOVED TO js/auth.js

  function finishLogin(displayName, userRole, studentId) {
    role = userRole;
    recordSession('login');
    logAudit('auth', userRole, 'login_success', null, { user: displayName, role: userRole });
    if (userRole === 'admin' || userRole === 'master') {
      initRealtimeNotifications();
    }
    if (userRole === 'parent') {
      toast(`👤 ${displayName} logged in`, 'info');
    }
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

    // Explicitly show master-only elements if master
    // LOGOUT LOGIC MOVED TO js/auth.js
    if (userRole === 'master') {
      document.querySelectorAll('.master-only').forEach(el => el.style.setProperty('display', 'flex', 'important'));
    }

    // Initialize parent AI module on login
    if (userRole === 'parent') {
      const aiModules = $('ai-modules');
      if (aiModules) aiModules.style.display = 'block';
      setTimeout(() => setAIModule('parent'), 100);
    }

    // Switch page immediately - DEFAULT TO CURRENT MONTH (not previous)
    window.reportMonth = new Date().getUTCMonth();
    window.reportYear = new Date().getUTCFullYear();
    if ($('report-period')) $('report-period').value = `${window.reportYear}-${String(window.reportMonth + 1).padStart(2, '0')}`;
    if ($('report-month-select')) $('report-month-select').value = `${window.reportYear}-${String(window.reportMonth + 1).padStart(2, '0')}`;

    if (userRole === 'parent') setPage('child');
    else setPage('dash');

    // Load data in background - use cache for faster initial load
    dataCache = { timestamp: 0 };
    loadAllData(true).then(() => {
      setupNotificationCounts();
      startNotificationPolling();
      if (userRole === 'parent' && studentId) {
        setCurrentStudent(allStudents.find(s => String(s.id) === String(studentId)));
        if (currentStudent) renderChild();
      }
      resetSessionTimer();
    });
  }

  function recordSession(action) {
    const auth = JSON.parse(localStorage.getItem('chesskidoo_auth') || '{}');
    if (!auth.role) return;

    const sessions = JSON.parse(localStorage.getItem('user_sessions') || '[]');
    const now = new Date().toISOString();
    const sessionId = 'sess_' + Date.now();

    if (action === 'login') {
      const user = auth.user || 'Unknown';
      // Mark all previous sessions for this user as inactive
      sessions.forEach(s => { if (s.user === user) s.active = false; });

      sessions.push({
        id: sessionId,
        user: user,
        role: auth.role,
        studentId: auth.studentId || null,
        loginAt: now,
        logoutAt: null,
        active: true
      });
    } else if (action === 'logout') {
      const currentSession = sessions.find(s => s.active && s.user === auth.user);
      if (currentSession) {
        currentSession.active = false;
        currentSession.logoutAt = now;
      }
    }

    localStorage.setItem('user_sessions', JSON.stringify(sessions.slice(-50)));
  }

  function getActiveSessions() {
    const sessions = JSON.parse(localStorage.getItem('user_sessions') || '[]');
    const now = Date.now();
    const active = sessions.filter(s => s.active && (now - new Date(s.loginAt).getTime() < 3600000 * 2));

    const deduped = [];
    const seenUsers = new Set();
    // Sort by newest first to keep the most recent session
    active.sort((a, b) => new Date(b.loginAt) - new Date(a.loginAt)).forEach(s => {
      if (!seenUsers.has(s.user)) {
        seenUsers.add(s.user);
        deduped.push(s);
      }
    });
    return deduped;
  }

  function getLoginHistory() {
    const sessions = JSON.parse(localStorage.getItem('user_sessions') || '[]');
    return sessions.sort((a, b) => new Date(b.loginAt) - new Date(a.loginAt)).slice(0, 20);
  }

  function logAudit(table, recordId, action, oldValue, newValue) {
    // Save to Supabase database
    const auth = JSON.parse(localStorage.getItem('chesskidoo_auth') || '{}');
    const data = {
      table_name: table,
      record_id: recordId,
      action: action,
      old_value: oldValue,
      new_value: newValue,
      user_name: auth.user || 'system',
      user_role: auth.role || 'system'
    };

    // Save to localStorage as backup
    const auditLogs = JSON.parse(localStorage.getItem('audit_logs') || '[]');
    auditLogs.push({ ...data, timestamp: new Date().toISOString() });
    localStorage.setItem('audit_logs', JSON.stringify(auditLogs.slice(-100)));

    // Try to save to Supabase
    apiCall('/api/audit', {
      method: 'POST',
      body: JSON.stringify(data)
    }).catch(() => { });
  }
  window.logAudit = logAudit;

  function openProfile() {
    openModal('profile-modal');
    renderAccountActivity();
    const adminView = $('prof-admin-view');
    const parentView = $('prof-parent-view');
    if (adminView) adminView.style.display = (role === 'admin' || role === 'master') ? 'block' : 'none';
    if (parentView) parentView.style.display = role === 'parent' ? 'block' : 'none';
  }

  function renderAccountActivity() {
    const activeList = $('active-users-list');
    const adminHistoryList = $('admin-history-list');
    const parentHistoryList = $('parent-history-list');
    const auth = JSON.parse(localStorage.getItem('chesskidoo_auth') || '{}');
    const currentUser = auth.user || 'Unknown';
    const sessions = getLoginHistory();
    const activeSessions = getActiveSessions();

    if (activeList && (role === 'admin' || role === 'master')) {
      if (activeSessions.length === 0) {
        activeList.innerHTML = '<div style="color:var(--ivory-dim);text-align:center;padding:10px">No users online</div>';
      } else {
        const currentUserActive = activeSessions.find(s => s.user === currentUser);
        const others = activeSessions.filter(s => s.user !== currentUser);

        let html = '';
        if (currentUserActive) {
          html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
            <span><span style="color:var(--emerald)">●</span> ${currentUser} <span style="color:var(--gold)">(You)</span></span>
            <span style="color:var(--ivory-dim);font-size:11px">${formatTimeAgo(currentUserActive.loginAt)}</span>
          </div>`;
        }
        others.forEach(s => {
          html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
            <span><span style="color:var(--emerald)">●</span> ${s.user} <span class="badge badge-level" style="font-size:9px;margin-left:4px">${s.role}</span></span>
            <span style="color:var(--ivory-dim);font-size:11px">${formatTimeAgo(s.loginAt)}</span>
          </div>`;
        });
        activeList.innerHTML = html;
      }
    }

    if (adminHistoryList && (role === 'admin' || role === 'master')) {
      // Admin sees all users but filter to last 20 unique sessions
      const seen = new Set();
      const uniqueSessions = sessions.filter(s => {
        const key = s.user + '|' + s.loginAt;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 20); // Show last 20 only

      if (uniqueSessions.length === 0) {
        adminHistoryList.innerHTML = '<div style="color:var(--ivory-dim);text-align:center;padding:10px">No login history</div>';
      } else {
        let html = '';
        uniqueSessions.forEach(s => {
          const loginTime = new Date(s.loginAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
          const status = s.active
            ? '<span style="color:var(--emerald)">● Active</span>'
            : s.logoutAt
              ? '<span style="color:var(--ivory-dim)">Logged out</span>'
              : '<span style="color:var(--danger)">Session ended</span>';
          html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
            <span>${s.user} <span style="color:var(--ivory-dim)">(${s.role})</span></span>
            <span>${loginTime}</span>
          </div>`;
          html += `<div style="text-align:right;padding:2px 0 6px;font-size:10px;color:var(--ivory-dim)">${status}</div>`;
        });
        adminHistoryList.innerHTML = html;
      }
    }

    if (parentHistoryList && role === 'parent') {
      // Parent sees only their own sessions, filter to unique login events
      const mySessions = sessions.filter(s => s.user === currentUser);
      // Get unique login sessions (dedupe by login time)
      const seen = new Set();
      const uniqueLogins = mySessions.filter(s => {
        const key = s.loginAt;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 10); // Show last 10 only

      if (uniqueLogins.length === 0) {
        parentHistoryList.innerHTML = '<div style="color:var(--ivory-dim);text-align:center;padding:10px">No login history</div>';
      } else {
        let html = '';
        uniqueLogins.forEach(s => {
          const loginTime = new Date(s.loginAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
          const status = s.active
            ? '<span style="color:var(--emerald)">Currently Active</span>'
            : '<span style="color:var(--ivory-dim)">Session Ended</span>';
          html += `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span>Login</span>
              <span>${loginTime}</span>
            </div>
            <div style="font-size:11px;color:var(--ivory-dim);margin-top:2px">${status}</div>
          </div>`;
        });
        parentHistoryList.innerHTML = html;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CHARTS & DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  function formatTimeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  function buildCharts(studs) {
    if (chartInstances.childElo) { chartInstances.childElo.destroy(); delete chartInstances.childElo; }
    Object.values(chartInstances).forEach(chart => { if (chart) chart.destroy(); });
    chartInstances = {};
    const isLight = document.body.dataset.theme === 'light';
    Chart.defaults.color = isLight ? '#454545' : '#f0ede4';
    Chart.defaults.borderColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';

    const revenueCtx = $('chartRevenue');
    if (revenueCtx) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const counts = new Array(12).fill(0);
      const currentYear = new Date().getUTCFullYear();
      studs.forEach(s => {
        const d = getStudentDate(s);
        if (d) {
          const date = new Date(d);
          if (date.getUTCFullYear() === currentYear) {
            counts[date.getUTCMonth()]++;
          }
        }
      });
      const endMonth = new Date().getUTCMonth();
      const startMonth = (endMonth - 5 + 12) % 12;
      const labels = [];
      const data = [];
      for (let i = 0; i < 6; i++) {
        const mIdx = (startMonth + i) % 12;
        labels.push(months[mIdx]);
        data.push(counts[mIdx]);
      }
      chartInstances.revenue = new Chart(revenueCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'New Students',
            data,
            borderColor: '#e8a830',
            backgroundColor: 'rgba(232, 168, 48, 0.15)',
            tension: 0.4,
            pointBackgroundColor: '#e8a830',
            fill: true
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } }
        }
      });
    }

    const paymentCtx = $('chartPayment');
    if (paymentCtx) {
      const targetMonth = window.reportMonth;
      const targetYear = window.reportYear;
      const paid = studs.filter(s => getStudentPaymentStatus(s, targetMonth, targetYear) === 'Paid').length;
      const pending = studs.filter(s => getStudentPaymentStatus(s, targetMonth, targetYear) === 'Pending').length;
      const due = studs.filter(s => getStudentPaymentStatus(s, targetMonth, targetYear) === 'Due').length;
      chartInstances.payment = new Chart(paymentCtx, {
        type: 'doughnut',
        data: {
          labels: ['Paid', 'Pending', 'Due'],
          datasets: [{
            data: [paid, pending, due],
            backgroundColor: ['#52c41a', '#e8a830', '#ff4d4f'],
            borderWidth: 0
          }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }

    const sessionCtx = $('chartSession');
    if (sessionCtx) {
      let groupCount = 0, singleCount = 0;
      studs.forEach(s => {
        const type = getStudentBatchType(s);
        if (type === 'Group') groupCount++;
        else singleCount++;
      });
      chartInstances.session = new Chart(sessionCtx, {
        type: 'doughnut',
        data: {
          labels: ['Group', 'Single'],
          datasets: [{
            data: [groupCount, singleCount],
            backgroundColor: ['#c9960c', '#5a9fff'],
            borderWidth: 0
          }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }

    const coachCtx = $('chartCoach');
    if (coachCtx && allCoaches.length) {
      const labels = allCoaches.map(c => getCoachName(c));
      const data = allCoaches.map(c => studs.filter(s => String(s.coach_id) === String(c.id)).length);
      chartInstances.coach = new Chart(coachCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Students assigned',
            data,
            backgroundColor: 'rgba(220, 163, 62, 0.6)',
            borderColor: '#dca33e',
            borderWidth: 1,
            borderRadius: 5
          }]
        },
        options: {
          responsive: true,
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: { x: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { precision: 0 } }, y: { grid: { display: false } } }
        }
      });
    }
  }

  function calculateSlotRevenue(year, month, studentIdMap) {
    if (!allPayments) return 0;
    return allPayments.reduce((sum, p) => {
      const pDate = new Date(p.payment_date || p.created_at);
      if (pDate.getUTCMonth() === month && pDate.getUTCFullYear() === year && p.status === 'paid') {
        const s = allStudents.find(x => String(x.id) === String(p.student_id));
        if (s && (s.status || 'active').toLowerCase() !== 'archived' && getStudentPaymentStatus(s, month, year) === 'Paid') {
          return sum + (parseFloat(p.amount) || 0);
        }
      }
      return sum;
    }, 0);
  }

  function renderDash() {
    // 1. Recalculate Payment Map for freshness
    const pMap = {};
    (allPayments || []).forEach(p => {
      if (p.status === 'paid') {
        const sid = String(p.student_id || '').trim().toLowerCase();
        if (sid) pMap[sid] = (pMap[sid] || 0) + 1;
      }
    });
    window.totalPaymentsMap = pMap;

    // Basic stats
    if ($('s-coaches')) $('s-coaches').textContent = allCoaches.filter(c => c.status !== 'archived').length;

    // --- Today's Attendance Insights (Local Date Aware) ---
    const nowLocal = new Date();
    const todayStr = nowLocal.getFullYear() + '-' + String(nowLocal.getMonth() + 1).padStart(2, '0') + '-' + String(nowLocal.getDate()).padStart(2, '0');
    const todayLogs = allAttendance.filter(a => a.date === todayStr);
    const presentCount = todayLogs.filter(a => a.status === 'present').length;
    const absentCount = todayLogs.filter(a => a.status === 'absent').length;

    // Smart Pending Logic: Only count students scheduled for today
    const studentsScheduledToday = allStudents.filter(isStudentScheduledToday);
    const loggedIds = new Set(todayLogs.map(l => l.student_id));
    const pendingCount = studentsScheduledToday.filter(s => !loggedIds.has(s.id)).length;

    if ($('s-att-present')) $('s-att-present').textContent = presentCount;
    if ($('s-att-absent')) $('s-att-absent').textContent = absentCount;
    const pendingEl = $('s-att-pending');
    if (pendingEl) {
      pendingEl.textContent = pendingCount;
      pendingEl.classList.add('bright');
      pendingEl.style.color = 'var(--gold2)';
    }

    // --- Time-Machine Financial Calculation ---
    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;
    const targetMonthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59));

     // 1. Target Dataset Preparation
     const s_id_map = {};
     (allPayments || []).forEach(p => {
       if (p.status === 'paid') {
         const sid = String(p.student_id || '').trim().toLowerCase();
         if (!sid) return;
         if (!s_id_map[sid]) s_id_map[sid] = 0;
         s_id_map[sid]++;
       }
     });

    const targetStudents = (allStudents || []).filter(s => {
      const sStatus = (s.status || 'active').toLowerCase();
      if (sStatus === 'archived') return false;

     const enrollDateStr = getStudentDate(s);
     const baseline = new Date(Date.UTC(2026, 3, 1, 0, 0, 0)); // April 1st Baseline (UTC)
     const enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
      return enrollDate <= targetMonthEnd;
    });

    // Update target-based summary stats
    if ($('s-total')) $('s-total').textContent = targetStudents.length;
    if ($('s-elo')) $('s-elo').textContent = targetStudents.length ? Math.round(targetStudents.reduce((a, s) => a + (getStudentRating(s) || 0), 0) / targetStudents.length) : 0;

    // 1. Precise Cash-Based Revenue (Only 'paid' transactions IN the target month)
    const paidRevenue = (allPayments || []).reduce((sum, p) => {
      const pDate = new Date(p.payment_date || p.created_at);
      if (pDate.getUTCMonth() === targetMonth && pDate.getUTCFullYear() === targetYear && p.status === 'paid') {
        // Validation: Only count if student is not archived AND their slot-status is 'Paid' for this month
        const s = allStudents.find(x => String(x.id) === String(p.student_id));
        if (s && (s.status || 'active').toLowerCase() !== 'archived' && getStudentPaymentStatus(s, targetMonth, targetYear) === 'Paid') {
           return sum + (parseFloat(p.amount) || 0);
        }
      }
      return sum;
    }, 0);

    let totalArrears = 0;
    let currMonthPending = 0;
    let totalPotential = 0;

    targetStudents.forEach(s => {
      if (s.status === 'archived') return;
      const fee = getStudentMonthlyFee(s) || 0;
      totalPotential += fee;

      const status = getStudentPaymentStatus(s, targetMonth, targetYear);
      
      if (status === 'Due') {
        const enrollDateStr = getStudentDate(s);
        const baseline = new Date(2026, 3, 1);
        const enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
        const effectiveEnroll = enrollDate < baseline ? baseline : enrollDate;
        const monthsRequired = ((targetYear - effectiveEnroll.getUTCFullYear()) * 12) + (targetMonth - effectiveEnroll.getUTCMonth()) + 1;
        const totalCredits = s_id_map[String(s.id).toLowerCase()] || 0;
        
        const monthsBehind = Math.max(0, monthsRequired - totalCredits);
        if (monthsBehind > 1) {
          totalArrears += (fee * (monthsBehind - 1));
        }
        currMonthPending += fee;
      } else if (status === 'Pending') {
        currMonthPending += fee;
      }
    });

    const totalOutstanding = totalArrears + currMonthPending;

    // --- Growth Calculation (MoM Slot-Based) ---
    const prevMonthDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const prevRevenue = calculateSlotRevenue(prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth(), s_id_map);

    const rawRate = totalPotential > 0 ? (paidRevenue / totalPotential) * 100 : 0;
    const collectionRate = Math.min(rawRate, 100).toFixed(1);
    if ($('s-rate')) {
      $('s-rate').textContent = collectionRate + '%';
      if (rawRate > 100) {
        $('s-rate').style.color = 'var(--gold)';
        $('s-rate').title = `Actual collected: ₹${paidRevenue.toLocaleString()} (includes arrears)`;
      } else {
        $('s-rate').style.color = 'var(--blue)';
        $('s-rate').title = '';
      }
    }

    const revenueGrowth = paidRevenue - prevRevenue;
    const growthPercent = prevRevenue > 0
      ? ((revenueGrowth / prevRevenue) * 100).toFixed(1)
      : (paidRevenue > 0 ? '100' : '0');

    // Update UI
    if ($('s-rev')) $('s-rev').textContent = '₹' + paidRevenue.toLocaleString();
    if ($('s-total-revenue')) $('s-total-revenue').textContent = '₹' + totalPotential.toLocaleString();

    const growthEl = $('s-due');
    if (growthEl) {
      if (prevRevenue > 0) {
        growthEl.innerHTML = `₹${revenueGrowth.toLocaleString()} <span style="font-size:0.8em;opacity:0.8">(${revenueGrowth >= 0 ? '+' : ''}${growthPercent}%)</span>`;
        growthEl.style.color = revenueGrowth > 0 ? 'var(--emerald)' : (revenueGrowth < 0 ? 'var(--ruby)' : 'var(--ivory-dim)');
      } else {
        growthEl.innerHTML = `₹${paidRevenue.toLocaleString()} <span style="font-size:0.8em;opacity:0.8">(vs prev: ₹0)</span>`;
        growthEl.style.color = 'var(--ivory-dim)';
      }
    }

    if ($('s-last-due')) $('s-last-due').textContent = '₹' + totalArrears.toLocaleString();
    if ($('s-curr-pending')) $('s-curr-pending').textContent = '₹' + currMonthPending.toLocaleString();
    if ($('s-total-outstanding')) $('s-total-outstanding').textContent = '₹' + totalOutstanding.toLocaleString();

    // Coach expenses & Net Profit
    const totalCoachCost = allCoaches.filter(c => c.status !== 'archived').reduce((a, c) => a + (getCoachSalary(c) || 0), 0);
    if ($('s-total-cost')) $('s-total-cost').textContent = '₹' + totalCoachCost.toLocaleString();
    
    const netProfit = paidRevenue - totalCoachCost;
    if ($('s-profit')) {
      $('s-profit').textContent = '₹' + netProfit.toLocaleString();
      $('s-profit').style.color = netProfit >= 0 ? 'var(--emerald)' : 'var(--ruby)';
    }

    // Session counts
    let groupCount = 0, singleCount = 0, activeEnroll = 0;
    targetStudents.forEach(s => {
      activeEnroll++;
      const type = getStudentBatchType(s);
      if (type === 'Single') singleCount++;
      else groupCount++;
    });
    if ($('s-group')) $('s-group').textContent = groupCount;
    if ($('s-single')) $('s-single').textContent = singleCount;
    if ($('s-active-enroll')) $('s-active-enroll').textContent = activeEnroll;

    // Build charts
    if (typeof Chart !== 'undefined') buildCharts(targetStudents);

    // Render coach financial table
    renderCoachFinance();
  }

  function renderCoachFinance() {
    const tbody = $('coach-finance-body');
    if (!tbody) return;

    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;
    const targetMonthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59));

     // Map total payments per student for ALL TIME (only 'paid' status)
     const totalPaymentsMap = {};
     (allPayments || []).forEach(p => {
       if (p.status === 'paid') {
         const sid = String(p.student_id || '').trim().toLowerCase();
         if (!sid) return;
         if (!totalPaymentsMap[sid]) totalPaymentsMap[sid] = 0;
         totalPaymentsMap[sid]++;
       }
     });

    const coachData = {};
    allCoaches.forEach(c => {
      coachData[c.id] = {
        name: c.name || c.full_name || 'Unknown',
        students: 0,
        revenue: 0,      // Collected credits for this month
        pending: 0,      // Uncollected credits for this month
        projected: 0,    // Total potential fee
        cost: getCoachSalary(c) || 0
      };
    });

    // Aggregate student data using Slot-Based Reconciliation
    const unassignedData = { name: 'Unassigned / Academy', students: 0, revenue: 0, pending: 0, projected: 0, cost: 0 };

    allStudents.forEach(s => {
      const coachId = s.coach_id;
      const targetData = coachData[coachId] || unassignedData;
      
      const enrollDateStr = getStudentDate(s);
      const enrollDate = enrollDateStr ? new Date(enrollDateStr) : null;

      // 1. Enrollment Check for selected month
      if (enrollDate && enrollDate <= targetMonthEnd) {
        const fee = getStudentMonthlyFee(s) || 0;
        targetData.students++;
        targetData.projected += fee;

        // Status-Based Pending Check (for the 'Pending' column)
        const status = getStudentPaymentStatus(s, targetMonth, targetYear);
        if (status !== 'Paid') {
          targetData.pending += fee;
        }
      }
    });

     // 2. Add ACTUAL Revenue from 'paid' Transactions (only for students with 'Paid' slot status)
     (allPayments || []).forEach(p => {
       const pDate = new Date(p.payment_date || p.created_at);
       if (pDate.getUTCMonth() === targetMonth && pDate.getUTCFullYear() === targetYear && p.status === 'paid') {
         const s = allStudents.find(x => String(x.id).toLowerCase() === String(p.student_id).toLowerCase());
         if (s && getStudentPaymentStatus(s, targetMonth, targetYear) === 'Paid') {
           const coachId = s?.coach_id;
           const targetData = coachData[coachId] || unassignedData;
           targetData.revenue += (parseFloat(p.amount) || 0);
         }
       }
     });

    // Merge unassigned data if it has activity
    if (unassignedData.students > 0 || unassignedData.revenue > 0) {
      coachData['unassigned'] = unassignedData;
    }

    // Sort by revenue (descending)
    const sorted = Object.entries(coachData).sort((a, b) => b[1].revenue - a[1].revenue);

    tbody.innerHTML = sorted.map(([id, d]) => {
      const netProfit = d.revenue - d.cost;  // Current cash flow
      const potentialNetProfit = d.projected - d.cost;  // Projected
      const roi = d.cost > 0 ? ((d.revenue / d.cost) * 100).toFixed(1) : 0;
      const potentialRoi = d.cost > 0 ? ((d.projected / d.cost) * 100).toFixed(1) : 0;
      const profitClass = netProfit >= 0 ? 'text-success' : 'text-danger';
      const potentialProfitClass = potentialNetProfit >= 0 ? 'text-success' : 'text-danger';
      return `<tr>
        <td><b>${d.name}</b></td>
        <td>${d.students}</td>
        <td>₹${d.revenue.toLocaleString()}</td>
        <td>₹${d.pending.toLocaleString()}</td>
        <td>₹${d.cost.toLocaleString()}</td>
        <td class="${profitClass}">₹${netProfit.toLocaleString()}</td>
        <td class="${potentialProfitClass}">₹${potentialNetProfit.toLocaleString()}</td>
        <td>${roi}% / <span class="text-gold">${potentialRoi}%</span></td>
        <td><button class="btn btn-gold btn-sm" onclick="informCoachFees('${id}')">📢 Inform</button></td>
      </tr>`;
    }).join('');
  }

  // ═══════════════════════════════════════════════════════════════
  // STUDENTS, COACHES, EVENTS, ACHIEVEMENTS
  // ═══════════════════════════════════════════════════════════════
  function clearFilters() {
    ['f-coach', 'f-session', 'f-status', 'f-min-fee', 'f-max-fee', 'f-search', 'f-bill-month-stud'].forEach(id => { const el = $(id); if (el) el.value = ''; });
    resetStudMonth();
    /* renderStudents(); */
    renderStudents();
  }

  window.syncStudMonth = function(val) {
    if (!val) return;
    const [y, m] = val.split('-');
    window.reportMonth = parseInt(m) - 1;
    window.reportYear = parseInt(y);
    renderStudents();
    toast(`Viewing billing status for ${val}`, 'info');
  };

  window.resetStudMonth = function() {
    const now = new Date();
    window.reportMonth = now.getUTCMonth();
    window.reportYear = now.getUTCFullYear();
    if ($('f-bill-month-stud')) $('f-bill-month-stud').value = '';
    renderStudents();
    toast('Switched to current month view', 'info');
  };

  function renderStudents() {
    const tbody = $('stud-body');
    if (!tbody) return;

    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;
    const targetMonthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59));

    // Pre-calculate payments for this month for the new column
    const paymentsOfMonth = {};
    (allPayments || []).forEach(p => {
      const pDate = new Date(p.payment_date || p.created_at);
      if (pDate.getUTCMonth() === targetMonth && pDate.getUTCFullYear() === targetYear && p.status === 'paid') {
        const sid = String(p.student_id).toLowerCase();
        if (!paymentsOfMonth[sid]) paymentsOfMonth[sid] = { total: 0, count: 0 };
        paymentsOfMonth[sid].total += (parseFloat(p.amount) || 0);
        paymentsOfMonth[sid].count++;
      }
    });

    let studs = (role === 'admin' || role === 'master') ? allStudents : (currentStudent ? [currentStudent] : []);

    // Apply Base Filters (Enrollment Date & Archive Status)
    studs = studs.filter(s => {
      if ((s.status || 'active').toLowerCase() === 'archived') return false;
      const enrollDateStr = getStudentDate(s);
      const enrollDate = enrollDateStr ? new Date(enrollDateStr) : new Date(2026, 3, 1);
      return enrollDate <= targetMonthEnd;
    });

    // Apply UI Filters
    if (role === 'admin' || role === 'master') {
      const fSearch = ($('f-search')?.value || '').toLowerCase().trim();
      const fCoach = $('f-coach')?.value;
      const fSession = $('f-session')?.value;
      const fStatus = $('f-status')?.value;
      const fMin = parseInt($('f-min-fee')?.value) || 0;
      const fMax = parseInt($('f-max-fee')?.value) || 999999;

      studs = studs.filter(s => {
        const nameMatch = !fSearch || getStudentName(s).toLowerCase().includes(fSearch);
        const coachMatch = !fCoach || String(s.coach_id) === String(fCoach);
        const sessionMatch = !fSession || getStudentBatchType(s) === fSession;
        const statusMatch = !fStatus || getStudentPaymentStatus(s, targetMonth, targetYear) === fStatus;
        const fee = getStudentMonthlyFee(s);
        const feeMatch = fee >= fMin && fee <= fMax;
        return nameMatch && coachMatch && sessionMatch && statusMatch && feeMatch;
      });

      studs.sort((a, b) => getStudentName(a).localeCompare(getStudentName(b)));
    }

    if (!studs || studs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" class="text-center">No students found matching filters for this period</td></tr>';
      return;
    }
    
    console.log(`[UI] Rendering ${studs.length} students...`);
    try {
      tbody.innerHTML = studs.map((s, i) => {
        try {
          const status = getStudentPaymentStatus(s, targetMonth, targetYear);
          const session = getStudentBatchType(s);
          const time = s.session_time || s.class_time || s.batch_time || '';
          const coach = allCoaches.find(c => String(c.id) === String(s.coach_id));
          const coachName = coach ? escapeHtml(getCoachName(coach)) : '-';
          const uniqueId = 'more-' + (s.id || 'err').replace(/[^a-zA-Z0-9]/g, '');
          
          const pInfo = paymentsOfMonth[String(s.id).toLowerCase()];
          const paidThisMonthHtml = pInfo 
            ? `<span class="text-success" style="cursor:pointer" onclick="viewPaymentHistory('${s.id}')">₹${pInfo.total.toLocaleString()} (${pInfo.count})</span>` 
            : '<span class="text-muted">₹0</span>';

          return `<tr>
            <td><input type="checkbox" class="stud-check" data-id="${s.id}"></td>
            <td style="color:var(--ivory-dim);font-weight:600">${i + 1}</td>
            <td><div style="font-weight:600">${escapeHtml(getStudentName(s))}</div></td>
            <td>${escapeHtml(getStudentLevel(s))} - ${escapeHtml(getStudentRating(s))} ELO</td>
            <td>${coachName}</td>
            <td>${getStudentDate(s) || '-'}</td>
            <td>${session}</td>
            <td>${time}</td>
            <td>₹${getStudentMonthlyFee(s).toLocaleString()}</td>
            <td><span class="${status === 'Paid' ? 'text-success' : status === 'Pending' ? 'text-warning' : 'text-danger'}">${status}</span></td>
            <td>${paidThisMonthHtml}</td>
            <td>
              <div class="action-menu-container" style="position:relative;display:inline-flex;align-items:center;gap:4px">
                <button class="btn btn-outline-grey btn-sm" onclick="viewStudent('${s.id}')">View</button>
                <button class="btn btn-outline-grey btn-sm" onclick="openEdit('${s.id}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteStudent('${s.id}', '${jsAttrEncode(getStudentName(s))}')">Delete</button>
                <button class="btn btn-outline-grey btn-sm more-btn" onclick="toggleMoreMenu('${uniqueId}')">⋮ More</button>
                <div id="${uniqueId}" class="more-menu" style="display:none;position:absolute;right:0;top:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px;z-index:100;min-width:140px;box-shadow:var(--shadow);margin-top:4px">
                  <button class="btn btn-outline btn-sm" style="width:100%;margin-bottom:4px" onclick="openPay('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${getStudentMonthlyFee(s)}')">💳 Pay Now</button>
                  <button class="btn btn-outline-grey btn-sm" style="width:100%;margin-bottom:4px" onclick="viewPaymentHistory('${s.id}')">⏳ History</button>
                  <button class="btn btn-outline-grey btn-sm" style="width:100%;margin-bottom:4px" onclick="openPromote('${s.id}')">📈 Promote</button>
                  <button class="btn btn-outline btn-sm" style="width:100%;margin-bottom:4px" onclick="sendPaymentReminder('${s.id}')">💬 WhatsApp</button>
                </div>
              </div>
            </td>
          </tr>`;
        } catch (rowErr) {
          console.error(`[UI] Error rendering student row ${i}:`, rowErr, s);
          return `<tr><td colspan="12" style="color:var(--danger)">Error rendering student ${s.name || i}</td></tr>`;
        }
      }).join('');
    } catch (tblErr) {
      console.error('[UI] Critical Table Error:', tblErr);
      tbody.innerHTML = `<tr><td colspan="12" class="text-center text-danger">Table Rendering Error. Check console.</td></tr>`;
    }
  }

    /*
    // Apply Filters
    if (role === 'admin' || role === 'master') {
      const fSearch = ($('f-search')?.value || '').toLowerCase().trim();
      const fCoach = $('f-coach')?.value;
      const fSession = $('f-session')?.value;
      const fStatus = $('f-status')?.value;
      const fMin = parseInt($('f-min-fee')?.value) || 0;
      const fMax = parseInt($('f-max-fee')?.value) || 999999;

      studs = studs.filter(s => {
        const nameMatch = !fSearch || getStudentName(s).toLowerCase().includes(fSearch);
        const coachMatch = !fCoach || String(s.coach_id) === String(fCoach);
        const sessionMatch = !fSession || getStudentBatchType(s) === fSession;
        const statusMatch = !fStatus || getStudentPaymentStatus(s) === fStatus;
        const fee = getStudentMonthlyFee(s);
        const feeMatch = fee >= fMin && fee <= fMax;
        return nameMatch && coachMatch && sessionMatch && statusMatch && feeMatch;
      });

      // Sort alphabetically by name
      studs.sort((a, b) => getStudentName(a).localeCompare(getStudentName(b)));
    }

    if (!studs || studs.length === 0) {
      return;
    }

    tbody.innerHTML = studs.map((s, i) => {
      const status = getStudentPaymentStatus(s);
      const session = getStudentBatchType(s);
      const time = s.session_time || s.class_time || s.batch_time || '';
      const coach = allCoaches.find(c => String(c.id) === String(s.coach_id));
      const coachName = coach ? escapeHtml(getCoachName(coach)) : '-';
      const uniqueId = 'more-' + s.id.replace(/[^a-zA-Z0-9]/g, '');

      return `<tr>
        <td><input type="checkbox" class="stud-check" data-id="${s.id}"></td>
        <td style="color:var(--ivory-dim);font-weight:600">${i + 1}</td>
        <td><div style="font-weight:600">${escapeHtml(getStudentName(s))}</div></td>
        <td>${escapeHtml(getStudentLevel(s))} - ${escapeHtml(getStudentRating(s))} ELO</td>
        <td>${coachName}</td>
        <td>${getStudentDate(s) || '-'}</td>
         <td>${session}</td>
         <td>${time}</td>
         <td>₹${getStudentMonthlyFee(s).toLocaleString()}</td>
         <td><span class="${status === 'Paid' ? 'text-success' : status === 'Pending' ? 'text-warning' : 'text-danger'}">${status}</span></td>
          <td>
           <div class="action-menu-container" style="position:relative;display:inline-flex;align-items:center;gap:4px">
             <button class="btn btn-outline-grey btn-sm" onclick="viewStudent('${s.id}')" title="View">View</button>
             <button class="btn btn-outline-grey btn-sm" onclick="openEdit('${s.id}')" title="Edit">Edit</button>
             <button class="btn btn-danger btn-sm" onclick="deleteStudent('${s.id}', '${jsAttrEncode(getStudentName(s))}')" title="Delete">Delete</button>
             <button class="btn btn-outline-grey btn-sm more-btn" onclick="toggleMoreMenu('${uniqueId}')" title="More Options">⋮ More</button>
             <div id="${uniqueId}" class="more-menu" style="display:none;position:absolute;right:0;top:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px;z-index:100;min-width:140px;box-shadow:var(--shadow);margin-top:4px">
               <button class="btn btn-outline btn-sm" style="width:100%;margin-bottom:4px" onclick="openPay('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${getStudentMonthlyFee(s)}')">💳 Pay Now</button>
               <button class="btn btn-outline-grey btn-sm" style="width:100%;margin-bottom:4px" onclick="viewPaymentHistory('${s.id}')">⏳ History</button>
               <button class="btn btn-outline-grey btn-sm" style="width:100%;margin-bottom:4px" onclick="openPromote('${s.id}')">📈 Promote</button>
               <button class="btn btn-outline btn-sm" style="width:100%;margin-bottom:4px" onclick="sendPaymentReminder('${s.id}')">💬 WhatsApp</button>
             </div>
           </div>
         </td>
       </tr>`;
    }).join('');
  }*/

  window.toggleMoreMenu = function (id) {
    const menu = document.getElementById(id);
    const isShown = menu.style.display === 'block';
    document.querySelectorAll('.more-menu').forEach(m => m.style.display = 'none');
    menu.style.display = isShown ? 'none' : 'block';
  };

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.action-menu-container')) {
      document.querySelectorAll('.more-menu').forEach(m => m.style.display = 'none');
    }
  });

  function viewStudent(id) {
    const s = allStudents.find(x => String(x.id) === String(id));
    if (!s) return;

    if ($('sv-name')) $('sv-name').textContent = getStudentName(s);
    if ($('sv-level')) $('sv-level').textContent = getStudentLevel(s);
    if ($('sv-elo')) $('sv-elo').textContent = getStudentRating(s);
    if ($('sv-join')) $('sv-join').textContent = getStudentDate(s) || '-';

    if ($('sv-coach')) {
      const coach = allCoaches.find(c => String(c.id) === String(s.coach_id));
      $('sv-coach').textContent = coach ? getCoachName(coach) : '-';
    }

    if ($('sv-batch')) {
      const mode = s.session_mode || s.batch_type || 'Group';
      const time = s.session_time || s.batch_time || '';
      $('sv-batch').textContent = time ? `${mode} (${time})` : mode;
    }

    if ($('sv-fee')) $('sv-fee').textContent = '₹' + getStudentMonthlyFee(s).toLocaleString();

    const statusEl = $('sv-status');
    if (statusEl) {
      const status = getStudentPaymentStatus(s);
      statusEl.textContent = status;
      statusEl.className = `badge ${status === 'Paid' ? 'badge-paid' : (status === 'Pending' ? 'text-warning' : 'badge-due')}`;
    }

    if ($('sv-phone')) $('sv-phone').textContent = getStudentPhone(s);
    if ($('sv-av')) $('sv-av').src = makeAvSrc(s);

    openModal('student-view-modal');
  }

  function openEdit(id) {
    const s = allStudents.find(x => String(x.id) === String(id));
    if (!s) return;
    const savedCoachId = s.coach_id || '';
    $('e-id').value = s.id;
    $('e-name').value = getStudentName(s);
    $('e-phone').value = getStudentPhone(s);
    $('e-level').value = getStudentLevel(s);
    $('e-elo').value = getStudentRating(s);
    $('e-fee').value = getStudentMonthlyFee(s);
    if ($('e-enroll-status')) $('e-enroll-status').value = s.status || 'active';
    if ($('e-payment-status')) $('e-payment-status').value = s.payment_status || 'Pending';
    $('e-join').value = getStudentDate(s);
    $('e-batch-type').value = getStudentBatchType(s);
    $('e-batch-time').value = getStudentBatchTime(s);
    if ($('e-due-date')) $('e-due-date').value = s.due_date || '';
    // BUG FIX: Pre-fill notes so updateStudent never silently blanks them
    if ($('e-notes')) $('e-notes').value = getStudentCoachNotes(s);
    syncCoachDropdowns();
    $('e-coach').value = savedCoachId;
    openModal('edit-modal');
  }

  async function updateStudent() {
    const id = $('e-id').value;
    const s = allStudents.find(x => String(x.id) === String(id));
    if (!s) { toast('Student not found', 'error'); return; }
    const oldElo = getStudentRating(s);
    const newElo = parseInt($('e-elo').value);
    const newFee = parseInt($('e-fee').value) || 0;

    // Send fee under every possible field name so whichever Supabase column exists gets updated
    const data = {
      full_name: $('e-name').value,
      name: $('e-name').value,
      phone: $('e-phone').value,
      parent_phone: $('e-phone').value,
      level: $('e-level').value,
      grade: $('e-level').value,
      rating: newElo,
      coach_id: $('e-coach').value,
      status: $('e-enroll-status')?.value || s.status || 'active',
      payment_status: $('e-payment-status')?.value || s.payment_status || 'Pending',
      enrollment_date: $('e-join').value,
      due_date: $('e-due-date')?.value || null,
      session_mode: $('e-batch-type').value,
      batch_type: $('e-batch-type').value,
      session_time: $('e-batch-time').value,
      batch_time: $('e-batch-time').value,
      // Send fee under ALL possible column names
      monthly_fee: newFee,
      fee: newFee,
      fees: newFee,
      tuition_fee: newFee,
      notes: $('e-notes')?.value || s.notes || ''
    };

    try {
      const res = await apiCall(`/api/students?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
      if (res.ok) {
        // AUTOMATION: Create transaction record if status was manually changed to 'Paid'
        const newStatus = $('e-payment-status')?.value || s.payment_status || 'Pending';
        if (s.payment_status !== 'Paid' && newStatus === 'Paid') {
          try {
            await apiCall('/api/payments', {
              method: 'POST',
              body: JSON.stringify({
                id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9), // Required Primary Key
                student_id: id,
                amount: parseFloat(newFee), // Ensure numeric
                status: 'paid',
                payment_method: 'Manual Override',
                description: 'Status updated to Paid via Profile',
                transaction_id: 'PRF-' + Math.floor(Math.random() * 1000000),
                payment_date: new Date().toISOString()
              })
            });
          } catch (pe) { console.warn('Payment logging failed during profile update:', pe); }
        }

        // Log rating history if changed
        if (newElo !== oldElo) {
          try {
            await apiCall('/api/rating_history', {
              method: 'POST',
              body: JSON.stringify({ student_id: id, rating: newElo, change_type: 'manual', notes: 'Manual adjustment' })
            });
          } catch (e) { console.warn('Rating history table missing, skipping log.'); }
        }

        // OPTIMISTIC UPDATE: immediately patch the in-memory record so the UI
        // shows the new values without waiting for the next loadAllData fetch.
        // This prevents stale data from showing if Supabase is slow or if
        // the column name doesn't match what loadAllData returns.
        const idx = allStudents.findIndex(x => String(x.id) === String(id));
        if (idx !== -1) {
          allStudents[idx] = {
            ...allStudents[idx],
            full_name: data.full_name,
            name: data.name,
            phone: data.phone,
            parent_phone: data.parent_phone,
            level: data.level,
            grade: data.grade,
            rating: data.rating,
            coach_id: data.coach_id,
            status: data.status,
            enrollment_date: data.enrollment_date,
            due_date: data.due_date,
            session_mode: data.session_mode,
            batch_type: data.batch_type,
            session_time: data.session_time,
            batch_time: data.batch_time,
            monthly_fee: newFee,
            fee: newFee,
            fees: newFee,
            tuition_fee: newFee,
            notes: data.notes
          };
        }

        // FIX C2: If this student is the currently logged-in parent's child, refresh currentStudent
        if (currentStudent && String(currentStudent.id) === String(id)) {
          setCurrentStudent(allStudents[idx]);
        }

        toast('Student updated!', 'success');
        closeModals();
        
        // SYNC: Ensure fresh data is fetched from DB first
        await loadAllData(true);
        
        // Re-render everything with confirmed data
        renderStudents();
        renderDash();
        renderBills();
      } else {
        const err = await res.json().catch(() => ({}));
        toast('Update failed: ' + (err.error || err.message || `Server error ${res.status}`), 'error');
      }
    } catch (e) {
      console.error('updateStudent error:', e);
      toast('Update failed: ' + e.message, 'error');
    }
  }
  function openEnroll() {
    $('m-name').value = '';
    $('m-phone').value = '';
    $('m-level').value = 'Beginner';
    $('m-join').value = '';
    $('m-elo').value = '800';
    $('m-fee').value = '5000';
    $('m-batch-type').value = 'Evening';
    $('m-batch-time').value = '17:00';
    if ($('m-due-date')) $('m-due-date').value = '';
    if ($('m-coach')) $('m-coach').value = '';
    syncCoachDropdowns();
    openModal('enroll-modal');
  }

  async function saveStudent() {
    const data = {
      full_name: $('m-name').value.trim(),
      phone: $('m-phone').value.trim(),
      parent_phone: $('m-phone').value.trim(),
      level: $('m-level').value,
      rating: parseInt($('m-elo').value) || 0,
      coach_id: $('m-coach').value,
      enrollment_date: $('m-join').value || new Date().toISOString().split('T')[0],
      due_date: $('m-due-date')?.value || null,
      batch_type: $('m-batch-type').value,
      batch_time: $('m-batch-time').value,
      monthly_fee: parseInt($('m-fee').value) || 0,
      payment_status: 'Due',
      status: 'active',
      notes: ''
    };

    if (!data.due_date) {
      const nextMonth = new Date();
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 5);
      data.due_date = nextMonth.toISOString().split('T')[0];
    }

    if (!data.full_name) { toast('Student name is required', 'error'); return; }
    if (!data.phone) { toast('Parent phone is required', 'error'); return; }
    const phoneDigits = data.phone.replace(/\D/g, '');
    if (!/^\d{10}$/.test(phoneDigits)) { toast('Phone number must be exactly 10 digits', 'error'); return; }

    try {
      const res = await apiCall('/api/students', { method: 'POST', body: JSON.stringify(data) });
      if (res.ok) {
        logAudit('students', 'new', 'create', null, data);
        toast('Student enrolled successfully!', 'success');
        closeModals();
        loadAllData(true);
      }
    } catch (e) { toast('Failed to enroll student', 'error'); }
  }

  async function deleteStudent(id, name) {
    $('delete-item-type').textContent = 'Student';
    $('delete-item-name').textContent = name;
    $('delete-item-id').value = id;
    $('delete-type').value = 'student';
    openModal('delete-confirm-modal');
  }

  function renderCoachMgmt() {
    const grid = $('coach-mgmt-body');
    if (!grid) return;

    if (!allCoaches || allCoaches.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><span class="empty-icon">👨‍🏫</span><p>No coaches found in the academy</p></div>';
      return;
    }

    grid.innerHTML = allCoaches.map(c => {
      const studs = allStudents.filter(s => String(s.coach_id) === String(c.id));
      const studentCount = studs.length;
      const avgRating = studs.length ? Math.round(studs.reduce((a, s) => a + (getStudentRating(s) || 0), 0) / studs.length) : 800;
      const photo = c.photo_url || c.photo || c.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(getCoachName(c))}&background=dca33e&color=000000&bold=true&size=120`;

       return `
         <div class="coach-card">
           <div class="coach-card-header">
             <img src="${photo}" class="coach-card-av" alt="${escapeHtml(getCoachName(c))}">
             <div>
               <div class="coach-card-title">${escapeHtml(getCoachName(c))}</div>
               <div class="coach-card-subtitle">${escapeHtml(getCoachSpecialty(c) || 'Chess Coach')}</div>
             </div>
           </div>
           <div class="coach-card-stats">
             <div class="coach-stat">
               <span class="coach-stat-label">Students</span>
               <span class="coach-stat-val">${studentCount}</span>
             </div>
             <div class="coach-stat">
               <span class="coach-stat-label">Avg ELO</span>
               <span class="coach-stat-val">${avgRating}</span>
             </div>
             <div class="coach-stat">
               <span class="coach-stat-label">Salary</span>
               <span class="coach-stat-val">₹${(getCoachSalary(c) || 0).toLocaleString()}</span>
             </div>
             <div class="coach-stat">
               <span class="coach-stat-label">Status</span>
               <span class="coach-stat-val ${getCoachStatus(c) === 'active' ? 'text-success' : 'text-danger'}">${getCoachStatus(c) === 'active' ? 'Active' : 'Inactive'}</span>
             </div>
           </div>
           <div class="coach-card-actions" style="grid-template-columns: 1fr 1fr; gap: 8px;">
             <button class="btn btn-outline-grey btn-sm" onclick="viewCoach('${c.id}')" title="View Profile">👁️ View</button>
             <button class="btn btn-outline-grey btn-sm" onclick="openCoachModal('${c.id}')" title="Edit Coach">✏️ Edit</button>
             <button class="btn btn-gold btn-sm" onclick="informCoachFees('${c.id}')" title="Inform Fees">📢 Inform</button>
             <button class="btn btn-outline-grey btn-sm" onclick="confirmDeleteCoach('${c.id}', '${escapeHtml(getCoachName(c)).replace(/'/g, "\\'")}')" title="Delete Coach">Delete</button>
           </div>
           <button class="btn btn-outline btn-sm" style="width:100%;margin-top:12px" onclick="viewCoachSchedule('${c.id}')">📅 View Schedule</button>
         </div>
       `;
    }).join('');
  }

  window.viewCoach = function (id) {
    const c = allCoaches.find(x => String(x.id) === String(id));
    if (!c) return;

    const studs = allStudents.filter(s => String(s.coach_id) === String(c.id));
    const avgRating = studs.length ? Math.round(studs.reduce((a, s) => a + (getStudentRating(s) || 0), 0) / studs.length) : 800;

    $('cv-name').innerText = getCoachName(c);
    $('cv-spec').innerText = getCoachSpecialty(c) || 'General Coach';
    $('cv-phone').innerText = c.phone || 'N/A';
    $('cv-email').innerText = c.email || 'N/A';
    $('cv-salary').innerText = (getCoachSalary(c) || 0).toLocaleString();
    $('cv-status').innerText = capitalizeFirst(getCoachStatus(c));
    $('cv-address').innerText = c.address || 'No address provided';
    $('cv-avail').innerText = c.availability || 'N/A';
    $('cv-bio').innerText = c.bio || c.additional_details || 'No biography available.';
    $('cv-stud-count').innerText = studs.length;
    $('cv-avg-elo').innerText = avgRating;
    $('cv-exp').innerText = (c.experience || 0) + 'y';
    $('cv-av').src = c.photo_url || c.photo || c.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(getCoachName(c))}&background=dca33e&color=000000&bold=true&size=200`;

    $('cv-edit-btn').onclick = () => { closeModals(); openCoachModal(id); };
    openModal('coach-view-modal');
  };

  function viewCoachSchedule(id) {
    const c = allCoaches.find(x => String(x.id) === String(id));
    if (c) $('sched-coach-name').innerText = getCoachName(c);

    const assignedStudents = allStudents.filter(s => String(s.coach_id) === String(id));
    const container = $('schedule-container');

    if (!container) { openModal('coach-schedule-modal'); return; }

    if (assignedStudents.length === 0) {
      container.innerHTML = '<div class="empty-state"><span class="empty-icon">📅</span><p>No students assigned to this coach</p></div>';
    } else {
      // Group by Day
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      let scheduleHtml = `<div class="schedule-grid-premium">`;

       days.forEach(day => {
         const daySlots = assignedStudents.filter(s => s.batch_day === day || s.session_day === day);
         if (daySlots.length > 0) {
           scheduleHtml += `
             <div class="schedule-day-column">
               <div class="schedule-day-header">${day}</div>
               ${daySlots.sort((a, b) => (a.batch_time || '').localeCompare(b.batch_time || '')).map(s => `
                 <div class="schedule-slot-card">
                   <div class="slot-time">${s.batch_time ? formatTime(s.batch_time) : 'TBD'}</div>
                   <div class="slot-stud">${escapeHtml(getStudentName(s))}</div>
                   <div class="slot-lvl">${escapeHtml(getStudentLevel(s))}</div>
                 </div>
               `).join('')}
             </div>
           `;
         }
       });

       // Handle Unscheduled (TBD)
       const unscheduled = assignedStudents.filter(s => !s.batch_day && !s.session_day);
       if (unscheduled.length > 0) {
         scheduleHtml += `
           <div class="schedule-day-column tbd">
             <div class="schedule-day-header">Unscheduled / TBD</div>
             ${unscheduled.map(s => `
               <div class="schedule-slot-card">
                 <div class="slot-time">TBD</div>
                 <div class="slot-stud">${escapeHtml(getStudentName(s))}</div>
                 <div class="slot-lvl">${escapeHtml(getStudentLevel(s))}</div>
               </div>
             `).join('')}
           </div>
         `;
       }

      scheduleHtml += `</div>`;
      container.innerHTML = scheduleHtml;
    }
    openModal('coach-schedule-modal');
  }

  function openCoachModal(id = null) {
    if (id) {
      const c = allCoaches.find(x => String(x.id) === String(id));
      if (!c) return;
      $('coach-modal-title').innerText = 'Edit Coach';
      $('cm-id').value = c.id;
      $('cm-name').value = getCoachName(c);
      $('cm-spec').value = getCoachSpecialty(c);
      $('cm-phone').value = c.phone || '';
      $('cm-email').value = c.email || '';
      $('cm-address').value = c.address || '';
      $('cm-photo').value = (c.photo_url || c.photo || '');
      $('cm-salary').value = getCoachSalary(c);
      $('cm-exp').value = c.experience || 0;
      $('cm-status').value = getCoachStatus(c) || 'active';
      $('cm-avail').value = c.availability || '';
      $('cm-etc').value = c.bio || c.additional_details || '';
    } else {
      $('coach-modal-title').innerText = 'Add Coach';
      $('cm-id').value = '';
      $('cm-name').value = '';
      $('cm-spec').value = '';
      $('cm-phone').value = '';
      $('cm-email').value = '';
      $('cm-address').value = '';
      $('cm-photo').value = '';
      $('cm-salary').value = '0';
      $('cm-exp').value = '0';
      $('cm-status').value = 'active';
      $('cm-avail').value = '';
      $('cm-etc').value = '';
    }
    openModal('coach-crud-modal');
  }

  async function saveCoach() {
    const id = $('cm-id').value;
    const salaryVal = parseInt($('cm-salary').value) || 0;
    const data = {
      name: $('cm-name').value.trim(),
      specialization: $('cm-spec').value.trim(),
      phone: $('cm-phone').value.trim(),
      email: $('cm-email').value.trim(),
      address: $('cm-address').value.trim(),
      // BUG FIX: send both field names so getCoachSalary (reads salary||hourly_rate) always picks it up
      salary: salaryVal,
      hourly_rate: salaryVal,
      experience: parseInt($('cm-exp').value) || 0,
      status: $('cm-status').value,
      availability: $('cm-avail').value.trim(),
      bio: $('cm-etc').value.trim(),
      additional_details: $('cm-etc').value.trim(),
      photo_url: $('cm-photo').value.trim()
    };

    if (!data.name) { toast('Coach name is required', 'error'); return; }

    try {
      let res;
      if (id) {
        res = await apiCall(`/api/coaches?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
        if (res.ok) {
          toast('Coach updated successfully!', 'success');
          closeModals();
          loadAllData(true);
        } else {
          const err = await res.json().catch(() => ({}));
          toast('Update failed: ' + (err.error || 'Server error'), 'error');
        }
      } else {
        res = await apiCall('/api/coaches', { method: 'POST', body: JSON.stringify(data) });
        if (res.ok) {
          toast('Coach added successfully!', 'success');
          closeModals();
          loadAllData(true);
        } else {
          const err = await res.json().catch(() => ({}));
          toast('Failed to add coach: ' + (err.error || 'Server error'), 'error');
        }
      }
    } catch (e) {
      console.error('Save coach error:', e);
      toast('Technical error: ' + e.message, 'error');
    }
  }

  window.confirmDeleteCoach = function (id, name) {
    $('delete-item-type').textContent = 'Coach';
    $('delete-item-name').textContent = name;
    $('delete-item-id').value = id;
    $('delete-type').value = 'coach';
    openModal('delete-confirm-modal');
  };

  async function deleteCoach(id) {
    try {
      const res = await apiCall(`/api/coaches?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast('Coach deleted from academy', 'success');
        loadAllData(true);
      }
    } catch (e) {
      toast('Delete failed', 'error');
    }
  }

  function renderEvents() {
    const gridEl = $('ev-grid');
    const loadingEl = $('ev-loading');
    if (!gridEl) return;

    if (loadingEl) loadingEl.style.display = 'none';

    // Filter out archived/deleted events for parents, show all for admin
    const visibleEvents = eventsData.filter(e => {
      if (role === 'admin' || role === 'master') return true;
      return e.status !== 'archived' && e.archived !== true;
    });

    if (!visibleEvents || visibleEvents.length === 0) {
      gridEl.style.display = 'grid';
      gridEl.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">📅</span><p>No events scheduled</p></div>';
      return;
    }

    const isAdmin = role === 'admin' || role === 'master';

     gridEl.style.display = 'grid';
     gridEl.innerHTML = visibleEvents.map(e => {
       const maxSpots = e.max_participants || 50;
       const regCount = e.registrations_count || (e.registered_students?.length || 0);
       const spotsLeft = maxSpots - regCount;
       const isArchived = e.archived === true || e.status === 'archived';
       return `<div class="ev-card" ${isArchived ? 'style="opacity:0.7"' : ''}>
         ${e.img_url ? `<img src="${e.img_url}" class="ev-poster" alt="Event Poster">` : ''}
         <div class="ev-header">
           <span class="ev-type-badge">${escapeHtml(getEventType(e))}</span>
           <span class="ev-date-badge">${e.date ? new Date(e.date).toLocaleDateString() : ''}</span>
           ${isArchived ? '<span class="badge" style="background:var(--ivory3);color:var(--obsidian)">Archived</span>' : ''}
         </div>
         <div class="ev-body">
           <div class="ev-title">${escapeHtml(e.title)}</div>
           <div class="ev-meta">
             <span class="ev-meta-item ev-time">${escapeHtml(getEventTime(e))}</span>
             <span class="ev-meta-item ev-loc">${escapeHtml(e.location || 'TBD')}</span>
             ${e.prize_pool ? `<span class="ev-meta-item ev-prize">${escapeHtml(e.prize_pool)}</span>` : ''}
           </div>
           ${e.map_url ? `<a href="${e.map_url}" target="_blank" class="ev-map-link">📍 View on Map</a>` : ''}
           ${e.description ? `<div class="ev-desc">${escapeHtml(e.description)}</div>` : ''}
         </div>
         <div class="ev-progress-wrap">
           <div class="ev-progress-label">
             <span>Registrations</span>
             <span>${regCount}/${maxSpots}</span>
           </div>
           <div class="ev-progress-track">
             <div class="ev-progress-bar" style="width:${(regCount / maxSpots) * 100}%"></div>
           </div>
         </div>
         <div class="ev-footer">
           <div class="ev-spots"><strong>${spotsLeft}</strong> spots left</div>
           ${role === 'parent' ? (e.registered_students?.includes(currentStudent?.id) ? '<span class="badge badge-success">✓ Registered</span>' : `<button class="btn-register" onclick="registerForEvent('${e.id}')">Register</button>`) : ''}
           ${isAdmin ? `
             <div style="display:flex;gap:8px;margin-left:auto">
               <button class="btn btn-outline-grey btn-sm" onclick="editEvent('${e.id}')">Edit</button>
               <button class="btn btn-outline btn-sm" onclick="archiveEvent('${e.id}')">${isArchived ? 'Unarchive' : 'Archive'}</button>
               <button class="btn btn-danger btn-sm" onclick="confirmDeleteEvent('${e.id}', '${escapeHtml(e.title).replace(/'/g, "\\'")}')">Delete</button>
             </div>
           ` : ''}
         </div>
       </div>`;
     }).join('');
  }

  function openEventModal() {
    $('ev-id').value = '';
    $('ev-title').value = '';
    $('ev-date').value = '';
    $('ev-time').value = '10:00';
    $('ev-type').value = 'Tournament';
    $('ev-max').value = '50';
    $('ev-prize').value = '';
    $('ev-loc').value = '';
    $('ev-desc').value = '';
    $('ev-img-url').value = '';
    $('ev-map-url').value = '';
    $('ev-img-preview').style.display = 'none';
    $('ev-img-file').value = '';
    $('ev-modal-title').textContent = 'Create Event';
    openModal('ev-modal');
  }

  function editEvent(id) {
    const e = eventsData.find(x => String(x.id) === String(id));
    if (!e) { toast('Event not found', 'error'); return; }
    $('ev-id').value = e.id;
    $('ev-title').value = e.title || '';
    $('ev-date').value = e.date || '';
    $('ev-time').value = e.time || '10:00';
    $('ev-type').value = e.type || 'Tournament';
    $('ev-max').value = e.max_participants || 0;
    $('ev-prize').value = e.prize_pool || '';
    $('ev-loc').value = e.location || '';
    $('ev-desc').value = e.description || '';
    $('ev-img-url').value = e.img_url || '';
    $('ev-map-url').value = e.map_url || '';
    if (e.img_url) {
      $('ev-img-preview').src = e.img_url;
      $('ev-img-preview').style.display = 'block';
    } else {
      $('ev-img-preview').style.display = 'none';
    }
    $('ev-modal-title').textContent = 'Edit Event';
    openModal('ev-modal');
  }

  function archiveEvent(id) {
    const e = eventsData.find(x => String(x.id) === String(id));
    if (!e) { toast('Event not found', 'error'); return; }
    const newStatus = (e.archived || e.status === 'archived') ? 'active' : 'archived';
    logAudit('events', id, 'archived', e.archived, newStatus);
    apiCall(`/api/events?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ archived: newStatus === 'archived', status: newStatus })
    }).then(() => {
      toast(`Event ${newStatus === 'archived' ? 'archived' : 'unarchived'}!`, 'success');
      loadAllData(true);
    }).catch(() => toast('Failed to update', 'error'));
  }

  function deleteEvent(id, title) {
    $('delete-item-type').textContent = 'Event';
    $('delete-item-name').textContent = title;
    $('delete-item-id').value = id;
    $('delete-type').value = 'event';
    openModal('delete-confirm-modal');
  }
  const confirmDeleteEvent = deleteEvent;

  function generateClientId() {
    return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'c' + Date.now() + Math.random().toString(36).substr(2, 9);
  }

  async function saveEvent() {
    const id = $('ev-id').value;
    const fileInput = $('ev-img-file');
    const urlInput = $('ev-img-url');
    let img_url = urlInput ? urlInput.value : '';

    if (fileInput && fileInput.files && fileInput.files[0]) {
      toast('Uploading event poster...', 'info');
      const uploaded = await uploadToImgbb(fileInput.files[0]);
      if (uploaded) img_url = uploaded;
    }

    const data = {
      id: id || generateClientId(),
      title: $('ev-title').value,
      event_date: $('ev-date').value,
      event_time: $('ev-time').value,
      type: $('ev-type').value,
      max_participants: parseInt($('ev-max').value) || 0,
      prize_pool: $('ev-prize').value,
      location: $('ev-loc').value,
      map_url: $('ev-map-url').value,
      description: $('ev-desc').value,
      img_url: img_url
    };

    if (!data.title) { toast('Event title is required', 'error'); return; }
    if (!data.event_date) { toast('Event date is required', 'error'); return; }
    if (data.event_date && new Date(data.event_date) < new Date()) { toast('Event date cannot be in the past', 'error'); return; }

    try {
      let res;
      if (id) {
        const existing = eventsData.find(x => String(x.id) === String(id));
        logAudit('events', id, 'update', existing, data);
        res = await apiCall(`/api/events?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        res = await apiCall('/api/events', { method: 'POST', body: JSON.stringify(data) });
      }

      if (res.ok) {
        toast(id ? 'Event updated!' : 'Event created!', 'success');
        closeModals();
        loadAllData(true);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Event save error:', err);
        toast('Failed to save event: ' + (err.error || 'Server error'), 'error');
      }
    } catch (e) {
      console.error('Save event error:', e);
      toast('Technical error: ' + e.message, 'error');
    }
  }

  function renderFame() {
    const gridEl = $('fame-grid');
    const loadingEl = $('fame-loading');
    if (!gridEl) return;

    if (loadingEl) loadingEl.style.display = 'none';
    gridEl.style.display = 'grid';

    if (!achievementsData || achievementsData.length === 0) {
      gridEl.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">🏆</span><p>No achievements recorded yet</p></div>';
      return;
    }

    const isAdmin = role === 'admin' || role === 'master';
     gridEl.innerHTML = achievementsData.sort((a, b) => new Date(b.date_achieved || b.created_at) - new Date(a.date_achieved || a.created_at)).map(a => {
       const student = allStudents.find(s => String(s.id) === String(a.student_id));
       const studentName = student ? getStudentName(student) : 'Unknown Student';
       return `
         <div class="ach-card">
           ${a.img_url ? `<img src="${a.img_url}" class="ach-img" alt="Achievement">` : '<div class="ach-img-placeholder">🏆</div>'}
           <div class="ach-body">
             <div class="ach-title">${escapeHtml(a.title)}</div>
             <div class="ach-student">${escapeHtml(studentName)}</div>
             <div class="ach-date">${a.date_achieved ? new Date(a.date_achieved).toLocaleDateString() : ''}</div>
           </div>
           ${isAdmin ? `
             <div class="ach-actions">
               <button class="btn btn-outline-grey btn-sm" onclick="editAchievement('${a.id}')">Edit</button>
               <button class="btn btn-danger btn-sm" onclick="confirmDeleteAchievement('${a.id}', '${escapeHtml(a.title).replace(/'/g, "\\'")}')">Delete</button>
             </div>
           ` : ''}
         </div>
       `;
     }).join('');
  }

  function editAchievement(id) {
    const a = achievementsData.find(x => String(x.id) === String(id));
    if (!a) { toast('Achievement not found', 'error'); return; }
    $('award-sid').value = a.id;
    $('award-student').value = a.student_id || '';
    $('award-title').value = a.title || '';
    $('award-img-url').value = a.img_url || '';
    openModal('award-modal');
  }

  function confirmDeleteAchievement(id, title) {
    $('delete-item-type').textContent = 'Achievement';
    $('delete-item-name').textContent = title;
    $('delete-item-id').value = id;
    $('delete-type').value = 'achievement';
    openModal('delete-confirm-modal');
  }

  async function deleteAchievement(id) {
    try {
      const res = await apiCall(`/api/achievements?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast('Achievement deleted!', 'success');
        loadAllData(true);
      }
    } catch (e) { toast('Delete failed', 'error'); }
  }

  function openAwardModal() {
    $('award-sid').value = '';
    $('award-student').value = '';
    $('award-title').value = '';
    $('award-img-url').value = '';
    openModal('award-modal');
  }

  function onAwardStudentChange() {
    const sid = $('award-student').value;
    const s = allStudents.find(x => String(x.id) === String(sid));
    if (s) {
      console.log('Student selected for award:', s.full_name);
    }
  }

  async function uploadToImgbb(file) {
    if (!file) return null;
    try {
      // 1. Convert file to Base64 for the proxy
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
      });

      // 2. Call our secure proxy
      const response = await apiCall('/api/upload', {
        method: 'POST',
        body: JSON.stringify({ image: base64 })
      });
      const data = await response.json();
      if (data.success) return data.data.url;
      throw new Error('Upload failed');
    } catch (e) {
      console.error('Imgbb upload error:', e);
      return null;
    }
  }

  async function saveAward() {
    const id = $('award-sid').value;
    const fileInput = $('award-img-file');
    const urlInput = $('award-img-url');
    let img_url = urlInput ? urlInput.value : '';

    if (fileInput && fileInput.files && fileInput.files[0]) {
      toast('Uploading image...', 'info');
      const uploadedUrl = await uploadToImgbb(fileInput.files[0]);
      if (uploadedUrl) img_url = uploadedUrl;
      else { toast('Upload failed', 'error'); return; }
    }

    const data = {
      student_id: $('award-student').value,
      title: $('award-title').value,
      img_url: img_url,
      date_achieved: new Date().toISOString().split('T')[0]
    };

    if (!data.student_id || !data.title) { toast('Please fill all fields', 'error'); return; }

    try {
      let res;
      if (id && id.length > 20) { // Existing UUID
        res = await apiCall(`/api/achievements?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        res = await apiCall('/api/achievements', { method: 'POST', body: JSON.stringify(data) });
      }
      if (res.ok) {
        toast('Achievement saved!', 'success');
        closeModals();
        loadAllData(true);
      }
    } catch (e) { toast('Error saving achievement', 'error'); }
  }

  window.markPaid = async function (id, amount, method = 'Cash', desc = 'Monthly Tuition Fee') {
    try {
      const s = allStudents.find(x => String(x.id) === String(id));
      const amt = amount || (s ? getStudentMonthlyFee(s) : 0);

      // 1. Update Student Status & Roll Due Date
      const updates = { payment_status: 'Paid' };
      if (s && s.due_date) {
        const nextDate = new Date(s.due_date);
        nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
        updates.due_date = nextDate.toISOString().split('T')[0];
      }

      await apiCall(`${API_BASE}/students?id=${id}`, { method: 'PUT', body: JSON.stringify(updates) });

      // 2. Create Transaction Record (Increments Credit Count)
      await apiCall(`${API_BASE}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9), // Required Primary Key
          student_id: id,
          amount: parseFloat(amt), // Ensure numeric
          status: 'paid',
          payment_method: method,
          description: desc,
          transaction_id: 'MAN-' + Math.floor(Math.random() * 1000000),
          payment_date: new Date().toISOString()
        })
      });

       toast('Payment logged and due date advanced!', 'success');
      
      // FIX #3: Invalidate payment cache before reload
      window.totalPaymentsMap = null;
      
      // SYNC: Force fresh data fetch and re-render dashboard
      await loadAllData(true);
      renderDash();
      renderBills();

      // 3. Auto-Notify Parent with Receipt Link
      const coach = allCoaches.find(c => String(c.id) === String(s.coach_id));
      const coachName = coach ? getCoachName(coach) : 'N/A';
      const receiptUrl = `${window.location.origin}/receipt.html?id=${id}&name=${encodeURIComponent(getStudentName(s))}&amount=${amt}&date=${new Date().toISOString()}&level=${encodeURIComponent(getStudentLevel(s))}&coach=${encodeURIComponent(coachName)}`;

      const message = `✅ Hello Sir/Madam,

This is to inform you about the chess class fee payment you have completed for ${cleanText(getStudentName(s))} (INR ${amt.toLocaleString()}).

Here is your receipt link for download:
${receiptUrl}

Thank you for your continued support and cooperation.
- Chesskidoo Academy`;

      const parentPhone = getStudentPhone(s).replace(/\D/g, '');
      if (parentPhone && parentPhone.length >= 10) {
        window.open(`https://wa.me/91${parentPhone}?text=${encodeURIComponent(message)}`, '_blank');
      }
    } catch (e) { toast('Failed to process payment', 'error'); }
  };

  window.markUnpaid = async function (id) {
    if (!confirm('Revert status to Due? This will NOT delete the transaction record. You must delete the payment from History to reduce credits.')) return;
    try {
      await apiCall(`${API_BASE}/students?id=${id}`, { method: 'PUT', body: JSON.stringify({ payment_status: 'Due' }) });
      toast('Status reverted to Due', 'info');
      await loadAllData(true);
      renderDash();
      renderBills();
    } catch (e) { toast('Error reverting status', 'error'); }
  };

  window.viewPaymentHistory = async function (studentId) {
    const s = allStudents.find(x => String(x.id) === String(studentId));
    if (!s) return;

    const nameEl = $('p-history-name');
    if (nameEl) nameEl.textContent = getStudentName(s);
    const metaEl = $('p-history-meta');
    if (metaEl) metaEl.textContent = `ID: ${String(s.id).slice(0, 8)} • Monthly Fee: ₹${getStudentMonthlyFee(s).toLocaleString()}`;

    openModal('payment-history-modal');

    const myPayments = (window.allPayments || []).filter(p => {
      const psid = String(p.student_id || '').trim().toLowerCase();
      const sid = String(studentId || '').trim().toLowerCase();
      return psid === sid;
    }).sort((a, b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at));

    const body = $('p-history-body');
    if (myPayments.length === 0) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--ivory-dim)">No payment records found.</td></tr>';
      return;
    }

     body.innerHTML = myPayments.map(p => `
       <tr>
         <td>${new Date(p.payment_date || p.created_at).toLocaleDateString()}</td>
         <td style="color:var(--success);font-weight:600">₹${(p.amount || 0).toLocaleString()}</td>
         <td>${escapeHtml(p.payment_method || 'Cash')}</td>
         <td style="font-family:var(--font-mono);font-size:11px">${p.transaction_id || 'N/A'}</td>
         <td>
           <div style="display:flex;gap:5px">
             <button class="btn btn-outline btn-sm" onclick="downloadReceipt('${s.id}', '${escapeHtml(getStudentName(s))}', '${p.amount}', '${escapeHtml(getStudentLevel(s))}', '${getStudentRating(s)}', 'N/A', '${p.payment_method || 'Online'}')">📄</button>
             <button class="btn btn-outline-danger btn-sm" onclick="deletePayment('${p.id}', '${studentId}')">🗑️</button>
           </div>
         </td>
       </tr>
     `).join('');
  };

  window.deletePayment = async function (paymentId, studentId) {
    if (!confirm('Delete this record? This will decrease the student\'s credit count and affect historical reports.')) return;
    try {
      const res = await apiCall(`${API_BASE}/payments?id=${paymentId}`, { method: 'DELETE' });
      if (res.ok) {
        toast('Record deleted', 'success');
        await loadAllData(true);
        renderDash();
        renderBills();
        viewPaymentHistory(studentId);
      }
    } catch (e) {
      console.error('Delete payment failed:', e);
      toast('Failed to delete payment', 'error');
    }
  };

  window.downloadReceipt = function (studentId, name, amount, level, elo, coach, method) {
    downloadReceipt(studentId, name, amount, level, elo, coach, method);
  };

  // --- End of Students & Payments Section ---
  function getCoachPaymentStatus(c) {
    return c.payment_status || 'Pending';
  }

  window.markCoachPaid = async function (id) {
    const btn = event.currentTarget;
    const oldText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;

    try {
      const res = await apiCall('/api/coaches?id=' + id, {
        method: 'PUT',
        body: JSON.stringify({ payment_status: 'Paid' })
      });
      if (res.ok) {
        toast('Coach salary marked as paid', 'success');
        const coach = allCoaches.find(c => String(c.id) === String(id));
        if (coach) coach.payment_status = 'Paid';
        renderCoachBills();
      } else {
        toast('Failed to update status', 'error');
      }
    } catch (e) {
      toast('Error saving to database', 'error');
    } finally {
      btn.innerHTML = oldText;
      btn.disabled = false;
    }
  };

  window.markCoachUnpaid = async function (id) {
    const btn = event.currentTarget;
    const oldText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;

    try {
      const res = await apiCall('/api/coaches?id=' + id, {
        method: 'PUT',
        body: JSON.stringify({ payment_status: 'Pending' })
      });
      if (res.ok) {
        toast('Coach salary marked as pending', 'warning');
        const coach = allCoaches.find(c => String(c.id) === String(id));
        if (coach) coach.payment_status = 'Pending';
        renderCoachBills();
      } else {
        toast('Failed to update status', 'error');
      }
    } catch (e) {
      toast('Error saving to database', 'error');
    } finally {
      btn.innerHTML = oldText;
      btn.disabled = false;
    }
  };

  window.setBillTab = function (tabName, btn) {
    document.querySelectorAll('#page-bills .tab-link').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('bills-tab-students').style.display = tabName === 'students' ? 'block' : 'none';
    $('bills-tab-coaches').style.display = tabName === 'coaches' ? 'block' : 'none';
  };

  function renderCoachBills() {
    const tbody = $('coach-bill-body');
    if (!tbody) return;

    if (!allCoaches || allCoaches.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">No coaches found</div></td></tr>';
      return;
    }

    tbody.innerHTML = allCoaches.map(c => {
      const status = getCoachPaymentStatus(c);
      const empId = 'EMP-' + (c.id ? c.id.toString().slice(-6) : '000000');
      const salary = getCoachSalary(c) || 0;

      return `<tr>
        <td><span style="font-family:var(--font-mono);color:var(--gold);font-size:13px">${empId}</span></td>
        <td>
          <div style="font-weight:600;color:var(--ivory)">${escapeHtml(getCoachName(c))}</div>
        </td>
        <td><div style="font-size:11px;color:var(--ivory-dim)">${escapeHtml(getCoachSpecialty(c))}</div></td>
        <td style="font-weight:600;color:var(--gold)">₹${salary.toLocaleString()}</td>
        <td><span class="badge ${status === 'Paid' ? 'badge-success' : 'badge-warning'}" style="font-size:10px;padding:4px 8px">${status}</span></td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            ${status === 'Pending' ?
          `<button class="btn btn-outline btn-sm" onclick="markCoachPaid('${c.id}')">✅ Mark Paid</button>` :
          `<button class="btn btn-outline-danger btn-sm" onclick="markCoachUnpaid('${c.id}')">❌ Mark Unpaid</button>`}
          </div>
        </td>
      </tr>`;
    }).join('');
  }

   window.syncBillMonth = function(val) {
     if (!val) return;
     // FIX #15: Only trigger renderBills if the bills page DOM is present
     const billBody = document.getElementById('bill-body');
     if (!billBody) {
       // Page not active — just update the global context
       const parts = val.split('-');
       if (parts.length >= 2) {
         window.reportYear = parseInt(parts[0]);
         window.reportMonth = parseInt(parts[1]) - 1;
       }
       return;
     }
     window.updateReportContext(val);
   };

  window.resetBillMonth = function () {
    const now = new Date();
    window.reportYear = now.getUTCFullYear();
    window.reportMonth = now.getUTCMonth();
    renderBills();
  };

  function renderBills() {
    renderCoachBills();
    const tbody = $('bill-body');
    if (!tbody) return;

    // Sync with global report context if filter is empty or just loaded
    const filterEl = $('f-bill-month');
    const globalPeriod = `${window.reportYear}-${String(window.reportMonth + 1).padStart(2, '0')}`;
    
    if (filterEl) {
      filterEl.value = globalPeriod;
    }

    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;

    if (!allStudents || allStudents.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state">No payment records found</div></td></tr>';
      return;
    }

    // 1. Map total payments per student (Case-Insensitive)
    const totalPaymentsMap = {};
    (allPayments || []).forEach(p => {
      const sid = String(p.student_id || '').trim().toLowerCase();
      if (!sid) return;
      if (!totalPaymentsMap[sid]) totalPaymentsMap[sid] = 0;
      totalPaymentsMap[sid]++;
    });

    // Pre-compute payment statuses for performance
    const statusCache = new Map();
    allStudents.forEach(s => {
      const key = s.id;
      const status = getStudentPaymentStatus(s, targetMonth, targetYear);
      statusCache.set(key, status);
    });

    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();
    const isCurrentMonth = targetMonth === currentMonth && targetYear === currentYear;
    const isPastMonth = (targetYear < currentYear) || (targetYear === currentYear && targetMonth < currentMonth);
    const targetMonthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59));

    tbody.innerHTML = allStudents.map(s => {
      const enrollDateStr = getStudentDate(s);
      const enrollDate = enrollDateStr ? new Date(enrollDateStr) : null;

      // 1. Enrollment Check
      const wasEnrolled = enrollDate && enrollDate <= targetMonthEnd;
      if (!wasEnrolled) {
        return `<tr>
          <td><span style="font-family:var(--font-mono);color:var(--gold);font-size:13px">INV-${(s.id ? s.id.toString().slice(-6) : '000000')}</span></td>
          <td><div style="font-weight:600;color:var(--ivory)">${escapeHtml(getStudentName(s))}</div></td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td style="font-weight:600;color:var(--gold)">₹${getStudentMonthlyFee(s).toLocaleString()}</td>
          <td><span class="badge badge-outline-grey" style="font-size:10px;padding:4px 8px">Not Enrolled</span></td>
          <td><span style="color:var(--ivory-dim);font-size:11px">—</span></td>
        </tr>`;
      }

      // 2. Status Determination (Using Unified Intelligence Core)
      const status = statusCache.get(s.id);
      let statusClass = 'badge-danger';
      if (status === 'Paid') statusClass = 'badge-success';
      else if (status === 'Pending') statusClass = 'badge-warning';
      else if (status === 'Due') statusClass = 'badge-danger';
      else if (status === 'Not Enrolled') statusClass = 'badge-outline-grey';

      const invoiceId = 'INV-' + (s.id ? s.id.toString().slice(-6) : '000000');

     // Get Coach Info
       const coach = allCoaches.find(c => String(c.id) === String(s.coach_id));
       const coachName = coach ? escapeHtml(getCoachName(coach)) : 'N/A';
       const sessionType = getStudentBatchType(s) || 'Regular';
       const scheduleTime = getStudentSessionTime(s) || 'TBD';

       let actionButtons = '';
       if (status === 'Unpaid' || status === 'Due' || status === 'Pending') {
         actionButtons = `
           <button class="btn btn-gold btn-sm" onclick="openPay('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${getStudentMonthlyFee(s)}')">💳 Pay Now</button>
           <button class="btn btn-outline-grey btn-sm" onclick="viewPaymentHistory('${s.id}')">⏳ History</button>
           <button class="btn btn-outline btn-sm" onclick="markPaid('${s.id}')">✅ Mark Paid</button>
         `;
       } else if (status === 'Paid') {
         actionButtons = `
           <button class="btn btn-outline-grey btn-sm" onclick="downloadReceipt('${s.id}', '${jsAttrEncode(getStudentName(s))}', '${getStudentMonthlyFee(s)}', '${jsAttrEncode(getStudentLevel(s))}', '${getStudentRating(s)}', '${coachName}', 'Online')">📄 Receipt</button>
           <button class="btn btn-outline-grey btn-sm" onclick="viewPaymentHistory('${s.id}')">⏳ History</button>
         `;
       } else {
        actionButtons = `<span style="color:var(--ivory-dim);font-size:11px">—</span>`;
      }

      return `<tr>
        <td><span style="font-family:var(--font-mono);color:var(--gold);font-size:13px">${invoiceId}</span></td>
        <td>
          <div style="font-weight:600;color:var(--ivory)">${escapeHtml(getStudentName(s))}</div>
          <div style="font-size:11px;color:var(--ivory-dim)">${escapeHtml(getStudentLevel(s))}</div>
        </td>
        <td><div style="font-size:12px;color:var(--ivory)">${escapeHtml(coachName)}</div></td>
        <td><div style="font-size:12px;color:var(--ivory-dim)">${escapeHtml(sessionType)}</div></td>
        <td><div style="font-size:11px;color:var(--ivory-dim)">${escapeHtml(scheduleTime)}</div></td>
        <td style="font-weight:600;color:var(--gold)">₹${getStudentMonthlyFee(s).toLocaleString()}</td>
        <td><span class="badge ${statusClass}" style="font-size:10px;padding:4px 8px">${status}</span></td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            ${actionButtons}
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  window.toggleAllStudents = function (checked) {
    document.querySelectorAll('.stud-check').forEach(cb => cb.checked = checked);
  };

  async function bulkMarkPaid() {
    const checked = document.querySelectorAll('.stud-check:checked');
    if (checked.length === 0) {
      toast('Please select students first', 'warning');
      return;
    }

    if (!confirm(`Mark ${checked.length} students as Paid?`)) return;

    toast(`Processing ${checked.length} students...`, 'info');
    for (const cb of checked) {
      const studentId = cb.dataset.id;
      const s = allStudents.find(x => String(x.id) === String(studentId));
      const amt = s ? getStudentMonthlyFee(s) : 5000;

      // Update student status and advance due date - Fix #26
      const updates = { payment_status: 'Paid' };
      if (s) {
        const baseDate = s.due_date ? new Date(s.due_date) : new Date();
        const nextDate = new Date(baseDate);
        nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
        updates.due_date = nextDate.toISOString().split('T')[0];
      }

      try {
        await apiCall(`${API_BASE}/students?id=${studentId}`, {
          method: 'PUT',
          body: JSON.stringify(updates)
        });

        // Log history
        await apiCall(`${API_BASE}/payments`, {
          method: 'POST',
          body: JSON.stringify({
            student_id: studentId,
            amount: amt,
            status: 'paid',
            payment_method: 'Bulk Admin',
            description: 'Bulk mark as paid by administrator',
            transaction_id: 'BLK-' + Math.floor(Math.random() * 1000000),
            payment_date: new Date().toISOString()
          })
        });
      } catch (e) {
        console.error('Bulk mark paid error for student', studentId, e);
        toast(`Failed to process student ${getStudentName(s)}: ${e.message}`, 'error');
      }
     }
     toast('Bulk payments processed and due dates advanced!', 'success');
     
     // FIX #4: Invalidate payment cache before reload
     window.totalPaymentsMap = null;
     
     loadAllData(true);
   }

  window.bulkDeleteStudents = async function () {
    const checked = document.querySelectorAll('.stud-check:checked');
    if (checked.length === 0) {
      toast('Please select students to delete', 'warning');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${checked.length} students? This cannot be undone.`)) return;

    toast(`Deleting ${checked.length} students...`, 'info');
    let successCount = 0;
    for (const cb of checked) {
      try {
        const id = cb.dataset.id;
        const res = await apiCall(`/api/students?id=${id}`, { method: 'DELETE' });
        if (res.ok) successCount++;
      } catch (e) { console.error('Bulk delete error:', e); }
    }

    toast(`${successCount} students deleted!`, 'success');
    loadAllData(true);
    if ($('stud-check-all')) $('stud-check-all').checked = false;
  };
  let currentPayId = null;
  let currentPayAmt = 0;

  function openPay(id, name, fee) {
    const nameEl = $('pay-name');
    const feeEl = $('pay-amt');

    // Harden fee input: strip currency symbols and commas
    const finalFee = typeof fee === 'string'
      ? parseInt(fee.replace(/[^\d]/g, ''), 10) || 5000
      : (fee || 5000);

    currentPayId = id;
    currentPayAmt = finalFee;

    if (nameEl) nameEl.textContent = name;
    if (feeEl) feeEl.textContent = `₹${finalFee.toLocaleString()}`;

    // Reset payment modal view
    if ($('pay-options')) $('pay-options').style.display = 'block';
    if ($('pay-processing')) $('pay-processing').style.display = 'none';

    openModal('pay-modal');
  }

  function initiatePay(provider) {
    if ($('pay-options')) $('pay-options').style.display = 'none';
    if ($('pay-processing')) $('pay-processing').style.display = 'block';
    if ($('pay-provider')) $('pay-provider').textContent = 'Connecting to ' + provider + '...';

    setTimeout(async () => {
      await markPaid(currentPayId, currentPayAmt, provider);
      closeModals();
      loadAllData(true);
    }, 2000);
  }

  function downloadReceipt(id, name, fee, level = 'Beginner', rating = 800, coach = 'N/A', paymentMode = 'Online Transfer') {
    const url = `receipt.html?id=${id}&name=${encodeURIComponent(name)}&amount=${fee}&level=${encodeURIComponent(level)}&rating=${rating}&coach=${encodeURIComponent(coach)}&method=${encodeURIComponent(paymentMode)}&print=true`;
    window.open(url, '_blank');
    toast('Opening receipt for printing...', 'success');
  }

  function numberToWords(num) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const scales = ['', 'Thousand', 'Lakh', 'Crore'];

    if (num === 0) return 'Zero Rupees Only';

    let words = '';
    let n = num;
    let scaleIndex = 0;

    const getChunk = (n) => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + getChunk(n % 100) : '');
    };

    if (n >= 10000000) {
      words += getChunk(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      words += getChunk(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      words += getChunk(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    if (n > 0) {
      words += getChunk(n);
    }

    return words + ' Rupees Only';
  }


  function showReceiptPreview() { openModal('receipt-preview-modal'); }
  function printReceipt() { window.print(); }

  // ═══════════════════════════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════════════════════════
  async function renderMsgs() {
    const listEl = $('msgs-list');
    const loadingEl = $('msgs-loading');
    if (!listEl) return;

    if (loadingEl) loadingEl.style.display = 'none';

    if (!allMessages || allMessages.length === 0) {
      listEl.style.display = 'grid';
      listEl.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">💬</span><p>No messages yet</p></div>';
      return;
    }

     listEl.style.display = 'grid';
     listEl.innerHTML = allMessages.map(m => `
       <div class="msg-card ${m.is_read ? '' : 'unread'}">
         <div class="msg-card-head">
           <div class="msg-card-sender">
             ${escapeHtml(m.sender_name || 'User')}
             ${!m.is_read ? '<span class="badge badge-level" style="margin-left:8px">New</span>' : ''}
           </div>
           <div class="msg-card-time">${m.created_at ? new Date(m.created_at).toLocaleDateString() : ''}</div>
         </div>
         <div class="msg-card-subject">${escapeHtml(m.subject || 'No Subject')}</div>
         <div class="msg-card-body">${escapeHtml(m.message || '')}</div>
         <div class="msg-card-actions">
           ${!m.is_read ? `<button class="btn btn-outline-grey btn-sm" onclick="markMsgRead('${m.id}')">✓ Mark Read</button>` : ''}
           <button class="btn btn-outline-grey btn-sm" onclick="deleteMsg('${m.id}')">🗑️ Delete</button>
         </div>
       </div>
     `).join('');
  }
  async function markMsgRead(id) {
    await apiCall(`${API_BASE}/messages?id=${id}`, { method: 'PUT', body: JSON.stringify({ is_read: true }) });
    loadAllData(true);
  }
  async function deleteMsg(id) {
    await apiCall(`${API_BASE}/messages?id=${id}`, { method: 'DELETE' });
    loadAllData(true);
  }

  // ═══════════════════════════════════════════════════════════════
  // PARENT VIEW
  // ═══════════════════════════════════════════════════════════════
  function renderChild() {
    const loadingEl = $('child-loading');
    const contentEl = $('child-content');
    if (!currentStudent) { if (loadingEl) loadingEl.style.display = 'flex'; return; }

    const s = currentStudent;

    // Basic profile info
    if ($('c-name')) $('c-name').textContent = getStudentName(s);
    if ($('c-elo')) $('c-elo').textContent = getStudentRating(s);
    if ($('c-level')) $('c-level').textContent = getStudentLevel(s);
    if ($('p-av-wrap')) $('p-av-wrap').innerHTML = `<img src="${makeAvSrc(s)}" class="profile-av">`;

    // Coach name
    const coach = allCoaches.find(c => String(c.id) === String(s.coach_id));
    const coachName = coach ? getCoachName(coach) : 'Not Assigned';
    if ($('c-coach')) $('c-coach').textContent = coachName;

    // Latest coach notes/review (from student notes field or messages)
    const latestNotes = s.notes || 'No recent review available';
    if ($('c-notes')) $('c-notes').textContent = latestNotes;

    // Skill breakdown (based on level)
    renderChildSkills(s);

    // Achievements
    renderChildAchievements();

    // Billing tab
    renderChildBilling();

    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
    setChildTab('overview');
  }

  function renderChildSkills(s) {
    const skillBars = $('skill-bars');
    if (!skillBars) return;

    const level = getStudentLevel(s);
    const skills = {
      'Opening Theory': { Beginner: 20, Intermediate: 40, Advanced: 60, Elite: 80 },
      'Middle Game': { Beginner: 15, Intermediate: 35, Advanced: 55, Elite: 75 },
      'Endgame Play': { Beginner: 10, Intermediate: 30, Advanced: 50, Elite: 70 },
      'Tactics': { Beginner: 25, Intermediate: 45, Advanced: 65, Elite: 85 },
      'Positional': { Beginner: 20, Intermediate: 35, Advanced: 55, Elite: 75 }
    };

    skillBars.innerHTML = Object.entries(skills).map(([skill, levelProgs]) => {
      const prog = levelProgs[level] || 30;
      const color = prog >= 70 ? 'var(--success)' : prog >= 50 ? 'var(--gold)' : 'var(--blue)';
      return `
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
            <span>${skill}</span>
            <span style="color:${color}">${prog}%</span>
          </div>
          <div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${prog}%;background:${color};border-radius:3px"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderChildAchievements() {
    const achGrid = $('parent-ach');
    if (!achGrid) return;

    const myAchs = achievementsData.filter(a => String(a.student_id) === String(currentStudent.id));

    if (myAchs.length === 0) {
      achGrid.innerHTML = '<div class="empty-state"><span class="empty-icon">🏆</span><p>No achievements yet. Keep practicing!</p></div>';
      return;
    }

     achGrid.innerHTML = myAchs.slice(0, 6).map(a => `
       <div class="ach-card">
         ${a.img_url ? `<img src="${escapeHtml(a.img_url)}" alt="${escapeHtml(a.title)}">` : '<div class="ach-icon">🏆</div>'}
         <div class="ach-info">
           <div class="ach-title">${escapeHtml(a.title)}</div>
           <div class="ach-date">${a.date_achieved ? new Date(a.date_achieved).toLocaleDateString() : ''}</div>
         </div>
       </div>
     `).join('');
  }
  function openContactModal() {
    if (!currentStudent) return;
    const coach = allCoaches.find(c => String(c.id) === String(currentStudent.coach_id));
    const coachName = coach ? getCoachName(coach) : 'Coach';
    if ($('contact-coach')) $('contact-coach').textContent = coachName;
    openModal('contact-modal');
  }
  async function sendMsg() {
    const msg = $('contact-msg')?.value?.trim();
    if (!msg) { toast('Please enter a message', 'error'); return; }
    if (!currentStudent) return;

    try {
      const coach = allCoaches.find(c => String(c.id) === String(currentStudent.coach_id));
      await apiCall('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          receiver_id: currentStudent.coach_id,
          receiver_type: 'coach',
          sender_id: currentStudent.id,
          sender_type: 'student',
          message: msg,
          subject: `Message from parent of ${getStudentName(currentStudent)}`
        })
      });
      toast('Message sent to ' + (coach ? getCoachName(coach) : 'coach') + '!', 'success');
      $('contact-msg').value = '';
      closeModals();
    } catch (e) {
      toast('Failed to send message', 'error');
    }
  }
  async function sendFeedback() {
    const msg = $('fb-msg')?.value?.trim();
    if (!msg) { toast('Please enter your feedback', 'error'); return; }
    if (!currentStudent) return;

    try {
      await apiCall('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          sender_type: 'parent',
          sender_id: currentStudent.id,
          receiver_type: 'admin',
          subject: `Feedback from parent of ${getStudentName(currentStudent)}`,
          message: msg,
          priority: 'normal'
        })
      });
      toast('Feedback submitted successfully!', 'success');
      if ($('fb-msg')) $('fb-msg').value = '';
      closeModals();
    } catch (e) {
      toast('Failed to submit feedback', 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // AI & CHAT
  // ═══════════════════════════════════════════════════════════════
  let currentAIModule = 'global';

  // ── PRIVACY GUARDRAILS FOR PARENT AI ──
  const BLOCKED_PATTERNS = [
    /total revenue/i, /academy revenue/i, /monthly revenue/i, /salary/i, /total profit/i, /academy income/i,
    /other student/i, /other parent/i, /coach.*salary/i,
    /academy.*financial/i, /revenue.*this.*month/i,
    /total.*student/i, /collection.*rate/i, /payment.*records.*other/i,
    /sensitive/i, /confidential/i, /internal/i,
    /admin.*data/i, /backend/i, /database/i
  ];

  const ALLOWED_PARENT_QUERIES = [
    'my child progress', 'child progress', 'my child achievements',
    'my child attendance', 'attendance record',
    'my payment status', 'payment history', 'fee status',
    'my coach', 'assigned coach', 'coach name',
    'upcoming events', 'events this month', 'event schedule',
    'my child level', 'my child elo', 'rating history',
    'class schedule', 'batch timing', 'session time'
  ];

  const PARENT_DENIED_MESSAGE = "I can only help with information about your child's progress, attendance, and general academy events. For detailed financial or administrative queries, please contact the academy administrator directly.";

  function buildParentAIContext() {
    if (role !== 'parent' || !currentStudent) return null;

    const coach = allCoaches.find(c => String(c.id) === String(currentStudent.coach_id));
    const myAchievements = achievementsData.filter(a => String(a.student_id) === String(currentStudent.id));
    const myPayments = allPayments.filter(p => String(p.student_id) === String(currentStudent.id));
    const upcomingEvents = eventsData.filter(e => new Date(e.date) >= new Date()).slice(0, 5);
    const myAttendance = allAttendance.filter(a => String(a.student_id) === String(currentStudent.id)).slice(-30);

    return {
      role: 'parent',
      student: {
        name: currentStudent.name,
        level: currentStudent.grade,
        elo: currentStudent.rating,
        payment_status: getStudentPaymentStatus(currentStudent),
        monthly_fee: currentStudent.monthly_fee,
        due_date: currentStudent.due_date
      },
      coach: coach ? {
        name: getCoachName(coach),
        specialty: getCoachSpecialty(coach)
      } : null,
      achievements: myAchievements.slice(0, 5).map(a => ({
        title: a.title,
        date: a.date_achieved
      })),
      payments: myPayments.slice(0, 5).map(p => ({
        date: p.payment_date,
        amount: p.amount,
        status: p.status
      })),
      events: upcomingEvents.map(e => ({
        title: e.title,
        date: e.date,
        type: e.type
      })),
      attendance: {
        present: myAttendance.filter(a => a.status === 'present').length,
        total: myAttendance.length
      },
      // NOTE: No other students, no coach salary, no revenue data
      allowed_queries: ALLOWED_PARENT_QUERIES,
      blocked_patterns: BLOCKED_PATTERNS.map(p => p.source)
    };
  }

  function validateParentAIQuery(query) {
    const queryLower = query.toLowerCase();

    // Check if query contains blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(queryLower)) {
        return { allowed: false, reason: 'sensitive_data' };
      }
    }

    // Check minimum allowed patterns (at least one keyword must match)
    const minKeywords = [
      /child/i, /my/i, /student/i, /attendance/i, /payment/i,
      /coach/i, /event/i, /level/i, /elo/i, /rating/i,
      /class/i, /session/i, /batch/i, /progress/i, /achievement/i
    ];

    const hasMinKeyword = minKeywords.some(k => k.test(queryLower));
    if (!hasMinKeyword) {
      return { allowed: false, reason: 'unrelated_query' };
    }

    return { allowed: true };
  }

  function validateParentAIResponse(response) {
    if (role !== 'parent') return response;

    // Check response for sensitive data leakage
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(response)) {
        return PARENT_DENIED_MESSAGE;
      }
    }

    return response;
  }

  function setAIModule(m) {
    // Parents can only access parent module
    if (role === 'parent' && m !== 'parent') {
      m = 'parent';
    }

    currentAIModule = m;
    const buttons = document.querySelectorAll('.ai-ws-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    const moduleConfig = {
      global: { title: 'Global Insights', icon: '⚡', btnIndex: 0, roles: ['admin', 'master'] },
      finance: { title: 'Financial Analysis', icon: '💰', btnIndex: 1, roles: ['admin', 'master'] },
      coach: { title: 'Coach Performance', icon: '🧑‍🏫', btnIndex: 2, roles: ['admin', 'master'] },
      parent: { title: 'My Child Progress', icon: '👶', btnIndex: 3, roles: ['parent'] }
    };

    const config = moduleConfig[m];
    if (config && buttons[config.btnIndex]) {
      buttons[config.btnIndex].classList.add('active');
    }

    const header = document.querySelector('.ai-ws-header h2');
    const sub = document.querySelector('.ai-ws-header p');
    if (header) {
      header.textContent = config ? config.title : 'Academy Intelligence';
    }
    if (sub) {
      const descriptions = {
        global: 'Real-time analytics and predictive capabilities.',
        finance: 'Revenue tracking, payment status, and financial forecasts.',
        coach: 'Coach performance metrics and student progress tracking.',
        parent: 'Get updates about your child\'s progress, attendance, and academy events.'
      };
      sub.textContent = descriptions[m] || descriptions.global;
    }

    const chatContainer = document.getElementById('ai-workspace-msgs');
    if (chatContainer) {
      // Clear existing messages for parent module
      if (m === 'parent') {
        chatContainer.innerHTML = '';
      }

      const welcomeMsg = document.createElement('div');
      welcomeMsg.className = 'ai-ws-msg bot';
      welcomeMsg.innerHTML = `
        <div class="ai-ws-avatar">🤖</div>
        <div class="ai-ws-bubble">
          ${m === 'global' ? 'Switched to Global Insights. I can now provide academy-wide analytics, enrollment trends, and comprehensive metrics.' :
          m === 'finance' ? 'Switched to Financial Analysis. Let\'s examine revenue patterns, payment collections, and financial performance.' :
            m === 'coach' ? 'Switched to Coach Performance. I\'ll analyze individual coach metrics and student progress.' :
              `Hello! I'm your personal assistant for ${currentStudent?.name || 'your child'}'s progress. I can help with attendance, achievements, payment status, upcoming events, and class schedules.`}
        </div>
      `;
      chatContainer.appendChild(welcomeMsg);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  function setAISuggestion(q) {
    const input = $('ai-query');
    if (input) {
      input.value = q;
      input.focus();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // REAL-TIME INTELLIGENCE ENGINE (RAG + AGENTIC AI)
  // ═══════════════════════════════════════════════════════════════

  // ── API ORCHESTRATION LAYER ──
  const API_ORCHESTRATION = {
    endpoints: {
      news: 'https://newsapi.org/v2/top-headlines',
      finance: 'https://api.coingecko.com/api/v3',
      weather: 'https://api.open-meteo.com/v1/forecast',
      stocks: 'https://query1.finance.yahoo.com/v8/finance',
      crypto: 'https://api.coingecko.com/api/v3/simple/price'
    },
    cache: new Map(),
    cacheExpiry: 60000, // 1 minute cache

    async fetchWithCache(key, fetcher, expiry = 60000) {
      const now = Date.now();
      const cached = this.cache.get(key);
      if (cached && (now - cached.timestamp) < expiry) {
        return cached.data;
      }
      const data = await fetcher();
      this.cache.set(key, { data, timestamp: now });
      return data;
    },

    async fetchNews(category = 'general') {
      return this.fetchWithCache(`news-${category}`, async () => {
        // Simulated news - in production would use real API
        return { articles: [], status: 'demo' };
      }, 300000);
    },

    async fetchMarketData() {
      return this.fetchWithCache('market', async () => {
        return {
          indices: [
            { name: 'S&P 500', value: 4780.24, change: 0.45 },
            { name: 'NIFTY 50', value: 22350.80, change: 0.32 },
            { name: 'NASDAQ', value: 15050.12, change: 0.67 }
          ],
          timestamp: new Date().toISOString()
        };
      }, 60000);
    },

    async fetchWeather(lat = 13.08, lon = 80.27) {
      return this.fetchWithCache(`weather-${lat}-${lon}`, async () => {
        return {
          temperature: 28,
          condition: 'Partly Cloudy',
          humidity: 65,
          timestamp: new Date().toISOString()
        };
      }, 300000);
    },

    async fetchIoTSensors() {
      return {
        sensors: [
          { id: 'temp-01', type: 'temperature', value: 26.5, unit: '°C', location: 'Classroom 1' },
          { id: 'hum-01', type: 'humidity', value: 62, unit: '%', location: 'Classroom 1' },
          { id: 'occupancy-01', type: 'motion', value: 12, unit: 'persons', location: 'Main Hall' }
        ],
        timestamp: new Date().toISOString()
      };
    }
  };

  // ── VECTOR DATABASE SIMULATION (RAG) ──
  const VECTOR_RAG = {
    chunks: [],

    async indexData() {
      this.chunks = [
        { id: 'student_1', type: 'student', content: 'Total students count', data: { count: 0 }, embedding: [] },
        { id: 'coach_1', type: 'coach', content: 'Coach information', data: { count: 0 }, embedding: [] },
        { id: 'payment_1', type: 'payment', content: 'Payment status and revenue', data: { revenue: 0, paid: 0, due: 0 }, embedding: [] },
        { id: 'event_1', type: 'event', content: 'Academy events', data: { upcoming: 0, total: 0 }, embedding: [] },
        { id: 'achievement_1', type: 'achievement', content: 'Student achievements', data: { count: 0 }, embedding: [] }
      ];
    },

    async retrieve(query, topK = 3) {
      const keywords = query.toLowerCase().split(' ');
      const scored = this.chunks.map(chunk => {
        let score = 0;
        keywords.forEach(kw => {
          if (chunk.content.toLowerCase().includes(kw)) score += 1;
          if (chunk.type.toLowerCase().includes(kw)) score += 0.5;
        });
        return { ...chunk, score };
      });
      return scored.sort((a, b) => b.score - a.score).slice(0, topK);
    },

    updateChunkData(type, data) {
      const chunk = this.chunks.find(c => c.type === type);
      if (chunk) {
        chunk.data = data;
        chunk.content = JSON.stringify(data);
      }
    }
  };

  // ── TOOL CALLING ENGINE ──
  const TOOL_CALLER = {
    tools: {
      get_academy_stats: {
        name: 'get_academy_stats',
        description: 'Get academy statistics including students, coaches, revenue',
        execute: async () => {
          const totalStudents = allStudents.filter(s => s.status !== 'archived').length;
          const totalCoaches = allCoaches.filter(c => c.status !== 'archived').length;
          const revenue = allStudents.filter(s => s.status !== 'archived').reduce((a, s) => a + (getStudentMonthlyFee(s) || 0), 0);
          const paid = allStudents.filter(s => s.status !== 'archived' && getStudentPaymentStatus(s) === 'Paid').length;
          const due = allStudents.filter(s => s.status !== 'archived' && getStudentPaymentStatus(s) === 'Due').length;
          const pending = allStudents.filter(s => s.status !== 'archived' && getStudentPaymentStatus(s) === 'Pending').length;
          return { totalStudents, totalCoaches, revenue, paid, due, pending, collectionRate: ((paid / totalStudents) * 100 || 0).toFixed(1) };
        }
      },
      get_market_data: {
        name: 'get_market_data',
        description: 'Get real-time market indices and financial data',
        execute: async () => API_ORCHESTRATION.fetchMarketData()
      },
      get_weather: {
        name: 'get_weather',
        description: 'Get current weather for location',
        execute: async (args) => API_ORCHESTRATION.fetchWeather(args?.lat, args?.lon)
      },
      get_iot_sensors: {
        name: 'get_iot_sensors',
        description: 'Get IoT sensor readings from academy',
        execute: async () => API_ORCHESTRATION.fetchIoTSensors()
      },
      get_events: {
        name: 'get_events',
        description: 'Get upcoming and past events',
        execute: async () => {
          const now = new Date();
          const upcoming = eventsData.filter(e => new Date(e.date) >= now).length;
          const past = eventsData.filter(e => new Date(e.date) < now).length;
          return { upcoming, past, total: eventsData.length, events: eventsData.slice(0, 5) };
        }
      },
      get_achievements: {
        name: 'get_achievements',
        description: 'Get recent student achievements',
        execute: async () => {
          return { count: achievementsData.length, latest: achievementsData.slice(0, 5) };
        }
      },
      search_students: {
        name: 'search_students',
        description: 'Search students by name or level',
        execute: async (args) => {
          const query = args?.query?.toLowerCase() || '';
          return allStudents.filter(s =>
            getStudentName(s).toLowerCase().includes(query) ||
            getStudentLevel(s).toLowerCase().includes(query)
          ).slice(0, 10);
        }
      }
    },

    async executeTool(toolName, args = {}) {
      const tool = this.tools[toolName];
      if (!tool) return { error: `Tool ${toolName} not found` };
      try {
        return await tool.execute(args);
      } catch (e) {
        return { error: e.message };
      }
    },

    async executePlan(query) {
      const queryLower = query.toLowerCase();
      const toolsToCall = [];

      // Intelligent tool selection based on query keywords
      if (queryLower.includes('student') || queryLower.includes('enrolled') || queryLower.includes('how many')) {
        toolsToCall.push(this.tools.get_academy_stats);
      }
      if (queryLower.includes('market') || queryLower.includes('stock') || queryLower.includes('finance') || queryLower.includes('revenue')) {
        toolsToCall.push(this.tools.get_market_data);
      }
      if (queryLower.includes('weather') || queryLower.includes('temperature')) {
        toolsToCall.push(this.tools.get_weather);
      }
      if (queryLower.includes('sensor') || queryLower.includes('iot') || queryLower.includes('monitor')) {
        toolsToCall.push(this.tools.get_iot_sensors);
      }
      if (queryLower.includes('event') || queryLower.includes('tournament')) {
        toolsToCall.push(this.tools.get_events);
      }
      if (queryLower.includes('achievement') || queryLower.includes('award') || queryLower.includes('winner')) {
        toolsToCall.push(this.tools.get_achievements);
      }

      // Default: always include academy stats
      if (toolsToCall.length === 0) {
        toolsToCall.push(this.tools.get_academy_stats);
      }

      const results = await Promise.all(toolsToCall.map(t => t.execute()));
      return { results, sources: toolsToCall.map(t => t.name), timestamp: new Date().toISOString() };
    }
  };

  // ── TEMPORAL REASONING ENGINE ──
  const TEMPORAL_ENGINE = {
    getCurrentContext() {
      const now = new Date();
      return {
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        day: now.toLocaleDateString('en-US', { weekday: 'long' }),
        hour: now.getHours(),
        isBusinessHours: now.getHours() >= 9 && now.getHours() <= 18,
        month: now.toLocaleDateString('en-US', { month: 'long' }),
        quarter: Math.ceil((now.getMonth() + 1) / 3)
      };
    },

    formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;

      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
      return date.toLocaleDateString();
    },

    getTimeBasedGreeting() {
      const hour = new Date().getHours();
      if (hour < 12) return 'Good morning';
      if (hour < 17) return 'Good afternoon';
      return 'Good evening';
    }
  };

  // ── RESPONSE SYNTHESIZER ──
  const RESPONSE_SYNTHESIZER = {
    synthesize(query, toolResults, temporalContext) {
      let response = '';
      const sources = toolResults.sources || [];
      const results = toolResults.results || [];

      // Build contextual response based on query
      const queryLower = query.toLowerCase();

      if (queryLower.includes('how many') || queryLower.includes('total') || queryLower.includes('count')) {
        const stats = results.find(r => r.totalStudents !== undefined);
        if (stats) {
          response = `📊 **Academy Statistics** (${temporalContext.date})

`;
          response += `• **Total Students:** ${stats.totalStudents}
`;
          response += `• **Active Coaches:** ${stats.totalCoaches}
`;
          response += `• **Total Revenue:** ₹${stats.revenue?.toLocaleString() || 0}
`;
          response += `• **Collection Rate:** ${stats.collectionRate}%
`;
          response += `• **Paid Students:** ${stats.paid}
`;
          response += `• **Due Payments:** ${stats.due}`;
        }
      }

      if (queryLower.includes('market') || queryLower.includes('stock') || queryLower.includes('finance')) {
        const market = results.find(r => r.indices);
        if (market) {
          response = `📈 **Market Overview** (${temporalContext.time})

`;
          market.indices.forEach(idx => {
            const sign = idx.change >= 0 ? '↑' : '↓';
            response += `• **${idx.name}:** ${idx.value.toLocaleString()} (${sign}${Math.abs(idx.change)}%)
`;
          });
        }
      }

      if (queryLower.includes('weather') || queryLower.includes('temperature')) {
        const weather = results.find(r => r.temperature !== undefined);
        if (weather) {
          response = `🌤️ **Current Weather** (${temporalContext.date})

`;
          response += `• **Temperature:** ${weather.temperature}°C
`;
          response += `• **Condition:** ${weather.condition}
`;
          response += `• **Humidity:** ${weather.humidity}%`;
        }
      }

      if (queryLower.includes('sensor') || queryLower.includes('iot') || queryLower.includes('monitor')) {
        const sensors = results.find(r => r.sensors);
        if (sensors) {
          response = `🔌 **IoT Sensors** (${temporalContext.time})

`;
          sensors.sensors.forEach(s => {
            response += `• **${s.location} - ${s.type}:** ${s.value} ${s.unit}
`;
          });
        }
      }

      if (queryLower.includes('event') || queryLower.includes('tournament')) {
        const events = results.find(r => r.upcoming !== undefined);
        if (events) {
          response = `📅 **Events Summary** (${temporalContext.date})

`;
          response += `• **Upcoming Events:** ${events.upcoming}
`;
          response += `• **Past Events:** ${events.past}
`;
          response += `• **Total Events:** ${events.total}`;
        }
      }

      if (!response) {
        // Default comprehensive response
        response = `🏫 **Chesskidoo Academy Report**
`;
        response += `${TEMPORAL_ENGINE.getTimeBasedGreeting()}! Here's your academy overview:

`;

        const stats = results.find(r => r.totalStudents !== undefined);
        if (stats) {
          response += `📊 **Statistics:** ${stats.totalStudents} students, ${stats.totalCoaches} coaches
`;
          response += `💰 **Revenue:** ₹${stats.revenue?.toLocaleString() || 0} (${stats.collectionRate}% collected)
`;
        }

        const events = results.find(r => r.upcoming !== undefined);
        if (events) {
          response += `📅 **Events:** ${events.upcoming} upcoming
`;
        }

        response += `
⏰ Last updated: ${temporalContext.time}`;
      }

      // Add source attribution
      if (sources.length > 0) {
        response += `

📡 *Data sources: ${sources.join(', ')}*`;
      }

      return response;
    }
  };

  // ── ENHANCED AI QUERY HANDLER ──
  function animateAIResponse(element, markdownText) {
    let html = (markdownText || '')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.1);padding:2px 4px;border-radius:4px;font-family:var(--font-mono);font-size:0.9em">$1</code>')
      .replace(/\n/g, '<br>');

    let i = 0;
    let isTag = false;
    let currentHTML = '';
    element.innerHTML = '';

    function type() {
      if (i < html.length) {
        let char = html.charAt(i);
        currentHTML += char;
        if (char === '<') isTag = true;
        if (char === '>') isTag = false;

        element.innerHTML = currentHTML + (i < html.length - 1 && !isTag ? '<span style="border-right: 2px solid var(--gold); animation: blink 1s step-end infinite; margin-left: 2px;">&nbsp;</span>' : '');

        const container = document.getElementById('ai-workspace-msgs');
        if (container) container.scrollTop = container.scrollHeight;

        let speed = isTag ? 0 : (char === '.' || char === '?' || char === '!') ? 200 : (char === ',' ? 100 : 15);
        i++;
        setTimeout(type, speed);
      } else {
        element.innerHTML = currentHTML;
      }
    }
    type();
  }

  async function sendAIQuery() {
    const input = $('ai-query');
    if (!input || !input.value.trim()) {
      toast('Please enter a query', 'info');
      return;
    }

    const query = input.value;
    const chatContainer = document.getElementById('ai-workspace-msgs');

    // ── PRIVACY GUARDRAIL: Validate parent queries ──
    if (role === 'parent') {
      const validation = validateParentAIQuery(query);
      if (!validation.allowed) {
        const userMsg = document.createElement('div');
        userMsg.className = 'ai-ws-msg user';
        userMsg.innerHTML = `<div class="ai-ws-avatar">👤</div><div class="ai-ws-bubble">${escapeHtml(query)}</div>`;
        chatContainer.appendChild(userMsg);

        const botMsg = document.createElement('div');
        botMsg.className = 'ai-ws-msg bot';
        botMsg.innerHTML = `<div class="ai-ws-avatar">🤖</div><div class="ai-ws-bubble"></div>`;
        chatContainer.appendChild(botMsg);
        animateAIResponse(botMsg.querySelector('.ai-ws-bubble'), PARENT_DENIED_MESSAGE);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return;
      }
    }

    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'ai-ws-msg user';
    userMsg.innerHTML = `<div class="ai-ws-avatar">👤</div><div class="ai-ws-bubble">${escapeHtml(query)}</div>`;
    chatContainer.appendChild(userMsg);

    input.value = '';
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Show thinking indicator with temporal context
    const thinkingMsg = document.createElement('div');
    thinkingMsg.className = 'ai-ws-msg bot';
    thinkingMsg.innerHTML = `
      <div class="ai-ws-avatar">🤖</div>
      <div class="ai-ws-bubble msg-thinking">
        🔄 Analyzing query...
      </div>
    `;
    chatContainer.appendChild(thinkingMsg);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
      // ── BUILD ROLE-SPECIFIC CONTEXT ──
      let context = {};

      if (role === 'parent') {
        // PARENT CONTEXT: Isolated, child-specific only
        context = buildParentAIContext() || {};
        context.moduleFocus = 'parent';
      } else {
        // ADMIN CONTEXT: Full academy data
        const studentsCount = allStudents.length;
        const coachesCount = allCoaches.length;
        const totalRevenue = allStudents.reduce((acc, s) => acc + (getStudentMonthlyFee(s) || 0), 0);
        const activeStudents = allStudents.filter(s => getStudentStatus(s) === 'active').length;
        const pendingPayments = allStudents.filter(s => getStudentPaymentStatus(s) === 'Due').length;
        const activeTab = document.querySelector('.nav-item.active')?.dataset.page || 'Dashboard';

        context = {
          students: studentsCount,
          activeStudents: activeStudents,
          coaches: coachesCount,
          revenue: totalRevenue,
          pendingPayments: pendingPayments,
          moduleFocus: activeTab,
          user: role || 'Admin',
          timestamp: new Date().toISOString()
        };
      }

      // Call AI with role-specific context
      const aiResponse = await apiCall(`${API_BASE}/ai`, {
        method: 'POST',
        body: JSON.stringify({
          message: query,
          role: role || 'admin',
          context: context
        })
      });

      const aiData = await aiResponse.json();
      let botResponse = aiData.message || 'I apologize, I couldn\'t process that request. Please try again.';

      // ── PRIVACY GUARDRAIL: Validate AI response for parents ──
      if (role === 'parent') {
        botResponse = validateParentAIResponse(botResponse);
      }

      thinkingMsg.remove();

      const botMsg = document.createElement('div');
      botMsg.className = 'ai-ws-msg bot';
      botMsg.innerHTML = `<div class="ai-ws-avatar">🤖</div><div class="ai-ws-bubble"></div>`;
      chatContainer.appendChild(botMsg);
      animateAIResponse(botMsg.querySelector('.ai-ws-bubble'), botResponse);
      chatContainer.scrollTop = chatContainer.scrollHeight;

    } catch (e) {
      thinkingMsg.remove();
      console.error('AI Query Error:', e);
       const errorMsg = document.createElement('div');
       errorMsg.className = 'ai-ws-msg bot';
       errorMsg.innerHTML = `<div class="ai-ws-avatar">🤖</div><div class="ai-ws-bubble">⚠️ Sorry, I encountered an error: ${escapeHtml(e.message)}. Try again or check your connection.</div>`;
       chatContainer.appendChild(errorMsg);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  // Initialize RAG on load
  VECTOR_RAG.indexData();

  // ═══════════════════════════════════════════════════════════════
  // THEME & PDF
  // ═══════════════════════════════════════════════════════════════
  function toggleTheme() {
    const newTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = newTheme;
    localStorage.setItem('chesskidoo_theme', newTheme);
    // Re-render dashboard if visible to update chart colors
    if ($('page-dash').classList.contains('active')) renderDash();
  }

  // Load theme on page load
  const savedTheme = localStorage.getItem('chesskidoo_theme');
  if (savedTheme) document.body.dataset.theme = savedTheme;

  // BOARDROOM REPORTING LOGIC MOVED TO js/reporting.js


  function exportAcademyData() {
    if (!allStudents || allStudents.length === 0) {
      toast('No student data to export', 'error');
      return;
    }

    const headers = [
      'Student Name', 'Parent Phone', 'Level', 'Rating', 'Join Date',
      'Fee Due Date', 'Monthly Fee', 'Payment Status', 'Session Mode', 'Session Time',
      'Assigned Coach', 'Coach Phone', 'Coach Specialty'
    ];
    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;
    const targetMonthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59));

    const rows = allStudents
      .filter(s => {
          const enrollStr = getStudentDate(s);
          const enrollDate = enrollStr ? new Date(enrollStr) : new Date(2026, 3, 1);
          return enrollDate <= targetMonthEnd && (s.status || 'active') !== 'archived';
      })
      .map(s => {
        const coach = allCoaches.find(c => String(c.id) === String(s.coach_id));
        return [
          getStudentName(s),
          getStudentPhone(s),
          getStudentLevel(s),
          getStudentRating(s),
          getStudentDate(s),
          s.due_date || 'N/A',
          getStudentMonthlyFee(s),
          getStudentPaymentStatus(s, targetMonth, targetYear),
          getStudentBatchType(s),
          s.session_time || s.batch_time || 'TBD',
          coach ? getCoachName(coach) : 'None',
          coach ? (coach.phone || 'N/A') : 'N/A',
          coach ? (getCoachSpecialty(coach) || 'N/A') : 'N/A'
        ].map(val => `"${String(val).replace(/"/g, '""')}"`);
      });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `Chesskidoo_Academy_Data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast('Academy Data Exported (CSV)', 'success');
  }

   function exportData() {
     // FIX #8: Guard against missing XLSX library
     if (typeof XLSX === 'undefined') {
       toast('Export library not loaded yet. Please wait a moment and try again.', 'error');
       return;
     }
     if (!window.allStudents || window.allStudents.length === 0) {
       toast('No data available for export', 'warning');
       return;
     }

    toast('Generating Strategic Intelligence Workbook...', 'info');

    try {
      const wb = XLSX.utils.book_new();

      // 1. Dashboard Sheet (KPIs)
      const targetMonth = window.reportMonth;
      const targetYear = window.reportYear;
      const targetMonthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59));

      const targetStudents = allStudents.filter(s => {
          const enrollStr = getStudentDate(s);
          const enrollDate = enrollStr ? new Date(enrollStr) : new Date(2026, 3, 1);
          return enrollDate <= targetMonthEnd && (s.status || 'active') !== 'archived';
      });

      const collected = targetStudents.filter(s => getStudentPaymentStatus(s, targetMonth, targetYear) === 'Paid').reduce((a, s) => a + getStudentMonthlyFee(s), 0);
      const pending = targetStudents.filter(s => getStudentPaymentStatus(s, targetMonth, targetYear) !== 'Paid').reduce((a, s) => a + getStudentMonthlyFee(s), 0);
      const totalPotential = collected + pending;

      const dashboardData = [
        ['IMPERIAL ACADEMY STRATEGIC KPI REPORT'],
        ['Issued', new Date().toLocaleString()],
        [],
        ['Metric', 'Value', 'Context'],
        ['Total Cadets', allStudents.length, 'Active Roster'],
        ['Revenue Potential', `₹${totalPotential}`, 'Gross Capacity'],
        ['Revenue Realized', `₹${collected}`, 'Liquidity'],
        ['Revenue Pending', `₹${pending}`, 'Risk Exposure'],
        ['Collection Rate', `${((collected / totalPotential) * 100).toFixed(1)}%`, 'Operational Efficiency'],
        ['ARPU', `₹${(collected / allStudents.filter(s => s.status === 'active').length || 1).toFixed(0)}`, 'Yield Per Cadet']
      ];
      const wsDash = XLSX.utils.aoa_to_sheet(dashboardData);
      XLSX.utils.book_append_sheet(wb, wsDash, "Executive Summary");

      // 2. Cadets Sheet (Deep Data)
      const cadetData = targetStudents.map(s => ({
        'ID': s.id,
        'Name': getStudentName(s),
        'Email': s.email || 'N/A',
        'Phone': s.phone || 'N/A',
        'Parent': s.parent_name || 'N/A',
        'Level': getStudentLevel(s),
        'Elo Rating': getStudentRating(s),
        'Batch Type': s.session_mode || s.batch_type || 'Group',
        'Session Time': s.session_time || 'N/A',
        'Monthly Fee': getStudentMonthlyFee(s),
        'Status': s.status,
        'Payment Status': getStudentPaymentStatus(s, targetMonth, targetYear),
        'Enrollment Date': s.enrollment_date || s.join_date || 'N/A',
        'Address': s.address || 'N/A',
        'Notes': s.notes || ''
      }));
      const wsCadets = XLSX.utils.json_to_sheet(cadetData);
      XLSX.utils.book_append_sheet(wb, wsCadets, "Cadet Registry");

      // 3. Faculty Sheet (ROI)
      const facultyData = allCoaches.map(c => {
        const coachStuds = targetStudents.filter(s => String(s.coach_id) === String(c.id));
        const coachRev = coachStuds.filter(s => getStudentPaymentStatus(s, targetMonth, targetYear) === 'Paid').reduce((a, s) => a + getStudentMonthlyFee(s), 0);
        const coachCost = getCoachSalary(c) || 0;
        return {
          'Faculty ID': c.id,
          'Name': getCoachName(c),
          'Enrolled Units': coachStuds.length,
          'Gross Revenue': coachRev,
          'Cost Basis': coachCost,
          'Net Profit': coachRev - coachCost,
          'ROI %': coachCost > 0 ? ((coachRev - coachCost) / coachCost * 100).toFixed(0) + '%' : '0%',
          'Expertise': c.expertise || 'General'
        };
      });
      const wsFaculty = XLSX.utils.json_to_sheet(facultyData);
      XLSX.utils.book_append_sheet(wb, wsFaculty, "Faculty ROI");

      // 4. Transactions Sheet
      const transData = allPayments.map(p => ({
        'Date': p.date || p.created_at || 'N/A',
        'Student ID': p.student_id,
        'Student Name': p.student_name || 'Unknown',
        'Amount': p.amount,
        'Method': p.method || 'Cash',
        'Description': p.description || 'Monthly Fee',
        'ID': p.id
      }));
      const wsTrans = XLSX.utils.json_to_sheet(transData);
      XLSX.utils.book_append_sheet(wb, wsTrans, "Transaction History");

      // 5. Attendance Sheet
      const attendanceData = (allAttendance || []).map(a => {
        const student = allStudents.find(s => String(s.id) === String(a.student_id));
        return {
          'Date': a.date || 'N/A',
          'Student Name': student ? getStudentName(student) : 'Unknown',
          'Status': a.status || 'N/A',
          'Batch': a.batch_id || 'N/A',
          'Coach ID': a.coach_id || 'N/A'
        };
      });
      const wsAtt = XLSX.utils.json_to_sheet(attendanceData);
      XLSX.utils.book_append_sheet(wb, wsAtt, "Attendance Logs");

      // 6. Achievements Sheet
      const achData = (achievementsData || []).map(a => {
        const student = allStudents.find(s => String(s.id) === String(a.student_id));
        return {
          'Date': a.date_achieved || 'N/A',
          'Student Name': student ? getStudentName(student) : 'Unknown',
          'Achievement': a.title || 'N/A',
          'Category': a.category || 'Tournament'
        };
      });
      const wsAch = XLSX.utils.json_to_sheet(achData);
      XLSX.utils.book_append_sheet(wb, wsAch, "Achievements Archive");

      // 7. Rating History Sheet
      const rateData = (allRatingHistory || []).map(r => {
        const student = allStudents.find(s => String(s.id) === String(r.student_id));
        return {
          'Date': r.recorded_at || 'N/A',
          'Student Name': student ? getStudentName(student) : 'Unknown',
          'Old ELO': r.old_rating || 0,
          'New ELO': r.new_rating || 0,
          'Gain': (r.new_rating || 0) - (r.old_rating || 0)
        };
      });
      const wsRate = XLSX.utils.json_to_sheet(rateData);
      XLSX.utils.book_append_sheet(wb, wsRate, "Rating Performance");

      // Export file
      XLSX.writeFile(wb, `Chesskidoo_Strategic_Archive_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast('Strategic Archive Exported Successfully!', 'success');

    } catch (err) {
      console.error('Export Error:', err);
      toast('Strategic Export Failed: System Error', 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // INIT & EXPOSE
  // ═══════════════════════════════════════════════════════════════
  // Role-based session timeouts (in milliseconds)
  const SESSION_TIMEOUTS = {
    'admin': 15 * 60 * 1000,   // 15 minutes for admin
    'master': null,             // No timeout for master
    'parent': 10 * 60 * 1000   // 10 minutes for parent
  };
  let sessionTimer = null;

  function resetSessionTimer() {
    if (sessionTimer) clearTimeout(sessionTimer);
    if (!role) return;

    // Master has no timeout
    if (role === 'master') return;

    const timeout = SESSION_TIMEOUTS[role];
    if (timeout) {
      sessionTimer = setTimeout(() => {
        toast('Session expired. Please login again.', 'error');
        doLogout();
      }, timeout);
    }
  }

  ['click', 'keypress', 'mousemove', 'scroll'].forEach(event => {
    document.addEventListener(event, resetSessionTimer, { passive: true });
  });

   window.addEventListener('DOMContentLoaded', () => {
     initUI(); // Setup UI event handlers

     const auth = localStorage.getItem('chesskidoo_auth');
     if (auth) {
       try {
         const data = JSON.parse(auth);
         role = data.role;
         finishLogin(data.user || 'User', data.role, data.studentId);
         resetSessionTimer();
       } catch (e) {
         localStorage.removeItem('chesskidoo_auth');
         $('login-screen').style.display = 'flex';
         document.body.classList.add('login-mode');
       }
     } else {
       $('login-screen').style.display = 'flex';
       document.body.classList.add('login-mode');
     }
   });

  // ═══════════════════════════════════════════════════════════════
  // EXPOSE GLOBALS TO WINDOW
  // ═══════════════════════════════════════════════════════════════
  window.$ = $;
  window.toast = toast;
  window.apiCall = apiCall;
  window.logAudit = logAudit;
  window.API_BASE = API_BASE;
  window.role = role;
  window.currentStudent = currentStudent;
  window.escapeHtml = escapeHtml;

  // Data Arrays
  window.allStudents = allStudents;
  window.allCoaches = allCoaches;
  window.allPayments = allPayments;
  window.allMessages = allMessages;
  window.allAttendance = allAttendance;
  window.allRatingHistory = allRatingHistory;
  window.allResources = allResources;
  // Helper Functions
  window.getStudentName = getStudentName;
  window.getStudentMonthlyFee = getStudentMonthlyFee;
  window.getStudentPaymentStatus = getStudentPaymentStatus;
  window.getStudentLevel = getStudentLevel;
  window.getStudentRating = getStudentRating;
  window.getStudentDate = getStudentDate;
  window.getStudentPhone = getStudentPhone;
  window.getStudentEmail = getStudentEmail;
  window.getStudentBatchType = getStudentBatchType;
  window.getStudentStatus = getStudentStatus;
  window.getCoachName = getCoachName;
  window.getCoachSalary = getCoachSalary;
  window.getCoachSpecialty = getCoachSpecialty;
  window.getCoachExperience = getCoachExperience;
  window.getCoachRating = getCoachRating;
  window.getCoachAvailability = getCoachAvailability;
  window.getCoachEmail = getCoachEmail;
  window.getCoachStatus = getCoachStatus;
  window.getEventDate = getEventDate;
  window.getEventType = getEventType;
  window.getEventLocation = getEventLocation;
  window.getEventTime = getEventTime;

  window.getStudentSessionTime = getStudentSessionTime;
  window.getMessagePriority = getMessagePriority;
  window.getMessageIsRead = getMessageIsRead;
  window.makeAvSrc = makeAvSrc;

  window.toggleTheme = toggleTheme;
  window.toggleSidebar = toggleSidebar;
  window.toggleEye = toggleEye;
  window.setPage = setPage;
  window.switchTab = setPage;

  window.finishLogin = finishLogin;
  window.openModal = openModal;
  window.closeModals = closeModals;
  window.openProfile = openProfile;
  window.clearNotifications = clearNotifications;
  window.clearFilters = clearFilters;
  window.renderStudents = renderStudents;
  window.viewStudent = viewStudent;
  window.openEdit = openEdit;
  window.updateStudent = updateStudent;
  window.openEnroll = openEnroll;
  window.saveStudent = saveStudent;
  window.deleteStudent = deleteStudent;
  window.renderCoachMgmt = renderCoachMgmt;
  window.viewCoachSchedule = viewCoachSchedule;
  window.openCoachModal = openCoachModal;
  window.saveCoach = saveCoach;
  window.deleteCoach = deleteCoach;
  window.renderEvents = renderEvents;
  window.openEventModal = openEventModal;
  window.saveEvent = saveEvent;
  window.deleteEvent = deleteEvent;
  window.editEvent = editEvent;
  window.archiveEvent = archiveEvent;
  window.confirmDeleteEvent = confirmDeleteEvent;
  window.renderFame = renderFame;
  window.openAwardModal = openAwardModal;
  window.onAwardStudentChange = onAwardStudentChange;
  window.saveAward = saveAward;
  window.deleteAchievement = deleteAchievement;
  window.editAchievement = editAchievement;
  window.confirmDeleteAchievement = confirmDeleteAchievement;
  window.renderBills = renderBills;
  window.markPaid = markPaid;
  window.markUnpaid = markUnpaid;
  window.bulkMarkPaid = bulkMarkPaid;
  window.openPay = openPay;
  window.initiatePay = initiatePay;
  window.downloadReceipt = downloadReceipt;
  window.showReceiptPreview = showReceiptPreview;
  window.printReceipt = printReceipt;
  window.renderMsgs = renderMsgs;
  window.markMsgRead = markMsgRead;
  window.deleteMsg = deleteMsg;
  window.renderChild = renderChild;
  window.setChildTab = setChildTab;
  window.renderChildEvents = renderChildEvents;
  window.renderChildBilling = renderChildBilling;
  window.renderChildGrowth = renderChildGrowth;
  window.renderChildResources = renderChildResources;
  window.renderChildSkills = renderChildSkills;
  window.renderChildAchievements = renderChildAchievements;
  window.openContactModal = openContactModal;
  window.sendMsg = sendMsg;
   window.sendFeedback = sendFeedback;
   window.informAllDueStudents = informAllDueStudents;
   window.viewPaymentHistory = viewPaymentHistory;
  window.openAttendanceMarking = openAttendanceMarking;
  window.saveBatchAttendance = saveBatchAttendance;
  window.updateAttStats = updateAttStats;
  window.markAllPresent = markAllPresent;
  window.markAllAbsent = markAllAbsent;
  window.toggleMoreMenu = toggleMoreMenu;
  window.openPromote = openPromote;
  window.executePromotion = executePromotion;
  function showNotifications() {
    const content = $('notification-content');
    if (!content) return;

    const unread = allMessages.filter(m => !getMessageIsRead(m) && m.receiver_type === 'admin' && !dismissedNotifications.messages.includes(m.id));
    const due = allStudents.filter(s => getStudentPaymentStatus(s) === 'Due' && !dismissedNotifications.payments.includes(s.id));
    const auditLogs = JSON.parse(localStorage.getItem('audit_logs') || '[]');
    const failedLogins = auditLogs.filter(l => l.action === 'login_failed').slice(-10).reverse();

     let html = '';

     if (unread.length > 0) {
       html += `<div style="padding:12px;background:var(--gold-glow);border-radius:8px;margin-bottom:12px">
         <div style="font-weight:600;color:var(--gold)">📬 Unread Messages (${unread.length})</div>
         ${unread.slice(0, 5).map(m => `<div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
           <div>
             <div style="font-size:13px;font-weight:500">${escapeHtml(m.subject || 'No Subject')}</div>
             <div style="font-size:11px;color:var(--ivory-dim)">${escapeHtml(m.sender_name || 'User')} • ${new Date(m.created_at).toLocaleDateString()}</div>
           </div>
           <button class="btn btn-outline-grey btn-sm" onclick="markMsgRead('${m.id}')" style="padding:2px 8px;font-size:10px">Mark Read</button>
         </div>`).join('')}
       </div>`;
     }

     if (due.length > 0) {
       html += `<div style="padding:12px;background:rgba(255,77,79,0.1);border-radius:8px;margin-bottom:12px">
         <div style="font-weight:600;color:var(--danger)">💰 Due Payments (${due.length})</div>
         <div style="font-size:12px;color:var(--ivory-dim)">Students with pending fees</div>
         ${due.slice(0, 5).map(s => `<div style="padding:6px 0;font-size:12px;color:var(--ivory)">${escapeHtml(getStudentName(s))}</div>`).join('')}
       </div>`;
     }

     if (failedLogins.length > 0) {
       html += `<div style="padding:12px;background:rgba(255,77,79,0.1);border-radius:8px;margin-bottom:12px">
         <div style="font-weight:600;color:var(--danger)">🚫 Failed Logins (${failedLogins.length})</div>
         ${failedLogins.slice(0, 5).map(l => `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
           <span>${escapeHtml(l.user || 'Unknown')}</span>
           <span style="color:var(--ivory-dim);float:right">${new Date(l.timestamp).toLocaleString('en-IN')}</span>
         </div>`).join('')}
       </div>`;
     }

    if (!html) {
      html = '<div style="text-align:center;padding:30px;color:var(--ivory-dim)">No new notifications</div>';
    }

    content.innerHTML = `
      <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0">System Notifications</h3>
        <button class="btn btn-outline btn-sm" onclick="clearNotifications()">🗑️ Clear All</button>
      </div>
      ${html}
    `;
    openModal('notification-modal');
  }

  window.sendPaymentReminder = sendPaymentReminder;
  window.showNotifications = showNotifications;
  window.updateNotificationBadge = () => { try { updateNotificationBadge(); } catch (e) { } };
  window.previewFile = previewFile;
  window.executeDelete = executeDelete;
  window.exportAcademyData = exportAcademyData;
  window.exportData = exportData;
  window.registerForEvent = registerForEvent;
  window.setBillTab = setBillTab;
  window.markCoachPaid = markCoachPaid;
  window.markCoachUnpaid = markCoachUnpaid;
  window.getStudentPaymentStatus = getStudentPaymentStatus;
  window.getStudentMonthlyFee = getStudentMonthlyFee;
})();
