// - videos: tutti i video salvati dall'utente
// - collections: le cartelle create {id, name, video_count}
// - active: null = "Tutti i salvati", altrimenti l'id della cartella aperta
// - colVideos: video della cartella attiva
const FAV = {
  videos: [],
  collections: [],
  active: null,
  colVideos: [],
  sort: "recent",
};

// Ritorna la lista di video attualmente visualizzata.
function favCurrentList() {
  return FAV.active === null ? FAV.videos : FAV.colVideos;
}

// Carica preferiti + cartelle
async function loadFavoritesPage() {
  if (!NM.user) return goLogin();

  renderFavSkeleton();
  const [favRes, colRes] = await Promise.all([
    api("/api/user/favorites"),
    api("/api/user/collections"),
  ]);
  if (!favRes.ok) {
    if (favRes.status === 401) return goLogin();
    renderFavError((favRes.data && favRes.data.error) || "Errore di caricamento");
    return;
  }
  FAV.videos = favRes.data || [];
  FAV.collections = colRes.ok && Array.isArray(colRes.data) ? colRes.data : [];
  FAV.active = null;
  document.title = "NETMED";

  renderFavHero();
  renderCollectionsBar();
  renderFavToolbar();
  renderFavGrid();
}

// Placeholder grigio mentre parte la fetch.
function renderFavSkeleton() {
  const grid = document.getElementById("vlGrid");
  if (!grid) return;
  let html = "";
  for (let i = 0; i < 6; i++) {
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

// Header con titolo + descrizione + contatori.
function renderFavHero() {
  const hero = document.getElementById("vlHero");
  if (!hero) return;
  const n = FAV.videos.length;
  const nc = FAV.collections.length;
  hero.innerHTML = `
    <div class="vl-hero-inner">
      <div class="vl-hero-eyebrow">La mia libreria</div>
      <h1 class="vl-hero-title">I miei salvati</h1>
      <p class="vl-hero-desc">
        Tutti i video che hai salvato, organizzati in cartelle come vuoi tu.
      </p>
      <div class="vl-hero-stats">
        <span><strong>${n}</strong> ${n === 1 ? "video salvato" : "video salvati"}</span>
        ${nc ? `<span><strong>${nc}</strong> ${nc === 1 ? "cartella" : "cartelle"}</span>` : ""}
      </div>
    </div>
  `;
}

// Barra orizzontale con le "chip" cartelle + bottone "+ Nuova cartella".
function renderCollectionsBar() {
  const bar = document.getElementById("vlCollections");
  if (!bar) return;
  const chip = (id, label, count, active) => `
    <button class="vl-col-chip ${active ? "active" : ""}" type="button"
            onclick="favSelectCollection(${id === null ? "null" : id})">
      <span class="vl-col-name">${escapeHtml(label)}</span>
      <span class="vl-col-count">${count}</span>
    </button>`;
  // Prima chip = "Tutti i salvati" (id null), poi una chip per ogni cartella.
  let html = chip(null, T("fav.all_saved", "Tutti i salvati"), FAV.videos.length, FAV.active === null);
  html += FAV.collections
    .map((c) => chip(c.id, c.name, c.video_count, FAV.active === c.id))
    .join("");
  html += `<button class="vl-col-new" type="button" onclick="favNewCollectionPrompt()">+ Nuova cartella</button>`;
  bar.innerHTML = html;
}

function favNewCollectionPrompt() {
  const bar = document.getElementById("vlCollections");
  if (!bar) return;
  const btn = bar.querySelector(".vl-col-new");
  if (!btn) return;
  btn.outerHTML = `
    <input class="vl-col-newinput" id="vlColNewInput" type="text" maxlength="60" autocomplete="off"
           placeholder="Nome cartella, premi Invio"
           onkeydown="if(event.key==='Enter'){favCreateCollection()}else if(event.key==='Escape'){renderCollectionsBar()}"/>`;
  const inp = document.getElementById("vlColNewInput");
  if (inp) inp.focus();
}

// Crea la cartella con il nome digitato nell'input.
async function favCreateCollection() {
  const inp = document.getElementById("vlColNewInput");
  if (!inp) return;
  const name = inp.value.trim();
  if (!name) {
    renderCollectionsBar();
    return;
  }
  inp.disabled = true;
  const r = await api("/api/user/collections", { method: "POST", body: { name } });
  if (!r.ok || !r.data || !r.data.id) {
    toast((r.data && r.data.error) || "Impossibile creare la cartella", "err");
    renderCollectionsBar();
    return;
  }
  FAV.collections.push(r.data);
  toast('Cartella "' + r.data.name + '" creata', "ok");
  renderFavHero();
  renderCollectionsBar();
}

// Apre la cartella cliccata (o "Tutti i salvati" se id=null).
async function favSelectCollection(id) {
  FAV.active = id;
  if (id === null) {
    renderCollectionsBar();
    renderFavToolbar();
    renderFavGrid();
    return;
  }
  renderCollectionsBar();
  renderFavSkeleton();
  const r = await api("/api/user/collections/" + id + "/videos");
  FAV.colVideos = r.ok && Array.isArray(r.data) ? r.data : [];
  renderFavToolbar();
  renderFavGrid();
}

// Elimina la cartella attiva. I video restano comunque nei salvati.
async function favDeleteCollection() {
  if (FAV.active === null) return;
  const col = FAV.collections.find((c) => c.id === FAV.active);
  const ok = await nmConfirm({
    title: T("fav.confirm_delete_title", "Eliminare la cartella?"),
    message:
      'La cartella "' +
      (col ? col.name : "") +
      '" sara\' eliminata. I video restano comunque nei tuoi salvati.',
    okLabel: "Elimina",
    cancelLabel: "Annulla",
    danger: true,
  });
  if (!ok) return;
  const r = await api("/api/user/collections/" + FAV.active, { method: "DELETE" });
  if (!r.ok) {
    toast((r.data && r.data.error) || "Errore", "err");
    return;
  }
  FAV.collections = FAV.collections.filter((c) => c.id !== FAV.active);
  FAV.active = null;
  toast("Cartella eliminata", "ok");
  renderFavHero();
  renderCollectionsBar();
  renderFavToolbar();
  renderFavGrid();
}

// Toolbar sopra la griglia: sort + bottoni Aggiungi/Elimina cartella.
function renderFavToolbar() {
  const tb = document.getElementById("vlToolbar");
  if (!tb) return;
  const inFolder = FAV.active !== null;
  const hasItems = !!favCurrentList().length;

  // In cartella la toolbar c'e' sempre (per Aggiungi/Elimina), anche vuota.
  if (!hasItems && !inFolder) {
    tb.innerHTML = "";
    return;
  }

  const addBtn = inFolder
    ? `<button class="nm-add-btn" type="button" onclick="favOpenAddVideosPicker()" title="Aggiungi video già salvati a questa cartella">
         <span aria-hidden="true">+</span><span>Aggiungi video salvati</span>
       </button>`
    : "";
  const delBtn = inFolder
    ? `<button class="nm-clear-btn" type="button" onclick="favDeleteCollection()" title="Elimina questa cartella">
         <span class="nm-clear-ico" aria-hidden="true">✕</span><span>Elimina cartella</span>
       </button>`
    : "";
  const sortHtml = hasItems
    ? `<label class="vl-toolbar-label" for="vlSortSelect">Ordina per</label>
       <select class="vl-select" id="vlSortSelect" onchange="favChangeSort(this.value)" aria-label="Ordina i video">
         <option value="recent" ${FAV.sort === "recent" ? "selected" : ""}>Aggiunti di recente</option>
         <option value="az"     ${FAV.sort === "az" ? "selected" : ""}>A → Z</option>
       </select>`
    : "";
  tb.innerHTML = `
    ${sortHtml}
    ${addBtn}
    ${delBtn}
    <div class="vl-toolbar-spacer"></div>
  `;
}

// Modale "Aggiungi video salvati alla cartella attiva":
// mostra i video che ho gia' nei salvati ma non ancora in questa cartella.
function favOpenAddVideosPicker() {
  if (FAV.active === null) return;
  const m = document.getElementById("vlFModal");
  if (!m) return;
  const inFolderIds = new Set(FAV.colVideos.map((v) => v.id));
  const candidates = FAV.videos.filter((v) => !inFolderIds.has(v.id));
  const col = FAV.collections.find((c) => c.id === FAV.active);
  const title = col ? 'Aggiungi a "' + escapeHtml(col.name) + '"' : T("fav.add_folder_title", "Aggiungi video");

  let body;
  if (!candidates.length) {
    body = `<div class="vl-fmodal-empty">Tutti i video salvati sono già in questa cartella.<br>
            <a class="vl-hero-link" onclick="favCloseFolderPicker();favSelectCollection(null)">Vai a ${T("fav.all_saved", "Tutti i salvati")}</a> per salvarne altri.</div>`;
  } else {
    body = candidates
      .map(
        (v) => `
        <label class="vl-fmodal-vrow">
          <input type="checkbox" value="${v.id}" class="vl-fmodal-check"/>
          <img src="${escapeHtml(thumbUrl(v))}" alt="" class="vl-fmodal-thumb" loading="lazy" onerror="this.style.opacity=0"/>
          <span class="vl-fmodal-vtitle">${escapeHtml(v.title || "Senza titolo")}</span>
        </label>`
      )
      .join("");
  }

  m.innerHTML = `
    <div class="vl-fmodal vl-fmodal-large" onclick="event.stopPropagation()" role="dialog" aria-modal="true">
      <div class="vl-fmodal-h">
        <span>${title}</span>
        <button class="vl-fmodal-x" type="button" onclick="favCloseFolderPicker()" aria-label="Chiudi">✕</button>
      </div>
      <div class="vl-fmodal-list">${body}</div>
      ${
        candidates.length
          ? `<div class="vl-fmodal-foot">
              <span class="vl-fmodal-meta" id="vlFModalMeta">0 selezionati</span>
              <button class="vl-fmodal-create" type="button" onclick="favBulkAddSelected()">Aggiungi alla cartella</button>
            </div>`
          : ""
      }
    </div>`;
  m.classList.add("open");
  m.onclick = favCloseFolderPicker;
  // Contatore live "N selezionati" mentre l'utente spunta le checkbox.
  m.querySelectorAll(".vl-fmodal-check").forEach(function (cb) {
    cb.addEventListener("change", function () {
      const n = m.querySelectorAll(".vl-fmodal-check:checked").length;
      const meta = document.getElementById("vlFModalMeta");
      if (meta) meta.textContent = n + " selezionati";
    });
  });
}

// Aggiunge  i video spuntati alla cartella attiva.
async function favBulkAddSelected() {
  const m = document.getElementById("vlFModal");
  if (!m || FAV.active === null) return;
  const ids = Array.prototype.slice
    .call(m.querySelectorAll(".vl-fmodal-check:checked"))
    .map((cb) => parseInt(cb.value, 10))
    .filter((n) => !isNaN(n));
  if (!ids.length) {
    toast("Seleziona almeno un video", "info");
    return;
  }
  // L'API accetta un id per volta: mando una POST per ognuno e conto ok/fail.
  let ok = 0, fail = 0;
  for (const vid of ids) {
    const r = await api("/api/user/collections/" + FAV.active + "/videos", {
      method: "POST",
      body: { video_id: vid },
    });
    if (r.ok) {
      ok++;
      const found = FAV.videos.find((v) => v.id === vid);
      if (found && !FAV.colVideos.some((v) => v.id === vid)) FAV.colVideos.push(found);
    } else {
      fail++;
    }
  }
  const col = FAV.collections.find((c) => c.id === FAV.active);
  if (col) col.video_count = FAV.colVideos.length;
  toast(
    ok
      ? ok + (ok === 1 ? " video aggiunto" : " video aggiunti") + (fail ? " (" + fail + " falliti)" : "")
      : "Nessun video aggiunto",
    ok ? "ok" : "err"
  );
  favCloseFolderPicker();
  renderCollectionsBar();
  renderFavToolbar();
  renderFavGrid();
}

// Cambio ordinamento dal <select>.
function favChangeSort(value) {
  FAV.sort = value;
  renderFavGrid();
}

// Griglia principale dei video (in "Tutti i salvati" o in una cartella).
function renderFavGrid() {
  const grid = document.getElementById("vlGrid");
  if (!grid) return;
  const inFolder = FAV.active !== null;
  const list = favCurrentList().slice();

  if (!list.length) {
    grid.innerHTML = `
      <div class="vl-empty" style="grid-column:1/-1">
        <div class="vl-empty-ico">${(window.NMUI && NMUI.illust("bookmark")) || ""}</div>
        <div class="vl-empty-t">${inFolder ? T("fav.folder_empty", "Cartella vuota") : T("fav.no_saved", "Nessun video salvato")}</div>
        <div class="vl-empty-d">${
          inFolder
            ? "Apri 'Tutti i salvati' e usa il bottone cartella su un video per aggiungerlo qui."
            : "Salva i video con il bottone Salva e li ritroverai qui."
        }</div>
        <button class="vl-empty-btn" onclick="${inFolder ? "favSelectCollection(null)" : "goTo('home.html')"}">${inFolder ? "Vai a tutti i salvati" : "Esplora il catalogo"}</button>
      </div>
    `;
    return;
  }

  // Ordinamento: A→Z per titolo o piu' recenti per data di aggiunta.
  if (FAV.sort === "az") {
    list.sort((a, b) =>
      (a.title || "").localeCompare(b.title || "", "it", { sensitivity: "base" })
    );
  } else {
    list.sort((a, b) => new Date(b.favorited_at) - new Date(a.favorited_at));
  }

  grid.innerHTML = list
    .map(
      (v) => `
    <article class="vl-card removable" data-vid="${v.id}"
             data-video-id="${v.id}"
             data-yt="${escapeHtml(v.youtube_id || "")}"
             aria-label="${escapeHtml(v.title || "Video salvato")}">
      <div class="vl-thumb" onclick="nmOpenVideoPreview(${v.id})" role="link" tabindex="0"
           onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goVideo(${v.id})}">
        ${
          inFolder
            ? `<button class="vl-thumb-rm" title="Togli dalla cartella" aria-label="Togli dalla cartella"
                     onclick="event.stopPropagation(); favRemoveFromCollection(${v.id})">×</button>`
            : `<button class="vl-thumb-rm" title="Rimuovi dai salvati" aria-label="Rimuovi dai salvati"
                     onclick="event.stopPropagation(); favRemove(${v.id})">×</button>
             <button class="vl-thumb-fold" title="${T("fav.add_folder_title", "Aggiungi a una cartella")}" aria-label="${T("fav.add_folder_title", "Aggiungi a una cartella")}"
                     onclick="event.stopPropagation(); favOpenFolderPicker(${v.id})">+ cartella</button>`
        }
        <img src="${escapeHtml(thumbUrl(v))}" alt="${escapeHtml(v.title || "")}" loading="lazy" decoding="async" onerror="this.style.opacity=0">
        <div class="vl-thumb-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg></div>
      </div>
      <div class="vl-body" onclick="nmOpenVideoPreview(${v.id})">
        <h3 class="vl-title">${escapeHtml(v.title || "")}</h3>
        <div class="vl-meta">
          ${v.category_name ? `<span class="vl-cat">${escapeHtml(v.category_name)}</span><span class="dot" aria-hidden="true"></span>` : ""}
          <span>${inFolder ? "Aggiunto" : "Salvato"} ${timeAgo(v.favorited_at)}</span>
        </div>
      </div>
    </article>
  `
    )
    .join("");
}

// Rimuove un video dai salvati (endpoint /favorite fa toggle).
async function favRemove(videoId) {
  const res = await api("/api/user/videos/" + videoId + "/favorite", { method: "POST" });
  if (!res.ok) {
    if (res.status === 401) return goLogin();
    toast((res.data && res.data.error) || "Operazione fallita", "err");
    return;
  }
  if (res.data && res.data.is_favorite === true) {
    await api("/api/user/videos/" + videoId + "/favorite", { method: "POST" });
  }
  FAV.videos = FAV.videos.filter((v) => v.id !== videoId);
  FAV.colVideos = FAV.colVideos.filter((v) => v.id !== videoId);
  renderFavHero();
  renderCollectionsBar();
  renderFavToolbar();
  renderFavGrid();
  toast("Rimosso dai salvati", "ok");
}

// Toglie un video da una cartella (resta comunque nei salvati generali).
async function favRemoveFromCollection(videoId) {
  if (FAV.active === null) return;
  const r = await api("/api/user/collections/" + FAV.active + "/videos/" + videoId, {
    method: "DELETE",
  });
  if (!r.ok) {
    toast((r.data && r.data.error) || "Errore", "err");
    return;
  }

  FAV.colVideos = FAV.colVideos.filter((v) => v.id !== videoId);
  const col = FAV.collections.find((c) => c.id === FAV.active);
  if (col && col.video_count > 0) col.video_count--;
  toast("Tolto dalla cartella", "ok");
  renderCollectionsBar();
  renderFavToolbar();
  renderFavGrid();
}

// Modale "Aggiungi questo video a una cartella" (dal bottone sulla card).
function favOpenFolderPicker(videoId) {
  const m = document.getElementById("vlFModal");
  if (!m) return;
  const rows = FAV.collections.length
    ? FAV.collections
        .map(
          (c) => `
        <button class="vl-fmodal-row" type="button" onclick="favAddToCollection(${c.id}, ${videoId})">
          <span class="vl-col-name">${escapeHtml(c.name)}</span>
          <span class="vl-col-count">${c.video_count}</span>
        </button>`
        )
        .join("")
    : `<div class="vl-fmodal-empty">Non hai ancora cartelle: creane una qui sotto.</div>`;
  m.innerHTML = `
    <div class="vl-fmodal" onclick="event.stopPropagation()" role="dialog" aria-modal="true">
      <div class="vl-fmodal-h">
        <span>Aggiungi a una cartella</span>
        <button class="vl-fmodal-x" type="button" onclick="favCloseFolderPicker()" aria-label="Chiudi">✕</button>
      </div>
      <div class="vl-fmodal-list">${rows}</div>
      <div class="vl-fmodal-foot">
        <input id="vlFModalNew" type="text" maxlength="60" autocomplete="off" placeholder="Nuova cartella…"
               onkeydown="if(event.key==='Enter'){favCreateAndAdd(${videoId})}"/>
        <button class="vl-fmodal-create" type="button" onclick="favCreateAndAdd(${videoId})">Crea e aggiungi</button>
      </div>
    </div>`;
  m.classList.add("open");
  m.onclick = favCloseFolderPicker;
}

// Chiude e svuota la modale cartelle.
function favCloseFolderPicker() {
  const m = document.getElementById("vlFModal");
  if (!m) return;
  m.classList.remove("open");
  m.innerHTML = "";
}

// Aggiunge un video a una cartella esistente.
async function favAddToCollection(colId, videoId) {
  const r = await api("/api/user/collections/" + colId + "/videos", {
    method: "POST",
    body: { video_id: videoId },
  });
  if (!r.ok) {
    toast((r.data && r.data.error) || "Errore", "err");
    return;
  }
  const col = FAV.collections.find((c) => c.id === colId);
  if (col) col.video_count = (col.video_count || 0) + 1;
  toast(col ? 'Aggiunto a "' + col.name + '"' : "Aggiunto alla cartella", "ok");
  favCloseFolderPicker();
  renderCollectionsBar();
}

// Crea una nuova cartella e ci aggiunge subito il video corrente.
async function favCreateAndAdd(videoId) {
  const inp = document.getElementById("vlFModalNew");
  if (!inp) return;
  const name = inp.value.trim();
  if (!name) { inp.focus(); return; }
  inp.disabled = true;
  const r = await api("/api/user/collections", { method: "POST", body: { name } });
  if (!r.ok || !r.data || !r.data.id) {
    toast((r.data && r.data.error) || "Errore", "err");
    inp.disabled = false;
    return;
  }
  FAV.collections.push(r.data);
  renderFavHero();
  await favAddToCollection(r.data.id, videoId);
}

// Errore di caricamento: mostro empty state con "Riprova".
function renderFavError(msg) {
  const grid = document.getElementById("vlGrid");
  if (!grid) return;
  grid.innerHTML = `
    <div class="vl-empty" style="grid-column:1/-1">
      <div class="vl-empty-ico">${(window.NMUI && NMUI.illust("warning", { variant: "warn" })) || ""}</div>
      <div class="vl-empty-t">Impossibile caricare i salvati</div>
      <div class="vl-empty-d">${escapeHtml(msg)}</div>
      <button class="vl-empty-btn" onclick="loadFavoritesPage()">Riprova</button>
    </div>
  `;
}

// loadAuth() di core.js e' sincrono (legge da localStorage). Un piccolo setTimeout garantisce che il tryBootstrap di core.js abbia gia' girato.
(function bootstrapPreferiti() {
  function start() {
    if (typeof window.NM === "undefined" || !window.NM) {
      window.NM = window.NM || { user: null, token: null };
    }
    if (!NM.user && typeof loadAuth === "function") {
      try { loadAuth(); } catch (_) {}
    }
    if (!NM.user) {
      if (typeof goLogin === "function") return goLogin();
      window.location.href = "login.html";
      return;
    }
    loadFavoritesPage();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(start, 30); }, { once: true });
  } else {
    setTimeout(start, 30);
  }
})();