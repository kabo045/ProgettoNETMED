// Ordina il rendering in questo modo:
//   1) Hero editoriale (5 slide con SVG + titoli + CTA che portano alle categorie reali dal DB)
//   2) Righe categorie (dal backend, /api/user/home)
//   3) Righe extra "esplora" (Top 10, Piu' utili) - anche per guest
//   4) Righe utente loggato (Continua a guardare, Riguarda)

// Skeleton di caricamento: 3 righe grigie con 6 card ognuna.
function renderHomeSkeleton() {
  const heroEl = document.getElementById("hero");
  if (heroEl) heroEl.classList.add("loading");

  const rowsBox = document.getElementById("homeRows");
  if (!rowsBox) return;

  let html = "";
  for (let i = 0; i < 3; i++) {
    html += `
      <section class="row">
        <div class="row-header">
          <h2 class="row-title outfit"><span class="sk" style="display:inline-block;width:140px;height:18px;border-radius:6px;background:var(--surface-2)"></span></h2>
        </div>
        <div class="row-scroll-wrap">
          <div class="row-scroll">
            ${Array.from({ length: 6 })
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
  rowsBox.innerHTML = html;
}

// Disegna le righe per categoria. Ogni riga ha titolo + link "Vedi tutti"
function renderRows(rows) {
  const box = document.getElementById("homeRows");
  if (!box) return;

  if (!rows.length) {
    // Empty state se non ci sono categorie con video.
    box.innerHTML = `
      <section class="home-empty" style="padding:48px 24px;text-align:center">
        <div style="font-size:48px;line-height:1;margin-bottom:14px">\u{1F3AC}</div>
        <h2 class="outfit" style="font-size:22px;margin:0 0 8px">Stiamo caricando i contenuti</h2>
        <p style="color:var(--text2);margin:0 0 20px;max-width:520px;margin-left:auto;margin-right:auto;line-height:1.5">
          Al momento non ci sono ancora video pubblicati nelle categorie.
          Torna a trovarci tra poco: nuovi contenuti stanno arrivando.
        </p>
        <div style="display:inline-flex;gap:10px;flex-wrap:wrap;justify-content:center">
          <button class="hero-btn hero-btn-info" onclick="goTo('search.html')" style="padding:10px 22px">Esplora il catalogo</button>
          ${!NM.user ? '<button class="hero-btn hero-btn-play" onclick="goLogin()" style="padding:10px 22px">Accedi</button>' : ""}
        </div>
      </section>
    `;
    return;
  }

  box.innerHTML = rows
    .map((r, idx) => {
      // Categorie "virtuali" (id <= 0) sono raggruppamenti speciali. Niente link "Vedi tutti" perche' non hanno una pagina categoria dedicata.
      const isVirtual = r.category.id <= 0;
      const linkHtml = isVirtual
        ? ""
        : `<span class="row-link" onclick="goCategory(${r.category.id})">Vedi tutti</span>`;
      const scrollId = r.category.id < 0 ? "orph" : String(r.category.id);
      return `
      <section class="row" data-row-id="${scrollId}" style="animation: fadeUp .5s ease ${0.05 * idx}s both">
        <div class="row-header">
          <h2 class="row-title outfit">${escapeHtml(r.category.name)}</h2>
          ${linkHtml}
        </div>
        <div class="row-scroll-wrap">
          <button class="row-arrow left"  onclick="rowScroll('${scrollId}', -1)" aria-label="Scorri a sinistra">\u2039</button>
          <button class="row-arrow right" onclick="rowScroll('${scrollId}',  1)" aria-label="Scorri a destra">\u203A</button>
          <div class="row-scroll" id="rowScroll-${scrollId}" role="list">
            ${r.videos.map(renderVideoCard).join("")}
          </div>
        </div>
      </section>
    `;
    })
    .join("");

  // Aggiorno lo stato disabled/enabled delle frecce per ogni riga.
  rows.forEach((r) => {
    const sid = r.category.id < 0 ? "orph" : String(r.category.id);
    updateArrows(sid);
  });
}

// Card singolo video 
function renderVideoCard(v) {
  return `
    <article class="vcard" onclick="nmOpenVideoPreview(${v.id})" role="link" tabindex="0"
             aria-label="${escapeHtml(v.title || "Video")}"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goVideo(${v.id})}">
      <div class="vcard-thumb">
        <img src="${escapeHtml(thumbUrl(v))}" alt="${escapeHtml(v.title || "")}" loading="lazy" decoding="async" onerror="this.style.opacity=0">
        <div class="vcard-play" aria-hidden="true">\u25B6</div>
      </div>
      <div class="vcard-body">
        <h3 class="vcard-title">${escapeHtml(v.title || "")}</h3>
        <div class="vcard-meta">
          ${v.category_name ? `<span class="vcard-cat">${escapeHtml(v.category_name)}</span><span class="dot"></span>` : ""}
          <span>${formatViews(v.views_count)}</span>
          <span class="dot" aria-hidden="true"></span>
          <span>${timeAgo(v.created_at)}</span>
        </div>
      </div>
    </article>
  `;
}

// Il setTimeout aspetta che l'animazione finisca prima di aggiornare lo stato delle frecce.
function rowScroll(sid, dir) {
  const el = document.getElementById("rowScroll-" + sid);
  if (!el) return;
  const amount = el.clientWidth * 0.8;
  el.scrollBy({ left: dir * amount, behavior: "smooth" });
  setTimeout(() => updateArrows(sid), 380);
}
window.rowScroll = rowScroll;

// Disabilita le frecce quando si arriva ai bordi della scroll.
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

// Bootstrap principale della home. Chiama le funzioni in ordine.
async function loadHome() {
  renderHomeSkeleton();

  const res = await api("/api/user/home");

  let rows = [];
  if (res.ok && res.data) {
    rows = res.data.rows || [];
  } else {
    console.warn("[home] /api/user/home non disponibile");
  }

  renderEditorialHero();
  renderRows(rows);
  renderTopWeekRow();
  renderMostUsefulRow();

  // Righe solo per utenti loggati.
  if (NM.user) {
    renderContinueWatching();
    renderRewatchRow();
  }
}

// Riga "Riguarda": mostra i video con piu' visualizzazioni nella mia cronologia . Salto il primo perche'
// e' quasi certamente gia' in "Continua a guardare".
async function renderRewatchRow() {
  const r = await api("/api/user/me/history?page=1&limit=12");
  if (!r.ok || !r.data || !Array.isArray(r.data.items) || r.data.items.length < 3) return;

  const box = document.getElementById("homeRows");
  if (!box) return;
  const existing = document.querySelector('.row[data-row-id="rewatch"]');
  if (existing) existing.remove();

  const items = r.data.items
    .slice()
    .sort((a, b) => (b.view_count || 1) - (a.view_count || 1))
    .slice(1, 13);
  if (!items.length) return;

  const cardHtml = items
    .map((v) => {
      const thumb =
        v.thumbnail_url ||
        (v.youtube_id
          ? `https://i.ytimg.com/vi/${encodeURIComponent(v.youtube_id)}/hqdefault.jpg`
          : "");
      return `
      <article class="vcard" onclick="nmOpenVideoPreview(${v.id})" role="link" tabindex="0"
               data-video-id="${v.id}"
               data-yt="${escapeHtml(v.youtube_id || "")}"
               aria-label="${escapeHtml(v.title || "Video")}"
               onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goVideo(${v.id})}">
        <div class="vcard-thumb">
          <img src="${escapeHtml(thumb)}" alt="${escapeHtml(v.title || "")}" loading="lazy" decoding="async" onerror="this.style.opacity=0">
          <div class="vcard-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg></div>
        </div>
        <div class="vcard-body">
          <h3 class="vcard-title">${escapeHtml(v.title || "")}</h3>
          <div class="vcard-meta">
            ${v.category_name ? `<span class="vcard-cat">${escapeHtml(v.category_name)}</span><span class="dot"></span>` : ""}
            <span>↻ ${v.view_count || 1} visualizzazion${(v.view_count || 1) === 1 ? "e" : "i"}</span>
          </div>
        </div>
      </article>
    `;
    })
    .join("");

  const sectionHtml = `
    <section class="row" data-row-id="rewatch" style="animation: fadeUp .5s ease both">
      <div class="row-header">
        <h2 class="row-title outfit">↻&ensp;Riguarda</h2>
        <span class="row-link" onclick="goTo('cronologia.html')">Vedi tutto</span>
      </div>
      <div class="row-scroll-wrap">
        <button class="row-arrow left"  onclick="rowScroll('rewatch', -1)" aria-label="Scorri a sinistra"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg></button>
        <button class="row-arrow right" onclick="rowScroll('rewatch',  1)" aria-label="Scorri a destra"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg></button>
        <div class="row-scroll" id="rowScroll-rewatch" role="list">${cardHtml}</div>
      </div>
    </section>
  `;

  box.insertAdjacentHTML("afterbegin", sectionHtml);
  if (typeof updateArrows === "function") updateArrows("rewatch");
}

