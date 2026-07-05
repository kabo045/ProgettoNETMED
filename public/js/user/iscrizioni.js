const ISC = {
  groups: [],
};
// Verifica login, poi carica categorie/tag per l'header e i dati.
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof loadTheme === "function") loadTheme();
  loadAuth();
  if (!NM.token) {
    goLogin();
    return;
  }
  // Rilettura fresca dei flag utente (is_verified, role): serve per
  // decidere che voci mostrare nel dropdown header.
  await refreshAuthMe();
  if (!NM.user) {
    goLogin();
    return;
  }
  renderHeaderUser();

  // Categorie + tag per la nav dell'header (stesso pattern della home).
  try {
    const cr = await api("/api/user/categories");
    if (cr.ok) NM.categories = cr.data || [];
    const tr = await api("/api/user/tags");
    if (tr.ok && tr.data && Array.isArray(tr.data.tags)) NM.tags = tr.data.tags;
    if (typeof renderHeaderNav === "function") nmBootstrapHeaderNav(null);
  } catch (e) {
    console.warn("[isc] nav header skipped:", e.message);
  }

  if (typeof initUserSearch === "function") initUserSearch();

  await iscLoad();
});

// Carica il feed raggruppato per creator (max 12 video per creator).
async function iscLoad() {
  iscRenderSkeleton();
  const res = await api("/api/user/me/feed/grouped?per_creator=12");
  if (!res.ok) {
    iscRenderError(res.data && res.data.error ? res.data.error : "Errore di caricamento");
    return;
  }
  ISC.groups = (res.data && res.data.groups) || [];

  const meta = document.getElementById("iscSectionMeta");
  if (meta) {
    const n = ISC.groups.length;
    const tot = ISC.groups.reduce((a, g) => a + g.videos.length, 0);
    meta.textContent =
      n > 0
        ? n + (n === 1 ? " canale" : " canali") + " · " + tot + " video"
        : "";
  }

  iscRenderChannelsStrip();
  iscRenderRows();
}

