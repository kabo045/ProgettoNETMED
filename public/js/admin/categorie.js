// Pannello CRUD riusabile per Categorie e Tag.
// Un file unico usato per entrambi: cambio solo endpoint + nome + stile.
// - chipStyle=true -> render (per i tag)
// - chipStyle=false -> render (per le categorie)


// Stato locale (globale al file). Ok cosi perche' la pagina e' semplice.
let crudSearch = "";
let crudItems = [];   // tutti gli item scaricati (una fetch sola)
let crudVisible = 5;  // quanti mostrare ora (aumenta col "Mostra altri")

async function pageCrud(endpoint, name, chipStyle) {
  const pc = document.getElementById("pageContent");
  crudSearch = "";
  crudVisible = 5;

  pc.innerHTML = `
    <div class="toolbar">
      <div class="sbox">
        <span class="si">Q</span>
        <input placeholder="Cerca ${name.toLowerCase()}..." maxlength="100" oninput="crudFilter(this.value,'${endpoint}','${name}',${chipStyle})"/>
      </div>
    </div>
    <div class="tcard">
      <div class="twrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Video associati</th>
              <th>Data creazione</th>
              <th style="width:90px">Azioni</th>
            </tr>
          </thead>
          <tbody id="cBody">
            ${Array(4)
              .fill("")
              .map(
                () => `
              <tr>
                <td style="padding:16px">${sk("140px", 16)}</td>
                <td style="padding:16px">${sk("60px", 22)}</td>
                <td style="padding:16px">${sk("100px", 14)}</td>
                <td></td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <div id="cShowMore"></div>
    </div>
  `;

  try {
    crudItems = await apiFetch(endpoint);
    renderCrud(endpoint, name, chipStyle);
  } catch (e) {
    document.getElementById("cBody").innerHTML = `
      <tr><td colspan="4">
        <div class="empty"><div class="empty-ico">!</div><div class="empty-t">Errore</div></div>
      </td></tr>
    `;
  }
}

// Ricerca client-side: filtro l'array gia' in memoria
// Reset del "Mostra altri" perche' altrimenti dopo la filter il conteggio visible potrebbe essere sfasato.
function crudFilter(val, endpoint, name, chipStyle) {
  crudSearch = val.toLowerCase();
  crudVisible = 5;
  renderCrud(endpoint, name, chipStyle);
}

function renderCrud(endpoint, name, chipStyle) {
  const tb = document.getElementById("cBody");
  const sm = document.getElementById("cShowMore");

  // Applico la ricerca se il search e' vuoto uso l'array intero.
  const filtered = crudSearch
    ? crudItems.filter((it) => it.name.toLowerCase().includes(crudSearch))
    : crudItems;

  if (!filtered.length) {
    tb.innerHTML = `
      <tr><td colspan="4">
        <div class="empty">
          <div class="empty-ico">${chipStyle ? "#" : "☰"}</div>
          <div class="empty-t">${crudSearch ? "Nessun risultato" : "Nessun " + name.toLowerCase()}</div>
        </div>
      </td></tr>
    `;
    if (sm) sm.innerHTML = "";
    return;
  }
  const visible = filtered.slice(0, crudVisible);
  const remaining = filtered.length - crudVisible;

  tb.innerHTML = visible
    .map((it, i) => {
      const col = COLORS[i % COLORS.length];
      return `
      <tr>
        <td style="padding:16px 20px">
          ${
            chipStyle
              ? `<span class="tag-chip" style="font-size:13px;padding:5px 14px">${esc(it.name)}</span>`
              : `<div style="display:flex;align-items:center;gap:12px">
                <div style="width:12px;height:12px;border-radius:50%;background:${col}"></div>
                <span style="font-weight:600">${esc(it.name)}</span>
              </div>`
          }
        </td>
        <td style="padding:16px 20px"><span class="badge" style="color:${col};background:${col}12">${it.video_count} video</span></td>
        <td style="padding:16px 20px;font-size:13px;color:var(--text3)">${fd(it.created_at)}</td>
        <td style="padding:16px 20px">
          <div class="acts">
            <button class="btn-i" onclick="openCrudModal('${endpoint}','${name}',${it.id},'${esc(it.name).replace(/'/g, "\\'")}')">/</button>
            <button class="btn-i" onclick="delCrudConfirm('${endpoint}','${name}',${it.id},'${esc(it.name).replace(/'/g, "\\'")}')">X</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  // Footer: bottone "Mostra altri" oppure conteggio totale.
  if (sm) {
    if (remaining > 0) {
      sm.innerHTML = `
        <div style="padding:14px 20px;border-top:1px solid var(--border)">
          <button onclick="crudShowMore('${endpoint}','${name}',${chipStyle})"
                  style="width:100%;padding:10px;background:none;border:1px dashed var(--border,#e2e8f0);border-radius:10px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:var(--t6,#0d7a4d);transition:all .2s"
                  onmouseenter="this.style.background='var(--t0,#eafaf0)'"
                  onmouseleave="this.style.background='none'">
            Mostra altri (${remaining}) ↓
          </button>
        </div>
      `;
    } else {
      sm.innerHTML = `<div style="padding:12px 20px;border-top:1px solid var(--border);text-align:center;font-size:13px;color:var(--text3)">${filtered.length} ${name.toLowerCase()} totali</div>`;
    }
  }
}

