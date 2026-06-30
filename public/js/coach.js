// Coach dashboard logic
// Load coach-specific data and handle coach actions

document.addEventListener('DOMContentLoaded', () => {
  // Navigation to coach dashboard is handled via setPage('coach-dash') in scripts.js
});

window.renderCoachDashboard = function() {
  if (window.role !== 'coach') return;

  // Get coach ID from the current user's coach record
  const coachId = window.currentCoachId || window.userId || getCurrentCoachIdFromStorage();
  
  // 1. Calculate Stats
  const myStudents = (window.allStudents || []).filter(s => String(s.coach_id) === String(coachId));
  const myBatches = (window.allBatches || []).filter(b => String(b.coach_id) === String(coachId));
  const myHomework = (window.allHomework || []).filter(h => {
    // If homework was assigned to a student or batch belonging to this coach
    if (h.target_type === 'student') {
      return myStudents.some(s => String(s.id) === String(h.target_id));
    } else if (h.target_type === 'batch') {
      return myBatches.some(b => String(b.id) === String(h.target_id));
    }
    return false;
  });

  const statStud = document.getElementById('coach-stat-students');
  const statBatches = document.getElementById('coach-stat-batches');
  const statHw = document.getElementById('coach-stat-hw');
  
  if (statStud) statStud.textContent = myStudents.length;
  if (statBatches) statBatches.textContent = myBatches.length;
  if (statHw) statHw.textContent = myHomework.filter(h => h.status === 'pending_review' || h.status === 'submitted').length;

  // 2. Render My Batches Table
  const batchesTbody = document.getElementById('coach-dash-batches-tbody');
  if (batchesTbody) {
    if (myBatches.length === 0) {
      batchesTbody.innerHTML = '<tr><td colspan="3" class="text-center text-slate">No batches assigned yet.</td></tr>';
    } else {
      batchesTbody.innerHTML = myBatches.map(b => {
        const batchStudents = myStudents.filter(s => s.batch_id === b.id || (s.batches && s.batches.includes(b.id)));
        return `
          <tr>
            <td style="font-weight:600; color:var(--ivory)">${window.escapeHtml ? window.escapeHtml(b.name) : b.name}</td>
            <td><span class="badge badge-info">${window.escapeHtml ? window.escapeHtml(b.level || 'Beginner') : b.level}</span></td>
            <td>${batchStudents.length} Students</td>
          </tr>
        `;
      }).join('');
    }
  }

  // 3. Render Recent Homework
  const hwTbody = document.getElementById('coach-dash-hw-tbody');
  if (hwTbody) {
    const recentHw = myHomework
      .filter(h => h.status === 'pending_review' || h.status === 'submitted')
      .sort((a,b) => new Date(b.submitted_at || b.created_at) - new Date(a.submitted_at || a.created_at))
      .slice(0, 5);
      
    if (recentHw.length === 0) {
      hwTbody.innerHTML = '<tr><td colspan="3" class="text-center text-slate">No pending homework to review.</td></tr>';
    } else {
      hwTbody.innerHTML = recentHw.map(h => {
        let studentName = "Unknown";
        if (h.student_id) {
          const s = myStudents.find(x => String(x.id) === String(h.student_id));
          studentName = s ? (window.studentName ? window.studentName(s) : s.name) : "Unknown";
        }
        return `
          <tr>
            <td style="color:var(--ivory)">${window.escapeHtml ? window.escapeHtml(studentName) : studentName}</td>
            <td>${window.escapeHtml ? window.escapeHtml(h.topic || 'General') : h.topic}</td>
            <td><span class="badge badge-warning">Needs Review</span></td>
          </tr>
        `;
      }).join('');
    }
  }

  // Future feature: Schedule
};

// Helper to get coach ID from storage
function getCurrentCoachIdFromStorage() {
  try {
    const auth = sessionStorage.getItem("twoknights_auth");
    if (auth) {
      const data = JSON.parse(auth);
      // For coach role, the user email/name should map to a coach record
      const coach = (window.allCoaches || []).find(c => 
        String(c.email || '').toLowerCase() === String(data.user || '').toLowerCase() ||
        (window.coachEmail && String(window.coachEmail(data.user || '')).toLowerCase() === String(data.user || '').toLowerCase()
      );
      if (coach && coach.id) return coach.id;
    }
  } catch (e) {
    console.warn('[Coach] Failed to get coach ID from storage:', e);
  }
  // Fallback: extract coach ID from user token
  return window.userId || 'default';
}