// ═══════════════════════════════════════════════
// EINSTELLUNGEN / STAMMDATEN
// 
// Verwaltet:
//   - Anlagen / Liegenschaften
//   - Kategorien
//   - Verantwortliche
//
// Speicherung: Firestore (betrieb-vorgaenge → Collection 'stammdaten')
// Fallback: Lokale Standards wenn nichts in Firestore
// ═══════════════════════════════════════════════

// ─── DEFAULT-WERTE (Fallback) ───
const DEFAULT_STAMMDATEN = {
  anlagen: [
    { id: 'rtg',         name: 'RTG',         description: 'Rückkühltürme Gebäude', sort: 1 },
    { id: 'plh',         name: 'PLH',         description: 'Produktionshalle',      sort: 2 },
    { id: 'mhkw',        name: 'MHKW',        description: 'Müllheizkraftwerk',     sort: 3 },
    { id: 'tankanlage',  name: 'Tankanlage',  description: 'Tankanlage',            sort: 4 },
    { id: 'ga',          name: 'GA',          description: 'Gebäudeautomation',     sort: 5 },
    { id: 'sonstige',    name: 'Sonstige',    description: 'Andere Anlagen',        sort: 99 }
  ],
  kategorien: [
    { id: 'stoerung',     name: 'Störung',       sort: 1 },
    { id: 'wartung',      name: 'Wartung',       sort: 2 },
    { id: 'mangel',       name: 'Mangel',        sort: 3 },
    { id: 'vergabe',      name: 'Vergabe',       sort: 4 },
    { id: 'frist',        name: 'Frist',         sort: 5 },
    { id: 'dokumentation',name: 'Dokumentation', sort: 6 }
  ],
  verantwortliche: [
    { id: 'ich',           name: 'Ich (GW)',      sort: 1 },
    { id: 'meisterbereich',name: 'Meisterbereich', sort: 2 },
    { id: 'firma',         name: 'Externe Firma', sort: 3 },
    { id: 'leitung',       name: 'Leitung',       sort: 4 },
    { id: 'andere',        name: 'Andere SB',     sort: 5 }
  ]
};

// ─── Global State ───
window.stammdaten = {
  anlagen: [],
  kategorien: [],
  verantwortliche: []
};

// ═══════════════════════════════════════════════
// FIRESTORE: STAMMDATEN
// ═══════════════════════════════════════════════
async function loadStammdatenFromFirestore() {
  try {
    const { getDocs } = window._fbFns;
    const { collection } = await import('https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js');
    
    const types = ['anlagen', 'kategorien', 'verantwortliche'];
    let anyLoaded = false;
    
    for (const type of types) {
      const snap = await getDocs(collection(window._db_vorgaenge, `stammdaten_${type}`));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (items.length > 0) {
        window.stammdaten[type] = items.sort((a, b) => (a.sort ?? 99) - (b.sort ?? 99));
        anyLoaded = true;
      } else {
        // Fallback: Defaults laden
        window.stammdaten[type] = DEFAULT_STAMMDATEN[type];
      }
    }
    
    saveLocalStammdaten();
    refreshDropdowns();
    
    if (!anyLoaded) {
      console.log('Keine Stammdaten in Firestore — Defaults werden verwendet.');
    }
  } catch (e) {
    console.error('Stammdaten laden fehlgeschlagen:', e);
    window.stammdaten = loadLocalStammdaten();
    refreshDropdowns();
  }
}

async function saveStammdatumToFirestore(type, item) {
  if (!window._currentUser) return;
  try {
    const { setDoc, doc } = window._fbFns;
    await setDoc(doc(window._db_vorgaenge, `stammdaten_${type}`, item.id), item);
  } catch (e) {
    console.error(`Stammdatum (${type}) speichern fehlgeschlagen:`, e);
  }
}

async function deleteStammdatumFromFirestore(type, id) {
  if (!window._currentUser) return;
  try {
    const { deleteDoc, doc } = window._fbFns;
    await deleteDoc(doc(window._db_vorgaenge, `stammdaten_${type}`, id));
  } catch (e) {
    console.error(`Stammdatum (${type}) löschen fehlgeschlagen:`, e);
  }
}

