// core.js — modulo condiviso da tutte le pagine utente.
// Contiene:
//   - stato globale (NM.user, NM.token, NM.categories, NM.tags)
//   - wrapper api() con auth automatica via Authorization: Bearer
//   - toast, nmConfirm (rimpiazzi custom di alert/confirm nativi)
//   - helper: escapeHtml, timeAgo, formatViews, thumbUrl, T (i18n)
//   - rendering header: dropdown utente, campanellino notifiche,
//     nav categorie/tag/esplora, hamburger mobile
//   - polling notifiche unread ogni 60s
//   - bootstrap tema, lingua, auth cross-tab (evento 'storage')
// Ogni pagina include questo file come primo script.
(function () {
  try {
    window.alert = function (msg) {
      if (typeof toast === "function") toast(String(msg == null ? "" : msg), "info");
      else console.log("[NETMED alert]", msg);
    };
    window.confirm = function () { return false; };
  } catch (_) {}
})();

window.NM = window.NM || {};
// Helper i18n compatto: usa NMI18n se caricato
function T(key, fallback) {
  if (window.NMI18n && typeof NMI18n.t === "function") return NMI18n.t(key);
  return fallback != null ? fallback : key;
}
window.T = T;

NM.user = null; NM.token = null; NM.categories = []; NM.tags = [];

async function api(path, options) {
  options = options || {};
  const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  if (NM.token) headers["Authorization"] = "Bearer " + NM.token;
  let res;
  try {
    res = await fetch(path, { method: options.method || "GET", headers,
      body: options.body ? JSON.stringify(options.body) : undefined, signal: options.signal });
  } catch (e) {
    if (e && e.name === "AbortError") return { ok: false, status: 0, data: { error: "Annullato" } };
    return { ok: false, status: 0, data: { error: "Errore di rete" } };
  }
  let data = null;
  try { data = await res.json(); } catch (_) {}
  // Auto-logout solo se /api/auth/me ritorna 401: il backend dichiara che
  // il token non e' valido. Pulisco localStorage e aggiorno l'UI ma non
  // forzo un redirect: la pagina che ha fatto la richiesta gestira' il utente non loggato

  if (res.status === 401 && path === "/api/auth/me" && NM.token) {
    NM.token = null; NM.user = null;
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } catch (_) {}
    if (typeof renderHeaderUser === "function") renderHeaderUser();
  }
  return { ok: res.ok, status: res.status, data: data || {} };
}

function toast(message, type) {
  let box = document.getElementById("userToastBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "userToastBox";
    box.style.cssText = "position:fixed;top:80px;right:18px;z-index:99998;display:flex;flex-direction:column;gap:8px";
    document.body.appendChild(box);
  }
  const el = document.createElement("div");
  el.textContent = message;
  el.style.cssText = "background:" + (type === "err" ? "#a02828" : type === "info" ? "#1a3a5a" : "#0a6940") +
    ";color:#fff;padding:11px 18px;border-radius:10px;font-size:13.5px;font-weight:600;box-shadow:0 8px 20px rgba(0,0,0,.4);transition:all .3s;";
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(80px)"; }, 2700);
  setTimeout(() => el.remove(), 3100);
}

function nmConfirm(opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    document.querySelectorAll(".nm-confirm-bg").forEach(n => n.remove());
    const bg = document.createElement("div");
    bg.className = "nm-confirm-bg";
    bg.innerHTML = '<div class="nm-confirm-card"><h3 class="nm-confirm-title"></h3><p class="nm-confirm-msg"></p><div class="nm-confirm-actions"><button class="nm-confirm-btn nm-confirm-cancel"></button><button class="nm-confirm-btn nm-confirm-ok' + (opts.danger ? ' danger' : '') + '"></button></div></div>';
    bg.querySelector(".nm-confirm-title").textContent = opts.title || "Conferma";
    bg.querySelector(".nm-confirm-msg").textContent = opts.message || "Sei sicuro?";
    bg.querySelector(".nm-confirm-cancel").textContent = opts.cancelLabel || "Annulla";
    bg.querySelector(".nm-confirm-ok").textContent = opts.okLabel || "Conferma";
    document.body.appendChild(bg);
    function close(v) { bg.remove(); document.removeEventListener("keydown", onKey); resolve(v); }
    function onKey(e) { if (e.key === "Escape") close(false); if (e.key === "Enter") close(true); }
    bg.querySelector(".nm-confirm-cancel").onclick = () => close(false);
    bg.querySelector(".nm-confirm-ok").onclick = () => close(true);
    bg.onclick = (e) => { if (e.target === bg) close(false); };
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => bg.classList.add("open"));
  });
}
window.nmConfirm = nmConfirm;


function nmCopyLink(url) {
  url = url || window.location.href;
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(url).then(
      () => { toast(T("ui.share_copied", "Link copiato")); return true; },
      () => { return nmCopyLinkFallback(url); }
    );
  }
  return Promise.resolve(nmCopyLinkFallback(url));
}
function nmCopyLinkFallback(url) {
  try {
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.style.position = "fixed"; ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    toast(T("ui.share_copied", "Link copiato"));
    return true;
  } catch (_) {
    return false;
  }
}
window.nmCopyLink = nmCopyLink;



function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso); if (isNaN(d.getTime())) return "";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "ora";
  if (s < 3600) return Math.floor(s/60) + " min fa";
  if (s < 86400) return Math.floor(s/3600) + " ore fa";
  if (s < 2592000) return Math.floor(s/86400) + " giorni fa";
  return d.toLocaleDateString("it-IT");
}

// Genera un colore deterministico dall'username (hash semplice).
// Usato sugli avatar con sola iniziale, così utenti diversi si distinguono.
function nmAvatarColor(name) {
  if (!name) return "#0a6940";
  var palette = [
    "#0a6940", "#1565c0", "#7b1fa2", "#c62828",
    "#ef6c00", "#00838f", "#5d4037", "#283593"
  ];
  var h = 0;
  for (var i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(h) % palette.length];
}
window.nmAvatarColor = nmAvatarColor;

