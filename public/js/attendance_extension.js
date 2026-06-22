// --- NEW MONTHLY MATRIX ATTENDANCE LOGIC ---
window.openMonthlyMatrix = function() {
  const monthInput = document.getElementById('mat-month');
  if (monthInput) monthInput.value = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  const coachSelect = document.getElementById('mat-coach');
  if (coachSelect) {
    coachSelect.innerHTML = '<option value="">All Coaches</option>' + 
      allCoaches.map(c => `<option value="${c.id}">${getCoachName(c)}</option>`).join('');
  }
  
  renderMonthlyMatrix();
  openModal('monthly-attendance-modal');
};

window.renderMonthlyMatrix = function() {
  const container = document.getElementById('mat-container');
  if (!container) return;
  
  const monthVal = document.getElementById('mat-month')?.value || new Date().toISOString().slice(0, 7);
  const coachId = document.getElementById('mat-coach')?.value;
  
  const [year, month] = monthVal.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  
  let filteredStudents = allStudents.filter(s => s.status === 'active');
  if (coachId) filteredStudents = filteredStudents.filter(s => String(s.coach_id) === String(coachId));
  
  // Build header
  let html = `<table style="width:max-content;font-size:12px;text-align:center;border-collapse:collapse"><thead><tr>`;
  html += `<th style="position:sticky;left:0;background:var(--bg2);z-index:2;text-align:left;min-width:150px">Student</th>`;
  for (let i = 1; i <= daysInMonth; i++) {
    html += `<th style="min-width:30px">${i}</th>`;
  }
  html += `</tr></thead><tbody>`;
  
  // Build rows
  filteredStudents.forEach(s => {
    html += `<tr>`;
    html += `<td style="position:sticky;left:0;background:var(--bg2);z-index:1;text-align:left;font-weight:600;white-space:nowrap;border-bottom:1px solid var(--border)">
               ${escapeHtml(getStudentName(s))}
             </td>`;
             
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const record = allAttendance.find(a => String(a.student_id) === String(s.id) && a.date === dateStr);
      const status = record ? record.status : '';
      
      let cellContent = '';
      let cellStyle = 'cursor:pointer;border:1px solid var(--border);';
      if (status === 'present') { cellContent = '🟩'; cellStyle += 'background:rgba(16,185,129,0.1);'; }
      else if (status === 'absent') { cellContent = '🟥'; cellStyle += 'background:rgba(239,68,68,0.1);'; }
      else if (status === 'late') { cellContent = '🟨'; }
      else if (status === 'excused') { cellContent = '⬜'; }
      
      html += `<td style="${cellStyle}" onclick="toggleCellAttendance('${s.id}', '${dateStr}', '${status}')">
                 ${cellContent}
               </td>`;
    }
    html += `</tr>`;
  });
  
  html += `</tbody></table>`;
  container.innerHTML = html;
};

window.toggleCellAttendance = async function(studentId, date, currentStatus) {
  // Cycle: present -> absent -> empty
  let newStatus = '';
  if (!currentStatus) newStatus = 'present';
  else if (currentStatus === 'present') newStatus = 'absent';
  else newStatus = '';
  
  // Optimistic UI update in local state
  const existingIndex = allAttendance.findIndex(a => String(a.student_id) === String(studentId) && a.date === date);
  if (newStatus === '') {
    if (existingIndex > -1) {
      allAttendance.splice(existingIndex, 1); // remove
    }
  } else {
    if (existingIndex > -1) {
      allAttendance[existingIndex].status = newStatus;
    } else {
      allAttendance.push({ student_id: studentId, date: date, status: newStatus, notes: '' });
    }
  }
  
  // Re-render
  renderMonthlyMatrix();
  
  // API Call silently in background
  if (newStatus === '') {
    apiCall('/api/attendance', { method: 'POST', body: JSON.stringify([{student_id: studentId, date: date, status: 'absent'}]) }).catch(()=>{});
  } else {
    apiCall('/api/attendance', { method: 'POST', body: JSON.stringify([{student_id: studentId, date: date, status: newStatus}]) }).catch(()=>{});
  }
};

// --- MASTER SCHEDULE MATRIX (100% DYNAMIC) ---
// No more hardcoded data. Everything comes from live student/coach data via
// window.buildDynamicSchedule() defined in scripts.js.

