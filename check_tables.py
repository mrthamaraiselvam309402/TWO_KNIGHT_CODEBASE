import requests
import json
import os

# Load from .env
SUPABASE_URL = "https://vseombfkrvpffnpgbsnk.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json'
}

# Step 1: Check current students table structure
print("=== Checking students table structure ===")
r = requests.get(f'{SUPABASE_URL}/rest/v1/students?select=*&limit=1', headers=headers)
if r.status_code == 200:
    if r.json():
        print("Students columns:", list(r.json()[0].keys()))
    else:
        print("No students found")
else:
    print("Error:", r.text)

print("\n=== Checking website_students_import table structure ===")
r2 = requests.get(f'{SUPABASE_URL}/rest/v1/website_students_import?select=*&limit=1', headers=headers)
if r2.status_code == 200:
    if r2.json():
        print("Import columns:", list(r2.json()[0].keys()))
    else:
        print("No import records found")
else:
    print("Error:", r2.text)

# Get all students to see current data
print("\n=== Current students data (first 5) ===")
r3 = requests.get(f'{SUPABASE_URL}/rest/v1/students?select=full_name,notes,session_mode,batch_time,payment_status,monthly_fee&limit=5', headers=headers)
if r3.status_code == 200:
    for s in r3.json():
        print(s)