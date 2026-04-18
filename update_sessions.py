import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
BASE_URL = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Session mapping by coach and student
session_map = {
    # VISHNU - GROUP | FRI & SAT
    "ANFAL": {"session": "Group", "time": "FRI & SAT"},
    "JAYARAJ": {"session": "Group", "time": "FRI & SAT"},
    "MUKILAN": {"session": "Group", "time": "FRI & SAT"},
    "VELAVA": {"session": "Group", "time": "FRI & SAT"},
    
    # ROHIT - GROUP | MORNING & EVENING
    "POONTHALIR": {"session": "Group", "time": "MORNING & EVENING"},
    "BUVARGAN": {"session": "Group", "time": "MORNING & EVENING"},
    "KRISNA": {"session": "Group", "time": "MORNING & EVENING"},
    "SREELAXMI": {"session": "Group", "time": "MORNING & EVENING"},
    
    # HARIS - GROUP | MORNING & EVENING
    "MANAV": {"session": "Group", "time": "MORNING & EVENING"},
    
    # GYANASURYA - SINGLE | WEEKDAY
    "NIGUNAN": {"session": "Single", "time": "WEEKDAY"},
    "BALAJI GANESH": {"session": "Single", "time": "WEEKDAY"},
    
    # YOGESH - GROUP | WEEKEND
    "MAGESH NAVEEN": {"session": "Group", "time": "WEEKEND"},
    "JAYAKRITHIK": {"session": "Group", "time": "WEEKEND"},
    "MOHAMMED RAYAN": {"session": "Group", "time": "WEEKEND"},
    "MOHAMMED AAFIQ": {"session": "Group", "time": "WEEKEND"},
    
    # GYANASURYA - GROUP | WEEKEND
    "SADHANA": {"session": "Group", "time": "WEEKEND"},
    "SARAN": {"session": "Group", "time": "WEEKEND"},
    "RAKISTHA": {"session": "Group", "time": "WEEKEND"},
    "SALEM": {"session": "Group", "time": "WEEKEND"},
    "ESWARI SARANVAN": {"session": "Group", "time": "WEEKEND"},
    "REVATHI": {"session": "Group", "time": "WEEKEND"},
    
    # SARAN - GROUP | WEEKEND
    "AARA V": {"session": "Group", "time": "WEEKEND"},
    "NAWFEL": {"session": "Group", "time": "WEEKEND"},
    "SHERVIN": {"session": "Group", "time": "WEEKEND"},
    
    # SARAN - GROUP | WEEKDAY
    "AADHAVN - SINGAPORE": {"session": "Group", "time": "WEEKDAY"},
    
    # HARIS - GROUP | WEEKEND
    "PRNAVAV": {"session": "Group", "time": "WEEKEND"},
    
    # HARIS - SINGLE | WEEKEND
    "DEVI BASIC": {"session": "Single", "time": "WEEKEND"},
    
    # ARIVUSELVAM - SINGLE | WEEKDAY
    "JEEVAN BASIC": {"session": "Single", "time": "WEEKDAY"},
    
    # RANJITH - GROUP | WEEKEND
    "ARUNA ADVANCE": {"session": "Group", "time": "WEEKEND"},
    "RIYAS": {"session": "Group", "time": "WEEKEND"},
    "VARUN": {"session": "Group", "time": "WEEKEND"},
    "SUDARSAN": {"session": "Group", "time": "WEEKEND"},
    
    # YOGESH - GROUP | WEEKEND SUN & MON
    "MOHIT BASIC": {"session": "Group", "time": "WEEKEND SUN & MON"},
    
    # JERISH - SINGLE | WEEKDAY
    "ARUN BASIC": {"session": "Single", "time": "WEEKDAY"},
    
    # ARIVUSELVAM - SINGLE | WEEKEND
    "UTTASAN": {"session": "Single", "time": "WEEKEND"},
    "SACHIN": {"session": "Single", "time": "WEEKEND"},
    "ATISH VIDUN": {"session": "Single", "time": "WEEKEND"},
    
    # YOGESH - SINGLE | WEEKEND SUN & MON
    "KACHANA": {"session": "Single", "time": "WEEKEND SUN & MON"},
    
    # YOGESH - SINGLE | WEEKEND
    "SURESHBABU": {"session": "Single", "time": "WEEKEND"},
    
    # RANJITH - SINGLE | WEEKEND
    "SATHYA": {"session": "Single", "time": "WEEKEND"},
    "SAKTHI": {"session": "Single", "time": "WEEKEND"},
    
    # SUDHIN - GROUP | WEEKEND
    "PRIYADHARSHINI": {"session": "Group", "time": "WEEKEND"},
    "SAKTHULA": {"session": "Group", "time": "WEEKEND"},
    "KUMARAPLAYAM CHESS": {"session": "Group", "time": "WEEKEND"},
    "MADURAI": {"session": "Group", "time": "WEEKEND"},
}

# Get all students
print("Fetching students...")
resp = requests.get(BASE_URL, headers=headers)
students = resp.json()
print(f"Found {len(students)} students")

# Update each student
updated = 0
for student in students:
    student_name = student.get('name', '').strip()
    
    if student_name in session_map:
        session_info = session_map[student_name]
        student_id = student['id']
        
        # Build update - keep existing notes, add session info
        existing_notes = student.get('notes', '')
        
        # Add session info to notes (or create new field if supported)
        new_notes = f"{existing_notes},session:{session_info['session']},time:{session_info['time']}" if existing_notes else f"session:{session_info['session']},time:{session_info['time']}"
        
        update_url = f"{BASE_URL}?id={student_id}"
        
        # Try to update with session fields
        body = {
            "notes": new_notes
        }
        
        try:
            update_resp = requests.put(update_url, json=body, headers=headers)
            if update_resp.status_code in [200, 201]:
                print(f"[{updated+1}] {student_name}: {session_info['session']} - {session_info['time']}")
                updated += 1
            else:
                print(f"Error {student_name}: {update_resp.status_code}")
        except Exception as e:
            print(f"Exception {student_name}: {e}")

print(f"\n=== UPDATED: {updated} students ===")

# Verify
final = requests.get(BASE_URL, headers=headers)
print(f"Final count: {len(final.json())}")