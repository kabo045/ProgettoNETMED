// Stato locale della pagina ricerca. Vive dal caricamento fino al
// cambio pagina, non e' persistito. I filtri stanno nel query string
// dell'URL cosi' un link condivisibile ricrea lo stato al reload.
const SR = {
  q: "",
  tag: "",
  cat: null,
  view: "",    // "" | "tags"
  sort: "",    // "" | "views" | "useful" | "recent"
  data: { videos: [], categories: [], tags: [] },
  active: "videos", // tab attiva: "videos" | "categories" | "tags"
};

// Legge i parametri dall'URL, decide che tipo di vista mostrare
// (tag cloud / categorie / esplora / ricerca) e chiama la fetch giusta.
async function loadSearchPage() {
  const params = new URLSearchParams(window.location.search);
  SR.q = (params.get("q") || "").trim();
  SR.tag = (params.get("tag") || "").trim();
  SR.cat = parseInt(params.get("cat"), 10) || null;
  SR.view = (params.get("view") || "").trim().toLowerCase();
  // Sort accettati solo tra i valori validi; qualsiasi altra cosa la ignoro.
  const rawSort = (params.get("sort") || "").trim().toLowerCase();
  SR.sort = ["views", "useful", "recent"].includes(rawSort) ? rawSort : "";

  // Vista "esplora tag":griglia alfabetica di tutti i tag.
  if (SR.view === "tags") {
    document.title = "NETMED";
    renderTagCloudHero();
    renderClearToolbar();
    renderTagCloudSkeleton();
    const r = await api("/api/user/tags?limit=200");
    if (!r.ok) {
      const msg = (r.data && r.data.error) || "HTTP " + r.status;
      renderSearchError(`Tag non disponibili: ${msg}.`);
      return;
    }
    renderTagCloud(r.data.tags || []);
    return;
  }

  // Vista "esplora categorie": stessa logica del tag cloud.
  if (SR.view === "categories") {
    document.title = "NETMED";
    renderCatCloudHero();
    renderClearToolbar();
    renderTagCloudSkeleton();
    const r = await api("/api/user/categories");
    if (!r.ok) {
      const msg = (r.data && r.data.error) || "HTTP " + r.status;
      renderSearchError(`Categorie non disponibili: ${msg}.`);
      return;
    }
    renderCategoryCloud(Array.isArray(r.data) ? r.data : []);
    return;
  }

  // Nessun filtro attivo: mostro il prompt iniziale ("cosa stai cercando?").
  if (!SR.q && !SR.tag && !SR.cat && !SR.sort) {
    renderSearchPrompt();
    return;
  }

  // Se c'e' una query di testo, la ricopio nell'input dell'header
  // cosi' l'utente vede da dove viene il filtro.
  const input = document.getElementById("uhSearchInput");
  if (input && SR.q) input.value = SR.q;

  document.title = "NETMED";
  renderSearchSkeleton();

  let res;

  // Modalita' "Esplora": solo sort, niente altri filtri. Uso l'endpoint /explore che ha la stessa logica della home.
  if (SR.sort && !SR.q && !SR.tag && !SR.cat) {
    res = await api("/api/user/explore?sort=" + encodeURIComponent(SR.sort) + "&limit=48");

    if (!res.ok && (res.status === 404 || res.status === 0 || res.status >= 500)) {
      console.warn("[ricerca] /explore failed (" + res.status + "), fallback to /search");
      const qs = "sort=" + encodeURIComponent(SR.sort);
      res = await api("/api/user/search?" + qs);
    }

    if (!res.ok) {
      const errMsg = (res.data && res.data.error) || "HTTP " + res.status;
      renderSearchError(
        `Esplora non disponibile: ${errMsg}. Verifica che il server sia stato riavviato.`
      );
      return;
    }
    SR.data = { videos: res.data.videos || [], categories: [], tags: [] };
  } else {
    // Ricerca classica: combino q + tag + cat + sort nel query string.
    const qs = [];
    if (SR.q)   qs.push("q="   + encodeURIComponent(SR.q));
    if (SR.tag) qs.push("tag=" + encodeURIComponent(SR.tag));
    if (SR.cat) qs.push("cat=" + encodeURIComponent(SR.cat));
    if (SR.sort) qs.push("sort=" + encodeURIComponent(SR.sort));
    res = await api("/api/user/search?" + qs.join("&"));
    if (!res.ok) {
      renderSearchError((res.data && res.data.error) || "Errore di ricerca");
      return;
    }
    SR.data = {
      videos: res.data.videos || [],
      categories: res.data.categories || [],
      tags: res.data.tags || [],
    };
  }

  // Parto sempre dalla tab "Video": e' la piu' importante.
  SR.active = "videos";
  renderSearchHero();
  renderActiveFilters();
  renderSearchTabs();
  renderSearchActiveTab();
}