function verifiedTickHTML(isVerified, vp, size) {
  if (!isVerified) return "";
  const sz = size === "lg" ? 16 : 13;
  return '<svg viewBox="0 0 24 24" width="' + sz + '" height="' + sz + '" fill="#0a6940" title="Verificato"><path d="M12 2l2.4 2.5 3.4-.5 1 3.3 3.1 1.4-1.4 3.1.4 3.4-3.3 1L17 19l-3.4-.4L12 22l-2.4-3.4L6.2 19 4.7 15.7l-3.3-1 .5-3.4L.6 8.2l3.1-1.4 1-3.3L8 4z"/><path fill="#fff" d="M10.5 14.4 7.6 11.5l1.3-1.3 1.6 1.6 4.7-4.7 1.3 1.3z"/></svg>';
}

// Restituisce l'URL della thumbnail per un video. Preferisce il campo
// thumbnail_url salvato in DB (gia' calcolato dal backend al momento
// dell'upload), altrimenti ricade su YouTube mqdefault dall'youtube_id.
// Necessaria per non far crashare home / categorie / preferiti / ricerca /
// video durante il render delle card (ReferenceError altrimenti).
function thumbUrl(v) {
  if (!v) return "";
  if (v.thumbnail_url) return v.thumbnail_url;
  if (v.youtube_id) return "https://img.youtube.com/vi/" + encodeURIComponent(v.youtube_id) + "/mqdefault.jpg";
  return "";
}
window.thumbUrl = thumbUrl;

// Formatta un conteggio di visualizzazioni in formato compatto.
function formatViews(n) {
  n = parseInt(n, 10) || 0;
  if (n < 1) return "0 visualizzazioni";
  if (n === 1) return "1 visualizzazione";
  if (n < 1000) return n + " visualizzazioni";
  if (n < 1000000) return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(".", ",").replace(",0", "") + " mila visualizzazioni";
  return (n / 1000000).toFixed(1).replace(".", ",").replace(",0", "") + " mln visualizzazioni";
}
window.formatViews = formatViews;

function loadTheme() {
  const saved = localStorage.getItem("nm_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeIcon(saved);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") || "dark";
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("nm_theme", next); } catch (_) {}
  updateThemeIcon(next);
  if (typeof renderUserDropdownItems === "function") renderUserDropdownItems();
  if (window.NMI18n && typeof window.NMI18n.apply === "function") window.NMI18n.apply();
  if (typeof renderProfileForms === "function" && document.getElementById("upForms")) renderProfileForms();
}
function updateThemeIcon(theme) {
  const btn = document.getElementById("themeBtn");
  if (!btn) return;
  btn.innerHTML = theme === "light"
    ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>'
    : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}
window.toggleTheme = toggleTheme;

// Toggle lingua: chiamato dal dropdown utente (riga "Lingua  IT/EN").
// Inverte la lingua corrente, ri-applica le traduzioni e ri-renderizza
function toggleLang() {
  const cur = (window.NMI18n && window.NMI18n.getLang) ? window.NMI18n.getLang() : "it";
  const next = cur === "it" ? "en" : "it";
  if (window.NMI18n && typeof window.NMI18n.setLang === "function") {
    window.NMI18n.setLang(next);
  } else {
    try { localStorage.setItem("nm_lang", next); } catch (_) {}
  }
  if (typeof renderUserDropdownItems === "function") renderUserDropdownItems();
  if (typeof renderProfileForms === "function" && document.getElementById("upForms")) renderProfileForms();
  if (window.NMI18n && typeof window.NMI18n.apply === "function") window.NMI18n.apply();
}
window.toggleLang = toggleLang;

function loadAuth() {
  NM.token = localStorage.getItem("token") || null;
  try { NM.user = JSON.parse(localStorage.getItem("user") || "null"); } catch (_) { NM.user = null; }
  if (NM.user && NM.user.role === "banned") {
    localStorage.removeItem("token"); localStorage.removeItem("user");
    NM.token = null; NM.user = null;
    window.location.replace("login.html?suspended=1");
    return;
  }
}
async function refreshAuthMe() {
  if (!NM.token) return;
  const r = await api("/api/auth/me");
  if (r.ok && r.data && r.data.id) {
    NM.user = r.data;
    try { localStorage.setItem("user", JSON.stringify(r.data)); } catch (_) {}
    if (typeof renderHeaderUser === "function") renderHeaderUser();
  }
}
window.refreshAuthMe = refreshAuthMe;

function doLogout() {
  localStorage.removeItem("token"); localStorage.removeItem("user");
  NM.token = null; NM.user = null;
  window.location.href = "login.html";
}
window.doLogout = doLogout;

function goTo(p) { window.location.href = p; }
function goLogin() { window.location.href = "login.html"; }
function goProfile() { window.location.href = "profilo.html"; }
function goCreator() { window.location.href = "creator.html"; }
function goAdmin() { window.location.href = "admin_dashboard.html"; }
function goFavorites() { window.location.href = "preferiti.html"; }
function goVideo(id) { window.location.href = "video.html?id=" + encodeURIComponent(id); }
function goCategory(id) { window.location.href = "categoria.html?id=" + encodeURIComponent(id); }
function goTag(name) { if (!name) return; window.location.href = "search.html?tag=" + encodeURIComponent(name); }
function goCreatorPublic(u) { if (!u) return; window.location.href = "creator-public.html?u=" + encodeURIComponent(u); }
window.goTo = goTo; window.goLogin = goLogin; window.goProfile = goProfile;
window.goCreator = goCreator; window.goAdmin = goAdmin; window.goFavorites = goFavorites;
window.goVideo = goVideo; window.goCategory = goCategory; window.goTag = goTag;
window.goCreatorPublic = goCreatorPublic;

function renderHeaderUser() {
  ensureHamburger();
  const guest = document.getElementById("uhGuest");
  const userBox = document.getElementById("uhUser");
  if (!guest || !userBox) return;
  if (!NM.user) { guest.style.display = "inline-flex"; userBox.style.display = "none"; return; }
  guest.style.display = "none";
  userBox.style.display = "flex";
  const initial = (NM.user.username || "U").charAt(0).toUpperCase();
  const av = NM.user.avatar_url;
  function paintAv(el) {
    if (!el) return;
    if (av) el.innerHTML = '<img src="' + av + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>';
    else el.textContent = initial;
  }
  paintAv(document.getElementById("uhAvatar"));
  paintAv(document.getElementById("uhDdAvatar"));
  const isVerified = !!NM.user.is_verified;
  const tickI = verifiedTickHTML(isVerified, NM.user.verified_profile);
  const tickL = verifiedTickHTML(isVerified, NM.user.verified_profile, "lg");
  const un = escapeHtml(NM.user.username || "Utente");
  const sep = isVerified ? " " : "";
  const u1 = document.getElementById("uhUname");
  const u2 = document.getElementById("uhDdName");
  if (u1) u1.innerHTML = un + sep + tickI;
  if (u2) u2.innerHTML = un + sep + tickL;
  const em = document.getElementById("uhDdEmail");
  if (em) em.textContent = NM.user.email || "";
  renderUserDropdownItems();
  ensureNotifBell();
  ensureUploadFab();
}
window.renderHeaderUser = renderHeaderUser;

