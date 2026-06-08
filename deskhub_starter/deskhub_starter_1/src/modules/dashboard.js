import * as authApi from "../api/auth.js";
import * as ticketsApi from "../api/tickets.js";
import { formatDate } from "../utils/formatDate.js";
import { hideFullScreenLoader, showFullScreenLoader, toast } from "./ui.js";

function byId(id) {
  return document.querySelector(`#${id}`);
}

function setStat(id, value) {
  const el = byId(id);
  if (el) el.textContent = String(value);
}

function renderRecentTickets(tickets) {
  const list = byId("recent-tickets-list");
  const empty = byId("recent-tickets-empty");
  if (!list || !empty) return;

  if (!tickets.length) {
    list.replaceChildren();
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  const frag = document.createDocumentFragment();

  for (const raw of tickets) {
    const ticket = raw && typeof raw === "object" ? raw : {};
    const link = document.createElement("a");
    link.className = "recent-ticket";
    link.href = `./ticket-detail.html?id=${encodeURIComponent(String(ticket.id))}`;

    const main = document.createElement("span");
    main.className = "recent-ticket__main";

    const title = document.createElement("strong");
    title.textContent = String(ticket.title ?? "Untitled ticket");

    const meta = document.createElement("span");
    meta.textContent = `${String(ticket.customerName ?? "Unknown customer")} · ${
      ticket.createdAt ? formatDate(ticket.createdAt) : "-"
    }`;

    const badge = document.createElement("span");
    badge.className = `status-badge status-badge--${String(ticket.status ?? "open")}`;
    badge.textContent = String(ticket.status ?? "open");

    main.append(title, meta);
    link.append(main, badge);
    frag.append(link);
  }

  list.replaceChildren(frag);
}

async function loadDashboard() {
  showFullScreenLoader("Loading dashboard...");
  try {
    const [total, open, inProgress, resolved, recent] = await Promise.all([
      ticketsApi.countTickets(),
      ticketsApi.countTickets({ status: "open" }),
      ticketsApi.countTickets({ status: "in-progress" }),
      ticketsApi.countTickets({ status: "resolved" }),
      ticketsApi.fetchTicketsPage({
        _sort: "createdAt",
        _order: "desc",
        _page: 1,
        _limit: 5,
      }),
    ]);

    setStat("stat-total", total);
    setStat("stat-open", open);
    setStat("stat-in-progress", inProgress);
    setStat("stat-resolved", resolved);
    renderRecentTickets(recent.items);
  } catch (err) {
    toast(err instanceof Error ? err.message : "Could not load dashboard.", "error");
  } finally {
    hideFullScreenLoader();
  }
}

export function initDashboardPage() {
  const logoutBtn = document.querySelector("#logout-button");
  if (logoutBtn instanceof HTMLButtonElement) {
    logoutBtn.addEventListener("click", () => {
      authApi.logout();
      window.location.href = new URL("./index.html", window.location.href).href;
    });
  }

  void loadDashboard();
}