// Etichette per la modalita' "Esplora" (piu' visti / piu' utili / recenti).
function srSortLabel(sort) {
  switch (sort) {
    case "views":
      return {
        eyebrow: "Esplora",
        title: "Più visti",
        desc: "I video più visti su NETMED in questo momento.",
      };
    case "useful":
      return {
        eyebrow: "Esplora",
        title: "Più utili",
        desc: "I contenuti che gli utenti hanno trovato più utili.",
      };
    case "recent":
      return {
        eyebrow: "Esplora",
        title: "Recenti",
        desc: "I video pubblicati più di recente sulla piattaforma.",
      };
    default:
      return null;
  }
}

// Titolo grande in cima alla pagina, cambia in base al tipo di ricerca.
function renderSearchHero() {
  const hero = document.getElementById("vlHero");
  if (!hero) return;
  const total = SR.data.videos.length + SR.data.categories.length + SR.data.tags.length;

  let title = "";
  let eyebrow = "Risultati ricerca";
  let descOverride = null;

  // Casi: esplora / tag / categoria / query / mix
  if (SR.sort && !SR.q && !SR.tag && !SR.cat) {
    const meta = srSortLabel(SR.sort);
    if (meta) {
      eyebrow = meta.eyebrow;
      title = meta.title;
      descOverride = meta.desc;
    }
  } else if (SR.tag && !SR.q && !SR.cat) {
    eyebrow = "Tag";
    title = "#" + SR.tag;
  } else if (SR.cat && !SR.q && !SR.tag) {
    const c = (NM.categories || []).find((x) => x.id === SR.cat);
    eyebrow = "Categoria";
    title = c ? c.name : "Categoria";
  } else if (SR.q) {
    title = SR.q;
  } else {
    title = "Risultati filtrati";
  }

  // Sotto il titolo: descrizione contestuale oppure conteggio.
  let descHtml;
  if (descOverride) {
    descHtml = escapeHtml(descOverride);
  } else if (total === 0) {
    descHtml = "Nessun risultato trovato. Prova ad alleggerire i filtri.";
  } else {
    descHtml = `Trovati <strong>${total}</strong> risultati tra video, categorie e tag.`;
  }

  hero.innerHTML = `
    <div class="vl-hero-inner">
      <div class="vl-hero-eyebrow">${eyebrow}</div>
      <h1 class="vl-hero-title">${escapeHtml(title)}</h1>
      <p class="vl-hero-desc">${descHtml}</p>
    </div>
  `;
}

// Hero della pagina "Esplora tag".
function renderTagCloudHero() {
  const hero = document.getElementById("vlHero");
  if (!hero) return;
  hero.innerHTML = `
    <div class="vl-hero-inner">
      <div class="vl-hero-eyebrow">Tag</div>
      <h1 class="vl-hero-title">Esplora i tag</h1>
      <p class="vl-hero-desc">
        Trova rapidamente i video per argomento. Clicca un tag per vedere
        tutti i video associati.
      </p>
    </div>
  `;
}

