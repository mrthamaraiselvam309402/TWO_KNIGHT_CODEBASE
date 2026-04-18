import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
BASE_URL = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}"
}

resp = requests.get(BASE_URL, headers=headers)
students = resp.json()

print(f"Total: {len(students)}\n")

# Show first 10 and last 10 to verify
print("First 10 students:")
for i, s in enumerate(students[:10], 1):
    print(f"{i}. {s['name']} - {s['grade']} - {s.get('enrollment_date', 'N/A')}")

print("\nLast 10 students:")
for i, s in enumerate(students[-10:], 36):
    print(f"{i}. {s['name']} - {s['grade']} - {s.get('enrollment_date', 'N/A')}")