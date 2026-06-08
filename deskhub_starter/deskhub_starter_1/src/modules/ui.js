let toastRegion = null;
let loaderEl = null;
let loaderCount = 0;
const THEME_KEY = "deskhub:theme";

function applyTheme(theme) {
  document.body.dataset.theme = theme;
}

function preferredTheme() {
  const saved = window.localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function initThemeToggle() {
  applyTheme(preferredTheme());

  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-toggle button button--secondary";
  button.setAttribute("aria-label", "Toggle dark mode");

  function syncButton() {
    const isDark = document.body.dataset.theme === "dark";
    button.textContent = isDark ? "Light mode" : "Dark mode";
    button.setAttribute("aria-pressed", String(isDark));
  }

  button.addEventListener("click", () => {
    const next = document.body.dataset.theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    syncButton();
  });

  syncButton();

  const nav = document.querySelector(".app-header__nav");
  if (nav) {
    nav.appendChild(button);
  } else {
    button.classList.add("theme-toggle--floating");
    document.body.appendChild(button);
  }
}

function ensureToastRegion() {
  if (toastRegion) return toastRegion;

  toastRegion = document.createElement("div");
  toastRegion.className = "toast-region";
  toastRegion.setAttribute("aria-live", "polite");
  toastRegion.setAttribute("aria-atomic", "true");
  document.body.appendChild(toastRegion);
  return toastRegion;
}

export function toast(message, type = "success") {
  const region = ensureToastRegion();
  const item = document.createElement("div");
  item.className = `toast toast--${type}`;
  item.setAttribute("role", type === "error" ? "alert" : "status");
  item.textContent = message;
  region.appendChild(item);

  window.setTimeout(() => {
    item.classList.add("is-leaving");
    window.setTimeout(() => item.remove(), 180);
  }, 3000);
}

export function showFullScreenLoader(message = "Working...") {
  loaderCount += 1;

  if (!loaderEl) {
    loaderEl = document.createElement("div");
    loaderEl.className = "fullscreen-loader";
    loaderEl.setAttribute("role", "status");
    loaderEl.setAttribute("aria-live", "polite");

    const panel = document.createElement("div");
    panel.className = "fullscreen-loader__panel";

    const spinner = document.createElement("span");
    spinner.className = "tickets-spinner";
    spinner.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.className = "fullscreen-loader__text";

    panel.append(spinner, text);
    loaderEl.append(panel);
    document.body.append(loaderEl);
  }

  const textEl = loaderEl.querySelector(".fullscreen-loader__text");
  if (textEl) textEl.textContent = message;
  loaderEl.hidden = false;
}

export function hideFullScreenLoader() {
  loaderCount = Math.max(0, loaderCount - 1);
  if (loaderEl && loaderCount === 0) {
    loaderEl.hidden = true;
  }
}

export function openModal({ title, content, actions }) {
  const previousFocus = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const dialog = document.createElement("section");
  dialog.className = "modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");

  const headingId = `modal-title-${Date.now()}`;
  dialog.setAttribute("aria-labelledby", headingId);

  const header = document.createElement("div");
  header.className = "modal__header";

  const heading = document.createElement("h2");
  heading.id = headingId;
  heading.textContent = title;

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "modal__close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "x";

  header.append(heading, closeBtn);

  const body = document.createElement("div");
  body.className = "modal__body";
  body.append(content);

  dialog.append(header, body);

  if (actions) {
    const footer = document.createElement("div");
    footer.className = "modal__footer";
    footer.append(actions);
    dialog.append(footer);
  }

  overlay.append(dialog);
  document.body.append(overlay);
  window.requestAnimationFrame(() => overlay.classList.add("is-open"));
  document.body.classList.add("has-modal");

  function close() {
    document.removeEventListener("keydown", onKeydown);
    overlay.classList.remove("is-open");
    window.setTimeout(() => {
      overlay.remove();
      document.body.classList.remove("has-modal");
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    }, 160);
  }

  function onKeydown(event) {
    if (event.key === "Escape") close();
  }

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", onKeydown);

  const firstField = dialog.querySelector("input, select, textarea, button");
  if (firstField instanceof HTMLElement) firstField.focus();

  return { close, element: overlay };
}

export function confirmDialog(message, title = "Are you sure?") {
  return new Promise((resolve) => {
    const content = document.createElement("p");
    content.className = "modal__message";
    content.textContent = message;

    const actions = document.createElement("div");
    actions.className = "modal-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "button button--secondary";
    cancelBtn.textContent = "Cancel";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "button button--danger";
    confirmBtn.textContent = "Yes, delete";

    actions.append(cancelBtn, confirmBtn);

    const modal = openModal({ title, content, actions });
    cancelBtn.addEventListener("click", () => {
      modal.close();
      resolve(false);
    });
    confirmBtn.addEventListener("click", () => {
      modal.close();
      resolve(true);
    });
  });
}
