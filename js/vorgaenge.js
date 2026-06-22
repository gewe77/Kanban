// ═══════════════════════════════════════════════
// VORGANGSMANAGEMENT
// 
// Verwendet separate Firestore-Instanz (betrieb-vorgaenge)
// Implementiert: Heute-Liste, Register, Detail-Drawer, Neu-Modal
// ═══════════════════════════════════════════════

// Global state
window.vorgaenge = [];
let currentViewVorgaenge = 'heute';
let drawerVorgangId = null;

// Anlagen/Liegenschaften kommen aus den Stammdaten (einstellungen.js)

// Status-Liste
const V_STATUS = [
  { id: 'neu',            label: 'Neu / Ungeprüft' },
  { id: 'bewertet',       label: 'Bewertet' },
  { id: 'inbearbeitung',  label: 'In Bearbeitung' },
  { id: 'wartet-firma',   label: 'Wartet auf Firma' },
  { id: 'wartet-intern',  label: 'Wartet intern' },
  { id: 'entscheidung',   label: 'Zur Entscheidung' },
  { id: 'erledigt',       label: 'Erledigt' },
  { id: 'archiviert',     label: 'Archiviert' }
];

// Kategorien
const KATEGORIEN = ['Störung', 'Wartung', 'Mangel', 'Vergabe', 'Frist', 'Dokumentation'];

// Verantwortlich-Liste
const VERANTWORTLICH = ['Ich', 'Meisterbereich', 'Externe Firma', 'Leitung', 'Andere SB'];

// ═══════════════════════════════════════════════
// FIRESTORE (Vorgänge DB)
// ═══════════════════════════════════════════════
async function loadVorgaengeFromFirestore() {
  try {
    const { getDocs } = window._fbFns;
    const snap = await getDocs(window._fbCol_vorgaenge());
    window.vorgaenge = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    saveLocalVorgaenge();
    renderVorgaengeTab();
  } catch (e) {
    console.error('Firestore Vorgänge laden:', e);
    window.vorgaenge = loadLocalDataVorgaenge();
    renderVorgaengeTab();
  }
}

async function saveVorgangToFirestore(v) {
  if (!window._currentUser) return;
  try {
    const { setDoc, doc } = window._fbFns;
    await setDoc(doc(window._db_vorgaenge, 'vorgaenge', v.id), v);
  } catch (e) {
    console.error('Firestore Vorgang speichern:', e);
  }
}

async function deleteVorgangFromFirestore(id) {
  if (!window._currentUser) return;
  try {
    const { deleteDoc, doc } = window._fbFns;
    await deleteDoc(doc(window._db_vorgaenge, 'vorgaenge', id));
  } catch (e) {
    console.error('Firestore Vorgang löschen:', e);
  }
}

function saveDataVorgaenge() {
  saveLocalVorgaenge();
  // Sync zu Firestore (nicht alle, nur falls Bedarf)
  if (window._currentUser) {
    window.vorgaenge.forEach(v => saveVorgangToFirestore(v));
  }
}

// ═══════════════════════════════════════════════
// VORGANGS-NR GENERIEREN
// ═══════════════════════════════════════════════
function generateVorgangsNr() {
  const year = new Date().getFullYear();
  const yearVorgaenge = window.vorgaenge.filter(v => 
    v.vorgangsNr && v.vorgangsNr.startsWith(`V-${year}-`)
  );
  const maxNum = yearVorgaenge.reduce((max, v) => {
    const m = v.vorgangsNr.match(/V-\d{4}-(\d+)/);
    return m ? Math.max(max, parseInt(m[1])) : max;
  }, 0);
  return `V-${year}-${String(maxNum + 1).padStart(3, '0')}`;
}

// ═══════════════════════════════════════════════
// MORNING WORKFLOW (Heute-Liste)
// 
// Sequenzielles Layout für die Tagesabarbeitung:
//   Step 1: Triage neuer Vorgänge (Bewertung)
//   Step 2: Wiedervorlagen heute (Nachfassen)
//   Step 3: Kritische Vorgänge (Status-Check)
//   Step 4: Fristen diese Woche (Vorausschauen)
//   Done:   Heute bereits erledigt (Erfolg)
// ═══════════════════════════════════════════════

// Kollabierte Steps merken (UI-State)
let collapsedSteps = JSON.parse(localStorage.getItem('workflow_collapsed') || '[]');

function renderHeuteListe() {
  const t = today();
  const vorgaenge = window.vorgaenge;
  
  // Schritt 1: Neue / Ungeprüfte (Triage)
  const step1Items = vorgaenge.filter(v => v.status === 'neu');
  
  // Schritt 2: Wiedervorlagen heute
  const step2Items = vorgaenge.filter(v => 
    v.wiedervorlage === t && 
    v.status !== 'erledigt' && 
    v.status !== 'archiviert'
  );
  
  // Schritt 3: Kritische Vorgänge (Prio A, nicht erledigt)
  const step3Items = vorgaenge.filter(v => 
    v.prioritaet === 'A' && 
    !['erledigt', 'archiviert'].includes(v.status)
  );
  
  // Schritt 4: Fristen diese Woche (≤7 Tage)
  const step4Items = vorgaenge.filter(v => {
    if (!v.frist || v.status === 'erledigt' || v.status === 'archiviert') return false;
    const days = daysUntil(v.frist);
    return days >= 0 && days <= 7;
  });
  
  // Done: Heute erledigt
  const doneItems = vorgaenge.filter(v => 
    v.status === 'erledigt' && 
    v.letzteAktivitaet === t
  );
  
  // Workflow-Header (Progress-Übersicht)
  renderWorkflowHeader([step1Items, step2Items, step3Items, step4Items]);
  
  // Steps rendern
  renderWorkflowStep(1, step1Items);
  renderWorkflowStep(2, step2Items);
  renderWorkflowStep(3, step3Items);
  renderWorkflowStep(4, step4Items);
  renderDoneStack(doneItems);
}

