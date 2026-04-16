const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3011;

// Load environment variables
require('dotenv').config();

// Supabase configuration with fallbacks
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vseombfkrvpffnpgbsnk.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzkzNzQyMCwiZXhwIjoyMDg5NTEzNDIwfQ.SUkFrfUnzbm_IZveqVfGvS31wFZR7fggEVo8RVPiNj8';

// Use anon key for public requests, service role for admin operations
const supabaseUrl = SUPABASE_URL;
const supabaseKey = SUPABASE_ANON_KEY;  // Public reads/writes
const supabaseAdminKey = SUPABASE_SERVICE_ROLE_KEY;  // Admin-only operations

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// STUDENTS
app.get('/api/students', async (req, res) => {
  const https = require('https');
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/students',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + supabaseKey }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    clientReq.on('error', reject);
    clientReq.end();
  });
  res.json(JSON.parse(data));
});

app.post('/api/students', async (req, res) => {
  const body = JSON.stringify(req.body);
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/students',
    method: 'POST',
    headers: { 
      'Authorization': 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
      'Content-Length': body.length
    }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  res.json(JSON.parse(data));
});

app.put('/api/students', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'ID required' });
  const body = JSON.stringify(req.body);
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/students?id=' + id,
    method: 'POST',
    headers: { 
      'Authorization': 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
      'Content-Length': body.length
    }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  res.json({ message: 'Updated', data: JSON.parse(data) });
});

app.delete('/api/students', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'ID required' });
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/students?id=' + id,
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + supabaseKey }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    clientReq.on('error', reject);
    clientReq.end();
  });
  res.json({ message: 'Deleted', success: true });
});

// COACHES
app.get('/api/coaches', async (req, res) => {
  const https = require('https');
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/coaches',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + supabaseKey }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    clientReq.on('error', reject);
    clientReq.end();
  });
  res.json(JSON.parse(data));
});

app.post('/api/coaches', async (req, res) => {
  const body = JSON.stringify(req.body);
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/coaches',
    method: 'POST',
    headers: { 
      'Authorization': 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
      'Content-Length': body.length
    }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  res.json(JSON.parse(data));
});

app.put('/api/coaches', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'ID required' });
  const body = JSON.stringify(req.body);
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/coaches?id=' + id,
    method: 'POST',
    headers: { 
      'Authorization': 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
      'Content-Length': body.length
    }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  res.json({ message: 'Updated', data: JSON.parse(data) });
});

app.delete('/api/coaches', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'ID required' });
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/coaches?id=' + id,
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + supabaseKey }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    clientReq.on('error', reject);
    clientReq.end();
  });
  res.json({ message: 'Deleted', success: true });
});

// EVENTS
app.get('/api/events', async (req, res) => {
  const https = require('https');
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/events',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + supabaseKey }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    clientReq.on('error', reject);
    clientReq.end();
  });
  res.json(JSON.parse(data));
});

app.post('/api/events', async (req, res) => {
  const body = JSON.stringify(req.body);
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/events',
    method: 'POST',
    headers: { 
      'Authorization': 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
      'Content-Length': body.length
    }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  res.json(JSON.parse(data));
});

app.put('/api/events', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'ID required' });
  const body = JSON.stringify(req.body);
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/events?id=' + id,
    method: 'POST',
    headers: { 
      'Authorization': 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
      'Content-Length': body.length
    }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  res.json({ message: 'Updated', data: JSON.parse(data) });
});

app.delete('/api/events', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'ID required' });
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/events?id=' + id,
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + supabaseKey }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    clientReq.on('error', reject);
    clientReq.end();
  });
  res.json({ message: 'Deleted', success: true });
});

// ACHIEVEMENTS
app.get('/api/achievements', async (req, res) => {
  const https = require('https');
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/achievements',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + supabaseKey }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    clientReq.on('error', reject);
    clientReq.end();
  });
  res.json(JSON.parse(data));
});

app.post('/api/achievements', async (req, res) => {
  const body = JSON.stringify(req.body);
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/achievements',
    method: 'POST',
    headers: { 
      'Authorization': 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
      'Content-Length': body.length
    }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  res.json(JSON.parse(data));
});

app.delete('/api/achievements', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'ID required' });
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/achievements?id=' + id,
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + supabaseKey }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    clientReq.on('error', reject);
    clientReq.end();
  });
  res.json({ message: 'Deleted', success: true });
});

// PAYMENTS
app.get('/api/payments', async (req, res) => {
  const https = require('https');
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/payments',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + supabaseKey }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    clientReq.on('error', reject);
    clientReq.end();
  });
  res.json(JSON.parse(data));
});

app.post('/api/payments', async (req, res) => {
  const body = JSON.stringify(req.body);
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/payments',
    method: 'POST',
    headers: { 
      'Authorization': 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
      'Content-Length': body.length
    }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  res.json(JSON.parse(data));
});

// MESSAGES
app.get('/api/messages', async (req, res) => {
  const https = require('https');
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/messages',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + supabaseKey }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    clientReq.on('error', reject);
    clientReq.end();
  });
  res.json({ data: JSON.parse(data) });
});

app.post('/api/messages', async (req, res) => {
  const body = JSON.stringify(req.body);
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    path: '/functions/v1/messages',
    method: 'POST',
    headers: { 
      'Authorization': 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
      'Content-Length': body.length
    }
  };
  let data = '';
  await new Promise((resolve, reject) => {
    const clientReq = https.request(options, (r) => {
      r.on('data', chunk => data += chunk);
      r.on('end', resolve);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  res.json(JSON.parse(data));
});

// Static files
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
  console.log('Available endpoints:');
  console.log('  GET/POST /api/students');
  console.log('  PUT/DELETE /api/students?id=...');
  console.log('  GET/POST /api/coaches');
  console.log('  GET/POST /api/events');
  console.log('  GET/POST /api/achievements');
  console.log('  GET/POST /api/payments');
  console.log('  GET/POST /api/messages');
});