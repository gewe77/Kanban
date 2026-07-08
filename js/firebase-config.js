// ═══════════════════════════════════════════════
// FIREBASE KONFIGURATION
//
// Zwei Firebase-Projekte, aber nur eines für Daten:
//   1. betrieb-vorgaenge — Firestore (Vorgänge + Stammdaten).
//      Die einzige Datenquelle der App.
//   2. kanban-betrieb    — wird NICHT mehr für Daten verwendet
//      (das Kanban-Board ist entfernt), aber weiterhin für die
//      Google-Anmeldung benötigt: nur in diesem Projekt ist
//      Firebase Authentication tatsächlich eingerichtet.
//      Der API-Key von betrieb-vorgaenge ist dafür nicht freigegeben
//      (führt sonst zu "auth/api-key-not-valid").
//
//      Falls gewünscht, kann Authentication später direkt in
//      betrieb-vorgaenge eingerichtet werden (Firebase-Konsole →
//      Authentication → Google-Anbieter aktivieren + autorisierte
//      Domain gewe77.github.io eintragen) — dann kann dieses
//      zweite Projekt komplett entfallen.
// ═══════════════════════════════════════════════

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getFirestore, collection, getDocs, setDoc, deleteDoc, doc }
  from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';

// ─── AUTH-PROJEKT (nur für Anmeldung) ───
const firebaseConfigAuth = {
  apiKey:            "AIzaSyDzm5ePW5f45RU8kVn-ch3jRgdOmT_DzZg",
  authDomain:        "kanban-betrieb.firebaseapp.com",
  projectId:         "kanban-betrieb",
  storageBucket:     "kanban-betrieb.firebasestorage.app",
  messagingSenderId: "858594172795",
  appId:             "1:858594172795:web:d6c18da8e9814a298ba7de"
};

// ─── VORGÄNGE PROJEKT (einzige Datenquelle) ───
const firebaseConfigVorgaenge = {
  apiKey:            "AIzaSyChAk5gQgv-rci1_zywUycLJYfyjRY18G8",
  authDomain:        "betrieb-vorgaenge.firebaseapp.com",
  projectId:         "betrieb-vorgaenge",
  storageBucket:     "betrieb-vorgaenge.firebasestorage.app",
  messagingSenderId: "782751645551",
  appId:             "1:782751645551:web:866e6051657381f885729a"
};

// ─── Initialisierung ───
const appAuth      = initializeApp(firebaseConfigAuth, 'auth');
const appVorgaenge = initializeApp(firebaseConfigVorgaenge);

const db_vorgaenge = getFirestore(appVorgaenge);
const auth         = getAuth(appAuth);

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