// Hero della pagina "Esplora categorie".
function renderCatCloudHero() {
  const hero = document.getElementById("vlHero");
  if (!hero) return;
  hero.innerHTML = `
    <div class="vl-hero-inner">
      <div class="vl-hero-eyebrow">Categorie</div>
      <h1 class="vl-hero-title">Esplora le categorie</h1>
      <p class="vl-hero-desc">
        Tutte le aree mediche disponibili su NETMED. Clicca una categoria
        per vedere tutti i video associati.
      </p>
    </div>
  `;
}

// Esplora categorie
// Elenco alfabetico, ogni voce e' un bottone che apre la categoria.
function renderCategoryCloud(cats) {
  const grid = document.getElementById("vlGrid");
  if (!grid) return;
  grid.className = "";

  if (!cats.length) {
    grid.innerHTML = renderSearchEmpty("Nessuna categoria disponibile al momento.");
    return;
  }

  const sorted = cats
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "it", { sensitivity: "base" }));

  grid.innerHTML = `
    <div class="vl-tagcols" role="list" aria-label="Lista categorie">
      ${sorted
        .map(
          (c) => `
        <button class="vl-tagcol-item" type="button" role="listitem"
                onclick="goCategory(${c.id})"
                aria-label="Categoria ${escapeHtml(c.name)}">
          ${escapeHtml(c.name)}
        </button>
      `
        )
        .join("")}
    </div>
  `;
}

// Toolbar sopra la griglia: chip dei filtri attivi (q / tag / cat) + bottone "Cancella tutti"
function renderActiveFilters() {
  const tb = document.getElementById("vlToolbar");
  if (!tb) return;

  const chips = [];
  if (SR.q) {
    chips.push(`
      <span class="vl-fchip">
        <span class="vl-fchip-ico">Q</span>
        <span>${escapeHtml(SR.q)}</span>
        <button class="vl-fchip-x" type="button" onclick="srRemoveFilter('q')" aria-label="Rimuovi filtro testo">✕</button>
      </span>
    `);
  }
  if (SR.tag) {
    chips.push(`
      <span class="vl-fchip">
        <span class="vl-fchip-ico">#</span>
        <span>${escapeHtml(SR.tag)}</span>
        <button class="vl-fchip-x" type="button" onclick="srRemoveFilter('tag')" aria-label="Rimuovi tag">✕</button>
      </span>
    `);
  }
  if (SR.cat) {
    const c = (NM.categories || []).find((x) => x.id === SR.cat);
    chips.push(`
      <span class="vl-fchip">
        <span class="vl-fchip-ico"></span>
        <span>${escapeHtml(c ? c.name : "Cat. " + SR.cat)}</span>
        <button class="vl-fchip-x" type="button" onclick="srRemoveFilter('cat')" aria-label="Rimuovi categoria">✕</button>
      </span>
    `);
  }

  // Conto quanti filtri sono attivi (per etichetta e visibilita' bottone).
  const activeCount = chips.length + (SR.sort ? 1 : 0);
  const hasAny = activeCount > 0;
  let html = "";
  if (chips.length > 0) {
    html += `<div class="vl-fchips" aria-label="Filtri attivi">${chips.join("")}</div>`;
  }
  if (hasAny) {
    const label =
      activeCount === 1 ? "Cancella filtro" : `Cancella tutti i filtri (${activeCount})`;
    html += `<button class="nm-clear-btn" type="button" onclick="srClearAll()" title="Rimuovi tutti i filtri attivi (testo, tag, categoria, ordinamento)">
      <span class="nm-clear-ico" aria-hidden="true">✕</span><span>${label}</span>
    </button>`;
  }

  // Le tab arrivano da renderSearchTabs() con insertAdjacentHTML.
  tb.innerHTML = html;
}

