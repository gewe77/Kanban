// ═══════════════════════════════════════════════
// VORGANGSREGISTER
//
// Ersetzt Kanban-Board + Heute/Aktiv/Register-Ansichten
// durch eine einzige, sich selbst nach Dringlichkeit
// sortierende Liste. Kein Verschieben zwischen Spalten
// oder Ordnern nötig — jeder Vorgang trägt sein eigenes
// Fristen-Signal und taucht von selbst oben auf.
//
// Verwendet Firestore-Instanz (betrieb-vorgaenge)
// ═══════════════════════════════════════════════

// Global state
window.vorgaenge = [];
let drawerVorgangId = null;
let showErledigte = false;
try {
  showErledigte = JSON.parse(localStorage.getItem('register_show_erledigt') || 'false');
} catch (e) {
  // localStorage kann in seltenen Fällen nicht verfügbar sein (z.B. beim
  // Öffnen der Datei direkt vom Dateisystem statt über einen Server).
  // Ohne dieses try/catch würde ein Fehler hier das gesamte Skript
  // abbrechen und alle Register-Funktionen (Neuer Vorgang etc.) lahmlegen.
  console.warn('localStorage nicht verfügbar — Anzeige-Einstellung wird nicht gespeichert:', e.message);
}

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

// Standard-Pufferzeit (Tage vor der echten Frist, an dem der Vorgang
// als "fällig" auftauchen soll — Schutz gegen Tagesstörungen)
const PUFFER_DEFAULT = 2;

// Weiches WIP-Limit für "In Bearbeitung" — bewusst klein gehalten,
// damit nicht zu viele Vorgänge gleichzeitig als aktiv erscheinen
const WIP_LIMIT_AKTIV = 3;

// ═══════════════════════════════════════════════
// FIRESTORE (Vorgänge DB)
// ═══════════════════════════════════════════════
async function loadVorgaengeFromFirestore() {
  setSyncStatus('syncing');
  try {
    const { getDocs } = window._fbFns;
    const snap = await getDocs(window._fbCol_vorgaenge());
    const remote = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (remote.length === 0) {
      // WICHTIG: Eine leere Firestore-Antwort niemals blind übernehmen —
      // das würde lokal vorhandene Vorgänge (z.B. aus einer Zeit mit
      // Auth-Problemen) unwiderruflich löschen. Lokale Daten haben Vorrang
      // und werden bei Bedarf nach Firestore nachgezogen.
      const local = loadLocalDataVorgaenge();
      if (local.length > 0) {
        window.vorgaenge = local;
        local.forEach(v => saveVorgangToFirestore(v));
        console.warn('Vorgänge: lokale Daten gefunden, die noch nicht in Firestore lagen — werden jetzt hochgeladen.');
      } else {
        window.vorgaenge = [];
      }
    } else {
      window.vorgaenge = remote;
    }

    saveLocalVorgaenge();
    renderRegister();
    setSyncStatus('synced');
  } catch (e) {
    console.error('Firestore Vorgänge laden:', e);
    window.vorgaenge = loadLocalDataVorgaenge();
    renderRegister();
    setSyncStatus('error');
  }
}

async function saveVorgangToFirestore(v) {
  if (!window._currentUser) {
    setSyncStatus('offline');
    return;
  }
  setSyncStatus('syncing');
  try {
    const { setDoc, doc } = window._fbFns;
    await setDoc(doc(window._db_vorgaenge, 'vorgaenge', v.id), v);
    setSyncStatus('synced');
  } catch (e) {
    console.error('Firestore Vorgang speichern:', e);
    setSyncStatus('error');
  }
}

async function deleteVorgangFromFirestore(id) {
  if (!window._currentUser) {
    setSyncStatus('offline');
    return;
  }
  setSyncStatus('syncing');
  try {
    const { deleteDoc, doc } = window._fbFns;
    await deleteDoc(doc(window._db_vorgaenge, 'vorgaenge', id));
    setSyncStatus('synced');
  } catch (e) {
    console.error('Firestore Vorgang löschen:', e);
    setSyncStatus('error');
  }
}

