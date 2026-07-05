
const CP = {
  username: null,
  data: null, // risposta del server
};

document.addEventListener("DOMContentLoaded", async () => {
  if (typeof loadTheme === "function") loadTheme();
  loadAuth();
  await refreshAuthMe();
  renderHeaderUser();

  // Carico categorie + tag per la nav header (come la home)
  try {
    if (typeof api === "function") {
      const cr = await api("/api/user/categories");
      if (cr.ok) NM.categories = cr.data || [];
      const tr = await api("/api/user/tags");
      if (tr.ok && tr.data && Array.isArray(tr.data.tags)) NM.tags = tr.data.tags;
      if (typeof renderHeaderNav === "function") nmBootstrapHeaderNav(null);
    }
  } catch (e) {
    console.warn("[cp] header nav skipped:", e.message);
  }

  // Forza display block dell'hero (override del grid 140px+1fr originale)
  const heroEl = document.getElementById("cpHero");
  if (heroEl) heroEl.classList.add("cp-hero-yt");

  // Estraggo lo username dalla query string
  const params = new URLSearchParams(window.location.search);
  CP.username = (params.get("u") || "").trim();

  if (!CP.username) {
    renderCpError("Username mancante. Aggiungi ?u=&lt;username&gt; all'URL.");
    return;
  }

  await loadCreator();
});

async function loadCreator() {
  const hero = document.getElementById("cpHero");
  const grid = document.getElementById("cpGrid");
  if (hero) hero.innerHTML = `<div class="cp-loading">Caricamento profilo…</div>`;
  if (grid) grid.innerHTML = "";

  const res = await api(`/api/user/creators/${encodeURIComponent(CP.username)}`);
  if (!res.ok) {
    if (res.status === 404) {
      renderCpError("Utente non trovato.");
    } else {
      renderCpError(res.data && res.data.error ? res.data.error : "Errore di caricamento");
    }
    return;
  }

  CP.data = res.data;
  document.title = "NETMED";
  renderCpHero();
  renderCpVideos();
}

function renderCpError(msg) {
  const hero = document.getElementById("cpHero");
  if (hero) hero.innerHTML = `<div class="cp-error">${escapeHtml(msg)}</div>`;
  const grid = document.getElementById("cpGrid");
  if (grid) grid.innerHTML = "";
  const count = document.getElementById("cpVidCount");
  if (count) count.textContent = "";
}

// Riga "joined" sotto al nome: la voglio calda, non da macchina.
// Mostro il mese e anno reali invece di "5 anni fa" per evitare
// la sensazione "compilato da un bot".
function cpJoinedLine(c) {
  const months = [
    "gennaio",
    "febbraio",
    "marzo",
    "aprile",
    "maggio",
    "giugno",
    "luglio",
    "agosto",
    "settembre",
    "ottobre",
    "novembre",
    "dicembre",
  ];
  let joined = "";
  if (c.joined_at) {
    const d = new Date(c.joined_at);
    if (!isNaN(d.getTime())) {
      joined = " da " + months[d.getMonth()] + " " + d.getFullYear();
    }
  }
  if (c.is_verified) {
    // Variante "umana" per creator verificati. Pesco tra alcune
    // frasi alternative basate sull'id per non vedere sempre la
    // stessa: piccolo "tocco" che fa sembrare meno generato.
    const variants = [
      "Su NETMED" + joined + " · profilo verificato",
      "Verificato dal team NETMED · qui" + joined,
      "Creator verificato · su NETMED" + joined,
    ];
    const idx = Math.abs(parseInt(c.id, 10) || 0) % variants.length;
    return variants[idx];
  }
  return "Su NETMED" + joined;
}

