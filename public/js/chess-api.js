// chess-api.js
// Handles fetching data from Chess.com and Lichess APIs and rendering the dashboard

let chessChartInstance = null;

async function loadChessDashboard(student) {
  if (!student) return;

  const chesscomUser = student.chesscom_username;
  const lichessUser = student.lichess_username;

  const lichessCard = document.getElementById('chessapi-lichess-content');
  const chesscomCard = document.getElementById('chessapi-chesscom-content');
  const recentGamesContainer = document.getElementById('chessapi-recent-games');
  
  if (!lichessCard || !chesscomCard) return;

  lichessCard.innerHTML = lichessUser ? 'Fetching data...' : 'No Lichess username set.';
  chesscomCard.innerHTML = chesscomUser ? 'Fetching data...' : 'No Chess.com username set.';
  recentGamesContainer.innerHTML = 'Fetching recent games...';

  let ratingsData = {
    labels: [],
    chesscomBlitz: [],
    chesscomRapid: [],
    lichessBlitz: [],
    lichessRapid: []
  };

  let allGames = [];

  // Fetch Chess.com
  if (chesscomUser) {
    try {
      // 1. Profile
      const profileRes = await fetch(`https://api.chess.com/pub/player/${chesscomUser}`);
      if (profileRes.ok) {
        const profile = await profileRes.json();
        
        // 2. Stats
        const statsRes = await fetch(`https://api.chess.com/pub/player/${chesscomUser}/stats`);
        const stats = statsRes.ok ? await statsRes.json() : {};

        let blitzRating = stats.chess_blitz?.last?.rating || 'N/A';
        let rapidRating = stats.chess_rapid?.last?.rating || 'N/A';
        let puzzleRating = stats.tactics?.highest?.rating || 'N/A';

        chesscomCard.innerHTML = `
          <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
            ${profile.avatar ? `<img src="${profile.avatar}" style="width:48px;height:48px;border-radius:4px;">` : ''}
            <div>
              <div style="font-weight:bold; font-size:16px;">${profile.username} ${profile.title ? `(${profile.title})` : ''}</div>
              <div style="color:var(--ivory-dim);">${profile.name || ''}</div>
              <a href="${profile.url}" target="_blank" style="color:var(--gold); text-decoration:none;">View on Chess.com</a>
            </div>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
            <div style="background:var(--bg3); padding:8px; border-radius:6px;"><b>Blitz:</b> ${blitzRating}</div>
            <div style="background:var(--bg3); padding:8px; border-radius:6px;"><b>Rapid:</b> ${rapidRating}</div>
            <div style="background:var(--bg3); padding:8px; border-radius:6px;"><b>Puzzles:</b> ${puzzleRating}</div>
            <div style="background:var(--bg3); padding:8px; border-radius:6px;"><b>Followers:</b> ${profile.followers || 0}</div>
          </div>
        `;

        // Ratings for chart (fake history for now since chess.com doesn't give historical ratings easily without scraping archives, we'll just plot the current)
        ratingsData.chesscomBlitz.push(stats.chess_blitz?.last?.rating || null);
        ratingsData.chesscomRapid.push(stats.chess_rapid?.last?.rating || null);

        // 3. Recent Games (Fetch current month archives)
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const gamesRes = await fetch(`https://api.chess.com/pub/player/${chesscomUser}/games/${y}/${m}`);
        if (gamesRes.ok) {
          const gamesData = await gamesRes.json();
          const last5 = (gamesData.games || []).reverse().slice(0, 5);
          last5.forEach(g => {
            allGames.push({
              platform: 'Chess.com',
              url: g.url,
              pgn: g.pgn,
              white: g.white.username,
              black: g.black.username,
              result: g.white.username.toLowerCase() === chesscomUser.toLowerCase() ? g.white.result : g.black.result,
              time_class: g.time_class,
              end_time: g.end_time
            });
          });
        }
      } else {
        chesscomCard.innerHTML = `<span class="text-danger">Profile not found</span>`;
      }
    } catch (e) {
      console.error(e);
      chesscomCard.innerHTML = `<span class="text-danger">Error fetching data</span>`;
    }
  }

  // Fetch Lichess
  if (lichessUser) {
    try {
      const res = await fetch(`https://lichess.org/api/user/${lichessUser}`);
      if (res.ok) {
        const profile = await res.json();
        
        let blitzRating = profile.perfs?.blitz?.rating || 'N/A';
        let rapidRating = profile.perfs?.rapid?.rating || 'N/A';
        let puzzleRating = profile.perfs?.puzzle?.rating || 'N/A';

        lichessCard.innerHTML = `
          <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
            <div>
              <div style="font-weight:bold; font-size:16px;">${profile.username} ${profile.title ? `(${profile.title})` : ''}</div>
              <div style="color:var(--ivory-dim);">${profile.profile?.firstName || ''} ${profile.profile?.lastName || ''}</div>
              <a href="${profile.url}" target="_blank" style="color:var(--gold); text-decoration:none;">View on Lichess</a>
            </div>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
            <div style="background:var(--bg3); padding:8px; border-radius:6px;"><b>Blitz:</b> ${blitzRating}</div>
            <div style="background:var(--bg3); padding:8px; border-radius:6px;"><b>Rapid:</b> ${rapidRating}</div>
            <div style="background:var(--bg3); padding:8px; border-radius:6px;"><b>Puzzles:</b> ${puzzleRating}</div>
            <div style="background:var(--bg3); padding:8px; border-radius:6px;"><b>Followers:</b> ${profile.nbFollowers || 0}</div>
          </div>
        `;

        ratingsData.lichessBlitz.push(profile.perfs?.blitz?.rating || null);
        ratingsData.lichessRapid.push(profile.perfs?.rapid?.rating || null);

        // Fetch recent games
        const gamesRes = await fetch(`https://lichess.org/api/games/user/${lichessUser}?max=5&pgnInJson=true`, {
          headers: { 'Accept': 'application/x-ndjson' }
        });
        if (gamesRes.ok) {
          const text = await gamesRes.text();
          const games = text.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
          games.forEach(g => {
            allGames.push({
              platform: 'Lichess',
              url: `https://lichess.org/${g.id}`,
              pgn: g.pgn,
              white: g.players?.white?.user?.name || 'Anonymous',
              black: g.players?.black?.user?.name || 'Anonymous',
              result: g.winner ? (g.winner === 'white' ? '1-0' : '0-1') : '1/2-1/2',
              time_class: g.perf,
              end_time: Math.floor(g.lastMoveAt / 1000)
            });
          });
        }

      } else {
        lichessCard.innerHTML = `<span class="text-danger">Profile not found</span>`;
      }
    } catch (e) {
      console.error(e);
      lichessCard.innerHTML = `<span class="text-danger">Error fetching data</span>`;
    }
  }

  // Render Chart
  renderChessChart(ratingsData);

  // Render Games
  allGames.sort((a, b) => b.end_time - a.end_time);
  if (allGames.length > 0) {
    recentGamesContainer.innerHTML = allGames.map((g, i) => `
      <div style="background:var(--bg3); padding:10px; border-radius:6px; margin-bottom:8px; cursor:pointer; border:1px solid var(--border);" onclick="viewChessGame(${i})" class="chess-game-item">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="color:var(--gold); font-size:11px; font-weight:bold;">${g.platform} • ${g.time_class}</span>
          <span style="color:var(--ivory-dim); font-size:11px;">${new Date(g.end_time * 1000).toLocaleDateString()}</span>
        </div>
        <div style="font-size:13px;">
          <b>${g.white}</b> vs <b>${g.black}</b>
        </div>
        <div style="font-size:12px; color:var(--ivory2); margin-top:4px;">Result: ${g.result}</div>
      </div>
    `).join('');
    window.currentChessGames = allGames; // store for viewer
  } else {
    recentGamesContainer.innerHTML = '<div style="color:var(--ivory-dim); padding:10px;">No recent games found.</div>';
  }
}

function viewChessGame(index) {
  const game = window.currentChessGames[index];
  if (!game || !game.pgn) return;
  
  const viewer = document.getElementById('chessapi-pgn-viewer');
  
  // We use Lichess's iframe embed for PGN viewing as it's the most robust and requires zero dependencies
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

  // Since we only fetched current ratings in this simple implementation, we'll just show a bar chart
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
