import requests
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

URL = "https://vseombfkrvpffnpgbsnk.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

headers = {
    'apikey': KEY,
    'Authorization': f'Bearer {KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
}

coach_map = {}

r = requests.get(f'{URL}/rest/v1/coaches?select=id,name', headers=headers)
if r.status_code == 200:
    coaches = r.json()
    for c in coaches:
        coach_map[c['name'].upper()] = c['id']
    print("Coaches:", coach_map)

students = [
    {"name": "AADHAVN - SINGAPORE", "grade": "Beginner 1", "notes": "fee:2200", "coach_id": coach_map.get("SARAN"), "enrollment_date": "2026-03-20", "status": "pending", "rating": 800},
    {"name": "AARA V", "grade": "Beginner 1", "notes": "fee:1800", "coach_id": coach_map.get("SARAN"), "enrollment_date": "2026-03-12", "status": "pending", "rating": 800},
    {"name": "ANFAL", "grade": "Intermediate 1", "notes": "fee:3300", "coach_id": coach_map.get("VISHNU"), "enrollment_date": "2026-03-22", "status": "pending", "rating": 1000},
    {"name": "ARUN BASIC", "grade": "Beginner 1", "notes": "fee:2200", "coach_id": coach_map.get("JERISH"), "enrollment_date": "2026-03-24", "status": "pending", "rating": 800},
    {"name": "ARUNA ADVANCE", "grade": "Advanced", "notes": "fee:2000", "coach_id": coach_map.get("RANJITH"), "enrollment_date": "2026-03-15", "status": "pending", "rating": 1400},
    {"name": "ATISH VIDUN", "grade": "Beginner", "notes": "fee:3200", "coach_id": coach_map.get("ARIVUSELVAM"), "enrollment_date": "2026-03-14", "status": "pending", "rating": 800},
    {"name": "BALAJI GANESH", "grade": "Beginner", "notes": "fee:5200", "coach_id": coach_map.get("GYANASURYA"), "enrollment_date": "2026-03-14", "status": "pending", "rating": 800},
    {"name": "BUVARGAN", "grade": "Intermediate 1", "notes": "fee:900", "coach_id": coach_map.get("ROHIT"), "enrollment_date": "2026-03-22", "status": "pending", "rating": 1000},
    {"name": "DEVI BASIC", "grade": "Beginner 1", "notes": "fee:2400", "coach_id": coach_map.get("HARIS"), "enrollment_date": "2026-03-15", "status": "pending", "rating": 800},
    {"name": "ESWARI SARANVAN", "grade": "Beginner 1", "notes": "fee:1200", "coach_id": coach_map.get("GYANASURYA"), "enrollment_date": "2026-03-12", "status": "pending", "rating": 800},
    {"name": "GAYASURYA", "grade": "Beginner 2", "notes": "fee:2500", "coach_id": coach_map.get("GYANASURYA"), "enrollment_date": "2026-03-11", "status": "pending", "rating": 900},
    {"name": "JEEVAN BASIC", "grade": "Beginner 1", "notes": "fee:2300", "coach_id": coach_map.get("ARIVUSELVAM"), "enrollment_date": "2026-03-15", "status": "pending", "rating": 800},
    {"name": "JAYARAJ", "grade": "Intermediate 1", "notes": "fee:2500", "coach_id": coach_map.get("VISHNU"), "enrollment_date": "2026-03-07", "status": "pending", "rating": 1000},
    {"name": "JAYAKRITHIK", "grade": "Beginner", "notes": "fee:1300", "coach_id": coach_map.get("YOGESH"), "enrollment_date": "2026-03-14", "status": "pending", "rating": 800},
    {"name": "KACHANA", "grade": "Beginner", "notes": "fee:2500", "coach_id": coach_map.get("YOGESH"), "enrollment_date": "2026-03-27", "status": "pending", "rating": 800},
    {"name": "KRISNA", "grade": "Intermediate 1", "notes": "fee:600", "coach_id": coach_map.get("ROHIT"), "enrollment_date": "2026-03-22", "status": "pending", "rating": 1000},
    {"name": "KUMARAPLAYAM CHESS", "grade": "Beginner", "notes": "fee:1800", "coach_id": coach_map.get("SUDHIN"), "enrollment_date": "2026-04-15", "status": "pending", "rating": 800},
    {"name": "MADURAI", "grade": "Beginner", "notes": "fee:1800", "coach_id": coach_map.get("SUDHIN"), "enrollment_date": "2026-04-15", "status": "pending", "rating": 800},
    {"name": "MAGESH NAVEEN", "grade": "Beginner 3", "notes": "fee:3800", "coach_id": coach_map.get("YOGESH"), "enrollment_date": "2026-03-14", "status": "pending", "rating": 1000},
    {"name": "MANAV", "grade": "Beginner 1", "notes": "fee:2200", "coach_id": coach_map.get("HARIS"), "enrollment_date": "2026-03-22", "status": "pending", "rating": 800},
    {"name": "MOHAMMED AAFIQ", "grade": "Beginner", "notes": "fee:1800", "coach_id": coach_map.get("YOGESH"), "enrollment_date": "2026-04-13", "status": "pending", "rating": 800},
    {"name": "MOHAMMED RAYAN", "grade": "Beginner", "notes": "fee:1800", "coach_id": coach_map.get("YOGESH"), "enrollment_date": "2026-04-13", "status": "pending", "rating": 800},
    {"name": "MOHIT BASIC", "grade": "Beginner 1", "notes": "fee:1400", "coach_id": coach_map.get("YOGESH"), "enrollment_date": "2026-03-23", "status": "pending", "rating": 800},
    {"name": "MUKILAN", "grade": "Intermediate 1", "notes": "fee:2000", "coach_id": coach_map.get("VISHNU"), "enrollment_date": "2026-03-22", "status": "pending", "rating": 1000},
    {"name": "NAWFEL", "grade": "Beginner 1", "notes": "fee:1000", "coach_id": coach_map.get("SARAN"), "enrollment_date": "2026-03-12", "status": "pending", "rating": 800},
    {"name": "NIGUNAN", "grade": "Beginner 2", "notes": "fee:2500", "coach_id": coach_map.get("GYANASURYA"), "enrollment_date": "2026-03-11", "status": "pending", "rating": 900},
    {"name": "POONTHALIR", "grade": "Intermediate 1", "notes": "fee:900", "coach_id": coach_map.get("ROHIT"), "enrollment_date": "2026-03-22", "status": "pending", "rating": 1000},
    {"name": "PRIYADHARSHINI", "grade": "Beginner", "notes": "fee:1500", "coach_id": coach_map.get("SUDHIN"), "enrollment_date": "2026-04-15", "status": "pending", "rating": 800},
    {"name": "PRNAVAV", "grade": "Beginner 1", "notes": "fee:2200", "coach_id": coach_map.get("HARIS"), "enrollment_date": "2026-03-20", "status": "pending", "rating": 800},
    {"name": "RAKISTHA", "grade": "Beginner 3", "notes": "fee:800", "coach_id": coach_map.get("GYANASURYA"), "enrollment_date": "2026-03-22", "status": "pending", "rating": 1000},
    {"name": "RANJITH", "grade": "Advanced 1", "notes": "fee:1600", "coach_id": coach_map.get("RANJITH"), "enrollment_date": "2026-03-15", "status": "pending", "rating": 1400},
    {"name": "REVATHI", "grade": "Beginner 1", "notes": "fee:1200", "coach_id": coach_map.get("GYANASURYA"), "enrollment_date": "2026-03-12", "status": "pending", "rating": 800},
    {"name": "RIYAS", "grade": "Advanced 1", "notes": "fee:1600", "coach_id": coach_map.get("RANJITH"), "enrollment_date": "2026-03-15", "status": "pending", "rating": 1400},
    {"name": "SACHIN", "grade": "Advanced", "notes": "fee:3000", "coach_id": coach_map.get("ARIVUSELVAM"), "enrollment_date": "2026-03-26", "status": "pending", "rating": 1400},
    {"name": "SADHANA", "grade": "Beginner 3", "notes": "fee:1500", "coach_id": coach_map.get("GYANASURYA"), "enrollment_date": "2026-03-22", "status": "pending", "rating": 1000},
    {"name": "SAKTHI", "grade": "Beginner", "notes": "fee:3500", "coach_id": coach_map.get("RANJITH"), "enrollment_date": "2026-04-15", "status": "pending", "rating": 800},
    {"name": "SAKTHULA", "grade": "Beginner", "notes": "fee:1700", "coach_id": coach_map.get("SUDHIN"), "enrollment_date": "2026-04-15", "status": "pending", "rating": 800},
    {"name": "SALEM", "grade": "Beginner 2", "notes": "fee:1200", "coach_id": coach_map.get("GYANASURYA"), "enrollment_date": "2026-03-23", "status": "pending", "rating": 900},
    {"name": "SARAN", "grade": "Beginner 3", "notes": "fee:500", "coach_id": coach_map.get("GYANASURYA"), "enrollment_date": "2026-03-22", "status": "pending", "rating": 1000},
    {"name": "SATHYA", "grade": "Beginner", "notes": "fee:3500", "coach_id": coach_map.get("RANJITH"), "enrollment_date": "2026-04-14", "status": "pending", "rating": 800},
    {"name": "SREELAXMI", "grade": "Beginner 2", "notes": "fee:5000", "coach_id": coach_map.get("ROHIT"), "enrollment_date": "2026-03-10", "status": "pending", "rating": 900},
    {"name": "SURESHBABU", "grade": "Advanced", "notes": "fee:3000", "coach_id": coach_map.get("YOGESH"), "enrollment_date": "2026-04-13", "status": "pending", "rating": 1400},
    {"name": "SUDARSAN", "grade": "Advanced 1", "notes": "fee:1400", "coach_id": coach_map.get("RANJITH"), "enrollment_date": "2026-03-15", "status": "pending", "rating": 1400},
    {"name": "UTTASAN", "grade": "Advanced", "notes": "fee:3000", "coach_id": coach_map.get("ARIVUSELVAM"), "enrollment_date": "2026-03-25", "status": "pending", "rating": 1400},
    {"name": "VARUN", "grade": "Advanced 1", "notes": "fee:1600", "coach_id": coach_map.get("RANJITH"), "enrollment_date": "2026-03-15", "status": "pending", "rating": 1400},
    {"name": "VELAVA", "grade": "Intermediate 1", "notes": "fee:1800", "coach_id": coach_map.get("VISHNU"), "enrollment_date": "2026-03-22", "status": "pending", "rating": 1000},
]

print(f"Inserting {len(students)} students...")
success_count = 0
failed = []

for s in students:
    import time
    import random
    student_id = "s" + str(int(time.time()*1000)) + str(random.randint(1000,9999))
    s['id'] = student_id
    
    r = requests.post(f'{URL}/rest/v1/students', headers=headers, json=s)
    if r.status_code in [200, 201]:
        success_count += 1
    else:
        failed.append((s['name'], r.status_code))

print(f"Success: {success_count}, Failed: {len(failed)}")
if failed:
    for name, code in failed:
        print(f"  {name}: {code}")