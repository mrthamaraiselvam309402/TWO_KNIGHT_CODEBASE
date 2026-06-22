const https = require('https');

const SUPABASE_URL = 'https://vseombfkrvpffnpgbsnk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8';

function httpsGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'vseombfkrvpffnpgbsnk.supabase.co',
      path, method: 'GET',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(new Error(d.slice(0,400))); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Check students table
  console.log('=== Students (first 10) ===');
  const students = await httpsGet('/rest/v1/students?select=id,name,payment_status,monthly_fee,enrollment_date&limit=10&order=created_at.desc');
  if (students.data) {
    students.data.forEach((s, i) => {
      console.log((i+1) + '. id=' + s.id + ' | name=' + (s.name||'?') + ' | status=' + s.payment_status + ' | fee=' + s.monthly_fee + ' | enroll=' + (s.enrollment_date||'').slice(0,10));
    });
  } else {
    console.log('No students found or RLS blocked');
  }

  // Try querying ALL payments without filter
  console.log('\n=== ALL payments (no filter, limit 5) ===');
  const allPays = await httpsGet('/rest/v1/payments?select=id,student_id,amount,payment_date,payment_method,description&limit=5&order=payment_date.desc');
  console.log('Count/length:', allPays.data ? allPays.data.length : 'no data');
  if (allPays.data && allPays.data.length > 0) {
    allPays.data.forEach((p, i) => {
      console.log((i+1) + '. id=' + p.id.slice(0,20) + ' | student=' + (p.student_id||'?').slice(0,10) + ' | amt=' + p.amount + ' | date=' + (p.payment_date||'').slice(0,10) + ' | method=' + (p.payment_method||'-'));
    });
  } else {
    console.log('No payments found. Status code likely:', allPays.status);
  }

  // Check payment_allocations
  console.log('\n=== payment_allocations (first 10) ===');
  const allocs = await httpsGet('/rest/v1/payment_allocations?select=*&limit=10&order=created_at.desc');
  console.log('Count:', allocs.data ? allocs.data.length : 0);
  if (allocs.data && allocs.data.length > 0) {
    allocs.data.forEach((a, i) => {
      console.log((i+1) + '. id=' + a.id.slice(0,15) + ' | student=' + (a.student_id||'?').slice(0,10) + ' | month=' + a.allocated_month + ' | amt=' + a.amount + ' | type=' + a.allocation_type);
    });
  }
}

main().catch(e => console.error('Error:', e.message));
