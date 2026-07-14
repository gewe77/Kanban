// ═══════════════════════════════════════════════
// VERTRAGSABRUFE
//
// Leistungsabrufe aus Rahmenverträgen (fester Vertragsnehmer,
// feste Rahmenvertragsnummer, feste Laufzeit). Eigener
// Lebenszyklus in 3 Phasen: Anforderung → Ausführung → Abschluss.
// Gleiches Register-Prinzip wie das Vorgangsregister: flache,
// nach Dringlichkeit sortierte Liste statt Board/Ordner.
//
// Bewusst komplett unabhängig von register.js gehalten (eigene
// Firestore-Collection, eigene Funktionen, eigener Drawer) —
// analog zur strikten Trennung der Firebase-Projekte: Änderungen
// hier dürfen das laufende Vorgangsregister nie berühren.
//
// Firestore-Collection: vertragsabrufe (selbes Projekt/Instanz
// wie vorgaenge — betrieb-vorgaenge)
// ═══════════════════════════════════════════════

// Global state
window.abrufe = [];
let drawerAbrufId = null;
let showBezahlte = false;
try {
  showBezahlte = JSON.parse(localStorage.getItem('abrufe_show_bezahlt') || 'false');
} catch (e) {
  console.warn('localStorage nicht verfügbar — Anzeige-Einstellung (Abrufe) wird nicht gespeichert:', e.message);
}

// ─── Lebenszyklus-Status (3 Phasen) ───
const VA_STATUS = [
  { id: 'bedarf',             label: 'Bedarf gemeldet',           phase: 'anforderung' },
  { id: 'in-abruferstellung', label: 'Rahmenabruf wird erstellt', phase: 'anforderung' },
  { id: 'zur-zeichnung',      label: 'Zur Zeichnung',             phase: 'anforderung' },
  { id: 'versendet',          label: 'Versendet an Firma',        phase: 'anforderung' },
  { id: 'terminiert',         label: 'Terminiert',                phase: 'ausfuehrung' },
  { id: 'in-ausfuehrung',     label: 'In Ausführung',             phase: 'ausfuehrung' },
  { id: 'teilabschluss',      label: 'Teilabschluss',             phase: 'abschluss' },
  { id: 'abgeschlossen',      label: 'Abgeschlossen',             phase: 'abschluss' },
  { id: 'rechnung',           label: 'Rechnung',                  phase: 'abschluss' },
  { id: 'bezahlt',            label: 'Bezahlt',                   phase: 'abschluss' }
];

// Phasen-Icons — bewusst nur 3 Formen (+ Sonderfall Teilabschluss).
// Die Farbe kommt nicht vom Icon selbst, sondern von der
// Dringlichkeits-Klasse (siehe va-phase-* in styles.css).
const VA_PHASE_ICON = { anforderung: '📝', ausfuehrung: '⚙', abschluss: '✅' };

function getAbrufPhaseIcon(a) {
  if (a.status === 'teilabschluss') return '◐';
  const s = VA_STATUS.find(x => x.id === a.status);
  return VA_PHASE_ICON[s?.phase] || '📝';
}

// Standard-Pufferzeit für Vertragsabrufe (Tage vor dem Ausführungstermin)
const PUFFER_DEFAULT_VA = 3;

// ═══════════════════════════════════════════════
// FIRESTORE (Vertragsabrufe DB)
// ═══════════════════════════════════════════════
async function loadAbrufeFromFirestore() {
  setSyncStatus('syncing');
  try {
    const { getDocs } = window._fbFns;
    const snap = await getDocs(window._fbCol_abrufe());
    const remote = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (remote.length === 0) {
      // Gleiche Absicherung wie im Vorgangsregister: eine leere
      // Firestore-Antwort niemals blind übernehmen.
      const local = loadLocalDataAbrufe();
      if (local.length > 0) {
        window.abrufe = local;
        local.forEach(a => saveAbrufToFirestore(a));
        console.warn('Vertragsabrufe: lokale Daten gefunden, die noch nicht in Firestore lagen — werden jetzt hochgeladen.');
      } else {
        window.abrufe = [];
      }
    } else {
      window.abrufe = remote;
    }

    saveLocalAbrufe();
    renderAbrufeRegister();
    setSyncStatus('synced');
  } catch (e) {
    console.error('Firestore Vertragsabrufe laden:', e);
    window.abrufe = loadLocalDataAbrufe();
    renderAbrufeRegister();
    setSyncStatus('error');
  }
}

async function saveAbrufToFirestore(a) {
  if (!window._currentUser) {
    setSyncStatus('offline');
    return;
  }
  setSyncStatus('syncing');
  try {
    const { setDoc, doc } = window._fbFns;
    await setDoc(doc(window._db_vorgaenge, 'vertragsabrufe', a.id), a);
    setSyncStatus('synced');
  } catch (e) {
    console.error('Firestore Vertragsabruf speichern:', e);
    setSyncStatus('error');
  }
}

async function deleteAbrufFromFirestore(id) {
  if (!window._currentUser) {
    setSyncStatus('offline');
    return;
  }
  setSyncStatus('syncing');
  try {
    const { deleteDoc, doc } = window._fbFns;
    await deleteDoc(doc(window._db_vorgaenge, 'vertragsabrufe', id));
    setSyncStatus('synced');
  } catch (e) {
    console.error('Firestore Vertragsabruf löschen:', e);
    setSyncStatus('error');
  }
}

function saveDataAbrufe() {
  saveLocalAbrufe();
  if (window._currentUser) {
    window.abrufe.forEach(a => saveAbrufToFirestore(a));
  }
}

// ═══════════════════════════════════════════════
// ABRUF-NR GENERIEREN
// ═══════════════════════════════════════════════
function generateAbrufNr() {
  const year = new Date().getFullYear();
  const yearAbrufe = window.abrufe.filter(a =>
    a.abrufNr && a.abrufNr.startsWith(`VA-${year}-`)
  );
  const maxNum = yearAbrufe.reduce((max, a) => {
    const m = a.abrufNr.match(/VA-\d{4}-(\d+)/);
    return m ? Math.max(max, parseInt(m[1])) : max;
  }, 0);
  return `VA-${year}-${String(maxNum + 1).padStart(3, '0')}`;
}

