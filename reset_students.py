import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
BASE_URL = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

coach_map = {
    "VISHNU": "c_vishnu",
    "ROHIT": "c_rohit",
    "YOGESH": "c_yogesh",
    "GYANASURYA": "c_gyanasurya",
    "HARIS": "c1775765822776",
    "SARAN": "76cd4a63-90ef-44d7-a03b-3a4a24eb9249",
    "RANJITH": "bbc9f0c3-95ac-44bc-843a-72eb2e5e2102",
    "ARIVUSELVAM": "c_arivuselevam",
    "JERISH": "90e74588d3769383af3eca35f79a9288",
    "SUDHIN": "e348a0d74ecc07e5b30860e7117844fb"
}

students = [
    {"name": "ANFAL", "level": "Intermediate 1", "fee": 3300, "coach": "VISHNU", "date": "2026-03-22"},
    {"name": "JAYARAJ", "level": "Intermediate 1", "fee": 2500, "coach": "VISHNU", "date": "2026-03-07"},
    {"name": "MUKILAN", "level": "Intermediate 1", "fee": 2000, "coach": "VISHNU", "date": "2026-03-22"},
    {"name": "VELAVA", "level": "Intermediate 1", "fee": 1800, "coach": "VISHNU", "date": "2026-03-22"},
    {"name": "POONTHALIR", "level": "Intermediate 1", "fee": 900, "coach": "ROHIT", "date": "2026-03-22"},
    {"name": "BUVARGAN", "level": "Intermediate 1", "fee": 900, "coach": "ROHIT", "date": "2026-03-22"},
    {"name": "KRISNA", "level": "Intermediate 1", "fee": 600, "coach": "ROHIT", "date": "2026-03-22"},
    {"name": "MANAV", "level": "Beginner 1", "fee": 2200, "coach": "HARIS", "date": "2026-03-22"},
    {"name": "SREELAXMI", "level": "Beginner 2", "fee": 5000, "coach": "ROHIT", "date": "2026-03-10"},
    {"name": "NIGUNAN", "level": "Beginner 2", "fee": 2500, "coach": "GYANASURYA", "date": "2026-03-11"},
    {"name": "MAGESH NAVEEN", "level": "Beginner 3", "fee": 3800, "coach": "YOGESH", "date": "2026-03-14"},
    {"name": "SADHANA", "level": "Beginner 3", "fee": 1500, "coach": "GYANASURYA", "date": "2026-03-22"},
    {"name": "SARAN", "level": "Beginner 3", "fee": 500, "coach": "GYANASURYA", "date": "2026-03-22"},
    {"name": "RAKISTHA", "level": "Beginner 3", "fee": 800, "coach": "GYANASURYA", "date": "2026-03-22"},
    {"name": "SALEM", "level": "Beginner 2", "fee": 1200, "coach": "GYANASURYA", "date": "2026-03-23"},
    {"name": "AARA V", "level": "Beginner 1", "fee": 1800, "coach": "SARAN", "date": "2026-03-12"},
    {"name": "NAWFEL", "level": "Beginner 1", "fee": 1000, "coach": "SARAN", "date": "2026-03-12"},
    {"name": "ESWARI SARANVAN", "level": "Beginner 1", "fee": 1200, "coach": "GYANASURYA", "date": "2026-03-12"},
    {"name": "REVATHI", "level": "Beginner 1", "fee": 1200, "coach": "GYANASURYA", "date": "2026-03-12"},
    {"name": "AADHAVN - SINGAPORE", "level": "Beginner 1", "fee": 2200, "coach": "SARAN", "date": "2026-03-20"},
    {"name": "SHERVIN", "level": "Beginner 1", "fee": 2400, "coach": "SARAN", "date": "2026-03-20"},
    {"name": "PRNAVAV", "level": "Beginner 1", "fee": 2200, "coach": "HARIS", "date": "2026-03-20"},
    {"name": "DEVI BASIC", "level": "Beginner 1", "fee": 2400, "coach": "HARIS", "date": "2026-03-15"},
    {"name": "JEEVAN BASIC", "level": "Beginner 1", "fee": 2300, "coach": "ARIVUSELVAM", "date": "2026-03-15"},
    {"name": "ARUNA ADVANCE", "level": "Advanced", "fee": 2000, "coach": "RANJITH", "date": "2026-03-15"},
    {"name": "RIYAS", "level": "Advanced 1", "fee": 1600, "coach": "RANJITH", "date": "2026-03-15"},
    {"name": "VARUN", "level": "Advanced 1", "fee": 1600, "coach": "RANJITH", "date": "2026-03-15"},
    {"name": "SUDARSAN", "level": "Advanced 1", "fee": 1400, "coach": "RANJITH", "date": "2026-03-15"},
    {"name": "MOHIT BASIC", "level": "Beginner 1", "fee": 1400, "coach": "YOGESH", "date": "2026-03-23"},
    {"name": "ARUN BASIC", "level": "Beginner 1", "fee": 2200, "coach": "JERISH", "date": "2026-03-24"},
    {"name": "UTTASAN", "level": "Advanced", "fee": 3000, "coach": "ARIVUSELVAM", "date": "2026-03-25"},
    {"name": "SACHIN", "level": "Advanced", "fee": 3000, "coach": "ARIVUSELVAM", "date": "2026-03-26"},
    {"name": "KACHANA", "level": "Beginner", "fee": 2500, "coach": "YOGESH", "date": "2026-03-27"},
    {"name": "BALAJI GANESH", "level": "Beginner", "fee": 5200, "coach": "GYANASURYA", "date": "2026-03-14"},
    {"name": "ATISH VIDUN", "level": "Beginner", "fee": 3200, "coach": "ARIVUSELVAM", "date": "2026-03-14"},
    {"name": "JAYAKRITHIK", "level": "Beginner", "fee": 1300, "coach": "YOGESH", "date": "2026-03-14"},
    {"name": "MOHAMMED RAYAN", "level": "Beginner", "fee": 1800, "coach": "YOGESH", "date": "2026-04-13"},
    {"name": "MOHAMMED AAFIQ", "level": "Beginner", "fee": 1800, "coach": "YOGESH", "date": "2026-04-13"},
    {"name": "SURESHBABU", "level": "Advanced", "fee": 3000, "coach": "YOGESH", "date": "2026-04-13"},
    {"name": "SATHYA", "level": "Beginner", "fee": 3500, "coach": "RANJITH", "date": "2026-04-14"},
    {"name": "SAKTHI", "level": "Beginner", "fee": 3500, "coach": "RANJITH", "date": "2026-04-15"},
    {"name": "PRIYADHARSHINI", "level": "Beginner", "fee": 1500, "coach": "SUDHIN", "date": "2026-04-15"},
    {"name": "SAKTHULA", "level": "Beginner", "fee": 1700, "coach": "SUDHIN", "date": "2026-04-15"},
    {"name": "KUMARAPLAYAM CHESS", "level": "Beginner", "fee": 1800, "coach": "SUDHIN", "date": "2026-04-15"},
    {"name": "MADURAI", "level": "Beginner", "fee": 1800, "coach": "SUDHIN", "date": "2026-04-15"}
]

