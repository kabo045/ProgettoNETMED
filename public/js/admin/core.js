// File comune del pannello admin.
// Contiene: costanti (API, colori), utility (formattatori, esc, trunc),
// wrapper fetch autenticato, sistema toast, gestione tema/dropdown,
// centro notifiche, MENU + sidebar, router pagine (nav), modale generica,
// paginazione, global search in header.
// Viene caricato per primo, gli altri admin_*.js dipendono da lui.

// Prefix di tutte le chiamate admin. Se cambio /api/admin -> /api/v2/admin
// non devo toccare gli altri file.
const API = "/api/admin";

// Palette usata per avatar iniziali, badge, bordi. Rotazione ciclica
const COLORS = ["#0d7a4d", "#1e9659", "#08562f", "#7fe8a8", "#34d27e", "#0a5230"];

// Colore fisso per categoria conosciuta.
const CAT_COL = {
  Fisioterapia: "#0d7a4d",
  Ortopedia: "#1e9659",
  Neurologia: "#08562f",
  Cardiologia: "#7fe8a8",
};

// Stato globale del pannello.
let currentPage = "dashboard";
let notifications = [];
let userInfo = { username: "Admin", email: "", role: "admin", avatar_url: null };

// Category color: fallback grigio se non nella mappa.
const cc = (n) => CAT_COL[n] || "#64748b";

// Format number: 12345 -> "12k", 1500 -> "1.5k", 999 -> "999".
// Serve per non stampare interi enormi nelle stats card.
const fn = (n) =>
  n >= 10000
    ? (n / 1000).toFixed(0) + "k"
    : n >= 1000
      ? (n / 1000).toFixed(1).replace(".0", "") + "k"
      : String(n);

// Formattatori data/ora locale italiano.
const fd = (d) =>
  new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
const fds = (d) => new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
const ft = (d) => new Date(d).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

// Escape HTML sicuro (previene XSS quando inietto stringhe utente in innerHTML).
// Sfrutto il fatto che textContent scrive e innerHTML rilegge escapato.
const esc = (s) => {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
};

// Tronca stringhe lunghe
const trunc = (s, n) => (s && s.length > n ? s.substring(0, n) + "…" : s || "");

// Skeleton loader: div grigio pulsante per placeholder durante fetch.
const sk = (w, h) => `<div class="sk" style="width:${w};height:${h}px"></div>`;

// Helper "mostra altri": rende una lista con i primi N visibili e il resto
// nascosto in un div che si apre al click. ID casuale se non passato.
function showMoreList(items, renderFn, limit = 5, containerId) {
  if (!items || !items.length) return "";
  const id = containerId || "sm_" + Math.random().toString(36).substr(2, 6);
  const visible = items.slice(0, limit).map(renderFn).join("");
  const hidden = items.slice(limit).map(renderFn).join("");
  const remaining = items.length - limit;
  if (remaining <= 0) return visible;
  return `${visible}
    <div id="${id}" style="display:none">${hidden}</div>
    <button onclick="document.getElementById('${id}').style.display='block';this.remove()"
      style="width:100%;padding:10px;background:none;border:1px dashed var(--border,#e2e8f0);border-radius:10px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:var(--t6,#0d7a4d);margin-top:8px;transition:all .2s"
      onmouseenter="this.style.background='var(--t0,#eafaf0)'"
      onmouseleave="this.style.background='none'">
      Mostra altri (${remaining}) ↓
    </button>`;
}

// Wrapper fetch autenticato per tutte le chiamate admin.
// - Attacca automaticamente Authorization: Bearer <jwt>
// - Se manca il token o  scaduto -> redirect a login
// - Errori HTTP -> throw con messaggio del server (se presente)
async function apiFetch(ep, opts = {}) {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const r = await fetch(API + ep, {
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    ...opts,
  });

  // 401 = token mancante/malformato, 403 = valido ma non admin
  if (r.status === 401 || r.status === 403) {
    doLogout();
    return;
  }
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `HTTP ${r.status}`);
  }
  return r.json();
}