function renderUserDropdownItems() {
  const dd = document.getElementById("uhDd");
  if (!dd || !NM.user) return;
  const isAdmin = NM.user.role === "admin";
  const isVer = !!NM.user.is_verified && !isAdmin;
  const lang = (window.NMI18n && window.NMI18n.getLang) ? window.NMI18n.getLang() : "it";
  const L = lang === "en"
    ? { profile:"My profile", saved:"Saved", comments:"My comments", history:"History", myvids:"My videos", admin:"Admin", theme:"Theme", dark:"Dark", light:"Light", language:"Language", logout:"Sign out" }
    : { profile:"Il mio profilo", saved:"Salvati", comments:"I miei commenti", history:"Cronologia", myvids:"I miei video", admin:"Dashboard admin", theme:"Tema", dark:"Scuro", light:"Chiaro", language:"Lingua", logout:"Esci" };
  const head = dd.querySelector(".uh-dd-head");
  Array.from(dd.children).forEach(c => { if (c !== head) c.remove(); });
  if (!head) return;
  const cur = (document.documentElement.getAttribute("data-theme") === "light") ? "light" : "dark";
  const themeLbl = cur === "light" ? L.light : L.dark;
  let h = "";
  h += '<div class="uh-dd-item" role="menuitem" onclick="goProfile()">' + L.profile + '</div>';
  h += '<div class="uh-dd-item" role="menuitem" onclick="goFavorites()">' + L.saved + '</div>';
  h += '<div class="uh-dd-item" role="menuitem" onclick="goTo(\'miei-commenti.html\')">' + L.comments + '</div>';
  h += '<div class="uh-dd-item" role="menuitem" onclick="goTo(\'cronologia.html\')">' + L.history + '</div>';
  if (isVer) h += '<div class="uh-dd-item" role="menuitem" onclick="goCreator()">' + L.myvids + '</div>';
  if (isAdmin) h += '<div class="uh-dd-item" role="menuitem" onclick="goAdmin()">' + L.admin + '</div>';
  h += '<div class="uh-dd-sep"></div>';
  h += '<div class="uh-dd-item uh-dd-toggle" id="uhDdThemeItem" role="menuitem" onclick="event.stopPropagation();toggleTheme()"><span>' + L.theme + '</span><span class="uh-dd-val" id="uhDdThemeVal">' + themeLbl + '</span></div>';
  h += '<div class="uh-dd-item uh-dd-toggle" id="uhDdLangItem" role="menuitem" onclick="event.stopPropagation();toggleLang()"><span>' + L.language + '</span><span class="uh-dd-val" id="uhDdLangVal">' + (lang === "en" ? "EN" : "IT") + '</span></div>';
  h += '<div class="uh-dd-sep"></div>';
  h += '<div class="uh-dd-item danger" role="menuitem" onclick="doLogout()">' + L.logout + '</div>';
  head.insertAdjacentHTML("afterend", h);
}
window.renderUserDropdownItems = renderUserDropdownItems;

