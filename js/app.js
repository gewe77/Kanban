// ═══════════════════════════════════════════════
// APP CONTROLLER
// Tab-Switching, Initialisierung, Keyboard-Shortcuts
// ═══════════════════════════════════════════════

let activeTab = 'kanban';

// ═══════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════
function switchTab(tabName) {
  activeTab = tabName;
  
  // Update navigation
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
  });
  
  // Update content
  document.querySelectorAll('.tab-container').forEach(container => {
    container.classList.toggle('active', container.id === `${tabName}-tab`);
  });
  
  // Show/hide header buttons based on tab
  const kanbanBtns = document.querySelectorAll('.btn-kanban-only');
  const vorgaengeBtns = document.querySelectorAll('.btn-vorgaenge-only');
  
  kanbanBtns.forEach(b => b.style.display = tabName === 'kanban' ? '' : 'none');
  vorgaengeBtns.forEach(b => b.style.display = tabName === 'vorgaenge' ? '' : 'none');
  
  // Trigger renders
  if (tabName === 'kanban') {
    if (typeof render === 'function') render();
  } else if (tabName === 'vorgaenge') {
    if (typeof renderVorgaengeTab === 'function') renderVorgaengeTab();
  } else if (tabName === 'einstellungen') {
    if (typeof renderEinstellungenTab === 'function') renderEinstellungenTab();
  }
  
  // Persist active tab
  localStorage.setItem('activeTab', tabName);
}

// ═══════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════
function setupKeyboard() {
  document.addEventListener('keydown', e => {
    // Escape: alle Overlays schließen
    if (e.key === 'Escape') {
      if (typeof closeModal === 'function') closeModal();
      if (typeof closeDrawer === 'function') closeDrawer();
      if (typeof closeConfirm === 'function') closeConfirm();
      if (typeof closeReview === 'function') closeReview();
      if (typeof closeNewVorgangModal === 'function') closeNewVorgangModal();
      if (typeof closeVorgangDrawer === 'function') closeVorgangDrawer();
    }
    
    // 'n': Neuer Vorgang (je nach aktivem Tab)
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      if (activeTab === 'kanban') {
        openNewModal();
      } else if (activeTab === 'vorgaenge') {
        openNewVorgangModal();
      }
    }
    
    // '1' / '2': Tab-Wechsel
    if (e.key === '1' && !e.ctrlKey && !e.metaKey &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      switchTab('kanban');
    }
    if (e.key === '2' && !e.ctrlKey && !e.metaKey &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      switchTab('vorgaenge');
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
// SETUP VIEW-TOGGLE BUTTONS (Vorgänge)
// ═══════════════════════════════════════════════
function setupViewToggle() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setVorgaengeView(btn.getAttribute('data-view'));
    });
  });
}

// ═══════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════
function init() {
  console.log('🔧 Betriebsführungssystem startet…');
  
  // Lokale Daten laden (Fallback bis Firebase antwortet)
  window.cards = loadLocalDataKanban();
  window.vorgaenge = loadLocalDataVorgaenge();
  window.stammdaten = loadLocalStammdaten();
  
  // UI Setup
  setupTabs();
  setupViewToggle();
  setupKeyboard();
  
  if (typeof setupVorgaengeFilters === 'function') {
    setupVorgaengeFilters();
  }
  
  // Initial render
  if (typeof render === 'function') render();
  if (typeof renderVorgaengeTab === 'function') renderVorgaengeTab();
  if (typeof refreshDropdowns === 'function') refreshDropdowns();
  
  // Restore last active tab (default: kanban)
  const lastTab = localStorage.getItem('activeTab') || 'kanban';
  switchTab(lastTab);
  
  console.log(`✓ Kanban: ${window.cards.length} Karten`);
  console.log(`✓ Vorgänge: ${window.vorgaenge.length} Vorgänge`);
  console.log(`✓ Stammdaten geladen (lokal)`);
  
  // URL-Parameter prüfen (Mail-Capture vom Bookmarklet)
  if (typeof processUrlParams === 'function') {
    // Mit kleiner Verzögerung, damit Firestore-Auth Zeit hat
    setTimeout(() => processUrlParams(), 500);
  }
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
