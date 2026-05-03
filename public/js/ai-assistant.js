/**
 * Chesskidoo AI Assistant Module
 * Handles floating chat interactions and AI queries with High-Fidelity Intelligence.
 */

window.toggleChat = function() {
    const panel = document.getElementById('chat-panel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
        if (panel.style.display === 'flex' && !window.pillsInitialized) {
            initSmartPills();
        }
    }
};

window.toggleLoginChat = function() {
    const panel = document.getElementById('login-chat-panel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
    }
};

function initSmartPills() {
    const suggestions = [
        "Audit May Arrears",
        "Top Performing Coach?",
        "Growth Recommendation",
        "Summarize Academy Health"
    ];
    const container = document.getElementById('ai-suggestions');
    if (container) {
        container.innerHTML = '';
        suggestions.forEach(text => {
            const pill = document.createElement('div');
            pill.className = 'ai-ws-pill';
            pill.textContent = text;
            pill.onclick = () => {
                const input = document.getElementById('chat-input');
                if (input) {
                    input.value = text;
                    sendChat();
                }
            };
            container.appendChild(pill);
        });
        window.pillsInitialized = true;
    }
}

window.sendChat = async function() {
    const input = document.getElementById('chat-input');
    if (!input || !input.value.trim()) return;
    
    const msg = input.value.trim();
    input.value = '';
    
    const body = document.getElementById('ai-chat-body');
    appendMsg('user', msg);
    
    // Show "Grandmaster is calculating..."
    const thinking = showThinking();
    
    // Fetch Real-Time Academy Intelligence
    const snapshot = window.getAcademySnapshot ? window.getAcademySnapshot() : null;

    try {
        const res = await apiCall('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: msg, 
                role: window.role || 'admin', 
                context: snapshot || { status: 'basic' },
                systemPrompt: "You are the ChessKidoo Grandmaster Assistant. Use the provided academy data to give strategic, encouraging, and highly accurate advice. Speak like a professional chess coach."
            })
        });
        
        const data = await res.json();
        hideThinking(thinking);
        appendMsg('bot', data.message || "My calculations are complete. How can I assist further?");
        
    } catch (e) {
        hideThinking(thinking);
        appendMsg('bot', 'Neural link interrupted. Please check your connection.', true);
    }
};

function appendMsg(type, text, isError = false) {
    const body = document.getElementById('ai-chat-body');
    if (!body) return;
    
    const div = document.createElement('div');
    div.className = `ai-msg ${type}`;
    if (isError) div.style.color = 'var(--danger)';
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
}

function showThinking() {
    const body = document.getElementById('ai-chat-body');
    const div = document.createElement('div');
    div.className = 'ai-msg bot thinking';
    div.innerHTML = '<span class="spinner" style="width:12px; height:12px; margin-right:8px"></span>Grandmaster is calculating strategy...';
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
}

function hideThinking(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
