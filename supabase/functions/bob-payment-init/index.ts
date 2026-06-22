import { checkRateLimit, validateAuth } from './rate_limit.js';

import crypto from 'node:crypto'

Deno.serve(async (req) => {
  
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500 })
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
  
  // Rate Limiting
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rateLimitResult = await checkRateLimit(ip, 'bob-payment-init')
  if (!rateLimitResult.allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: corsHeaders })
  }

  // Auth
  const auth = await validateAuth(req, supabase)
  if (!auth.allowed) {
    return new Response(JSON.stringify({ error: auth.error }), { status: 401, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { studentId, amount, batchDetails } = body

    if (!studentId || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return new Response(JSON.stringify({ error: 'Valid studentId and positive amount are required' }), { status: 400, headers: corsHeaders })
    }

    const txnid = `TXN-BOB-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    
    // Create pending payment record
    const { data: newPayment, error: insertError } = await supabase
      .from('payments')
      .insert({
        id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        student_id: studentId,
        amount: parseFloat(amount),
        status: 'pending',
        payment_method: 'Bank of Baroda e-Gateway',
        description: `Online Payment - ${batchDetails || 'Tuition Fee'}`,
        transaction_id: txnid,
        payment_date: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) throw insertError

    const merchantId = Deno.env.get('BOB_MERCHANT_ID') || 'TEST_MERCHANT_ID'
    const secretSalt = Deno.env.get('BOB_SECRET_SALT') || 'TEST_SECRET_SALT'
    
    // Replace with dynamic domain based on request headers if needed
    const host = req.headers.get('origin') || 'https://chesskidoo.com'
    const redirectUrl = `${host}/parent-portal/payment-success`

    const rawPayload = `${merchantId}|${txnid}|${amount}|${redirectUrl}`
    
    const secureHash = crypto
      .createHmac('sha256', secretSalt)
      .update(rawPayload)
      .digest('hex')

    return new Response(JSON.stringify({
      success: true,
      bankUrl: "https://ipeg.bankofbaroda.co.in/evault/sandbox", // Sandbox default
      payload: {
        merchantId,
        txnid,
        amount,
        redirectUrl,
        secureHash
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})