/**
 * QuickGrade — Centralized API Client
 * All backend HTTP calls go through this module.
 */

// Auto-detect backend URL
const API_BASE = (() => {
  if (window.__API_BASE) return window.__API_BASE;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
    return 'http://localhost:8000';
  }
  return 'https://quickgrade-api.onrender.com';
})();

window.API_BASE = API_BASE;
console.log('🔗 API_BASE:', API_BASE);

let _authToken = null;

export function setAuthToken(token) {
  _authToken = token;
}

export function getAuthToken() {
  return _authToken;
}

/** Core fetch wrapper */
async function request(method, path, { body, formData, isBlob } = {}) {
  const headers = {};
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }

  const opts = { method, headers };

  if (formData) {
    opts.body = formData;
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, opts);

  if (isBlob) {
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    return await res.blob();
  }

  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.message || json.detail || `Request failed: ${res.status}`);
  }
  return json.data;
}

// ── AUTH ──
export async function apiVerifyToken(idToken) {
  // If no token passed, try to use the globally set _authToken
  const token = idToken || _authToken;
  if (!token) return null; 
  return request('POST', '/auth/verify', { body: { id_token: token } });
}

export async function apiGetProfile() {
  return request('GET', '/auth/me');
}

export async function apiUpdateProfile(data) {
  return request('PUT', '/auth/profile', { body: data });
}

export async function apiUploadAvatar(file) {
  const fd = new FormData();
  fd.append('file', file);
  return request('POST', '/auth/avatar', { formData: fd });
}

// ── FORUMS ──
export async function apiListForums() {
  return request('GET', '/forums/');
}

export async function apiCreateForum(data) {
  return request('POST', '/forums/', { body: data });
}

export async function apiGetForum(forumId) {
  return request('GET', `/forums/${forumId}`);
}

export async function apiDeleteForum(forumId) {
  return request('DELETE', `/forums/${forumId}`);
}

export async function apiCloseForum(forumId) {
  return request('PUT', `/forums/${forumId}/close`);
}

export async function apiSaveAnswers(forumId, answers) {
  return request('POST', `/forums/${forumId}/answers`, { body: answers });
}

export async function apiListStudents(forumId) {
  return request('GET', `/forums/${forumId}/students`);
}

// ── UPLOAD ──
export async function apiUploadAnswerSheet(forumId, studentName, regNumber, file, text = null) {
  const fd = new FormData();
  fd.append('forum_id', forumId);
  fd.append('student_name', studentName);
  fd.append('reg_number', regNumber);
  if (text) fd.append('text', text);
  else if (file) fd.append('file', file);
  return request('POST', '/upload/answer-sheet', { formData: fd });
}

export async function apiUpdateStudent(studentId, data) {
  return request('PUT', `/upload/student/${studentId}`, { body: data });
}

export async function apiDeleteStudent(studentId) {
  return request('DELETE', `/upload/student/${studentId}`);
}

export async function apiUploadQuestionPaper(forumId, file) {
  const fd = new FormData();
  fd.append('forum_id', forumId);
  fd.append('file', file);
  return request('POST', '/upload/question-paper', { formData: fd });
}

export async function apiUploadTextbook(forumId, file) {
  const fd = new FormData();
  fd.append('forum_id', forumId);
  fd.append('file', file);
  return request('POST', '/upload/textbook', { formData: fd });
}

// ── EVALUATE ──
export async function apiEvaluateStudent(studentId, forumId) {
  return request('POST', '/evaluate/student', { 
    body: { student_id: studentId, forum_id: forumId } 
  });
}

export async function apiEvaluateAll(forumId) {
  return request('POST', '/evaluate/all', { 
    body: { forum_id: forumId } 
  });
}

// ── EXPORT ──
export async function apiExportExcel(forumId) {
  return request('GET', `/forums/${forumId}/export/excel`, { isBlob: true });
}

// ── CONVENIENCE ──
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}