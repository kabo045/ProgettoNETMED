/*
  Banner minimal e non invasivo. Si mostra solo se l'utente non ha ancora dato consenso (localStorage "nm_cookies"). Una volta accettato, non riappare piu'.

  Nota: NETMED usa solo cookie tecnici necessari (JWT, tema, lingua). Il consenso non e' obbligatorio per legge, ma l'informativa si. Il bottone chiude l'informativa, ,on attiva ne' disattiva tracker.
  Tutto ciò e' stato fatto per una completezza del sito.
*/
(function () {
  if (typeof window === "undefined" || !window.document) return;

  // Ritorna la lingua corrente. Priorita': i18n.js) se gia' caricato, poi localStorage nm_lang, poi fallback IT.
  // Il try/catch serve per gli scenari privati/incognito dove localStorage puo' lanciare.
  function lang() {
    if (window.NMI18n && typeof window.NMI18n.getLang === "function") {
      return window.NMI18n.getLang();
    }
    try {
      var l = localStorage.getItem("nm_lang");
      if (l === "en" || l === "it") return l;
    } catch (_) {}
    return "it";
  }
  function getConsent() {
    try { return localStorage.getItem("nm_cookies"); } catch (_) { return null; }
  }
  function setConsent(value) {
    try { localStorage.setItem("nm_cookies", value); } catch (_) {}
  }

  // Crea e mostra il banner in fondo alla pagina: se il consenso gia o se il banner e gia nel DOM, esce subito.
  function inject() {
    if (getConsent()) return;
    if (document.getElementById("nmCookieBanner")) return;

    var L = lang() === "en"
      ? {
          title: "We respect your privacy",
          body: "NETMED uses only technical cookies needed for login and your preferences (theme, language). No tracking, no advertising.",
          accept: "OK, got it",
          link: "Read the privacy policy"
        }
      : {
          title: "Rispettiamo la tua privacy",
          body: "NETMED usa solo cookie tecnici necessari per il login e le tue preferenze (tema, lingua). Niente tracciamento, niente pubblicita'.",
          accept: "Ho capito",
          link: "Leggi la privacy policy"
        };

    var box = document.createElement("div");
    box.id = "nmCookieBanner";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-live", "polite");
    box.style.cssText = [
      "position:fixed",
      "left:16px",
      "right:16px",
      "bottom:16px",
      "max-width:560px",
      "margin:0 auto",
      "z-index:99999",
      "background:#161618",
      "color:#e8e8e8",
      "border:1px solid #2a3a32",
      "border-radius:14px",
      "padding:18px 22px",
      "box-shadow:0 20px 50px rgba(0,0,0,0.55)",
      "font-family:system-ui,-apple-system,'Segoe UI',Inter,sans-serif",
      "font-size:14px",
      "line-height:1.5",
      "opacity:0",
      "transform:translateY(20px)",
      "transition:opacity .25s ease, transform .25s ease"
    ].join(";") + ";";

    box.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
        '<span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:rgba(10,105,64,0.18);color:#4fd698">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M21.54 15a2 2 0 0 1-1.71 1A2 2 0 0 1 18 14a2 2 0 0 0-2-2 2 2 0 0 1-2-2 2 2 0 0 1 2-2 2 2 0 0 0 1.83-1.21A10 10 0 1 0 21.54 15z"/>' +
            '<circle cx="8" cy="13" r="1"/>' +
            '<circle cx="13" cy="9" r="1"/>' +
            '<circle cx="15" cy="15" r="1"/>' +
          '</svg>' +
        '</span>' +
        '<strong style="font-size:15px;letter-spacing:-0.2px">' + L.title + '</strong>' +
      '</div>' +
      '<p style="margin:0 0 14px;color:#c2c8cf">' + L.body + ' ' +
        '<a href="privacy.html" style="color:#4fd698;text-decoration:underline">' + L.link + '</a>.' +
      '</p>' +
      '<div style="text-align:right">' +
        '<button id="nmCookieAccept" type="button" style="' +
          'background:#0a6940;color:#fff;border:0;padding:9px 22px;border-radius:999px;' +
          'font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;' +
          'transition:background .15s">' +
          L.accept +
        '</button>' +
      '</div>';

    document.body.appendChild(box);

    requestAnimationFrame(function () {
      box.style.opacity = "1";
      box.style.transform = "translateY(0)";
    });

    var btn = document.getElementById("nmCookieAccept");
    if (btn) {
      btn.addEventListener("mouseover", function () { btn.style.background = "#0d8050"; });
      btn.addEventListener("mouseout",  function () { btn.style.background = "#0a6940"; });
      btn.addEventListener("click", function () {
        // Salvo il consenso, animo l'uscita e rimuovo il nodo.
        setConsent("accepted");
        box.style.opacity = "0";
        box.style.transform = "translateY(20px)";
        setTimeout(function () { box.remove(); }, 250);
      });
    }
  }
  if (document.documentElement.getAttribute("data-theme") === "light") {
    var styleEl = document.createElement("style");
    styleEl.textContent =
      '[data-theme="light"] #nmCookieBanner{' +
        'background:#ffffff !important;color:#1a1a1a !important;' +
        'border-color:#d4e5dc !important;' +
      '}' +
      '[data-theme="light"] #nmCookieBanner p{color:#555 !important;}';
    document.head.appendChild(styleEl);
  }

  // Delay di 1.2s
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(inject, 1200); });
  } else {
    setTimeout(inject, 1200);
  }
})();