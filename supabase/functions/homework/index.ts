import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)

    if (req.method === 'GET') {
      const studentId = url.searchParams.get('student_id')
      if (studentId) {
        const { data, error } = await supabase
          .from('homework_notes')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
        
        if (error) throw error
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      } else {
        const { data, error } = await supabase.from('homework_notes').select('*')
        if (error) throw error
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const { data, error } = await supabase
        .from('homework_notes')
        .insert([body])
        .select()
        .single()
      
      if (error) throw error
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      })
    }

    if (req.method === 'PUT') {
      const id = url.searchParams.get('id')
      const body = await req.json()
      
      if (id) {
        const { data, error } = await supabase
          .from('homework_notes')
          .update(body)
          .eq('id', id)
          .select()
          .single()
        
        if (error) throw error
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
    }

    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id')
      if (id) {
        const { error } = await supabase
          .from('homework_notes')
          .delete()
          .eq('id', id)
        
        if (error) throw error
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
    }

    return new Response(JSON.stringify({ error: 'Method not supported' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})