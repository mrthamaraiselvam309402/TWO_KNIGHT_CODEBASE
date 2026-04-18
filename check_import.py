import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

# Check what tables exist
headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}"
}

# Try to access website_students_import via REST
print("Checking for website_students_import table...")
try:
    url = "https://vseombfkrvpffnpgbsnk.supabase.co/rest/v1/website_students_import?select=*"
    resp = requests.get(url, headers=headers, timeout=10)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print(f"Records: {len(data)}")
        if data:
            print(f"Columns: {list(data[0].keys())}")
    else:
        print(f"Response: {resp.text[:200]}")
except Exception as e:
    print(f"Error: {e}")