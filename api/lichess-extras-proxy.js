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
    const headers = { 
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Encoding': 'gzip, deflate',
      'Accept-Language': 'en-US,en;q=0.9'
    };
    const [trophiesRes, statusRes] = await Promise.all([
      fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}/trophies`, {
        headers
      }),
      fetch(`https://lichess.org/api/users/${encodeURIComponent(username)}/online-status`, {
        headers
      })
    ]);

    const trophies = trophiesRes.ok ? await trophiesRes.json().catch(() => []) : [];
    const status = statusRes.ok ? await statusRes.json().catch(() => ({})) : {};

    return new Response(JSON.stringify({ trophies, status }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=120, stale-while-revalidate=300'
      }
    });
  } catch (err) {
    console.error('Lichess extras proxy error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch Lichess extras' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