// Riga "Top 10": i 10 video piu' visti (endpoint /explore).
async function renderTopWeekRow() {
  const r = await api("/api/user/explore?sort=views&limit=10");
  if (!r.ok || !r.data || !Array.isArray(r.data.videos) || !r.data.videos.length) return;

  const box = document.getElementById("homeRows");
  if (!box) return;

  const existing = document.querySelector('.row[data-row-id="top-views"]');
  if (existing) existing.remove();

  const videos = r.data.videos.slice(0, 10);
  const cardHtml = videos
    .map((v, i) => {
      const rank = i + 1;
      const badgeClass = rank <= 3 ? `vcard-top-${rank}` : `vcard-top-default`;
      const topBadge = `<span class="vcard-top ${badgeClass}" aria-label="Posizione ${rank}">${rank}</span>`;
      return `
      <article class="vcard" onclick="nmOpenVideoPreview(${v.id})" role="link" tabindex="0"
               aria-label="${escapeHtml(v.title || "Video")}"
               onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goVideo(${v.id})}">
        <div class="vcard-thumb">
          ${topBadge}
          <img src="${escapeHtml(thumbUrl(v))}" alt="${escapeHtml(v.title || "")}" loading="lazy" decoding="async" onerror="this.style.opacity=0">
          <div class="vcard-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg></div>
        </div>
        <div class="vcard-body">
          <h3 class="vcard-title">${escapeHtml(v.title || "")}</h3>
          <div class="vcard-meta">
            ${v.category_name ? `<span class="vcard-cat">${escapeHtml(v.category_name)}</span><span class="dot"></span>` : ""}
            <span>${formatViews(v.views_count || 0)}</span>
          </div>
        </div>
      </article>
    `;
    })
    .join("");

  const sectionHtml = `
    <section class="row" data-row-id="top-views" style="animation: fadeUp .5s ease both">
      <div class="row-header">
        <h2 class="row-title outfit">Top 10 della settimana</h2>
        <span class="row-link" onclick="goTo('search.html?sort=views')">Vedi tutti</span>
      </div>
      <div class="row-scroll-wrap">
        <button class="row-arrow left"  onclick="rowScroll('top-views', -1)" aria-label="Scorri a sinistra"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg></button>
        <button class="row-arrow right" onclick="rowScroll('top-views',  1)" aria-label="Scorri a destra"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg></button>
        <div class="row-scroll" id="rowScroll-top-views" role="list">${cardHtml}</div>
      </div>
    </section>
  `;

  box.insertAdjacentHTML("afterbegin", sectionHtml);
  if (typeof updateArrows === "function") updateArrows("top-views");
}

