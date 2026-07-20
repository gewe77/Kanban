# Vorgangsregister

Web-App für Betriebsingenieure mit:
- 📋 **Vorgangsregister** — eine einzige, nach Dringlichkeit sortierte Liste (kein Board, keine Ordner). Jeder Vorgang trägt Frist + Puffer + automatisch berechnete Wiedervorlage und bewegt sich von selbst nach oben, sobald sein Termin näher rückt
- 📑 **Vertragsabrufe** — Leistungsabrufe aus Rahmenverträgen, eigener Lebenszyklus (Anforderung → Ausführung → Abschluss), gleiches Register-Prinzip wie oben. Details siehe Abschnitt "Vertragsabrufe" unten
- ⚙️ **Einstellungen** — Stammdaten-Verwaltung (Liegenschaften, Anlagen, Rahmenverträge, Haushaltstitel, Kategorien, Verantwortliche)

> **Hinweis:** Das frühere Kanban-Board sowie die Heute-/Aktiv-Ansichten wurden entfernt.
> Sie hatten sich in der Praxis nicht bewährt (Übertrag aus Outlook unzuverlässig,
> Ordnerstruktur wurde nicht konsequent abgearbeitet). Das Register ersetzt beides
> durch ein einziges "Abarbeitungsregister mit Nachverfolgung".

## Architektur

```
kanban-betrieb/
├── index.html              # Haupt-HTML mit Tab-Struktur
├── manifest.json           # PWA-Manifest
├── README.md               # Diese Datei
├── css/
│   └── styles.css          # Dark UI Design (9 Prinzipien)
└── js/
    ├── firebase-config.js  # Firestore-Instanz (betrieb-vorgaenge) + Auth
    ├── common.js           # Utilities (Datum, Escape, LocalStorage)
    ├── register.js         # Vorgangsregister: Dringlichkeit, Drawer, Schritte, Log
    ├── abrufe.js           # Vertragsabrufe: eigener Lebenszyklus, Teilrechnungen, Drawer
    ├── einstellungen.js    # Stammdaten-Verwaltung (inkl. Rahmenverträge)
    └── app.js              # Tab-Switching, Init, Keyboard
```

`abrufe.js` ist bewusst komplett unabhängig von `register.js` gehalten (eigene
Collection, eigene Funktionen, keine gemeinsamen Top-Level-Funktionen) — Änderungen
am einen Register können das andere nicht versehentlich beeinflussen.

## Firebase-Setup

Ein Projekt für alles: `betrieb-vorgaenge` (Firestore: `vorgaenge`, `stammdaten_*` — und Authentication für die Google-Anmeldung).

Voraussetzung (einmalig in der Firebase-Konsole): Authentication → Sign-in method →
Google aktiviert, Authorized domain `gewe77.github.io` eingetragen.

Das frühere zweite Projekt `kanban-betrieb` wird nicht mehr benötigt (weder für
Daten noch für Auth) und kann in der Firebase-Konsole gelöscht werden.

## Dringlichkeits-Logik (Kernstück des Registers)

Jeder Vorgang bekommt automatisch eine Klasse zugewiesen, danach wird sortiert:

| Rang | Klasse | Bedingung |
|------|--------|-----------|
| 0 | überfällig | echte Frist liegt in der Vergangenheit |
| 1 | heute fällig | Frist heute, oder Wiedervorlage heute/überschritten |
| 1.5 | neu | Status "Neu / Ungeprüft" — noch nicht bewertet |
| 2 | wartet auf extern | Status "Wartet Firma/Intern" mit künftiger Wiedervorlage |
| 3 | diese Woche | Frist in ≤ 7 Tagen |
| 4 | später | kein naher Trigger |
| 99 | erledigt/archiviert | ausgeblendet, außer manuell eingeblendet |

**Puffer:** Beim Anlegen wird ein Puffer (Standard: 2 Tage) hinterlegt. Ist keine
Wiedervorlage manuell gesetzt, wird sie automatisch als `Frist − Puffer` berechnet.
Das gibt dem Vorgang einen künstlich vorgezogenen Trigger-Zeitpunkt, damit
unvorhergesehene Tagesstörungen nicht direkt die echte Frist gefährden.

**Soft-WIP-Limit:** Die Kennzahlenleiste zeigt "X/3 aktiv in Bearbeitung" und
markiert das Limit farblich, wenn es überschritten wird — bewusst klein gehalten,
damit nicht zu viele Vorgänge gleichzeitig als "aktiv" erscheinen.

