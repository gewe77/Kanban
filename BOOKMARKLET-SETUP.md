# 📧 Mail-Capture einrichten — Schritt-für-Schritt

## **Wie es funktioniert (v2 — Quick-Capture als Hauptweg)**

Es gibt **zwei Wege**, Mails in Vorgänge zu überführen:

### **Weg 1: Quick-Capture Modal** (immer verfügbar, garantiert funktional)
- Du klickst in der PWA auf den Button **"📧 Aus Mail"**
- Modal öffnet sich
- Du fügst Mail-Daten manuell ein (Betreff, Body, Absender)
- Smart-Parser analysiert → erstellt Vorgang oder schlägt Update vor

### **Weg 2: Bookmarklet** (Bonus, wenn DOM-Erkennung klappt)
- Du klickst in Outlook auf das Lesezeichen **"→ Vorgang"**
- Bookmarklet liest die Mail automatisch (versucht es)
- Falls erfolgreich → PWA öffnet mit vorausgefüllten Daten
- Falls **nicht** erfolgreich → öffnet automatisch das Quick-Capture Modal

→ **Du hast immer eine funktionierende Lösung.**

---

## **🔧 Setup A: Quick-Capture (sofort einsatzbereit, kein Setup nötig)**

Nach dem Upload der v6 ist der **"📧 Aus Mail"** Button im Vorgänge-Tab oben rechts.

### **Workflow:**
1. Öffne deine PWA → Vorgänge-Tab
2. Klick **"📧 Aus Mail"** oben rechts
3. Modal öffnet sich

### **Im Modal:**
1. Wechsle zu Outlook (in einem anderen Tab/Fenster)
2. Öffne die E-Mail
3. **Strg+A** im Mail-Body → kompletten Text markieren
4. **Strg+C** → kopieren
5. Zurück zur PWA
6. Klick **"📋 Aus Zwischenablage in Mail-Text einfügen"**
   - **Oder:** Manuell im Textfeld mit Strg+V einfügen
7. **Betreff** der Mail manuell eintippen (oder aus dem ersten Vorschlag übernehmen)
8. **Absender** (optional): z.B. `firma@xy.de`
9. Klick **"Analysieren →"**
10. PWA prüft auf Duplikate → Modal "Neuer Vorgang" oder "Update"
11. Anlegen / Aktualisieren

**Zeitaufwand: ~20-25 Sek pro Mail**

---

## **🔧 Setup B: Bookmarklet (für Outlook Web Schnellzugriff)**

### **Schritt 1: PWA-URL im Bookmarklet anpassen**

Öffne `bookmarklet-source.js` und ändere Zeile 11:

```javascript
var PWA_URL = 'https://GW-BE.github.io/kanban-betrieb/';
```

→ Ersetze `GW-BE` mit deinem GitHub-Username.

**WICHTIG:** Falls du das Bookmarklet änderst, musst du es neu minifizieren.
Der untenstehende Code hat noch `GW-BE` als Platzhalter.

### **Schritt 2: Lesezeichenleiste einblenden**

In Chrome: `Strg + Shift + B`

### **Schritt 3: Bookmarklet als Lesezeichen anlegen**

1. Rechtsklick auf die Lesezeichenleiste → **"Seite hinzufügen…"**
2. **Name:** `→ Vorgang`
3. **URL:** Den kompletten Code aus `bookmarklet-minified.txt` einfügen
4. **Speichern**

### **Bookmarklet-Code (kopiere alles in einer Zeile):**

