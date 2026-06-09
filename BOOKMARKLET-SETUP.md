# 📧 Bookmarklet einrichten — Schritt-für-Schritt

## **Was ist das?**

Ein "magisches Lesezeichen" im Browser, das aus einer Outlook-E-Mail
automatisch einen Vorgang in deiner PWA erstellt (oder einen bestehenden
Vorgang aktualisiert, falls eine Folge-E-Mail erkannt wird).

---

## **🔧 Installation in Chrome (5 Minuten)**

### **Schritt 1: PWA-URL anpassen**

Öffne die Datei `bookmarklet-source.js` und ändere diese Zeile:

```javascript
var PWA_URL = 'https://GW-BE.github.io/kanban-betrieb/';
```

→ Ersetze `GW-BE` mit deinem GitHub-Username.

Wenn du den Bookmarklet-Code dann neu minifizierst, ist die URL angepasst.

### **Schritt 2: Lesezeichenleiste einblenden**

In Chrome:
- `Strg + Shift + B` → Lesezeichenleiste erscheint unter der Adressleiste

### **Schritt 3: Neues Lesezeichen erstellen**

**Methode A — Per Drag & Drop:**
1. Öffne diese Setup-Anleitung in deinem Browser
2. **Ziehe den orangen Button unten** (in der App) in die Lesezeichenleiste

**Methode B — Per Rechtsklick:**
1. Rechtsklick auf die Lesezeichenleiste
2. Wähle **"Seite hinzufügen…"**
3. Name: `→ Vorgang`
4. URL: Den Bookmarklet-Code aus der Datei `bookmarklet-minified.txt` einfügen
5. **Speichern**

### **Schritt 4: Bookmarklet-Code**

```
javascript:(function()%7Bvar%20PWA_URL%3D'https%3A%2F%2FGW-BE.github.io%2Fkanban-betrieb%2F'%3Bfunction%20extractMailData()%7Bvar%20data%3D%7Bsubject%3A%20''%2Cfrom%3A%20''%2CfromName%3A%20''%2Cbody%3A%20''%2Cdate%3A%20''%7D%3Bvar%20selection%3Dwindow.getSelection().toString().trim()%3Bvar%20subjectSelectors%3D%5B%20'%5Brole%3D%22heading%22%5D%5Baria-level%3D%222%22%5D'%2C'.allowTextSelection%5Brole%3D%22heading%22%5D'%2C'div%5Bdata-testid%3D%22subjectLine%22%5D'%2C'span.PbsLE'%2C'div.AbB7Wd'%2C'.ms-font-xxl'%20%5D%3Bfor(var%20i%3D0%3Bi%20%3C%20subjectSelectors.length%3Bi%2B%2B)%7Bvar%20el%3Ddocument.querySelector(subjectSelectors%5Bi%5D)%3Bif(el%20%26%26%20el.textContent.trim())%7Bdata.subject%3Del.textContent.trim()%3Bbreak%3B%7D%7Dvar%20fromEl%3Ddocument.querySelector('a%5Bhref%5E%3D%22mailto%3A%22%5D')%3Bif(fromEl)%7Bdata.from%3DfromEl.href.replace('mailto%3A'%2C'').split('%3F')%5B0%5D%3Bvar%20nameMatch%3DfromEl.textContent.trim()%3Bif(nameMatch%20%26%26%20nameMatch%20!%3D%3Ddata.from)%7Bdata.fromName%3DnameMatch%3B%7D%7Dif(!data.fromName)%7Bvar%20nameSelectors%3D%5B%20'%5Bdata-testid%3D%22message-from%22%5D'%2C'.personaName'%2C'span.OZZZK'%20%5D%3Bfor(var%20j%3D0%3Bj%20%3C%20nameSelectors.length%3Bj%2B%2B)%7Bvar%20nel%3Ddocument.querySelector(nameSelectors%5Bj%5D)%3Bif(nel%20%26%26%20nel.textContent.trim())%7Bdata.fromName%3Dnel.textContent.trim()%3Bbreak%3B%7D%7D%7Dif(selection%20%26%26%20selection.length%20%3E%2020)%7Bdata.body%3Dselection%3B%7Delse%7Bvar%20bodySelectors%3D%5B%20'%5Brole%3D%22document%22%5D'%2C'div.PlainText'%2C'.allowTextSelection%20%5Baria-label%3D%22Nachrichtentext%22%5D'%2C'%5Baria-label%3D%22Message%20body%22%5D'%2C'div.rps_'%20%5D%3Bfor(var%20k%3D0%3Bk%20%3C%20bodySelectors.length%3Bk%2B%2B)%7Bvar%20bel%3Ddocument.querySelector(bodySelectors%5Bk%5D)%3Bif(bel%20%26%26%20bel.innerText%20%26%26%20bel.innerText.length%20%3E%2020)%7Bdata.body%3Dbel.innerText.trim()%3Bbreak%3B%7D%7D%7Dif(data.body.length%20%3E%202000)%7Bdata.body%3Ddata.body.slice(0%2C2000)%2B%20'...'%3B%7Dvar%20now%3Dnew%20Date()%3Bdata.date%3Dnow.toISOString().slice(0%2C10)%3Breturn%20data%3B%7Dvar%20mail%3DextractMailData()%3Bif(!mail.subject%20%26%26%20!mail.body)%7Balert('%E2%9A%A0%20Bookmarklet%20konnte%20keine%20Mail-Daten%20lesen.%5Cn%5Cn'%20%2B%20'Tipps%3A%5Cn'%20%2B%20'1.%20%C3%96ffne%20eine%20E-Mail(Lesemodus)%5Cn'%20%2B%20'2.%20Markiere%20den%20wichtigen%20Mail-Text%5Cn'%20%2B%20'3.%20Klicke%20das%20Lesezeichen%20erneut%5Cn%5Cn'%20%2B%20'Falls%20das%20Problem%20bleibt%3A%20Mail%20manuell%20in%20die%20PWA%20%C3%BCbertragen.')%3Breturn%3B%7Dvar%20params%3Dnew%20URLSearchParams()%3Bparams.set('action'%2C'mail')%3Bparams.set('subject'%2Cmail.subject)%3Bparams.set('from'%2Cmail.from)%3Bparams.set('fromName'%2Cmail.fromName)%3Bparams.set('body'%2Cmail.body)%3Bparams.set('date'%2Cmail.date)%3Bvar%20url%3DPWA_URL%20%2B%20'%3F'%20%2B%20params.toString()%3Bwindow.open(url%2C'_blank')%3B%7D)()%3B--- Länge: 2940 Zeichen ---
```

