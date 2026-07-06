export const BCRYPT_SALT_ROUNDS = 10;

// Stricter than the global default (see THROTTLE_LIMIT/THROTTLE_TTL_MS) —
// login is the brute-force target the spec calls out explicitly.
export const LOGIN_THROTTLE = { limit: 5, ttl: 60_000 };
export const SIGNUP_THROTTLE = { limit: 10, ttl: 60_000 };
