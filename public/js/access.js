// access.js - Access Control Manager Logic
window.accessUsers = [];

// Safely parse a fetch Response body as JSON, tolerating empty/non-JSON
// bodies (some DELETE handlers respond with no body) so callers never throw
// "Unexpected end of JSON input".
async function safeJson(res) {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    return {};
  }
}

window.loadAccessControl = async function() {
    if (window.role !== 'master' && window.role !== 'admin') {
        if (window.toast) window.toast('Unauthorized access', 'error');
        return;
    }
    
    const tbody = document.getElementById('access-users-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6"><div class="loading-state"><span class="spinner"></span> Loading users...</div></td></tr>';

    try {
        const response = await window.apiCall('/api/access_control', { // Re-using local dev proxy or Edge function
            headers: {
                'Content-Type': 'application/json',
                'role': window.role
            }
        });

        if (!response.ok) {
            let errorMsg = 'Failed to load users';
            try {
                const errData = await response.json().catch(() => ({}));
                errorMsg = errData.error || errorMsg;
            } catch {
                // ignore JSON parse errors
            }
            throw new Error(errorMsg);
        }

        const data = await safeJson(response);
        window.accessUsers = data.users || [];
        window.renderAccessTable();
    } catch (err) {
        console.error('Error loading access control:', err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${err.message}</td></tr>`;
        if (window.toast) window.toast('Failed to load users', 'error');
    }
};

// Parent/student portal accounts — derived from the Students registry, since
// parents authenticate with the child's name + registered phone (custom auth),
// not Supabase Auth. Read-only overview for the admin.
window.renderParentAccounts = async function() {
    const tbody = document.getElementById('parent-accounts-tbody');
    if (!tbody) return;
    const students = (window.allStudents || []).slice();
    const coaches = window.allCoaches || [];
    const batches = window.allBatches || [];
    const q = (document.getElementById('parent-accounts-search')?.value || '').toLowerCase().trim();

    const coachName = (cid) => {
        const c = coaches.find(x => String(x.id) === String(cid));
        return c ? (c.name || '—') : 'Unassigned';
    };

    let rows = students.filter(s => (s.status || '').toLowerCase() !== 'archived');
    if (q) {
        rows = rows.filter(s =>
            (s.name || '').toLowerCase().includes(q) ||
            (s.parent_name || '').toLowerCase().includes(q) ||
            String(s.parent_phone || s.phone || '').toLowerCase().includes(q)
        );
    }
    rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const countEl = document.getElementById('parent-accounts-count');
    if (countEl) countEl.textContent = `${rows.length} account${rows.length === 1 ? '' : 's'}`;

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">No parent accounts found.</div></td></tr>';
        return;
    }

    // Pre-fetch batch passwords so we can show the effective password for
    // students who are using a batch password instead of an individual one.
    const batchIds = [...new Set(rows.map(s => s.batch_id).filter(Boolean))];
    const batchPasswordPromises = batchIds.map(async (bid) => {
      try {
        const res = await window.apiCall(`/api/security?batchId=${encodeURIComponent(bid)}`);
        if (res.ok) {
          const data = await res.json();
          return { batchId: bid, password: data.batch_password || null };
        }
      } catch (e) {
        console.warn('Failed to load batch password for', bid, e);
      }
      return { batchId: bid, password: null };
    });

    const batchPasswordResults = await Promise.all(batchPasswordPromises);
    const batchPasswordMap = new Map(batchPasswordResults.map(r => [r.batchId, r.password]));

    const esc = window.escapeHtml || (x => x);
    const statusBadge = (st) => {
        const s = (st || 'active').toLowerCase();
        if (s === 'active') return '<span class="badge badge-success" style="font-size:10px;">Active</span>';
        if (s === 'pending') return '<span class="badge" style="font-size:10px; background:rgba(245,158,11,0.15); color:var(--warning);">Pending</span>';
        if (s === 'archived') return '<span class="badge badge-danger" style="font-size:10px;">Archived</span>';
        return `<span class="badge" style="font-size:10px;">${esc(st || '—')}</span>`;
    };

    tbody.innerHTML = rows.map(s => {
        const phone = s.parent_phone || s.phone || '—';
        const individualPwd = s.password || null;
        const batchPwd = s.batch_id ? (batchPasswordMap.get(String(s.batch_id)) || null) : null;
        const effectivePwd = individualPwd || batchPwd || phone;
        const pwdSource = individualPwd ? 'individual' : (batchPwd ? 'batch' : 'phone');
        const escId = String(s.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escName = (s.name || '—').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escPwd = window.escapeHtml(String(effectivePwd));

        const passwordControls = `
            <div id="ppw-${escId}" style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                <span id="ppt-${escId}" style="font-family:var(--font-mono); font-size:12px; color:var(--ivory); background:var(--bg3); padding:2px 6px; border-radius:4px; user-select:all; cursor:text; line-height:1.2;" title="${pwdSource === 'batch' ? 'Batch password' : pwdSource === 'individual' ? 'Individual password' : 'Phone password'}">${escPwd}</span>
                <button class="btn btn-outline-grey btn-sm" style="padding:1px 6px; font-size:10px; height:22px; display:inline-flex; align-items:center; justify-content:center;" onclick="window.toggleParentPwd('${escId}')" title="Hide password">🙈</button>
                <button class="btn btn-outline-grey btn-sm" style="padding:1px 6px; font-size:10px; height:22px; display:inline-flex; align-items:center; justify-content:center;" onclick="window.startEditParentPwd('${escId}', '${escName}')" title="Edit password">✏️</button>
            </div>
            <div id="ppe-${escId}" style="display:none; gap:4px; align-items:center;">
                <input type="text" id="ppi-${escId}" value="${escPwd}" class="input-field" style="width:100px; padding:3px 6px; font-size:11px; margin:0; height:26px; background:var(--bg3); border:1px solid var(--border); color:var(--ivory); border-radius:4px;" autocomplete="new-password">
                <button class="btn btn-gold btn-sm" style="padding:2px 8px; font-size:10px; height:22px;" onclick="window.saveParentPwd('${escId}', '${escName}')" title="Save">💾</button>
                <button class="btn btn-outline-grey btn-sm" style="padding:2px 6px; font-size:10px; height:22px;" onclick="window.cancelParentPwd('${escId}')" title="Cancel">✕</button>
            </div>
        `;

        return `<tr>
            <td style="font-weight:600; color:var(--ivory);">${esc(s.name || '—')}</td>
            <td style="color:var(--ivory2);">${esc(s.parent_name || '—')}</td>
            <td style="font-family:var(--font-mono); font-size:12px; color:var(--ivory-dim);">${esc(String(phone))}</td>
            <td style="color:var(--ivory2); font-size:12px;">${esc(coachName(s.coach_id))}</td>
            <td style="min-width:150px;">${passwordControls}</td>
            <td>${statusBadge(s.status)}</td>
            <td style="text-align:center;">
                <button class="btn btn-outline-grey btn-sm" style="padding:4px 10px; font-size:11px;" onclick="window.quickSwitchPreviewStudent && window.quickSwitchPreviewStudent('${escId}'); window.setPage && window.setPage('child');" title="Open portal preview">Open ↗</button>
            </td>
        </tr>`;
    }).join('');
};

window.editStudentPassword = async function(studentId, studentName) {
    if (window.role !== 'master' && window.role !== 'admin' && window.role !== 'coach-admin' && window.role !== 'coach+admin') {
        if (window.toast) window.toast('Unauthorized action', 'error');
        return;
    }

    const currentStudent = (window.allStudents || []).find(s => String(s.id) === String(studentId));
    if (!currentStudent) return;

    const newPassword = prompt(`Enter new password for ${studentName}:\n(Leave blank to revert to Phone-only authentication)`);
    if (newPassword === null) return; // user cancelled

    const pwdToSave = newPassword.trim() === '' ? null : newPassword.trim();

    try {
        const res = await window.apiCall(`/api/students?id=${encodeURIComponent(studentId)}`, {
            method: 'PUT',
            body: JSON.stringify({ password: pwdToSave })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Server error ${res.status}`);
        }
        
        // Update local state
        currentStudent.password = pwdToSave;
        
        if (window.toast) window.toast('Password updated successfully', 'success');
        window.renderParentAccounts();
    } catch (e) {
        console.error('Failed to update student password:', e);
        if (window.toast) window.toast(`Failed to update password: ${e.message}`, 'error');
    }
};

