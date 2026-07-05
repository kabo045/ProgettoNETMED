// admin_audit.js - Pannello Audit Log del pannello admin.
// Mostra chi (admin) ha fatto cosa (ban, delete, flag, ecc.) e su cosa.
// Utile per capire dopo un problema chi ha toccato cosa. Ha filtro azione,
// ricerca testuale, paginazione tipo "Mostra altri" e un bottone per
// svuotare tutto (che registra a sua volta una voce audit_clear).

// Stato locale della pagina.
let auditState = {
  page: 1,
  limit: 8,
  actionF: "",  // filtro azione (chiave di AUDIT_LABELS)
  search: "",   // testo di ricerca
  entries: [],  // record accumulati (append col "Mostra altri")
  total: 0,
};

// Debounce timer della ricerca.
let auditTimer;

// Mappa azione -> [etichetta, colore badge].
// Serve sia al select filtro che al render riga.
// I colori sono coerenti con la severita': rosso scuro per delete,
// arancio per warning, verde per azioni positive, grigio per neutre.
const AUDIT_LABELS = {
  user_ban: ["Utente bannato", "#e11d48"],
  user_role_change: ["Cambio ruolo", "#d97706"],
  user_delete: ["Utente eliminato", "#be123c"],
  video_delete: ["Video eliminato", "#be123c"],
  video_flag: ["Video bloccato", "#d97706"],
  video_unflag: ["Video sbloccato", "#059669"],
  report_approve: ["Segnalazione approvata", "#0d7a4d"],
  report_reject: ["Segnalazione rifiutata", "#64748b"],
  audit_clear: ["Log svuotato", "#64748b"],
};

async function pageAudit() {
  const pc = document.getElementById("pageContent");
  pc.innerHTML = `
    <div class="toolbar">
      <div class="sbox">
        <span class="si">Q</span>
        <input placeholder="Cerca per admin, oggetto o dettagli..." maxlength="100" oninput="auditSearch(this.value)"/>
      </div>
      <select class="fsel" onchange="auditFilter(this.value)" style="min-width:200px">
        <option value="">Tutte le azioni</option>
        ${Object.entries(AUDIT_LABELS)
          .map(([k, v]) => `<option value="${k}">${v[0]}</option>`)
          .join("")}
      </select>
      <button class="btn btn-d" onclick="auditClearConfirm()" style="margin-left:auto">Pulisci tutto</button>
    </div>
    <div class="tcard">
      <div class="twrap">
        <table>
          <thead>
            <tr>
              <th style="width:160px">Data</th>
              <th style="width:180px">Admin</th>
              <th>Azione</th>
              <th>Oggetto</th>
              <th>Dettagli</th>
            </tr>
          </thead>
          <tbody id="auditBody"></tbody>
        </table>
      </div>
      <div id="auditMore" style="padding:16px;text-align:center"></div>
    </div>
  `;

  // Reset stato quando entro nella pagina.
  auditState.page = 1;
  auditState.actionF = "";
  auditState.search = "";
  auditState.entries = [];
  auditState.total = 0;
  loadAudit(true);
}

// Debounce 400ms sulla ricerca cosi non spammo il server ad ogni tasto.
function auditSearch(v) {
  clearTimeout(auditTimer);
  auditTimer = setTimeout(() => {
    auditState.search = v;
    auditState.page = 1;
    auditState.entries = [];
    loadAudit(true);
  }, 400);
}

// Cambio filtro azione: reset pagina + lista.
function auditFilter(v) {
  auditState.actionF = v;
  auditState.page = 1;
  auditState.entries = [];
  loadAudit(true);
}

// Fetch dei record.
// reset=true -> parto da capo (skeleton + sovrascrivo).
// reset=false -> "Mostra altri" (accodo alla lista esistente).
async function loadAudit(reset) {
  const body = document.getElementById("auditBody");
  const more = document.getElementById("auditMore");
  if (!body) return;

  if (reset) {
    // Skeleton di 4 righe.
    body.innerHTML = Array(4)
      .fill("")
      .map(() => `<tr><td colspan="5">${sk("100%", 18)}</td></tr>`)
      .join("");
  }

  try {
    const q = new URLSearchParams({ page: auditState.page, limit: auditState.limit });
    if (auditState.actionF) q.set("action", auditState.actionF);
    if (auditState.search) q.set("search", auditState.search);

    const data = await apiFetch(`/audit?${q}`);
    auditState.entries = reset ? data.entries : auditState.entries.concat(data.entries);
    auditState.total = data.pagination.total;
    renderAuditRows();
  } catch (e) {
    body.innerHTML = `<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--rose)">Errore: ${esc(e.message)}</td></tr>`;
    if (more) more.innerHTML = "";
  }
}

