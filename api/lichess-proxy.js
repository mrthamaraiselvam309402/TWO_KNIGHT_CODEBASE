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

    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const headers = { 
      'Accept': 'application/json',
      'User-Agent': userAgent,
      'Accept-Language': 'en-US,en;q=0.9'
    };

    const profileRes = await fetch(
      `https://lichess.org/api/user/${encodeURIComponent(username)}`,
      { headers, signal: controller.signal }
    ).catch((e) => {
      console.error(`[Lichess] Profile fetch threw for ${username}:`, e);
      return { ok: false, status: e.name === 'AbortError' ? 504 : 500, error: e.message };
    });

    console.log(`[Lichess Proxy] Profile response for ${username}:`, profileRes?.status, profileRes?.statusText);

    if (profileRes && profileRes.ok) {
      try { 
        profile = await profileRes.json(); 
        profileOk = true; 
      } catch { 
        profile = null; 
      }
    } else if (profileRes) {
      const errorText = await profileRes.text().catch(() => '');
      console.error(`[Lichess Proxy] Profile fetch failed for ${username}:`, profileRes.status, profileRes.statusText, errorText);
      
      // If 404 from API, try scraping the public profile page as fallback
      if (profileRes.status === 404) {
        console.log(`[Lichess Proxy] API 404 for ${username}, trying profile page scrape...`);
        try {
          const pageRes = await fetch(
            `https://lichess.org/@/${encodeURIComponent(username)}`,
            { headers: { 'User-Agent': userAgent }, signal: controller.signal }
          );
          if (pageRes.ok) {
            const html = await pageRes.text();
            // Try to extract user data from the page's JSON
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
    }

    const historyRes = await fetch(
      `https://lichess.org/api/user/${encodeURIComponent(username)}/rating-history`,
      { headers, signal: controller.signal }
    ).catch((e) => {
      console.error(`[Lichess] Rating history fetch threw for ${username}:`, e);
      return { ok: false, status: e.name === 'AbortError' ? 504 : 500, error: e.message };
    });

    console.log(`[Lichess Proxy] History response for ${username}:`, historyRes?.status, historyRes?.statusText);

    if (historyRes && historyRes.ok) {
      try {
        const text = await historyRes.text();
        const lines = text.split('\n').filter((line) => line.trim());
        ratingHistory = lines.map((line) => {
          try { return JSON.parse(line); } catch { return null; }
        }).filter(Boolean);
        historyOk = true;
      } catch { ratingHistory = []; }
    } else if (historyRes) {
      console.error(`[Lichess Proxy] History fetch failed for ${username}:`, historyRes.status, historyRes.statusText);
    }

    clearTimeout(timeoutId);

    if (!profileOk) {
      const status = profileRes?.status || 500;
      return new Response(JSON.stringify({ 
        error: status === 404 ? 'Lichess profile not found' : 'Failed to fetch Lichess profile', 
        notFound: status === 404,
        upstreamStatus: status,
        upstreamStatusText: profileRes?.statusText,
        debug: 'Profile API failed and scrape fallback did not find data'
      }), {
        status: status === 404 ? 404 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = {
      profile: profile || {},
      ratingHistory: ratingHistory || [],
      source: profileOk && !historyOk ? 'profile-only' : 'full'
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (err) {
    console.error(`[Lichess] Unexpected error for ${username}:`, err);
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