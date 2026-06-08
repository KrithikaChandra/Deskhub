/**
 * Ticket and comment API (json-server on port 3001).
 * Paths match the `tickets` and `comments` collections in `src/db.json`.
 */

import * as client from "./client.js";
import { buildQueryString } from "../utils/buildQueryString.js";

function matchesFilter(item, key, value) {
  if (value == null || value === "") return true;
  if (key === "q") {
    const needle = String(value).toLowerCase();
    return Object.values(item).some((field) =>
      String(field == null ? "" : field).toLowerCase().includes(needle)
    );
  }
  return String(item[key]) === String(value);
}

/**
 * List tickets. Filtering is applied client-side for predictable behavior
 * across local json-server and static deployments.
 * @param {Record<string, string | number | boolean | null | undefined>} [params]
 * @returns {Promise<unknown[]>}
 */
export async function listTickets(params) {
  const data = await client.get("/tickets");
  const items = Array.isArray(data) ? data : [];
  const filters = params || {};
  return items.filter((item) =>
    Object.entries(filters).every(([key, value]) =>
      matchesFilter(item, key, value)
    )
  );
}

function compareTickets(left, right, sortKey, order) {
  const direction = order === "desc" ? -1 : 1;
  const a = left && typeof left === "object" ? left[sortKey] : undefined;
  const b = right && typeof right === "object" ? right[sortKey] : undefined;
  if (a == null && b == null) return 0;
  if (a == null) return -1 * direction;
  if (b == null) return 1 * direction;
  return (
    String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: "base",
    }) * direction
  );
}

/**
 * Paginated list. Filters use json-server where possible; sort/page are applied
 * in the client because some local json-server setups treat `_page` and `_sort`
 * as normal filters when mounted behind Express.
 * @param {Record<string, string | number | boolean | null | undefined>} params
 * @returns {Promise<{ items: unknown[], totalCount: number }>}
 */
export async function fetchTicketsPage(params) {
  const filterParams = Object.fromEntries(
    Object.entries(params).filter(([key]) => !key.startsWith("_"))
  );
  const allItems = await listTickets(filterParams);
  const sortKey = String(params._sort == null ? "id" : params._sort);
  const order = String(params._order == null ? "asc" : params._order);
  const page = Number(params._page == null ? 1 : params._page);
  const rawLimit = params._limit == null ? allItems.length || 1 : params._limit;
  const limit = Number(rawLimit);

  const sortedItems = [...allItems].sort((a, b) =>
    compareTickets(a, b, sortKey, order)
  );
  const totalCount = sortedItems.length;
  const start = Math.max(0, page - 1) * limit;
  const items = sortedItems.slice(start, start + limit);

  return {
    items,
    totalCount,
  };
}

/**
 * Count tickets. Prefer `X-Total-Count` when the backend exposes it; fall back
 * to the filtered list length for local/static compatibility.
 * @param {Record<string, string | number | boolean | null | undefined>} [params]
 * @returns {Promise<number>}
 */
export async function countTickets(params) {
  const qs = buildQueryString(params ?? {});
  const { data, headers } = await client.getWithHeaders(`/tickets${qs}`);
  const raw =
    headers.get("X-Total-Count") ?? headers.get("x-total-count") ?? "";
  const headerCount = Number.parseInt(String(raw), 10);

  if (Number.isFinite(headerCount)) {
    return headerCount;
  }

  if (Array.isArray(data)) {
    return data.filter((item) =>
      Object.entries(params || {}).every(([key, value]) =>
        matchesFilter(item, key, value)
      )
    ).length;
  }

  return 0;
}

/**
 * Fetch a single ticket by id.
 * @param {number | string} id
 * @returns {Promise<unknown>}
 */
export function getTicket(id) {
  return client.get(`/tickets/${encodeURIComponent(String(id))}`);
}

/**
 * Create a ticket (json-server assigns `id` if omitted).
 * @param {Record<string, unknown>} ticket
 * @returns {Promise<unknown>}
 */
export function createTicket(ticket) {
  return client.post("/tickets", ticket);
}

/**
 * Partial update (PATCH) for an existing ticket.
 * @param {number | string} id
 * @param {Record<string, unknown>} patch
 * @returns {Promise<unknown>}
 */
export function updateTicket(id, patch) {
  return client.patch(
    `/tickets/${encodeURIComponent(String(id))}`,
    patch
  );
}

/**
 * Delete a ticket by id.
 * @param {number | string} id
 * @returns {Promise<unknown>}
 */
export function deleteTicket(id) {
  return client.del(`/tickets/${encodeURIComponent(String(id))}`);
}

/**
 * Comments for one ticket (`ticketId` in db.json).
 * @param {number | string} ticketId
 * @returns {Promise<unknown[]>}
 */
export async function listComments(ticketId) {
  const qs = buildQueryString({ ticketId });
  const data = await client.get(`/comments${qs}`);
  return Array.isArray(data) ? data : [];
}

/**
 * Add a comment on a ticket. `id` is assigned by json-server if omitted.
 * @param {{ ticketId: number | string, authorId: number | string, content: string, createdAt?: string }} input
 * @returns {Promise<unknown>}
 */
export function addComment(input) {
  const body = {
    ticketId:
      typeof input.ticketId === "string"
        ? Number(input.ticketId)
        : input.ticketId,
    authorId:
      typeof input.authorId === "string"
        ? Number(input.authorId)
        : input.authorId,
    content: input.content,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  return client.post("/comments", body);
}
