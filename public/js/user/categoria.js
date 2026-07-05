const CAT = {
  id: null,       // id della categoria corrente dall'URL
  category: null, // oggetto categoria (name, id) preso dall'elenco
  videos: [],
  sort: "recent",
};

// Bootstrap principale: parse URL, fetch categorie + video, render.
async function loadCategoriaPage() {
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get("id"), 10);
  if (!id) {
    renderCatNotFound();
    return;
  }
  CAT.id = id;

  renderCatSkeleton();

  // Categorie + video in parallelo.
  const [catsRes, vidsRes] = await Promise.all([
    api("/api/user/categories"),
    api("/api/user/categories/" + id + "/videos"),
  ]);

  if (catsRes.ok) {
    NM.categories = catsRes.data || [];
    CAT.category = NM.categories.find((c) => c.id === id) || null;
  }

  if (!vidsRes.ok || !CAT.category) {
    renderCatNotFound();
    return;
  }

  CAT.videos = vidsRes.data || [];
  document.title = "NETMED";

  renderCatHero();
  renderCatToolbar();
  renderCatGrid();
}

// Placeholder 
function renderCatSkeleton() {
  const grid = document.getElementById("vlGrid");
  if (!grid) return;
  let html = "";
  for (let i = 0; i < 8; i++) {
    html += `
      <div class="vl-card loading">
        <div class="vl-thumb"></div>
        <div class="vl-body">
          <div class="vl-title-sk"></div>
          <div class="vl-meta-sk"></div>
        </div>
      </div>
    `;
  }
  grid.innerHTML = html;
}

// Hero in cima con nome categoria + descrizione + conteggio video.
function renderCatHero() {
  const hero = document.getElementById("vlHero");
  if (!hero || !CAT.category) return;
  const n = CAT.videos.length;
  hero.innerHTML = `
    <div class="vl-hero-inner">
      <div class="vl-hero-eyebrow">Categoria</div>
      <h1 class="vl-hero-title">${escapeHtml(CAT.category.name)}</h1>
      <p class="vl-hero-desc">
        Contenuti curati per studenti, professionisti e curiosi.
      </p>
      <div class="vl-hero-stats">
        <span><strong>${n}</strong> ${n === 1 ? "video disponibile" : "video disponibili"}</span>
      </div>
    </div>
  `;
}

function renderCatToolbar() {
  const tb = document.getElementById("vlToolbar");
  if (!tb) return;

  const cid = CAT.category ? CAT.category.id : null;
  const cats = Array.isArray(NM.categories) ? NM.categories : [];
  const chips = [];
  chips.push(
    `<button class="cat-chip ${!cid ? "active" : ""}" type="button" onclick="goTo('home.html')">Tutti</button>`
  );
  cats.forEach((c) => {
    const isActive = c.id === cid;
    chips.push(
      `<button class="cat-chip ${isActive ? "active" : ""}" type="button" onclick="goCategory(${c.id})">${escapeHtml(c.name)}</button>`
    );
  });
  chips.push(`<span class="cat-chip-sep" aria-hidden="true"></span>`);
  chips.push(
    `<button class="cat-chip" type="button" onclick="goTo('search.html?view=tags')">Tag</button>`
  );
  chips.push(
    `<button class="cat-chip" type="button" onclick="goTo('search.html?sort=views')">Piu' visti</button>`
  );
  chips.push(
    `<button class="cat-chip" type="button" onclick="goTo('search.html?sort=recent')">Recenti</button>`
  );

  const tabsHtml = `<div class="cat-tabs" role="tablist" aria-label="Categorie e filtri">${chips.join("")}</div>`;

  // Se non ci sono video, non serve la riga ordinamento.
  if (!CAT.videos.length) {
    tb.innerHTML = tabsHtml;
    return;
  }

  tb.innerHTML =
    tabsHtml +
    `
    <div class="cat-toolbar-row">
      <label class="vl-toolbar-label" for="vlSortSelect">Ordina per</label>
      <select class="vl-select" id="vlSortSelect" onchange="catChangeSort(this.value)" aria-label="Ordina i video">
        <option value="recent" ${CAT.sort === "recent" ? "selected" : ""}>Più recenti</option>
        <option value="az"     ${CAT.sort === "az" ? "selected" : ""}>A → Z</option>
      </select>
      <div class="vl-toolbar-spacer"></div>
    </div>
  `;
}

// onChange del <select> ordinamento.
function catChangeSort(value) {
  CAT.sort = value;
  renderCatToolbar();
  renderCatGrid();
}

