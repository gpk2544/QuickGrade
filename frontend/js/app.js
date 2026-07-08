/**
 * QuickGrade — Main Application Logic
 * Handles navigation, UI transitions, and form validation.
 */

// ── UI HELPERS ───────────────────────────────────────────────

window.setText = (id, val) => {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
};

window.setVal = (id, val) => {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
};

window.showToast = function (msg) {
  const t = document.getElementById('toast');
  const m = document.getElementById('toast-msg');
  if (t && m) {
    m.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }
};

window.closeModal = function (id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
};

// ── NAVIGATION ───────────────────────────────────────────────

window.showPage = function (id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }

  if (id === 'register') {
    ['reg-first', 'reg-last', 'reg-school', 'reg-email', 'reg-pass', 'reg-pass2'].forEach(fid => window.setVal(fid, ''));
    const err = document.getElementById('reg-error'); if (err) err.style.display = 'none';
  }
  if (id === 'login') {
    ['login-email', 'login-pass'].forEach(fid => window.setVal(fid, ''));
    const err = document.getElementById('login-error'); if (err) err.style.display = 'none';
  }
};

window.switchView = function (name) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItems = document.querySelectorAll('.nav-item');
  const indexMap = { 'overview': 0, 'create': 1, 'forums': 2, 'analytics': 3 };
  if (indexMap[name] !== undefined && navItems[indexMap[name]]) {
    navItems[indexMap[name]].classList.add('active');
  }

  document.querySelectorAll('.main-area').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + name);
  if (el) {
    el.classList.add('active');
    window.scrollTo(0, 0);
  }

  if (name === 'create') window.goCreateStep(1);
};

window.switchTab = function (tabEl, tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  ['tab-results', 'tab-upload', 'tab-forum-analytics'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === tabId) ? 'block' : 'none';
  });
};

window.updateUserUI = function (user) {
  if (!user) return;
  const fullName = (user.firstName + ' ' + (user.lastName || '')).trim() || user.email.split('@')[0];
  const initials = (user.firstName ? user.firstName[0] : user.email[0]).toUpperCase();

  window.setText('sidebar-avatar', initials);
  window.setText('sidebar-name', fullName);
  window.setText('dash-greeting', 'Good morning, ' + (user.firstName || 'Teacher') + ' 👋');
  window.setText('profile-big-avatar', initials);
  window.setText('profile-big-name', fullName);
  window.setText('profile-school-line', '📍 ' + (user.school || 'Not set'));

  window.setVal('profile-first', user.firstName);
  window.setVal('profile-last', user.lastName);
  window.setVal('profile-email', user.email);
  window.setVal('profile-institution', user.school || '');
};

window.showDashboard = function () {
  window.showPage('dashboard');
  window.switchView('overview');
  if (window.renderForumsUI) window.renderForumsUI();
};

// ── FORUM CREATION ───────────────────────────────────────────

let cfData = { name: '', subject: '', cls: '', marks: 100, file: null, textbook: null, useTextInput: false };

window.goCreateStep = function (n) {
  [1, 2, 3].forEach(i => {
    const stepEl = document.getElementById('create-step' + i);
    const ws = document.getElementById('ws' + i);
    if (stepEl) stepEl.style.display = (i === n) ? 'block' : 'none';
    if (ws) {
      ws.classList.remove('done', 'current');
      if (i < n) ws.classList.add('done');
      else if (i === n) ws.classList.add('current');
    }
  });
  if (n === 3) window.runAIExtraction();
};

window.validateStep1 = function () {
  const name = document.getElementById('cf-name')?.value.trim();
  const subject = document.getElementById('cf-subject')?.value.trim();
  const cls = document.getElementById('cf-class')?.value.trim();
  if (!name || !subject || !cls) {
    window.showToast('⚠ Please fill Forum Name, Subject and Class');
    return;
  }
  cfData.name = name; cfData.subject = subject; cfData.cls = cls;
  cfData.marks = parseInt(document.getElementById('cf-marks')?.value) || 100;
  window.goCreateStep(2);
};

