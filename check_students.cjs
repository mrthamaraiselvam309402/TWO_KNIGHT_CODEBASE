const https = require('https');

const SUPABASE_URL = 'https://vseombfkrvpffnpgbsnk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8';

function query(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'vseombfkrvpffnpgbsnk.supabase.co',
      path: path,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Parse error: ' + e.message + '\nRaw: ' + data.slice(0,300))); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== STEP 1: Check students table connection ===');
  const students = await query('/rest/v1/students?select=id,name,payment_status,monthly_fee,enrollment_date,due_date&order=created_at.desc&limit=10');
  console.log('Students result:', JSON.stringify(students).slice(0, 500));

  console.log('\n=== STEP 2: Search for SAMIKSHA ===');
  const sam = await query('/rest/v1/students?select=*&name=ilike.*SAMIKSHA*');
  console.log('SAMIKSHA:', JSON.stringify(sam).slice(0, 500));

  console.log('\n=== STEP 3: Search for JEEVAN ===');
  const jee = await query('/rest/v1/students?select=*&name=ilike.*JEEVAN*');
  console.log('JEEVAN:', JSON.stringify(jee).slice(0, 500));

  console.log('\n=== STEP 4: Check payments table directly ===');
  const pays = await query('/rest/v1/payments?select=*&order=payment_date.desc&limit=50');
  console.log('Payments count:', pays.data ? pays.data.length : 0);
  if (pays.data && pays.data.length > 0) {
    pays.data.forEach((p, i) => {
      console.log((i+1) + '. student_id=' + p.student_id + ' | amount=' + p.amount + ' | date=' + (p.payment_date||'').slice(0,10) + ' | status=' + p.status + ' | method=' + (p.payment_method||'-'));
    });
  } else {
    console.log('No payments found. Checking if table exists...');
    console.log('Response:', JSON.stringify(pays).slice(0, 300));
  }
}

main().catch(e => console.error('Error:', e.message));
