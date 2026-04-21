
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vseombfkrvpffnpgbsnk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEventsFix() {
  console.log('Fetching an event to test fix...');
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
  console.log(`Testing fix for event: ${event.title} (ID: ${event.id})`);

  // Simulating what the edge function NOW does: correctly mapping to event_date
  console.log("Attempting to update with corrected logic (mapping to 'event_date')...");
  const { error: fixedError } = await supabase
    .from('events')
    .update({ event_date: event.event_date, title: event.title + ' (Verified)' })
    .eq('id', event.id);

  if (fixedError) {
    console.error('Update failed even with corrected logic:', fixedError.message);
  } else {
    console.log('Update succeeded with corrected logic!');
  }
}

testEventsFix();