print("Step 1: Deleting all existing students...")
response = requests.get(BASE_URL, headers=headers)
all_students = response.json()
print(f"Found {len(all_students)} students to delete")

deleted = 0
for s in all_students:
    student_id = s['id']
    delete_url = f"{BASE_URL}?id={student_id}"
    try:
        del_resp = requests.delete(delete_url, headers=headers)
        if del_resp.status_code == 200:
            deleted += 1
    except Exception as e:
        pass

print(f"Deleted {deleted} students")

print("\nStep 2: Inserting 45 clean student records...")
success = 0
for student in students:
    coach_id = coach_map.get(student["coach"])
    notes = f"fee:{student['fee']},attendance:AB"
    
    body = {
        "name": student["name"],
        "grade": student["level"],
        "coach_id": coach_id,
        "status": "pending",
        "notes": notes,
        "enrollment_date": student["date"]
    }
    
    try:
        resp = requests.post(BASE_URL, json=body, headers=headers)
        if resp.status_code == 200:
            success += 1
            print(f"[{success}] Inserted: {student['name']} - {student['level']} - Rs.{student['fee']}")
    except Exception as e:
        print(f"Error: {student['name']} - {e}")

print(f"\n=== DONE: {success} students inserted ===")

# Verify final count
final_resp = requests.get(BASE_URL, headers=headers)
final_count = len(final_resp.json())
print(f"Final count: {final_count}")