function renderHeaderNav(active) {
  const nav = document.getElementById("uhNav");
  if (!nav) return;
  const cats = Array.isArray(NM.categories) ? NM.categories : [];
  const tags = Array.isArray(NM.tags) ? NM.tags : [];
  const lang = (window.NMI18n && window.NMI18n.getLang) ? window.NMI18n.getLang() : "it";
  const L = lang === "en"
    ? { home:"Home", cats:"Categories", tags:"Tags", explore:"Explore", popular:"Most viewed", useful:"Most useful", recent:"Recent", subs:"Subscriptions", allCats:"All categories", allTags:"All tags" }
    : { home:"Home", cats:"Categorie", tags:"Tag", explore:"Esplora", popular:"Più visti", useful:"Più utili", recent:"Recenti", subs:"Iscrizioni", allCats:"Tutte le categorie", allTags:"Tutti i tag" };
  const sortedCats = cats.slice().sort((a,b) => String(a.name).localeCompare(String(b.name), "it"));
  const CAT_MAX = 5;
  let catItems = sortedCats.length
    ? sortedCats.slice(0, CAT_MAX).map(c =>
        '<button class="uh-mnu-item' + (active === "categoria:" + c.id ? " active" : "") + '" type="button" onclick="goCategory(' + c.id + ')"><span class="uh-mnu-dot"></span><span class="uh-mnu-label">' + escapeHtml(c.name) + '</span></button>'
      ).join("") + (sortedCats.length > CAT_MAX ? '<div class="uh-mnu-sep"></div><button class="uh-mnu-item uh-mnu-all" onclick="goTo(\'search.html?view=categories\')"><span class="uh-mnu-ico">→</span><span class="uh-mnu-label">Vedi tutte le categorie</span></button>' : "")
    : '<div class="uh-mnu-empty">Nessuna categoria</div>';
  const byPop = tags.slice().sort((a,b) => (b.video_count||0) - (a.video_count||0));
  const byRec = tags.slice().sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  const seen = new Set(); const mix = [];
  byPop.slice(0,3).forEach(t => { if (!seen.has(t.id)) { mix.push(t); seen.add(t.id); } });
  byRec.slice(0,2).forEach(t => { if (!seen.has(t.id)) { mix.push(t); seen.add(t.id); } });
  const TAG_MAX = 5;
  let tagItems = mix.length
    ? mix.slice(0, TAG_MAX).map(t => {
        const sf = String(t.name).replace(/'/g, "\\'");
        return '<button class="uh-mnu-item" type="button" onclick="goTag(\'' + sf + '\')"><span class="uh-mnu-ico">#</span><span class="uh-mnu-label">' + escapeHtml(t.name) + '</span>' + (t.video_count ? '<span class="uh-mnu-count">' + t.video_count + '</span>' : '') + '</button>';
      }).join("") + (tags.length > TAG_MAX ? '<div class="uh-mnu-sep"></div><button class="uh-mnu-item uh-mnu-all" onclick="goTo(\'search.html?view=tags\')"><span class="uh-mnu-ico">→</span><span class="uh-mnu-label">Vedi tutti i tag</span></button>' : "")
    : '<div class="uh-mnu-empty">Nessun tag</div>';
  const iscr = NM.user
    ? '<button class="uh-mnu-item" onclick="goTo(\'iscrizioni.html\')"><span class="uh-mnu-ico">▶</span><span class="uh-mnu-label">' + L.subs + '</span></button><div class="uh-mnu-sep"></div>'
    : '';
  const exp = iscr +
    '<button class="uh-mnu-item" onclick="goTo(\'search.html?sort=views\')"><span class="uh-mnu-ico">★</span><span class="uh-mnu-label">' + L.popular + '</span></button>' +
    '<button class="uh-mnu-item" onclick="goTo(\'search.html?sort=useful\')"><span class="uh-mnu-ico">▲</span><span class="uh-mnu-label">' + (L.useful || "Piu' utili") + '</span></button>' +
    '<button class="uh-mnu-item" onclick="goTo(\'search.html?sort=recent\')"><span class="uh-mnu-ico">⧗</span><span class="uh-mnu-label">' + L.recent + '</span></button>';
  nav.innerHTML =
    '<button class="uh-nav-link' + (active === "home" ? " active" : "") + '" onclick="goTo(\'home.html\')">' + L.home + '</button>' +
    '<div class="uh-mnu" data-mnu="cats"><button class="uh-nav-link uh-mnu-trigger" type="button" onclick="toggleHeaderMnu(event,\'cats\')">' + L.cats + ' <span class="uh-mnu-caret">▾</span></button><div class="uh-mnu-pop" onclick="event.stopPropagation()">' + catItems + '</div></div>' +
    '<div class="uh-mnu" data-mnu="tags"><button class="uh-nav-link uh-mnu-trigger" type="button" onclick="toggleHeaderMnu(event,\'tags\')">' + L.tags + ' <span class="uh-mnu-caret">▾</span></button><div class="uh-mnu-pop" onclick="event.stopPropagation()">' + tagItems + '</div></div>' +
    '<div class="uh-mnu" data-mnu="explore"><button class="uh-nav-link uh-mnu-trigger" type="button" onclick="toggleHeaderMnu(event,\'explore\')">' + L.explore + ' <span class="uh-mnu-caret">▾</span></button><div class="uh-mnu-pop" onclick="event.stopPropagation()">' + exp + '</div></div>';
}
window.renderHeaderNav = renderHeaderNav;

function toggleHeaderMnu(ev, key) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  const nav = document.getElementById("uhNav"); if (!nav) return;
  if (typeof nmCloseAllHeaderPanels === "function") nmCloseAllHeaderPanels("nav");
  let opened = false;
  nav.querySelectorAll(".uh-mnu").forEach(m => {
    const isMe = m.dataset.mnu === key;
    const pop = m.querySelector(".uh-mnu-pop");
    if (isMe && !m.classList.contains("open")) {
      m.classList.add("open");
      if (pop) {
        const trg = m.querySelector(".uh-mnu-trigger");
        const r = trg ? trg.getBoundingClientRect() : { bottom: 60, left: 100 };
        pop.style.cssText = "display:block !important;opacity:1 !important;visibility:visible !important;position:fixed !important;top:" + (r.bottom + 8) + "px !important;left:" + r.left + "px !important;z-index:99999 !important;min-width:260px !important;max-height:70vh !important;overflow-y:auto !important;background:var(--bg-2,#1a1a1c) !important;border:1px solid var(--border,#333) !important;border-radius:14px !important;padding:8px !important;box-shadow:0 16px 40px rgba(0,0,0,.55) !important;";
      }
      opened = true;
    } else {
      m.classList.remove("open");
      if (pop) pop.style.cssText = "";
    }
  });
  if (opened && !window.__uhMnuBound) {
    document.addEventListener("click", closeAllHeaderMnu);
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeAllHeaderMnu(); });
    window.__uhMnuBound = true;
  }
}
function closeAllHeaderMnu() {
  const nav = document.getElementById("uhNav"); if (!nav) return;
  nav.querySelectorAll(".uh-mnu.open").forEach(m => {
    m.classList.remove("open");
    const pop = m.querySelector(".uh-mnu-pop");
    if (pop) pop.style.cssText = "";
  });
}
window.toggleHeaderMnu = toggleHeaderMnu;
window.closeAllHeaderMnu = closeAllHeaderMnu;

function toggleUserDD(ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  const dd = document.getElementById("uhDd");
  if (!dd) return;
  if (typeof nmCloseAllHeaderPanels === "function") nmCloseAllHeaderPanels("user");
  dd.classList.toggle("open");
}
function closeUserDD() {
  const dd = document.getElementById("uhDd"); if (dd) dd.classList.remove("open");
}
window.toggleUserDD = toggleUserDD;
window.closeUserDD = closeUserDD;
document.addEventListener("click", e => {
  const dd = document.getElementById("uhDd");
  const wrap = document.getElementById("uhUser");
  if (dd && dd.classList.contains("open") && wrap && !wrap.contains(e.target)) dd.classList.remove("open");
});

function nmCloseAllHeaderPanels(except) {
  if (except !== "user") { const u = document.getElementById("uhDd"); if (u) u.classList.remove("open"); }
  if (except !== "notif") {
    const n = document.getElementById("uhNotifDd");
    if (n && !n.hidden) { n.hidden = true; if (typeof NotifState !== "undefined") NotifState.open = false; }
  }
  if (except !== "nav") closeAllHeaderMnu();
}
window.nmCloseAllHeaderPanels = nmCloseAllHeaderPanels;

async function loadHeaderCategories() {
  try {
    const r = await api("/api/user/categories");
    if (!r.ok) return;
    NM.categories = Array.isArray(r.data) ? r.data : (r.data && Array.isArray(r.data.categories)) ? r.data.categories : [];
    if (typeof renderHeaderNav === "function") renderHeaderNav();
  } catch (_) {}
}
async function loadHeaderTags() {
  try {
    const r = await api("/api/user/tags?limit=200");
    if (!r.ok || !r.data) return;
    NM.tags = Array.isArray(r.data.tags) ? r.data.tags : Array.isArray(r.data) ? r.data : [];
  } catch (_) {}
}
window.loadHeaderCategories = loadHeaderCategories;
window.loadHeaderTags = loadHeaderTags;

