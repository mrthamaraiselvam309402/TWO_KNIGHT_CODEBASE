const https = require('https');

const SUPABASE_URL = 'https://zznbanjdkwofsvpzybtr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6bmJhbmpka3dvZnN2cHp5YnRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDQ5MDEsImV4cCI6MjA5NzY4MDkwMX0.UgT3l4EWhKpsiRXzBSg9NWMXY00iqPk_Q3d-LtNfTXQ';

function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'zznbanjdkwofsvpzybtr.supabase.co',
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
  console.log('=== CLEAN ALL + PROPER DEBT-FIRST BACKFILL ===\n');

  // Step 1: Delete ALL allocations for both students (start fresh)
  console.log('Step 1: Wiping old allocations via direct filter...');
  for (const sid of ['d881ddd8-4572-4f3a-bcda-0d3f6cec37f3', 's1776570395859f9yles']) {
    // Use id=neq.null to match all rows (Supabase OR syntax)
    const del = await supabaseRequest('DELETE', '/rest/v1/payment_allocations?student_id=eq.' + sid + '&id=neq.null');
    console.log('  Deleted allocs for ' + sid.slice(0,8) + '...: status=' + del.status);
  }

  // Step 2: Clear applied_month on payments (fresh start)
  console.log('\nStep 2: Clearing applied_month...');
  const allPay = await supabaseRequest('GET', '/rest/v1/payments?select=id&limit=1000');
  if (allPay.data) {
    let cleared = 0;
    for (const p of allPay.data) {
      const upd = await supabaseRequest('PATCH', '/rest/v1/payments?id=eq.' + p.id, { applied_month: null });
      if (upd.status === 200 || upd.status === 204) cleared++;
    }
    console.log('  Cleared applied_month on ' + cleared + ' payments');
  }

  // Step 3: Re-run SAMIKSHA through RPC
  console.log('\nStep 3: SAMIKSHA debt-first allocation...');
  const samRpc = await supabaseRequest('POST', '/rest/v1/rpc/apply_payment_debt_first', {
    p_student_id: 'd881ddd8-4572-4f3a-bcda-0d3f6cec37f3',
    p_payment_id: 'pay_1779987664313_z37tt69x6',
    p_amount: 4800,
    p_target_month: '2026-06'
  });
  console.log('  Result:', JSON.stringify(samRpc.data).slice(0, 300));

  // Step 4: Re-run JEEVAN through RPCs IN ORDER (oldest payment first)
  // JEEVAN billing anchor: March 2026
  // Payment 1: Apr 01, 2300 → target April 2026 → Phase 1 clears March (2300 of 3300), March still owes 1000
  // Payment 2: Apr 30, 2300 → target April 2026 → Phase 1 clears March (remaining 1000), Phase 2 applies 1300 to April
  // Payment 3: May 27, 3300 → target = ?
  //  The May 27 payment comes AFTER April, so it should go to April debt first, then May.
  //  But the RPC target_month is what month we're CURRENTLY billing for.
  //  If target=May 2026, then Phase 1 checks Apr (owed 2000), May (owed 3300).
  //  Debt first: April owes 2000, May owes 3300.
  //  Payment is 3300: clear April (2000), apply 1300 to May.
  console.log('\nStep 4: JEEVAN debt-first allocations (in chronological order)...');

  const jeeRpc1 = await supabaseRequest('POST', '/rest/v1/rpc/apply_payment_debt_first', {
    p_student_id: 's1776570395859f9yles',
    p_payment_id: 'pay_1777935995990_xuk1blua5',
    p_amount: 2300,
    p_target_month: '2026-04'
  });
  console.log('  Payment 1 (Apr01 2300→Apr):', JSON.stringify(jeeRpc1.data).slice(0, 250));

  const jeeRpc2 = await supabaseRequest('POST', '/rest/v1/rpc/apply_payment_debt_first', {
    p_student_id: 's1776570395859f9yles',
    p_payment_id: 'apr26_fix_s1776570395859f9yles',
    p_amount: 2300,
    p_target_month: '2026-04'
  });
  console.log('  Payment 2 (Apr30 2300→Apr):', JSON.stringify(jeeRpc2.data).slice(0, 250));

  // The May 27 payment of 3300: target should be current month context
  // The RPC logic: Phase 1 iterates from anchor to just before target
  // If target=2026-05, Phase 1 clears March + April (since anchor=Mar, cursor goes Mar, Apr; stops before May)
  // Then Phase 2 applies to May.
  // So 3300 payment: Phase1 clears Apr (2000 owed), Phase2 applies 1300 to May.
  const jeeRpc3 = await supabaseRequest('POST', '/rest/v1/rpc/apply_payment_debt_first', {
    p_student_id: 's1776570395859f9yles',
    p_payment_id: 'pay_toggle_1779925683319_6okm2kome',
    p_amount: 3300,
    p_target_month: '2026-05'
  });
  console.log('  Payment 3 (May27 3300→May):', JSON.stringify(jeeRpc3.data).slice(0, 250));

  // Step 5: Update applied_month on all payments based on RPC results
  console.log('\nStep 5: Setting applied_month from RPC results...');
  const samRpcData = samRpc.data;
  if (samRpcData && samRpcData.allocations) {
    for (const alloc of samRpcData.allocations) {
      if (alloc.type === 'DIRECT' || alloc.type === 'CREDIT_ROLLOVER') {
        const upd = await supabaseRequest('PATCH', '/rest/v1/payments?id=eq.pay_1779987664313_z37tt69x6', { applied_month: alloc.month });
        console.log('  SAMIKSHA payment→' + alloc.month + ': ' + upd.status);
      }
    }
  }

  // Final verification
  console.log('\n=== FINAL STATE ===');
  
  const samFinal = await supabaseRequest('GET', '/rest/v1/payment_allocations?select=*&student_id=eq.d881ddd8-4572-4f3a-bcda-0d3f6cec37f3');
  console.log('\nSAMIKSHA:');
  const samM = {};
  (samFinal.data || []).forEach(a => {
    samM[a.allocated_month] = (samM[a.allocated_month] || 0) + parseFloat(a.amount);
  });
  Object.entries(samM).forEach(([m, t]) => {
    console.log('  ' + m + ': ' + t + '/4800 → ' + (t >= 4800 ? 'PAID' : 'OWES ' + (4800-t)));
  });

  const jeeFinal = await supabaseRequest('GET', '/rest/v1/payment_allocations?select=*&student_id=eq.s1776570395859f9yles&order=allocated_month.asc');
  console.log('\nJEEVAN:');
  const jeeM = {};
  (jeeFinal.data || []).forEach(a => {
    jeeM[a.allocated_month] = (jeeM[a.allocated_month] || 0) + parseFloat(a.amount);
  });
  Object.entries(jeeM).sort().forEach(([m, t]) => {
    console.log('  ' + m + ': ' + t + '/3300 → ' + (t >= 3300 ? 'PAID' : 'OWES ' + (3300-t)));
  });

  console.log('\nDone!');
}

main().catch(e => console.error('Fatal:', e.message));
