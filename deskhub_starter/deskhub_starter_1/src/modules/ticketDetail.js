import * as ticketsApi from "../api/tickets.js";
import * as usersApi from "../api/users.js";
import * as authApi from "../api/auth.js";
import { formatDate } from "../utils/formatDate.js";
import { confirmDialog, hideFullScreenLoader, showFullScreenLoader, toast } from "./ui.js";

const STATUS_OPTIONS = ["open", "in-progress", "resolved", "closed"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];
const DELETE_REDIRECT_KEY = "deskhub:delete-redirect";

let ticketId = null;
let currentTicket = null;
let currentComments = [];
let users = [];
let isEditMode = false;

function byId(id) {
  return document.querySelector(`#${id}`);
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function saveDeleteRedirect(url) {
  window.sessionStorage.setItem(
    DELETE_REDIRECT_KEY,
    JSON.stringify({ url, startedAt: Date.now() })
  );
}

function readDeleteRedirect() {
  const raw = window.sessionStorage.getItem(DELETE_REDIRECT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.url === "string" &&
      typeof parsed.startedAt === "number"
    ) {
      return parsed;
    }
  } catch {
    /* clear malformed redirect state below */
  }

  window.sessionStorage.removeItem(DELETE_REDIRECT_KEY);
  return null;
}

function continueDeleteRedirectIfNeeded() {
  const pending = readDeleteRedirect();
  if (!pending) return false;

  showDeleteRedirectLoader();
  const elapsed = Date.now() - pending.startedAt;
  const remaining = Math.max(0, 3000 - elapsed);

  window.setTimeout(() => {
    window.sessionStorage.removeItem(DELETE_REDIRECT_KEY);
    window.location.replace(pending.url);
  }, remaining);

  return true;
}

function showDeleteRedirectLoader() {
  const existing = document.querySelector("#ticket-delete-loader");
  if (existing instanceof HTMLElement) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "ticket-delete-loader";
  overlay.className =
    "position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-75";
  overlay.style.zIndex = "9999";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `
    <div class="text-center text-white">
      <div class="spinner-border text-light mb-3" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="fs-5 mb-0">Deleting ticket...</p>
    </div>
  `;
  document.body.appendChild(overlay);
}

function isNotFoundError(err) {
  return err instanceof Error && err.message.toLowerCase().includes("not found");
}

function userName(id) {
  if (id == null) return "Unassigned";
  const user = users.find((item) => String(item.id) === String(id));
  return user ? String(user.name ?? `User #${id}`) : `User #${id}`;
}

function setLoading(isLoading) {
  const loadingEl = byId("ticket-detail-loading");
  const contentEl = byId("ticket-detail-content");
  if (loadingEl) loadingEl.hidden = !isLoading;
  if (contentEl) contentEl.hidden = isLoading;
}

function showError(message) {
  const errorEl = byId("ticket-detail-error");
  const loadingEl = byId("ticket-detail-loading");
  const contentEl = byId("ticket-detail-content");
  if (loadingEl) loadingEl.hidden = true;
  if (contentEl) contentEl.hidden = true;
  if (errorEl) {
    errorEl.hidden = false;
    errorEl.textContent = message;
  }
}

function populateAssignees() {
  const select = byId("detail-assignee");
  if (!(select instanceof HTMLSelectElement)) return;

  select.replaceChildren();

  const unassigned = document.createElement("option");
  unassigned.value = "";
  unassigned.textContent = "Unassigned";
  select.appendChild(unassigned);

  for (const user of users) {
    const option = document.createElement("option");
    option.value = String(user.id);
    option.textContent = String(user.name ?? `User #${user.id}`);
    select.appendChild(option);
  }
}

function setEditMode(enabled) {
  isEditMode = enabled;

  const status = byId("detail-status");
  const priority = byId("detail-priority");
  const assignee = byId("detail-assignee");
  const editBtn = byId("ticket-edit");
  const cancelBtn = byId("ticket-cancel-edit");
  const controls = byId("ticket-detail-content")?.querySelector(".detail-controls");

  for (const control of [status, priority, assignee]) {
    if (control instanceof HTMLSelectElement) {
      control.disabled = !enabled;
    }
  }

  if (editBtn instanceof HTMLButtonElement) {
    editBtn.textContent = enabled ? "Done" : "Edit";
    editBtn.setAttribute("aria-pressed", String(enabled));
  }
  if (cancelBtn instanceof HTMLButtonElement) {
    cancelBtn.hidden = !enabled;
  }
  if (controls instanceof HTMLElement) {
    controls.classList.toggle("is-editing", enabled);
  }
}

