const fs = require('fs');
let envContent = fs.readFileSync('public/index.html', 'utf-8');
const tokenMatch = envContent.match(/SUPABASE_ANON_KEY[\s'\"=]*([^'\"]+)/);
const urlMatch = envContent.match(/SUPABASE_URL[\s'\"=]*([^'\"]+)/);
const token = tokenMatch ? tokenMatch[1] : '';
const url = urlMatch ? urlMatch[1] : '';

async function updateDB() {
    if(!token || !url) return console.log('Missing env');
    const res = await fetch(url + '/rest/v1/students?select=id,name,learning_mode', {
        headers: { 'apikey': token, 'Authorization': 'Bearer ' + token }
    });
    const students = await res.json();
    const offlineNames = ['banu priya', 'mansa', 'prajesh', 'saranya'];
    for(const s of students) {
        const isOffline = offlineNames.some(n => (s.name || '').toLowerCase().includes(n));
        const mode = isOffline ? 'offline' : 'online';
        if (s.learning_mode !== mode) {
            console.log('Updating ' + s.name + ' to ' + mode);
            await fetch(url + '/rest/v1/students?id=eq.' + s.id, {
                method: 'PATCH',
                headers: { 'apikey': token, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ learning_mode: mode })
            });
        }
    }
    console.log('Done.');
}
updateDB();
