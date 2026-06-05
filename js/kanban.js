// ═══════════════════════════════════════════════
// KANBAN BOARD
// Aus der Original-PWA übernommen, angepasst für
// das neue Multi-File-Setup mit Tab-System
// ═══════════════════════════════════════════════

const COLS = [
  { id: 'eingang',  name: 'Eingang'  },
  { id: 'warten',   name: 'Warten'   },
  { id: 'jetzt',    name: 'Jetzt'    },
  { id: 'parken',   name: 'Parken'   },
  { id: 'erledigt', name: 'Erledigt' },
];

// Status → Farbe (CSS-Wert)
const STATUS_COLOR = {
  eingang:  '#3d6090',
  jetzt:    '#c07c10',
  warten:   '#6848a0',
  erledigt: '#2e8a54',
  parken:   '#387078',
};

const COL_COLORS = {
  eingang:  '#6a92cc',
  warten:   '#9878d0',
  jetzt:    '#d4900f',
  parken:   '#5aa0a8',
  erledigt: '#36a864',
};

// Global state
window.cards = [];
let editingId = null;
let drawerCardId = null;
let deleteTargetId = null;

// ═══════════════════════════════════════════════
// FIRESTORE (Kanban DB)
// ═══════════════════════════════════════════════
async function loadFromFirestore() {
  setSyncStatus('syncing');
  try {
    const { getDocs } = window._fbFns;
    const snap = await getDocs(window._fbCol_kanban());
    window.cards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    saveLocalKanban();
    setSyncStatus('synced');
    render();
  } catch (e) {
    console.error('Firestore Kanban laden:', e);
    setSyncStatus('error');
    window.cards = loadLocalDataKanban();
    render();
  }
}

async function saveToFirestore() {
  if (!window._currentUser) return;
  setSyncStatus('syncing');
  try {
    const { setDoc, doc } = window._fbFns;
    for (const card of window.cards) {
      await setDoc(doc(window._db_kanban, 'vorgaenge', card.id), card);
    }
    setSyncStatus('synced');
  } catch (e) {
    console.error('Firestore Kanban speichern:', e);
    setSyncStatus('error');
  }
}

async function deleteFromFirestore(id) {
  if (!window._currentUser) return;
  try {
    const { deleteDoc, doc } = window._fbFns;
    await deleteDoc(doc(window._db_kanban, 'vorgaenge', id));
  } catch (e) {
    console.error('Firestore Kanban löschen:', e);
  }
}

function saveData() {
  saveLocalKanban();
  saveToFirestore();
}