window.toggleParentPwd = function(studentId) {
    const textEl = document.getElementById('ppt-' + studentId);
    if (!textEl) return;
    const wrap = document.getElementById('ppw-' + studentId);
    const btn = wrap ? wrap.querySelector('button') : null;
    if (textEl.style.display === 'none') {
        textEl.style.display = 'inline';
        if (btn) { btn.textContent = '🙈'; btn.title = 'Hide password'; }
    } else {
        textEl.style.display = 'none';
        if (btn) { btn.textContent = '👁'; btn.title = 'Show password'; }
    }
};

window.startEditParentPwd = function(studentId) {
    const wrap = document.getElementById('ppw-' + studentId);
    const edit = document.getElementById('ppe-' + studentId);
    const input = document.getElementById('ppi-' + studentId);
    if (wrap) wrap.style.display = 'none';
    if (edit) edit.style.display = 'flex';
    if (input) input.focus();
};

window.saveParentPwd = async function(studentId, studentName) {
    const input = document.getElementById('ppi-' + studentId);
    if (!input) return;
    const newPassword = input.value.trim();
    if (!newPassword) {
        if (window.toast) window.toast('Password cannot be empty', 'error');
        return;
    }
    try {
        const res = await window.apiCall(`/api/students?id=${encodeURIComponent(studentId)}`, {
            method: 'PUT',
            body: JSON.stringify({ password: newPassword })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Server error ${res.status}`);
        }
        const student = (window.allStudents || []).find(s => String(s.id) === String(studentId));
        if (student) student.password = newPassword;
        if (window.toast) window.toast('Password updated successfully', 'success');
        window.renderParentAccounts();
    } catch (e) {
        console.error('Failed to update student password:', e);
        if (window.toast) window.toast(`Failed to update password: ${e.message}`, 'error');
    }
};

window.cancelParentPwd = function(studentId) {
    const wrap = document.getElementById('ppw-' + studentId);
    const edit = document.getElementById('ppe-' + studentId);
    if (wrap) wrap.style.display = 'flex';
    if (edit) edit.style.display = 'none';
};

window.startSetParentPwd = function(studentId) {
    const setRow = document.getElementById('pps-' + studentId);
    const input = document.getElementById('psi-' + studentId);
    if (setRow) setRow.style.display = 'flex';
    if (input) input.focus();
};

window.saveNewParentPwd = async function(studentId, studentName) {
    const input = document.getElementById('psi-' + studentId);
    if (!input) return;
    const newPassword = input.value.trim();
    if (!newPassword) {
        if (window.toast) window.toast('Password cannot be empty', 'error');
        return;
    }
    try {
        const res = await window.apiCall(`/api/students?id=${encodeURIComponent(studentId)}`, {
            method: 'PUT',
            body: JSON.stringify({ password: newPassword })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Server error ${res.status}`);
        }
        const student = (window.allStudents || []).find(s => String(s.id) === String(studentId));
        if (student) student.password = newPassword;
        if (window.toast) window.toast('Password set successfully', 'success');
        window.renderParentAccounts();
    } catch (e) {
        console.error('Failed to set password:', e);
        if (window.toast) window.toast(`Failed to set password: ${e.message}`, 'error');
    }
};