⚠ **WICHTIG:** Kopiere den **kompletten Code** in einer Zeile als URL.

---

## **🧪 Test**

1. Öffne Outlook Web (`outlook.office.com`)
2. Klicke auf eine beliebige E-Mail (Lesemodus)
3. (Optional) Markiere den wichtigen Text in der Mail
4. Klicke das Lesezeichen **"→ Vorgang"**
5. Es öffnet sich ein neuer Tab mit deiner PWA
6. Modal "Neuer Vorgang" oder "Update-Vorschlag" erscheint

---

## **🎯 Typische Workflows**

### **A) Neue Mail = Neuer Vorgang**

```
Outlook: Mail von Firma XY öffnen
       ↓
Markiere wichtigen Text (optional)
       ↓
Klick: "→ Vorgang"
       ↓
PWA öffnet → Modal mit erkannten Feldern:
  - Thema: aus Betreff
  - Anlage: aus Mail-Text erkannt (z.B. "MHKW")
  - Kategorie: aus Mail-Text erkannt (z.B. "Störung")
  - Priorität: aus Keywords (z.B. "DRINGEND" → A)
  - Frist: aus Mail-Text (z.B. "bis 15.06.")
  - Nachweis: automatisch (Mail-Referenz)
       ↓
Du justierst → "Anlegen"
       ↓
✓ Vorgang V-2026-042 erstellt
```

### **B) Folge-Mail = Bestehenden Vorgang aktualisieren**

```
Outlook: "RE: NOx-Sensor MHKW defekt" öffnen
       ↓
Klick: "→ Vorgang"
       ↓
PWA erkennt: 90% Match mit V-2026-042
       ↓
Dialog: "Ähnlicher Vorgang gefunden"
  - 90%: V-2026-042 NOx-Sensor MHKW
  - [Klick zum Aktualisieren]
       ↓
Update-Modal:
  - Log-Eintrag (vorausgefüllt)
  - ☐ Status ändern → "Bewertet"
  - ☐ Wiedervorlage → in 7 Tagen
  - ☑ Nachweis erweitern
       ↓
"↻ Aktualisieren"
       ↓
✓ Mail an V-2026-042 angehängt
```

---

## **🐛 Troubleshooting**

### **Bookmarklet öffnet nichts**

- Prüfe, ob die PWA-URL im Bookmarklet-Code korrekt ist
- Browser-Console öffnen (`F12`) und auf Fehler prüfen
- In Chrome ggf. "Popups blockieren" prüfen

### **Mail-Daten werden nicht erkannt**

Outlook Web hat verschiedene UI-Versionen. Das Bookmarklet probiert mehrere
Selektoren, aber falls deine Version unterschiedlich ist:
- Markiere den Mail-Text manuell vor dem Klick → wird priorisiert
- Berichte mir die Outlook-Version, ich passe Selektoren an

### **Doppelte Vorgänge entstehen**

Erhöhe die Match-Schwelle in `mail-capture.js`:
```javascript
if (score >= 50) {  // → ändern auf 40 für mehr Treffer
```

---

## **📋 Lesezeichen-Leiste-Setup**

Optimal in der Lesezeichenleiste:

```
[⭐ Outlook Web] [📧 Posteingang] [→ Vorgang] [🎯 Betriebs-PWA]
```

So hast du alle wichtigen Tools direkt griffbereit.
