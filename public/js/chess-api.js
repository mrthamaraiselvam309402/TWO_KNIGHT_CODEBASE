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

function renderRecentGamesList(games, container) {
  if (!container) return;
  if (!Array.isArray(games) || games.length === 0) {
    container.innerHTML = '<div style="color:var(--ivory-dim); padding:10px;">No recent games found.</div>';
    return;
  }

  const items = games.slice(0, 10).map((g, idx) => {
    const white = g.players?.white?.user?.name || 'Anonymous';
    const black = g.players?.black?.user?.name || 'Anonymous';
    const result = g.winner
      ? g.winner === 'white'
        ? '1-0'
        : '0-1'
      : '1/2-1/2';
    const date = g.endAt ? formatDate(new Date(g.endAt * 1000).toISOString()) : (g.end_time ? formatDate(new Date(g.end_time * 1000).toISOString()) : 'N/A');
    const timeClass = g.clock?.class || g.perf || g.time_class || 'N/A';
    const pgn = g.pgn || '';
    const lichessId = g.id;

    return `
      <div style="background:var(--bg3); padding:10px; border-radius:6px; margin-bottom:8px; cursor:pointer; border:1px solid var(--border);" onclick="viewChessGame(${idx}, 'lichess')" class="chess-game-item">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="color:var(--gold); font-size:11px; font-weight:bold;">Lichess • ${esc(timeClass)}</span>
          <span style="color:var(--ivory-dim); font-size:11px;">${date}</span>
        </div>
        <div style="font-size:13px;">
          <b>${esc(white)}</b> vs <b>${esc(black)}</b>
        </div>
        <div style="font-size:12px; color:var(--ivory2); margin-top:4px; display:flex; justify-content:space-between; align-items:center;">
          <span>Result: ${result}</span>
          <span style="color:var(--gold); font-size:10px;">${lichessId ? 'View PGN' : ''}</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = items;
}

function renderLichessGameStats(lichessProfile, container) {
  if (!container || !lichessProfile?.perfs) return;

  const totalGames = Object.values(lichessProfile.perfs).reduce((sum, p) => sum + (p.games || 0), 0);
  const totalWins = Object.values(lichessProfile.perfs).reduce((sum, p) => sum + (p.win ?? 0), 0);
  const totalLosses = Object.values(lichessProfile.perfs).reduce((sum, p) => sum + (p.loss ?? 0), 0);
  const totalDraws = Object.values(lichessProfile.perfs).reduce((sum, p) => sum + (p.draw ?? 0), 0);

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

        student.chesscom_last_online = profile.last_online || chesscomLastOnline;

        const blitzRating = stats.chess_blitz?.last?.rating || 'N/A';
        const rapidRating = stats.chess_rapid?.last?.rating || 'N/A';
        const puzzleRating = stats.tactics?.highest?.rating || 'N/A';

        chesscomCard.innerHTML = `
          <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
            ${profile.avatar ? `<img src="${profile.avatar}" style="width:48px;height:48px;border-radius:4px;">` : ''}
            <div>
              <div style="font-weight:bold; font-size:16px;">${profile.username} ${profile.title ? `(${profile.title})` : ''}</div>
              <div style="color:var(--ivory-dim);">${profile.name || ''}</div>
              <a href="${profile.url || `https://www.chess.com/member/${profile.username}`}" target="_blank" style="color:var(--gold); text-decoration:none;">View on Chess.com</a>
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

        // Fetch current month games
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const gamesRes = await fetch(`https://api.chess.com/pub/player/${chesscomUser}/games/${y}/${m}`);
        if (gamesRes.ok) {
          const gamesData = await gamesRes.json();
          allChesscomGames = (gamesData.games || []).reverse().slice(0, 10);
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

        if (profile.seenAt) {
          student.lichess_seen_at = new Date(profile.seenAt).toISOString();
        } else if (seenAt) {
          student.lichess_seen_at = seenAt;
        }

        const blitzRating = profile.perfs?.blitz?.rating || 'N/A';
        const rapidRating = profile.perfs?.rapid?.rating || 'N/A';
        const puzzleRating = profile.perfs?.puzzle?.rating || 'N/A';

        if (true) {
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
        }

        lichessCard.innerHTML = `
          <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
            <div>
              <div style="font-weight:bold; font-size:16px;">${profile.username} ${profile.title ? `(${profile.title})` : ''}</div>
              <div style="color:var(--ivory-dim);">${profile.profile?.firstName || ''} ${profile.profile?.lastName || ''}</div>
              <a href="${profile.url || `https://lichess.org/@/${profile.username}`}" target="_blank" style="color:var(--gold); text-decoration:none;">View on Lichess</a>
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

        const rapidHistory = ratingHistory.find((d) => d.name === 'Rapid');
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
  if (!game || !game.pgn) return;

  const viewer = document.getElementById('chessapi-pgn-viewer');
  const encodedPgn = encodeURIComponent(game.pgn);
  viewer.innerHTML = `
    <iframe src="https://lichess.org/embed?pgn=${encodedPgn}"
      width="100%"
      height="400"
      frameborder="0"
      style="border:0;"
      allowtransparency="true">
    </iframe>
  `;
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