// ═══════════════════════════════════════════════
// DATUMS-HILFEN (Termin/Puffer/Wiedervorlage)
// Eigenständig gehalten (nicht aus register.js importiert),
// damit abrufe.js unabhängig bleibt.
// ═══════════════════════════════════════════════
function addDaysStrAbruf(dateStr, days) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function berechneWiedervorlageAbruf(termin, pufferTage, manuelleWiedervorlage) {
  if (manuelleWiedervorlage) return manuelleWiedervorlage;
  if (!termin) return null;
  return addDaysStrAbruf(termin, pufferTage ?? PUFFER_DEFAULT_VA);
}

// ═══════════════════════════════════════════════
// DRINGLICHKEIT
// Wiederverwendet bewusst dieselben Klassen-Namen wie im
// Vorgangsregister (ueberfaellig/heute/neu/wartet/diese-woche/
// spaeter/erledigt) — dadurch greifen alle vorhandenen
// register-frist-*/register-dot-*-Farben ohne neues CSS.
// ═══════════════════════════════════════════════
function computeDringlichkeitAbruf(a) {
  if (a.status === 'bezahlt') {
    return { klasse: 'erledigt', label: 'bezahlt', rang: 99 };
  }

  const tageTermin = a.terminAusfuehrung ? daysUntil(a.terminAusfuehrung) : null;
  const tageWv = a.wiedervorlage ? daysUntil(a.wiedervorlage) : null;
  const frueheAnforderung = a.status === 'bedarf' || a.status === 'in-abruferstellung';
  const warteAufZeichnungVersand = a.status === 'zur-zeichnung' || a.status === 'versendet';

  // 1. Überfällig — Ausführungstermin in der Vergangenheit, Leistung
  //    aber noch nicht (voll) abgeschlossen bzw. in Rechnungsprüfung
  if (tageTermin !== null && tageTermin < 0 && !['abgeschlossen', 'rechnung'].includes(a.status)) {
    return { klasse: 'ueberfaellig', label: `⚠ überfällig · ${Math.abs(tageTermin)}d`, rang: 0 };
  }

  // 2. Heute fällig — Termin heute, oder Wiedervorlage heute/überschritten
  if (tageTermin === 0 || (tageWv !== null && tageWv <= 0)) {
    return {
      klasse: 'heute',
      label: tageTermin === 0 ? 'Termin heute' : 'Wiedervorlage heute',
      rang: 1
    };
  }

  // 3. Neu — Bedarf gemeldet, aber noch nicht an SB übergeben/in Erstellung
  if (frueheAnforderung) {
    return { klasse: 'neu', label: 'neu · Anforderung offen', rang: 1.5 };
  }

  // 4. Wartet — zur Zeichnung / versendet, mit künftiger Wiedervorlage
  if (warteAufZeichnungVersand && tageWv !== null && tageWv > 0) {
    return { klasse: 'wartet', label: `Wiedervorlage in ${tageWv}d`, rang: 2 };
  }

  // 5. Diese Woche
  if (tageTermin !== null && tageTermin <= 7) {
    return { klasse: 'diese-woche', label: `fällig in ${tageTermin}d`, rang: 3 };
  }

  // 6. Später
  return {
    klasse: 'spaeter',
    label: a.terminAusfuehrung ? `fällig in ${tageTermin}d` : 'kein Termin gesetzt',
    rang: 4
  };
}

// ═══════════════════════════════════════════════
// HELPER: Rahmenvertrag / Haushaltstitel zu ID finden
// ═══════════════════════════════════════════════
function getRahmenvertrag(id) {
  return (window.stammdaten?.rahmenvertraege || []).find(r => r.id === id) || null;
}

function getHaushaltstitel(id) {
  return (window.stammdaten?.haushaltstitel || []).find(h => h.id === id) || null;
}

