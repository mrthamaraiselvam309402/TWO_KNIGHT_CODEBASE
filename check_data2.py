import requests
r = requests.get('https://chesskidoo-ai-admin.vercel.app/api/students')
students = r.json()

# Check session_mode field
print("Checking session_mode field:")
for s in students[:5]:
    print(f"{s.get('name')}: session_mode='{s.get('session_mode')}'")

# Check session_time field  
print("\nChecking session_time field:")
for s in students[:5]:
    print(f"{s.get('name')}: session_time='{s.get('session_time')}'")

# Count session modes properly
print("\nSession mode counts:")
session_modes = {}
for s in students:
    mode = s.get('session_mode', 'N/A')
    session_modes[mode] = session_modes.get(mode, 0) + 1
print(session_modes)

# Check status
print("\nStatus counts:")
status_counts = {}
for s in students:
    st = s.get('status', 'unknown')
    status_counts[st] = status_counts.get(st, 0) + 1
print(status_counts)