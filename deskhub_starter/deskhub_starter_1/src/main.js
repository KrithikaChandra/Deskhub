
import { initLoginPage } from "./modules/auth.js";
import { initDashboardPage } from "./modules/dashboard.js";
import * as authApi from "./api/auth.js";

const page = document.body.dataset.page;

if (page === "login") {
  const form = document.querySelector("#login-form");
  if (form instanceof HTMLFormElement) {
    initLoginPage(form);
  }
} else if (page === "dashboard") {
  // if someone opens dashboard.html without a session, bounce to login.
  if (!authApi.isAuthenticated()) {
    window.location.replace(new URL("./index.html", window.location.href).href);
  } else {
    initDashboardPage();
  }
}
