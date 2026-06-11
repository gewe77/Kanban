// ═══════════════════════════════════════════════
// EINSTELLUNGEN / STAMMDATEN
// 
// Verwaltet (hierarchisch):
//   - Liegenschaften (oberste Ebene)
//   - Anlagen (je einer Liegenschaft zugeordnet)
//   - Kategorien
//   - Verantwortliche
//
// Speicherung: Firestore (betrieb-vorgaenge)
// Collections: stammdaten_liegenschaften, stammdaten_anlagen,
//              stammdaten_kategorien, stammdaten_verantwortliche
// Fallback: Lokale Standards wenn nichts in Firestore
// ═══════════════════════════════════════════════

// ─── DEFAULT-WERTE (Fallback) ───
const DEFAULT_STAMMDATEN = {
  liegenschaften: [
    { id: 'hauptliegenschaft', name: 'Hauptliegenschaft', description: 'Bitte in Einstellungen anpassen', sort: 1 }
  ],
  anlagen: [
    { id: 'rtg',         name: 'RTG',         description: 'Rückkühltürme Gebäude', liegenschaftId: 'hauptliegenschaft', sort: 1 },
    { id: 'plh',         name: 'PLH',         description: 'Produktionshalle',      liegenschaftId: 'hauptliegenschaft', sort: 2 },
    { id: 'mhkw',        name: 'MHKW',        description: 'Müllheizkraftwerk',     liegenschaftId: 'hauptliegenschaft', sort: 3 },
    { id: 'tankanlage',  name: 'Tankanlage',  description: 'Tankanlage',            liegenschaftId: 'hauptliegenschaft', sort: 4 },
    { id: 'ga',          name: 'GA',          description: 'Gebäudeautomation',     liegenschaftId: 'hauptliegenschaft', sort: 5 },
    { id: 'sonstige',    name: 'Sonstige',    description: 'Andere Anlagen',        liegenschaftId: 'hauptliegenschaft', sort: 99 }
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
  liegenschaften: [],
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
    
    const types = ['liegenschaften', 'anlagen', 'kategorien', 'verantwortliche'];
    let anyLoaded = false;
    
    for (const type of types) {
      const snap = await getDocs(collection(window._db_vorgaenge, `stammdaten_${type}`));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (items.length > 0) {
        window.stammdaten[type] = items.sort((a, b) => (a.sort ?? 99) - (b.sort ?? 99));
        anyLoaded = true;
      } else {
        window.stammdaten[type] = JSON.parse(JSON.stringify(DEFAULT_STAMMDATEN[type]));
      }
    }
    
    // Migration: Anlagen ohne liegenschaftId der ersten Liegenschaft zuordnen
    migrateAnlagenLiegenschaft();
    
    saveLocalStammdaten();
    refreshDropdowns();
    
    if (!anyLoaded) {
      console.log('Keine Stammdaten in Firestore — Defaults werden verwendet.');
    }
  } catch (e) {
    console.error('Stammdaten laden fehlgeschlagen:', e);
    window.stammdaten = loadLocalStammdaten();
    migrateAnlagenLiegenschaft();
    refreshDropdowns();
  }
}

// Migration: Bestehende Anlagen ohne Liegenschafts-Zuordnung
function migrateAnlagenLiegenschaft() {
  if (!window.stammdaten.liegenschaften || window.stammdaten.liegenschaften.length === 0) {
    window.stammdaten.liegenschaften = JSON.parse(JSON.stringify(DEFAULT_STAMMDATEN.liegenschaften));
  }
  const defaultLg = window.stammdaten.liegenschaften[0].id;
  let migrated = false;
  for (const a of window.stammdaten.anlagen) {
    if (!a.liegenschaftId) {
      a.liegenschaftId = defaultLg;
      migrated = true;
      saveStammdatumToFirestore('anlagen', a);
    }
  }
  if (migrated) {
    console.log('Migration: Anlagen ohne Liegenschaft wurden zugeordnet.');
    saveLocalStammdaten();
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
    if (stored && stored.anlagen) {
      // Migrationsfähig: liegenschaften ggf. ergänzen
      if (!stored.liegenschaften) stored.liegenschaften = JSON.parse(JSON.stringify(DEFAULT_STAMMDATEN.liegenschaften));
      return stored;
    }
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_STAMMDATEN));
}

