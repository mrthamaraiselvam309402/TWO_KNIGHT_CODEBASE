import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
BASE_URL = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}"
}

# Verify session data in notes
resp = requests.get(BASE_URL, headers=headers)
students = resp.json()

print("Verification - Session & Time in notes:")
print("-" * 60)

# Count by session type
session_counts = {"Group": 0, "Single": 0}
time_counts = {}

for s in students:
    notes = s.get('notes', '')
    name = s['name']
    
    # Extract session and time from notes
    session = ""
    time = ""
    if 'session:Group' in notes:
        session = "Group"
        session_counts["Group"] += 1
    elif 'session:Single' in notes:
        session = "Single"
        session_counts["Single"] += 1
    
    if 'time:' in notes:
        parts = notes.split('time:')
        if len(parts) > 1:
            time_part = parts[1].split(',')[0].strip()
            time = time_part
            time_counts[time_part] = time_counts.get(time_part, 0) + 1
    
    print(f"{name}: {session} - {time}")

print("-" * 60)
print(f"\nSession Summary:")
print(f"  Group: {session_counts['Group']}")
print(f"  Single: {session_counts['Single']}")
print(f"  Total: {session_counts['Group'] + session_counts['Single']}")

print(f"\nTime Summary:")
for t, c in sorted(time_counts.items()):
    print(f"  {t}: {c}")