// ═══════════════════════════════════════════════
// REGISTER-RENDER
// ═══════════════════════════════════════════════
function renderAbrufeRegister() {
  const countEl = document.getElementById('abrufeCount');
  if (countEl) countEl.textContent = (window.abrufe || []).length;

  renderAbrufeSummary();

  const container = document.getElementById('abrufeList');
  if (!container) return;

  const suchbegriff = (document.getElementById('abrufeSearch')?.value || '').toLowerCase().trim();

  let liste = (window.abrufe || []).filter(a => {
    if (!showBezahlte && a.status === 'bezahlt') return false;
    if (!suchbegriff) return true;
    const rv = getRahmenvertrag(a.rahmenvertragId);
    const rvText = rv ? `${rv.vertragsnehmer} ${rv.rvNummer}` : '';
    return (a.bedarf || '').toLowerCase().includes(suchbegriff) ||
           (a.anlage || '').toLowerCase().includes(suchbegriff) ||
           (a.liegenschaft || '').toLowerCase().includes(suchbegriff) ||
           (a.abrufNr || '').toLowerCase().includes(suchbegriff) ||
           rvText.toLowerCase().includes(suchbegriff);
  });

  liste = liste.map(a => ({ a, d: computeDringlichkeitAbruf(a) }));

  liste.sort((x, y) => {
    if (x.d.rang !== y.d.rang) return x.d.rang - y.d.rang;
    const ta = x.a.terminAusfuehrung ? daysUntil(x.a.terminAusfuehrung) : Infinity;
    const tb = y.a.terminAusfuehrung ? daysUntil(y.a.terminAusfuehrung) : Infinity;
    return ta - tb;
  });

  if (!liste.length) {
    container.innerHTML = '<div class="empty">— keine Vertragsabrufe —</div>';
    return;
  }

  container.innerHTML = liste.map(({ a, d }) => {
    const rv = getRahmenvertrag(a.rahmenvertragId);
    const rvLabel = rv ? `${rv.vertragsnehmer} · ${rv.rvNummer}` : '— kein Rahmenvertrag —';
    const statusObj = VA_STATUS.find(s => s.id === a.status);
    const statusLabel = (a.status === 'teilabschluss' && a.teilrechnungenAnzahl)
      ? `Teilabschluss (${a.teilrechnungenAnzahl}. Teilrechnung)`
      : (statusObj?.label || a.status);
    const schritte = a.schritte || [];
    const naechsterSchritt = schritte.length ? schritte[0] : (a.naechsterSchritt || '—');

    return `
      <div class="register-row" onclick="openAbrufDrawer('${a.id}')">
        <div class="va-phase-icon va-phase-${d.klasse}" title="${esc(d.label)}">${getAbrufPhaseIcon(a)}</div>
        <div class="register-main">
          <div class="register-title">${esc(a.abrufNr)} — ${esc(a.bedarf)}</div>
          <div class="register-sub">${esc(statusLabel)} · ${esc(rvLabel)} · ${esc(a.liegenschaft || '—')} / ${esc(a.anlage || '—')}</div>
        </div>
        <div class="register-side">
          <div class="register-next">${esc(naechsterSchritt)}</div>
          <div class="register-frist register-frist-${d.klasse}">${esc(d.label)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAbrufeSummary() {
  const bar = document.getElementById('abrufeSummary');
  if (!bar) return;

  const offen = (window.abrufe || []).filter(a => a.status !== 'bezahlt');
  const zaehlen = { ueberfaellig: 0, heute: 0, wartet: 0, 'diese-woche': 0 };
  offen.forEach(a => {
    const d = computeDringlichkeitAbruf(a);
    if (zaehlen[d.klasse] !== undefined) zaehlen[d.klasse]++;
  });
  const teilCount = offen.filter(a => a.status === 'teilabschluss').length;

  bar.innerHTML = `
    <span class="register-summary-item ${zaehlen.ueberfaellig ? 'urgent' : ''}">${zaehlen.ueberfaellig} überfällig</span>
    <span class="register-summary-item ${zaehlen.heute ? 'urgent' : ''}">${zaehlen.heute} heute fällig</span>
    <span class="register-summary-item">${zaehlen['diese-woche']} diese Woche</span>
    <span class="register-summary-item">${zaehlen.wartet} wartet auf Zeichnung/Versand</span>
    <span class="register-summary-item">${teilCount} in Teilabschluss</span>
  `;
}

// ═══════════════════════════════════════════════
// FILTER / SUCHE
// ═══════════════════════════════════════════════
function setupAbrufeFilters() {
  const search = document.getElementById('abrufeSearch');
  if (search) search.addEventListener('input', renderAbrufeRegister);

  const toggle = document.getElementById('abrufeShowErledigt');
  if (toggle) {
    toggle.checked = showBezahlte;
    toggle.addEventListener('change', () => {
      showBezahlte = toggle.checked;
      try {
        localStorage.setItem('abrufe_show_bezahlt', JSON.stringify(showBezahlte));
      } catch (e) {
        console.warn('localStorage nicht verfügbar:', e.message);
      }
      renderAbrufeRegister();
    });
  }
}

// ═══════════════════════════════════════════════
// NEUER VERTRAGSABRUF MODAL
// Bewusst schlank gehalten: nur, was beim Bedarf schon
// bekannt ist. Sachbearbeiter/Titel/Objektnummer/Auftragswert/
// Abrufvermerk kommen typischerweise erst später dazu und
// werden im Drawer nachgetragen (progressive Erfassung).
// ═══════════════════════════════════════════════
function openNewAbrufModal() {
  ['aBedarf', 'aTermin', 'aNachweis'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('aRahmenvertrag').value = '';
  document.getElementById('aLiegenschaft').value = '';
  document.getElementById('aBedarfsersteller').value = '';
  document.getElementById('aPuffertage').value = PUFFER_DEFAULT_VA;
  if (typeof updateAbrufAnlagenDropdown === 'function') updateAbrufAnlagenDropdown();

  document.getElementById('abrufModalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('aBedarf')?.focus(), 50);
}

function closeNewAbrufModal() {
  document.getElementById('abrufModalOverlay').classList.remove('open');
}

function closeAbrufModalIfBg(e) {
  if (e.target === document.getElementById('abrufModalOverlay')) closeNewAbrufModal();
}

function saveNewAbruf() {
  const bedarf = document.getElementById('aBedarf').value.trim();
  const rahmenvertragId = document.getElementById('aRahmenvertrag').value;
  const liegenschaft = document.getElementById('aLiegenschaft').value;
  const anlage = document.getElementById('aAnlage').value;
  const bedarfsersteller = document.getElementById('aBedarfsersteller').value;

  if (!bedarf || !rahmenvertragId || !liegenschaft || !anlage || !bedarfsersteller) {
    alert('Bitte alle Pflichtfelder ausfüllen (Rahmenvertrag, Liegenschaft, Anlage, Bedarf, Bedarfsersteller)');
    return;
  }

  const t = today();
  const terminAusfuehrung = document.getElementById('aTermin').value || null;
  const pufferRaw = parseInt(document.getElementById('aPuffertage').value, 10);
  const pufferTage = isNaN(pufferRaw) ? PUFFER_DEFAULT_VA : Math.max(0, pufferRaw);
  const wiedervorlage = berechneWiedervorlageAbruf(terminAusfuehrung, pufferTage, null);

  const newAbruf = {
    id: uid(),
    abrufNr: generateAbrufNr(),
    rahmenvertragId: rahmenvertragId,
    liegenschaft: liegenschaft,
    anlage: anlage,
    bedarf: bedarf,
    bedarfsersteller: bedarfsersteller,
    sachbearbeiter: null,
    haushaltstitelId: null,
    auftragswert: null,
    abrufvermerk: null,
    positionen: null,
    status: 'bedarf',
    terminAusfuehrung: terminAusfuehrung,
    pufferTage: pufferTage,
    wiedervorlage: wiedervorlage,
    teilrechnungenAnzahl: 0,
    naechsterSchritt: null,
    nachweis: document.getElementById('aNachweis').value.trim() || null,
    schritte: [],
    schritteDone: 0,
    log: `${t}: Vertragsabruf angelegt (Bedarf gemeldet)`,
    letzteAktivitaet: t
  };

  window.abrufe.push(newAbruf);

  saveDataAbrufe();
  closeNewAbrufModal();
  renderAbrufeRegister();
  // Drawer direkt öffnen — Positionen/Abrufvermerk/Verwaltungsdaten werden
  // typischerweise im selben Arbeitsgang ergänzt (siehe Praxisbeispiel:
  // die komplette Abruf-Mail entsteht in einem Zug).
  openAbrufDrawer(newAbruf.id);
}

// ═══════════════════════════════════════════════
// VERTRAGSABRUF DETAIL DRAWER
// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
// EXPORT FÜR BÜROSACHBEARBEITER (Zwischenablage)
// Erzeugt den Textblock im Format @/#/>/Begründung aus den
// vorhandenen Feldern, damit er direkt in eine E-Mail eingefügt
// werden kann. Begrüßung/Anrede/Signatur bewusst nicht generiert
// (Namen/Ansprechpartner variieren) — nur der aus den Daten
// ableitbare Teil wird automatisiert.
// ═══════════════════════════════════════════════
function buildAbrufExportText(a) {
  const rv = getRahmenvertrag(a.rahmenvertragId);
  const firma = rv ? rv.vertragsnehmer : '(Rahmenvertrag fehlt)';

  const lines = [];
  lines.push(`@${firma} :: ${a.bedarf || ''}`);
  lines.push(`# ${a.liegenschaft || '—'} - ${a.anlage || '—'}`);

  const posLines = (a.positionen || '').split('\n').map(l => l.trim()).filter(Boolean);
  posLines.forEach(l => {
    lines.push(`> ${l.replace(/^>+\s*/, '')}`);
  });

  lines.push('');
  lines.push(`Begründung: ${a.abrufvermerk || ''}`);

  return lines.join('\n');
}

async function copyAbrufForSB() {
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a) return;
  const text = buildAbrufExportText(a);
  const btn = document.getElementById('aCopyBtn');

  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = '✓ Kopiert';
      setTimeout(() => { if (btn) btn.textContent = original; }, 1600);
    }
  } catch (e) {
    console.error('Zwischenablage nicht erreichbar:', e);
    alert('Kopieren in die Zwischenablage hat nicht funktioniert. Text zum manuellen Kopieren:\n\n' + text);
  }
}