// Riga "Piu' utili": i video con piu' voti utili (endpoint /explore).
async function renderMostUsefulRow() {
  const r = await api("/api/user/explore?sort=useful&limit=12");
  if (!r.ok || !r.data || !Array.isArray(r.data.videos) || !r.data.videos.length) return;

  const box = document.getElementById("homeRows");
  if (!box) return;

  const existing = document.querySelector('.row[data-row-id="top-useful"]');
  if (existing) existing.remove();

  const videos = r.data.videos.slice(0, 12);
  const cardHtml = videos
    .map(
      (v) => `
    <article class="vcard" onclick="nmOpenVideoPreview(${v.id})" role="link" tabindex="0"
             aria-label="${escapeHtml(v.title || "Video")}"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goVideo(${v.id})}">
      <div class="vcard-thumb">
        <img src="${escapeHtml(thumbUrl(v))}" alt="${escapeHtml(v.title || "")}" loading="lazy" decoding="async" onerror="this.style.opacity=0">
        <div class="vcard-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg></div>
      </div>
      <div class="vcard-body">
        <h3 class="vcard-title">${escapeHtml(v.title || "")}</h3>
        <div class="vcard-meta">
          ${v.category_name ? `<span class="vcard-cat">${escapeHtml(v.category_name)}</span><span class="dot"></span>` : ""}
          <span>${(v.useful_count || 0)} ${(v.useful_count === 1 ? "voto utile" : "voti utili")}</span>
        </div>
      </div>
    </article>
  `
    )
    .join("");

  const sectionHtml = `
    <section class="row" data-row-id="top-useful" style="animation: fadeUp .5s ease both">
      <div class="row-header">
        <h2 class="row-title outfit">Più utili</h2>
        <span class="row-link" onclick="goTo('search.html?sort=useful')">Vedi tutti</span>
      </div>
      <div class="row-scroll-wrap">
        <button class="row-arrow left"  onclick="rowScroll('top-useful', -1)" aria-label="Scorri a sinistra"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg></button>
        <button class="row-arrow right" onclick="rowScroll('top-useful',  1)" aria-label="Scorri a destra"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg></button>
        <div class="row-scroll" id="rowScroll-top-useful" role="list">${cardHtml}</div>
      </div>
    </section>
  `;

  box.insertAdjacentHTML("afterbegin", sectionHtml);
  if (typeof updateArrows === "function") updateArrows("top-useful");
}

