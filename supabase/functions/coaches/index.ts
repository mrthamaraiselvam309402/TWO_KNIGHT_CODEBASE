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
  
  // --- Authentication ---
  
  const auth = await validateAuth(req, supabase)
  if (!auth.allowed) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }

  function generateId() {
    return crypto.randomUUID();
  }

  function transformCoach(c: any) {
    return {
      id: c.id,
      full_name: c.name || c.full_name || '',
      name: c.name || c.full_name || '',
      email: c.email,
      phone: c.phone,
      specialty: c.specialization || c.specialty || '',
      specialization: c.specialization || c.specialty || '',
      experience: c.experience,
      rating: c.rating,
      bio: c.bio,
      status: c.status,
      salary: c.hourly_rate || c.salary || 0,
      hourly_rate: c.hourly_rate || c.salary || 0,
      availability: c.availability,
      photo_url: c.photo_url || '',
      address: c.address || '',
      payment_status: c.payment_status || 'Pending',
      created_at: c.created_at,
      updated_at: c.updated_at
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
        const { data: coach, error } = await supabase
          .from('coaches')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) throw error;
        return new Response(JSON.stringify(coach ? transformCoach(coach) : null), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      const { data: coaches, error } = await supabase
        .from('coaches')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return new Response(JSON.stringify((coaches || []).map(transformCoach)), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (req.method === 'POST') {
      console.log('POST /coaches body:', JSON.stringify(body));
      
      const newCoach: Record<string, unknown> = {
        id: generateId(), 
        name: body.name || '',
        email: body.email || null,
        phone: body.phone || '',
        specialization: body.specialization || body.specialty || '',
        experience: body.experience || null,
        rating: body.rating || 0,
        bio: body.bio || '',
        status: body.status || 'active',
        hourly_rate: body.hourly_rate || body.salary || 0,
        availability: body.availability || '',
        address: body.address || '',
        photo_url: body.photo_url || '',
        role: 'coach',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('POST newCoach:', JSON.stringify(newCoach));
      
      const { data: insertedCoach, error: insertError } = await supabase
        .from('coaches')
        .insert(newCoach)
        .select()
        .single();
      
      if (insertError) {
        console.error('Insert error:', JSON.stringify(insertError));
        return new Response(JSON.stringify({ error: insertError.message, details: insertError }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      return new Response(JSON.stringify(insertedCoach ? transformCoach(insertedCoach) : null), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (req.method === 'PUT') {
      if (!id) return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('PUT /coaches body:', JSON.stringify(body));
      
      const updateData: Record<string, unknown> = {};
      
      if (body.name !== undefined) {
        updateData.name = body.name;
      }
      if (body.email !== undefined) updateData.email = body.email;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.specialty !== undefined || body.specialization !== undefined) {
        updateData.specialization = body.specialty || body.specialization;
      }
      if (body.experience !== undefined) updateData.experience = body.experience;
      if (body.rating !== undefined) updateData.rating = body.rating;
      if (body.bio !== undefined) updateData.bio = body.bio;
      if (body.status !== undefined) {
        updateData.status = body.status;
        updateData.account_status = body.status;
      }
      if (body.salary !== undefined || body.hourly_rate !== undefined) {
        updateData.hourly_rate = body.salary || body.hourly_rate;
      }
      if (body.availability !== undefined) updateData.availability = body.availability;
      if (body.address !== undefined) updateData.address = body.address;
      if (body.photo_url !== undefined) updateData.photo_url = body.photo_url;
      
      updateData.updated_at = new Date().toISOString();
      
      console.log('PUT updateData:', JSON.stringify(updateData));
      
      const { data: updatedCoach, error: updateError } = await supabase
        .from('coaches')
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
      return new Response(JSON.stringify({ message: 'Updated', data: updatedCoach ? transformCoach(updatedCoach) : null }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (req.method === 'DELETE') {
      if (!id) return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
      
      const { error: deleteError } = await supabase
        .from('coaches')
        .delete()
        .eq('id', id);
      
      if (deleteError) {
        console.error('Delete error:', JSON.stringify(deleteError));
        return new Response(JSON.stringify({ error: deleteError.message }), {
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
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});