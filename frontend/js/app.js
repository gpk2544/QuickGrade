/* QuickGrade — App Logic */

  // ── User forums data ──
  window.userForums = window.userForums || []; // shared with backend.js

  function renderForumsUI() {
    const count = window.userForums.length;

    // Sidebar badge
    const badge = document.getElementById('forums-badge');
    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-block' : 'none'; }

    // My Forums table
    const myBody  = document.getElementById('my-forums-body');
    const myEmpty = document.getElementById('my-forums-empty');
    if (myBody && myEmpty) {
      const table = myBody.closest('table');
      if (count === 0) {
        if (table) table.style.display = 'none';
        myEmpty.style.display = 'block';
      } else {
        if (table) table.style.display = '';
        myEmpty.style.display = 'none';
        myBody.innerHTML = window.userForums.map(f => `
          <tr>
            <td><strong>${f.name}</strong></td>
            <td>${f.subject}</td>
            <td>${f.cls}</td>
            <td>${f.students}</td>
            <td><span class="${f.avgNum >= 75 ? 'score-high' : f.avgNum >= 50 ? 'score-mid' : 'score-low'}">${f.avg}</span></td>
            <td style="color:var(--text-muted);font-size:.85rem">${f.created}</td>
            <td><span class="badge ${f.statusClass}">${f.statusLabel}</span></td>
            <td><button class="btn btn-outline btn-sm" onclick="switchView('forum-detail')">${f.status === 'closed' ? 'View' : 'Open'}</button></td>
          </tr>`).join('');
      }
    }

    // Analytics toggle
    const aEmpty = document.getElementById('analytics-empty');
    const aData  = document.getElementById('analytics-data');
    if (aEmpty && aData) {
      aEmpty.style.display = count === 0 ? 'block' : 'none';
      aData.style.display  = count === 0 ? 'none'  : 'block';
    }

    // Dashboard overview table
    const overviewTbody = document.querySelector('#view-overview .table-card tbody');
    if (overviewTbody) {
      if (count === 0) {
        overviewTbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:3rem;color:var(--text-muted)">
          <div style="font-size:1.5rem;margin-bottom:.5rem;opacity:.4">📂</div>
          <div>No forums yet. <span style="color:var(--accent);cursor:pointer;font-weight:600" onclick="switchView('create')">Create your first →</span></div>
        </td></tr>`;
      } else {
        overviewTbody.innerHTML = window.userForums.map(f => `
          <tr onclick="switchView('forum-detail')" style="cursor:pointer">
            <td><strong>${f.name}</strong><br><span style="font-size:.78rem;color:var(--text-muted)">${f.created}</span></td>
            <td>${f.subject}</td>
            <td>${f.students}</td>
            <td>${f.avg}<div class="progress-bar"><div class="progress-fill" style="width:${f.avg}"></div></div></td>
            <td><span class="badge ${f.statusClass}">${f.statusLabel}</span></td>
            <td><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();switchView('forum-detail')">${f.status === 'closed' ? 'View' : 'Open'}</button></td>
          </tr>`).join('');
      }
    }
  }


  // ── Save Profile ──
  function saveProfile() {
    const first = (document.getElementById('profile-first')?.value || '').trim();
    const last  = (document.getElementById('profile-last')?.value || '').trim();
    const email = (document.getElementById('profile-email')?.value || '').trim();
    const school = (document.getElementById('profile-institution')?.value || '').trim();

    if (!first) { showToast('⚠ First name cannot be empty'); return; }

    // Update currentUser
    if (currentUser) {
      currentUser.firstName = first;
      currentUser.lastName  = last;
      currentUser.email     = email || currentUser.email;
      currentUser.school    = school || currentUser.school;
      currentUser.isNew     = false;
    } else {
      currentUser = { firstName: first, lastName: last, email, school, isNew: false };
    }

    // Re-render all UI with new name
    updateUserUI(currentUser);
    showToast('✦ Profile saved successfully!');
  }

  function updateUserUI(user) {
    const fullName = (user.firstName + ' ' + user.lastName).trim();
    const initials = ((user.firstName[0] || '') + (user.lastName[0] || '')).toUpperCase() || '?';
    const joinDate = new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    const isNewUser = user.isNew !== false; // true by default for new registrations

    // ── Sidebar ──
    const sAvatar = document.getElementById('sidebar-avatar');
    if (sAvatar) sAvatar.textContent = initials;
    const sName = document.getElementById('sidebar-name');
    if (sName) sName.textContent = fullName;

    // ── Dashboard greeting ──
    const greet = document.getElementById('dash-greeting');
    if (greet) greet.textContent = 'Good morning, ' + user.firstName + ' 👋';

    // ── Dashboard stats — reset to 0 for new users ──
    if (isNewUser) {
      setText('stat-forums', '0');
      setText('stat-forums-sub', 'No forums yet');
      setText('stat-students', '0');
      setText('stat-students-sub', 'No students yet');
      setText('stat-avg', '—');
      setText('stat-avg-sub', 'No data yet');
      setText('stat-graded', '0');
      setText('stat-graded-sub', 'No sheets yet');
    }

    // ── Profile page ──
    setText('profile-big-avatar', initials);
    setText('profile-big-name', fullName);
    setText('profile-school-line', '📍 ' + (user.school || 'Not set'));
    setText('profile-since', '📅 Member since ' + joinDate);

    // Profile form fields
    setVal('profile-first', user.firstName);
    setVal('profile-last', user.lastName);
    setVal('profile-email', user.email);
    setVal('profile-institution', user.school || '');

    // Re-render forums/analytics based on actual user data
    renderForumsUI();
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  }

  function handleRegister() {
    const first = document.getElementById('reg-first').value.trim();
    const last  = document.getElementById('reg-last').value.trim();
    const school = document.getElementById('reg-school').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass  = document.getElementById('reg-pass').value;
    const pass2 = document.getElementById('reg-pass2').value;
    const errEl = document.getElementById('reg-error');

    // Validation
    if (!first || !last) { errEl.textContent = 'Please enter your first and last name.'; errEl.style.display = 'block'; return; }
    if (!email || !email.includes('@')) { errEl.textContent = 'Please enter a valid email address.'; errEl.style.display = 'block'; return; }
    if (pass.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; errEl.style.display = 'block'; return; }
    if (pass !== pass2) { errEl.textContent = 'Passwords do not match. Please try again.'; errEl.style.display = 'block'; return; }

    errEl.style.display = 'none';
    currentUser = { firstName: first, lastName: last, school, email, isNew: true };
    updateUserUI(currentUser);
    showDashboard();
  }

  // ══════════════════════════════════
  // DEMO ACCOUNT
  // ══════════════════════════════════
  function loadDemoAccount() {
    currentUser = {
      firstName: 'Demo',
      lastName: 'Teacher',
      school: 'Jeppiaar Institute of Technology',
      email: 'demo@quickgrade.app',
      isNew: false
    };

    window.userForums = [
      {
        name: 'Mid-Term Exam 2025',
        subject: 'Mathematics',
        cls: 'Class 10-A',
        students: 42,
        avg: '78.4%',
        avgNum: 78.4,
        created: '3 days ago',
        status: 'active',
        statusLabel: '● Active',
        statusClass: 'badge-active'
      },
      {
        name: 'Unit Test — Kinematics',
        subject: 'Physics',
        cls: 'Class 11-B',
        students: 38,
        avg: '65.1%',
        avgNum: 65.1,
        created: '1 week ago',
        status: 'grading',
        statusLabel: '◐ Grading',
        statusClass: 'badge-grading'
      },
      {
        name: 'Chapter 5 Quiz',
        subject: 'Chemistry',
        cls: 'Class 10-B',
        students: 44,
        avg: '81.7%',
        avgNum: 81.7,
        created: '2 weeks ago',
        status: 'closed',
        statusLabel: '✓ Closed',
        statusClass: 'badge-closed'
      },
      {
        name: 'Annual Exam — English',
        subject: 'English',
        cls: 'Class 12-A',
        students: 35,
        avg: '72.3%',
        avgNum: 72.3,
        created: '3 weeks ago',
        status: 'closed',
        statusLabel: '✓ Closed',
        statusClass: 'badge-closed'
      }
    ];

    // Update dashboard stat cards for demo
    setText('stat-forums', '4');
    setText('stat-forums-sub', '↑ 1 this week');
    setText('stat-students', '159');
    setText('stat-students-sub', '↑ 35 new');
    setText('stat-avg', '74.4%');
    setText('stat-avg-sub', '↑ 1.2% vs last');
    setText('stat-graded', '144');
    setText('stat-graded-sub', '↑ 15 pending');

    // Profile stats
    setText('profile-stat-forums', '4');
    setText('profile-stat-students', '159');
    setText('profile-stat-forums2', '4');
    setText('profile-stat-students2', '159');
    setText('profile-stat-graded', '144');

    updateUserUI(currentUser);
    showDashboard();
    showToast('⚡ Demo account loaded! Explore freely.');
  }

  function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-pass').value;
    const errEl = document.getElementById('login-error');

    if (!email || !email.includes('@')) { errEl.textContent = 'Please enter a valid email address.'; errEl.style.display = 'block'; return; }
    if (!pass) { errEl.textContent = 'Please enter your password.'; errEl.style.display = 'block'; return; }

    errEl.style.display = 'none';
    if (!currentUser) {
      // Derive a clean display name from email prefix (strip numbers/symbols)
      const prefix = email.split('@')[0];
      const cleaned = prefix.replace(/[0-9_.\-]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
      const parts = cleaned.split(' ').filter(Boolean);
      currentUser = {
        firstName: parts[0] || 'User',
        lastName: parts.slice(1).join(' ') || '',
        school: 'Your School',
        email,
        isNew: false
      };
    }
    updateUserUI(currentUser);
    showDashboard();
  }

  // ── Avatar image upload ──
  let userAvatarDataURL = null;

  function handleAvatarUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('⚠ Image too large — max 5MB'); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
      userAvatarDataURL = e.target.result;
      applyAvatarEverywhere(userAvatarDataURL);
      showToast('✦ Profile photo updated!');
    };
    reader.readAsDataURL(file);
  }

  function applyAvatarEverywhere(src) {
    // Profile page big avatar
    const bigAvatar = document.getElementById('profile-big-avatar');
    if (bigAvatar) {
      bigAvatar.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    }
    // Sidebar small avatar
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    if (sidebarAvatar) {
      sidebarAvatar.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      sidebarAvatar.style.padding = '0';
    }
  }
  function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // Clear forms when navigating to auth pages
    if (id === 'register') {
      ['reg-first','reg-last','reg-school','reg-email','reg-pass','reg-pass2'].forEach(fid => {
        const el = document.getElementById(fid); if (el) el.value = '';
      });
      const err = document.getElementById('reg-error'); if (err) err.style.display = 'none';
    }
    if (id === 'login') {
      ['login-email','login-pass'].forEach(fid => {
        const el = document.getElementById(fid); if (el) el.value = '';
      });
      const err = document.getElementById('login-error'); if (err) err.style.display = 'none';
    }
  }

  function showDashboard() {
    showPage('dashboard');
    switchView('overview');
    renderForumsUI();
  }

  // ── Dashboard view switching ──
  function switchView(name) {
    document.querySelectorAll('.main-area').forEach(v => v.classList.remove('active'));
    const el = document.getElementById('view-' + name);
    if (el) el.classList.add('active');
    // Update sidebar active
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const items = document.querySelectorAll('.nav-item');
    if (name === 'overview' && items[0]) items[0].classList.add('active');
    if (name === 'create' && items[1]) items[1].classList.add('active');
    if (name === 'forums' && items[2]) items[2].classList.add('active');
    if (name === 'analytics' && items[3]) items[3].classList.add('active');

    // Always reset create forum wizard to step 1
    if (name === 'create') goCreateStep(1);

    if (name === 'forum-detail') {
      buildBarChart();
      buildResultsTable();
    }
  }

  // ── Forum tabs ──
  function switchTab(tabEl, tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabEl.classList.add('active');
    ['tab-results','tab-upload','tab-forum-analytics'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = (id === tabId) ? 'block' : 'none';
    });
    if (tabId === 'tab-forum-analytics') buildBarChart();
  }

  // ── Create wizard steps ──
  function goCreateStep(n) {
    [1,2,3].forEach(i => {
      const stepEl = document.getElementById('create-step' + i);
      const ws = document.getElementById('ws' + i);
      if (stepEl) stepEl.style.display = (i === n) ? 'block' : 'none';
      if (ws) {
        ws.classList.remove('done','current');
        if (i < n) ws.classList.add('done');
        else if (i === n) ws.classList.add('current');
      }
    });
    // When entering step 3, rebuild question cards
    if (n === 3) buildModelAnswers();
  }

  // ══ CREATE FORUM STATE ══
  let cfData = { name:'', subject:'', cls:'', date:'', marks:100, qcount:5, file:null };
  let qCount = 0;

  function validateStep1() {
    const name    = document.getElementById('cf-name').value.trim();
    const subject = document.getElementById('cf-subject').value.trim();
    const cls     = document.getElementById('cf-class').value.trim();
    const errEl   = document.getElementById('cf-step1-err');
    if (!name || !subject || !cls) { errEl.textContent = 'Please fill in Forum Name, Subject and Class.'; errEl.style.display='block'; return; }
    errEl.style.display = 'none';
    cfData.name=name; cfData.subject=subject; cfData.cls=cls;
    cfData.date = document.getElementById('cf-date').value;
    goCreateStep(2);
  }

  function handleFileSelect(input) {
    if (input.files && input.files[0]) showFilePreview(input.files[0]);
  }
  function handleFileDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) showFilePreview(file);
    document.getElementById('upload-zone-s2').style.borderColor = '';
  }
  function showFilePreview(file) {
    cfData.file = file;
    const ext  = file.name.split('.').pop().toLowerCase();
    const icon = ext==='pdf' ? '📑' : ['jpg','jpeg','png'].includes(ext) ? '🖼️' : '📄';
    const size = file.size>1024*1024 ? (file.size/1024/1024).toFixed(1)+' MB' : (file.size/1024).toFixed(0)+' KB';
    document.getElementById('file-icon-preview').textContent = icon;
    document.getElementById('file-name-preview').textContent = file.name;
    document.getElementById('file-size-preview').textContent = size+' · '+ext.toUpperCase();
    document.getElementById('upload-icon-s2').textContent = '✅';
    document.getElementById('upload-title-s2').textContent = 'File ready!';
    document.getElementById('upload-sub-s2').textContent = file.name;
    document.getElementById('upload-zone-s2').style.borderColor = 'var(--accent)';
    document.getElementById('upload-zone-s2').style.background  = 'rgba(0,229,184,.04)';
    const box = document.getElementById('file-preview-box');
    box.style.display = 'flex';
  }
  function clearFileUpload() {
    cfData.file = null;
    const fi = document.getElementById('cf-file'); if(fi) fi.value='';
    document.getElementById('upload-icon-s2').textContent  = '📄';
    document.getElementById('upload-title-s2').textContent = 'Drop your question paper here';
    document.getElementById('upload-sub-s2').textContent   = 'Supports PDF, JPG, PNG — max 20MB';
    document.getElementById('upload-zone-s2').style.borderColor = '';
    document.getElementById('upload-zone-s2').style.background  = '';
    document.getElementById('file-preview-box').style.display   = 'none';
  }

  // Toggle paste text mode
  window.togglePasteText = function() {
    const checkbox = document.getElementById('use-paste-text');
    const pasteBox = document.getElementById('paste-text-box');
    const uploadZone = document.getElementById('upload-zone-s2');
    
    if (checkbox && checkbox.checked) {
      if (pasteBox) pasteBox.style.display = 'block';
      if (uploadZone) uploadZone.style.opacity = '0.4';
      cfData.useTextInput = true;
    } else {
      if (pasteBox) pasteBox.style.display = 'none';
      if (uploadZone) uploadZone.style.opacity = '1';
      cfData.useTextInput = false;
      cfData.textInput = '';
    }
  };
  
  // Get text input
  window.getTextInput = function() {
    const ta = document.getElementById('cf-text-input');
    return ta ? ta.value : '';
  };

  function handleTextbookSelect(input) {
    if (!input.files || !input.files[0]) return;
    showTextbookPreview(input.files[0]);
  }
  function handleTextbookDrop(event) {
    event.preventDefault();
    document.getElementById('upload-zone-textbook').style.borderColor = '';
    const file = event.dataTransfer.files[0];
    if (file) showTextbookPreview(file);
  }
  function showTextbookPreview(file) {
    if (!file.name.endsWith('.pdf')) { showToast('⚠ Textbook must be a PDF file'); return; }
    cfData.textbook = file;
    const mb = (file.size / 1048576).toFixed(1);
    document.getElementById('tb-name').textContent = file.name;
    document.getElementById('tb-size').textContent = mb + ' MB • PDF Textbook';
    document.getElementById('tb-preview-box').style.display = 'flex';
    document.getElementById('upload-zone-textbook').style.borderColor = 'var(--accent2)';
    document.getElementById('tb-icon').textContent = '✅';
    document.getElementById('tb-title').textContent = 'Textbook ready!';
    showToast('📖 Textbook uploaded — AI model will use this for grading');
  }
  function clearTextbook() {
    cfData.textbook = null;
    const ti = document.getElementById('cf-textbook'); if(ti) ti.value='';
    document.getElementById('tb-icon').textContent = '📖';
    document.getElementById('tb-title').textContent = 'Drop your textbook PDF here';
    document.getElementById('tb-preview-box').style.display = 'none';
    document.getElementById('upload-zone-textbook').style.borderColor = '';
  }

  function syncQuestionCount(val) {
    cfData.qcount = parseInt(val)||1;
  }

  function buildModelAnswers() {
    runAIExtraction();
  }

  function reExtractQuestions() {
    runAIExtraction();
  }

  async function runAIExtraction() {
    const list = document.getElementById('model-answers-list');
    list.innerHTML = '';
    document.getElementById('ai-source-badge').style.display = 'none';
    document.getElementById('btn-reextract').style.display = 'none';

    if (!cfData.file) {
      // No file uploaded — show blank cards
      const count = parseInt(document.getElementById('cf-qcount')?.value) || 5;
      cfData.qcount = count; qCount = count;
      document.getElementById('step3-subtitle').textContent = 'No question paper uploaded — fill answers manually';
      for (let i = 1; i <= count; i++) list.appendChild(createQuestionCard(i, {}));
      return;
    }

    // Show AI loading state
    document.getElementById('step3-subtitle').textContent = 'Analyzing your question paper with AI…';
    list.innerHTML = `
      <div style="background:var(--surface);border:1.5px solid var(--accent);border-radius:18px;padding:2.5rem;text-align:center">
        <div style="font-size:2.5rem;margin-bottom:.75rem;animation:spin 2s linear infinite;display:inline-block">🤖</div>
        <div style="font-family:'Barlow',sans-serif;font-weight:800;font-size:1.15rem;color:var(--accent);margin-bottom:.4rem">Extracting Questions…</div>
        <div id="ai-status-msg" style="color:var(--text-muted);font-size:.88rem;margin-bottom:1.25rem">Reading your question paper</div>
        <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;max-width:320px;margin:0 auto">
          <div id="ai-prog" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent),#4f8ef7);border-radius:2px;transition:width .4s ease"></div>
        </div>
      </div>`;

    const msgs = ['Reading your question paper…','Identifying questions…','Generating model answers…','Extracting keywords…','Calculating marks…','Almost done…'];
    let prog = 0, msgIdx = 0;
    const iv = setInterval(() => {
      prog = Math.min(prog + Math.random() * 12, 88);
      const bar = document.getElementById('ai-prog');
      const msg = document.getElementById('ai-status-msg');
      if (bar) bar.style.width = prog + '%';
      if (msg && msgIdx < msgs.length) { msg.textContent = msgs[msgIdx++]; }
    }, 700);

    try {
      const questions = await extractQuestionsFromPaper(cfData.file);
      clearInterval(iv);
      const bar = document.getElementById('ai-prog');
      if (bar) { bar.style.width = '100%'; bar.style.background = 'var(--accent)'; }
      await new Promise(r => setTimeout(r, 350));

      list.innerHTML = '';
      cfData.qcount = questions.length;
      qCount = questions.length;
      questions.forEach((q, i) => list.appendChild(createQuestionCard(i + 1, q)));

      document.getElementById('step3-subtitle').textContent = `${questions.length} questions extracted — review and edit below`;
      document.getElementById('ai-source-badge').style.display = 'inline-flex';
      document.getElementById('btn-reextract').style.display = 'inline-flex';
      showToast(`✅ ${questions.length} questions auto-filled by AI`);

    } catch (err) {
      clearInterval(iv);
      console.error('AI extraction failed:', err);
      const count = parseInt(document.getElementById('cf-qcount')?.value) || 5;
      list.innerHTML = '';
      cfData.qcount = count; qCount = count;
      for (let i = 1; i <= count; i++) list.appendChild(createQuestionCard(i, {}));
      document.getElementById('step3-subtitle').textContent = 'AI extraction failed — fill answers manually';
      showToast('⚠ Could not auto-extract — fill manually');
    }
  }

  async function extractQuestionsFromPaper(file) {
    const subject = cfData.subject || 'General';
    const totalMks = cfData.marks || 100;
    const token = window.getAuthToken ? window.getAuthToken() : '';
    
    if (!token) throw new Error('Not authenticated');

    // Check if using text input mode
    const useText = cfData.useTextInput;
    const textInput = useText ? window.getTextInput() : '';

    const formData = new FormData();
    
    if (useText && textInput) {
      // Direct text paste - bypass OCR
      formData.append('text', textInput);
    } else if (file) {
      // File upload - needs OCR
      formData.append('file', file);
    } else {
      throw new Error('No input provided');
    }
    
    formData.append('subject', subject);
    formData.append('total_marks', totalMks.toString());

    const res = await fetch('http://localhost:8000/extract/questions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Extraction failed');
    }

    const data = await res.json();
    return data.data || [];
  }

  function createQuestionCard(num, data) {
    const div = document.createElement('div');
    div.className = 'mar-card';
    div.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.5rem;margin-bottom:1rem;transition:border-color .2s';
    div.dataset.qnum = num;

    // Show extracted question text if available
    const qText = data.question ? `
      <div style="background:rgba(0,229,184,.05);border:1px solid rgba(0,229,184,.18);border-radius:10px;padding:.85rem 1rem;margin-bottom:1rem">
        <div style="font-size:.7rem;font-weight:800;color:var(--accent);letter-spacing:.08em;margin-bottom:.35rem;display:flex;align-items:center;gap:.4rem">
          <span>📋</span> QUESTION FROM PAPER
        </div>
        <div style="font-size:.9rem;color:var(--text);line-height:1.65;font-weight:500">${data.question}</div>
      </div>` : '';

    div.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
        <div style="display:flex;align-items:center;gap:.75rem">
          <span class="q-badge" style="background:rgba(0,229,184,.15);color:var(--accent);font-family:'Barlow',sans-serif;font-weight:800;font-size:.85rem;padding:.3rem .8rem;border-radius:8px">Q ${num}</span>
          <span class="mar-marks-label" style="font-size:.8rem;color:var(--text-muted)">${data.marks||10} marks</span>
        </div>
        <div style="display:flex;gap:.5rem">
          <button onclick="toggleComment(this)" style="background:rgba(79,142,247,.12);border:none;color:#4f8ef7;padding:.35rem .75rem;border-radius:7px;cursor:pointer;font-size:.78rem;font-weight:600">💬 Note</button>
          <button onclick="duplicateQuestion(this)" style="background:rgba(0,229,184,.1);border:none;color:var(--accent);padding:.35rem .75rem;border-radius:7px;cursor:pointer;font-size:.78rem;font-weight:600">⎘ Dupe</button>
          <button onclick="deleteQuestion(this)" style="background:rgba(239,68,68,.1);border:none;color:var(--danger);padding:.35rem .75rem;border-radius:7px;cursor:pointer;font-size:.78rem;font-weight:600">🗑 Delete</button>
        </div>
      </div>
      ${qText}
      <div class="form-group">
        <label>Model Answer</label>
        <textarea class="mar-answer" rows="${data.answer ? 4 : 3}" placeholder="Write the ideal answer for Q${num}…" style="resize:vertical;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;padding:.75rem 1rem;color:var(--text);font-family:'DM Sans',sans-serif;width:100%;outline:none;box-sizing:border-box;line-height:1.6">${data.answer||''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Keywords (comma-separated)</label>
          <input type="text" class="mar-keywords" value="${data.keywords||''}" placeholder="keyword1, keyword2…" style="background:var(--bg);border:1.5px solid var(--border);border-radius:10px;padding:.75rem 1rem;color:var(--text);width:100%;outline:none">
        </div>
        <div class="form-group">
          <label>Marks for this question</label>
          <input type="number" class="mar-marks" value="${data.marks||10}" min="1" oninput="this.closest('.mar-card').querySelector('.mar-marks-label').textContent=this.value+' marks'" style="background:var(--bg);border:1.5px solid var(--border);border-radius:10px;padding:.75rem 1rem;color:var(--text);width:100%;outline:none">
        </div>
      </div>
      <div class="mar-comment-box" style="${data.comment ? 'display:block' : 'display:none'};margin-top:.75rem">
        <label style="font-size:.82rem;color:#4f8ef7;display:block;margin-bottom:.4rem;font-weight:600">💬 Internal Note / Grading Criteria</label>
        <textarea class="mar-comment" rows="2" placeholder="e.g. Accept any 3 of the 5 points mentioned…" style="width:100%;background:rgba(79,142,247,.06);border:1.5px solid rgba(79,142,247,.25);border-radius:10px;padding:.65rem 1rem;color:var(--text);font-family:'DM Sans',sans-serif;resize:vertical;outline:none;box-sizing:border-box">${data.comment||''}</textarea>
      </div>`;
    return div;
  }

  function addModelAnswer() {
    qCount++;
    const list = document.getElementById('model-answers-list');
    const card = createQuestionCard(qCount, {});
    list.appendChild(card);
    card.scrollIntoView({ behavior:'smooth', block:'nearest' });
    showToast('Q'+qCount+' added');
  }

  function deleteQuestion(btn) {
    if (document.querySelectorAll('.mar-card').length <= 1) { showToast('⚠ Need at least 1 question'); return; }
    const card = btn.closest('.mar-card');
    card.style.transition='opacity .2s,transform .2s'; card.style.opacity='0'; card.style.transform='scale(.97)';
    setTimeout(()=>{ card.remove(); renumberQuestions(); }, 200);
  }

  function duplicateQuestion(btn) {
    const card = btn.closest('.mar-card');
    const qtEl = card.querySelector('[style*="QUESTION FROM PAPER"]');
    const data = {
      question: qtEl ? qtEl.nextElementSibling?.textContent?.trim() : '',
      answer:   card.querySelector('.mar-answer').value,
      keywords: card.querySelector('.mar-keywords').value,
      marks:    card.querySelector('.mar-marks').value,
      comment:  card.querySelector('.mar-comment')?.value||''
    };
    qCount++;
    const newCard = createQuestionCard(qCount, data);
    card.after(newCard);
    newCard.style.opacity='0'; newCard.style.transition='opacity .25s';
    requestAnimationFrame(()=>newCard.style.opacity='1');
    showToast('Question duplicated');
  }

  function toggleComment(btn) {
    const box = btn.closest('.mar-card').querySelector('.mar-comment-box');
    box.style.display = box.style.display==='none' ? 'block' : 'none';
    btn.textContent = box.style.display==='none' ? '💬 Note' : '💬 Hide';
  }

  function renumberQuestions() {
    document.querySelectorAll('.mar-card').forEach((c,i)=>{
      c.dataset.qnum=i+1;
      const b=c.querySelector('.q-badge'); if(b) b.textContent='Q '+(i+1);
    });
    qCount=document.querySelectorAll('.mar-card').length;
  }

  function createForum() {
    const name    = document.getElementById('cf-name')?.value.trim()||cfData.name;
    const subject = document.getElementById('cf-subject')?.value.trim()||cfData.subject;
    const cls     = document.getElementById('cf-class')?.value.trim()||cfData.cls;
    if (!name||!subject||!cls) { showToast('⚠ Missing details — go back to Step 1'); return; }
    window.userForums.unshift({ name, subject, cls, students:0, avg:'—', avgNum:0, created:'Just now', status:'active', statusLabel:'● Active', statusClass:'badge-active' });
    setText('stat-forums', window.userForums.length);
    setText('stat-forums-sub', '↑ 1 this week');
    renderForumsUI();
    ['cf-name','cf-subject','cf-class'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
    clearFileUpload();
    document.getElementById('model-answers-list').innerHTML='';
    cfData={ name:'',subject:'',cls:'',date:'',marks:100,qcount:5,file:null };
    showToast('✦ Forum "'+name+'" created!');
    setTimeout(()=>switchView('forums'),1200);
  }

  // ── Student row ──
  function addStudentRow() {
    const div = document.createElement('div');
    div.className = 'student-row';
    div.innerHTML = `
      <div>
        <div class="form-group"><label>Student Name</label><input type="text" placeholder="Enter student name"></div>
        <div class="form-group"><label>Register Number</label><input type="text" placeholder="Enter reg no"></div>
      </div>
      <div>
        <div class="upload-zone" style="padding:1.5rem">
          <input type="file" accept="image/*,.pdf">
          <div style="font-size:1.5rem;margin-bottom:.5rem">📤</div>
          <p style="font-size:.8rem">Upload answer sheet</p>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:.5rem;padding-top:1.5rem">
        <button class="btn btn-primary btn-sm" onclick="showToast('Please upload a sheet first')">⚡ Evaluate</button>
        <button class="btn btn-ghost btn-sm">Preview</button>
      </div>`;
    document.getElementById('student-list').appendChild(div);
  }

  // ── Results table data ──
  const students = [
    { reg: '2024001', name: 'Arjun Mehta', scores: [18,15,14,17,19] },
    { reg: '2024002', name: 'Kavya Reddy', scores: [20,18,17,20,20] },
    { reg: '2024003', name: 'Rohan Das', scores: [14,12,10,13,15] },
    { reg: '2024004', name: 'Sneha Iyer', scores: [17,16,15,18,16] },
    { reg: '2024005', name: 'Vikram Singh', scores: [9,8,7,10,7] },
    { reg: '2024006', name: 'Ananya Pillai', scores: [19,17,16,18,19] },
    { reg: '2024007', name: 'Karthik N.', scores: [16,14,13,15,17] },
    { reg: '2024008', name: 'Deepa Raj', scores: [11,10,12,11,9] },
  ];

  function buildResultsTable() {
    const tbody = document.getElementById('results-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    students.forEach(s => {
      const total = s.scores.reduce((a, b) => a + b, 0);
      const pct = Math.round(total);
      const pctClass = pct >= 75 ? 'score-high' : pct >= 50 ? 'score-mid' : 'score-low';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-size:.85rem;color:var(--text-muted)">${s.reg}</td>
        <td><strong>${s.name}</strong></td>
        ${s.scores.map(sc => `<td class="score-cell ${sc >= 16 ? 'score-high' : sc >= 10 ? 'score-mid' : 'score-low'}">${sc}</td>`).join('')}
        <td class="score-cell"><strong>${total}</strong></td>
        <td class="score-cell ${pctClass}"><strong>${pct}%</strong></td>`;
      tbody.appendChild(tr);
    });
  }

  function filterTable(input) {
    const q = input.value.toLowerCase();
    document.querySelectorAll('#results-body tr').forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  }

  function sortTable(sel) {
    // Visual only — data is pre-sorted
    showToast('Sorted: ' + sel.value);
  }

  // ── Bar Chart ──
  function buildBarChart() {
    const container = document.getElementById('bar-chart');
    if (!container) return;
    container.innerHTML = '';
    const allStudents = [
      {name:'Arjun',total:83},{name:'Kavya',total:95},{name:'Rohan',total:64},
      {name:'Sneha',total:82},{name:'Vikram',total:41},{name:'Ananya',total:89},
      {name:'Karthik',total:75},{name:'Deepa',total:53},{name:'Rahul',total:70},
      {name:'Preethi',total:88},{name:'Manu',total:61},{name:'Anita',total:77},
    ];
    const max = 100;
    allStudents.forEach(s => {
      const wrap = document.createElement('div');
      wrap.className = 'bar-wrap';
      wrap.innerHTML = `
        <div class="bar-val">${s.total}</div>
        <div class="bar" style="height:${(s.total/max)*100}%" title="${s.name}: ${s.total}"></div>
        <div class="bar-label">${s.name}</div>`;
      container.appendChild(wrap);
    });
  }

  // ── Toast ──
  function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
  }

  // ── CSV Download ──
  function downloadExcel() {
    // Build data rows from students array
    const forumName = document.querySelector('#view-forum-detail h1')?.textContent || 'Forum_Results';
    const safeName  = forumName.replace(/[^a-z0-9]/gi, '_');

    // Header row
    let tableHTML = `
      <table border="1" style="border-collapse:collapse">
        <thead>
          <tr style="background:#0d3349;color:#fff;font-weight:bold">
            <th>Reg No</th>
            <th>Student Name</th>
            <th>Q1 /20</th>
            <th>Q2 /20</th>
            <th>Q3 /20</th>
            <th>Q4 /20</th>
            <th>Q5 /20</th>
            <th>Total /100</th>
            <th>Percentage %</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>`;

    students.forEach(s => {
      const total = s.scores.reduce((a,b) => a+b, 0);
      const pct   = total; // out of 100
      const pass  = pct >= 40;
      const rowColor = pct >= 75 ? '#e6f9f2' : pct >= 40 ? '#fffbe6' : '#fdecea';
      tableHTML += `
          <tr style="background:${rowColor}">
            <td>${s.reg}</td>
            <td><b>${s.name}</b></td>
            ${s.scores.map(sc => `<td style="text-align:center">${sc}</td>`).join('')}
            <td style="text-align:center;font-weight:bold">${total}</td>
            <td style="text-align:center;font-weight:bold">${pct}%</td>
            <td style="text-align:center;color:${pass?'green':'red'};font-weight:bold">${pass?'PASS':'FAIL'}</td>
          </tr>`;
    });

    // Summary row
    const avg = Math.round(students.reduce((a,s)=>a+s.scores.reduce((x,y)=>x+y,0),0) / students.length);
    const passed = students.filter(s=>s.scores.reduce((a,b)=>a+b,0)>=40).length;
    tableHTML += `
          <tr style="background:#d0f0e8;font-weight:bold">
            <td colspan="2">CLASS SUMMARY</td>
            <td colspan="5" style="text-align:center">—</td>
            <td style="text-align:center">${avg}</td>
            <td style="text-align:center">${avg}%</td>
            <td style="text-align:center">${passed}/${students.length} Pass</td>
          </tr>
        </tbody>
      </table>`;

    // Wrap in full Excel-compatible HTML
    const excelHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
          <x:ExcelWorksheet><x:Name>${forumName}</x:Name>
          <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
          </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      </head>
      <body>${tableHTML}</body></html>`;

    const blob = new Blob([excelHTML], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = safeName + '_Results.xls';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✦ Excel file downloaded!');
  }

  function evaluateAll() {
    const btn = document.querySelector('#view-forum-detail .action-bar .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Evaluating…'; }

    // Simulate evaluation progress with toast updates
    showToast('⚡ Starting AI evaluation…');
    let done = 0;
    const total = students.length;
    const interval = setInterval(() => {
      done++;
      showToast(`⚡ Evaluating sheet ${done}/${total} — ${students[done-1]?.name || ''}…`);
      if (done >= total) {
        clearInterval(interval);
        setTimeout(() => {
          if (btn) { btn.disabled = false; btn.textContent = '⚡ Evaluate All'; }
          showToast('✅ All ' + total + ' sheets evaluated successfully!');
          // Refresh results table to show "evaluated" state
          buildResultsTable();
        }, 600);
      }
    }, 400);
  }

  // ── Avatar Upload ──
  function handleAvatarUpload(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (!file.type.startsWith('image/')) { showToast('⚠ Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('⚠ Image must be under 5MB'); return; }

    const reader = new FileReader();
    reader.onload = function(e) {
      const avatarDiv = document.getElementById('profile-big-avatar');
      const sidebarDiv = document.getElementById('sidebar-avatar');

      // Profile big avatar — show image
      avatarDiv.innerHTML = '';
      avatarDiv.style.background = 'none';
      avatarDiv.style.padding = '0';
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
      avatarDiv.appendChild(img);

      // Sidebar avatar — show image too
      if (sidebarDiv) {
        sidebarDiv.innerHTML = '';
        sidebarDiv.style.background = 'none';
        sidebarDiv.style.padding = '0';
        sidebarDiv.style.overflow = 'hidden';
        const img2 = document.createElement('img');
        img2.src = e.target.result;
        img2.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
        sidebarDiv.appendChild(img2);
      }

      showToast('✦ Profile photo updated!');
    };
    reader.readAsDataURL(file);
  }
  function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }



  // ── Scroll Reveal ── Reveal ──
  const revealEls = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        entry.target.style.transitionDelay = (i % 6) * 0.08 + 's';
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  revealEls.forEach(el => observer.observe(el));

  // Init — start create forum at step 1
  goCreateStep(1);

