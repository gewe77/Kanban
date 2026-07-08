// ═══════════════════════════════════════════════
// FIREBASE KONFIGURATION
// Eine Firestore-Instanz: betrieb-vorgaenge
// (Vorgangsregister + Stammdaten)
//
// Das frühere zweite Projekt "kanban-betrieb" wird
// nicht mehr verwendet, seit das Kanban-Board entfernt
// wurde. Es kann bei Bedarf in der Firebase-Konsole
// gelöscht werden.
// ═══════════════════════════════════════════════

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getFirestore, collection, getDocs, setDoc, deleteDoc, doc }
  from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';

// ─── VORGÄNGE PROJEKT ───
const firebaseConfigVorgaenge = {
  apiKey:            "AIzaSyChAk5gQgv-rci1_zywUycLJYfyjRY18G8",
  authDomain:        "betrieb-vorgaenge.firebaseapp.com",
  projectId:         "betrieb-vorgaenge",
  storageBucket:     "betrieb-vorgaenge.firebasestorage.app",
  messagingSenderId: "782751645551",
  appId:             "1:782751645551:web:866e6051657381f885729a"
};

// ─── Initialisierung ───
const appVorgaenge = initializeApp(firebaseConfigVorgaenge);

const db_vorgaenge = getFirestore(appVorgaenge);

// Auth über das Vorgänge-Projekt
const auth = getAuth(appVorgaenge);

// ─── Global verfügbar machen ───
window._db_vorgaenge = db_vorgaenge;
window._auth         = auth;
window._fbCol_vorgaenge = () => collection(db_vorgaenge, 'vorgaenge');
window._fbFns = {
  getDocs, setDoc, deleteDoc, doc,
  signInWithPopup, GoogleAuthProvider, signOut
};

// ─── Auth State Listener ───
onAuthStateChanged(auth, user => {
  window._currentUser = user || null;
  if (typeof updateAuthUI === 'function') updateAuthUI();
  if (user) {
    if (typeof loadVorgaengeFromFirestore === 'function') loadVorgaengeFromFirestore();
    if (typeof loadStammdatenFromFirestore === 'function') loadStammdatenFromFirestore();
  } else {
    window.vorgaenge = loadLocalDataVorgaenge();
    if (typeof loadLocalStammdaten === 'function') {
      window.stammdaten = loadLocalStammdaten();
    }
    if (typeof renderRegister === 'function') renderRegister();
    if (typeof refreshDropdowns === 'function') refreshDropdowns();
  }
});
