// Quick debug - test API from browser console
(async () => {
  console.log('Testing API calls...');
  
  try {
    const headers = { 'Content-Type': 'application/json' };
    
    // Test students
    const studentsRes = await fetch('/api/students', { headers });
    const students = await studentsRes.json();
    console.log('Students API:', studentsRes.status, 'count:', students.length);
    
    // Test coaches  
    const coachesRes = await fetch('/api/coaches', { headers });
    const coaches = await coachesRes.json();
    console.log('Coaches API:', coachesRes.status, 'count:', coaches.length);
    
    console.log('\n=== RESULT ===');
    console.log('allStudents variable should be:', students.length);
    console.log('allCoaches variable should be:', coaches.length);
    
  } catch (e) {
    console.error('Error:', e);
  }
})();