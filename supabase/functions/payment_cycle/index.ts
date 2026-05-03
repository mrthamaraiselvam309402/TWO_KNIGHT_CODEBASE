import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const url = new URL(req.url)
    const year  = parseInt(url.searchParams.get('year')  || String(new Date().getFullYear()))
    const month = parseInt(url.searchParams.get('month') || String(new Date().getMonth() + 1))
    const month2 = parseInt(url.searchParams.get('month2') || String(month))
    const detail = url.searchParams.get('detail') === 'true'

    const { data: summary, error: summaryErr } = await supabase.rpc('get_cycle_summary', {
      p_year: year, p_month1: month, p_month2: month2
    })
    if (summaryErr) throw summaryErr

    let students = null
    if (detail) {
      const { data: studentData, error: studentErr } = await supabase.rpc(
        'get_payment_status_for_cycle',
        { p_year: year, p_month1: month, p_month2: month2 }
      )
      if (studentErr) throw studentErr
      students = studentData
    }

    return new Response(JSON.stringify({
      year, month, month2,
      summary: summary || [],
      students,
      generated_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
