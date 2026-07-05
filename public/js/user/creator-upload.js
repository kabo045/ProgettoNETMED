const CU = {
  mode: "create",   // "create" (nuovo) | "edit" (modifica esistente)
  videoId: null,    // valorizzato solo in modalita' edit
  categories: [],
  tags: [],
  initial: null,    // snapshot dei valori iniziali per il dirty-check
};

// Bootstrap: verifica login e ruolo, decide la modalita' dal query string.
(function init() {
  loadTheme();
  loadAuth();
  renderHeaderUser();
  const params = new URLSearchParams(window.location.search);
  const idParam = parseInt(params.get("id"), 10);
  if (Number.isFinite(idParam) && idParam > 0) {
    CU.mode = "edit";
    CU.videoId = idParam;
    document.getElementById("cuTitle").textContent = "Modifica video";
    document.getElementById("cuSubtitle").textContent = "Aggiorna le informazioni del tuo video.";
    document.getElementById("cuSubmitLabel").textContent = "Salva modifiche";
    document.title = "NETMED";
  }

  if (!NM.user) {
    return goLogin();
  }

  // Rilettura fresca del ruolo. Se e' admin o non verificato, mostro uno stato dedicato invece del form.
  refreshAuthMe().then(() => {
    if (!NM.user) return;
    if (NM.user.role === "admin") return cuRenderState("admin");
    if (!NM.user.is_verified) return cuRenderState("notVerified");

    cuBootstrap();
  });

  window.addEventListener("storage", (e) => {
    if (e.key === "nm_theme") loadTheme();
    if (e.key === "token" || e.key === "user") {
      loadAuth();
      renderHeaderUser();
      if (!NM.user) goLogin();
    }
  });
})();

// Fetch categorie + tag + (se edit) dati video, poi popola form e anteprima.
async function cuBootstrap() {
  const [c, t] = await Promise.all([api("/api/user/categories"), api("/api/user/tags")]);
  CU.categories = c.ok && Array.isArray(c.data) ? c.data : [];
  CU.tags = t.ok && t.data && Array.isArray(t.data.tags) ? t.data.tags : [];

  cuRenderCategories();
  cuRenderTags();

  if (CU.mode === "edit") {
    const r = await api("/api/creator/videos/" + CU.videoId);
    if (!r.ok) {
      cuRenderState("notFound", r.data && r.data.error);
      return;
    }
    cuFillForm(r.data);
  }

  cuSnapshotInitial();
  cuBindCounters();
  cuOnYidChange();          
  cuRenderPreviewAuthor();
}

// Popola il <select> con le categorie + voce "Crea nuova".
function cuRenderCategories() {
  const sel = document.getElementById("cuCat");
  if (!sel) return;
  const opts = ['<option value="">— Nessuna —</option>'].concat(
    CU.categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
  );
  opts.push('<option value="__new__">+ Crea nuova categoria…</option>');
  sel.innerHTML = opts.join("");
}

// Mostra il campo "nuova categoria" quando l'utente sceglie di crearla al volo.
function cuOnCatChange() {
  const sel = document.getElementById("cuCat");
  const wrap = document.getElementById("cuNewCatWrap");
  const inp = document.getElementById("cuNewCat");
  if (!sel || !wrap) return;
  if (sel.value === "__new__") {
    wrap.style.display = "block";
    if (inp) setTimeout(() => inp.focus(), 10);
  } else {
    wrap.style.display = "none";
    if (inp) inp.value = "";
  }
}
window.cuOnCatChange = cuOnCatChange;