function renderCpHero() {
  const hero = document.getElementById("cpHero");
  if (!hero || !CP.data) return;

  // Backend ritorna l'oggetto creator direttamente in root (id, username,
  // verified_profile, videos, followers...). Vecchio shape usava wrapper
  // { creator, stats }. Supporto entrambi.
  const c = CP.data.creator || CP.data;
  if (!c) {
    hero.innerHTML = `<div class="cp-error">Dati creator non disponibili</div>`;
    return;
  }
  // Stats: se mancano nel payload, le ricalcolo dall'array videos disponibile.
  const vidsArr = Array.isArray(c.videos) ? c.videos : (CP.data.videos || []);
  const computedStats = {
    videos: vidsArr.length,
    total_views: vidsArr.reduce((acc, v) => acc + (parseInt(v.views_count, 10) || 0), 0),
    total_useful: 0,
  };
  const s = CP.data.stats || computedStats;
  const vp =
    typeof c.verified_profile === "string"
      ? safeJSON(c.verified_profile)
      : c.verified_profile || {};

  const initial = (c.username || "U").charAt(0).toUpperCase();
  const avHtml = c.avatar_url
    ? `<img src="${escapeHtml(c.avatar_url)}" alt="Avatar di ${escapeHtml(c.username)}"/>`
    : escapeHtml(initial);

  // Chip professionali (qualifica, organizzazione, titolo)
  const chips = [];
  if (vp.title) chips.push(escapeHtml(vp.title));
  if (vp.qualifica) chips.push(escapeHtml(vp.qualifica));
  if (vp.organization) chips.push(escapeHtml(vp.organization));
  if (vp.credentials) chips.push(escapeHtml(vp.credentials));

  // Handle line stile YouTube: @username · N iscritti · N video
  const handleParts = ["@" + escapeHtml(c.username)];
  if (c.is_verified) {
    const subs = s.followers || 0;
    const subsLbl = subs === 1 ? "1 iscritto" : formatNum(subs) + " iscritti";
    const safeName = String(c.username).replace(/'/g, "\\'");
    handleParts.push(
      '<a class="cp-id-stat-link" href="#" role="button" tabindex="0" ' +
        'style="color:inherit;text-decoration:underline dotted;cursor:pointer" ' +
        'onclick="event.preventDefault();cpOpenFollowersModal(\'' + safeName + '\')">' +
        subsLbl + '</a>'
    );
  }
  const nv = s.videos || 0;
  handleParts.push(nv === 1 ? "1 video" : formatNum(nv) + " video");
  const handleLine = handleParts.join(" \u00b7 ");

  // Contatti pubblici (icone link tipo YouTube "links")
  const linksHtml =
    vp.public_email || vp.public_phone
      ? `
    <div class="cp-id-links" role="group" aria-label="Contatti del creator">
      ${
        vp.public_email
          ? `
        <a class="cp-id-link" href="mailto:${escapeHtml(vp.public_email)}" title="Scrivi una mail">
          <span class="cp-id-link-ico" aria-hidden="true">\u2709</span>
          <span>${escapeHtml(vp.public_email)}</span>
        </a>`
          : ""
      }
      ${
        vp.public_phone
          ? `
        <a class="cp-id-link" href="tel:${escapeHtml(vp.public_phone.replace(/[^+0-9]/g, ""))}" title="Chiama o WhatsApp">
          <span class="cp-id-link-ico" aria-hidden="true">\u260E</span>
          <span>${escapeHtml(vp.public_phone)}</span>
        </a>`
          : ""
      }
    </div>`
      : "";

  const followBtn = renderCpFollowBtn(c, CP.data.is_following, CP.data.can_follow);

  hero.innerHTML = `
    <div class="cp-banner" aria-hidden="true"></div>
    <div class="cp-headline">
      <div class="cp-avatar-big">${avHtml}</div>
      <div class="cp-id">
        <h1 class="cp-name">
          <span class="cp-name-text">${escapeHtml(c.username)}</span>
          ${verifiedTickHTML(c.is_verified, vp, "lg")}
        </h1>
        <div class="cp-id-handle">${handleLine}</div>
        <div class="cp-id-meta">${cpJoinedLine(c)}</div>
        ${
          chips.length
            ? `
          <div class="cp-id-pro">
            ${chips.map((t) => `<span class="cp-id-pro-chip">${t}</span>`).join("")}
          </div>`
            : ""
        }
        ${vp.bio ? `<div class="cp-id-bio">${escapeHtml(vp.bio)}</div>` : ""}
        ${linksHtml}
        ${followBtn ? `<div class="cp-id-actions">${followBtn}</div>` : ""}
      </div>
    </div>
  `;
}

// Bottone Iscriviti nel profilo creator. Riusa la stessa classe della
// pagina video per coerenza visiva (.vd-sub-btn).
// I creator verificati POSSONO seguire altri creator verificati: e' un
// vantaggio per fare networking nella community medica della piattaforma.
function renderCpFollowBtn(c, isFollowing, canFollow) {
  // Solo verified ricevono iscrizioni; non mostrare al proprietario.
  if (!canFollow) return "";
  const me = typeof NM !== "undefined" && NM.user ? NM.user : null;
  if (me && me.username && me.username.toLowerCase() === String(c.username).toLowerCase())
    return "";

  // Hint contestuale: se l'utente loggato e' a sua volta un creator
  // verified, lo facciamo sentire "tra colleghi". Piccolo testo sopra
  // al bottone, scompare in 6 secondi via CSS.
  const peerHint =
    me && me.is_verified
      ? '<div class="cp-peer-hint">Anche tu sei un creator verificato — segui i tuoi colleghi per scoprire nuovi contenuti.</div>'
      : "";

  if (!me) {
    return `<div class="cp-follow-row">
              <button class="vd-sub-btn" onclick="goLogin()">Iscriviti</button>
            </div>`;
  }
  if (isFollowing) {
    return `<div class="cp-follow-row">
              ${peerHint}
              <button class="vd-sub-btn is-on" id="cpFollowBtn" onclick="cpToggleFollow()"
                      aria-pressed="true" title="Sei iscritto - clicca per disiscriverti">
                <span class="vd-sub-ico" aria-hidden="true">✓</span>
                <span class="vd-sub-lbl">Iscritto</span>
              </button>
            </div>`;
  }
  return `<div class="cp-follow-row">
            ${peerHint}
            <button class="vd-sub-btn" id="cpFollowBtn" onclick="cpToggleFollow()"
                    aria-pressed="false" title="Iscriviti al canale">
              <span class="vd-sub-lbl">Iscriviti</span>
            </button>
          </div>`;
}

async function cpToggleFollow() {
  if (!CP.data) return;
  // Backend ritorna creator in root, vecchio shape usava .creator wrapper
  const cObj = CP.data.creator || CP.data;
  if (!cObj || !cObj.username) return;
  if (typeof NM === "undefined" || !NM.user) {
    goLogin();
    return;
  }
  const username = cObj.username;
  const wasFollowing = !!(cObj.is_following || CP.data.is_following);
  const method = wasFollowing ? "DELETE" : "POST";

  const btn = document.getElementById("cpFollowBtn");
  if (btn) btn.disabled = true;
  const res = await api("/api/user/creators/" + encodeURIComponent(username) + "/follow", {
    method: method,
  });
  if (btn) btn.disabled = false;

  if (!res.ok) {
    if (typeof toast === "function")
      toast(res.data && res.data.error ? res.data.error : "Errore iscrizione", "err");
    return;
  }
  CP.data.is_following = !!res.data.is_following;
  if (typeof res.data.followers === "number") {
    if (!CP.data.stats) CP.data.stats = {};
    CP.data.stats.followers = res.data.followers;
  }
  renderCpHero();
  if (typeof toast === "function") {
    toast(CP.data.is_following ? "Iscritto al canale" : "Hai disattivato l'iscrizione", "ok");
  }
}
window.cpToggleFollow = cpToggleFollow;

function renderCpVideos() {
  const grid = document.getElementById("cpGrid");
  const count = document.getElementById("cpVidCount");
  if (!grid || !CP.data) return;

  const vids = CP.data.videos || [];
  if (count) count.textContent = vids.length ? `${vids.length} video` : "";

  if (!vids.length) {
    grid.innerHTML = `<div class="cp-empty">Nessun video pubblicato.</div>`;
    return;
  }

  grid.innerHTML = vids
    .map((v) => {
      const thumb =
        v.thumbnail_url ||
        (v.youtube_id
          ? `https://i.ytimg.com/vi/${encodeURIComponent(v.youtube_id)}/mqdefault.jpg`
          : "");
      return `
      <div class="vcard" onclick="nmOpenVideoPreview(${v.id})" role="link" tabindex="0"
           onkeydown="if(event.key==='Enter'){goVideo(${v.id})}">
        <div class="vcard-thumb">
          ${thumb ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(v.title || "")}" loading="lazy" onerror="this.style.opacity=0"/>` : ""}
        </div>
        <div class="vcard-body">
          <div class="vcard-title">${escapeHtml(v.title || "")}</div>
          <div class="vcard-meta">
            ${v.category_name ? `<span class="vcard-cat">${escapeHtml(v.category_name)}</span><span class="dot"></span>` : ""}
            <span>${formatNum(v.views || 0)} view</span>
            <span class="dot"></span>
            <span>${timeAgo(v.created_at)}</span>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJSON(s) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return {};
  }
}

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "ora";
  if (sec < 3600) return Math.floor(sec / 60) + " min fa";
  if (sec < 86400) return Math.floor(sec / 3600) + " ore fa";
  if (sec < 2592000) return Math.floor(sec / 86400) + " giorni fa";
  if (sec < 31536000) return Math.floor(sec / 2592000) + " mesi fa";
  return Math.floor(sec / 31536000) + " anni fa";
}

