// json-server base URL (same machine, different port than the static site).
const BASE_URL = "http://localhost:3001";

/**
 * Core request helper used by get/post/patch/del.
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<unknown>}
 */
export async function request(path, options = {}) {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const headers = { ...options.headers };
  if (
    options.body !== undefined &&
    !headers["Content-Type"] &&
    !headers["content-type"]
  ) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  // Non-2xx: turn into a thrown Error (fetch alone would not throw).
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "message" in data
        ? String(data.message)
        : response.statusText || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

/**
 * GET shorthand — e.g. get("/tickets")
 * @param {string} path
 * @returns {Promise<unknown>}
 */
export function get(path) {
  return request(path, { method: "GET" });
}

/**
 * POST with optional JSON body
 * @param {string} path
 * @param {unknown} [body]
 * @returns {Promise<unknown>}
 */
export function post(path, body) {
  return request(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * PATCH with optional JSON body
 * @param {string} path
 * @param {unknown} [body]
 * @returns {Promise<unknown>}
 */
export function patch(path, body) {
  return request(path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE shorthand
 * @param {string} path
 * @returns {Promise<unknown>}
 */
export function del(path) {
  return request(path, { method: "DELETE" });
}