function renderWorkflowHeader(allSteps) {
  const header = document.getElementById('workflowHeader');
  if (!header) return;
  
  const totalItems = allSteps.reduce((sum, items) => sum + items.length, 0);
  const completedSteps = allSteps.filter(items => items.length === 0).length;
  
  // Geschätzte Zeit: 2-3 min pro Vorgang + Basisaufwand
  const estimatedMinutes = totalItems === 0 ? 0 : Math.max(5, Math.min(30, totalItems * 2));
  
  const progressDots = allSteps.map((items, idx) => {
    const status = items.length === 0 ? 'done' : (idx === 0 ? 'active' : '');
    return `<div class="workflow-progress-step ${status}"></div>`;
  }).join('');
  
  header.innerHTML = `
    <div class="workflow-header-left">
      <span class="workflow-header-icon">☀</span>
      <div>
        <div class="workflow-header-title">Morgen-Routine</div>
        <div class="workflow-header-time">
          ${totalItems === 0 
            ? 'Alles erledigt — frischer Tag' 
            : `${totalItems} Vorgänge offen · ca. ${estimatedMinutes} min`
          }
        </div>
      </div>
    </div>
    <div class="workflow-progress" title="Fortschritt: ${completedSteps}/4 Schritte erledigt">
      ${progressDots}
    </div>
  `;
}

function renderWorkflowStep(stepNum, items) {
  const stepEl = document.getElementById(`step${stepNum}`);
  if (!stepEl) return;
  
  // Counter
  const countEl = stepEl.querySelector('.workflow-step-count');
  if (countEl) {
    countEl.textContent = items.length;
    countEl.className = 'workflow-step-count';
    if (items.length > 0) {
      countEl.classList.add(stepNum === 3 ? 'urgent' : 'has-items');
    }
  }
  
  // Collapsed-State wiederherstellen
  const isCollapsed = collapsedSteps.includes(stepNum);
  stepEl.classList.toggle('collapsed', isCollapsed);
  
  // Content
  const contentEl = stepEl.querySelector('.workflow-step-content');
  if (!contentEl) return;
  
  if (!items.length) {
    contentEl.innerHTML = '<div class="workflow-empty">Erledigt — nichts zu tun</div>';
    stepEl.classList.add('completed');
    return;
  }
  
  stepEl.classList.remove('completed');
  
  // Sortieren nach Priorität (A vor B vor C), dann nach Frist
  items.sort((a, b) => {
    const order = { 'A': 0, 'B': 1, 'C': 2 };
    const pa = order[a.prioritaet] ?? 9;
    const pb = order[b.prioritaet] ?? 9;
    if (pa !== pb) return pa - pb;
    return daysUntil(a.frist) - daysUntil(b.frist);
  });
  
  contentEl.innerHTML = `
    <div class="workflow-step-content-grid">
      ${items.map(v => renderWorkflowItem(v)).join('')}
    </div>
  `;
}

function renderWorkflowItem(v) {
  const overdue = v.frist && daysUntil(v.frist) < 0;
  const days = v.frist ? daysUntil(v.frist) : null;
  const prioClass = v.prioritaet ? `prio-${v.prioritaet.toLowerCase()}` : '';
  
  let fristText = '—';
  let fristClass = '';
  if (v.frist) {
    if (overdue) {
      fristText = `⚠ überfällig ${Math.abs(days)}d`;
      fristClass = 'urgent';
    } else if (days === 0) {
      fristText = 'heute fällig';
      fristClass = 'urgent';
    } else if (days <= 3) {
      fristText = `in ${days}d (${fmt(v.frist)})`;
      fristClass = 'amber';
    } else {
      fristText = `in ${days}d`;
    }
  }
  
  return `
    <div class="workflow-item ${prioClass} ${overdue ? 'overdue' : ''}" 
         onclick="openVorgangDrawer('${v.id}')">
      <div class="workflow-item-title">
        <span class="workflow-item-title-text">${esc(v.thema)}</span>
        <span class="workflow-item-prio ${v.prioritaet.toLowerCase()}">${v.prioritaet}</span>
      </div>
      <div class="workflow-item-meta">
        <span class="workflow-item-anlage">${esc(v.anlage)} · ${esc(v.vorgangsNr)}</span>
        <span class="workflow-item-frist ${fristClass}">${fristText}</span>
      </div>
    </div>
  `;
}

function renderDoneStack(items) {
  const stepEl = document.getElementById('stepDone');
  if (!stepEl) return;
  
  const countEl = stepEl.querySelector('.workflow-step-count');
  if (countEl) {
    countEl.textContent = items.length;
    countEl.className = 'workflow-step-count' + (items.length > 0 ? ' has-items' : '');
  }
  
  const contentEl = stepEl.querySelector('.workflow-step-content');
  if (!contentEl) return;
  
  if (!items.length) {
    contentEl.innerHTML = '<div class="workflow-empty" style="padding:14px">Noch nichts erledigt heute</div>';
    contentEl.querySelector('.workflow-empty').style.color = 'var(--text3)';
    return;
  }
  
  contentEl.innerHTML = `
    <div class="workflow-done-stack">
      ${items.map(v => `
        <div class="workflow-done-item" onclick="openVorgangDrawer('${v.id}')" 
             title="${esc(v.vorgangsNr)} · ${esc(v.anlage)}">
          ${esc(v.thema)}
        </div>
      `).join('')}
    </div>
  `;
}

