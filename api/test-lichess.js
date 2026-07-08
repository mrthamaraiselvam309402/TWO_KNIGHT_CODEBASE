export default async function handler(request) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username') || 'aadhiseetha';

  try {
    console.log(`[Test Lichess] Testing upstream for: ${username}`);
    const testRes = await fetch(
      `https://lichess.org/api/user/${encodeURIComponent(username)}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Encoding': 'gzip, deflate',
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
