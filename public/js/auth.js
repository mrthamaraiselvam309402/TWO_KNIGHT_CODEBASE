/**
 * Chesskidoo Authentication Module
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

    try {
        // 1. Auth API - Primary Secure Authentication via Supabase Edge Function
        const authRes = await apiCall(`${API_BASE}/auth`, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', username: user, password: pass })
        }).catch(err => {
            console.error('API Auth failed:', err);
            return null;
        });
        
        if (authRes && authRes.ok) {
            const data = await authRes.json();
            if (data.success) {
                role = data.role;
                localStorage.setItem('chesskidoo_auth', JSON.stringify({ 
                    role, 
                    user: data.user || user, 
                    studentId: data.student_id,
                    token: data.token 
                }));
                finishLogin(data.user || user, role, data.student_id);
                toast(`Welcome back, ${data.role}!`, 'success');
                return;
            } else {
                errEl.textContent = data.details || data.error || 'Invalid credentials.';
                errEl.style.display = 'block';
                return;
            }
        }

        errEl.textContent = 'Invalid credentials or connection error.';
        errEl.style.display = 'block';
        logAudit('auth', user, 'login_failed', null, { username: user, time: new Date().toISOString() });
        
    } catch (e) {
        console.error('Login error:', e);
        errEl.textContent = 'Server unreachable. Please try again later.';
        logAudit('auth', user, 'login_failed', null, { username: user, error: e.message });
    } finally {
        setBtnLoading(false);
    }
};

window.doLogout = function() {
    localStorage.removeItem('chesskidoo_auth');
    role = null;
    if (window.role) window.role = null;
    
    document.body.classList.remove('admin-mode', 'parent-mode', 'master-mode');
    document.body.classList.add('login-mode');
    
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) loginScreen.style.display = 'flex';
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('active');
    
    toast('Logged out safely.', 'info');
    setTimeout(() => location.reload(), 500); // Reload to clear all state
};