// ═══════════════════════════════════════════════
// HELPER: Liegenschaft einer Anlage finden
// ═══════════════════════════════════════════════
function getLiegenschaftForAnlage(anlageName) {
  const anlage = window.stammdaten.anlagen.find(a => a.name === anlageName);
  if (!anlage || !anlage.liegenschaftId) return null;
  return window.stammdaten.liegenschaften.find(l => l.id === anlage.liegenschaftId) || null;
}

function getAnlagenForLiegenschaft(liegenschaftName) {
  const lg = window.stammdaten.liegenschaften.find(l => l.name === liegenschaftName);
  if (!lg) return [];
  return window.stammdaten.anlagen.filter(a => a.liegenschaftId === lg.id);
}

// ═══════════════════════════════════════════════
// RENDER EINSTELLUNGS-TAB
// ═══════════════════════════════════════════════
function renderEinstellungenTab() {
  renderLiegenschaftenSection();
  renderAnlagenSection();
  renderStammdatenSection('kategorien', 'kategorienList', false);
  renderStammdatenSection('verantwortliche', 'verantwortlicheList', false);
}

// Liegenschaften: einfache Liste
function renderLiegenschaftenSection() {
  const container = document.getElementById('liegenschaftenList');
  if (!container) return;
  
  const items = window.stammdaten.liegenschaften || [];
  
  if (!items.length) {
    container.innerHTML = '<div class="stammdaten-empty">Noch keine Liegenschaften.</div>';
    return;
  }
  
  container.innerHTML = items.map(item => {
    const anlagenCount = window.stammdaten.anlagen.filter(a => a.liegenschaftId === item.id).length;
    return `
    <div class="stammdaten-row">
      <div class="stammdaten-row-content">
        <div class="stammdaten-name">${esc(item.name)} <span style="color:var(--text3);font-size:10px;font-family:var(--mono)">(${anlagenCount} Anlagen)</span></div>
        ${item.description ? `<div class="stammdaten-description">${esc(item.description)}</div>` : ''}
      </div>
      <div class="stammdaten-row-actions">
        <button class="btn-icon" onclick="openStammdatumModal('liegenschaften', '${item.id}')" title="Bearbeiten">✎</button>
        <button class="btn-icon btn-icon-danger" onclick="confirmDeleteStammdatum('liegenschaften', '${item.id}')" title="Löschen">✕</button>
      </div>
    </div>
  `;}).join('');
}

// Anlagen: gruppiert nach Liegenschaft
function renderAnlagenSection() {
  const container = document.getElementById('anlagenList');
  if (!container) return;
  
  const liegenschaften = window.stammdaten.liegenschaften || [];
  const anlagen = window.stammdaten.anlagen || [];
  
  if (!anlagen.length) {
    container.innerHTML = '<div class="stammdaten-empty">Noch keine Anlagen.</div>';
    return;
  }
  
  let html = '';
  
  for (const lg of liegenschaften) {
    const lgAnlagen = anlagen.filter(a => a.liegenschaftId === lg.id);
    if (!lgAnlagen.length) continue;
    
    html += `<div class="anlagen-group-header">📍 ${esc(lg.name)}</div>`;
    html += lgAnlagen.map(item => `
      <div class="stammdaten-row">
        <div class="stammdaten-row-content">
          <div class="stammdaten-name">${esc(item.name)}</div>
          ${item.description ? `<div class="stammdaten-description">${esc(item.description)}</div>` : ''}
        </div>
        <div class="stammdaten-row-actions">
          <button class="btn-icon" onclick="openStammdatumModal('anlagen', '${item.id}')" title="Bearbeiten">✎</button>
          <button class="btn-icon btn-icon-danger" onclick="confirmDeleteStammdatum('anlagen', '${item.id}')" title="Löschen">✕</button>
        </div>
      </div>
    `).join('');
  }
  
  // Anlagen ohne (gültige) Liegenschaft
  const orphans = anlagen.filter(a => !liegenschaften.find(l => l.id === a.liegenschaftId));
  if (orphans.length) {
    html += `<div class="anlagen-group-header" style="color:var(--red-light)">⚠ Ohne Liegenschaft</div>`;
    html += orphans.map(item => `
      <div class="stammdaten-row">
        <div class="stammdaten-row-content">
          <div class="stammdaten-name">${esc(item.name)}</div>
        </div>
        <div class="stammdaten-row-actions">
          <button class="btn-icon" onclick="openStammdatumModal('anlagen', '${item.id}')" title="Bearbeiten">✎</button>
          <button class="btn-icon btn-icon-danger" onclick="confirmDeleteStammdatum('anlagen', '${item.id}')" title="Löschen">✕</button>
        </div>
      </div>
    `).join('');
  }
  
  container.innerHTML = html;
}

