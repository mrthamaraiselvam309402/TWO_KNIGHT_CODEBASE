import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateAuth } from './rate_limit.js';

import { validateAuth } from './rate_limit.js';

import { validateAuth } from './rate_limit.js';

import { validateAuth } from './rate_limit.js';

Deno.serve(async (req) => {
  

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // --- Authentication ---
  
  const auth = await validateAuth(req, supabase)
  if (!auth.allowed) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // FIX: previous transformMessage ran a per-row query for student names = N+1.
  // batchGetStudentNames does one IN query for all parent sender_ids.
  async function batchGetStudentNames(ids) {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return new Map();
    const { data } = await supabase.from('students').select('id, name').in('id', unique);
    const map = new Map();
    (data || []).forEach(s => map.set(String(s.id), s.name));
    return map;
  }

  function transformMessageWithNames(m, nameMap) {
    const studentName =
      m.sender_type === 'parent' && m.sender_id
        ? (nameMap.get(String(m.sender_id)) || m.sender_name || '')
        : (m.sender_name || '');
    const adminName = m.sender_type === 'admin' ? 'Admin' : '';
    return {
      id: m.id,
      sender_type: m.sender_type,
      sender_id: m.sender_id,
      sender_name: m.sender_type === 'admin' ? adminName : studentName,
      receiver_type: m.receiver_type,
      receiver_id: m.receiver_id || null,
      subject: m.subject || '',
      message: m.message || '',
      is_read: m.is_read || false,
      read_at: m.read_at || null,
      priority: m.priority || 'normal',
      created_at: m.created_at,
      reply_to: m.reply_to
    };
  }

  async function transformMessage(m) {
    const nameMap = await batchGetStudentNames([m.sender_id]);
    return transformMessageWithNames(m, nameMap);
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
      // FIX: single batched lookup for all student names (was N+1)
      const senderIds = (messages || [])
        .filter(m => m.sender_type === 'parent' && m.sender_id)
        .map(m => m.sender_id);
      const nameMap = await batchGetStudentNames(senderIds);
      const transformedList = (messages || []).map(m => transformMessageWithNames(m, nameMap));
      return new Response(JSON.stringify(transformedList), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      // FIX: validate required field, persist sender_name and receiver_id so the UI
      // and downstream queries have everything they need without re-joining students.
      if (!body.message || typeof body.message !== 'string' || !body.message.trim()) {
        return new Response(JSON.stringify({ error: 'message is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const newMessage = {
        id: crypto.randomUUID(),
        sender_type: body.sender_type || 'parent',
        sender_id: body.sender_id || null,
        sender_name: body.sender_name || null,
        receiver_type: body.receiver_type || 'admin',
        receiver_id: body.receiver_id || null,
        subject: body.subject || '',
        message: String(body.message).trim(),
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'PUT') {
      if (!id) return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'DELETE') {
      if (!id) return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      return new Response(JSON.stringify({ success: true, message: 'Deleted' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // FIX: error is `unknown` — narrow before accessing .message so this doesn't itself crash
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});