```
javascript:(function()%7Bvar%20PWA_URL%3D'https%3A%2F%2FGW-BE.github.io%2Fkanban-betrieb%2F'%3Bfunction%20extractMailData()%7Bvar%20data%3D%7Bsubject%3A%20''%2Cfrom%3A%20''%2CfromName%3A%20''%2Cbody%3A%20''%2Cdate%3A%20''%7D%3Bvar%20selection%3Dwindow.getSelection().toString().trim()%3Bvar%20subjectSelectors%3D%5B%20'%5Brole%3D%22heading%22%5D%5Baria-level%3D%222%22%5D'%2C'.allowTextSelection%5Brole%3D%22heading%22%5D'%2C'div%5Bdata-testid%3D%22subjectLine%22%5D'%2C'span.PbsLE'%2C'div.AbB7Wd'%2C'.ms-font-xxl'%2C'.subjectLineMain'%2C'.subject'%2C'%23divSubject'%2C'span.PlainText.subject'%2C'div._cl_15'%2C'div.readSubject'%2C'div.ItemPart_subject'%2C'span.ms-font-xl.ms-fontWeight-semibold'%2C'h1'%2C'h2'%20%5D%3Bfor(var%20i%3D0%3Bi%20%3C%20subjectSelectors.length%3Bi%2B%2B)%7Bvar%20el%3Ddocument.querySelector(subjectSelectors%5Bi%5D)%3Bif(el%20%26%26%20el.textContent.trim()%26%26%20el.textContent.trim().length%20%3C%20300)%7Bvar%20candidate%3Del.textContent.trim()%3Bif(!candidate.match(%2F%5E(Eingang%7CPosteingang%7CInbox%7CGesendet%7CSent%7CEntw%C3%BCrfe%7CDrafts)%24%2Fi)%26%26%20!candidate.match(%2F%5E%5B%5Cd%5Cs.%3A%2C-%5D%2B%24%2F))%7Bdata.subject%3Dcandidate%3Bbreak%3B%7D%7D%7Dvar%20mailtoLinks%3Ddocument.querySelectorAll('a%5Bhref%5E%3D%22mailto%3A%22%5D')%3Bif(mailtoLinks.length%20%3E%200)%7Bvar%20firstMailto%3DmailtoLinks%5B0%5D%3Bdata.from%3DfirstMailto.href.replace('mailto%3A'%2C'').split('%3F')%5B0%5D%3Bvar%20nameMatch%3DfirstMailto.textContent.trim()%3Bif(nameMatch%20%26%26%20nameMatch%20!%3D%3Ddata.from)%7Bdata.fromName%3DnameMatch%3B%7D%7Dif(!data.fromName)%7Bvar%20nameSelectors%3D%5B%20'%5Bdata-testid%3D%22message-from%22%5D'%2C'.personaName'%2C'span.OZZZK'%2C'.sender'%2C'%23divSender'%2C'span.PlainText.from'%2C'.ItemPart_from'%2C'.from'%20%5D%3Bfor(var%20j%3D0%3Bj%20%3C%20nameSelectors.length%3Bj%2B%2B)%7Bvar%20nel%3Ddocument.querySelector(nameSelectors%5Bj%5D)%3Bif(nel%20%26%26%20nel.textContent.trim())%7Bdata.fromName%3Dnel.textContent.trim().substring(0%2C200)%3Bbreak%3B%7D%7D%7Dif(selection%20%26%26%20selection.length%20%3E%2030)%7Bdata.body%3Dselection%3B%7Delse%7Bvar%20bodySelectors%3D%5B%20'%5Brole%3D%22document%22%5D'%2C'div.PlainText'%2C'.allowTextSelection%20%5Baria-label%3D%22Nachrichtentext%22%5D'%2C'%5Baria-label%3D%22Message%20body%22%5D'%2C'div.rps_'%2C'.body'%2C'%23divBody'%2C'div.bodyContent'%2C'.ItemPart_body'%2C'div.readableContent'%2C'iframe'%20%5D%3Bfor(var%20k%3D0%3Bk%20%3C%20bodySelectors.length%3Bk%2B%2B)%7Bvar%20bel%3Ddocument.querySelector(bodySelectors%5Bk%5D)%3Bif(!bel)continue%3Bif(bel.tagName%3D%3D%3D'IFRAME')%7Btry%7Bvar%20iframeDoc%3Dbel.contentDocument%20%7C%7C%20bel.contentWindow.document%3Bif(iframeDoc%20%26%26%20iframeDoc.body)%7Bvar%20iframeText%3DiframeDoc.body.innerText%20%7C%7C%20iframeDoc.body.textContent%20%7C%7C%20''%3Bif(iframeText.trim().length%20%3E%2050)%7Bdata.body%3DiframeText.trim()%3Bbreak%3B%7D%7D%7Dcatch(e)%7B%7D%7Delse%7Bvar%20bodyText%3Dbel.innerText%20%7C%7C%20bel.textContent%20%7C%7C%20''%3Bif(bodyText.trim().length%20%3E%2050)%7Bdata.body%3DbodyText.trim()%3Bbreak%3B%7D%7D%7D%7Dif(data.body.length%20%3E%202000)%7Bdata.body%3Ddata.body.slice(0%2C2000)%2B%20'...'%3B%7Dvar%20now%3Dnew%20Date()%3Bdata.date%3Dnow.toISOString().slice(0%2C10)%3Breturn%20data%3B%7Dvar%20mail%3DextractMailData()%3Bvar%20hasUsefulData%3D(mail.subject%20%26%26%20mail.subject.length%20%3E%203)%7C%7C(mail.body%20%26%26%20mail.body.length%20%3E%2050)%3Bif(!hasUsefulData)%7Bwindow.open(PWA_URL%20%2B%20'%3Faction%3Dquickcapture'%2C'_blank')%3Breturn%3B%7Dvar%20params%3Dnew%20URLSearchParams()%3Bparams.set('action'%2C'mail')%3Bparams.set('subject'%2Cmail.subject)%3Bparams.set('from'%2Cmail.from)%3Bparams.set('fromName'%2Cmail.fromName)%3Bparams.set('body'%2Cmail.body)%3Bparams.set('date'%2Cmail.date)%3Bvar%20url%3DPWA_URL%20%2B%20'%3F'%20%2B%20params.toString()%3Bwindow.open(url%2C'_blank')%3B%7D)()%3B
```

