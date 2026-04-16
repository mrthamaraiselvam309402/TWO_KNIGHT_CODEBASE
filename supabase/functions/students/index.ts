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

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  function transformStudent(s) {
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
      let body = {}
      try { body = await req.json() } catch (e) {}
      
      const newStudent: Record<string, unknown> = {
        id: 's' + Date.now(),
        name: body.name || body.full_name || '',
        full_name: body.full_name || body.name || '',
        created_at: new Date().toISOString()
      }
      
      if (body.phone) newStudent.phone = body.phone
      if (body.parent_phone) newStudent.parent_phone = body.parent_phone
      if (body.grade) newStudent.grade = body.grade
      if (body.level) newStudent.level = body.level
      if (body.enrollment_date) newStudent.enrollment_date = body.enrollment_date
      if (body.join_date) newStudent.join_date = body.join_date
      if (body.rating) newStudent.rating = body.rating
      if (body.current_rating) newStudent.current_rating = body.current_rating
      if (body.payment_status) newStudent.payment_status = body.payment_status
      if (body.status) newStudent.status = body.status
      
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
      
      let body = {}
      try { body = await req.json() } catch (e) {}
      
      const updateData: Record<string, unknown> = {}
      
      if (body.name !== undefined) updateData.name = body.name
      if (body.full_name !== undefined) updateData.full_name = body.full_name
      if (body.phone !== undefined) updateData.phone = body.phone
      if (body.parent_phone !== undefined) updateData.parent_phone = body.parent_phone
      if (body.grade !== undefined) updateData.grade = body.grade
      if (body.level !== undefined) updateData.level = body.level
      if (body.payment_status !== undefined) updateData.payment_status = body.payment_status
      if (body.status !== undefined) updateData.status = body.status
      if (body.rating !== undefined) updateData.rating = body.rating
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
      
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', id)
      
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ success: true, id }), {
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
