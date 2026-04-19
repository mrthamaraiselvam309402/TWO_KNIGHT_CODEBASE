import requests

# The vercel.json uses vseombfkrvpffnpgbsnk but earlier I used vseombfbrvpfgnpgbsnk
# Let's check which one has data
URL1 = "https://vseombfkrvpffnpgbsnk.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

headers = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}

# Check both projects
for url in [URL1, "https://vseombfbrvpfgnpgbsnk.supabase.co"]:
    print(f"\n=== Checking {url} ===")
    try:
        r = requests.get(f'{url}/rest/v1/students?select=id,full_name&limit=3', headers=headers, timeout=10)
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            print(f"Students: {len(r.json())} records")
            if r.json():
                print(f"Sample: {r.json()[:2]}")
        else:
            print(f"Error: {r.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")