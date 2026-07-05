// NETMED — user catalog INIT (hardened)
(function init() {
  function safe(label, fn) {
    try {
      return fn();
    } catch (e) {
      console.error("[NETMED init] " + label + " failed:", e);
    }
  }
  safe("loadTheme", function () {
    if (typeof loadTheme === "function") loadTheme();
  });
  safe("loadAuth", function () {
    if (typeof loadAuth === "function") loadAuth();
  });
  safe("renderHeaderUser", function () {
    if (typeof renderHeaderUser === "function") renderHeaderUser();
  });
  safe("refreshAuthMe", function () {
    if (typeof refreshAuthMe === "function") refreshAuthMe();
  });
  safe("loadHeaderCategories", function () {
    if (typeof loadHeaderCategories === "function") loadHeaderCategories();
  });
  safe("loadHeaderTags", function () {
    if (typeof loadHeaderTags === "function") {
      loadHeaderTags()
        .then(function () {
          try {
            if (typeof renderHeaderNav === "function") renderHeaderNav("home");
          } catch (e) {
            console.error("[NETMED init] renderHeaderNav failed:", e);
          }
        })
        .catch(function (e) {
          console.error("[NETMED init] loadHeaderTags rejected:", e);
        });
    }
  });
  safe("initUserSearch", function () {
    if (typeof initUserSearch === "function") initUserSearch();
  });
  // loadHome deve partire SEMPRE: la home non resta mai bianca.
  safe("loadHome", function () {
    if (typeof loadHome === "function") loadHome();
  });
  window.addEventListener("storage", function (e) {
    if (e.key === "nm_theme")
      safe("loadTheme(storage)", function () {
        loadTheme();
      });
    if (e.key === "token" || e.key === "user") {
      safe("loadAuth(storage)", function () {
        loadAuth();
      });
      safe("renderHeaderUser(storage)", function () {
        renderHeaderUser();
      });
    }
  });
})();
