'use strict';

// chess-api.js
// Handles fetching data from Chess.com and Lichess proxies and rendering the dashboard

let chessChartInstance = null;

function formatDate(iso) {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLichessProfileDetails(profile, container) {
  if (!container) return;
  if (!profile || !profile.username) {
    container.innerHTML = '<div style="color:var(--ivory-dim);">No profile data available.</div>';
    return;
  }

  const createdAt = profile.createdAt ? formatDate(new Date(profile.createdAt).toISOString()) : 'N/A';
  const seenAt = profile.seenAt ? formatDate(new Date(profile.seenAt).toISOString()) : 'N/A';
  const flag = profile.profile?.flag || '';
  const title = profile.title ? `(${esc(profile.title)})` : '';
  const realName = [profile.profile?.firstName, profile.profile?.lastName].filter(Boolean).join(' ') || 'Not provided';
  const location = profile.profile?.location || 'Not provided';
  const fideRating = profile.profile?.fideRating || 'N/A';
  const followers = profile.nbFollowers || 0;

  container.innerHTML = `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px; font-size:12px; color:var(--ivory-dim);">
      <div style="background:var(--bg3); padding:10px; border-radius:8px;"><b style="color:var(--ivory);">Flag</b><br>${flag ? flag + ' ' : ''}${flag || 'N/A'}</div>
      <div style="background:var(--bg3); padding:10px; border-radius:8px;"><b style="color:var(--ivory);">Real Name</b><br>${esc(realName)}</div>
      <div style="background:var(--bg3); padding:10px; border-radius:8px;"><b style="color:var(--ivory);">Location</b><br>${esc(location)}</div>
      <div style="background:var(--bg3); padding:10px; border-radius:8px;"><b style="color:var(--ivory);">FIDE Rating</b><br>${fideRating}</div>
      <div style="background:var(--bg3); padding:10px; border-radius:8px;"><b style="color:var(--ivory);">Joined</b><br>${createdAt}</div>
      <div style="background:var(--bg3); padding:10px; border-radius:8px;"><b style="color:var(--ivory);">Last Seen</b><br>${seenAt}</div>
      <div style="background:var(--bg3); padding:10px; border-radius:8px;"><b style="color:var(--ivory);">Followers</b><br>${followers}</div>
    </div>
    <div style="margin-top:10px; font-size:12px; color:var(--ivory-dim);">
      <b style="color:var(--ivory);">Bio</b><br>${esc(profile.profile?.bio || 'No bio provided')}
    </div>
  `;
}

function renderChesscomProfileDetails(data, container) {
  if (!container) return;
  const profile = data || {};
  if (!profile.username) {
    container.innerHTML = '<div style="color:var(--ivory-dim);">No profile data available.</div>';
    return;
  }

  const joined = profile.joined ? formatDate(new Date(profile.joined * 1000).toISOString()) : 'N/A';
  const lastOnline = profile.last_online ? formatDate(new Date(profile.last_online * 1000).toISOString()) : 'N/A';
  const avatarHtml = profile.avatar ? `<img src="${esc(profile.avatar)}" style="width:48px;height:48px;border-radius:4px;margin-bottom:8px;">` : '';
  const title = profile.title ? `(${esc(profile.title)})` : '';
  const country = profile.country || 'N/A';
  const fideRating = profile.fideRating || 'N/A';
  const followers = profile.followers || 0;
  const status = profile.status || 'N/A';
  const isStreamer = profile.is_streamer ? 'Yes' : 'No';
  const playerId = profile.player_id || 'N/A';

  container.innerHTML = `
    <div style="display:flex; gap:12px; align-items:flex-start; margin-bottom:12px;">
      ${avatarHtml}
      <div>
        <div style="font-weight:bold; font-size:16px;">${esc(profile.username)} ${title}</div>
        <div style="color:var(--ivory-dim);">${esc(profile.name || '')}</div>
        <a href="${esc(profile.url || `https://www.chess.com/member/${profile.username}`)}" target="_blank" style="color:var(--gold); text-decoration:none;">View on Chess.com</a>
      </div>
    </div>
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px; font-size:12px; color:var(--ivory-dim);">
      <div style="background:var(--bg3); padding:10px; border-radius:8px;"><b style="color:var(--ivory);">Country</b><br>${esc(country)}</div>
      <div style="background:var(--bg3); padding:10px; border-radius:8px;"><b style="color:var(--ivory);">FIDE Rating</b><br>${fideRating}</div>
      <div style="background:var(--bg3); padding:10px; border-radius:8px;"><b style="color:var(--ivory);">Followers</b><br>${followers}</div>
      <div style="background:var(--bg3); padding:10px; border-radius:8px;"><b style="color:var(--ivory);">Joined</b><br>${joined}</div>
      <div style="background:var(--bg3); padding:10px; border-radius:8px;"><b style="color:var(--ivory);">Last Online</b><br>${lastOnline}</div>
      <div style="background:var(--bg3); padding:10px; border-radius:8px;"><b style="color:var(--ivory);">Status</b><br>${esc(status)}</div>
      <div style="background:var(--bg3); padding:10px; border-radius:8px;"><b style="color:var(--ivory);">Streamer</b><br>${isStreamer}</div>
      <div style="background:var(--bg3); padding:10px; border-radius:8px;"><b style="color:var(--ivory);">Player ID</b><br>${playerId}</div>
    </div>
  `;
}

function renderLichessRatings(profile, container) {
  if (!container || !profile?.perfs) return;
  const variants = [
    'bullet', 'blitz', 'rapid', 'classical', 'puzzle', 'chess960',
    'atomic', 'horde', 'racingKings', 'ultraBullet', 'kingOfTheHill', 'correspondence'
  ];
  const rows = variants
    .map((v) => {
      const perf = profile.perfs[v];
      if (!perf) return '';
      const rating = perf.rating ?? 'N/A';
      const rd = perf.rd != null ? `RD ${perf.rd}` : '';
      const games = perf.games != null ? `Games: ${perf.games}` : '';
      const prov = perf.prov ? 'Prov.' : '';
      return `
        <tr>
          <td style="color:var(--ivory); text-transform:capitalize;">${esc(v)}</td>
          <td style="color:var(--gold); font-weight:700;">${rating}</td>
          <td style="color:var(--ivory-dim);">${esc(rd)}</td>
          <td style="color:var(--ivory-dim);">${esc(games)}</td>
          <td style="color:var(--ivory-dim);">${esc(prov)}</td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:rgba(218,163,62,0.08);">
            <th style="text-align:left; padding:8px 10px; color:var(--gold); border-bottom:1px solid var(--border);">Variant</th>
            <th style="text-align:left; padding:8px 10px; color:var(--gold); border-bottom:1px solid var(--border);">Rating</th>
            <th style="text-align:left; padding:8px 10px; color:var(--gold); border-bottom:1px solid var(--border);">RD</th>
            <th style="text-align:left; padding:8px 10px; color:var(--gold); border-bottom:1px solid var(--border);">Games</th>
            <th style="text-align:left; padding:8px 10px; color:var(--gold); border-bottom:1px solid var(--border);">Flag</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5" style="padding:10px; color:var(--ivory-dim);">No variant ratings available.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function renderChesscomStatsTable(stats, container) {
  if (!container) return;
  const types = ['chess_blitz', 'chess_rapid', 'chess_bullet', 'chess_daily'];
  const rows = types
    .map((key) => {
      const section = stats[key];
      if (!section) return '';
      const last = section.last || {};
      const record = section.record || {};
      const wins = record.wins ?? 0;
      const losses = record.losses ?? 0;
      const draws = record.draws ?? 0;
      const total = wins + losses + draws;
      const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;
      const lossPct = total > 0 ? Math.round((losses / total) * 100) : 0;
      const drawPct = total > 0 ? Math.round((draws / total) * 100) : 0;
      const timeoutPct = record.timeout_percent != null ? `${Math.round(record.timeout_percent * 100)}%` : 'N/A';

      return `
        <tr>
          <td style="color:var(--ivory); text-transform:capitalize;">${esc(key.replace('chess_', ''))}</td>
          <td style="color:var(--gold); font-weight:700;">${last.rating ?? 'N/A'}</td>
          <td style="color:var(--ivory-dim);">Best: ${section.best?.rating ?? 'N/A'}</td>
          <td style="color:var(--ivory-dim);">${wins}W / ${losses}L / ${draws}D</td>
          <td style="color:var(--ivory-dim);">Win ${winPct}% · Draw ${drawPct}% · Loss ${lossPct}%</td>
          <td style="color:var(--ivory-dim);">Timeout ${timeoutPct}</td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:rgba(218,163,62,0.08);">
            <th style="text-align:left; padding:8px 10px; color:var(--gold); border-bottom:1px solid var(--border);">Mode</th>
            <th style="text-align:left; padding:8px 10px; color:var(--gold); border-bottom:1px solid var(--border);">Current</th>
            <th style="text-align:left; padding:8px 10px; color:var(--gold); border-bottom:1px solid var(--border);">Best</th>
            <th style="text-align:left; padding:8px 10px; color:var(--gold); border-bottom:1px solid var(--border);">W/L/D</th>
            <th style="text-align:left; padding:8px 10px; color:var(--gold); border-bottom:1px solid var(--border);">Record %</th>
            <th style="text-align:left; padding:8px 10px; color:var(--gold); border-bottom:1px solid var(--border);">Timeouts</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="6" style="padding:10px; color:var(--ivory-dim);">No stats available.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function renderGameStatsCard(label, value, sub, color) {
  return `
    <div style="background:var(--bg3); padding:12px; border-radius:8px; border-left:4px solid ${color};">
      <div style="font-size:11px; color:var(--ivory-dim); text-transform:uppercase; letter-spacing:0.8px; margin-bottom:4px;">${esc(label)}</div>
      <div style="font-size:18px; font-weight:700; color:var(--ivory);">${esc(value)}</div>
      <div style="font-size:11px; color:var(--ivory-dim); margin-top:2px;">${esc(sub || '')}</div>
    </div>
  `;
}

function renderPerformanceCards(lichessProfile, chesscomData, container) {
  if (!container) return;
  const cards = [];

  const lichessTotal = Object.values(lichessProfile?.perfs || {})
    .reduce((sum, p) => (sum || 0) + (p.games || 0), 0) || 0;
  cards.push(renderGameStatsCard('Lichess Games', lichessTotal, 'Total across variants', '#fff'));

  if (chesscomData) {
    const types = ['chess_blitz', 'chess_rapid', 'chess_bullet', 'chess_daily'];
    let totalWins = 0;
    let totalLosses = 0;
    let totalDraws = 0;
    let totalGames = 0;
    types.forEach((key) => {
      const section = chesscomData[key];
      if (!section) return;
      const record = section.record || {};
      const wins = record.wins ?? 0;
      const losses = record.losses ?? 0;
      const draws = record.draws ?? 0;
      totalWins += wins;
      totalLosses += losses;
      totalDraws += draws;
      totalGames += wins + losses + draws;
    });
    const winPct = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
    const drawPct = totalGames > 0 ? Math.round((totalDraws / totalGames) * 100) : 0;
    cards.push(renderGameStatsCard('Chess.com Games', totalGames, `${winPct}% win · ${drawPct}% draw`, '#7FA650'));
  }

  if (!cards.length) {
    container.innerHTML = '<div style="color:var(--ivory-dim);">No performance data available.</div>';
    return;
  }

  container.innerHTML = `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">${cards.join('')}</div>`;
}

function renderRecentGamesList(games, container, platform = 'lichess') {
  if (!container) return;
  if (!Array.isArray(games) || games.length === 0) {
    container.innerHTML = '<div style="color:var(--ivory-dim); padding:10px;">No recent games found.</div>';
    return;
  }

  const items = games.slice(0, 10).map((g, idx) => {
    let white, black, result, date, timeClass, pgn, gameId;
    
    if (platform === 'chesscom') {
      white = g.white?.username || 'Anonymous';
      black = g.black?.username || 'Anonymous';
      const whiteResult = g.white?.result || '';
      const blackResult = g.black?.result || '';
      if (whiteResult === 'win') result = '1-0';
      else if (blackResult === 'win') result = '0-1';
      else if (whiteResult === 'draw' || blackResult === 'draw') result = '1/2-1/2';
      else result = '*';
      date = g.end_time ? formatDate(new Date(g.end_time * 1000).toISOString()) : 'N/A';
      timeClass = g.time_class || g.perf || 'N/A';
      pgn = g.pgn || '';
      gameId = g.url || '';
    } else {
      white = g.players?.white?.user?.name || 'Anonymous';
      black = g.players?.black?.user?.name || 'Anonymous';
      result = g.winner
        ? g.winner === 'white'
          ? '1-0'
          : '0-1'
        : '1/2-1/2';
      date = g.endAt ? formatDate(new Date(g.endAt * 1000).toISOString()) : (g.end_time ? formatDate(new Date(g.end_time * 1000).toISOString()) : 'N/A');
      timeClass = g.clock?.class || g.perf || g.time_class || 'N/A';
      pgn = g.pgn || '';
      gameId = g.id || '';
    }

    const platformLabel = platform === 'chesscom' ? 'Chess.com' : 'Lichess';
    const platformColor = platform === 'chesscom' ? '#7FA650' : '#fff';

    return `
      <div style="background:var(--bg3); padding:10px; border-radius:6px; margin-bottom:8px; cursor:pointer; border:1px solid var(--border);" onclick="viewChessGame(${idx}, '${platform}')" class="chess-game-item">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="color:${platformColor}; font-size:11px; font-weight:bold;">${platformLabel} • ${esc(timeClass)}</span>
          <span style="color:var(--ivory-dim); font-size:11px;">${date}</span>
        </div>
        <div style="font-size:13px;">
          <b>${esc(white)}</b> vs <b>${esc(black)}</b>
        </div>
        <div style="font-size:12px; color:var(--ivory2); margin-top:4px; display:flex; justify-content:space-between; align-items:center;">
          <span>Result: ${result}</span>
          <span style="color:var(--gold); font-size:10px;">${gameId ? 'View PGN' : ''}</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = items;
}

window.renderChesscomRecentGames = function(games, container) {
  renderRecentGamesList(games, container, 'chesscom');
};

function renderLichessGameStats(lichessProfile, container) {
  if (!container || !lichessProfile?.perfs) return;

  const totalGames = Object.values(lichessProfile.perfs).reduce((sum, p) => sum + (p.games || 0), 0);
  const count = lichessProfile.count || {};
  const totalWins = count.win || 0;
  const totalLosses = count.loss || 0;
  const totalDraws = count.draw || 0;

  const cards = [
    renderGameStatsCard('Total Games', totalGames, 'Across all variants', '#fff'),
    renderGameStatsCard('Wins', totalWins, totalGames > 0 ? `${Math.round((totalWins / totalGames) * 100)}% win rate` : '', 'var(--success)'),
    renderGameStatsCard('Losses', totalLosses, totalGames > 0 ? `${Math.round((totalLosses / totalGames) * 100)}% loss rate` : '', 'var(--danger)'),
    renderGameStatsCard('Draws', totalDraws, totalGames > 0 ? `${Math.round((totalDraws / totalGames) * 100)}% draw rate` : '', 'var(--gold)')
  ];

  container.innerHTML = `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:12px;">${cards.join('')}</div>`;
}

async function loadChessDashboard(student) {
  if (!student) return;

  const chesscomUser = student.chesscom_username;
  const lichessUser = student.lichess_username;

  const lichessCard = document.getElementById('chessapi-lichess-content');
  const chesscomCard = document.getElementById('chessapi-chesscom-content');
  const lichessDetails = document.getElementById('chessapi-lichess-details');
  const chesscomDetails = document.getElementById('chessapi-chesscom-details');
  const recentGamesContainer = document.getElementById('chessapi-recent-games');
  const ratingsTable = document.getElementById('chessapi-ratings-table');
  const performanceContainer = document.getElementById('chessapi-performance');

  if (!lichessCard || !chesscomCard) return;

  const seenAt = student.seenAt || student.lichess_seen_at || null;
  const chesscomLastOnline = student.last_online || student.chesscom_last_online || null;

  if (!lichessUser && !chesscomUser) {
    if (lichessCard) lichessCard.innerHTML = 'No Lichess username set.';
    if (chesscomCard) chesscomCard.innerHTML = 'No Chess.com username set.';
    if (recentGamesContainer) recentGamesContainer.innerHTML = 'No platform usernames linked.';
    if (ratingsTable) ratingsTable.innerHTML = 'No data available.';
    if (performanceContainer) performanceContainer.innerHTML = 'No data available.';
    return;
  }

  let ratingsData = {
    labels: [],
    chesscomBlitz: [],
    chesscomRapid: [],
    lichessBlitz: [],
    lichessRapid: []
  };

  let allLichessGames = [];
  let allChesscomGames = [];

  // Fetch Chess.com via proxy
  if (chesscomUser) {
    try {
      const res = await fetch(`/api/chesscom-proxy?username=${encodeURIComponent(chesscomUser)}`);
      if (res.ok) {
        const data = await res.json();
        const profile = data;
        const stats = data;

        if (!profile.username) {
          chesscomCard.innerHTML = `<span style="color:var(--danger);">Profile not found</span>`;
          if (chesscomDetails) chesscomDetails.innerHTML = '';
          if (recentGamesContainer) recentGamesContainer.innerHTML = '<div style="color:var(--ivory-dim); padding:10px;">No recent games.</div>';
        }

        student.chesscom_last_online = profile.last_online || chesscomLastOnline;

        const blitzRating = stats.chess_blitz?.last?.rating || 'N/A';
        const rapidRating = stats.chess_rapid?.last?.rating || 'N/A';
        const puzzleRating = stats.tactics?.highest?.rating || 'N/A';

        chesscomCard.innerHTML = `
          <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
            ${profile.avatar ? `<img src="${esc(profile.avatar)}" style="width:48px;height:48px;border-radius:4px;">` : ''}
            <div>
              <div style="font-weight:bold; font-size:16px;">${esc(profile.username)} ${profile.title ? `(${esc(profile.title)})` : ''}</div>
              <div style="color:var(--ivory-dim);">${esc(profile.name || '')}</div>
              <a href="${esc(profile.url || `https://www.chess.com/member/${profile.username}`)}" target="_blank" style="color:var(--gold); text-decoration:none;">View on Chess.com</a>
            </div>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
            <div style="background:var(--bg3); padding:8px; border-radius:6px;"><b>Blitz:</b> ${blitzRating}</div>
            <div style="background:var(--bg3); padding:8px; border-radius:6px;"><b>Rapid:</b> ${rapidRating}</div>
            <div style="background:var(--bg3); padding:8px; border-radius:6px;"><b>Puzzles:</b> ${puzzleRating}</div>
            <div style="background:var(--bg3); padding:8px; border-radius:6px;"><b>Followers:</b> ${profile.followers || 0}</div>
          </div>
        `;

        renderChesscomProfileDetails(data, chesscomDetails);
        renderChesscomStatsTable(stats, ratingsTable);

        ratingsData.chesscomBlitz.push(stats.chess_blitz?.last?.rating || null);
        ratingsData.chesscomRapid.push(stats.chess_rapid?.last?.rating || null);

        try {
          const clubsRes = await fetch(`/api/chesscom-clubs-proxy?username=${encodeURIComponent(chesscomUser)}`);
          if (clubsRes.ok) {
            const clubsData = await clubsRes.json();
            renderChesscomClubs(clubsData.clubs || [], document.getElementById('chessapi-chesscom-clubs'));
            renderChesscomTournaments(clubsData.tournaments || [], document.getElementById('chessapi-chesscom-tournaments'));
          } else if (document.getElementById('chessapi-chesscom-clubs')) {
            document.getElementById('chessapi-chesscom-clubs').innerHTML = '<div style="font-size:12px; color:var(--ivory-dim);">Unable to load clubs.</div>';
          }
        } catch (e) {
          console.warn('[Chess] clubs/tournaments fetch failed:', e);
        }

        // Fetch current month games via proxy to avoid CORS
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const gamesRes = await fetch(`/api/chesscom-games-proxy?username=${encodeURIComponent(chesscomUser)}&year=${y}&month=${m}`);
        if (gamesRes.ok) {
          const gamesData = await gamesRes.json();
          allChesscomGames = (gamesData.games || []).slice(0, 10);
          renderChesscomRecentGames(allChesscomGames, recentGamesContainer);
        } else if (recentGamesContainer) {
          recentGamesContainer.innerHTML = '<div style="color:var(--ivory-dim); padding:10px;">Unable to load recent games.</div>';
        }
      } else {
        chesscomCard.innerHTML = `<span style="color:var(--danger);">Profile not found</span>`;
        if (chesscomDetails) chesscomDetails.innerHTML = '';
        if (recentGamesContainer) recentGamesContainer.innerHTML = '<div style="color:var(--ivory-dim); padding:10px;">No recent games.</div>';
      }
    } catch (e) {
      console.error(e);
      chesscomCard.innerHTML = `<span style="color:var(--danger);">Error fetching data</span>`;
    }
  }

  // Fetch Lichess via proxy
  if (lichessUser) {
    try {
      const res = await fetch(`/api/lichess-proxy?username=${encodeURIComponent(lichessUser)}`);
      if (res.ok) {
        const data = await res.json();
        const profile = data.profile || {};
        const ratingHistory = Array.isArray(data.ratingHistory) ? data.ratingHistory : [];

        if (!profile.username) {
          lichessCard.innerHTML = `<span style="color:var(--danger);">Profile not found</span>`;
          if (lichessDetails) lichessDetails.innerHTML = '';
          if (recentGamesContainer) recentGamesContainer.innerHTML = '<div style="color:var(--ivory-dim); padding:10px;">No recent games.</div>';
        }

        if (profile.seenAt) {
          student.lichess_seen_at = new Date(profile.seenAt).toISOString();
        } else if (seenAt) {
          student.lichess_seen_at = seenAt;
        }

        const blitzRating = profile.perfs?.blitz?.rating || 'N/A';
        const rapidRating = profile.perfs?.rapid?.rating || 'N/A';
        const puzzleRating = profile.perfs?.puzzle?.rating || 'N/A';

        try {
          const extrasRes = await fetch(`/api/lichess-extras-proxy?username=${encodeURIComponent(lichessUser)}`);
          if (extrasRes.ok) {
            const extras = await extrasRes.json();
            renderLichessExtras(extras.trophies || [], extras.status || {}, document.getElementById('chessapi-lichess-extras'));
          } else if (document.getElementById('chessapi-lichess-extras')) {
            document.getElementById('chessapi-lichess-extras').innerHTML = '<div style="font-size:12px; color:var(--ivory-dim);">Unable to load extra data.</div>';
          }
        } catch (e) {
          console.warn('[Chess] lichess extras fetch failed:', e);
        }

        lichessCard.innerHTML = `
          <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
            <div>
              <div style="font-weight:bold; font-size:16px;">${esc(profile.username)} ${esc(profile.title) ? `(${esc(profile.title)})` : ''}</div>
              <div style="color:var(--ivory-dim);">${esc(profile.profile?.firstName || '')} ${esc(profile.profile?.lastName || '')}</div>
              <a href="${esc(profile.url || `https://lichess.org/@/${profile.username}`)}" target="_blank" style="color:var(--gold); text-decoration:none;">View on Lichess</a>
            </div>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
            <div style="background:var(--bg3); padding:8px; border-radius:6px;"><b>Blitz:</b> ${blitzRating}</div>
            <div style="background:var(--bg3); padding:8px; border-radius:6px;"><b>Rapid:</b> ${rapidRating}</div>
            <div style="background:var(--bg3); padding:8px; border-radius:6px;"><b>Puzzles:</b> ${puzzleRating}</div>
            <div style="background:var(--bg3); padding:8px; border-radius:6px;"><b>Followers:</b> ${profile.nbFollowers || 0}</div>
          </div>
        `;

        renderLichessProfileDetails(profile, lichessDetails);
        renderLichessRatings(profile, ratingsTable);
        renderLichessGameStats(profile, performanceContainer);

        ratingsData.lichessBlitz.push(profile.perfs?.blitz?.rating || null);
        ratingsData.lichessRapid.push(profile.perfs?.rapid?.rating || null);
        const gamesRes = await fetch(`/api/lichess-games-proxy?username=${encodeURIComponent(lichessUser)}&max=10&pgnInJson=true`);
        if (gamesRes.ok) {
          const games = await gamesRes.json();
          allLichessGames = Array.isArray(games) ? games : [];
          renderRecentGamesList(allLichessGames, recentGamesContainer);
          window.currentChessGames = [...allLichessGames, ...allChesscomGames];
        } else if (recentGamesContainer) {
          recentGamesContainer.innerHTML = '<div style="color:var(--ivory-dim); padding:10px;">Unable to load recent games.</div>';
        }
      } else {
        lichessCard.innerHTML = `<span style="color:var(--danger);">Profile not found</span>`;
        if (lichessDetails) lichessDetails.innerHTML = '';
        if (recentGamesContainer) recentGamesContainer.innerHTML = '<div style="color:var(--ivory-dim); padding:10px;">No recent games.</div>';
      }
    } catch (e) {
      console.error(e);
      lichessCard.innerHTML = `<span style="color:var(--danger);">Error fetching data</span>`;
    }
  }

  if (!lichessUser && chesscomUser) {
    renderChesscomRecentGames(allChesscomGames, recentGamesContainer);
    window.currentChessGames = allChesscomGames;
  }

  // Render Chart
  renderChessChart(ratingsData);

  // If neither loaded recent games container
  if (!lichessUser && !chesscomUser && recentGamesContainer) {
    recentGamesContainer.innerHTML = '<div style="color:var(--ivory-dim); padding:10px;">No platform usernames linked.</div>';
  }
}

function viewChessGame(index, platform) {
  const game = window.currentChessGames[index];
  if (!game || !game.pgn) {
    // Show fallback message
    const viewer = document.getElementById('chess-game-viewer') || document.getElementById('chessapi-pgn-viewer');
    if (viewer) {
      viewer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:250px;color:var(--ivory-dim);flex-direction:column;gap:12px;"><div>PGN not available for this game.</div><a href="' + (game?.url || '#') + '" target="_blank" class="btn btn-outline btn-sm">View on ' + (platform === 'chesscom' ? 'Chess.com' : 'Lichess') + '</a></div>';
    }
    return;
  }

  // Update both viewers
  const legacyViewer = document.getElementById('chessapi-pgn-viewer');
  const enhancedViewer = document.getElementById('chess-game-viewer');
  
  const encodedPgn = encodeURIComponent(game.pgn);
  const iframeHtml = '<iframe src="https://lichess.org/embed?pgn=' + encodedPgn + '" width="100%" height="400" frameborder="0" style="border:0;" allowtransparency="true"></iframe>';
  
  if (legacyViewer) legacyViewer.innerHTML = iframeHtml;
  if (enhancedViewer) renderEnhancedGameViewer(window.currentChessGames);
}

function renderChessChart(data) {
  const ctx = document.getElementById('chessapi-rating-chart');
  if (!ctx) return;

  if (chessChartInstance) {
    chessChartInstance.destroy();
  }

  chessChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Current Rating'],
      datasets: [
        {
          label: 'Chess.com Blitz',
          data: data.chesscomBlitz,
          backgroundColor: 'rgba(90, 159, 255, 0.7)',
        },
        {
          label: 'Chess.com Rapid',
          data: data.chesscomRapid,
          backgroundColor: 'rgba(90, 159, 255, 0.4)',
        },
        {
          label: 'Lichess Blitz',
          data: data.lichessBlitz,
          backgroundColor: 'rgba(51, 145, 255, 0.7)',
        },
        {
          label: 'Lichess Rapid',
          data: data.lichessRapid,
          backgroundColor: 'rgba(51, 145, 255, 0.4)',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#fff' } }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: { color: '#aaa' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        },
        x: {
          ticks: { color: '#aaa' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        }
      }
    }
  });
}

// Expose globally
window.loadChessDashboard = loadChessDashboard;
window.viewChessGame = viewChessGame;

function renderLichessExtras(trophies, status, container) {
  if (!container) return;
  let html = '';

  if (trophies && trophies.length) {
    html += `<div style="margin-bottom:12px;">
      <b style="color:var(--ivory); display:block; margin-bottom:6px;">Trophies</b>
      <div style="display:flex; flex-wrap:wrap; gap:6px;">
        ${trophies.map(t => `<span style="background:var(--bg3); border:1px solid var(--border); padding:4px 8px; border-radius:4px; font-size:11px; color:var(--ivory-dim);">${esc(t.name || t.type || 'Trophy')}</span>`).join('')}
      </div>
    </div>`;
  }

  if (status && Object.keys(status).length) {
    const online = status.online ? '<span style=\"color:var(--success);\">● Online</span>' : '<span style=\"color:var(--ivory-dim);\">○ Offline</span>';
    html += `<div style="font-size:12px; color:var(--ivory-dim);"><b style=\"color:var(--ivory);\">Status:</b> ${online}</div>`;
  }

  if (!html) {
    container.innerHTML = '<div style="font-size:12px; color:var(--ivory-dim);">No extra data available.</div>';
    return;
  }

  container.innerHTML = html;
}

function renderChesscomClubs(clubs, container) {
  if (!container) return;
  if (!Array.isArray(clubs) || clubs.length === 0) {
    container.innerHTML = '<div style="font-size:12px; color:var(--ivory-dim);">No clubs found.</div>';
    return;
  }

  container.innerHTML = `<div style="margin-bottom:12px;">
    <b style="color:var(--ivory); display:block; margin-bottom:6px;">Clubs</b>
    <div style="display:flex; flex-direction:column; gap:6px;">
      ${clubs.slice(0, 10).map(c => `<div style="background:var(--bg3); border:1px solid var(--border); padding:8px 10px; border-radius:6px; font-size:12px; color:var(--ivory-dim);">
        <a href="${esc(c.url || '#')}" target="_blank" style="color:var(--gold); text-decoration:none; font-weight:600;">${esc(c.name || 'Club')}</a>
        ${c.activity ? `<div style="margin-top:2px; font-size:11px;">${esc(c.activity)}</div>` : ''}
      </div>`).join('')}
    </div>
  </div>`;
}

function renderChesscomTournaments(tournaments, container) {
  if (!container) return;
  if (!Array.isArray(tournaments) || tournaments.length === 0) {
    container.innerHTML = '<div style="font-size:12px; color:var(--ivory-dim);">No recent tournaments found.</div>';
    return;
  }

container.innerHTML = `<div style="margin-bottom:12px;">
     <b style="color:var(--ivory); display:block; margin-bottom:6px;">Recent Tournaments</b>
     <div style="display:flex; flex-direction:column; gap:6px;">
       ${tournaments.slice(0, 10).map(t => `<div style="background:var(--bg3); border:1px solid var(--border); padding:8px 10px; border-radius:6px; font-size:12px; color:var(--ivory-dim);">
         <span style="font-weight:600; color:var(--ivory);">${esc(t.name || 'Tournament')}</span>
         ${t.status ? `<span style="float:right; font-size:10px; padding:2px 6px; border-radius:4px; background:rgba(218,163,62,0.15); color:var(--gold);">${esc(t.status)}</span>` : ''}
       </div>`).join('')}
     </div>
   </div>`;
}

// ── CHESS PERFORMANCE CACHE ──
let chessCache = { data: null, timestamp: 0 };
const CHESS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedChessData(key) {
  const now = Date.now();
  if (chessCache.data && chessCache.timestamp && (now - chessCache.timestamp < CHESS_CACHE_TTL)) {
    return chessCache.data[key];
  }
  return null;
}

function setCachedChessData(key, value) {
  chessCache.data = chessCache.data || {};
  chessCache.data[key] = value;
  chessCache.timestamp = Date.now();
}

// ── PGN MOVE COUNTING ──
function countMovesInPgn(pgn) {
  if (!pgn || typeof pgn !== 'string') return 0;
  // Remove comments, variations, and result
  let cleaned = pgn.replace(/\{[^}]*\}/g, ' ').replace(/\(/g, ' ').replace(/\)/g, ' ').replace(/\s+1\/2-1\/2|0-1|1-0|\*/g, '');
  // Match move tokens (numbered moves like "1." or "1..." followed by move text)
  const moveTokens = cleaned.match(/\d+\s*\.{1,3}\s*[a-hx]/gi);
  if (!moveTokens) return 0;
  // Each move token represents one half-move pair (white + black), but we count unique move numbers
  const moveNumbers = cleaned.match(/\d+/g);
  return moveNumbers ? moveNumbers.length : moveTokens.length;
}

function getGamePhase(pgn) {
  const moveCount = countMovesInPgn(pgn);
  if (moveCount <= 12) return 'opening';
  if (moveCount <= 40) return 'middlegame';
  return 'endgame';
}

// ── UNIFIED RECENT GAMES LOG ──
function renderUnifiedRecentGames(games, container) {
  if (!container) return;
  if (!Array.isArray(games) || games.length === 0) {
    container.innerHTML = '<div style="color:var(--ivory-dim); padding:10px;">No recent games found.</div>';
    return;
  }

  const items = games.slice(0, 10).map((g, idx) => {
    let white, black, result, date, timeClass, pgn, gameId, platform;
    
    if (g.platform === 'chesscom') {
      white = g.white?.username || 'Anonymous';
      black = g.black?.username || 'Anonymous';
      const whiteResult = g.white?.result || '';
      const blackResult = g.black?.result || '';
      if (whiteResult === 'win') result = '1-0';
      else if (blackResult === 'win') result = '0-1';
      else if (whiteResult === 'draw' || blackResult === 'draw') result = '1/2-1/2';
      else result = '*';
      date = g.end_time ? formatDate(new Date(g.end_time * 1000).toISOString()) : 'N/A';
      timeClass = g.time_class || 'N/A';
      pgn = g.pgn || '';
      gameId = g.url || '';
      platform = 'chesscom';
    } else {
      white = g.players?.white?.user?.name || 'Anonymous';
      black = g.players?.black?.user?.name || 'Anonymous';
      result = g.winner ? (g.winner === 'white' ? '1-0' : '0-1') : '1/2-1/2';
      date = g.endAt ? formatDate(new Date(g.endAt * 1000).toISOString()) : 'N/A';
      timeClass = g.clock?.class || 'N/A';
      pgn = g.pgn || '';
      gameId = g.id || '';
      platform = 'lichess';
    }

    const platformBadge = platform === 'chesscom' 
      ? '<span class="badge" style="background:#7FA650; color:#fff; font-size:10px;">Chess.com</span>' 
      : '<span class="badge" style="background:#fff; color:#000; font-size:10px;">Lichess</span>';

    return `
      <div style="background:var(--bg3); padding:12px; border-radius:6px; margin-bottom:8px; cursor:pointer; border:1px solid var(--border);" onclick="viewChessGame(${idx}, '${platform}')" class="chess-game-item">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; align-items:center;">
          ${platformBadge}
          <span style="font-size:11px; color:var(--ivory-dim);">${esc(timeClass)} • ${date}</span>
        </div>
        <div style="font-size:13px; color:var(--ivory);">
          <b>${esc(white)}</b> vs <b>${esc(black)}</b>
        </div>
        <div style="font-size:12px; color:var(--ivory2); margin-top:4px; display:flex; justify-content:space-between; align-items:center;">
          <span>Result: <span style="color:var(--gold);">${result}</span></span>
          ${pgn ? '<span style="color:var(--gold); font-size:10px; cursor:pointer; text-decoration:underline;">View Game</span>' : '<span style="color:var(--danger); font-size:10px;">No PGN</span>'}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = items;
}

// ── DYNAMIC SKILL BREAKDOWN ──
function renderDynamicSkillBreakdown(student, lichessData, chesscomData, allGames) {
  const container = document.getElementById('chess-skill-breakdown');
  if (!container) return;

  // Extract metrics from platforms
  const metrics = {
    tactics: 0,
    opening: 0,
    middlegame: 0,
    endgame: 0,
    positional: 0
  };

  // Lichess: count.win/loss/draw and perfs
  if (lichessData) {
    const perfs = lichessData.profile?.perfs || {};
    const count = lichessData.profile?.count || {};
    
    const blitz = perfs.blitz || {};
    const bullet = perfs.bullet || {};
    const rapid = perfs.rapid || {};
    const classical = perfs.classical || {};
    const puzzle = perfs.puzzle || {};

    const totalLichess = blitz.games + bullet.games + rapid.games + classical.games + (puzzle.games || 0);
    const blitzWinRate = blitz.games ? (blitz.win || 0) / blitz.games : 0;
    const bulletWinRate = bullet.games ? (bullet.win || 0) / bullet.games : 0;
    const rapidDrawRate = rapid.games ? (rapid.draw || 0) / rapid.games : 0;
    const classicalDrawRate = classical.games ? (classical.draw || 0) / classical.games : 0;

    // Phase 1: Heuristic Proxy Metrics (70% weight)
    // Tactics: Puzzle rating, blitz win rate, bullet win rate
    const puzzleRating = puzzle.rating || 0;
    metrics.tactics = Math.min(100, (puzzleRating / 3000 * 40) + (blitzWinRate * 30) + (bulletWinRate * 20) + 10);

    // Opening Theory: Rapid draw rate, classical draw rate, total games
    metrics.opening = Math.min(100, (rapidDrawRate * 30) + (classicalDrawRate * 25) + (totalLichess / 500 * 20) + 10);

    // Middle Game: Rapid win rate, classical win rate, score vs equal-rated
    const rapidWinRate = rapid.games ? (rapid.win || 0) / rapid.games : 0;
    const classicalWinRate = classical.games ? (classical.win || 0) / classical.games : 0;
    metrics.middlegame = Math.min(100, (rapidWinRate * 25) + (classicalWinRate * 30) + 20 + 10); // equal-rated estimate as 0.5

    // Endgame Play: Classical win rate, draw rate in long games, even-material score
    metrics.endgame = Math.min(100, (classicalWinRate * 25) + (classicalDrawRate * 20) + 30 + 10);

    // Positional: Overall draw rate, low-time resilience, streak consistency
    const totalDraws = count.draw || 0;
    const totalWins = count.win || 0;
    const totalLosses = count.loss || 0;
    const totalGames = totalWins + totalLosses + totalDraws;
    const overallDrawRate = totalGames > 0 ? totalDraws / totalGames : 0;
    metrics.positional = Math.min(100, (overallDrawRate * 25) + 40 + 10); // estimated resilience/streak
  }

  // Chess.com: record.wins/losses/draws
  if (chesscomData) {
    const types = ['chess_blitz', 'chess_rapid', 'chess_bullet', 'chess_daily'];
    let totalWins = 0, totalLosses = 0, totalDraws = 0, totalGamesChesscom = 0;
    let blitzWinRate = 0, bulletWinRate = 0, rapidWinRate = 0, rapidDrawRate = 0;

    types.forEach((key) => {
      const section = chesscomData[key];
      if (!section) return;
      const record = section.record || {};
      const wins = record.wins || 0;
      const losses = record.losses || 0;
      const draws = record.draws || 0;
      const games = wins + losses + draws;
      
      totalWins += wins;
      totalLosses += losses;
      totalDraws += draws;
      totalGamesChesscom += games;

      if (key === 'chess_blitz') blitzWinRate = games > 0 ? wins / games : 0;
      if (key === 'chess_bullet') bulletWinRate = games > 0 ? wins / games : 0;
      if (key === 'chess_rapid') {
        rapidWinRate = games > 0 ? wins / games : 0;
        rapidDrawRate = games > 0 ? draws / games : 0;
      }
    });

    // PHASE 2: PGN phase estimation (30% weight)
    let openingPhaseWins = 0, openingPhaseGames = 0;
    let middlegamePhaseWins = 0, middlegamePhaseGames = 0;
    let endgamePhaseWins = 0, endgamePhaseGames = 0;

    if (Array.isArray(allGames)) {
      allGames.forEach((g) => {
        const phase = getGamePhase(g.pgn);
        const isWin = g.platform === 'chesscom' 
          ? (g.white?.username === student.chesscom_username && g.white?.result === 'win') 
            || (g.black?.username === student.chesscom_username && g.black?.result === 'win')
          : (g.players?.white?.user?.name === student.lichess_username && g.winner === 'white')
            || (g.players?.black?.user?.name === student.lichess_username && g.winner === 'black');
        
        if (phase === 'opening') { openingPhaseGames++; if (isWin) openingPhaseWins++; }
        else if (phase === 'middlegame') { middlegamePhaseGames++; if (isWin) middlegamePhaseWins++; }
        else if (phase === 'endgame') { endgamePhaseGames++; if (isWin) endgamePhaseWins++; }
      });
    }

    // Blend PGN signals with heuristics
    if (openingPhaseGames > 0) {
      const openingWinRate = openingPhaseWins / openingPhaseGames;
      metrics.opening = Math.max(metrics.opening, Math.min(100, openingWinRate * 100 * 0.3 + metrics.opening * 0.7));
    }
    if (middlegamePhaseGames > 0) {
      const middlegameWinRate = middlegamePhaseWins / middlegamePhaseGames;
      metrics.middlegame = Math.max(metrics.middlegame, Math.min(100, middlegameWinRate * 100 * 0.3 + metrics.middlegame * 0.7));
    }
    if (endgamePhaseGames > 0) {
      const endgameWinRate = endgamePhaseWins / endgamePhaseGames;
      metrics.endgame = Math.max(metrics.endgame, Math.min(100, endgameWinRate * 100 * 0.3 + metrics.endgame * 0.7));
    }

    // If no Lichess data, use Chess.com metrics as fallback
    if (!lichessData) {
      metrics.tactics = Math.min(100, (totalGamesChesscom / 500 * 20) + (blitzWinRate * 30) + (bulletWinRate * 20) + 10);
      metrics.opening = Math.min(100, (rapidDrawRate * 30) + (totalGamesChesscom / 500 * 20) + 20 + 10);
      metrics.middlegame = Math.min(100, (rapidWinRate * 25) + 40 + 10);
      const overallDrawRate = totalGamesChesscom > 0 ? totalDraws / totalGamesChesscom : 0;
      metrics.positional = Math.min(100, (overallDrawRate * 25) + 40 + 10);
    }
  }

  // Normalize to sum to 100
  const total = Object.values(metrics).reduce((sum, v) => sum + v, 0);
  if (total > 0) {
    Object.keys(metrics).forEach((k) => {
      metrics[k] = Math.round((metrics[k] / total) * 100);
    });
  }

  // Render skill bars
  const skills = [
    { name: 'Tactics', key: 'tactics', value: Math.round(metrics.tactics) },
    { name: 'Opening Theory', key: 'opening', value: Math.round(metrics.opening) },
    { name: 'Middle Game', key: 'middlegame', value: Math.round(metrics.middlegame) },
    { name: 'Endgame Play', key: 'endgame', value: Math.round(metrics.endgame) },
    { name: 'Positional', key: 'positional', value: Math.round(metrics.positional) }
  ];

  container.innerHTML = skills.map(skill => {
    const pct = skill.value;
    const color = pct > 70 ? 'var(--success)' : pct >= 40 ? 'var(--gold)' : 'var(--danger)';
    const skillKey = skill.key;
    
    return `
      <div style="background:var(--bg3); padding:12px; border-radius:8px; text-align:center;">
        <div style="position:relative; width:100px; height:100px; margin:0 auto 8px;">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" stroke="var(--surface2)" stroke-width="8" fill="none"/>
            <circle cx="50" cy="50" r="45" stroke="${color}" stroke-width="8" fill="none"
              stroke-dasharray="${2 * Math.PI * 45}"
              stroke-dashoffset="${2 * Math.PI * 45 * (1 - pct / 100)}"
              style="transition: stroke-dashoffset 0.5s ease; transform-origin: 50% 50%; transform: rotate(-90deg);"/>
          </svg>
          <svg style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;">
            <text x="50" y="55" text-anchor="middle" font-size="22" font-weight="700" fill="${color}" font-family="var(--font-mono)">${pct}</text>
          </svg>
        </div>
        <div style="font-size:12px; font-weight:600; color:var(--ivory);">${skill.name}</div>
        <div style="font-size:10px; color:var(--ivory-dim); margin-top:4px;">${pct > 70 ? 'Excellent' : pct >= 40 ? 'Developing' : 'Needs Focus'}</div>
      </div>
    `;
  }).join('');
}

// ── ENHANCED GAME VIEWER ──
let currentGameIndex = 0;
let currentGameMoves = [];

function renderEnhancedGameViewer(games) {
  const container = document.getElementById('chess-game-viewer');
  if (!container) return;

  if (!Array.isArray(games) || games.length === 0) {
    container.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:250px; color:var(--ivory-dim);">Select a game from the recent games log to view</div>';
    return;
  }

  const game = games[0];
  const pgn = game?.pgn || '';
  
  if (!pgn) {
    container.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; height:250px; color:var(--ivory-dim); flex-direction:column; gap:12px;">
        <div>PGN not available for this game.</div>
        <a href="${game.url || '#'}" target="_blank" class="btn btn-outline btn-sm">View on ${game.platform === 'chesscom' ? 'Chess.com' : 'Lichess'}</a>
      </div>
    `;
    return;
  }

  // Parse moves from PGN
  currentGameMoves = parsePgnMoves(pgn);
  currentGameIndex = 0;

  const totalMoves = currentGameMoves.length;

  const renderMoveList = () => {
    const movesHtml = currentGameMoves.map((m, i) => {
      const isCurrent = i === currentGameIndex;
      const moveNum = Math.floor(i / 2) + 1;
      const isWhite = i % 2 === 0;
      return `
        <div style="display:flex; ${isCurrent ? 'background:rgba(218,163,62,0.1);' : ''} padding:4px 8px; border-radius:4px; font-family:var(--font-mono); font-size:12px;">
          <span style="color:var(--ivory-dim); width:30px;">${isWhite ? moveNum + '.' : ''}</span>
          <span style="width:80px; color:${isCurrent ? 'var(--gold)' : 'var(--ivory)'};">${m}</span>
        </div>
      `;
    }).join('');

    const currentMove = currentGameMoves[currentGameIndex] || '';
    const fenPreview = `Currently at move ${currentGameIndex + 1} of ${totalMoves}`;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px; height:100%;">
        <div style="display:flex; gap:8px; align-items:center;">
          <button onclick="navigateGame(-1)" class="btn btn-outline btn-sm" style="padding:4px 8px;" ${currentGameIndex === 0 ? 'disabled' : ''}>Prev</button>
          <button onclick="navigateGame(1)" class="btn btn-outline btn-sm" style="padding:4px 8px;" ${currentGameIndex >= totalMoves - 1 ? 'disabled' : ''}>Next</button>
          <button onclick="navigateGame('first')" class="btn btn-outline-grey btn-sm" style="padding:4px 8px;">First</button>
          <button onclick="navigateGame('last')" class="btn btn-outline-grey btn-sm" style="padding:4px 8px;">Last</button>
          <span style="font-size:11px; color:var(--ivory-dim); margin-left:auto;">${fenPreview}</span>
        </div>
        <div style="display:flex; gap:12px;">
          <div style="flex:1; max-height:200px; overflow-y:auto; padding:8px; background:var(--surface2); border-radius:6px;">
            ${movesHtml}
          </div>
          <div style="flex:1;">
            <iframe id="chess-viewer-iframe" src="https://lichess.org/embed?pgn=${encodeURIComponent(pgn)}" 
              width="100%" height="200" frameborder="0" style="border-radius:6px;"></iframe>
          </div>
        </div>
      </div>
    `;
  };

  renderMoveList();
}

function parsePgnMoves(pgn) {
  if (!pgn) return [];
  // Remove comments and result, split on move numbers
  let cleaned = pgn.replace(/\{[^}]*\}/g, ' ').replace(/\s*1\/2-1\/2|0-1|1-0|\*/g, '');
  // Split on double spaces or newlines
  const tokens = cleaned.split(/\s+/);
  const moves = [];
  
  tokens.forEach(token => {
    // Skip move number tokens (like "1." or "1...")
    if (/^\d+\.\.?\d*$/.test(token)) return;
    // Skip purely numeric tokens
    if (/^\d+$/.test(token)) return;
    // Skip empty or result tokens
    if (!token) return;
    // This is a move
    moves.push(token);
  });
  
  return moves;
}

window.navigateGame = function(direction) {
  if (!currentGameMoves || currentGameMoves.length === 0) return;
  
  if (direction === 'first') {
    currentGameIndex = 0;
  } else if (direction === 'last') {
    currentGameIndex = Math.max(0, currentGameMoves.length - 1);
  } else {
    currentGameIndex = Math.max(0, Math.min(currentGameMoves.length - 1, currentGameIndex + direction));
  }
  
  // Re-render the viewer
  if (window.currentChessGames && window.currentChessGames.length > 0) {
    renderEnhancedGameViewer(window.currentChessGames);
  }
};

// ── UPDATE loadChessDashboard FOR NEW TAB ──
async function loadChessDashboardForTab(student) {
  if (!student) return;

  const chesscomUser = student.chesscom_username;
  const lichessUser = student.lichess_username;

  // Check cache first
  const cacheKey = `${student.id}_${lichessUser}_${chesscomUser}`;
  const cached = getCachedChessData(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CHESS_CACHE_TTL)) {
    renderChessPerformanceTab(student, cached.lichessData, cached.chesscomData, cached.games);
    return;
  }

  const result = {
    lichessData: null,
    chesscomData: null,
    games: [],
    timestamp: Date.now()
  };

  // Fetch Chess.com
  if (chesscomUser) {
    try {
      const res = await fetch(`/api/chesscom-proxy?username=${encodeURIComponent(chesscomUser)}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        result.chesscomData = data;
        const y = new Date().getFullYear();
        const m = String(new Date().getMonth() + 1).padStart(2, '0');
        const gamesRes = await fetch(`/api/chesscom-games-proxy?username=${encodeURIComponent(chesscomUser)}&year=${y}&month=${m}&t=${Date.now()}`);
        if (gamesRes.ok) {
          const gamesData = await gamesRes.json();
          result.games.push(...(gamesData.games || []).map(g => ({ ...g, platform: 'chesscom' })));
        }
      } else if (res.status === 404) {
        result.chesscomNotFound = true;
      }
    } catch (e) {
      console.warn('[Chess] Chess.com fetch failed:', e);
      result.chesscomError = true;
    }
  }

  // Fetch Lichess
  if (lichessUser) {
    try {
      const res = await fetch(`/api/lichess-proxy?username=${encodeURIComponent(lichessUser)}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        result.lichessData = data;
        const gamesRes = await fetch(`/api/lichess-games-proxy?username=${encodeURIComponent(lichessUser)}&max=10&pgnInJson=true&t=${Date.now()}`);
        if (gamesRes.ok) {
          const games = await gamesRes.json();
          result.games.push(...(Array.isArray(games) ? games.map(g => ({ ...g, platform: 'lichess' })) : []));
        }
      } else if (res.status === 404) {
        result.lichessNotFound = true;
      }
    } catch (e) {
      console.warn('[Chess] Lichess fetch failed:', e);
      result.lichessError = true;
    }
  }

  setCachedChessData(cacheKey, result);
  renderChessPerformanceTab(student, result.lichessData, result.chesscomData, result.games);
}

function renderChessPerformanceTab(student, lichessData, chesscomData, games) {
  const tab = document.getElementById('child-tab-chess');
  if (!tab) return;

  // Show empty state if no platforms linked
  if (!student.lichess_username && !student.chesscom_username) {
    tab.innerHTML = `
      <div class="chess-empty-state">
        <div class="empty-icon">♟️</div>
        <p style="color:var(--ivory-dim); margin-bottom:12px;">No chess platforms linked yet.</p>
        <button class="btn btn-gold btn-sm cta-btn" onclick="openStudentEditPortalModal()">Link Chess.com or Lichess</button>
      </div>
    `;
    return;
  }

  // Section 3.1: Header
  const headerAvatar = document.getElementById('chess-header-avatar');
  const headerName = document.getElementById('chess-header-name');
  const headerCoach = document.getElementById('chess-header-coach');
  const headerLichess = document.getElementById('chess-header-lichess');
  const headerLichessLink = document.getElementById('chess-header-lichess-link');
  const headerChesscom = document.getElementById('chess-header-chesscom');
  const headerChesscomLink = document.getElementById('chess-header-chesscom-link');
  const btnLinkLichess = document.getElementById('btn-link-lichess');
  const btnUnlinkLichess = document.getElementById('btn-unlink-lichess');
  const btnLinkChesscom = document.getElementById('btn-link-chesscom');
  const btnUnlinkChesscom = document.getElementById('btn-unlink-chesscom');

  if (headerAvatar) headerAvatar.textContent = '♟️';
  if (headerName) headerName.textContent = student.full_name || student.name || '—';
  if (headerCoach) {
    const coach = (window.allCoaches || []).find(c => String(c.id) === String(student.coach_id));
    headerCoach.textContent = `Coach: ${coach ? coach.name : 'Not Assigned'}`;
  }
  if (headerLichessLink && student.lichess_username) {
    headerLichessLink.href = `https://lichess.org/@/${student.lichess_username}`;
    headerLichessLink.textContent = student.lichess_username;
  }
  if (headerLichess) headerLichess.style.display = student.lichess_username ? 'inline' : 'none';
  if (headerChesscomLink && student.chesscom_username) {
    headerChesscomLink.href = `https://www.chess.com/member/${student.chesscom_username}`;
    headerChesscomLink.textContent = student.chesscom_username;
  }
  if (headerChesscom) headerChesscom.style.display = student.chesscom_username ? 'inline' : 'none';

  // Link/Unlink buttons - only show if parent mode (for portal access)
  const isParentMode = document.body.classList.contains('parent-mode') || document.body.classList.contains('admin-mode');
  if (btnLinkLichess) btnLinkLichess.style.display = student.lichess_username ? 'none' : (isParentMode ? 'inline-flex' : 'none');
  if (btnUnlinkLichess) btnUnlinkLichess.style.display = student.lichess_username ? (isParentMode ? 'inline-flex' : 'none') : 'none';
  if (btnLinkChesscom) btnLinkChesscom.style.display = student.chesscom_username ? 'none' : (isParentMode ? 'inline-flex' : 'none');
  if (btnUnlinkChesscom) btnUnlinkChesscom.style.display = student.chesscom_username ? (isParentMode ? 'inline-flex' : 'none') : 'none';

  // Section 3.3: ELO & Rating Dashboard
  const updateEloElement = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value !== null && value !== undefined ? value : '—';
  };

  // Lichess ratings
  if (lichessData) {
    const perfs = lichessData.profile?.perfs || {};
    updateEloElement('chess-elo-lichess-blitz', perfs.blitz?.rating);
    updateEloElement('chess-rd-lichess-blitz', perfs.blitz?.rd);
    updateEloElement('chess-elo-lichess-rapid', perfs.rapid?.rating);
    updateEloElement('chess-rd-lichess-rapid', perfs.rapid?.rd);
  }

  // Chess.com ratings
  if (chesscomData) {
    updateEloElement('chess-elo-chesscom-blitz', chesscomData.chess_blitz?.last?.rating);
    updateEloElement('chess-best-chesscom-blitz', chesscomData.chess_blitz?.best?.rating);
    updateEloElement('chess-elo-chesscom-rapid', chesscomData.chess_rapid?.last?.rating);
    updateEloElement('chess-best-chesscom-rapid', chesscomData.chess_rapid?.best?.rating);
  }

  // Section 3.4: Dynamic Skill Breakdown
  renderDynamicSkillBreakdown(student, lichessData, chesscomData, games);

  // Section 3.5: Platform Statistics
  const lichessProfile = document.getElementById('chess-lichess-profile');
  const lichessRatings = document.getElementById('chess-lichess-ratings');
  const lichessGamestats = document.getElementById('chess-lichess-gamestats');
  const lichessExtras = document.getElementById('chess-lichess-extras');
  const chesscomProfile = document.getElementById('chess-chesscom-profile');
  const chesscomStats = document.getElementById('chess-chesscom-stats');
  const chesscomClubs = document.getElementById('chess-chesscom-clubs');
  const chesscomTournaments = document.getElementById('chess-chesscom-tournaments');

  if (lichessData && lichessProfile) {
    renderLichessProfileDetails(lichessData.profile || {}, lichessProfile);
    renderLichessRatings(lichessData.profile || {}, lichessRatings);
    renderLichessGameStats(lichessData.profile || {}, lichessGamestats);
    // Fetch extras
    fetch(`/api/lichess-extras-proxy?username=${encodeURIComponent(lichessUser)}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => renderLichessExtras(d.trophies || [], d.status || {}, lichessExtras))
      .catch(() => { if (lichessExtras) lichessExtras.innerHTML = '<div style="font-size:12px; color:var(--ivory-dim);">Unable to load extra data.</div>'; });
  }

  if (chesscomData && chesscomProfile) {
    renderChesscomProfileDetails(chesscomData, chesscomProfile);
    renderChesscomStatsTable(chesscomData, chesscomStats);
    // Fetch clubs/tournaments
    fetch(`/api/chesscom-clubs-proxy?username=${encodeURIComponent(chesscomUser)}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => {
        renderChesscomClubs(d.clubs || [], chesscomClubs);
        renderChesscomTournaments(d.tournaments || [], chesscomTournaments);
      })
      .catch(() => {});
  }

  // Section 3.6: Performance Overview
  const perfCards = document.getElementById('chess-performance-cards');
  if (perfCards) {
    renderPerformanceCards(lichessData?.profile || {}, chesscomData, perfCards);
  }

  // Section 3.7: Enhanced Game Viewer
  renderEnhancedGameViewer(games);

  // Section 3.8: Recent Games Log
  const recentGamesLog = document.getElementById('chess-recent-games-log');
  renderUnifiedRecentGames(games, recentGamesLog);

  // Store games for viewer
  window.currentChessGames = games;
}

// ── LINK/UNLINK PLATFORM FUNCTIONS ──
window.linkLichess = function() {
  const student = window.currentStudent;
  if (!student) return;
  const username = prompt('Enter Lichess username to link:');
  if (!username) return;
  if (typeof window.openStudentEditPortalModal === 'function') {
    window.openStudentEditPortalModal();
    setTimeout(() => {
      const el = document.getElementById('spe-lichess');
      if (el) el.value = username.trim();
    }, 300);
  }
};

window.unlinkLichess = function() {
  const student = window.currentStudent;
  if (!student) return;
  if (!confirm('Remove Lichess link for ' + (student.full_name || student.name || 'this student') + '?')) return;
  const s = student;
  if (typeof window.apiCall !== 'function') return;
  window.apiCall(`/api/students?id=${s.id}`, {
    method: 'PUT',
    body: JSON.stringify({ lichess_username: null })
  }).then(() => {
    s.lichess_username = null;
    window.currentStudent = s;
    if (typeof window.renderChildChessPerformance === 'function') {
      window.renderChildChessPerformance(s);
    }
    if (typeof window.toast === 'function') window.toast('Lichess unlinked', 'success');
  }).catch(() => { if (typeof window.toast === 'function') window.toast('Failed to unlink Lichess', 'error'); });
};

window.linkChesscom = function() {
  const student = window.currentStudent;
  if (!student) return;
  const username = prompt('Enter Chess.com username to link:');
  if (!username) return;
  if (typeof window.openStudentEditPortalModal === 'function') {
    window.openStudentEditPortalModal();
    setTimeout(() => {
      const el = document.getElementById('spe-chesscom');
      if (el) el.value = username.trim();
    }, 300);
  }
};

window.unlinkChesscom = function() {
  const student = window.currentStudent;
  if (!student) return;
  if (!confirm('Remove Chess.com link for ' + (student.full_name || student.name || 'this student') + '?')) return;
  const s = student;
  if (typeof window.apiCall !== 'function') return;
  window.apiCall(`/api/students?id=${s.id}`, {
    method: 'PUT',
    body: JSON.stringify({ chesscom_username: null })
  }).then(() => {
    s.chesscom_username = null;
    window.currentStudent = s;
    if (typeof window.renderChildChessPerformance === 'function') {
      window.renderChildChessPerformance(s);
    }
    if (typeof window.toast === 'function') window.toast('Chess.com unlinked', 'success');
  }).catch(() => { if (typeof window.toast === 'function') window.toast('Failed to unlink Chess.com', 'error'); });
};

// Expose for parent portal
window.loadChessDashboardForTab = loadChessDashboardForTab;
window.retryChessDashboard = function() {
  const student = window.currentStudent;
  if (student && typeof window.renderChildChessPerformance === 'function') {
    window.renderChildChessPerformance(student);
  }
};
