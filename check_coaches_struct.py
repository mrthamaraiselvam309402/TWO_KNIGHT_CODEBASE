import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}"
}

# Check current coaches structure
url = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/coaches"
resp = requests.get(url, headers=headers)
coaches = resp.json()

print("CURRENT COACHES STRUCTURE:")
print("-" * 60)
for c in coaches:
    print(f"Name: {c.get('name')}")
    print(f"  ID: {c.get('id')}")
    print(f"  Salary: {c.get('salary')}")
    print(f"  Full data: {c}")
    print()