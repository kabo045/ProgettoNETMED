const CR = {
  videos: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  search: "",
  searchTimer: null,   // timer del debounce sulla search
};
(function init() {
  loadTheme();
  loadAuth();
  renderHeaderUser();

  if (!NM.user) {
    return goLogin();
  }
  refreshAuthMe().then(() => {
    if (!NM.user) return;
    if (NM.user.role === "admin") {
      renderCrAdminBlocked();
      return;
    }
    if (!NM.user.is_verified) {
      renderCrAccessDenied();
      return;
    }
    initUserSearch();
    loadHeaderCategoriesForCreatorPage();
    loadCreatorPage();
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

// Prima fetch: stats + prima pagina video in parallelo.
async function loadCreatorPage() {
  renderCrHeroSkeleton();
  renderCrListSkeleton();

  const [statsRes, vidsRes] = await Promise.all([
    api("/api/creator/my/stats"),
    api("/api/creator/my/videos?page=1&limit=" + CR.pagination.limit),
  ]);

  if (!statsRes.ok || !vidsRes.ok) {
    renderCrError(
      (statsRes.data && statsRes.data.error) ||
        (vidsRes.data && vidsRes.data.error) ||
        "Errore nel caricamento"
    );
    return;
  }

  renderCrHero(statsRes.data);
  CR.videos = vidsRes.data.videos || [];
  CR.pagination = vidsRes.data.pagination;
  renderCrList();
}

// Ricarica solo la lista (pagination o search).
async function reloadCrVideos() {
  const p = new URLSearchParams({
    page: CR.pagination.page,
    limit: CR.pagination.limit,
  });
  if (CR.search) p.set("search", CR.search);

  renderCrListSkeleton();
  const res = await api("/api/creator/my/videos?" + p.toString());
  if (!res.ok) {
    renderCrListError(res.data && res.data.error);
    return;
  }
  CR.videos = res.data.videos || [];
  CR.pagination = res.data.pagination;
  renderCrList();
}
function renderCrHeroSkeleton() {
  const el = document.getElementById("crHero");
  if (!el) return;
  el.innerHTML = `
    <div class="cr-hero-head">
      <h1 class="cr-hero-title">
        <span class="verified-tick xl"></span> I miei video
      </h1>
    </div>
    <p class="cr-hero-sub">Caricamento riepilogo…</p>
    <div class="cr-stats">
      ${[0, 0, 0, 0]
        .map(
          () => `
        <div class="cr-stat">
          <div class="cr-stat-val"><span class="cr-sk" style="width:60px;height:22px;display:inline-block">.</span></div>
          <div class="cr-stat-lab">—</div>
        </div>`
        )
        .join("")}
    </div>
  `;
}
function renderCrHero(stats) {
  const el = document.getElementById("crHero");
  if (!el) return;
  const userTag = NM.user
    ? verifiedTickHTML(!!NM.user.is_verified, NM.user.verified_profile, "lg")
    : "";
  el.innerHTML = `
    <div class="cr-hero-head">
      <h1 class="cr-hero-title">
        I miei video ${userTag}
      </h1>
    </div>
    <p class="cr-hero-sub">
      Ciao <strong>${escapeHtml(NM.user.username)}</strong>, qui puoi caricare nuovi video,
      modificare quelli esistenti e moderare i commenti dei tuoi spettatori.
    </p>
    <div class="cr-stats">
      <div class="cr-stat">
        <div class="cr-stat-val">${formatInt(stats.videos)}</div>
        <div class="cr-stat-lab">Video pubblicati</div>
      </div>
      <div class="cr-stat">
        <div class="cr-stat-val">${formatInt(stats.views)}</div>
        <div class="cr-stat-lab">Visualizzazioni totali</div>
      </div>
      <div class="cr-stat">
        <div class="cr-stat-val">${formatInt(stats.likes)}</div>
        <div class="cr-stat-lab">"Utile" ricevuti</div>
      </div>
      <div class="cr-stat">
        <div class="cr-stat-val">${formatInt(stats.comments)}</div>
        <div class="cr-stat-lab">Commenti totali</div>
      </div>
    </div>
  `;
}
function renderCrListSkeleton() {
  const el = document.getElementById("crList");
  if (!el) return;
  el.innerHTML = Array(5)
    .fill(0)
    .map(
      () => `
    <div class="cr-trow">
      <div class="cr-tc cr-tc-video">
        <div class="cr-trow-thumb cr-sk"></div>
        <div style="flex:1;min-width:0">
          <div class="cr-sk" style="width:72%;height:14px;display:block;margin-bottom:7px">.</div>
          <div class="cr-sk" style="width:40%;height:11px;display:block">.</div>
        </div>
      </div>
      <div class="cr-tc"><span class="cr-sk" style="width:64px;height:14px;display:inline-block">.</span></div>
      <div class="cr-tc"><span class="cr-sk" style="width:72px;height:14px;display:inline-block">.</span></div>
      <div class="cr-tc cr-tc-num"><span class="cr-sk" style="width:40px;height:14px;display:inline-block">.</span></div>
      <div class="cr-tc cr-tc-num"><span class="cr-sk" style="width:40px;height:14px;display:inline-block">.</span></div>
      <div class="cr-tc cr-tc-act"><span class="cr-sk" style="width:170px;height:30px;display:inline-block">.</span></div>
    </div>
  `
    )
    .join("");
}

// Errore lista: empty state con bottone (implicito) + pulizia paginazione.
function renderCrListError(msg) {
  const el = document.getElementById("crList");
  if (!el) return;
  el.innerHTML = `
    <div class="cr-empty">
      <div class="cr-empty-ico">${(window.NMUI && NMUI.illust("warning", { variant: "warn" })) || "!"}</div>
      <div class="cr-empty-t">Errore</div>
      <div class="cr-empty-s">${escapeHtml(msg || "Riprova più tardi")}</div>
    </div>`;
  document.getElementById("crPag").innerHTML = "";
}
function renderCrError(msg) {
  renderCrListError(msg);
  const hero = document.getElementById("crHero");
  if (hero) hero.innerHTML = "";
}

// Stato "utente non verificato": messaggio esplicativo.
function renderCrAccessDenied() {
  const main = document.querySelector(".cr-wrap");
  if (!main) return;
  main.innerHTML = `
    <div class="cr-empty" style="padding:80px 20px">
      <div class="cr-empty-ico">*</div>
      <div class="cr-empty-t">Solo per utenti verificati</div>
      <div class="cr-empty-s" style="max-width:520px;margin:8px auto 0">
        Questa sezione è dedicata ai creator <span class="verified-tick"></span> verificati.
        Se sei un professionista (medico, ricercatore, docente) e vuoi pubblicare contenuti
        su NETMED, contatta gli amministratori per la verifica del tuo profilo.
      </div>
      <div style="margin-top:18px">
        <button class="cr-btn" onclick="goTo('home.html')">Torna alla home</button>
      </div>
    </div>
  `;
}

// Stato "admin": non puo' caricare video propri, si rimanda al pannello.
function renderCrAdminBlocked() {
  const main = document.querySelector(".cr-wrap");
  if (!main) return;
  main.innerHTML = `
    <div class="cr-empty" style="padding:80px 20px">
      <div class="cr-empty-ico"></div>
      <div class="cr-empty-t">Sezione non disponibile per gli amministratori</div>
      <div class="cr-empty-s" style="max-width:560px;margin:8px auto 0">
        Gli amministratori non possono caricare o gestire video propri:
        il loro ruolo è di moderazione. Per intervenire sui contenuti
        della piattaforma usa il <strong>pannello di amministrazione</strong>.
      </div>
      <div style="margin-top:18px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="cr-btn" onclick="goTo('admin_dashboard.html')">Vai al pannello admin</button>
        <button class="cr-btn cr-btn-ghost" onclick="goTo('home.html')">Vai alla home</button>
      </div>
    </div>
  `;
}

// Render della tabella dei miei video (o empty state se non ce ne sono).
function renderCrList() {
  const el = document.getElementById("crList");
  if (!el) return;

  if (!CR.videos.length) {
    el.innerHTML = `
      <div class="cr-empty">
        <div class="cr-empty-ico">${(window.NMUI && NMUI.illust("clapper")) || ""}</div>
        <div class="cr-empty-t">Nessun video ${CR.search ? "trovato" : "ancora"}</div>
        <div class="cr-empty-s">${
          CR.search
            ? "Prova a cambiare il termine di ricerca."
            : "Carica il tuo primo video con il bottone qui sopra."
        }</div>
      </div>
    `;
    document.getElementById("crPag").innerHTML = "";
    return;
  }

  el.innerHTML =
    `
    <div class="cr-thead" aria-hidden="true">
      <div class="cr-th cr-th-video">Video</div>
      <div class="cr-th">Visibilita</div>
      <div class="cr-th">Data</div>
      <div class="cr-th cr-th-num">Visualizzazioni</div>
      <div class="cr-th cr-th-num">Commenti</div>
      <div class="cr-th cr-th-act">Azioni</div>
    </div>
  ` + CR.videos.map(renderCrRow).join("");
  renderCrPagination();
}

// Riga singola video con azioni (Modera / Modifica / Elimina).
function renderCrRow(v) {
  const thumb =
    v.thumbnail_url ||
    (v.youtube_id
      ? "https://img.youtube.com/vi/" + escapeHtml(v.youtube_id) + "/mqdefault.jpg"
      : "");
  // Badge visibilita': Bloccato (admin) > Privato > Pubblico.
  const vis = v.is_flagged
    ? `<span class="cr-vis cr-vis-flag" title="Bloccato dall'amministrazione">Bloccato</span>`
    : v.is_private
      ? `<span class="cr-vis cr-vis-private">Privato</span>`
      : `<span class="cr-vis cr-vis-public">Pubblico</span>`;
  // Warning sotto il conteggio commenti se ci sono segnalazioni pending.
  const pending =
    v.pending_reports > 0
      ? `<div class="cr-trow-warn" title="Segnalazioni in attesa di moderazione">${v.pending_reports} segnalazion${v.pending_reports === 1 ? "e" : "i"}</div>`
      : "";
  return `
    <div class="cr-trow">
      <div class="cr-tc cr-tc-video">
        <div class="cr-trow-thumb" onclick="goVideo(${v.id})" role="button" tabindex="0"
             onkeydown="if(event.key==='Enter'){goVideo(${v.id})}">
          ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy">` : ""}
        </div>
        <div class="cr-trow-titlewrap">
          <a class="cr-trow-title" onclick="goVideo(${v.id})">${escapeHtml(v.title)}</a>
          <div class="cr-trow-sub">
            ${
              v.category_name
                ? `<span class="cr-trow-cat">${escapeHtml(v.category_name)}</span>`
                : `<span class="cr-trow-cat cr-trow-cat-none">Senza categoria</span>`
            }
          </div>
        </div>
      </div>
      <div class="cr-tc cr-tc-vis" data-lbl="Visibilita">${vis}</div>
      <div class="cr-tc cr-tc-date" data-lbl="Data">${crFormatDate(v.created_at)}</div>
      <div class="cr-tc cr-tc-num" data-lbl="Visualizzazioni"><b>${formatInt(v.view_count)}</b></div>
      <div class="cr-tc cr-tc-num cr-tc-comm" data-lbl="Commenti"><b>${formatInt(v.comment_count)}</b>${pending}</div>
      <div class="cr-tc cr-tc-act">
        <button class="cr-btn cr-btn-sm" onclick="crModerateComments(${v.id})" title="Modera commenti">Modera</button>
        <button class="cr-btn cr-btn-sm" onclick="goTo('creator-upload.html?id=${v.id}')" title="Modifica video">Modifica</button>
        <button class="cr-btn cr-btn-sm cr-btn-danger" onclick="crConfirmDelete(${v.id})" title="Elimina video">Elimina</button>
      </div>
    </div>
  `;
}
function crFormatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function renderCrPagination() {
  const el = document.getElementById("crPag");
  if (!el) return;
  const { page, totalPages } = CR.pagination;
  if (totalPages <= 1) {
    el.innerHTML = "";
    return;
  }

  const btns = [];
  btns.push(
    `<button class="cr-pag-btn" onclick="crGotoPage(${page - 1})" ${page === 1 ? "disabled" : ""}>‹</button>`
  );
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
      btns.push(
        `<button class="cr-pag-btn ${p === page ? "active" : ""}" onclick="crGotoPage(${p})">${p}</button>`
      );
    } else if (p === page - 2 || p === page + 2) {
      btns.push(`<span style="padding:0 6px;color:var(--text3)">…</span>`);
    }
  }
  btns.push(
    `<button class="cr-pag-btn" onclick="crGotoPage(${page + 1})" ${page === totalPages ? "disabled" : ""}>›</button>`
  );
  el.innerHTML = btns.join("");
}

// Cambia pagina + scroll in cima.
function crGotoPage(p) {
  if (p < 1 || p > CR.pagination.totalPages) return;
  CR.pagination.page = p;
  reloadCrVideos();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Ricerca con debounce  sul campo di ricerca dei miei video.
function crOnSearch(v) {
  clearTimeout(CR.searchTimer);
  CR.searchTimer = setTimeout(() => {
    CR.search = v.trim();
    CR.pagination.page = 1;
    reloadCrVideos();
  }, 350);
}

// Categorie per il nav dell'header.
async function loadHeaderCategoriesForCreatorPage() {
  const r = await api("/api/user/categories");
  if (r.ok) NM.categories = r.data || [];
  nmBootstrapHeaderNav(null);
}

// Apre un modale generico. 
function crOpenModal(html, size) {
  const bg = document.getElementById("crModalBg");
  if (!bg) return;
  bg.innerHTML = `<div class="cr-modal ${size || ""}" onclick="event.stopPropagation()">${html}</div>`;
  bg.classList.add("open");
  document.body.style.overflow = "hidden";
}

// Chiude il modal
function crCloseModal(e) {
  if (e && e.target && e.target.id !== "crModalBg") return;
  const bg = document.getElementById("crModalBg");
  if (!bg) return;
  bg.classList.remove("open");
  bg.innerHTML = "";
  document.body.style.overflow = "";
}

function crCloseModalForce() {
  const bg = document.getElementById("crModalBg");
  if (!bg) return;
  bg.classList.remove("open");
  bg.innerHTML = "";
  document.body.style.overflow = "";
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") crCloseModalForce();
});


// Elimina video: modale di conferma + DELETE al backend.
function crConfirmDelete(videoId) {
  const v = CR.videos.find((x) => x.id === videoId);
  if (!v) return;

  crOpenModal(
    `
    <div class="cr-mh">
      <h3>Elimina video</h3>
      <button class="cr-mx" onclick="crCloseModalForce()" aria-label="Chiudi">✕</button>
    </div>
    <div class="cr-mb">
      <p style="margin:0 0 10px">
        Eliminare <b>"${escapeHtml(v.title)}"</b>?
      </p>
      <p style="font-size:13px;color:var(--text3);margin:0">
        L'azione è irreversibile: vengono rimossi tutti i commenti, i voti e le visualizzazioni associate.
      </p>
    </div>
    <div class="cr-mf">
      <button class="cr-btn" onclick="crCloseModalForce()">Annulla</button>
      <button class="cr-btn cr-btn-danger" id="crDelBtn">Elimina</button>
    </div>
  `,
    ""
  );

  document.getElementById("crDelBtn").onclick = async () => {
    const b = document.getElementById("crDelBtn");
    b.disabled = true;
    const r = await api("/api/creator/videos/" + videoId, { method: "DELETE" });
    if (!r.ok) {
      b.disabled = false;
      toast((r.data && r.data.error) || "Errore eliminazione", "err");
      return;
    }
    toast("Video eliminato");
    crCloseModalForce();
    loadCreatorPage();
  };
}

// Stato del modale moderazione commenti.
const CR_MOD = {
  videoId: null,
  comments: [],
  filter: "all",   // "all" | "active" | "deleted" | "reported"
};

// Apre il modale moderazione, fetch commenti, renderizza tabs + lista.
async function crModerateComments(videoId) {
  const v = CR.videos.find((x) => x.id === videoId);
  if (!v) return;
  CR_MOD.videoId = videoId;
  CR_MOD.filter = "all";

  crOpenModal(
    `
    <div class="cr-mh cr-mod-h">
      <div class="cr-mod-h-l">
        <h3>Modera commenti</h3>
        <div class="cr-mod-h-sub">${escapeHtml(v.title || "")}</div>
      </div>
      <button class="cr-mx" onclick="crCloseModalForce()" aria-label="Chiudi">✕</button>
    </div>
    <div class="cr-mod-tabs" id="crModTabs"></div>
    <div class="cr-mb cr-mod-body">
      <div id="crCmList" aria-live="polite">
        <div style="padding:14px">
          <div class="sk-list-item"><span class="sk-circle"></span><div class="sk-lines"><span class="sk-line medium"></span><span class="sk-line short sm"></span></div></div>
          <div class="sk-list-item"><span class="sk-circle"></span><div class="sk-lines"><span class="sk-line medium"></span><span class="sk-line short sm"></span></div></div>
          <div class="sk-list-item"><span class="sk-circle"></span><div class="sk-lines"><span class="sk-line medium"></span><span class="sk-line short sm"></span></div></div>
        </div>
      </div>
    </div>
    <div class="cr-mf cr-mod-foot">
      <span class="cr-mod-hint" id="crModHint"></span>
      <div class="cr-mod-foot-btns">
        <button class="cr-btn cr-btn-danger" id="crModClearBtn" type="button" style="display:none" onclick="crClearReportedComments()"></button>
        <button class="cr-btn" onclick="crCloseModalForce()">Chiudi</button>
      </div>
    </div>
  `,
    "lg"
  );

  const r = await api("/api/creator/videos/" + videoId + "/comments");
  if (!r.ok) {
    const list = document.getElementById("crCmList");
    if (list) {
      list.innerHTML = `<div class="cr-empty"><div class="cr-empty-ico">${(window.NMUI && NMUI.illust("warning", { variant: "warn" })) || "!"}</div>
        <div class="cr-empty-s">${escapeHtml((r.data && r.data.error) || "Errore")}</div></div>`;
    }
    return;
  }
  CR_MOD.comments = r.data.comments || [];
  crRenderModerationTabs();
  crRenderModerationList();
}

// Tab del modale con contatori (Tutti / Attivi / Segnalati / Rimossi) +
// bottone "Elimina commenti da moderare" quando ci sono report attivi.
function crRenderModerationTabs() {
  const tabsBox = document.getElementById("crModTabs");
  if (!tabsBox) return;
  const all = CR_MOD.comments.length;
  const active = CR_MOD.comments.filter((c) => !c.deleted_at).length;
  const deleted = CR_MOD.comments.filter((c) => !!c.deleted_at).length;
  const reported = CR_MOD.comments.filter((c) => (c.reports_count || 0) > 0).length;

  const tab = (key, label, count, extraClass) =>
    `<button class="cr-mod-tab ${CR_MOD.filter === key ? "active" : ""} ${extraClass || ""}"
             type="button" onclick="crSetModerationFilter('${key}')">
       <span>${label}</span>
       <span class="cr-mod-tab-count">${count}</span>
     </button>`;

  tabsBox.innerHTML =
    tab("all", "Tutti", all) +
    tab("active", "Attivi", active) +
    tab("reported", "Segnalati", reported, reported > 0 ? "warn" : "") +
    tab("deleted", "Rimossi", deleted);

  // Bottone "Elimina commenti da moderare".
  const clearBtn = document.getElementById("crModClearBtn");
  if (clearBtn) {
    const toModerate = CR_MOD.comments.filter(
      (c) => (c.reports_count || 0) > 0 && !c.deleted_at
    ).length;
    if (toModerate > 0) {
      clearBtn.style.display = "";
      clearBtn.textContent = "\uD83D\uDDD1 Elimina commenti da moderare (" + toModerate + ")";
    } else {
      clearBtn.style.display = "none";
    }
  }
}

// Cambio filtro attivo.
function crSetModerationFilter(f) {
  CR_MOD.filter = f;
  crRenderModerationTabs();
  crRenderModerationList();
}

// Render della lista commenti in base al filtro attivo.
function crRenderModerationList() {
  const list = document.getElementById("crCmList");
  if (!list) return;
  let filtered = CR_MOD.comments.slice();
  if (CR_MOD.filter === "active") {
    filtered = filtered.filter((c) => !c.deleted_at);
  } else if (CR_MOD.filter === "deleted") {
    filtered = filtered.filter((c) => !!c.deleted_at);
  } else if (CR_MOD.filter === "reported") {
    filtered = filtered.filter((c) => (c.reports_count || 0) > 0);
  }

  if (!filtered.length) {
    const messages = {
      all: ["Nessun commento", "Nessuno ha ancora commentato questo video."],
      active: ["Nessun commento attivo", "Tutti i commenti sono stati rimossi."],
      reported: ["Nessun commento segnalato", "Bravo! La community sta rispettando le regole."],
      deleted: ["Nessun commento rimosso", "Non hai ancora moderato alcun commento."],
    };
    const [t, s] = messages[CR_MOD.filter] || messages.all;
    list.innerHTML = `<div class="cr-empty">
      <div class="cr-empty-ico">${(window.NMUI && NMUI.illust("chat")) || ""}</div>
      <div class="cr-empty-t">${t}</div>
      <div class="cr-empty-s">${s}</div>
    </div>`;
    return;
  }

  list.innerHTML = `
    <div class="cr-cm-list">
      ${filtered.map((c) => crRenderCmItem(c, CR_MOD.videoId)).join("")}
    </div>
  `;
  const hint = document.getElementById("crModHint");
  if (hint)
    hint.textContent = filtered.length === 1
      ? "1 commento visualizzato"
      : filtered.length + " commenti visualizzati";
}

// Card singolo commento nel modale moderazione.
// Include: badge segnalazioni con motivi, badge stato utente (bannato/strike),
// azioni contestuali (nascondi/ripristina/hard-delete/escalate all'admin).
function crRenderCmItem(c, videoId) {
  // Normalizzo i campi: il backend a volte ritorna "user_username" (dal JOIN).
  if (!c.username && c.user_username) c.username = c.user_username;
  if (!c.avatar_url && c.user_avatar) c.avatar_url = c.user_avatar;

  const initial = (c.username || "U").charAt(0).toUpperCase();
  const isDeleted = !!c.deleted_at;
  const reportsCount = c.reports_count || 0;
  const isReported = reportsCount > 0;
  const isBannedUser = c.user_role === "banned";
  const strikes = c.user_strike_count || 0;
  const avatar = c.avatar_url
    ? `<img src="${escapeHtml(c.avatar_url)}" alt="">`
    : escapeHtml(initial);

  let reportsBadge = "";
  if (isReported) {
    const reasons = Array.isArray(c.reports_reasons) ? c.reports_reasons : [];
    const reasonLabels = {
      spam: "spam",
      offensivo: "offensivo",
      inappropriato: "inappropriato",
      fake: "fake",
      molestia: "molestia",
      altro: "altro",
    };
    const reasonsText = reasons.length
      ? reasons.map((r) => reasonLabels[r] || r).join(", ")
      : "vari motivi";
    reportsBadge = `<span class="cr-cm-reports" title="Motivi: ${escapeHtml(reasonsText)}">${reportsCount} segnalazion${reportsCount === 1 ? "e" : "i"} · ${escapeHtml(reasonsText)}</span>`;
  }

  // Badge stato utente: bloccato / N strike.
  let userBadge = "";
  if (isBannedUser) {
    userBadge = `<span class="cr-cm-userban" title="Utente bloccato">bloccato</span>`;
  } else if (strikes > 0) {
    userBadge = `<span class="cr-cm-userstrikes" title="L'utente ha ${strikes} commenti rimossi in totale">${strikes}/3 strike</span>`;
  }

  // Azioni disponibili in base allo stato del commento.
  let actionsHtml = "";
  if (isDeleted) {
    actionsHtml = `<button class="cr-btn cr-btn-sm" onclick="crCmRestore(${videoId}, ${c.id})">Ripristina</button>`;
  } else {
    actionsHtml = `<button class="cr-btn cr-btn-sm" onclick="crCmDelete(${videoId}, ${c.id})">Nascondi</button>`;
    // Warning: se l'utente e' a 2/3 strike, il nascondi lo bannera'.
    if (!isBannedUser && strikes >= 2) {
      actionsHtml += `<span class="cr-cm-warn-ban" title="Rimuovendo questo commento l'utente verra' bloccato automaticamente">l'autore verra' bloccato</span>`;
    }
  }
  actionsHtml += `<button class="cr-btn cr-btn-sm cr-btn-danger" onclick="crCmHardDelete(${videoId}, ${c.id})" title="Rimuove per sempre il commento dal database">Elimina per sempre</button>`;
  if (c.user_role !== "admin") {
    actionsHtml += `<button class="cr-btn cr-btn-sm" onclick="crEscalateUser(${videoId}, ${c.id})" title="Segnala questo utente agli amministratori">Segnala all'admin</button>`;
  }

  return `
    <div class="cr-cm-item ${isDeleted ? "deleted" : ""} ${isReported ? "reported" : ""}" data-cid="${c.id}">
      <div class="cr-cm-avatar">${avatar}</div>
      <div class="cr-cm-body">
        <div class="cr-cm-head">
          <a class="cr-cm-name" onclick="goCreatorPublic('${escapeAttr(c.username || "")}')" style="cursor:pointer">${escapeHtml(c.username || "Utente")}</a>
          ${verifiedTickHTML(c.is_verified)}
          ${userBadge}
          <span class="cr-cm-time">${timeAgo(c.created_at)}</span>
          ${isDeleted ? `<span class="cr-cm-deleted">RIMOSSO</span>` : ""}
        </div>
        ${reportsBadge ? `<div class="cr-cm-reports-row">${reportsBadge}</div>` : ""}
        <div class="cr-cm-text">${escapeHtml(c.content || "")}</div>
        <div class="cr-cm-foot">
          ${actionsHtml}
        </div>
      </div>
    </div>
  `;
}

// Soft-delete di un commento (nascondi). Se aveva segnalazioni, feedback
// contestuale con strike / ban dell'autore.
async function crCmDelete(videoId, cid) {
  if (!cid || cid === "undefined") { toast("ID commento mancante", "err"); return; }
  const ok = await nmConfirm({
    title: "Rimuovere il commento?",
    message:
      "Il commento sarà nascosto agli utenti ma resterà visibile in moderazione e potrai ripristinarlo.",
    okLabel: "Nascondi",
    cancelLabel: "Annulla",
    danger: true,
  });
  if (!ok) return;
  const r = await api(`/api/creator/videos/${videoId}/comments/${cid}`, { method: "DELETE" });
  if (!r.ok) {
    toast((r.data && r.data.error) || "Errore", "err");
    return;
  }
  // Toast contestuale in base a strike / ban.
  if (r.data && r.data.banned) {
    toast("Commento rimosso. L'autore e' stato bloccato automaticamente.", "ok");
  } else if (r.data && r.data.was_reported) {
    toast(`Commento rimosso. Strike: ${r.data.strike_count || 1}/3.`, "ok");
  } else {
    toast("Commento rimosso");
  }
  // Aggiorno il contatore commenti sulla card del video.
  const v = (CR.videos || []).find((x) => x.id === videoId);
  if (v && typeof v.comment_count === "number" && v.comment_count > 0) {
    v.comment_count -= 1;
    if (typeof renderCrList === "function") renderCrList();
  }
}

// Ripristina un commento soft-deleted.
async function crCmRestore(videoId, cid) {
  if (!cid || cid === "undefined") { toast("ID commento mancante", "err"); return; }
  const r = await api(`/api/creator/videos/${videoId}/comments/${cid}/restore`, { method: "PUT" });
  if (!r.ok) {
    toast((r.data && r.data.error) || "Errore", "err");
    return;
  }
  toast("Commento ripristinato");
  crReloadModerationComments(videoId);
}

// Hard delete: rimozione definitiva dal DB (non ripristinabile).
async function crCmHardDelete(videoId, cid) {
  if (!cid || cid === "undefined") { toast("ID commento mancante", "err"); return; }
  const ok = await nmConfirm({
    title: "Eliminare questo commento?",
    message: "Il commento e le risposte verranno rimossi dal sito.",
    okLabel: "Elimina per sempre",
    cancelLabel: "Annulla",
    danger: true,
  });
  if (!ok) return;
  const r = await api("/api/creator/videos/" + videoId + "/comments/" + cid + "/hard", {
    method: "DELETE",
  });
  if (!r.ok) {
    toast((r.data && r.data.error) || "Errore", "err");
    return;
  }
  toast("Commento eliminato", "ok");
  crReloadModerationComments(videoId);
}

// Escalation all'admin: manda una notifica agli amministratori con il commento e lo storico strike dell'autore.
async function crEscalateUser(videoId, cid) {
  const ok = await nmConfirm({
    title: "Segnalare l'utente agli amministratori?",
    message:
      "Gli admin riceveranno una notifica con il commento e lo storico strike dell'utente, e decideranno se sospenderlo.",
    okLabel: "Segnala all'admin",
    cancelLabel: "Annulla",
  });
  if (!ok) return;
  const r = await api("/api/creator/videos/" + videoId + "/comments/" + cid + "/escalate", {
    method: "POST",
  });
  if (!r.ok) {
    toast((r.data && r.data.error) || "Errore", "err");
    return;
  }
  toast("Utente segnalato agli amministratori", "ok");
}

// Bulk soft-delete di tutti i commenti con segnalazioni aperte.
// Pulizia veloce della coda senza applicare strike singoli.
async function crClearReportedComments() {
  const vid = CR_MOD.videoId;
  if (!vid) return;
  const toModerate = CR_MOD.comments.filter(
    (c) => (c.reports_count || 0) > 0 && !c.deleted_at
  ).length;
  if (!toModerate) {
    toast("Nessun commento da moderare", "ok");
    return;
  }
  const ok = await nmConfirm({
    title: "Eliminare i commenti da moderare?",
    message:
      "Tutti i " +
      toModerate +
      " commenti segnalati su questo video saranno nascosti e la coda di moderazione sara' svuotata. Potrai ripristinarli singolarmente dalla scheda Rimossi.",
    okLabel: "Elimina tutti",
    cancelLabel: "Annulla",
    danger: true,
  });
  if (!ok) return;
  const r = await api("/api/creator/videos/" + vid + "/comments/reported", { method: "DELETE" });
  if (!r.ok) {
    toast((r.data && r.data.error) || "Operazione non riuscita", "err");
    return;
  }
  const n = (r.data && r.data.deleted) || 0;
  toast(
    n +
      " comment" +
      (n === 1 ? "o" : "i") +
      " rimoss" +
      (n === 1 ? "o" : "i") +
      " dalla coda di moderazione",
    "ok"
  );
  const v = (CR.videos || []).find((x) => x.id === vid);
  if (v && typeof v.comment_count === "number") {
    v.comment_count = Math.max(0, v.comment_count - n);
    if (typeof renderCrList === "function") renderCrList();
  }
  crReloadModerationComments(vid);
}

function formatInt(n) {
  n = Number(n) || 0;
  return n.toLocaleString("it-IT");
}

// Escape per attributi onclick
function escapeAttr(s) {
  return String(s || "")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Ricarica solo la lista commenti del modale senza chiuderlo.
async function crReloadModerationComments(videoId) {
  if (!videoId) videoId = CR_MOD.videoId;
  if (!videoId) return;
  const r = await api("/api/creator/videos/" + videoId + "/comments");
  if (!r.ok) return;
  CR_MOD.comments = r.data.comments || [];
  crRenderModerationTabs();
  crRenderModerationList();
}