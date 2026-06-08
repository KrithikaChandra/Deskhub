/**
 * Tickets list: filters, debounced search, server-side sort + pagination (json-server).
 */

import * as ticketsApi from "../api/tickets.js";
import * as usersApi from "../api/users.js";
import * as authApi from "../api/auth.js";
import { formatDate } from "../utils/formatDate.js";
import { debounce } from "../utils/debounce.js";
import { validators, validateField, validateForm } from "./form.js";
import { openModal, toast } from "./ui.js";

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
  sort: /** @type {"id" | "newest" | "priority" | "status"} */ ("id"),
};

const debouncedRefresh = debounce(() => {
  ticketsListState.page = 1;
  void refresh();
}, 300);

function syncOnlyMineFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const mine = params.get("mine");
  ticketsListState.onlyMine = mine === "1";
  ticketsListState.search = params.get("q") ?? "";
  ticketsListState.status = params.get("status") ?? "";
  ticketsListState.priority = params.get("priority") ?? "";
  const page = Number(params.get("page") ?? "1");
  ticketsListState.page = Number.isFinite(page) && page > 0 ? page : 1;

  const sort = params.get("sort");
  if (sort === "priority" || sort === "status" || sort === "id" || sort === "newest") {
    ticketsListState.sort = sort;
  }

  const assignee = params.get("assignee");
  ticketsListState.assigneeId =
    assignee && Number.isFinite(Number(assignee)) ? Number(assignee) : null;
}

function writeUrlState() {
  const params = new URLSearchParams();
  if (ticketsListState.search.trim()) params.set("q", ticketsListState.search.trim());
  if (ticketsListState.status) params.set("status", ticketsListState.status);
  if (ticketsListState.priority) params.set("priority", ticketsListState.priority);
  if (ticketsListState.sort !== "id") params.set("sort", ticketsListState.sort);
  if (ticketsListState.page > 1) params.set("page", String(ticketsListState.page));
  if (ticketsListState.onlyMine) {
    params.set("mine", "1");
  } else if (ticketsListState.assigneeId != null) {
    params.set("assignee", String(ticketsListState.assigneeId));
  }

  const qs = params.toString();
  const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  window.history.replaceState(null, "", nextUrl);
}

/** json-server `_sort` / `_order` (sort applies server-side with pagination). */
function serverSortParams() {
  const s = ticketsListState.sort;
  if (s === "newest") return { _sort: "createdAt", _order: "desc" };
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
let newTicketBtn = null;
let exportCsvBtn = null;

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

const createTicketSchema = {
  title: [
    validators.required("Title is required."),
    validators.minLength(5, "Title must be at least 5 characters."),
    validators.maxLength(120, "Title must be 120 characters or fewer."),
  ],
  description: [
    validators.required("Description is required."),
    validators.minLength(10, "Description must be at least 10 characters."),
    validators.maxLength(800, "Description must be 800 characters or fewer."),
  ],
  customerName: [
    validators.required("Customer name is required."),
    validators.maxLength(80, "Customer name must be 80 characters or fewer."),
  ],
  customerEmail: [
    validators.required("Customer email is required."),
    validators.email(),
  ],
  category: [
    validators.required("Category is required."),
    validators.oneOf(["auth", "billing", "bug", "feature"]),
  ],
  priority: [
    validators.required("Priority is required."),
    validators.oneOf(["low", "medium", "high", "urgent"]),
  ],
  status: [
    validators.required("Status is required."),
    validators.oneOf(["open", "in-progress", "resolved", "closed"]),
  ],
};

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
      ticketsListState.page = 1;
      writeUrlState();
      debouncedRefresh();
    });
  }

  if (statusSelectEl) {
    statusSelectEl.addEventListener("change", () => {
      ticketsListState.status = statusSelectEl.value;
      ticketsListState.page = 1;
      writeUrlState();
      void refresh();
    });
  }

  if (prioritySelectEl) {
    prioritySelectEl.addEventListener("change", () => {
      ticketsListState.priority = prioritySelectEl.value;
      ticketsListState.page = 1;
      writeUrlState();
      void refresh();
    });
  }

  if (assigneeSelectEl) {
    assigneeSelectEl.addEventListener("change", () => {
      const v = assigneeSelectEl.value;
      ticketsListState.assigneeId = v === "" ? null : Number(v);
      ticketsListState.page = 1;
      writeUrlState();
      void refresh();
    });
  }

  if (sortSelectEl) {
    sortSelectEl.addEventListener("change", () => {
      const v = sortSelectEl.value;
      if (v === "priority" || v === "status" || v === "id" || v === "newest") {
        ticketsListState.sort = v;
      }
      ticketsListState.page = 1;
      writeUrlState();
      void refresh();
    });
  }
}

