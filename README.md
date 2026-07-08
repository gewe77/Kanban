# Vorgangsregister

Web-App für Betriebsingenieure mit:
- 📋 **Vorgangsregister** — eine einzige, nach Dringlichkeit sortierte Liste (kein Board, keine Ordner). Jeder Vorgang trägt Frist + Puffer + automatisch berechnete Wiedervorlage und bewegt sich von selbst nach oben, sobald sein Termin näher rückt
- ⚙️ **Einstellungen** — Stammdaten-Verwaltung (Liegenschaften, Anlagen, Kategorien, Verantwortliche)
- 📧 **Mail-Capture** — E-Mails als Vorgänge erfassen (manuell, mit Smart-Parser)

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
    ├── einstellungen.js    # Stammdaten-Verwaltung
    ├── mail-capture.js     # Mail-Quick-Capture + Smart-Parser
    └── app.js              # Tab-Switching, Init, Keyboard
```

## Firebase-Setup

Ein Projekt: `betrieb-vorgaenge` (Collections `vorgaenge`, `stammdaten_*`).

Das frühere zweite Projekt `kanban-betrieb` wird nicht mehr verwendet und kann bei
Bedarf in der Firebase-Konsole gelöscht werden.

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
    match /vorgaenge/{id}                   { allow read, write: if request.auth != null; }
    match /stammdaten_liegenschaften/{id}   { allow read, write: if request.auth != null; }
    match /stammdaten_anlagen/{id}          { allow read, write: if request.auth != null; }
    match /stammdaten_kategorien/{id}       { allow read, write: if request.auth != null; }
    match /stammdaten_verantwortliche/{id}  { allow read, write: if request.auth != null; }
  }
}
```

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

## Mail-Capture Workflow

### Wie es funktioniert

1. **In Outlook:** E-Mail öffnen, Body markieren (Strg+A), kopieren (Strg+C)
2. **In PWA:** Vorgänge-Tab → Button "📧 Aus Mail"
3. **Modal öffnet sich:**
   - Mail-Text einfügen (Strg+V oder "Aus Zwischenablage einfügen")
   - Betreff manuell eintippen
   - Absender optional
4. **"Analysieren →"** klicken
5. **Smart-Parser** erkennt automatisch:
   - Anlage (aus Stammdaten)
   - Kategorie (aus Keywords)
   - Priorität (A bei "DRINGEND", etc.)
   - Frist (Datumsmuster, "bis Freitag")
   - Verantwortlich (extern bei Mail-Adresse)
6. **Duplikat-Check:**
   - Ähnlicher Vorgang → Update-Dialog
   - Sonst → Neuer-Vorgang-Modal vorausgefüllt

### Smart-Parser Muster

| Feld | Erkennt |
|------|---------|
| Prio A | dringend, eilt, kritisch, sofort, ASAP, urgent |
| Prio B | zeitnah, bald, diese woche, baldmöglichst |
| Störung | störung, defekt, fehler, ausfall, kaputt |
| Wartung | wartung, inspektion, prüfung, service |
| Vergabe | angebot, vergabe, auftrag, ausschreibung |
| Datum | 15.06.2026, "bis Freitag", "nächste Woche" |

### Duplikat-Erkennung

| Signal | Score |
|--------|-------|
| Vorgangs-Nr im Betreff | 100% |
| Identischer Betreff | 90% |
| 60%+ Wort-Überlappung | 42-70% |
| Gleiche Anlage | +15 |
| Wartet auf Antwort dieses Absenders | +20 |

Treffer ab 50% → Update-Vorschlag.

## Keyboard-Shortcuts

| Taste | Funktion |
|-------|----------|
| `n` | Neuer Vorgang |
| `Esc` | Alle Overlays schließen |

## Roadmap

- [x] Phase 1: Kanban (Single-File) — *abgelöst*
- [x] Phase 2: Multi-File-Architektur
- [x] Phase 2b: Vorgangsmanagement (Heute/Aktiv/Register) — *abgelöst*
- [x] Phase 2c: Einstellungen (Stammdaten via Firestore)
- [x] Phase 2d: Mail-Capture (Quick-Capture + Smart-Parser)
- [x] Phase 2e: Vorgangsregister mit Dringlichkeits-Logik, Puffer/Wiedervorlage, Soft-WIP-Limit
- [ ] Phase 3: Wartungsmanagement (eigene Firestore-Instanz)
- [ ] Phase 4: Betriebsstatistik (Dashboard)
