// Student dashboard logic
// Load student-specific data and handle student actions

document.addEventListener('DOMContentLoaded', () => {
  if (window.role === 'student') {
    loadStudentData();
  }
});

async function loadStudentData() {
  // Load student's sessions, rating, payments, etc.
  try {
    // Assuming studentId is set
    const sessions = await apiCall(`/api/sessions?student_id=${window.studentId}`);
    // Render dashboard
  } catch (err) {
    console.error('Failed to load student data:', err);
  }
}