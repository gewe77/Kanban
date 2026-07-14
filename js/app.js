// ═══════════════════════════════════════════════
// APP CONTROLLER
// Tab-Switching, Initialisierung, Keyboard-Shortcuts
// ═══════════════════════════════════════════════

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

  // Header-Buttons: nur im Register-Tab anzeigen
  document.querySelectorAll('.btn-vorgaenge-only').forEach(b => {
    b.style.display = tabName === 'vorgaenge' ? '' : 'none';
  });

  if (tabName === 'vorgaenge') {
    if (typeof renderRegister === 'function') renderRegister();
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
    }

    // 'n': Neuer Vorgang
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      if (activeTab === 'vorgaenge') {
        openNewVorgangModal();
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
  console.log('🔧 Vorgangsregister startet…');

  // Lokale Daten laden (Fallback bis Firebase antwortet)
  window.vorgaenge = loadLocalDataVorgaenge();
  window.stammdaten = loadLocalStammdaten();

  // UI Setup
  setupTabs();
  setupKeyboard();

  if (typeof setupRegisterFilters === 'function') {
    setupRegisterFilters();
  }

  // Initial render
  if (typeof renderRegister === 'function') renderRegister();
  if (typeof refreshDropdowns === 'function') refreshDropdowns();

  // Restore last active tab (default: vorgaenge)
  let lastTab = 'vorgaenge';
  try { lastTab = localStorage.getItem('activeTab') || 'vorgaenge'; } catch (e) { /* ignorieren */ }
  switchTab(lastTab);

  console.log(`✓ Vorgänge: ${window.vorgaenge.length} Vorgänge`);
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
