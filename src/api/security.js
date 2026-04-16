import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vseombfkrvpffnpgbsnk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmYXppmGljZmNtZHducG1icHEiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzczOTM3NDIwLCJleHAiOjIwODk1MTM0MjB9.p7XQVJ0dTK1lXWlJAKXmVJ6bR9T3nJ8xL2vK5cY6hW_s';

export default async function handler(req, res) {
  const { action } = req.query;
  
  try {
    if (action === 'login') {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/security?action=login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }
    
    if (action === 'log_operation') {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/security?action=log_operation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }
    
    if (action === 'get_attempts') {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/security?action=get_attempts`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }
    
    if (action === 'get_operations') {
      const limit = req.query.limit || 100;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/security?action=get_operations&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }
    
    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Security API error:', error);
    return res.status(500).json({ error: error.message });
  }
}