function formatNum(n) {
  const x = parseInt(n, 10) || 0;
  if (x < 1000) return String(x);
  if (x < 1000000) return (x / 1000).toFixed(x < 10000 ? 1 : 0).replace(/\.0$/, "") + "K";
  return (x / 1000000).toFixed(x < 10000000 ? 1 : 0).replace(/\.0$/, "") + "M";
}

// ============================================================
//  Modale "Iscritti": viene mostrata quando l'utente clicca sul
//  contatore "N iscritti" del creator. Carica la lista dal
//  backend GET /api/user/creators/:username/followers e la
//  renderizza in un overlay stile TikTok/Instagram.
// ============================================================
async function cpOpenFollowersModal(username) {
  if (!username) return;
  // Crea overlay se non esiste
  let bg = document.getElementById("cpFollowersModal");
  if (!bg) {
    bg = document.createElement("div");
    bg.id = "cpFollowersModal";
    bg.className = "vd-modal-bg";
    bg.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
    bg.innerHTML =
      '<div class="cp-followers-modal" onclick="event.stopPropagation()" ' +
        'style="background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:440px;width:100%;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.5)">' +
        '<div class="cp-followers-head" style="display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:1px solid var(--border)">' +
          '<div class="cp-followers-title" id="cpFollowersTitle" style="font-weight:700;font-size:16px;color:var(--text)">Iscritti</div>' +
          '<button type="button" onclick="cpCloseFollowersModal()" aria-label="Chiudi" ' +
            'style="background:transparent;border:0;color:var(--text);font-size:24px;cursor:pointer;line-height:1">&times;</button>' +
        '</div>' +
        '<div class="cp-followers-body" id="cpFollowersBody" style="overflow-y:auto;flex:1"></div>' +
      '</div>';
    bg.addEventListener("click", (e) => { if (e.target === bg) cpCloseFollowersModal(); });
    document.body.appendChild(bg);
  }
  const body = document.getElementById("cpFollowersBody");
  body.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">Caricamento…</div>';
  document.body.style.overflow = "hidden";

  const r = await api("/api/user/creators/" + encodeURIComponent(username) + "/followers");
  if (!r.ok) {
    body.innerHTML = '<div style="padding:32px;text-align:center;color:var(--rose)">' +
      escapeHtml((r.data && r.data.error) || "Errore di caricamento") + '</div>';
    return;
  }
  const list = Array.isArray(r.data && r.data.followers) ? r.data.followers
             : Array.isArray(r.data && r.data.items) ? r.data.items
             : Array.isArray(r.data) ? r.data : [];
  if (!list.length) {
    body.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">Nessun iscritto al momento.</div>';
    return;
  }
  body.innerHTML = list.map(function (u) {
    const initial = (u.username || "U").charAt(0).toUpperCase();
    const av = u.avatar_url
      ? '<img src="' + escapeHtml(u.avatar_url) + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover"/>'
      : escapeHtml(initial);
    const tick = typeof verifiedTickHTML === "function"
      ? verifiedTickHTML(u.is_verified, u.verified_profile, "sm")
      : "";
    const safeName = String(u.username || "").replace(/'/g, "\\'");
    const avatarHtml = u.avatar_url
      ? '<img src="' + escapeHtml(u.avatar_url) + '" alt="" loading="lazy" style="width:40px;height:40px;border-radius:50%;object-fit:cover"/>'
      : '<div style="width:40px;height:40px;border-radius:50%;background:var(--surface);color:var(--text);display:flex;align-items:center;justify-content:center;font-weight:700">' + escapeHtml(initial) + '</div>';
    return '<div onclick="goCreatorPublic(\'' + safeName + '\');cpCloseFollowersModal()" role="link" tabindex="0" '
      + 'style="display:flex;align-items:center;gap:12px;padding:12px 22px;border-bottom:1px solid var(--border);cursor:pointer">'
      + avatarHtml
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
      +     escapeHtml(u.username || "") + tick
      +   '</div>'
      + '</div>'
      + '</div>';
  }).join("");
}

window.cpOpenFollowersModal = function () {
  const modal = document.getElementById("cpFollowersModal");
  if (modal) modal.classList.add("open");
};
window.cpCloseFollowersModal = function () {
  const modal = document.getElementById("cpFollowersModal");
  if (modal) modal.classList.remove("open");
};