window.openMasterSchedule = function() {
  const container = document.getElementById('master-schedule-container');
  if (!container) return;

  const html = `
    <style>
        #master-schedule-container {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
            background-color: #141722;
            color: #ffffff;
            font-size: 11px;
            padding: 10px;
        }

        #master-schedule-container .header {
            text-align: center;
            margin-bottom: 12px;
        }

        #master-schedule-container h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 500;
            letter-spacing: 0.5px;
            color: #ffffff;
        }

        #master-schedule-container .subtitle {
            margin-top: 4px;
            font-size: 12px;
            color: #8a90a6;
        }

        #master-schedule-container table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 3px;
            table-layout: fixed;
        }

        #master-schedule-container th {
            background-color: #1c2030;
            color: #a4b0cb;
            font-weight: 600;
            padding: 8px;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-radius: 2px;
            font-size: 11px;
            border: none;
        }

        #master-schedule-container th.coach-header {
            width: 11%;
        }

        #master-schedule-container td {
            padding: 4px;
            vertical-align: middle;
            text-align: center;
            background-color: #1a1e2e;
            border-radius: 2px;
            height: 60px;
            border: none;
        }

        #master-schedule-container td.coach-cell {
            font-weight: bold;
            font-size: 12px;
            text-align: center;
            padding: 4px;
            line-height: 1.3;
        }

        /* Border highlights per coach */
        #master-schedule-container .row-rohith { border-left: 3.5px solid #3b5998; }
        #master-schedule-container .row-ranjith { border-left: 3.5px solid #27ae60; }
        #master-schedule-container .row-gyana { border-left: 3.5px solid #8e44ad; }
        #master-schedule-container .row-arivu { border-left: 3.5px solid #d35400; }
        #master-schedule-container .row-yogesh { border-left: 3.5px solid #2ecc71; }
        #master-schedule-container .row-sudhin { border-left: 3.5px solid #f39c12; }
        #master-schedule-container .row-vasanth { border-left: 3.5px solid #16a085; }
        #master-schedule-container .row-vishnu { border-left: 3.5px solid #7f8c8d; }

        #master-schedule-container .empty-cell {
            color: #2c3242;
            font-size: 12px;
        }

        #master-schedule-container .block {
            display: block;
            padding: 4px;
            margin: 2px 0;
            border-radius: 3px;
            color: #ffffff;
            font-weight: 600;
            line-height: 1.2;
            text-align: left;
        }

        #master-schedule-container .bg-rohith { background-color: #3b5998; }
        #master-schedule-container .bg-ranjith { background-color: #27ae60; }
        #master-schedule-container .bg-gyana { background-color: #8e44ad; }
        #master-schedule-container .bg-arivu { background-color: #d35400; }
        #master-schedule-container .bg-yogesh { background-color: #2ecc71; }
        #master-schedule-container .bg-sudhin { background-color: #f39c12; }
        #master-schedule-container .bg-vasanth { background-color: #16a085; }
        #master-schedule-container .bg-vishnu { background-color: #7f8c8d; }

        #master-schedule-container .time-text {
            display: block;
            font-size: 10px;
            opacity: 0.85;
            margin-top: 2px;
            font-weight: normal;
        }
        
        #master-schedule-container .student-text {
            display: block;
            font-size: 10px;
            font-style: italic;
            opacity: 0.95;
            font-weight: normal;
            margin-top: 3px;
            border-top: 1px solid rgba(255, 255, 255, 0.15);
            padding-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        #master-schedule-container .footer {
            text-align: center;
            margin-top: 12px;
            font-size: 11px;
            color: #4f5d75;
        }
    </style>

    <div class="header">
        <h1>Chess Academy &mdash; Coach Master Schedule Matrix</h1>
        <div class="subtitle">Complete Unified Rosters with Strict Chronological Sequencing</div>
    </div>

    <table>
        <thead>
            <tr>
                <th class="coach-header">Coach</th>
                <th>Mon</th>
                <th>Tue</th>
                <th>Wed</th>
                <th>Thu</th>
                <th>Fri</th>
                <th>Sat</th>
                <th>Sun</th>
            </tr>
        </thead>
        <tbody>
            <!-- Rohith -->
            <tr>
                <td class="coach-cell row-rohith">Rohith<br><span style="font-size:10px; font-weight:normal; color:#8a90a6;">Beginner</span></td>
                <td class="empty-cell">&mdash;</td>
                <td>
                    <div class="block bg-rohith">Batch 1<span class="time-text">5:00 AM - 5:40 AM</span><span class="student-text">Sreelaxmi</span></div>
                </td>
                <td>
                    <div class="block bg-rohith">Batch 1<span class="time-text">5:00 AM - 5:40 AM</span><span class="student-text">Sreelaxmi</span></div>
                    <div class="block bg-rohith">Batch 2<span class="time-text">8:00 PM - 9:00 PM</span><span class="student-text">Samiksha</span></div>
                </td>
                <td>
                    <div class="block bg-rohith">Batch 2<span class="time-text">8:00 PM - 9:00 PM</span><span class="student-text">Samiksha</span></div>
                </td>
                <td class="empty-cell">&mdash;</td>
                <td>
                    <div class="block bg-rohith">Batch 1<span class="time-text">5:00 AM - 5:40 AM</span><span class="student-text">Sreelaxmi</span></div>
                </td>
                <td class="empty-cell">&mdash;</td>
            </tr>

            <!-- Ranjith -->
            <tr>
                <td class="coach-cell row-ranjith">Ranjith<br><span style="font-size:10px; font-weight:normal; color:#8a90a6;">Advanced</span></td>
                <td class="empty-cell">&mdash;</td>
                <td class="empty-cell">&mdash;</td>
                <td>
                    <div class="block bg-ranjith">Batch 1<span class="time-text">2:45 PM - 3:45 PM</span><span class="student-text">Sakthi, Sathya</span></div>
                </td>
                <td class="empty-cell">&mdash;</td>
                <td>
                    <div class="block bg-ranjith">Batch 1<span class="time-text">2:45 PM - 3:45 PM</span><span class="student-text">Sakthi, Sathya</span></div>
                </td>
                <td>
                    <div class="block bg-ranjith">Batch 2<span class="time-text">7:00 PM - 8:00 PM</span><span class="student-text">Riyas, Susil, Varun</span></div>
                </td>
                <td>
                    <div class="block bg-ranjith">Batch 2<span class="time-text">7:00 PM - 8:00 PM</span><span class="student-text">Riyas, Susil, Varun</span></div>
                </td>
            </tr>

            <!-- Gyana Suriya -->
            <tr>
                <td class="coach-cell row-gyana">Gyana Suriya<br><span style="font-size:10px; font-weight:normal; color:#8a90a6;">Beginner</span></td>
                <td class="empty-cell">&mdash;</td>
                <td class="empty-cell">&mdash;</td>
                <td>
                    <div class="block bg-gyana">Batch 1<span class="time-text">5:40 AM - 6:20 AM</span><span class="student-text">Ekash</span></div>
                    <div class="block bg-gyana">Batch 2<span class="time-text">7:00 AM - 8:00 AM</span><span class="student-text">Nigunan, Praneev</span></div>
                </td>
                <td class="empty-cell">&mdash;</td>
                <td>
                    <div class="block bg-gyana">Batch 1<span class="time-text">5:40 AM - 6:20 AM</span><span class="student-text">Ekash</span></div>
                    <div class="block bg-gyana">Batch 2<span class="time-text">7:00 AM - 8:00 AM</span><span class="student-text">Nigunan, Praneev</span></div>
                </td>
                <td>
                    <div class="block bg-gyana">Batch 3<span class="time-text">7:00 PM - 8:00 PM</span><span class="student-text">Aara, Anush, Rakshitha, Shervin</span></div>
                </td>
                <td>
                    <div class="block bg-gyana">Batch 3<span class="time-text">7:00 PM - 8:00 PM</span><span class="student-text">Aara, Anush, Rakshitha, Shervin</span></div>
                </td>
            </tr>

            <!-- Arivuselvam -->
            <tr>
                <td class="coach-cell row-arivu">Arivuselvam<br><span style="font-size:10px; font-weight:normal; color:#8a90a6;">Advanced</span></td>
                <td>
                    <div class="block bg-arivu">Batch 1<span class="time-text">7:00 PM - 8:00 PM</span><span class="student-text">Eduveer, Yugan</span></div>
                    <div class="block bg-arivu">Batch 2<span class="time-text">8:00 PM - 9:00 PM</span><span class="student-text">Aarunya, Magathi, Pranav</span></div>
                    <div class="block bg-arivu">Batch 3<span class="time-text">8:00 PM - 9:00 PM</span><span class="student-text">Aatish, Uttsan</span></div>
                </td>
                <td>
                    <div class="block bg-arivu">Batch 4<span class="time-text">7:00 PM - 8:00 PM</span><span class="student-text">Mukilan, Sashwin</span></div>
                </td>
                <td>
                    <div class="block bg-arivu">Batch 1<span class="time-text">7:00 PM - 8:00 PM</span><span class="student-text">Eduveer, Yugan</span></div>
                    <div class="block bg-arivu">Batch 2<span class="time-text">8:00 PM - 9:00 PM</span><span class="student-text">Aarunya, Magathi, Pranav</span></div>
                    <div class="block bg-arivu">Batch 3<span class="time-text">8:00 PM - 9:00 PM</span><span class="student-text">Aatish, Uttsan</span></div>
                </td>
                <td>
                    <div class="block bg-arivu">Batch 4<span class="time-text">7:00 PM - 8:00 PM</span><span class="student-text">Mukilan, Sashwin</span></div>
                </td>
                <td class="empty-cell">&mdash;</td>
                <td class="empty-cell">&mdash;</td>
                <td class="empty-cell">&mdash;</td>
            </tr>

            <!-- Yogesh -->
            <tr>
                <td class="coach-cell row-yogesh">Yogesh<br><span style="font-size:10px; font-weight:normal; color:#8a90a6;">Beginner</span></td>
                <td>
                    <!-- MOVED HERE: Batch 4 Monday -->
                    <div class="block bg-yogesh">Batch 4<span class="time-text">7:30 PM - 8:30 PM</span><span class="student-text">Poornima, Praveen, Magathi, Anush</span></div>
                </td>
                <td class="empty-cell">&mdash;</td>
                <td>
                    <!-- MOVED HERE: Batch 4 Wednesday -->
                    <div class="block bg-yogesh">Batch 4<span class="time-text">7:30 PM - 8:30 PM</span><span class="student-text">Poornima, Praveen, Magathi, Anush</span></div>
                </td>
                <td>
                    <div class="block bg-yogesh">Batch 1<span class="time-text">6:00 AM - 7:00 AM</span><span class="student-text">Jeevan</span></div>
                </td>
                <td>
                    <div class="block bg-yogesh">Batch 1<span class="time-text">6:00 AM - 7:00 AM</span><span class="student-text">Jeevan</span></div>
                </td>
                <td>
                    <div class="block bg-yogesh">Batch 2<span class="time-text">6:00 PM - 7:00 PM</span><span class="student-text">Banu Priya, Dinesh, Sai, Venkatesh Son</span></div>
                    <div class="block bg-yogesh">Batch 3<span class="time-text">7:30 PM - 8:30 PM</span><span class="student-text">Athvik, Mohammad Rayan, Pranesh</span></div>
                </td>
                <td>
                    <div class="block bg-yogesh">Batch 2<span class="time-text">6:00 PM - 7:00 PM</span><span class="student-text">Banu Priya, Dinesh, Sai, Venkatesh Son</span></div>
                    <div class="block bg-yogesh">Batch 3<span class="time-text">7:30 PM - 8:30 PM</span><span class="student-text">Athvik, Mohammad Rayan, Pranesh</span></div>
                </td>
            </tr>

            <!-- Sudhin -->
            <tr>
                <td class="coach-cell row-sudhin">Sudhin<br><span style="font-size:10px; font-weight:normal; color:#8a90a6;">Beginner</span></td>
                <td class="empty-cell">&mdash;</td>
                <td class="empty-cell">&mdash;</td>
                <td class="empty-cell">&mdash;</td>
                <td class="empty-cell">&mdash;</td>
                <td class="empty-cell">&mdash;</td>
                <td>
                    <div class="block bg-sudhin">Batch 1<span class="time-text">7:00 PM - 8:00 PM</span><span class="student-text">Aakif, Pranish, Venkatesh Daughter</span></div>
                </td>
                <td>
                    <div class="block bg-sudhin">Batch 1<span class="time-text">7:00 PM - 8:00 PM</span><span class="student-text">Aakif, Pranish, Venkatesh Daughter</span></div>
                </td>
            </tr>

            <!-- Vasanth Kumar -->
            <tr>
                <td class="coach-cell row-vasanth">Vasanth Kumar<br><span style="font-size:10px; font-weight:normal; color:#8a90a6;">Beginner</span></td>
                <td class="empty-cell">&mdash;</td>
                <td class="empty-cell">&mdash;</td>
                <td class="empty-cell">&mdash;</td>
                <td class="empty-cell">&mdash;</td>
                <td>
                    <div class="block bg-vasanth">Batch 1<span class="time-text">6:00 PM - 7:00 PM</span><span class="student-text">Harsha (Venkatesh Son)</span></div>
                </td>
                <td>
                    <div class="block bg-vasanth">Batch 1<span class="time-text">8:00 AM - 9:00 AM</span><span class="student-text">Harsha (Venkatesh Son)</span></div>
                </td>
                <td class="empty-cell">&mdash;</td>
            </tr>

            <!-- Vishnu -->
            <tr>
                <td class="coach-cell row-vishnu">Vishnu<br><span style="font-size:10px; font-weight:normal; color:#8a90a6;">Intermediate</span></td>
                <td class="empty-cell">&mdash;</td>
                <td class="empty-cell">&mdash;</td>
                <td>
                    <div class="block bg-vishnu">Batch 1<span class="time-text">6:00 PM - 7:00 PM</span><span class="student-text">Abinitha</span></div>
                    <div class="block bg-vishnu">Batch 2<span class="time-text">7:00 PM - 8:00 PM</span><span class="student-text">Yogesh</span></div>
                </td>
                <td>
                    <div class="block bg-vishnu">Batch 1<span class="time-text">6:00 PM - 7:00 PM</span><span class="student-text">Abinitha</span></div>
                    <div class="block bg-vishnu">Batch 2<span class="time-text">7:00 PM - 8:00 PM</span><span class="student-text">Yogesh</span></div>
                </td>
                <td>
                    <div class="block bg-vishnu">Batch 3<span class="time-text">7:00 PM - 8:00 PM</span><span class="student-text">Akmal, Anfal, Buvargan...</span></div>
                </td>
                <td>
                    <div class="block bg-vishnu">Batch 3<span class="time-text">7:00 PM - 8:00 PM</span><span class="student-text">Akmal, Anfal, Buvargan...</span></div>
                </td>
                <td class="empty-cell">&mdash;</td>
            </tr>
        </tbody>
    </table>

    <div class="footer">
        Chess Academy Master Matrix &bull; Sync Status: Verified Secure
    </div>
  `;
  
  container.innerHTML = html;
  openModal('master-schedule-modal');
};

