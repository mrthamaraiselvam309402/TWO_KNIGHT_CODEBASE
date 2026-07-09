// Consolidated Chess.com proxy function (Hobby plan allows max 12 functions).
// Public URLs are unchanged — vercel.json rewrites /api/chesscom-proxy,
// /api/chesscom-clubs-proxy and /api/chesscom-games-proxy here with a
// ?type= param.

import profileHandler from './_lib/chesscom-profile.js';
import clubsHandler from './_lib/chesscom-clubs.js';
import gamesHandler from './_lib/chesscom-games.js';

const PATH_TYPES = {
  'chesscom-clubs-proxy': 'clubs',
  'chesscom-games-proxy': 'games',
  'chesscom-proxy': 'profile'
};

export default async function handler(request) {
  const url = new URL(request.url, 'http://localhost');
  const pathKey = Object.keys(PATH_TYPES).find((k) => url.pathname.includes(k));
  const type = url.searchParams.get('type') || (pathKey ? PATH_TYPES[pathKey] : 'profile');

  switch (type) {
    case 'clubs':
      return clubsHandler(request);
    case 'games':
      return gamesHandler(request);
    case 'profile':
    default:
      return profileHandler(request);
  }
}
