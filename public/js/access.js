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
        const response = await window.apiCall('/api/access_control', { // Re-using local dev proxy or Edge function
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
        const response = await window.apiCall('/api/access_control', {
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
        const response = await window.apiCall('/api/access_control', {
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
        const response = await window.apiCall('/api/access_control', {
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
            const details = typeof log.new_value === 'string' ? JSON.parse(log.new_value) : (log.new_value || {});
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
            row.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
            row.style.padding = '0 16px';
            row.style.fontSize = '12px';
            row.style.background = alert.status === 'FAILED' ? 'rgba(239, 68, 68, 0.05)' : 'transparent';
            row.style.boxSizing = 'border-box';
            
            const isSuccess = alert.status === 'SUCCESS';
            const statusIcon = isSuccess 
                ? `<span style="color:var(--success); font-size: 14px;" title="Success">🛡️</span>`
                : `<span class="pulse-alert" style="color:var(--danger); font-size: 14px;" title="Breach Alert">⚠️</span>`;

            const actionColor = alert.status === 'FAILED' 
                ? 'color: #f87171; border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.1);' 
                : 'color: #fbbf24; border-color: rgba(232,168,48,0.3); background: rgba(232,168,48,0.05);';
            
            row.innerHTML = `
                <div style="flex: 0 0 40px; display:flex; align-items:center; justify-content:center;">${statusIcon}</div>
                <div style="flex: 0 0 140px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;"><span style="font-family:var(--font-mono); font-size:10px; padding:2px 6px; border:1px solid; border-radius:4px; ${actionColor}">${alert.action}</span></div>
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
                        const details = typeof log.new_value === 'string' ? JSON.parse(log.new_value) : (log.new_value || {});
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

