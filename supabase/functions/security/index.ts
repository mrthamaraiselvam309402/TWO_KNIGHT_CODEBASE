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
  if (!auth.allowed || (auth.role !== 'admin' && auth.role !== 'master' && auth.role !== 'service_role')) {
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
    
    // GET - Get security status
    if (method === 'GET') {
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
        if (!newPassword || newPassword.length < 6) {
          return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        let targetStudents = [];
        if (batchId) {
          // Get students in batch
          const { data: students, error } = await supabase
            .from('students')
            .select('id, name, email, auth_id')
            .eq('batch_id', batchId);
          if (error) throw error;
          targetStudents = students || [];
        } else if (studentIds && Array.isArray(studentIds)) {
          // Get specific students
          const { data: students, error } = await supabase
            .from('students')
            .select('id, name, email, auth_id')
            .in('id', studentIds);
          if (error) throw error;
          targetStudents = students || [];
        } else {
          return new Response(JSON.stringify({ error: 'Must provide batchId or studentIds' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        if (targetStudents.length === 0) {
           return new Response(JSON.stringify({ message: 'No students found to reset passwords for.' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        let successCount = 0;
        let errors = [];
        
        for (const student of targetStudents) {
          if (!student.auth_id && !student.email) {
            errors.push({ id: student.id, name: student.name, error: 'No auth ID or email' });
            continue;
          }
          
          let userId = student.auth_id;
          
          if (!userId) {
            // Find by email? Supabase Admin API doesn't have an easy "find by email" that we can use without fetching all.
            // Wait, we can fetch user by email if we have it? No, admin.listUsers() is needed.
            // Let's assume auth_id is set, or we skip.
            errors.push({ id: student.id, name: student.name, error: 'No auth_id found in database.' });
            continue;
          }
          
          const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
            password: newPassword
          });
          
          if (updateError) {
            errors.push({ id: student.id, name: student.name, error: updateError.message });
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
