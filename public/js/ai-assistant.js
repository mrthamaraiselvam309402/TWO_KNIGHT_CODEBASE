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

window.sendChat = function() {
    const input = document.getElementById('chat-input');
    if (!input || !input.value.trim()) return;
    
    const body = document.getElementById('ai-chat-body');
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-msg user';
    userMsg.textContent = input.value;
    body.appendChild(userMsg);
    
    const msg = input.value;
    input.value = '';
    body.scrollTop = body.scrollHeight;
    
    setTimeout(() => {
        const botMsg = document.createElement('div');
        botMsg.className = 'chat-msg bot';
        botMsg.textContent = 'I\'m your AI assistant. For detailed analytics, please use the AI Assistant page.';
        body.appendChild(botMsg);
        body.scrollTop = body.scrollHeight;
    }, 800);
};

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
