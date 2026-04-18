import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
BASE_URL = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}"
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

resp = requests.get(BASE_URL, headers=headers)
students = resp.json()

print("COMPLETE DATABASE DUMP - 45 STUDENTS")
print("=" * 80)
print(f"{'#':<4} {'Name':<25} {'Level':<15} {'Date':<12} {'Coach':<12} {'Fee':<8} {'Session':<8} {'Time'}")
print("-" * 80)

for i, s in enumerate(students, 1):
    name = s['name']
    level = s['grade']
    date = s.get('enrollment_date', '')
    coach_id = s.get('coach_id', '')
    coach = coach_name_map.get(coach_id, coach_id)
    
    notes = s.get('notes', '')
    fee = ''
    session = ''
    time = ''
    
    # Extract from notes
    if 'fee:' in notes:
        fee = notes.split('fee:')[1].split(',')[0]
    if 'session:Group' in notes:
        session = 'Group'
    elif 'session:Single' in notes:
        session = 'Single'
    if 'time:' in notes:
        time = notes.split('time:')[1].split(',')[0]
    
    print(f"{i:<4} {name:<25} {level:<15} {date:<12} {coach:<12} {fee:<8} {session:<8} {time}")

print("=" * 80)
print(f"\nTOTALS:")
print(f"  Total Students: {len(students)}")