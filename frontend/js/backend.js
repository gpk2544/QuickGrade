/**
 * QuickGrade — Backend Integration Module
 * Overrides app.js functions to use real Firebase Auth + Backend API.
 * Loaded as type="module" after app.js so window functions already exist.
 */

import {
  auth, db, storage, googleProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup,
  collection, doc, setDoc, getDoc, getDocs, addDoc,
  query, where, orderBy, deleteDoc,
  ref, uploadBytes, getDownloadURL
} from '../firebase/firebase-config.js';

import {
  setAuthToken, getAuthToken,
  apiVerifyToken, apiGetProfile, apiUpdateProfile, apiUploadAvatar,
  apiListForums, apiCreateForum, apiGetForum, apiDeleteForum, apiCloseForum,
  apiUploadAnswerSheet, apiUploadQuestionPaper, apiUploadTextbook,
  apiEvaluateStudent, apiEvaluateAll, apiExportExcel, downloadBlob
} from './api.js';

window.getAuthToken = getAuthToken;

// ═══════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════
let currentForumId = null;   // currently open forum
let currentForumData = null; // cached forum detail
let forumsCache = [];        // list of forums from API

// ═══════════════════════════════════════════
//  AUTH — Override handleLogin / handleRegister
// ═══════════════════════════════════════════