// Sistema toast (notifiche in basso a destra).
function toast(msg, type = "ok") {
  const box = document.getElementById("toastBox");
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${type === "ok" ? "✓" : "✕"}</span> ${esc(msg)}`;
  box.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(120px)";
    t.style.transition = "all .3s";
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// Toggle tema dark/light. Persiste in localStorage.
function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  document.documentElement.setAttribute("data-theme", isDark ? "light" : "dark");
  localStorage.setItem("theme", isDark ? "light" : "dark");
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = isDark ? "D" : "L";
}

function loadTheme() {
  const t = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", t);
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = t === "dark" ? "L" : "D";
}

// Toggle del dropdown utente (in alto a destra). Chiudo anche il pannello
// notifiche cosi non ho due popup aperti contemporaneamente.
function toggleDD(e) {
  e.stopPropagation();
  document.getElementById("userDD").classList.toggle("open");
  document.getElementById("notifPanel").classList.remove("open");
}

function toggleNotif(e) {
  e.stopPropagation();
  document.getElementById("notifPanel").classList.toggle("open");
  document.getElementById("userDD").classList.remove("open");
}

// Click sul body chiude qualsiasi popup aperto.
document.addEventListener("click", () => {
  document.getElementById("userDD").classList.remove("open");
  document.getElementById("notifPanel").classList.remove("open");
});

function doLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

// Sidebar mobile: slide-in con overlay.
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sideOverlay").classList.toggle("open");
}

// Fetch notifiche. // ne creo di false nel caso di fallback.
function loadNotifications() {
  apiFetch("/notifications")
    .then((notifs) => {
      notifications = notifs || [];
      renderNotifications();
    })
    .catch(() => {
      apiFetch("/stats")
        .then((s) => {
          notifications = [];
          if (s.recent?.new_comments > 0)
            notifications.push({
              type: "new_comment",
              title: `${s.recent.new_comments} nuovi commenti`,
              message: "Questa settimana",
              is_read: false,
              created_at: new Date(),
            });
          if (s.recent?.new_users > 0)
            notifications.push({
              type: "new_user",
              title: `${s.recent.new_users} nuovi utenti`,
              message: "Questa settimana",
              is_read: false,
              created_at: new Date(),
            });
          renderNotifications();
        })
        .catch(() => {});
    });
}

function renderNotifications() {
  const list = document.getElementById("notifList");
  const count = document.getElementById("notifCount");
  const unread = notifications.filter((n) => !n.is_read).length;

  // Badge campanella header.
  if (unread > 0) {
    count.textContent = unread;
    count.style.display = "flex";
  } else {
    count.style.display = "none";
  }

  // Badge sulla voce sidebar "Notifiche" (se presente).
  const sideBadge = document.getElementById("sideNotifBadge");
  if (sideBadge) {
    if (unread > 0) {
      sideBadge.textContent = unread > 99 ? "99+" : String(unread);
      sideBadge.style.display = "inline-flex";
    } else {
      sideBadge.style.display = "none";
    }
  }

  if (!notifications.length) {
    list.innerHTML = '<div class="notif-empty">Nessuna notifica</div>';
    return;
  }

  // Mappe icone/colori per tipo notifica.
  const icons = {
    new_user: "◉",
    new_comment: "◫",
    new_video: "▶",
    ban: "!",
    info: "ℹ",
    error: "!",
  };
  const colors = {
    new_user: ["#2563eb", "#dbeafe"],
    new_comment: ["#e11d48", "#fef2f2"],
    new_video: ["#0d7a4d", "#eafaf0"],
    ban: ["#d97706", "#fef3c7"],
    info: ["#7c3aed", "#ede9fe"],
    error: ["#ef4444", "#fef2f2"],
  };

  // Limito a 15 per non riempire la finestra popup.
  list.innerHTML =
    notifications
      .slice(0, 15)
      .map((n) => {
        const [col, bg] = colors[n.type] || ["#64748b", "#f1f5f9"];
        return `<div class="notif-item ${n.is_read ? "" : "unread"}" style="position:relative">
      <div class="notif-icon" style="background:${bg};color:${col}">${icons[n.type] || ""}</div>
      <div style="flex:1">
        <div class="notif-text"><strong>${esc(n.title)}</strong></div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">${esc(n.message || "")}</div>
        <div class="notif-time">${fd(n.created_at)} ${ft(n.created_at)}</div>
      </div>
      <button onclick="event.stopPropagation();deleteNotif(${n.id})"
        style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--text3);padding:4px;border-radius:6px;transition:all .15s;flex-shrink:0"
        onmouseenter="this.style.color='#e11d48';this.style.background='#fef2f2'"
        onmouseleave="this.style.color='var(--text3)';this.style.background='none'"
        title="Elimina">✕</button>
    </div>`;
      })
      .join("") +
    `
    <div style="padding:12px 20px;border-top:1px solid var(--border);text-align:center">
      <button onclick="event.stopPropagation();deleteAllNotifs()"
        style="background:none;border:none;cursor:pointer;font-size:12px;font-weight:600;color:var(--rose);font-family:inherit;padding:4px 12px;border-radius:8px;transition:all .15s"
        onmouseenter="this.style.background='#fef2f2'"
        onmouseleave="this.style.background='none'">Cancella tutte</button>
    </div>`;
}

// "Segna tutte come lette" bottone nel pannello notifiche dell'header. Chiamato da admin_dashboard.html.
function clearNotifs(e) {
  e.stopPropagation();
  apiFetch("/notifications/read-all", { method: "PUT" })
    .then(() => {
      notifications.forEach((n) => (n.is_read = true));
      renderNotifications();
      toast("Notifiche segnate come lette");
    })
    .catch(() => {});
}

// Delete singola: aggiorno subito la UI (ottimistica) sia in caso di
// successo che di errore, cosi l'utente non vede la notifica riapparire.
function deleteNotif(id) {
  apiFetch(`/notifications/${id}`, { method: "DELETE" })
    .then(() => {
      notifications = notifications.filter((n) => n.id !== id);
      renderNotifications();
      toast("Notifica eliminata");
    })
    .catch(() => {
      notifications = notifications.filter((n) => n.id !== id);
      renderNotifications();
    });
}

// Elimina tutte le notifiche con conferma.
function deleteAllNotifs() {
  openModal(
    `<div class="mh"><h2 class="outfit">Elimina notifiche</h2><button class="mx" onclick="closeModal()">✕</button></div>
    <div class="mb"><div class="confirm">Eliminare tutte le notifiche?</div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal()">Annulla</button>
    <button class="btn btn-d" id="delAllNotBtn">Elimina tutte</button></div>`,
    "sm"
  );

  document.getElementById("delAllNotBtn").onclick = () => {
    apiFetch("/notifications", { method: "DELETE" })
      .then(() => {
        notifications = [];
        renderNotifications();
        toast("Tutte le notifiche eliminate");
        closeModal();
      })
      .catch(() => closeModal());
  };
}

// Carica dati utente admin. Prima leggo da localStorage per un render veloce,
// poi confermo dal server /me. Se il server dice che noon e' admin, logout.
function loadUserInfo() {
  const stored = localStorage.getItem("user");
  if (stored) {
    try {
      userInfo = JSON.parse(stored);
    } catch (e) {}
  }

  apiFetch("/me")
    .then((u) => {
      // Se un admin viene degradato a user mentre loggato, lo sbatto fuori.
      if (u.role !== "admin") {
        doLogout();
        return;
      }
      userInfo = u;
      localStorage.setItem("user", JSON.stringify(u));
      updateHeader();
    })
    .catch(() => {});

  updateHeader();
}

function updateHeader() {
  document.getElementById("hdrName").textContent = userInfo.username || "Admin";
  const av = document.getElementById("hdrAvatar");
  if (userInfo.avatar_url) av.innerHTML = `<img src="${userInfo.avatar_url}" alt="">`;
  else av.textContent = (userInfo.username || "A")[0].toUpperCase();
}

// Struttura del menu sidebar. `div: true` = separatore visivo.
// `href` = link esterno (pagine standalone). `key` = pagina SPA.
const MENU = [
  { key: "dashboard", label: "Dashboard", icon: "⬡" },
  { key: "videos", label: "Gestione video", icon: "▶" },
  { key: "categories", label: "Categorie", icon: "☰" },
  { key: "tags", label: "Tag", icon: "#" },
  { div: true },
  { key: "users", label: "Utenti", icon: "◉" },
  { key: "comments", label: "Commenti", icon: "◫" },
  { key: "reports", label: "Segnalazioni", icon: "⚑" },
  // Pagina dedicata (link esterno): richieste creator in attesa di verifica.
  {
    href: "admin_richieste.html",
    label: "Richieste creator",
    icon: "★",
    badgeId: "sideCreatorReqBadge",
  },
  { key: "analytics", label: "Analytics", icon: "▤" },
  { key: "audit", label: "Audit log", icon: "≡" },
  { div: true },
  { key: "profile", label: "Il mio profilo", icon: "☺" },
];

function renderSidebar() {
  document.getElementById("sidebar").innerHTML =
    `<div class="side-label">Menu</div>` +
    MENU.map((m) => {
      if (m.div) return '<div class="side-sep"></div>';
      if (m.href) {
        // Voce esterna: link reale con eventuale badge "numero richieste".
        const badge = m.badgeId
          ? `<span class="side-badge" id="${m.badgeId}" style="display:none"></span>`
          : "";
        return `<a class="side-link" href="${m.href}">
          <span class="ico">${m.icon}</span>${m.label}${badge}
        </a>`;
      }
      return `<button class="side-link ${currentPage === m.key ? "act" : ""}" onclick="nav('${m.key}')">
        <span class="ico">${m.icon}</span>${m.label}
      </button>`;
    }).join("") +
    `<div style="flex:1"></div>
     <button class="side-logout" onclick="doLogout()"><span class="ico">↗</span>Esci dall'account</button>`;

  // Aggiorno il badge "richieste creator in attesa" in modo non bloccante.
  refreshCreatorRequestsBadge();
}

