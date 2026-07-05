// Pannello admin per la gestione degli utenti.
// - Tabella paginata con search + filtro ruolo (user/admin/banned)
// - Dettaglio utente in modale con avatar, badge verificato, stats,
//   ultimi commenti, video apprezzati
// - Cronologia video visualizzati
// - Verifica / revoca verifica (badge "creator")
// - Ban / sban / elimina definitivo

// Stato locale del pannello utenti.
let uState = {
  users: [],
  pag: { page: 1, limit: 5, total: 0, totalPages: 0 },
  search: "",
  role: "",       // "" | "user" | "admin" | "banned"
};

// Timer 
let uTimer;
// Entry point: disegna toolbar + tabella, poi carica la prima pagina.
async function pageUsers() {
  document.getElementById("pageContent").innerHTML = `
    <div class="toolbar">
      <div class="sbox">
        <span class="si">Q</span>
        <input placeholder="Cerca per username o email..." maxlength="100" oninput="uSearch(this.value)"/>
      </div>
      <select class="fsel" onchange="uRoleFilter(this.value)">
        <option value="">Tutti i ruoli</option>
        <option value="user">User</option>
        <option value="admin">Admin</option>
        <option value="banned">Bannati</option>
      </select>
    </div>
    <div class="tcard">
      <div class="twrap">
        <table>
          <thead>
            <tr>
              <th>Utente</th>
              <th>Ruolo</th>
              <th>Verificato</th>
              <th>Attività</th>
              <th>Registrato</th>
              <th style="width:180px">Azioni</th>
            </tr>
          </thead>
          <tbody id="uBody"></tbody>
        </table>
      </div>
      <div id="uPag"></div>
    </div>
  `;

  uState.pag.page = 1;
  uState.search = "";
  uState.role = "";
  loadUsers();
}

// Ricerca
function uSearch(v) {
  clearTimeout(uTimer);
  uTimer = setTimeout(() => {
    uState.search = v;
    uState.pag.page = 1;
    loadUsers();
  }, 400);
}

// Cambio filtro ruolo.
function uRoleFilter(v) {
  uState.role = v;
  uState.pag.page = 1;
  loadUsers();
}

// Fetch utenti + render tabella + paginazione.
async function loadUsers() {
  const tb = document.getElementById("uBody");
  if (!tb) return;

  // Skeleton di 5 righe grigie durante la fetch.
  tb.innerHTML = Array(5)
    .fill("")
    .map(
      () => `
    <tr>
      <td style="padding:16px"><div style="display:flex;gap:14px">${sk("40px", 40)}<div>${sk("120px", 14)}${sk("160px", 10)}</div></div></td>
      <td style="padding:16px">${sk("60px", 22)}</td>
      <td style="padding:16px">${sk("20px", 20)}</td>
      <td style="padding:16px">${sk("140px", 14)}</td>
      <td style="padding:16px">${sk("90px", 14)}</td>
      <td></td>
    </tr>
  `
    )
    .join("");

  const p = new URLSearchParams({ page: uState.pag.page, limit: 5 });
  if (uState.search) p.set("search", uState.search);
  if (uState.role) p.set("role", uState.role);

  try {
    const d = await apiFetch(`/users?${p}`);
    uState.users = d.users;
    uState.pag = d.pagination;
    renderUserTable();
  } catch (e) {
    tb.innerHTML = `
      <tr><td colspan="5">
        <div class="empty"><div class="empty-ico">!</div><div class="empty-t">Errore</div></div>
      </td></tr>
    `;
  }
}

