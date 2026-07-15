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
  ],
  rahmenvertraege: [],
  // Aus "Titel-Objektkontenübersicht_122018.xlsx" importiert (Kapitel 0212/0213/0214/0216),
  // inkl. Erläuterungen/Titelverwalter-Hinweise aus der Quellspalte.
  haushaltstitel: [
    { id: '0212-51701-02749709', titel: '517 01', objektnummer: '0274 9709', bezeichnung: 'Bestandsbauten', erlaeuterung: 'Kauf von Öl und Gas für Beheizung und Energieerzeugung, Fernwärmelieferung\nKeine Wartung', kapitel: '0212', sort: 1 },
    { id: '0212-51701-02749717', titel: '517 01', objektnummer: '0274 9717', bezeichnung: 'Neubauten, Reichstag', erlaeuterung: 'Kauf von Öl und Gas für Beheizung und Energieerzeugung, Fernwärmelieferung\nKeine Wartung', kapitel: '0212', sort: 2 },
    { id: '0212-51701-02749725', titel: '517 01', objektnummer: '0274 9725', bezeichnung: 'Übriges', erlaeuterung: 'Kauf von Öl und Gas für Beheizung und Energieerzeugung, Fernwärmelieferung\nKeine Wartung', kapitel: '0212', sort: 3 },
    { id: '0212-51701-02750776', titel: '517 01', objektnummer: '0275 0776', bezeichnung: 'Elektrizität – Bestandsbauten', erlaeuterung: 'ohne Beheizung und sonstigen Energiebedarf', kapitel: '0212', sort: 4 },
    { id: '0212-51701-02750784', titel: '517 01', objektnummer: '0275 0784', bezeichnung: 'Elektrizität – Neubauten, Reichstag', erlaeuterung: 'ohne Beheizung und sonstigen Energiebedarf', kapitel: '0212', sort: 5 },
    { id: '0212-51701-02750792', titel: '517 01', objektnummer: '0275 0792', bezeichnung: 'Elektrizität – Übriges', erlaeuterung: 'ohne Beheizung und sonstigen Energiebedarf', kapitel: '0212', sort: 6 },
    { id: '0212-51701-02750807', titel: '517 01', objektnummer: '0275 0807', bezeichnung: 'Reinigung/ Wasser/ Abfall – Bestandsbauten', erlaeuterung: 'nur technische Anlagen und Einrichtungen, Be- und Entwässerung, Wasserkosten, Abfallentsorgung (z. B. Altöl, Kanister)\nKeine Gebäudereinigung\nAusnahme:  Reinigung von Sonnenschutzanlagen', kapitel: '0212', sort: 7 },
    { id: '0212-51701-02750815', titel: '517 01', objektnummer: '0275 0815', bezeichnung: 'Reinigung/ Wasser/ Abfall – Neubauten, Reichstag', erlaeuterung: 'nur technische Anlagen und Einrichtungen, Be- und Entwässerung, Wasserkosten, Abfallentsorgung (z. B. Altöl, Kanister)\nKeine Gebäudereinigung\nAusnahme:  Reinigung von Sonnenschutzanlagen', kapitel: '0212', sort: 8 },
    { id: '0212-51701-02750823', titel: '517 01', objektnummer: '0275 0823', bezeichnung: 'Reinigung/ Wasser/ Abfall – Übriges', erlaeuterung: 'nur technische Anlagen und Einrichtungen, Be- und Entwässerung, Wasserkosten, Abfallentsorgung (z. B. Altöl, Kanister)\nKeine Gebäudereinigung\nAusnahme:  Reinigung von Sonnenschutzanlagen', kapitel: '0212', sort: 9 },
    { id: '0212-51701-02750831', titel: '517 01', objektnummer: '0275 0831', bezeichnung: 'Sonstiges – Bestandsbauten', erlaeuterung: 'Zuarbeit für Jahresbericht, Schornsteinfegergebühren, Brandschutzmaßnahmen, DGUV-Prüfungen, Sachverständigenprüfungen und Beihilfe zur Prüfung, Auskleiden von Aufzügen, IT-Technik für TGA', kapitel: '0212', sort: 10 },
    { id: '0212-51701-02750849', titel: '517 01', objektnummer: '0275 0849', bezeichnung: 'Sonstiges – Neubauten, Reichstag', erlaeuterung: 'Zuarbeit für Jahresbericht, Schornsteinfegergebühren, Brandschutzmaßnahmen, DGUV-Prüfungen, Sachverständigenprüfungen und Beihilfe zur Prüfung, Auskleiden von Aufzügen, IT-Technik für TGA', kapitel: '0212', sort: 11 },
    { id: '0212-51701-02750856', titel: '517 01', objektnummer: '0275 0856', bezeichnung: 'Sonstiges – Übriges', erlaeuterung: 'Zuarbeit für Jahresbericht, Schornsteinfegergebühren, Brandschutzmaßnahmen, DGUV-Prüfungen, Sachverständigenprüfungen und Beihilfe zur Prüfung, Auskleiden von Aufzügen, IT-Technik für TGA', kapitel: '0212', sort: 12 },
    { id: '0212-51701-02750864', titel: '517 01', objektnummer: '0275 0864', bezeichnung: 'Wartungen/ Betriebsunerstützung – Wartungen – Bestandsbauten', erlaeuterung: 'Aufzüge, Heizungsanlagen, Feuerlöschgeräte usw.', kapitel: '0212', sort: 13 },
    { id: '0212-51701-02750872', titel: '517 01', objektnummer: '0275 0872', bezeichnung: 'Wartungen/ Betriebsunerstützung – Wartungen – Reichstag', erlaeuterung: 'Aufzüge, Heizungsanlagen, Feuerlöschgeräte usw.', kapitel: '0212', sort: 14 },
    { id: '0212-51701-02750880', titel: '517 01', objektnummer: '0275 0880', bezeichnung: 'Wartungen/ Betriebsunerstützung – Wartungen – Neubauten', erlaeuterung: 'Aufzüge, Heizungsanlagen, Feuerlöschgeräte usw.', kapitel: '0212', sort: 15 },
    { id: '0212-51701-03030297', titel: '517 01', objektnummer: '0303 0297', bezeichnung: 'Wartungen/ Betriebsunerstützung – Wartungen – JKH', erlaeuterung: 'Aufzüge, Heizungsanlagen, Feuerlöschgeräte usw.', kapitel: '0212', sort: 16 },
    { id: '0212-51701-03030289', titel: '517 01', objektnummer: '0303 0289', bezeichnung: 'Wartungen/ Betriebsunerstützung – Wartungen – PLH', erlaeuterung: 'Aufzüge, Heizungsanlagen, Feuerlöschgeräte usw.', kapitel: '0212', sort: 17 },
    { id: '0212-51701-03030271', titel: '517 01', objektnummer: '0303 0271', bezeichnung: 'Wartungen/ Betriebsunerstützung – Wartungen – MELH', erlaeuterung: 'Aufzüge, Heizungsanlagen, Feuerlöschgeräte usw.', kapitel: '0212', sort: 18 },
    { id: '0212-51701-02750903', titel: '517 01', objektnummer: '0275 0903', bezeichnung: 'Wartungen/ Betriebsunerstützung – Betriebsunterstützung – Reichstag', erlaeuterung: 'Rufbereitschaft, Aufzugswärterbereitstellung, Höhenzugangstechnik', kapitel: '0212', sort: 19 },
    { id: '0212-51701-02750911', titel: '517 01', objektnummer: '0275 0911', bezeichnung: 'Wartungen/ Betriebsunerstützung – Betriebsunterstützung – Neubauten', erlaeuterung: 'Rufbereitschaft, Aufzugswärterbereitstellung, Höhenzugangstechnik', kapitel: '0212', sort: 20 },
    { id: '0212-51701-02750937', titel: '517 01', objektnummer: '0275 0937', bezeichnung: 'Wartungen/ Betriebsunerstützung – Betriebsunterstützung – Bestandsbauten', erlaeuterung: 'Rufbereitschaft, Aufzugswärterbereitstellung, Höhenzugangstechnik', kapitel: '0212', sort: 21 },
    { id: '0212-51791-x22', titel: '517 91', objektnummer: null, bezeichnung: 'Kindertagesstätte', erlaeuterung: 'Bewirtschaftung von Grundstück, Gebäude und Räumen', kapitel: '0212', sort: 22 },
    { id: '0212-51991-x23', titel: '519 91', objektnummer: null, bezeichnung: 'Kindertagesstätte', erlaeuterung: 'Unterhaltung von Grundstück und baulichen Anlagen', kapitel: '0212', sort: 23 },
    { id: '0212-71101-x24', titel: '711 01', objektnummer: null, bezeichnung: 'Kleine Um-, Neu- und Erweiterungsbauten', erlaeuterung: 'bis 2.000.000 Euro brutto gemäß Haushaltsanmeldung', kapitel: '0212', sort: 24 },
    { id: '0212-51901-02749741', titel: '519 01', objektnummer: '0274 9741', bezeichnung: 'Bauunterhalt – Bestandsbauten', erlaeuterung: 'Regulärer Bauunterhaltungsbedarf', kapitel: '0212', sort: 25 },
    { id: '0212-51901-02749758', titel: '519 01', objektnummer: '0274 9758', bezeichnung: 'Bauunterhalt – Reichstag', erlaeuterung: 'Regulärer Bauunterhaltungsbedarf', kapitel: '0212', sort: 26 },
    { id: '0212-51901-02749766', titel: '519 01', objektnummer: '0274 9766', bezeichnung: 'Bauunterhalt – Neubauten', erlaeuterung: 'Regulärer Bauunterhaltungsbedarf', kapitel: '0212', sort: 27 },
    { id: '0212-51901-03026389', titel: '519 01', objektnummer: '0302 6389', bezeichnung: 'Bauunterhalt – JKH', erlaeuterung: 'Regulärer Bauunterhaltungsbedarf', kapitel: '0212', sort: 28 },
    { id: '0212-51901-03026397', titel: '519 01', objektnummer: '0302 6397', bezeichnung: 'Bauunterhalt – PLH', erlaeuterung: 'Regulärer Bauunterhaltungsbedarf', kapitel: '0212', sort: 29 },
    { id: '0212-51901-03026402', titel: '519 01', objektnummer: '0302 6402', bezeichnung: 'Bauunterhalt – MELH', erlaeuterung: 'Regulärer Bauunterhaltungsbedarf', kapitel: '0212', sort: 30 },
    { id: '0212-51901-02882779', titel: '519 01', objektnummer: '0288 2779', bezeichnung: 'Mittelmehrbedarf – Bestandsbauten', erlaeuterung: 'Mittelmehrbedarf für Bauunterhaltung gemäß Haushaltsanmeldung', kapitel: '0212', sort: 31 },
    { id: '0212-51901-02882787', titel: '519 01', objektnummer: '0288 2787', bezeichnung: 'Mittelmehrbedarf – Reichstag', erlaeuterung: 'Mittelmehrbedarf für Bauunterhaltung gemäß Haushaltsanmeldung', kapitel: '0212', sort: 32 },
    { id: '0212-51901-02882795', titel: '519 01', objektnummer: '0288 2795', bezeichnung: 'Mittelmehrbedarf – Neubauten', erlaeuterung: 'Mittelmehrbedarf für Bauunterhaltung gemäß Haushaltsanmeldung', kapitel: '0212', sort: 33 },
    { id: '0212-51901-03026410', titel: '519 01', objektnummer: '0302 6410', bezeichnung: 'Mittelmehrbedarf – JKH', erlaeuterung: 'Mittelmehrbedarf für Bauunterhaltung gemäß Haushaltsanmeldung', kapitel: '0212', sort: 34 },
    { id: '0212-51901-03026428', titel: '519 01', objektnummer: '0302 6428', bezeichnung: 'Mittelmehrbedarf – PLH', erlaeuterung: 'Mittelmehrbedarf für Bauunterhaltung gemäß Haushaltsanmeldung', kapitel: '0212', sort: 35 },
    { id: '0212-51901-03026436', titel: '519 01', objektnummer: '0302 6436', bezeichnung: 'Mittelmehrbedarf – MELH', erlaeuterung: 'Mittelmehrbedarf für Bauunterhaltung gemäß Haushaltsanmeldung', kapitel: '0212', sort: 36 },
    { id: '0212-51101-x37', titel: '511 01', objektnummer: null, bezeichnung: 'Materialbeschaffung über technisches Lager', erlaeuterung: 'Titelverwalter BL 5', kapitel: '0212', sort: 37 },
    { id: '0212-51701-x38', titel: '517 01', objektnummer: null, bezeichnung: 'Materialbeschaffung über technisches Lager', erlaeuterung: 'Titelverwalter BL 5', kapitel: '0212', sort: 38 },
    { id: '0212-51901-x39', titel: '519 01', objektnummer: null, bezeichnung: 'Materialbeschaffung über technisches Lager', erlaeuterung: 'Titelverwalter BL 3', kapitel: '0212', sort: 39 },
    { id: '0212-51801-x40', titel: '518 01', objektnummer: null, bezeichnung: 'Anmietung von Maschinen und Geräten', erlaeuterung: 'Titelverwalter BL 1', kapitel: '0212', sort: 40 },
    { id: '0212-52602-x41', titel: '526 02', objektnummer: null, bezeichnung: 'Sachverständigenkosten', erlaeuterung: 'Titelverwalter ZR 1', kapitel: '0212', sort: 41 },
    { id: '0213-51701-01434243', titel: '517 01', objektnummer: '0143 4243', bezeichnung: 'Beheizung', erlaeuterung: 'Fernwärmelieferung\nKeine Wartung', kapitel: '0213 (Wehrbeauftragter)', sort: 42 },
    { id: '0213-51701-01434250', titel: '517 01', objektnummer: '0143 4250', bezeichnung: 'Elektrizität', erlaeuterung: 'Ohne Beheizung und sonstigen Energiebedarf', kapitel: '0213 (Wehrbeauftragter)', sort: 43 },
    { id: '0213-51701-01434268', titel: '517 01', objektnummer: '0143 4268', bezeichnung: 'Reinigung/ Wasser/ Abfall', erlaeuterung: 'nur technische Anlagen und Einrichtungen, Be- und Entwässerung, Wasserkosten, Abfallentsorgung (z. B. Altöl, Kanister)\nKeine Gebäudereinigung\nAusnahme: Reinigung von Sonnenschutzanlagen', kapitel: '0213 (Wehrbeauftragter)', sort: 44 },
    { id: '0213-51701-01434276', titel: '517 01', objektnummer: '0143 4276', bezeichnung: 'Sonstiges', erlaeuterung: 'Brandschutzmaßnahmen, DGUV-Prüfungen, Sachverständigenprüfungen und Beihhilfe zur Prüfung, Auskleiden von Aufzügen, IT-Technik für TGA', kapitel: '0213 (Wehrbeauftragter)', sort: 45 },
    { id: '0213-51701-01434284', titel: '517 01', objektnummer: '0143 4284', bezeichnung: 'Wartungen/Betriebsunterstützung', erlaeuterung: 'Aufzüge, Heizungsanlagen, Feuerlöschgeräte, u.s.w.\nRufbereitschaft', kapitel: '0213 (Wehrbeauftragter)', sort: 46 },
    { id: '0213-51901-x47', titel: '519 01', objektnummer: null, bezeichnung: 'Regulärer Bauunterhaltungsbedarf, Mittelmehrbedarf für Bauunterhaltung gemäß Haushaltsanmeldung', erlaeuterung: null, kapitel: '0213 (Wehrbeauftragter)', sort: 47 },
    { id: '0214-51701-x48', titel: '517 01', objektnummer: null, bezeichnung: 'Bundesversammlung', erlaeuterung: 'Titelverwalter BL 2', kapitel: '0214 (Bundesversammlung)', sort: 48 },
    { id: '0214-51901-x49', titel: '519 01', objektnummer: null, bezeichnung: 'Bundesversammlung', erlaeuterung: 'Titelverwalter BL 2', kapitel: '0214 (Bundesversammlung)', sort: 49 },
    { id: '0216-51701-x50', titel: '517 01', objektnummer: null, bezeichnung: 'Bewirtschaftung der Grundstücke, Gebäude und Räume', erlaeuterung: null, kapitel: '0216 (Parlamentarisches Kontrollgremium)', sort: 50 },
    { id: '0216-71101-x51', titel: '711 01', objektnummer: null, bezeichnung: 'Kleine Um-, Neu- und Erweiterungsbauten', erlaeuterung: 'bis 2.000.000 Euro brutto gemäß Haushaltsanmeldung', kapitel: '0216 (Parlamentarisches Kontrollgremium)', sort: 51 }
  ]
};

