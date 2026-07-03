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

    const profileRes = await fetch(
      `https://lichess.org/api/user/${encodeURIComponent(username)}`,
      { headers: { 'Accept': 'application/json' }, signal }
    ).catch(() => ({ ok: false }));

    if (profileRes && profileRes.ok) {
      profile = await profileRes.json();
    }

    const historyRes = await fetch(
      `https://lichess.org/api/user/${encodeURIComponent(username)}/rating-history`,
      { headers: { 'Accept': 'application/x-ndjson' }, signal }
    ).catch(() => ({ ok: false }));

    if (historyRes && historyRes.ok) {
      const text = await historyRes.text();
      const lines = text.split('\n').filter((line) => line.trim());
      ratingHistory = lines.map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
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
      { headers: { 'Accept': 'application/json' }, signal }
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

async function handleLichessGamesProxy(username, url) {
  const max = url.searchParams.get('max') || '10';
  const response = await fetch(
    `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&pgnInJson=true`,
    { headers: { 'Accept': 'application/x-ndjson' } }
  ).catch(() => ({ ok: false }));

  if (!response || !response.ok) {
    return { status: response?.status || 500, body: { error: 'Lichess games API error', games: [] } };
  }

  const text = await response.text();
  const lines = text.split('\n').filter((line) => line.trim());
  const games = lines.map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);

  return { status: 200, body: games };
}

async function handleLichessExtrasProxy(username) {
  try {
    const [trophiesRes, statusRes] = await Promise.all([
      fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}/trophies`, { headers: { 'Accept': 'application/json' } }),
      fetch(`https://lichess.org/api/users/${encodeURIComponent(username)}/online-status`, { headers: { 'Accept': 'application/json' } })
    ]);

    const trophies = trophiesRes?.ok ? await trophiesRes.json().catch(() => []) : [];
    const status = statusRes?.ok ? await statusRes.json().catch(() => ({})) : {};

    return { status: 200, body: { trophies, status } };
  } catch {
    return { status: 500, body: { error: 'Failed to fetch Lichess extras' } };
  }
}

async function handleChesscomGamesProxy(username, url) {
  const year = url.searchParams.get('year') || new Date().getFullYear();
  const month = url.searchParams.get('month') || String(new Date().getMonth() + 1).padStart(2, '0');

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

app.use('/api', async (req, res) => {
  const username = req.query.username;
  const pathname = req.path;

  try {
    let result;

    if (pathname === '/lichess-proxy' && username) {
      result = await handleLichessProxy(username);
    } else if (pathname === '/chesscom-proxy' && username) {
      result = await handleChesscomProxy(username);
    } else if (pathname === '/lichess-games-proxy' && username) {
      result = await handleLichessGamesProxy(username, req);
    } else if (pathname === '/lichess-extras-proxy' && username) {
      result = await handleLichessExtrasProxy(username);
    } else if (pathname === '/chesscom-games-proxy' && username) {
      result = await handleChesscomGamesProxy(username, req);
    } else if (pathname === '/chesscom-clubs-proxy' && username) {
      result = await handleChesscomClubsProxy(username);
    } else if (pathname === '/zoho-payment-init') {
      result = await handleZohoPaymentInit(req);
    } else if (pathname === '/zoho-webhook') {
      result = await handleZohoWebhook(req);
    } else if (pathname === '/geo') {
      result = await handleGeoProxy();
    } else {
      const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      const targetUrl = `https://zznbanjdkwofsvpzybtr.supabase.co/functions/v1${pathname}${queryString}`;
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: Object.fromEntries(Object.entries(req.headers).filter(([k, v]) => k && v && k.toLowerCase() !== 'host' && k.toLowerCase() !== 'connection')),
        body: ['POST', 'PUT', 'PATCH'].includes(req.method) && req.body ? JSON.stringify(req.body) : undefined
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
  console.log(`Development proxy server running on http://localhost:${PORT}`);
});
