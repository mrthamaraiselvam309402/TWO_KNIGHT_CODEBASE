import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, validateAuth } from './rate_limit.js';

// Helper function for input validation - must be defined before use
function sanitizeString(str: unknown, maxLength = 255): string {
  if (typeof str !== 'string') return ''
  return str.slice(0, maxLength).replace(/[<>"'`;]/g, '').trim()
}

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
  const rateLimitResult = await checkRateLimit(ip, 'payments')
  
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
  
  function transformPayment(p: Record<string, unknown>) {
    return {
      id: p.id,
      student_id: p.student_id,
      amount: parseFloat(String(p.amount || 0)),
      status: p.status || 'pending',
      payment_method: p.payment_method || '',
      description: p.description || '',
      transaction_id: p.transaction_id || null,
      payment_date: p.payment_date || p.created_at || new Date().toISOString(),
      created_at: p.created_at || new Date().toISOString(),
      applied_month: p.applied_month || null
    }
  }
  
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const method = req.method
    const studentId = url.searchParams.get('student_id')
    
    // GET - List payments with pagination
    if (method === 'GET') {
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
      const limit = Math.min(1000, Math.max(1, parseInt(url.searchParams.get('limit') || '100')))
      const offset = (page - 1) * limit
      
      let query = supabase
        .from('payments')
        .select('*', { count: 'exact' })
        .order('payment_date', { ascending: false })
        .range(offset, offset + limit - 1)
      
      if (studentId) {
        query = query.eq('student_id', studentId)
      }
      
      const { data: payments, error, count } = await query
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const transformed = (payments || []).map(transformPayment)
      
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
    
    // POST - Create new payment
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

      const { data: studentExists } = await supabase
        .from('students')
        .select('id')
        .eq('id', studentId)
        .single();
      if (!studentExists) {
        return new Response(JSON.stringify({ error: 'Invalid student selected' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const amount = parseFloat(String(rawBody.amount || 0))
      if (isNaN(amount) || amount <= 0) {
        return new Response(JSON.stringify({ error: 'Amount must be greater than zero' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const newPayment: Record<string, unknown> = {
        id: rawBody.id || `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        student_id: studentId,
        amount: amount,
        status: 'paid',
        payment_method: sanitizeString(rawBody.payment_method || 'Online', 50),
        description: sanitizeString(rawBody.description || 'Monthly Tuition', 200),
        transaction_id: rawBody.transaction_id || `TXN-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        payment_date: rawBody.payment_date ? String(rawBody.payment_date) : new Date().toISOString(),
        created_at: new Date().toISOString()
      }
      
      const { data: insertedPayment, error: insertError } = await supabase
        .from('payments')
        .insert(newPayment)
        .select()
        .single()
      
      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Refresh the student's current-month payment status.
      try {
        await supabase.rpc('recompute_payment_statuses')
      } catch (rpcErr) {
        console.error('[payments] recompute_payment_statuses failed:', rpcErr)
      }

      return new Response(JSON.stringify(insertedPayment ? transformPayment(insertedPayment) : { success: true }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // DELETE - Remove payment and its allocations
    if (method === 'DELETE') {
      if (!id) {
        return new Response(JSON.stringify({ error: 'Payment ID is required for deletion' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // 1. Find which student this payment belongs to (for cleanup)
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('student_id, id')
        .eq('id', id)
        .single()

      // 2. Remove the payment record
      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('id', id)

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // 3. Refresh the student's current-month payment status
      if (existingPayment?.student_id) {
        try {
          await supabase.rpc('recompute_payment_statuses')
        } catch (rpcErr) {
          console.error('[payments] recompute_payment_statuses failed:', rpcErr)
        }
      }

      return new Response(JSON.stringify({ 
        success: true,
        cleared_allocations: !!existingPayment
      }), {
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