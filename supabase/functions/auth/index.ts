Deno.serve(async (req) => {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, username, password } = body;

    if (action !== 'login') {
      return new Response(JSON.stringify({ error: 'Unknown action' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Username and password are required' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    const masterUser = Deno.env.get('MASTER_USERNAME');
    const masterPass = Deno.env.get('MASTER_PASSWORD');
    const adminUser = Deno.env.get('ADMIN_USERNAME');
    const adminPass = Deno.env.get('ADMIN_PASSWORD');

    if (!masterUser || !masterPass || !adminUser || !adminPass) {
      console.error('Auth credentials not configured');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Check master credentials
    if (username === masterUser && password === masterPass) {
      return new Response(JSON.stringify({
        success: true,
        token: 'master-token-' + Date.now(),
        role: 'master'
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Check admin credentials
    if (username === adminUser && password === adminPass) {
      return new Response(JSON.stringify({
        success: true,
        token: 'admin-token-' + Date.now(),
        role: 'admin'
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Check parent credentials (username = student name, password = parent phone)
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, parent_phone')
      .ilike('name', username)
      .eq('parent_phone', password)
      .single();

    if (student) {
      return new Response(JSON.stringify({
        success: true,
        token: 'parent-token-' + Date.now(),
        role: 'parent',
        student_id: student.id,
        user: student.name
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Failed attempt
    return new Response(JSON.stringify({ error: 'Invalid credentials. Use Student Name + Parent Phone for Portal access.' }), { 
      status: 401, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (error) {
    console.error('Auth error:', error.message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }
});

