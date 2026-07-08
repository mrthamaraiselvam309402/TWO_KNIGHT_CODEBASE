import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, validateAuth } from './rate_limit.js';

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*'
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  }
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
// --- Authentication ---
   const auth = await validateAuth(req, supabase)
   // Allow admin/master/service_role/anonymous for development/demo mode
   if (!auth.allowed) {
     return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
       status: 401,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
     })
   }
  
  // --- Rate Limiting ---
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rateLimitResult = await checkRateLimit(ip, 'security')
  
  if (!rateLimitResult.allowed) {
    return new Response(JSON.stringify({ 
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
    }), { 
      status: 429, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
  
  try {
    const url = new URL(req.url)
    const method = req.method
    
    // GET - Get security status or batch password
    if (method === 'GET') {
      const url = new URL(req.url);
      const batchId = url.searchParams.get('batchId');

      if (batchId) {
        const { data, error } = await supabase
          .from('batch_passwords')
          .select('batch_id, password, updated_at')
          .eq('batch_id', batchId)
          .single();

        if (error) {
          return new Response(JSON.stringify({ batch_password: null }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ batch_password: data?.password || null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: logs, error } = await supabase
        .from('login_attempts')
        .select('*')
        .order('attempt_time', { ascending: false })
        .limit(50)

      if (error) throw error

      return new Response(JSON.stringify({
        security_logs: logs || [],
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // POST - Reset Password
    if (method === 'POST') {
      const body = await req.json();
      const { action, batchId, studentIds, newPassword } = body;

      if (action === 'reset_passwords') {
        if (!newPassword) {
          return new Response(JSON.stringify({ error: 'Password cannot be empty' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (batchId) {
          // ── BATCH PASSWORD RESET ──
          // Persist the password in batch_passwords so all students in the
          // batch can authenticate via the batch-password fallback path.
          const { error: batchError } = await supabase
            .from('batch_passwords')
            .upsert(
              { batch_id: batchId, password: newPassword, updated_at: new Date().toISOString() },
              { onConflict: 'batch_id' }
            );

          if (batchError) {
            return new Response(JSON.stringify({ error: `Failed to save batch password: ${batchError.message}` }), {
              status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Keep the plaintext password visible in the students table so the
          // admin UI can display it.
          const { data: batchStudents, error: listError } = await supabase
            .from('students')
            .select('id')
            .eq('batch_id', batchId);

          if (!listError && batchStudents && batchStudents.length > 0) {
            await supabase
              .from('students')
              .update({ password: newPassword })
              .in('id', batchStudents.map(s => s.id));
          }

          return new Response(JSON.stringify({
            success: true,
            message: `Batch password updated for ${batchStudents?.length || 0} student(s).`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (studentIds && Array.isArray(studentIds)) {
          // ── INDIVIDUAL PASSWORD RESET ──
          const { data: students, error } = await supabase
            .from('students')
            .select('id, name, email, auth_id')
            .in('id', studentIds);

          if (error) throw error;
          const targetStudents = students || [];

          if (targetStudents.length === 0) {
            return new Response(JSON.stringify({ message: 'No students found to reset passwords for.' }), {
              status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          let successCount = 0;
          let errors = [];

          for (const student of targetStudents) {
            // Update password_hash via RPC so verify_user_password /
            // verify_student_credentials can validate the new password.
            const { error: rpcError } = await supabase.rpc('update_user_password', {
              p_user_type: 'student',
              p_id: student.id,
              p_new_password: newPassword
            });

            // Also update Supabase Auth if the student has an auth account.
            if (student.auth_id) {
              await supabase.auth.admin.updateUserById(student.auth_id, {
                password: newPassword,
                user_metadata: { password_plain: newPassword }
              }).catch(() => {});
            }

            // Keep plaintext password in the students table for admin UI display.
            await supabase
              .from('students')
              .update({ password: newPassword })
              .eq('id', student.id);

            if (rpcError) {
              errors.push({ id: student.id, name: student.name, error: rpcError.message });
            } else {
              successCount++;
            }
          }

          return new Response(JSON.stringify({
            success: true,
            message: `Successfully reset passwords for ${successCount} student(s).`,
            errors: errors.length > 0 ? errors : undefined
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ error: 'Must provide batchId or studentIds' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
} catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
