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
  // Get full student records
  console.log('=== SAMIKSHA full data ===');
  const sam = await httpsGet('/rest/v1/students?select=*&id=eq.d881ddd8-4572-4f3a-bcda-0d3f6cec37f3');
  console.log(JSON.stringify(sam.data?.[0], null, 2));

  console.log('\n=== JEEVAN BASIC full data ===');
  const jee = await httpsGet('/rest/v1/students?select=*&id=eq.s1776570395859f9yles');
  console.log(JSON.stringify(jee.data?.[0], null, 2));

  // Check payment_allocations table for these students
  console.log('\n=== Payment allocations for SAMIKSHA ===');
  const samAlloc = await httpsGet('/rest/v1/payment_allocations?select=*&student_id=eq.d881ddd8-4572-4f3a-bcda-0d3f6cec37f3&order=allocated_month.asc');
  console.log(JSON.stringify(samAlloc.data, null, 2));

  console.log('\n=== Payment allocations for JEEVAN ===');
  const jeeAlloc = await httpsGet('/rest/v1/payment_allocations?select=*&student_id=eq.s1776570395859f9yles&order=allocated_month.asc');
  console.log(JSON.stringify(jeeAlloc.data, null, 2));

  // Check all tables exist
  console.log('\n=== Checking tables exist ===');
  const tables = ['payment_allocations', 'payments', 'students'];
  for (const t of tables) {
    try {
      const r = await httpsGet('/rest/v1/' + t + '?select=count&limit=1');
      console.log(t + ': count=' + (r.data?.length || r?.length || 'error'));
    } catch(e) {
      console.log(t + ': ERROR - ' + e.message.slice(0,100));
    }
  }
}
main().catch(e => console.error('Error:', e.message));
