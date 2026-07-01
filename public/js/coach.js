// Coach dashboard logic - Redesigned for Premium UX
// Load coach-specific data and populate dashboard

document.addEventListener('DOMContentLoaded', () => {
  // Navigation to coach dashboard is handled via setPage('coach-dash') in scripts.js
});

window.renderCoachDashboard = function() {
  if (window.role !== 'coach') return;

  // Get coach ID from the current user's coach record
  const coachId = window.currentCoachId || window.userId || getCurrentCoachIdFromStorage();
  if (!coachId) return;

  // Get the coach object for name display
  const coach = (window.allCoaches || []).find(c => String(c.id) === String(coachId));
  if (coach && coach.name) {
    const nameEl = document.getElementById('coach-dash-name');
    if (nameEl) nameEl.textContent = coach.name.split(' ')[0]; // First name only
  }

  // 1. Calculate Stats
  const myStudents = (window.allStudents || []).filter(s => String(s.coach_id) === String(coachId));
  const myBatches = (window.allBatches || []).filter(b => String(b.coach_id) === String(coachId));

  // Update stats
  const statStudents = document.getElementById('coach-stat-students');
  const statBatches = document.getElementById('coach-stat-batches');
  const statSessions = document.getElementById('coach-stat-sessions');
  const statHw = document.getElementById('coach-stat-hw');

  if (statStudents) statStudents.textContent = myStudents.length;
  if (statBatches) statBatches.textContent = myBatches.length;

  // Calculate upcoming sessions (next 7 days)
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);
  const upcomingSessions = (window.allAttendance || []).filter(a => {
    const attDate = new Date(a.date);
    return attDate >= today && attDate <= nextWeek && myStudents.some(s => String(s.id) === String(a.student_id));
  });
  if (statSessions) statSessions.textContent = upcomingSessions.length;

  // Pending homework count
  const pendingHw = (window.homeworkSubmissionCache || [])
    .filter(s => s.status === 'submitted' && myStudents.some(st => String(st.id) === String(s.student_id)));
  if (statHw) statHw.textContent = pendingHw.length;

  // 2. Render My Batches Table
  const batchesTbody = document.getElementById('coach-dash-batches-tbody');
  if (batchesTbody) {
    if (myBatches.length === 0) {
      batchesTbody.innerHTML = '<tr><td colspan="4" class="coach-loading-cell">No batches assigned yet.</td></tr>';
    } else {
      batchesTbody.innerHTML = myBatches.slice(0, 5).map(b => {
        const batchStudents = myStudents.filter(s => String(s.batch_id) === String(b.id) || 
          (s.batches && s.batches.includes(b.id)));
        const days = b.days || b.schedule_days || 'TBD';
        return `
          <tr>
            <td style="font-weight:500; color:var(--ivory)">${window.escapeHtml ? window.escapeHtml(b.name) : b.name}</td>
            <td><span class="badge badge-info">${b.level || 'Beginner'}</span></td>
            <td>${batchStudents.length}</td>
            <td style="font-size:12px; color:var(--ivory-dim)">${days}</td>
          </tr>
        `;
      }).join('');
      if (myBatches.length > 5) {
        batchesTbody.innerHTML += `<tr><td colspan="4" style="text-align:center; color:var(--gold); padding-top:8px;">+${myBatches.length - 5} more batches</td></tr>`;
      }
    }
  }

  // 3. Render Recent Homework
  const hwTbody = document.getElementById('coach-dash-hw-tbody');
  if (hwTbody) {
    const pendingSubmissions = (window.homeworkSubmissionCache || [])
      .filter(s => s.status === 'submitted' && myStudents.some(st => String(st.id) === String(s.student_id)))
      .sort((a, b) => new Date(b.submitted_at || b.created_at) - new Date(a.submitted_at || a.created_at))
      .slice(0, 5);

    if (pendingSubmissions.length === 0) {
      hwTbody.innerHTML = '<tr><td colspan="4" class="coach-loading-cell">No pending submissions.</td></tr>';
    } else {
      hwTbody.innerHTML = pendingSubmissions.map(s => {
        const assignment = (window.allHomework || []).find(h => String(h.id) === String(s.assignment_id));
        const student = myStudents.find(x => String(x.id) === String(s.student_id));
        const studentName = student ? (window.getStudentName ? window.getStudentName(student) : student.name) : "Unknown";
        const title = assignment ? assignment.title : "Untitled Assignment";
        const submittedDate = s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : "Today";
        return `
          <tr>
            <td style="color:var(--ivory)">${window.escapeHtml ? window.escapeHtml(studentName) : studentName}</td>
            <td style="font-size:12px;">${window.escapeHtml ? window.escapeHtml(title) : title}</td>
            <td style="font-size:11px; color:var(--ivory-dim)">${submittedDate}</td>
            <td><span class="badge badge-warning">Review</span></td>
          </tr>
        `;
      }).join('');
    }
  }

  // 4. Render Today's Attendance
  const attPresent = document.getElementById('coach-att-present');
  const attAbsent = document.getElementById('coach-att-absent');
  const attDetails = document.getElementById('coach-attendance-details');

  const todayStr = today.toISOString().split('T')[0];
  const todaysAttendance = (window.allAttendance || []).filter(a => a.date === todayStr &&
    myStudents.some(s => String(s.id) === String(a.student_id)));
  const presentCount = todaysAttendance.filter(a => (a.status || '').toLowerCase() === 'present').length;
  const absentCount = todaysAttendance.filter(a => (a.status || '').toLowerCase() === 'absent').length;

  if (attPresent) attPresent.textContent = presentCount;
  if (attAbsent) attAbsent.textContent = absentCount;
  if (attDetails) {
    if (todaysAttendance.length === 0) {
      attDetails.innerHTML = '<div class="coach-loading-cell">No attendance marked yet for today.</div>';
    } else {
      attDetails.innerHTML = `
        <div style="display:flex; gap:12px; font-size:12px;">
          <span>Total: <strong style="color:var(--ivory);">${todaysAttendance.length}</strong></span>
          <span><span style="color:var(--success);">●</span> Present: ${presentCount}</span>
          <span><span style="color:var(--danger);">●</span> Absent: ${absentCount}</span>
        </div>
      `;
    }
  }
};

