import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import zohoPaymentInit from './api/_lib/zoho-init.js';
import zohoWebhook from './api/_lib/zoho-webhook.js';
import zohoPaymentStatus from './api/_lib/zoho-status.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// ─── Lichess Proxy ──────────────────────────────────────────────────────
// Merges /api/user/{username} (profile + perfs) with /api/user/{username}/rating-history
app.get('/api/lichess-proxy', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: 'username is required' });
  
  console.log(`[Lichess Proxy] Fetching data for: ${username}`);
  
   try {
     const headers = { 
       'Accept': 'application/json',
       'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
       'Accept-Encoding': 'gzip, deflate',
       'Accept-Language': 'en-US,en;q=0.9'
     };
     
      const [profileRes, historyRes] = await Promise.all([
        fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}`, { headers }),
        fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}/rating-history`, { headers })
      ]);
     
     if (!profileRes.ok) {
       const errorText = await profileRes.text().catch(() => 'Unknown error');
       console.error(`[Lichess Proxy] Profile fetch failed for ${username}:`, profileRes.status, profileRes.statusText, errorText);
       if (profileRes.status === 404) return res.json({ error: 'Lichess user not found', notFound: true });
       return res.status(profileRes.status).json({ error: 'Lichess user not found' });
     }
    
    const profile = await profileRes.json();
    const ratingHistory = historyRes.ok ? await historyRes.json() : [];
    
    // Build a clean response
    const result = {
      profile: profile,
      ratingHistory: ratingHistory
    };
    
    res.json(result);
  } catch (err) {
    console.error('[Lichess Proxy Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch Lichess data', details: err.message });
  }
});

// ─── Chess.com Stats Proxy ──────────────────────────────────────────────
// Fetches /pub/player/{username}/stats
app.get('/api/chesscom-proxy', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: 'username is required' });
  
  console.log(`[Chess.com Proxy] Fetching stats for: ${username}`);
  
  try {
    const headers = { 
      'Accept': 'application/json',
      'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)'
    };
    
    const [statsRes, profileRes] = await Promise.all([
      fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`, { headers }),
      fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}`, { headers })
    ]);
    
    if (!statsRes.ok) {
      if (statsRes.status === 404) return res.json({ error: 'Chess.com user not found', notFound: true });
      return res.status(statsRes.status).json({ error: 'Chess.com user not found' });
    }
    
    const stats = await statsRes.json();
    const profile = profileRes.ok ? await profileRes.json() : {};
    
    res.json({
      ...stats,
      ...profile
    });
  } catch (err) {
    console.error('[Chess.com Proxy Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch Chess.com data', details: err.message });
  }
});

// ─── Chess.com Games Proxy ──────────────────────────────────────────────
// Fetches the latest month's game archives
app.get('/api/chesscom-games-proxy', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: 'username is required' });
  
  console.log(`[Chess.com Games] Fetching games for: ${username}`);
  
  try {
    const headers = { 
      'Accept': 'application/json',
      'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)'
    };
    
    // Get list of archive months
    const archivesRes = await fetch(
      `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`,
      { headers }
    );
    
    if (!archivesRes.ok) {
      return res.status(archivesRes.status).json({ error: 'Could not fetch game archives' });
    }
    
    const archivesData = await archivesRes.json();
    const archives = archivesData.archives || [];
    
    if (archives.length === 0) {
      return res.json({ games: [] });
    }
    
    // Fetch the last 2 months of games for a richer view
    const recentArchives = archives.slice(-2);
    const allGames = [];
    
    for (const archiveUrl of recentArchives) {
      try {
        const gamesRes = await fetch(archiveUrl, { headers });
        if (gamesRes.ok) {
          const gamesData = await gamesRes.json();
          allGames.push(...(gamesData.games || []));
        }
      } catch (e) {
        console.warn('[Chess.com Games] Failed to fetch archive:', archiveUrl, e.message);
      }
    }
    
    // Return latest 20 games, simplified
    const simplified = allGames
      .sort((a, b) => (b.end_time || 0) - (a.end_time || 0))
      .slice(0, 20)
      .map(g => ({
        url: g.url,
        time_control: g.time_control,
        time_class: g.time_class,
        rated: g.rated,
        end_time: g.end_time,
        white: {
          username: g.white?.username,
          rating: g.white?.rating,
          result: g.white?.result,
        },
        black: {
          username: g.black?.username,
          rating: g.black?.rating,
          result: g.black?.result,
        }
      }));
    
    res.json({ games: simplified, total: allGames.length });
  } catch (err) {
    console.error('[Chess.com Games Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch Chess.com games', details: err.message });
  }
});

// ─── Lichess Games Proxy ─────────────────────────────────────────────────────
// Fetches recent games for a user from Lichess (NDJSON)
app.get('/api/lichess-games-proxy', async (req, res) => {
  const username = req.query.username;
  const max = parseInt(req.query.max) || 20;
  const perfType = req.query.perfType || '';
  if (!username) return res.status(400).json({ error: 'username is required' });

  console.log(`[Lichess Games] Fetching games for: ${username}`);

  try {
    const params = new URLSearchParams({ max: String(max), pgnInJson: 'true', opening: 'true' });
    if (perfType) params.set('perfType', perfType);

    const gamesRes = await fetch(
      `https://lichess.org/api/games/user/${encodeURIComponent(username)}?${params}`,
      { 
        headers: { 
          'Accept': 'application/x-ndjson',
          'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)'
        } 
      }
    );

    if (!gamesRes.ok) {
      return res.status(gamesRes.status).json({ error: 'Lichess games not found' });
    }

    const text = await gamesRes.text();
    const games = text.trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);

    res.json(games);
  } catch (err) {
    console.error('[Lichess Games Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch Lichess games', details: err.message });
  }
});

