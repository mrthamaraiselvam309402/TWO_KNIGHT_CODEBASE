
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vseombfkrvpffnpgbsnk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEventsUpdate() {
  console.log('Fetching an event to test update...');
  const { data: events, error: fetchError } = await supabase
    .from('events')
    .select('*')
    .limit(1);

  if (fetchError) {
    console.error('Error fetching event:', fetchError);
    return;
  }

  if (!events || events.length === 0) {
    console.log('No events found to test.');
    return;
  }

  const event = events[0];
  console.log(`Testing update for event: ${event.title} (ID: ${event.id})`);

  console.log("Attempting to update with 'date' (should fail if column missing)...");
  const { error: dateError } = await supabase
    .from('events')
    .update({ date: event.event_date })
    .eq('id', event.id);

  if (dateError) {
    console.log('Update with date failed as expected:', dateError.message);
  } else {
    console.log('Update with date UNEXPECTEDLY succeeded!');
  }

  console.log("Attempting to update with 'prize_pool' (should fail if column missing)...");
  const { error: prizeError } = await supabase
    .from('events')
    .update({ prize_pool: '5000' })
    .eq('id', event.id);

  if (prizeError) {
    console.log('Update with prize_pool failed as expected:', prizeError.message);
  } else {
    console.log('Update with prize_pool UNEXPECTEDLY succeeded!');
  }
}

testEventsUpdate();
