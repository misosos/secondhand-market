// Shared between auth.service.ts (write on login/refresh, delete on logout)
// and user.service.ts (delete on password change) so both agree on the key
// format without importing each other's module.
export const refreshTokenKey = (userId: string) => `refresh:${userId}`;

// Account-level login lockout (see LOGIN_FAIL_THRESHOLD in auth.constants.ts).
export const loginFailKey = (username: string) => `login:fails:${username}`;
export const loginLockKey = (username: string) => `login:lock:${username}`;
