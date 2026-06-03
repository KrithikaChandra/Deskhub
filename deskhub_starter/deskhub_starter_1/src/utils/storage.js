// Every key we store becomes e.g. "deskhub:token", not plain "token".
const PREFIX = "deskhub:";

function namespacedKey(key) {
  return `${PREFIX}${key}`;
}

/**
 * @param {string} key
 * @returns {unknown}
 */
export function get(key) {
  const raw = localStorage.getItem(namespacedKey(key));
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * @param {string} key
 * @param {unknown} value
 */
export function set(key, value) {
  localStorage.setItem(namespacedKey(key), JSON.stringify(value));
}

/**
 * Remove one namespaced key (e.g. only token, or only user).
 * @param {string} key
 */
export function remove(key) {
  localStorage.removeItem(namespacedKey(key));
}

export function clear() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keysToRemove.push(k);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}
