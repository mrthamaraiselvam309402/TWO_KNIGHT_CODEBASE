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
    const [trophiesRes, statusRes] = await Promise.all([
      fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}/trophies`, {
        headers: { 'Accept': 'application/json' }
      }),
      fetch(`https://lichess.org/api/users/${encodeURIComponent(username)}/online-status`, {
        headers: { 'Accept': 'application/json' }
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
