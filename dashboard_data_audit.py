import requests
import json
from datetime import datetime

# CONFIG
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
HEADERS = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

ENDPOINTS = {
    "students": "https://vseombfkrvpffnpgbsnk.supabase.co/rest/v1/students?select=*",
    "coaches": "https://vseombfkrvpffnpgbsnk.supabase.co/rest/v1/coaches?select=*",
    "payments": "https://vseombfkrvpffnpgbsnk.supabase.co/rest/v1/payments?select=*"
}

def fetch_data(url):
    resp = requests.get(url, headers=HEADERS)
    return resp.json()

def run_audit():
    print("Starting Comprehensive Academy Data Audit...")
    
    students = fetch_data(ENDPOINTS["students"])
    coaches = fetch_data(ENDPOINTS["coaches"])
    payments = fetch_data(ENDPOINTS["payments"])
    
    report = []
    report.append("# Academy Data Integrity Report")
    report.append(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append("")
    
    # 1. ORPHAN AUDIT (Students without Coaches)
    report.append("## 1. Student-Coach Relationship Audit")
    orphans = [s for s in students if not s.get('coach_id')]
    report.append(f"Total Orphans (No Coach Assigned): {len(orphans)}")
    for s in orphans:
        report.append(f"- [ ] Student: {s['name']} (ID: {s['id']})")
    report.append("")

    # 2. INACTIVE COACH AUDIT (Coaches with no Students)
    coach_student_map = {c['id']: [] for c in coaches}
    for s in students:
        cid = s.get('coach_id')
        if cid in coach_student_map:
            coach_student_map[cid].append(s['name'])
            
    inactive_coaches = [c for c in coaches if len(coach_student_map[c['id']]) == 0]
    report.append("## 2. Coach Load Audit")
    report.append(f"Coaches with 0 Students: {len(inactive_coaches)}")
    for c in inactive_coaches:
        report.append(f"- [ ] Coach: {c['name']} (ID: {c['id']}) - Status: {c.get('status', 'N/A')}")
    report.append("")

    # 3. FINANCIAL INTEGRITY AUDIT (Current Month Payments)
    report.append("## 3. Financial Integrity Audit (Current Month)")
    mismatched_finances = []
    now = datetime.now()
    for s in students:
        # Check if student should have paid this month (Potential > 0)
        # We find their payments for the current month
        stud_payments = [p for p in payments if p['student_id'] == s['id']]
        current_month_payments = [p for p in stud_payments if datetime.fromisoformat(p.get('created_at', p.get('payment_date')).replace('Z', '')).month == now.month]
        
        paid_amount = sum(float(p['amount']) for p in current_month_payments)
        fee = 0
        if s.get('notes'):
            import re
            m = re.search(r'fee[:\s]*(\d+)', s['notes'])
            if m: fee = int(m.group(1))
            
        if fee > 0 and paid_amount < fee:
            mismatched_finances.append(f"Student {s['name']} has outstanding dues: Fee {fee}, Paid {paid_amount}")
    
    if mismatched_finances:
        report.append(f"Mismatched Financial States Found: {len(mismatched_finances)}")
        for m in mismatched_finances:
            report.append(f"- [ ] {m}")
    else:
        report.append("Financial status aligns with payment records (for active students).")
    report.append("")

    # 4. DATA DRIFT AUDIT (Notes vs Columns)
    report.append("## 4. Notes Data Drift Audit")
    drift_count = 0
    for s in students:
        notes = (s.get('notes') or '').lower()
        notes_fee = None
        if 'fee:' in notes:
            import re
            match = re.search(r'fee:(\d+)', notes)
            if match:
                notes_fee = int(match.group(1))
        
        col_fee = s.get('monthly_fee')
        if notes_fee and col_fee and notes_fee != col_fee:
            drift_count += 1
            report.append(f"- [ ] Fee Discrepancy for {s['name']}: Notes say {notes_fee}, Column says {col_fee}")
            
    report.append(f"Total instances of data drift (Notes vs Columns): {drift_count}")
    report.append("")

    # 5. DASHBOARD SUMMARY PROJECTIONS
    total_potential = 0
    for s in students:
        fee = s.get('monthly_fee', 0)
        if not fee and s.get('notes'):
            import re
            m = re.search(r'fee[:\s]*(\d+)', s['notes'])
            if m: fee = int(m.group(1))
        total_potential += fee
        
    total_salary = sum((c.get('salary') or c.get('monthly_fee') or 0) for c in coaches if c.get('status') == 'active')
    
    report.append("## 5. Dashboard Summary Projections")
    report.append(f"Total Potential Revenue (Sum of fees): RS {total_potential:,}")
    report.append(f"Total Coach Expenditure (Sum of salaries): RS {total_salary:,}")
    report.append(f"Projected Net Profit (Potential - Cost): RS {total_potential - total_salary:,}")
    
    with open('audit_results.md', 'w', encoding='utf-8') as f:
        f.write('\n'.join(report))
        
    print(f"Audit complete. Results saved to audit_results.md")

if __name__ == "__main__":
    run_audit()
