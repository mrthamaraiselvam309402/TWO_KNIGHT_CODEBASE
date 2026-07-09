/**
 * Two Knights ACADEMY — Expenditure Management Module
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
  // FIX: Default to current month so dashboard widgets and table both have data on first load.
  // Empty string means "all-time" but the local summary calc previously returned zeros for empty filter,
  // which made the dashboard look broken.
  let expFilterMonth  = (function () {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  // ─── API Helper (re-uses global apiCall from scripts.js) ────────
  async function apiCall(endpoint, opts = {}) {
    if (window.apiCall) return window.apiCall(endpoint, opts);
    // fallback — only forward a stored token if it's a real JWT (the custom
    // auth stores a non-JWT placeholder which the gateway rejects).
    const _tok = localStorage.getItem('sb-access-token');
    const _bearer = (_tok && _tok.startsWith('eyJ')) ? _tok : (window.SUPABASE_ANON_KEY || '');
    const headers = {
      'Content-Type': 'application/json',
      'apikey':        window.SUPABASE_ANON_KEY || '',
      'Authorization': `Bearer ${_bearer}`
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
    if (!m) return 'All Time';
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
      window.allExpenditures = allExpenditures; // shared with reports/exports
      return allExpenditures;
    } catch (e) {
      console.error('[Expenditures] fetch error:', e);
      allExpenditures = [];
      window.allExpenditures = allExpenditures;
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
      // Filter out Event Expenses so they don't clutter global expenditures
      if (e.type === 'Event Expense') return false;
      // 1. Must match current selected month filter (YYYY-MM). Empty filter = all-time.
      if (expFilterMonth && e.date && !e.date.startsWith(expFilterMonth)) return false;

      // 2. Category, payment mode, and text search filter constraints
      if (cat  && e.category    !== cat)  return false;
      if (mode && e.payment_mode !== mode) return false;
      // FIX: defensive null/undefined guards on description/category before .toLowerCase()
      if (search) {
        const desc = (e.description || '').toLowerCase();
        const catText = (e.category || '').toLowerCase();
        if (!desc.includes(search) && !catText.includes(search)) return false;
      }
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
              <button class="btn btn-outline btn-sm" onclick="openEditExpense('${escHtml(String(e.id))}')" title="Edit">✏️</button>
              <button class="btn btn-danger btn-sm"  onclick="deleteExpense('${escHtml(String(e.id))}', '${escHtml(e.description.slice(0,40))}')" title="Delete">🗑️</button>
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

    window.checkCustomCategory(select.value);
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
    // FIX: string-safe ID comparison — IDs come through as escaped strings from the table HTML
    const exp = allExpenditures.find(e => String(e.id) === String(id));
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

      // FIX: defensive parse — some 204/empty responses break .json()
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);

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
      const res  = await apiCall(`/api/expenditures?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      // FIX: defensive parse — DELETE may return empty body
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Delete failed (${res.status})`);
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
    // FIX: previously returned all zeros if filter was empty (all-time), making widgets
    // appear broken. Now empty filter aggregates across all data.
    const allTime = !expFilterMonth || !expFilterMonth.includes('-');
    let targetYear = null, targetMonth = null;
    if (!allTime) {
      const parts = expFilterMonth.split('-').map(Number);
      targetYear = parts[0];
      targetMonth = parts[1];
    }

    let totalExpense = 0;
    const categoryTotals = {};

    if (Array.isArray(allExpenditures)) {
      allExpenditures.forEach(e => {
        // Only summarize expenditures for the currently selected month (or all-time)
        if (!allTime && e.date && !e.date.startsWith(expFilterMonth)) return;
        if (e.type === 'Event Expense') return;

        const amt = parseFloat(e.amount || 0);
        if (isNaN(amt)) return;
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

        if (allTime) {
          totalIncome += parseFloat(p.amount || 0);
        } else {
          // Match year and month (using UTC to align with sync modules)
          const pYear = d.getUTCFullYear();
          const pMonth = d.getUTCMonth() + 1;
          if (pYear === targetYear && pMonth === targetMonth) {
            totalIncome += parseFloat(p.amount || 0);
          }
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
      picker.onchange = () => window.setExpMonth(picker.value);
    }
    const lbl = document.getElementById('exp-month-label');
    if (lbl) lbl.textContent = fmtMonth(expFilterMonth);

    // Wire filters
    ['exp-f-cat', 'exp-f-mode', 'exp-f-search'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => { expCurrentPage = 1; renderExpTable(); });
    });

    // Auto-categorization listener
    const descInput = document.getElementById('exp-desc');
    if (descInput) {
      descInput.addEventListener('keyup', window.autoCategorizeExpense);
    }

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

  // ─── AI Guardian FinOps Logic ────────────────────────────────────
  window.autoCategorizeExpense = function() {
    const desc = (document.getElementById('exp-desc').value || '').toLowerCase();
    const catSelect = document.getElementById('exp-cat');
    if (!desc || !catSelect) return;
    
    // Do not override if user already explicitly chose something else manually (unless it's default 'Miscellaneous')
    // A heuristic ruleset
    const rules = {
      'facebook': 'Marketing',
      'instagram': 'Marketing',
      'ads': 'Marketing',
      'salary': 'Coach Salary',
      'coach': 'Coach Salary',
      'internet': 'Utilities',
      'electricity': 'Utilities',
      'power': 'Utilities',
      'water': 'Utilities',
      'rent': 'Rent',
      'snacks': 'Snacks',
      'food': 'Snacks',
      'pizza': 'Snacks',
      'board': 'Equipment',
      'clock': 'Equipment',
      'pieces': 'Equipment',
      'zoom': 'Platform & Software',
      'google': 'Platform & Software',
      'vercel': 'Platform & Software',
      'supabase': 'Platform & Software',
      'flight': 'Travel',
      'train': 'Travel',
      'uber': 'Travel',
      'ola': 'Travel'
    };

    for (let key in rules) {
      if (desc.includes(key)) {
        if (catSelect.value === 'Miscellaneous' || catSelect.value === '') {
          catSelect.value = rules[key];
          toastExp(`🤖 AI auto-categorized as ${rules[key]}`, 'info');
        }
        break;
      }
    }
  };

  window.openFinOpsReport = async function() {
    openModal('finops-report-modal');
    document.getElementById('finops-loading').style.display = 'block';
    document.getElementById('finops-content').style.display = 'none';

    try {
      // Refresh data
      await fetchExpenditures();
      
      let total6MonthSpend = 0;
      let monthCounts = {};
      let catAvgs = {};
      let anomaliesHtml = '';
      let duplicateHtml = '';
      
      const now = new Date();
      // Calculate 6 month burn
      allExpenditures.forEach(e => {
        if (!e.date || e.type === 'Event Expense') return;
        const eDate = new Date(e.date);
        const diffMonths = (now.getFullYear() - eDate.getFullYear()) * 12 + (now.getMonth() - eDate.getMonth());
        
        if (diffMonths >= 0 && diffMonths < 6) {
          const amt = parseFloat(e.amount || 0);
          total6MonthSpend += amt;
          monthCounts[diffMonths] = true;
          
          if (!catAvgs[e.category]) catAvgs[e.category] = { total: 0, count: 0 };
          catAvgs[e.category].total += amt;
          catAvgs[e.category].count += 1;
        }
      });
      
      const numMonths = Object.keys(monthCounts).length || 1;
      const avgSpend = total6MonthSpend / numMonths;
      
      // Calculate anomalies (Spikes > 150% of avg)
      let recentExp = allExpenditures.filter(e => {
         if (!e.date) return false;
         const diff = (now - new Date(e.date)) / (1000*60*60*24);
         return diff <= 30 && e.type !== 'Event Expense';
      });
      
      let anomaliesCount = 0;
      recentExp.forEach(e => {
        const catStats = catAvgs[e.category];
        if (catStats && catStats.count > 2) {
          const catAvg = catStats.total / catStats.count;
          const amt = parseFloat(e.amount);
          if (amt > catAvg * 1.5 && catAvg > 100) {
            anomaliesHtml += `<div style="margin-bottom:8px;">🔴 <b>${escHtml(e.category)}</b> spike: <b>${fmtCurrency(amt)}</b> for "${escHtml(e.description)}" (Avg: ${fmtCurrency(catAvg)})</div>`;
            anomaliesCount++;
          }
        }
      });
      
      // Check duplicates
      let seen = {};
      let dupeCount = 0;
      recentExp.forEach(e => {
        const key = `${e.date}_${e.amount}_${e.category}`;
        if (seen[key]) {
          duplicateHtml += `<div style="margin-bottom:8px;">⚠️ <b>Duplicate found:</b> ${fmtCurrency(e.amount)} on ${fmtDate(e.date)} for "${escHtml(e.category)}"</div>`;
          dupeCount++;
        }
        seen[key] = true;
      });

      // Update UI
      document.getElementById('finops-avg-spend').textContent = fmtCurrency(avgSpend);
      document.getElementById('finops-predicted-spend').textContent = fmtCurrency(avgSpend * 1.05); // 5% inflation buffer
      
      const aContainer = document.getElementById('finops-anomalies');
      if (anomaliesCount > 0) aContainer.innerHTML = anomaliesHtml;
      else aContainer.innerHTML = `<div style="color:var(--success);">✅ No anomalies detected in the last 30 days.</div>`;
      
      const dContainer = document.getElementById('finops-duplicates');
      if (dupeCount > 0) dContainer.innerHTML = duplicateHtml;
      else dContainer.innerHTML = `<div style="color:var(--success);">✅ No duplicate expenses found.</div>`;

      // Show content
      document.getElementById('finops-loading').style.display = 'none';
      document.getElementById('finops-content').style.display = 'block';

    } catch (e) {
      console.error(e);
      document.getElementById('finops-loading').innerHTML = '<span style="color:var(--danger)">Failed to run AI Audit</span>';
    }
  };

})();
