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
    const [profileRes, historyRes] = await Promise.all([
      fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}`, {
        headers: { 'Accept': 'application/json' }
      }),
      fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}/rating-history`, {
        headers: { 'Accept': 'application/x-ndjson' }
      })
    ]);

    if (!profileRes.ok || !historyRes.ok) {
      return new Response(JSON.stringify({ error: 'Lichess API error', profileStatus: profileRes.status, historyStatus: historyRes.status }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const profile = await profileRes.json();
    const text = await historyRes.text();
    const lines = text.split('\n').filter((line) => line.trim());
    const ratingHistory = lines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    const payload = {
      profile,
      ratingHistory
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (err) {
    console.error('Lichess proxy error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch from Lichess' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};