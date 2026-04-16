Deno.serve(async (req) => {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  function transformStudent(s) {
    return {
      id: s.id,
      full_name: s.name || s.full_name || '',
      name: s.name || s.full_name || '',
      email: s.email,
      phone: s.phone,
      parent_phone: s.parent_phone || s.phone || '',
      grade: s.grade,
      level: s.grade || s.level || 'Beginner',
      join_date: s.enrollment_date || s.join_date || '',
      enrollment_date: s.enrollment_date || s.join_date || '',
      current_rating: s.rating || s.current_rating || 800,
      rating: s.rating || s.current_rating || 800,
      payment_status: s.payment_status || (s.status === 'active' ? 'Paid' : 'Due'),
      status: s.status,
      monthly_fee: s.monthly_fee || 5000,
      batch_type: s.batch_type || 'Evening',
      batch_time: s.batch_time || '17:00',
      coaches: s.coach_id ? { id: s.coach_id, full_name: s.coach_name || '' } : null,
      coach_id: s.coach_id,
      custom_avatar: s.custom_avatar,
      tactics_score: s.tactics_score || 50,
      endgame_score: s.endgame_score || 50,
      openings_score: s.openings_score || 50,
      positional_score: s.positional_score || 50,
      coach_notes: s.coach_notes || '',
      created_at: s.created_at,
      updated_at: s.updated_at
    };
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};

    if (req.method === 'GET') {
      if (id) {
        const { data: student, error } = await supabase
          .from('students')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) throw error;
        return new Response(JSON.stringify(student ? transformStudent(student) : null), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      const { data: students, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return new Response(JSON.stringify((students || []).map(transformStudent)), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

if (req.method === 'POST') {
      console.log('POST /students body:', JSON.stringify(body));
      
      const newStudent: Record<string, unknown> = { 
        id: 's' + Date.now(), 
        name: body.name || body.full_name || '',
        full_name: body.full_name || body.name || '',
        phone: body.phone || body.parent_phone || '',
        parent_phone: body.parent_phone || body.phone || '',
        grade: body.grade || body.level || null,
        level: body.level || body.grade || 'Beginner',
        enrollment_date: body.enrollment_date || body.join_date || new Date().toISOString().split('T')[0],
        join_date: body.join_date || body.enrollment_date || new Date().toISOString().split('T')[0],
        rating: body.rating || 800,
        current_rating: body.current_rating || body.rating || 800,
        monthly_fee: body.monthly_fee || 0,
        batch_type: body.batch_type || 'Evening',
        batch_time: body.batch_time || '17:00',
        payment_status: body.payment_status || 'Due',
        status: body.status || 'pending',
        coach_id: body.coach_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('POST newStudent:', JSON.stringify(newStudent));
      
      const { data: insertedStudent, error: insertError } = await supabase
        .from('students')
        .insert(newStudent)
        .select()
        .single();
      
      if (insertError) {
        console.error('Insert error:', JSON.stringify(insertError));
        return new Response(JSON.stringify({ error: insertError.message, code: insertError.code, details: insertError }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      return new Response(JSON.stringify(insertedStudent ? transformStudent(insertedStudent) : null), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (req.method === 'PUT') {
      if (!id) return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('PUT /students body:', JSON.stringify(body));
      console.log('PUT /students id:', id);
      
      const updateData: Record<string, unknown> = {};
      
      if (body.name !== undefined) updateData.name = body.name;
      if (body.full_name !== undefined) updateData.full_name = body.full_name;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.parent_phone !== undefined) updateData.parent_phone = body.parent_phone;
      if (body.grade !== undefined) updateData.grade = body.grade;
      if (body.level !== undefined) updateData.level = body.level;
      if (body.join_date !== undefined) updateData.join_date = body.join_date;
      if (body.enrollment_date !== undefined) updateData.enrollment_date = body.enrollment_date;
      if (body.rating !== undefined && body.rating !== null && body.rating !== '') {
        const ratingNum = Number(body.rating);
        if (!isNaN(ratingNum) && isFinite(ratingNum)) {
          updateData.rating = Math.floor(ratingNum);
        }
      }
      if (body.current_rating !== undefined && body.current_rating !== null) {
        const ratingNum = Number(body.current_rating);
        if (!isNaN(ratingNum) && isFinite(ratingNum)) {
          updateData.current_rating = Math.floor(ratingNum);
        }
      }
      if (body.monthly_fee !== undefined && body.monthly_fee !== null && body.monthly_fee !== '') {
        const feeNum = Number(body.monthly_fee);
        if (!isNaN(feeNum) && isFinite(feeNum)) {
          updateData.monthly_fee = Math.floor(feeNum);
        }
      }
      if (body.batch_type !== undefined) updateData.batch_type = body.batch_type;
      if (body.batch_time !== undefined) updateData.batch_time = body.batch_time;
      if (body.payment_status !== undefined) updateData.payment_status = body.payment_status;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.coach_id !== undefined) updateData.coach_id = body.coach_id || null;
      if (body.custom_avatar !== undefined) updateData.custom_avatar = body.custom_avatar;
      if (body.coach_notes !== undefined) updateData.coach_notes = body.coach_notes;
      if (body.tactics_score !== undefined) updateData.tactics_score = body.tactics_score;
      if (body.endgame_score !== undefined) updateData.endgame_score = body.endgame_score;
      if (body.openings_score !== undefined) updateData.openings_score = body.openings_score;
      if (body.positional_score !== undefined) updateData.positional_score = body.positional_score;
      
      updateData.updated_at = new Date().toISOString();
      
      console.log('PUT updateData:', JSON.stringify(updateData));
      
      const { data: updatedStudent, error: updateError } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (updateError) {
        console.error('Update error:', JSON.stringify(updateError));
        return new Response(JSON.stringify({ 
          error: updateError.message, 
          code: updateError.code, 
          details: updateError,
          hint: 'Check that all field types match database schema'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      return new Response(JSON.stringify({ message: 'Updated', data: updatedStudent ? transformStudent(updatedStudent) : null }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (req.method === 'DELETE') {
      if (!id) return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('Deleting student with id:', id);
      
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', id);
      
      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }
      
      console.log('Delete successful for id:', id);
      
      return new Response(JSON.stringify({ success: true, message: 'Deleted', id }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});
