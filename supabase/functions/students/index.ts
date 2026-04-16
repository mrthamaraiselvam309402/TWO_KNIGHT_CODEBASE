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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // --- Input Validation Helpers ---
  function sanitizeString(str: unknown, maxLength = 255): string {
    if (typeof str !== 'string') return ''
    return str.slice(0, maxLength).replace(/[<>"'`;]/g, '').trim()
  }

  function validateEmail(email: unknown): string | null {
    if (!email || typeof email !== 'string') return null
    const cleaned = email.toLowerCase().trim().slice(0, 254)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(cleaned) ? cleaned : null
  }

  function validatePhone(phone: unknown): string {
    if (!phone || typeof phone !== 'string') return ''
    const digits = phone.replace(/\D/g, '').slice(0, 15)
    return digits.length >= 10 ? digits : ''
  }

  function validateRating(rating: unknown): number {
    const num = parseInt(String(rating))
    if (isNaN(num) || num < 0 || num > 3500) return 800
    return num
  }

  function validateStatus(status: unknown): string {
    const valid = ['active', 'pending', 'inactive']
    return valid.includes(String(status)) ? String(status) : 'pending'
  }

  function stripUnknownFields(body: Record<string, unknown>, allowed: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) result[key] = body[key]
    }
    return result
  }

  const ALLOWED_STUDENT_FIELDS = [
    'name', 'full_name', 'phone', 'parent_phone', 'email',
    'grade', 'level', 'enrollment_date', 'join_date',
    'rating', 'current_rating', 'payment_status', 'status',
    'coach_id', 'notes', 'age', 'parent_name', 'address'
  ]

  function transformStudent(s: Record<string, unknown>) {
    return {
      id: s.id,
      full_name: s.full_name || s.name || '',
      name: s.name || s.full_name || '',
      phone: s.phone || '',
      parent_phone: s.parent_phone || s.phone || '',
      grade: s.grade || null,
      level: s.level || s.grade || 'Beginner',
      join_date: s.join_date || s.enrollment_date || '',
      enrollment_date: s.enrollment_date || s.join_date || '',
      rating: s.rating || s.current_rating || 800,
      current_rating: s.current_rating || s.rating || 800,
      payment_status: s.payment_status || 'Due',
      status: s.status || 'pending',
      coach_id: s.coach_id || null,
      notes: s.notes || '',
      created_at: s.created_at,
      updated_at: s.updated_at
    }
  }

  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const method = req.method

    // GET - List all students
    if (method === 'GET') {
      const { data: students, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify((students || []).map(transformStudent)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST - Create new student
    if (method === 'POST') {
      let rawBody: Record<string, unknown> = {}
      try { rawBody = await req.json() } catch (_e) {}
      
      // Strip unknown fields
      const body = stripUnknownFields(rawBody, ALLOWED_STUDENT_FIELDS)
      
      // Validate required field
      const name = sanitizeString(body.name || body.full_name, 100)
      if (!name || name.length < 2) {
        return new Response(JSON.stringify({ error: 'Name is required (2-100 characters)' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const newStudent: Record<string, unknown> = {
        id: 's' + Date.now() + Math.random().toString(36).slice(2, 8),
        name: name,
        full_name: sanitizeString(body.full_name || body.name, 100),
        phone: validatePhone(body.phone || body.parent_phone),
        parent_phone: validatePhone(body.parent_phone || body.phone),
        email: validateEmail(body.email),
        grade: sanitizeString(body.grade, 50),
        level: sanitizeString(body.level || body.grade, 50) || 'Beginner',
        enrollment_date: sanitizeString(body.enrollment_date || body.join_date, 10),
        join_date: sanitizeString(body.join_date || body.enrollment_date, 10),
        rating: validateRating(body.rating),
        current_rating: validateRating(body.current_rating || body.rating),
        payment_status: sanitizeString(body.payment_status, 20) || 'Due',
        status: validateStatus(body.status),
        coach_id: body.coach_id ? sanitizeString(body.coach_id, 50) : null,
        notes: sanitizeString(body.notes, 2000),
        parent_name: sanitizeString(body.parent_name, 100),
        address: sanitizeString(body.address, 500),
        created_at: new Date().toISOString()
      }
      
      const { data: insertedStudent, error: insertError } = await supabase
        .from('students')
        .insert(newStudent)
        .select()
        .single()
      
      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify(insertedStudent ? transformStudent(insertedStudent) : { success: true }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // PUT - Update student
    if (method === 'PUT') {
      if (!id) {
        return new Response(JSON.stringify({ error: 'ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      let rawBody: Record<string, unknown> = {}
      try { rawBody = await req.json() } catch (_e) {}
      
      // Strip unknown fields and validate
      const body = stripUnknownFields(rawBody, ALLOWED_STUDENT_FIELDS)
      const updateData: Record<string, unknown> = {}
      
      if (body.name !== undefined) updateData.name = sanitizeString(body.name, 100)
      if (body.full_name !== undefined) updateData.full_name = sanitizeString(body.full_name, 100)
      if (body.phone !== undefined) updateData.phone = validatePhone(body.phone)
      if (body.parent_phone !== undefined) updateData.parent_phone = validatePhone(body.parent_phone)
      if (body.email !== undefined) updateData.email = validateEmail(body.email)
      if (body.grade !== undefined) updateData.grade = sanitizeString(body.grade, 50)
      if (body.level !== undefined) updateData.level = sanitizeString(body.level, 50)
      if (body.payment_status !== undefined) updateData.payment_status = sanitizeString(body.payment_status, 20)
      if (body.status !== undefined) updateData.status = validateStatus(body.status)
      if (body.rating !== undefined) updateData.rating = validateRating(body.rating)
      if (body.current_rating !== undefined) updateData.current_rating = validateRating(body.current_rating)
      if (body.coach_id !== undefined) updateData.coach_id = body.coach_id ? sanitizeString(body.coach_id, 50) : null
      if (body.notes !== undefined) updateData.notes = sanitizeString(body.notes, 2000)
      if (body.join_date !== undefined) updateData.join_date = sanitizeString(body.join_date, 10)
      
      updateData.updated_at = new Date().toISOString()
      
      const { data: updatedStudent, error: updateError } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify(updatedStudent ? transformStudent(updatedStudent) : { success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // DELETE - Delete student
    if (method === 'DELETE') {
      if (!id) {
        return new Response(JSON.stringify({ error: 'ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Validate ID format
      const sanitizedId = sanitizeString(id, 50)
      
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', sanitizedId)
      
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ success: true, id: sanitizedId }), {
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
