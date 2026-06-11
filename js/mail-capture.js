// ═══════════════════════════════════════════════
// MAIL-CAPTURE (Quick-Capture only)
// 
// Verarbeitet manuell eingefügte Mail-Daten:
// - Smart-Parser: Erkennt Anlage/Kategorie/Prio/Frist
// - Duplikat-Erkennung: Findet ähnliche bestehende Vorgänge
// - Update-Modal: Anhängen an bestehenden Vorgang
// ═══════════════════════════════════════════════

// Globale State
let pendingMailData = null;
let updateTargetVorgang = null;

// ═══════════════════════════════════════════════
// QUICK-CAPTURE MODAL ÖFFNEN
// (Einstiegspunkt — wird durch Button "📧 Aus Mail" aufgerufen)
// ═══════════════════════════════════════════════
function openQuickCaptureModal() {
  document.getElementById('qcSubject').value = '';
  document.getElementById('qcFrom').value = '';
  document.getElementById('qcBody').value = '';
  document.getElementById('qcDate').value = today();
  
  document.getElementById('quickCaptureOverlay').classList.add('open');
  setTimeout(() => document.getElementById('qcSubject')?.focus(), 50);
}

function closeQuickCaptureModal() {
  document.getElementById('quickCaptureOverlay').classList.remove('open');
}

function closeQuickCaptureIfBg(e) {
  if (e.target === document.getElementById('quickCaptureOverlay')) closeQuickCaptureModal();
}

async function pasteFromClipboard() {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const text = await navigator.clipboard.readText();
      if (text) {
        const bodyField = document.getElementById('qcBody');
        bodyField.value = text;
        // Wenn Betreff leer ist: erste Zeile als Vorschlag
        const subjectField = document.getElementById('qcSubject');
        if (!subjectField.value) {
          const firstLine = text.split('\n')[0].trim();
          if (firstLine.length > 5 && firstLine.length < 200) {
            subjectField.value = firstLine;
          }
        }
        showCaptureToast('✓ Aus Zwischenablage eingefügt');
      } else {
        alert('Zwischenablage ist leer.');
      }
    } else {
      alert('Dein Browser unterstützt die Zwischenablage-API nicht.\nBitte den Text manuell mit Strg+V einfügen.');
    }
  } catch (e) {
    alert('Zugriff auf Zwischenablage verweigert.\nBitte den Text manuell mit Strg+V einfügen.\n\n(Browser-Einstellungen → Berechtigungen → Zwischenablage erlauben)');
  }
}

function processQuickCapture() {
  const subject = document.getElementById('qcSubject').value.trim();
  const from = document.getElementById('qcFrom').value.trim();
  const body = document.getElementById('qcBody').value.trim();
  const date = document.getElementById('qcDate').value || today();
  
  if (!subject || !body) {
    alert('Bitte mindestens Betreff und Mail-Text ausfüllen.');
    return;
  }
  
  // Absender intelligent parsen: "Max Mustermann <max@firma.de>"
  let fromEmail = '';
  let fromName = '';
  if (from) {
    const emailMatch = from.match(/<?([\w.\-+]+@[\w.-]+\.\w+)>?/);
    if (emailMatch) {
      fromEmail = emailMatch[1];
      fromName = from.replace(emailMatch[0], '').replace(/[<>]/g, '').trim();
    } else if (from.includes('@')) {
      fromEmail = from;
    } else {
      fromName = from;
    }
  }
  
  pendingMailData = {
    subject: subject,
    from: fromEmail,
    fromName: fromName,
    body: body,
    date: date
  };
  
  closeQuickCaptureModal();
  startMailCapture();
}

// ═══════════════════════════════════════════════
// HAUPT-FLOW
// ═══════════════════════════════════════════════
function startMailCapture() {
  if (!pendingMailData) return;
  
  // 1. Smart-Parser: Felder erkennen
  const parsed = parseMailContent(pendingMailData);
  
  // 2. Duplikat-Suche
  const matches = findSimilarVorgaenge(pendingMailData, parsed);
  
  // 3. Entscheidung: Update oder Neu?
  if (matches.length > 0) {
    showMailDuplicateDialog(matches, parsed);
  } else {
    openNewVorgangFromMail(parsed);
  }
}