function crudShowMore(endpoint, name, chipStyle) {
  crudVisible += 5;
  renderCrud(endpoint, name, chipStyle);
}

// Se id  passato -> "Modifica" (input precompilato).
// Se id null -> "Nuovo" (input vuoto).
function openCrudModal(endpoint, name, id, currentName) {
  openModal(
    `
    <div class="mh">
      <h2 class="outfit">${id ? "Modifica" : "Nuovo"} ${name}</h2>
      <button class="mx" onclick="closeModal()">✕</button>
    </div>
    <div class="mb">
      <div class="fg">
        <label class="fl">Nome ${name} *</label>
        <input class="fi" id="cName" value="${currentName || ""}" placeholder="es. ${name === "Categoria" ? "Fisioterapia" : "riabilitazione"}"/>
        ${endpoint === "/tags" ? '<div class="fh">I tag vengono salvati in minuscolo</div>' : ""}
      </div>
    </div>
    <div class="mf">
      <button class="btn btn-s" onclick="closeModal()">Annulla</button>
      <button class="btn btn-p" id="cSaveBtn">${id ? "Salva" : "Crea"}</button>
    </div>
  `,
    "sm"
  );

  document.getElementById("cSaveBtn").onclick = () => saveCrud(endpoint, name, id || null);

  // Focus sull'input dopo l'apertura della modale
  // Il setTimeout serve perche il DOM della modale non subito pronto.
  setTimeout(() => {
    const i = document.getElementById("cName");
    if (i) i.focus();
  }, 100);
}

// Salva: POST se nuovo, PUT se esistente.
async function saveCrud(endpoint, name, id) {
  const val = document.getElementById("cName").value.trim();
  if (!val) {
    toast("Nome obbligatorio", "err");
    return;
  }

  const btn = document.getElementById("cSaveBtn");
  btn.disabled = true;
  btn.textContent = "...";

  try {
    if (id)
      await apiFetch(`${endpoint}/${id}`, { method: "PUT", body: JSON.stringify({ name: val }) });
    else await apiFetch(endpoint, { method: "POST", body: JSON.stringify({ name: val }) });
    toast(id ? "Aggiornato!" : "Creato!");
    closeModal();
    // Ricarico la pagina corrente (dashboard, videos, users, ecc) 
    nav(currentPage);
  } catch (e) {
    toast(e.message, "err");
    btn.disabled = false;
    btn.textContent = id ? "Salva" : "Crea";
  }
}

// Conferma eliminazione il backend blocca se ci sono video associati,
function delCrudConfirm(endpoint, name, id, itemName) {
  openModal(
    `
    <div class="mh"><h2 class="outfit">Elimina ${name}</h2><button class="mx" onclick="closeModal()">✕</button></div>
    <div class="mb"><div class="confirm">Eliminare <b>"${itemName}"</b>?</div></div>
    <div class="mf">
      <button class="btn btn-s" onclick="closeModal()">Annulla</button>
      <button class="btn btn-d" id="cDelBtn">Elimina</button>
    </div>
  `,
    "sm"
  );

  document.getElementById("cDelBtn").onclick = () => delCrud(endpoint, id);
}

async function delCrud(endpoint, id) {
  const btn = document.getElementById("cDelBtn");
  btn.disabled = true;
  btn.textContent = "...";
  try {
    await apiFetch(`${endpoint}/${id}`, { method: "DELETE" });
    toast("Eliminato");
    closeModal();
    nav(currentPage);
  } catch (e) {
    toast(e.message, "err");
    btn.disabled = false;
    btn.textContent = "Elimina";
  }
}