// Renderizza i chip dei tag esistenti come checkbox spuntabili.
function cuRenderTags() {
  const box = document.getElementById("cuTagsBox");
  const help = document.getElementById("cuTagsHelp");
  if (!box) return;

  box.innerHTML = CU.tags
    .map(
      (t) => `
    <label class="cu-tag-chip" data-name="${escapeHtml(t.name)}">
      <input type="checkbox" value="${t.id}" class="cu-tag-cb" aria-label="${escapeHtml(t.name)}"/>
      <span class="cu-tag-chip-lbl">${escapeHtml(t.name)}</span>
    </label>
  `
    )
    .join("");

  if (help) {
    help.textContent = CU.tags.length
      ? "Seleziona i tag esistenti, oppure scrivine uno nuovo qui sopra e premi Invio."
      : "Nessun tag ancora: scrivine uno qui sopra e premi Invio per crearlo.";
  }
}

// Autocomplete: filtra mentre l'utente digita.
function cuTagFilter(q) {
  q = (q || "").trim().toLowerCase();
  document.querySelectorAll("#cuTagsBox .cu-tag-chip").forEach((chip) => {
    const name = (chip.getAttribute("data-name") || "").toLowerCase();
    chip.style.display = !q || name.indexOf(q) !== -1 ? "" : "none";
  });
}

// Invio nel campo tag: se il tag esiste lo spunto, altrimenti lo creo sul server.
async function cuTagAdd() {
  const inp = document.getElementById("cuTagInput");
  if (!inp) return;
  const raw = inp.value.trim();
  if (!raw) return;
  const norm = raw.toLowerCase().replace(/\s+/g, " ");

  // Cerco tra i chip esistenti (confronto case-insensitive sul name).
  const existing = Array.from(document.querySelectorAll("#cuTagsBox .cu-tag-cb")).find(
    (cb) => (cb.getAttribute("aria-label") || "").toLowerCase() === norm
  );
  if (existing) {
    existing.checked = true;
    inp.value = "";
    cuTagFilter("");
    return;
  }

  // Tag nuovo: lo creo con POST /creator/tags.
  inp.disabled = true;
  const r = await api("/api/creator/tags", { method: "POST", body: { name: raw } });
  inp.disabled = false;
  inp.focus();
  if (!r.ok || !r.data || !r.data.id) {
    toast((r.data && r.data.error) || "Impossibile aggiungere il tag", "err");
    return;
  }

  let cb = Array.from(document.querySelectorAll("#cuTagsBox .cu-tag-cb")).find(
    (x) => parseInt(x.value, 10) === r.data.id
  );
  if (cb) {
    cb.checked = true;
  } else {
    const box = document.getElementById("cuTagsBox");
    const lbl = document.createElement("label");
    lbl.className = "cu-tag-chip";
    lbl.setAttribute("data-name", r.data.name);
    lbl.innerHTML =
      '<input type="checkbox" value="' +
      r.data.id +
      '" class="cu-tag-cb" ' +
      'aria-label="' +
      escapeHtml(r.data.name) +
      '" checked/>' +
      '<span class="cu-tag-chip-lbl">' +
      escapeHtml(r.data.name) +
      "</span>";
    box.insertBefore(lbl, box.firstChild);
    CU.tags.unshift({ id: r.data.id, name: r.data.name });
  }
  inp.value = "";
  cuTagFilter("");
  if (r.data.created) toast('Tag "' + r.data.name + '" creato', "ok");
}

// In modalita' edit: riempie i campi del form con i dati del video.
function cuFillForm(v) {
  document.getElementById("cuYid").value = v.youtube_id || "";
  document.getElementById("cuTitleI").value = v.title || "";
  document.getElementById("cuDesc").value = v.description || "";
  document.getElementById("cuCat").value = v.category_id || "";
  document.getElementById("cuPrivate").checked = !!v.is_private;

  if (Array.isArray(v.tag_ids) && v.tag_ids.length) {
    document.querySelectorAll(".cu-tag-cb").forEach((cb) => {
      if (v.tag_ids.includes(parseInt(cb.value, 10))) cb.checked = true;
    });
  }
}

// Snapshot dei valori attuali. Serve per rilevare modifiche non salvate.
function cuSnapshotInitial() {
  CU.initial = cuReadValues();
}