// Recupera il numero di richieste creator in attesa e lo mostra come pallino
// accanto alla voce di menu.
async function refreshCreatorRequestsBadge() {
  const badge = document.getElementById("sideCreatorReqBadge");
  if (!badge) return;
  const token = localStorage.getItem("token");
  if (!token) return;
  try {
    const r = await fetch("/api/admin/creator-requests", {
      headers: { Authorization: "Bearer " + token },
    });
    if (!r.ok) return;
    const d = await r.json().catch(() => ({}));
    const n = (d && d.requests && d.requests.length) || 0;
    if (n > 0) {
      badge.textContent = n > 99 ? "99+" : String(n);
      badge.style.display = "inline-flex";
    } else {
      badge.style.display = "none";
    }
  } catch (_) {
    /* silente */
  }
}

// cambia pagina, aggiorna sidebar, monta breadcrumb + header
// + azioni contestuali, poi chiama la funzione page*() giusta.
function nav(page) {
  currentPage = page;
  renderSidebar();
  const m = document.getElementById("mainContent");
  m.innerHTML = "";

  // Su mobile la sidebar sta chiusa dopo la navigazione.
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sideOverlay").classList.remove("open");

  // Titolo + sottotitolo per ogni pagina.
  const titles = {
    dashboard: ["Dashboard", "Benvenuto! Ecco la panoramica della piattaforma"],
    videos: ["Gestione Video", "Aggiungi, modifica ed elimina i video"],
    categories: ["Categorie", "Gestisci le categorie dei video medici"],
    tags: ["Tag", "Organizza i video con tag"],
    users: ["Utenti", "Gestisci gli utenti registrati"],
    comments: ["Commenti", "Modera i commenti degli utenti"],
    reports: ["Segnalazioni", "Gestisci le segnalazioni degli utenti"],
    analytics: ["Analytics", "Statistiche dettagliate della piattaforma"],
    audit: ["Audit log", "Storico delle azioni amministrative"],
    profile: ["Il mio Profilo", "Gestisci le informazioni del tuo account"],
    videoDetail: ["", ""],
  };
  const [t, s] = titles[page] || ["", ""];

  // Bottone "+ Nuovo" in header nelle pagine che lo prevedono.
  const actions = {
    videos: '<button class="btn btn-p" onclick="openVideoModal()">+ Nuovo Video</button>',
    categories:
      "<button class=\"btn btn-p\" onclick=\"openCrudModal('/categories','Categoria')\">+ Nuova Categoria</button>",
    tags: "<button class=\"btn btn-p\" onclick=\"openCrudModal('/tags','Tag')\">+ Nuovo Tag</button>",
  };

  // La videoDetail non ha header perche gestita internamente.
  if (page !== "videoDetail") {
    m.innerHTML = `<div class="bc"><a onclick="nav('dashboard')">Home</a><span class="bc-sep">›</span>${t}</div>
      <div class="ph"><div><h1 class="pt outfit">${t}</h1><p class="ps">${s}</p></div>
      ${actions[page] ? `<div>${actions[page]}</div>` : ""}</div>
      <div id="pageContent"></div>`;
  } else {
    m.innerHTML = `<div id="pageContent"></div>`;
  }
  ({
    dashboard: pageDashboard,
    videos: pageVideos,
    categories: () => pageCrud("/categories", "Categoria", false),
    tags: () => pageCrud("/tags", "Tag", true),
    users: pageUsers,
    comments: pageComments,
    reports: pageReports,
    analytics: pageAnalytics,
    audit: pageAudit,
    profile: pageProfile,
    videoDetail: () => {},
  })[page]();
}

