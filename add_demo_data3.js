async function run() {
    try {
        console.log('Logging in...');
        const loginRes = await fetch('http://localhost:3000/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'master' })
        });
        
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log('Got token:', token ? 'Yes' : 'No');
        
        if (!token) return;
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        };
        
        const coachRes = await fetch('http://localhost:3000/api/coaches', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                name: 'Demo Coach Master',
                email: 'demo.coach@example.com',
                phone: '9998887776',
                specialization: 'Advanced Tactics',
                status: 'active'
            })
        });
        const coach = await coachRes.json();
        console.log('Coach added:', coach.id || coach.error);
        
        if (!coach || !coach.id) return;
        
        const students = [
            { name: 'Demo Student 1', parent_name: 'Parent 1', phone: '1111111111', level: 'Beginner', monthly_fee: 1000, coach_id: coach.id, status: 'enrolled', current_rating: 400 },
            { name: 'Demo Student 2', parent_name: 'Parent 2', phone: '2222222222', level: 'Intermediate', monthly_fee: 1500, coach_id: coach.id, status: 'enrolled', current_rating: 800 },
            { name: 'Demo Student 3', parent_name: 'Parent 3', phone: '3333333333', level: 'Advanced', monthly_fee: 2000, coach_id: coach.id, status: 'enrolled', current_rating: 1200 },
            { name: 'Demo Student 4', parent_name: 'Parent 4', phone: '4444444444', level: 'Master', monthly_fee: 2500, coach_id: coach.id, status: 'enrolled', current_rating: 1600 }
        ];
        
        for (let s of students) {
            const res = await fetch('http://localhost:3000/api/students', {
                method: 'POST',
                headers,
                body: JSON.stringify(s)
            });
            const data = await res.json();
            console.log('Student added:', data.id || data.error);
        }
        console.log('Done!');
    } catch (e) {
        console.error('Error:', e);
    }
}
run();