// --- Inline Batch Editor ---
window.openBatchInlineEdit = function(coachId, batchIndex, btnEl) {
  // Remove any existing popover
  document.querySelectorAll('.mat-edit-popover').forEach(el => el.remove());

  // Get live schedule data
  const scheduleData = (typeof window.buildDynamicSchedule === 'function') ? window.buildDynamicSchedule() : [];
  const coachEntry = scheduleData.find(c => String(c.coachId) === String(coachId));
  if (!coachEntry || !coachEntry.batches[batchIndex]) return;

  const batch = coachEntry.batches[batchIndex];
  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Parse existing days and time from schedule string (e.g. "Monday & Wednesday | 6:00 PM - 7:00 PM")
  let currentDays = [];
  let currentTime = '';
  if (batch.schedule && batch.schedule.includes('|')) {
    const parts = batch.schedule.split('|');
    const daysPart = parts[0].toLowerCase();
    currentTime = parts[1].trim();
    allDays.forEach(d => {
      if (daysPart.includes(d.toLowerCase())) currentDays.push(d);
    });
  }

  // Position popover near the button
  const rect = btnEl.getBoundingClientRect();
  const popX = Math.min(rect.left, window.innerWidth - 400);
  const popY = Math.min(rect.bottom + 4, window.innerHeight - 400);

  const popover = document.createElement('div');
  popover.className = 'mat-edit-popover';
  popover.style.left = popX + 'px';
  popover.style.top = popY + 'px';

  const dayPillsHtml = allDays.map(d => 
    `<span class="day-pill ${currentDays.includes(d) ? 'active' : ''}" data-day="${d}" onclick="this.classList.toggle('active')">${d.substring(0,3)}</span>`
  ).join('');

  // Students in this batch — allow removal
  const studentChipsHtml = (batch.students || []).map(name => 
    `<span style="display:inline-flex; align-items:center; gap:4px; background:#2c3242; padding:3px 8px; border-radius:4px; font-size:11px; margin:2px;">
       ${name}
     </span>`
  ).join('');

  popover.innerHTML = `
    <h4>✏️ Edit ${batch.name} — ${coachEntry.coach}</h4>
    <label>Class Days</label>
    <div class="day-pills" id="mat-edit-days">${dayPillsHtml}</div>
    <label>Time Slot</label>
    <input type="text" id="mat-edit-time" value="${currentTime}" placeholder="e.g. 6:00 PM - 7:00 PM">
    <label>Students in Batch</label>
    <div style="margin-top:4px; max-height:80px; overflow-y:auto;">${studentChipsHtml || '<span style="color:#8a90a6; font-size:11px;">No students assigned</span>'}</div>
    <div class="mat-edit-actions">
      <button class="mat-btn-cancel" onclick="this.closest('.mat-edit-popover').remove()">Cancel</button>
      <button class="mat-btn-save" onclick="window.saveBatchInlineEdit('${coachId}', ${batchIndex})">Save</button>
    </div>
  `;

  document.body.appendChild(popover);

  // Close on outside click
  setTimeout(() => {
    const handler = function(e) {
      if (!popover.contains(e.target)) {
        popover.remove();
        document.removeEventListener('mousedown', handler);
      }
    };
    document.addEventListener('mousedown', handler);
  }, 50);
};

