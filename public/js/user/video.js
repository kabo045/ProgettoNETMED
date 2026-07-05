/*
   - fetch parallele: dettaglio, correlati, commenti
   - render principale: poster + player YouTube, riga canale, azioni
     (vote utile/non utile, salva, condividi, segnala), descrizione
   - moderazione contestuale: banner per video privato/flagged/segnalato,
     azioni admin/owner sui commenti (nascondi / ripristina / elimina)
   - commenti threaded (1 solo livello di risposta) con soft-delete
     lato creator/admin e strike system integrato con /comment/report
   - modali share e report inline nello stesso file

*/
const VD = {
  videoId: null,
  video: null,
  comments: [],
  related: [],
  expandedDesc: false,
  voteLocked: false, // no doppio click
  favLocked: false,
};

//Bootstrap pagina 
async function loadVideoPage() {
  // Estraggo l'id dalla query string
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get("id"), 10);
  if (!id) {
    renderVdNotFound("ID video non valido.");
    return;
  }
  VD.videoId = id;

  // Skeleton subito visibile
  renderVdSkeleton();
  renderRelatedSkeleton();

  // Fetch parallele:dettaglio + correlati + commenti
  const [vRes, relRes, comRes] = await Promise.all([
    api("/api/user/videos/" + id),
    api("/api/user/videos/" + id + "/related"),
    api("/api/user/videos/" + id + "/comments"),
  ]);

  if (!vRes.ok) {
    renderVdNotFound(vRes.data.error || "Video non disponibile");
    return;
  }
  VD.video = vRes.data;
  VD.related = relRes.ok ? relRes.data || [] : [];
  VD.comments = comRes.ok ? comRes.data || [] : [];

  // Aggiorno il <title> della pagina
  document.title = "NETMED";

  renderVdMain();
  renderVdRelated();
  renderVdComments();
}
function renderVdSkeleton() {
  const main = document.getElementById("vdMain");
  if (!main) return;
  main.innerHTML = `
    <div class="vd-loading-player"></div>
    <div class="vd-loading-row w70 sk"></div>
    <div class="vd-loading-row w50 sk"></div>
    <div class="vd-loading-row w90 sk"></div>
  `;
}

