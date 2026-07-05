// Pannello admin per la moderazione delle segnalazioni.
// Le segnalazioni arrivano dagli utenti tramite il bottone "Segnala" sotto
// ai video. L'admin le vede in una tabella, sceglie se approvare (che
// blocca il video) o rifiutare, e puo' anche bloccare/sbloccare i video a
// mano. Filtri: stato (pending/approved/rejected), motivo, video, ricerca


// Etichette user-friendly per i motivi di segnalazione.
// Le chiavi corrispondono a quelle nel DB (colonna reason).
const REASON_LABELS = {
  inappropriate: "Contenuto inappropriato",
  misinformation: "Info mediche errate",
  copyright: "Violazione copyright",
  spam: "Spam",
  other: "Altro",
};

// Colori dei badge motivo servono a distinguere a colpo d'occhio.
const REASON_COLORS = {
  inappropriate: "#e11d48",
  misinformation: "#d97706",
  copyright: "#7c3aed",
  spam: "#64748b",
  other: "#64748b",
};

// Etichette stato
const STATUS_LABELS = {
  pending: "In attesa",
  approved: "Approvata",
  rejected: "Rifiutata",
};

// Stato locale della pagina segnalazioni.
let rState = {
  reports: [],
  page: 1,
  limit: 8,
  total: 0,
  status: "",
  search: "",
  reason: "",
  videoId: "",
  videos: [],       // lista compatta per il select "filtra per video"
  reviewedCount: 0, // usato per abilitare/disabilitare "Pulisci lette"
};

// timer della ricerca testuale.
let rTimer;
async function pageReports() {
  const pc = document.getElementById("pageContent");

  // Stats segnalazioni
  let stats = { pending: 0, approved: 0, rejected: 0, flagged_videos: 0, topReported: [] };
  try {
    stats = await apiFetch("/reports/stats");
  } catch (e) {
    /* fallback silenzioso */
  }
  rState.reviewedCount = (stats.approved || 0) + (stats.rejected || 0);

  pc.innerHTML = `
    <div class="sg" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px">

      <div class="sc" style="animation-delay:.05s">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <span style="font-size:13px;font-weight:500;color:var(--text2)">In attesa</span>
          <span style="width:36px;height:36px;border-radius:10px;background:#fef3c720;display:flex;align-items:center;justify-content:center;font-size:15px;color:#d97706">...</span>
        </div>
        <div class="outfit" style="font-size:28px;font-weight:700">${stats.pending}</div>
      </div>

      <div class="sc" style="animation-delay:.1s">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <span style="font-size:13px;font-weight:500;color:var(--text2)">Approvate</span>
          <span style="width:36px;height:36px;border-radius:10px;background:#dcfce720;display:flex;align-items:center;justify-content:center;font-size:15px;color:#16a34a">✓</span>
        </div>
        <div class="outfit" style="font-size:28px;font-weight:700">${stats.approved}</div>
      </div>

      <div class="sc" style="animation-delay:.15s">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <span style="font-size:13px;font-weight:500;color:var(--text2)">Rifiutate</span>
          <span style="width:36px;height:36px;border-radius:10px;background:#fef2f220;display:flex;align-items:center;justify-content:center;font-size:15px;color:#e11d48">✕</span>
        </div>
        <div class="outfit" style="font-size:28px;font-weight:700">${stats.rejected}</div>
      </div>

      <div class="sc" style="animation-delay:.2s">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <span style="font-size:13px;font-weight:500;color:var(--text2)">Video bloccati</span>
          <span style="width:36px;height:36px;border-radius:10px;background:#fef2f220;display:flex;align-items:center;justify-content:center;font-size:15px;color:#e11d48">⚑</span>
        </div>
        <div class="outfit" style="font-size:28px;font-weight:700">${stats.flagged_videos}</div>
      </div>

    </div>

    <div class="toolbar">
      <div class="sbox">
        <span class="si">Q</span>
        <input placeholder="Cerca per video, utente o motivo..." maxlength="100" oninput="rSearch(this.value)"/>
      </div>
      <select class="fsel" id="rStatusSel" onchange="rStatusFilter(this.value)" title="Filtra per stato">
        <option value="">Tutti gli stati</option>
        <option value="pending">In attesa</option>
        <option value="approved">Approvate</option>
        <option value="rejected">Rifiutate</option>
      </select>
      <select class="fsel" id="rReasonSel" onchange="rReasonFilter(this.value)" title="Filtra per motivo">
        <option value="">Tutti i motivi</option>
        ${Object.keys(REASON_LABELS)
          .map((k) => `<option value="${k}">${REASON_LABELS[k]}</option>`)
          .join("")}
      </select>
      <select class="fsel" id="rVideoSel" onchange="rVideoFilter(this.value)" title="Filtra per video">
        <option value="">Tutti i video</option>
      </select>
      <button class="btn btn-s" onclick="rResetFilters()" title="Azzera filtri">↺ Reset</button>
      <button class="btn btn-d" onclick="rClearReviewedConfirm()" style="margin-left:auto" ${rState.reviewedCount ? "" : "disabled"}>Pulisci lette</button>
    </div>

    <div class="tcard">
      <div class="twrap">
        <table>
          <thead>
            <tr>
              <th>Video</th>
              <th>Motivo</th>
              <th>Segnalato da</th>
              <th>Stato</th>
              <th>Data</th>
              <th style="width:140px">Azioni</th>
            </tr>
          </thead>
          <tbody id="rBody"></tbody>
        </table>
      </div>
      <div id="rMore" style="padding:16px;text-align:center"></div>
    </div>
  `;

  // Reset totale dello stato quando entro nella pagina.
  rState.page = 1;
  rState.status = "";
  rState.search = "";
  rState.reason = "";
  rState.videoId = "";
  rState.reports = [];
  rState.total = 0;
  loadReportVideos();
  loadReports(true);
}