window.nmBootstrapHeaderNav = async function (activeKey) {
  try {
    if (!document.getElementById("uhNav")) return;
    const [cr, tr] = await Promise.all([
      api("/api/user/categories").catch(() => ({ ok: false })),
      api("/api/user/tags?limit=200").catch(() => ({ ok: false }))
    ]);
    if (cr && cr.ok) {
      const cd = cr.data;
      NM.categories = Array.isArray(cd) ? cd : (cd && Array.isArray(cd.categories)) ? cd.categories : NM.categories;
    }
    if (tr && tr.ok) {
      const td = tr.data;
      NM.tags = (td && Array.isArray(td.tags)) ? td.tags : Array.isArray(td) ? td : NM.tags;
    }
    renderHeaderNav(activeKey || null);
  } catch (e) { console.warn("[nmBootstrapHeaderNav]", e.message); }
};

const NotifState = { unread: 0, open: false, items: [], pollTimer: null };
const NM_NSEL = new Set();

function ensureNotifBell() {
  if (!NM.user) return;
  if (document.getElementById("uhBell")) return;
  const userBox = document.getElementById("uhUser"); if (!userBox) return;
  const btn = document.createElement("button");
  btn.id = "uhBell"; btn.type = "button"; btn.className = "uh-icon-btn uh-bell";
  btn.title = "Notifiche"; btn.setAttribute("aria-label", "Notifiche");
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span class="uh-bell-badge" id="uhBellBadge" style="display:none">0</span>';
  btn.onclick = (e) => toggleNotifDD(e);
  userBox.parentNode.insertBefore(btn, userBox);
  const dd = document.createElement("div");
  dd.id = "uhNotifDd"; dd.className = "uh-notif-dd"; dd.hidden = true;
  dd.onclick = (e) => e.stopPropagation();
  dd.innerHTML = '<div class="uh-notif-head"><strong>Notifiche</strong><div class="uh-notif-head-actions"><button type="button" class="uh-notif-selall" onclick="notifSelectAll(event)">Tutte</button><button type="button" class="uh-notif-readall" onclick="notifReadAll()">Segna lette</button><button type="button" class="uh-notif-seldel" id="uhNotifSelDel" onclick="notifSelDelete()" hidden>Cancella selezionate</button><button type="button" class="uh-notif-clear" onclick="notifClearAll()">Pulisci</button></div></div><div class="uh-notif-list" id="uhNotifList"><div class="uh-notif-empty">Caricamento…</div></div>';
  btn.parentNode.appendChild(dd);
  document.addEventListener("click", () => {
    if (NotifState.open) {
      const e = document.getElementById("uhNotifDd"); if (e) e.hidden = true;
      NotifState.open = false;
    }
  });
  notifPollUnread();
  if (NotifState.pollTimer) clearInterval(NotifState.pollTimer);
  NotifState.pollTimer = setInterval(notifPollUnread, 60000);
}
async function notifPollUnread() {
  if (!NM.token) return;
  try {
    const r = await api("/api/user/me/notifications/unread-count");
    if (!r.ok) return;
    // Backend ritorna { count: N }. Vecchio shape usava { unread: N }. Supporto entrambi.
    NotifState.unread = (r.data && (r.data.count != null ? r.data.count : r.data.unread)) | 0;
    const b = document.getElementById("uhBellBadge");
    if (b) { b.textContent = NotifState.unread > 99 ? "99+" : String(NotifState.unread); b.style.display = NotifState.unread > 0 ? "flex" : "none"; }
  } catch (_) {}
}
async function toggleNotifDD(ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  const dd = document.getElementById("uhNotifDd"); if (!dd) return;
  nmCloseAllHeaderPanels("notif");
  if (dd.hidden) { dd.hidden = false; NotifState.open = true; await notifLoadList(); }
  else { dd.hidden = true; NotifState.open = false; }
}
window.toggleNotifDD = toggleNotifDD;

// Mappa type -> (title, body) leggendo dal payload JSON.
// Il backend salva ogni notifica come { id, type, payload, link, read_at, ... }
// dove `payload` contiene i dati specifici (actor_name, video_title, message...).
function notifFormat(n) {
  const p = (n && n.payload && typeof n.payload === "object") ? n.payload : {};
  const actor = p.actor_name || p.actor_username || p.username || "";
  const vTitle = p.video_title || "";
  const snippet = p.snippet || p.message || p.body || "";
  switch (n.type) {
    case "new_follower":
      // payload nuovo: { follower_id, follower_username }
      var fName = p.follower_username || actor;
      return { title: "Nuovo iscritto", body: (fName ? fName + " " : "") + "si è iscritto al tuo canale" };
    case "new_comment":
      // payload: { video_id, video_title, comment_id, author_id, author_username, preview }
      var aName = p.author_username || actor;
      var preview = p.preview || snippet;
      return { title: "Nuovo commento", body: (aName ? aName + ": " : "") + (preview || (p.video_title ? "ha commentato \"" + p.video_title + "\"" : "")) };
    case "comment_on_video":
      return { title: "Nuovo commento", body: (actor ? actor + ": " : "") + (snippet || (vTitle ? "ha commentato \"" + vTitle + "\"" : "")) };
    case "reply_to_comment":
      // payload nuovo: { video_id, comment_id, parent_comment_id, actor_username, snippet }
      var rName = p.actor_username || actor;
      return { title: "Risposta al tuo commento", body: (rName ? rName + ": " : "") + (snippet || "") };
    case "welcome":
      // payload: { title, message, username }
      return { title: p.title || "Benvenuto su NETMED!", body: p.message || "Grazie per esserti iscritto. Esplora i video e iscriviti ai creator che ti interessano." };
    case "verified_granted":
      return { title: "Profilo verificato!", body: "Il tuo account è ora verificato come creator NETMED." };
    case "verified_rejected":
      return { title: "Richiesta verifica rifiutata", body: p.reason || "L'amministratore ha rifiutato la tua richiesta." };
    case "video_flagged_admin":
      return { title: "Video bloccato", body: "Il tuo video " + (vTitle ? "\"" + vTitle + "\" " : "") + "è stato bloccato dall'admin." };
    case "video_unflagged_admin":
      return { title: "Video sbloccato", body: "Il tuo video " + (vTitle ? "\"" + vTitle + "\" " : "") + "è di nuovo visibile." };
    case "creator_request":
      return { title: "Nuova richiesta creator", body: (p.requested_username ? p.requested_username + ": " : "") + (p.title || p.qualifica || "richiesta verifica") };
    case "like_on_video":
      return { title: "Nuovo mi piace", body: (actor ? actor + " ha apprezzato " : "Qualcuno ha apprezzato ") + (vTitle ? "\"" + vTitle + "\"" : "il tuo video") };
    case "video_useful":
      return { title: "Video utile", body: (actor ? actor + " " : "") + "ha trovato utile " + (vTitle ? "\"" + vTitle + "\"" : "il tuo video") };
    case "verified_revoked":
      return { title: "Verifica revocata", body: "Un amministratore ha revocato il tuo status di creator verificato." };
    case "video_deleted_admin":
      return { title: "Video rimosso", body: "Il tuo video " + (vTitle ? "\"" + vTitle + "\" " : "") + "e' stato rimosso dall'amministrazione." };
    case "video_reported":
      return { title: "Video segnalato", body: "Il tuo video " + (vTitle ? "\"" + vTitle + "\" " : "") + "e' stato segnalato. L'admin lo valutera'." };
    case "report_resolved":
      return { title: "Segnalazione risolta", body: "La tua segnalazione " + (vTitle ? "su \"" + vTitle + "\" " : "") + "e' stata gestita." };
    default:
      return { title: p.title || "Notifica", body: snippet || (p.message ? String(p.message) : "Hai una nuova notifica.") };
  }
}
window.notifFormat = notifFormat;

