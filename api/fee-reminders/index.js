/**
 * Fee Reminders API
 *
 * GET  /api/fee-reminders
 *   Returns all students with their debt-first calculated fee status.
 *   Uses payment_allocations for accurate billing-month aware amounts.
 *
 * POST /api/fee-reminders/send
 *   Sends fee reminder notifications (WhatsApp / SMS / push) to parents
 *   of selected students. Persists send history.
 *
 * POST /api/fee-reminders/send-all
 *   Sends reminders to ALL students with Due / Overdue status
 *
 * POST /api/fee-reminders/send-pending
 *   Sends reminders to ALL students with Pending / Due / Overdue status
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

/**
 * Compute per-student fee status using payment_allocations (debt-first view).
 * Replicates get_student_financial_state logic in JS for API use.
 */
function computeFeeStatus(student, allocations, now = new Date()) {
  const monthlyFee = parseFloat(student.monthly_fee || 5000);
  const dueDate = student.due_date ? new Date(student.due_date) : new Date(now.getFullYear(), now.getMonth(), 5);

  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthAlloc = (allocations || [])
    .filter(a => a.allocated_month === monthKey)
    .reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

  const outstanding = Math.max(0, monthlyFee - monthAlloc);

  let status = 'Pending';
  if (monthAlloc >= monthlyFee) status = 'Paid';
  else if (now >= dueDate) {
    const daysLate = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
    status = daysLate > 5 ? 'Overdue' : 'Due';
  }

  return {
    month: monthKey,
    monthly_fee: monthlyFee,
    month_allocated: monthAlloc,
    outstanding,
    status,
    due_date: dueDate.toISOString().split('T')[0],
    days_until_due: Math.max(0, Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24))),
    days_past_due: Math.max(0, Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24)))
  };
}

function buildFeeMessage(name, amount, dueDateStr, isDueOrOverdue) {
  const amountText = '₹' + Number(amount || 0).toLocaleString();
  const payTo = (typeof window !== 'undefined' && window.getPaymentPayeeText) ? window.getPaymentPayeeText() : '9025846663 (Ranjith)';
  const cn = name || 'Student';

  if (isDueOrOverdue) {
    return `🔴 FEE PAYMENT DUE\n\n` +
      `Hello Sir/Madam, 👋\n\n` +
      `♟️ This is a gentle note that the chess class fee for ${cn} is currently due.\n\n` +
      `💰 Amount Due: ${amountText}\n` +
      `📅 Due Date: ${dueDateStr}\n\n` +
      `Kindly complete the payment on or before the due date to avoid any interruption in class participation. 🙏\n\n` +
      `📲 Pay via UPI / GPay / PhonePe: ${payTo}\n\n` +
      `Thank you for your continued support! 🌟\n` +
      `♟️ Two Knights Academy`;
  }

  return `📢 UPCOMING FEE REMINDER\n\n` +
    `Hello Sir/Madam, 👋\n\n` +
    `We hope you are doing well! 😊 This is a friendly reminder that the chess class fee for ${cn} is coming up soon. ♟️\n\n` +
    `💰 Fee Amount: ${amountText}\n` +
    `📅 Due Date: ${dueDateStr}\n\n` +
    `Kindly complete the payment on or before the due date. 🙏\n\n` +
    `📲 Pay via UPI / GPay / PhonePe: ${payTo}\n\n` +
    `Thank you so much for your support and cooperation! 🌟\n` +
    `♟️ Two Knights Academy`;
}

