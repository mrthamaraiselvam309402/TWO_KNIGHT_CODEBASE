// Login handler
CK.handleLogin = async function(event) {
  event.preventDefault();
  const form = event.target;
  const email = form.email.value;
  const password = form.password.value;
  const remember = form.querySelector('#rememberMe')?.checked || false;
  const btn = form.querySelector('button[type="submit"]');
  try {
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    const user = await Auth.login(email, password, remember);
    CK.showToast(`Welcome, ${user.name}!`, 'success');
    const redirectMap = { admin: 'admin.html', coach: 'coach.html', student: 'student.html' };
    const target = redirectMap[user.role] || 'index.html';
    setTimeout(() => window.location.href = target, 1200);
  } catch (err) {
    CK.showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
};