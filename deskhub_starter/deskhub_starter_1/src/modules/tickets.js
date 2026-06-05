/**
 * Tickets list: filters, debounced search, server-side sort + pagination (json-server).
 */

import * as ticketsApi from "../api/tickets.js";
import * as usersApi from "../api/users.js";
import * as authApi from "../api/auth.js";
import { formatDate } from "../utils/formatDate.js";
import { debounce } from "../utils/debounce.js";

/** @typedef {{ id?: number, title?: string, status?: string, priority?: string, customerName?: string, assignedTo?: number | null, createdAt?: string }} Ticket */

const PAGE_SIZE = 10;

export const ticketsListState = {
  search: "",
  status: "",
  priority: "",
  category: "",
  page: 1,
  onlyMine: false,
  assigneeId: /** @type {number | null} */ (null),
  sort: /** @type {"id" | "priority" | "status"} */ ("id"),
};

const debouncedRefresh = debounce(() => {
  ticketsListState.page = 1;
  void refresh();
}, 300);

function syncOnlyMineFromUrl() {
  const mine = new URLSearchParams(window.location.search).get("mine");
  ticketsListState.onlyMine = mine === "1";
}

/** json-server `_sort` / `_order` (sort applies server-side with pagination). */
function serverSortParams() {
  const s = ticketsListState.sort;
  if (s === "priority") return { _sort: "priority", _order: "asc" };
  if (s === "status") return { _sort: "status", _order: "asc" };
  return { _sort: "id", _order: "asc" };
}

/** Filter fields only (no pagination / sort). */
function listFilterParams() {
  /** @type {Record<string, string | number>} */
  const query = {};

  const q = ticketsListState.search.trim();
  if (q) query.q = q;

  if (ticketsListState.status) query.status = ticketsListState.status;
  if (ticketsListState.priority) query.priority = ticketsListState.priority;
  if (ticketsListState.category) query.category = ticketsListState.category;

  if (ticketsListState.onlyMine) {
    const user = authApi.getCurrentUser();
    if (user && typeof user === "object" && "id" in user) {
      const id = Number(/** @type {{ id: unknown }} */ (user).id);
      if (Number.isFinite(id)) query.assignedTo = id;
    }
  } else if (
    ticketsListState.assigneeId != null &&
    Number.isFinite(ticketsListState.assigneeId)
  ) {
    query.assignedTo = ticketsListState.assigneeId;
  }

  return query;
}

/** Full request params for `fetchTicketsPage` (filters + sort + page size). */
function listApiParams() {
  return {
    ...listFilterParams(),
    ...serverSortParams(),
    _page: ticketsListState.page,
    _limit: PAGE_SIZE,
  };
}

let assigneeNameByUserId = /** @type {Map<number, string> | null} */ (null);

let searchInputEl = null;
let statusSelectEl = null;
let prioritySelectEl = null;
let assigneeSelectEl = null;
let sortSelectEl = null;

let tbodyEl = null;
let tableWrapEl = null;
let loadingEl = null;
let errorWrapEl = null;
let errorMessageEl = null;
let retryBtn = null;
let emptyEl = null;

let paginationEl = null;
let prevPageBtn = null;
let nextPageBtn = null;
let pageNumbersEl = null;

async function ensureUsersCached() {
  if (assigneeNameByUserId !== null) return;

  const users = await usersApi.listUsers();
  const map = new Map();
  for (const u of users) {
    if (u && typeof u === "object" && "id" in u) {
      const id = Number(/** @type {{ id: number }} */ (u).id);
      const name = String(
        "name" in u && u.name != null ? u.name : `User #${id}`
      );
      map.set(id, name);
    }
  }
  assigneeNameByUserId = map;
}

function assigneeLabel(assignedTo) {
  if (assignedTo == null) return "—";
  const id = Number(assignedTo);
  if (Number.isNaN(id)) return "—";
  const name = assigneeNameByUserId?.get(id);
  return name ?? `User #${id}`;
}

function populateAssigneeDropdown() {
  const sel = assigneeSelectEl;
  const map = assigneeNameByUserId;
  if (!sel || !map) return;
  if (sel.options.length > 1) return;

  const prev =
    ticketsListState.assigneeId != null
      ? String(ticketsListState.assigneeId)
      : "";

  sel.replaceChildren();
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "All";
  sel.appendChild(optAll);

  const entries = [...map.entries()].sort((a, b) =>
    a[1].localeCompare(b[1], undefined, { sensitivity: "base" })
  );
  for (const [id, name] of entries) {
    const opt = document.createElement("option");
    opt.value = String(id);
    opt.textContent = name;
    sel.appendChild(opt);
  }

  if (prev && [...map.keys()].map(String).includes(prev)) {
    sel.value = prev;
  } else {
    sel.value = "";
    ticketsListState.assigneeId = null;
  }
}

