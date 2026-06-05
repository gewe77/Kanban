# Betriebsführungssystem

Multi-Board Web-App für Betriebsingenieure mit:
- 🎯 **Kanban** — Projekt- und Vorgangsverwaltung mit Drag & Drop
- 📋 **Vorgänge** — Tägliche Wiedervorlage-Steuerung mit Heute-Liste

## Architektur

```
kanban-betrieb/
├── index.html              # Haupt-HTML mit Tab-Struktur
├── manifest.json           # PWA-Manifest
├── css/
│   └── styles.css          # Dark UI Design (9 Prinzipien)
└── js/
    ├── firebase-config.js  # Beide Firestore-Instanzen + Auth
    ├── common.js           # Utilities (Datum, Escape, LocalStorage)
    ├── kanban.js           # Kanban Board Logik
    ├── vorgaenge.js        # Vorgangsmanagement Logik
    └── app.js              # Tab-Switching, Init, Keyboard
```

## Firebase-Setup

Zwei separate Projekte:

| Board | Projekt | Collection |
|-------|---------|------------|
| Kanban | `kanban-betrieb` | `vorgaenge` |
| Vorgänge | `betrieb-vorgaenge` | `vorgaenge` |

Beide Projekte teilen sich die **Google Authentication** des Kanban-Projekts.

## Deployment auf GitHub Pages

```bash
# 1. Repo klonen oder Dateien hochladen
cd kanban-betrieb

# 2. Alle Dateien committen
git add index.html manifest.json css/ js/
git commit -m "Feature: Vorgangsmanagement mit Multi-File-Architektur"
git push

# 3. GitHub Pages aktivieren
#    Settings → Pages → Source: main branch
```

URL: `https://<username>.github.io/kanban-betrieb/`

## Keyboard-Shortcuts

| Taste | Funktion |
|-------|----------|
| `1` | Tab "Kanban" |
| `2` | Tab "Vorgänge" |
| `n` | Neuer Vorgang/Karte |
| `Esc` | Alle Overlays schließen |

## Datenmodell

### Kanban-Karte
```javascript
{
  id: "uid",
  thema: "Druckprüfung Süd",
  bereich: "Energie",
  status: "jetzt",  // eingang | warten | jetzt | parken | erledigt
  zeitfokus: "Diese Woche",
  naechsterSchritt: "Termin vereinbaren",
  faellig: "2026-06-15",
  wartenAuf: "Firma XY",
  nachweis: "Mail v. 5.6.",
  schritte: [...],
  schritteDone: 0,
  log: "...",
  letzteUpdate: "2026-06-05"
}
```

### Vorgang
```javascript
{
  id: "uid",
  vorgangsNr: "V-2026-001",
  anlage: "MHKW",
  thema: "NOx-Sensor kalibrieren",
  kategorie: "Wartung",  // Störung | Wartung | Mangel | Vergabe | Frist | Doku
  prioritaet: "A",        // A | B | C
  status: "neu",          // neu | bewertet | inbearbeitung | wartet-firma | wartet-intern | entscheidung | erledigt | archiviert
  naechsterSchritt: "Firma kontaktieren",
  verantwortlich: "Ich",
  frist: "2026-06-15",
  wiedervorlage: "2026-06-08",
  nachweis: "Mail v. 5.6.",
  letzteAktivitaet: "2026-06-05",
  abschlussVermerk: null,
  log: "..."
}
```

## Roadmap

- [x] Phase 1: Kanban (Single-File)
- [x] Phase 2: Vorgangsmanagement + Multi-File
- [ ] Phase 3: Wartungsmanagement (eigene Firestore)
- [ ] Phase 4: Betriebsstatistik (Dashboard)

## Design-Prinzipien

1. Kein reines Schwarz/Weiß
2. Elevation via Helligkeit (5 Ebenen)
3. Entsättigte Akzentfarben
4. Großzügige negative Räume
5. Backdrop-Blur auf Overlays
6. WCAG AA Kontrastverhältnisse
7. IBM Plex Mono/Sans Typography
8. Konsistente visuelle Hierarchie
9. Minimal-funktionale Animationen
