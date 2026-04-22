# Functional Specification: Parent Portal & AI Interface with RBAC

## Document Information
- **Version:** 1.0
- **Date:** 2026-04-22
- **Status:** Draft
- **Project:** Chesskidoo Academy Admin Panel

---

## 1. Executive Summary

This specification defines the requirements for a **Parent Portal** and **AI-Integrated User Interface** with strict **Role-Based Access Control (RBAC)**. The system ensures complete data privacy by enforcing strict separation between administrative and parent用户 accounts.

---

## 2. User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `admin` | Academy Administrator | Full access to all features |
| `master` | Super Administrator | Full access + master controls |
| `parent` | Parent/Guardian | Limited to own child's data only |
| `coach` | Coach (Future) | Student progress + attendance only |

---

## 3. Parent Portal Specification

### 3.1 Authentication Flow

```
Parent Login → Authenticate via Phone/Student ID → 
Validate Parent-Student Relationship → 
Assign parent role → Load Child-Specific Data
```

**Current Implementation Status:** ✅ Partially implemented
- Phone-based authentication exists
- Parent role assignment exists
- Student linkage exists

**Required Enhancements:**
- Add explicit parent-student relationship validation in auth function
- Implement session token with role-scoped data access

### 3.2 Student Profile View

#### 3.2.1 Displayed Information (Read-Only)
| Field | Source | Visibility |
|-------|--------|-------------|
| Student Name | `students.name` | ✅ |
| Student Photo | `students.photo_url` | ✅ |
| Current Level | `students.grade` | ✅ |
| ELO Rating | `students.rating` | ✅ |
| Assigned Coach | `students.coach_id` → `coaches.name` | ✅ |
| Enrollment Date | `students.enrollment_date` | ✅ |
| Batch Type | `students.session_mode` | ✅ |
| Batch Time | `students.session_time` | ✅ |

#### 3.2.2 Restricted Information (Hidden)
| Field | Reason |
|-------|--------|
| Other Students' Data | Privacy violation |
| Payment Records of Other Students | Financial privacy |
| Administrative Notes | Internal use only |
| Coach Salary Information | Financial privacy |
| Academy Revenue Data | Business confidentiality |

### 3.3 Academic Dashboard

#### 3.3.1 Overview Tab
- **Student Progress Card:** Current level, ELO, trend indicator
- **Coach Information:** Assigned coach name and specialty
- **Recent Achievements:** Latest 5 achievements from `achievements` table
- **Upcoming Events:** Next 3 events from `events` table

#### 3.3.2 Growth Tab
- **Rating History Chart:** ELO progression over time
- **Attendance Heatmap:** Last 30 days attendance visualization
- **Skill Progress:** Milestone completion status

#### 3.3.3 Learning Resources Tab
- **Assigned Resources:** Learning materials filtered by student's level
- **External Links:** Curated chess training resources
- **Recommended Content:** Level-appropriate puzzles and videos

#### 3.3.4 Billing Tab
- **Current Payment Status:** Paid/Pending/Due
- **Monthly Fee Amount:** From `students.monthly_fee`
- **Due Date:** From `students.due_date`
- **Payment Action:** Dynamic "Pay Now" button (visible only when status ≠ Paid)

### 3.4 Financial Management Module

#### 3.4.1 Payment Tracking
```
IF student.payment_status ≠ 'Paid' THEN
  Display "Pay Now" button
  Show Outstanding Amount
  Show Due Date
ELSE
  Display "Paid" status with green indicator
END
```

#### 3.4.2 Transaction History
- **Data Source:** `payments` table filtered by `student_id`
- **Displayed Fields:**
  - Payment Date
  - Amount Paid
  - Payment Method (Cash/UPI/Card)
  - Transaction ID
  - Description
- **Actions:**
  - Download Receipt (PDF)
  - View Transaction Details

#### 3.4.3 Dynamic Payment Gateway
- **Trigger Condition:** `payment_status = 'Due'` OR `payment_status = 'Pending'`
- **Displayed Information:**
  - Outstanding Amount
  - Due Date
  - Payment Method Selection (UPI/Cash/Card)
- **Process Flow:**
  1. Parent clicks "Pay Now"
  2. System generates payment order via Razorpay
  3. Payment gateway modal opens
  4. On success → Update `students.payment_status = 'Paid'`
  5. Log transaction to `payments` table

### 3.5 Communication Module

#### 3.5.1 Message Coach
- **UI:** Contact modal with coach selection
- **Data:** `messages` table with `receiver_type = 'coach'`
- **Constraint:** Only own child's assigned coach

