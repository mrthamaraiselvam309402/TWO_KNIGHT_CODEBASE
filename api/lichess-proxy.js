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
    const response = await fetch(
      `https://lichess.org/api/user/${encodeURIComponent(username)}/rating-history`,
      { headers: { 'Accept': 'application/x-ndjson' } }
    );

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Lichess API error', status: response.status }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const text = await response.text();
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
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