function wirePagination() {
  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      if (ticketsListState.page <= 1) return;
      ticketsListState.page -= 1;
      writeUrlState();
      void refresh();
    });
  }
  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      ticketsListState.page += 1;
      writeUrlState();
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
        writeUrlState();
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
    tr.className = "tickets-table__row";
    tr.tabIndex = 0;
    tr.setAttribute("role", "link");
    tr.setAttribute("aria-label", `Open ticket ${t.id ?? ""}`);

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

    tr.addEventListener("click", () => {
      if (t.id != null) {
        window.location.href = new URL(
          `./ticket-detail.html?id=${encodeURIComponent(String(t.id))}`,
          window.location.href
        ).href;
      }
    });
    tr.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && t.id != null) {
        event.preventDefault();
        window.location.href = new URL(
          `./ticket-detail.html?id=${encodeURIComponent(String(t.id))}`,
          window.location.href
        ).href;
      }
    });

    frag.appendChild(tr);
  }

  tbodyEl.replaceChildren(frag);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function exportCurrentTicketsCsv() {
  if (!(exportCsvBtn instanceof HTMLButtonElement)) return;

  try {
    exportCsvBtn.disabled = true;
    await ensureUsersCached();
    const { items } = await ticketsApi.fetchTicketsPage({
      ...listFilterParams(),
      ...serverSortParams(),
      _page: 1,
      _limit: 10000,
    });

    if (!items.length) {
      toast("No tickets to export.", "error");
      return;
    }

    const header = [
      "ID",
      "Title",
      "Customer",
      "Customer Email",
      "Priority",
      "Status",
      "Assignee",
      "Category",
      "Created",
      "Updated",
    ];
    const lines = [
      header.map(csvCell).join(","),
      ...items.map((raw) => {
        const ticket = /** @type {Ticket & Record<string, unknown>} */ (raw);
        return [
          ticket.id,
          ticket.title,
          ticket.customerName,
          ticket.customerEmail,
          ticket.priority,
          ticket.status,
          assigneeLabel(ticket.assignedTo),
          ticket.category,
          ticket.createdAt,
          ticket.updatedAt,
        ].map(csvCell).join(",");
      }),
    ];

    downloadCsv(
      `deskhub-tickets-${new Date().toISOString().slice(0, 10)}.csv`,
      lines.join("\r\n")
    );
    toast("CSV exported.");
  } catch (err) {
    toast(err instanceof Error ? err.message : "Could not export CSV.", "error");
  } finally {
    exportCsvBtn.disabled = false;
  }
}

function createField({ label, name, type = "text", options, textarea = false }) {
  const group = document.createElement("div");
  group.className = "form-group";

  const labelEl = document.createElement("label");
  labelEl.setAttribute("for", `new-ticket-${name}`);
  labelEl.textContent = label;

  let field;
  if (options) {
    field = document.createElement("select");
    for (const optionInfo of options) {
      const option = document.createElement("option");
      option.value = optionInfo.value;
      option.textContent = optionInfo.label;
      field.appendChild(option);
    }
  } else if (textarea) {
    field = document.createElement("textarea");
    field.rows = 4;
  } else {
    field = document.createElement("input");
    field.type = type;
  }

  field.id = `new-ticket-${name}`;
  field.name = name;
  field.setAttribute("aria-describedby", `new-ticket-${name}-error`);

  const error = document.createElement("p");
  error.id = `new-ticket-${name}-error`;
  error.className = "field-error";
  error.setAttribute("role", "alert");

  group.append(labelEl, field, error);
  return group;
}

function setFieldError(form, name, message) {
  const field = form.elements.namedItem(name);
  const errorEl = form.querySelector(`#new-ticket-${name}-error`);
  if (
    !(field instanceof HTMLInputElement) &&
    !(field instanceof HTMLTextAreaElement) &&
    !(field instanceof HTMLSelectElement)
  ) {
    return;
  }

  field.setAttribute("aria-invalid", message ? "true" : "false");
  if (errorEl) errorEl.textContent = message;
}

function updateCreateSubmitState(form, submitBtn) {
  const result = validateForm(form, createTicketSchema);
  submitBtn.disabled = !result.isValid;
}