#### 3.5.2 Submit Feedback
- **UI:** Feedback submission form
- **Data:** Stored in `feedback` table or `messages` table
- **Constraint:** Readable by admin only

---

## 4. AI Interface Specification

### 4.1 AI Module Types

| Module | Target Role | Data Access |
|--------|-------------|--------------|
| Global Insights | Admin/Master | Full academy data |
| Financial Analysis | Admin/Master | Revenue, payments, fees |
| Coach Performance | Admin/Master | Coach metrics, student progress |
| **Parent Assistant** | **Parent** | **Child-specific data only** |

### 4.2 AI Security Constraints

#### 4.2.1 Data Access Restrictions (MANDATORY)

```
IF user_role = 'parent' THEN
  AI_CONTEXT = {
    student_id: currentStudent.id,
    allowed_queries: [
      'my child progress',
      'my child attendance',
      'my payment status',
      'upcoming events',
      'my child achievements'
    ],
    blocked_data: [
      'other_students',
      'coach_salary',
      'academy_revenue',
      'payment_records_of_others',
      'admin_notes'
    ]
  }
END
```

#### 4.2.2 Query Filtering Rules

| Query Type | Example | Response |
|------------|---------|----------|
| ✅ Allowed | "When is my child's next class?" | Provide schedule |
| ✅ Allowed | "Show my payment history" | Child's payments only |
| ✅ Allowed | "What events are coming up?" | Public events |
| ❌ Blocked | "How much revenue this month?" | "I can only help with your child's information" |
| ❌ Blocked | "Who are the other students?" | "I don't have access to that information" |
| ❌ Blocked | "Tell me about coach salaries" | "I can only assist with your child's progress" |

### 4.3 AI Response Generation

#### 4.3.1 Parent-Specific Context
```javascript
const PARENT_AI_CONTEXT = {
  student_name: currentStudent.name,
  student_level: currentStudent.grade,
  student_elo: currentStudent.rating,
  payment_status: currentStudent.payment_status,
  monthly_fee: currentStudent.monthly_fee,
  assigned_coach: getCoachName(currentStudent.coach_id),
  recent_achievements: getAchievements(currentStudent.id).slice(0, 3),
  upcoming_events: getPublicEvents().slice(0, 3)
};
```

#### 4.3.2 Privacy Guardrails

1. **Input Validation:** Sanitize all user queries before processing
2. **Context Isolation:** Each parent session maintains isolated context
3. **Data Leak Prevention:** 
   - Never expose raw database queries in responses
   - Never include other students' names in responses
   - Never reveal financial metrics to parents
4. **Response Filtering:** Block queries containing sensitive keywords

### 4.4 AI Module Implementation

#### 4.4.1 Add Parent-Specific Module
```javascript
const MODULE_CONFIG = {
  // ... existing modules ...
  parent: {
    title: 'My Child Progress',
    icon: '👶',
    description: 'Get updates about your child\'s progress',
    allowed_data: ['student_profile', 'attendance', 'achievements', 'payments', 'events'],
    data_filter: { student_id: currentStudent.id }
  }
};
```

#### 4.4.2 Context Building for Parent AI
```javascript
function buildParentAIContext(studentId) {
  const student = allStudents.find(s => s.id === studentId);
  const coach = allCoaches.find(c => c.id === student.coach_id);
  const achievements = achievementsData.filter(a => a.student_id === studentId);
  const payments = allPayments.filter(p => p.student_id === studentId);
  
  return {
    student: {
      name: student.name,
      level: student.grade,
      elo: student.rating,
      payment_status: student.payment_status,
      monthly_fee: student.monthly_fee
    },
    coach: coach ? { name: coach.name, specialty: coach.specialization } : null,
    achievements: achievements.slice(0, 5),
    payment_history: payments.map(p => ({
      date: p.payment_date,
      amount: p.amount,
      status: p.status
    })),
    // NOTE: No other students, no revenue, no coach salary
  };
}
```

---

## 5. Role-Based Access Control (RBAC)

### 5.1 Current Implementation

| Feature | Status | Notes |
|---------|--------|-------|
| CSS-based visibility | ✅ | `.admin-only`, `.parent-only` classes |
| JS role checks | ✅ | `role === 'admin'`, etc. |
| setPage() protection | ✅ | Blocks parent from admin pages |
| API endpoint protection | ⚠️ | Needs enhancement |
| AI context isolation | ❌ | Not implemented |