// ═══════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════
function render() {
  const board = document.getElementById('board');
  if (!board) return;
  board.innerHTML = '';

  const cards = window.cards;
  const jetzt   = cards.filter(c => c.status === 'jetzt');
  const overdue = cards.filter(c => c.faellig && dueClass(c.faellig) === 'due-red'   && c.status !== 'erledigt');
  const dueSoon = cards.filter(c => c.faellig && dueClass(c.faellig) === 'due-amber' && c.status !== 'erledigt');
  const warten  = cards.filter(c => c.status === 'warten');

  // Status bar updates
  const wip = document.getElementById('wipStatus');
  if (wip) {
    wip.textContent = `WIP: ${jetzt.length} / 3`;
    wip.className = 'wip-status ' + (jetzt.length > 3 ? 'warn' : 'ok');
  }

  const elToday   = document.getElementById('datebarToday');
  const elOver    = document.getElementById('datebarOverdue');
  const elDueSoon = document.getElementById('datebarDueSoon');
  const elWait    = document.getElementById('datebarWaiting');
  
  if (elToday)   elToday.textContent   = today();
  if (elOver)    elOver.textContent    = overdue.length ? `⚠ ${overdue.length} überfällig` : '';
  if (elDueSoon) elDueSoon.textContent = dueSoon.length ? `◷ ${dueSoon.length} fällt diese Woche` : '';
  if (elWait) {
    elWait.textContent = warten.length ? `⧖ ${warten.length} in Warten` : '';
    elWait.style.color = warten.length ? '#9878d0' : '';
  }

  // Render columns
  COLS.forEach(col => {
    const colCards = cards.filter(c => c.status === col.id);
    const isWarn   = (col.id === 'jetzt' && colCards.length > 3) || 
                     (col.id === 'warten' && colCards.length > 5);
    const countColor = isWarn ? '' : `color:${COL_COLORS[col.id] || 'var(--text3)'}`;
    
    const div = document.createElement('div');
    div.className = 'col';
    div.dataset.col = col.id;
    div.innerHTML = `
      <div class="col-head">
        <span class="col-name">${col.name}</span>
        <span class="col-count ${isWarn ? 'warn' : ''}" style="${countColor}">${colCards.length}</span>
      </div>
      <div class="col-body" id="col-${col.id}"></div>`;
    board.appendChild(div);

    const body = div.querySelector(`#col-${col.id}`);
    if (!colCards.length) body.innerHTML = '<div class="empty">— leer —</div>';

    colCards.forEach(card => {
      const dc  = dueClass(card.faellig);
      const due = card.faellig
        ? `<span class="kcard-due ${dc === 'due-red' ? 'red' : dc === 'due-amber' ? 'amber' : ''}">${dc === 'due-red' ? '⚠ ' : ''}${fmt(card.faellig)}</span>`
        : '<span class="kcard-due">—</span>';
      const statusCol = STATUS_COLOR[card.status] || '#3a4050';
      const schritte  = card.schritte || [];
      const done      = card.schritteDone || 0;
      const total     = schritte.length + done;
      const nextStep  = schritte.length ? schritte[0] : (card.naechsterSchritt || '—');
      const progressHtml = total > 0
        ? `<div class="kcard-progress">
            <div class="kcard-progress-bar"><div class="kcard-progress-fill" style="width:${Math.round(done / total * 100)}%"></div></div>
            <span class="kcard-progress-text">${done}/${total}</span>
           </div>`
        : '';

      const el = document.createElement('div');
      el.className = `kcard ${dc}`;
      el.draggable = true;
      el.dataset.id = card.id;
      el.style.setProperty('--stripe-color', statusCol);
      if (dc === 'due-red')   el.style.setProperty('--underline-color', 'var(--red-light)');
      if (dc === 'due-amber') el.style.setProperty('--underline-color', 'var(--amber-light)');
      el.innerHTML = `
        <div class="kcard-title">${esc(card.thema)}</div>
        <div class="kcard-next">${esc(nextStep)}</div>
        <div class="kcard-meta">
          <span class="kcard-area">${esc(card.bereich || '—')}</span>
          ${due}
        </div>
        ${progressHtml}`;
      el.addEventListener('click', () => openDrawer(card.id));

      // Drag events
      el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('cardId', card.id);
        setTimeout(() => el.classList.add('dragging'), 0);
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
      body.appendChild(el);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'add-card-btn';
    addBtn.textContent = '+ Vorgang';
    addBtn.addEventListener('click', () => openNewModal(col.id));
    body.appendChild(addBtn);

    // Drop-Zone Events
    body.addEventListener('dragover', e => { e.preventDefault(); body.classList.add('drag-over'); });
    body.addEventListener('dragleave', () => body.classList.remove('drag-over'));
    body.addEventListener('drop', e => {
      e.preventDefault();
      body.classList.remove('drag-over');
      const id = e.dataTransfer.getData('cardId');
      const card = window.cards.find(x => x.id === id);
      if (!card || card.status === col.id) return;
      const t = today();
      card.status = col.id;
      card.letzteUpdate = t;
      card.log = `${t}: Status → ${col.id} (Drag & Drop)\n` + (card.log || '');
      saveData();
      render();
    });
  });
}

// ═══════════════════════════════════════════════
// MODAL (Neu / Bearbeiten)
// ═══════════════════════════════════════════════
function openNewModal(colId) {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Neuer Vorgang';
  ['fThema','fBereich','fNaechsterSchritt','fFaellig','fWartenAuf','fNachweis']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('fStatus').value    = colId || 'eingang';
  document.getElementById('fZeitfokus').value = 'Diese Woche';
  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('fThema').focus(), 50);
}

function openEditModal(id) {
  const c = window.cards.find(x => x.id === id);
  if (!c) return;
  editingId = id;
  document.getElementById('modalTitle').textContent      = 'Vorgang bearbeiten';
  document.getElementById('fThema').value                = c.thema || '';
  document.getElementById('fBereich').value              = c.bereich || '';
  document.getElementById('fStatus').value               = c.status || 'eingang';
  document.getElementById('fZeitfokus').value            = c.zeitfokus || 'Diese Woche';
  document.getElementById('fNaechsterSchritt').value     = c.naechsterSchritt || '';
  document.getElementById('fFaellig').value              = c.faellig || '';
  document.getElementById('fWartenAuf').value            = c.wartenAuf || '';
  document.getElementById('fNachweis').value             = c.nachweis || '';
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal()      { document.getElementById('modalOverlay').classList.remove('open'); }
function closeModalIfBg(e) { if (e.target === document.getElementById('modalOverlay')) closeModal(); }

function saveCard() {
  const thema = document.getElementById('fThema').value.trim();
  const next  = document.getElementById('fNaechsterSchritt').value.trim();
  if (!thema) { document.getElementById('fThema').focus(); return; }
  const t = today();

  if (editingId) {
    const c = window.cards.find(x => x.id === editingId);
    const oldStatus = c.status;
    c.thema = thema;
    c.bereich          = document.getElementById('fBereich').value.trim();
    c.status           = document.getElementById('fStatus').value;
    c.zeitfokus        = document.getElementById('fZeitfokus').value;
    c.naechsterSchritt = next;
    c.faellig          = document.getElementById('fFaellig').value;
    c.wartenAuf        = document.getElementById('fWartenAuf').value.trim();
    c.nachweis         = document.getElementById('fNachweis').value.trim();
    c.letzteUpdate     = t;
    const logLine = `${t}: Bearbeitet${c.status !== oldStatus ? ' → Status: ' + c.status : ''}`;
    c.log = c.log ? logLine + '\n' + c.log : logLine;
  } else {
    window.cards.push({
      id: uid(), thema,
      bereich:          document.getElementById('fBereich').value.trim(),
      status:           document.getElementById('fStatus').value,
      zeitfokus:        document.getElementById('fZeitfokus').value,
      naechsterSchritt: next,
      faellig:          document.getElementById('fFaellig').value,
      wartenAuf:        document.getElementById('fWartenAuf').value.trim(),
      nachweis:         document.getElementById('fNachweis').value.trim(),
      letzteUpdate:     t,
      log:              `${t}: Vorgang angelegt`,
    });
  }
  saveData(); closeModal(); render();
  if (editingId && drawerCardId === editingId) openDrawer(editingId);
}

// ═══════════════════════════════════════════════
// DRAWER
// ═══════════════════════════════════════════════
function openDrawer(id) {
  drawerCardId = id;
  const c = window.cards.find(x => x.id === id);
  if (!c) return;
  document.getElementById('drawerTitle').textContent = c.thema;
  document.getElementById('drawerHead').style.borderLeftColor = STATUS_COLOR[c.status] || '#3a4050';

  const dc = dueClass(c.faellig);
  const dueVal = c.faellig
    ? `<span class="${dc === 'due-red' ? 'red' : dc === 'due-amber' ? 'amber' : ''}">${dc === 'due-red' ? '⚠ ' : ''}${fmt(c.faellig)}${dc === 'due-red' ? ' — überfällig' : ''}</span>`
    : '—';
  const badgeClass = {eingang:'badge-eingang',jetzt:'badge-jetzt',warten:'badge-warten',erledigt:'badge-erledigt',parken:'badge-parken'}[c.status] || 'badge-eingang';
  const statusLabel = {eingang:'Eingang',jetzt:'Jetzt',warten:'Warten',erledigt:'Erledigt',parken:'Parken'}[c.status];
  
  const logLines = (c.log || '').split('\n').filter(Boolean).map((l, idx) => {
    const m = l.match(/^(\d{4}-\d{2}-\d{2}):\s*(.+)$/);
    const dateSpan = m ? `<span class="log-date">${m[1]}</span>` : '';
    const textSpan = `<span class="log-text">${esc(m ? m[2] : l)}</span>`;
    return `<div class="log-entry">
      <div class="log-entry-content">${dateSpan}${textSpan}</div>
      <div class="log-entry-actions">
        <button class="log-entry-btn" onclick="editLogEntry(event,${idx})">✎</button>
        <button class="log-entry-btn del" onclick="deleteLogEntry(${idx})">✕</button>
      </div>
    </div>`;
  }).join('');

  const schritte  = c.schritte || [];
  const done      = c.schritteDone || 0;
  const total     = schritte.length + done;
  const nextStep  = schritte.length ? schritte[0] : (c.naechsterSchritt || '—');

  const schritteHtml = schritte.map((s, idx) => `
    <div class="schritt-item">
      <div class="schritt-check" onclick="checkSchritt(${idx})" title="Abhaken">✓</div>
      <div class="schritt-text">${esc(s)}</div>
      <button class="schritt-del ins" onclick="insertSchritt(${idx})" title="Schritt darunter einfügen">+</button>
      <button class="schritt-del" onclick="deleteSchritt(${idx})" title="Entfernen">✕</button>
    </div>`).join('');

  const progressHtml = total > 0
    ? `<div class="schritt-progress">
        <span>${done}/${total} erledigt</span>
        <div class="schritt-progress-bar"><div class="schritt-progress-fill" style="width:${Math.round(done / total * 100)}%"></div></div>
       </div>`
    : '';

  document.getElementById('drawerBody').innerHTML = `
    <div class="drawer-section">
      <div class="drawer-section-title">Metadaten</div>
      <div class="drawer-grid">
        <div><div class="dfield-label">Status</div><div class="dfield-val"><span class="status-badge ${badgeClass}">${statusLabel}</span></div></div>
        <div><div class="dfield-label">Zeitfokus</div><div class="dfield-val">${esc(c.zeitfokus || '—')}</div></div>
        <div><div class="dfield-label">Bereich / Ort</div><div class="dfield-val">${esc(c.bereich || '—')}</div></div>
        <div><div class="dfield-label">Fällig / WV</div><div class="dfield-val">${dueVal}</div></div>
        <div><div class="dfield-label">Warten auf</div><div class="dfield-val">${esc(c.wartenAuf || '—')}</div></div>
        <div><div class="dfield-label">Nachweis</div><div class="dfield-val">${esc(c.nachweis || '—')}</div></div>
      </div>
    </div>
    <div class="drawer-section">
      <div class="drawer-section-title">Nächster Schritt</div>
      <div class="next-step-box">${esc(nextStep)}</div>
    </div>
    <div class="drawer-section">
      <div class="drawer-section-title">Schritte${total > 0 ? ' (' + done + '/' + total + ')' : ''}</div>
      ${schritteHtml || '<div style="color:var(--text3);font-size:11px">Noch keine Schritte geplant.</div>'}
      ${progressHtml}
      <div class="schritt-add">
        <input type="text" id="schrittInput" placeholder="Neuen Schritt hinzufügen…" onkeydown="if(event.key==='Enter')addSchritt()">
        <button class="btn" onclick="addSchritt()">+ Schritt</button>
      </div>
    </div>
    <div class="drawer-section">
      <div class="drawer-section-title">Log / Chronik</div>
      <div id="drawerLog">${logLines || '<div style="color:var(--text3);font-size:11px">Noch kein Eintrag.</div>'}</div>
      <div class="log-add">
        <input type="text" id="logInput" placeholder="Neuer Log-Eintrag…" onkeydown="if(event.key==='Enter')addLogEntry()">
        <button class="btn" onclick="addLogEntry()">+ Log</button>
      </div>
    </div>
    <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:8px">
      Letztes Update: ${c.letzteUpdate || '—'}
    </div>`;

  document.getElementById('drawerOverlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawerOverlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
  drawerCardId = null;
}

function editFromDrawer() {
  const id = drawerCardId;
  closeDrawer();
  openEditModal(id);
}

function markErledigt() {
  const c = window.cards.find(x => x.id === drawerCardId);
  if (!c) return;
  const t = today();
  c.status = 'erledigt';
  c.letzteUpdate = t;
  c.log = `${t}: Erledigt markiert\n` + (c.log || '');
  saveData(); closeDrawer(); render();
}

// ═══════════════════════════════════════════════
// SCHRITTE
// ═══════════════════════════════════════════════
function addSchritt() {
  const input = document.getElementById('schrittInput');
  const text  = (input.value || '').trim();
  if (!text) return;
  const c = window.cards.find(x => x.id === drawerCardId);
  if (!c) return;
  if (!c.schritte) c.schritte = [];
  c.schritte.push(text);
  c.letzteUpdate = today();
  saveData(); render(); openDrawer(drawerCardId);
}

function checkSchritt(idx) {
  const c = window.cards.find(x => x.id === drawerCardId);
  if (!c || !c.schritte || idx >= c.schritte.length) return;
  const t    = today();
  const text = c.schritte[idx];
  c.schritte.splice(idx, 1);
  c.schritteDone = (c.schritteDone || 0) + 1;
  c.log = `${t}: ✓ ${text}\n` + (c.log || '');
  c.letzteUpdate = t;
  saveData(); render(); openDrawer(drawerCardId);
}

function deleteSchritt(idx) {
  const c = window.cards.find(x => x.id === drawerCardId);
  if (!c || !c.schritte || idx >= c.schritte.length) return;
  c.schritte.splice(idx, 1);
  c.letzteUpdate = today();
  saveData(); render(); openDrawer(drawerCardId);
}

function insertSchritt(idx) {
  const items = document.querySelectorAll('.schritt-item');
  if (idx >= items.length) return;
  const target = items[idx];
  if (target.nextElementSibling && target.nextElementSibling.classList.contains('schritt-insert-row')) return;

  const row = document.createElement('div');
  row.className = 'schritt-insert-row schritt-add';
  row.style.margin = '6px 0';
  row.innerHTML = `
    <input type="text" placeholder="Zwischenschritt…" autofocus
      style="flex:1;background:var(--el-3);border:1px solid var(--green-rim);border-radius:4px;color:var(--text);font-family:var(--sans);font-size:11px;padding:6px 9px;outline:none">
    <button class="btn" style="font-size:9px;padding:3px 8px">↵</button>`;
  target.after(row);

  const input = row.querySelector('input');
  const btn   = row.querySelector('button');
  input.focus();

  function doInsert() {
    const text = input.value.trim();
    if (!text) { row.remove(); return; }
    const c = window.cards.find(x => x.id === drawerCardId);
    if (!c || !c.schritte) return;
    c.schritte.splice(idx + 1, 0, text);
    c.letzteUpdate = today();
    saveData(); render(); openDrawer(drawerCardId);
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') doInsert();
    if (e.key === 'Escape') row.remove();
  });
  btn.addEventListener('click', doInsert);
}

// ═══════════════════════════════════════════════
// LOG
// ═══════════════════════════════════════════════
function editLogEntry(e, idx) {
  e.stopPropagation();
  const c = window.cards.find(x => x.id === drawerCardId);
  if (!c) return;
  const lines = (c.log || '').split('\n').filter(Boolean);
  if (idx >= lines.length) return;

  const entryDiv = e.currentTarget.closest('.log-entry');
  const content  = entryDiv.querySelector('.log-entry-content');
  const actions  = entryDiv.querySelector('.log-entry-actions');

  const m = lines[idx].match(/^(\d{4}-\d{2}-\d{2}):\s*(.+)$/);
  const currentText = m ? m[2] : lines[idx];
  const prefix      = m ? m[1] + ': ' : '';

  const input = document.createElement('input');
  input.type  = 'text';
  input.className = 'log-edit-input';
  input.value = currentText;
  content.appendChild(input);
  input.focus();
  actions.style.opacity = '1';

  const editBtn = e.currentTarget;
  editBtn.textContent = '✓';
  editBtn.onclick = null;
  editBtn.addEventListener('click', ev => {
    ev.stopPropagation();
    const newText = input.value.trim();
    if (newText) lines[idx] = prefix + newText;
    c.log = lines.join('\n');
    c.letzteUpdate = today();
    saveData();
    openDrawer(drawerCardId);
  });
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter')  editBtn.click();
    if (ev.key === 'Escape') openDrawer(drawerCardId);
  });
}

