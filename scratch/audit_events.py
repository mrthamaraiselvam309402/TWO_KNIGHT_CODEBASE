import os
import requests

SUPABASE_URL = "https://vseombfkrvpffnpgbsnk.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

def list_columns(table):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit=1"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        data = r.json()
        if data:
            print(f"Columns for {table}: {list(data[0].keys())}")
        else:
            print(f"Table {table} is empty. Trying to find columns via POST dummy...")
            # We can't easily find columns for empty tables without schema inspection or dummy insert (risky)
            # But let's check the Error message if we send a wrong column
            dummy_url = f"{SUPABASE_URL}/rest/v1/{table}"
            r2 = requests.post(dummy_url, headers=headers, json={"WRONG_COLUMN": "test"})
            print(f"Post error (useful for schema info): {r2.text}")
    else:
        print(f"Error {r.status_code}: {r.text}")

list_columns("events")
list_columns("internal_tournaments")
