/**
 * Student Schedule Manager Module
 * Handles beautiful schedule cards, preview generation, HTML2Canvas rendering,
 * WhatsApp sharing, and contextual AI insights.
 */


(function () {
    let currentScheduleData = {};

    // Single source of truth for the schedule's coach name. Prefers the coach
    // chosen in the Schedule Manager (schedData.coachId / coachName), then the
    // student's globally-assigned coach, then 'TBD'. Used by the admin preview,
    // the parent schedule card, and the .ics calendar export so they always agree.
    function resolveScheduleCoachName(schedData, student) {
        const coaches = window.allCoaches || window.coaches || [];
        if (schedData && schedData.coachId) {
            const c = coaches.find(c => String(c.id) === String(schedData.coachId));
            if (c) return c.name;
        }
        if (schedData && schedData.coachName) return schedData.coachName;
        if (student && student.coach_id) {
            const c = coaches.find(c => String(c.id) === String(student.coach_id));
            if (c) return c.name;
        }
        return 'TBD';
    }
    window.resolveScheduleCoachName = resolveScheduleCoachName;

    window.initSchedulePage = function () {
        populateStudentSelect();
        populateCoachSelect();
        // Clear inputs on page load
        resetScheduleInputs();
        if (window.generateSchedulePreview) window.generateSchedulePreview(); // Reset preview
    };

    function populateStudentSelect() {
        const sel = document.getElementById('sch-student-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Select Student --</option>';
        const students = window.allStudents || window.students || [];
        if (students.length) {
            students.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.name + (s.parent_name ? ` (Parent: ${s.parent_name})` : '');
                sel.appendChild(opt);
            });
        }
    }

    function populateCoachSelect() {
        const sel = document.getElementById('sch-coach-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Select Coach --</option>';
        const coaches = window.allCoaches || window.coaches || [];
        if (coaches.length) {
            coaches.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                sel.appendChild(opt);
            });
        }
    }

    function resetScheduleInputs() {
        if(document.getElementById('sch-demo-date')) document.getElementById('sch-demo-date').value = '';
        if(document.getElementById('sch-demo-time')) document.getElementById('sch-demo-time').value = '';
        if(document.getElementById('sch-reg-days')) document.getElementById('sch-reg-days').value = '';
        if(document.getElementById('sch-reg-time')) document.getElementById('sch-reg-time').value = '';
        if(document.getElementById('sch-meet-link')) document.getElementById('sch-meet-link').value = '';
        if(document.getElementById('sch-coach-select')) document.getElementById('sch-coach-select').value = '';
        if(document.getElementById('sch-footnote')) document.getElementById('sch-footnote').value = 'Kindly ensure student joins on time for the demo session. Looking forward to a great learning journey ahead. – Two Knights Academy';
    }

    // UTF-8 safe base64 helpers. The server sanitizes the `notes` column and
    // strips quotes (" ' ` < > ;), which would corrupt a raw [SCHEDULE:{json}]
    // tag. So we persist the schedule as [SCHEDULE64:<base64>] — base64's
    // alphabet (A-Za-z0-9+/=) survives sanitization intact.
    function encodeSchedulePayload(obj) {
        try {
            return window.btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
        } catch (e) {
            return '';
        }
    }
    function decodeSchedulePayload(b64) {
        try {
            return JSON.parse(decodeURIComponent(escape(window.atob(b64))));
        } catch (e) {
            return null;
        }
    }

    // Parses the embedded schedule tag from the notes column. Supports the new
    // sanitization-safe [SCHEDULE64:...] format and the legacy [SCHEDULE:{...}].
    window.extractScheduleJSON = function (notesString, student = null) {
        if (!notesString) {
            // FALLBACK: Check student's days column first, then batch lookup
            if (student) {
                // First try: use student's days column
                if (student.days) {
                    const dayArray = String(student.days).split(',').map(d => d.trim()).filter(Boolean);
                    const timeVal = student.session_time || student.batch_time || 'TBD';
                    return {
                        regDays: dayArray.join(' & '),
                        regTime: timeVal,
                        regCoachName: student.coach_name || student.coaching_coach || 'TBD',
                        meetLink: student.notes ? student.notes.match(/https?:\/\/[^\s]+/)?.[0] || '' : '',
                        isMatrixOverride: false
                    };
                }
                // Second try: Look up student's live batch schedule dynamically
                if (student.id && window.allBatches) {
                    const myBatch = window.allBatches.find(b => {
                        const ids = Array.isArray(b.student_ids) ? b.student_ids.map(String) : [];
                        return ids.includes(String(student.id));
                    });
                    if (myBatch) {
                        const coaches = window.allCoaches || window.coaches || [];
                        const c = coaches.find(co => String(co.id) === String(myBatch.coach_id));
                        return {
                            regDays: myBatch.days || 'TBD',
                            regTime: myBatch.time_slot || 'TBD',
                            regCoachName: c ? c.name : 'TBD',
                            meetLink: myBatch.notes || '',
                            isMatrixOverride: false
                        };
                    }
                }
            }
            return null;
        }
        const m64 = notesString.match(/\[SCHEDULE64:([A-Za-z0-9+/=]+)\]/);
        if (m64 && m64[1]) {
            const decoded = decodeSchedulePayload(m64[1]);
            if (decoded) return decoded;
        }
        const match = notesString.match(/\[SCHEDULE:({.*?})\]/);
        if (match && match[1]) {
            try {
                return JSON.parse(match[1]);
            } catch (e) {
                console.warn("Failed to parse legacy schedule JSON", e);
                return null;
            }
        }
        return null;
    };

    window.removeScheduleJSON = function (notesString) {
        if (!notesString) return notesString;
        return notesString
            .replace(/\[SCHEDULE64:[A-Za-z0-9+/=]+\]/g, '')
            .replace(/\[SCHEDULE:({.*?})\]/g, '')
            .trim();
    };

    window.loadStudentScheduleData = function (studentId) {
        resetScheduleInputs();
        if (!studentId) {
            if (window.generateSchedulePreview) window.generateSchedulePreview();
            return;
        }

        const student = (window.allStudents || []).find(s => s.id == studentId);
        if (student && student.notes) {
            const schedData = window.extractScheduleJSON(student.notes);
            if (schedData) {
                if(document.getElementById('sch-demo-date')) document.getElementById('sch-demo-date').value = schedData.demoDate || '';
                if(document.getElementById('sch-demo-time')) document.getElementById('sch-demo-time').value = schedData.demoTime || '';
                if(document.getElementById('sch-reg-days')) document.getElementById('sch-reg-days').value = schedData.regDays || '';
                if(document.getElementById('sch-reg-time')) document.getElementById('sch-reg-time').value = schedData.regTime || '';
                if(document.getElementById('sch-meet-link')) document.getElementById('sch-meet-link').value = schedData.meetLink || '';
                if(document.getElementById('sch-coach-select')) document.getElementById('sch-coach-select').value = schedData.coachId || '';
                if(document.getElementById('sch-footnote')) document.getElementById('sch-footnote').value = schedData.footnote || '';
            }
        }

        if (window.generateSchedulePreview) window.generateSchedulePreview();

        // Call Contextual AI Insight for the Schedule block
        if(window.generateContextualInsight) {
            window.generateContextualInsight('schedule', studentId);
        }
    };

    window.toggleDayShortcut = function (day) {
        const input = document.getElementById('sch-reg-days');
        if (!input) return;
        let days = input.value.split('&').map(d => d.trim()).filter(Boolean);
        if (days.includes(day)) {
            days = days.filter(d => d !== day);
        } else {
            days.push(day);
        }
        input.value = days.join(' & ');
        
        // Update button active states
        const buttons = document.querySelectorAll('#sch-days-shortcuts .sch-day-btn');
        buttons.forEach(btn => {
            const btnDay = btn.dataset.day;
            if (days.includes(btnDay)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        if (window.generateSchedulePreview) window.generateSchedulePreview();
    };

    // Returns the base CSS color for a coach
    function getCoachColor(name) {
        const n = (name || '').toLowerCase();
        if (n.includes('rohith')) return '#3b5998';
        if (n.includes('ranjith')) return '#27ae60';
        if (n.includes('gyana')) return '#8e44ad';
        if (n.includes('arivu')) return '#d35400';
        if (n.includes('yogesh')) return '#2ecc71';
        if (n.includes('sudhin')) return '#f39c12';
        if (n.includes('vasanth')) return '#16a085';
        if (n.includes('vishnu')) return '#7f8c8d';
        return '#4f5d75'; // default
    }

    // Shared function to render the Schedule Card HTML using the Master Matrix theme
    function buildScheduleCardHtml(studentName, schedData, coachName, isChildView, studentId) {
        const demoDate = schedData.demoDate || 'TBD';
        const demoTime = schedData.demoTime || 'TBD';
        const regDays = schedData.regDays || 'TBD';
        const regTime = schedData.regTime || 'TBD';
        const meetLink = schedData.meetLink || '';
        const footnote = schedData.footnote || '';
        
        const coachColor = getCoachColor(coachName);

        // Generate Weekly Calendar View HTML matching the Master Matrix table header style
        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const activeDaysStr = regDays.toLowerCase();
        
        let weekGridHtml = '<div style="display:flex; gap:4px; margin-top:12px; margin-bottom:12px; justify-content:space-between; width:100%;">';
        const dayIcons = ['📅', '🥏', '🎯', '🎲', '🎉', '🎊', '⚽'];
        for (let i = 0; i < 7; i++) {
            const isActive = activeDaysStr.includes(daysOfWeek[i].toLowerCase()) || activeDaysStr.includes(shortDays[i].toLowerCase());
            if (isActive) {
                weekGridHtml += `<div title="${daysOfWeek[i]}" style="flex:1; text-align:center; padding:8px 4px; border-radius:4px; background:linear-gradient(135deg, ${coachColor}, ${coachColor}cc); color:#ffffff; font-weight:600; font-size:11px; border:1px solid ${coachColor}; text-transform:uppercase; box-shadow:0 2px 8px rgba(0,0,0,0.2);">${shortDays[i]}<span style="display:block; font-size:9px; opacity:0.9;">${dayIcons[i]}</span></div>`;
            } else {
                weekGridHtml += `<div title="${daysOfWeek[i]}" style="flex:1; text-align:center; padding:8px 4px; border-radius:4px; background-color:#1c2030; color:#a4b0cb; font-weight:600; font-size:11px; border:1px solid #2c3242; text-transform:uppercase; opacity:0.6;">${shortDays[i]}<span style="display:block; font-size:9px;">${dayIcons[i]}</span></div>`;
            }
        }
        weekGridHtml += '</div>';

        // Action Buttons
        let actionButtons = '';
        if (isChildView) {
            actionButtons = `
                <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; justify-content:center;">
                    ${meetLink ? `<a href="${meetLink}" target="_blank" style="background:${coachColor}; color:#ffffff; padding:10px 20px; border-radius:4px; text-decoration:none; font-weight:600; font-size:13px; box-shadow:0 4px 15px rgba(0,0,0,0.3); display:flex; align-items:center; gap:6px;">Join Class 🎥</a>` : ''}
                    <button onclick="window.syncClassCalendar('${studentId}')" style="background:#1c2030; border:1px solid #2c3242; color:#ffffff; padding:10px 20px; border-radius:4px; font-weight:600; font-size:13px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px;" onmouseover="this.style.background='#2c3242'" onmouseout="this.style.background='#1c2030'">Add to Calendar 📅</button>
                    ${(window.currentUser && window.currentUser.role === 'admin') ? `<button onclick="window.editStudentSchedule('${studentId}')" style="background:#4f5d75; border:1px solid rgba(255,255,255,0.2); color:#fff; padding:10px 20px; border-radius:4px; font-weight:600; font-size:13px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px;">Edit Schedule ✏️</button>` : ''}
                </div>`;
        }

        return `
        <div id="sch-render-target" style="
            background-color: #141722;
            border: 1px solid #2c3242;
            border-left: 4px solid ${coachColor};
            border-radius: 6px;
            padding: 24px;
            color: #ffffff;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6);
            position: relative;
            overflow: hidden;
            width: 100%;
            box-sizing: border-box;
        ">
            <!-- Header -->
            <div style="text-align:center; border-bottom:1px solid #2c3242; padding-bottom:12px; margin-bottom:20px;">
                <h2 style="color:#ffffff; margin:0; font-size:16px; font-weight:500; letter-spacing:0.5px;">Chess Academy &mdash; Official Schedule</h2>
                <div style="color:#8a90a6; font-size:11px; margin-top:2px;">Complete Unified Roster</div>
            </div>

            <!-- Student Name -->
            <div style="text-align:center; margin-bottom:24px;">
                <div style="font-size:12px; color:#8a90a6;">Welcome to the academy,</div>
                <div style="font-size:24px; font-weight:600; color:#ffffff; margin-top:4px;">${studentName}</div>
            </div>

            <!-- Demo Class Block -->
            <div style="background-color:#1a1e2e; border:1px solid #2c3242; border-radius:4px; padding:14px; margin-bottom:16px;">
                <div style="font-size:10px; text-transform:uppercase; color:#a4b0cb; font-weight:600; letter-spacing:0.5px; margin-bottom:8px;">Demo Class</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#8a90a6; font-size:12px;">Date:</span>
                    <span style="font-weight:600; font-size:12px;">${demoDate}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#8a90a6; font-size:12px;">Timing:</span>
                    <span style="font-weight:600; font-size:12px;">${demoTime}</span>
                </div>
            </div>

            <!-- Regular Class Block -->
            <div style="background-color:#1a1e2e; border:1px solid #2c3242; border-radius:4px; padding:16px; margin-bottom:16px;">
                <div style="font-size:10px; text-transform:uppercase; color:#a4b0cb; font-weight:600; letter-spacing:0.5px; margin-bottom:8px;">Regular Class (Weekly Calendar)</div>
                
                ${weekGridHtml}
                
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; padding-top:8px;">
                    <span style="color:#8a90a6; font-size:12px;">Days:</span>
                    <span style="font-weight:600; font-size:12px;">${regDays}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:#8a90a6; font-size:12px;">Timing:</span>
                    <span style="font-weight:600; font-size:12px;">${regTime}</span>
                </div>
                
                <div style="display:flex; justify-content:space-between; padding-top:12px; margin-top:4px; border-top:1px dashed #2c3242;">
                    <span style="color:#8a90a6; font-size:12px;">Coach:</span>
                    <span style="font-weight:bold; font-size:13px; color:${coachColor};">${coachName}</span>
                </div>

                ${!isChildView && meetLink ? `
                <div style="margin-top:16px; text-align:center;">
                    <a href="${meetLink}" target="_blank" style="display:inline-block; background:${coachColor}; color:#ffffff; padding:8px 20px; border-radius:4px; text-decoration:none; font-weight:600; font-size:12px;">Join Class 🎥</a>
                </div>` : ''}
            </div>

            ${actionButtons}

            ${footnote ? `<div style="font-size:10px; color:#4f5d75; text-align:center; font-style:italic; line-height:1.4; margin-top:16px;">"${footnote}"</div>` : ''}
        </div>
        `;
    }

    window.generateSchedulePreview = function () {
        const wrapper = document.getElementById('sch-card-preview-wrapper');
        const studentId = document.getElementById('sch-student-select') ? document.getElementById('sch-student-select').value : null;
        
        if (!studentId || !wrapper) {
            if(wrapper) {
                wrapper.innerHTML = `
                <div class="twoknights-schedule-card" style="text-align:center; padding:40px; color:var(--ivory-dim); border:4px dashed var(--border); background:rgba(0,0,0,0.15)">
                  <span style="font-size:40px; display:block; margin-bottom:12px;">♟️</span>
                  Select a student and click "Preview Card" to view the beautiful layout.
                </div>`;
            }
            return;
        }

        const student = (window.allStudents || []).find(s => s.id == studentId);
        const stName = student ? student.name : 'Student';
        
        const schedData = {
            demoDate: document.getElementById('sch-demo-date').value || 'TBD',
            demoTime: document.getElementById('sch-demo-time').value || 'TBD',
            regDays: document.getElementById('sch-reg-days').value || 'TBD',
            regTime: document.getElementById('sch-reg-time').value || 'TBD',
            meetLink: document.getElementById('sch-meet-link') ? document.getElementById('sch-meet-link').value : '',
            footnote: document.getElementById('sch-footnote').value || ''
        };
        
        // Update day button active states
        const buttons = document.querySelectorAll('#sch-days-shortcuts .sch-day-btn');
        const days = schedData.regDays.split('&').map(d => d.trim()).filter(Boolean);
        buttons.forEach(btn => {
            if (days.includes(btn.dataset.day)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        const coachId = document.getElementById('sch-coach-select').value;
        let coachName = 'TBD';
        if (coachId && (window.allCoaches || window.coaches)) {
            const coach = (window.allCoaches || window.coaches || []).find(c => c.id == coachId);
            if (coach) coachName = coach.name;
        }

        wrapper.innerHTML = buildScheduleCardHtml(stName, schedData, coachName, false, studentId);
    };

    // Reads the current schedule form into a schedData object (shared by the
    // single-student save and the group save).
    function buildScheduleDataFromForm() {
        const coachId = document.getElementById('sch-coach-select').value;
        const coachObj = (window.allCoaches || window.coaches || []).find(c => String(c.id) === String(coachId));
        return {
            demoDate: document.getElementById('sch-demo-date').value,
            demoTime: document.getElementById('sch-demo-time').value,
            regDays: document.getElementById('sch-reg-days').value,
            regTime: document.getElementById('sch-reg-time').value,
            meetLink: document.getElementById('sch-meet-link') ? document.getElementById('sch-meet-link').value : '',
            coachId: coachId,
            coachName: coachObj ? coachObj.name : '', // denormalized so the parent card is correct even if rosters change
            footnote: document.getElementById('sch-footnote').value
        };
    }

    // Persists a schedData payload onto one student's notes (PUT). Returns true on success.
    async function persistScheduleForStudent(student, schedData) {
        if (!student) return false;
        const notesWithoutSchedule = window.removeScheduleJSON(student.notes || '');
        const newNotes = (notesWithoutSchedule + ` [SCHEDULE64:${encodeSchedulePayload(schedData)}]`).trim();
        try {
            const res = await window.apiCall('/api/students?id=' + encodeURIComponent(student.id), {
                method: 'PUT',
                body: JSON.stringify({ notes: newNotes, learning_mode: student.learning_mode || 'online' })
            });
            if (res.ok) { student.notes = newNotes; return true; }
            return false;
        } catch (e) {
            console.error('[Schedule] save failed for', student.id, e);
            return false;
        }
    }
    window.persistScheduleForStudent = persistScheduleForStudent;
    window.encodeSchedulePayload = encodeSchedulePayload;

    window.saveStudentSchedule = async function () {
        const studentId = document.getElementById('sch-student-select').value;
        if (!studentId) return window.toast('Please select a student', 'error');
        const student = (window.allStudents || []).find(s => s.id == studentId);
        if (!student) return;

        window.toast('Saving schedule...', 'info');
        const ok = await persistScheduleForStudent(student, buildScheduleDataFromForm());
        window.toast(ok ? 'Schedule saved successfully!' : 'Failed to save schedule.', ok ? 'success' : 'error');
    };

    // ─── Group / Batch Class Scheduling ─────────────────────────────
    // Toggle the group panel and (re)build the multi-select student list.
    window.toggleScheduleGroup = function () {
        const panel = document.getElementById('sch-group-panel');
        if (!panel) return;
        if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
        const students = window.allStudents || [];
        const list = students
            .filter(s => (s.status || 'active').toLowerCase() !== 'archived')
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const listEl = document.getElementById('sch-group-list');
        if (listEl) {
            listEl.innerHTML = list.map(s =>
                `<label style="display:flex; align-items:center; gap:8px; padding:5px 6px; border-radius:6px; font-size:12px; color:var(--ivory); cursor:pointer;">
                   <input type="checkbox" class="sch-group-cb" value="${s.id}" style="accent-color:var(--gold);">
                   <span>${(window.escapeHtml ? window.escapeHtml(s.name) : s.name)}${s.session_mode ? ` <span style="color:var(--ivory-dim); font-size:10px;">(${s.session_mode})</span>` : ''}</span>
                 </label>`
            ).join('');
        }
        panel.style.display = 'block';
    };

    window.schGroupSelect = function (mode) {
        const cbs = document.querySelectorAll('.sch-group-cb');
        const students = window.allStudents || [];
        cbs.forEach(cb => {
            if (mode === 'all') cb.checked = true;
            else if (mode === 'none') cb.checked = false;
            else if (mode === 'group') {
                const s = students.find(x => String(x.id) === String(cb.value));
                cb.checked = !!(s && String(s.session_mode || s.batch_type || '').toLowerCase() === 'group');
            }
        });
    };

    window.saveScheduleToGroup = async function () {
        const ids = Array.from(document.querySelectorAll('.sch-group-cb:checked')).map(cb => cb.value);
        if (ids.length === 0) return window.toast('Select at least one student for the group.', 'error');
        const schedData = buildScheduleDataFromForm();
        window.toast(`Saving schedule to ${ids.length} students...`, 'info');
        let ok = 0;
        for (const id of ids) {
            const student = (window.allStudents || []).find(s => String(s.id) === String(id));
            if (await persistScheduleForStudent(student, schedData)) ok++;
        }
        window.toast(`Group schedule saved to ${ok}/${ids.length} students.`, ok === ids.length ? 'success' : 'warning');
    };

    window.downloadScheduleCardImage = function () {
        const target = document.getElementById('sch-render-target');
        if (!target) return window.toast('Please generate preview first', 'warning');
        const stName = document.getElementById('sch-student-select').options[document.getElementById('sch-student-select').selectedIndex].text.split('(')[0].trim() || 'Student';

        if (typeof html2canvas === 'undefined') {
            return window.toast('html2canvas library is not loaded', 'error');
        }

        window.toast('Generating image...', 'info');
        window.html2canvas(target, { backgroundColor: null, scale: 2 }).then(canvas => {
            const link = document.createElement('a');
            link.download = `twoknights_Schedule_${stName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            window.toast('Image downloaded!', 'success');
        }).catch(err => {
            console.error('Canvas error:', err);
            window.toast('Error creating image', 'error');
        });
    };

    window.shareScheduleViaWhatsApp = function () {
        const studentId = document.getElementById('sch-student-select').value;
        if (!studentId) return window.toast('Please select a student', 'error');
        const student = (window.allStudents || []).find(s => s.id == studentId);
        if (!student) return;

        const demoDate = document.getElementById('sch-demo-date').value || 'TBD';
        const demoTime = document.getElementById('sch-demo-time').value || 'TBD';
        const regDays = document.getElementById('sch-reg-days').value || 'TBD';
        const regTime = document.getElementById('sch-reg-time').value || 'TBD';
        const meetLink = document.getElementById('sch-meet-link') ? document.getElementById('sch-meet-link').value : '';
        const coachId = document.getElementById('sch-coach-select').value;
        let coachName = 'TBD';
        if (coachId && (window.allCoaches || window.coaches)) {
            const coach = (window.allCoaches || window.coaches || []).find(c => c.id == coachId);
            if (coach) coachName = coach.name;
        }
        const footnote = document.getElementById('sch-footnote').value || '';

        const stName = student.name;
        const phone = student.parent_phone || '';
        
        if (!phone) {
            return window.toast('Student does not have a parent phone number saved', 'error');
        }

        // Strip any internal learning-mode marker that may have leaked into the
        // stored name (e.g. "Prajesh --offline academy") for a clean parent message.
        const cleanName = (stName || 'Student').replace(/\s*-+\s*(offline|online)(\s+academy)?\s*$/i, '').trim() || stName;

        // NOTE: emojis are written as \u{...} escapes (pure ASCII in source) so
        // they can never be corrupted to "?" by file-encoding / build / transport.
        let msg = `\u{1F451} *Two Knights ACADEMY*\n_Official Class Schedule_\n\n`;            // 👑
        msg += `Hello Sir/Madam, \u{1F44B}\n\n`;                                              // 👋
        msg += `We are happy to inform you that *${cleanName}* has been scheduled for chess classes at our academy. \u{265F}\u{FE0F}\n\n`; // ♟️
        msg += `\u{1F4D6} *DEMO CLASS*\n`;                                                     // 📖
        if (demoDate && demoDate !== 'TBD') msg += `\u{1F4C5} Date: ${demoDate}\n`;            // 📅
        msg += `\u{23F0} Timing: ${demoTime}\n\n`;                                             // ⏰
        msg += `\u{1F5D3}\u{FE0F} *REGULAR CLASS*\n`;                                          // 🗓️
        msg += `\u{1F4C6} Days: ${regDays}\n`;                                                 // 📆
        msg += `\u{23F1}\u{FE0F} Timing: ${regTime}\n`;                                        // ⏱️
        msg += `\u{1F393} Coach: ${coachName}\n\n`;                                            // 🎓
        if (meetLink) msg += `\u{1F3A5} *Join Online Class:* ${meetLink}\n\n`;                 // 🎥
        if (footnote) msg += `\u{2728} _${footnote}_\n`;                                       // ✨

        const waUrl = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
    };

    window.renderChildSchedule = function (student, coachName) {
        const wrapper = document.getElementById('child-schedule-card-container');
        if (!wrapper) return;

        const schedData = window.extractScheduleJSON(student.notes, student);

        if (!schedData) {
            wrapper.innerHTML = `
            <div class="card" style="padding:40px; text-align:center; color:var(--ivory-dim); width:100%;">
              <span style="font-size:36px; display:block; margin-bottom:12px;">📅</span>
              No active schedule found. Please contact the administrator.
            </div>`;
            return;
        }

        // Resolve the coach actually chosen for this schedule (falls back to the
        // student's assigned coach / passed-in name).
        const resolvedCoachName = schedData.regCoachName || resolveScheduleCoachName(schedData, student) || coachName || 'TBD';

        wrapper.innerHTML = buildScheduleCardHtml(student.name, schedData, resolvedCoachName, true, student.id);
        
        // Trigger AI Insight update for Parent Portal Schedule
        if(window.generateContextualInsight) {
            window.generateContextualInsight('child_schedule', student.id);
        }
    };

    window.syncClassCalendar = function(studentId) {
        const student = (window.allStudents || []).find(s => s.id == studentId);
        if (!student || !student.notes) return;
        const schedData = window.extractScheduleJSON(student.notes);
        if (!schedData) return;

        // Parse days
        const daysMap = {
            'monday': 'MO', 'tuesday': 'TU', 'wednesday': 'WE',
            'thursday': 'TH', 'friday': 'FR', 'saturday': 'SA', 'sunday': 'SU'
        };
        const days = (schedData.regDays || '').toLowerCase().replace(/&/g, ',').split(',').map(d => d.trim());
        const byDayStr = days.map(d => daysMap[d]).filter(Boolean).join(',');

        // Current time block (Mock default to current date next occurrence for demo purposes)
        const d = new Date();
        const startStr = d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        let icsContent = 
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Two Knights Academy//Class Schedule//EN
BEGIN:VEVENT
UID:class-${student.id}@Two Knights.com
DTSTAMP:${startStr}
DTSTART:${startStr}
SUMMARY:Two Knights Class
LOCATION:${schedData.meetLink ? schedData.meetLink : 'Online / Academy'}
DESCRIPTION:Regular chess class timing: ${schedData.regTime || 'TBD'}. Coach: ${resolveScheduleCoachName(schedData, student)}
`;
        
        if (byDayStr) {
            icsContent += `RRULE:FREQ=WEEKLY;BYDAY=${byDayStr}\n`;
        }
        
        icsContent += `END:VEVENT\nEND:VCALENDAR`;

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `twoknights_Classes_${student.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (window.toast) window.toast('Class schedule calendar downloaded!', 'success');
    };

    window.editStudentSchedule = function (studentId) {
        if (!window.currentUser || window.currentUser.role !== 'admin') return;
        
        // Find the student
        const student = window.allStudents.find(s => String(s.id) === String(studentId));
        if (!student) return;

        // Open the Schedule Manager tab
        if (window.setPage) window.setPage('schedule');

        // Allow DOM to render page
        setTimeout(() => {
            const studentSelect = document.getElementById("sch-student");
            if (studentSelect) {
                studentSelect.value = studentId;
                studentSelect.dispatchEvent(new window.Event('change')); // Trigger logic to load their existing schedule
            }
        }, 100);
    };

})();
