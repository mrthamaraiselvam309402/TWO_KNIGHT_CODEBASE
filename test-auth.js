import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://zznbanjdkwofsvpzybtr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6bmJhbmpka3dvZnN2cHp5YnRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDQ5MDEsImV4cCI6MjA5NzY4MDkwMX0.UgT3l4EWhKpsiRXzBSg9NWMXY00iqPk_Q3d-LtNfTXQ'; // Anon key
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const loginRes = await supabase.auth.signInWithPassword({
    email: 'admin121@gmail.com',
    password: 'admin123'
  });
  console.log('Login:', loginRes.data.session ? 'Success' : loginRes.error);
  
  if (loginRes.data.session) {
    const token = loginRes.data.session.access_token;
    const userRes = await supabase.auth.getUser(token);
    console.log('GetUser:', userRes.data.user ? 'Success' : userRes.error);
  }
}
test();