// Griglia video(o empty state se non ce ne sono).
function renderCatGrid() {
  const grid = document.getElementById("vlGrid");
  if (!grid) return;

  if (!CAT.videos.length) {
    grid.innerHTML = `
      <div class="vl-empty" style="grid-column:1/-1">
        <div class="vl-empty-ico">${(window.NMUI && NMUI.illust("clapper")) || ""}</div>
        <div class="vl-empty-t">Nessun video in questa categoria</div>
        <div class="vl-empty-d">Il catalogo è in aggiornamento. Torna a trovarci tra poco!</div>
        <button class="vl-empty-btn" onclick="goTo('home.html')">Torna alla home</button>
      </div>
    `;
    return;
  }

  const list = CAT.videos.slice();
  if (CAT.sort === "az") {
    list.sort((a, b) =>
      (a.title || "").localeCompare(b.title || "", "it", { sensitivity: "base" })
    );
  } else {
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  grid.innerHTML = list.map(renderVlCard).join("");
}

// Card singolo video (formato griglia "vl-card" usato anche da preferiti/ricerca).
function renderVlCard(v) {
  return `
    <article class="vl-card" onclick="nmOpenVideoPreview(${v.id})" role="link" tabindex="0"
             data-video-id="${v.id}"
             data-yt="${escapeHtml(v.youtube_id || "")}"
             aria-label="${escapeHtml(v.title || "Video")}"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goVideo(${v.id})}">
      <div class="vl-thumb">
        <img src="${escapeHtml(thumbUrl(v))}" alt="${escapeHtml(v.title || "")}" loading="lazy" decoding="async" onerror="this.style.opacity=0">
        <div class="vl-thumb-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg></div>
      </div>
      <div class="vl-body">
        <h3 class="vl-title">${escapeHtml(v.title || "")}</h3>
        <div class="vl-meta">
          ${v.category_name ? `<span class="vl-cat">${escapeHtml(v.category_name)}</span><span class="dot" aria-hidden="true"></span>` : ""}
          <span>${formatViews(v.views_count || 0)}</span>
          <span class="dot" aria-hidden="true"></span>
          <span>${timeAgo(v.created_at)}</span>
        </div>
      </div>
    </article>
  `;
}

// Empty state per categoria non esistente / non trovata.
function renderCatNotFound() {
  const hero = document.getElementById("vlHero");
  const tb = document.getElementById("vlToolbar");
  const grid = document.getElementById("vlGrid");
  if (hero) hero.innerHTML = "";
  if (tb) tb.innerHTML = "";
  if (!grid) return;
  grid.innerHTML = `
    <div class="vl-empty" style="grid-column:1/-1">
      <div class="vl-empty-ico">${(window.NMUI && NMUI.illust("folder", { variant: "danger" })) || ""}</div>
      <div class="vl-empty-t">Categoria non trovata</div>
      <div class="vl-empty-d">La categoria che stai cercando non esiste o non è più disponibile.</div>
      <button class="vl-empty-btn" onclick="goTo('home.html')">Torna alla home</button>
    </div>
  `;
}

// Fetch categorie + tag per il dropdown "Categorie" / "Tag" nell'header.
async function loadHeaderCategoriesForCatPage() {
  try {
    const cr = await api("/api/user/categories");
    if (cr.ok) NM.categories = cr.data || [];
    const tr = await api("/api/user/tags");
    if (tr.ok && tr.data && Array.isArray(tr.data.tags)) NM.tags = tr.data.tags;
    if (typeof renderHeaderNav === "function") renderHeaderNav("categoria:" + (CAT.id || ""));
  } catch (e) {
    console.warn("[cat] header nav skipped:", e.message);
  }
}

(function init() {
  function safe(label, fn) {
    try {
      return fn();
    } catch (e) {
      console.error("[cat init] " + label + " failed:", e);
    }
  }
  safe("loadTheme", function () {
    if (typeof loadTheme === "function") loadTheme();
  });
  safe("loadAuth", function () {
    if (typeof loadAuth === "function") loadAuth();
  });
  safe("renderHeaderUser", function () {
    if (typeof renderHeaderUser === "function") renderHeaderUser();
  });
  safe("refreshAuthMe", function () {
    if (typeof refreshAuthMe === "function") refreshAuthMe();
  });
  safe("initUserSearch", function () {
    if (typeof initUserSearch === "function") initUserSearch();
  });
  safe("loadHeaderCategoriesForCatPage", function () {
    loadHeaderCategoriesForCatPage();
  });
  safe("loadCategoriaPage", function () {
    loadCategoriaPage();
  });
  // Sync cross-tab tema/auth.
  window.addEventListener("storage", function (e) {
    if (e.key === "nm_theme") loadTheme();
    if (e.key === "token" || e.key === "user") {
      loadAuth();
      renderHeaderUser();
    }
  });
})();