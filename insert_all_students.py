import requests
import time

URL = "https://chesskidoo-ai-admin.vercel.app/api/students"
headers = {'Content-Type': 'application/json'}

# Get existing coaches to map names to IDs
coaches_resp = requests.get("https://chesskidoo-ai-admin.vercel.app/api/coaches")
coaches = coaches_resp.json()
print(f"Found {len(coaches)} coaches")

coach_map = {}
for c in coaches:
    name = c.get('name', c.get('full_name', '')).upper()
    coach_map[name] = c['id']
print("Coach map:", coach_map)

# All 46 students
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

success = 0
failed = []

print(f"Inserting {len(students)} students...")
for s in students:
    r = requests.post(URL, headers=headers, json=s)
    if r.status_code in [200, 201]:
        success += 1
    else:
        failed.append((s['name'], r.status_code, r.text[:100]))
    time.sleep(0.1)  # Small delay

print(f"\n=== RESULTS ===")
print(f"Success: {success}/{len(students)}")
if failed:
    print(f"Failed: {len(failed)}")
    for name, code, err in failed:
        print(f"  - {name}: {code}")