function updateAssigneeControlDisabled() {
  if (!assigneeSelectEl) return;
  assigneeSelectEl.disabled = ticketsListState.onlyMine;
  assigneeSelectEl.title = ticketsListState.onlyMine
    ? "Showing only your tickets (from dashboard link)."
    : "";
}

function syncToolbarDomFromState() {
  if (searchInputEl) searchInputEl.value = ticketsListState.search;
  if (statusSelectEl)
    statusSelectEl.value = ticketsListState.status || "";
  if (prioritySelectEl)
    prioritySelectEl.value = ticketsListState.priority || "";
  if (sortSelectEl) sortSelectEl.value = ticketsListState.sort;
  if (assigneeSelectEl && !ticketsListState.onlyMine) {
    assigneeSelectEl.value =
      ticketsListState.assigneeId != null
        ? String(ticketsListState.assigneeId)
        : "";
  }
  updateAssigneeControlDisabled();
}

function wireToolbar() {
  if (searchInputEl) {
    searchInputEl.addEventListener("input", () => {
      ticketsListState.search = searchInputEl.value;
      debouncedRefresh();
    });
  }

  if (statusSelectEl) {
    statusSelectEl.addEventListener("change", () => {
      ticketsListState.status = statusSelectEl.value;
      ticketsListState.page = 1;
      void refresh();
    });
  }

  if (prioritySelectEl) {
    prioritySelectEl.addEventListener("change", () => {
      ticketsListState.priority = prioritySelectEl.value;
      ticketsListState.page = 1;
      void refresh();
    });
  }

  if (assigneeSelectEl) {
    assigneeSelectEl.addEventListener("change", () => {
      const v = assigneeSelectEl.value;
      ticketsListState.assigneeId = v === "" ? null : Number(v);
      ticketsListState.page = 1;
      void refresh();
    });
  }

  if (sortSelectEl) {
    sortSelectEl.addEventListener("change", () => {
      const v = sortSelectEl.value;
      if (v === "priority" || v === "status" || v === "id") {
        ticketsListState.sort = v;
      }
      ticketsListState.page = 1;
      void refresh();
    });
  }
}

function wirePagination() {
  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      if (ticketsListState.page <= 1) return;
      ticketsListState.page -= 1;
      void refresh();
    });
  }
  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      ticketsListState.page += 1;
      void refresh();
    });
  }
}

/**
 * @param {{ loading: boolean, error: string | null, empty: boolean, table: boolean, hidePagination?: boolean }} s
 */
function setViewState(s) {
  if (loadingEl) loadingEl.hidden = !s.loading;
  if (errorWrapEl) errorWrapEl.hidden = s.error == null;
  if (errorMessageEl && s.error != null) errorMessageEl.textContent = s.error;
  if (emptyEl) emptyEl.hidden = !s.empty;
  if (tableWrapEl) tableWrapEl.hidden = !s.table;
  if (paginationEl) {
    paginationEl.hidden = !s.table || Boolean(s.hidePagination);
  }
}

/**
 * @param {number} totalCount from `X-Total-Count`
 */
function renderPagination(totalCount) {
  if (!paginationEl || !prevPageBtn || !nextPageBtn || !pageNumbersEl) return;

  const totalPages =
    totalCount === 0 ? 1 : Math.ceil(totalCount / PAGE_SIZE);
  const page = Math.min(
    Math.max(1, ticketsListState.page),
    totalPages
  );
  ticketsListState.page = page;

  prevPageBtn.disabled = page <= 1;
  nextPageBtn.disabled = page >= totalPages;

  pageNumbersEl.replaceChildren();
  for (let p = 1; p <= totalPages; p += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "tickets-page-num" + (p === page ? " is-current" : "");
    btn.textContent = String(p);
    btn.setAttribute("aria-label", `Page ${p}`);
    if (p === page) btn.setAttribute("aria-current", "page");
    btn.addEventListener("click", () => {
      if (ticketsListState.page !== p) {
        ticketsListState.page = p;
        void refresh();
      }
    });
    pageNumbersEl.appendChild(btn);
  }
}

/**
 * @param {unknown[]} tickets
 */
