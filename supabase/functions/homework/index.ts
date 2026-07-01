import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('VITE_SUPABASE_ANON_KEY') || '';
const JWT_SECRET = Deno.env.get('JWT_SECRET') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-role, x-student-id'
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase credentials');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function isUuid(value: unknown) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getAllAssignments() {
   const supabase = getSupabaseClient();
   const { data, error } = await supabase.from('homework_assignments').select('*').order('created_at', { ascending: false });
   if (error) {
     // Return empty array if table doesn't exist (PGRST205)
     console.warn('[Homework] getAllAssignments error:', error.message);
     return [];
   }
   return data || [];
 }

async function getAssignmentById(id: string) {
   const supabase = getSupabaseClient();
   const { data, error } = await supabase.from('homework_assignments').select('*').eq('id', id).single();
   if (error) {
     console.warn('[Homework] getAssignmentById error:', error.message);
     return null;
   }
   return data;
 }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authentication for write operations
  const isWrite = req.method !== 'GET';
  if (isWrite) {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    // Accept any JWT token (starts with eyJ) for development/demo mode
    if (!token || (!token.startsWith('eyJ') && !token.startsWith('master-token-') && !token.startsWith('admin-token-') && !token.startsWith('coach-token-'))) {
      return jsonResponse({ error: 'Invalid token' }, 401);
    }
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const batchId = url.searchParams.get('batch_id');
    const view = url.searchParams.get('view');
    const action = url.searchParams.get('action');
    const headerStudentId = req.headers.get('x-student-id');

    if (req.method === 'GET') {
      const supabase = getSupabaseClient();
if (view === 'submissions') {
         const { data: submissions, error } = await supabase
           .from('homework_submissions')
           .select('*')
           .order('updated_at', { ascending: false });
         if (error) {
           // Return empty array if table doesn't exist (PGRST205)
           console.warn('[Homework] submissions query error:', error.message);
           return jsonResponse({ data: [], total: 0 });
         }
         return jsonResponse({ data: submissions, total: submissions.length });
       }

      if (id) {
        const assignment = await getAssignmentById(id);
        return jsonResponse(assignment);
      }

      const assignments = await getAllAssignments();

      // Attach student_submission if logged in as a parent/student
      if (headerStudentId && isUuid(headerStudentId)) {
        const { data: submissions, error: subError } = await supabase
          .from('homework_submissions')
          .select('*')
          .eq('student_id', headerStudentId);

        if (!subError && submissions) {
          const subMap = new Map(submissions.map(s => [s.assignment_id, s]));
          assignments.forEach((a: any) => {
            a.student_submission = subMap.get(a.id) || null;
          });
        }
      }

      return jsonResponse({ data: assignments, total: assignments.length });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const supabase = getSupabaseClient();

      if (action === 'submit') {
        if (!headerStudentId || !isUuid(headerStudentId)) {
          return jsonResponse({ error: 'Student ID header is required for submission' }, 400);
        }
        if (!body.assignment_id || !isUuid(body.assignment_id)) {
          return jsonResponse({ error: 'Valid Assignment ID is required' }, 400);
        }

        // Fetch existing submission to check revision count
        const { data: existing } = await supabase
          .from('homework_submissions')
          .select('revision_count')
          .eq('assignment_id', body.assignment_id)
          .eq('student_id', headerStudentId)
          .maybeSingle();

        const revisionCount = existing ? (existing.revision_count || 0) + 1 : 0;

        const { data, error } = await supabase
          .from('homework_submissions')
          .upsert(
            {
              assignment_id: body.assignment_id,
              student_id: headerStudentId,
              submission_text: body.submission_text || '',
              submission_url: body.submission_url || '',
              status: 'submitted',
              revision_count: revisionCount,
              submitted_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            { onConflict: 'assignment_id,student_id' }
          )
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ data, success: true }, 201);
      }

      // Default: Create new assignment
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) {
        return jsonResponse({ error: 'Title is required' }, 400);
      }

      const { data, error } = await supabase.from('homework_assignments').insert({
        id: crypto.randomUUID(),
        title,
        description: typeof body.description === 'string' ? body.description.trim() : '',
        due_date: body.due_date || null,
        status: body.status || 'active',
        target_type: body.target_type || 'all',
        student_id: body.student_id || null,
        batch_id: body.batch_id || null,
        attachment_urls: body.attachment_urls || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).select().single();
      if (error) throw error;
      return jsonResponse({ data, success: true }, 201);
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const body = await req.json().catch(() => ({}));
      const supabase = getSupabaseClient();

      if (action === 'review') {
        if (!id || !isUuid(id)) {
          return jsonResponse({ error: 'Submission ID is required for review' }, 400);
        }

        const { data, error } = await supabase
          .from('homework_submissions')
          .update({
            status: body.status,
            feedback: body.feedback || '',
            score: body.score !== undefined && body.score !== '' ? Number(body.score) : null,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ data, success: true });
      }

      // Default: Update homework assignment
      if (id) {
        const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.title !== undefined) payload.title = String(body.title || '').trim();
        if (body.description !== undefined) payload.description = String(body.description || '').trim();
        if (body.due_date !== undefined) payload.due_date = body.due_date || null;
        if (body.status !== undefined) payload.status = body.status;

        const { data, error } = await supabase.from('homework_assignments').update(payload).eq('id', id).select().single();
        if (error) throw error;
        return jsonResponse({ data, success: true });
      } else if (Array.isArray(body.ids)) {
        // Bulk update
        const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.status !== undefined) payload.status = body.status;

        const { data, error } = await supabase.from('homework_assignments').update(payload).in('id', body.ids).select();
        if (error) throw error;
        return jsonResponse({ data, success: true });
      } else {
        return jsonResponse({ error: 'ID or ids required' }, 400);
      }
    }

    if (req.method === 'DELETE') {
      if (!id) {
        return jsonResponse({ error: 'ID required' }, 400);
      }
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('homework_assignments').delete().eq('id', id);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (error: any) {
    return jsonResponse({ error: error.message || 'Internal server error' }, 500);
  }
});