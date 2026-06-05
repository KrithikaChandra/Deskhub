/**
 * Build a URL query string from a plain object. Omits empty values:
 * `undefined`, `null`, `""`, and strings that are only whitespace.
 *
 * @param {Record<string, string | number | boolean | null | undefined>} state
 * @returns {string} `?key=value&...` or `""` when nothing to send
 */
export function buildQueryString(state) {
  if (!state || typeof state !== "object") return "";
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
