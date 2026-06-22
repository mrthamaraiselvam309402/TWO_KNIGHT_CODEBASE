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
  // SAMIKSHA - payment query with all statuses
  console.log('=== SAMIKSHA payments (all statuses) ===');
  const samPay = await httpsGet('/rest/v1/payments?select=*&student_id=eq.d881ddd8-4572-4f3a-bcda-0d3f6cec37f3&order=payment_date.desc');
  console.log(JSON.stringify(samPay, null, 2).slice(0, 2000));

  console.log('\n=== JEEVAN BASIC payments (all statuses) ===');
  const jeePay = await httpsGet('/rest/v1/payments?select=*&student_id=eq.s1776570395859f9yles&order=payment_date.desc');
  console.log(JSON.stringify(jeePay, null, 2).slice(0, 2000));

  console.log('\n=== All payments with date range filter ===');
  const allPay = await httpsGet('/rest/v1/payments?select=*&payment_date=gte.2026-05-01&payment_date=lte.2026-06-05&order=payment_date.desc');
  console.log('Count:', allPay.data ? allPay.data.length : 'error');
  if (allPay.data) {
    allPay.data.forEach((p,i) => {
      console.log((i+1) + '. id=' + p.id + ' | student=' + p.student_id + ' | amt=' + p.amount + ' | date=' + (p.payment_date||'').slice(0,19) + ' | status=' + p.status + ' | method=' + (p.payment_method||'-'));
    });
  }

  console.log('\n=== All students (first 20) with payment_status ===');
  const students = await httpsGet('/rest/v1/students?select=id,name,payment_status,monthly_fee,enrollment_date,due_date&order=created_at.desc&limit=20');
  if (students.data) {
    students.data.forEach((s,i) => {
      console.log((i+1) + '. ' + (s.name||'?') + ' | status=' + s.payment_status + ' | fee=' + s.monthly_fee + ' | enroll=' + (s.enrollment_date||'').slice(0,10) + ' | due=' + (s.due_date||'').slice(0,10));
    });
  }
}
main().catch(e => console.error('Error:', e.message));
