// ═══════════════════════════════════════════════
// BOOKMARKLET v2: OUTLOOK/EXCHANGE → PWA
// 
// Versucht zuerst DOM-Erkennung (modern + älter).
// Falls erfolglos: öffnet Quick-Capture Modal in der PWA.
// ═══════════════════════════════════════════════

(function() {
  // === KONFIGURATION ===
  // ⚠ Hier deine PWA-URL eintragen:
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
    // Probiert viele Selektoren — moderne und ältere Outlook/Exchange Versionen
    var subjectSelectors = [
      '[role="heading"][aria-level="2"]',
      '.allowTextSelection[role="heading"]',
      'div[data-testid="subjectLine"]',
      'span.PbsLE',
      'div.AbB7Wd',
      '.ms-font-xxl',
      '.subjectLineMain',
      '.subject',
      '#divSubject',
      'span.PlainText.subject',
      'div._cl_15',
      'div.readSubject',
      'div.ItemPart_subject',
      'span.ms-font-xl.ms-fontWeight-semibold',
      'h1', 'h2'
    ];
    
    for (var i = 0; i < subjectSelectors.length; i++) {
      var el = document.querySelector(subjectSelectors[i]);
      if (el && el.textContent.trim() && el.textContent.trim().length < 300) {
        var candidate = el.textContent.trim();
        if (!candidate.match(/^(Eingang|Posteingang|Inbox|Gesendet|Sent|Entwürfe|Drafts)$/i) &&
            !candidate.match(/^[\d\s.:,-]+$/)) {
          data.subject = candidate;
          break;
        }
      }
    }
    
    // === ABSENDER ===
    var mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
    if (mailtoLinks.length > 0) {
      var firstMailto = mailtoLinks[0];
      data.from = firstMailto.href.replace('mailto:', '').split('?')[0];
      var nameMatch = firstMailto.textContent.trim();
      if (nameMatch && nameMatch !== data.from) {
        data.fromName = nameMatch;
      }
    }
    
    if (!data.fromName) {
      var nameSelectors = [
        '[data-testid="message-from"]',
        '.personaName',
        'span.OZZZK',
        '.sender',
        '#divSender',
        'span.PlainText.from',
        '.ItemPart_from',
        '.from'
      ];
      for (var j = 0; j < nameSelectors.length; j++) {
        var nel = document.querySelector(nameSelectors[j]);
        if (nel && nel.textContent.trim()) {
          data.fromName = nel.textContent.trim().substring(0, 200);
          break;
        }
      }
    }
    
    // === BODY ===
    if (selection && selection.length > 30) {
      data.body = selection;
    } else {
      var bodySelectors = [
        '[role="document"]',
        'div.PlainText',
        '.allowTextSelection [aria-label="Nachrichtentext"]',
        '[aria-label="Message body"]',
        'div.rps_',
        '.body',
        '#divBody',
        'div.bodyContent',
        '.ItemPart_body',
        'div.readableContent',
        'iframe'
      ];
      
      for (var k = 0; k < bodySelectors.length; k++) {
        var bel = document.querySelector(bodySelectors[k]);
        if (!bel) continue;
        
        if (bel.tagName === 'IFRAME') {
          try {
            var iframeDoc = bel.contentDocument || bel.contentWindow.document;
            if (iframeDoc && iframeDoc.body) {
              var iframeText = iframeDoc.body.innerText || iframeDoc.body.textContent || '';
              if (iframeText.trim().length > 50) {
                data.body = iframeText.trim();
                break;
              }
            }
          } catch (e) {}
        } else {
          var bodyText = bel.innerText || bel.textContent || '';
          if (bodyText.trim().length > 50) {
            data.body = bodyText.trim();
            break;
          }
        }
      }
    }
    
    if (data.body.length > 2000) {
      data.body = data.body.slice(0, 2000) + '...';
    }
    
    var now = new Date();
    data.date = now.toISOString().slice(0, 10);
    
    return data;
  }
  
  // === HAUPT-LOGIK ===
  var mail = extractMailData();
  
  var hasUsefulData = (mail.subject && mail.subject.length > 3) ||
                       (mail.body && mail.body.length > 50);
  
  if (!hasUsefulData) {
    // Fallback: Quick-Capture Modal öffnen
    window.open(PWA_URL + '?action=quickcapture', '_blank');
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
  window.open(url, '_blank');
})();
