const http = require('http');

function request(method, path, data) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body || '{}')));
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function run() {
    console.log('Adding Coach...');
    const coach = await request('POST', '/api/coaches', {
        name: 'Demo Coach Master',
        email: 'demo.coach@example.com',
        phone: '9998887776',
        specialization: 'Advanced Tactics',
        status: 'active'
    });
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
        const res = await request('POST', '/api/students', s);
        console.log('Student added:', res);
    }
    console.log('Done!');
}

run();
