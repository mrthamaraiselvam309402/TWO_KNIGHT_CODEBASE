const https = require('https');

const SUPABASE_URL = 'https://vseombfkrvpffnpgbsnk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8';

const options = {
  hostname: 'vseombfkrvpffnpgbsnk.supabase.co',
  path: '/rest/v1/payments?select=*&order=payment_date.desc&limit=100',
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
    try {
      const json = JSON.parse(data);
      console.log('Total payments returned:', json.data ? json.data.length : 0);
      if (json.data && json.data.length > 0) {
        console.log('\n--- Recent Payments ---');
        json.data.slice(0, 20).forEach((p, i) => {
          const pd = new Date(p.payment_date || p.created_at);
          const now = new Date();
          const isFuture = pd > now;
          console.log((i+1) + '. ID: ' + (p.id ? p.id.slice(0,12) : '?') + '... | Student: ' + (p.student_id ? p.student_id.slice(0,8) : '?') + '... | Amount: ' + p.amount + ' | Date: ' + (p.payment_date || p.created_at || '').slice(0,10) + ' | Status: ' + p.status + ' | Method: ' + (p.payment_method || '-') + ' | applied_month: ' + (p.applied_month || 'NULL'));
          if (isFuture) console.log('   WARNING: FUTURE DATE PAYMENT!');
        });
      }
      if (json.error) console.log('Error:', json.error);
    } catch (e) {
      console.error('Parse error:', e.message);
      console.log('Raw response:', data.slice(0, 500));
    }
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.end();
