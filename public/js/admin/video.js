// Pannello admin per la gestione dei video.
// - Tabella paginata con search + filtro categoria
// - Modale nuovo/modifica con anteprima YouTube live
// - Dettaglio video con stats (view/like/comment), grafico view 30gg,
//   ultimi spettatori, commenti recenti
// - Azioni admin: blocca/sblocca (is_flagged), elimina
// Le funzioni globali (apiFetch, nav, openModal, toast, sk, esc, cc,
// COLORS, fn, fd, renderPag, ...) stanno in admin_core.js.

// Stato locale del pannello video.
let vState = {
  videos: [],
  pag: { page: 1, limit: 5, total: 0, totalPages: 0 },
  search: "",
  catF: "",       // filtro categoria attivo (stringa dall'onchange del select)
  cats: [],       // categorie fetchate per popolare il dropdown
  tags: [],       // tag fetchati per popolare la modale
};

// Timer 
let vTimer;
// Entry point: fetch categorie + tag, disegna toolbar + tabella, carica prima pagina.
async function pageVideos() {
  const pc = document.getElementById("pageContent");

  // Meta in parallelo: categorie e tag per i dropdown della modale.
  try {
    [vState.cats, vState.tags] = await Promise.all([
      apiFetch("/categories"),
      apiFetch("/videos/tags/all"),
    ]);
  } catch (e) {}

  pc.innerHTML = `
    <div class="toolbar">
      <div class="sbox">
        <span class="si">Q</span>
        <input placeholder="Cerca per titolo, descrizione, ID o tag..." maxlength="100" oninput="vSearch(this.value)"/>
      </div>
      <select class="fsel" onchange="vCatFilter(this.value)">
        <option value="">Tutte le categorie</option>
        ${vState.cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}
      </select>
    </div>
    <div class="tcard">
      <div class="twrap">
        <table>
          <thead>
            <tr>
              <th>Video</th>
              <th>Categoria</th>
              <th>Tag</th>
              <th>Stato</th>
              <th>Stats</th>
              <th>Data</th>
              <th style="width:120px">Azioni</th>
            </tr>
          </thead>
          <tbody id="vBody"></tbody>
        </table>
      </div>
      <div id="vPag"></div>
    </div>
  `;

  vState.pag.page = 1;
  vState.search = "";
  vState.catF = "";
  loadVideos();
}

// Ricerca
function vSearch(v) {
  clearTimeout(vTimer);
  vTimer = setTimeout(() => {
    vState.search = v;
    vState.pag.page = 1;
    loadVideos();
  }, 400);
}

// Cambio filtro categoria: torna a pagina 1 e ricarica.
function vCatFilter(v) {
  vState.catF = v;
  vState.pag.page = 1;
  loadVideos();
}

// Fetch dei video con filtri correnti + render tabella + paginazione.
async function loadVideos() {
  const tb = document.getElementById("vBody");
  if (!tb) return;

  // Skeleton.
  tb.innerHTML = Array(5)
    .fill("")
    .map(
      () => `
    <tr>
      <td style="padding:16px"><div style="display:flex;gap:14px">${sk("72px", 48)}<div>${sk("200px", 14)}${sk("100px", 10)}</div></div></td>
      <td style="padding:16px">${sk("80px", 22)}</td>
      <td style="padding:16px">${sk("120px", 22)}</td>
      <td style="padding:16px">${sk("60px", 22)}</td>
      <td style="padding:16px">${sk("100px", 14)}</td>
      <td style="padding:16px">${sk("80px", 14)}</td>
      <td></td>
    </tr>
  `
    )
    .join("");

  const p = new URLSearchParams({ page: vState.pag.page, limit: vState.pag.limit });
  if (vState.search) p.set("search", vState.search);
  if (vState.catF) p.set("category", vState.catF);

  try {
    const d = await apiFetch(`/videos?${p}`);
    vState.videos = d.videos;
    vState.pag = d.pagination;
    renderVideoTable();
  } catch (e) {
    tb.innerHTML = `
      <tr><td colspan="7">
        <div class="empty">
          <div class="empty-ico">!</div>
          <div class="empty-t">Errore</div>
          <button class="btn btn-p" onclick="loadVideos()">Riprova</button>
        </div>
      </td></tr>
    `;
  }
}

