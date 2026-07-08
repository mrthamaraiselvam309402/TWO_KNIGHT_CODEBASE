import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Decode the role claim from a Supabase JWT without verifying the signature
// (the gateway has already validated it). Returns '' if it can't be read.
function decodeJwtRole(token: string): string {
  try {
    const raw = token.replace(/^Bearer\s+/i, '').split('.')[1];
    if (!raw) return '';
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
    );
    const payload = JSON.parse(json);
    return (
      payload?.user_metadata?.role ||
      payload?.app_metadata?.role ||
      payload?.role ||
      ''
    );
  } catch {
    return '';
  }
}

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, role'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify requester has admin/master role. The Supabase gateway already
  // validates the JWT, so any request that reaches this function is
  // authenticated. We accept the role from the custom `role`/`x-user-role`
  // header OR from the JWT's user_metadata (admin logins carry role there).
  const requestRole =
    req.headers.get('role') || req.headers.get('x-user-role') || '';
  const headerToken =
    req.headers.get('Authorization') || req.headers.get('authorization') || '';
  const isAuthenticated = headerToken.startsWith('Bearer ');
  const jwtRole = decodeJwtRole(headerToken);
  const effectiveRole = requestRole || jwtRole;

  if (
    !isAuthenticated ||
    (effectiveRole !== 'master' && effectiveRole !== 'admin')
  ) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Admin privileges required' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }

  try {
    const method = req.method;

    if (method === 'GET') {
      // List users
      const { data: users, error } = await supabase.auth.admin.listUsers();
      if (error) throw error;

      // Enrich with password metadata from students/coaches tables
      const emails = users.users.map(u => u.email || '').filter(Boolean);
      const { data: studentRows } = await supabase.from('students').select('email,password,password_hash').in('email', emails);
      const { data: coachRows } = await supabase.from('coaches').select('email,password_hash').in('email', emails);

      const studentMap = new Map<string, any>((studentRows || []).map((s: any) => [s.email, s]));
      const coachMap = new Map<string, any>((coachRows || []).map((c: any) => [c.email, c]));

      const masterUser = Deno.env.get('MASTER_USERNAME') || '';
      const adminUser = Deno.env.get('ADMIN_USERNAME') || '';

       const safeUsers = users.users.map((u: any) => {
        const email = u.email || '';
        const role = u.user_metadata?.role || 'unknown';
        const passwordPlain = u.user_metadata?.password_plain || u.user_metadata?.password_info?.value || u.user_metadata?.password;
        let passwordInfo: { source: string; masked: string; visible: boolean; value?: string } = { source: 'Supabase Auth', masked: '●●●●●●●●', visible: false };

        if (passwordPlain) {
          passwordInfo = { source: 'Supabase Metadata', masked: '••••••••', visible: true, value: passwordPlain };
        } else if (role === 'master' || role === 'admin') {
          if (email && (email === masterUser || email === adminUser)) {
            passwordInfo = { source: 'Environment Variable', masked: 'Env Configured', visible: false };
          } else {
            passwordInfo = { source: 'Supabase Auth', masked: '●●●●●●●●', visible: false };
          }
        } else {
          const student = studentMap.get(email);
          const coach = coachMap.get(email);
          if (student) {
            if (student.password) {
              passwordInfo = { source: 'Custom (plaintext)', masked: student.password, visible: true, value: student.password };
            } else if (student.password_hash) {
              passwordInfo = { source: 'Custom (bcrypt)', masked: student.password_hash, visible: true, value: student.password_hash };
            }
          } else if (coach) {
            if (coach.password_hash) {
              passwordInfo = { source: 'Custom (bcrypt)', masked: '••••••••', visible: false };
            }
          }
        }

        return {
          id: u.id,
          email: u.email,
          role: role,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          password_info: passwordInfo
        };
      });

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
        user_metadata: { role: role, password_plain: password }
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
      const meta: any = {};
      if (role) meta.role = role;
      if (password) {
        updates.password = password;
        meta.password_plain = password;
      }
      if (Object.keys(meta).length > 0) {
        updates.user_metadata = meta;
      }

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