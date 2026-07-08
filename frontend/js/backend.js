/**
 * QuickGrade — Backend Integration & Data Management
 * Handles Firebase Auth, API calls, and dynamic table rendering.
 */

import {
  auth, db, storage, googleProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
  signInWithPopup, GoogleAuthProvider,
  doc, getDoc, setDoc
} from '../firebase/firebase-config.js';

import {
  setAuthToken, getAuthToken,
  apiVerifyToken, apiGetProfile, apiUpdateProfile,
  apiListForums, apiGetForum, apiCreateForum, apiDeleteForum, apiCloseForum,
  apiEvaluateAll, apiEvaluateStudent, apiUpdateStudent, apiDeleteStudent,
  apiUploadQuestionPaper, apiUploadTextbook, apiUploadAnswerSheet, apiUploadAvatar,
  apiExportExcel, downloadBlob
} from './api.js';

// Global state for ease of access from other scripts (app.js)
window.getAuthToken = getAuthToken;

// ── AUTHENTICATION ───────────────────────────────────────────

window.handleGoogleLogin = async function () {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    setAuthToken(idToken);
    const user = await apiVerifyToken(idToken);
    window.showToast('🚀 Welcome, ' + (user.first_name || 'Teacher'));
    window.showDashboard();
  } catch (err) {
    console.error('Google Login Error:', err);
    window.showToast('❌ Login failed: ' + err.message);
  }
};

window.handleLogin = async function () {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  if (!email || !pass) return;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const idToken = await cred.user.getIdToken();
    setAuthToken(idToken);
    await apiVerifyToken(idToken);
    window.showDashboard();
  } catch (err) {
    console.warn("Auth failed, checking demo mode...");
    // Fallback for demo purposes
    setAuthToken('demo-token');
    window.isDemoMode = true;
    window.currentUser = {
      firstName: email.split('@')[0],
      lastName: '(Demo)',
      email: email,
      school: 'Demo Institution'
    };
    window.updateUserUI(window.currentUser);
    window.showDashboard();
    window.showToast('✨ Demo Mode Active');
  }
};

window.handleRegister = async function () {
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const first = document.getElementById('reg-first').value.trim();
  const last = document.getElementById('reg-last').value.trim();
  const school = document.getElementById('reg-school').value.trim();
  if (!email || !pass || !first) return;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const idToken = await cred.user.getIdToken();
    setAuthToken(idToken);
    await apiUpdateProfile({ first_name: first, last_name: last, school: school });
    await apiVerifyToken(idToken);
    window.showDashboard();
  } catch (err) {
    const errEl = document.getElementById('reg-error');
    if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
};

window.loadDemoAccount = async function () {
  window.showToast('✨ Entering demo mode...');
  // Logic to simulate or use a fixed demo token if available
  // For now, we'll just show the dashboard with dummy state if not logged in
  window.showDashboard();
};

window.handleLogout = async function () {
  try {
    await signOut(auth);
    window.showPage('landing');
  } catch (err) {
    console.error('Logout failed:', err);
  }
};

// ── PROFILE & AVATAR ──────────────────────────────────────────

window.handleAvatarUpload = async function (input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  try {
    window.showToast('⏳ Uploading avatar...');
    const result = await apiUploadAvatar(file);
    if (result.success) {
      window.showToast('✅ Avatar updated');
      window.currentUser.avatarUrl = result.url;
      window.applyAvatarEverywhere(result.url);
    }
  } catch (err) {
    window.showToast('❌ Upload failed');
  }
};

window.applyAvatarEverywhere = function (url) {
  const els = ['sidebar-avatar', 'profile-big-avatar', 'report-avatar'];
  els.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.backgroundImage = `url(${url})`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.textContent = '';
    }
  });
};

window.updateProfile = async function () {
  const data = {
    first_name: document.getElementById('profile-first').value.trim(),
    last_name: document.getElementById('profile-last').value.trim(),
    school: document.getElementById('profile-institution').value.trim()
  };
  try {
    window.showToast('⏳ Updating profile...');
    await apiUpdateProfile(data);
    window.showToast('✅ Profile saved');
    window.currentUser.firstName = data.first_name;
    window.currentUser.lastName = data.last_name;
    window.currentUser.school = data.school;
    window.updateUserUI(window.currentUser);
  } catch (err) {
    window.showToast('❌ Update failed');
  }
};

// ── DATA LOADING ──────────────────────────────────────────────