window.cancelSetParentPwd = function(studentId) {
    const setRow = document.getElementById('pps-' + studentId);
    if (setRow) setRow.style.display = 'none';
};

  window.renderAccessTable = function() {
    const tbody = document.getElementById('access-users-tbody');
    if (!tbody) return;

    if (window.accessUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">No users found</div></td></tr>';
        return;
    }

    let html = '';
    window.accessUsers.forEach(u => {
      const createdDate = new Date(u.created_at).toLocaleDateString();
      const signInDate = u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never';
      
      const isMaster = u.role === 'master';
      
      let roleBadge = 'badge-grey';
      if (u.role === 'master') roleBadge = 'badge-gold';
      else if (u.role === 'admin') roleBadge = 'badge-level';
      else if (u.role === 'coach') roleBadge = 'badge-purple';
      else if (u.role === 'coach-admin' || u.role === 'coach+admin') roleBadge = 'badge-level';
      
      const roleLabel = u.role === 'coach-admin' || u.role === 'coach+admin' ? 'Coach+Admin' : u.role;
      const escId = String(u.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const escRole = String(u.role || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const escEmail = window.escapeHtml(u.email || '');
      
      const pwdInfo = u.password_info || {};
      const pwdValue = pwdInfo.value || pwdInfo.masked || '••••••••';
      const isVisible = !!pwdInfo.value;
      const escPwd = isVisible ? window.escapeHtml(pwdInfo.value) : '';
      
      html += `<tr>
          <td style="font-weight:600; color:var(--ivory);">${escEmail}</td>
          <td><span class="badge ${roleBadge}" style="text-transform:uppercase; font-size:10px;">${window.escapeHtml(roleLabel)}</span></td>
          <td style="color:var(--ivory2); font-size:12px;">${createdDate}</td>
          <td style="color:var(--ivory2); font-size:12px;">${signInDate}</td>
          <td style="font-family:var(--font-mono); font-size:12px; color:var(--ivory-dim); min-width:150px;">
            ${isVisible ? `
              <div id="apw-${escId}" style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                <span id="apt-${escId}" style="color:var(--ivory); background:var(--bg3); padding:2px 6px; border-radius:4px; user-select:all; cursor:text; line-height:1.2; font-size:12px;">${escPwd}</span>
                <button class="btn btn-outline-grey btn-sm" style="padding:1px 6px; font-size:10px; height:22px; display:inline-flex; align-items:center; justify-content:center;" onclick="window.toggleAccessPwd('${escId}')" title="Hide password">🙈</button>
                <button class="btn btn-outline-grey btn-sm" style="padding:1px 6px; font-size:10px; height:22px; display:inline-flex; align-items:center; justify-content:center;" onclick="window.startEditAccessPwd('${escId}')" title="Change password">✏️</button>
              </div>
              <div id="ape-${escId}" style="display:none; gap:4px; align-items:center; margin-top:4px;">
                <input type="text" id="api-${escId}" value="${escPwd}" class="input-field" style="width:120px; padding:3px 6px; font-size:11px; margin:0; height:26px; background:var(--bg3); border:1px solid var(--border); color:var(--ivory); border-radius:4px;" autocomplete="new-password">
                <button class="btn btn-gold btn-sm" style="padding:2px 8px; font-size:10px; height:22px;" onclick="window.saveAccessPwd('${escId}')" title="Save">💾</button>
                <button class="btn btn-outline-grey btn-sm" style="padding:2px 6px; font-size:10px; height:22px;" onclick="window.cancelAccessPwd('${escId}')" title="Cancel">✕</button>
              </div>
            ` : `<span style="opacity:0.5; line-height:1.2;">${window.escapeHtml(pwdValue)}</span>
              <button class="btn btn-outline-grey btn-sm" style="padding:2px 6px; font-size:10px; height:22px; display:inline-flex; align-items:center; justify-content:center;" onclick="promptEditUserRole('${escId}', '${escRole}', '${escEmail}')" title="Set / reset password">🔑</button>`}
          </td>
          <td style="text-align:center;">
              <div style="display:flex; justify-content:center; gap:6px;">
                  <button class="btn btn-outline-grey btn-sm" onclick="promptEditUserRole('${escId}', '${escRole}', '${escEmail}')" style="padding:4px;" title="Edit Role" ${isMaster ? 'disabled' : ''}>✏️</button>
                  <button class="btn btn-outline-grey btn-sm text-danger" onclick="deleteUserAccess('${escId}', '${escEmail}')" style="padding:4px; border-color:var(--danger);" title="Revoke Access" ${isMaster ? 'disabled' : ''}>🗑️</button>
              </div>
          </td>
      </tr>`;
    });
    tbody.innerHTML = html;
  };

  window.togglePasswordVisibility = function(userId) {
    const pwdEl = document.getElementById('pwd-' + userId);
    const maskEl = document.getElementById('pwd-mask-' + userId);
    const btnEl = document.getElementById('pwd-btn-' + userId);
    if (!pwdEl || !maskEl) return;
    if (pwdEl.style.display === 'none') {
      pwdEl.style.display = 'inline-block';
      maskEl.style.display = 'none';
      if (btnEl) btnEl.textContent = '🙈';
    } else {
      pwdEl.style.display = 'none';
      maskEl.style.display = 'inline-block';
      if (btnEl) btnEl.textContent = '👁';
    }
  };

window.toggleAccessPwd = function(userId) {
    const textEl = document.getElementById('apt-' + userId);
    if (!textEl) return;
    const wrap = document.getElementById('apw-' + userId);
    const btn = wrap ? wrap.querySelector('button') : null;
    if (textEl.style.display === 'none') {
        textEl.style.display = 'inline';
        if (btn) { btn.textContent = '🙈'; }
    } else {
        textEl.style.display = 'none';
        if (btn) { btn.textContent = '👁'; }
    }
};

window.startEditAccessPwd = function(userId) {
    const wrap = document.getElementById('apw-' + userId);
    const edit = document.getElementById('ape-' + userId);
    if (wrap) wrap.style.display = 'none';
    if (edit) edit.style.display = 'flex';
};

window.saveAccessPwd = async function(userId) {
    const input = document.getElementById('api-' + userId);
    if (!input) return;
    const newPassword = input.value.trim();
    try {
        const res = await window.apiCall('/api/access_control', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'role': window.role },
            body: JSON.stringify({ id: userId, password: newPassword || null })
        });
        const data = await safeJson(res);
        if (data.error) throw new Error(data.error);
        if (window.toast) window.toast('Password updated successfully', 'success');
        window.loadAccessControl();
    } catch (e) {
        console.error('Failed to update password:', e);
        if (window.toast) window.toast(`Failed to update password: ${e.message}`, 'error');
    }
};

