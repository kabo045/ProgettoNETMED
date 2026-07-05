/*

 Struttura del file:
   1)
      - initUserSearch(): aggancia i listener all'input della header
      - runSearch(q):    fetch a /api/user/search + protezione anti risposte fuori ordine (_searchToken)
      - renderSearchResults(data, q): dropdown ricco con video/utenti/ categorie/tag, con escape su tutti i campi user-controlled
   2)
      - clear button
      - ricerche recenti (localStorage nm_recent_searches)
      - skeleton loading immediato
      - match highlight sui titoli
      - keyboard nav tra i risultati (frecce + invio + esc)
*/

// Debounce e protezione anti-race-condition.
let _searchTimer = null;
let _searchToken = 0; // protegge da risposte fuori ordine
const SEARCH_DELAY = 280; // ms 

//  Init listener 
function initUserSearch() {
  const input = document.getElementById("uhSearchInput");
  const box = document.getElementById("uhSearchResults");
  if (!input || !box) return;

  // Input: debounce di 280ms. Un timer per volta: se l'utente ridigita prima della scadenza, cancello e riparto. Se svuota, chiudo box.
  input.addEventListener("input", () => {
    if (_searchTimer) clearTimeout(_searchTimer);
    const q = input.value.trim();
    if (!q) {
      box.classList.remove("open");
      box.innerHTML = "";
      return;
    }
    _searchTimer = setTimeout(() => runSearch(q), SEARCH_DELAY);
  });

  // Focus: se ho testo e risultati in cache nel DOM, riapro il box.
  input.addEventListener("focus", () => {
    if (input.value.trim() && box.innerHTML.trim()) {
      box.classList.add("open");
    }
  });

  // Chiudi al click fuori dal box.
  document.addEventListener("click", (e) => {
    if (!box.contains(e.target) && e.target !== input) {
      box.classList.remove("open");
    }
  });

  // ESC pulisce, Enter naviga alla pagina search con la query corrente.
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      box.classList.remove("open");
      input.blur();
      return;
    }
    if (e.key === "Enter") {
      const q = input.value.trim();
      if (!q) return;
      e.preventDefault();
      box.classList.remove("open");
      // Pagina completa mostra fino a 48 risultati (search.js/ricerca.js),
      // il dropdown mostra solo i primi per gruppo.
      window.location.href = "search.html?q=" + encodeURIComponent(q);
    }
  });

  // Se non c'e' testo, mostro solo la lente. Al click si espande.
  const wrap = input.closest(".uh-search");
  const ico = wrap ? wrap.querySelector(".uh-search-ico") : null;
  if (wrap && ico) {
    const collapse = () => {
      if (!input.value.trim()) {
        wrap.classList.remove("open");
        box.classList.remove("open");
      }
    };
    ico.addEventListener("click", (e) => {
      e.stopPropagation();
      if (wrap.classList.contains("open")) {
        if (input.value.trim()) input.focus();
        else wrap.classList.remove("open");
      } else {
        wrap.classList.add("open");
        setTimeout(() => input.focus(), 80);
      }
    });
    input.addEventListener("blur", () => setTimeout(collapse, 160));
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) collapse();
    });
    if (input.value.trim()) wrap.classList.add("open");
  }
}

// Esegue la fetch e passa i dati al render.
// _searchToken evita le "race" quando l'utente digita veloce: se al ritorno il mio token e' vecchio, scarto silenziosamente perche' c'e' una richiesta piu recente.
async function runSearch(q) {
  const myToken = ++_searchToken;
  const box = document.getElementById("uhSearchResults");
  if (!box) return;

  const res = await api("/api/user/search?q=" + encodeURIComponent(q));
  if (myToken !== _searchToken) return; // arrivo in ritardo, scarto
  if (!res.ok) {
    box.innerHTML = `<div class="usr-empty">Errore: ${escapeHtml(res.data.error || "")}</div>`;
    box.classList.add("open");
    return;
  }

  renderSearchResults(res.data, q);
}

