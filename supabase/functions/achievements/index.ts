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

  async function getStudentName(studentId) {
    if (!studentId) return null;
    try {
      const { data, error } = await supabase.from('students').select('full_name, name').eq('id', studentId).maybeSingle();
      if (error) return null;
      return data?.full_name || data?.name || null;
    } catch (e) {
      return null;
    }
  }

  async function transformAchievement(a) {
    const studentName = a.student_id ? await getStudentName(a.student_id) : null;
    return {
      id: a.id,
      student_id: a.student_id,
      title: a.title || '',
      description: a.description,
      date_achieved: a.date_achieved || a.created_at || '',
      category: a.category,
      level: a.level,
      img_url: a.img_url || '',
      students: a.student_id ? { id: a.student_id, full_name: studentName || '' } : null,
      created_at: a.created_at
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
        const { data: achievement, error } = await supabase
          .from('achievements')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) throw error;
        const transformed = await transformAchievement(achievement);
        return new Response(JSON.stringify(transformed), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      const { data: achievements, error } = await supabase
        .from('achievements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      const transformedList = await Promise.all((achievements || []).map(transformAchievement));
      return new Response(JSON.stringify(transformedList), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (req.method === 'POST') {
      console.log('POST /achievements body:', JSON.stringify(body));
      
      let studentId = body.student_id;
      if (!studentId && body.students?.full_name) {
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .ilike('name', '%' + body.students.full_name + '%')
          .single();
        studentId = student?.id || null;
      }
      
      const newAchievement = { 
        id: 'a' + Date.now(), 
        student_id: studentId,
        title: body.title || '',
        description: body.description || '',
        date_achieved: body.date_achieved || new Date().toISOString().split('T')[0],
        category: body.category || '',
        level: body.level || '',
        img_url: body.img_url || '',
        created_at: new Date().toISOString()
      };
      
      console.log('POST newAchievement:', JSON.stringify(newAchievement));
      
      const { data: insertedAchievement, error: insertError } = await supabase
        .from('achievements')
        .insert(newAchievement)
        .select()
        .single();
      
      if (insertError) {
        console.error('Insert error:', JSON.stringify(insertError));
        return new Response(JSON.stringify({ error: insertError.message, details: insertError }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      const transformed = await transformAchievement(insertedAchievement);
      return new Response(JSON.stringify(transformed), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (req.method === 'DELETE') {
      if (!id) return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
      
      const { error: deleteError } = await supabase
        .from('achievements')
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;
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
