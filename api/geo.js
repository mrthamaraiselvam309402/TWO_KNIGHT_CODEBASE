async function route() {
  const services = [
    'https://ipapi.co/json/',
    'https://ip-api.com/json/'
  ];

  for (const url of services) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          const payload = {
            ip: data.ip || '127.0.0.1',
            country_code: data.country_code || data.countryCode || data.country || 'IN',
            country: data.country_name || data.country || 'India'
          };
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' }
          });
        }
      }
    } catch {
      continue;
    }
  }

  return new Response(JSON.stringify({ ip: '127.0.0.1', country_code: 'IN', country: 'India' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
export const GET = route;