// Costruisce il dropdown a gruppi (video, utenti, categorie, tag).
function renderSearchResults(data, q) {
  const box = document.getElementById("uhSearchResults");
  if (!box) return;

  const videos = data.videos || [];
  const cats = data.categories || [];
  const tags = data.tags || [];
  const users = data.users || [];

  const hasAny = videos.length || cats.length || tags.length || users.length;

  if (!hasAny) {
    box.innerHTML = `
      <div class="usr-empty">
        <div class="usr-empty-ico">${(window.NMUI && NMUI.illust("search", { size: "sm" })) || "Q"}</div>
        <div class="usr-empty-t">Nessun risultato per</div>
        <div class="usr-empty-q">"${escapeHtml(q)}"</div>
      </div>
    `;
    box.classList.add("open");
    return;
  }

  const catGradients = ["#0d7a4d", "#0891b2", "#d97706", "#7c3aed", "#dc2626", "#2563eb"];
  const catColor = (id) => catGradients[(id || 0) % catGradients.length];

  let html = "";
  // Video con miniatura 
  if (videos.length) {
    html += `<div class="usr-group">
      <div class="usr-title">Video <span class="usr-count">${videos.length}</span></div>
      ${videos
        .map((v) => {
          const thumb =
            v.thumbnail_url ||
            (v.youtube_id
              ? `https://i.ytimg.com/vi/${encodeURIComponent(v.youtube_id)}/mqdefault.jpg`
              : "");
          return `
          <div class="usr-item usr-item-video" onclick="goVideo(${v.id})" role="link" tabindex="0"
               onkeydown="if(event.key==='Enter'){goVideo(${v.id})}">
            <div class="usr-thumb">
              ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" onerror="this.style.opacity=0"/>` : ""}
              <div class="usr-thumb-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg></div>
            </div>
            <div class="usr-line">
              <div class="usr-line-1">${escapeHtml(v.title || "")}</div>
              ${
                v.category_name
                  ? `<div class="usr-line-2"><span class="usr-pill">${escapeHtml(v.category_name)}</span></div>`
                  : ""
              }
              ${
                v.author_username || v.uploaded_by_username || v.created_at
                  ? `<div class="usr-line-3">
                     ${
                       v.author_username || v.uploaded_by_username
                         ? `<span class="usr-author">di <strong>${escapeHtml(v.author_username || v.uploaded_by_username)}</strong></span>`
                         : ""
                     }
                     ${(v.author_username || v.uploaded_by_username) && v.created_at ? `<span class="usr-dot" aria-hidden="true">·</span>` : ""}
                     ${v.created_at ? `<span class="usr-date">${typeof timeAgo === "function" ? timeAgo(v.created_at) : ""}</span>` : ""}
                   </div>`
                  : ""
              }
            </div>
          </div>`;
        })
        .join("")}
    </div>`;
  }

  // Utenti / creator con avatar
  // Se verified_profile arriva come stringa JSON la parso qui: il backend a volte ritorna JSONB gia'oggetto, a volte serializzato.
  if (users.length) {
    html += `<div class="usr-group">
      <div class="usr-title">Utenti <span class="usr-count">${users.length}</span></div>
      ${users
        .map((u) => {
          const initial = (u.username || "U").charAt(0).toUpperCase();
          const av = u.avatar_url
            ? `<img src="${escapeHtml(u.avatar_url)}" alt=""/>`
            : escapeHtml(initial);
          const tickHtml =
            typeof verifiedTickHTML === "function"
              ? verifiedTickHTML(u.is_verified, null)
              : u.is_verified
                ? `<span class="verified-tick" aria-label="verificato"></span>`
                : "";
          const vc = u.video_count || 0;
          // Se ho il verified_profile del creator, mostro sotto il nome titolo + qualifica + organizzazione
          let vp = u.verified_profile;
          if (typeof vp === "string") {
            try {
              vp = JSON.parse(vp);
            } catch (_) {
              vp = {};
            }
          }
          vp = vp || {};
          const proParts = [];
          if (vp.title) proParts.push(escapeHtml(vp.title));
          if (vp.qualifica) proParts.push(escapeHtml(vp.qualifica));
          if (vp.organization) proParts.push(escapeHtml(vp.organization));
          const proLine = proParts.length
            ? '<div class="usr-line-pro">' + proParts.join(" · ") + "</div>"
            : "";
          const vcText = vc === 1 ? "1 video" : vc + " video";
          return `
          <div class="usr-item usr-item-user" onclick="goCreatorPublic('${escapeAttr(u.username)}')" role="link" tabindex="0"
               onkeydown="if(event.key==='Enter'){goCreatorPublic('${escapeAttr(u.username)}')}">
            <div class="usr-avatar">${av}</div>
            <div class="usr-line">
              <div class="usr-line-1">${escapeHtml(u.username || "")}${tickHtml}</div>
              ${proLine}
              <div class="usr-line-2">${vcText}</div>
            </div>
          </div>`;
        })
        .join("")}
    </div>`;
  }
  if (cats.length) {
    html += `<div class="usr-group">
      <div class="usr-title">Categorie <span class="usr-count">${cats.length}</span></div>
      ${cats
        .map(
          (c) => `
        <div class="usr-item usr-item-cat" onclick="goCategory(${c.id})" role="link" tabindex="0"
             onkeydown="if(event.key==='Enter'){goCategory(${c.id})}">
          <div class="usr-cat-ico" style="background:${catColor(c.id)}" aria-hidden="true"></div>
          <div class="usr-line">
            <div class="usr-line-1">${escapeHtml(c.name)}</div>
            ${
              typeof c.video_count === "number"
                ? `<div class="usr-line-2">${c.video_count === 1 ? "1 video" : c.video_count + " video"}</div>`
                : ""
            }
          </div>
        </div>
      `
        )
        .join("")}
    </div>`;
  }

  //  Tag con badge conteggio
  if (tags.length) {
    html += `<div class="usr-group">
      <div class="usr-title">Tag <span class="usr-count">${tags.length}</span></div>
      ${tags
        .map((t) => {
          const safeName = escapeAttr(t.name);
          return `
          <div class="usr-item usr-item-tag" onclick="goTo('search.html?tag=' + encodeURIComponent('${safeName}'))" role="link" tabindex="0"
               onkeydown="if(event.key==='Enter'){goTo('search.html?tag=' + encodeURIComponent('${escapeAttr(t.name)}'))}">
            <div class="usr-tag-ico" aria-hidden="true">#</div>
            <div class="usr-line">
              <div class="usr-line-1">${escapeHtml(t.name)}</div>
              <div class="usr-line-2">${t.video_count || 0} video</div>
            </div>
          </div>`;
        })
        .join("")}
    </div>`;
  }

  box.innerHTML = html;
  box.classList.add("open");
}