// Tab Video / Categorie / Tag sopra la griglia.
// Mostro le tab suggerite (categorie/tag) solo se ho una query di testo.
function renderSearchTabs() {
  const tb = document.getElementById("vlToolbar");
  if (!tb) return;
  const v = SR.data.videos.length;
  const c = SR.data.categories.length;
  const t = SR.data.tags.length;

  const showSuggestions = !!SR.q && (c > 0 || t > 0);

  // Se non ho suggerimenti, evito la tab "Video" che sarebbe da sola: mostro solo un contatore risultati piu' discreto.
  let tabsHtml;
  if (!showSuggestions) {
    tabsHtml =
      '<div class="vl-result-count" role="status" aria-live="polite" ' +
        'style="margin-left:8px;color:var(--text-muted);font-size:13.5px;font-weight:500;align-self:center">' +
        v + (v === 1 ? " risultato" : " risultati") +
      '</div>' +
      '<div class="vl-toolbar-spacer"></div>';
  } else {
    tabsHtml = `
    <div class="vl-tabs" role="tablist">
      <button class="vl-tab ${SR.active === "videos" ? "active" : ""}" onclick="srTab('videos')">
        <span>Video</span><span class="vl-tab-count">${v}</span>
      </button>
      <button class="vl-tab ${SR.active === "categories" ? "active" : ""}" onclick="srTab('categories')">
        <span>Categorie</span><span class="vl-tab-count">${c}</span>
      </button>
      <button class="vl-tab ${SR.active === "tags" ? "active" : ""}" onclick="srTab('tags')">
        <span>Tag</span><span class="vl-tab-count">${t}</span>
      </button>
    </div>
    <div class="vl-toolbar-spacer"></div>
  `;
  }

  tb.insertAdjacentHTML("beforeend", tabsHtml);
}

// Click su una tab: aggiorno lo stato e ridisegno la griglia.
function srTab(name) {
  SR.active = name;
  document.querySelectorAll(".vl-tab").forEach((b) => b.classList.remove("active"));
  const order = ["videos", "categories", "tags"];
  const idx = order.indexOf(name);
  const btn = document.querySelectorAll(".vl-tab")[idx];
  if (btn) btn.classList.add("active");
  renderSearchActiveTab();
}

// Nelle pagine tag/categoria non voglio filtri o tab: toolbar vuota.
function renderClearToolbar() {
  const tb = document.getElementById("vlToolbar");
  if (tb) tb.innerHTML = "";
}