// Collapse/Expand
function toggleWorkflowStep(stepNum) {
  const stepEl = document.getElementById(`step${stepNum}`) || document.getElementById('stepDone');
  if (!stepEl) return;
  
  const isCollapsed = stepEl.classList.toggle('collapsed');
  
  if (stepNum === 'done') return; // Done-Stack speichern wir nicht
  
  if (isCollapsed && !collapsedSteps.includes(stepNum)) {
    collapsedSteps.push(stepNum);
  } else if (!isCollapsed) {
    collapsedSteps = collapsedSteps.filter(s => s !== stepNum);
  }
  
  localStorage.setItem('workflow_collapsed', JSON.stringify(collapsedSteps));
}

// ═══════════════════════════════════════════════
// AKTIV-VIEW (Kanban-Style für Vorgänge)
// ═══════════════════════════════════════════════
const AKTIV_COLS = [
  { id: 'neu',            label: 'Neu',           short: 'Triage' },
  { id: 'bewertet',       label: 'Bewertet',      short: 'Eingeordnet' },
  { id: 'inbearbeitung',  label: 'In Bearbeitung', short: 'Aktiv' },
  { id: 'wartet-firma',   label: 'Wartet Firma',  short: 'Extern' },
  { id: 'wartet-intern',  label: 'Wartet Intern', short: 'Intern' },
  { id: 'entscheidung',   label: 'Entscheidung',  short: 'Zur Freigabe' },
  { id: 'parken',         label: 'Parken',        short: 'Später' }
];

// WIP-Hinweise (Soft-Limits)
const AKTIV_WIP = {
  'inbearbeitung': 5,
  'wartet-firma': 8,
  'wartet-intern': 5
};

function renderAktivBoard() {
  const board = document.getElementById('aktivBoard');
  if (!board) return;
  
  board.innerHTML = AKTIV_COLS.map(col => {
    const items = window.vorgaenge.filter(v => v.status === col.id);
    
    // Sortieren: Priorität → Frist
    items.sort((a, b) => {
      const order = { 'A': 0, 'B': 1, 'C': 2 };
      const pa = order[a.prioritaet] ?? 9;
      const pb = order[b.prioritaet] ?? 9;
      if (pa !== pb) return pa - pb;
      return daysUntil(a.frist) - daysUntil(b.frist);
    });
    
    const wipLimit = AKTIV_WIP[col.id];
    const isOverWip = wipLimit && items.length > wipLimit;
    const countClass = isOverWip ? 'warn' : (items.length > 0 ? 'has-items' : '');
    
    const cardsHtml = items.length 
      ? items.map(v => renderAktivCard(v)).join('')
      : '<div class="aktiv-empty">— leer —</div>';
    
    return `
      <div class="aktiv-col" data-status="${col.id}">
        <div class="aktiv-col-head">
          <div class="aktiv-col-title">${esc(col.label)}</div>
          <div class="aktiv-col-count ${countClass}" 
               title="${wipLimit ? `WIP-Limit: ${wipLimit}` : ''}">${items.length}${wipLimit ? '/' + wipLimit : ''}</div>
        </div>
        <div class="aktiv-col-body" data-status-target="${col.id}">
          ${cardsHtml}
        </div>
      </div>
    `;
  }).join('');
  
  setupAktivDragDrop();
}

function renderAktivCard(v) {
  const overdue = v.frist && daysUntil(v.frist) < 0;
  const days = v.frist ? daysUntil(v.frist) : null;
  
  let fristText = '';
  let fristClass = '';
  if (v.frist) {
    if (overdue) {
      fristText = `⚠ ${Math.abs(days)}d`;
      fristClass = 'urgent';
    } else if (days === 0) {
      fristText = 'heute';
      fristClass = 'urgent';
    } else if (days <= 3) {
      fristText = `${days}d`;
      fristClass = 'amber';
    } else if (days <= 14) {
      fristText = `${days}d`;
    } else {
      fristText = fmt(v.frist);
    }
  } else {
    fristText = '—';
  }
  
  return `
    <div class="aktiv-card prio-${v.prioritaet.toLowerCase()} ${overdue ? 'overdue' : ''}" 
         draggable="true"
         data-vorgang-id="${v.id}"
         onclick="openVorgangDrawer('${v.id}')">
      <div class="aktiv-card-header">
        <span class="aktiv-card-nr">${esc(v.vorgangsNr)}</span>
        <span class="aktiv-card-prio ${v.prioritaet.toLowerCase()}">${v.prioritaet}</span>
      </div>
      <div class="aktiv-card-title">${esc(v.thema)}</div>
      <div class="aktiv-card-meta">
        <span class="aktiv-card-anlage">${esc(v.anlage)}</span>
        <span class="aktiv-card-frist ${fristClass}">${fristText}</span>
      </div>
    </div>
  `;
}

