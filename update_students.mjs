import fetch from 'node-fetch';

const SUPABASE_URL = 'https://zznbanjdkwofsvpzybtr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8';

// Use the REST API directly to read and write since the Edge function might be cached or require auth
// We can just query the `students` table via Supabase REST API directly
// wait, the Edge function is what the frontend uses, but we have the ANON KEY.
// The Edge function requires Auth `validateAuth`.
// Since we are running a script locally, we can just use the PostgREST API directly to update.

async function run() {
  console.log('Fetching students...');
  
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // Fetch all students
  const getRes = await fetch(`${SUPABASE_URL}/rest/v1/students?select=id,name`, {
    headers
  });
  
  if (!getRes.ok) {
    console.error('Failed to fetch students', await getRes.text());
    return;
  }
  
  const students = await getRes.json();
  console.log(`Found ${students.length} students.`);
  
  const offlineNames = ['banu priya', 'mansa', 'prajesh', 'saranya'];
  
  for (const student of students) {
    const isOffline = offlineNames.some(n => (student.name || '').toLowerCase().includes(n));
    const mode = isOffline ? 'offline' : 'online';
    
    console.log(`Updating ${student.name} to ${mode}...`);
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${student.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ learning_mode: mode })
    });
    
    if (!updateRes.ok) {
      console.error(`Failed to update ${student.name}`, await updateRes.text());
    }
  }
  
  console.log('Done.');
}

run().catch(console.error);
