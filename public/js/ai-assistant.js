/**
 * Chesskidoo AI Assistant Module
 * Handles floating chat interactions and AI queries.
 */

window.toggleChatbot = function() {
    const panel = document.getElementById('chat-panel');
    if (panel) panel.style.display = 'flex';
};

window.sendChatMessage = function() {
    toast('Chat feature initialized.');
};

window.toggleChat = function() {
    const panel = document.getElementById('chat-panel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
    }
};

window.toggleLoginChat = function() {
    const panel = document.getElementById('login-chat-panel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
    }
};

window.sendLoginChat = async function() {
    const input = document.getElementById('login-chat-input');
    if (!input || !input.value.trim()) return;
    
    const msg = input.value.trim();
    input.value = '';
    
    const container = document.getElementById('login-chat-body');
    if (container) {
        container.innerHTML += `<div class="chat-msg user">${escapeHtml(msg)}</div>`;
        container.scrollTop = container.scrollHeight;
    }
    
    try {
        const res = await apiCall('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg, role: 'visitor', context: {} })
        });
        
        const data = await res.json();
        if (container) {
            container.innerHTML += `<div class="chat-msg bot">${data.message || 'AI is thinking...'}</div>`;
            container.scrollTop = container.scrollHeight;
        }
    } catch (e) {
        if (container) {
            container.innerHTML += `<div class="chat-msg bot" style="color:var(--danger)">Error: ${e.message}</div>`;
        }
    }
};

window.sendChat = async function() {
    const input = document.getElementById('chat-input');
    if (!input || !input.value.trim()) return;
    
    const msg = input.value.trim();
    input.value = '';
    
    const body = document.getElementById('ai-chat-body');
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-msg user';
    userMsg.textContent = msg;
    body.appendChild(userMsg);
    body.scrollTop = body.scrollHeight;
    
    // Build context for AI
    const lastDue = document.getElementById('s-last-due')?.textContent || '₹0';
    const currPending = document.getElementById('s-curr-pending')?.textContent || '₹0';
    const revenue = document.getElementById('s-rev')?.textContent || '₹0';
    const activeModule = window.location.hash || 'Dashboard';

    try {
        const res = await apiCall('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: msg, 
                role: window.role || 'admin', 
                context: { 
                    students: window.allStudents?.length || 0,
                    activeStudents: window.allStudents?.filter(s => s.status === 'active').length || 0,
                    coaches: window.allCoaches?.length || 0,
                    revenue: parseFloat(revenue.replace(/[^\d.]/g, '') || 0),
                    lastDue: parseFloat(lastDue.replace(/[^\d.]/g, '') || 0),
                    pendingPayments: parseFloat(currPending.replace(/[^\d.]/g, '') || 0),
                    moduleFocus: activeModule
                } 
            })
        });
        
        const data = await res.json();
        const botMsg = document.createElement('div');
        botMsg.className = 'chat-msg bot';
        botMsg.textContent = data.message || "I'm processing your request...";
        body.appendChild(botMsg);
        body.scrollTop = body.scrollHeight;
    } catch (e) {
        const botMsg = document.createElement('div');
        botMsg.className = 'chat-msg bot';
        botMsg.style.color = 'var(--danger)';
        botMsg.textContent = 'Connection error. AI is offline.';
        body.appendChild(botMsg);
        body.scrollTop = body.scrollHeight;
    }
};

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
