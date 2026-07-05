
(function init() {
  loadTheme();
  loadAuth();
  renderHeaderUser();

  // Refresh asincrono dei flag freschi(is_verified, role…)
  refreshAuthMe();

  // Le categorie servono per il nav nell'header
  loadHeaderCategoriesForVideoPage();

  // Ricerca (riusiamo il modulo search)
  initUserSearch();

  // Contenuto della pagina: dettaglio video + commenti (video.js).
  loadVideoPage();

  // Sync cross-tab di tema/auth
  window.addEventListener("storage", (e) => {
    if (e.key === "nm_theme") loadTheme();
    if (e.key === "token" || e.key === "user") {
      loadAuth();
      renderHeaderUser();
      // Re-render della UI sensibile al login (azioni, commenti)
      if (VD.video) renderVdMain();
      renderVdComments();
    }
  });
})();


async function loadHeaderCategoriesForVideoPage() {
  const res = await api("/api/user/categories");
  if (res.ok) NM.categories = res.data || [];
  renderHeaderNav(null);
}