// Riga "Continua a guardare": video parzialmente visti con barra progresso.
async function renderContinueWatching() {
  let r = await api("/api/user/watch-progress");
  let useProgress = r.ok && r.data && Array.isArray(r.data.items) && r.data.items.length > 0;
  if (!useProgress) {
    r = await api("/api/user/me/history?page=1&limit=12");
    if (!r.ok || !r.data || !Array.isArray(r.data.items) || r.data.items.length === 0) {
      return;
    }
  }

  const box = document.getElementById("homeRows");
  if (!box) return;

  const existing = document.querySelector('.row[data-row-id="continue"]');
  if (existing) existing.remove();

  const items = r.data.items.map((v) => ({
    id: v.id,
    youtube_id: v.youtube_id,
    title: v.title,
    thumbnail_url: v.thumbnail_url,
    category_name: v.category_name,
    last_viewed: v.watched_at || v.last_viewed,
    seconds: v.seconds || 0,
    duration: v.duration || 0,
  }));

  const cardHtml = items
    .map((v) => {
      const thumb =
        v.thumbnail_url ||
        (v.youtube_id
          ? `https://i.ytimg.com/vi/${encodeURIComponent(v.youtube_id)}/hqdefault.jpg`
          : "");
      // Barra progresso solo se ho la durata (dall'endpoint /watch-progress).
      const pct = v.duration > 0 ? Math.min(100, Math.round((v.seconds / v.duration) * 100)) : 0;
      const progressBar = pct > 0
        ? `<div class="vcard-progress"><span style="width:${pct}%"></span></div>`
        : "";
      return `
      <article class="vcard vcard-resume" onclick="nmOpenVideoPreview(${v.id})" role="link" tabindex="0"
               aria-label="${escapeHtml(v.title || "Video")}"
               onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goVideo(${v.id})}">
        <div class="vcard-thumb">
          <img src="${escapeHtml(thumb)}" alt="${escapeHtml(v.title || "")}" loading="lazy" decoding="async" onerror="this.style.opacity=0">
          <div class="vcard-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg></div>
          ${progressBar}
        </div>
        <div class="vcard-body">
          <h3 class="vcard-title">${escapeHtml(v.title || "")}</h3>
          <div class="vcard-meta">
            ${v.category_name ? `<span class="vcard-cat">${escapeHtml(v.category_name)}</span><span class="dot"></span>` : ""}
            <span>Visto ${timeAgo(v.last_viewed)}</span>
          </div>
        </div>
      </article>
    `;
    })
    .join("");
  const sectionHtml = `
    <section class="row row-continue" data-row-id="continue" style="animation: fadeUp .5s ease both">
      <div class="row-header">
        <h2 class="row-title outfit">Continua a guardare</h2>
        <span class="row-link" onclick="goTo('cronologia.html')">Vedi tutto</span>
      </div>
      <div class="row-scroll-wrap">
        <button class="row-arrow left"  onclick="rowScroll('continue', -1)" aria-label="Scorri a sinistra"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg></button>
        <button class="row-arrow right" onclick="rowScroll('continue',  1)" aria-label="Scorri a destra"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg></button>
        <div class="row-scroll" id="rowScroll-continue" role="list">${cardHtml}</div>
      </div>
    </section>
  `;

  box.insertAdjacentHTML("afterbegin", sectionHtml);
  if (typeof updateArrows === "function") updateArrows("continue");
}

