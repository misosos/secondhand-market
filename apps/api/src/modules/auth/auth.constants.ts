export const BCRYPT_SALT_ROUNDS = 10;

// Stricter than the global default (see THROTTLE_LIMIT/THROTTLE_TTL_MS) —
// login is the brute-force target the spec calls out explicitly.
export const LOGIN_THROTTLE = { limit: 5, ttl: 60_000 };
export const SIGNUP_THROTTLE = { limit: 10, ttl: 60_000 };

// Per-account lockout, on top of LOGIN_THROTTLE's per-IP limit: the
// throttle alone doesn't stop an attacker who spreads attempts across many
// IPs against one target account. Keyed by username rather than user id
// since the account may not exist yet (an unknown-username guess still
// counts as a failure, so probing usernames doesn't get a free pass) —
// the flip side is an attacker can lock out a *known* username on purpose;
// LOGIN_THROTTLE caps how fast they can do that from one IP.
export const LOGIN_FAIL_THRESHOLD = 5;
export const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

// httpOnly session cookies (see auth.controller.ts) — not readable by JS,
// so an XSS bug can't exfiltrate them the way it could a sessionStorage
// token. Trade-off: cookies are shared across every tab of the same
// origin, unlike the sessionStorage they replace, so logging into a second
// account in another tab now overwrites the first tab's session (see
// SECURITY.md for the full reasoning).
export const ACCESS_TOKEN_COOKIE = "accessToken";
export const REFRESH_TOKEN_COOKIE = "refreshToken";

// Deliberately NOT httpOnly — the frontend must be able to read this value
// and echo it back as the X-CSRF-Token header (double-submit cookie
// pattern). It carries no secret weight on its own: the security property
// comes from a cross-origin attacker being unable to read *or* set this
// cookie for our origin, not from the value being hidden.
export const CSRF_COOKIE = "csrfToken";
export const CSRF_HEADER = "x-csrf-token";
