
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vseombfkrvpffnpgbsnk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFullFlow() {
  console.log('--- Testing Coaches CRUD via direct DB access (simulating Edge Function) ---');
  
  const testId = 'test_' + Math.random().toString(36).substring(7);
  const testName = 'Test Coach ' + testId;

  // 1. Test Insert
  console.log('1. Testing INSERT...');
  const newCoach = {
    id: testId,
    name: testName,
    email: 'test@example.com',
    phone: '1234567890',
    specialization: 'Tactics',
    hourly_rate: 500,
    status: 'active',
    role: 'coach'
  };

  const { data: inserted, error: insertError } = await supabase
    .from('coaches')
    .insert(newCoach)
    .select();

  if (insertError) {
    console.error('INSERT failed:', insertError.message);
  } else {
    console.log('INSERT succeeded!');
  }

  // 2. Test Update (The fix we just applied)
  console.log('2. Testing UPDATE (The fix)...');
  const { data: updated, error: updateError } = await supabase
    .from('coaches')
    .update({ name: testName + ' Updated', specialization: 'Endgame' })
    .eq('id', testId)
    .select();

  if (updateError) {
    console.error('UPDATE failed:', updateError.message);
  } else {
    console.log('UPDATE succeeded!');
  }

  // 3. Test Delete
  console.log('3. Testing DELETE...');
  const { error: deleteError } = await supabase
    .from('coaches')
    .delete()
    .eq('id', testId);

  if (deleteError) {
    console.error('DELETE failed:', deleteError.message);
  } else {
    console.log('DELETE succeeded!');
  }

  console.log('--- Test Complete ---');
}

testFullFlow();