async function notifLoadList() {
  const list = document.getElementById("uhNotifList"); if (!list) return;
  list.innerHTML = '<div class="uh-notif-empty">Caricamento…</div>';
  const r = await api("/api/user/me/notifications?limit=20");
  if (!r.ok) { list.innerHTML = '<div class="uh-notif-empty">Errore</div>'; return; }
  // Compat: il backend /me/notifications ritorna array DIRETTO
  const items = Array.isArray(r.data) ? r.data
              : ((r.data && r.data.notifications) || (r.data && r.data.items) || []);
  NotifState.items = items;
  if (!items.length) { list.innerHTML = '<div class="uh-notif-empty">Nessuna notifica</div>'; return; }
  list.innerHTML = items.map(function (n) {
    const f = notifFormat(n);
    const unread = !n.read_at;
    const target = n.link || (n.target_video_id ? "video.html?id=" + n.target_video_id : "");
    // Layout YouTube-style: [checkbox] [content column = title/text/time]
    // CSS gia' presente (.uh-notif-item grid 20px|1fr, .uh-notif-content stack).
    return '<div class="uh-notif-item' + (unread ? " unread" : "") + '" data-id="' + n.id + '">' +
      '<label class="uh-notif-sel" onclick="event.stopPropagation()">' +
        '<input type="checkbox" class="uh-notif-cb" value="' + n.id + '" onclick="notifSelToggle(' + n.id + ',event)"/>' +
      '</label>' +
      '<div class="uh-notif-body" onclick="notifClick(' + n.id + ',\'' + String(target).replace(/'/g, "\\'") + '\')">' +
        '<div class="uh-notif-content">' +
          '<div class="uh-notif-title">' + escapeHtml(f.title) + '</div>' +
          '<div class="uh-notif-text">' + escapeHtml(f.body) + '</div>' +
          '<div class="uh-notif-time">' + timeAgo(n.created_at) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join("");
}
async function notifClick(id, link) {
  if (id) { try { await api("/api/user/me/notifications/" + id + "/read", { method: "PUT" }); } catch (_) {} }
  if (link) window.location.href = link;
}
async function notifReadAll() { await api("/api/user/me/notifications/read-all", { method: "PUT" }); notifPollUnread(); notifLoadList(); }
async function notifClearAll() {
  const ok = await nmConfirm({ title: "Pulisci tutte?", danger: true }); if (!ok) return;
  await api("/api/user/me/notifications", { method: "DELETE" });
  NM_NSEL.clear(); notifPollUnread(); notifLoadList();
}
function notifUpdateSelDelBtn() {
  const b = document.getElementById("uhNotifSelDel");
  if (!b) return;
  if (NM_NSEL.size > 0) {
    b.hidden = false;
    b.textContent = "Cancella " + NM_NSEL.size;
  } else {
    b.hidden = true;
  }
}
function notifSelToggle(id, ev) {
  if (ev) ev.stopPropagation();
  if (NM_NSEL.has(id)) NM_NSEL.delete(id);
  else NM_NSEL.add(id);
  notifUpdateSelDelBtn();
}
function notifSelClear() {
  NM_NSEL.clear();
  document.querySelectorAll(".uh-notif-cb:checked").forEach(cb => cb.checked = false);
  notifUpdateSelDelBtn();
}
function notifSelectAll(ev) {
  if (ev) ev.stopPropagation();
  const cbs = document.querySelectorAll(".uh-notif-cb");
  const allSel = cbs.length > 0 && Array.from(cbs).every(cb => cb.checked);
  NM_NSEL.clear();
  cbs.forEach(cb => {
    cb.checked = !allSel;
    const id = parseInt(cb.value, 10);
    if (cb.checked && id) NM_NSEL.add(id);
  });
  notifUpdateSelDelBtn();
}
async function notifSelDelete() {
  if (!NM_NSEL.size) return;
  let ok = 0, fail = 0, last;
  for (const id of NM_NSEL) {
    const r = await api("/api/user/me/notifications/" + id, { method: "DELETE" });
    if (r.ok) ok++; else { fail++; last = r; }
  }
  NM_NSEL.clear();
  notifUpdateSelDelBtn();
  if (fail) {
    const msg = (last && last.data && last.data.error) ? last.data.error :
                (last && last.status === 404 ? "Endpoint non disponibile — riavvia il server" : "Cancellazione non riuscita");
    toast(msg + (ok ? " (" + ok + " ok, " + fail + " falliti)" : ""), "err");
  } else if (ok) {
    toast(ok === 1 ? "Notifica cancellata" : ok + " notifiche cancellate");
  }
  notifPollUnread();
  notifLoadList();
}
window.notifClick = notifClick; window.notifReadAll = notifReadAll; window.notifClearAll = notifClearAll;
window.notifSelToggle = notifSelToggle; window.notifSelClear = notifSelClear;
window.notifSelectAll = notifSelectAll; window.notifSelDelete = notifSelDelete;
window.notifBanUser = async function (uid, nid) {
  const ok = await nmConfirm({ title: "Bannare utente?", danger: true }); if (!ok) return;
  await api("/api/admin/users/" + uid + "/ban", { method: "POST" });
  if (nid) await api("/api/user/me/notifications/" + nid + "/read", { method: "PUT" });
  notifLoadList();
};
window.notifMarkRead = async function (id) { await api("/api/user/me/notifications/" + id + "/read", { method: "PUT" }); notifPollUnread(); notifLoadList(); };
window.notifRemoveVideo = async function (vid, nid) {
  const ok = await nmConfirm({ title: "Rimuovi video", danger: true }); if (!ok) return;
  await api("/api/admin/videos/" + vid, { method: "DELETE" });
  if (nid) await api("/api/user/me/notifications/" + nid, { method: "DELETE" });
  notifLoadList();
};

function ensureHamburger() {
  if (document.getElementById("uhHamb")) return;
  const left = document.querySelector(".user-hdr .uh-l"); if (!left) return;
  const btn = document.createElement("button");
  btn.id = "uhHamb"; btn.className = "uh-hamburger"; btn.type = "button";
  btn.setAttribute("aria-label", "Menu");
  btn.innerHTML = '<span></span><span></span><span></span>';
  btn.onclick = openHamburgerPanel;
  left.insertBefore(btn, left.firstChild);
}
function openHamburgerPanel() {
  closeHamburgerPanel();
  const p = document.createElement("div");
  p.id = "uhMobilePanel"; p.className = "uh-mpanel open";
  p.innerHTML = '<div class="uh-mpanel-bg" onclick="closeHamburgerPanel()"></div><div class="uh-mpanel-box"><div class="uh-mpanel-h"><div class="uh-mpanel-title">NETMED</div><button class="uh-mpanel-x" onclick="closeHamburgerPanel()" aria-label="Chiudi">×</button></div><div class="uh-mpanel-body">' + buildMobileMenuHtml() + '</div></div>';
  document.body.appendChild(p);
}
function closeHamburgerPanel() { const p = document.getElementById("uhMobilePanel"); if (p) p.remove(); }
window.closeHamburgerPanel = closeHamburgerPanel;

function buildMobileMenuHtml() {
  const isLogged = !!NM.user;
  const isAdmin = !!(NM.user && NM.user.role === "admin");
  const isVer = !!(NM.user && NM.user.is_verified);
  function it(label, action, cls) {
    return '<button class="uh-mpanel-item ' + (cls||"") + '" type="button" onclick="closeHamburgerPanel();' + action + '">' + label + '</button>';
  }
  function sub(label, action) {
    return '<button class="uh-mpanel-item sub" type="button" onclick="closeHamburgerPanel();' + action + '">' + label + '</button>';
  }
  let html = "";
  if (isLogged) {
    html += '<div class="uh-mpanel-account"><div class="uh-mpanel-account-name">' + escapeHtml(NM.user.username || "Utente") + '</div><div class="uh-mpanel-account-email">' + escapeHtml(NM.user.email || "") + '</div></div>';
  }
  html += '<div class="uh-mpanel-section">Naviga</div>';
  html += it("Home", "goTo('home.html')");
  html += it("Esplora", "goTo('search.html?sort=recent')");
  if (isLogged) html += it("Iscrizioni", "goTo('iscrizioni.html')");
  const cats = Array.isArray(NM.categories) ? NM.categories : [];
  if (cats.length) {
    html += '<div class="uh-mpanel-section">Categorie</div>';
    cats.slice(0, 8).forEach(c => { html += sub(escapeHtml(c.name), "goCategory(" + c.id + ")"); });
    if (cats.length > 8) html += sub("Tutte le categorie", "goTo('search.html?view=categories')");
  }
  const tags = Array.isArray(NM.tags) ? NM.tags : [];
  if (tags.length) {
    html += '<div class="uh-mpanel-section">Tag</div>';
    const byPop = tags.slice().sort((a,b) => (b.video_count||0) - (a.video_count||0));
    const byRec = tags.slice().sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
    const seen = new Set(); const mix = [];
    byPop.slice(0,5).forEach(t => { if (!seen.has(t.id)) { mix.push(t); seen.add(t.id); } });
    byRec.slice(0,3).forEach(t => { if (!seen.has(t.id)) { mix.push(t); seen.add(t.id); } });
    mix.forEach(t => { const sf = String(t.name).replace(/'/g, "\\'"); html += sub("#" + escapeHtml(t.name), "goTag('" + sf + "')"); });
    html += sub("Tutti i tag", "goTo('search.html?view=tags')");
  }
  if (isLogged) {
    html += '<div class="uh-mpanel-section">Account</div>';
    html += it("Il mio profilo", "goProfile()");
    html += it("Salvati", "goFavorites()");
    html += it("Cronologia", "goTo('cronologia.html')");
    html += it("I miei commenti", "goTo('miei-commenti.html')");
    if (isVer && !isAdmin) html += it("I miei video", "goCreator()");
    if (!isVer && !isAdmin) html += it("Diventa creator", "goProfile()");
    if (isAdmin) html += it("Dashboard admin", "goAdmin()");
  }
  html += '<div class="uh-mpanel-section">Impostazioni</div>';
  html += it("Cambia tema", "toggleTheme()");
  html += it("Cambia lingua", "if(window.NMI18n){window.NMI18n.toggle();}");
  if (isLogged) html += it("Esci", "doLogout()", "danger");
  else { html += it("Accedi", "goLogin()"); html += it("Registrati", "goTo('registrazione.html')"); }
  return html;
}

function ensureUploadFab() {
  const canUpload = NM.user && NM.user.is_verified && NM.user.role !== "admin";
  const here = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const skip = ["creator-upload.html","login.html","registrazione.html","admin_dashboard.html","index.html"].includes(here);
  const old = document.getElementById("nmUploadFab"); if (old) old.remove();
  if (!canUpload || skip) return;
  const fab = document.createElement("button");
  fab.id = "nmUploadFab"; fab.className = "nm-upload-fab"; fab.type = "button";
  fab.setAttribute("aria-label", "Carica video");
  fab.onclick = () => goTo("creator-upload.html");
  fab.innerHTML = '<span class="nm-upload-fab-ico">+</span><span class="nm-upload-fab-lbl">Carica video</span>';
  document.body.appendChild(fab);
}

function hideFooterAuthForUser() {
  if (!NM.user) return;
  document.querySelectorAll(".uf-col-link").forEach(a => {
    const t = (a.textContent || "").trim().toLowerCase();
    if (t === "accedi" || t === "registrati") a.style.display = "none";
  });
}
window.hideFooterAuthForUser = hideFooterAuthForUser;

function nmAddToFolder(videoId) { if (typeof window.openFolderPicker === "function") window.openFolderPicker(videoId); }
function nmCloseFolderPicker() { const m = document.getElementById("nmFolderPicker"); if (m) m.remove(); }
async function nmFpAdd() {}
async function nmFpCreate() {}
window.nmAddToFolder = nmAddToFolder;
window.nmCloseFolderPicker = nmCloseFolderPicker;
window.nmFpAdd = nmFpAdd; window.nmFpCreate = nmFpCreate;

function initUserSearch() { if (typeof window.searchV2Init === "function") window.searchV2Init(); }
window.initUserSearch = initUserSearch;

document.addEventListener("keydown", e => {
  const t = e.target;
  const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey) {
    const s = document.getElementById("uhSearchInput");
    if (s) { e.preventDefault(); s.focus(); s.select(); }
  }
  if (e.key === "Escape") { closeUserDD(); closeAllHeaderMnu(); closeHamburgerPanel(); }
});


//  Helper di render: stati vuoto/errore standard Servono a profilo, ricerca,
//  catalogo. Garantiscono che la pagina non crashi anche se uno
//  script chiama questi helper prima che la pagina sia montata.
function renderProfileError(msg) {
  const root = document.getElementById("upForms") ||
               document.getElementById("mainContent") ||
               document.body;
  if (!root) return;
  root.innerHTML =
    '<div class="nm-state nm-state-err" role="alert" ' +
    'style="max-width:520px;margin:48px auto;padding:28px 32px;background:var(--surface);' +
    'border:1px solid var(--border);border-radius:12px;text-align:center">' +
      '<h2 style="margin:0 0 10px;color:var(--rose);font-size:18px">Profilo non disponibile</h2>' +
      '<p style="margin:0 0 18px;color:var(--text-muted);font-size:14px">' + escapeHtml(msg || "Impossibile caricare i tuoi dati.") + '</p>' +
      '<button class="cu-btn cu-btn-primary" onclick="location.reload()">Riprova</button>' +
    '</div>';
}
window.renderProfileError = renderProfileError;

// Ritorna HTML "stato vuoto" per la pagina di ricerca/esplora.
function renderSearchEmpty(message) {
  return '<div class="vl-empty" role="status" style="grid-column:1/-1;text-align:center;padding:54px 18px;color:var(--text-muted)">' +
           '<div style="font-size:36px;margin-bottom:8px">·</div>' +
           '<div style="font-size:15px">' + escapeHtml(message || "Nessun risultato.") + '</div>' +
         '</div>';
}
window.renderSearchEmpty = renderSearchEmpty;

// Errore generico nella pagina ricerca: scrive in tutti i grid disponibili.
function renderSearchError(msg) {
  const html =
    '<div class="vl-empty vl-error" role="alert" style="grid-column:1/-1;text-align:center;padding:54px 18px;color:var(--rose)">' +
      '<div style="font-size:32px;margin-bottom:8px">!</div>' +
      '<div style="font-size:15px;font-weight:600">' + escapeHtml(msg || "Errore di caricamento") + '</div>' +
      '<button class="cu-btn cu-btn-ghost" style="margin-top:14px" onclick="location.reload()">Ricarica</button>' +
    '</div>';
  ["srResults", "srVideos", "srCategories", "srTags", "vlGrid"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
}
window.renderSearchError = renderSearchError;

// Admin: sblocca un video flaggato.
async function vdAdminUnflag(videoId) {
  if (typeof api !== "function") return;
  const ok = await nmConfirm({
    title: "Sbloccare il video?",
    message: "Il video tornera' pubblicamente visibile sulla piattaforma.",
    okLabel: "Sblocca",
    cancelLabel: "Annulla",
  });
  if (!ok) return;
  const r = await api("/api/admin/videos/" + videoId + "/flag", {
    method: "PUT",
    body: { flagged: false },
  });
  if (!r.ok) {
    toast((r.data && r.data.error) || "Sblocco non riuscito", "err");
    return;
  }
  toast("Video sbloccato");
  setTimeout(function () { location.reload(); }, 800);
}
window.vdAdminUnflag = vdAdminUnflag;

(function () {
  
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

async function nmEnablePushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    toast("Il tuo browser non supporta le notifiche push", "err");
    return false;
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    toast("Permesso notifiche negato", "err");
    return false;
  }
  const reg = await navigator.serviceWorker.register("/sw.js");
  const keyRes = await api("/api/user/push/public-key");
  if (!keyRes.ok || !keyRes.data || !keyRes.data.key) {
    toast("Server push non configurato", "err");
    return false;
  }
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(keyRes.data.key),
  });
  const res = await api("/api/user/push/subscribe", {
    method: "POST", body: { subscription: sub.toJSON() },
  });
  if (res.ok) {
    toast("Notifiche attivate");
    return true;
  }
  toast((res.data && res.data.error) || "Errore", "err");
  return false;
}

async function nmDisablePushNotifications() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await api("/api/user/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } });
    await sub.unsubscribe();
  }
  toast("Notifiche disattivate");
}

window.nmEnablePushNotifications = nmEnablePushNotifications;
window.nmDisablePushNotifications = nmDisablePushNotifications;

function nmInitHeader() {
  function tryBootstrap() {
    if (!document.getElementById("uhNav")) return;
    loadTheme();
    loadAuth();
    renderHeaderUser();
    if (typeof nmBootstrapHeaderNav === "function") nmBootstrapHeaderNav();
    if (typeof ensureI18n === "function") ensureI18n();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryBootstrap, { once: true });
  } else {
    tryBootstrap();
  }
}
window.nmInitHeader = nmInitHeader;
nmInitHeader();
})();