function openAbrufDrawer(abrufId) {
  drawerAbrufId = abrufId;
  const a = window.abrufe.find(x => x.id === abrufId);
  if (!a) return;

  const d = computeDringlichkeitAbruf(a);
  const statusObj = VA_STATUS.find(s => s.id === a.status);
  const rv = getRahmenvertrag(a.rahmenvertragId);

  document.getElementById('aDrawerTitle').textContent = `${a.abrufNr} — ${a.bedarf}`;

  const logLines = (a.log || '').split('\n').filter(Boolean).map((l, idx) => {
    const m = l.match(/^(\d{4}-\d{2}-\d{2}):\s*(.+)$/);
    const dateSpan = m ? `<span class="log-date">${m[1]}</span>` : '';
    const textSpan = `<span class="log-text">${esc(m ? m[2] : l)}</span>`;
    return `<div class="log-entry">
      <div class="log-entry-content">${dateSpan}${textSpan}</div>
      <div class="log-entry-actions">
        <button class="log-entry-btn" onclick="editAbrufLogEntry(event,${idx})" title="Bearbeiten">✎</button>
        <button class="log-entry-btn del" onclick="deleteAbrufLogEntry(${idx})" title="Löschen">✕</button>
      </div>
    </div>`;
  }).join('');

  const schritte = a.schritte || [];
  const done = a.schritteDone || 0;
  const totalSchritte = schritte.length + done;
  const nextStep = schritte.length ? schritte[0] : (a.naechsterSchritt || '—');

  const schritteHtml = schritte.map((s, idx) => `
    <div class="schritt-item" data-idx="${idx}">
      <div class="schritt-check" onclick="checkAbrufSchritt(${idx})" title="Abhaken">✓</div>
      <div class="schritt-text" onclick="editAbrufSchritt(${idx})" title="Klicken zum Bearbeiten">${esc(s)}</div>
      <button class="schritt-del ins" onclick="insertAbrufSchrittAbove(${idx})" title="Schritt davor einfügen">↑+</button>
      <button class="schritt-del ins" onclick="insertAbrufSchritt(${idx})" title="Schritt darunter einfügen">+</button>
      <button class="schritt-del" onclick="deleteAbrufSchritt(${idx})" title="Entfernen">✕</button>
    </div>`).join('');

  const schritteProgressHtml = totalSchritte > 0
    ? `<div class="schritt-progress">
        <span>${done}/${totalSchritte} erledigt</span>
        <div class="schritt-progress-bar"><div class="schritt-progress-fill" style="width:${Math.round(done / totalSchritte * 100)}%"></div></div>
       </div>`
    : '';

  const rvHtml = rv
    ? `${esc(rv.vertragsnehmer)} — ${esc(rv.rvNummer)}${rv.laufzeitBis ? ` (Laufzeit bis ${fmt(rv.laufzeitBis)})` : ''}`
    : '<span style="color:var(--text3)">— nicht mehr in Stammdaten vorhanden —</span>';

  // Haushaltstitel: über Stammdaten-Referenz auflösen; Fallback auf alte
  // Freitext-Felder (titel/objektnummer), falls der Abruf noch aus der
  // Zeit vor der Stammdaten-Anbindung stammt.
  const ht = a.haushaltstitelId ? getHaushaltstitel(a.haushaltstitelId) : null;
  let htHtml;
  if (ht) {
    htHtml = ht.objektnummer
      ? `${esc(ht.titel)} · ${esc(ht.objektnummer)} <span style="color:var(--text2)">– ${esc(ht.bezeichnung)}</span>`
      : `${esc(ht.titel)} <span style="color:var(--text2)">– ${esc(ht.bezeichnung)}</span>`;
    if (ht.erlaeuterung) {
      htHtml += `<div style="color:var(--text3);font-size:11px;margin-top:3px;white-space:pre-line">${esc(ht.erlaeuterung)}</div>`;
    }
  } else if (a.haushaltstitelId) {
    htHtml = '<span style="color:var(--text3)">— nicht mehr in Stammdaten vorhanden —</span>';
  } else if (a.titel || a.objektnummer) {
    htHtml = `${esc(a.titel || '—')} · ${esc(a.objektnummer || '—')} <span style="color:var(--text3)">(alt erfasst)</span>`;
  } else {
    htHtml = '—';
  }

  const exportText = buildAbrufExportText(a);

  document.getElementById('aDrawerBody').innerHTML = `
    <div class="drawer-section">
      <div class="drawer-section-title">Für Bürosachbearbeiter <span style="color:var(--text3);font-weight:400;text-transform:none;letter-spacing:0">(Text zum Einfügen in die E-Mail)</span></div>
      <div class="va-positionen-view" style="background:var(--el-2);border:1px solid var(--line2);border-radius:4px;padding:10px 12px">${esc(exportText)}</div>
      <button class="btn btn-primary" id="aCopyBtn" style="margin-top:8px" onclick="copyAbrufForSB()">📋 In Zwischenablage kopieren</button>
    </div>

    <div class="drawer-section">
      <div class="drawer-section-title">Dringlichkeit</div>
      <div class="register-frist register-frist-${d.klasse}" style="display:inline-block;font-size:12px;padding:4px 10px;border-radius:4px">${esc(d.label)}</div>
    </div>

    <div class="drawer-section">
      <div class="drawer-section-title">Metadaten</div>
      <div class="drawer-grid">
        <div>
          <div class="dfield-label">Abruf-Nr</div>
          <div class="dfield-val">${esc(a.abrufNr)}</div>
        </div>
        <div>
          <div class="dfield-label">Rahmenvertrag</div>
          <div class="dfield-val">${rvHtml}</div>
        </div>
        <div>
          <div class="dfield-label">Liegenschaft</div>
          <div class="dfield-val">${esc(a.liegenschaft || '—')}</div>
        </div>
        <div>
          <div class="dfield-label">Anlage</div>
          <div class="dfield-val"><strong>${esc(a.anlage || '—')}</strong></div>
        </div>
        <div>
          <div class="dfield-label">Bedarfsersteller</div>
          <div class="dfield-val">${esc(a.bedarfsersteller || '—')}</div>
        </div>
        <div>
          <div class="dfield-label">Status</div>
          <div class="dfield-val">${esc(statusObj?.label || a.status)}</div>
        </div>
      </div>
    </div>

    <div class="drawer-section">
      <div class="drawer-section-title">Verwaltungsdaten</div>
      <div id="aVerwaltungView">
        <div class="drawer-grid">
          <div>
            <div class="dfield-label">Sachbearbeiter</div>
            <div class="dfield-val">${esc(a.sachbearbeiter || '—')}</div>
          </div>
          <div>
            <div class="dfield-label">Haushaltstitel</div>
            <div class="dfield-val">${htHtml}</div>
          </div>
          <div>
            <div class="dfield-label">Auftragswert</div>
            <div class="dfield-val">${a.auftragswert != null ? esc(a.auftragswert) + ' €' : '—'}</div>
          </div>
        </div>
        <button class="btn" style="margin-top:8px" onclick="editAbrufVerwaltung()">Bearbeiten</button>
      </div>
    </div>

    <div class="drawer-section">
      <div class="drawer-section-title">Abrufvermerk <span style="color:var(--text3);font-weight:400;text-transform:none;letter-spacing:0">(haushaltsrechtliche Begründung)</span></div>
      <div id="aVermerkView">
        <div class="dfield-val">${a.abrufvermerk ? esc(a.abrufvermerk) : '<span style="color:var(--text3)">— noch nicht erfasst —</span>'}</div>
        <button class="btn" style="margin-top:8px" onclick="editAbrufVermerk()">Bearbeiten</button>
      </div>
    </div>

    <div class="drawer-section">
      <div class="drawer-section-title">Abgerufene Positionen <span style="color:var(--text3);font-weight:400;text-transform:none;letter-spacing:0">(aus dem Rahmenvertrag)</span></div>
      <div id="aPositionenView">
        <div class="va-positionen-view">${a.positionen ? esc(a.positionen) : '<span style="color:var(--text3);font-family:var(--sans)">— noch nicht erfasst —</span>'}</div>
        <button class="btn" style="margin-top:8px" onclick="editAbrufPositionen()">Bearbeiten</button>
      </div>
    </div>

    <div class="drawer-section">
      <div class="drawer-section-title">Termin &amp; Wiedervorlage</div>
      <div id="aTerminView">
        <div class="drawer-grid drawer-grid-3">
          <div>
            <div class="dfield-label">Termin Ausführung</div>
            <div class="dfield-val">${a.terminAusfuehrung ? fmtLong(a.terminAusfuehrung) : '—'}</div>
          </div>
          <div>
            <div class="dfield-label">Puffer</div>
            <div class="dfield-val">${a.pufferTage ?? PUFFER_DEFAULT_VA} Tage</div>
          </div>
          <div>
            <div class="dfield-label">Wiedervorlage</div>
            <div class="dfield-val">${a.wiedervorlage ? fmtLong(a.wiedervorlage) : '—'}</div>
          </div>
        </div>
        <button class="btn" style="margin-top:8px" onclick="editAbrufTermin()">Bearbeiten</button>
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
        <input type="text" id="aSchrittInput" placeholder="Neuen Schritt hinzufügen…" onkeydown="if(event.key==='Enter')addAbrufSchritt()">
        <button class="btn" onclick="addAbrufSchritt()">+ Schritt</button>
      </div>
    </div>

    ${a.nachweis ? `
    <div class="drawer-section">
      <div class="drawer-section-title">Nachweis / Referenz</div>
      <div class="dfield-val">${esc(a.nachweis)}</div>
    </div>
    ` : ''}

    <div class="drawer-section">
      <div class="drawer-section-title">Teilrechnungen</div>
      <div class="va-teilrechnung-info">${a.teilrechnungenAnzahl || 0} Teilrechnung${(a.teilrechnungenAnzahl || 0) === 1 ? '' : 'en'} erfasst — dient nur der Nachvollziehbarkeit, keine Buchhaltung.</div>
      <div class="schritt-add">
        <input type="text" id="aTeilrechnungInput" placeholder="Kurznotiz zur Teilrechnung (z.B. Bauteil X montiert, RE-Nr. …)…" onkeydown="if(event.key==='Enter')addAbrufTeilrechnung()">
        <button class="btn" onclick="addAbrufTeilrechnung()">+ Teilrechnung erfassen</button>
      </div>
    </div>

    <div class="drawer-section">
      <div class="drawer-section-title">Status ändern</div>
      <select id="aStatusChange" onchange="changeAbrufStatus('${a.id}', this.value)"
        style="width:100%;background:var(--el-3);border:1px solid var(--line2);border-radius:4px;color:var(--text);font-family:var(--sans);font-size:12px;padding:8px 11px;outline:none">
        ${VA_STATUS.map(s => `<option value="${s.id}" ${s.id === a.status ? 'selected' : ''}>${s.label}</option>`).join('')}
      </select>
    </div>

    <div class="drawer-section">
      <div class="drawer-section-title">Log / Chronik</div>
      <div>${logLines || '<div style="color:var(--text3);font-size:11px">Noch kein Eintrag.</div>'}</div>
      <div class="log-add">
        <input type="text" id="aLogInput" placeholder="Neuer Log-Eintrag…" onkeydown="if(event.key==='Enter')addAbrufLog()">
        <button class="btn" onclick="addAbrufLog()">+ Log</button>
      </div>
    </div>

    <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:8px">
      Letzte Aktivität: ${a.letzteAktivitaet || '—'}
    </div>
  `;

  document.getElementById('aDrawerOverlay').classList.add('open');
  document.getElementById('aDrawer').classList.add('open');
}

