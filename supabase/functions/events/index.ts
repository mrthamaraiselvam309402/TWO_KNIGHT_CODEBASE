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
  
  const { validateAuth } = await import('./rate_limit.js')
  const auth = await validateAuth(req, supabase)
  if (!auth.allowed) {
    return new Response(JSON.stringify({ error: auth.error }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  }

  function generateId() { return crypto.randomUUID(); }

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
      fee: e.fee || 0,
      registrations_count: e.current_participants || 0,
      registered_students: e.registered_students || [],
      registrations_data: e.registrations_data || [],
      max_participants: e.max_participants,
      status: e.status || 'upcoming',
      created_at: e.created_at,
      updated_at: e.updated_at
    };
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};

    if (req.method === 'GET') {
      const { data: events, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      const { data: regs } = await supabase.from('event_registrations').select('*');
      
      if (error) throw error;
      
      let mergedEvents = events || [];
      if (regs && regs.length > 0) {
         mergedEvents = mergedEvents.map(e => {
            const eRegs = regs.filter(r => r.event_id === e.id);
            if (eRegs.length > 0) {
               e.registrations_data = eRegs.map(r => ({
                  student_id: r.student_id,
                  name: r.student_name,
                  payment_status: r.payment_status,
                  attendance: r.attendance,
                  registered_at: r.registered_at,
                  registration_status: (r as any).status || 'confirmed'
               }));
               e.registered_students = eRegs.map(r => r.student_id);
               // Do not count waitlisted as active participants
               e.current_participants = eRegs.filter(r => (r as any).status !== 'waitlisted').length;
            }
            return e;
         });
      }
      
      if (id) {
        const ev = mergedEvents.find(e => e.id === id);
        return new Response(JSON.stringify(ev ? transformEvent(ev) : null), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      return new Response(JSON.stringify(mergedEvents.map(transformEvent)), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    if (req.method === 'POST') {
      const { action, event_id: eventId, student_id: studentId, student_name: studentName } = body;
      
      if (action === 'register' && eventId && studentId) {
        const { data: events } = await supabase.from('events').select('*').eq('id', eventId);
        let currentEvent = (events && events.length > 0) ? events[0] : null;
        if (!currentEvent) {
          const safeSearch = String(eventId).substring(0, 8);
          const { data: events2 } = await supabase.from('events').select('*').ilike('id', '%' + safeSearch + '%');
          if (!events2 || events2.length === 0) return new Response(JSON.stringify({ error: 'Event not found' }), { status: 400 });
          currentEvent = events2[0];
        }

        const maxParts = parseInt(currentEvent.max_participants) || 50;
        
        // Fetch current active registrations
        const { data: currentRegs } = await supabase.from('event_registrations').select('*').eq('event_id', currentEvent.id);
        const registeredCount = currentRegs ? currentRegs.filter(r => r.status !== 'waitlisted').length : 0;
        
        // Check if already registered
        if (currentRegs && currentRegs.find(r => r.student_id === studentId)) {
          return new Response(JSON.stringify({ error: 'Student already registered' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
        
        // Determine waitlist status
        const isWaitlisted = registeredCount >= maxParts;
        const regStatus = isWaitlisted ? 'waitlisted' : 'confirmed';
        
        // Insert into relational table
        await supabase.from('event_registrations').insert({
          event_id: currentEvent.id,
          student_id: studentId,
          student_name: studentName,
          payment_status: 'pending',
          attendance: 'absent',
          status: regStatus
        }).select().single().catch(()=>null);
        
        // For backwards compatibility, we also update JSONB
        const registeredStudents = currentEvent.registered_students || [];
        const registrationsData = currentEvent.registrations_data || [];
        if (!registeredStudents.includes(studentId)) {
            registeredStudents.push(studentId);
            registrationsData.push({
            student_id: studentId,
            name: studentName,
            registered_at: new Date().toISOString(),
            payment_status: 'pending',
            attendance: 'absent',
            registration_status: regStatus
            });
        }
        
        const { data: updatedEvent, error: updateError } = await supabase.from('events').update({
          registered_students: registeredStudents,
          registrations_data: registrationsData,
          current_participants: registeredCount + (isWaitlisted ? 0 : 1),
          updated_at: new Date().toISOString()
        }).eq('id', currentEvent.id).select().single();
        
        if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

        return new Response(JSON.stringify({ 
          success: true, 
          message: isWaitlisted ? `${studentName} added to waitlist for "${currentEvent.title}"` : `${studentName} registered for "${currentEvent.title}"`,
          event: transformEvent(updatedEvent)
        }), { status: 201, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }

      if (action === 'update_registration' && eventId && studentId) {
        const paymentStatus = body.payment_status;
        const attendance = body.attendance;
        
        // Update relational table
        const updates: any = {};
        if (paymentStatus) updates.payment_status = paymentStatus;
        if (attendance) updates.attendance = attendance;
        
        if (Object.keys(updates).length > 0) {
            await supabase.from('event_registrations').update(updates).match({ event_id: eventId, student_id: studentId });
        }

        // Update JSONB
        const { data: eventToUpdate } = await supabase.from('events').select('*').eq('id', eventId).single();
        if (eventToUpdate) {
           let regsData = eventToUpdate.registrations_data || [];
           regsData = regsData.map((r: any) => {
             if (r.student_id === studentId) {
               if (paymentStatus) r.payment_status = paymentStatus;
               if (attendance) r.attendance = attendance;
             }
             return r;
           });
           await supabase.from('events').update({ registrations_data: regsData, updated_at: new Date().toISOString() }).eq('id', eventId);
        }
        return new Response(JSON.stringify({success:true}), {headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }});
      }

      if (action === 'unregister' && eventId && studentId) {
        // 1. Delete from event_registrations table
        await supabase.from('event_registrations').delete().match({ event_id: eventId, student_id: studentId });

        const { data: currentEvent } = await supabase.from('events').select('*').eq('id', eventId).single();
        if (!currentEvent) return new Response(JSON.stringify({ error: 'Event not found' }), { status: 400 });

        let message = `Student removed.`;
        let promotedStudentName = null;

        // 2. Remove from JSONB arrays
        let registeredStudents = currentEvent.registered_students || [];
        let regsData = currentEvent.registrations_data || [];
        
        registeredStudents = registeredStudents.filter((id: string) => id !== studentId);
        regsData = regsData.filter((r: any) => r.student_id !== studentId);

        // 3. Waitlist Auto-Promotion Logic
        const maxParts = parseInt(currentEvent.max_participants) || 50;
        const confirmedCount = regsData.filter((r: any) => r.registration_status !== 'waitlisted').length;

        if (confirmedCount < maxParts) {
            // Find the oldest waitlisted student in the JSONB (assuming chronological insertion)
            const waitlistedStudent = regsData.find((r: any) => r.registration_status === 'waitlisted');
            
            if (waitlistedStudent) {
                // Promote them in JSONB
                waitlistedStudent.registration_status = 'confirmed';
                
                // Promote them in the relational table
                await supabase.from('event_registrations').update({ status: 'confirmed' })
                  .match({ event_id: eventId, student_id: waitlistedStudent.student_id });

                promotedStudentName = waitlistedStudent.name;
                message = `Removed successfully. Auto-promoted ${promotedStudentName} from waitlist!`;
            }
        }

        // 4. Update the events table
        const newCurrentParticipants = regsData.filter((r: any) => r.registration_status !== 'waitlisted').length;

        const { data: updatedEvent, error: updateError } = await supabase.from('events').update({
          registered_students: registeredStudents,
          registrations_data: regsData,
          current_participants: newCurrentParticipants,
          updated_at: new Date().toISOString()
        }).eq('id', eventId).select().single();

        if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

        return new Response(JSON.stringify({ 
          success: true, 
          message: message,
          promoted_student: promotedStudentName,
          event: transformEvent(updatedEvent)
        }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      
      const { title, date, type, location, id, event_date, event_time, max_participants, description, fee } = body;
      if (!title) return new Response(JSON.stringify({ error: 'Title is required' }), { status: 400 });
      
      let newEvent: Record<string, unknown> = { 
        id: id || generateId(), 
        title, event_date: event_date || date, event_time: event_time || body.time || '10:00', type: type || 'Tournament'
      };
      if (location) newEvent.location = location;
      if (description) newEvent.description = description;
      if (max_participants) newEvent.max_participants = parseInt(max_participants) || 50;
      if (body.prize_pool || body.prize) newEvent.prize = body.prize_pool || body.prize;
      if (fee) newEvent.fee = fee;
      newEvent.status = 'upcoming';
      newEvent.current_participants = 0;
      newEvent.created_at = new Date().toISOString();
      newEvent.updated_at = new Date().toISOString();
      
      const { data: insertedEvent, error: insertError } = await supabase.from('events').insert(newEvent).select().single();
      if (insertError) return new Response(JSON.stringify({ error: insertError.message }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }});
      return new Response(JSON.stringify(insertedEvent ? transformEvent(insertedEvent) : null), { status: 201, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    if (req.method === 'PUT') {
      if (!id) return new Response(JSON.stringify({ error: 'ID is required' }), { status: 400 });
      const { increment_registrations, ...bodyData } = body;
      const updateData: any = { ...bodyData };
      updateData.updated_at = new Date().toISOString();
      const { data: updatedEvent, error: updateError } = await supabase.from('events').update(updateData).eq('id', id).select().single();
      if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }});
      return new Response(JSON.stringify({ message: 'Updated', data: updatedEvent ? transformEvent(updatedEvent) : null }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    if (req.method === 'DELETE') {
      if (!id) return new Response(JSON.stringify({ error: 'ID is required' }), { status: 400 });
      await supabase.from('event_registrations').delete().eq('event_id', id);
      await supabase.from('events').delete().eq('id', id);
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
});