// Render tabella utenti con avatar colorato + badge ruolo + azioni.
function renderUserTable() {
  const tb = document.getElementById("uBody");

  if (!uState.users.length) {
    tb.innerHTML = `
      <tr><td colspan="6">
        <div class="empty"><div class="empty-ico">◉</div><div class="empty-t">Nessun utente</div></div>
      </td></tr>
    `;
    return;
  }

  tb.innerHTML = uState.users
    .map((u, i) => {
      // Colore avatar deterministico in base all'indice riga.
      const c = COLORS[i % COLORS.length];
      const safeName = esc(u.username).replace(/'/g, "\\'");
      // Tooltip verifica: titolo + organizzazione dall'oggetto verified_profile.
      const vp = u.verified_profile || {};
      const vTip = u.is_verified
        ? `Verificato${vp.title ? " · " + vp.title : ""}${vp.organization ? " · " + vp.organization : ""}`
        : "";
      return `
      <tr style="${u.role === "banned" ? "opacity:.5" : ""}">
        <td style="padding:16px 20px">
          <div style="display:flex;align-items:center;gap:14px;cursor:pointer" onclick="openUserDetail(${u.id})">
            <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,${c}30,${c}60);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;color:${c};text-transform:uppercase;overflow:hidden">${u.avatar_url ? `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : u.username[0]}</div>
            <div>
              <div style="font-weight:600;display:flex;align-items:center;gap:6px">
                ${esc(u.username)}
                ${u.is_verified ? `<span class="verified-tick" title="${esc(vTip)}"></span>` : ""}
              </div>
              <div style="font-size:12px;color:var(--text3)">${esc(u.email)}</div>
            </div>
          </div>
        </td>
        <td style="padding:16px 20px">
          ${
            u.role === "admin"
              ? '<span class="b-admin">ADMIN</span>'
              : u.role === "banned"
                ? '<span class="b-ban">BANNATO</span>'
                : '<span class="badge b-pub">User</span>'
          }
        </td>
        <td style="padding:16px 20px;text-align:center">
          ${
            u.is_verified
              ? `<span class="b-verified" title="${esc(vTip)}"><span class="verified-tick"></span> SI</span>`
              : `<span style="color:var(--text3);font-size:12px">—</span>`
          }
        </td>
        <td style="padding:16px 20px;font-size:13px;color:var(--text2)">◎${fn(u.view_count)} ♥${fn(u.like_count)} ◫${fn(u.comment_count)}</td>
        <td style="padding:16px 20px;font-size:13px;color:var(--text3)">${fd(u.created_at)}</td>
        <td style="padding:16px 20px">
          <div class="acts">
            <button class="btn-i" title="Dettaglio" onclick="openUserDetail(${u.id})">•</button>
            <button class="btn-i" title="Cronologia video" onclick="openUserHistory(${u.id},'${safeName}')">⏱</button>
            ${
              u.is_verified
                ? `<button class="btn-i" title="Revoca verifica" onclick="revokeVerifyConfirm(${u.id},'${safeName}')">⊘</button>`
                : `<button class="btn-i" title="Verifica utente" onclick="verifyUserConfirm(${u.id},'${safeName}')">✓</button>`
            }
            ${
              u.role === "banned"
                ? `<button class="btn-i" title="Sbanna" onclick="unbanUser(${u.id},'${safeName}')">✓</button>`
                : `<button class="btn-i" title="Banna"  onclick="banUser(${u.id},'${safeName}')">!</button>`
            }
            <button class="btn-i" title="Elimina" onclick="delUserConfirm(${u.id},'${safeName}')">X</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  renderPag("uPag", uState.pag, (p) => {
    uState.pag.page = p;
    loadUsers();
  });
}

// Modale dettaglio utente: profilo, verifica, stats, cronologia,
// ultimi commenti, video apprezzati + azioni admin.
async function openUserDetail(id) {
  try {
    const u = await apiFetch(`/users/${id}`);
    const c = COLORS[id % COLORS.length];
    const safeName = esc(u.username).replace(/'/g, "\\'");
    const vp = u.verified_profile || {};

    // Sezione "Profilo verificato" — riepiloga cosa ha inserito l'utente
    // al momento della verifica + chi l'ha verificato quando. Utile agli
    // admin successivi per capire il contesto senza aprire l'audit log.
    const verifiedBlock = u.is_verified
      ? `
      <div class="vd-section" style="background:linear-gradient(135deg,#0d7a4d1a,#0d7a4d08);border:1px solid #0d7a4d40;border-radius:12px;padding:14px 16px;margin-bottom:16px">
        <div class="vd-section-title" style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span class="verified-tick lg"></span>
          <span style="color:#0d7a4d;font-weight:700">Profilo verificato</span>
        </div>
        ${vp.title ? `<div style="font-size:13px;margin-bottom:4px"><b>Titolo:</b> ${esc(vp.title)}</div>` : ""}
        ${vp.organization ? `<div style="font-size:13px;margin-bottom:4px"><b>Organizzazione:</b> ${esc(vp.organization)}</div>` : ""}
        ${vp.credentials ? `<div style="font-size:13px;margin-bottom:4px"><b>Credenziali:</b> ${esc(vp.credentials)}</div>` : ""}
        ${vp.notes ? `<div style="font-size:12px;color:var(--text3);margin-top:6px"><i>${esc(vp.notes)}</i></div>` : ""}
        <div style="font-size:11px;color:var(--text3);margin-top:8px;border-top:1px solid var(--border);padding-top:6px">
          Verificato il ${fd(u.verified_at)}${u.verified_by_username ? " da <b>" + esc(u.verified_by_username) + "</b>" : ""}
        </div>
      </div>
    `
      : "";

    openModal(
      `
      <div class="mh"><h2 class="outfit">Dettaglio Utente</h2><button class="mx" onclick="closeModal()">✕</button></div>
      <div class="mb">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
          <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,${c}30,${c}60);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:22px;color:${c};text-transform:uppercase;overflow:hidden">${u.avatar_url ? `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : u.username[0]}</div>
          <div>
            <div style="font-size:18px;font-weight:700;display:flex;align-items:center;gap:6px">
              ${esc(u.username)}
              ${u.is_verified ? `<span class="verified-tick lg" title="Verificato"></span>` : ""}
            </div>
            <div style="font-size:13px;color:var(--text3)">${esc(u.email)}</div>
            <div style="margin-top:4px">
              ${
                u.role === "admin"
                  ? '<span class="b-admin">Admin</span>'
                  : u.role === "banned"
                    ? '<span class="b-ban">Bannato</span>'
                    : '<span class="badge b-pub">User</span>'
              }
            </div>
          </div>
        </div>

        ${verifiedBlock}

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
          <div class="vd-stat"><div class="vd-stat-val outfit">${fn(u.view_count)}</div><div class="vd-stat-lab">Views</div></div>
          <div class="vd-stat"><div class="vd-stat-val outfit">${fn(u.like_count)}</div><div class="vd-stat-lab">Like</div></div>
          <div class="vd-stat"><div class="vd-stat-val outfit">${fn(u.comment_count)}</div><div class="vd-stat-lab">Commenti</div></div>
        </div>

        <div style="font-size:12px;color:var(--text3);margin-bottom:16px">Registrato il ${fd(u.created_at)}</div>

        ${
          u.recent_comments?.length
            ? `
          <div class="vd-section">
            <div class="vd-section-title">Ultimi commenti</div>
            ${showMoreList(
              u.recent_comments,
              (cm) => `
              <div style="padding:8px 0;border-bottom:1px solid var(--border)">
                <div style="font-size:12px;color:var(--text3)">${esc(cm.video_title || "")}</div>
                <div style="font-size:13px;color:var(--text2)">${esc(trunc(cm.content, 100))}</div>
              </div>
            `,
              5,
              "ud_comments"
            )}
          </div>
        `
            : ""
        }

        ${
          u.liked_videos?.length
            ? `
          <div class="vd-section">
            <div class="vd-section-title">Video apprezzati</div>
            ${showMoreList(
              u.liked_videos,
              (lv) => `
              <div style="padding:6px 0;font-size:13px;cursor:pointer;color:var(--t6)" onclick="closeModal();openVideoDetail(${lv.id})">▶ ${esc(lv.title)}</div>
            `,
              5,
              "ud_liked"
            )}
          </div>
        `
            : ""
        }
      </div>

      <div class="mf">
        <button class="btn btn-p btn-sm" onclick="openUserHistory(${u.id},'${safeName}')">Cronologia</button>
        ${
          u.is_verified
            ? `<button class="btn btn-w btn-sm" onclick="revokeVerifyConfirm(${u.id},'${safeName}')">⊘ Revoca verifica</button>`
            : `<button class="btn btn-sm" style="background:#0a6940;color:#fff" onclick="verifyUserConfirm(${u.id},'${safeName}')">Verifica</button>`
        }
        ${
          u.role !== "banned"
            ? `<button class="btn btn-w btn-sm" onclick="banUser(${u.id},'${safeName}')">Banna</button>`
            : `<button class="btn btn-p btn-sm" onclick="unbanUser(${u.id},'${safeName}')">Sbanna</button>`
        }
        <button class="btn btn-s" onclick="closeModal()">Chiudi</button>
      </div>
    `,
      "lg"
    );
  } catch (e) {
    toast(e.message, "err");
  }
}

// Cronologia video utente - modale paginata.
let _uHistState = { userId: null, username: "", page: 1, limit: 25, total: 0, totalPages: 0 };

// Apre la modale cronologia e lancia il primo fetch.
async function openUserHistory(userId, username) {
  _uHistState = { userId, username, page: 1, limit: 25, total: 0, totalPages: 0 };
  openModal(
    `
    <div class="mh">
      <h2 class="outfit">Cronologia di ${esc(username)}</h2>
      <button class="mx" onclick="closeModal()">✕</button>
    </div>
    <div class="mb">
      <div id="uHistInfo" style="font-size:13px;color:var(--text3);margin-bottom:12px">Caricamento…</div>
      <div id="uHistList"></div>
      <div id="uHistPag" style="margin-top:12px"></div>
    </div>
    <div class="mf">
      <button class="btn btn-d btn-sm" onclick="clearUserHistoryConfirm()">Pulisci cronologia</button>
      <button class="btn btn-s" onclick="closeModal()">Chiudi</button>
    </div>
  `,
    "lg"
  );
  loadUserHistory();
}

// Fetch della pagina corrente della cronologia + render.
async function loadUserHistory() {
  const list = document.getElementById("uHistList");
  if (!list) return;
  // Skeleton di 4 righe.
  list.innerHTML = Array(4)
    .fill("")
    .map(
      () =>
        `<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">${sk("120px", 68)}<div style="flex:1">${sk("80%", 14)}${sk("40%", 12)}</div></div>`
    )
    .join("");

  try {
    const d = await apiFetch(
      `/users/${_uHistState.userId}/history?page=${_uHistState.page}&limit=${_uHistState.limit}`
    );
    _uHistState.total = d.pagination.total;
    _uHistState.totalPages = d.pagination.totalPages;

    const info = document.getElementById("uHistInfo");
    if (info)
      info.textContent = d.pagination.total
        ? `${fn(d.pagination.total)} video distinti visti — pagina ${d.pagination.page}/${d.pagination.totalPages}`
        : "Nessun video visualizzato";

    if (!d.history.length) {
      list.innerHTML = `<div class="empty"><div class="empty-ico"></div><div class="empty-t">Nessuna cronologia</div></div>`;
      document.getElementById("uHistPag").innerHTML = "";
      return;
    }

    // Ogni riga: thumbnail + titolo + quante volte visto + quando l'ultima.
    list.innerHTML = d.history
      .map(
        (h) => `
      <div style="display:flex;gap:14px;padding:10px 0;border-bottom:1px solid var(--border);align-items:center;cursor:pointer"
           onclick="closeModal();openVideoDetail(${h.id})">
        <div style="flex:0 0 120px;height:68px;border-radius:8px;background:var(--s1);overflow:hidden;position:relative">
          ${
            h.thumbnail_url
              ? `<img src="${esc(h.thumbnail_url)}" alt="" style="width:100%;height:100%;object-fit:cover" loading="lazy">`
              : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text3)">▶</div>`
          }
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.title || "—")}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:4px">
            ${h.category_name ? `${esc(h.category_name)} · ` : ""}
            ${fn(h.view_times)} ${h.view_times === 1 ? "volta" : "volte"} ·
            ultima ${fd(h.last_viewed_at)}
          </div>
        </div>
      </div>
    `
      )
      .join("");

    renderPag("uHistPag", d.pagination, (p) => {
      _uHistState.page = p;
      loadUserHistory();
    });
  } catch (e) {
    list.innerHTML = `<div class="empty"><div class="empty-ico">!</div><div class="empty-t">${esc(e.message)}</div></div>`;
  }
}

// Conferma svuotamento cronologia
function clearUserHistoryConfirm() {
  const { userId, username } = _uHistState;
  openModal(
    `
    <div class="mh"><h2 class="outfit">Pulisci cronologia</h2><button class="mx" onclick="closeModal()">✕</button></div>
    <div class="mb">
      <div class="confirm">
        Eliminare l'intera cronologia di visualizzazione di <b>"${esc(username)}"</b>?<br>
        <span style="font-size:13px;color:var(--text3)">Verra' registrata nell'audit log.</span>
      </div>
    </div>
    <div class="mf">
      <button class="btn btn-s" onclick="openUserHistory(${userId},'${esc(username).replace(/'/g, "\\'")}')">Annulla</button>
      <button class="btn btn-d" id="uHistClearBtn">Pulisci</button>
    </div>
  `,
    "sm"
  );
  document.getElementById("uHistClearBtn").onclick = async () => {
    try {
      const r = await apiFetch(`/users/${userId}/history`, { method: "DELETE" });
      toast(`${r.deleted || 0} viste eliminate`);
      openUserHistory(userId, username);
    } catch (e) {
      toast(e.message, "err");
    }
  };
}

// Ban utente: modale di conferma + PUT ruolo = "banned".
// L'utente non puo' piu' fare login. La lista commenti si aggiorna.
async function banUser(id, name) {
  openModal(
    `
    <div class="mh"><h2 class="outfit">Banna Utente</h2><button class="mx" onclick="closeModal()">✕</button></div>
    <div class="mb">
      <div class="confirm">
        Bannare <b>"${name}"</b>?<br>
        <span style="font-size:13px;color:var(--text3)">L'utente non potrà più accedere.</span>
      </div>
    </div>
    <div class="mf">
      <button class="btn btn-s" onclick="closeModal()">Annulla</button>
      <button class="btn btn-d" id="banBtn">Banna</button>
    </div>
  `,
    "sm"
  );

  document.getElementById("banBtn").onclick = async () => {
    try {
      await apiFetch(`/users/${id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: "banned" }),
      });
      toast(`${name} bannato`);
      closeModal();
      if (currentPage === "users") loadUsers();
      if (currentPage === "comments") loadComments();
    } catch (e) {
      toast(e.message, "err");
      closeModal();
    }
  };
}

