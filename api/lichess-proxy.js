export default async function handler(request) {
  const startTime = Date.now();
  try {
    const url = new URL(request.url);
    const username = url.searchParams.get('username');
    if (!username) {
      return new Response(JSON.stringify({ error: 'Missing username parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const headers = {
      'Accept': 'application/json',
      'User-Agent': userAgent,
      'Accept-Language': 'en-US,en;q=0.9'
    };

    const profileUrl = `https://lichess.org/api/user/${encodeURIComponent(username)}`;
    const historyUrl = `https://lichess.org/api/user/${encodeURIComponent(username)}/rating-history`;

    let profile = null;
    let ratingHistory = [];
    let profileOk = false;
    let historyOk = false;
    let profileStatus = 500;
    let profileStatusText = 'Unknown';
    let historyStatus = 500;
    let historyStatusText = 'Unknown';

    // Fetch profile with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const profileRes = await fetch(profileUrl, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      profileStatus = profileRes.status;
      profileStatusText = profileRes.statusText;
      console.log(`[Lichess Proxy] Profile response for ${username}:`, profileRes.status, profileRes.statusText);
      if (profileRes.ok) {
        try { profile = await profileRes.json(); profileOk = true; } catch { profile = null; }
      } else if (profileRes.status === 404) {
        console.log(`[Lichess Proxy] API 404 for ${username}, trying profile page scrape...`);
        try {
          const scrapeController = new AbortController();
          const scrapeTimeout = setTimeout(() => scrapeController.abort(), 4000);
          const pageRes = await fetch(`https://lichess.org/@/${encodeURIComponent(username)}`, {
            headers: { 'User-Agent': userAgent },
            signal: scrapeController.signal
          });
          clearTimeout(scrapeTimeout);
          if (pageRes.ok) {
            const html = await pageRes.text();
            const jsonMatch = html.match(/window\.lichess\s*=\s*({.*?});/s) ||
                             html.match(/<script[^>]*>([\s\S]*?window\.lichess[\s\S]*?)<\/script>/);
            if (jsonMatch) {
              try {
                const userData = JSON.parse(jsonMatch[1].replace('window.lichess = ', '').replace(';', ''));
                profile = userData.user || userData.profile || userData;
                profileOk = true;
                console.log(`[Lichess Proxy] Scrape fallback succeeded for ${username}`);
              } catch {
                console.log(`[Lichess Proxy] Scrape JSON parse failed for ${username}`);
              }
            }
          }
        } catch (scrapeErr) {
          console.error(`[Lichess Proxy] Scrape fallback failed for ${username}:`, scrapeErr.message);
        }
      }
    } catch (err) {
      console.error(`[Lichess] Profile fetch threw for ${username}:`, err);
    }

    // Fetch rating history with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const historyRes = await fetch(historyUrl, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      historyStatus = historyRes.status;
      historyStatusText = historyRes.statusText;
      console.log(`[Lichess Proxy] History response for ${username}:`, historyRes.status, historyRes.statusText);
      if (historyRes.ok) {
        try {
          const text = await historyRes.text();
          const lines = text.split('\n').filter((line) => line.trim());
          ratingHistory = lines.map((line) => {
            try { return JSON.parse(line); } catch { return null; }
          }).filter(Boolean);
          historyOk = true;
        } catch { ratingHistory = []; }
      }
    } catch (err) {
      console.error(`[Lichess] Rating history fetch threw for ${username}:`, err);
    }

    if (!profileOk) {
      const status = profileStatus === 0 ? 500 : profileStatus;
      return new Response(JSON.stringify({
        error: status === 404 ? 'Lichess profile not found' : 'Failed to fetch Lichess profile',
        notFound: status === 404,
        upstreamStatus: status,
        upstreamStatusText: profileStatusText,
        debug: 'Profile API failed and scrape fallback did not find data'
      }), {
        status: status === 404 ? 404 : status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = {
      profile: profile || {},
      ratingHistory: ratingHistory || [],
      source: profileOk && !historyOk ? 'profile-only' : 'full',
      timingMs: Date.now() - startTime
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (err) {
    console.error(`[Lichess] Unexpected error:`, err);
    return new Response(JSON.stringify({
      error: 'Failed to fetch from Lichess',
      details: err.message,
      stack: err.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
