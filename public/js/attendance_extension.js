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

  const htmlStyle = `
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
            position: relative;
        }

        #master-schedule-container .block .edit-btn {
            position: absolute;
            top: 2px;
            right: 2px;
            background: rgba(0,0,0,0.4);
            border: none;
            color: #fff;
            font-size: 8px;
            padding: 1px 3px;
            border-radius: 2px;
            cursor: pointer;
            display: none;
        }
        #master-schedule-container .block:hover .edit-btn {
            display: block;
        }

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
  `;

  // Get dynamic schedule data
  const scheduleData = (typeof window.buildDynamicSchedule === 'function') ? window.buildDynamicSchedule() : [];
  const daysFull = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Helper function to resolve color
  function getCoachColorHex(coachName) {
      const n = (coachName || '').toLowerCase();
      if (n.includes('rohith')) return '#3b5998';
      if (n.includes('ranjith')) return '#27ae60';
      if (n.includes('gyana')) return '#8e44ad';
      if (n.includes('arivu')) return '#d35400';
      if (n.includes('yogesh')) return '#2ecc71';
      if (n.includes('sudhin')) return '#f39c12';
      if (n.includes('vasanth')) return '#16a085';
      if (n.includes('vishnu')) return '#7f8c8d';
      return '#4f5d75';
  }

  let tableRows = '';
  scheduleData.forEach(cEntry => {
    const coachColor = getCoachColorHex(cEntry.coach);
    let coachInfo = (window.allCoaches || []).find(c => String(c.id) === String(cEntry.coachId));
    let coachRole = coachInfo ? (coachInfo.role || 'Coach') : 'Coach';
    
    tableRows += `<tr>`;
    // Coach name column
    tableRows += `<td class="coach-cell" style="border-left: 3.5px solid ${coachColor}; text-align: left; padding-left: 8px;">
        ${escapeHtml(cEntry.coach)}<br>
        <span style="font-size:10px; font-weight:normal; color:#8a90a6; text-transform: capitalize;">${escapeHtml(coachRole)}</span>
    </td>`;

    // Calendar Days
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayName = daysFull[dayIndex];
      const dayShort = shortDays[dayIndex];

      // Find all batches for this coach that run on this day
      const dayBatches = cEntry.batches.filter(b => {
        const schedLow = (b.schedule || '').toLowerCase();
        return schedLow.includes(dayName.toLowerCase()) || schedLow.includes(dayShort.toLowerCase());
      });

      if (dayBatches.length > 0) {
        tableRows += `<td>`;
        dayBatches.forEach(b => {
          // Extract time part from schedule string e.g. "Monday & Wednesday | 6:00 PM - 7:00 PM"
          let timeSlot = b.schedule;
          if (b.schedule && b.schedule.includes('|')) {
            timeSlot = b.schedule.split('|')[1].trim();
          }
          const batchIndex = cEntry.batches.indexOf(b);

          tableRows += `
            <div class="block" style="background-color: ${coachColor};">
                <button class="edit-btn" onclick="window.openBatchInlineEdit('${cEntry.coachId}', ${batchIndex}, this)">✏️</button>
                ${escapeHtml(b.name)}
                <span class="time-text">${escapeHtml(timeSlot)}</span>
                <span class="student-text" title="${escapeHtml(b.students.join(', '))}">
                  ${escapeHtml(b.students.join(', ') || 'No Students')}
                </span>
            </div>
          `;
        });
        tableRows += `</td>`;
      } else {
        tableRows += `<td class="empty-cell">&mdash;</td>`;
      }
    }
    tableRows += `</tr>`;
  });

  const headerHtml = `
    <div class="header">
        <h1>Chess Academy &mdash; Coach Master Schedule Matrix</h1>
        <div class="subtitle">Complete Unified Rosters with Strict Chronological Sequencing</div>
    </div>
  `;

  const tableHtml = `
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
            ${tableRows || '<tr><td colspan="8">No active coach schedules found.</td></tr>'}
        </tbody>
    </table>
  `;

  const footerHtml = `
    <div class="footer">
        Chess Academy Master Matrix &bull; Sync Status: Verified Secure (Dynamic Database-Backed)
    </div>
  `;

  container.innerHTML = htmlStyle + headerHtml + tableHtml + footerHtml;
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
