/**
 * Two Knights - Batch Passwords Module
 * Handles password reset functionality for students individually or in batches.
 */

(function() {
  const $ = (id) => document.getElementById(id);

  window.renderBatchPasswords = async function() {
    const placeholder = $('batch-passwords-card-placeholder');
    if (!placeholder) return;

    const batches = window.allBatches || [];
    const students = window.allStudents || [];
    const coaches = window.allCoaches || [];

    // Pre-fetch batch passwords from the security endpoint so the admin
    // can see the current batch password in each batch header.
    const batchPasswordPromises = (batches || []).map(async (b) => {
      try {
        const res = await window.apiCall(`/api/security?batchId=${encodeURIComponent(b.id)}`);
        if (res.ok) {
          const data = await res.json();
          return { batchId: b.id, password: data.batch_password || null };
        }
      } catch (e) {
        console.warn('Failed to load batch password for', b.id, e);
      }
      return { batchId: b.id, password: null };
    });

    const batchPasswordResults = await Promise.all(batchPasswordPromises);
    const batchPasswordMap = new Map(batchPasswordResults.map(r => [r.batchId, r.password]));

    let html = `
      <div class="card" style="border: 1px solid var(--border); background:var(--bg2); margin-top: 24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px; flex-wrap:wrap; gap:10px;">
          <h3 style="color:var(--gold); margin:0; font-family:var(--font-head); display:flex; align-items:center; gap:8px; font-size: 18px;">
            🔑 Student Batch Password Manager
          </h3>
          <span class="badge badge-level" style="font-size:11px;">${batches.length} batches</span>
        </div>
        <p style="font-size: 13px; color: var(--ivory-dim); margin-bottom: 20px; line-height: 1.6;">
          Set passwords for all students in a batch simultaneously, or click a batch to expand and manage passwords for individual students.
        </p>
        
        <div style="display:flex; flex-direction:column; gap:12px;">
    `;

    if (batches.length === 0) {
      html += `<div style="padding:15px; text-align:center; color:var(--ivory-dim); font-size:13px; background:var(--bg3); border-radius:8px; border:1px solid var(--border);">No batches found.</div>`;
    } else {
      // Sort batches alphabetically
      const sortedBatches = [...batches].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      sortedBatches.forEach(b => {
        const batchStudents = students
          .filter(s => String(s.batch_id) === String(b.id))
          .sort((a, b) => (window.getStudentName ? window.getStudentName(a) : a.name).localeCompare(window.getStudentName ? window.getStudentName(b) : b.name));
        const coach = coaches.find(c => String(c.id) === String(b.coach_id));
        const coachName = coach ? (coach.name || coach.full_name || 'Unassigned') : 'Unassigned';

      const batchPassword = batchPasswordMap.get(b.id) || null;
      
      html += `
          <div style="background:var(--bg3); border:1px solid var(--border); border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:8px;">
            <!-- Batch Header Row -->
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
               <div>
                <div style="font-weight:700; color:var(--gold); font-size:14px;">${window.escapeHtml(b.name || 'Unnamed Batch')}</div>
                <div style="font-size:11px; color:var(--ivory-dim); margin-top:2px;">
                  Coach: <span style="color:var(--ivory);">${window.escapeHtml(coachName)}</span> &middot; 
                  Students: <span style="color:var(--ivory); font-weight:600;">${batchStudents.length}</span>
                </div>
                ${batchPassword ? `<div style="font-size:11px; color:var(--success); margin-top:4px; font-family:var(--font-mono);">Batch password: <span style="user-select:all; cursor:text;">${window.escapeHtml(batchPassword)}</span></div>` : `<div style="font-size:11px; color:var(--ivory-dim); margin-top:4px; font-style:italic;">No batch password set</div>`}
              </div>

              <!-- Batch Actions -->
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <input type="text" id="batch-pwd-input-${b.id}" placeholder="New batch password..." class="input-field"
                       style="width:160px; padding:5px 8px; font-size:12px; margin:0; height:30px; background:var(--surface); border:1px solid var(--border); color:var(--ivory); border-radius:6px;" autocomplete="new-password">
                <button class="btn btn-gold btn-sm" onclick="resetBatchPasswords('${b.id}', '${window.escapeHtml(b.name || 'Batch')}')" style="height:30px; padding:0 10px; font-size:12px; font-weight:600;">
                  Set Batch Password
                </button>
                <button id="btn-expand-${b.id}" class="btn btn-outline-grey btn-sm" onclick="toggleBatchStudentsCollapse('${b.id}')" style="height:30px; padding:0 10px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                  <span>Show Students</span> <span id="arrow-icon-${b.id}">▼</span>
                </button>
              </div>
            </div>
            
            <!-- Collapsible Students List -->
            <div id="area-students-${b.id}" style="display:none; margin-top:8px; border-top:1px solid rgba(255,255,255,0.05); padding-top:10px;">
              ${batchStudents.length === 0 ? `
                <div style="font-size:12px; color:var(--ivory-dim); padding:4px;">No students enrolled in this batch.</div>
              ` : `
                <div class="table-wrap" style="box-shadow: none; border-radius: 6px; overflow-x: auto; border: 1px solid var(--border); background:var(--surface);">
                  <table style="width:100%; border-collapse:collapse; text-align:left; font-size:12px;">
                    <thead>
                      <tr style="background:var(--bg3); border-bottom:1px solid var(--border);">
                        <th style="padding:6px 10px; font-weight:600; color:var(--ivory-dim);">Student Name</th>
                        <th style="padding:6px 10px; font-weight:600; color:var(--ivory-dim);">Email/Login</th>
                        <th style="padding:6px 10px; font-weight:600; color:var(--ivory-dim);">Current Password</th>
                        <th style="padding:6px 10px; font-weight:600; color:var(--ivory-dim); text-align:center; width:220px;">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${batchStudents.map(s => {
                        const pwd = s.password || '••••••••';
                        const isPlain = !!s.password;
                        return `
                          <tr style="border-bottom:1px solid var(--border);">
                            <td style="padding:8px 10px; color:var(--ivory); font-weight:500;">${window.escapeHtml(window.getStudentName ? window.getStudentName(s) : s.name)}</td>
                            <td style="padding:8px 10px; color:var(--ivory2);">${window.escapeHtml(s.email || 'No email')}</td>
                            <td style="padding:8px 10px; font-family:var(--font-mono); color:var(--ivory-dim);">
                              ${isPlain ? `<span style="color:var(--ivory); background:var(--bg3); padding:2px 6px; border-radius:4px; user-select:all; cursor:text;">${window.escapeHtml(pwd)}</span>` : `<span style="opacity:0.5;">${pwd}</span>`}
                            </td>
                            <td style="padding:8px 10px; text-align:center;">
                              <div style="display:inline-flex; align-items:center; gap:6px;">
                                <input type="text" id="student-pwd-input-${s.id}" placeholder="New password..." class="input-field" 
                                       style="width:110px; padding:4px 6px; font-size:11px; margin:0; height:26px; background:var(--bg3); border:1px solid var(--border); color:var(--ivory); border-radius:4px;" autocomplete="new-password">
                                <button class="btn btn-outline btn-sm" onclick="resetIndividualPassword('${s.id}', '${window.escapeHtml(s.name || 'Student')}')" style="height:26px; font-size:11px; padding:0 8px; font-weight:600; display:inline-flex; align-items:center; gap:2px;">
                                  Set Password
                                </button>
                              </div>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            </div>
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>
    `;

    placeholder.innerHTML = html;
  };

  window.toggleBatchStudentsCollapse = function(batchId) {
    const area = $('area-students-' + batchId);
    const arrow = $('arrow-icon-' + batchId);
    const btn = $('btn-expand-' + batchId);
    if (!area) return;

    if (area.style.display === 'none') {
      area.style.display = 'block';
      if (arrow) arrow.textContent = '▲';
      if (btn) btn.querySelector('span').textContent = 'Hide Students';
    } else {
      area.style.display = 'none';
      if (arrow) arrow.textContent = '▼';
      if (btn) btn.querySelector('span').textContent = 'Show Students';
    }
  };

  window.resetBatchPasswords = async function(batchId, batchName) {
    const input = $('batch-pwd-input-' + batchId);
    const password = input ? input.value : '';

    if (!password) {
      return window.toast ? window.toast('Password cannot be empty', 'error') : alert('Password cannot be empty');
    }

    const confirmMsg = `Are you sure you want to reset the password for ALL students in batch "${batchName}"?`;
    if (!confirm(confirmMsg)) return;

    await executePasswordReset({ action: 'reset_passwords', batchId, newPassword: password });
    if (input) input.value = '';

    if (window.loadAllData) {
      await window.loadAllData(true);
      if (window.renderBatchPasswords) window.renderBatchPasswords();
    }
  };

  window.resetIndividualPassword = async function(studentId, studentName) {
    const input = $('student-pwd-input-' + studentId);
    const password = input ? input.value : '';

    if (!password) {
      return window.toast ? window.toast('Password cannot be empty', 'error') : alert('Password cannot be empty');
    }

    const confirmMsg = `Reset password for "${studentName}"?`;
    if (!confirm(confirmMsg)) return;

    await executePasswordReset({ action: 'reset_passwords', studentIds: [studentId], newPassword: password });
    if (input) input.value = '';

    if (window.loadAllData) {
      await window.loadAllData(true);
      if (window.renderBatchPasswords) window.renderBatchPasswords();
    }
  };

  async function executePasswordReset(payload) {
    try {
      const res = await window.apiCall('/api/security', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        window.toast ? window.toast(data.message || 'Passwords updated successfully!', 'success') : null;
        if (data.errors && data.errors.length > 0) {
          console.warn('Some passwords failed to reset:', data.errors);
          window.toast ? window.toast(`${data.errors.length} student(s) could not be reset. Check logs.`, 'warning') : null;
        }
      } else {
        window.toast ? window.toast(data.error || 'Failed to reset passwords', 'error') : null;
      }
    } catch (e) {
      console.error(e);
      window.toast ? window.toast('Error communicating with security service', 'error') : null;
    }
  }
})();