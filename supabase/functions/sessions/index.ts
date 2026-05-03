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

  function transformSession(s) {
    return {
      id: s.id,
      user_type: s.user_type,
      user_id: s.user_id,
      user_name: s.user_name,
      device: s.device,
      ip_address: s.ip_address,
      location: s.location,
      created_at: s.created_at
    };
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const userType = url.searchParams.get('user_type');
    const userId = url.searchParams.get('user_id');
    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};

    if (req.method === 'GET') {
      let query = supabase
        .from('login_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (id) {
        const { data: session, error } = await supabase
          .from('login_sessions')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;
        return new Response(JSON.stringify(session ? transformSession(session) : null), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      if (userType) {
        query = query.eq('user_type', userType);
      }
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: sessions, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify((sessions || []).map(transformSession)), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (req.method === 'POST') {
      const newSession = {
        id: crypto.randomUUID(),
        user_type: body.user_type || 'admin',
        user_id: body.user_id || 'admin',
        user_name: body.user_name || 'Admin',
        device: body.device || 'Web Browser',
        ip_address: body.ip_address || 'Unknown',
        location: body.location || 'Unknown',
        created_at: new Date().toISOString()
      };

      const { data: inserted, error: insertError } = await supabase
        .from('login_sessions')
        .insert(newSession)
        .select()
        .single();

      if (insertError) throw insertError;
      return new Response(JSON.stringify(transformSession(inserted)), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});
