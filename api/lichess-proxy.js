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
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let profile = null;
    let ratingHistory = [];
    let profileOk = false;
    let historyOk = false;

    const profileRes = await fetch(
      `https://lichess.org/api/user/${encodeURIComponent(username)}`,
      { headers: { 'Accept': 'application/json' }, signal: controller.signal }
    ).catch((e) => ({ ok: false, status: e.name === 'AbortError' ? 504 : 500 }));

    if (profileRes && profileRes.ok) {
      try { profile = await profileRes.json(); profileOk = true; } catch { profile = null; }
    }

    const historyRes = await fetch(
      `https://lichess.org/api/user/${encodeURIComponent(username)}/rating-history`,
      { headers: { 'Accept': 'application/x-ndjson' }, signal: controller.signal }
    ).catch((e) => ({ ok: false, status: e.name === 'AbortError' ? 504 : 500 }));

    if (historyRes && historyRes.ok) {
      try {
        const text = await historyRes.text();
        const lines = text.split('\n').filter((line) => line.trim());
        ratingHistory = lines.map((line) => {
          try { return JSON.parse(line); } catch { return null; }
        }).filter(Boolean);
        historyOk = true;
      } catch { ratingHistory = []; }
    }

    clearTimeout(timeoutId);

    if (!profileOk) {
      const status = profileRes?.status || 500;
      return new Response(JSON.stringify({ error: status === 404 ? 'Lichess profile not found' : 'Failed to fetch Lichess profile', notFound: status === 404 }), {
        status: status === 404 ? 404 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = {
      profile: profile || {},
      ratingHistory: ratingHistory || []
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
}