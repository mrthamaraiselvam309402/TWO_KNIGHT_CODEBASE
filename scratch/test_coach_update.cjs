
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vseombfkrvpffnpgbsnk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
  console.log('Fetching a coach to test update...');
  const { data: coaches, error: fetchError } = await supabase
    .from('coaches')
    .select('*')
    .limit(1);

  if (fetchError) {
    console.error('Error fetching coach:', fetchError);
    return;
  }

  if (!coaches || coaches.length === 0) {
    console.log('No coaches found to test.');
    return;
  }

  const coach = coaches[0];
  console.log(`Testing update for coach: ${coach.name} (ID: ${coach.id})`);

  // We want to test if 'full_name' update fails directly via Supabase client
  // as the edge function was doing.
  console.log("Attempting to update with 'full_name' (should fail if column missing)...");
  const { error: directError } = await supabase
    .from('coaches')
    .update({ full_name: coach.name })
    .eq('id', coach.id);

  if (directError) {
    console.log('Direct update failed as expected:', directError.message);
  } else {
    console.log('Direct update UNEXPECTEDLY succeeded. Maybe column exists?');
  }

  console.log("Attempting to update with 'name' (should succeed)...");
  const { error: nameError } = await supabase
    .from('coaches')
    .update({ name: coach.name })
    .eq('id', coach.id);

  if (nameError) {
    console.error('Update with name failed:', nameError);
  } else {
    console.log('Update with name succeeded!');
  }
}

testUpdate();