// Popola il select "filtra per video" con la lista dei video che hanno
// almeno una segnalazione (endpoint dedicato per non trascinarsi
// migliaia di video inutili).
async function loadReportVideos() {
  const sel = document.getElementById("rVideoSel");
  if (!sel) return;
  try {
    const d = await apiFetch(`/reports/videos-list`);
    rState.videos = d.videos || [];
    const cur = rState.videoId;  // mantengo la selezione se e' gia' attiva
    sel.innerHTML =
      '<option value="">Tutti i video</option>' +
      rState.videos
        .map(
          (v) =>
            `<option value="${v.id}">${esc(trunc(v.title || `Video #${v.id}`, 60))} (${v.report_count})</option>`
        )
        .join("");
    sel.value = cur;
  } catch (e) {
    /* fallback silenzioso */
  }
}

// Ricerca testuale
function rSearch(v) {
  clearTimeout(rTimer);
  rTimer = setTimeout(() => {
    rState.search = v;
    rState.page = 1;
    rState.reports = [];
    loadReports(true);
  }, 400);
}

// I filtri resettano sempre pagina e lista accumulata.
function rStatusFilter(v) {
  rState.status = v;
  rState.page = 1;
  rState.reports = [];
  loadReports(true);
}

function rReasonFilter(v) {
  rState.reason = v;
  rState.page = 1;
  rState.reports = [];
  loadReports(true);
}

function rVideoFilter(v) {
  rState.videoId = v;
  rState.page = 1;
  rState.reports = [];
  loadReports(true);
}

// Azzera tutti i filtri e ricarica.
// Devo resettare anche il DOM dei select/input, altrimenti restano
// visualmente selezionati anche se lo stato JS e' vuoto.
function rResetFilters() {
  rState.search = "";
  rState.status = "";
  rState.reason = "";
  rState.videoId = "";
  rState.page = 1;
  rState.reports = [];

  const sb = document.querySelector(".sbox input");
  if (sb) sb.value = "";
  const ss = document.getElementById("rStatusSel");
  if (ss) ss.value = "";
  const rs = document.getElementById("rReasonSel");
  if (rs) rs.value = "";
  const vs = document.getElementById("rVideoSel");
  if (vs) vs.value = "";

  loadReports(true);
}

