/**
 * Two Knights Executive Reporting Module
 * Handles boardroom-ready analytics and PDF generation.
 */

window.generateReportPDF = async function() {
    const allStudents = window.allStudents || [];
    const allCoaches = window.allCoaches || [];
    const allPayments = window.allPayments || [];
    const allAttendance = window.allAttendance || [];

    const getStudentPaymentStatus = window.getStudentPaymentStatus;
    const getCoachSalary = window.getCoachSalary;
    const getCoachName = window.getCoachName;
    const getStudentBatchType = window.getStudentBatchType;
    const getStudentSessionTime = window.getStudentSessionTime;
    const getStudentName = window.getStudentName;
    const getStudentLevel = window.getStudentLevel;
    const getStudentRating = window.getStudentRating;
    const getStudentDate = window.getStudentDate;
    const getStudentStatus = window.getStudentStatus;
    const getStudentMonthlyFee = window.getStudentMonthlyFee;

    if (allStudents.length === 0) {
        toast('Academy data not yet synchronized. Please wait a moment...', 'warning');
        return;
    }

    // FIX: fall back to current month/year if not set so the report doesn't break with
    // "Invalid Date" when called before the dashboard picker has initialized the globals.
    const _today = new Date();
    const targetMonth = Number.isFinite(window.reportMonth) ? window.reportMonth : _today.getUTCMonth();
    const targetYear  = Number.isFinite(window.reportYear)  ? window.reportYear  : _today.getUTCFullYear();
    const now = new Date(targetYear, targetMonth, 1);
    // FIX: use a stable "generated_at" snapshot so the timestamp shown in the report header
    // and the footer audit trail match each other (they used to drift across re-renders).
    const generatedAt = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const timeStr = generatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const fullStamp = generatedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });
    toast(`Generating Financial Report for ${dateStr}...`, 'info');

    // Helper for robust date matching (Consolidated)
    const getYM = (d) => {
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? null : `${dt.getUTCFullYear()}-${dt.getUTCMonth()}`;
    };
    const targetYM = `${targetYear}-${targetMonth}`;

     // 1. Data Aggregation (Filtered by Period)
     const monthEndLimit = new Date(Date.UTC(targetYear, targetMonth + 1, 0)); // last day of month at 00:00 UTC
     const baseline = new Date(Date.UTC(2026, 3, 1, 0, 0, 0)); // April 1st Baseline (UTC)
     
     const targetStudents = allStudents.filter(s => {
          const sStatus = getStudentStatus(s);
          if (sStatus === 'archived' || sStatus === 'pending' || sStatus === 'waitlist' || sStatus === 'inactive') return false;
          
          const sName = (getStudentName(s) || '').toUpperCase();
          if (sName.includes('PARENT') || sName.includes('COACH') || sName.includes('TEST')) return false;
          
          const joinStr = getStudentDate(s);
          let enrollDate = joinStr ? new Date(joinStr) : baseline;
          if (isNaN(enrollDate.getTime())) enrollDate = baseline;
          return enrollDate <= monthEndLimit;
     });

    const totalStudents = allStudents.length;
    const activeStudents = targetStudents.length;

    // Map total payments per student up to target month end (advance-aware)
    // Uses applied_month metadata when present; falls back to billing anchor + payment date.
    const targetMonthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59));
    const totalPaymentsMap = {};
    const seenApplied = new Set();
    allPayments.forEach(p => {
      if (p.status !== 'paid') return;
      const sid = String(p.student_id || '').trim().toLowerCase();
      if (!sid) return;

      // Primary: applied_month metadata (set by debt-first engine)
      if (p.applied_month && String(p.applied_month).trim()) {
        const key = `${sid}_${p.applied_month}`;
        if (seenApplied.has(key)) return;
        seenApplied.add(key);
        totalPaymentsMap[sid] = (totalPaymentsMap[sid] || 0) + 1;
        return;
      }

      // Fallback: legacy calendar-month counting for old payment records
      const pDate = new Date(p.payment_date || p.created_at);
      const mKey = `${sid}_${pDate.getUTCFullYear()}-${String(pDate.getUTCMonth() + 1).padStart(2, '0')}`;
      if (seenApplied.has(mKey)) return;
      seenApplied.add(mKey);
      totalPaymentsMap[sid] = (totalPaymentsMap[sid] || 0) + 1;
    });

    // Helper function to match dashboard slot-based revenue calculation
    function calculateSlotRevenue(year, month) {
      if (!allPayments) return 0;
      const seenStuds = new Set();
      return allPayments.reduce((sum, p) => {
        const pDate = new Date(p.payment_date || p.created_at);
        if (pDate.getUTCMonth() === month && pDate.getUTCFullYear() === year && p.status === 'paid') {
          const sid = String(p.student_id).toLowerCase();
          if (seenStuds.has(sid)) return sum;
          
          const s = allStudents.find(x => String(x.id).toLowerCase() === sid);
          if (s) {
            if (getStudentPaymentStatus(s, month, year) === 'Paid') {
              seenStuds.add(sid);
              return sum + getStudentMonthlyFee(s);
            }
          }
        }
        return sum;
      }, 0);
    }

    // Sum actual cash collected matching the dashboard's s-rev calculation
    const collected = (window.cycleRevenue ? window.cycleRevenue(targetYear, targetMonth) : calculateSlotRevenue(targetYear, targetMonth));
    const monthlyPayments = allPayments.filter(p => getYM(p.payment_date || p.created_at) === targetYM && p.status === 'paid');

    let lastDueAmount = 0;
    let currPendingAmount = 0;
    let potential = 0;

    targetStudents.forEach(s => {
        const fee = getStudentMonthlyFee(s) || 0;
        const enrollDateStr = getStudentDate(s);
        let enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
        if (isNaN(enrollDate.getTime())) {
            enrollDate = baseline;
        }
        // Billing anchor applies the late-join grace rule for consistency with
        // the registry status (a late-month join's first billed month is next month).
        const _anchor = window.getBillingAnchor ? window.getBillingAnchor(s, baseline)
          : { year: (enrollDate < baseline ? baseline : enrollDate).getUTCFullYear(), month: (enrollDate < baseline ? baseline : enrollDate).getUTCMonth() };
        const monthsRequired = ((targetYear - _anchor.year) * 12) + (targetMonth - _anchor.month) + 1;
        const s_id_key = String(s.id || '').trim().toLowerCase();
        const totalCredits = totalPaymentsMap[s_id_key] || 0;

        potential += fee;
        const totalMonthsUnpaid = Math.max(0, monthsRequired - totalCredits);
        if (totalMonthsUnpaid > 0) {
            const isPaidThisMonth = (getStudentPaymentStatus(s, targetMonth, targetYear) === 'Paid');
            const histMonths = totalMonthsUnpaid - (isPaidThisMonth ? 0 : 1);
            
            if (histMonths > 0) lastDueAmount += (fee * histMonths);
            if (!isPaidThisMonth) currPendingAmount += fee;
        }
    });

    // Removed strict synchronization to show the true sum of unpaid fees for students
    // instead of netting overpayments against unpaid fees.
    const payroll = allCoaches.filter(c => c.status !== 'archived').reduce((a, c) => a + (getCoachSalary(c) || 0), 0);
    
    // Fetch real-time expenditures for the reporting month
    const monthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
    let totalExp = 0;
    try {
        const res = await (window.apiCall || fetch)(`/api/expenditures?mode=summary&month=${monthStr}`);
        if (res.ok) {
            const summary = await res.json();
            totalExp = parseFloat(summary.total_expense || 0);
        }
    } catch (e) {
        console.error("Failed to fetch expenditures for report", e);
    }
    
    const netProfit = collected - payroll - totalExp;
    
    // Simple Executive Metrics
    const arpu = activeStudents > 0 ? (collected / activeStudents).toFixed(0) : 0;
    const collectionRate = potential > 0 ? ((collected / potential) * 100).toFixed(1) : 0;
    const opMargin = collected > 0 ? ((netProfit / collected) * 100).toFixed(1) : 0;
    
    // Growth & Attendance Metrics
    const monthStartLimit = new Date(Date.UTC(targetYear, targetMonth, 1));
    const newStudsThisMonth = allStudents.filter(s => {
        const joinStr = s.joining_date || s.enrollment_date || s.created_at;
        let join = joinStr ? new Date(joinStr) : baseline;
        if (isNaN(join.getTime())) join = baseline;
        return join >= monthStartLimit && join <= monthEndLimit;
    }).length;
    
    // Attendance Real-Time (Calculated from allAttendance for target period)
    const monthAtt = (window.allAttendance || []).filter(a => {
        const aDate = new Date(a.date);
        return aDate.getUTCMonth() === targetMonth && aDate.getUTCFullYear() === targetYear;
    });
    const presentCount = monthAtt.filter(a => a.status === 'present').length;
    const attendanceHealth = monthAtt.length > 0 ? ((presentCount / monthAtt.length) * 100).toFixed(1) : 'N/A';

    // Payment-status breakdown counts for the executive summary cards.
    let paidCount = 0, pendingCount = 0, dueCount = 0, overdueCount = 0;
    targetStudents.forEach(s => {
      const st = getStudentPaymentStatus(s, targetMonth, targetYear);
      if (st === 'Paid') paidCount++;
      else if (st === 'Pending') pendingCount++;
      else if (st === 'Due') dueCount++;
      else if (st === 'Overdue') overdueCount++;
    });
    const outstanding = lastDueAmount + currPendingAmount;

    // Coach Performance (based on true payments from assigned students this month)
    const coachMetrics = allCoaches.filter(c => c.status !== 'archived').map(c => {
      const coachStuds = allStudents.filter(s => String(s.coach_id) === String(c.id));
      const coachStudIds = new Set(coachStuds.map(s => String(s.id).toLowerCase()));
      
      let coachRev = (allPayments || []).reduce((sum, p) => {
          const pDate = new Date(p.payment_date || p.created_at);
          if (pDate.getUTCMonth() === targetMonth && pDate.getUTCFullYear() === targetYear && p.status === 'paid') {
              const sid = String(p.student_id).toLowerCase();
              if (coachStudIds.has(sid)) {
                  return sum + (parseFloat(p.amount) || 0);
              }
          }
          return sum;
      }, 0);
      
      const coachCost = getCoachSalary(c) || 0;
      const profit = coachRev - coachCost;
      return { 
        name: getCoachName(c), 
        students: coachStuds.filter(s => {
          const sStatus = getStudentStatus(s);
          if (sStatus === 'archived' || sStatus === 'pending' || sStatus === 'waitlist' || sStatus === 'inactive') return false;
          const enrollDateStr = getStudentDate(s);
          let enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
          if (isNaN(enrollDate.getTime())) enrollDate = baseline;
          return enrollDate <= monthEndLimit;
        }).length, 
        revenue: coachRev, 
        cost: coachCost, 
        profit: profit, 
        roi: coachCost > 0 ? ((profit / coachCost) * 100) : 'N/A'
      };
    });

    const topPending = allStudents
      .filter(s => {
          const sStatus = getStudentStatus(s);
          if (sStatus === 'archived' || sStatus === 'pending' || sStatus === 'waitlist' || sStatus === 'inactive') return false;
          const enrollDateStr = getStudentDate(s);
          let enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
          if (isNaN(enrollDate.getTime())) enrollDate = baseline;
          if (enrollDate > monthEndLimit) return false;
          const status = getStudentPaymentStatus(s, targetMonth, targetYear);
          return status !== 'Paid' && status !== 'Not Enrolled';
      })
      .sort((a, b) => getStudentMonthlyFee(b) - getStudentMonthlyFee(a))
      .slice(0, 5);

    // Monthwise Historical Analysis (Last 6 Months) using true transaction-level values
    const monthwiseData = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(Date.UTC(targetYear, targetMonth - i, 1));
        const mName = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        const m = d.getUTCMonth();
        const y = d.getUTCFullYear();
        const mEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));
        
        let mPotential = 0;
        let mCollected = 0;
        let mOutstanding = 0;
        
        mCollected = (window.cycleRevenue ? window.cycleRevenue(y, m) : calculateSlotRevenue(y, m));

        allStudents.forEach(s => {
            const sStatus = getStudentStatus(s);
            if (sStatus === 'archived' || sStatus === 'pending' || sStatus === 'waitlist' || sStatus === 'inactive') return;
            const enrollDateStr = getStudentDate(s);
            let enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
            if (isNaN(enrollDate.getTime())) enrollDate = baseline;
            if (enrollDate <= mEnd) {
                const fee = getStudentMonthlyFee(s) || 0;
                mPotential += fee;
                
                const status = getStudentPaymentStatus(s, m, y);
                if (status !== 'Paid' && status !== 'Not Enrolled') {
                    mOutstanding += fee;
                }
            }
        });
        
        const mRate = mPotential > 0 ? ((mCollected / mPotential) * 100).toFixed(0) : 0;
        monthwiseData.push({ month: mName, potential: mPotential, collected: mCollected, outstanding: mOutstanding, rate: mRate });
    }

    // Preparing Category Distributions
    const batches = { 'Group': 0, 'Single': 0 };
    const timings = { 'Morning': 0, 'Evening': 0, 'Weekend': 0 };
    const levels = { 'Beginner': 0, 'Intermediate': 0, 'Advanced': 0, 'Elite': 0 };
    
    targetStudents.forEach(s => {
        const type = getStudentBatchType(s);
        if (batches[type] !== undefined) batches[type]++;
        
        const time = getStudentSessionTime(s).toUpperCase();
        if (time.includes('MORNING')) timings['Morning']++;
        else if (time.includes('WEEKEND')) timings['Weekend']++;
        else timings['Evening']++;

        const lvl = getStudentLevel(s);
        if (levels[lvl] !== undefined) levels[lvl]++;
        else levels['Beginner']++;
    });

    // Performance Metrics
    const avgElo = targetStudents.length > 0 ? (targetStudents.reduce((a, s) => a + getStudentRating(s), 0) / targetStudents.length).toFixed(0) : 0;

    const eloGainers = targetStudents.map(s => {
        const history = (window.allRatingHistory || []).filter(h => String(h.student_id) === String(s.id)).sort((a,b) => new Date(a.recorded_at || a.created_at) - new Date(b.recorded_at || b.created_at));
        if (history.length < 1) return null;
        
        // Find rating at start of month (last record before month start)
        const beforeMonth = history.filter(h => new Date(h.recorded_at || h.created_at) < monthStartLimit);
        const startRating = beforeMonth.length > 0 ? (beforeMonth[beforeMonth.length - 1].rating || 800) : (history[0].rating || 800);
        
        // Find rating at end of month (last record during month)
        const duringMonth = history.filter(h => new Date(h.recorded_at || h.created_at) <= monthEndLimit);
        const endRating = duringMonth.length > 0 ? (duringMonth[duringMonth.length - 1].rating || 800) : startRating;
        
        const gain = endRating - startRating;
        return { name: getStudentName(s), gain };
    }).filter(x => x !== null && x.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 3);

    const attendanceStats = targetStudents.map(s => {
        const studAtt = monthAtt.filter(a => String(a.student_id) === String(s.id));
        const present = studAtt.filter(a => a.status === 'present').length;
        const total = studAtt.length;
        const rate = total > 0 ? ((present / total) * 100).toFixed(0) : 0;
        return { name: getStudentName(s), rate, present, total };
    }).filter(x => x.total > 0).sort((a, b) => b.rate - a.rate).slice(0, 8);

    // Prepare transaction rows for the ledger (Actual transactions in that specific month)
    const transactionRows = monthlyPayments.map(p => {
        const s = allStudents.find(x => String(x.id) === String(p.student_id));
        const localCurrStr = s && window.getStudentLocalCurrencyAmount ? window.getStudentLocalCurrencyAmount(s, p.amount) : '';
        return `
        <tr>
          <td class="mono" style="font-size:10px">${new Date(p.payment_date || p.created_at).toLocaleDateString('en-IN')}</td>
          <td class="bold">${(s ? getStudentName(s) : (p.student_name || 'Unknown Student')).toUpperCase()}</td>
          <td>${p.payment_method || 'Transfer'}</td>
          <td class="text-right mono bold">₹${(parseFloat(p.amount) || 0).toLocaleString()}${localCurrStr}</td>
          <td style="font-size:10px;color:var(--text-dim)">#${String(p.id).slice(-8)}</td>
        </tr>`;
    }).join('');

     let reportHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Academy Financial Report - ${dateStr}</title>
  <link href="/fonts/fonts.css" rel="stylesheet"/>
  <script src="/lib/chart.umd.min.js"></script>
  <style>
    :root {
      --gold: #c9960c;
      --gold-dark: #8c6a08;
      --bg: #0a0a0b;
      --card-bg: #111113;
      --border: rgba(201, 150, 12, 0.2);
      --text: #e0e0e0;
      --text-dim: #888;
      --sapphire: #5a9fff;
      --emerald: #52c41a;
      --ruby: #ff4d4f;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 14mm; }
    @media print {
      /* Switch to a clean, ink-friendly white executive document for the
         actual PDF/print output (the on-screen view stays dark & premium). */
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { background: #ffffff !important; color: #1a1a1a !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .page {
        background: #ffffff !important; color: #1a1a1a !important;
        border: none !important; box-shadow: none !important;
        margin: 0 auto !important; padding: 0 6mm !important;
        width: 100% !important; min-height: auto !important;
        page-break-after: always; break-after: page;
      }
      .page:last-child { page-break-after: auto; break-after: auto; }
      .watermark { color: rgba(201, 150, 12, 0.06) !important; }
      .header h1 { color: #8c6a08 !important; }
      .header h2, .header-meta, .footer { color: #555 !important; }
      .confidential { color: #8c6a08 !important; }
      .heartbeat { color: #2e7d32 !important; }
      h3 { color: #8c6a08 !important; }
      h3::after { background: #d9c48a !important; }
      .kpi-card { background: #faf7ef !important; border: 1px solid #e3d6a8 !important; }
      .kpi-label { color: #777 !important; }
      .kpi-value { color: #8c6a08 !important; }
      .kpi-sub { color: #999 !important; }
      .chart-box { background: #fbfbfd !important; border: 1px solid #e2e2e2 !important; }
      .data-story { color: #2a2a2a !important; }
      .strategic-insight { background: #faf5e6 !important; border-left-color: #c9960c !important; color: #3a3a3a !important; }
      th { color: #8c6a08 !important; border-bottom: 2px solid #c9960c !important; }
      td { color: #222 !important; border-bottom: 1px solid #e4e4e4 !important; }
      .bold { color: #000 !important; }
      .loss { color: #c0392b !important; }
      .gain { color: #1e7e34 !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
    }
    body { background: var(--bg); font-family: 'Cormorant Garamond', serif; color: var(--text); line-height: 1.5; padding: 50px 0; display: flex; flex-direction: column; align-items: center; }
    .page { width: 950px; padding: 80px; position: relative; min-height: 1300px; background: var(--card-bg); margin-bottom: 50px; box-shadow: 0 40px 100px rgba(0,0,0,0.6); border: 1px solid var(--border); overflow: hidden; }
    
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-family: 'Cinzel', serif; font-size: 100px; font-weight: 900; color: rgba(201, 150, 12, 0.04); pointer-events: none; white-space: nowrap; z-index: 0; }

    .header { text-align: left; margin-bottom: 60px; border-bottom: 2px solid var(--gold); padding-bottom: 30px; position: relative; z-index: 1; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 42px; font-weight: 900; letter-spacing: 2px; color: var(--gold); margin-bottom: 5px; text-transform: uppercase; }
    .header h2 { font-family: 'Syne', sans-serif; font-size: 14px; letter-spacing: 6px; color: var(--text-dim); font-weight: 600; margin-bottom: 25px; }
    .header-meta { display: flex; justify-content: space-between; font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text-dim); text-transform: uppercase; }
    .confidential { color: var(--gold); font-weight: 700; letter-spacing: 2px; }
    .heartbeat { color: var(--emerald); font-weight: 600; }

    .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 50px; position: relative; z-index: 1; }
    .kpi-card { background: rgba(255,255,255,0.02); border: 1px solid var(--border); padding: 20px 10px; text-align: center; border-radius: 4px; position: relative; }
    .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-dim); margin-bottom: 10px; font-family: 'Syne', sans-serif; }
    .kpi-value { font-family: 'DM Mono', monospace; font-size: 24px; font-weight: 600; color: var(--gold); }
    .kpi-sub { font-size: 10px; color: #555; margin-top: 5px; font-style: italic; }

    .analytics-row { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-bottom: 60px; align-items: center; position: relative; z-index: 1; }
    .chart-box { background: rgba(255,255,255,0.01); padding: 30px; border: 1px solid var(--border); border-radius: 8px; height: 350px; position: relative; }
    .data-story { font-size: 18px; color: var(--text); }
    .data-story p { margin-bottom: 20px; }
    .strategic-insight { background: rgba(201, 150, 12, 0.05); border-left: 5px solid var(--gold); padding: 20px; font-style: italic; margin-top: 30px; border-radius: 0 8px 8px 0; font-size: 16px; }

    h3 { font-family: 'Cinzel', serif; font-size: 18px; letter-spacing: 3px; color: var(--gold); text-transform: uppercase; margin: 50px 0 25px 0; display: flex; align-items: center; }
    h3::after { content: ''; flex: 1; height: 1px; background: var(--border); margin-left: 20px; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; z-index: 1; position: relative; }
    th { text-align: left; padding: 18px 15px; border-bottom: 2px solid var(--gold); font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; color: var(--gold); text-transform: uppercase; letter-spacing: 1px; }
    td { padding: 18px 15px; border-bottom: 1px solid var(--border); }
    .mono { font-family: 'DM Mono', monospace; }
    .text-right { text-align: right; }
    .loss { color: var(--ruby) !important; font-weight: 600; }
    .gain { color: var(--emerald) !important; font-weight: 600; }
    .bold { font-weight: 700; color: #fff; }

    .footer { position: absolute; bottom: 50px; left: 80px; right: 80px; display: flex; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 25px; font-size: 10px; color: var(--text-dim); font-family: 'DM Mono', monospace; letter-spacing: 1px; }
    
    .print-btn { background: var(--gold); color: #000; border: none; padding: 18px 45px; font-family: 'Syne', sans-serif; font-weight: 800; cursor: pointer; margin-bottom: 40px; border-radius: 4px; letter-spacing: 3px; transition: all 0.4s; box-shadow: 0 15px 40px rgba(201, 150, 12, 0.3); text-transform: uppercase; }
    .print-btn:hover { background: #fff; transform: translateY(-3px); box-shadow: 0 20px 50px rgba(255,255,255,0.2); }
  </style>
</head>
<body>
  <div class="no-print" style="position:fixed;top:20px;z-index:100;text-align:center;width:100%">
    <button class="print-btn" onclick="window.print()">EXPORT FINANCIAL STATEMENT</button>
  </div>

  <div class="page">
    <div class="watermark">FINANCIAL AUDIT</div>
    <div class="header">
      <h1>ACADEMY FINANCIAL REPORT</h1>
      <div class="header-meta">
        <div>REPORT ID: CKD-FIN-${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${generatedAt.getTime().toString(36).toUpperCase()}</div>
        <div class="confidential">EXECUTIVE REPORT // PRIVATE & CONFIDENTIAL</div>
        <div style="color:var(--gold);font-weight:700;letter-spacing:1px;margin-top:5px">REPORT PERIOD: ${dateStr.toUpperCase()}</div>
        <div class="heartbeat">SYNC STATUS: REAL-TIME &middot; GENERATED ${fullStamp.toUpperCase()}</div>
      </div>
    </div>

    <h3>I. Strategic Key Metrics</h3>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Active Students</div>
        <div class="kpi-value">${activeStudents}</div>
        <div class="kpi-sub">Total Students</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Past Unpaid Fees</div>
        <div class="kpi-value" style="color:var(--ruby)">₹${lastDueAmount.toLocaleString()}</div>
        <div class="kpi-sub">Previous Month Arrears</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">This Month Unpaid</div>
        <div class="kpi-value">₹${currPendingAmount.toLocaleString()}</div>
        <div class="kpi-sub">Current Month Balance</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Avg Student Fee</div>
        <div class="kpi-value">₹${arpu}</div>
        <div class="kpi-sub">Avg Paid Fee</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Attendance</div>
        <div class="kpi-value">${attendanceHealth === 'N/A' ? 'N/A' : attendanceHealth + '%'}</div>
        <div class="kpi-sub">Avg Attendance</div>
      </div>
    </div>

    <h3>I-B. Collections & Payment Status</h3>
    <div class="kpi-grid" style="grid-template-columns: repeat(6, 1fr);">
      <div class="kpi-card">
        <div class="kpi-label">Revenue Collected</div>
        <div class="kpi-value" style="color:var(--emerald)">₹${collected.toLocaleString()}</div>
        <div class="kpi-sub">${collectionRate}% of expected</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Outstanding</div>
        <div class="kpi-value" style="color:var(--ruby)">₹${outstanding.toLocaleString()}</div>
        <div class="kpi-sub">Arrears + current</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Paid</div>
        <div class="kpi-value" style="color:var(--emerald)">${paidCount}</div>
        <div class="kpi-sub">students settled</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Pending</div>
        <div class="kpi-value" style="color:var(--gold)">${pendingCount}</div>
        <div class="kpi-sub">not yet due</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Due / Overdue</div>
        <div class="kpi-value" style="color:var(--ruby)">${dueCount + overdueCount}</div>
        <div class="kpi-sub">${dueCount} due &middot; ${overdueCount} overdue</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">New Enrollments</div>
        <div class="kpi-value" style="color:var(--sapphire)">${newStudsThisMonth}</div>
        <div class="kpi-sub">this month</div>
      </div>
    </div>

    <div class="analytics-row">
      <div class="chart-box">
        <canvas id="revChart"></canvas>
      </div>
      <div class="data-story">
        <p><strong>Fees Reconciliation Summary:</strong> Total expected fees for ${dateStr} is <span class="bold">₹${potential.toLocaleString()}</span>. Verified collections totaled <span class="bold">₹${collected.toLocaleString()}</span> across ${monthlyPayments.length} transactions.</p>
        <p>Operating profit margin for this period is <span class="bold">${opMargin}%</span>. Total Coaches salary overhead is <span class="bold">₹${payroll.toLocaleString()}</span> and Total Academy Expenditures are <span class="bold">₹${totalExp.toLocaleString()}</span>, yielding a net profit of <span class="bold">₹${netProfit.toLocaleString()}</span>.</p>
        <div class="strategic-insight">
          Audit Note: System confirms ${newStudsThisMonth} new student registrations. Average Academy ELO has reached <span class="bold">${avgElo}</span>. Total outstanding (Last Due + Current) stands at <span class="bold">₹${(lastDueAmount + currPendingAmount).toLocaleString()}</span>.
        </div>
      </div>
    </div>

    <h3>II. Coaching Operations & Fee Returns</h3>
    <table>
      <thead>
        <tr>
          <th>Coach Name</th>
          <th class="text-right">Assigned Students</th>
          <th class="text-right">Collected Fees</th>
          <th class="text-right">Monthly Salary</th>
          <th class="text-right">Net Income</th>
          <th class="text-right">Fee Return (ROI)</th>
        </tr>
      </thead>
      <tbody>
        ${coachMetrics.map(m => `
        <tr>
          <td class="bold">${m.name.toUpperCase()}</td>
          <td class="text-right">${m.students}</td>
          <td class="text-right mono">₹${m.revenue.toLocaleString()}</td>
          <td class="text-right mono">₹${m.cost.toLocaleString()}</td>
          <td class="text-right mono ${m.profit < 0 ? 'loss' : 'gain'}">₹${m.profit.toLocaleString()}</td>
          <td class="text-right mono ${m.roi !== 'N/A' && m.roi < 0 ? 'loss' : 'gain'}">${m.roi === 'N/A' ? 'N/A' : m.roi.toFixed(0) + '%'}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <div class="footer">
      <div>© TWO KNIGHTS ACADEMY MANAGEMENT</div>
      <div>CLASSIFICATION: EXECUTIVE</div>
      <div>PAGE 01 / 03</div>
    </div>
  </div>

  <div class="page">
    <div class="watermark">DETAILED ANALYSIS</div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 30px;">
      <div>
        <h3>III. Student Level Distribution</h3>
        <div class="chart-box" style="height: 250px;">
          <canvas id="levelChart"></canvas>
        </div>
      </div>
      <div>
        <h3>IV. Batch Timings Distribution</h3>
        <div class="chart-box" style="height: 250px;">
          <canvas id="timingChart"></canvas>
        </div>
      </div>
    </div>

    <h3>V. Monthly Fees Collections Trend</h3>
    <table>
      <thead>
        <tr>
          <th>Billing Period</th>
          <th class="text-right">Potential Revenue</th>
          <th class="text-right">Collected</th>
          <th class="text-right">Uncollected Balance</th>
          <th class="text-right">Collection Rate</th>
        </tr>
      </thead>
      <tbody>
        ${monthwiseData.map(m => `
        <tr>
          <td class="bold">${m.month.toUpperCase()}</td>
          <td class="text-right mono">₹${m.potential.toLocaleString()}</td>
          <td class="text-right mono gain">₹${m.collected.toLocaleString()}</td>
          <td class="text-right mono ${m.outstanding > 0 ? 'loss' : ''}">₹${m.outstanding.toLocaleString()}</td>
          <td class="text-right mono bold">${m.rate}%</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap: 30px; margin-top: 20px;">
      <div>
        <h3>VI. Pending Fees Leaderboard</h3>
        <table>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Level</th>
              <th class="text-right">Monthly Fee</th>
            </tr>
          </thead>
          <tbody>
            ${topPending.map(s => `
            <tr>
              <td class="bold">${getStudentName(s).toUpperCase()}</td>
              <td>${getStudentLevel(s)}</td>
              <td class="text-right mono loss">₹${getStudentMonthlyFee(s).toLocaleString()}${window.getStudentLocalCurrencyAmount ? window.getStudentLocalCurrencyAmount(s, getStudentMonthlyFee(s)) : ''}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div>
        <h3>VII. Performance Gainers</h3>
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th class="text-right">ELO Gain</th>
            </tr>
          </thead>
          <tbody>
            ${eloGainers.length > 0 ? eloGainers.map(g => `
            <tr>
              <td class="bold">${g.name.toUpperCase()}</td>
              <td class="text-right mono gain">+${g.gain}</td>
            </tr>`).join('') : `<tr><td colspan="2" style="text-align:center; color: var(--text-dim)">No rating changes logged.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <h3>VIII. Strategic Recommendations</h3>
    <div class="data-story" style="margin-top:20px;">
      <div style="margin-bottom:15px; border-bottom: 1px solid var(--border); padding-bottom:10px; font-size: 15px;">
        <strong style="color:var(--gold)">1. UNCOLLECTED FEES AUDIT:</strong> Total uncollected fees across the last 6 months is <span class="bold">₹${monthwiseData.reduce((a, m) => a + m.outstanding, 0).toLocaleString()}</span>. A focused recovery drive is recommended.
      </div>
      <div style="margin-bottom:15px; border-bottom: 1px solid var(--border); padding-bottom:10px; font-size: 15px;">
        <strong style="color:var(--gold)">2. COACH RETENTION PERFORMANCE:</strong> <span class="bold">${coachMetrics.sort((a,b)=>b.roi-a.roi)[0]?.name || 'Top coaches'}</span> is demonstrating optimal batch class management. Consider faculty-wide training based on these patterns.
      </div>
      <div style="font-size: 15px;">
        <strong style="color:var(--gold)">3. BATCH GROWTH POTENTIAL:</strong> ${timings['Evening'] > timings['Morning'] ? 'Evening batches are approaching peak saturation. Expansion should focus on weekend morning slots.' : 'Current morning utilization is healthy. Potential for expansion in evening group sessions.'}
      </div>
    </div>

    <div class="footer">
      <div>© TWO KNIGHTS ACADEMY MANAGEMENT</div>
      <div>AUTHENTICATED BY: CKD-AI-CORE</div>
      <div>PAGE 02 / 03</div>
    </div>
  </div>

  <div class="page">
    <div class="watermark">TRANSACTION LOG</div>
    <h3>IX. Verified Transaction Ledger</h3>
    <p style="font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text-dim); margin-bottom: 20px;">
      THE FOLLOWING IS A RECONCILIATION OF ALL ${monthlyPayments.length} PAYMENTS RECORDED FOR ${dateStr.toUpperCase()}.
    </p>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Student Name</th>
          <th>Method</th>
          <th class="text-right">Amount</th>
          <th>Reference ID</th>
        </tr>
      </thead>
      <tbody>
        ${transactionRows || '<tr><td colspan="5" style="text-align:center">No transactions recorded for this period.</td></tr>'}
      </tbody>
    </table>

    <h3 style="margin-top:60px">X. Engagement Audit (Top Attendees)</h3>
    <table>
      <thead>
        <tr>
          <th>Student Name</th>
          <th class="text-right">Sessions</th>
          <th class="text-right">Present</th>
          <th class="text-right">Engagement Rate</th>
        </tr>
      </thead>
      <tbody>
        ${attendanceStats.length > 0 ? attendanceStats.map(a => `
        <tr>
          <td class="bold">${a.name.toUpperCase()}</td>
          <td class="text-right">${a.total}</td>
          <td class="text-right">${a.present}</td>
          <td class="text-right mono gain">${a.rate}%</td>
        </tr>`).join('') : `<tr><td colspan="4" style="text-align:center; color: var(--text-dim)">No attendance records logged for this period.</td></tr>`}
      </tbody>
    </table>

    <div class="strategic-insight" style="margin-top:50px; font-size:14px">
      <strong>Audit Affirmation:</strong> This report represents a high-fidelity snapshot of academy operations generated at <span class="bold">${fullStamp}</span> (local). All metrics are derived directly from the live synchronized data lake — ${window.allStudents.length} students, ${window.allCoaches?.length || 0} coaches, ${window.allPayments?.length || 0} payments, ${monthAtt.length} attendance entries for ${dateStr}.
    </div>

    <div class="footer">
      <div>&copy; TWO KNIGHTS ACADEMY MANAGEMENT</div>
      <div>AUDIT TRAIL: ${generatedAt.toISOString()}</div>
      <div>PAGE 03 / 03</div>
    </div>
  </div>`;

    reportHTML += `
  <script>
    const initCharts = () => {
      if (typeof Chart === 'undefined') {
        console.warn('[Reporting] Chart.js not loaded - skipping charts');
        return;
      }
      new Chart(document.getElementById('revChart').getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Profit', 'Payroll', 'Pending Arrears'],
          datasets: [{
            data: [${netProfit > 0 ? netProfit : 0}, ${payroll}, ${currPendingAmount}],
            backgroundColor: ['#52c41a', '#1a1a1a', '#e8a830'],
            borderColor: 'rgba(201,150,12,0.5)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#888', font: { family: 'Syne', size: 10 } } }
          }
        }
      });

      new Chart(document.getElementById('levelChart').getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Beginner', 'Intermediate', 'Advanced', 'Elite'],
          datasets: [{
            label: 'Units',
            data: [${levels['Beginner']}, ${levels['Intermediate']}, ${levels['Advanced']}, ${levels['Elite']}],
            backgroundColor: ['#c9960c', '#5a9fff', '#52c41a', '#ff4d4f'],
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666', precision: 0 } },
            x: { grid: { display: false }, ticks: { color: '#666' } }
          },
          plugins: { legend: { display: false } }
        }
      });

      new Chart(document.getElementById('timingChart').getContext('2d'), {
        type: 'pie',
        data: {
          labels: ['Morning', 'Evening', 'Weekend'],
          datasets: [{
            data: [${timings['Morning']}, ${timings['Evening']}, ${timings['Weekend']}],
            backgroundColor: ['#dca33e', '#5a9fff', '#52c41a'],
            borderColor: '#111113',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#888', font: { family: 'Syne', size: 10 } } }
          }
        }
      });
    };
    
    if (document.readyState === 'complete') initCharts();
    else window.addEventListener('load', initCharts);
  </script>
</body>
</html>`;

    // 3. Open Report in New Tab Directly
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
        toast('Popup blocked! Please allow popups for this site to view the report.', 'error');
        return;
    }
    
    reportWindow.document.write(reportHTML);
    reportWindow.document.close();
    
    toast('Executive Audit generated! Real data synchronized. ✨', 'success');
};

// =========================================================================
// Widescreen Widescreen Boardroom Presentation Exporter (PptxGenJS Integration)
// =========================================================================

async function loadPptxGenLibrary() {
    // Normalize the global regardless of the casing the bundle exposes.
    if (window.pptxgen || window.PptxGenJS) {
        window.pptxgen = window.pptxgen || window.PptxGenJS;
        return;
    }
    toast('Loading presentation engine...', 'info');
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        // Self-hosted (offline-first, CSP-safe — served from same origin).
        script.src = '/lib/pptxgen.bundle.min.js';
        script.onload = () => {
            window.pptxgen = window.pptxgen || window.PptxGenJS;
            if (window.pptxgen) resolve();
            else reject(new Error('PowerPoint engine loaded but global not found'));
        };
        script.onerror = () => reject(new Error('Failed to load PowerPoint engine'));
        document.head.appendChild(script);
    });
}

window.generateReportPPT = async function() {
    try {
        await loadPptxGenLibrary();
        
        const allStudents = window.allStudents || [];
        const allCoaches = window.allCoaches || [];
        const allPayments = window.allPayments || [];
        const allAttendance = window.allAttendance || [];

        const getStudentPaymentStatus = window.getStudentPaymentStatus;
        const getCoachSalary = window.getCoachSalary;
        const getCoachName = window.getCoachName;
        const getStudentBatchType = window.getStudentBatchType;
        const getStudentSessionTime = window.getStudentSessionTime;
        const getStudentName = window.getStudentName;
        const getStudentLevel = window.getStudentLevel;
        const getStudentRating = window.getStudentRating;
        const getStudentDate = window.getStudentDate;
        const getStudentStatus = window.getStudentStatus;
        const getStudentMonthlyFee = window.getStudentMonthlyFee;

        if (allStudents.length === 0) {
            toast('Academy data not yet synchronized. Please wait a moment...', 'warning');
            return;
        }

        const _today = new Date();
        const targetMonth = Number.isFinite(window.reportMonth) ? window.reportMonth : _today.getUTCMonth();
        const targetYear  = Number.isFinite(window.reportYear)  ? window.reportYear  : _today.getUTCFullYear();
        const now = new Date(targetYear, targetMonth, 1);
        const generatedAt = new Date();
        const dateStr = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        const fullStamp = generatedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });

        toast(`Compiling Boardroom Presentation for ${dateStr}...`, 'info');

        const getYM = (d) => {
            const dt = new Date(d);
            return isNaN(dt.getTime()) ? null : `${dt.getUTCFullYear()}-${dt.getUTCMonth()}`;
        };
        const targetYM = `${targetYear}-${targetMonth}`;
        const monthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
        const monthEndLimit = new Date(Date.UTC(targetYear, targetMonth + 1, 0));
        const baseline = new Date(Date.UTC(2026, 3, 1, 0, 0, 0));

        const targetStudents = allStudents.filter(s => {
            const sStatus = getStudentStatus(s);
            if (sStatus === 'archived' || sStatus === 'pending' || sStatus === 'waitlist' || sStatus === 'inactive') return false;
            const sName = (getStudentName(s) || '').toUpperCase();
            if (sName.includes('PARENT') || sName.includes('COACH') || sName.includes('TEST')) return false;
            const joinStr = getStudentDate(s);
            let enrollDate = joinStr ? new Date(joinStr) : baseline;
            if (isNaN(enrollDate.getTime())) enrollDate = baseline;
            return enrollDate <= monthEndLimit;
        });

        const activeStudents = targetStudents.length;

        // 1. Dynamic slot-based collected calculations (matches s-rev dashboard value exactly)
        function calculateSlotRevenue(year, month) {
            if (!allPayments) return 0;
            const seenStuds = new Set();
            return allPayments.reduce((sum, p) => {
                const pDate = new Date(p.payment_date || p.created_at);
                if (pDate.getUTCMonth() === month && pDate.getUTCFullYear() === year && p.status === 'paid') {
                    const sid = String(p.student_id).toLowerCase();
                    if (seenStuds.has(sid)) return sum;
                    
                    const s = allStudents.find(x => String(x.id).toLowerCase() === sid);
                    if (s) {
                        if (getStudentPaymentStatus(s, month, year) === 'Paid') {
                            seenStuds.add(sid);
                            return sum + getStudentMonthlyFee(s);
                        }
                    }
                }
                return sum;
            }, 0);
        }

        const collected = (window.cycleRevenue ? window.cycleRevenue(targetYear, targetMonth) : calculateSlotRevenue(targetYear, targetMonth));

        // Deduplication structure for arrears (advance-aware)
        const totalPaymentsMap = {};
        const seenApplied = new Set();
        const targetMonthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59));
        
        allPayments.forEach(p => {
            if (p.status !== 'paid') return;
            const sid = String(p.student_id || '').trim().toLowerCase();
            if (!sid) return;

            if (p.applied_month && String(p.applied_month).trim()) {
                const key = `${sid}_${p.applied_month}`;
                if (seenApplied.has(key)) return;
                seenApplied.add(key);
                if (!totalPaymentsMap[sid]) totalPaymentsMap[sid] = 0;
                totalPaymentsMap[sid]++;
                return;
            }

            const pDate = new Date(p.payment_date || p.created_at);
            const mKey = `${sid}_${pDate.getUTCFullYear()}-${String(pDate.getUTCMonth() + 1).padStart(2, '0')}`;
            if (seenApplied.has(mKey)) return;
            seenApplied.add(mKey);
            if (!totalPaymentsMap[sid]) totalPaymentsMap[sid] = 0;
            totalPaymentsMap[sid]++;
        });

        let lastDueAmount = 0;
        let currPendingAmount = 0;
        let potential = 0;

        targetStudents.forEach(s => {
            const fee = getStudentMonthlyFee(s) || 0;
            potential += fee;
            const enrollDateStr = getStudentDate(s);
            let enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
            if (isNaN(enrollDate.getTime())) enrollDate = baseline;
            const _anchor = window.getBillingAnchor ? window.getBillingAnchor(s, baseline)
              : { year: (enrollDate < baseline ? baseline : enrollDate).getUTCFullYear(), month: (enrollDate < baseline ? baseline : enrollDate).getUTCMonth() };
            const monthsRequired = ((targetYear - _anchor.year) * 12) + (targetMonth - _anchor.month) + 1;
            const s_id_key = String(s.id || '').trim().toLowerCase();
            const totalCredits = totalPaymentsMap[s_id_key] || 0;
            const totalMonthsUnpaid = Math.max(0, monthsRequired - totalCredits);
            if (totalMonthsUnpaid > 0) {
                const isPaidThisMonth = (getStudentPaymentStatus(s, targetMonth, targetYear) === 'Paid');
                const histMonths = totalMonthsUnpaid - (isPaidThisMonth ? 0 : 1);
                if (histMonths > 0) lastDueAmount += (fee * histMonths);
                if (!isPaidThisMonth) currPendingAmount += fee;
            }
        });

        const payroll = allCoaches.filter(c => c.status !== 'archived').reduce((a, c) => a + (getCoachSalary(c) || 0), 0);
        
        let totalExp = 0;
        try {
            const res = await (window.apiCall || fetch)(`/api/expenditures?mode=summary&month=${monthStr}`);
            if (res.ok) {
                const summary = await res.json();
                totalExp = parseFloat(summary.total_expense || 0);
            }
        } catch (e) {
            console.error(e);
        }

        const netProfit = collected - payroll - totalExp;
        const collectionRate = potential > 0 ? ((collected / potential) * 100).toFixed(1) : 0;

        // Fetch detailed expenditures for AI FinOps Audit
        let allExpenditures = [];
        let avgSpend = 0;
        let predictedSpend = 0;
        let anomalies = [];
        let duplicates = [];

        try {
            const expRes = await (window.apiCall || fetch)(`/api/expenditures?limit=500`);
            if (expRes.ok) {
                const expJson = await expRes.json();
                allExpenditures = expJson.data || [];
            }
        } catch (e) {
            console.error("Failed to fetch expenditures list for PPT AI Audit", e);
        }

        if (allExpenditures.length > 0) {
            let total6MonthSpend = 0;
            let monthCounts = {};
            let catTotalsFor6M = {};
            
            const currentPeriodDate = new Date(targetYear, targetMonth, 1);
            allExpenditures.forEach(e => {
                if (!e.date || e.type === 'Event Expense') return;
                const eDate = new Date(e.date);
                const diffMonths = (currentPeriodDate.getFullYear() - eDate.getFullYear()) * 12 + (currentPeriodDate.getMonth() - eDate.getMonth());
                if (diffMonths >= 0 && diffMonths < 6) {
                    const amt = parseFloat(e.amount || 0);
                    total6MonthSpend += amt;
                    monthCounts[diffMonths] = true;
                    
                    if (!catTotalsFor6M[e.category]) catTotalsFor6M[e.category] = { total: 0, count: 0 };
                    catTotalsFor6M[e.category].total += amt;
                    catTotalsFor6M[e.category].count += 1;
                }
            });

            const numMonths = Object.keys(monthCounts).length || 1;
            avgSpend = total6MonthSpend / numMonths;
            predictedSpend = avgSpend * 1.05; // 5% inflation buffer

            let seen = {};
            allExpenditures.forEach(e => {
                if (!e.date || e.type === 'Event Expense') return;
                const eDate = new Date(e.date);
                if (eDate.getUTCMonth() === targetMonth && eDate.getUTCFullYear() === targetYear) {
                    const amt = parseFloat(e.amount);
                    // Check anomalies
                    const catStats = catTotalsFor6M[e.category];
                    if (catStats && catStats.count > 2) {
                        const catAvg = catStats.total / catStats.count;
                        if (amt > catAvg * 1.5 && catAvg > 100) {
                            anomalies.push(`${e.category}: ₹${amt.toLocaleString('en-IN')} ("${e.description.slice(0, 20)}")`);
                        }
                    }
                    // Check duplicates
                    const key = `${e.date}_${e.amount}_${e.category}`;
                    if (seen[key]) {
                        duplicates.push(`₹${amt.toLocaleString('en-IN')} in ${e.category}`);
                    }
                    seen[key] = true;
                }
            });
        }

        // Historical collections for last 6 months
        const monthwiseData = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(Date.UTC(targetYear, targetMonth - i, 1));
            const mName = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
            const m = d.getUTCMonth();
            const y = d.getUTCFullYear();
            const mEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));
            
            let mPotential = 0;
            let mCollected = (window.cycleRevenue ? window.cycleRevenue(y, m) : calculateSlotRevenue(y, m));
            let mOutstanding = 0;
            
            allStudents.forEach(s => {
                const sStatus = getStudentStatus(s);
                if (sStatus === 'archived' || sStatus === 'pending' || sStatus === 'waitlist' || sStatus === 'inactive') return;
                const enrollDateStr = getStudentDate(s);
                let enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
                if (isNaN(enrollDate.getTime())) enrollDate = baseline;
                if (enrollDate <= mEnd) {
                    const fee = getStudentMonthlyFee(s) || 0;
                    mPotential += fee;
                    const status = getStudentPaymentStatus(s, m, y);
                    if (status !== 'Paid' && status !== 'Not Enrolled') {
                        mOutstanding += fee;
                    }
                }
            });
            const mRate = mPotential > 0 ? ((mCollected / mPotential) * 100).toFixed(0) : 0;
            monthwiseData.push({ month: mName, potential: mPotential, collected: mCollected, outstanding: mOutstanding, rate: mRate });
        }

        const batches = { 'Group': 0, 'Single': 0 };
        const timings = { 'Morning': 0, 'Evening': 0, 'Weekend': 0 };
        const levels = { 'Beginner': 0, 'Intermediate': 0, 'Advanced': 0, 'Elite': 0 };
        
        targetStudents.forEach(s => {
            const type = getStudentBatchType(s);
            if (batches[type] !== undefined) batches[type]++;
            const time = getStudentSessionTime(s).toUpperCase();
            if (time.includes('MORNING')) timings['Morning']++;
            else if (time.includes('WEEKEND')) timings['Weekend']++;
            else timings['Evening']++;
            const lvl = getStudentLevel(s);
            if (levels[lvl] !== undefined) levels[lvl]++;
            else levels['Beginner']++;
        });

        // Payment-status distribution for the boardroom pie chart.
        let pPaid = 0, pPending = 0, pDue = 0, pOverdue = 0;
        targetStudents.forEach(s => {
            const st = getStudentPaymentStatus(s, targetMonth, targetYear);
            if (st === 'Paid') pPaid++;
            else if (st === 'Pending') pPending++;
            else if (st === 'Due') pDue++;
            else if (st === 'Overdue') pOverdue++;
        });

        const coachMetrics = allCoaches.filter(c => c.status !== 'archived').map(c => {
            const coachStuds = allStudents.filter(s => String(s.coach_id) === String(c.id));
            const coachStudIds = new Set(coachStuds.map(s => String(s.id).toLowerCase()));
            let coachRev = (allPayments || []).reduce((sum, p) => {
                const pDate = new Date(p.payment_date || p.created_at);
                if (pDate.getUTCMonth() === targetMonth && pDate.getUTCFullYear() === targetYear && p.status === 'paid') {
                    const sid = String(p.student_id).toLowerCase();
                    if (coachStudIds.has(sid)) {
                        return sum + (parseFloat(p.amount) || 0);
                    }
                }
                return sum;
            }, 0);
            const coachCost = getCoachSalary(c) || 0;
            const profit = coachRev - coachCost;
            return {
                name: getCoachName(c),
                students: coachStuds.filter(s => {
                    const sStatus = getStudentStatus(s);
                    if (sStatus === 'archived' || sStatus === 'pending' || sStatus === 'waitlist' || sStatus === 'inactive') return false;
                    const enrollDateStr = getStudentDate(s);
                    let enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
                    if (isNaN(enrollDate.getTime())) enrollDate = baseline;
                    return enrollDate <= monthEndLimit;
                }).length,
                revenue: coachRev,
                cost: coachCost,
                profit: profit,
                roi: coachCost > 0 ? ((profit / coachCost) * 100) : 0
            };
        });

        // 2. Initialize Widescreen Slide Deck
        const pptx = new window.pptxgen();
        pptx.layout = 'LAYOUT_16x9';

        const darkBG = '0F0F12';
        const cardBG = '17171C';
        const goldAccent = 'E8A830';
        const textWhite = 'FFFFFF';
        const textMuted = '71717A';

        // ────────── SLIDE 1: Title Slide (Cover) ──────────
        let slide1 = pptx.addSlide();
        slide1.background = { fill: darkBG };
        
        slide1.addShape('rect', { x: 0.5, y: 0.5, w: 9.0, h: 4.625, line: { color: goldAccent, width: 2 } });
        
        slide1.addText("TWO KNIGHTS ACADEMY", {
            x: 1.0, y: 1.6, w: 8.0, h: 0.8,
            fontSize: 36, fontFace: 'Georgia', color: goldAccent, bold: true, align: 'center'
        });
        
        slide1.addShape('rect', { x: 3.5, y: 2.5, w: 3.0, h: 0.03, fill: { color: goldAccent } });
        
        slide1.addText("BOARDROOM BUSINESS REVIEW & FINANCIAL PERFORMANCE", {
            x: 1.0, y: 2.7, w: 8.0, h: 0.4,
            fontSize: 13, fontFace: 'Arial', color: textWhite, bold: true, align: 'center', margin: 0
        });

        slide1.addText(`Reporting Period: ${dateStr.toUpperCase()}\nGenerated at: ${fullStamp}`, {
            x: 1.0, y: 3.6, w: 8.0, h: 0.6,
            fontSize: 10, fontFace: 'Arial', color: textMuted, align: 'center', margin: 0
        });

        // Helper function to add slide headers
        function addSlideHeader(slide, title) {
            slide.addText(title, {
                x: 0.6, y: 0.3, w: 8.8, h: 0.4,
                fontSize: 18, fontFace: 'Georgia', color: goldAccent, bold: true
            });
            slide.addShape('rect', { x: 0.6, y: 0.75, w: 8.8, h: 0.02, fill: { color: '2D2D35' } });
        }

        // Helper function to add footer info
        function addSlideFooter(slide, pageNum) {
            slide.addText("TWO KNIGHTS EXECUTIVE AUDIT  |  CONFIDENTIAL", {
                x: 0.6, y: 5.25, w: 7.0, h: 0.2,
                fontSize: 8, fontFace: 'Arial', color: textMuted
            });
            slide.addText(`PAGE ${pageNum}`, {
                x: 8.0, y: 5.25, w: 1.4, h: 0.2,
                fontSize: 8, fontFace: 'Arial', color: textMuted, align: 'right'
            });
        }

        // ────────── SLIDE 2: Executive Summary KPIs ──────────
        let slide2 = pptx.addSlide();
        slide2.background = { fill: darkBG };
        addSlideHeader(slide2, "STRATEGIC KEY METRICS Summary");

        const kpis = [
            { label: 'ACTIVE STUDENTS', value: activeStudents.toString(), color: 'FFFFFF' },
            { label: 'COLLECTED REVENUE', value: `₹${collected.toLocaleString()}`, color: '10B981' },
            { label: 'COLLECTION RATE', value: `${collectionRate}%`, color: 'E8A830' },
            { label: 'PAST ARREARS', value: `₹${lastDueAmount.toLocaleString()}`, color: 'EF4444' },
            { label: 'MONTH OUTSTANDING', value: `₹${currPendingAmount.toLocaleString()}`, color: 'EF4444' }
        ];

        kpis.forEach((kpi, idx) => {
            const xPos = 0.6 + (idx * 1.76);
            slide2.addShape('rect', {
                x: xPos, y: 1.2, w: 1.6, h: 1.8,
                fill: { color: cardBG },
                line: { color: '2D2D35', width: 1 }
            });
            
            slide2.addText(kpi.label, {
                x: xPos, y: 1.4, w: 1.6, h: 0.3,
                fontSize: 8, fontFace: 'Arial', color: textMuted, bold: true, align: 'center'
            });
            
            slide2.addText(kpi.value, {
                x: xPos, y: 1.8, w: 1.6, h: 0.6,
                fontSize: 16, fontFace: 'Arial', color: kpi.color, bold: true, align: 'center'
            });
        });

        // AI Summary Narrative panel
        slide2.addShape('rect', {
            x: 0.6, y: 3.3, w: 8.8, h: 1.6,
            fill: { color: '17171C' },
            line: { color: goldAccent, width: 1 }
        });
        
        const narrativeText = `Reconciliation Note:\nExpected Tuition value stands at ₹${potential.toLocaleString()} with cash capture totaling ₹${collected.toLocaleString()}.\nCoaching roster payroll overhead is ₹${payroll.toLocaleString()} and Expenditures are ₹${totalExp.toLocaleString()}.\nOperating surplus for this period is registered at ₹${netProfit.toLocaleString()}.`;
        slide2.addText(narrativeText, {
            x: 0.8, y: 3.4, w: 8.4, h: 1.4,
            fontSize: 10, fontFace: 'Arial', color: textWhite, lineSpacing: 18
        });

        addSlideFooter(slide2, 2);

        // ────────── SLIDE 3: Coaching Operations ──────────
        let slide3 = pptx.addSlide();
        slide3.background = { fill: darkBG };
        addSlideHeader(slide3, "COACH OPERATIONS & FEE ROI");

        const headers = [
            { text: 'Coach Name', options: { bold: true, color: goldAccent, fill: '1F1F27' } },
            { text: 'Students', options: { bold: true, color: goldAccent, fill: '1F1F27', align: 'center' } },
            { text: 'Revenue', options: { bold: true, color: goldAccent, fill: '1F1F27', align: 'right' } },
            { text: 'Salary', options: { bold: true, color: goldAccent, fill: '1F1F27', align: 'right' } },
            { text: 'Net Return', options: { bold: true, color: goldAccent, fill: '1F1F27', align: 'right' } },
            { text: 'ROI', options: { bold: true, color: goldAccent, fill: '1F1F27', align: 'right' } }
        ];

        const rows = coachMetrics.slice(0, 7).map(m => [
            { text: m.name.toUpperCase(), options: { bold: true } },
            { text: m.students.toString(), options: { align: 'center' } },
            { text: `₹${m.revenue.toLocaleString()}`, options: { align: 'right' } },
            { text: `₹${m.cost.toLocaleString()}`, options: { align: 'right' } },
            { text: `₹${m.profit.toLocaleString()}`, options: { align: 'right', color: m.profit < 0 ? 'EF4444' : '10B981' } },
            { text: `${m.roi.toFixed(0)}%`, options: { align: 'right', color: m.profit < 0 ? 'EF4444' : '10B981' } }
        ]);

        const tableData = [headers, ...rows];

        slide3.addTable(tableData, {
            x: 0.6, y: 1.1, w: 8.8, h: 3.8,
            colW: [2.0, 1.0, 1.4, 1.4, 1.5, 1.5],
            border: { type: 'line', size: 1, color: '2D2D35' },
            fill: { color: '17171C' },
            color: 'FFFFFF',
            fontSize: 9,
            fontFace: 'Arial'
        });

        addSlideFooter(slide3, 3);

        // ────────── SLIDE 4: Demographic Distribution Charts ──────────
        let slide4 = pptx.addSlide();
        slide4.background = { fill: darkBG };
        addSlideHeader(slide4, "STUDENT LEVELS & FEE PAYMENT STATUS");

        const pptCharts = pptx.charts || pptx.ChartType || {};
        
        // 1. Levels bar chart
        if (pptCharts.BAR) {
            const chartDataLevel = [{
                name: 'Student Count',
                labels: ['Beginner', 'Intermediate', 'Advanced', 'Elite'],
                values: [levels.Beginner, levels.Intermediate, levels.Advanced, levels.Elite]
            }];
            
            slide4.addChart(pptx.charts.BAR, chartDataLevel, {
                x: 0.6, y: 1.2, w: 4.2, h: 3.6,
                showLegend: false,
                chartColors: ['E8A830'],
                plotArea: { fill: { color: '17171C' } },
                title: 'Student Count by Skill Level',
                titleColor: 'FFFFFF',
                titleFontSize: 11
            });
        }

        // 2. Payment-status distribution pie (Paid / Pending / Due / Overdue)
        if (pptCharts.PIE || pptCharts.DOUGHNUT) {
            const chartDataPay = [{
                name: 'Payment Status',
                labels: ['Paid', 'Pending', 'Due', 'Overdue'],
                values: [pPaid, pPending, pDue, pOverdue]
            }];

            slide4.addChart((pptx.charts.DOUGHNUT || pptx.charts.PIE), chartDataPay, {
                x: 5.2, y: 1.2, w: 4.2, h: 3.6,
                showLegend: true,
                legendPos: 'r',
                legendColor: 'FFFFFF',
                legendFontSize: 9,
                chartColors: ['10B981', 'E8A830', 'F59E0B', 'EF4444'],
                showValue: true,
                dataLabelColor: 'FFFFFF',
                dataLabelFontSize: 9,
                holeSize: 55,
                title: 'Fee Payment Status Distribution',
                titleColor: 'FFFFFF',
                titleFontSize: 11
            });
        }

        addSlideFooter(slide4, 4);

        // ────────── SLIDE 5: Historical Trends ──────────
        let slide5 = pptx.addSlide();
        slide5.background = { fill: darkBG };
        addSlideHeader(slide5, "MONTHLY COLLECTION RATES (6-MONTH HISTORY)");

        if (pptCharts.LINE) {
            const lineChartData = [
                {
                    name: 'Expected Potential',
                    labels: monthwiseData.map(m => m.month),
                    values: monthwiseData.map(m => m.potential)
                },
                {
                    name: 'Verified Captured',
                    labels: monthwiseData.map(m => m.month),
                    values: monthwiseData.map(m => m.collected)
                }
            ];

            slide5.addChart(pptx.charts.LINE, lineChartData, {
                x: 0.6, y: 1.2, w: 8.8, h: 3.8,
                showLegend: true,
                legendColor: 'FFFFFF',
                legendFontSize: 9,
                chartColors: ['E8A830', '10B981'],
                title: 'Expected Fees Revenue vs Actual Collections',
                titleColor: 'FFFFFF',
                titleFontSize: 12
            });
        }

        addSlideFooter(slide5, 5);

        // ────────── SLIDE 6: AI FinOps & Audit Insights ──────────
        let slide6 = pptx.addSlide();
        slide6.background = { fill: darkBG };
        addSlideHeader(slide6, "AI GUARDIAN FINOPS & COST AUDIT");

        slide6.addShape('rect', {
            x: 0.6, y: 1.1, w: 4.2, h: 3.8,
            fill: { color: '17171C' },
            line: { color: '2D2D35', width: 1 }
        });

        slide6.addText("AI FORECAST & BURN RATE", {
            x: 0.8, y: 1.3, w: 3.8, h: 0.4,
            fontSize: 13, fontFace: 'Georgia', color: '5A9FFF', bold: true
        });

        slide6.addText("6-MONTH AVERAGE SPEND", {
            x: 0.8, y: 1.9, w: 3.8, h: 0.3,
            fontSize: 9, fontFace: 'Arial', color: textMuted, bold: true
        });

        slide6.addText(`₹${avgSpend.toLocaleString(undefined, {maximumFractionDigits: 0})}`, {
            x: 0.8, y: 2.2, w: 3.8, h: 0.4,
            fontSize: 20, fontFace: 'Arial', color: textWhite, bold: true
        });

        slide6.addText("PREDICTED NEXT MONTH SPEND", {
            x: 0.8, y: 2.8, w: 3.8, h: 0.3,
            fontSize: 9, fontFace: 'Arial', color: textMuted, bold: true
        });

        slide6.addText(`₹${predictedSpend.toLocaleString(undefined, {maximumFractionDigits: 0})}`, {
            x: 0.8, y: 3.1, w: 3.8, h: 0.4,
            fontSize: 20, fontFace: 'Arial', color: goldAccent, bold: true
        });

        slide6.addText("Burn rate forecast includes a 5% inflation buffer based on moving average.", {
            x: 0.8, y: 3.7, w: 3.8, h: 0.8,
            fontSize: 9, fontFace: 'Arial', color: textMuted, italic: true
        });

        slide6.addShape('rect', {
            x: 5.2, y: 1.1, w: 4.2, h: 3.8,
            fill: { color: '17171C' },
            line: { color: '2D2D35', width: 1 }
        });

        slide6.addText("AI AUDIT ALERTS (CURRENT PERIOD)", {
            x: 5.4, y: 1.3, w: 3.8, h: 0.4,
            fontSize: 13, fontFace: 'Georgia', color: 'EF4444', bold: true
        });

        let alertsText = "";
        if (anomalies.length > 0) {
            alertsText += "⚠️ EXPENDITURE SPIKES DETECTED:\n" + anomalies.slice(0, 2).map(a => `• ${a}`).join("\n") + "\n\n";
        } else {
            alertsText += "✅ No category expenditure spikes detected (>150% average).\n\n";
        }
        
        if (duplicates.length > 0) {
            alertsText += "⚠️ POTENTIAL DUPLICATE BILLINGS:\n" + duplicates.slice(0, 2).map(d => `• ${d}`).join("\n");
        } else {
            alertsText += "✅ No potential duplicate bills found.";
        }

        slide6.addText(alertsText, {
            x: 5.4, y: 1.9, w: 3.8, h: 2.8,
            fontSize: 10, fontFace: 'Arial', color: textWhite, lineSpacing: 16
        });

        addSlideFooter(slide6, 6);

        // ────────── SLIDE 7: Boardroom AI Strategy ──────────
        let slide7 = pptx.addSlide();
        slide7.background = { fill: darkBG };
        addSlideHeader(slide7, "BOARDROOM STRATEGIC RECOMMENDATIONS");

        slide7.addShape('rect', {
            x: 0.6, y: 1.1, w: 8.8, h: 3.8,
            fill: { color: '17171C' },
            line: { color: '2D2D35', width: 1 }
        });

        const recs = [
            `1. REVENUE CAPTURE RESOLUTION: Recover the total outstanding arrears of ₹${monthwiseData.reduce((a, m) => a + m.outstanding, 0).toLocaleString()} across past billing periods.`,
            `2. COACH FACULTY ROSTER MANAGEMENT: Top roster ROI is led by ${coachMetrics.sort((a,b)=>b.roi-a.roi)[0]?.name || 'coaches'}. Adopt their batch models across all classes.`,
            `3. BATCH CAPACITY DIVERSIFICATION: ${timings.Evening > timings.Morning ? 'Evening sessions are approaching capacity limits' : 'Morning sessions show high utilization'}. Divert incoming student bookings to weekend slots.`
        ];

        if (anomalies.length > 0 || duplicates.length > 0) {
            recs.push(`4. FINOPS VENDOR COMPLIANCE: Address the flagged expenditure spikes or duplicate entries on Slide 6 to secure operating margin.`);
        } else {
            recs.push(`4. OPERATIONAL COST EFFICIENCY: Cost structures remain stable; continue maintaining the current 6-month budget line.`);
        }

        recs.forEach((rec, idx) => {
            slide7.addText(rec, {
                x: 0.9, y: 1.4 + (idx * 0.85), w: 8.2, h: 0.7,
                fontSize: 11, fontFace: 'Arial', color: textWhite,
                bullet: true, lineSpacing: 16
            });
        });

        addSlideFooter(slide7, 7);

        // 3. Save File
        pptx.writeFile({ fileName: `Two Knights_Executive_Slides_${monthStr}.pptx` });
        toast('Presentation generated! PowerPoint slides downloaded. ✨', 'success');

    } catch (err) {
        console.error(err);
        toast('PowerPoint generation failed! See console for details.', 'error');
    }
};


/**
 * AI Neural Link: Compiles a clean snapshot for the AI Assistant.
 *
 * FIX: previously returned a hardcoded avgAttendance: 88.5 baseline,
 *      which made the AI confidently quote a fake number. Now computes
 *      attendance from the live window.allAttendance feed for the
 *      current month, falls back to "n/a" when no data exists.
 */
window.getAcademySnapshot = function() {
    if (!window.allStudents || !Array.isArray(window.allStudents)) return null;

    const students = window.allStudents || [];
    const coaches  = window.allCoaches  || [];
    const payments = window.allPayments || [];
    const attendance = window.allAttendance || [];

    const getStudentPaymentStatus = window.getStudentPaymentStatus;
    const getCoachName = window.getCoachName;
    const getStudentStatus = window.getStudentStatus;
    const getStudentMonthlyFee = window.getStudentMonthlyFee;

    // ── Monthly revenue dedup (1 fee per student per month) ────────────
    const paidMonths = new Set();
    const totalRev = payments.reduce((a, p) => {
        if (p.status !== 'paid') return a;
        const pDate = new Date(p.payment_date || p.created_at);
        if (isNaN(pDate.getTime())) return a;
        const mKey = `${p.student_id}_${pDate.getUTCFullYear()}-${pDate.getUTCMonth()}`;
        if (paidMonths.has(mKey)) return a;
        paidMonths.add(mKey);
        const s = students.find(x => String(x.id) === String(p.student_id));
        return a + (s && typeof getStudentMonthlyFee === 'function'
            ? getStudentMonthlyFee(s)
            : (parseFloat(p.amount) || 0));
    }, 0);

    // ── Active/archive counts ──────────────────────────────────────────
    const activeCount = students.filter(s => {
        const st = (typeof getStudentStatus === 'function' ? getStudentStatus(s) : (s.status || 'active'));
        return st !== 'archived' && st !== 'inactive' && st !== 'pending';
    }).length;

    // ── Real attendance for current month (UTC) ────────────────────────
    const now = new Date();
    const tm = now.getUTCMonth(), ty = now.getUTCFullYear();
    const monthAtt = attendance.filter(a => {
        const d = new Date(a.date);
        return !isNaN(d.getTime()) && d.getUTCMonth() === tm && d.getUTCFullYear() === ty;
    });
    const presentCount = monthAtt.filter(a => a.status === 'present').length;
    const avgAttendance = monthAtt.length > 0
        ? Number(((presentCount / monthAtt.length) * 100).toFixed(1))
        : null; // honest "n/a" instead of a fake 88.5

    // ── Coach roster (filtered to non-archived only) ───────────────────
    const coachData = coaches
        .filter(c => (c.status || 'active') !== 'archived')
        .map(c => ({
            name: typeof getCoachName === 'function' ? getCoachName(c) : (c.name || 'Coach'),
            students: students.filter(s => String(s.coach_id) === String(c.id)
                && (typeof getStudentStatus === 'function' ? getStudentStatus(s) : (s.status || 'active')) !== 'archived'
            ).length
        }));

    // ── Pending payments (this month, unpaid) ──────────────────────────
    const pendingPayments = students.filter(s => {
        if (typeof getStudentPaymentStatus !== 'function') return false;
        const st = getStudentPaymentStatus(s, tm, ty);
        return st === 'Due' || st === 'Overdue' || st === 'Unpaid';
    }).length;

    return {
        timestamp: new Date().toISOString(),
        period: `${ty}-${String(tm + 1).padStart(2, '0')}`,
        metrics: {
            totalStudents: students.length,
            activeStudents: activeCount,
            totalRevenue: totalRev,
            coachCount: coachData.length,
            pendingPayments,
            // null when no records — AI is instructed to say "n/a" rather than guess
            avgAttendance,
            attendanceSampleSize: monthAtt.length
        },
        roster: coachData,
        systemHealth: monthAtt.length > 0 ? 'Optimal' : 'Limited Telemetry'
    };
};


window.generateEventReportPDF = async function() {
    const eventId = window.currentManageEventId;
    if (!eventId) return;
    
    const e = (window.eventsData || []).find(x => String(x.id) === String(eventId));
    if (!e) return;

    const regStudents = e.registered_students || [];
    const regsData = e.registrations_data || [];
    
    let reportHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Event Report - ${e.title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&family=Cormorant+Garamond:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    :root { --midnight: #0a0e27; --deep-navy: #151b3d; --royal-blue: #1e2a5e; --soft-gold: #f4c430; --light-gold: #ffd966; --white: #ffffff; --slate: #64748b; }
    body { font-family: "DM Sans", sans-serif; padding: 40px; background: #f9fafb; color: var(--midnight); }
    @media print { body { background: white; padding: 0; } .no-print { display: none !important; } }
    .header { background: linear-gradient(135deg, var(--midnight), var(--deep-navy)); color: white; padding: 40px; border-radius: 12px; margin-bottom: 30px; position: relative; overflow: hidden; }
    .header h1 { font-family: "Syne", sans-serif; font-size: 36px; margin-bottom: 10px; color: var(--soft-gold); }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
    .kpi-card { background: white; border: 2px solid rgba(0,0,0,0.05); padding: 20px; border-radius: 12px; border-bottom: 4px solid var(--soft-gold); }
    .kpi-val { font-size: 28px; font-weight: bold; font-family: "Syne"; }
    .kpi-label { font-size: 12px; text-transform: uppercase; color: var(--slate); font-weight: bold; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    th { background: var(--royal-blue); color: white; padding: 15px; text-align: left; font-size: 13px; text-transform: uppercase; }
    td { padding: 15px; border-bottom: 1px solid #eee; }
    .print-btn { background: var(--soft-gold); color: #000; border: none; padding: 15px 30px; font-weight: bold; cursor: pointer; border-radius: 4px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:right;">
    <button class="print-btn" onclick="window.print()">PRINT EVENT REPORT</button>
  </div>
  <div class="header">
    <h1>${e.title.toUpperCase()}</h1>
    <p>Event Date: ${new Date(e.date || e.event_date).toLocaleDateString()} | Type: ${e.type || "Event"}</p>
  </div>
  
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total Participants</div>
      <div class="kpi-val">${regStudents.length} / ${e.max_participants || 50}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Expected Revenue</div>
      <div class="kpi-val">&#8377;${(regStudents.length * (e.fee || 0)).toLocaleString('en-IN')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Base Fee</div>
      <div class="kpi-val">&#8377;${(e.fee || 0).toLocaleString('en-IN')}</div>
    </div>
  </div>

  <h3 style="font-family:Syne; margin-bottom:15px;">Registered Students Roster</h3>
  <table>
    <thead><tr><th>Name</th><th>Level</th><th>Payment Status</th></tr></thead>
    <tbody>`;

    if(regStudents.length === 0) {
       reportHTML += `<tr><td colspan="3" style="text-align:center;">No students registered.</td></tr>`;
    } else {
       regStudents.forEach(sid => {
           const student = window.allStudents.find(s => s.id === sid);
           const name = student ? (student.name || student.student_name) : "Unknown";
           const level = student ? (student.level || "Beginner") : "-";
           
           const rData = regsData.find(r => r.student_id === sid);
           let status = rData ? rData.payment_status : "pending";
           
           reportHTML += `<tr>
             <td><strong>${name}</strong></td>
             <td>${level}</td>
             <td>${status === "paid" ? "<span style=\"color:green;font-weight:bold;\">PAID</span>" : "<span style=\"color:orange;font-weight:bold;\">PENDING</span>"}</td>
           </tr>`;
       });
    }

    reportHTML += `</tbody></table></body></html>`;

    const reportWindow = window.open("", "_blank");
    if (!reportWindow) { toast("Popup blocked!", "error"); return; }
    reportWindow.document.write(reportHTML);
    reportWindow.document.close();
};

window.generateEventCertificates = async function() {
    const eventId = window.currentManageEventId;
    if (!eventId) return;
    
    const e = (window.eventsData || []).find(x => String(x.id) === String(eventId));
    if (!e) return;
    const regStudents = e.registered_students || [];

    if(regStudents.length === 0) {
      toast("No students registered for this event.", "error");
      return;
    }

    let certHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Certificates - ${e.title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Great+Vibes&family=Montserrat:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body { background: #555; margin: 0; display: flex; flex-direction: column; align-items: center; }
    @media print { 
      body { background: white; } 
      .no-print { display: none !important; } 
      .cert-page { page-break-after: always; box-shadow: none !important; margin: 0 !important; }
    }
    .cert-page {
      width: 1123px; height: 794px; /* A4 Landscape */
      background: white;
      margin: 20px 0;
      position: relative;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      border: 15px solid #1e2a5e;
      box-sizing: border-box;
      padding: 40px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center;
    }
    .cert-page::after {
      content: ""; position: absolute; top: 10px; left: 10px; right: 10px; bottom: 10px;
      border: 2px solid #f4c430; pointer-events: none;
    }
    .c-title { font-family: "Cinzel", serif; font-size: 50px; color: #1e2a5e; margin-bottom: 20px; }
    .c-sub { font-family: "Montserrat", sans-serif; font-size: 20px; color: #666; margin-bottom: 40px; letter-spacing: 4px; text-transform: uppercase; }
    .c-name { font-family: "Great Vibes", cursive; font-size: 80px; color: #f4c430; margin-bottom: 40px; line-height: 1; }
    .c-body { font-family: "Montserrat", sans-serif; font-size: 18px; color: #333; max-width: 800px; line-height: 1.6; margin-bottom: 60px; }
    .c-footer { display: flex; justify-content: space-between; width: 800px; margin-top: auto; padding-bottom: 20px; }
    .c-sig { border-top: 1px solid #333; padding-top: 10px; width: 250px; font-family: "Montserrat", sans-serif; font-size: 14px; font-weight: bold; }
    .print-btn { background: #f4c430; padding: 15px 30px; font-weight: bold; border: none; font-size: 18px; cursor: pointer; margin: 20px; position: sticky; top: 20px; z-index: 100; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
  </style>
</head>
<body>
  <div class="no-print"><button class="print-btn" onclick="window.print()">PRINT CERTIFICATES</button></div>`;

    regStudents.forEach(sid => {
       const student = window.allStudents.find(s => s.id === sid);
       const name = student ? (student.name || student.student_name) : "Unknown Participant";
       
       certHTML += `<div class="cert-page">
         <div class="c-title">CERTIFICATE OF PARTICIPATION</div>
         <div class="c-sub">TWO KNIGHTS ACADEMY</div>
         <div style="font-family: Montserrat; font-size: 16px; margin-bottom: 20px;">This is to proudly certify that</div>
         <div class="c-name">${name}</div>
         <div class="c-body">has successfully participated and demonstrated excellent sportsmanship in the <strong>${e.title}</strong> held on ${new Date(e.date || e.event_date).toLocaleDateString()}.</div>
         <div class="c-footer">
           <div class="c-sig">${new Date().toLocaleDateString()}<br><span style="font-weight:normal; font-size:12px;">Date</span></div>
           <div class="c-sig" style="font-family: Great Vibes; font-size: 30px; padding-top:0; border:none; line-height:0.8;">Two Knights<br><span style="font-family: Montserrat; font-size:12px; font-weight:normal; border-top: 1px solid #333; display:block; padding-top:10px; margin-top:10px;">Academy Director</span></div>
         </div>
       </div>`;
    });

    certHTML += `</body></html>`;
    const certWindow = window.open("", "_blank");
    if (!certWindow) { toast("Popup blocked!", "error"); return; }
    certWindow.document.write(certHTML);
    certWindow.document.close();
};

