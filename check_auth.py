import requests
import json

# Try using Vercel's API route (edge function) instead of direct Supabase REST
# The website uses /api/students which goes through Vercel's edge functions

URL = "https://chesskidoo-ai-admin.vercel.app/api/students"

# This won't work since it's a server-side function
# Let's try the edge function approach

# Actually, let's check the Supabase URL with proper RLS disabled or service role
# The anon key should work for read, but may need service key for write

URL = "https://vseombfkrvpffnpgbsnk.supabase.co"
# Try with service role key - but we don't have that

# Let's try a different approach - update the anon key with proper permissions
# First check what the actual API response looks like

# Try GET first to see if read works
headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8'
}

# Check the actual error message
r = requests.get(f'{URL}/rest/v1/students?limit=1', headers=headers)
print("GET Status:", r.status_code)
print("GET Response:", r.text[:500])

# Try POST with same headers
r2 = requests.post(f'{URL}/rest/v1/students', headers=headers, json={"name": "Test", "grade": "Beginner"})
print("\nPOST Status:", r2.status_code)
print("POST Response:", r2.text[:500])