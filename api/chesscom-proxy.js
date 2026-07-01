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
    const profileRes = await fetch(
      `https://api.chess.com/pub/player/${encodeURIComponent(username)}`,
      { headers: { 'Accept': 'application/json' } }
    );
    
    const statsRes = await fetch(
      `https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`,
      { headers: { 'Accept': 'application/json' } }
    );

    const profile = profileRes.ok ? await profileRes.json().catch(() => ({})) : {};
    const stats = statsRes.ok ? await statsRes.json().catch(() => ({})) : {};

    const combined = { ...profile, ...stats };

    return new Response(JSON.stringify(combined), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (err) {
    console.error('Chess.com proxy error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch from Chess.com' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};