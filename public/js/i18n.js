/*
 i18n.js — internazionalizzazione IT/EN.

 Come funziona:
   1) DICT: oggetto in memoria con due mappe (it, en).
   2) getLang(): legge la lingua da localStorage.nm_lang.
   3) t(key): ritorna la traduzione corrente.
  

 Auto-init al DOMContentLoaded: tutte le pagine che includono questo
 file vedono le traduzioni applicate senza dover chiamare niente.

 Api pubblica su window.NMI18n:  { t, getLang, setLang, toggle, apply }
*/

(function () {
  // Dizionario.
  const DICT = {
    it: {
      // --- Generale / azioni ---
      "common.login": "Accedi",
      "common.register": "Registrati",
      "common.logout": "Esci",
      "common.back_home": "Torna alla home",
      "common.email": "Email",
      "common.password": "Password",
      "common.confirm_password": "Conferma password",
      "common.username": "Username",
      "common.search": "Cerca",
      "common.lang_label": "Lingua",
      "common.theme_light": "Tema chiaro",
      "common.theme_dark": "Tema scuro",

      // Index
      "index.title": "NetMed | Streaming medico professionale",
      "index.hero_h1_a": "Tutta la medicina,",
      "index.hero_h1_b": "in un unico streaming.",
      "index.hero_h1_full": "Tutta la medicina,<br><span>in un unico streaming.</span>",
      "index.hero_p":
        "Guarda lezioni di chirurgia, protocolli di fisioterapia e casi clinici ovunque tu sia.",
      "index.email_ph": "Il tuo indirizzo email",
      "index.cta": "Inizia ora ›",
      "index.note": "Pronto a iniziare? Inserisci l'email per creare il tuo account.",

      // Login
      "login.title": "Login | NETMED",
      "login.h1_a": "Accedi al tuo",
      "login.h1_b": "account",
      "login.h1_full": "Accedi al tuo <span>account</span>",
      "login.p": "Inserisci le tue credenziali per accedere alla piattaforma di telemedicina.",
      "login.btn": "Accedi",
      "login.no_account": "Non hai un account? Registrati",

      // Registrazione
      "reg.title": "Registrazione | NETMED",
      "reg.h1_a": "Registrazione al",
      "reg.h1_b": "servizio",
      "reg.h1_full": "Registrazione al <span>servizio</span>",
      "reg.p": "Inserisci le tue credenziali per accedere alla piattaforma di telemedicina.",
      "reg.username_ph": "Username (min. 3 caratteri)",
      "reg.password_ph": "Password (min. 6 caratteri)",
      "reg.password_conf_ph": "Conferma password",
      "reg.btn": "Registrati",
      "reg.have_account": "Hai già un account? Accedi",

      // Home
      "home.title": "NETMED — Home",
      "home.skip": "Salta al contenuto principale",
      "home.nav_home": "Home",
      "home.nav_categories": "Categorie",
      "home.nav_saved": "Salvati",
      "home.search_ph": "Cerca video, categorie, tag…",
      "home.search_aria": "Cerca video, categorie o tag",
      "home.menu_user": "Menu utente",
      "home.dd_profile": "Il mio profilo",
      "home.dd_saved": "Salvati",
      "home.dd_comments": "I miei commenti",
      "home.dd_history": "Cronologia",
      "home.dd_creator": "I miei video",
      "home.dd_admin": "Dashboard admin",
      "home.dd_logout": "Esci",
      "home.hero_t": "Il tuo streaming medico professionale",
      "home.hero_d":
        "Lezioni di chirurgia, protocolli di fisioterapia, casi clinici e formazione continua.",
      "home.hero_cta_login": "Accedi",
      "home.hero_cta_register": "Registrati gratis",
      "home.row_featured": "In evidenza",
      "home.row_recent": "Aggiunti di recente",
      "home.empty_t": "Nessun video disponibile al momento.",
      "home.empty_d": "Torna a trovarci tra poco stiamo caricando nuovi contenuti.",

      //Reset password
      "reset.h1": "Recupero password",
      "reset.h1_full": "Recupero <span>password</span>",

      //Footer
      "footer.privacy": "Privacy",
      "footer.terms": "Termini",
      "footer.contacts": "Contatti",
      "footer.faq": "FAQ",
      "footer.copy": "© 2026 NETMED",
      "footer.brand_desc": "Piattaforma di video divulgativi a tema medico-scientifico.",
      "footer.col_catalog": "Catalogo",
      "footer.col_account": "Account",
      "footer.col_info": "Info",
      "footer.account_login": "Accedi",
      "footer.account_register": "Registrati",
      "footer.account_saved": "I miei salvati",
      "footer.info_about": "Chi siamo",
      "footer.bottom_copy": "© 2026 NETMED",
      "footer.cookie": "Cookie",
      "footer.access": "Accessibilità",

      //Pagina Profilo: Impostazioni
      "profile.settings": "Impostazioni",
      "profile.settings_desc": "Personalizza l'aspetto e la lingua dell'interfaccia. Le scelte vengono salvate sul tuo browser.",
      "profile.theme": "Tema",
      "profile.theme_light": "Chiaro",
      "profile.theme_dark": "Scuro",
      "profile.language": "Lingua",

      // Stringhe dinamiche usate dai JS (preferiti, ricerca, video, ecc.)
      "ui.loading": "Caricamento…",
      "ui.error_load": "Errore di caricamento",
      "ui.try_again": "Riprova",
      "ui.no_results": "Nessun risultato",
      "ui.cancel": "Annulla",
      "ui.confirm": "Conferma",
      "ui.delete": "Elimina",
      "ui.edit": "Modifica",
      "ui.save": "Salva",
      "ui.share": "Condividi",
      "ui.share_copied": "Link copiato",
      "ui.notifications": "Notifiche",
      "ui.no_notifications": "Nessuna notifica",

      "fav.all_saved": "Tutti i salvati",
      "fav.new_folder": "+ Nuova cartella",
      "fav.add_videos": "Aggiungi video salvati",
      "fav.delete_folder": "Elimina cartella",
      "fav.no_saved": "Nessun video salvato",
      "fav.no_saved_desc": "Salva i video con il bottone Salva e li ritroverai qui.",
      "fav.folder_empty": "Cartella vuota",
      "fav.add_folder_title": "Aggiungi a una cartella",
      "fav.add_folder_placeholder": "Nuova cartella…",
      "fav.create_add": "Crea e aggiungi",
      "fav.confirm_delete_title": "Eliminare la cartella?",
      "fav.confirm_delete_msg": "La cartella sarà eliminata. I video restano comunque nei tuoi salvati.",
      "fav.video_saved_one": "video salvato",
      "fav.video_saved_many": "video salvati",
      "fav.added_to_folder": "Aggiunto alla cartella",
      "fav.removed_from_folder": "Tolto dalla cartella",
      "fav.removed_from_saved": "Rimosso dai salvati",

      "cat.all_videos": "Tutti i video",
      "cat.clear_filters": "Cancella filtri",
      "cat.sort_by": "Ordina per",
      "cat.video_avail_one": "video disponibile",
      "cat.video_avail_many": "video disponibili",

      "sr.most_viewed": "Più visti",
      "sr.most_useful": "Più utili",
      "sr.recent": "Recenti",
      "sr.results_title": "Risultati ricerca",
      "sr.results_filtered": "Risultati filtrati",
      "sr.clear_filter": "Cancella filtro",
      "sr.active_filters": "Filtri attivi",
      "sr.clear_all": "Cancella tutti i filtri",
      "sr.category": "Categoria",
      "sr.tag": "Tag",
      "sr.result_one": "risultato",
      "sr.result_many": "risultati",

      "vid.subscribe": "Iscriviti",
      "vid.subscribed": "Iscritto",
      "vid.subscribe_channel": "Iscriviti al canale",
      "vid.add_comment": "Aggiungi un commento…",
      "vid.confirm_delete_comment": "Eliminare il commento?",
      "vid.report_details_placeholder": "Aggiungi dettagli che possano aiutare la moderazione…",
      "vid.share": "Condividi",
      "vid.link_copied": "Link del video copiato",

      "mc.edit_prompt": "Modifica il tuo commento:",
      "mc.confirm_delete": "Eliminare definitivamente questo commento?",

      "up.uploading_photo": "Caricamento foto…",
      "up.upload_failed": "Caricamento non riuscito",
      "up.profile_updated": "Profilo aggiornato",
      "up.profile_verified_updated": "Profilo verificato aggiornato",
      "up.deleting": "Eliminazione…",
      "up.delete_failed": "Eliminazione fallita",
      "up.add_specifics": "＋ Aggiungi specifiche",

      "hdr.all_cats": "Tutte le categorie",
      "hdr.all_tags": "Tutti i tag",
      "hdr.subscriptions": "Iscrizioni",
      "hdr.verified": "Verificato",
      "hdr.profile_verified": "Profilo verificato!",
    },

    en: {
      // General
      "common.login": "Sign in",
      "common.register": "Sign up",
      "common.logout": "Sign out",
      "common.back_home": "Back to home",
      "common.email": "Email",
      "common.password": "Password",
      "common.confirm_password": "Confirm password",
      "common.username": "Username",
      "common.search": "Search",
      "common.lang_label": "Language",
      "common.theme_light": "Light theme",
      "common.theme_dark": "Dark theme",

      // Index
      "index.title": "NetMed | Professional Medical Streaming",
      "index.hero_h1_a": "All of medicine,",
      "index.hero_h1_b": "in a single stream.",
      "index.hero_h1_full": "All of medicine,<br><span>in a single stream.</span>",
      "index.hero_p":
        "Watch surgery lectures, physiotherapy protocols and clinical cases — wherever you are.",
      "index.email_ph": "Your email address",
      "index.cta": "Start now ›",
      "index.note": "Ready to start? Enter your email to create or reactivate your account.",

      // Login
      "login.title": "Login | NETMED",
      "login.h1_a": "Sign in to your",
      "login.h1_b": "account",
      "login.h1_full": "Sign in to your <span>account</span>",
      "login.p": "Enter your credentials to access the professional telemedicine platform.",
      "login.btn": "Sign in",
      "login.no_account": "No account yet? Sign up",

      // Sign up
      "reg.title": "Sign up | NETMED",
      "reg.h1_a": "Sign up for the",
      "reg.h1_b": "service",
      "reg.h1_full": "Sign up for the <span>service</span>",
      "reg.p": "Enter your details to create your professional telemedicine account.",
      "reg.username_ph": "Username (min. 3 characters)",
      "reg.password_ph": "Password (min. 6 characters)",
      "reg.password_conf_ph": "Confirm password",
      "reg.btn": "Sign up",
      "reg.have_account": "Already have an account? Sign in",

      // User home
      "home.title": "NETMED — Home",
      "home.skip": "Skip to main content",
      "home.nav_home": "Home",
      "home.nav_categories": "Categories",
      "home.nav_saved": "Saved",
      "home.search_ph": "Search videos, categories, tags…",
      "home.search_aria": "Search videos, categories or tags",
      "home.menu_user": "User menu",
      "home.dd_profile": "My profile",
      "home.dd_saved": "Saved",
      "home.dd_comments": "My comments",
      "home.dd_history": "History",
      "home.dd_creator": "My videos",
      "home.dd_admin": "Admin dashboard",
      "home.dd_logout": "Sign out",
      "home.hero_t": "Your professional medical streaming",
      "home.hero_d":
        "Surgery lectures, physiotherapy protocols, clinical cases and continuous education.",
      "home.hero_cta_login": "Sign in",
      "home.hero_cta_register": "Sign up — it's free",
      "home.row_featured": "Featured",
      "home.row_recent": "Recently added",
      "home.empty_t": "No videos available right now.",
      "home.empty_d": "Check back soon — we're loading new content.",

      // Reset password
      "reset.h1": "Password recovery",
      "reset.h1_full": "Password <span>recovery</span>",

      // Footer
      "footer.privacy": "Privacy",
      "footer.terms": "Terms",
      "footer.contacts": "Contact",
      "footer.faq": "FAQ",
      "footer.copy": "© 2026 NETMED. All rights reserved.",
      "footer.brand_desc":
        "Educational medical-scientific video platform. Curated content for students, professionals and curious minds.",
      "footer.col_catalog": "Catalog",
      "footer.col_account": "Account",
      "footer.col_info": "Info",
      "footer.account_login": "Sign in",
      "footer.account_register": "Sign up",
      "footer.account_saved": "My saved",
      "footer.info_about": "About us",
      "footer.bottom_copy": "© 2026 NETMED — University thesis project",
      "footer.cookie": "Cookies",
      "footer.access": "Accessibility",

      // Profile page: Settings section
      "profile.settings": "Settings",
      "profile.settings_desc": "Customize the look and language of the interface. Your choices are saved on your browser.",
      "profile.theme": "Theme",
      "profile.theme_light": "Light",
      "profile.theme_dark": "Dark",
      "profile.language": "Language",

      // Dynamic strings
      "ui.loading": "Loading…",
      "ui.error_load": "Failed to load",
      "ui.try_again": "Retry",
      "ui.no_results": "No results",
      "ui.cancel": "Cancel",
      "ui.confirm": "Confirm",
      "ui.delete": "Delete",
      "ui.edit": "Edit",
      "ui.save": "Save",
      "ui.share": "Share",
      "ui.share_copied": "Link copied",
      "ui.notifications": "Notifications",
      "ui.no_notifications": "No notifications",

      "fav.all_saved": "All saved",
      "fav.new_folder": "+ New folder",
      "fav.add_videos": "Add saved videos",
      "fav.delete_folder": "Delete folder",
      "fav.no_saved": "No saved videos",
      "fav.no_saved_desc": "Save videos with the Save button and you'll find them here.",
      "fav.folder_empty": "Empty folder",
      "fav.add_folder_title": "Add to folder",
      "fav.add_folder_placeholder": "New folder…",
      "fav.create_add": "Create and add",
      "fav.confirm_delete_title": "Delete folder?",
      "fav.confirm_delete_msg": "The folder will be deleted. Videos remain in your saved list.",
      "fav.video_saved_one": "saved video",
      "fav.video_saved_many": "saved videos",
      "fav.added_to_folder": "Added to folder",
      "fav.removed_from_folder": "Removed from folder",
      "fav.removed_from_saved": "Removed from saved",

      "cat.all_videos": "All videos",
      "cat.clear_filters": "Clear filters",
      "cat.sort_by": "Sort by",
      "cat.video_avail_one": "video available",
      "cat.video_avail_many": "videos available",

      "sr.most_viewed": "Most viewed",
      "sr.most_useful": "Most useful",
      "sr.recent": "Recent",
      "sr.results_title": "Search results",
      "sr.results_filtered": "Filtered results",
      "sr.clear_filter": "Clear filter",
      "sr.active_filters": "Active filters",
      "sr.clear_all": "Clear all filters",
      "sr.category": "Category",
      "sr.tag": "Tag",
      "sr.result_one": "result",
      "sr.result_many": "results",

      "vid.subscribe": "Subscribe",
      "vid.subscribed": "Subscribed",
      "vid.subscribe_channel": "Subscribe to channel",
      "vid.add_comment": "Add a comment…",
      "vid.confirm_delete_comment": "Delete comment?",
      "vid.report_details_placeholder": "Add details that may help moderation…",
      "vid.share": "Share",
      "vid.link_copied": "Video link copied",

      "mc.edit_prompt": "Edit your comment:",
      "mc.confirm_delete": "Delete this comment permanently?",

      "up.uploading_photo": "Uploading photo…",
      "up.upload_failed": "Upload failed",
      "up.profile_updated": "Profile updated",
      "up.profile_verified_updated": "Verified profile updated",
      "up.deleting": "Deleting…",
      "up.delete_failed": "Delete failed",
      "up.add_specifics": "Add specifics",

      "hdr.all_cats": "All categories",
      "hdr.all_tags": "All tags",
      "hdr.subscriptions": "Subscriptions",
      "hdr.verified": "Verified",
      "hdr.profile_verified": "Profile verified!",
    },
  };

  // Ritorna la lingua attiva. Priorita':localStorage>browser>'it'.
  function getLang() {
    let l = localStorage.getItem("nm_lang");
    if (l === "it" || l === "en") return l;
    // Detect dal browser al primo caricamento: se il navigatore in inglese uso EN, altrimenti fallback IT.
    const nav = (navigator.language || "").toLowerCase();
    return nav.startsWith("en") ? "en" : "it";
  }

  // scelta e riapplica le traduzioni all'intera pagina.
  function setLang(lang) {
    if (lang !== "it" && lang !== "en") return;
    localStorage.setItem("nm_lang", lang);
    apply();
  }

  // Traduce una chiave. Se la lingua corrente non ce l'ha, cade su italiano; se manca anche ritorna la chiave letterale
  function t(key) {
    const lang = getLang();
    const d = DICT[lang] || DICT.it;
    if (d[key] !== undefined) return d[key];
    return DICT.it[key] !== undefined ? DICT.it[key] : key;
  }

  function apply(root) {
    root = root || document;
    if (document.documentElement) {
      document.documentElement.setAttribute("lang", getLang());
    }
    // <title> ha bisogno di un accesso dedicato
    const titleEl = root.querySelector("title[data-i18n]");
    if (titleEl) titleEl.textContent = t(titleEl.getAttribute("data-i18n"));

    root.querySelectorAll("[data-i18n]").forEach((el) => {
      if (el.tagName === "TITLE") return;
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-html]").forEach((el) => {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    root.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria-label")));
    });

    // Bottone lingua globale (nell'header): mostra la sigla dell'altra lingua ("EN" se sono in IT, "IT" se sono in EN).
    document.querySelectorAll(".nm-lang-switch").forEach((btn) => {
      const cur = getLang();
      btn.textContent = cur === "it" ? "EN" : "IT";
      btn.setAttribute("aria-label", cur === "it" ? "Switch to English" : "Passa all'italiano");
      btn.setAttribute("title", btn.getAttribute("aria-label"));
      if (!btn._nmLangBound) {
        btn.addEventListener("click", function (e) { e.preventDefault(); toggle(); });
        btn._nmLangBound = true;
      }
    });

    // Se il core.js ha registrato re-render dell'header, li chiamo:le voci menu vanno riscritte nella lingua giusta.
    try {
      if (typeof window.renderHeaderNav === "function") window.renderHeaderNav();
      if (typeof window.renderHeaderUser === "function") window.renderHeaderUser();
    } catch (_) {}

    try {
      document.dispatchEvent(new CustomEvent("nm:langchange", { detail: { lang: getLang() } }));
    } catch (_) {}
  }
  function toggle() {
    setLang(getLang() === "it" ? "en" : "it");
  }

  // Api pubblica esposta su window: la usa il core.js e le pagine che vogliono tradurre stringhe generate a runtime(es. toast).
  window.NMI18n = {
    t: t,
    getLang: getLang,
    setLang: setLang,
    toggle: toggle,
    apply: apply,
  };

  // Auto-init: se il DOM sta ancora caricando, aspetto DOMContentLoaded; se e' gia' pronto (script incluso in coda al body), applico subito.
  function autoInit() { apply(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit, { once: true });
  } else {
    autoInit();
  }
})();