// Mini-libreria di illustrazioni SVG per empty state e skeleton.
// Ogni pagina che mostra "nessun risultato" o un errore chiede l'illustrazione
// tramite NMUI.illust("nome"). Gli SVG usano currentColor cosi' seguono il tema.
(function () {

  const ILLUST = {
    // Salvati / preferiti - bookmark con cuore.
    bookmark: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor"
            stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true">
         <path d="M16 8h32a3 3 0 0 1 3 3v45l-19-12-19 12V11a3 3 0 0 1 3-3z"/>
         <path d="M32 24c-2.5-3.5-8-2.5-8 2 0 4 8 9 8 9s8-5 8-9c0-4.5-5.5-5.5-8-2z"
               fill="currentColor" opacity=".18" stroke="none"/>
         <path d="M32 24c-2.5-3.5-8-2.5-8 2 0 4 8 9 8 9s8-5 8-9c0-4.5-5.5-5.5-8-2z"/>
       </svg>`,

    // Cronologia - orologio con freccia indietro.
    history: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor"
            stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true">
         <circle cx="32" cy="34" r="22"/>
         <path d="M32 22v12l8 5"/>
         <path d="M14 18l-4-4M14 14l-4 4"/>
         <path d="M10 30A22 22 0 0 1 32 12" stroke-dasharray="2 4"/>
       </svg>`,

    // Commenti - bolla chat con quote.
    chat: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor"
            stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true">
         <path d="M10 14h44a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H26l-10 8v-8h-6a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z"/>
         <line x1="20" y1="26" x2="44" y2="26"/>
         <line x1="20" y1="34" x2="36" y2="34"/>
       </svg>`,

    // Nessun video - claqueta cinematografica.
    clapper: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor"
            stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true">
         <rect x="8" y="22" width="48" height="32" rx="3"/>
         <path d="M8 22l6-10 8 4-3 6h-11z" />
         <path d="M22 16l8 4-3 6h-8" />
         <path d="M35 14l8 4-3 6h-8" />
         <path d="M48 12l8 4-3 6h-8" />
         <path d="M28 32l12 6-12 6v-12z" fill="currentColor" opacity=".25" stroke="none"/>
       </svg>`,

    // Nessun risultato - lente con linee.
    search: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor"
            stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true">
         <circle cx="27" cy="27" r="15"/>
         <line x1="38" y1="38" x2="54" y2="54"/>
         <line x1="22" y1="27" x2="32" y2="27" opacity=".5"/>
         <line x1="22" y1="22" x2="30" y2="22" opacity=".3"/>
       </svg>`,

    // Categoria vuota - cartella.
    folder: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor"
            stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true">
         <path d="M6 18a4 4 0 0 1 4-4h14l6 6h24a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V18z"/>
         <line x1="20" y1="34" x2="44" y2="34" opacity=".5"/>
       </svg>`,

    // Errore - triangolo di warning.
    warning: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor"
            stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true">
         <path d="M32 8l26 46H6L32 8z"/>
         <line x1="32" y1="26" x2="32" y2="38"/>
         <circle cx="32" cy="46" r="2" fill="currentColor" stroke="none"/>
       </svg>`,
  };

  // Wrappa l'illustrazione in un div con le classi giuste.
  // opts.variant: "default" | "warn" | "danger" (colore accento)
  // opts.size: "default" | "sm" (dimensione ridotta)
  function illust(type, opts) {
    opts = opts || {};
    const svg = ILLUST[type] || ILLUST.clapper;   // fallback claqueta se il nome non esiste
    const cls =
      "nm-empty-illust" +
      (opts.variant && opts.variant !== "default" ? " " + opts.variant : "") +
      (opts.size === "sm" ? " sm" : "");
    return `<div class="${cls}" aria-hidden="true">${svg}</div>`;
  }

  // Skeleton di N card per riempire una griglia mentre parte la fetch.
  // Default 6. Il trick "n | 0" forza a intero, "|| 6" copre 0/undefined.
  function skelCards(n) {
    n = Math.max(1, n | 0 || 6);
    let html = "";
    for (let i = 0; i < n; i++) {
      html += `
        <div class="nm-sk-card" aria-hidden="true">
          <div class="nm-sk nm-sk-thumb"></div>
          <div class="nm-sk-card-body">
            <div class="nm-sk nm-sk-line nm-sk-w90"></div>
            <div class="nm-sk nm-sk-line nm-sk-w60"></div>
          </div>
        </div>`;
    }
    return html;
  }

  // Skeleton dell'hero (banner grande in cima).
  function skelHero() {
    return `<div class="nm-sk-hero" aria-hidden="true"></div>`;
  }

  // Api pubblica. Espongo anche ILLUST cosi' chi vuole puo' comporre
  // markup custom con gli SVG raw.
  window.NMUI = {
    illust,
    skelCards,
    skelHero,
    ILLUST,
  };
})();