// ─── Lichess Extras Proxy ─────────────────────────────────────────────────────
// Fetches trophies and online status
app.get('/api/lichess-extras-proxy', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: 'username is required' });

  try {
    const headers = { 
      'Accept': 'application/json',
      'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)'
    };

    const [trophiesRes, statusRes] = await Promise.all([
      fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}/trophies`, { headers }),
      fetch(`https://lichess.org/api/users/status?ids=${encodeURIComponent(username)}`, { headers })
    ]);

    const trophies = trophiesRes.ok ? await trophiesRes.json() : [];
    const statusArr = statusRes.ok ? await statusRes.json() : [];
    const status = Array.isArray(statusArr) ? (statusArr[0] || {}) : {};

    res.json({ trophies: Array.isArray(trophies) ? trophies : [], status });
  } catch (err) {
    console.error('[Lichess Extras Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch Lichess extras', details: err.message });
  }
});

// ─── Chess.com Clubs Proxy ─────────────────────────────────────────────────────
// Fetches clubs and tournament history
app.get('/api/chesscom-clubs-proxy', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: 'username is required' });

  try {
    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)'
    };

    const [clubsRes, tournamentsRes] = await Promise.all([
      fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/clubs`, { headers }),
      fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/tournaments`, { headers })
    ]);

    const clubsData = clubsRes.ok ? await clubsRes.json() : { clubs: [] };
    const tournamentsData = tournamentsRes.ok ? await tournamentsRes.json() : { finished: [] };

    res.json({
      clubs: clubsData.clubs || [],
      tournaments: (tournamentsData.finished || []).slice(0, 10)
    });
  } catch (err) {
    console.error('[Chess.com Clubs Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch clubs/tournaments', details: err.message });
  }
});

// Mock Access Control for local development
app.use('/api/access_control', async (req, res) => {
  const method = req.method;
  
  if (method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (method === 'GET') {
    const mockUsers = [
      {
        id: '1',
        email: 'admin121@gmail.com',
        role: 'admin',
        created_at: '2024-01-15T10:00:00Z',
        last_sign_in_at: new Date().toISOString(),
        password_info: { source: 'Environment Variable', masked: 'Env Configured', visible: false }
      },
      {
        id: '2',
        email: 'coach.prahadheeshwar@academy.com',
        role: 'coach',
        created_at: '2024-06-01T08:00:00Z',
        last_sign_in_at: '2026-07-07T14:20:00Z',
        password_info: { source: 'Supabase Auth', masked: '●●●●●●●●', visible: false }
      },
      {
        id: '3',
        email: 'parent.aadhiseetha@gmail.com',
        role: 'parent',
        created_at: '2025-10-12T09:00:00Z',
        last_sign_in_at: '2026-07-06T18:45:00Z',
        password_info: { source: 'Custom (plaintext)', masked: '••••••••', visible: true, value: 'parent123' }
      }
    ];
    return res.json({ users: mockUsers });
  }

  if (method === 'POST') {
    const body = req.body || {};
    return res.status(200).json({ success: true, user: { id: Date.now().toString(), ...body } });
  }

  if (method === 'PUT') {
    const body = req.body || {};
    return res.status(200).json({ success: true, user: body });
  }

  if (method === 'DELETE') {
    const body = req.body || {};
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

// ─── Zoho Payments: run the real Vercel handlers locally ────────────────
// (must be mounted before the catch-all Supabase proxy below)
function adaptWebHandler(handler) {
  return async (req, res) => {
    try {
      const webReq = new Request(`http://localhost:${PORT}${req.originalUrl}`, {
        method: req.method,
        headers: req.headers,
        body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : JSON.stringify(req.body || {})
      });
      const webRes = await handler(webReq);
      res.status(webRes.status);
      webRes.headers.forEach((v, k) => res.setHeader(k, v));
      res.send(await webRes.text());
    } catch (e) {
      console.error('[Local Zoho handler]', e);
      res.status(500).json({ error: 'Local handler failed', details: e.message });
    }
  };
}
app.use('/api/zoho-payment-init', adaptWebHandler(zohoPaymentInit));
app.use('/api/zoho-webhook', adaptWebHandler(zohoWebhook));
app.use('/api/zoho-payment-status', adaptWebHandler(zohoPaymentStatus));

// Proxy /api requests to Supabase edge functions cleanly using standard middleware
app.use('/api', async (req, res) => {
  // Reconstruct the sub-path from req.originalUrl or req.url
  const subPath = req.originalUrl.replace(/^\/api/, '') || '/';
  const targetUrl = `https://zznbanjdkwofsvpzybtr.supabase.co/functions/v1${subPath}`;
  
  // Handle OPTIONS preflight for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }
  
  console.log(`[Proxy] ${req.method} ${req.originalUrl} -> ${targetUrl}`);
  
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers['content-length']; // Fixes fetch failed on POST with body

  try {
    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
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
