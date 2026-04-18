import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}"
}

# Get all data
coaches_resp = requests.get("https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/coaches", headers=headers)
students_resp = requests.get("https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students", headers=headers)

coaches = coaches_resp.json()
students = students_resp.json()

# Coach name mapping
coach_name_map = {
    "c_vishnu": "VISHNU",
    "c_rohit": "ROHIT",
    "c_yogesh": "YOGESH",
    "c_gyanasurya": "GYANASURYA",
    "c1775765822776": "HARIS",
    "76cd4a63-90ef-44d7-a03b-3a4a24eb9249": "SARAN",
    "bbc9f0c3-95ac-44bc-843a-72eb2e5e2102": "RANJITH",
    "c_arivuselevam": "ARIVUSELVAM",
    "90e74588d3769383af3eca35f79a9288": "JERISH",
    "e348a0d74ecc07e5b30860e7117844fb": "SUDHIN"
}

# Build coach salary lookup
coach_salary = {}
for c in coaches:
    name = coach_name_map.get(c['id'], c.get('name', ''))
    coach_salary[name] = c.get('salary', 0)

# Phase 3: Revenue Attribution & Profitability Modeling
print("=" * 80)
print("PHASE 3: COACH FINANCIAL ANALYTICS")
print("=" * 80)

# Calculate per-coach metrics
coach_data = {}

for student in students:
    coach_id = student.get('coach_id', '')
    coach_name = coach_name_map.get(coach_id, 'UNKNOWN')
    status = student.get('status', 'pending')
    fee = 0
    
    # Extract fee from notes
    notes = student.get('notes', '')
    if 'fee:' in notes:
        fee = int(notes.split('fee:')[1].split(',')[0])
    
    if coach_name not in coach_data:
        coach_data[coach_name] = {
            'total_students': 0,
            'paid_students': 0,
            'pending_students': 0,
            'paid_revenue': 0,
            'pending_revenue': 0
        }
    
    coach_data[coach_name]['total_students'] += 1
    
    if status == 'active':
        coach_data[coach_name]['paid_students'] += 1
        coach_data[coach_name]['paid_revenue'] += fee
    else:
        coach_data[coach_name]['pending_students'] += 1
        coach_data[coach_name]['pending_revenue'] += fee

print(f"\n{'Coach':<15} {'Students':<10} {'Paid':<8} {'Pending':<10} {'Revenue':<12} {'Pending':<12} {'Cost':<10} {'Profit':<10}")
print("-" * 105)

total_revenue = 0
total_pending = 0
total_cost = 0
total_profit = 0

for coach_name in sorted(coach_data.keys()):
    data = coach_data[coach_name]
    cost = coach_salary.get(coach_name, 0)
    profit = data['paid_revenue'] - cost
    
    total_revenue += data['paid_revenue']
    total_pending += data['pending_revenue']
    total_cost += cost
    total_profit += profit
    
    print(f"{coach_name:<15} {data['total_students']:<10} {data['paid_students']:<8} {data['pending_students']:<10} {data['paid_revenue']:<12} {data['pending_revenue']:<12} {cost:<10} {profit:<10}")

print("-" * 105)
print(f"TOTAL:        {len(students):<10} {'-':<8} {'-':<10} {total_revenue:<12} {total_pending:<12} {total_cost:<10} {total_profit:<10}")

print("\n" + "=" * 80)
print("FINANCIAL SUMMARY")
print("=" * 80)
print(f"Total Monthly Revenue (Paid):     Rs. {total_revenue:,}")
print(f"Total Pending Revenue:            Rs. {total_pending:,}")
print(f"Total Potential Revenue:           Rs. {total_revenue + total_pending:,}")
print(f"Total Coach Monthly Cost:         Rs. {total_cost:,}")
print(f"Net Academy Profit (Paid Only):   Rs. {total_profit:,}")
margin = ((total_profit / total_revenue) * 100) if total_revenue > 0 else 0
collection = ((total_revenue / (total_revenue + total_pending)) * 100) if (total_revenue + total_pending) > 0 else 0

print(f"Net Academy Margin:               {margin:.1f}%")
print(f"Collection Rate:                  {collection:.1f}%")