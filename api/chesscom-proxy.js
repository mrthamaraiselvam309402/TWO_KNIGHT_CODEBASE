export default async function handler(request) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username');
  if (!username) {
    return new Response(JSON.stringify({ error: 'Missing username parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let profile = null;
    let stats = null;

    try {
      const profileRes = await fetch(
        `https://api.chess.com/pub/player/${encodeURIComponent(username)}`,
        { 
          headers: { 
            'Accept': 'application/json',
            'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)'
          }, 
          signal: controller.signal 
        }
      );
      if (profileRes.ok) {
        profile = await profileRes.json();
      } else if (profileRes.status === 404) {
        clearTimeout(timeout);
        return new Response(JSON.stringify({ error: 'Profile not found', notFound: true }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        clearTimeout(timeout);
        return new Response(JSON.stringify({ error: 'Request timeout', notFound: false }), {
          status: 504,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw e;
    }

    try {
      const statsRes = await fetch(
        `https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`,
        { 
          headers: { 
            'Accept': 'application/json',
            'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)'
          }, 
          signal: controller.signal 
        }
      );
      if (statsRes.ok) {
        stats = await statsRes.json();
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        // Stats timeout - continue with profile only
      } else {
        throw e;
      }
    }

    clearTimeout(timeout);

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found', notFound: true }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const combined = { ...profile, ...(stats || {}) };

    return new Response(JSON.stringify(combined), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (err) {
    console.error('Chess.com proxy error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch from Chess.com', notFound: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}