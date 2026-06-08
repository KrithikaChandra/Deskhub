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
