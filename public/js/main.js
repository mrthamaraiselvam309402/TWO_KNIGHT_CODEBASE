// Demo booking handler
CK.handleDemoSubmit = async function(event) {
  event.preventDefault();
  const form = event.target;
  const btn = form.querySelector('button[type="submit"]');
  try {
    btn.disabled = true;
    btn.textContent = 'Submitting...';
    const { error } = await SB().from('leads').insert({
      name: form.fullName.value,
      phone: form.phone.value,
      parent_name: form.fullName.value,
      child_age: parseInt(form.age.value),
      city: form.city.value,
      status: 'new',
      created_at: new Date().toISOString()
    });
    if (error) throw error;
    CK.showToast('✅ Demo booked! We will contact you soon.', 'success');
    CK.closeModal('contactModal');
    form.reset();
  } catch (err) {
    console.error(err);
    CK.showToast('❌ Failed to submit. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirm Booking';
  }
};

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