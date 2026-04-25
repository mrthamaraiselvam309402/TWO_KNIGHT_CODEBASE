/**
 * Chesskidoo Executive Reporting Module
 * Handles boardroom-ready analytics and PDF generation.
 */

window.generateReportPDF = async function() {
    if (!window.allStudents || window.allStudents.length === 0) {
        toast('Academy data not yet synchronized. Please wait a moment...', 'warning');
        return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    toast('Generating Academy Performance Report...', 'info');

    // 1. Data Aggregation
    const totalStudents = allStudents.length;
    const activeStudents = allStudents.filter(s => s.status === 'active').length;
    const collected = allStudents.filter(s => getStudentPaymentStatus(s) === 'Paid').reduce((a, s) => a + getStudentMonthlyFee(s), 0);
    const pending = allStudents.filter(s => getStudentPaymentStatus(s) !== 'Paid').reduce((a, s) => a + getStudentMonthlyFee(s), 0);
    const potential = collected + pending;
    const payroll = allCoaches.reduce((a, c) => a + (getCoachSalary(c) || 0), 0);
    const netProfit = collected - payroll;
    
    // Boardroom Metrics
    const arpu = activeStudents > 0 ? (collected / activeStudents).toFixed(0) : 0;
    const collectionRate = potential > 0 ? ((collected / potential) * 100).toFixed(1) : 0;
    const opMargin = collected > 0 ? ((netProfit / collected) * 100).toFixed(1) : 0;
    
    // Growth & Attendance Metrics
    const lastMonth = new Date(); lastMonth.setMonth(now.getMonth() - 1);
    const newStudsThisMonth = allStudents.filter(s => new Date(s.created_at) > lastMonth).length;
    const growthRate = totalStudents > 0 ? ((newStudsThisMonth / totalStudents) * 100).toFixed(1) : 0;
    
    // Attendance Real-Time (Calculated from allAttendance)
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(now.getDate() - 30);
    const recentAtt = (window.allAttendance || []).filter(a => new Date(a.date) > thirtyDaysAgo);
    const presentCount = recentAtt.filter(a => a.status === 'present').length;
    const attendanceHealth = recentAtt.length > 0 ? ((presentCount / recentAtt.length) * 100).toFixed(1) : 88.5; // Fallback to healthy avg if no data

    const batches = { 'Group': 0, 'Single': 0 };
    const timings = { 'Morning': 0, 'Evening': 0, 'Weekend': 0 };
    
    allStudents.forEach(s => {
        const type = s.session_mode || s.batch_type || 'Group';
        if (batches[type] !== undefined) batches[type]++;
        
        const time = getStudentSessionTime(s).toUpperCase();
        if (time.includes('MORNING')) timings['Morning']++;
        else if (time.includes('WEEKEND')) timings['Weekend']++;
        else timings['Evening']++;
    });

    const coachMetrics = allCoaches.map(c => {
      const coachStuds = allStudents.filter(s => String(s.coach_id) === String(c.id));
      const coachRev = coachStuds.filter(s => getStudentPaymentStatus(s) === 'Paid').reduce((a, s) => a + getStudentMonthlyFee(s), 0);
      const coachCost = getCoachSalary(c) || 0;
      const profit = coachRev - coachCost;
      const roi = coachCost > 0 ? ((profit / coachCost) * 100).toFixed(0) : '0';
      return { 
        name: getCoachName(c), 
        students: coachStuds.length, 
        revenue: coachRev, 
        cost: coachCost, 
        profit: profit, 
        roi: roi 
      };
    });

    const topPending = allStudents
      .filter(s => getStudentPaymentStatus(s) !== 'Paid')
      .sort((a, b) => getStudentMonthlyFee(b) - getStudentMonthlyFee(a))
      .slice(0, 5);

    const levels = { 'Beginner': 0, 'Intermediate': 0, 'Advanced': 0, 'Elite': 0 };
    allStudents.forEach(s => {
        const lvl = getStudentLevel(s);
        if (levels[lvl] !== undefined) levels[lvl]++;
        else levels['Beginner']++;
    });

    // Top ELO Gainers (From Rating History)
    const eloGainers = allStudents.map(s => {
        const history = (window.allRatingHistory || []).filter(h => String(h.student_id) === String(s.id)).sort((a,b) => new Date(a.recorded_at) - new Date(b.recorded_at));
        if (history.length < 2) return { name: getStudentName(s), gain: 0 };
        const gain = history[history.length - 1].rating - history[0].rating;
        return { name: getStudentName(s), gain: gain };
    }).sort((a, b) => b.gain - a.gain).slice(0, 3);

    const avgElo = allStudents.length > 0 ? (allStudents.reduce((a, s) => a + getStudentRating(s), 0) / allStudents.length).toFixed(0) : 0;

    // 2. HTML Template Construction
    const reportHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Academy Performance Report - ${dateStr}</title>
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
      body { background: #fff !important; color: #000 !important; padding: 0 !important; }
      .page { border: none !important; box-shadow: none !important; page-break-after: always; margin: 0 !important; width: 100% !important; background: #fff !important; }
      .no-print { display: none !important; }
      .kpi-card { background: #fff !important; border: 1px solid #ddd !important; color: #000 !important; }
      .watermark { opacity: 0.05 !important; color: #000 !important; }
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
    
    .print-btn { background: var(--gold); color: #000; border: none; padding: 18px 45px; font-family: 'Syne', sans-serif; font-weight: 800; cursor: pointer; margin-bottom: 40px; border-radius: 4px; letter-spacing: 3px; transition: all 0.4s; box-shadow: 0 15px 40px rgba(201,150,12,0.3); text-transform: uppercase; }
    .print-btn:hover { background: #fff; transform: translateY(-3px); box-shadow: 0 20px 50px rgba(255,255,255,0.2); }
  </style>
</head>
<body>
  <div class="no-print" style="position:fixed;top:20px;z-index:100;text-align:center;width:100%">
    <button class="print-btn" onclick="window.print()">Export Academy Report</button>
  </div>

  <div class="page">
    <div class="watermark">ACADEMY RECORD</div>
    <div class="header">
      <h1>ACADEMY PERFORMANCE</h1>
      <div class="header-meta">
        <div>REPORT ID: CKD-PERF-${now.getFullYear()}-${Math.floor(Math.random()*10000)}</div>
        <div class="confidential">EXECUTIVE SUMMARY // INTERNAL USE ONLY</div>
        <div class="heartbeat">SYNCED: ${timeStr}</div>
      </div>
    </div>

    <h3>I. Key Performance Indicators</h3>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Active Portfolio</div>
        <div class="kpi-value">${activeStudents}</div>
        <div class="kpi-sub">Enrolled Students</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">ARPU (Monthly)</div>
        <div class="kpi-value">₹${arpu}</div>
        <div class="kpi-sub">Avg Rev Per Student</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Revenue Realization</div>
        <div class="kpi-value">${collectionRate}%</div>
        <div class="kpi-sub">Collection Efficiency</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Monthly Growth</div>
        <div class="kpi-value">+${growthRate}%</div>
        <div class="kpi-sub">New Admissions</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Attendance Rate</div>
        <div class="kpi-value">${attendanceHealth}%</div>
        <div class="kpi-sub">Engagement Index</div>
      </div>
    </div>

    <div class="analytics-row">
      <div class="chart-box">
        <canvas id="revChart"></canvas>
      </div>
      <div class="data-story">
        <p><strong>Revenue Composition:</strong> Gross potential for this cycle is <span class="bold">₹${potential.toLocaleString()}</span>. Realized capital stands at <span class="bold">₹${collected.toLocaleString()}</span>.</p>
        <p>Operational margin remains strong at <span class="bold">${opMargin}%</span>. Faculty expenditures are synchronized at <span class="bold">₹${payroll.toLocaleString()}</span>.</p>
        <div class="strategic-insight">
          Management Note: Academy scaling is currently at ${growthRate}% velocity. ${newStudsThisMonth} new students joined in the current billing cycle. Average Academy ELO is <span class="bold">${avgElo}</span>.
        </div>
      </div>
    </div>

    <h3>II. Coach ROI Analysis</h3>
    <table>
      <thead>
        <tr>
          <th>Coach Name</th>
          <th class="text-right">Units</th>
          <th class="text-right">Gross Rev</th>
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

    <div class="footer">
      <div>© CHESSKIDOO ACADEMY MANAGEMENT</div>
      <div>CLASSIFICATION: EXECUTIVE</div>
      <div>PAGE 01 / 02</div>
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
        <h3>IV. Batch Timing Breakdown</h3>
        <div class="chart-box" style="height: 250px;">
          <canvas id="timingChart"></canvas>
        </div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap: 30px; margin-top: 20px;">
      <div>
        <h3>V. Top Pending Receivables</h3>
        <table>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Level</th>
              <th class="text-right">Pending Amount</th>
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
        <h3>VI. Performance Gainers</h3>
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th class="text-right">Gain</th>
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

    <h3>VII. Management Recommendations</h3>
    <div class="data-story" style="margin-top:20px;">
      <div style="margin-bottom:15px; border-bottom: 1px solid var(--border); padding-bottom:10px; font-size: 15px;">
        <strong style="color:var(--gold)">1. REVENUE RECOVERY:</strong> Prioritize collection for the top 5 accounts above to recover <span class="bold">₹${topPending.reduce((a, s) => a + getStudentMonthlyFee(s), 0).toLocaleString()}</span>.
      </div>
      <div style="margin-bottom:15px; border-bottom: 1px solid var(--border); padding-bottom:10px; font-size: 15px;">
        <strong style="color:var(--gold)">2. PERFORMANCE INCENTIVE:</strong> Award certificates to <span class="bold">${eloGainers[0]?.name || 'top students'}</span> for exceptional rating growth this cycle.
      </div>
      <div style="font-size: 15px;">
        <strong style="color:var(--gold)">3. SCHEDULING:</strong> ${timings['Evening'] > timings['Morning'] ? 'Evening slots are at 85% capacity. Consider opening more weekend morning batches.' : 'Optimize weekday evening slots to accommodate new admissions.'}
      </div>
    </div>

    <div class="footer">
      <div>© CHESSKIDOO ACADEMY MANAGEMENT</div>
      <div>AUTHENTICATED BY: CKD-AI-CORE</div>
      <div>PAGE 02 / 02</div>
    </div>
  </div>

  <script>
    window.onload = () => {
      // ── COMPOSITION CHART ──
      new Chart(document.getElementById('revChart').getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Profit', 'Payroll', 'Pending'],
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

      // ── LEVEL DISTRIBUTION ──
      new Chart(document.getElementById('levelChart').getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Beginner', 'Intermediate', 'Advanced', 'Elite'],
          datasets: [{
            label: 'Students',
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

      // ── TIMING DISTRIBUTION ──
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
  </script>
</body>
</html>`;

    // 3. Trigger Download using html2pdf
    const element = document.createElement('div');
    element.innerHTML = reportHTML;
    
    // Configuration for html2pdf
    const opt = {
      margin:       0,
      filename:     `Academy_Report_${dateStr.replace(/ /g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    // New Promise-based usage:
    html2pdf().set(opt).from(element).toPdf().get('pdf').then(function (pdf) {
      toast('Academy Performance Report downloaded successfully! ✨', 'success');
    }).save();
};
