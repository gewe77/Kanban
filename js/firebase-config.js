// ═══════════════════════════════════════════════
// FIREBASE KONFIGURATION — TEST-VERSION
//
// Isoliert den Anmelde-Fehler: Auth läuft testweise über einen
// NEUEN, separat erstellten API-Key (nur mit Identity Toolkit +
// Token Service API freigegeben). Firestore bleibt unverändert
// am ursprünglichen Key hängen — wird hier nicht angefasst.
//
// Wenn die Anmeldung damit klappt: Der alte Key war/ist das
// Problem, wir übernehmen dann den neuen Key dauerhaft (inkl.
// Freigabe für Cloud Firestore API).
// Wenn der gleiche Fehler bleibt: Es liegt nicht am Key, sondern
// am Projekt/einer Organisationsrichtlinie.
// ═══════════════════════════════════════════════

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getFirestore, collection, getDocs, setDoc, deleteDoc, doc }
  from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';

// Projekt-Basisdaten bleiben gleich (betrieb-vorgaenge),
// nur der apiKey unterscheidet sich zwischen Auth und Firestore.
const firebaseConfigVorgaenge = {
  apiKey:            "AIzaSyChAk5gQgv-rci1_zywUycLJYfyjRY18G8",   // alter Key — für Firestore
  authDomain:        "betrieb-vorgaenge.firebaseapp.com",
  projectId:         "betrieb-vorgaenge",
  storageBucket:     "betrieb-vorgaenge.firebasestorage.app",
  messagingSenderId: "782751645551",
  appId:             "1:782751645551:web:866e6051657381f885729a"
};

const firebaseConfigAuthTest = {
  ...firebaseConfigVorgaenge,
  apiKey: "AIzaSyALW75LLaRWhm2rBx7WzR9-Ce0AErpvQIk"   // NEUER Test-Key — nur für Auth
};

// ─── Initialisierung: zwei App-Instanzen, ein Projekt, zwei Keys ───
const appAuthTest  = initializeApp(firebaseConfigAuthTest, 'authtest');
const appVorgaenge = initializeApp(firebaseConfigVorgaenge);

const db_vorgaenge = getFirestore(appVorgaenge);
const auth         = getAuth(appAuthTest);


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
    if (typeof setSyncStatus === 'function') setSyncStatus('offline');
    window.vorgaenge = loadLocalDataVorgaenge();
    if (typeof loadLocalStammdaten === 'function') {
      window.stammdaten = loadLocalStammdaten();
    }
    if (typeof renderRegister === 'function') renderRegister();
    if (typeof refreshDropdowns === 'function') refreshDropdowns();
  }
});
