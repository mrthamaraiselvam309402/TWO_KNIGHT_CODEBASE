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

  function generateId() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function transformEvent(e) {
    return {
      id: e.id,
      title: e.title || '',
      date: e.event_date || e.date || '',
      event_date: e.event_date || e.date || '',
      event_time: e.event_time || '',
      type: e.type || 'Tournament',
      location: e.location || '',
      prize: e.prize || e.prize_pool || '',
      prize_pool: e.prize || e.prize_pool || '',
      registrations_count: e.current_participants || 0,
      registered_students: e.registered_students || [],
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
      // DEBUG: Log the body received
      console.log('POST body:', JSON.stringify(body));
      
      // Handle event registration FIRST - return early so we don't fall through to event creation
      if (body.action === 'register' && body.event_id && body.student_id) {
        const eventId = body.event_id;
        const studentId = body.student_id;
        const studentName = body.student_name || '';
        
        // Get current event data
        const { data: currentEvent } = await supabase
          .from('events')
          .select('registered_students, current_participants, title')
          .eq('id', eventId)
          .single();
        
        if (!currentEvent) {
          return new Response(JSON.stringify({ error: 'Event not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        
        const registeredStudents = currentEvent.registered_students || [];
        
        // Check if already registered
        if (registeredStudents.includes(studentId)) {
          return new Response(JSON.stringify({ error: 'Student already registered for this event', event: transformEvent(currentEvent) }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        
        // Add student to registered list
        registeredStudents.push(studentId);
        
        // Update event with new registration
        const updateData = {
          registered_students: registeredStudents,
          current_participants: registeredStudents.length,
          updated_at: new Date().toISOString()
        };
        
        const { data: updatedEvent, error: updateError } = await supabase
          .from('events')
          .update(updateData)
          .eq('id', eventId)
          .select()
          .single();
        
        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: `${studentName} registered for "${currentEvent.title}"`,
          event: transformEvent(updatedEvent)
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      
      // If not a registration, continue with event creation logic below
      // (moved title check down to ensure registration handler runs first)
      
      const { title, date, type, location, increment_registrations, id, event_date, event_time, event_type, prize_pool, max_participants, description } = body;
      
      console.log('Creating event with body:', JSON.stringify(body));
      
      if (!title) {
        return new Response(JSON.stringify({ error: 'Title is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      
      if (!event_date && !date) {
        return new Response(JSON.stringify({ error: 'Date is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      
      const eventId = id || generateId();
      const eventDate = event_date || date;
      const eventTime = event_time || body.time || '10:00';
      const eventType = event_type || type || 'Tournament';
      const maxParticipants = parseInt(max_participants) || 50;
      const eventPrize = prize_pool || body.prize || '';
      const eventDesc = description || '';
      
      let newEvent: Record<string, unknown> = { 
        id: eventId, 
        title: title,
        event_date: eventDate,
        event_time: eventTime,
        type: eventType
      };
      
      if (location) newEvent.location = location;
      if (eventDesc) newEvent.description = eventDesc;
      if (maxParticipants) newEvent.max_participants = maxParticipants;
      if (eventPrize) newEvent.prize = eventPrize;
      newEvent.status = 'upcoming';
      newEvent.current_participants = 0;
      newEvent.created_at = new Date().toISOString();
      newEvent.updated_at = new Date().toISOString();
      
      console.log('Inserting event:', JSON.stringify(newEvent));
      
      const { data: insertedEvent, error: insertError } = await supabase
        .from('events')
        .insert(newEvent)
        .select()
        .single();
      
      if (insertError) {
        console.error('Event insert error:', JSON.stringify(insertError));
        return new Response(JSON.stringify({ error: insertError.message, details: insertError }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
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
      
      const { increment_registrations, ...bodyData } = body;
      const updateData: any = { ...bodyData };
      
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

      // Sync redundant columns in PUT
      if (updateData.date !== undefined || updateData.event_date !== undefined) {
          updateData.event_date = updateData.event_date || updateData.date;
          delete updateData.date;
      }
      if (updateData.type !== undefined || updateData.event_type !== undefined) {
          updateData.type = updateData.event_type || updateData.type;
          delete updateData.event_type;
      }
      if (updateData.prize !== undefined || updateData.prize_pool !== undefined) {
          delete updateData.prize;
          delete updateData.prize_pool;
      }
      if (updateData.time !== undefined || updateData.event_time !== undefined) {
          updateData.event_time = updateData.event_time || updateData.time;
          delete updateData.time;
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
    console.error('Events error:', error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});
