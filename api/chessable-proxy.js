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
    const data = {
      username: username,
      xp: 0,
      streak: 0,
      courses_completed: 0,
      message: 'Chessable does not offer a public API. Stats shown are from student self-reports.'
    };

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (err) {
    console.error('Chessable proxy error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch Chessable data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
