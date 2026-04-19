import requests

URL = "https://vseombfkrvpffnpgbsnk.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

headers = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}

# Check students
r = requests.get(f'{URL}/rest/v1/students?select=*&limit=10', headers=headers)
print(f"Students: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    print(f"Count: {len(data)}")
    if data:
        print("Sample:", data[:2])
else:
    print("Error:", r.text[:500])

# Check coaches
r2 = requests.get(f'{URL}/rest/v1/coaches?select=*&limit=10', headers=headers)
print(f"\nCoaches: {r2.status_code}")
if r2.status_code == 200:
    data2 = r2.json()
    print(f"Count: {len(data2)}")
    if data2:
        print("Sample:", data2[:2])
else:
    print("Error:", r2.text[:500])

# Check events
r3 = requests.get(f'{URL}/rest/v1/events?select=*&limit=10', headers=headers)
print(f"\nEvents: {r3.status_code}")
if r3.status_code == 200:
    data3 = r3.json()
    print(f"Count: {len(data3)}")
else:
    print("Error:", r3.text[:500])