window.handleFileSelect = function (input) {
  if (input.files && input.files[0]) window.showFilePreview(input.files[0]);
};

window.handleFileDrop = function (event) {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (file) window.showFilePreview(file);
};

window.showFilePreview = function (file) {
  cfData.file = file;
  window.setText('file-name-preview', file.name);
  const box = document.getElementById('file-preview-box');
  if (box) box.style.display = 'flex';
  const zone = document.getElementById('upload-zone-s2');
  if (zone) zone.style.borderColor = 'var(--accent)';
};

window.clearFileUpload = function () {
  cfData.file = null;
  const fi = document.getElementById('cf-file'); if (fi) fi.value = '';
  const box = document.getElementById('file-preview-box');
  if (box) box.style.display = 'none';
  const zone = document.getElementById('upload-zone-s2');
  if (zone) zone.style.borderColor = '';
};

window.togglePasteText = function () {
  const checkbox = document.getElementById('use-paste-text');
  const pasteBox = document.getElementById('paste-text-box');
  const uploadZone = document.getElementById('upload-zone-s2');
  cfData.useTextInput = checkbox && checkbox.checked;
  if (pasteBox) pasteBox.style.display = cfData.useTextInput ? 'block' : 'none';
  if (uploadZone) uploadZone.style.opacity = cfData.useTextInput ? '0.4' : '1';
};

window.handleTextbookSelect = function (input) {
  if (input.files && input.files[0]) window.showTextbookPreview(input.files[0]);
};

window.handleTextbookDrop = function (event) {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (file) window.showTextbookPreview(file);
};

window.showTextbookPreview = function (file) {
  cfData.textbook = file;
  window.setText('tb-name', file.name);
  const box = document.getElementById('tb-preview-box');
  if (box) box.style.display = 'flex';
  window.showToast('📖 Textbook ready');
};

window.clearTextbook = function () {
  cfData.textbook = null;
  const box = document.getElementById('tb-preview-box');
  if (box) box.style.display = 'none';
};

// ── AI EXTRACTION ────────────────────────────────────────────

window.runAIExtraction = async function () {
  const list = document.getElementById('model-answers-list');
  if (!list) return;
  list.innerHTML = `<div style="text-align:center;padding:3rem">
    <div class="loader-spinner">🤖</div>
    <p style="margin-top:1rem;color:var(--accent);font-weight:700">AI Analyzing Question Paper...</p>
  </div>`;

  try {
    const questions = await extractQuestionsFromPaper(cfData.file);
    list.innerHTML = '';
    questions.forEach((q, i) => list.appendChild(createQuestionCard(i + 1, q)));
    window.setText('step3-subtitle', `${questions.length} questions extracted successfully`);
    const badge = document.getElementById('ai-source-badge'); if (badge) badge.style.display = 'inline-flex';
  } catch (err) {
    console.error('AI extraction failed:', err);
    list.innerHTML = '';
    for (let i = 1; i <= 5; i++) list.appendChild(createQuestionCard(i, {}));
    window.setText('step3-subtitle', 'Extraction failed — please fill answers manually');
    window.showToast('⚠ AI extraction failed');
  }
};

async function extractQuestionsFromPaper(file) {
  const token = window.getAuthToken ? window.getAuthToken() : '';
  if (!token) throw new Error('Authentication required');

  const formData = new FormData();
  if (cfData.useTextInput) {
    formData.append('text', document.getElementById('cf-text-input')?.value || '');
  } else if (file) {
    formData.append('file', file);
  } else {
    return [];
  }
  formData.append('subject', cfData.subject || 'General');
  formData.append('total_marks', (cfData.marks || 100).toString());

  const baseUrl = window.API_BASE || 'http://localhost:8000';
  const res = await fetch(`${baseUrl}/extract/questions`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData
  });

  if (!res.ok) throw new Error('Extraction failed with status ' + res.status);
  const json = await res.json();
  return json.data || [];
}