function closeAbrufDrawer() {
  document.getElementById('aDrawerOverlay').classList.remove('open');
  document.getElementById('aDrawer').classList.remove('open');
  drawerAbrufId = null;
}

// ─── Termin/Puffer/Wiedervorlage bearbeiten ───
// Explizites Speichern/Abbrechen statt Blur-Autosave (gleiche
// Lektion wie im Vorgangsregister: Blur löst bei jedem Klick
// aus und würde den Drawer ungewollt neu rendern).
function editAbrufTermin() {
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a) return;

  const view = document.getElementById('aTerminView');
  if (!view || view.querySelector('.frist-edit-form')) return;

  const puffer = a.pufferTage ?? PUFFER_DEFAULT_VA;
  view.innerHTML = `
    <div class="frist-edit-form">
      <div class="drawer-grid drawer-grid-3">
        <div class="field">
          <label class="field-label">Termin Ausführung</label>
          <input type="date" id="aTerminEdit" value="${a.terminAusfuehrung || ''}">
        </div>
        <div class="field">
          <label class="field-label">Puffer (Tage vorher)</label>
          <input type="number" id="aPufferEdit" min="0" value="${puffer}">
        </div>
        <div class="field">
          <label class="field-label">Wiedervorlage (leer = automatisch)</label>
          <input type="date" id="aWiedervorlageEdit" value="${a.wiedervorlage || ''}">
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-primary" onclick="saveAbrufTermin()">✓ Speichern</button>
        <button class="btn" onclick="openAbrufDrawer('${a.id}')">✕ Abbrechen</button>
      </div>
    </div>
  `;
}

