import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vseombfkrvpffnpgbsnk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmYXppmGljZmNtZHducG1icHEiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc3MzkzNzQyMCwiZXhwIjoyMDg5NTEzNDIwfQ.FL-m1_ICd4zCplNqzR2wB3OEbJZ1g0P9U2lF0vEJPW4';
const supabase = createClient(supabaseUrl, supabaseKey);

// Get credentials from environment - NEVER use defaults in production
const MASTER_CREDENTIALS = {
  username: process.env.MASTER_USERNAME,
  password: process.env.MASTER_PASSWORD
};

const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME,
  password: process.env.ADMIN_PASSWORD
};

// Validate credentials are set (fail fast in production)
if (!MASTER_CREDENTIALS.username || !MASTER_CREDENTIALS.password || 
    MASTER_CREDENTIALS.username === 'CHANGE_ME' ||
    MASTER_CREDENTIALS.password === 'CHANGE_ME') {
  console.error('CRITICAL: Master credentials not configured. Set MASTER_USERNAME and MASTER_PASSWORD in .env');
}

// Session storage (in production, use Redis or database)
const sessions = new Map();

function generateToken() {
  return crypto.randomUUID();
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { action, username, password } = req.body;

      if (action === 'login') {
        // Validate input
        if (!username || !password) {
          return res.status(400).json({ error: 'Username and password required' });
        }

        // Check Master credentials
        if (username === MASTER_CREDENTIALS.username && password === MASTER_CREDENTIALS.password) {
          const token = generateToken();
          const session = { role: 'master', username, createdAt: Date.now() };
          sessions.set(token, session);

          return res.json({
            success: true,
            token,
            role: 'master',
            user: { name: 'Master', avatar: '👑' }
          });
        }

        // Check Admin credentials
        if (username.toLowerCase() === ADMIN_CREDENTIALS.username.toLowerCase() && 
            password === ADMIN_CREDENTIALS.password) {
          const token = generateToken();
          const session = { role: 'admin', username, createdAt: Date.now() };
          sessions.set(token, session);

          return res.json({
            success: true,
            token,
            role: 'admin',
            user: { name: 'Admin', avatar: 'Admin' }
          });
        }

        // Check Parent login - verify against student records
        const { data: students } = await supabase
          .from('students')
          .select('id, name, full_name, phone, parent_phone')
          .or('name.ilike.eq,full_name.ilike.eq')
          .limit(100);

        const student = students?.find(s => 
          (s.name?.toLowerCase() === username.toLowerCase()) || 
          (s.full_name?.toLowerCase() === username.toLowerCase())
        );

        if (student) {
          const storedPhone = student.parent_phone || student.phone;
          if (storedPhone === password) {
            const token = generateToken();
            const session = { 
              role: 'parent', 
              studentId: student.id,
              username, 
              createdAt: Date.now() 
            };
            sessions.set(token, session);

            return res.json({
              success: true,
              token,
              role: 'parent',
              user: { 
                name: student.name || student.full_name || 'Student',
                studentId: student.id
              }
            });
          }
        }

        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (action === 'logout') {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token && sessions.has(token)) {
          sessions.delete(token);
        }
        return res.json({ success: true });
      }

      if (action === 'verify') {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const session = sessions.get(token);
        
        if (!session) {
          return res.status(401).json({ error: 'Session expired' });
        }

        // Check session expiry (24 hours)
        if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
          sessions.delete(token);
          return res.status(401).json({ error: 'Session expired' });
        }

        return res.json({ valid: true, role: session.role });
      }

      return res.status(400).json({ error: 'Invalid action' });

    } catch (error) {
      console.error('Auth error:', error);
      return res.status(500).json({ error: 'Authentication failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}