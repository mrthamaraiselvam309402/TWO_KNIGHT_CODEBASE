import os
import requests
import json

SUPABASE_URL = "https://vseombfkrvpffnpgbsnk.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

def check_columns(table_name):
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?select=*&limit=1"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        data = r.json()
        if data:
            print(f"Columns for {table_name}: {list(data[0].keys())}")
        else:
            print(f"Table {table_name} is empty.")
    else:
        print(f"Error {r.status_code} checking {table_name}: {r.text}")

print("--- Column Audit ---")
check_columns("coaches")
check_columns("events")
check_columns("students")
check_columns("achievements")