window.cancelAccessPwd = function(userId) {
    const wrap = document.getElementById('apw-' + userId);
    const edit = document.getElementById('ape-' + userId);
    if (wrap) wrap.style.display = 'flex';
    if (edit) edit.style.display = 'none';
};

// ── Create / Edit user via proper modal (replaces prompt() dialogs) ──
function setAccessUserError(msg) {
    const el = document.getElementById('acc-user-error');
    if (!el) return;
    if (msg) { el.textContent = msg; el.style.display = 'block'; }
    else { el.textContent = ''; el.style.display = 'none'; }
}

window.promptCreateUser = function() {
    document.getElementById('acc-user-modal-title').textContent = 'Create User';
    document.getElementById('acc-user-modal-sub').textContent = 'Add a new admin, coach, or parent account.';
    document.getElementById('acc-user-id').value = '';
    const emailEl = document.getElementById('acc-user-email');
    emailEl.value = ''; emailEl.disabled = false;
    document.getElementById('acc-user-password').value = '';
    document.getElementById('acc-user-pass-label').textContent = 'Temporary Password *';
    document.getElementById('acc-user-role').value = 'coach';
    document.getElementById('acc-user-submit-btn').textContent = 'Create User';
    setAccessUserError('');
    if (window.openModal) window.openModal('access-user-modal');
};