function renderRelatedSkeleton() {
  const aside = document.getElementById("vdAside");
  if (!aside) return;
  aside.innerHTML = `
    <h3 class="vd-rel-h">Video correlati</h3>
    <div class="vd-rel-skeleton">
      ${Array.from({ length: 4 })
        .map(
          () => `
        <div class="vd-rel-sk-item">
          <div class="vd-rel-sk-thumb"></div>
          <div class="vd-rel-sk-body">
            <div class="vd-rel-sk-line w90"></div>
            <div class="vd-rel-sk-line w70"></div>
            <div class="vd-rel-sk-line w50"></div>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

// error 404
function renderVdNotFound(msg) {
  const main = document.getElementById("vdMain");
  const aside = document.getElementById("vdAside");
  if (aside) aside.innerHTML = "";
  if (!main) return;
  main.innerHTML = `
    <div class="vd-empty">
      <div class="vd-empty-ico">${(window.NMUI && NMUI.illust("clapper", { variant: "danger" })) || ""}</div>
      <div class="vd-empty-t">${escapeHtml(msg || "Video non disponibile")}</div>
      <div class="vd-empty-d">Potrebbe essere stato rimosso oppure non è più pubblico.</div>
      <button class="vd-empty-btn" onclick="goTo('home.html')">Torna alla home</button>
    </div>
  `;
}

/* Avatar + nome canale + verified tick + numero iscritti, e
 bottone "Iscriviti" / "Iscritto" a destra.
Il bottone Iscriviti compare solo se l'uploader e verificato*/

function renderVdChannelRow(v) {
  if (!v.uploaded_by_username) return "";
  const username = v.uploaded_by_username;
  const usernameAttr = String(username).replace(/'/g, "\\'");
  const verified = !!v.uploaded_by_verified;
  const avatarUrl = v.uploaded_by_avatar || "";
  const initial = (username || "U").charAt(0).toUpperCase();
  const avatarHtml = avatarUrl
    ? `<img src="${escapeHtml(avatarUrl)}" alt="" loading="lazy"/>`
    : `<span aria-hidden="true">${escapeHtml(initial)}</span>`;

  const tick =
    typeof verifiedTickHTML === "function"
      ? verifiedTickHTML(verified, v.uploaded_by_profile)
      : verified
        ? '<span class="verified-tick" aria-label="verificato"></span>'
        : "";

  const followers = v.uploaded_by_followers || 0;
  const subsText = verified
    ? followers === 1
      ? "1 iscritto"
      : formatViews(followers) + " iscritti"
    : "";

  const isLogged = !!NM.user;
  const isOwner = NM.user && v.uploaded_by === NM.user.id;
  const showFollowBtn = verified && !isOwner;
  const isFollowing = !!v.uploaded_by_is_following;

  let followBtn = "";
  if (showFollowBtn) {
    if (!isLogged) {
      followBtn = `<button class="vd-sub-btn" onclick="goLogin()">Iscriviti</button>`;
    } else if (isFollowing) {
      followBtn = `<button class="vd-sub-btn is-on" id="vdFollowBtn"
                     onclick="vdToggleFollow()"
                     aria-pressed="true"
                     title="Sei iscritto — clicca per disiscriverti">
                     <span class="vd-sub-ico" aria-hidden="true">✓</span>
                     <span class="vd-sub-lbl">Iscritto</span>
                   </button>`;
    } else {
      followBtn = `<button class="vd-sub-btn" id="vdFollowBtn"
                     onclick="vdToggleFollow()"
                     aria-pressed="false"
                     title="Iscriviti al canale">
                     <span class="vd-sub-lbl">Iscriviti</span>
                   </button>`;
    }
  }

  return `
    <div class="vd-channel">
      <div class="vd-channel-info" onclick="goCreatorPublic('${escapeHtml(usernameAttr)}')" role="link" tabindex="0"
           onkeydown="if(event.key==='Enter'){goCreatorPublic('${escapeHtml(usernameAttr)}')}">
        <div class="vd-channel-avatar">${avatarHtml}</div>
        <div class="vd-channel-text">
          <div class="vd-channel-name">${escapeHtml(username)}${tick}</div>
          ${subsText ? `<div class="vd-channel-subs" id="vdSubsCount">${subsText}</div>` : ""}
        </div>
      </div>
      <div class="vd-channel-actions">${followBtn}</div>
    </div>
  `;
}

// Toggle iscrizione: chiama POST o DELETE in base allo stato attuale.
async function vdToggleFollow() {
  if (!NM.user) {
    goLogin();
    return;
  }
  if (!VD.video) return;
  const username = VD.video.uploaded_by_username;
  if (!username) return;

  const btn = document.getElementById("vdFollowBtn");
  const wasFollowing = !!VD.video.uploaded_by_is_following;
  const method = wasFollowing ? "DELETE" : "POST";

  if (btn) btn.disabled = true;
  const res = await api("/api/user/creators/" + encodeURIComponent(username) + "/follow", {
    method: method,
  });
  if (btn) btn.disabled = false;

  if (!res.ok) {
    toast(res.data && res.data.error ? res.data.error : "Errore iscrizione", "err");
    return;
  }

  // Aggiorna stato + UI
  VD.video.uploaded_by_is_following = !!res.data.is_following;
  if (typeof res.data.followers === "number") {
    VD.video.uploaded_by_followers = res.data.followers;
  }
  // Re-render solo la riga canale per non perdere lo stato del player
  const main = document.getElementById("vdMain");
  if (main) {
    const oldRow = main.querySelector(".vd-channel");
    if (oldRow) {
      const wrap = document.createElement("div");
      wrap.innerHTML = renderVdChannelRow(VD.video);
      const newRow = wrap.firstElementChild;
      if (newRow) oldRow.replaceWith(newRow);
    }
  }
  toast(
    VD.video.uploaded_by_is_following ? "Iscritto al canale" : "Hai disattivato l'iscrizione",
    "ok"
  );
}
window.vdToggleFollow = vdToggleFollow;
/*
Render principale della pagina: costruisce banner di stato (se serve),
player, titolo, riga canale, azioni, e
descrizione. Chiamato dopo il fetch iniziale e su ogni evento che
tocca lo stato del video (voto/preferito/follow).*/
function renderVdMain() {
  const main = document.getElementById("vdMain");
  if (!main) return;
  const v = VD.video;

  const poster =
    thumbUrl(v) ||
    "https://i.ytimg.com/vi/" + encodeURIComponent(v.youtube_id) + "/maxresdefault.jpg";

  const tagsHtml =
    v.tags && v.tags.length
      ? `<div class="vd-tags">${v.tags
          .map(
            (t) => `
        <span class="vd-tag" onclick="goTo('search.html?tag=' + encodeURIComponent('${escapeHtml(t.name)}'))">#${escapeHtml(t.name)}</span>
      `
          )
          .join("")}</div>`
      : "";

  const isLogged = !!NM.user;
  const myVote = parseInt(v.my_vote, 10) || 0;

  // Banner di stato per video privati o flaggati. Compare solo per:
  let stateBanner = "";
  if (v.viewer_role === "owner" && v.is_private) {
    stateBanner = `
      <div class="vd-state-banner vd-state-private" role="status">
        <div class="vd-state-ico" aria-hidden="true">*</div>
        <div class="vd-state-text">
          <strong>Video privato</strong>
          <span>Solo tu (e gli amministratori) potete vederlo. Modifica le impostazioni da
            <a class="vd-state-link" onclick="goTo('creator-upload.html?id=${v.id}')">I miei video</a>
            per renderlo pubblico.</span>
        </div>
      </div>
    `;
  } else if (v.viewer_role === "admin" && v.is_flagged) {
    stateBanner = `
      <div class="vd-state-banner vd-state-flagged" role="status">
        <div class="vd-state-ico" aria-hidden="true">⚑</div>
        <div class="vd-state-text">
          <strong>Visualizzazione moderazione</strong>
          <span>Questo video è bloccato e non è visibile pubblicamente.</span>
        </div>
        <div class="vd-state-actions">
          <button class="vd-state-btn" onclick="vdAdminUnflag(${v.id})">Sblocca</button>
          <button class="vd-state-btn vd-state-btn-danger" onclick="vdAdminDelete(${v.id})">Elimina</button>
        </div>
      </div>
    `;
  } else if (v.viewer_role === "admin" && v.is_private) {
    stateBanner = `
      <div class="vd-state-banner vd-state-mod" role="status">
        <div class="vd-state-ico" aria-hidden="true">Q</div>
        <div class="vd-state-text">
          <strong>Visualizzazione moderazione</strong>
          <span>Questo video è privato. Sei in vista admin.</span>
        </div>
      </div>
    `;
  }

  // Banner "Video segnalato": appare a creator/admin SOLO se hanno cliccato la notifica relativa
  const reportsCount = v.reports_count || 0;
  const fromNotif = /[?&]from=notif\b/.test(window.location.search || "");
  if (
    fromNotif &&
    (v.viewer_role === "owner" || v.viewer_role === "admin") &&
    reportsCount > 0 &&
    !v.is_flagged
  ) {
    stateBanner += `
      <div class="vd-state-banner vd-state-reported" role="status">
        <div class="vd-state-body">
          <div class="vd-state-h">
            <span class="vd-state-flag" aria-hidden="true"></span>
            <strong>Video segnalato</strong>
            <span class="vd-state-count">${reportsCount}× ${reportsCount === 1 ? "segnalazione" : "segnalazioni"}</span>
            <button class="vd-state-close" type="button" aria-label="Chiudi" onclick="vdHideReportBanner(this)">&times;</button>
          </div>
          <p class="vd-state-msg">${
            v.viewer_role === "owner"
              ? "Un utente ha segnalato il tuo video. Puoi marcarlo come falso allarme oppure rimuoverlo."
              : "Sono arrivate segnalazioni su questo video. Decidi come moderare."
          }</p>
          <div class="vd-state-actions">
            <button class="vd-state-btn" type="button" onclick="vdDismissReports(${v.id})">Falso allarme</button>
            <button class="vd-state-btn vd-state-btn-danger" type="button" onclick="${v.viewer_role === "admin" ? `vdAdminDelete(${v.id})` : `vdOwnerDelete(${v.id})`}">Rimuovi video</button>
          </div>
        </div>
      </div>
    `;
  }

  main.innerHTML = `
    ${stateBanner}

    <div class="vd-player" id="vdPlayer">
      <div class="vd-player-poster" id="vdPoster" style="background-image:url('${escapeHtml(poster)}')" onclick="vdStartPlayback()">
        <div class="vd-player-play">▶</div>
      </div>
    </div>

    <h1 class="vd-title">${escapeHtml(v.title || "")}</h1>

    <div class="vd-cat-row">
      ${
        v.category_name
          ? `<span class="vd-cat-pill" onclick="goCategory(${v.category_id})">${escapeHtml(v.category_name)}</span>`
          : ""
      }
      <div class="vd-meta-line">
        <span class="vd-stats-inline"><strong id="vdViewsTop">${formatViews(v.counts.views)}</strong></span>
        <span class="dot"></span>
        <span>${timeAgo(v.created_at)}</span>
      </div>
    </div>

    <div class="vd-toolbar">
      <div class="vd-toolbar-left">${renderVdChannelRow(v)}</div>
      <div class="vd-toolbar-right vd-actions">
      <!-- "Utile / Non utile" al posto di Like/Dislike: in una piattaforma
           medica ha più senso valutare la qualità informativa del video
           piuttosto che esprimere un gradimento generico. Il backend
           continua a memorizzare i voti come +1 / -1 (campi likes/dislikes
           nel DB), quindi la modifica è solo nella UI.  -->
      <div class="va-vote" role="group" aria-label="Valuta l'utilità di questo video">
        <button class="va-vote-btn vote-up ${myVote === 1 ? "active" : ""}" data-vote="1" onclick="vdVote(1)" ${!isLogged ? "disabled" : ""}
                aria-pressed="${myVote === 1}" aria-label="Utile, ${v.counts.likes} voti"
                title="${isLogged ? "Utile" : "Accedi per votare"}">
          <span class="va-ico" aria-hidden="true">✓</span>
          <span class="va-lbl">Utile</span>
          <span class="va-cnt" id="vdLikesN">${v.counts.likes}</span>
        </button>
        <span class="va-vote-divider" aria-hidden="true"></span>
        <button class="va-vote-btn vote-down ${myVote === -1 ? "active" : ""}" data-vote="-1" onclick="vdVote(-1)" ${!isLogged ? "disabled" : ""}
                aria-pressed="${myVote === -1}" aria-label="Non utile, ${v.counts.dislikes} voti"
                title="${isLogged ? "Non utile" : "Accedi per votare"}">
          <span class="va-ico" aria-hidden="true">!</span>
          <span class="va-lbl">Non utile</span>
          <span class="va-cnt" id="vdDislikesN">${v.counts.dislikes}</span>
        </button>
      </div>

      <button class="va-btn fav ${v.is_favorite ? "active" : ""}" id="vdFavBtn" onclick="vdToggleFav()" ${!isLogged ? "disabled" : ""}
              aria-pressed="${!!v.is_favorite}" aria-label="${v.is_favorite ? "Rimuovi dai salvati" : "Salva tra i preferiti"}"
              title="${isLogged ? "Aggiungi/Rimuovi dai salvati" : "Accedi per salvare"}">
        <span class="va-ico" aria-hidden="true">${v.is_favorite ? "*" : ""}</span>
        <span id="vdFavLabel">${v.is_favorite ? "Salvato" : "Salva"}</span>
      </button>

      <button class="va-btn share" onclick="vdOpenShare()" aria-label="Condividi video">
        <span class="va-ico" aria-hidden="true">↗</span>
        <span>Condividi</span>
      </button>

      <div class="va-spacer"></div>

      <button class="va-btn report" onclick="vdOpenReport()" ${!isLogged ? "disabled" : ""}
              aria-label="${isLogged ? "Segnala video" : "Accedi per segnalare"}"
              title="${isLogged ? "Segnala video" : "Accedi per segnalare"}">
        <span class="va-ico" aria-hidden="true">⚑</span>
        <span>Segnala</span>
      </button>
      </div>
    </div>

    ${
      !isLogged
        ? `
      <div class="vd-login-cta">
        <div class="vd-login-cta-text">
          <strong>Accedi a NETMED</strong> per votare, salvare e commentare i video.
        </div>
        <button class="vd-login-cta-btn" onclick="goLogin()">Accedi</button>
      </div>
    `
        : ""
    }

    <div class="vd-desc" id="vdDesc">
      <div class="vd-desc-meta">
        <span id="vdViewsDesc">${formatViews(v.counts.views)}</span>
        <span class="dot"></span>
        <span class="vd-desc-meta-soft">${timeAgo(v.created_at)}</span>
      </div>
      <div class="vd-desc-text">${escapeHtml(v.description || "Nessuna descrizione disponibile.")}</div>
      <button class="vd-desc-toggle" id="vdDescToggle" onclick="vdToggleDesc()" style="display:none">Mostra di più ▾</button>
      ${tagsHtml}
    </div>
  `;

  // if >4 mostra di più
  setTimeout(() => {
    const desc = document.getElementById("vdDesc");
    const txt = desc && desc.querySelector(".vd-desc-text");
    const toggle = document.getElementById("vdDescToggle");
    if (!desc || !txt || !toggle) return;
    if (txt.scrollHeight > txt.clientHeight + 4) {
      toggle.style.display = "inline-block";
    }
  }, 50);
}
/* Tracking "Continua a guardare": non abbiamo accesso ai secondi
   reali del player YouTube +30s ogni tick finche' la pagina e'
   visibile, durata fissa 10min.
*/
   async function vdStartPlayback() {
  
  const player = document.getElementById("vdPlayer");
  if (!player) {
    console.error("[NETMED] vdPlayer non trovato");
    return;
  }
  if (!VD.video) {
    console.error("[NETMED] VD.video non caricato");
    if (typeof toast === "function") toast("Dati video non disponibili", "err");
    return;
  }
  const ytRaw = String(VD.video.youtube_id || "").trim();
  if (!ytRaw) {
    console.error("[NETMED] youtube_id mancante per il video id=" + VD.videoId);
    if (typeof toast === "function") toast("ID YouTube mancante per questo video", "err");
    return;
  }
  const yt = encodeURIComponent(ytRaw);
  
  player.innerHTML = `
    <iframe
      src="https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&modestbranding=1"
      title="${escapeHtml(VD.video.title || "")}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"></iframe>
  `;

  /* una sola view per (utente, video) per sessione browser. Includo lo
  user id nella chiave cosi' se cambio account nella stessa scheda il nuovo
  utente registra comunque la sua view.*/
  const dedupUserPart = (NM.user && NM.user.id) ? ("u" + NM.user.id) : "guest";
  const dedupKey = "nm_view_" + dedupUserPart + "_" + VD.videoId;
  if (sessionStorage.getItem(dedupKey)) {
    return;
  }
  sessionStorage.setItem(dedupKey, "1");

  // Avvia il tracking "Continua a guardare": stima il tempo a passi di 30s finché l'utente sta sulla pagina. Salva ogni 30s + al unload.
  if (NM.user && !VD._wpTimer) {
    let watched = 5; // si presume abbia visto almeno 5s al click di play
    const estDur = 600; // durata stimata 10 min
    const send = () => {
      api("/api/user/watch-progress", {
        method: "POST",
        body: { video_id: VD.videoId, seconds: watched, duration: estDur },
      });
    };
    send();
    VD._wpTimer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      watched += 30;
      send();
    }, 30000);
    window.addEventListener("pagehide", send, { once: true });
  }

  // Registra la view e aggiorna i contatori
  const res = await api("/api/user/videos/" + VD.videoId + "/view", {
    method: "POST",
  });
  
  if (res.ok && VD.video) {
    if (!VD.video.counts) VD.video.counts = { views: 0, likes: 0, dislikes: 0 };
    // Preferisco il conteggio autoritativo dal server
    const newCount =
      res.data && typeof res.data.views_count === "number"
        ? res.data.views_count
        : (VD.video.counts.views || 0) + 1;
    VD.video.counts.views = newCount;
    const top = document.getElementById("vdViewsTop");
    const desc = document.getElementById("vdViewsDesc");
    if (top) top.textContent = formatViews(newCount);
    if (desc) desc.textContent = formatViews(newCount);
  }
}

