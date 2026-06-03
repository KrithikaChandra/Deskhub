
import * as authApi from "../api/auth.js";

/**
 * @param {HTMLFormElement} form
 */
export function initLoginPage(form) {
  const emailInput = /** @type {HTMLInputElement} */ (form.querySelector("#email"));
  const passwordInput = /** @type {HTMLInputElement} */ (
    form.querySelector("#password")
  );
  const errorEl = /** @type {HTMLElement} */ (form.querySelector("#login-error"));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.textContent = "";

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    try {
      await authApi.login(email, password);
      window.location.href = new URL("./dashboard.html", window.location.href).href;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      errorEl.textContent = message;
    }
  });
}
