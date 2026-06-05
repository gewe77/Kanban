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

// Anlagen-Liste (anpassbar)
const ANLAGEN = ['RTG', 'PLH', 'MHKW', 'Tankanlage', 'GA', 'Sonstige'];

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
// HEUTE-LISTE
// ═══════════════════════════════════════════════
function renderHeuteListe() {
  const t = today();
  const vorgaenge = window.vorgaenge;
  
  // 1. Wiedervorlagen heute
  const wiedervorlage = vorgaenge.filter(v => 
    v.wiedervorlage === t && v.status !== 'erledigt' && v.status !== 'archiviert'
  );
  renderHeuteSection('wiedervorlageList', 'wiedervorlageCount', wiedervorlage);
  
  // 2. Fristen diese Woche (≤7 Tage, nicht erledigt)
  const fristen = vorgaenge.filter(v => {
    if (!v.frist || v.status === 'erledigt' || v.status === 'archiviert') return false;
    const days = daysUntil(v.frist);
    return days >= 0 && days <= 7;
  });
  renderHeuteSection('fristenList', 'fristenCount', fristen);
  
  // 3. Kritische Vorgänge (Priorität A, nicht erledigt)
  const kritisch = vorgaenge.filter(v => 
    v.prioritaet === 'A' && 
    !['erledigt', 'archiviert'].includes(v.status)
  );
  renderHeuteSection('kritischList', 'kritischCount', kritisch);
  
  // 4. Neue / Ungeprüfte
  const neu = vorgaenge.filter(v => v.status === 'neu');
  renderHeuteSection('neuList', 'neuCount', neu);
}

function renderHeuteSection(containerId, countId, items) {
  const container = document.getElementById(containerId);
  const countSpan = document.getElementById(countId);
  if (!container || !countSpan) return;
  
  countSpan.textContent = items.length;
  
  if (!items.length) {
    container.innerHTML = '<div class="heute-empty">— keine Einträge —</div>';
    return;
  }
  
  // Sortieren nach Priorität
  items.sort((a, b) => {
    const order = { 'A': 0, 'B': 1, 'C': 2 };
    return (order[a.prioritaet] || 9) - (order[b.prioritaet] || 9);
  });
  
  container.innerHTML = items.map(v => {
    const overdue = v.frist && daysUntil(v.frist) < 0;
    const prioClass = v.prioritaet ? `prio-${v.prioritaet.toLowerCase()}` : '';
    
    return `
      <div class="heute-item ${prioClass} ${overdue ? 'urgent' : ''}" onclick="openVorgangDrawer('${v.id}')">
        <div class="heute-item-title">${esc(v.thema)}</div>
        <div class="heute-item-meta">
          <span><strong>${esc(v.vorgangsNr)}</strong></span>
          <span>${esc(v.anlage)}</span>
          <span class="${overdue ? 'urgent' : ''}">${v.frist ? (overdue ? '⚠ ' : '') + fmt(v.frist) : '—'}</span>
          <span>${esc(v.verantwortlich)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════
// VORGANGS-REGISTER (Tabelle)
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
  
  document.getElementById('heute-view').style.display = view === 'heute' ? 'grid' : 'none';
  document.getElementById('all-view').style.display = view === 'all' ? 'block' : 'none';
  
  if (view === 'all') {
    renderVorgaengeRegister();
  }
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
  const anlage = document.getElementById('vAnlage').value;
  const kategorie = document.getElementById('vKategorie').value;
  const naechsterSchritt = document.getElementById('vNaechsterSchritt').value.trim();
  const verantwortlich = document.getElementById('vVerantwortlich').value;
  
  if (!thema || !anlage || !kategorie || !naechsterSchritt || !verantwortlich) {
    alert('Bitte alle Pflichtfelder ausfüllen (Anlage, Thema, Kategorie, Nächster Schritt, Verantwortlich)');
    return;
  }
  
  const t = today();
  const newVorgang = {
    id: uid(),
    vorgangsNr: generateVorgangsNr(),
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
    log: `${t}: Vorgang angelegt`
  };
  
  window.vorgaenge.push(newVorgang);
  saveDataVorgaenge();
  closeNewVorgangModal();
  renderVorgaengeTab();
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
  
  const logLines = (v.log || '').split('\n').filter(Boolean).map(l => {
    const m = l.match(/^(\d{4}-\d{2}-\d{2}):\s*(.+)$/);
    const dateSpan = m ? `<span class="log-date">${m[1]}</span>` : '';
    const textSpan = `<span class="log-text">${esc(m ? m[2] : l)}</span>`;
    return `<div class="log-entry"><div class="log-entry-content">${dateSpan}${textSpan}</div></div>`;
  }).join('');
  
  document.getElementById('vDrawerBody').innerHTML = `
    <div class="drawer-section">
      <div class="drawer-section-title">Metadaten</div>
      <div class="drawer-grid">
        <div>
          <div class="dfield-label">Vorgangs-Nr</div>
          <div class="dfield-val">${esc(v.vorgangsNr)}</div>
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
      <div class="next-step-box">${esc(v.naechsterSchritt)}</div>
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
window.ANLAGEN = ANLAGEN;
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