// Render della tabella con card thumbnail + azioni per riga.
function renderVideoTable() {
  const tb = document.getElementById("vBody");

  if (!vState.videos.length) {
    tb.innerHTML = `
      <tr><td colspan="7">
        <div class="empty"><div class="empty-ico"></div><div class="empty-t">Nessun video trovato</div></div>
      </td></tr>
    `;
    document.getElementById("vPag").innerHTML = "";
    return;
  }

  tb.innerHTML = vState.videos
    .map((v) => {
      const c = cc(v.category_name);
      const tgs = v.tags || [];
      return `
      <tr>
        <td style="padding:16px 20px">
          <div style="display:flex;align-items:center;gap:14px;cursor:pointer" onclick="openVideoDetail(${v.id})">
            ${
              v.thumbnail_url
                ? `<img src="${esc(v.thumbnail_url)}" style="width:72px;height:48px;border-radius:10px;object-fit:cover;flex-shrink:0;background:var(--s1)" onerror="this.style.display='none'">`
                : `<div style="width:72px;height:48px;border-radius:10px;background:${c}15;border:1px solid ${c}30;display:flex;align-items:center;justify-content:center;color:${c};flex-shrink:0">▶</div>`
            }
            <div>
              <div style="font-weight:500;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.title)}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px;font-family:monospace">${esc(v.youtube_id)}</div>
            </div>
          </div>
        </td>
        <td style="padding:16px 20px">${v.category_name ? `<span class="badge" style="color:${c};background:${c}12">${esc(v.category_name)}</span>` : "—"}</td>
        <td style="padding:16px 20px">
          <div style="display:flex;flex-wrap:wrap;gap:3px">
            ${tgs.length ? tgs.map((t) => `<span class="tag-chip">${esc(t.name)}</span>`).join("") : "—"}
          </div>
        </td>
        <td style="padding:16px 20px"><span class="badge ${v.is_private ? "b-priv" : "b-pub"}">${v.is_private ? "Privato" : "Pubblico"}</span></td>
        <td style="padding:16px 20px;font-size:13px;color:var(--text2);white-space:nowrap">◎${fn(v.view_count)} ♥${fn(v.like_count)} ◫${fn(v.comment_count)}</td>
        <td style="padding:16px 20px;font-size:13px;color:var(--text3);white-space:nowrap">${fd(v.created_at)}</td>
        <td style="padding:16px 20px">
          <div class="acts">
            <button class="btn-i" title="Dettaglio" onclick="openVideoDetail(${v.id})">•</button>
            <button class="btn-i" title="Modifica"  onclick="editVideo(${v.id})">/</button>
            <button class="btn-i" title="Elimina"   onclick="delVideoConfirm(${v.id},'${esc(v.title).replace(/'/g, "\\'")}')">X</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  // Paginazione delegata a renderPag (in admin_core.js).
  renderPag("vPag", vState.pag, (p) => {
    vState.pag.page = p;
    loadVideos();
  });
}

// Apre la pagina di dettaglio video: player embed, stats, grafico view giornaliere, ultimi spettatori, commenti recenti.
async function openVideoDetail(id) {
  currentPage = "videoDetail";
  renderSidebar();
  document.getElementById("mainContent").innerHTML = `
    <div id="pageContent">
      <div style="text-align:center;padding:60px">${sk("100%", 300)}</div>
    </div>
  `;

  try {
    const v = await apiFetch(`/videos/${id}`);
    // maxV serve per normalizzare l'altezza delle barre del grafico view giornaliere.
    const maxV = Math.max(...(v.views_daily || []).map((d) => d.views), 1);

    document.getElementById("pageContent").innerHTML = `
      <div class="bc">
        <a onclick="nav('dashboard')">Home</a>
        <span class="bc-sep">›</span>
        <a onclick="nav('videos')">Video</a>
        <span class="bc-sep">›</span>
        ${esc(trunc(v.title, 40))}
      </div>

      <div style="margin-bottom:20px">
        <button class="btn btn-s btn-sm" onclick="nav('videos')">Torna alla lista</button>
      </div>

      <div class="vdetail">
        <div>
          <div class="vd-player">
            <iframe src="https://www.youtube.com/embed/${v.youtube_id}?rel=0" allowfullscreen></iframe>
          </div>
          ${
            v.views_daily && v.views_daily.length
              ? `
            <div class="card" style="margin-top:16px;animation-delay:.2s">
              <div class="card-h"><span class="outfit" style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">Views 30 giorni</span></div>
              <div style="padding:20px 24px">
                <div class="mini-chart">
                  ${v.views_daily.map((d) => `<div class="mini-bar" style="height:${Math.max((d.views / maxV) * 100, 8)}%;flex:1" title="${d.day}: ${d.views}"></div>`).join("")}
                </div>
              </div>
            </div>
          `
              : ""
          }
        </div>

        <div class="vd-info">
          <div class="vd-title outfit">${esc(v.title)}</div>
          <div class="vd-meta">
            ${v.category_name ? `<span class="badge" style="color:${cc(v.category_name)};background:${cc(v.category_name)}12">${esc(v.category_name)}</span>` : ""}
            <span class="badge ${v.is_private ? "b-priv" : "b-pub"}">${v.is_private ? "Privato" : "Pubblico"}</span>
            ${v.is_flagged ? `<span class="badge b-ban">Bloccato</span>` : ""}
            <span style="font-size:12px;color:var(--text3)">${fd(v.created_at)}</span>
          </div>

          ${v.description ? `<div class="vd-desc">${esc(v.description)}</div>` : ""}

          <div class="vd-stats">
            <div class="vd-stat"><div class="vd-stat-val outfit">${fn(v.view_count)}</div><div class="vd-stat-lab">Views</div></div>
            <div class="vd-stat"><div class="vd-stat-val outfit">${fn(v.like_count)}</div><div class="vd-stat-lab">Like</div></div>
            <div class="vd-stat"><div class="vd-stat-val outfit">${fn(v.comment_count)}</div><div class="vd-stat-lab">Commenti</div></div>
          </div>

          ${
            (v.tags || []).length
              ? `
            <div style="margin-bottom:16px">
              ${v.tags.map((t) => `<span class="tag-chip">${esc(t.name)}</span>`).join(" ")}
            </div>
          `
              : ""
          }

          <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
            <button class="btn btn-p btn-sm" onclick="editVideo(${v.id})">Modifica</button>
            ${
              v.is_flagged
                ? `<button class="btn btn-p btn-sm" onclick="toggleFlag(${v.id},false)">Sblocca</button>`
                : `<button class="btn btn-w btn-sm" onclick="toggleFlag(${v.id},true)">Blocca</button>`
            }
            <button class="btn btn-d btn-sm" onclick="delVideoConfirm(${v.id},'${esc(v.title).replace(/'/g, "\\'")}')">Elimina</button>
          </div>

          ${
            v.recent_viewers && v.recent_viewers.length
              ? `
            <div class="vd-section">
              <div class="vd-section-title">Ultimi spettatori</div>
              ${showMoreList(
                v.recent_viewers,
                (rv, i) => {
                  const c = COLORS[(typeof i === "number" ? i : 0) % COLORS.length];
                  return `
                  <div style="display:flex;align-items:center;gap:10px;padding:6px 0">
                    <div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,${c}30,${c}60);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:${c};text-transform:uppercase">${rv.username[0]}</div>
                    <span style="font-size:13px;font-weight:500">${esc(rv.username)}</span>
                    <span style="font-size:11px;color:var(--text3);margin-left:auto">${fd(rv.viewed_at)}</span>
                  </div>
                `;
                },
                5,
                "vd_viewers"
              )}
            </div>
          `
              : ""
          }

          ${
            v.recent_comments && v.recent_comments.length
              ? `
            <div class="vd-section">
              <div class="vd-section-title">Commenti recenti</div>
              ${showMoreList(
                v.recent_comments,
                (cm) => `
                <div style="padding:10px 0;border-bottom:1px solid var(--border);${cm.deleted_at ? "opacity:.4" : ""}">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                    <span style="font-size:13px;font-weight:600">${esc(cm.username || "Rimosso")}</span>
                    <span style="font-size:11px;color:var(--text3)">${fd(cm.created_at)}</span>
                  </div>
                  <div style="font-size:13px;color:var(--text2);line-height:1.5">${esc(trunc(cm.content, 150))}</div>
                </div>
              `,
                5,
                "vd_comments"
              )}
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;
  } catch (e) {
    document.getElementById("pageContent").innerHTML = `
      <div class="empty">
        <div class="empty-ico">!</div>
        <div class="empty-t">Video non trovato</div>
        <button class="btn btn-p" onclick="nav('videos')">Torna ai video</button>
      </div>
    `;
  }
}

// Modale nuovo/modifica video. Se passi un oggetto video pieno = edit,
function openVideoModal(video) {
  const v = video || {};
  const isEdit = !!v.id;
  const selTags = isEdit ? (v.tags || []).map((t) => t.id) : [];

  openModal(`
    <div class="mh">
      <h2 class="outfit">${isEdit ? "Modifica Video" : "Nuovo Video"}</h2>
      <button class="mx" onclick="closeModal()">✕</button>
    </div>
    <div class="mb">
      <div class="fg">
        <label class="fl">YouTube ID *</label>
        <input class="fi" id="mYtId" value="${esc(v.youtube_id || "")}" placeholder="es. dQw4w9WgXcQ" oninput="updYtPreview()"/>
        <div class="fh">L'ID del video YouTube (dalla URL dopo v=)</div>
        <div class="ytp" id="ytPrev">
          ${
            v.youtube_id
              ? `<img src="https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg">`
              : '<div class="ytp-empty">Inserisci un YouTube ID per l\'anteprima</div>'
          }
        </div>
      </div>

      <div class="fg">
        <label class="fl">Titolo *</label>
        <input class="fi" id="mTitle" value="${esc(v.title || "")}" placeholder="Titolo del video"/>
      </div>

      <div class="fg">
        <label class="fl">Descrizione</label>
        <textarea class="fi" id="mDesc" rows="3" placeholder="Descrizione opzionale">${esc(v.description || "")}</textarea>
      </div>

      <div class="fr">
        <div class="fg">
          <label class="fl">Categoria</label>
          <select class="fi" id="mCat">
            <option value="">Nessuna</option>
            ${vState.cats.map((c) => `<option value="${c.id}" ${v.category_id == c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
          </select>
        </div>
        <div class="fg">
          <label class="fl">Visibilità</label>
          <label style="display:flex;align-items:center;gap:10px;margin-top:8px;cursor:pointer">
            <input type="checkbox" id="mPriv" ${v.is_private ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--t6)"/>
            <span style="font-size:14px">Video privato</span>
          </label>
        </div>
      </div>

      <div class="fg">
        <label class="fl">Tag</label>
        <div class="tag-sel" id="mTags">
          ${vState.tags.map((t) => `<button type="button" class="tag-opt ${selTags.includes(t.id) ? "sel" : ""}" data-id="${t.id}" onclick="this.classList.toggle('sel')">${esc(t.name)}</button>`).join("")}
        </div>
      </div>
    </div>
    <div class="mf">
      <button class="btn btn-s" onclick="closeModal()">Annulla</button>
      <button class="btn btn-p" id="mSaveBtn">${isEdit ? "Salva Modifiche" : "Crea Video"}</button>
    </div>
  `);

  document.getElementById("mSaveBtn").onclick = () => saveVideo(v.id || null);
}

// Anteprima thumbnail YouTube che cambia mentre l'utente digita l'ID. Se l'ID non esiste (404).
function updYtPreview() {
  const id = document.getElementById("mYtId").value.trim();
  const p = document.getElementById("ytPrev");
  p.innerHTML =
    id.length >= 5
      ? `<img src="https://img.youtube.com/vi/${esc(id)}/mqdefault.jpg" onerror="this.parentElement.innerHTML='<div class=ytp-empty>ID non valido</div>'">`
      : '<div class="ytp-empty">Inserisci un YouTube ID</div>';
}

// Submit del form modale: valida i campi obbligatori, decide se creare (POST) o modificare (PUT).
async function saveVideo(editId) {
  const yt = document.getElementById("mYtId").value.trim();
  const title = document.getElementById("mTitle").value.trim();
  const desc = document.getElementById("mDesc").value.trim();
  const cat = document.getElementById("mCat").value;
  const priv = document.getElementById("mPriv").checked;
  const tags = Array.from(document.querySelectorAll("#mTags .sel")).map((b) =>
    parseInt(b.dataset.id)
  );

  if (!yt || !title) {
    toast("YouTube ID e Titolo obbligatori", "err");
    return;
  }

  const btn = document.getElementById("mSaveBtn");
  btn.disabled = true;
  btn.textContent = "Salvataggio...";

  try {
    const body = {
      youtube_id: yt,
      title,
      description: desc || null,
      category_id: cat ? parseInt(cat) : null,
      is_private: priv,
      tag_ids: tags,
    };
    if (editId) await apiFetch(`/videos/${editId}`, { method: "PUT", body: JSON.stringify(body) });
    else await apiFetch("/videos", { method: "POST", body: JSON.stringify(body) });

    toast(editId ? "Aggiornato!" : "Creato!");
    closeModal();
    if (currentPage === "videos") loadVideos();
    else nav("videos");
    loadNotifications();
  } catch (e) {
    toast(e.message, "err");
    btn.disabled = false;
    btn.textContent = editId ? "Salva Modifiche" : "Crea Video";
  }
}

// Apre la modale di modifica dopo aver fetchato i dati completi del video.
async function editVideo(id) {
  try {
    const v = await apiFetch(`/videos/${id}`);
    openVideoModal(v);
  } catch (e) {
    toast(e.message, "err");
  }
}

// Blocca/sblocca un video (imposta is_flagged=true/false).
async function toggleFlag(id, flagged) {
  try {
    const r = await apiFetch(`/videos/${id}/flag`, {
      method: "PUT",
      body: JSON.stringify({ flagged }),
    });
    toast(r.message);
    if (currentPage === "videoDetail") openVideoDetail(id);
    else loadVideos();
    loadNotifications();
  } catch (e) {
    toast(e.message, "err");
  }
}

// Conferma eliminazione in modale piccola con warning irreversibile.
function delVideoConfirm(id, title) {
  openModal(
    `
    <div class="mh"><h2 class="outfit">Elimina Video</h2><button class="mx" onclick="closeModal()">✕</button></div>
    <div class="mb"><div class="confirm">Eliminare <b>"${title}"</b>?<br><br>Azione irreversibile.</div></div>
    <div class="mf">
      <button class="btn btn-s" onclick="closeModal()">Annulla</button>
      <button class="btn btn-d" id="mDelBtn">Elimina</button>
    </div>
  `,
    "sm"
  );
  document.getElementById("mDelBtn").onclick = () => delVideo(id);
}

// DELETE al backend + refresh UI + notifiche.
async function delVideo(id) {
  const btn = document.getElementById("mDelBtn");
  btn.disabled = true;
  btn.textContent = "...";
  try {
    await apiFetch(`/videos/${id}`, { method: "DELETE" });
    toast("Eliminato");
    closeModal();
    if (currentPage === "videoDetail") nav("videos");
    else loadVideos();
    loadNotifications();
  } catch (e) {
    toast(e.message, "err");
    btn.disabled = false;
    btn.textContent = "Elimina";
  }
}