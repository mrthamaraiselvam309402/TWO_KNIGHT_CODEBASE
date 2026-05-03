// Admin dashboard logic
// Load admin-specific data and handle admin actions

document.addEventListener('DOMContentLoaded', () => {
  if (window.role === 'admin') {
    loadAdminData();
  }
});

async function loadAdminData() {
  // Load students, coaches, payments, etc.
  try {
    const students = await apiCall('/api/students');
    const coaches = await apiCall('/api/coaches');
    // Render dashboard
  } catch (err) {
    console.error('Failed to load admin data:', err);
  }
}