function deleteLogEntry(idx) {
  const c = window.cards.find(x => x.id === drawerCardId);
  if (!c) return;
  const lines = (c.log || '').split('\n').filter(Boolean);
  lines.splice(idx, 1);
  c.log = lines.join('\n');
  c.letzteUpdate = today();
  saveData();
  openDrawer(drawerCardId);
}

function addLogEntry() {
  const input = document.getElementById('logInput');
  const text  = (input.value || '').trim();
  if (!text) return;
  const c = window.cards.find(x => x.id === drawerCardId);
  if (!c) return;
  const t = today();
  c.log = `${t}: ${text}` + (c.log ? '\n' + c.log : '');
  c.letzteUpdate = t;
  saveData(); openDrawer(drawerCardId);
}

// ═══════════════════════════════════════════════
// LÖSCHEN
// ═══════════════════════════════════════════════
function confirmDelete() {
  const c = window.cards.find(x => x.id === drawerCardId);
  if (!c) return;
  deleteTargetId = drawerCardId;
  document.getElementById('confirmText').textContent = `„${c.thema}" wird unwiderruflich gelöscht.`;
  document.getElementById('confirmOverlay').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
  deleteTargetId = null;
}

function doDelete() {
  deleteFromFirestore(deleteTargetId);
  window.cards = window.cards.filter(x => x.id !== deleteTargetId);
  saveLocalKanban();
  closeConfirm(); closeDrawer(); render();
}

