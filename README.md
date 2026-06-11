# Betriebsführungssystem

Multi-Board Web-App für Betriebsingenieure mit:
- 🎯 **Kanban** — Projekt- und Vorgangsverwaltung mit Drag & Drop
- 📋 **Vorgänge** — Tägliche Wiedervorlage-Steuerung mit Heute-Liste, AKTIV-Board und Register
- ⚙️ **Einstellungen** — Stammdaten-Verwaltung (Anlagen, Kategorien, Verantwortliche)
- 📧 **Mail-Capture** — E-Mails als Vorgänge erfassen (manuell, mit Smart-Parser)

## Architektur

```
kanban-betrieb/
├── index.html              # Haupt-HTML mit Tab-Struktur
├── manifest.json           # PWA-Manifest
├── README.md               # Diese Datei
├── css/
│   └── styles.css          # Dark UI Design (9 Prinzipien)
└── js/
    ├── firebase-config.js  # Beide Firestore-Instanzen + Auth
    ├── common.js           # Utilities (Datum, Escape, LocalStorage)
    ├── kanban.js           # Kanban Board Logik
    ├── vorgaenge.js        # Vorgangsmanagement (Heute/Aktiv/Register)
    ├── einstellungen.js    # Stammdaten-Verwaltung
    ├── mail-capture.js     # Mail-Quick-Capture + Smart-Parser
    └── app.js              # Tab-Switching, Init, Keyboard
```

## Firebase-Setup

Zwei separate Projekte:

| Board | Projekt | Collections |
|-------|---------|-------------|
| Kanban | `kanban-betrieb` | `vorgaenge` |
| Vorgänge | `betrieb-vorgaenge` | `vorgaenge`, `stammdaten_*` |

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
| `1` | Tab Kanban |
| `2` | Tab Vorgänge |
| `n` | Neuer Vorgang/Karte |
| `Esc` | Alle Overlays schließen |

## Roadmap

- [x] Phase 1: Kanban (Single-File)
- [x] Phase 2: Multi-File-Architektur
- [x] Phase 2b: Vorgangsmanagement (Heute/Aktiv/Register)
- [x] Phase 2c: Einstellungen (Stammdaten via Firestore)
- [x] Phase 2d: Mail-Capture (Quick-Capture + Smart-Parser)
- [ ] Phase 3: Wartungsmanagement (eigene Firestore-Instanz)
- [ ] Phase 4: Betriebsstatistik (Dashboard)
