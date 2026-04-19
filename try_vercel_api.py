import requests

# Use Vercel API endpoint which proxies to Supabase edge function
# The edge function runs with service role key, so it can bypass RLS

URL = "https://chesskidoo-ai-admin.vercel.app/api/students"

# First let's check if this endpoint exists and works
r = requests.get(URL)
print("GET Status:", r.status_code)
print("GET Response:", r.text[:300])

# Now try POST through Vercel proxy
headers = {'Content-Type': 'application/json'}
student_data = {
    "name": "TEST STUDENT",
    "grade": "Beginner",
    "notes": "fee:1000",
    "status": "pending",
    "rating": 800
}

r2 = requests.post(URL, headers=headers, json=student_data)
print("\nPOST Status:", r2.status_code)
print("POST Response:", r2.text[:500])