//Toggle descrizione lunga
function vdToggleDesc() {
  const desc = document.getElementById("vdDesc");
  const toggle = document.getElementById("vdDescToggle");
  if (!desc) return;
  VD.expandedDesc = !VD.expandedDesc;
  desc.classList.toggle("expanded", VD.expandedDesc);
  if (toggle) toggle.textContent = VD.expandedDesc ? "Mostra meno ▴" : "Mostra di più ▾";
}

/*Vota "utile" (+1) o "non utile" (-1). Pattern OTTIMISTICO: cambio subito la UI (contatori + bottone attivo)
*/
 async function vdVote(value) {
  if (!NM.user) {
    toast("Devi accedere per votare", "info");
    setTimeout(goLogin, 800);
    return;
  }
  if (VD.voteLocked) return;
  VD.voteLocked = true;

  // Calcolo lo stato target: se clicco sul voto già attivo lo rimuovo.
  const current = parseInt(VD.video.my_vote, 10) || 0;
  const next = current === value ? 0 : value;
  const prevLikes    = VD.video.counts.likes;
  const prevDislikes = VD.video.counts.dislikes;
  const prevVote     = current;

  if (current === 1)  VD.video.counts.likes--;
  if (current === -1) VD.video.counts.dislikes--;
  if (next === 1)     VD.video.counts.likes++;
  if (next === -1)    VD.video.counts.dislikes++;
  VD.video.my_vote = next;

  const $l = document.getElementById("vdLikesN");
  const $d = document.getElementById("vdDislikesN");
  if ($l) $l.textContent = VD.video.counts.likes;
  if ($d) $d.textContent = VD.video.counts.dislikes;
  document.querySelectorAll(".va-vote-btn").forEach((btn) => {
    const v = parseInt(btn.dataset.vote, 10);
    btn.classList.toggle("active", v === next && next !== 0);
  });

  const res = await api("/api/user/videos/" + VD.videoId + "/vote", {
    method: "POST",
    body: { vote: next },
  });
  VD.voteLocked = false;

  if (!res.ok) {
    // Rollback UI
    VD.video.counts.likes = prevLikes;
    VD.video.counts.dislikes = prevDislikes;
    VD.video.my_vote = prevVote;
    if ($l) $l.textContent = prevLikes;
    if ($d) $d.textContent = prevDislikes;
    document.querySelectorAll(".va-vote-btn").forEach((btn) => {
      const v = parseInt(btn.dataset.vote, 10);
      btn.classList.toggle("active", v === prevVote && prevVote !== 0);
    });
    toast(res.data.error || "Voto non riuscito", "err");
    return;
  }

  // Allineo coi dati autoritativi del server
  VD.video.my_vote = res.data.my_vote;
  VD.video.counts.likes = res.data.counts.likes;
  VD.video.counts.dislikes = res.data.counts.dislikes;
  if ($l) $l.textContent = res.data.counts.likes;
  if ($d) $d.textContent = res.data.counts.dislikes;
}

