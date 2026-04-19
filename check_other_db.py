import requests

# Try the other Supabase URL that was used earlier
URL = "https://vseombfbrvpfgnpgbsnk.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

headers = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}

tables = ['students', 'coaches', 'events', 'achievements', 'messages']

print(f"Checking: {URL}")
for table in tables:
    r = requests.get(f'{URL}/rest/v1/{table}?select=*&limit=5', headers=headers)
    if r.status_code == 200:
        data = r.json()
        print(f"{table}: {len(data)} records")
        if data and table == 'students':
            print(f"  Sample: {data[0].get('full_name', data[0].get('name', 'N/A'))}")
    else:
        print(f"{table}: Error {r.status_code}")