// ─── Drag & Drop für AKTIV-Board ───
function setupAktivDragDrop() {
  // Karten als Drag-Quellen
  document.querySelectorAll('.aktiv-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      e.stopPropagation();
      const id = card.getAttribute('data-vorgang-id');
      e.dataTransfer.setData('vorgangId', id);
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => card.classList.add('dragging'), 0);
    });
    
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  });
  
  // Spalten als Drop-Ziele
  document.querySelectorAll('.aktiv-col-body').forEach(body => {
    body.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      body.classList.add('drag-over');
    });
    
    body.addEventListener('dragleave', e => {
      // Nur entfernen wenn wir wirklich raus sind (nicht beim Hover über Karten)
      if (!body.contains(e.relatedTarget)) {
        body.classList.remove('drag-over');
      }
    });
    
    body.addEventListener('drop', e => {
      e.preventDefault();
      body.classList.remove('drag-over');
      
      const id = e.dataTransfer.getData('vorgangId');
      const newStatus = body.getAttribute('data-status-target');
      
      const v = window.vorgaenge.find(x => x.id === id);
      if (!v || v.status === newStatus) return;
      
      const t = today();
      const oldStatus = v.status;
      const oldLabel = V_STATUS.find(s => s.id === oldStatus)?.label || oldStatus;
      const newLabel = V_STATUS.find(s => s.id === newStatus)?.label || newStatus;
      
      v.status = newStatus;
      v.letzteAktivitaet = t;
      v.log = `${t}: Status: ${oldLabel} → ${newLabel} (Drag & Drop)\n` + (v.log || '');
      
      saveDataVorgaenge();
      renderAktivBoard();  // Neu rendern
      renderVorgaengeTab(); // Counter etc. aktualisieren
    });
  });
}
// ═══════════════════════════════════════════════
// VORGANGS-REGISTER (Tabelle mit Filtern)
// ═══════════════════════════════════════════════
function renderVorgaengeRegister() {
  const container = document.getElementById('vorgaengeList');
  if (!container) return;
  
  // Filter anwenden
  let filtered = [...window.vorgaenge];
  const themaFilter = document.getElementById('filterThema')?.value || '';
  const statusFilter = document.getElementById('filterStatus')?.value || '';
  const prioFilter = document.getElementById('filterPrio')?.value || '';
  const anlageFilter = document.getElementById('filterAnlage')?.value || '';
  
  if (themaFilter) {
    filtered = filtered.filter(v => 
      v.thema.toLowerCase().includes(themaFilter.toLowerCase())
    );
  }
  if (statusFilter) filtered = filtered.filter(v => v.status === statusFilter);
  if (prioFilter) filtered = filtered.filter(v => v.prioritaet === prioFilter);
  if (anlageFilter) filtered = filtered.filter(v => v.anlage === anlageFilter);
  
  // Sortieren: Priorität asc, dann Frist asc
  filtered.sort((a, b) => {
    const order = { 'A': 0, 'B': 1, 'C': 2 };
    const pa = order[a.prioritaet] ?? 9;
    const pb = order[b.prioritaet] ?? 9;
    if (pa !== pb) return pa - pb;
    return daysUntil(a.frist) - daysUntil(b.frist);
  });
  
  if (!filtered.length) {
    container.innerHTML = '<div class="empty">— keine Vorgänge —</div>';
    return;
  }
  
  container.innerHTML = filtered.map(v => {
    const dueClass_ = dueClass(v.frist);
    const urgentClass = dueClass_ === 'due-red' ? 'urgent' : '';
    const overdue = v.frist && daysUntil(v.frist) < 0;
    
    return `
      <div class="vorgangs-row" onclick="openVorgangDrawer('${v.id}')">
        <div class="vorgangs-cell mono">${esc(v.vorgangsNr)}</div>
        <div class="vorgangs-cell"><strong>${esc(v.anlage)}</strong></div>
        <div class="vorgangs-cell thema">${esc(v.thema)}</div>
        <div class="vorgangs-cell">
          <span class="prio-badge ${v.prioritaet.toLowerCase()}">${v.prioritaet}</span>
        </div>
        <div class="vorgangs-cell">
          <span class="v-status-badge v-status-${v.status}">${V_STATUS.find(s => s.id === v.status)?.label || v.status}</span>
        </div>
        <div class="vorgangs-cell ${urgentClass}">
          ${v.frist ? `${overdue ? '⚠ ' : ''}<strong>${fmt(v.frist)}</strong>` : '—'}
        </div>
        <div class="vorgangs-cell mono">${esc(v.verantwortlich)}</div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════
// VORGÄNGE-TAB HAUPT-RENDER
// ═══════════════════════════════════════════════
function renderVorgaengeTab() {
  // Stats updaten
  const countEl = document.getElementById('vorgaengeCount');
  if (countEl) countEl.textContent = window.vorgaenge.length;
  
  renderHeuteListe();
  
  if (currentViewVorgaenge === 'all') {
    renderVorgaengeRegister();
  }
}

// ═══════════════════════════════════════════════
// VIEW TOGGLE
// ═══════════════════════════════════════════════
function setVorgaengeView(view) {
  currentViewVorgaenge = view;
  
  document.querySelectorAll('.view-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-view') === view);
  });
  
  document.getElementById('heute-view').style.display = view === 'heute' ? 'flex' : 'none';
  document.getElementById('aktiv-view').style.display = view === 'aktiv' ? 'block' : 'none';
  document.getElementById('all-view').style.display = view === 'all' ? 'block' : 'none';
  
  if (view === 'all') {
    renderVorgaengeRegister();
  } else if (view === 'aktiv') {
    renderAktivBoard();
  }
  
  // Persist gewählte View
  localStorage.setItem('vorgaengeView', view);
}

// ═══════════════════════════════════════════════
// NEUER VORGANG MODAL
// ═══════════════════════════════════════════════
function openNewVorgangModal() {
  // Form leeren
  ['vAnlage', 'vThema', 'vKategorie', 'vNaechsterSchritt', 'vVerantwortlich', 'vFrist', 'vWiedervorlage', 'vNachweis']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  document.getElementById('vPrioritaet').value = 'C';
  
  document.getElementById('vorgangModalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('vThema')?.focus(), 50);
}

function closeNewVorgangModal() {
  document.getElementById('vorgangModalOverlay').classList.remove('open');
}

function closeVorgangModalIfBg(e) {
  if (e.target === document.getElementById('vorgangModalOverlay')) closeNewVorgangModal();
}

function saveNewVorgang() {
  const thema = document.getElementById('vThema').value.trim();
  const liegenschaft = document.getElementById('vLiegenschaft').value;
  const anlage = document.getElementById('vAnlage').value;
  const kategorie = document.getElementById('vKategorie').value;
  const naechsterSchritt = document.getElementById('vNaechsterSchritt').value.trim();
  const verantwortlich = document.getElementById('vVerantwortlich').value;
  
  if (!thema || !liegenschaft || !anlage || !kategorie || !naechsterSchritt || !verantwortlich) {
    alert('Bitte alle Pflichtfelder ausfüllen (Liegenschaft, Anlage, Thema, Kategorie, Nächster Schritt, Verantwortlich)');
    return;
  }
  
  const t = today();
  const newVorgang = {
    id: uid(),
    vorgangsNr: generateVorgangsNr(),
    liegenschaft: liegenschaft,
    anlage: anlage,
    thema: thema,
    kategorie: kategorie,
    prioritaet: document.getElementById('vPrioritaet').value,
    status: 'neu',
    naechsterSchritt: naechsterSchritt,
    verantwortlich: verantwortlich,
    frist: document.getElementById('vFrist').value || null,
    wiedervorlage: document.getElementById('vWiedervorlage').value || null,
    nachweis: document.getElementById('vNachweis').value.trim() || null,
    letzteAktivitaet: t,
    abschlussVermerk: null,
    schritte: [],
    schritteDone: 0,
    log: `${t}: Vorgang angelegt`
  };
  
  window.vorgaenge.push(newVorgang);
  
  // Hook: Mail-Capture (falls aktiv)
  if (typeof attachMailToNewVorgang === 'function') {
    attachMailToNewVorgang(newVorgang);
  }
  
  saveDataVorgaenge();
  closeNewVorgangModal();
  renderVorgaengeTab();
  
  // Bestätigung wenn aus Mail erstellt
  if (typeof showCaptureToast === 'function' && newVorgang.mails && newVorgang.mails.length > 0) {
    showCaptureToast(`✓ Vorgang ${newVorgang.vorgangsNr} aus Mail erstellt`);
  }
}

// ═══════════════════════════════════════════════
// VORGANG DETAIL DRAWER
// ═══════════════════════════════════════════════
function openVorgangDrawer(vorgangId) {
  drawerVorgangId = vorgangId;
  const v = window.vorgaenge.find(x => x.id === vorgangId);
  if (!v) return;
  
  const dc = dueClass(v.frist);
  const overdue = v.frist && daysUntil(v.frist) < 0;
  const statusObj = V_STATUS.find(s => s.id === v.status);
  
  document.getElementById('vDrawerTitle').textContent = `${v.vorgangsNr} — ${v.thema}`;
  
  const logLines = (v.log || '').split('\n').filter(Boolean).map((l, idx) => {
    const m = l.match(/^(\d{4}-\d{2}-\d{2}):\s*(.+)$/);
    const dateSpan = m ? `<span class="log-date">${m[1]}</span>` : '';
    const textSpan = `<span class="log-text">${esc(m ? m[2] : l)}</span>`;
    return `<div class="log-entry">
      <div class="log-entry-content">${dateSpan}${textSpan}</div>
      <div class="log-entry-actions">
        <button class="log-entry-btn" onclick="editVorgangLogEntry(event,${idx})" title="Bearbeiten">✎</button>
        <button class="log-entry-btn del" onclick="deleteVorgangLogEntry(${idx})" title="Löschen">✕</button>
      </div>
    </div>`;
  }).join('');
  
  // Schritte vorbereiten (wie im Kanban)
  const schritte = v.schritte || [];
  const done = v.schritteDone || 0;
  const totalSchritte = schritte.length + done;
  const nextStep = schritte.length ? schritte[0] : (v.naechsterSchritt || '—');

  const schritteHtml = schritte.map((s, idx) => `
    <div class="schritt-item" data-idx="${idx}">
      <div class="schritt-check" onclick="checkVorgangSchritt(${idx})" title="Abhaken">✓</div>
      <div class="schritt-text" onclick="editVorgangSchritt(${idx})" title="Klicken zum Bearbeiten">${esc(s)}</div>
      <button class="schritt-del ins" onclick="insertVorgangSchrittAbove(${idx})" title="Schritt davor einfügen">↑+</button>
      <button class="schritt-del ins" onclick="insertVorgangSchritt(${idx})" title="Schritt darunter einfügen">+</button>
      <button class="schritt-del" onclick="deleteVorgangSchritt(${idx})" title="Entfernen">✕</button>
    </div>`).join('');

  const schritteProgressHtml = totalSchritte > 0
    ? `<div class="schritt-progress">
        <span>${done}/${totalSchritte} erledigt</span>
        <div class="schritt-progress-bar"><div class="schritt-progress-fill" style="width:${Math.round(done / totalSchritte * 100)}%"></div></div>
       </div>`
    : '';

  document.getElementById('vDrawerBody').innerHTML = `
    <div class="drawer-section">
      <div class="drawer-section-title">Metadaten</div>
      <div class="drawer-grid">
        <div>
          <div class="dfield-label">Vorgangs-Nr</div>
          <div class="dfield-val">${esc(v.vorgangsNr)}</div>
        </div>
        <div>
          <div class="dfield-label">Liegenschaft</div>
          <div class="dfield-val">${esc(v.liegenschaft || '—')}</div>
        </div>
        <div>
          <div class="dfield-label">Anlage</div>
          <div class="dfield-val"><strong>${esc(v.anlage)}</strong></div>
        </div>
        <div>
          <div class="dfield-label">Kategorie</div>
          <div class="dfield-val">${esc(v.kategorie)}</div>
        </div>
        <div>
          <div class="dfield-label">Priorität</div>
          <div class="dfield-val"><span class="prio-badge ${v.prioritaet.toLowerCase()}">${v.prioritaet}</span></div>
        </div>
        <div>
          <div class="dfield-label">Status</div>
          <div class="dfield-val"><span class="v-status-badge v-status-${v.status}">${statusObj?.label || v.status}</span></div>
        </div>
        <div>
          <div class="dfield-label">Verantwortlich</div>
          <div class="dfield-val">${esc(v.verantwortlich)}</div>
        </div>
        <div>
          <div class="dfield-label">Frist</div>
          <div class="dfield-val ${overdue ? 'red' : (dc === 'due-amber' ? 'amber' : '')}">
            ${v.frist ? `${overdue ? '⚠ ' : ''}${fmtLong(v.frist)}` : '—'}
          </div>
        </div>
        <div>
          <div class="dfield-label">Wiedervorlage</div>
          <div class="dfield-val">${v.wiedervorlage ? fmtLong(v.wiedervorlage) : '—'}</div>
        </div>
      </div>
    </div>
    
    <div class="drawer-section">
      <div class="drawer-section-title">Nächster Schritt</div>
      <div class="next-step-box">${esc(nextStep)}</div>
    </div>
    
    <div class="drawer-section">
      <div class="drawer-section-title">Schritte${totalSchritte > 0 ? ' (' + done + '/' + totalSchritte + ')' : ''}</div>
      ${schritteHtml || '<div style="color:var(--text3);font-size:11px">Noch keine Schritte geplant.</div>'}
      ${schritteProgressHtml}
      <div class="schritt-add">
        <input type="text" id="vSchrittInput" placeholder="Neuen Schritt hinzufügen…" onkeydown="if(event.key==='Enter')addVorgangSchritt()">
        <button class="btn" onclick="addVorgangSchritt()">+ Schritt</button>
      </div>
    </div>
    
    ${v.nachweis ? `
    <div class="drawer-section">
      <div class="drawer-section-title">Nachweis / Referenz</div>
      <div class="dfield-val">${esc(v.nachweis)}</div>
    </div>
    ` : ''}
    
    ${v.abschlussVermerk ? `
    <div class="drawer-section">
      <div class="drawer-section-title">Abschlussvermerk</div>
      <div class="dfield-val">${esc(v.abschlussVermerk)}</div>
    </div>
    ` : ''}
    
    ${v.mails && v.mails.length > 0 ? `
    <div class="drawer-section">
      <div class="drawer-section-title">📧 Verknüpfte E-Mails (${v.mails.length})</div>
      <div class="vorgang-mails">
        ${v.mails.map(m => `
          <div class="vorgang-mail">
            <div class="vorgang-mail-header">
              <span class="vorgang-mail-from">${esc(m.fromName || m.from || '—')}</span>
              <span class="vorgang-mail-date">${m.date ? fmt(m.date) : '—'}</span>
            </div>
            <div class="vorgang-mail-subject">${esc(m.subject || '')}</div>
            ${m.bodySnippet ? `<div class="vorgang-mail-body">${esc(m.bodySnippet.slice(0, 300))}${m.bodySnippet.length > 300 ? '…' : ''}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    <div class="drawer-section">
      <div class="drawer-section-title">Status ändern</div>
      <select id="vStatusChange" onchange="changeVorgangStatus('${v.id}', this.value)" 
        style="width:100%;background:var(--el-3);border:1px solid var(--line2);border-radius:4px;color:var(--text);font-family:var(--sans);font-size:12px;padding:8px 11px;outline:none">
        ${V_STATUS.map(s => `<option value="${s.id}" ${s.id === v.status ? 'selected' : ''}>${s.label}</option>`).join('')}
      </select>
    </div>
    
    <div class="drawer-section">
      <div class="drawer-section-title">Log / Chronik</div>
      <div>${logLines || '<div style="color:var(--text3);font-size:11px">Noch kein Eintrag.</div>'}</div>
      <div class="log-add">
        <input type="text" id="vLogInput" placeholder="Neuer Log-Eintrag…" onkeydown="if(event.key==='Enter')addVorgangLog()">
        <button class="btn" onclick="addVorgangLog()">+ Log</button>
      </div>
    </div>
    
    <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:8px">
      Letzte Aktivität: ${v.letzteAktivitaet || '—'}
    </div>
  `;
  
  document.getElementById('vDrawerOverlay').classList.add('open');
  document.getElementById('vDrawer').classList.add('open');
}

function closeVorgangDrawer() {
  document.getElementById('vDrawerOverlay').classList.remove('open');
  document.getElementById('vDrawer').classList.remove('open');
  drawerVorgangId = null;
}

function changeVorgangStatus(id, newStatus) {
  const v = window.vorgaenge.find(x => x.id === id);
  if (!v) return;
  const t = today();
  const oldStatus = v.status;
  const oldLabel = V_STATUS.find(s => s.id === oldStatus)?.label || oldStatus;
  const newLabel = V_STATUS.find(s => s.id === newStatus)?.label || newStatus;
  
  v.status = newStatus;
  v.letzteAktivitaet = t;
  v.log = `${t}: Status: ${oldLabel} → ${newLabel}\n` + (v.log || '');
  
  saveDataVorgaenge();
  renderVorgaengeTab();
  openVorgangDrawer(id);  // refresh drawer
}

function addVorgangLog() {
  const input = document.getElementById('vLogInput');
  const text = (input.value || '').trim();
  if (!text) return;
  const v = window.vorgaenge.find(x => x.id === drawerVorgangId);
  if (!v) return;
  const t = today();
  v.log = `${t}: ${text}` + (v.log ? '\n' + v.log : '');
  v.letzteAktivitaet = t;
  saveDataVorgaenge();
  openVorgangDrawer(drawerVorgangId);
}

// Log-Eintrag bearbeiten (Inline-Edit)
function editVorgangLogEntry(e, idx) {
  e.stopPropagation();
  const v = window.vorgaenge.find(x => x.id === drawerVorgangId);
  if (!v) return;
  const lines = (v.log || '').split('\n').filter(Boolean);
  if (idx >= lines.length) return;

  const entryDiv = e.currentTarget.closest('.log-entry');
  const content = entryDiv.querySelector('.log-entry-content');
  const actions = entryDiv.querySelector('.log-entry-actions');

  // Schon im Edit-Modus?
  if (content.querySelector('.log-edit-input')) return;

  const m = lines[idx].match(/^(\d{4}-\d{2}-\d{2}):\s*(.+)$/);
  const currentText = m ? m[2] : lines[idx];
  const prefix = m ? m[1] + ': ' : '';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'log-edit-input';
  input.value = currentText;
  content.appendChild(input);
  input.focus();
  input.select();
  actions.style.opacity = '1';

  const editBtn = e.currentTarget;
  const originalIcon = editBtn.textContent;
  editBtn.textContent = '✓';
  editBtn.onclick = null;
  
  function save() {
    const newText = input.value.trim();
    if (newText) lines[idx] = prefix + newText;
    v.log = lines.join('\n');
    v.letzteAktivitaet = today();
    saveDataVorgaenge();
    openVorgangDrawer(drawerVorgangId);
  }
  
  editBtn.addEventListener('click', ev => {
    ev.stopPropagation();
    save();
  });
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') save();
    if (ev.key === 'Escape') openVorgangDrawer(drawerVorgangId);
  });
}

// Log-Eintrag löschen
function deleteVorgangLogEntry(idx) {
  const v = window.vorgaenge.find(x => x.id === drawerVorgangId);
  if (!v) return;
  const lines = (v.log || '').split('\n').filter(Boolean);
  if (idx >= lines.length) return;
  
  if (!confirm('Log-Eintrag wirklich löschen?')) return;
  
  lines.splice(idx, 1);
  v.log = lines.join('\n');
  v.letzteAktivitaet = today();
  saveDataVorgaenge();
  openVorgangDrawer(drawerVorgangId);
}

// ═══════════════════════════════════════════════
// SCHRITTE-VERWALTUNG (analog Kanban)
// ═══════════════════════════════════════════════
function addVorgangSchritt() {
  const input = document.getElementById('vSchrittInput');
  const text = (input.value || '').trim();
  if (!text) return;
  const v = window.vorgaenge.find(x => x.id === drawerVorgangId);
  if (!v) return;
  if (!v.schritte) v.schritte = [];
  v.schritte.push(text);
  v.letzteAktivitaet = today();
  saveDataVorgaenge();
  renderVorgaengeTab();
  openVorgangDrawer(drawerVorgangId);
}

function checkVorgangSchritt(idx) {
  const v = window.vorgaenge.find(x => x.id === drawerVorgangId);
  if (!v || !v.schritte || idx >= v.schritte.length) return;
  const t = today();
  const text = v.schritte[idx];
  v.schritte.splice(idx, 1);
  v.schritteDone = (v.schritteDone || 0) + 1;
  v.log = `${t}: ✓ ${text}\n` + (v.log || '');
  v.letzteAktivitaet = t;
  saveDataVorgaenge();
  renderVorgaengeTab();
  openVorgangDrawer(drawerVorgangId);
}

function deleteVorgangSchritt(idx) {
  const v = window.vorgaenge.find(x => x.id === drawerVorgangId);
  if (!v || !v.schritte || idx >= v.schritte.length) return;
  v.schritte.splice(idx, 1);
  v.letzteAktivitaet = today();
  saveDataVorgaenge();
  renderVorgaengeTab();
  openVorgangDrawer(drawerVorgangId);
}

// Schritt bearbeiten (Inline-Edit)
function editVorgangSchritt(idx) {
  const v = window.vorgaenge.find(x => x.id === drawerVorgangId);
  if (!v || !v.schritte || idx >= v.schritte.length) return;
  
  const items = document.querySelectorAll('#vDrawerBody .schritt-item');
  const target = Array.from(items).find(el => parseInt(el.dataset.idx) === idx);
  if (!target) return;
  
  // Prüfen ob bereits im Edit-Modus
  if (target.querySelector('.schritt-edit-input')) return;
  
  const textEl = target.querySelector('.schritt-text');
  const currentText = v.schritte[idx];
  
  // Input-Feld erstellen und ersetzen
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'schritt-edit-input';
  input.value = currentText;
  input.style.cssText = 'flex:1;background:var(--el-2);border:1px solid var(--amber-rim);border-radius:3px;color:var(--text);font-family:var(--sans);font-size:11px;padding:5px 8px;outline:none';
  
  textEl.style.display = 'none';
  textEl.parentNode.insertBefore(input, textEl);
  input.focus();
  input.select();
  
  function saveEdit() {
    const newText = input.value.trim();
    if (newText && newText !== currentText) {
      v.schritte[idx] = newText;
      v.letzteAktivitaet = today();
      saveDataVorgaenge();
      renderVorgaengeTab();
    }
    openVorgangDrawer(drawerVorgangId);
  }
  
  function cancelEdit() {
    input.remove();
    textEl.style.display = '';
  }
  
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  });
  input.addEventListener('blur', saveEdit);
}