// Toggle preferito
async function vdToggleFav() {
  
  if (!NM.user) {
    toast("Devi accedere per salvare un video", "info");
    setTimeout(goLogin, 800);
    return;
  }
  if (VD.favLocked) return;
  VD.favLocked = true;

  const res = await api("/api/user/videos/" + VD.videoId + "/favorite", {
    method: "POST",
  });
  VD.favLocked = false;
  console.log("[NETMED] vdToggleFav response", { status: res.status, ok: res.ok, data: res.data });

  if (!res.ok) {
    toast(res.data.error || "Operazione fallita (status " + res.status + ")", "err");
    return;
  }

  VD.video.is_favorite = !!res.data.is_favorite;
  const btn = document.getElementById("vdFavBtn");
  const lbl = document.getElementById("vdFavLabel");
  if (btn) btn.classList.toggle("active", VD.video.is_favorite);
  if (lbl) lbl.textContent = VD.video.is_favorite ? "Salvato" : "Salva";
  // L'icona è statica per evitare flash, ma può essere cambiata se desiderato
  toast(VD.video.is_favorite ? "Aggiunto ai salvati" : "Rimosso dai salvati", "ok");

  // Appena salvato: chiedo in quale cartella inserirlo (facoltativo).
  if (VD.video.is_favorite && typeof nmAddToFolder === "function") {
    nmAddToFolder(VD.videoId);
  }
}

//Modale Condividi
function vdOpenShare() {
  const m = document.getElementById("vdShareModal");
  if (!m) return;
  const url = window.location.href;
  const input = document.getElementById("vdShareInput");
  if (input) input.value = url;
  m.classList.add("open");
}

function vdCloseShare() {
  const m = document.getElementById("vdShareModal");
  if (m) m.classList.remove("open");
}

async function vdCopyShare() {
  const input = document.getElementById("vdShareInput");
  if (!input) return;
  try {
    await navigator.clipboard.writeText(input.value);
    toast("Link copiato negli appunti", "ok");
  } catch (e) {
    // Fallback select+execCommand
    input.select();
    try {
      document.execCommand("copy");
      toast("Link copiato", "ok");
    } catch (_) {
      toast("Copia il link manualmente", "info");
    }
  }
}

// Modale Segnala
// Hint contestuale 
const VD_REPORT_HELP = {
  spam: "Pubblicita', link esterni a fini commerciali o contenuti ripetuti privi di valore divulgativo.",
  inappropriato:
    "Contenuto inadatto alla divulgazione medica (es. nudita', linguaggio volgare, materiale non clinico).",
  violenza:
    "Scene esplicite di violenza, autolesionismo, o linguaggio offensivo verso categorie protette.",
  copyright:
    "Materiale ripreso da altre fonti senza autorizzazione (lezioni di altri docenti, clip di canali esterni).",
  altro:
    "Usa questo motivo solo se nessuna delle categorie sopra descrive il problema. Specifica nelle note.",
};

function vdOpenReport() {
  if (!NM.user) return goLogin();
  const m = document.getElementById("vdReportModal");
  if (!m) return;
  const sel = document.getElementById("vdReportReason");
  const txt = document.getElementById("vdReportComment");
  if (sel) sel.value = "spam";
  if (txt) txt.value = "";
  vdUpdateReportReasonHelp();
  vdUpdateReportCharCount();
  const btn = document.getElementById("vdReportSubmitBtn");
  if (btn) {
    btn.disabled = false;
    btn.textContent = "Invia segnalazione";
  }
  m.classList.add("open");
}

function vdCloseReport() {
  const m = document.getElementById("vdReportModal");
  if (m) m.classList.remove("open");
}

function vdUpdateReportReasonHelp() {
  const sel = document.getElementById("vdReportReason");
  const hint = document.getElementById("vdReportReasonHelp");
  if (!sel || !hint) return;
  hint.textContent = VD_REPORT_HELP[sel.value] || "";
}
window.vdUpdateReportReasonHelp = vdUpdateReportReasonHelp;

function vdUpdateReportCharCount() {
  const txt = document.getElementById("vdReportComment");
  const cnt = document.getElementById("vdReportCharCount");
  if (!txt || !cnt) return;
  cnt.textContent = String(txt.value.length);
}
window.vdUpdateReportCharCount = vdUpdateReportCharCount;