export async function GET(request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Server configuration error: missing Supabase credentials' }, 500);
  }

  try {
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status') || '';
    const studentId = url.searchParams.get('student_id') || '';

    const supabase = getSupabaseClient();

    let studentQuery = supabase
      .from('students')
      .select('id, name, parent_phone, parent_name, email, monthly_fee, due_date, payment_status, billing_anchor_year, billing_anchor_month, coach_id, status, enrollment_date')
      .eq('status', 'active');

    if (studentId) studentQuery = studentQuery.eq('id', studentId);

    const { data: students, error: sErr } = await studentQuery;
    if (sErr) return jsonResponse({ error: sErr.message }, 500);
    if (!students || students.length === 0) return jsonResponse({ data: [] });

    const studentIds = students.map(s => s.id);
    const { data: allAllocs, error: aErr } = await supabase
      .from('payment_allocations')
      .select('*')
      .in('student_id', studentIds);

    if (aErr) return jsonResponse({ error: aErr.message }, 500);

    const now = new Date();

    const result = students.map(s => {
      const myAllocs = (allAllocs || []).filter(a => String(a.student_id) === String(s.id));
      const feeStatus = computeFeeStatus(s, myAllocs, now);

      if (statusFilter && statusFilter !== 'all' && feeStatus.status !== statusFilter) return null;

      const phone = (s.parent_phone || '').replace(/\D/g, '');
      const parsed = phone.length >= 10 ? phone : null;

      return {
        student_id: s.id,
        name: s.name,
        parent_name: s.parent_name || '',
        parent_phone: phone,
        phone_valid: !!parsed,
        coach_id: s.coach_id,
        ...feeStatus,
        needs_reminder: feeStatus.status === 'Due' || feeStatus.status === 'Overdue' || (feeStatus.status === 'Pending' && feeStatus.days_until_due <= 3),
        message: buildFeeMessage(s.name, feeStatus.outstanding, feeStatus.due_date, feeStatus.status === 'Due' || feeStatus.status === 'Overdue')
      };
    }).filter(Boolean);

    return jsonResponse({
      data: result,
      total: result.length,
      needs_reminder: result.filter(r => r.needs_reminder).length,
      generated_at: now.toISOString(),
      filter: statusFilter || 'all'
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = new URL(request.url);
    const path = url.pathname;
    const mode = body.mode || (path.includes('send-all') ? 'all' : path.includes('send-pending') ? 'pending' : 'selected');

    if (!['selected', 'all', 'pending'].includes(mode)) {
      return jsonResponse({ error: 'Invalid mode. Use: selected, all, pending' }, 400);
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const supabase = getSupabaseClient();
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let targetStudentIds = [];
    let recipients = [];

    if (mode === 'selected') {
      targetStudentIds = Array.isArray(body.student_ids) ? body.student_ids : [];
    } else if (mode === 'all') {
      const { data: all } = await supabase
        .from('students')
        .select('id')
        .eq('status', 'active')
        .in('payment_status', ['Due', 'Overdue']);
      targetStudentIds = (all || []).map(s => s.id);
    } else if (mode === 'pending') {
      const { data: all } = await supabase
        .from('students')
        .select('id')
        .eq('status', 'active')
        .in('payment_status', ['Pending', 'Due', 'Overdue']);
      targetStudentIds = (all || []).map(s => s.id);
    }

    const isCoachMode = body.recipient_type === 'coach';

    if (targetStudentIds.length === 0) {
      return jsonResponse({ error: 'No students found for this mode', sent: 0 });
    }

    const { data: students, error: sErr } = await supabase
      .from('students')
      .select('id, name, parent_phone, parent_name, email, monthly_fee, due_date, payment_status, coach_id, status')
      .in('id', targetStudentIds);

    if (sErr) return jsonResponse({ error: sErr.message }, 500);

    const { data: allAllocs, error: aErr } = await supabase
      .from('payment_allocations')
      .select('*')
      .in('student_id', targetStudentIds);

    if (aErr) return jsonResponse({ error: aErr.message }, 500);

    const channel = body.channel || 'whatsapp';
    const customMsg = body.custom_message || '';
    let sent = 0;
    let skipped = 0;
    const logs = [];
    const coachSummary = {};

    for (const s of students) {
      const feeStatus = computeFeeStatus(s, (allAllocs || []).filter(a => String(a.student_id) === String(s.id)), now);
      const phone = (s.parent_phone || '').replace(/\D/g, '');
      const email = s.email || '';
      const message = customMsg || buildFeeMessage(s.name, feeStatus.outstanding, feeStatus.due_date, feeStatus.status === 'Due' || feeStatus.status === 'Overdue');

      if (!phone && channel === 'whatsapp' && !isCoachMode) { skipped++; logs.push({ student: s.name, reason: 'no phone' }); continue; }
      if (!email && channel === 'email') { skipped++; logs.push({ student: s.name, reason: 'no email' }); continue; }

      if (channel === 'whatsapp' && phone) {
        const msg = encodeURIComponent(message);
        if (typeof window !== 'undefined') {
          window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${msg}`, '_blank');
        }
      } else if (channel === 'sms' && phone) {
        if (typeof window !== 'undefined') {
          window.open(`sms:${phone}?body=${encodeURIComponent(message)}`, '_blank');
        }
      } else if (channel === 'email' && email) {
        if (typeof window !== 'undefined') {
          window.open(`mailto:${email}?subject=${encodeURIComponent('Fee Reminder - ' + s.name)}&body=${encodeURIComponent(message)}`, '_blank');
        }
      } else if (channel === 'push') {
        const { error: mErr } = await supabase.from('messages').insert({
          sender_type: 'system',
          receiver_type: 'parent',
          receiver_id: s.id,
          sender_name: 'Fee Reminder Bot',
          subject: `Fee Reminder - ${s.name}`,
          message: message,
          priority: 'high'
        });
        if (mErr) logs.push({ student: s.name, reason: 'push failed: ' + mErr.message });
      }

      try {
        await supabase.from('audit_logs').insert({
          table_name: 'students',
          action: isCoachMode ? 'FEE_REMINDER_COACH' : 'FEE_REMINDER',
          record_id: s.id,
          new_value: {
            student: s.name,
            channel,
            amount: feeStatus.outstanding,
            due_date: feeStatus.due_date,
            status: feeStatus.status,
            method: 'api-bulk',
            ...(isCoachMode ? { coach_id: body.recipient_id } : {})
          }
        });
      } catch (_) { /* non-critical */ }

      if (isCoachMode && s.coach_id) {
        if (!coachSummary[s.coach_id]) {
          coachSummary[s.coach_id] = { students: [], totalAmount: 0, statuses: [] };
        }
        coachSummary[s.coach_id].students.push(s.name);
        coachSummary[s.coach_id].totalAmount += feeStatus.outstanding;
        coachSummary[s.coach_id].statuses.push(feeStatus.status);
      }

      sent++;
      logs.push({ student: s.name, phone: phone || email, channel, amount: feeStatus.outstanding, status: feeStatus.status });
    }

    const responseBody = {
      success: true,
      mode,
      channel,
      sent,
      skipped,
      logs,
      timestamp: now.toISOString(),
      ...(isCoachMode ? { coach_summary: coachSummary } : {})
    };

    return jsonResponse(responseBody);
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } }
};
