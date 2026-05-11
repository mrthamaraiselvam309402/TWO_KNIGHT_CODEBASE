/**
 * CHESSKIDOO ACADEMY — Expenditure Management Module
 * Frontend JS: expenditures.js
 * Handles: Add, List, Edit, Delete, Charts, Dashboard Widgets
 */

(function () {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────────
  const EXP_CATEGORIES = [
    'Rent', 'Coach Salary', 'Equipment', 'Snacks', 'Travel',
    'Tournament', 'Utilities', 'Marketing', 'Maintenance',
    'Platform & Software', 'Miscellaneous'
  ];
  const EXP_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque'];

  const CAT_COLORS = {
    'Rent':                 '#e84393',
    'Coach Salary':         '#f0c05a',
    'Equipment':            '#5a9fff',
    'Snacks':               '#52c41a',
    'Travel':               '#f9a825',
    'Tournament':           '#ab47bc',
    'Utilities':            '#26c6da',
    'Marketing':            '#ff7043',
    'Maintenance':          '#8d6e63',
    'Platform & Software':  '#42a5f5',
    'Miscellaneous':        '#78909c'
  };

  // ─── State ──────────────────────────────────────────────────────
  let allExpenditures = [];
  let expCurrentPage  = 1;
  const EXP_PAGE_SIZE = 15;
  let expEditingId    = null;
  let expChartPie     = null;
  let expChartLine    = null;
  let expFilterMonth  = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  // ─── API Helper (re-uses global apiCall from scripts.js) ────────
  async function apiCall(endpoint, opts = {}) {
    if (window.apiCall) return window.apiCall(endpoint, opts);
    // fallback
    const headers = {
      'Content-Type': 'application/json',
      'apikey':        window.SUPABASE_ANON_KEY || '',
      'Authorization': `Bearer ${localStorage.getItem('sb-access-token') || window.SUPABASE_ANON_KEY || ''}`
    };
    return fetch(endpoint, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  }

  function toastExp(msg, type = 'info') {
    if (window.toast) window.toast(msg, type);
    else console.log(`[${type}] ${msg}`);
  }

  // ─── Formatters ─────────────────────────────────────────────────
  function fmtCurrency(n) { return '₹' + parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function fmtDate(d)      { return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
  function fmtMonth(m)     {
    if (!m) return '';
    const [y, mo] = m.split('-');
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  // ─── Data Fetching ──────────────────────────────────────────────
  async function fetchExpenditures() {
    try {
      const res = await apiCall('/api/expenditures?limit=500');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      allExpenditures = json.data || [];
      return allExpenditures;
    } catch (e) {
      console.error('[Expenditures] fetch error:', e);
      allExpenditures = [];
      return [];
    }
  }

  async function fetchSummary() {
    try {
      const res = await apiCall(`/api/expenditures?mode=summary&month=${expFilterMonth}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error('[Expenditures] summary error:', e);
      return { total_expense: 0, total_income: 0, profit_or_loss: 0, category_totals: {} };
    }
  }

  // ─── Dashboard Widgets ──────────────────────────────────────────
  function renderExpDashboardWidgetsWithData(summary) {
    if (!summary) return;
    const setWidget = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setWidget('exp-widget-expense',  fmtCurrency(summary.total_expense));
    setWidget('exp-widget-income',   fmtCurrency(summary.total_income));

    const pl = summary.profit_or_loss;
    const plEl = document.getElementById('exp-widget-pl');
    if (plEl) {
      plEl.textContent = fmtCurrency(Math.abs(pl));
      plEl.className = 'stat-value ' + (pl >= 0 ? 'text-success' : 'text-danger');
    }
    const plLabelEl = document.getElementById('exp-widget-pl-label');
    if (plLabelEl) plLabelEl.textContent = pl >= 0 ? '📈 Net Profit' : '📉 Net Loss';

    // Pie chart
    renderExpPieChart(summary.category_totals || {});
    // Trend line chart
    renderExpTrendChart();
  }

  async function renderExpDashboardWidgets() {
    const summary = await fetchSummary();
    renderExpDashboardWidgetsWithData(summary);
  }

  // ─── Charts ─────────────────────────────────────────────────────
  function renderExpPieChart(catTotals) {
    const ctx = document.getElementById('exp-chart-pie');
    if (!ctx || typeof Chart === 'undefined') return;
    if (expChartPie) { expChartPie.destroy(); expChartPie = null; }

    const labels = Object.keys(catTotals).filter(k => catTotals[k] > 0);
    const data   = labels.map(k => catTotals[k]);
    const colors = labels.map(k => CAT_COLORS[k] || '#78909c');

    if (labels.length === 0) {
      ctx.style.display = 'none';
      const parent = ctx.parentElement;
      if (parent && !parent.querySelector('.exp-empty-pie')) {
        const d = document.createElement('div');
        d.className = 'empty-state exp-empty-pie';
        d.innerHTML = '<div class="empty-icon">📊</div><p>No data for this month</p>';
        parent.appendChild(d);
      }
      return;
    }

    const existingEmpty = ctx.parentElement && ctx.parentElement.querySelector('.exp-empty-pie');
    if (existingEmpty) existingEmpty.remove();
    ctx.style.display = '';

    expChartPie = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor:      'rgba(255,255,255,0.05)',
          borderWidth:      2,
          hoverOffset:      10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'right',
            labels:   { color: '#c8c4b8', font: { size: 11, family: 'Syne, sans-serif' }, padding: 14 }
          },
          tooltip: {
            backgroundColor: 'rgba(8,8,16,0.92)',
            titleColor:      '#f0ede4',
            bodyColor:       '#dca33e',
            borderColor:     'rgba(220,163,62,0.25)',
            borderWidth:     1,
            padding:         10,
            callbacks: { label: ctx => ` ${ctx.label}: ${fmtCurrency(ctx.raw)}` }
          }
        }
      }
    });
  }

  async function renderExpTrendChart() {
    const ctx = document.getElementById('exp-chart-trend');
    if (!ctx || typeof Chart === 'undefined') return;
    if (expChartLine) { expChartLine.destroy(); expChartLine = null; }

    // Build 6-month expense data from local state (fast) or re-fetch
    const months6 = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months6.push({
        key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
      });
    }

    const expByMonth = {};
    months6.forEach(m => expByMonth[m.key] = 0);
    allExpenditures.forEach(e => {
      const key = (e.date || '').slice(0, 7);
      if (expByMonth[key] !== undefined) expByMonth[key] += parseFloat(e.amount || 0);
    });

    const labels     = months6.map(m => m.label);
    const expValues  = months6.map(m => expByMonth[m.key] || 0);

    const gradCtx = ctx.getContext('2d');
    const grad    = gradCtx.createLinearGradient(0, 0, 0, 220);
    grad.addColorStop(0, 'rgba(255,77,79,0.4)');
    grad.addColorStop(1, 'rgba(255,77,79,0.02)');

    expChartLine = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label:            'Expenses',
          data:             expValues,
          borderColor:      '#ff4d4f',
          backgroundColor:  grad,
          fill:             true,
          tension:          0.45,
          pointBackgroundColor: '#ff4d4f',
          pointRadius:          4,
          pointHoverRadius:     7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend:  { display: false },
          tooltip: {
            backgroundColor: 'rgba(8,8,16,0.92)',
            titleColor:      '#f0ede4',
            bodyColor:       '#ff4d4f',
            borderColor:     'rgba(255,77,79,0.25)',
            borderWidth:     1,
            padding:         10,
            callbacks: { label: ctx => ` Expenses: ${fmtCurrency(ctx.raw)}` }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#7a7870', font: { size: 11 } } },
          y: {
            grid:      { color: 'rgba(255,255,255,0.04)' },
            ticks:     { color: '#7a7870', font: { size: 11 }, callback: v => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) },
            beginAtZero: true
          }
        }
      }
    });
  }

  function getFilteredExp() {
    const cat    = (document.getElementById('exp-f-cat')    || {}).value  || '';
    const mode   = (document.getElementById('exp-f-mode')   || {}).value  || '';
    const search = ((document.getElementById('exp-f-search') || {}).value || '').toLowerCase().trim();

    return allExpenditures.filter(e => {
      // 1. Must match current selected month filter (YYYY-MM)
      if (e.date && !e.date.startsWith(expFilterMonth)) return false;

      // 2. Category, payment mode, and text search filter constraints
      if (cat  && e.category    !== cat)  return false;
      if (mode && e.payment_mode !== mode) return false;
      if (search && !e.description.toLowerCase().includes(search) && !e.category.toLowerCase().includes(search)) return false;
      return true;
    });
  }

  function renderExpTable() {
    const tbody = document.getElementById('exp-tbody');
    if (!tbody) return;

    const filtered = getFilteredExp();
    const total    = filtered.length;
    const pages    = Math.max(1, Math.ceil(total / EXP_PAGE_SIZE));
    expCurrentPage = Math.min(expCurrentPage, pages);
    const start    = (expCurrentPage - 1) * EXP_PAGE_SIZE;
    const page     = filtered.slice(start, start + EXP_PAGE_SIZE);

    // Update count
    const countEl = document.getElementById('exp-count');
    if (countEl) countEl.textContent = `${total} record${total !== 1 ? 's' : ''}`;

    if (page.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><p>No expenses found</p></div></td></tr>`;
    } else {
      tbody.innerHTML = page.map(e => {
        const catColor = CAT_COLORS[e.category] || '#78909c';
        return `
        <tr>
          <td>${fmtDate(e.date)}</td>
          <td>
            <span class="exp-cat-badge" style="background:${catColor}22;color:${catColor};border:1px solid ${catColor}44">
              ${escHtml(e.category)}
            </span>
          </td>
          <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escHtml(e.description)}">${escHtml(e.description)}</td>
          <td style="font-family:var(--font-mono);color:var(--danger);font-weight:700">${fmtCurrency(e.amount)}</td>
          <td><span style="font-size:12px;color:var(--ivory3)">${escHtml(e.payment_mode)}</span></td>
          <td>
            ${e.bill_url
              ? `<a href="${escHtml(e.bill_url)}" target="_blank" class="btn btn-outline-info btn-sm" style="font-size:11px">📎 Bill</a>`
              : `<span style="color:var(--ivory3);font-size:11px">—</span>`
            }
          </td>
          <td>
            <div style="display:flex;gap:6px">
              <button class="btn btn-outline btn-sm" onclick="openEditExpense('${e.id}')" title="Edit">✏️</button>
              <button class="btn btn-danger btn-sm"  onclick="deleteExpense('${e.id}', '${escHtml(e.description.slice(0,40))}')" title="Delete">🗑️</button>
            </div>
          </td>
        </tr>`;
      }).join('');
    }

    renderExpPagination(pages);

    // Update summary row
    const monthTotal = filtered.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const sumEl = document.getElementById('exp-month-total');
    if (sumEl) sumEl.textContent = fmtCurrency(monthTotal);
  }

  function renderExpPagination(pages) {
    const pager = document.getElementById('exp-pager');
    if (!pager) return;
    if (pages <= 1) { pager.innerHTML = ''; return; }

    let html = `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center;padding-top:12px">`;
    html += `<button class="btn btn-outline-grey btn-sm" onclick="setExpPage(${expCurrentPage - 1})" ${expCurrentPage === 1 ? 'disabled' : ''}>‹ Prev</button>`;
    for (let i = 1; i <= pages; i++) {
      if (pages > 7 && i > 2 && i < pages - 1 && Math.abs(i - expCurrentPage) > 1) {
        if (i === 3 || i === pages - 2) html += `<span style="color:var(--ivory3);padding:0 4px">…</span>`;
        continue;
      }
      html += `<button class="btn ${i === expCurrentPage ? 'btn-gold' : 'btn-outline-grey'} btn-sm" onclick="setExpPage(${i})">${i}</button>`;
    }
    html += `<button class="btn btn-outline-grey btn-sm" onclick="setExpPage(${expCurrentPage + 1})" ${expCurrentPage === pages ? 'disabled' : ''}>Next ›</button>`;
    html += `</div>`;
    pager.innerHTML = html;
  }

  window.setExpPage = function(p) {
    expCurrentPage = Math.max(1, p);
    renderExpTable();
  };

  function escHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = String(text);
    return d.innerHTML;
  }

  // ─── Custom Category Helpers ─────────────────────────────────────
  function getCustomCategories() {
    let custom = [];
    try {
      custom = JSON.parse(localStorage.getItem('custom_exp_categories') || '[]');
    } catch(e) {}
    if (Array.isArray(allExpenditures)) {
      allExpenditures.forEach(e => {
        if (e.category && !EXP_CATEGORIES.includes(e.category) && !custom.includes(e.category)) {
          custom.push(e.category);
        }
      });
    }
    return custom;
  }

  function saveCustomCategory(cat) {
    if (!cat) return;
    const custom = getCustomCategories();
    if (!custom.includes(cat) && !EXP_CATEGORIES.includes(cat)) {
      custom.push(cat);
      localStorage.setItem('custom_exp_categories', JSON.stringify(custom));
    }
  }

  function populateCategoryDropdown(selectedVal = '') {
    const select = document.getElementById('exp-cat');
    if (!select) return;

    select.innerHTML = '';
    
    EXP_CATEGORIES.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });

    const custom = getCustomCategories();
    custom.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });

    const optNew = document.createElement('option');
    optNew.value = '__NEW__';
    optNew.textContent = '+ Add Custom Category...';
    select.appendChild(optNew);

    if (selectedVal) {
      if (!EXP_CATEGORIES.includes(selectedVal) && !custom.includes(selectedVal)) {
        const opt = document.createElement('option');
        opt.value = selectedVal;
        opt.textContent = selectedVal;
        select.insertBefore(opt, optNew);
      }
      select.value = selectedVal;
    } else {
      select.value = EXP_CATEGORIES[0];
    }

    checkCustomCategory(select.value);
  }

  window.checkCustomCategory = function (val) {
    const input = document.getElementById('exp-custom-cat');
    if (!input) return;
    if (val === '__NEW__') {
      input.style.display = 'block';
      input.required = true;
      input.focus();
    } else {
      input.style.display = 'none';
      input.required = false;
      input.value = '';
    }
  };

  // ─── Add / Edit Expense Modal ────────────────────────────────────
  window.openAddExpense = function () {
    expEditingId = null;
    resetExpForm();
    populateCategoryDropdown('');
    document.getElementById('exp-modal-title').textContent = 'Add Expense';
    document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
    openModal('exp-modal');
  };

  window.openEditExpense = function (id) {
    const exp = allExpenditures.find(e => e.id === id);
    if (!exp) { toastExp('Expense not found', 'error'); return; }
    expEditingId = id;
    resetExpForm();
    populateCategoryDropdown(exp.category || 'Miscellaneous');
    document.getElementById('exp-modal-title').textContent = 'Edit Expense';
    document.getElementById('exp-date').value         = exp.date        || '';
    document.getElementById('exp-desc').value         = exp.description || '';
    document.getElementById('exp-amount').value       = exp.amount      || '';
    document.getElementById('exp-mode').value         = exp.payment_mode|| 'Cash';
    document.getElementById('exp-bill-url').value     = exp.bill_url    || '';
    openModal('exp-modal');
  };

  function resetExpForm() {
    ['exp-date','exp-cat','exp-desc','exp-amount','exp-mode','exp-bill-url', 'exp-custom-cat'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = el.tagName === 'SELECT' ? el.options[0]?.value || '' : '';
    });
    const customInput = document.getElementById('exp-custom-cat');
    if (customInput) customInput.style.display = 'none';
    const errEl = document.getElementById('exp-form-error');
    if (errEl) errEl.textContent = '';
  }

  window.submitExpenseForm = async function () {
    const date   = (document.getElementById('exp-date')    || {}).value   || '';
    let cat      = (document.getElementById('exp-cat')     || {}).value   || 'Miscellaneous';
    const desc   = ((document.getElementById('exp-desc')   || {}).value   || '').trim();
    const amount = parseFloat((document.getElementById('exp-amount') || {}).value || '0');
    const mode   = (document.getElementById('exp-mode')   || {}).value    || 'Cash';
    const bill   = ((document.getElementById('exp-bill-url') || {}).value || '').trim();

    const errEl = document.getElementById('exp-form-error');
    const clearErr = () => { if (errEl) errEl.textContent = ''; };
    const showErr  = (msg) => { if (errEl) errEl.textContent = msg; };

    clearErr();
    if (!date)              { showErr('Date is required');               return; }
    
    if (cat === '__NEW__') {
      const customInput = document.getElementById('exp-custom-cat');
      const customVal = (customInput ? customInput.value : '').trim();
      if (!customVal) {
        showErr('Custom category name is required');
        return;
      }
      cat = customVal;
      saveCustomCategory(cat);
    }

    if (!desc || desc.length < 2) { showErr('Description is required (min 2 chars)'); return; }
    if (isNaN(amount) || amount <= 0) { showErr('Enter a valid amount > 0');          return; }

    const payload = { date, category: cat, description: desc, amount, payment_mode: mode, bill_url: bill || null };

    const btn = document.getElementById('exp-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = expEditingId ? 'Saving…' : 'Adding…'; }

    try {
      let res;
      if (expEditingId) {
        res = await apiCall(`/api/expenditures?id=${expEditingId}`, { method: 'PUT',  body: JSON.stringify(payload) });
      } else {
        res = await apiCall('/api/expenditures',                    { method: 'POST', body: JSON.stringify(payload) });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');

      toastExp(expEditingId ? 'Expense updated successfully' : 'Expense added successfully', 'success');
      closeModals();
      await loadExpenditurePage();
    } catch (e) {
      showErr(e.message || 'Failed to save expense');
      toastExp(e.message || 'Failed to save expense', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = expEditingId ? 'Save Changes' : 'Add Expense'; }
    }
  };

  // ─── Delete ─────────────────────────────────────────────────────
  window.deleteExpense = async function (id, desc) {
    if (!confirm(`Delete expense: "${desc}"?\n\nThis action cannot be undone.`)) return;
    try {
      const res  = await apiCall(`/api/expenditures?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toastExp('Expense deleted', 'success');
      await loadExpenditurePage();
    } catch (e) {
      toastExp(e.message || 'Failed to delete expense', 'error');
    }
  };

  // ─── Month filter ────────────────────────────────────────────────
  window.setExpMonth = async function (val) {
    expFilterMonth = val;
    expCurrentPage = 1;
    const lbl = document.getElementById('exp-month-label');
    if (lbl) lbl.textContent = fmtMonth(val);
    await loadExpenditurePage();
  };

  // ─── Local In-Memory Summary Calculations (Extremely Fast) ───────
  function calculateLocalSummary() {
    const [targetYear, targetMonth] = expFilterMonth.split('-').map(Number);
    
    let totalExpense = 0;
    const categoryTotals = {};
    
    if (Array.isArray(allExpenditures)) {
      allExpenditures.forEach(e => {
        // Double safety check: Only summarize expenditures for the currently selected month
        if (e.date && !e.date.startsWith(expFilterMonth)) return;

        const amt = parseFloat(e.amount || 0);
        totalExpense += amt;
        const cat = e.category || 'Miscellaneous';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
      });
    }

    let totalIncome = 0;
    const paymentsList = window.allPayments || [];
    if (Array.isArray(paymentsList)) {
      paymentsList.forEach(p => {
        if (p.status !== 'paid') return;
        
        const dateStr = p.payment_date || p.created_at;
        if (!dateStr) return;
        
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return;
        
        // Match year and month (using UTC to align with sync modules)
        const pYear = d.getUTCFullYear();
        const pMonth = d.getUTCMonth() + 1;
        
        if (pYear === targetYear && pMonth === targetMonth) {
          totalIncome += parseFloat(p.amount || 0);
        }
      });
    }

    return {
      total_expense: totalExpense,
      total_income: totalIncome,
      profit_or_loss: totalIncome - totalExpense,
      category_totals: categoryTotals
    };
  }

  // ─── Page Loader ─────────────────────────────────────────────────
  async function loadExpenditurePage() {
    const tbody = document.getElementById('exp-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7"><div class="loading-state"><span class="spinner"></span> Loading…</div></td></tr>`;

    // Fetch the expenditures list for the month (lightweight, rapid query)
    await fetchExpenditures();

    // Calculate sum metrics, charts, and profit/loss locally (instantaneous, 0ms wait!)
    const summary = calculateLocalSummary();

    renderExpTable();
    renderExpDashboardWidgetsWithData(summary);
  }

  // ─── Page Init (called by setPage router) ─────────────────────────
  window.initExpPage = async function () {
    // Set current month in picker
    const picker = document.getElementById('exp-month-picker');
    if (picker) {
      picker.value = expFilterMonth;
      picker.onchange = () => setExpMonth(picker.value);
    }
    const lbl = document.getElementById('exp-month-label');
    if (lbl) lbl.textContent = fmtMonth(expFilterMonth);

    // Wire filters
    ['exp-f-cat', 'exp-f-mode', 'exp-f-search'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => { expCurrentPage = 1; renderExpTable(); });
    });

    await loadExpenditurePage();
  };

  // Expose internals for dashboard summary widget on main dash page
  window.loadExpSummaryForDash = async function () {
    const summary = await fetchSummary();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('dash-exp-total',  fmtCurrency(summary.total_expense));
    set('dash-income-total', fmtCurrency(summary.total_income));
    const pl = summary.profit_or_loss;
    const plEl = document.getElementById('dash-pl');
    if (plEl) {
      plEl.textContent  = fmtCurrency(Math.abs(pl));
      plEl.className    = 'stat-value ' + (pl >= 0 ? 'text-success' : 'text-danger');
    }
  };

})();