function createQuestionCard(num, data) {
  const div = document.createElement('div');
  div.className = 'mar-card';
  div.dataset.qnum = num;
  const qText = data.question ? `
    <div style="background:rgba(0,229,184,.05);border:1px solid rgba(0,229,184,.18);border-radius:10px;padding:.85rem 1rem;margin-bottom:1rem">
      <div style="font-size:.7rem;font-weight:800;color:var(--accent);letter-spacing:.1em;margin-bottom:.4rem">📋 QUESTION FROM PAPER</div>
      <div style="font-size:.9rem;color:var(--text);line-height:1.5">${data.question}</div>
    </div>` : '';

  div.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
      <div style="display:flex;align-items:center;gap:.75rem">
        <span class="q-badge" style="background:rgba(0,229,184,.15);color:var(--accent);width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800">Q ${num}</span>
        <span class="mar-marks-label" style="font-size:.8rem;color:var(--text-muted);font-weight:600">${data.marks || 10} marks</span>
      </div>
      <div style="display:flex;gap:.5rem">
        <button onclick="window.toggleComment(this)" class="btn btn-ghost btn-sm">💬 Note</button>
        <button onclick="window.deleteQuestion(this)" class="btn btn-ghost btn-sm" style="color:var(--danger)">🗑 Delete</button>
      </div>
    </div>
    ${qText}
    <div class="form-group">
      <label>Model Answer</label>
      <textarea class="mar-answer" rows="3" placeholder="Model answer...">${data.answer || ''}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Keywords</label>
        <input type="text" class="mar-keywords" value="${data.keywords || ''}" placeholder="k1, k2...">
      </div>
      <div class="form-group">
        <label>Marks</label>
        <input type="number" class="mar-marks" value="${data.marks || 10}" oninput="this.closest('.mar-card').querySelector('.mar-marks-label').textContent=this.value+' marks'">
      </div>
    </div>
    <div class="mar-comment-box" style="display:none;margin-top:.75rem">
      <textarea class="mar-comment" rows="2" placeholder="Internal note...">${data.comment || ''}</textarea>
    </div>`;
  return div;
}

window.addModelAnswer = function () {
  const list = document.getElementById('model-answers-list');
  list.appendChild(createQuestionCard(document.querySelectorAll('.mar-card').length + 1, {}));
};

window.deleteQuestion = function (btn) {
  btn.closest('.mar-card').remove();
  window.renumberQuestions();
};

window.toggleComment = function (btn) {
  const box = btn.closest('.mar-card').querySelector('.mar-comment-box');
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
};

window.renumberQuestions = function () {
  document.querySelectorAll('.mar-card').forEach((c, i) => {
    const b = c.querySelector('.q-badge'); if (b) b.textContent = 'Q ' + (i + 1);
  });
};

// ── ANSWER SHEET UPLOADS ──────────────────────────────────────

window.addStudentRow = function () {
  const list = document.getElementById('student-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'student-upload-card reveal visible';
  row.innerHTML = `
    <div class="st-card-header">
      <div class="form-group">
        <label>Student Name</label>
        <input type="text" class="st-name" placeholder="Full Name">
      </div>
      <div class="form-group">
        <label>Registration Number</label>
        <input type="text" class="st-reg" placeholder="Reg No">
      </div>
      <div class="form-group">
        <label>Select Answer Sheet</label>
        <input type="file" class="st-file" accept=".pdf,.jpg,.jpeg,.png">
      </div>
      <div class="st-actions">
        <button class="btn btn-primary btn-sm btn-upload" onclick="window.submitStudentSheet(this)">📤 Upload</button>
        <button class="btn btn-ghost btn-sm" onclick="this.closest('.student-upload-card').remove()" style="color:var(--danger)">✕</button>
      </div>
    </div>
    <div class="st-card-body ocr-edit-area" style="display:none">
      <div class="ocr-edit-container">
        <div class="ocr-label">📝 Extracted OCR Text</div>
        <textarea class="ocr-textarea" placeholder="OCR text will appear here after upload..."></textarea>
        <button class="btn btn-accent btn-sm btn-grade" onclick="window.saveAndGradeStudent(this)">⚡ Save & Grade</button>
      </div>
    </div>`;
  list.appendChild(row);
};

window.submitStudentSheet = async function (btn) {
  const row = btn.closest('.student-upload-card');
  const name = row.querySelector('.st-name').value.trim();
  const reg = row.querySelector('.st-reg').value.trim();
  const file = row.querySelector('.st-file').files[0];

  if (!name || !reg || !file) { window.showToast('⚠ Missing details'); return; }
  if (!window.currentForumId) { window.showToast('❌ Forum error'); return; }

  try {
    btn.disabled = true; btn.textContent = '⏳ ...';
    const token = window.getAuthToken();
    const fd = new FormData();
    fd.append('forum_id', window.currentForumId);
    fd.append('student_name', name);
    fd.append('reg_number', reg);
    fd.append('file', file);

    const baseUrl = window.API_BASE || 'http://localhost:8000';
    const res = await fetch(`${baseUrl}/upload/answer-sheet`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: fd
    });

    if (!res.ok) throw new Error('Upload failed');
    const json = await res.json();
    const ocrText = json.data.student.ocr_text || '';
    const studentId = json.data.student.id;

    window.showToast(`✅ Uploaded ${name}`);

    // Lock inputs
    row.querySelector('.st-name').disabled = true;
    row.querySelector('.st-reg').disabled = true;
    row.querySelector('.st-file').disabled = true;

    // Show OCR edit area
    const body = row.querySelector('.st-card-body');
    if (body) {
      body.style.display = 'block';
      const area = body.querySelector('.ocr-textarea');
      if (area) area.value = ocrText;
      body.dataset.studentId = studentId;
    }

    btn.innerHTML = '✓ Uploaded';
    btn.className = 'btn btn-ghost btn-sm';
    btn.style.color = 'var(--success)';
    btn.disabled = true;

    if (window.openForumDetail) window.openForumDetail(window.currentForumId, true);
  } catch (err) {
    console.error('Upload failed:', err);
    window.showToast('❌ Upload failed');
    btn.disabled = false;
    btn.textContent = '📤 Retry';
  }
};

window.saveAndGradeStudent = async function (btn) {
  const cardBody = btn.closest('.st-card-body');
  const studentId = cardBody.dataset.studentId;
  const editedText = cardBody.querySelector('.ocr-textarea').value.trim();

  if (!studentId || !window.currentForumId) return;

  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="loader-spinner" style="font-size:.9rem;margin:0">⌛</span> Saving & Grading...';

    const token = window.getAuthToken();
    const baseUrl = window.API_BASE || 'http://localhost:8000';

    // 1. Update text
    await fetch(`${baseUrl}/upload/student/${studentId}`, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ocr_text: editedText })
    });

    // 2. Evaluate
    const res = await fetch(`${baseUrl}/evaluate/student`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ student_id: studentId, forum_id: window.currentForumId })
    });

    if (!res.ok) throw new Error('Evaluation failed');

    window.showToast('✅ Grading complete');
    btn.innerHTML = '✓ Graded Successfully';
    btn.style.background = 'rgba(34, 197, 94, 0.15)';
    btn.style.color = 'var(--success)';
    btn.style.borderColor = 'rgba(34, 197, 94, 0.3)';

    if (window.openForumDetail) window.openForumDetail(window.currentForumId, true);
  } catch (err) {
    console.error('Save & Grade failed:', err);
    window.showToast('❌ Grading failed');
    btn.disabled = false;
    btn.textContent = '⚡ Retry Save & Grade';
  }
};

// ── INITIALIZATION ───────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  const revealEls = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver((es) => {
    es.forEach((e, i) => { if (e.isIntersecting) { e.target.style.transitionDelay = (i % 6) * 0.1 + 's'; e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.1 });
  revealEls.forEach(el => obs.observe(el));
});