// Zwischenschritt DARUNTER einfügen
function insertVorgangSchritt(idx) {
  const items = document.querySelectorAll('#vDrawerBody .schritt-item');
  const target = Array.from(items).find(el => parseInt(el.dataset.idx) === idx);
  if (!target) return;
  
  // Bestehende Insert-Row entfernen falls vorhanden
  document.querySelectorAll('#vDrawerBody .schritt-insert-row').forEach(r => r.remove());

  const row = createSchrittInsertRow(idx + 1, 'darunter');
  target.after(row);
  row.querySelector('input').focus();
}

// Zwischenschritt DAVOR einfügen
function insertVorgangSchrittAbove(idx) {
  const items = document.querySelectorAll('#vDrawerBody .schritt-item');
  const target = Array.from(items).find(el => parseInt(el.dataset.idx) === idx);
  if (!target) return;
  
  // Bestehende Insert-Row entfernen falls vorhanden
  document.querySelectorAll('#vDrawerBody .schritt-insert-row').forEach(r => r.remove());

  const row = createSchrittInsertRow(idx, 'davor');
  target.before(row);
  row.querySelector('input').focus();
}

// Helper: Insert-Row HTML-Element bauen
function createSchrittInsertRow(insertAtIdx, position) {
  const row = document.createElement('div');
  row.className = 'schritt-insert-row schritt-add';
  row.style.margin = '6px 0';
  row.innerHTML = `
    <input type="text" placeholder="Zwischenschritt ${position} einfügen…"
      style="flex:1;background:var(--el-3);border:1px solid var(--green-rim);border-radius:4px;color:var(--text);font-family:var(--sans);font-size:11px;padding:6px 9px;outline:none">
    <button class="btn" style="font-size:9px;padding:3px 8px">↵</button>
    <button class="btn" style="font-size:9px;padding:3px 8px" title="Abbrechen">✕</button>`;
  
  const input = row.querySelector('input');
  const btnSave = row.querySelectorAll('button')[0];
  const btnCancel = row.querySelectorAll('button')[1];
  
  function doInsert() {
    const text = input.value.trim();
    if (!text) { row.remove(); return; }
    const v = window.vorgaenge.find(x => x.id === drawerVorgangId);
    if (!v) return;
    if (!v.schritte) v.schritte = [];
    v.schritte.splice(insertAtIdx, 0, text);
    v.letzteAktivitaet = today();
    saveDataVorgaenge();
    renderVorgaengeTab();
    openVorgangDrawer(drawerVorgangId);
  }
  
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') doInsert();
    if (e.key === 'Escape') row.remove();
  });
  btnSave.addEventListener('click', doInsert);
  btnCancel.addEventListener('click', () => row.remove());
  
  return row;
}