// Click sullo sfondo chiude, click sulla modale no.
function openModal(html, cls) {
  closeModal();  // se ce ne fosse una gia' aperta la chiudo
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.id = "modalBg";
  bg.onclick = (e) => {
    if (e.target === bg) closeModal();
  };
  bg.innerHTML = `<div class="modal${cls ? " " + cls : ""}">${html}</div>`;
  document.body.appendChild(bg);
}

function closeModal() {
  const m = document.getElementById("modalBg");
  if (m) m.remove();
}


// onPage(p) callback quando l'utente clicca un numero.
function renderPag(elId, pag, onPage) {
  const el = document.getElementById(elId);
  if (!el) return;

  if (pag.totalPages <= 1) {
    el.innerHTML = `<div class="pag"><span class="pag-info">${pag.total} totali</span><span></span></div>`;
    return;
  }

  const s = (pag.page - 1) * pag.limit + 1;
  const e = Math.min(pag.page * pag.limit, pag.total);

  let btns = `<button class="pag-btn" data-p="${pag.page - 1}" ${pag.page === 1 ? "disabled" : ""}>Prec</button>`;
  for (let i = 1; i <= pag.totalPages; i++) {
    if (i === 1 || i === pag.totalPages || (i >= pag.page - 1 && i <= pag.page + 1))
      btns += `<button class="pag-btn ${i === pag.page ? "act" : ""}" data-p="${i}">${i}</button>`;
    else if (i === pag.page - 2 || i === pag.page + 2)
      btns += `<span style="padding:6px;color:var(--text3)">…</span>`;
  }
  btns += `<button class="pag-btn" data-p="${pag.page + 1}" ${pag.page === pag.totalPages ? "disabled" : ""}>Succ →</button>`;

  el.innerHTML = `<div class="pag">
    <span class="pag-info">${s}–${e} di ${pag.total}</span>
    <div class="pag-btns">${btns}</div>
  </div>`;

  el.querySelectorAll(".pag-btn").forEach((b) =>
    b.addEventListener("click", () => {
      const p = parseInt(b.dataset.p);
      if (p >= 1 && p <= pag.totalPages) onPage(p);
    })
  );
}


