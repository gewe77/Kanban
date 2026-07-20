// ═══════════════════════════════════════════════
// APP CONTROLLER
// Tab-Switching, Initialisierung, Keyboard-Shortcuts
// ═══════════════════════════════════════════════

// Versionsnummer — bei jeder Dateiänderung durch Claude anzupassen.
// Schema: vXX = größere Ausbaustufe (i.d.R. komplettes ZIP),
//         vXX.NNN = fortlaufende Nummer für Änderungen an einzelnen
//         Dateien seit der letzten vXX-Stufe. Wird im Header angezeigt.
window.APP_VERSION = 'v14.006';

let activeTab = 'vorgaenge';

// ═══════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════
function switchTab(tabName) {
  activeTab = tabName;

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
  });

  document.querySelectorAll('.tab-container').forEach(container => {
    container.classList.toggle('active', container.id === `${tabName}-tab`);
  });

  // Header-Buttons: nur im jeweils passenden Tab anzeigen
  document.querySelectorAll('.btn-vorgaenge-only').forEach(b => {
    b.style.display = tabName === 'vorgaenge' ? '' : 'none';
  });
  document.querySelectorAll('.btn-abrufe-only').forEach(b => {
    b.style.display = tabName === 'abrufe' ? '' : 'none';
  });

  if (tabName === 'vorgaenge') {
    if (typeof renderRegister === 'function') renderRegister();
  } else if (tabName === 'abrufe') {
    if (typeof renderAbrufeRegister === 'function') renderAbrufeRegister();
  } else if (tabName === 'einstellungen') {
    if (typeof renderEinstellungenTab === 'function') renderEinstellungenTab();
  }

  try { localStorage.setItem('activeTab', tabName); } catch (e) { /* ignorieren */ }
}

// ═══════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════
function setupKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (typeof closeNewVorgangModal === 'function') closeNewVorgangModal();
      if (typeof closeVorgangDrawer === 'function') closeVorgangDrawer();
      if (typeof closeNewAbrufModal === 'function') closeNewAbrufModal();
      if (typeof closeAbrufDrawer === 'function') closeAbrufDrawer();
      if (typeof closeStammdatumModal === 'function') closeStammdatumModal();
    }

    // 'n': Neuer Vorgang / Neuer Vertragsabruf (je nach aktivem Tab)
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      if (activeTab === 'vorgaenge') {
        openNewVorgangModal();
      } else if (activeTab === 'abrufe') {
        openNewAbrufModal();
      }
    }
  });
}

// ═══════════════════════════════════════════════
// SETUP TAB-BUTTONS
// ═══════════════════════════════════════════════
function setupTabs() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-tab'));
    });
  });
}

// ═══════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════
function init() {
  console.log(`🔧 Vorgangsregister startet… (${window.APP_VERSION})`);

  const versionEl = document.getElementById('appVersion');
  if (versionEl) versionEl.textContent = window.APP_VERSION;

  // Lokale Daten laden (Fallback bis Firebase antwortet)
  window.vorgaenge = loadLocalDataVorgaenge();
  window.abrufe = typeof loadLocalDataAbrufe === 'function' ? loadLocalDataAbrufe() : [];
  window.stammdaten = loadLocalStammdaten();

  // UI Setup
  setupTabs();
  setupKeyboard();

  if (typeof setupRegisterFilters === 'function') {
    setupRegisterFilters();
  }
  if (typeof setupAbrufeFilters === 'function') {
    setupAbrufeFilters();
  }

  // Initial render
  if (typeof renderRegister === 'function') renderRegister();
  if (typeof renderAbrufeRegister === 'function') renderAbrufeRegister();
  if (typeof refreshDropdowns === 'function') refreshDropdowns();

  // Restore last active tab (default: vorgaenge)
  let lastTab = 'vorgaenge';
  try { lastTab = localStorage.getItem('activeTab') || 'vorgaenge'; } catch (e) { /* ignorieren */ }
  switchTab(lastTab);

  console.log(`✓ Vorgänge: ${window.vorgaenge.length} Vorgänge`);
  console.log(`✓ Vertragsabrufe: ${window.abrufe.length} Abrufe`);
  console.log(`✓ Stammdaten geladen (lokal)`);
}

// Auth-UI initial setzen
if (typeof updateAuthUI === 'function') {
  updateAuthUI();
}

// Start
window.addEventListener('load', init);

// ═══════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════
window.switchTab = switchTab;
