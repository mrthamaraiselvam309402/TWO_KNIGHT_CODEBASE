async function run() {
    try {
        console.log('Adding Coach...');
        const coachRes = await fetch('http://localhost:3000/api/coaches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'master' },
            body: JSON.stringify({
                name: 'Demo Coach Master',
                email: 'demo.coach@example.com',
                phone: '9998887776',
                specialization: 'Advanced Tactics',
                status: 'active'
            })
        });
        const coach = await coachRes.json();
        console.log('Coach added:', coach);
        
        if (!coach || !coach.id) {
            console.error('Failed to add coach');
            return;
        }
        
        const students = [
            { name: 'Demo Student 1', parent_name: 'Parent 1', phone: '1111111111', level: 'Beginner', monthly_fee: 1000, coach_id: coach.id, status: 'enrolled', current_rating: 400 },
            { name: 'Demo Student 2', parent_name: 'Parent 2', phone: '2222222222', level: 'Intermediate', monthly_fee: 1500, coach_id: coach.id, status: 'enrolled', current_rating: 800 },
            { name: 'Demo Student 3', parent_name: 'Parent 3', phone: '3333333333', level: 'Advanced', monthly_fee: 2000, coach_id: coach.id, status: 'enrolled', current_rating: 1200 },
            { name: 'Demo Student 4', parent_name: 'Parent 4', phone: '4444444444', level: 'Master', monthly_fee: 2500, coach_id: coach.id, status: 'enrolled', current_rating: 1600 }
        ];
        
        for (let s of students) {
            console.log('Adding student:', s.name);
            const res = await fetch('http://localhost:3000/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'master' },
                body: JSON.stringify(s)
            });
            console.log('Student added:', await res.json());
        }
        console.log('Done!');
    } catch (e) {
        console.error('Error:', e);
    }
}
run();