function saveDataVorgaenge() {
  saveLocalVorgaenge();
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
// DATUMS-HILFEN (Puffer/Wiedervorlage)
// ═══════════════════════════════════════════════
function addDaysStr(dateStr, days) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Berechnet die Wiedervorlage aus Frist − Puffertage,
// falls keine Wiedervorlage manuell gesetzt wurde
function berechneWiedervorlage(frist, pufferTage, manuelleWiedervorlage) {
  if (manuelleWiedervorlage) return manuelleWiedervorlage;
  if (!frist) return null;
  return addDaysStr(frist, pufferTage ?? PUFFER_DEFAULT);
}

// ═══════════════════════════════════════════════
// DRINGLICHKEIT (Kernstück des Registers)
//
// Jeder Vorgang bekommt eine Klasse + Rang, danach wird
// die gesamte Liste sortiert. Keine Spalten, kein manuelles
// Einordnen — nur die Daten entscheiden über die Position.
// ═══════════════════════════════════════════════
function computeDringlichkeit(v) {
  if (v.status === 'erledigt' || v.status === 'archiviert') {
    return { klasse: 'erledigt', label: V_STATUS.find(s => s.id === v.status)?.label || '', rang: 99 };
  }

  const tageFrist = v.frist ? daysUntil(v.frist) : null;
  const tageWv = v.wiedervorlage ? daysUntil(v.wiedervorlage) : null;

  // 1. Überfällig — die echte Frist liegt in der Vergangenheit
  if (tageFrist !== null && tageFrist < 0) {
    return { klasse: 'ueberfaellig', label: `⚠ überfällig · ${Math.abs(tageFrist)}d`, rang: 0 };
  }

  // 2. Heute fällig — Frist heute, oder Wiedervorlage heute/überschritten
  if (tageFrist === 0 || (tageWv !== null && tageWv <= 0)) {
    return {
      klasse: 'heute',
      label: tageFrist === 0 ? 'heute fällig' : 'Wiedervorlage heute',
      rang: 1
    };
  }

  // 3. Neu / unbewertet — noch nicht eingeordnet, braucht Triage
  if (v.status === 'neu') {
    return { klasse: 'neu', label: 'neu · noch nicht bewertet', rang: 1.5 };
  }

  // 4. Wartet auf extern/intern mit zukünftiger Wiedervorlage
  if ((v.status === 'wartet-firma' || v.status === 'wartet-intern') && tageWv !== null && tageWv > 0) {
    return { klasse: 'wartet', label: `Wiedervorlage in ${tageWv}d`, rang: 2 };
  }

  // 5. Diese Woche
  if (tageFrist !== null && tageFrist <= 7) {
    return { klasse: 'diese-woche', label: `fällig in ${tageFrist}d`, rang: 3 };
  }

  // 6. Später — kein naher Trigger
  return {
    klasse: 'spaeter',
    label: v.frist ? `fällig in ${tageFrist}d` : 'kein Termin gesetzt',
    rang: 4
  };
}

// ═══════════════════════════════════════════════
// DATEBAR (Kopfzeile — Kennzahlen statt Kanban-WIP)
// ═══════════════════════════════════════════════
function renderDatebar() {
  const offen = window.vorgaenge.filter(v => v.status !== 'erledigt' && v.status !== 'archiviert');
  const overdue = offen.filter(v => v.frist && daysUntil(v.frist) < 0);
  const dueSoon = offen.filter(v => v.frist && daysUntil(v.frist) >= 0 && daysUntil(v.frist) <= 7);
  const warten = offen.filter(v => v.status === 'wartet-firma' || v.status === 'wartet-intern');

  const elToday = document.getElementById('datebarToday');
  const elOver = document.getElementById('datebarOverdue');
  const elDueSoon = document.getElementById('datebarDueSoon');
  const elWait = document.getElementById('datebarWaiting');

  if (elToday) elToday.textContent = today();
  if (elOver) elOver.textContent = overdue.length ? `⚠ ${overdue.length} überfällig` : '';
  if (elDueSoon) elDueSoon.textContent = dueSoon.length ? `◷ ${dueSoon.length} fällt diese Woche` : '';
  if (elWait) {
    elWait.textContent = warten.length ? `⧖ ${warten.length} in Warten` : '';
    elWait.style.color = warten.length ? '#9878d0' : '';
  }
}

// ═══════════════════════════════════════════════
// REGISTER-RENDER (einzige Ansicht)
// ═══════════════════════════════════════════════
function renderRegister() {
  const countEl = document.getElementById('vorgaengeCount');
  if (countEl) countEl.textContent = window.vorgaenge.length;

  renderDatebar();
  renderRegisterSummary();

  const container = document.getElementById('registerList');
  if (!container) return;

  const suchbegriff = (document.getElementById('registerSearch')?.value || '').toLowerCase().trim();

  let liste = window.vorgaenge.filter(v => {
    if (!showErledigte && (v.status === 'erledigt' || v.status === 'archiviert')) return false;
    if (!suchbegriff) return true;
    return (v.thema || '').toLowerCase().includes(suchbegriff) ||
           (v.anlage || '').toLowerCase().includes(suchbegriff) ||
           (v.liegenschaft || '').toLowerCase().includes(suchbegriff) ||
           (v.vorgangsNr || '').toLowerCase().includes(suchbegriff);
  });

  liste = liste.map(v => ({ v, d: computeDringlichkeit(v) }));

  liste.sort((a, b) => {
    if (a.d.rang !== b.d.rang) return a.d.rang - b.d.rang;
    const ta = a.v.frist ? daysUntil(a.v.frist) : Infinity;
    const tb = b.v.frist ? daysUntil(b.v.frist) : Infinity;
    if (ta !== tb) return ta - tb;
    const order = { A: 0, B: 1, C: 2 };
    return (order[a.v.prioritaet] ?? 9) - (order[b.v.prioritaet] ?? 9);
  });

  if (!liste.length) {
    container.innerHTML = '<div class="empty">— keine Vorgänge —</div>';
    return;
  }

  container.innerHTML = liste.map(({ v, d }) => {
    const schritte = v.schritte || [];
    const naechsterSchritt = schritte.length ? schritte[0] : (v.naechsterSchritt || '—');
    return `
      <div class="register-row" onclick="openVorgangDrawer('${v.id}')">
        <div class="register-dot register-dot-${d.klasse}" title="${esc(d.label)}"></div>
        <div class="register-main">
          <div class="register-title">${esc(v.thema)}</div>
          <div class="register-sub">${esc(v.liegenschaft || '—')} · ${esc(v.anlage || '—')}</div>
        </div>
        <div class="register-side">
          <div class="register-next">${esc(naechsterSchritt)}</div>
          <div class="register-frist register-frist-${d.klasse}">${esc(d.label)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderRegisterSummary() {
  const bar = document.getElementById('registerSummary');
  if (!bar) return;

  const offen = window.vorgaenge.filter(v => v.status !== 'erledigt' && v.status !== 'archiviert');
  const zaehlen = { ueberfaellig: 0, heute: 0, wartet: 0, 'diese-woche': 0 };
  offen.forEach(v => {
    const d = computeDringlichkeit(v);
    if (zaehlen[d.klasse] !== undefined) zaehlen[d.klasse]++;
  });

  const aktivCount = offen.filter(v => v.status === 'inbearbeitung').length;
  const aktivWarn = aktivCount > WIP_LIMIT_AKTIV;

  bar.innerHTML = `
    <span class="register-summary-item ${zaehlen.ueberfaellig ? 'urgent' : ''}">${zaehlen.ueberfaellig} überfällig</span>
    <span class="register-summary-item ${zaehlen.heute ? 'urgent' : ''}">${zaehlen.heute} heute fällig</span>
    <span class="register-summary-item">${zaehlen['diese-woche']} diese Woche</span>
    <span class="register-summary-item">${zaehlen.wartet} wartet auf extern</span>
    <span class="register-summary-item ${aktivWarn ? 'warn' : ''}" title="Weiches Limit: ${WIP_LIMIT_AKTIV}">
      ${aktivCount}/${WIP_LIMIT_AKTIV} aktiv in Bearbeitung
    </span>
  `;
}

// ═══════════════════════════════════════════════
// FILTER / SUCHE
// ═══════════════════════════════════════════════
function setupRegisterFilters() {
  const search = document.getElementById('registerSearch');
  if (search) search.addEventListener('input', renderRegister);

  const toggle = document.getElementById('registerShowErledigt');
  if (toggle) {
    toggle.checked = showErledigte;
    toggle.addEventListener('change', () => {
      showErledigte = toggle.checked;
      try {
        localStorage.setItem('register_show_erledigt', JSON.stringify(showErledigte));
      } catch (e) {
        console.warn('localStorage nicht verfügbar:', e.message);
      }
      renderRegister();
    });
  }
}

// ═══════════════════════════════════════════════
// NEUER VORGANG MODAL
// ═══════════════════════════════════════════════
function openNewVorgangModal() {
  ['vAnlage', 'vThema', 'vKategorie', 'vNaechsterSchritt', 'vVerantwortlich', 'vFrist', 'vWiedervorlage', 'vNachweis']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  document.getElementById('vPrioritaet').value = 'C';
  document.getElementById('vPuffertage').value = PUFFER_DEFAULT;

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
  const frist = document.getElementById('vFrist').value || null;
  const pufferRaw = parseInt(document.getElementById('vPuffertage').value, 10);
  const pufferTage = isNaN(pufferRaw) ? PUFFER_DEFAULT : Math.max(0, pufferRaw);
  const wiedervorlageManuell = document.getElementById('vWiedervorlage').value || null;
  const wiedervorlage = berechneWiedervorlage(frist, pufferTage, wiedervorlageManuell);

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
    frist: frist,
    pufferTage: pufferTage,
    wiedervorlage: wiedervorlage,
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
  renderRegister();

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

  const d = computeDringlichkeit(v);
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
      <div class="drawer-section-title">Dringlichkeit</div>
      <div class="register-frist register-frist-${d.klasse}" style="display:inline-block;font-size:12px;padding:4px 10px;border-radius:4px">${esc(d.label)}</div>
    </div>

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
      </div>
    </div>

    <div class="drawer-section">
      <div class="drawer-section-title">Frist &amp; Wiedervorlage</div>
      <div id="vFristView">
        <div class="drawer-grid drawer-grid-3">
          <div>
            <div class="dfield-label">Frist (echte Deadline)</div>
            <div class="dfield-val">${v.frist ? fmtLong(v.frist) : '—'}</div>
          </div>
          <div>
            <div class="dfield-label">Puffer</div>
            <div class="dfield-val">${v.pufferTage ?? PUFFER_DEFAULT} Tage</div>
          </div>
          <div>
            <div class="dfield-label">Wiedervorlage</div>
            <div class="dfield-val">${v.wiedervorlage ? fmtLong(v.wiedervorlage) : '—'}</div>
          </div>
        </div>
        <button class="btn" style="margin-top:8px" onclick="editVorgangFrist()">Bearbeiten</button>
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

// ─── Frist/Puffer/Wiedervorlage bearbeiten ───
// Bewusst mit explizitem Speichern/Abbrechen statt blur-autosave
// (blur löst bei jedem Klick aus und würde den Drawer neu rendern)
function editVorgangFrist() {
  const v = window.vorgaenge.find(x => x.id === drawerVorgangId);
  if (!v) return;

  const view = document.getElementById('vFristView');
  if (!view || view.querySelector('.frist-edit-form')) return;

  const puffer = v.pufferTage ?? PUFFER_DEFAULT;
  view.innerHTML = `
    <div class="frist-edit-form">
      <div class="drawer-grid drawer-grid-3">
        <div class="field">
          <label class="field-label">Frist (echte Deadline)</label>
          <input type="date" id="vFristEdit" value="${v.frist || ''}">
        </div>
        <div class="field">
          <label class="field-label">Puffer (Tage vorher)</label>
          <input type="number" id="vPufferEdit" min="0" value="${puffer}">
        </div>
        <div class="field">
          <label class="field-label">Wiedervorlage (leer = automatisch)</label>
          <input type="date" id="vWiedervorlageEdit" value="${v.wiedervorlage || ''}">
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-primary" onclick="saveVorgangFrist()">✓ Speichern</button>
        <button class="btn" onclick="openVorgangDrawer('${v.id}')">✕ Abbrechen</button>
      </div>
    </div>
  `;
}

function saveVorgangFrist() {
  const v = window.vorgaenge.find(x => x.id === drawerVorgangId);
  if (!v) return;

  const frist = document.getElementById('vFristEdit').value || null;
  const pufferRaw = parseInt(document.getElementById('vPufferEdit').value, 10);
  const pufferTage = isNaN(pufferRaw) ? PUFFER_DEFAULT : Math.max(0, pufferRaw);
  const wiedervorlageManuell = document.getElementById('vWiedervorlageEdit').value || null;

  v.frist = frist;
  v.pufferTage = pufferTage;
  v.wiedervorlage = berechneWiedervorlage(frist, pufferTage, wiedervorlageManuell);
  v.letzteAktivitaet = today();

  saveDataVorgaenge();
  renderRegister();
  openVorgangDrawer(drawerVorgangId);
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
  renderRegister();
  openVorgangDrawer(id);
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
// SCHRITTE-VERWALTUNG (analog frühere Kanban-Karten)
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
  renderRegister();
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
  renderRegister();
  openVorgangDrawer(drawerVorgangId);
}

function deleteVorgangSchritt(idx) {
  const v = window.vorgaenge.find(x => x.id === drawerVorgangId);
  if (!v || !v.schritte || idx >= v.schritte.length) return;
  v.schritte.splice(idx, 1);
  v.letzteAktivitaet = today();
  saveDataVorgaenge();
  renderRegister();
  openVorgangDrawer(drawerVorgangId);
}

function editVorgangSchritt(idx) {
  const v = window.vorgaenge.find(x => x.id === drawerVorgangId);
  if (!v || !v.schritte || idx >= v.schritte.length) return;

  const items = document.querySelectorAll('#vDrawerBody .schritt-item');
  const target = Array.from(items).find(el => parseInt(el.dataset.idx) === idx);
  if (!target) return;

  if (target.querySelector('.schritt-edit-input')) return;

  const textEl = target.querySelector('.schritt-text');
  const currentText = v.schritte[idx];

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
      renderRegister();
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

function insertVorgangSchritt(idx) {
  const items = document.querySelectorAll('#vDrawerBody .schritt-item');
  const target = Array.from(items).find(el => parseInt(el.dataset.idx) === idx);
  if (!target) return;

  document.querySelectorAll('#vDrawerBody .schritt-insert-row').forEach(r => r.remove());

  const row = createSchrittInsertRow(idx + 1, 'darunter');
  target.after(row);
  row.querySelector('input').focus();
}

function insertVorgangSchrittAbove(idx) {
  const items = document.querySelectorAll('#vDrawerBody .schritt-item');
  const target = Array.from(items).find(el => parseInt(el.dataset.idx) === idx);
  if (!target) return;

  document.querySelectorAll('#vDrawerBody .schritt-insert-row').forEach(r => r.remove());

  const row = createSchrittInsertRow(idx, 'davor');
  target.before(row);
  row.querySelector('input').focus();
}

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
    renderRegister();
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
  renderRegister();
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
window.renderRegister = renderRegister;
window.renderVorgaengeTab = renderRegister; // Alias für app.js
window.openNewVorgangModal = openNewVorgangModal;
window.closeNewVorgangModal = closeNewVorgangModal;
window.closeVorgangModalIfBg = closeVorgangModalIfBg;
window.saveNewVorgang = saveNewVorgang;
window.openVorgangDrawer = openVorgangDrawer;
window.closeVorgangDrawer = closeVorgangDrawer;
window.changeVorgangStatus = changeVorgangStatus;
window.addVorgangLog = addVorgangLog;
window.deleteVorgang = deleteVorgang;
window.setupRegisterFilters = setupRegisterFilters;
window.editVorgangFrist = editVorgangFrist;
window.saveVorgangFrist = saveVorgangFrist;
window.computeDringlichkeit = computeDringlichkeit;
