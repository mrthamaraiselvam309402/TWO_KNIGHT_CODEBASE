const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());

const CHESS_API_TIMEOUT = 15000;

function createAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

async function handleLichessProxy(username) {
  const { signal, clear } = createAbortSignal(CHESS_API_TIMEOUT);
  try {
    let profile = null;
    let ratingHistory = [];
    let profileOk = false;

    const profileRes = await fetch(
      `https://lichess.org/api/user/${encodeURIComponent(username)}`,
      { 
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)',
          'Accept-Language': 'en-US,en;q=0.9'
        }, 
        signal 
      }
    ).catch((e) => {
      console.error(`[Lichess Proxy] Fetch threw for ${username}:`, e.message);
      return { ok: false, _error: e.message };
    });

    if (profileRes && profileRes.ok) {
      try { profile = await profileRes.json(); profileOk = true; } catch { profile = null; }
    } else if (profileRes) {
      const errorText = await profileRes.text().catch(() => '');
      console.error(`[Lichess Proxy] Profile fetch failed for ${username}:`, profileRes.status, profileRes.statusText, errorText);
    }

    const historyRes = await fetch(
      `https://lichess.org/api/user/${encodeURIComponent(username)}/rating-history`,
      { 
        headers: { 
          'Accept': 'application/x-ndjson',
          'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)',
          'Accept-Language': 'en-US,en;q=0.9'
        }, 
        signal 
      }
    ).catch((e) => {
      console.error(`[Lichess Proxy] History fetch threw for ${username}:`, e.message);
      return { ok: false, _error: e.message };
    });

    if (historyRes && historyRes.ok) {
      // rating-history returns a plain JSON array, not NDJSON
      const text = await historyRes.text();
      try {
        const parsed = JSON.parse(text);
        ratingHistory = Array.isArray(parsed) ? parsed : [];
        if (ratingHistory.length === 1 && Array.isArray(ratingHistory[0])) {
          ratingHistory = ratingHistory[0];
        }
      } catch { ratingHistory = []; }
    } else if (historyRes) {
      console.error(`[Lichess Proxy] History fetch failed for ${username}:`, historyRes.status, historyRes.statusText);
    }

    clear();

    if (!profile) {
      return { status: 404, body: { error: 'Lichess profile not found', notFound: true } };
    }

    return { status: 200, body: { profile, ratingHistory } };
  } catch (err) {
    clear();
    return { status: 500, body: { error: 'Failed to fetch from Lichess' } };
  }
}

async function handleChesscomProxy(username) {
  const { signal, clear } = createAbortSignal(10000);
  try {
    let profile = null;
    let stats = null;

    const profileRes = await fetch(
      `https://api.chess.com/pub/player/${encodeURIComponent(username)}`,
      { 
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)'
        }, 
        signal 
      }
    ).catch(() => ({ ok: false, status: 500 }));

    if (profileRes && profileRes.ok) {
      profile = await profileRes.json();
    } else if (profileRes && profileRes.status === 404) {
      clear();
      return { status: 404, body: { error: 'Profile not found', notFound: true } };
    }

    const statsRes = await fetch(
      `https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`,
      { headers: { 'Accept': 'application/json' }, signal }
    ).catch(() => ({ ok: false }));

    if (statsRes && statsRes.ok) {
      stats = await statsRes.json();
    }

    clear();

    if (!profile) {
      return { status: 404, body: { error: 'Profile not found', notFound: true } };
    }

    const combined = { ...profile, ...(stats || {}) };
    return { status: 200, body: combined };
  } catch (err) {
    clear();
    return { status: 500, body: { error: 'Failed to fetch from Chess.com' } };
  }
}

async function handleLichessGamesProxy(username, req) {
  const max = req.query.max || '10';
  const { signal, clear } = createAbortSignal(CHESS_API_TIMEOUT);
  const response = await fetch(
    `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&pgnInJson=true`,
    {
      headers: {
        'Accept': 'application/x-ndjson',
        'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)'
      },
      signal
    }
  ).catch((e) => {
    console.error(`[Lichess Games] Fetch threw for ${username}:`, e.message);
    return { ok: false };
  });
  clear();

  if (!response || !response.ok) {
    return { status: response?.status || 502, body: { error: 'Lichess games API error', games: [] } };
  }

  const text = await response.text();
  const lines = text.split('\n').filter((line) => line.trim());
  const games = lines.map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);

  return { status: 200, body: games };
}

