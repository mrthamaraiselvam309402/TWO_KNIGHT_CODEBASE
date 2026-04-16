import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3001;

const supabaseUrl = process.env.SUPABASE_URL || 'https://vseombfkrvpffnpgbsnk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzkzNzQyMCwiZXhwIjoyMDg5NTEzNDIwfQ.SUkFrfUnzbm_IZveqVfGvS31wFZR7fggEVo8RVPiNj8';

async function supabaseFetch(endpoint, options = {}) {
  const url = `${supabaseUrl}/functions/v1/${endpoint}`;
  console.log('Fetching:', url);
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: options.body
  });
  const data = await res.json();
  console.log('Got data:', JSON.stringify(data).substring(0, 100));
  return data;
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Debug middleware
app.use((req, res, next) => {
  console.log('Request:', req.method, req.url);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Test route
app.get('/test', (req, res) => {
  res.json({ test: 'works' });
});

// Students API
app.get('/api/students', async (req, res) => {
  const { execSync } = await import('child_process');
  try {
    const cmd = `curl -s "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students" -H "Authorization: Bearer ${supabaseKey}"`;
    const output = execSync(cmd, { encoding: 'utf8' });
    const data = JSON.parse(output);
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const body = req.body;
    const { spawn } = await import('child_process');
    const dataStr = JSON.stringify(body).replace(/"/g, '\\"');
    const p = spawn('curl', ['-s', '-X', 'POST', 
      'https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students',
      '-H', `Authorization: Bearer ${supabaseKey}`,
      '-H', 'Content-Type: application/json',
      '-d', dataStr]);
    let result = '';
    p.stdout.on('data', d => result += d);
    p.on('close', () => res.status(201).json(JSON.parse(result)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/students', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }
    const body = req.body;
    console.log('PUT /api/students body:', JSON.stringify(body));
    const data = await supabaseFetch(`students?id=${id}`, { method: 'POST', body: JSON.stringify(body) });
    console.log('Student update result:', data);
    res.json({ message: 'Updated', data });
  } catch (err) {
    console.error('Students PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/students', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }
    const data = await supabaseFetch(`students?id=${id}`, { method: 'DELETE' });
    res.json({ message: 'Deleted', success: true });
  } catch (err) {
    console.error('Students DELETE error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Coaches API
app.get('/api/coaches', async (req, res) => {
  try {
    const data = await supabaseFetch('coaches');
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/coaches', async (req, res) => {
  try {
    const body = req.body;
    console.log('POST /api/coaches:', JSON.stringify(body));
    const data = await supabaseFetch('coaches', { method: 'POST', body: JSON.stringify(body) });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/coaches', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    const body = req.body;
    console.log('PUT /api/coaches:', JSON.stringify(body));
    const data = await supabaseFetch(`coaches?id=${id}`, { method: 'POST', body: JSON.stringify(body) });
    res.json({ message: 'Updated', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/coaches', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    const data = await supabaseFetch(`coaches?id=${id}`, { method: 'DELETE' });
    res.json({ message: 'Deleted', success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Events API
app.get('/api/events', async (req, res) => {
  try {
    const data = await supabaseFetch('events');
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const body = req.body;
    const data = await supabaseFetch('events', { method: 'POST', body: JSON.stringify(body) });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    const body = req.body;
    const data = await supabaseFetch(`events?id=${id}`, { method: 'POST', body: JSON.stringify(body) });
    res.json({ message: 'Updated', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/events', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    const data = await supabaseFetch(`events?id=${id}`, { method: 'DELETE' });
    res.json({ message: 'Deleted', success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const body = req.body;
    console.log('POST /api/events:', JSON.stringify(body));
    const data = await supabaseFetch('events', { method: 'POST', body: JSON.stringify(body) });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    const body = req.body;
    const data = await supabaseFetch(`events?id=${id}`, { method: 'POST', body: JSON.stringify(body) });
    res.json({ message: 'Updated', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/events', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    const data = await supabaseFetch(`events?id=${id}`, { method: 'DELETE' });
    res.json({ message: 'Deleted', success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Achievements API
app.get('/api/achievements', async (req, res) => {
  try {
    const data = await supabaseFetch('achievements');
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/achievements', async (req, res) => {
  try {
    const body = req.body;
    const data = await supabaseFetch('achievements', { method: 'POST', body: JSON.stringify(body) });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/achievements', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    const data = await supabaseFetch(`achievements?id=${id}`, { method: 'DELETE' });
    res.json({ message: 'Deleted', success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const body = req.body;
    const eventData = {
      id: 'e' + Date.now(),
      title: body.title || 'Event',
      description: body.description || null,
      event_date: body.event_date || body.date || new Date().toISOString().split('T')[0],
      date: body.date || body.event_date || new Date().toISOString().split('T')[0],
      event_time: body.event_time || body.time || null,
      time: body.time || body.event_time || null,
      location: body.location || null,
      type: body.type || body.event_type || 'Tournament',
      event_type: body.event_type || body.type || 'Tournament',
      status: body.status || 'upcoming',
      max_participants: body.max_participants ? parseInt(body.max_participants) : 50,
      current_participants: 0,
      prize: body.prize || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('Inserting event:', JSON.stringify(eventData));
    
    const { data, error } = await supabase
      .from('events')
      .insert(eventData)
      .select()
      .single();
    
    if (error) {
      console.error('Events POST error:', error);
      return res.status(500).json({ error: error.message, details: error });
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    
    const body = req.body;
    console.log('PUT /api/events body:', JSON.stringify(body));
    
    const updateData = {
      title: body.title || null,
      description: body.description || null,
      event_date: body.event_date || body.date || null,
      date: body.date || body.event_date || null,
      event_time: body.event_time || body.time || null,
      time: body.time || body.event_time || null,
      location: body.location || null,
      type: body.type || body.event_type || null,
      event_type: body.event_type || body.type || null,
      status: body.status || null,
      max_participants: body.max_participants ? parseInt(body.max_participants) : null,
      current_participants: body.current_participants ? parseInt(body.current_participants) : null,
      prize: body.prize || null,
      updated_at: new Date().toISOString()
    };
    
    console.log('PUT updateData:', JSON.stringify(updateData));
    
    const { data, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Events PUT error:', error);
      return res.status(500).json({ error: error.message, details: error });
    }
    res.json({ message: 'Updated', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/events', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    
    console.log('DELETE /api/events id:', id);
    
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Events DELETE error:', error);
      return res.status(500).json({ error: error.message, details: error });
    }
    res.json({ message: 'Deleted', success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Achievements API
app.get('/api/achievements', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/achievements', async (req, res) => {
  try {
    const body = req.body;
    const achievementData = {
      id: 'a' + Date.now(),
      student_id: body.student_id || null,
      title: body.title || 'Achievement',
      description: body.description || null,
      image_url: body.image_url || body.img_url || null,
      img_url: body.img_url || body.image_url || null,
      created_at: new Date().toISOString()
    };
    
    console.log('Inserting achievement:', JSON.stringify(achievementData));
    
    const { data, error } = await supabase
      .from('achievements')
      .insert(achievementData)
      .select()
      .single();
    
    if (error) {
      console.error('Achievements POST error:', error);
      return res.status(500).json({ error: error.message, details: error });
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/achievements', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    
    console.log('DELETE /api/achievements id:', id);
    
    const { error } = await supabase
      .from('achievements')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Achievements DELETE error:', error);
      return res.status(500).json({ error: error.message, details: error });
    }
    res.json({ message: 'Deleted', success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Payments API
app.get('/api/payments', async (req, res) => {
  try {
    const data = await supabaseFetch('payments');
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    const body = req.body;
    const data = await supabaseFetch('payments', { method: 'POST', body: JSON.stringify(body) });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Messages API
app.get('/api/messages', async (req, res) => {
  try {
    const data = await supabaseFetch('messages');
    res.json({ data: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const body = req.body;
    const data = await supabaseFetch('messages', { method: 'POST', body: JSON.stringify(body) });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/messages', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    const data = await supabaseFetch(`messages?id=${id}`, { method: 'DELETE' });
    res.json({ message: 'Deleted', success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI API (simple response)
app.post('/api/ai', async (req, res) => {
  try {
    const body = req.body;
    const message = body.message || '';
    
    // Simple responses
    const responses = {
      'hello': 'Hello! How can I help you with chess training today?',
      'help': 'I can help you with: student management, coach scheduling, payments, and chess training tips.',
      'default': 'Thank you for your message! Our team will get back to you soon.'
    };
    
    const lowerMsg = message.toLowerCase();
    let response = responses.default;
    
    for (const key of Object.keys(responses)) {
      if (lowerMsg.includes(key)) {
        response = responses[key];
        break;
      }
    }
    
    res.json({ message: response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auth API (simple login)
app.post('/api/auth', async (req, res) => {
  try {
    const body = req.body;
    const { action, username, password } = body;
    
    if (action === 'login') {
      // Simple credential check (in production, use proper auth)
      if (username === 'admin' && password === 'admin123') {
        res.json({ success: true, token: 'admin-token', role: 'admin' });
      } else if (username === 'Tom@193' && password === 'Thamaraiselvam@309402$') {
        res.json({ success: true, token: 'master-token', role: 'master' });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      res.json({ error: 'Unknown action' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hello API (summary endpoint)
app.get('/api/hello', async (req, res) => {
  try {
    const [students, coaches, achievements, events] = await Promise.all([
      supabase.from('students').select('*'),
      supabase.from('coaches').select('*'),
      supabase.from('achievements').select('*'),
      supabase.from('events').select('*')
    ]);
    
    res.json({
      students: students.data || [],
      coaches: coaches.data || [],
      achievements: achievements.data || [],
      events: events.data || [],
      message: 'Chesskidoo API Working!'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Static files (served last)
app.use(express.static('public'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.url });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Chesskidoo Server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   API endpoints:`);
  console.log(`   - GET/POST /api/students`);
  console.log(`   - GET/POST /api/coaches`);
  console.log(`   - GET/POST /api/events`);
  console.log(`   - GET/POST /api/achievements`);
  console.log(`   - GET/POST /api/payments`);
  console.log(`   - GET/POST /api/messages`);
  console.log(`   - POST /api/ai`);
  console.log(`   - POST /api/auth`);
  console.log(`   - GET /api/hello`);
});

export default app;