// Pannello admin per la moderazione dei commenti.
// - Tabella con filtri: video, tipo (principale/risposta), ricerca testuale,
//   toggle "mostra eliminati"
// - Soft-delete: quando elimino setto deleted_at, non elimino la riga.
//   Cosi posso ripristinare. "Svuota cestino" per definitivo
// - Azione Banna direttamente dalla riga (richiama banUser da admin_users.js).

// Stato locale del pannello commenti.
let cState = {
  comments: [],
  page: 1,
  limit: 8,
  total: 0,
  search: "",
  showDel: false,   // se true includo i soft-deleted
  videoId: "",      // filtro per video specifico
  type: "",         // "" tutti | "parent" | "reply"
  videos: [],       // cache lista video con almeno un commento
};

// timer della ricerca.
let cTimer;

async function pageComments() {
  document.getElementById("pageContent").innerHTML = `
    <div class="toolbar">
      <div class="sbox">
        <span class="si">Q</span>
        <input placeholder="Cerca per contenuto o username..." maxlength="100" oninput="cSearch(this.value)"/>
      </div>
      <select class="fsel" id="cVideoSel" onchange="cVideoFilter(this.value)" title="Filtra per video">
        <option value="">Tutti i video</option>
      </select>
      <select class="fsel" id="cTypeSel" onchange="cTypeFilter(this.value)" title="Tipo di commento">
        <option value="">Tutti i tipi</option>
        <option value="parent">Solo principali</option>
        <option value="reply">Solo risposte</option>
      </select>
      <label style="display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text2);cursor:pointer;padding:0 8px">
        <input type="checkbox" id="cShowDel" onchange="cToggleDel(this.checked)" style="width:16px;height:16px;accent-color:var(--t6)"/>
        Mostra eliminati
      </label>
      <button class="btn btn-s" onclick="cResetFilters()" title="Azzera filtri">↺ Reset</button>
      <button class="btn btn-d" id="cPurgeBtn" onclick="cPurgeConfirm()" style="margin-left:auto;display:none">Svuota cestino</button>
    </div>
    <div class="tcard">
      <div class="twrap">
        <table>
          <thead>
            <tr>
              <th>Utente</th>
              <th>Commento</th>
              <th>Video</th>
              <th>Data</th>
              <th>Stato</th>
              <th style="width:100px">Azioni</th>
            </tr>
          </thead>
          <tbody id="cBody"></tbody>
        </table>
      </div>
      <div id="cMore" style="padding:16px;text-align:center"></div>
    </div>
  `;

  // Reset completo quando entro nella pagina.
  cState.page = 1;
  cState.search = "";
  cState.showDel = false;
  cState.videoId = "";
  cState.type = "";
  cState.comments = [];
  cState.total = 0;
  loadCommentVideos();
  loadComments(true);
}

// Popola il select "filtra per video" con l'elenco compatto dei video he hanno almeno un commento (con conteggio commenti tra parentesi).
async function loadCommentVideos() {
  const sel = document.getElementById("cVideoSel");
  if (!sel) return;
  try {
    const d = await apiFetch(`/comments/videos-list?show_deleted=${cState.showDel}`);
    cState.videos = d.videos || [];
    const cur = cState.videoId;  // preservo la selezione corrente
    sel.innerHTML =
      '<option value="">Tutti i video</option>' +
      cState.videos
        .map(
          (v) =>
            `<option value="${v.id}">${esc(trunc(v.title || `Video #${v.id}`, 60))} (${v.comment_count})</option>`
        )
        .join("");
    sel.value = cur;
  } catch (e) {
    /* fallback silenzioso */
  }
}

function cVideoFilter(v) {
  cState.videoId = v;
  cState.page = 1;
  cState.comments = [];
  loadComments(true);
}

function cTypeFilter(v) {
  // Sanitizzo: accetto solo i due valori validi
  cState.type = v === "parent" || v === "reply" ? v : "";
  cState.page = 1;
  cState.comments = [];
  loadComments(true);
}

// Reset di tutti i filtri (stato + UI).
function cResetFilters() {
  cState.search = "";
  cState.videoId = "";
  cState.type = "";
  cState.showDel = false;
  cState.page = 1;
  cState.comments = [];

  // Reset campi UI
  const sb = document.querySelector(".sbox input");
  if (sb) sb.value = "";
  const vs = document.getElementById("cVideoSel");
  if (vs) vs.value = "";
  const ts = document.getElementById("cTypeSel");
  if (ts) ts.value = "";
  const sd = document.getElementById("cShowDel");
  if (sd) sd.checked = false;
  const pb = document.getElementById("cPurgeBtn");
  if (pb) pb.style.display = "none";

  loadCommentVideos();
  loadComments(true);
}

