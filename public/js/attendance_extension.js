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

// --- NEW MASTER SCHEDULE LOGIC ---
const hardcodedSchedule = [
  { coach: 'Haris', batches: [ { name: 'Batch 1', schedule: 'Tuesday & Thursday | 7:00 PM – 8:00 PM', students: ['Magathi', 'Pranav', 'Aarunya'] } ] },
  { coach: 'Gyana Suriya', batches: [
      { name: 'Batch 1', schedule: 'Saturday & Sunday | 7:00 PM – 8:00 PM', students: ['Aara', 'Anush', 'Shervin', 'Rakshitha'] },
      { name: 'Batch 2', schedule: 'Tuesday, Thursday & Friday | 5:40 AM – 6:20 AM', students: ['Nigunan', 'Ekanash'] }
  ] },
  { coach: 'Yogesh', batches: [
      { name: 'Batch 1', schedule: 'Saturday & Sunday | 7:30 PM – 8:30 PM', students: ['Athvik', 'Mohammad Rayan', 'Pranesh'] },
      { name: 'Batch 2', schedule: 'Saturday & Sunday | 6:00 PM – 7:00 PM', students: ['Sai', 'Venkatesh Son', 'Venkatesh Daughter'] },
      { name: 'Batch 3', schedule: 'One-to-One Session | Day & time not fixed yet', students: ['Yaduvir'] }
  ] },
  { coach: 'Arivuselvam', batches: [
      { name: 'Batch 1', schedule: 'Tuesday & Thursday | 6:00 PM – 7:00 PM', students: ['Anuksha', 'Aadhav Dinesh'] },
      { name: 'Batch 2', schedule: 'Monday & Wednesday | 7:00 PM – 8:00 PM', students: ['Uttsan', 'Sachin', 'Aatish'] },
      { name: 'Batch 3', schedule: 'Friday & Saturday | 7:00 PM – 8:00 PM', students: ['Mukilan'] },
      { name: 'Batch 4', schedule: 'One-to-One Session | Day & time not fixed yet', students: ['Yugan'] }
  ] },
  { coach: 'Vishnu', batches: [
      { name: 'Batch 1', schedule: 'Friday & Saturday | 7:00 PM – 8:00 PM', students: ['Jayaraj', 'Anfal', 'Akmal', 'Velava', 'Buvargan', 'Poonthalir', 'Krishna'] },
      { name: 'Batch 2', schedule: 'Wednesday & Thursday | 7:00 PM – 8:00 PM', students: ['Yogesh'] },
      { name: 'Batch 4', schedule: 'Monday & Wednesday | 6:00 PM – 7:00 PM', students: ['Abinitha', 'Aradhya'] }
  ] },
  { coach: 'Ranjith', batches: [
      { name: 'Batch 1', schedule: 'Tuesday & Thursday | 2:45 PM – 3:45 PM', students: ['Sakthi', 'Sathya'] },
      { name: 'Batch 2', schedule: 'Saturday & Sunday | 7:00 PM – 8:00 PM', students: ['Susil', 'Riyas', 'Varun'] }
  ] },
  { coach: 'Rohith', batches: [
      { name: 'Batch 1', schedule: 'Monday, Wednesday & Saturday | 5:00 AM – 5:40 AM', students: ['Sreelaxmi'] },
      { name: 'Batch 2', schedule: 'Thursday & Friday | 6:00 PM – 8:00 PM', students: ['Samiksha'] }
  ] },
  { coach: 'Sudhin', batches: [
      { name: 'Batch 1', schedule: 'Thursday & Friday | 6:00 AM – 7:00 AM', students: ['Jeevan'] },
      { name: 'Batch 3', schedule: 'Saturday & Sunday | 7:00 PM – 8:00 PM', students: ['Aakif', 'Pranish'] }
  ] }
];

window.openMasterSchedule = function() {
  const container = document.getElementById('master-schedule-container');
  if (!container) return;
  
  let html = '';
  hardcodedSchedule.forEach(c => {
    html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:15px;margin-bottom:15px">`;
    html += `<h3 style="color:var(--gold);margin-top:0;margin-bottom:10px;font-family:var(--font-head)">Coach: ${c.coach}</h3>`;
    
    html += `<table style="width:100%;text-align:left;font-size:13px">`;
    html += `<thead><tr><th style="width:15%">Batch</th><th style="width:40%">Students</th><th style="width:45%">Schedule</th></tr></thead><tbody>`;
    
    c.batches.forEach(b => {
      html += `<tr>
                 <td style="font-weight:600;color:var(--ivory)">${b.name}</td>
                 <td style="color:var(--ivory-dim)">${b.students.join(', ')}</td>
                 <td style="color:var(--blue)">${b.schedule}</td>
               </tr>`;
    });
    
    html += `</tbody></table></div>`;
  });
  
  container.innerHTML = html;
  openModal('master-schedule-modal');
};