// Disegna il contenuto della tab attualmente selezionata.
function renderSearchActiveTab() {
  const grid = document.getElementById("vlGrid");
  if (!grid) return;

  if (SR.active === "videos") {
    if (!SR.data.videos.length) {
      grid.className = "vl-grid";
      grid.innerHTML = renderSearchEmpty("Nessun video trovato con questi filtri.");
      return;
    }
    grid.className = "vl-grid";
    // In modalita' "Esplora" pura (solo sort, niente altri filtri):
    //   - badge TOP 1/2/3 sulle prime tre card
    //   - metrica pertinente al sort (voti utili vs view)
    const isExploreMode = !!SR.sort && !SR.q && !SR.tag && !SR.cat;
    const showUseful = SR.sort === "useful";
    grid.innerHTML = SR.data.videos
      .map((v, i) => {
        const metric = showUseful
          ? typeof v.useful_count === "number"
            ? `<span class="dot" aria-hidden="true"></span><span>${formatViews(v.useful_count)}</span>`
            : ""
          : typeof v.views_count === "number"
            ? `<span class="dot" aria-hidden="true"></span><span>${formatViews(v.views_count)}</span>`
            : "";

        const topBadge =
          isExploreMode && i < 3
            ? `<span class="vl-card-top vl-card-top-${i + 1}" aria-label="Posizione ${i + 1}">
             <span class="vl-card-top-num">${i + 1}</span>
             <span class="vl-card-top-lbl">TOP</span>
           </span>`
            : "";

        // Autore + data pubblicazione
        const authorUsername = v.author_username || v.uploaded_by_username || "";
        const authorVerified = !!(v.author_is_verified || v.uploaded_by_verified);
        const verifTick = authorVerified
          ? `<span class="verified-tick" aria-label="Verificato" title="Creator verificato"></span>`
          : "";
        const authorHtml = authorUsername
          ? `<span class="vl-author" onclick="event.stopPropagation();goCreatorPublic('${escapeAttr(authorUsername)}')" title="Visita il profilo di @${escapeHtml(authorUsername)}">
             <span class="vl-author-by">di</span>
             <span class="vl-author-name">${escapeHtml(authorUsername)}${verifTick}</span>
           </span>`
          : "";
        const datePub = v.created_at
          ? `<span class="vl-date" title="${escapeHtml(new Date(v.created_at).toLocaleString("it-IT"))}">${timeAgo(v.created_at)}</span>`
          : "";

        return `
      <article class="vl-card ${isExploreMode && i < 3 ? "vl-card-podium" : ""}"
               onclick="nmOpenVideoPreview(${v.id})" role="link" tabindex="0"
               data-video-id="${v.id}"
               data-yt="${escapeHtml(v.youtube_id || "")}"
               aria-label="${escapeHtml(v.title || "Video")}"
               onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goVideo(${v.id})}">
        <div class="vl-thumb">
          <img src="${escapeHtml(thumbUrl(v))}" alt="${escapeHtml(v.title || "")}" loading="lazy" decoding="async" onerror="this.style.opacity=0">
          <div class="vl-thumb-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg></div>
          ${topBadge}
        </div>
        <div class="vl-body">
          <h3 class="vl-title">${escapeHtml(v.title || "")}</h3>
          <div class="vl-meta">
            ${v.category_name ? `<span class="vl-cat">${escapeHtml(v.category_name)}</span>` : ""}
            ${metric}
          </div>
          <div class="vl-meta vl-meta-2">
            ${authorHtml}
            ${authorHtml && datePub ? `<span class="dot" aria-hidden="true"></span>` : ""}
            ${datePub}
          </div>
        </div>
      </article>`;
      })
      .join("");
    return;
  }

  if (SR.active === "categories") {
    grid.className = "";
    if (!SR.data.categories.length) {
      grid.innerHTML = renderSearchEmpty("Nessuna categoria con questo nome.");
      return;
    }
    grid.innerHTML = `
      <div class="vl-chip-grid">
        ${SR.data.categories
          .map(
            (c) => `
          <span class="vl-chip" onclick="goCategory(${c.id})" role="link" tabindex="0"
                aria-label="Categoria ${escapeHtml(c.name)}"
                onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goCategory(${c.id})}">
            <span class="vl-chip-ico" aria-hidden="true"></span>${escapeHtml(c.name)}
          </span>
        `
          )
          .join("")}
      </div>
    `;
    return;
  }

  if (SR.active === "tags") {
    grid.className = "";
    if (!SR.data.tags.length) {
      grid.innerHTML = renderSearchEmpty("Nessun tag corrispondente.");
      return;
    }
    grid.innerHTML = `
      <div class="vl-chip-grid">
        ${SR.data.tags
          .map(
            (t) => `
          <span class="vl-chip" onclick="srApplyTag('${escapeAttr(t.name)}')" role="link" tabindex="0"
                aria-label="Tag ${escapeHtml(t.name)}"
                onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();srApplyTag('${escapeAttr(t.name)}')}">
            <span class="vl-chip-ico" aria-hidden="true">#</span>${escapeHtml(t.name)}
          </span>
        `
          )
          .join("")}
      </div>
    `;
    return;
  }
}

// Skeleton di caricamento per la vista tag/categorie
function renderTagCloudSkeleton() {
  const grid = document.getElementById("vlGrid");
  if (!grid) return;
  grid.className = "";
  let html = `<div class="vl-tagcloud">`;
  for (let i = 0; i < 24; i++) {
    const w = 60 + Math.floor(Math.random() * 80);
    html += `<span class="vl-tagcloud-sk" style="width:${w}px"></span>`;
  }
  html += `</div>`;
  grid.innerHTML = html;
}

