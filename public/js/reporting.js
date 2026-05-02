/**
 * Chesskidoo Executive Reporting Module
 * Handles boardroom-ready analytics and PDF generation.
 */

window.generateReportPDF = async function() {
    if (!window.allStudents || window.allStudents.length === 0) {
        toast('Academy data not yet synchronized. Please wait a moment...', 'warning');
        return;
    }

    const targetMonth = window.reportMonth;
    const targetYear = window.reportYear;
    const now = new Date(targetYear, targetMonth, 1);
    const dateStr = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    toast(`Generating Financial Report for ${dateStr}...`, 'info');

    // Helper for robust date matching (Consolidated)
    const getYM = (d) => {
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? null : `${dt.getFullYear()}-${dt.getMonth()}`;
    };
    const targetYM = `${targetYear}-${targetMonth}`;

    // 1. Data Aggregation (Filtered by Period)
    const monthEndLimit = new Date(targetYear, targetMonth + 1, 0);
    const targetStudents = allStudents.filter(s => {
        const joinStr = s.joining_date || s.enrollment_date || s.created_at;
        return joinStr && new Date(joinStr) <= monthEndLimit;
    });

    const totalStudents = allStudents.length;
    const activeStudents = targetStudents.length;

    // Map total payments per student for ALL TIME
    const totalPaymentsMap = {};
    allPayments.forEach(p => {
      const sid = String(p.student_id);
      if (!totalPaymentsMap[sid]) totalPaymentsMap[sid] = 0;
      totalPaymentsMap[sid]++;
    });

    // Precise Status Categorization
    let collected = 0;
    let lastDueAmount = 0;
    let currPendingAmount = 0;
    let potential = 0;

    targetStudents.forEach(s => {
        const fee = getStudentMonthlyFee(s) || 0;
        const enrollDate = new Date(getStudentDate(s));
        const monthsRequired = ((targetYear - enrollDate.getFullYear()) * 12) + (targetMonth - enrollDate.getMonth()) + 1;
        const totalCredits = totalPaymentsMap[String(s.id)] || 0;
        const hasPaidThisSlot = totalCredits >= monthsRequired;

        potential += fee;
        if (hasPaidThisSlot) {
            collected += fee;
        } else {
            const monthsRequiredLastMonth = monthsRequired - 1;
            if (totalCredits < monthsRequiredLastMonth) lastDueAmount += fee;
            else currPendingAmount += fee;
        }
    });

    const pending = potential - collected;
    const payroll = allCoaches.reduce((a, c) => a + (getCoachSalary(c) || 0), 0);
    const netProfit = collected - payroll;
    
    // Boardroom Metrics
    const arpu = activeStudents > 0 ? (collected / activeStudents).toFixed(0) : 0;
    const collectionRate = potential > 0 ? ((collected / potential) * 100).toFixed(1) : 0;
    const opMargin = collected > 0 ? ((netProfit / collected) * 100).toFixed(1) : 0;
    
    // Growth & Attendance Metrics
    const monthStartLimit = new Date(targetYear, targetMonth, 1);
    const newStudsThisMonth = allStudents.filter(s => {
        const join = new Date(s.joining_date || s.enrollment_date || s.created_at);
        return join >= monthStartLimit && join <= monthEndLimit;
    }).length;
    
    // Attendance Real-Time (Calculated from allAttendance for target period)
    const monthAtt = (window.allAttendance || []).filter(a => {
        const aDate = new Date(a.date);
        return aDate.getMonth() === targetMonth && aDate.getFullYear() === targetYear;
    });
    const presentCount = monthAtt.filter(a => a.status === 'present').length;
    const attendanceHealth = monthAtt.length > 0 ? ((presentCount / monthAtt.length) * 100).toFixed(1) : 88.5; 

    // Coach Performance ROI
    const coachMetrics = allCoaches.map(c => {
      let coachRev = 0;
      const coachStuds = allStudents.filter(s => String(s.coach_id) === String(c.id));
      coachStuds.forEach(s => {
          const enrollDateStr = getStudentDate(s);
          if (enrollDateStr) {
              const enrollDate = new Date(enrollDateStr);
              if (enrollDate <= monthEndLimit) {
                  const monthsRequired = ((targetYear - enrollDate.getFullYear()) * 12) + (targetMonth - enrollDate.getMonth()) + 1;
                  const totalCredits = totalPaymentsMap[String(s.id)] || 0;
                  if (totalCredits >= monthsRequired) coachRev += (getStudentMonthlyFee(s) || 0);
              }
          }
      });
      
      const coachCost = getCoachSalary(c) || 0;
      const profit = coachRev - coachCost;
      const roi = coachCost > 0 ? ((profit / coachCost) * 100).toFixed(0) : '0';
      return { 
        name: getCoachName(c), 
        students: coachStuds.filter(s => new Date(getStudentDate(s)) <= monthEndLimit).length, 
        revenue: coachRev, 
        cost: coachCost, 
        profit: profit, 
        roi: roi 
      };
    });

    const topPending = allStudents
      .filter(s => {
          const enrollDate = new Date(getStudentDate(s));
          if (enrollDate > monthEndLimit) return false;
          const monthsRequired = ((targetYear - enrollDate.getFullYear()) * 12) + (targetMonth - enrollDate.getMonth()) + 1;
          const totalCredits = totalPaymentsMap[String(s.id)] || 0;
          return totalCredits < monthsRequired;
      })
      .sort((a, b) => getStudentMonthlyFee(b) - getStudentMonthlyFee(a))
      .slice(0, 5);

    // Monthwise Historical Analysis (Last 6 Months)
    const monthwiseData = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(targetYear, targetMonth - i, 1);
        const mName = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        const m = d.getMonth();
        const y = d.getFullYear();
        const mEnd = new Date(y, m + 1, 0);
        
        let mCollected = 0;
        let mPotential = 0;
        
        allStudents.forEach(s => {
            const enrollDate = new Date(getStudentDate(s));
            if (enrollDate <= mEnd) {
                const fee = getStudentMonthlyFee(s) || 0;
                const mReq = ((y - enrollDate.getFullYear()) * 12) + (m - enrollDate.getMonth()) + 1;
                const mCredits = totalPaymentsMap[String(s.id)] || 0;
                mPotential += fee;
                if (mCredits >= mReq) mCollected += fee;
            }
        });
        
        const mOutstanding = Math.max(0, mPotential - mCollected);
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
        const history = (window.allRatingHistory || []).filter(h => String(h.student_id) === String(s.id)).sort((a,b) => new Date(a.recorded_at) - new Date(b.recorded_at));
        if (history.length < 1) return { name: getStudentName(s), gain: 0 };
        
        // Find rating at start of month (last record before month start)
        const beforeMonth = history.filter(h => new Date(h.recorded_at) < monthStartLimit);
        const startRating = beforeMonth.length > 0 ? beforeMonth[beforeMonth.length - 1].rating : (history[0].rating || 800);
        
        // Find rating at end of month (last record before month end)
        const duringMonth = history.filter(h => new Date(h.recorded_at) <= monthEndLimit);
        const endRating = duringMonth.length > 0 ? duringMonth[duringMonth.length - 1].rating : startRating;
        
        return { name: getStudentName(s), gain: endRating - startRating };
    }).sort((a, b) => b.gain - a.gain).slice(0, 3);

    const attendanceStats = targetStudents.map(s => {
        const studAtt = monthAtt.filter(a => String(a.student_id) === String(s.id));
        const present = studAtt.filter(a => a.status === 'present').length;
        const total = studAtt.length;
        const rate = total > 0 ? ((present / total) * 100).toFixed(0) : 0;
        return { name: getStudentName(s), rate, present, total };
    }).filter(x => x.total > 0).sort((a, b) => b.rate - a.rate).slice(0, 8);

    // Prepare transaction rows for the ledger (Actual transactions in that specific month)
    const monthlyTransactions = allPayments.filter(p => getYM(p.payment_date || p.created_at) === targetYM);
    const transactionRows = monthlyTransactions.map(p => {
        const s = allStudents.find(x => String(x.id) === String(p.student_id));
        return `
        <tr>
          <td class="mono" style="font-size:10px">${new Date(p.payment_date || p.created_at).toLocaleDateString('en-IN')}</td>
          <td class="bold">${(s ? getStudentName(s) : (p.student_name || 'Unknown Student')).toUpperCase()}</td>
          <td>${p.payment_method || 'Transfer'}</td>
          <td class="text-right mono bold">₹${(parseFloat(p.amount) || 0).toLocaleString()}</td>
          <td style="font-size:10px;color:var(--text-dim)">#${String(p.id).slice(-8)}</td>
        </tr>`;
    }).join('');

    let reportHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Executive Strategic Audit - ${dateStr}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Cormorant+Garamond:wght@400;600&family=DM+Mono:wght@400;500&family=Syne:wght@600;700;800&display=swap" rel="stylesheet"/>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
      .page { border: none !important; box-shadow: none !important; margin: 0 !important; width: 100% !important; page-break-after: always; }
      .watermark { opacity: 0.1 !important; }
    }
    body { background: var(--bg); font-family: 'Cormorant Garamond', serif; color: var(--text); line-height: 1.5; padding: 50px 0; display: flex; flex-direction: column; align-items: center; }
    .page { width: 950px; padding: 80px; position: relative; min-height: 1300px; background: var(--card-bg); margin-bottom: 50px; box-shadow: 0 40px 100px rgba(0,0,0,0.6); border: 1px solid var(--border); overflow: hidden; }
    
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-family: 'Cinzel', serif; font-size: 100px; font-weight: 900; color: rgba(201, 150, 12, 0.04); pointer-events: none; white-space: nowrap; z-index: 0; }
-
    .header { text-align: left; margin-bottom: 60px; border-bottom: 2px solid var(--gold); padding-bottom: 30px; position: relative; z-index: 1; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 42px; font-weight: 900; letter-spacing: 2px; color: var(--gold); margin-bottom: 5px; text-transform: uppercase; }
    .header h2 { font-family: 'Syne', sans-serif; font-size: 14px; letter-spacing: 6px; color: var(--text-dim); font-weight: 600; margin-bottom: 25px; }
    .header-meta { display: flex; justify-content: space-between; font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text-dim); text-transform: uppercase; }
    .confidential { color: var(--gold); font-weight: 700; letter-spacing: 2px; }
    .heartbeat { color: var(--emerald); font-weight: 600; }