async function handleLichessExtrasProxy(username) {
  const headers = { 
    'Accept': 'application/json',
    'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)'
  };
  try {
    const [trophiesRes, statusRes] = await Promise.allSettled([
      fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}/trophies`, { headers }),
      // Correct lichess endpoint: /api/users/status?ids=<usernames>
      fetch(`https://lichess.org/api/users/status?ids=${encodeURIComponent(username)}`, { headers })
    ]);

    let trophies = [];
    if (trophiesRes.status === 'fulfilled' && trophiesRes.value.ok) {
      trophies = await trophiesRes.value.json().catch(() => []);
      if (!Array.isArray(trophies)) trophies = [];
    }

    let status = {};
    if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
      const arr = await statusRes.value.json().catch(() => []);
      if (Array.isArray(arr) && arr.length > 0) status = arr[0];
      else if (arr && !Array.isArray(arr)) status = arr;
    }

    return { status: 200, body: { trophies, status } };
  } catch (e) {
    console.error('[Lichess Extras] Error:', e.message);
    // Extras are decorative — degrade gracefully instead of a 500.
    return { status: 200, body: { trophies: [], status: {}, degraded: true } };
  }
}

async function handleChesscomGamesProxy(username, req) {
  // req is an Express request — params live on req.query, not url.searchParams
  const year = req.query.year || new Date().getFullYear();
  const month = req.query.month || String(new Date().getMonth() + 1).padStart(2, '0');

  const response = await fetch(
    `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/${year}/${month}`,
    { headers: { 'Accept': 'application/json' } }
  ).catch(() => ({ ok: false }));

  if (!response || !response.ok) {
    return { status: response?.status || 500, body: { games: [], total: 0 } };
  }

  const data = await response.json();
  return { status: 200, body: { games: (data.games || []).reverse().slice(0, 20), total: data.games?.length || 0 } };
}

async function handleChesscomClubsProxy(username) {
  try {
    const [clubsRes, tournamentsRes] = await Promise.all([
      fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/clubs`, { headers: { 'Accept': 'application/json' } }),
      fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/tournaments`, { headers: { 'Accept': 'application/json' } })
    ]);

    const clubs = clubsRes?.ok ? await clubsRes.json().catch(() => ({})) : {};
    const tournaments = tournamentsRes?.ok ? await tournamentsRes.json().catch(() => ({})) : {};

    return {
      status: 200,
      body: {
        clubs: Array.isArray(clubs.clubs) ? clubs.clubs : [],
        tournaments: Array.isArray(tournaments.tournaments) ? tournaments.tournaments : []
      }
    };
  } catch {
    return { status: 500, body: { clubs: [], tournaments: [], error: 'Failed to fetch clubs/tournaments' } };
  }
}

async function handleZohoPaymentInit(req) {
  try {
    const response = await fetch('https://zohoapis.in/books/v3/payments/init', {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    return { status: response.status, body: data };
  } catch {
    return { status: 500, body: { error: 'Zoho payment init failed' } };
  }
}

async function handleZohoWebhook(req) {
  return { status: 200, body: { received: true } };
}

async function handleGeoProxy() {
  const services = [
    'https://ipapi.co/json/',
    'https://ip-api.com/json/',
    'https://ipinfo.io/json',
  ];
  for (const url of services) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        return { status: 200, body: await res.json() };
      }
    } catch {
      continue;
    }
  }
  return { status: 200, body: { ip: '127.0.0.1', country_code: 'IN' } };
}

async function handleLichessTest(username) {
  try {
    const testRes = await fetch(
      `https://lichess.org/api/user/${encodeURIComponent(username)}`,
      { 
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        compress: false
      }
    );
    const status = testRes.status;
    const statusText = testRes.statusText;
    let body = null;
    try { body = await testRes.json(); } catch { body = await testRes.text(); }
    return { status: 200, body: { upstreamStatus: status, upstreamStatusText: statusText, upstreamBody: body } };
  } catch (e) {
    return { status: 200, body: { error: e.message } };
  }
}

