// ═══════════════════════════════════════════════
// FIREBASE KONFIGURATION
// Zwei separate Firestore-Instanzen:
//   1. kanban-betrieb (für Kanban-Karten)
//   2. betrieb-vorgaenge (für Vorgangsmanagement)
// ═══════════════════════════════════════════════

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getFirestore, collection, getDocs, setDoc, deleteDoc, doc }
  from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';

// ─── KANBAN PROJEKT (bestehend) ───
const firebaseConfigKanban = {
  apiKey:            "AIzaSyDzm5ePW5f45RU8kVn-ch3jRgdOmT_DzZg",
  authDomain:        "kanban-betrieb.firebaseapp.com",
  projectId:         "kanban-betrieb",
  storageBucket:     "kanban-betrieb.firebasestorage.app",
  messagingSenderId: "858594172795",
  appId:             "1:858594172795:web:d6c18da8e9814a298ba7de"
};

// ─── VORGÄNGE PROJEKT (neu) ───
const firebaseConfigVorgaenge = {
  apiKey:            "AIzaSyChAk5gQgv-rci1_zywUycLJYfyjRY18G8",
  authDomain:        "betrieb-vorgaenge.firebaseapp.com",
  projectId:         "betrieb-vorgaenge",
  storageBucket:     "betrieb-vorgaenge.firebasestorage.app",
  messagingSenderId: "782751645551",
  appId:             "1:782751645551:web:866e6051657381f885729a"
};

// ─── Initialisierung beider Apps ───
const appKanban    = initializeApp(firebaseConfigKanban);
const appVorgaenge = initializeApp(firebaseConfigVorgaenge, 'vorgaenge');

const db_kanban    = getFirestore(appKanban);
const db_vorgaenge = getFirestore(appVorgaenge);

// Auth nur einmal (über Kanban-App geteilt)
const auth = getAuth(appKanban);

// ─── Global verfügbar machen ───
window._db_kanban    = db_kanban;
window._db_vorgaenge = db_vorgaenge;
window._auth         = auth;
window._fbCol_kanban    = () => collection(db_kanban, 'vorgaenge');
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
    if (typeof loadFromFirestore === 'function') loadFromFirestore();
    if (typeof loadVorgaengeFromFirestore === 'function') loadVorgaengeFromFirestore();
    if (typeof loadStammdatenFromFirestore === 'function') loadStammdatenFromFirestore();
  } else {
    if (typeof render === 'function') { 
      window.cards = loadLocalDataKanban(); 
      window.vorgaenge = loadLocalDataVorgaenge();
      if (typeof loadLocalStammdaten === 'function') {
        window.stammdaten = loadLocalStammdaten();
      }
      render(); 
      if (typeof renderVorgaengeTab === 'function') renderVorgaengeTab();
      if (typeof refreshDropdowns === 'function') refreshDropdowns();
    }
  }
});
