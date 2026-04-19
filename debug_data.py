import requests
r = requests.get('https://chesskidoo-ai-admin.vercel.app/api/students')
students = r.json()
print('Total students:', len(students))
print('Sample students:')
for s in students[:3]:
    print(f"  Name: {s.get('name')}, coach_id: {s.get('coach_id')}, grade: {s.get('grade')}")
    
print('\nChecking coaches:')
r2 = requests.get('https://chesskidoo-ai-admin.vercel.app/api/coaches')
coaches = r2.json()
print('Total coaches:', len(coaches))
for c in coaches[:3]:
    print(f"  Name: {c.get('name')}, id: {c.get('id')}")