async function handleAccessControl(req) {
  const method = req.method;
  
  if (method === 'OPTIONS') {
    return { status: 200, body: {} };
  }

  if (method === 'GET') {
    const mockUsers = [
      {
        id: '1',
        email: 'admin121@gmail.com',
        role: 'admin',
        created_at: '2024-01-15T10:00:00Z',
        last_sign_in_at: '2026-07-08T05:30:00Z',
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
    return { status: 200, body: { users: mockUsers } };
  }

  if (method === 'POST') {
    const body = await req.json().catch(() => ({}));
    return { status: 200, body: { success: true, user: { id: Date.now().toString(), ...body } } };
  }

  if (method === 'PUT') {
    const body = await req.json().catch(() => ({}));
    return { status: 200, body: { success: true, user: body } };
  }

  if (method === 'DELETE') {
    const body = await req.json().catch(() => ({}));
    return { status: 200, body: { success: true } };
  }

  return { status: 405, body: { error: 'Method not allowed' } };
}

app.use('/api', async (req, res) => {
  const username = req.query.username;
  const pathname = req.path;
  console.log(`[Proxy] ${req.method} ${req.originalUrl} -> pathname=${pathname}, username=${username || 'none'}`);

  try {
    let result;

    if ((pathname === '/lichess-proxy' || pathname === '/api/lichess-proxy') && username) {
      result = await handleLichessProxy(username);
    } else if ((pathname === '/chesscom-proxy' || pathname === '/api/chesscom-proxy') && username) {
      result = await handleChesscomProxy(username);
    } else if ((pathname === '/lichess-games-proxy' || pathname === '/api/lichess-games-proxy') && username) {
      result = await handleLichessGamesProxy(username, req);
    } else if ((pathname === '/lichess-extras-proxy' || pathname === '/api/lichess-extras-proxy') && username) {
      result = await handleLichessExtrasProxy(username);
    } else if ((pathname === '/chesscom-games-proxy' || pathname === '/api/chesscom-games-proxy') && username) {
      result = await handleChesscomGamesProxy(username, req);
    } else if ((pathname === '/chesscom-clubs-proxy' || pathname === '/api/chesscom-clubs-proxy') && username) {
      result = await handleChesscomClubsProxy(username);
    } else if (pathname === '/zoho-payment-status' || pathname === '/api/zoho-payment-status') {
      // Local dev has no Zoho credentials; report not-paid so the UI keeps
      // its manual flows. Production uses api/zoho-payment-status.js.
      result = { status: 200, body: { paid: false, status: 'dev-unsupported' } };
    } else if (pathname === '/zoho-payment-init' || pathname === '/api/zoho-payment-init') {
      result = await handleZohoPaymentInit(req);
    } else if (pathname === '/zoho-webhook' || pathname === '/api/zoho-webhook') {
      result = await handleZohoWebhook(req);
    } else if (pathname === '/geo' || pathname === '/api/geo') {
      result = await handleGeoProxy();
    } else if (pathname === '/test-lichess' || pathname === '/api/test-lichess') {
      result = await handleLichessTest(username || 'aadhiseetha');
    } else if (pathname === '/health' || pathname === '/api/health') {
      result = { status: 200, body: { status: 'ok', proxy: 'dev-server', timestamp: Date.now() } };
    } else if (pathname === '/access_control' || pathname === '/api/access_control') {
      result = await handleAccessControl(req);
    } else {
      console.log(`[Proxy] Fallthrough to Supabase: ${pathname}`);
      const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      const targetUrl = `https://zznbanjdkwofsvpzybtr.supabase.co/functions/v1${pathname}${queryString}`;
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: Object.fromEntries(Object.entries(req.headers).filter(([k, v]) => k && v && k.toLowerCase() !== 'host' && k.toLowerCase() !== 'connection')),
        body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body ? JSON.stringify(req.body) : undefined
      });
      const headers = Object.fromEntries(response.headers.entries());
      delete headers['content-encoding'];
      res.status(response.status).set(headers).send(await response.text());
      return;
    }

    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('[Proxy Error]', err);
    res.status(500).json({ error: 'Proxy failed', details: err.message });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`ChessKidoo Dev Proxy Server`);
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log(`  Health:   http://localhost:${PORT}/api/health`);
  console.log(`  Test:     http://localhost:${PORT}/api/test-lichess?username=aadhiseetha`);
  console.log(`========================================\n`);
});