// Confronto tra i valori correnti e lo snapshot iniziale.
function cuIsDirty() {
  if (!CU.initial) return false;
  const cur = cuReadValues();
  if (cur.yid !== CU.initial.yid) return true;
  if (cur.title !== CU.initial.title) return true;
  if (cur.desc !== CU.initial.desc) return true;
  if (cur.cat !== CU.initial.cat) return true;
  if (cur.priv !== CU.initial.priv) return true;
  if (cur.tags.join(",") !== CU.initial.tags.join(",")) return true;
  return false;
}

// Legge tutti i valori del form in un oggetto normalizzato.
function cuReadValues() {
  const yidIn = (document.getElementById("cuYid").value || "").trim();
  const catSel = document.getElementById("cuCat");
  const isNewCat = catSel && catSel.value === "__new__";
  const newCatName = isNewCat ? (document.getElementById("cuNewCat").value || "").trim() : "";
  // Tag "in sospeso": l'utente li ha digitati nel campo ma non ha premuto
  // Invio. Li mando comunque al backend come new_tag_names cosi' vengono
  // creati e associati - senza obbligare l'utente a confermare uno per uno.
  const pendingTagInput = (document.getElementById("cuTagInput") || {}).value || "";
  const newTagNames = pendingTagInput
    .split(/[,\n]/)
    .map(function (s) { return s.trim().toLowerCase().replace(/\s+/g, " "); })
    .filter(function (s) { return s.length >= 2 && s.length <= 40; });
  return {
    yid: cuExtractYoutubeId(yidIn),
    yidRaw: yidIn,
    title: (document.getElementById("cuTitleI").value || "").trim(),
    desc: (document.getElementById("cuDesc").value || "").trim(),
    cat: isNewCat ? null : parseInt(catSel && catSel.value, 10) || null,
    newCat: newCatName,
    priv: !!document.getElementById("cuPrivate").checked,
    tags: Array.from(document.querySelectorAll(".cu-tag-cb:checked"))
      .map((cb) => parseInt(cb.value, 10))
      .filter(Number.isFinite)
      .sort((a, b) => a - b),
    newTagNames: newTagNames,
  };
}

// Estrae l'ID YouTube da URL o ID 
function cuExtractYoutubeId(raw) {
  const s = (raw || "").trim();
  if (!s) return "";
  if (/^[\w-]{6,20}$/.test(s)) return s;                             // ID nudo
  let m = s.match(/youtu\.be\/([\w-]{6,20})/);                       // youtu.be/XXX
  if (m) return m[1];
  m = s.match(/[?&]v=([\w-]{6,20})/);                                // watch?v=XXX
  if (m) return m[1];
  m = s.match(/youtube\.com\/(?:embed|shorts)\/([\w-]{6,20})/);      // /embed/XXX o /shorts/XXX
  if (m) return m[1];
  return "";
}

// Aggiorna l'anteprima al variare dell'input YouTube.
function cuOnYidChange() {
  const raw = (document.getElementById("cuYid").value || "").trim();
  const id = cuExtractYoutubeId(raw);
  const state = document.getElementById("cuYidState");
  const prev = document.getElementById("cuPreview");

  if (!raw) {
    if (state) state.innerHTML = "";
    cuPreviewEmpty();
    return;
  }

  if (!id) {
    if (state) state.innerHTML = `<span class="cu-yid-err">URL o ID non valido</span>`;
    cuPreviewEmpty();
    return;
  }

  if (state)
    state.innerHTML = `<span class="cu-yid-ok">ID rilevato: <code>${escapeHtml(id)}</code></span>`;
  // Anteprima con la thumbnail YT
  prev.innerHTML = `
    <img class="cu-preview-img"
         src="https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg"
         alt="Anteprima YouTube"
         onerror="this.style.display='none'"/>
    <div class="cu-preview-play" aria-hidden="true">▶</div>
  `;
  cuRenderPreviewTitle();
}