// Fetch segnalazioni + render tabella.
// `reset=true` significa "sto ripartendo da capo" (mostro skeleton e sovrascrivo).
// `reset=false` e' quando si clicca "Mostra altri" (append alla lista).
async function loadReports(reset) {
  const tb = document.getElementById("rBody");
  if (!tb) return;

  if (reset) {
    // Skeleton
    tb.innerHTML = Array(4)
      .fill("")
      .map(
        () => `
      <tr>
        <td style="padding:16px">${sk("160px", 14)}</td>
        <td style="padding:16px">${sk("120px", 22)}</td>
        <td style="padding:16px">${sk("100px", 14)}</td>
        <td style="padding:16px">${sk("70px", 22)}</td>
        <td style="padding:16px">${sk("80px", 14)}</td>
        <td></td>
      </tr>
    `
      )
      .join("");
  }

  const p = new URLSearchParams({ page: rState.page, limit: rState.limit });
  if (rState.status) p.set("status", rState.status);
  if (rState.reason) p.set("reason", rState.reason);
  if (rState.videoId) p.set("video_id", rState.videoId);
  if (rState.search) p.set("search", rState.search);

  try {
    const d = await apiFetch(`/reports?${p}`);
    // Se e' reset uso la nuova lista, se e' "mostra altri" concateno.
    rState.reports = reset ? d.reports : rState.reports.concat(d.reports);
    rState.total = d.pagination.total;
    renderReportTable();
  } catch (e) {
    tb.innerHTML = `
      <tr><td colspan="6">
        <div class="empty"><div class="empty-ico">!</div><div class="empty-t">Errore</div></div>
      </td></tr>
    `;
  }
}

