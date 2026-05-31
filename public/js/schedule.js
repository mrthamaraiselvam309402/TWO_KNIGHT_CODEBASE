/**
 * Student Schedule Manager Module
 * Handles beautiful schedule cards, preview generation, HTML2Canvas rendering,
 * WhatsApp sharing, and contextual AI insights.
 */

(function () {
    let currentScheduleData = {};

    window.initSchedulePage = function () {
        populateStudentSelect();
        populateCoachSelect();
        // Clear inputs on page load
        resetScheduleInputs();
        generateSchedulePreview(); // Reset preview
    };

    function populateStudentSelect() {
        const sel = document.getElementById('sch-student-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Select Student --</option>';
        if (window.students && window.students.length) {
            window.students.forEach(s => {
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
        if (window.coaches && window.coaches.length) {
            window.coaches.forEach(c => {
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
        if(document.getElementById('sch-footnote')) document.getElementById('sch-footnote').value = 'Kindly ensure student joins on time for the demo session. Looking forward to a great learning journey ahead. – Chesskidoo Academy';
    }

    // This parses the embedded JSON [SCHEDULE:{...}] tag from the notes column
    window.extractScheduleJSON = function (notesString) {
        if (!notesString) return null;
        const match = notesString.match(/\[SCHEDULE:({.*?})\]/);
        if (match && match[1]) {
            try {
                return JSON.parse(match[1]);
            } catch (e) {
                console.error("Failed to parse schedule JSON", e);
                return null;
            }
        }
        return null;
    };

    window.removeScheduleJSON = function (notesString) {
        if (!notesString) return notesString;
        return notesString.replace(/\[SCHEDULE:({.*?})\]/g, '').trim();
    };

    window.loadStudentScheduleData = function (studentId) {
        resetScheduleInputs();
        if (!studentId) {
            generateSchedulePreview();
            return;
        }

        const student = window.students.find(s => s.id == studentId);
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

        generateSchedulePreview();

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
        generateSchedulePreview();
    };

    window.generateSchedulePreview = function () {
        const wrapper = document.getElementById('sch-card-preview-wrapper');
        const studentId = document.getElementById('sch-student-select') ? document.getElementById('sch-student-select').value : null;
        
        if (!studentId || !wrapper) {
            if(wrapper) {
                wrapper.innerHTML = `
                <div class="chesskidoo-schedule-card" style="text-align:center; padding:40px; color:var(--ivory-dim); border:4px dashed var(--border); background:rgba(0,0,0,0.15)">
                  <span style="font-size:40px; display:block; margin-bottom:12px;">♟️</span>
                  Select a student and click "Preview Card" to view the beautiful layout.
                </div>`;
            }
            return;
        }

        const student = window.students.find(s => s.id == studentId);
        const stName = student ? student.name : 'Student';
        
        const demoDate = document.getElementById('sch-demo-date').value || 'TBD';
        const demoTime = document.getElementById('sch-demo-time').value || 'TBD';
        const regDays = document.getElementById('sch-reg-days').value || 'TBD';
        const regTime = document.getElementById('sch-reg-time').value || 'TBD';
        const meetLink = document.getElementById('sch-meet-link') ? document.getElementById('sch-meet-link').value : '';
        const coachId = document.getElementById('sch-coach-select').value;
        let coachName = 'TBD';
        if (coachId && window.coaches) {
            const coach = window.coaches.find(c => c.id == coachId);
            if (coach) coachName = coach.name;
        }
        const footnote = document.getElementById('sch-footnote').value || '';

        // Generate Weekly Calendar View HTML
        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const activeDaysStr = regDays.toLowerCase();
        
        let weekGridHtml = '<div style="display:flex; gap:6px; margin-top:12px; margin-bottom:12px; justify-content:space-between;">';
        for (let i = 0; i < 7; i++) {
            const isActive = activeDaysStr.includes(daysOfWeek[i].toLowerCase()) || activeDaysStr.includes(shortDays[i].toLowerCase());
            if (isActive) {
                weekGridHtml += `<div style="flex:1; text-align:center; padding:8px 0; border-radius:8px; background:linear-gradient(135deg, var(--gold) 0%, #b8860b 100%); color:#000; font-weight:900; font-size:11px; box-shadow:0 2px 8px rgba(218,163,62,0.4); border:1px solid #ffdf00;">${shortDays[i][0]}</div>`;
            } else {
                weekGridHtml += `<div style="flex:1; text-align:center; padding:8px 0; border-radius:8px; background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.4); font-size:11px; border:1px solid rgba(255,255,255,0.05);">${shortDays[i][0]}</div>`;
            }
        }
        weekGridHtml += '</div>';

        // Build HTML for the card (high fidelity, responsive, uses variables from styles.css)
        wrapper.innerHTML = `
        <div id="sch-render-target" style="
            background: linear-gradient(145deg, #1f2937 0%, #111827 100%);
            border: 2px solid var(--gold);
            border-radius: 16px;
            padding: 30px;
            color: #fff;
            font-family: sans-serif;
            box-shadow: 0 15px 35px rgba(0,0,0,0.4);
            position: relative;
            overflow: hidden;
            width: 100%;
            box-sizing: border-box;
        ">
            <!-- Decorative background elements -->
            <div style="position:absolute; top:-20px; right:-20px; font-size:120px; opacity:0.03; pointer-events:none;">♟️</div>
            
            <div style="text-align:center; border-bottom:1px solid rgba(218, 163, 62, 0.3); padding-bottom:16px; margin-bottom:20px;">
                <h2 style="color:var(--gold); margin:0; font-family:var(--font-head); font-size:24px; text-transform:uppercase; letter-spacing:1px;">Chesskidoo Academy</h2>
                <div style="color:rgba(255,255,255,0.7); font-size:12px; letter-spacing:3px; margin-top:4px;">OFFICIAL SCHEDULE</div>
            </div>

            <div style="text-align:center; margin-bottom:24px;">
                <div style="font-size:14px; color:rgba(255,255,255,0.8);">Welcome to the academy,</div>
                <div style="font-size:28px; font-weight:bold; color:#fff; margin-top:4px;">${stName}</div>
            </div>

            <div style="background:rgba(218, 163, 62, 0.08); border:1px solid rgba(218, 163, 62, 0.2); border-radius:12px; padding:16px; margin-bottom:16px;">
                <div style="font-size:11px; text-transform:uppercase; color:var(--gold); font-weight:bold; letter-spacing:1px; margin-bottom:8px;">Demo Class</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:rgba(255,255,255,0.7); font-size:13px;">Date:</span>
                    <span style="font-weight:bold; font-size:13px;">${demoDate}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:rgba(255,255,255,0.7); font-size:13px;">Timing:</span>
                    <span style="font-weight:bold; font-size:13px;">${demoTime}</span>
                </div>
            </div>

            <div style="background:rgba(255, 255, 255, 0.03); border:1px solid rgba(255, 255, 255, 0.1); border-radius:12px; padding:16px; margin-bottom:20px;">
                <div style="font-size:11px; text-transform:uppercase; color:#bbb; font-weight:bold; letter-spacing:1px; margin-bottom:8px;">Regular Class (Weekly Calendar)</div>
                ${weekGridHtml}
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:rgba(255,255,255,0.7); font-size:13px;">Days:</span>
                    <span style="font-weight:bold; font-size:13px;">${regDays}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:rgba(255,255,255,0.7); font-size:13px;">Timing:</span>
                    <span style="font-weight:bold; font-size:13px;">${regTime}</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding-top:8px; margin-top:8px; border-top:1px dashed rgba(255,255,255,0.1);">
                    <span style="color:rgba(255,255,255,0.7); font-size:13px;">Coach:</span>
                    <span style="font-weight:bold; font-size:13px; color:var(--gold);">${coachName}</span>
                </div>
                ${meetLink ? `
                <div style="margin-top:16px; text-align:center;">
                    <a href="${meetLink}" target="_blank" style="display:inline-block; background:var(--gold); color:#000; padding:8px 20px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:13px; box-shadow:0 4px 10px rgba(218,163,62,0.3);">Join Class 🎥</a>
                </div>` : ''}
            </div>

            ${footnote ? `<div style="font-size:11px; color:rgba(255,255,255,0.6); text-align:center; font-style:italic; line-height:1.4;">"${footnote}"</div>` : ''}
        </div>
        `;
    };

    window.saveStudentSchedule = async function () {
        const studentId = document.getElementById('sch-student-select').value;
        if (!studentId) return window.toast('Please select a student', 'error');

        const schedData = {
            demoDate: document.getElementById('sch-demo-date').value,
            demoTime: document.getElementById('sch-demo-time').value,
            regDays: document.getElementById('sch-reg-days').value,
            regTime: document.getElementById('sch-reg-time').value,
            meetLink: document.getElementById('sch-meet-link') ? document.getElementById('sch-meet-link').value : '',
            coachId: document.getElementById('sch-coach-select').value,
            footnote: document.getElementById('sch-footnote').value
        };

        const student = window.students.find(s => s.id == studentId);
        if (!student) return;

        let notesWithoutSchedule = window.removeScheduleJSON(student.notes || '');
        const newNotes = notesWithoutSchedule + `\n[SCHEDULE:${JSON.stringify(schedData)}]`;

        window.toast('Saving schedule...', 'info');
        
        try {
            const res = await window.apiCall('/api/students', {
                method: 'POST', // or whatever your update endpoint takes, existing API logic in scripts.js handles UPSERT based on id
                body: JSON.stringify({
                    id: student.id,
                    notes: newNotes.trim()
                })
            });

            if(res.ok) {
                // Update local memory
                student.notes = newNotes.trim();
                window.toast('Schedule saved successfully!', 'success');
            } else {
                throw new Error('Server error');
            }
        } catch(e) {
            console.error(e);
            window.toast('Failed to save schedule.', 'error');
        }
    };

    window.downloadScheduleCardImage = function () {
        const target = document.getElementById('sch-render-target');
        if (!target) return window.toast('Please generate preview first', 'warning');
        const stName = document.getElementById('sch-student-select').options[document.getElementById('sch-student-select').selectedIndex].text.split('(')[0].trim() || 'Student';

        if (typeof html2canvas === 'undefined') {
            return window.toast('html2canvas library is not loaded', 'error');
        }

        window.toast('Generating image...', 'info');
        html2canvas(target, { backgroundColor: null, scale: 2 }).then(canvas => {
            const link = document.createElement('a');
            link.download = `Chesskidoo_Schedule_${stName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
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
        const student = window.students.find(s => s.id == studentId);
        if (!student) return;

        const demoDate = document.getElementById('sch-demo-date').value || 'TBD';
        const demoTime = document.getElementById('sch-demo-time').value || 'TBD';
        const regDays = document.getElementById('sch-reg-days').value || 'TBD';
        const regTime = document.getElementById('sch-reg-time').value || 'TBD';
        const meetLink = document.getElementById('sch-meet-link') ? document.getElementById('sch-meet-link').value : '';
        const coachId = document.getElementById('sch-coach-select').value;
        let coachName = 'TBD';
        if (coachId && window.coaches) {
            const coach = window.coaches.find(c => c.id == coachId);
            if (coach) coachName = coach.name;
        }
        const footnote = document.getElementById('sch-footnote').value || '';

        const stName = student.name;
        const phone = student.parent_phone || '';
        
        if (!phone) {
            return window.toast('Student does not have a parent phone number saved', 'error');
        }

        let msg = `Hello Sir/Madam, 👑\n\n`;
        msg += `We are happy to inform you that *${stName}* has been scheduled for a demo chess class.\n\n`;
        if (demoDate && demoDate !== 'TBD') msg += `📅 *Demo Date:* ${demoDate}\n`;
        msg += `⏰ *Demo Timing:* ${demoTime}\n\n`;
        msg += `♟️ *Regular Class Timing:* ${regTime}\n`;
        msg += `🗓️ *Days:* ${regDays}\n`;
        msg += `🎓 *Assigned Coach:* ${coachName}\n\n`;
        if (meetLink) msg += `🔗 *Join Class Link:* ${meetLink}\n\n`;
        if (footnote) msg += `${footnote}\n`;

        const waUrl = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
    };

    window.renderChildSchedule = function (student, coachName) {
        const wrapper = document.getElementById('child-schedule-card-container');
        if (!wrapper) return;

        if (!student.notes || !window.extractScheduleJSON(student.notes)) {
            wrapper.innerHTML = `
            <div class="card" style="padding:40px; text-align:center; color:var(--ivory-dim); width:100%;">
              <span style="font-size:36px; display:block; margin-bottom:12px;">📅</span>
              No active schedule found. Please contact the administrator.
            </div>`;
            return;
        }

        const schedData = window.extractScheduleJSON(student.notes);
        
        // Generate Weekly Calendar View HTML
        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const activeDaysStr = (schedData.regDays || 'TBD').toLowerCase();
        
        let weekGridHtml = '<div style="display:flex; gap:6px; margin-top:12px; margin-bottom:12px; justify-content:space-between;">';
        for (let i = 0; i < 7; i++) {
            const isActive = activeDaysStr.includes(daysOfWeek[i].toLowerCase()) || activeDaysStr.includes(shortDays[i].toLowerCase());
            if (isActive) {
                weekGridHtml += `<div style="flex:1; text-align:center; padding:8px 0; border-radius:8px; background:linear-gradient(135deg, var(--gold) 0%, #b8860b 100%); color:#000; font-weight:900; font-size:11px; box-shadow:0 2px 8px rgba(218,163,62,0.4); border:1px solid #ffdf00;">${shortDays[i][0]}</div>`;
            } else {
                weekGridHtml += `<div style="flex:1; text-align:center; padding:8px 0; border-radius:8px; background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.4); font-size:11px; border:1px solid rgba(255,255,255,0.05);">${shortDays[i][0]}</div>`;
            }
        }
        weekGridHtml += '</div>';

        wrapper.innerHTML = `
        <div style="
            background: linear-gradient(145deg, #1f2937 0%, #111827 100%);
            border: 2px solid var(--gold);
            border-radius: 16px;
            padding: 30px;
            color: #fff;
            font-family: sans-serif;
            box-shadow: 0 15px 35px rgba(0,0,0,0.4);
            position: relative;
            overflow: hidden;
            width: 100%;
            box-sizing: border-box;
        ">
            <div style="position:absolute; top:-20px; right:-20px; font-size:120px; opacity:0.03; pointer-events:none;">♟️</div>
            
            <div style="text-align:center; border-bottom:1px solid rgba(218, 163, 62, 0.3); padding-bottom:16px; margin-bottom:20px;">
                <h2 style="color:var(--gold); margin:0; font-family:var(--font-head); font-size:24px; text-transform:uppercase; letter-spacing:1px;">Chesskidoo Academy</h2>
                <div style="color:rgba(255,255,255,0.7); font-size:12px; letter-spacing:3px; margin-top:4px;">OFFICIAL SCHEDULE</div>
            </div>

            <div style="text-align:center; margin-bottom:24px;">
                <div style="font-size:14px; color:rgba(255,255,255,0.8);">Welcome to the academy,</div>
                <div style="font-size:28px; font-weight:bold; color:#fff; margin-top:4px;">${student.name}</div>
            </div>

            <div style="background:rgba(218, 163, 62, 0.08); border:1px solid rgba(218, 163, 62, 0.2); border-radius:12px; padding:16px; margin-bottom:16px;">
                <div style="font-size:11px; text-transform:uppercase; color:var(--gold); font-weight:bold; letter-spacing:1px; margin-bottom:8px;">Demo Class</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:rgba(255,255,255,0.7); font-size:13px;">Date:</span>
                    <span style="font-weight:bold; font-size:13px;">${schedData.demoDate || 'TBD'}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:rgba(255,255,255,0.7); font-size:13px;">Timing:</span>
                    <span style="font-weight:bold; font-size:13px;">${schedData.demoTime || 'TBD'}</span>
                </div>
            </div>

            <div style="background:rgba(255, 255, 255, 0.03); border:1px solid rgba(255, 255, 255, 0.1); border-radius:12px; padding:16px; margin-bottom:20px;">
                <div style="font-size:11px; text-transform:uppercase; color:#bbb; font-weight:bold; letter-spacing:1px; margin-bottom:8px;">Regular Class (Weekly Calendar)</div>
                ${weekGridHtml}
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:rgba(255,255,255,0.7); font-size:13px;">Days:</span>
                    <span style="font-weight:bold; font-size:13px;">${schedData.regDays || 'TBD'}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:rgba(255,255,255,0.7); font-size:13px;">Timing:</span>
                    <span style="font-weight:bold; font-size:13px;">${schedData.regTime || 'TBD'}</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding-top:8px; margin-top:8px; border-top:1px dashed rgba(255,255,255,0.1);">
                    <span style="color:rgba(255,255,255,0.7); font-size:13px;">Coach:</span>
                    <span style="font-weight:bold; font-size:13px; color:var(--gold);">${coachName}</span>
                </div>
                <div style="display:flex; gap:10px; margin-top:16px; justify-content:center;">
                    ${schedData.meetLink ? `<a href="${schedData.meetLink}" target="_blank" style="background:var(--gold); color:#000; padding:8px 16px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:12px; box-shadow:0 4px 10px rgba(218,163,62,0.3);">Join Class 🎥</a>` : ''}
                    <button onclick="window.syncClassCalendar('${student.id}')" style="background:transparent; border:1px solid rgba(255,255,255,0.3); color:#fff; padding:8px 16px; border-radius:6px; font-weight:bold; font-size:12px; cursor:pointer; transition:all 0.2s;">Add to Calendar 📅</button>
                </div>
            </div>
            
            ${schedData.footnote ? `<div style="font-size:11px; color:rgba(255,255,255,0.6); text-align:center; font-style:italic; line-height:1.4;">"${schedData.footnote}"</div>` : ''}
        </div>`;
        
        // Trigger AI Insight update for Parent Portal Schedule
        if(window.generateContextualInsight) {
            window.generateContextualInsight('child_schedule', student.id);
        }
    };

    window.syncClassCalendar = function(studentId) {
        const student = window.students.find(s => s.id == studentId);
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
PRODID:-//Chesskidoo Academy//Class Schedule//EN
BEGIN:VEVENT
UID:class-${student.id}@chesskidoo.com
DTSTAMP:${startStr}
DTSTART:${startStr}
SUMMARY:Chesskidoo Class
LOCATION:${schedData.meetLink ? schedData.meetLink : 'Online / Academy'}
DESCRIPTION:Regular chess class timing: ${schedData.regTime}. Coach: ${document.getElementById('sch-coach-select')?.options?.[document.getElementById('sch-coach-select')?.selectedIndex]?.text || 'Assigned'}
`;
        
        if (byDayStr) {
            icsContent += `RRULE:FREQ=WEEKLY;BYDAY=${byDayStr}\n`;
        }
        
        icsContent += `END:VEVENT\nEND:VCALENDAR`;

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Chesskidoo_Classes_${student.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (window.toast) window.toast('Class schedule calendar downloaded!', 'success');
    };

})();
