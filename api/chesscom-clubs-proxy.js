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
    const [clubsRes, tournamentsRes] = await Promise.all([
      fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/clubs`, {
        headers: { 'Accept': 'application/json' }
      }),
      fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/tournaments`, {
        headers: { 'Accept': 'application/json' }
      })
    ]);

    const clubs = clubsRes.ok ? await clubsRes.json().catch(() => ({})) : {};
    const tournaments = tournamentsRes.ok ? await tournamentsRes.json().catch(() => ({})) : {};

    return new Response(JSON.stringify({
      clubs: Array.isArray(clubs.clubs) ? clubs.clubs : [],
      tournaments: Array.isArray(tournaments.tournaments) ? tournaments.tournaments : []
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (err) {
    console.error('Chess.com clubs/tournaments proxy error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch Chess.com clubs/tournaments' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
