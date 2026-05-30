// access.js - Access Control Manager Logic
window.accessUsers = [];

window.loadAccessControl = async function() {
    if (window.role !== 'master' && window.role !== 'admin') {
        toast('Unauthorized access', 'error');
        return;
    }
    
    const tbody = document.getElementById('access-users-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5"><div class="loading-state"><span class="spinner"></span> Loading users...</div></td></tr>';

    try {
        const response = await fetch('/api/access_control', { // Re-using local dev proxy or Edge function
            headers: {
                'Content-Type': 'application/json',
                'role': window.role
            }
        });

        if (!response.ok) {
            let errorMsg = 'Failed to load users';
            try {
                const errData = await response.json();
                errorMsg = errData.error || errorMsg;
            } catch(e) {}
            throw new Error(errorMsg);
        }

        const data = await response.json();
        window.accessUsers = data.users || [];
        renderAccessTable();
    } catch (err) {
        console.error('Error loading access control:', err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${err.message}</td></tr>`;
        toast('Failed to load users', 'error');
    }
};

window.renderAccessTable = function() {
    const tbody = document.getElementById('access-users-tbody');
    if (!tbody) return;

    if (window.accessUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">No users found</div></td></tr>';
        return;
    }

    let html = '';
    window.accessUsers.forEach(u => {
        const createdDate = new Date(u.created_at).toLocaleDateString();
        const signInDate = u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never';
        
        // Prevent deleting the master user from the UI to avoid lockouts
        const isMaster = u.role === 'master';
        
        let roleBadge = 'badge-grey';
        if (u.role === 'master') roleBadge = 'badge-gold';
        else if (u.role === 'admin') roleBadge = 'badge-level';
        else if (u.role === 'coach') roleBadge = 'badge-purple';
        
        html += `<tr>
            <td style="font-weight:600; color:var(--ivory);">${window.escapeHtml(u.email)}</td>
            <td><span class="badge ${roleBadge}" style="text-transform:uppercase; font-size:10px;">${window.escapeHtml(u.role)}</span></td>
            <td style="color:var(--slate); font-size:12px;">${createdDate}</td>
            <td style="color:var(--slate); font-size:12px;">${signInDate}</td>
            <td style="text-align:center;">
                <div style="display:flex; justify-content:center; gap:6px;">
                    <button class="btn btn-outline-grey btn-sm" onclick="promptEditUserRole('${u.id}', '${u.role}')" style="padding:4px;" title="Edit Role" ${isMaster ? 'disabled' : ''}>✏️</button>
                    <button class="btn btn-outline-grey btn-sm text-danger" onclick="deleteUserAccess('${u.id}', '${window.escapeHtml(u.email)}')" style="padding:4px; border-color:var(--danger);" title="Revoke Access" ${isMaster ? 'disabled' : ''}>🗑️</button>
                </div>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
};

window.promptCreateUser = function() {
    const email = prompt("Enter new user's email/username:");
    if (!email) return;
    
    const password = prompt("Enter temporary password (min 6 chars):");
    if (!password || password.length < 6) {
        alert("Password must be at least 6 characters.");
        return;
    }
    
    const role = prompt("Enter role (admin, coach, parent):", "coach");
    if (!role) return;

    createAccessUser(email, password, role);
};

window.createAccessUser = async function(email, password, role) {
    try {
        const response = await fetch('/api/access_control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'role': window.role },
            body: JSON.stringify({ email, password, role })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        toast('User created successfully', 'success');
        loadAccessControl();
    } catch (err) {
        console.error('Error creating user:', err);
        alert('Error: ' + err.message);
    }
};

window.promptEditUserRole = function(id, currentRole) {
    const newRole = prompt(`Enter new role for user (current: ${currentRole}):\nOptions: admin, coach, parent`);
    if (!newRole || newRole === currentRole) return;
    
    updateAccessUser(id, newRole, null);
};

window.updateAccessUser = async function(id, role, password) {
    try {
        const response = await fetch('/api/access_control', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'role': window.role },
            body: JSON.stringify({ id, role, password })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        toast('User updated successfully', 'success');
        loadAccessControl();
    } catch (err) {
        console.error('Error updating user:', err);
        alert('Error: ' + err.message);
    }
};

window.deleteUserAccess = async function(id, email) {
    if (!confirm(`Are you SURE you want to revoke access for ${email}? This cannot be undone.`)) return;
    
    try {
        const response = await fetch('/api/access_control', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'role': window.role },
            body: JSON.stringify({ id })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        toast('User access revoked', 'success');
        loadAccessControl();
    } catch (err) {
        console.error('Error deleting user:', err);
        alert('Error: ' + err.message);
    }
};

// Hook into existing navigation if possible
const origSetPage = window.setPage;
window.setPage = function(page) {
    origSetPage(page);
    if (page === 'access') {
        loadAccessControl();
    }
};