function saveAbrufTermin() {
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a) return;

  const termin = document.getElementById('aTerminEdit').value || null;
  const pufferRaw = parseInt(document.getElementById('aPufferEdit').value, 10);
  const pufferTage = isNaN(pufferRaw) ? PUFFER_DEFAULT_VA : Math.max(0, pufferRaw);
  const wiedervorlageManuell = document.getElementById('aWiedervorlageEdit').value || null;

  a.terminAusfuehrung = termin;
  a.pufferTage = pufferTage;
  a.wiedervorlage = berechneWiedervorlageAbruf(termin, pufferTage, wiedervorlageManuell);
  a.letzteAktivitaet = today();

  saveDataAbrufe();
  renderAbrufeRegister();
  openAbrufDrawer(drawerAbrufId);
}

// ─── Verwaltungsdaten bearbeiten (Sachbearbeiter/Haushaltstitel/Auftragswert) ───
// Diese Felder sind bei Bedarfsmeldung typischerweise noch nicht
// bekannt und kommen erst nach Übergabe an den Bürosachbearbeiter
// dazu — deshalb separat editierbar statt Pflichtfeld bei Anlage.
function editAbrufVerwaltung() {
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a) return;

  const view = document.getElementById('aVerwaltungView');
  if (!view || view.querySelector('.frist-edit-form')) return;

  const htListe = [...(window.stammdaten?.haushaltstitel || [])].sort((x, y) => (x.sort ?? 99) - (y.sort ?? 99));
  const kapitel = [...new Set(htListe.map(h => h.kapitel || '—'))];
  const optionsHtml = kapitel.map(kap => {
    const opts = htListe.filter(h => (h.kapitel || '—') === kap).map(h => {
      const label = h.objektnummer ? `${h.titel} · ${h.objektnummer} – ${h.bezeichnung}` : `${h.titel} – ${h.bezeichnung}`;
      const title = h.erlaeuterung ? ` title="${esc(h.erlaeuterung)}"` : '';
      return `<option value="${h.id}"${title} ${a.haushaltstitelId === h.id ? 'selected' : ''}>${esc(label)}</option>`;
    }).join('');
    return `<optgroup label="Kapitel ${esc(kap)}">${opts}</optgroup>`;
  }).join('');

  view.innerHTML = `
    <div class="frist-edit-form">
      <div class="drawer-grid">
        <div class="field">
          <label class="field-label">Sachbearbeiter</label>
          <input type="text" id="aSachbearbeiterEdit" value="${esc(a.sachbearbeiter || '')}" placeholder="Name / Stelle">
        </div>
        <div class="field">
          <label class="field-label">Haushaltstitel</label>
          <select id="aHaushaltstitelEdit">
            <option value="">— Wählen —</option>
            ${optionsHtml}
          </select>
          <div style="color:var(--text3);font-size:9px;margin-top:3px">💡 Maus über einen Eintrag halten zeigt die Erläuterung</div>
        </div>
        <div class="field">
          <label class="field-label">Auftragswert (€)</label>
          <input type="number" id="aAuftragswertEdit" min="0" step="0.01" value="${a.auftragswert ?? ''}">
        </div>
      </div>
      ${!htListe.length ? '<div style="color:var(--text3);font-size:10px;margin-bottom:8px">Noch keine Haushaltstitel angelegt — siehe Einstellungen.</div>' : ''}
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-primary" onclick="saveAbrufVerwaltung()">✓ Speichern</button>
        <button class="btn" onclick="openAbrufDrawer('${a.id}')">✕ Abbrechen</button>
      </div>
    </div>
  `;
}