const HERO = {
  slides: [],
  index: 0,
  timer: null,
  AUTO_MS: 18000,          // ogni quanto avanza da sola
  TRANSITION_MS: 1100,
  inFlight: false,         // lock durante l'animazione di transizione
  swipeStartX: null,
  swipeStartY: null,
  SWIPE_THRESHOLD: 50,     // px minimi per contare come swipe
};

// Hero editoriale: 5 slide con SVG di sfondo, titoli editoriali e CTA
// che portano a categorie reali del DB. Sostituisce il vecchio hero
// che mostrava un video featured con embed YouTube.
function renderEditorialHero() {
  const heroEl = document.getElementById("hero");
  if (!heroEl) return;

  const lang = window.NMI18n && window.NMI18n.getLang ? window.NMI18n.getLang() : "it";
  const SLIDE_DEFS =
    lang === "en"
      ? [
          {
            bg: "img/hero/edit-1.svg",
            badge: "GENETICS",
            title: "DNA, decoded.",
            desc: "Lectures and case studies on molecular medicine, genetic disorders and the future of personalized therapy.",
            playLabel: "Explore",
            infoLabel: "About NETMED",
            categoryHints: ["genetic", "molecolar", "genetica"],
          },
          {
            bg: "img/hero/edit-2.svg",
            badge: "CARDIOLOGY",
            title: "A heartbeat away.",
            desc: "ECG protocols, valvular pathologies, interventional cardiology — clear video lessons by verified specialists.",
            playLabel: "Watch now",
            infoLabel: "More info",
            categoryHints: ["cardio", "heart"],
          },
          {
            bg: "img/hero/edit-3.svg",
            badge: "CLINICAL CASES",
            title: "Real medicine, real cases.",
            desc: "Documented clinical cases from emergency rooms, wards and consultations. For students, residents, and curious minds.",
            playLabel: "Watch cases",
            infoLabel: "About NETMED",
            categoryHints: ["clinic", "case", "emergency", "internal"],
          },
          {
            bg: "img/hero/edit-4.svg",
            badge: "NEUROSCIENCE",
            title: "Inside the brain.",
            desc: "Anatomy, neurology, psychiatry, neurorehabilitation. Visual content that turns complex into clear.",
            playLabel: "Discover",
            infoLabel: "Browse tags",
            categoryHints: ["neuro", "brain", "psych"],
          },
          {
            bg: "img/hero/edit-5.svg",
            badge: "CELL BIOLOGY",
            title: "Where it all begins.",
            desc: "Microscopy footage, cellular processes and tissue physiology — the building blocks of medicine, on demand.",
            playLabel: "Explore",
            infoLabel: "More info",
            categoryHints: ["cell", "biology", "histol", "anatom"],
          },
        ]
      : [
          {
            bg: "img/hero/edit-1.svg",
            badge: "GENETICA",
            title: "Il DNA, raccontato.",
            desc: "Lezioni e casi clinici su medicina molecolare, malattie genetiche e terapia personalizzata. Per chi vuole capire da dove tutto comincia.",
            playLabel: "Esplora",
            infoLabel: "Chi siamo",
            categoryHints: ["genet", "molecolar", "dna"],
          },
          {
            bg: "img/hero/edit-2.svg",
            badge: "CARDIOLOGIA",
            title: "Un battito alla volta.",
            desc: "ECG, valvulopatie, cardiologia interventistica. Video chiari, tenuti da specialisti verificati.",
            playLabel: "Guarda ora",
            infoLabel: "Scopri di più",
            categoryHints: ["cardio", "cuore"],
          },
          {
            bg: "img/hero/edit-3.svg",
            badge: "CASI CLINICI",
            title: "Medicina vera, casi veri.",
            desc: "Casi clinici documentati da pronto soccorso, reparti e ambulatori. Per studenti, specializzandi e curiosi.",
            playLabel: "Vedi i casi",
            infoLabel: "Chi siamo",
            categoryHints: ["clinic", "caso", "urgen", "interna"],
          },
          {
            bg: "img/hero/edit-4.svg",
            badge: "NEUROSCIENZE",
            title: "Dentro al cervello.",
            desc: "Anatomia, neurologia, psichiatria, neuroriabilitazione. Contenuti visivi che rendono semplice il complesso.",
            playLabel: "Scopri",
            infoLabel: "Esplora tag",
            categoryHints: ["neuro", "psich"],
          },
          {
            bg: "img/hero/edit-5.svg",
            badge: "BIOLOGIA CELL.",
            title: "Dove tutto comincia.",
            desc: "Riprese al microscopio, processi cellulari e fisiologia dei tessuti. I mattoni della medicina, on demand.",
            playLabel: "Esplora",
            infoLabel: "Scopri di più",
            categoryHints: ["cell", "biolog", "istol", "anatom"],
          },
        ];

  function resolveSlide(s) {
    const cats = Array.isArray(NM.categories) ? NM.categories : [];
    let match = null;
    for (const hint of s.categoryHints || []) {
      const h = hint.toLowerCase();
      match = cats.find(
        (c) =>
          String(c.name || "")
            .toLowerCase()
            .indexOf(h) !== -1
      );
      if (match) break;
    }
    if (match) {
      s.playOnclick = "goCategory(" + match.id + ")";
      s.infoOnclick = "goCategory(" + match.id + ")";
    } else {
      const q = (s.categoryHints || [""])[0];
      s.playOnclick = "goTo('search.html?q=" + encodeURIComponent(q) + "')";
      s.infoOnclick = "goTo('index.html')";
    }
    return s;
  }
  const SLIDES = SLIDE_DEFS.map(resolveSlide);

  heroEl.classList.remove("loading");
  heroEl.classList.add("hero-carousel", "hero-nflx", "hero-editorial");
  heroEl.style.display = "block";

  HERO.slides = SLIDES;
  HERO.index = 0;
  if (HERO.timer) {
    clearInterval(HERO.timer);
    HERO.timer = null;
  }

  const slidesHtml = SLIDES.map(
    (s, i) => `
    <div class="hero-slide ${i === 0 ? "active" : ""}" data-idx="${i}">
      <div class="hero-bg">
        <img class="hero-bg-img" src="${escapeHtml(s.bg)}" alt="" loading="${i === 0 ? "eager" : "lazy"}" decoding="async"/>
      </div>
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <div class="hero-badge">${escapeHtml(s.badge)}</div>
        <h1 class="hero-title outfit">${escapeHtml(s.title)}</h1>
        <p class="hero-desc">${escapeHtml(s.desc)}</p>
        <div class="hero-actions">
          <button class="hero-btn hero-btn-play" onclick="${s.playOnclick}">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="vertical-align:-3px"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
            ${escapeHtml(s.playLabel)}
          </button>
          <button class="hero-btn hero-btn-info" onclick="${s.infoOnclick}">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="vertical-align:-3px"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="8" r="1.3" fill="currentColor"/><path d="M12 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            ${escapeHtml(s.infoLabel)}
          </button>
        </div>
      </div>
    </div>
  `
  ).join("");

  const dotsHtml = SLIDES.map(
    (_, i) =>
      `<button class="hero-dot ${i === 0 ? "active" : ""}" type="button"
             aria-label="Slide ${i + 1}" onclick="heroGoTo(${i})"></button>`
  ).join("");

  const labels =
    lang === "en" ? { prev: "Previous", next: "Next" } : { prev: "Precedente", next: "Successivo" };

  const arrowsHtml = `
    <button class="hero-arrow hero-arrow-prev" type="button" aria-label="${labels.prev}" onclick="heroPrev()">‹</button>
    <button class="hero-arrow hero-arrow-next" type="button" aria-label="${labels.next}" onclick="heroNext()">›</button>
  `;

  heroEl.innerHTML = `
    <div class="hero-slides">${slidesHtml}</div>
    ${arrowsHtml}
    <div class="hero-dots" role="tablist" aria-label="Carosello in evidenza">${dotsHtml}</div>
  `;

  HERO.timer = setInterval(heroNext, HERO.AUTO_MS);
  heroEl.addEventListener("mouseenter", heroPause);
  heroEl.addEventListener("mouseleave", heroResume);
  document.addEventListener("visibilitychange", heroVisibility);
  heroBindKeyboard(heroEl);
  heroBindSwipe(heroEl);
}

