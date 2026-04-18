import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}"
}

# Check what columns website_students_import has
url = "https://vseombfkrvpffnpgbsnk.supabase.co/rest/v1/website_students_import?select=*&limit=1"
resp = requests.get(url, headers=headers)
print(f"Status: {resp.status_code}")
print(f"Response: {resp.text[:500]}")