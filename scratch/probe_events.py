import os
import requests

SUPABASE_URL = "https://vseombfkrvpffnpgbsnk.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

def probe_columns(table):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Prefer": "return=minimal"}
    # Send all possible variations to see which one fails
    payload = {
        "title": "Probe",
        "event_date": "2026-04-20",
        "date": "2026-04-20",
        "time": "10:00",
        "event_time": "10:00",
        "prize": "100",
        "prize_pool": "100",
        "max_participants": 10,
        "location": "Test"
    }
    r = requests.post(url, headers=headers, json=payload)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.text}")

print("--- Probing Events Schema ---")
probe_columns("events")