// Render della tabella + footer paginazione.
function renderAuditRows() {
  const body = document.getElementById("auditBody");
  const more = document.getElementById("auditMore");
  if (!body) return;

  if (!auditState.entries.length) {
    body.innerHTML = `
      <tr><td colspan="5">
        <div class="empty"><div class="empty-ico">⚙</div><div class="empty-t">Nessuna azione registrata</div></div>
      </td></tr>
    `;
    if (more) more.innerHTML = "";
    return;
  }

  body.innerHTML = auditState.entries
    .map((e) => {
      // Fallback su [action_grezza, grigio] se l'azione non e' mappata.
      const [label, col] = AUDIT_LABELS[e.action] || [e.action, "#64748b"];
      // Se manca l'admin (record vecchio, utente eliminato) mostro un trattino.
      const who = e.admin_username
        ? `${esc(e.admin_username)}`
        : `<span style="color:var(--text3)">—</span>`;
      // "user #42" oppure solo "user" se non c'e' id.
      const target = e.target_type
        ? `${e.target_type}${e.target_id ? " #" + e.target_id : ""}`
        : "";
      return `
      <tr>
        <td style="font-size:12px;color:var(--text2);white-space:nowrap">${fd(e.created_at)} ${ft(e.created_at)}</td>
        <td style="font-size:13px;font-weight:600">${who}</td>
        <td><span class="badge" style="color:${col};background:${col}15">${label}</span></td>
        <td style="font-size:12px;color:var(--text2);font-family:ui-monospace,monospace">${esc(target)}</td>
        <td style="font-size:13px;color:var(--text2)">${esc(e.details || "")}</td>
      </tr>
    `;
    })
    .join("");

  // Footer: se ho meno record del totale mostro "Mostra altri",
  // altrimenti solo il conteggio totale.
  if (more) {
    const shown = auditState.entries.length;
    const total = auditState.total;
    if (shown < total) {
      more.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap">
          <span style="font-size:13px;color:var(--text3)">${shown} di ${total}</span>
          <button class="btn btn-s" onclick="auditMore()">Mostra altri</button>
        </div>
      `;
    } else {
      more.innerHTML = `<span style="font-size:13px;color:var(--text3)">${total} ${total === 1 ? "record" : "record totali"}</span>`;
    }
  }
}

// "Mostra altri": incremento pagina e accodo.
function auditMore() {
  auditState.page++;
  loadAudit(false);
}

// Conferma svuotamento totale del log.
// Chicca: dopo aver cancellato tutto, il backend registra una nuova voce
// "audit_clear" cosi non si perde traccia di chi ha svuotato il log.
function auditClearConfirm() {
  if (!auditState.total) {
    toast("Nessun log da eliminare", "err");
    return;
  }

  openModal(
    `
    <div class="mh"><h2 class="outfit">Pulisci Audit Log</h2><button class="mx" onclick="closeModal()">✕</button></div>
    <div class="mb">
      <div class="confirm">
        Eliminare <b>tutti i ${auditState.total} record</b> dell'audit log?<br>
        <span style="font-size:13px;color:var(--text3)">Verra' registrata una singola voce nel log.</span>
      </div>
    </div>
    <div class="mf">
      <button class="btn btn-s" onclick="closeModal()">Annulla</button>
      <button class="btn btn-d" id="auClBtn">Elimina tutto</button>
    </div>
  `,
    "sm"
  );

  document.getElementById("auClBtn").onclick = auditClear;
}

async function auditClear() {
  const btn = document.getElementById("auClBtn");
  btn.disabled = true;
  btn.textContent = "...";
  try {
    const r = await apiFetch("/audit", { method: "DELETE" });
    toast(`Eliminati ${r.deleted} record`);
    closeModal();
    auditState.page = 1;
    auditState.entries = [];
    loadAudit(true);
  } catch (e) {
    toast(e.message, "err");
    btn.disabled = false;
    btn.textContent = "Elimina tutto";
  }
}