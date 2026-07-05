
const CH = {
  cat: null,        // id categoria del filtro attivo, o null per "tutte"
  total: 0,         // totale server-side (dalla paginazione)
  loaded: 0,        // quanti ne ho gia' caricati
  pageSize: 12,
  items: [],
  loading: false,   // lock anti doppio-click su "Mostra altri"
};

// Bootstrap: verifica login, carica categorie per l'header e la cronologia.
(function init() {
  loadTheme();
  loadAuth();
  renderHeaderUser();

  if (!NM.user) return goLogin();

  // Rilettura fresca dei flag (is_verified, role) per il dropdown header.
  refreshAuthMe().then(async () => {
    if (!NM.user) return goLogin();
    initUserSearch();
    await loadHeaderCategoriesForCH();
    chPopulateCatFilter();
    chLoad();
  });

  // se cambia tema o auth in un altro tab, aggiorno anche qui.
  window.addEventListener("storage", (e) => {
    if (e.key === "nm_theme") loadTheme();
    if (e.key === "token" || e.key === "user") {
      loadAuth();
      renderHeaderUser();
      if (!NM.user) goLogin();
    }
  });
})();

// Fetch categorie per il nav dell'header + il <select> filtro.
async function loadHeaderCategoriesForCH() {
  const r = await api("/api/user/categories");
  if (r.ok) NM.categories = r.data || [];
  nmBootstrapHeaderNav(null);
}

// Reset dello stato e fetch della prima pagina.
async function chLoad() {
  chRenderSkeleton();
  CH.items = [];
  CH.loaded = 0;
  CH.total = 0;
  await chFetchPage(1);
}

// Fetch di una pagina di cronologia. Se page > 1 accumula ai precedenti.
async function chFetchPage(page) {
  CH.loading = true;
  const params = new URLSearchParams();
  params.set("page", page);
  params.set("limit", CH.pageSize);
  if (CH.cat) params.set("cat", CH.cat);

  const r = await api("/api/user/me/history?" + params.toString());

  if (!r.ok) {
    CH.loading = false;
    const detail = (r.data && r.data.error) || "HTTP " + r.status;
    if (r.status === 404) {
      chRenderError("Endpoint /me/history non trovato (404). Riavvia il server.");
    } else if (r.status === 401 || r.status === 403) {
      chRenderError("Sessione scaduta. Effettua di nuovo l'accesso.");
    } else {
      chRenderError("Errore di caricamento: " + detail);
    }
    return;
  }

  const newItems = r.data.items || [];
  CH.items = page === 1 ? newItems : CH.items.concat(newItems);
  CH.loaded = CH.items.length;
  CH.total = (r.data.pagination && r.data.pagination.total) || CH.loaded;
  CH.loading = false;

  chRenderStats();
  chRenderList();
}

// Handler del bottone "Mostra altri N".
async function chShowMore() {
  if (CH.loading) return;
  if (CH.loaded >= CH.total) return;
  const nextPage = Math.floor(CH.loaded / CH.pageSize) + 1;
  await chFetchPage(nextPage);
}

// Riempie il <select> del filtro categoria con l'elenco dal backend.
function chPopulateCatFilter() {
  const sel = document.getElementById("chCatFilter");
  if (!sel) return;
  const cats = Array.isArray(NM.categories) ? NM.categories : [];
  const opts = ['<option value="">Tutte le categorie</option>'].concat(
    cats.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
  );
  sel.innerHTML = opts.join("");
}

// onChange del <select> categoria.
function chOnCatChange(val) {
  const v = parseInt(val, 10);
  CH.cat = Number.isFinite(v) && v > 0 ? v : null;
  chRenderClearBtn();
  chLoad();
}

// Non serve un bottone "Cancella filtri" separato: il dropdown categoria
// ha gia' "Tutte le categorie" come voce di reset.
function chRenderClearBtn() {
  const oldBtn = document.getElementById("chClearFilters");
  if (oldBtn) oldBtn.remove();
}

