import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Adding Coach...');
    const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .insert({
            name: 'Demo Coach Master',
            email: 'demo.coach@example.com',
            phone: '9998887776',
            specialization: 'Advanced Tactics',
            status: 'active'
        })
        .select()
        .single();
        
    if (coachError) {
        console.error('Failed to add coach:', coachError);
        return;
    }
    console.log('Coach added:', coach.id);
    
    const students = [
        { name: 'Demo Student 1', parent_name: 'Parent 1', phone: '1111111111', level: 'Beginner', monthly_fee: 1000, coach_id: coach.id, status: 'enrolled', current_rating: 400 },
        { name: 'Demo Student 2', parent_name: 'Parent 2', phone: '2222222222', level: 'Intermediate', monthly_fee: 1500, coach_id: coach.id, status: 'enrolled', current_rating: 800 },
        { name: 'Demo Student 3', parent_name: 'Parent 3', phone: '3333333333', level: 'Advanced', monthly_fee: 2000, coach_id: coach.id, status: 'enrolled', current_rating: 1200 },
        { name: 'Demo Student 4', parent_name: 'Parent 4', phone: '4444444444', level: 'Master', monthly_fee: 2500, coach_id: coach.id, status: 'enrolled', current_rating: 1600 }
    ];
    
    for (let s of students) {
        console.log('Adding student:', s.name);
        const { data, error } = await supabase.from('students').insert(s).select();
        if (error) console.error('Student error:', error);
        else console.log('Student added:', data[0].id);
    }
    console.log('Done!');
}
run();
