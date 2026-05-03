import { checkRateLimit } from '../../functions/rate_limit.js';

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

  // Check rate limit
  const ip = req.headers.get('x-forwarded-for') || 
             req.headers.get('x-real-ip') || 
             req.headers.get('cf-connecting-ip') ||
             'unknown';
  const rateLimitResult = await checkRateLimit(ip, 'auth');
  
  if (!rateLimitResult.allowed) {
    return new Response(JSON.stringify({ 
      error: 'Rate limit exceeded',
      message: 'Too many login attempts. Please try again later.',
      retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
    }), { 
      status: 429, 
      headers: { 
        'Content-Type': 'application/json', 
        ...corsHeaders,
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.resetTime),
        'Retry-After': String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000))
      } 
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

    // 1. Check Supabase Auth (Built-in users from Dashboard)
    // This is the secure way to handle Admin/Master access
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: username,
      password: password,
    });

    if (!authError && authData.user) {
      // Enforce explicit role metadata - Fix #25
      const userRole = authData.user.user_metadata?.role;
      if (!userRole) {
        return new Response(JSON.stringify({ error: 'Access denied: No role assigned in metadata.' }), { 
          status: 403, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
      }
      
      return new Response(JSON.stringify({
        success: true,
        token: authData.session?.access_token || 'session-' + Date.now(),
        role: userRole,
        user: authData.user.email
      }), { 
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders,
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetTime)
        } 
      });

    // 4. Check parent credentials (username = student name, password = parent phone)
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
    return new Response(JSON.stringify({ 
      error: 'Invalid credentials.',
      details: authError ? authError.message : 'Check if user exists in Supabase Auth or as a Student Name + Parent Phone.' 
    }), { 
      status: 401, 
      headers: { 
        'Content-Type': 'application/json', 
        ...corsHeaders,
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.resetTime)
      } 
    }); catch (error) {
    console.error('Auth error:', error.message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }
});