function renderComments(comments) {
  const wrap = byId("ticket-comments");
  if (!wrap) return;

  const sortedComments = [...comments].sort((a, b) => {
    const left = Date.parse(String(a.createdAt ?? ""));
    const right = Date.parse(String(b.createdAt ?? ""));
    return (Number.isFinite(left) ? left : 0) - (Number.isFinite(right) ? right : 0);
  });

  if (!sortedComments.length) {
    const empty = document.createElement("p");
    empty.className = "comments-empty";
    empty.textContent = "No comments yet.";
    wrap.replaceChildren(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const comment of sortedComments) {
    const article = document.createElement("article");
    article.className = "comment-item";

    const meta = document.createElement("p");
    meta.className = "comment-item__meta";
    const author = userName(comment.authorId);
    const created = comment.createdAt ? formatDate(comment.createdAt) : "-";
    meta.textContent = `${author} - ${created}`;

    const body = document.createElement("p");
    body.textContent = String(comment.content ?? "");

    article.append(meta, body);
    frag.append(article);
  }

  wrap.replaceChildren(frag);
}

async function refreshComments() {
  if (!ticketId) return;
  const comments = await ticketsApi.listComments(ticketId);
  currentComments = Array.isArray(comments) ? comments : [];
  renderComments(currentComments);
}

function renderTicket(ticket, comments) {
  currentTicket = ticket;
  currentComments = comments;

  byId("ticket-detail-id").textContent =
    ticket.id != null ? `Ticket #${ticket.id}` : "Ticket";
  byId("ticket-detail-title").textContent = String(ticket.title ?? "");
  byId("ticket-customer").textContent = String(ticket.customerName ?? "-");
  byId("ticket-email").textContent = String(ticket.customerEmail ?? "-");
  byId("ticket-category").textContent = String(ticket.category ?? "-");
  byId("ticket-created").textContent = ticket.createdAt
    ? formatDate(ticket.createdAt)
    : "-";
  byId("ticket-updated").textContent = ticket.updatedAt
    ? formatDate(ticket.updatedAt)
    : "-";
  byId("ticket-description").textContent = String(ticket.description ?? "");

  const status = byId("detail-status");
  const priority = byId("detail-priority");
  const assignee = byId("detail-assignee");
  if (status instanceof HTMLSelectElement) status.value = String(ticket.status ?? "open");
  if (priority instanceof HTMLSelectElement) priority.value = String(ticket.priority ?? "medium");
  if (assignee instanceof HTMLSelectElement) {
    assignee.value = ticket.assignedTo == null ? "" : String(ticket.assignedTo);
  }

  renderComments(comments);
}

async function updateTicketField(field, value) {
  if (!ticketId || !currentTicket) return;

  const previousValue = currentTicket[field];
  currentTicket[field] = value;

  try {
    const updated = await ticketsApi.updateTicket(ticketId, {
      [field]: value,
      updatedAt: new Date().toISOString(),
    });
    currentTicket = {
      ...currentTicket,
      ...(updated && typeof updated === "object" ? updated : {}),
    };
    toast("Ticket updated.");
  } catch (err) {
    currentTicket[field] = previousValue;
    renderTicket(currentTicket, currentComments);
    toast(err instanceof Error ? err.message : "Could not update ticket.", "error");
  }
}

function wireActions() {
  const status = byId("detail-status");
  const priority = byId("detail-priority");
  const assignee = byId("detail-assignee");
  const deleteBtn = byId("ticket-delete");
  const editBtn = byId("ticket-edit");
  const cancelEditBtn = byId("ticket-cancel-edit");
  const commentForm = byId("comment-form");
  const commentTextarea = byId("comment-content");
  const commentError = byId("comment-error");
  const commentSubmit = byId("comment-submit");

  if (status instanceof HTMLSelectElement) {
    status.addEventListener("change", () => {
      if (STATUS_OPTIONS.includes(status.value)) {
        void updateTicketField("status", status.value);
      }
    });
  }

  if (priority instanceof HTMLSelectElement) {
    priority.addEventListener("change", () => {
      if (PRIORITY_OPTIONS.includes(priority.value)) {
        void updateTicketField("priority", priority.value);
      }
    });
  }

  if (assignee instanceof HTMLSelectElement) {
    assignee.addEventListener("change", () => {
      const value = assignee.value === "" ? null : Number(assignee.value);
      void updateTicketField("assignedTo", value);
    });
  }

  if (deleteBtn instanceof HTMLButtonElement) {
    deleteBtn.addEventListener("click", async () => {
      const confirmed = await confirmDialog(
        "This ticket and its comments will be removed from the list."
      );
      if (!confirmed || !ticketId) return;

      const ticketsListUrl = new URL("./tickets.html", window.location.href).href;

      try {
        deleteBtn.disabled = true;
        saveDeleteRedirect(ticketsListUrl);
        showDeleteRedirectLoader();
        await Promise.all([
          ticketsApi.deleteTicket(ticketId).catch((err) => {
            if (!isNotFoundError(err)) throw err;
          }),
          wait(3000),
        ]);
        toast("Ticket deleted.");
        window.sessionStorage.removeItem(DELETE_REDIRECT_KEY);
        window.location.replace(ticketsListUrl);
      } catch (err) {
        deleteBtn.disabled = false;
        window.sessionStorage.removeItem(DELETE_REDIRECT_KEY);
        const loader = document.querySelector("#ticket-delete-loader");
        if (loader instanceof HTMLElement) loader.remove();
        toast(err instanceof Error ? err.message : "Could not delete ticket.", "error");
      }
    });
  }

  if (editBtn instanceof HTMLButtonElement) {
    editBtn.addEventListener("click", () => {
      setEditMode(!isEditMode);
    });
  }

  if (cancelEditBtn instanceof HTMLButtonElement) {
    cancelEditBtn.addEventListener("click", () => {
      if (currentTicket) renderTicket(currentTicket, currentComments);
      setEditMode(false);
    });
  }

  if (
    commentForm instanceof HTMLFormElement &&
    commentTextarea instanceof HTMLTextAreaElement &&
    commentSubmit instanceof HTMLButtonElement
  ) {
    commentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const content = commentTextarea.value.trim();
      if (commentError) commentError.textContent = "";

      if (content.length < 2) {
        if (commentError) commentError.textContent = "Comment must be at least 2 characters.";
        commentTextarea.setAttribute("aria-invalid", "true");
        return;
      }

      if (!ticketId) return;

      const user = authApi.getCurrentUser();
      const authorId =
        user && typeof user === "object" && "id" in user
          ? Number(user.id)
          : 1;

      try {
        commentTextarea.setAttribute("aria-invalid", "false");
        commentSubmit.disabled = true;
        showFullScreenLoader("Adding comment...");
        await ticketsApi.addComment({
          ticketId,
          authorId: Number.isFinite(authorId) ? authorId : 1,
          content,
        });
        await refreshComments();
        commentTextarea.value = "";
        toast("Comment added.");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not add comment.", "error");
      } finally {
        commentSubmit.disabled = false;
        hideFullScreenLoader();
      }
    });
  }
}

export async function initTicketDetail() {
  if (continueDeleteRedirectIfNeeded()) return;

  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    showError("Missing ticket id.");
    return;
  }

  ticketId = id;
  setLoading(true);
  wireActions();

  try {
    const [ticket, comments, userList] = await Promise.all([
      ticketsApi.getTicket(id),
      ticketsApi.listComments(id),
      usersApi.listUsers(),
    ]);

    users = Array.isArray(userList) ? userList : [];
    populateAssignees();
    renderTicket(ticket, Array.isArray(comments) ? comments : []);
    setEditMode(false);
    setLoading(false);
  } catch (err) {
    showError(err instanceof Error ? err.message : "Could not load ticket.");
  }
}
