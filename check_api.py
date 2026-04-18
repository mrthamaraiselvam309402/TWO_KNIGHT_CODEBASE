import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}"
}

# Test the API endpoint that the frontend uses
url = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"
resp = requests.get(url, headers=headers)
students = resp.json()

print("API Response Sample (first 3 students):")
print("-" * 60)
for s in students[:3]:
    print(f"Name: {s.get('name')}")
    print(f"  grade: {s.get('grade')}")
    print(f"  notes: {s.get('notes')}")
    print(f"  enrollment_date: {s.get('enrollment_date')}")
    print(f"  status: {s.get('status')}")
    print()

print(f"\nTotal students in API: {len(students)}")