async function vdSubmitReport() {
  const sel = document.getElementById("vdReportReason");
  const txt = document.getElementById("vdReportComment");
  const btn = document.getElementById("vdReportSubmitBtn");
  const reason = sel ? sel.value : "";
  const comment = txt ? txt.value.trim() : "";

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Invio in corso...";
  }

  const res = await api("/api/user/videos/" + VD.videoId + "/report", {
    method: "POST",
    body: { reason, comment },
  });

  if (!res.ok) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Invia segnalazione";
    }
    // Se l'utente ha gia' segnalato, e' meglio dirglielo chiaramente.
    const err = (res.data && res.data.error) || "";
    if (/gia.*segnalat|already/i.test(err)) {
      toast("Hai gia' segnalato questo video. Il moderatore sta gia' valutando.", "info");
      vdCloseReport();
    } else {
      toast(err || "Segnalazione non riuscita", "err");
    }
    return;
  }

  // Sostituisco il corpo della modale con un messaggio di conferma chiaro
  const body = document.querySelector("#vdReportModal .vd-modal-body");
  const foot = document.querySelector("#vdReportModal .vd-modal-foot");
  if (body) {
    body.innerHTML =
      '<div class="vd-report-ok">' +
      '<div class="vd-report-ok-ico" aria-hidden="true">OK</div>' +
      "<h3>Segnalazione inviata</h3>" +
      "<p>Grazie. Un moderatore valutera" +
      "'" +
      " la segnalazione entro 24-48 ore. Riceverai una notifica con l" +
      "'" +
      "esito.</p>" +
      '<p class="vd-report-ok-meta">Puoi controllare lo stato delle tue segnalazioni dalla pagina Profilo &rarr; Le mie segnalazioni.</p>' +
      "</div>";
  }
  if (foot) {
    foot.innerHTML =
      '<button class="vd-modal-btn primary" onclick="vdCloseReport()">Chiudi</button>';
  }
  toast("Segnalazione inviata. Grazie.", "ok");
}

//  Azioni del banner "Video segnalato"
function vdHideReportBanner(btn) {
  const banner = btn && btn.closest(".vd-state-banner");
  if (banner) banner.remove();
}
window.vdHideReportBanner = vdHideReportBanner;

// creator marca le segnalazioni come dismiss.
async function vdDismissReports(videoId) {
  const ok = await nmConfirm({
    title: "Marcare come falso allarme?",
    message: "Le segnalazioni aperte su questo video verranno archiviate.",
    okLabel: "Si, archivia",
    cancelLabel: "Annulla",
  });
  if (!ok) return;
  const r = await api("/api/user/videos/" + videoId + "/reports/dismiss", { method: "POST" });
  if (!r.ok) {
    toast((r.data && r.data.error) || "Operazione non riuscita", "err");
    return;
  }
  toast("Segnalazioni archiviate.", "ok");
  document.querySelectorAll(".vd-state-reported").forEach((n) => n.remove());
}
window.vdDismissReports = vdDismissReports;

// Owner rimuove il proprio video.
async function vdOwnerDelete(videoId) {
  const ok = await nmConfirm({
    title: "Rimuovere il video?",
    message: "Il video verra' eliminato dalla piattaforma. Questa azione e' irreversibile.",
    okLabel: "Rimuovi video",
    cancelLabel: "Annulla",
    danger: true,
  });
  if (!ok) return;
  const r = await api("/api/creator/videos/" + videoId, { method: "DELETE" });
  if (!r.ok) {
    toast((r.data && r.data.error) || "Eliminazione non riuscita", "err");
    return;
  }
  toast("Video rimosso.", "ok");
  setTimeout(() => goTo("creator.html"), 700);
}
window.vdOwnerDelete = vdOwnerDelete;

// Admin rimuove un video d'autorita'.
async function vdAdminDelete(videoId) {
  const ok = await nmConfirm({
    title: "Rimuovere il video?",
    message: "Il video verra' eliminato dalla piattaforma. L'autore ricevera' una notifica.",
    okLabel: "Rimuovi video",
    cancelLabel: "Annulla",
    danger: true,
  });
  if (!ok) return;
  const r = await api("/api/admin/videos/" + videoId, { method: "DELETE" });
  if (!r.ok) {
    toast((r.data && r.data.error) || "Eliminazione non riuscita", "err");
    return;
  }
  toast("Video rimosso.", "ok");
  setTimeout(() => goTo("admin_dashboard.html"), 700);
}
window.vdAdminDelete = vdAdminDelete;

//Sezione commenti
function renderVdComments() {
  const box = document.getElementById("vdComments");
  if (!box) return;
  const isLogged = !!NM.user;
  const myInitial = isLogged ? (NM.user.username || "U").charAt(0).toUpperCase() : "?";
  const myAvHtml =
    isLogged && NM.user.avatar_url
      ? `<img src="${NM.user.avatar_url}" alt="" class="vd-comm-avatar-img"/ loading="lazy">`
      : escapeHtml(myInitial);

  let html = `
    <div class="vd-comm-h">
      <h2>Commenti</h2>
      <span class="vd-comm-h-count" id="vdCommCount">${VD.comments.length}</span>
    </div>
  `;
  if (isLogged) {
    html += `
      <div class="vd-comm-form">
        <div class="vd-comm-form-avatar">${myAvHtml}</div>
        <div class="vd-comm-form-body">
          <textarea
            id="vdCommInput"
            class="vd-comm-textarea"
            placeholder="Aggiungi un commento…"
            maxlength="2000"
            oninput="vdCommGrow(this); vdCommToggleSend()"></textarea>
          <div class="vd-comm-form-actions" id="vdCommActions" style="display:none">
            <button class="vd-comm-cancel" onclick="vdCommCancel()">Annulla</button>
            <button class="vd-comm-submit" id="vdCommSubmit" onclick="vdCommSubmit()" disabled>Commenta</button>
          </div>
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="vd-comm-login">
        <span class="vd-comm-login-text">Accedi per lasciare un commento.</span>
        <button class="vd-comm-login-btn" onclick="goLogin()">Accedi</button>
      </div>
    `;
  }

  if (!VD.comments.length) {
    html += `<div class="vd-comm-empty">Nessun commento. Inizia tu la conversazione!</div>`;
  } else {
    const grouped = vdGroupComments(VD.comments);
    html += `<div class="vd-comm-list" id="vdCommList">${grouped.tops
      .map((c) => renderCommentTree(c, grouped.repliesByParent[c.id] || []))
      .join("")}</div>`;
  }

  box.innerHTML = html;

  // Mostra/nasconde gli action quando l'utente clicca/scrive
  const input = document.getElementById("vdCommInput");
  if (input) {
    input.addEventListener("focus", () => {
      const a = document.getElementById("vdCommActions");
      if (a) a.style.display = "flex";
    });
  }
}

// Raggruppa i commenti flat in {tops, repliesByParent}
function vdGroupComments(list) {
  const tops = [];
  const repliesByParent = {};
  for (const c of list) {
    if (c.parent_id) {
      (repliesByParent[c.parent_id] = repliesByParent[c.parent_id] || []).push(c);
    } else {
      tops.push(c);
    }
  }
  // Ordino le risposte cronologicamente
  Object.values(repliesByParent).forEach((arr) => {
    arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  });
  return { tops, repliesByParent };
}
// Renderizza un commento
function renderCommentTree(c, replies) {
  const repliesHtml =
    replies && replies.length
      ? `<div class="vd-comm-replies">${replies.map((r) => renderCommentItem(r, { isReply: true })).join("")}</div>`
      : "";
  return renderCommentItem(c, { isReply: false }) + repliesHtml;
}