async function loadDashboardData() {
  try {
    const forums = await apiListForums();
    window.userForums = forums.map(f => ({
      id: f.id,
      name: f.name,
      subject: f.subject,
      cls: f.class_name,
      students: f.student_count || 0,
      avg: (f.avg_pct || 0) + '%',
      avgNum: f.avg_pct || 0,
      created: f.created_at ? new Date(f.created_at).toLocaleDateString() : 'recently',
      status: f.status,
      statusLabel: f.status === 'closed' ? '✓ Closed' : f.status === 'grading' ? '◐ Grading' : '● Active',
      statusClass: f.status === 'closed' ? 'badge-closed' : f.status === 'grading' ? 'badge-grading' : 'badge-active'
    }));

    // Update global stats
    const gradedCount = forums.reduce((sum, f) => sum + (f.graded_count || 0), 0);
    const totalStudents = forums.reduce((sum, f) => sum + (f.student_count || 0), 0);
    const overallAvg = forums.length ? (forums.reduce((sum, f) => sum + (f.avg_pct || 0), 0) / forums.length).toFixed(1) : 0;

    window.setText('stat-forums', forums.length);
    window.setText('stat-students', totalStudents);
    window.setText('stat-avg', overallAvg + '%');
    window.setText('stat-graded', gradedCount);

    const badge = document.getElementById('forums-badge');
    if (badge) {
      badge.textContent = forums.length;
      badge.style.display = forums.length > 0 ? 'inline-block' : 'none';
    }

    window.renderForumsUI();
    updateOverallAnalytics(forums);
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
  }
}

// ── FORUM RENDERING ───────────────────────────────────────────

