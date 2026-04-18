Deno.serve(async (req) => {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*'
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const studentId = url.searchParams.get('student_id')
    const method = req.method

    if (method === 'GET') {
      let query = supabase.from('rating_history').select('*').order('recorded_at', { ascending: true })
      if (studentId) query = query.eq('student_id', studentId)
      
      const { data, error } = await query
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (method === 'POST') {
      const body = await req.json()
      const { data, error } = await supabase.from('rating_history').insert({
        student_id: body.student_id,
        rating: body.rating,
        recorded_at: body.recorded_at || new Date().toISOString().split('T')[0],
        change_type: body.change_type || 'manual',
        notes: body.notes || ''
      }).select().single()

      if (error) throw error
      return new Response(JSON.stringify(data), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
  }
})
