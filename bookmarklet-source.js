// ═══════════════════════════════════════════════
// BOOKMARKLET: OUTLOOK WEB → PWA VORGANG
// 
// Liest die aktuell geöffnete E-Mail in Outlook Web aus
// und ruft die PWA mit URL-Parametern auf.
// ═══════════════════════════════════════════════

(function() {
  // === KONFIGURATION ===
  // Hier deine PWA-URL eintragen:
  var PWA_URL = 'https://GW-BE.github.io/kanban-betrieb/';
  
  // === MAIL-DATEN AUSLESEN ===
  function extractMailData() {
    var data = {
      subject: '',
      from: '',
      fromName: '',
      body: '',
      date: ''
    };
    
    // Strategie 1: Selektion (vom Nutzer markierter Text hat Priorität)
    var selection = window.getSelection().toString().trim();
    
    // === BETREFF ===
    // Outlook Web hat verschiedene DOM-Strukturen je nach Version
    var subjectSelectors = [
      '[role="heading"][aria-level="2"]',
      '.allowTextSelection[role="heading"]',
      'div[data-testid="subjectLine"]',
      'span.PbsLE',
      'div.AbB7Wd',
      '.ms-font-xxl'
    ];
    
    for (var i = 0; i < subjectSelectors.length; i++) {
      var el = document.querySelector(subjectSelectors[i]);
      if (el && el.textContent.trim()) {
        data.subject = el.textContent.trim();
        break;
      }
    }
    
    // === ABSENDER ===
    // E-Mail-Adresse aus mailto-Links extrahieren
    var fromEl = document.querySelector('a[href^="mailto:"]');
    if (fromEl) {
      data.from = fromEl.href.replace('mailto:', '').split('?')[0];
      // Name vor der Mail-Adresse?
      var nameMatch = fromEl.textContent.trim();
      if (nameMatch && nameMatch !== data.from) {
        data.fromName = nameMatch;
      }
    }
    
    // Fallback: Suche nach Absender-Anzeigename
    if (!data.fromName) {
      var nameSelectors = [
        '[data-testid="message-from"]',
        '.personaName',
        'span.OZZZK'
      ];
      for (var j = 0; j < nameSelectors.length; j++) {
        var nel = document.querySelector(nameSelectors[j]);
        if (nel && nel.textContent.trim()) {
          data.fromName = nel.textContent.trim();
          break;
        }
      }
    }
    
    // === BODY ===
    if (selection && selection.length > 20) {
      // Bevorzuge die Selektion wenn substantiell
      data.body = selection;
    } else {
      // Fallback: Vollständigen Mail-Body suchen
      var bodySelectors = [
        '[role="document"]',
        'div.PlainText',
        '.allowTextSelection [aria-label="Nachrichtentext"]',
        '[aria-label="Message body"]',
        'div.rps_'
      ];
      
      for (var k = 0; k < bodySelectors.length; k++) {
        var bel = document.querySelector(bodySelectors[k]);
        if (bel && bel.innerText && bel.innerText.length > 20) {
          data.body = bel.innerText.trim();
          break;
        }
      }
    }
    
    // Body kürzen (URL-Limit beachten)
    if (data.body.length > 2000) {
      data.body = data.body.slice(0, 2000) + '...';
    }
    
    // === DATUM ===
    // Heutiges Datum als Fallback (Mail-Datum aus DOM zu unzuverlässig)
    var now = new Date();
    data.date = now.toISOString().slice(0, 10);
    
    return data;
  }
  
  // === HAUPT-LOGIK ===
  var mail = extractMailData();
  
  if (!mail.subject && !mail.body) {
    alert(
      '⚠ Bookmarklet konnte keine Mail-Daten lesen.\n\n' +
      'Tipps:\n' +
      '1. Öffne eine E-Mail (Lesemodus)\n' +
      '2. Markiere den wichtigen Mail-Text\n' +
      '3. Klicke das Lesezeichen erneut\n\n' +
      'Falls das Problem bleibt: Mail manuell in die PWA übertragen.'
    );
    return;
  }
  
  // === URL ZUSAMMENBAUEN ===
  var params = new URLSearchParams();
  params.set('action', 'mail');
  params.set('subject', mail.subject);
  params.set('from', mail.from);
  params.set('fromName', mail.fromName);
  params.set('body', mail.body);
  params.set('date', mail.date);
  
  var url = PWA_URL + '?' + params.toString();
  
  // === IN NEUEM TAB ÖFFNEN ===
  window.open(url, '_blank');
})();