function saveAbrufVerwaltung() {
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a) return;

  a.sachbearbeiter = document.getElementById('aSachbearbeiterEdit').value.trim() || null;
  a.haushaltstitelId = document.getElementById('aHaushaltstitelEdit').value || null;
  const wertRaw = parseFloat(document.getElementById('aAuftragswertEdit').value);
  a.auftragswert = isNaN(wertRaw) ? null : wertRaw;
  a.letzteAktivitaet = today();

  saveDataAbrufe();
  renderAbrufeRegister();
  openAbrufDrawer(drawerAbrufId);
}

// ─── Abrufvermerk bearbeiten ───
function editAbrufVermerk() {
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a) return;

  const view = document.getElementById('aVermerkView');
  if (!view || view.querySelector('.frist-edit-form')) return;

  view.innerHTML = `
    <div class="frist-edit-form">
      <div class="field">
        <textarea id="aVermerkEdit" placeholder="Haushaltsrechtliche Begründung, warum diese Leistung abgerufen werden muss…">${esc(a.abrufvermerk || '')}</textarea>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="saveAbrufVermerk()">✓ Speichern</button>
        <button class="btn" onclick="openAbrufDrawer('${a.id}')">✕ Abbrechen</button>
      </div>
    </div>
  `;
}

function saveAbrufVermerk() {
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a) return;

  a.abrufvermerk = document.getElementById('aVermerkEdit').value.trim() || null;
  a.letzteAktivitaet = today();

  saveDataAbrufe();
  openAbrufDrawer(drawerAbrufId);
}

// ─── Abgerufene Positionen bearbeiten ───
// Freitext (eine Position pro Zeile), da Format je nach Rahmenvertrag/
// Leistungsverzeichnis variiert (Pos.-Nr, Menge, Einheit, Bezeichnung).
// Bewusst kein Zeilen-Editor mit Einzelfeldern — analog zur Entscheidung
// bei den Teilrechnungen: Ziel ist Nachvollziehbarkeit, keine Kalkulation.
function editAbrufPositionen() {
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a) return;

  const view = document.getElementById('aPositionenView');
  if (!view || view.querySelector('.frist-edit-form')) return;

  view.innerHTML = `
    <div class="frist-edit-form">
      <div class="field">
        <textarea id="aPositionenEdit" style="min-height:100px;font-family:var(--mono);font-size:11px" placeholder="Pos. 3.1.20     10 Std. Servicetechniker&#10;Pos. 3.1.150   1 Stck. An-/Abfahrtspauschale…">${esc(a.positionen || '')}</textarea>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="saveAbrufPositionen()">✓ Speichern</button>
        <button class="btn" onclick="openAbrufDrawer('${a.id}')">✕ Abbrechen</button>
      </div>
    </div>
  `;
}

function saveAbrufPositionen() {
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a) return;

  a.positionen = document.getElementById('aPositionenEdit').value.trim() || null;
  a.letzteAktivitaet = today();

  saveDataAbrufe();
  openAbrufDrawer(drawerAbrufId);
}

// ─── Status ändern ───
function changeAbrufStatus(id, newStatus) {
  const a = window.abrufe.find(x => x.id === id);
  if (!a) return;
  const t = today();
  const oldLabel = VA_STATUS.find(s => s.id === a.status)?.label || a.status;
  const newLabel = VA_STATUS.find(s => s.id === newStatus)?.label || newStatus;

  a.status = newStatus;
  a.letzteAktivitaet = t;
  a.log = `${t}: Status: ${oldLabel} → ${newLabel}\n` + (a.log || '');

  saveDataAbrufe();
  renderAbrufeRegister();
  openAbrufDrawer(id);
}

// ─── Teilrechnungen (bewusst schlank: Zähler + Log, keine Buchhaltung) ───
function addAbrufTeilrechnung() {
  const input = document.getElementById('aTeilrechnungInput');
  const text = (input.value || '').trim();
  if (!text) return;
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a) return;

  a.teilrechnungenAnzahl = (a.teilrechnungenAnzahl || 0) + 1;
  const t = today();
  a.log = `${t}: Teilrechnung Nr. ${a.teilrechnungenAnzahl}: ${text}\n` + (a.log || '');
  a.letzteAktivitaet = t;

  saveDataAbrufe();
  renderAbrufeRegister();
  openAbrufDrawer(drawerAbrufId);
}

// ═══════════════════════════════════════════════
// LOG-VERWALTUNG
// ═══════════════════════════════════════════════
function addAbrufLog() {
  const input = document.getElementById('aLogInput');
  const text = (input.value || '').trim();
  if (!text) return;
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a) return;
  const t = today();
  a.log = `${t}: ${text}` + (a.log ? '\n' + a.log : '');
  a.letzteAktivitaet = t;
  saveDataAbrufe();
  openAbrufDrawer(drawerAbrufId);
}

function editAbrufLogEntry(e, idx) {
  e.stopPropagation();
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a) return;
  const lines = (a.log || '').split('\n').filter(Boolean);
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
    a.log = lines.join('\n');
    a.letzteAktivitaet = today();
    saveDataAbrufe();
    openAbrufDrawer(drawerAbrufId);
  }

  editBtn.addEventListener('click', ev => {
    ev.stopPropagation();
    save();
  });
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') save();
    if (ev.key === 'Escape') openAbrufDrawer(drawerAbrufId);
  });
}

function deleteAbrufLogEntry(idx) {
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a) return;
  const lines = (a.log || '').split('\n').filter(Boolean);
  if (idx >= lines.length) return;

  if (!confirm('Log-Eintrag wirklich löschen?')) return;

  lines.splice(idx, 1);
  a.log = lines.join('\n');
  a.letzteAktivitaet = today();
  saveDataAbrufe();
  openAbrufDrawer(drawerAbrufId);
}

