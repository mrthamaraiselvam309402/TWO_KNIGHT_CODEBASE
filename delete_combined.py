import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
BASE_URL = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}"
}

print("Fetching students...")
response = requests.get(BASE_URL, headers=headers)
students = response.json()
print(f"Total students: {len(students)}")

combined = [s for s in students if '&' in s.get('name', '')]
print(f"Found {len(combined)} combined records")

for s in combined:
    student_id = s['id']
    student_name = s['name']
    delete_url = f"{BASE_URL}?id={student_id}"
    print(f"Deleting: {student_name} (ID: {student_id})...")
    try:
        del_resp = requests.delete(delete_url, headers=headers)
        print(f"  Status: {del_resp.status_code}")
    except Exception as e:
        print(f"  Error: {e}")

# Check final count
final_resp = requests.get(BASE_URL, headers=headers)
final_count = len(final_resp.json())
print(f"\nFinal count: {final_count}")