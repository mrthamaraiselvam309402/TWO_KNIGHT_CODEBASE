import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from './rate_limit.js';

function base64UrlEncode(input: Uint8Array): string {
  let binary = '';
  input.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function tokenLifetimeSeconds(role: string) {
  if (role === 'admin') return 15 * 60;
  if (role === 'master') return 4 * 60 * 60;
  if (role === 'parent') return 10 * 60;
  if (role === 'coach') return 15 * 60;
  return 15 * 60;
}

async function createSignedToken(payload: Record<string, unknown>) {
  const secret = Deno.env.get('JWT_SECRET') || '';
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT', aud: 'twoknights-api', iss: 'twoknights-auth' };
  const headerPart = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadPart = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerPart}.${payloadPart}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function verifySignedToken(token: string) {
  const secret = Deno.env.get('JWT_SECRET') || '';
  if (!secret || !token.includes('.')) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
    if (header?.alg !== 'HS256' || header?.typ !== 'JWT' || header?.aud !== 'twoknights-api' || header?.iss !== 'twoknights-auth') return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signature = base64UrlDecode(parts[2]);
    const verified = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(`${parts[0]}.${parts[1]}`));
    if (!verified) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
    const exp = Number(payload.exp || 0);
    if (exp && exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function createCustomTokenSession(supabase: any, role: string, username: string, studentId: string | null = null) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + tokenLifetimeSeconds(role);
  const jti = crypto.randomUUID();
  const token = await createSignedToken({
    sub: studentId ? `student:${studentId}` : `env:${role}:${username}`,
    role,
    user: username,
    student_id: studentId,
    jti,
    aud: 'twoknights-api',
    iss: 'twoknights-auth',
    iat: now,
    exp
  });

  const { error } = await supabase
    .from('token_sessions')
    .insert({
      jti,
      role,
      user_name: username,
      student_id: studentId,
      expires_at: new Date(exp * 1000).toISOString()
    });

  if (error) throw error;
  return token;
}

async function createEnvAdminToken(supabase: any, role: string, username: string) {
  return createCustomTokenSession(supabase, role, username);
}

async function createParentToken(supabase: any, studentId: string, username: string) {
  return createCustomTokenSession(supabase, 'parent', username, studentId);
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

    if (action === 'logout') {
      const token = String(body.token || '');
      const payload = await verifySignedToken(token);
      const jti = payload?.jti;
      if (jti) {
        await supabase
          .from('token_sessions')
          .update({ revoked_at: new Date().toISOString() })
          .eq('jti', jti)
          .is('revoked_at', null);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

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

    // 1. Check Hardcoded Admin/Master from .env (Stabilization Fallback)
    const masterUser = Deno.env.get('MASTER_USERNAME');
    const masterPass = Deno.env.get('MASTER_PASSWORD');
    const adminUser = Deno.env.get('ADMIN_USERNAME');
    const adminPass = Deno.env.get('ADMIN_PASSWORD');

    // Debug log for server-side troubleshooting
    console.log(`Login attempt for: ${username}`);

    if (masterUser && masterPass && String(username) === String(masterUser) && String(password) === String(masterPass)) {
      console.log("Master login successful");
      const token = await createEnvAdminToken(supabase, 'master', masterUser);
      return new Response(JSON.stringify({
        success: true,
        token,
        role: 'master',
        user: masterUser
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (adminUser && adminPass && String(username) === String(adminUser) && String(password) === String(adminPass)) {
      console.log("Admin login successful");
      const token = await createEnvAdminToken(supabase, 'admin', adminUser);
      return new Response(JSON.stringify({
        success: true,
        token,
        role: 'admin',
        user: adminUser
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // 2. Check Supabase Auth (Built-in users from Dashboard)
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
      const accessToken = authData.session?.access_token;
      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'Server configuration error: missing Supabase session token.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
return new Response(JSON.stringify({
        success: true,
        token: accessToken,
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
    }
    
    // 3. Check Coach credentials
    const cleanUsername = String(username).trim();
    
    console.log(`[Auth] Checking coach credentials. Name/Email: "${cleanUsername}"`);
    
    const { data: coachData, error: coachError } = await supabase.rpc('verify_user_password', {
      p_user_type: 'coach',
      p_identifier: cleanUsername,
      p_password: password
    });
    
    if (coachError) {
      console.warn('[Auth] Coach verify RPC failed:', coachError.message);
    } else if (coachData && coachData.valid) {
      console.log(`[Auth] Successful coach login for: ${coachData.name}`);
      const token = await createCustomTokenSession(supabase, 'coach', coachData.name, coachData.id);
      return new Response(JSON.stringify({
        success: true,
        token,
        role: 'coach',
        coach_id: coachData.id,
        user: coachData.name
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    
    // 4. Check parent credentials
    const cleanStudentName = String(username).trim();
    
    console.log(`[Auth] Checking parent credentials. Name: "${cleanStudentName}"`);

    const { data: studentData, error: studentError } = await supabase.rpc('verify_user_password', {
      p_user_type: 'student',
      p_identifier: cleanStudentName,
      p_password: password
    });

    if (studentError) {
      console.warn('[Auth] Student verify RPC failed:', studentError.message);
    } else if (studentData && studentData.valid) {
      console.log(`[Auth] Successful parent login for student: ${studentData.name}`);
      const token = await createParentToken(supabase, studentData.id, studentData.name);
      return new Response(JSON.stringify({
        success: true,
        token,
        role: 'parent',
        student_id: studentData.id,
        user: studentData.name
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    } else {
      console.log(`[Auth] No parent/student records matched name "${cleanStudentName}" with given password.`);
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
    });
  } catch (error) {
    console.error('Auth error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }
});