// Render della tabella + bottone "Mostra altri" in fondo.
function renderReportTable() {
  const tb = document.getElementById("rBody");
  const more = document.getElementById("rMore");

  if (!rState.reports.length) {
    tb.innerHTML = `
      <tr><td colspan="6">
        <div class="empty"><div class="empty-ico">⚑</div><div class="empty-t">Nessuna segnalazione</div></div>
      </td></tr>
    `;
    if (more) more.innerHTML = "";
    return;
  }

  tb.innerHTML = rState.reports
    .map((r) => {
      const reasonCol = REASON_COLORS[r.reason] || "#64748b";
      const statusBadge =
        r.status === "pending"
          ? '<span class="badge b-priv">In attesa</span>'
          : r.status === "approved"
            ? '<span class="badge b-del">Approvata</span>'
            : '<span class="badge b-act">Rifiutata</span>';
      return `
      <tr>
        <td style="padding:14px 16px">
          <div style="cursor:pointer" onclick="openVideoDetail(${r.video_id})">
            <div style="font-weight:600;font-size:13px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.video_title || "Video rimosso")}</div>
            <div style="font-size:11px;color:var(--text3);font-family:monospace;margin-top:2px">${esc(r.youtube_id || "")}</div>
            ${r.is_flagged ? '<span class="badge b-del" style="font-size:8px;margin-top:4px">BLOCCATO</span>' : ""}
          </div>
        </td>
        <td style="padding:14px 16px">
          <span class="badge" style="color:${reasonCol};background:${reasonCol}12">${REASON_LABELS[r.reason] || r.reason}</span>
          ${r.comment ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">"${esc(r.comment)}"</div>` : ""}
        </td>
        <td style="padding:14px 16px">
          <div style="font-size:13px;font-weight:500">${esc(r.reporter_username || "Rimosso")}</div>
          <div style="font-size:11px;color:var(--text3)">${esc(r.reporter_email || "")}</div>
        </td>
        <td style="padding:14px 16px">${statusBadge}</td>
        <td style="padding:14px 16px;font-size:12px;color:var(--text3);white-space:nowrap">${fd(r.created_at)}<br><span style="font-size:11px">${ft(r.created_at)}</span></td>
        <td style="padding:14px 16px">
          <div class="acts">
            ${
              // Approva/Rifiuta appaiono solo per le segnalazioni pending.
              r.status === "pending"
                ? `
              <button class="btn-i" title="Approva (blocca video)" onclick="approveReport(${r.id})">✓</button>
              <button class="btn-i" title="Rifiuta" onclick="rejectReport(${r.id})">✕</button>
            `
                : ""
            }
            ${
              // Blocca/Sblocca video: separato dal flusso approve/reject
              // cosi l'admin puo' bloccare a prescindere.
              !r.is_flagged && r.status === "pending"
                ? `<button class="btn-i" title="Blocca video" onclick="flagVideo(${r.video_id},true)">⚑</button>`
                : r.is_flagged
                  ? `<button class="btn-i" title="Sblocca video" onclick="flagVideo(${r.video_id},false)">✓</button>`
                  : ""
            }
            <button class="btn-i" title="Elimina segnalazione" onclick="deleteReport(${r.id})">X</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  // Footer con "Mostra altri" oppure il totale se ho gia' tutto.
  if (more) {
    const s = rState.reports.length;
    const t = rState.total;
    more.innerHTML =
      s < t
        ? `<div style="display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap">
           <span style="font-size:13px;color:var(--text3)">${s} di ${t}</span>
           <button class="btn btn-s" onclick="rMore()">Mostra altri</button>
         </div>`
        : `<span style="font-size:13px;color:var(--text3)">${t} ${t === 1 ? "segnalazione" : "segnalazioni totali"}</span>`;
  }
}

// "Mostra altri": incrementa la pagina e appende alla lista.
function rMore() {
  rState.page++;
  loadReports(false);
}

// Approva la segnalazione: il backend imposta is_flagged=true sul video.
// Aggiorno anche le notifiche perche' il creator riceve una notifica.
async function approveReport(id) {
  try {
    await apiFetch(`/reports/${id}/approve`, { method: "PUT" });
    toast("Segnalazione approvata, video bloccato");
    rState.page = 1;
    rState.reports = [];
    loadReports(true);
    loadNotifications();
  } catch (e) {
    toast(e.message, "err");
  }
}

// Rifiuta la segnalazione: il video resta visibile, nessuna notifica push.
async function rejectReport(id) {
  try {
    await apiFetch(`/reports/${id}/reject`, { method: "PUT" });
    toast("Segnalazione rifiutata");
    rState.page = 1;
    rState.reports = [];
    loadReports(true);
  } catch (e) {
    toast(e.message, "err");
  }
}

// Blocca/sblocca il video manualmente (senza passare da una segnalazione).
async function flagVideo(videoId, flag) {
  try {
    await apiFetch(`/videos/${videoId}/flag`, {
      method: "PUT",
      body: JSON.stringify({ flagged: flag }),
    });
    toast(flag ? "Video bloccato" : "Video sbloccato");
    rState.page = 1;
    rState.reports = [];
    loadReports(true);
    loadNotifications();
  } catch (e) {
    toast(e.message, "err");
  }
}

// Elimina definitivamente la segnalazione dal DB. Non tocca il video.
async function deleteReport(id) {
  openModal(
    `
    <div class="mh"><h2 class="outfit">Elimina Segnalazione</h2><button class="mx" onclick="closeModal()">✕</button></div>
    <div class="mb"><div class="confirm">Eliminare questa segnalazione?</div></div>
    <div class="mf">
      <button class="btn btn-s" onclick="closeModal()">Annulla</button>
      <button class="btn btn-d" id="delRepBtn">Elimina</button>
    </div>
  `,
    "sm"
  );

  document.getElementById("delRepBtn").onclick = async () => {
    try {
      await apiFetch(`/reports/${id}`, { method: "DELETE" });
      toast("Segnalazione eliminata");
      closeModal();
      rState.page = 1;
      rState.reports = [];
      loadReports(true);
    } catch (e) {
      toast(e.message, "err");
      closeModal();
    }
  };
}

// Cancellazione: pulisce tutte le segnalazioni gia' lavorate
// (approved + rejected) lasciando in pace le pending.
function rClearReviewedConfirm() {
  if (!rState.reviewedCount) {
    toast("Nessuna segnalazione lavorata da eliminare", "err");
    return;
  }

  openModal(
    `
    <div class="mh"><h2 class="outfit">Pulisci segnalazioni lette</h2><button class="mx" onclick="closeModal()">✕</button></div>
    <div class="mb">
      <div class="confirm">
        Eliminare tutte le <b>${rState.reviewedCount}</b> segnalazioni già approvate o rifiutate?<br>
        <span style="font-size:13px;color:var(--text3)">Le segnalazioni in attesa non verranno toccate. Operazione non reversibile.</span>
      </div>
    </div>
    <div class="mf">
      <button class="btn btn-s" onclick="closeModal()">Annulla</button>
      <button class="btn btn-d" id="rClBtn">Elimina</button>
    </div>
  `,
    "sm"
  );

  document.getElementById("rClBtn").onclick = rClearReviewed;
}

async function rClearReviewed() {
  const btn = document.getElementById("rClBtn");
  btn.disabled = true;
  btn.textContent = "...";
  try {
    const r = await apiFetch("/reports/reviewed", { method: "DELETE" });
    toast(`Eliminate ${r.deleted} segnalazioni`);
    closeModal();
    pageReports();  // ricarico tutto per aggiornare anche le stats in alto
  } catch (e) {
    toast(e.message, "err");
    btn.disabled = false;
    btn.textContent = "Elimina";
  }
}