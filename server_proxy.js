import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Proxy /api requests to Supabase edge functions cleanly using standard middleware
app.use('/api', async (req, res) => {
  // Reconstruct the sub-path from req.originalUrl or req.url
  const subPath = req.originalUrl.substring(5); // Strips "/api/"
  const targetUrl = `https://zznbanjdkwofsvpzybtr.supabase.co/functions/v1/${subPath}`;
  console.log(`[Proxy] ${req.method} ${req.originalUrl} -> ${targetUrl}`);
  
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;

  try {
    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type');
    
    res.status(response.status);
    if (contentType) res.setHeader('content-type', contentType);

    const bodyText = await response.text();
    res.send(bodyText);
  } catch (err) {
    console.error(`[Proxy Error]`, err);
    res.status(500).send({ error: 'Proxy failed', details: err.message });
  }
});

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all fallback to index.html for SPA router (Express 5.x safe)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running at http://localhost:${PORT}`);
});
