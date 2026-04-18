import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}"
}

# Check coaches
coaches_url = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/coaches"
coaches_resp = requests.get(coaches_url, headers=headers)
coaches = coaches_resp.json()

print("COACHES:")
print("-" * 60)
for c in coaches:
    print(f"ID: {c.get('id')}")
    print(f"  Name: {c.get('name')}")
    print()

# Check students by coach
students_url = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"
students_resp = requests.get(students_url, headers=headers)
students = students_resp.json()

print("\nSTUDENTS BY COACH:")
print("-" * 60)
coach_counts = {}
for s in students:
    coach_id = s.get('coach_id', 'None')
    coach_counts[coach_id] = coach_counts.get(coach_id, 0) + 1

for coach_id, count in sorted(coach_counts.items()):
    print(f"Coach {coach_id}: {count} students")