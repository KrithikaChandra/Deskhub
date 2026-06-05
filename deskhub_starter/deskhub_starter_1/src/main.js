import { initLoginPage } from "./modules/auth.js";
import { initDashboardPage } from "./modules/dashboard.js";
import { initTicketsList } from "./modules/tickets.js";
import * as authApi from "./api/auth.js";

const page = document.body.dataset.page;

if (page === "login") {
  const form = document.querySelector("#login-form");
  if (form instanceof HTMLFormElement) {
    initLoginPage(form);
  }
} else if (page === "dashboard") {
  // Guard: if someone opens dashboard.html without a session, bounce to login.
  if (!authApi.isAuthenticated()) {
    window.location.replace(new URL("./index.html", window.location.href).href);
  } else {
    initDashboardPage();
  }
} else if (page === "tickets-list") {
  if (!authApi.isAuthenticated()) {
    window.location.replace(new URL("./index.html", window.location.href).href);
  } else {
    initTicketsList();
  }
}
