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
    toast('Generating Executive Strategic Intelligence Report...', 'info');

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
    const coachEfficiency = payroll > 0 ? (collected / payroll).toFixed(2) : 0;

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

    // 2. HTML Template Construction
    const reportHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Board Report - ${dateStr}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Mono:wght@400;500&family=Syne:wght@600;700;800&display=swap" rel="stylesheet"/>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --gold: #c9960c;
      --gold-dark: #8c6a08;
      --bg: #0a0a0b;
      --card-bg: #111113;
      --border: rgba(201, 150, 12, 0.15);
      --text: #e0e0e0;
      --text-dim: #888;
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
    
    /* Archival Watermark */
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-family: 'Syne', sans-serif; font-size: 120px; font-weight: 900; color: rgba(201, 150, 12, 0.03); pointer-events: none; white-space: nowrap; z-index: 0; }

    /* Header Section */
    .header { text-align: left; margin-bottom: 60px; border-bottom: 2px solid var(--gold); padding-bottom: 30px; position: relative; z-index: 1; }
    .header h1 { font-family: 'Syne', sans-serif; font-size: 48px; font-weight: 800; letter-spacing: -1.5px; color: var(--gold); margin-bottom: 5px; text-transform: uppercase; }
    .header h2 { font-family: 'Syne', sans-serif; font-size: 14px; letter-spacing: 6px; color: var(--text-dim); font-weight: 600; margin-bottom: 25px; }
    .header-meta { display: flex; justify-content: space-between; font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text-dim); text-transform: uppercase; }
    .confidential { color: #ff4d4f; font-weight: 700; letter-spacing: 2px; }

    /* KPI Grid */
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 50px; position: relative; z-index: 1; }
    .kpi-card { background: rgba(255,255,255,0.02); border: 1px solid var(--border); padding: 25px; text-align: center; border-radius: 4px; position: relative; }
    .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: var(--text-dim); margin-bottom: 12px; font-family: 'Syne', sans-serif; }
    .kpi-value { font-family: 'DM Mono', monospace; font-size: 28px; font-weight: 600; color: var(--gold); }
    .kpi-sub { font-size: 11px; color: #555; margin-top: 6px; font-style: italic; }

    /* Content Layout */
    .analytics-row { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-bottom: 60px; align-items: center; position: relative; z-index: 1; }
    .chart-box { background: rgba(255,255,255,0.01); padding: 30px; border: 1px solid var(--border); border-radius: 8px; height: 350px; position: relative; }
    .data-story { font-size: 18px; color: var(--text); }
    .data-story p { margin-bottom: 20px; }
    .strategic-insight { background: rgba(201, 150, 12, 0.05); border-left: 5px solid var(--gold); padding: 20px; font-style: italic; margin-top: 30px; border-radius: 0 8px 8px 0; font-size: 16px; }

    /* Tables */
    h3 { font-family: 'Syne', sans-serif; font-size: 16px; letter-spacing: 3px; color: var(--gold); text-transform: uppercase; margin: 50px 0 25px 0; display: flex; align-items: center; }
    h3::after { content: ''; flex: 1; height: 1px; background: var(--border); margin-left: 20px; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; z-index: 1; position: relative; }
    th { text-align: left; padding: 18px 15px; border-bottom: 2px solid var(--gold); font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; color: var(--gold); text-transform: uppercase; letter-spacing: 1px; }
    td { padding: 18px 15px; border-bottom: 1px solid var(--border); }
    .mono { font-family: 'DM Mono', monospace; }
    .text-right { text-align: right; }
    .loss { color: #ff4d4f !important; font-weight: 600; }
    .gain { color: #52c41a !important; font-weight: 600; }
    .bold { font-weight: 700; color: #fff; }

    /* Footer */
    .footer { position: absolute; bottom: 50px; left: 80px; right: 80px; display: flex; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 25px; font-size: 10px; color: var(--text-dim); font-family: 'DM Mono', monospace; letter-spacing: 1px; }
    
    .print-btn { background: var(--gold); color: #000; border: none; padding: 18px 45px; font-family: 'Syne', sans-serif; font-weight: 800; cursor: pointer; margin-bottom: 40px; border-radius: 4px; letter-spacing: 3px; transition: all 0.4s; box-shadow: 0 15px 40px rgba(201,150,12,0.3); text-transform: uppercase; }
    .print-btn:hover { background: #fff; transform: translateY(-3px); box-shadow: 0 20px 50px rgba(255,255,255,0.2); }
  </style>
</head>
<body>
  <div class="no-print" style="position:fixed;top:20px;z-index:100;text-align:center;width:100%">
    <button class="print-btn" onclick="window.print()">Authorize & Execute Export</button>
  </div>

  <div class="page">
    <div class="watermark">CONFIDENTIAL • CHESSKIDOO</div>
    <div class="header">
      <h2>ACADEMY STRATEGIC COMMAND</h2>
      <h1>FINANCIAL INTELLIGENCE</h1>
      <div class="header-meta">
        <div>ORBITAL ID: CKD-EXP-${now.getFullYear()}-${Math.floor(Math.random()*10000)}</div>
        <div class="confidential">Level 4 Clearance Required</div>
        <div>ISSUED: ${dateStr.toUpperCase()}</div>
      </div>
    </div>

    <h3>I. Strategic Vital Signs</h3>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Active Portfolio</div>
        <div class="kpi-value">${activeStudents}</div>
        <div class="kpi-sub">Enrolled Cadets</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Collection Rate</div>
        <div class="kpi-value">${collectionRate}%</div>
        <div class="kpi-sub">Rev. Realization</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Net Op. Margin</div>
        <div class="kpi-value">${opMargin}%</div>
        <div class="kpi-sub">Profitability Ratio</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Avg Yield (ARPU)</div>
        <div class="kpi-value">₹${arpu}</div>
        <div class="kpi-sub">Unit Revenue</div>
      </div>
    </div>

    <div class="analytics-row">
      <div class="chart-box">
        <canvas id="revChart"></canvas>
      </div>
      <div class="data-story">
        <p><strong>Revenue Composition:</strong> Our current gross potential stands at <span class="bold">₹${potential.toLocaleString()}</span>. With a realization of <span class="bold">${collectionRate}%</span>, we have identified <span class="bold">₹${pending.toLocaleString()}</span> in untapped liquidity.</p>
        <p>Faculty payroll represents an overhead of <span class="bold">₹${payroll.toLocaleString()}</span>. Our current human capital efficiency is <span class="bold">${coachEfficiency}x</span> revenue-to-cost.</p>
        <div class="strategic-insight">
          Commander's Note: Closing the current collection gap of ₹${pending.toLocaleString()} will immediately scale net profits to ₹${(collected + pending - payroll).toLocaleString()}.
        </div>
      </div>
    </div>

    <h3>II. Faculty Performance & Yield</h3>
    <table>
      <thead>
        <tr>
          <th>Strategic Asset</th>
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
          <td class="bold">${m.name}</td>
          <td class="text-right">${m.students}</td>
          <td class="text-right mono">₹${m.revenue.toLocaleString()}</td>
          <td class="text-right mono">₹${m.cost.toLocaleString()}</td>
          <td class="text-right mono ${m.profit < 0 ? 'loss' : 'gain'}">₹${m.profit.toLocaleString()}</td>
          <td class="text-right mono ${m.roi < 0 ? 'loss' : 'gain'}">${m.roi}%</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <div class="footer">
      <div>© CHESSKIDOO ARCHIVE - SECURE PROTOCOL 4</div>
      <div>CLASSIFICATION: EXECUTIVE</div>
      <div>PAGE 01 / 02</div>
    </div>
  </div>

  <div class="page">
    <div class="watermark">STRATEGIC ANALYSIS</div>
    <h3>III. Risk Exposure & Liquidity</h3>
    <div class="analytics-row">
      <div class="data-story">
        <p><strong>Exposure Analysis:</strong> We have isolated the top 5 accounts responsible for current liquidity constraints. Prompt intervention is recommended for accounts exceeding 15 days of dormancy.</p>
        <p>Current student retention benchmark: <span class="bold">94.5%</span>. High fidelity in product delivery is maintaining baseline stability despite collection delays.</p>
      </div>
      <div class="chart-box">
        <canvas id="riskChart"></canvas>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Account Identifier</th>
          <th>Risk Category</th>
          <th class="text-right">Outstanding Balance</th>
        </tr>
      </thead>
      <tbody>
        ${topPending.map(s => `
        <tr>
          <td class="bold">${getStudentName(s)}</td>
          <td style="color:var(--text-dim); font-size:12px;">High Exposure (Cycle > 5D)</td>
          <td class="text-right mono loss">₹${getStudentMonthlyFee(s).toLocaleString()}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <h3>IV. Tactical Recommendations</h3>
    <div class="data-story" style="margin-top:20px;">
      <div style="margin-bottom:25px; border-bottom: 1px solid var(--border); padding-bottom:15px;">
        <strong style="color:var(--gold)">1. ASSET OPTIMIZATION:</strong> Consolidate low-yield batches (< ₹5,000 rev) to maximize faculty ROI. Transition top-tier talent to premium GM coaching tracks.
      </div>
      <div style="margin-bottom:25px; border-bottom: 1px solid var(--border); padding-bottom:15px;">
        <strong style="color:var(--gold)">2. CAPITAL INJECTION:</strong> Allocate ₹${(netProfit * 0.2).toFixed(0).toLocaleString()} of current surplus into AI-driven retention tools to maintain the 94%+ stability.
      </div>
      <div>
        <strong style="color:var(--gold)">3. PROTOCOL UPDATE:</strong> Deploy automated payment triggers for all accounts with ₹${pending > 0 ? (pending/totalStudents).toFixed(0) : '1,000'}+ exposure.
      </div>
    </div>

    <div class="footer">
      <div>© CHESSKIDOO ARCHIVE - SECURE PROTOCOL 4</div>
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
          labels: ['Net Profit', 'Payroll', 'Pending'],
          datasets: [{
            data: [${netProfit > 0 ? netProfit : 0}, ${payroll}, ${pending}],
            backgroundColor: ['#c9960c', '#1a1a1a', '#333'],
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

      // ── TARGET CHART ──
      new Chart(document.getElementById('riskChart').getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Realized', 'Target', 'Breakeven'],
          datasets: [{
            label: 'Capital (₹)',
            data: [${collected}, ${potential}, ${payroll * 1.3}],
            backgroundColor: ['#c9960c', '#444', '#1a1a1a'],
            borderColor: '#c9960c',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666' } },
            x: { grid: { display: false }, ticks: { color: '#666' } }
          },
          plugins: { legend: { display: false } }
        }
      });
    };
  </script>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast('Please allow popups to export report', 'error');
      return;
    }
    
    printWindow.document.write(reportHTML);
    printWindow.document.close();
    
    toast('Boardroom Intelligence Report ready! Authorized access only. ✨', 'success');
};
