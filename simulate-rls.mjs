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
  
  const { data: coach, error: err1 } = await supabase.from('coaches').insert({
    name: 'Demo Coach',
    email: 'demo_coach@chesskidoo.com',
    phone: '+1234567890',
    specialization: 'Tactics'
  }).select().single();
  
  console.log('Coach insert:', err1 ? err1 : coach);
  
  const { data: batch, error: err2 } = await supabase.from('batches').insert({
    name: 'Demo Masterclass',
    coach_id: coach?.id,
    level: 'Intermediate',
    day: 'Monday',
    time: '18:00',
    fee: 100
  }).select().single();
  
  console.log('Batch insert:', err2 ? err2 : batch);
  
  for(let i=1; i<=4; i++) {
    const { data: student, error: err3 } = await supabase.from('students').insert({
      name: `Demo Student ${i}`,
      email: `demo_student${i}@chesskidoo.com`,
      batch_id: batch?.id,
      parent_name: 'Demo Parent',
      status: 'Active',
      monthly_fee: 100,
      currency: 'USD'
    }).select().single();
    console.log(`Student ${i}:`, err3 ? err3 : student);
  }
}
simulate();
