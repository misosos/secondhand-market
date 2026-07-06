// Shared between auth.service.ts (write on login/refresh, delete on logout)
// and user.service.ts (delete on password change) so both agree on the key
// format without importing each other's module.
export const refreshTokenKey = (userId: string) => `refresh:${userId}`;