// Strip orizzontale degli avatar dei canali
function iscRenderChannelsStrip() {
  const strip = document.getElementById("iscChannelsStrip");
  if (!strip) return;
  if (!ISC.groups.length) { strip.innerHTML = ""; strip.style.display = "none"; return; }
  strip.style.display = "";
  strip.innerHTML = ISC.groups.map(function (g) {
    var c = g.creator;
    var initial = (c.username || "U").charAt(0).toUpperCase();
    var av = c.avatar_url
      ? '<img src="' + escapeHtml(c.avatar_url) + '" alt="" loading="lazy"/>'
      : escapeHtml(initial);
    var tick = typeof verifiedTickHTML === "function"
      ? verifiedTickHTML(c.is_verified, c.verified_profile, "sm")
      : "";
    var safeName = String(c.username || "").replace(/'/g, "\\'");
    var nvids = (g.videos || []).length;
    return '<a class="isc-ch-card" role="link" tabindex="0" ' +
        'onclick="goCreatorPublic(\'' + safeName + '\')" ' +
        'onkeydown="if(event.key===\'Enter\'){goCreatorPublic(\'' + safeName + '\')}">' +
        '<div class="isc-ch-avatar">' + av + '</div>' +
        '<div class="isc-ch-name">' + escapeHtml(c.username || "") + tick + '</div>' +
        '<div class="isc-ch-meta">' + nvids + " video" + '</div>' +
      '</a>';
  }).join("");
}
window.iscLoad = iscLoad;

// Placeholder grigio mentre parte la fetch
function iscRenderSkeleton() {
  const rows = document.getElementById("iscRows");
  if (!rows) return;
  let html = "";
  for (let i = 0; i < 3; i++) {
    html += `
      <section class="row">
        <div class="row-header">
          <h2 class="row-title outfit"><span class="sk" style="display:inline-block;width:180px;height:20px;border-radius:6px;background:var(--surface-2)"></span></h2>
        </div>
        <div class="row-scroll-wrap">
          <div class="row-scroll">
            ${Array.from({ length: 5 })
              .map(
                () => `
              <div class="vcard loading">
                <div class="vcard-thumb"></div>
                <div class="vcard-body">
                  <div class="vcard-title-sk"></div>
                  <div class="vcard-title-sk"></div>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      </section>
    `;
  }
  rows.innerHTML = html;
}

// Errore di caricamento: empty state con bottone Riprova.
function iscRenderError(msg) {
  const rows = document.getElementById("iscRows");
  if (!rows) return;
  rows.innerHTML = `
    <div class="isc-empty">
      <div class="isc-empty-ico">!</div>
      <div class="isc-empty-t">Errore di caricamento</div>
      <div class="isc-empty-d">${escapeHtml(msg)}</div>
      <button class="isc-empty-btn" onclick="iscLoad()">Riprova</button>
    </div>
  `;
}

// Disegna una riga scroll per ogni creator. Se non ho iscrizioni, empty state.
function iscRenderRows() {
  const rows = document.getElementById("iscRows");
  if (!rows) return;

  if (!ISC.groups.length) {
    rows.innerHTML =
      '<div class="isc-empty">' +
        '<div class="isc-empty-ico">' +
          '<svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>' +
            '<path d="M13.73 21a2 2 0 0 1-3.46 0"/>' +
          '</svg>' +
        '</div>' +
        '<div class="isc-empty-t">Nessuna iscrizione ancora</div>' +
        '<div class="isc-empty-d">' +
          'Iscriviti ai canali dei creator verificati per vedere qui i loro nuovi video.' +
          ' Esplora la home, trova un creator che ti interessa e clicca <b>Iscriviti</b>.' +
        '</div>' +
        '<button class="isc-empty-btn" onclick="goTo(\'home.html\')">Esplora la home</button>' +
      '</div>';
    return;
  }

  rows.innerHTML = ISC.groups
    .map((g, idx) => {
      const c = g.creator;
      const initial = (c.username || "U").charAt(0).toUpperCase();
      const av = c.avatar_url
        ? '<img src="' + escapeHtml(c.avatar_url) + '" alt="" loading="lazy"/>'
        : escapeHtml(initial);
      const tick =
        typeof verifiedTickHTML === "function"
          ? verifiedTickHTML(c.is_verified, c.verified_profile, "sm")
          : "";
      const scrollId = "creator-" + c.id;
      // Ogni riga entra con un delay progressivo 
      return `
      <section class="row isc-creator-row" data-row-id="${scrollId}"
               style="animation: fadeUp .5s ease ${0.06 * idx}s both">
        <div class="isc-creator-head">
          <a class="isc-creator-info" onclick="goCreatorPublic('${escapeAttrSafe(c.username)}')"
             role="link" tabindex="0"
             onkeydown="if(event.key==='Enter'){goCreatorPublic('${escapeAttrSafe(c.username)}')}">
            <div class="isc-creator-avatar">${av}</div>
            <div class="isc-creator-text">
              <div class="isc-creator-name">${escapeHtml(c.username)}${tick}</div>
              <div class="isc-creator-meta">${g.videos.length} video</div>
            </div>
          </a>
          <button class="isc-row-link" type="button" onclick="goCreatorPublic('${escapeAttrSafe(c.username)}')">
            Vai al canale →
          </button>
        </div>
        <div class="row-scroll-wrap">
          <button class="row-arrow left" onclick="rowScroll('${scrollId}', -1)" aria-label="Scorri a sinistra"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg></button>
          <button class="row-arrow right" onclick="rowScroll('${scrollId}', 1)" aria-label="Scorri a destra"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg></button>
          <div class="row-scroll" id="rowScroll-${scrollId}" role="list">
            ${g.videos.map(iscVideoCard).join("")}
          </div>
        </div>
      </section>
    `;
    })
    .join("");

  // Aggiorno lo stato disabled delle frecce per ogni riga.
  ISC.groups.forEach((g) => {
    const sid = "creator-" + g.creator.id;
    if (typeof updateArrows === "function") updateArrows(sid);
  });
}

// Card singolo video dentro la riga di un creator.
function iscVideoCard(v) {
  const thumb =
    v.thumbnail_url ||
    (v.youtube_id
      ? "https://i.ytimg.com/vi/" + encodeURIComponent(v.youtube_id) + "/mqdefault.jpg"
      : "");
  return `
    <article class="vcard" onclick="nmOpenVideoPreview(${v.id})" role="link" tabindex="0"
             aria-label="${escapeHtml(v.title || "Video")}"
             onkeydown="if(event.key==='Enter'){nmOpenVideoPreview(${v.id})}">
      <div class="vcard-thumb">
        <img src="${escapeHtml(thumb)}" alt="${escapeHtml(v.title || "")}" loading="lazy" decoding="async" onerror="this.style.opacity=0">
        <div class="vcard-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg></div>
      </div>
      <div class="vcard-body">
        <h3 class="vcard-title">${escapeHtml(v.title || "")}</h3>
        <div class="vcard-meta">
          ${v.category_name ? `<span class="vcard-cat">${escapeHtml(v.category_name)}</span><span class="dot"></span>` : ""}
          <span>${formatViews(v.views_count || 0)}</span>
          <span class="dot" aria-hidden="true"></span>
          <span>${timeAgo(v.created_at)}</span>
        </div>
      </div>
    </article>
  `;
}

function rowScroll(sid, dir) {
  const el = document.getElementById("rowScroll-" + sid);
  if (!el) return;
  const amount = el.clientWidth * 0.8;
  el.scrollBy({ left: dir * amount, behavior: "smooth" });
  setTimeout(() => updateArrows(sid), 380);
}

// Disabilita le frecce quando si arriva ai bordi (inizio/fine scroll).
function updateArrows(sid) {
  const el = document.getElementById("rowScroll-" + sid);
  if (!el) return;
  const wrap = el.parentElement;
  const left = wrap.querySelector(".row-arrow.left");
  const right = wrap.querySelector(".row-arrow.right");
  if (!left || !right) return;
  const max = el.scrollWidth - el.clientWidth - 1;
  left.disabled = el.scrollLeft <= 0;
  right.disabled = el.scrollLeft >= max;
}
window.rowScroll = rowScroll;


// escape invece di HTML encoding. Da unificare in un helper condiviso in futuro.
function escapeAttrSafe(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
window.escapeAttrSafe = escapeAttrSafe;