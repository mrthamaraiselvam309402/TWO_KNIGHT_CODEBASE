import { checkRateLimit } from './rate_limit.js'

Deno.serve(async (req) => {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
  
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
  const rateLimitResult = await checkRateLimit(ip, 'attendance')
  
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
  const { validateAuth } = await import('./rate_limit.js')
  const auth = await validateAuth(req, supabase)
  if (!auth.allowed) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  
  function transformAttendance(a: Record<string, unknown>) {
    return {
      id: a.id,
      student_id: a.student_id,
      date: a.date || '',
      status: a.status || '',
      notes: a.notes || '',
      created_at: a.created_at || new Date().toISOString()
    }
  }
  
  try {
    const url = new URL(req.url)
    const method = req.method
    const date = url.searchParams.get('date')
    const studentId = url.searchParams.get('student_id')
    
    // GET - List attendance records
    if (method === 'GET') {
      let query = supabase
        .from('attendance')
        .select('*', { count: 'exact' })
        .order('date', { ascending: false })
      
      if (date) {
        query = query.eq('date', date)
      }
      if (studentId) {
        query = query.eq('student_id', studentId)
      }
      
      const { data: attendance, error, count } = await query
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const transformed = (attendance || []).map(transformAttendance)
      
      return new Response(JSON.stringify({
        data: transformed,
        pagination: {
          total: count || transformed.length
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // POST - Create/update attendance records (bulk)
    if (method === 'POST') {
      let body: Record<string, unknown>[] = []
      try { body = await req.json() } catch (_e) {}
      
      if (!Array.isArray(body)) {
        return new Response(JSON.stringify({ error: 'Expected array of attendance records' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const records = body.map((record: Record<string, unknown>) => ({
        id: record.id || crypto.randomUUID(),
        student_id: String(record.student_id || ''),
        date: String(record.date || ''),
        status: String(record.status || ''),
        notes: String(record.notes || ''),
        created_at: String(record.created_at || new Date().toISOString())
      })).filter(r => r.student_id && r.date && r.status)
      
      if (records.length === 0) {
        return new Response(JSON.stringify({ error: 'No valid attendance records provided' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Upsert records
      const { data: upserted, error: upsertError } = await supabase
        .from('attendance')
        .upsert(records, { onConflict: ['student_id', 'date'] })
        .select()
      
      if (upsertError) {
        return new Response(JSON.stringify({ error: upsertError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({
        success: true,
        count: upserted?.length || 0,
        data: upserted?.map(transformAttendance) || []
      }), {
        status: 200,
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