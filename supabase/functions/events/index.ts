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

  function transformEvent(e) {
    return {
      id: e.id,
      title: e.title || '',
      date: e.event_date || e.date || '',
      event_date: e.event_date || e.date || '',
      event_time: e.event_time || '',
      type: e.type || 'Tournament',
      location: e.location || '',
      prize: e.prize || '',
      registrations_count: e.current_participants || 0,
      max_participants: e.max_participants,
      status: e.status || 'upcoming',
      created_at: e.created_at,
      updated_at: e.updated_at
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
    console.log(`${req.method} ${url.pathname}`);
    const id = url.searchParams.get('id');
    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};

    if (req.method === 'GET') {
      if (id) {
        const { data: event, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) throw error;
        return new Response(JSON.stringify(event ? transformEvent(event) : null), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return new Response(JSON.stringify((events || []).map(transformEvent)), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (req.method === 'POST') {
      const { title, date, type, location, increment_registrations, ...rest } = body;
      
      let newEvent = { 
        id: 'e' + Date.now(), 
        title: title || '',
        event_date: date || body.event_date || '',
        event_time: body.event_time || '',
        type: type || body.event_type || 'Tournament',
        location: location || '',
        description: body.description || '',
        status: 'upcoming',
        max_participants: body.max_participants || null,
        current_participants: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data: insertedEvent, error: insertError } = await supabase
        .from('events')
        .insert(newEvent)
        .select()
        .single();
      
      if (insertError) throw insertError;
      return new Response(JSON.stringify(insertedEvent ? transformEvent(insertedEvent) : null), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (req.method === 'PUT') {
      if (!id) return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
      
      const { increment_registrations, ...updateData } = body;
      
      if (body.increment_registrations) {
        const { data: current } = await supabase
          .from('events')
          .select('current_participants')
          .eq('id', id)
          .single();
        
        if (current) {
          updateData.current_participants = (current.current_participants || 0) + 1;
        }
      }
      
      updateData.updated_at = new Date().toISOString();
      
      console.log('PUT /events updateData:', JSON.stringify(updateData));
      
      const { data: updatedEvent, error: updateError } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (updateError) {
        console.error('Update error:', JSON.stringify(updateError));
        return new Response(JSON.stringify({ error: updateError.message, details: updateError }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      return new Response(JSON.stringify({ message: 'Updated', data: updatedEvent ? transformEvent(updatedEvent) : null }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (req.method === 'DELETE') {
      if (!id) return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('DELETE /events id:', id);
      
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', id);
      
      if (deleteError) {
        console.error('Delete event error:', JSON.stringify(deleteError));
        return new Response(JSON.stringify({ error: deleteError.message, details: deleteError }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
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
