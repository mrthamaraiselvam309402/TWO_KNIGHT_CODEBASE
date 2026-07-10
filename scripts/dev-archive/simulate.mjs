import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://zznbanjdkwofsvpzybtr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6bmJhbmpka3dvZnN2cHp5YnRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDQ5MDEsImV4cCI6MjA5NzY4MDkwMX0.UgT3l4EWhKpsiRXzBSg9NWMXY00iqPk_Q3d-LtNfTXQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function simulate() {
  console.log('Logging in as admin...');
  const loginRes = await supabase.auth.signInWithPassword({
    email: 'admin121@gmail.com',
    password: 'admin123'
  });
  
  if (loginRes.error) {
    console.error('Login failed:', loginRes.error);
    return;
  }
  
  const token = loginRes.data.session.access_token;
  const headers = { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey, 'Content-Type': 'application/json' };
  
  const apiCall = async (path, method = 'GET', body = null) => {
    const res = await fetch(`https://zznbanjdkwofsvpzybtr.supabase.co/functions/v1${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
    return data;
  };

  try {
    console.log('Creating demo coach...');
    const coachData = await apiCall('/coaches', 'POST', {
      action: 'create',
      coach: {
        name: 'Demo Coach',
        email: 'demo_coach@chesskidoo.com',
        phone: '+1234567890',
        specialization: 'Tactics'
      }
    });
    console.log('Coach created:', coachData);
    
    console.log('Creating demo batch...');
    const batchData = await apiCall('/batches', 'POST', {
      action: 'create',
      batch: {
        name: 'Demo Masterclass',
        coach_id: coachData.coach?.id || coachData.id || coachData.data?.id || coachData[0]?.id || coachData.newId,
        level: 'Intermediate',
        day: 'Monday',
        time: '18:00',
        fee: 100
      }
    });
    console.log('Batch created:', batchData);
    const batchId = batchData.batch?.id || batchData.id || batchData.data?.id || batchData[0]?.id || batchData.newId;
    
    console.log('Creating demo students...');
    const studentIds = [];
    for (let i = 1; i <= 4; i++) {
      const stuData = await apiCall('/students', 'POST', {
        action: 'create',
        student: {
          name: `Demo Student ${i}`,
          email: `demo_student${i}@chesskidoo.com`,
          batch_id: batchId,
          parent_name: 'Demo Parent',
          status: 'Active',
          monthly_fee: 100,
          currency: 'USD'
        }
      });
      studentIds.push(stuData.student?.id || stuData.id || stuData.data?.id || stuData[0]?.id || stuData.newId);
    }
    console.log('Students created:', studentIds);
    
    console.log('Testing password batch reset...');
    const pwdData = await apiCall('/security', 'POST', {
      action: 'reset_passwords',
      batchId: batchId,
      newPassword: 'ChessDemo123!'
    });
    console.log('Password reset response:', pwdData);
    
    console.log('Simulation complete!');
  } catch (e) {
    console.error('Simulation error:', e.message);
  }
}
simulate();
