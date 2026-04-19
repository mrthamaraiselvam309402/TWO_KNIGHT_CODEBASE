import requests

URL = "https://chesskidoo-ai-admin.vercel.app/api/students"
headers = {'Content-Type': 'application/json'}

# Student name to session data mapping
data = {
    "VELAVA": {"session_mode": "GROUP", "session_time": "Fri & Sat"},
    "VARUN": {"session_mode": "GROUP", "session_time": "Weekend"},
    "UTTASAN": {"session_mode": "SINGLE", "session_time": "Weekend"},
    "SUDARSAN": {"session_mode": "GROUP", "session_time": "Weekend"},
    "SURESHBABU": {"session_mode": "SINGLE", "session_time": "Weekend"},
    "SREELAXMI": {"session_mode": "GROUP", "session_time": "Morn & Eve"},
    "SATHYA": {"session_mode": "SINGLE", "session_time": "Weekend"},
    "SARAN": {"session_mode": "GROUP", "session_time": "Weekend"},
    "SALEM": {"session_mode": "GROUP", "session_time": "Weekend"},
    "SAKTHULA": {"session_mode": "GROUP", "session_time": "Weekend"},
    "SAKTHI": {"session_mode": "SINGLE", "session_time": "Weekend"},
    "SADHANA": {"session_mode": "GROUP", "session_time": "Weekend"},
    "SACHIN": {"session_mode": "SINGLE", "session_time": "Weekend"},
    "RIYAS": {"session_mode": "GROUP", "session_time": "Weekend"},
    "REVATHI": {"session_mode": "GROUP", "session_time": "Weekend"},
    "RANJITH": {"session_mode": "GROUP", "session_time": "Weekend"},
    "RAKISTHA": {"session_mode": "GROUP", "session_time": "Weekend"},
    "PRNAVAV": {"session_mode": "GROUP", "session_time": "Weekend"},
    "PRIYADHARSHINI": {"session_mode": "GROUP", "session_time": "Weekend"},
    "POONTHALIR": {"session_mode": "GROUP", "session_time": "Morn & Eve"},
    "NIGUNAN": {"session_mode": "SINGLE", "session_time": "Weekday"},
    "NAWFEL": {"session_mode": "GROUP", "session_time": "Weekend"},
    "MUKILAN": {"session_mode": "GROUP", "session_time": "Fri & Sat"},
    "MOHIT BASIC": {"session_mode": "GROUP", "session_time": "Weekend (S&M)"},
    "MOHAMMED RAYAN": {"session_mode": "GROUP", "session_time": "Weekend"},
    "MOHAMMED AAFIQ": {"session_mode": "GROUP", "session_time": "Weekend"},
    "MANAV": {"session_mode": "GROUP", "session_time": "Morn & Eve"},
    "MAGESH NAVEEN": {"session_mode": "GROUP", "session_time": "Weekend"},
    "MADURAI": {"session_mode": "GROUP", "session_time": "Weekend"},
    "KUMARAPLAYAM CHESS": {"session_mode": "GROUP", "session_time": "Weekend"},
    "KRISNA": {"session_mode": "GROUP", "session_time": "Morn & Eve"},
    "KACHANA": {"session_mode": "SINGLE", "session_time": "Weekend (S&M)"},
    "JAYAKRITHIK": {"session_mode": "GROUP", "session_time": "Weekend"},
    "JAYARAJ": {"session_mode": "GROUP", "session_time": "Fri & Sat"},
    "JEEVAN BASIC": {"session_mode": "SINGLE", "session_time": "Weekday"},
    "GAYASURYA": {"session_mode": "SINGLE", "session_time": "Weekday"},
    "ESWARI SARANVAN": {"session_mode": "GROUP", "session_time": "Weekend"},
    "DEVI BASIC": {"session_mode": "SINGLE", "session_time": "Weekend"},
    "BUVARGAN": {"session_mode": "GROUP", "session_time": "Morn & Eve"},
    "BALAJI GANESH": {"session_mode": "SINGLE", "session_time": "Weekday"},
    "ATISH VIDUN": {"session_mode": "SINGLE", "session_time": "Weekend"},
    "ARUNA ADVANCE": {"session_mode": "GROUP", "session_time": "Weekend"},
    "ARUN BASIC": {"session_mode": "SINGLE", "session_time": "Weekday"},
    "ANFAL": {"session_mode": "GROUP", "session_time": "Fri & Sat"},
    "AARA V": {"session_mode": "GROUP", "session_time": "Weekend"},
    "AADHAVN - SINGAPORE": {"session_mode": "GROUP", "session_time": "Weekday"},
}

# Get all students and update
r = requests.get(URL)
students = r.json()
print(f"Found {len(students)} students")

for s in students:
    name = s.get('name', '').strip()
    if name in data:
        update_data = data[name]
        # Update via API
        resp = requests.put(f"{URL}?id={s['id']}", headers=headers, json=update_data)
        print(f"Updated {name}: {resp.status_code}")

print("Done!")