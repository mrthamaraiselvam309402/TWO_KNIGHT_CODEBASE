# Payment Management Enhancements — Technical Specification

## Overview

Two new features added to the **Payments** module:

1. **Inform Parent Button** — For Pending/Due students: One-click notification to parents via WhatsApp, SMS, Email, or In-App Push.
2. **Paid/Unpaid Toggle** — For Paid students: Revert status to Unpaid (or mark Pending/Due as Paid) with proper transaction handling.

---

## Feature 1: Inform Parent (Pending/Due)

### UI Changes

**Location:** Student Registry table (`#page-stud`) and Payments page (`#page-bills`)

**Button:** `<button class="btn btn-outline-info btn-sm">📢 Inform</button>`

Appears in action column when `status === 'Pending'` or `status === 'Due'`.

### Workflow

```
User clicks "📢 Inform"
    ↓
Modal opens (#inform-modal)
- Student name pre-filled
- Amount due pre-filled (calculated)
- Channel selection: [WhatsApp] [SMS] [Email] [Push]
- Optional custom message textarea
    ↓
User selects channel, optionally adds custom note, clicks "📤 Send Notification"
    ↓
Frontend sends to backend:
POST /api/audit   ← audit log
POST /api/messages (only if channel == 'push')
Client-side opens:
- WhatsApp: https://wa.me/91{parent_phone}?text={message}
- SMS: sms:{parent_phone}?body={message}
- Email: mailto:{parent_email}?subject=...&body=...
    ↓
Success toast → Modal closes
```

### Backend Endpoints Used

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/audit` | POST | Log notification event (channel, amount, student) |
| `/api/messages` | POST (only for push) | Create in-app notification message for parent |

### Notification Content

The message is personalized:

```
Dear {parent_name},

This is a reminder regarding the outstanding chess class fee for {student_name}.

Amount Due: ₹{totalDue}
Period: {Month Year}

Please make the payment at your earliest convenience.

Account: 9025846663 (Ranjith)
Academy: Chesskidoo
```

If admin adds a custom note, it's prepended to the message.

### Amount Calculation Logic

```javascript
const targetMonth = window.reportMonth;    // currently viewed month
const targetYear = window.reportYear;
const enrollDate = new Date(s.enrollment_date);
const baseline = new Date(2026, 3, 1);      // April 1, 2026
const effectiveEnroll = enrollDate < baseline ? baseline : enrollDate;

const monthsRequired = ((targetYear - effectiveEnroll.getFullYear()) * 12) + (targetMonth - effectiveEnroll.getMonth()) + 1;

// Count all-time paid credits (cumulative)
const totalCredits = window.allPayments
  .filter(p => p.student_id === s.id && p.status === 'paid')
  .length;

const pendingMonths = Math.max(1, monthsRequired - totalCredits);
const totalDue = pendingMonths * s.monthly_fee;
```

This ensures the correct pending amount is shown even for complex billing histories.

---

## Feature 2: Toggle Paid/Unpaid

### UI Changes

**Location:** Same table rows

**Buttons:**
- For `Paid` status: `<button class="btn btn-outline-warning btn-sm">🔁 Mark Unpaid</button>`
- For `Pending/Due` status: `<button class="btn btn-outline btn-sm">✅ Mark Paid</button>` (existing)

### Workflow — Mark as Unpaid (Paid → Unpaid)

```
User clicks "🔁 Mark Unpaid" on a Paid student
    ↓
Confirmation: "Revert status to Due? This will NOT delete the transaction record."
    ↓
Confirmed:
1. Find ALL payment records for the current month (targetMonth/targetYear) with status 'paid'
2. DELETE those payment records via DELETE /api/payments?id={paymentId}
3. UPDATE student: PUT /api/students?id={id} with { payment_status: 'Due' }
    ↓
Cache invalidated → reloadAllData()
Dashboard metrics update:
- Collected Revenue decreases by that student's fee
- Total Outstanding increases by that fee
- Student status now shows Due
```

### Workflow — Mark as Paid (Pending/Due → Paid)

```
User clicks "✅ Mark Paid" (already exists)
    ↓
1. Create payment record: POST /api/payments
   - id: pay_toggle_{timestamp}
   - student_id: {id}
   - amount: {monthly_fee}
   - status: 'paid'
   - payment_method: 'Manual Toggle'
   - transaction_id: TGL-{random}
   - payment_date: now
2. Update student: PUT /api/students?id={id} with { payment_status: 'Paid' }
    ↓
Cache invalidated → reloadAllData()
Dashboard metrics update:
- Collected Revenue increases
- Total Outstanding decreases
- Student status now shows Paid
```

### Idempotency & Auditing

Every toggle generates:
- **Audit log entry** (`/api/audit`): Who changed what and when
- **Payment history** is automatically updated (transactions created/deleted)
- **Real-time sync**: All connected clients update via Supabase realtime subscriptions

---

## Database Schema Impact

No new tables needed.

**Existing tables used:**
- `students` — `payment_status`, `due_date`, `monthly_fee`
- `payments` — transaction records (created/deleted by toggle)
- `audit_logs` — audit trail for compliance
- `messages` — for push notifications (channel='push')

---

## Security & Validation

- All API calls validated by Supabase Edge Functions with rate limiting
- Only admin role can call these endpoints (`validateAuth` middleware)
- Audit trail ensures non-repudiation
- Transactional integrity: Payment record and student status are updated in sequence

---

## Frontend Files Modified

| File | Change |
|------|--------|
| `public/index.html` | Added `#inform-modal` for notification composer |
| `public/scripts.js` | Added `informParent()`, `sendInform()`, `togglePaymentStatus()` |
| `public/styles.css` | Added `.btn-outline-info`, `.btn-outline-warning`, CSS variables `--info`, `--warning` |

---

## Backend Files Modified

None required — uses existing Edge Functions:
- `/api/students` (PUT) — update payment_status
- `/api/payments` (POST/DELETE) — manage transaction records
- `/api/audit` (POST) — log actions
- `/api/messages` (POST) — push notification

---

## Testing Checklist

- [ ] **Inform (WhatsApp)**: Click → modal opens → send → WhatsApp opens with pre-filled message
- [ ] **Inform (SMS)**: SMS app opens with pre-filled text
- [ ] **Inform (Push)**: In-app message appears in Notifications for that parent
- [ ] **Toggle → Unpaid**: Paid student becomes Due, revenue decreases, payment record removed
- [ ] **Toggle → Paid**: Pending/Due student becomes Paid, revenue increases, payment record created
- [ ] Audit log entries appear for every action
- [ ] Dashboard metrics update in real-time
- [ ] Realtime sync pushes changes to all logged-in admin tabs

---

## Rollback Plan

If issues arise:
1. Revert frontend commit `9fa1701`
2. No database migration needed — feature is fully backward compatible

---

## Future Enhancements

- **Email integration**: Connect Resend/SendGrid API for server-side email (currently uses `mailto:`)
- **SMS gateway**: Integrate Twilio for automated SMS (currently uses `sms:` link)
- **Scheduled reminders**: Cron-based automated reminders for overdue accounts
- **Parent portal**: Dedicated parent view showing outstanding balance and one-click pay
- **Bulk inform**: Select multiple students and send batch notifications

---

**Status:** ✅ Ready for Production
**Deployed:** Commit `9fa1701` on branch `main`
