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

  // FIX: sanitizeString was used but never defined in this file
  function sanitizeString(str: unknown, maxLength = 255): string {
    if (typeof str !== 'string') return ''
    return str.slice(0, maxLength).replace(/[<>\"';]/g, '').trim()
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  async function getStudentName(studentId: string) {
    if (!studentId) return ''
    const { data } = await supabase.from('students').select('name').eq('id', studentId).single()
    return data?.name || ''
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    const method = req.method

    // CREATE NEW PAYMENT
    if (method === 'POST' || action === 'create') {
      let body = {}
      try {
        body = await req.json()
      } catch (e) {
        // Try to parse from URL search params
        const url = new URL(req.url)
        body = {
          id: crypto.randomUUID(),
          student_id: url.searchParams.get('student_id'),
          amount: Number(url.searchParams.get('amount')) || 5000,
          status: url.searchParams.get('status'),
          description: url.searchParams.get('description'),
          payment_method: url.searchParams.get('payment_method'),
          transaction_id: url.searchParams.get('transaction_id')
        }
      }
      const { student_id, amount, status, description, payment_method, transaction_id } = body

      // If just updating payment status (mark as paid)
      if (student_id && status === 'paid') {
        const { data: payment, error } = await supabase.from('payments').insert({
          student_id,
          amount: amount || 5000,
          currency: 'USD',
          status: 'paid',
          payment_method: payment_method || 'cash',
          transaction_id: transaction_id || `TXN_${Date.now()}`,
          description: description || 'Tuition Payment',
          payment_date: new Date().toISOString()
        }).select().single()

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Check current status for sequential transition
        const { data: student } = await supabase.from('students').select('status').eq('id', student_id).single();
        const currentStatus = (student?.status || '').toLowerCase();
        
        let nextStatus = 'active';
        let nextPaymentStatus = 'Paid';
        
        // If they were 'due' (arrears), they move to 'pending' (current month still owed)
        if (currentStatus === 'due' || currentStatus === 'overdue') {
          nextStatus = 'pending';
          nextPaymentStatus = 'Pending';
        }

        // Update student's status in students table
        await supabase.from('students').update({ 
          payment_status: nextPaymentStatus,
          status: nextStatus
        }).eq('id', student_id)

        return new Response(JSON.stringify({ success: true, payment }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Create new payment record
      const { data: payment, error } = await supabase.from('payments').insert({
        id: crypto.randomUUID(),
        student_id,
        amount: amount || 5000,
        currency: 'USD',
        status: status || 'pending',
        description: description || 'Tuition Payment',
        payment_date: new Date().toISOString()
      }).select().single()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true, payment }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // GET payments list with pagination
    if (method === 'GET' || action === 'list') {
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
      const limit = Math.min(1000, Math.max(1, parseInt(url.searchParams.get('limit') || '100')))
      const offset = (page - 1) * limit
      const studentId = sanitizeString(url.searchParams.get('student_id') || '', 50)
      const statusFilter = sanitizeString(url.searchParams.get('status') || '', 50)
      
      let query = supabase
        .from('payments')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
      
      if (studentId) {
        query = query.eq('student_id', studentId)
      }
      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }
      
      const { data: payments, error, count } = await query
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const transformed = await Promise.all(
        (payments || []).map(async (p) => ({
          id: p.id,
          student_id: p.student_id,
          student_name: await getStudentName(p.student_id),
          amount: p.amount || 0,
          currency: p.currency || 'USD',
          status: p.status || 'pending',
          payment_method: p.payment_method || '',
          transaction_id: p.transaction_id || '',
          description: p.description || '',
          payment_date: p.payment_date || '',
          created_at: p.created_at
        }))
      )
      
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

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})