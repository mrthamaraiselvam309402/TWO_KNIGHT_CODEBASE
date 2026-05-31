(function () {
  'use strict';

  // ─── Operational & Strategy Quotes ─────────────────────────────
  const OPERATIONAL_QUOTES = [
    '"Every chess master was once a beginner." — Irving Chernev',
    '"Play the opening like a book, the middlegame like a magician, the endgame like a machine." — Rudolf Spielmann',
    '"Tactics is knowing what to do when there is something to do; strategy is knowing what to do when there is nothing to do." — Savielly Tartakower',
    '"The pawn is the most important instrument of the game." — Francois-Andre Danican Philidor',
    '"No price is too great for the scalp of enemy king." — Koblentz',
    '"Strategy requires thought, tactics requires observation." — Max Euwe',
    '"Chess is the struggle against the error." — Johannes Zukertort',
    '"Even the poorest plan is better than no plan at all." — Mikhail Chigorin'
  ];

  window.refreshMotivationQuote = function () {
    const el = document.getElementById('productivity-quote');
    if (el) {
      const idx = Math.floor(Math.random() * OPERATIONAL_QUOTES.length);
      el.textContent = OPERATIONAL_QUOTES[idx];
    }
  };

  // Utility to generate local unique IDs
  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // ─── Admin Checklist (Supabase Sync & Local Cache) ───────────────
  let adminTodos = [];
  
  function getAdminTodosFromLocal() {
    try {
      const saved = localStorage.getItem('chesskidoo_admin_todos');
      return saved ? JSON.parse(saved) : [
        { id: uuidv4(), text: 'Verify CGST/SGST inclusive invoicing for tax compliance', priority: 'high', completed: true },
        { id: uuidv4(), text: 'Perform AI Guardian FinOps cost spike review', priority: 'high', completed: false },
        { id: uuidv4(), text: 'Set up GMeet / Zoom demo class for new enrollments', priority: 'medium', completed: false },
        { id: uuidv4(), text: 'Reconcile slot-based monthly billing totals', priority: 'medium', completed: false },
        { id: uuidv4(), text: 'Update Wall of Fame with last tournament ratings', priority: 'low', completed: false }
      ];
    } catch (e) {
      return [];
    }
  }

  async function loadAdminTodos() {
    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('productivity_tasks')
          .select('*')
          .is('student_id', null)
          .order('created_at', { ascending: true });
        
        if (error) {
          if (error.code === '42P01') {
            console.warn('[Supabase] productivity_tasks table missing. Falling back to LocalStorage caching.');
          } else {
            console.error('[Supabase] Error loading admin tasks:', error);
          }
          adminTodos = getAdminTodosFromLocal();
        } else {
          adminTodos = data || [];
          localStorage.setItem('chesskidoo_admin_todos', JSON.stringify(adminTodos));
        }
      } catch (e) {
        console.warn('[Supabase] Failed to fetch admin tasks. Local fallback:', e);
        adminTodos = getAdminTodosFromLocal();
      }
    } else {
      adminTodos = getAdminTodosFromLocal();
    }
    renderAdminTodos();
    updateAdminProgress();
  }

  function saveAdminTodosLocalOnly() {
    localStorage.setItem('chesskidoo_admin_todos', JSON.stringify(adminTodos));
    updateAdminProgress();
  }

  function updateAdminProgress() {
    const total = adminTodos.length;
    const completed = adminTodos.filter(t => t.completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    const bar = document.getElementById('productivity-progress-bar');
    const text = document.getElementById('productivity-progress-text');
    if (bar) bar.style.width = percent + '%';
    if (text) text.textContent = percent + '%';
  }

  window.addAdminTodo = async function () {
    const input = document.getElementById('todo-input');
    const prioritySelect = document.getElementById('todo-priority');
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    const priority = prioritySelect ? prioritySelect.value : 'medium';
    const tempId = uuidv4();

    const todo = {
      id: tempId,
      student_id: null,
      text: text,
      priority: priority,
      completed: false
    };

    adminTodos.push(todo);
    saveAdminTodosLocalOnly();
    renderAdminTodos();
    input.value = '';

    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('productivity_tasks')
          .insert([{ text, priority, completed: false, student_id: null }])
          .select();
        
        if (!error && data && data.length > 0) {
          todo.id = data[0].id;
          saveAdminTodosLocalOnly();
        } else if (error && error.code !== '42P01') {
          console.error('[Supabase] Failed to insert task:', error);
        }
      } catch (e) {
        console.warn('[Supabase] Insert task failed. local cached:', e);
      }
    }
    if (window.toast) window.toast('Task added to checklist!', 'success');
  };

  window.toggleAdminTodo = async function (idx) {
    const todo = adminTodos[idx];
    if (todo) {
      todo.completed = !todo.completed;
      saveAdminTodosLocalOnly();
      renderAdminTodos();

      if (window.supabaseClient) {
        try {
          await window.supabaseClient
            .from('productivity_tasks')
            .update({ completed: todo.completed })
            .eq('id', todo.id);
        } catch (e) {
          console.warn('[Supabase] Toggle task sync error:', e);
        }
      }
    }
  };

  window.editAdminTodo = function (idx) {
    if (adminTodos[idx]) {
      adminTodos[idx].editing = true;
      renderAdminTodos();
    }
  };

  window.saveAdminTodoEdit = async function (idx, newText) {
    const todo = adminTodos[idx];
    if (todo && newText && newText.trim()) {
      todo.text = newText.trim();
      delete todo.editing;
      saveAdminTodosLocalOnly();
      renderAdminTodos();

      if (window.supabaseClient) {
        try {
          await window.supabaseClient
            .from('productivity_tasks')
            .update({ text: todo.text })
            .eq('id', todo.id);
        } catch (e) {
          console.warn('[Supabase] Edit task sync error:', e);
        }
      }
    }
  };

  window.cancelAdminTodoEdit = function (idx) {
    if (adminTodos[idx]) {
      delete adminTodos[idx].editing;
      renderAdminTodos();
    }
  };

  window.deleteAdminTodo = async function (idx) {
    const todo = adminTodos[idx];
    if (todo && confirm('Delete this task?')) {
      adminTodos.splice(idx, 1);
      saveAdminTodosLocalOnly();
      renderAdminTodos();

      if (window.supabaseClient) {
        try {
          await window.supabaseClient
            .from('productivity_tasks')
            .delete()
            .eq('id', todo.id);
        } catch (e) {
          console.warn('[Supabase] Delete task sync error:', e);
        }
      }
    }
  };

  function renderAdminTodos() {
    const container = document.getElementById('todo-list-container');
    if (!container) return;

    container.innerHTML = '';
    if (adminTodos.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--ivory-dim); font-size:12px;">✅ All tasks completed! Add some items to get started.</div>`;
      return;
    }

    adminTodos.forEach((todo, idx) => {
      let priorityBadge = '';
      if (todo.priority === 'high') priorityBadge = '<span style="color:#ef4444; font-size:10px; margin-right:6px;">🔴 High</span>';
      else if (todo.priority === 'low') priorityBadge = '<span style="color:#10b981; font-size:10px; margin-right:6px;">🟢 Low</span>';
      else priorityBadge = '<span style="color:#fbbf24; font-size:10px; margin-right:6px;">🟡 Med</span>';

      const card = document.createElement('div');
      card.style.cssText = `display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); border:1px solid var(--border); padding:10px 14px; border-radius:8px; gap:10px; transition: all 0.2s;`;
      if (todo.completed) card.style.opacity = '0.6';

      if (todo.editing) {
        card.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; flex:1;">
            <input type="text" id="edit-todo-input-${idx}" class="tom-input" value="${escapeHtml(todo.text)}" style="flex:1; font-size:12px; padding:6px 10px; border-radius:6px; background:var(--bg3); color:var(--ivory); border:1px solid var(--gold);" onkeydown="if(event.key==='Enter') saveAdminTodoEdit(${idx}, document.getElementById('edit-todo-input-${idx}').value)">
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-gold btn-sm" onclick="saveAdminTodoEdit(${idx}, document.getElementById('edit-todo-input-${idx}').value)" style="padding:4px 8px; font-size:11px;">Save</button>
            <button class="btn btn-outline btn-sm" onclick="cancelAdminTodoEdit(${idx})" style="padding:4px 8px; font-size:11px; color:var(--ivory-dim);">Cancel</button>
          </div>
        `;
      } else {
        card.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; flex:1;">
            <input type="checkbox" ${todo.completed ? 'checked' : ''} onchange="toggleAdminTodo(${idx})" style="width:16px; height:16px; accent-color:var(--gold); cursor:pointer;">
            <span style="font-size:12px; color:var(--ivory); ${todo.completed ? 'text-decoration:line-through; color:var(--ivory-dim);' : ''}">${escapeHtml(todo.text)}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            ${priorityBadge}
            <button class="btn btn-outline btn-sm" onclick="editAdminTodo(${idx})" style="padding:4px 6px; font-size:11px; border-color:transparent; color:var(--gold);" title="Edit Task">✏️</button>
            <button class="btn btn-outline btn-sm" onclick="deleteAdminTodo(${idx})" style="padding:4px 6px; font-size:11px; border-color:transparent; color:#ef4444;" title="Delete Task">🗑️</button>
          </div>
        `;
      }
      container.appendChild(card);
    });
  }

  // ─── Admin Notepad Logic ────────────────────────────────────────
  let adminNotesTimeout = null;
  window.saveProductivityNotes = function () {
    const el = document.getElementById('productivity-notepad');
    if (!el) return;

    const val = el.value;
    localStorage.setItem('chesskidoo_admin_notes', val);

    clearTimeout(adminNotesTimeout);
    adminNotesTimeout = setTimeout(async () => {
      if (window.supabaseClient) {
        try {
          await window.supabaseClient
            .from('productivity_notes')
            .upsert({ student_id: 'admin', notes: val }, { onConflict: 'student_id' });
        } catch (e) {
          console.warn('[Supabase] Notepad save error:', e);
        }
      }
    }, 1000);
  };

  async function loadProductivityNotes() {
    const el = document.getElementById('productivity-notepad');
    if (!el) return;

    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('productivity_notes')
          .select('notes')
          .eq('student_id', 'admin')
          .maybeSingle();

        if (!error && data) {
          el.value = data.notes;
          localStorage.setItem('chesskidoo_admin_notes', data.notes);
          return;
        }
      } catch (e) {
        console.warn('[Supabase] Notepad load error:', e);
      }
    }
    el.value = localStorage.getItem('chesskidoo_admin_notes') || '';
  }

  // ─── Meeting Scheduler & Attendees Selector ─────────────────────
  let scheduledMeetings = [];

  function getScheduledMeetingsFromLocal() {
    try {
      const saved = localStorage.getItem('chesskidoo_scheduled_meetings');
      return saved ? JSON.parse(saved) : [
        { id: uuidv4(), title: 'Intermediate Level Tactics Review', platform: 'gmeet', time: new Date(Date.now() + 86400000).toISOString().slice(0, 16), attendee: 'general', link: 'https://meet.google.com/abc-defg-hij' }
      ];
    } catch (e) {
      return [];
    }
  }

  async function loadScheduledMeetings() {
    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('scheduled_meetings')
          .select('*')
          .order('time', { ascending: true });

        if (error) {
          if (error.code === '42P01') {
            console.warn('[Supabase] scheduled_meetings table missing. Falling back to LocalStorage.');
          } else {
            console.error('[Supabase] Error loading meetings:', error);
          }
          scheduledMeetings = getScheduledMeetingsFromLocal();
        } else {
          scheduledMeetings = data || [];
          localStorage.setItem('chesskidoo_scheduled_meetings', JSON.stringify(scheduledMeetings));
        }
      } catch (e) {
        console.warn('[Supabase] Scheduled meetings fetch error. local fallback:', e);
        scheduledMeetings = getScheduledMeetingsFromLocal();
      }
    } else {
      scheduledMeetings = getScheduledMeetingsFromLocal();
    }
  }

  window.autoFillMeetLink = function (platform) {
    const linkInput = document.getElementById('meet-link');
    if (!linkInput) return;
    
    const randomCode = Math.random().toString(36).substring(2, 5) + '-' + Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 5);
    if (platform === 'gmeet') {
      linkInput.value = `https://meet.google.com/` + randomCode;
    } else {
      linkInput.value = `https://zoom.us/j/` + Math.floor(1000000000 + Math.random() * 9000000000);
    }
  };

  window.addScheduledMeeting = async function () {
    const titleInput = document.getElementById('meet-title');
    const platSelect = document.getElementById('meet-platform');
    const timeInput = document.getElementById('meet-time');
    const linkInput = document.getElementById('meet-link');
    const attendeeSelect = document.getElementById('meet-attendee');

    if (!titleInput || !titleInput.value.trim() || !timeInput || !timeInput.value) {
      if (window.toast) window.toast('Meeting title and date/time are required!', 'error');
      return;
    }

    const tempId = uuidv4();
    const meeting = {
      id: tempId,
      title: titleInput.value.trim(),
      platform: platSelect ? platSelect.value : 'gmeet',
      time: timeInput.value,
      link: linkInput ? linkInput.value.trim() || 'https://meet.google.com' : 'https://meet.google.com',
      attendee: attendeeSelect ? attendeeSelect.value : 'general'
    };

    scheduledMeetings.push(meeting);
    localStorage.setItem('chesskidoo_scheduled_meetings', JSON.stringify(scheduledMeetings));
    renderAdminMeetings();

    // Reset inputs
    titleInput.value = '';
    if (timeInput) timeInput.value = '';
    if (linkInput) linkInput.value = '';
    if (window.toast) window.toast('Coaching session scheduled successfully!', 'success');

    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('scheduled_meetings')
          .insert([{
            title: meeting.title,
            platform: meeting.platform,
            time: new Date(meeting.time).toISOString(),
            link: meeting.link,
            attendee: meeting.attendee
          }])
          .select();

        if (!error && data && data.length > 0) {
          meeting.id = data[0].id;
          localStorage.setItem('chesskidoo_scheduled_meetings', JSON.stringify(scheduledMeetings));
        }
      } catch (e) {
        console.warn('[Supabase] Meeting sync error:', e);
      }
    }
  };

  window.deleteScheduledMeeting = async function (idx) {
    const meet = scheduledMeetings[idx];
    if (meet && confirm('Delete this scheduled call?')) {
      scheduledMeetings.splice(idx, 1);
      localStorage.setItem('chesskidoo_scheduled_meetings', JSON.stringify(scheduledMeetings));
      renderAdminMeetings();

      if (window.supabaseClient) {
        try {
          await window.supabaseClient
            .from('scheduled_meetings')
            .delete()
            .eq('id', meet.id);
        } catch (e) {
          console.warn('[Supabase] Meeting delete sync error:', e);
        }
      }
    }
  };

  function populateAttendeeDropdown() {
    const select = document.getElementById('meet-attendee');
    if (!select) return;

    // Reset to default
    select.innerHTML = '<option value="general">General / Boardroom Meet</option>';

    // Load coaches
    const coaches = window.allCoaches || [];
    if (coaches.length > 0) {
      const optGroupCoaches = document.createElement('optgroup');
      optGroupCoaches.label = 'Coaches';
      coaches.forEach(c => {
        const opt = document.createElement('option');
        opt.value = `coach_${c.id}`;
        opt.textContent = `Coach: ${c.name || 'Unknown'}`;
        optGroupCoaches.appendChild(opt);
      });
      select.appendChild(optGroupCoaches);
    }

    // Load students
    const students = window.allStudents || [];
    if (students.length > 0) {
      const optGroupStudents = document.createElement('optgroup');
      optGroupStudents.label = 'Students';
      students.forEach(s => {
        const opt = document.createElement('option');
        opt.value = `student_${s.id}`;
        opt.textContent = `Student: ${s.name || s.first_name || 'Unknown'}`;
        optGroupStudents.appendChild(opt);
      });
      select.appendChild(optGroupStudents);
    }
  }

  function renderAdminMeetings() {
    const container = document.getElementById('meet-list-container');
    if (!container) return;

    container.innerHTML = '';
    if (scheduledMeetings.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:15px; color:var(--ivory-dim); font-size:11px;">No calls scheduled. Use the form above to add a Google Meet or Zoom class.</div>`;
      return;
    }

    scheduledMeetings.forEach((meet, idx) => {
      const platName = meet.platform === 'zoom' ? '📹 Zoom' : '🎬 Google Meet';
      const platColor = meet.platform === 'zoom' ? 'var(--blue)' : 'var(--emerald)';
      const callDate = new Date(meet.time);
      const displayTime = callDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' @ ' + callDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      // Find attendee label
      let attendeeLabel = 'General Room';
      if (meet.attendee && meet.attendee.startsWith('student_')) {
        const sid = meet.attendee.replace('student_', '');
        const s = (window.allStudents || []).find(st => String(st.id) === String(sid));
        if (s) attendeeLabel = `Student: ${s.name || s.first_name}`;
      } else if (meet.attendee && meet.attendee.startsWith('coach_')) {
        const cid = meet.attendee.replace('coach_', '');
        const c = (window.allCoaches || []).find(co => String(co.id) === String(cid));
        if (c) attendeeLabel = `Coach: ${c.name}`;
      }

      const card = document.createElement('div');
      card.style.cssText = `background:rgba(0,0,0,0.25); border:1px solid var(--border); padding:10px 12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; gap:10px;`;
      card.innerHTML = `
        <div style="flex:1;">
          <div style="font-size:12px; font-weight:700; color:var(--ivory); margin-bottom:2px;">${escapeHtml(meet.title)}</div>
          <div style="display:flex; align-items:center; gap:8px; font-size:11px; color:var(--ivory-dim);">
            <span style="color:${platColor}; font-weight:600;">${platName}</span>
            <span>•</span>
            <span>${displayTime}</span>
            <span>•</span>
            <span style="color:var(--gold); font-size:10px;">${escapeHtml(attendeeLabel)}</span>
          </div>
        </div>
        <div style="display:flex; gap:6px;">
          <a href="${escapeHtml(meet.link)}" target="_blank" class="btn btn-gold btn-sm" style="padding:4px 8px; font-size:11px;">Join</a>
          <button class="btn btn-danger btn-sm" onclick="deleteScheduledMeeting(${idx})" style="padding:4px 6px; font-size:11px;">🗑️</button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // ─── Child Workspace Tasks & Checklist (Persisted per Student) ───
  let childTodos = [];

  function getChildDefaultTodos() {
    return [
      { id: uuidv4(), text: '🧩 Solve 5 Tactical Chess Puzzles (Tactics Workout)', completed: false },
      { id: uuidv4(), text: '♟️ Play 1 Rapid (15m) game on chess.org', completed: false },
      { id: uuidv4(), text: '📖 Review last week\'s coach opening notes', completed: false },
      { id: uuidv4(), text: '🎥 Watch intermediate batch video recommendation', completed: false }
    ];
  }

  function getActiveStudentId() {
    return window.currentStudent ? String(window.currentStudent.id) : 'default';
  }

  function getChildTodosFromLocal() {
    try {
      const key = 'chesskidoo_child_todos_' + getActiveStudentId();
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : getChildDefaultTodos();
    } catch (e) {
      return getChildDefaultTodos();
    }
  }

  async function loadChildTodos() {
    const activeId = getActiveStudentId();
    if (activeId === 'default') {
      childTodos = [];
      renderChildTodos();
      updateChildProgress();
      return;
    }

    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('productivity_tasks')
          .select('*')
          .eq('student_id', activeId)
          .order('created_at', { ascending: true });

        if (error) {
          if (error.code !== '42P01') console.error('[Supabase] Error loading child tasks:', error);
          childTodos = getChildTodosFromLocal();
        } else {
          childTodos = data || [];
          localStorage.setItem('chesskidoo_child_todos_' + activeId, JSON.stringify(childTodos));
        }
      } catch (e) {
        console.warn('[Supabase] Child tasks fetch failed. local fallback:', e);
        childTodos = getChildTodosFromLocal();
      }
    } else {
      childTodos = getChildTodosFromLocal();
    }
    renderChildTodos();
    updateChildProgress();
  }

  function saveChildTodosLocalOnly() {
    const key = 'chesskidoo_child_todos_' + getActiveStudentId();
    localStorage.setItem(key, JSON.stringify(childTodos));
    updateChildProgress();
  }

  function updateChildProgress() {
    const total = childTodos.length;
    const completed = childTodos.filter(t => t.completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    const bar = document.getElementById('child-productivity-progress-bar');
    const text = document.getElementById('child-productivity-progress-text');
    if (bar) bar.style.width = percent + '%';
    if (text) text.textContent = percent + '%';
  }

  window.addChildTodo = async function () {
    const input = document.getElementById('child-todo-input');
    if (!input || !input.value.trim()) return;

    const activeId = getActiveStudentId();
    if (activeId === 'default') return;

    const text = input.value.trim();
    const tempId = uuidv4();
    const todo = {
      id: tempId,
      student_id: activeId,
      text: text,
      completed: false
    };

    childTodos.push(todo);
    saveChildTodosLocalOnly();
    renderChildTodos();
    input.value = '';

    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('productivity_tasks')
          .insert([{ student_id: activeId, text: text, completed: false }])
          .select();

        if (!error && data && data.length > 0) {
          todo.id = data[0].id;
          saveChildTodosLocalOnly();
        }
      } catch (e) {
        console.warn('[Supabase] Child task insert error:', e);
      }
    }
    if (window.toast) window.toast('Custom goal added!', 'success');
  };

  window.toggleChildTodo = async function (idx) {
    const todo = childTodos[idx];
    if (todo) {
      todo.completed = !todo.completed;
      saveChildTodosLocalOnly();
      renderChildTodos();

      if (window.supabaseClient) {
        try {
          await window.supabaseClient
            .from('productivity_tasks')
            .update({ completed: todo.completed })
            .eq('id', todo.id);
        } catch (e) {
          console.warn('[Supabase] Toggle child task error:', e);
        }
      }
    }
  };

  window.editChildTodo = function (idx) {
    if (childTodos[idx]) {
      childTodos[idx].editing = true;
      renderChildTodos();
    }
  };

  window.saveChildTodoEdit = async function (idx, newText) {
    const todo = childTodos[idx];
    if (todo && newText && newText.trim()) {
      todo.text = newText.trim();
      delete todo.editing;
      saveChildTodosLocalOnly();
      renderChildTodos();

      if (window.supabaseClient) {
        try {
          await window.supabaseClient
            .from('productivity_tasks')
            .update({ text: todo.text })
            .eq('id', todo.id);
        } catch (e) {
          console.warn('[Supabase] Edit child task error:', e);
        }
      }
    }
  };

  window.cancelChildTodoEdit = function (idx) {
    if (childTodos[idx]) {
      delete childTodos[idx].editing;
      renderChildTodos();
    }
  };

  window.deleteChildTodo = async function (idx) {
    const todo = childTodos[idx];
    if (todo && confirm('Delete this practice goal?')) {
      childTodos.splice(idx, 1);
      saveChildTodosLocalOnly();
      renderChildTodos();

      if (window.supabaseClient) {
        try {
          await window.supabaseClient
            .from('productivity_tasks')
            .delete()
            .eq('id', todo.id);
        } catch (e) {
          console.warn('[Supabase] Delete child task error:', e);
        }
      }
    }
  };

  window.resetChildTodoDefaults = async function () {
    if (confirm('Reset to default chess practice checklist? This will clear custom tasks.')) {
      const activeId = getActiveStudentId();
      if (activeId === 'default') return;

      // 1. Delete all existing tasks for this student in DB
      if (window.supabaseClient) {
        try {
          await window.supabaseClient
            .from('productivity_tasks')
            .delete()
            .eq('student_id', activeId);
        } catch (e) {
          console.warn('[Supabase] Failed to clear child tasks for reset:', e);
        }
      }

      // 2. Load defaults
      childTodos = getChildDefaultTodos();
      saveChildTodosLocalOnly();
      renderChildTodos();

      // 3. Batch write defaults to DB
      if (window.supabaseClient) {
        try {
          const insertPayload = childTodos.map(t => ({
            student_id: activeId,
            text: t.text,
            completed: false
          }));
          await window.supabaseClient
            .from('productivity_tasks')
            .insert(insertPayload);
          // Reload to get actual DB UUIDs
          await loadChildTodos();
        } catch (e) {
          console.warn('[Supabase] Failed to seed default tasks in DB:', e);
        }
      }
    }
  };

  function renderChildTodos() {
    const container = document.getElementById('child-todo-list-container');
    if (!container) return;

    container.innerHTML = '';
    if (childTodos.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:15px; color:var(--ivory-dim); font-size:12px;">No goals set. Add goals to track your child's practice checklist.</div>`;
      return;
    }

    childTodos.forEach((todo, idx) => {
      const card = document.createElement('div');
      card.style.cssText = `display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); border:1px solid var(--border); padding:8px 12px; border-radius:8px; gap:10px;`;
      if (todo.completed) card.style.opacity = '0.6';

      if (todo.editing) {
        card.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; flex:1;">
            <input type="text" id="child-edit-todo-input-${idx}" class="tom-input" value="${escapeHtml(todo.text)}" style="flex:1; font-size:12px; padding:6px 10px; border-radius:6px; background:var(--bg3); color:var(--ivory); border:1px solid var(--emerald);" onkeydown="if(event.key==='Enter') saveChildTodoEdit(${idx}, document.getElementById('child-edit-todo-input-${idx}').value)">
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-gold btn-sm" onclick="saveChildTodoEdit(${idx}, document.getElementById('child-edit-todo-input-${idx}').value)" style="padding:4px 8px; font-size:11px; background:var(--emerald); border-color:var(--emerald);">Save</button>
            <button class="btn btn-outline btn-sm" onclick="cancelChildTodoEdit(${idx})" style="padding:4px 8px; font-size:11px; color:var(--ivory-dim);">Cancel</button>
          </div>
        `;
      } else {
        card.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; flex:1;">
            <input type="checkbox" ${todo.completed ? 'checked' : ''} onchange="toggleChildTodo(${idx})" style="width:16px; height:16px; accent-color:var(--emerald); cursor:pointer;">
            <span style="font-size:12px; color:var(--ivory); ${todo.completed ? 'text-decoration:line-through; color:var(--ivory-dim);' : ''}">${escapeHtml(todo.text)}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-outline btn-sm" onclick="editChildTodo(${idx})" style="padding:4px 6px; font-size:11px; border-color:transparent; color:var(--gold);" title="Edit Task">✏️</button>
            <button class="btn btn-outline btn-sm" onclick="deleteChildTodo(${idx})" style="padding:4px 6px; font-size:11px; border-color:transparent; color:#ef4444;" title="Delete Task">🗑️</button>
          </div>
        `;
      }
      container.appendChild(card);
    });
  }

  // ─── Child Notepad ──────────────────────────────────────────────
  let childNotesTimeout = null;
  window.saveChildProductivityNotes = function () {
    const el = document.getElementById('child-productivity-notepad');
    if (!el) return;

    const activeId = getActiveStudentId();
    if (activeId === 'default') return;

    const val = el.value;
    const key = 'chesskidoo_child_notes_' + activeId;
    localStorage.setItem(key, val);

    clearTimeout(childNotesTimeout);
    childNotesTimeout = setTimeout(async () => {
      if (window.supabaseClient) {
        try {
          await window.supabaseClient
            .from('productivity_notes')
            .upsert({ student_id: activeId, notes: val }, { onConflict: 'student_id' });
        } catch (e) {
          console.warn('[Supabase] Child notes save error:', e);
        }
      }
    }, 1000);
  };

  async function loadChildProductivityNotes() {
    const el = document.getElementById('child-productivity-notepad');
    if (!el) return;

    const activeId = getActiveStudentId();
    if (activeId === 'default') {
      el.value = '';
      return;
    }

    if (window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('productivity_notes')
          .select('notes')
          .eq('student_id', activeId)
          .maybeSingle();

        if (!error && data) {
          el.value = data.notes;
          localStorage.setItem('chesskidoo_child_notes_' + activeId, data.notes);
          return;
        }
      } catch (e) {
        console.warn('[Supabase] Child notes load error:', e);
      }
    }
    const key = 'chesskidoo_child_notes_' + activeId;
    el.value = localStorage.getItem(key) || '';
  }

  // ─── Render Meetings Assigned to Child ──────────────────────────
  window.renderChildMeetings = function () {
    const container = document.getElementById('child-meet-list-container');
    if (!container) return;

    container.innerHTML = '';
    const activeId = getActiveStudentId();
    if (activeId === 'default') {
      container.innerHTML = `<div style="text-align:center; padding:10px; color:var(--ivory-dim); font-size:11px;">Awaiting parent login.</div>`;
      return;
    }

    // Filter meetings where attendee matches current child ID or general
    const filtered = scheduledMeetings.filter(meet => {
      if (meet.attendee === 'general') return true;
      if (meet.attendee === `student_${activeId}`) return true;
      return false;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:15px; color:var(--ivory-dim); font-size:11px;">No classes scheduled for your child. General meetings will show here.</div>`;
      return;
    }

    filtered.forEach(meet => {
      const platName = meet.platform === 'zoom' ? '📹 Zoom' : '🎬 Google Meet';
      const platColor = meet.platform === 'zoom' ? 'var(--blue)' : 'var(--emerald)';
      const callDate = new Date(meet.time);
      const displayTime = callDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' @ ' + callDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      const card = document.createElement('div');
      card.style.cssText = `background:rgba(0,0,0,0.25); border:1px solid var(--border); padding:8px 12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; gap:10px;`;
      card.innerHTML = `
        <div style="flex:1;">
          <div style="font-size:11px; font-weight:700; color:var(--ivory); margin-bottom:2px;">${escapeHtml(meet.title)}</div>
          <div style="display:flex; align-items:center; gap:6px; font-size:10px; color:var(--ivory-dim);">
            <span style="color:${platColor}; font-weight:600;">${platName}</span>
            <span>•</span>
            <span>${displayTime}</span>
          </div>
        </div>
        <a href="${escapeHtml(meet.link)}" target="_blank" class="btn btn-gold btn-sm" style="padding:4px 8px; font-size:10px;">Join Class</a>
      `;
      container.appendChild(card);
    });
  };

  // ─── Module Page Initializer ────────────────────────────────────
  window.initProductivityPage = async function () {
    window.refreshMotivationQuote();
    
    // Load lists & notepad notes in parallel
    await Promise.all([
      loadAdminTodos(),
      loadProductivityNotes(),
      loadScheduledMeetings()
    ]);
    
    populateAttendeeDropdown();
    renderAdminMeetings();
  };

  window.renderChildProductivity = async function () {
    await Promise.all([
      loadChildTodos(),
      loadChildProductivityNotes(),
      loadScheduledMeetings() // Ensure latest meeting list is loaded
    ]);
    window.renderChildMeetings();
  };

  // ─── Utilities ──────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

})();
