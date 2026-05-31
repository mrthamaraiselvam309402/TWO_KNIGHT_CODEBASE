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
                    window.sendChat();
                }
            };
            container.appendChild(pill);
        });
        window.pillsInitialized = true;
    }
}
window.initSmartPills = initSmartPills;

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

    // FIX: Use window.apiCall with fetch fallback so this file works even if scripts.js hasn't loaded
    const callApi = (url, opts) => {
        if (typeof window.apiCall === 'function') return window.apiCall(url, opts);
        return fetch(url, opts);
    };

    try {
        const res = await callApi('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: msg,
                role: window.role || 'guest',
                context: snapshot || { status: 'landing_page' },
                systemPrompt: "You are the ChessKidoo Landing Assistant. Be welcoming, helpful, and encourage visitors to join the premium chess academy. If they ask about fees or schedule, suggest they log in or contact admin."
            })
        });

        if (!res || !res.ok) {
            throw new Error(`AI service returned ${res ? res.status : 'no response'}`);
        }

        const data = await res.json().catch(() => ({}));
        hideThinking(thinking);
        appendMsg(bodyId, 'bot', data.message || "My calculations are complete. How can I assist further?");

    } catch (e) {
        console.warn('[AI Assistant] request failed:', e && e.message);
        hideThinking(thinking);
        appendMsg(bodyId, 'bot', 'Neural link interrupted. Please check your connection.', true);
    }
}

function appendMsg(bodyId, type, text, isError = false) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    
    const div = document.createElement('div');
    div.className = `ai-msg ${type}`;
    if (isError) {
        div.style.color = 'var(--danger)';
        div.textContent = text;
    } else {
        // Safe premium markdown rendering
        let safeHtml = escapeHtml(text);
        safeHtml = safeHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        safeHtml = safeHtml.replace(/\*(.*?)\*/g, '<em>$1</em>');
        safeHtml = safeHtml.replace(/• /g, '&bull; ');
        safeHtml = safeHtml.replace(/\n/g, '<br>');
        div.innerHTML = safeHtml;
    }
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
}

function showThinking(bodyId) {
    const body = document.getElementById(bodyId);
    if (!body) return null;
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

// ─── Draggable AI Bot Logic ────────────────────────────────────────
(function() {
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let isClick = true;

    window.dragStartBot = function(e) {
        if (e.button !== 0) return;
        const btn = document.getElementById('ai-chat-btn');
        if (!btn) return;

        isDragging = true;
        isClick = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = btn.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        // Temporarily turn off transitions during dragging
        btn.style.transition = 'none';
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
        btn.style.left = initialLeft + 'px';
        btn.style.top = initialTop + 'px';

        document.addEventListener('mousemove', dragMoveBot);
        document.addEventListener('mouseup', dragEndBot);
        e.preventDefault();
    };

    function dragMoveBot(e) {
        if (!isDragging) return;
        const btn = document.getElementById('ai-chat-btn');
        if (!btn) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            isClick = false; // it's a drag
        }

        const nextLeft = initialLeft + dx;
        const nextTop = initialTop + dy;
        
        if (nextLeft > 0 && nextLeft < window.innerWidth - 60) {
            btn.style.left = nextLeft + 'px';
        }
        if (nextTop > 0 && nextTop < window.innerHeight - 60) {
            btn.style.top = nextTop + 'px';
        }
    }

    function dragEndBot(e) {
        if (!isDragging) return;
        isDragging = false;
        document.removeEventListener('mousemove', dragMoveBot);
        document.removeEventListener('mouseup', dragEndBot);
        
        const btn = document.getElementById('ai-chat-btn');
        if (btn) {
            btn.style.transition = '';
        }

        if (isClick) {
            toggleChat();
        }
    }

    // Initialize drag on load
    window.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('ai-chat-btn');
        if (btn) {
            btn.removeAttribute('onclick'); // remove inline onclick
            btn.addEventListener('mousedown', dragStartBot);
        }
    });

    window.generateContextualInsight = async function (context, contextId) {
        let msg = "";
        let elemId = "";
        let containerId = "";
        const student = window.students ? window.students.find(s => s.id == contextId) : null;
        
        if (context === 'schedule') {
            msg = `Analyze the schedule for student ${student ? student.name : 'Unknown'}. Check for time conflicts and suggest best practices for the coach. Keep it under 2 short sentences.`;
            elemId = 'sch-ai-insight-content';
            containerId = 'schedule-ai-insight';
        } else if (context === 'child_schedule') {
            msg = `Analyze the schedule for student ${student ? student.name : 'Unknown'} and provide a brief encouraging message for the parent about the upcoming class schedule. Keep it under 2 short sentences.`;
            elemId = 'child-schedule-ai-insight-text';
            containerId = 'child-schedule-ai-insight';
        } else if (context === 'child_overview') {
            msg = `Provide a very brief 1-sentence supportive progress insight for the parent of ${student ? student.name : 'Unknown'} based on their current level.`;
            elemId = 'child-overview-ai-insight-text';
            containerId = 'child-overview-ai-insight';
        }

        if (!msg) return;
        
        const textEl = document.getElementById(elemId);
        const containerEl = document.getElementById(containerId);
        
        if (containerEl) containerEl.style.display = 'block';
        if (textEl) textEl.innerHTML = '<span class="spinner" style="width:14px;height:14px;"></span> Generating AI Insight...';

        try {
            const callApi = (url, opts) => {
                if (typeof window.apiCall === 'function') return window.apiCall(url, opts);
                return fetch(url, opts);
            };

            const snapshot = window.getAcademySnapshot ? window.getAcademySnapshot() : null;

            const res = await callApi('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msg,
                    role: window.role || 'admin',
                    context: snapshot || { status: 'contextual_insight' },
                    systemPrompt: "You are TOM AI, the Chesskidoo Academy Advisor. Provide a very short, direct, and helpful insight based on the prompt. No pleasantries, just the insight."
                })
            });

            if (!res || !res.ok) throw new Error('AI request failed');
            const data = await res.json();
            
            if (textEl) textEl.innerHTML = data.message || 'Insight generated.';
        } catch (e) {
            console.warn('[AI Insight Failed]', e);
            if (textEl) textEl.innerHTML = 'AI analysis temporarily unavailable.';
        }
    };

})();
