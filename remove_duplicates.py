import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
BASE_URL = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Get all students and identify unique names
response = requests.get(BASE_URL, headers=headers)
all_students = response.json()

# Find duplicates by name
name_counts = {}
for s in all_students:
    name = s.get('name', '').strip()
    if name not in name_counts:
        name_counts[name] = []
    name_counts[name].append(s['id'])

# Delete duplicates, keeping only the first occurrence
print(f"Total records: {len(all_students)}")
print("Deleting duplicates...")

total_deleted = 0
for name, ids in name_counts.items():
    if len(ids) > 1:
        # Delete all but the first
        for id_to_delete in ids[1:]:
            delete_url = f"{BASE_URL}?id={id_to_delete}"
            try:
                del_resp = requests.delete(delete_url, headers=headers)
                if del_resp.status_code == 200:
                    total_deleted += 1
                    print(f"Deleted duplicate: {name}")
            except:
                pass

print(f"\nDeleted {total_deleted} duplicate records")

# Verify
final_resp = requests.get(BASE_URL, headers=headers)
final_count = len(final_resp.json())
print(f"Final count: {final_count}")