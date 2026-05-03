/**
 * CHESSKIDOO AUTOMATION ENGINE v3.0
 */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://vseombfkrvpffnpgbsnk.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8';

  function $ (id) { return document.getElementById(id); }

  function toast (msg, type = 'info') {
    if (window.toast) window.toast(msg, type);
    else console.log('[Automation]', type.toUpperCase(), msg);
  }

  async function rpc (fn, params = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`
      },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `RPC ${fn} failed: ${res.status}`);
    }
    return res.json();
  }

  function checkMorningRollover () {
    const role = window.role;
    if (role !== 'admin' && role !== 'master') return;

    const today = new Date();
    const monthKey = `${today.getFullYear()}-${today.getMonth()}`;
    const lastShown = localStorage.getItem('automation_morning_shown');
    if (lastShown === monthKey) return;
    if (today.getDate() > 5) return;

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
        <button onclick="document.getElementById('morning-action-panel').remove()"
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

  async function loadMorningSummary () {
    const el = document.getElementById('morning-summary');
    if (!el) return;
    try {
      const today = new Date();
      const data = await rpc('get_cycle_summary', {
        p_year: today.getFullYear(),
        p_month1: today.getMonth() + 1,
        p_month2: today.getMonth() + 1
      });
      if (!data || !data.length) {
        el.innerHTML = '<span style="color:#7a7870">No data yet — run classification first.</span>';
        return;
      }
      const rows = data.map(r =>
        `<div style="display:flex;justify-content:space-between">
          <span style="color:${r.status==='Paid'?'#52c41a':r.status==='Due'?'#ff4d4f':'#e8a830'}">${r.status}</span>
          <span style="color:#f0ede4;font-weight:700">${r.count} students (₹${(r.total_revenue||0).toLocaleString()})</span>
        </div>`
      ).join('');
      el.innerHTML = rows || '<span style="color:#7a7870">No data</span>';
    } catch (e) {
      el.innerHTML = `<span style="color:#ff4d4f">Error: ${e.message}</span>`;
    }
  }

  window.automationRunRollover = async function () {
    const btn = document.getElementById('btn-run-rollover');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Running…'; }
    try {
      const today = new Date();
      const result = await rpc('update_payment_status', {
        p_year:   today.getFullYear(),
        p_month1: today.getMonth() + 1,
        p_month2: today.getMonth() + 2 > 12 ? 1 : today.getMonth() + 2
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

    const coachMap = {};
    allStudents.forEach(s => {
      const status = window.getStudentPaymentStatus ? window.getStudentPaymentStatus(s) : s.payment_status;
      if (status !== 'Due' && status !== 'Pending') return;
      const cid = s.coach_id;
      if (!cid) return;
      if (!coachMap[cid]) coachMap[cid] = { due: [], pending: [] };
      if (status === 'Due') coachMap[cid].due.push(s);
      else coachMap[cid].pending.push(s);
    });

    const coachIds = Object.keys(coachMap);
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
        localStorage.setItem('automation_morning_shown', `${today.getFullYear()}-${today.getMonth()}`);
        setTimeout(() => { if (panel) panel.remove(); }, 2000);
        return;
      }

      const cid    = coachIds[count];
      const coach  = allCoaches.find(c => String(c.id) === String(cid));
      if (!coach) { count++; processNext(); return; }

      const phone = (coach.phone || '').replace(/\D/g, '');
      if (!phone || phone.length < 10) { count++; processNext(); return; }

      const data   = coachMap[cid];
      const getName = s => (s.full_name || s.name || 'Unknown');

      let msg = `*CHESSKIDOO ACADEMY — FEE ALERT 🎓*\n\n`;
      msg += `Hello Coach *${coach.name || 'Coach'}*, this is the fee status for *${monthName}*:\n\n`;

      if (data.due.length > 0) {
        msg += `⚠️ *ARREARS (Previous Month Unpaid):*\n`;
        data.due.forEach(s => { msg += `  • ${getName(s)}\n`; });
        msg += '\n';
      }
      if (data.pending.length > 0) {
        msg += `⏳ *PENDING (Current Month):*\n`;
        data.pending.forEach(s => { msg += `  • ${getName(s)}\n`; });
        msg += '\n';
      }

      msg += `Please follow up with the guardians at the earliest.\n\n_Thank you — Chesskidoo Admin_`;
      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');

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

  async function refreshDashboardFromSupabase (year, month) {
    try {
      const data = await rpc('get_cycle_summary', {
        p_year: year, p_month1: month, p_month2: month
      });
      if (!data || !data.length) return;

      const summary = { Paid: 0, Pending: 0, Due: 0 };
      let collected = 0, potential = 0;

      data.forEach(row => {
        summary[row.status] = Number(row.count) || 0;
        if (row.status === 'Paid') collected += Number(row.total_revenue) || 0;
        potential += Number(row.total_revenue) || 0;
      });

      const setEl = (id, val) => { const el = $(id); if (el) el.textContent = val; };
      setEl('s-rev',            '₹' + collected.toLocaleString());
      setEl('s-total-revenue',  '₹' + potential.toLocaleString());
      setEl('s-last-due',       '₹' + ((summary.Due || 0) * getAvgFee()).toLocaleString());
      setEl('s-curr-pending',   '₹' + ((summary.Pending || 0) * getAvgFee()).toLocaleString());

      if (window.chartInstances && window.chartInstances.payment) {
        const chart = window.chartInstances.payment;
        chart.data.datasets[0].data = [summary.Paid, summary.Pending, summary.Due];
        chart.update('active');
      }
    } catch (e) {
      console.warn('[Automation] Refresh failed:', e.message);
    }
  }

  function getAvgFee () {
    const students = window.allStudents || [];
    if (!students.length) return 5000;
    const total = students.reduce((a, s) => a + (parseInt(s.monthly_fee || s.fee) || 0), 0);
    return Math.round(total / students.length) || 5000;
  }

  const _origUpdateContext = window.updateReportContext;
  window.updateReportContext = function () {
    if (_origUpdateContext) _origUpdateContext();
    const year  = window.reportYear  || new Date().getFullYear();
    const month = (window.reportMonth !== undefined ? window.reportMonth : new Date().getMonth()) + 1;
    refreshDashboardFromSupabase(year, month);
  };

  const _origMarkPaid = window.markPaid;
  window.markPaid = async function (id, amount, method, desc) {
    if (_origMarkPaid) await _origMarkPaid(id, amount, method, desc);

    const s = (window.allStudents || []).find(x => String(x.id) === String(id));
    if (!s) return;

    const name     = (s.full_name || s.name || 'Student');
    const phone    = (s.parent_phone || s.phone || '').replace(/\D/g, '');
    const fee      = amount || s.monthly_fee || 5000;
    const today    = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    const coachObj = (window.allCoaches || []).find(c => String(c.id) === String(s.coach_id));
    const coachName = coachObj ? (coachObj.name || 'Coach') : 'Coach';

    const receiptUrl = `${window.location.origin}/receipt.html?id=${id}&name=${encodeURIComponent(name)}&amount=${fee}&date=${new Date().toISOString()}&level=${encodeURIComponent(s.grade || s.level || 'Beginner')}&coach=${encodeURIComponent(coachName)}`;

    const waMsg = `Hello Sir/Madam 🙏\n\n*CHESSKIDOO ACADEMY — Payment Confirmation*\n\nStudent: *${name}*\nAmount Paid: *₹${Number(fee).toLocaleString()}*\nDate: ${today}\n\n📄 Download Receipt:\n${receiptUrl}\n\nThank you — Chesskidoo Academy`;

    if (phone && phone.length >= 10) {
      setTimeout(() => {
        if (confirm(`✅ Payment logged! Send WhatsApp receipt to parent of ${name}?`)) {
          window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(waMsg)}`, '_blank');
        }
      }, 500);
    }
  };

  let autoRefreshTimer = null;
  function startAutoRefresh () {
    if (autoRefreshTimer) return;
    autoRefreshTimer = setInterval(() => {
      const dashPage = $('page-dash');
      if (!dashPage || !dashPage.classList.contains('active')) return;
      const year  = window.reportYear  || new Date().getFullYear();
      const month = (window.reportMonth !== undefined ? window.reportMonth : new Date().getMonth()) + 1;
      refreshDashboardFromSupabase(year, month);
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
