
window.MCApp = (function () {
  "use strict";

  var T = (window.T && typeof window.T === "function") ? window.T : function (k, f) { return f != null ? f : k; };

  // Toast inline. Se il sito ha gia' un toast globale, uso quello.
  function showMsg(msg, type) {
    if (window.toast && typeof window.toast === "function") return window.toast(msg, type);
    var box = document.getElementById("mcInlineToast");
    if (!box) {
      box = document.createElement("div");
      box.id = "mcInlineToast";
      box.style.cssText = "position:fixed;top:80px;right:18px;z-index:99999;display:flex;flex-direction:column;gap:8px";
      document.body.appendChild(box);
    }
    var el = document.createElement("div");
    el.textContent = String(msg);
    el.style.cssText = "background:" + (type === "err" ? "#a02828" : "#0a6940") +
      ";color:#fff;padding:11px 18px;border-radius:10px;font-size:13.5px;font-weight:600;box-shadow:0 8px 20px rgba(0,0,0,.4);transition:all .3s;";
    box.appendChild(el);
    setTimeout(function(){ el.style.opacity = "0"; el.style.transform = "translateX(80px)"; }, 2700);
    setTimeout(function(){ el.remove(); }, 3100);
  }

  // Modal helpers che sostituiscono confirm/prompt nativi.
  // Ritornano una Promise: true/false per conferma, string/null per prompt.
  function mcModalStyleOnce() {
    if (document.getElementById("mcModalStyle")) return;
    var st = document.createElement("style");
    st.id = "mcModalStyle";
    st.textContent =
      ".mc-mod-bg{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;animation:mcModFade .18s ease}" +
      ".mc-mod-card{background:var(--card,#161618);color:var(--text,#f3f3f5);border:1px solid var(--border,#2a2a2e);border-radius:14px;padding:22px 22px 18px;width:100%;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,.5);animation:mcModIn .22s cubic-bezier(.22,.61,.36,1)}" +
      ".mc-mod-title{font-family:'Outfit','Inter',sans-serif;font-size:17px;font-weight:700;margin:0 0 8px}" +
      ".mc-mod-msg{font-size:14px;color:var(--text2,#a8a8ad);line-height:1.5;margin:0 0 16px}" +
      ".mc-mod-input{width:100%;box-sizing:border-box;background:var(--bg,#0a0a0b);color:var(--text,#f3f3f5);border:1px solid var(--border,#2a2a2e);border-radius:8px;padding:10px 12px;font:inherit;font-size:14px;resize:vertical;min-height:90px;margin-bottom:16px}" +
      ".mc-mod-input:focus{outline:0;border-color:var(--accent,#18c373)}" +
      ".mc-mod-row{display:flex;gap:10px;justify-content:flex-end}" +
      ".mc-mod-btn{padding:9px 18px;border-radius:8px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;border:1px solid var(--border,#2a2a2e);background:transparent;color:var(--text,#f3f3f5);transition:background .12s,border-color .12s}" +
      ".mc-mod-btn:hover{background:var(--hover,rgba(255,255,255,.06))}" +
      ".mc-mod-btn.ok{background:var(--accent,#18c373);border-color:transparent;color:#0a0a0b}" +
      ".mc-mod-btn.ok:hover{filter:brightness(1.06)}" +
      ".mc-mod-btn.danger{background:#be123c;border-color:transparent;color:#fff}" +
      ".mc-mod-btn.danger:hover{filter:brightness(1.08)}" +
      "@keyframes mcModFade{from{opacity:0}to{opacity:1}}" +
      "@keyframes mcModIn{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}";
    document.head.appendChild(st);
  }

  // Modale di conferma: due bottoni (Annulla, OK). Escape=annulla, Enter=ok.
  function mcConfirm(opts) {
    mcModalStyleOnce();
    opts = opts || {};
    return new Promise(function (resolve) {
      var bg = document.createElement("div");
      bg.className = "mc-mod-bg";
      bg.innerHTML =
        '<div class="mc-mod-card" role="dialog" aria-modal="true">' +
          '<h3 class="mc-mod-title"></h3>' +
          '<p class="mc-mod-msg"></p>' +
          '<div class="mc-mod-row">' +
            '<button type="button" class="mc-mod-btn" data-act="cancel"></button>' +
            '<button type="button" class="mc-mod-btn ' + (opts.danger ? "danger" : "ok") + '" data-act="ok"></button>' +
          '</div>' +
        '</div>';
      bg.querySelector(".mc-mod-title").textContent = opts.title || "Conferma";
      bg.querySelector(".mc-mod-msg").textContent = opts.message || "Vuoi procedere?";
      var btnCancel = bg.querySelector('[data-act="cancel"]');
      var btnOk = bg.querySelector('[data-act="ok"]');
      btnCancel.textContent = opts.cancelText || "Annulla";
      btnOk.textContent = opts.okText || "Conferma";
      function close(val) {
        document.removeEventListener("keydown", onKey);
        bg.remove();
        resolve(val);
      }
      function onKey(e) {
        if (e.key === "Escape") close(false);
        if (e.key === "Enter") close(true);
      }
      btnCancel.addEventListener("click", function () { close(false); });
      btnOk.addEventListener("click", function () { close(true); });
      bg.addEventListener("click", function (e) { if (e.target === bg) close(false); });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(bg);
      setTimeout(function () { btnOk.focus(); }, 30);
    });
  }

  // Modale di prompt: textarea + bottoni. Escape=annulla, Ctrl+Enter=salva.
  function mcPrompt(opts) {
    mcModalStyleOnce();
    opts = opts || {};
    return new Promise(function (resolve) {
      var bg = document.createElement("div");
      bg.className = "mc-mod-bg";
      bg.innerHTML =
        '<div class="mc-mod-card" role="dialog" aria-modal="true">' +
          '<h3 class="mc-mod-title"></h3>' +
          '<p class="mc-mod-msg"></p>' +
          '<textarea class="mc-mod-input" maxlength="2000"></textarea>' +
          '<div class="mc-mod-row">' +
            '<button type="button" class="mc-mod-btn" data-act="cancel"></button>' +
            '<button type="button" class="mc-mod-btn ok" data-act="ok"></button>' +
          '</div>' +
        '</div>';
      bg.querySelector(".mc-mod-title").textContent = opts.title || "Modifica";
      bg.querySelector(".mc-mod-msg").textContent = opts.message || "";
      var ta = bg.querySelector("textarea");
      ta.value = opts.value != null ? String(opts.value) : "";
      var btnCancel = bg.querySelector('[data-act="cancel"]');
      var btnOk = bg.querySelector('[data-act="ok"]');
      btnCancel.textContent = opts.cancelText || "Annulla";
      btnOk.textContent = opts.okText || "Salva";
      function close(val) {
        document.removeEventListener("keydown", onKey);
        bg.remove();
        resolve(val);
      }
      function onKey(e) {
        if (e.key === "Escape") close(null);
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) close(ta.value);
      }
      btnCancel.addEventListener("click", function () { close(null); });
      btnOk.addEventListener("click", function () { close(ta.value); });
      bg.addEventListener("click", function (e) { if (e.target === bg) close(null); });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(bg);
      setTimeout(function () { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 30);
    });
  }

  // Stato locale della pagina.
  var state = {
    items: [],
    filter: "all",   // "all" | "active" | "deleted"
    q: "",
    videoId: null,
    sort: "recent",  // "recent" | "old"
    user: null,
    token: null,
    dbn: null        // timer id del debounce sulla ricerca
  };

  //  Helpers DOM 
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c];
    });
  }
  function timeAgo(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return "ora";
    if (s < 3600) return Math.floor(s/60) + " min fa";
    if (s < 86400) return Math.floor(s/3600) + " ore fa";
    if (s < 2592000) return Math.floor(s/86400) + " giorni fa";
    return d.toLocaleDateString("it-IT");
  }

  // Legge token+user da localStorage.
  function loadAuth() {
    try {
      state.token = localStorage.getItem("token") || null;
      state.user = JSON.parse(localStorage.getItem("user") || "null");
    } catch (_) {
      state.token = null; state.user = null;
    }
  }

  // Popola avatar / nome / email nell'header 
  function renderHeader() {
    if (state.user) {
      var guest = $("uhGuest");
      var userBox = $("uhUser");
      if (guest) guest.style.display = "none";
      if (userBox) {
        userBox.style.display = "";
        userBox.onclick = function (ev) { ev.stopPropagation(); userBox.classList.toggle("open"); };
      }
      var name = (state.user.username || "U");
      var initial = name.charAt(0).toUpperCase();
      ["uhAvatar","uhDdAvatar"].forEach(function(id){var e=$(id);if(e)e.textContent=initial;});
      ["uhUname","uhDdName"].forEach(function(id){var e=$(id);if(e)e.textContent=name;});
      var em = $("uhDdEmail"); if (em) em.textContent = state.user.email || "—";
      if (state.user.is_verified) { var c=$("uhDdCreator"); if (c) c.style.display=""; }
      if (state.user.role === "admin") { var a=$("uhDdAdmin"); if (a) a.style.display=""; }
    }
    // Click fuori dal dropdown -> chiudo.
    document.addEventListener("click", function () {
      var u = $("uhUser"); if (u) u.classList.remove("open");
    });
  }

  //  Render stati diversi 
  function paint(html) {
    var list = $("mcList"); if (list) list.innerHTML = html;
  }

  function renderNotLogged() {
    paint(
      '<div class="mc-empty">' +
        '<div class="mc-empty-ico">🔐</div>' +
        '<div class="mc-empty-t">Devi accedere per vedere i tuoi commenti</div>' +
        '<div class="mc-empty-s">Effettua l\'accesso al tuo account NETMED.</div>' +
        '<button class="mc-empty-btn" onclick="location.href=\'login.html\'" style="margin-top:18px;background:#0a6940;color:#fff;border:0;padding:11px 26px;border-radius:22px;font-weight:600;cursor:pointer">Accedi</button>' +
      '</div>'
    );
    var stats = $("mcStats"); if (stats) stats.innerHTML = "";
  }

  function renderLoading() {
    paint('<div style="padding:40px;text-align:center;color:#888"><div style="font-size:24px;margin-bottom:10px">⏳</div>Caricamento commenti…</div>');
  }

  // Testo diverso in base al filtro/search attivi.
  function renderEmpty() {
    var msg = state.filter === "deleted" ? "Nessun commento eliminato" :
              state.filter === "active" ? "Nessun commento attivo" :
              state.q ? "Nessun commento trovato per \"" + esc(state.q) + "\"" :
              "Non hai ancora scritto commenti";
    paint(
      '<div class="mc-empty">' +
        '<div class="mc-empty-ico">💬</div>' +
        '<div class="mc-empty-t">' + msg + '</div>' +
        '<div class="mc-empty-s">Quando commenterai un video, lo troverai qui.</div>' +
      '</div>'
    );
  }

  function renderError(msg) {
    paint(
      '<div class="mc-empty mc-error">' +
        '<div class="mc-empty-ico">⚠️</div>' +
        '<div class="mc-empty-t">Errore di caricamento</div>' +
        '<div class="mc-empty-s">' + esc(msg) + '</div>' +
      '</div>'
    );
  }

  // Disegna la lista dei commenti. Per ognuno: avatar iniziale + testo + link al video + azioni (Modifica/Elimina, oppure Rimuovi definitivamente  se gia' eliminato).
  function renderList() {
    var list = $("mcList"); if (!list) return;
    if (!state.items.length) { renderEmpty(); return; }
    var myName = (state.user && state.user.username) || "U";
    var myInitial = myName.charAt(0).toUpperCase();
    var html = state.items.map(function (c) {
      var deleted = !!c.deleted_at;
      // Click sulla card -> vado al video. Ma se clicco su un bottone azione, no (event.target.closest scarta il click).
      var goVid = c.video_id ? "event.target.closest('.mc-card-action')||(location.href='video.html?id=" + c.video_id + "')" : "";
      return (
        '<article class="mc-card' + (deleted ? ' mc-card-deleted' : '') + '" onclick="' + goVid + '" role="link" tabindex="0">' +
          '<div class="mc-card-avatar">' + esc(myInitial) + '</div>' +
          '<div class="mc-card-body">' +
            '<div class="mc-card-head">' +
              '<span class="mc-card-author">' + esc(myName) + '</span>' +
              '<span class="mc-card-time">' + timeAgo(c.created_at) + '</span>' +
              '<span style="color:var(--text-muted,#888)">·</span>' +
              '<span class="mc-card-video">su <strong title="' + esc(c.video_title || "") + '">' + esc(c.video_title || "video rimosso") + '</strong></span>' +
            '</div>' +
            (c.parent_username ? '<div class="mc-card-parent">↩ rispondi a <em>' + esc(c.parent_username) + '</em>' + (c.parent_content ? ': "' + esc(String(c.parent_content).slice(0, 80)) + (c.parent_content.length > 80 ? '…' : '') + '"' : '') + '</div>' : '') +
            '<div class="mc-card-content">' + esc(c.content || "(vuoto)") + '</div>' +
            (deleted ? '<div class="mc-card-flag">Eliminato</div>' : '') +
            (!deleted ? '<div class="mc-card-actions">' +
              (c.video_id ? '<button class="mc-card-action" onclick="event.stopPropagation();location.href=\'video.html?id=' + c.video_id + '#c' + c.id + '\'">↗ Vai al commento</button>' : '') +
              '<button class="mc-card-action" onclick="event.stopPropagation();MCApp.editComment(' + c.id + ')">✎ Modifica</button>' +
              '<button class="mc-card-action danger" onclick="event.stopPropagation();MCApp.deleteComment(' + c.id + ')">🗑 Elimina</button>' +
            '</div>' :
            '<div class="mc-card-actions">' +
              '<button class="mc-card-action danger" onclick="event.stopPropagation();MCApp.purgeComment(' + c.id + ')" title="Rimuovi definitivamente">🗑 Rimuovi definitivamente</button>' +
            '</div>') +
          '</div>' +
        '</article>'
      );
    }).join("");
    list.innerHTML = html;
    var stats = $("mcStats");
    if (stats) stats.innerHTML = '<strong>' + state.items.length + '</strong> ' + (state.items.length === 1 ? 'commento' : 'commenti');
  }

  // Popola il <select> del filtro per video con i video su cui ho commentato.
  function populateVideoFilter(videos) {
    var sel = $("mcVideoFilter"); if (!sel) return;
    var opts = ['<option value="">Tutti i video</option>'];
    (videos || []).forEach(function (v) {
      if (v.id && v.title) {
        var selAttr = state.videoId === v.id ? ' selected' : '';
        opts.push('<option value="' + v.id + '"' + selAttr + '>' + esc(String(v.title).slice(0, 80)) + '</option>');
      }
    });
    sel.innerHTML = opts.join("");
  }

  // Fetch della lista + refresh render.
  async function load() {
    if (!state.token) { renderNotLogged(); return; }
    renderLoading();

    var qs = ["page=1","limit=50","filter=" + encodeURIComponent(state.filter),"sort=" + encodeURIComponent(state.sort)];
    if (state.q) qs.push("q=" + encodeURIComponent(state.q));
    if (state.videoId) qs.push("video_id=" + encodeURIComponent(state.videoId));

    try {
      var resp = await fetch("/api/user/me/comments?" + qs.join("&"), {
        headers: { "Authorization": "Bearer " + state.token, "Content-Type": "application/json" },
        cache: "no-store"
      });
      if (resp.status === 401 || resp.status === 403) { renderNotLogged(); return; }
      if (!resp.ok) {
        var err = await resp.json().catch(function(){return {};});
        renderError((err && err.error) || ("HTTP " + resp.status));
        return;
      }
      var data = await resp.json();
      state.items = (data && data.items) || [];
      if (data.videos) populateVideoFilter(data.videos);
      renderList();
    } catch (e) {
      renderError("Errore di rete: " + (e && e.message));
    }
  }

  //  API pubblica: handler agganciati dagli onclick/onchange dell'HTML.
  return {
    init: function () {
      loadAuth();
      renderHeader();
      load();
    },
    // Click su una tab filtro (tutti / attivi / eliminati).
    setFilter: function (f, btn) {
      if (state.filter === f) return;
      state.filter = f;
      document.querySelectorAll(".mc-tab").forEach(function (t) {
        t.classList.toggle("active", t === btn);
      });
      load();
    },
    // Ricerca con debounce  per non ricaricare a ogni tasto.
    onSearchInput: function (ev) {
      var btn = $("mcSearchClear");
      if (btn) btn.style.display = ev.target.value ? "" : "none";
      clearTimeout(state.dbn);
      state.dbn = setTimeout(function () {
        state.q = (ev.target.value || "").trim();
        load();
      }, 400);
    },
    applySearch: function () {
      var v = $("mcSearchInput");
      state.q = v ? (v.value || "").trim() : "";
      load();
    },
    clearSearch: function () {
      var v = $("mcSearchInput"); if (v) v.value = "";
      var b = $("mcSearchClear"); if (b) b.style.display = "none";
      if (state.q) { state.q = ""; load(); }
    },
    onVideoFilterChange: function () {
      var s = $("mcVideoFilter");
      state.videoId = s && s.value ? parseInt(s.value, 10) : null;
      load();
    },
    onSortChange: function () {
      var s = $("mcSortSelect");
      state.sort = (s && s.value === "old") ? "old" : "recent";
      load();
    },
    // Modifica il testo di un commento (apre la modale prompt).
    editComment: async function (id) {
      var c = state.items.find(function (x) { return x.id === id; });
      if (!c) return;
      var newText = await mcPrompt({
        title: T("mc.edit_prompt", "Modifica il tuo commento"),
        message: "Aggiorna il testo e premi Salva (Ctrl+Invio).",
        value: c.content || "",
        okText: T("mc.save", "Salva"),
        cancelText: T("mc.cancel", "Annulla")
      });
      if (newText == null) return;
      newText = newText.trim();
      if (!newText || newText === c.content) return;
      if (newText.length > 2000) { showMsg("Massimo 2000 caratteri.", "err"); return; }
      try {
        var resp = await fetch("/api/user/comments/" + id, {
          method: "PUT",
          headers: { "Authorization": "Bearer " + state.token, "Content-Type": "application/json" },
          body: JSON.stringify({ content: newText })
        });
        if (!resp.ok) {
          var err = await resp.json().catch(function () { return {}; });
          showMsg("Errore: " + ((err && err.error) || ("HTTP " + resp.status)), "err");
          return;
        }
        c.content = newText;
        renderList();
      } catch (e) { showMsg("Errore di rete: " + e.message, "err"); }
    },
    // Soft delete: apre modale di conferma, poi DELETE.
    deleteComment: async function (id) {
      var okDel = await mcConfirm({
        title: T("mc.confirm_delete_title", "Eliminare il commento?"),
        message: T("mc.confirm_delete", "Il commento verra' rimosso dalla vista pubblica. Puoi ripristinarlo dal pannello di moderazione entro breve."),
        okText: T("mc.delete", "Elimina"),
        cancelText: T("mc.cancel", "Annulla"),
        danger: true
      });
      if (!okDel) return;
      try {
        var resp = await fetch("/api/user/comments/" + id, {
          method: "DELETE",
          headers: { "Authorization": "Bearer " + state.token }
        });
        if (!resp.ok) {
          var err = await resp.json().catch(function () { return {}; });
          showMsg("Errore: " + ((err && err.error) || ("HTTP " + resp.status)), "err");
          return;
        }
        state.items = state.items.filter(function (x) { return x.id !== id; });
        renderList();
      } catch (e) { showMsg("Errore di rete: " + e.message, "err"); }
    },
    // Hard delete (purge): rimuove definitivamente dal DB.
    purgeComment: async function (id) {
      var okPurge = await mcConfirm({
        title: "Rimozione definitiva",
        message: "Il commento verra' cancellato dal database e non potra' piu' essere ripristinato. Confermare?",
        okText: "Rimuovi",
        cancelText: "Annulla",
        danger: true
      });
      if (!okPurge) return;
      try {
        var resp = await fetch("/api/user/comments/" + id + "/purge", {
          method: "DELETE",
          headers: { "Authorization": "Bearer " + state.token }
        });
        if (!resp.ok) {
          var err = await resp.json().catch(function () { return {}; });
          var msg = (err && err.error) || ("HTTP " + resp.status);
          if (resp.status === 404) msg += " — riavvia il server (docker compose restart app)";
          showMsg("Errore: " + msg, "err");
          return;
        }
        state.items = state.items.filter(function (x) { return x.id !== id; });
        renderList();
      } catch (e) { showMsg("Errore di rete: " + e.message, "err"); }
    },
    _state: state
  };
})();

// Auto-init al load della pagina.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () { window.MCApp.init(); }, { once: true });
} else {
  window.MCApp.init();
}