// ═══════════════════════════════════════════════
// SMART-PARSER
// Erkennt Anlage, Kategorie, Priorität, Frist aus dem Text
// ═══════════════════════════════════════════════
function parseMailContent(mail) {
  const text = `${mail.subject} ${mail.body}`.toLowerCase();
  const result = {
    thema: cleanSubject(mail.subject),
    body: mail.body,
    from: mail.from,
    fromName: mail.fromName,
    date: mail.date,
    detectedAnlage: null,
    detectedLiegenschaft: null,
    detectedKategorie: null,
    detectedPrioritaet: null,
    detectedFrist: null,
    detectedVerantwortlich: null,
    nachweis: ''
  };
  
  // 1. Anlage erkennen (aus Stammdaten) + Liegenschaft ableiten
  if (window.stammdaten?.anlagen) {
    for (const anlage of window.stammdaten.anlagen) {
      const name = anlage.name.toLowerCase();
      const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'i');
      if (regex.test(text)) {
        result.detectedAnlage = anlage.name;
        // Liegenschaft aus Zuordnung ableiten
        if (typeof getLiegenschaftForAnlage === 'function') {
          const lg = getLiegenschaftForAnlage(anlage.name);
          if (lg) result.detectedLiegenschaft = lg.name;
        }
        break;
      }
    }
  }
  
  // 1b. Falls keine Anlage: Liegenschaft direkt im Text suchen
  if (!result.detectedLiegenschaft && window.stammdaten?.liegenschaften) {
    for (const lg of window.stammdaten.liegenschaften) {
      const name = lg.name.toLowerCase();
      const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'i');
      if (regex.test(text)) {
        result.detectedLiegenschaft = lg.name;
        break;
      }
    }
  }
  
  // 2. Kategorie erkennen
  const kategorieKeywords = {
    'Störung': ['störung', 'defekt', 'fehler', 'ausfall', 'kaputt', 'funktioniert nicht'],
    'Wartung': ['wartung', 'inspektion', 'prüfung', 'service'],
    'Mangel': ['mangel', 'mängel', 'beanstandung'],
    'Vergabe': ['angebot', 'vergabe', 'auftrag', 'ausschreibung', 'bestellung'],
    'Frist': ['frist', 'termin', 'deadline', 'bis spätestens'],
    'Dokumentation': ['protokoll', 'bericht', 'dokumentation', 'nachweis', 'zeugnis']
  };
  
  for (const [kat, keywords] of Object.entries(kategorieKeywords)) {
    if (keywords.some(kw => text.includes(kw))) {
      const exists = window.stammdaten?.kategorien?.find(k => k.name === kat);
      if (exists) {
        result.detectedKategorie = kat;
        break;
      }
    }
  }
  
  // 3. Priorität erkennen
  const prioASignals = ['dringend', 'eilt', 'kritisch', 'sofort', 'asap', 
                         'emergency', 'notfall', 'wichtig!', 'urgent'];
  const prioBSignals = ['zeitnah', 'bald', 'diese woche', 'baldmöglichst'];
  
  if (prioASignals.some(s => text.includes(s))) {
    result.detectedPrioritaet = 'A';
  } else if (prioBSignals.some(s => text.includes(s))) {
    result.detectedPrioritaet = 'B';
  } else {
    result.detectedPrioritaet = 'C';
  }
  
  // 4. Frist erkennen (Datumsmuster)
  result.detectedFrist = extractDate(text);
  
  // 5. Absender als Verantwortlich-Vorschlag
  if (mail.from && mail.from.includes('@')) {
    const externalMatch = window.stammdaten?.verantwortliche?.find(v => 
      v.name.toLowerCase().includes('firma')
    );
    if (externalMatch) {
      result.detectedVerantwortlich = externalMatch.name;
    }
  }
  
  // 6. Nachweis-Text aufbauen
  const datePart = mail.date ? fmt(mail.date) : today();
  const fromPart = mail.fromName || mail.from || 'Mail';
  result.nachweis = `Mail v. ${datePart}, ${fromPart}`;
  
  return result;
}

