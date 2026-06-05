/**
 * Users collection (json-server). Used for assignee name lookup — fetch once per session.
 */

import * as client from "./client.js";

/** @returns {Promise<unknown[]>} */
export async function listUsers() {
  const data = await client.get("/users");
  return Array.isArray(data) ? data : [];
}
