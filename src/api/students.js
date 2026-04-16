import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vseombfkrvpffnpgbsnk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmYXppmGljZmNtZHducG1icHEiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzczOTM3NDIwLCJleHAiOjIwODk1MTM0MjB9.p7XQVJ0dTK1lXWlJAKXmVJ6bR9T3nJ8xL2vK5cY6hW_s';

const supabase = createClient(supabaseUrl, supabaseKey);

// Input validation functions
function sanitizeString(str, maxLength = 255) {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLength).replace(/[<>]/g, '');
}

function validateEmail(email) {
  if (!email) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? email.toLowerCase() : null;
}

function validatePhone(phone) {
  if (!phone) return '';
  const phoneRegex = /^\d{10,15}$/;
  return phone.replace(/\D/g, '').slice(0, 15);
}

function validateAge(age) {
  const num = parseInt(age);
  return (num >= 4 && num <= 18) ? num : null;
}

function validateStudentInput(body) {
  const errors = [];
  
  if (!body.name || body.name.trim().length < 2) {
    errors.push('Name is required (min 2 characters)');
  }
  if (body.name && body.name.length > 100) {
    errors.push('Name too long (max 100 characters)');
  }
  if (body.email && !validateEmail(body.email)) {
    errors.push('Invalid email format');
  }
  if (body.phone && !validatePhone(body.phone)) {
    errors.push('Invalid phone format (10-15 digits)');
  }
  if (body.age && !validateAge(body.age)) {
    errors.push('Invalid age (must be 4-18)');
  }
  
  return errors;
}

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
      const { data, error } = await supabase.from('students').select('*').order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      
      // Validate input
      const validationErrors = validateStudentInput(b);
      if (validationErrors.length > 0) {
        return res.status(400).json({ error: validationErrors.join(', ') });
      }
      
      const newStudent = {
        id: 's' + Date.now() + Math.random().toString(36).slice(2, 8),
        name: sanitizeString(b.name, 100),
        email: validateEmail(b.email),
        phone: validatePhone(b.phone || b.parent_phone),
        age: validateAge(b.age),
        grade: sanitizeString(b.grade || 'Beginner', 50),
        parent_name: sanitizeString(b.parent_name, 100),
        parent_phone: validatePhone(b.parent_phone || b.phone),
        address: sanitizeString(b.address, 500),
        enrollment_date: b.enrollment_date || b.join_date || new Date().toISOString().split('T')[0],
        status: 'active',
        coach_id: b.coach_id || null,
        rating: parseInt(b.rating) || 0,
        notes: sanitizeString(b.notes || b.bio, 2000),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('students').insert(newStudent).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'ID required' });
      
      const b = req.body || {};
      const updateData = { ...b, updated_at: new Date().toISOString() };
      delete updateData.id;
      delete updateData.created_at;
      
      const { data, error } = await supabase.from('students').update(updateData).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ message: 'Updated', data });
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'ID required' });
      
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ message: 'Deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Students API error:', error);
    return res.status(500).json({ error: error.message });
  }
}