// Ricerca
function cSearch(v) {
  clearTimeout(cTimer);
  cTimer = setTimeout(() => {
    cState.search = v;
    cState.page = 1;
    cState.comments = [];
    loadComments(true);
  }, 400);
}

// Toggle "Mostra eliminati".
// Mostro il bottone "Svuota cestino" solo se sto guardando gli eliminati:
// non ha senso averlo visibile se nemmeno vedo cosa sto svuotando.
function cToggleDel(v) {
  cState.showDel = v;
  cState.page = 1;
  cState.comments = [];

  // Mostra/nascondi bottone svuota cestino.
  const b = document.getElementById("cPurgeBtn");
  if (b) b.style.display = v ? "" : "none";

  // Refresh anche la lista video: i conteggi cambiano.
  loadCommentVideos();
  loadComments(true);
}

// Fetch commenti. reset=true -> parti da capo (skeleton).
// reset=false -> "Mostra altri".
async function loadComments(reset) {
  const tb = document.getElementById("cBody");
  if (!tb) return;

  if (reset) {
    tb.innerHTML = Array(4)
      .fill("")
      .map(
        () => `
      <tr>
        <td style="padding:16px"><div style="display:flex;gap:10px">${sk("34px", 34)}<div>${sk("80px", 13)}${sk("120px", 10)}</div></div></td>
        <td style="padding:16px">${sk("200px", 14)}</td>
        <td style="padding:16px">${sk("120px", 14)}</td>
        <td style="padding:16px">${sk("80px", 14)}</td>
        <td style="padding:16px">${sk("60px", 22)}</td>
        <td></td>
      </tr>
    `
      )
      .join("");
  }

  const p = new URLSearchParams({
    page: cState.page,
    limit: cState.limit,
    show_deleted: cState.showDel,
  });
  if (cState.search) p.set("search", cState.search);
  if (cState.videoId) p.set("video_id", cState.videoId);
  if (cState.type) p.set("type", cState.type);

  try {
    const d = await apiFetch(`/comments?${p}`);
    cState.comments = reset ? d.comments : cState.comments.concat(d.comments);
    cState.total = d.pagination.total;
    renderCommentTable();
  } catch (e) {
    tb.innerHTML = `
      <tr><td colspan="6">
        <div class="empty"><div class="empty-ico">!</div><div class="empty-t">Errore</div></div>
      </td></tr>
    `;
  }
}

function renderCommentTable() {
  const tb = document.getElementById("cBody");
  const more = document.getElementById("cMore");

  if (!cState.comments.length) {
    tb.innerHTML = `
      <tr><td colspan="6">
        <div class="empty"><div class="empty-ico">◫</div><div class="empty-t">Nessun commento</div></div>
      </td></tr>
    `;
    if (more) more.innerHTML = "";
    return;
  }

  tb.innerHTML = cState.comments
    .map((c, i) => {
      const col = COLORS[i % COLORS.length];
      const isDel = !!c.deleted_at;
      return `
      <tr style="${isDel ? "opacity:.45" : ""}">
        <td style="padding:16px 20px">
          <div style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="openUserDetail(${c.user_id})">
            <div style="width:34px;height:34px;border-radius:12px;background:linear-gradient(135deg,${col}30,${col}60);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:${col};text-transform:uppercase;flex-shrink:0">${c.username ? c.username[0] : "?"}</div>
            <div>
              <div style="font-weight:600;font-size:13px">${esc(c.username || "Rimosso")}${c.user_role === "banned" ? ' <span class="b-ban" style="font-size:8px">BAN</span>' : ""}</div>
              <div style="font-size:11px;color:var(--text3)">${esc(c.email || "")}</div>
            </div>
          </div>
        </td>
        <td style="padding:16px 20px;max-width:280px">
          ${c.parent_id ? '<span style="font-size:10px;color:var(--text3);background:var(--s1);padding:1px 6px;border-radius:4px;margin-right:6px">↩ Risposta</span>' : ""}
          <span style="font-size:13px;color:var(--text2)">${esc(trunc(c.content, 100))}</span>
        </td>
        <td style="padding:16px 20px;font-size:13px;color:var(--text2);max-width:160px;cursor:pointer" onclick="openVideoDetail(${c.video_id})">
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(trunc(c.video_title || "Rimosso", 35))}</div>
        </td>
        <td style="padding:16px 20px;font-size:12px;color:var(--text3);white-space:nowrap">
          ${fd(c.created_at)}<br>
          <span style="font-size:11px">${ft(c.created_at)}</span>
        </td>
        <td style="padding:16px 20px"><span class="badge ${isDel ? "b-del" : "b-act"}">${isDel ? "Eliminato" : "Attivo"}</span></td>
        <td style="padding:16px 20px">
          <div class="acts">
            ${
              // Eliminato -> Ripristina. Attivo -> Elimina
              isDel
                ? `<button class="btn-i" title="Ripristina" onclick="restoreComment(${c.id})">↻</button>`
                : `<button class="btn-i" title="Elimina"    onclick="delCommentConfirm(${c.id})">X</button>`
            }
            ${
              // Bottone Banna solo se l'utente esiste ancora e non bannato.
              c.user_id && c.user_role !== "banned"
                ? `<button class="btn-i" title="Banna" onclick="banUser(${c.user_id},'${esc(c.username || "").replace(/'/g, "\\'")}')">!</button>`
                : ""
            }
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  // Footer: mostra altri oppure conteggio totale.
  if (more) {
    const s = cState.comments.length;
    const t = cState.total;
    more.innerHTML =
      s < t
        ? `<div style="display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap">
           <span style="font-size:13px;color:var(--text3)">${s} di ${t}</span>
           <button class="btn btn-s" onclick="cMore()">Mostra altri</button>
         </div>`
        : `<span style="font-size:13px;color:var(--text3)">${t} ${t === 1 ? "commento" : "commenti totali"}</span>`;
  }
}