window.submitAccessUserForm = function() {
    const id = document.getElementById('acc-user-id').value;
    const email = document.getElementById('acc-user-email').value.trim();
    const password = document.getElementById('acc-user-password').value;
    const role = document.getElementById('acc-user-role').value;
    const isEdit = !!id;

    if (!isEdit) {
        if (!email) return setAccessUserError('Email / username is required.');
        if (!password) return setAccessUserError('Password is required.');
        if (window.closeModals) window.closeModals();
        window.createAccessUser(email, password, role);
    } else {
        // Edit: role always sent; password only if provided (reset)
        if (window.closeModals) window.closeModals();
        window.updateAccessUser(id, role, password || null);
    }
};

window.createAccessUser = async function(email, password, role) {
    try {
        const response = await window.apiCall('/api/access_control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'role': window.role },
            body: JSON.stringify({ email, password, role })
        });
        
        const data = await safeJson(response);
        if (data.error) throw new Error(data.error);
        
        if (window.toast) window.toast('User created successfully', 'success');
        window.loadAccessControl();
    } catch (err) {
        console.error('Error creating user:', err);
    }
};

window.promptEditUserRole = function(id, currentRole, email) {
    document.getElementById('acc-user-modal-title').textContent = 'Edit User';
    document.getElementById('acc-user-modal-sub').textContent = 'Change the role or reset the password.';
    document.getElementById('acc-user-id').value = id;
    const emailEl = document.getElementById('acc-user-email');
    emailEl.value = email || ''; emailEl.disabled = true; // email can't be changed via the API
    document.getElementById('acc-user-password').value = '';
    document.getElementById('acc-user-pass-label').textContent = 'New Password (leave blank to keep current)';
    const roleSel = document.getElementById('acc-user-role');
    roleSel.value = (currentRole && ['admin','coach','coach-admin','coach+admin','parent'].includes(currentRole)) ? currentRole : 'coach';
    document.getElementById('acc-user-submit-btn').textContent = 'Save Changes';
    setAccessUserError('');
    if (window.openModal) window.openModal('access-user-modal');
};

window.updateAccessUser = async function(id, role, password) {
    try {
        const response = await window.apiCall('/api/access_control', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'role': window.role },
            body: JSON.stringify({ id, role, password })
        });
        
        const data = await safeJson(response);
        if (data.error) throw new Error(data.error);
        
        if (window.toast) window.toast('User updated successfully', 'success');
        window.loadAccessControl();
    } catch (err) {
        console.error('Error updating user:', err);
    }
};

window.deleteUserAccess = async function(id, email) {
    if (!window.confirm(`Are you SURE you want to revoke access for ${email}? This cannot be undone.`)) return;
    
    try {
        const response = await window.apiCall('/api/access_control', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'role': window.role },
            body: JSON.stringify({ id })
        });
        
        const data = await safeJson(response);
        if (data.error) throw new Error(data.error);
        
        if (window.toast) window.toast('User access revoked', 'success');
        window.loadAccessControl();
    } catch (err) {
        console.error('Error deleting user:', err);
    }
};

// Navigation hook for the Access Control page is handled centrally in
// scripts.js setPage() (loadAccessControl / loadAuditLogs / security logs),
// because scripts.js loads after this file and reassigns window.setPage.

// =========================================================================
// Real-Time Threat Intelligence & Security Logs (Vanilla Virtualization)
// =========================================================================