// Escape per attributi HTML 
function escapeAttr(s) {
  return String(s == null ? "" : s)
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;");
}

function catColor(id) {
  const palette = ["#0a6940", "#0d7a4d", "#1e9659", "#0d8a48", "#08562f", "#0d7a4d"];
  return palette[(parseInt(id, 10) || 0) % palette.length];
}

// Naviga al profilo pubblico del creator. Esportato su window perche'usato negli onclick inline dei .usr-item-user.
function goCreatorPublic(username) {
  if (!username) return;
  window.location.href = "creator-public.html?u=" + encodeURIComponent(username);
}
window.goCreatorPublic = goCreatorPublic;

(function () {
  "use strict";
  // Anti-doppio-init: se il file viene caricato due volte per errore, il flag su window impedisce di attaccare i listener due volte.
  if (window.__nmSearchPremiumInit) return;
  window.__nmSearchPremiumInit = true;

  // Ricerche recenti: lista in localStorage, LIFO, max 6 voci.
  var RECENT_KEY = "nm_recent_searches";
  var RECENT_MAX = 6;

  function readRecent() {
    try {
      var arr = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(arr) ? arr.filter(function (s) { return typeof s === "string" && s.length; }) : [];
    } catch (_) { return []; }
  }
  // Aggiunge in cima, deduplica case-insensitive, tronca a RECENT_MAX.
  function pushRecent(q) {
    if (!q) return;
    q = String(q).trim().slice(0, 80);
    if (!q) return;
    var arr = readRecent().filter(function (x) { return x.toLowerCase() !== q.toLowerCase(); });
    arr.unshift(q);
    arr = arr.slice(0, RECENT_MAX);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(arr)); } catch (_) {}
  }
  function removeRecent(q) {
    var arr = readRecent().filter(function (x) { return x.toLowerCase() !== String(q).toLowerCase(); });
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(arr)); } catch (_) {}
  }
  // Api pubblica per l'onclick del bottone X sulla singola voce.
  window.NMSearch = window.NMSearch || {};
  window.NMSearch.removeRecent = function (q, evt) {
    if (evt) evt.stopPropagation();
    removeRecent(q);
    renderRecent();
    return false;
  };

  //escapeAttr/escapeHtml 
  function escAttr(s) {
    return String(s == null ? "" : s).replace(/'/g, "\\'").replace(/"/g, "&quot;");
  }
  function escHtml(s) {
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c];
    });
  }

  // Mostra la lista delle ricerche recenti, se l'input e' vuoto.
  function renderRecent() {
    var box = document.getElementById("uhSearchResults");
    var input = document.getElementById("uhSearchInput");
    if (!box || !input || input.value.trim()) return;
    var arr = readRecent();
    if (!arr.length) {
      box.innerHTML = "";
      box.classList.remove("open");
      return;
    }
    var items = arr.map(function (q) {
      var safeQ = escAttr(q);
      return (
        '<div class="usr-recent-item" onclick="document.getElementById(\'uhSearchInput\').value=\'' + safeQ + '\';document.getElementById(\'uhSearchInput\').dispatchEvent(new Event(\'input\'));">' +
          '<span class="usr-recent-ico"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>' +
          '<span class="usr-recent-text">' + escHtml(q) + '</span>' +
          '<button type="button" class="usr-recent-del" onclick="NMSearch.removeRecent(\'' + safeQ + '\',event)" aria-label="Rimuovi">&times;</button>' +
        '</div>'
      );
    }).join("");
    box.innerHTML =
      '<div class="usr-group">' +
        '<div class="usr-title">Ricerche recenti <span class="usr-count">' + arr.length + '</span></div>' +
        items +
      '</div>' + renderFooter("");
    box.classList.add("open");
    bindItemsKbdNav();
  }

  // Skeleton "shimmer" mostrato subito dopo il tasto
  function renderLoading() {
    var box = document.getElementById("uhSearchResults");
    if (!box) return;
    var skel = '<div class="usr-skel-row"><div class="usr-skel usr-skel-thumb"></div><div class="usr-skel-lines"><div class="usr-skel usr-skel-line-1"></div><div class="usr-skel usr-skel-line-2"></div></div></div>';
    box.innerHTML = '<div class="usr-loading">' + skel + skel + skel + '</div>';
    box.classList.add("open");
  }

  // Footer del dropdown: link "vedi tutti" + hint della keyboard nav.
  function renderFooter(q) {
    var goSearch = q
      ? "window.location.href='search.html?q=' + encodeURIComponent('" + escAttr(q) + "')"
      : "document.getElementById('uhSearchInput').focus()";
    return (
      '<div class="usr-footer">' +
        (q ? '<span class="usr-footer-cta" onclick="' + goSearch + '">Vedi tutti i risultati per "' + escHtml(q) + '" →</span>' : '<span style="opacity:.6">Scorri con i tasti freccia</span>') +
        '<span class="usr-footer-keys">' +
          '<span class="usr-kbd">↑</span><span class="usr-kbd">↓</span>' +
          '<span class="usr-kbd">↵</span>' +
          '<span class="usr-kbd">esc</span>' +
        '</span>' +
      '</div>'
    );
  }

  // Post-process del DOM appena renderizzato dalla base: applico match highlight sui titoli (wrap dei token trovati in <span class="usr-match">).
  function postProcessResults(q) {
    var box = document.getElementById("uhSearchResults");
    if (!box) return;
    // Considero solo token >=2 char per non colorare "a" o "e" ovunque.
    var tokens = (q || "").trim().toLowerCase().split(/\s+/).filter(function (t) { return t.length >= 2; });
    if (tokens.length) {
      var nodes = box.querySelectorAll(".usr-line-1, .usr-recent-text");
      nodes.forEach(function (n) {
        var html = n.innerHTML;
        tokens.forEach(function (t) {
          var safe = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          // Regex 1: match preceduto da > (chiusura tag) - evita di toccare gli attributi
          var re = new RegExp("(>[^<]*?)(" + safe + ")", "gi");
          html = html.replace(re, function (_, pre, m) { return pre + '<span class="usr-match">' + m + '</span>'; });
          // Regex 2: match all'inizio della stringa (senza > davanti)
          var re2 = new RegExp("^(" + safe + ")", "i");
          html = html.replace(re2, '<span class="usr-match">$1</span>');
        });
        n.innerHTML = html;
      });
    }
    if (!box.querySelector(".usr-footer")) {
      box.insertAdjacentHTML("beforeend", renderFooter(q));
    }
    bindItemsKbdNav();
  }

  // Keyboard nav: indice dell'item attivo, wrapping su su/giu' con il modulo aritmetico per gestire correttamente i valori negativi.
  var _activeIdx = -1;
  function getItems() {
    var box = document.getElementById("uhSearchResults");
    if (!box) return [];
    return Array.prototype.slice.call(box.querySelectorAll(".usr-item, .usr-recent-item"));
  }
  function setActive(idx) {
    var items = getItems();
    if (!items.length) return;
    _activeIdx = ((idx % items.length) + items.length) % items.length;
    items.forEach(function (n, i) { n.classList.toggle("active", i === _activeIdx); });
    var el = items[_activeIdx];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }
  // Reset dell'indice quando il DOM viene ricostruito.
  function bindItemsKbdNav() { _activeIdx = -1; }

  // Setup: inietto clear button + shortcut kbd, aggancio i listener.
  function initPremium() {
    var input = document.getElementById("uhSearchInput");
    var wrap = input && input.closest(".uh-search");
    if (!input || !wrap) return;

    // Bottone X per svuotare l'input velocemente.
    if (!wrap.querySelector(".uh-search-clear")) {
      var clear = document.createElement("button");
      clear.type = "button";
      clear.className = "uh-search-clear";
      clear.setAttribute("aria-label", "Pulisci ricerca");
      clear.innerHTML = "✕";
      clear.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        input.value = "";
        wrap.classList.remove("has-text");
        var box = document.getElementById("uhSearchResults");
        if (box) { box.innerHTML = ""; box.classList.remove("open"); }
        input.focus();
        renderRecent();
      };
      wrap.appendChild(clear);
    }
    if (!wrap.querySelector(".uh-search-shortcut")) {
      var kbd = document.createElement("span");
      kbd.className = "uh-search-shortcut";
      kbd.innerHTML = "<kbd>/</kbd>";
      kbd.setAttribute("aria-hidden", "true");
      wrap.appendChild(kbd);
    }

    // Classe has-text: usata dal CSS per mostrare la X solo se serve.
    input.addEventListener("input", function () {
      wrap.classList.toggle("has-text", !!input.value);
    });

    // Ricerche recenti al focus con input vuoto.
    input.addEventListener("focus", function () {
      if (!input.value.trim()) renderRecent();
    });

    // Keyboard nav dentro il dropdown + salvataggio della query recente.
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(_activeIdx + 1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(_activeIdx - 1);
        return;
      }
      if (e.key === "Enter") {
        var items = getItems();
        // Se c'e' un item selezionato con le frecce, "clicco" quello.
        if (_activeIdx >= 0 && items[_activeIdx]) {
          e.preventDefault();
          if (input.value.trim()) pushRecent(input.value.trim());
          items[_activeIdx].click();
          return;
        }
        // Altrimenti fallback sulla logica del motore base (redirect a search.html?q=...) e salvo comunque la query recente.
        var q = input.value.trim();
        if (q) pushRecent(q);
      }
    });

    // Sync iniziale della classe (in caso di ?q= pre-riempito).
    wrap.classList.toggle("has-text", !!input.value);

    // Skeleton immediato: parte prima della debounced fetch del base. Quando la fetch arriva, renderSearchResults sovrascrive innerHTML e il MutationObserver qui sotto rileva il cambiamento.
    input.addEventListener("input", function () {
      var q = input.value.trim();
      if (q && q.length >= 1) {
        renderLoading();
      } else {
        renderRecent();
      }
    });
    var box = document.getElementById("uhSearchResults");
    if (box && window.MutationObserver) {
      var lastQ = "";
      var obs = new MutationObserver(function () {
        var cur = input.value.trim();
        // Guard: processo solo dopo la base, e una volta per query.
        if (box.classList.contains("open") && box.querySelector(".usr-group") &&
            !box.querySelector(".usr-footer") && cur !== lastQ) {
          lastQ = cur;
          postProcessResults(cur);
        }
      });
      obs.observe(box, { childList: true, subtree: false });
    }
  }

  // Shortcut globale Ctrl/Cmd+K: focus veloce sulla ricerca da  qualsiasi pagina
  document.addEventListener("keydown", function (e) {
    if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
      var input = document.getElementById("uhSearchInput");
      if (input) {
        e.preventDefault();
        var wrap = input.closest(".uh-search");
        if (wrap) wrap.classList.add("open");
        setTimeout(function () { input.focus(); input.select(); }, 50);
      }
    }
  });

  // Auto-init: se il DOM sta ancora caricando aspetto, altrimenti parto subito.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPremium, { once: true });
  } else {
    initPremium();
  }
})();