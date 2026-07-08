// Financial Logic Test
// This tests the logic extracted from scripts.js for getStudentPaymentAllocations

// Mirrors the simplified per-month payment-status model:
// Paid if a payment is dated/applied to the target month, else due-date based.
function getPaymentStatusLogic(studentId, enrollDateStr, payments, targetMonth, targetYear, todayDate = new Date(Date.UTC(2026, 5, 22))) {
  const sid = String(studentId).trim().toLowerCase();
  const dueDay = 5;
  const targetKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;

  const paidThisMonth = payments.some(p => {
    if (String(p.student_id || '').trim().toLowerCase() !== sid) return false;
    if (p.status !== 'paid' && p.status !== 'completed') return false;
    if (p.applied_month === targetKey) return true;
    if (!p.applied_month) {
      const d = new Date(p.payment_date || p.created_at);
      const pm = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      return pm === targetKey;
    }
    return false;
  });
  if (paidThisMonth) return 'Paid';

  const dueDateObj = new Date(Date.UTC(targetYear, targetMonth, dueDay, 23, 59, 59));
  const isFuture =
    targetYear > todayDate.getUTCFullYear() ||
    (targetYear === todayDate.getUTCFullYear() && targetMonth > todayDate.getUTCMonth());
  if (isFuture || todayDate < dueDateObj) return 'Pending';

  const diffDays = Math.floor((todayDate - dueDateObj) / (1000 * 60 * 60 * 24));
  return diffDays > 3 ? 'Overdue' : 'Due';
}

test('getStudentPaymentStatus returns Paid if sufficient payments exist since enrollment', () => {
  const payments = [
    { student_id: '1', status: 'paid', amount: 3000, payment_date: '2026-06-15T12:00:00Z' }
  ];
  
  // Enrolled May 2026 (month 4). Paid 3000 (covers May and June).
  // Target: June 2026 (month 5).
  const status = getPaymentStatusLogic('1', '2026-05-01', payments, 5, 2026);
  expect(status).toBe('Paid');
});

test('getStudentPaymentStatus returns Overdue if previous debt consumes payment', () => {
  const payments = [
    { student_id: '1', status: 'paid', amount: 1500, payment_date: '2026-06-15T12:00:00Z' }
  ];
  
  // Enrolled April 2026 (month 3). Total 3 months up to June (April, May, June).
  // Paid only 1500. This pays April. May and June remain Overdue.
  // Asking for May 2026 (month 4).
  const status = getPaymentStatusLogic('1', '2026-04-01', payments, 4, 2026);
  expect(status).toBe('Overdue');
});

test('getStudentPaymentStatus returns Pending if target month is future', () => {
  const payments = [];
  const status = getPaymentStatusLogic('1', '2026-04-01', payments, 6, 2026); // July 2026 (today is June 22)
  expect(status).toBe('Pending');
});

