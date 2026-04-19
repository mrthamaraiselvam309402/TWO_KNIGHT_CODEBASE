import requests
import time

URL = "https://chesskidoo-ai-admin.vercel.app/api/students"
headers = {'Content-Type': 'application/json'}

# Get all students first
r = requests.get(URL)
students = r.json()
print(f"Total students: {len(students)}")

# Map of student name to session_mode and session_time
session_data = {
    "AADHAVN - SINGAPORE": {"session_mode": "GROUP", "session_time": "Weekday"},
    "AARA V": {"session_mode": "GROUP", "session_time": "Weekend"},
    "ANFAL": {"session_mode": "GROUP", "session_time": "Fri & Sat"},
    "ARUN BASIC": {"session_mode": "SINGLE", "session_time": "Weekday"},
    "ARUNA ADVANCE": {"session_mode": "GROUP", "session_time": "Weekend"},
    "ATISH VIDUN": {"session_mode": "SINGLE", "session_time": "Weekend"},
    "BALAJI GANESH": {"session_mode": "SINGLE", "session_time": "Weekday"},
    "BUVARGAN": {"session_mode": "GROUP", "session_time": "Morn & Eve"},
    "DEVI BASIC": {"session_mode": "SINGLE", "session_time": "Weekend"},
    "ESWARI SARANVAN": {"session_mode": "GROUP", "session_time": "Weekend"},
    "GAYASURYA": {"session_mode": "SINGLE", "session_time": "Weekday"},
    "JEEVAN BASIC": {"session_mode": "SINGLE", "session_time": "Weekday"},
    "JAYARAJ": {"session_mode": "GROUP", "session_time": "Fri & Sat"},
    "JAYAKRITHIK": {"session_mode": "GROUP", "session_time": "Weekend"},
    "KACHANA": {"session_mode": "SINGLE", "session_time": "Weekend (S&M)"},
    "KRISNA": {"session_mode": "GROUP", "session_time": "Morn & Eve"},
    "KUMARAPLAYAM CHESS": {"session_mode": "GROUP", "session_time": "Weekend"},
    "MADURAI": {"session_mode": "GROUP", "session_time": "Weekend"},
    "MAGESH NAVEEN": {"session_mode": "GROUP", "session_time": "Weekend"},
    "MANAV": {"session_mode": "GROUP", "session_time": "Morn & Eve"},
    "MOHAMMED AAFIQ": {"session_mode": "GROUP", "session_time": "Weekend"},
    "MOHAMMED RAYAN": {"session_mode": "GROUP", "session_time": "Weekend"},
    "MOHIT BASIC": {"session_mode": "GROUP", "session_time": "Weekend (S&M)"},
    "MUKILAN": {"session_mode": "GROUP", "session_time": "Fri & Sat"},
    "NAWFEL": {"session_mode": "GROUP", "session_time": "Weekend"},
    "NIGUNAN": {"session_mode": "SINGLE", "session_time": "Weekday"},
    "POONTHALIR": {"session_mode": "GROUP", "session_time": "Morn & Eve"},
    "PRIYADHARSHINI": {"session_mode": "GROUP", "session_time": "Weekend"},
    "PRNAVAV": {"session_mode": "GROUP", "session_time": "Weekend"},
    "RAKISTHA": {"session_mode": "GROUP", "session_time": "Weekend"},
    "RANJITH": {"session_mode": "GROUP", "session_time": "Weekend"},
    "REVATHI": {"session_mode": "GROUP", "session_time": "Weekend"},
    "RIYAS": {"session_mode": "GROUP", "session_time": "Weekend"},
    "SACHIN": {"session_mode": "SINGLE", "session_time": "Weekend"},
    "SADHANA": {"session_mode": "GROUP", "session_time": "Weekend"},
    "SAKTHI": {"session_mode": "SINGLE", "session_time": "Weekend"},
    "SAKTHULA": {"session_mode": "GROUP", "session_time": "Weekend"},
    "SALEM": {"session_mode": "GROUP", "session_time": "Weekend"},
    "SARAN": {"session_mode": "GROUP", "session_time": "Weekend"},
    "SATHYA": {"session_mode": "SINGLE", "session_time": "Weekend"},
    "SREELAXMI": {"session_mode": "GROUP", "session_time": "Morn & Eve"},
    "SURESHBABU": {"session_mode": "SINGLE", "session_time": "Weekend"},
    "SUDARSAN": {"session_mode": "GROUP", "session_time": "Weekend"},
    "UTTASAN": {"session_mode": "SINGLE", "session_time": "Weekend"},
    "VARUN": {"session_mode": "GROUP", "session_time": "Weekend"},
    "VELAVA": {"session_mode": "GROUP", "session_time": "Fri & Sat"},
}

# Update each student
updated = 0
failed = []

for s in students:
    name = s.get('name', s.get('full_name', '')).strip()
    data = session_data.get(name)
    
    if data:
        # Update student with session data
        update_url = f"{URL}?id={s['id']}"
        r2 = requests.put(update_url, headers=headers, json=data)
        if r2.status_code in [200, 201]:
            updated += 1
            print(f"Updated: {name} -> {data}")
        else:
            failed.append((name, r2.status_code))
    else:
        print(f"NOT FOUND: {name}")
    time.sleep(0.1)

print(f"\n=== Results ===")
print(f"Updated: {updated}/{len(students)}")
if failed:
    print(f"Failed: {failed}")