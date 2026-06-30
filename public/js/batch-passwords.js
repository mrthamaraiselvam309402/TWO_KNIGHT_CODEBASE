/**
 * Two Knights - Batch Passwords Module
 * Handles password reset functionality for students individually or in batches.
 */

window.renderBatchPasswords = async function() {
    const dashboard = document.getElementById('page-admin-dash');
    if (!dashboard) return;
    
    // Check if security section exists, if not create it
    let securitySection = document.getElementById('admin-security-section');
    if (!securitySection) {
        securitySection = document.createElement('div');
        securitySection.id = 'admin-security-section';
        securitySection.className = 'dashboard-widget full-width';
        securitySection.innerHTML = `
            <div class="widget-header">
                <h3><span class="material-icons">security</span> Security & Password Management</h3>
            </div>
            <div class="widget-content">
                <div class="form-row">
                    <div class="form-group">
                        <label>Select Batch to Manage Passwords</label>
                        <select id="password-batch-select" class="form-control">
                            <option value="">-- Select a Batch --</option>
                        </select>
                    </div>
                </div>
                
                <div id="password-management-area" style="display:none; margin-top: 20px;">
                    <div class="password-tools" style="display: flex; gap: 10px; align-items: flex-end; margin-bottom: 20px; padding: 15px; background: rgba(0,0,0,0.05); border-radius: 8px;">
                        <div class="form-group" style="flex: 1; margin: 0;">
                            <label>New Password for Batch</label>
                            <input type="text" id="batch-new-password" class="form-control" placeholder="E.g. Chess123!" autocomplete="new-password">
                        </div>
                        <button class="btn btn-warning" id="btn-reset-batch-passwords">
                            <span class="material-icons">lock_reset</span> Reset All in Batch
                        </button>
                    </div>
                    
                    <h4>Students in Batch</h4>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="password-students-list">
                                <!-- Students loaded here -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        // Add to dashboard, before the logs or at the end
        dashboard.appendChild(securitySection);
        
        // Setup listeners
        document.getElementById('password-batch-select').addEventListener('change', async (e) => {
            const batchId = e.target.value;
            const area = document.getElementById('password-management-area');
            if (!batchId) {
                area.style.display = 'none';
                return;
            }
            area.style.display = 'block';
            await loadStudentsForPasswordReset(batchId);
        });
        
        document.getElementById('btn-reset-batch-passwords').addEventListener('click', async () => {
            const batchId = document.getElementById('password-batch-select').value;
            const password = document.getElementById('batch-new-password').value;
            if (!batchId) return toast('Please select a batch', 'warning');
            if (!password || password.length < 6) return toast('Password must be at least 6 characters', 'warning');
            
            if (confirm('Are you sure you want to reset the password for ALL students in this batch to "' + password + '"?')) {
                await executePasswordReset({ action: 'reset_passwords', batchId, newPassword: password });
                document.getElementById('batch-new-password').value = '';
            }
        });
    }
    
    // Populate batches dropdown
    populatePasswordBatches();
};

async function populatePasswordBatches() {
    const select = document.getElementById('password-batch-select');
    if (!select) return;
    
    const batches = window.appData?.batches || [];
    select.innerHTML = '<option value="">-- Select a Batch --</option>';
    
    batches.forEach(b => {
        const option = document.createElement('option');
        option.value = b.id;
        option.textContent = b.name;
        select.appendChild(option);
    });
}

async function loadStudentsForPasswordReset(batchId) {
    const tbody = document.getElementById('password-students-list');
    tbody.innerHTML = '<tr><td colspan="3">Loading students...</td></tr>';
    
    const students = (window.appData?.students || []).filter(s => s.batch_id === batchId);
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No students found in this batch.</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    students.forEach(student => {
        const tr = document.createElement('tr');
        
        const tdName = document.createElement('td');
        tdName.textContent = student.name;
        
        const tdEmail = document.createElement('td');
        tdEmail.textContent = student.email || 'No email';
        
        const tdActions = document.createElement('td');
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn btn-sm btn-outline';
        resetBtn.innerHTML = '<span class="material-icons">key</span> Reset Individual';
        resetBtn.onclick = () => promptIndividualReset(student);
        
        tdActions.appendChild(resetBtn);
        
        tr.appendChild(tdName);
        tr.appendChild(tdEmail);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
    });
}

async function promptIndividualReset(student) {
    const pwd = prompt('Enter new password for ' + student.name + ' (min 6 chars):');
    if (pwd === null) return;
    if (pwd.length < 6) return toast('Password must be at least 6 characters', 'warning');
    
    await executePasswordReset({ action: 'reset_passwords', studentIds: [student.id], newPassword: pwd });
}

async function executePasswordReset(payload) {
    const btn = document.getElementById('btn-reset-batch-passwords');
    if (btn) btn.disabled = true;
    
    try {
        const res = await window.apiCall('/api/security', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const data = await res.json().catch(() => ({}));
        if (data.success) {
            toast(data.message || 'Passwords reset successfully!', 'success');
            if (data.errors && data.errors.length > 0) {
                console.warn('Some passwords failed to reset:', data.errors);
                toast(data.errors.length + ' student(s) could not be reset. Check console.', 'warning');
            }
        } else {
            toast(data.error || 'Failed to reset passwords', 'error');
        }
    } catch (e) {
        toast('Error communicating with server', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}