import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

COACH_URL = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/coaches"

# Correct batch-based pay from user request
batch_pay_config = {
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

# Verify current state
resp = requests.get(COACH_URL, headers=headers)
coaches = resp.json()

print("Current Coach Salaries:")
print("-" * 50)
for c in coaches:
    name = coach_name_map.get(c['id'], c.get('name', ''))
    salary = c.get('salary', 0)
    if name in batch_pay_config:
        expected = batch_pay_config[name]['batches'] * batch_pay_config[name]['pay_per_batch']
        print(f"{name}: Current={salary}, Expected={expected}, Notes={c.get('notes', 'N/A')[:50] if c.get('notes') else 'N/A'}")