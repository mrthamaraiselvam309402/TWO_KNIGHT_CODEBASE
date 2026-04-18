import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}"
}

# Get students and count by coach
students_url = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"
students_resp = requests.get(students_url, headers=headers)
students = students_resp.json()

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

# Count students per coach
coach_counts = {}
for s in students:
    coach_id = s.get('coach_id', '')
    coach_name = coach_name_map.get(coach_id, coach_id)
    coach_counts[coach_name] = coach_counts.get(coach_name, 0) + 1

print("CURRENT STUDENT COUNT BY COACH:")
print("-" * 40)
for coach, count in sorted(coach_counts.items()):
    print(f"{coach}: {count} students")

print("\n" + "=" * 40)
print("EXPECTED FROM USER:")
print("-" * 40)
expected = {
    "VISHNU": 1,
    "GYANASURYA": 2,
    "SARAN": 3,
    "HARIS": 2,
    "RANJITH": 1,
    "ROHIT": 2,
    "ARIVUSELVAM": 1,
    "JERISH": 1,
    "YOGESH": 1
}
for coach, count in sorted(expected.items()):
    print(f"{coach}: {count} batches")

print("\n" + "=" * 40)
print("COMPARISON:")
print("-" * 40)
for coach in expected:
    actual = coach_counts.get(coach, 0)
    expected_val = expected[coach]
    match = "✓" if actual == expected_val else "✗"
    print(f"{coach}: Actual={actual}, Expected={expected_val}")