async function showCreateTicketModal() {
  try {
    await ensureUsersCached();
  } catch {
    toast("Could not load assignees. You can still create the ticket.", "error");
  }

  const assigneeOptions = [
    { value: "", label: "Unassigned" },
    ...[...(assigneeNameByUserId?.entries() ?? [])]
      .sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: "base" }))
      .map(([id, name]) => ({ value: String(id), label: name })),
  ];

  const form = document.createElement("form");
  form.className = "ticket-create-form";
  form.noValidate = true;

  form.append(
    createField({ label: "Title", name: "title" }),
    createField({ label: "Description", name: "description", textarea: true }),
    createField({ label: "Customer name", name: "customerName" }),
    createField({ label: "Customer email", name: "customerEmail", type: "email" }),
    createField({
      label: "Category",
      name: "category",
      options: [
        { value: "", label: "Choose category" },
        { value: "auth", label: "auth" },
        { value: "billing", label: "billing" },
        { value: "bug", label: "bug" },
        { value: "feature", label: "feature" },
      ],
    }),
    createField({
      label: "Priority",
      name: "priority",
      options: [
        { value: "medium", label: "medium" },
        { value: "low", label: "low" },
        { value: "high", label: "high" },
        { value: "urgent", label: "urgent" },
      ],
    }),
    createField({
      label: "Status",
      name: "status",
      options: [
        { value: "open", label: "open" },
        { value: "in-progress", label: "in-progress" },
        { value: "resolved", label: "resolved" },
        { value: "closed", label: "closed" },
      ],
    }),
    createField({
      label: "Assignee",
      name: "assignedTo",
      options: assigneeOptions,
    })
  );

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "button button--secondary";
  cancelBtn.textContent = "Cancel";

  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.className = "button";
  submitBtn.textContent = "Create Ticket";
  submitBtn.disabled = true;

  actions.append(cancelBtn, submitBtn);
  form.append(actions);

  const modal = openModal({ title: "New Ticket", content: form });
  cancelBtn.addEventListener("click", modal.close);

  for (const [name, rules] of Object.entries(createTicketSchema)) {
    const field = form.elements.namedItem(name);
    if (
      !(field instanceof HTMLInputElement) &&
      !(field instanceof HTMLTextAreaElement) &&
      !(field instanceof HTMLSelectElement)
    ) {
      continue;
    }

    field.addEventListener("blur", () => {
      setFieldError(form, name, validateField(field, rules));
      updateCreateSubmitState(form, submitBtn);
    });
    field.addEventListener("change", () => {
      updateCreateSubmitState(form, submitBtn);
    });
    field.addEventListener("input", () => {
      updateCreateSubmitState(form, submitBtn);
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = validateForm(form, createTicketSchema);
    for (const [name] of Object.entries(createTicketSchema)) {
      setFieldError(form, name, result.errors[name] ?? "");
    }
    submitBtn.disabled = !result.isValid;
    if (!result.isValid) return;

    const data = new FormData(form);
    const now = new Date().toISOString();
    const rawAssignee = String(data.get("assignedTo") ?? "");
    const assignedTo = rawAssignee === "" ? null : Number(rawAssignee);
    const ticket = {
      title: String(data.get("title") ?? "").trim(),
      description: String(data.get("description") ?? "").trim(),
      customerName: String(data.get("customerName") ?? "").trim(),
      customerEmail: String(data.get("customerEmail") ?? "").trim(),
      category: String(data.get("category") ?? ""),
      priority: String(data.get("priority") ?? "medium"),
      status: String(data.get("status") ?? "open"),
      assignedTo: Number.isFinite(assignedTo) ? assignedTo : null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      submitBtn.disabled = true;
      await ticketsApi.createTicket(ticket);
      modal.close();
      ticketsListState.page = 1;
      writeUrlState();
      await refresh();
      toast("Ticket created.");
    } catch (err) {
      submitBtn.disabled = false;
      toast(err instanceof Error ? err.message : "Could not create ticket.", "error");
    }
  });
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
      writeUrlState();
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
  newTicketBtn = document.querySelector("#new-ticket-button");
  exportCsvBtn = document.querySelector("#tickets-export-csv");

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
  if (newTicketBtn instanceof HTMLButtonElement) {
    newTicketBtn.addEventListener("click", showCreateTicketModal);
  }
  if (exportCsvBtn instanceof HTMLButtonElement) {
    exportCsvBtn.addEventListener("click", () => {
      void exportCurrentTicketsCsv();
    });
  }

  void bootstrap();
}