⚠ **WICHTIG:** Falls deine GitHub-URL nicht `GW-BE` ist, ändere die Zeichenfolge `GW-BE` im obigen Code zu deinem GitHub-Username, bevor du speicherst.

### **Schritt 4: Test in Outlook Web**

1. Outlook öffnen
2. Eine E-Mail anklicken (Lesemodus)
3. Lesezeichen **"→ Vorgang"** klicken
4. **Falls Erkennung erfolgreich:** Neuer Tab → PWA mit vorausgefüllten Feldern
5. **Falls nicht erfolgreich:** Neuer Tab → PWA mit Quick-Capture Modal (du füllst manuell ein)

---

## **🎯 Workflow-Beispiele**

### **Szenario A: Bookmarklet erkennt Mail erfolgreich**

```
Outlook: "NOx-Sensor MHKW defekt - DRINGEND" 
       ↓
Klick: → Vorgang
       ↓
PWA Modal öffnet (vorausgefüllt):
✓ Thema, Anlage, Kategorie, Priorität erkannt
       ↓
Du tippst nur "Nächster Schritt" + Anlegen
       ↓
✓ Fertig in ~15 Sek
```

### **Szenario B: Bookmarklet erkennt nichts → Quick-Capture**

```
Outlook: Mail im älteren Exchange Web
       ↓
Klick: → Vorgang
       ↓
PWA: Quick-Capture Modal öffnet (leer)
       ↓
Du wechselst zu Outlook
       ↓
Strg+A + Strg+C im Mail-Body
       ↓
Zurück zur PWA: Klick "Aus Zwischenablage einfügen"
       ↓
Betreff eintippen → "Analysieren"
       ↓
Smart-Parser läuft → Modal mit erkannten Werten
       ↓
✓ Fertig in ~25 Sek
```

### **Szenario C: Folge-Mail zu bestehendem Vorgang**

```
Outlook: "RE: NOx-Sensor MHKW defekt" (Antwort der Firma)
       ↓
Klick: → Vorgang (oder PWA → "Aus Mail")
       ↓
PWA erkennt: 90% Match mit V-2026-043
       ↓
Dialog: "Ähnlicher Vorgang gefunden"
   [V-2026-043 — Klick zum Aktualisieren]
       ↓
Update-Modal mit Log + Status + WV + Nachweis
       ↓
"↻ Aktualisieren"
       ↓
✓ Mail an V-2026-043 angehängt
```

---

## **🐛 Troubleshooting**

### **Bookmarklet öffnet nichts**

- Browser-Console öffnen (`F12`)
- Prüfe ob Popups blockiert sind
- PWA-URL im Bookmarklet korrekt?

### **Mail-Daten werden nicht erkannt → Quick-Capture öffnet**

Das ist **normal und erwünscht** in deiner Situation. Das Bookmarklet kann die DOM-Struktur deiner älteren Exchange-Version nicht zuverlässig lesen, deshalb springt es auf den manuellen Weg um.

→ Alternative: Statt Bookmarklet einfach den **"📧 Aus Mail"** Button in der PWA nutzen.

### **Zwischenablage-Button funktioniert nicht**

Erste Verwendung erfordert Browser-Berechtigung:
- Chrome zeigt einen Dialog "Zwischenablage erlauben?"
- → **"Zulassen"** klicken
- Beim nächsten Mal funktioniert es automatisch

Falls Berechtigung nicht erscheint:
- Klick auf das Schloss-Symbol in der Adressleiste
- "Site-Einstellungen" → "Zwischenablage" → "Zulassen"

---

## **💡 Tipp: Lesezeichenleiste optimieren**

```
⭐ [📧 Exchange] [→ Vorgang] [🎯 Betriebs-PWA]
```

Drei Klicks für den kompletten Workflow.
