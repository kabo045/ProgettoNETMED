// Service Worker per le push notifications.
// Un Service Worker e' uno script che gira in background, indipendente dalla
// pagina. Il browser lo tiene vivo per ricevere push dal server anche quando il sito e' chiuso.
// Flusso:
// 1) L'utente accetta le notifiche -> il browser registra questo file
// 2) Il server manda una push -> arriva qui nell'evento "push"
// 3) Mostro la notifica di sistema
// 4) Se l'utente ci clicca sopra -> evento "notificationclick" -> apro la URL

// Install: appena registrato, salto la fase di "waiting" cosi il nuovo SW
// diventa attivo subito senza aspettare la chiusura delle tab.
self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting());
});

// Activate: prendo il controllo di tutte le tab gia' aperte (senza
// clients.claim() il SW controlla solo le tab aperte DOPO la sua attivazione).
self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// Push arrivata dal server: parso il payload JSON e mostro la notifica.
// Se il payload non e' JSON valido fallback a titolo generico.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    // Payload non JSON: uso il testo grezzo come body.
    payload = { title: "NETMED", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "NETMED";
  const opts = {
    body: payload.body || "",
    icon: "/img/favicon.svg",
    badge: "/img/favicon.svg",
    // URL a cui portare l'utente al click (default: home).
    data: { url: payload.url || "/home.html" },
    // tag = notifiche con lo stesso tag si sostituiscono a vicenda
    // invece di accumularsi (utile per "hai N nuovi commenti").
    tag: payload.tag || "netmed-notify",
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/home.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // Cerco una tab gia' aperta sulla stessa URL.
      for (const w of wins) {
        if (w.url.includes(url) && "focus" in w) return w.focus();
      }
      // Nessuna tab trovata: apro una nuova.
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});