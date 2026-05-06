/**
 * CHESSKIDOO AUTOMATION ENGINE v3.0
 */

(function () {
  'use strict';

  const APP_CONFIG = window.APP_CONFIG || {};
  const SUPABASE_URL = APP_CONFIG.SUPABASE_URL || '';
  const SUPABASE_ANON = APP_CONFIG.SUPABASE_ANON_KEY || '';
  function $ (id) { return document.getElementById(id); }

  const EMOJI = window.EMOJI || {
    warning: "⚠️",
    siren: "🚨",
    wave: "👋",
    card: "💳",
    alert: "❗",
    clock: "⏰",
    prohibited: "🚫",
    check: "✅",
    phone: "📞",
    pray: "🙏",
    grad: "🎓",
    sparkle: "✨",
    chart: "📊",
    teacher: "👨‍🏫",
    calendar: "📅",
    pending: "⏳",
    handshake: "🤝",
    spiral_calendar: "🗓️",
    memo: "📝",
    trophy: "🏆",
    star: "⭐",
    crown: "👑",
    receipt: "🧾",
    cash: "💵",
    party: "🎉",
    tear_calendar: "📆",
    link: "🔗"
  };

  function toast (msg, type = 'info') {
    if (window.toast) window.toast(msg, type);
    else console.log('[Automation]', type.toUpperCase(), msg);
  }

  function cleanText (t) {
    if (!t) return '';
    // Strip HTML tags but preserve all Unicode characters (Tamil, Arabic, etc.)
    return t.toString().replace(/<[^>]*>?/gm, '').trim();
  }

  async function rpc (fn, params = {}) {
    // SECURITY: Use proxy if available, fallback to direct but wrap in try/catch
    const url = `/api/rpc/${fn}`; // Prefer proxied route
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!res.ok) throw new Error(`RPC ${fn} failed`);
      return res.json();
    } catch (e) {
      console.warn(`[Automation] RPC ${fn} fallback-bypass:`, e.message);
      return null;
    }
  }

  function checkMorningRollover () {
    const role = window.role;
    if (role !== 'admin' && role !== 'master') return;

    const today = new Date();
    const monthKey = `${today.getUTCFullYear()}-${today.getUTCMonth()}`;
    const lastShown = localStorage.getItem('automation_morning_shown');
    if (lastShown === monthKey) return;
    if (today.getDate() !== 1) return;

    const panel = document.createElement('div');
    panel.id = 'morning-action-panel';
    panel.style.cssText = `
      position:fixed; top:80px; right:20px; z-index:8000;
      background:#181824; border:2px solid #dca33e;
      border-radius:16px; padding:24px; max-width:340px;
      box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 30px rgba(220,163,62,0.2);
      font-family:'Syne',sans-serif;
      animation:slideInRight 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;
    `;
    panel.innerHTML = `
      <style>
        @keyframes slideInRight {
          from { opacity:0; transform:translateX(50px); }
          to   { opacity:1; transform:translateX(0); }
        }
      </style>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="color:#dca33e;font-size:18px;font-weight:700">🔄 New Billing Month!</div>
        <button onclick="localStorage.setItem('automation_morning_shown','${monthKey}');document.getElementById('morning-action-panel').remove()"
          style="background:none;border:none;color:#7a7870;font-size:20px;cursor:pointer">✕</button>
      </div>
      <p style="color:#c8c4b8;font-size:13px;line-height:1.6;margin-bottom:16px">
        The database has automatically updated payment statuses. 
        Ready to notify coaches about pending/due fees?
      </p>
      <div id="morning-summary" style="background:#0e0e1a;padding:12px;border-radius:8px;margin-bottom:16px;font-size:12px;color:#7a7870">
        Loading status summary…
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button onclick="window.automationInformAllCoaches()" id="btn-inform-coaches"
          style="background:linear-gradient(135deg,#dca33e,#f0c05a);color:#000;border:none;
                 padding:12px;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px">
          📢 Inform All Coaches via WhatsApp
        </button>
        <button onclick="window.automationRunRollover()" id="btn-run-rollover"
          style="background:transparent;border:1px solid #dca33e;color:#dca33e;
                 padding:10px;border-radius:8px;cursor:pointer;font-size:13px">
          🔄 Re-run Status Classification Now
        </button>
        <button onclick="localStorage.setItem('automation_morning_shown','${monthKey}');document.getElementById('morning-action-panel').remove()"
          style="background:transparent;border:1px solid #555;color:#7a7870;
                 padding:8px;border-radius:8px;cursor:pointer;font-size:12px">
          Dismiss for this month
        </button>
      </div>
    `;
    document.body.appendChild(panel);
    loadMorningSummary();
  }

  function loadMorningSummary () {
    const el = document.getElementById('morning-summary');
    if (!el) return;
    
    const students = window.allStudents || [];
    if (students.length === 0) {
      el.innerHTML = '<span style="color:#7a7870">Waiting for data synchronization…</span>';
      return;
    }

    const summary = { Paid: 0, Pending: 0, Due: 0 };
    let revenue = { Paid: 0, Pending: 0, Due: 0 };

    students.forEach(s => {
      const status = window.getStudentPaymentStatus ? window.getStudentPaymentStatus(s) : 'Pending';
      const fee = parseInt(s.monthly_fee || s.fee) || 0;
      if (summary[status] !== undefined) {
        summary[status]++;
        revenue[status] += fee;
      }
    });

    const rows = Object.entries(summary).map(([status, count]) =>
      `<div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="color:${status==='Paid'?'#52c41a':status==='Due'?'#ff4d4f':'#e8a830'}">${status}</span>
        <span style="color:#f0ede4;font-weight:700">${count} students (₹${revenue[status].toLocaleString()})</span>
      </div>`
    ).join('');

    el.innerHTML = rows || '<span style="color:#7a7870">No data available.</span>';
  }

  window.automationRunRollover = async function () {
    const btn = document.getElementById('btn-run-rollover');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Running…'; }
    try {
      const today = new Date();
      const result = await rpc('update_payment_status', {
        p_year:   today.getUTCFullYear(),
        p_month1: today.getUTCMonth() + 1,
        p_month2: today.getUTCMonth() + 2 > 12 ? 1 : today.getUTCMonth() + 2
      });
      toast(`✅ Classified: Paid=${result.paid}, Pending=${result.pending}, Due=${result.due}`, 'success');
      loadMorningSummary();
      if (window.loadAllData) window.loadAllData(true);
    } catch (e) {
      toast('Classification failed: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Re-run Status Classification Now'; }
    }
  };

  window.automationInformAllCoaches = async function () {
    const panel = document.getElementById('morning-action-panel');
    if (panel) panel.style.opacity = '0.6';

    const allStudents = window.allStudents || [];
    const allCoaches  = window.allCoaches  || [];
    const today       = new Date();
    const monthName   = today.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    // Get students with their due dates for proper sorting
    const coachStudentsWithDates = {};
    
    allStudents.forEach(s => {
      const status = window.getStudentPaymentStatus ? window.getStudentPaymentStatus(s) : s.payment_status;
      if (status !== 'Due' && status !== 'Pending' && status !== 'Overdue') return;

      const targetMonth = today.getUTCMonth();
      const targetYear = today.getUTCFullYear();
      
      if (status === 'Pending') {
        let daysLeft = 99;
        if (window.getStudentDueConfig) {
          const coach = allCoaches.find(c => String(c.id) === String(s.coach_id));
          const dueCfg = window.getStudentDueConfig(s, coach ? (coach.name || '') : '', targetMonth, targetYear);
          const dueDateObj = new Date(targetYear, targetMonth, dueCfg.day, 23, 59, 59);
          const diffTime = dueDateObj.getTime() - today.getTime();
          daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        if (daysLeft > 5) return;
      }

      const cid = s.coach_id;
      if (!cid) return;
      
      if (!coachStudentsWithDates[cid]) coachStudentsWithDates[cid] = [];
      
      let dueDay = 5;
      if (window.getStudentDueConfig) {
        const coach = allCoaches.find(c => String(c.id) === String(s.coach_id));
        const dueCfg = window.getStudentDueConfig(s, coach ? (coach.name || '') : '', targetMonth, targetYear);
        dueDay = dueCfg.day;
      }
      coachStudentsWithDates[cid].push({ student: s, status, dueDay });
    });

    // Sort students in each coach's list: Overdue/Due first (by due date), then Pending (by due date)
    Object.keys(coachStudentsWithDates).forEach(cid => {
      coachStudentsWithDates[cid].sort((a, b) => {
        // Status priority: Overdue (0) > Due (1) > Pending (2)
        const statusOrder = { 'Overdue': 0, 'Due': 1, 'Pending': 2 };
        const aOrder = statusOrder[a.status];
        const bOrder = statusOrder[b.status];
        
        if (aOrder !== bOrder) return aOrder - bOrder;
        
        // Same status - sort by due date (smaller day = closer date)
        return a.dueDay - b.dueDay;
      });
    });

    const coachIds = Object.keys(coachStudentsWithDates);
    if (coachIds.length === 0) {
      toast('✅ No coaches have pending/due students!', 'success');
      if (panel) panel.style.opacity = '1';
      return;
    }

    if (!confirm(`Found ${coachIds.length} coaches with pending/due students. Open WhatsApp tabs?`)) {
      if (panel) panel.style.opacity = '1';
      return;
    }

    let count = 0;
    const processNext = () => {
      if (count >= coachIds.length) {
        toast(`✅ Informed ${coachIds.length} coaches!`, 'success');
        if (panel) panel.style.opacity = '1';
        localStorage.setItem('automation_morning_shown', `${today.getUTCFullYear()}-${today.getUTCMonth()}`);
        setTimeout(() => { if (panel) panel.remove(); }, 2000);
        return;
      }

      const cid    = coachIds[count];
      const coach  = allCoaches.find(c => String(c.id) === String(cid));
      if (!coach) { count++; processNext(); return; }

      const phone = (coach.phone || '').replace(/\D/g, '');
      if (!phone || phone.length < 10) { count++; processNext(); return; }

      const studentData = coachStudentsWithDates[cid];
      const getName = s => cleanText(s.full_name || s.name || 'Unknown');

      const targetMonth = today.getUTCMonth();
      const targetYear = today.getUTCFullYear();
      const dateStr = today.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      // Determine min due day among pending students to use as deadline
      let minDueDay = 10;
      if (studentData.length > 0) {
        minDueDay = Math.min(...studentData.map(item => item.dueDay));
      }

      const getOrdinal = (n) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };
      const lastDateToPayStr = `${getOrdinal(minDueDay)} ${dateStr}`;

      let msg = `${EMOJI.warning} *CHESSKIDOO ACADEMY – FEE AUDIT REPORT* ${EMOJI.chart}\n\n`;
      msg += `Hello Coach ${cleanText(coach.name || 'Coach').toUpperCase()} ${EMOJI.teacher},\n\n`;
      msg += `The following students under your mentorship have an outstanding balance for the *${dateStr}* billing cycle ${EMOJI.calendar}:\n\n`;

       const studentLines = [];
       studentData.forEach(({ student: s, status, dueDay }) => {
         // Due and Overdue both show as ARREARS
         const label = (status === 'Due' || status === 'Overdue') ? `${EMOJI.siren} ARREARS` : `${EMOJI.pending} PENDING`;
         const sName = cleanText(getName(s).toUpperCase());
         const dueDateStr = `${getOrdinal(dueDay)} ${today.toLocaleDateString('en-IN', { month: 'long' })} ${targetYear}`;
         studentLines.push(`${EMOJI.alert} *${sName}* — ${label} (Due: ${dueDateStr})`);
       });
      msg += studentLines.join('\n') + '\n\n';

      msg += `Please coordinate with the guardians to ensure these balances are settled ${EMOJI.handshake}.\n`;
      msg += `*Last Date to Pay:* ${lastDateToPayStr} ${EMOJI.spiral_calendar}\n\n`;
      msg += `${EMOJI.memo} *Note:*\n\n`;
      msg += `${EMOJI.siren} *ARREARS* = Unpaid fees from previous months\n`;
      msg += `${EMOJI.pending} *PENDING* = Current month's unpaid fee\n\n`;
      msg += `Regards,\n`;
      msg += `*Administrative Team* | Chesskidoo Academy ${EMOJI.trophy}${EMOJI.sparkle}`;

            const parsed = window.parseStoredPhone ? window.parseStoredPhone(phone) : { countryCode: 'IN', localNumber: phone };
      const inferredCountry = (parsed.countryCode && parsed.countryCode !== 'IN') ? parsed.countryCode : (coach.country_code || 'IN');
      const cCountry = inferredCountry;
      const country = window.getCountryByCode ? window.getCountryByCode(cCountry) : { dial: '+91' };
      const dialCode = country.dial.replace(/\D/g, '');
      window.open(`https://wa.me/${dialCode}${parsed.localNumber}?text=${encodeURIComponent(msg)}`, '_blank');

      count++;
      setTimeout(() => {
        if (count < coachIds.length && confirm(`WhatsApp opened for Coach ${coach.name}. Continue to next?`)) {
          processNext();
        } else if (count >= coachIds.length) {
          processNext();
        } else {
          if (panel) panel.style.opacity = '1';
        }
      }, 500);
    };
    processNext();
  };


  function getAvgFee () {
    const students = window.allStudents || [];
    if (!students.length) return 5000;
    const total = students.reduce((a, s) => a + (parseInt(s.monthly_fee || s.fee) || 0), 0);
    return Math.round(total / students.length) || 5000;
  }

  const _origUpdateContext = window.updateReportContext;
  window.updateReportContext = function () {
    if (_origUpdateContext) _origUpdateContext();
    if (window.renderDash) window.renderDash();
  };

  const _origMarkPaid = window.markPaid;
  window.markPaid = async function (id, amount, method, desc) {
    if (_origMarkPaid) await _origMarkPaid(id, amount, method, desc);

    const s = (window.allStudents || []).find(x => String(x.id) === String(id));
    if (!s) return;

    const name      = (s.full_name || s.name || 'Student');
    const phone     = (s.parent_phone || s.phone || '').replace(/\D/g, '');
    const fee       = amount || s.monthly_fee || 5000;
    const today     = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    const coachObj  = (window.allCoaches || []).find(c => String(c.id) === String(s.coach_id));
    const coachName = coachObj ? (coachObj.name || 'Coach') : 'Coach';

    const cleanName = cleanText(name);
    const cleanLevel = cleanText(s.grade || s.level || 'Beginner');
    const cleanCoach = cleanText(coachName);

    const receiptUrl = `${window.location.origin}/receipt.html?id=${id}&name=${encodeURIComponent(cleanName)}&amount=${fee}&date=${new Date().toISOString()}&level=${encodeURIComponent(cleanLevel)}&coach=${encodeURIComponent(cleanCoach)}`;

    const waMsg = `${EMOJI.check} *CHESSKIDOO ACADEMY - PAYMENT CONFIRMATION*\n\nStudent: ${cleanName}\nAmount Paid: INR ${Number(fee).toLocaleString()}\nDate: ${cleanText(today)}\n\nDownload Official Receipt:\n${receiptUrl}\n\nThank you for choosing Chesskidoo Academy.`;

        const parsed = window.parseStoredPhone ? window.parseStoredPhone(phone) : { countryCode: 'IN', localNumber: phone };
    if (parsed.localNumber) {
      setTimeout(() => {
        const inferredCountry = (parsed.countryCode && parsed.countryCode !== 'IN') ? parsed.countryCode : (s.country_code || 'IN');
        const sCountry = inferredCountry;
        const country = window.getCountryByCode ? window.getCountryByCode(sCountry) : { dial: '+91' };
        const dialCode = country.dial.replace(/\D/g, '');
        window.open(`https://wa.me/${dialCode}${parsed.localNumber}?text=${encodeURIComponent(waMsg)}`, '_blank');
      }, 500);
    }
  };

  let autoRefreshTimer = null;
  function startAutoRefresh () {
    if (autoRefreshTimer) return;
    autoRefreshTimer = setInterval(() => {
      const dashPage = $('page-dash');
      if (!dashPage || !dashPage.classList.contains('active')) return;
      if (window.loadAllData) window.loadAllData(true);
    }, 60000);
  }

  const _origFinishLogin = window.finishLogin;
  window.finishLogin = function (displayName, userRole, studentId) {
    if (_origFinishLogin) _origFinishLogin(displayName, userRole, studentId);
    if (userRole === 'admin' || userRole === 'master') {
      setTimeout(checkMorningRollover, 2000);
      startAutoRefresh();
    }
  };

  const auth = localStorage.getItem('chesskidoo_auth');
  if (auth) {
    try {
      const data = JSON.parse(auth);
      if (data.role === 'admin' || data.role === 'master') {
        setTimeout(checkMorningRollover, 3000);
        startAutoRefresh();
      }
    } catch (_) {}
  }

  console.log('[Chesskidoo Automation v3.0] Active.');
})();
