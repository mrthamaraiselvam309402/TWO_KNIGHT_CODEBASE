import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, validateAuth } from './rate_limit.js';

Deno.serve(async (req) => {
  
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*'
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  }
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  // --- Rate Limiting ---
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rateLimitResult = await checkRateLimit(ip, 'audit')
  
  if (!rateLimitResult.allowed) {
    return new Response(JSON.stringify({ 
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
    }), { 
      status: 429, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  // --- Authentication ---
  
  const auth = await validateAuth(req, supabase)
  if (!auth.allowed) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  
  function transformAudit(a: Record<string, unknown>) {
    return {
      id: a.id,
      table_name: a.table_name || '',
      record_id: a.record_id || '',
      action: a.action || '',
      old_value: a.old_value || null,
      new_value: a.new_value || null,
      user_name: a.user_name || 'system',
      user_role: a.user_role || 'system',
      timestamp: a.timestamp || new Date().toISOString()
    }
  }
  
  try {
    const url = new URL(req.url)
    const method = req.method
    const limitParam = url.searchParams.get('limit')
    
    // GET - List audit logs
    if (method === 'GET') {
      const limit = Math.min(100, Math.max(1, parseInt(limitParam || '10')))
      
      const { data: logs, error } = await supabase
        .from('audit')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit)
      
      if (error) throw error
      
      return new Response(JSON.stringify((logs || []).map(transformAudit)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST - Log new audit entry
    if (method === 'POST') {
      let body: Record<string, unknown> = {}
      try { body = await req.json() } catch (_e) {}

      const newLog = {
        id: crypto.randomUUID(),
        table_name: String(body.table_name || ''),
        record_id: String(body.record_id || ''),
        action: String(body.action || ''),
        old_value: body.old_value || null,
        new_value: body.new_value || null,
        user_name: String(body.user_name || 'system'),
        user_role: String(body.user_role || 'system'),
        timestamp: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('audit')
        .insert(newLog)
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify(transformAudit(data)), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})