// ─── Global State ───
window.stammdaten = {
  liegenschaften: [],
  anlagen: [],
  kategorien: [],
  verantwortliche: [],
  rahmenvertraege: [],
  haushaltstitel: []
};

// ═══════════════════════════════════════════════
// FIRESTORE: STAMMDATEN
// ═══════════════════════════════════════════════
async function loadStammdatenFromFirestore() {
  setSyncStatus('syncing');
  try {
    const { getDocs } = window._fbFns;
    const { collection } = await import('https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js');

    const types = ['liegenschaften', 'anlagen', 'kategorien', 'verantwortliche', 'rahmenvertraege', 'haushaltstitel'];
    const localBackup = loadLocalStammdaten();
    let anyLoaded = false;

    for (const type of types) {
      const snap = await getDocs(collection(window._db_vorgaenge, `stammdaten_${type}`));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (items.length > 0) {
        window.stammdaten[type] = items.sort((a, b) => (a.sort ?? 99) - (b.sort ?? 99));
        anyLoaded = true;
      } else {
        // WICHTIG: Firestore ist für diesen Typ leer — das kann bedeuten,
        // dass wirklich noch nichts angelegt wurde, ODER dass frühere
        // Speicherversuche (z.B. wegen eines Auth-Fehlers) nie ankamen.
        // Lokale, von den Defaults abweichende Daten NIEMALS blind
        // überschreiben — stattdessen als Quelle nehmen und nach
        // Firestore nachziehen.
        const localItems = localBackup[type];
        const localIstAbweichend = Array.isArray(localItems) && localItems.length > 0 &&
          JSON.stringify(localItems) !== JSON.stringify(DEFAULT_STAMMDATEN[type]);

        if (localIstAbweichend) {
          window.stammdaten[type] = localItems;
          localItems.forEach(item => saveStammdatumToFirestore(type, item));
          console.warn(`Stammdaten (${type}): lokale Daten gefunden, die noch nicht in Firestore lagen — werden jetzt hochgeladen.`);
        } else {
          window.stammdaten[type] = JSON.parse(JSON.stringify(DEFAULT_STAMMDATEN[type]));
        }
      }
    }

    // Migration: Anlagen ohne liegenschaftId der ersten Liegenschaft zuordnen
    migrateAnlagenLiegenschaft();

    saveLocalStammdaten();
    refreshDropdowns();
    setSyncStatus('synced');

    if (!anyLoaded) {
      console.log('Keine Stammdaten in Firestore gefunden (oder gerade nachgezogen) — Defaults als letzter Fallback.');
    }
  } catch (e) {
    console.error('Stammdaten laden fehlgeschlagen:', e);
    window.stammdaten = loadLocalStammdaten();
    migrateAnlagenLiegenschaft();
    refreshDropdowns();
    setSyncStatus('error');
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
  if (!window._currentUser) {
    setSyncStatus('offline');
    return;
  }
  setSyncStatus('syncing');
  try {
    const { setDoc, doc } = window._fbFns;
    await setDoc(doc(window._db_vorgaenge, `stammdaten_${type}`, item.id), item);
    setSyncStatus('synced');
  } catch (e) {
    console.error(`Stammdatum (${type}) speichern fehlgeschlagen:`, e);
    setSyncStatus('error');
  }
}

async function deleteStammdatumFromFirestore(type, id) {
  if (!window._currentUser) {
    setSyncStatus('offline');
    return;
  }
  setSyncStatus('syncing');
  try {
    const { deleteDoc, doc } = window._fbFns;
    await deleteDoc(doc(window._db_vorgaenge, `stammdaten_${type}`, id));
    setSyncStatus('synced');
  } catch (e) {
    console.error(`Stammdatum (${type}) löschen fehlgeschlagen:`, e);
    setSyncStatus('error');
  }
}

function saveLocalStammdaten() {
  localStorage.setItem('betrieb_stammdaten', JSON.stringify(window.stammdaten));
}

function loadLocalStammdaten() {
  try {
    const stored = JSON.parse(localStorage.getItem('betrieb_stammdaten'));
    if (stored && stored.anlagen) {
      // Migrationsfähig: liegenschaften/rahmenvertraege/haushaltstitel ggf. ergänzen
      if (!stored.liegenschaften) stored.liegenschaften = JSON.parse(JSON.stringify(DEFAULT_STAMMDATEN.liegenschaften));
      if (!stored.rahmenvertraege) stored.rahmenvertraege = [];
      if (!stored.haushaltstitel) stored.haushaltstitel = JSON.parse(JSON.stringify(DEFAULT_STAMMDATEN.haushaltstitel));
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
  renderRahmenvertraegeSection();
  renderHaushaltstitelSection();
  renderStammdatenSection('kategorien', 'kategorienList', false);
  renderStammdatenSection('verantwortliche', 'verantwortlicheList', false);
}

// Haushaltstitel: gruppiert nach Kapitel (analog Anlagen nach Liegenschaft)
function renderHaushaltstitelSection() {
  const container = document.getElementById('haushaltstitelList');
  if (!container) return;

  const items = window.stammdaten.haushaltstitel || [];
  updateStammdatenCount('haushaltstitelList', items.length);

  if (!items.length) {
    container.innerHTML = '<div class="stammdaten-empty">Noch keine Haushaltstitel.</div>';
    return;
  }

  const kapitel = [...new Set(items.map(i => i.kapitel || '—'))];
  let html = '';

  for (const kap of kapitel) {
    const kapItems = items.filter(i => (i.kapitel || '—') === kap);
    html += `<div class="anlagen-group-header">📑 Kapitel ${esc(kap)}</div>`;
    html += kapItems.map(item => {
      const abrufeCount = (window.abrufe || []).filter(a => a.haushaltstitelId === item.id).length;
      const titelLabel = item.objektnummer
        ? `${esc(item.titel)} · ${esc(item.objektnummer)}`
        : esc(item.titel);
      return `
      <div class="stammdaten-row">
        <div class="stammdaten-row-content">
          <div class="stammdaten-name">${titelLabel}
            <span style="color:var(--text3);font-size:10px;font-family:var(--mono)">(${abrufeCount})</span>
          </div>
          <div class="stammdaten-description">${esc(item.bezeichnung)}</div>
          ${item.erlaeuterung ? `<div class="stammdaten-description" style="color:var(--text3);white-space:pre-line">${esc(item.erlaeuterung)}</div>` : ''}
        </div>
        <div class="stammdaten-row-actions">
          <button class="btn-icon" onclick="openStammdatumModal('haushaltstitel', '${item.id}')" title="Bearbeiten">✎</button>
          <button class="btn-icon btn-icon-danger" onclick="confirmDeleteStammdatum('haushaltstitel', '${item.id}')" title="Löschen">✕</button>
        </div>
      </div>
    `;
    }).join('');
  }

  container.innerHTML = html;
}

// Rahmenverträge: eigene Darstellung (Vertragsnehmer, RV-Nr, Laufzeit)
function renderRahmenvertraegeSection() {
  const container = document.getElementById('rahmenvertraegeList');
  if (!container) return;

  const items = window.stammdaten.rahmenvertraege || [];
  updateStammdatenCount('rahmenvertraegeList', items.length);

  if (!items.length) {
    container.innerHTML = '<div class="stammdaten-empty">Noch keine Rahmenverträge.</div>';
    return;
  }

  container.innerHTML = items.map(item => {
    const abrufeCount = (window.abrufe || []).filter(a => a.rahmenvertragId === item.id).length;
    const laufzeit = item.laufzeitBis
      ? `Laufzeit bis ${fmt(item.laufzeitBis)}`
      : 'Laufzeit offen';
    const vergabestelle = item.rvNummerVergabestelle || item.rvNummer || '—';
    const nummernZeile = item.rvNummerEAkte
      ? `VN ${esc(vergabestelle)} · E-Akte ${esc(item.rvNummerEAkte)}`
      : `VN ${esc(vergabestelle)}`;
    return `
    <div class="stammdaten-row">
      <div class="stammdaten-row-content">
        <div class="stammdaten-name">${esc(item.vertragsnehmer)} — ${nummernZeile}
          <span style="color:var(--text3);font-size:10px;font-family:var(--mono)">(${abrufeCount} Abrufe)</span>
        </div>
        <div class="stammdaten-description">${esc(laufzeit)}</div>
      </div>
      <div class="stammdaten-row-actions">
        <button class="btn-icon" onclick="openStammdatumModal('rahmenvertraege', '${item.id}')" title="Bearbeiten">✎</button>
        <button class="btn-icon btn-icon-danger" onclick="confirmDeleteStammdatum('rahmenvertraege', '${item.id}')" title="Löschen">✕</button>
      </div>
    </div>
  `;}).join('');
}

// Liegenschaften: einfache Liste
// ═══════════════════════════════════════════════
// EIN-/AUSKLAPPEN DER STAMMDATEN-SEKTIONEN
// ═══════════════════════════════════════════════
function toggleStammdatenSection(headerEl) {
  const section = headerEl.closest('.stammdaten-section');
  if (section) section.classList.toggle('collapsed');
}

// Zähler im (ggf. eingeklappten) Sektionskopf aktualisieren —
// Konvention: Container-ID "xyzList" -> Zähler-Element "xyzCount"
function updateStammdatenCount(containerId, n) {
  const el = document.getElementById(containerId.replace('List', 'Count'));
  if (el) el.textContent = n;
}

function renderLiegenschaftenSection() {
  const container = document.getElementById('liegenschaftenList');
  if (!container) return;
  
  const items = window.stammdaten.liegenschaften || [];
  updateStammdatenCount('liegenschaftenList', items.length);
  
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
  updateStammdatenCount('anlagenList', anlagen.length);
  
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
  updateStammdatenCount(containerId, items.length);
  
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
    verantwortliche: 'Verantwortliche/r',
    rahmenvertraege: 'Rahmenvertrag',
    haushaltstitel: 'Haushaltstitel'
  };
  
  document.getElementById('stammdatumModalTitle').textContent = 
    isNew ? `Neue${['rahmenvertraege','haushaltstitel'].includes(type) ? 'r' : ''} ${labels[type]}` : `${labels[type]} bearbeiten`;
  
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

  // Rahmenvertrag: eigenes Feld-Set statt "Name" (Vertragsnehmer + RV-Nr + Laufzeit)
  const isRv = type === 'rahmenvertraege';
  document.getElementById('sNameField').style.display = (isRv || type === 'haushaltstitel') ? 'none' : 'block';
  document.getElementById('sVertragsnehmerField').style.display = isRv ? 'block' : 'none';
  document.getElementById('sRvNummerVergabestelleField').style.display = isRv ? 'block' : 'none';
  document.getElementById('sRvNummerEAkteField').style.display = isRv ? 'block' : 'none';
  document.getElementById('sLaufzeitField').style.display = isRv ? 'grid' : 'none';
  document.getElementById('sVertragsnehmer').value = item?.vertragsnehmer || '';
  // Legacy-Fallback: ältere Einträge hatten nur ein einzelnes rvNummer-Feld
  document.getElementById('sRvNummerVergabestelle').value = item?.rvNummerVergabestelle || item?.rvNummer || '';
  document.getElementById('sRvNummerEAkte').value = item?.rvNummerEAkte || '';
  document.getElementById('sLaufzeitVon').value = item?.laufzeitVon || '';
  document.getElementById('sLaufzeitBis').value = item?.laufzeitBis || '';

  // Haushaltstitel: Titel/Objektnummer/Bezeichnung/Kapitel statt "Name"
  const isHt = type === 'haushaltstitel';
  document.getElementById('sTitelField').style.display = isHt ? 'block' : 'none';
  document.getElementById('sObjektnummerField').style.display = isHt ? 'block' : 'none';
  document.getElementById('sBezeichnungField').style.display = isHt ? 'block' : 'none';
  document.getElementById('sKapitelField').style.display = isHt ? 'block' : 'none';
  document.getElementById('sErlaeuterungField').style.display = isHt ? 'block' : 'none';
  document.getElementById('sTitel').value = item?.titel || '';
  document.getElementById('sObjektnummer').value = item?.objektnummer || '';
  document.getElementById('sBezeichnung').value = item?.bezeichnung || '';
  document.getElementById('sKapitel').value = item?.kapitel || '';
  document.getElementById('sErlaeuterung').value = item?.erlaeuterung || '';
  
  document.getElementById('stammdatumModalOverlay').classList.add('open');
  setTimeout(() => document.getElementById(isRv ? 'sVertragsnehmer' : isHt ? 'sTitel' : 'sName')?.focus(), 50);
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
  const isRv = type === 'rahmenvertraege';
  const isHt = type === 'haushaltstitel';

  const description = document.getElementById('sDescription').value.trim();
  const liegenschaftId = type === 'anlagen' 
    ? document.getElementById('sLiegenschaft').value 
    : null;

  // Rahmenvertrag: eigene Validierung + abgeleiteter Anzeigename
  const vertragsnehmer = isRv ? document.getElementById('sVertragsnehmer').value.trim() : null;
  const rvNummerVergabestelle = isRv ? document.getElementById('sRvNummerVergabestelle').value.trim() : null;
  const rvNummerEAkte = isRv ? (document.getElementById('sRvNummerEAkte').value.trim() || null) : null;
  const laufzeitVon = isRv ? (document.getElementById('sLaufzeitVon').value || null) : null;
  const laufzeitBis = isRv ? (document.getElementById('sLaufzeitBis').value || null) : null;

  // Haushaltstitel: eigene Validierung + abgeleiteter Anzeigename
  const htTitel = isHt ? document.getElementById('sTitel').value.trim() : null;
  const htObjektnummer = isHt ? (document.getElementById('sObjektnummer').value.trim() || null) : null;
  const htBezeichnung = isHt ? document.getElementById('sBezeichnung').value.trim() : null;
  const htKapitel = isHt ? (document.getElementById('sKapitel').value.trim() || null) : null;
  const htErlaeuterung = isHt ? (document.getElementById('sErlaeuterung').value.trim() || null) : null;

  let name;
  if (isRv) {
    name = `${vertragsnehmer} — ${rvNummerVergabestelle}`;
  } else if (isHt) {
    name = htObjektnummer ? `${htTitel} · ${htObjektnummer} – ${htBezeichnung}` : `${htTitel} – ${htBezeichnung}`;
  } else {
    name = document.getElementById('sName').value.trim();
  }
  
  if (isRv) {
    if (!vertragsnehmer || !rvNummerVergabestelle) {
      alert('Bitte Vertragsnehmer und Vertragsnummer (Vergabestelle) eingeben.');
      return;
    }
  } else if (isHt) {
    if (!htTitel || !htBezeichnung) {
      alert('Bitte Titel und Bezeichnung eingeben.');
      return;
    }
  } else if (!name) {
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
    if (isRv) {
      item.vertragsnehmer = vertragsnehmer;
      item.rvNummerVergabestelle = rvNummerVergabestelle;
      item.rvNummerEAkte = rvNummerEAkte;
      item.laufzeitVon = laufzeitVon;
      item.laufzeitBis = laufzeitBis;
    }
    if (isHt) {
      item.titel = htTitel;
      item.objektnummer = htObjektnummer;
      item.bezeichnung = htBezeichnung;
      item.kapitel = htKapitel;
      item.erlaeuterung = htErlaeuterung;
    }
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
    if (isRv) {
      newItem.vertragsnehmer = vertragsnehmer;
      newItem.rvNummerVergabestelle = rvNummerVergabestelle;
      newItem.rvNummerEAkte = rvNummerEAkte;
      newItem.laufzeitVon = laufzeitVon;
      newItem.laufzeitBis = laufzeitBis;
    }
    if (isHt) {
      newItem.titel = htTitel;
      newItem.objektnummer = htObjektnummer;
      newItem.bezeichnung = htBezeichnung;
      newItem.kapitel = htKapitel;
      newItem.erlaeuterung = htErlaeuterung;
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
  if (type === 'rahmenvertraege') {
    const inUse = (window.abrufe || []).filter(a => a.rahmenvertragId === id);
    if (inUse.length > 0) {
      msg += `\n\n⚠ Achtung: Wird in ${inUse.length} Vertragsabruf${inUse.length > 1 ? 'en' : ''} verwendet.`;
      msg += '\nDiese Abrufe behalten die Referenz, der Rahmenvertrag ist dann aber nicht mehr im Dropdown wählbar.';
    }
  } else if (type === 'haushaltstitel') {
    const inUse = (window.abrufe || []).filter(a => a.haushaltstitelId === id);
    if (inUse.length > 0) {
      msg += `\n\n⚠ Achtung: Wird in ${inUse.length} Vertragsabruf${inUse.length > 1 ? 'en' : ''} verwendet.`;
      msg += '\nDiese Abrufe behalten die Referenz, der Haushaltstitel ist dann aber nicht mehr im Dropdown wählbar.';
    }
  } else if (type === 'liegenschaften') {
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

  // ── Vertragsabruf-Modal (js/abrufe.js) ──
  // Liegenschaften
  const aLgSel = document.getElementById('aLiegenschaft');
  if (aLgSel) {
    const current = aLgSel.value;
    aLgSel.innerHTML = '<option value="">— Wählen —</option>' +
      window.stammdaten.liegenschaften.map(l =>
        `<option value="${esc(l.name)}">${esc(l.name)}</option>`
      ).join('');
    if (current) aLgSel.value = current;
  }
  updateAbrufAnlagenDropdown();

  // Bedarfsersteller (nutzt dieselbe Verantwortliche-Stammdaten-Liste)
  const bedarfSel = document.getElementById('aBedarfsersteller');
  if (bedarfSel) {
    const current = bedarfSel.value;
    bedarfSel.innerHTML = '<option value="">— Wählen —</option>' +
      window.stammdaten.verantwortliche.map(v =>
        `<option value="${esc(v.name)}">${esc(v.name)}</option>`
      ).join('');
    if (current) bedarfSel.value = current;
  }

  // Rahmenverträge
  const rvSel = document.getElementById('aRahmenvertrag');
  if (rvSel) {
    const current = rvSel.value;
    rvSel.innerHTML = '<option value="">— Wählen —</option>' +
      (window.stammdaten.rahmenvertraege || []).map(r => {
        const vn = r.rvNummerVergabestelle || r.rvNummer || '—';
        const label = r.rvNummerEAkte ? `${r.vertragsnehmer} — VN ${vn} · E-Akte ${r.rvNummerEAkte}` : `${r.vertragsnehmer} — VN ${vn}`;
        return `<option value="${r.id}">${esc(label)}</option>`;
      }).join('');
    if (current) rvSel.value = current;
  }
}

// Kaskadierung Anlage↔Liegenschaft im Vertragsabruf-Modal (analog Vorgang)
function updateAbrufAnlagenDropdown() {
  const lgSel = document.getElementById('aLiegenschaft');
  const anlageSel = document.getElementById('aAnlage');
  if (!anlageSel) return;

  const selectedLg = lgSel ? lgSel.value : '';
  const current = anlageSel.value;

  const anlagen = selectedLg ? getAnlagenForLiegenschaft(selectedLg) : window.stammdaten.anlagen;

  anlageSel.innerHTML = '<option value="">— Wählen —</option>' +
    anlagen.map(a => `<option value="${esc(a.name)}">${esc(a.name)}</option>`).join('');

  if (current && anlagen.find(a => a.name === current)) {
    anlageSel.value = current;
  }
}

function onAbrufLiegenschaftChange() {
  updateAbrufAnlagenDropdown();
}

function onAbrufAnlageChange() {
  const anlageSel = document.getElementById('aAnlage');
  const lgSel = document.getElementById('aLiegenschaft');
  if (!anlageSel || !lgSel || !anlageSel.value) return;

  const lg = getLiegenschaftForAnlage(anlageSel.value);
  if (lg && lgSel.value !== lg.name) {
    lgSel.value = lg.name;
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
window.renderRahmenvertraegeSection = renderRahmenvertraegeSection;
window.toggleStammdatenSection = toggleStammdatenSection;
window.updateAbrufAnlagenDropdown = updateAbrufAnlagenDropdown;
window.onAbrufLiegenschaftChange = onAbrufLiegenschaftChange;
window.onAbrufAnlageChange = onAbrufAnlageChange;