function cleanSubject(subject) {
  if (!subject) return '';
  return subject
    .replace(/^(re|aw|fw|wg|fwd|antw|tr):\s*/gi, '')
    .replace(/^(re|aw|fw|wg|fwd|antw|tr):\s*/gi, '')
    .trim();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractDate(text) {
  // Format: 15.06.2026 oder 15.06.26
  const m1 = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m1) {
    const day = m1[1].padStart(2, '0');
    const month = m1[2].padStart(2, '0');
    let year = m1[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }
  
  // "bis Freitag", "nächste Woche" usw.
  const weekdays = ['sonntag','montag','dienstag','mittwoch','donnerstag','freitag','samstag'];
  const today_ = new Date();
  
  for (let i = 0; i < weekdays.length; i++) {
    if (text.includes('bis ' + weekdays[i])) {
      const target = new Date(today_);
      const diff = (i - today_.getDay() + 7) % 7 || 7;
      target.setDate(target.getDate() + diff);
      return target.toISOString().slice(0, 10);
    }
  }
  
  if (text.includes('nächste woche')) {
    const target = new Date(today_);
    target.setDate(target.getDate() + 7);
    return target.toISOString().slice(0, 10);
  }
  
  if (text.includes('morgen')) {
    const target = new Date(today_);
    target.setDate(target.getDate() + 1);
    return target.toISOString().slice(0, 10);
  }
  
  return null;
}

// ═══════════════════════════════════════════════
// DUPLIKAT-ERKENNUNG
// Sucht ähnliche bestehende Vorgänge
// ═══════════════════════════════════════════════
function findSimilarVorgaenge(mail, parsed) {
  const matches = [];
  const cleanedSubject = cleanSubject(mail.subject).toLowerCase();
  
  for (const v of window.vorgaenge) {
    if (v.status === 'erledigt' || v.status === 'archiviert') continue;
    
    let score = 0;
    let reasons = [];
    
    // 1. Vorgangs-Nr im Betreff (V-2026-042)
    const vrNrMatch = mail.subject.match(/V-\d{4}-\d+/);
    if (vrNrMatch && vrNrMatch[0] === v.vorgangsNr) {
      score = 100;
      reasons.push(`Vorgangs-Nr ${v.vorgangsNr} im Betreff`);
      matches.push({ vorgang: v, score, reasons });
      continue;
    }
    
    // 2. Identischer Betreff (nach RE:-Cleanup)
    const vThemaClean = v.thema.toLowerCase();
    if (cleanedSubject === vThemaClean) {
      score = 90;
      reasons.push('Identischer Betreff');
    } else {
      // 3. Wort-Überlappung
      const subWords = new Set(cleanedSubject.split(/\s+/).filter(w => w.length > 3));
      const themaWords = new Set(vThemaClean.split(/\s+/).filter(w => w.length > 3));
      
      if (subWords.size > 0 && themaWords.size > 0) {
        const intersection = [...subWords].filter(w => themaWords.has(w));
        const overlap = intersection.length / Math.max(subWords.size, themaWords.size);
        
        if (overlap >= 0.6) {
          score = Math.round(overlap * 70);
          reasons.push(`${Math.round(overlap * 100)}% Wort-Überlappung`);
        }
      }
    }
    
    // 4. Gleiche Anlage (Bonus)
    if (parsed.detectedAnlage && v.anlage === parsed.detectedAnlage) {
      score += 15;
      reasons.push(`Gleiche Anlage: ${v.anlage}`);
    } else if (parsed.detectedLiegenschaft && v.liegenschaft === parsed.detectedLiegenschaft) {
      // Nur Liegenschaft gleich (schwächeres Signal)
      score += 8;
      reasons.push(`Gleiche Liegenschaft: ${v.liegenschaft}`);
    }
    
    // 5. Wartet-Status + Absender Match (Bonus)
    if ((v.status === 'wartet-firma' || v.status === 'wartet-intern') && 
        mail.from && v.nachweis && v.nachweis.toLowerCase().includes(mail.from.toLowerCase().split('@')[0])) {
      score += 20;
      reasons.push('Vorgang wartet auf Antwort dieses Absenders');
    }
    
    if (score >= 50) {
      matches.push({ vorgang: v, score: Math.min(100, score), reasons });
    }
  }
  
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 5);
}

