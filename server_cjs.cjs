const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

const supabaseUrl = 'https://vseombfkrvpffnpgbsnk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzkzNzQyMCwiZXhwIjoyMDg5NTEzNDIwfQ.SUkFrfUnzbm_IZveqVfGvS31wFZR7fggEVo8RVPiNj8';

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/students', async (req, res) => {
  try {
    const https = require('https');
    const url = supabaseUrl + '/functions/v1/students';
    const options = {
      hostname: new URL(url).hostname,
      path: new URL(url).pathname,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + supabaseKey }
    };
    let data = '';
    await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        res.on('data', chunk => data += chunk);
        res.on('end', resolve);
      });
      req.on('error', reject);
      req.end();
    });
    res.json(JSON.parse(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const https = require('https');
    const url = supabaseUrl + '/functions/v1/students';
    const body = JSON.stringify(req.body);
    const options = {
      hostname: new URL(url).hostname,
      path: new URL(url).pathname,
      method: 'POST',
      headers: { 
        'Authorization': 'Bearer ' + supabaseKey,
        'Content-Type': 'application/json',
        'Content-Length': body.length
      }
    };
    let data = '';
    await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        res.on('data', chunk => data += chunk);
        res.on('end', resolve);
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    res.json(JSON.parse(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log('Server on', PORT);
});
