import requests

URL = "https://vseombfkrvpffnpgbsnk.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

headers = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}

# Check table info using POSTGRESQL to get column info
print("=== Getting tables info ===")

# Check students table columns
r = requests.get(f'{URL}/rest/v1/students?select=*&limit=1', headers=headers)
print(f"Students status: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    if data:
        print("Students columns:", list(data[0].keys()))
    else:
        print("No students in table, checking if table exists...")
        # Try to see if we can get any data at all
        r2 = requests.get(f'{URL}/rest/v1/', headers=headers)
        print("Available tables:", r2.json() if r2.status_code == 200 else r2.text[:500])
else:
    print("Error:", r.text[:500])

# Check website_students_import table
print("\n=== Checking website_students_import ===")
r3 = requests.get(f'{URL}/rest/v1/website_students_import?select=*&limit=1', headers=headers)
print(f"Import status: {r3.status_code}")
if r3.status_code == 200:
    data = r3.json()
    if data:
        print("Import columns:", list(data[0].keys()))
    else:
        print("No records in import table")
else:
    print("Error:", r3.text[:500])