function saveLocalStammdaten() {
  localStorage.setItem('betrieb_stammdaten', JSON.stringify(window.stammdaten));
}

function loadLocalStammdaten() {
  try {
    const stored = JSON.parse(localStorage.getItem('betrieb_stammdaten'));
    if (stored && stored.anlagen) return stored;
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_STAMMDATEN));
}

// ═══════════════════════════════════════════════
// RENDER EINSTELLUNGS-TAB
// ═══════════════════════════════════════════════
function renderEinstellungenTab() {
  renderStammdatenSection('anlagen', 'anlagenList', 'Anlagen / Liegenschaften', true);
  renderStammdatenSection('kategorien', 'kategorienList', 'Kategorien', false);
  renderStammdatenSection('verantwortliche', 'verantwortlicheList', 'Verantwortliche', false);
}

function renderStammdatenSection(type, containerId, label, hasDescription) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const items = window.stammdaten[type] || [];
  
  if (!items.length) {
    container.innerHTML = `
      <div class="stammdaten-empty">
        Noch keine Einträge.
        <button class="btn btn-primary" onclick="openStammdatumModal('${type}')" style="margin-left:12px">+ Erster Eintrag</button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = items.map(item => `
    <div class="stammdaten-row">
      <div class="stammdaten-row-content">
        <div class="stammdaten-name">${esc(item.name)}</div>
        ${hasDescription && item.description ? `
          <div class="stammdaten-description">${esc(item.description)}</div>
        ` : ''}
      </div>
      <div class="stammdaten-row-actions">
        <button class="btn-icon" onclick="openStammdatumModal('${type}', '${item.id}')" title="Bearbeiten">✎</button>
        <button class="btn-icon btn-icon-danger" onclick="confirmDeleteStammdatum('${type}', '${item.id}')" title="Löschen">✕</button>
      </div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════
// STAMMDATUM MODAL (Neu / Bearbeiten)
// ═══════════════════════════════════════════════
let editingStammdatum = null;

function openStammdatumModal(type, id = null) {
  editingStammdatum = { type, id };
  
  const item = id ? window.stammdaten[type].find(x => x.id === id) : null;
  const isNew = !item;
  
  const labels = {
    anlagen: 'Anlage / Liegenschaft',
    kategorien: 'Kategorie',
    verantwortliche: 'Verantwortliche/r'
  };
  
  document.getElementById('stammdatumModalTitle').textContent = 
    isNew ? `Neue ${labels[type]}` : `${labels[type]} bearbeiten`;
  
  document.getElementById('sName').value = item?.name || '';
  document.getElementById('sDescription').value = item?.description || '';
  
  // Beschreibungs-Feld nur bei Anlagen anzeigen
  document.getElementById('sDescriptionField').style.display = 
    type === 'anlagen' ? 'block' : 'none';
  
  document.getElementById('stammdatumModalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('sName')?.focus(), 50);
}

function closeStammdatumModal() {
  document.getElementById('stammdatumModalOverlay').classList.remove('open');
  editingStammdatum = null;
}

function closeStammdatumModalIfBg(e) {
  if (e.target === document.getElementById('stammdatumModalOverlay')) closeStammdatumModal();
}

function saveStammdatum() {
  if (!editingStammdatum) return;
  
  const { type, id } = editingStammdatum;
  const name = document.getElementById('sName').value.trim();
  const description = document.getElementById('sDescription').value.trim();
  
  if (!name) {
    alert('Bitte einen Namen eingeben.');
    return;
  }
  
  if (id) {
    // Bearbeiten
    const item = window.stammdaten[type].find(x => x.id === id);
    if (!item) return;
    item.name = name;
    if (type === 'anlagen') item.description = description;
    saveStammdatumToFirestore(type, item);
  } else {
    // Neu anlegen
    const newId = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    // Duplikat-Check
    if (window.stammdaten[type].find(x => x.id === newId)) {
      alert('Ein Eintrag mit ähnlichem Namen existiert bereits.');
      return;
    }
    
    const maxSort = window.stammdaten[type].reduce((max, item) => 
      Math.max(max, item.sort ?? 0), 0);
    
    const newItem = {
      id: newId,
      name: name,
      sort: maxSort + 1
    };
    if (type === 'anlagen' && description) {
      newItem.description = description;
    }
    
    window.stammdaten[type].push(newItem);
    saveStammdatumToFirestore(type, newItem);
  }
  
  saveLocalStammdaten();
  closeStammdatumModal();
  renderEinstellungenTab();
  refreshDropdowns();
}

// ═══════════════════════════════════════════════
// STAMMDATUM LÖSCHEN
// ═══════════════════════════════════════════════
function confirmDeleteStammdatum(type, id) {
  const item = window.stammdaten[type].find(x => x.id === id);
  if (!item) return;
  
  // Verwendung prüfen
  const fieldMap = { 
    anlagen: 'anlage', 
    kategorien: 'kategorie', 
    verantwortliche: 'verantwortlich' 
  };
  const field = fieldMap[type];
  const inUse = window.vorgaenge.filter(v => v[field] === item.name);
  
  let msg = `"${item.name}" wirklich löschen?`;
  if (inUse.length > 0) {
    msg += `\n\n⚠ Achtung: Wird in ${inUse.length} Vorgang${inUse.length > 1 ? 'en' : ''} verwendet.`;
    msg += '\nDiese Vorgänge behalten den alten Namen, neue Auswahl ist dann nicht mehr möglich.';
  }
  
  if (!confirm(msg)) return;
  
  window.stammdaten[type] = window.stammdaten[type].filter(x => x.id !== id);
  deleteStammdatumFromFirestore(type, id);
  saveLocalStammdaten();
  renderEinstellungenTab();
  refreshDropdowns();
}

// ═══════════════════════════════════════════════
// DROPDOWNS AKTUALISIEREN
// (im Vorgangs-Modal und Filter im Register)
// ═══════════════════════════════════════════════
function refreshDropdowns() {
  // Modal: Anlagen
  const anlageSel = document.getElementById('vAnlage');
  if (anlageSel) {
    const current = anlageSel.value;
    anlageSel.innerHTML = '<option value="">— Wählen —</option>' +
      window.stammdaten.anlagen.map(a => 
        `<option value="${esc(a.name)}">${esc(a.name)}</option>`
      ).join('');
    if (current) anlageSel.value = current;
  }
  
  // Modal: Kategorien
  const katSel = document.getElementById('vKategorie');
  if (katSel) {
    const current = katSel.value;
    katSel.innerHTML = '<option value="">— Wählen —</option>' +
      window.stammdaten.kategorien.map(k => 
        `<option value="${esc(k.name)}">${esc(k.name)}</option>`
      ).join('');
    if (current) katSel.value = current;
  }
  
  // Modal: Verantwortliche
  const verSel = document.getElementById('vVerantwortlich');
  if (verSel) {
    const current = verSel.value;
    verSel.innerHTML = '<option value="">— Wählen —</option>' +
      window.stammdaten.verantwortliche.map(v => 
        `<option value="${esc(v.name)}">${esc(v.name)}</option>`
      ).join('');
    if (current) verSel.value = current;
  }
  
  // Filter: Anlagen
  const filterAnlage = document.getElementById('filterAnlage');
  if (filterAnlage) {
    const current = filterAnlage.value;
    filterAnlage.innerHTML = '<option value="">Alle Anlagen</option>' +
      window.stammdaten.anlagen.map(a => 
        `<option value="${esc(a.name)}">${esc(a.name)}</option>`
      ).join('');
    if (current) filterAnlage.value = current;
  }
}

// ═══════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════
window.DEFAULT_STAMMDATEN = DEFAULT_STAMMDATEN;
window.loadStammdatenFromFirestore = loadStammdatenFromFirestore;
window.renderEinstellungenTab = renderEinstellungenTab;
window.openStammdatumModal = openStammdatumModal;
window.closeStammdatumModal = closeStammdatumModal;
window.closeStammdatumModalIfBg = closeStammdatumModalIfBg;
window.saveStammdatum = saveStammdatum;
window.confirmDeleteStammdatum = confirmDeleteStammdatum;
window.refreshDropdowns = refreshDropdowns;
