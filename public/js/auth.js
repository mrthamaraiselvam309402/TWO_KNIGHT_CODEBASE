/**
 * Two Knights Authentication Module
 * Handles secure backend login, role-based access, and session persistence.
 */

window.doLogin = async function() {
    const userEl = document.getElementById('li-user');
    const passEl = document.getElementById('li-pass');
    const errEl = document.getElementById('login-err');
    const loginBtn = document.getElementById('login-submit-btn') || document.querySelector('.login-btn');
    
    if (!userEl || !passEl || !errEl) return;

    const user = userEl.value.trim();
    const pass = passEl.value.trim();
    errEl.style.display = 'none';

    if (!user || !pass) {
        errEl.textContent = 'Enter username and password.';
        errEl.style.display = 'block';
        return;
    }

    const setBtnLoading = (loading) => {
        if (!loginBtn) return;
        loginBtn.disabled = loading;
        loginBtn.textContent = loading ? 'Authenticating...' : 'Sign In';
    };

    setBtnLoading(true);
    const telemetry = window.extractDeviceTelemetry ? window.extractDeviceTelemetry() : {};

    try {
        // 1. Auth API - Primary Secure Authentication via Supabase Edge Function
        const authRes = await window.apiCall(`${API_BASE}/auth`, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', username: user, password: pass })
        }).catch(err => {
            console.error('API Auth failed:', err);
            return null;
        });
        
        if (authRes && authRes.ok) {
            const data = await authRes.json().catch(() => ({}));
            if (data.success) {
                // Normalize coach-admin/coach+admin to admin for full UI privileges
                let displayRole = data.role;
                if (displayRole === 'coach-admin' || displayRole === 'coach+admin') {
                    displayRole = 'admin';
                }
                window.role = displayRole;
                // Store both the full auth object and a separate token for API calls
                sessionStorage.setItem('twoknights_auth', JSON.stringify({
                    role: displayRole,
                    actualRole: data.role, // store actual role for audit logs
                    user: data.user || user,
                    studentId: data.student_id,
                    coachId: data.coach_id,
                    token: data.token,
                    userId: data.coach_id // Set userId for coach role compatibility
                }));
                // Store token separately for API Authorization header
                sessionStorage.setItem('sb-access-token', data.token);
                // Also set window.currentCoachId for coach dashboard
                window.currentCoachId = data.coach_id || null;
                window.userId = data.coach_id || null; // Set userId for homework.js compatibility
                window.finishLogin(data.user || user, displayRole, data.student_id);
                window.toast(`Welcome back, ${displayRole}!`, 'success');

                // Log successful login with security telemetry parameters
                if (window.logAudit) {
                    window.logAudit('auth', data.role, 'login_success', null, {
                        user: data.user || user,
                        role: data.role,
                        ipAddress: telemetry.ip,
                        deviceOS: telemetry.os,
                        browser: telemetry.browser,
                        countryCode: telemetry.country,
                        status: 'SUCCESS',
                        action: 'auth.login.success'
                    });
                }
                return;
            } else {
                errEl.textContent = data.details || data.error || 'Invalid credentials.';
                errEl.style.display = 'block';
                if (window.logAudit) {
                    window.logAudit('auth', user, 'login_failed', null, {
                        username: user,
                        ipAddress: telemetry.ip,
                        deviceOS: telemetry.os,
                        browser: telemetry.browser,
                        countryCode: telemetry.country,
                        status: 'FAILED',
                        action: 'auth.login.failed',
                        error: data.details || data.error || 'Invalid credentials.'
                    });
                }
                return;
            }
        }

        errEl.textContent = 'Invalid credentials or connection error.';
        errEl.style.display = 'block';
        if (window.logAudit) {
            window.logAudit('auth', user, 'login_failed', null, {
                username: user,
                ipAddress: telemetry.ip,
                deviceOS: telemetry.os,
                browser: telemetry.browser,
                countryCode: telemetry.country,
                status: 'FAILED',
                action: 'auth.login.failed',
                error: 'Connection or response failure'
            });
        }
        
    } catch (e) {
        console.error('Login error:', e);
        errEl.textContent = 'Server unreachable. Please try again later.';
        if (window.logAudit) {
            window.logAudit('auth', user, 'login_failed', null, {
                username: user,
                ipAddress: telemetry.ip,
                deviceOS: telemetry.os,
                browser: telemetry.browser,
                countryCode: telemetry.country,
                status: 'FAILED',
                action: 'auth.login.failed',
                error: e.message
            });
        }
    } finally {
        setBtnLoading(false);
    }
};

 window.doLogout = async function() {
     const token = sessionStorage.getItem('sb-access-token');
     if (token && token.startsWith('eyJ')) {
       await (window.apiCall || fetch)('/api/auth', {
         method: 'POST',
         body: JSON.stringify({ action: 'logout', token })
       }).catch(() => {});
     }

     sessionStorage.removeItem('twoknights_auth');
     sessionStorage.removeItem('sb-access-token');
     window.role = null;
     
     document.body.classList.remove('admin-mode', 'parent-mode', 'master-mode');
     document.body.classList.add('login-mode');
     
     const loginScreen = document.getElementById('login-screen');
     if (loginScreen) loginScreen.style.display = 'flex';
     
     const sidebar = document.getElementById('sidebar');
     if (sidebar) sidebar.classList.remove('active');
     
     if (window.toast) window.toast('Logged out safely.', 'info');
     setTimeout(() => location.reload(), 500); // Reload to clear all state
   };