// Renderizza un singolo commento (o una risposta).
// Calcolo i permessi in base al viewer:
//   - isMine        = ho scritto io il commento
//   - isVideoOwner  = sono il creator del video (posso moderare)
//   - isAdmin       = admin di piattaforma (puo' fare tutto)
//   - isLogged      = utente guest o loggato
// I bottoni Elimina/Modera/Segnala/Ripristina appaiono in base a
// queste combinazioni. I badge (creator, admin, rimosso, strike,
// segnalazioni) sono visibili solo ai moderatori
function renderCommentItem(c, opts) {
  opts = opts || {};
  // Normalizzo i campi: il backend ritorna "user_username"/"user_avatar"/"user_verified"
  if (!c.username && c.user_username) c.username = c.user_username;
  if (!c.avatar_url && c.user_avatar) c.avatar_url = c.user_avatar;
  if (c.is_verified == null && c.user_verified != null) c.is_verified = c.user_verified;

  const initial = (c.username || "U").charAt(0).toUpperCase();
  const isMine = NM.user && c.user_id === NM.user.id;
  const isAdmin = NM.user && NM.user.role === "admin";
  const isLogged = !!NM.user;
  // Sono il proprietario del video allora posso moderare i commenti direttamente dalla pagina del video senza dover andare nel pannello.
  const isVideoOwner = NM.user && VD.video && VD.video.uploaded_by === NM.user.id;
  const isDeleted = !!c.deleted_at;

  const avatarHtml = c.avatar_url
    ? `<img src="${c.avatar_url}" alt="" class="vd-comm-avatar-img"/ loading="lazy">`
    : escapeHtml(initial);
  // Conteggio segnalazioni visibile solo per creator/admin
  const _reportsCount = c.reports_count || 0;
  const _canSeeReports = isVideoOwner || isAdmin;
  const _hasReportsVisible = _canSeeReports && _reportsCount > 0;
  const itemClass =
    "vd-comm-item" +
    (opts.isReply ? " vd-comm-reply" : "") +
    (isDeleted ? " vd-comm-deleted" : "") +
    (_hasReportsVisible ? " has-reports" : "");
  const replyTargetId = opts.isReply ? c.parent_id || c.id : c.id;

  const authorTag = isMine
    ? `<span class="vd-comm-mod-tag vd-comm-tag-mine" title="Hai scritto tu questo commento">tu</span>`
    : "";
  const creatorViewTag =
    isVideoOwner && !isMine && !isAdmin
      ? `<span class="vd-comm-mod-tag vd-comm-tag-creator" title="Sei il creator di questo video">${NMIcons?.get?.("shield") || "⬡"} creator</span>`
      : "";
  const adminTag =
    isAdmin && !isMine
      ? `<span class="vd-comm-mod-tag" title="Sei admin">${NMIcons?.get?.("shield") || "⬡"} admin</span>`
      : "";
  const deletedTag = isDeleted
    ? `<span class="vd-comm-mod-tag vd-comm-tag-deleted" title="Commento rimosso">rimosso</span>`
    : "";

  // Badge segnalazioni: visibile SOLO al creator/admin (gli altri non sanno se un commento e' stato segnalato).
  const reportsCount = c.reports_count || 0;
  const reportsReasons = Array.isArray(c.reports_reasons) ? c.reports_reasons : [];
  const canSeeReports = isVideoOwner || isAdmin;
  const reportsBadge =
    canSeeReports && reportsCount > 0
      ? `<span class="vd-comm-mod-tag vd-comm-tag-reported ${reportsCount >= 3 ? "warn" : ""}"
             title="Motivi: ${escapeHtml(reportsReasons.join(", ") || "vari")}">
         ${reportsCount}${reportsCount >= 3 ? " · DA MODERARE" : ""}
       </span>`
      : "";

  // Badge strike per il creator: mostra strike dell'autore del commento
  const authorStrikes = c.user_strike_count || 0;
  const strikesBadge =
    canSeeReports && authorStrikes > 0 && !isMine
      ? `<span class="vd-comm-mod-tag vd-comm-tag-strikes" title="L'autore ha ${authorStrikes}/3 strike">${authorStrikes}/3</span>`
      : "";
  const canDelete = !isDeleted && (isMine || isAdmin || isVideoOwner);
  const canRestore = isDeleted && (isAdmin || isVideoOwner);
  // Puo' segnalare: chiunque sia loggato, non sia l'autore del commento,
  const canReport = isLogged && !isDeleted && !isMine && !isVideoOwner && !isAdmin;
  let actionsHtml = "";
  if (isLogged && !isDeleted) {
    actionsHtml += `<button class="vd-comm-action" onclick="vdCommReplyToggle(${replyTargetId}, '${escapeHtml(c.username || "")}')">↩ Rispondi</button>`;
  }
  if (canReport) {
    actionsHtml += `
      <button class="vd-comm-action report" onclick="vdCommReport(${c.id})" title="Segnala questo commento al creator del video">
        Segnala
      </button>`;
  }
  if (canDelete) {
    const label = isMine ? "Elimina" : isVideoOwner ? "Modera" : "Modera (admin)";
    actionsHtml += `
      <button class="vd-comm-action delete" onclick="vdCommDelete(${c.id})" title="Rimuovi il commento dal video">
        ${label}
      </button>`;
  }
  if (canRestore) {
    actionsHtml += `
      <button class="vd-comm-action restore" onclick="vdCommRestore(${c.id})" title="Ripristina il commento">
        ↺ Ripristina
      </button>`;
  }
  const textHtml = isDeleted
    ? canRestore
      ? `<div class="vd-comm-text deleted"><em>(rimosso)</em> <span class="vd-comm-text-removed">${escapeHtml(c.content || "")}</span></div>`
      : `<div class="vd-comm-text deleted"><em>Commento rimosso</em></div>`
    : `<div class="vd-comm-text">${escapeHtml(c.content || "")}</div>`;

  return `
    <div class="${itemClass}" data-cid="${c.id}" id="comment-${c.id}">
      <div class="vd-comm-avatar">${avatarHtml}</div>
      <div class="vd-comm-body">
        <div class="vd-comm-head">
          <a class="vd-comm-name" onclick="goCreatorPublic('${escapeHtml(c.username || "")}')"
             role="button" tabindex="0"
             onkeydown="if(event.key==='Enter'){goCreatorPublic('${escapeHtml(c.username || "")}')}"
             style="cursor:pointer;text-decoration:none">${escapeHtml(c.username || "Utente")}</a>
          ${verifiedTickHTML(c.user_is_verified)}
          ${authorTag}
          ${creatorViewTag}
          ${adminTag}
          ${deletedTag}
          ${strikesBadge}
          <span class="vd-comm-time">${timeAgo(c.created_at)}</span>
        </div>
        ${reportsBadge ? `<div class="vd-comm-reports-row">${reportsBadge}</div>` : ""}
        ${textHtml}
        <div class="vd-comm-foot">
          ${actionsHtml}
        </div>
        <div class="vd-comm-reply-form" id="replyForm-${c.id}" hidden>
          <textarea class="vd-comm-textarea" id="replyInput-${c.id}"
                    maxlength="2000" placeholder="Scrivi una risposta…"
                    oninput="vdCommGrow(this)"></textarea>
          <div class="vd-comm-form-actions" style="display:flex">
            <button class="vd-comm-cancel" onclick="vdCommReplyToggle(${c.id}, null, true)">Annulla</button>
            <button class="vd-comm-submit" onclick="vdCommReplySubmit(${replyTargetId})">Rispondi</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function vdCommReplyToggle(cid, mention, forceClose) {
  const form = document.getElementById(`replyForm-${cid}`);
  if (!form) return;
  if (forceClose || !form.hidden) {
    form.hidden = true;
    return;
  }
  // Chiudi tutti gli altri reply form aperti
  document.querySelectorAll(".vd-comm-reply-form").forEach((f) => {
    if (f !== form) f.hidden = true;
  });
  form.hidden = false;
  const input = document.getElementById(`replyInput-${cid}`);
  if (input) {
    if (mention && !input.value) input.value = `@${mention} `;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

async function vdCommReplySubmit(parentId) {
  if (!NM.user) {
    toast("Devi accedere per rispondere", "info");
    setTimeout(goLogin, 800);
    return;
  }
  const input = document.getElementById(`replyInput-${parentId}`);
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;

  const res = await api("/api/user/videos/" + VD.videoId + "/comments", {
    method: "POST",
    body: { content, parent_id: parentId },
  });
  if (!res.ok) {
    toast(res.data.error || "Errore invio risposta", "err");
    return;
  }
  VD.comments.push(res.data);
  const count = document.getElementById("vdCommCount");
  if (count) count.textContent = VD.comments.length;
  renderVdComments();
  toast("Risposta pubblicata", "ok");
}

function vdCommGrow(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 240) + "px";
}

function vdCommToggleSend() {
  const input = document.getElementById("vdCommInput");
  const btn = document.getElementById("vdCommSubmit");
  if (!input || !btn) return;
  btn.disabled = input.value.trim().length === 0;
}

function vdCommCancel() {
  const input = document.getElementById("vdCommInput");
  const a = document.getElementById("vdCommActions");
  if (input) {
    input.value = "";
    input.style.height = "auto";
  }
  if (a) a.style.display = "none";
  vdCommToggleSend();
}

async function vdCommSubmit() {
  console.log("[NETMED] vdCommSubmit", { user: NM.user && NM.user.username, videoId: VD.videoId });
  if (!NM.user) {
    toast("Devi accedere per commentare", "info");
    setTimeout(goLogin, 800);
    return;
  }
  const input = document.getElementById("vdCommInput");
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;

  const btn = document.getElementById("vdCommSubmit");
  if (btn) btn.disabled = true;

  const res = await api("/api/user/videos/" + VD.videoId + "/comments", {
    method: "POST",
    body: { content },
  });
  if (btn) btn.disabled = false;
  console.log("[NETMED] vdCommSubmit response", { status: res.status, ok: res.ok, data: res.data });

  if (!res.ok) {
    toast(res.data.error || "Errore invio commento (status " + res.status + ")", "err");
    return;
  }
  const newComment = (res.data && res.data.comment) ? res.data.comment : res.data;
  if (!newComment.user_username && NM.user) {
    newComment.user_username = NM.user.username;
    newComment.user_avatar = NM.user.avatar_url || null;
    newComment.user_id = NM.user.id;
    newComment.user_verified = !!NM.user.is_verified;
  }

  // Aggiungo in testa, aggiorno conteggio, pulisco form
  VD.comments.unshift(newComment);
  vdCommCancel();
  // Re-render lista (manteniamo il form)
  const count = document.getElementById("vdCommCount");
  if (count) count.textContent = VD.comments.length;

  let listEl = document.getElementById("vdCommList");
  if (!listEl) {
    renderVdComments();
  } else {
    listEl.insertAdjacentHTML("afterbegin", renderCommentItem(newComment));
    // Rimuovo l'eventuale empty state
    const empty = listEl.parentElement && listEl.parentElement.querySelector(".vd-comm-empty");
    if (empty) empty.remove();
  }
  toast("Commento pubblicato", "ok");
}

async function vdCommDelete(cid) {
  const target = VD.comments.find((c) => c.id === cid);
  const isMine = NM.user && target && target.user_id === NM.user.id;
  const isVideoOwner = NM.user && VD.video && VD.video.uploaded_by === NM.user.id;
  const asModeration = !isMine && isVideoOwner;

  const ok = await nmConfirm({
    title: asModeration ? "Moderare il commento?" : "Eliminare il commento?",
    message: asModeration
      ? "In quanto creator del video puoi nascondere questo commento. Potrai ripristinarlo in seguito."
      : "Il commento verra' rimosso dalla pagina del video.",
    okLabel: asModeration ? "Nascondi" : "Elimina",
    cancelLabel: "Annulla",
    danger: true,
  });
  if (!ok) return;

  let res;
  if (asModeration && VD.video) {
    // Soft-delete via endpoint creator (mantiene il commento ripristinabile)
    res = await api(`/api/creator/videos/${VD.video.id}/comments/${cid}`, { method: "DELETE" });
  } else {
    // Self-delete o admin
    res = await api("/api/user/comments/" + cid, { method: "DELETE" });
  }
  if (!res.ok) {
    toast((res.data && res.data.error) || "Operazione non riuscita", "err");
    return;
  }

  if (asModeration) {
    // Soft-delete: il commento deve sparire ovunque, anche per il moderatore. Se vuole ripristinarlo lo fa dal pannello commentidel creator (creator.html).
    VD.comments = VD.comments.filter((c) => c.id !== cid && c.parent_id !== cid);
    toast("Commento nascosto. Puoi ripristinarlo dal pannello commenti.", "ok");
  } else {
    // Hard-delete: rimuovo dal locale (e le risposte)
    VD.comments = VD.comments.filter((c) => c.id !== cid && c.parent_id !== cid);
    toast("Commento eliminato", "ok");
  }
  renderVdComments();
}

// Segnala commento
// Apre un modale con scelta motivo + nota opzionale. 
async function vdCommReport(cid) {
  if (!NM.user) {
    return goLogin();
  }
  const reasonsHtml = [
    { v: "spam", l: "Spam o pubblicità" },
    { v: "offensivo", l: "Linguaggio offensivo / volgare" },
    { v: "inappropriato", l: "Contenuto inappropriato" },
    { v: "fake", l: "Disinformazione / fake news" },
    { v: "molestia", l: "Molestie o attacchi personali" },
    { v: "altro", l: "Altro" },
  ]
    .map(
      (r, i) =>
        `<label class="vd-form-radio">
       <input type="radio" name="vdReportCmReason" value="${r.v}" ${i === 0 ? "checked" : ""}/>
       <span>${r.l}</span>
     </label>`
    )
    .join("");

  document.querySelectorAll(".vd-modal-bg.vd-report-cm").forEach((n) => n.remove());

  const bg = document.createElement("div");
  bg.className = "vd-modal-bg vd-report-cm open";
  bg.innerHTML = `
    <div class="vd-modal" onclick="event.stopPropagation()">
      <div class="vd-modal-h">
        <div class="vd-modal-title">Segnala commento</div>
        <button class="vd-modal-close" type="button" aria-label="Chiudi">×</button>
      </div>
      <div class="vd-modal-body">
        <div class="vd-form-group">
          <label class="vd-form-label">Motivo della segnalazione</label>
          <div class="vd-form-radios">${reasonsHtml}</div>
        </div>
        <div class="vd-form-group">
          <label class="vd-form-label" for="vdReportCmNote">Nota (opzionale)</label>
          <textarea id="vdReportCmNote" class="vd-form-textarea"
                    maxlength="500"
                    placeholder="Aggiungi dettagli che possano aiutare la moderazione…"></textarea>
        </div>
        <div class="vd-form-hint">
          Servono almeno <b>3 segnalazioni distinte</b> sullo stesso commento
          perché il creator del video venga avvisato. Quando il creator decide
          di rimuovere un commento, l'autore riceve uno <b>strike</b>: dopo
          3 strike l'account viene bloccato automaticamente.
        </div>
      </div>
      <div class="vd-modal-foot">
        <button class="vd-modal-btn" type="button" data-action="cancel">Annulla</button>
        <button class="vd-modal-btn danger" type="button" data-action="submit">Invia segnalazione</button>
      </div>
    </div>
  `;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.querySelector(".vd-modal-close").onclick = close;
  bg.querySelector('[data-action="cancel"]').onclick = close;
  bg.addEventListener("click", (e) => {
    if (e.target === bg) close();
  });

  bg.querySelector('[data-action="submit"]').onclick = async () => {
    const reason = bg.querySelector("input[name=vdReportCmReason]:checked").value;
    const note = bg.querySelector("#vdReportCmNote").value.trim();
    const submitBtn = bg.querySelector('[data-action="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Invio…";

    const res = await api(`/api/user/comments/${cid}/report`, {
      method: "POST",
      body: { reason, note },
    });
    if (!res.ok) {
      toast((res.data && res.data.error) || "Segnalazione non inviata", "err");
      submitBtn.disabled = false;
      submitBtn.textContent = "Invia segnalazione";
      return;
    }
    close();
    // Usa il messaggio contestuale dal backend (avvisa se serve raggiungere la soglia, o se il creator e' stato appena avvisato).
    const msg = (res.data && res.data.message) || "Segnalazione inviata";
    const tone = res.data && res.data.creator_notified ? "ok" : "info";
    toast(msg, tone);
  };
}

// Ripristina commento moderato (creator/admin)
async function vdCommRestore(cid) {
  if (!VD.video) return;
  const isVideoOwner = NM.user && VD.video.uploaded_by === NM.user.id;
  if (!isVideoOwner && (!NM.user || NM.user.role !== "admin")) {
    toast("Non puoi ripristinare questo commento", "err");
    return;
  }
  const res = await api("/api/creator/videos/" + VD.video.id + "/comments/" + cid + "/restore", {
    method: "POST",
  });
  if (!res.ok) {
    toast((res.data && res.data.error) || "Ripristino fallito", "err");
    return;
  }
  // Aggiorna in memoria: rimuovo deleted_at
  const c = VD.comments.find(function (x) { return x.id === cid; });
  if (c) c.deleted_at = null;
  renderVdComments();
  toast("Commento ripristinato", "ok");
}
function renderVdRelated() {
  const aside = document.getElementById("vdAside");
  if (!aside) return;
  if (!VD.related || !VD.related.length) {
    aside.innerHTML = '<h3 class="vd-rel-h">Video correlati</h3><div class="vd-rel-empty">Nessun video correlato.</div>';
    return;
  }
  const items = VD.related.map(function (v) {
    const thumb = v.thumbnail_url || (v.youtube_id ? "https://i.ytimg.com/vi/" + v.youtube_id + "/hqdefault.jpg" : "");
    const views = (typeof formatViews === "function") ? formatViews(v.views_count || 0) : String(v.views_count || 0);
    const ago = (typeof formatAgo === "function") ? formatAgo(v.created_at) : "";
    const tick = (v.uploaded_by_verified && typeof verifiedTickHTML === "function")
      ? verifiedTickHTML(true) : "";
    return ''
      + '<a class="vd-rel-item" href="video.html?id=' + v.id + '">'
      +   '<div class="vd-rel-thumb">'
      +     (thumb ? '<img src="' + escapeHtml(thumb) + '" alt="" loading="lazy"/>' : '')
      +   '</div>'
      +   '<div class="vd-rel-body">'
      +     '<div class="vd-rel-title">' + escapeHtml(v.title || "") + '</div>'
      +     '<div class="vd-rel-meta">' + escapeHtml(v.uploaded_by_username || "") + tick + '</div>'
      +     '<div class="vd-rel-meta">' + views + (ago ? ' · ' + ago : '') + '</div>'
      +   '</div>'
      + '</a>';
  }).join("");
  aside.innerHTML = '<h3 class="vd-rel-h">Video correlati</h3><div class="vd-rel-list">' + items + '</div>';
}

// Stub per vdAdminUnflag se non implementato altrove
if (typeof window.vdAdminUnflag !== "function") {
  window.vdAdminUnflag = async function (videoId) {
    if (!NM.user || NM.user.role !== "admin") return;
    if (typeof nmConfirm === "function") {
      const ok = await nmConfirm({ title: "Sbloccare il video?", message: "Verra resa nuovamente pubblica.", okLabel: "Sblocca", cancelLabel: "Annulla" });
      if (!ok) return;
    }
    const res = await api("/api/admin/videos/" + videoId + "/unflag", { method: "POST" });
    if (!res.ok) { toast((res.data && res.data.error) || "Errore", "err"); return; }
    toast("Video sbloccato", "ok");
    setTimeout(function(){ location.reload(); }, 600);
  };
}

// Esporto le funzioni globalmente per gli onclick inline
window.vdVote = vdVote;
window.vdToggleFav = vdToggleFav;
window.vdToggleDesc = vdToggleDesc;
window.vdStartPlayback = vdStartPlayback;
window.vdOpenShare = vdOpenShare;
window.vdCloseShare = vdCloseShare;
window.vdCopyShare = vdCopyShare;
window.vdOpenReport = vdOpenReport;
window.vdCloseReport = vdCloseReport;
window.vdSubmitReport = vdSubmitReport;
window.vdCommSubmit = vdCommSubmit;
window.vdCommCancel = vdCommCancel;
window.vdCommToggleSend = vdCommToggleSend;
window.vdCommDelete = vdCommDelete;
window.vdCommReport = vdCommReport;
window.vdCommRestore = vdCommRestore;
window.vdCommReplyToggle = vdCommReplyToggle;
window.vdCommReplySubmit = vdCommReplySubmit;
