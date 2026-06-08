const DEFAULT_BASE_URL = "http://localhost:3001";
const configuredBaseUrl =
  typeof window !== "undefined" && window.DESKHUB_API_BASE_URL
    ? String(window.DESKHUB_API_BASE_URL).replace(/\/$/, "")
    : "";
const BASE_URL = configuredBaseUrl || DEFAULT_BASE_URL;

let staticDbPromise = null;
const STATIC_DB_KEY = "deskhub:static-db";

function shouldUseStaticData() {
  if (configuredBaseUrl || typeof window === "undefined") return false;
  return !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

async function loadStaticDb() {
  if (!staticDbPromise) {
    staticDbPromise = fetch(new URL("../db.json", import.meta.url)).then(
      async (response) => {
        if (!response.ok) {
          throw new Error("Could not load local data.");
        }
        const db = await response.json();
        const saved = window.localStorage.getItem(STATIC_DB_KEY);
        if (!saved) return db;

        try {
          return JSON.parse(saved);
        } catch {
          window.localStorage.removeItem(STATIC_DB_KEY);
          return db;
        }
      }
    );
  }
  return staticDbPromise;
}

function saveStaticDb(db) {
  window.localStorage.setItem(STATIC_DB_KEY, JSON.stringify(db));
}

function parseStaticPath(path) {
  const url = new URL(path, window.location.href);
  const [, collection, rawId] = url.pathname.match(/\/?([^/]+)\/?([^/]*)/) || [];
  return { url, collection, rawId };
}

function matchesQuery(item, key, value) {
  if (key === "q") {
    const needle = value.toLowerCase();
    return Object.values(item).some((field) =>
      String(field ?? "").toLowerCase().includes(needle)
    );
  }
  return String(item[key] ?? "") === value;
}

function applyStaticQuery(rows, searchParams) {
  let items = [...rows];

  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("_")) continue;
    items = items.filter((item) => matchesQuery(item, key, value));
  }

  const sortKey = searchParams.get("_sort");
  const sortOrder = searchParams.get("_order") === "desc" ? -1 : 1;
  if (sortKey) {
    items.sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      if (left == null && right == null) return 0;
      if (left == null) return -1 * sortOrder;
      if (right == null) return 1 * sortOrder;
      return String(left).localeCompare(String(right), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * sortOrder;
    });
  }

  const totalCount = items.length;
  const page = Number(searchParams.get("_page"));
  const limit = Number(searchParams.get("_limit"));
  if (Number.isFinite(page) && Number.isFinite(limit) && page > 0 && limit > 0) {
    const start = (page - 1) * limit;
    items = items.slice(start, start + limit);
  }

  return { items, totalCount };
}

async function staticGet(path) {
  const db = await loadStaticDb();
  const { url, collection, rawId } = parseStaticPath(path);
  const rows = Array.isArray(db[collection]) ? db[collection] : null;

  if (!rows) {
    throw new Error(`Unknown collection: ${collection}`);
  }

  if (rawId) {
    const item = rows.find((row) => String(row.id) === decodeURIComponent(rawId));
    if (!item) throw new Error("Not found");
    return { data: item, headers: new Headers({ "X-Total-Count": "1" }) };
  }

  const { items, totalCount } = applyStaticQuery(rows, url.searchParams);
  return {
    data: items,
    headers: new Headers({ "X-Total-Count": String(totalCount) }),
  };
}

async function staticRequest(path, options = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  if (method === "GET") {
    return staticGet(path);
  }

  const db = await loadStaticDb();
  const { collection, rawId } = parseStaticPath(path);
  const rows = Array.isArray(db[collection]) ? db[collection] : null;
  if (!rows) {
    throw new Error(`Unknown collection: ${collection}`);
  }

  const body =
    typeof options.body === "string" && options.body
      ? JSON.parse(options.body)
      : {};

  if (method === "POST") {
    const maxId = rows.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
    const created = { ...body, id: maxId + 1 };
    rows.push(created);
    saveStaticDb(db);
    return { data: created, headers: new Headers({ "X-Total-Count": "1" }) };
  }

  if (!rawId) {
    throw new Error("Missing item id.");
  }

  const index = rows.findIndex((item) => String(item.id) === decodeURIComponent(rawId));
  if (index === -1) {
    throw new Error("Not found");
  }

  if (method === "PATCH") {
    rows[index] = { ...rows[index], ...body };
    saveStaticDb(db);
    return { data: rows[index], headers: new Headers({ "X-Total-Count": "1" }) };
  }

  if (method === "DELETE") {
    const [deleted] = rows.splice(index, 1);
    if (collection === "tickets" && Array.isArray(db.comments)) {
      db.comments = db.comments.filter(
        (comment) => String(comment.ticketId) !== decodeURIComponent(rawId)
      );
    }
    saveStaticDb(db);
    return { data: deleted, headers: new Headers({ "X-Total-Count": "1" }) };
  }

  throw new Error(`Unsupported method: ${method}`);
}

async function fetchFromApi(path, options = {}) {
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

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "message" in data
        ? String(data.message)
        : response.statusText || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return { data, headers: response.headers };
}

/**
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<unknown>}
 */
export async function request(path, options = {}) {
  if (shouldUseStaticData()) {
    const { data } = await staticRequest(path, options);
    return data;
  }

  const { data } = await fetchFromApi(path, options);
  return data;
}

/**
 * GET that exposes response headers (e.g. json-server `X-Total-Count` when using `_page` / `_limit`).
 * @param {string} path
 * @returns {Promise<{ data: unknown, headers: Headers }>}
 */
export async function getWithHeaders(path) {
  if (shouldUseStaticData()) {
    return staticRequest(path, { method: "GET" });
  }

  return fetchFromApi(path, { method: "GET" });
}

/**
 * GET shorthand, e.g. get("/tickets")
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