window.handleLogin = async function () {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');

  if (!email || !email.includes('@')) { errEl.textContent = 'Please enter a valid email address.'; errEl.style.display = 'block'; return; }
  if (!pass) { errEl.textContent = 'Please enter your password.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const idToken = await cred.user.getIdToken();
    setAuthToken(idToken);

    // Try backend verify — but don't fail login if backend is misconfigured
    let backendUser = null;
    try {
      const result = await apiVerifyToken(idToken);
      backendUser = result.user;
    } catch (backendErr) {
      console.warn('Backend verify failed (check serviceAccountKey.json project ID), continuing with Firebase identity:', backendErr.message);
    }

    const fbUser = cred.user;
    const displayName = fbUser.displayName || '';
    const nameParts = displayName.split(' ');
    window.currentUser = {
      uid: fbUser.uid,
      firstName: backendUser?.first_name || nameParts[0] || email.split('@')[0],
      lastName: backendUser?.last_name || nameParts.slice(1).join(' ') || '',
      school: backendUser?.school || '',
      email: fbUser.email || email,
      avatarUrl: backendUser?.avatar_url || fbUser.photoURL || '',
      isNew: false
    };

    window.userForums = window.userForums || [];
    window.updateUserUI(window.currentUser);
    if (backendUser) await loadDashboardData();
    window.showDashboard();
    window.showToast('✅ Logged in successfully!');
  } catch (err) {
    console.error('Login error:', err);
    let msg = 'Login failed. Please check your credentials.';
    if (err.code === 'auth/user-not-found') msg = 'No account found with this email.';
    if (err.code === 'auth/wrong-password') msg = 'Incorrect password.';
    if (err.code === 'auth/invalid-credential') msg = 'Invalid credentials. Please try again.';
    if (err.code === 'auth/invalid-email') msg = 'Invalid email address.';
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
};

window.handleRegister = async function () {
  const first = document.getElementById('reg-first').value.trim();
  const last = document.getElementById('reg-last').value.trim();
  const school = document.getElementById('reg-school').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  const errEl = document.getElementById('reg-error');

  if (!first || !last) { errEl.textContent = 'Please enter your first and last name.'; errEl.style.display = 'block'; return; }
  if (!email || !email.includes('@')) { errEl.textContent = 'Please enter a valid email.'; errEl.style.display = 'block'; return; }
  if (pass.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; errEl.style.display = 'block'; return; }
  if (pass !== pass2) { errEl.textContent = 'Passwords do not match.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const idToken = await cred.user.getIdToken();
    setAuthToken(idToken);

    // Verify with backend — this creates the Firestore profile
    const result = await apiVerifyToken(idToken);

    // Update profile with name/school
    await apiUpdateProfile({ first_name: first, last_name: last, school });

    window.currentUser = {
      uid: cred.user.uid,
      firstName: first,
      lastName: last,
      school,
      email,
      avatarUrl: '',
      isNew: true
    };

    window.userForums = window.userForums || [];
    window.updateUserUI(window.currentUser);
    await loadDashboardData();
    window.showDashboard();
    window.showToast('✦ Account created! Welcome to QuickGrade.');
  } catch (err) {
    console.error('Register error:', err);
    let msg = 'Registration failed.';
    if (err.code === 'auth/email-already-in-use') msg = 'An account with this email already exists.';
    if (err.code === 'auth/weak-password') msg = 'Password is too weak.';
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
};

// ── Google Sign-In ──
window.handleGoogleLogin = async function () {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    setAuthToken(idToken);

    // Try backend verify — fall back gracefully if project IDs mismatch
    let backendUser = null;
    try {
      const res = await apiVerifyToken(idToken);
      backendUser = res.user;
    } catch (backendErr) {
      console.warn('Backend verify failed, continuing with Google identity:', backendErr.message);
    }

    const fbUser = result.user;
    const displayName = fbUser.displayName || '';
    const nameParts = displayName.split(' ');
    window.currentUser = {
      uid: fbUser.uid,
      firstName: backendUser?.first_name || nameParts[0] || '',
      lastName: backendUser?.last_name || nameParts.slice(1).join(' ') || '',
      school: backendUser?.school || '',
      email: fbUser.email || '',
      avatarUrl: backendUser?.avatar_url || fbUser.photoURL || '',
      isNew: false
    };

    window.userForums = window.userForums || [];
    window.updateUserUI(window.currentUser);
    if (backendUser) await loadDashboardData();
    window.showDashboard();
    window.showToast('✅ Signed in with Google!');
  } catch (err) {
    console.error('Google login error:', err);
    window.showToast('⚠ Google sign-in failed: ' + err.message);
  }
};

// ── Auto-login on page load ──
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const idToken = await user.getIdToken();
      setAuthToken(idToken);

      let backendUser = null;
      try {
        const result = await apiVerifyToken(idToken);
        backendUser = result.user;
      } catch (backendErr) {
        console.warn('Auto-login: backend verify failed, using Firebase identity:', backendErr.message);
      }

      const displayName = user.displayName || '';
      const nameParts = displayName.split(' ');
      window.currentUser = {
        uid: user.uid,
        firstName: backendUser?.first_name || nameParts[0] || user.email.split('@')[0],
        lastName: backendUser?.last_name || nameParts.slice(1).join(' ') || '',
        school: backendUser?.school || '',
        email: user.email || '',
        avatarUrl: backendUser?.avatar_url || user.photoURL || '',
        isNew: false
      };
      window.userForums = window.userForums || [];
      window.updateUserUI(window.currentUser);
      if (backendUser) await loadDashboardData();
      window.showDashboard();
    } catch (e) {
      console.warn('Auto-login failed:', e);
    }
  }
});

// ── Logout ──
const origLogoutItem = document.querySelector('.sidebar-footer .nav-item[onclick*="landing"]');
if (origLogoutItem) {
  origLogoutItem.onclick = async function () {
    try { await signOut(auth); } catch (e) { /* ok */ }
    setAuthToken(null);
    window.currentUser = null;
    window.userForums = [];
    forumsCache = [];
    currentForumId = null;
    currentForumData = null;
    window.showPage('landing');
    window.showToast('👋 Logged out');
  };
}

// ═══════════════════════════════════════════
//  DASHBOARD — load real data
// ═══════════════════════════════════════════

