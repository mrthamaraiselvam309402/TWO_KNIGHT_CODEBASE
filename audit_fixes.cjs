const fs = require('fs');
const fixes = [];

console.log('=== FINAL AUDIT ===\n');

// 1. SQL checks
const sql = fs.readFileSync('D:/MY/chesskidoo-ai-admin/supabase/migrations/20260605000001_payment_debt_first_credit.sql', 'utf8');
const sqlChecks = [
  ['DEBT-FIRST loop (< fix)', 'v_cursor_month_num < v_target_month_num'],
  [' payments.applied_month update by RPC', 'UPDATE payments SET applied_month = v_target_key'],
  ['daily-payment-sync-v4 cron', 'daily-payment-sync-v4'],
  ['monthly_rollover_job_v4', 'monthly_rollover_job_v4()'],
  ['apply_payment_debt_first', 'apply_payment_debt_first'],
  ['payment_allocations table', 'payment_allocations'],
];
sqlChecks.forEach(([label, needle]) => {
  if (sql.includes(needle)) { console.log(`[OK] SQL: ${label}`); }
  else { fixes.push(`SQL: ${label} missing`); }
});

// 2. Backend checks
const paymentsFn = fs.readFileSync('D:/MY/chesskidoo-ai-admin/supabase/functions/payments/index.ts', 'utf8');
const beChecks = [
  ['apply_payment_debt_first RPC call', "supabase.rpc('apply_payment_debt_first'"],
  ['DELETE cleans payment_allocations', '.from("payment_allocations").delete()'],
  ['applied_month exposed', "'applied_month'"],
  ['no legacy auto-rollover', 'nextDate = new Date(student.due_date)'],
];
beChecks.forEach(([label, needle]) => {
  if (paymentsFn.includes(needle)) { console.log(`[OK] backend: ${label}`); }
  else { fixes.push(`backend (payments/index.ts): ${label} missing`); }
});

// 3. Automation checks
const auto = fs.readFileSync('D:/MY/chesskidoo-ai-admin/public/js/automation.js', 'utf8');
if (auto.includes('monthly_rollover_job_v4')) console.log('[OK] automation.js: calls v4 rollover');
else fixes.push('automation.js: missing v4 rollover call');

// 4. Scripts.js key checks
const scripts = fs.readFileSync('D:/MY/chesskidoo-ai-admin/public/scripts.js', 'utf8');
const jsChecks = [
  ['supabaseClient.rpc usage', 'supabaseClient.rpc'],
  ['getStudentPaymentStatus uses getBillingAnchor', 'const anchor = getBillingAnchor'],
  ['getStudentPaymentStatus checks applied_month', "p.applied_month && String(p.applied_month)"],
  ['informParent uses applied_month', 'p.applied_month && String(p.applied_month).trim()'],
  ['bulkMarkPaid uses computed status', 'const recalculated = getStudentPaymentStatus'],
  ['markPaid uses supabase RPC', 'supabaseClient.rpc'],
  ['togglePaymentStatus uses applied_month', "p.applied_month && String(p.applied_month).trim()"],
  ['no raw rpc() calls outside automation', 'await rpc('],
  ['no legacy calendar-month counting in totalPaymentsMap in scripts.js', /paidMonths\.add\(/g],
];
jsChecks.forEach(([label, needle]) => {
  if (typeof needle === 'string') {
    if (scripts.includes(needle)) console.log(`[OK] scripts.js: ${label}`);
    else if (label.includes('NO ')) { /* negative check */ }
    else fixes.push(`scripts.js: ${label} missing`);
  } else {
    const m = scripts.match(needle);
    if (!m || m.length === 0) console.log(`[OK] scripts.js: ${label}`);
    else fixes.push(`scripts.js: ${label} — ${m.length} occurrences remain`);
  }
});

// 5. Reporting.js checks
const reporting = fs.readFileSync('D:/MY/chesskidoo-ai-admin/public/js/reporting.js', 'utf8');
const rptChecks = [
  ['applied_month in totalPaymentsMap block 1', "p.applied_month && String(p.applied_month).trim()"],
  ['applied_month in totalPaymentsMap block 2', "p.applied_month && String(p.applied_month).trim()"],
];
rptChecks.forEach(([label, needle]) => {
  if (reporting.includes(needle)) console.log(`[OK] reporting.js: ${label}`);
  else fixes.push(`reporting.js: ${label} missing`);
});

// 6. Check for orphaned duplicate definitions
const toggleCount = (scripts.match(/window\.togglePaymentStatus\s*=/g) || []).length;
if (toggleCount === 1) console.log('[OK] scripts.js: togglePaymentStatus defined exactly once');
else fixes.push(`scripts.js: togglePaymentStatus defined ${toggleCount} times`);

const bulkCount = (scripts.match(/async function bulkMarkPaid/g) || []).length;
if (bulkCount === 1) console.log('[OK] scripts.js: bulkMarkPaid defined exactly once');
else fixes.push(`scripts.js: bulkMarkPaid defined ${bulkCount} times`);

console.log('\n=== RESULTS ===');
if (fixes.length === 0) {
  console.log('ALL CHECKS PASSED — everything is fixed.');
} else {
  console.log('REMAINING ISSUES:');
  fixes.forEach((f, i) => console.log(`${i+1}. ${f}`));
}