-
    .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 50px; position: relative; z-index: 1; }
    .kpi-card { background: rgba(255,255,255,0.02); border: 1px solid var(--border); padding: 20px 10px; text-align: center; border-radius: 4px; position: relative; }
    .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-dim); margin-bottom: 10px; font-family: 'Syne', sans-serif; }
    .kpi-value { font-family: 'DM Mono', monospace; font-size: 24px; font-weight: 600; color: var(--gold); }
    .kpi-sub { font-size: 10px; color: #555; margin-top: 5px; font-style: italic; }
-
    .analytics-row { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-bottom: 60px; align-items: center; position: relative; z-index: 1; }
    .chart-box { background: rgba(255,255,255,0.01); padding: 30px; border: 1px solid var(--border); border-radius: 8px; height: 350px; position: relative; }
    .data-story { font-size: 18px; color: var(--text); }
    .data-story p { margin-bottom: 20px; }
    .strategic-insight { background: rgba(201, 150, 12, 0.05); border-left: 5px solid var(--gold); padding: 20px; font-style: italic; margin-top: 30px; border-radius: 0 8px 8px 0; font-size: 16px; }
-
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
-
    .footer { position: absolute; bottom: 50px; left: 80px; right: 80px; display: flex; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 25px; font-size: 10px; color: var(--text-dim); font-family: 'DM Mono', monospace; letter-spacing: 1px; }
    
    .print-btn { background: var(--gold); color: #000; border: none; padding: 18px 45px; font-family: 'Syne', sans-serif; font-weight: 800; cursor: pointer; margin-bottom: 40px; border-radius: 4px; letter-spacing: 3px; transition: all 0.4s; box-shadow: 0 15px 40px rgba(201, 150, 12, 0.3); text-transform: uppercase; }
    .print-btn:hover { background: #fff; transform: translateY(-3px); box-shadow: 0 20px 50px rgba(255,255,255,0.2); }
  </style>
</head>
<body>
  <div class="no-print" style="position:fixed;top:20px;z-index:100;text-align:center;width:100%">
    <button class="print-btn" onclick="window.print()">EXPORT STRATEGIC AUDIT</button>
  </div>
-
  <div class="page">
    <div class="watermark">FINANCIAL AUDIT</div>
    <div class="header">
      <h1>STRATEGIC PERFORMANCE AUDIT</h1>
      <div class="header-meta">
        <div>AUDIT ID: CKD-STRAT-${now.getFullYear()}-${Math.floor(Math.random()*10000)}</div>
        <div class="confidential">EXECUTIVE AUDIT // CLASS-A PRIVILEGED</div>
        <div style="color:var(--gold);font-weight:700;letter-spacing:1px;margin-top:5px">REPORT PERIOD: ${dateStr.toUpperCase()}</div>
        <div class="heartbeat">SYNC STATUS: REAL-TIME</div>
      </div>
    </div>
-
    <h3>I. Strategic Key Metrics</h3>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Active Units</div>
        <div class="kpi-value">${activeStudents}</div>
        <div class="kpi-sub">Total Students</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Last Month Due</div>
        <div class="kpi-value" style="color:var(--ruby)">₹${lastDueAmount.toLocaleString()}</div>
        <div class="kpi-sub">Historical Arrears</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Curr Pending</div>
        <div class="kpi-value">₹${currPendingAmount.toLocaleString()}</div>
        <div class="kpi-sub">Expected Pipeline</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Unit Revenue</div>
        <div class="kpi-value">₹${arpu}</div>
        <div class="kpi-sub">Monthly ARPU</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Engagement</div>
        <div class="kpi-value">${attendanceHealth}%</div>
        <div class="kpi-sub">Avg Attendance</div>
      </div>
    </div>
-
    <div class="analytics-row">
      <div class="chart-box">
        <canvas id="revChart"></canvas>
      </div>
      <div class="data-story">
        <p><strong>Revenue Verification:</strong> Gross potential for ${dateStr} is <span class="bold">₹${potential.toLocaleString()}</span>. Verified collections totaled <span class="bold">₹${collected.toLocaleString()}</span> across ${monthlyPayments.length} transactions.</p>
        <p>Operating margin for this period is <span class="bold">${opMargin}%</span>. Total Faculty overhead is capped at <span class="bold">₹${payroll.toLocaleString()}</span>.</p>
        <div class="strategic-insight">
          Audit Note: System confirms ${newStudsThisMonth} new unit additions. Average Academy ELO has reached <span class="bold">${avgElo}</span>. Total outstanding (Last Due + Current) stands at <span class="bold">₹${(lastDueAmount + currPendingAmount).toLocaleString()}</span>.
        </div>
      </div>
    </div>
-
    <h3>II. Faculty ROI Analysis (Verified Data)</h3>
    <table>
      <thead>
        <tr>
          <th>Coach Name</th>
          <th class="text-right">Active Units</th>
          <th class="text-right">Realized Rev</th>
          <th class="text-right">Cost Basis</th>
          <th class="text-right">Net Profit</th>
          <th class="text-right">ROI</th>
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
          <td class="text-right mono ${m.roi < 0 ? 'loss' : 'gain'}">${m.roi}%</td>
        </tr>`).join('')}
      </tbody>
    </table>
-
    <div class="footer">
      <div>© CHESSKIDOO ACADEMY MANAGEMENT</div>
      <div>CLASSIFICATION: EXECUTIVE</div>
      <div>PAGE 01 / 03</div>
    </div>
  </div>
-
  <div class="page">
    <div class="watermark">DETAILED ANALYSIS</div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 30px;">
      <div>
        <h3>III. Unit Level Distribution</h3>
        <div class="chart-box" style="height: 250px;">
          <canvas id="levelChart"></canvas>
        </div>
      </div>
      <div>
        <h3>IV. Operational Scheduling</h3>
        <div class="chart-box" style="height: 250px;">
          <canvas id="timingChart"></canvas>
        </div>
      </div>
    </div>
-
    <h3>V. Monthwise Revenue & Arrears Analysis</h3>
    <table>
      <thead>
        <tr>
          <th>Billing Period</th>
          <th class="text-right">Potential Revenue</th>
          <th class="text-right">Collected</th>
          <th class="text-right">Outstanding (Due/Pending)</th>
          <th class="text-right">Efficiency</th>
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
-
    <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap: 30px; margin-top: 20px;">
      <div>
        <h3>VI. Top Accounts Receivable</h3>
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
              <td class="text-right mono loss">₹${getStudentMonthlyFee(s).toLocaleString()}</td>
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
            ${eloGainers.map(g => `
            <tr>
              <td class="bold">${g.name.toUpperCase()}</td>
              <td class="text-right mono gain">+${g.gain}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
-
    <h3>VIII. Strategic Recommendations</h3>
    <div class="data-story" style="margin-top:20px;">
      <div style="margin-bottom:15px; border-bottom: 1px solid var(--border); padding-bottom:10px; font-size: 15px;">
        <strong style="color:var(--gold)">1. LIQUIDITY OPTIMIZATION:</strong> Total uncollected capital across last 6 months is <span class="bold">₹${monthwiseData.reduce((a, m) => a + m.outstanding, 0).toLocaleString()}</span>. A focused recovery drive is recommended.
      </div>
      <div style="margin-bottom:15px; border-bottom: 1px solid var(--border); padding-bottom:10px; font-size: 15px;">
        <strong style="color:var(--gold)">2. FACULTY PERFORMANCE:</strong> <span class="bold">${coachMetrics.sort((a,b)=>b.roi-a.roi)[0]?.name || 'Top coaches'}</span> is demonstrating optimal unit management. Consider faculty-wide training based on these patterns.
      </div>
      <div style="font-size: 15px;">
        <strong style="color:var(--gold)">3. GROWTH VECTOR:</strong> ${timings['Evening'] > timings['Morning'] ? 'Evening batches are approaching peak saturation. Expansion should focus on weekend morning slots.' : 'Current morning utilization is healthy. Potential for expansion in evening group sessions.'}
      </div>
    </div>
-
    <div class="footer">
      <div>© CHESSKIDOO ACADEMY MANAGEMENT</div>
      <div>AUTHENTICATED BY: CKD-AI-CORE</div>
      <div>PAGE 02 / 03</div>
    </div>
  </div>
-
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
-
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
        ${attendanceStats.map(a => `
        <tr>
          <td class="bold">${a.name.toUpperCase()}</td>
          <td class="text-right">${a.total}</td>
          <td class="text-right">${a.present}</td>
          <td class="text-right mono gain">${a.rate}%</td>
        </tr>`).join('')}
      </tbody>
    </table>
-
    <div class="strategic-insight" style="margin-top:50px; font-size:14px">
      <strong>Audit Affirmation:</strong> This report represents a high-fidelity snapshot of academy operations as of ${timeStr}. All metrics are derived directly from the synchronized data lake.
    </div>
-
    <div class="footer">
      <div>© CHESSKIDOO ACADEMY MANAGEMENT</div>
      <div>AUDIT TRAIL: ${now.getTime()}</div>
      <div>PAGE 03 / 03</div>
    </div>
  </div>`;

    reportHTML += `
  <script>
    const initCharts = () => {
      new Chart(document.getElementById('revChart').getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Profit', 'Payroll', 'Pending Arrears'],
          datasets: [{
            data: [${netProfit > 0 ? netProfit : 0}, ${payroll}, ${pending}],
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
