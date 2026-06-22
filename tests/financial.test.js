// Financial Logic Test
// This tests the logic extracted from scripts.js for getStudentPaymentAllocations

function getPaymentStatusLogic(studentId, enrollDateStr, payments, targetMonth, targetYear, todayDate = new Date(Date.UTC(2026, 5, 22))) {
  const sid = String(studentId).toLowerCase();
  
  const studentPayments = payments
    .filter(p => String(p.student_id || '').trim().toLowerCase() === sid && (p.status === 'paid' || p.status === 'completed'))
    .sort((a, b) => new Date(a.payment_date || a.created_at) - new Date(b.payment_date || b.created_at));
    
  let totalPaid = studentPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const monthlyFee = 1500; // Mock fee
  
  const baseline = new Date(Date.UTC(2026, 3, 1));
  let enrollDate = enrollDateStr ? new Date(enrollDateStr) : baseline;
  if (enrollDate < baseline) enrollDate = baseline;
  
  let y = enrollDate.getUTCFullYear();
  let m = enrollDate.getUTCMonth();
  
  const allocs = {};
  const maxYear = todayDate.getUTCFullYear() + 2; 
  
  while (y <= maxYear) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    let status;
    
    if (totalPaid >= monthlyFee) {
      status = 'Paid';
      totalPaid -= monthlyFee;
    } else {
      totalPaid = 0;
      if (y > todayDate.getUTCFullYear() || (y === todayDate.getUTCFullYear() && m > todayDate.getUTCMonth())) {
        status = 'Pending';
      } else if (y === todayDate.getUTCFullYear() && m === todayDate.getUTCMonth()) {
        const dueDay = 5;
        const dueDateObj = new Date(y, m, dueDay, 23, 59, 59);
        status = (todayDate >= dueDateObj) ? 'Overdue' : 'Due';
      } else {
        status = 'Overdue';
      }
    }
    
    allocs[key] = status;
    m++;
    if (m > 11) { m = 0; y++; }
  }

  const targetKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
  return allocs[targetKey] || 'Pending';
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