// Inject CSS styles for the virtual table and pulse anim
(function() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulseAlert {
        0%, 100% { opacity: 1; filter: drop-shadow(0 0 2px rgba(239, 68, 68, 0.4)); }
        50% { opacity: 0.6; filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.8)); }
      }
      .pulse-alert {
        animation: pulseAlert 1.2s infinite;
        display: inline-block;
      }
      .virtual-row {
        transition: background-color 0.2s ease;
      }
      .virtual-row:hover {
        background-color: rgba(255, 255, 255, 0.05) !important;
      }
      body[data-theme="light"] .virtual-row:hover {
        background-color: rgba(15, 23, 42, 0.05) !important;
      }
    `;
    document.head.appendChild(style);
})();

// Manual Vanilla JS DOM Virtualizer
class VanillaVirtualizer {
    constructor(options) {
        this.container = options.container;
        this.spacer = options.spacer;
        this.estimateSize = options.estimateSize || 40;
        this.overscan = options.overscan || 10;
        this.count = options.count || 0;
        this.renderRow = options.renderRow;

        this.visibleNodes = new Map();
        
        // Use arrow function to preserve scope
        this.scrollHandler = () => this.render();
        this.container.addEventListener('scroll', this.scrollHandler);
        
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => this.render());
            this.resizeObserver.observe(this.container);
        }
    }

    destroy() {
        this.container.removeEventListener('scroll', this.scrollHandler);
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        this.visibleNodes.forEach(node => node.remove());
        this.visibleNodes.clear();
    }

    updateCount(newCount) {
        this.count = newCount;
        const rowHeight = typeof this.estimateSize === 'function' ? this.estimateSize() : this.estimateSize;
        this.spacer.style.height = `${this.count * rowHeight}px`;
        this.render();
    }

    render() {
        if (this.count === 0) {
            this.spacer.style.height = '0px';
            this.visibleNodes.forEach(node => node.remove());
            this.visibleNodes.clear();
            return;
        }

        const scrollTop = this.container.scrollTop;
        const containerHeight = this.container.clientHeight;
        const rowHeight = typeof this.estimateSize === 'function' ? this.estimateSize() : this.estimateSize;

        let startIdx = Math.floor(scrollTop / rowHeight) - this.overscan;
        if (startIdx < 0) startIdx = 0;

        let endIdx = Math.floor((scrollTop + containerHeight) / rowHeight) + this.overscan;
        if (endIdx > this.count) endIdx = this.count;

        const activeIndices = new Set();

        for (let i = startIdx; i < endIdx; i++) {
            activeIndices.add(i);
            const startY = i * rowHeight;
            
            if (!this.visibleNodes.has(i)) {
                const rowNode = this.renderRow(i, startY, rowHeight);
                if (rowNode) {
                    this.spacer.appendChild(rowNode);
                    this.visibleNodes.set(i, rowNode);
                }
            } else {
                const rowNode = this.visibleNodes.get(i);
                rowNode.style.transform = `translateY(${startY}px)`;
            }
        }

        this.visibleNodes.forEach((node, idx) => {
            if (!activeIndices.has(idx)) {
                node.remove();
                this.visibleNodes.delete(idx);
            }
        });
    }
}
window.VanillaVirtualizer = VanillaVirtualizer;

window.securityAlerts = [];
window.auditVirtualizer = null;
window.auditChart = null;
let simulationInterval = null;

// Load logs from Supabase API (or local storage fallback)
window.loadAuditLogs = async function() {
    const scrollContainer = document.getElementById('audit-virtual-scroll-container');
    const spacer = document.getElementById('audit-virtual-spacer');
    const emptyState = document.getElementById('audit-empty-state');
    
    if (!scrollContainer || !spacer) return;

    try {
        let fetchedLogs = [];
        const res = await window.apiCall('/api/audit?limit=250').catch(() => null);
        if (res && res.ok) {
            const result = await res.json().catch(() => ({}));
            fetchedLogs = result.data || result || [];
        }

        // Parse & map raw audit logs to match the telemetry payload layout
        const mappedLogs = fetchedLogs.map(log => {
            let details = {};
            if (typeof log.new_value === 'string') {
                try { details = JSON.parse(log.new_value); } catch { details = {}; }
            } else if (log.new_value) { details = log.new_value; }
            return {
                id: log.id || Math.random().toString(36).substr(2, 9),
                userEmail: log.user_name || details.user || details.username || 'anonymous@academy.com',
                action: log.action === 'login_success' ? 'auth.login.success' 
                       : log.action === 'login_failed' ? 'auth.login.failed' 
                       : (details.action || log.action || 'system.audit'),
                status: (details.status || (log.action === 'login_success' ? 'SUCCESS' : log.action === 'login_failed' ? 'FAILED' : 'SUCCESS')),
                ipAddress: details.ipAddress || '127.0.0.1',
                deviceOS: details.deviceOS || 'Unknown OS',
                browser: details.browser || 'Unknown Browser',
                countryCode: details.countryCode || 'IN',
                createdAt: log.created_at || log.timestamp || new Date().toISOString()
            };
        });

        // Initialize state
        window.securityAlerts = mappedLogs;
        
        // If empty, generate some initial historical logs for demonstration
        if (window.securityAlerts.length === 0) {
            generateDemoHistoricalLogs();
        }

        // Hide empty state spinner
        if (emptyState) emptyState.style.display = 'none';

        // Render Graph
        renderAuditGraph();

        // Setup virtualizer
        initVirtualizer(scrollContainer, spacer);
        
    } catch (e) {
        console.error('Failed to load audit logs:', e);
        if (emptyState) {
            emptyState.innerHTML = `<span style="color:var(--danger)">⚠️ Error loading security log trace.</span>`;
        }
    }
};

function initVirtualizer(container, spacer) {
    if (window.auditVirtualizer) {
        window.auditVirtualizer.destroy();
    }

    const rowHeight = 44; // match compact high-density layout height
    
    window.auditVirtualizer = new VanillaVirtualizer({
        container: container,
        spacer: spacer,
        estimateSize: rowHeight,
        overscan: 10,
        count: window.securityAlerts.length,
        renderRow: (index, startY, height) => {
            const alert = window.securityAlerts[index];
            if (!alert) return null;

            const row = document.createElement('div');
            row.className = 'virtual-row';
            row.style.position = 'absolute';
            row.style.left = '0';
            row.style.top = '0';
            row.style.width = '100%';
            row.style.height = `${height}px`;
            row.style.transform = `translateY(${startY}px)`;
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.borderBottom = '1px solid var(--border)';
            row.style.padding = '0 16px';
            row.style.fontSize = '12px';
            row.style.background = alert.status === 'FAILED' ? 'rgba(239, 68, 68, 0.05)' : 'transparent';
            row.style.boxSizing = 'border-box';

            const isSuccess = alert.status === 'SUCCESS';
            const statusIcon = isSuccess
                ? `<span style="color:var(--success); font-size: 14px;" title="Success">🛡️</span>`
                : `<span class="pulse-alert" style="color:var(--danger); font-size: 14px;" title="Breach Alert">⚠️</span>`;

            row.innerHTML = `
                <div style="flex: 0 0 40px; display:flex; align-items:center; justify-content:center;">${statusIcon}</div>
                <div style="flex: 0 0 140px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;"><span class="trace-chip${alert.status === 'FAILED' ? ' failed' : ''}">${alert.action}</span></div>
                <div style="flex: 1 1 180px; color:var(--ivory); font-weight:500; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; padding-right:10px;">${alert.userEmail}</div>
                <div style="flex: 0 0 120px; font-family:var(--font-mono); color:var(--ivory-dim); font-size:11px;">💻 ${alert.ipAddress}</div>
                <div style="flex: 0 0 60px; display:flex; align-items:center; gap:4px; font-family:var(--font-mono); font-size:11px; color:var(--ivory-dim);">🌍 ${alert.countryCode}</div>
                <div style="flex: 0 0 160px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; color:var(--slate); font-size:11px;">⚙️ ${alert.deviceOS} (${alert.browser})</div>
                <div style="flex: 0 0 80px; text-align:right; font-family:var(--font-mono); color:var(--slate); font-size:11px;">⏱️ ${new Date(alert.createdAt).toLocaleTimeString()}</div>
            `;
            return row;
        }
    });

    window.auditVirtualizer.updateCount(window.securityAlerts.length);
    updateBufferLabel();
}

function updateBufferLabel() {
    const label = document.getElementById('virtual-buffer-track');
    if (label) {
        label.textContent = `Buffer: ${window.securityAlerts.length.toLocaleString()} items cached`;
    }
}

// Generate demo historical logs if the audit table in Supabase has no data
function generateDemoHistoricalLogs() {
    const emails = ['admin@academy.com', 'coach.sarah@academy.com', 'attacker@recon.net', 'parent.john@gmail.com', 'unknown.actor@shadow.org'];
    const actions = ['auth.login.success', 'auth.login.failed', 'session.anomaly', 'user.ban'];
    const systems = ['Windows 11', 'macOS Sonoma', 'Linux Kernel 6.8', 'iOS 17', 'Android 14'];
    const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
    const countries = ['IN', 'US', 'RU', 'DE', 'GB', 'SG'];
    const ips = ['103.45.12.84', '192.168.1.5', '82.102.23.41', '172.56.21.90', '45.132.89.102'];

    for (let i = 0; i < 60; i++) {
        const isFailed = Math.random() > 0.8;
        const status = isFailed ? 'FAILED' : 'SUCCESS';
        const action = isFailed ? 'auth.login.failed' : (Math.random() > 0.95 ? 'session.anomaly' : 'auth.login.success');
        const email = isFailed ? 'attacker@recon.net' : emails[Math.floor(Math.random() * emails.length)];
        
        window.securityAlerts.push({
            id: 'demo_' + i + '_' + Date.now(),
            userEmail: email,
            action: action,
            status: status,
            ipAddress: ips[Math.floor(Math.random() * ips.length)],
            deviceOS: systems[Math.floor(Math.random() * systems.length)],
            browser: browsers[Math.floor(Math.random() * browsers.length)],
            countryCode: countries[Math.floor(Math.random() * countries.length)],
            createdAt: new Date(Date.now() - i * 5 * 60 * 1000).toISOString() // space them out by 5 mins
        });
    }
}

// Render chart using Chart.js
function renderAuditGraph() {
    const ctx = document.getElementById('audit-log-chart');
    if (!ctx) return;

    // Destory existing chart instance
    if (window.auditChart) {
        window.auditChart.destroy();
        window.auditChart = null;
    }

    // Group logs by 1-hour interval for the past 6 hours, or simply past 10 minutes for active flow
    const intervals = Array.from({ length: 6 }, (_, idx) => {
        const time = new Date(Date.now() - idx * 30 * 60 * 1000);
        return time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    }).reverse();

    const successCounts = [0, 0, 0, 0, 0, 0];
    const failedCounts = [0, 0, 0, 0, 0, 0];

    window.securityAlerts.forEach(log => {
        const logTime = new Date(log.createdAt);
        const diffMinutes = (Date.now() - logTime.getTime()) / (60 * 1000);
        const intervalIndex = Math.min(5, Math.floor(diffMinutes / 30));
        
        if (intervalIndex >= 0 && intervalIndex < 6) {
            const chartIndex = 5 - intervalIndex;
            if (log.status === 'SUCCESS') {
                successCounts[chartIndex]++;
            } else {
                failedCounts[chartIndex]++;
            }
        }
    });

    window.auditChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: intervals,
            datasets: [
                {
                    label: 'Successful Auth',
                    data: successCounts,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Failed Attacks',
                    data: failedCounts,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#d4d4d8', font: { family: 'inherit', size: 11 } }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#71717a', font: { size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#71717a', font: { size: 10 } }
                }
            }
        }
    });
}

// Real-time Database Polling for Security/Audit Logs (Dynamic & International)
window.startSecurityLogsSimulation = function() {
    if (simulationInterval) clearInterval(simulationInterval);

    // Poll the database every 4 seconds for fresh real audit logs
    simulationInterval = setInterval(async () => {
        try {
            const res = await window.apiCall('/api/audit?limit=80').catch(() => null);
            if (res && res.ok) {
                const result = await res.json().catch(() => ([]));
                const fetchedLogs = result.data || result || [];
                
                let hasNew = false;
                
                fetchedLogs.forEach(log => {
                    // Check if this log is already present in our alerts array
                    const exists = window.securityAlerts.some(existing => 
                        existing.id === log.id || 
                        (existing.createdAt === log.created_at && existing.userEmail === log.user_name)
                    );

                    if (!exists) {
                        let details = {};
                        if (typeof log.new_value === 'string') {
                            try { details = JSON.parse(log.new_value); } catch { details = {}; }
                        } else if (log.new_value) { details = log.new_value; }
                        const mappedLog = {
                            id: log.id || Math.random().toString(36).substr(2, 9),
                            userEmail: log.user_name || details.user || details.username || 'system',
                            action: log.action === 'login_success' ? 'auth.login.success' 
                                   : log.action === 'login_failed' ? 'auth.login.failed' 
                                   : (details.action || log.action || 'system.audit'),
                            status: (details.status || (log.action === 'login_success' ? 'SUCCESS' : log.action === 'login_failed' ? 'FAILED' : 'SUCCESS')),
                            ipAddress: details.ipAddress || '127.0.0.1',
                            deviceOS: details.deviceOS || 'Unknown OS',
                            browser: details.browser || 'Unknown Browser',
                            countryCode: details.countryCode || 'IN',
                            createdAt: log.created_at || log.timestamp || new Date().toISOString()
                        };
                        window.securityAlerts.unshift(mappedLog);
                        hasNew = true;
                    }
                });

                if (hasNew) {
                    // Sort descending
                    window.securityAlerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    
                    if (window.securityAlerts.length > 2000) {
                        window.securityAlerts = window.securityAlerts.slice(0, 2000);
                    }

                    if (window.auditVirtualizer) {
                        window.auditVirtualizer.updateCount(window.securityAlerts.length);
                    }
                    updateBufferLabel();
                    renderAuditGraph();
                }
            }
        } catch (e) {
            console.warn('Real-time audit log poll failed:', e);
        }
    }, 4000);
};

window.stopSecurityLogsSimulation = function() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
};

