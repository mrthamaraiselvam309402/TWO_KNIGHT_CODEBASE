import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vseombfkrvpffnpgbsnk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmYXppmGljZmNtZHducG1icHEiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzczOTM3NDIwLCJleHAiOjIwODk1MTM0MjB9.p7XQVJ0dTK1lXWlJAKXmVJ6bR9T3nJ8xL2vK5cY6hW_s';

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const [studentsRes, coachesRes, achievementsRes, eventsRes] = await Promise.all([
      supabase.from('students').select('*').order('created_at', { ascending: false }),
      supabase.from('coaches').select('*').order('created_at', { ascending: false }),
      supabase.from('achievements').select('*').order('created_at', { ascending: false }),
      supabase.from('events').select('*').order('created_at', { ascending: false })
    ]);

    return res.status(200).json({
      students: studentsRes.data || [],
      coaches: coachesRes.data || [],
      achievements: achievementsRes.data || [],
      events: eventsRes.data || [],
      message: 'Hello from Chesskidoo API!'
    });
  } catch (error) {
    console.error('Hello API error:', error);
    return res.status(500).json({ error: error.message });
  }
}