// ═══════════════════════════════════════════════
// SCHRITTE-VERWALTUNG (analog Vorgangsregister)
// ═══════════════════════════════════════════════
function addAbrufSchritt() {
  const input = document.getElementById('aSchrittInput');
  const text = (input.value || '').trim();
  if (!text) return;
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a) return;
  if (!a.schritte) a.schritte = [];
  a.schritte.push(text);
  a.letzteAktivitaet = today();
  saveDataAbrufe();
  renderAbrufeRegister();
  openAbrufDrawer(drawerAbrufId);
}

function checkAbrufSchritt(idx) {
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a || !a.schritte || idx >= a.schritte.length) return;
  const t = today();
  const text = a.schritte[idx];
  a.schritte.splice(idx, 1);
  a.schritteDone = (a.schritteDone || 0) + 1;
  a.log = `${t}: ✓ ${text}\n` + (a.log || '');
  a.letzteAktivitaet = t;
  saveDataAbrufe();
  renderAbrufeRegister();
  openAbrufDrawer(drawerAbrufId);
}

function deleteAbrufSchritt(idx) {
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a || !a.schritte || idx >= a.schritte.length) return;
  a.schritte.splice(idx, 1);
  a.letzteAktivitaet = today();
  saveDataAbrufe();
  renderAbrufeRegister();
  openAbrufDrawer(drawerAbrufId);
}

function editAbrufSchritt(idx) {
  const a = window.abrufe.find(x => x.id === drawerAbrufId);
  if (!a || !a.schritte || idx >= a.schritte.length) return;

  const items = document.querySelectorAll('#aDrawerBody .schritt-item');
  const target = Array.from(items).find(el => parseInt(el.dataset.idx) === idx);
  if (!target) return;

  if (target.querySelector('.schritt-edit-input')) return;

  const textEl = target.querySelector('.schritt-text');
  const currentText = a.schritte[idx];

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
      a.schritte[idx] = newText;
      a.letzteAktivitaet = today();
      saveDataAbrufe();
      renderAbrufeRegister();
    }
    openAbrufDrawer(drawerAbrufId);
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

function insertAbrufSchritt(idx) {
  const items = document.querySelectorAll('#aDrawerBody .schritt-item');
  const target = Array.from(items).find(el => parseInt(el.dataset.idx) === idx);
  if (!target) return;

  document.querySelectorAll('#aDrawerBody .schritt-insert-row').forEach(r => r.remove());

  const row = createAbrufSchrittInsertRow(idx + 1, 'darunter');
  target.after(row);
  row.querySelector('input').focus();
}

function insertAbrufSchrittAbove(idx) {
  const items = document.querySelectorAll('#aDrawerBody .schritt-item');
  const target = Array.from(items).find(el => parseInt(el.dataset.idx) === idx);
  if (!target) return;

  document.querySelectorAll('#aDrawerBody .schritt-insert-row').forEach(r => r.remove());

  const row = createAbrufSchrittInsertRow(idx, 'davor');
  target.before(row);
  row.querySelector('input').focus();
}

function createAbrufSchrittInsertRow(insertAtIdx, position) {
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
    const a = window.abrufe.find(x => x.id === drawerAbrufId);
    if (!a) return;
    if (!a.schritte) a.schritte = [];
    a.schritte.splice(insertAtIdx, 0, text);
    a.letzteAktivitaet = today();
    saveDataAbrufe();
    renderAbrufeRegister();
    openAbrufDrawer(drawerAbrufId);
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') doInsert();
    if (e.key === 'Escape') row.remove();
  });
  btnSave.addEventListener('click', doInsert);
  btnCancel.addEventListener('click', () => row.remove());

  return row;
}

function deleteAbruf() {
  if (!drawerAbrufId) return;
  if (!confirm('Vertragsabruf wirklich löschen?')) return;

  deleteAbrufFromFirestore(drawerAbrufId);
  window.abrufe = window.abrufe.filter(a => a.id !== drawerAbrufId);
  saveLocalAbrufe();
  closeAbrufDrawer();
  renderAbrufeRegister();
}

// ═══════════════════════════════════════════════
// EXPORTS (global)
// ═══════════════════════════════════════════════
window.VA_STATUS = VA_STATUS;
window.loadAbrufeFromFirestore = loadAbrufeFromFirestore;
window.renderAbrufeRegister = renderAbrufeRegister;
window.setupAbrufeFilters = setupAbrufeFilters;
window.openNewAbrufModal = openNewAbrufModal;
window.closeNewAbrufModal = closeNewAbrufModal;
window.closeAbrufModalIfBg = closeAbrufModalIfBg;
window.saveNewAbruf = saveNewAbruf;
window.openAbrufDrawer = openAbrufDrawer;
window.buildAbrufExportText = buildAbrufExportText;
window.copyAbrufForSB = copyAbrufForSB;
window.closeAbrufDrawer = closeAbrufDrawer;
window.editAbrufTermin = editAbrufTermin;
window.saveAbrufTermin = saveAbrufTermin;
window.editAbrufVerwaltung = editAbrufVerwaltung;
window.saveAbrufVerwaltung = saveAbrufVerwaltung;
window.editAbrufVermerk = editAbrufVermerk;
window.saveAbrufVermerk = saveAbrufVermerk;
window.editAbrufPositionen = editAbrufPositionen;
window.saveAbrufPositionen = saveAbrufPositionen;
window.getHaushaltstitel = getHaushaltstitel;
window.changeAbrufStatus = changeAbrufStatus;
window.addAbrufTeilrechnung = addAbrufTeilrechnung;
window.addAbrufLog = addAbrufLog;
window.editAbrufLogEntry = editAbrufLogEntry;
window.deleteAbrufLogEntry = deleteAbrufLogEntry;
window.addAbrufSchritt = addAbrufSchritt;
window.checkAbrufSchritt = checkAbrufSchritt;
window.deleteAbrufSchritt = deleteAbrufSchritt;
window.editAbrufSchritt = editAbrufSchritt;
window.insertAbrufSchritt = insertAbrufSchritt;
window.insertAbrufSchrittAbove = insertAbrufSchrittAbove;
window.deleteAbruf = deleteAbruf;
window.computeDringlichkeitAbruf = computeDringlichkeitAbruf;
window.getRahmenvertrag = getRahmenvertrag;
