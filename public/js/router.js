// SPA navigation & UI helpers
const CK = window.CK || {};

CK.navigate = function(sectionId) {
  const el = document.getElementById(sectionId);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

CK.showPage = function(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId);
  if (target) target.classList.add('active');
  window.location.hash = pageId;
  window.scrollTo(0, 0);
};

CK.openModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'flex';
};

CK.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
};

CK.showToast = function(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3500);
};

CK.togglePassword = function(formId) {
  const form = document.getElementById(formId);
  const pwd = form.querySelector('input[type="password"], input[type="text"]');
  if (pwd) pwd.type = pwd.type === 'password' ? 'text' : 'password';
};

CK.openDemoModal = () => CK.openModal('contactModal');

window.addEventListener('hashchange', () => {
  const page = window.location.hash.substring(1);
  if (page && document.getElementById(page)) CK.showPage(page);
});
window.addEventListener('load', () => {
  if (window.location.hash) {
    const page = window.location.hash.substring(1);
    if (document.getElementById(page)) CK.showPage(page);
  }
});