// Stato "vuoto" dell'anteprima quando non c'e' ancora un URL valido.
function cuPreviewEmpty() {
  const prev = document.getElementById("cuPreview");
  if (!prev) return;
  prev.innerHTML = `
    <div class="cu-preview-empty">
      <div class="cu-preview-empty-ico">▶</div>
      <div>Inserisci un link YouTube per vedere l'anteprima.</div>
    </div>
  `;
}

// Sincronizza il titolo del form con l'anteprima 
function cuRenderPreviewTitle() {
  const t = (document.getElementById("cuTitleI").value || "").trim();
  const el = document.getElementById("cuPreviewTitle");
  if (el) el.textContent = t || "— Titolo del video —";
}

// Popola l'avatar/nome autore nell'anteprima con i dati dell'utente loggato.
function cuRenderPreviewAuthor() {
  if (!NM.user) return;
  const av = document.getElementById("cuPreviewAvatar");
  const au = document.getElementById("cuPreviewAuthor");
  if (au) au.textContent = NM.user.username || "Tu";
  if (av) {
    if (NM.user.avatar_url) {
      av.innerHTML = `<img src="${escapeHtml(NM.user.avatar_url)}" alt=""
                            style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`;
    } else {
      av.textContent = (NM.user.username || "U").charAt(0).toUpperCase();
    }
  }
}

// Contatori "N / max" sotto i campi titolo e descrizione.
function cuBindCounters() {
  const ti = document.getElementById("cuTitleI");
  const tic = document.getElementById("cuTitleCnt");
  const de = document.getElementById("cuDesc");
  const dec = document.getElementById("cuDescCnt");

  function paintCount(input, counter, max) {
    if (!input || !counter) return;
    const update = () => {
      const n = (input.value || "").length;
      counter.textContent = `${n} / ${max}`;
      counter.classList.toggle("near", n > max * 0.9);
    };
    input.addEventListener("input", update);
    update();
  }

  paintCount(ti, tic, 255);
  paintCount(de, dec, 4000);
  if (ti) ti.addEventListener("input", cuRenderPreviewTitle);
}

// Submit: valida, chiama POST (create) o PUT (edit), invalida cache lato client.
async function cuSubmit() {
  const v = cuReadValues();
  if (!v.yid) {
    toast("Inserisci un link YouTube valido", "err");
    return;
  }
  if (!v.title) {
    toast("Il titolo è obbligatorio", "err");
    return;
  }

  const btn = document.getElementById("cuSubmitBtn");
  const lbl = document.getElementById("cuSubmitLabel");
  const oldLabel = lbl.textContent;
  btn.disabled = true;
  lbl.textContent = CU.mode === "edit" ? "Salvataggio…" : "Pubblicazione…";

  const body = {
    youtube_id: v.yid,
    title: v.title,
    description: v.desc,
    category_id: v.cat,
    is_private: v.priv,
    tag_ids: v.tags,
  };
  // Categoria nuova: il backend la crea (o riusa se esiste col nome).
  if (!v.cat && v.newCat) body.new_category_name = v.newCat;
  if (v.newTagNames && v.newTagNames.length) body.new_tag_names = v.newTagNames;

  const path = CU.mode === "edit" ? "/api/creator/videos/" + CU.videoId : "/api/creator/videos";

  const res = await api(path, { method: CU.mode === "edit" ? "PUT" : "POST", body });

  if (!res.ok) {
    btn.disabled = false;
    lbl.textContent = oldLabel;
    toast((res.data && res.data.error) || "Errore nel salvataggio", "err");
    return;
  }

  CU.bypassDirty = true;
  toast(CU.mode === "edit" ? "Video aggiornato" : "Video pubblicato");

  // Flag per la prossima pagina: rileggi tag/categorie del backend.
  // Cosi' i nuovi appaiono subito nel dropdown header ovunque.
  try { sessionStorage.setItem("nm_catalog_dirty", "1"); } catch (_) {}

  try {
    if (typeof loadHeaderTags === "function") await loadHeaderTags();
    const cr = await api("/api/user/categories");
    if (cr && cr.ok && Array.isArray(cr.data)) {
      window.NM = window.NM || {};
      NM.categories = cr.data;
    }
  } catch (_) {}

  // Pausa breve per mostrare il toast prima del redirect.
  setTimeout(() => goTo("creator.html"), 700);
}