function deleteVorgang() {
  if (!drawerVorgangId) return;
  if (!confirm('Vorgang wirklich löschen?')) return;
  
  deleteVorgangFromFirestore(drawerVorgangId);
  window.vorgaenge = window.vorgaenge.filter(v => v.id !== drawerVorgangId);
  saveLocalVorgaenge();
  closeVorgangDrawer();
  renderVorgaengeTab();
}

// ═══════════════════════════════════════════════
// FILTER LISTENERS (initialisiert in app.js)
// ═══════════════════════════════════════════════
function setupVorgaengeFilters() {
  ['filterThema', 'filterStatus', 'filterPrio', 'filterAnlage'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', renderVorgaengeRegister);
      if (el.type === 'text') {
        el.addEventListener('input', renderVorgaengeRegister);
      }
    }
  });
}

// ═══════════════════════════════════════════════
// EXPORTS (global)
// ═══════════════════════════════════════════════
window.addVorgangSchritt = addVorgangSchritt;
window.checkVorgangSchritt = checkVorgangSchritt;
window.deleteVorgangSchritt = deleteVorgangSchritt;
window.insertVorgangSchritt = insertVorgangSchritt;
window.insertVorgangSchrittAbove = insertVorgangSchrittAbove;
window.editVorgangSchritt = editVorgangSchritt;
window.editVorgangLogEntry = editVorgangLogEntry;
window.deleteVorgangLogEntry = deleteVorgangLogEntry;
window.V_STATUS = V_STATUS;
window.KATEGORIEN = KATEGORIEN;
window.VERANTWORTLICH = VERANTWORTLICH;
window.loadVorgaengeFromFirestore = loadVorgaengeFromFirestore;
window.renderVorgaengeTab = renderVorgaengeTab;
window.setVorgaengeView = setVorgaengeView;
window.openNewVorgangModal = openNewVorgangModal;
window.closeNewVorgangModal = closeNewVorgangModal;
window.closeVorgangModalIfBg = closeVorgangModalIfBg;
window.saveNewVorgang = saveNewVorgang;
window.openVorgangDrawer = openVorgangDrawer;
window.closeVorgangDrawer = closeVorgangDrawer;
window.changeVorgangStatus = changeVorgangStatus;
window.addVorgangLog = addVorgangLog;
window.deleteVorgang = deleteVorgang;
window.setupVorgaengeFilters = setupVorgaengeFilters;
window.toggleWorkflowStep = toggleWorkflowStep;
window.renderAktivBoard = renderAktivBoard;
