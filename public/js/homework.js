(function () {
  const $ = (id) => document.getElementById(id);
  let homeworkSelectedIds = new Set();
  let homeworkCalendarMonth = new Date();

  function studentName(student) {
    return window.getStudentName ? window.getStudentName(student) : (student && (student.name || student.full_name || student.id)) || 'Student';
  }

  function batchName(batch) {
    return (batch && (batch.name || batch.id)) || 'Batch';
  }

  function escapeValue(value) {
    return window.escapeHtml ? window.escapeHtml(value) : String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function getRole() {
    try {
      const auth = JSON.parse(localStorage.getItem('twoknights_auth') || '{}');
      return (auth.role || '').toLowerCase();
    } catch {
      return '';
    }
  }

  function isAdminUser() {
    const role = getRole();
    return role === 'admin' || role === 'master';
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  function parseDateKey(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function getBatchStudentIds(batch, students = []) {
    const ids = new Set();
    (batch && Array.isArray(batch.student_ids) ? batch.student_ids : []).forEach((id) => ids.add(String(id)));
    students.forEach((student) => {
      if (student && String(student.batch_id) === String(batch && batch.id)) ids.add(String(student.id));
    });
    return Array.from(ids);
  }

  function assignmentAppliesToStudent(assignment, studentId, students = []) {
    if (!assignment || !studentId) return false;
    const sid = String(studentId);
    if (assignment.target_type === 'all') return true;
    if (assignment.target_type === 'student') return String(assignment.student_id) === sid;
    if (assignment.target_type === 'batch') {
      const student = students.find((item) => String(item.id) === sid);
      if (student && String(student.batch_id) === String(assignment.batch_id)) return true;
      const batch = (assignment && assignment._batch) || null;
      return batch ? getBatchStudentIds(batch, students).includes(sid) : false;
    }
    return false;
  }

  function assignmentAppliesToBatch(assignment, batchId, students = [], batches = []) {
    if (!assignment || !batchId) return false;
    const bid = String(batchId);
    if (assignment.target_type === 'all') return true;
    if (assignment.target_type === 'batch') return String(assignment.batch_id) === bid;
    if (assignment.target_type === 'student') {
      const direct = students.some((student) => String(student.id) === String(assignment.student_id) && String(student.batch_id) === bid);
      if (direct) return true;
      return batches.some((batch) => String(batch.id) === bid && getBatchStudentIds(batch, students).includes(String(assignment.student_id)));
    }
    return false;
  }

  function formatDate(value) {
    if (!value) return 'No due date';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return escapeValue(value);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function sortHomework(items) {
    return [...(items || [])].sort((a, b) => {
      const aDue = a.due_date || '9999-12-31';
      const bDue = b.due_date || '9999-12-31';
      if (aDue !== bDue) return aDue.localeCompare(bDue);
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }

  function statusBadge(status) {
    const normalized = (status || 'active').toLowerCase();
    const style = normalized === 'completed' ? 'badge-success' : normalized === 'archived' ? 'badge-outline' : 'badge-level';
    return `<span class="badge ${style}">${escapeValue(status || 'Active')}</span>`;
  }

  function submissionStatusBadge(status) {
    const normalized = (status || 'not_submitted').toLowerCase();
    const style = normalized === 'approved' ? 'badge-success' : normalized === 'needs_revision' ? 'badge-danger' : normalized === 'closed' ? 'badge-outline' : 'badge-level';
    const label = normalized === 'not_submitted' ? 'Not submitted' : normalized;
    return `<span class="badge ${style}">${escapeValue(label)}</span>`;
  }

  function submissionActionLabel(status) {
    const normalized = (status || 'not_submitted').toLowerCase();
    if (normalized === 'approved') return 'Approved';
    if (normalized === 'closed') return 'Closed';
    if (normalized === 'needs_revision') return 'Resubmit';
    return 'Submit';
  }

  function assigneeKey(assignment) {
    if (assignment.target_type === 'student') return `student:${assignment.student_id}`;
    if (assignment.target_type === 'batch') return `batch:${assignment.batch_id}`;
    return 'all:all';
  }

  function assigneeLabel(assignment) {
    if (assignment.target_type === 'student') return assignment.student_name || assignment.recipient_label || 'Student';
    if (assignment.target_type === 'batch') return assignment.batch_name || assignment.recipient_label || 'Batch';
    return 'All Students';
  }

  function getFilteredHomework() {
    const month = $('homework-month-filter') ? $('homework-month-filter').value : monthKey(homeworkCalendarMonth);
    const assignee = $('homework-assignee-filter') ? $('homework-assignee-filter').value : '';
    const status = $('homework-status-filter') ? $('homework-status-filter').value : '';
    const [year, monthNumber] = (month || monthKey(homeworkCalendarMonth)).split('-').map(Number);

    return sortHomework((window.allHomework || []).filter((assignment) => {
      if (status && assignment.status !== status) return false;
      if (assignee && assigneeKey(assignment) !== assignee) return false;
      if (!month) return true;
      if (!assignment.due_date) return false;
      const date = parseDateKey(assignment.due_date);
      return !!date && date.getFullYear() === year && date.getMonth() === monthNumber - 1;
    }));
  }

let homeworkSubmissionCache = [];
  window.homeworkSubmissionCache = homeworkSubmissionCache;  // Expose globally for coach dashboard
  async function loadHomeworkSubmissions(forceRefresh = false) {
     if (!forceRefresh && homeworkSubmissionCache.length) return homeworkSubmissionCache;
     try {
       const res = await window.apiCall('/api/homework?view=submissions');
       if (!res.ok) throw new Error(await res.text().catch(() => ''));
       const data = await res.json().catch(() => ({}));
       homeworkSubmissionCache = data.data || [];
       window.homeworkSubmissionCache = homeworkSubmissionCache;  // Update global reference
       renderHomeworkSubmissionReview();
       return homeworkSubmissionCache;
    } catch (error) {
      if (window.toast) window.toast(`Failed to load homework submissions: ${error.message}`, 'error');
      return [];
    }
  }

  function populateHomeworkSelectors() {
    const targetSelect = $('hw-target-type');
    const studentSelect = $('hw-student-select');
    const batchSelect = $('hw-batch-select');
    const assigneeSelect = $('homework-assignee-filter');

    if (targetSelect && !targetSelect.options.length) {
      targetSelect.innerHTML = `
        <option value="student">Individual Student</option>
        <option value="batch">Batch</option>
        <option value="all">All Active Students</option>
      `;
    }

    if (studentSelect) {
      const studs = window.role === 'coach' 
        ? (window.allStudents || []).filter(s => String(s.coach_id) === String(window.userId))
        : (window.allStudents || []);
      const options = '<option value="">Select Student</option>' + studs
        .filter((student) => (student.status || 'active') !== 'archived')
        .sort((a, b) => studentName(a).localeCompare(studentName(b)))
        .map((student) => `<option value="${student.id}">${escapeValue(studentName(student))}</option>`)
        .join('');
      studentSelect.innerHTML = options;
      const progressStudentSelect = $('hw-progress-student');
      if (progressStudentSelect) {
        progressStudentSelect.innerHTML = options;
      }
    }

    if (batchSelect) {
      const batches = window.role === 'coach' 
        ? (window.allBatches || []).filter(b => String(b.coach_id) === String(window.userId))
        : (window.allBatches || []);
      batchSelect.innerHTML = '<option value="">Select Batch</option>' + batches
        .filter((batch) => (batch.status || 'active') !== 'archived')
        .sort((a, b) => batchName(a).localeCompare(batchName(b)))
        .map((batch) => `<option value="${batch.id}">${escapeValue(batchName(batch))}</option>`)
        .join('');
    }

    if (assigneeSelect) {
      const current = assigneeSelect.value;
      const options = new Map([
        ['', 'All Assignees'],
        ['all:all', 'All Students']
      ]);
      (window.allStudents || []).filter((student) => (student.status || 'active') !== 'archived').forEach((student) => options.set(`student:${student.id}`, studentName(student)));
      (window.allBatches || []).filter((batch) => (batch.status || 'active') !== 'archived').forEach((batch) => options.set(`batch:${batch.id}`, batchName(batch)));
      (window.allHomework || []).forEach((assignment) => {
        const key = assigneeKey(assignment);
        if (!options.has(key)) options.set(key, assigneeLabel(assignment));
      });
      assigneeSelect.innerHTML = Array.from(options.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => `<option value="${escapeValue(value)}">${escapeValue(label)}</option>`)
        .join('');
      if (Array.from(options.keys()).includes(current)) assigneeSelect.value = current;
    }
  }

  function updateHomeworkTargetFields() {
    const targetType = $('hw-target-type') ? $('hw-target-type').value : 'student';
    if ($('hw-student-field')) $('hw-student-field').style.display = targetType === 'student' ? '' : 'none';
    if ($('hw-batch-field')) $('hw-batch-field').style.display = targetType === 'batch' ? '' : 'none';
  }

  function openHomeworkAssignmentModal(targetType = 'student', targetId = '') {
    populateHomeworkSelectors();
    if ($('hw-target-type')) $('hw-target-type').value = targetType || 'student';
    updateHomeworkTargetFields();
    if ($('hw-student-select')) $('hw-student-select').value = targetType === 'student' ? targetId || '' : '';
    if ($('hw-batch-select')) $('hw-batch-select').value = targetType === 'batch' ? targetId || '' : '';
    if ($('hw-title')) $('hw-title').value = '';
    if ($('hw-description')) $('hw-description').value = '';
    if ($('hw-due-date')) $('hw-due-date').value = '';
    if ($('hw-file-input')) $('hw-file-input').value = '';
    if ($('hw-file-preview')) $('hw-file-preview').innerHTML = '';
    window.openModal && window.openModal('homework-assignment-modal');
  }

async function uploadHomeworkFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result.split(',')[1];
          const res = await window.apiCall('/api/upload', {
            method: 'POST',
            body: JSON.stringify({ 
              image: base64,
              filename: file?.name || `file.${file?.type?.split('/')[1] || 'bin'}`
            })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Upload failed (${res.status})`);
          }
          const data = await res.json();
          resolve(data?.data?.url || data?.url || null);
        } catch (e) { reject(e); }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsDataURL(file);
    });
  }

  async function saveHomeworkAssignment() {
    const targetType = $('hw-target-type') ? $('hw-target-type').value : 'student';
    const title = $('hw-title') ? $('hw-title').value.trim() : '';
    const description = $('hw-description') ? $('hw-description').value.trim() : '';
    const dueDate = $('hw-due-date') ? $('hw-due-date').value : '';
    const studentId = $('hw-student-select') ? $('hw-student-select').value : '';
    const batchId = $('hw-batch-select') ? $('hw-batch-select').value : '';
    const fileInput = $('hw-file-input');

    if (!title) return window.toast ? window.toast('Homework title is required', 'error') : null;
    if (targetType === 'student' && !studentId) return window.toast ? window.toast('Select a student', 'error') : null;
    if (targetType === 'batch' && !batchId) return window.toast ? window.toast('Select a batch', 'error') : null;

    let attachmentUrls = [];
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      try {
        const uploadPromises = Array.from(fileInput.files).map(f => uploadHomeworkFile(f));
        const uploaded = await Promise.all(uploadPromises);
        attachmentUrls = uploaded.filter(url => url !== null);
        if (attachmentUrls.length === 0) {
          return window.toast ? window.toast('File upload failed - please try again', 'error') : null;
        }
      } catch (e) {
        return window.toast ? window.toast(`File upload failed: ${e.message}`, 'error') : null;
      }
    }

    const payload = {
      target_type: targetType,
      title,
      description,
      due_date: dueDate || null,
      student_id: targetType === 'student' ? studentId : null,
      batch_id: targetType === 'batch' ? batchId : null,
      attachment_urls: attachmentUrls.length > 0 ? attachmentUrls : null
    };

    try {
      const res = await window.apiCall('/api/homework', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      if (window.toast) window.toast('Homework assigned successfully', 'success');
      window.closeModals && window.closeModals();
      if (window.loadHomeworkData) await window.loadHomeworkData(true);
      else if (window.loadAllData) await window.loadAllData(true);
      refreshHomeworkViews();
    } catch (error) {
      if (window.toast) window.toast(`Failed to assign homework: ${error.message}`, 'error');
    }
  }

  async function updateHomeworkStatus(id, status) {
    try {
      const res = await window.apiCall(`/api/homework?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      if (window.toast) window.toast(`Homework marked as ${status}`, 'success');
      if (window.loadHomeworkData) await window.loadHomeworkData(true);
      else if (window.loadAllData) await window.loadAllData(true);
      refreshHomeworkViews();
    } catch (error) {
      if (window.toast) window.toast(`Failed to update homework: ${error.message}`, 'error');
    }
  }

  function refreshHomeworkViews() {
    if (window.renderHomeworkPage) window.renderHomeworkPage();
    if (window.renderChildHomework) window.renderChildHomework();
  }

  async function applyBulkHomeworkStatus() {
    if (!isAdminUser()) return window.toast ? window.toast('Only administrators can bulk edit homework.', 'error') : null;
    const ids = Array.from(homeworkSelectedIds);
    const status = $('homework-bulk-status') ? $('homework-bulk-status').value : 'active';
    if (!ids.length) return window.toast ? window.toast('Select at least one homework assignment.', 'error') : null;

    try {
      const res = await window.apiCall('/api/homework', {
        method: 'PATCH',
        body: JSON.stringify({ ids, status })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      if (window.toast) window.toast(`Updated ${ids.length} homework assignments`, 'success');
      homeworkSelectedIds.clear();
      if (window.loadHomeworkData) await window.loadHomeworkData(true);
      else if (window.loadAllData) await window.loadAllData(true);
      refreshHomeworkViews();
    } catch (error) {
      if (window.toast) window.toast(`Bulk update failed: ${error.message}`, 'error');
    }
  }

  async function deleteHomeworkAssignment(id) {
    if (!isAdminUser()) return window.toast ? window.toast('Only administrators can delete homework.', 'error') : null;
    if (!window.confirm('Delete this homework assignment? This cannot be undone.')) return;
    try {
      const res = await window.apiCall(`/api/homework?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      if (window.toast) window.toast('Homework deleted', 'success');
      homeworkSelectedIds.delete(id);
      if (window.loadHomeworkData) await window.loadHomeworkData(true);
      else if (window.loadAllData) await window.loadAllData(true);
      refreshHomeworkViews();
    } catch (error) {
      if (window.toast) window.toast(`Failed to delete homework: ${error.message}`, 'error');
    }
  }

  async function submitHomeworkForChild(assignmentId) {
    const assignment = (window.allHomework || []).find((item) => String(item.id) === String(assignmentId));
    if (!assignment) return window.toast ? window.toast('Homework assignment not found.', 'error') : null;
    const text = $(`homework-submission-text-${assignment.id}`)?.value.trim() || '';
    const url = $(`homework-submission-url-${assignment.id}`)?.value.trim() || '';
    const fileInput = $(`homework-submission-files-${assignment.id}`);

    if (!text && !url && (!fileInput || !fileInput.files || fileInput.files.length === 0)) {
      return window.toast ? window.toast('Add homework text, a submission link, or upload files.', 'error') : null;
    }

    let uploadedUrls = [];
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      try {
        const uploadPromises = Array.from(fileInput.files).map(f => uploadHomeworkFile(f));
        const uploaded = await Promise.all(uploadPromises);
        uploadedUrls = uploaded.filter(url => url !== null);
        if (uploadedUrls.length === 0) {
          return window.toast ? window.toast('File upload failed - please try again', 'error') : null;
        }
      } catch (e) {
        return window.toast ? window.toast(`File upload failed: ${e.message}`, 'error') : null;
      }
    }

    try {
      const res = await window.apiCall('/api/homework?action=submit', {
        method: 'POST',
        body: JSON.stringify({
          assignment_id: assignment.id,
          submission_text: text,
          submission_url: url,
          file_urls: uploadedUrls.length > 0 ? uploadedUrls : null
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      if (window.toast) window.toast('Homework submitted', 'success');
      if ($(`homework-submission-files-${assignment.id}`)) $(`homework-submission-files-${assignment.id}`).value = '';
      if (window.loadHomeworkData) await window.loadHomeworkData(true);
      else if (window.loadAllData) await window.loadAllData(true);
      refreshHomeworkViews();
    } catch (error) {
      if (window.toast) window.toast(`Failed to submit homework: ${error.message}`, 'error');
    }
  }

  async function reviewHomeworkSubmission(submissionId, status) {
    const feedback = $(`homework-feedback-${submissionId}`)?.value.trim() || '';
    const score = $(`homework-score-${submissionId}`)?.value.trim();
    try {
      const res = await window.apiCall(`/api/homework?action=review&id=${encodeURIComponent(submissionId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, feedback, score })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      if (window.toast) window.toast(`Submission marked as ${status}`, 'success');
      await loadHomeworkSubmissions(true);
      if (window.loadHomeworkData) await window.loadHomeworkData(true);
      refreshHomeworkViews();
    } catch (error) {
      if (window.toast) window.toast(`Failed to review homework: ${error.message}`, 'error');
    }
  }

  function renderChildSubmissionPanel(assignment) {
    const submission = assignment.student_submission || null;
    const status = submission?.status || 'not_submitted';
    const feedback = submission?.feedback || '';
    const score = submission?.score !== null && submission?.score !== undefined ? ` · <strong>Score:</strong> ${escapeValue(submission.score)}` : '';
    const canSubmit = !isAdminUser() && ['active', 'completed'].includes(assignment.status) && !['approved', 'closed'].includes(status);
    const currentText = submission?.submission_text || '';
    const currentUrl = submission?.submission_url || '';
    const fileUrls = submission?.file_urls || [];

    const filesHtml = Array.isArray(fileUrls) && fileUrls.length > 0 
      ? `<div style="margin-top:6px;font-size:12px;color:var(--gold);">
          <strong>Attachments:</strong><br>
          ${fileUrls.map((url, i) => `<a href="${escapeValue(url)}" target="_blank" rel="noopener" style="display:block;margin-top:4px;">📎 File ${i + 1}</a>`).join('')}
        </div>` 
      : '';

    return `<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">
        <strong style="font-size:12px;color:var(--gold);">Submission:</strong>
        ${submissionStatusBadge(status)}
        ${submission?.submitted_at ? `<span style="font-size:12px;color:var(--ivory-dim);">Submitted ${escapeValue(formatDate(submission.submitted_at.slice(0, 10)))}</span>` : ''}
        ${score}
      </div>
      ${feedback ? `<div style="margin:8px 0;padding:10px;background:rgba(218,163,62,0.06);border:1px solid rgba(218,163,62,0.25);border-radius:8px;font-size:12px;color:var(--ivory);white-space:pre-wrap;">${escapeValue(feedback)}</div>` : ''}
      ${currentText ? `<div style="font-size:12px;color:var(--ivory-dim);line-height:1.55;white-space:pre-wrap;">${escapeValue(currentText)}</div>` : ''}
      ${currentUrl ? `<div style="margin-top:6px;font-size:12px;color:var(--gold);"><a href="${escapeValue(currentUrl)}" target="_blank" rel="noopener">Open submission link</a></div>` : ''}
      ${filesHtml}
      ${canSubmit ? `<div style="display:grid;gap:8px;margin-top:12px;">
        <textarea id="homework-submission-text-${assignment.id}" class="input-field" placeholder="Type your completed homework response or practice notes..." style="min-height:90px;">${escapeValue(currentText)}</textarea>
        <input id="homework-submission-url-${assignment.id}" class="input-field" placeholder="Optional submission link (Google Drive, Dropbox, etc.)" value="${escapeValue(currentUrl)}">
        <input type="file" id="homework-submission-files-${assignment.id}" class="input-field" accept=".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg,.gif,.pgn,.txt,.md" multiple style="font-size:12px; color:var(--ivory-dim);">
        <div id="homework-submission-preview-${assignment.id}" style="margin-top:6px; display:flex; flex-wrap:wrap; gap:8px;"></div>
        <button class="btn btn-gold btn-sm" onclick="submitHomeworkForChild('${assignment.id}')">${submissionActionLabel(status)}</button>
      </div>` : ''}
    </div>`;
  }

  function renderHomeworkCard(assignment, options = {}) {
    const showActions = options.showActions !== false;
    const selectable = !!options.selectable;
    const selected = homeworkSelectedIds.has(assignment.id);
    const dueClass = assignment.due_date && new Date(`${assignment.due_date}T23:59:59`) < new Date() && assignment.status !== 'completed' ? 'var(--danger)' : 'var(--ivory-dim)';
    const checkbox = selectable ? `<input type="checkbox" data-homework-id="${assignment.id}" ${selected ? 'checked' : ''} onchange="toggleHomeworkSelection('${assignment.id}', this.checked)" style="accent-color:var(--gold);">` : '';

    return `<div class="card" style="padding:16px; border-left: 4px solid ${assignment.status === 'completed' ? 'var(--emerald)' : 'var(--gold)'};">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
        <div style="display:flex; gap:8px; align-items:flex-start; min-width:0;">
          ${checkbox}
          <div style="min-width:0;">
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
              <h4 style="margin:0; color:var(--ivory); font-family:var(--font-head); font-size:15px; overflow-wrap:anywhere;">${escapeValue(assignment.title || 'Untitled Homework')}</h4>
              ${statusBadge(assignment.status)}
            </div>
            <div style="font-size:12px; color:${dueClass}; line-height:1.6;">
              <strong>Due:</strong> ${formatDate(assignment.due_date)} · <strong>Assignee:</strong> ${escapeValue(assigneeLabel(assignment))} · <strong>Recipients:</strong> ${assignment.recipient_count || 0}
            </div>
          </div>
        </div>
        ${showActions ? `<div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${assignment.status !== 'completed' ? `<button class="btn btn-outline-grey btn-sm" onclick="updateHomeworkStatus('${assignment.id}', 'completed')">Mark Done</button>` : ''}
          ${assignment.status !== 'archived' ? `<button class="btn btn-outline-grey btn-sm" onclick="updateHomeworkStatus('${assignment.id}', 'archived')">Archive</button>` : ''}
          <button class="btn btn-outline-danger btn-sm" onclick="deleteHomeworkAssignment('${assignment.id}')">Delete</button>
        </div>` : ''}
      </div>
      ${assignment.description ? `<div style="margin-top:12px; color:var(--ivory-dim); font-size:13px; line-height:1.65; white-space:pre-wrap;">${escapeValue(assignment.description)}</div>` : '<div style="margin-top:12px;color:var(--ivory-dim);font-size:13px;">No detailed instructions provided.</div>'}
      ${assignment.attachment_urls && Array.isArray(assignment.attachment_urls) && assignment.attachment_urls.length > 0 ? `<div style="margin-top:12px; font-size:12px; color:var(--gold);">
          <strong>Attachments:</strong><br>
          ${assignment.attachment_urls.map((url, i) => `<a href="${escapeValue(url)}" target="_blank" rel="noopener" style="display:block; margin-top:4px;">📎 File ${i + 1}</a>`).join('')}
        </div>` : ''}
      ${!isAdminUser() ? renderChildSubmissionPanel(assignment) : ''}
    </div>`;
  }

  function removeHomeworkSelection(id) {
    homeworkSelectedIds.delete(id);
    renderSelectedHomeworkList();
    renderHomeworkCalendar();
  }

  function renderSelectedHomeworkList() {
    const list = $('homework-selected-list');
    const count = $('homework-selection-count');
    if (count) count.textContent = `${homeworkSelectedIds.size} selected`;
    if (!list) return;

    const selected = Array.from(homeworkSelectedIds).map((id) => (window.allHomework || []).find((item) => String(item.id) === String(id))).filter(Boolean);
    if (!selected.length) {
      list.innerHTML = '<div style="color:var(--ivory-dim);font-size:12px;">No assignments selected.</div>';
      return;
    }

    list.innerHTML = selected.map((item) => `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;font-size:12px;">
      <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeValue(item.title)}</span>
      <button class="btn btn-outline-grey btn-sm" onclick="removeHomeworkSelection('${item.id}')">Remove</button>
    </div>`).join('');
  }

  function toggleHomeworkSelection(id, checked) {
    if (checked) homeworkSelectedIds.add(id);
    else homeworkSelectedIds.delete(id);
    renderSelectedHomeworkList();
  }

  function selectFilteredHomework() {
    if (!isAdminUser()) return window.toast ? window.toast('Only administrators can select homework for batch editing.', 'error') : null;
    getFilteredHomework().forEach((assignment) => homeworkSelectedIds.add(assignment.id));
    renderSelectedHomeworkList();
    renderHomeworkCalendar();
  }

  function clearHomeworkSelection() {
    homeworkSelectedIds.clear();
    renderSelectedHomeworkList();
    renderHomeworkCalendar();
  }

  function renderHomeworkCalendarGrid(items) {
    const grid = $('homework-calendar-grid');
    if (!grid) return;
    const month = $('homework-month-filter') ? $('homework-month-filter').value : monthKey(homeworkCalendarMonth);
    const [year, monthNumber] = (month || monthKey(homeworkCalendarMonth)).split('-').map(Number);
    const first = new Date(year, monthNumber - 1, 1);
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const offset = first.getDay();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const byDate = new Map();
    items.forEach((assignment) => {
      if (!assignment.due_date) return;
      if (!byDate.has(assignment.due_date)) byDate.set(assignment.due_date, []);
      byDate.get(assignment.due_date).push(assignment);
    });

    let html = dayNames.map((name) => `<div style="text-align:center;font-size:11px;color:var(--gold);font-weight:700;padding:6px;">${name}</div>`).join('');
    for (let i = 0; i < offset; i += 1) {
      html += `<div style="min-height:110px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,0.02);"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${year}-${pad(monthNumber)}-${pad(day)}`;
      const dayItems = byDate.get(key) || [];
      html += `<div style="min-height:110px;border:1px solid var(--border);border-radius:10px;background:${dayItems.length ? 'rgba(218,163,62,0.06)' : 'rgba(255,255,255,0.02)'};padding:8px;">
        <div style="display:flex;justify-content:space-between;gap:6px;align-items:center;margin-bottom:6px;">
          <strong style="font-size:12px;color:var(--ivory);">${day}</strong>
          ${dayItems.length ? `<span class="badge badge-level">${dayItems.length}</span>` : ''}
        </div>
        <div style="display:grid;gap:4px;">
          ${dayItems.slice(0, 3).map((item) => `<div title="${escapeValue(assigneeLabel(item))}" style="font-size:10px;color:var(--ivory-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeValue(item.title)}</div>`).join('')}
          ${dayItems.length > 3 ? `<div style="font-size:10px;color:var(--gold);">+${dayItems.length - 3} more</div>` : ''}
        </div>
      </div>`;
    }

    grid.innerHTML = html;
  }

  function renderHomeworkCalendarList(items) {
    const list = $('homework-calendar-list');
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><span class="empty-icon">📝</span><p>No homework matches the selected filters.</p></div>';
      return;
    }

    const grouped = new Map();
    items.forEach((assignment) => {
      const key = assignment.due_date || 'no-date';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(assignment);
    });

    const title = (key) => key === 'no-date' ? 'No due date' : formatDate(key);
    list.innerHTML = Array.from(grouped.entries()).map(([key, group]) => `<div>
      <div style="display:flex;align-items:center;gap:8px;margin:12px 0 6px;color:var(--gold);font-weight:700;font-size:13px;">
        <span>${title(key)}</span>
        <span class="badge badge-level">${group.length}</span>
      </div>
      ${sortHomework(group).map((item) => renderHomeworkCard(item, { selectable: isAdminUser() })).join('')}
    </div>`).join('');
  }

  function renderHomeworkCalendar() {
    const month = $('homework-month-filter');
    if (month && !month.value) month.value = monthKey(homeworkCalendarMonth);
    const items = getFilteredHomework();
    renderHomeworkCalendarGrid(items);
    renderHomeworkCalendarList(items);
    renderSelectedHomeworkList();
  }

  function renderAdminHomeworkSummary() {
    const container = $('admin-homework-summary');
    if (!container) return;
    const items = sortHomework(window.allHomework || []);
    if (!items.length) {
      container.innerHTML = '<div class="empty-state"><span class="empty-icon">📝</span><p>No homework assigned yet.</p></div>';
      return;
    }
    container.innerHTML = items.slice(0, 6).map((item) => renderHomeworkCard(item)).join('');
  }

  function populateHomeworkSubmissionFilters() {
    const assignmentSelect = $('homework-submission-assignment-filter');
    const studentSelect = $('homework-submission-student-filter');
    if (!assignmentSelect || !studentSelect) return;

    const assignmentCurrent = assignmentSelect.value;
    const studentCurrent = studentSelect.value;
    assignmentSelect.innerHTML = '<option value="">All Assignments</option>' + (window.allHomework || [])
      .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')))
      .map((assignment) => `<option value="${assignment.id}">${escapeValue(assignment.title || 'Untitled Homework')}</option>`)
      .join('');
    const studs = window.role === 'coach'
      ? (window.allStudents || []).filter(s => String(s.coach_id) === String(window.userId))
      : (window.allStudents || []);
    studentSelect.innerHTML = '<option value="">All Students</option>' + studs
      .filter((student) => (student.status || 'active') !== 'archived')
      .sort((a, b) => studentName(a).localeCompare(studentName(b)))
      .map((student) => `<option value="${student.id}">${escapeValue(studentName(student))}</option>`)
      .join('');
    if ([...assignmentSelect.options].some((option) => option.value === assignmentCurrent)) assignmentSelect.value = assignmentCurrent;
    if ([...studentSelect.options].some((option) => option.value === studentCurrent)) studentSelect.value = studentCurrent;
  }

  function getFilteredHomeworkSubmissions() {
    const assignmentId = $('homework-submission-assignment-filter') ? $('homework-submission-assignment-filter').value : '';
    const studentId = $('homework-submission-student-filter') ? $('homework-submission-student-filter').value : '';
    const status = $('homework-submission-status-filter') ? $('homework-submission-status-filter').value : '';
    return (homeworkSubmissionCache || []).filter((submission) => {
      if (assignmentId && String(submission.assignment_id) !== assignmentId) return false;
      if (studentId && String(submission.student_id) !== studentId) return false;
      if (status && String(submission.status) !== status) return false;
      return true;
    });
  }

  function renderHomeworkSubmissionReview() {
    const list = $('homework-submission-review-list');
    if (!list) return;
    populateHomeworkSubmissionFilters();
    const items = getFilteredHomeworkSubmissions();
    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><span class="empty-icon">📝</span><p>No submissions match the selected filters.</p></div>';
      return;
    }

    list.innerHTML = items.map((submission) => {
      const assignment = (window.allHomework || []).find((item) => String(item.id) === String(submission.assignment_id));
      const student = (window.allStudents || []).find((item) => String(item.id) === String(submission.student_id));
      const title = assignment?.title || 'Untitled Homework';
      const name = studentName(student);
      const feedback = submission.feedback || '';
      const score = submission.score !== null && submission.score !== undefined ? escapeValue(submission.score) : '';
      const submittedAt = submission.submitted_at ? escapeValue(formatDate(String(submission.submitted_at).slice(0, 10))) : 'Not submitted';
      return `<div class="card" style="padding:14px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
          <div style="min-width:0;">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">
              <h4 style="margin:0;color:var(--ivory);font-family:var(--font-head);font-size:14px;">${escapeValue(title)}</h4>
              ${submissionStatusBadge(submission.status)}
            </div>
            <div style="font-size:12px;color:var(--ivory-dim);line-height:1.6;">
              <strong>Student:</strong> ${escapeValue(name)} · <strong>Submitted:</strong> ${submittedAt} ${score ? `· <strong>Score:</strong> ${score}` : ''}
            </div>
          </div>
        </div>
        ${submission.submission_text ? `<div style="margin-top:10px;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--ivory);line-height:1.55;white-space:pre-wrap;">${escapeValue(submission.submission_text)}</div>` : ''}
        ${submission.submission_url ? `<div style="margin-top:6px;font-size:12px;color:var(--gold);"><a href="${escapeValue(submission.submission_url)}" target="_blank" rel="noopener">Open submission link</a></div>` : ''}
        ${Array.isArray(submission.file_urls) && submission.file_urls.length > 0 ? `<div style="margin-top:6px;font-size:12px;color:var(--gold);"><strong>Attachments:</strong> ${submission.file_urls.map((url, i) => `<a href="${escapeValue(url)}" target="_blank" rel="noopener" style="display:block;margin-top:4px;">📎 File ${i + 1}</a>`).join('')}</div>` : ''}
        ${feedback ? `<div style="margin-top:10px;padding:10px;background:rgba(218,163,62,0.06);border:1px solid rgba(218,163,62,0.25);border-radius:8px;font-size:12px;color:var(--ivory);white-space:pre-wrap;">${escapeValue(feedback)}</div>` : ''}
        <div style="display:grid;gap:8px;margin-top:12px;">
          <textarea id="homework-feedback-${submission.id}" class="input-field" placeholder="Teacher feedback or revision instructions..." style="min-height:70px;">${escapeValue(feedback)}</textarea>
          <input id="homework-score-${submission.id}" class="input-field" placeholder="Optional score" value="${score}">
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-gold btn-sm" onclick="reviewHomeworkSubmission('${submission.id}', 'approved')">Approve</button>
            <button class="btn btn-outline-grey btn-sm" onclick="reviewHomeworkSubmission('${submission.id}', 'needs_revision')">Request Revision</button>
            <button class="btn btn-outline-grey btn-sm" onclick="reviewHomeworkSubmission('${submission.id}', 'closed')">Close</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function renderAdminHomeworkBatchPreview() {
    populateHomeworkSelectors();
    const batchSelect = $('homework-batch-preview');
    const list = $('homework-batch-preview-list');
    if (!batchSelect || !list) return;
    const batchId = batchSelect.value;
    if (!batchId) {
      list.innerHTML = '<div class="loading-state"><span class="spinner"></span> Select a batch to preview homework</div>';
      return;
    }
    const batch = (window.allBatches || []).find((item) => String(item.id) === String(batchId));
    const items = sortHomework((window.allHomework || []).filter((assignment) => assignmentAppliesToBatch(assignment, batchId, window.allStudents || [], window.allBatches || [])));
    list.innerHTML = items.length
      ? items.map((item) => renderHomeworkCard(item)).join('')
      : `<div class="empty-state"><span class="empty-icon">📝</span><p>No homework assigned to ${escapeValue(batchName(batch))}.</p></div>`;
  }

  function renderHomeworkPage() {
    populateHomeworkSelectors();
    updateHomeworkTargetFields();
    const month = $('homework-month-filter');
    if (month && !month.value) month.value = monthKey(homeworkCalendarMonth);
    renderHomeworkCalendar();
    renderAdminHomeworkSummary();
    renderAdminHomeworkBatchPreview();
    renderHomeworkSubmissionReview();
    loadHomeworkSubmissions();
  }

  function renderChildHomework() {
    const list = $('child-homework-list');
    const student = window.currentStudent || null;
    if (!list) return;
    if (!student) {
      list.innerHTML = '<div class="loading-state"><span class="spinner"></span> Loading student context</div>';
      return;
    }

    const items = sortHomework((window.allHomework || []).filter((assignment) => assignmentAppliesToStudent(assignment, student.id, window.allStudents || [])));
    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><span class="empty-icon">📝</span><p>No homework assigned right now.</p></div>';
      return;
    }

    list.innerHTML = items.map((item) => renderHomeworkCard(item, { showActions: false })).join('');
  }

  function renderStudentHomeworkProgress() {
    const list = $('hw-progress-list');
    const studentId = $('hw-progress-student')?.value;
    const searchTopic = ($('hw-progress-topic-search')?.value || '').toLowerCase().trim();

    if (!list) return;

    if (!studentId) {
      list.innerHTML = '<div class="empty-state"><span class="empty-icon">👤</span><p>Select a student to view progress.</p></div>';
      return;
    }

    const studentAssignments = sortHomework((window.allHomework || []).filter((assignment) => 
      assignmentAppliesToStudent(assignment, studentId, window.allStudents || [])
    ));

    if (!studentAssignments.length) {
      list.innerHTML = '<div class="empty-state"><span class="empty-icon">📝</span><p>No homework assigned to this student.</p></div>';
      return;
    }

    // Filter by topic keyword
    const filteredAssignments = studentAssignments.filter(a => {
      if (!searchTopic) return true;
      const title = (a.title || '').toLowerCase();
      const desc = (a.description || '').toLowerCase();
      return title.includes(searchTopic) || desc.includes(searchTopic);
    });

    if (!filteredAssignments.length) {
      list.innerHTML = '<div class="empty-state"><span class="empty-icon">🔍</span><p>No matching topics found.</p></div>';
      return;
    }

    let html = `
      <div style="box-shadow: var(--shadow); border-radius: 10px; overflow-x: auto; border: 1px solid var(--border);">
        <table style="width:100%; border-collapse:collapse; background:var(--surface); text-align:left;">
          <thead>
            <tr style="background:var(--bg3); border-bottom:1px solid var(--border);">
              <th style="padding:10px 14px; font-weight:600; color:var(--ivory-dim); font-size:12px;">Topic / Title</th>
              <th style="padding:10px 14px; font-weight:600; color:var(--ivory-dim); font-size:12px;">Due Date</th>
              <th style="padding:10px 14px; font-weight:600; color:var(--ivory-dim); font-size:12px;">Status</th>
              <th style="padding:10px 14px; font-weight:600; color:var(--ivory-dim); font-size:12px;">Score</th>
              <th style="padding:10px 14px; font-weight:600; color:var(--ivory-dim); font-size:12px;">Submitted At</th>
            </tr>
          </thead>
          <tbody>
    `;

    filteredAssignments.forEach(assignment => {
      // Find submission in cache or assignment.student_submission
      let submission = assignment.student_submission;
      if (!submission && homeworkSubmissionCache.length > 0) {
        submission = homeworkSubmissionCache.find(sub => 
          String(sub.assignment_id) === String(assignment.id) && 
          String(sub.student_id) === String(studentId)
        );
      }

      const status = submission?.status || 'not_submitted';
      const score = submission?.score !== null && submission?.score !== undefined ? escapeValue(submission.score) : '—';
      const submittedAt = submission?.submitted_at ? escapeValue(formatDate(submission.submitted_at.slice(0, 10))) : '—';

      html += `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:10px 14px; color:var(--ivory); font-weight:500;">${escapeValue(assignment.title || 'Untitled')}</td>
          <td style="padding:10px 14px; color:var(--ivory2); font-size:12px;">${formatDate(assignment.due_date)}</td>
          <td style="padding:10px 14px;">${submissionStatusBadge(status)}</td>
          <td style="padding:10px 14px; color:var(--ivory2); font-size:12px;">${score}</td>
          <td style="padding:10px 14px; color:var(--ivory-dim); font-size:12px;">${submittedAt}</td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    list.innerHTML = html;
  }

  window.updateHomeworkTargetFields = updateHomeworkTargetFields;
  window.openHomeworkAssignmentModal = openHomeworkAssignmentModal;
  window.saveHomeworkAssignment = saveHomeworkAssignment;
  window.updateHomeworkStatus = updateHomeworkStatus;
  window.applyBulkHomeworkStatus = applyBulkHomeworkStatus;
  window.selectFilteredHomework = selectFilteredHomework;
  window.clearHomeworkSelection = clearHomeworkSelection;
  window.removeHomeworkSelection = removeHomeworkSelection;
  window.toggleHomeworkSelection = toggleHomeworkSelection;
  window.deleteHomeworkAssignment = deleteHomeworkAssignment;
  window.submitHomeworkForChild = submitHomeworkForChild;
  window.reviewHomeworkSubmission = reviewHomeworkSubmission;
  window.loadHomeworkSubmissions = loadHomeworkSubmissions;
  window.renderHomeworkSubmissionReview = renderHomeworkSubmissionReview;
  window.renderHomeworkCalendar = renderHomeworkCalendar;
  window.renderHomeworkPage = renderHomeworkPage;
  window.renderAdminHomeworkBatchPreview = renderAdminHomeworkBatchPreview;
  window.renderChildHomework = renderChildHomework;
  window.renderStudentHomeworkProgress = renderStudentHomeworkProgress;
})();
