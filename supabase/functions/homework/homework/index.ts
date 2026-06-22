import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('VITE_SUPABASE_ANON_KEY') || '';
const JWT_SECRET = Deno.env.get('JWT_SECRET') || '';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-user-role, x-student-id, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS'
    }
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

function getBearerToken(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

function isPublicBearer(request: Request, token: string) {
  return !token || token === SUPABASE_SERVICE_ROLE_KEY || token === SUPABASE_ANON_KEY || token === Deno.env.get('VITE_SUPABASE_ANON_KEY') || token === request.headers.get('apikey');
}

function base64UrlDecode(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifySignedToken(token: string, supabase: any) {
  if (!JWT_SECRET || !token.includes('.')) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
    if (header?.alg !== 'HS256' || header?.typ !== 'JWT' || header?.aud !== 'twoknights-api' || header?.iss !== 'twoknights-auth') return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signature = base64UrlDecode(parts[2]);
    const verified = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(`${parts[0]}.${parts[1]}`));
    if (!verified) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
    const exp = Number(payload.exp || 0);
    if (exp && exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.jti || !isUuid(payload.jti)) return null;

    const { data: session, error } = await supabase
      .from('token_sessions')
      .select('jti, expires_at, revoked_at')
      .eq('jti', payload.jti)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !session) return null;
    return { ...payload, token_session: session };
  } catch {
    return null;
  }
}

async function getVerifiedAuth(request: Request) {
  const bearer = getBearerToken(request);
  if (isPublicBearer(request, bearer)) {
    return { allowed: false, error: 'Valid authentication token required', statusCode: 401 };
  }

  const supabase = getSupabaseClient();
  const localPayload = await verifySignedToken(bearer, supabase);
  if (localPayload) {
    const role = String(localPayload.role || '').toLowerCase();
    const studentId = localPayload.student_id || localPayload.studentId || '';
    if (['admin', 'master', 'parent'].includes(role)) {
      return { allowed: true, role, user: localPayload.user || null, studentId: String(studentId || '') };
    }
    return { allowed: false, error: 'Administrator access required', statusCode: 403 };
  }

  const { data, error } = await supabase.auth.getUser(bearer).catch(() => ({ data: {}, error: { message: 'Invalid token' } }));
  if (!error && data?.user) {
    const role = String(data.user.user_metadata?.role || data.user.app_metadata?.role || '').toLowerCase();
    const studentId = data.user.user_metadata?.student_id || data.user.app_metadata?.student_id || '';
    if (['admin', 'master', 'parent'].includes(role)) {
      return { allowed: true, role, user: data.user, studentId: String(studentId || '') };
    }
    return { allowed: false, error: 'Administrator access required', statusCode: 403 };
  }

  return { allowed: false, error: 'Invalid or expired token', statusCode: 401 };
}

async function requireRole(request: Request, allowedRoles: string[]) {
  const auth = await getVerifiedAuth(request);
  if (!auth.allowed || !allowedRoles.includes(auth.role)) {
    const statusCode = auth.allowed ? 403 : (auth.statusCode || 401);
    return jsonResponse({ error: auth.role ? 'Administrator access required' : (auth.error || 'Unauthorized') }, statusCode);
  }
  return { auth, response: null };
}

async function requireAdmin(request: Request) {
  return requireRole(request, ['admin', 'master']);
}

