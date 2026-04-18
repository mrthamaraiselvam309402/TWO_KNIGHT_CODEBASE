import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
BASE_URL = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Check current batch data
resp = requests.get(BASE_URL, headers=headers)
students = resp.json()

print("Current batch info in database:")
for s in students[:5]:
    print(f"  {s['name']}: notes={s.get('notes', 'N/A')}")

print("\nChecking if batch_type/batch_time fields exist...")
sample = students[0]
print(f"Available fields: {list(sample.keys())}")