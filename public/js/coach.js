// Coach dashboard logic
// Load coach-specific data and handle coach actions

document.addEventListener('DOMContentLoaded', () => {
  if (window.role === 'coach') {
    loadCoachData();
  }
});

async function loadCoachData() {
  // Load coach's students, sessions, etc.
  try {
    const students = await apiCall('/api/students?coach_id=' + window.userId);
    const sessions = await apiCall('/api/sessions?coach_id=' + window.userId);
    // Render dashboard
  } catch (err) {
    console.error('Failed to load coach data:', err);
  }
}