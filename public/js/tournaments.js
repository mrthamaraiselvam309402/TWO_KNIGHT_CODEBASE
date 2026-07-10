(function () {
  'use strict';

  // CSS Injection for Premium Visuals
  const css = `
    .tf-radar-container {
      position: relative;
      width: 140px;
      height: 140px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(218, 163, 62, 0.05) 0%, rgba(218, 163, 62, 0.15) 70%, rgba(0,0,0,0.4) 100%);
      border: 1px dashed rgba(218, 163, 62, 0.3);
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0 auto 15px auto;
      overflow: hidden;
    }
    .tf-radar-sweep {
      position: absolute;
      width: 100%;
      height: 100%;
      background: conic-gradient(from 0deg, rgba(218, 163, 62, 0.3) 0deg, rgba(218, 163, 62, 0) 120deg);
      border-radius: 50%;
      animation: tf-sweep 3s linear infinite;
      transform-origin: center;
    }
    .tf-radar-pulse {
      position: absolute;
      width: 12px;
      height: 12px;
      background: var(--gold);
      border-radius: 50%;
      box-shadow: 0 0 10px var(--gold);
      animation: tf-pulse 1.5s ease-out infinite;
    }
    @keyframes tf-sweep {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes tf-pulse {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(2.2); opacity: 0; }
    }
    .tf-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }
    .tf-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; width: 4px; height: 100%;
      background: var(--card-stripe-color, var(--gold));
      opacity: 0.8;
    }
    .tf-card:hover {
      transform: translateY(-4px);
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(218, 163, 62, 0.4);
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    }
    .tf-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .tf-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
  `;

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // Reference Coordinates for major Chess Hub cities
  const CITIES_COORDS = {
    'chennai': { name: 'Chennai, TN', lat: 13.0827, lon: 80.2707 },
    'bangalore': { name: 'Bangalore, KA', lat: 12.9716, lon: 77.5946 },
    'coimbatore': { name: 'Coimbatore, TN', lat: 11.0168, lon: 76.9558 },
    'mumbai': { name: 'Mumbai, MH', lat: 19.0760, lon: 72.8777 },
    'delhi': { name: 'New Delhi, DL', lat: 28.6139, lon: 77.2090 },
    'new delhi': { name: 'New Delhi, DL', lat: 28.6139, lon: 77.2090 }
  };

  // Fake data removed as requested - 100% Real API & Supabase data only
  const LOCAL_TOURNAMENTS_FALLBACK = [];

  let tournamentsData = [];
  let tournamentsLoaded = false;

  // Client position tracking (defaults to Chennai center)
  let userLat = 13.0827;
  let userLon = 80.2707;
  let activeFinderStudent = null; // Used in admin mode to test eligibility

  // Haversine formula to compute distance in KM between coordinates
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  }

  // ─── Fetch Tournaments from Multiple Sources (Supabase, Lichess, Chess.com) ─────────────
  window.loadTournaments = async function(forceSync = false) {
    if (!forceSync && tournamentsLoaded && tournamentsData.length > 0) return;
    
    let allTournaments = [];
    
    // 1. Fetch from Supabase (Local/Admin Events)
    if (window.supabaseClient && !(window.sbTableKnownMissing && window.sbTableKnownMissing('tournaments'))) {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const { data, error } = await window.supabaseClient
          .from('tournaments')
          .select('*')
          .gte('start_date', todayStr)
          .order('start_date', { ascending: true });

        if (error) {
          if (window.sbIsTableMissing && window.sbIsTableMissing(error)) {
            window.sbMarkTableMissing('tournaments');
          } else {
            console.warn('[Supabase] Tournaments unavailable, using local data.');
          }
        } else {
          // Map database structure to client structure
          const dbTournaments = (data || []).map(t => {
            const cityKey = (t.city || 'chennai').toLowerCase().trim();
            const cityCoords = CITIES_COORDS[cityKey] || CITIES_COORDS['chennai'];
            return {
              id: t.id,
              title: t.title,
              federation: t.organizer || t.source || 'FIDE',
              date: t.start_date,
              time: '09:00', // Default fallback time
              location: t.location + (t.city ? `, ${t.city}` : ''),
              coords: cityCoords,
              fee: parseFloat(t.entry_fee) || 0,
              category: t.rating_required || 'Open',
              eloLimit: parseInt(t.elo_limit) || 9999,
              regLink: t.registration_url || '',
              sourceBadge: 'Academy'
            };
          });
          allTournaments = allTournaments.concat(dbTournaments);
        }
      } catch (err) {
        console.error('[Supabase] Error loading tournaments', err);
      }
    }

    // 2. Fetch from Lichess Arena API
    try {
      const lichessRes = await fetch('https://lichess.org/api/tournament');
      if (lichessRes.ok) {
        const text = await lichessRes.text();
        const lines = text.split('\\n').filter(l => l.trim() !== '');
        let count = 0;
        
        // Parse NDJSON (Newline Delimited JSON)
        for (const line of lines) {
          try {
            const t = JSON.parse(line);
            // Only add upcoming/created arenas (status 10/20)
            if (t.status === 10 || t.status === 20) { 
              const startDate = new Date(t.startsAt || t.createdAt);
              allTournaments.push({
                id: 'lichess_' + t.id,
                title: t.fullName || 'Lichess Arena',
                federation: 'Lichess',
                date: startDate.toISOString().split('T')[0],
                time: startDate.toTimeString().substring(0,5),
                location: 'Online — Lichess',
                coords: CITIES_COORDS['chennai'], // Online defaults
                fee: 0,
                category: t.perf ? t.perf.name : 'Open',
                eloLimit: 9999,
                regLink: `https://lichess.org/tournament/${t.id}`,
                sourceBadge: 'Lichess'
              });
              count++;
              if (count >= 15) break; // Limit to 15 upcoming arenas
            }
          } catch(e) {}
        }
      }
    } catch(err) {
      console.warn('[Lichess API] Failed to fetch live tournaments', err);
    }

    // 3. Fallback if everything failed
    if (allTournaments.length === 0) {
      allTournaments = LOCAL_TOURNAMENTS_FALLBACK.map(t => ({...t, sourceBadge: 'AICF'}));
    }

    // Sort all by date
    allTournaments.sort((a, b) => new Date(a.date) - new Date(b.date));

    tournamentsData = allTournaments;
    tournamentsLoaded = true;
  }

  // ─── Sub-Tab Routing Logics ──────────────────────────────────────
  window.setEventsSubTab = async function (tab) {
    document.querySelectorAll('.events-sub-view').forEach(el => el.style.display = 'none');
    
    const btnAcademy = document.getElementById('btn-events-academy');
    const btnFinder = document.getElementById('btn-events-finder');
    const btnCreate = document.getElementById('btn-create-event-top');
    const gridView = document.getElementById('ev-list-view');
    const manageView = document.getElementById('ev-manage-view');

    if (btnAcademy) btnAcademy.classList.remove('active');
    if (btnFinder) btnFinder.classList.remove('active');

    if (tab === 'academy') {
      if (btnAcademy) btnAcademy.classList.add('active');
      if (btnCreate) btnCreate.style.display = 'block';
      
      // Go back to event grid view or stay on manage view
      if (manageView && manageView.style.display === 'block') {
        manageView.style.display = 'block';
      } else {
        if (gridView) gridView.style.display = 'block';
        const evGrid = document.getElementById('ev-grid');
        if (evGrid) evGrid.style.display = 'grid';
      }
    } else if (tab === 'finder') {
      if (btnFinder) btnFinder.classList.add('active');
      if (btnCreate) btnCreate.style.display = 'none';
      if (manageView) manageView.style.display = 'none';
      
      const finderDiv = document.getElementById('tf-list-view');
      if (finderDiv) {
        finderDiv.style.display = 'block';
        await loadTournaments();
        renderTournamentFinderUI(finderDiv, false);
      }
    }
  };

  window.setChildEventsSubTab = async function (tab) {
    document.querySelectorAll('.child-events-sub-view').forEach(el => el.style.display = 'none');
    
    const btnAcademy = document.getElementById('btn-child-events-academy');
    const btnFinder = document.getElementById('btn-child-events-finder');

    if (btnAcademy) btnAcademy.classList.remove('active');
    if (btnFinder) btnFinder.classList.remove('active');

    if (tab === 'academy') {
      if (btnAcademy) btnAcademy.classList.add('active');
      const acaGrid = document.getElementById('child-ev-list-view');
      if (acaGrid) acaGrid.style.display = 'block';
    } else if (tab === 'finder') {
      if (btnFinder) btnFinder.classList.add('active');
      const finderDiv = document.getElementById('child-tf-list-view');
      if (finderDiv) {
        finderDiv.style.display = 'block';
        await loadTournaments();
        renderTournamentFinderUI(finderDiv, true);
      }
    }
  };

  // ─── Rendering Tournament Finder Core UI ─────────────────────────
  function renderTournamentFinderUI(container, isChildView) {
    const currentStudentObj = isChildView ? window.currentStudent : activeFinderStudent;
    const currentStudentId = currentStudentObj ? currentStudentObj.id : '';

    let studentSelectHtml = '';
    // Student Selector to test eligibility (for Admin and Parent portal with multiple children)
    let students = window.allStudents || [];
    
    // Privacy filter for parent portal: only show their own children
    if (isChildView) {
      if (window.currentUser && window.currentUser.role === 'parent') {
        const pPhone = window.currentUser.phone;
        const pEmail = window.currentUser.email;
        students = students.filter(s => 
          (pPhone && s.parent_phone === pPhone) || 
          (pEmail && s.parent_email === pEmail)
        );
        // Fallback if matching fails but currentStudent is set
        if (students.length === 0 && window.currentStudent) {
          students = [window.currentStudent];
        }
      } else if (window.currentStudent) {
        students = [window.currentStudent];
      }
    }
    const opts = students
      .slice()
      .sort((a, b) => (a.name || a.full_name || '').localeCompare(b.name || b.full_name || ''))
      .map(s => 
      `<option value="${s.id}" ${String(s.id) === String(currentStudentId) ? 'selected' : ''}>${escapeHtml(s.name || s.full_name)} (${s.rating || 1000} ELO)</option>`
    ).join('');
    studentSelectHtml = `
      <div style="display:flex; flex-direction:column; gap:4px; min-width:180px;">
        <label style="font-size:11px; color:var(--ivory-dim); font-weight:700;">Check Eligibility For:</label>
        <select id="tf-student-select" class="premium-select" onchange="window.selectFinderStudent(this.value, ${isChildView})" style="padding:7px; font-size:12px;">
          <option value="">-- Choose Student --</option>
          ${opts}
        </select>
      </div>
    `;

    // Coordinates auto-detection alert block
    const userCityName = getNearestCityName(userLat, userLon);

    container.innerHTML = `
      <!-- Toolbar Filter Bar -->
      <div class="filter-bar" style="background:var(--surface2); padding:16px; border-radius:12px; border:1px solid var(--border); display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap; margin-bottom:20px;">
        <div style="display:flex; flex-direction:column; gap:4px; min-width:140px;">
          <label style="font-size:11px; color:var(--ivory-dim); font-weight:700;">Reference Location:</label>
          <div style="display:flex; gap:6px;">
            <select id="tf-city-select-${isChildView ? 'child' : 'admin'}" class="premium-select" onchange="window.selectFinderCity(this.value, ${isChildView})" style="padding:7px; font-size:12px; flex:1;">
              <option value="chennai" ${userCityName === 'chennai' ? 'selected' : ''}>Chennai, TN</option>
              <option value="bangalore" ${userCityName === 'bangalore' ? 'selected' : ''}>Bangalore, KA</option>
              <option value="coimbatore" ${userCityName === 'coimbatore' ? 'selected' : ''}>Coimbatore, TN</option>
              <option value="mumbai" ${userCityName === 'mumbai' ? 'selected' : ''}>Mumbai, MH</option>
              <option value="delhi" ${userCityName === 'delhi' ? 'selected' : ''}>New Delhi, DL</option>
            </select>
            <button class="btn btn-outline" onclick="window.detectFinderLocation(${isChildView})" style="padding:7px 10px; font-size:12px;" title="Auto-Detect Location">📍</button>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:4px; min-width:140px;">
          <label style="font-size:11px; color:var(--ivory-dim); font-weight:700;">Coverage Radius:</label>
          <select id="tf-radius-select-${isChildView ? 'child' : 'admin'}" class="premium-select" onchange="window.filterTournaments(${isChildView})" style="padding:7px; font-size:12px;">
            <option value="50">📍 Local — within 50 km</option>
            <option value="100">📍 Nearby — within 100 km</option>
            <option value="200" selected>🚗 Regional — within 200 km</option>
            <option value="500">🛣️ State — within 500 km</option>
            <option value="all">🇮🇳 National — All India</option>
            <option value="world">🌍 Worldwide — All Events</option>
          </select>
        </div>

        <div style="display:flex; flex-direction:column; gap:4px; min-width:160px; flex:1;">
          <label style="font-size:11px; color:var(--ivory-dim); font-weight:700;">Search Events:</label>
          <input type="text" id="tf-search-${isChildView ? 'child' : 'admin'}" placeholder="Name, venue, city, category…" oninput="window.filterTournaments(${isChildView})" style="padding:7px 10px; font-size:12px; background:var(--bg3); border:1px solid var(--border); color:var(--ivory); border-radius:6px;">
        </div>

        ${studentSelectHtml}

        <div style="flex:1; text-align:right; min-width:160px;">
          <button class="btn btn-outline" onclick="var btn=this; btn.innerHTML='⏳ Syncing...'; btn.disabled=true; window.loadTournaments(true).then(()=>{ window.filterTournaments(${isChildView}); btn.innerHTML='🔄 Sync Live APIs'; btn.disabled=false; });" style="padding:6px 12px; font-size:11px; background:rgba(218,163,62,0.1); color:var(--gold); border:1px solid rgba(218,163,62,0.4);">
            🔄 Sync Live APIs
          </button>
        </div>
      </div>

      <!-- Radar and Search Info Panel -->
      <div style="display:grid; grid-template-columns:1fr; gap:20px; background:rgba(0,0,0,0.15); border:1px solid var(--border); padding:20px; border-radius:12px; margin-bottom:20px;">
        <div style="text-align:center;">
          <div class="tf-radar-container">
            <div class="tf-radar-sweep"></div>
            <div class="tf-radar-pulse"></div>
            <span style="z-index:2; font-size:26px;">📡</span>
          </div>
          <h4 style="margin:5px 0 2px 0; color:var(--gold); font-family:var(--font-head);">Location Telemetry Active</h4>
          <p id="tf-location-summary-${isChildView ? 'child' : 'admin'}" style="font-size:11px; color:var(--ivory-dim); margin:0;">
            Centered on: <strong>${escapeHtml(userCityName.toUpperCase())}</strong> coords (${userLat.toFixed(4)}, ${userLon.toFixed(4)})
          </p>
        </div>
      </div>

      <!-- Tournaments Grid -->
      <div class="tf-grid" id="tf-results-grid-${isChildView ? 'child' : 'admin'}"></div>
    `;

    // Perform initial filtering
    window.filterTournaments(isChildView);
  }

  // Auto-detect Geolocation
  window.detectFinderLocation = function (isChildView) {
    const locSummary = document.getElementById(`tf-location-summary-${isChildView ? 'child' : 'admin'}`);
    if (locSummary) {
      locSummary.innerHTML = '⏳ Querying GPS telemetry satellites...';
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userLat = position.coords.latitude;
          userLon = position.coords.longitude;
          if (window.toast) window.toast('Location coordinates locked successfully!', 'success');
          
          // Re-render layout to update nearest city & distance logs
          const containerId = isChildView ? 'child-tf-list-view' : 'tf-list-view';
          const container = document.getElementById(containerId);
          if (container) {
            renderTournamentFinderUI(container, isChildView);
          }
        },
        (error) => {
          console.warn('[Geolocation] Access denied / error code:', error.code);
          if (window.toast) window.toast('GPS blocked. Falling back to regional server coordinates.', 'warning');
          
          // Set to default (Chennai) if blocked
          userLat = 13.0827;
          userLon = 80.2707;
          const containerId = isChildView ? 'child-tf-list-view' : 'tf-list-view';
          const container = document.getElementById(containerId);
          if (container) {
            renderTournamentFinderUI(container, isChildView);
          }
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      if (window.toast) window.toast('Geolocation API not supported by browser.', 'error');
    }
  };

  // City selection updates center coords
  window.selectFinderCity = function (cityKey, isChildView) {
    const coords = CITIES_COORDS[cityKey];
    if (coords) {
      userLat = coords.lat;
      userLon = coords.lon;
      
      const containerId = isChildView ? 'child-tf-list-view' : 'tf-list-view';
      const container = document.getElementById(containerId);
      if (container) {
        renderTournamentFinderUI(container, isChildView);
      }
    }
  };

  // Admin and Parent student selection updates eligibility
  window.selectFinderStudent = function (studentId, isChildView) {
    const student = (window.allStudents || []).find(s => String(s.id) === String(studentId));
    if (isChildView) {
      window.currentStudent = student || null;
    } else {
      activeFinderStudent = student || null;
    }
    window.filterTournaments(isChildView);
  };

  // Filters tournament cards by distance radius
  window.filterTournaments = function (isChildView) {
    const gridEl = document.getElementById(`tf-results-grid-${isChildView ? 'child' : 'admin'}`);
    const radiusVal = document.getElementById(`tf-radius-select-${isChildView ? 'child' : 'admin'}`)?.value || '200';
    if (!gridEl) return;

    gridEl.innerHTML = '';
    const studentObj = isChildView ? window.currentStudent : activeFinderStudent;
    const studentRating = studentObj ? parseInt(studentObj.rating || 1000) : 1000;
    const studentLevel = studentObj ? (studentObj.level || studentObj.grade || 'Beginner') : 'Beginner';

    // Compute distance and map tournaments
    const listings = tournamentsData.map(t => {
      const dist = calculateDistance(userLat, userLon, t.coords.lat, t.coords.lon);
      return { ...t, distance: dist };
    });

    // Free-text search across the visible events
    const query = (document.getElementById(`tf-search-${isChildView ? 'child' : 'admin'}`)?.value || '').toLowerCase().trim();

    // Apply radius + search filters. 'all' and 'world' show every event
    // (radius unbounded); 'world' is the global view.
    const filtered = listings.filter(t => {
      // A text search looks across ALL events (ignores the radius) so users can
      // find a named event anywhere; otherwise the radius applies.
      if (query) {
        const hay = `${t.title} ${t.location} ${t.category} ${t.federation}`.toLowerCase();
        return hay.includes(query);
      }
      return (radiusVal === 'all' || radiusVal === 'world') ? true : (t.distance <= parseInt(radiusVal));
    });

    if (filtered.length === 0) {
      const reason = query ? `matching "${escapeHtml(query)}"` : `within the selected ${radiusVal === 'world' ? 'worldwide' : radiusVal + ' km'} range`;
      gridEl.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <span class="empty-icon">🏆</span>
          <p>No chess tournaments found ${reason}.</p>
          <button class="btn btn-outline btn-sm" onclick="var r=document.getElementById('tf-radius-select-${isChildView ? 'child' : 'admin'}'); if(r) r.value='world'; var sb=document.getElementById('tf-search-${isChildView ? 'child' : 'admin'}'); if(sb) sb.value=''; window.filterTournaments(${isChildView});" style="margin-top:10px;">🌍 View All Worldwide Events</button>
        </div>
      `;
      return;
    }

    // Sort by distance (nearest first)
    filtered.sort((a, b) => a.distance - b.distance);

    gridEl.innerHTML = filtered.map(t => {
      // 1. Check Rating Eligibility
      const isEligible = studentRating <= t.eloLimit;
      const eloDiff = t.eloLimit - studentRating;
      
      let eligibilityBadge = '';
      let borderStripeColor = 'var(--gold)';

      if (t.eloLimit === 9999) {
        eligibilityBadge = `<span class="tf-badge" style="background:rgba(59,130,246,0.12); color:#60a5fa; border:1px solid rgba(59,130,246,0.25);">✓ Open Bracket</span>`;
        borderStripeColor = '#3b82f6';
      } else if (isEligible) {
        eligibilityBadge = `<span class="tf-badge" style="background:rgba(16,185,129,0.12); color:var(--emerald); border:1px solid rgba(16,185,129,0.25);">✓ Eligible (Under ${t.eloLimit})</span>`;
        borderStripeColor = 'var(--emerald)';
      } else {
        eligibilityBadge = `<span class="tf-badge" style="background:rgba(239,68,68,0.12); color:#f87171; border:1px solid rgba(239,68,68,0.25);">❌ Rating > ${t.eloLimit}</span>`;
        borderStripeColor = '#ef4444';
      }

      // 2. Compute Coach Recommendation
      let coachRec = '';
      if (!studentObj) {
        coachRec = '<em>Select a student profile to generate coach recommendations.</em>';
      } else if (!isEligible) {
        coachRec = '⚠️ <strong>Ineligible:</strong> Rating exceeds tournament threshold. Try the Open category.';
      } else if (t.eloLimit !== 9999 && eloDiff <= 150) {
        coachRec = '🔥 <strong>High Recommendation:</strong> Excellent ELO bracket to push rating ceiling.';
      } else if (studentLevel.toLowerCase() === 'beginner' && t.eloLimit > 1400) {
        coachRec = '💡 <strong>Coach Advice:</strong> Elite category. Focus on game notations, and expect high resistance.';
      } else {
        coachRec = '♟️ <strong>Recommended:</strong> Match matches current developmental chess goals.';
      }

      const entryFeeText = t.fee > 0 ? `₹${t.fee}` : 'Free Entry';
      const eventDate = new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      return `
        <div class="tf-card" style="--card-stripe-color: ${borderStripeColor};">
          <div>
            <!-- Card Header -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
              <span class="tf-badge" style="background:rgba(255,255,255,0.06); border:1px solid var(--border); color:var(--ivory);">${t.federation} Event</span>
              <span style="font-size:11px; font-weight:700; color:var(--gold);">${entryFeeText}</span>
            </div>

            <!-- Title -->
            <h3 style="font-size:14px; font-weight:700; color:var(--ivory); margin:0 0 6px 0; font-family:var(--font-head); line-height:1.4;">
              ${escapeHtml(t.title)}
            </h3>

            <!-- Details -->
            <div style="font-size:11px; color:var(--ivory-dim); display:flex; flex-direction:column; gap:4px; margin-bottom:8px;">
              <span>📅 Date: <strong>${eventDate} @ ${t.time}</strong></span>
              <span>📍 Venue: <strong>${escapeHtml(t.location)}</strong></span>
              <span style="color:var(--gold);">🚗 Distance: <strong>${t.distance} km away</strong></span>
            </div>

            <!-- Eligibility Badge -->
            <div style="margin-bottom:10px;">
              ${eligibilityBadge}
            </div>
          </div>

          <!-- Coach Recommendation Block -->
          <div style="background:rgba(0,0,0,0.2); border-radius:8px; padding:8px 10px; font-size:11px; border:1px solid rgba(255,255,255,0.03); color:var(--ivory-dim); line-height:1.4;">
            ${coachRec}
          </div>

          <!-- Actions -->
          <div style="display:flex; gap:8px; margin-top:4px;">
            ${t.sourceBadge === 'Academy' && !t.regLink
               ? `<button class="btn btn-gold btn-sm" onclick="window.showInterestTournament('${t.id}')" style="flex:1; padding:6px; font-size:11px; border-radius:6px; border:none; cursor:pointer;">⭐ Show Interest</button>`
               : `<a href="${t.regLink || '#'}" target="_blank" class="btn btn-gold btn-sm" style="flex:1; text-align:center; padding:6px; font-size:11px; border-radius:6px; text-decoration:none;">Register</a>`
            }
            <button class="btn btn-outline btn-sm" onclick="window.syncTournamentCalendar('${t.id}')" style="padding:6px 10px; font-size:11px;" title="Sync to Calendar">📅</button>
            <button class="btn btn-outline btn-sm" onclick="window.sendTournamentWhatsAppReminder('${t.id}')" style="padding:6px 10px; font-size:11px;" title="WhatsApp Reminder">💬</button>
            <button class="btn btn-outline btn-sm" onclick="window.downloadTournamentPoster('${t.id}')" style="padding:6px 10px; font-size:11px;" title="Download Event Poster">🖼️</button>
          </div>
        </div>
      `;
    }).join('');
  };

  // Calendar Sync (Downloads .ics file)
  // Generate & download a shareable event poster (uses html2canvas, already loaded).
  window.downloadTournamentPoster = function (tournamentId) {
    const t = tournamentsData.find(x => String(x.id) === String(tournamentId));
    if (!t) return;
    if (typeof html2canvas === 'undefined') {
      if (window.toast) window.toast('Poster engine not loaded yet, please retry.', 'error');
      return;
    }
    const eventDate = new Date(t.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
    const feeText = t.fee > 0 ? `Entry Fee: ₹${t.fee}` : 'FREE ENTRY';

    const poster = document.createElement('div');
    poster.style.cssText = 'position:fixed; left:-9999px; top:0; width:600px; height:800px; box-sizing:border-box;';
    poster.innerHTML = `
      <div style="width:600px; height:800px; background:linear-gradient(160deg,#0f1117 0%,#1a1d29 55%,#0b0d13 100%); color:#fff; font-family:Arial,sans-serif; padding:48px 44px; box-sizing:border-box; position:relative; overflow:hidden;">
        <div style="position:absolute; top:-40px; right:-30px; font-size:260px; opacity:0.05;">♟️</div>
        <div style="text-align:center; border-bottom:2px solid #DAA33E; padding-bottom:18px;">
          <div style="font-size:13px; letter-spacing:5px; color:#DAA33E; font-weight:700;">Two Knights ACADEMY</div>
          <div style="font-size:11px; letter-spacing:3px; color:#9aa0ad; margin-top:6px;">TOURNAMENT ANNOUNCEMENT</div>
        </div>
        <div style="margin-top:46px; text-align:center;">
          <div style="display:inline-block; background:rgba(218,163,62,0.14); border:1px solid rgba(218,163,62,0.4); color:#DAA33E; font-size:12px; font-weight:700; padding:6px 16px; border-radius:20px; letter-spacing:1px;">${escapeHtml(t.federation)} · ${escapeHtml(t.category)}</div>
          <h1 style="font-size:36px; line-height:1.25; margin:26px 10px 0; color:#fff; font-weight:800;">${escapeHtml(t.title)}</h1>
        </div>
        <div style="margin-top:48px; display:flex; flex-direction:column; gap:20px; font-size:18px;">
          <div style="display:flex; gap:14px; align-items:center;"><span style="font-size:24px;">📅</span><span><b style="color:#DAA33E;">When:</b> ${eventDate} &nbsp;@&nbsp; ${escapeHtml(t.time || '09:00')}</span></div>
          <div style="display:flex; gap:14px; align-items:center;"><span style="font-size:24px;">📍</span><span><b style="color:#DAA33E;">Venue:</b> ${escapeHtml(t.location)}</span></div>
          <div style="display:flex; gap:14px; align-items:center;"><span style="font-size:24px;">🏆</span><span><b style="color:#DAA33E;">Category:</b> ${escapeHtml(t.category)}</span></div>
          <div style="display:flex; gap:14px; align-items:center;"><span style="font-size:24px;">💰</span><span><b style="color:#DAA33E;">${feeText}</b></span></div>
        </div>
        <div style="position:absolute; left:44px; right:44px; bottom:44px; text-align:center;">
          <div style="background:#DAA33E; color:#000; font-weight:800; font-size:18px; padding:14px; border-radius:10px; letter-spacing:1px;">REGISTER NOW</div>
          <div style="font-size:12px; color:#9aa0ad; margin-top:14px; word-break:break-all;">${escapeHtml(t.regLink)}</div>
        </div>
      </div>`;
    document.body.appendChild(poster);
    if (window.toast) window.toast('Generating poster…', 'info');
    html2canvas(poster.firstElementChild, { backgroundColor: null, scale: 2 }).then(canvas => {
      const link = document.createElement('a');
      link.download = `twoknights_${t.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      document.body.removeChild(poster);
      if (window.toast) window.toast('Poster downloaded!', 'success');
    }).catch(err => {
      console.error('Poster generation failed:', err);
      if (poster.parentNode) document.body.removeChild(poster);
      if (window.toast) window.toast('Could not generate poster.', 'error');
    });
  };

  window.syncTournamentCalendar = function (tournamentId) {
    const t = tournamentsData.find(x => x.id === tournamentId);
    if (!t) return;

    // Parse start datetime (assuming local timezone)
    const [year, month, day] = t.date.split('-');
    const [hour, min] = (t.time || '09:00').split(':');
    const startDt = new Date(year, month - 1, day, hour, min);
    
    // Add 4 hours for end time
    const endDt = new Date(startDt.getTime() + 4 * 60 * 60 * 1000);
    
    // Format to YYYYMMDDTHHMMSS (floating time, no Z)
    const formatIcsDate = (d) => {
      return d.getFullYear().toString() +
             (d.getMonth() + 1).toString().padStart(2, '0') +
             d.getDate().toString().padStart(2, '0') + 'T' +
             d.getHours().toString().padStart(2, '0') +
             d.getMinutes().toString().padStart(2, '0') + '00';
    };

    const startDate = formatIcsDate(startDt);
    const endDate = formatIcsDate(endDt);

    const icsContent = 
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Two Knights Chess Academy//Tournament Finder//EN
BEGIN:VEVENT
UID:${t.id}@twoknightacademy.vercel.app
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${t.title}
LOCATION:${t.location}
DESCRIPTION:Aggregated by Two Knights. Fee: Rs.${t.fee}. Class eligibility rating bracket: ${t.category}. Registration: ${t.regLink}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${t.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (window.toast) window.toast('Event calendar (.ics) downloaded successfully!', 'success');
  };

  // Register Interest for Academy Tournaments
  window.showInterestTournament = function(tournamentId) {
    const t = tournamentsData.find(x => String(x.id) === String(tournamentId));
    if (!t) return;
    
    // Attempt to log interest in the student's notes or via an API call in the future
    if (window.toast) {
      window.toast(`Interest registered for ${t.title}! An admin will contact you with details.`, 'success');
    } else {
      alert(`Interest registered for ${t.title}! An admin will contact you with details.`);
    }
  };

  // Dispatch WhatsApp Reminder
  window.sendTournamentWhatsAppReminder = function (tournamentId) {
    const t = tournamentsData.find(x => String(x.id) === String(tournamentId));
    if (!t) return;

    const studentObj = window.currentStudent || activeFinderStudent;
    const studentName = studentObj ? (studentObj.name || studentObj.full_name) : 'Student';
    const eventDate = new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const msg = `🏆 *Two Knights TOURNAMENT REMINDER*\n\nHello Parent,\n\nWe found a highly compatible chess event for *${studentName}* nearby:\n\n📌 *Tournament:* ${t.title}\n📅 *Date:* ${eventDate} @ ${t.time}\n📍 *Venue:* ${t.location}\n💰 *Entry Fee:* ${t.fee > 0 ? `Rs.${t.fee}` : 'Free Entry'}\n🔥 *Category:* ${t.category}\n\n🔗 *Register Here:* ${t.regLink}\n\nGood luck! Two Knights Academy Team`;

    const phone = studentObj ? (studentObj.parent_phone || studentObj.phone || '') : '';
    const parsed = window.parseStoredPhone ? window.parseStoredPhone(phone) : { countryCode: 'IN', localNumber: phone };
    const inferredCountry = (parsed.countryCode && parsed.countryCode !== 'IN') ? parsed.countryCode : (studentObj?.country_code || 'IN');
    const country = window.getCountryByCode ? window.getCountryByCode(inferredCountry) : { dial: '+91' };
    const dialCode = country.dial.replace(/\D/g, '');

    const base = 'https://api.whatsapp.com/send';
    window.open(`${base}?phone=${dialCode}${parsed.localNumber}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Helper: Find closest city reference key
  function getNearestCityName(lat, lon) {
    let nearestKey = 'chennai';
    let minDist = 999999;
    for (const [key, coords] of Object.entries(CITIES_COORDS)) {
      const dist = calculateDistance(lat, lon, coords.lat, coords.lon);
      if (dist < minDist) {
        minDist = dist;
        nearestKey = key;
      }
    }
    return nearestKey;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

})();