function heroGoTo(i, dir) {
  if (!HERO.slides.length || HERO.inFlight) return;
  const heroEl = document.getElementById("hero");
  if (!heroEl) return;

  const slides = heroEl.querySelectorAll(".hero-slide");
  const dots = heroEl.querySelectorAll(".hero-dot");
  const prev = HERO.index;
  const next = ((i % HERO.slides.length) + HERO.slides.length) % HERO.slides.length;
  if (next === prev) return;

  if (typeof dir !== "number") {
    const len = HERO.slides.length;
    const fwd = (next - prev + len) % len <= len / 2;
    dir = fwd ? 1 : -1;
  }

  HERO.inFlight = true;
  HERO.index = next;

  slides.forEach((el) => el.classList.remove("exit-left", "exit-right"));

  const outgoing = slides[prev];
  const incoming = slides[next];

  if (incoming) {
    incoming.classList.remove("active");
    incoming.classList.add(dir === 1 ? "exit-right" : "exit-left");
    void incoming.offsetWidth;   // forza il reflow per far ripartire la transition
  }

  if (outgoing) outgoing.classList.add(dir === 1 ? "exit-left" : "exit-right");
  if (outgoing) outgoing.classList.remove("active");

  if (incoming) {
    incoming.classList.remove("exit-left", "exit-right");
    incoming.classList.add("active");
  }

  dots.forEach((el, idx) => el.classList.toggle("active", idx === HERO.index));

  HERO.inFlight = false;
}