### 5.2 Required RBAC Enhancements

#### 5.2.1 API-Level Protection
All API calls must validate:
```javascript
// Example: /api/students endpoint
IF request.method = 'GET' AND role = 'parent' THEN
  // Filter to only own child's data
  query.student_id = currentStudent.id
END
```

#### 5.2.2 Supabase RLS Policies
```sql
-- Parents can only see their own child's data
CREATE POLICY "Parents see own child only"
ON students FOR SELECT
USING (id IN (
  SELECT student_id FROM parent_student_relations
  WHERE parent_id = auth.uid()
));
```

#### 5.2.3 AI Response Validation
```javascript
function validateAIResponse(response, userRole) {
  if (userRole === 'parent') {
    // Check for sensitive data leakage
    const sensitivePatterns = [
      /revenue/i,
      /salary/i,
      /other student/i,
      /coach.*payment/i,
      /academy.*financial/i
    ];
    
    for (const pattern of sensitivePatterns) {
      if (pattern.test(response)) {
        return "I don't have access to that information.";
      }
    }
  }
  return response;
}
```

---

## 6. Data Models

### 6.1 Parent-Student Relationship
```typescript
interface ParentStudentRelation {
  id: string;
  parent_id: string;      // Link to auth.users
  student_id: string;     // Link to students
  relationship: 'father' | 'mother' | 'guardian';
  created_at: timestamp;
}
```

### 6.2 Enhanced Payment Record
```typescript
interface Payment {
  id: string;
  student_id: string;
  amount: number;
  payment_date: string;
  payment_method: 'cash' | 'upi' | 'card' | 'razorpay';
  transaction_id: string;
  status: 'completed' | 'pending' | 'failed';
  description: string;
  receipt_url: string;
  created_by: string;      // Admin who recorded cash payments
}
```

---

## 7. Acceptance Criteria

### 7.1 Parent Portal

| # | Criterion | Test Scenario | Status |
|---|-----------|---------------|--------|
| 1 | Parent sees only own child's data | Login as parent, verify no other students visible | ✅ |
| 2 | Payment status displays correctly | Check "Paid" shows green, "Due" shows red | ✅ |
| 3 | "Pay Now" appears only when due | Set status to "Due", verify button appears | ✅ |
| 4 | Receipt download works | Complete payment, click download receipt | ✅ |
| 5 | Cannot access admin pages | Try setPage('dash') as parent, should block | ✅ |
| 6 | Events show public only | Verify no internal/admin events visible | ✅ |

### 7.2 AI Interface

| # | Criterion | Test Scenario | Status |
|---|-----------|---------------|--------|
| 1 | Parent AI shows child-specific data | Login as parent, ask "my progress" | ❌ |
| 2 | Revenue query blocked for parents | Ask "academy revenue", should reject | ❌ |
| 3 | Other student data blocked | Ask "who else is in the class", should reject | ❌ |
| 4 | Coach salary blocked | Ask "coach salary", should reject | ❌ |
| 5 | Payment history shows only own child | Ask "payment history", verify only own | ❌ |

---

## 8. Implementation Roadmap

### Phase 1: Parent Portal Enhancements (Immediate)
- [ ] Add parent-student relationship table
- [ ] Enhance auth flow to validate relationships
- [ ] Add payment history tab to parent portal
- [ ] Implement dynamic "Pay Now" button

### Phase 2: RBAC Hardening (Week 1)
- [ ] Add API-level role filtering
- [ ] Implement Supabase RLS policies
- [ ] Add query validation middleware

### Phase 3: AI Security (Week 2)
- [ ] Add parent-specific AI module
- [ ] Implement context isolation
- [ ] Add response filtering guardrails

---

## 9. Appendix

### A. Current File Structure
```
public/
├── index.html        # Main UI with role classes
├── scripts.js        # Frontend logic with role checks
├── styles.css        # Styling

supabase/functions/
├── students/         # Student CRUD API
├── coaches/          # Coach CRUD API  
├── payments/         # Payment API
├── ai/               # AI endpoint (needs RBAC update)
└── auth/             # Authentication

vercel.json           # API route rewrites
```

### B. Key Variables
```javascript
// Current role state
let role = null;           // 'admin' | 'master' | 'parent'
let currentStudent = null;  // Assigned child for parents

// Role check patterns
if (role === 'admin' || role === 'master') { /* full access */ }
if (role === 'parent') { /* limited access */ }
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-22  
**Author:** Chesskidoo Development Team
