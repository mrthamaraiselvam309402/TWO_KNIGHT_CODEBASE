import crypto from 'node:crypto'

Deno.serve(async (req) => {
  
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500 })
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  // We do not enforce strictly origin for webhook since it comes from Bank server, 
  // but we enforce signature verification.
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { merchantId, txnid, amount, status, secureHash } = body
    
    const secretSalt = Deno.env.get('BOB_SECRET_SALT') || 'TEST_SECRET_SALT'
    
    // Validate signature sent by the bank
    const expectedPayload = `${merchantId}|${txnid}|${amount}|${status}`
    const expectedHash = crypto
      .createHmac('sha256', secretSalt)
      .update(expectedPayload)
      .digest('hex')
      
    if (secureHash !== expectedHash) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400, headers: corsHeaders })
    }

    if (status === 'SUCCESS') {
      // 1. Mark as paid
      const { data: updatedPayment, error: updateError } = await supabase
        .from('payments')
        .update({ status: 'paid' })
        .eq('transaction_id', txnid)
        .select()
        .single()
        
      if (updateError) throw updateError
      
      if (updatedPayment) {
        // 2. Trigger allocation
        await supabase.rpc('apply_payment_debt_first', {
          p_student_id: updatedPayment.student_id,
          p_payment_id: updatedPayment.id,
          p_amount: parseFloat(amount),
          p_target_month: new Date().toISOString().slice(0, 7)
        })
      }
    } else {
      // Mark as failed
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('transaction_id', txnid)
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
