import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

COACH_URL = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/coaches"

# CORRECT values per user request
batch_pay_config = {
    "VISHNU": {"batches": 1, "pay_per_batch": 1500, "salary": 1500},
    "GYANASURYA": {"batches": 2, "pay_per_batch": 2000, "salary": 4000},
    "SARAN": {"batches": 3, "pay_per_batch": 3800, "salary": 11400},
    "HARIS": {"batches": 2, "pay_per_batch": 1700, "salary": 3400},
    "RANJITH": {"batches": 1, "pay_per_batch": 2000, "salary": 2000},
    "ROHIT": {"batches": 2, "pay_per_batch": 3000, "salary": 6000},
    "ARIVUSELVAM": {"batches": 1, "pay_per_batch": 1200, "salary": 1200},
    "JERISH": {"batches": 1, "pay_per_batch": 1200, "salary": 1200},
    "YOGESH": {"batches": 1, "pay_per_batch": 1200, "salary": 1200},
    "SUDHIN": {"batches": 1, "pay_per_batch": 1200, "salary": 1200}
}

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

# Get coaches
resp = requests.get(COACH_URL, headers=headers)
coaches = resp.json()

print("FIXING Coach Salaries:")
print("=" * 60)

for coach in coaches:
    coach_id = coach['id']
    coach_name = coach_name_map.get(coach_id, '')
    
    if coach_name in batch_pay_config:
        config = batch_pay_config[coach_name]
        
        update_url = f"{COACH_URL}?id={coach_id}"
        body = {"salary": config['salary']}
        
        try:
            resp = requests.put(update_url, json=body, headers=headers)
            if resp.status_code in [200, 201]:
                print(f"[OK] {coach_name}: salary = {config['salary']}")
            else:
                print(f"[ERROR] {coach_name}: {resp.status_code}")
        except Exception as e:
            print(f"[ERROR] {coach_name}: {e}")

print("\n" + "=" * 60)
print("VERIFICATION - Final:")
verify_resp = requests.get(COACH_URL, headers=headers)
verify_coaches = verify_resp.json()

total = 0
print(f"{'Coach':<15} {'Batches':<10} {'Pay/Batch':<12} {'Salary':<10}")
print("-" * 60)
for c in verify_coaches:
    name = coach_name_map.get(c['id'], c.get('name', ''))
    if name in batch_pay_config:
        config = batch_pay_config[name]
        salary = c.get('salary', 0)
        total += salary
        print(f"{name:<15} {config['batches']:<10} {config['pay_per_batch']:<12} {salary:<10}")

print("-" * 60)
print(f"TOTAL MONTHLY COACH EXPENSE: {total}")