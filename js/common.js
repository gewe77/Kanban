// ═══════════════════════════════════════════════
// GEMEINSAME UTILITY-FUNKTIONEN
// ═══════════════════════════════════════════════

// ── Datum & Zeit ──
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

function fmtLong(dateStr) {
  if (!dateStr) return '–';
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', {
    weekday: 'short',
    month: 'short',
    day: '2-digit'
  });
}

// ── HTML Escape ──
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Datum-Vergleich für Fälligkeiten ──
function dueClass(f) {
  if (!f) return 'normal';
  const diff = (new Date(f) - new Date(today())) / 86400000;
  return diff < 0 ? 'due-red' : diff <= 5 ? 'due-amber' : 'normal';
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const target = new Date(dateStr);
  const now = new Date(today());
  return Math.floor((target - now) / 86400000);
}

// ── LocalStorage Helpers ──
function loadLocalDataVorgaenge() {
  try {
    return JSON.parse(localStorage.getItem('betrieb_vorgaenge_v1')) || [];
  } catch {
    return [];
  }
}

function saveLocalVorgaenge() {
  localStorage.setItem('betrieb_vorgaenge_v1', JSON.stringify(window.vorgaenge || []));
}

function loadLocalDataAbrufe() {
  try {
    return JSON.parse(localStorage.getItem('betrieb_abrufe_v1')) || [];
  } catch {
    return [];
  }
}

function saveLocalAbrufe() {
  localStorage.setItem('betrieb_abrufe_v1', JSON.stringify(window.abrufe || []));
}

// ── DB-Verbindungsstatus UI (Header) ──
function setSyncStatus(state) {
  const dot = document.getElementById('dbStatusDot');
  const txt = document.getElementById('dbStatusText');
  if (!dot) return;
  dot.className = 'db-status-dot ' + state;
  txt.textContent = {
    synced:  'Firestore verbunden',
    syncing: 'Speichert…',
    error:   'Sync-Fehler',
    offline: 'Nicht angemeldet'
  }[state] || 'Lokal';
}

// ── Auth UI Update ──
function updateAuthUI() {
  const btn = document.getElementById('authBtn');
  if (!btn) return;
  if (window._currentUser) {
    const e = window._currentUser.email || 'Angemeldet';
    btn.textContent = '● ' + (e.length > 22 ? e.slice(0, 20) + '…' : e);
    btn.className = 'btn btn-auth-on';
  } else {
    btn.textContent = '○ Anmelden';
    btn.className = 'btn btn-auth-off';
    setSyncStatus('offline');
  }
}

async function handleAuth() {
  if (!window._fbFns) return;
  const { signInWithPopup, GoogleAuthProvider, signOut } = window._fbFns;
  if (window._currentUser) {
    if (confirm('Abmelden?')) await signOut(window._auth);
  } else {
    try {
      await signInWithPopup(window._auth, new GoogleAuthProvider());
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        alert('Anmeldung fehlgeschlagen: ' + e.message);
      }
    }
  }
}

// ── Global verfügbar ──
window.uid = uid;
window.today = today;
window.fmt = fmt;
window.fmtLong = fmtLong;
window.esc = esc;
window.dueClass = dueClass;
window.daysUntil = daysUntil;
window.loadLocalDataVorgaenge = loadLocalDataVorgaenge;
window.saveLocalVorgaenge = saveLocalVorgaenge;
window.loadLocalDataAbrufe = loadLocalDataAbrufe;
window.saveLocalAbrufe = saveLocalAbrufe;
window.setSyncStatus = setSyncStatus;
window.updateAuthUI = updateAuthUI;
window.handleAuth = handleAuth;
