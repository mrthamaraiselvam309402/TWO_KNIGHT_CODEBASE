// Financial Logic Test
// This tests the logic extracted from scripts.js for getStudentPaymentStatus

function getPaymentStatusLogic(studentId, enrollDate, payments) {
  const d = new Date();
  d.setUTCMonth(global.reportMonth);
  d.setUTCFullYear(global.reportYear);

  const myPayments = payments.filter(p => String(p.student_id) === String(studentId));
  const paidThisMonth = myPayments.some(p => {
    if (p.status !== 'paid' && p.status !== 'completed') return false;
    const pd = new Date(p.payment_date || p.created_at);
    return pd.getUTCMonth() === global.reportMonth && pd.getUTCFullYear() === global.reportYear;
  });

  if (paidThisMonth) return 'Paid';
  return 'Due';
}

test('getStudentPaymentStatus returns Paid if payment exists this month', () => {
  global.reportMonth = 4; // May
  global.reportYear = 2026;
  const payments = [
    { student_id: '1', status: 'paid', payment_date: '2026-05-15T12:00:00Z' }
  ];
  
  const status = getPaymentStatusLogic('1', '2026-01-01T00:00:00Z', payments);
  expect(status).toBe('Paid');
});

test('getStudentPaymentStatus returns Due if no payment this month', () => {
  global.reportMonth = 4; // May
  global.reportYear = 2026;
  const payments = [
    { student_id: '1', status: 'paid', payment_date: '2026-04-15T12:00:00Z' } // April
  ];
  
  const status = getPaymentStatusLogic('1', '2026-01-01T00:00:00Z', payments);
  expect(status).toBe('Due');
});
