import { checkRateLimit, validateAuth } from './rate_limit.js'

// ─── Sanitization Helpers ───────────────────────────────────────
function sanitizeString(str: unknown, maxLength = 255): string {
  if (typeof str !== 'string') return ''
  return str.slice(0, maxLength).replace(/[<>"'`;]/g, '').trim()
}

const VALID_CATEGORIES = [
  'Rent', 'Coach Salary', 'Equipment', 'Snacks', 'Travel',
  'Tournament', 'Utilities', 'Marketing', 'Maintenance',
  'Platform & Software', 'Miscellaneous'
]
const VALID_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque']

function validateCategory(cat: unknown): string {
  const s = String(cat || '').trim()
  return VALID_CATEGORIES.includes(s) ? s : 'Miscellaneous'
}
function validateMode(mode: unknown): string {
  const s = String(mode || '').trim()
  return VALID_MODES.includes(s) ? s : 'Cash'
}
function validateDate(d: unknown): string {
  if (!d) return new Date().toISOString().split('T')[0]
  const parsed = new Date(String(d))
  return isNaN(parsed.getTime()) ? new Date().toISOString().split('T')[0] : parsed.toISOString().split('T')[0]
}
function transformExpenditure(e: Record<string, unknown>) {
  return {
    id:           e.id,
    date:         e.date || new Date().toISOString().split('T')[0],
    category:     e.category     || 'Miscellaneous',
    description:  e.description  || '',
    amount:       parseFloat(String(e.amount || 0)),
    payment_mode: e.payment_mode || 'Cash',
    bill_url:     e.bill_url     || null,
    created_at:   e.created_at   || new Date().toISOString(),
    updated_at:   e.updated_at   || new Date().toISOString()
  }
}

// ─── Main Handler ───────────────────────────────────────────────
Deno.serve(async (req) => {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  const supabase   = createClient(supabaseUrl, supabaseKey)
  const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*'
  const corsHeaders = {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rateResult = await checkRateLimit(ip, 'default')
  if (!rateResult.allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Auth
  const auth = await validateAuth(req, supabase)
  if (!auth.allowed) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  try {
    const url    = new URL(req.url)
    const id     = url.searchParams.get('id')
    const method = req.method

    // ── GET — list / summary ─────────────────────────────────────
    if (method === 'GET') {
      const mode     = url.searchParams.get('mode') || 'list'   // 'list' | 'summary'
      const page     = Math.max(1, parseInt(url.searchParams.get('page')  || '1'))
      const limit    = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '50')))
      const offset   = (page - 1) * limit
      const month    = url.searchParams.get('month')   || ''    // YYYY-MM
      const category = url.searchParams.get('category')|| ''
      const search   = url.searchParams.get('search')  || ''

      let query = supabase
        .from('expenditures')
        .select('*', { count: 'exact' })
        .order('date', { ascending: false })

      if (month) {
        const [y, m] = month.split('-')
        const from = `${y}-${m}-01`
        const to   = new Date(Number(y), Number(m), 0).toISOString().split('T')[0]
        query = query.gte('date', from).lte('date', to)
      }
      if (category && VALID_CATEGORIES.includes(category)) {
        query = query.eq('category', category)
      }
      if (search) {
        query = query.ilike('description', `%${search.slice(0, 100)}%`)
      }

      // For summary mode return aggregates, no pagination
      if (mode === 'summary') {
        const { data: rows, error } = await query
        if (error) throw error

        const totalExpense = (rows || []).reduce((s, r) => s + parseFloat(String(r.amount || 0)), 0)
        const byCat: Record<string, number> = {}
        ;(rows || []).forEach(r => {
          const cat = String(r.category || 'Miscellaneous')
          byCat[cat] = (byCat[cat] || 0) + parseFloat(String(r.amount || 0))
        })

        // Fetch income from payments for the same month filter
        let incomeQuery = supabase
          .from('payments')
          .select('amount')
          .eq('status', 'paid')
        if (month) {
          const [y, m] = month.split('-')
          incomeQuery = incomeQuery
            .gte('payment_date', `${y}-${m}-01`)
            .lte('payment_date', new Date(Number(y), Number(m), 0).toISOString().split('T')[0])
        }
        const { data: incRows } = await incomeQuery
        const totalIncome = (incRows || []).reduce((s, r) => s + parseFloat(String(r.amount || 0)), 0)

        return json({
          total_expense: totalExpense,
          total_income:  totalIncome,
          profit_or_loss: totalIncome - totalExpense,
          category_totals: byCat,
          count: (rows || []).length
        })
      }

      // Paginated list
      query = query.range(offset, offset + limit - 1)
      const { data, error, count } = await query
      if (error) throw error

      return json({
        data:       (data || []).map(transformExpenditure),
        pagination: { page, limit, total: count || 0, total_pages: count ? Math.ceil(count / limit) : 1 }
      })
    }

    // ── POST — create ────────────────────────────────────────────
    if (method === 'POST') {
      let body: Record<string, unknown> = {}
      try { body = await req.json() } catch (_e) {}

      const description = sanitizeString(body.description, 500)
      if (!description || description.length < 2) {
        return json({ error: 'Description is required (min 2 characters)' }, 400)
      }
      const amount = parseFloat(String(body.amount || 0))
      if (isNaN(amount) || amount <= 0) {
        return json({ error: 'Amount must be a positive number' }, 400)
      }

      const newRow: Record<string, unknown> = {
        id:           crypto.randomUUID(),
        date:         validateDate(body.date),
        category:     validateCategory(body.category),
        description,
        amount,
        payment_mode: validateMode(body.payment_mode),
        bill_url:     body.bill_url ? sanitizeString(body.bill_url, 2000) : null,
        created_at:   new Date().toISOString(),
        updated_at:   new Date().toISOString()
      }

      const { data, error } = await supabase.from('expenditures').insert(newRow).select().single()
      if (error) throw error

      return json(transformExpenditure(data as Record<string, unknown>), 201)
    }

    // ── PUT — update ─────────────────────────────────────────────
    if (method === 'PUT') {
      if (!id) return json({ error: 'ID is required for update' }, 400)

      let body: Record<string, unknown> = {}
      try { body = await req.json() } catch (_e) {}

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (body.date         !== undefined) updateData.date         = validateDate(body.date)
      if (body.category     !== undefined) updateData.category     = validateCategory(body.category)
      if (body.description  !== undefined) {
        const d = sanitizeString(body.description, 500)
        if (d.length < 2) return json({ error: 'Description must be at least 2 characters' }, 400)
        updateData.description = d
      }
      if (body.amount !== undefined) {
        const a = parseFloat(String(body.amount))
        if (isNaN(a) || a <= 0) return json({ error: 'Amount must be a positive number' }, 400)
        updateData.amount = a
      }
      if (body.payment_mode !== undefined) updateData.payment_mode = validateMode(body.payment_mode)
      if (body.bill_url     !== undefined) updateData.bill_url     = body.bill_url ? sanitizeString(body.bill_url, 2000) : null

      const { data, error } = await supabase.from('expenditures').update(updateData).eq('id', id).select().single()
      if (error) throw error

      return json(transformExpenditure(data as Record<string, unknown>))
    }

    // ── DELETE ───────────────────────────────────────────────────
    if (method === 'DELETE') {
      if (!id) return json({ error: 'ID is required for deletion' }, 400)
      const { error } = await supabase.from('expenditures').delete().eq('id', id)
      if (error) throw error
      return json({ success: true, id })
    }

    return json({ error: 'Method not allowed' }, 405)

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return json({ error: msg }, 500)
  }
})
