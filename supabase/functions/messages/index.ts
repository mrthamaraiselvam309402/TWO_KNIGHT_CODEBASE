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
    if (!studentId) return '';
    const { data } = await supabase.from('students').select('name').eq('id', studentId).single();
    return data?.name || '';
  }

  async function transformMessage(m) {
    const studentName = m.sender_type === 'parent' && m.sender_id ? await getStudentName(m.sender_id) : (m.sender_name || '');
    const adminName = m.sender_type === 'admin' ? 'Admin' : '';
    return {
      id: m.id,
      sender_type: m.sender_type,
      sender_id: m.sender_id,
      sender_name: m.sender_type === 'admin' ? adminName : studentName,
      receiver_type: m.receiver_type,
      subject: m.subject || '',
      message: m.message || '',
      is_read: m.is_read || false,
      priority: m.priority || 'normal',
      created_at: m.created_at,
      reply_to: m.reply_to
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
    const senderType = url.searchParams.get('sender_type');
    const senderId = url.searchParams.get('sender_id');
    const receiverType = url.searchParams.get('receiver_type');
    const isRead = url.searchParams.get('is_read');
    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};

    if (req.method === 'GET') {
      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (id) {
        const { data: msg, error } = await supabase
          .from('messages')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;
        const transformed = await transformMessage(msg);
        return new Response(JSON.stringify(transformed), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      if (senderType) {
        query = query.eq('sender_type', senderType);
      }
      if (senderId) {
        query = query.eq('sender_id', senderId);
      }
      if (receiverType) {
        query = query.eq('receiver_type', receiverType);
      }
      if (isRead !== null) {
        query = query.eq('is_read', isRead === 'true');
      }

      const { data: messages, error } = await query;
      if (error) throw error;
      const transformedList = await Promise.all((messages || []).map(transformMessage));
      return new Response(JSON.stringify(transformedList), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (req.method === 'POST') {
      const newMessage = {
        id: 'm' + Date.now(),
        sender_type: body.sender_type || 'parent',
        sender_id: body.sender_id || null,
        receiver_type: body.receiver_type || 'admin',
        subject: body.subject || '',
        message: body.message || '',
        is_read: false,
        priority: body.priority || 'normal',
        reply_to: body.reply_to || null,
        created_at: new Date().toISOString()
      };

      const { data: inserted, error: insertError } = await supabase
        .from('messages')
        .insert(newMessage)
        .select()
        .single();

      if (insertError) throw insertError;
      const transformed = await transformMessage(inserted);
      return new Response(JSON.stringify(transformed), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (req.method === 'PUT') {
      if (!id) return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });

      const updateData = { ...body };
      if (body.is_read === true) {
        updateData.read_at = new Date().toISOString();
      }

      const { data: updated, error: updateError } = await supabase
        .from('messages')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      const transformed = await transformMessage(updated);
      return new Response(JSON.stringify({ success: true, data: transformed }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (req.method === 'DELETE') {
      if (!id) return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });

      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      return new Response(JSON.stringify({ success: true, message: 'Deleted' }), {
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