// ═══════════════════════════════════════════════
// WEEKLY REVIEW
// ═══════════════════════════════════════════════
function openReview() {
  const cards = window.cards;
  const jetzt   = cards.filter(c => c.status === 'jetzt');
  const warten  = cards.filter(c => c.status === 'warten');
  const eingang = cards.filter(c => c.status === 'eingang');
  const overdue = cards.filter(c => c.faellig && dueClass(c.faellig) === 'due-red' && c.status !== 'erledigt');
  const wartenAlt = warten.filter(c => c.faellig && (new Date() - new Date(c.faellig)) / 86400000 > 7);
  const t = today();

  document.getElementById('reviewBody').innerHTML = `
    <div class="review-section">
      <div class="review-label">WIP-Check — Jetzt (${jetzt.length}/3)</div>
      ${!jetzt.length ? '<div style="color:var(--text3);font-size:12px;padding:6px 0">Keine aktiven Vorgänge.</div>' : ''}
      ${jetzt.map(c => `<div class="review-item">${esc(c.thema)}<span class="review-item-sub">${esc(c.zeitfokus || '')}</span></div>`).join('')}
      ${jetzt.length > 3 ? '<div style="color:var(--red);font-size:11px;padding:4px 0;font-family:var(--mono)">⚠ WIP-Limit überschritten</div>' : ''}
    </div>
    <div class="review-section">
      <div class="review-label">Überfällig (${overdue.length})</div>
      ${!overdue.length ? '<div style="color:var(--text3);font-size:12px;padding:6px 0">Keine überfälligen Vorgänge.</div>' : ''}
      ${overdue.map(c => `<div class="review-item">${esc(c.thema)}<span class="review-item-sub" style="color:var(--red)">seit ${fmt(c.faellig)}</span></div>`).join('')}
    </div>
    <div class="review-section">
      <div class="review-label">Warten > 7 Tage (${wartenAlt.length})</div>
      ${!wartenAlt.length ? '<div style="color:var(--text3);font-size:12px;padding:6px 0">Kein Vorgang hängt zu lang.</div>' : ''}
      ${wartenAlt.map(c => `<div class="review-item">${esc(c.thema)}<span class="review-item-sub">${esc(c.wartenAuf || '?')}</span></div>`).join('')}
    </div>
    <div class="review-section">
      <div class="review-label">Eingang — zu triagieren (${eingang.length})</div>
      ${!eingang.length ? '<div style="color:var(--text3);font-size:12px;padding:6px 0">Eingang leer.</div>' : ''}
      ${eingang.map(c => `<div class="review-item">${esc(c.thema)}<span class="review-item-sub">${esc(c.naechsterSchritt || '')}</span></div>`).join('')}
    </div>
    <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:8px">Review-Stand: ${t}</div>`;

  document.getElementById('reviewOverlay').classList.add('open');
}

function closeReview()      { document.getElementById('reviewOverlay').classList.remove('open'); }
function closeReviewIfBg(e) { if (e.target === document.getElementById('reviewOverlay')) closeReview(); }

// ── Alles global verfügbar ──
window.render = render;
window.loadFromFirestore = loadFromFirestore;
window.saveData = saveData;
window.deleteFromFirestore = deleteFromFirestore;
window.openNewModal = openNewModal;
window.openEditModal = openEditModal;
window.closeModal = closeModal;
window.closeModalIfBg = closeModalIfBg;
window.saveCard = saveCard;
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;
window.editFromDrawer = editFromDrawer;
window.markErledigt = markErledigt;
window.addSchritt = addSchritt;
window.checkSchritt = checkSchritt;
window.deleteSchritt = deleteSchritt;
window.insertSchritt = insertSchritt;
window.editLogEntry = editLogEntry;
window.deleteLogEntry = deleteLogEntry;
window.addLogEntry = addLogEntry;
window.confirmDelete = confirmDelete;
window.closeConfirm = closeConfirm;
window.doDelete = doDelete;
window.openReview = openReview;
window.closeReview = closeReview;
window.closeReviewIfBg = closeReviewIfBg;