// ricerca globale.
let gsTimer = null;

function initGlobalSearch() {
  const inp = document.getElementById("globalSearch");
  const box = document.getElementById("globalSearchResults");
  if (!inp || !box) return;

  inp.addEventListener("input", () => {
    const q = inp.value.trim();
    clearTimeout(gsTimer);
    if (!q) {
      box.classList.remove("open");
      box.innerHTML = "";
      return;
    }
    gsTimer = setTimeout(() => runGlobalSearch(q), 250);
  });

  // Riapre il pannello se c'e un risultato mostrato.
  inp.addEventListener("focus", () => {
    if (inp.value.trim() && box.innerHTML) box.classList.add("open");
  });

  // Click fuori chiude il pannello risultati.
  document.addEventListener("click", (e) => {
    if (!inp.contains(e.target) && !box.contains(e.target)) box.classList.remove("open");
  });
}

async function runGlobalSearch(q) {
  const box = document.getElementById("globalSearchResults");
  box.innerHTML = `<div class="hsr-empty">Ricerca in corso…</div>`;
  box.classList.add("open");

  try {
    const r = await apiFetch(`/search?q=${encodeURIComponent(q)}`);
    const total = (r.videos?.length || 0) + (r.users?.length || 0) + (r.comments?.length || 0);

    if (!total) {
      box.innerHTML = `<div class="hsr-empty">Nessun risultato per "${esc(q)}"</div>`;
      return;
    }

    // Raggruppo risultati per tipo: Video, Utenti, Commenti.
    let html = "";
    if (r.videos?.length) {
      html +=
        `<div class="hsr-group"><div class="hsr-title">Video</div>` +
        r.videos
          .map(
            (v) =>
              `<div class="hsr-item" onclick="gsGoVideo(${v.id})">▶ ${esc(trunc(v.title, 60))}<small>${esc(v.category || "")}</small></div>`
          )
          .join("") +
        `</div>`;
    }
    if (r.users?.length) {
      html +=
        `<div class="hsr-group"><div class="hsr-title">Utenti</div>` +
        r.users
          .map(
            (u) =>
              `<div class="hsr-item" onclick="gsGoUser(${u.id})">U ${esc(u.username)}<small>${esc(u.email)}</small></div>`
          )
          .join("") +
        `</div>`;
    }
    if (r.comments?.length) {
      html +=
        `<div class="hsr-group"><div class="hsr-title">Commenti</div>` +
        r.comments
          .map(
            (c) =>
              `<div class="hsr-item" onclick="nav('comments')">C ${esc(trunc(c.content, 80))}<small>${esc(c.username || "")}</small></div>`
          )
          .join("") +
        `</div>`;
    }
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = `<div class="hsr-empty">Errore ricerca: ${esc(e.message)}</div>`;
  }
}

// Navigazione dai risultati search: chiude il pannello e porta alla pagina giusta.
function gsGoVideo(id) {
  gsCloseSearch();
  if (typeof nav === "function") nav("videos");
}
function gsGoUser(id) {
  gsCloseSearch();
  if (typeof nav === "function") nav("users");
}
window.gsGoVideo = gsGoVideo;
window.gsGoUser = gsGoUser;

function gsCloseSearch() {
  const b = document.getElementById("globalSearchResults");
  if (b) b.classList.remove("open");
  const inp = document.getElementById("globalSearch");
  if (inp) inp.value = "";
}
window.gsCloseSearch = gsCloseSearch;