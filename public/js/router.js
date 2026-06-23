// SPA navigation & UI helpers
const CK = window.CK || {};

CK.navigate = function(sectionId) {
  const el = document.getElementById(sectionId);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window._lastSetPageTime = 0;
window._lastSetPageTarget = null;

function resolvePageFromHash(hash) {
  let raw = (hash || '').replace(/^#/, '');
  if (!raw) return null;
  // Accept both short names (#stud) and full DOM IDs (#page-stud).
  // Always return the short name that setPage() expects.
  if (raw.startsWith('page-')) raw = raw.slice(5);
  if (document.getElementById('page-' + raw)) return raw;
  return null;
}

window.addEventListener('hashchange', () => {
  const resolved = resolvePageFromHash(window.location.hash);
  if (resolved && typeof setPage === 'function') {
    const now = Date.now();
    if (now - window._lastSetPageTime > 100 || resolved !== window._lastSetPageTarget) {
      setPage(resolved);
    }
  }
});

window.addEventListener('load', () => {
  const resolved = resolvePageFromHash(window.location.hash);
  if (resolved && typeof setPage === 'function') {
    setPage(resolved);
  }
});

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