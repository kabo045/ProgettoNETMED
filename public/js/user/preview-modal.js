const VPV = {
  open: false,
  data: null,
};

// Apre la modale preview per il video con questo id.
// Chiamata dagli onclick delle card in home/ricerca/categoria.
async function nmOpenVideoPreview(videoId) {
  if (!videoId) return;
  // Crea la modale se non esiste ancora (idempotente).
  nmEnsureVideoPreview();
  const bg = document.getElementById("vpvBg");
  if (!bg) return;
  VPV.open = true;
  bg.classList.add("open");
  // Blocco lo scroll della pagina sotto la modale.
  document.body.style.overflow = "hidden";
  document.body.classList.add("nm-modal-open");

  const body = document.getElementById("vpvBody");
  if (body) body.innerHTML = `<div class="vpv-loading"><div class="vpv-spin"></div></div>`;

  // Due fetch in parallelo: dettaglio + correlati.
  const [vR, relR] = await Promise.all([
    api("/api/user/videos/" + encodeURIComponent(videoId)),
    api("/api/user/videos/" + encodeURIComponent(videoId) + "/related"),
  ]);

  if (!vR.ok) {
    if (body)
      body.innerHTML = `<div class="vpv-empty">${escapeHtml(vR.data && vR.data.error ? vR.data.error : "Video non disponibile")}</div>`;
    return;
  }
  const v = vR.data;
  const related = (relR.ok ? relR.data || [] : []).slice(0, 6);
  VPV.data = v;
  nmRenderVideoPreview(v, related);
}
window.nmOpenVideoPreview = nmOpenVideoPreview;

// Crea l'overlay della modale se non c'e' gia' nel DOM.
// Aggancia anche i listener per chiudere (click fuori + ESC).
function nmEnsureVideoPreview() {
  if (document.getElementById("vpvBg")) return;
  const bg = document.createElement("div");
  bg.id = "vpvBg";
  bg.className = "vpv-bg";
  bg.innerHTML = `
    <div class="vpv-card" role="dialog" aria-modal="true" aria-labelledby="vpvTitle" onclick="event.stopPropagation()">
      <button class="vpv-close" type="button" aria-label="Chiudi" onclick="nmCloseVideoPreview()">×</button>
      <div class="vpv-body" id="vpvBody"></div>
    </div>
  `;
  // Click sullo sfondo (non sul contenuto): chiude.
  bg.addEventListener("click", (e) => {
    if (e.target === bg) nmCloseVideoPreview();
  });
  document.body.appendChild(bg);
  // ESC: chiude solo se la modale e' aperta.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && VPV.open) nmCloseVideoPreview();
  });
}

// Chiude la modale e ripristina lo scroll della pagina.
function nmCloseVideoPreview() {
  const bg = document.getElementById("vpvBg");
  if (!bg) return;
  VPV.open = false;
  bg.classList.remove("open");
  document.body.style.overflow = "";
  document.body.classList.remove("nm-modal-open");
}
window.nmCloseVideoPreview = nmCloseVideoPreview;

