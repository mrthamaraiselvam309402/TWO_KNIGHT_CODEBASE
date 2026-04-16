import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vseombfkrvpffnpgbsnk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmYXppmGljZmNtZHducG1icHEiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzczOTM3NDIwLCJleHAiOjIwODk1MTM0MjB9.p7XQVJ0dTK1lXWlJAKXmVJ6bR9T3nJ8xL2vK5cY6hW_s';

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { id } = req.query;

    if (req.method === 'GET') {
      const { data, error } = await supabase.from('coaches').select('*').order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      const newCoach = {
        id: 'c' + Date.now(),
        name: b.name || '',
        email: b.email || '',
        phone: b.phone || '',
        specialization: b.specialization || '',
        experience: b.experience || 0,
        rating: b.rating || 0,
        bio: b.bio || '',
        status: b.status || 'active',
        hourly_rate: b.hourly_rate || 0,
        availability: b.availability || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('coaches').insert(newCoach).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'ID required' });
      
      const b = req.body || {};
      const updateData = { ...b, updated_at: new Date().toISOString() };
      delete updateData.id;
      delete updateData.created_at;
      
      const { data, error } = await supabase.from('coaches').update(updateData).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ message: 'Updated', data });
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'ID required' });
      
      const { error } = await supabase.from('coaches').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ message: 'Deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Coaches API error:', error);
    return res.status(500).json({ error: error.message });
  }
}