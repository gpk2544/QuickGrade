/**
 * QuickGrade — Centralized API Client
 * All backend HTTP calls go through this module.
 * Import: import { api, setAuthToken } from './api.js';
 */

// Auto-detect backend URL: localhost for dev, production URL when deployed
const API_BASE = (() => {
  // Allow override via global variable (set in index.html if needed)
  if (window.__API_BASE) return window.__API_BASE;
  // If running on localhost/127.0.0.1, use local backend
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  // Production: use env-configured backend or same-origin /api
  return window.__API_BASE || 'https://quickgrade-api.onrender.com';
})();

console.log('🔗 API_BASE:', API_BASE);

let _authToken = null;

/** Store the Firebase ID token for authenticated requests */
export function setAuthToken(token) {
  _authToken = token;
}

export function getAuthToken() {
  return _authToken;
}

/** Core fetch wrapper — adds auth header, parses JSON, handles errors */
async function request(method, path, { body, formData, isBlob } = {}) {
  const headers = {};
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }

  const opts = { method, headers };

  if (formData) {
    opts.body = formData; // browser sets Content-Type with boundary
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

// ═══════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════

/** Verify Firebase ID token with backend — creates/returns user profile */
export async function apiVerifyToken(idToken) {
  return request('POST', '/auth/verify', { body: { id_token: idToken } });
}

/** Get current user profile */
export async function apiGetProfile() {
  return request('GET', '/auth/me');
}

/** Update user profile */
export async function apiUpdateProfile(data) {
  return request('PUT', '/auth/profile', { body: data });
}

/** Upload avatar image */
export async function apiUploadAvatar(file) {
  const fd = new FormData();
  fd.append('file', file);
  return request('POST', '/auth/avatar', { formData: fd });
}

// ═══════════════════════════════════════════
//  FORUMS
// ═══════════════════════════════════════════

/** List all forums for logged-in teacher */
export async function apiListForums() {
  return request('GET', '/forums/');
}

/** Create a new forum with model answers */
export async function apiCreateForum(data) {
  return request('POST', '/forums/', { body: data });
}

/** Get forum detail (includes students + model answers) */
export async function apiGetForum(forumId) {
  return request('GET', `/forums/${forumId}`);
}

/** Delete a forum */
export async function apiDeleteForum(forumId) {
  return request('DELETE', `/forums/${forumId}`);
}

/** Close a forum */
export async function apiCloseForum(forumId) {
  return request('PUT', `/forums/${forumId}/close`);
}

/** Save / replace model answers for a forum */
export async function apiSaveAnswers(forumId, answers) {
  return request('POST', `/forums/${forumId}/answers`, { body: answers });
}

/** List students in a forum */
export async function apiListStudents(forumId) {
  return request('GET', `/forums/${forumId}/students`);
}

// ═══════════════════════════════════════════
//  UPLOAD
// ═══════════════════════════════════════════

/** Upload student answer sheet OR paste text — returns student doc + preview */
export async function apiUploadAnswerSheet(forumId, studentName, regNumber, file, text = null) {
  const fd = new FormData();
  fd.append('forum_id', forumId);
  fd.append('student_name', studentName);
  fd.append('reg_number', regNumber);
  if (text) {
    fd.append('text', text);
  } else if (file) {
    fd.append('file', file);
  }
  return request('POST', '/upload/answer-sheet', { formData: fd });
}

/** Upload question paper image/PDF */
export async function apiUploadQuestionPaper(forumId, file) {
  const fd = new FormData();
  fd.append('forum_id', forumId);
  fd.append('file', file);
  return request('POST', '/upload/question-paper', { formData: fd });
}

/** Upload textbook PDF — triggers RAG indexing */
export async function apiUploadTextbook(forumId, file) {
  const fd = new FormData();
  fd.append('forum_id', forumId);
  fd.append('file', file);
  return request('POST', '/upload/textbook', { formData: fd });
}

// ═══════════════════════════════════════════
//  EVALUATE
// ═══════════════════════════════════════════

/** Grade a single student */
export async function apiEvaluateStudent(studentId, forumId) {
  return request('POST', '/evaluate/student', {
    body: { student_id: studentId, forum_id: forumId }
  });
}

/** Grade all students in a forum */
export async function apiEvaluateAll(forumId) {
  return request('POST', '/evaluate/all', {
    body: { forum_id: forumId }
  });
}

// ═══════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════

/** Download Excel results — returns Blob */
export async function apiExportExcel(forumId) {
  return request('GET', `/forums/${forumId}/export/excel`, { isBlob: true });
}

// ═══════════════════════════════════════════
//  CONVENIENCE
// ═══════════════════════════════════════════

/** Helper to download a blob as a file */
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