// Annulla: se ci sono modifiche non salvate, chiede conferma.
async function cuCancel() {
  if (cuIsDirty()) {
    const ok = await nmConfirm({
      title: "Uscire senza salvare?",
      message: "Hai modifiche non salvate. Se esci ora verranno perse.",
      okLabel: "Esci comunque",
      cancelLabel: "Continua a modificare",
      danger: true,
    });
    if (!ok) return;
  }
  CU.bypassDirty = true;
  goTo("creator.html");
}

// Stati alternativi al form (blocchi con messaggio + azioni).
// Casi: "admin" (non puo' caricare), "notVerified" (deve essere verificato),
// "notFound" (video non trovato
function cuRenderState(kind, errorMsg) {
  const layout = document.getElementById("cuLayout");
  const state = document.getElementById("cuState");
  const head = document.querySelector(".cu-page-head");
  const bcrumb = document.querySelector(".cu-bcrumb");
  if (layout) layout.style.display = "none";
  if (head) head.style.display = "none";
  if (bcrumb) bcrumb.style.display = "none";
  if (!state) return;
  state.style.display = "block";

  let html = "";
  if (kind === "admin") {
    html = `
      <div class="cu-state-card">
        <div class="cu-state-ico"></div>
        <div class="cu-state-title">Sezione non disponibile per gli amministratori</div>
        <p class="cu-state-msg">
          Gli amministratori non possono caricare video propri: il loro ruolo è di moderazione.
          Per intervenire sui contenuti della piattaforma usa il pannello di amministrazione.
        </p>
        <div class="cu-state-actions">
          <button class="cu-btn cu-btn-primary" onclick="goTo('admin_dashboard.html')">Vai al pannello admin</button>
          <button class="cu-btn cu-btn-ghost" onclick="goTo('home.html')">Vai alla home</button>
        </div>
      </div>
    `;
  } else if (kind === "notVerified") {
    html = `
      <div class="cu-state-card">
        <div class="cu-state-ico">*</div>
        <div class="cu-state-title">Solo per utenti verificati</div>
        <p class="cu-state-msg">
          Per pubblicare video su NETMED il tuo account deve essere verificato da un amministratore.
          Se sei un professionista (medico, ricercatore, docente) contattaci per la verifica.
        </p>
        <div class="cu-state-actions">
          <button class="cu-btn cu-btn-ghost" onclick="goTo('profilo.html')">Vai al profilo</button>
        </div>
      </div>
    `;
  } else if (kind === "notFound") {
    html = `
      <div class="cu-state-card">
        <div class="cu-state-ico">!</div>
        <div class="cu-state-title">Video non trovato</div>
        <p class="cu-state-msg">${escapeHtml(errorMsg || "Il video richiesto non esiste o non sei autorizzato a modificarlo.")}</p>
        <div class="cu-state-actions">
          <button class="cu-btn cu-btn-primary" onclick="goTo('creator.html')">Torna ai tuoi video</button>
          <button class="cu-btn cu-btn-ghost" onclick="goTo('home.html')">Vai alla home</button>
        </div>
      </div>
    `;
  }
  state.innerHTML = html;
}

// Bootstrap immediato del nav header (dropdown Categorie/Tag/Esplora).
if (typeof nmBootstrapHeaderNav === "function") nmBootstrapHeaderNav(null);