// Griglia dei tag in colonne alfabetiche 
function renderTagCloud(tags) {
  const grid = document.getElementById("vlGrid");
  if (!grid) return;
  grid.className = "";

  if (!tags.length) {
    grid.innerHTML = renderSearchEmpty("Nessun tag disponibile al momento.");
    return;
  }

  const sorted = tags
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "it", { sensitivity: "base" }));

  grid.innerHTML = `
    <div class="vl-tagcols" role="list" aria-label="Lista tag">
      ${sorted
        .map(
          (t) => `
        <button class="vl-tagcol-item" type="button" role="listitem"
                onclick="srApplyTag('${escapeAttr(t.name)}')"
                aria-label="Tag ${escapeHtml(t.name)} (${t.video_count} video)"
                title="${t.video_count} video">
          ${escapeHtml(t.name)}
        </button>
      `
        )
        .join("")}
    </div>
  `;
}

// Applica il filtro tag preservando q e cat correnti nell'URL.
function srApplyTag(name) {
  const params = new URLSearchParams();
  if (SR.q) params.set("q", SR.q);
  params.set("tag", name);
  if (SR.cat) params.set("cat", String(SR.cat));
  goTo("search.html?" + params.toString());
}

// Rimuove un singolo filtro dal query string e ricarica la pagina.
function srRemoveFilter(name) {
  const params = new URLSearchParams();
  if (name !== "q" && SR.q) params.set("q", SR.q);
  if (name !== "tag" && SR.tag) params.set("tag", SR.tag);
  if (name !== "cat" && SR.cat) params.set("cat", String(SR.cat));
  const qs = params.toString();
  if (!qs) {
    goTo("search.html");
  } else {
    goTo("search.html?" + qs);
  }
}

// Reset completo di tutti i filtri.
function srClearAll() {
  goTo("search.html");
}

// Skeleton di caricamento per la griglia video: 8 card grigie mentre parte la fetch.
function renderSearchSkeleton() {
  const grid = document.getElementById("vlGrid");
  if (!grid) return;
  grid.className = "vl-grid";
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

// Pagina di partenza (nessun filtro nell'URL): saluto + link a "esplora tag".
function renderSearchPrompt() {
  const hero = document.getElementById("vlHero");
  const tb = document.getElementById("vlToolbar");
  const grid = document.getElementById("vlGrid");
  if (hero)
    hero.innerHTML = `
    <div class="vl-hero-inner">
      <div class="vl-hero-eyebrow">Ricerca</div>
      <h1 class="vl-hero-title">Cosa stai cercando?</h1>
      <p class="vl-hero-desc">
        Usa la barra in alto per cercare video, categorie o tag.
        Oppure <a class="vl-hero-link" onclick="goTo('search.html?view=tags')">esplora tutti i tag</a>.
      </p>
    </div>
  `;
  if (tb) tb.innerHTML = "";
  if (grid) {
    grid.className = "";
    grid.innerHTML = "";
  }
}

// Bootstrap della pagina. Chiamo le funzioni globali del core.js (tema, auth, header, ricerca live) e poi la mia loadSearchPage.
(function init() {
  if (typeof loadTheme === "function") loadTheme();
  if (typeof loadAuth === "function") loadAuth();
  if (typeof renderHeaderUser === "function") renderHeaderUser();
  if (typeof refreshAuthMe === "function") refreshAuthMe();
  if (typeof initUserSearch === "function") initUserSearch();
  if (typeof loadHeaderCategoriesForSearchPage === "function") loadHeaderCategoriesForSearchPage();
  loadSearchPage();

  // Sync cross-tab: se in un altro tab l'utente cambia tema o fa logout,
  // aggiorno anche questa pagina senza refresh.
  window.addEventListener("storage", function (e) {
    if (e.key === "nm_theme") loadTheme();
    if (e.key === "token" || e.key === "user") {
      loadAuth();
      renderHeaderUser();
    }
  });
})();