window.renderForumsUI = function () {
  const forums = window.userForums || [];

  // 1. Overview Table (Dashboard)
  const overviewTbody = document.querySelector('#view-overview .table-card tbody');
  if (overviewTbody) {
    if (forums.length === 0) {
      overviewTbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:3rem;color:var(--text-muted)">
        <div style="font-size:1.5rem;margin-bottom:.5rem;opacity:.4">📂</div>
        <div>No forums yet. <span style="color:var(--accent);cursor:pointer" onclick="switchView('create')">Create one?</span></div>
      </td></tr>`;
    } else {
      overviewTbody.innerHTML = forums.map(f => `
        <tr onclick="openForumDetail('${f.id}')" style="cursor:pointer">
          <td><strong>${f.name}</strong><br><span style="font-size:.78rem;color:var(--text-muted)">Created ${f.created}</span></td>
          <td>${f.subject}</td>
          <td>${f.students}</td>
          <td>${f.avg}<div class="progress-bar"><div class="progress-fill" style="width:${f.avg}"></div></div></td>
          <td><span class="badge ${f.statusClass}">${f.statusLabel}</span></td>
          <td><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openForumDetail('${f.id}')">${f.status === 'closed' ? 'View' : 'Open'}</button></td>
        </tr>`).join('');
    }
  }

  // 2. My Forums Table
  const myBody = document.getElementById('my-forums-body');
  const myEmpty = document.getElementById('my-forums-empty');
  if (myBody && myEmpty) {
    const table = myBody.closest('table');
    if (forums.length === 0) {
      if (table) table.style.display = 'none';
      myEmpty.style.display = 'block';
    } else {
      if (table) table.style.display = '';
      myEmpty.style.display = 'none';
      myBody.innerHTML = forums.map(f => `
        <tr onclick="openForumDetail('${f.id}')" style="cursor:pointer">
          <td><strong>${f.name}</strong></td>
          <td>${f.subject}</td>
          <td>${f.cls || '-'}</td>
          <td>${f.students}</td>
          <td><span class="${f.avgNum >= 75 ? 'score-high' : f.avgNum >= 50 ? 'score-mid' : 'score-low'}">${f.avg}</span></td>
          <td style="color:var(--text-muted);font-size:.8rem">${f.created}</td>
          <td><span class="badge ${f.statusClass}">${f.statusLabel}</span></td>
          <td><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openForumDetail('${f.id}')">${f.status === 'closed' ? 'View' : 'Open'}</button></td>
        </tr>`).join('');
    }
  }
};

window.openForumDetail = async function (forumId, isRefresh = false) {
  if (!isRefresh) {
    window.currentForumId = forumId;
    window.switchView('forum-detail');
  }
  try {
    const forum = await apiGetForum(forumId);
    window.currentForumData = forum;

    // Header updates
    const h1 = document.querySelector('#view-forum-detail h1');
    if (h1) h1.textContent = forum.name;
    const breadcrumb = document.querySelector('#view-forum-detail .breadcrumb');
    if (breadcrumb) breadcrumb.innerHTML = `<a onclick="switchView('forums')" style="cursor:pointer">My Forums</a> <span>/</span> ${forum.name}`;

    const meta = document.querySelector('#view-forum-detail .main-header div[style*="display:flex"]');
    if (meta) {
      const statusMap = { active: 'badge-active', grading: 'badge-grading', closed: 'badge-closed' };
      meta.innerHTML = `
        <span style="font-size:.85rem;color:var(--text-muted);margin-right:1rem">${forum.subject} • ${forum.class_name} • ${forum.total_marks} marks</span>
        <span class="badge ${statusMap[forum.status] || 'badge-active'}">${forum.status === 'closed' ? '✓ Closed' : forum.status === 'grading' ? '◐ Grading' : '● Active'}</span>`;
    }

    window.buildRealResultsTable(forum);
    window.updateForumAnalytics(forum);

    // Clear student upload list ONLY if it's a fresh open, not a refresh
    if (!isRefresh) {
      const list = document.getElementById('student-list');
      if (list) list.innerHTML = '';
    }
  } catch (err) {
    console.error('Failed to load forum:', err);
    window.showToast('⚠ Failed to load forum details');
  }
};

window.createForum = async function () {
  const name = document.getElementById('cf-name')?.value.trim();
  const subject = document.getElementById('cf-subject')?.value.trim();
  const cls = document.getElementById('cf-class')?.value.trim();
  const marks = parseInt(document.getElementById('cf-marks')?.value) || 100;

  if (!name || !subject || !cls) {
    window.showToast('⚠ Please fill all forum details in Step 1');
    return;
  }

  // Gather model answers from Step 3 cards
  const cards = document.querySelectorAll('.mar-card');
  const answers = Array.from(cards).map(card => ({
    question_num: parseInt(card.dataset.qnum),
    question_text: card.querySelector('[style*="QUESTION FROM PAPER"]')?.nextElementSibling?.textContent?.trim() || '',
    answer_text: card.querySelector('.mar-answer').value.trim(),
    keywords: card.querySelector('.mar-keywords').value.trim(),
    marks: parseInt(card.querySelector('.mar-marks').value) || 0,
    note: card.querySelector('.mar-comment')?.value.trim() || ''
  }));

  try {
    window.showToast('⏳ Creating forum...');
    await apiCreateForum({
      name, subject,
      class_name: cls,
      total_marks: marks,
      answers: answers
    });
    window.showToast('✦ Forum created successfully!');
    await loadDashboardData();
    window.switchView('forums');
  } catch (err) {
    console.error('Forum creation failed:', err);
    let msg = err.message || 'Unknown error';
    if (typeof err.detail === 'object') msg = JSON.stringify(err.detail);
    window.showToast('❌ Create failed: ' + msg);
  }
};

window.buildRealResultsTable = function (forum) {
  const tbody = document.getElementById('results-body');
  const thead = document.getElementById('results-thead-row');
  if (!tbody || !thead) return;

  const students = forum.students || [];
  const answers = forum.answers || [];

  // Rebuild header
  thead.innerHTML = `<th>Reg No</th><th>Name</th>`;
  answers.forEach(a => { thead.innerHTML += `<th style="text-align:center">Q${a.question_num} <span style="font-size:.7rem;opacity:.5">/${a.marks}</span></th>`; });
  thead.innerHTML += `<th style="text-align:center">Total</th><th style="text-align:center">%</th>`;

  // Rebuild body
  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${answers.length + 4}" style="text-align:center;padding:2rem;color:var(--text-muted)">No students graded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => {
    const scores = s.scores || {};
    const pct = s.percentage || 0;
    const pctClass = pct >= 75 ? 'score-high' : pct >= 50 ? 'score-mid' : 'score-low';
    let html = `<tr onclick="window.showStudentReport(${JSON.stringify(s).replace(/"/g, '&quot;')}, ${JSON.stringify(forum).replace(/"/g, '&quot;')})" style="cursor:pointer">
                  <td style="font-size:.85rem;color:var(--text-muted)">${s.reg_number}</td>
                  <td><strong>${s.name}</strong></td>`;
    answers.forEach(a => {
      const score = scores[`Q${a.question_num}`] !== undefined ? scores[`Q${a.question_num}`] : '—';
      html += `<td class="score-cell">${score}</td>`;
    });
    html += `<td class="score-cell"><strong>${s.total || 0}</strong></td>`;
    html += `<td class="score-cell ${pctClass}"><strong>${pct}%</strong></td></tr>`;
    return html;
  }).join('');
};

// ── STUDENT REPORT MODAL ─────────────────────────────────────

window.showStudentReport = function (student, forum) {
  const modal = document.getElementById('modal-student-report');
  if (!modal) return;
  window.editingStudentId = student.id;
  window.editingForumData = forum;

  document.getElementById('report-name').textContent = student.name || 'Unknown';
  document.getElementById('report-reg').textContent = `Reg No: ${student.reg_number || '—'}`;
  document.getElementById('report-avatar').textContent = (student.name || 'S')[0].toUpperCase();

  const pct = student.percentage || 0;
  const pctBadge = document.getElementById('report-pct-badge');
  pctBadge.textContent = `${pct}%`;
  pctBadge.className = 'badge ' + (pct >= 75 ? 'badge-active' : pct >= 50 ? 'badge-grading' : 'badge-closed');

  const grid = document.getElementById('report-scores-grid');
  const answers = forum.answers || [];
  const scores = student.scores || {};
  grid.innerHTML = answers.map(a => {
    const qScore = scores[`Q${a.question_num}`] !== undefined ? scores[`Q${a.question_num}`] : 0;
    return `<div class="score-item">
        <span class="q-num">Q${a.question_num} <span style="opacity:.5">(Max ${a.marks})</span></span>
        <input type="number" class="score-input" data-qnum="${a.question_num}" data-max="${a.marks}" value="${qScore}" oninput="window.recalcModalTotal()">
      </div>`;
  }).join('');

  document.getElementById('report-total-val').textContent = `${student.total || 0} / ${forum.total_marks || 100}`;
  document.getElementById('report-feedback-input').value = (student.feedback || '').replace(/ \| /g, '\n');
  modal.classList.add('active');
};

window.recalcModalTotal = function () {
  const inputs = document.querySelectorAll('.score-input');
  let total = 0;
  inputs.forEach(input => { total += parseInt(input.value) || 0; });
  const max = window.editingForumData?.total_marks || 100;
  document.getElementById('report-total-val').textContent = `${total} / ${max}`;
  const pct = Math.round((total / max) * 100);
  const badge = document.getElementById('report-pct-badge');
  if (badge) badge.textContent = `${pct}%`;
};

window.saveStudentChanges = async function () {
  const studentId = window.editingStudentId;
  if (!studentId) return;
  const inputs = document.querySelectorAll('.score-input');
  const scores = {};
  let total = 0;
  inputs.forEach(i => { scores[`Q${i.dataset.qnum}`] = parseInt(i.value) || 0; total += (parseInt(i.value) || 0); });
  const feedback = document.getElementById('report-feedback-input').value.replace(/\n/g, ' | ');
  const max = window.editingForumData?.total_marks || 100;
  const pct = Math.round((total / max) * 100);
  try {
    window.showToast('⏳ Saving...');
    await apiUpdateStudent(studentId, { scores, total, percentage: pct, feedback, status: 'graded' });
    window.showToast('✅ Saved');
    window.closeModal('modal-student-report');
    const updated = await apiGetForum(window.currentForumId);
    window.currentForumData = updated;
    window.buildRealResultsTable(updated);
  } catch (err) { window.showToast('❌ Save failed'); }
};

window.confirmDeleteStudent = async function () {
  if (!confirm('Delete this student record?')) return;
  try {
    await apiDeleteStudent(window.editingStudentId);
    window.showToast('🗑 Deleted');
    window.closeModal('modal-student-report');
    const updated = await apiGetForum(window.currentForumId);
    window.buildRealResultsTable(updated);
  } catch (err) { window.showToast('❌ Delete failed'); }
};

// ── UTILS ────────────────────────────────────────────────────

window.evaluateAll = async function () {
  if (!window.currentForumId) return;
  try {
    window.showToast('⚡ AI Grading started...');
    await apiEvaluateAll(window.currentForumId);
    window.showToast('✅ Grading complete');
    const updated = await apiGetForum(window.currentForumId);
    window.buildRealResultsTable(updated);
  } catch (err) { window.showToast('❌ Evaluation failed'); }
};

window.downloadExcel = async function () {
  if (!window.currentForumId) return;
  try {
    window.showToast('⏳ Generating Excel...');
    const blob = await apiExportExcel(window.currentForumId);
    downloadBlob(blob, `Results_${window.currentForumData.name || 'Forum'}.xlsx`);
    window.showToast('✅ Downloaded');
  } catch (err) { window.showToast('❌ Export failed'); }
};

// ── INITIALIZATION ───────────────────────────────────────────

async function initBackendApp() {
  const loader = document.getElementById('initial-loader');
  if (loader) loader.style.display = 'flex';
  onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      console.log('✅ User authenticated');
      setAuthToken(await fbUser.getIdToken());
      try {
        const profile = await apiGetProfile();
        window.currentUser = {
          firstName: profile.first_name || fbUser.email.split('@')[0],
          lastName: profile.last_name || '',
          email: fbUser.email,
          school: profile.school || 'Your School'
        };
        window.updateUserUI(window.currentUser);
        await loadDashboardData();
        const active = document.querySelector('.page.active')?.id;
        // Only auto-redirect to dashboard if we are NOT on a legitimate landing/login page or if explicitly requested
        if (!active) window.showPage('landing');
      } catch (err) { 
        if (!window.isDemoMode) window.showPage('login'); 
      }
    } else {
      const active = document.querySelector('.page.active')?.id;
      if (active && !['landing', 'login', 'register'].includes(active)) window.showPage('login');
    }
    if (loader) loader.style.display = 'none';
  });
}

window.updateForumAnalytics = function (forum) {
  const students = forum.students || [];
  if (students.length === 0) return;

  // 1. Overall Stats
  const avg = (forum.avg_pct || 0);
  const highest = Math.max(...students.map(s => s.percentage || 0));
  const lowest = Math.min(...students.map(s => s.percentage || 0));
  const passCount = students.filter(s => (s.percentage || 0) >= 40).length;
  const passPct = Math.round((passCount / students.length) * 100);

  const cards = document.querySelector('#tab-forum-analytics .analytics-card');
  if (cards) {
    const vals = cards.querySelectorAll('.value');
    if (vals.length >= 5) {
      vals[0].textContent = avg + '%';
      vals[1].textContent = highest + '%';
      vals[2].textContent = lowest + '%';
      vals[3].textContent = passPct + '%';
      vals[4].textContent = `${students.length} / ${students.length}`;
    }
  }

  // 2. Marks Distribution (Bar Chart)
  const barChart = document.getElementById('bar-chart');
  if (barChart) {
    barChart.innerHTML = students.map(s => {
      const h = (s.percentage || 0);
      const color = h >= 75 ? 'var(--success)' : h >= 50 ? 'var(--accent)' : 'var(--danger)';
      return `<div style="flex:1;height:${h}%;background:${color};border-radius:4px 4px 0 0;min-width:12px;position:relative" title="${s.name}: ${h}%"></div>`;
    }).join('');
  }

  // 3. Question-wise Averages (Horizontal Bars)
  const hbarContainer = document.querySelector('.hbar-chart');
  if (hbarContainer && forum.answers) {
    const qStats = {};
    forum.answers.forEach(a => {
      const qKey = `Q${a.question_num}`;
      const sum = students.reduce((acc, s) => acc + (s.scores?.[qKey] || 0), 0);
      qStats[qKey] = Math.round((sum / (students.length * a.marks)) * 100);
    });

    hbarContainer.innerHTML = Object.entries(qStats).map(([q, pct]) => `
      <div style="margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:.3rem;font-weight:600">
          <span>${q} Accuracy</span>
          <span>${pct}%</span>
        </div>
        <div style="height:6px;background:rgba(255,255,255,.05);border-radius:10px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg, var(--accent), var(--accent2));border-radius:10px"></div>
        </div>
      </div>`).join('');
  }
};
function updateOverallAnalytics(forums) {
  const aEmpty = document.getElementById('analytics-empty');
  const aData = document.getElementById('analytics-data');
  if (aEmpty && aData) {
    aEmpty.style.display = forums.length === 0 ? 'block' : 'none';
    aData.style.display = forums.length === 0 ? 'none' : 'block';
  }
}

window.addEventListener('load', initBackendApp);