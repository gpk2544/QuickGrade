// ─────────────────────────────────────────────────────────────
// QuickGrade — Firebase Configuration
// ─────────────────────────────────────────────────────────────

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup }
  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, deleteDoc, addDoc }
  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL }
  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

// ── YOUR FIREBASE CONFIG ─────────────────────────────────────
// ⚠️ IMPORTANT: These must match the backend's serviceAccountKey.json project
const firebaseConfig = {
  apiKey: "AIzaSyAocpQRNjuOpSDm732pw-FIgPNuR7tcvow",
  authDomain: "quickgrade-78af7.firebaseapp.com",
  projectId: "quickgrade-78af7",
  storageBucket: "quickgrade-78af7.firebasestorage.app",
  messagingSenderId: "826961594571",
  appId: "1:826961594571:web:d49566ddebbe6825a2334e",
  measurementId: "G-D0TCTPWYMG"
};
// ─────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

export {
  auth, db, storage, googleProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup,
  collection, doc, setDoc, getDoc, getDocs, addDoc,
  query, where, orderBy, deleteDoc,
  ref, uploadBytes, getDownloadURL
};