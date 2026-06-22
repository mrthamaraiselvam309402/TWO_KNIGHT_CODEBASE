import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from './rate_limit.js';

import { checkRateLimit } from '../auth/rate_limit.js';

Deno.serve(async (req) => {
  

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Create client with service_role to manage users via admin API
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, role',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify requester is a master admin
  const requestRole = req.headers.get('role');
  if (requestRole !== 'master' && requestRole !== 'admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized: Admin privileges required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const method = req.method;

    if (method === 'GET') {
      // List users
      const { data: users, error } = await supabase.auth.admin.listUsers();
      if (error) throw error;
      
      const safeUsers = users.users.map(u => ({
        id: u.id,
        email: u.email,
        role: u.user_metadata?.role || 'unknown',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at
      }));

      return new Response(JSON.stringify({ users: safeUsers }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (method === 'POST') {
      // Create user
      const body = await req.json();
      const { email, password, role } = body;
      
      if (!email || !password || !role) {
         return new Response(JSON.stringify({ error: 'Email, password, and role are required' }), {
           status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
         });
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { role: role }
      });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, user: data.user }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (method === 'PUT') {
      // Update user role or password
      const body = await req.json();
      const { id, role, password } = body;

      if (!id) {
         return new Response(JSON.stringify({ error: 'User ID is required' }), {
           status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
         });
      }

      const updates: any = {};
      if (role) updates.user_metadata = { role: role };
      if (password) updates.password = password;

      const { data, error } = await supabase.auth.admin.updateUserById(id, updates);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, user: data.user }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (method === 'DELETE') {
      // Delete user
      const body = await req.json();
      const { id } = body;

      if (!id) {
         return new Response(JSON.stringify({ error: 'User ID is required' }), {
           status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
         });
      }

      const { error } = await supabase.auth.admin.deleteUser(id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error: any) {
    console.error('Access Control error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});