// Generische Sektion (Kategorien, Verantwortliche)
function renderStammdatenSection(type, containerId, hasDescription) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const items = window.stammdaten[type] || [];
  
  if (!items.length) {
    container.innerHTML = '<div class="stammdaten-empty">Noch keine Einträge.</div>';
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
    liegenschaften: 'Liegenschaft',
    anlagen: 'Anlage',
    kategorien: 'Kategorie',
    verantwortliche: 'Verantwortliche/r'
  };
  
  document.getElementById('stammdatumModalTitle').textContent = 
    isNew ? `Neue ${labels[type]}` : `${labels[type]} bearbeiten`;
  
  document.getElementById('sName').value = item?.name || '';
  document.getElementById('sDescription').value = item?.description || '';
  
  // Beschreibungs-Feld bei Liegenschaften UND Anlagen anzeigen
  document.getElementById('sDescriptionField').style.display = 
    (type === 'anlagen' || type === 'liegenschaften') ? 'block' : 'none';
  
  // Liegenschafts-Dropdown nur bei Anlagen anzeigen
  const lgField = document.getElementById('sLiegenschaftField');
  if (type === 'anlagen') {
    lgField.style.display = 'block';
    const lgSelect = document.getElementById('sLiegenschaft');
    lgSelect.innerHTML = window.stammdaten.liegenschaften.map(l => 
      `<option value="${l.id}">${esc(l.name)}</option>`
    ).join('');
    if (item?.liegenschaftId) {
      lgSelect.value = item.liegenschaftId;
    }
  } else {
    lgField.style.display = 'none';
  }
  
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
  const liegenschaftId = type === 'anlagen' 
    ? document.getElementById('sLiegenschaft').value 
    : null;
  
  if (!name) {
    alert('Bitte einen Namen eingeben.');
    return;
  }
  
  if (type === 'anlagen' && !liegenschaftId) {
    alert('Bitte eine Liegenschaft auswählen.');
    return;
  }
  
  if (id) {
    // Bearbeiten
    const item = window.stammdaten[type].find(x => x.id === id);
    if (!item) return;
    item.name = name;
    if (type === 'anlagen' || type === 'liegenschaften') item.description = description;
    if (type === 'anlagen') item.liegenschaftId = liegenschaftId;
    saveStammdatumToFirestore(type, item);
  } else {
    // Neu anlegen
    const newId = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
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
    if ((type === 'anlagen' || type === 'liegenschaften') && description) {
      newItem.description = description;
    }
    if (type === 'anlagen') {
      newItem.liegenschaftId = liegenschaftId;
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
  
  let msg = `"${item.name}" wirklich löschen?`;
  
  // Verwendungsprüfung
  if (type === 'liegenschaften') {
    const anlagenCount = window.stammdaten.anlagen.filter(a => a.liegenschaftId === id).length;
    if (anlagenCount > 0) {
      alert(`Diese Liegenschaft hat noch ${anlagenCount} zugeordnete Anlage(n).\nBitte zuerst die Anlagen löschen oder einer anderen Liegenschaft zuordnen.`);
      return;
    }
    const inUse = window.vorgaenge.filter(v => v.liegenschaft === item.name);
    if (inUse.length > 0) {
      msg += `\n\n⚠ Wird in ${inUse.length} Vorgang/Vorgängen verwendet. Diese behalten den alten Namen.`;
    }
  } else {
    const fieldMap = { 
      anlagen: 'anlage', 
      kategorien: 'kategorie', 
      verantwortliche: 'verantwortlich' 
    };
    const field = fieldMap[type];
    if (field) {
      const inUse = window.vorgaenge.filter(v => v[field] === item.name);
      if (inUse.length > 0) {
        msg += `\n\n⚠ Achtung: Wird in ${inUse.length} Vorgang${inUse.length > 1 ? 'en' : ''} verwendet.`;
        msg += '\nDiese Vorgänge behalten den alten Namen.';
      }
    }
  }
  
  if (!confirm(msg)) return;
  
  window.stammdaten[type] = window.stammdaten[type].filter(x => x.id !== id);
  deleteStammdatumFromFirestore(type, id);
  saveLocalStammdaten();
  renderEinstellungenTab();
  refreshDropdowns();
}

// ═══════════════════════════════════════════════
// DROPDOWNS AKTUALISIEREN (kaskadierend)
// ═══════════════════════════════════════════════
function refreshDropdowns() {
  // Modal: Liegenschaften
  const lgSel = document.getElementById('vLiegenschaft');
  if (lgSel) {
    const current = lgSel.value;
    lgSel.innerHTML = '<option value="">— Wählen —</option>' +
      window.stammdaten.liegenschaften.map(l => 
        `<option value="${esc(l.name)}">${esc(l.name)}</option>`
      ).join('');
    if (current) lgSel.value = current;
  }
  
  // Modal: Anlagen (kaskadiert — abhängig von gewählter Liegenschaft)
  updateAnlagenDropdown();
  
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
  
  // Filter: Anlagen (alle, ohne Kaskade)
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

// Kaskadierung: Anlagen-Dropdown nach Liegenschaft filtern
function updateAnlagenDropdown() {
  const lgSel = document.getElementById('vLiegenschaft');
  const anlageSel = document.getElementById('vAnlage');
  if (!anlageSel) return;
  
  const selectedLg = lgSel ? lgSel.value : '';
  const current = anlageSel.value;
  
  let anlagen;
  if (selectedLg) {
    anlagen = getAnlagenForLiegenschaft(selectedLg);
  } else {
    anlagen = window.stammdaten.anlagen;
  }
  
  anlageSel.innerHTML = '<option value="">— Wählen —</option>' +
    anlagen.map(a => 
      `<option value="${esc(a.name)}">${esc(a.name)}</option>`
    ).join('');
  
  // Aktuelle Auswahl wiederherstellen, falls noch in Liste
  if (current && anlagen.find(a => a.name === current)) {
    anlageSel.value = current;
  }
}

// Wird durch onchange am Liegenschafts-Dropdown getriggert
function onLiegenschaftChange() {
  updateAnlagenDropdown();
}

// Umgekehrte Kaskadierung: Anlage gewählt → Liegenschaft setzen
function onAnlageChange() {
  const anlageSel = document.getElementById('vAnlage');
  const lgSel = document.getElementById('vLiegenschaft');
  if (!anlageSel || !lgSel || !anlageSel.value) return;
  
  const lg = getLiegenschaftForAnlage(anlageSel.value);
  if (lg && lgSel.value !== lg.name) {
    lgSel.value = lg.name;
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
window.updateAnlagenDropdown = updateAnlagenDropdown;
window.onLiegenschaftChange = onLiegenschaftChange;
window.onAnlageChange = onAnlageChange;
window.getLiegenschaftForAnlage = getLiegenschaftForAnlage;
window.getAnlagenForLiegenschaft = getAnlagenForLiegenschaft;
window.loadLocalStammdaten = loadLocalStammdaten;
window.saveLocalStammdaten = saveLocalStammdaten;
