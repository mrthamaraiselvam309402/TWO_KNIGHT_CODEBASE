import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
BASE_URL = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Expected mapping from user's original request
expected = {
    # VISHNU (GROUP | FRI & SAT)
    "ANFAL": {"session": "Group", "time": "FRI & SAT"},
    "JAYARAJ": {"session": "Group", "time": "FRI & SAT"},
    "MUKILAN": {"session": "Group", "time": "FRI & SAT"},
    "VELAVA": {"session": "Group", "time": "FRI & SAT"},
    
    # ROHIT (GROUP | MORNING & EVENING)
    "POONTHALIR": {"session": "Group", "time": "MORNING & EVENING"},
    "BUVARGAN": {"session": "Group", "time": "MORNING & EVENING"},
    "KRISNA": {"session": "Group", "time": "MORNING & EVENING"},
    "SREELAXMI": {"session": "Group", "time": "MORNING & EVENING"},
    
    # HARIS (GROUP | MORNING & EVENING)
    "MANAV": {"session": "Group", "time": "MORNING & EVENING"},
    
    # GYANASURYA (SINGLE | WEEKDAY)
    "NIGUNAN": {"session": "Single", "time": "WEEKDAY"},
    "BALAJI GANESH": {"session": "Single", "time": "WEEKDAY"},
    
    # YOGESH (GROUP | WEEKEND)
    "MAGESH NAVEEN": {"session": "Group", "time": "WEEKEND"},
    "JAYAKRITHIK": {"session": "Group", "time": "WEEKEND"},
    "MOHAMMED RAYAN": {"session": "Group", "time": "WEEKEND"},
    "MOHAMMED AAFIQ": {"session": "Group", "time": "WEEKEND"},
    
    # GYANASURYA (GROUP | WEEKEND)
    "SADHANA": {"session": "Group", "time": "WEEKEND"},
    "SARAN": {"session": "Group", "time": "WEEKEND"},
    "RAKISTHA": {"session": "Group", "time": "WEEKEND"},
    "SALEM": {"session": "Group", "time": "WEEKEND"},
    "ESWARI SARANVAN": {"session": "Group", "time": "WEEKEND"},
    "REVATHI": {"session": "Group", "time": "WEEKEND"},
    
    # SARAN (GROUP | WEEKEND)
    "AARA V": {"session": "Group", "time": "WEEKEND"},
    "NAWFEL": {"session": "Group", "time": "WEEKEND"},
    "SHERVIN": {"session": "Group", "time": "WEEKEND"},
    
    # SARAN (GROUP | WEEKDAY)
    "AADHAVN - SINGAPORE": {"session": "Group", "time": "WEEKDAY"},
    
    # HARIS (GROUP | WEEKEND)
    "PRNAVAV": {"session": "Group", "time": "WEEKEND"},
    
    # HARIS (SINGLE | WEEKEND)
    "DEVI BASIC": {"session": "Single", "time": "WEEKEND"},
    
    # ARIVUSELVAM (SINGLE | WEEKDAY)
    "JEEVAN BASIC": {"session": "Single", "time": "WEEKDAY"},
    
    # RANJITH (GROUP | WEEKEND)
    "ARUNA ADVANCE": {"session": "Group", "time": "WEEKEND"},
    "RIYAS": {"session": "Group", "time": "WEEKEND"},
    "VARUN": {"session": "Group", "time": "WEEKEND"},
    "SUDARSAN": {"session": "Group", "time": "WEEKEND"},
    
    # YOGESH (GROUP | WEEKEND SUN & MON)
    "MOHIT BASIC": {"session": "Group", "time": "WEEKEND SUN & MON"},
    
    # JERISH (SINGLE | WEEKDAY)
    "ARUN BASIC": {"session": "Single", "time": "WEEKDAY"},
    
    # ARIVUSELVAM (SINGLE | WEEKEND)
    "UTTASAN": {"session": "Single", "time": "WEEKEND"},
    "SACHIN": {"session": "Single", "time": "WEEKEND"},
    "ATISH VIDUN": {"session": "Single", "time": "WEEKEND"},
    
    # YOGESH (SINGLE | WEEKEND SUN & MON)
    "KACHANA": {"session": "Single", "time": "WEEKEND SUN & MON"},
    
    # YOGESH (SINGLE | WEEKEND)
    "SURESHBABU": {"session": "Single", "time": "WEEKEND"},
    
    # RANJITH (SINGLE | WEEKEND)
    "SATHYA": {"session": "Single", "time": "WEEKEND"},
    "SAKTHI": {"session": "Single", "time": "WEEKEND"},
    
    # SUDHIN (GROUP | WEEKEND)
    "PRIYADHARSHINI": {"session": "Group", "time": "WEEKEND"},
    "SAKTHULA": {"session": "Group", "time": "WEEKEND"},
    "KUMARAPLAYAM CHESS": {"session": "Group", "time": "WEEKEND"},
    "MADURAI": {"session": "Group", "time": "WEEKEND"},
}

# Get all students
resp = requests.get(BASE_URL, headers=headers)
students = resp.json()

print("COMPARISON: Database vs Expected")
print("=" * 70)

mismatches = []
for student in students:
    name = student['name'].strip()
    notes = student.get('notes', '')
    
    if name in expected:
        exp = expected[name]
        
        # Extract actual values
        actual_session = ""
        actual_time = ""
        
        if "session:Group" in notes:
            actual_session = "Group"
        elif "session:Single" in notes:
            actual_session = "Single"
        
        if "time:" in notes:
            parts = notes.split("time:")
            if len(parts) > 1:
                actual_time = parts[1].split(",")[0].strip()
        
        # Compare
        if actual_session != exp["session"] or actual_time != exp["time"]:
            mismatches.append({
                "name": name,
                "expected": f"{exp['session']} - {exp['time']}",
                "actual": f"{actual_session} - {actual_time}"
            })
            print(f"MISMATCH: {name}")
            print(f"  Expected: {exp['session']} - {exp['time']}")
            print(f"  Actual:   {actual_session} - {actual_time}")
        else:
            print(f"OK: {name} = {exp['session']} - {exp['time']}")

print("=" * 70)
if mismatches:
    print(f"\nFOUND {len(mismatches)} MISMATCHES!")
else:
    print("\nALL 45 STUDENTS MATCH EXPECTED DATA!")
    print("  Group: 33")
    print("  Single: 12")