### Firestore-Rules (betrieb-vorgaenge)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /vorgaenge/{id}                    { allow read, write: if request.auth != null; }
    match /vertragsabrufe/{id}                { allow read, write: if request.auth != null; }
    match /stammdaten_liegenschaften/{id}    { allow read, write: if request.auth != null; }
    match /stammdaten_anlagen/{id}           { allow read, write: if request.auth != null; }
    match /stammdaten_rahmenvertraege/{id}   { allow read, write: if request.auth != null; }
    match /stammdaten_haushaltstitel/{id}    { allow read, write: if request.auth != null; }
    match /stammdaten_kategorien/{id}        { allow read, write: if request.auth != null; }
    match /stammdaten_verantwortliche/{id}   { allow read, write: if request.auth != null; }
  }
}
```

> **Hinweis:** Falls die Firestore-Regeln in der Konsole bereits mit einer
> allgemeineren Regel arbeiten (z.B. `match /{document=**}`), ist keine Änderung
> nötig — die neue Collection `vertragsabrufe` und `stammdaten_rahmenvertraege`
> greifen dann automatisch dieselbe Regel wie alle anderen Collections.

## Stammdaten-Hierarchie

```
Liegenschaft (1)  ──→  Anlagen (n)
```

- Jede Anlage gehört genau einer Liegenschaft (`liegenschaftId`)
- Im Vorgangs-Modal: Liegenschaft wählen → Anlagen-Dropdown filtert kaskadierend
- Umgekehrt: Anlage wählen → Liegenschaft wird automatisch gesetzt
- Migration: Bestehende Anlagen werden automatisch der ersten Liegenschaft zugeordnet

## Schritte-Verwaltung im Vorgang

Analog zum Kanban-Board:
- ✓ Schritt abhaken → Log-Eintrag + Fortschrittszähler
- ✕ Schritt löschen
- + Zwischenschritt nach beliebiger Position einfügen
- Neue Schritte am Ende anhängen
- Der erste offene Schritt wird als "Nächster Schritt" angezeigt

## Vertragsabrufe

Leistungsabrufe aus Rahmenverträgen (fester Vertragsnehmer, feste Rahmenvertrags-
nummer, feste Laufzeit) — vom gemeldeten Bedarf bis zur bezahlten Rechnung.
Eigene Firestore-Collection (`vertragsabrufe`), eigenes Register-Tab, komplett
unabhängig von `register.js` implementiert (siehe `js/abrufe.js`).

### Lebenszyklus (3 Phasen, 10 Status)

Die Zeile im Register zeigt bewusst nur **3 Icon-Formen** (Farbe = Dringlichkeit,
identisch zum Vorgangsregister), dahinter den konkreten Status als Text:

| Phase | Icon | Status |
|-------|------|--------|
| Anforderung | 📝 | Bedarf gemeldet → Rahmenabruf wird erstellt → Zur Zeichnung → Versendet an Firma |
| Ausführung | ⚙ | Terminiert → In Ausführung |
| Abschluss | ✅ (◐ bei Teilabschluss) | Teilabschluss → Abgeschlossen → Rechnung → Bezahlt |

`Bezahlt` ist der Terminal-Status (Rang 99, ausgeblendet — analog zu
"erledigt/archiviert" im Vorgangsregister).

### Teilrechnungen

Manche Leistungen werden nur teilweise abgeschlossen und als Teilrechnung
abgerechnet. Bewusst **keine Buchhaltung**, nur Nachvollziehbarkeit: ein Zähler
(`teilrechnungenAnzahl`) plus ein Log-Eintrag pro erfasster Teilrechnung
(Kurznotiz, kein Betrag). Der Status "Teilabschluss" wird manuell im
Status-Dropdown gesetzt, unabhängig vom Teilrechnungs-Zähler.

### Abrufvermerk

Freitext-Feld für die haushaltsrechtliche Begründung, warum die Leistung
abgerufen werden muss. Eigener, immer sichtbarer Drawer-Bereich, editierbar
wie Termin/Verwaltungsdaten (explizites Speichern, kein Blur-Autosave).

### Verwaltungsdaten (progressive Erfassung)

Bei der Bedarfsmeldung sind Sachbearbeiter, Titel (Haushaltsmittel),
Objektnummer und Auftragswert meist noch nicht bekannt — sie werden erst nach
Übergabe an den Bürosachbearbeiter ergänzt. Deshalb kein Pflichtfeld beim
Anlegen, sondern ein eigener editierbarer Bereich im Drawer.

### Metadaten (editierbar bis auf Abruf-Nr)

Bedarf, Rahmenvertrag, Liegenschaft, Anlage und Bedarfsersteller sind im
Drawer nachträglich änderbar (Bearbeiten-Button, gleiches Muster wie
Termin/Verwaltungsdaten/Abrufvermerk). Nur die Abruf-Nr selbst bleibt fix, da
sie als Identifikator dient. Status hat weiterhin sein eigenes, immer aktives
Dropdown (kein Bearbeiten-Modus nötig — Statuswechsel ist der häufigste
Vorgang). Auch hier gibt's "+"-Schnellanlage-Buttons für fehlende Stammdaten.

### Reihenfolge im Drawer

Metadaten → Abgerufene Positionen → Abrufvermerk → Verwaltungsdaten → Termin
& Wiedervorlage → Nächster Schritt → Schritte → ... — die inhaltlich
zusammengehörenden "was/warum"-Abschnitte (Positionen, Begründung) stehen vor
den eher administrativen Abschnitten (Verwaltungsdaten, Termine).

### Rahmenverträge (Stammdaten)

Neue Stammdaten-Kategorie in den Einstellungen: Vertragsnehmer (z.B. "SES"),
**zwei Vertragsnummern** (Vergabestelle und E-Akte — jeder Rahmenvertrag hat
beide), Laufzeit von/bis. Vergabestelle-Nummer ist Pflichtfeld (wird im
Register/Dropdown als Kurzform angezeigt), E-Akte-Nummer optional (nur in
Drawer/Einstellungen sichtbar, wo mehr Platz ist). Referenziert über
`rahmenvertragId`. Ältere Einträge mit nur einer Nummer (`rvNummer`) werden
weiterhin als Vergabestelle-Nummer angezeigt (Legacy-Fallback).

### Versionsanzeige

Im Header steht neben dem Logo immer die aktuelle Version (`window.APP_VERSION`
in `js/app.js`). Schema: `vXX` für größere Ausbaustufen (i.d.R. komplettes
ZIP), `vXX.NNN` für fortlaufende Änderungen an einzelnen Dateien seit der
letzten `vXX`-Stufe. Wird von Claude bei jeder Auslieferung manuell
hochgezählt — kein automatischer Build-Mechanismus, da reines Datei-Deployment
ohne Build-Schritt.

### Haushaltstitel (Stammdaten)

Aus der internen Titel-/Objektkontenübersicht importiert (Titel, Objektnummer,
Bezeichnung, Kapitel, Erläuterung — 51 Einträge, Stand 12/2018). Ersetzt die
vorherige freie Texteingabe für Titel/Objektnummer durch ein echtes Dropdown
(`haushaltstitelId`-Referenz), gruppiert nach Kapitel. Die Erläuterung wird
als Tooltip auf den Dropdown-Einträgen sowie in der Detailansicht nach der
Auswahl angezeigt. Titel/Objektnummer/Bezeichnung/Kapitel/Erläuterung sind
über Einstellungen frei bearbeitbar (hinzufügen, ändern, löschen) — genau wie
bei den anderen Stammdaten-Kategorien.

Abrufe, die vor dieser Umstellung angelegt wurden, behalten ihre alten
Freitext-Werte (`titel`/`objektnummer`) und werden im Drawer weiterhin
angezeigt (mit Hinweis "alt erfasst") — keine automatische Migration, um
keine Annahmen über eine passende Zuordnung zu treffen.

## Bedienung: Eingabemasken

- **Kein Schließen durch versehentlichen Klick außerhalb**: Die Modale
  ("Neuer Vorgang", "Neuer Vertragsabruf", Stammdatum-Modal) schließen sich
  nur noch über ✕/Abbrechen oder Escape — ein Klick auf den abgedunkelten
  Hintergrund tut nichts mehr. Vermeidet Datenverlust bei bereits
  ausgefüllten Feldern.
- **Schnellanlage fehlender Stammdaten**: Kleiner "+"-Button neben
  Liegenschaft/Anlage/Kategorie/Verantwortlich (Vorgang) bzw.
  Rahmenvertrag/Liegenschaft/Anlage/Bedarfsersteller (Vertragsabruf) öffnet
  das Stammdatum-Modal, ohne die gerade ausgefüllte Eingabemaske zu
  verlieren — die Maske wird nur versteckt (Werte bleiben erhalten) und
  kehrt nach dem Speichern zurück, mit dem neuen Eintrag direkt
  vorausgewählt.

## Keyboard-Shortcuts

| Taste | Funktion |
|-------|----------|
| `n` | Neuer Vorgang / Neuer Vertragsabruf (je nach aktivem Tab) |
| `Esc` | Alle Overlays schließen |

## Roadmap

- [x] Phase 1: Kanban (Single-File) — *abgelöst*
- [x] Phase 2: Multi-File-Architektur
- [x] Phase 2b: Vorgangsmanagement (Heute/Aktiv/Register) — *abgelöst*
- [x] Phase 2c: Einstellungen (Stammdaten via Firestore)
- [x] Phase 2d: Mail-Capture (Quick-Capture + Smart-Parser) — *in v11 entfernt*
- [x] Phase 2e: Vorgangsregister mit Dringlichkeits-Logik, Puffer/Wiedervorlage, Soft-WIP-Limit
- [x] v11: Bereinigung — Mail-Capture entfernt, Projekt auf reines Vorgangsregister reduziert
- [x] v12: Vertragsabrufe — eigenes Register für Leistungsabrufe aus Rahmenverträgen (3-Phasen-Lebenszyklus, Teilrechnungen, Abrufvermerk, Rahmenverträge-Stammdaten)
- [ ] Phase 3: Wartungsmanagement (eigene Firestore-Instanz)
- [ ] Phase 4: Betriebsstatistik (Dashboard)