async function loadDashboardData() {
  try {
    const forums = await apiListForums();
    forumsCache = forums || [];

    // Compute stats
    const totalForums = forumsCache.length;
    let totalStudents = 0, totalGraded = 0, totalPctSum = 0, pctCount = 0;
    forumsCache.forEach(f => {
      totalStudents += f.student_count || 0;
      totalGraded += f.graded_count || 0;
      if (f.avg_pct > 0) { totalPctSum += f.avg_pct; pctCount++; }
    });
    const avgPct = pctCount > 0 ? (totalPctSum / pctCount).toFixed(1) + '%' : '—';

    window.setText('stat-forums', totalForums);
    window.setText('stat-forums-sub', totalForums > 0 ? `${totalForums} forum${totalForums > 1 ? 's' : ''} created` : 'No forums yet');
    window.setText('stat-students', totalStudents);
    window.setText('stat-students-sub', totalStudents > 0 ? `${totalStudents} enrolled` : 'No students yet');
    window.setText('stat-avg', avgPct);
    window.setText('stat-avg-sub', pctCount > 0 ? `Across ${pctCount} forums` : 'No data yet');
    window.setText('stat-graded', totalGraded);
    window.setText('stat-graded-sub', totalGraded > 0 ? `${totalGraded} sheets graded` : 'No sheets yet');

    // Build userForums array for renderForumsUI
    window.userForums = forumsCache.map(f => {
      const statusMap = { active: { label: '● Active', cls: 'badge-active' }, grading: { label: '◐ Grading', cls: 'badge-grading' }, closed: { label: '✓ Closed', cls: 'badge-closed' } };
      const s = statusMap[f.status] || statusMap.active;
      const created = f.created_at ? new Date(f.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      return {
        id: f.id,
        name: f.name,
        subject: f.subject,
        cls: f.class_name,
        students: f.student_count || 0,
        avg: (f.avg_pct || 0) + '%',
        avgNum: f.avg_pct || 0,
        created,
        status: f.status,
        statusLabel: s.label,
        statusClass: s.cls
      };
    });
    window.renderForumsUI();
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

// ═══════════════════════════════════════════
//  FORUMS — override renderForumsUI click handlers
// ═══════════════════════════════════════════

// Patch renderForumsUI to include forum IDs in Open/View buttons
const origRenderForumsUI = window.renderForumsUI;
window.renderForumsUI = function () {
  origRenderForumsUI();

  const forums = window.userForums || [];

  // Re-attach click handlers with forum IDs on overview table rows
  const overviewTbody = document.querySelector('#view-overview .table-card tbody');
  if (overviewTbody && forums.length > 0) {
    overviewTbody.querySelectorAll('tr').forEach((tr, i) => {
      const forum = forums[i];
      if (!forum) return;
      tr.onclick = () => openForumDetail(forum.id);
      const btn = tr.querySelector('button');
      if (btn) btn.onclick = (e) => { e.stopPropagation(); openForumDetail(forum.id); };
    });
  }

  // Re-attach on My Forums table
  const myBody = document.getElementById('my-forums-body');
  if (myBody && forums.length > 0) {
    myBody.querySelectorAll('tr').forEach((tr, i) => {
      const forum = forums[i];
      if (!forum) return;
      const btn = tr.querySelector('button');
      if (btn) btn.onclick = () => openForumDetail(forum.id);
    });
  }
};

// ── Demo Account — bypass broken backend, use local data ──
window.loadDemoAccount = function () {
  window.currentUser = {
    uid: 'demo',
    firstName: 'Demo',
    lastName: 'Teacher',
    school: 'Jeppiaar Institute of Technology',
    email: 'demo@quickgrade.app',
    isNew: false
  };
  window.userForums = [
    { id: 'demo-1', name: 'Mid-Term Exam 2025', subject: 'Mathematics', cls: 'Class 10-A', students: 42, avg: '78.4%', avgNum: 78.4, created: '3 days ago', status: 'active', statusLabel: '● Active', statusClass: 'badge-active' },
    { id: 'demo-2', name: 'Unit Test — Kinematics', subject: 'Physics', cls: 'Class 11-B', students: 38, avg: '65.1%', avgNum: 65.1, created: '1 week ago', status: 'grading', statusLabel: '◐ Grading', statusClass: 'badge-grading' },
    { id: 'demo-3', name: 'Chapter 5 Quiz', subject: 'Chemistry', cls: 'Class 10-B', students: 44, avg: '81.7%', avgNum: 81.7, created: '2 weeks ago', status: 'closed', statusLabel: '✓ Closed', statusClass: 'badge-closed' }
  ];
  window.setText('stat-forums', '3');
  window.setText('stat-forums-sub', '↑ 1 this week');
  window.setText('stat-students', '124');
  window.setText('stat-students-sub', '↑ 35 new');
  window.setText('stat-avg', '75.1%');
  window.setText('stat-avg-sub', 'Across 3 forums');
  window.setText('stat-graded', '80');
  window.setText('stat-graded-sub', '↑ 10 pending');
  window.updateUserUI(window.currentUser);
  window.showDashboard();
  window.showToast('⚡ Demo loaded! Explore freely.');
};

// ═══════════════════════════════════════════
//  FORUM DETAIL — load real data
// ═══════════════════════════════════════════

async function openForumDetail(forumId) {
  currentForumId = forumId;
  window.switchView('forum-detail');

  try {
    const forum = await apiGetForum(forumId);
    currentForumData = forum;

    // Update header
    const h1 = document.querySelector('#view-forum-detail h1');
    if (h1) h1.textContent = forum.name;
    const breadcrumb = document.querySelector('#view-forum-detail .breadcrumb');
    if (breadcrumb) breadcrumb.innerHTML = `<a onclick="switchView('forums')">My Forums</a> <span>/</span> ${forum.name}`;
    const meta = document.querySelector('#view-forum-detail .main-header div[style*="display:flex"]');
    if (meta) {
      const statusMap = { active: 'badge-active', grading: 'badge-grading', closed: 'badge-closed' };
      meta.innerHTML = `
        <span style="font-size:.85rem;color:var(--text-muted)">${forum.subject} • ${forum.class_name} • ${forum.total_marks} marks</span>
        <span class="badge ${statusMap[forum.status] || 'badge-active'}">${forum.status === 'closed' ? '✓ Closed' : forum.status === 'grading' ? '◐ Grading' : '● Active'}</span>`;
    }

    // Build results table from real students
    buildRealResultsTable(forum);
  } catch (err) {
    console.error('Failed to load forum:', err);
    window.showToast('⚠ Failed to load forum details');
  }
}
window.openForumDetail = openForumDetail;

function buildRealResultsTable(forum) {
  const tbody = document.getElementById('results-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const students = forum.students || [];
  const answers = forum.answers || [];
  const totalMarks = forum.total_marks || 100;

  // Update the header row for real questions
  const thead = document.querySelector('#results-table thead tr');
  if (thead && answers.length > 0) {
    thead.innerHTML = `<th>Reg No</th><th>Name</th>`;
    answers.forEach(a => { thead.innerHTML += `<th style="text-align:center">Q${a.question_num} /${a.marks}</th>`; });
    thead.innerHTML += `<th style="text-align:center">Total /${totalMarks}</th><th style="text-align:center">%</th>`;
  }

  // Update count text
  const countEl = document.querySelector('#tab-results > div:first-child > div:first-child');
  if (countEl) {
    const graded = students.filter(s => s.status === 'graded').length;
    countEl.textContent = `${graded} of ${students.length} students graded`;
  }

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${answers.length + 4}" style="text-align:center;padding:2rem;color:var(--text-muted)">No students uploaded yet. Go to "Upload Sheets" tab to add students.</td></tr>`;
    return;
  }

  students.forEach(s => {
    const scores = s.scores || {};
    const total = s.total || 0;
    const pct = s.percentage || 0;
    const pctClass = pct >= 75 ? 'score-high' : pct >= 50 ? 'score-mid' : 'score-low';
    const tr = document.createElement('tr');

    let html = `<td style="font-size:.85rem;color:var(--text-muted)">${s.reg_number || ''}</td><td><strong>${s.name || ''}</strong></td>`;
    answers.forEach(a => {
      const qScore = scores[`Q${a.question_num}`] || 0;
      const cls = qScore >= a.marks * 0.8 ? 'score-high' : qScore >= a.marks * 0.5 ? 'score-mid' : 'score-low';
      html += `<td class="score-cell ${cls}">${qScore}</td>`;
    });
    html += `<td class="score-cell"><strong>${total}</strong></td>`;
    html += `<td class="score-cell ${pctClass}"><strong>${pct}%</strong></td>`;
    tr.innerHTML = html;
    tbody.appendChild(tr);
  });
}

// ═══════════════════════════════════════════
//  CREATE FORUM — wire to backend
// ═══════════════════════════════════════════

window.createForum = async function () {
  const name = document.getElementById('cf-name')?.value.trim() || window.cfData?.name;
  const subject = document.getElementById('cf-subject')?.value.trim() || window.cfData?.subject;
  const cls = document.getElementById('cf-class')?.value.trim() || window.cfData?.cls;
  if (!name || !subject || !cls) { window.showToast('⚠ Missing details — go back to Step 1'); return; }

  // Collect model answers from the UI
  const cards = document.querySelectorAll('.mar-card');
  const answers = [];
  cards.forEach((card, i) => {
    const qtEl = card.querySelector('[style*="QUESTION FROM PAPER"]');
    answers.push({
      question_num: i + 1,
      question_text: qtEl ? qtEl.nextElementSibling?.textContent?.trim() || '' : '',
      answer_text: card.querySelector('.mar-answer')?.value || '',
      keywords: card.querySelector('.mar-keywords')?.value || '',
      marks: parseInt(card.querySelector('.mar-marks')?.value) || 10,
      note: card.querySelector('.mar-comment')?.value || ''
    });
  });

  const totalMarks = parseInt(document.getElementById('cf-marks')?.value) || 100;
  const examDate = document.getElementById('cf-date')?.value || '';

  try {
    window.showToast('⏳ Creating forum…');

    // Create forum with model answers
    const forum = await apiCreateForum({
      name, subject, class_name: cls,
      exam_date: examDate, total_marks: totalMarks,
      answers
    });

    const forumId = forum.id;

    // Upload question paper if selected
    if (window.cfData?.file) {
      window.showToast('📄 Uploading question paper…');
      await apiUploadQuestionPaper(forumId, window.cfData.file);
    }

    // Upload textbook if selected
    if (window.cfData?.textbook) {
      window.showToast('📖 Uploading textbook + indexing RAG…');
      const tbResult = await apiUploadTextbook(forumId, window.cfData.textbook);
      window.showToast(`📖 Textbook indexed: ${tbResult.chunks_indexed} chunks`);
    }

    // Reset form
    ['cf-name', 'cf-subject', 'cf-class'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    window.clearFileUpload();
    document.getElementById('model-answers-list').innerHTML = '';
    window.cfData = { name: '', subject: '', cls: '', date: '', marks: 100, qcount: 5, file: null };

    // Refresh dashboard
    await loadDashboardData();
    window.showToast(`✦ Forum "${name}" created!`);
    setTimeout(() => window.switchView('forums'), 800);
  } catch (err) {
    console.error('Create forum error:', err);
    window.showToast('⚠ Failed to create forum: ' + err.message);
  }
};

// ═══════════════════════════════════════════
//  UPLOAD ANSWER SHEET — wire individual upload
// ═══════════════════════════════════════════

window.addStudentRow = function () {
  const list = document.getElementById('student-list');
  const div = document.createElement('div');
  div.className = 'student-row';
  div.innerHTML = `
    <div>
      <div class="form-group"><label>Student Name</label><input type="text" class="stu-name" placeholder="Enter student name"></div>
      <div class="form-group"><label>Register Number</label><input type="text" class="stu-reg" placeholder="Enter reg no"></div>
    </div>
    <div>
      <!-- Toggle between upload and paste -->
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem">
        <label style="display:flex;align-items:center;cursor:pointer;gap:.5rem">
          <input type="checkbox" class="stu-use-text" onchange="toggleStudentTextInput(this)" style="width:16px;height:16px;accent:var(--accent)">
          <span style="font-size:.8rem;color:var(--text-muted)">Paste answer text directly</span>
        </label>
      </div>
      
      <!-- File upload zone -->
      <div class="upload-zone stu-file-zone" style="padding:1.5rem">
        <input type="file" class="stu-file" accept="image/*,.pdf">
        <div style="font-size:1.5rem;margin-bottom:.5rem">📤</div>
        <p style="font-size:.8rem">Upload answer sheet</p>
      </div>
      
      <!-- Text paste area (hidden by default) -->
      <div class="stu-text-zone" style="display:none">
        <textarea class="stu-text-input" rows="4" placeholder="Paste student's answer text here..." style="width:100%;padding:.75rem;border:1.5px solid var(--border);border-radius:10px;background:var(--bg);color:var(--text);font-size:.85rem;line-height:1.5;resize:vertical"></textarea>
        <p style="font-size:.72rem;color:var(--text-muted);margin-top:.4rem">Paste the answer text directly. AI will grade this without OCR.</p>
      </div>
      
      <div class="stu-ocr-preview" style="display:none;margin-top:.75rem"></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:.5rem;padding-top:1.5rem">
      <button class="btn btn-primary btn-sm stu-upload-btn">📤 Upload & OCR</button>
      <button class="btn btn-ghost btn-sm stu-eval-btn" style="display:none">⚡ Evaluate</button>
    </div>`;
  list.appendChild(div);

  // Wire upload button
  const uploadBtn = div.querySelector('.stu-upload-btn');
  uploadBtn.onclick = async () => {
    if (!currentForumId) { window.showToast('⚠ No forum selected'); return; }
    const name = div.querySelector('.stu-name').value.trim();
    const reg = div.querySelector('.stu-reg').value.trim();
    const useText = div.querySelector('.stu-use-text')?.checked;
    const textInput = div.querySelector('.stu-text-input');
    const fileInput = div.querySelector('.stu-file');
    
    if (!name || !reg) { window.showToast('⚠ Enter student name and reg number'); return; }
    if (!useText && !fileInput.files[0]) { window.showToast('⚠ Select a file or paste text'); return; }

    try {
      uploadBtn.disabled = true; uploadBtn.textContent = '⏳ Processing…';
      const result = await apiUploadAnswerSheet(currentForumId, name, reg, useText ? null : fileInput.files[0], useText ? textInput?.value : null);
      const student = result.student;
      const ocrPreview = result.ocr_preview;

      // Show OCR preview
      const previewDiv = div.querySelector('.stu-ocr-preview');
      previewDiv.style.display = 'block';
      previewDiv.innerHTML = `
        <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:.5rem;font-weight:500">OCR Extracted Text Preview</div>
        <div class="ocr-result">${ocrPreview}</div>
        <div style="margin-top:.5rem"><span style="font-size:.75rem;padding:.2rem .6rem;background:rgba(34,197,94,.1);color:var(--success);border-radius:5px;font-weight:600">✓ OCR Success</span></div>`;

uploadBtn.textContent = '✅ Uploaded';
      div.dataset.studentId = student.id;

      // Show evaluate button
      const evalBtn = div.querySelector('.stu-eval-btn');
      evalBtn.style.display = '';
      evalBtn.onclick = async () => {
        try {
          evalBtn.disabled = true; evalBtn.textContent = '⏳ Grading…';
          await apiEvaluateStudent(student.id, currentForumId);
          evalBtn.textContent = '✅ Graded';
          window.showToast(`✅ ${name} graded!`);
          if (currentForumData) buildRealResultsTable(await apiGetForum(currentForumId));
        } catch (e) {
          evalBtn.disabled = false; evalBtn.textContent = '⚡ Evaluate';
          window.showToast('⚠ Grading failed: ' + e.message);
        }
      };

      window.showToast(`✅ ${name}'s sheet uploaded`);
    } catch (err) {
      uploadBtn.disabled = false; uploadBtn.textContent = useText ? '💾 Save Text' : '📤 Upload & OCR';
      window.showToast('⚠ Upload failed: ' + err.message);
    }
  };
};

// Toggle text input for student rows
window.toggleStudentTextInput = function(checkbox) {
  const row = checkbox.closest('.student-row');
  if (!row) return;
  const fileZone = row.querySelector('.stu-file-zone');
  const textZone = row.querySelector('.stu-text-zone');
  const uploadBtn = row.querySelector('.stu-upload-btn');
  
  if (checkbox.checked) {
    if (fileZone) fileZone.style.display = 'none';
    if (textZone) textZone.style.display = 'block';
    if (uploadBtn) uploadBtn.textContent = '💾 Save Text';
  } else {
    if (fileZone) fileZone.style.display = 'block';
    if (textZone) textZone.style.display = 'none';
    if (uploadBtn) uploadBtn.textContent = '📤 Upload & OCR';
  }
};

// ═══════════════════════════════════════════
//  EVALUATE ALL — wire to backend
// ═══════════════════════════════════════════

window.evaluateAll = async function () {
  if (!currentForumId) { window.showToast('⚠ No forum selected'); return; }
  const btn = document.querySelector('#view-forum-detail .action-bar .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Evaluating…'; }

  try {
    window.showToast('⚡ Starting AI evaluation — this may take a minute…');
    const result = await apiEvaluateAll(currentForumId);
    window.showToast(`✅ ${result.evaluated} students evaluated!`);

    // Refresh results
    const forum = await apiGetForum(currentForumId);
    currentForumData = forum;
    buildRealResultsTable(forum);
    await loadDashboardData();
  } catch (err) {
    console.error('Evaluate all error:', err);
    window.showToast('⚠ Evaluation failed: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Evaluate All'; }
  }
};

// ═══════════════════════════════════════════
//  EXCEL EXPORT — from backend
// ═══════════════════════════════════════════

window.downloadExcel = async function () {
  if (!currentForumId) { window.showToast('⚠ No forum selected'); return; }
  try {
    window.showToast('⏳ Generating Excel…');
    const blob = await apiExportExcel(currentForumId);
    const name = currentForumData?.name?.replace(/[^a-z0-9]/gi, '_') || 'Results';
    downloadBlob(blob, `${name}_Results.xlsx`);
    window.showToast('✦ Excel downloaded!');
  } catch (err) {
    console.error('Export error:', err);
    window.showToast('⚠ Export failed: ' + err.message);
  }
};

// ═══════════════════════════════════════════
//  PROFILE — wire save + avatar
// ═══════════════════════════════════════════

window.saveProfile = async function () {
  const first = (document.getElementById('profile-first')?.value || '').trim();
  const last = (document.getElementById('profile-last')?.value || '').trim();
  const school = (document.getElementById('profile-institution')?.value || '').trim();
  if (!first) { window.showToast('⚠ First name cannot be empty'); return; }

  try {
    await apiUpdateProfile({ first_name: first, last_name: last, school });
    if (window.currentUser) {
      window.currentUser.firstName = first;
      window.currentUser.lastName = last;
      window.currentUser.school = school;
    }
    window.updateUserUI(window.currentUser);
    window.showToast('✦ Profile saved!');
  } catch (err) {
    window.showToast('⚠ Failed to save profile: ' + err.message);
  }
};

window.handleAvatarUpload = async function (input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { window.showToast('⚠ Please select an image'); return; }
  if (file.size > 5 * 1024 * 1024) { window.showToast('⚠ Max 5MB'); return; }

  // Show preview immediately
  const reader = new FileReader();
  reader.onload = function (e) {
    const src = e.target.result;
    const bigAvatar = document.getElementById('profile-big-avatar');
    if (bigAvatar) bigAvatar.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    if (sidebarAvatar) { sidebarAvatar.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`; sidebarAvatar.style.padding = '0'; }
  };
  reader.readAsDataURL(file);

  // Upload to backend
  try {
    const result = await apiUploadAvatar(file);
    window.showToast('✦ Avatar uploaded!');
  } catch (err) {
    window.showToast('⚠ Avatar upload failed: ' + err.message);
  }
};

console.log('✅ QuickGrade backend integration loaded');