// Reset del filtro categoria + reload.
function chClearFilters() {
  CH.cat = null;
  const sel = document.getElementById("chCatFilter");
  if (sel) sel.value = "";
  chRenderClearBtn();
  chLoad();
}

function chRenderStats() {
  const el = document.getElementById("chStats");
  if (!el) return;
  if (CH.total === 0) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <span class="ch-stat-pill">
      <strong>${CH.total}</strong>
      <span>video</span>
    </span>
  `;
}

// Placeholder grigio: 8 card in griglia mentre parte la fetch.
function chRenderSkeleton() {
  const list = document.getElementById("chList");
  if (!list) return;
  list.innerHTML = `<div class="ch-grid">
    ${Array.from(
      { length: 8 },
      () => `
      <div class="ch-card ch-card-skeleton">
        <div class="ch-card-thumb sk"></div>
        <div class="ch-card-body">
          <div class="sk sk-line sk-w80"></div>
          <div class="sk sk-line sk-w50" style="margin-top:8px"></div>
        </div>
      </div>
    `
    ).join("")}
  </div>`;
}

// Errore: empty state con illustrazione e messaggio.
function chRenderError(msg) {
  const list = document.getElementById("chList");
  if (list)
    list.innerHTML = `<div class="ch-empty ch-error"><div class="ch-empty-ico">${(window.NMUI && NMUI.illust("warning", { variant: "warn" })) || "!"}</div><div class="ch-empty-t">${escapeHtml(msg)}</div></div>`;
  const pag = document.getElementById("chPag");
  if (pag) pag.innerHTML = "";
}

// Etichetta di raggruppamento in base a quanto tempo fa e' stato visto.
// (Oggi / Ieri / Questa settimana / Questo mese / Piu' vecchi)
function chBucketLabel(iso) {
  if (!iso) return "Più vecchi";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Più vecchi";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = startToday - new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayMs = 86400000;
  if (diffMs <= 0) return "Oggi";
  if (diffMs <= dayMs) return "Ieri";
  if (diffMs <= 6 * dayMs) return "Questa settimana";
  if (diffMs <= 30 * dayMs) return "Questo mese";
  return "Più vecchi";
}

// Render della griglia: video raggruppati per bucket temporale +
// bottone "Mostra altri" se non ho ancora caricato tutto.
function chRenderList() {
  const list = document.getElementById("chList");
  if (!list) return;

  if (!CH.items.length) {
    list.innerHTML = `
      <div class="ch-empty">
        <div class="ch-empty-ico">${(window.NMUI && NMUI.illust("history")) || ""}</div>
        <div class="ch-empty-t">${
          CH.cat ? "Nessun video visto in questa categoria" : "La tua cronologia è vuota"
        }</div>
        <div class="ch-empty-s">${
          CH.cat
            ? "Cambia filtro o esplora altre categorie."
            : "Quando inizierai a guardare video, li troverai qui."
        }</div>
        <div class="ch-empty-actions">
          <button class="ch-btn ch-btn-primary" onclick="goTo('home.html')">Vai alla home</button>
        </div>
      </div>
    `;
    return;
  }

  // Raggruppo i video mantendo l'ordine
  const buckets = [];
  const byKey = new Map();
  CH.items.forEach((it) => {
    const key = chBucketLabel(it.last_viewed);
    if (!byKey.has(key)) {
      const arr = [];
      byKey.set(key, arr);
      buckets.push({ key, items: arr });
    }
    byKey.get(key).push(it);
  });

  const groupsHtml = buckets
    .map(
      (b) => `
    <div class="ch-group">
      <h3 class="ch-group-title">${escapeHtml(b.key)}
        <span class="ch-group-count">${b.items.length}</span>
      </h3>
      <div class="ch-grid">${b.items.map(chRenderCard).join("")}</div>
    </div>
  `
    )
    .join("");

  // Se ho caricato meno del totale, mostro "Mostra altri N".
  const remaining = Math.max(CH.total - CH.loaded, 0);
  const moreHtml =
    remaining > 0
      ? `
    <div class="ch-more">
      <button class="ch-more-btn" onclick="chShowMore()" ${CH.loading ? "disabled" : ""}>
        ${CH.loading ? "Caricamento…" : `Mostra altri ${Math.min(remaining, CH.pageSize)}`}
      </button>
      <div class="ch-more-info">${CH.loaded} di ${CH.total} video</div>
    </div>
  `
      : CH.total > CH.pageSize
        ? `<div class="ch-more"><div class="ch-more-info">Hai raggiunto la fine della cronologia</div></div>`
        : "";

  list.innerHTML = groupsHtml + moreHtml;
}

// Card singolo video nella cronologia. X in alto a destra per rimuoverlo.
function chRenderCard(v) {
  const thumb =
    v.thumbnail_url ||
    (v.youtube_id
      ? `https://i.ytimg.com/vi/${encodeURIComponent(v.youtube_id)}/mqdefault.jpg`
      : "");
  return `
    <article class="ch-card" role="link" tabindex="0"
             onclick="nmOpenVideoPreview(${v.id})"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goVideo(${v.id})}"
             aria-label="${escapeHtml(v.title || "Video")}">
      <div class="ch-card-thumb">
        ${
          thumb
            ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" onerror="this.style.opacity=0"/>`
            : ""
        }
        <div class="ch-card-thumb-play" aria-hidden="true">▶</div>
        <button class="ch-card-rm"
                onclick="event.stopPropagation();chRemoveOne(${v.id})"
                title="Rimuovi dalla cronologia"
                aria-label="Rimuovi dalla cronologia">✕</button>
      </div>
      <div class="ch-card-body">
        <h3 class="ch-card-title">${escapeHtml(v.title || "")}</h3>
        <div class="ch-card-meta">
          ${v.category_name ? `<span class="ch-tag">${escapeHtml(v.category_name)}</span>` : ""}
          <span class="ch-time">Visto ${timeAgo(v.last_viewed)}</span>
        </div>
      </div>
    </article>
  `;
}

// Rimuove un singolo video dalla cronologia dopo conferma.
async function chRemoveOne(videoId) {
  const ok = await nmConfirm({
    title: "Rimuovere dalla cronologia?",
    message: "Questo video sarà rimosso dalla tua cronologia personale.",
    okLabel: "Rimuovi",
    cancelLabel: "Annulla",
    danger: true,
  });
  if (!ok) return;

  const r = await api("/api/user/me/history/" + videoId, { method: "DELETE" });
  if (!r.ok) {
    toast((r.data && r.data.error) || "Rimozione non riuscita", "err");
    return;
  }
  toast("Rimosso dalla cronologia", "ok");
  CH.items = CH.items.filter((it) => it.id !== videoId);
  CH.loaded = CH.items.length;
  CH.total = Math.max(CH.total - 1, 0);
  chRenderStats();
  chRenderList();
}

// Svuota tutta la cronologia dopo conferma.
async function chClearAll() {
  if (!CH.total) {
    toast("La cronologia è già vuota", "info");
    return;
  }
  const ok = await nmConfirm({
    title: "Cancellare tutta la cronologia?",
    message: "Tutti i tuoi video visti verranno rimossi dalla cronologia.",
    okLabel: "Cancella tutto",
    cancelLabel: "Annulla",
    danger: true,
  });
  if (!ok) return;

  const r = await api("/api/user/me/history", { method: "DELETE" });
  if (!r.ok) {
    toast((r.data && r.data.error) || "Impossibile eliminare la cronologia", "err");
    return;
  }
  toast("Cronologia svuotata", "ok");
  CH.items = [];
  CH.total = 0;
  CH.loaded = 0;
  chRenderList();
}