window.saveBatchInlineEdit = async function(coachId, batchIndex) {
  const popover = document.querySelector('.mat-edit-popover');
  if (!popover) return;

  // Read new days
  const activePills = popover.querySelectorAll('.day-pill.active');
  const newDays = Array.from(activePills).map(el => el.dataset.day);
  const newTime = document.getElementById('mat-edit-time')?.value || '';

  if (newDays.length === 0) {
    if (window.toast) window.toast('Please select at least one day.', 'error');
    return;
  }

  // Build the new schedule string
  const daysString = newDays.join(' & ');
  const newSchedule = newTime ? `${daysString} | ${newTime}` : daysString;

  // Find all students in this batch and update their schedule notes
  const scheduleData = (typeof window.buildDynamicSchedule === 'function') ? window.buildDynamicSchedule() : [];
  const coachEntry = scheduleData.find(c => String(c.coachId) === String(coachId));
  if (!coachEntry || !coachEntry.batches[batchIndex]) return;

  const batch = coachEntry.batches[batchIndex];
  const studentNames = batch.students || [];

  if (window.toast) window.toast(`Updating schedule for ${studentNames.length} students...`, 'info');

  let successCount = 0;
  for (const name of studentNames) {
    const student = (window.allStudents || []).find(s =>
      (s.name || s.full_name || '').toLowerCase().includes(name.toLowerCase())
    );
    if (!student) continue;

    // Get existing schedule data from the student
    const existingSchedule = window.extractScheduleJSON ? window.extractScheduleJSON(student.notes, student) : null;
    const schedData = {
      ...(existingSchedule || {}),
      regDays: daysString,
      regTime: newTime,
      coachId: coachId,
      coachName: coachEntry.coach
    };

    if (window.persistScheduleForStudent) {
      const ok = await window.persistScheduleForStudent(student, schedData);
      if (ok) successCount++;
    }
  }

  popover.remove();

  if (window.toast) window.toast(`Schedule updated for ${successCount}/${studentNames.length} students.`, successCount > 0 ? 'success' : 'error');

  // Re-render the matrix with fresh data
  window.openMasterSchedule();
};
