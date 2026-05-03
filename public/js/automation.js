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

      let msg = `CHESSKIDOO ACADEMY - FEE AUDIT REPORT\n\n`;
      msg += `Hello Coach ${coach.name || 'Coach'},\n\n`;
      msg += `The following student under your mentorship has an outstanding balance for the ${monthName} billing cycle:\n\n`;

      const studentLines = [];
      if (data.due.length > 0) {
        data.due.forEach(s => { studentLines.push(`${getName(s)} (Arrears)`); });
      }
      if (data.pending.length > 0) {
        data.pending.forEach(s => { studentLines.push(`${getName(s)} (Pending)`); });
      }
      msg += studentLines.join(', ') + '\n\n';

      msg += `Please coordinate with the guardians to ensure this balance is settled.\n`;
      msg += `Note: Arrears indicates unpaid fees from previous months, while Pending refers to the current cycle.\n\n`;
      msg += `Regards,\nAdministrative Team | Chesskidoo Academy`;
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

    const name     = (s.full_name || s.name || 'Student');
    const phone    = (s.parent_phone || s.phone || '').replace(/\D/g, '');
    const fee      = amount || s.monthly_fee || 5000;
    const today    = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    const coachObj = (window.allCoaches || []).find(c => String(c.id) === String(s.coach_id));
    const coachName = coachObj ? (coachObj.name || 'Coach') : 'Coach';

    const receiptUrl = `${window.location.origin}/receipt.html?id=${id}&name=${encodeURIComponent(name)}&amount=${fee}&date=${new Date().toISOString()}&level=${encodeURIComponent(s.grade || s.level || 'Beginner')}&coach=${encodeURIComponent(coachName)}`;

    const waMsg = `CHESSKIDOO ACADEMY - PAYMENT CONFIRMATION\n\nStudent: ${name}\nAmount Paid: INR ${Number(fee).toLocaleString()}\nDate: ${today}\n\nDownload Official Receipt:\n${receiptUrl}\n\nThank you for choosing Chesskidoo Academy.`;

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
      if (window.renderDash) window.renderDash();
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
