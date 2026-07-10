// Consolidated Lichess proxy function (Hobby plan allows max 12 functions).
// Public URLs are unchanged — vercel.json rewrites /api/lichess-proxy,
// /api/lichess-games-proxy, /api/lichess-extras-proxy and /api/test-lichess
// here with a ?type= param.

import profileHandler from './_lib/lichess-profile.js';
import gamesHandler from './_lib/lichess-games.js';
import extrasHandler from './_lib/lichess-extras.js';
import testHandler from './_lib/lichess-test.js';

const PATH_TYPES = {
  'lichess-games-proxy': 'games',
  'lichess-extras-proxy': 'extras',
  'test-lichess': 'test',
  'lichess-proxy': 'profile'
};

async function route(request) {
  const url = new URL(request.url, 'http://localhost');
  const pathKey = Object.keys(PATH_TYPES).find((k) => url.pathname.includes(k));
  const type = url.searchParams.get('type') || (pathKey ? PATH_TYPES[pathKey] : 'profile');

  switch (type) {
    case 'games':
      return gamesHandler(request);
    case 'extras':
      return extrasHandler(request);
    case 'test':
      return testHandler(request);
    case 'profile':
    default:
      return profileHandler(request);
  }
}

// Named exports: required for Vercel to use the web fetch-style signature.
export const GET = route;
export const OPTIONS = route;
