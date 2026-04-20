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
const firebaseConfig = {
  apiKey:            "AIzaSyDYmp0tuimk6J-5tKZUgfUUq_9NAL3xRB4",
  authDomain:        "quickgarde-bcc77.firebaseapp.com",
  projectId:         "quickgarde-bcc77",
  storageBucket:     "quickgarde-bcc77.firebasestorage.app",
  messagingSenderId: "636175142896",
  appId:             "1:636175142896:web:56384d77839f8f0c5b5735"
};
// ─────────────────────────────────────────────────────────────

const app     = initializeApp(firebaseConfig);
const auth    = getAuth(app);
const db      = getFirestore(app);
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