// Costruisce l'HTML della modale con i dati appena arrivati:
// poster + titolo + azioni + info laterali + tag + suggeriti.
function nmRenderVideoPreview(v, related) {
  const body = document.getElementById("vpvBody");
  if (!body) return;

  const ytId = v.youtube_id ? encodeURIComponent(v.youtube_id) : "";
  const poster =
    v.thumbnail_url || (ytId ? "https://i.ytimg.com/vi/" + ytId + "/maxresdefault.jpg" : "");
  const posterFallback = ytId ? "https://i.ytimg.com/vi/" + ytId + "/hqdefault.jpg" : "";

  const yearStr = v.created_at ? new Date(v.created_at).getFullYear() : "";
  const verified = !!v.uploaded_by_verified;
  const tick =
    typeof verifiedTickHTML === "function"
      ? verifiedTickHTML(verified, v.uploaded_by_profile, "sm")
      : "";

  const isLogged = !!NM.user;
  const myVote = parseInt(v.my_vote, 10) || 0;

  // Tag cliccabili: chiudono la modale e portano alla pagina search filtrata.
  const tagsHtml =
    v.tags && v.tags.length
      ? v.tags
          .slice(0, 6)
          .map(
            (t) =>
              `<span class="vpv-tag" onclick="nmCloseVideoPreview();goTag('${escapeAttrSafe(t.name)}')">#${escapeHtml(t.name)}</span>`
          )
          .join("")
      : "";

  // Correlati: griglia di 6 card cliccabili che aprono la stessa modale.
  const relatedHtml = related.length
    ? `
    <h3 class="vpv-rel-h">Altri titoli simili</h3>
    <div class="vpv-rel-grid">
      ${related
        .map((r) => {
          const rt =
            r.thumbnail_url ||
            (r.youtube_id
              ? "https://i.ytimg.com/vi/" + encodeURIComponent(r.youtube_id) + "/mqdefault.jpg"
              : "");
          return `
          <article class="vpv-rel-card" onclick="nmOpenVideoPreview(${r.id})" role="link" tabindex="0"
                   onkeydown="if(event.key==='Enter'){nmOpenVideoPreview(${r.id})}">
            <div class="vpv-rel-thumb">
              ${rt ? `<img src="${escapeHtml(rt)}" alt="" loading="lazy" onerror="this.style.opacity=0"/>` : ""}
            </div>
            <div class="vpv-rel-body">
              <div class="vpv-rel-title">${escapeHtml(r.title || "")}</div>
              <div class="vpv-rel-meta">${r.category_name ? escapeHtml(r.category_name) + " · " : ""}${formatViews(r.views_count || 0)}</div>
            </div>
          </article>`;
        })
        .join("")}
    </div>`
    : "";

  body.innerHTML = `
    <div class="vpv-hero">
      <div class="vpv-poster">
        ${poster ? `<img src="${escapeHtml(poster)}" alt="" ${posterFallback ? `onerror="this.onerror=null;this.src='${posterFallback}'"` : ""}/>` : ""}
        <div class="vpv-poster-grad"></div>
        <div class="vpv-poster-content">
          <h1 class="vpv-title outfit" id="vpvTitle">${escapeHtml(v.title || "")}</h1>
          <div class="vpv-actions">
            <!-- Riproduci: chiudo la modale e vado alla pagina video vera. -->
            <button class="vpv-btn vpv-btn-play" onclick="nmCloseVideoPreview();goVideo(${v.id})">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style="vertical-align:-4px"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
              Riproduci
            </button>
            ${
              isLogged
                ? `
              <button class="vpv-btn-icon ${v.is_favorite ? "active" : ""}" id="vpvFavBtn" onclick="vpvToggleFav()" title="${v.is_favorite ? "Salvato" : "Salva"}">
                ${v.is_favorite ? "✓" : "+"}
              </button>
              <button class="vpv-btn-icon ${myVote === 1 ? "active" : ""}" id="vpvLikeBtn" onclick="vpvVote(1)" title="Utile">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M2 21h4V9H2v12zm20-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 1 6.59 7.59C6.22 7.95 6 8.45 6 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73V10z"/></svg>
              </button>
            `
                : ""
            }
          </div>
        </div>
      </div>

      <div class="vpv-info">
        <div class="vpv-info-main">
          <div class="vpv-meta-row">
            ${yearStr ? `<span class="vpv-year">${yearStr}</span>` : ""}
            <span class="vpv-views">${formatViews((v.counts && v.counts.views) || 0)} visualizzazioni</span>
            ${v.counts && v.counts.likes ? `<span class="vpv-rating">+ ${formatViews(v.counts.likes)}</span>` : ""}
          </div>
          <div class="vpv-desc">${escapeHtml(v.description || "Nessuna descrizione disponibile.")}</div>
          ${tagsHtml ? `<div class="vpv-tags">${tagsHtml}</div>` : ""}
        </div>
        <aside class="vpv-info-side">
          ${
            v.uploaded_by_username
              ? `
            <div class="vpv-side-row">
              <span class="vpv-side-label">Canale:</span>
              <a class="vpv-side-value vpv-side-link" onclick="nmCloseVideoPreview();goCreatorPublic('${escapeAttrSafe(v.uploaded_by_username)}')">
                ${escapeHtml(v.uploaded_by_username)}${tick}
              </a>
            </div>`
              : ""
          }
          ${
            v.category_name
              ? `
            <div class="vpv-side-row">
              <span class="vpv-side-label">Categoria:</span>
              <a class="vpv-side-value vpv-side-link" onclick="nmCloseVideoPreview();goCategory(${v.category_id})">${escapeHtml(v.category_name)}</a>
            </div>`
              : ""
          }
          ${
            v.tags && v.tags.length
              ? `
            <div class="vpv-side-row">
              <span class="vpv-side-label">Generi:</span>
              <span class="vpv-side-value">${v.tags
                .slice(0, 4)
                .map((t) => escapeHtml(t.name))
                .join(", ")}</span>
            </div>`
              : ""
          }
        </aside>
      </div>

      ${relatedHtml}
    </div>
  `;
}

// Toggle preferito. Aggiorna solo il bottone dentro la modale.
async function vpvToggleFav() {
  if (!VPV.data || !NM.user) return;
  const id = VPV.data.id;
  const r = await api("/api/user/videos/" + id + "/favorite", { method: "POST" });
  if (r.ok) {
    VPV.data.is_favorite = !!r.data.is_favorite;
    const btn = document.getElementById("vpvFavBtn");
    if (btn) {
      btn.classList.toggle("active", VPV.data.is_favorite);
      btn.textContent = VPV.data.is_favorite ? "✓" : "+";
      btn.title = VPV.data.is_favorite ? "Salvato" : "Salva";
    }
    if (typeof toast === "function") {
      toast(VPV.data.is_favorite ? "Salvato nei preferiti" : "Rimosso dai preferiti", "ok");
    }
  }
}
window.vpvToggleFav = vpvToggleFav;

// Voto utile / non utile. Se clicco sul voto gia' attivo, lo azzero.
async function vpvVote(value) {
  if (!VPV.data || !NM.user) return;
  const id = VPV.data.id;
  const current = parseInt(VPV.data.my_vote, 10) || 0;
  const newVote = current === value ? 0 : value;
  const r = await api("/api/user/videos/" + id + "/vote", {
    method: "POST",
    body: { vote: newVote },
  });
  if (r.ok && r.data) {
    VPV.data.my_vote = r.data.my_vote;
    const btn = document.getElementById("vpvLikeBtn");
    if (btn) btn.classList.toggle("active", VPV.data.my_vote === 1);
  }
}
window.vpvVote = vpvVote;

// Escape per stringhe usate dentro attributi onclick con apostrofi.
function escapeAttrSafe(s) {
  return String(s == null ? "" : s)
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;");
}