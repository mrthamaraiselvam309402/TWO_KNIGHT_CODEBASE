import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}"
}

# Get data
coaches_resp = requests.get("https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/coaches", headers=headers)
students_resp = requests.get("https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students", headers=headers)

coaches = coaches_resp.json()
students = students_resp.json()

coach_name_map = {
    "c_vishnu": "VISHNU", "c_rohit": "ROHIT", "c_yogesh": "YOGESH",
    "c_gyanasurya": "GYANASURYA", "c1775765822776": "HARIS",
    "76cd4a63-90ef-44d7-a03b-3a4a24eb9249": "SARAN",
    "bbc9f0c3-95ac-44bc-843a-72eb2e5e2102": "RANJITH",
    "c_arivuselevam": "ARIVUSELVAM", "90e74588d3769383af3eca35f79a9288": "JERISH",
    "e348a0d74ecc07e5b30860e7117844fb": "SUDHIN"
}

# Expected batch config from user
expected_config = {
    "VISHNU": {"batches": 1, "pay_per_batch": 1500},
    "GYANASURYA": {"batches": 2, "pay_per_batch": 2000},
    "SARAN": {"batches": 3, "pay_per_batch": 3800},
    "HARIS": {"batches": 2, "pay_per_batch": 1700},
    "RANJITH": {"batches": 1, "pay_per_batch": 2000},
    "ROHIT": {"batches": 2, "pay_per_batch": 3000},
    "ARIVUSELVAM": {"batches": 1, "pay_per_batch": 1200},
    "JERISH": {"batches": 1, "pay_per_batch": 1200},
    "YOGESH": {"batches": 1, "pay_per_batch": 1200},
    "SUDHIN": {"batches": 1, "pay_per_batch": 1200}
}

print("=" * 80)
print("PHASE 5: AUTOMATED VALIDATION & ANOMALY DETECTION")
print("=" * 80)

# Build current coach salary lookup
coach_salary = {}
for c in coaches:
    name = coach_name_map.get(c['id'], '')
    if name:
        coach_salary[name] = c.get('salary', 0)

# Count actual students per coach
actual_counts = {}
for s in students:
    coach_id = s.get('coach_id', '')
    name = coach_name_map.get(coach_id, '')
    actual_counts[name] = actual_counts.get(name, 0) + 1

anomalies = []

print("\n1. BATCH COUNT VALIDATION")
print("-" * 60)
print(f"{'Coach':<15} {'Expected':<10} {'Actual':<10} {'Status'}")
print("-" * 60)

for coach in sorted(expected_config.keys()):
    expected = expected_config[coach]['batches']
    actual = actual_counts.get(coach, 0)
    status = "OK" if actual == expected else "MISMATCH"
    if actual != expected:
        anomalies.append(f"Batch count mismatch: {coach} (expected={expected}, actual={actual})")
    print(f"{coach:<15} {expected:<10} {actual:<10} {status}")

print("\n2. SALARY CALCULATION VALIDATION")
print("-" * 60)
print(f"{'Coach':<15} {'Batches':<10} {'Pay/Batch':<12} {'Expected':<10} {'Actual':<10} {'Status'}")
print("-" * 80)

for coach in sorted(expected_config.keys()):
    config = expected_config[coach]
    expected_salary = config['batches'] * config['pay_per_batch']
    actual_salary = coach_salary.get(coach, 0)
    status = "OK" if actual_salary == expected_salary else "ERROR"
    if actual_salary != expected_salary:
        anomalies.append(f"Salary calculation error: {coach} (expected={expected_salary}, actual={actual_salary})")
    print(f"{coach:<15} {config['batches']:<10} {config['pay_per_batch']:<12} {expected_salary:<10} {actual_salary:<10} {status}")

print("\n3. REVENUE ANALYSIS")
print("-" * 60)

# Calculate revenue per coach
revenue_by_coach = {}
for s in students:
    coach_id = s.get('coach_id', '')
    coach_name = coach_name_map.get(coach_id, '')
    status = s.get('status', 'pending')
    
    # Extract fee
    notes = s.get('notes', '')
    fee = 0
    if 'fee:' in notes:
        fee = int(notes.split('fee:')[1].split(',')[0])
    
    if coach_name not in revenue_by_coach:
        revenue_by_coach[coach_name] = {'paid': 0, 'pending': 0}
    
    if status == 'active':
        revenue_by_coach[coach_name]['paid'] += fee
    else:
        revenue_by_coach[coach_name]['pending'] += fee

print(f"{'Coach':<15} {'Paid Revenue':<15} {'Pending Revenue':<15} {'Total':<12}")
print("-" * 60)

total_paid = 0
total_pending = 0

for coach in sorted(revenue_by_coach.keys()):
    data = revenue_by_coach[coach]
    total = data['paid'] + data['pending']
    total_paid += data['paid']
    total_pending += data['pending']
    print(f"{coach:<15} {data['paid']:<15} {data['pending']:<15} {total:<12}")

print("-" * 60)
print(f"{'TOTAL':<15} {total_paid:<15} {total_pending:<15} {total_paid + total_pending:<12}")

# Check for revenue leakage (high pending)
if total_pending > total_paid * 2:
    anomalies.append(f"Revenue leakage detected: Rs. {total_pending} pending vs Rs. {total_paid} paid")
    print(f"\n[WARN] Revenue leakage: Rs. {total_pending} pending!")

print("\n" + "=" * 80)
print("VALIDATION SUMMARY")
print("=" * 80)

if anomalies:
    print(f"FOUND {len(anomalies)} ANOMALIES:")
    for i, a in enumerate(anomalies, 1):
        print(f"  {i}. {a}")
else:
    print("No anomalies detected - All systems normal!")

# Financial KPIs
print("\n" + "=" * 80)
print("KEY PERFORMANCE INDICATORS")
print("=" * 80)
print(f"Total Students:        {len(students)}")
print(f"Total Monthly Revenue: Rs. {total_paid + total_pending:,}")
print(f"Collected Revenue:      Rs. {total_paid:,} ({0 if total_paid+total_pending==0 else (total_paid/(total_paid+total_pending))*100:.1f}%)")
print(f"Pending Revenue:        Rs. {total_pending:,} ({0 if total_paid+total_pending==0 else (total_pending/(total_paid+total_pending))*100:.1f}%)")
print(f"Total Coach Cost:       Rs. {sum(coach_salary.values()):,}")
print(f"Net Profit Potential:   Rs. {(total_paid + total_pending) - sum(coach_salary.values()):,}")