// Sbanna utente: rimette il ruolo a "user" senza modale di conferma
async function unbanUser(id, name) {
  try {
    await apiFetch(`/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role: "user" }) });
    toast(`${name} sbannato`);
    closeModal();
    if (currentPage === "users") loadUsers();
  } catch (e) {
    toast(e.message, "err");
  }
}

// Conferma eliminazione definitiva dell'utente.
// I dati vengono rimossi con CASCADE (voti, preferiti, commenti, ecc.).
function delUserConfirm(id, name) {
  openModal(
    `
    <div class="mh"><h2 class="outfit">Elimina Utente</h2><button class="mx" onclick="closeModal()">✕</button></div>
    <div class="mb">
      <div class="confirm">Eliminare <b>"${name}"</b>?<br>Tutti i dati verranno rimossi.</div>
    </div>
    <div class="mf">
      <button class="btn btn-s" onclick="closeModal()">Annulla</button>
      <button class="btn btn-d" id="duBtn">Elimina</button>
    </div>
  `,
    "sm"
  );

  document.getElementById("duBtn").onclick = () => delUser(id);
}

async function delUser(id) {
  const btn = document.getElementById("duBtn");
  btn.disabled = true;
  try {
    await apiFetch(`/users/${id}`, { method: "DELETE" });
    toast("Eliminato");
    closeModal();
    loadUsers();
  } catch (e) {
    toast(e.message, "err");
    btn.disabled = false;
    btn.textContent = "Elimina";
  }
}

//  Verifica utente (badge "creator")
//  L'admin promuove un utente a verified; l'utente compilera'
//  poi il proprio profilo professionale (titolo, organizzazione, credenziali) dalla propria pagina profilo.
//  La revoca e' reversibile e NON elimina i video gia' caricati.

// Modale di conferma verifica. Nessun form: solo un click di conferma.
// I dati professionali li compila poi l'utente dal profilo.
function verifyUserConfirm(userId, username) {
  openModal(
    `
    <div class="mh">
      <h2 class="outfit" style="display:flex;align-items:center;gap:8px">
        <span class="verified-tick lg"></span> Verifica ${esc(username)}
      </h2>
      <button class="mx" onclick="closeModal()">✕</button>
    </div>
    <div class="mb">
      <div class="confirm" style="line-height:1.5">
        Confermi di voler verificare <b>"${esc(username)}"</b>?<br>
        <span style="font-size:13px;color:var(--text3)">
          L'utente potrà caricare video, moderare i commenti sotto i propri contenuti
          e apparirà con il <span class="verified-tick"></span> accanto al nome.<br>
          I dati professionali (titolo, organizzazione, credenziali) saranno
          compilati dall'utente stesso dal proprio profilo.
        </span>
      </div>
    </div>
    <div class="mf">
      <button class="btn btn-s" onclick="closeModal()">Annulla</button>
      <button class="btn btn-sm" id="vfSubmit"
              style="background:#0a6940;color:#fff">
        Verifica
      </button>
    </div>
  `,
    "sm"
  );

  document.getElementById("vfSubmit").onclick = async () => {
    const btn = document.getElementById("vfSubmit");
    btn.disabled = true;
    btn.textContent = "Verifica in corso...";
    try {
      await apiFetch(`/users/${userId}/verify`, { method: "PUT", body: JSON.stringify({}) });
      toast(`${username} è ora verificato`);
      closeModal();
      if (currentPage === "users") loadUsers();
    } catch (e) {
      toast(e.message, "err");
      btn.disabled = false;
      btn.textContent = "Verifica";
    }
  };
}

// Revoca verifica: rimuove il badge ma lascia i video gia' caricati online.

function revokeVerifyConfirm(userId, username) {
  openModal(
    `
    <div class="mh"><h2 class="outfit">Revoca verifica</h2><button class="mx" onclick="closeModal()">✕</button></div>
    <div class="mb">
      <div class="confirm">
        Revocare la verifica a <b>"${esc(username)}"</b>?<br>
        <span style="font-size:13px;color:var(--text3)">
          L'utente perderà il badge <span class="verified-tick"></span> e il diritto di caricare nuovi video o moderare commenti.<br>
          <b>I video già caricati restano online</b> per garantire continuità del catalogo.
        </span>
      </div>
    </div>
    <div class="mf">
      <button class="btn btn-s" onclick="closeModal()">Annulla</button>
      <button class="btn btn-d" id="revokeVfBtn">⊘ Revoca</button>
    </div>
  `,
    "sm"
  );

  document.getElementById("revokeVfBtn").onclick = async () => {
    const b = document.getElementById("revokeVfBtn");
    b.disabled = true;
    try {
      await apiFetch(`/users/${userId}/verify`, { method: "DELETE" });
      toast(`Verifica revocata a ${username}`);
      closeModal();
      if (currentPage === "users") loadUsers();
    } catch (e) {
      toast(e.message, "err");
      b.disabled = false;
      b.textContent = "⊘ Revoca";
    }
  };
}