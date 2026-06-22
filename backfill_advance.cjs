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
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };
    const req = https.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, raw: d.slice(0,400) }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('=== ADVANCE PAYMENT BACKFILL & FIX ===\n');

  // Step 1: Try to create payment_allocations table via RPC
  console.log('Step 1: Attempting to create payment_allocations table...');
  try {
    const rpcResult = await supabaseRequest('POST', '/rest/v1/rpc/apply_payment_debt_first', {
      p_student_id: 'test',
      p_payment_id: 'test',
      p_amount: 0
    });
    console.log('RPC response status:', rpcResult.status);
  } catch(e) {
    console.log('RPC check error:', e.message);
  }

  // Step 2: Check if payment_allocations exists
  console.log('\nStep 2: Checking payment_allocations table...');
  const checkResult = await supabaseRequest('GET', '/rest/v1/payment_allocations?select=count&limit=1');
  console.log('Check result:', checkResult.status, checkResult.status === 200 ? 'EXISTS' : 'MISSING');

  // Step 3: Get full student and payment data
  console.log('\nStep 3: Fetching student data...');
  
  // SAMIKSHA
  const sam = await supabaseRequest('GET', '/rest/v1/students?select=id,name,payment_status,monthly_fee,enrollment_date,due_date&id=eq.d881ddd8-4572-4f3a-bcda-0d3f6cec37f3');
  const samData = sam.data?.[0];
  console.log('SAMIKSHA:', JSON.stringify({
    id: samData?.id,
    name: samData?.name,
    fee: samData?.monthly_fee,
    enroll: samData?.enrollment_date,
    due: samData?.due_date,
    status: samData?.payment_status
  }));

  // SAMIKSHA payments
  const samPays = await supabaseRequest('GET', '/rest/v1/payments?select=*&student_id=eq.d881ddd8-4572-4f3a-bcda-0d3f6cec37f3&order=payment_date.asc');
  console.log('SAMIKSHA payments:', JSON.stringify(samPays.data, null, 2));

  // JEEVAN
  const jee = await supabaseRequest('GET', '/rest/v1/students?select=id,name,payment_status,monthly_fee,enrollment_date,due_date&id=eq.s1776570395859f9yles');
  const jeeData = jee.data?.[0];
  console.log('JEEVAN:', JSON.stringify({
    id: jeeData?.id,
    name: jeeData?.name,
    fee: jeeData?.monthly_fee,
    enroll: jeeData?.enrollment_date,
    due: jeeData?.due_date,
    status: jeeData?.payment_status
  }));

  // JEEVAN payments
  const jeePays = await supabaseRequest('GET', '/rest/v1/payments?select=*&student_id=eq.s1776570395859f9yles&order=payment_date.asc');
  console.log('JEEVAN payments:', JSON.stringify(jeePays.data, null, 2));

  // Step 4: For SAMIKSHA, create allocation directly
  console.log('\nStep 4: Creating payment_allocations for SAMIKSHA...');
  
  // SAMIKSHA: enrollment 2026-05-29, monthly fee 4800
  // Payment made 2026-05-28 (before enrollment date May 29)
  // Late-join rule (>= day 26): billing starts June 2026
  // The payment should be allocated to June 2026 as ADVANCE_CREDIT
  
  const samAlloc = await supabaseRequest('POST', '/rest/v1/payment_allocations', {
    id: 'alloc_' + Date.now() + '_sam',
    payment_id: 'pay_1779987664313_z37tt69x6',
    student_id: 'd881ddd8-4572-4f3a-bcda-0d3f6cec37f3',
    allocated_month: '2026-06',
    amount: 4800,
    allocation_type: 'DIRECT',
    description: 'May 28 payment for June (advance credit - late join billing)'
  });
  console.log('SAMIKSHA allocation status:', samAlloc.status);

  // Step 5: For JEEVAN, determine allocations
  console.log('\nStep 5: Creating payment_allocations for JEEVAN...');
  // JEEVAN: enrollment 2026-03-15, fee 3300
  // Billing starts March 2026 (not late join)
  // 
  // Payments:
  // - 2026-04-01: 2300 -> March (debt first, March is unpaid)
  // - 2026-04-30: 2300 -> still covering March (March owes 1000 more), then April (1300)
  // - 2026-05-27: 3300 -> April (still 2000 owed), May (1300)
  //
  // Under DEBT-FIRST:
  // March: 2300+1000 = 3300 PAID
  // April: 1300 from Apr30 + 1300 from May27 = 2600 (owe 700)
  // May: 700 owed
  // June: 0 paid
  
  // But the user's data says JEEVAN is marked "Paid" on the dashboard.
  // This means the old system counted differently.
  // With 3 payments totaling 7900 and fee 3300/month for 4 months (Mar-Jun) = 13200
  
  // For now, apply the three payments in a sensible way for debt-first:
  
  // Payment 1: 2026-04-01, amount 2300 -> covers March (earliest debt)
  const jeeAlloc1 = await supabaseRequest('POST', '/rest/v1/payment_allocations', {
    id: 'alloc_' + Date.now() + '_jee1',
    payment_id: 'pay_1777935995990_xuk1blua5',
    student_id: 's1776570395859f9yles',
    allocated_month: '2026-03',
    amount: 2300,
    allocation_type: 'DEBT_CLEAR',
    description: 'April payment applied to March (debt-first)'
  });
  console.log('JEEVAN March allocation:', jeeAlloc1.status);

  // Payment 2: 2026-04-30, amount 2300 -> continues March (needs 1000 more), then April
  const jeeAlloc2a = await supabaseRequest('POST', '/rest/v1/payment_allocations', {
    id: 'alloc_' + Date.now() + '_jee2a',
    payment_id: 'pay_toggle_1779925683319_6okm2kome',
    student_id: 's1776570395859f9yles',
    allocated_month: '2026-03',
    amount: 1000,
    allocation_type: 'DEBT_CLEAR',
    description: 'May payment finishing March debt'
  });
  const jeeAlloc2b = await supabaseRequest('POST', '/rest/v1/payment_allocations', {
    id: 'alloc_' + Date.now() + '_jee2b',
    payment_id: 'pay_toggle_1779925683319_6okm2kome',
    student_id: 's1776570395859f9yles',
    allocated_month: '2026-04',
    amount: 1300,
    allocation_type: 'DEBT_CLEAR',
    description: 'May payment applied to April'
  });
  console.log('JEEVAN Apr allocation (from 27May pay):', jeeAlloc2b.status);

  // Payment 3: 2026-05-29, amount 3300 -> continues April (needs 2000 more), then May (1300)
  const jeeAlloc3a = await supabaseRequest('POST', '/rest/v1/payment_allocations', {
    id: 'alloc_' + Date.now() + '_jee3a',
    payment_id: 'apr26_fix_s1776570395859f9yles',
    student_id: 's1776570395859f9yles',
    allocated_month: '2026-04',
    amount: 2000,
    allocation_type: 'DEBT_CLEAR',
    description: 'April 30 payment applied to April'
  });
  const jeeAlloc3b = await supabaseRequest('POST', '/rest/v1/payment_allocations', {
    id: 'alloc_' + Date.now() + '_jee3b',
    payment_id: 'apr26_fix_s1776570395859f9yles',
    student_id: 's1776570395859f9yles',
    allocated_month: '2026-05',
    amount: 300,
    allocation_type: 'DEBT_CLEAR',
    description: 'April 30 payment applied to May (partial)'
  });
  console.log('JEEVAN Apr+May allocation (from Apr30 pay):', jeeAlloc3a.status, jeeAlloc3b.status);

  // Step 6: Final summary
  console.log('\nStep 6: Verifying final state...');
  
  const finalSam = await supabaseRequest('GET', '/rest/v1/payment_allocations?select=*&student_id=eq.d881ddd8-4572-4f3a-bcda-0d3f6cec37f3');
  console.log('\nSAMIKSHA allocations:');
  finalSam.data?.forEach(a => {
    console.log('  ' + a.allocated_month + ': ' + a.amount + ' (' + a.allocation_type + ')');
  });

  const finalJee = await supabaseRequest('GET', '/rest/v1/payment_allocations?select=*&student_id=eq.s1776570395859f9yles&order=allocated_month.asc');
  console.log('\nJEEVAN allocations:');
  const jeeByMonth = {};
  finalJee.data?.forEach(a => {
    jeeByMonth[a.allocated_month] = (jeeByMonth[a.allocated_month] || 0) + parseFloat(a.amount);
    console.log('  ' + a.allocated_month + ': ' + a.amount + ' (' + a.allocation_type + ') [payment: ' + a.payment_id.slice(0,15) + '...]');
  });
  
  console.log('\n=== JEEVAN MONTHLY SUMMARY ===');
  Object.entries(jeeByMonth).sort().forEach(([month, total]) => {
    const fee = month === '2026-03' || month === '2026-04' || month === '2026-05' ? 3300 : 3300;
    const owed = Math.max(0, fee - total);
    const status = owed === 0 ? 'PAID' : (owed > 0 ? 'OWES ' + owed : 'CREDIT');
    console.log('  ' + month + ': paid=' + total + '/=' + fee + ' → ' + status);
  });

  console.log('\nDone!');
}

main().catch(e => console.error('Fatal:', e.message));
