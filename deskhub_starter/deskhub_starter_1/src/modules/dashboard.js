import * as authApi from "../api/auth.js";

export function initDashboardPage() {
  const logoutBtn = document.querySelector("#logout-button");
  if (!(logoutBtn instanceof HTMLButtonElement)) return;

  logoutBtn.addEventListener("click", () => {
    authApi.logout();
    window.location.href = new URL("./index.html", window.location.href).href;
  });
}
