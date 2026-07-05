(function init() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.replace("login.html");
    return;
  }

  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem("user") || "null");
  } catch (e) {}
  if (stored && stored.role && stored.role !== "admin") {
    window.location.replace(stored.role === "banned" ? "login.html" : "home.html");
    return;
  }

  loadTheme();
  loadUserInfo();
  loadNotifications();
  initGlobalSearch();
  nav("dashboard");
})();
