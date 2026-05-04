import { checkRateLimit } from './rate_limit.js'

// Helper function for input validation - must be defined before use
function sanitizeString(str: unknown, maxLength = 255): string {
  if (typeof str !== 'string') return ''
  return str.slice(0, maxLength).replace(/[<>"'`;]/g, '').trim()
}

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
  const rateLimitResult = await checkRateLimit(ip, 'rating_history')
  
  if (!rateLimitResult.allowed) {
    return new Response(JSON.stringify({ 
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
    }), { 
      status: 429, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
  
  function transformRatingHistory(r: Record<string, unknown>) {
    return {
      id: r.id,
      student_id: r.student_id,
      rating: r.rating || 0,
      old_rating: r.old_rating || null,
      change_type: r.change_type || 'manual',
      notes: r.notes || '',
      recorded_at: r.recorded_at || new Date().toISOString()
    }
  }
  
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const method = req.method
    const studentId = url.searchParams.get('student_id')
    
    // GET - List rating history with pagination
    if (method === 'GET') {
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
      const limit = Math.min(1000, Math.max(1, parseInt(url.searchParams.get('limit') || '100')))
      const offset = (page - 1) * limit
      const search = studentId ? `student_id.eq.${studentId}` : undefined
      
      let query = supabase
        .from('rating_history')
        .select('*', { count: 'exact' })
        .order('recorded_at', { ascending: false })
        .range(offset, offset + limit - 1)
      
      if (studentId) {
        query = query.eq('student_id', studentId)
      }
      
      const { data: ratings, error, count } = await query
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const transformed = (ratings || []).map(transformRatingHistory)
      
      return new Response(JSON.stringify({
        data: transformed,
        pagination: {
          page,
          limit,
          total: count || transformed.length,
          total_pages: count ? Math.ceil(count / limit) : 1
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // POST - Create new rating entry
    if (method === 'POST') {
      let rawBody: Record<string, unknown> = {}
      try { rawBody = await req.json() } catch (_e) {}
      
      const studentId = String(rawBody.student_id || '').trim()
      if (!studentId) {
        return new Response(JSON.stringify({ error: 'Student ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const rating = parseInt(String(rawBody.rating || 0))
      if (isNaN(rating) || rating < 0 || rating > 3500) {
        return new Response(JSON.stringify({ error: 'Rating must be between 0 and 3500' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const newRating: Record<string, unknown> = {
        id: crypto.randomUUID(),
        student_id: studentId,
        rating: rating,
        old_rating: rawBody.old_rating ? parseInt(String(rawBody.old_rating)) || null : null,
        change_type: sanitizeString(rawBody.change_type || 'manual', 50),
        notes: sanitizeString(rawBody.notes || '', 2000),
        recorded_at: rawBody.recorded_at ? String(rawBody.recorded_at) : new Date().toISOString()
      }
      
      const { data: insertedRating, error: insertError } = await supabase
        .from('rating_history')
        .insert(newRating)
        .select()
        .single()
      
      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify(insertedRating ? transformRatingHistory(insertedRating) : { success: true }), {
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