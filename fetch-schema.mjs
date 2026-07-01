import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://zznbanjdkwofsvpzybtr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6bmJhbmpka3dvZnN2cHp5YnRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDQ5MDEsImV4cCI6MjA5NzY4MDkwMX0.UgT3l4EWhKpsiRXzBSg9NWMXY00iqPk_Q3d-LtNfTXQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function simulate() {
  const loginRes = await supabase.auth.signInWithPassword({
    email: 'admin121@gmail.com',
    password: 'admin123'
  });
  
  if (loginRes.error) return console.error('Login failed:', loginRes.error);
  
  const token = loginRes.data.session.access_token;
  const headers = { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey, 'Content-Type': 'application/json' };
  
  const apiCall = async (path) => {
    const res = await fetch(`https://zznbanjdkwofsvpzybtr.supabase.co/functions/v1${path}`, { headers });
    return res.json();
  };

  const coaches = await apiCall('/coaches');
  console.log('Coaches sample:', coaches[0]);
  
  const batches = await apiCall('/batches');
  console.log('Batches sample:', batches[0]);
  
  const students = await apiCall('/students');
  console.log('Students sample:', students[0]);
}
simulate();