function heroNext() { heroGoTo(HERO.index + 1, 1); }
function heroPrev() { heroGoTo(HERO.index - 1, -1); }

// Pause sull'hover: l'utente vuole leggere.
function heroPause() {
  if (HERO.timer) {
    clearInterval(HERO.timer);
    HERO.timer = null;
  }
}
function heroResume() {
  if (!HERO.timer) HERO.timer = setInterval(heroNext, HERO.AUTO_MS);
}

// Pause quando il tab passa in background (non ha senso animare).
function heroVisibility() {
  if (document.hidden) heroPause();
  else heroResume();
}

// Frecce sinistra/destra della tastiera.
function heroBindKeyboard(heroEl) {
  if (heroEl._kbBound) return;
  heroEl._kbBound = true;
  heroEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") heroPrev();
    if (e.key === "ArrowRight") heroNext();
  });
}

function heroBindSwipe(heroEl) {
  heroEl.addEventListener(
    "touchstart",
    (e) => {
      if (!e.touches || !e.touches[0]) return;
      HERO.swipeStartX = e.touches[0].clientX;
      HERO.swipeStartY = e.touches[0].clientY;
    },
    { passive: true }
  );
  heroEl.addEventListener(
    "touchend",
    (e) => {
      if (HERO.swipeStartX == null) return;
      const t = (e.changedTouches && e.changedTouches[0]) || null;
      if (!t) return;
      const dx = t.clientX - HERO.swipeStartX;
      const dy = t.clientY - (HERO.swipeStartY || 0);
      if (Math.abs(dx) > HERO.SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) heroNext(); else heroPrev();
      }
      HERO.swipeStartX = null;
      HERO.swipeStartY = null;
    },
    { passive: true }
  );
}

(function () {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadHome, { once: true });
  } else {
    loadHome();
  }
})();