/*Hover preview per le card video
 Al passaggio del mouse su una .vcard o .vl-card, dopo  mostra un
 popup con embed YT muted+autoplay o poster + titolo + azioni.
*/
 (function () {
  "use strict";

  const isTouch = "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0;
  const reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (isTouch || reduceMotion) return;
  if (document.body && document.body.hasAttribute("data-no-hover-preview")) return;

  const css = `
    .nm-hp {
      position: fixed;
      z-index: 9000;
      width: 360px;
      max-width: 90vw;
      background: var(--card, #1a1a1a);
      border: 1px solid var(--border, rgba(255,255,255,.12));
      border-radius: 14px;
      box-shadow:
        0 30px 60px rgba(0, 0, 0, .55),
        0 12px 24px rgba(13, 122, 77, .18);
      overflow: hidden;
      transform: scale(.92);
      transform-origin: 50% 30%;
      opacity: 0;
      pointer-events: none;
      transition: transform .22s cubic-bezier(.2,.8,.2,1),
                  opacity   .18s ease;
    }
    [data-theme="light"] .nm-hp {
      box-shadow:
        0 24px 48px rgba(15, 23, 42, .22),
        0 8px 18px rgba(0, 138, 62, .14);
    }
    .nm-hp.show {
      transform: scale(1);
      opacity: 1;
      pointer-events: auto;
    }
    .nm-hp-media {
      position: relative;
      width: 100%;
      aspect-ratio: 16/9;
      background: #000;
      overflow: hidden;
    }
    .nm-hp-media img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .nm-hp-media iframe {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      border: 0;
      pointer-events: none;
    }
    .nm-hp-media::after {
      content: "";
      position: absolute; inset: auto 0 0 0;
      height: 50%;
      background: linear-gradient(180deg, transparent, rgba(0,0,0,.55));
      pointer-events: none;
    }
    .nm-hp-body {
      padding: 14px 16px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .nm-hp-title {
      font-family: 'Outfit', 'Inter', sans-serif;
      font-size: 15.5px;
      font-weight: 800;
      line-height: 1.25;
      color: var(--text, #fff);
      letter-spacing: -.2px;
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .nm-hp-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 10px;
      font-size: 12px;
      color: var(--text3, #94a3b8);
      align-items: center;
    }
    .nm-hp-meta .dot {
      width: 3px; height: 3px;
      border-radius: 50%;
      background: var(--text3, #64748b);
      opacity: .7;
    }
    .nm-hp-meta b { color: var(--accent, #0d7a4d); font-weight: 700; }
    .nm-hp-actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
    .nm-hp-btn {
      flex: 1;
      padding: 9px 12px;
      border-radius: 10px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      border: 1px solid var(--border, rgba(255,255,255,.18));
      background: var(--surface, rgba(255,255,255,.06));
      color: var(--text, #fff);
      cursor: pointer;
      transition: background .15s, border-color .15s, transform .12s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      text-decoration: none;
    }
    .nm-hp-btn:hover { background: var(--hover, rgba(255,255,255,.10)); }
    .nm-hp-btn:active { transform: translateY(1px); }
    .nm-hp-btn.primary {
      background: var(--accent-strong, #0a6940);
      border-color: transparent;
      color: #fff;
    }
    .nm-hp-btn.primary:hover { background: #0d7a4d; }

    @media (max-width: 720px) {
      .nm-hp { width: 300px; }
    }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  //  Stato globale (un solo popup vivo alla volta)

  let popup = null;
  let openTimer = null;
  let closeTimer = null;
  let currentCard = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Estrae i metadati dalla card. Supporta due formati:
  //   .vcard    -> righe carousel della home
  //   .vl-card  -> griglia di categoria/preferiti/cronologia/ricerca
  // Per il video_id prova nell'ordine: data-video-id -> regex sull'onclick
  // "goVideo(N)" -> href dell'<a> interno (video.html?id=N).
  function readCardMeta(card) {
    // Cerco titolo, categoria, meta in entrambi i formati
    const titleEl = card.querySelector(".vcard-title, .vl-title, .vl-card-title");
    const catEl = card.querySelector(".vcard-cat,   .vl-cat,   .vl-card-cat");
    const metaEl = card.querySelector(".vcard-meta,  .vl-meta,  .vl-card-meta");

    const title = card.getAttribute("aria-label") || (titleEl && titleEl.textContent) || "";
    const ytId = card.getAttribute("data-yt") || card.getAttribute("data-youtube-id") || "";
    const thumb = (card.querySelector("img") || {}).src || "";
    const cat = (catEl && catEl.textContent) || "";
    const metaTxt = (metaEl && metaEl.textContent) || "";

    // Cerco l'id del video in vari modi: data-attr, onclick="goVideo(N)",
    // o href dell'eventuale <a> dentro la card (es. video.html?id=N)
    let vid = card.getAttribute("data-video-id") || "";
    if (!vid) {
      const onclick = card.getAttribute("onclick") || "";
      const m = onclick.match(/goVideo\((\d+)\)/);
      if (m) vid = m[1];
    }
    if (!vid) {
      const a = card.querySelector('a[href*="video.html"]');
      if (a) {
        const h = a.getAttribute("href") || "";
        const m = h.match(/[?&]id=(\d+)/);
        if (m) vid = m[1];
      }
    }
    return {
      title: title.trim(),
      ytId: ytId.trim(),
      thumb,
      cat: cat.trim(),
      meta: metaTxt.replace(cat, "").trim(),
      vid,
    };
  }

  // Posiziona il popup sopra/sotto la card cercando di restare in viewport.
  function positionPopup(card) {
    if (!popup) return;
    const r = card.getBoundingClientRect();
    const W = window.innerWidth;
    const H = window.innerHeight;
    const pw = popup.offsetWidth;
    const ph = popup.offsetHeight;

    // Centro orizzontale rispetto alla card
    let left = r.left + r.width / 2 - pw / 2;
    if (left < 8) left = 8;
    if (left + pw > W - 8) left = W - pw - 8;

    // Sopra se c'e' spazio, altrimenti sotto
    let top;
    if (r.top - ph - 12 > 8) top = r.top - ph - 12;
    else if (r.bottom + ph + 12 < H - 8) top = r.bottom + 12;
    else top = Math.max(8, (H - ph) / 2);

    popup.style.left = Math.round(left) + "px";
    popup.style.top = Math.round(top) + "px";
  }
  // Costruisce il DOM del popup con embed YouTube 

  function buildPopup(meta) {
    const wrap = document.createElement("div");
    wrap.className = "nm-hp";
    wrap.setAttribute("role", "tooltip");

    const goHref = meta.vid ? "video.html?id=" + encodeURIComponent(meta.vid) : "#";

    const media = meta.ytId
      ? `<iframe
            src="https://www.youtube.com/embed/${esc(meta.ytId)}?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&rel=0"
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerpolicy="strict-origin-when-cross-origin"
            loading="lazy"></iframe>`
      : meta.thumb
        ? `<img src="${esc(meta.thumb)}" alt=""/>`
        : "";

    wrap.innerHTML = `
      <div class="nm-hp-media">${media}</div>
      <div class="nm-hp-body">
        <h3 class="nm-hp-title">${esc(meta.title)}</h3>
        <div class="nm-hp-meta">
          ${meta.cat ? `<b>${esc(meta.cat)}</b><span class="dot"></span>` : ""}
          ${meta.meta ? `<span>${esc(meta.meta)}</span>` : ""}
        </div>
        <div class="nm-hp-actions">
          <a class="nm-hp-btn primary" href="${esc(goHref)}">
            <span aria-hidden="true">▶</span>
            <span>Guarda ora</span>
          </a>
          <button class="nm-hp-btn" type="button" data-act="close" aria-label="Chiudi anteprima">Chiudi</button>
        </div>
      </div>
    `;

    // Click sul "Chiudi" o sullo sfondo
    wrap.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-act") === "close") {
        e.preventDefault();
        hidePreview(true);
      }
    });

    // Mantieni aperto se il mouse e' sopra il popup
    wrap.addEventListener("mouseenter", () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    });
    wrap.addEventListener("mouseleave", () => {
      hidePreview(false);
    });

    return wrap;
  }

  function showPreview(card) {
    if (!card) return;
    if (currentCard === card && popup) return;

    // Cleanup popup precedente
    if (popup) {
      popup.remove();
      popup = null;
    }
    currentCard = card;

    const meta = readCardMeta(card);
    if (!meta.title) return;

    popup = buildPopup(meta);
    document.body.appendChild(popup);
    // Posiziona prima di mostrare per evitare flash in alto a sx
    requestAnimationFrame(() => {
      positionPopup(card);
      requestAnimationFrame(() => popup && popup.classList.add("show"));
    });
  }

  function hidePreview(immediate) {
    if (!popup) return;
    const p = popup;
    if (immediate) {
      p.remove();
      popup = null;
      currentCard = null;
      return;
    }
    p.classList.remove("show");
    setTimeout(() => {
      // Solo se non e' stato rimpiazzato nel frattempo
      if (popup === p) {
        p.remove();
        popup = null;
        currentCard = null;
      }
    }, 200);
  }

  function attach(card) {
    if (!card || card.__nmHpAttached) return;
    card.__nmHpAttached = true;

    card.addEventListener("mouseenter", () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      if (openTimer) {
        clearTimeout(openTimer);
        openTimer = null;
      }
      openTimer = setTimeout(() => showPreview(card), 650);
    });
    card.addEventListener("mouseleave", () => {
      if (openTimer) {
        clearTimeout(openTimer);
        openTimer = null;
      }
      closeTimer = setTimeout(() => hidePreview(false), 200);
    });
  }

  function scan(root) {
    (root || document).querySelectorAll(".vcard, .vl-card").forEach(attach);
  }

  // Riposiziona su scroll/resize quando il popup e' aperto
  function onMove() {
    if (popup && currentCard) positionPopup(currentCard);
  }
  window.addEventListener("scroll", onMove, { passive: true });
  window.addEventListener("resize", onMove, { passive: true });

  // Esc chiude subito
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hidePreview(true);
  });

  // Scan iniziale + osservatore per le card iniettate dopo
  function init() {
    scan(document);
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes &&
          m.addedNodes.forEach((n) => {
            if (n.nodeType === 1) {
              const cl = n.classList;
              if (cl && (cl.contains("vcard") || cl.contains("vl-card"))) attach(n);
              else scan(n);
            }
          });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