// Helper to get coach ID from storage
function getCurrentCoachIdFromStorage() {
  try {
    // Try multiple sources for coach ID
    if (window.currentCoachId) return window.currentCoachId;
    
    const auth = sessionStorage.getItem("twoknights_auth");
    if (auth) {
      const data = JSON.parse(auth);
      // For coach role, coach_id might be stored directly
      if (data.coach_id) return data.coach_id;
      // Check if we have a user property that matches a coach
      const user = data.user || '';
      const coach = (window.allCoaches || []).find(c => 
        String(c.email || '').toLowerCase() === String(user).toLowerCase() ||
        String(c.name || '').toLowerCase() === String(user).toLowerCase()
      );
      if (coach && coach.id) return coach.id;
    }
  } catch (e) {
    console.warn('[Coach] Failed to get coach ID from storage:', e);
  }
  return null;
}

// Auto-render when navigating to coach dashboard
document.addEventListener('DOMContentLoaded', () => {
  const observer = new MutationObserver(() => {
    const page = document.getElementById('page-coach-dash');
    if (page && page.classList.contains('active')) {
      renderCoachDashboard();
    }
  });
  observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
});

// Also hook into setPage if it exists
if (typeof window.setPage === 'function') {
  const origSetPage = window.setPage;
  window.setPage = function(p, btn) {
    origSetPage(p, btn);
    if (p === 'coach-dash') {
      setTimeout(renderCoachDashboard, 100);
    }
  };
} else {
  window.setPage = function(p, btn) {
    if (p === 'coach-dash') {
      setTimeout(renderCoachDashboard, 100);
    }
  };
}