export function renderTable(tickets) {
  if (!tbodyEl) return;

  const frag = document.createDocumentFragment();

  for (const raw of tickets) {
    const t = /** @type {Ticket} */ (raw);
    const tr = document.createElement("tr");

    const tdId = document.createElement("td");
    tdId.textContent = t.id != null ? String(t.id) : "—";

    const tdTitle = document.createElement("td");
    tdTitle.textContent = String(t.title ?? "");

    const tdCustomer = document.createElement("td");
    tdCustomer.textContent = String(t.customerName ?? "—");

    const tdPriority = document.createElement("td");
    tdPriority.textContent = String(t.priority ?? "—");

    const tdStatus = document.createElement("td");
    tdStatus.textContent = String(t.status ?? "—");

    const tdAssignee = document.createElement("td");
    tdAssignee.textContent = assigneeLabel(t.assignedTo);

    const tdCreated = document.createElement("td");
    tdCreated.textContent = t.createdAt ? formatDate(t.createdAt) : "—";

    tr.append(
      tdId,
      tdTitle,
      tdCustomer,
      tdPriority,
      tdStatus,
      tdAssignee,
      tdCreated
    );
    frag.appendChild(tr);
  }

  tbodyEl.replaceChildren(frag);
}

function friendlyFetchError(err) {
  if (err instanceof TypeError && err.message === "Failed to fetch") {
    return "Cannot reach the server. Is json-server running on port 3001?";
  }
  return err instanceof Error ? err.message : "Could not load tickets.";
}

/**
 * Load users (once), then a page of tickets; read total from `X-Total-Count`.
 */
export async function refresh() {
  if (
    !tbodyEl ||
    !tableWrapEl ||
    !loadingEl ||
    !errorWrapEl ||
    !emptyEl
  ) {
    return;
  }

  setViewState({
    loading: true,
    error: null,
    empty: false,
    table: false,
    hidePagination: true,
  });

  try {
    await ensureUsersCached();
    populateAssigneeDropdown();
    updateAssigneeControlDisabled();

    let params = listApiParams();
    let { items, totalCount } = await ticketsApi.fetchTicketsPage(params);

    const totalPages =
      totalCount === 0 ? 1 : Math.ceil(totalCount / PAGE_SIZE);
    const pageTooHigh = ticketsListState.page > totalPages;
    const emptyButCount =
      items.length === 0 && totalCount > 0 && ticketsListState.page > 1;

    if (pageTooHigh || emptyButCount) {
      ticketsListState.page = Math.min(
        Math.max(1, ticketsListState.page),
        totalPages
      );
      params = listApiParams();
      ({ items, totalCount } = await ticketsApi.fetchTicketsPage(params));
    }

    if (totalCount === 0) {
      renderTable([]);
      renderPagination(0);
      setViewState({
        loading: false,
        error: null,
        empty: true,
        table: false,
        hidePagination: true,
      });
      return;
    }

    renderTable(items);
    renderPagination(totalCount);
    setViewState({
      loading: false,
      error: null,
      empty: false,
      table: true,
      hidePagination: false,
    });
  } catch (err) {
    renderTable([]);
    setViewState({
      loading: false,
      error: friendlyFetchError(err),
      empty: false,
      table: false,
      hidePagination: true,
    });
  }
}

async function bootstrap() {
  syncOnlyMineFromUrl();
  syncToolbarDomFromState();
  wireToolbar();
  wirePagination();

  try {
    await ensureUsersCached();
    populateAssigneeDropdown();
  } catch {
    /* users failed; refresh will surface error */
  }
  updateAssigneeControlDisabled();
  await refresh();
}

export function initTicketsList() {
  searchInputEl = document.querySelector("#ticket-search");
  statusSelectEl = document.querySelector("#ticket-status");
  prioritySelectEl = document.querySelector("#ticket-priority");
  assigneeSelectEl = document.querySelector("#ticket-assignee");
  sortSelectEl = document.querySelector("#ticket-sort");

  tbodyEl = document.querySelector("#tickets-tbody");
  tableWrapEl = document.querySelector("#tickets-table-wrap");
  loadingEl = document.querySelector("#tickets-loading");
  errorWrapEl = document.querySelector("#tickets-error-wrap");
  errorMessageEl = document.querySelector("#tickets-error-message");
  retryBtn = document.querySelector("#tickets-retry");
  emptyEl = document.querySelector("#tickets-empty");

  paginationEl = document.querySelector("#tickets-pagination");
  prevPageBtn = document.querySelector("#tickets-page-prev");
  nextPageBtn = document.querySelector("#tickets-page-next");
  pageNumbersEl = document.querySelector("#tickets-page-numbers");

  if (
    !tbodyEl ||
    !tableWrapEl ||
    !loadingEl ||
    !errorWrapEl ||
    !errorMessageEl ||
    !emptyEl ||
    !(retryBtn instanceof HTMLButtonElement) ||
    !paginationEl ||
    !(prevPageBtn instanceof HTMLButtonElement) ||
    !(nextPageBtn instanceof HTMLButtonElement) ||
    !pageNumbersEl
  ) {
    return;
  }

  retryBtn.addEventListener("click", () => {
    void refresh();
  });

  void bootstrap();
}
