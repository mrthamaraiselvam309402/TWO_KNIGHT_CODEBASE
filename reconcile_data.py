import requests
import json

# CONFIG
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
BASE_URL = "https://vseombfkrvpffnpgbsnk.supabase.co/rest/v1/students"
HEADERS = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# Mapping from original audit script
EXPECTED_MAPPING = {
    "ANFAL": {"session": "Group", "time": "FRI & SAT", "fee": 1200},
    "JAYARAJ": {"session": "Group", "time": "FRI & SAT", "fee": 1200},
    "MUKILAN": {"session": "Group", "time": "FRI & SAT", "fee": 1200},
    "VELAVA": {"session": "Group", "time": "FRI & SAT", "fee": 1200},
    "POONTHALIR": {"session": "Group", "time": "MORNING & EVENING", "fee": 1500},
    "BUVARGAN": {"session": "Group", "time": "MORNING & EVENING", "fee": 1500},
    "KRISNA": {"session": "Group", "time": "MORNING & EVENING", "fee": 1500},
    "SREELAXMI": {"session": "Group", "time": "MORNING & EVENING", "fee": 1500},
    "MANAV": {"session": "Group", "time": "MORNING & EVENING", "fee": 1500},
    "NIGUNAN": {"session": "Single", "time": "WEEKDAY", "fee": 3000},
    "BALAJI GANESH": {"session": "Single", "time": "WEEKDAY", "fee": 3000},
    "MAGESH NAVEEN": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "JAYAKRITHIK": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "MOHAMMED RAYAN": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "MOHAMMED AAFIQ": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "SADHANA": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "SARAN": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "RAKISTHA": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "SALEM": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "ESWARI SARANVAN": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "REVATHI": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "AARA V": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "NAWFEL": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "SHERVIN": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "AADHAVN - SINGAPORE": {"session": "Group", "time": "WEEKDAY", "fee": 2500},
    "PRNAVAV": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "DEVI BASIC": {"session": "Single", "time": "WEEKEND", "fee": 2500},
    "JEEVAN BASIC": {"session": "Single", "time": "WEEKDAY", "fee": 2500},
    "ARUNA ADVANCE": {"session": "Group", "time": "WEEKEND", "fee": 1500},
    "RIYAS": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "VARUN": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "SUDARSAN": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "MOHIT BASIC": {"session": "Group", "time": "WEEKEND SUN & MON", "fee": 1200},
    "ARUN BASIC": {"session": "Single", "time": "WEEKDAY", "fee": 2500},
    "UTTASAN": {"session": "Single", "time": "WEEKEND", "fee": 2500},
    "SACHIN": {"session": "Single", "time": "WEEKEND", "fee": 2500},
    "ATISH VIDUN": {"session": "Single", "time": "WEEKEND", "fee": 2500},
    "KACHANA": {"session": "Single", "time": "WEEKEND SUN & MON", "fee": 2500},
    "SURESHBABU": {"session": "Single", "time": "WEEKEND", "fee": 2500},
    "SATHYA": {"session": "Single", "time": "WEEKEND", "fee": 2500},
    "SAKTHI": {"session": "Single", "time": "WEEKEND", "fee": 2500},
    "PRIYADHARSHINI": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "SAKTHULA": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "KUMARAPLAYAM CHESS": {"session": "Group", "time": "WEEKEND", "fee": 1200},
    "MADURAI": {"session": "Group", "time": "WEEKEND", "fee": 1200},
}

def reconcile():
    print("Fetching students...")
    resp = requests.get(BASE_URL, headers=HEADERS)
    students = resp.json()
    
    updated_count = 0
    for s in students:
        name = s['name'].strip().upper()
        if name in EXPECTED_MAPPING:
            exp = EXPECTED_MAPPING[name]
            
            # Construct standard notes if column missing
            # Once column exists, scripts.js should be updated to use it.
            # Standardizing notes ensures current UI works.
            new_notes = f"session:{exp['session']}, time:{exp['time']}, fee:{exp['fee']}"
            
            # Prepare update data
            # Note: We try to update monthly_fee too, just in case the column was added
            update_data = {
                "session_mode": exp['session'],
                "session_time": exp['time'],
                "notes": new_notes
            }
            
            # Check if monthly_fee column might exist (we take a chance)
            # If it doesn't, Supabase might ignore it or error.
            # We'll try to update without it first if we are unsure, 
            # but let's include it and see.
            # update_data["monthly_fee"] = exp['fee']
            
            print(f"Updating {name}...")
            u_resp = requests.patch(f"{BASE_URL}?id=eq.{s['id']}", 
                                   headers=HEADERS, 
                                   data=json.dumps(update_data))
            
            if u_resp.status_code >= 200 and u_resp.status_code < 300:
                updated_count += 1
            else:
                print(f"  Failed to update {name}: {u_resp.text}")
                
    print(f"Successfully reconciled {updated_count} students.")

if __name__ == "__main__":
    reconcile()
