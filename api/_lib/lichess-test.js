export default async function handler(request) {
  const url = new URL(request.url, 'http://localhost');
  const username = url.searchParams.get('username') || 'aadhiseetha';

  try {
    console.log(`[Test Lichess] Testing upstream for: ${username}`);
    const testRes = await fetch(
      `https://lichess.org/api/user/${encodeURIComponent(username)}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      }
    );

    const status = testRes.status;
    const statusText = testRes.statusText;
    let body = null;
    let bodyText = '';
    try {
      body = await testRes.json();
      bodyText = JSON.stringify(body);
    } catch {
      bodyText = await testRes.text();
      body = bodyText.slice(0, 500);
    }

    console.log(`[Test Lichess] Response for ${username}:`, status, statusText, bodyText.slice(0, 200));

    return new Response(JSON.stringify({
      username,
      upstreamStatus: status,
      upstreamStatusText: statusText,
      upstreamBody: body
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(`[Test Lichess] Error for ${username}:`, err);
    return new Response(JSON.stringify({
      username,
      error: err.message
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
