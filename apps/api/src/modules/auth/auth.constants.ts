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