function cMore() {
  cState.page++;
  loadComments(false);
}

// Soft-delete: apre modale di conferma. Ricordo che si puo ripristinare.
function delCommentConfirm(id) {
  openModal(
    `
    <div class="mh"><h2 class="outfit">Elimina Commento</h2><button class="mx" onclick="closeModal()">✕</button></div>
    <div class="mb">
      <div class="confirm">
        Eliminare questo commento?<br>
        <span style="font-size:13px;color:var(--text3)">Potrà essere ripristinato.</span>
      </div>
    </div>
    <div class="mf">
      <button class="btn btn-s" onclick="closeModal()">Annulla</button>
      <button class="btn btn-d" id="dcBtn">Elimina</button>
    </div>
  `,
    "sm"
  );

  document.getElementById("dcBtn").onclick = () => delComment(id);
}

async function delComment(id) {
  const btn = document.getElementById("dcBtn");
  btn.disabled = true;
  try {
    await apiFetch(`/comments/${id}`, { method: "DELETE" });
    toast("Eliminato");
    closeModal();
    cState.page = 1;
    cState.comments = [];
    loadComments(true);
  } catch (e) {
    toast(e.message, "err");
    btn.disabled = false;
    btn.textContent = "Elimina";
  }
}

// Ripristina un commento soft-deleted (rimette deleted_at a NULL).
async function restoreComment(id) {
  try {
    await apiFetch(`/comments/${id}/restore`, { method: "PUT" });
    toast("Ripristinato");
    cState.page = 1;
    cState.comments = [];
    loadComments(true);
  } catch (e) {
    toast(e.message, "err");
  }
}

// Purge definitivo: elimina dal DB tutte le righe con deleted_at != NULL.
function cPurgeConfirm() {
  openModal(
    `
    <div class="mh"><h2 class="outfit">Svuota cestino commenti</h2><button class="mx" onclick="closeModal()">✕</button></div>
    <div class="mb">
      <div class="confirm">
        Svuotare il cestino dei commenti?<br>
        <span style="font-size:13px;color:var(--text3)">Verranno rimossi solo i commenti già eliminati. Operazione non reversibile.</span>
      </div>
    </div>
    <div class="mf">
      <button class="btn btn-s" onclick="closeModal()">Annulla</button>
      <button class="btn btn-d" id="cPgBtn">Svuota cestino</button>
    </div>
  `,
    "sm"
  );

  document.getElementById("cPgBtn").onclick = cPurge;
}

async function cPurge() {
  const btn = document.getElementById("cPgBtn");
  btn.disabled = true;
  btn.textContent = "...";
  try {
    const r = await apiFetch("/comments/purge", { method: "DELETE" });
    toast(`Eliminati ${r.deleted} commenti`);
    closeModal();
    cState.page = 1;
    cState.comments = [];
    loadComments(true);
  } catch (e) {
    toast(e.message, "err");
    btn.disabled = false;
    btn.textContent = "Svuota cestino";
  }
}