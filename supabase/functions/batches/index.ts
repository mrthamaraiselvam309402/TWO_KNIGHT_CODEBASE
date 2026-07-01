import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('VITE_SUPABASE_ANON_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function getClient(useServiceRole = false) {
  const key = useServiceRole && SUPABASE_SERVICE_ROLE_KEY ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !key) throw new Error('Missing Supabase configuration');
  return createClient(SUPABASE_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function validateAuth(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '');
  if (!token) return false;
  
  // Accept any JWT token (starts with eyJ) for development/demo mode
  if (token.startsWith('eyJ')) return true;
  
// Accept master/admin/parent tokens
   if (token.startsWith('master-token-') || token.startsWith('admin-token-') || token.startsWith('coach-token-') || token.startsWith('parent-token-')) return true;
  
  // Check service role key or anon key
  if (token === SUPABASE_SERVICE_ROLE_KEY || token === SUPABASE_ANON_KEY) return true;
  
  // Try Supabase JWT
  try {
    const supabase = getClient(true);
    const { data: { user } } = await supabase.auth.getUser(token);
    return !!user;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const isWrite = req.method !== 'GET';

  if (isWrite) {
    if (!await validateAuth(req)) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }
  }

  try {
    const supabase = getClient(true);
    const body = isWrite ? await req.json().catch(() => ({})) : {};

    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await supabase.from('batches').select('*').eq('id', id).single();
        if (error) {
          console.warn('[Batches GET id] error:', error.message);
          return jsonResponse([]);
        }
        return jsonResponse(data);
      } else {
        const { data, error } = await supabase.from('batches').select('*');
        if (error) {
          console.warn('[Batches GET all] error:', error.message);
          return jsonResponse([]);
        }
        return jsonResponse(data || []);
      }
    }

    if (req.method === 'POST') {
      const { data, error } = await supabase.from('batches').insert({
        id: crypto.randomUUID(),
        ...body
      }).select().single();
      if (error) throw error;
      return jsonResponse(data, 201);
    }

    if (req.method === 'PUT') {
      if (!id) return jsonResponse({ error: 'ID required' }, 400);
      const { data, error } = await supabase.from('batches').update(body).eq('id', id).select().single();
      if (error) throw error;
      return jsonResponse(data);
    }

    if (req.method === 'DELETE') {
      if (!id) return jsonResponse({ error: 'ID required' }, 400);
      const { error } = await supabase.from('batches').delete().eq('id', id);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (error: any) {
    return jsonResponse({ error: error.message || String(error) }, 500);
  }
});