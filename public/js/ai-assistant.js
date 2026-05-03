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
    await handleAITask('chat-input', 'ai-chat-body');
};

window.sendLoginChat = async function() {
    await handleAITask('login-chat-input', 'login-chat-body');
};

async function handleAITask(inputId, bodyId) {
    const input = document.getElementById(inputId);
    if (!input || !input.value.trim()) return;
    
    const msg = input.value.trim();
    input.value = '';
    
    appendMsg(bodyId, 'user', msg);
    
    const thinking = showThinking(bodyId);
    const snapshot = window.getAcademySnapshot ? window.getAcademySnapshot() : null;

    try {
        const res = await apiCall('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: msg, 
                role: window.role || 'guest', 
                context: snapshot || { status: 'landing_page' },
                systemPrompt: "You are the ChessKidoo Landing Assistant. Be welcoming, helpful, and encourage visitors to join the premium chess academy. If they ask about fees or schedule, suggest they log in or contact admin."
            })
        });
        
        const data = await res.json();
        hideThinking(thinking);
        appendMsg(bodyId, 'bot', data.message || "My calculations are complete. How can I assist further?");
        
    } catch (e) {
        hideThinking(thinking);
        appendMsg(bodyId, 'bot', 'Neural link interrupted. Please check your connection.', true);
    }
}

function appendMsg(bodyId, type, text, isError = false) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    
    const div = document.createElement('div');
    div.className = `ai-msg ${type}`;
    if (isError) div.style.color = 'var(--danger)';
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
}

function showThinking(bodyId) {
    const body = document.getElementById(bodyId);
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
