import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { validateAuth } from './rate_limit.js';

Deno.serve(async (req) => {
  
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  
  const auth = await validateAuth(req, supabase)
  if (!auth.allowed) {
    return new Response(JSON.stringify({ error: auth.error }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  }

  function generateId() { return crypto.randomUUID(); }

  function transformEvent(e) {
    if (!e) return null;
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
      img_url: e.img_url || e.qr_poster_url || '',
      qr_poster_url: e.qr_poster_url || e.img_url || '',
      map_url: e.map_url || '',
      registration_url: e.registration_url || '',
      created_at: e.created_at,
      updated_at: e.updated_at
    };
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
               e.registrations_data = eRegs.map(r => {
                  const existingJson = (e.registrations_data || []).find((old: any) => old.student_id === r.student_id) || {};
                  return {
                     student_id: r.student_id,
                     name: r.student_name,
                     payment_status: r.payment_status,
                     attendance: r.attendance,
                     registered_at: r.registered_at,
                     registration_status: (r as any).status || 'confirmed',
                     custom_fee: (r as any).custom_fee !== undefined ? (r as any).custom_fee : existingJson.custom_fee
                  };
               });
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

        const { data: studentExists } = await supabase
          .from('students')
          .select('id')
          .eq('id', String(studentId))
          .single();
        if (!studentExists) return new Response(JSON.stringify({ error: 'Invalid student selected' }), { status: 400 });

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
        try {
          await supabase.from('event_registrations').insert({
            event_id: currentEvent.id,
            student_id: studentId,
            student_name: studentName,
            payment_status: 'pending',
            attendance: 'absent',
            status: regStatus
          }).select().single();
        } catch (e) {
          console.error("Error inserting registration record:", e);
        }
        
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
        const customFee = body.custom_fee;
        
        // Update relational table
        const updates: any = {};
        if (paymentStatus !== undefined) updates.payment_status = paymentStatus;
        if (attendance !== undefined) updates.attendance = attendance;
        if (customFee !== undefined) updates.custom_fee = customFee; // Assuming column exists; if not, we rely on JSONB
        
        if (Object.keys(updates).length > 0) {
            // We ignore errors here in case custom_fee doesn't exist on the relational table yet
            await supabase.from('event_registrations').update(updates).match({ event_id: eventId, student_id: studentId }).then(res => {
                if (res.error) console.warn("Relational update warning:", res.error);
            });
        }

        // Update JSONB
        const { data: eventToUpdate } = await supabase.from('events').select('*').eq('id', eventId).single();
        if (eventToUpdate) {
           let regsData = eventToUpdate.registrations_data || [];
           regsData = regsData.map((r: any) => {
             if (r.student_id === studentId) {
               if (paymentStatus !== undefined) r.payment_status = paymentStatus;
               if (attendance !== undefined) r.attendance = attendance;
               if (customFee !== undefined) r.custom_fee = customFee;
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
        let regsData = [...(currentEvent.registrations_data || [])];
        
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
      
      if (body.student_id && body.action !== 'submit') {
        const { data: studentExists } = await supabase
          .from('students')
          .select('id')
          .eq('id', String(body.student_id))
          .single();
        if (!studentExists) return new Response(JSON.stringify({ error: 'Invalid student selected' }), { status: 400 });
      }
      
      const { title, date, type, location, id, event_date, event_time, max_participants, description, fee, map_url, img_url, prize_pool, registration_url } = body;
      if (!title) return new Response(JSON.stringify({ error: 'Title is required' }), { status: 400 });
      
      let newEvent: Record<string, unknown> = { 
        id: id || generateId(), 
        title, event_date: event_date || date, event_time: event_time || body.time || '10:00', type: type || 'Tournament'
      };
      if (location) newEvent.location = location;
      if (description) newEvent.description = description;
      if (max_participants) newEvent.max_participants = parseInt(max_participants) || 50;
      if (prize_pool || body.prize) {
        newEvent.prize = prize_pool || body.prize;
        newEvent.prize_pool = prize_pool || body.prize;
      }
      if (fee) newEvent.fee = fee;
      if (map_url) newEvent.map_url = map_url;
      if (registration_url) newEvent.registration_url = registration_url;
      if (img_url) {
        newEvent.img_url = img_url;
        newEvent.qr_poster_url = img_url;
      }
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
      
      const allowedColumns = [
        'title', 'description', 'event_date', 'event_time', 'location', 
        'type', 'status', 'max_participants', 'current_participants', 
        'qr_poster_url', 'fee', 'prize', 'prize_pool', 'map_url', 'img_url', 'registration_url'
      ];
      
      const updateData: any = {};
      for (const col of allowedColumns) {
        if (body[col] !== undefined) {
          updateData[col] = body[col];
        }
      }
      
      if (body.date !== undefined && body.event_date === undefined) {
        updateData.event_date = body.date;
      }
      if (body.time !== undefined && body.event_time === undefined) {
        updateData.event_time = body.time;
      }
      if (body.prize_pool !== undefined && body.prize === undefined) {
        updateData.prize = body.prize_pool;
        updateData.prize_pool = body.prize_pool;
      }
      if (body.img_url !== undefined && body.qr_poster_url === undefined) {
        updateData.qr_poster_url = body.img_url;
      }
      
      updateData.updated_at = new Date().toISOString();
      
      const { data: updatedEvent, error: updateError } = await supabase.from('events').update(updateData).eq('id', id).select().single();
      if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }});
      return new Response(JSON.stringify({ message: 'Updated', data: updatedEvent ? transformEvent(updatedEvent) : null }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    if (req.method === 'DELETE') {
      if (!id) return new Response(JSON.stringify({ error: 'ID is required' }), { status: 400 });
      
      try {
        // Fetch the event first to get its title
        const { data: eventData } = await supabase.from('events').select('title').eq('id', id).single();
        
        // Delete associated expenditures if event title is found
        if (eventData && eventData.title) {
          // Description format is: "Event Title - Expense Description"
          await supabase.from('expenditures').delete().ilike('description', `${eventData.title} - %`);
        }
      } catch (e) {
        console.warn("Failed to delete event expenditures:", e);
      }

      await supabase.from('event_registrations').delete().eq('event_id', id);
      await supabase.from('events').delete().eq('id', id);
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
});