// ═══════════════════════════════════════════════
// DIALOG: ÄHNLICHE VORGÄNGE GEFUNDEN
// ═══════════════════════════════════════════════
function showMailDuplicateDialog(matches, parsed) {
  const overlay = document.getElementById('mailDuplicateOverlay');
  const content = document.getElementById('mailDuplicateContent');
  
  if (!overlay || !content) {
    console.error('Mail-Duplicate Dialog HTML fehlt');
    openNewVorgangFromMail(parsed);
    return;
  }
  
  content.innerHTML = `
    <div class="mail-capture-mail-info">
      <div class="mail-capture-mail-label">📧 Eingegangene Mail:</div>
      <div class="mail-capture-mail-subject">${esc(pendingMailData.subject)}</div>
      ${pendingMailData.from ? `<div class="mail-capture-mail-from">Von: ${esc(pendingMailData.fromName || pendingMailData.from)}</div>` : ''}
    </div>
    
    <div class="mail-capture-section-title">${matches.length > 1 ? matches.length + ' ähnliche Vorgänge gefunden:' : 'Ähnlicher Vorgang gefunden:'}</div>
    
    <div class="mail-duplicate-list">
      ${matches.map(m => `
        <div class="mail-duplicate-item" onclick="selectVorgangForUpdate('${m.vorgang.id}')">
          <div class="mail-duplicate-score">${m.score}%</div>
          <div class="mail-duplicate-info">
            <div class="mail-duplicate-nr">${esc(m.vorgang.vorgangsNr)} · ${esc(m.vorgang.anlage)}</div>
            <div class="mail-duplicate-thema">${esc(m.vorgang.thema)}</div>
            <div class="mail-duplicate-meta">
              Status: <span class="v-status-badge v-status-${m.vorgang.status}">${V_STATUS.find(s => s.id === m.vorgang.status)?.label}</span>
              · Prio ${m.vorgang.prioritaet}
            </div>
            <div class="mail-duplicate-reasons">
              ${m.reasons.map(r => `<span class="mail-reason-chip">${esc(r)}</span>`).join('')}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="mail-duplicate-actions">
      <button class="btn" onclick="closeMailDuplicateDialog()">Abbrechen</button>
      <button class="btn" onclick="ignoreAndCreateNew()">Neuen Vorgang anlegen</button>
    </div>
  `;
  
  overlay.classList.add('open');
}

function closeMailDuplicateDialog() {
  document.getElementById('mailDuplicateOverlay').classList.remove('open');
  pendingMailData = null;
}

function ignoreAndCreateNew() {
  if (!pendingMailData) return;
  document.getElementById('mailDuplicateOverlay').classList.remove('open');
  const parsed = parseMailContent(pendingMailData);
  openNewVorgangFromMail(parsed);
}

function selectVorgangForUpdate(vorgangId) {
  if (!pendingMailData) return;
  document.getElementById('mailDuplicateOverlay').classList.remove('open');
  updateTargetVorgang = window.vorgaenge.find(v => v.id === vorgangId);
  if (!updateTargetVorgang) return;
  openUpdateVorgangModal();
}

// ═══════════════════════════════════════════════
// MODAL: VORGANG MIT MAIL-INFO AKTUALISIEREN
// ═══════════════════════════════════════════════
function openUpdateVorgangModal() {
  if (!updateTargetVorgang || !pendingMailData) return;
  
  const v = updateTargetVorgang;
  const mail = pendingMailData;
  
  const logTemplate = buildMailLogEntry(mail);
  
  document.getElementById('uvgTitle').textContent = `${v.vorgangsNr} — ${v.thema}`;
  document.getElementById('uvgStatusCurrent').textContent = 
    V_STATUS.find(s => s.id === v.status)?.label || v.status;
  document.getElementById('uvgLastActivity').textContent = v.letzteAktivitaet || '—';
  
  document.getElementById('uvgMailFrom').textContent = mail.fromName || mail.from || '—';
  document.getElementById('uvgMailDate').textContent = fmt(mail.date) || today();
  document.getElementById('uvgMailSubject').textContent = mail.subject;
  
  document.getElementById('uvgLogEntry').value = logTemplate;
  
  const statusSel = document.getElementById('uvgNewStatus');
  statusSel.innerHTML = '<option value="">— Status beibehalten —</option>' +
    V_STATUS.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
  
  const today_ = new Date();
  today_.setDate(today_.getDate() + 7);
  document.getElementById('uvgWiedervorlage').value = today_.toISOString().slice(0, 10);
  document.getElementById('uvgWiedervorlageCheckbox').checked = false;
  document.getElementById('uvgStatusCheckbox').checked = false;
  document.getElementById('uvgNachweisCheckbox').checked = true;
  document.getElementById('uvgBodyCheckbox').checked = false;
  
  document.getElementById('uvgNachweisPreview').textContent = 
    (v.nachweis ? v.nachweis + ' | ' : '') + `Mail v. ${fmt(mail.date)}, ${mail.fromName || mail.from}`;
  
  document.getElementById('updateVorgangOverlay').classList.add('open');
}

function buildMailLogEntry(mail) {
  const from = mail.fromName || mail.from || 'Mail';
  
  let bodySnippet = '';
  if (mail.body) {
    const cleaned = mail.body.replace(/\s+/g, ' ').trim();
    bodySnippet = cleaned.length > 200 ? cleaned.slice(0, 200) + '…' : cleaned;
  }
  
  return `Mail von ${from}: "${mail.subject}"${bodySnippet ? '\n→ ' + bodySnippet : ''}`;
}

function closeUpdateVorgangModal() {
  document.getElementById('updateVorgangOverlay').classList.remove('open');
  updateTargetVorgang = null;
  pendingMailData = null;
}

function closeUpdateVorgangIfBg(e) {
  if (e.target === document.getElementById('updateVorgangOverlay')) closeUpdateVorgangModal();
}

function saveUpdateVorgang() {
  if (!updateTargetVorgang || !pendingMailData) return;
  
  const v = updateTargetVorgang;
  const mail = pendingMailData;
  const t = today();
  
  // Log-Eintrag hinzufügen
  const logText = document.getElementById('uvgLogEntry').value.trim();
  if (logText) {
    v.log = `${t}: ${logText}\n` + (v.log || '');
  }
  
  // Body komplett anhängen?
  if (document.getElementById('uvgBodyCheckbox').checked && mail.body) {
    const fullBody = mail.body.replace(/\s+/g, ' ').trim();
    v.log = `${t}: [Mail-Inhalt komplett]\n${fullBody}\n` + (v.log || '');
  }
  
  // Status ändern?
  if (document.getElementById('uvgStatusCheckbox').checked) {
    const newStatus = document.getElementById('uvgNewStatus').value;
    if (newStatus && newStatus !== v.status) {
      const oldLabel = V_STATUS.find(s => s.id === v.status)?.label || v.status;
      const newLabel = V_STATUS.find(s => s.id === newStatus)?.label || newStatus;
      v.log = `${t}: Status: ${oldLabel} → ${newLabel}\n` + (v.log || '');
      v.status = newStatus;
    }
  }
  
  // Wiedervorlage ändern?
  if (document.getElementById('uvgWiedervorlageCheckbox').checked) {
    const newWV = document.getElementById('uvgWiedervorlage').value;
    if (newWV) {
      v.wiedervorlage = newWV;
      v.log = `${t}: Wiedervorlage: ${fmt(newWV)}\n` + (v.log || '');
    }
  }
  
  // Nachweis ergänzen?
  if (document.getElementById('uvgNachweisCheckbox').checked) {
    const mailRef = `Mail v. ${fmt(mail.date)}, ${mail.fromName || mail.from}`;
    v.nachweis = v.nachweis ? v.nachweis + ' | ' + mailRef : mailRef;
  }
  
  // Mail in verknüpfte Mails speichern
  if (!v.mails) v.mails = [];
  v.mails.unshift({
    date: mail.date,
    from: mail.from,
    fromName: mail.fromName,
    subject: mail.subject,
    bodySnippet: mail.body ? mail.body.slice(0, 500) : ''
  });
  
  v.letzteAktivitaet = t;
  
  saveDataVorgaenge();
  closeUpdateVorgangModal();
  renderVorgaengeTab();
  
  showCaptureToast(`✓ Mail an ${v.vorgangsNr} angehängt`);
}

// ═══════════════════════════════════════════════
// MODAL: NEUER VORGANG AUS MAIL
// ═══════════════════════════════════════════════
function openNewVorgangFromMail(parsed) {
  openNewVorgangModal();
  
  setTimeout(() => {
    document.getElementById('vThema').value = parsed.thema;
    
    if (parsed.detectedLiegenschaft) {
      document.getElementById('vLiegenschaft').value = parsed.detectedLiegenschaft;
      // Kaskade: Anlagen-Dropdown auf diese Liegenschaft filtern
      if (typeof updateAnlagenDropdown === 'function') updateAnlagenDropdown();
    }
    if (parsed.detectedAnlage) {
      document.getElementById('vAnlage').value = parsed.detectedAnlage;
    }
    if (parsed.detectedKategorie) {
      document.getElementById('vKategorie').value = parsed.detectedKategorie;
    }
    if (parsed.detectedPrioritaet) {
      document.getElementById('vPrioritaet').value = parsed.detectedPrioritaet;
    }
    if (parsed.detectedVerantwortlich) {
      document.getElementById('vVerantwortlich').value = parsed.detectedVerantwortlich;
    }
    if (parsed.detectedFrist) {
      document.getElementById('vFrist').value = parsed.detectedFrist;
    }
    if (parsed.nachweis) {
      document.getElementById('vNachweis').value = parsed.nachweis;
    }
    
    if (parsed.body) {
      const bodyShort = parsed.body.replace(/\s+/g, ' ').trim().slice(0, 200);
      document.getElementById('vNaechsterSchritt').value = 
        `[Aus Mail]: ${bodyShort}${bodyShort.length >= 200 ? '…' : ''}`;
    }
    
    window._mailCaptureData = pendingMailData;
    pendingMailData = null;
  }, 100);
}

// Hook: Nach saveNewVorgang die Mail verknüpfen
function attachMailToNewVorgang(newVorgang) {
  if (!window._mailCaptureData) return;
  const mail = window._mailCaptureData;
  if (!newVorgang.mails) newVorgang.mails = [];
  newVorgang.mails.unshift({
    date: mail.date,
    from: mail.from,
    fromName: mail.fromName,
    subject: mail.subject,
    bodySnippet: mail.body ? mail.body.slice(0, 500) : ''
  });
  newVorgang.log = `${today()}: Aus Mail erstellt: "${mail.subject}"\n` + (newVorgang.log || '');
  window._mailCaptureData = null;
}

// ═══════════════════════════════════════════════
// TOAST-MELDUNG
// ═══════════════════════════════════════════════
function showCaptureToast(msg) {
  let toast = document.getElementById('captureToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'captureToast';
    toast.className = 'capture-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ═══════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════
window.openQuickCaptureModal = openQuickCaptureModal;
window.closeQuickCaptureModal = closeQuickCaptureModal;
window.closeQuickCaptureIfBg = closeQuickCaptureIfBg;
window.pasteFromClipboard = pasteFromClipboard;
window.processQuickCapture = processQuickCapture;
window.closeMailDuplicateDialog = closeMailDuplicateDialog;
window.ignoreAndCreateNew = ignoreAndCreateNew;
window.selectVorgangForUpdate = selectVorgangForUpdate;
window.closeUpdateVorgangModal = closeUpdateVorgangModal;
window.closeUpdateVorgangIfBg = closeUpdateVorgangIfBg;
window.saveUpdateVorgang = saveUpdateVorgang;
window.showCaptureToast = showCaptureToast;
window.attachMailToNewVorgang = attachMailToNewVorgang;