async function requireParent(request: Request) {
  return requireRole(request, ['parent']);
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isUuid(value: unknown) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getStudentName(student: any) {
  return student?.name || student?.full_name || student?.id || 'Student';
}

function getBatchName(batch: any) {
  return batch?.name || batch?.id || 'Batch';
}

function getBatchStudentIds(batch: any, students: any[] = []) {
  const ids = new Set<string>();
  (batch?.student_ids || []).forEach((id: any) => ids.add(String(id)));
  students.forEach((student) => {
    if (String(student.batch_id) === String(batch.id)) ids.add(String(student.id));
  });
  return Array.from(ids);
}

function assignmentAppliesToStudent(assignment: any, studentId: string, students: any[] = []) {
  const sid = String(studentId);
  if (assignment.target_type === 'all') return true;
  if (assignment.target_type === 'student') return String(assignment.student_id) === sid;
  if (assignment.target_type === 'batch') {
    const student = students.find((item) => String(item.id) === sid);
    if (student && String(student.batch_id) === String(assignment.batch_id)) return true;
    const batch = (assignment as any)._batch || null;
    return batch ? getBatchStudentIds(batch, students).includes(sid) : false;
  }
  return false;
}

function assignmentAppliesToBatch(assignment: any, batchId: string, students: any[] = [], batches: any[] = []) {
  const bid = String(batchId);
  if (assignment.target_type === 'all') return true;
  if (assignment.target_type === 'batch') return String(assignment.batch_id) === bid;
  if (assignment.target_type === 'student') {
    const directStudentInBatch = students.some((student) => String(student.id) === String(assignment.student_id) && String(student.batch_id) === bid);
    if (directStudentInBatch) return true;
    return batches.some((batch) => String(batch.id) === bid && getBatchStudentIds(batch, students).includes(String(assignment.student_id)));
  }
  return false;
}

async function loadReferenceData(supabase: any) {
  const [studentsResult, batchesResult] = await Promise.all([
    supabase.from('students').select('id, name, full_name, status, batch_id'),
    supabase.from('batches').select('id, name, student_ids, status')
  ]);

  if (studentsResult.error) throw studentsResult.error;
  if (batchesResult.error) throw batchesResult.error;

  return {
    students: studentsResult.data || [],
    batches: batchesResult.data || []
  };
}

function enrichAssignments(assignments: any[], students: any[], batches: any[]) {
  const studentMap = new Map(students.map((student) => [String(student.id), student]));
  const batchMap = new Map(batches.map((batch) => [String(batch.id), batch]));

  return (assignments || []).map((assignment) => {
    const student = studentMap.get(String(assignment.student_id));
    const batch = batchMap.get(String(assignment.batch_id));
    const batchStudentIds = batch ? getBatchStudentIds(batch, students) : [];

    return {
      ...assignment,
      recipient_label:
        assignment.target_type === 'student'
          ? getStudentName(student)
          : assignment.target_type === 'batch'
            ? getBatchName(batch)
            : 'All Students',
      recipient_count:
        assignment.target_type === 'student'
          ? 1
          : assignment.target_type === 'batch'
            ? batchStudentIds.length
            : students.filter((item) => (item.status || 'active') !== 'archived').length,
      student_name: student ? getStudentName(student) : null,
      batch_name: batch ? getBatchName(batch) : null
    };
  });
}

async function getSubmissionsForStudent(studentId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('homework_submissions')
    .select('*')
    .eq('student_id', studentId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

function enrichAssignmentsWithStudentSubmissions(assignments: any[], submissions: any[]) {
  const submissionMap = new Map((submissions || []).map((submission) => [String(submission.assignment_id), submission]));
  return (assignments || []).map((assignment) => ({
    ...assignment,
    student_submission: submissionMap.get(String(assignment.id)) || null
  }));
}

async function getAssignmentsForStudent(studentId: string) {
  const supabase = getSupabaseClient();
  const { students, batches } = await loadReferenceData(supabase);
  const visibleStatuses = ['active', 'completed'];

  const { data: assignments, error } = await supabase
    .from('homework_assignments')
    .select('*')
    .in('status', visibleStatuses)
    .order('due_date', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false });

  if (error) throw error;

  const enriched = enrichAssignments(
    (assignments || []).filter((assignment) => assignmentAppliesToStudent(assignment, studentId, students)),
    students,
    batches
  );
  return enrichAssignmentsWithStudentSubmissions(enriched, await getSubmissionsForStudent(studentId));
}

async function getAssignmentsForBatch(batchId: string) {
  const supabase = getSupabaseClient();
  const { students, batches } = await loadReferenceData(supabase);
  const batch = batches.find((item) => String(item.id) === String(batchId));

  if (!batch) {
    return [];
  }

  const { data: assignments, error } = await supabase
    .from('homework_assignments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return enrichAssignments(
    (assignments || []).filter((assignment) => assignmentAppliesToBatch(assignment, batchId, students, batches)),
    students,
    batches
  );
}

async function getAllAssignments() {
  const supabase = getSupabaseClient();
  const { students, batches } = await loadReferenceData(supabase);

  const { data: assignments, error } = await supabase
    .from('homework_assignments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return enrichAssignments(assignments || [], students, batches);
}

async function getAssignmentById(id: string) {
  const supabase = getSupabaseClient();
  const { students, batches } = await loadReferenceData(supabase);

  const { data: assignments, error } = await supabase
    .from('homework_assignments')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;

  return enrichAssignments([assignments], students, batches)[0] || null;
}

async function bulkUpdateAssignments(request: Request) {
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter(isUuid) : [];
  if (ids.length === 0) {
    throw new Error('At least one valid homework id is required');
  }

  const payload: Record<string, any> = {};
  if (body.title !== undefined) payload.title = cleanText(body.title);
  if (body.description !== undefined) payload.description = cleanText(body.description);
  if (body.due_date !== undefined) payload.due_date = body.due_date || null;
  if (body.status !== undefined) payload.status = body.status;
  if (body.target_type !== undefined) payload.target_type = body.target_type;
  if (body.student_id !== undefined) payload.student_id = body.student_id || null;
  if (body.batch_id !== undefined) payload.batch_id = body.batch_id || null;

  if (Object.keys(payload).length === 0) {
    throw new Error('No update fields provided');
  }

  if (payload.title === '') {
    throw new Error('Homework title is required');
  }

  if (payload.status && !['active', 'completed', 'archived'].includes(payload.status)) {
    throw new Error('Invalid homework status');
  }

  if (payload.target_type && !['student', 'batch', 'all'].includes(payload.target_type)) {
    throw new Error('Invalid target type');
  }

  if (payload.target_type === 'student' && (!payload.student_id || !isUuid(payload.student_id))) {
    throw new Error('Student is required for student homework');
  }

  if (payload.target_type === 'batch' && (!payload.batch_id || !isUuid(payload.batch_id))) {
    throw new Error('Batch is required for batch homework');
  }

  if (payload.target_type === 'all' && (payload.student_id || payload.batch_id)) {
    throw new Error('All-student homework cannot include a student or batch');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('homework_assignments')
    .update(payload)
    .in('id', ids)
    .select();

  if (error) throw error;

  const { students, batches } = await loadReferenceData(supabase);
  return enrichAssignments(data || [], students, batches);
}

async function getHomeworkSubmissions(request: Request, auth: any) {
  const url = new URL(request.url);
  const assignmentId = url.searchParams.get('assignment_id');
  const studentId = url.searchParams.get('student_id');
  const status = url.searchParams.get('status');

  const supabase = getSupabaseClient();
  let query = supabase.from('homework_submissions').select('*');

  if (auth.role === 'parent') {
    query = query.eq('student_id', auth.studentId);
  } else {
    if (assignmentId && isUuid(assignmentId)) query = query.eq('assignment_id', assignmentId);
    if (studentId && isUuid(studentId)) query = query.eq('student_id', studentId);
  }

  if (status && ['submitted', 'needs_revision', 'approved', 'closed'].includes(status)) {
    query = query.eq('status', status);
  }

  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function submitHomework(request: Request, auth: any) {
  const body = await request.json().catch(() => ({}));
  const assignmentId = body.assignment_id;
  const submissionText = cleanText(body.submission_text || '');
  const submissionUrl = cleanText(body.submission_url || '');
  if (!assignmentId || !isUuid(assignmentId)) {
    throw new Error('Homework assignment id is required');
  }
  if (!submissionText && !submissionUrl) {
    throw new Error('Submission text or link is required');
  }

  const supabase = getSupabaseClient();
  const assignment = await getAssignmentById(assignmentId);
  const { students } = await loadReferenceData(supabase);
  if (!assignment || !assignmentAppliesToStudent(assignment, auth.studentId, students)) {
    throw new Error('This homework is not assigned to your child');
  }
  if (!['active', 'completed'].includes(assignment.status || 'active')) {
    throw new Error('This homework is not open for submission');
  }

  const existing = (await getSubmissionsForStudent(auth.studentId)).find((item) => String(item.assignment_id) === String(assignmentId));
  if (existing && ['approved', 'closed'].includes(existing.status)) {
    throw new Error('This homework is already closed');
  }

  const revisionCount = existing?.status === 'needs_revision' ? (Number(existing.revision_count) || 0) + 1 : (Number(existing?.revision_count) || 0);
  const payload = {
    assignment_id: assignmentId,
    student_id: auth.studentId,
    status: 'submitted',
    submission_text: submissionText,
    submission_url: submissionUrl,
    submitted_at: new Date().toISOString(),
    reviewed_at: null,
    revision_count: revisionCount,
    created_by: auth.user?.email || auth.user || null
  };

  const { data, error } = existing
    ? await supabase.from('homework_submissions').update(payload).eq('id', existing.id).select().single()
    : await supabase.from('homework_submissions').insert([payload]).select().single();

  if (error) throw error;
  return data;
}

async function reviewHomeworkSubmission(request: Request, url: URL) {
  const id = url.searchParams.get('id');
  if (!id || !isUuid(id)) {
    throw new Error('Submission id is required');
  }

  const body = await request.json().catch(() => ({}));
  const status = body.status || 'approved';
  if (!['needs_revision', 'approved', 'closed'].includes(status)) {
    throw new Error('Invalid review status');
  }

  const payload: Record<string, any> = {
    status,
    feedback: cleanText(body.feedback || ''),
    score: body.score === '' || body.score === null || body.score === undefined ? null : Number(body.score),
    reviewed_at: new Date().toISOString()
  };

  if (Number.isNaN(payload.score)) {
    throw new Error('Score must be a number');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('homework_submissions')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

function getApplicableStudentsForAssignment(assignment: any, students: any[], batches: any[]) {
  return (students || []).filter((student) => assignmentAppliesToStudent(assignment, String(student.id), students));
}

async function queueHomeworkReminder(assignmentId: string, studentId: string, reminderType: string, messageText: string, subject: string, priority = 'normal') {
  const supabase = getSupabaseClient();
  const { data: existing, error: reminderError } = await supabase
    .from('homework_reminders')
    .select('id')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .eq('reminder_type', reminderType)
    .maybeSingle();

  if (reminderError) throw reminderError;
  if (existing) return existing;

  const { data: message, error: messageError } = await supabase
    .from('messages')
    .insert({
      sender_type: 'system',
      receiver_type: 'parent',
      subject,
      message: messageText,
      priority,
      is_read: false
    })
    .select('id')
    .single();

  if (messageError) throw messageError;

  const { data: reminder, error } = await supabase
    .from('homework_reminders')
    .insert({
      assignment_id: assignmentId,
      student_id: studentId,
      reminder_type: reminderType,
      message_id: message?.id || null
    })
    .select()
    .single();

  if (error) throw error;
  return reminder;
}

async function sendHomeworkReminders(request: Request, auth: any) {
  const body = await request.json().catch(() => ({}));
  const assignmentId = body.assignment_id;
  const reminderType = body.reminder_type || 'due_soon';
  if (!assignmentId || !isUuid(assignmentId)) {
    throw new Error('Homework assignment id is required');
  }
  if (!['assignment', 'due_soon', 'overdue', 'submission_confirmation', 'final_feedback'].includes(reminderType)) {
    throw new Error('Invalid reminder type');
  }

  const supabase = getSupabaseClient();
  const assignment = await getAssignmentById(assignmentId);
  const { students, batches } = await loadReferenceData(supabase);
  const applicableStudents = getApplicableStudentsForAssignment(assignment, students, batches);
  const today = new Date();
  const dueDate = assignment?.due_date ? new Date(`${assignment.due_date}T00:00:00`) : null;
  const sent = [];

  for (const student of applicableStudents) {
    const studentId = String(student.id);
    const studentLabel = getStudentName(student);
    const assignmentTitle = assignment?.title || 'Homework';
    let subject = `Homework reminder: ${assignmentTitle}`;
    let message = `Reminder for ${studentLabel}: ${assignmentTitle}.`;
    let priority = 'normal';

    if (reminderType === 'assignment') {
      message = `${studentLabel} has a new homework assignment: ${assignmentTitle}. Please review the instructions and due date.`;
    } else if (reminderType === 'due_soon') {
      const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - today.getTime()) / 86400000) : null;
      if (daysLeft === null || daysLeft > 2) continue;
      subject = `Homework due soon: ${assignmentTitle}`;
      message = `${studentLabel}, ${assignmentTitle} is due ${assignment.due_date || 'soon'}. Please submit on time.`;
      priority = daysLeft <= 0 ? 'high' : 'normal';
    } else if (reminderType === 'overdue') {
      if (!dueDate || dueDate >= today) continue;
      subject = `Overdue homework: ${assignmentTitle}`;
      message = `${studentLabel}, ${assignmentTitle} is overdue. Please submit it as soon as possible.`;
      priority = 'high';
    } else if (reminderType === 'submission_confirmation') {
      subject = `Homework submitted: ${assignmentTitle}`;
      message = `${studentLabel}, your submission for ${assignmentTitle} has been recorded.`;
    } else if (reminderType === 'final_feedback') {
      subject = `Homework feedback: ${assignmentTitle}`;
      message = `${studentLabel}, teacher feedback is available for ${assignmentTitle}.`;
    }

    sent.push(await queueHomeworkReminder(assignmentId, studentId, reminderType, message, subject, priority));
  }

  return sent;
}

async function markSubmissionExcused(request: Request, url: URL) {
  const id = url.searchParams.get('id');
  if (!id || !isUuid(id)) {
    throw new Error('Submission id is required');
  }
  const body = await request.json().catch(() => ({}));
  const payload = {
    excused: Boolean(body.excused),
    excuse_reason: cleanText(body.excuse_reason || ''),
    status: body.excused ? 'closed' : 'submitted'
  };
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('homework_submissions')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

function validateAssignmentPayload(body: Record<string, unknown>) {
  const targetType = (body.target_type as string) || 'student';
  const title = cleanText(body.title);
  const description = cleanText(body.description);
  const studentId = body.student_id as string | null || null;
  const batchId = body.batch_id as string | null || null;
  const dueDate = body.due_date as string | null || null;
  const status = (body.status as string) || 'active';

  if (!title) {
    throw new Error('Homework title is required');
  }

  if (!['student', 'batch', 'all'].includes(targetType)) {
    throw new Error('Invalid target type');
  }

  if (targetType === 'student' && !isUuid(studentId)) {
    throw new Error('Student is required for student homework');
  }

  if (targetType === 'batch' && !isUuid(batchId)) {
    throw new Error('Batch is required for batch homework');
  }

  if (targetType === 'all' && (studentId || batchId)) {
    throw new Error('All-student homework cannot include a student or batch');
  }

  if (!['active', 'completed', 'archived'].includes(status)) {
    throw new Error('Invalid homework status');
  }

  return {
    title,
    description,
    target_type: targetType,
    student_id: targetType === 'student' ? studentId : null,
    batch_id: targetType === 'batch' ? batchId : null,
    due_date: dueDate || null,
    status
  };
}

async function handlePostAction(request: Request, url: URL, body: Record<string, unknown>) {
  const action = url.searchParams.get('action');

  if (action === 'reminders') {
    const adminResult = await requireAdmin(request);
    if (adminResult.response) return adminResult.response;
    try {
      const reminders = await sendHomeworkReminders(request, adminResult.auth);
      return jsonResponse({ data: reminders, sent: reminders.length, success: true });
    } catch (error: any) {
      return jsonResponse({ error: error.message || 'Failed to send homework reminders' }, 500);
    }
  }

  if (action === 'submit') {
    const parentResult = await requireParent(request);
    if (parentResult.response) return parentResult.response;
    try {
      const submission = await submitHomework(request, parentResult.auth);
      if (!submission.confirmation_sent_at) {
        await queueHomeworkReminder(
          String(submission.assignment_id),
          String(submission.student_id),
          'submission_confirmation',
          `Your homework submission has been recorded.`,
          'Homework submission received',
          'normal'
        );
        const supabase = getSupabaseClient();
        await supabase
          .from('homework_submissions')
          .update({ confirmation_sent_at: new Date().toISOString() })
          .eq('id', submission.id);
      }
      return jsonResponse({ data: submission, success: true }, 201);
    } catch (error: any) {
      return jsonResponse({ error: error.message || 'Failed to submit homework' }, 500);
    }
  }

  const adminResult = await requireAdmin(request);
  if (adminResult.response) return adminResult.response;

  try {
    const payload = validateAssignmentPayload(body);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('homework_assignments')
      .insert([{ ...payload, created_by: adminResult.auth.user?.email || adminResult.auth.user || null }])
      .select()
      .single();

    if (error) throw error;

    const enriched = await getAssignmentById(data.id);
    try {
      await sendHomeworkReminders({ ...request, json: async () => ({ assignment_id: data.id, reminder_type: 'assignment' }) } as Request, adminResult.auth);
    } catch (error: any) {
      console.warn('Failed to send assignment reminder:', error.message);
    }
    return jsonResponse({ data: enriched, success: true }, 201);
  } catch (error: any) {
    return jsonResponse({ error: error.message || 'Failed to create homework' }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    return await handlePostAction(request, url, body);
  } catch (error: any) {
    return jsonResponse({ error: error.message || 'Internal server error' }, 500);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const view = url.searchParams.get('view');
    const assignmentId = url.searchParams.get('id');
    const batchId = url.searchParams.get('batch_id');

    // Handle submissions view
    if (view === 'submissions') {
      const authResult = await requireRole(request, ['admin', 'master', 'parent']);
      if (authResult.response) return authResult.response;
      const submissions = await getHomeworkSubmissions(request, authResult.auth);
      return jsonResponse({ data: submissions, total: submissions.length });
    }

    // Handle student assignments
    const headerStudentId = request.headers.get('x-student-id');
    if (headerStudentId) {
      try {
        const assignments = await getAssignmentsForStudent(headerStudentId);
        return jsonResponse({ data: assignments, total: assignments.length });
      } catch (error: any) {
        return jsonResponse({ error: error.message || 'Failed to load homework' }, 500);
      }
    }

    // Handle batch assignments
    if (batchId) {
      try {
        const assignments = await getAssignmentsForBatch(batchId);
        return jsonResponse({ data: assignments, total: assignments.length });
      } catch (error: any) {
        return jsonResponse({ error: error.message || 'Failed to load homework' }, 500);
      }
    }

    // Admin/master: return all assignments
    const adminResult = await requireAdmin(request);
    if (adminResult.response) return adminResult.response;

    try {
      const assignments = await getAllAssignments();
      return jsonResponse({ data: assignments, total: assignments.length });
    } catch (error: any) {
      return jsonResponse({ error: error.message || 'Failed to load homework' }, 500);
    }
  } catch (error: any) {
    return jsonResponse({ error: error.message || 'Internal server error' }, 500);
  }
}

export async function PATCH(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  if (action === 'review') {
    const adminResult = await requireAdmin(request);
    if (adminResult.response) return adminResult.response;
    try {
      const submission = await reviewHomeworkSubmission(request, url);
      return jsonResponse({ data: submission, success: true });
    } catch (error: any) {
      return jsonResponse({ error: error.message || 'Failed to review homework' }, 500);
    }
  }

  if (action === 'excuse') {
    const adminResult = await requireAdmin(request);
    if (adminResult.response) return adminResult.response;
    try {
      const submission = await markSubmissionExcused(request, url);
      return jsonResponse({ data: submission, success: true });
    } catch (error: any) {
      return jsonResponse({ error: error.message || 'Failed to update submission exception' }, 500);
    }
  }

  const adminResult = await requireAdmin(request);
  if (adminResult.response) return adminResult.response;

  try {
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body.ids)) {
      const updated = await bulkUpdateAssignments(request);
      return jsonResponse({ data: updated, updated: updated.length, success: true });
    }

    const id = url.searchParams.get('id');
    if (!id || !isUuid(id)) {
      return jsonResponse({ error: 'Homework id is required' }, 400);
    }

    const payload: Record<string, any> = {};
    if (body.title !== undefined) payload.title = cleanText(body.title);
    if (body.description !== undefined) payload.description = cleanText(body.description);
    if (body.due_date !== undefined) payload.due_date = body.due_date || null;
    if (body.status !== undefined) payload.status = body.status;

    if (Object.keys(payload).length === 0) {
      return jsonResponse({ error: 'No update fields provided' }, 400);
    }

    if (payload.title === '') {
      return jsonResponse({ error: 'Homework title is required' }, 400);
    }

    if (payload.status && !['active', 'completed', 'archived'].includes(payload.status)) {
      return jsonResponse({ error: 'Invalid homework status' }, 400);
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('homework_assignments')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const enriched = await getAssignmentById(data.id);
    return jsonResponse({ data: enriched, success: true });
  } catch (error: any) {
    return jsonResponse({ error: error.message || 'Failed to update homework' }, 500);
  }
}

export async function DELETE(request: Request) {
  const adminResult = await requireAdmin(request);
  if (adminResult.response) return adminResult.response;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id || !isUuid(id)) {
      return jsonResponse({ error: 'Homework id is required' }, 400);
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('homework_assignments').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) {
      return jsonResponse({ error: 'Homework assignment not found' }, 404);
    }

    return jsonResponse({ success: true, deleted_id: id });
  } catch (error: any) {
    return jsonResponse({ error: error.message || 'Failed to delete homework' }, 500);
  }
}

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }
  if (request.method === 'GET') return GET(request);
  if (request.method === 'POST') return POST(request);
  if (request.method === 'PATCH' || request.method === 'PUT') return PATCH(request);
  if (request.method === 'DELETE') return DELETE(request);
  return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);
}
