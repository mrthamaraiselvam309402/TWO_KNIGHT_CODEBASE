const https = require('https');

const SUPABASE_URL = 'https://vseombfkrvpffnpgbsnk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8';

function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'vseombfkrvpffnpgbsnk.supabase.co',
      path, method,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      }
    };
    const req = https.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, raw: d.slice(0,200) }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('=== CLEANUP DUPLICATES + PROPER BACKFILL ===\n');

  // Step 1: Delete ALL existing allocations for these two students (they were wrong/duplicated)
  console.log('Step 1: Removing old allocations...');
  for (const sid of ['d881ddd8-4572-4f3a-bcda-0d3f6cec37f3', 's1776570395859f9yles']) {
    const del = await supabaseRequest('DELETE', '/rest/v1/payment_allocations?student_id=eq.' + sid + '&id=not.is.null', {});
    console.log('  Deleted for ' + sid.slice(0,8) + '...: status=' + del.status);
  }

  // Step 2: Also clear applied_month from payments so RPC can set them correctly
  console.log('\nStep 2: Clearing applied_month on payments...');
  for (const pid of ['pay_1779987664313_z37tt69x6', 'pay_1777935995990_xuk1blua5', 'apr26_fix_s1776570395859f9yles', 'pay_toggle_1779925683319_6okm2kome']) {
    const upd = await supabaseRequest('PATCH', '/rest/v1/payments?id=eq.' + pid, { applied_month: null });
    console.log('  Cleared ' + pid.slice(0,15) + '...: status=' + upd.status);
  }

  // Step 3: Call apply_payment_debt_first RPC for SAMIKSHA
  // SAMIKSHA: enrollment 2026-05-29, fee 4800, late-join (>=26) → billing anchor June 2026
  // Payment: 2026-05-28, amount 4800, target_month should be June 2026 (advance payment)
  console.log('\nStep 3: Running debt-first RPC for SAMIKSHA...');
  const samRpc = await supabaseRequest('POST', '/rest/v1/rpc/apply_payment_debt_first', {
    p_student_id: 'd881ddd8-4572-4f3a-bcda-0d3f6cec37f3',
    p_payment_id: 'pay_1779987664313_z37tt69x6',
    p_amount: 4800,
    p_target_month: '2026-06'
  });
  console.log('  SAMIKSHA RPC status:', samRpc.status);
  console.log('  SAMIKSHA RPC result:', JSON.stringify(samRpc.data).slice(0, 300));

  // Step 4: Call apply_payment_debt_first RPC for JEEVAN
  // JEEVAN: enrollment 2026-03-15, fee 3300, billing anchor March 2026
  // Need to apply ALL three payments through the RPC.
  // RPC processes payments in order. We call it once per payment.
  // The RPC uses debt-first: anchor→target, then target, then rollover.
  // 
  // Payment 1: 2026-04-01, 2300, target=2026-04
  //   Phase 1: March owes 3300, alloc 2300 (DEBT_CLEAR)
  //   Remaining: 0 → March still owes 1000
  //
  // Payment 2: 2026-04-30, 2300, target=2026-04
  //   Phase 1: March owes 1000, alloc 1000 (DEBT_CLEAR) → March PAID
  //   Phase 2: April owes 3300, alloc 1300 (DIRECT) → April owes 2000
  //
  // Payment 3: 2026-05-27, 3300, target=2026-05
  //   Phase 1: No debt before May (March+April already PAID)
  //   Phase 2: May owes 3300, alloc 3300 (DIRECT) → May PAID
  //
  // But wait - the RPC only processes ONE payment at a time.
  // And Payment 2 was on 2026-04-30 with target=2026-04.
  // The RPC will see March as debt (1000 owed), clear it, then apply remaining 1300 to April.
  // 
  // Actual existing payments:
  //   pay_1777935995990_xuk1blua5: 2300, 2026-04-01
  //   apr26_fix: 2300, 2026-04-30
  //   pay_toggle: 3300, 2026-05-27
  
  console.log('\nStep 4: Running RPCs for JEEVAN payments...');
  
  // Payment 1: Apr01 2300 → target April 2026 (Phase1 will clear March debt first)
  const jeeRpc1 = await supabaseRequest('POST', '/rest/v1/rpc/apply_payment_debt_first', {
    p_student_id: 's1776570395859f9yles',
    p_payment_id: 'pay_1777935995990_xuk1blua5',
    p_amount: 2300,
    p_target_month: '2026-04'
  });
  console.log('  JEEVAN Payment 1 (Apr01 2300→Apr):', JSON.stringify(jeeRpc1.data).slice(0, 200));

  // Payment 2: Apr30 2300 → target April 2026
  const jeeRpc2 = await supabaseRequest('POST', '/rest/v1/rpc/apply_payment_debt_first', {
    p_student_id: 's1776570395859f9yles',
    p_payment_id: 'apr26_fix_s1776570395859f9yles',
    p_amount: 2300,
    p_target_month: '2026-04'
  });
  console.log('  JEEVAN Payment 2 (Apr30 2300→Apr):', JSON.stringify(jeeRpc2.data).slice(0, 200));

  // Payment 3: May27 3300 → target May 2026
  const jeeRpc3 = await supabaseRequest('POST', '/rest/v1/rpc/apply_payment_debt_first', {
    p_student_id: 's1776570395859f9yles',
    p_payment_id: 'pay_toggle_1779925683319_6okm2kome',
    p_amount: 3300,
    p_target_month: '2026-05'
  });
  console.log('  JEEVAN Payment 3 (May27 3300→May):', JSON.stringify(jeeRpc3.data).slice(0, 200));

  // Step 5: Verify final state
  console.log('\nStep 5: Final verification...');
  
  const samFinal = await supabaseRequest('GET', '/rest/v1/payment_allocations?select=*&student_id=eq.d881ddd8-4572-4f3a-bcda-0d3f6cec37f3');
  console.log('\nSAMIKSHA allocations:');
  const samByMonth = {};
  (samFinal.data || []).forEach(a => {
    samByMonth[a.allocated_month] = (samByMonth[a.allocated_month] || 0) + parseFloat(a.amount);
    console.log('  ' + a.allocated_month + ': ' + a.amount + ' (' + a.allocation_type + ')');
  });
  Object.entries(samByMonth).forEach(([m, t]) => {
    console.log('  >> ' + m + ' TOTAL: ' + t + '/4800 = ' + (t >= 4800 ? 'PAID' : 'OWES ' + (4800-t)));
  });

  const jeeFinal = await supabaseRequest('GET', '/rest/v1/payment_allocations?select=*&student_id=eq.s1776570395859f9yles&order=allocated_month.asc');
  console.log('\nJEEVAN allocations:');
  const jeeByMonth = {};
  (jeeFinal.data || []).forEach(a => {
    jeeByMonth[a.allocated_month] = (jeeByMonth[a.allocated_month] || 0) + parseFloat(a.amount);
    console.log('  ' + a.allocated_month + ': ' + a.amount + ' (' + a.allocation_type + ')');
  });
  Object.entries(jeeByMonth).sort().forEach(([m, t]) => {
    const fee = 3300;
    console.log('  >> ' + m + ' TOTAL: ' + t + '/3300 = ' + (t >= fee ? 'PAID' : 'OWES ' + (fee-t)));
  });

  // Step 6: Update applied_month on payments
  console.log('\nStep 6: Updating applied_month on payments...');
  const payments = await supabaseRequest('GET', '/rest/v1/payments?select=id,student_id,amount,payment_date&order=payment_date.asc');
  if (payments.data) {
    for (const p of payments.data) {
      if (!p.applied_month) {
        const upd = await supabaseRequest('PATCH', '/rest/v1/payments?id=eq.' + p.id, { applied_month: p.payment_date ? p.payment_date.slice(0,7) : null });
        console.log('  ' + p.id.slice(0,15) + '... applied_month=' + (p.payment_date ? p.payment_date.slice(0,7) : 'null') + ': ' + upd.status);
      }
    }
  }

  console.log('\n=== BACKFILL COMPLETE ===');
}

main().catch(e => console.error('Fatal:', e.message));
