const https = require('https');

const SUPABASE_URL = 'https://zznbanjdkwofsvpzybtr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8';

function httpsGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'zznbanjdkwofsvpzybtr.supabase.co',
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
  // Search ALL payments for JEEVAN with no date filter (full history)
  console.log('=== ALL JEEVAN payments (no filter) ===');
  const allJee = await httpsGet('/rest/v1/payments?select=*&student_id=eq.s1776570395859f9yles&order=created_at.desc');
  console.log('Count:', allJee.data ? allJee.data.length : 0);
  if (allJee.data) {
    allJee.data.forEach((p, i) => {
      const pd = new Date(p.payment_date || p.created_at);
      const isMay28 = pd.getUTCMonth() === 4 && pd.getUTCDate() >= 28;
      const isMay29 = pd.getUTCMonth() === 4 && pd.getUTCDate() >= 29;
      console.log((i+1) + '. id=' + p.id.slice(0,20) + ' | amt=' + p.amount + ' | date=' + (p.payment_date||p.created_at).slice(0,19) + ' | method=' + (p.payment_method||'-') + ' | desc=' + (p.description||'').slice(0,40) + (isMay28 ? ' *** MAY 28 ***' : '') + (isMay29 ? ' *** MAY 29 ***' : ''));
    });
  }

  // Also check ALL payments in the system around May 28-29
  console.log('\n=== ALL payments around May 28-29 2026 ===');
  const recent = await httpsGet('/rest/v1/payments?select=*&payment_date=gte.2026-05-26&payment_date=lte.2026-05-31&order=payment_date.desc');
  console.log('Count:', recent.data ? recent.data.length : 0);
  if (recent.data) {
    recent.data.forEach((p, i) => {
      const sid = p.student_id ? p.student_id.slice(0,8) : '?';
      console.log((i+1) + '. student=' + sid + '... | amt=' + p.amount + ' | date=' + (p.payment_date||'').slice(0,10) + ' | method=' + (p.payment_method||'-') + ' | desc=' + (p.description||'').slice(0,40));
    });
  }
}

main().catch(e => console.error('Error:', e.message));
