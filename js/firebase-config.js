// ═══════════════════════════════════════════════
// FIREBASE KONFIGURATION
//
// Ein Projekt (betrieb-vorgaenge), eine App-Instanz, ein Key —
// für Authentication UND Firestore gemeinsam.
//
// WICHTIG: Auth und Firestore MÜSSEN dieselbe initializeApp()-
// Instanz verwenden. Verwendet man zwei getrennte Instanzen
// (selbst mit identischer projectId), erkennt Firestore die
// Anmeldung der anderen Instanz nicht — request.auth bleibt
// dann null und Regeln wie "if request.auth != null" blocken
// mit "Missing or insufficient permissions", obwohl die
// Anmeldung selbst erfolgreich war.
//
// Der aktuelle apiKey wurde am 14.07.2026 neu erstellt, weil
// der ursprüngliche Key keine gültige Identity-Toolkit-
// Freigabe hatte (auth/api-key-not-valid). Muss in der Google-
// Cloud-Konsole für diesen Key freigegeben sein:
//   - Identity Toolkit API
//   - Token Service API
//   - Cloud Firestore API   ← ggf. noch ergänzen!
// ═══════════════════════════════════════════════

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getFirestore, collection, getDocs, setDoc, deleteDoc, doc }
  from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';

const firebaseConfigVorgaenge = {
  apiKey:            "AIzaSyALW75LLaRWhm2rBx7WzR9-Ce0AErpvQIk",
  authDomain:        "betrieb-vorgaenge.firebaseapp.com",
  projectId:         "betrieb-vorgaenge",
  storageBucket:     "betrieb-vorgaenge.firebasestorage.app",
  messagingSenderId: "782751645551",
  appId:             "1:782751645551:web:866e6051657381f885729a"
};

// ─── Eine App-Instanz für alles ───
const appVorgaenge = initializeApp(firebaseConfigVorgaenge);

const db_vorgaenge = getFirestore(appVorgaenge);
const auth         = getAuth(appVorgaenge);


// ─── Global verfügbar machen ───
window._db_vorgaenge = db_vorgaenge;
window._auth         = auth;
window._fbCol_vorgaenge = () => collection(db_vorgaenge, 'vorgaenge');
window._fbCol_abrufe = () => collection(db_vorgaenge, 'vertragsabrufe');
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
    if (typeof loadAbrufeFromFirestore === 'function') loadAbrufeFromFirestore();
    if (typeof loadStammdatenFromFirestore === 'function') loadStammdatenFromFirestore();
  } else {
    if (typeof setSyncStatus === 'function') setSyncStatus('offline');
    window.vorgaenge = loadLocalDataVorgaenge();
    if (typeof loadLocalDataAbrufe === 'function') {
      window.abrufe = loadLocalDataAbrufe();
    }
    if (typeof loadLocalStammdaten === 'function') {
      window.stammdaten = loadLocalStammdaten();
    }
    if (typeof renderRegister === 'function') renderRegister();
    if (typeof renderAbrufeRegister === 'function') renderAbrufeRegister();
    if (typeof refreshDropdowns === 'function') refreshDropdowns();
  }
});
