import requests

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
BASE_URL = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}"
}

valid_names = [
    "ANFAL", "JAYARAJ", "MUKILAN", "VELAVA", "POONTHALIR", "BUVARGAN", "KRISNA",
    "MANAV", "SREELAXMI", "NIGUNAN", "MAGESH NAVEEN", "SADHANA", "SARAN", "RAKISTHA",
    "SALEM", "AARA V", "NAWFEL", "ESWARI SARANVAN", "REVATHI", "AADHAVN - SINGAPORE",
    "SHERVIN", "PRNAVAV", "DEVI BASIC", "JEEVAN BASIC", "ARUNA ADVANCE", "RIYAS",
    "VARUN", "SUDARSAN", "MOHIT BASIC", "ARUN BASIC", "UTTASAN", "SACHIN", "KACHANA",
    "BALAJI GANESH", "ATISH VIDUN", "JAYAKRITHIK", "MOHAMMED RAYAN", "MOHAMMED AAFIQ",
    "SURESHBABU", "SATHYA", "SAKTHI", "PRIYADHARSHINI", "SAKTHULA", "KUMARAPLAYAM CHESS", "MADURAI"
]

print("Fetching all students...")
response = requests.get(BASE_URL, headers=headers)
all_students = response.json()
print(f"Total in database: {len(all_students)}")

to_delete = []
for s in all_students:
    name = s.get('name', '').strip()
    if name not in valid_names:
        to_delete.append(s)

print(f"Students to delete: {len(to_delete)}")

deleted = 0
for s in to_delete:
    student_id = s['id']
    student_name = s['name']
    delete_url = f"{BASE_URL}?id={student_id}"
    try:
        del_resp = requests.delete(delete_url, headers=headers)
        if del_resp.status_code == 200:
            deleted += 1
            print(f"[{deleted}] Deleted: {student_name}")
    except Exception as e:
        print(f"Error deleting {student_name}: {e}")

# Final count
final_resp = requests.get(BASE_URL, headers=headers)
final_count = len(final_resp.json())
print(f"\n=== FINAL COUNT: {final_count} ===")