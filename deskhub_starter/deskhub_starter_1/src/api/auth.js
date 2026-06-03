import * as client from "./client.js";
import * as storage from "../utils/storage.js";

// Logical keys (storage.js adds the "deskhub:" prefix automatically).
const TOKEN_KEY = "token";
const USER_KEY = "user";

/** Opaque session id for this tab/device (not a real JWT; fine for the course). */
function makeSessionToken(userId) {
  const suffix =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now());
  return `deskhub-session-${userId}-${suffix}`;
}

export async function login(email, password) {
  const query = new URLSearchParams({ email, password }).toString();
  const users = /** @type {any} */ (await client.get(`/users?${query}`));

  if (!Array.isArray(users) || users.length !== 1) {
    throw new Error("Invalid email or password.");
  }

  const raw = users[0];
  const user = {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    role: raw.role,
  };

  const token = makeSessionToken(user.id);
  storage.set(TOKEN_KEY, token);
  storage.set(USER_KEY, user);

  return { token, user };
}

/** Clear saved session so isAuthenticated() becomes false. */
export function logout() {
  storage.remove(TOKEN_KEY);
  storage.remove(USER_KEY);
}

/** Who is logged in? null if missing or never logged in. */
export function getCurrentUser() {
  return storage.get(USER_KEY);
}

/** True if we still have a token (simple check for "has session"). */
export function isAuthenticated() {
  return Boolean(storage.get(TOKEN_KEY));
}
