/**
 * Ticket and comment API (json-server on port 3001).
 * Paths match the `tickets` and `comments` collections in `src/db.json`.
 */

import * as client from "./client.js";
import { buildQueryString } from "../utils/buildQueryString.js";

/**
 * List tickets (no header metadata). Uses `buildQueryString` for the query.
 * @param {Record<string, string | number | boolean | null | undefined>} [params]
 * @returns {Promise<unknown[]>}
 */
export async function listTickets(params) {
  const qs = buildQueryString(params ?? {});
  const data = await client.get(`/tickets${qs}`);
  return Array.isArray(data) ? data : [];
}

/**
 * Paginated list with total count from `X-Total-Count` (json-server + `_page` / `_limit`).
 * @param {Record<string, string | number | boolean | null | undefined>} params
 * @returns {Promise<{ items: unknown[], totalCount: number }>}
 */
export async function fetchTicketsPage(params) {
  const qs = buildQueryString(params);
  const { data, headers } = await client.getWithHeaders(`/tickets${qs}`);
  const raw =
    headers.get("X-Total-Count") ?? headers.get("x-total-count") ?? "0";
  const totalCount = Number.parseInt(String(raw), 10);
  const items = Array.isArray(data) ? data : [];
  return {
    items,
    totalCount: Number.isFinite(totalCount) ? totalCount : 0,
  };
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
