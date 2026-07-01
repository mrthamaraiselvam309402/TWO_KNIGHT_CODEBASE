import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500 });
  }

  // Ensure this is triggered by a secure source (e.g. cron job sending a valid auth header)
  const authHeader = req.headers.get('Authorization') || '';
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // We want to find students where account_status is 'pending' AND due_date is past
    const today = new Date().toISOString().split('T')[0];

    const { data: students, error: fetchError } = await supabase
      .from('students')
      .select('id, name, due_date, account_status')
      .eq('account_status', 'pending')
      .lt('due_date', today);

    if (fetchError) {
      throw fetchError;
    }

    let updatedCount = 0;

    for (const student of students) {
      console.log(`Updating student ${student.name} (${student.id}) status to 'due' (Due Date: ${student.due_date})`);
      const { error: updateError } = await supabase
        .from('students')
        .update({ account_status: 'due', status: 'due' })
        .eq('id', student.id);
      
      if (!updateError) {
        updatedCount++;
      }
    }

    return new Response(JSON.stringify({ success: true, updatedCount }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
